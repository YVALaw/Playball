// players.ts
// Fictional player generation. Ratings are 0 to 100 with 50 as D1 average.
//
// Draw order is load bearing. Every rng() call here sits in a fixed sequence,
// and inserting or removing one shifts every downstream random number in the
// whole simulation. Do not reorder these without expecting the calibration
// fixtures to move.

import { gauss, normal } from './rng.js';
import { overallOf } from './ratings.js';
import { GENERATED_POTENTIAL_CAP } from './scouting.js';
import { FIRST, LAST } from '../data/names.js';
import { playerId } from './types.js';
import type {
  Bats, ClassYear, Hand, Hitter, PitcherRole, Pitcher, Position, Rng, Team,
} from './types.js';

const POSITIONS: readonly Position[] = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];
const CLASSES: readonly ClassYear[] = ['FR','SO','JR','SR'];

/**
 * How much room a player has left to grow. Freshmen carry the most and are the
 * whole reason to recruit rather than just keep upperclassmen — a raw 45 with a
 * 62 ceiling is worth more to a program than a finished 52.
 */
function projectPotential(rng: Rng, overall: number, cls: ClassYear): number {
  const headroom =
    cls === 'FR' ? normal(rng, 11, 4, 2, 20)
    : cls === 'SO' ? normal(rng, 7, 3, 1, 15)
    : cls === 'JR' ? normal(rng, 4, 2.5, 0, 10)
    : normal(rng, 2, 1.5, 0, 6);

  /**
   * The raw ones.
   *
   * Ordinary headroom is a band around the player's current ability, which means
   * a ceiling can never be far from what he already does — and that quietly made
   * hidden gems impossible. Measured across a full recruiting class: not one
   * player in 480 was worth meaningfully more than he looked. Every surprise
   * available was a bad one.
   *
   * A small share of freshmen are projectable instead: a live arm with no idea
   * where it is going, an athlete who has played two years of baseball. He looks
   * ordinary, and he is not. This is the only reason scouting a board is worth
   * doing rather than sorting it.
   */
  const raw = cls === 'FR' && rng() < 0.07 ? normal(rng, 20, 8, 6, 34) : 0;

  // Capped short of S+ rather than at 99. This is the single funnel every
  // generated player passes through — a recruiting class, a walk-on, the roster
  // a rival program starts the world with — which is why the gate belongs here
  // and nowhere else. A store player is built by computing his ceiling without
  // this clamp; see GENERATED_POTENTIAL_CAP for why the number is reserved
  // rather than the letter.
  return Math.min(GENERATED_POTENTIAL_CAP, Math.round(overall + headroom + raw));
}

/** One draw. The cast is safe: the array is non-empty and rng() is below 1. */
function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

// Handedness distribution roughly matching college baseball.
function drawBats(rng: Rng): Bats {
  const r = rng();
  if (r < 0.62) return 'R';
  if (r < 0.92) return 'L';
  return 'S';
}

function drawThrows(rng: Rng, bats: Bats): Hand {
  // Left handed hitters throw left far more often than the population rate.
  if (bats === 'L') return rng() < 0.62 ? 'L' : 'R';
  if (bats === 'S') return rng() < 0.30 ? 'L' : 'R';
  return rng() < 0.06 ? 'L' : 'R';
}

// Platoon skill: lefties have larger and more variable splits than righties.
// Small share of the distribution goes negative, producing real reverse splits.
function drawPlatoonSkill(rng: Rng, bats: Bats): number {
  if (bats === 'S') return Math.max(0, 0.015 + gauss(rng) * 0.01);
  const mean = bats === 'L' ? 0.090 : 0.045;
  const sd = bats === 'L' ? 0.050 : 0.030;
  return mean + gauss(rng) * sd;
}

// Keep names unique across the whole league so two Rourkes never share a field.
const usedNames = new Set<string>();
export function resetNames(): void { usedNames.clear(); }

function uniqueName(rng: Rng): string {
  for (let i = 0; i < 200; i++) {
    const n = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
    if (!usedNames.has(n)) { usedNames.add(n); return n; }
  }
  const n = `${pick(rng, FIRST)} ${pick(rng, LAST)} ${usedNames.size}`;
  usedNames.add(n);
  return n;
}

/**
 * The defensive spectrum, as offsets applied to a player's quality.
 *
 * Teams put their athletes up the middle and hide their bats in the corners,
 * and this is that decision expressed as data. It matters because `range` is
 * absolute — ground covered, not "good for a first baseman" — so without it a
 * randomly generated first baseman would cover as much ground as a shortstop
 * and the position a player occupies would carry no information at all.
 *
 * Catchers are the odd one: almost no range in the outfielder's sense, and the
 * best arm on the field, because their defensive job is throwing runners out.
 */
const SPECTRUM: Record<Position, { range: number; arm: number }> = {
  C:    { range: -6, arm: 10 },
  SS:   { range: 10, arm: 4 },
  '2B': { range: 7, arm: -3 },
  CF:   { range: 9, arm: 0 },
  '3B': { range: -1, arm: 5 },
  RF:   { range: 1, arm: 6 },
  LF:   { range: -2, arm: -5 },
  '1B': { range: -8, arm: -9 },
  DH:   { range: -10, arm: -8 },
  P:    { range: 0, arm: 0 },
};

// Both columns sum to zero across the nine lineup spots, and that is not
// cosmetic. The first draft summed to +13 on arm, which quietly handed every
// team in the league a better throwing outfield than it had the day before —
// runners stopped taking the extra base and scoring fell 10.6% below the D1
// target, breaking calibration. A spectrum redistributes talent across
// positions; it must not add any.
const SPECTRUM_CHECK = (['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as const)
  .reduce((a, k) => ({ range: a.range + SPECTRUM[k].range, arm: a.arm + SPECTRUM[k].arm }),
          { range: 0, arm: 0 });
if (SPECTRUM_CHECK.range !== 0 || SPECTRUM_CHECK.arm !== 0) {
  throw new Error(
    `defensive spectrum must be zero sum, got range ${SPECTRUM_CHECK.range} arm ${SPECTRUM_CHECK.arm}`,
  );
}

export interface HitterOpts {
  bats?: Bats;
  throws?: Hand;
  pos?: Position;
}

/**
 * Two of the new ratings are read out of the player rather than drawn free, and
 * both would be worse as an independent roll.
 *
 * A bunt skill uncorrelated with anything is the complaint it was added to fix,
 * wearing a number: the clean-up hitter simply rolls 80 sometimes and bunts like
 * a nine-hole slap hitter again. And a steal skill uncorrelated with speed
 * produces a catcher with elite instincts and nowhere to use them. So both are
 * centred on the profile the player already has, with enough noise left in that
 * the correlation is a tendency and not a formula — which is the whole point of
 * splitting them out.
 *
 * Both stay centred on 50 for a league-average player, so `mult` reads them as
 * neutral and neither moves the league's bunt or steal totals on its own.
 */
const RATING_LO = 15;
const RATING_HI = 95;
const derived = (base: number, noise: number, sd: number): number =>
  Math.max(RATING_LO, Math.min(RATING_HI, base + noise * sd));

export function makeHitter(rng: Rng, quality = 50, opts: HitterOpts = {}): Hitter {
  const bats = opts.bats ?? drawBats(rng);
  const throws = opts.throws ?? drawThrows(rng, bats);
  const name = uniqueName(rng);
  const pos = opts.pos ?? pick(rng, POSITIONS);
  const spec = SPECTRUM[pos];
  let buntNoise = 0;
  let stealNoise = 0;
  const p: Hitter = {
    type: 'hitter',
    potential: 0,
    id: playerId(name),
    name,
    pos,
    classYear: pick(rng, CLASSES),
    bats,
    throws,
    platoonSkill: drawPlatoonSkill(rng, bats),
    contact: normal(rng, quality, 12),
    power: normal(rng, quality, 14),
    eye: normal(rng, quality, 12),
    speed: normal(rng, quality, 15),
    range: normal(rng, quality + spec.range, 12),
    hands: normal(rng, quality, 12),
    arm: normal(rng, quality + spec.arm, 12),
    // Accuracy carries no spectrum offset on purpose. Range and arm have one
    // because a shortstop is *chosen* for them, and the zero-sum check above is
    // what stops the spectrum from handing the league free defence. Nobody is
    // moved to right field for having a straight throw, so there is nothing to
    // redistribute and no reason to risk unbalancing a column that must sum to
    // nothing.
    armAccuracy: normal(rng, quality, 12),
    // Same reasoning, one step further: only the catcher's blocking is ever
    // read, so a catcher bonus here would not distinguish catchers from anyone
    // else — it would simply raise the league's baseline behind the plate and
    // need re-centring, exactly as the catcher arm bonus already does in
    // game.ts. An average catcher should be average.
    blocking: normal(rng, quality, 12),
    // Placeholders. Both read out ratings still being drawn, so the noise is
    // taken here — in the draw order the rating occupies — and the value is
    // computed once the literal closes. Same trick velocity uses below.
    bunt: ((buntNoise = gauss(rng)), 0),
    steal: ((stealNoise = gauss(rng)), 0),
  };
  // Bunting belongs to the contact hitter who can run. Power is the one thing
  // that argues against it: nobody teaches a slugger to give the at-bat away,
  // and he has not practised it since high school.
  p.bunt = derived(
    50 + (p.contact - 50) * 0.30 + (p.speed - 50) * 0.25 - (p.power - 50) * 0.30,
    buntNoise, 11,
  );
  // Speed is worth something on the bases and nothing like everything. The
  // residual is the jump, and it is large on purpose — that residual is the
  // difference between a fast man and a base stealer.
  p.steal = derived(50 + (p.speed - 50) * 0.40, stealNoise, 14);
  p.potential = projectPotential(rng, overallOf(p), p.classYear);
  return p;
}

export interface PitcherOpts {
  throws?: Hand;
  role?: PitcherRole;
}

export function makePitcher(rng: Rng, quality = 50, opts: PitcherOpts = {}): Pitcher {
  const throws = opts.throws ?? (rng() < 0.28 ? 'L' : 'R');
  const role: PitcherRole = opts.role ?? 'SP';
  const sidearm = throws === 'R' && rng() < 0.08 && role === 'RP';
  const name = uniqueName(rng);
  let velocityNoise = 0;
  let accuracyNoise = 0;
  const p: Pitcher = {
    type: 'pitcher',
    potential: 0,
    id: playerId(name),
    name,
    pos: 'P',
    role,
    classYear: pick(rng, CLASSES),
    bats: throws,
    throws,
    sidearm,
    // Sidearm righties are brutal on righties and vulnerable to lefties.
    platoonSkill: sidearm ? 0.10 : Math.max(0, gauss(rng) * 0.02),
    stuff: normal(rng, quality + (role === 'RP' ? 4 : 0), 13),
    movement: normal(rng, quality, 12),
    control: normal(rng, quality + (role === 'SP' ? 3 : -2), 13),
    stamina: role === 'SP' ? normal(rng, 68, 12) : normal(rng, 32, 12),
    groundBall: normal(rng, 50, 15),
    holdRunners: normal(rng, quality, 14),
    // Placeholder. Velocity is derived from this pitcher's actual stuff below —
    // it cannot be computed inside the literal because stuff is still being built.
    // The draw happens HERE, in the position the old independent roll occupied,
    // so the random stream is byte for byte unchanged and no calibration figure
    // moves; only the number it produces is different.
    velocity: ((velocityNoise = gauss(rng)), 0),
    range: normal(rng, 48, 12),
    hands: normal(rng, 52, 11),
    arm: normal(rng, 55, 10),
    // Placeholder, for the same reason velocity is one: it reads out control.
    armAccuracy: ((accuracyNoise = gauss(rng)), 0),
  };
  // A pitcher's fielding sits below a position player's and always has — 48 on
  // range against a lineup drawn at its school's quality — because he is the
  // one man on the field picked for something else entirely. Accuracy follows
  // that: centred a little under average, and pulled toward control, because
  // whatever lets a man put a ball on the outside corner also lets him put one
  // in the first baseman's glove. The throw to first is the play pitchers
  // genuinely botch, and until now they could not: comebackers reached the
  // shortstop and the mound had no glove at all.
  p.armAccuracy = Math.max(15, Math.min(95, 46 + (p.control - 50) * 0.25 + accuracyNoise * 10));
  p.potential = projectPotential(rng, overallOf(p), p.classYear);

  // Velocity reads out stuff rather than standing apart from it. Nothing in the
  // engine consumes velocity — it is the number recruits get talked about with,
  // a scouting hook, not a lever — but an 80 mph arm with elite stuff reads as
  // broken to anyone who looks at the card, so it has to agree with itself.
  p.velocity = Math.round(
    Math.max(78, Math.min(103, 80 + p.stuff * 0.19 + velocityNoise * 2.2)),
  );
  return p;
}

const LINEUP_POSITIONS: readonly Position[] = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];

export function makeTeam(rng: Rng, name: string, quality = 50): Team {
  const lineup: Hitter[] = [];
  for (const pos of LINEUP_POSITIONS) {
    lineup.push(makeHitter(rng, quality + gauss(rng) * 4, { pos }));
  }
  const rotation = [0, 1, 2, 3].map(() => makePitcher(rng, quality + 3, { role: 'SP' }));
  const bullpen = [0, 1, 2, 3, 4, 5].map(() => makePitcher(rng, quality, { role: 'RP' }));
  const bench = [0, 1, 2, 3].map(() => makeHitter(rng, quality - 6));
  return { name, lineup, rotation, bullpen, bench, quality };
}

// Re-exported so callers that used to get it from here keep working.
export { makeRng } from './rng.js';
