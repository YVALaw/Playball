import {
  facilityLevel, projectFacility, staffPlan, pipelineStrength, winterCraft,
  PIPELINE_MIN, PROJECT_LABEL, SEATS, type Economy, type StaffSeat, type StaffDirective,
  type StaffProjectKind, type StaffProject, type StaffProjectResult, type StaffPlan,
} from './economy.js';
import { ceilingReading, overallOf, respectCeiling } from './ratings.js';
import { RECRUITING_WEEKS } from './recruiting.js';
import { isTwoWay, uniquePlayers, type Team, type Player } from './types.js';

// ---------------------------------------------------------------------------
// One assignment a season
// ---------------------------------------------------------------------------
//
// Until 2026-09-10 a project took the lowest-rated men in a skill and handed
// each a point; then it became one man, a few weeks and a rolled chance. Since
// 2026-09-28 each assistant runs ONE assignment a season: a coach names up to
// three of his men, and the work lands on them as recruiting week 12 closes.
// It always lands: +2/+3/+4 by building level, +1 with the matching focus,
// scaled by the weeks it actually ran, and never past a man's ceiling. A
// coordinator's pipeline work adds strength week by week. A legacy project
// still running in an older save finishes the old way (the branch below).

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
  // Words, not the scouting shorthand. The key stays `stuff` — this map is
  // display only — and "what even is stuff in pitching?" (2026-09-12) is why
  // neither the scouting word nor K/9 is printed: the design system names it
  // Strikeout stuff everywhere.
  'pitching-command': 'Control', 'pitching-velocity': 'Strikeout stuff', 'pitching-arm-care': 'Stamina',
  'pipeline-build': 'Pipeline strength', 'pipeline-deepen': 'Pipeline strength', 'pipeline-maintain': 'Pipeline strength',
};
/** Legacy: what a one-man project was worth to its man, two points, three with the matching focus. */
export const PROJECT_GAIN = 2;
export const PROJECT_FOCUS_GAIN = 3;

/** Each man's season payoff by the seat's building level (0 = locked). */
export const SEASON_GAIN = [0, 2, 3, 4] as const;
export const SEASON_FOCUS_BONUS = 1;
/** A coach names at most this many men for the season. */
export const SEASON_GROUP_MAX = 3;
/** The share of the weeks run that must be on the matching focus to earn the bonus. */
export const FOCUS_SHARE = 0.6;
export const SEAT_KINDS: Record<StaffSeat, readonly StaffProjectKind[]> = {
  hitting: ['hitting-contact', 'hitting-power', 'hitting-discipline'],
  pitching: ['pitching-command', 'pitching-velocity', 'pitching-arm-care'],
  recruiting: ['pipeline-build', 'pipeline-deepen', 'pipeline-maintain'],
};
/**
 * Pipeline strength a week, by clubhouse level. Derived from the legacy
 * per-project gain divided by the legacy length (build 45/47/49 over 5/4/3
 * weeks; deepen 16/18/20 over 5/4/3; maintain 6/8/10 over 3/2/2).
 */
export const PIPELINE_WEEKLY: Record<'pipeline-build' | 'pipeline-deepen' | 'pipeline-maintain', readonly [number, number, number, number]> = {
  'pipeline-build': [0, 9, 12, 16],
  'pipeline-deepen': [0, 3, 5, 7],
  'pipeline-maintain': [0, 2, 4, 5],
};
export const PIPELINE_FOCUS_WEEKLY = 1;
/** Build work turns into deepening once the state reaches this. */
export const BUILD_UNTIL = PIPELINE_MIN + 8; // 43

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

/** The men a seat can work with, weakest in the skill first. */
export function projectCandidates(team: Team, seat: StaffSeat, kind: StaffProjectKind): Player[] {
  if (seat === 'recruiting') return [];
  const players: Player[] = seat === 'hitting' ? uniquePlayers([...team.lineup, ...team.bench])
    : uniquePlayers([...team.rotation, ...team.bullpen]).filter((p) => p.type === 'pitcher' || isTwoWay(p));
  return players.sort((a, b) => rating(a, kind) - rating(b, kind) || String(a.id).localeCompare(String(b.id)));
}

/**
 * Legacy: how likely the man took to a one-man project.
 *
 * The coach's winter craft carries most of it; a man with room between what
 * he is and what he could be takes more readily; a skill already high is
 * harder to move. Stored on the project when it started, and rolled once
 * when it ends. Season work has no roll.
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

/** Legacy: a whole pipeline project's gain, landed at its end. */
export function pipelineProjectGain(eco: Economy, kind: StaffProjectKind, current: number, focused: boolean): number {
  const base = kind === 'pipeline-build' ? Math.max(0, PIPELINE_MIN - current) + 8 : kind === 'pipeline-deepen' ? 14 : 4;
  return Math.min(100 - current, base + facilityLevel(eco, 'clubhouse') * 2 + (focused ? 4 : 0));
}

// ---------------------------------------------------------------------------
// The payoff
// ---------------------------------------------------------------------------

/**
 * Each man's points: building size, +1 focus, scaled by weeks run. Integer
 * math before dividing, so 6/12 is exactly .5, and it rounds half up.
 */
export function seasonGainFull(level: number, focused: boolean, weeksRun: number): number {
  const lv = Math.max(0, Math.min(3, Math.round(level)));
  const w = Math.max(0, Math.min(RECRUITING_WEEKS, Math.round(weeksRun)));
  if (lv < 1 || w === 0) return 0;
  const full = SEASON_GAIN[lv]! + (focused ? SEASON_FOCUS_BONUS : 0);
  return Math.round((full * w) / RECRUITING_WEEKS);
}

/**
 * What he can take of `full` without his reading passing his ceiling. Pure:
 * works on a copy. The ceiling is his potential as a float, the way
 * `respectCeiling` compares it, so landing never raises it.
 */
export function seasonGainOn(p: Player, kind: StaffProjectKind, full: number): number {
  const field = fieldFor(kind);
  if (!field || full <= 0) return 0;
  const man = { ...p } as Player;
  const start = rating(p, kind);
  const ceiling = Math.max(p.potential, ceilingReading(p));
  let gain = 0;
  for (let step = 1; step <= full; step++) {
    // Whole steps only, and none past 99: ratings are floats, and a last
    // partial step printed as "+1.7000000000000028" (a natural number, 2026-09-16).
    if (start + step > 99) break;
    (man as unknown as Record<string, number>)[field] = start + step;
    if (ceilingReading(man) > ceiling) break;
    gain = step;
  }
  return gain;
}

/** A seat's men for this kind, each with his focused preview, in the staff's order. */
function rankTargets(eco: Economy, team: Team, seat: StaffSeat, kind: StaffProjectKind, weeks: number): Array<{ id: string; gain: number }> {
  if (seat === 'recruiting') return [];
  const full = seasonGainFull(facilityLevel(eco, projectFacility(seat)), true, weeks);
  return projectCandidates(team, seat, kind)
    .map((p, i) => ({ p, i, gain: seasonGainOn(p, kind, full), back: p.classYear !== 'SR' }))
    .filter((x) => x.gain > 0)
    // Men coming back next year first, then the biggest gain, then the weakest in the skill.
    .sort((a, b) => Number(b.back) - Number(a.back) || b.gain - a.gain || a.i - b.i)
    .slice(0, SEASON_GROUP_MAX)
    .map((x) => ({ id: String(x.p.id), gain: x.gain }));
}

/** The staff's suggested group: the picker's preselection, a casual staff's pick, `letStaffPick`. */
export function suggestedTargets(eco: Economy, team: Team, seat: StaffSeat, kind: StaffProjectKind, weeks: number): string[] {
  return rankTargets(eco, team, seat, kind, weeks).map((x) => x.id);
}

/** A season assignment starting this week. Replaces the legacy `newStaffProject`. */
export function newSeasonWork(
  eco: Economy, seat: StaffSeat, kind: StaffProjectKind, week: number,
  opts: { home: string; state?: string; targetIds?: readonly string[] },
): StaffProject {
  const weeks = Math.max(1, RECRUITING_WEEKS - week + 1);
  const base: StaffProject = { kind, season: true, weeksTotal: weeks, weeksLeft: weeks, startedWeek: week, alignedWeeks: 0, weeksRun: 0 };
  if (seat === 'recruiting') return opts.state ? { ...base, state: opts.state, from: pipelineStrength(eco, opts.state, opts.home) } : base;
  return { ...base, targetIds: [...(opts.targetIds ?? [])].slice(0, SEASON_GROUP_MAX) };
}

// ---------------------------------------------------------------------------
// Pipelines, week by week
// ---------------------------------------------------------------------------

export function pipelineWeeklyGain(eco: Economy, kind: StaffProjectKind, current: number, focused: boolean): number {
  const level = facilityLevel(eco, 'clubhouse');
  if (level < 1 || !kind.startsWith('pipeline-')) return 0;
  const k = kind === 'pipeline-build' && current >= BUILD_UNTIL ? 'pipeline-deepen' : kind as keyof typeof PIPELINE_WEEKLY;
  return Math.max(0, Math.min(100 - current, PIPELINE_WEEKLY[k][level]! + (focused ? PIPELINE_FOCUS_WEEKLY : 0)));
}

/** What `weeks` of this work would add to a state at `current`. */
export function pipelineSeasonPreview(eco: Economy, kind: StaffProjectKind, current: number, weeks: number, focused: boolean): number {
  let s = current;
  for (let i = 0; i < weeks; i++) s += pipelineWeeklyGain(eco, kind, s, focused);
  return s - current;
}

// ---------------------------------------------------------------------------
// The focus, as it stands
// ---------------------------------------------------------------------------

export type SeasonFocusState = 'earned' | 'on-track' | 'needs' | 'lost';

/** Whether season work will earn its focus bonus: the staff sheet and the player card both read it. */
export function seasonFocus(project: StaffProject, directive: StaffDirective): { state: SeasonFocusState; aligned: number; needed: number } {
  const aligned = project.alignedWeeks ?? 0;
  const final = (project.weeksRun ?? 0) + project.weeksLeft;
  const needed = Math.ceil(final * FOCUS_SHARE);
  const state: SeasonFocusState = aligned >= needed ? 'earned' : aligned + project.weeksLeft < needed ? 'lost'
    : PROJECT_FOCUS[project.kind] === directive ? 'on-track' : 'needs';
  return { state, aligned, needed };
}

/** Each man's points if it runs to week 12 with the focus as it stands now. */
export function seasonEach(eco: Economy, seat: StaffSeat, project: StaffProject, directive: StaffDirective): number {
  const f = seasonFocus(project, directive).state;
  return seasonGainFull(facilityLevel(eco, projectFacility(seat)), f === 'earned' || f === 'on-track',
    (project.weeksRun ?? 0) + project.weeksLeft);
}

// ---------------------------------------------------------------------------
// The staff's own pick
// ---------------------------------------------------------------------------

/** A coach's pick: the directive's kind when it has men to work on, otherwise the biggest total. */
function staffPickKind(eco: Economy, team: Team, seat: StaffSeat, weeks: number): { kind: StaffProjectKind; ids: string[] } | null {
  const directive = staffPlan(eco, seat).directive;
  const options = SEAT_KINDS[seat].map((kind) => {
    const ranked = rankTargets(eco, team, seat, kind, weeks);
    return { kind, ids: ranked.map((x) => x.id), total: ranked.reduce((n, x) => n + x.gain, 0) };
  });
  const matched = options.find((o) => o.total > 0 && PROJECT_FOCUS[o.kind] === directive);
  if (matched) return matched;
  let best: (typeof options)[number] | null = null;
  for (const o of options) if (o.total > 0 && (!best || o.total > best.total)) best = o;
  return best;
}

/**
 * A coordinator's pick: the state he knows, then the network strongest first,
 * then home; the first that is not full. Build below a pipeline, deepen above.
 */
function staffPickPipeline(eco: Economy, home: string): { kind: StaffProjectKind; state: string } | null {
  const own = eco.staff.recruiting?.pipelineState;
  const first = own && own !== home ? [own] : [];
  const others = Object.keys(eco.pipelines ?? {})
    .filter((st) => st !== home && !first.includes(st))
    .sort((a, b) => pipelineStrength(eco, b, home) - pipelineStrength(eco, a, home) || a.localeCompare(b));
  for (const state of [...first, ...others, home]) {
    if (!state || state.length < 2) continue;
    const strength = pipelineStrength(eco, state, home);
    if (strength >= 100) continue;
    return { kind: strength < PIPELINE_MIN ? 'pipeline-build' : 'pipeline-deepen', state };
  }
  return null;
}

/** What the staff would start on a seat, and the seat's directive after it. */
export interface StaffPick { kind: StaffProjectKind; targetIds?: string[]; state?: string; directive: StaffDirective }

/**
 * The staff's own season work for one seat, or null when it would start none:
 * no man, the building below L1, work already running, the week outside
 * 1-12, or (a coach) too late for a point or nobody with room to grow. Pure,
 * no rng. `alignFocus` turns the coach's focus to the work (a casual staff);
 * without it the focus changes only from Balanced. A coordinator's focus is
 * never touched: it prices the board.
 */
export function staffPickFor(
  eco: Economy, team: Team, home: string, seat: StaffSeat, week: number,
  opts: { alignFocus?: boolean } = {},
): StaffPick | null {
  if (week < 1 || week > RECRUITING_WEEKS) return null;
  if (!eco.staff[seat]) return null;
  const level = facilityLevel(eco, projectFacility(seat));
  if (level < 1) return null;
  const plan = staffPlan(eco, seat);
  if (plan.project) return null;
  const weeks = RECRUITING_WEEKS - week + 1;
  if (seat === 'recruiting') {
    const pick = staffPickPipeline(eco, home);
    return pick ? { ...pick, directive: plan.directive } : null;
  }
  if (seasonGainFull(level, true, weeks) < 1) return null;
  const pick = staffPickKind(eco, team, seat, weeks);
  if (!pick || pick.ids.length === 0) return null;
  const directive = opts.alignFocus || plan.directive === 'balanced' ? PROJECT_FOCUS[pick.kind] : plan.directive;
  return { kind: pick.kind, targetIds: pick.ids, directive };
}

/**
 * Start the staff's own season work on every idle seat it can (all seats by
 * default). Mutates `eco` in place, the same convention as
 * `progressStaffProjects`. Returns the seats started.
 */
export function staffPicksSeasonWork(
  eco: Economy, team: Team, home: string, week: number,
  opts: { seats?: readonly StaffSeat[]; alignFocus?: boolean } = {},
): StaffSeat[] {
  if (week < 1 || week > RECRUITING_WEEKS) return [];
  eco.staffPlans = { ...(eco.staffPlans ?? {}) };
  const started: StaffSeat[] = [];
  for (const seat of opts.seats ?? SEATS) {
    const pick = staffPickFor(eco, team, home, seat, week, { alignFocus: opts.alignFocus });
    if (!pick) continue;
    eco.staffPlans[seat] = {
      ...staffPlan(eco, seat),
      directive: pick.directive,
      project: newSeasonWork(eco, seat, pick.kind, week, { home, state: pick.state, targetIds: pick.targetIds }),
    };
    started.push(seat);
  }
  return started;
}

// ---------------------------------------------------------------------------
// The weeks
// ---------------------------------------------------------------------------

/** One calendar week of season work; its result when it lands as week 12 closes. */
function progressSeasonWork(
  eco: Economy, team: Team, home: string, year: number, week: number,
  seat: StaffSeat, plan: StaffPlan, project: StaffProject,
): StaffProjectResult | null {
  const level = facilityLevel(eco, projectFacility(seat));
  const running = !!eco.staff[seat] && level >= 1;
  const matched = projectAligned(project.kind, plan.directive);
  const next: StaffProject = {
    ...project,
    weeksLeft: Math.max(0, project.weeksLeft - 1), // the calendar always moves
    weeksRun: (project.weeksRun ?? 0) + (running ? 1 : 0), // pauses cost weeks run
    alignedWeeks: (project.alignedWeeks ?? 0) + (running && matched ? 1 : 0),
  };
  if (running && seat === 'recruiting' && project.state) {
    // Pipeline work adds its strength week by week.
    const before = pipelineStrength(eco, project.state, home);
    const add = pipelineWeeklyGain(eco, project.kind, before, matched);
    const old = eco.pipelines?.[project.state] ?? { state: project.state, strength: 0, signings: 0, lastSignedYear: 0 };
    eco.pipelines = { ...eco.pipelines, [project.state]: { ...old, strength: Math.min(100, before + add), lastWorkedYear: year } };
  }
  eco.staffPlans![seat] = { ...plan, project: next };
  if (week < RECRUITING_WEEKS) return null; // lands only as week 12 closes
  eco.staffPlans![seat] = { ...plan, project: undefined };
  const weeksRun = next.weeksRun ?? 0;
  if (weeksRun === 0) return null;
  const focused = (next.alignedWeeks ?? 0) >= Math.ceil(weeksRun * FOCUS_SHARE);
  const coach = eco.staff[seat]?.name;
  const result: StaffProjectResult = {
    kind: project.kind, seat, year, week, state: project.state, focused,
    season: true, weeksRun, ...(coach ? { coach } : {}), changes: [],
  };
  if (seat === 'recruiting') {
    if (project.state) {
      result.changes.push({
        name: project.state, attribute: 'Pipeline strength',
        before: project.from ?? 0, after: pipelineStrength(eco, project.state, home),
      });
    }
    return result;
  }
  const full = seasonGainFull(level, focused, weeksRun);
  result.gain = full;
  const field = fieldFor(project.kind);
  if (!field) return result;
  const men = new Map(projectCandidates(team, seat, project.kind).map((p) => [String(p.id), p]));
  for (const id of project.targetIds ?? []) {
    const p = men.get(id);
    if (!p) continue; // a man who left is not replaced
    const before = rating(p, project.kind);
    const gain = seasonGainOn(p, project.kind, full); // no roll: it always lands
    const after = gain > 0 ? Math.min(99, before + gain) : before;
    if (after !== before) {
      (p as unknown as Record<string, number>)[field] = after;
      respectCeiling(p);
    }
    result.changes.push({ id, name: p.name, attribute: PROJECT_ATTRIBUTE[project.kind], before, after });
  }
  return result;
}

/** One real calendar week. Season work always moves the calendar; missing staff or buildings pause legacy work. */
export function progressStaffProjects(eco: Economy, team: Team, home: string, year: number, week: number): StaffProjectResult[] {
  const results: StaffProjectResult[] = [];
  eco.staffPlans = { ...(eco.staffPlans ?? {}) };
  for (const seat of ['hitting', 'pitching', 'recruiting'] as const) {
    const plan = staffPlan(eco, seat);
    const project = plan.project;
    if (!project) continue;
    if (project.season) {
      const r = progressSeasonWork(eco, team, home, year, week, seat, plan, project);
      if (r) results.push(r);
      continue;
    }
    if (!eco.staff[seat] || facilityLevel(eco, projectFacility(seat)) < 1) continue;
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
    // Whole numbers. A rating is a float under development and the letter
    // printed it -- "contact 61.4 → 63.4" -- which reads as a different
    // scale from the card's (2026-09-16: "keep it at a natural number").
    const before = Math.round(c.before);
    const after = Math.round(c.after);
    const moved = after - before;
    return `${label} finished in week ${result.week}. ${c.name}: ${c.attribute} ${before} → ${after}.${result.focused ? ` The matching focus earned +${moved}.` : ''}`;
  }
  return `${label} finished in week ${result.week}. ${result.changes.length
    ? result.changes.map((c) => `${c.name}: ${c.attribute} ${Math.round(c.before)} → ${Math.round(c.after)}`).join('; ') + '.'
    : 'The selected players are no longer on this roster; no ratings changed.'}${result.focused ? ' Matching focus earned the project bonus.' : ''}`;
}
