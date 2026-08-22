// strategy.ts
// The five things a coach actually controls, and what each one costs.
//
// The design rule here is the whole point: **every aggressive setting has to
// hurt somewhere.** A screen where one column is strictly better than another is
// not a decision, it is a stat boost with extra steps — and the player works
// that out in about ten minutes and never touches it again.
//
// So: running harder takes more bases and runs into more outs. Stealing more
// steals more and gets caught more. Bunting more moves runners and spends outs
// doing it, which is usually a bad trade and occasionally the right one. A quick
// hook keeps fresh arms on the mound and burns through the bullpen. A shift
// takes hits away from sluggers and gives them back to anyone who can run.

import type { Hitter } from './types.js';

export type RunningPolicy = 'patient' | 'balanced' | 'aggressive';
export type StealPolicy = 'never' | 'selective' | 'constant';
export type BuntPolicy = 'never' | 'rare' | 'often';
export type HookPolicy = 'quick' | 'standard' | 'patient';
export type Alignment = 'straight' | 'situational' | 'shift';

export interface Strategy {
  running: RunningPolicy;
  steals: StealPolicy;
  bunt: BuntPolicy;
  hook: HookPolicy;
  alignment: Alignment;
}

export const DEFAULT_STRATEGY: Strategy = {
  running: 'balanced',
  steals: 'selective',
  bunt: 'rare',
  hook: 'standard',
  alignment: 'straight',
};

// ---------------------------------------------------------------------------
// What each setting does
// ---------------------------------------------------------------------------

/**
 * Baserunning. `attempt` scales how often a runner tries for the extra base;
 * `risk` scales how often trying gets him thrown out.
 *
 * Both move together, which is the trade. Sending everybody does gain bases —
 * it also runs your leadoff man into a throw with nobody out.
 */
export const RUNNING: Record<RunningPolicy, { attempt: number; risk: number }> = {
  patient: { attempt: 0.80, risk: 0.62 },
  balanced: { attempt: 1.00, risk: 1.00 },
  aggressive: { attempt: 1.24, risk: 1.70 },
};

/** Green light policy. Scales the steal attempt rate; success is unchanged. */
export const STEALS: Record<StealPolicy, number> = {
  never: 0,
  selective: 1.00,
  constant: 2.20,
};

/**
 * How willing you are to give up an out to move a runner.
 *
 * Worth stating plainly: **bunting is usually wrong.** It costs more in expected
 * runs than it gains in almost every situation, which is why the default is
 * "rare" rather than "often". It earns its place late in a tie game when one run
 * is the only run that matters, and the engine reflects that rather than
 * pretending the small ball is free.
 */
export const BUNT: Record<BuntPolicy, number> = {
  never: 0,
  rare: 0.14,
  often: 0.46,
};

/** Pitches added to or taken off a starter's leash before the bullpen stirs. */
export const HOOK: Record<HookPolicy, number> = {
  quick: -15,
  standard: 0,
  patient: 18,
};

/**
 * Defensive alignment, as a multiplier on a ground ball becoming a hit.
 *
 * A shift is a bet, not an upgrade. Sliding three infielders to one side takes
 * hits off a pull-heavy slugger and hands them to anyone who can put the ball
 * the other way or beat it out — which is why it is aimed at power and punished
 * by speed. Straight up is not the timid option, it is the option that has no
 * opinion about who is batting.
 */
export const SHIFT: Record<Alignment, { vsPower: number; vsSpeed: number }> = {
  straight: { vsPower: 1.00, vsSpeed: 1.00 },
  situational: { vsPower: 0.93, vsSpeed: 1.06 },
  shift: { vsPower: 0.82, vsSpeed: 1.21 },
};

/**
 * How much the alignment helps or hurts against this particular hitter.
 * Returns a multiplier on the chance a ball finds a hole.
 *
 * The measurement that shaped this: shifting against *every* hitter is a wash.
 * Over 2500 games a blanket shift moved runs allowed from 4.72 to 4.71 — the
 * sluggers it suppresses and the runners it hands singles to cancel almost
 * exactly. That is not a flaw in the model, it is the reason real teams shift
 * against particular hitters instead of standing in one alignment all night.
 *
 * So the three settings are genuinely different bets rather than three sizes of
 * the same one:
 *
 *   STRAIGHT      no opinion, no exposure.
 *   SITUATIONAL   shift only where it is clearly right — pull heavy, slow. The
 *                 percentage play: small edge, little downside.
 *   FULL SHIFT    every hitter, every time. Big against a pull heavy lineup,
 *                 actively bad against one that can run. A bet on the opponent.
 */
export function alignmentAgainst(alignment: Alignment, batter: Hitter): number {
  if (alignment === 'straight') return 1;

  // Scaled from 45 over a 30 point range so an ordinary hitter still feels
  // something. Anchored at the league average across the full scale, a power 70
  // slugger saw a 4% effect and everyone else essentially none — real in the
  // code, invisible in the box score.
  const pull = Math.max(0, Math.min(1.4, (batter.power - 45) / 30));
  const wheels = Math.max(0, Math.min(1.4, (batter.speed - 45) / 30));

  if (alignment === 'situational') {
    // Pick the spots. Against anyone who can run, or who does not pull, stand
    // straight up and take nothing on.
    if (pull < 0.5 || wheels > 0.7) return 1;
    return 1 + (SHIFT.shift.vsPower - 1) * pull;
  }

  const s = SHIFT.shift;
  return (1 + (s.vsPower - 1) * pull) * (1 + (s.vsSpeed - 1) * wheels);
}

// ---------------------------------------------------------------------------
// The rest of the conference
// ---------------------------------------------------------------------------

const RUNNING_BY_TRAIT: RunningPolicy[] = ['patient', 'balanced', 'balanced', 'aggressive'];
const STEALS_BY_TRAIT: StealPolicy[] = ['never', 'selective', 'selective', 'constant'];
const BUNT_BY_TRAIT: BuntPolicy[] = ['never', 'rare', 'rare', 'often'];
const HOOK_BY_TRAIT: HookPolicy[] = ['quick', 'standard', 'standard', 'patient'];
const ALIGN_BY_TRAIT: Alignment[] = ['straight', 'straight', 'situational', 'shift'];

/**
 * Every other coach in the world gets a personality, derived from the team index
 * so it is stable across a save and varies across the league. The spec asks for
 * this directly: an aggressive coach steals and pulls starters early, a
 * conservative one bunts and plays for one run, and that variety is what makes
 * 64 programs feel like different places rather than one program repeated.
 *
 * Deliberately not random — a team that changed philosophy every time you looked
 * at it would be noise, not character.
 */
export function strategyFor(teamIndex: number): Strategy {
  const pick = <T,>(table: T[], salt: number): T =>
    table[(teamIndex * 7 + salt * 13) % table.length] as T;
  return {
    running: pick(RUNNING_BY_TRAIT, 1),
    steals: pick(STEALS_BY_TRAIT, 2),
    bunt: pick(BUNT_BY_TRAIT, 3),
    hook: pick(HOOK_BY_TRAIT, 4),
    alignment: pick(ALIGN_BY_TRAIT, 5),
  };
}
