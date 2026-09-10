import { recruitingPlan, programRecruitingPitch } from '../src/engine/recruitingPlan.js';
import { makeTwoWay } from '../src/engine/players.js';
import { makeRng } from '../src/engine/rng.js';
import { entersPortal } from '../src/engine/portal.js';
import { CONFERENCES } from '../src/data/schools.js';
// staff-projects.test.ts
// The hybrid staff system — directives, multi-week projects, the facilities
// that power them, and pipelines built by work rather than granted at hire.
// Added by the September 7 outside pass (05 §63.5) with no coverage at all;
// these are the measurements the verification pass took, turned into a fence.
//
// Everything here drives the real store, because the whole system is store
// actions over an engine that only supplies the arithmetic.

import { describe, it, expect, beforeEach, vi } from 'vitest';
const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_s: string, v: { slot: string }) => { disk.set(v.slot, structuredClone(v)); },
    get: async (_s: string, k: string) => {
      const found = disk.get(k);
      return found === undefined ? undefined : structuredClone(found);
    },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_s: string, k: string) => { disk.delete(k); },
  }),
}));

import { useDynasty, PHASES } from '../src/state/store.js';
import {
  SEATS, withStaff, marketFor, staffPlan, staffProjectWeeks, pipelineStrength,
  recruitingDirectiveMultiplier, staffProjectInjuryGuard, PIPELINE_MIN,
} from '../src/engine/economy.js';
import { uniquePlayers } from '../src/engine/types.js';
import type { Hitter, Arm } from '../src/engine/types.js';

beforeEach(() => { disk.clear(); useDynasty.getState().newDynasty(); });

/** A full staff and all three buildings at `level`, which is what the projects need. */
function equip(level = 1): void {
  const eco = { ...useDynasty.getState().economy };
  const staff = { ...eco.staff };
  for (const seat of SEATS) staff[seat] = marketFor('probe', 2027, seat)[0]!;
  const built = ['cage', 'pen', 'clubhouse'] as const;
  useDynasty.setState({
    economy: {
      ...eco, staff, built: [...built], facilities: 3,
      facilityLevels: Object.fromEntries(built.map((b) => [b, level])),
    },
  });
}
const bats = (): Hitter[] => uniquePlayers([
  ...useDynasty.getState().season!.teams[0]!.team.lineup,
  ...useDynasty.getState().season!.teams[0]!.team.bench,
]) as Hitter[];
const arms = (): Arm[] => uniquePlayers([
  ...useDynasty.getState().season!.teams[0]!.team.rotation,
  ...useDynasty.getState().season!.teams[0]!.team.bullpen,
]) as Arm[];

describe('a directive is the seat it belongs to', () => {
  it('takes its own seat\'s options and refuses another seat\'s', () => {
    useDynasty.getState().start(4242, 0);
    equip();
    const s = useDynasty.getState();
    expect(s.setStaffDirective('hitting', 'power')).toBe(true);
    expect(staffPlan(useDynasty.getState().economy, 'hitting').directive).toBe('power');
    // A pitching directive on the hitting coach is not a thing.
    expect(useDynasty.getState().setStaffDirective('hitting', 'command')).toBe(false);
    expect(staffPlan(useDynasty.getState().economy, 'hitting').directive).toBe('power');
  });

  it('needs somebody in the chair', () => {
    useDynasty.getState().start(4242, 0);
    // No staff hired at all.
    expect(useDynasty.getState().setStaffDirective('hitting', 'power')).toBe(false);
  });
});

describe('a project needs the building that powers it', () => {
  it('is refused with no facility, and shortens as the facility grows', () => {
    useDynasty.getState().start(4242, 0);
    const eco = useDynasty.getState().economy;
    const staff = { ...eco.staff };
    for (const seat of SEATS) staff[seat] = marketFor('probe', 2027, seat)[0]!;
    // Staffed, but nothing built.
    useDynasty.setState({ economy: { ...eco, staff, built: [], facilityLevels: {}, facilities: 0 } });
    expect(useDynasty.getState().startStaffProject('hitting', 'hitting-contact')).toBe(false);

    equip(1);
    const at = (level: number): number =>
      staffProjectWeeks({ ...useDynasty.getState().economy, facilityLevels: { cage: level } }, 'hitting');
    expect([at(1), at(2), at(3)]).toEqual([5, 4, 3]);
  });

  it('takes one project at a time, on the seat the project belongs to', () => {
    useDynasty.getState().start(4242, 0);
    equip();
    const s = () => useDynasty.getState();
    // A pitching project cannot be started on the hitting seat.
    expect(s().startStaffProject('hitting', 'pitching-command')).toBe(false);
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(true);
    // And a second one is refused while the first runs.
    expect(s().startStaffProject('hitting', 'hitting-power')).toBe(false);
    expect(staffPlan(s().economy, 'hitting').project?.kind).toBe('hitting-contact');
  });

  it('cancelling clears the seat, and the next project starts at full length', () => {
    useDynasty.getState().start(4242, 0);
    equip(1);
    useDynasty.getState().startStaffProject('hitting', 'hitting-contact');
    useDynasty.getState().advanceRecruitingWeek();
    useDynasty.getState().advanceRecruitingWeek();
    expect(staffPlan(useDynasty.getState().economy, 'hitting').project?.weeksLeft).toBe(3);

    useDynasty.getState().cancelStaffProject('hitting');
    expect(staffPlan(useDynasty.getState().economy, 'hitting').project).toBeUndefined();
    // No credit carried over: a fresh project is the full five weeks again.
    expect(useDynasty.getState().startStaffProject('hitting', 'hitting-power')).toBe(true);
    expect(staffPlan(useDynasty.getState().economy, 'hitting').project?.weeksLeft).toBe(5);
  });
});

describe('a finished project develops the men it names', () => {
  it('a contact block lifts contact, and touches nothing else', () => {
    useDynasty.getState().start(4242, 0);
    equip(1);
    useDynasty.getState().setStaffDirective('hitting', 'contact');
    const contactBefore = new Map(bats().map((b) => [b.id, b.contact]));
    const powerBefore = new Map(bats().map((b) => [b.id, b.power]));
    expect(useDynasty.getState().startStaffProject('hitting', 'hitting-contact')).toBe(true);
    const project = staffPlan(useDynasty.getState().economy, 'hitting').project!;
    expect(project.playerId).toBeDefined();
    expect(project.odds).toBeGreaterThan(0);
    project.odds = 1;

    // Four weeks in, nothing has landed: the work is the whole block.
    for (let i = 0; i < 4; i++) useDynasty.getState().advanceRecruitingWeek();
    expect(bats().every((b) => b.contact === contactBefore.get(b.id))).toBe(true);
    expect(staffPlan(useDynasty.getState().economy, 'hitting').project?.weeksLeft).toBe(1);

    useDynasty.getState().advanceRecruitingWeek();
    // One man, the one the project named, three points with the matching focus.
    const moved = bats().filter((b) => b.contact !== contactBefore.get(b.id));
    expect(moved.map((m) => String(m.id))).toEqual([project.playerId]);
    expect(moved[0]!.contact).toBe(contactBefore.get(moved[0]!.id)! + 3);
    // The block is spent, and no other rating moved with it.
    expect(staffPlan(useDynasty.getState().economy, 'hitting').project).toBeUndefined();
    expect(bats().every((b) => b.power === powerBefore.get(b.id))).toBe(true);
  });

  it('a velocity block lifts stuff on the arms', () => {
    useDynasty.getState().start(4242, 0);
    equip(3);
    useDynasty.getState().setStaffDirective('pitching', 'velocity');
    const before = new Map(arms().map((a) => [a.id, a.stuff]));
    expect(useDynasty.getState().startStaffProject('pitching', 'pitching-velocity')).toBe(true);
    staffPlan(useDynasty.getState().economy, 'pitching').project!.odds = 1;
    // Three weeks at a level-three pen.
    for (let i = 0; i < 3; i++) useDynasty.getState().advanceRecruitingWeek();
    const moved = arms().filter((a) => a.stuff !== before.get(a.id));
    expect(moved.length).toBe(1);
    for (const m of moved) expect(m.stuff).toBeGreaterThan(before.get(m.id)!);
  });

  it('matching the directive to the project is worth more than not', () => {
    const gained = (directive: 'contact' | 'power'): number => {
      useDynasty.getState().newDynasty();
      useDynasty.getState().start(4242, 0);
      equip(1);
      useDynasty.getState().setStaffDirective('hitting', directive);
      const before = new Map(bats().map((b) => [b.id, b.contact]));
      useDynasty.getState().startStaffProject('hitting', 'hitting-contact');
      staffPlan(useDynasty.getState().economy, 'hitting').project!.odds = 1;
      for (let i = 0; i < 5; i++) useDynasty.getState().advanceRecruitingWeek();
      return bats().reduce((n, b) => n + (b.contact - (before.get(b.id) ?? 0)), 0);
    };
    // Three points aligned against two unaligned.
    expect(gained('contact')).toBeGreaterThan(gained('power'));
  });
});

describe('a pipeline is built, not granted', () => {
  it('opens a market the program had nothing in, and refuses the two nonsense cases', () => {
    useDynasty.getState().start(4242, 0);
    equip(2);
    const s = () => useDynasty.getState();
    const home = s().season!.teams[0]!.def.state;
    // Home is already a relationship; there is nothing to build there.
    expect(pipelineStrength(s().economy, home, home)).toBeGreaterThanOrEqual(PIPELINE_MIN);
    expect(s().startStaffProject('recruiting', 'pipeline-build', home)).toBe(false);
    // A market the program has never worked: deepening is meaningless, building is not.
    expect(pipelineStrength(s().economy, 'ME', home)).toBe(0);
    expect(s().startStaffProject('recruiting', 'pipeline-deepen', 'ME')).toBe(false);
    // And a recruiting project without a state is not a project.
    expect(s().startStaffProject('recruiting', 'pipeline-build')).toBe(false);

    expect(s().startStaffProject('recruiting', 'pipeline-build', 'ME')).toBe(true);
    for (let i = 0; i < 4; i++) s().advanceRecruitingWeek();
    expect(staffPlan(s().economy, 'recruiting').project).toBeUndefined();
    // A built pipeline clears the bar the game calls established.
    expect(pipelineStrength(s().economy, 'ME', home)).toBeGreaterThanOrEqual(PIPELINE_MIN);
  });
});

describe('what a directive is worth on the board', () => {
  it('prices the recruits it names and nobody else', () => {
    useDynasty.getState().start(4242, 0);
    equip();
    const s = () => useDynasty.getState();
    const eco = () => s().economy;
    expect(recruitingDirectiveMultiplier(eco(), 5, false)).toBe(1);

    s().setStaffDirective('recruiting', 'stars');
    expect(recruitingDirectiveMultiplier(eco(), 5, false)).toBeCloseTo(1.10);
    expect(recruitingDirectiveMultiplier(eco(), 2, false)).toBe(1);

    s().setStaffDirective('recruiting', 'sleepers');
    expect(recruitingDirectiveMultiplier(eco(), 2, false)).toBeCloseTo(1.10);
    expect(recruitingDirectiveMultiplier(eco(), 5, false)).toBe(1);

    s().setStaffDirective('recruiting', 'needs');
    expect(recruitingDirectiveMultiplier(eco(), 3, true)).toBeCloseTo(1.10);
    expect(recruitingDirectiveMultiplier(eco(), 3, false)).toBe(1);
  });
});

describe('arm care protects while it is actually running', () => {
  it('is nothing without the project, and deepens with the pen', () => {
    useDynasty.getState().start(4242, 0);
    equip(2);
    expect(staffProjectInjuryGuard(useDynasty.getState().economy)).toBe(1);
    useDynasty.getState().startStaffProject('pitching', 'pitching-arm-care');
    const atTwo = staffProjectInjuryGuard(useDynasty.getState().economy);
    expect(atTwo).toBeLessThan(1);
    // A better pen protects harder.
    const eco = useDynasty.getState().economy;
    const atThree = staffProjectInjuryGuard({ ...eco, facilityLevels: { ...eco.facilityLevels, pen: 3 } });
    expect(atThree).toBeLessThan(atTwo);
  });
});

describe('the plan belongs to the man in the chair', () => {
  it('goes when he goes, and an empty seat cannot start work', () => {
    useDynasty.getState().start(4242, 0);
    equip();
    useDynasty.getState().setStaffDirective('hitting', 'power');
    useDynasty.getState().startStaffProject('hitting', 'hitting-power');
    expect(staffPlan(useDynasty.getState().economy, 'hitting').project).toBeDefined();

    useDynasty.getState().fireAssistant('hitting');
    const plan = staffPlan(useDynasty.getState().economy, 'hitting');
    expect(plan.project).toBeUndefined();
    expect(plan.directive).toBe('balanced');
    expect(useDynasty.getState().startStaffProject('hitting', 'hitting-power')).toBe(false);
  });

  it('rides the save, half-finished', async () => {
    useDynasty.getState().start(4242, 0);
    equip(3);
    useDynasty.getState().setStaffDirective('pitching', 'velocity');
    useDynasty.getState().startStaffProject('pitching', 'pitching-velocity');
    useDynasty.getState().advanceRecruitingWeek();
    const before = staffPlan(useDynasty.getState().economy, 'pitching');
    expect(before.project?.weeksLeft).toBe(2);

    await useDynasty.getState().saveNow();
    const slot = useDynasty.getState().loadedSlot!;
    useDynasty.getState().newDynasty();
    expect(await useDynasty.getState().loadSlot(slot)).toBe(true);

    const after = staffPlan(useDynasty.getState().economy, 'pitching');
    expect(after.directive).toBe('velocity');
    expect(after.project?.kind).toBe('pitching-velocity');
    expect(after.project?.weeksLeft).toBe(2);
  });
});

describe('projects are deliberate and report their outcomes', () => {
  it('keeps the man it named even if his rating changes mid-project', () => {
    useDynasty.getState().start(4242, 0); equip();
    const s = () => useDynasty.getState();
    s().setStaffDirective('hitting', 'contact');
    s().startStaffProject('hitting', 'hitting-contact');
    const project = staffPlan(s().economy, 'hitting').project!;
    project.odds = 1;
    const selected = bats().find((p) => String(p.id) === project.playerId)!;
    selected.contact = 85;
    for (let i = 0; i < 5; i++) s().advanceRecruitingWeek();
    expect(selected.contact).toBe(88);
    const report = s().economy.projectHistory![0]!;
    expect(report.playerId).toBe(String(selected.id));
    expect(report.took).toBe(true);
    expect(report.changes.some((c) => c.id === selected.id && c.before === 85 && c.after === 88)).toBe(true);
    expect(s().inbox.some((i) => i.title === 'Contact block complete' && i.body.includes(selected.name))).toBe(true);
  });

  it('is the man the coach picked, and only one of his', () => {
    useDynasty.getState().start(4242, 0); equip();
    const s = () => useDynasty.getState();
    const bench = bats().at(-1)!;
    const arm = arms()[0]!;
    // A pitcher is not a hitting coach's project.
    expect(s().startStaffProject('hitting', 'hitting-power', undefined, String(arm.id))).toBe(false);
    expect(s().startStaffProject('hitting', 'hitting-power', undefined, String(bench.id))).toBe(true);
    expect(staffPlan(s().economy, 'hitting').project!.playerId).toBe(String(bench.id));
  });

  it('can fail to take, and says so on the report and the card', () => {
    useDynasty.getState().start(4242, 0); equip();
    const s = () => useDynasty.getState();
    s().startStaffProject('hitting', 'hitting-contact');
    const project = staffPlan(s().economy, 'hitting').project!;
    const man = bats().find((p) => String(p.id) === project.playerId)!;
    const before = man.contact;
    project.odds = 0;
    for (let i = 0; i < 5; i++) s().advanceRecruitingWeek();
    expect(man.contact).toBe(before);
    const report = s().economy.projectHistory![0]!;
    expect(report.took).toBe(false);
    expect(report.changes[0]!.after).toBe(before);
    expect(s().inbox.some((i) => i.title === 'Contact block complete' && /did not take/.test(i.body))).toBe(true);
  });

  it('takes at about the odds it printed', () => {
    useDynasty.getState().start(4242, 0); equip();
    const s = () => useDynasty.getState();
    const seat = 'hitting';
    let took = 0;
    let odds = 0;
    const runs = 30;
    for (let i = 0; i < runs; i++) {
      s().season!.recruiting.week = 1;
      const plan = staffPlan(s().economy, seat);
      useDynasty.setState({ economy: { ...s().economy, staffPlans: { ...(s().economy.staffPlans ?? {}), [seat]: { ...plan, project: undefined } } } });
      useDynasty.setState({ year: 2030 + i });
      expect(s().startStaffProject(seat, 'hitting-contact')).toBe(true);
      odds += staffPlan(s().economy, seat).project!.odds!;
      for (let w = 0; w < 5; w++) s().advanceRecruitingWeek();
      if (s().economy.projectHistory![0]!.took) took += 1;
    }
    const rate = took / runs;
    const mean = odds / runs;
    expect(Math.abs(rate - mean)).toBeLessThan(0.25);
  });

  it('a last-week focus switch does not earn a full-project bonus', () => {
    useDynasty.getState().start(4242, 0); equip();
    const s = () => useDynasty.getState();
    s().startStaffProject('hitting', 'hitting-contact');
    for (let i = 0; i < 4; i++) s().advanceRecruitingWeek();
    s().setStaffDirective('hitting', 'contact');
    s().advanceRecruitingWeek();
    expect(s().economy.projectHistory![0]!.focused).toBe(false);
    expect(s().economy.projectHistory![0]!.changes.every((c) => c.after - c.before <= 2)).toBe(true);
  });

  it('maintenance fits a shorter window and records project activity separately from signings', () => {
    useDynasty.getState().start(4242, 0); equip(2);
    const s = () => useDynasty.getState();
    const home = s().season!.teams[0]!.def.state;
    s().season!.recruiting.week = 11;
    expect(s().startStaffProject('recruiting', 'pipeline-deepen', home)).toBe(false);
    expect(s().startStaffProject('recruiting', 'pipeline-maintain', home)).toBe(true);
    expect(staffPlan(s().economy, 'recruiting').project!.weeksTotal).toBe(2);
    s().advanceRecruitingWeek(); s().advanceRecruitingWeek();
    expect(s().economy.pipelines![home]!.lastWorkedYear).toBe(s().year);
    expect(s().economy.pipelines![home]!.signings).toBe(0);
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(false);
  });

  it('missing staff or facilities pauses work and disables arm-care protection', () => {
    useDynasty.getState().start(4242, 0); equip();
    const s = () => useDynasty.getState();
    s().startStaffProject('pitching', 'pitching-arm-care');
    const eco = s().economy;
    useDynasty.setState({ economy: { ...eco, staff: { ...eco.staff, pitching: undefined } } });
    s().advanceRecruitingWeek();
    expect(staffPlan(s().economy, 'pitching').project!.weeksLeft).toBe(5);
    expect(staffProjectInjuryGuard(s().economy)).toBe(1);
    useDynasty.setState({ economy: { ...s().economy, staff: eco.staff, built: [], facilityLevels: {}, facilities: 0 } });
    s().advanceRecruitingWeek();
    expect(staffPlan(s().economy, 'pitching').project!.weeksLeft).toBe(5);
    expect(staffProjectInjuryGuard(s().economy)).toBe(1);
    expect(staffProjectInjuryGuard(eco, false)).toBe(1);
  });

  it('respects staff delegation in every project action', () => {
    useDynasty.getState().start(4242, 0); equip();
    const s = () => useDynasty.getState();
    s().startStaffProject('hitting', 'hitting-contact');
    useDynasty.setState({ depth: { ...s().depth, overrides: { ...s().depth.overrides, assistants: false } } });
    expect(s().setStaffDirective('hitting', 'power')).toBe(false);
    expect(s().startStaffProject('pitching', 'pitching-command')).toBe(false);
    s().cancelStaffProject('hitting');
    expect(staffPlan(s().economy, 'hitting').project).toBeDefined();
  });

  it('saves the chosen players, earned focus weeks and completed reports', async () => {
    useDynasty.getState().start(4242, 0); equip(3);
    const s = () => useDynasty.getState();
    s().setStaffDirective('hitting', 'contact');
    s().startStaffProject('hitting', 'hitting-contact');
    s().advanceRecruitingWeek();
    const targets = staffPlan(s().economy, 'hitting').project!.targetIds;
    await s().saveNow();
    const slot = s().loadedSlot!;
    s().newDynasty(); await s().loadSlot(slot);
    expect(staffPlan(s().economy, 'hitting').project!.targetIds).toEqual(targets);
    expect(staffPlan(s().economy, 'hitting').project!.playerId).toBe(targets![0]);
    expect(staffPlan(s().economy, 'hitting').project!.odds).toBeGreaterThan(0);
    expect(staffPlan(s().economy, 'hitting').project!.alignedWeeks).toBe(1);
    s().advanceRecruitingWeek(); s().advanceRecruitingWeek();
    const result = structuredClone(s().economy.projectHistory);
    await s().saveNow(); s().newDynasty(); await s().loadSlot(slot);
    expect(s().economy.projectHistory).toEqual(result);
  });
});


it('the preview equals actual banked interest with staff and facilities', () => {
  useDynasty.getState().start(4242, 0); equip(3);
  const s = () => useDynasty.getState();
  s().setStaffDirective('recruiting', 'pipeline');
  const season = s().season!;
  const rec = season.teams[0]!;
  const p = season.recruiting.prospects.find((p) => p.signedBy === null)!;
  p.spent[0] = 4; p.points[0] = 20; p.weekActions = { 0: { pitch: 'development' } };
  const pitch = programRecruitingPitch(season, rec, CONFERENCES.find((c) => c.id === rec.conference)!.region, s().coach.prestige, s().economy);
  const forecast = recruitingPlan(p, pitch, { team: 0, actions: 4, prestige: s().coach.prestige,
    skill: withStaff(s().coach.skills, s().economy.staff).recruiting, economy: s().economy,
    roster: [...rec.team.lineup, ...rec.team.bench, ...rec.team.rotation, ...rec.team.bullpen],
  });
  s().advanceRecruitingWeek();
  expect(p.points[0]).toBeCloseTo(forecast.projected);
});

it('opening and restoring the offseason portal preserves a fulfilled two-way promise', async () => {
  useDynasty.getState().start(4242, 0);
  const s = () => useDynasty.getState();
  const season = s().season!;
  const rec = season.teams[0]!;
  const p = makeTwoWay(makeRng(4242), 55);
  p.classYear = 'FR'; p.age = 18; p.recruitPromise = { kind: 'twoWayOpportunity', madeYear: 2026, judged: 0 };
  Object.assign(p, { starts: 45, mood: 62 });
  rec.team.bench.push(p); rec.team.bullpen.push(p); rec.w = 30; rec.l = 15;
  // Choose a world where the original false penalty would force him into the pool.
  const seed = Array.from({ length: 500 }, (_, i) => i).find((seed) => entersPortal(p,
    { squadRank: 20, starts: 45, games: 45, year: s().year, seed, battingGames: 0, pitchingGames: 0 }))!;
  expect(seed).toBeDefined(); season.seed = seed;
  season.batting.set(p.id, { g: 8, ab: 20, r: 2, h: 5, d: 1, t: 0, hr: 0, rbi: 2, bb: 2, k: 4, sb: 0, cs: 0, hbp: 0, sf: 0, sh: 0 });
  season.pitching.set(p.id, { g: 3, gs: 0, w: 0, l: 0, sv: 0, outs: 12, h: 2, r: 0, er: 0, bb: 1, k: 5, hr: 0, pitches: 45, bf: 15, wp: 0 });
  useDynasty.setState({ phase: 'draft', furthestPhase: PHASES.indexOf('draft') });
  await s().nextPhase();
  expect(p.recruitPromise!.judged).toBe(1);
  expect(s().portal!.leaving.some((m) => m.player.id === p.id)).toBe(false);
  // A save with the rail at portal but no cached pool takes the recovery path.
  const mood = (p as typeof p & { mood?: number }).mood;
  useDynasty.setState({ portal: null });
  await s().saveNow(); const slot = s().loadedSlot!;
  s().newDynasty(); expect(await s().loadSlot(slot)).toBe(true);
  expect(s().portal!.leaving.some((m) => m.player.id === p.id)).toBe(false);
  const restored = s().season!.teams[0]!.team.bench.find((m) => m.id === p.id)!;
  expect(restored.recruitPromise?.judged).toBe(1);
  expect((restored as typeof restored & { mood?: number }).mood).toBe(mood);
  await s().rollYear();
  expect(s().busy).toBe(false);
  const nextTeam = s().season!.teams[0]!.team;
  const returning = uniquePlayers([...nextTeam.lineup, ...nextTeam.bench, ...nextTeam.rotation, ...nextTeam.bullpen]).find((m) => m.id === p.id);
  expect(returning).toBeDefined();
  expect(returning!.recruitPromise).toBeUndefined();
  expect(s().season!.moraleSettled).not.toBe(true);
});
