// development.ts
// One man's winter: the arc he was always on, and a year of growth toward
// his ceiling.
//
// Lifted out of progression.ts on 2026-09-15 so that the generator can call
// it. `makeTeam` drew every man from one distribution and stamped a class on
// him afterwards, so a generated senior was no better than a generated
// freshman — and the engine was calibrated against that population, which
// exists on day one of a career and never again (05 §71.4). The fix is to
// build every man as the freshman he was and give him the winters his class
// implies, through THIS code, so the opening world has the ladder a settled
// one has by construction rather than by tuning. players.ts cannot import
// progression.ts (progression imports players), which is the only reason
// this is a file of its own; nothing here changed on the way over.

import { GENERATED_POTENTIAL_CAP } from './scouting.js';
import { overallOf, clamp, respectCeiling } from './ratings.js';
import { gauss } from './rng.js';
import { CLASS_ORDER, isTwoWay } from './types.js';
import type { ClassYear, Player, Rng } from './types.js';

/**
 * The arc a man was always on — stage 16, the 2K question answered.
 *
 * NBA 2K's model was investigated and its community's verdict kept: potential
 * bands with boom/bust are a good idea poorly expressed, because booming
 * there is a coin flip at the roll rather than anything you watch happen. So
 * here the arc is fixed from the day the man exists — a hash of his id, no
 * draw, no reload re-rolling who blooms — and it expresses through the same
 * play-scaled development pull as everything else: each June the scout's
 * number moves a step toward where the arc was always taking him, and the
 * year's growth then chases the revised number at whatever rate his minutes,
 * redshirt and culture set. A bust does not fall off a cliff: the pull only
 * chases a lowered ceiling at the ordinary rate — a point or so a winter —
 * and the revise-upward rule under `develop` keeps the printed number honest
 * against what he still actually does.
 *
 * HIDDEN, per the register: the word never prints anywhere. What the player
 * sees is the letter itself drifting — asked for in exactly those terms:
 * "not only getting worse but also getting better... a player that came in
 * as a C player but he starts getting better and we see the potential go
 * up." Steady is most of everybody, and the two tails are equal.
 */
export type Arc = 'bust' | 'steady' | 'boom';

const arcHash = (p: Player): number => {
  let h = 2166136261;
  const id = String(p.id);
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return h;
};

export function arcOf(p: Player): Arc {
  const r = arcHash(p) % 100;
  if (r < 15) return 'boom';
  if (r < 30) return 'bust';
  return 'steady';
}

/** How far the arc bends the ceiling, jittered per man so no two read alike. */
export function arcReach(p: Player): number {
  const arc = arcOf(p);
  if (arc === 'steady') return 0;
  const jitter = (arcHash(p) >>> 8) % 5;
  return arc === 'boom' ? 8 + jitter : -(9 + jitter);
}

/**
 * A year of development, applied after the class year advances.
 *
 * Players move toward their potential, fastest early: the jump from freshman to
 * sophomore is the biggest a college player ever makes. The noise term is what
 * makes recruiting a gamble rather than arithmetic — a 60 potential freshman can
 * stall, and a 48 can outgrow his projection.
 */
export function develop(p: Player, rng: Rng, growthMult = 1): number {
  /*
    The June reveal, before the pull, so this year's growth already chases
    the revised number. The goal is stamped at the man's first offseason
    (sparse -- an older save's men are put on their arcs from wherever their
    ceiling stands today) and the reveal takes no draw, so every rng pin
    below survives it. Three points a year: a full boom is watched across
    three winters rather than granted at one.
  */
  const man = p as Player & { arcGoal?: number };
  const reach = arcReach(p);
  if (reach !== 0) {
    man.arcGoal ??= clamp(Math.round(p.potential + reach), 25, GENERATED_POTENTIAL_CAP);
    const left = man.arcGoal - p.potential;
    if (left !== 0) p.potential += Math.sign(left) * Math.min(3, Math.abs(left));
  }

  const before = overallOf(p);
  const gap = p.potential - before;
  const rate = p.classYear === 'SO' ? 0.45 : p.classYear === 'JR' ? 0.35 : 0.25;
  // The training skill scales the systematic pull toward potential and nothing
  // else — the noise stays untouched, so a trained program raises the floor of
  // a class without making development any less of a gamble. It also keeps the
  // rng draw order identical whatever the multiplier, which is what lets a
  // test compare skill levels on the same stream.
  const delta = gap * rate * growthMult + gauss(rng) * 2.2;

  const bump = (v: number): number => clamp(v + delta + gauss(rng) * 1.2, 15, 99);

  if (p.type === 'hitter') {
    p.contact = bump(p.contact);
    p.power = bump(p.power);
    p.eye = bump(p.eye);
    p.speed = bump(p.speed);
    p.range = bump(p.range);
    p.hands = bump(p.hands);
    p.arm = bump(p.arm);
    p.armAccuracy = bump(p.armAccuracy);
    p.blocking = bump(p.blocking);
    p.bunt = bump(p.bunt);
    p.steal = bump(p.steal);
    if (isTwoWay(p)) {
      // Both halves of him grow off the one ceiling: the same winter that
      // adds bat adds arm, at the same pull, with its own noise per field.
      p.stuff = bump(p.stuff);
      p.movement = bump(p.movement);
      p.control = bump(p.control);
      p.stamina = bump(p.stamina);
      p.velocity = Math.round(clamp(p.velocity + delta * 0.08, 79, 103));
    }
  } else {
    p.stuff = bump(p.stuff);
    p.movement = bump(p.movement);
    p.control = bump(p.control);
    p.stamina = bump(p.stamina);
    // A pitcher's glove develops now, and did not before — every fielding
    // rating he had sat at its generated value for four years, which nobody
    // noticed because nothing in the engine ever read them. Comebackers reach
    // him now, so a senior who has been fielding his position since he was
    // eighteen should be better at it than he was as a freshman.
    p.range = bump(p.range);
    p.hands = bump(p.hands);
    p.arm = bump(p.arm);
    p.armAccuracy = bump(p.armAccuracy);
    // Velocity is mph, not a 0 to 100 rating, so it cannot take the same delta.
    // Roughly a mile an hour for every twelve points of development.
    p.velocity = Math.round(clamp(p.velocity + delta * 0.08, 79, 103));
  }

  /*
    A ceiling a player has already cleared is not a ceiling. Scouts revise a
    projection upward when someone outgrows it, and without this the number
    quietly turns into nonsense — a senior reading "overall 52, potential 46".

    Measured at his own position, not at the one he happened to be covering.
    `overallOf` carries the glove tax for a man standing somewhere he does not
    belong, so a ceiling raised while he was out of position was raised to a
    number smaller than the player — and the moment a card put him back where
    he belongs he stood above it. Found 2026-09-11, when every program in the
    country started fielding a fitted nine and men went home in numbers.
  */
  const after = overallOf(p);
  respectCeiling(p);

  return after - before;
}


/**
 * The winters a man has already had.
 *
 * A freshman gets none. Anyone else is walked through the same `develop`
 * every recruited man gets, one winter per class he has climbed, his class
 * advancing ahead of each — which is the order the offseason applies it in
 * (`develop` is "applied after the class year advances", and reads the new
 * class for its rate). His arc is stamped at his first winter exactly as a
 * recruit's would be, so a generated junior has already spent two years of
 * a boom or a bust, as a recruited junior has.
 *
 * Draws from the same stream, after the man's own — a generated senior costs
 * three winters more of it than a freshman does. Every calibration figure
 * taken before this moved, and the goldens were re-recorded for it (05 §83).
 */
export function ageIntoClass(p: Player, rng: Rng, cls: ClassYear): void {
  const winters = CLASS_ORDER[cls];
  const order = (Object.keys(CLASS_ORDER) as ClassYear[]).sort((x, y) => CLASS_ORDER[x] - CLASS_ORDER[y]);
  for (let i = 1; i <= winters; i++) {
    p.classYear = order[i]!;
    develop(p, rng);
  }
}
