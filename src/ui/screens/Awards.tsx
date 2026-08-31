// Awards.tsx
// End of season honours, plus the All-Conference first team.
//
// These only mean anything once a season is in the books, so the screen says so
// rather than showing a leaderboard of nobody.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import { FirstVisit } from '../Tutorial.js';
import { teamColour } from '../Avatar.js';
import { seasonComplete } from '../../engine/season.js';
import {
  seasonAwards, allConference, coachOfTheYear, type CoachAwardReason,
} from '../../engine/postseason.js';

/**
 * The sentence under the headline stat, one per way of winning it. The stat
 * itself comes from the engine (`award.line`) so every screen tells the same
 * story; this is just the colour around it.
 */
const COACH_BODY: Record<CoachAwardReason, string> = {
  overachieved: 'Nobody got more out of less. The roster said no; the record said yes.',
  giantKiller: 'The trophy went home to a school that had no business holding it.',
  turnaround: 'The biggest one-year climb in the country, same school, same players.',
  wireToWire: 'Won the league and outscored everybody doing it, start to finish.',
};

export function Awards() {
  // Rendered both as a normal screen and as a step of the offseason. The
  // continue only belongs in the second case.
  const phase = useDynasty((s) => s.phase);
  const nextPhase = useDynasty((s) => s.nextPhase);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const lastPostseason = useDynasty((s) => s.lastPostseason);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const coachName = useDynasty((s) => s.coach.name);
  void version;

  if (!season || !team) return null;

  if (!seasonComplete(season)) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center' }}>
        <div className="label">SEASON IN PROGRESS</div>
        <div style={{
          marginTop: 8, font: "400 calc(12px * var(--ts))/1.6 var(--body)", color: 'var(--dim)',
          maxWidth: 250, margin: '8px auto 0',
        }}>
          Awards are handed out when the regular season is over.
        </div>
      </div>
    );
  }

  const awards = seasonAwards(season);
  const first = allConference(season);
  const coach = coachOfTheYear(season, lastPostseason);

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">{year} HONOURS</div>
            <div style={{
              font: "800 calc(21px * var(--ts))/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
            }}>Awards</div>
          </div>
        </div>
      }
      action={phase !== null && (
        <FloatingAction label="SEASON REVIEW" onClick={() => void nextPhase('awards')} />
      )}
    >
    <FirstVisit id="awards" />
    <div style={{ padding: '10px 14px 16px' }}>

      {/*
        Coach of the Year, which is not the most wins — that award always goes
        to whoever was handed the best roster, and it says nothing.

        Four stories can win it: beating what the roster was worth, winning it
        all at a school nobody has heard of, the biggest one-year turnaround, and
        a conference title on the best run margin of anybody who won one. The
        engine picks whichever was loudest this season, measured against what a
        normal year of that story looks like, and writes the headline stat
        itself; the card just renders it.
      */}
      {coach && (
        <div style={{
          marginTop: 12,
          border: `1px solid ${coach.team === team.index ? 'var(--clay)' : 'var(--faint)'}`,
          background: 'var(--paper)',
        }}>
          <div style={{ padding: '6px 10px', background: 'var(--clay)' }}>
            <span style={{
              font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
            }}>COACH OF THE YEAR</span>
          </div>
          <div style={{ padding: '10px 12px 12px' }}>
            <div style={{
              font: "800 calc(20px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
              color: coach.team === team.index ? 'var(--clay)' : 'var(--ink)',
            }}>{coach.team === team.index ? `${coachName} · ${coach.school}` : coach.school}</div>
            <div style={{
              marginTop: 5, font: "400 calc(11.5px * var(--ts)) var(--mono)", color: 'var(--dim)',
            }}>
              {coach.wins}-{coach.losses} · {coach.line}
            </div>
            <div style={{
              marginTop: 7, font: "400 calc(11.5px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
            }}>
              {COACH_BODY[coach.reason]}
            </div>
          </div>
        </div>
      )}

      {awards.map((a) => {
        const tint = teamColour(a.team);
        return (
          <div key={a.title} style={{
            marginTop: 12, border: '1px solid var(--faint)', background: 'var(--paper)',
            borderLeft: `6px solid ${tint}`,
          }}>
            <div style={{ padding: '6px 10px', background: 'var(--clay)' }}>
              <span style={{
                font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
              }}>{a.title.toUpperCase()}</span>
            </div>
            {/* A button only when there is a man to open. The record book
                settled this exact case with a div — "a tap that opens nothing
                is worse than no tap at all" — and a winner with no id was a
                button that silently swallowed the press. */}
            {(() => {
              const body = (
                <>
                  <div style={{
                    font: "800 calc(20px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
                    color: 'var(--ink)',
                  }}>{a.name}</div>
                  <div style={{
                    marginTop: 6, font: "400 calc(11px * var(--ts)) var(--mono)",
                    color: 'rgba(var(--ink-rgb), .68)',
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    <span style={{
                      padding: '3px 7px', background: tint, color: 'var(--cream)',
                      font: "700 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.06em',
                    }}>{a.team}</span>
                    {a.line}
                  </div>
                </>
              );
              // The winner's box washed in his school's colour, the same rule
              // the first team below follows: the box carries the school, the
              // letters stay ink.
              const box = {
                width: '100%', textAlign: 'left' as const,
                padding: '10px 12px 12px', background: `${tint}4d`,
              };
              return a.id
                ? <button onClick={() => openPlayer(a.id!)} style={box}>{body}</button>
                : <div style={box}>{body}</div>;
            })()}
          </div>
        );
      })}

      <div style={{
        marginTop: 22, borderBottom: '2px solid var(--ink)', paddingBottom: 6,
      }}>
        <div className="label">ALL-CONFERENCE FIRST TEAM</div>
      </div>

      <div style={{
        marginTop: 8, border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {/*
          Each row wears its school — the BOX, not the letters. A wash of the
          program's own colour behind the row and a solid stripe down its edge,
          with the name kept in ink so it stays legible over every shade of
          ninety-six school palettes. Reported from testing: "it's not the name
          letters that should be colored, it's the box they are in."
        */}
        {first.map((p, i) => {
          const ours = p.team === team.def.abbr;
          const tint = teamColour(p.team);
          return (
            <button
              key={`${p.position}-${p.id}-${i}`}
              onClick={() => openPlayer(p.id)}
              style={{
                width: '100%', textAlign: 'left',
                display: 'grid', gridTemplateColumns: '26px 1fr auto',
                gap: 8, alignItems: 'center',
                padding: '8px 10px', borderBottom: '1px solid var(--hairline)',
                // A wide solid edge and a real wash. The first version ran the
                // colour at 14% and it was invisible at arm's length; this is
                // 30%, which is as far as it can go with ink on top of it.
                borderLeft: `6px solid ${tint}`,
                background: `${tint}4d`,
              }}>
              <span style={{
                font: "700 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.08em',
                color: 'rgba(var(--ink-rgb), .62)',
              }}>{p.position}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  font: `${ours ? 800 : 700} calc(13px * var(--ts)) var(--body)`, color: 'var(--ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.name}</div>
                <div style={{
                  font: "400 calc(10px * var(--ts)) var(--mono)", color: 'rgba(var(--ink-rgb), .68)',
                }}>{p.line}</div>
              </div>
              {/* The school as a solid chip: the strongest the colour can be
                  said, on the one element that carries no long text. */}
              <span style={{
                padding: '3px 7px', background: tint, color: 'var(--cream)',
                font: "700 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.06em',
              }}>{p.team}</span>
            </button>
          );
        })}
      </div>
    </div>
    </FixedHeader>
  );
}
