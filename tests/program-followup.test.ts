import { describe, expect, it } from 'vitest';
import { programAlumni } from '../src/ui/programAlumni.js';
import { programAttention } from '../src/ui/programStatus.js';

type Archive = Parameters<typeof programAlumni>[0];
type Attention = Parameters<typeof programAttention>[0];
const row = (team: string, name = 'Archived Player', year = 2027) => ({ team, name, year, classYear: 'SR', ab: 100, h: 30 });
const note = (teamAbbr: string) => ({ teamAbbr, name: 'Drafted Player', year: 2027, classYear: 'JR', overall: 80, reason: 'drafted' as const, round: 2 });
function archive(): Archive & { season: NonNullable<Archive['season']> } {
  return { alumni: {}, portal: null, season: { teams: [], careers: {}, hall: [] } as unknown as NonNullable<Archive['season']> };
}
function quiet(): Attention {
  return { lastReview: null, offers: [], year: 2028, economy: { staff: {} } as Attention['economy'], unseenRecords: [], unseenTrophies: [] };
}

describe('Program alumni sources', () => {
  it('finds former players in an older career archive without manufacturing departure or pro notes', () => {
    const s = archive();
    s.season!.careers = { 'old-player': [row('HOME')], 'rival-player': [row('AWAY')] } as typeof s.season.careers;
    const found = programAlumni(s, 'HOME');
    expect(found.map(p => p.name)).toEqual(['Archived Player']);
    expect(found[0]?.year).toBe(2027);
    expect(found[0]?.note).toBeUndefined();
    expect(s.alumni).toEqual({});
  });
  it('merges notes, Hall plaques, and careers once per player, including former schools', () => {
    const s = archive();
    s.alumni = { legend: note('AWAY') };
    s.season!.careers = { legend: [row('HOME'), row('AWAY', 'Drafted Player', 2028)] } as typeof s.season.careers;
    s.season!.hall = [{ id: 'legend', name: 'Drafted Player', teams: ['HOME', 'AWAY'], year: 2029, first: 2026, last: 2028, pitcher: false, score: 150, line: 'A great career.' }] as typeof s.season.hall;
    const found = programAlumni(s, 'HOME');
    expect(found).toHaveLength(1);
    expect(found[0]?.career).toEqual([row('HOME')]);
    expect(found[0]?.year).toBe(2027);
    expect(found[0]?.hall).toBeDefined();
  });
  it('includes Hall-only players and notes-only departures, but keeps unrelated schools out', () => {
    const s = archive();
    s.alumni = { recent: note('HOME'), other: note('AWAY') };
    s.season!.hall = [{ id: 'old-legend', name: 'Old Legend', teams: ['HOME'], year: 2024, first: 2020, last: 2023, pitcher: true, score: 180, line: 'Dominant pitcher.' }] as typeof s.season.hall;
    expect(programAlumni(s, 'HOME').map(p => p.name)).toEqual(['Drafted Player', 'Old Legend']);
  });
  it('excludes active players, retained players with stale notes, and players between rosters', () => {
    const s = archive();
    s.alumni = { retained: note('HOME') };
    s.season!.careers = Object.fromEntries(['active', 'retained', 'portal', 'gone'].map(id => [id, [row('HOME')]])) as typeof s.season.careers;
    s.season!.teams = [{ team: { lineup: [{ id: 'active' }, { id: 'retained' }], bench: [], rotation: [], bullpen: [] } }] as unknown as typeof s.season.teams;
    s.portal = { leaving: [{ player: { id: 'portal' } }], available: [], spent: 0 } as unknown as Archive['portal'];
    expect(programAlumni(s, 'HOME').map(p => p.id)).toEqual(['gone']);
  });
});

describe('Program attention', () => {
  it('stays off when there is nothing to review', () => {
    expect(programAttention(quiet())).toBeNull();
  });
  it('keeps a contract alert until all ending contracts are dealt with', () => {
    const s = quiet();
    s.economy.staff = { hitting: { until: 2028 }, pitching: { until: 2027 } } as Attention['economy']['staff'];
    expect(programAttention(s)).toBe('staff');
    s.economy.staff.hitting!.until = 2030;
    expect(programAttention(s)).toBe('staff');
    delete s.economy.staff.pitching;
    expect(programAttention(s)).toBeNull();
  });
  it('prioritizes board decisions and keeps record and achievement alerts after review', () => {
    const s = quiet();
    s.offers = [{}] as Attention['offers'];
    s.unseenTrophies = ['first-win'] as Attention['unseenTrophies'];
    s.unseenRecords = ['hits'] as Attention['unseenRecords'];
    expect(programAttention(s)).toBe('board');
    s.offers = [];
    s.lastReview = {} as Attention['lastReview'];
    expect(programAttention(s)).toBe('board');
    s.lastReview = null;
    expect(programAttention(s)).toBe('coach');
    s.unseenTrophies = [];
    expect(programAttention(s)).toBe('history');
    s.unseenRecords = [];
    expect(programAttention(s)).toBeNull();
  });
});
