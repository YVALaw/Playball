// offseason-reload.test.ts
// A career closed in the middle of a winter and opened again.
//
// Two things went wrong across that reload, both reported 2026-09-25.
//
// The school's book took the year from the career row. The career row is
// booked at the board meeting and counts June's games; the school's row is
// written at the year roll from the frozen regular season. A load anywhere in
// between seeded the open year from the first, and the roll then kept the
// seed, so the season-start terms said "You won 45 last season" of a 39-6 year
// that finished 45-10.
//
// And the winter's report (graduates, the country's draft, the holes) lived
// only in the store, so the Draft board tab came back empty and the next
// season opened on a report with nobody in it.
//
// Its own file because both need a database.

import { describe, it, expect, vi } from 'vitest';
import { useDynasty, PHASES, type Phase } from '../src/state/store.js';
import { simSeason, regularRecord, type SeasonState } from '../src/engine/season.js';
import { freezeRegularSeason } from '../src/engine/postseason.js';

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

const store = () => useDynasty.getState();
const chair = () => store().season!.teams[store().userTeam]!;

/** Press Continue until the rail stands on `step`, or leaves it for the roll. */
async function walkTo(step: Phase): Promise<void> {
  for (let guard = 0; store().phase !== step && guard < PHASES.length + 1; guard++) {
    await store().nextPhase();
  }
  expect(store().phase).toBe(step);
}

/**
 * A first season played out, June included, with the offseason about to
 * start. June is played by hand: bracket games go on the running record and
 * never on the frozen regular season, which is the whole of what matters here,
 * and the reporter's year had exactly that shape.
 */
function aSeasonWithAJune(seed: number): { year: number; regular: { w: number; l: number }; overall: { w: number; l: number } } {
  store().start(seed, 0);
  const season = store().season as SeasonState;
  const year = store().year;
  simSeason(season);
  freezeRegularSeason(season);
  const me = season.teams[0]!;
  me.w += 6;
  me.l += 4;
  const regular = { ...regularRecord(me) };
  expect(regular).not.toEqual({ w: me.w, l: me.l });
  return { year, regular, overall: { w: me.w, l: me.l } };
}

describe("the school's book across a winter reload", () => {
  it('keeps the regular season for the year the reload landed in', async () => {
    const { year, regular, overall } = aSeasonWithAJune(4242);
    useDynasty.setState({ phase: 'awards', furthestPhase: 0 });
    await walkTo('review');
    // The career row: the coach's record, June and all.
    expect(store().history.find((h) => h.year === year)).toMatchObject(overall);
    expect(store().lastReview?.fired, 'the premise needs a coach still in the chair').toBe(false);
    await walkTo('draft');

    // Closed and opened again on the draft step.
    expect(await store().saveNow('winter')).toBe(true);
    expect(await store().loadSlot('winter')).toBe(true);
    // The year is still open, so the book has nothing for it yet.
    expect(chair().annals?.some((a) => a.year === year) ?? false).toBe(false);

    // The rest of the winter, to the roll that writes it.
    await walkTo(null);
    expect(store().year).toBe(year + 1);
    const row = chair().annals?.find((a) => a.year === year);
    expect(row, 'the roll wrote no row for the year').toBeDefined();
    expect({ w: row!.w, l: row!.l }).toEqual(regular);
    expect(row!.rank).toBeGreaterThan(0);
    // The number the terms print as last season's wins.
    expect(row!.w).toBe(chair().lastW);
  });

  it('puts right the year an earlier load seeded from the career row', async () => {
    const { year, regular, overall } = aSeasonWithAJune(4242);
    store().settleSeason();
    await store().rollYear();
    expect(store().year).toBe(year + 1);

    // The book as a load before this fix left it: the year seeded from the
    // career row, with no rank, June included, and the coach's name on it.
    const row = chair().annals!.find((a) => a.year === year)!;
    Object.assign(row, { ...overall, rank: 0, coach: store().coach.name });
    // A seeded year before that one, which nothing left can correct.
    chair().annals!.unshift({ ...row, year: year - 1, w: 50, l: 5 });
    // And a year the roll wrote, somewhere else, to be left alone.
    const rival = store().season!.teams.find((t) => t.index !== store().userTeam)!;
    const theirs = { ...rival.annals!.find((a) => a.year === year)! };

    expect(await store().saveNow('seeded')).toBe(true);
    expect(await store().loadSlot('seeded')).toBe(true);

    const fixed = chair().annals!.find((a) => a.year === year)!;
    expect({ w: fixed.w, l: fixed.l }).toEqual(regular);
    // The record comes back; the rank went with the season it was read off.
    expect(fixed.rank).toBe(0);
    expect(chair().annals!.find((a) => a.year === year - 1)).toMatchObject({ w: 50, l: 5 });
    expect(store().season!.teams[rival.index]!.annals!.find((a) => a.year === year)).toEqual(theirs);
  });
});

describe("the winter's report across a reload", () => {
  it('comes back on the draft step, whole and live', async () => {
    store().start(6161, 0);
    simSeason(store().season as SeasonState);
    useDynasty.setState({ phase: 'coach', furthestPhase: PHASES.indexOf('coach') });
    await walkTo('draft');

    const report = store().lastOffseason!;
    expect(report).not.toBeNull();
    const abbr = chair().def.abbr;
    // The country's whole board, deeper than the rows the tab shows, with
    // your own men wherever the clubs took them.
    expect(report.drafted.length).toBeGreaterThan(80);
    expect(report.drafted.some((d) => d.teamAbbr === abbr)).toBe(true);
    const before = structuredClone(report);

    expect(await store().saveNow('draft-step')).toBe(true);
    useDynasty.setState({ lastOffseason: null });
    expect(await store().loadSlot('draft-step')).toBe(true);
    expect(store().lastOffseason).toEqual(before);

    // Live, not a keepsake: a man talked round after the reload changes his
    // notice on it, as he would have before the app closed.
    const man = store().season!.draft!.men.find((m) => m.player.classYear === 'JR' && m.outcome === 'pending');
    expect(man, 'seed 6161 has a junior on the board').toBeDefined();
    // Cheap and well matched, as the store suite makes him: the bookkeeping
    // is the point, not the price.
    man!.round = 20;
    man!.player.priorities = {
      prestige: 0.02, playingTime: 0.02, winning: 0.92, proximity: 0.02, development: 0.02,
    };
    store().keepPlayer(man!.player.id, 'ring', 60);
    expect(man!.outcome).toBe('stayed');
    expect(store().lastOffseason!.drafted.find((d) => d.id === man!.player.id)?.returned).toBe(true);
  });

  it('carries the draft into the next season when the reload came before the roll', async () => {
    aSeasonWithAJune(909);
    useDynasty.setState({ phase: 'awards', furthestPhase: 0 });
    await walkTo('draft');
    const atTheDraft = structuredClone(store().lastOffseason!);
    expect(atTheDraft.graduated.length).toBeGreaterThan(0);

    expect(await store().saveNow('before-the-roll')).toBe(true);
    expect(await store().loadSlot('before-the-roll')).toBe(true);
    await walkTo(null);

    // The year turned on the report the draft wrote, not on an empty one.
    const winter = store().lastOffseason!;
    expect(winter.graduated).toEqual(atTheDraft.graduated);
    expect(winter.drafted).toEqual(atTheDraft.drafted);
    expect(store().seasonOpener?.departed ?? 0).toBeGreaterThan(0);

    // And the report the new season reads survives a reload of its own,
    // the class that arrived included.
    const opening = structuredClone(winter);
    expect(await store().saveNow('opening-day')).toBe(true);
    useDynasty.setState({ lastOffseason: null });
    expect(await store().loadSlot('opening-day')).toBe(true);
    expect(store().lastOffseason).toEqual(opening);
  });

  it('comes back as nothing from a save without one, or with nonsense in its place', async () => {
    store().start(4242, 0);
    expect(await store().saveNow('no-winter')).toBe(true);
    const file = disk.get('no-winter') as Record<string, unknown>;
    // No draft has been reached, so there is nothing to write.
    expect('lastOffseason' in file).toBe(false);

    const junk: unknown[] = ['a report', 7, [], { graduated: 'x', drafted: [] }, { graduated: [] }];
    for (const lastOffseason of [undefined, ...junk]) {
      disk.set('no-winter', { ...file, lastOffseason });
      useDynasty.setState({ lastOffseason: { ...emptyReport(), recruits: 3 } });
      expect(await store().loadSlot('no-winter')).toBe(true);
      expect(store().lastOffseason, JSON.stringify(lastOffseason)).toBeNull();
    }

    // Half a report keeps what is whole and reads the rest as nothing.
    const row = {
      id: 'p1', name: 'A Man', team: 0, teamAbbr: 'XXX', classYear: 'SR',
      age: 22, overall: 60, reason: 'graduated',
    };
    disk.set('no-winter', {
      ...file,
      lastOffseason: {
        graduated: [row, { id: 'p2' }, null], drafted: [], improved: 'lots',
        holes: [{ pos: 'C', count: 1 }, { pos: 3 }],
      },
    });
    expect(await store().loadSlot('no-winter')).toBe(true);
    expect(store().lastOffseason).toEqual({ ...emptyReport(), graduated: [row], holes: [{ pos: 'C', count: 1 }] });
  });
});

function emptyReport() {
  return {
    graduated: [], drafted: [], recruits: 0, signed: [], walkOns: [],
    developmentNet: 0, improved: 0, declined: 0, badges: [], holes: [],
  };
}
