// save-index.test.ts
// Phase 4 (docs/18-fix-plan.md): the saves menu reads one small index rather
// than every career (audit 17, M51), and autosaves coalesce (M43). The idb
// double here lists its keys, as a real database does, so the index is live.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const disk = vi.hoisted(() => new Map<string, unknown>());
const reads = vi.hoisted(() => ({ get: [] as string[], put: [] as string[] }));
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_s: string, v: { slot: string }) => { reads.put.push(v.slot); disk.set(v.slot, structuredClone(v)); },
    get: async (_s: string, k: string) => {
      reads.get.push(k);
      const f = disk.get(k); return f === undefined ? undefined : structuredClone(f);
    },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    getAllKeys: async () => [...disk.keys()],
    delete: async (_s: string, k: string) => { disk.delete(k); },
  }),
}));
process.on('unhandledRejection', () => {});
import { listSaves, deleteSave } from '../src/state/persistence.js';
import { setAutosaveDelay } from '../src/state/store.js';
import { S, startCareer, flush } from './support/drive.js';

const careerWrites = (): string[] => reads.put.filter((k) => !k.startsWith('§') && !k.endsWith('~prev'));

beforeEach(() => { disk.clear(); reads.get.length = 0; reads.put.length = 0; });

describe('the saves menu reads the index, not the careers (M51)', () => {
  it('lists every save without opening one, and heals around files it never saw', async () => {
    startCareer(9201, 2);
    await flush();
    disk.clear();
    await S().saveNow('a', 'First');
    await S().saveNow('b', 'Second');
    reads.get.length = 0;
    const rows = await listSaves();
    expect(rows.map((r) => r.name).sort()).toEqual(['First', 'Second']);
    expect(reads.get.filter((k) => k === 'a' || k === 'b'), 'no full file was read').toEqual([]);

    // A file written behind the index's back (an older build) is read once.
    disk.set('c', { ...structuredClone(disk.get('a') as object), slot: 'c', name: 'Old' });
    reads.get.length = 0;
    expect((await listSaves()).map((r) => r.name).sort()).toEqual(['First', 'Old', 'Second']);
    expect(reads.get.filter((k) => k === 'c')).toEqual(['c']);
    reads.get.length = 0;
    await listSaves();
    expect(reads.get.filter((k) => k === 'c'), 'and only once').toEqual([]);

    await deleteSave('b');
    disk.delete('a');
    expect((await listSaves()).map((r) => r.name)).toEqual(['Old']);
  });
});

describe('autosaves coalesce (M43)', () => {
  it('a burst of changes is one write, and flushing writes it now', async () => {
    startCareer(9202, 4);
    await flush();
    reads.put.length = 0;
    setAutosaveDelay(40);
    try {
      for (let i = 0; i < 6; i++) S().autosave();
      expect(reads.put).toEqual([]);
      await new Promise((r) => setTimeout(r, 80));
      await flush();
      expect(careerWrites()).toHaveLength(1);

      reads.put.length = 0;
      S().autosave();
      S().flushAutosave();
      await flush();
      expect(careerWrites()).toHaveLength(1);
      await new Promise((r) => setTimeout(r, 80));
      expect(careerWrites(), 'the flushed save is not written twice').toHaveLength(1);
    } finally {
      setAutosaveDelay(0);
    }
  });
});
