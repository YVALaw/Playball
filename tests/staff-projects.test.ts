import { recruitingPlan, programRecruitingPitch } from '../src/engine/recruitingPlan.js';
import { makeTwoWay } from '../src/engine/players.js';
import { makeRng } from '../src/engine/rng.js';
import { entersPortal } from '../src/engine/portal.js';
import { CONFERENCES } from '../src/data/schools.js';
// staff-projects.test.ts
// The hybrid staff system — directives, the season's work, the facilities
// that size it, and pipelines built by work rather than granted at hire.
// Added by the September 7 outside pass (05 §63.5) with no coverage at all;
// rewritten 2026-09-28 when each assistant's string of 3-5 week projects
// became one assignment a season that always lands as week 12 closes.
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
  SEATS, withStaff, marketFor, staffPlan, pipelineStrength, freshEconomy, facilityLevel, projectFacility,
  recruitingDirectiveMultiplier, staffProjectInjuryGuard, PIPELINE_MIN, type Economy, type StaffSeat,
} from '../src/engine/economy.js';
import {
  seasonGainFull, seasonGainOn, pipelineWeeklyGain, staffPicksSeasonWork, suggestedTargets, projectCandidates,
  PROJECT_FOCUS,
} from '../src/engine/staffProjects.js';
import { ceilingReading } from '../src/engine/ratings.js';
import { uniquePlayers } from '../src/engine/types.js';
import type { Hitter, Arm } from '../src/engine/types.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { recruitingWeeksLeft, seasonWorkOpens } from '../src/ui/StaffWorkPanel.js';
import { ProjectNote } from '../src/ui/screens/Player.js';

beforeEach(() => { disk.clear(); useDynasty.getState().newDynasty(); });

const s = () => useDynasty.getState();

/** A full staff and all three buildings at `level`, which is what the work needs. */
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
/** Every man on the team may grow, so a ceiling binds only where a test wants it to. */
function roomy(): void {
  const t = useDynasty.getState().season!.teams[0]!.team;
  for (const p of uniquePlayers([...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen])) p.potential = 99;
}
const bats = (): Hitter[] => uniquePlayers([
  ...useDynasty.getState().season!.teams[0]!.team.lineup,
  ...useDynasty.getState().season!.teams[0]!.team.bench,
]) as Hitter[];
const arms = (): Arm[] => uniquePlayers([
  ...useDynasty.getState().season!.teams[0]!.team.rotation,
  ...useDynasty.getState().season!.teams[0]!.team.bullpen,
]) as Arm[];
const work = (seat: StaffSeat) => staffPlan(s().economy, seat).project;
const weeks = (n: number): void => { for (let i = 0; i < n; i++) s().advanceRecruitingWeek(); };
const byId = <T extends { id: unknown }>(list: T[], id: string): T => list.find((p) => String(p.id) === id)!;

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

describe('season work needs the building that sizes it', () => {
  it('is refused with no building, and the building sets the size', () => {
    s().start(4242, 0);
    const eco = s().economy;
    const staff = { ...eco.staff };
    for (const seat of SEATS) staff[seat] = marketFor('probe', 2027, seat)[0]!;
    // Staffed, but nothing built.
    useDynasty.setState({ economy: { ...eco, staff, built: [], facilityLevels: {}, facilities: 0 } });
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(false);

    expect([1, 2, 3].map((l) => seasonGainFull(l, false, 12))).toEqual([2, 3, 4]);
    expect([1, 2, 3].map((l) => seasonGainFull(l, true, 12))).toEqual([3, 4, 5]);
    expect(seasonGainFull(0, true, 12)).toBe(0);
    // One week is never worth a point; half up from there.
    expect([1, 2, 3].map((l) => seasonGainFull(l, true, 1))).toEqual([0, 0, 0]);
    expect(seasonGainFull(1, false, 3)).toBe(1);
    expect(seasonGainFull(3, true, 6)).toBe(3);
  });

  it('takes one assignment at a time, on its own seat', () => {
    s().start(4242, 0); equip(); roomy();
    // A pitching kind cannot be started on the hitting seat.
    expect(s().startStaffProject('hitting', 'pitching-command')).toBe(false);
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(true);
    // And a second one is refused while the first runs.
    expect(s().startStaffProject('hitting', 'hitting-power')).toBe(false);
    expect(work('hitting')?.kind).toBe('hitting-contact');
    expect(work('hitting')?.season).toBe(true);
  });

  it('switching starts over for the weeks that are left', () => {
    s().start(4242, 0); equip(1); roomy();
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(true);
    weeks(2);
    expect(work('hitting')?.weeksRun).toBe(2);

    s().cancelStaffProject('hitting');
    expect(work('hitting')).toBeUndefined();
    expect(s().startStaffProject('hitting', 'hitting-power')).toBe(true);
    expect(work('hitting')).toMatchObject({ startedWeek: 3, weeksTotal: 10, weeksRun: 0 });
  });
});

describe('season work lands on the men it names', () => {
  it('contact work lands on its men as week 12 closes, and nothing else moves', () => {
    s().start(4242, 0); equip(1); roomy();
    s().setStaffDirective('hitting', 'contact');
    const contactBefore = new Map(bats().map((b) => [String(b.id), b.contact]));
    const powerBefore = new Map(bats().map((b) => [String(b.id), b.power]));
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(true);
    const targets = work('hitting')!.targetIds!;
    expect(targets.length).toBeGreaterThanOrEqual(1);
    expect(targets.length).toBeLessThanOrEqual(3);

    // Eleven weeks in, nothing has landed: the work is the whole season.
    weeks(11);
    expect(bats().every((b) => b.contact === contactBefore.get(String(b.id)))).toBe(true);
    expect(work('hitting')).toMatchObject({ weeksRun: 11, weeksLeft: 1 });

    weeks(1);
    const moved = bats().filter((b) => b.contact !== contactBefore.get(String(b.id)));
    expect(moved.map((m) => String(m.id)).sort()).toEqual([...targets].sort());
    for (const m of moved) expect(m.contact).toBe(contactBefore.get(String(m.id))! + 3);
    expect(bats().every((b) => b.power === powerBefore.get(String(b.id)))).toBe(true);
    expect(work('hitting')).toBeUndefined();

    const report = s().economy.projectHistory![0]!;
    expect(report).toMatchObject({
      season: true, weeksRun: 12, focused: true, gain: 3, coach: s().economy.staff.hitting!.name,
    });
    expect(report).not.toHaveProperty('took');
    // The report is the record; the season is quiet, so no letter (2026-09-28).
    expect(s().inbox.some((i) => / complete$/.test(i.title))).toBe(false);
  });

  it('velocity work is sized by the building', () => {
    s().start(4242, 0); equip(3); roomy();
    s().setStaffDirective('pitching', 'velocity');
    const before = new Map(arms().map((a) => [String(a.id), a.stuff]));
    expect(s().startStaffProject('pitching', 'pitching-velocity')).toBe(true);
    const targets = work('pitching')!.targetIds!;
    weeks(12);
    // A level-three pen and the matching focus: five a man.
    for (const id of targets) expect(byId(arms(), id).stuff).toBe(before.get(id)! + 5);
  });

  it('the building sets the payoff and the focus adds one', () => {
    const gains = (level: number, directive: 'contact' | 'power'): number[] => {
      s().newDynasty(); s().start(4242, 0); equip(level); roomy();
      s().setStaffDirective('hitting', directive);
      expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(true);
      const targets = work('hitting')!.targetIds!;
      const before = new Map(bats().map((b) => [String(b.id), b.contact]));
      weeks(12);
      return targets.map((id) => Math.round(byId(bats(), id).contact - before.get(id)!));
    };
    for (const [level, want] of [[1, 2], [2, 3], [3, 4]] as const) {
      expect(gains(level, 'power').every((g) => g === want)).toBe(true);
    }
    expect(gains(1, 'contact').every((g) => g === 3)).toBe(true);
  });

  it('a late start counts only the weeks it ran', () => {
    const late = (level: number, directive: 'contact' | 'power'): number[] => {
      s().newDynasty(); s().start(4242, 0); equip(level); roomy();
      s().setStaffDirective('hitting', directive);
      s().season!.recruiting.week = 7;
      expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(true);
      expect(work('hitting')!.weeksTotal).toBe(6);
      const targets = work('hitting')!.targetIds!;
      const before = new Map(bats().map((b) => [String(b.id), b.contact]));
      weeks(6);
      expect(work('hitting')).toBeUndefined();
      return targets.map((id) => Math.round(byId(bats(), id).contact - before.get(id)!));
    };
    // Two a man for a whole season at L1, so one for half of it.
    expect(late(1, 'power').every((g) => g === 1)).toBe(true);
    // Five at L3 with the focus: 2.5, which rounds up.
    expect(late(3, 'contact').every((g) => g === 3)).toBe(true);
  });

  it('the last week is too late for a coach, not for a coordinator', () => {
    s().start(4242, 0); equip(1); roomy();
    const home = s().season!.teams[0]!.def.state;
    s().season!.recruiting.week = 12;
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(false);
    // Naming the men skips the empty suggestion, so only the week's own gate refuses this.
    expect(s().startStaffProject('hitting', 'hitting-contact', undefined, [String(bats()[0]!.id)])).toBe(false);
    expect(s().startStaffProject('recruiting', 'pipeline-deepen', home)).toBe(true);
    s().season!.recruiting.week = 11;
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(true);
  });

  it('running work offers a change only while the store would start new work', () => {
    s().start(4242, 0); equip(1); roomy();
    const id = String(bats()[0]!.id);
    expect(seasonWorkOpens('hitting', 1, recruitingWeeksLeft(11))).toBe(true);
    expect([1, 2, 3].some((l) => seasonWorkOpens('hitting', l, recruitingWeeksLeft(12)))).toBe(false);
    expect(seasonWorkOpens('recruiting', 1, recruitingWeeksLeft(12))).toBe(true);
    for (const week of [10, 11, 12]) {
      s().season!.recruiting.week = week;
      const started = s().startStaffProject('hitting', 'hitting-contact', undefined, [id]);
      expect(started, `week ${week}`).toBe(seasonWorkOpens('hitting', 1, recruitingWeeksLeft(week)));
      s().cancelStaffProject('hitting');
    }
  });

  it('the ceiling caps the gain and is never passed', () => {
    s().start(4242, 0); equip(3); roomy();
    s().setStaffDirective('hitting', 'power');
    const man = bats()[0]!;
    // A fractional ceiling, so rounding it up (the bug ruling 5 names) would let him pass it.
    man.potential = ceilingReading(man) + 0.6;
    const potential = man.potential;
    const before = man.power;
    expect(s().startStaffProject('hitting', 'hitting-power', undefined, [String(man.id)])).toBe(true);
    weeks(12);
    expect(man.power - before).toBeLessThan(5);
    expect(man.potential).toBe(potential);
    expect(ceilingReading(man)).toBeLessThanOrEqual(man.potential);

    // Pure: a man at 99 takes nothing; a man with room takes all of it.
    const p = bats()[1]!;
    expect(seasonGainOn({ ...p, contact: 99 }, 'hitting-contact', 4)).toBe(0);
    expect(seasonGainOn({ ...p, potential: 99, contact: 50 }, 'hitting-contact', 4)).toBe(4);
  });

  it('a gain near 99 is a whole number and never passes 99', () => {
    s().start(4242, 0); equip(3); roomy();
    const p = bats()[0]!;
    // Ratings are floats: 97.3 once printed "+1.7000000000000028".
    expect(seasonGainOn({ ...p, potential: 99, power: 97.3 }, 'hitting-power', 3)).toBe(1);
    expect(seasonGainOn({ ...p, potential: 99, power: 96.6 }, 'hitting-power', 5)).toBe(2);
    expect(seasonGainOn({ ...p, potential: 99, power: 97 }, 'hitting-power', 3)).toBe(2);
    for (let tenth = 900; tenth <= 990; tenth++) {
      for (let full = 1; full <= 5; full++) {
        const power = tenth / 10;
        const g = seasonGainOn({ ...p, potential: 99, power }, 'hitting-power', full);
        expect(Number.isInteger(g), `${power} +${full}`).toBe(true);
        expect(power + g).toBeLessThanOrEqual(99);
      }
    }

    // And landing adds exactly what the preview printed.
    s().setStaffDirective('hitting', 'power');
    p.power = 96.6;
    expect(s().startStaffProject('hitting', 'hitting-power', undefined, [String(p.id)])).toBe(true);
    weeks(12);
    expect(p.power).toBeCloseTo(98.6);
    const change = s().economy.projectHistory![0]!.changes.find((c) => c.id === String(p.id))!;
    expect(change.after - change.before).toBe(2);
  });

  it('the player card calls a zero his ceiling only when the work paid something', () => {
    const note = (id: string): string => renderToStaticMarkup(
      createElement(ProjectNote, { p: byId(bats(), id), economy: s().economy }),
    );
    // Week 11, L1, no focus: two weeks round to nothing for a man with room to grow.
    s().start(4242, 0); equip(1); roomy();
    s().season!.recruiting.week = 11;
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(true);
    const late = work('hitting')!.targetIds![0]!;
    weeks(2);
    expect(s().economy.projectHistory![0]).toMatchObject({ season: true, gain: 0 });
    expect(note(late)).toContain('Too few weeks');
    expect(note(late)).not.toContain('ceiling');

    // A whole season on a man already at 99 is his ceiling.
    s().newDynasty(); s().start(4242, 0); equip(1); roomy();
    const top = bats()[0]!;
    top.contact = 99;
    expect(s().startStaffProject('hitting', 'hitting-contact', undefined, [String(top.id)])).toBe(true);
    weeks(12);
    expect(note(String(top.id))).toContain('At his ceiling');
  });

  it('it always lands: there is no roll', () => {
    s().start(4242, 0); equip(1); roomy();
    s().setStaffDirective('hitting', 'contact');
    const id = String(bats()[0]!.id);
    for (let i = 0; i < 8; i++) {
      useDynasty.setState({ year: 2030 + i });
      s().season!.recruiting.week = 1;
      byId(bats(), id).contact = 50;
      expect(s().startStaffProject('hitting', 'hitting-contact', undefined, [id])).toBe(true);
      weeks(12);
      expect(byId(bats(), id).contact).toBe(53);
    }
  });

  it('a last-week focus switch does not earn the bonus', () => {
    s().start(4242, 0); equip(); roomy();
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(true);
    weeks(11);
    s().setStaffDirective('hitting', 'contact');
    weeks(1);
    const report = s().economy.projectHistory![0]!;
    expect(report.focused).toBe(false);
    expect(report.changes.length).toBeGreaterThan(0);
    expect(report.changes.every((c) => c.after - c.before <= 2)).toBe(true);
  });

  it('keeps the men it named even if their ratings change', () => {
    s().start(4242, 0); equip(); roomy();
    s().setStaffDirective('hitting', 'contact');
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(true);
    const id = work('hitting')!.targetIds![0]!;
    const man = byId(bats(), id);
    man.contact = 85;
    weeks(12);
    expect(man.contact).toBe(88);
    const report = s().economy.projectHistory![0]!;
    expect(report.changes.some((c) => c.id === id && c.before === 85 && c.after === 88)).toBe(true);
  });

  it('is the men the coach picked, up to three', () => {
    s().start(4242, 0); equip(); roomy();
    const arm = arms().find((a) => a.type === 'pitcher')!;
    const ids = bats().map((b) => String(b.id));
    // A pitcher is not a hitting coach's man; four is one too many; nobody is nobody.
    expect(s().startStaffProject('hitting', 'hitting-power', undefined, [String(arm.id)])).toBe(false);
    expect(s().startStaffProject('hitting', 'hitting-power', undefined, ids.slice(0, 4))).toBe(false);
    expect(s().startStaffProject('hitting', 'hitting-power', undefined, ['nobody'])).toBe(false);
    const bench = ids.slice(-2);
    expect(s().startStaffProject('hitting', 'hitting-power', undefined, bench)).toBe(true);
    expect(work('hitting')!.targetIds).toEqual(bench);
  });
});

describe('a pipeline is built, not granted', () => {
  it('is built week by week', () => {
    s().start(4242, 0); equip(2);
    const home = s().season!.teams[0]!.def.state;
    // Home is already a relationship; there is nothing to build there.
    expect(pipelineStrength(s().economy, home, home)).toBeGreaterThanOrEqual(PIPELINE_MIN);
    expect(s().startStaffProject('recruiting', 'pipeline-build', home)).toBe(false);
    // A market the program has never worked: deepening is meaningless, building is not.
    expect(pipelineStrength(s().economy, 'ME', home)).toBe(0);
    expect(s().startStaffProject('recruiting', 'pipeline-deepen', 'ME')).toBe(false);
    // And recruiting work without a state is not work.
    expect(s().startStaffProject('recruiting', 'pipeline-build')).toBe(false);

    expect(s().startStaffProject('recruiting', 'pipeline-build', 'ME')).toBe(true);
    weeks(1);
    expect(s().economy.pipelines!.ME!.strength).toBe(12);
    weeks(1);
    expect(s().economy.pipelines!.ME!.strength).toBe(24);
    weeks(2);
    expect(pipelineStrength(s().economy, 'ME', home)).toBeGreaterThanOrEqual(PIPELINE_MIN);
    expect(work('recruiting')?.season).toBe(true);
    weeks(8);
    expect(work('recruiting')).toBeUndefined();
    const report = s().economy.projectHistory![0]!;
    expect(report.changes[0]).toMatchObject({ before: 0, after: pipelineStrength(s().economy, 'ME', home) });
  });

  it('pipeline work marks the state worked each week, and can start late', () => {
    s().start(4242, 0); equip(2);
    const home = s().season!.teams[0]!.def.state;
    s().season!.recruiting.week = 11;
    expect(s().startStaffProject('recruiting', 'pipeline-deepen', home)).toBe(true);
    expect(work('recruiting')!.weeksTotal).toBe(2);
    weeks(1);
    expect(s().economy.pipelines![home]!.strength).toBe(65);
    expect(s().economy.pipelines![home]!.lastWorkedYear).toBe(s().year);
    expect(s().economy.pipelines![home]!.signings).toBe(0);
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(false);
  });

  it('adds by the clubhouse, a little more with the focus, never past 100', () => {
    const eco = (level: number): Economy => ({ ...freshEconomy(), facilityLevels: { clubhouse: level } });
    expect(pipelineWeeklyGain(eco(1), 'pipeline-deepen', 50, false)).toBe(3);
    expect(pipelineWeeklyGain(eco(1), 'pipeline-deepen', 50, true)).toBe(4);
    // Build runs at the build rate below 43, the deepen rate from there.
    expect(pipelineWeeklyGain(eco(2), 'pipeline-build', 42, false)).toBe(12);
    expect(pipelineWeeklyGain(eco(2), 'pipeline-build', 43, false)).toBe(5);
    expect(pipelineWeeklyGain(eco(3), 'pipeline-deepen', 98, true)).toBe(2);
    expect(pipelineWeeklyGain(eco(0), 'pipeline-deepen', 50, true)).toBe(0);
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

describe('arm care protects all season', () => {
  it('is nothing without the work, deepens with the pen, and lasts to week 12', () => {
    s().start(4242, 0); equip(2); roomy();
    expect(staffProjectInjuryGuard(s().economy)).toBe(1);
    expect(s().startStaffProject('pitching', 'pitching-arm-care')).toBe(true);
    const atTwo = staffProjectInjuryGuard(s().economy);
    expect(atTwo).toBeLessThan(1);
    // A better pen protects harder.
    const eco = s().economy;
    expect(staffProjectInjuryGuard({ ...eco, facilityLevels: { ...eco.facilityLevels, pen: 3 } })).toBeLessThan(atTwo);

    const targets = work('pitching')!.targetIds!;
    const before = new Map(arms().map((a) => [String(a.id), a.stamina]));
    weeks(11);
    expect(staffProjectInjuryGuard(s().economy)).toBeLessThan(1);
    weeks(1);
    expect(staffProjectInjuryGuard(s().economy)).toBe(1);
    for (const id of targets) expect(byId(arms(), id).stamina).toBe(before.get(id)! + 3);
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
    s().start(4242, 0); equip(3); roomy();
    s().setStaffDirective('pitching', 'velocity');
    expect(s().startStaffProject('pitching', 'pitching-velocity')).toBe(true);
    weeks(1);
    const before = work('pitching')!;
    expect(before).toMatchObject({ weeksRun: 1, weeksLeft: 11 });

    await s().saveNow();
    const slot = s().loadedSlot!;
    s().newDynasty();
    expect(await s().loadSlot(slot)).toBe(true);

    const after = staffPlan(s().economy, 'pitching');
    expect(after.directive).toBe('velocity');
    expect(after.project).toMatchObject({
      kind: 'pitching-velocity', season: true, weeksRun: 1, weeksLeft: 11, targetIds: before.targetIds,
    });
  });
});

describe('season work is deliberate and keeps its record', () => {
  it('missing staff or building pauses the weeks run and the guard, not the calendar', () => {
    s().start(4242, 0); equip(); roomy();
    expect(s().startStaffProject('pitching', 'pitching-arm-care')).toBe(true);
    const eco = s().economy;
    useDynasty.setState({ economy: { ...eco, staff: { ...eco.staff, pitching: undefined } } });
    weeks(1);
    expect(work('pitching')).toMatchObject({ weeksRun: 0, weeksLeft: 11 });
    expect(staffProjectInjuryGuard(s().economy)).toBe(1);
    useDynasty.setState({ economy: { ...s().economy, staff: eco.staff, built: [], facilityLevels: {}, facilities: 0 } });
    weeks(1);
    expect(work('pitching')).toMatchObject({ weeksRun: 0, weeksLeft: 10 });
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

  it('a casual staff picks its own season work', () => {
    s().start(4242, 0); equip(); roomy();
    // The recruiting focus changes the board's multipliers, so the pick never touches it.
    const recruitingFocus = staffPlan(s().economy, 'recruiting').directive;
    useDynasty.setState({ depth: { ...s().depth, overrides: { ...s().depth.overrides, assistants: false } } });
    weeks(1);
    expect(staffPlan(s().economy, 'recruiting').directive).toBe(recruitingFocus);
    for (const seat of SEATS) {
      expect(work(seat)?.season, seat).toBe(true);
      expect(work(seat)?.weeksRun, seat).toBe(1);
    }
    for (const seat of ['hitting', 'pitching'] as const) {
      const plan = staffPlan(s().economy, seat);
      expect(plan.directive).toBe(PROJECT_FOCUS[plan.project!.kind]);
      expect(plan.project!.targetIds!.length).toBeGreaterThanOrEqual(1);
      expect(plan.project!.targetIds!.length).toBeLessThanOrEqual(3);
    }
    expect(work('recruiting')!.state).toBeTruthy();

    // A coach who runs his own staff is never picked for.
    s().newDynasty(); s().start(4242, 0); equip(); roomy();
    weeks(1);
    for (const seat of SEATS) expect(work(seat), seat).toBeUndefined();
  });

  it('letStaffPick starts the staff\'s pick for a full coach and leaves running work alone', () => {
    s().start(4242, 0); equip(); roomy();
    expect(s().startStaffProject('hitting', 'hitting-power')).toBe(true);
    const mine = work('hitting');
    // A full coach's focus leads the pick, and the pick leaves it as he set it.
    s().setStaffDirective('pitching', 'velocity');
    expect(s().letStaffPick()).toEqual(['pitching', 'recruiting']);
    const pitching = work('pitching')!;
    expect(pitching.season).toBe(true);
    expect(pitching.kind).toBe('pitching-velocity');
    expect(staffPlan(s().economy, 'pitching').directive).toBe('velocity');
    expect(pitching.targetIds).toEqual(
      suggestedTargets(s().economy, s().season!.teams[0]!.team, 'pitching', pitching.kind, 12),
    );
    expect(work('recruiting')?.state).toBeTruthy();
    expect(work('hitting')).toEqual(mine);
    // Nothing idle is left to pick for.
    expect(s().letStaffPick()).toEqual([]);
  });

  it('letStaffPick keeps a full coach\'s focus when it has nobody to work on', () => {
    s().start(4242, 0); equip(); roomy();
    for (const a of arms()) a.stamina = 99;
    s().setStaffDirective('pitching', 'armCare');
    expect(s().letStaffPick(['pitching'])).toEqual(['pitching']);
    expect(work('pitching')!.kind).not.toBe('pitching-arm-care');
    expect(staffPlan(s().economy, 'pitching').directive).toBe('armCare');
  });

  it('the staff pick is the same pure choice the engine makes', () => {
    s().start(4242, 0); equip(); roomy();
    const copy: Economy = structuredClone(s().economy);
    const team = s().season!.teams[0]!;
    const picked = staffPicksSeasonWork(copy, team.team, team.def.state, s().season!.recruiting.week, { seats: ['hitting'] });
    expect(picked).toEqual(['hitting']);
    expect(s().letStaffPick(['hitting'])).toEqual(['hitting']);
    expect(work('hitting')).toEqual(staffPlan(copy, 'hitting').project);
    expect(staffPlan(s().economy, 'hitting').directive).toBe(staffPlan(copy, 'hitting').directive);
  });

  it('an unfinished assignment does not cross the year; a casual staff picks the new one', async () => {
    s().start(4242, 0); equip(); roomy();
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(true);
    s().settleSeason();
    await s().rollYear();
    expect(work('hitting')).toBeUndefined();

    s().newDynasty(); s().start(4242, 0); equip(); roomy();
    useDynasty.setState({ depth: { ...s().depth, overrides: { ...s().depth.overrides, assistants: false } } });
    s().settleSeason();
    await s().rollYear();
    const eco = s().economy;
    let picked = 0;
    for (const seat of SEATS) {
      if (!eco.staff[seat] || facilityLevel(eco, projectFacility(seat)) < 1) continue;
      expect(work(seat), seat).toMatchObject({ season: true, startedWeek: 1 });
      picked += 1;
    }
    expect(picked).toBeGreaterThan(0);
  });

  it('saves the chosen players, earned focus weeks and results', async () => {
    s().start(4242, 0); equip(3); roomy();
    s().setStaffDirective('hitting', 'contact');
    expect(s().startStaffProject('hitting', 'hitting-contact')).toBe(true);
    weeks(1);
    const targets = work('hitting')!.targetIds;
    await s().saveNow();
    const slot = s().loadedSlot!;
    s().newDynasty(); await s().loadSlot(slot);
    expect(work('hitting')).toMatchObject({ season: true, targetIds: targets, alignedWeeks: 1, weeksRun: 1 });
    weeks(11);
    const result = structuredClone(s().economy.projectHistory);
    expect(result![0]!.season).toBe(true);
    await s().saveNow(); s().newDynasty(); await s().loadSlot(slot);
    expect(s().economy.projectHistory).toEqual(result);
  });

  it('a legacy project from an older save finishes the old way', async () => {
    s().start(4242, 0); equip(1);
    const team = s().season!.teams[0]!.team;
    const id = String(projectCandidates(team, 'hitting', 'hitting-contact')[0]!.id);
    const before = byId(bats(), id).contact;
    const eco = s().economy;
    useDynasty.setState({
      economy: {
        ...eco,
        staffPlans: {
          ...(eco.staffPlans ?? {}),
          hitting: {
            directive: 'contact',
            project: {
              kind: 'hitting-contact', weeksTotal: 5, weeksLeft: 2, startedWeek: 1,
              playerId: id, targetIds: [id], targetCount: 1, odds: 1, alignedWeeks: 3,
            },
          },
        },
      },
    });
    await s().saveNow();
    const slot = s().loadedSlot!;
    s().newDynasty(); await s().loadSlot(slot);
    expect(work('hitting')).toBeDefined();
    expect(work('hitting')).not.toHaveProperty('season');

    weeks(2);
    expect(work('hitting')).toBeUndefined();
    const report = s().economy.projectHistory![0]!;
    expect(report.took).toBe(true);
    expect(report.season).toBeUndefined();
    expect(byId(bats(), id).contact).toBe(Math.min(99, before + 3));
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
