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
  scored?: { ids: readonly PlayerId[]; tick: number };
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
const FENCE = '#cfd6cd';
const POLE = '#9aa3a8';
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
    return BALL_REST + Math.sin(Math.min(1, travel) * Math.PI) * Math.min(3.6, distance * 0.42);
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
function ScoringRunner({ from, onDone }: { from: 1 | 2 | 3; onDone: () => void }) {
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
function BallInFlight({ hit }: { hit: BallHit }) {
  const ball = useRef<THREE.Mesh>(null);
  const mark = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  const homer = hit.y > 1;
  const target = useMemo(() => new THREE.Vector3(...toWorld(hit.x, hit.y)), [hit.x, hit.y]);
  const distance = useMemo(() => target.length(), [target]);

  // Restart on every play, including a ball hit to the same place twice.
  useEffect(() => { t.current = 0; }, [hit.tick]);

  useFrame((_, delta) => {
    t.current += delta;

    const flight = flightSeconds(hit.kind, distance, homer);
    const p = Math.min(1, t.current / flight);

    const b = ball.current;
    if (b) {
      // Along the ground in a straight line; the shape is all in the height.
      const travel = homer ? p * 1.25 : p;
      b.position.set(target.x * travel, 0, target.z * travel);
      b.position.y = flightHeight(hit.kind, travel, distance, homer);
      // On arrival the ball itself takes the colour of the outcome and blinks,
      // so a play reads off the field before the log line is scanned. Three
      // pulses is enough to register and short enough not to hold up the
      // next call.
      const mat = b.material as THREE.MeshBasicMaterial;
      if (p >= 1) {
        const since = t.current - flight;
        const blink = Math.sin(since * 22) > 0;
        mat.color.set(blink ? (hit.hit ? HIT_BLUE : OUT_RED) : CREAM);
      } else {
        mat.color.set(CREAM);
      }
      b.visible = t.current < flight + (homer ? 0.5 : 0.62);
    }

    const m = mark.current;
    if (m) {
      // The spot pulses only once the ball has arrived, and never for a homer —
      // nobody fielded it, so there is no spot to look at.
      const after = t.current - flight;
      const show = !homer && after > 0 && after < 0.9;
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
      <mesh ref={mark} position={target} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
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
  const [finishing, setFinishing] = useState<{ key: string; from: 1 | 2 | 3 }[]>([]);

  useEffect(() => {
    const ids = scored?.ids ?? [];
    if (ids.length > 0) {
      const leaving = previous.current
        .filter((r) => ids.includes(r.id))
        .map((r) => ({ key: `${r.id}-${scored?.tick ?? 0}`, from: r.base }));
      if (leaving.length > 0) setFinishing((f) => [...f, ...leaving]);
    }
    previous.current = runners;
  }, [scored?.tick]);

  // Keep the snapshot current even on plays where nobody scored.
  useEffect(() => {
    previous.current = runners;
    aboard.current = new Set(runners.map((r) => r.id));
    opened.current = true;
  }, [runners]);

  // A device that cannot give us WebGL gets nothing rather than a crash. The
  // caller supplies the fallback.
  const [ok, setOk] = useState(true);

  return (
    <div style={{ width: '100%', height, position: 'relative' }}>
      {ok && (
        <Canvas
          gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
          dpr={[1, 1.6]}
          camera={{ fov: 42, near: 0.1, far: 60 }}
          onError={() => setOk(false)}
          style={{ touchAction: 'pan-y' }}
        >
          <CameraRig />
          <Field />
          <Plate tick={scoreTick} />
          {([1, 2, 3] as const).map((b) => <Base key={b} at={b} />)}
          {runners.map((r) => (
            <RunnerDot
              key={r.id}
              base={r.base}
              from={opened.current && !aboard.current.has(r.id) ? 0 : r.base}
              colour={CLAY}
            />
          ))}
          {ball && <BallInFlight key={ball.tick} hit={ball} />}
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
