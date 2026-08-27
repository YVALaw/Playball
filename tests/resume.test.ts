// resume.test.ts
// The game a phone call interrupted, and the one property that makes it
// recoverable.
//
// A `LiveGame` cannot be frozen — it is a coroutine with closures on it — so a
// backgrounded game is replayed rather than restored: the season's generator
// position at the first pitch, plus every call the manager made, replayed
// against a season rewound to that anchor.
//
// That is only honest if a replay is the *same game* rather than a similar one.
// These tests pin exactly that, at the engine level where it is true or false
// with no store, no storage and no browser involved.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_s: string, v: { slot: string }) => { disk.set(v.slot, structuredClone(v)); },
    get: async (_s: string, k: string) => {
      const f = disk.get(k);
      return f === undefined ? undefined : structuredClone(f);
    },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_s: string, k: string) => { disk.delete(k); },
  }),
}));

import { createSeason, simNextDay, restedFirst } from '../src/engine/season.js';
import { createLiveGame } from '../src/engine/liveGame.js';
import type { LiveGame } from '../src/engine/liveGame.js';
import { makeRng, rngFromState } from '../src/engine/rng.js';
import type { Tactic } from '../src/engine/types.js';
import {
  readJournal, writeJournal, noteAction, clearJournal, journalMatches,
} from '../src/state/liveJournal.js';

/*
  A real `localStorage`, because the journal deliberately depends on one.

  It could have been given a memory fallback to make it testable in node, and
  that would have been a lie: a journal held in memory dies with the tab, which
  is the exact event it exists to survive. So the module keeps its hard
  dependency and the test supplies the browser's half of it.
*/
beforeEach(() => {
  disk.clear();
  const mem = new Map<string, string>();
  const shim: Storage = {
    get length() { return mem.size; },
    key: (i: number) => [...mem.keys()][i] ?? null,
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, String(v)); },
    removeItem: (k: string) => { mem.delete(k); },
    clear: () => { mem.clear(); },
  };
  (globalThis as { window?: unknown }).window = { localStorage: shim };
  clearJournal();
});

/** A world with a game about to be played by team 0. */
function upToOurGame(seed: number) {
  const season = createSeason(makeRng(seed));
  let guard = 0;
  const mine = (): boolean => {
    const d = season.schedule[season.dayIndex];
    return !!d?.games.some((g) => g.home === 0 || g.away === 0);
  };
  while (!mine() && guard++ < 60) simNextDay(season);
  const day = season.schedule[season.dayIndex]!;
  const g = day.games.find((x) => x.home === 0 || x.away === 0)!;
  return { season, day, g };
}

/** Build the game the store would build, off whichever generator is handed in. */
function build(
  season: ReturnType<typeof createSeason>,
  g: { home: number; away: number; slot: number },
  rng: ReturnType<typeof makeRng>,
): LiveGame {
  const home = season.teams[g.home]!;
  const away = season.teams[g.away]!;
  return createLiveGame(home.team, away.team, rng, {
    managing: g.home === 0 ? 'home' : 'away',
    engine: season.config.engine,
    homeStarter: g.slot,
    awayStarter: g.slot,
    homeStrategy: home.strategy,
    awayStrategy: away.strategy,
    homeBullpen: restedFirst(season, home),
    awayBullpen: restedFirst(season, away),
    ...(home.coachMods ? { homeCoachMods: home.coachMods } : {}),
    ...(away.coachMods ? { awayCoachMods: away.coachMods } : {}),
  });
}

describe('a replayed game is the same game', () => {
  it('lands on the identical state after the identical calls', () => {
    const { season, g } = upToOurGame(9001);
    const anchor = season.rng.state!();

    // Played once, with a mixed bag of calls so this is not a test of one
    // tactic repeated twenty times.
    const calls: Tactic[] = [
      'swing', 'bunt', 'swing', 'steal', 'contact', 'swing', 'hitrun', 'swing',
      'pitch', 'groundball', 'pitch', 'around', 'pitch', 'swing', 'swing',
    ];
    const first = build(season, g, season.rng);
    const made: Tactic[] = [];
    for (const t of calls) {
      if (first.over || !first.pending) break;
      // Only ever submit something the situation actually offers, exactly as
      // the screen does — an unavailable call is not a call.
      const opt = first.pending.options.find((o) => o.tactic === t && o.available);
      const use = opt ? t : 'swing';
      made.push(use as Tactic);
      first.submit(use as Tactic);
    }

    // And replayed, from the anchor, against a season rewound to it.
    const replaySeason = createSeason(makeRng(9001));
    let guard = 0;
    const mine = (): boolean => {
      const d = replaySeason.schedule[replaySeason.dayIndex];
      return !!d?.games.some((x) => x.home === 0 || x.away === 0);
    };
    while (!mine() && guard++ < 60) simNextDay(replaySeason);
    expect(replaySeason.rng.state!()).toBe(anchor);

    const second = build(replaySeason, g, rngFromState(anchor));
    for (const t of made) {
      if (second.over || !second.pending) break;
      second.submit(t);
    }

    // The whole point, stated three ways.
    expect(second.result.home.runs).toBe(first.result.home.runs);
    expect(second.result.away.runs).toBe(first.result.away.runs);
    expect(second.log.length).toBe(first.log.length);
    expect(second.log.join('|')).toBe(first.log.join('|'));
    expect(second.over).toBe(first.over);
    if (second.pending && first.pending) {
      expect(second.pending.inning).toBe(first.pending.inning);
      expect(second.pending.outs).toBe(first.pending.outs);
      expect(second.pending.half).toBe(first.pending.half);
      expect(second.pending.batter.id).toBe(first.pending.batter.id);
    }
  });

  it('finishes the same way whether it was interrupted or not', () => {
    // The declined path: the bench coach takes a replayed game the rest of the
    // way, and it must land where an uninterrupted one would have.
    const { season, g } = upToOurGame(9002);
    const anchor = season.rng.state!();

    const straight = build(season, g, rngFromState(anchor));
    for (let i = 0; i < 6 && !straight.over; i++) straight.submit('swing');
    straight.finish();

    const replay = build(season, g, rngFromState(anchor));
    for (let i = 0; i < 6 && !replay.over; i++) replay.submit('swing');
    replay.finish();

    expect(replay.result.home.runs).toBe(straight.result.home.runs);
    expect(replay.result.away.runs).toBe(straight.result.away.runs);
    expect(replay.over).toBe(true);
  });
});

describe('the journal', () => {
  it('keeps the calls in the order they were made', () => {
    writeJournal({
      slot: 'auto', year: 2027, rngState: 4242,
      home: 3, away: 7, day: 12,
      homeStarter: 0, awayStarter: 0,
      managing: 'home', postseason: false, actions: [],
    });
    noteAction({ k: 'tactic', t: 'swing' });
    noteAction({ k: 'pen', id: 'arm-1' });
    noteAction({ k: 'tactic', t: 'bunt' });

    const j = readJournal();
    expect(j).not.toBeNull();
    expect(j!.actions).toEqual([
      { k: 'tactic', t: 'swing' },
      { k: 'pen', id: 'arm-1' },
      { k: 'tactic', t: 'bunt' },
    ]);
  });

  it('refuses a journal that belongs to another world', () => {
    const j = {
      slot: 'auto', year: 2027, rngState: 4242,
      home: 0, away: 1, day: 3,
      homeStarter: 0, awayStarter: 0,
      managing: 'home' as const, postseason: false, actions: [],
    };
    expect(journalMatches(j, 'auto', 2027, 4242)).toBe(true);
    // Another dynasty, another year, or a generator that has moved on: all
    // three are the same answer, because replaying into any of them would
    // invent a game rather than recover one.
    expect(journalMatches(j, 'other', 2027, 4242)).toBe(false);
    expect(journalMatches(j, 'auto', 2028, 4242)).toBe(false);
    expect(journalMatches(j, 'auto', 2027, 9999)).toBe(false);
  });

  it('survives nothing being there, and clears cleanly', () => {
    expect(readJournal()).toBeNull();
    noteAction({ k: 'tactic', t: 'swing' });   // must not throw with no journal
    expect(readJournal()).toBeNull();
    writeJournal({
      slot: 'auto', year: 2027, rngState: 1,
      home: 0, away: 1, day: 1,
      homeStarter: 0, awayStarter: 0,
      managing: 'away', postseason: true, actions: [],
    });
    expect(readJournal()).not.toBeNull();
    clearJournal();
    expect(readJournal()).toBeNull();
  });
});
