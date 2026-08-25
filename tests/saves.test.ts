// saves.test.ts
// More than one dynasty on one device.
//
// Everything below exists because of a single asymmetry: the save layer has
// always been able to hold any number of careers, and the app only ever wrote
// to one slot. Wiring up the other three quarters of it — list, name, delete —
// introduces the one failure mode a save layer must never have, which is a
// write landing on a file that belongs to something else. The player types a
// dynasty name; a typed name is not a key; and the distance between those two
// sentences is a career.
//
// IndexedDB is not in node, so `idb` is replaced with a Map. That is the right
// seam: `persistence.ts` uses exactly four methods of the database and the
// interesting code — which slot a save goes to, what a summary says, what a
// delete touches — is all on this side of it. `storage.test.ts` covers the other
// side, where the browser refuses to open the thing at all.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The database, as a Map keyed by slot.
 *
 * `vi.hoisted` because a `vi.mock` factory is lifted above the imports, so
 * anything it closes over has to be lifted with it.
 *
 * Values are cloned on the way in and on the way out, which is not pedantry:
 * real IndexedDB stores a structured clone, so a season mutated after a save
 * does not change what is on disk. Holding references would make the round-trip
 * tests below pass for the wrong reason.
 */
const disk = vi.hoisted(() => new Map<string, unknown>());

vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_store: string, value: { slot: string }) => {
      disk.set(value.slot, structuredClone(value));
    },
    get: async (_store: string, key: string) => {
      const found = disk.get(key);
      return found === undefined ? undefined : structuredClone(found);
    },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_store: string, key: string) => { disk.delete(key); },
  }),
}));

import {
  AUTOSAVE_SLOT, newSlotId, saveDynasty, loadDynasty, listSaves, deleteSave,
  buildSaveFile, SCHEMA_VERSION,
} from '../src/state/persistence.js';
import { useDynasty } from '../src/state/store.js';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { agoLabel } from '../src/ui/screens/Saves.js';

const world = (seed = 4242) => createSeason(makeRng(seed), undefined, CONFERENCES);

beforeEach(() => { disk.clear(); });
afterEach(() => { vi.useRealTimers(); });

describe('a slot id is not a name', () => {
  // The whole point. A player calls his dynasty whatever he likes, including
  // "auto", including nothing at all, and none of it reaches the key.

  it('never produces the autosave slot, whatever it is handed', () => {
    // Both ends of the random range and a clock at zero, because a generator
    // that is only safe for plausible inputs is not safe.
    expect(newSlotId(0, () => 0)).not.toBe(AUTOSAVE_SLOT);
    expect(newSlotId(0, () => 0.999999)).not.toBe(AUTOSAVE_SLOT);
    expect(newSlotId(Date.now(), () => 0.5)).not.toBe(AUTOSAVE_SLOT);
    for (let i = 0; i < 500; i++) expect(newSlotId()).not.toBe(AUTOSAVE_SLOT);
  });

  it('gives two saves taken in the same millisecond two different slots', () => {
    const fixed = 1_800_000_000_000;
    const ids = new Set(Array.from({ length: 200 }, () => newSlotId(fixed)));
    // A handful of collisions across two hundred draws would still be a bug:
    // one of them is a dynasty written over another one.
    expect(ids.size).toBe(200);
  });

  it('files a dynasty called "auto" somewhere other than the autosave', async () => {
    const season = world();
    await saveDynasty(AUTOSAVE_SLOT, 'Ridgemont State', season, 2031, 0);
    await saveDynasty(newSlotId(), 'auto', season, 2044, 7);

    const list = await listSaves();
    expect(list).toHaveLength(2);

    // The career the game is writing on its own is exactly as it was.
    const auto = await loadDynasty(AUTOSAVE_SLOT);
    expect(auto?.name).toBe('Ridgemont State');
    expect(auto?.year).toBe(2031);
    expect(auto?.userTeam).toBe(0);

    // And the hostile name survived intact, because it was only ever text.
    const other = list.find((s) => s.slot !== AUTOSAVE_SLOT);
    expect(other?.name).toBe('auto');
    expect(other?.year).toBe(2044);
  });

  it('keeps the typed name out of the key even through the store', async () => {
    // The same check one layer up, where the name actually comes from a text
    // field: `saveAs` is the only thing in the app that invents a slot.
    useDynasty.getState().start(4242, 0);
    await useDynasty.getState().saveNow();
    await useDynasty.getState().saveAs('auto');

    expect(disk.size).toBe(2);
    expect(disk.has(AUTOSAVE_SLOT)).toBe(true);

    await useDynasty.getState().refreshSaves();
    const { saves } = useDynasty.getState();
    expect(saves).toHaveLength(2);
    expect(saves.filter((s) => s.slot === AUTOSAVE_SLOT)).toHaveLength(1);
    expect(saves.some((s) => s.name === 'auto' && s.slot !== AUTOSAVE_SLOT)).toBe(true);
  });
});

describe('a named save is a whole dynasty', () => {
  it('comes back with the world it went in with', async () => {
    const season = world(909);
    season.dayIndex = 12;
    const slot = newSlotId();

    await saveDynasty(slot, 'Before signing day', season, 2033, 5, {
      history: [{ year: 2032 }],
      coach: { name: 'Wendell Hartsock' },
    });

    const loaded = await loadDynasty(slot);
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Before signing day');
    expect(loaded?.year).toBe(2033);
    expect(loaded?.userTeam).toBe(5);
    expect(loaded?.season.teams).toHaveLength(season.teams.length);
    expect(loaded?.season.dayIndex).toBe(12);
    // The schedule is rebuilt rather than stored, so a save that loads without
    // one is a save you cannot play.
    expect(loaded?.season.schedule.length).toBeGreaterThan(0);
    expect(loaded?.history).toHaveLength(1);
    expect((loaded?.coach as { name: string }).name).toBe('Wendell Hartsock');
  });

  it('does not move when the live season carries on without it', async () => {
    // A copy taken before a decision is only worth taking if it stops being
    // affected by what happens next.
    const season = world(909);
    const slot = newSlotId();
    await saveDynasty(slot, 'Branch', season, 2033, 5);

    season.dayIndex = 40;
    season.teams[5]!.w = 99;

    const loaded = await loadDynasty(slot);
    expect(loaded?.season.dayIndex).toBe(0);
    expect(loaded?.season.teams[5]?.w).toBe(0);
  });

  it('refuses one written by a newer build rather than loading half of it', async () => {
    const file = buildSaveFile('dyn-future', 'From the future', world(), 2033, 1);
    disk.set('dyn-future', { ...file, schemaVersion: SCHEMA_VERSION + 1 });

    await expect(loadDynasty('dyn-future')).rejects.toThrow(/newer version/i);
  });
});

describe('the list the screen prints', () => {
  /** Three saves, written minutes apart, in the order a session would make them. */
  const seed = async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const season = world(31);
    season.teams[0]!.w = 30;
    season.teams[0]!.l = 12;

    vi.setSystemTime(new Date('2026-03-01T09:00:00Z'));
    await saveDynasty('dyn-oldest', 'Opening week', season, 2027, 0);

    vi.setSystemTime(new Date('2026-03-01T10:00:00Z'));
    await saveDynasty(AUTOSAVE_SLOT, 'Ridgemont State', season, 2029, 0);

    vi.setSystemTime(new Date('2026-03-01T11:00:00Z'));
    await saveDynasty('dyn-newest', 'Before the draft', season, 2031, 0);
    return season;
  };

  it('is newest first', async () => {
    await seed();
    const list = await listSaves();
    expect(list.map((s) => s.slot)).toEqual(['dyn-newest', AUTOSAVE_SLOT, 'dyn-oldest']);
  });

  it('carries everything a row shows: name, school, year, record and when', async () => {
    const season = await seed();
    const list = await listSaves();
    const newest = list[0]!;

    expect(newest.name).toBe('Before the draft');
    // The school is read off the season rather than the name, so a dynasty
    // named by hand still says where it is being coached.
    expect(newest.school).toBe(season.teams[0]!.def.school);
    expect(newest.year).toBe(2031);
    expect(newest.record).toBe('30-12');
    expect(newest.savedAt).toBe(new Date('2026-03-01T11:00:00Z').getTime());
  });

  it('is empty on a device that has never saved, rather than throwing', async () => {
    expect(await listSaves()).toEqual([]);
  });
});

describe('delete takes one dynasty and no others', () => {
  const three = async () => {
    const season = world(77);
    await saveDynasty(AUTOSAVE_SLOT, 'Ridgemont State', season, 2027, 0);
    await saveDynasty('dyn-a', 'Branch A', season, 2028, 1);
    await saveDynasty('dyn-b', 'Branch B', season, 2029, 2);
  };

  it('removes the slot it was given', async () => {
    await three();
    await deleteSave('dyn-a');

    const left = (await listSaves()).map((s) => s.slot).sort();
    expect(left).toEqual([AUTOSAVE_SLOT, 'dyn-b']);
    expect(await loadDynasty('dyn-a')).toBeNull();
  });

  it('leaves the autosave alone', async () => {
    await three();
    await deleteSave('dyn-a');
    await deleteSave('dyn-b');

    const auto = await loadDynasty(AUTOSAVE_SLOT);
    expect(auto?.name).toBe('Ridgemont State');
    expect(auto?.year).toBe(2027);
  });

  it('is a no-op on a slot that is already gone', async () => {
    // The list and the disk can disagree — two tabs, or a stale screen — and a
    // delete that throws there would strand the player on a broken list.
    await three();
    await deleteSave('dyn-nothing-here');
    expect(await listSaves()).toHaveLength(3);
  });

  it('refreshes the store list to match, through deleteSlot', async () => {
    await three();
    await useDynasty.getState().deleteSlot('dyn-b');

    const { saves, savesError } = useDynasty.getState();
    expect(savesError).toBeNull();
    expect(saves.map((s) => s.slot).sort()).toEqual([AUTOSAVE_SLOT, 'dyn-a']);
  });
});

describe('the autosave keeps working exactly as it did', () => {
  it('is still where saveNow writes with no arguments', async () => {
    useDynasty.getState().start(4242, 0);
    await useDynasty.getState().saveNow();
    expect(disk.has(AUTOSAVE_SLOT)).toBe(true);
    expect(disk.size).toBe(1);
  });

  it('is still where loadSlot reads with no arguments', async () => {
    useDynasty.getState().start(4242, 3);
    await useDynasty.getState().saveNow();
    // Somewhere else entirely, to prove the load is not just finding the only
    // record on the disk.
    await useDynasty.getState().saveAs('A different branch');

    useDynasty.setState({ season: null, userTeam: 0, needsTeam: true });
    expect(await useDynasty.getState().loadSlot()).toBe(true);
    expect(useDynasty.getState().userTeam).toBe(3);
  });

  it('is not disturbed by a copy taken beside it', async () => {
    useDynasty.getState().start(4242, 2);
    await useDynasty.getState().saveNow();
    const before = structuredClone(disk.get(AUTOSAVE_SLOT));

    await useDynasty.getState().saveAs('Branch');
    await useDynasty.getState().deleteSlot(
      useDynasty.getState().saves.find((s) => s.slot !== AUTOSAVE_SLOT)!.slot,
    );

    expect(disk.get(AUTOSAVE_SLOT)).toEqual(before);
    expect(useDynasty.getState().saves.map((s) => s.slot)).toEqual([AUTOSAVE_SLOT]);
  });

  it('files a copy under the school when the player names it nothing', async () => {
    useDynasty.getState().start(4242, 0);
    await useDynasty.getState().saveAs('   ');

    const named = useDynasty.getState().saves.find((s) => s.slot !== AUTOSAVE_SLOT);
    expect(named?.name).toBe(named?.school);
  });
});

describe('how long ago a save was taken', () => {
  const t = new Date('2026-03-10T15:00:00').getTime();
  const ago = (ms: number) => agoLabel(t - ms, t);

  it('reads as a person would say it', () => {
    expect(ago(0)).toBe('just now');
    expect(ago(20_000)).toBe('just now');
    expect(ago(3 * 60_000)).toBe('3 minutes ago');
    expect(ago(60_000)).toBe('1 minute ago');
    expect(ago(2 * 3_600_000)).toBe('2 hours ago');
    expect(ago(1 * 3_600_000)).toBe('1 hour ago');
  });

  it('counts midnights once it is past a day, not 24 hour blocks', () => {
    // The same twenty five hours, named two different things, because what a
    // person means by "yesterday" is which midnights went past.
    expect(agoLabel(new Date('2026-03-09T08:00:00').getTime(),
      new Date('2026-03-10T09:00:00').getTime())).toBe('yesterday');
    expect(agoLabel(new Date('2026-03-08T23:30:00').getTime(),
      new Date('2026-03-10T00:30:00').getTime())).toBe('2 days ago');
    expect(ago(3 * 86_400_000)).toBe('3 days ago');
    expect(ago(10 * 86_400_000)).toBe('1 week ago');
    expect(ago(20 * 86_400_000)).toBe('2 weeks ago');
  });

  it('gives up on relative time and prints a date once it stops helping', () => {
    expect(ago(60 * 86_400_000)).toBe('on 9 Jan');
    expect(ago(400 * 86_400_000)).toBe('on 3 Feb 2025');
  });

  it('does not report a save from the future as very old', () => {
    // A clock put back an hour is not worth a message of its own, but "-60
    // minutes ago" would be.
    expect(agoLabel(t + 3_600_000, t)).toBe('just now');
  });
});
