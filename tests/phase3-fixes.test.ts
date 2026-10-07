// phase3-fixes.test.ts
// Regression tests for docs/18-fix-plan.md Phase 3: recruiting, June and
// game-sim correctness (IDs refer to docs/17-pre-release-audit.md).

import { describe, it, expect, vi } from 'vitest';

const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_s: string, v: { slot: string }) => { disk.set(v.slot, structuredClone(v)); },
    get: async (_s: string, k: string) => { const f = disk.get(k); return f === undefined ? undefined : structuredClone(f); },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_s: string, k: string) => { disk.delete(k); },
  }),
}));
process.on('unhandledRejection', () => {});
import {
  generateClass, closeWeek, scholarshipsPledged, askBlocked, SCHOLARSHIPS,
} from '../src/engine/recruiting.js';
import { makeRng } from '../src/engine/rng.js';

describe('a full class walks away from the board (H6)', () => {
  it('a program with every scholarship spent no longer leads anybody', () => {
    const recruits = generateClass(2030, 96, makeRng(5));
    const full = 7;
    for (const p of recruits.prospects.slice(0, SCHOLARSHIPS)) p.signedBy = full;
    const open = recruits.prospects.slice(SCHOLARSHIPS, SCHOLARSHIPS + 20);
    for (const p of open) p.points = { [full]: 500, 3: 10 };
    closeWeek(recruits, makeRng(1), false);
    for (const p of open) {
      expect(p.points[full], 'its interest is withdrawn').toBeUndefined();
      expect(p.signedBy === full).toBe(false);
    }
    // And the man the second program leads is now askable by it.
    const man = open.find((p) => p.signedBy === null)!;
    man.points[3] = 999;
    recruits.week = 5;
    expect(askBlocked(man, 3, 5, false)).not.toBe('Somebody else is ahead of you. Take the lead first.');
  });
});

describe('the last scholarship is given once (M88)', () => {
  it('a yes this week counts as a scholarship given', () => {
    const recruits = generateClass(2030, 96, makeRng(6));
    const me = 4;
    for (const p of recruits.prospects.slice(0, SCHOLARSHIPS - 1)) p.signedBy = me;
    expect(scholarshipsPledged(recruits.prospects, me)).toBe(SCHOLARSHIPS - 1);
    const yes = recruits.prospects[SCHOLARSHIPS]!;
    yes.weekActions = { [me]: { major: { kind: 'ask', success: true } } } as never;
    expect(scholarshipsPledged(recruits.prospects, me)).toBe(SCHOLARSHIPS);
  });
});

import { bankRedshirt, staffRedshirts } from '../src/engine/redshirt.js';
import { explicitRecruitPromiseBroken } from '../src/engine/morale.js';
import { availableRecruitPromises } from '../src/engine/recruiting.js';
import { entersPortal } from '../src/engine/portal.js';
import { makeTeam } from '../src/engine/roster.js';

describe('recruiting promises (M61, M62, M64, M30)', () => {
  const team = () => makeTeam(makeRng(11), 'T', 50);

  it('a NO REDSHIRT promise is broken by a redshirt, even after the year is banked (M64)', () => {
    const p = team().bench[0]!;
    p.recruitPromise = { kind: 'noRedshirt', madeYear: 1 };
    (p as typeof p & { redshirt?: boolean }).redshirt = true;
    bankRedshirt(p);
    expect((p as typeof p & { redshirt?: boolean }).redshirt).toBeUndefined();
    expect(explicitRecruitPromiseBroken(p)).toBe(true);
  });

  it('the staff never redshirts a freshman it promised would play (M61)', () => {
    const t = team();
    const freshmen = [...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen].filter((p) => p.classYear === 'FR');
    for (const p of freshmen) p.recruitPromise = { kind: 'noRedshirt', madeYear: 1 };
    expect(staffRedshirts(t, () => 5)).toEqual([]);
  });

  it('a pitcher is not offered STAY AT YOUR POSITION (M62)', () => {
    const t = team();
    expect(availableRecruitPromises(t.rotation[0]!)).not.toContain('keepPosition');
    expect(availableRecruitPromises(t.lineup[0]!)).toContain('keepPosition');
  });

  it('a freshman who sat his redshirt year is not judged buried (M30)', () => {
    const t = team();
    const men = [...t.bench, ...t.lineup].filter((p) => p.classYear !== 'SR');
    const at = { squadRank: 3, starts: 0, games: 50, year: 2030, seed: 3 };
    const buriedBefore = men.filter((p) => entersPortal(p, at)).length;
    for (const p of men) { p.classYear = 'FR'; (p as typeof p & { redshirtsUsed?: number }).redshirtsUsed = 1; }
    const after = men.filter((p) => entersPortal(p, at)).length;
    expect(after).toBeLessThanOrEqual(buriedBefore);
  });
});

import { S, startCareer, simRegular, playJune, fullYear } from './support/drive.js';
import { currentDay, firstPostseasonDay, createSeason, configForRules, DEFAULT_RULES } from '../src/engine/season.js';
import { recordSchoolAnnals } from '../src/engine/postseason.js';
import { CONFERENCES } from '../src/data/schools.js';

describe('June on one calendar (H5, M76)', () => {
  it('a June played through the store, with the coach in it, takes about a month', async () => {
    disk.clear();
    startCareer(9001, 0);
    await simRegular();
    const first = firstPostseasonDay(S().season!);
    await playJune();
    // It used to run 109 nights: seven conference tournaments one after
    // another before yours, the regionals in sequence, no breaks.
    expect(currentDay(S().season!) - first).toBeLessThanOrEqual(35);
    expect(S().lastPostseason?.finish[0]).toBeDefined();
  }, 240_000);
});

describe('records agree with themselves (M60, M10)', () => {
  it('the career total is the sum of its seasons, and a yearbook names the coach who coached', async () => {
    disk.clear();
    startCareer(4242, 5);
    const before = new Map(S().season!.teams.map((t) => [t.index, t.coach?.name]));
    await fullYear();
    const rows = S().history;
    expect(rows.reduce((n, r) => n + r.w, 0)).toBe(S().coach.careerWins);
    expect(rows.reduce((n, r) => n + r.l, 0)).toBe(S().coach.careerLosses);
    const year = rows[rows.length - 1]!.year;
    const moved = S().season!.teams.filter((t) => t.index !== S().userTeam && before.get(t.index) !== t.coach?.name);
    for (const t of moved) {
      const entry = (t.annals ?? []).find((a) => a.year === year);
      if (entry && before.get(t.index)) expect(entry.coach, t.def.abbr).toBe(before.get(t.index));
    }
  }, 240_000);

  it('the yearbook credits the coach stamped before the carousel, not his successor (M10)', () => {
    const season = createSeason(makeRng(8), configForRules(DEFAULT_RULES), CONFERENCES);
    const t = season.teams[3]!;
    t.seasonCoach = 'The Man Who Coached';
    t.coach = { ...(t.coach ?? {}), name: 'The Man Hired In June' } as never;
    recordSchoolAnnals(season, 2031, null, 0, 'You');
    expect(t.annals!.find((a) => a.year === 2031)!.coach).toBe('The Man Who Coached');
    expect(t.seasonCoach).toBeUndefined();
  });
});
