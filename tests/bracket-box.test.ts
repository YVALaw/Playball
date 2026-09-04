// Any match in June opens its box score.
//
// Reported twice — the second time to correct me after I read it as
// working-as-designed: "in the previous design we had it so that we could tap
// any of the matches and it would show us the box score but now it doesn't."
//
// The tap was never the problem. `boxScores` is keyed by DAY and a June day
// holds many games, and only the user's own were captured at all, so a rival's
// game had nowhere to be and nothing in it. A postseason game now carries its
// lines on the summary, which is what the bracket slot stores.
//
// Pinned at the engine seam rather than through a simulated tournament: the
// bracket lives on the STORE, so a test reaching for `season.bracket` finds
// nothing and skips itself. That is exactly the false green this file exists
// to avoid.

import { describe, it, expect } from 'vitest';
import { createSeason, playGame } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';

const SMALL = CONFERENCES.slice(0, 2);

/** A season whose user is team 0, so 3 v 4 is nothing to do with him. */
const world = () => {
  const s = createSeason(makeRng(31), undefined, SMALL);
  s.captureBoxFor = 0;
  return s;
};

describe('a June game carries its own box', () => {
  it('gives a game between two rivals the full lines', () => {
    const s = world();
    const summary = playGame(s, 3, 4, {
      conference: false, standings: true, record: true, postseason: true,
    });
    expect(summary.box, 'a rival June game had no box').toBeDefined();
    expect(summary.box!.homeBatting.length).toBeGreaterThan(0);
    expect(summary.box!.awayBatting.length).toBeGreaterThan(0);
    expect(summary.box!.homePitching.length).toBeGreaterThan(0);
    expect(summary.box!.home).toBe(3);
    expect(summary.box!.away).toBe(4);
  });

  it('does not carry lines through the regular season', () => {
    const s = world();
    const summary = playGame(s, 3, 4, { conference: true });
    // Two rivals in April are the games there are thousands of. Carrying
    // lines for them is what the day-keyed store was avoiding.
    expect(summary.box).toBeUndefined();
  });

  it('still files the user\'s own game by day, as it always did', () => {
    const s = world();
    playGame(s, 0, 4, { conference: true });
    expect(Object.keys(s.boxScores).length).toBe(1);
  });

  it('keeps the league log lean — the box rides the summary, not results', () => {
    const s = world();
    playGame(s, 3, 4, {
      conference: false, standings: true, record: true, postseason: true,
    });
    // season.results is every game all year; a second copy of June's lines
    // there would land in every save.
    expect(s.results.filter((r) => r.box !== undefined).length).toBe(0);
  });
});
