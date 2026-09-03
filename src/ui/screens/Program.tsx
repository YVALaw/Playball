// Program.tsx
// Where you stand: the board, the coach, and the men who played for him.
//
// This was one column — the school, the mandate, the checklist, the seat meter
// and a career summary stacked — which is one page answering four different
// questions. On a phone that means the thing you opened the screen for is
// usually two thumb-drags from where it put you. So: three tabs, because there
// are three questions.
//
//   BOARD  what is being asked of you this year, and how safe you are.
//   COACH  who you are, what you have done, and how your teams play.
//   HALL   who you did it with.
//
// There is deliberately no season-by-season tab. That list already exists as
// HISTORY, the screen immediately beside this one in the same nav group, and two
// record books one tap apart is two record books that eventually disagree.
//
// The three numbers on the BOARD tab are shown apart on purpose. Program
// prestige is the school's and survives you; coach prestige is yours and
// travels; job security is how the board feels this minute. Blending them into
// one "reputation" bar would hide the only interesting case — a good coach doing
// well at a bad job.

import { useState, type ReactNode } from 'react';
import { ACHIEVEMENTS, ACHIEVEMENT_IDS } from '../../engine/achievements.js';
import {
  useDynasty, useUserTeam, useConferenceTable, type SeasonRecord,
} from '../../state/store.js';
import {
  expectationFor, prestigeStars, rosterStrength, objectiveMet, coachStanding,
  SKILLS, SKILL_LABEL, type Objective, type CoachState,
} from '../../engine/program.js';
import {
  careerName, seasonLength, regularRecord, seasonComplete,
  type CareerYear, type SeasonState,
} from '../../engine/season.js';
import { honoursByPlayer, type Inductee } from '../../engine/hall.js';
import { RECORDS, type RecordKey } from '../../engine/records.js';
import { philosophyOf } from '../../engine/strategy.js';
import { REGION_OF_STATE, CONFERENCES } from '../../data/schools.js';
import { playerId, type PlayerId } from '../../engine/types.js';
import { CoachPortrait } from '../CoachPortrait.js';
import { useOpenTeam } from './TeamCard.js';
import { teamColour } from '../Avatar.js';
import { Crest } from '../Crest.js';
import { ArrowLeftIcon, ChevronRightIcon, StarIcon } from '@radix-ui/react-icons';
import {
  BudgetBar, FieldNote, Metric, MetricStrip, ModuleIntro, SectionHeading, Segmented,
} from '../components/Kit.js';
import {
  annualBudget, dollars, marketFor, remaining, wageBill,
  FACILITIES, MAX_FACILITY, SCOUT_COST, SEATS, SEAT_LABEL, SEAT_NOTE,
} from '../../engine/economy.js';
import { handles } from '../../state/depth.js';
import { FirstVisit } from '../Tutorial.js';
import { pct } from '../format.js';

/** The record for one program, as the season carries it. */
type Owner = SeasonState['teams'][number];

type Sheet = 'board' | 'money' | 'watchlist' | 'coach' | 'hall';

/**
 * COACH is not on the strip. The portrait in the top bar is the door to the
 * coach now — it is on every screen, so a second door here was a duplicate —
 * and when the sheet does open on 'coach' the whole frame changes shape below.
 */
const SHEETS: Sheet[] = ['board', 'hall'];

const SHEET_LABEL: Record<Sheet, string> = {
  board: 'BOARD',
  money: 'BUDGET',
  watchlist: 'WATCHLIST',
  coach: 'COACH',
  hall: 'HALL OF FAME',
};

export function Program() {
  const season = useDynasty((s) => s.season);
  const review = useDynasty((s) => s.lastReview);
  const offers = useDynasty((s) => s.offers);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  // In the store rather than in a `useState`, because the page is addressed
  // from outside now: an inbox card about the board opens the board, and one
  // about an achievement opens the cabinet. A component that owns its own tab
  // cannot be told which tab to be on.
  const sheet = useDynasty((s) => s.programSheet);
  const watch = useDynasty((s) => s.watch);
  const setSheet = useDynasty((s) => s.setProgramSheet);
  void version;

  if (!season || !team) return null;

  /*
    The coach's page stands alone. Reported from testing: "in the coach
    information should only be coach information" — the school masthead and the
    BOARD and HALL tabs are the program's furniture, and the man's card kept
    wearing them. Opened from the portrait, the sheet now carries a slim kicker
    and nothing else; the program's own frame comes back the moment the sheet
    does not say 'coach'.
  */
  /*
    The way out, which this sheet did not have.

    Reported from play: "the program stopped showing the college overview but
    instead started showing the coach information", and only wiping the save
    fixed it. `programSheet` is store state, so an inbox card that deep-links
    here -- an achievement post does exactly that -- leaves it on 'coach' after
    the overlay is dismissed. The overlay had the navy back bar above it and the
    PROGRAM *tab* has nothing, so the next visit to the tab landed on a page
    with no tabs, no bar and no exit. It was not a rendering fault; it was a
    one-way door.
  */
  if (sheet === 'coach') {
    return (
      <main className="module-workspace">
        {/* The way out, which this sheet did not have.

            Reported from play: "the program stopped showing the college
            overview but instead started showing the coach information", and
            only wiping the save fixed it. `programSheet` is store state, so an
            inbox card that deep-links here leaves it on 'coach' after the
            overlay is dismissed — and the tab has no back bar of its own. It
            was not a rendering fault; it was a one-way door. */}
        {/* No inner back button. Reported: "in the coach profile there are
            two back buttons." The overlay's own bar steps back to the board
            first — the same deference settings pages get — so one control
            does the job the two were splitting. */}
        <CoachSheet team={team} />
      </main>
    );
  }

  /*
    The school stays in the pinned header rather than riding one of the tabs.

    Both tabs here are about the same job at the same place — even the hall,
    which is the men who played for you at it — so the name of the school is
    the one line that is true on both.
  */
  const waiting = review !== null || offers.length > 0;

  return (
    <main className="module-workspace">
      <ModuleIntro
        kicker={`${team.conference} · ${year}`}
        title={team.def.school}
        text="Prestige, the board's expectation, the people shaping the program, and the names that stayed."
      />

      {/* The board is talking to you and you are one tab away from hearing it.
          A review sitting unread behind an inactive tab is the whole reason
          this screen used to open on the meeting. */}
      <Segmented
        label="Program view"
        value={sheet}
        onChange={setSheet}
        options={[
          { value: 'board', label: waiting ? 'Board ·' : 'Board' },
          { value: 'money', label: 'Budget' },
          { value: 'watchlist', label: watch.programs.length > 0 ? `Watch ${watch.programs.length}` : 'Watch' },
          { value: 'hall', label: 'Hall' },
        ]}
      />

      {/* The two headline numbers, in the proposal's own dark score panel. */}
      <section className="program-score">
        <div>
          <small>PRESTIGE</small>
          <strong>{team.prestige}</strong>
          <span>{'★'.repeat(prestigeStars(team.prestige))} PROGRAM</span>
        </div>
        <div>
          <small>THIS YEAR</small>
          <strong>{team.w}-{team.l}</strong>
          <span>{team.cw}-{team.cl} IN CONFERENCE</span>
        </div>
      </section>

      {sheet === 'board' && <BoardSheet team={team} />}
      {sheet === 'money' && <MoneySheet team={team} />}
      {sheet === 'watchlist' && <WatchlistSheet />}
      {sheet === 'hall' && <HallSheet />}
    </main>
  );
}

/** The tabs, in the same clothes the player card and the recruiting sheet wear. */
function TabStrip(
  { at, onGo, waiting }:
  { at: Sheet; onGo: (s: Sheet) => void; waiting: boolean },
) {
  return (
    <Segmented
      label="Program view"
      value={at}
      onChange={onGo}
      options={SHEETS.map((s) => ({
        value: s,
        // The board is talking to you and you are one tab away from hearing it.
        label: `${SHEET_LABEL[s].charAt(0)}${SHEET_LABEL[s].slice(1).toLowerCase()}${s === 'board' && waiting ? ' ·' : ''}`,
      }))}
    />
  );
}

// ---------------------------------------------------------------------------
// The money — stage 11
// ---------------------------------------------------------------------------

/**
 * One annual budget and three claims on it: wages, facilities, the scouting
 * desk. The design sentence the whole stage answers to — every dollar should
 * have at least two things it could have been — is why all three live on one
 * sheet: the argument between them IS the feature.
 */
function MoneySheet({ team }: { team: Owner }) {
  const economy = useDynasty((s) => s.economy);
  const year = useDynasty((s) => s.year);
  const season = useDynasty((s) => s.season);
  const hireAssistant = useDynasty((s) => s.hireAssistant);
  const fireAssistant = useDynasty((s) => s.fireAssistant);
  const upgradeFacilities = useDynasty((s) => s.upgradeFacilities);
  const runsStaff = useDynasty((s) => handles(s.depth, 'assistants'));
  const runsFacilities = useDynasty((s) => handles(s.depth, 'facilities'));

  const budget = annualBudget(team.prestige);
  const wages = wageBill(economy.staff);
  const left = remaining(economy, team.prestige);
  const level = FACILITIES[economy.facilities];
  const next = FACILITIES[economy.facilities + 1];
  const books = Object.values(economy.scouted).length;
  const worldKey = String(season?.seed ?? 0);

  return (
    <>
      <MetricStrip>
        <Metric label="THIS YEAR" value={dollars(budget)} note={`AT ${team.prestige} PRESTIGE`} />
        <Metric label="WAGES" value={dollars(wages)} note="THE STAFF" />
        <Metric label="LEFT" value={dollars(Math.max(0, left))} note="TO SPEND" />
      </MetricStrip>

      <BudgetBar
        label={`THE ${year} LEDGER`}
        value={`${dollars(Math.max(0, left))} left`}
        fraction={Math.min(1, (wages + economy.spent) / Math.max(1, budget))}
      />

      <SectionHeading kicker="THE STAFF" title="Three seats" />
      {!runsStaff && (
        <FieldNote
          title="Your athletic director runs the staff"
          text="Seats are kept filled with the best man the budget carries. Take
            the job back from settings whenever you like."
        />
      )}
      {SEATS.map((seat) => {
        const man = economy.staff[seat];
        return (
          <div key={seat}>
            <div className="flow-section-title" style={{ marginTop: 12 }}>
              <span className="label">{SEAT_LABEL[seat].toUpperCase()}</span>
              <b>{man ? `${dollars(man.wage)} A YEAR` : 'VACANT'}</b>
            </div>
            {man ? (
              <section className="staff-card">
                <div>
                  <strong>{man.name}</strong>
                  <small>age {man.age} · rated {man.rating}</small>
                  <p>{SEAT_NOTE[seat]}</p>
                </div>
                {runsStaff && (
                  <button
                    className="tap"
                    type="button"
                    onClick={() => fireAssistant(seat)}
                  >LET HIM GO</button>
                )}
              </section>
            ) : (
              <section className="job-list">
                {marketFor(worldKey, year, seat).map((m, slot) => (
                  <div key={m.id}>
                    <button type="button" disabled>
                      <span>
                        <strong>{m.name}</strong>
                        <small>age {m.age} · rated {m.rating} · {SEAT_NOTE[seat]}</small>
                      </span>
                      <b>{dollars(m.wage)}</b>
                    </button>
                    <button
                      type="button"
                      disabled={!runsStaff || left < m.wage}
                      onClick={() => hireAssistant(seat, slot)}
                    >{left < m.wage ? 'Too dear' : 'Hire'}</button>
                  </div>
                ))}
              </section>
            )}
          </div>
        );
      })}

      <SectionHeading kicker="FACILITIES" title={level?.label ?? 'Bare ground'} />
      {!runsFacilities && (
        <FieldNote
          title="Your athletic director spends the budget"
          text="The next rung is bought when the money is there."
        />
      )}
      <section className="staff-card">
        <div>
          <strong>Level {economy.facilities} of {MAX_FACILITY}</strong>
          <small>
            {economy.facilities > 0 && level
              ? `Worth ${level.trainBump} points of training, and a better tour.`
              : 'What the school gave you. The recruits notice.'}
          </small>
          <p>
            {next
              ? `Next: ${next.label.toLowerCase()} — ${dollars(next.cost)}, once.
                Development and the recruiting pitch both read it.`
              : 'Nothing left to build. This is the lab everybody tours.'}
          </p>
        </div>
        {next && runsFacilities && (
          <button
            className="tap"
            type="button"
            disabled={left < next.cost}
            onClick={() => upgradeFacilities()}
          >{left < next.cost ? 'Too dear' : `Build · ${dollars(next.cost)}`}</button>
        )}
      </section>

      <SectionHeading kicker="THE SCOUTING DESK" title={books === 0 ? 'No books bought' : `${books} ${books === 1 ? 'book' : 'books'} this year`} />
      <FieldNote
        title={`A report is ${dollars(SCOUT_COST)}`}
        text="Bought from PROGRAM ACTIONS on any college page. One report reads
          the whole roster's tendencies for a stretch of games — a habit no
          budget survives, which is the decision."
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// The watchlist
// ---------------------------------------------------------------------------

/**
 * The programs you follow, put somewhere. TRACK PROGRAM on a college profile
 * files the school here — the mockup's watchlist view, wired to the saved
 * list rather than a session's memory.
 */
function WatchlistSheet() {
  const season = useDynasty((s) => s.season);
  const watch = useDynasty((s) => s.watch);
  const openTeam = useOpenTeam();
  if (!season) return null;

  const rows = watch.programs
    .map((abbr) => season.teams.find((t) => t.def.abbr === abbr))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .sort((a, b) => b.prestige - a.prestige);

  return (
    <>
      <section className="watchlist-summary">
        <small>CAREER WATCHLIST</small>
        <strong>
          {rows.length === 0 ? 'No programs saved yet'
            : rows.length === 1 ? '1 program worth tracking'
              : `${rows.length} programs worth tracking`}
        </strong>
        <p>
          {rows.length > 0
            ? 'Open a program to compare it, read its roster, or follow a possible career path.'
            : 'Use PROGRAM ACTIONS on any college profile to save it here.'}
        </p>
      </section>
      {rows.length === 0 ? (
        <section className="watchlist-empty">
          <StarIcon />
          <strong>The board is clean</strong>
          <p>Watched colleges live here instead of disappearing when a profile closes.</p>
        </section>
      ) : (
        <section className="retention-list">
          {rows.map((t) => (
            <button className="tap" type="button" key={t.def.abbr} onClick={() => openTeam(t.index)}>
              <span className="team-mark small"><Crest abbr={t.def.abbr} size={30} /></span>
              <span>
                <strong>{t.def.school}</strong>
                <small>{t.conference} · {t.w}-{t.l} · {'★'.repeat(prestigeStars(t.prestige))}</small>
              </span>
              <b>{t.prestige}</b>
              <ChevronRightIcon />
            </button>
          ))}
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

function BoardSheet({ team }: { team: Owner }) {
  const season = useDynasty((s) => s.season);
  const openOverlay = useDynasty((s) => s.openOverlay);
  const coach = useDynasty((s) => s.coach);
  const review = useDynasty((s) => s.lastReview);
  const offers = useDynasty((s) => s.offers);
  const clearReview = useDynasty((s) => s.clearReview);
  const post = useDynasty((s) => s.lastPostseason);
  const table = useConferenceTable();
  // Above the early return, where hooks live.
  const storedAsk = useDynasty((s) => s.boardAsk);

  if (!season) return null;

  const roster = rosterStrength(team.team);
  /*
    The stamped ask, not a live recompute — the second half of a fix that came
    in two reports. The first: scaling by games played crept the target up all
    year. The second, a season later: computing from the live roster did the
    same thing more slowly — "it was asking me for 18 wins, now it is saying
    19" — because men develop. The number is set the day the season opens and
    read from the store ever after; the fallback only fires for a save from
    before the stamp existed, and the load path freezes even those.
  */
  const expectation = storedAsk
    ?? expectationFor(team.prestige, roster, seasonLength(season.config));
  const stars = prestigeStars(team.prestige);

  // What the board can see right now. Placement is only real once the games are
  // played, so mid-season the checklist shows those boxes as still open rather
  // than pretending to know.
  const done = seasonComplete(season);
  const played = regularRecord(team);
  const rank = table.findIndex((t: { index: number }) => t.index === team.index) + 1;
  const finish = post?.finish[team.index];
  const live = {
    wins: played.w, losses: played.l,
    conferenceRank: done ? rank : 0,
    conferenceSize: table.length,
    wonConference: post?.conferenceChampions.includes(team.index) ?? false,
    // The twenty-team national field, when the summary carries it; the finish
    // ladder covers a summary written before the format grew.
    madeTournament: post?.nationalField
      ? post.nationalField.includes(team.index)
      : ['national', 'omaha', 'runner-up', 'champion'].includes(finish ?? ''),
    wonRegional: post?.regionChampions.includes(team.index) ?? false,
    reachedOmaha: ['omaha', 'runner-up', 'champion'].includes(finish ?? ''),
    wonTitle: post?.champion === team.index,
  };

  /**
   * Whether an objective has actually been decided.
   *
   * Reported from testing: "the board marks things with an x when the season
   * hasn't even been finished — I have not started the postseason and it shows
   * that I failed to reach the national tournament". `seasonComplete` means the
   * *schedule* is exhausted, which is the moment the postseason becomes
   * possible, not the moment it is over. A tournament objective is open until
   * the bracket has actually been played.
   *
   * `title` belongs on that list for exactly the same reason and was missing
   * from it: a championship mandate showed "✕ Win the national title" from the
   * moment the regular season ended, which is to say from the moment winning it
   * became possible.
   */
  const settledFor = (key: string): boolean =>
    key === 'tournament' || key === 'omaha' || key === 'conferenceTitle'
      || key === 'regionalTitle' || key === 'title'
      ? post !== null
      : done;

  return (
    <>
      {/* The board meeting takes precedence over everything else on this tab. */}
      {review && (
        <div style={{
          marginBottom: 16,
          border: `1px solid ${review.fired ? 'var(--clay)' : 'var(--faint)'}`,
          background: 'var(--paper)',
        }}>
          <div style={{
            padding: '6px 10px',
            background: review.fired ? 'var(--clay)' : 'var(--ink)',
          }}>
            <span style={{
              font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
            }}>{review.fired ? 'DISMISSED' : 'BOARD REVIEW'}</span>
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{
              font: "800 calc(22px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
              color: review.fired ? 'var(--clay)' : 'var(--ink)',
            }}>{verdictWord(review.verdict)}</div>
            <div style={{
              marginTop: 7, font: "400 calc(12px * var(--ts))/1.55 var(--body)",
            }}>{review.message}</div>
            <div style={{
              marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap',
            }}>
              <Delta k="PROGRAM PRESTIGE" from={review.prestigeBefore} to={review.prestigeAfter} />
              <Delta k="COACH PRESTIGE" from={review.coachPrestigeBefore} to={review.coachPrestigeAfter} />
              <Delta k="SECURITY" from={review.securityBefore} to={review.securityAfter} />
            </div>
            {!review.fired && (
              <div style={{
                marginTop: 9, font: "400 calc(11.5px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
              }}>
                {review.extended
                  ? `Extended — ${review.contractYears} year${review.contractYears === 1 ? '' : 's'} on the new deal.`
                  : `${review.contractYears} year${review.contractYears === 1 ? '' : 's'} left on your contract.`}
              </div>
            )}
            {!review.fired && (
              <button
                onClick={clearReview}
                style={{
                  marginTop: 12, padding: '8px 14px', background: 'var(--field)',
                  border: '1px solid rgba(var(--ink-rgb), .42)',
                  font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.1em',
                }}
              >GOT IT</button>
            )}
          </div>
        </div>
      )}

      {/* One card, not the list. The offers live on the job market screen
          now, where signing is a two-press act — a row here whose tap WAS the
          acceptance cost somebody a job once. */}
      {offers.length > 0 && (
        <section className="decision-stack" style={{ marginBottom: 14 }}>
          <button type="button" onClick={() => openOverlay('jobs')}>
            <span className="decision-mark">{String(offers.length).padStart(2, '0')}</span>
            <span>
              <strong>
                {offers.length === 1
                  ? 'A program wants to talk'
                  : `${offers.length} programs want to talk`}
              </strong>
              <small>Open the job market to read the offers before anything is signed.</small>
            </span>
            <ChevronRightIcon />
          </button>
        </section>
      )}

      <div className="program-tiles">
        <Tile k="PROGRAM PRESTIGE" v={'★'.repeat(stars) + '☆'.repeat(5 - stars)} accent />
        <Tile k="ROSTER OVR" v={String(roster)} />
        <Tile k="CONTRACT" v={`${coach.contractYears}y`} accent={coach.contractYears <= 1} last />
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="label" style={{ marginBottom: 5 }}>
          THE MANDATE · {expectation.mandate.toUpperCase()}
        </div>
        <div style={{
          padding: '11px 12px', border: '1px solid var(--faint)', background: 'var(--paper)',
        }}>
          <div style={{ font: "400 calc(13px * var(--ts))/1.5 var(--body)" }}>{expectation.summary}</div>

          {/*
            The list, not a sentence. A mandate you can only read is atmosphere —
            you nod at it and forget it. A list you can check against tells you at
            any point in the season exactly which boxes are still open, and at the
            end it is the same list the board grades you on.
          */}
          <div style={{ marginTop: 10 }}>
            {expectation.objectives.map((o) => (
              <Box key={o.key} objective={o} met={objectiveMet(o, live)}
                settled={settledFor(o.key)} wins={played.w} />
            ))}
          </div>

          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--hairline)',
            font: "400 calc(11.5px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
          }}>
            Year {coach.tenure + 1} at the job.{' '}
            {coach.contractYears > 0
              ? `${coach.contractYears} season${coach.contractYears === 1 ? '' : 's'} left on your deal.`
              : 'You are coaching out the final year of your contract.'}
          </div>
          <Seat security={coach.security} />
        </div>
      </div>
      <FirstVisit id="program" />
    </>
  );
}

// ---------------------------------------------------------------------------
// The coach
// ---------------------------------------------------------------------------

/**
 * The man, not the job.
 *
 * The portrait sits in the panel rather than in the pinned header on purpose: it
 * is the thing you look at once on arrival and never again, so it should be the
 * first thing to scroll away. What stays pinned is the school and the tabs,
 * which is what you actually navigate by.
 */
/** The four rooms of the profile. The hero above them never changes. */
type CoachView = 'overview' | 'skills' | 'career' | 'trophies';

/** What each skill buys, in the same words the coach step uses. */
const SKILL_NOTE: Record<string, string> = {
  offense: 'Your hitters take slightly better at-bats, every game.',
  defense: 'Balls in play against you become outs a little more often.',
  training: 'Your returning players develop further between seasons.',
  recruiting: 'Every hour on a recruit counts for more, and your scouting reports run tighter.',
};

function CoachSheet({ team }: { team: Owner }) {
  const coach = useDynasty((s) => s.coach);
  const history = useDynasty((s) => s.history);
  const version = useDynasty((s) => s.version);
  const [view, setView] = useState<CoachView>('overview');
  void version;

  const philosophy = philosophyOf(coach.philosophy);
  const standing = coachStanding(coach);
  const region = REGION_OF_STATE[coach.homeState];
  const games = coach.careerWins + coach.careerLosses;

  /*
    Two clocks that tick a moment apart. The coach's own counters move at the
    board review; the record book is written at the roll into next year. In the
    offseason between them a raw `history.length` can read as fewer seasons than
    the coach has spent at this one job, which is nonsense on its face — so the
    career figure is never allowed below tenure.
  */
  const careerSeasons = Math.max(history.length, coach.tenure);

  /*
    Deep runs used to have no counter on the coach, so this was derived from the
    history array — which was the honest thing to do with the fields that
    existed and disagreed with the record book by construction, since the book
    had no regional row to disagree *with*.

    `regionalTitles` is that counter (B6). Winning your region and reaching
    Omaha are the same event in this format, so one number answers both and the
    coach page, the record book and the season review are now reading the same
    field rather than three arithmetics that happen to agree today.
  */
  const omaha = coach.regionalTitles;
  const cabinet = ACHIEVEMENT_IDS.filter((id) => coach.achievements[id]);

  return (
    <>
      {/*
        The coach's own hero, on the player card's anatomy.

        Reported: "the coach profile still has the old view." It was a portrait
        between two flanking numbers with a centred name under it — the shape the
        player card wore before the port, and the last place in the app still
        wearing it. It is the same hero every man in the game gets now: the face
        on the dark ground, the name across the bottom, and the two numbers that
        are true on every tab boxed in the corner.
      */}
      <section className="player-hero">
        <div className="player-hero-face">
          <CoachPortrait look={coach.look} size={150} />
        </div>
        <div className="hero-wash" />
        <div className="player-identity">
          <small>{team.def.school.toUpperCase()} · {team.conference}</small>
          <h2>{coach.name.split(' ').map((part, i) => <span key={`${part}-${i}`}>{part}</span>)}</h2>
          <p>
            HEAD COACH · {standing.title.toUpperCase()}
            {standing.lifer ? ' · LIFER' : ''}
          </p>
        </div>
        <div className="player-ovr">
          <small>CAREER</small>
          <strong>{careerSeasons}</strong>
        </div>
        <div className="player-ovr player-pot">
          <small>HERE</small>
          <strong>{coach.tenure}</strong>
        </div>
      </section>

      {/* The profile's rooms. The hero above never changes; these decide what
          is under it. Four small rooms beat one long corridor on a phone.

          A fifth room — JOBS, where an established coach browses openings,
          applies and interviews — is deliberately absent until that system is
          real. When it lands, it plugs in here: add 'jobs' to CoachView, an
          option below, and a JobsView beside CareerView reading `jobOffers`
          (engine/program.ts) with an application flow on top. An empty tab
          promising interviews that do not exist would be worse than no tab. */}
      <Segmented
        label="Coach profile section"
        value={view}
        onChange={setView}
        options={(['overview', 'skills', 'career', 'trophies'] as const).map((v) => ({
          value: v,
          label: v.charAt(0).toUpperCase() + v.slice(1),
        }))}
      />

      {view === 'overview' && (
        <>
          <Head>INFORMATION</Head>
          <Panel>
            <Stat k="AGE" v={String(coach.age)} />
            <Stat k="FROM" v={region ? `${coach.homeState} · ${region}` : coach.homeState} />
            <Stat k="CAREER EXPERIENCE" v={seasonWord(careerSeasons)} />
            <Stat k="AT THIS SCHOOL" v={seasonWord(coach.tenure)} />
            <Stat
              k="CONTRACT"
              v={coach.contractYears > 0
                ? `${coach.contractYears} of ${coach.contractLength} years left`
                : 'Final year'}
            />
            <Meter
              k="COACH PRESTIGE"
              v={String(coach.prestige)}
              value={coach.prestige}
              note="What the rest of the country thinks of you. It decides whose call you get. The program's own prestige is a different number, and it stays with the school."
              last
            />
          </Panel>

          <div style={{ marginTop: 14 }}>
            <Head>THE RECORD</Head>
            <Panel>
              <Stat k="CAREER" v={`${coach.careerWins}-${coach.careerLosses}`} />
              <Stat k="WIN PCT" v={games > 0 ? pct(coach.careerWins / games) : '—'} />
              <Stat k="THIS SEASON" v={`${team.w}-${team.l}`} />
              <Stat k="TOURNAMENT BIDS" v={String(coach.tournaments)} />
              <Stat k="CONFERENCE TITLES" v={String(coach.conferenceTitles)} />
              {/* One row per thing there is to win, in the order the pyramid is
                  climbed. The regional row is what B6 added; the trip to Omaha
                  beside it is the same event under the name the player knows it
                  by, which is exactly why they print the same number. */}
              <Stat k="REGIONAL TITLES" v={String(coach.regionalTitles)} />
              <Stat k="TRIPS TO OMAHA" v={String(omaha)} />
              <Stat k="NATIONAL TITLES" v={String(coach.titles)} last />
            </Panel>
          </div>

          <div style={{ marginTop: 14 }}>
            <Head>STRATEGY</Head>
            {/*
              The name and the sentence both come out of the engine. They are
              printed on the creation step as well, and one copy of a sentence in
              two screens is two sentences that eventually say different things.
            */}
            <Panel>
              <div style={{ padding: '11px 12px' }}>
                <div style={{
                  font: "800 calc(20px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
                }}>{philosophy.name}</div>
                <div style={{
                  marginTop: 6, font: "400 calc(12px * var(--ts))/1.5 var(--body)",
                }}>{philosophy.blurb}</div>
              </div>
            </Panel>
            <Note>
              What he carries between programs. It sets five controls the first day he
              arrives, and every one of them is yours to change on the strategy screen.
            </Note>
          </div>
        </>
      )}

      {view === 'skills' && (
        <>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <Head>FOUR SKILLS</Head>
            {coach.skillPoints > 0 && (
              <span style={{
                font: "700 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.1em', color: 'var(--clay)',
              }}>{coach.skillPoints} POINT{coach.skillPoints === 1 ? '' : 'S'} UNSPENT</span>
            )}
          </div>
          {/* Values and what each one buys. The +1 controls live on the coach
              step of the offseason — the one moment spending is valid — so this
              page reports rather than pretending to a button that would refuse. */}
          {SKILLS.map((k) => (
            <div key={k} style={{
              marginTop: 8, padding: '11px 12px 6px',
              border: '1px solid var(--faint)', background: 'var(--paper)',
            }}>
              <Bar label={SKILL_LABEL[k]} value={coach.skills[k]} />
              <div style={{
                margin: '2px 0 6px', font: "400 calc(11.5px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
              }}>{SKILL_NOTE[k]}</div>
            </div>
          ))}
          <Note>
            {coach.skillPoints > 0
              ? 'Points are spent on the coach step of the offseason, where they can still be taken back before the step closes.'
              : 'Points arrive at the board meeting each June, three for a season and more for silverware, and are spent on the coach step.'}
          </Note>
        </>
      )}

      {view === 'career' && <CareerView history={history} coach={coach} />}

      {view === 'trophies' && (
        <>
          <Head>TROPHY CASE</Head>
          {/* The three shelves always hang, zeros included. A banner reading 0
              says what there is to win here; a paragraph saying the case was
              empty said the same thing in more room and less baseball. */}
          {(() => {
            const titles = history.filter((r) => r.finish === 'champion');
            const omahaYears = history.filter((r) =>
              r.finish === 'omaha' || r.finish === 'runner-up' || r.finish === 'champion');
            const confYears = history.filter((r) => r.wonConference);
            const shelves = [
              { k: 'NATIONAL TITLES', n: coach.titles, years: titles, tone: 'var(--clay)' },
              { k: 'TRIPS TO OMAHA', n: omaha, years: omahaYears, tone: 'var(--navy)' },
              { k: 'CONFERENCE TITLES', n: coach.conferenceTitles, years: confYears, tone: 'var(--win)' },
            ];
            return (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {shelves.map((s) => (
                  <div key={s.k} style={{
                    flex: 1, padding: '10px 8px 12px', textAlign: 'center',
                    background: 'var(--paper)', border: '1px solid var(--faint)',
                    borderTop: `3px solid ${s.tone}`,
                  }}>
                    <div className="label">{s.k}</div>
                    <div style={{
                      marginTop: 4, font: "800 calc(26px * var(--ts))/1 var(--display)",
                      color: s.n > 0 ? s.tone : 'var(--faint)',
                    }}>{s.n}</div>
                    <div style={{
                      marginTop: 3, font: "400 calc(8.5px * var(--ts)) var(--mono)", color: 'var(--dim)',
                    }}>
                      {s.years.slice(0, 3).map((r) => r.year).join(' · ') || '—'}
                      {s.years.length > 3 ? ' …' : ''}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/*
            The cabinet.

            Only what he has actually done, and deliberately no greyed-out rows
            for the rest. An achievement is one-time and permanent, so a list of
            the ten with eight crossed off is a checklist, and a checklist on
            this page would be a set of instructions about how to play a game
            that is supposed to be about running a program. What is unearned is
            simply absent.
          */}
          {cabinet.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <Head>ACHIEVEMENTS</Head>
              <Panel>
                {cabinet.map((id, i) => {
                  const row = coach.achievements[id];
                  return (
                    <div
                      key={id}
                      style={{
                        padding: '9px 12px',
                        borderBottom: i === cabinet.length - 1
                          ? 'none' : '1px solid var(--hairline)',
                      }}
                    >
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'baseline', gap: 8,
                      }}>
                        <span style={{
                          font: "800 calc(14px * var(--ts))/1.1 var(--display)", textTransform: 'uppercase',
                        }}>{ACHIEVEMENTS[id].name}</span>
                        <span style={{
                          font: "600 calc(10px * var(--ts)) var(--mono)", color: 'var(--clay)', whiteSpace: 'nowrap',
                        }}>{row?.team} {row?.year}</span>
                      </div>
                      <div style={{
                        marginTop: 3, font: "400 calc(11.5px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
                      }}>{row?.detail ?? ACHIEVEMENTS[id].note}</div>
                    </div>
                  );
                })}
              </Panel>
              <Note>
                Earned once and kept for ever, wherever you coach next. Records are
                the other half of the book, and those exist to be broken.
              </Note>
            </div>
          )}
        </>
      )}
      <FirstVisit id="coach" />
    </>
  );
}

/**
 * The coach's own year-by-year, which is not the school's.
 *
 * His 2029 and his school's 2029 agree only while he was in that chair — the
 * school's version lives on the HISTORY screen and keeps running when he
 * leaves. This one follows the man: every season he has coached, grouped by
 * where he coached it.
 */
function CareerView({ history, coach }: { history: SeasonRecord[]; coach: CoachState }) {
  if (history.length === 0) {
    return (
      <>
        <Head>YEAR BY YEAR</Head>
        <Panel>
          <div style={{
            padding: '16px 12px', textAlign: 'center',
            font: "400 calc(12px * var(--ts))/1.6 var(--body)", color: 'var(--dim)',
          }}>
            No seasons on the record yet. The first one goes in at the June
            board meeting.
          </div>
        </Panel>
      </>
    );
  }

  // Grouped by school, in the order the career visited them.
  const spans: { school: string; rows: SeasonRecord[] }[] = [];
  for (const r of history) {
    const school = r.school ?? 'Unknown';
    const last = spans[spans.length - 1];
    if (last && last.school === school) last.rows.push(r);
    else spans.push({ school, rows: [r] });
  }

  return (
    <>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      }}>
        <Head>YEAR BY YEAR</Head>
        <span style={{ font: "600 calc(9px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
          {coach.careerWins}-{coach.careerLosses} CAREER
        </span>
      </div>
      {spans.map((span, si) => (
        <div key={`${span.school}-${si}`} style={{ marginTop: si === 0 ? 8 : 12 }}>
          <div style={{
            font: "700 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.1em',
            color: teamColour(
              span.rows[0]?.school !== undefined ? abbrOfSchool(span.school) : '',
            ),
            marginBottom: 4,
          }}>{span.school.toUpperCase()} · {seasonWord(span.rows.length)}</div>
          <Panel>
            {span.rows.map((r, i) => (
              <div key={r.year} style={{
                display: 'grid', gridTemplateColumns: '40px 56px 1fr auto',
                gap: 8, alignItems: 'baseline', padding: '8px 12px',
                borderBottom: i === span.rows.length - 1 ? 'none' : '1px solid var(--hairline)',
              }}>
                <span style={{ font: "700 calc(13px * var(--ts)) var(--display)" }}>{r.year}</span>
                <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)" }}>{r.w}-{r.l}</span>
                <span style={{
                  font: "400 calc(11px * var(--ts)) var(--body)", color: 'var(--dim)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{FINISH_WORD[r.finish] ?? r.finish}{r.wonConference ? ' · conference champions' : ''}</span>
                <span style={{
                  font: "700 calc(11px * var(--ts)) var(--mono)",
                  color: r.finish === 'champion' ? 'var(--clay)' : 'transparent',
                }}>◆</span>
              </div>
            ))}
          </Panel>
        </div>
      ))}
      <Note>
        Your career, wherever it was coached. Each school's own history,
        including the years you were somewhere else, is on its HISTORY screen.
      </Note>
    </>
  );
}

const FINISH_WORD: Record<string, string> = {
  missed: 'Missed the tournament',
  regional: 'Regional',
  omaha: 'Omaha',
  'runner-up': 'National runner-up',
  champion: 'NATIONAL CHAMPION',
};

/** Best-effort colour lookup for a school named in an old career row. */
function abbrOfSchool(school: string): string {
  for (const c of CONFERENCES) {
    const hit = c.schools.find((s) => s.school === school);
    if (hit) return hit.abbr;
  }
  return '';
}

const seasonWord = (n: number): string => `${n} season${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------------------
// The hall
// ---------------------------------------------------------------------------

/** One man's whole college career, as the record book has it. */
interface HallRow {
  id: PlayerId;
  name: string;
  first: number;
  last: number;
  /** Every program he played for under you, in the order he played for them. */
  teams: string[];
  pitcher: boolean;
  ab: number; h: number; hr: number; rbi: number;
  w: number; l: number; outs: number; er: number; k: number;
  /** What he won while he was here, without repeats. */
  honours: string[];
}

const sum = (years: CareerYear[], key: keyof CareerYear): number =>
  years.reduce((a, y) => a + ((y[key] as number | undefined) ?? 0), 0);

/**
 * The record book, folded into one row per man.
 *
 * This is the only place a list of men who left four years ago can be printed
 * from: rosters are rewritten every June and the departure notices are kept for
 * one offseason, so nothing else in the save still remembers them. Which is why
 * a career row carries the player's name — see `CareerYear` in engine/season.ts.
 *
 * Rows written before it did are filed under an id that *was* his name, and for
 * those the key is still the answer.
 */
function hallRows(
  careers: Record<PlayerId, CareerYear[]>,
  honours: Map<string, string[]>,
): HallRow[] {
  return Object.entries(careers).map(([id, rawYears]) => {
    const years = [...rawYears].sort((a, b) => a.year - b.year);
    const teams: string[] = [];
    for (const y of years) if (!teams.includes(y.team)) teams.push(y.team);
    return {
      id: playerId(id),
      name: careerName(playerId(id), years),
      first: years[0]?.year ?? 0,
      last: years[years.length - 1]?.year ?? 0,
      teams,
      // Same test the player card uses to decide which career table to draw, so
      // a two-way man lands in the same half of the book on both screens.
      pitcher: years.some((y) => (y.outs ?? 0) > 0) || !years.some((y) => (y.ab ?? 0) > 0),
      ab: sum(years, 'ab'), h: sum(years, 'h'), hr: sum(years, 'hr'), rbi: sum(years, 'rbi'),
      w: sum(years, 'w'), l: sum(years, 'l'), outs: sum(years, 'outs'),
      er: sum(years, 'er'), k: sum(years, 'k'),
      honours: honours.get(id) ?? [],
    };
  });
}

/**
 * The men you put in, and the men who piled up the most. In that order.
 *
 * This tab used to be the second thing alone: two leaderboards of career hits and
 * career strikeouts, computed live and honest about being a leaderboard. B12 is
 * the first thing, and the difference between them is the whole point. A
 * leaderboard is a fact about who is currently top of a column and it changes
 * when somebody passes him. An induction is a verdict, it happens on a date, it
 * is announced, and nothing later takes it away — see `engine/hall.ts` for what
 * it takes and why a plaque is frozen at the moment it is written.
 *
 * The leaderboards stay, underneath, because they answer a different question.
 * Who accumulated the most is worth knowing about a program and it is not the
 * same as who was great: a four year regular will out-hit a two year star every
 * time, and only one of them has a plaque.
 */
function HallSheet() {
  const season = useDynasty((s) => s.season);
  const history = useDynasty((s) => s.history);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const version = useDynasty((s) => s.version);
  void version;

  if (!season) return null;

  const honours = honoursByPlayer(history);
  const rows = hallRows(season.careers ?? {}, honours);
  const inducted = [...(season.hall ?? [])].sort((a, b) => b.year - a.year || b.score - a.score);

  // Twelve is what fits before a leaderboard stops being a leaderboard. The rest
  // are still reachable — every one of these men has a card of his own.
  const bats = rows.filter((r) => !r.pitcher).sort((a, b) => b.h - a.h).slice(0, 12);
  const arms = rows.filter((r) => r.pitcher).sort((a, b) => b.k - a.k).slice(0, 12);

  return (
    <>
      <SectionHeading
        kicker="THE HALL"
        title={inducted.length === 0
          ? 'Nobody in it yet'
          : `${inducted.length} inducted`}
      />
      {/*
        Reported: "the hall in program still has a shit ton of text that eats
        the whole screen." It did — eight lines of rules where a heading should
        have been. The rules have not changed and they are still worth knowing,
        so they are a field note rather than a paragraph: three lines that say
        what the hall wants and when it meets, and the reason the tables under
        it are not the hall.
      */}
      {inducted.length === 0
        ? (
          <FieldNote
            title="It meets in June"
            text="Finished careers only. Nobody goes in until he has left."
          />
        )
        : inducted.map((m) => (
          <Plaque
            key={m.id}
            man={m}
            honours={honours.get(m.id) ?? []}
            marks={marksHeldBy(season, m.id)}
            onOpen={() => openPlayer(m.id)}
          />
        ))}

      {/*
        Named apart from the plaques above, and now separated from them, because
        the two were read as one list. Reported as "the hall of fame inducts
        after one season and inducts nobody remarkable": after one season the
        plaques are empty and these two tables hold two dozen ordinary freshmen,
        under a tab called HALL OF FAME. Nobody was inducted — the ballot is
        right and refuses anybody with one season — but the screen was saying
        otherwise, which comes to the same thing.

        So the section gets a rule of its own and a heading that says what it is
        not. Two different questions, one screen, and the screen has to say which
        is which loudly enough to survive being skimmed.
      */}
      <SectionHeading kicker="CAREER LEADERS · NOT INDUCTIONS" title="Your record men" />
      <Head>BATTING · BY CAREER HITS</Head>
      <Table cols={BAT_COLS} head={['PLAYER', 'H', 'AVG', 'HR']}>
        {bats.length === 0
          ? <Empty>No hitter has finished a season for you yet.</Empty>
          : bats.map((r) => (
            <HallRowView
              key={r.id}
              row={r}
              cols={BAT_COLS}
              values={[
                String(r.h),
                r.ab > 0 ? pct(r.h / r.ab) : '—',
                String(r.hr),
              ]}
              onClick={() => openPlayer(r.id)}
            />
          ))}
      </Table>

      <div style={{ marginTop: 14 }}>
        <Head>PITCHING · BY STRIKEOUTS</Head>
        <Table cols={ARM_COLS} head={['PLAYER', 'K', 'W-L', 'ERA']}>
          {arms.length === 0
            ? <Empty>No pitcher has finished a season for you yet.</Empty>
            : arms.map((r) => (
              <HallRowView
                key={r.id}
                row={r}
                cols={ARM_COLS}
                values={[
                  String(r.k),
                  `${r.w}-${r.l}`,
                  r.outs > 0 ? (r.er * 27 / r.outs).toFixed(2) : '—',
                ]}
                onClick={() => openPlayer(r.id)}
              />
            ))}
        </Table>
      </div>

      <Note>Your own rosters only. The country's records live in the record book.</Note>
    </>
  );
}

/**
 * Every record in the country this man still holds, as the plaque names them.
 *
 * Printed and never scored, and that separation is the point of B12 rather than
 * an implementation detail. The brief was that a man who holds one enormous
 * single-game record and was otherwise ordinary must not get in, so the ballot in
 * `engine/hall.ts` cannot see the book at all. What a hall of famer holds is
 * still worth reading, so it is here — on the plaque, after the fact.
 *
 * Team and coaching rows are skipped: they are not his.
 */
function marksHeldBy(season: SeasonState, id: PlayerId): string[] {
  const out: string[] = [];
  for (const [key, mark] of Object.entries(season.records ?? {})) {
    if (mark.id !== id) continue;
    const spec = RECORDS[key as RecordKey];
    const prefix = spec.group === 'game' ? 'GAME'
      : spec.group === 'season' ? 'SEASON'
      : spec.group === 'career' ? 'CAREER'
      : null;
    if (prefix === null) continue;
    out.push(`${prefix} ${spec.label}`);
  }
  return out;
}

/**
 * One man, in.
 *
 * Drawn in the same clothes the record book gives a mark of yours — a clay rule
 * down the left edge and a warm ground — because it is the same statement in a
 * different place: this one is ours.
 */
function Plaque(
  { man, honours, marks, onOpen }:
  { man: Inductee; honours: string[]; marks: string[]; onOpen: () => void },
) {
  const span = man.first === man.last ? `${man.first}` : `${man.first}–${man.last}`;
  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%', textAlign: 'left', display: 'block',
        marginTop: 8, padding: '10px 12px',
        background: 'rgba(var(--clay-rgb), .07)',
        border: '1px solid var(--faint)', borderLeft: '3px solid var(--clay)',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', gap: 8,
      }}>
        <span className="label" style={{ color: 'var(--clay)' }}>
          INDUCTED {man.year}
        </span>
        <span style={{ font: "400 calc(9px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
          {span} · {man.teams.join(' · ')}
        </span>
      </div>
      <div style={{
        font: "800 calc(19px * var(--ts))/1.05 var(--display)", textTransform: 'uppercase', marginTop: 3,
      }}>{man.name}</div>
      <div style={{ marginTop: 3, font: "500 calc(11px * var(--ts)) var(--mono)", color: 'var(--ink)' }}>
        {man.line}
      </div>
      {honours.length > 0 && (
        <div style={{
          marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: '2px 8px',
        }}>
          {honours.map((t) => (
            <span key={t} style={{
              font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.08em', color: 'var(--clay)',
            }}>{t.toUpperCase()}</span>
          ))}
        </div>
      )}
      {marks.length > 0 && (
        <div style={{
          marginTop: 5, paddingTop: 5, borderTop: '1px solid var(--hairline)',
          font: "400 calc(9.5px * var(--ts))/1.5 var(--mono)", color: 'var(--dim)',
        }}>
          STILL HOLDS · {marks.join(' · ')}
        </div>
      )}
    </button>
  );
}

const BAT_COLS = '1fr 30px 38px 26px';
const ARM_COLS = '1fr 30px 40px 40px';

function Table(
  { cols, head, children }: { cols: string; head: string[]; children: ReactNode },
) {
  return (
    <div style={{
      marginTop: 8, border: '1px solid var(--faint)', background: 'var(--paper)',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: cols, gap: 6,
        padding: '6px 10px', borderBottom: '1px solid var(--hairline)',
      }}>
        {head.map((c, i) => (
          <span key={c} className="label" style={{ textAlign: i === 0 ? 'left' : 'right' }}>
            {c}
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}

function HallRowView(
  { row, cols, values, onClick }:
  { row: HallRow; cols: string; values: string[]; onClick: () => void },
) {
  const span = row.first === row.last ? `${row.first}` : `${row.first}–${row.last}`;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        display: 'grid', gridTemplateColumns: cols, gap: 6, alignItems: 'baseline',
        padding: '8px 10px', borderBottom: '1px solid var(--hairline)',
        background: row.honours.length > 0 ? 'rgba(var(--clay-rgb), .05)' : 'transparent',
      }}
    >
      <span style={{
        font: "400 calc(12px * var(--ts)) var(--body)",
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        borderBottom: '1px dotted rgba(var(--ink-rgb), .35)',
      }}>{row.name}</span>
      {values.map((v, i) => (
        <span key={i} style={{ font: "500 calc(11px * var(--ts)) var(--mono)", textAlign: 'right' }}>{v}</span>
      ))}
      <span style={{
        gridColumn: '1 / -1', marginTop: 2,
        font: "400 calc(9px * var(--ts)) var(--mono)", color: 'var(--dim)',
      }}>{span} · {row.teams.join(' · ')}</span>
      {row.honours.length > 0 && (
        <span style={{
          gridColumn: '1 / -1', marginTop: 2,
          display: 'flex', flexWrap: 'wrap', gap: '2px 8px',
        }}>
          {row.honours.slice(0, 3).map((t) => (
            <span key={t} style={{
              font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.08em', color: 'var(--clay)',
            }}>{t.toUpperCase()}</span>
          ))}
          {row.honours.length > 3 && (
            <span style={{
              font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.08em', color: 'var(--dim)',
            }}>+{row.honours.length - 3}</span>
          )}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const verdictWord = (v: string): string =>
  v === 'exceeded' ? 'Above expectations'
  : v === 'met' ? 'Expectations met'
  : v === 'missed' ? 'Below expectations'
  : 'A bad year';

/**
 * One line of the board's checklist.
 *
 * Three states, not two. A box that has not been decided yet is drawn as open
 * rather than as failed — mid-season a placement objective is genuinely unknown,
 * and showing it with a cross would read as "you have already blown this".
 */
function Box({
  objective, met, settled, wins,
}: { objective: Objective; met: boolean; settled: boolean; wins: number }) {
  const open = !settled && !met;
  const mark = met ? '✓' : settled ? '✕' : '○';
  const tone = met ? 'var(--win)' : settled ? 'var(--clay)' : 'rgba(var(--ink-rgb), .34)';

  // Only the counting objectives can show progress; the rest are yes or no.
  const counts = objective.key === 'wins' || objective.key === 'stretchWins';
  const progress = counts && !met ? `${wins} / ${objective.target}` : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0',
    }}>
      <span style={{ font: "700 calc(11px * var(--ts)) var(--mono)", color: tone, width: 12 }}>{mark}</span>
      <span style={{
        flex: 1, font: `${met ? 600 : 400} calc(12px * var(--ts))/1.4 var(--body)`,
        color: open ? 'var(--ink)' : met ? 'var(--ink)' : 'var(--dim)',
      }}>
        {objective.label}
        {!objective.required && (
          <span style={{
            marginLeft: 6, font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.1em',
            color: 'var(--dim)',
          }}>BONUS</span>
        )}
      </span>
      {progress && (
        <span style={{ font: "600 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>{progress}</span>
      )}
    </div>
  );
}

function Seat({ security }: { security: number }) {
  const label = security >= 70 ? 'SECURE'
    : security >= 45 ? 'STABLE'
    : security >= 25 ? 'WARM'
    : 'HOT SEAT';
  const tone = security >= 45 ? 'var(--ink)' : 'var(--clay)';
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: 4,
      }}>
        <span className="label">YOUR SEAT</span>
        <span style={{
          font: "700 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.1em', color: tone,
        }}>{label}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(var(--ink-rgb), .09)' }}>
        <div style={{
          width: `${Math.max(2, security)}%`, height: '100%', background: tone,
          transition: 'width 400ms ease',
        }} />
      </div>
    </div>
  );
}

function Delta({ k, from, to }: { k: string; from: number; to: number }) {
  const up = to > from;
  const flat = to === from;
  return (
    <div>
      <div className="label">{k}</div>
      <div style={{ font: "600 calc(13px * var(--ts)) var(--mono)", marginTop: 2 }}>
        {from} <span style={{
          color: flat ? 'var(--dim)' : up ? 'var(--win)' : 'var(--clay)',
        }}>{flat ? '→' : up ? '↑' : '↓'} {to}</span>
      </div>
    </div>
  );
}

function Tile({ k, v, accent, last }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  void last;
  return (
    <div className={`program-tile${accent ? ' accent' : ''}`}>
      <div className="label">{k}</div>
      <strong>{v}</strong>
    </div>
  );
}

/** One of the two counters either side of the face. */
function Flank({ k, v, align }: { k: string; v: string; align: 'left' | 'right' }) {
  return (
    <div style={{ minWidth: 56, textAlign: align }}>
      <div className="label">{k}</div>
      <div style={{
        marginTop: 1, font: "800 calc(20px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
      }}>{v}</div>
    </div>
  );
}

function Head({ children }: { children: ReactNode }) {
  return (
    <div className="flow-section-title"><span className="label">{children}</span></div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="program-panel">{children}</div>;
}

function Note({ children }: { children: ReactNode }) {
  return <div className="program-note">{children}</div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="program-empty">{children}</div>;
}

function Stat({ k, v, last }: { k: string; v: string; last?: boolean }) {
  void last;
  return (
    <div className="program-stat">
      <span className="label">{k}</span>
      <b>{v}</b>
    </div>
  );
}

/** A `Stat` that also has to show where the number sits on its scale. */
function Meter(
  { k, v, value, note, last }:
  { k: string; v: string; value: number; note?: string; last?: boolean },
) {
  return (
    <div style={{
      padding: '8px 12px 11px',
      borderBottom: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10,
      }}>
        <span className="label">{k}</span>
        <span style={{ font: "600 calc(14px * var(--ts)) var(--mono)" }}>{v}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(var(--ink-rgb), .09)', marginTop: 6 }}>
        <div style={{
          width: `${Math.max(2, Math.min(100, value))}%`, height: '100%',
          background: 'var(--clay)', transition: 'width 400ms ease',
        }} />
      </div>
      {note && (
        <div style={{
          marginTop: 6, font: "400 calc(10.5px * var(--ts))/1.4 var(--body)", color: 'var(--dim)',
        }}>{note}</div>
      )}
    </div>
  );
}

/** A coach rating, drawn against the full scale the skill screen uses. */
function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: 4,
      }}>
        <span className="label">{label}</span>
        <span style={{ font: "600 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>{value}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(var(--ink-rgb), .09)' }}>
        <div style={{
          width: `${Math.max(0, Math.min(100, value))}%`, height: '100%',
          background: value >= 60 ? 'var(--clay)' : 'var(--ink)',
          opacity: value >= 60 ? 1 : 0.55,
        }} />
      </div>
    </div>
  );
}
