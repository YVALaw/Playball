// Diamond3D.tsx
// The field, in three dimensions.
//
// The 2D version's note still holds and is the reason this one is built the way
// it is: almost all of the life comes from *movement*, not from geometry. So
// there is no attempt at a photographic ballpark here. What three dimensions buy
// is the low camera angle — you read the diamond from behind the plate the way
// television shows it, depth tells you instantly how far a runner has gone, and
// a ball arcing to the outfield is legible in a way a dot sliding across a flat
// box never is.
//
// Everything is drawn from primitives and flat colours, on purpose. It keeps the
// scene under a few dozen triangles so a phone renders it without spinning up
// its fans, and it matches the app's palette rather than fighting it.
//
// Nothing here invents information. Every runner position comes from the same
// engine-reported list the 2D diamond used.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { BattedBall, PlayerId } from '../engine/types.js';
// The 2D field, kept close for the one device this canvas cannot serve.
import { Diamond } from './Diamond.js';

export interface Runner {
  id: PlayerId;
  name: string;
  base: 1 | 2 | 3;
}

/** Where the last ball went, straight off the engine's `landing` coordinate. */
export interface BallHit {
  /** -1 at the left field line, +1 at the right. */
  x: number;
  /** 0 at home plate, 1 at the wall, past 1 when it left the park. */
  y: number;
  /**
   * What kind of ball it was. The engine already decides this; the flight is
   * meaningless without it, because a grounder and a fly ball travel to the same
   * place along completely different paths.
   */
  kind: BattedBall;
  /**
   * Whether the batter reached. Decides what the ball flashes when it lands, so
   * the field says how the play ended without waiting for the log line.
   */
  hit: boolean;
  /**
   * Whether it was caught on the fly.
   *
   * The difference between a catch and a hit is the whole readability of the
   * play and it is not derivable from `hit` alone: a ground out is an out
   * where the ball reached the dirt, and a dropped fly is a ball that reached
   * the dirt and was not an out. Caught balls stop in a glove at glove height;
   * everything else lands, rolls, and gets chased down.
   */
  caught: boolean;
  /** Bumped per play, so the same spot twice still replays the animation. */
  tick: number;
}

/**
 * How each kind of batted ball travels.
 *
 * `arc` is the peak height as a fraction of distance travelled, `seconds` is a
 * fixed cost plus time per unit of distance, and `hops` is how many times it
 * bounces on the way.
 *
 * This table exists because one parabola for everything was plainly wrong on
 * screen: a routine ground ball to short sailed through the air on the same
 * gentle arc as a fly to the warning track, which makes the two plays
 * indistinguishable at exactly the moment you are watching to tell them apart.
 * A grounder skips along the dirt, a liner is nearly flat and fast, a fly hangs,
 * and a popup goes almost straight up.
 */
const FLIGHT: Record<BattedBall, { arc: number; base: number; per: number; hops: number }> = {
  ground: { arc: 0.020, base: 0.42, per: 0.075, hops: 3 },
  line:   { arc: 0.105, base: 0.26, per: 0.038, hops: 0 },
  fly:    { arc: 0.330, base: 0.45, per: 0.085, hops: 0 },
  popup:  { arc: 0.900, base: 0.85, per: 0.060, hops: 0 },
};

interface Props {
  runners: readonly Runner[];
  /** Bumped when a run scores, to flash the plate. */
  scoreTick?: number;
  /** The last batted ball, or null when nothing was put in play. */
  ball?: BallHit | null;
  /**
   * Runners who crossed the plate on the last play.
   *
   * The engine removes a man from the bases the instant he scores, so without
   * this he vanishes mid-diamond — the run happens off screen, at exactly the
   * moment worth watching. Given here, he finishes his run home.
   */
  /**
   * Who crossed the plate on the last play, and from where.
   *
   * The base comes from the engine's own advance event rather than from a
   * snapshot of who used to be on base. The snapshot version raced and lost:
   * `scoreTick` is bumped inside an effect, so it lands a commit *after* the
   * runners prop changes, and by then the snapshot had already been overwritten
   * with the post-play bases — the scoring runner was no longer in it, nobody
   * ran home, and all you saw was the plate flash.
   */
  scored?: { runners: readonly { id: PlayerId; from: 0 | 1 | 2 | 3 }[]; tick: number };
  /** Height in pixels. Width fills the container. */
  height?: number;
}

/**
 * Normalized field coordinates to world space.
 *
 * The engine reports where a ball finished as a fraction of the field, which
 * keeps it a geometric fact rather than a rendering decision — a headless test
 * can assert on a landing without knowing a renderer exists. This is the only
 * place that fraction becomes a position.
 */
function toWorld(x: number, y: number): [number, number, number] {
  return [x * 8.0, 0, -y * 9.0];
}

/**
 * Where the bags sit in world space.
 *
 * Home at the origin with the outfield running toward **negative** z, and the
 * camera behind the plate at positive z looking down the negative axis.
 *
 * The direction matters and is not arbitrary. A camera looking along +z sees the
 * +x axis on the *left*, so building the field along +z put first base on the
 * third base side — a mirrored diamond, which is the one error in a baseball
 * graphic that every viewer catches immediately. Looking down -z is the
 * conventional orientation and puts first base where it belongs, on the right.
 *
 * Ninety feet maps to about 3 units, which keeps the infield inside a
 * comfortable frustum without any scaling maths later.
 */
const BAG: Record<0 | 1 | 2 | 3, [number, number, number]> = {
  0: [0, 0, 0],         // home
  1: [2.1, 0, -2.1],    // first, on the right from behind the plate
  2: [0, 0, -4.2],      // second
  3: [-2.1, 0, -2.1],   // third
};

const CLAY = '#a8442a';
const GRASS = '#3f6f4a';
const DIRT = '#c8a882';
const CREAM = '#f6f1e6';
const MOUND = '#b89a75';
// Barely lighter than the grass. Mown stripes should read as a kept surface at
// a glance and disappear on a second look; at real contrast they became a
// sunburst radiating from a point that is not home plate, which is the sort of
// detail that draws the eye precisely because it is wrong.
const GRASS_LIGHT = '#456f4d';
const TRACK = '#b08a5e';
const WALL = '#2f5a3c';
const WALL_CAP = '#c9d2c5';
const FENCE = '#cfd6cd';
const POLE = '#9aa3a8';
const FOUL_POLE = '#d9b83a';
const BOARD = '#1c2430';
const BOARD_FACE = '#31435f';
/** The defense. The other uniform on the field. */
const FIELDER = '#2b3b55';
/** What the ball flashes on arrival: an out, and a man aboard. */
const OUT_RED = '#c4382a';
const HIT_BLUE = '#2f6fb0';

/** Where the ball rests on the ground, so it never sinks into the turf. */
const BALL_REST = 0.15;

/**
 * Height of the ball at a point along its flight.
 *
 * Pulled out of the render loop deliberately: this is the whole difference
 * between the four kinds of batted ball, it is pure arithmetic, and inside a
 * `useFrame` closure it could only be checked by trying to photograph a moving
 * object at the right millisecond.
 *
 * `travel` is 0 at the plate and 1 where the ball finishes; `distance` is how
 * far that is in world units.
 */
export function flightHeight(
  kind: BattedBall, travel: number, distance: number, homer: boolean,
): number {
  if (homer) {
    /*
      It leaves; it does not land.

      Reported: "on a home run the ball looks like it is still falling inside
      the park." It was. A full `sin(travel * PI)` returns to zero exactly at
      travel 1 -- the wall -- and the last quarter of the flight then slid the
      ball along the grass, which is the one shape a home run never has.

      Widening the half-cycle puts the apex around three quarters of the way out
      and leaves the ball high as it crosses, still well up when it is last
      seen. `PEAK` is where in the flight it tops out; anything under 1 means
      it is still climbing at the fence, which looks wrong in the other
      direction.
    */
    const PEAK = 0.8;
    const rise = Math.sin(Math.min(1.25, travel) * (Math.PI / 2) / PEAK);
    return BALL_REST + Math.max(0, rise) * Math.min(4.2, distance * 0.48);
  }

  const profile = FLIGHT[kind];

  if (profile.hops > 0) {
    // A grounder skips, each hop lower than the last, and is rolling by the time
    // it reaches the fielder. A single arc through the air made a routine ground
    // ball to short indistinguishable from a fly to the track — the two plays
    // you are most often watching to tell apart.
    const decay = Math.max(0, 1 - travel);
    const hop = Math.abs(Math.sin(travel * Math.PI * profile.hops));
    return BALL_REST + hop * decay * distance * profile.arc * 3;
  }

  return BALL_REST + Math.sin(travel * Math.PI) * distance * profile.arc;
}

/** How long the ball is in the air, from the same profile. */
export function flightSeconds(kind: BattedBall, distance: number, homer: boolean): number {
  if (homer) return 1.5;
  const profile = FLIGHT[kind];
  return profile.base + distance * profile.per;
}

/** How fast a runner covers the basepath, in world units per second. */
const RUNNER_SPEED = 3.6;

/**
 * The bags a runner touches going from one base to another.
 *
 * `to` of 4 is home. Pulled out of the component because it is the difference
 * between a man running the bases and a man sliding diagonally across the
 * pitcher's mound, and inside a `useFrame` closure that could only be checked by
 * photographing a moving object at the right millisecond.
 */
export function basePath(from: 0 | 1 | 2 | 3, to: 1 | 2 | 3 | 4): [number, number, number][] {
  const stops: [number, number, number][] = [];
  for (let b = from + 1; b <= to; b++) stops.push(BAG[(b % 4) as 0 | 1 | 2 | 3]);
  return stops;
}

/**
 * A runner, who runs.
 *
 * Two things were wrong before, and the first one hid the second.
 *
 * **The position was a prop.** `<mesh position={BAG[base]}>` looks harmless and
 * is fatal: R3F re-applies props on every render, so the moment the engine moved
 * a man to the next base React re-rendered and the mesh was snapped there before
 * the easing could show a single frame. The runner teleported, and the lerp
 * underneath it had been doing nothing all along. Position is owned by the frame
 * loop now and never passed in.
 *
 * **And he took the short way.** Easing straight toward the destination sends a
 * man going first to third diagonally across the pitcher's mound. He follows the
 * bags now — the path is built from the bases he actually has to touch.
 */
function RunnerDot(
  { base, from, colour }: { base: 1 | 2 | 3; from: 0 | 1 | 2 | 3; colour: string },
) {
  const ref = useRef<THREE.Mesh>(null);
  // Where he starts. A man already standing on a bag when the screen opens is
  // placed there; a batter who has just reached starts at the plate and runs,
  // because appearing on first is the same teleport the advance bug produced —
  // it just happened to be the one nobody was looking at.
  const origin = useRef<0 | 1 | 2 | 3>(from);
  const path = useRef<THREE.Vector3[]>(
    from === base ? [] : basePath(from, base).map((p) => new THREE.Vector3(...p)),
  );
  const at = useRef<number>(base);
  const placed = useRef(false);

  // Build the route whenever the engine moves him, touching every bag between.
  useEffect(() => {
    const from = at.current;
    if (from === base) return;
    path.current = basePath(from as 0 | 1 | 2 | 3, base)
      .map((p) => new THREE.Vector3(...p));
    at.current = base;
  }, [base]);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;

    // A man who has just reached base appears standing on it, rather than
    // sprinting in from the middle of the diamond.
    if (!placed.current) {
      mesh.position.set(...BAG[origin.current]);
      placed.current = true;
      if (path.current.length === 0) return;
    }

    const next = path.current[0];
    if (!next) return;

    const step = RUNNER_SPEED * delta;
    const gap = mesh.position.distanceTo(next);
    if (gap <= step) {
      mesh.position.copy(next);
      path.current.shift();
      return;
    }
    mesh.position.addScaledVector(
      next.clone().sub(mesh.position).divideScalar(gap), step,
    );
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.34, 12, 10]} />
      <meshBasicMaterial color={colour} />
    </mesh>
  );
}

/**
 * A man completing his run home, then gone.
 *
 * Rendered separately from the runners on base because by this point the engine
 * has already taken him off them. He is a few hundred milliseconds of follow
 * through, and the alternative is a red dot blinking out of existence on third.
 */
function ScoringRunner({ from, onDone }: { from: 0 | 1 | 2 | 3; onDone: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const path = useRef<THREE.Vector3[]>(
    basePath(from, 4).map((p) => new THREE.Vector3(...p)),
  );
  const placed = useRef(false);
  const fade = useRef(1);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (!placed.current) { mesh.position.set(...BAG[from]); placed.current = true; return; }

    const next = path.current[0];
    if (next) {
      const step = RUNNER_SPEED * delta;
      const gap = mesh.position.distanceTo(next);
      if (gap <= step) { mesh.position.copy(next); path.current.shift(); }
      else {
        mesh.position.addScaledVector(next.clone().sub(mesh.position).divideScalar(gap), step);
      }
      return;
    }

    // Home. Fade out and let the parent drop him.
    fade.current -= delta * 3;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, fade.current);
    mesh.scale.setScalar(Math.max(0.01, fade.current));
    if (fade.current <= 0) onDone();
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.34, 12, 10]} />
      <meshBasicMaterial color={CLAY} transparent opacity={1} />
    </mesh>
  );
}

/** The plate flashes when a run scores. */
function Plate({ tick }: { tick: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const flash = useRef(0);

  useEffect(() => { if (tick > 0) flash.current = 1; }, [tick]);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    flash.current = Math.max(0, flash.current - delta * 1.6);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(flash.current > 0 ? CLAY : CREAM);
    const s = 1 + flash.current * 0.7;
    mesh.scale.set(s, 1, s);
  });

  return (
    <mesh ref={ref} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.5, 5]} />
      <meshBasicMaterial color={CREAM} />
    </mesh>
  );
}

/**
 * The ball, from the plate to wherever it finished.
 *
 * Two behaviours from one component, because they are the same flight with a
 * different ending. An ordinary batted ball travels out and stops where the
 * fielder got to it, then the spot pulses once so the eye lands there. A home
 * run carries the same arc, higher and further, and keeps going after it crosses
 * the wall — the ball does not stop, it leaves.
 *
 * The arc height scales with distance, which is what separates a bloop into
 * shallow left from a drive to the gap without either being animated specially.
 */
/**
 * Where the nine defenders stand, in world space.
 *
 * The same normalized spots the engine's landing table thinks in, run through
 * `toWorld` by hand — except the catcher, who belongs behind the plate where
 * the camera can see him, not on top of it.
 */
export const STATIONS: readonly [number, number, number][] = [
  [0, 0, 0.55],                      // C
  [0, 0, -1.71],                     // P
  [2.32, 0, -2.88],                  // 1B
  [1.68, 0, -3.06],                  // 2B
  [-1.68, 0, -3.06],                 // SS
  [-2.32, 0, -2.88],                 // 3B
  [-4.32, 0, -6.48],                 // LF
  [0, 0, -7.74],                     // CF
  [4.32, 0, -6.48],                  // RF
];

/** The height the dots ride at, so a distance check is a flat one. */
const DOT_Y = 0.26;
/** How fast a defender covers ground when he is not beating a ball there. */
const FIELDER_SPEED = 3.9;
/** How high a caught ball is held. A glove, not the turf. */
const GLOVE_Y = 1.05;
/** How long a ground ball rolls after it lands before it is run down. */
const ROLL_DUR = 0.55;
/** The beat between the play resolving and the throw leaving his hand. */
const HOLD_DUR = 0.42;
/** How long the outcome colour shows. Long enough to read, short enough to end. */
const BLINK_DUR = 0.75;
/** The longest a fielder may spend running one down. See `arrive`. */
const MAX_CHASE = 1.15;
/** How long any throw takes, whatever it is throwing at. */
const THROW_DUR = 0.5;
/** Where a fielded ball goes home to when there is no play to make. */
const MOUND_SPOT = new THREE.Vector3(0, 0, -1.71);

/**
 * The whole play, worked out once, so the ball and the defense are acting from
 * the same script.
 *
 * Reported from testing: *"all balls seem to be reaching the players which
 * makes it feel like it was an out but it wasn't… I'd like to see the ball
 * actually fall on the ground and the players chase it and then throw it
 * wherever they need to."* Both halves of that used to be guessed at
 * separately — the ball had one timeline, the fielder another — so they
 * agreed only by luck and the picture read as a catch every time.
 *
 * Pure arithmetic on the engine's own coordinate. It invents nothing about
 * what happened: `caught` and `hit` are facts off the play, and everything
 * here is when and where to draw them.
 */
export interface PlayPlan {
  /** Where the ball first meets glove or grass. */
  target: THREE.Vector3;
  /** Where it comes to rest, past the landing spot when it rolls. */
  rest: THREE.Vector3;
  /** Seconds of flight before it gets there. */
  flight: number;
  /** Which station index runs it down. -1 when nobody does (a home run). */
  chaser: number;
  /** When the fielder has it in his hand. */
  pickup: number;
  /** Where he throws it, and when the throw leaves. */
  throwTo: THREE.Vector3;
  throwAt: number;
  /** When the ball is done and the fielder may walk back. */
  done: number;
  /**
   * When the play is *decided*, which is not when the ball lands.
   *
   * The colour flash hangs off this rather than off the landing, and the
   * difference is the whole reported bug: a ground out used to flash red the
   * instant the ball touched grass, several yards past the nearest dot and a
   * second before anybody reached it. Which is precisely the picture a base hit
   * makes — ball down in the green, nobody near it — so the field was
   * announcing an out with the image of a single.
   *
   * A catch is decided on arrival. A hit is decided on arrival, because the
   * arrival *is* the event: it landed and nobody was there. A ball fielded on
   * the ground is decided when a man actually has it, so the red goes off in
   * his hands and then rides the throw to first.
   */
  outcomeAt: number;
  caught: boolean;
  homer: boolean;
}

export function playPlan(hit: BallHit, stations: THREE.Vector3[]): PlayPlan {
  const [tx, , tz] = toWorld(hit.x, hit.y);
  const homer = hit.y > 1;
  const target = new THREE.Vector3(tx, hit.caught ? GLOVE_Y : BALL_REST, tz);
  const flight = flightSeconds(hit.kind, new THREE.Vector3(tx, 0, tz).length(), homer);

  // A ball on the ground keeps going. Rolling outward from the plate is the
  // cheap honest direction: it is where the bat sent it.
  const rest = hit.caught || homer
    ? target.clone()
    : new THREE.Vector3(tx, BALL_REST, tz).multiplyScalar(1.09);

  if (homer) {
    return {
      target, rest, flight, chaser: -1,
      pickup: flight, throwTo: MOUND_SPOT, throwAt: flight + 9, done: flight + 0.5,
      // A ball leaving the yard needs no colour to explain it.
      outcomeAt: Infinity,
      caught: false, homer: true,
    };
  }

  // Whoever is closest to where it finishes. The battery stays home: a catcher
  // never chases and a pitcher only fields what is at his feet.
  const spot = new THREE.Vector3(rest.x, DOT_Y, rest.z);
  let chaser = 1;
  let bestD = Infinity;
  stations.forEach((s, i) => {
    if (i === 0) return;
    const d = s.distanceToSquared(spot) + (i === 1 ? 6 : 0);
    if (d < bestD) { bestD = d; chaser = i; }
  });

  // A catch happens at the moment of arrival by definition, so the man has to
  // be there; a ball on the ground is run down after it stops rolling.
  const arrive = hit.caught
    ? flight
    : Math.min(
      // Capped, because this is a summary of a play rather than a simulation
      // of one. An uncapped chase across the gap took four seconds, which is
      // longer than the window the dugout greys its buttons for -- so the next
      // call became available while the last play was still being drawn.
      flight + MAX_CHASE,
      Math.max(
        flight + ROLL_DUR,
        (stations[chaser]?.distanceTo(spot) ?? 0) / FIELDER_SPEED,
      ),
    );
  const pickup = arrive + HOLD_DUR;

  /*
    Where the throw goes, which is the part that tells the story.

    A ground ball out is a throw to first — that is the play being made. A hit
    goes to the cutoff, second base, because the batter is standing on a bag
    and nobody is being retired. A catch just comes back to the pitcher.
  */
  const throwTo = hit.caught
    ? MOUND_SPOT
    : hit.hit
      ? new THREE.Vector3(...BAG[2])
      : new THREE.Vector3(...BAG[1]);

  return {
    target, rest, flight, chaser,
    pickup, throwTo, throwAt: pickup,
    done: pickup + THROW_DUR,
    // See `outcomeAt`. Only a ball fielded on the ground waits for the man.
    outcomeAt: hit.caught || hit.hit ? flight : arrive,
    caught: hit.caught, homer: false,
  };
}

/**
 * The ball, from the plate to wherever the play ends.
 *
 * Four movements, and which ones run depends on what happened: the flight,
 * the roll, the outcome blink while a fielder gets to it, and the throw. A
 * home run skips all but the first and leaves.
 */
function BallInFlight({ hit, plan }: { hit: BallHit; plan: PlayPlan }) {
  const ball = useRef<THREE.Mesh>(null);
  const mark = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  const distance = useMemo(
    () => new THREE.Vector3(plan.target.x, 0, plan.target.z).length(), [plan],
  );

  // Restart on every play, including a ball hit to the same place twice.
  useEffect(() => { t.current = 0; }, [hit.tick]);

  useFrame((_, delta) => {
    t.current += delta;
    const now = t.current;
    const b = ball.current;

    if (b) {
      const mat = b.material as THREE.MeshBasicMaterial;
      const p = Math.min(1, now / plan.flight);

      if (now < plan.flight) {
        // Along the ground in a straight line; the shape is all in the height.
        const travel = plan.homer ? p * 1.25 : p;
        b.position.set(plan.target.x * travel, 0, plan.target.z * travel);
        b.position.y = flightHeight(hit.kind, travel, distance, plan.homer);
        b.visible = true;
      } else if (plan.homer) {
        const travel = Math.min(1.25, (now / plan.flight) * 1.25);
        b.position.set(plan.target.x * travel, 0, plan.target.z * travel);
        b.position.y = flightHeight(hit.kind, travel, distance, true);
        b.visible = now < plan.flight + 0.5;
      } else if (now < plan.throwAt) {
        // Landed. A caught ball is held where it was caught; a live one rolls
        // out and then lies there while the man runs it down.
        const roll = plan.caught
          ? 1
          : Math.min(1, (now - plan.flight) / ROLL_DUR);
        b.position.lerpVectors(plan.target, plan.rest, roll);
        b.position.y = plan.caught ? GLOVE_Y : BALL_REST;
        b.visible = true;
      } else {
        // The throw. Where it goes is the play being made — see `playPlan`.
        const k = Math.min(1, (now - plan.throwAt) / THROW_DUR);
        b.position.lerpVectors(plan.rest, plan.throwTo, k);
        b.position.y = BALL_REST + Math.sin(k * Math.PI) * 1.15;
        b.visible = k < 1;
      }

      /*
        The outcome, blinked once and then done.

        Timed off `outcomeAt` rather than off the landing, and set here rather
        than inside the movement branches, because the moment a play is decided
        and the moment the ball stops moving are the same event only for a catch
        and a base hit. On a grounder the red now goes off in the fielder's hand
        and carries a little way into the throw, which is a picture of an out
        being made; before, it went off in empty grass, which is a picture of a
        single.

        It stays a signal rather than a state -- long enough to read, then the
        ball is a ball again. An earlier build blinked for the entire chase and
        left a red light flashing in the gap for four seconds.
      */
      const since = now - plan.outcomeAt;
      const blink = since >= 0 && since < BLINK_DUR && Math.sin(since * 22) > 0;
      mat.color.set(blink ? (hit.hit ? HIT_BLUE : OUT_RED) : CREAM);
    }

    const m = mark.current;
    if (m) {
      /*
        The spot where it finished, pulsed once. Hits only.

        Never for a homer — nobody fielded it, so there is no spot to look at —
        and never for a catch, where the glove is the event rather than the
        grass. And, since the same report that moved the blink, never for a ball
        fielded on the ground either: a red ring expanding in the outfield is
        the single most hit-looking thing the field can draw, and drawing it
        under an out was half of why an out read as one.

        A grounder is now told by the fielder having it and the throw going in.
        Which is how it is told on a television.
      */
      const after = now - plan.flight;
      const show = !plan.homer && !plan.caught && hit.hit && after > 0 && after < 0.9;
      m.visible = show;
      if (show) {
        const k = after / 0.9;
        const s2 = 0.4 + k * 1.5;
        m.scale.set(s2, s2, s2);
        (m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      }
    }
  });

  return (
    <group>
      <mesh ref={ball}>
        <sphereGeometry args={[0.17, 8, 6]} />
        <meshBasicMaterial color={CREAM} />
      </mesh>
      <mesh
        ref={mark}
        position={[plan.rest.x, 0.02, plan.rest.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[0.34, 0.5, 16]} />
        <meshBasicMaterial
          color={hit.hit ? HIT_BLUE : OUT_RED}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

/**
 * The defense, acting out the plan the ball is following.
 *
 * Nine dots in the other uniform, standing where their positions stand. One of
 * them goes and gets it — fast enough to be under a catch, at a run for
 * anything on the ground — holds it while the outcome blinks, throws, and
 * walks back. Presentation only: the engine decided all of it before the first
 * frame drew.
 */
function Defense(
  { plan, stations }: { plan: PlayPlan | null; stations: THREE.Vector3[] },
) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const t = useRef(0);

  useEffect(() => { t.current = 0; }, [plan]);

  useFrame((_, delta) => {
    t.current += delta;
    const now = t.current;
    stations.forEach((station, i) => {
      const m = refs.current[i];
      if (!m) return;

      const chasing = plan !== null && i === plan.chaser && now <= plan.done;
      const goal = chasing
        ? new THREE.Vector3(plan.rest.x, DOT_Y, plan.rest.z)
        : station;

      const gap = m.position.distanceTo(goal);
      if (gap < 0.02) return;

      /*
        A man under a fly ball has to be there when it lands, so his speed is
        whatever that takes; everything else is a run. Without this the ball
        was caught by nobody — it stopped in mid air a second before the dot
        supposed to have caught it arrived.
      */
      const speed = chasing && plan.caught
        ? Math.max(FIELDER_SPEED, gap / Math.max(0.15, plan.flight - now))
        : FIELDER_SPEED;

      const step = speed * delta;
      if (gap <= step) { m.position.copy(goal); return; }
      m.position.addScaledVector(
        goal.clone().sub(m.position).divideScalar(gap), step,
      );
    });
  });

  return (
    <group>
      {stations.map((s, i) => (
        <mesh
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          position={[s.x, s.y, s.z]}
        >
          <sphereGeometry args={[0.28, 10, 8]} />
          <meshBasicMaterial color={FIELDER} />
        </mesh>
      ))}
    </group>
  );
}

function Base({ at }: { at: 1 | 2 | 3 }) {
  return (
    <mesh position={BAG[at]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
      <planeGeometry args={[0.62, 0.62]} />
      <meshBasicMaterial color={CREAM} />
    </mesh>
  );
}

/**
 * The park.
 *
 * Four things carry the read at this size, and none of them is detail: the
 * outfield wall gives the field an edge instead of trailing off into nothing,
 * the warning track separates grass from wall, dirt basepaths around a grass
 * infield are the shape everyone recognises as a diamond, and light towers put
 * something above the horizon so it reads as a stadium rather than a lawn.
 *
 * Still primitives and flat colours. The whole park is a few hundred triangles,
 * which is what lets a phone hold sixty frames while a game is being managed.
 */
function Field() {
  const WALL_R = 8.9;
  const TRACK_R = 8.2;

  return (
    <group>
      {/* Outfield grass, a 270 degree wedge with its gap behind the plate. */}
      <mesh position={[0, -0.02, -3.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[TRACK_R, 32, -Math.PI * 0.25, Math.PI * 1.5]} />
        <meshBasicMaterial color={GRASS} />
      </mesh>

      {/* Mown stripes. Alternating wedges, which is what a groundskeeper's
          mower actually leaves and reads instantly as a kept field. */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh
          key={i}
          position={[0, -0.015, -3.4]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry
            args={[TRACK_R, 8, -Math.PI * 0.25 + (i * 2 * Math.PI * 1.5) / 14, (Math.PI * 1.5) / 14]}
          />
          <meshBasicMaterial color={GRASS_LIGHT} />
        </mesh>
      ))}

      {/* Warning track, then the wall standing on it. */}
      <mesh position={[0, -0.012, -3.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[TRACK_R, WALL_R, 32, 1, -Math.PI * 0.25, Math.PI * 1.5]} />
        <meshBasicMaterial color={TRACK} />
      </mesh>

      <mesh position={[0, 0.42, -3.4]}>
        <cylinderGeometry
          args={[WALL_R, WALL_R, 0.85, 32, 1, true, -Math.PI * 0.25, Math.PI * 1.5]}
        />
        <meshBasicMaterial color={WALL} side={THREE.DoubleSide} />
      </mesh>

      {/* The skinned infield: a dirt diamond with the grass inset inside it, so
          what is left showing is the basepaths. */}
      <mesh position={[0, -0.01, -2.1]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <planeGeometry args={[4.7, 4.7]} />
        <meshBasicMaterial color={DIRT} />
      </mesh>
      <mesh position={[0, 0, -2.1]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <planeGeometry args={[3.3, 3.3]} />
        <meshBasicMaterial color={GRASS} />
      </mesh>

      {/* Dirt around the plate, and the mound. */}
      <mesh position={[0, 0.001, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.15, 20]} />
        <meshBasicMaterial color={DIRT} />
      </mesh>
      <mesh position={[0, 0, -2.1]}>
        <cylinderGeometry args={[0.62, 0.72, 0.1, 16]} />
        <meshBasicMaterial color={MOUND} />
      </mesh>

      {/*
        Foul lines, running from the plate out to the corners.

        The rotation sign matters and was wrong. After the -PI/2 tilt that lays a
        plane flat, its length axis points along world -Z, and a further +45
        degrees about Z swings it to run from deep centre to a point beside home
        — ninety degrees off, so the lines crossed the field instead of bounding
        it. Negating it sends each line from the plate out to its own corner.
      */}
      {[1, -1].map((side) => (
        <mesh
          key={side}
          position={[side * 3.05, 0.006, -3.05]}
          rotation={[-Math.PI / 2, 0, -(side * Math.PI) / 4]}
        >
          <planeGeometry args={[0.08, 8.7]} />
          <meshBasicMaterial color={CREAM} />
        </mesh>
      ))}

      {/* Backstop, behind the plate. */}
      <mesh position={[0, 0.3, 1.5]}>
        <cylinderGeometry args={[2.2, 2.2, 0.6, 16, 1, true, Math.PI * 0.72, Math.PI * 0.56]} />
        <meshBasicMaterial color={FENCE} side={THREE.DoubleSide} transparent opacity={0.5} />
      </mesh>

      {/* The wall wears a cap rail, which is most of what makes it read as a
          wall rather than a green cliff the grass falls off. */}
      <mesh position={[0, 0.86, -3.4]}>
        <cylinderGeometry
          args={[8.94, 8.94, 0.07, 32, 1, true, -Math.PI * 0.25, Math.PI * 1.5]}
        />
        <meshBasicMaterial color={WALL_CAP} side={THREE.DoubleSide} />
      </mesh>

      {/* Foul poles, where the lines meet the wall. Yellow, because eighty
          years of ballparks have made that the one colour that means "fair
          ends here" without a label. */}
      {[1, -1].map((side) => (
        <mesh key={side} position={[side * 7.76, 0.95, -7.76]}>
          <cylinderGeometry args={[0.06, 0.06, 1.9, 6]} />
          <meshBasicMaterial color={FOUL_POLE} />
        </mesh>
      ))}

      {/* Batter's boxes and the on-deck circles: chalk, not furniture. */}
      {[1, -1].map((side) => (
        <mesh
          key={`box-${side}`}
          position={[side * 0.62, 0.004, 0.12]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.4, 0.68]} />
          <meshBasicMaterial color={CREAM} transparent opacity={0.28} />
        </mesh>
      ))}
      {[1, -1].map((side) => (
        <mesh
          key={`deck-${side}`}
          position={[side * 1.75, 0.004, 1.05]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.26, 14]} />
          <meshBasicMaterial color={CREAM} transparent opacity={0.3} />
        </mesh>
      ))}

      {/* The scoreboard over center field. It shows nothing legible at this
          size and does not need to; a dark slab on legs above the wall is
          what says "ballpark" from four hundred feet. */}
      <group position={[0, 0, -12.75]}>
        {[1, -1].map((side) => (
          <mesh key={side} position={[side * 1.0, 0.6, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 1.2, 5]} />
            <meshBasicMaterial color={POLE} />
          </mesh>
        ))}
        <mesh position={[0, 1.75, 0]}>
          <boxGeometry args={[2.7, 1.2, 0.14]} />
          <meshBasicMaterial color={BOARD} />
        </mesh>
        <mesh position={[0, 1.75, 0.08]}>
          <planeGeometry args={[2.3, 0.8]} />
          <meshBasicMaterial color={BOARD_FACE} />
        </mesh>
      </group>

      {/* Light towers. Specks at this size, and the silhouette is the point. */}
      {[[-7.4, 1.2], [7.4, 1.2], [-5.6, -9.6], [5.6, -9.6]].map(([x, z], i) => (
        <group key={i} position={[x as number, 0, z as number]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 3, 5]} />
            <meshBasicMaterial color={POLE} />
          </mesh>
          <mesh position={[0, 3.15, 0]}>
            <boxGeometry args={[0.85, 0.5, 0.12]} />
            <meshBasicMaterial color={CREAM} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Point the camera at the infield, and keep it pointed there.
 *
 * `onCreated` is the obvious place for this and does not work: R3F owns the
 * camera and re-applies its own transform on mount and on every resize, so a
 * `lookAt` issued once is silently undone and the scene renders facing away from
 * the field — a canvas that is present, sized, error free, and completely blank.
 * Setting it from inside the tree, after R3F has finished, is what sticks.
 */
/**
 * Where the camera sits and what it looks at.
 *
 * Module level, and in the effect's dependency list, so editing these numbers
 * re-runs the effect on hot reload. Left inline they were captured once at mount
 * and every adjustment appeared to do nothing — which costs an entire reload per
 * tweak on a value that only gets found by tweaking.
 */
const EYE: [number, number, number] = [0, 6.7, 7.9];
const AIM: [number, number, number] = [0, 0.5, -4.15];

function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useEffect(() => {
    // Framed so the park fills the panel rather than floating in it.
    //
    // Aiming at the infield centre left a band of empty background above the
    // outfield wall, because the wall is the tallest thing in the scene and the
    // camera was pointed under it. Looking deeper tips the whole park up into
    // the frame and drops home plate toward the bottom edge, which is also the
    // angle a television camera actually uses.
    camera.position.set(...EYE);
    camera.lookAt(...AIM);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  return null;
}

/**
 * Frames only while something moves.
 *
 * The canvas used to render continuously between pitches — the documented
 * battery cost of the 3D field, burning GPU time on a scene where nothing had
 * changed since the last decision. The frameloop is 'demand' now, and this
 * asks for frames in a window after each new play; every animation in the
 * scene (ball flight, a runner's lerp, the trip home) finishes well inside
 * it. When the window closes the park simply holds its last frame, which for
 * a static scene is indistinguishable from rendering it again.
 */
function DemandDriver({ stamp }: { stamp: string }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let raf = 0;
    // Long enough for the slowest sequence in the scene: a deep fly, the
    // outcome blink, the throw back in, and the fielder's walk to his station.
    const until = performance.now() + 4600;
    const loop = (): void => {
      invalidate();
      if (performance.now() < until) raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [stamp, invalidate]);
  return null;
}

export function Diamond3D({
  runners, scoreTick = 0, ball = null, scored, height = 150,
}: Props) {
  // Men who scored on the last play, kept alive just long enough to finish.
  const previous = useRef<readonly Runner[]>([]);
  // Who was already on base before this play. Anyone else is the batter, and he
  // starts at the plate. Empty on the very first render so a game resumed
  // mid-inning places its runners rather than sprinting them all in from home.
  const aboard = useRef<Set<PlayerId>>(new Set());
  const opened = useRef(false);
  const [finishing, setFinishing] = useState<{ key: string; from: 0 | 1 | 2 | 3 }[]>([]);

  useEffect(() => {
    const list = scored?.runners ?? [];
    if (list.length === 0) return;
    setFinishing((f) => [
      ...f,
      ...list.map((r) => ({ key: `${r.id}-${scored?.tick ?? 0}`, from: r.from })),
    ]);
  }, [scored?.tick]);

  // Who was already on base before this play. Anyone else is the batter, and he
  // starts at the plate.
  useEffect(() => {
    previous.current = runners;
    aboard.current = new Set(runners.map((r) => r.id));
    opened.current = true;
  }, [runners]);

  // A device that cannot give us WebGL gets the 2D diamond rather than a
  // crash — or an empty box, which is what "the caller supplies the fallback"
  // actually produced: the Suspense fallback in Manage only covers *loading*
  // this chunk, not the canvas failing after it arrived. The game promised a
  // field on every device; this is where the promise is kept.
  const [ok, setOk] = useState(true);

  // One script for the play, read by the ball and by the nine men chasing it.
  const stations = useMemo(
    () => STATIONS.map((s) => new THREE.Vector3(s[0], DOT_Y, s[2])), [],
  );
  const plan = useMemo(
    () => (ball ? playPlan(ball, stations) : null),
    [ball?.tick, ball?.x, ball?.y, ball?.kind, ball?.hit, ball?.caught, stations],
  );

  if (!ok) {
    return (
      <div style={{
        width: '100%', height, position: 'relative',
        display: 'grid', placeItems: 'center',
      }}>
        <Diamond runners={runners} scoreTick={scoreTick} size={Math.min(height - 8, 132)} />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height, position: 'relative' }}>
      {ok && (
        <Canvas
          gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
          dpr={[1, 1.6]}
          camera={{ fov: 42, near: 0.1, far: 60 }}
          onError={() => setOk(false)}
          style={{ touchAction: 'pan-y' }}
          frameloop="demand"
        >
          <DemandDriver stamp={[
            scoreTick,
            ball?.tick ?? 0,
            runners.map((x) => `${x.id}${x.base}`).join(','),
            finishing.length,
          ].join(':')} />
          <CameraRig />
          <Field />
          <Plate tick={scoreTick} />
          <Defense plan={plan} stations={stations} />
          {([1, 2, 3] as const).map((b) => <Base key={b} at={b} />)}
          {runners.map((r) => (
            <RunnerDot
              key={r.id}
              base={r.base}
              from={opened.current && !aboard.current.has(r.id) ? 0 : r.base}
              colour={CLAY}
            />
          ))}
          {ball && plan && <BallInFlight key={ball.tick} hit={ball} plan={plan} />}
          {finishing.map((f) => (
            <ScoringRunner
              key={f.key}
              from={f.from}
              onDone={() => setFinishing((list) => list.filter((x) => x.key !== f.key))}
            />
          ))}
        </Canvas>
      )}
    </div>
  );
}
