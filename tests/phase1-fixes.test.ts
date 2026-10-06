// phase1-fixes.test.ts
// Regression tests for docs/18-fix-plan.md Phase 1 that audit-known-bugs.test.ts
// does not already carry: the save path (audit 17 M41, M55, M37), the winter's
// re-entry (M93, M74) and the guards on the day (M71, M105).

import { describe, it, expect, vi, afterEach } from 'vitest';

const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_s: string, v: { slot: string }) => { disk.set(v.slot, structuredClone(v)); },
    get: async (_s: string, k: string) => { const f = disk.get(k); return f === undefined ? undefined : structuredClone(f); },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_s: string, k: string) => { disk.delete(k); },
  }),
}));

import { useDynasty } from '../src/state/store.js';
import { BACKUP_AGE_MS, backupSlotOf, listSaves } from '../src/state/persistence.js';
import { ceremonyOf } from '../src/engine/postseason.js';
import { S, startCareer, flush, simRegular, playJune } from './support/drive.js';

process.on('unhandledRejection', () => {});
const useDynastySet = (patch: Partial<ReturnType<typeof useDynasty.getState>>): void => useDynasty.setState(patch);
afterEach(() => { vi.useRealTimers(); });

describe('a career keeps one generation back (M41)', () => {
  it('keeps the older record, hides it from the list, and offers it when the file will not open', async () => {
    disk.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-01-01T10:00:00Z'));
    startCareer(4242, 5);
    await flush();
    await S().saveNow();
    const slot = S().loadedSlot!;
    expect(disk.has(backupSlotOf(slot)), 'a burst of saves keeps no copy').toBe(false);

    S().advanceDay();
    vi.setSystemTime(Date.now() + BACKUP_AGE_MS + 1000);
    await S().saveNow();
    expect(disk.has(backupSlotOf(slot))).toBe(true);
    expect((await listSaves()).map((x) => x.slot)).toEqual([slot]);

    // The career's own record comes out wrong.
    const bad = disk.get(slot) as { season: { teams: unknown[] } };
    bad.season.teams = [];
    disk.set(slot, bad);
    S().backToStart();
    expect(await S().loadSlot(slot)).toBe(false);
    expect(S().backupFor?.slot).toBe(slot);

    expect(await S().loadBackup(slot)).toBe(true);
    expect(S().loadedSlot, 'the copy carries on as the career').toBe(slot);
    expect(S().backupFor).toBeNull();
    expect(await S().saveNow()).toBe(true);
    expect(await S().loadSlot(slot)).toBe(true);
  }, 120_000);

  it('deleting a career deletes its kept copy', async () => {
    disk.clear();
    startCareer(4242, 5);
    await S().saveNow();
    const slot = S().loadedSlot!;
    disk.set(backupSlotOf(slot), { ...(disk.get(slot) as object), slot: backupSlotOf(slot) });
    await S().deleteSlot(slot);
    expect(disk.has(backupSlotOf(slot))).toBe(false);
  }, 60_000);
});

describe('a save keeps its name (M55, M37)', () => {
  it('a named copy, once opened and played, is still called what it was called', async () => {
    disk.clear();
    startCareer(4242, 5);
    await S().saveNow();
    await S().saveAs('Before the big trade');
    const copy = (await listSaves()).find((x) => x.name === 'Before the big trade')!;
    expect(await S().loadSlot(copy.slot)).toBe(true);
    S().advanceDay();
    await S().saveNow();
    expect((await listSaves()).find((x) => x.slot === copy.slot)?.name).toBe('Before the big trade');
  }, 60_000);

  it('forking a sandbox leaves one original and one sandbox that stays labelled', async () => {
    disk.clear();
    startCareer(4242, 5);
    await S().saveNow();
    expect(await S().godForkToSandbox()).toBe(true);
    S().advanceDay();
    await S().saveNow();
    const list = await listSaves();
    expect(list.length).toBe(2);
    const sandbox = list.find((x) => x.sandbox);
    expect(sandbox?.slot).toBe(S().loadedSlot);
    expect(sandbox?.name).toMatch(/sandbox/);
  }, 60_000);
});

describe('the winter can be walked back into (M93, M74)', () => {
  it('awards revisited after the draft name the ceremony\'s winners, and a dismissed review still writes the terms', async () => {
    disk.clear();
    startCareer(4242, 5);
    await flush();
    await simRegular();
    await playJune();
    const season = S().season!;
    const held = ceremonyOf(season, S().userTeam, S().lastPostseason).awards.map((a) => `${a.title}:${a.id}`);
    expect(held.length).toBeGreaterThan(0);
    for (let i = 0; i < 12 && S().phase !== 'signing'; i++) {
      if (S().phase === 'review' || S().phase === 'coach') S().clearReview();
      await S().nextPhase(S().phase!);
    }
    expect(S().phase).toBe('signing');
    expect(ceremonyOf(S().season!, S().userTeam, S().lastPostseason).awards.map((a) => `${a.title}:${a.id}`)).toEqual(held);
    expect(S().lastReview, 'the dismissed review is kept for the roll').not.toBeNull();
    await S().nextPhase('signing');
    await flush();
    expect(S().phase).toBeNull();
    expect(S().seasonOpener, 'next season still opens on the board\'s terms').not.toBeNull();
  }, 240_000);
});

describe('the day\'s guards (M71, M105)', () => {
  it('refuses roster and god edits while the season sims', () => {
    disk.clear();
    startCareer(555, 21, { god: true });
    const man = S().season!.teams[21]!.team.bench[0]!;
    useDynastySet({ busy: true });
    expect(S().godEditPlayer(man.id, { name: 'Edited While Busy' })).toBe(false);
    expect(S().setRedshirt(man.id, true)).toBe(false);
    useDynastySet({ busy: false });
    expect(S().godEditPlayer(man.id, { name: 'Edited After' })).toBe(true);
  });

  it('holds the day on a card with a man twice, wherever the coach is standing', () => {
    disk.clear();
    startCareer(4242, 5);
    const lineup = S().season!.teams[5]!.team.lineup;
    lineup[1]!.pos = lineup[0]!.pos;
    const day = S().season!.dayIndex;
    const gate = S().lineupGate;
    S().advanceDay();
    expect(S().season!.dayIndex, 'the day does not pass').toBe(day);
    expect(S().lineupGate).toBe(gate + 1);
  });
});
