// Board.tsx
// Recruiting: this week's points, where you stand with each prospect, and
// what to do next.
//
// Points build a prospect's interest in you; at the end of each week a
// prospect who clearly prefers one program commits to it. The screen says as
// little as it can about that and shows the rest: every number carries its
// scale, and every status is an icon, a word and a colour.
//
// Nothing on a prospect is a fact. His rating is a scouted range and his
// ceiling a span of grades, as wide as your recruiting skill is poor. A
// prospect out of your program's reach says so rather than quietly taking
// points for nothing.

import { useEffect, useMemo, useRef, useState } from 'react';
import { PROMISE_DETAIL } from '../../engine/morale.js';
import { recruitingPlan, programRecruitingPitch } from '../../engine/recruitingPlan.js';
import { boardBudget, PHASES, useDynasty, useUserTeam } from '../../state/store.js';
import {
  fit, canPursue, inPipeline, byRank,
  RECRUITING_FACTORS, RECRUITING_FACTOR_BLURB,
  recruitingPrioritiesOf, factorScore, factorGrade, wantedScore, pitchVerdict, weekActionCost, totalWeekSpend,
  hasRecruitingRelationship, PITCH_COST, HARD_SELL_COST, SWAY_COST, VISIT_COST,
  PROMISE_COST, PROMISE_LABEL, availableRecruitPromises,
  ASK_COST, ASK_COOLDOWN, askBlocked, decisionStyle, DECISION_LABEL,
  SCHOLARSHIPS, MAX_PER_RECRUIT, RECRUITING_WEEKS,
  reportedOverall, reportedPotential, reportedTool, hintsFor,
  type Prospect, type RecruitingFactor, type RecruitMajorInput, type PitchVerdict,
} from '../../engine/recruiting.js';
import { walkOnShortfall, depthShortfall, departureOdds } from '../../engine/progression.js';
import { pitchFor } from '../../engine/pitch.js';
import { overallOf } from '../../engine/ratings.js';
import { highSchoolLine } from '../../engine/scouting.js';
import { CONFERENCES, ALL_STATES } from '../../data/schools.js';
import { prestigeStars } from '../../engine/program.js';
import { GodBolt } from '../god/GodBolt.js';
import { FirstVisit } from '../Tutorial.js';
import { Modal } from '../Modal.js';
import { withStaff, pipelineStrength, pipelineLabel, PIPELINE_MIN } from '../../engine/economy.js';
import { handles } from '../../state/depth.js';
import { isTwoWay } from '../../engine/types.js';
import type { Hitter, Pitcher, Player, Position } from '../../engine/types.js';
import {
  ActionBar, Button, Callout, Card, Chip, Chips, ConfirmButton, cx, DescriptionList, EmptyState,
  Face, Icon, List, ListRow, Marquee, Meter, OptionCard, OptionGroup, PlayerRow, ProspectCard,
  SectionHeader, SegmentedControl, Sheet, Stars, StatGroup, StatusBadge, Step, Stepper, Switch,
  Table, Tag, type IconName, type Tone,
} from '../components/ui/index.js';
import { CLASS_NAME, HIGH_SCHOOL_WORD, POSITION_NAME, capsWords, handsText, plural, stateName } from '../words.js';
import { StepScreen } from './OffseasonStep.js';

type View = 'recruits' | 'targets' | 'commits' | 'needs' | 'roster';

/** A prospect's position code; a two-way man answers to both of his. */
const slotOf = (p: Prospect): string =>
  isTwoWay(p.player) ? 'TWO-WAY'
    : p.player.type === 'pitcher' ? (p.player as Pitcher).role : p.player.pos;

const POSITIONS: readonly (Position | 'SP' | 'RP')[] =
  ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'SP', 'RP'];

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
 * END WEEK, the box over it says what closing it will show, and both labels
 * still come from here.
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

/**
 * What the class has already covered, as the difference between two projections.
 *
 * NEEDS and the class review used to answer the same question two ways: the
 * review projected the walk-ons by replaying the roster rebuild, and this tab
 * counted signings against a list of holes handed to it by the draft step. They
 * disagreed, and the tab was the one lying — twice over. It read
 * `lastOffseason.holes`, which a reload does not restore, so any dynasty picked
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

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** A label the tested helpers write in capitals, as the screen says it. */
const say = (label: string): string => label.charAt(0) + label.slice(1).toLowerCase();

const posName = (code: string): string =>
  code === 'TWO-WAY' ? 'Two-way'
    : code === 'BENCH' ? 'Bench'
      : POSITION_NAME[code as Position | 'SP' | 'RP'] ?? code;

/** The factor as a pitch tile has room to say it. */
const FACTOR_SHORT: Record<RecruitingFactor, string> = {
  tradition: 'Tradition',
  coach: 'Coach',
  conference: 'Conference',
  playingTime: 'Playing time',
  winning: 'Winning now',
  development: 'Development',
  facilities: 'Facilities',
  proximity: 'Close to home',
  proPipeline: 'Path to pros',
};

/** Your grade against his want, as the engine weighs a pitch on it. */
const VERDICT: Record<PitchVerdict, { word: string; tone: 'positive' | 'muted' | 'warning' | 'negative'; icon: IconName }> = {
  strong: { word: 'Strong', tone: 'positive', icon: 'check-circled' },
  fair: { word: 'Fair', tone: 'muted', icon: 'minus-circled' },
  thin: { word: 'Thin', tone: 'warning', icon: 'alert' },
  hollow: { word: 'Backfires', tone: 'negative', icon: 'cross-circled' },
};

/** His interest in you as a share of all of it, and who leads. */
function interestShare(p: Prospect, team: number): { any: boolean; you: number; leader: number; leaderTeam: number | null } {
  const entries = Object.entries(p.points).map(([t, v]) => ({ t: Number(t), v })).filter((e) => e.v > 0);
  const total = entries.reduce((a, e) => a + e.v, 0);
  if (total <= 0) return { any: false, you: 0, leader: 0, leaderTeam: null };
  const lead = [...entries].sort((a, b) => b.v - a.v)[0]!;
  return {
    any: true,
    you: Math.round(((p.points[team] ?? 0) / total) * 100),
    leader: Math.round((lead.v / total) * 100),
    leaderTeam: lead.t,
  };
}

/** Where you stand with him: the chase, or how it ended. */
function chase(
  p: Prospect, userTeam: number, schoolOf: (i: number) => string, reachable: boolean,
): { tone: Tone; label: string; icon?: IconName } {
  if (p.signedBy === userTeam) return { tone: 'positive', label: 'Committed to you' };
  if (p.signedBy !== null) return { tone: 'negative', label: `Signed with ${schoolOf(p.signedBy)}` };
  if (!reachable) return { tone: 'neutral', icon: 'lock', label: 'Out of reach' };
  const points = Object.values(p.points).filter((v) => v > 0);
  const best = points.length ? Math.max(...points) : 0;
  const mine = p.points[userTeam] ?? 0;
  if (best <= 0) return { tone: 'neutral', label: 'Nobody on him yet' };
  if (mine <= 0) return { tone: 'neutral', label: 'Others are on him' };
  if (mine >= best) return { tone: 'positive', label: 'You lead' };
  const behind = (best - mine) / best;
  if (behind < 0.2) return { tone: 'info', label: 'Close behind' };
  if (behind < 0.5) return { tone: 'warning', label: 'Behind' };
  return { tone: 'negative', icon: 'alert', label: 'Far behind' };
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
  // Whether he works his own board or watches his coordinator work it. The
  // board reads the same either way; only the controls go.
  const worksBoard = useDynasty((s) => handles(s.depth, 'recruiting'));
  const economy = useDynasty((s) => s.economy);
  const phase = useDynasty((s) => s.phase);
  const nextPhase = useDynasty((s) => s.nextPhase);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();

  const [view, setView] = useState<View>('recruits');
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
    list, matches, targets, commits, spent, locked, shortfall, thin, covered, leaving,
  } = useMemo(() => {
    const all = season?.recruiting.prospects ?? [];
    // One gate, asked the same way everywhere on this screen.
    const reaches = (p: Prospect): boolean => canPursue(p, myStars, networkFor(p));

    // Anyone this program has ever spent on stays a target until he is
    // resolved. One who commits here moves to Committed; one who signs
    // elsewhere stays, marked, so you learn who beat you.
    const mine = all.filter(
      (p) => p.signedBy !== userTeam
        && ((p.spent[userTeam] ?? 0) > 0 || weekActionCost(p, userTeam) > 0 || (p.points[userTeam] ?? 0) > 0),
    );
    const used = totalWeekSpend(all, userTeam);
    const signed = all.filter((p) => p.signedBy === userTeam);

    const open = all.filter((p) => p.signedBy === null);
    const shown = open.filter((p) => matchesFilters(p, filters, homeState, myStars, networkFor));
    const reachable = shown.filter(reaches);
    const ranked = pitch
      ? [...reachable].sort((a, b) => (b.stars * fit(b, pitch)) - (a.stars * fit(a, pitch)))
      : reachable;

    const roster: Player[] = team
      ? [...team.team.lineup, ...team.team.bench, ...team.team.rotation, ...team.team.bullpen]
      : [];
    // Who will still be here when the class arrives. Until the draft step runs
    // the departures, seniors and anyone likelier than not to be drafted
    // (`departureOdds`, the odds the draw is made against) count as gone.
    const departed = phase !== null && PHASES.indexOf(phase) >= PHASES.indexOf('draft');
    const survivors = departed
      ? roster
      : roster.filter((p) => p.classYear !== 'SR' && departureOdds(p) < 0.5);
    const leaving = roster.length - survivors.length;
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
      locked: filters.reachOnly ? [] : shown.filter((p) => !reaches(p))
        .sort((a, b) => b.stars - a.stars).slice(0, 5),
      shortfall: still,
      thin,
      covered: coveredSince(walkOnShortfall(survivors, []), still),
      leaving,
    };
  }, [season, team, userTeam, version, pitch, myStars, homeState, filters, showAll, phase]);

  if (!season || !team || !pitch) return null;

  const week = season.recruiting.week;
  // What the class has still not covered, counted off the roster in front of
  // you. See `coveredSince`.
  const stillShort = shortfall.reduce((a, r) => a + r.count, 0);
  const open = season.recruiting.prospects.find((p) => p.id === openId) ?? null;
  // A week's points, after whatever the draft step spent keeping somebody.
  const weekly = boardBudget(season, userTeam, economy.recruitingGrant);
  const recruiterSkill = withStaff(coach.skills, economy.staff).recruiting;
  const left = weekly - spent;
  const live = week >= 1 && week <= RECRUITING_WEEKS;
  const seasonMode = phase === null;
  const full = commits.length >= SCHOLARSHIPS;
  const activeFilters = anyFilter(filters);
  const pinned = pinnedAction({
    filtersOpen: false, live: live && !seasonMode, week, matches, shown: list.length,
    byHand: worksBoard,
  });
  // The filter sheet's own button, off the same function: it says what the
  // board will show when the sheet closes.
  const filterLabel = pinnedAction({
    filtersOpen: true, live: live && !seasonMode, week, matches, shown: list.length,
  }).label;
  const activeTargetCount = (pos: string): number => targets.filter((p) => {
    if (p.signedBy !== null) return false;
    if (pos === 'BENCH') return p.player.type === 'hitter';
    if (slotOf(p) === pos) return true;
    return isTwoWay(p.player) && (p.player.pos === pos || (p.player as { role?: string }).role === pos);
  }).length;
  const uncoveredBoardNeeds = shortfall.filter((h) => activeTargetCount(h.pos) < h.count);
  const coordinator = economy?.staff?.recruiting;
  const schoolOf = (i: number): string => season.teams[i]?.def.school ?? 'another program';

  const card = (p: Prospect) => {
    const reachable = canPursue(p, myStars, networkFor(p));
    const status = chase(p, userTeam, schoolOf, reachable);
    const share = interestShare(p, userTeam);
    const ovr = reportedOverall(p, recruiterSkill);
    const pot = reportedPotential(p, recruiterSkill);
    const priorities = recruitingPrioritiesOf(p);
    const wants = [...RECRUITING_FACTORS].sort((a, b) => priorities[b] - priorities[a]).slice(0, 3);
    const thisWeek = (p.spent[userTeam] ?? 0) + weekActionCost(p, userTeam);
    const rival = share.leaderTeam !== null && share.leaderTeam !== userTeam ? schoolOf(share.leaderTeam) : undefined;
    const canWork = p.signedBy === null && reachable && live && worksBoard && !full;
    const chasing = p.signedBy === null && (p.points[userTeam] ?? 0) > 0;
    return (
      <ProspectCard
        key={p.id}
        className={thisWeek > 0 && p.signedBy === null ? 'is-targeted' : chasing ? 'is-chasing' : undefined}
        id={p.id}
        team={p.signedBy !== null ? season.teams[p.signedBy]?.def.abbr : undefined}
        name={p.player.name}
        tags={[slotOf(p) === 'TWO-WAY' ? 'Two-way' : slotOf(p), p.state]}
        meta={thisWeek > 0 && p.signedBy === null ? `${thisWeek} pts this week` : undefined}
        stars={p.stars}
        rank={p.rank}
        ratingLow={ovr.low}
        ratingHigh={ovr.high}
        ratingNote="of 100"
        ceiling={pot.low === pot.high ? pot.low : `${pot.low} to ${pot.high}`}
        ceilingNote="D to S"
        status={status}
        interest={share.any && p.signedBy === null
          ? { you: share.you, leader: rival ? share.leader : undefined, leaderName: rival }
          : undefined}
        wants={wants.map((k) => ({ text: FACTOR_SHORT[k], fit: ['strong', 'fair'].includes(pitchVerdict(p, pitch, k)) }))}
        action={canWork
          ? {
            label: thisWeek > 0 ? 'Change his week' : 'Plan his week',
            variant: thisWeek > 0 ? 'secondary' : 'tonal',
            onClick: () => setOpenId(p.id),
          }
          : undefined}
        onOpen={() => setOpenId(p.id)}
      />
    );
  };

  const rows = view === 'recruits' ? list : view === 'targets' ? targets : commits;

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

  const page = (
    <main className="pb-page">
      {live && <FirstVisit id="recruiting" />}
      <Marquee
        eyebrow={`${year} class · ${live ? `Week ${week} of ${RECRUITING_WEEKS}` : 'Closed'}`}
        title="Recruiting"
        trailing={<GodBolt target={{ kind: 'recruits' }} label="Edit the class in god mode" />}
      />

      <Card
        eyebrow="This week"
        title={live ? `${Math.max(0, left)} of ${weekly} points left` : 'The class is closed'}
        trailing={live ? <StatusBadge tone="neutral" icon="clock">Resets weekly</StatusBadge> : undefined}
      >
        {live && (
          <Meter value={Math.max(0, left)} max={Math.max(1, weekly)} ariaLabel="Points left this week" />
        )}
        <StatGroup
          size="sm"
          items={[
            { label: 'Scholarships', value: `${commits.length} of ${SCHOLARSHIPS}`, note: full ? 'Class full' : undefined },
            { label: 'Program pull', value: <Stars value={myStars} label="Program pull" /> },
          ]}
        />
      </Card>

      {live && lastWeek && (
        <Callout tone={lastWeek.yours.length > 0 ? 'positive' : 'neutral'} title={`Week ${lastWeek.closed} is over`}>
          {lastWeek.yours.length > 0 ? `Committed to you: ${lastWeek.yours.join(', ')}.` : 'Nobody committed to you.'}
          {lastWeek.gone > 0 ? ` ${plural(lastWeek.gone, 'prospect')} signed elsewhere.` : ''}
        </Callout>
      )}

      {live && !worksBoard && (
        <Callout tone="info" title={coordinator ? `${coordinator.name} works your board` : 'Your staff works your board'}>
          Change it in Settings.
        </Callout>
      )}

      <div className="pb-stickybar">
      <Chips label="Recruiting">
        <Chip selected={view === 'recruits'} onClick={() => setView('recruits')}>Prospects</Chip>
        <Chip selected={view === 'targets'} count={targets.length || undefined} onClick={() => setView('targets')}>Your targets</Chip>
        <Chip selected={view === 'commits'} count={commits.length || undefined} onClick={() => setView('commits')}>Committed</Chip>
        <Chip selected={view === 'needs'} count={stillShort || undefined} onClick={() => setView('needs')}>Positions needed</Chip>
        <Chip selected={view === 'roster'} onClick={() => setView('roster')}>Your roster</Chip>
      </Chips>
      </div>

      {view === 'needs' ? (
        <NeedsView
          short={shortfall} thin={thin} covered={covered} leaving={leaving} targeted={activeTargetCount}
          // On top of the filters already set, not instead of them.
          onPick={(pos) => { setFilters({ ...filters, pos }); setView('recruits'); }}
        />
      ) : view === 'roster' ? (
        <RosterView />
      ) : (
        <div className="pb-stack">
          <SectionHeader
            title={view === 'recruits' ? 'Prospects' : view === 'targets' ? 'Your targets' : 'Committed to you'}
            count={view === 'recruits' ? matches : rows.length}
            action={view === 'recruits'
              ? { label: activeFilters ? 'Filters on' : 'Filter', onClick: () => { setOpenId(null); setFiltersOpen(true); } }
              : undefined}
          />
          {view === 'recruits' && activeFilters && (
            <Button variant="quiet" size="sm" icon="cross" onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button>
          )}
          {rows.length === 0 ? (
            <EmptyState
              icon={view === 'recruits' ? 'search' : 'person'}
              title={view === 'targets' ? 'Nobody on your board yet'
                : view === 'commits' ? 'No commitments yet'
                  : activeFilters ? 'Nobody matches' : 'Nobody available'}
            />
          ) : rows.map(card)}

          {view === 'recruits' && matches > list.length && (
            <Button variant="secondary" block onClick={() => setShowAll(true)}>Show all {matches}</Button>
          )}
          {view === 'recruits' && showAll && matches > ROW_CAP && (
            <Button variant="quiet" block onClick={() => setShowAll(false)}>Back to the top {ROW_CAP}</Button>
          )}

          {view === 'recruits' && locked.length > 0 && (
            <>
              <SectionHeader title="Out of reach for now" />
              {locked.map(card)}
            </>
          )}
        </div>
      )}

      {filtersOpen && (
        <FilterSheet
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters(NO_FILTERS)}
          onClose={() => setFiltersOpen(false)}
          label={say(filterLabel)}
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
          // The same effective skill the week's close will spend.
          recruitingSkill={recruiterSkill}
          pitch={pitch}
          reachable={canPursue(open, myStars, networkFor(open))}
          pipeline={networkFor(open) >= PIPELINE_MIN}
          pipelineStrength={networkFor(open)}
          live={live}
          full={full && open.signedBy === null}
          left={left}
          week={week}
          schoolOf={schoolOf}
          onSet={(n) => recruitFor(open.id, n)}
          onPitch={(factor) => recruitPitch(open.id, factor)}
          onMajor={(action) => recruitMajor(open.id, action)}
          onClose={() => setOpenId(null)}
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
// Filters
// ---------------------------------------------------------------------------

/** A star rating on a chip: the stars themselves, not the word. */
function StarRow({ n }: { n: number }) {
  return (
    <span className="pb-chipstars" aria-label={plural(n, 'star')} role="img">
      {Array.from({ length: n }, (_, i) => <Icon key={i} name="star-filled" size={12} />)}
    </span>
  );
}

function FilterSheet({
  filters, onChange, onClear, onClose, label, homeState,
}: {
  filters: Filters; onChange: (f: Filters) => void; onClear: () => void; onClose: () => void;
  /** What the board shows once the sheet closes. */
  label: string;
  homeState: string;
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const toggleStar = (n: number) => set('stars', filters.stars.includes(n)
    ? filters.stars.filter((s) => s !== n)
    : [...filters.stars, n].sort((a, b) => b - a));
  const active = [
    filters.pos, filters.state, filters.stars.length > 0,
    filters.pipelineOnly, filters.untouchedOnly, filters.reachOnly,
  ].filter(Boolean).length;

  return (
    <Sheet
      eyebrow={active > 0 ? `${plural(active, 'filter')} on` : undefined}
      title="Filter prospects"
      onClose={onClose}
      tall
      footer={(
        <div className="pb-recruit-filterfoot">
          <Button variant="secondary" disabled={active === 0} onClick={onClear}>Clear all</Button>
          <Button variant="primary" onClick={onClose}>{label}</Button>
        </div>
      )}
    >
      <Card title="Position">
        <Chips label="Position" className="pb-chips--wrap pb-chips--tight">
          {POSITIONS.map((pos) => (
            <Chip key={pos} selected={filters.pos === pos} onClick={() => set('pos', filters.pos === pos ? null : pos)}>
              <span title={posName(pos)}>{pos}</span>
            </Chip>
          ))}
        </Chips>
      </Card>
      <Card title="Stars">
        <Chips label="Stars" className="pb-chips--wrap pb-chips--tight">
          {[5, 4, 3, 2, 1].map((n) => (
            <Chip key={n} selected={filters.stars.includes(n)} onClick={() => toggleStar(n)}><StarRow n={n} /></Chip>
          ))}
        </Chips>
      </Card>
      <Card title="Home state">
        <select
          className="pb-field__input pb-select"
          aria-label="Home state"
          value={filters.state ?? ''}
          onChange={(e) => set('state', e.target.value === '' ? null : e.target.value)}
        >
          <option value="">Anywhere</option>
          {ALL_STATES.map((st) => (
            <option key={st} value={st}>{stateName(st)}{st === homeState ? ' (yours)' : ''}</option>
          ))}
        </select>
      </Card>
      <List label="More filters">
        <Switch label="Pipeline states only" checked={filters.pipelineOnly} onChange={() => set('pipelineOnly', !filters.pipelineOnly)} />
        <Switch label="Nobody recruiting him yet" checked={filters.untouchedOnly} onChange={() => set('untouchedOnly', !filters.untouchedOnly)} />
        <Switch label="In reach only" checked={filters.reachOnly} onChange={() => set('reachOnly', !filters.reachOnly)} />
      </List>
    </Sheet>
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
    <>
      <Callout
        tone={total === 0 ? 'positive' : 'warning'}
        title={total === 0 ? 'Every spot is covered' : `${plural(total, 'spot')} would go to walk-ons`}
      >
        {leaving > 0 ? `Counting ${plural(leaving, 'player')} leaving in June.` : undefined}
      </Callout>
      {short.length > 0 && (
        <Card title="Open spots" flush>
          <List label="Open spots">
            {short.map((h) => {
              const on = targeted(h.pos);
              const open = Math.max(0, h.count - on);
              return (
                <ListRow
                  key={h.pos}
                  title={posName(h.pos)}
                  subtitle={on === 0 ? 'Nobody on your board' : `${plural(on, 'target')} on your board`}
                  status={open === 0
                    ? <StatusBadge tone="positive">Covered</StatusBadge>
                    : <StatusBadge tone="warning">{open} open</StatusBadge>}
                  onClick={() => onPick(h.pos)}
                />
              );
            })}
          </List>
        </Card>
      )}
      {thin.length > 0 && (
        <Card title="No backup" flush>
          <List label="No backup">
            {thin.map((h) => (
              <ListRow
                key={`thin-${h.pos}`}
                title={posName(h.pos)}
                subtitle={targeted(h.pos) > 0 ? `${plural(targeted(h.pos), 'target')} on your board` : undefined}
                onClick={() => onPick(h.pos)}
              />
            ))}
          </List>
        </Card>
      )}
      {covered.length > 0 && (
        <Card title="Covered by your class" flush>
          <List label="Covered">
            {covered.map((h) => (
              <ListRow
                key={h.pos}
                title={posName(h.pos)}
                status={<StatusBadge tone="positive">{h.count > 1 ? `${h.count} filled` : 'Filled'}</StatusBadge>}
              />
            ))}
          </List>
        </Card>
      )}
    </>
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

// ---------------------------------------------------------------------------
// One prospect
// ---------------------------------------------------------------------------

type SheetView = 'week' | 'report' | 'schools';

function ProspectSheet({
  prospect, userTeam, coachPrestige, recruitingSkill, pitch, reachable, pipeline, pipelineStrength,
  live, full, left, week, schoolOf, onSet, onPitch, onMajor, onClose,
}: {
  prospect: Prospect; userTeam: number; coachPrestige: number; recruitingSkill: number;
  pitch: ReturnType<typeof pitchFor>;
  reachable: boolean; pipeline: boolean; pipelineStrength: number; live: boolean; full: boolean; left: number;
  week: number;
  schoolOf: (i: number) => string;
  onSet: (n: number) => void;
  onPitch: (factor: RecruitingFactor | null) => boolean;
  onMajor: (action: RecruitMajorInput | null) => boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SheetView>('week');
  const worksBoard = useDynasty((s) => handles(s.depth, 'recruiting'));
  const economy = useDynasty((s) => s.economy);
  const roster = useDynasty((s) => s.season?.teams[userTeam]?.team);
  const p = prospect.player;
  const spent = prospect.spent[userTeam] ?? 0;
  const share = interestShare(prospect, userTeam);
  const status = chase(prospect, userTeam, schoolOf, reachable);
  const overall = reportedOverall(prospect, recruitingSkill);
  const ceiling = reportedPotential(prospect, recruitingSkill);
  const decides = DECISION_LABEL[decisionStyle(prospect)];
  const canWork = reachable && live && !full && worksBoard && prospect.signedBy === null;
  const plan = recruitingPlan(prospect, pitch, {
    team: userTeam, actions: spent, prestige: coachPrestige, skill: recruitingSkill, economy,
    roster: roster ? [...roster.lineup, ...roster.bench, ...roster.rotation, ...roster.bullpen] : [],
  });
  const total = spent + weekActionCost(prospect, userTeam);

  return (
    <Sheet
      eyebrow={`#${prospect.rank} nationally · ${stateName(prospect.state)}`}
      title={p.name}
      subtitle={`${posName(slotOf(prospect))} · ${handsText(p.bats, p.throws)}`}
      lead={<Face id={p.id} size={48} />}
      onClose={onClose}
      tall
      footer={tab === 'week' && canWork ? (
        <div className="pb-recruit-total">
          <span>
            <b>{plural(total, 'point')} on him</b>
            <small>{Math.max(0, left)} left this week</small>
          </span>
          <Button size="sm" variant="quiet" disabled={spent === 0} onClick={() => onSet(0)}>Clear effort</Button>
        </div>
      ) : undefined}
    >
      <div className="pb-cluster">
        <Stars value={prospect.stars} label="Recruit rating" />
        <StatusBadge tone={status.tone} icon={status.icon}>{status.label}</StatusBadge>
        {decides && <Tag>{capsWords(decides)}</Tag>}
        {reachable && pipeline && <Tag tone="positive">{`Pipeline: ${pipelineLabel(pipelineStrength).toLowerCase()}`}</Tag>}
        <GodBolt target={{ kind: 'recruit', id: p.id }} label={`Edit ${p.name} in god mode`} />
      </div>
      <StatGroup
        size="sm"
        items={[
          { label: 'Rating now', value: overall.low === overall.high ? overall.low : `${overall.low}–${overall.high}`, note: 'of 100' },
          { label: 'Ceiling', value: ceiling.low === ceiling.high ? ceiling.low : `${ceiling.low} to ${ceiling.high}`, note: 'D to S' },
          {
            label: 'Interest in you',
            value: share.any ? `${share.you}%` : '—',
            note: !share.any ? undefined
              : share.leaderTeam === userTeam ? 'You lead'
                : share.leaderTeam !== null ? `${schoolOf(share.leaderTeam)} ${share.leader}%` : undefined,
          },
        ]}
      />
      <SegmentedControl<SheetView>
        label="Prospect"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'week', label: 'This week' },
          { value: 'report', label: 'Scouting' },
          { value: 'schools', label: 'Other programs' },
        ]}
      />
      {tab === 'week' && (
        <WeekPlan
          prospect={prospect} pitch={pitch} reachable={reachable} live={live} full={full}
          spent={spent} left={left} week={week} userTeam={userTeam} plan={plan} canWork={canWork}
          worksBoard={worksBoard}
          onSet={onSet} onPitch={onPitch} onMajor={onMajor}
        />
      )}
      {tab === 'report' && <Report prospect={prospect} recruitingSkill={recruitingSkill} />}
      {tab === 'schools' && <Schools prospect={prospect} userTeam={userTeam} schoolOf={schoolOf} />}
    </Sheet>
  );
}

/**
 * Everything he cares about, most first, as a grid of tiles: your program's
 * grade, the grade he wants, and whether a pitch on it would land. The same
 * grid is the pitch picker when you are working him, and a read-only card
 * when you are not.
 */
function PitchGrid(
  { prospect, pitch, selected, onPick }:
  {
    prospect: Prospect; pitch: ReturnType<typeof pitchFor>;
    selected?: RecruitingFactor | null;
    /** Omitted, the grid only reads. */
    onPick?: (factor: RecruitingFactor | null) => void;
  },
) {
  const priorities = recruitingPrioritiesOf(prospect);
  const ranked = [...RECRUITING_FACTORS].sort((a, b) => priorities[b] - priorities[a]);
  return (
    <div className="pb-pitchgrid" role={onPick ? 'radiogroup' : 'list'} aria-label="What he cares about, most first">
      {ranked.map((f, i) => {
        const v = VERDICT[pitchVerdict(prospect, pitch, f)];
        const on = selected === f;
        const inner = (
          <>
            {i < 3 && <span className="pb-pitch__rank" aria-label={`His number ${i + 1}`}>{i + 1}</span>}
            <span className="pb-pitch__name">{FACTOR_SHORT[f]}</span>
            <span className="pb-pitch__grades">
              <b>{factorGrade(factorScore(prospect, pitch, f))}</b>
              <small>wants {factorGrade(wantedScore(prospect, f))}</small>
            </span>
            <span className={`pb-pitch__verdict pb-tone--${v.tone}`}><Icon name={v.icon} size={14} />{v.word}</span>
          </>
        );
        return onPick ? (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={on}
            title={RECRUITING_FACTOR_BLURB[f]}
            className={`pb-pitch${on ? ' is-selected' : ''}`}
            onClick={() => onPick(on ? null : f)}
          >{inner}</button>
        ) : (
          <div key={f} role="listitem" className="pb-pitch" title={RECRUITING_FACTOR_BLURB[f]}>{inner}</div>
        );
      })}
    </div>
  );
}

function WeekPlan({
  prospect, pitch, reachable, live, full, spent, left, week, userTeam, plan, canWork, worksBoard,
  onSet, onPitch, onMajor,
}: {
  prospect: Prospect; pitch: ReturnType<typeof pitchFor>;
  reachable: boolean; live: boolean; full: boolean; spent: number; left: number; week: number; userTeam: number;
  plan: ReturnType<typeof recruitingPlan>; canWork: boolean; worksBoard: boolean;
  onSet: (n: number) => void;
  onPitch: (factor: RecruitingFactor | null) => boolean;
  onMajor: (action: RecruitMajorInput | null) => boolean;
}) {
  const coordinator = useDynasty((s) => s.economy?.staff?.recruiting);
  const priorities = recruitingPrioritiesOf(prospect);
  const wants = [...RECRUITING_FACTORS].sort((a, b) => priorities[b] - priorities[a]).slice(0, 3);
  const weekAction = prospect.weekActions?.[userTeam];
  const major = weekAction?.major;
  const boundPromise = prospect.promiseBy?.[userTeam];
  const promiseLocked = !!boundPromise && major?.kind !== 'promise';
  const relationship = hasRecruitingRelationship(prospect, userTeam);
  // A sway or an ask is rolled the moment it is made: it is the week's big
  // move, full stop.
  const swayRolled = major?.kind === 'sway';
  const swayUsed = Boolean(prospect.swayedBy?.[userTeam]);
  const askRolled = major?.kind === 'ask';
  const askReason = askRolled ? null : askBlocked(prospect, userTeam, week, full);
  const rolled = swayRolled || askRolled;
  const hints = hintsFor(prospect);
  // What a sway or a hard sell presses on: the pitch, or his top want.
  const focus = weekAction?.pitch ?? wants[0]!;

  if (prospect.signedBy !== null || !canWork) {
    return (
      <>
        {prospect.signedBy !== null ? (
          <Callout tone={prospect.signedBy === userTeam ? 'positive' : 'neutral'} title={prospect.signedBy === userTeam ? 'Committed to you' : 'Signed elsewhere'} />
        ) : !reachable ? (
          <Callout tone="neutral" icon="lock" title="Out of reach for now">Build the program up and he starts listening.</Callout>
        ) : full ? (
          <Callout tone="neutral" title="Your class is full" />
        ) : !live ? (
          <Callout tone="neutral" title="The class is closed" />
        ) : !worksBoard ? (
          <Callout tone="info" title={coordinator ? `${coordinator.name} works this board` : 'Your staff works this board'} />
        ) : null}
        {prospect.signedBy === null && (
          <Callout tone="neutral" icon="chat" title="What the scouts say">&ldquo;{hints.ceiling.text}&rdquo;</Callout>
        )}
        <Card title="What he cares about">
          <PitchGrid prospect={prospect} pitch={pitch} />
        </Card>
      </>
    );
  }

  const room = Math.max(0, left);
  const gain = Math.round(plan.gain);

  return (
    <div className="pb-steps">
      <Step number={1} title="Put in effort" state={spent > 0 ? 'done' : 'current'} summary={spent > 0 ? plural(spent, 'point') : undefined}>
        <Stepper
          label="Points on him"
          hint={room === 0 && spent < MAX_PER_RECRUIT ? 'No points left this week' : `Up to ${MAX_PER_RECRUIT}`}
          value={spent}
          min={0}
          max={Math.min(MAX_PER_RECRUIT, spent + room)}
          onChange={onSet}
        />
        <p className="pb-recruit-proj">
          <span>Interest</span>
          <b>{Math.round(plan.current)} → {Math.round(plan.projected)}</b>
          {gain !== 0 && <span className={gain > 0 ? 'pb-tone--positive' : 'pb-tone--negative'}>{gain > 0 ? '+' : ''}{gain}</span>}
          {plan.multiplier > 1 && <small>incl. +{Math.round((plan.multiplier - 1) * 100)}% coordinator</small>}
        </p>
      </Step>

      <Step
        number={2}
        title={`Pitch one thing · ${PITCH_COST} pts`}
        state={weekAction?.pitch ? 'done' : 'current'}
        summary={weekAction?.pitch ? FACTOR_SHORT[weekAction.pitch] : 'Optional'}
      >
        <p className="pb-pitchlegend">Your grade vs. what he wants, his top 3 numbered.</p>
        <PitchGrid prospect={prospect} pitch={pitch} selected={weekAction?.pitch ?? null} onPick={(f) => onPitch(f)} />
      </Step>

      <Step
        number={3}
        title="One big move"
        state={major ? 'done' : relationship && week >= 2 ? 'current' : 'upcoming'}
        summary={major ? MAJOR_WORDS[major.kind] : relationship && week >= 2 ? 'Optional' : 'From week 2'}
      >
        <div className="pb-movegrid" role="group" aria-label="Big move">
          <MoveTile
            title="Hard sell"
            sub={FACTOR_SHORT[focus]}
            cost={HARD_SELL_COST}
            disabled={rolled}
            selected={major?.kind === 'hardSell'}
            onSelect={() => onMajor(major?.kind === 'hardSell' ? null : { kind: 'hardSell', factor: focus })}
          />
          <MoveTile
            title="Program visit"
            sub="Better if he fits"
            cost={VISIT_COST}
            disabled={rolled}
            selected={major?.kind === 'visit'}
            onSelect={() => onMajor(major?.kind === 'visit' ? null : { kind: 'visit' })}
          />
          {availableRecruitPromises(prospect.player).map((promise) => {
            const active = major?.kind === 'promise' && major.promise === promise;
            return (
              <MoveTile
                key={promise}
                title="Promise"
                sub={capsWords(PROMISE_LABEL[promise])}
                hint={PROMISE_DETAIL[promise]}
                cost={PROMISE_COST[promise]}
                disabled={promiseLocked || rolled}
                selected={active}
                onSelect={() => onMajor(active ? null : { kind: 'promise', promise })}
              />
            );
          })}
          <MoveTile
            special
            confirm
            title="Sway him"
            sub={swayUsed && !swayRolled ? 'Used this season' : `Toward ${FACTOR_SHORT[focus].toLowerCase()}`}
            armedText="Tap again · once a season"
            cost={SWAY_COST}
            disabled={swayUsed || rolled}
            selected={swayRolled}
            onSelect={() => onMajor({ kind: 'sway', factor: focus })}
          />
          <MoveTile
            special
            confirm
            title="Ask to commit"
            sub={askRolled ? 'Asked' : askReason ?? 'He answers now'}
            armedText="Tap again · he answers now"
            cost={ASK_COST}
            disabled={rolled || askReason !== null}
            selected={askRolled}
            onSelect={() => onMajor({ kind: 'ask' })}
          />
        </div>

        {major?.kind === 'promise' && (
          <Callout tone="info" title={`If he signs: ${capsWords(PROMISE_LABEL[major.promise]).toLowerCase()}`}>
            {PROMISE_DETAIL[major.promise]}
          </Callout>
        )}
        {promiseLocked && boundPromise && (
          <Callout tone="info" title={`Promised: ${capsWords(PROMISE_LABEL[boundPromise]).toLowerCase()}`}>
            {PROMISE_DETAIL[boundPromise]}
          </Callout>
        )}
        {swayRolled && major?.kind === 'sway' && (
          <Callout tone={major.success ? 'positive' : 'neutral'} title={major.success ? 'The sway worked' : 'The sway missed'}>
            {major.success ? `He cares more about ${FACTOR_SHORT[major.factor].toLowerCase()} now.` : undefined}
          </Callout>
        )}
        {askRolled && major?.kind === 'ask' && (
          <Callout tone={major.success ? 'positive' : 'warning'} title={major.success ? 'He said yes' : 'He said no'}>
            {major.success
              ? 'He commits when the week ends.'
              : `He doubts your ${major.doubt ? FACTOR_SHORT[major.doubt].toLowerCase() : 'case'}. Ask again in week ${week + ASK_COOLDOWN}.`}
          </Callout>
        )}
      </Step>
    </div>
  );
}

/**
 * One big move, as a tile the same size as its neighbours. Sway and ask are
 * marked out (a bolt and a warmer tint) and take two taps, because each happens
 * the moment it is made and cannot be taken back; touching anything else stands
 * an armed tile down.
 */
function MoveTile(
  { title, sub, hint, cost, selected, disabled, special, confirm, armedText, onSelect }:
  {
    title: string; sub: string; hint?: string; cost: number;
    selected?: boolean; disabled?: boolean;
    special?: boolean; confirm?: boolean; armedText?: string;
    onSelect: () => void;
  },
) {
  const [armed, setArmed] = useState(false);
  const me = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!armed) return undefined;
    const stand = (e: PointerEvent): void => {
      if (me.current && e.target instanceof Node && me.current.contains(e.target)) return;
      setArmed(false);
    };
    document.addEventListener('pointerdown', stand, true);
    return () => document.removeEventListener('pointerdown', stand, true);
  }, [armed]);
  return (
    <button
      ref={me}
      type="button"
      title={hint}
      aria-pressed={!!selected}
      disabled={disabled}
      className={cx('pb-move', selected && 'is-selected', special && 'is-special', armed && 'is-armed')}
      onClick={() => {
        if (!confirm) { onSelect(); return; }
        if (armed) { setArmed(false); onSelect(); } else setArmed(true);
      }}
    >
      <span className="pb-move__title">
        {special && <Icon name="lightning" size={14} />}
        <span>{title}</span>
      </span>
      <span className="pb-move__sub">{armed && armedText ? armedText : sub}</span>
      <span className="pb-move__cost">{cost} pts</span>
    </button>
  );
}

const MAJOR_WORDS: Record<RecruitMajorInput['kind'], string> = {
  hardSell: 'Hard sell',
  visit: 'Program visit',
  sway: 'Sway',
  promise: 'Promise',
  ask: 'Asked to commit',
};

/** The scouting report: two impressions, the tools as ranges, last spring's line. */
function Report({ prospect, recruitingSkill }: { prospect: Prospect; recruitingSkill: number }) {
  const p = prospect.player;
  const rows: [string, number][] = p.type === 'pitcher'
    ? [['Strikeout stuff', (p as Pitcher).stuff], ['Keeps hits down', (p as Pitcher).movement],
       ['Control', (p as Pitcher).control], ['Stamina', (p as Pitcher).stamina]]
    : [['Contact', (p as Hitter).contact], ['Power', (p as Hitter).power],
       ['Plate discipline', (p as Hitter).eye], ['Speed', (p as Hitter).speed],
       ['Range in the field', (p as Hitter).range], ['Arm strength', (p as Hitter).arm]];
  const hints = hintsFor(prospect);
  const line = highSchoolLine(p);
  return (
    <>
      <Callout tone="neutral" icon="chat" title="What the scouts say">
        &ldquo;{hints.ceiling.text}&rdquo; &ldquo;{hints.development.text}&rdquo;
      </Callout>
      <Card title="Tools" eyebrow="Scouted ranges, of 100">
        <DescriptionList
          items={rows.map(([label, value]) => {
            const { low, high } = reportedTool(prospect, value, recruitingSkill);
            return { label, value: low === high ? String(low) : `${low}–${high}` };
          })}
        />
      </Card>
      {line.length > 0 && (
        <Card title="Last spring" eyebrow="High school">
          <DescriptionList items={line.map((row) => ({ label: HIGH_SCHOOL_WORD[row.label] ?? capsWords(row.label), value: row.value }))} />
        </Card>
      )}
    </>
  );
}

function Schools({ prospect, userTeam, schoolOf }: { prospect: Prospect; userTeam: number; schoolOf: (i: number) => string }) {
  const rivals = Object.entries(prospect.points)
    .map(([t, pts]) => ({ team: Number(t), pts }))
    .filter((r) => r.pts > 0)
    .sort((a, b) => b.pts - a.pts);
  const total = rivals.reduce((a, r) => a + r.pts, 0);
  if (rivals.length === 0) {
    return <EmptyState icon="search" title="Nobody is recruiting him yet" />;
  }
  return (
    <Card title="Who is recruiting him" eyebrow={plural(rivals.length, 'program')} flush>
      <Table
        dense
        label="Programs recruiting him"
        columns={[
          { label: 'Program', grow: true },
          { label: 'His interest', width: '96px', align: 'right', strong: true },
        ]}
        rows={rivals.map((r) => ({
          key: r.team,
          you: r.team === userTeam,
          cells: [r.team === userTeam ? `${schoolOf(r.team)} (you)` : schoolOf(r.team), `${Math.round((r.pts / total) * 100)}%`],
        }))}
      />
    </Card>
  );
}
