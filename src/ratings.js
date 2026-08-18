// ratings.js
// Everything that turns a 0 to 100 rating into a real baseball rate lives here.
// Tune in this file only. Nothing else should hardcode a baseball number.

// League baseline, per plate appearance, calibrated to NCAA Division I.
// These seven must sum to exactly 1.
export const LEAGUE = {
  single: 0.1655,
  double: 0.0495,
  triple: 0.006,
  homerun: 0.0185,
  walk: 0.105,
  hbp: 0.015,
  out: 0.6405,
};

export const EVENTS = ['single', 'double', 'triple', 'homerun', 'walk', 'hbp', 'out'];

// Share of plate appearances that end in a strikeout. Sits inside 'out'.
export const LEAGUE_K_RATE = 0.180;

// Batted ball type distribution on balls in play.
export const LEAGUE_BIP = { ground: 0.44, line: 0.21, fly: 0.27, popup: 0.08 };

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

// Context modifiers.
export const CONTEXT = {
  runnersOnOffenseBoost: 1.035,  // pitching from the stretch
  timesThroughOrder: [1.0, 1.0, 1.035, 1.075, 1.11],
  fatigueSlopePerPitch: 0.0022,  // effectiveness lost per pitch past stamina
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Global spread control. Every rating sensitivity is scaled by this.
// Turn it up and stars separate more, but the better team starts winning too
// often and baseball stops feeling like baseball. This is the single most
// important tuning knob in the whole engine.
export const SPREAD = 0.62;

// Core conversion. rating 50 is league average and returns 1.0.
// sensitivity controls how much spread the rating produces.
export function mult(rating, sensitivity) {
  return Math.exp(((clamp(rating, 1, 99) - 50) / 50) * sensitivity * SPREAD);
}

// How strongly each rating pushes each event.
const BAT_SENS = {
  single:  { contact: 0.38, speed: 0.14 },
  double:  { power: 0.45, contact: 0.12 },
  triple:  { speed: 1.20 },
  homerun: { power: 0.95 },
  walk:    { eye: 0.90 },
  hbp:     { eye: 0.10 },
};

const PIT_SENS = {
  single:  { movement: -0.28, stuff: -0.12 },
  double:  { movement: -0.38 },
  triple:  { movement: -0.20 },
  homerun: { movement: -0.95 },
  walk:    { control: -0.90 },
  hbp:     { control: -0.55 },
};

function buildVector(sensTable, source) {
  const v = {};
  let sum = 0;
  for (const ev of EVENTS) {
    if (ev === 'out') continue;
    let m = 1;
    const sens = sensTable[ev] || {};
    for (const [attr, s] of Object.entries(sens)) {
      m *= mult(source[attr] ?? 50, s);
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

export function batterVector(batter) {
  return buildVector(BAT_SENS, batter);
}

export function pitcherVector(pitcher) {
  return buildVector(PIT_SENS, pitcher);
}

// Platoon. Returns the multiplier applied to a batter's offensive events.
// Opposite hand favors the batter, same hand favors the pitcher.
// platoonSkill is the player's full split size as a share of production.
export function platoonMultiplier(batter, pitcher) {
  const bats = batter.bats === 'S' ? (pitcher.throws === 'R' ? 'L' : 'R') : batter.bats;
  const sameHand = bats === pitcher.throws;
  const skill = (batter.platoonSkill ?? 0.06) + (pitcher.platoonSkill ?? 0);
  // Overall production is a weighted average of both matchups, so split the
  // effect in half either side of the mean.
  return sameHand ? 1 - skill / 2 : 1 + skill / 2;
}

// Strikeout share of outs, resolved after the log5 model says 'out'.
export function strikeoutProbability(batter, pitcher, fatigueMult = 1) {
  const raw =
    LEAGUE_K_RATE *
    mult(batter.contact, -0.70) *
    mult(pitcher.stuff, 0.70) *
    (1 / fatigueMult);
  return clamp(raw, 0.02, 0.62);
}

export function battedBallType(batter, pitcher, rng) {
  const gb = LEAGUE_BIP.ground * mult(pitcher.groundBall, 0.55) * mult(batter.power, -0.18);
  const fly = LEAGUE_BIP.fly * mult(pitcher.groundBall, -0.45) * mult(batter.power, 0.22);
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
export function fatigueMultiplier(pitcher, pitchCount) {
  const budget = 30 + pitcher.stamina * 0.85; // stamina 80 gives roughly 98 pitches
  if (pitchCount <= budget) return 1;
  return Math.max(0.55, 1 - (pitchCount - budget) * CONTEXT.fatigueSlopePerPitch);
}

export { clamp };
