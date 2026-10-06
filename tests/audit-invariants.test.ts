// audit-invariants.test.ts
// The safety net under the 1.0.0 fix plan (docs/18-fix-plan.md, Phase 0).
//
// These hold today. Each one guards a structure the audit measured as sound
// (docs/17-pre-release-audit.md) and that the fixes in later phases will
// touch: the schedule for every season length, the roster across a full
// year played through the store, and a save that comes back as it went in.

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

import {
  createSeason, nextSeason, configForRules, seasonLength, DEFAULT_RULES, type SeasonState, type SeasonRules,
} from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { S, startCareer, fullYear, duplicatePlayers, rosterOf, saveAndReload, flush } from './support/drive.js';

function scheduleFaults(season: SeasonState): string[] {
  const faults: string[] = [];
  const n = season.teams.length;
  const games = new Array<number>(n).fill(0);
  const home = new Array<number>(n).fill(0);
  const conf = new Array<number>(n).fill(0);
  for (const day of season.schedule) {
    const seen = new Set<number>();
    for (const g of day.games) {
      if (g.home === g.away) faults.push(`day ${day.day}: team ${g.home} plays itself`);
      for (const t of [g.home, g.away]) {
        if (seen.has(t)) faults.push(`day ${day.day}: team ${t} plays twice`);
        seen.add(t);
        games[t]! += 1;
      }
      home[g.home]! += 1;
      const sameConf = season.teams[g.home]!.conference === season.teams[g.away]!.conference;
      if (g.conference !== sameConf) faults.push(`day ${day.day}: conference flag wrong for ${g.home} v ${g.away}`);
      if (g.conference) { conf[g.home]! += 1; conf[g.away]! += 1; }
    }
  }
  const want = seasonLength(season.config);
  for (let t = 0; t < n; t++) {
    if (games[t] !== want) faults.push(`team ${t} plays ${games[t]} games, not ${want}`);
    if (Math.abs(2 * home[t]! - games[t]!) > Math.ceil(games[t]! * 0.2)) faults.push(`team ${t} home/away ${home[t]}/${games[t]! - home[t]!}`);
  }
  if (new Set(conf).size !== 1) faults.push(`conference game counts differ: ${[...new Set(conf)].join(',')}`);
  return faults;
}

describe('the schedule, for every season length', () => {
  for (const length of ['short', 'standard', 'long'] as const) {
    it(`holds its invariants for ${length} seasons, two seeds, two years`, () => {
      const rules: SeasonRules = { ...DEFAULT_RULES, length };
      for (const seed of [4242, 9001]) {
        let season = createSeason(makeRng(seed), configForRules(rules), CONFERENCES);
        expect(scheduleFaults(season), `${length} seed ${seed} year 1`).toEqual([]);
        season = nextSeason(season);
        expect(scheduleFaults(season), `${length} seed ${seed} year 2`).toEqual([]);
      }
    });
  }
});

describe('a year played through the store', () => {
  it('keeps every player on exactly one roster, every roster able to field a team, and survives a reload', async () => {
    process.on('unhandledRejection', () => {});
    disk.clear();
    startCareer(4242, 5);
    await flush();
    const year = S().year;
    await fullYear();
    expect(S().year).toBe(year + 1);
    expect(duplicatePlayers()).toEqual([]);
    for (const t of S().season!.teams) {
      expect(t.team.lineup.length, t.def.abbr).toBe(9);
      expect(t.team.rotation.length, t.def.abbr).toBeGreaterThan(0);
    }
    const before = S().season!.teams.map((t) => rosterOf(t).map((p) => String(p.id)).sort().join(','));
    const history = S().history.length;
    const coach = { ...S().coach };
    expect(await saveAndReload()).toBe(true);
    expect(S().year).toBe(year + 1);
    expect(S().history.length).toBe(history);
    expect(S().coach.prestige).toBe(coach.prestige);
    expect(S().season!.teams.map((t) => rosterOf(t).map((p) => String(p.id)).sort().join(','))).toEqual(before);
  }, 240_000);
});
