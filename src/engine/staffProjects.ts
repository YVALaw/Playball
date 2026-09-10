import {
  facilityLevel, projectFacility, staffProjectWeeks, staffPlan, pipelineStrength,
  PIPELINE_MIN, PROJECT_LABEL, type Economy, type StaffSeat, type StaffDirective,
  type StaffProjectKind, type StaffProject, type StaffProjectResult,
} from './economy.js';
import { isTwoWay, uniquePlayers, type Team, type Player } from './types.js';

export const PROJECT_FOCUS: Record<StaffProjectKind, StaffDirective> = {
  'hitting-contact': 'contact', 'hitting-power': 'power', 'hitting-discipline': 'discipline',
  'pitching-command': 'command', 'pitching-velocity': 'velocity', 'pitching-arm-care': 'armCare',
  'pipeline-build': 'pipeline', 'pipeline-deepen': 'pipeline', 'pipeline-maintain': 'pipeline',
};
const FIELDS = {
  'hitting-contact': 'contact', 'hitting-power': 'power', 'hitting-discipline': 'eye',
  'pitching-command': 'control', 'pitching-velocity': 'stuff', 'pitching-arm-care': 'stamina',
} as const;
export const PROJECT_ATTRIBUTE: Record<StaffProjectKind, string> = {
  'hitting-contact': 'Contact', 'hitting-power': 'Power', 'hitting-discipline': 'Discipline',
  'pitching-command': 'Control', 'pitching-velocity': 'Stuff', 'pitching-arm-care': 'Stamina',
  'pipeline-build': 'Pipeline strength', 'pipeline-deepen': 'Pipeline strength', 'pipeline-maintain': 'Pipeline strength',
};
export const projectAligned = (kind: StaffProjectKind, directive: StaffDirective): boolean => PROJECT_FOCUS[kind] === directive;
export const projectCapacity = (eco: Economy, seat: StaffSeat): number => 2 + Math.max(1, facilityLevel(eco, projectFacility(seat)));
const fieldFor = (kind: StaffProjectKind) => FIELDS[kind as keyof typeof FIELDS];
function rating(p: Player, kind: StaffProjectKind): number {
  const field = fieldFor(kind);
  return field ? (p as unknown as Record<string, number>)[field] ?? 0 : 0;
}
export function projectCandidates(team: Team, seat: StaffSeat, kind: StaffProjectKind): Player[] {
  if (seat === 'recruiting') return [];
  const players: Player[] = seat === 'hitting' ? uniquePlayers([...team.lineup, ...team.bench])
    : uniquePlayers([...team.rotation, ...team.bullpen]).filter((p) => p.type === 'pitcher' || isTwoWay(p));
  return players.sort((a, b) => rating(a, kind) - rating(b, kind) || String(a.id).localeCompare(String(b.id)));
}
export function newStaffProject(eco: Economy, team: Team, seat: StaffSeat, kind: StaffProjectKind, week: number, state?: string): StaffProject {
  const weeks = staffProjectWeeks(eco, seat, kind);
  return {
    kind, state, weeksTotal: weeks, weeksLeft: weeks, startedWeek: week, alignedWeeks: 0, targetCount: projectCapacity(eco, seat),
    targetIds: projectCandidates(team, seat, kind).slice(0, projectCapacity(eco, seat) + 1).map((p) => String(p.id)),
  };
}
export function pipelineProjectGain(eco: Economy, kind: StaffProjectKind, current: number, focused: boolean): number {
  const base = kind === 'pipeline-build' ? Math.max(0, PIPELINE_MIN - current) + 8 : kind === 'pipeline-deepen' ? 14 : 4;
  return Math.min(100 - current, base + facilityLevel(eco, 'clubhouse') * 2 + (focused ? 4 : 0));
}

/** One real calendar week. Missing staff/facilities pause existing work. */
export function progressStaffProjects(eco: Economy, team: Team, home: string, year: number, week: number): StaffProjectResult[] {
  const results: StaffProjectResult[] = [];
  eco.staffPlans = { ...(eco.staffPlans ?? {}) };
  for (const seat of ['hitting', 'pitching', 'recruiting'] as const) {
    const plan = staffPlan(eco, seat);
    const project = plan.project;
    if (!project || !eco.staff[seat] || facilityLevel(eco, projectFacility(seat)) < 1) continue;
    const matched = projectAligned(project.kind, plan.directive);
    // Older saves have no weekly history. Preserve the focus they had saved.
    const prior = project.alignedWeeks ?? (matched ? project.weeksTotal - project.weeksLeft : 0);
    const next = {
      ...project, targetCount: project.targetCount ?? projectCapacity(eco, seat), weeksLeft: Math.max(0, project.weeksLeft - 1), alignedWeeks: prior + (matched ? 1 : 0),
      targetIds: project.targetIds ?? projectCandidates(team, seat, project.kind).slice(0, projectCapacity(eco, seat) + 1).map((p) => String(p.id)),
    };
    eco.staffPlans[seat] = { ...plan, project: next };
    if (next.weeksLeft > 0) continue;
    const focused = next.alignedWeeks >= Math.ceil(next.weeksTotal * 0.6);
    const result: StaffProjectResult = { kind: project.kind, seat, year, week, state: project.state, focused, changes: [] };
    if (seat === 'recruiting' && project.state) {
      const state = project.state;
      const before = pipelineStrength(eco, state, home);
      const after = before + pipelineProjectGain(eco, project.kind, before, focused);
      const old = eco.pipelines?.[state] ?? { state, strength: 0, signings: 0, lastSignedYear: 0 };
      eco.pipelines = { ...eco.pipelines, [state]: { ...old, strength: after, lastWorkedYear: year } };
      result.changes.push({ name: state, attribute: 'Pipeline strength', before, after });
    } else {
      const candidates = new Map(projectCandidates(team, seat, project.kind).map((p) => [String(p.id), p]));
      // Graduated/transferred players are not replaced with a surprise target.
      for (const id of next.targetIds.slice(0, next.targetCount + (focused ? 1 : 0))) {
        const p = candidates.get(id);
        const field = fieldFor(project.kind);
        if (!p || !field) continue;
        const before = rating(p, project.kind);
        const after = Math.min(99, before + (focused ? 2 : 1));
        (p as unknown as Record<string, number>)[field] = after;
        result.changes.push({ id, name: p.name, attribute: PROJECT_ATTRIBUTE[project.kind], before, after });
      }
    }
    results.push(result);
    eco.staffPlans[seat] = { ...plan, project: undefined };
  }
  if (results.length) eco.projectHistory = [...results, ...(eco.projectHistory ?? [])].slice(0, 9);
  return results;
}

export function projectResultText(result: StaffProjectResult): string {
  return `${PROJECT_LABEL[result.kind]} finished in week ${result.week}. ${result.changes.length
    ? result.changes.map((c) => `${c.name}: ${c.attribute} ${c.before} → ${c.after}`).join('; ') + '.'
    : 'The selected players are no longer on this roster; no ratings changed.'}${result.focused ? ' Matching focus earned the project bonus.' : ''}`;
}
