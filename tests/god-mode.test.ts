// god-mode.test.ts
// The sandbox's rules, without a screen.
//
// God mode edits the world in place, so the promises worth pinning are the
// ones that keep a sandbox from becoming a crash: every number is clamped
// to the rating scale, a position change is a home rather than a stretch,
// a conference trade rebuilds the schedule only when there is nothing yet
// played on it and refuses in mid-season, the grants show up where the
// desk reads its money, and a save that turned god mode on says so when
// it comes back.

import { describe, expect, it } from 'vitest';
import { createSeason, simNextDay } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import {
  addToTeam, authorPlayer, conferenceWindow, editPlayer, findPlayer, grantMoney, grantRecruiting,
  ratingsOf, renameProgram, reshuffleSchedule, setPrestige, setStaff, swapConferences,
  S_PLUS_POTENTIAL,
} from '../src/engine/godMode.js';
import { remaining, marketFor, type Economy } from '../src/engine/economy.js';
import { potentialGrade } from '../src/engine/scouting.js';
import type { Hitter, Pitcher } from '../src/engine/types.js';
import { buildSaveFile } from '../src/state/persistence.js';

const fresh = (seed = 3) => createSeason(makeRng(seed), undefined, CONFERENCES);

describe('editing a man', () => {
  it('clamps every number to the scale and moves his home with his position', () => {
    const season = fresh();
    const h = season.teams[0]!.team.lineup[0]!;
    editPlayer(h, { ratings: { contact: 140, power: -5, speed: 77.6 }, potential: 120, pos: 'SS', classYear: 'SR', name: '  Ty Cobb  ' });
    expect(h.contact).toBe(99);
    expect(h.power).toBe(1);
    expect(h.speed).toBe(78);
    expect(h.potential).toBe(99);
    expect(potentialGrade(h.potential)).toBe('S+');
    expect(h.pos).toBe('SS');
    expect(h.homePos).toBe('SS');
    expect(h.classYear).toBe('SR');
    expect(h.name).toBe('Ty Cobb');
  });

  it('ignores a blank name and a number the man does not carry', () => {
    const season = fresh();
    const p = season.teams[0]!.team.rotation[0]! as Pitcher;
    const before = p.name;
    editPlayer(p, { name: '   ', ratings: { contact: 99 } as never, role: 'RP' });
    expect(p.name).toBe(before);
    expect((p as unknown as Record<string, unknown>).contact).toBeUndefined();
    expect(p.role).toBe('RP');
    expect(p.homeRole).toBe('RP');
  });

  it('lists the numbers a man actually carries', () => {
    const season = fresh();
    expect(ratingsOf(season.teams[0]!.team.lineup[0]!)).toContain('contact');
    expect(ratingsOf(season.teams[0]!.team.rotation[0]!)).toContain('stuff');
    expect(ratingsOf(season.teams[0]!.team.rotation[0]!)).not.toContain('contact');
  });

  it('authors a man onto a roster, and S+ is his to have', () => {
    const season = fresh();
    const record = season.teams[5]!;
    const before = record.team.bench.length;
    const p = authorPlayer(season.rng, 'hitter', 70, { pos: 'CF', classYear: 'FR' });
    addToTeam(record, p);
    editPlayer(p, { potential: S_PLUS_POTENTIAL });
    expect(record.team.bench.length).toBe(before + 1);
    expect((p as Hitter).pos).toBe('CF');
    expect(potentialGrade(p.potential)).toBe('S+');
    expect(findPlayer(season, p.id)?.team.index).toBe(5);
    const arm = authorPlayer(season.rng, 'pitcher', 60, { role: 'SP' });
    addToTeam(record, arm);
    expect(record.team.bullpen).toContain(arm);
  });
});

describe('editing a program', () => {
  it('renames it everywhere the name is read, and keeps the abbreviation', () => {
    const season = fresh();
    const record = season.teams[2]!;
    const abbr = record.def.abbr;
    renameProgram(record, 'Coastal Carolina', 'Chanticleers');
    expect(record.def.school).toBe('Coastal Carolina');
    expect(record.def.nickname).toBe('Chanticleers');
    expect(record.team.name).toBe('Coastal Carolina');
    expect(record.def.abbr).toBe(abbr);
    renameProgram(record, '', '');
    expect(record.def.school).toBe('Coastal Carolina');
  });

  it('holds prestige to the scale', () => {
    const season = fresh();
    setPrestige(season.teams[2]!, 400);
    expect(season.teams[2]!.prestige).toBe(100);
    setPrestige(season.teams[2]!, -3);
    expect(season.teams[2]!.prestige).toBe(1);
  });

  it('trades leagues before the first pitch and rebuilds the schedule, and refuses mid-season', () => {
    const season = fresh();
    const a = season.teams.findIndex((t) => t.conference === season.teams[0]!.conference);
    const b = season.teams.findIndex((t) => t.conference !== season.teams[0]!.conference);
    const confA = season.teams[a]!.conference;
    const confB = season.teams[b]!.conference;
    const games = season.schedule.length;
    expect(conferenceWindow(season)).toBe('now');
    expect(swapConferences(season, a, b)).toBe(true);
    expect(season.teams[a]!.conference).toBe(confB);
    expect(season.teams[b]!.conference).toBe(confA);
    expect(season.schedule.length).toBe(games);
    // Every league is the size it was, so the scheduler still has its pairs.
    const sizes = new Map<string, number>();
    for (const t of season.teams) sizes.set(t.conference, (sizes.get(t.conference) ?? 0) + 1);
    expect(new Set(sizes.values()).size).toBe(1);
    // The new schedule seats him in his new league's series.
    const mine = season.schedule.flatMap((d) => d.games.filter((g) => g.home === a || g.away === a));
    const inLeague = mine.filter((g) => season.teams[g.home === a ? g.away : g.home]!.conference === confB);
    expect(inLeague.length).toBeGreaterThan(0);

    simNextDay(season);
    expect(conferenceWindow(season)).toBe('closed');
    expect(swapConferences(season, a, b)).toBe(false);
  });

  it('reshuffles the schedule only before the first pitch', () => {
    const season = fresh();
    const before = season.schedule.map((d) => d.games.map((g) => `${g.home}-${g.away}`).join(','));
    expect(reshuffleSchedule(season)).toBe(true);
    const after = season.schedule.map((d) => d.games.map((g) => `${g.home}-${g.away}`).join(','));
    expect(after.length).toBe(before.length);
    expect(after.join('|')).not.toBe(before.join('|'));
    simNextDay(season);
    expect(reshuffleSchedule(season)).toBe(false);
  });
});

describe('the money and the staff', () => {
  const eco = (): Economy => ({
    facilities: 0, built: [], facilityLevels: {}, staff: {}, tree: [], pipelines: {}, spent: 0, scouted: {},
  });

  it('a grant shows up where the desk reads its money', () => {
    const e = eco();
    const before = remaining(e, 50);
    grantMoney(e, 25);
    expect(remaining(e, 50)).toBe(before + 25);
    grantMoney(e, -1000);
    expect(remaining(e, 50)).toBe(before);
  });

  it('recruiting points accumulate per week and never go under zero', () => {
    const e = eco();
    grantRecruiting(e, 5);
    grantRecruiting(e, 10);
    expect(e.recruitingGrant).toBe(15);
    grantRecruiting(e, -100);
    expect(e.recruitingGrant).toBe(0);
  });

  it('rates and renames a seated assistant, and does nothing to an empty seat', () => {
    const e = eco();
    expect(setStaff(e, 'hitting', { rating: 90 })).toBe(false);
    e.staff.hitting = marketFor('w', 2030, 'hitting')[0]!;
    expect(setStaff(e, 'hitting', { rating: 250, name: 'Walt Hriniak' })).toBe(true);
    expect(e.staff.hitting!.rating).toBe(99);
    expect(e.staff.hitting!.name).toBe('Walt Hriniak');
  });
});

describe('the flag on the save', () => {
  it('rides the file only when it was turned on', () => {
    const season = fresh();
    const on = buildSaveFile('auto', 'A', season, 2027, 0, { godMode: true }) as { godMode?: boolean };
    const off = buildSaveFile('auto', 'B', season, 2027, 0, {}) as { godMode?: boolean };
    expect(on.godMode).toBe(true);
    expect(off.godMode).toBeUndefined();
  });
});
