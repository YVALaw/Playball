// phase2-fixes.test.ts
// Regression tests for docs/18-fix-plan.md Phase 2: a depth switch that
// nothing reads (audit 17 C1, H1, H8, M72, M35, M77, M34, M28, M40, M33).

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

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { suggestedStaffList } from '../src/state/store.js';
import { SYSTEMS, handles } from '../src/state/depth.js';
import { captainOf } from '../src/engine/captains.js';
import { remaining, wageBill, annualBudget, BUILDINGS, facilityUpgradeCost } from '../src/engine/economy.js';
import { hurt } from '../src/engine/injury.js';
import { injuryClock } from '../src/engine/season.js';
import { S, startCareer, flush, simRegular, playJune, rosterOf, fullYear } from './support/drive.js';
import { prestigeStars } from '../src/engine/program.js';

process.on('unhandledRejection', () => {});

describe('delegated recruiting (C1)', () => {
  it('a five-star staff suggests the top of the class, not the men nobody wanted', async () => {
    disk.clear();
    startCareer(4242, 0, { mode: 'casual' });
    const top = [...S().season!.teams].sort((a, b) => b.prestige - a.prestige)[0]!.index;
    startCareer(4242, top, { mode: 'casual' });
    await flush();
    for (let i = 0; i < 80 && S().season!.recruiting.week < 1; i++) S().advanceDay();
    const s = S();
    const list = suggestedStaffList(s.season, s.userTeam, s.coach, s.economy, s.phase);
    const stars = list.map((id) => s.season!.recruiting.prospects.find((p) => p.id === id)!.stars);
    expect(stars.length).toBeGreaterThan(0);
    expect(stars.filter((n) => n >= 4).length, `suggested ${stars.join(',')}`).toBeGreaterThanOrEqual(3);
  }, 120_000);
});

describe('a delegated staff signs a class like its tier (C1, measured)', () => {
  // Measured 2026-10-06 over two seeds: a delegated five-star staff signed
  // 8 men at 3.6 stars a man against its peers' 8 at 4.0-4.2. It used to sign
  // only what nobody else wanted.
  it('a five-star staff working its suggested list signs a full, strong class', async () => {
    disk.clear();
    startCareer(4242, 0, { mode: 'casual' });
    const top = [...S().season!.teams].sort((a, b) => b.prestige - a.prestige)[2]!.index;
    startCareer(4242, top, { mode: 'casual' });
    S().setDepthSystem('recruiting', false);
    for (let i = 0; i < 80 && S().season!.recruiting.week < 1; i++) S().advanceDay();
    const st = S();
    st.setStaffList(suggestedStaffList(st.season, st.userTeam, st.coach, st.economy, st.phase));
    let mine: number[] = [];
    let peers = 0;
    await fullYear((phase) => {
      if (phase !== 'signing') return;
      const s = S().season!;
      const tier = prestigeStars(s.teams[top]!.prestige);
      mine = s.recruiting.prospects.filter((p) => p.signedBy === top).map((p) => p.stars);
      const others = s.teams.filter((t) => t.index !== top && prestigeStars(t.prestige) === tier);
      peers = others.reduce((n, t) => n + s.recruiting.prospects.filter((p) => p.signedBy === t.index).length, 0) / others.length;
    });
    expect(mine.length, 'within two of its peers').toBeGreaterThanOrEqual(Math.floor(peers) - 2);
    expect(mine.reduce((a, b) => a + b, 0) / mine.length, `signed ${mine.join(',')}`).toBeGreaterThanOrEqual(3.3);
  }, 240_000);
});

describe('a delegated portal (H1)', () => {
  it('leaves the national pool for the other programs to shop', async () => {
    disk.clear();
    startCareer(2024, 40, { mode: 'casual' });
    await flush();
    await simRegular();
    await playJune();
    for (let i = 0; i < 12 && S().phase !== 'portal'; i++) await S().nextPhase(S().phase!);
    expect(S().phase).toBe('portal');
    const pool = S().portal!.available.map((m) => String(m.player.id));
    expect(pool.length, 'the pool is kept').toBeGreaterThan(0);
    expect(S().takeFromPortal(S().portal!.available[0]!.player.id as never), 'not the coach\'s to sign').toBe(false);
    await S().nextPhase('portal');
    await flush();
    const me = S().userTeam;
    const moved = S().season!.teams.filter((t) => t.index !== me)
      .flatMap((t) => rosterOf(t).map((p) => String(p.id))).filter((id) => pool.includes(id));
    expect(moved.length, 'rival staffs signed from it').toBeGreaterThan(0);
  }, 240_000);
});

describe('a hurt starter holds the day only for a coach who can answer it (H8)', () => {
  const hurtAndPlay = (): number => {
    const season = S().season!;
    const starter = season.teams[S().userTeam]!.team.lineup[0]!;
    hurt(starter, injuryClock(season), 'a sprained wrist', 20);
    const day = season.dayIndex;
    for (let i = 0; i < 3; i++) S().advanceDay();
    return S().season!.dayIndex - day;
  };

  it('with lineups delegated, the staff covers and the days pass', () => {
    disk.clear();
    startCareer(4242, 5, { mode: 'casual' });
    S().setDepthSystem('depthChart', true);
    expect(hurtAndPlay()).toBeGreaterThan(0);
  });

  it('with injury replacements handed to the staff, a card-writing coach is not held', () => {
    disk.clear();
    startCareer(4242, 5);
    S().setDepthSystem('depthChart', false);
    expect(hurtAndPlay()).toBeGreaterThan(0);
  });

  it('a coach who keeps both is still asked', () => {
    disk.clear();
    startCareer(4242, 5);
    expect(hurtAndPlay()).toBe(0);
  });
});

describe('every switch in Settings has something that reads it (root cause E)', () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
    const path = join(dir, f);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(f) ? [path] : [];
  });
  const source = files('src').filter((f) => !f.endsWith('Settings.tsx'))
    .map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const row of SYSTEMS.filter((r) => !r.comingIn)) {
    it(`'${row.label}' is read outside the Settings row`, () => {
      expect(new RegExp(`handles\\([^;]*?'${row.key}'\\)`).test(source)).toBe(true);
    });
  }
});

describe('the switches that did nothing (M72, M35, M33)', () => {
  it('coaching points handed to the staff go onto his strongest suit', async () => {
    disk.clear();
    startCareer(4242, 5);
    S().setDepthSystem('skillPoints', false);
    expect(handles(S().depth, 'skillPoints')).toBe(false);
    const before = { ...S().coach.skills };
    const strongest = (Object.keys(before) as (keyof typeof before)[])
      .reduce((a, b) => (before[b] > before[a] ? b : a));
    await simRegular();
    await playJune();
    for (let i = 0; i < 4 && S().phase !== 'coach'; i++) await S().nextPhase(S().phase!);
    expect(S().coach.skillPoints, 'nothing left to spend by hand').toBe(0);
    expect(S().coach.skills[strongest]).toBeGreaterThan(before[strongest]);
  }, 240_000);

  it('draft conversations handed to the staff are had, as rival staffs have them', async () => {
    disk.clear();
    startCareer(9001, 0);
    S().setDepthSystem('draftTalk', false);
    await simRegular();
    await playJune();
    for (let i = 0; i < 6 && S().phase !== 'draft'; i++) await S().nextPhase(S().phase!);
    const board = S().season!.draft!;
    expect(board.men.length).toBeGreaterThan(0);
    expect(board.spent, 'the staff put money behind a case').toBeGreaterThan(0);
    expect(board.men.some((m) => m.outcome !== 'pending')).toBe(true);
  }, 240_000);

  it('a casual career has a captain without being asked to name one', () => {
    disk.clear();
    startCareer(4242, 5, { mode: 'casual' });
    expect(handles(S().depth, 'captains')).toBe(false);
    expect(captainOf(S().season!.teams[S().userTeam]!.team)).not.toBeNull();
  });

  it('the athletic director leaves room in the budget to build', () => {
    disk.clear();
    startCareer(4242, 5, { mode: 'casual' });
    // A year's money, less the wages he signed, still pays for a building.
    const eco = S().economy;
    const prestige = S().season!.teams[S().userTeam]!.prestige;
    const cheapest = Math.min(...BUILDINGS.map((b) => facilityUpgradeCost(b.key, 1)));
    expect(annualBudget(prestige) - wageBill(eco.staff)).toBeGreaterThanOrEqual(cheapest);
    expect(remaining(eco, prestige)).toBeGreaterThanOrEqual(cheapest);
  });
});
