// ratings.ts
// Everything that turns a 0 to 100 rating into a real baseball rate lives here.
// Tune in this file only. Nothing else should hardcode a baseball number.

import type {
  BattedBall, EventVector, Hitter, HitterRatings, OffensiveEvent,
  PAEvent, Pitcher, PitcherRatings, Rng,
} from './types.js';

// League baseline, per plate appearance, calibrated to NCAA Division I.
// These seven must sum to exactly 1.
//
// Solved from sourced D1 rates rather than guessed: a .270 batting average and a
// .374 slugging percentage, with a 9.1% walk rate and 1.5% hit by pitch, fixes
// at-bats at 89.4% of plate appearances and total bases at .3346 per plate
// appearance. Splitting the hits at roughly 74% singles, 19% doubles, 2% triples
// and 5% home runs is the only mix that satisfies both.
//
// That implies about half a home run per team per game — a BBCOR profile. The
// previous 0.90 target came from a different era than the .374 slugging figure,
// and the two cannot both be true. If the modern, livelier college game is what
// you want, raise slugging first and re-solve this table; do not just add home
// runs, or batting average and slugging stop agreeing.
export const LEAGUE: EventVector = {
  single: 0.1782,
  double: 0.0459,
  triple: 0.0050,
  homerun: 0.0124,
  walk: 0.0910,
  hbp: 0.0150,
  out: 0.6525,
};

export const EVENTS: readonly PAEvent[] =
  ['single', 'double', 'triple', 'homerun', 'walk', 'hbp', 'out'];

// Share of plate appearances that end in a strikeout. Sits inside 'out'.
//
// SOURCED: D1 hitters strike out 16.4 percent of the time (Frey, D1 play by play).
//
// This was 0.180 and the harness targeted 8.5 per team per game, which over 41
// plate appearances is 20.7 percent. That 8.5 was MLB's number — the majors
// struck out 8.47 times per team per game in 2024, in three fewer plate
// appearances. Aiming at it was dragging the engine toward the professional
// strikeout environment the spec is most insistent about avoiding.
export const LEAGUE_K_RATE = 0.164;

// Batted ball type distribution on balls in play.
export const LEAGUE_BIP: Record<BattedBall, number> =
  { ground: 0.44, line: 0.21, fly: 0.27, popup: 0.08 };

// Pitch level baselines.
export const LEAGUE_PITCH = {
  firstPitchStrike: 0.584,   // D1 measured
  strike30: 0.583,           // D1 measured. MLB is 0.80. This gap is the college game
  foulShareOfSwings: 0.365,  // stays 33 to 40 percent at every count
  missShareOfSwings: 0.215,  // college whiffs a bit more than MLB
  zoneRate: 0.48,
  chaseRate: 0.28,
  zSwingRate: 0.66,
};

// Engine A builds a pitch sequence to land on an outcome it already knows. These
// govern the texture of that sequence: how often a strike is fouled off rather
// than swung through or taken. They do not affect season stats, which are fixed
// by the log5 model, but they are the whole feel of the play by play.
// Tune against LEAGUE_PITCH using `npx tsx tests/pitch-level-check.ts`.
export const SEQUENCE = {
  foulShareOfStrikes: 0.30,    // non terminal strikes that get fouled off
  calledShareOfStrikes: 0.78,  // of the rest, how many are taken rather than missed
  extraFoulChance: 0.30,       // continuation odds for extra fouls with two strikes
  extraFoulCap: 7,
  calledStrikeThree: 0.28,     // spec: over a quarter of strikeouts are looking
};

// Baserunning. What a runner does when he has a choice, and which outs still
// move him along. These govern how many baserunners turn into runs.
export const BASERUNNING = {
  // College values are MLB marked up for weaker outfield arms and reads, then
  // settled by calibration. No D1 baserunning splits are published, so MLB is
  // the only sourced anchor available.
  //
  //   first to third on a single: 28 percent, runner holds at second 70 percent
  //     (Retrosheet via The Hardball Times, 2012)
  //   XBT% — the share of chances where a runner takes more than one base on a
  //     single or more than two on a double — is a 40 to 41 percent league
  //     average (Baseball-Reference, 2011 and 2015). That is the composite of
  //     all three rates below and is the number to check them against. The MLB
  //     figures noted compute to 39 percent, which matches. The college values
  //     shipped here compute to about 50 percent, a 25 percent markup that was
  //     reached by calibration pressure rather than evidence.
  //
  // firstToThirdOnSingle is anchored to real data. The other two are inferred:
  // MLB splits for them are not published in any source found, so treat them as
  // the softest numbers in this file.
  scoreFromSecondOnSingle: 0.720,     // MLB ~0.59, inferred
  firstToThirdOnSingle: 0.355,        // MLB 0.28, sourced
  scoreFromFirstOnDouble: 0.630,      // MLB ~0.45, inferred
  sacFlyOnFly: 0.62,
  sacFlyOnLine: 0.18,
  scoreFromThirdOnGroundOut: 0.45,    // infield back, trade the out for the run
  secondToThirdOnGroundOut: 0.35,
  scoreFromThirdOnDoublePlay: 0.55,
  /**
   * A runner pushing for an extra base and not making it. Roughly four percent
   * of attempts in real baseball — small, but it is the entire reason an
   * aggressive baserunning policy is a choice rather than a free upgrade.
   */
  // Tuned down from 0.042, which retired 0.30 runners a game and cost the league
  // six percent of its scoring. Real clubs lose roughly 0.15 to 0.20 runners a
  // game taking an extra base; the risk has to be real enough that aggression
  // costs something without quietly deflating the whole run environment.
  thrownOutAdvancing: 0.026,
  doublePlayRate: 0.36,
  fieldersChoiceRate: 0.45,
};

// Context modifiers.
export const CONTEXT = {
  // Home field. Applied as a lift for the home side and the reciprocal penalty
  // for the visitor, so the edge does not inflate league scoring.
  //
  // Evidence: MLB has run near 54 percent historically but is falling — the
  // 2020s are at .534, the lowest of the Live Ball era, and 2024 was .522.
  // College is higher: a Samford study of every Power Five and SOCON conference
  // game from 2015 to 2019, restricted to conference play to strip out
  // non-conference scheduling bias, puts in-conference home winning percentage
  // at 55 to 60 percent. (The NCAA's RPI model assumes 70 percent, which holds
  // for basketball and is wrong for baseball.)
  //
  // We sit at the conservative end of that range. The sim measures the cleanest
  // possible case — identical rosters, alternating home and away — so it should
  // not claim the top of a range that still carries real-world noise.
  // 1.020 measures at 54.9 percent between evenly matched teams.
  homeFieldOffense: 1.020,
  // Divisor holding the modifiers below to an expected value of 1.0, so they
  // shift offense between situations without inflating the league total.
  //
  // Was 1.100, which was too high, and the reason it survived is worth keeping:
  // it had been tuned against a single base seed. Measured across eight
  // independent seeds, 1.100 held league scoring 8.0% under the D1 target and
  // dragged every component rate down with it — average, on base, slugging,
  // home runs and walks all sat low together, which is the signature of one
  // global suppressor rather than five separate problems.
  //
  // 1.070 puts runs within 2.1% and every component inside 3%. It is a divisor,
  // so it moves the whole offensive environment at once: raise it and the league
  // scores less, lower it and everything inflates together. Retune only with the
  // multi-seed sweep in tests/calibration.test.ts, never on one seed.
  normalizer: 1.070,
  runnersOnOffenseBoost: 1.035,  // pitching from the stretch
  timesThroughOrder: [1.0, 1.0, 1.035, 1.075, 1.11] as readonly number[],
  fatigueSlopePerPitch: 0.0022,  // effectiveness lost per pitch past stamina
};

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

// Global spread control. Every rating sensitivity is scaled by this.
// Turn it up and stars separate more, but the better team starts winning too
// often and baseball stops feeling like baseball. This is the single most
// important tuning knob in the whole engine.
//
// Measured: at a 13 point rating gap, which is the widest the shipped conference
// produces, the better team wins 78.5 percent. That is inside the 75 to 85
// target. Any change here must rerun `calibrate` and `parity` together.
export const SPREAD = 0.62;

// Core conversion. rating 50 is league average and returns 1.0.
// sensitivity controls how much spread the rating produces.
export function mult(rating: number, sensitivity: number): number {
  return Math.exp(((clamp(rating, 1, 99) - 50) / 50) * sensitivity * SPREAD);
}

/** Per event, which ratings push it and how hard. */
type SensTable<K extends string> =
  Partial<Record<OffensiveEvent, Partial<Record<K, number>>>>;

const BAT_SENS: SensTable<keyof HitterRatings> = {
  single: { contact: 0.38, speed: 0.14 },
  double: { power: 0.45, contact: 0.12 },
  triple: { speed: 1.20 },
  homerun: { power: 0.95 },
  walk: { eye: 0.90 },
  hbp: { eye: 0.10 },
};

const PIT_SENS: SensTable<keyof PitcherRatings> = {
  single: { movement: -0.28, stuff: -0.12 },
  double: { movement: -0.38 },
  triple: { movement: -0.20 },
  homerun: { movement: -0.95 },
  walk: { control: -0.90 },
  hbp: { control: -0.55 },
};

// `source` is typed to guarantee every attribute the table names is present, so
// the original's `?? 50` fallback is unreachable and has been dropped.
function buildVector<K extends string>(
  sensTable: SensTable<K>,
  source: Record<K, number>,
): EventVector {
  const v = {} as EventVector;
  let sum = 0;
  for (const ev of EVENTS) {
    if (ev === 'out') continue;
    let m = 1;
    const sens = sensTable[ev];
    if (sens) {
      for (const [attr, s] of Object.entries(sens) as Array<[K, number]>) {
        m *= mult(source[attr], s);
      }
    }
    v[ev] = LEAGUE[ev] * m;
    sum += v[ev];
  }
  // Out absorbs the remainder. Clamp so a monster hitter cannot go negative.
  v.out = Math.max(0.05, 1 - sum);
  const total = EVENTS.reduce((a, ev) => a + v[ev], 0);
  for (const ev of EVENTS) v[ev] /= total;
  return v;
}

export function batterVector(batter: Hitter): EventVector {
  return buildVector(BAT_SENS, batter);
}

export function pitcherVector(pitcher: Pitcher): EventVector {
  return buildVector(PIT_SENS, pitcher);
}

// Platoon. Returns the multiplier applied to a batter's offensive events.
// Opposite hand favors the batter, same hand favors the pitcher.
// platoonSkill is the player's full split size as a share of production.
export function platoonMultiplier(batter: Hitter, pitcher: Pitcher): number {
  const bats = batter.bats === 'S' ? (pitcher.throws === 'R' ? 'L' : 'R') : batter.bats;
  const sameHand = bats === pitcher.throws;
  const skill = batter.platoonSkill + pitcher.platoonSkill;
  // Overall production is a weighted average of both matchups, so split the
  // effect in half either side of the mean.
  return sameHand ? 1 - skill / 2 : 1 + skill / 2;
}

/**
 * Correction for the fact that `mult` is `exp`, and `exp` is convex.
 *
 * `strikeoutProbability` multiplies the league rate by two `mult` terms. Each is
 * exactly 1 for an average player, so the formula looks like it lands on
 * `LEAGUE_K_RATE` by construction — but averaged over a *population* with real
 * spread, E[exp(x)] > exp(E[x]), so both terms average above 1 and the realized
 * rate sits above the configured one. Measured across eight independent seeds
 * the league struck out 17.4% of the time against a sourced D1 figure of 16.4%.
 *
 * This is the correction that puts the realized rate back on the sourced one. It
 * is empirical rather than derived because the spread it corrects for depends on
 * the generator's rating distributions, which are themselves tuned.
 *
 * Re-measure with a multi-seed sweep if the generator's spreads ever change.
 */
const JENSEN_K = 0.965;

// Strikeout share of outs, resolved after the log5 model says 'out'.
export function strikeoutProbability(
  batter: Hitter,
  pitcher: Pitcher,
  fatigueMult = 1,
): number {
  const raw =
    LEAGUE_K_RATE * JENSEN_K *
    mult(batter.contact, -0.70) *
    mult(pitcher.stuff, 0.70) *
    (1 / fatigueMult);
  return clamp(raw, 0.02, 0.62);
}

export function battedBallType(
  batter: Hitter,
  pitcher: Pitcher,
  rng: Rng,
  groundBias = 1,
): BattedBall {
  const gb = LEAGUE_BIP.ground * mult(pitcher.groundBall, 0.55) * mult(batter.power, -0.18) * groundBias;
  const fly = LEAGUE_BIP.fly * mult(pitcher.groundBall, -0.45) * mult(batter.power, 0.22) / groundBias;
  const line = LEAGUE_BIP.line * mult(batter.contact, 0.18);
  const pop = LEAGUE_BIP.popup * mult(batter.contact, -0.25);
  const total = gb + fly + line + pop;
  const r = rng() * total;
  if (r < gb) return 'ground';
  if (r < gb + line) return 'line';
  if (r < gb + line + fly) return 'fly';
  return 'popup';
}

// Pitcher effectiveness decays past his stamina budget.
export function fatigueMultiplier(pitcher: Pitcher, pitchCount: number): number {
  const budget = 30 + pitcher.stamina * 0.85; // stamina 80 gives roughly 98 pitches
  if (pitchCount <= budget) return 1;
  return Math.max(0.55, 1 - (pitchCount - budget) * CONTEXT.fatigueSlopePerPitch);
}

export { clamp };

/**
 * One number for how good a player is right now. Derived rather than stored so
 * it cannot go stale when development moves the underlying ratings.
 *
 * The weights are judgment, not arithmetic: contact carries a hitter more than
 * arm strength does, and a pitcher lives on stuff, movement and control with
 * stamina as a distant fourth.
 */
export function overallOf(p: Hitter | Pitcher): number {
  return p.type === 'hitter'
    ? Math.round(p.contact * 0.30 + p.power * 0.24 + p.eye * 0.16
               + p.speed * 0.12 + p.range * 0.07 + p.hands * 0.05 + p.arm * 0.06)
    : Math.round(p.stuff * 0.34 + p.movement * 0.28 + p.control * 0.28 + p.stamina * 0.10);
}
