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

import { useMemo, useState } from 'react';
import { boardBudget, useDynasty, useUserTeam } from '../../state/store.js';
import {
  fit, weeklyPoints, canPursue, inPipeline, reachFloor, byRank,
  PRIORITIES, PRIORITY_LABEL, PRIORITY_BLURB,
  SCHOLARSHIPS, MAX_PER_RECRUIT, RECRUITING_WEEKS,
  reportedOverall, reportedPotential, reportedTool, reportWidth, hintsFor,
  type Prospect, type Priority,
} from '../../engine/recruiting.js';
import { walkOnShortfall } from '../../engine/progression.js';
import { pitchFor, developmentScore } from '../../engine/pitch.js';
import { overallOf } from '../../engine/ratings.js';
import { highSchoolLine } from '../../engine/scouting.js';
import { CONFERENCES, ALL_STATES } from '../../data/schools.js';
import { prestigeStars } from '../../engine/program.js';
import { Avatar, teamColour } from '../Avatar.js';
import { FirstVisit } from '../Tutorial.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
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
  /** Only recruits from this program's own state. */
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
): boolean {
  if (f.pos && slotOf(p) !== f.pos) return false;
  if (f.state && p.state !== f.state) return false;
  if (f.stars.length > 0 && !f.stars.includes(p.stars)) return false;
  if (f.pipelineOnly && !inPipeline(p, homeState)) return false;
  if (f.untouchedOnly && !untouched(p)) return false;
  if (f.reachOnly && !canPursue(p, programStars, inPipeline(p, homeState))) return false;
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
  p.player.type === 'pitcher' ? (p.player as Pitcher).role : p.player.pos;

export function Board() {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const coach = useDynasty((s) => s.coach);
  const recruitFor = useDynasty((s) => s.recruit);
  const advanceWeek = useDynasty((s) => s.advanceRecruitingWeek);
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
    return pitchFor(season, team, conf?.region ?? 'Gulf', developmentScore(team));
  }, [season, team, version]);

  const myStars = team ? prestigeStars(team.prestige) : 1;
  const homeState = team?.def.state ?? '';

  const {
    list, matches, targets, commits, spent, locked, shortfall, covered,
  } = useMemo(() => {
    const all = season?.recruiting.prospects ?? [];
    // One gate, asked the same way everywhere on this screen: the program's
    // tier, plus a star for a recruit out of its own state.
    const reaches = (p: Prospect): boolean =>
      canPursue(p, myStars, inPipeline(p, homeState));

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
    const shown = open.filter((p) => matchesFilters(p, filters, homeState, myStars));
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
    const classPlayers = signed.map((p) => p.player);
    const still = walkOnShortfall(roster, classPlayers);

    return {
      list: showAll ? ranked : ranked.slice(0, ROW_CAP),
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
    <FixedHeader header={
      <div style={{ padding: '12px 14px 10px' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        borderBottom: '2px solid var(--ink)', paddingBottom: 6,
      }}>
        <div>
          <div className="label">
            RECRUITING · {live ? `WEEK ${week} OF ${RECRUITING_WEEKS}` : 'SIGNED'}
          </div>
          <div style={{
            font: "800 21px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
          }}>The board</div>
        </div>
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
          onClick={() => {
            setOpenId(null);
            // Filters only shape the recruits list, so opening them from the
            // roster tab and landing back on the roster would be a control that
            // changed a screen you were not looking at.
            if (!filtersOpen) setView('recruits');
            setFiltersOpen((v) => !v);
          }}
          style={{
            padding: '7px 10px',
            background: filtersOpen || activeFilters ? 'var(--clay)' : 'var(--paper)',
            border: `1px solid ${filtersOpen || activeFilters ? 'var(--clay)' : 'rgba(28,36,48,.28)'}`,
            color: filtersOpen || activeFilters ? 'var(--cream)' : 'var(--ink)',
            font: "700 9px var(--mono)", letterSpacing: '.1em',
          }}
        >FILTER{activeFilters ? ' ON' : ''}</button>
      </div>

      <div style={{
        display: 'flex', marginTop: 12,
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="SCHOLARSHIPS" v={`${commits.length}/${SCHOLARSHIPS}`} accent={full} />
        <Tile k="BUDGET" v={live ? String(left) : '—'} accent={live && left === 0} />
        <Tile k="PRESTIGE" v={'★'.repeat(myStars) + '☆'.repeat(5 - myStars)} last />
      </div>

      <div style={{ display: 'flex', gap: 5, marginTop: 12 }}>
        {(['recruits', 'targets', 'commits', 'needs', 'roster'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => {
              setView(v);
              // Leaving filter mode is the whole point of this line. The tabs
              // are in the pinned header and stay live while the panel is up,
              // so without it a tap moved the tab underneath a panel that was
              // still covering the body and still owned the pinned button —
              // which is how END WEEK ended up reading "SHOW THE TOP 50 OF
              // 518" on a screen that looked like the roster tab.
              setFiltersOpen(false);
            }}
            style={{
              flex: 1, padding: '8px 0',
              background: v === view ? 'var(--clay)' : 'var(--paper)',
              border: v === view ? '1px solid var(--clay)' : '1px solid rgba(28,36,48,.28)',
              color: v === view ? 'var(--cream)' : 'var(--ink)',
              font: "700 8.5px var(--mono)", letterSpacing: '.08em',
            }}
          >
            {VIEW_LABEL[v]}
            {v === 'targets' && targets.length > 0 ? ` ${targets.length}` : ''}
            {v === 'commits' && commits.length > 0 ? ` ${commits.length}` : ''}
            {v === 'needs' && stillShort > 0 ? ` ${stillShort}` : ''}
          </button>
        ))}
      </div>
      </div>
    }>
    {live && <FirstVisit id="recruiting" />}
    <div style={{ padding: '10px 14px 20px' }}>
      {/* Filtering replaces the body rather than pushing it down. The rest of
          this branch is the board itself; see the note on the FILTER button. */}
      {filtersOpen ? (
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          homeState={homeState}
          myStars={myStars}
        />
      ) : <>
      {live && lastWeek && (
        <div style={{
          marginBottom: 10, border: '1px solid var(--clay)',
          background: 'rgba(168,68,42,.10)',
        }}>
          <div style={{ padding: '5px 10px', background: 'var(--clay)' }}>
            <span style={{
              font: "700 9px var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
            }}>WEEK {lastWeek.closed} IS OVER</span>
          </div>
          <div style={{ padding: '10px 11px', font: "400 12px/1.5 var(--body)" }}>
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
                ? `Nobody came off the board anywhere. Your budget is back to ${weekly}.`
                : `${lastWeek.gone} recruit${lastWeek.gone === 1 ? '' : 's'} signed elsewhere and ${lastWeek.gone === 1 ? 'is' : 'are'} off the board. Your budget is back to ${weekly}.`}
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
          <div style={{
            marginTop: 10, border: '1px solid var(--faint)', background: 'var(--paper)',
          }}>
            {(view === 'recruits' ? list : view === 'targets' ? targets : commits).length === 0 && (
              <div style={{
                padding: '18px 12px', font: "400 12px var(--body)", color: 'var(--dim)',
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
                  />
                ))}
              </div>
              <div style={{
                marginTop: 6, font: "400 11px/1.45 var(--body)", color: 'var(--dim)',
              }}>
                A program of yours can call a recruit one grade above it, and one
                more than that inside your own state. Build the program up and
                players like these start listening.
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
          recruitingSkill={coach.skills.recruiting}
          pitch={pitch}
          reachable={canPursue(open, myStars, inPipeline(open, homeState))}
          pipeline={inPipeline(open, homeState)}
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
      {pinned.kind !== null && (
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
  p, userTeam, season, onOpen, signed,
}: {
  p: Prospect; userTeam: number; season: { teams: { def: { abbr: string } }[] };
  onOpen: () => void; signed?: boolean;
}) {
  const spent = p.spent[userTeam] ?? 0;
  const points = Object.values(p.points);
  const best = points.length ? Math.max(...points) : 0;
  const s = signed || p.signedBy === userTeam
    ? { label: 'SIGNED', tone: 'var(--win)' }
    : p.signedBy !== null
      ? { label: 'LOST HIM', tone: 'var(--clay)' }
      : standing(p.points[userTeam] ?? 0, best, points.length > 0);

  // Whoever has him: the program he signed with, else the one in front.
  const leader = p.signedBy !== null ? p.signedBy
    : points.length > 0
      ? Number(Object.entries(p.points).sort((a, b) => b[1] - a[1])[0]?.[0])
      : null;
  const abbr = leader !== null ? season.teams[leader]?.def.abbr : undefined;
  const colour = abbr ? teamColour(abbr) : 'transparent';

  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%', textAlign: 'left',
        display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
        gap: 9, alignItems: 'center',
        padding: '10px 11px 10px 8px', borderBottom: '1px solid var(--hairline)',
        borderLeft: `3px solid ${colour}`,
        background: spent > 0 && !signed ? 'rgba(168,68,42,.10)' : 'transparent',
      }}
    >
      {/* The jersey is only ever a school he has actually signed for. A face
          wearing the colours of a program still recruiting him would be the
          row telling a story the board has not finished. */}
      <Avatar id={p.id} team={p.signedBy !== null ? abbr : undefined} size={34} />
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', font: `${spent > 0 ? 700 : 400} 13px var(--body)`,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{p.player.name}</span>
        <span style={{
          display: 'block', marginTop: 1, font: "400 10px var(--mono)", color: 'var(--dim)',
        }}>
          #{p.rank} · {slotOf(p)} · {p.state} · {PRIORITY_LABEL[topPriority(p)]}
        </span>
      </span>
      <span style={{
        font: "700 8.5px var(--mono)", letterSpacing: '.08em', color: s.tone,
        whiteSpace: 'nowrap', textAlign: 'right',
      }}>
        {s.label}
        {spent > 0 && !signed && (
          <span style={{ display: 'block', color: 'var(--clay)' }}>{spent} spent</span>
        )}
        {abbr && leader !== userTeam && (
          <span style={{ display: 'block', color: colour }}>{abbr}</span>
        )}
      </span>
      <span style={{
        font: "600 11px var(--mono)", color: 'var(--clay)', whiteSpace: 'nowrap',
      }}>{'★'.repeat(p.stars)}</span>
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
        background: 'var(--paper)', border: '1px solid rgba(28,36,48,.28)',
        color: 'var(--ink)', font: "700 9.5px var(--mono)", letterSpacing: '.1em',
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

  return (
    <div style={{
      marginTop: 10, padding: '11px 12px',
      border: '1px solid var(--clay)', background: 'var(--paper)',
    }}>
      <div className="label" style={{ marginBottom: 5 }}>POSITION</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {POSITIONS.map((pos) => (
          <Chip
            key={pos}
            on={filters.pos === pos}
            onClick={() => set('pos', filters.pos === pos ? null : pos)}
          >{pos}</Chip>
        ))}
      </div>

      {/*
        More than one at a time, because "four stars and up" and "the threes and
        twos I can actually sign" are both real questions and neither is a
        single grade. The stars are the only quality reading on this board that
        is not an interval — every other number the screen shows is a window as
        wide as the coach is bad at this — so they are the only one a filter can
        be honest about.
      */}
      <div className="label" style={{ marginTop: 11, marginBottom: 5 }}>STARS</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[5, 4, 3, 2, 1].map((n) => (
          <button
            key={n}
            onClick={() => toggleStar(n)}
            style={{
              flex: 1, padding: '7px 0',
              background: filters.stars.includes(n) ? 'var(--clay)' : 'var(--field)',
              border: `1px solid ${filters.stars.includes(n) ? 'var(--clay)' : 'rgba(28,36,48,.2)'}`,
              color: filters.stars.includes(n) ? 'var(--cream)' : 'var(--ink)',
              font: "700 10px var(--mono)", letterSpacing: '.04em',
            }}
          >{n}★</button>
        ))}
      </div>

      <div className="label" style={{ marginTop: 11, marginBottom: 5 }}>HOME STATE</div>
      <select
        value={filters.state ?? ''}
        onChange={(e) => set('state', e.target.value === '' ? null : e.target.value)}
        style={{
          width: '100%', padding: '9px 8px',
          background: 'var(--field)', border: '1px solid rgba(28,36,48,.28)',
          color: 'var(--ink)', font: "600 12px var(--mono)",
          borderRadius: 0, appearance: 'none',
        }}
      >
        <option value="">ANYWHERE</option>
        {ALL_STATES.map((st) => (
          <option key={st} value={st}>{st}{st === homeState ? ' · yours' : ''}</option>
        ))}
      </select>

      <div style={{ marginTop: 11, display: 'grid', gap: 6 }}>
        <Switch
          on={filters.pipelineOnly}
          onClick={() => set('pipelineOnly', !filters.pipelineOnly)}
          label={`IN MY PIPELINE${homeState ? ` · ${homeState}` : ''}`}
          note={`Your own state. Worth a star of reach on top of your ${'★'.repeat(myStars)}.`}
        />
        <Switch
          on={filters.untouchedOnly}
          onClick={() => set('untouchedOnly', !filters.untouchedOnly)}
          label="NOBODY IS ON HIM"
          note="No program has spent a point on him yet."
        />
        <Switch
          on={filters.reachOnly}
          onClick={() => set('reachOnly', !filters.reachOnly)}
          label="WITHIN MY REACH ONLY"
          note="Hides the men who will not take the call."
        />
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: {
  on: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 8px',
        background: on ? 'var(--clay)' : 'var(--field)',
        border: `1px solid ${on ? 'var(--clay)' : 'rgba(28,36,48,.2)'}`,
        color: on ? 'var(--cream)' : 'var(--ink)',
        font: "700 9px var(--mono)", letterSpacing: '.06em',
      }}
    >{children}</button>
  );
}

/** A switch with its own sentence, because none of these explain themselves. */
function Switch({ on, onClick, label, note }: {
  on: boolean; onClick: () => void; label: string; note: string;
}) {
  return (
    <button
      onClick={onClick}
      className="tap"
      style={{
        width: '100%', textAlign: 'left', padding: '8px 10px',
        background: on ? 'var(--clay)' : 'var(--field)',
        border: `1px solid ${on ? 'var(--clay)' : 'rgba(28,36,48,.28)'}`,
      }}
    >
      <span style={{
        display: 'block', font: "700 9.5px var(--mono)", letterSpacing: '.1em',
        color: on ? 'var(--cream)' : 'var(--ink)',
      }}>{label}</span>
      <span style={{
        display: 'block', marginTop: 3, font: "400 10.5px/1.35 var(--body)",
        color: on ? 'rgba(246,241,230,.78)' : 'var(--dim)',
      }}>{note}</span>
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
        font: "400 11.5px/1.5 var(--body)", color: 'var(--ink)',
      }}>
        {total === 0
          ? 'Every spot is covered. Nobody walks on this year. The whole roster '
            + 'is men you went and got.'
          : `${total} walk-on${total === 1 ? '' : 's'} as it stands. Anything you do `
            + "not sign gets filled by whoever turns up, thirteen points below your "
            + "program's own level, and he is gone again the moment the season ends."}
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
                font: "700 13px var(--mono)", letterSpacing: '.06em', color: 'var(--clay)',
              }}>{h.pos}</span>
              <span style={{ font: "400 11.5px/1.4 var(--body)", color: 'var(--dim)' }}>
                {h.count > 1 ? `${h.count} walk-ons` : 'one walk-on'} unless you sign
              </span>
              <span style={{
                font: "700 8px var(--mono)", letterSpacing: '.1em', color: 'var(--dim)',
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
                  font: "700 13px var(--mono)", letterSpacing: '.06em', color: 'var(--win)',
                }}>{h.pos}</span>
                <span style={{ font: "400 11.5px/1.4 var(--body)", color: 'var(--dim)' }}>
                  {h.count > 1 ? `${h.count} spots` : 'one spot'} the class fills
                </span>
                <span style={{
                  font: "700 8px var(--mono)", letterSpacing: '.1em', color: 'var(--win)',
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
                  font: "400 12.5px var(--body)",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.name}</span>
                <span style={{ font: "400 10px var(--mono)", color: 'var(--dim)' }}>
                  {p.type === 'pitcher' ? (p as Pitcher).role : p.pos} · {p.classYear}
                </span>
                <span style={{ font: "600 12px var(--mono)" }}>{overallOf(p)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProspectSheet({
  prospect, userTeam, coachPrestige, recruitingSkill, pitch, reachable, pipeline,
  live, full, left, onSet, onClose,
}: {
  prospect: Prospect; userTeam: number; coachPrestige: number; recruitingSkill: number;
  pitch: ReturnType<typeof pitchFor>;
  reachable: boolean; pipeline: boolean; live: boolean; full: boolean; left: number;
  onSet: (n: number) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<Sheet>('overview');
  const p = prospect.player;
  const spent = prospect.spent[userTeam] ?? 0;
  const points = Object.values(prospect.points);
  const best = points.length ? Math.max(...points) : 0;
  const s = standing(prospect.points[userTeam] ?? 0, best, points.length > 0);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, background: 'rgba(28,36,48,.55)',
        display: 'flex', alignItems: 'flex-end', zIndex: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          /*
            A fixed height, not a maximum.
            
            The four tabs hold very different amounts — two priorities against
            six rating bands against a list of eight rival schools — so a sheet
            sized to its contents jumped every time you switched, which is the
            same "the app keeps changing shape" problem the manage screen had.
            The sheet is a fixed panel now and the body scrolls inside it, so
            switching tabs moves nothing but the text.
          */
          width: '100%', height: '72%',
          display: 'flex', flexDirection: 'column',
          background: 'var(--paper)', borderTop: '3px solid var(--clay)',
        }}
      >
        <div style={{
          flex: 'none', padding: '7px 12px', background: 'var(--clay)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{
            font: "600 9px var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
          }}>{'★'.repeat(prospect.stars)} · {prospect.state}</span>
          <button onClick={onClose} style={{
            font: "600 9px var(--mono)", letterSpacing: '.14em', color: 'rgba(246,241,230,.8)',
          }}>CLOSE</button>
        </div>

        <div style={{
          flex: 'none', padding: '13px 12px 6px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Avatar id={p.id} size={54} />
          <div style={{ minWidth: 0 }}>
          <div style={{ font: "800 22px/1 var(--display)", textTransform: 'uppercase' }}>
            {p.name}
          </div>
          <div style={{ marginTop: 3, font: "400 11px var(--mono)", color: 'var(--dim)' }}>
            {slotOf(prospect)} &middot; bats {p.bats} &middot; throws {p.throws}
            {' '}&middot; <span style={{ color: s.tone }}>{s.label}</span>
          </div>
          </div>
        </div>

        <div style={{ flex: 'none', display: 'flex', gap: 4, padding: '0 12px' }}>
          {(['overview', 'report', 'stats', 'schools'] as Sheet[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '8px 0',
                background: t === tab ? 'var(--ink)' : 'var(--field)',
                border: 'none',
                color: t === tab ? 'var(--cream)' : 'var(--dim)',
                font: "700 8.5px var(--mono)", letterSpacing: '.08em',
              }}
            >{SHEET_LABEL[t]}</button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px' }}>
          {tab === 'overview' && (
            <Overview
              prospect={prospect} pitch={pitch} reachable={reachable}
              pipeline={pipeline} live={live}
              full={full} spent={spent} left={left} coachPrestige={coachPrestige}
              recruitingSkill={recruitingSkill}
              onSet={onSet}
            />
          )}
          {tab === 'report' && (
            <Report prospect={prospect} recruitingSkill={recruitingSkill} />
          )}
          {tab === 'stats' && <Stats prospect={prospect} />}
          {tab === 'schools' && <Schools prospect={prospect} userTeam={userTeam} />}
        </div>
      </div>
    </div>
  );
}

function Overview({
  prospect, pitch, reachable, pipeline, live, full, spent, left,
  coachPrestige, recruitingSkill, onSet,
}: {
  prospect: Prospect; pitch: ReturnType<typeof pitchFor>;
  reachable: boolean; pipeline: boolean; live: boolean; full: boolean;
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
      <div style={{
        marginBottom: 12, padding: '9px 11px 10px',
        background: 'var(--field)', borderLeft: '3px solid var(--ink)',
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
          <div>
            <div className="label">OVERALL</div>
            <div style={{ font: "700 18px/1 var(--display)", marginTop: 3 }}>
              {overall.low}&ndash;{overall.high}
            </div>
          </div>
          <div>
            <div className="label">CEILING</div>
            <div style={{ font: "700 18px/1 var(--display)", marginTop: 3 }}>
              {ceiling.low} &ndash; {ceiling.high}
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 8, font: "400 11.5px/1.45 var(--body)", color: 'var(--ink)',
        }}>&ldquo;{hints.ceiling.text}&rdquo;</div>
      </div>

      <div className="label">WHAT HE WANTS</div>
      <div style={{ marginTop: 5 }}>
        {wants.map((k) => (
          <div key={k} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '6px 0', borderBottom: '1px solid var(--hairline)',
          }}>
            <span style={{ font: "600 11px var(--mono)", letterSpacing: '.06em' }}>
              {PRIORITY_LABEL[k]}
            </span>
            <span style={{ font: "400 11px var(--body)", color: 'var(--dim)' }}>
              {PRIORITY_BLURB[k]}
            </span>
          </div>
        ))}
      </div>

      {!reachable && (
        <div style={{
          marginTop: 12, padding: '11px 12px', background: 'var(--field)',
          borderLeft: '3px solid var(--clay)',
          font: "400 11.5px/1.5 var(--body)", color: 'var(--dim)',
        }}>
          <strong style={{ color: 'var(--ink)' }}>He will not take the call.</strong>
          {' '}A {'★'.repeat(prospect.stars)} recruit hears out a{' '}
          {'★'.repeat(reachFloor(prospect.stars))} program and up, one more
          rung down if he is from your own state, and he is not. Build the program
          up and players like him start listening.
        </div>
      )}

      {reachable && pipeline && (
        <div style={{
          marginTop: 12, padding: '11px 12px', background: 'var(--field)',
          borderLeft: '3px solid var(--win)',
          font: "400 11.5px/1.5 var(--body)", color: 'var(--dim)',
        }}>
          <strong style={{ color: 'var(--ink)' }}>He is in your pipeline.</strong>
          {' '}A kid from your own state will hear out a program a rung below
          the one his grade would otherwise talk to, and proximity is worth
          full marks in the pitch on top of that.
        </div>
      )}

      {reachable && full && (
        <div style={{
          marginTop: 12, padding: '11px 12px', background: 'var(--field)',
          borderLeft: '3px solid var(--clay)',
          font: "400 11.5px/1.5 var(--body)", color: 'var(--dim)',
        }}>
          <strong style={{ color: 'var(--ink)' }}>Your class is full.</strong>
          {' '}Every scholarship is spoken for.
        </div>
      )}

      {reachable && live && !full && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="label">YOUR OFFER</span>
            <span style={{ font: "700 11px var(--mono)", color: 'var(--clay)' }}>
              +{Math.round(gain)} pts a week
            </span>
          </div>

          {/*
            A slider rather than a row of steps. The budget is a continuous
            quantity and reads as one — dragging shows the cost against the
            remaining pool as it moves, where discrete buttons make you compute
            the difference yourself.
          */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginTop: 8,
          }}>
            <span style={{
              font: "800 26px/1 var(--display)", color: spent > 0 ? 'var(--clay)' : 'var(--dim)',
              minWidth: 34, textAlign: 'right',
            }}>{spent}</span>
            {/*
              A step down and a step up either side of it.

              Reported from testing: "the bar works fine to add points but to
              remove points it's a hassle, doesn't work most of the times". On a
              phone a drag that starts on a thin track is ambiguous — the
              scroller can claim it — and dragging *left* to a smaller number is
              the fiddliest version of that. `touchAction: none` gives the
              gesture to the slider, and the buttons mean you never have to make
              it at all.
            */}
            <Step label="−" onClick={() => onSet(Math.max(0, spent - 1))} disabled={spent === 0} />
            {/*
              Pips, not a track.

              A range input on a phone is a drag that has to beat the scroller
              for the gesture, and dragging *down* to a smaller number is the
              worst case of it — "the bar works fine to add points but to remove
              them it doesn't work most of the times". Twelve tap targets in a
              row have no gesture to lose: tap the sixth pip and the offer is
              six. The steppers either side stay for one-at-a-time nudging.
            */}
            <div style={{ flex: 1, display: 'flex', gap: 3 }}>
              {Array.from({ length: MAX_PER_RECRUIT }, (_, i) => {
                const n = i + 1;
                const reachable = n <= Math.min(MAX_PER_RECRUIT, spent + left);
                const on = n <= spent;
                return (
                  <button
                    key={n}
                    onClick={() => onSet(reachable ? (spent === n ? n - 1 : n) : spent)}
                    disabled={!reachable}
                    className="tap"
                    style={{
                      flex: 1, height: 26, padding: 0,
                      background: on ? 'var(--clay)'
                        : reachable ? 'rgba(28,36,48,.10)' : 'rgba(28,36,48,.04)',
                      border: 'none',
                    }}
                    aria-label={`Offer ${n}`}
                  />
                );
              })}
            </div>
            <Step
              label="+"
              onClick={() => onSet(Math.min(Math.min(MAX_PER_RECRUIT, spent + left), spent + 1))}
              disabled={spent >= Math.min(MAX_PER_RECRUIT, spent + left)}
            />
            <button
              onClick={() => onSet(0)}
              disabled={spent === 0}
              style={{
                flex: 'none', padding: '6px 9px', background: 'transparent',
                border: '1px solid rgba(28,36,48,.22)',
                color: spent > 0 ? 'var(--dim)' : 'rgba(28,36,48,.2)',
                font: "700 8.5px var(--mono)", letterSpacing: '.08em',
              }}
            >OFF</button>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 8, font: "400 10.5px var(--mono)", color: 'var(--dim)',
          }}>
            <span>Budget: <strong style={{ color: 'var(--ink)' }}>{left}</strong> left</span>
            {/* Off his star rating, not off the floor stored on him: a save
                made under the old per-recruit ladder carries a number the gate
                no longer reads. See `canPursue`. */}
            <span>
              Min. prestige: {'★'.repeat(reachFloor(prospect.stars))}
              {pipeline ? ' − 1 here' : ''}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

/** One notch on the offer, with a target big enough to hit with a thumb. */
function Step(
  { label, onClick, disabled }:
  { label: string; onClick: () => void; disabled: boolean },
) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 'none', width: 38, height: 38,
        background: disabled ? 'transparent' : 'var(--field)',
        border: `1px solid ${disabled ? 'rgba(28,36,48,.14)' : 'rgba(28,36,48,.34)'}`,
        color: disabled ? 'rgba(28,36,48,.22)' : 'var(--ink)',
        font: "700 18px var(--mono)", lineHeight: 1,
      }}
    >{label}</button>
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
      <div style={{ display: 'flex', marginBottom: 12 }}>
        <Stat k="OVERALL" v={`${overall.low}–${overall.high}`} />
        <Stat k="CEILING" v={`${ceiling.low} – ${ceiling.high}`} last />
      </div>

      {/* Two impressions, not one summary. See the note on `hintsFor`. */}
      <div style={{
        marginBottom: 12, padding: '10px 11px',
        background: 'var(--field)', borderLeft: '3px solid var(--clay)',
      }}>
        <div className="label" style={{ marginBottom: 5 }}>WHAT THEY SAY</div>
        <div style={{ font: "400 11.5px/1.5 var(--body)" }}>
          &ldquo;{hints.ceiling.text}&rdquo;
        </div>
        <div style={{ marginTop: 6, font: "400 11.5px/1.5 var(--body)" }}>
          &ldquo;{hints.development.text}&rdquo;
        </div>
      </div>

      {rows.map(([label, value]) => {
        const { low, high } = reportedTool(prospect, value, recruitingSkill);
        return (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 0', borderBottom: '1px solid var(--hairline)',
          }}>
            <span style={{ font: "600 10px var(--mono)", letterSpacing: '.08em' }}>{label}</span>
            <span style={{ font: "600 12px var(--mono)", color: 'var(--dim)' }}>
              {low}&ndash;{high}
            </span>
          </div>
        );
      })}

      {/*
        The one place the screen says out loud what the recruiting skill buys.
        Without it the width is a mystery the player has to infer across two
        careers, and the coach point that bought it goes uncredited.
      */}
      <div style={{
        marginTop: 12, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
      }}>
        Estimates, not measurements. Your reports run{' '}
        <strong style={{ color: 'var(--ink)' }}>
          {Math.round(reportWidth(recruitingSkill))} points wide
        </strong>{' '}
        at recruiting {recruitingSkill}, and he is somewhere inside them,
        not in the middle. Nothing narrows these but the skill itself.
      </div>
    </>
  );
}

function Stats({ prospect }: { prospect: Prospect }) {
  const line = highSchoolLine(prospect.player);
  return (
    <>
      <div className="label" style={{ marginBottom: 6 }}>LAST SPRING</div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {line.map((row) => (
          <div key={row.label} style={{
            width: '33.33%', padding: '8px 0',
            borderBottom: '1px solid var(--hairline)',
          }}>
            <div className="label">{row.label}</div>
            <div style={{ font: "700 16px/1 var(--display)", marginTop: 3 }}>{row.value}</div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 10, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
      }}>
        High school numbers, against high school pitching. Everybody's look
        absurd; what matters is whose look absurd for the right reasons.
      </div>
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
      <div className="label" style={{ marginBottom: 6 }}>WHO ELSE IS IN</div>
      {rivals.length === 0 && (
        <div style={{ font: "400 12px/1.55 var(--body)", color: 'var(--dim)' }}>
          Nobody has been to see him. That is an opportunity or a warning, and the
          only way to find out is to spend on him.
        </div>
      )}
      {rivals.map((r) => {
        const t = season.teams[r.team];
        const mine = r.team === userTeam;
        return (
          <div key={r.team} style={{ padding: '7px 0' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span style={{
                font: `${mine ? 700 : 400} 12.5px var(--body)`,
                color: mine ? 'var(--clay)' : 'var(--ink)',
              }}>{t?.def.school ?? '?'}{mine ? ' (you)' : ''}</span>
              <span style={{ font: "600 10px var(--mono)", color: 'var(--dim)' }}>
                {Math.round(r.pts)}
              </span>
            </div>
            <div style={{ height: 5, background: 'rgba(28,36,48,.09)', marginTop: 3 }}>
              <div style={{
                width: `${(r.pts / best) * 100}%`, height: '100%',
                background: mine ? 'var(--clay)' : 'rgba(28,36,48,.35)',
              }} />
            </div>
          </div>
        );
      })}
    </>
  );
}

function Tile({ k, v, accent, last }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '9px 8px',
      borderRight: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <div className="label">{k}</div>
      <div style={{
        font: "700 17px/1 var(--display)", marginTop: 3,
        color: accent ? 'var(--clay)' : 'var(--ink)',
      }}>{v}</div>
    </div>
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
      <div style={{ font: "700 20px/1 var(--display)", marginTop: 3 }}>{v}</div>
    </div>
  );
}
