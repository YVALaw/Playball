// pitches.ts
// What a pitcher actually throws, and how often he throws it.
//
// Until this file every arm in the world threw the same anonymous pitch. Three
// ratings said how well — stuff, movement, control — and nothing said *what*, so
// a sinkerballer and a power four-seamer were the same man with different
// numbers. A repertoire is the cheapest identity in baseball: you can describe a
// pitcher in five words if you know his mix, and you cannot describe him at all
// without it.
//
// Two rules shaped the implementation.
//
// **Nobody draws from one identical set.** A repertoire is chosen per pitcher —
// how many pitches, which ones, and what share of his work each one takes. Two
// arms on the same staff should read differently on the card, and the rare
// offerings have to be genuinely rare: a knuckleballer is one pitcher in a
// hundred, not a checkbox everybody rolls for.
//
// **Nothing here spends a random draw.** Every rng() call in `players.ts` sits
// in a fixed sequence, and one extra draw per pitcher would move every
// calibration figure in the project for the sake of a fact that could be hashed
// instead. So a repertoire is a pure function of the player's id, exactly like
// `arrivalAge` — stable across a reload, free to recompute, and costing the
// generator nothing. It is never stored, and no save has to carry it.

import { scoutNoise } from './scouting.js';
import type {Arm, Pitcher } from './types.js';

/**
 * The eleven pitches the game knows about.
 *
 * Real abbreviations, because they are what a box score and a scouting report
 * use. `SC` is the screwball and `SV` the slurve; the splitter is `FS` rather
 * than `SP`, which is a pitcher's role everywhere else in this codebase and
 * would read as one here.
 */
export type PitchId =
  | 'FF' | 'SI' | 'FC'            // fastballs
  | 'SL' | 'CU' | 'SV' | 'SC'     // breaking
  | 'CH' | 'FS' | 'VU' | 'KN';    // offspeed, and the one that is its own family

export type PitchFamily = 'fastball' | 'breaking' | 'offspeed';

export interface PitchSpec {
  id: PitchId;
  /** What a broadcaster calls it. */
  name: string;
  family: PitchFamily;
  /** Typical velocity as a fraction of the man's own fastball. Display only. */
  velocity: number;
  /**
   * Share of pitchers who carry it at all, before any archetype leans on the
   * number. This is what keeps a vulcan change a curiosity and a slider the most
   * common secondary in baseball.
   */
  rarity: number;
}

/**
 * The palette, in the order a card lists it: what he throws hardest first.
 *
 * The knuckleball sits apart from the rest of the offspeed family in every way
 * that matters — a man who throws one throws it three times in four and builds
 * the rest of his outing around it — so it is handled by its own branch below
 * rather than by turning its `rarity` down far enough to be safe.
 */
export const PITCHES: Record<PitchId, PitchSpec> = {
  FF: { id: 'FF', name: 'Four-seam', family: 'fastball', velocity: 1.00, rarity: 0.86 },
  SI: { id: 'SI', name: 'Sinker', family: 'fastball', velocity: 0.98, rarity: 0.44 },
  FC: { id: 'FC', name: 'Cutter', family: 'fastball', velocity: 0.95, rarity: 0.26 },
  SL: { id: 'SL', name: 'Slider', family: 'breaking', velocity: 0.88, rarity: 0.58 },
  CU: { id: 'CU', name: 'Curveball', family: 'breaking', velocity: 0.80, rarity: 0.47 },
  SV: { id: 'SV', name: 'Slurve', family: 'breaking', velocity: 0.84, rarity: 0.14 },
  SC: { id: 'SC', name: 'Screwball', family: 'breaking', velocity: 0.83, rarity: 0.035 },
  CH: { id: 'CH', name: 'Changeup', family: 'offspeed', velocity: 0.89, rarity: 0.55 },
  FS: { id: 'FS', name: 'Splitter', family: 'offspeed', velocity: 0.91, rarity: 0.19 },
  VU: { id: 'VU', name: 'Vulcan change', family: 'offspeed', velocity: 0.87, rarity: 0.075 },
  KN: { id: 'KN', name: 'Knuckleball', family: 'offspeed', velocity: 0.68, rarity: 0.012 },
};

/** One pitch in one man's repertoire. */
export interface Offering {
  id: PitchId;
  /** Share of his pitches, 0 to 1. The shares in a repertoire sum to 1. */
  usage: number;
}

/** Best pitch first, which is also most-thrown first. */
export type Repertoire = readonly Offering[];

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Salts, in a band of their own.
 *
 * `scoutNoise` is a hash of the id and the salt, so two facts drawn on the same
 * salt are the same number. The recruiting board, the draft and the arrival age
 * all own bands below this one; anything added here must take an unused value or
 * it will silently agree with something it has nothing to do with.
 */
const SALT = {
  knuckler: 7001,
  count: 7013,
  sinker: 7019,
  cutter: 7027,
  breakA: 7039,
  breakB: 7043,
  offA: 7057,
  offB: 7069,
  lean: 7079,
  share: 7103,   // + index * 7, one per offering
} as const;

/** Deterministic pick from a weighted table. Consumes no randomness. */
function choose<T>(u: number, table: ReadonlyArray<readonly [T, number]>): T {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = u * total;
  for (const [value, w] of table) {
    r -= w;
    if (r < 0) return value;
  }
  return (table[table.length - 1] as readonly [T, number])[0];
}

/**
 * How many pitches he carries.
 *
 * A starter needs a third and fourth offering to get through a lineup twice; a
 * reliever can live on two and many of the best ones do. That difference is
 * most of why a starter and a reliever read differently even when their ratings
 * are similar.
 */
function repertoireSize(id: string, isStarter: boolean): number {
  const u = scoutNoise(id, SALT.count);
  return isStarter
    ? (u < 0.16 ? 3 : u < 0.68 ? 4 : 5)
    : (u < 0.22 ? 2 : u < 0.80 ? 3 : 4);
}

/**
 * The mix a pitcher leans on, before any pitch is chosen.
 *
 * Not a label applied afterwards: the lean is what decides how much fastball
 * ends up in the repertoire, and the POWER ARM / JUNKBALLER tendency is then
 * read back **off the finished usage shares** rather than off this. That
 * ordering matters — it is what makes the usage share real data that something
 * consumes, instead of a caption under a number nobody uses.
 */
type Lean = 'power' | 'even' | 'junk';

function leanOf(id: string): Lean {
  const u = scoutNoise(id, SALT.lean);
  return u < 0.30 ? 'power' : u < 0.70 ? 'even' : 'junk';
}

/** Target share of fastballs, by lean. Perturbed per pitcher below. */
const FASTBALL_TARGET: Record<Lean, number> = { power: 0.68, even: 0.55, junk: 0.42 };

/**
 * A knuckleballer, and why he gets his own function.
 *
 * The pitch is not a fourth offering, it is the whole outing: a man who throws
 * one throws it three times in four and keeps a fastball around to remind
 * hitters it exists. Generated through the ordinary path he would come out with
 * a 12% knuckleball and a slider, which is not a knuckleballer, it is a
 * mistake. One pitcher in eighty or so, which across ninety six programs is
 * about twenty men in the world and perhaps two worth watching.
 */
function knuckleballer(id: string): Offering[] {
  const heavy = 0.70 + scoutNoise(id, SALT.share) * 0.14;
  const fast = (1 - heavy) * (0.62 + scoutNoise(id, SALT.share + 7) * 0.25);
  return normalize([
    { id: 'KN', usage: heavy },
    { id: 'FF', usage: fast },
    { id: 'CU', usage: 1 - heavy - fast },
  ]);
}

/** Shares to exactly one, smallest offering never rounded out of existence. */
function normalize(list: Offering[]): Offering[] {
  const kept = list.filter((o) => o.usage > 0.02);
  const total = kept.reduce((a, o) => a + o.usage, 0);
  return kept
    .map((o) => ({ id: o.id, usage: o.usage / total }))
    .sort((a, b) => b.usage - a.usage);
}

/**
 * No secondary pitch is the pitch he throws most.
 *
 * A junkballer with two offerings came out of the weighting above throwing 59%
 * changeups, which is not a junkballer — it is a man with one pitch, and the
 * palette exists so that the rare profile is a knuckleballer rather than an
 * accident of arithmetic. Real slider-first relievers do exist and are the
 * reason the ceiling is 42% rather than "under the fastball": the shave is
 * enough to stop the absurd case without flattening the interesting one.
 */
const SECONDARY_CEILING = 0.42;

function capSecondary(list: Offering[]): Offering[] {
  let worst = -1;
  for (let i = 0; i < list.length; i++) {
    const o = list[i] as Offering;
    if (PITCHES[o.id].family === 'fastball') continue;
    if (worst < 0 || o.usage > (list[worst] as Offering).usage) worst = i;
  }
  if (worst < 0) return list;
  const over = (list[worst] as Offering).usage - SECONDARY_CEILING;
  if (over <= 0) return list;
  // Back onto his fastball, which is where the pitches he is not throwing go.
  const heater = list.findIndex((o) => PITCHES[o.id].family === 'fastball');
  if (heater < 0) return list;
  return list.map((o, i) =>
    i === worst ? { id: o.id, usage: SECONDARY_CEILING }
    : i === heater ? { id: o.id, usage: o.usage + over }
    : o);
}

function build(p: Arm): Offering[] {
  const id = p.id;
  if (scoutNoise(id, SALT.knuckler) < 0.012) return knuckleballer(id);

  const lean = leanOf(id);
  const size = repertoireSize(id, p.role === 'SP');
  const chosen: PitchId[] = [];

  // The fastball he actually throws. A junkballer is likelier to live off a
  // sinker — the pitch that gets outs without needing velocity — and a power arm
  // off a four-seamer, which is the same decision real pitching coaches make.
  const sinkerOdds = lean === 'junk' ? 0.52 : lean === 'even' ? 0.34 : 0.20;
  chosen.push(scoutNoise(id, SALT.sinker) < sinkerOdds ? 'SI' : 'FF');

  // A second fastball, which is nearly always a cutter and occasionally the
  // other end of the two-seam / four-seam pair.
  if (size >= 4 && scoutNoise(id, SALT.cutter) < 0.34) {
    chosen.push(chosen[0] === 'FF' && scoutNoise(id, SALT.cutter + 3) < 0.30 ? 'SI' : 'FC');
  }

  // Breaking ball. Everybody who is not a knuckleballer has one; the slider and
  // the curve are the two ordinary answers and the slurve and screwball are the
  // reasons a scouting report is worth reading.
  const breakers: ReadonlyArray<readonly [PitchId, number]> =
    [['SL', 0.46], ['CU', 0.38], ['SV', 0.12], ['SC', 0.04]];
  chosen.push(choose(scoutNoise(id, SALT.breakA), breakers));
  if (chosen.length < size && scoutNoise(id, SALT.breakB) < (lean === 'junk' ? 0.55 : 0.34)) {
    const second = choose(scoutNoise(id, SALT.breakB + 11),
      breakers.filter(([b]) => !chosen.includes(b)));
    if (!chosen.includes(second)) chosen.push(second);
  }

  // Something slow, and there is only ever one *kind* of it.
  //
  // A pitcher has a change of pace and it has a flavour: most men throw an
  // ordinary changeup, a handful split the fingers, and a genuine few throw the
  // vulcan — held between the middle and ring fingers, which is the pitch the
  // palette was widened to include. Offering all three off one weighted table
  // and refilling from what was left put a vulcan on one arm in five, which is
  // exactly the "everybody draws from the same set" failure this file exists to
  // avoid.
  if (chosen.length < size) {
    chosen.push(choose(scoutNoise(id, SALT.offA),
      [['CH', 0.84], ['FS', 0.10], ['VU', 0.06]] as const));
  }
  // A second slow pitch is rare and is nearly always the splitter beside a
  // change, which is a real profile rather than a fourth flavour.
  if (chosen.length < size && scoutNoise(id, SALT.offB) < 0.18) {
    const extra: PitchId = chosen.includes('FS') ? 'CH' : 'FS';
    if (!chosen.includes(extra)) chosen.push(extra);
  }

  // Usage. The fastball group takes the lean's target share and the rest split
  // what is left, weighted by how ordinary each pitch is and perturbed per
  // pitcher so no two repertoires read the same.
  const target = Math.max(0.34, Math.min(0.86,
    FASTBALL_TARGET[lean] + (scoutNoise(id, SALT.lean + 5) - 0.5) * 0.16));

  const fast = chosen.filter((c) => PITCHES[c].family === 'fastball');
  const rest = chosen.filter((c) => PITCHES[c].family !== 'fastball');

  const out: Offering[] = [];
  let fastWeight = 0;
  const fastRaw = fast.map((c, i) => {
    // The first fastball listed is his fastball; a second one is a show-me
    // pitch, never a co-equal.
    const w = (i === 0 ? 1 : 0.34) * (0.85 + scoutNoise(id, SALT.share + i * 7) * 0.3);
    fastWeight += w;
    return w;
  });
  fast.forEach((c, i) => out.push({ id: c, usage: target * ((fastRaw[i] as number) / fastWeight) }));

  let restWeight = 0;
  const restRaw = rest.map((c, i) => {
    const w = PITCHES[c].rarity * (0.7 + scoutNoise(id, SALT.share + (i + 4) * 7) * 0.6);
    restWeight += w;
    return w;
  });
  rest.forEach((c, i) =>
    out.push({ id: c, usage: (1 - target) * ((restRaw[i] as number) / restWeight) }));

  return normalize(capSecondary(out));
}

/**
 * Cached because it is read on the player card, in the scouting report and once
 * per pitcher by the tendency layer, and it is a pure function of an id that
 * never changes. Bounded by the number of distinct pitchers a dynasty ever
 * makes, which is a few thousand a decade.
 */
const CACHE = new Map<string, Repertoire>();

export function repertoireOf(p: Arm): Repertoire {
  const hit = CACHE.get(p.id);
  if (hit) return hit;
  const built = build(p);
  CACHE.set(p.id, built);
  return built;
}

/** Clears the memo. Only a test that manufactures colliding ids needs this. */
export function resetRepertoires(): void { CACHE.clear(); }

/** Share of his pitches that are fastballs. This is the number B11 reads. */
export function fastballShare(rep: Repertoire): number {
  let n = 0;
  for (const o of rep) if (PITCHES[o.id].family === 'fastball') n += o.usage;
  return n;
}

/**
 * What his slowest and fastest offerings read on a radar gun.
 *
 * Derived off `velocity`, which the generator already ties to `stuff`, so the
 * change of speed a card shows agrees with the fastball number beside it.
 */
export function speedOf(p: Arm, id: PitchId): number {
  return Math.round(p.velocity * PITCHES[id].velocity);
}
