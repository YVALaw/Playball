// legacy.test.ts
// Stage 13: signature moments and the professional game. Determinism and the
// cap are the load-bearing properties; the detection thresholds are pinned so
// a tuning pass cannot quietly turn every Tuesday into a shrine.

import { describe, expect, it } from 'vitest';
import {
  noteMoments, proCareer, COACHING_LEVEL, type AlumnusNote, type Moment,
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

  it('marks the year he reaches the show, once, and only that year', () => {
    // The inbox used to find the debut by reading the prose of the line.
    let debuts = 0;
    for (let i = 0; i < 300; i++) {
      const rows = proCareer(`d-${i}`, note({ round: 1, overall: 84 }), 2045);
      const flagged = rows.filter((r) => r.debut);
      const first = rows.findIndex((r) => r.level === 'THE SHOW');
      if (first < 0) { expect(flagged).toEqual([]); continue; }
      debuts++;
      expect(flagged.length).toBe(1);
      expect(rows[first]!.debut).toBe(true);
    }
    expect(debuts).toBeGreaterThan(0);
  });

  it('sends the undrafted home with one honest line, or somewhere small with a career', () => {
    // One line and a full stop was every undrafted man's lot; since
    // 2026-09-16 the few who sign somewhere go on from there (05 §90.11).
    let home = 0;
    let abroad = 0;
    for (let i = 0; i < 400; i++) {
      const rows = proCareer(`g-${i}`, note({ reason: 'graduated', round: undefined }), 2045);
      expect(rows.length).toBeGreaterThan(0);
      if (rows.length === 1) { home++; expect(rows[0]!.final).toBe(true); continue; }
      abroad++;
      const last = rows[rows.length - 1]!;
      expect(last.final === true || last.year === 2045).toBe(true);
    }
    expect(home / 400).toBeGreaterThan(0.6);
    expect(abroad / 400).toBeGreaterThan(0.08);
  });
});

// ---------------------------------------------------------------------------
// Some of them stay in the game
// ---------------------------------------------------------------------------
//
// Asked for 2026-09-12 in the same sentence as the college major: the alumni
// who went home should name a degree, **"and some of them become coaches."**
// The degree shipped and this did not, which is a worse failure than not
// answering at all — it left a country full of coaches in which no alumnus had
// ever become one, on a screen built to tell you what happened to your men.
//
// Found by auditing the report item by item rather than by playing, which is
// the point of doing that: a half-answered request looks answered.

describe('the ones who stay in the game', () => {
  // Its own, because the one above is scoped to that describe.
  const note = (over: Partial<AlumnusNote> = {}): AlumnusNote => ({
    name: 'T. Cole', teamAbbr: 'PSC', year: 2030, reason: 'drafted',
    round: 2, overall: 78, classYear: 'JR', ...over,
  });

  const survey = () => {
    const undrafted = { n: 0, coach: 0 };
    const drafted = { n: 0, coach: 0 };
    const byEnd = new Map<string, { n: number; coach: number }>();
    const lines = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const u = proCareer(`u-${i}`, note({ reason: 'graduated', round: undefined }), 2060);
      undrafted.n += 1;
      if (u.some((r) => r.level === COACHING_LEVEL)) {
        undrafted.coach += 1;
        lines.add(u[u.length - 1]!.line);
      }
      const p = proCareer(
        `p-${i}`,
        note({ reason: 'drafted', round: 1 + (i % 20), overall: 52 + ((i * 7) % 26) }),
        2060,
      );
      drafted.n += 1;
      const played = [...p].reverse().find((r) => r.level !== COACHING_LEVEL);
      const key = played?.level ?? '?';
      if (!byEnd.has(key)) byEnd.set(key, { n: 0, coach: 0 });
      const b = byEnd.get(key)!;
      b.n += 1;
      if (p.some((r) => r.level === COACHING_LEVEL)) {
        b.coach += 1;
        drafted.coach += 1;
        lines.add(p[p.length - 1]!.line);
      }
    }
    return { undrafted, drafted, byEnd, lines };
  };

  const s = survey();

  it('sends some of them into coaching, and not most of them', () => {
    // Measured 7.9% of undrafted seniors and 15.1% of drafted men. Banded
    // widely — the point is that it happens and stays a minority, not the
    // digit.
    const uShare = s.undrafted.coach / s.undrafted.n;
    const dShare = s.drafted.coach / s.drafted.n;
    expect(uShare, `undrafted ${(uShare * 100).toFixed(1)}%`).toBeGreaterThan(0.03);
    expect(uShare).toBeLessThan(0.15);
    expect(dShare, `drafted ${(dShare * 100).toFixed(1)}%`).toBeGreaterThan(0.08);
    expect(dShare).toBeLessThan(0.25);
  });

  it('hires the men who got further, more often', () => {
    /*
      The résumé is the qualification, and this is the assertion that says the
      rate is a model rather than a constant with a coat on. Measured: 6.6% out
      of Rookie ball, 12.0% Single-A, 13.1% Double-A, 16.8% Triple-A, 19.2% out
      of the big leagues.
    */
    const at = (k: string): number => {
      const b = s.byEnd.get(k);
      return b && b.n > 50 ? b.coach / b.n : NaN;
    };
    expect(at('THE SHOW')).toBeGreaterThan(at('DOUBLE-A'));
    expect(at('DOUBLE-A')).toBeGreaterThan(at('ROOKIE BALL'));
  });

  it('ends the career on the coaching row and only on it', () => {
    /*
      The invariant a second `final` row would break. `History`'s `last` and
      the card's timeline both stop at the first one, so a career carrying two
      would read differently depending on who read it — and the thing that
      happened last is the coaching job, not the release before it.
    */
    for (let i = 0; i < 400; i++) {
      const rows = proCareer(`f-${i}`, note({ reason: 'drafted', round: 1 + (i % 20) }), 2060);
      const finals = rows.filter((r) => r.final);
      expect(finals.length, `career f-${i} had ${finals.length} final rows`).toBe(1);
      if (rows.some((r) => r.level === COACHING_LEVEL)) {
        expect(rows[rows.length - 1]!.level).toBe(COACHING_LEVEL);
        expect(rows[rows.length - 1]!.final).toBe(true);
      }
    }
  });

  it('says more than one thing, and says the right kind of thing', () => {
    // A single sentence repeated for every alumnus in the book is the failure
    // this whole file's `ABROAD` list was written to avoid.
    expect(s.lines.size).toBeGreaterThan(5);
    for (const line of s.lines) expect(line.length).toBeGreaterThan(20);
  });

  it('is not a rung on the ladder', () => {
    /*
      `LEVELS` is the climb and is indexed by it; `level === LEVELS.length - 1`
      is how this engine asks "did he reach the big leagues". Coaching is a
      label on a row, like MEXICO or JAPAN, and adding it to that array would
      make every one of those questions answer wrong.

      Asserted as the property rather than by reaching for the array: a
      coaching row is only ever the LAST row of a career, so no man can be
      standing on it and be promoted off it.
    */
    let sawCoaching = 0;
    for (let i = 0; i < 600; i++) {
      const rows = proCareer(`l-${i}`, note({ reason: 'drafted', round: 1 + (i % 20) }), 2060);
      rows.forEach((r, at) => {
        if (r.level !== COACHING_LEVEL) return;
        sawCoaching += 1;
        expect(at, 'a coaching row that is not the last one').toBe(rows.length - 1);
      });
    }
    expect(sawCoaching, 'the survey saw no coaching at all').toBeGreaterThan(20);
  });
});
