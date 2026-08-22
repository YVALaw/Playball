// engines.ts
// Two competing plate appearance models, same interface, so you can run the
// same season through both and compare.
//
// ENGINE A (log5): pick the outcome from a validated probability model, then
//   generate a pitch sequence constrained to land on it. Stats stay honest.
// ENGINE B (pitch): simulate pitches freely and let the outcome emerge.
//   More elegant, much harder to calibrate.

import {
  LEAGUE, EVENTS, batterVector, pitcherVector, platoonMultiplier,
  strikeoutProbability, battedBallType, CONTEXT, mult, clamp, SEQUENCE,
} from './ratings.js';
import { pitchOutcome, applyPitch, type Count } from './pitchModel.js';
import type {
  BattedBall, EngineFn, EngineName, EventVector, Hitter, PAContext, PAEvent,
  PAKind, PAResult, Pitcher, PitchResult, Rng,
} from './types.js';

// ---------------------------------------------------------------------------
// Shared: context multiplier on offense
// ---------------------------------------------------------------------------
function contextMultiplier(ctx: PAContext): number {
  let m = 1;
  // Applied symmetrically so the home edge does not inflate league scoring:
  // whatever the home side gains, the visitor gives back.
  if (ctx.isHome !== undefined) {
    m *= ctx.isHome ? CONTEXT.homeFieldOffense : 1 / CONTEXT.homeFieldOffense;
  }
  if (ctx.runnersOn) m *= CONTEXT.runnersOnOffenseBoost;
  const tto = CONTEXT.timesThroughOrder[Math.min(ctx.timesThrough ?? 1, 4)] ?? 1;
  m *= tto;
  m *= 1 / (ctx.fatigueMult ?? 1);
  // Every modifier above is a lift, so their product averages well over 1.0 and
  // the mean plate appearance drifts above the league baseline that LEAGUE
  // defines. Dividing by the expected product keeps these modifiers doing what
  // they are for — redistributing offense across situations — without moving the
  // league total. Retune with `npm run calibrate` if any modifier changes.
  return m / CONTEXT.normalizer;
}

// ---------------------------------------------------------------------------
// ENGINE A: generalized log5
// ---------------------------------------------------------------------------
// base_i = (batter_i * pitcher_i) / league_i, then normalize across all seven.
export function log5Outcome(
  batter: Hitter,
  pitcher: Pitcher,
  ctx: PAContext,
  rng: Rng,
): PAEvent {
  const b: EventVector = { ...batterVector(batter) };
  const p = pitcherVector(pitcher);

  const platoon = platoonMultiplier(batter, pitcher);
  const context = contextMultiplier(ctx);
  const offense = platoon * context;

  // Apply matchup, context and the manager's call to the batter's offensive
  // events, then renormalize. A tactic tilts the distribution; it never forces
  // an outcome.
  const called = ctx.mods?.events;

  // The defensive alignment lands on singles specifically. A shift takes away
  // the ground ball that sneaks through the right side — it does very little
  // about a double in the gap and nothing at all about a home run. Engine A
  // settles the event before it picks a batted ball type, so this has to act on
  // the outcome distribution rather than on the grounder after the fact.
  const shift = ctx.alignment ?? 1;

  // The defence behind the pitcher.
  //
  // `defenseMult` was computed in game.ts for every plate appearance and read
  // only by Engine B — Engine A, the one that actually runs the league, never
  // looked at it. Team defence therefore did nothing at all to hit rates, which
  // is the same dead-config failure as B2 and just as invisible: the value was
  // right, it was passed correctly, and nothing consumed it.
  //
  // It applies to balls in play and nothing else. No defence has ever caught a
  // home run, and none of them can affect a walk.
  const defence = ctx.defenseMult ?? 1;

  let sum = 0;
  for (const ev of EVENTS) {
    if (ev === 'out') continue;
    const inPlay = ev === 'single' || ev === 'double' || ev === 'triple';
    b[ev] *= offense * (inPlay ? defence : 1)
      * (called?.[ev] ?? 1) * (ev === 'single' ? shift : 1);
    sum += b[ev];
  }
  b.out = Math.max(0.05, 1 - sum);
  const btot = EVENTS.reduce((a, ev) => a + b[ev], 0);
  for (const ev of EVENTS) b[ev] /= btot;

  const base = {} as EventVector;
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

/** What the sequence generator has to land on. */
type SequenceTarget = 'walk' | 'strikeout' | 'hbp' | 'inplay';

// Generate a plausible pitch sequence that ends on the known outcome.
// Rather than rejection sampling (which inflates pitch counts badly), build the
// count path directly from realistic distributions, then order it plausibly.
function pick(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] as number;
    if (r < 0) return i;
  }
  return weights.length - 1;
}

function constrainedSequence(
  target: SequenceTarget,
  batter: Hitter,
  pitcher: Pitcher,
  _ctx: PAContext,
  rng: Rng,
): { pitches: PitchResult[]; count: Count } {
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
  while (rng() < SEQUENCE.extraFoulChance && extraFouls < SEQUENCE.extraFoulCap) extraFouls++;

  const pitches: PitchResult[] = [];
  let b = 0;
  let s = 0;
  const strikeType = (): PitchResult =>
    (rng() < SEQUENCE.calledShareOfStrikes ? 'called' : 'swinging');

  // Interleave balls and non terminal strikes.
  const preBalls = target === 'walk' ? nBalls - 1 : nBalls;
  const preStrikes = target === 'strikeout' ? nStrikes - 1 : nStrikes;
  let remB = preBalls;
  let remS = preStrikes;

  while (remB > 0 || remS > 0) {
    const takeBall = remS === 0 ? true : remB === 0 ? false : rng() < remB / (remB + remS);
    if (takeBall) { pitches.push('ball'); remB--; b++; }
    else {
      pitches.push(rng() < SEQUENCE.foulShareOfStrikes ? 'foul' : strikeType());
      remS--; s++;
    }
    // Fouls only pile up once the batter is protecting with two strikes.
    if (s === 2 && extraFouls > 0) {
      for (let i = 0; i < extraFouls; i++) pitches.push('foul');
      extraFouls = 0;
    }
  }
  if (s === 2 && extraFouls > 0) for (let i = 0; i < extraFouls; i++) pitches.push('foul');

  // Terminal pitch.
  if (target === 'walk') pitches.push('ball');
  else if (target === 'strikeout') {
    pitches.push(rng() < SEQUENCE.calledStrikeThree ? 'called' : 'swinging');
  } else if (target === 'hbp') pitches.push('hbp');
  else pitches.push('inplay');

  return { pitches, count: { balls: b, strikes: s } };
}

export const engineLog5: EngineFn = (batter, pitcher, ctx, rng): PAResult => {
  const event = log5Outcome(batter, pitcher, ctx, rng);

  let kind: PAKind;
  let target: SequenceTarget = 'inplay';
  if (event === 'walk') { kind = 'walk'; target = 'walk'; }
  else if (event === 'hbp') { kind = 'hbp'; target = 'hbp'; }
  else if (event === 'out') {
    const kProb = strikeoutProbability(batter, pitcher, ctx.fatigueMult ?? 1) / LEAGUE.out;
    if (rng() < clamp(kProb, 0.02, 0.85)) { kind = 'strikeout'; target = 'strikeout'; }
    else kind = battedBallType(batter, pitcher, rng, ctx.mods?.groundBall ?? 1);
  } else {
    kind = battedBallType(batter, pitcher, rng, ctx.mods?.groundBall ?? 1);
  }

  const { pitches } = constrainedSequence(target, batter, pitcher, ctx, rng);
  return { event, kind, pitches, engine: 'log5' };
};

// ---------------------------------------------------------------------------
// ENGINE B: free pitch simulation
// ---------------------------------------------------------------------------
// Hit probability and extra base share by batted ball type.
const BIP: Record<BattedBall, { hit: number; double: number; triple: number; homerun: number }> = {
  ground: { hit: 0.276, double: 0.045, triple: 0.010, homerun: 0.000 },
  line:   { hit: 0.735, double: 0.245, triple: 0.030, homerun: 0.070 },
  fly:    { hit: 0.252, double: 0.270, triple: 0.030, homerun: 0.275 },
  popup:  { hit: 0.020, double: 0.100, triple: 0.000, homerun: 0.000 },
};

function resolveBallInPlay(
  batter: Hitter,
  pitcher: Pitcher,
  ctx: PAContext,
  rng: Rng,
): { event: PAEvent; kind: PAKind } {
  const type = battedBallType(batter, pitcher, rng, ctx.mods?.groundBall ?? 1);
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

export const enginePitch: EngineFn = (batter, pitcher, ctx, rng): PAResult => {
  const count: Count = { balls: 0, strikes: 0 };
  const pitches: PitchResult[] = [];
  const platoon = platoonMultiplier(batter, pitcher);
  const context = contextMultiplier(ctx);
  const local: PAContext = {
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
      const bip = resolveBallInPlay(
        batter,
        pitcher,
        { ...ctx, defenseMult: (ctx.defenseMult ?? 1) * platoon * context },
        rng,
      );
      return { ...bip, pitches, engine: 'pitch' };
    }
  }
  return { event: 'out', kind: 'strikeout', pitches, engine: 'pitch' };
};

export const ENGINES: Record<EngineName, EngineFn> = { log5: engineLog5, pitch: enginePitch };
