// legacy.test.ts
// Stage 13: signature moments and the professional game. Determinism and the
// cap are the load-bearing properties; the detection thresholds are pinned so
// a tuning pass cannot quietly turn every Tuesday into a shrine.

import { describe, expect, it } from 'vitest';
import {
  noteMoments, proCareer, type AlumnusNote, type Moment,
} from '../src/engine/legacy.js';

const bat = (over: Partial<{ ab: number; h: number; hr: number; rbi: number }>) =>
  ({ ab: 4, h: 1, hr: 0, rbi: 0, ...over });

const side = (
  batting: Record<string, ReturnType<typeof bat>>,
  pitching: Record<string, { outs: number; k: number; er: number }> = {},
  extra: Partial<{ hits: number; runs: number; walkOffBy: string | null }> = {},
) => ({
  batting: Object.entries(batting).map(([id, l]) => ({ id, ...l })),
  pitching: Object.entries(pitching).map(([id, l]) => ({ id, ...l })),
  hits: 8, runs: 4, ...extra,
});

const meta = { year: 2030, day: 12, vs: 'BAY' };

describe('signature moments', () => {
  it('remembers the nights worth remembering and nothing else', () => {
    const book: Record<string, Moment[]> = {};
    noteMoments(book, side({
      a: bat({ h: 5, ab: 5 }),
      b: bat({ h: 4 }),
      c: bat({ hr: 3 }),
      d: bat({ h: 2 }),          // an ordinary night
    }, { p1: { outs: 27, k: 13, er: 0 } }, { walkOffBy: 'a' }),
    side({}, {}, { hits: 0, runs: 0 }), meta);

    expect(book.a!.map((m) => m.kind).sort()).toEqual(['five', 'walkoff']);
    expect(book.b!.map((m) => m.kind)).toEqual(['four']);
    expect(book.c!.map((m) => m.kind)).toEqual(['hrs3']);
    expect(book.d).toBeUndefined();
    // One man in the pitching book, nobody hit: the no-hitter, plus the Ks.
    expect(book.p1!.map((m) => m.kind).sort()).toEqual(['ks', 'nohitter']);
  });

  it('a June night is marked as one', () => {
    const book: Record<string, Moment[]> = {};
    noteMoments(book, side({ a: bat({ h: 4 }) }), side({}),
      { ...meta, postseason: true });
    expect(book.a![0]!.postseason).toBe(true);
  });

  it('the cap drops the least of him, never the best', () => {
    const book: Record<string, Moment[]> = {};
    for (let d = 0; d < 14; d++) {
      noteMoments(book, side({ a: bat({ h: 4 }) }), side({}), { ...meta, day: d });
    }
    // One no-hitter-grade night among the noise.
    noteMoments(book, side({ a: bat({ h: 5, ab: 5 }) }), side({}), { ...meta, day: 99 });
    expect(book.a!.length).toBeLessThanOrEqual(12);
    expect(book.a!.some((m) => m.kind === 'five')).toBe(true);
  });
});

describe('the professional game', () => {
  const note = (over: Partial<AlumnusNote> = {}): AlumnusNote => ({
    name: 'T. Cole', teamAbbr: 'PSC', year: 2030, reason: 'drafted',
    round: 2, overall: 78, classYear: 'JR', ...over,
  });

  it('is derived: the same man lives the same life', () => {
    expect(proCareer('m1', note(), 2040)).toEqual(proCareer('m1', note(), 2040));
  });

  it('grows a year at a time and never rewrites the past', () => {
    const short = proCareer('m2', note(), 2033);
    const long = proCareer('m2', note(), 2040);
    expect(long.slice(0, short.length)).toEqual(short);
  });

  it('a career that ends stays ended', () => {
    for (let i = 0; i < 40; i++) {
      const rows = proCareer(`man-${i}`, note({ round: 8, overall: 58 }), 2045);
      const finals = rows.filter((r) => r.final).length;
      expect(finals).toBeLessThanOrEqual(1);
      if (finals === 1) expect(rows[rows.length - 1]!.final).toBe(true);
    }
  });

  it('first-rounders reach the show far more often than round eights', () => {
    let high = 0;
    let low = 0;
    for (let i = 0; i < 200; i++) {
      if (proCareer(`h-${i}`, note({ round: 1, overall: 84 }), 2042)
        .some((r) => r.level === 'THE SHOW')) high++;
      if (proCareer(`l-${i}`, note({ round: 8, overall: 55 }), 2042)
        .some((r) => r.level === 'THE SHOW')) low++;
    }
    expect(high).toBeGreaterThan(low * 2);
    // And washing out is what usually happens at the bottom.
    expect(low).toBeLessThan(60);
  });

  it('the undrafted get one honest line', () => {
    const rows = proCareer('g1', note({ reason: 'graduated', round: undefined }), 2035);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.final).toBe(true);
  });
});
