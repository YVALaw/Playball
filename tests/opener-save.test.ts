// opener-save.test.ts
//
// The season opener survives a save. Reported 2026-09-16: "if I go outside
// the app while the starting of the season board card [is up] and then go
// back in, the board card no longer shows up and doesn't give you the option
// to accept the mandate." It was transient; a phone that reloaded the page
// lost the ceremony (05 §90.10). Its own file because it needs a database.

import { describe, it, expect, vi } from 'vitest';
import { useDynasty } from '../src/state/store.js';

// IndexedDB is not in node; the same Map-backed stand-in the saves suite uses.
const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_store: string, value: { slot: string }) => { disk.set(value.slot, structuredClone(value)); },
    get: async (_store: string, key: string) => {
      const found = disk.get(key);
      return found === undefined ? undefined : structuredClone(found);
    },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_store: string, key: string) => { disk.delete(key); },
  }),
}));

describe('the season opener', () => {
  it('is in the file, and comes back with the dynasty', async () => {
    useDynasty.getState().start(4242, 0);
    const opener = {
      year: 2028, headline: 'The board is delighted', message: 'Nobody expected this.',
      schoolBefore: 40, schoolAfter: 44, coachBefore: 30, coachAfter: 33,
      askSummary: 'Win the league', askDetail: 'They want the league.', targetWins: 24,
      stings: ['A. Man went into the hall of fame.'],
    };
    useDynasty.setState({ seasonOpener: opener });
    expect(await useDynasty.getState().saveNow('opener-slot')).toBe(true);
    useDynasty.setState({ seasonOpener: null });
    expect(await useDynasty.getState().loadSlot('opener-slot')).toBe(true);
    expect(useDynasty.getState().seasonOpener).toEqual(opener);

    // And gone once accepted: the next save carries nothing.
    useDynasty.getState().dismissSeasonOpener();
    expect(await useDynasty.getState().saveNow('opener-slot')).toBe(true);
    useDynasty.setState({ seasonOpener: opener });
    expect(await useDynasty.getState().loadSlot('opener-slot')).toBe(true);
    expect(useDynasty.getState().seasonOpener).toBeNull();
  });
});
