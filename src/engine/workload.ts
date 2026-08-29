// workload.ts
// A season in the legs, and a season in the arm.
//
// Stage 9. Two different tirednesses that the game had never modelled at the
// season scale: a position player who has started forty straight, and a starter
// who is a hundred and ten innings into a college spring.
//
// In-game pitcher fatigue already exists and is calibrated (`fatigueMultiplier`
// in `ratings.ts`, spent against `pitchBudget`). This is the layer above it --
// what a man carries into the game rather than what he spends inside it.
//
// ---------------------------------------------------------------------------
// Very slight, and that is the specification
// ---------------------------------------------------------------------------
//
// Asked for in those words: both effects, "but very slight -- we don't want to
// have our roster dead after a few games." So the numbers here are small enough
// that a fresh roster and a tired one are the same team playing slightly
// differently, and the tiredness matters because it *stacks with* the injury
// roll rather than because it hollows anybody out.
//
// That is also the honest model. A college regular playing every day in May is
// not visibly worse; he is a fraction slower and a fraction likelier to pull
// something, and it is the second half that costs a program its season.

import type { Pitcher, Player } from './types.js';

/** What a man carries through the season. Sparse: a fresh save has none. */
export interface Worked {
  /** Consecutive games started without a day off. */
  straight?: number;
  /** Innings thrown this season, in outs, so a third counts. */
  outs?: number;
}

/**
 * Where a position player starts to feel it.
 *
 * Twelve straight is two full weekend series plus the midweeks -- the point a
 * real staff starts looking for a day to sit somebody.
 */
export const FRESH_UNTIL = 12;

/** And where sitting him stops being optional. */
export const WORN_AT = 26;

/**
 * How tired he is, nought to one.
 *
 * Nought until `FRESH_UNTIL`, because a man is not tired for playing a
 * fortnight, and capped at one so a coach who never rests anybody reaches a
 * floor rather than an abyss.
 */
export function legWeariness(p: Player): number {
  const w = p as Player & Worked;
  const straight = w.straight ?? 0;
  if (straight <= FRESH_UNTIL) return 0;
  return Math.min(1, (straight - FRESH_UNTIL) / (WORN_AT - FRESH_UNTIL));
}

/**
 * What that does to him at the plate, as a multiplier on his ratings.
 *
 * Three percent at the very bottom. Small on purpose -- see the header -- and
 * small enough that it is never the reason a game was lost, which is correct:
 * the cost of running a man into the ground is that he gets hurt, not that he
 * stops being able to hit.
 */
export function legMultiplier(p: Player): number {
  return 1 - legWeariness(p) * 0.03;
}

/**
 * And what it does to the odds of something going.
 *
 * Up to two and a half times the base rate at the floor. This is where the
 * weight of the system sits, and it is the number that makes resting a regular
 * a real decision rather than a courtesy.
 */
export function strainMultiplier(p: Player): number {
  return 1 + legWeariness(p) * 1.5;
}

/** A day played, and a day off. */
export function played(p: Player): void {
  const w = p as Player & Worked;
  w.straight = (w.straight ?? 0) + 1;
}

export function rested(p: Player): void {
  const w = p as Player & Worked;
  // A day off is a day off, not a reset to nothing -- a man who has played
  // thirty straight is not fresh because he sat on Tuesday.
  w.straight = Math.max(0, Math.round((w.straight ?? 0) * 0.4));
}

// ---------------------------------------------------------------------------
// The arm
// ---------------------------------------------------------------------------

/**
 * A college starter's season, in innings.
 *
 * Roughly what a Friday man throws across fifteen starts before anybody starts
 * using the word workload about him.
 */
export const SEASON_INNINGS = 95;

/** How deep into his year he is, nought to one and beyond. */
export function armMileage(p: Pitcher): number {
  const w = p as Pitcher & Worked;
  return (w.outs ?? 0) / 3 / SEASON_INNINGS;
}

/**
 * What a season in the arm does to him.
 *
 * Four percent at a full season's work, and it keeps going past one -- a man at
 * a hundred and forty innings in a college spring should be visibly running on
 * fumes, and that is a coach's doing rather than the model's.
 *
 * Deliberately separate from `fatigueMultiplier`, which is what he spends
 * inside one outing. These multiply: a tired arm having a long night is both.
 */
export function armMultiplier(p: Pitcher): number {
  return 1 - Math.min(0.09, Math.max(0, armMileage(p) - 0.55) * 0.09);
}

/** Outs recorded, added to his year. */
export function threw(p: Pitcher, outs: number): void {
  const w = p as Pitcher & Worked;
  w.outs = (w.outs ?? 0) + outs;
}

/** A fresh spring for everybody. */
export function resetWorkload(p: Player): void {
  const w = p as Player & Worked;
  delete w.straight;
  delete w.outs;
}
