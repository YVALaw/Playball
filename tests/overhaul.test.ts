// overhaul.test.ts
// The interface overhaul's load-bearing behavior, pinned.
//
// Offers instead of a directory, a school's own book, tutorials that remember,
// a one-tap lineup, a week gear on the dashboard, and a wire that reports
// without touching the dice. Each of these is a promise a screen now makes;
// these are the tests that keep the promises true.

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { useDynasty, TABS } from '../src/state/store.js';
import { createSeason, simSeason, seasonComplete } from '../src/engine/season.js';
import { recordSchoolAnnals, summarize, type PostseasonSummary } from '../src/engine/postseason.js';
import {
  startingOffers, canBeHired, rosterStrength, ROOKIE_PRESTIGE,
} from '../src/engine/program.js';
import { autoBattingOrder } from '../src/engine/strategy.js';
import { wire } from '../src/engine/wire.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';

beforeEach(() => {
  disk.clear();
  useDynasty.getState().newDynasty();
});

describe('a new coach gets genuine offers, not a directory', () => {
  it('every offer would actually hire him, spread across the country', () => {
    const world = createSeason(makeRng(4242), undefined, CONFERENCES);
    const offers = startingOffers(world.teams);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.length).toBeLessThanOrEqual(6);
    const perConference = new Map<string, number>();
    for (const i of offers) {
      const t = world.teams[i]!;
      expect(canBeHired(ROOKIE_PRESTIGE, t.prestige, rosterStrength(t.team))).toBe(true);
      perConference.set(t.conference, (perConference.get(t.conference) ?? 0) + 1);
    }
    for (const n of perConference.values()) expect(n).toBeLessThanOrEqual(2);
  });

  it('the same world always produces the same desk', () => {
    const a = startingOffers(createSeason(makeRng(777), undefined, CONFERENCES).teams);
    const b = startingOffers(createSeason(makeRng(777), undefined, CONFERENCES).teams);
    expect(a).toEqual(b);
  });
});

describe('every school keeps its own book', () => {
  it('writes one row per program per year, idempotently', () => {
    const season = createSeason(makeRng(3131));
    simSeason(season);
    recordSchoolAnnals(season, 2027, null, 0, 'Coach Test');

    for (const t of season.teams) {
      expect(t.annals?.length).toBe(1);
      expect(t.annals?.[0]?.year).toBe(2027);
    }
    expect(season.teams[0]?.annals?.[0]?.coach).toBe('Coach Test');

    // Reachable twice from a reload mid-offseason; a year is written once.
    recordSchoolAnnals(season, 2027, null, 0, 'Coach Test');
    for (const t of season.teams) expect(t.annals?.length).toBe(1);
  });

  it('records how June ended for the teams that were in it', () => {
    const season = createSeason(makeRng(3131));
    simSeason(season);
    const post: PostseasonSummary = {
      conferenceChampions: [3], regionChampions: [3], champion: 3,
      finish: { 3: 'champion' },
    };
    void summarize; // shape documented by the real summarize()
    recordSchoolAnnals(season, 2027, post, 0, 'Coach Test');
    expect(season.teams[3]?.annals?.[0]?.finish).toBe('champion');
    expect(season.teams[3]?.annals?.[0]?.wonConference).toBe(true);
    expect(season.teams[5]?.annals?.[0]?.finish).toBe('missed');
  });

  it('rides the save, and an old save seeds the chair from the coach history', async () => {
    useDynasty.getState().start(4242, 0);
    const season = useDynasty.getState().season!;
    recordSchoolAnnals(season, 2027, null, 0, 'Coach');
    await useDynasty.getState().saveNow('annals-slot');
    useDynasty.getState().newDynasty();
    const ok = await useDynasty.getState().loadSlot('annals-slot');
    expect(ok).toBe(true);
    const back = useDynasty.getState().season!;
    expect(back.teams[10]?.annals?.length).toBe(1);

    // The pre-annals save: the field absent everywhere, but the coach's own
    // history names his school — those years seed the chair's book on load.
    useDynasty.getState().newDynasty();
    useDynasty.getState().start(4242, 0);
    const old = useDynasty.getState().season!;
    for (const t of old.teams) delete t.annals;
    const school = old.teams[0]!.def.school;
    useDynasty.setState({
      history: [{
        year: 2025, w: 20, l: 25, cw: 12, cl: 21, confPlace: 7, rpi: 40,
        wonConference: false, finish: 'missed', school, nationalChampion: 'X',
      }],
    });
    await useDynasty.getState().saveNow('old-slot');
    useDynasty.getState().newDynasty();
    const ok2 = await useDynasty.getState().loadSlot('old-slot');
    expect(ok2).toBe(true);
    const chair = useDynasty.getState().season!.teams[0]!;
    const seeded = chair.annals?.find((a) => a.year === 2025);
    expect(seeded).toBeDefined();
    // The career row's rpi is a value, not a rank — a seeded year carries no
    // rank rather than a 0.49 dressed up as one.
    expect(seeded?.rank).toBe(0);
    // And only the chair — nothing was invented for the other ninety five.
    expect(useDynasty.getState().season!.teams[50]?.annals ?? []).toHaveLength(0);
  });
});

describe('tutorials teach once and remember it', () => {
  it('marks, persists, merges and resets', async () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.getState().markTutorialSeen('today');
    useDynasty.getState().markTutorialSeen('today');
    expect(useDynasty.getState().seenTutorials).toEqual(['today']);
    await useDynasty.getState().saveNow('tut-slot');

    useDynasty.getState().markTutorialSeen('wire');
    const ok = await useDynasty.getState().loadSlot('tut-slot');
    expect(ok).toBe(true);
    // Merged: what the save knew plus what the player has learned since —
    // loading never re-teaches.
    expect(useDynasty.getState().seenTutorials.sort()).toEqual(['today', 'wire']);

    useDynasty.getState().resetTutorials();
    expect(useDynasty.getState().seenTutorials).toEqual([]);
  });
});

describe('AUTO deals a valid batting order', () => {
  it('same nine men, nobody duplicated, deterministic', () => {
    useDynasty.getState().start(4242, 0);
    const s = useDynasty.getState();
    const team = s.season!.teams[s.userTeam]!.team;
    const before = [...team.lineup];

    s.autoLineup();
    const first = [...team.lineup];
    expect(first).toHaveLength(before.length);
    expect(new Set(first.map((p) => p.id)).size).toBe(before.length);
    expect([...first].sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual([...before].sort((a, b) => a.id.localeCompare(b.id)));
    // Every man keeps his position — AUTO reorders the card, it does not
    // reassign the field.
    for (const p of first) {
      const was = before.find((x) => x.id === p.id)!;
      expect(p.pos).toBe(was.pos);
    }

    // Pressing it twice is pressing it once.
    useDynasty.getState().autoLineup();
    expect(team.lineup.map((p) => p.id)).toEqual(first.map((p) => p.id));

    // And the pure helper agrees with itself.
    expect(autoBattingOrder(before).map((p) => p.id))
      .toEqual(autoBattingOrder(before).map((p) => p.id));
  });
});

describe('SIM WEEK plays out the week and stops', () => {
  it('advances to the next week boundary exactly once', () => {
    useDynasty.getState().start(4242, 0);
    const s = useDynasty.getState();
    const season = s.season!;
    const startWeek = season.schedule[season.dayIndex]!.week;

    s.simWeek();

    expect(season.dayIndex).toBeGreaterThan(0);
    const now = season.schedule[season.dayIndex];
    // Either the season ended or the calendar sits on a new week.
    if (!seasonComplete(season) && now) {
      expect(now.week).toBe(startWeek + 1);
    }
  });
});

describe('the wire reports without touching the dice', () => {
  it('is deterministic, cites real teams, and varies its stories', () => {
    const season = createSeason(makeRng(2626));
    simSeason(season);
    const before = season.rng.state!();

    const a = wire(season);
    const b = wire(season);

    // Reading the paper must never change the season it reports on.
    expect(season.rng.state!()).toBe(before);
    expect(a.map((i) => i.text)).toEqual(b.map((i) => i.text));

    expect(a.length).toBeGreaterThan(0);
    for (const item of a) {
      expect(season.teams[item.team]).toBeDefined();
      if (item.against !== undefined) expect(season.teams[item.against]).toBeDefined();
      expect(item.text.length).toBeGreaterThan(0);
    }
    // A full season's paper is not one kind of story.
    expect(new Set(a.map((i) => i.kind)).size).toBeGreaterThanOrEqual(4);
  });
});

describe('the duplicated nav doors are gone, their rooms are not', () => {
  it('HOME carries TODAY and WIRE only; inbox and scorebook live elsewhere', () => {
    const home = TABS.find((t) => t.id === 'home')!;
    expect(home.screens.map((s) => s.id)).toEqual(['today', 'wire']);
    // The scorebook screen id still resolves — PLAY BALL routes there.
    useDynasty.getState().start(4242, 0);
    useDynasty.getState().startManagedGame();
    expect(useDynasty.getState().screen).toBe('box');
    expect(useDynasty.getState().live).not.toBeNull();
    // And PLAY BALL is the way back to a game in progress, not a second game.
    useDynasty.getState().go('home');
    const live = useDynasty.getState().live;
    useDynasty.getState().startManagedGame();
    expect(useDynasty.getState().live).toBe(live);
    expect(useDynasty.getState().screen).toBe('box');
  });
});
