// habits.ts
// What a coach does, counted.
//
// Two badges come out of the interview. The rest are earned by how a career is
// actually played — which means the game has to watch, and this is what it
// watches with.
//
// ---------------------------------------------------------------------------
// Hidden counters, seeded thresholds
// ---------------------------------------------------------------------------
//
// Nobody is told how many mound visits is enough, and the number is different
// in every save. That one decision does two jobs: it kills farming, because a
// target you cannot see is a target you cannot grind at, and it adds replay
// variety for free, because the same style of play earns its badges at
// different points in two different careers.
//
// The bases below are deliberately high. A badge should describe a career
// rather than reward a fortnight, so most of these are two or three seasons of
// consistent behaviour.
//
// ---------------------------------------------------------------------------
// Every badge has a counter
// ---------------------------------------------------------------------------
//
// Learned the expensive way one piece earlier in this stage: `Builder` shipped
// as a title nobody could earn, because the number behind it was never recorded
// for ninety-five of the ninety-six careers. A badge with no counter is
// decoration, so `tests/habits.test.ts` asserts that every earned badge names a
// habit that exists and that every habit is reachable.

import type { Rng } from './types.js';

/**
 * The ten things a career is measured on.
 *
 * Sparse on purpose — an absent key is zero, and a save written before this
 * existed has none of them rather than a wrong reading of all ten.
 */
export interface CoachHabits {
  /** Games taken personally rather than handed to the bench coach. */
  managed?: number;
  /** Trips to the mound, and arms brought in by hand. */
  pen?: number;
  /** Steals, bunts and hit-and-runs called. */
  aggressive?: number;
  /** Wire stories actually opened. */
  wire?: number;
  /** Men talked out of the draft. */
  talkedDown?: number;
  /** Freshmen given a real season rather than a uniform. */
  freshmen?: number;
  /** Walk-ons still on the roster at the end of a year. */
  walkOns?: number;
  /** Won after trailing in the seventh or later. */
  comebacks?: number;
  /** Won on the road against a team ranked above you. */
  roadUpsets?: number;
  /** Seasons finished above what the board asked for. */
  overachieved?: number;
}

export type HabitKey = keyof CoachHabits;

/**
 * What each badge is watching, and roughly how much of it.
 *
 * The base is the middle of the range; the threshold in a given save is this
 * multiplied by 0.8 to 1.25, fixed by the world seed. See `badgeThreshold`.
 */
export const BADGE_HABIT: Record<string, { habit: HabitKey; base: number }> = {
  ironman: { habit: 'managed', base: 110 },
  penhand: { habit: 'pen', base: 90 },
  smallball: { habit: 'aggressive', base: 180 },
  newsman: { habit: 'wire', base: 70 },
  talker: { habit: 'talkedDown', base: 5 },
  youth: { habit: 'freshmen', base: 14 },
  loyalist: { habit: 'walkOns', base: 9 },
  comeback: { habit: 'comebacks', base: 22 },
  roadman: { habit: 'roadUpsets', base: 11 },
  overachiever: { habit: 'overachieved', base: 4 },
};

/**
 * How much of a habit this particular save asks for.
 *
 * Derived from the world seed and the badge id, so it is stable for a career
 * and different between careers. Never below the base times 0.8 — the spread
 * exists to stop the number being *known*, not to make a badge cheap.
 */
export function badgeThreshold(id: string, worldSeed: number): number {
  const spec = BADGE_HABIT[id];
  if (!spec) return Infinity;
  /*
    A small integer hash of the pair.

    Deliberately not drawn from the season generator. Asking what a threshold is
    must never move the world — a screen that displayed a badge's progress would
    otherwise change every number downstream of it, which is the same rule the
    wire and the play-by-play already keep.
  */
  let h = (worldSeed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  }
  const spread = 0.8 + (h % 46) / 100;
  return Math.max(1, Math.round(spec.base * spread));
}

/** Add to a counter without caring whether it existed. */
export function note(habits: CoachHabits, key: HabitKey, n = 1): CoachHabits {
  return { ...habits, [key]: (habits[key] ?? 0) + n };
}

/**
 * Which badges a career has just earned.
 *
 * Returns only the *new* ones, so a caller can announce them. Permanent by
 * construction — nothing here takes one back — and the five-badge cap is
 * applied by the caller rather than here, because a coach whose card is full
 * has still earned the sixth and the game should say so.
 */
export function earnedBadges(
  habits: CoachHabits,
  already: readonly string[],
  worldSeed: number,
): string[] {
  const out: string[] = [];
  for (const [id, spec] of Object.entries(BADGE_HABIT)) {
    if (already.includes(id)) continue;
    if ((habits[spec.habit] ?? 0) >= badgeThreshold(id, worldSeed)) out.push(id);
  }
  return out;
}

/** A plausible career's worth of habits, for a test that has not played one. */
export function habitsFor(rng: Rng, scale = 1): CoachHabits {
  const out: CoachHabits = {};
  for (const spec of Object.values(BADGE_HABIT)) {
    out[spec.habit] = Math.round(rng() * spec.base * 2 * scale);
  }
  return out;
}
