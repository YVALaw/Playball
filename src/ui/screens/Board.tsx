// Board.tsx
// Recruiting: this week's points, where you stand with each prospect, and
// what to do next.
//
// Points build a prospect's interest in you; at the end of each week a
// prospect who clearly prefers one program commits to it. The screen says as
// little as it can about that and shows the rest: every number carries its
// scale, and every status is a word and a colour.
//
// Laid out as the UI clarity review drew it (design/UI Clarity Review,
// Recruiting.dc.html, 2026-09-25): a band for the week and the class, the
// views and filters pinned over the list, and one race row per prospect —
// your share of his interest against the school leading for him. Planning his
// week happens on his sheet (RecruitSheet.tsx); the filters are set in their
// own (RecruitFilters.tsx).

import { useMemo, useState } from 'react';
import { recruitingPlan, programRecruitingPitch, delegateEffort } from '../../engine/recruitingPlan.js';
import {
  boardBudget, classSurvivors, staffListOf, suggestedStaffList, useDynasty, useUserTeam,
} from '../../state/store.js';
import {
  fit, canPursue, inPipeline, byRank, weekActionCost, totalWeekSpend, weeklyBudget,
  SCHOLARSHIPS, RECRUITING_WEEKS, reportedOverall, reportedPotential, scholarshipsPledged,
  type Prospect,
} from '../../engine/recruiting.js';
import { STAFF_LIST_MAX } from '../../engine/staffRecruiting.js';
import { walkOnShortfall, depthShortfall } from '../../engine/progression.js';
import { overallOf } from '../../engine/ratings.js';
import { CONFERENCES } from '../../data/schools.js';
import { prestigeStars } from '../../engine/program.js';
import { GodBolt } from '../god/GodBolt.js';
import { FirstVisit } from '../Tutorial.js';
import { Modal } from '../Modal.js';
import { withStaff, pipelineStrength, PIPELINE_MIN } from '../../engine/economy.js';
import { handles } from '../../state/depth.js';
import { isTwoWay } from '../../engine/types.js';
import type { Hitter, Pitcher, Player } from '../../engine/types.js';
import {
  ActionBar, Button, Callout, Card, cx, EmptyState, Face, List, ListRow, Marquee, PlayerRow, StatusBadge,
} from '../components/ui/index.js';
import { CLASS_NAME, plural } from '../words.js';
import { StepScreen } from './OffseasonStep.js';
import { FilterBar, FilterSheet } from './RecruitFilters.js';
import { RaceLegend, RecruitRow, type RowStar } from './RecruitRow.js';
import { ProspectSheet } from './RecruitSheet.js';
import { StaffPicker } from './StaffPicker.js';
import { StaffList } from './StaffList.js';
import { posName, raceOf, raceText, slotCode, slotOf, standing } from './recruitRace.js';

/** The board's views. `staff` is the staff list, shown only while the staff runs recruiting. */
type View = 'recruits' | 'targets' | 'commits' | 'needs' | 'roster' | 'staff';

/** The suggestion while the coach runs his own board: nothing, one stable reference. */
const NO_SUGGESTION: readonly never[] = [];

/**
 * What the board can be narrowed by.
 *
 * There were two sliders here, on reported overall and reported ceiling, and
 * they had to go: both of those are printed as *intervals* now, and a slider
 * against a band cannot mean anything precise. "At least sixty" against a
 * report that says forty to seventy is a question with no honest answer — the
 * old code answered it on the top of the band, which quietly meant a rookie
 * recruiter's filter excluded nobody at all. The star rating is the one measure
 * of quality on this screen that is a single value rather than a window, so it
 * is the one that can carry a filter.
 */
export interface Filters {
  pos: string | null;
  state: string | null;
  /** Star ratings to keep. Empty means every one of them. */
  stars: readonly number[];
  /** Only recruits in an active home, staff, or earned geographic pipeline. */
  pipelineOnly: boolean;
  /** Only recruits no program has put a point on yet. */
  untouchedOnly: boolean;
  /** Hide the men who will not take the call. */
  reachOnly: boolean;
}

/** The board's last filters, kept while the class is the same one. See the screen. */
const keptFilters: { year: number; filters: Filters } = { year: -1, filters: null as unknown as Filters };

export const NO_FILTERS: Filters = {
  pos: null, state: null, stars: [], pipelineOnly: false,
  untouchedOnly: false, reachOnly: false,
};

export const anyFilter = (f: Filters): boolean =>
  f.pos !== null || f.state !== null || f.stars.length > 0
  || f.pipelineOnly || f.untouchedOnly || f.reachOnly;

/**
 * Whether a recruit survives the filter set, at a program of this tier.
 *
 * Exported and pure so the panel can be held to what its labels say. Every
 * clause is an intersection: two stars picked is a union *within* the star
 * filter and nothing else changes about it, which is the one place a filter
 * panel can quietly mean the opposite of what it looks like.
 */
export function matchesFilters(
  p: Prospect, f: Filters, homeState: string, programStars: number,
  network: (p: Prospect) => number = (q) => inPipeline(q, homeState) ? 100 : 0,
): boolean {
  /*
    A two-way man answers to every door he can walk through: the SP chip
    finds his arm, the DH chip his bat, and his own row still reads
    TWO-WAY. Reported from the phone: Hood Hans was invisible under the
    one-star SP filter, which is exactly where a coach shopping for arms
    would look for him.
  */
  if (f.pos && slotOf(p) !== f.pos) {
    const tw = isTwoWay(p.player)
      && (f.pos === (p.player as { role?: string }).role || f.pos === p.player.pos);
    if (!tw) return false;
  }
  if (f.state && p.state !== f.state) return false;
  if (f.stars.length > 0 && !f.stars.includes(p.stars)) return false;
  if (f.pipelineOnly && network(p) < PIPELINE_MIN) return false;
  if (f.untouchedOnly && !untouched(p)) return false;
  if (f.reachOnly && !canPursue(p, programStars, network(p))) return false;
  return true;
}

/**
 * How many rows the board draws before it asks whether you meant it.
 *
 * Five hundred names is not a list anybody reads, and the top fifty by fit is
 * the answer to the question the screen is for. But a cap you cannot lift is a
 * cap that hides the class from a coach who has narrowed it deliberately, so
 * there is a button under the last row.
 */
export const ROW_CAP = 50;

/** Whether anybody at all has put a point on him. */
export const untouched = (p: Prospect): boolean =>
  !Object.values(p.points).some((v) => v > 0);

export type PinnedKind = 'close-filter' | 'end-week' | 'signing-day' | null;

/**
 * The one button pinned to the bottom, and the only place its label is decided.
 *
 * Reported from testing: the advance-week button stuck on "SHOW THE TOP 50 OF
 * 518" where END WEEK belonged. Filtering is a mode that swaps this button —
 * ending the week is irreversible and does not belong under the thumb while
 * somebody is tuning a filter — but the five view tabs sit in the *pinned
 * header*, which stays live in filter mode. Tapping ROSTER while the panel was
 * open changed the tab underneath it and left the mode on, so the screen looked
 * like the roster tab and the button still belonged to the filter. The tabs
 * leave the mode now, and the label is computed here, once, from state rather
 * than assembled at two branches of the JSX.
 *
 * Since the filter became a dialog (2026-09-15) the `filtersOpen` branch is
 * the dialog's own button rather than the frame's: the board underneath keeps
 * END WEEK, and the box over it says what closing it will show. Since the UI
 * clarity review (2026-09-25) the box says it in the review's words —
 * `showLabel`, "Show 42 prospects" — from the same three cases this branch
 * decides: nobody, the capped top of the list, or all of it.
 */
export function pinnedAction(
  s: {
    filtersOpen: boolean; live: boolean; week: number; matches: number; shown: number;
    /** False when the coordinator has the board. Defaults true for callers that predate it. */
    byHand?: boolean;
  },
): { kind: PinnedKind; label: string } {
  if (s.filtersOpen) {
    return {
      kind: 'close-filter',
      label: s.matches === 0
        ? 'NOBODY MATCHES · BACK TO THE BOARD'
        : s.shown < s.matches
          ? `SHOW THE TOP ${s.shown} OF ${s.matches}`
          : `SHOW ${s.matches} RECRUIT${s.matches === 1 ? '' : 'S'}`,
    };
  }
  if (!s.live) return { kind: null, label: '' };
  return s.week >= RECRUITING_WEEKS
    ? { kind: 'signing-day', label: 'SIGNING DAY' }
    // A delegated week is not a week the coach ends, it is one he watches go
    // by, and a button reading END WEEK over a board he cannot touch is the
    // screen telling him he did something he did not do.
    : { kind: 'end-week', label: s.byHand === false
        ? `YOUR COORDINATOR WORKS WEEK ${s.week}`
        : `END WEEK ${s.week}` };
}

/** The filter sheet's button: what the board shows once it closes. See `pinnedAction`. */
function showLabel(matches: number, shown: number): string {
  if (matches === 0) return 'Nobody matches';
  if (shown < matches) return `Show the top ${shown} of ${matches}`;
  return `Show ${plural(matches, 'prospect')}`;
}

/**
 * What the class has already covered, as the difference between two projections.
 *
 * NEEDS and the class review used to answer the same question two ways: the
 * review projected the walk-ons by replaying the roster rebuild, and this tab
 * counted signings against a list of holes handed to it by the draft step. They
 * disagreed, and the tab was the one lying — twice over. It read
 * `lastOffseason.holes`, which a reload did not restore then, so any dynasty picked
 * up mid-offseason showed an empty NEEDS tab and the words "every spot the
 * draft opened up is covered" over a roster that was four men short. And even
 * with the report in hand it counted a signed player against his own position
 * only, where the rebuild spends him on the first hole it comes to and fills
 * the bench out of whoever is left.
 *
 * Both tabs read `walkOnShortfall` now. What is still open is what it returns;
 * what is covered is what it stopped returning once the class was added.
 */
export function coveredSince(
  before: readonly { pos: string; count: number }[],
  after: readonly { pos: string; count: number }[],
): { pos: string; count: number }[] {
  const left = new Map(after.map((r) => [r.pos, r.count]));
  const out: { pos: string; count: number }[] = [];
  for (const row of before) {
    const done = row.count - (left.get(row.pos) ?? 0);
    if (done > 0) out.push({ pos: row.pos, count: done });
  }
  return out;
}

/**
 * On the targets view: anyone this program has ever spent on, until he is
 * resolved. One who commits here moves to Committed; one who signs elsewhere
 * stays, marked, so you learn who beat you.
 */
export const onYourBoard = (p: Prospect, userTeam: number): boolean =>
  p.signedBy !== userTeam
  && ((p.spent[userTeam] ?? 0) > 0 || weekActionCost(p, userTeam) > 0 || (p.points[userTeam] ?? 0) > 0);

/** The rows a view keeps for one visit, by id, in the order it opened with. */
export interface HeldRows { key: string; ids: readonly string[] }

/**
 * The rows a view keeps: the same ones while `key` holds, a fresh set of
 * `rows` under a new key, none without a key. Returns `prev` itself when
 * nothing changed, so a caller can tell.
 */
export function holdRows(prev: HeldRows | null, key: string | null, rows: readonly Prospect[]): HeldRows | null {
  if (key === null) return null;
  if (prev?.key === key) return prev;
  return { key, ids: rows.map((p) => p.id) };
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

export function Board() {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const coach = useDynasty((s) => s.coach);
  const recruitFor = useDynasty((s) => s.recruit);
  const recruitPitch = useDynasty((s) => s.recruitPitch);
  const recruitMajor = useDynasty((s) => s.recruitMajor);
  const advanceWeek = useDynasty((s) => s.advanceRecruitingWeek);
  // Whether he works his own board or his staff works the men he stars. The
  // board reads the same either way; the controls become the stars.
  const worksBoard = useDynasty((s) => handles(s.depth, 'recruiting'));
  const economy = useDynasty((s) => s.economy);
  const phase = useDynasty((s) => s.phase);
  const nextPhase = useDynasty((s) => s.nextPhase);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  // The staff list (2026-09-28).
  const staffList = useDynasty(staffListOf);
  const starRecruit = useDynasty((s) => s.starRecruit);
  const moveStaffRecruit = useDynasty((s) => s.moveStaffRecruit);
  const setStaffList = useDynasty((s) => s.setStaffList);
  const replaceLost = useDynasty((s) => s.replaceLostRecruits);
  const setReplaceLost = useDynasty((s) => s.setReplaceLostRecruits);

  const [view, setView] = useState<View>('recruits');
  // The coach's own picks for the staff list (StaffPicker), from an open slot.
  const [picking, setPicking] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Kept across visits for the same class; a new class starts clean.
  const year = useDynasty((s) => s.year);
  const [filters, setFiltersState] = useState<Filters>(
    () => (keptFilters.year === year ? keptFilters.filters : NO_FILTERS),
  );
  const setFilters = (next: Filters): void => {
    keptFilters.year = year;
    keptFilters.filters = next;
    setFiltersState(next);
  };
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [warnHoles, setWarnHoles] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  // The targets view's rows while the staff runs recruiting: see `heldKey`.
  const [heldTargets, setHeldTargets] = useState<HeldRows | null>(null);
  const lastWeek = useDynasty((s) => s.lastWeek);

  const pitch = useMemo(() => {
    if (!season || !team) return null;
    const conf = CONFERENCES.find((c) => c.id === team.conference);
    return programRecruitingPitch(season, team, conf?.region ?? 'Gulf', coach.prestige, economy);
  }, [season, team, version, economy, coach.prestige]);

  const myStars = team ? prestigeStars(team.prestige) : 1;
  const homeState = team?.def.state ?? '';
  const networkFor = (p: Prospect): number => pipelineStrength(economy, p.state, homeState);

  const {
    list, matches, targets, commits, spent, plannedOn, locked, shortfall, thin, covered, leaving,
  } = useMemo(() => {
    const all = season?.recruiting.prospects ?? [];
    // One gate, asked the same way everywhere on this screen.
    const reaches = (p: Prospect): boolean => canPursue(p, myStars, networkFor(p));

    const mine = all.filter((p) => onYourBoard(p, userTeam));
    const used = totalWeekSpend(all, userTeam);
    const signed = all.filter((p) => p.signedBy === userTeam);

    const open = all.filter((p) => p.signedBy === null);
    const shown = open.filter((p) => matchesFilters(p, filters, homeState, myStars, networkFor));
    const reachable = shown.filter(reaches);
    // Talent weighted by how well he fits what this program can sell.
    const ranked = pitch
      ? [...reachable].sort((a, b) => (b.stars * fit(b, pitch)) - (a.stars * fit(a, pitch)))
      : reachable;

    // Who will still be here when the class arrives: see `classSurvivors`,
    // which the staff's suggested list reads too.
    const { survivors, leaving } = season
      ? classSurvivors(season, userTeam, phase)
      : { survivors: [] as Player[], leaving: 0 };
    const classPlayers = signed.map((p) => p.player);
    const still = walkOnShortfall(survivors, classPlayers);
    // A starter with nobody who naturally covers him. An open spot is already
    // in the list above, so it is not said twice.
    const thin = depthShortfall(survivors, classPlayers)
      .filter((t) => !still.some((h) => h.pos === t.pos));

    const list = showAll ? ranked : ranked.slice(0, ROW_CAP);

    return {
      list,
      // What the filter caught, before the row cap.
      matches: reachable.length,
      targets: mine.slice().sort((a, b) => {
        // Unresolved first: those are the ones still worth a decision.
        const live = Number(a.signedBy !== null) - Number(b.signedBy !== null);
        return live || (b.points[userTeam] ?? 0) - (a.points[userTeam] ?? 0);
      }),
      // The class in the same national order the signing-day report reads in.
      commits: signed.slice().sort(byRank),
      spent: used,
      // How many men this week's points are spread across.
      plannedOn: open.filter((p) => (p.spent[userTeam] ?? 0) + weekActionCost(p, userTeam) > 0).length,
      locked: filters.reachOnly ? [] : shown.filter((p) => !reaches(p))
        .sort((a, b) => b.stars - a.stars).slice(0, 5),
      shortfall: still,
      thin,
      covered: coveredSince(walkOnShortfall(survivors, []), still),
      leaving,
    };
  }, [season, team, userTeam, version, pitch, myStars, homeState, filters, showAll, phase]);

  // What the staff would star, for the list's "Use these". Only read while the
  // staff runs recruiting.
  const suggestion = useMemo(
    () => (worksBoard ? NO_SUGGESTION : suggestedStaffList(season, userTeam, coach, economy, phase)),
    [worksBoard, season, userTeam, coach, economy, phase, version],
  );

  if (!season || !team || !pitch) return null;

  const week = season.recruiting.week;
  // What the class has still not covered, counted off the roster in front of
  // you. See `coveredSince`.
  const stillShort = shortfall.reduce((a, r) => a + r.count, 0);
  const open = season.recruiting.prospects.find((p) => p.id === openId) ?? null;
  // A week's points, after whatever the draft step spent keeping somebody. The
  // staff's week is the share of it the staff gets through (`delegateEffort`),
  // so the band never shows points left that nobody can spend.
  const weekly = worksBoard
    ? boardBudget(season, userTeam, economy.recruitingGrant)
    : Math.max(1, Math.round(weeklyBudget(myStars) * delegateEffort(economy)));
  const recruiterSkill = withStaff(coach.skills, economy.staff).recruiting;
  const left = weekly - spent;
  const live = week >= 1 && week <= RECRUITING_WEEKS;
  // The staff list view exists only while the staff runs recruiting; a coach
  // who takes the board back lands on the prospects.
  const current: View = view === 'staff' && worksBoard ? 'recruits' : view;
  const listFull = staffList.length >= STAFF_LIST_MAX;
  const byId = (id: string): Prospect | undefined => season.recruiting.prospects.find((p) => p.id === id);
  // A star tap replans the staff's whole week, which can take the last point
  // off a man (or put one on another), and `targets` would drop or add his row
  // under the thumb. So while the staff runs recruiting the targets view keeps
  // the rows it opened with until the coach leaves it or the week closes.
  // Points and signings move only at a close, so the held order stays right.
  const heldKey = !worksBoard && current === 'targets' ? `${userTeam}:${year}:${week}` : null;
  const held = holdRows(heldTargets, heldKey, targets);
  if (held !== heldTargets) setHeldTargets(held);
  const targetRows = held
    ? held.ids.map(byId).filter((p): p is Prospect => !!p && p.signedBy !== userTeam)
    : targets;
  const seasonMode = phase === null;
  // A yes this week holds a scholarship as surely as a signature (M88).
  const full = season ? scholarshipsPledged(season.recruiting.prospects, userTeam) >= SCHOLARSHIPS : commits.length >= SCHOLARSHIPS;
  const activeFilters = anyFilter(filters);
  const pinned = pinnedAction({
    filtersOpen: false, live: live && !seasonMode, week, matches, shown: list.length,
    byHand: worksBoard,
  });
  const activeTargetCount = (pos: string): number => targets.filter((p) => {
    if (p.signedBy !== null) return false;
    if (pos === 'BENCH') return p.player.type === 'hitter';
    if (slotOf(p) === pos) return true;
    return isTwoWay(p.player) && (p.player.pos === pos || (p.player as { role?: string }).role === pos);
  }).length;
  const uncoveredBoardNeeds = shortfall.filter((h) => activeTargetCount(h.pos) < h.count);
  const coordinator = economy?.staff?.recruiting;
  const schoolOf = (i: number): string => season.teams[i]?.def.school ?? 'another program';
  const rosterPlayers: Player[] = [...team.team.lineup, ...team.team.bench, ...team.team.rotation, ...team.team.bullpen];

  /** His star for the staff list, on the prospect and target views while the staff runs recruiting. */
  const starOf = (p: Prospect, reachable: boolean): RowStar | undefined => {
    if (worksBoard || !live || (current !== 'recruits' && current !== 'targets')) return undefined;
    const on = staffList.includes(p.id);
    return {
      on,
      available: on || (p.signedBy === null && reachable),
      disabled: !on && listFull,
      label: on ? `Unstar ${p.player.name}` : `Star ${p.player.name} for your staff`,
      onToggle: () => { starRecruit(p.id); },
    };
  };

  /** One prospect as a race row. */
  const row = (p: Prospect) => {
    const reachable = canPursue(p, myStars, networkFor(p));
    const ovr = reportedOverall(p, recruiterSkill);
    const pot = reportedPotential(p, recruiterSkill);
    const planned = p.signedBy === null ? (p.spent[userTeam] ?? 0) + weekActionCost(p, userTeam) : 0;
    // What this week's plan adds, on the same forecast his sheet shows.
    const gain = planned > 0
      ? recruitingPlan(p, pitch, {
        team: userTeam, actions: p.spent[userTeam] ?? 0, prestige: coach.prestige,
        skill: recruiterSkill, economy, roster: rosterPlayers,
      }).gain
      : 0;
    const race = raceOf(p, userTeam, gain);
    const committed = p.signedBy === userTeam;
    return (
      <RecruitRow
        key={p.id}
        prospect={p}
        facts={(
          <>
            <b>{slotCode(p)}</b> {p.state} · Now {ovr.low === ovr.high ? ovr.low : `${ovr.low}–${ovr.high}`}
            {' · '}Ceiling {pot.low === pot.high ? pot.low : `${pot.low}–${pot.high}`}
          </>
        )}
        status={standing(p, userTeam, schoolOf, reachable)}
        race={committed ? undefined : race}
        raceText={raceText(race, schoolOf)}
        note={committed ? (p.committedWeek ? `Committed in week ${p.committedWeek}` : 'Committed to you') : undefined}
        planned={planned}
        team={p.signedBy !== null ? season.teams[p.signedBy]?.def.abbr : undefined}
        onOpen={() => setOpenId(p.id)}
        star={starOf(p, reachable)}
      />
    );
  };

  const rows = current === 'recruits' ? list : current === 'targets' ? targetRows : commits;

  const onPinned = (): void => {
    const now = Date.now();
    if (now - lastTap < 600) return;
    setLastTap(now);
    if (pinned.kind === 'signing-day') { advanceWeek(); void nextPhase('recruiting'); }
    // The warning stops a coach ending week one with a need nobody on his
    // board covers; his coordinator cannot make that mistake.
    else if (pinned.kind === 'end-week' && worksBoard && week === 1 && uncoveredBoardNeeds.length > 0) setWarnHoles(true);
    else advanceWeek();
  };

  const views: [View, string, number][] = [
    ['recruits', 'Prospects', 0],
    ...(worksBoard ? [] : [['staff', 'Staff list', staffList.length] as [View, string, number]]),
    ['targets', 'Your targets', targetRows.length],
    ['commits', 'Committed', commits.length],
    ['needs', 'Positions needed', stillShort],
    ['roster', 'Your roster', 0],
  ];

  const page = (
    <main className="pb-page pb-rc-page">
      {/* The tip for the board he has: spending points and pitching are not
          his to do while the staff runs recruiting, starring is. */}
      {live && <FirstVisit id={worksBoard ? 'recruiting' : 'recruiting-staff'} />}
      <Marquee
        eyebrow={`${year} class · ${live ? `Week ${week} of ${RECRUITING_WEEKS}` : 'Closed'}`}
        title="Recruiting"
        trailing={<GodBolt target={{ kind: 'recruits' }} label="Edit the class in god mode" />}
      />

      <WeekBand
        live={live} left={left} weekly={weekly} spent={spent} plannedOn={plannedOn}
        signed={commits.length} week={week}
        staffName={worksBoard ? undefined : (coordinator?.name ?? 'Your staff')}
      />

      {live && lastWeek && (
        <Callout tone={lastWeek.yours.length > 0 ? 'positive' : 'neutral'} title={`Week ${lastWeek.closed} is over`}>
          {lastWeek.yours.length > 0 ? `Committed to you: ${lastWeek.yours.join(', ')}.` : 'Nobody committed to you.'}
          {lastWeek.gone > 0 ? ` ${plural(lastWeek.gone, 'prospect')} signed elsewhere.` : ''}
        </Callout>
      )}

      {/* Who runs recruiting is a career rule, set at creation, in the Season
          plan and in Settings; the board only says so, in one line. */}
      {/* With nobody starred the staff does nothing (2026-09-30), so the line
          says what to do instead, in as few words: one line either way. */}
      {live && !worksBoard && (
        <Callout
          tone="info"
          icon="star"
          title={staffList.length > 0 ? `${coordinator?.name ?? 'Your staff'} works your list` : 'Star recruits for your staff'}
        />
      )}

      <div className="pb-stickybar pb-rc-bar">
        <div className="pb-rc-views" role="group" aria-label="Recruiting">
          {views.map(([v, label, count]) => (
            <button
              key={v}
              type="button"
              aria-pressed={current === v}
              className={cx('pb-rc-view', current === v && 'is-on')}
              onClick={() => setView(v)}
            >
              {label}
              {/* The staff list's count shows from 0: a row's star changes it,
                  and a badge that came and went moved the tabs after it. */}
              {(count > 0 || v === 'staff') && <span className="pb-rc-view__n">{count}</span>}
            </button>
          ))}
        </div>
        {current === 'recruits' && (
          <FilterBar
            filters={filters}
            onOpen={() => { setOpenId(null); setFiltersOpen(true); }}
            onChange={setFilters}
            onClear={() => setFilters(NO_FILTERS)}
          />
        )}
      </div>

      {current === 'needs' ? (
        <NeedsView
          short={shortfall} thin={thin} covered={covered} leaving={leaving} targeted={activeTargetCount}
          // On top of the filters already set, not instead of them.
          onPick={(pos) => { setFilters({ ...filters, pos }); setView('recruits'); }}
        />
      ) : current === 'roster' ? (
        <RosterView />
      ) : current === 'staff' ? (
        <StaffList
          list={staffList.map(byId).filter((p): p is Prospect => !!p)}
          standIns={season.recruiting.staffStandIns ?? {}}
          byId={byId}
          userTeam={userTeam}
          programStars={myStars}
          week={week}
          reachable={(p) => canPursue(p, myStars, networkFor(p))}
          schoolOf={schoolOf}
          suggestion={suggestion}
          canSuggest={live}
          onUseSuggestion={() => setStaffList(suggestion)}
          onMove={moveStaffRecruit}
          onUnstar={(id) => { starRecruit(id); }}
          replaceLost={replaceLost}
          onReplaceLost={setReplaceLost}
          onPickSlot={live ? () => setPicking(true) : undefined}
        />
      ) : (
        <div className="pb-rc-listwrap">
          <div className="pb-rc-listhead">
            <div>
              <h2>
                {current === 'recruits' ? 'Prospects' : current === 'targets' ? 'Your targets' : 'Committed to you'}
                <span>{current === 'recruits' ? matches : rows.length}</span>
              </h2>
            </div>
            {/* The order, said once. The list's own line and this caption both
                said it, one of them as "Stars × fit". */}
            <small>{current === 'recruits' ? 'Stars and fit first' : current === 'targets' ? 'Most interest first' : 'By national rank'}</small>
          </div>

          {rows.length === 0 ? (
            current === 'recruits' && activeFilters ? (
              <EmptyState
                className="pb-rc-empty"
                title="No prospects match"
                text="Loosen a filter or clear them all."
                action={{ label: 'Clear filters', variant: 'tonal', onClick: () => setFilters(NO_FILTERS) }}
              />
            ) : (
              <EmptyState
                className="pb-rc-empty"
                title={current === 'targets' ? 'Nobody on your board yet'
                  : current === 'commits' ? 'No commitments yet' : 'Nobody available'}
              />
            )
          ) : (
            <div className="pb-rc-list">{rows.map(row)}</div>
          )}

          {current !== 'commits' && rows.length > 0 && <RaceLegend />}

          {current === 'recruits' && matches > list.length && (
            <Button variant="secondary" block onClick={() => setShowAll(true)}>Show all {matches}</Button>
          )}
          {current === 'recruits' && showAll && matches > ROW_CAP && (
            <Button variant="quiet" block onClick={() => setShowAll(false)}>Back to the top {ROW_CAP}</Button>
          )}

          {current === 'recruits' && locked.length > 0 && (
            <>
              <div className="pb-rc-listhead pb-rc-listhead--sub">
                <div><h2>Out of reach for now</h2></div>
              </div>
              <div className="pb-rc-list">{locked.map(row)}</div>
            </>
          )}
        </div>
      )}

      {picking && !worksBoard && (
        <StaffPicker
          prospects={season.recruiting.prospects}
          list={staffList}
          userTeam={userTeam}
          reachable={(p) => canPursue(p, myStars, networkFor(p))}
          schoolOf={schoolOf}
          onToggle={(id) => { starRecruit(id); }}
          onClose={() => setPicking(false)}
        />
      )}

      {filtersOpen && (
        <FilterSheet
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters(NO_FILTERS)}
          onClose={() => setFiltersOpen(false)}
          label={showLabel(matches, list.length)}
          none={matches === 0}
          homeState={homeState}
        />
      )}

      {warnHoles && (
        <Modal
          kicker="Week 1 · before it ends"
          title="Some needs have nobody on them"
          lines={[
            'New chases get harder once other programs bank a week of interest. Nobody on your board plays:',
            uncoveredBoardNeeds.map((h) => `${posName(h.pos)} (${h.count - activeTargetCount(h.pos)} open)`).join(', '),
          ]}
          action="End the week anyway"
          cancel={{ label: 'Go back to positions needed', onClick: () => { setWarnHoles(false); setView('needs'); } }}
          onClose={() => { setWarnHoles(false); advanceWeek(); }}
        />
      )}

      {open && (
        <ProspectSheet
          prospect={open}
          userTeam={userTeam}
          coachPrestige={coach.prestige}
          recruitingSkill={recruiterSkill}
          pitch={pitch}
          reachable={canPursue(open, myStars, networkFor(open))}
          pipeline={networkFor(open) >= PIPELINE_MIN}
          pipelineStrength={networkFor(open)}
          live={live}
          full={full && open.signedBy === null}
          left={left}
          weekly={weekly}
          week={week}
          schoolOf={schoolOf}
          onSet={(n) => recruitFor(open.id, n)}
          onPitch={(factor) => recruitPitch(open.id, factor)}
          onMajor={(action) => recruitMajor(open.id, action)}
          onClose={() => setOpenId(null)}
          staff={worksBoard ? undefined : {
            position: staffList.includes(open.id) ? staffList.indexOf(open.id) + 1 : null,
            full: listFull,
            onToggle: () => { starRecruit(open.id); },
          }}
        />
      )}
    </main>
  );

  // The old offseason board (kept for saves made before recruiting moved into
  // the season) ends its weeks from a pinned bar.
  if (pinned.kind === null) return page;
  return (
    <StepScreen
      bar={(
        <ActionBar note={pinned.kind === 'signing-day' ? 'The rest sign on signing day.' : undefined}>
          <Button variant="primary" iconAfter="arrow-right" onClick={onPinned}>
            {pinned.kind === 'signing-day' ? 'Go to signing day' : `End week ${week}`}
          </Button>
        </ActionBar>
      )}
    >{page}</StepScreen>
  );
}

// ---------------------------------------------------------------------------
// The week and the class
// ---------------------------------------------------------------------------

/**
 * The week's points and the class's scholarships side by side, and the
 * recruiting window under them, one pip a week.
 *
 * The planned line keeps two lines of room whatever it says: it changes while
 * the coach plans on a sheet over the board, and a band that grew a line would
 * push the whole list down under him. While the staff runs recruiting it says
 * who planned the week, since the coach did not.
 */
function WeekBand(
  { live, left, weekly, spent, plannedOn, signed, week, staffName }:
  {
    live: boolean; left: number; weekly: number; spent: number; plannedOn: number; signed: number; week: number;
    /** Who plans the week, while the staff runs recruiting. */
    staffName?: string;
  },
) {
  const openSpots = Math.max(0, SCHOLARSHIPS - signed);
  const planned = Math.max(0, Math.min(100, (spent / Math.max(1, weekly)) * 100));
  return (
    <section className="pb-rc-band" aria-label="This week">
      <div className="pb-rc-band__top">
        <div className="pb-rc-band__col">
          <span className="pb-rc-label">Points this week</span>
          <span className="pb-rc-band__big">
            <b>{live ? Math.max(0, left) : '–'}</b>
            {live && <i>/{weekly} left</i>}
          </span>
          <span className="pb-rc-band__bar" aria-hidden><i style={{ width: `${live ? planned : 0}%` }} /></span>
          <span className="pb-rc-band__line">
            {!live ? 'The class is closed'
              : staffName !== undefined
                ? (spent > 0 ? `${staffName} planned ${spent} on ${plural(plannedOn, 'prospect')}` : `${staffName} has nothing planned`)
                : spent > 0 ? `${spent} planned on ${plural(plannedOn, 'prospect')} · resets each week`
                  : 'Nothing planned yet · resets each week'}
          </span>
        </div>
        <div className="pb-rc-band__col">
          <span className="pb-rc-label">Scholarships</span>
          <span className="pb-rc-band__big"><b>{signed}</b><i>/{SCHOLARSHIPS} signed</i></span>
          <span className="pb-rc-band__pips" aria-hidden style={{ gridTemplateColumns: `repeat(${SCHOLARSHIPS}, minmax(0, 1fr))` }}>
            {Array.from({ length: SCHOLARSHIPS }, (_, i) => <i key={i} className={cx(i < signed && 'is-on')} />)}
          </span>
          <span className="pb-rc-band__line">{openSpots === 0 ? 'Class full' : plural(openSpots, 'open spot')}</span>
        </div>
      </div>
      <div className="pb-rc-band__window">
        <div className="pb-rc-band__wline">
          <span>Recruiting window</span>
          <span>
            {live
              ? <><b>Week {week}</b> of {RECRUITING_WEEKS} · signing day after week {RECRUITING_WEEKS}</>
              : 'Closed'}
          </span>
        </div>
        <span className="pb-rc-band__weeks" aria-hidden style={{ gridTemplateColumns: `repeat(${RECRUITING_WEEKS}, minmax(0, 1fr))` }}>
          {Array.from({ length: RECRUITING_WEEKS }, (_, i) => (
            <i key={i} className={cx(!live || i < week - 1 ? 'is-past' : i === week - 1 && 'is-now')} />
          ))}
        </span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Positions needed, and your roster
// ---------------------------------------------------------------------------

/**
 * What the class has not covered, read off the same projection the class
 * review uses: the roster standing here and the players you have signed. A
 * row is a walk-on who turns up in June at that position unless somebody
 * signs first, so tapping it filters the board to players who play there.
 */
function NeedsView(
  { short, thin, covered, leaving, targeted, onPick }:
  {
    short: readonly { pos: string; count: number }[];
    /** A starter and nobody who naturally covers him; see `depthShortfall`. */
    thin: readonly { pos: string; count: number }[];
    covered: readonly { pos: string; count: number }[];
    /** Players counted as gone in June, while the season is still on. */
    leaving: number;
    targeted: (pos: string) => number;
    onPick: (pos: string) => void;
  },
) {
  const total = short.reduce((a, r) => a + r.count, 0);
  return (
    <div className="pb-stack">
      <Callout
        tone={total === 0 ? 'positive' : 'warning'}
        title={total === 0 ? 'Every spot is covered' : `${plural(total, 'spot')} would go to walk-ons`}
      >
        {leaving > 0 ? `Counting ${plural(leaving, 'player')} leaving in June.` : undefined}
      </Callout>
      {short.length > 0 && (
        <List label="Open spots">
          {short.map((h) => {
            const on = targeted(h.pos);
            const open = Math.max(0, h.count - on);
            return (
              <ListRow
                key={h.pos}
                title={posName(h.pos)}
                subtitle={on === 0 ? 'Nobody on your board' : `${plural(on, 'target')} on your board`}
                value={open === 0
                  ? <StatusBadge tone="positive" icon={false}>Covered</StatusBadge>
                  : <StatusBadge tone="warning" icon={false}>{open} open</StatusBadge>}
                onClick={() => onPick(h.pos)}
              />
            );
          })}
        </List>
      )}
      {thin.length > 0 && (
        <section className="pb-rc-group">
          <span className="pb-rc-label">No backup</span>
          <List label="No backup">
            {thin.map((h) => (
              <ListRow
                key={`thin-${h.pos}`}
                title={posName(h.pos)}
                subtitle={targeted(h.pos) > 0 ? `${plural(targeted(h.pos), 'target')} on your board` : 'Nobody on your board'}
                onClick={() => onPick(h.pos)}
              />
            ))}
          </List>
        </section>
      )}
      {covered.length > 0 && (
        <section className="pb-rc-group">
          <span className="pb-rc-label">Covered by your class</span>
          <List label="Covered">
            {covered.map((h) => (
              <ListRow
                key={h.pos}
                title={posName(h.pos)}
                value={<StatusBadge tone="positive" icon={false}>{h.count > 1 ? `${h.count} filled` : 'Filled'}</StatusBadge>}
              />
            ))}
          </List>
        </section>
      )}
    </div>
  );
}

function RosterView() {
  const team = useUserTeam();
  const openPlayer = useDynasty((s) => s.openPlayer);
  if (!team) return null;
  const groups: [string, (Hitter | Pitcher)[]][] = [
    ['Lineup', team.team.lineup],
    ['Bench', team.team.bench],
    ['Rotation', team.team.rotation],
    ['Bullpen', team.team.bullpen],
  ];
  return (
    <>
      {groups.map(([label, players]) => (
        <Card key={label} title={label} eyebrow={plural(players.length, 'player')} flush>
          <List label={label}>
            {players.map((p) => {
              const code = p.type === 'pitcher' ? (p as Pitcher).role : p.pos;
              return (
                <PlayerRow
                  key={p.id}
                  name={p.name}
                  avatar={<Face id={p.id} team={team.def.abbr} size={36} />}
                  tags={[{ text: code, title: posName(code) }, CLASS_NAME[p.classYear]]}
                  value={overallOf(p)}
                  valueLabel="of 100"
                  onClick={() => openPlayer(p.id)}
                />
              );
            })}
          </List>
        </Card>
      ))}
    </>
  );
}
