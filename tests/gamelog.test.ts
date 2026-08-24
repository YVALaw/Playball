// gamelog.test.ts
// The player card's game log, which is the one piece of that screen that is a
// derivation rather than a rendering.
//
// It exists because the obvious implementation is name matching — the box score
// row already carries a name, and the card already has one — and in a world of
// four thousand generated players two men called the same thing is a matter of
// time, not luck. Matching on the id is the whole correctness argument, so it is
// the thing worth pinning down.

import { describe, it, expect } from 'vitest';
import { gameLogFor } from '../src/ui/screens/Player.js';
import type { BoxScore } from '../src/engine/season.js';
import { playerId } from '../src/engine/types.js';

const OURS = 3;
const THEM = 7;

const teams = [
  { def: { abbr: 'AAA' } }, { def: { abbr: 'BBB' } }, { def: { abbr: 'CCC' } },
  { def: { abbr: 'HOM' } }, { def: { abbr: 'EEE' } }, { def: { abbr: 'FFF' } },
  { def: { abbr: 'GGG' } }, { def: { abbr: 'OPP' } },
];

const mel = playerId('mel');
const twin = playerId('twin');

function box(over: Partial<BoxScore> & { day: number }): BoxScore {
  return {
    home: OURS, away: THEM,
    homeRuns: 5, awayRuns: 2, innings: 9,
    homeBatting: [], awayBatting: [], homePitching: [], awayPitching: [],
    ...over,
  };
}

describe('the game log', () => {
  it('finds a man by id, not by name', () => {
    const season = {
      teams,
      boxScores: {
        1: box({
          day: 1,
          homeBatting: [{ id: mel, name: 'Mel Ott', slot: 'RF', line: '2-4, HR' }],
          // Same name, different man, on the other side of the same game.
          awayBatting: [{ id: twin, name: 'Mel Ott', slot: 'CF', line: '0-5' }],
        }),
      },
    };

    const log = gameLogFor(season, mel, OURS);
    expect(log).toHaveLength(1);
    expect(log[0]?.line).toBe('2-4, HR');
    expect(log[0]?.slot).toBe('RF');
  });

  it('reads the result from our side of the score', () => {
    const season = {
      teams,
      boxScores: {
        // At home and won.
        1: box({
          day: 1,
          homeBatting: [{ id: mel, name: 'Mel Ott', slot: 'RF', line: '2-4' }],
        }),
        // Away and lost: the same runs, the other way round.
        4: box({
          day: 4, home: THEM, away: OURS, homeRuns: 5, awayRuns: 2,
          awayBatting: [{ id: mel, name: 'Mel Ott', slot: 'RF', line: '0-3' }],
        }),
      },
    };

    const log = gameLogFor(season, mel, OURS);
    expect(log.map((r) => [r.home, r.won, r.us, r.them, r.opponent]))
      .toEqual([[true, true, 5, 2, 'OPP'], [false, false, 2, 5, 'OPP']]);
  });

  it('is in calendar order, whatever order the save hands it over in', () => {
    const line = { id: mel, name: 'Mel Ott', slot: 'RF', line: '1-4' };
    const season = {
      teams,
      boxScores: {
        20: box({ day: 20, homeBatting: [line] }),
        3: box({ day: 3, homeBatting: [line] }),
        11: box({ day: 11, homeBatting: [line] }),
      },
    };
    expect(gameLogFor(season, mel, OURS).map((r) => r.day)).toEqual([3, 11, 20]);
  });

  it('picks up pitching appearances too', () => {
    const season = {
      teams,
      boxScores: {
        2: box({
          day: 2,
          homePitching: [{ id: mel, name: 'Mel Ott', slot: 'W', line: '6.0 IP, 2 ER, 7 K' }],
        }),
      },
    };
    expect(gameLogFor(season, mel, OURS)[0]?.line).toBe('6.0 IP, 2 ER, 7 K');
  });

  it('is empty for a man who did not dress, and for a save with no boxes', () => {
    const season = {
      teams,
      boxScores: {
        1: box({
          day: 1,
          homeBatting: [{ id: twin, name: 'Somebody Else', slot: 'CF', line: '1-4' }],
        }),
      },
    };
    expect(gameLogFor(season, mel, OURS)).toEqual([]);
    expect(gameLogFor({ teams }, mel, OURS)).toEqual([]);
  });

  it('ignores games our program was not in', () => {
    const season = {
      teams,
      boxScores: {
        1: box({
          day: 1, home: 0, away: 1,
          homeBatting: [{ id: mel, name: 'Mel Ott', slot: 'RF', line: '2-4' }],
        }),
      },
    };
    expect(gameLogFor(season, mel, OURS)).toEqual([]);
  });
});
