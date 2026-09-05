// Board.tsx
// Recruiting, over three weeks.
//
// Four views of the same class — everyone available, who you are chasing, who
// you have landed, and the roster the class is meant to fix — because those are
// four different questions and answering them on one list means answering none
// of them well.
//
// Two rules hold the screen together.
//
// **Nothing here is a fact.** A recruit's ability is a band and his ceiling is
// a span of letters, both as wide as the coach reading them is bad at this, and
// the two lines of scouting prose narrow the field without ever settling it. So
// the board is a set of bets rather than a sorted table, and the class review
// after signing day is where anybody finds out. See the long note at the top of
// `recruiting.ts` for how the bands are drawn and why the truth is never in the
// middle of one.
//
// **A recruit out of your program's reach is refused outright** rather than
// quietly discounted, because a button that works and achieves nothing reads as
// a bug.

import { useMemo, useState, type CSSProperties } from 'react';
import { boardBudget, useDynasty, useUserTeam } from '../../state/store.js';
import {
  fit, weeklyPoints, canPursue, inPipeline, byRank,
  PRIORITIES, PRIORITY_LABEL, PRIORITY_BLURB,
  SCHOLARSHIPS, MAX_PER_RECRUIT, RECRUITING_WEEKS,
  reportedOverall, reportedPotential, reportedTool, reportWidth, hintsFor,
  type Prospect, type Priority,
} from '../../engine/recruiting.js';
import { enrolling, walkOnShortfall } from '../../engine/progression.js';
import { pitchFor, developmentScore } from '../../engine/pitch.js';
import { overallOf } from '../../engine/ratings.js';
import { highSchoolLine } from '../../engine/scouting.js';
import { CONFERENCES, ALL_STATES } from '../../data/schools.js';
import { prestigeStars } from '../../engine/program.js';
import { Avatar, teamColour } from '../Avatar.js';
import { InFrame } from '../Overlay.js';
import { FirstVisit } from '../Tutorial.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import { MixerHorizontalIcon } from '@radix-ui/react-icons';
import { withStaff, pipelineStrength, pipelineLabel } from '../../engine/economy.js';
import { FieldNote, Metric, MetricStrip, ModuleIntro, Segmented } from '../components/Kit.js';
import { isTwoWay } from '../../engine/types.js';
import type { Hitter, Pitcher, Player, Position } from '../../engine/types.js';

type View = 'recruits' | 'targets' | 'commits' | 'needs' | 'roster';
type Sheet = 'overview' | 'report' | 'stats' | 'schools';

const SHEET_LABEL: Record<Sheet, string> = {
  overview: 'OVERVIEW',
  report: 'REPORT',
  stats: 'HIGH SCHOOL',
  schools: 'SCHOOLS',
};

const VIEW_LABEL: Record<View, string> = {
  recruits: 'RECRUITS',
  targets: 'TARGETS',
  commits: 'COMMITS',
  needs: 'NEEDS',
  roster: 'ROSTER',
};

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
  if (f.pipelineOnly && network(p) < 35) return false;
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
 */
export function pinnedAction(
  s: { filtersOpen: boolean; live: boolean; week: number; matches: number; shown: number },
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
    : { kind: 'end-week', label: `END WEEK ${s.week}` };
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

/** How the chase is going, said in words rather than a raw point total. */
function standing(mine: number, best: number, anyone: boolean): { label: string; tone: string } {
  if (!anyone) return { label: 'NOBODY ON HIM', tone: 'var(--dim)' };
  if (mine <= 0) return { label: 'NOT IN IT', tone: 'var(--dim)' };
  if (mine >= best) return { label: 'LEADING', tone: 'var(--win)' };
  const behind = (best - mine) / best;
  if (behind < 0.2) return { label: 'RIGHT THERE', tone: 'var(--win)' };
  if (behind < 0.5) return { label: 'IN THE MIX', tone: 'var(--ink)' };
  return { label: 'WAY BEHIND', tone: 'var(--clay)' };
}

const topPriority = (p: Prospect): Priority =>
  [...PRIORITIES].sort((a, b) => p.priorities[b] - p.priorities[a])[0] as Priority;

const slotOf = (p: Prospect): string =>
  isTwoWay(p.player) ? 'TWO-WAY'
    : p.player.type === 'pitcher' ? (p.player as Pitcher).role : p.player.pos;

/** The outside of the envelope: only the open card says TWO-WAY. */
const listSlotOf = (p: Prospect): string =>
  isTwoWay(p.player)
    ? ((p.player as { role?: string }).role ?? p.player.pos)
    : slotOf(p);

export function Board() {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const coach = useDynasty((s) => s.coach);
  const recruitFor = useDynasty((s) => s.recruit);
  const advanceWeek = useDynasty((s) => s.advanceRecruitingWeek);
  const economy = useDynasty((s) => s.economy);
  const nextPhase = useDynasty((s) => s.nextPhase);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();

  const [view, setView] = useState<View>('recruits');
  const [openId, setOpenId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const lastWeek = useDynasty((s) => s.lastWeek);

  const pitch = useMemo(() => {
    if (!season || !team) return null;
    const conf = CONFERENCES.find((c) => c.id === team.conference);
    return pitchFor(
      season, team, conf?.region ?? 'Gulf', developmentScore(team),
      (state) => pipelineStrength(economy, state, team.def.state),
    );
  }, [season, team, version, economy]);

  const myStars = team ? prestigeStars(team.prestige) : 1;
  const homeState = team?.def.state ?? '';
  const networkFor = (p: Prospect): number => pipelineStrength(economy, p.state, homeState);

  const {
    list, matches, targets, commits, spent, locked, shortfall, covered,
  } = useMemo(() => {
    const all = season?.recruiting.prospects ?? [];
    // One gate, asked the same way everywhere on this screen: the program's
    // tier, plus a star for a recruit out of its own state.
    const reaches = (p: Prospect): boolean =>
      canPursue(p, myStars, networkFor(p));

    // Anyone this program has ever put money on stays on the target list until
    // he is resolved — signed here or signed somewhere else.
    //
    // Filtering targets by *this week's* spend made a recruit disappear the
    // moment the week turned, so a board you had been working for two weeks came
    // back empty and there was no way to see who you were still in on. A target
    // list you lose track of is not a target list.
    // Once he commits here he is not a target any more, he is a commit — and he
    // has his own tab. Leaving him on both lists made the board read as if there
    // were still work to do on a player who was already signed. A recruit who
    // picked somebody else does stay, marked, because losing one quietly is how
    // you never learn who you were beaten by.
    const mine = all.filter(
      (p) => p.signedBy !== userTeam
        && ((p.spent[userTeam] ?? 0) > 0 || (p.points[userTeam] ?? 0) > 0),
    );
    const used = all.reduce((a, p) => a + (p.spent[userTeam] ?? 0), 0);
    const signed = all.filter((p) => p.signedBy === userTeam);

    const open = all.filter((p) => p.signedBy === null);
    const shown = open.filter((p) => matchesFilters(p, filters, homeState, myStars, networkFor));
    const reachable = shown.filter(reaches);
    const ranked = pitch
      ? [...reachable].sort((a, b) => (b.stars * fit(b, pitch)) - (a.stars * fit(a, pitch)))
      : reachable;

    // The roster the class is being signed into, and the class itself in the
    // order the board holds it — not the order this screen sorts it into. The
    // year roll takes the class as it comes off the board, and a projection
    // that disagreed with it on a tie would be a projection worth nothing.
    const roster: Player[] = team
      ? [...team.team.lineup, ...team.team.bench, ...team.team.rotation, ...team.team.bullpen]
      : [];
    // Less the men the pros took in July -- they never arrive, and the
    // projection has to know it the same way the year roll will.
    const classPlayers = enrolling(
      signed.map((p) => p.player), season?.recruiting.year ?? 0,
    );
    const still = walkOnShortfall(roster, classPlayers);

    const list = showAll ? ranked : ranked.slice(0, ROW_CAP);

    return {
      list,
      // What the filter actually caught, before the board's row cap. The capped
      // number is the wrong one to put on the apply button: it reads 50
      // whatever you do until you have narrowed the country down past fifty
      // players, which is exactly the range where you need to be told whether
      // the last tap did anything.
      matches: reachable.length,
      targets: mine.slice().sort((a, b) => {
        // Unresolved first — those are the ones still worth a decision.
        const live = Number(a.signedBy !== null) - Number(b.signedBy !== null);
        return live || (b.points[userTeam] ?? 0) - (a.points[userTeam] ?? 0);
      }),
      // The class you have landed, in the same national order the signing day
      // report reads in. Two screens showing the same eight names with the same
      // #rank on each row must agree about which of them is first.
      commits: signed.slice().sort(byRank),
      spent: used,
      locked: filters.reachOnly ? [] : shown.filter((p) => !reaches(p))
        .sort((a, b) => b.stars - a.stars).slice(0, 5),
      shortfall: still,
      covered: coveredSince(walkOnShortfall(roster, []), still),
    };
  }, [season, team, userTeam, version, pitch, myStars, homeState, filters, showAll]);

  if (!season || !team || !pitch) return null;

  const week = season.recruiting.week;

  // What the class has still not covered, counted off the roster in front of
  // you rather than off the draft's report. The report is not restored by a
  // reload — see `coveredSince` — and the roster always is.
  const stillShort = shortfall.reduce((a, r) => a + r.count, 0);
  const open = season.recruiting.prospects.find((p) => p.id === openId) ?? null;
  // What a week is worth here, after the draft phase took whatever it took to
  // keep somebody. The header prints the honest number, so a coach who talked
  // his shortstop out of professional baseball in June can see the price of it
  // on the board he opens ninety seconds later.
  const weekly = boardBudget(season, userTeam);
  const recruiterSkill = withStaff(coach.skills, economy.staff).recruiting;
  const left = weekly - spent;
  const live = week >= 1 && week <= RECRUITING_WEEKS;
  const full = commits.length >= SCHOLARSHIPS;
  const activeFilters = anyFilter(filters);
  const pinned = pinnedAction({ filtersOpen, live, week, matches, shown: list.length });

  return (
    /*
      The title, the budget and the four tabs stay put; the list scrolls under
      them.

      Reported from testing: "the list of players should be what actually
      scrolls, not the whole page". On a phone the old layout put the tab you
      were on, the money you had left and the scholarships you had used off the
      top of the screen the moment you started reading — which is exactly when
      you need them, because every one of them is a constraint on the decision
      you are scrolling to make.
    */
    <FixedHeader
      action={pinned.kind !== null && (
        <FloatingAction
          label={pinned.label}
          onClick={() => {
            if (pinned.kind === 'close-filter') setFiltersOpen(false);
            else if (pinned.kind === 'signing-day') { advanceWeek(); void nextPhase('recruiting'); }
            else advanceWeek();
          }}
          secondary={pinned.kind === 'close-filter' && activeFilters
            ? { label: 'CLEAR EVERY FILTER', onClick: () => setFilters(NO_FILTERS) }
            : null}
        />
      )}
      header={
      <div className="dense-head" style={{ padding: '9px 14px 6px' }}>
      <div className="screen-title-row">
        <ModuleIntro
          kicker={`RECRUITING · ${live ? `WEEK ${week} OF ${RECRUITING_WEEKS}` : 'SIGNED'}`}
          title="The board"
        />
        {/*
          Filtering is a mode, not a drawer.

          Reported from testing: "if we scrolled to the players and try to tab on
          the filter it would not work". It worked perfectly — it opened the
          panel at the top of the list, fourteen hundred pixels above where you
          were reading, and the browser's scroll anchoring then held the view
          exactly still so that nothing whatsoever appeared to happen. That is
          what pinning the header cost: the control used to be reachable only
          from the top of the list, where the thing it opened was also visible.
          Entering a mode instead means the panel is the only thing in the body,
          so there is nowhere for it to hide.
        */}
        <button
          className={`filter-button tap${filtersOpen || activeFilters ? ' active' : ''}`}
          type="button"
          onClick={() => {
            setOpenId(null);
            // Filters only shape the recruits list, so opening them from the
            // roster tab and landing back on the roster would be a control that
            // changed a screen you were not looking at.
            if (!filtersOpen) setView('recruits');
            setFiltersOpen((v) => !v);
          }}
        ><MixerHorizontalIcon /><span>{activeFilters ? 'Filter on' : 'Filter'}</span></button>
      </div>

      <MetricStrip>
        <Metric label="SCHOLARSHIPS" value={`${commits.length}/${SCHOLARSHIPS}`} note={full ? 'FULL' : 'COMMITTED'} />
        <Metric
          label="BUDGET"
          value={live ? String(left) : '—'}
          /*
            What the big number IS. Reported as a contradiction — "budget 29,
            and underneath 159 / 3 weeks" — and both were true of different
            things: 29 is what is left of THIS WEEK, 159 was the whole window,
            and the slash read as a division that gave 53. The note names the
            number above it now, which is the only job it has.
          */
          note={live ? `OF ${weekly} THIS WEEK` : 'CLOSED'}
        />
        {/* Sized down as well as filled-only. The display face has no star, so
            each ★ came from the fallback font at nearly a square em — five of
            those at the metric's 25px overflowed the box even after the empty
            ones were dropped. Reported twice; the span is the second fix. */}
        <Metric
          label="PRESTIGE"
          value={<span className="metric-stars">{'★'.repeat(Math.max(1, myStars))}</span>}
          note={`OF 5 · PROGRAM PULL`}
        />
      </MetricStrip>

      <Segmented
        label="Recruiting section"
        value={view}
        onChange={(v) => {
          setView(v);
          // Leaving filter mode is the whole point of this line. The tabs are
          // in the pinned header and stay live while the panel is up, so
          // without it a tap moved the tab underneath a panel that was still
          // covering the body and still owned the pinned button — which is how
          // END WEEK ended up reading "SHOW THE TOP 50 OF 518" on a screen that
          // looked like the roster tab.
          setFiltersOpen(false);
        }}
        options={(['recruits', 'targets', 'commits', 'needs', 'roster'] as View[]).map((v) => {
          const count = v === 'targets' ? targets.length
            : v === 'commits' ? commits.length
              : v === 'needs' ? stillShort : 0;
          const word = VIEW_LABEL[v];
          return {
            value: v,
            label: `${word.charAt(0)}${word.slice(1).toLowerCase()}${count > 0 ? ` ${count}` : ''}`,
          };
        })}
      />
      </div>
    }>
    {live && <FirstVisit id="recruiting" />}
    <div className="offseason-recruiting" style={{ padding: '10px 14px 20px' }}>
      {/* Filtering replaces the body rather than pushing it down. The rest of
          this branch is the board itself; see the note on the FILTER button. */}
      {filtersOpen ? (
        /* The panel arrives instead of appearing — the same rise every sheet
           in the app makes, because that is what it is: a mode laid over the
           board. Asked for: "it should do an opening animation instead of
           simply appearing." */
        <div className="rise-in">
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            homeState={homeState}
            myStars={myStars}
          />
        </div>
      ) : <>
      {live && lastWeek && (
        <div style={{
          marginBottom: 10, border: '1px solid var(--clay)',
          background: 'rgba(var(--clay-rgb), .10)',
        }}>
          <div style={{ padding: '5px 10px', background: 'var(--clay)' }}>
            <span style={{
              font: "700 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
            }}>WEEK {lastWeek.closed} IS OVER</span>
          </div>
          <div style={{ padding: '10px 11px', font: "400 calc(12px * var(--ts))/1.5 var(--body)" }}>
            {lastWeek.yours.length > 0 ? (
              <div style={{ marginBottom: 6 }}>
                <strong>Committed to you:</strong> {lastWeek.yours.join(', ')}.
              </div>
            ) : (
              <div style={{ marginBottom: 6, color: 'var(--dim)' }}>
                Nobody committed to you this week.
              </div>
            )}
            <div style={{ color: 'var(--dim)' }}>
              {lastWeek.gone === 0
                ? 'Nobody came off the board anywhere.'
                : `${lastWeek.gone} recruit${lastWeek.gone === 1 ? '' : 's'} signed elsewhere.`}
            </div>
          </div>
        </div>
      )}


      {view === 'needs' ? (
        <NeedsView short={shortfall} covered={covered} onPick={(pos) => {
          setFilters({ ...NO_FILTERS, pos });
          setView('recruits');
        }} />
      ) : view === 'roster' ? (
        <RosterView />
      ) : (
        <>
          {/*
            Keyed on what shaped it, so a change of filters or view fades the
            list in rather than cutting. Reported: "when filtering, the screen
            flicks" — the rows swapped in the same frame the state changed.
            One 260ms fade on the container, not per-row theatre.
          */}
          <div
            className="fade-in recruit-board-grid"
            key={`${view}:${JSON.stringify(filters)}`}>
            {(view === 'recruits' ? list : view === 'targets' ? targets : commits).length === 0 && (
              <div style={{
                padding: '18px 12px', font: "400 calc(12px * var(--ts)) var(--body)", color: 'var(--dim)',
                textAlign: 'center',
              }}>
                {view === 'targets' ? 'Nobody on your board yet.'
                  : view === 'commits' ? 'No commitments yet.'
                  : activeFilters ? 'Nobody matches those filters.' : 'Nobody available.'}
              </div>
            )}
            {(view === 'recruits' ? list : view === 'targets' ? targets : commits).map((p) => (
              <Row
                key={p.id}
                p={p}
                userTeam={userTeam}
                season={season}
                onOpen={() => setOpenId(p.id)}
                signed={view === 'commits'}
                recruitingSkill={recruiterSkill}
              />
            ))}
          </div>

          {/*
            The cap, and the way out of it.

            Fifty rows sorted by fit is the answer to the question this tab is
            for, and five hundred names is not a list anybody reads. But a coach
            who has filtered down to "four star catchers" and gets fifty of them
            has been told a number and shown a slice of it, so the last row is
            followed by the whole class if he wants it.
          */}
          {view === 'recruits' && matches > list.length && (
            <CapButton
              label={`SHOW ALL ${matches}`}
              onClick={() => setShowAll(true)}
            />
          )}
          {view === 'recruits' && showAll && matches > ROW_CAP && (
            <CapButton
              label={`BACK TO THE TOP ${ROW_CAP}`}
              onClick={() => setShowAll(false)}
            />
          )}

          {view === 'recruits' && locked.length > 0 && (
            <>
              <div className="label" style={{ marginTop: 18, marginBottom: 6 }}>
                OUT OF REACH
              </div>
              <div style={{
                border: '1px solid var(--faint)', background: 'var(--paper)', opacity: 0.72,
              }}>
                {locked.map((p) => (
                  <Row
                    key={p.id} p={p} userTeam={userTeam} season={season}
                    onOpen={() => setOpenId(p.id)}
                    recruitingSkill={recruiterSkill}
                  />
                ))}
              </div>
              <div style={{
                marginTop: 6, font: "400 calc(11px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
              }}>
                Out of reach for now. Build the program up and names like these
                start listening.
              </div>
            </>
          )}
        </>
      )}

      {open && (
        <ProspectSheet
          prospect={open}
          userTeam={userTeam}
          coachPrestige={coach.prestige}
          // With the coordinator on top — the same effective skill the week's
          // close will spend, or the preview undersells the staff you pay for.
          recruitingSkill={recruiterSkill}
          pitch={pitch}
          reachable={canPursue(open, myStars, networkFor(open))}
          pipeline={networkFor(open) >= 35}
          pipelineStrength={networkFor(open)}
          live={live}
          full={full && open.signedBy === null}
          left={left}
          onSet={(n) => recruitFor(open.id, n)}
          onClose={() => setOpenId(null)}
        />
      )}
      </>}

      {/*
        The pinned button says what you are actually doing.

        Reported from testing: "when filtering the button set should appear
        instead of the end week one, that causes confusion." Ending the week is
        the one irreversible act on this screen — recruits come off the board and
        the budget resets — and leaving it under the thumb while somebody is
        tuning a position filter is a trap rather than a convenience. While the
        filter is open the only thing the button can do is close it, and it says
        how many recruits are waiting on the other side.

        One button and one label, decided by `pinnedAction`. It was two branches
        of this ternary each writing their own, which is how the label and the
        state it described came apart.
      */}
    </div>
    </FixedHeader>
  );
}

/**
 * One recruit, in the colours of whoever has him.
 *
 * Every row carries a school: the one that signed him if the board has closed
 * on him, otherwise the one leading the chase. That colour is the point —
 * "keep the ones I lost on the board, tinted with the colour of the school that
 * took him, so I can see who beat me" — and it is worth as much before the
 * signature as after it, because the school in front of you on a recruit you
 * are still working is the fact the week's spending turns on. A recruit nobody
 * has called carries no colour at all, which is its own signal and pairs with
 * the filter for exactly those men.
 */
function Row({
  p, userTeam, season, onOpen, signed, recruitingSkill,
}: {
  p: Prospect; userTeam: number; season: { teams: { def: { abbr: string } }[] };
  onOpen: () => void; signed?: boolean; recruitingSkill: number;
}) {
  const spent = p.spent[userTeam] ?? 0;
  const points = Object.values(p.points);
  const best = points.length ? Math.max(...points) : 0;
  const state = signed || p.signedBy === userTeam
    ? { label: 'SIGNED', tone: 'var(--win)' }
    : p.signedBy !== null
      ? { label: 'LOST', tone: 'var(--clay)' }
      : standing(p.points[userTeam] ?? 0, best, points.length > 0);
  const leader = p.signedBy !== null ? p.signedBy
    : points.length > 0 ? Number(Object.entries(p.points).sort((a, b) => b[1] - a[1])[0]?.[0]) : null;
  const abbr = leader !== null ? season.teams[leader]?.def.abbr : undefined;
  const colour = abbr ? teamColour(abbr) : 'var(--line)';
  const ovr = reportedOverall(p, recruitingSkill);
  const pot = reportedPotential(p, recruitingSkill);

  return (
    <button className={`recruit-card tap${spent > 0 && !signed ? ' targeted' : ''}`} type="button" onClick={onOpen} style={{ '--recruit-accent': colour } as CSSProperties}>
      <span className="recruit-card-rank"><small>NAT'L</small><strong>#{p.rank}</strong></span>
      <span className="recruit-card-face"><Avatar id={p.id} team={p.signedBy !== null ? abbr : undefined} size={40} /></span>
      <span className="recruit-card-copy">
        <small>{listSlotOf(p)} · {p.state} · {PRIORITY_LABEL[topPriority(p)]}</small>
        <strong>{p.player.name}</strong>
        <em>{'★'.repeat(p.stars)}</em>
      </span>
      <span className="recruit-card-read">
        <i><small>OVR</small><strong>{ovr.low}-{ovr.high}</strong></i>
        <i><small>CEIL</small><strong>{pot.low}-{pot.high}</strong></i>
      </span>
      <span className="recruit-card-status" style={{ color: state.tone }}>
        <strong>{state.label}</strong>
        <small>{spent > 0 && !signed ? `${spent} pts/wk` : abbr && leader !== userTeam ? `Leader: ${abbr}` : 'Open card'}</small>
      </span>
    </button>
  );
}

/** The way past the row cap, and the way back to it. */
function CapButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="tap"
      style={{
        width: '100%', marginTop: 8, padding: '10px 0',
        background: 'var(--paper)', border: '1px solid rgba(var(--ink-rgb), .28)',
        color: 'var(--ink)', font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.1em',
      }}
    >{label}</button>
  );
}

/**
 * The whole body while filtering, rather than a drawer above the list.
 *
 * Clearing and applying live on the pinned button underneath — the two things
 * you do *to* the filter set belong together and in the one place on this screen
 * that never scrolls away, which is the same argument the header is built on.
 *
 * Four controls and three switches, where there were two chip fields and two
 * sliders that fought each other. Reported from testing: "the filter has grown
 * into a panel of controls that fight each other." Thirty five states as chips
 * was two thirds of the panel's height for a thing you pick one of, so it is a
 * dropdown; the sliders read against bands and could not mean anything precise,
 * so they are gone and the star rating — the one measure on this board that is
 * a single value and not a window — carries the quality filter instead.
 */
function FilterPanel({
  filters, onChange, homeState, myStars,
}: {
  filters: Filters; onChange: (f: Filters) => void;
  homeState: string; myStars: number;
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    onChange({ ...filters, [k]: v });
  const toggleStar = (n: number) =>
    set('stars', filters.stars.includes(n)
      ? filters.stars.filter((s) => s !== n)
      : [...filters.stars, n].sort((a, b) => b - a));
  const active = [
    filters.pos, filters.state, filters.stars.length > 0,
    filters.pipelineOnly, filters.untouchedOnly, filters.reachOnly,
  ].filter(Boolean).length;

  return (
    <section className="recruit-filter-room">
      <header className="recruit-filter-head">
        <span>
          <small>BOARD FILTERS</small>
          <strong>Shape the board</strong>
          <p>Keep the country broad, or narrow it to the players worth a call.</p>
        </span>
        <b>{active > 0 ? `${active} ON` : 'ALL'}</b>
      </header>

      <div className="recruit-filter-section">
        <div className="recruit-filter-label">
          <span><small>POSITION</small><strong>{filters.pos ?? 'Any position'}</strong></span>
          {filters.pos && <button type="button" onClick={() => set('pos', null)}>CLEAR</button>}
        </div>
        <div className="recruit-position-grid">
          {POSITIONS.map((pos) => (
            <button
              className={filters.pos === pos ? 'active' : ''}
              type="button"
              key={pos}
              onClick={() => set('pos', filters.pos === pos ? null : pos)}
            >{pos}</button>
          ))}
        </div>
      </div>

      <div className="recruit-filter-section">
        <div className="recruit-filter-label">
          <span><small>TALENT BAND</small><strong>{filters.stars.length > 0 ? `${filters.stars.join(' / ')} star` : 'Any rating'}</strong></span>
          {filters.stars.length > 0 && <button type="button" onClick={() => set('stars', [])}>CLEAR</button>}
        </div>
        <div className="recruit-star-grid">
          {[5, 4, 3, 2, 1].map((n) => (
            <button
              className={filters.stars.includes(n) ? 'active' : ''}
              type="button"
              key={n}
              onClick={() => toggleStar(n)}
            ><strong>{n}</strong><span>★</span></button>
          ))}
        </div>
      </div>

      <div className="recruit-filter-section recruit-location-filter">
        <div className="recruit-filter-label">
          <span><small>GEOGRAPHY</small><strong>{filters.state ?? 'Anywhere'}</strong></span>
          {filters.state && <button type="button" onClick={() => set('state', null)}>CLEAR</button>}
        </div>
        <label>
          <small>HOME STATE</small>
          <select
            value={filters.state ?? ''}
            onChange={(e) => set('state', e.target.value === '' ? null : e.target.value)}
          >
            <option value="">ANYWHERE</option>
            {ALL_STATES.map((st) => (
              <option key={st} value={st}>{st}{st === homeState ? ' · YOUR STATE' : ''}</option>
            ))}
          </select>
        </label>
        <p>Your program currently carries {Math.max(1, myStars)}★ pull. Geography and pipelines can make the difference at the edge of your reach.</p>
      </div>

      <div className="recruit-filter-section">
        <div className="recruit-filter-label">
          <span><small>BOARD SIGNALS</small><strong>What matters right now</strong></span>
        </div>
        <div className="recruit-signal-grid">
          <FilterToggle
            on={filters.pipelineOnly}
            onClick={() => set('pipelineOnly', !filters.pipelineOnly)}
            label="PIPELINES"
            note="Markets where your program already has a relationship."
          />
          <FilterToggle
            on={filters.untouchedOnly}
            onClick={() => set('untouchedOnly', !filters.untouchedOnly)}
            label="UNTOUCHED"
            note="Nobody in the country has spent a point on him yet."
          />
          <FilterToggle
            on={filters.reachOnly}
            onClick={() => set('reachOnly', !filters.reachOnly)}
            label="IN REACH"
            note="Only players who would currently take your call."
          />
        </div>
      </div>
    </section>
  );
}

function FilterToggle({ on, onClick, label, note }: {
  on: boolean; onClick: () => void; label: string; note: string;
}) {
  return (
    <button
      type="button"
      className={`recruit-filter-toggle tap${on ? ' active' : ''}`}
      aria-pressed={on}
      onClick={onClick}
    >
      <span><small>{on ? 'ON' : 'OFF'}</small><strong>{label}</strong></span>
      <p>{note}</p>
      <i aria-hidden="true"><b /></i>
    </button>
  );
}

/**
 * What the class has not covered, as a list you can act on.
 *
 * The same projection the class review prints, read off the same function on
 * the same two inputs — the roster standing in front of you and the men you
 * have signed. It used to count signings against the draft's own list of holes
 * and got a different answer, which is how a tab reading COVERED down its whole
 * length was followed three taps later by a class review that brought walk-ons.
 * See `coveredSince` for the two ways that went wrong.
 *
 * A row here is not a hole in the abstract. It is a man who will turn up in
 * June, at that position, thirteen points below your own level, unless somebody
 * signs first — which is why the tap filters the board to players who play
 * there.
 */
function NeedsView(
  { short, covered, onPick }:
  {
    short: readonly { pos: string; count: number }[];
    covered: readonly { pos: string; count: number }[];
    onPick: (pos: string) => void;
  },
) {
  const total = short.reduce((a, r) => a + r.count, 0);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        marginBottom: 10, padding: '9px 11px', background: 'var(--paper)',
        borderLeft: `3px solid ${total === 0 ? 'var(--win)' : 'var(--clay)'}`,
        font: "400 calc(11.5px * var(--ts))/1.5 var(--body)", color: 'var(--ink)',
      }}>
        {total === 0
          ? 'Every spot covered. The whole roster is men you went and got.'
          : `${total} walk-on${total === 1 ? '' : 's'} as it stands. Whoever turns `
            + 'up is well below your level, and gone in a year.'}
      </div>

      {short.length > 0 && (
        <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
          {short.map((h) => (
            <button
              key={h.pos}
              onClick={() => onPick(h.pos)}
              className="tap"
              style={{
                width: '100%', textAlign: 'left',
                display: 'grid', gridTemplateColumns: '52px 1fr auto',
                gap: 10, alignItems: 'center',
                padding: '11px 11px', borderBottom: '1px solid var(--hairline)',
                background: 'transparent',
              }}
            >
              <span style={{
                font: "700 calc(13px * var(--ts)) var(--mono)", letterSpacing: '.06em', color: 'var(--clay)',
              }}>{h.pos}</span>
              <span style={{ font: "400 calc(11.5px * var(--ts))/1.4 var(--body)", color: 'var(--dim)' }}>
                {h.count > 1 ? `${h.count} walk-ons` : 'one walk-on'} unless you sign
              </span>
              <span style={{
                font: "700 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.1em', color: 'var(--dim)',
              }}>SHOW ME →</span>
            </button>
          ))}
        </div>
      )}

      {/* What the class has already bought. A tab that only ever lists what is
          still wrong teaches the coach that signing somebody changes nothing. */}
      {covered.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 16, marginBottom: 6 }}>
            YOUR CLASS COVERED
          </div>
          <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
            {covered.map((h) => (
              <div
                key={h.pos}
                style={{
                  display: 'grid', gridTemplateColumns: '52px 1fr auto',
                  gap: 10, alignItems: 'center',
                  padding: '10px 11px', borderBottom: '1px solid var(--hairline)',
                }}
              >
                <span style={{
                  font: "700 calc(13px * var(--ts)) var(--mono)", letterSpacing: '.06em', color: 'var(--win)',
                }}>{h.pos}</span>
                <span style={{ font: "400 calc(11.5px * var(--ts))/1.4 var(--body)", color: 'var(--dim)' }}>
                  {h.count > 1 ? `${h.count} spots` : 'one spot'} the class fills
                </span>
                <span style={{
                  font: "700 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.1em', color: 'var(--win)',
                }}>COVERED</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RosterView() {
  const team = useUserTeam();
  const openPlayer = useDynasty((s) => s.openPlayer);
  if (!team) return null;

  const groups: [string, (Hitter | Pitcher)[]][] = [
    ['LINEUP', team.team.lineup],
    ['BENCH', team.team.bench],
    ['ROTATION', team.team.rotation],
    ['BULLPEN', team.team.bullpen],
  ];

  return (
    <div style={{ marginTop: 10 }}>
      {groups.map(([label, players]) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div className="label" style={{ marginBottom: 5 }}>{label}</div>
          <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => openPlayer(p.id)}
                style={{
                  width: '100%', textAlign: 'left',
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
                  gap: 9, alignItems: 'center', background: 'transparent',
                  padding: '8px 11px', borderBottom: '1px solid var(--hairline)',
                }}
              >
                <Avatar id={p.id} size={28} />
                <span style={{
                  font: "400 calc(12.5px * var(--ts)) var(--body)",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.name}</span>
                <span style={{ font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
                  {p.type === 'pitcher' ? (p as Pitcher).role : p.pos} · {p.classYear}
                </span>
                <span style={{ font: "600 calc(12px * var(--ts)) var(--mono)" }}>{overallOf(p)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProspectSheet({
  prospect, userTeam, coachPrestige, recruitingSkill, pitch, reachable, pipeline, pipelineStrength,
  live, full, left, onSet, onClose,
}: {
  prospect: Prospect; userTeam: number; coachPrestige: number; recruitingSkill: number;
  pitch: ReturnType<typeof pitchFor>;
  reachable: boolean; pipeline: boolean; pipelineStrength: number; live: boolean; full: boolean; left: number;
  onSet: (n: number) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<Sheet>('overview');
  const p = prospect.player;
  const spent = prospect.spent[userTeam] ?? 0;
  const points = Object.values(prospect.points);
  const best = points.length ? Math.max(...points) : 0;
  const s2 = standing(prospect.points[userTeam] ?? 0, best, points.length > 0);

  /*
    Into the frame, not into the scroller.

    The sheet rendered inside the board's momentum scroller, and iOS treats
    absolutely-positioned layers inside one badly: after a long scroll the
    scrim could land off-screen or keep swallowing taps it no longer appeared
    to own — reported as 'the end week button doesn't work after we try to
    scout one player.' The frame is the phone; a sheet covers the phone.
  */
  const host = document.querySelector('.app-frame');
  if (!host) return null;

  return (
    <InFrame>
      <div className="prospect-sheet-scrim fade-in" onClick={onClose}>
        <section className="prospect-sheet-modern rise-in" onClick={(e) => e.stopPropagation()}>
          <header className="prospect-sheet-toolbar">
            <span><small>RECRUITING FILE</small><strong>#{prospect.rank} nationally</strong></span>
            <button className="tap" type="button" onClick={onClose}>CLOSE</button>
          </header>

          <section className="prospect-sheet-identity">
            <span className="prospect-sheet-avatar"><Avatar id={p.id} size={68} /></span>
            <span className="prospect-sheet-name">
              <small>{'★'.repeat(prospect.stars)} · {prospect.state} · {slotOf(prospect)}</small>
              <h2>{p.name}</h2>
              <p>bats {p.bats} · throws {p.throws}</p>
            </span>
            <span className="prospect-sheet-standing" style={{ color: s2.tone }}>
              <small>CHASE</small><strong>{s2.label}</strong>
            </span>
          </section>

          <section className="prospect-sheet-snapshot">
            <span><small>STATUS</small><strong>{prospect.signedBy !== null ? 'SIGNED' : spent > 0 ? 'TARGET' : 'AVAILABLE'}</strong></span>
            <span><small>YOUR OFFER</small><strong>{spent > 0 ? `${spent}/WK` : '—'}</strong></span>
            <span><small>PIPELINE</small><strong>{pipeline ? pipelineLabel(pipelineStrength) : 'NO'}</strong></span>
          </section>

          <div className="prospect-sheet-tabs">
            <Segmented<Sheet>
              label="Prospect card section"
              value={tab}
              onChange={setTab}
              options={(['overview', 'report', 'stats', 'schools'] as Sheet[]).map((t) => ({
                value: t,
                label: SHEET_LABEL[t].charAt(0) + SHEET_LABEL[t].slice(1).toLowerCase(),
              }))}
            />
          </div>

          <div className="prospect-sheet-body">
            {tab === 'overview' && (
              <Overview
                prospect={prospect} pitch={pitch} reachable={reachable}
                pipeline={pipeline} pipelineStrength={pipelineStrength} live={live}
                full={full} spent={spent} left={left} coachPrestige={coachPrestige}
                recruitingSkill={recruitingSkill} onSet={onSet}
              />
            )}
            {tab === 'report' && <Report prospect={prospect} recruitingSkill={recruitingSkill} />}
            {tab === 'stats' && <Stats prospect={prospect} />}
            {tab === 'schools' && <Schools prospect={prospect} userTeam={userTeam} />}
          </div>
        </section>
      </div>
    </InFrame>
  );

}

function Overview({
  prospect, pitch, reachable, pipeline, pipelineStrength, live, full, spent, left,
  coachPrestige, recruitingSkill, onSet,
}: {
  prospect: Prospect; pitch: ReturnType<typeof pitchFor>;
  reachable: boolean; pipeline: boolean; pipelineStrength: number; live: boolean; full: boolean;
  spent: number; left: number; coachPrestige: number; recruitingSkill: number;
  onSet: (n: number) => void;
}) {
  const wants = [...PRIORITIES].sort(
    (a, b) => prospect.priorities[b] - prospect.priorities[a],
  ).slice(0, 2);
  // The same call the week close will make, skill included, or the preview
  // undersells what the spend is actually worth.
  const gain = weeklyPoints(prospect, pitch, Math.max(spent, 1), coachPrestige, recruitingSkill);
  const overall = reportedOverall(prospect, recruitingSkill);
  const ceiling = reportedPotential(prospect, recruitingSkill);
  const hints = hintsFor(prospect);

  return (
    <>
      {/*
        The estimate first, because it is the thing the rest of the sheet is
        an argument about. Two bands and one line of what people say — the full
        report, tool by tool, is one tab across. Putting nothing here and making
        the report a tab you had to find would hide the only number on the
        screen that the decision turns on.
      */}
      <section className="prospect-estimate">
        <div>
          <small>ESTIMATED OVERALL</small>
          <strong>{overall.low}&ndash;{overall.high}</strong>
          <span>today</span>
        </div>
        <div>
          <small>ESTIMATED CEILING</small>
          <strong>{ceiling.low}&ndash;{ceiling.high}</strong>
          <span>in time</span>
        </div>
      </section>

      <section className="scout-note">
        <small>WHAT THEY SAY</small>
        <p>&ldquo;{hints.ceiling.text}&rdquo;</p>
      </section>

            <section className="prospect-wants">
        {/* No counter — it overflowed on the phone and the list under it
            already answers how many. */}
        <div className="flow-section-title">
          <span className="label">WHAT HE WANTS</span>
        </div>
        {wants.map((k, i) => (
          <div key={k}>
            <span>{i + 1}</span>
            <p>
              <strong>{PRIORITY_LABEL[k]}</strong>
              <small>{PRIORITY_BLURB[k]}</small>
            </p>
          </div>
        ))}
      </section>

      {!reachable && (
        <section className="recruit-decision-note is-blocked">
          <small>OUT OF REACH</small>
          <strong>He will not take the call.</strong>
          <p>A recruit like him does not answer programs like yours yet. Build the place up and players like him start listening.</p>
        </section>
      )}

      {/*
        A mark, where three sentences used to be.

        Reported as taking too much of the screen, and it was: a paragraph
        explaining the home-state rule sat on every in-state recruit's card
        for ever, long after the player had learned the rule. The advantage
        itself is already visible where it does its work — it is in his
        interest and in the pitch — so the card only has to say that it
        applies.
      */}
      {reachable && pipeline && (
        <div className="recruit-pipeline-badge">
          <small>PIPELINE EDGE</small><strong>{pipelineLabel(pipelineStrength)} · {prospect.state}</strong>
        </div>
      )}

      {reachable && full && (
        <section className="recruit-decision-note is-full">
          <small>CLASS FULL</small><strong>No scholarship room left.</strong>
          <p>Clear a target or finish the class before adding another name.</p>
        </section>
      )}

      {reachable && live && !full && (
        <section className="prospect-offer">
          <div className="prospect-offer-head">
            <span>
              <small>YOUR WEEKLY OFFER</small>
              <strong>{spent} {spent === 1 ? 'POINT' : 'POINTS'}</strong>
            </span>
            <b>+{Math.round(gain)} interest</b>
          </div>
          {/*
            Pips, not a track. A range input on a phone is a drag that has to
            beat the scroller for the gesture — "the bar works fine to add
            points but to remove them it doesn't work most of the times."
            Twelve tap targets have no gesture to lose: tap the sixth pip and
            the offer is six; tap it again and it is five.
          */}
          <div className="prospect-offer-pips">
            {Array.from({ length: MAX_PER_RECRUIT }, (_, i) => {
              const n = i + 1;
              const can = n <= Math.min(MAX_PER_RECRUIT, spent + left);
              return (
                <button
                  className={n <= spent ? 'on' : ''}
                  type="button"
                  key={n}
                  disabled={!can}
                  onClick={() => onSet(can ? (spent === n ? n - 1 : n) : spent)}
                  aria-label={`Offer ${n} points`}
                />
              );
            })}
          </div>
          <div className="prospect-offer-foot">
            {/* The prestige floor used to be printed here — "min. prestige
                ★★★" — which handed a hidden mechanic to the player as a
                number. Part of the secrets scrub: the game may keep rules it
                does not recite, and a recruit who is out of reach already
                says so in his own voice on the card. */}
            <span>{left} left this week</span>
            <button type="button" disabled={spent === 0} onClick={() => onSet(0)}>Clear</button>
          </div>
        </section>
      )}
    </>
  );
}


/**
 * The scouting report: two bands, two impressions, and the tools underneath.
 *
 * Nothing on this tab is a fact. Every number is a window your own recruiting
 * skill decides the width of, and the two lines of prose are the only other
 * evidence there is — vague on purpose, honest always, and drawn on two
 * different things so that reading them together says more than either alone.
 */
function Report({
  prospect, recruitingSkill,
}: { prospect: Prospect; recruitingSkill: number }) {
  const p = prospect.player;
  const rows: [string, number][] = p.type === 'pitcher'
    ? [['K/9', (p as Pitcher).stuff], ['H/9', (p as Pitcher).movement],
       ['BB/9', (p as Pitcher).control], ['STAMINA', (p as Pitcher).stamina]]
    : [['CONTACT', (p as Hitter).contact], ['POWER', (p as Hitter).power],
       ['DISCIPLINE', (p as Hitter).eye], ['SPEED', (p as Hitter).speed],
       ['REACTION', (p as Hitter).range], ['ARM STRENGTH', (p as Hitter).arm]];

  const overall = reportedOverall(prospect, recruitingSkill);
  const ceiling = reportedPotential(prospect, recruitingSkill);
  const hints = hintsFor(prospect);

  return (
    <>
      <section className="prospect-estimate">
        <div>
          <small>ESTIMATED OVERALL</small>
          <strong>{overall.low}&ndash;{overall.high}</strong>
          <span>today</span>
        </div>
        <div>
          <small>ESTIMATED CEILING</small>
          <strong>{ceiling.low}&ndash;{ceiling.high}</strong>
          <span>in time</span>
        </div>
      </section>

      {/* Two impressions, not one summary. See the note on `hintsFor`. */}
      <section className="scout-note">
        <small>WHAT THEY SAY</small>
        <p>&ldquo;{hints.ceiling.text}&rdquo;</p>
        <p>&ldquo;{hints.development.text}&rdquo;</p>
      </section>

      {/* The bands drawn as bands — where inside the scale each window sits,
          not just its two numbers. The proposal's own tool report. */}
      <section className="prospect-tool-report">
        {rows.map(([label, value]) => {
          const { low, high } = reportedTool(prospect, value, recruitingSkill);
          return (
            <div key={label}>
              <span>{label}</span>
              <b>{low}&ndash;{high}</b>
              <i><em style={{ left: `${low}%`, width: `${Math.max(2, high - low)}%` }} /></i>
            </div>
          );
        })}
      </section>

      <FieldNote
        title="Estimates, not measurements"
        text="He is somewhere inside each band — not in the middle. Only your
          RECRUITING skill narrows them."
      />
    </>
  );
}

function Stats({ prospect }: { prospect: Prospect }) {
  const line = highSchoolLine(prospect.player);
  return (
    <>
      <div className="flow-section-title">
        <span className="label">LAST SPRING</span>
        <b>HIGH SCHOOL</b>
      </div>
      <section className="prospect-stats">
        {line.map((row) => (
          <div key={row.label}>
            <small>{row.label}</small>
            <strong>{row.value}</strong>
          </div>
        ))}
      </section>
      <FieldNote
        title="Read the competition"
        text="Everybody's numbers look absurd against high school pitching. Ask
          whose look absurd for the right reasons."
      />
    </>
  );
}

function Schools({ prospect, userTeam }: { prospect: Prospect; userTeam: number }) {
  const season = useDynasty((s) => s.season);
  const rivals = Object.entries(prospect.points)
    .map(([team, pts]) => ({ team: Number(team), pts }))
    .filter((r) => r.pts > 0)
    .sort((a, b) => b.pts - a.pts);

  if (!season) return null;
  const best = rivals[0]?.pts ?? 1;

  return (
    <>
      <div className="flow-section-title">
        <span className="label">WHO ELSE IS IN</span>
        <b>{rivals.length} {rivals.length === 1 ? 'SCHOOL' : 'SCHOOLS'}</b>
      </div>
      {rivals.length === 0 && (
        <FieldNote
          title="Nobody has been to see him"
          text="That is an opportunity or a warning, and the only way to find out
            is to spend on him."
        />
      )}
      <section className="school-chase">
        {rivals.map((r, i) => {
          const t = season.teams[r.team];
          const mine = r.team === userTeam;
          return (
            <div key={r.team}>
              <span>
                <b>{i + 1}</b>
                <strong>{t?.def.school ?? '?'}</strong>
                <small>{mine ? 'YOU · ' : ''}{Math.round(r.pts)} PTS</small>
              </span>
              <i><em style={{ width: `${(r.pts / best) * 100}%` }} /></i>
            </div>
          );
        })}
      </section>
    </>
  );
}


function Stat({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{
      flex: 1, paddingRight: 10,
      borderRight: last ? 'none' : '1px solid var(--hairline)',
      paddingLeft: last ? 10 : 0,
    }}>
      <div className="label">{k}</div>
      <div style={{ font: "700 calc(20px * var(--ts))/1 var(--display)", marginTop: 3 }}>{v}</div>
    </div>
  );
}
