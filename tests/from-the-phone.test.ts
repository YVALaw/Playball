// from-the-phone.test.ts
//
// Thirteen reports in one message on 2026-09-16, and the ones an engine
// test can hold (05 §90). The screens' halves -- the dugout listing its
// resting arms, the regionals opening their boxes, the beat on the
// postseason button, the two-way LEGACY toggle -- are read in the browser.

import { describe, it, expect } from 'vitest';
import { recoveryGap, createSeason, simSeason } from '../src/engine/season.js';
import { boardWords, type Review } from '../src/engine/program.js';
import { proCareer, type AlumnusNote } from '../src/engine/legacy.js';
import { projectResultText } from '../src/engine/staffProjects.js';
import { visibleValue, draftContext } from '../src/engine/draft.js';
import { generateClass } from '../src/engine/recruiting.js';
import { armValue, overallOf } from '../src/engine/ratings.js';
import { isTwoWay, type Player } from '../src/engine/types.js';
import { makeRng } from '../src/engine/rng.js';
import { resetNames } from '../src/engine/players.js';

// ---------------------------------------------------------------------------
// The pen in the finals
// ---------------------------------------------------------------------------

describe("a reliever's rest", () => {
  it('costs a short outing nothing but the night', () => {
    // "I had like six bullpen arms and only two were available in the
    // finals": twenty-one pitches used to cost two calendar days, which in a
    // bracket that plays every night is the next game.
    expect(recoveryGap(12)).toBe(1);
    expect(recoveryGap(30)).toBe(1);
    expect(recoveryGap(31)).toBe(2);
    expect(recoveryGap(46)).toBe(3);
    expect(recoveryGap(66)).toBe(4);
    expect(recoveryGap(100)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// The board's words
// ---------------------------------------------------------------------------

function review(over: Partial<Review> = {}): Review {
  return {
    verdict: 'exceeded',
    expectation: { mandate: 'contend', summary: '', detail: '', targetWins: 30, objectives: [] } as unknown as Review['expectation'],
    outcome: {
      wins: 30, losses: 20, madeConferenceTournament: true, madeTournament: true,
      wonConference: false, wonRegional: false, reachedOmaha: false, wonTitle: false,
    } as unknown as Review['outcome'],
    prestigeBefore: 50, prestigeAfter: 52, prestigeReasons: [],
    coachPrestigeBefore: 40, coachPrestigeAfter: 43,
    securityBefore: 60, securityAfter: 65,
    contractYears: 3, contractLength: 4,
    extended: false, renewed: false, fired: false, notRenewed: false, spared: false,
    badRun: 0, prestigePenalty: 0,
    message: 'Nobody expected this.',
    ...over,
  };
}

const inField = { finish: 'national' as const };
const missed = { finish: 'missed' as const };

describe("the board's words", () => {
  it('does not call the sixth straight June a surprise', () => {
    // "nobody expected this after six years in a row making it to the
    // nationals doesn't really make sense."
    const w = boardWords(review(), { prior: [inField, inField, inField, inField, inField], tenure: 5, year: 2032 });
    expect(w.message).not.toContain('Nobody expected');
    expect(w.message).toContain('Sixth straight June');
    expect(w.headline).toBe('The board expects nothing less');
  });

  it('is not delighted in the same words every year', () => {
    const lines = new Set<string>();
    const heads = new Set<string>();
    for (let y = 2027; y < 2035; y++) {
      const w = boardWords(review({ outcome: { ...review().outcome, madeTournament: false } }), { prior: [missed], tenure: 2, year: y });
      lines.add(w.message);
      heads.add(w.headline);
    }
    expect(lines.size).toBeGreaterThan(2);
    expect(heads.size).toBeGreaterThan(1);
  });

  it('keeps the contract lines, which say the thing that matters', () => {
    const w = boardWords(review({ extended: true, message: 'They have torn up your deal — 4 more years.' }), { prior: [], tenure: 1, year: 2028 });
    expect(w.message).toBe('They have torn up your deal — 4 more years.');
  });

  it('names a title, a first year, and a run that is being noticed', () => {
    const title = boardWords(review({ outcome: { ...review().outcome, wonTitle: true } }), { prior: [], tenure: 3, year: 2030 });
    expect(title.headline).toBe('The board is over the moon');
    const first = boardWords(review({ outcome: { ...review().outcome, madeTournament: false } }), { prior: [], tenure: 0, year: 2027 });
    expect(first.message).toContain('first year');
    const cold = boardWords(review({ verdict: 'failed', badRun: 3, message: 'Your seat is warm. 3 years running, and it is being noticed outside this room.' }), { prior: [missed, missed], tenure: 4, year: 2031 });
    expect(cold.headline).toBe('The board is running out of patience');
    expect(cold.message).toContain('3 years running');
  });
});

// ---------------------------------------------------------------------------
// A life after college that goes on
// ---------------------------------------------------------------------------

const note = (over: Partial<AlumnusNote> = {}): AlumnusNote => ({
  name: 'T. Cole', teamAbbr: 'PSC', year: 2030, reason: 'graduated',
  overall: 58, classYear: 'SR', ...over,
});

describe('the undrafted who sign somewhere', () => {
  it('go on: another league, an affiliated club, or the day they hang them up', () => {
    // "those players that end up signing somewhere else always end up coming
    // back to coach, it could simply keep playing them there, move to
    // another league in following years or climb their way to the show."
    let abroad = 0; let moved = 0; let signed = 0; let quit = 0; let show = 0;
    for (let i = 0; i < 1500; i++) {
      const rows = proCareer(`u-${i}`, note({ overall: 50 + (i % 30) }), 2060);
      if (rows.length === 1) continue;
      abroad++;
      if (rows.some((r) => r.line.startsWith('Moved on.'))) moved++;
      if (rows.some((r) => r.line.startsWith('Signed by an affiliated club'))) signed++;
      if (rows.some((r) => r.line.includes('hung them up'))) quit++;
      if (rows.some((r) => r.level === 'THE SHOW')) show++;
      // Nothing ends twice, and a career that ended ends on a final row.
      const finals = rows.filter((r) => r.final);
      expect(finals.length).toBeLessThanOrEqual(1);
      if (finals.length === 1) expect(rows[rows.length - 1]!.final).toBe(true);
    }
    expect(abroad / 1500).toBeGreaterThan(0.12);
    expect(abroad / 1500).toBeLessThan(0.25);
    expect(moved).toBeGreaterThan(0);
    expect(signed).toBeGreaterThan(0);
    expect(quit).toBeGreaterThan(0);
    // The climb is real, and rare: a handful reach the big leagues.
    expect(show).toBeGreaterThan(0);
    expect(show / abroad).toBeLessThan(0.15);
  });

  it('reads the summer after the draft as a first one, moved or not', () => {
    // "comments like moved up to single A when the player just started their
    // pro career make it sound like they came from another pro division."
    let started = 0;
    for (let i = 0; i < 600; i++) {
      const rows = proCareer(`d-${i}`, note({ reason: 'drafted', round: 1 + (i % 20), overall: 55 + (i % 25) }), 2045);
      const first = rows[0];
      if (!first) continue;
      expect(first.line, first.line).not.toMatch(/^Moved up to|^Repeated|^A third year|^Another summer/);
      if (first.line.startsWith('Started at')) started++;
    }
    expect(started).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Whole numbers in the letter
// ---------------------------------------------------------------------------

describe('a finished project, in whole numbers', () => {
  it('rounds the two ratings and the gain', () => {
    const text = projectResultText({
      seat: 'hitting', kind: 'hitting-contact', year: 2027, week: 4, focused: true,
      playerId: 'p1', took: true,
      changes: [{ id: 'p1', name: 'Test Man', attribute: 'contact', before: 61.4, after: 64.4 }],
    } as unknown as Parameters<typeof projectResultText>[0]);
    expect(text).toContain('61 → 64');
    expect(text).toContain('+3');
    expect(text).not.toContain('.4');
  });
});

// ---------------------------------------------------------------------------
// A two-way man is priced on his better half
// ---------------------------------------------------------------------------

describe('a two-way man at the draft', () => {
  it('is never priced below his bat alone, and is priced on his arm when it is the better half', () => {
    resetNames();
    const season = createSeason(makeRng(4242));
    simSeason(season);
    const ctx = draftContext(season);
    // Two-way men come through recruiting only (at most three a class), so
    // the pool is drawn from the door rather than from the generated rosters.
    const twoWay: Player[] = [];
    for (let seed = 1; seed <= 6; seed++) {
      for (const pr of generateClass(2027 + seed, 96, makeRng(seed)).prospects) {
        if (isTwoWay(pr.player)) twoWay.push(pr.player);
      }
    }
    expect(twoWay.length).toBeGreaterThan(0);
    let armPriced = 0;
    for (const p of twoWay) {
      const priced = visibleValue(p, season, ctx);
      const batOnly = visibleValue({ ...p, twoWay: false } as unknown as Player, season, ctx);
      expect(priced).toBeGreaterThanOrEqual(batOnly - 1e-9);
      if (isTwoWay(p) && armValue(p) > overallOf(p) + 8) {
        armPriced++;
        expect(priced).toBeGreaterThan(batOnly);
      }
    }
    void armPriced;
  });
});
