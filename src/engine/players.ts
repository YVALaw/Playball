// players.ts
// Fictional player generation. Ratings are 0 to 100 with 50 as D1 average.
//
// Draw order is load bearing. Every rng() call here sits in a fixed sequence,
// and inserting or removing one shifts every downstream random number in the
// whole simulation. Do not reorder these without expecting the calibration
// fixtures to move.

import { innateBadges } from './badges.js';
import { gauss, normal } from './rng.js';
import { overallOf } from './ratings.js';
import { GENERATED_POTENTIAL_CAP, scoutNoise } from './scouting.js';
import { FIRST, LAST } from '../data/names.js';
import { CLASS_ORDER, playerId } from './types.js';
import type {
  Bats, ClassYear, Hand, Hitter, PitcherRole, Pitcher, PlayerId, Position, Rng, Team,
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

/**
 * How old a man is on the day he first walks into a college programme.
 *
 * Eighteen for four in five of them, and older for the rest: a gap year, a late
 * start, two seasons at a junior college. That tail is not decoration. Draft
 * eligibility arrives at three years completed *or* twenty one, so a freshman
 * who turned up at nineteen is in range after his sophomore season and one who
 * turned up at twenty is in range after his first — a year or two before the
 * rest of his class, and the only way the age clause ever fires.
 *
 * Hashed out of the player's id rather than drawn from the generator. Every
 * rng() call in this file sits in a fixed sequence, and spending one here would
 * move every downstream number in the whole simulation for the sake of a fact
 * that decides nothing on the field; `nextPlayerId` reads the stream's position
 * without turning it for exactly the same reason. The id comes off a bijection
 * on 32 bits, so it is as uniform as a draw would have been.
 */
const ARRIVAL_SALT = 5147;
export function arrivalAge(id: string): number {
  const u = scoutNoise(id, ARRIVAL_SALT);
  return u < 0.80 ? 18 : u < 0.95 ? 19 : 20;
}

/**
 * How old a man of a given class year is.
 *
 * Recomputed rather than stored anywhere else, so the two places that overwrite
 * a generated player's class year — a recruit forced to FR, a walk-on
 * manufactured as one — can put the age back in step with a single call instead
 * of leaving a senior's age on a freshman's card.
 */
export const ageFor = (id: string, cls: ClassYear): number =>
  arrivalAge(id) + CLASS_ORDER[cls];

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
//
// Cosmetic now rather than structural. While the id *was* the name this set was
// the only thing standing between two men and one merged career; since
// `nextPlayerId` it decides nothing more than whether a roster reads oddly. It
// is still module-level state that no save has ever carried, which is why a load
// puts it back — `rebuildNameIndex` in season.ts gathers the names, `resetNames`
// and `reserveNames` are how they get here.
//
// Cosmetic in what it decides, not in what it costs. `uniqueName` rejects a name
// already in here and draws again, so how many random numbers a player costs
// depends on who has been generated before him — which makes every generator in
// this file a function of this set as well as of its seed. Anybody measuring a
// generated population has to say what was in the pool, and in practice that
// means calling `resetNames` first: the same seeded class generated four times
// running in one process is four different classes.
const usedNames = new Set<string>();
export function resetNames(): void { usedNames.clear(); }

/**
 * Take these names as already spoken for.
 *
 * Additive on purpose: the caller decides whether this is a fresh world or a
 * second helping for one already standing, and only `resetNames` empties the
 * pool.
 */
export function reserveNames(names: Iterable<string>): void {
  for (const n of names) if (n) usedNames.add(n);
}

/**
 * Murmur3's finalizer. A bijection on 32 bits, and that property is load bearing
 * rather than a nicety: it is what carries the generator's promise of a distinct
 * state through to a promise of a distinct id.
 */
function mix32(x: number): number {
  let h = x >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * A man's identity, taken from where the generator is standing rather than from
 * what he is called.
 *
 * The id used to *be* the display name, which quietly made two men with one name
 * into one man: season statistics, the record book, awards and box scores are
 * all keyed by id, so the second Cole Rourke inherited the first one's career.
 * The only thing keeping names apart was the set above, and no save has ever
 * written it down — one cold reload emptied it and the next walk-on could be
 * generated on top of somebody.
 *
 * The stream's own position is the one number in reach that is already unique,
 * already restored exactly by a resumed save (`rngFromState` rebuilds the
 * generator from it), and already free of the clock and of Math.random. Reading
 * it costs no draw, which matters more than it sounds: every rng() call in this
 * file sits in a fixed sequence and taking one for a name tag would move every
 * calibration golden in the project.
 *
 * Two players collide only if the generator returns to the same state between
 * them, and xorshift32 walks all 2^32-1 non-zero states before it repeats —
 * four billion draws against the hundred million or so a long dynasty spends.
 *
 * The `p` prefix keeps the new ids out of the old ones' way. A save written
 * before this carries name-shaped ids and keeps them; a name has a space in it
 * and never starts lowercase, so the two spaces cannot meet.
 */
function nextPlayerId(rng: Rng): PlayerId {
  const at = rng.state?.();
  if (at === undefined) {
    // The same refusal `toPortable` makes, for the same reason: a generator with
    // no position cannot promise the one thing an id needs, which is to come out
    // the same way twice.
    throw new Error('this generator cannot make players: it has no state()');
  }
  return playerId(`p${mix32(at).toString(36).padStart(7, '0')}`);
}

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

/**
 * The badges he turns up with, hung on him once his ceiling is known.
 *
 * Last, because the cap is read off his potential and his potential is the last
 * thing computed about him. It costs no random draw — see `innateBadges` — so a
 * player generated before badges existed and one generated after come off the
 * same point in the same stream, and no calibration figure moved for this.
 *
 * The field is left off entirely when he has none, which is most men. Two
 * thousand empty arrays a season through every autosave is a cost paid to say
 * nothing.
 */
function signWithBadges(p: Hitter | Pitcher): void {
  const badges = innateBadges(p);
  if (badges.length > 0) p.badges = badges;
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
  // Taken before anything is drawn, so the id is the stream position this man
  // was made at. Reads the generator, does not turn it.
  const id = nextPlayerId(rng);
  const bats = opts.bats ?? drawBats(rng);
  const throws = opts.throws ?? drawThrows(rng, bats);
  const name = uniqueName(rng);
  const pos = opts.pos ?? pick(rng, POSITIONS);
  // Hoisted out of the literal, where it used to be drawn, so that the age
  // below can read it. The draw still happens at exactly this point in the
  // sequence — after the position and before the platoon split — so no
  // downstream number moves.
  const classYear = pick(rng, CLASSES);
  const spec = SPECTRUM[pos];
  let buntNoise = 0;
  let stealNoise = 0;
  const p: Hitter = {
    type: 'hitter',
    potential: 0,
    id,
    name,
    pos,
    classYear,
    age: ageFor(id, classYear),
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
  signWithBadges(p);
  return p;
}

export interface PitcherOpts {
  throws?: Hand;
  role?: PitcherRole;
}

export function makePitcher(rng: Rng, quality = 50, opts: PitcherOpts = {}): Pitcher {
  // As in makeHitter: read the stream's position first, spend none of it.
  const id = nextPlayerId(rng);
  const throws = opts.throws ?? (rng() < 0.28 ? 'L' : 'R');
  const role: PitcherRole = opts.role ?? 'SP';
  const sidearm = throws === 'R' && rng() < 0.08 && role === 'RP';
  const name = uniqueName(rng);
  // Hoisted for the same reason as in `makeHitter`, and drawn in the same place
  // in the sequence it always was.
  const classYear = pick(rng, CLASSES);
  let velocityNoise = 0;
  let accuracyNoise = 0;
  const p: Pitcher = {
    type: 'pitcher',
    potential: 0,
    id,
    name,
    pos: 'P',
    role,
    classYear,
    age: ageFor(id, classYear),
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
  signWithBadges(p);
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
