// progression.test.ts
// The dynasty only works if the world turns over. A roster that never changes
// makes year five identical to year one, and a roster that changes wrongly
// breaks it in ways that are hard to see from a box score.

import { describe, it, expect } from 'vitest';
import { createSeason, simSeason, nextSeason } from '../src/engine/season.js';
import { advanceOffseason } from '../src/engine/progression.js';
import { overallOf } from '../src/engine/ratings.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import type { SeasonState } from '../src/engine/season.js';
import type { Player } from '../src/engine/types.js';

/** Two conferences is enough to prove the mechanics and keeps the suite quick. */
const SMALL = CONFERENCES.slice(0, 2);

const rosterOf = (s: SeasonState, i: number): Player[] => {
  const t = s.teams[i]!.team;
  return [...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen];
};

const everyone = (s: SeasonState): Player[] =>
  s.teams.flatMap((_, i) => rosterOf(s, i));

describe('the offseason', () => {
  const rng = makeRng(2027);
  const season = createSeason(rng, undefined, SMALL);
  simSeason(season);
  const before = everyone(season);
  // advanceOffseason mutates players in place — a returning freshman becomes a
  // sophomore on the same object. So anything about the old state has to be
  // copied out first; holding the array is not holding the past.
  const snapshot = before.map((p) => ({ id: p.id, classYear: p.classYear }));
  const report = advanceOffseason(season, rng);
  const after = everyone(season);

  it('graduates every senior', () => {
    const seniorsBefore = snapshot.filter((p) => p.classYear === 'SR');
    const departed = new Set([...report.graduated, ...report.drafted].map((d) => d.id));
    for (const s of seniorsBefore) expect(departed.has(s.id)).toBe(true);
    expect(seniorsBefore.length).toBe(
      report.graduated.length + report.drafted.filter((d) => d.classYear === 'SR').length,
    );
  });

  it('never lets a departed player stay on a roster', () => {
    const departed = new Set([...report.graduated, ...report.drafted].map((d) => d.id));
    for (const p of after) expect(departed.has(p.id)).toBe(false);
  });

  it('keeps every roster at full strength', () => {
    for (let i = 0; i < season.teams.length; i++) {
      const t = season.teams[i]!.team;
      expect(t.lineup).toHaveLength(9);
      expect(t.bench).toHaveLength(4);
      expect(t.rotation).toHaveLength(4);
      expect(t.bullpen).toHaveLength(6);
      expect(rosterOf(season, i)).toHaveLength(23);
    }
  });

  it('fields a complete diamond', () => {
    for (const record of season.teams) {
      const spots = record.team.lineup.map((p) => p.pos);
      expect(new Set(spots)).toEqual(new Set(['C','1B','2B','3B','SS','LF','CF','RF','DH']));
    }
  });

  it('replaces exactly what it lost', () => {
    expect(report.recruits).toBe(report.graduated.length + report.drafted.length);
    expect(after).toHaveLength(before.length);
  });

  it('signs the replacements as freshmen', () => {
    const returning = new Set(before.map((p) => p.id));
    const newcomers = after.filter((p) => !returning.has(p.id));
    expect(newcomers.length).toBe(report.recruits);
    for (const p of newcomers) expect(p.classYear).toBe('FR');
  });

  it('never puts a man on two rosters', () => {
    const ids = after.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('advances everyone who stayed by exactly one class', () => {
    const wasFR = new Set(snapshot.filter((p) => p.classYear === 'FR').map((p) => p.id));
    const stayedFR = after.filter((p) => wasFR.has(p.id));
    expect(stayedFR.length).toBeGreaterThan(0);
    for (const p of stayedFR) expect(p.classYear).toBe('SO');
  });

  it('takes the good juniors and leaves the weak ones', () => {
    const juniorsDrafted = report.drafted.filter((d) => d.classYear === 'JR');
    expect(juniorsDrafted.length).toBeGreaterThan(0);
    const avgDrafted = juniorsDrafted.reduce((a, d) => a + d.overall, 0) / juniorsDrafted.length;
    const returningSeniors = after.filter((p) => p.classYear === 'SR');
    const avgReturning = returningSeniors.reduce((a, p) => a + overallOf(p), 0) / returningSeniors.length;
    expect(avgDrafted).toBeGreaterThan(avgReturning);
  });

  it('develops more players than it sets back', () => {
    expect(report.improved).toBeGreaterThan(report.declined);
    expect(report.developmentNet).toBeGreaterThan(0);
  });

  it('never leaves a player above his own ceiling', () => {
    for (const p of after) expect(p.potential).toBeGreaterThanOrEqual(overallOf(p));
  });
});

describe('a dynasty across five years', () => {
  const rng = makeRng(4242);
  let season = createSeason(rng, undefined, SMALL);
  const seen = new Set<string>();
  const ids = new Set<string>();
  let departures = 0;
  let arrivals = 0;

  for (let year = 0; year < 5; year++) {
    simSeason(season);
    for (const p of everyone(season)) { seen.add(p.name); ids.add(p.id); }
    const report = advanceOffseason(season, rng);
    departures += report.graduated.length + report.drafted.length;
    arrivals += report.recruits;
    season = nextSeason(season);
  }

  it('turns the world over completely', () => {
    // Four class years means a roster empties roughly every four seasons.
    const rosterTotal = season.teams.length * 23;
    expect(departures).toBeGreaterThan(rosterTotal);
    expect(arrivals).toBe(departures);
  });

  it('never repeats a name across the whole run', () => {
    expect(seen.size).toBe(ids.size);
  });

  it('keeps all four classes populated every year', () => {
    const counts = new Map<string, number>();
    for (const p of everyone(season)) counts.set(p.classYear, (counts.get(p.classYear) ?? 0) + 1);
    for (const year of ['FR', 'SO', 'JR', 'SR']) {
      expect(counts.get(year) ?? 0).toBeGreaterThan(0);
    }
  });

  it('carries records and statistics into a clean new season', () => {
    for (const t of season.teams) {
      expect(t.w).toBe(0);
      expect(t.l).toBe(0);
      expect(t.gp).toBe(0);
    }
    expect(season.batting.size).toBe(0);
    expect(season.results).toHaveLength(0);
    expect(season.finalOrder).toBeNull();
  });

  it('still knows which conference everyone plays in', () => {
    for (const t of season.teams) expect(t.conference).toBeTruthy();
    expect(season.schedule.length).toBeGreaterThan(0);
  });
});

describe('a signed class actually arrives', () => {
  it('puts every recruit on the roster, hole or no hole', () => {
    // The worst bug the game can have from the player's side: you spend three
    // weeks and eight scholarships on men who then do not exist. `refill` only
    // placed a recruit when there was a *hole* at his position, so a class
    // signed into a roster that returns its starters was silently thrown away.
    const rng = makeRng(2027);
    const season = createSeason(rng, undefined, SMALL);
    simSeason(season);

    const me = 0;
    const signed = season.recruiting.prospects.slice(0, 8);
    for (const p of signed) { p.signedBy = me; p.committedWeek = 3; }
    const ids = new Set(signed.map((p) => p.player.id));

    advanceOffseason(season, rng, { userTeam: me, coachPrestige: 45 });

    const t = season.teams[me]!.team;
    const roster = [...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen];
    const landed = roster.filter((p) => ids.has(p.id));

    expect(landed.length, 'signed recruits went missing').toBe(signed.length);
    // And the roster is still a fieldable team.
    expect(t.lineup).toHaveLength(9);
    expect(t.rotation).toHaveLength(4);
  });
});
