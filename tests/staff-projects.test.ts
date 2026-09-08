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

import { useDynasty } from '../src/state/store.js';
import {
  SEATS, marketFor, staffPlan, staffProjectWeeks, pipelineStrength,
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

    // Four weeks in, nothing has landed: the work is the whole block.
    for (let i = 0; i < 4; i++) useDynasty.getState().advanceRecruitingWeek();
    expect(bats().every((b) => b.contact === contactBefore.get(b.id))).toBe(true);
    expect(staffPlan(useDynasty.getState().economy, 'hitting').project?.weeksLeft).toBe(1);

    useDynasty.getState().advanceRecruitingWeek();
    const moved = bats().filter((b) => b.contact !== contactBefore.get(b.id));
    expect(moved.length).toBeGreaterThanOrEqual(3);
    expect(moved.length).toBeLessThanOrEqual(6);
    for (const m of moved) expect(m.contact).toBeGreaterThan(contactBefore.get(m.id)!);
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
    // Three weeks at a level-three pen.
    for (let i = 0; i < 3; i++) useDynasty.getState().advanceRecruitingWeek();
    const moved = arms().filter((a) => a.stuff !== before.get(a.id));
    expect(moved.length).toBeGreaterThan(0);
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
      for (let i = 0; i < 5; i++) useDynasty.getState().advanceRecruitingWeek();
      return bats().reduce((n, b) => n + (b.contact - (before.get(b.id) ?? 0)), 0);
    };
    // Measured: eight points aligned against three unaligned.
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
