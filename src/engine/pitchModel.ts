// pitchModel.ts
// One pitch at a time. Six possible outcomes:
// ball, called strike, swinging strike, foul, ball in play, hit by pitch.
//
// Used by Engine B only. Engine A knows its outcome up front and builds a
// sequence to land on it — see constrainedSequence in engines.ts.

import { mult, clamp, LEAGUE_PITCH } from './ratings.js';
import type {
  Arm, Hitter, PAContext, Pitcher, PitchResult, Rng } from './types.js';

/** The twelve reachable counts. */
export type CountKey = `${0 | 1 | 2 | 3}-${0 | 1 | 2}`;

export interface Count {
  balls: number;
  strikes: number;
}

/** What a pitch can end a plate appearance with. */
export type Terminal = 'walk' | 'strikeout' | 'hbp' | 'inplay';

// The tables below are the shape of the D1 count study: how each rate moves from
// count to count. Their overall level comes from LEAGUE_PITCH in ratings.ts, so
// that file stays the single place a baseball number gets tuned. Each table is
// rescaled at load from the base it was measured against to whatever ratings.ts
// currently says. With the shipped values this reproduces the measured tables to
// within about 0.3 percent, the rounding in the shape multipliers below.
function rescale(
  table: Record<CountKey, number>,
  base: number,
  target: number,
): Record<CountKey, number> {
  const k = target / base;
  const out = {} as Record<CountKey, number>;
  for (const [key_, v] of Object.entries(table) as Array<[CountKey, number]>) {
    out[key_] = v * k;
  }
  return out;
}

// Zone rate by count, measured against a 0.480 base zone rate.
// The 3-0 cell is the college game's signature: D1 arms cannot reliably find the
// zone 3-0, where MLB is near 0.80.
const ZONE = rescale({
  '0-0': 0.483, '1-0': 0.528, '2-0': 0.596, '3-0': 0.641,
  '0-1': 0.449, '1-1': 0.494, '2-1': 0.551, '3-1': 0.596,
  '0-2': 0.371, '1-2': 0.416, '2-2': 0.471, '3-2': 0.551,
}, 0.480, LEAGUE_PITCH.zoneRate);

// Swing rates by count, [in zone, chase]. In-zone swings measured against a
// 0.66 base, chases against 0.28. Each column scales with its own constant.
const SWING: Record<CountKey, readonly [number, number]> = (() => {
  const measured: Record<CountKey, readonly [number, number]> = {
    '0-0': [0.42, 0.17], '1-0': [0.52, 0.20], '2-0': [0.55, 0.18], '3-0': [0.10, 0.02],
    '0-1': [0.58, 0.26], '1-1': [0.64, 0.28], '2-1': [0.68, 0.26], '3-1': [0.55, 0.16],
    '0-2': [0.70, 0.38], '1-2': [0.73, 0.40], '2-2': [0.77, 0.40], '3-2': [0.82, 0.42],
  };
  const kz = LEAGUE_PITCH.zSwingRate / 0.66;
  const ko = LEAGUE_PITCH.chaseRate / 0.28;
  const out = {} as Record<CountKey, readonly [number, number]>;
  for (const [key_, zo] of Object.entries(measured) as Array<[CountKey, readonly [number, number]]>) {
    out[key_] = [zo[0] * kz, zo[1] * ko];
  }
  return out;
})();

// What a swing produces: [miss, foul, inPlay], before ratings adjust it. Chases
// miss far more and go in play far less. The shape multipliers below are held
// against the league miss and foul shares so those two constants govern the mix.
const SWING_RESULT: Record<'zone' | 'chase', readonly [number, number, number]> = (() => {
  const shape = {
    zone: { miss: 0.642, foul: 0.986 },
    chase: { miss: 1.479, foul: 1.096 },
  };
  const build = (s: { miss: number; foul: number }): readonly [number, number, number] => {
    const miss = LEAGUE_PITCH.missShareOfSwings * s.miss;
    const foul = LEAGUE_PITCH.foulShareOfSwings * s.foul;
    return [miss, foul, Math.max(0.01, 1 - miss - foul)];
  };
  return { zone: build(shape.zone), chase: build(shape.chase) };
})();

/**
 * The cast is safe: applyPitch ends the plate appearance at four balls and three
 * strikes, so this is only ever reached with 0-3 balls and 0-2 strikes.
 */
export const key = (b: number, s: number): CountKey => `${b}-${s}` as CountKey;

export function pitchOutcome(
  balls: number,
  strikes: number,
  batter: Hitter,
  pitcher: Arm,
  ctx: PAContext,
  rng: Rng,
): PitchResult {
  const k = key(balls, strikes);
  const fatigue = ctx.fatigueMult ?? 1;

  // Control moves the zone rate. This is where a 3-0 strike becomes a skill.
  let zoneRate = clamp(ZONE[k] * mult(pitcher.control, 0.22) * fatigue, 0.12, 0.80);
  if (ctx.zoneBias) zoneRate = clamp(zoneRate * ctx.zoneBias, 0.10, 0.88);

  const inZone = rng() < zoneRate;
  const [zSwing, oSwing] = SWING[k];

  // A good eye means swinging at strikes and laying off balls.
  const swingProb = inZone
    ? clamp(zSwing * mult(batter.eye, 0.10), 0.03, 0.95)
    : clamp(oSwing * mult(batter.eye, -0.30), 0.01, 0.75);

  if (rng() >= swingProb) {
    if (inZone) return 'called';
    // Hit by pitch lives on the wildest non swings.
    if (rng() < 0.024 * mult(pitcher.control, -0.55)) return 'hbp';
    return 'ball';
  }

  const base = inZone ? SWING_RESULT.zone : SWING_RESULT.chase;
  const missM = mult(pitcher.stuff, 0.55) * mult(batter.contact, -0.60) / fatigue;
  let miss = base[0] * missM;
  let foul = base[1];
  let play = base[2];
  const total = miss + foul + play;
  miss /= total; foul /= total; play /= total;

  const r = rng();
  if (r < miss) return 'swinging';
  if (r < miss + foul) return 'foul';
  return 'inplay';
}

/** Advance the count. Returns the terminal event, or null if the PA continues. */
export function applyPitch(result: PitchResult, count: Count): Terminal | null {
  switch (result) {
    case 'ball':
      count.balls++;
      return count.balls >= 4 ? 'walk' : null;
    case 'called':
    case 'swinging':
      count.strikes++;
      return count.strikes >= 3 ? 'strikeout' : null;
    case 'foul':
      if (count.strikes < 2) count.strikes++;
      return null;
    case 'hbp':
      return 'hbp';
    case 'inplay':
      return 'inplay';
  }
}
