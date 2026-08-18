// engines.js
// Two competing plate appearance models, same interface, so you can run the
// same season through both and compare.
//
// ENGINE A (log5): pick the outcome from a validated probability model, then
//   generate a pitch sequence constrained to land on it. Stats stay honest.
// ENGINE B (pitch): simulate pitches freely and let the outcome emerge.
//   More elegant, much harder to calibrate.

import {
  LEAGUE, EVENTS, batterVector, pitcherVector, platoonMultiplier,
  strikeoutProbability, battedBallType, fatigueMultiplier, CONTEXT, mult, clamp,
} from './ratings.js';
import { pitchOutcome, applyPitch } from './pitchModel.js';

// ---------------------------------------------------------------------------
// Shared: context multiplier on offense
// ---------------------------------------------------------------------------
function contextMultiplier(ctx) {
  let m = 1;
  if (ctx.runnersOn) m *= CONTEXT.runnersOnOffenseBoost;
  const tto = CONTEXT.timesThroughOrder[Math.min(ctx.timesThrough ?? 1, 4)];
  m *= tto;
  m *= 1 / (ctx.fatigueMult ?? 1);
  return m;
}

// ---------------------------------------------------------------------------
// ENGINE A: generalized log5
// ---------------------------------------------------------------------------
// base_i = (batter_i * pitcher_i) / league_i, then normalize across all seven.
export function log5Outcome(batter, pitcher, ctx, rng) {
  const b = { ...batterVector(batter) };
  const p = pitcherVector(pitcher);

  const platoon = platoonMultiplier(batter, pitcher);
  const context = contextMultiplier(ctx);
  const offense = platoon * context;

  // Apply matchup and context to the batter's offensive events, then renormalize.
  let sum = 0;
  for (const ev of EVENTS) {
    if (ev === 'out') continue;
    b[ev] *= offense;
    sum += b[ev];
  }
  b.out = Math.max(0.05, 1 - sum);
  const btot = EVENTS.reduce((a, ev) => a + b[ev], 0);
  for (const ev of EVENTS) b[ev] /= btot;

  const base = {};
  let denom = 0;
  for (const ev of EVENTS) {
    base[ev] = (b[ev] * p[ev]) / LEAGUE[ev];
    denom += base[ev];
  }

  const r = rng() * denom;
  let acc = 0;
  for (const ev of EVENTS) {
    acc += base[ev];
    if (r < acc) return ev;
  }
  return 'out';
}

// Generate a plausible pitch sequence that ends on the known outcome.
// Rather than rejection sampling (which inflates pitch counts badly), build the
// count path directly from realistic distributions, then order it plausibly.
function pick(rng, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}

function constrainedSequence(target, batter, pitcher, ctx, rng) {
  const eyeM = mult(batter.eye, 0.35);
  const stuffM = mult(pitcher.stuff, 0.30);

  // How many balls and strikes accumulate before the at bat ends.
  const nBalls = target === 'walk'
    ? 4
    : pick(rng, [0.38, 0.30 * eyeM, 0.20 * eyeM, 0.12 * eyeM]);
  const nStrikes = target === 'strikeout'
    ? 3
    : pick(rng, [0.30, 0.35, 0.35 * stuffM]);

  // Extra foul balls once the batter is at two strikes.
  let extraFouls = 0;
  while (rng() < 0.34 && extraFouls < 7) extraFouls++;

  const pitches = [];
  let b = 0, s = 0;
  const strikeType = () => (rng() < 0.42 ? 'called' : 'swinging');

  // Interleave balls and non terminal strikes.
  const preBalls = target === 'walk' ? nBalls - 1 : nBalls;
  const preStrikes = target === 'strikeout' ? nStrikes - 1 : nStrikes;
  let remB = preBalls, remS = preStrikes;

  while (remB > 0 || remS > 0) {
    const takeBall = remS === 0 ? true : remB === 0 ? false : rng() < remB / (remB + remS);
    if (takeBall) { pitches.push('ball'); remB--; b++; }
    else { pitches.push(rng() < 0.30 ? 'foul' : strikeType()); remS--; s++; }
    // Fouls only pile up once the batter is protecting with two strikes.
    if (s === 2 && extraFouls > 0) {
      for (let i = 0; i < extraFouls; i++) pitches.push('foul');
      extraFouls = 0;
    }
  }
  if (s === 2 && extraFouls > 0) for (let i = 0; i < extraFouls; i++) pitches.push('foul');

  // Terminal pitch.
  if (target === 'walk') pitches.push('ball');
  else if (target === 'strikeout') pitches.push(rng() < 0.28 ? 'called' : 'swinging');
  else if (target === 'hbp') pitches.push('hbp');
  else pitches.push('inplay');

  return { pitches, count: { balls: b, strikes: s } };
}

export function engineLog5(batter, pitcher, ctx, rng) {
  const event = log5Outcome(batter, pitcher, ctx, rng);

  let kind = event;      // strikeout, or a batted ball type
  let target = 'inplay';
  if (event === 'walk') { kind = 'walk'; target = 'walk'; }
  else if (event === 'hbp') { kind = 'hbp'; target = 'hbp'; }
  else if (event === 'out') {
    const kProb = strikeoutProbability(batter, pitcher, ctx.fatigueMult ?? 1) / LEAGUE.out;
    if (rng() < clamp(kProb, 0.02, 0.85)) { kind = 'strikeout'; target = 'strikeout'; }
    else kind = battedBallType(batter, pitcher, rng);
  } else {
    kind = battedBallType(batter, pitcher, rng);
  }

  const { pitches } = constrainedSequence(target, batter, pitcher, ctx, rng);
  return { event, kind, pitches, engine: 'log5' };
}

// ---------------------------------------------------------------------------
// ENGINE B: free pitch simulation
// ---------------------------------------------------------------------------
// Hit probability and extra base share by batted ball type.
const BIP = {
  ground: { hit: 0.276, double: 0.045, triple: 0.010, homerun: 0.000 },
  line:   { hit: 0.735, double: 0.245, triple: 0.030, homerun: 0.070 },
  fly:    { hit: 0.252, double: 0.270, triple: 0.030, homerun: 0.275 },
  popup:  { hit: 0.020, double: 0.100, triple: 0.000, homerun: 0.000 },
};

function resolveBallInPlay(batter, pitcher, ctx, rng) {
  const type = battedBallType(batter, pitcher, rng);
  const t = BIP[type];

  const hitProb = clamp(
    t.hit * mult(batter.contact, 0.20) * mult(pitcher.movement, -0.22) *
      mult(batter.speed, type === 'ground' ? 0.18 : 0.04) * (ctx.defenseMult ?? 1),
    0.005, 0.95,
  );

  if (rng() >= hitProb) return { event: 'out', kind: type };

  const hrShare = clamp(t.homerun * mult(batter.power, 0.85) * mult(pitcher.movement, -0.70), 0, 0.85);
  const dbShare = clamp(t.double * mult(batter.power, 0.30), 0, 0.60);
  const tpShare = clamp(t.triple * mult(batter.speed, 0.90), 0, 0.20);

  const r = rng();
  if (r < hrShare) return { event: 'homerun', kind: type };
  if (r < hrShare + tpShare) return { event: 'triple', kind: type };
  if (r < hrShare + tpShare + dbShare) return { event: 'double', kind: type };
  return { event: 'single', kind: type };
}

export function enginePitch(batter, pitcher, ctx, rng) {
  const count = { balls: 0, strikes: 0 };
  const pitches = [];
  const platoon = platoonMultiplier(batter, pitcher);
  const context = contextMultiplier(ctx);
  const local = {
    ...ctx,
    // Platoon and context bend the pitch model rather than the outcome table.
    zoneBias: 1 / Math.pow(platoon * context, 0.5),
  };

  for (let guard = 0; guard < 25; guard++) {
    const result = pitchOutcome(count.balls, count.strikes, batter, pitcher, local, rng);
    pitches.push(result);
    const terminal = applyPitch(result, count);
    if (terminal === 'walk') return { event: 'walk', kind: 'walk', pitches, engine: 'pitch' };
    if (terminal === 'hbp') return { event: 'hbp', kind: 'hbp', pitches, engine: 'pitch' };
    if (terminal === 'strikeout') return { event: 'out', kind: 'strikeout', pitches, engine: 'pitch' };
    if (terminal === 'inplay') {
      const bip = resolveBallInPlay(batter, pitcher, { ...ctx, defenseMult: (ctx.defenseMult ?? 1) * platoon * context }, rng);
      return { ...bip, pitches, engine: 'pitch' };
    }
  }
  return { event: 'out', kind: 'strikeout', pitches, engine: 'pitch' };
}

export const ENGINES = { log5: engineLog5, pitch: enginePitch };
