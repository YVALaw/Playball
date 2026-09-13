// The archive's two display readers: what a college career adds up to, and
// which national marks a man still holds. Neither touches the simulation —
// both read rows the season already wrote — but both print numbers a player
// will trust, so the arithmetic is baseball's and the missing stays missing.
import { describe, expect, it } from 'vitest';
import { collegeSummary, marksHeldBy } from '../src/ui/ProgramBits.js';
import { playerId } from '../src/engine/types.js';
import type { SeasonState } from '../src/engine/season.js';

describe('college career totals', () => {
  it('weights the average by at bats, and finds the years whatever order the rows are in', () => {
    const summary = collegeSummary([
      { year: 2028, classYear: 'SR', team: 'TEST', ab: 100, h: 20, hr: 8, rbi: 25 },
      { year: 2026, classYear: 'SO', team: 'TEST', ab: 20, h: 10, hr: 2, rbi: 12 },
    ]);
    // 30 hits in 120, not the mean of .200 and .500.
    expect(summary.average).toBe('.250');
    expect(summary.hr).toBe(10);
    expect([summary.first, summary.last]).toEqual([2026, 2028]);
  });

  it('reads ERA off outs and prints innings in thirds, two-way careers included', () => {
    const summary = collegeSummary([
      { year: 2027, classYear: 'JR', team: 'TEST', outs: 100, er: 10, k: 35, ab: 20, h: 5 },
      { year: 2028, classYear: 'SR', team: 'TEST', outs: 1, er: 0, k: 1 },
    ]);
    // 10 earned over 101 outs: 10 * 27 / 101.
    expect(summary.era).toBe('2.67');
    expect(summary.innings).toBe('33.2');
    expect(summary.k).toBe(36);
    expect(summary.hitting && summary.pitching).toBe(true);
  });

  it('leaves a rate unknown rather than calling it zero', () => {
    const summary = collegeSummary([]);
    expect(summary.average).toBe('—');
    expect(summary.era).toBe('—');
    expect(summary.first).toBeUndefined();
    expect(summary.last).toBeUndefined();
    expect(summary.hitting || summary.pitching).toBe(false);
  });
});

describe('the marks a man still holds', () => {
  const him = playerId('him');
  const her = playerId('someone-else');
  const season = (records: Record<string, { id?: string; year: number }>) =>
    ({ records } as unknown as SeasonState);

  it('names the group, so two records called HOME RUNS are not one line twice', () => {
    const out = marksHeldBy(season({
      gameHR: { id: him, year: 2030 },
      careerHR: { id: him, year: 2032 },
    }), him);
    expect(out).toContain('GAME HOME RUNS');
    expect(out).toContain('CAREER HOME RUNS');
    expect(out).toHaveLength(2);
  });

  it('keeps the feats, which are a single afternoon like any other game mark', () => {
    expect(marksHeldBy(season({ featNoHitter: { id: him, year: 2029 } }), him))
      .toEqual(['GAME NO-HITTERS']);
  });

  it('skips a program or coach row, which belongs to nobody in particular', () => {
    expect(marksHeldBy(season({ teamSeasonWins: { id: him, year: 2029 } }), him)).toEqual([]);
  });

  it('holds nothing for a man whose name is not on the book', () => {
    expect(marksHeldBy(season({ careerHR: { id: her, year: 2031 } }), him)).toEqual([]);
  });
});
