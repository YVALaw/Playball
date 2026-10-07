// phase4-fixes.test.ts
// Regression tests for docs/18-fix-plan.md Phase 4: performance, and the one
// lock that keeps a second press out while a sim is running (IDs refer to
// docs/17-pre-release-audit.md).

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
import { S, startCareer, simRegular, resolveHolds, flush } from './support/drive.js';

describe('SIM WEEK runs off the tap path under one lock (H4, M84)', () => {
  it('holds busy while the week plays and refuses a second press', async () => {
    startCareer(9101, 3);
    resolveHolds();
    const season = S().season!;
    const week = season.schedule[season.dayIndex]!.week;
    const run = S().simWeek();
    expect(S().busy, 'the week holds the lock while it plays').toBe(true);
    const day = season.dayIndex;
    S().advanceDay();
    await S().simWeek();
    expect(season.dayIndex, 'neither SIM GAME nor a second SIM WEEK got in').toBe(day);
    await run;
    expect(S().busy).toBe(false);
    const now = season.schedule[season.dayIndex];
    if (now && S().weekStoppedBy === null) expect(now.week).toBe(week + 1);
  });
});

describe('June can be played a night per frame (H4, M46)', () => {
  const champion = async (paced: boolean): Promise<string> => {
    startCareer(9102, 5);
    await simRegular();
    await S().playPostseason();
    for (let i = 0; i < 500 && S().phase === null; i++) {
      if (S().myBracket) {
        const gate = S().lineupGate;
        const run = S().simBracket('rest', paced);
        if (paced) {
          expect(S().busy).toBe(true);
          await run;
          expect(S().busy).toBe(false);
        }
        if (S().lineupGate !== gate) resolveHolds();
      } else S().advanceBracket();
      await flush(1);
    }
    expect(S().phase).toBe('awards');
    return JSON.stringify(S().lastPostseason ?? null);
  };

  it('ends the same June as the synchronous path', async () => {
    const sync = await champion(false);
    const paced = await champion(true);
    expect(sync).not.toBe('null');
    expect(paced).toBe(sync);
  }, 120_000);
});
