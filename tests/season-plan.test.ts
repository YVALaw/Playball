// season-plan.test.ts
//
// The Season plan (2026-09-29): one sheet, once a season at each chair. It is
// owed on day one of a first season and of a new job, and after the terms are
// signed; closing it stamps the year and the staff's own picks start on idle
// seats, in every mode ("Decide later" means the defaults apply). Its own file
// because it needs a database.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useDynasty, seasonPlanShowing, blockingCardUp, planPick, staffListOf, type DynastyStore,
} from '../src/state/store.js';
import { marketFor, staffPlan, type Economy } from '../src/engine/economy.js';
import { uniquePlayers } from '../src/engine/types.js';

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

const s = () => useDynasty.getState();
const showing = (): boolean => seasonPlanShowing(s());

beforeEach(() => { disk.clear(); s().newDynasty(); });

/** A hitting coach and a batting cage at L1, and room for every man to grow. */
function hittingStaff(): void {
  const eco = s().economy;
  const hitting = marketFor('plan', s().year, 'hitting')[0]!;
  const economy: Economy = {
    ...eco, staff: { ...eco.staff, hitting }, built: ['cage'], facilities: 1, facilityLevels: { cage: 1 },
  };
  useDynasty.setState({ economy });
  const t = s().season!.teams[s().userTeam]!.team;
  for (const p of uniquePlayers([...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen])) p.potential = 99;
}

describe('the season plan', () => {
  it('opens on day one of a first season, and is not a blocking card', () => {
    s().start(4242, 0);
    expect(s().seasonPlanYear).toBeNull();
    expect(showing()).toBe(true);
    expect(blockingCardUp(s())).toBe(false);
  });

  it('waits for the terms, then opens once', async () => {
    s().start(4242, 0);
    s().settleSeason();
    await s().rollYear();
    expect(s().seasonOpener).not.toBeNull();
    expect(showing()).toBe(false);

    s().dismissSeasonOpener();
    expect(showing()).toBe(true);

    s().closeSeasonPlan();
    expect(s().seasonPlanYear).toBe(s().year);
    expect(showing()).toBe(false);
  });

  it('survives a reload both ways', async () => {
    s().start(4242, 0);
    // Owed: still owed after a reload.
    expect(await s().saveNow('plan')).toBe(true);
    expect(await s().loadSlot('plan')).toBe(true);
    expect(s().seasonPlanYear).toBeNull();
    expect(showing()).toBe(true);

    // Closed: stays closed after a reload, through the close's own save (no
    // save of the test's): the app can be put away the moment the sheet goes.
    expect(s().saveState).toBe('saved');
    s().closeSeasonPlan();
    const year = s().year;
    await vi.waitFor(() => expect(s().saveState).toBe('saved'));
    expect((disk.get('plan') as Record<string, unknown>)['seasonPlanYear']).toBe(year);
    useDynasty.setState({ seasonPlanYear: null });
    expect(await s().loadSlot('plan')).toBe(true);
    expect(s().seasonPlanYear).toBe(year);
    expect(showing()).toBe(false);
  });

  it('comes due again next season, and at a new job', async () => {
    s().start(4242, 0);
    s().closeSeasonPlan();
    expect(showing()).toBe(false);

    s().settleSeason();
    await s().rollYear();
    s().dismissSeasonOpener();
    expect(showing()).toBe(true);

    s().closeSeasonPlan();
    expect(showing()).toBe(false);
    const other = s().userTeam === 0 ? 1 : 0;
    const t = s().season!.teams[other]!;
    useDynasty.setState({
      offers: [{ team: other, school: t.def.school, conference: t.conference, prestige: t.prestige, pitch: 'Talk.' }],
    });
    await s().acceptOffer(other);
    expect(s().userTeam).toBe(other);
    expect(s().seasonPlanYear).toBeNull();
    expect(showing()).toBe(true);
  });

  it('never draws over something else', () => {
    s().start(4242, 0);
    expect(showing()).toBe(true);
    const coach = s().coach;
    const opener = {
      year: s().year, headline: 'The board is pleased', message: 'Go again.',
      schoolBefore: 40, schoolAfter: 41, coachBefore: 30, coachAfter: 31,
      askSummary: 'Win', askDetail: 'Win games.', targetWins: 20, stings: [],
    };
    const covers: Array<[string, Partial<DynastyStore>, Partial<DynastyStore>]> = [
      ['a phase', { phase: 'awards' }, { phase: null }],
      ['the job market', { jobSearch: true }, { jobSearch: false }],
      ['an overlay', { overlay: 'inbox' }, { overlay: null }],
      ['a game to resume', { pendingGame: { home: 0, away: 1, line: '' } }, { pendingGame: null }],
      ['a sim', { busy: true }, { busy: false }],
      ['a game starting', { liveStarting: true }, { liveStarting: false }],
      ['a playbook invite', { playbookInvite: 'X' }, { playbookInvite: null }],
      ['the terms', { seasonOpener: opener }, { seasonOpener: null }],
      ['a stopped week', { weekStoppedBy: 'A. Man' }, { weekStoppedBy: null }],
      ['a roster alert', { rosterAlert: { kind: 'hurt', id: 'x', name: 'A. Man', more: 0 } }, { rosterAlert: null }],
      ['a player card', { selectedPlayer: s().season!.teams[0]!.team.lineup[0]!.id }, { selectedPlayer: null }],
      ['a retired coach', { coach: { ...coach, retiredYear: s().year } }, { coach }],
    ];
    for (const [what, on, off] of covers) {
      useDynasty.setState(on);
      expect(showing(), what).toBe(false);
      useDynasty.setState(off);
      expect(showing(), `${what}, cleared`).toBe(true);
    }
    // And only while the recruiting weeks are open.
    const recruiting = s().season!.recruiting;
    const week = recruiting.week;
    recruiting.week = 13;
    expect(showing()).toBe(false);
    recruiting.week = week;
    expect(showing()).toBe(true);
  });

  it('is owed once by a save from before it', async () => {
    s().start(4242, 0);
    s().closeSeasonPlan();
    expect(await s().saveNow('old')).toBe(true);
    const file = disk.get('old') as Record<string, unknown>;
    expect(file['seasonPlanYear']).toBe(s().year);
    delete file['seasonPlanYear'];
    expect(await s().loadSlot('old')).toBe(true);
    expect(s().seasonPlanYear).toBeNull();
    expect(showing()).toBe(true);
  });

  it('keeps the terms a roll wrote through a reload', async () => {
    s().start(4242, 0);
    s().settleSeason();
    await s().rollYear();
    expect(s().seasonOpener).not.toBeNull();
    await vi.waitFor(() => expect(s().saveState).toBe('saved'));
    const slot = s().loadedSlot!;
    useDynasty.setState({ seasonOpener: null });
    expect(await s().loadSlot(slot)).toBe(true);
    expect(s().seasonOpener).not.toBeNull();
  });
});

describe('closing the plan', () => {
  it('starts the staff\'s pick on an idle seat, once a season', () => {
    s().start(4242, 0);
    hittingStaff();
    const rec = s().season!.teams[s().userTeam]!;
    const week = s().season!.recruiting.week;
    const pick = planPick(s().economy, rec, 'hitting', week);
    expect(pick).not.toBeNull();
    // Nobody seated, nothing picked.
    expect(planPick(s().economy, rec, 'pitching', week)).toBeNull();

    const depth = s().depth;
    const list = staffListOf(s());
    s().closeSeasonPlan();
    const work = staffPlan(s().economy, 'hitting').project!;
    expect(work.season).toBe(true);
    expect(work.kind).toBe(pick!.kind);
    expect(work.targetIds).toEqual(pick!.targetIds);
    expect(staffPlan(s().economy, 'hitting').directive).toBe(pick!.directive);
    expect(s().seasonPlanYear).toBe(s().year);
    // The rule and the list are never changed by closing.
    expect(s().depth).toEqual(depth);
    expect(staffListOf(s())).toEqual(list);

    // A second close in the same season does nothing.
    s().cancelStaffProject('hitting');
    expect(staffPlan(s().economy, 'hitting').project).toBeUndefined();
    s().closeSeasonPlan();
    expect(staffPlan(s().economy, 'hitting').project).toBeUndefined();
  });

  it('leaves running work alone', () => {
    s().start(4242, 0);
    hittingStaff();
    expect(s().startStaffProject('hitting', 'hitting-power')).toBe(true);
    const mine = staffPlan(s().economy, 'hitting').project;
    const rec = s().season!.teams[s().userTeam]!;
    expect(planPick(s().economy, rec, 'hitting', s().season!.recruiting.week)).toBeNull();
    s().closeSeasonPlan();
    expect(staffPlan(s().economy, 'hitting').project).toEqual(mine);
  });

  it('starts a casual staff\'s pick too', () => {
    s().start(4242, 0, undefined, 'casual');
    hittingStaff();
    const rec = s().season!.teams[s().userTeam]!;
    const pick = planPick(s().economy, rec, 'hitting', s().season!.recruiting.week, { alignFocus: true });
    expect(pick).not.toBeNull();
    expect(showing()).toBe(true);
    s().closeSeasonPlan();
    const work = staffPlan(s().economy, 'hitting').project!;
    expect(work.season).toBe(true);
    expect(work.kind).toBe(pick!.kind);
    expect(work.targetIds).toEqual(pick!.targetIds);
    expect(showing()).toBe(false);
  });
});
