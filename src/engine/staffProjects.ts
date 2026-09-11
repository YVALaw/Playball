import {
  facilityLevel, projectFacility, staffProjectWeeks, staffPlan, pipelineStrength, winterCraft,
  PIPELINE_MIN, PROJECT_LABEL, type Economy, type StaffSeat, type StaffDirective,
  type StaffProjectKind, type StaffProject, type StaffProjectResult,
} from './economy.js';
import { overallOf } from './ratings.js';
import { isTwoWay, uniquePlayers, type Team, type Player } from './types.js';

// ---------------------------------------------------------------------------
// A project is about a man
// ---------------------------------------------------------------------------
//
// Until 2026-09-10 a project took the lowest-rated men in a skill and handed
// each a point. The result had no name on it, which is why a coach was easy
// to forget. Now the coach picks ONE man as his project: the gain is bigger,
// it lands on his card with the coach's name, and it can fail to take — the
// odds are printed before the work starts and rolled off a hash when it ends,
// so a reload cannot re-roll it. Pipeline projects are still about a state.

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
/** What a project is worth to its man: two points, three with the matching focus. */
export const PROJECT_GAIN = 2;
export const PROJECT_FOCUS_GAIN = 3;

export const projectAligned = (kind: StaffProjectKind, directive: StaffDirective): boolean => PROJECT_FOCUS[kind] === directive;
/** How many men a legacy group project trained. Kept for saves with one in flight. */
export const projectCapacity = (eco: Economy, seat: StaffSeat): number => 2 + Math.max(1, facilityLevel(eco, projectFacility(seat)));
const fieldFor = (kind: StaffProjectKind) => FIELDS[kind as keyof typeof FIELDS];
function rating(p: Player, kind: StaffProjectKind): number {
  const field = fieldFor(kind);
  return field ? (p as unknown as Record<string, number>)[field] ?? 0 : 0;
}

/** The same stable string hash the rest of the engine derives with. */
function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/** The men a seat can make a project of, weakest in the skill first. */
export function projectCandidates(team: Team, seat: StaffSeat, kind: StaffProjectKind): Player[] {
  if (seat === 'recruiting') return [];
  const players: Player[] = seat === 'hitting' ? uniquePlayers([...team.lineup, ...team.bench])
    : uniquePlayers([...team.rotation, ...team.bullpen]).filter((p) => p.type === 'pitcher' || isTwoWay(p));
  return players.sort((a, b) => rating(a, kind) - rating(b, kind) || String(a.id).localeCompare(String(b.id)));
}

/**
 * How likely the man takes to the work.
 *
 * The coach's winter craft carries most of it; a man with room between what
 * he is and what he could be takes more readily; a skill already high is
 * harder to move. Printed on the option and on his card, stored on the
 * project when it starts, and rolled once when it ends.
 */
export function projectOdds(eco: Economy, seat: StaffSeat, p: Player, kind: StaffProjectKind): number {
  const coach = eco.staff[seat];
  if (!coach) return 0;
  const craft = winterCraft(coach);
  const headroom = Math.max(0, ((p as { potential?: number }).potential ?? overallOf(p)) - overallOf(p));
  const current = rating(p, kind);
  const odds = 0.45 + craft / 250 + Math.min(0.2, headroom / 150) - Math.max(0, current - 70) / 150;
  return Math.max(0.2, Math.min(0.95, odds));
}

export function newStaffProject(
  eco: Economy, team: Team, seat: StaffSeat, kind: StaffProjectKind, week: number, state?: string, playerId?: string,
): StaffProject {
  const weeks = staffProjectWeeks(eco, seat, kind);
  const base: StaffProject = { kind, state, weeksTotal: weeks, weeksLeft: weeks, startedWeek: week, alignedWeeks: 0 };
  if (seat === 'recruiting') return base;
  const pool = projectCandidates(team, seat, kind);
  const man = pool.find((p) => String(p.id) === playerId) ?? pool[0];
  if (!man) return base;
  return { ...base, playerId: String(man.id), targetIds: [String(man.id)], targetCount: 1, odds: projectOdds(eco, seat, man, kind) };
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
    } else if (project.playerId) {
      // The man, if he is still here. A man who left is not replaced.
      const candidates = new Map(projectCandidates(team, seat, project.kind).map((p) => [String(p.id), p]));
      const p = candidates.get(project.playerId);
      const field = fieldFor(project.kind);
      result.playerId = project.playerId;
      if (p && field) {
        const before = rating(p, project.kind);
        const odds = project.odds ?? projectOdds(eco, seat, p, project.kind);
        const roll = (stableHash(`${project.playerId}:${project.kind}:${year}:${week}:project`) % 1000) / 1000;
        const took = roll < odds;
        const after = took ? Math.min(99, before + (focused ? PROJECT_FOCUS_GAIN : PROJECT_GAIN)) : before;
        if (took) (p as unknown as Record<string, number>)[field] = after;
        result.took = took;
        result.changes.push({ id: project.playerId, name: p.name, attribute: PROJECT_ATTRIBUTE[project.kind], before, after });
      }
    } else {
      // A group project from a save before 2026-09-10, finished the old way.
      const candidates = new Map(projectCandidates(team, seat, project.kind).map((p) => [String(p.id), p]));
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
  const label = PROJECT_LABEL[result.kind];
  if (result.playerId) {
    const c = result.changes[0];
    if (!c) return `${label} finished in week ${result.week}, but the man it was about is no longer on this roster.`;
    if (result.took === false) return `${label} finished in week ${result.week}. ${c.name} did not take to it; nothing changed.`;
    /*
      The gain, not a claim about it. This said "the matching focus made it
      three" whatever the numbers printed beside it were, and at the 99 cap a
      focused project moves a man from 98 to 99 — so the sentence contradicted
      the two figures immediately before it.
    */
    const moved = c.after - c.before;
    return `${label} finished in week ${result.week}. ${c.name}: ${c.attribute} ${c.before} → ${c.after}.${result.focused ? ` The matching focus earned +${moved}.` : ''}`;
  }
  return `${label} finished in week ${result.week}. ${result.changes.length
    ? result.changes.map((c) => `${c.name}: ${c.attribute} ${c.before} → ${c.after}`).join('; ') + '.'
    : 'The selected players are no longer on this roster; no ratings changed.'}${result.focused ? ' Matching focus earned the project bonus.' : ''}`;
}
