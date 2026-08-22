// Program.tsx
// Where you stand: the school, the board, and your own seat.
//
// The three numbers are shown apart on purpose. Program prestige is the school's
// and survives you; coach prestige is yours and travels; job security is how the
// board feels this minute. Blending them into one "reputation" bar would hide
// the only interesting case — a good coach doing well at a bad job.

import { useDynasty, useUserTeam, useConferenceTable } from '../../state/store.js';
import {
  expectationFor, prestigeStars, rosterStrength, objectiveMet, type Objective,
} from '../../engine/program.js';
import { seasonLength, regularRecord, seasonComplete } from '../../engine/season.js';

export function Program() {
  const season = useDynasty((s) => s.season);
  const coach = useDynasty((s) => s.coach);
  const review = useDynasty((s) => s.lastReview);
  const offers = useDynasty((s) => s.offers);
  const acceptOffer = useDynasty((s) => s.acceptOffer);
  const clearReview = useDynasty((s) => s.clearReview);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const table = useConferenceTable();
  const post = useDynasty((s) => s.lastPostseason);
  void version;

  if (!season || !team) return null;

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
   */
  const settledFor = (key: string): boolean =>
    key === 'tournament' || key === 'omaha' || key === 'conferenceTitle'
      ? post !== null
      : done;

  return (
    <div style={{ padding: '12px 14px 16px' }}>
      {/* The board meeting takes precedence over everything else on this screen. */}
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

      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
        <div className="label">{team.conference} · {year}</div>
        <div style={{
          font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
        }}>{team.def.school}</div>
      </div>

      <div style={{
        display: 'flex', marginTop: 12,
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

      <div style={{ marginTop: 16 }}>
        <div className="label" style={{ marginBottom: 5 }}>CAREER</div>
        <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
          <Row k="RECORD" v={`${coach.careerWins}-${coach.careerLosses}`} />
          <Row k="TOURNAMENT BIDS" v={String(coach.tournaments)} />
          <Row k="CONFERENCE TITLES" v={String(coach.conferenceTitles)} />
          <Row k="NATIONAL TITLES" v={String(coach.titles)} last />
        </div>
      </div>
    </div>
  );
}

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

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '8px 12px',
      borderBottom: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <span className="label">{k}</span>
      <span style={{ font: "600 14px var(--mono)" }}>{v}</span>
    </div>
  );
}
