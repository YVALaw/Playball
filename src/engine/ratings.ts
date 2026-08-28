// ratings.ts
// Everything that turns a 0 to 100 rating into a real baseball rate lives here.
// Tune in this file only. Nothing else should hardcode a baseball number.

import type {
  BattedBall, EventVector, FieldingRatings, Hitter, HitterRatings, OffensiveEvent,
  PAEvent, Pitcher, PitcherRatings, Position, Rng,
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
  /*
    Confidence, which is the other half of what a pitcher is carrying.

    Fatigue is a budget that only ever spends: past his stamina an arm gets
    worse and no conversation changes that. Confidence is a *state* -- it moves
    both ways within an outing, on what has just happened to him rather than on
    how much he has thrown -- and it is the thing a mound visit exists to
    steady.

    Deliberately a fraction of fatigue's authority. At the floor it costs about
    six percent of effectiveness, where a spent arm costs forty-five. A man who
    has lost the plate should be worse, not a different pitcher, and the
    calibration sweep is what says whether this number is honest: it moves the
    whole league at once, since all ninety-six programs pitch through it.
  */
  confidenceSwing: 0.06,
};

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

// Global spread control. Every rating sensitivity is scaled by this.
// Turn it up and stars separate more, but the better team starts winning too
// often and baseball stops feeling like baseball. This is the single most
// important tuning knob in the whole engine.
//
// Measured: at a 13 point rating gap, which is the widest the shipped conference
// produces, the better team wins 75.6 percent. That is inside the 75 to 85
// target. Any change here must rerun `calibrate` and `parity` together.
//
// It stayed at 0.62 through the August 2026 spread work, which widened the
// per-event sensitivities below by up to a factor of two. That is the whole
// reason the work was done event by event rather than here: this knob moves
// every rating at once, including the ones — singles, balls in play — whose
// spread was already correct, and it is those that decide games. The two things
// this constant is watched for did not move. The better seed still wins about
// 62 percent of bracket games, and the best record in a simulated season is
// still 41-4.
export const SPREAD = 0.62;

// Core conversion. rating 50 is league average and returns 1.0.
// sensitivity controls how much spread the rating produces.
export function mult(rating: number, sensitivity: number): number {
  return Math.exp(((clamp(rating, 1, 99) - 50) / 50) * sensitivity * SPREAD);
}

/** Per event, which ratings push it and how hard. */
type SensTable<K extends string> =
  Partial<Record<OffensiveEvent, Partial<Record<K, number>>>>;

/**
 * How far the best player in the country should sit above the league in each
 * event, and why these numbers and not the ones that were here before.
 *
 * These were all roughly half as wide until the spread was measured against real
 * baseball. The league rates were right and the ratings spread was right — 0 to
 * 100 with a median in the low forties and a p99 in the high eighties — but the
 * *curve* between them was flat enough that the best power hitter the generator
 * can make earned 1.7x the league home run rate. Real home run leaders run about
 * 3x. A rating of 95 has to buy something a rating of 50 cannot.
 *
 * Measured as the top player's per-plate-appearance rate over the league mean,
 * against an average opponent. `batterVector` against a league-average arm is
 * exactly the hitter's own rate vector — log5 with p = LEAGUE collapses to the
 * batter's vector — so this is an exact analytic quantity, not a sim estimate.
 *
 *   event      was    now    real   reasoning
 *   single    1.34   1.34   ~1.3    already right; left alone
 *   double    1.39   1.70   ~1.6    MLB doubles leader ~7.1% of PA on a 4.4%
 *                                   league; college doubles a touch livelier
 *   triple    1.95   3.00   ~3.8    the most skewed event in baseball, because
 *                                   it needs the speed and the gap and the park
 *                                   together. Deliberately short of the MLB
 *                                   figure: `speed` tops out at 90, not 95, and
 *                                   a triple is worth more here than there
 *   homerun   1.79   3.00    3.0    the finding this whole pass came from
 *   walk      1.77   2.00    2.1    a 19% walk rate on a 9% league
 *   hbp       1.07   1.07     —     not widened. Real hit-by-pitch leaders are
 *                                   miles above average, but that is a man who
 *                                   crowds the plate and there is no rating for
 *                                   it; `eye` is the wrong one to pay for it
 *
 * Batting average is the check that keeps the rest honest. It is not tuned
 * directly — it falls out of the four hit events — and it lands at 1.56x the
 * league, against about 1.5x in the real game (a .400 hitter on a .270 league).
 * That is why `single` is untouched: singles are most of a batting average, and
 * widening them would have pushed average past its own target while doing
 * nothing for the slugger the exercise was about.
 */
const BAT_SENS: SensTable<keyof HitterRatings> = {
  single: { contact: 0.38, speed: 0.14 },
  double: { power: 0.73, contact: 0.19 },
  triple: { speed: 2.06 },
  homerun: { power: 1.87 },
  walk: { eye: 1.10 },
  hbp: { eye: 0.10 },
};

/**
 * The same pass from the mound, because a dominant pitcher was exactly as
 * compressed as a great hitter and for the same reason.
 *
 * Measured the other way round: the best arm's allowed rate as a fraction of the
 * league mean, against an average bat.
 *
 *   event      was    now    real   reasoning
 *   single    0.79   0.79   ~0.76   batting average allowed barely spreads in
 *   double    0.79   0.79     —     real baseball either. Balls in play are the
 *   triple    0.88   0.88     —     one thing pitchers genuinely share
 *   homerun   0.54   0.42    0.42   best HR/9 in a rotation is well under half
 *                                   the league; worst is well over
 *   walk      0.56   0.45    0.41   a 3.5% walk rate on an 8.5% league
 *   hbp       0.70   0.70     —     left, same reason as the batter's
 *
 * The symmetry with the batter's table is not decoration. Contact quality is
 * compressed on both sides and the outcome events — the ball over the fence, the
 * fourth ball, the third strike — are the ones with real spread in them.
 */
const PIT_SENS: SensTable<keyof PitcherRatings> = {
  single: { movement: -0.28, stuff: -0.12 },
  double: { movement: -0.38 },
  triple: { movement: -0.20 },
  homerun: { movement: -1.33 },
  walk: { control: -1.21 },
  hbp: { control: -0.55 },
};

/**
 * What pays for the widening above, and the reason this had to be a two-part
 * change rather than a bigger number.
 *
 * `mult` is `exp`, and `exp` is convex, so widening a sensitivity raises the
 * *population mean* of an event even though the curve still returns exactly 1.0
 * at a rating of 50. Two more things push the same way. The generator centres
 * hitters near 44, not 50, so the average man already sits on the low side of a
 * pivot that assumes he is on it, and stretching the curve stretches that gap
 * too. And log5 renormalises: a slugger's home run share is divided by a
 * denominator his own home runs inflate, so a widened event is quietly clipped
 * on the way out. Left alone, the pass above would have moved the league's home
 * run rate and its walk rate while claiming to be about individuals.
 *
 * So each widened event carries the constant that puts the league's realized
 * rate back exactly where it was. Same idea as `JENSEN_K` below, applied per
 * event instead of once globally, and empirical for the same reason — only more
 * so. The analytic correction, computed straight off the generated population,
 * still left home runs and triples nearly three percent light and walks one and
 * a half, because it can price the convexity but not the renormalisation. These
 * are measured off the harness instead: run the four-seed sweep, read the
 * per-plate-appearance rate of every event before and after, and multiply the
 * constant by the ratio. Two rounds converge to inside the sampling noise.
 *
 * Fitted against the calibration harness's quality-50 league rather than the
 * world's quality-42 one, and the choice matters — the two populations disagree
 * by three to five percent on how much correction they want, because the world
 * carries the between-programs quality spread on top of the within-roster one.
 * The harness is what `CONTEXT.normalizer` and `JENSEN_K` were both fitted
 * against, and it is what `npm run calibrate` reports, so it is the population
 * the league is defined by. The residual on the world is measured and small:
 * runs 1.0% up, walks and strikeouts 2.5% up, slugging unmoved.
 *
 * They restore the rate the engine *had*, not the rate `LEAGUE` names — whatever
 * gap sits between those two is already priced into `CONTEXT.normalizer`, and
 * closing it here would move the league behind calibration's back.
 *
 * Re-measure alongside `JENSEN_K` if the generator's spreads ever change. An
 * event with no entry is not widened and needs no correction.
 */
type NormTable = Partial<Record<OffensiveEvent, number>>;

const BAT_NORM: NormTable = {
  double: 0.9978, triple: 0.9903, homerun: 0.9657, walk: 1.0003,
};

// Barely off one, where the batter's home run correction is three percent, and
// the asymmetry is the sign doing its work: a pitcher's sensitivities are
// negative, so widening pushes his mean the other way and most of the batter's
// correction has nothing to answer here. Walks and home runs are the only two
// events where both sides widened, so those corrections were split evenly —
// each side carries the square root of what the event needed.
const PIT_NORM: NormTable = {
  homerun: 1.0022, walk: 1.0034,
};

// `source` is typed to guarantee every attribute the table names is present, so
// the original's `?? 50` fallback is unreachable and has been dropped.
function buildVector<K extends string>(
  sensTable: SensTable<K>,
  normTable: NormTable,
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
    v[ev] = LEAGUE[ev] * m * (normTable[ev] ?? 1);
    sum += v[ev];
  }
  // Out absorbs the remainder. Clamp so a monster hitter cannot go negative.
  v.out = Math.max(0.05, 1 - sum);
  const total = EVENTS.reduce((a, ev) => a + v[ev], 0);
  for (const ev of EVENTS) v[ev] /= total;
  return v;
}

export function batterVector(batter: Hitter): EventVector {
  return buildVector(BAT_SENS, BAT_NORM, batter);
}

export function pitcherVector(pitcher: Pitcher): EventVector {
  return buildVector(PIT_SENS, PIT_NORM, pitcher);
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
 * The split, in the shape a card can print.
 *
 * `platoonSkill` has been on every player since the engine was ported and has
 * never once been shown, on the grounds that it is hidden information. It is
 * not: contact and power against each hand is the first thing every other
 * baseball game puts on a player card, and a coach setting a lineup against a
 * left hander is entitled to know which of his men can hit one.
 *
 * The arithmetic is `platoonMultiplier`'s, read against an average opponent, so
 * what the card prints and what the simulation does cannot drift: the full split
 * is spent half either way, so the opposite hand is worth `+skill/2` and the
 * same hand `−skill/2`. A switch hitter turns around and therefore has the good
 * side of it against everybody, which is why both his columns read the same.
 *
 * **Contact and power move by different amounts from one split, and that is the
 * model rather than a rounding artefact.** The multiplier lands on production,
 * and the same change in production is a large move on the contact curve and a
 * small one on the power curve, because `contact` buys singles at a sensitivity
 * of 0.38 and `power` buys home runs at 1.87. Printing one delta against both
 * would be inventing a symmetry the engine does not have.
 */
export interface PlatoonSplit {
  /** Multiplier on his production against a right hander, and against a left. */
  vsRHP: number;
  vsLHP: number;
  /** Effective ratings, for a hitter. Undefined on the mound. */
  contact?: { vsRHP: number; vsLHP: number };
  power?: { vsRHP: number; vsLHP: number };
}

/** A production multiplier, expressed as the rating that would have produced it. */
export function ratingForMultiplier(base: number, m: number, sensitivity: number): number {
  return Math.round(clamp(base + (Math.log(m) * 50) / (sensitivity * SPREAD), 1, 99));
}

/** The two sensitivities the split is read through. See `BAT_SENS`. */
const SPLIT_SENS = { contact: 0.38, power: 1.87 } as const;

export function platoonSplit(p: Hitter | Pitcher): PlatoonSplit {
  const half = p.platoonSkill / 2;
  // A switch hitter always bats the other way round, so he never takes the
  // same-hand penalty from either side.
  const switching = p.type === 'hitter' && p.bats === 'S';
  const hand = p.type === 'hitter' ? p.bats : p.throws;
  const vsRHP = switching ? 1 + half : hand === 'R' ? 1 - half : 1 + half;
  const vsLHP = switching ? 1 + half : hand === 'R' ? 1 + half : 1 - half;
  if (p.type !== 'hitter') return { vsRHP, vsLHP };
  return {
    vsRHP, vsLHP,
    contact: {
      vsRHP: ratingForMultiplier(p.contact, vsRHP, SPLIT_SENS.contact),
      vsLHP: ratingForMultiplier(p.contact, vsLHP, SPLIT_SENS.contact),
    },
    power: {
      vsRHP: ratingForMultiplier(p.power, vsRHP, SPLIT_SENS.power),
      vsLHP: ratingForMultiplier(p.power, vsLHP, SPLIT_SENS.power),
    },
  };
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
 *
 * It moved from 0.965 to 0.959 when the two sensitivities below were widened,
 * which is this constant doing exactly the job it was written for. Fitted the
 * same way as the norm tables above and against the same harness: strikeouts per
 * plate appearance, before and after, four seeds.
 */
const JENSEN_K = 0.9593;

/**
 * Strikeout share of outs, resolved after the log5 model says 'out'.
 *
 * Both sensitivities were 0.70, which made the best arm in the country a 1.5x
 * strikeout pitcher and the best contact bat a 0.63x one. Real figures are about
 * 1.7x for the arm and nearer 0.4x for the bat, so both were widened: the arm now
 * measures 1.70x and the bat 0.51x, against an average opponent.
 *
 * This is the cheapest widening in the file and the most visible, because a
 * strikeout is settled *after* the event is already an out. It changes what an
 * out looks like, not whether one happened, so a strikeout leaderboard can
 * separate properly without touching the run environment at all — the only
 * scoring it reaches is the sacrifice fly and the runner moving on a ground ball,
 * which a strikeout denies.
 */
export function strikeoutProbability(
  batter: Hitter,
  pitcher: Pitcher,
  fatigueMult = 1,
): number {
  const raw =
    LEAGUE_K_RATE * JENSEN_K *
    mult(batter.contact, -1.00) *
    mult(pitcher.stuff, 0.92) *
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

/**
 * Pitcher effectiveness decays past his stamina budget.
 *
 * `slope` scales how fast, and exists for RUBBER ARM: a badge on the one channel
 * that decides how much of a start is worth watching. One for everybody who does
 * not have it, which is nearly everybody. Passed in rather than read off the
 * player here, because a badge lookup in this file would make `ratings.ts`
 * import `badges.ts`, which imports `scouting.ts`, which imports this.
 */
/**
 * How many pitches this arm has before he starts losing anything.
 *
 * Pulled out of `fatigueMultiplier` so the screen can draw a stamina bar
 * against the same number the simulation fades him on. It was inline, which
 * meant the only way to show a pitcher's endurance was to write the formula
 * down a second time in the UI — and a duplicated constant is a constant that
 * eventually disagrees with itself.
 */
export function pitchBudget(pitcher: Pitcher): number {
  return 30 + pitcher.stamina * 0.85;      // stamina 80 gives roughly 98 pitches
}

export function fatigueMultiplier(
  pitcher: Pitcher, pitchCount: number, slope = 1,
): number {
  const budget = pitchBudget(pitcher);
  if (pitchCount <= budget) return 1;
  return Math.max(0.55, 1 - (pitchCount - budget) * CONTEXT.fatigueSlopePerPitch * slope);
}

/**
 * Where confidence starts, and the bounds it lives between.
 *
 * Zero to one, half is level. A starter takes the mound at level; a reliever
 * comes in slightly above it, which is the closest thing this model has to
 * saying that a man warmed up for one inning is a man with a job he
 * understands.
 */
export const CONFIDENCE = {
  start: 0.5,
  relief: 0.58,
  floor: 0,
  ceiling: 1,
  /** What a mound visit puts back. Never a full reset -- talk is not rest. */
  visit: 0.22,
} as const;

/**
 * What just happened, as a nudge to confidence.
 *
 * Every number here is small on purpose: one home run does not break a pitcher,
 * and a single strikeout does not fix one. It is the accumulation across an
 * inning that shows, which is why a visit is worth spending after a bad one
 * rather than after a bad pitch.
 */
export function confidenceShift(event: {
  homeRun?: boolean; walk?: boolean; strikeout?: boolean;
  hit?: boolean; out?: boolean; runsAllowed?: number;
}): number {
  let d = 0;
  if (event.homeRun) d -= 0.10;
  else if (event.hit) d -= 0.03;
  if (event.walk) d -= 0.05;
  if (event.strikeout) d += 0.045;
  else if (event.out) d += 0.02;
  d -= (event.runsAllowed ?? 0) * 0.02;
  return d;
}

/**
 * Confidence as a multiplier on the arm, in the same currency as fatigue.
 *
 * Centred so that level confidence is exactly 1 and changes nothing -- which
 * matters more than it looks. It means a save written before this existed, and
 * every calibration figure taken before it, still describes the same game at
 * the midpoint; only a pitcher who has actually wobbled or actually settled
 * moves off it.
 */
export function confidenceMultiplier(confidence: number): number {
  const from = clamp(confidence, CONFIDENCE.floor, CONFIDENCE.ceiling) - CONFIDENCE.start;
  return 1 + from * CONTEXT.confidenceSwing * 2;
}

export { clamp };

/** The five things a glove is made of, plus the catcher's own. */
type GloveKey = keyof FieldingRatings | 'blocking';

/**
 * How much each defensive rating is worth **at each position**, as shares of one.
 *
 * A flat defensive bonus would have said that a catcher who blocks and a right
 * fielder who blocks are the same player, and blocking is a rating the engine
 * only ever reads behind the plate. Position is most of what defence means: the
 * shortstop is paid for ground covered, the first baseman for the scoop, the
 * corner outfielder for the throw, and the man behind the plate for keeping the
 * ball in front of him. So the weights move with the position rather than the
 * total moving with a badge.
 *
 * Each row sums to 1 and is then scaled by `HITTER_GLOVE`, which is what keeps
 * the change a redistribution rather than a raise: no position gets more total
 * defensive credit than any other, they just get it for different things.
 *
 * Read against the spray model in game.ts, which is where these are earned. A
 * catcher's `range` is nearly worthless because the only ball he fields is a
 * pop-up off the plate; a centre fielder's is nearly everything because a lane
 * of the outfield is his alone. The DH row is the average of a fielder's, not a
 * blank: the slot is where a lineup parks a bat for one afternoon, not a
 * property of the man, and a designated hitter with hands is worth more to a
 * program than one without because next week he is playing somewhere.
 */
const GLOVE_WEIGHTS: Record<Position, Record<GloveKey, number>> = {
  C:    { range: 0.08, hands: 0.22, arm: 0.26, armAccuracy: 0.14, blocking: 0.30 },
  '1B': { range: 0.30, hands: 0.48, arm: 0.10, armAccuracy: 0.12, blocking: 0 },
  '2B': { range: 0.32, hands: 0.24, arm: 0.18, armAccuracy: 0.26, blocking: 0 },
  '3B': { range: 0.24, hands: 0.24, arm: 0.26, armAccuracy: 0.26, blocking: 0 },
  SS:   { range: 0.34, hands: 0.22, arm: 0.22, armAccuracy: 0.22, blocking: 0 },
  LF:   { range: 0.38, hands: 0.26, arm: 0.20, armAccuracy: 0.16, blocking: 0 },
  CF:   { range: 0.48, hands: 0.24, arm: 0.18, armAccuracy: 0.10, blocking: 0 },
  RF:   { range: 0.34, hands: 0.24, arm: 0.26, armAccuracy: 0.16, blocking: 0 },
  DH:   { range: 0.28, hands: 0.30, arm: 0.21, armAccuracy: 0.21, blocking: 0 },
  P:    { range: 0.30, hands: 0.25, arm: 0.15, armAccuracy: 0.30, blocking: 0 },
};

// Every row has to sum to one or the position quietly becomes worth more or less
// than the others in total, which is the flat bonus this table exists to avoid.
for (const [pos, row] of Object.entries(GLOVE_WEIGHTS)) {
  const sum = Object.values(row).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`glove weights for ${pos} must sum to 1, got ${sum}`);
  }
}

/**
 * Defence's share of a position player's overall.
 *
 * 0.20 against the 0.18 the three old fielding terms carried between them. It is
 * a redistribution and it was chosen to be one: the offensive weights below give
 * up two points to pay for it, so the league's mean overall does not move and
 * the spread barely does. That matters more than it looks — `overallOf` feeds
 * `projectPotential`, and generated ceilings are hard capped at 94, so raising
 * overalls across the board would push players into the cap and change the grade
 * distribution the ceiling rework just tuned. Measured before and after: the
 * class mean moves a tenth of a point and the grade counts are unchanged.
 */
const HITTER_GLOVE = 0.20;

/**
 * And a pitcher's, which is small on purpose.
 *
 * He fields about one ground ball in eight and the throw across is a real error
 * source — until the defensive layer landed he had no glove at all, which was
 * the more obviously wrong number. But he is the one man on the field chosen for
 * something other than his defence, and his fielding ratings are drawn around a
 * fixed centre rather than around his quality, so every point of weight here
 * pulls the best arms in the country back toward average. Four percent is enough
 * to separate two otherwise identical arms and not enough to flatten the top.
 */
const PITCHER_GLOVE = 0.04;

/** What his glove is worth, on the 0-100 scale the rest of the ratings use. */
function gloveScore(p: Hitter | Pitcher): number {
  const w = GLOVE_WEIGHTS[p.pos];
  return p.range * w.range + p.hands * w.hands + p.arm * w.arm
       + p.armAccuracy * w.armAccuracy
       + (p.type === 'hitter' ? p.blocking * w.blocking : 0);
}

/**
 * One number for how good a player is right now. Derived rather than stored so
 * it cannot go stale when development moves the underlying ratings.
 *
 * The weights are judgment, not arithmetic: contact carries a hitter more than
 * arm strength does, and a pitcher lives on stuff, movement and control with
 * stamina as a distant fourth.
 *
 * `bunt` and `steal` are left out, and that is not an oversight. Both are
 * execution of a call rather than a measure of a player — and `steal` is drawn
 * off `speed`, which is already counted, so paying for it would quietly make
 * fast men good twice.
 */
export function overallOf(p: Hitter | Pitcher): number {
  return p.type === 'hitter'
    ? Math.round(p.contact * 0.29 + p.power * 0.24 + p.eye * 0.15 + p.speed * 0.12
               + gloveScore(p) * HITTER_GLOVE)
    : Math.round(p.stuff * 0.33 + p.movement * 0.27 + p.control * 0.27 + p.stamina * 0.09
               + gloveScore(p) * PITCHER_GLOVE);
}

/**
 * The position a man actually plays, which for a DH is not "DH".
 *
 * There is no such thing as a designated-hitter-shaped human: every DH in the
 * real sport is a first baseman or a corner outfielder whose bat is worth more
 * than his glove, and the DH is a lineup slot the coach spends on him, not a
 * limb he was born without. Reported from testing in exactly those words. The
 * generator has always drawn "DH" players — changing that would move every
 * random draw after it and break determinism — so the identity is derived
 * instead: read his own glove and give him the bat-first spot it fits.
 *
 * Pure arithmetic on ratings, no draws, so the same man answers the same way
 * for ever. Everyone else simply is what the roster says he is.
 */
export function naturalPos(p: Hitter): Position {
  if (p.pos !== 'DH') return p.pos;
  // The three places a bat-first player hides. An arm is the one tool that
  // picks right field; enough range picks left; the rest is a first baseman,
  // which is where the profile the generator draws for a DH mostly lands.
  if (p.arm >= 55 && p.arm >= p.range + 6) return 'RF';
  if (p.range >= 48) return 'LF';
  return '1B';
}
