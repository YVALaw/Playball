// Doing what you were asked never costs you the standing.
//
// Raised three times, most plainly: "I met 3 of the required mandates and
// missed 3 bonuses — how is it possible that meeting their expectations makes
// me lose prestige? That's crazy."
//
// Measured before it was touched, and he was exactly right: a cleared board and
// an uncleared one landed on the SAME number at every standing, because the
// shelter asked for a May appearance or a winning record ON TOP of the board —
// and a develop-mandate board is routinely cleared at 20-25.
//
// The hold is capped below the blue-blood band on purpose. Run to the summit it
// moved the league mean +1.2 and nearly doubled the 90+ bucket; capped, the
// carousel reads 55.9 mean against a 55.4 baseline with the top buckets
// unmoved. These pins hold both halves: the complaint is fixed, and the league
// is not inflated by fixing it.

import { describe, it, expect } from 'vitest';
import { nextPrestige } from '../src/engine/program.js';
import type { SeasonOutcome } from '../src/engine/program.js';

const season = (over: Partial<SeasonOutcome> = {}): SeasonOutcome => ({
  wins: 20, losses: 25,
  conferenceRank: 7, conferenceSize: 12,
  wonConference: false, madeTournament: false, wonRegional: false,
  reachedOmaha: false, wonTitle: false,
  ...over,
} as SeasonOutcome);

describe('a cleared board holds the standing', () => {
  it('does not fall on a quiet season the board approved of', () => {
    // The reporter's own case: mid-table, boxes ticked, record under .500.
    for (const p of [54, 61, 69]) {
      expect(nextPrestige(p, season(), true), `cleared at ${p}`).toBeGreaterThanOrEqual(p);
    }
  });

  it('still falls when the board was NOT cleared', () => {
    // The checklist has to mean something in both directions.
    for (const p of [54, 61, 69]) {
      expect(nextPrestige(p, season(), false), `uncleared at ${p}`).toBeLessThan(p);
    }
  });

  it('holds without building — a quiet year is not a promotion', () => {
    // The hold floors the fall at zero; it never drifts a program upward,
    // which is what emptied the one-star bucket the last time this widened.
    expect(nextPrestige(61, season(), true)).toBe(61);
    expect(nextPrestige(69, season(), true)).toBe(69);
  });

  it('leaves the blue bloods to the shelter they already had', () => {
    // Above 70 the sticky shelter governs, and the hold deliberately stops
    // short of it: the top of the table growing was never the complaint.
    expect(nextPrestige(75, season(), true)).toBeLessThan(75);
  });
});
