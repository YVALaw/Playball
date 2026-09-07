// national-poll.test.ts
// One national table, read by two screens.
//
// The desk chip on Today printed a rank straight off `rpiOrder`, while the
// rankings screen drew a projection for the opening fortnight. After one
// win a two-star program was therefore told it was first in the country on
// the same day the rankings screen said the poll had not started. The order
// lives in the engine now; these are the promises that keep it there.

import { describe, expect, it } from 'vitest';
import { createSeason, simNextDay, nationalOrder, nationalRank, pollIsProjected, rpiOrder, POLL_GAMES_PER_TEAM } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { rosterStrength } from '../src/engine/program.js';

const fresh = (seed = 21) => createSeason(makeRng(seed), undefined, CONFERENCES);

describe('the national poll', () => {
  it('is a projection until the country has a fortnight behind it', () => {
    const season = fresh();
    expect(pollIsProjected(season)).toBe(true);
    // The projection is what the rosters are worth, with a thumb of prestige.
    const table = nationalOrder(season);
    expect(table).toHaveLength(season.teams.length);
    expect(table.every((r) => r.projected)).toBe(true);
    const top = table[0]!;
    const expected = rosterStrength(top.team.team) * 0.75 + top.team.prestige * 0.25;
    expect(top.value).toBeCloseTo(expected, 6);
    // Sorted, best first.
    for (let i = 1; i < table.length; i++) {
      expect(table[i - 1]!.value).toBeGreaterThanOrEqual(table[i]!.value);
    }
  });

  it('never hands out a number one nobody has earned in the first week', () => {
    const season = fresh();
    // One day of results is not a season: a program that won once must not be
    // ranked first in the country off a perfect record.
    simNextDay(season);
    expect(season.results.length).toBeGreaterThan(0);
    expect(pollIsProjected(season)).toBe(true);
    const first = nationalOrder(season)[0]!;
    // The leader is the best roster in the land, not whoever the tiebreak liked.
    const best = [...season.teams]
      .sort((a, b) => (rosterStrength(b.team) * 0.75 + b.prestige * 0.25)
        - (rosterStrength(a.team) * 0.75 + a.prestige * 0.25))[0]!;
    expect(first.team.index).toBe(best.index);
  });

  it('gives way to the real table once the results mean something', () => {
    const season = fresh();
    let guard = 0;
    while (pollIsProjected(season) && guard < 60) { simNextDay(season); guard++; }
    expect(pollIsProjected(season)).toBe(false);
    expect(season.results.length).toBeGreaterThanOrEqual(season.teams.length * POLL_GAMES_PER_TEAM);
    const table = nationalOrder(season);
    const rpi = rpiOrder(season);
    expect(table.map((r) => r.team.index)).toEqual(rpi.map((r) => r.team.index));
    expect(table.every((r) => !r.projected)).toBe(true);
  });

  it('ranks one program the same way the whole table does, at every stage', () => {
    const season = fresh(7);
    for (const _ of [0, 1]) {
      const table = nationalOrder(season);
      for (const t of season.teams) {
        const at = table.findIndex((r) => r.team.index === t.index);
        expect(nationalRank(season, t.index)).toBe(at + 1);
      }
      // Play into the real table and ask again.
      let guard = 0;
      while (pollIsProjected(season) && guard < 60) { simNextDay(season); guard++; }
    }
  });
});
