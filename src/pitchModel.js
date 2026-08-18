// pitchModel.js
// One pitch at a time. Six possible outcomes:
// ball, called strike, swinging strike, foul, ball in play, hit by pitch.

import { mult, clamp } from './ratings.js';

// Zone rate by count. Calibrated so D1 first pitch strike lands near 58 percent
// and the 3-0 strike rate near 58 percent, which is the big college gap.
const ZONE = {
  '0-0': 0.483, '1-0': 0.528, '2-0': 0.596, '3-0': 0.641,
  '0-1': 0.449, '1-1': 0.494, '2-1': 0.551, '3-1': 0.596,
  '0-2': 0.371, '1-2': 0.416, '2-2': 0.471, '3-2': 0.551,
};

// Swing rates in the zone and out of the zone, by count.
const SWING = {
  '0-0': [0.42, 0.17], '1-0': [0.52, 0.20], '2-0': [0.55, 0.18], '3-0': [0.10, 0.02],
  '0-1': [0.58, 0.26], '1-1': [0.64, 0.28], '2-1': [0.68, 0.26], '3-1': [0.55, 0.16],
  '0-2': [0.70, 0.38], '1-2': [0.73, 0.40], '2-2': [0.77, 0.40], '3-2': [0.82, 0.42],
};

// What a swing produces. [miss, foul, inPlay] before ratings adjust it.
const SWING_RESULT = {
  zone:   [0.138, 0.360, 0.502],
  chase:  [0.318, 0.400, 0.282],
};

export const key = (b, s) => `${b}-${s}`;

export function pitchOutcome(balls, strikes, batter, pitcher, ctx, rng) {
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

// Advance the count. Returns the terminal event or null if the PA continues.
export function applyPitch(result, count) {
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
  return null;
}
