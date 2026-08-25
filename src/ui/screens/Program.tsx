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
import { useDynasty, useUserTeam, useConferenceTable } from '../../state/store.js';
import {
  expectationFor, prestigeStars, rosterStrength, objectiveMet, coachStanding,
  SKILLS, SKILL_LABEL, type Objective,
} from '../../engine/program.js';
import {
  careerName, seasonLength, regularRecord, seasonComplete,
  type CareerYear, type SeasonState,
} from '../../engine/season.js';
import { honoursByPlayer, type Inductee } from '../../engine/hall.js';
import { RECORDS, type RecordKey } from '../../engine/records.js';
import { philosophyOf } from '../../engine/strategy.js';
import { REGION_OF_STATE } from '../../data/schools.js';
import { playerId, type PlayerId } from '../../engine/types.js';
import { CoachPortrait } from '../CoachPortrait.js';
import { teamColour } from '../Avatar.js';
import { FixedHeader } from '../Sticky.js';
import { pct } from '../format.js';

/** The record for one program, as the season carries it. */
type Owner = SeasonState['teams'][number];

type Sheet = 'board' | 'coach' | 'hall';

const SHEETS: Sheet[] = ['board', 'coach', 'hall'];

const SHEET_LABEL: Record<Sheet, string> = {
  board: 'BOARD',
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
  const [sheet, setSheet] = useState<Sheet>('board');
  void version;

  if (!season || !team) return null;

  /*
    The school stays in the pinned header rather than riding one of the tabs.

    Every tab here is about the same job at the same place — even the hall, which
    is the men who played for you at it — so the name of the school is the one
    line that is true on all three, and a title that scrolled away would leave
    the coach's page looking like it belonged to nobody in particular.
  */
  return (
    <FixedHeader header={
      <>
        <div style={{ padding: '12px 14px 0' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">{team.conference} · {year}</div>
            <div style={{
              font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
            }}>{team.def.school}</div>
          </div>
        </div>
        <TabStrip
          at={sheet}
          onGo={setSheet}
          // The board is talking to you and you are one tab away from hearing
          // it. A review sitting unread behind an inactive tab is the whole
          // reason this screen used to open on the meeting.
          waiting={review !== null || offers.length > 0}
        />
      </>
    }>
      <div style={{ padding: '12px 14px 20px' }}>
        {sheet === 'board' && <BoardSheet team={team} />}
        {sheet === 'coach' && <CoachSheet team={team} />}
        {sheet === 'hall' && <HallSheet />}
      </div>
    </FixedHeader>
  );
}

/** The tabs, in the same clothes the player card and the recruiting sheet wear. */
function TabStrip(
  { at, onGo, waiting }:
  { at: Sheet; onGo: (s: Sheet) => void; waiting: boolean },
) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '10px 14px' }}>
      {SHEETS.map((s) => (
        <button
          key={s}
          onClick={() => onGo(s)}
          style={{
            flex: 1, padding: '8px 0',
            background: s === at ? 'var(--ink)' : 'var(--field)',
            border: s === at ? '1px solid var(--ink)' : '1px solid var(--faint)',
            color: s === at ? 'var(--cream)' : 'var(--dim)',
            font: "700 8.5px var(--mono)", letterSpacing: '.08em',
          }}
        >
          {SHEET_LABEL[s]}
          {s === 'board' && waiting && s !== at && (
            <span style={{ color: 'var(--clay)' }}> ●</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

function BoardSheet({ team }: { team: Owner }) {
  const season = useDynasty((s) => s.season);
  const coach = useDynasty((s) => s.coach);
  const review = useDynasty((s) => s.lastReview);
  const offers = useDynasty((s) => s.offers);
  const acceptOffer = useDynasty((s) => s.acceptOffer);
  const clearReview = useDynasty((s) => s.clearReview);
  const post = useDynasty((s) => s.lastPostseason);
  const table = useConferenceTable();

  if (!season) return null;

  const roster = rosterStrength(team.team);
  // A full season's length, not games played so far. Scaling by games played
  // meant the board's target crept up all year and was only right in September.
  const expectation = expectationFor(team.prestige, roster, seasonLength(season.config));
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
    madeTournament: finish !== undefined,
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
    key === 'tournament' || key === 'omaha' || key === 'conferenceTitle' || key === 'title'
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
              font: "600 9px var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
            }}>{review.fired ? 'DISMISSED' : 'BOARD REVIEW'}</span>
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{
              font: "800 22px/1 var(--display)", textTransform: 'uppercase',
              color: review.fired ? 'var(--clay)' : 'var(--ink)',
            }}>{verdictWord(review.verdict)}</div>
            <div style={{
              marginTop: 7, font: "400 12px/1.55 var(--body)",
            }}>{review.message}</div>
            <div style={{
              marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap',
            }}>
              <Delta k="PROGRAM" from={review.prestigeBefore} to={review.prestigeAfter} />
              <Delta k="YOUR STANDING" from={review.coachPrestigeBefore} to={review.coachPrestigeAfter} />
              <Delta k="SECURITY" from={review.securityBefore} to={review.securityAfter} />
            </div>
            {!review.fired && (
              <div style={{
                marginTop: 9, font: "400 11.5px/1.45 var(--body)", color: 'var(--dim)',
              }}>
                {review.extended
                  ? 'A new deal on the table.'
                  : `${review.contractYears} year${review.contractYears === 1 ? '' : 's'} left on your contract.`}
              </div>
            )}
            {!review.fired && (
              <button
                onClick={clearReview}
                style={{
                  marginTop: 12, padding: '8px 14px', background: 'var(--field)',
                  border: '1px solid rgba(28,36,48,.42)',
                  font: "700 9.5px var(--mono)", letterSpacing: '.1em',
                }}
              >UNDERSTOOD</button>
            )}
          </div>
        </div>
      )}

      {offers.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="label" style={{ marginBottom: 6 }}>WHO IS CALLING</div>
          {offers.map((o) => (
            <button
              key={o.team}
              onClick={() => void acceptOffer(o.team)}
              style={{
                width: '100%', textAlign: 'left', marginBottom: 6, padding: '10px 12px',
                background: 'var(--paper)', border: '1px solid rgba(28,36,48,.42)',
                boxShadow: '0 1px 0 rgba(28,36,48,.16)',
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              }}>
                <span style={{ font: "700 15px var(--display)", textTransform: 'uppercase' }}>
                  {o.school}
                </span>
                <span style={{ font: "600 10px var(--mono)", color: 'var(--clay)' }}>
                  {'★'.repeat(prestigeStars(o.prestige))}
                </span>
              </div>
              <div style={{
                marginTop: 3, font: "400 11px/1.4 var(--body)", color: 'var(--dim)',
              }}>{o.conference} · {o.pitch}</div>
            </button>
          ))}
        </div>
      )}

      <div style={{
        display: 'flex',
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="PRESTIGE" v={'★'.repeat(stars) + '☆'.repeat(5 - stars)} accent />
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
          <div style={{ font: "400 13px/1.5 var(--body)" }}>{expectation.summary}</div>

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
            font: "400 11.5px/1.45 var(--body)", color: 'var(--dim)',
          }}>
            Year {coach.tenure + 1} at the job.{' '}
            {coach.contractYears > 0
              ? `${coach.contractYears} season${coach.contractYears === 1 ? '' : 's'} left on your deal.`
              : 'You are coaching out the final year of your contract.'}
          </div>
          <Seat security={coach.security} />
        </div>
      </div>
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
function CoachSheet({ team }: { team: Owner }) {
  const coach = useDynasty((s) => s.coach);
  const history = useDynasty((s) => s.history);
  const version = useDynasty((s) => s.version);
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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
      }}>
        <Flank k="CAREER" v={String(careerSeasons)} align="right" />
        <CoachPortrait look={coach.look} size={76} />
        <Flank k="AT SCHOOL" v={String(coach.tenure)} align="left" />
      </div>

      <div style={{
        marginTop: 6, textAlign: 'center',
        font: "800 26px/0.95 var(--display)", textTransform: 'uppercase',
      }}>{coach.name}</div>

      {/*
        What the sport calls him, rather than how long he has been at it.

        This line used to read "seasons completed", which the two counters
        either side of the portrait already say — so it spent the most legible
        row on the page repeating the numbers directly above it. The standing is
        earned from titles and deep runs, so it is the one thing here the
        counters cannot tell you.
      */}
      <div className="label" style={{ marginTop: 4, textAlign: 'center' }}>
        HEAD COACH · {standing.title.toUpperCase()}
        {standing.lifer ? ' · LIFER' : ''}
      </div>

      <div style={{
        marginTop: 3, marginBottom: 12, textAlign: 'center',
        font: "600 10px var(--mono)", letterSpacing: '.1em',
        color: teamColour(team.def.abbr),
      }}>{team.def.school.toUpperCase()} · {team.conference}</div>

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
          k="YOUR STANDING"
          v={String(coach.prestige)}
          value={coach.prestige}
          note="What the rest of the country thinks of you. It decides whose call you get."
          last
        />
      </Panel>

      <div style={{ marginTop: 14 }}>
        <Head>THE RECORD</Head>
        <Panel>
          <Stat k="RECORD" v={`${coach.careerWins}-${coach.careerLosses}`} />
          <Stat k="WIN PCT" v={games > 0 ? pct(coach.careerWins / games) : '—'} />
          <Stat k="TOURNAMENT BIDS" v={String(coach.tournaments)} />
          <Stat k="CONFERENCE TITLES" v={String(coach.conferenceTitles)} />
          {/* One row per thing there is to win, in the order the pyramid is
              climbed. The regional row is what B6 added; the trip to Omaha
              beside it is the same event under the name the player knows it by,
              which is exactly why they print the same number. */}
          <Stat k="REGIONAL TITLES" v={String(coach.regionalTitles)} />
          <Stat k="TRIPS TO OMAHA" v={String(omaha)} />
          <Stat k="NATIONAL TITLES" v={String(coach.titles)} last />
        </Panel>
      </div>

      {/*
        The cabinet.

        Only what he has actually done, and deliberately no greyed-out rows for
        the rest. An achievement is one-time and permanent, so a list of the ten
        with eight crossed off is a checklist, and a checklist on this page would
        be a set of instructions about how to play a game that is supposed to be
        about running a program. What is unearned is simply absent.
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
                      font: "800 14px/1.1 var(--display)", textTransform: 'uppercase',
                    }}>{ACHIEVEMENTS[id].name}</span>
                    <span style={{
                      font: "600 10px var(--mono)", color: 'var(--clay)', whiteSpace: 'nowrap',
                    }}>{row?.team} {row?.year}</span>
                  </div>
                  <div style={{
                    marginTop: 3, font: "400 11.5px/1.45 var(--body)", color: 'var(--dim)',
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

      <div style={{ marginTop: 14 }}>
        <Head>STRATEGY</Head>
        {/*
          The name and the sentence both come out of the engine. They are printed
          on the creation step as well, and one copy of a sentence in two screens
          is two sentences that eventually say different things.
        */}
        <Panel>
          <div style={{ padding: '11px 12px' }}>
            <div style={{
              font: "800 20px/1 var(--display)", textTransform: 'uppercase',
            }}>{philosophy.name}</div>
            <div style={{
              marginTop: 6, font: "400 12px/1.5 var(--body)",
            }}>{philosophy.blurb}</div>
          </div>
        </Panel>
        <Note>
          What he carries between programs. It sets five controls the first day he
          arrives, and every one of them is yours to change on the strategy screen.
        </Note>
      </div>

      <div style={{ marginTop: 14 }}>
        <Head>RATINGS</Head>
        <div style={{
          marginTop: 8, padding: '12px 12px 4px',
          border: '1px solid var(--faint)', background: 'var(--paper)',
        }}>
          {SKILLS.map((k) => (
            <Bar key={k} label={SKILL_LABEL[k]} value={coach.skills[k]} />
          ))}
        </div>
        {coach.skillPoints > 0 && (
          <Note>
            <span style={{ color: 'var(--clay)' }}>
              {coach.skillPoints} point{coach.skillPoints === 1 ? '' : 's'} unspent.
            </span>{' '}
            They are spent on the coach step of the offseason.
          </Note>
        )}
      </div>
    </>
  );
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
      <Head>THE HALL</Head>
      {inducted.length === 0
        ? (
          <Panel>
            <Empty>
              Empty. The hall meets every June, once the draft has settled, and it
              only ever looks at men whose careers are finished — so nobody can go
              in until he has left. It wants a career rather than an afternoon:
              two seasons at the very least, and sustained production across them
              weighed against the best two years of it. One enormous game does not
              count for anything here.
            </Empty>
          </Panel>
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

      {/* Named apart from the plaques above, or the first table reads as the
          rest of the hall. Two different questions, one screen. */}
      <div style={{ marginTop: 18 }}>
        <div style={{
          font: "400 11px/1.5 var(--body)", color: 'var(--dim)', marginBottom: 8,
        }}>
          <strong style={{ color: 'var(--ink)' }}>Career leaders.</strong> Who
          accumulated the most, which is not the same question as who was great —
          four years of turning up will out-hit two years of being the best player
          in the country.
        </div>
        <Head>BATTING · BY CAREER HITS</Head>
      </div>
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

      <Note>
        Your own men, and only yours — at this program and any other you have
        coached. Season by season lines are kept for your rosters alone, because
        keeping them for all ninety six programs would put tens of thousands of
        rows through every save. The country's <em>career</em> records are in the
        record book, which manages it on a running total instead.
      </Note>
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
        background: 'rgba(168,68,42,.07)',
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
        <span style={{ font: "400 9px var(--mono)", color: 'var(--dim)' }}>
          {span} · {man.teams.join(' · ')}
        </span>
      </div>
      <div style={{
        font: "800 19px/1.05 var(--display)", textTransform: 'uppercase', marginTop: 3,
      }}>{man.name}</div>
      <div style={{ marginTop: 3, font: "500 11px var(--mono)", color: 'var(--ink)' }}>
        {man.line}
      </div>
      {honours.length > 0 && (
        <div style={{
          marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: '2px 8px',
        }}>
          {honours.map((t) => (
            <span key={t} style={{
              font: "600 8px var(--mono)", letterSpacing: '.08em', color: 'var(--clay)',
            }}>{t.toUpperCase()}</span>
          ))}
        </div>
      )}
      {marks.length > 0 && (
        <div style={{
          marginTop: 5, paddingTop: 5, borderTop: '1px solid var(--hairline)',
          font: "400 9.5px/1.5 var(--mono)", color: 'var(--dim)',
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
        background: row.honours.length > 0 ? 'rgba(168,68,42,.05)' : 'transparent',
      }}
    >
      <span style={{
        font: "400 12px var(--body)",
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        borderBottom: '1px dotted rgba(28,36,48,.35)',
      }}>{row.name}</span>
      {values.map((v, i) => (
        <span key={i} style={{ font: "500 11px var(--mono)", textAlign: 'right' }}>{v}</span>
      ))}
      <span style={{
        gridColumn: '1 / -1', marginTop: 2,
        font: "400 9px var(--mono)", color: 'var(--dim)',
      }}>{span} · {row.teams.join(' · ')}</span>
      {row.honours.length > 0 && (
        <span style={{
          gridColumn: '1 / -1', marginTop: 2,
          display: 'flex', flexWrap: 'wrap', gap: '2px 8px',
        }}>
          {row.honours.slice(0, 3).map((t) => (
            <span key={t} style={{
              font: "600 8px var(--mono)", letterSpacing: '.08em', color: 'var(--clay)',
            }}>{t.toUpperCase()}</span>
          ))}
          {row.honours.length > 3 && (
            <span style={{
              font: "600 8px var(--mono)", letterSpacing: '.08em', color: 'var(--dim)',
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
  const tone = met ? 'var(--win)' : settled ? 'var(--clay)' : 'rgba(28,36,48,.34)';

  // Only the counting objectives can show progress; the rest are yes or no.
  const counts = objective.key === 'wins' || objective.key === 'stretchWins';
  const progress = counts && !met ? `${wins} / ${objective.target}` : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0',
    }}>
      <span style={{ font: "700 11px var(--mono)", color: tone, width: 12 }}>{mark}</span>
      <span style={{
        flex: 1, font: `${met ? 600 : 400} 12px/1.4 var(--body)`,
        color: open ? 'var(--ink)' : met ? 'var(--ink)' : 'var(--dim)',
      }}>
        {objective.label}
        {!objective.required && (
          <span style={{
            marginLeft: 6, font: "600 8px var(--mono)", letterSpacing: '.1em',
            color: 'var(--dim)',
          }}>BONUS</span>
        )}
      </span>
      {progress && (
        <span style={{ font: "600 10px var(--mono)", color: 'var(--dim)' }}>{progress}</span>
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
          font: "700 10px var(--mono)", letterSpacing: '.1em', color: tone,
        }}>{label}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(28,36,48,.09)' }}>
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
      <div style={{ font: "600 13px var(--mono)", marginTop: 2 }}>
        {from} <span style={{
          color: flat ? 'var(--dim)' : up ? 'var(--win)' : 'var(--clay)',
        }}>{flat ? '→' : up ? '↑' : '↓'} {to}</span>
      </div>
    </div>
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
        font: "700 20px/1 var(--display)", marginTop: 3,
        color: accent ? 'var(--clay)' : 'var(--ink)',
      }}>{v}</div>
    </div>
  );
}

/** One of the two counters either side of the face. */
function Flank({ k, v, align }: { k: string; v: string; align: 'left' | 'right' }) {
  return (
    <div style={{ minWidth: 56, textAlign: align }}>
      <div className="label">{k}</div>
      <div style={{
        marginTop: 1, font: "800 20px/1 var(--display)", textTransform: 'uppercase',
      }}>{v}</div>
    </div>
  );
}

function Head({ children }: { children: ReactNode }) {
  return (
    <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
      <div className="label">{children}</div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      marginTop: 8, border: '1px solid var(--faint)', background: 'var(--paper)',
    }}>{children}</div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginTop: 8, font: "400 11px/1.5 var(--body)", color: 'var(--dim)' }}>
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: '12px', font: "400 12px/1.5 var(--body)", color: 'var(--dim)' }}>
      {children}
    </div>
  );
}

function Stat({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '8px 12px', gap: 10,
      borderBottom: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <span className="label">{k}</span>
      <span style={{ font: "600 14px var(--mono)", textAlign: 'right' }}>{v}</span>
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
        <span style={{ font: "600 14px var(--mono)" }}>{v}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(28,36,48,.09)', marginTop: 6 }}>
        <div style={{
          width: `${Math.max(2, Math.min(100, value))}%`, height: '100%',
          background: 'var(--clay)', transition: 'width 400ms ease',
        }} />
      </div>
      {note && (
        <div style={{
          marginTop: 6, font: "400 10.5px/1.4 var(--body)", color: 'var(--dim)',
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
        <span style={{ font: "600 11px var(--mono)", color: 'var(--dim)' }}>{value}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(28,36,48,.09)' }}>
        <div style={{
          width: `${Math.max(0, Math.min(100, value))}%`, height: '100%',
          background: value >= 60 ? 'var(--clay)' : 'var(--ink)',
          opacity: value >= 60 ? 1 : 0.55,
        }} />
      </div>
    </div>
  );
}
