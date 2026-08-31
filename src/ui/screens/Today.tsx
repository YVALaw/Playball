// Today.tsx
// The hub. Where you are in the season, how the program is doing, and the one
// button that moves the year forward.

import { useRef, useState } from 'react';
import { FINISH_LABEL } from '../../engine/postseason.js';
import { useDynasty, useUserTeam } from '../../state/store.js';
import {
  seasonComplete, rpiOrder, seasonLength, era,
  type SeasonState, type TeamRecord, type GameSummary,
} from '../../engine/season.js';
import { Rule, Card } from '../components/Kit.js';
import { FixedHeader } from '../Sticky.js';
import { FirstVisit } from '../Tutorial.js';
import { useOpenTeam } from './TeamCard.js';
import { BoxScoreSheet } from './Schedule.js';
import { seasonDate } from '../format.js';
import { NeedsYou } from '../Needs.js';
import type { Pitcher } from '../../engine/types.js';

/**
 * A team's collective batting average, straight off the season books.
 *
 * Walked over the roster rather than kept as a running counter, because the
 * only honest team average is the sum of its player lines — the audit found
 * what happens to a second copy of a number.
 */
function teamAverage(season: SeasonState, t: TeamRecord): number | null {
  let h = 0, ab = 0;
  for (const p of [...t.team.lineup, ...t.team.bench]) {
    const line = season.batting.get(p.id);
    if (!line) continue;
    h += line.h; ab += line.ab;
  }
  return ab >= 20 ? h / ab : null;
}

/** And its collective ERA, same construction. */
function teamEra(season: SeasonState, t: TeamRecord): number | null {
  let er = 0, outs = 0;
  for (const p of [...t.team.rotation, ...t.team.bullpen]) {
    const line = season.pitching.get(p.id);
    if (!line) continue;
    er += line.er; outs += line.outs;
  }
  return outs >= 27 ? (er * 27) / outs : null;
}

export function Today() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const year = useDynasty((s) => s.year);
  const advanceDay = useDynasty((s) => s.advanceDay);
  const simWeek = useDynasty((s) => s.simWeek);
  const playSeason = useDynasty((s) => s.playSeason);
  const startManagedGame = useDynasty((s) => s.startManagedGame);
  const playPostseason = useDynasty((s) => s.playPostseason);
  const lastPostseason = useDynasty((s) => s.lastPostseason);
  const openOffseason = useDynasty((s) => s.openOffseason);
  const busy = useDynasty((s) => s.busy);
  const progress = useDynasty((s) => s.progress);
  const live = useDynasty((s) => s.live);
  const pendingGame = useDynasty((s) => s.pendingGame);
  const resumeGame = useDynasty((s) => s.resumeGame);
  const openTeam = useOpenTeam();
  const team = useUserTeam();
  void version;                         // in-place mutation: see store.ts

  /*
    The 0.8 second breath before a sim resolves.

    A day sims in a couple of milliseconds, and a result that appears the same
    frame the thumb lands reads as though nothing was played. The pause is
    honest about what it is — a beat, in the button itself, with a ring — and
    it doubles as the rapid-fire guard for these two controls.
  */
  const [thinking, setThinking] = useState<'game' | 'week' | null>(null);
  const thinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const think = (which: 'game' | 'week', run: () => void): void => {
    if (thinking !== null) return;
    setThinking(which);
    thinkTimer.current = setTimeout(() => {
      thinkTimer.current = null;
      setThinking(null);
      run();
    }, 800);
  };

  /** A finished game, opened off the results strip. */
  const [openGame, setOpenGame] = useState<GameSummary | null>(null);

  if (!season || !team) return null;

  const done = seasonComplete(season);
  const day = season.schedule[season.dayIndex];

  // Where the program sits nationally. Recomputed rather than cached — 96 teams
  // is cheap and a stale rank on the hub screen is worse than the work.
  // RPI needs games. Before any are played every team is 0-0, so the table is
  // ordered by the tiebreak backstop alone — showing "#1" off that would be
  // inventing a standing.
  const ranks = new Map<number, number>();
  if (team.gp > 0) rpiOrder(season).forEach((r, i) => ranks.set(r.team.index, i + 1));
  const rank = ranks.get(team.index) ?? 0;

  const todayGame = day?.games.find((g) => g.home === team.index || g.away === team.index);
  const opponent = todayGame
    ? season.teams[todayGame.home === team.index ? todayGame.away : todayGame.home]
    : null;
  const atHome = todayGame?.home === team.index;

  // Tonight's probable arms, exactly the way the engine will pick them: the
  // scheduled rotation slot on both sides.
  const slot = todayGame?.slot ?? 0;
  const ourArm = team.team.rotation[slot] ?? team.team.rotation[0];
  const theirArm = opponent
    ? opponent.team.rotation[slot] ?? opponent.team.rotation[0]
    : null;
  const armLine = (p: Pitcher | null | undefined): string => {
    if (!p) return '—';
    const line = season.pitching.get(p.id);
    const e = line && line.outs >= 9 ? ` · ${era(line).toFixed(2)}` : '';
    return `${p.name}${e}`;
  };

  // Where the series stands, when tonight is part of one. The schedule plays
  // Friday–Sunday against one opponent; games already played against them this
  // week are the series so far.
  const seriesSoFar = todayGame && opponent && day?.kind === 'series'
    ? season.results.filter((r) =>
      Math.abs(r.day - day.day) <= 3
      && ((r.home === team.index && r.away === opponent.index)
        || (r.away === team.index && r.home === opponent.index)))
    : [];
  const seriesWins = seriesSoFar.filter((r) =>
    (r.home === team.index) === (r.homeRuns > r.awayRuns)).length;

  const seriesTag = seriesSoFar.length === 0
    ? ''
    : seriesWins * 2 > seriesSoFar.length
      ? ` · GAME ${seriesSoFar.length + 1}, YOU LEAD ${seriesWins}-${seriesSoFar.length - seriesWins}`
      : seriesWins * 2 < seriesSoFar.length
        ? ` · GAME ${seriesSoFar.length + 1}, THEY LEAD ${seriesSoFar.length - seriesWins}-${seriesWins}`
        : ` · GAME ${seriesSoFar.length + 1}, SERIES LEVEL`;

  const ourAvg = teamAverage(season, team);
  const ourEra = teamEra(season, team);
  const oppAvg = opponent ? teamAverage(season, opponent) : null;
  const oppEra = opponent ? teamEra(season, opponent) : null;

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            borderBottom: '2px solid var(--ink)', paddingBottom: 6,
          }}>
            <div>
              <div style={{
                font: "500 calc(9px * var(--ts))/1 var(--mono)", letterSpacing: '.2em', color: 'var(--dim)',
              }}>
                {done ? 'REGULAR SEASON COMPLETE'
                  : `WEEK ${day?.week ?? 1} · ${day?.kind === 'series' ? 'CONFERENCE SERIES' : 'MIDWEEK'}`}
              </div>
              <div style={{
                font: "800 calc(21px * var(--ts))/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
              }}>{done ? `${year} FINAL` : seasonDate(year, day?.day ?? 0)}</div>
            </div>
            <div style={{
              textAlign: 'right', font: "500 calc(9.5px * var(--ts))/1.6 var(--mono)", color: 'var(--dim)',
            }}>
              RPI #{rank || '—'}<br />
              {team.streak === 0 ? 'No streak'
                : `${team.streak > 0 ? 'Won' : 'Lost'} ${Math.abs(team.streak)} straight`}
            </div>
          </div>
        </div>
      }
    >
    <div style={{ padding: '10px 14px 16px' }}>
      <FirstVisit id="today" />

      {/*
        The game a phone call took away, offered back.

        Above everything, because it is the only thing on this screen that is
        already in progress — and offered rather than restored, because being
        teleported into the seventh inning of a game you had forgotten is its
        own kind of disorienting. Declining does not un-play the day: the
        bench coach finishes it, which is what happens to a manager who walks
        out of a dugout anyway.
      */}
      {pendingGame && (
        <div className="rise-in" style={{
          marginBottom: 12, border: '1px solid var(--clay)',
          borderLeft: '5px solid var(--clay)', background: 'var(--paper)',
        }}>
          <div style={{ padding: '6px 11px', background: 'var(--clay)' }}>
            <span style={{
              font: "600 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.18em', color: 'var(--cream)',
            }}>GAME IN PROGRESS</span>
          </div>
          <div style={{ padding: '11px 12px 12px' }}>
            <div style={{
              font: "800 calc(18px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
            }}>{pendingGame.line}</div>
            <div style={{
              marginTop: 5, font: "400 calc(11.5px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
            }}>You left this one on the field.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Action label="PICK IT UP" primary onClick={() => void resumeGame(true)} />
              <Action label="LET THEM FINISH" onClick={() => void resumeGame(false)} />
            </div>
          </div>
        </div>
      )}
      {/* The record tiles used to sit here. They live on the season tab now —
          the dashboard is for what happens next, not for how it has gone. */}
      {todayGame && opponent && (
        <button
          onClick={() => openTeam(opponent.index)}
          style={{
            display: 'block', width: '100%', textAlign: 'left', padding: 0,
            background: 'transparent',
          }}
        >
          <Card
            tag={day?.kind === 'series'
              ? `TODAY · ${team.conference} SERIES${seriesTag}`
              : 'TODAY · MIDWEEK'}
            note={`GAME ${team.gp + 1} OF ${seasonLength(season.config)}`}
          >
            <div style={{ padding: '12px 12px 10px' }}>
              <div style={{ font: "800 calc(22px * var(--ts))/1 var(--display)", textTransform: 'uppercase' }}>
                {atHome ? 'vs ' : 'at '}{opponent.def.school}
              </div>
              <div style={{
                marginTop: 4, font: "400 calc(11px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
              }}>
                {opponent.def.nickname} · {opponent.w}-{opponent.l}
                {' '}({opponent.cw}-{opponent.cl} {opponent.conference})
                {ranks.get(opponent.index) ? ` · RPI #${ranks.get(opponent.index)}` : ''}
                {' · '}{atHome ? 'home' : 'road'}
                {opponent.streak >= 3 ? ` · won ${opponent.streak} straight` : ''}
                {opponent.streak <= -3 ? ` · lost ${-opponent.streak} straight` : ''}
              </div>
              <div style={{
                marginTop: 7, font: "400 calc(10.5px * var(--ts))/1.5 var(--mono)", color: 'var(--ink)',
              }}>
                {armLine(ourArm)} <span style={{ color: 'var(--dim)' }}>vs</span> {armLine(theirArm)}
              </div>
            </div>
            {/* The matchup in three numbers, ours against theirs. Dashes until
                there is a season to measure — early April is not invented. */}
            <div style={{
              display: 'flex', borderTop: '1px solid var(--hairline)',
            }}>
              {([
                ['TEAM AVG', ourAvg === null ? '—' : ourAvg.toFixed(3).replace(/^0/, ''),
                  oppAvg === null ? '—' : oppAvg.toFixed(3).replace(/^0/, '')],
                ['TEAM ERA', ourEra === null ? '—' : ourEra.toFixed(2),
                  oppEra === null ? '—' : oppEra.toFixed(2)],
                ['RPI', rank ? `#${rank}` : '—',
                  ranks.get(opponent.index) ? `#${ranks.get(opponent.index)}` : '—'],
              ] as const).map(([k, us, them], i) => (
                <div key={k} style={{
                  flex: 1, padding: '7px 10px 8px',
                  borderLeft: i > 0 ? '1px solid var(--hairline)' : 'none',
                }}>
                  <div className="label">{k}</div>
                  <div style={{ marginTop: 2, font: "700 calc(15px * var(--ts)) var(--display)" }}>
                    {us}
                    <span style={{
                      font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)', marginLeft: 6,
                    }}>{them}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </button>
      )}

      {!todayGame && !done && (
        <Card tag="OFF DAY" note={`WEEK ${day?.week ?? 1}`}>
          <div style={{ padding: '12px', font: "400 calc(12px * var(--ts))/1.5 var(--body)", color: 'var(--dim)' }}>
            No game scheduled. Bullpen work and situational defense.
          </div>
        </Card>
      )}

      <Rule />

      {busy && progress && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span className="label">SIMULATING</span>
            <span style={{ font: "500 calc(9.5px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
              DAY {progress.day} OF {progress.totalDays}
            </span>
          </div>
          <div style={{
            marginTop: 5, height: 4, background: 'var(--faint)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.round((progress.day / progress.totalDays) * 100)}%`,
              background: 'var(--clay)',
            }} />
          </div>
        </div>
      )}

      {!done ? (
        <div style={{ opacity: busy ? 0.4 : 1 }}>
          {/*
            PLAY BALL is the game; the two gears beside it advance without you.
            SIM GAME plays the day, SIM WEEK plays out the current week — the
            unit the calendar actually thinks in. All three genuinely disable
            while a sim runs; the store guards them too.
          */}
          <div style={{ marginTop: 12 }}>
            <Action
              label={live ? 'BACK TO THE GAME' : todayGame ? 'PLAY BALL' : 'NEXT GAME'}
              primary full
              disabled={busy || thinking !== null}
              onClick={() => void startManagedGame()}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Action
              label={todayGame ? 'SIM GAME' : 'ADVANCE'}
              spinning={thinking === 'game'}
              disabled={busy || !!live || thinking === 'week'}
              onClick={() => think('game', advanceDay)}
            />
            <Action
              label="SIM WEEK"
              spinning={thinking === 'week'}
              disabled={busy || !!live || thinking === 'game'}
              onClick={() => think('week', simWeek)}
            />
          </div>
          {/*
            The whole year at one press, kept while the game is still being
            tested. Scheduled to leave before v1.0 — a dynasty player should
            live the season, but a tester needs to reach June before lunch.
          */}
          <div style={{ marginTop: 8 }}>
            <Action
              label="SIM SEASON"
              full
              disabled={busy || !!live || thinking !== null}
              onClick={() => void playSeason()}
            />
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {!lastPostseason ? (
            /*
              The season is over and the screen says so like it matters.

              The opponent card vanishes with the schedule, and a bare button
              floating where it used to be read as something missing rather
              than something arriving. Reported from testing: "when the play
              the post season button came up it took out the whole card which
              makes it look weird." This is the card that takes its place — a
              gate, not a gap.
            */
            <>
              <div className="rise-in" style={{
                border: '1px solid var(--faint)', background: 'var(--ink)',
                marginBottom: 10,
              }}>
                <div style={{ padding: '6px 12px', background: 'var(--clay)' }}>
                  <span style={{
                    font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.2em', color: 'var(--cream)',
                  }}>{year} · THE REGULAR SEASON IS IN THE BOOKS</span>
                </div>
                <div style={{ padding: '14px 12px 15px', textAlign: 'center' }}>
                  <div style={{
                    font: "800 calc(26px * var(--ts))/0.95 var(--display)", textTransform: 'uppercase',
                    color: 'var(--cream)',
                  }}>June is here</div>
                  <div style={{
                    marginTop: 7, font: "400 calc(12px * var(--ts))/1.55 var(--body)",
                    color: 'rgba(var(--cream-rgb), .72)', maxWidth: 300,
                    marginLeft: 'auto', marginRight: 'auto',
                  }}>
                    {team.w}-{team.l}, and now the games that get remembered.
                    Every jersey in the country is washed for this.
                  </div>
                </div>
              </div>
              <Action
                label={busy ? 'PLAYING…' : 'PLAY THE POSTSEASON'}
                onClick={() => void playPostseason()}
                disabled={busy}
                primary
                full
              />
            </>
          ) : (
            <>
              <Postseason />
              {/*
                The offseason is a sequence of full screens, so this hands over
                to it rather than doing the work itself. It is only reachable
                after a reload, because the phase is not persisted — normally the
                postseason opens the sequence directly.
              */}
              <Action
                label="END SEASON"
                onClick={() => openOffseason()}
                primary
                full
              />
              <div style={{
                marginTop: 8, font: "400 calc(11px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
              }}>
                Awards, the board's verdict, your own development, then three
                weeks of recruiting and the draft.
              </div>
            </>
          )}
        </div>
      )}

      {/*
        What is waiting on you, where the conference scoreboard used to be.

        Asked for in those terms, and it is the better use of the space. The
        scoreboard was eight results you could do nothing about, sitting under
        the one button that moves your season -- and the things you *could* do
        something about had nowhere to be, so the press room got itself a
        screen by interrupting and an injury got itself nothing at all.

        Last night around the conference has not gone anywhere: SCHEDULE has
        every result and CONFERENCE has the table they add up to. It has stopped
        being the thing the home screen is for.
      */}
      <NeedsYou />
    </div>

    {/*
      How it played out. The user's own game has a full box score in the save,
      so it opens the real one; everyone else's carries a summary card — the
      final, the shape of it, and both doors.
    */}
    {openGame && (
      openGame.day in (season.boxScores ?? {})
        && (openGame.home === team.index || openGame.away === team.index)
        ? (
          <BoxScoreSheet
            box={season.boxScores[openGame.day]!}
            season={season}
            onClose={() => setOpenGame(null)}
          />
        )
        : (
          <GameSheet
            g={openGame}
            season={season}
            year={year}
            onClose={() => setOpenGame(null)}
            onTeam={(i) => { setOpenGame(null); openTeam(i); }}
          />
        )
    )}
    </FixedHeader>
  );
}

/**
 * The card for a game the save has no box for: the result, said properly.
 * Every other program's games keep only their summary, and a summary shown
 * well beats a box score invented badly.
 */
function GameSheet(
  { g, season, year, onClose, onTeam }:
  {
    g: GameSummary; season: SeasonState; year: number;
    onClose: () => void; onTeam: (i: number) => void;
  },
) {
  const home = season.teams[g.home];
  const away = season.teams[g.away];
  if (!home || !away) return null;
  const homeWon = g.homeRuns > g.awayRuns;

  const Row = ({ i, school, runs, won }: {
    i: number; school: string; runs: number; won: boolean;
  }) => (
    <button
      onClick={() => onTeam(i)}
      className="tap"
      style={{
        width: '100%', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', gap: 10, padding: '11px 12px',
        background: 'transparent', borderBottom: '1px solid var(--hairline)',
        textAlign: 'left',
      }}
    >
      <span style={{
        font: `800 calc(17px * var(--ts))/1 var(--display)`, textTransform: 'uppercase',
        color: won ? 'var(--ink)' : 'var(--dim)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{school}</span>
      <span style={{
        font: "800 calc(22px * var(--ts))/1 var(--display)",
        color: won ? 'var(--clay)' : 'var(--dim)',
      }}>{runs}</span>
    </button>
  );

  return (
    <div
      onClick={onClose}
      className="fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`${away.def.school} at ${home.def.school}`}
      style={{
        position: 'absolute', inset: 0, background: 'rgba(var(--ink-rgb), .55)',
        display: 'flex', alignItems: 'flex-end', zIndex: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet"
        style={{
          width: '100%', background: 'var(--paper)', borderTop: '3px solid var(--clay)',
        }}
      >
        <div style={{
          padding: '7px 12px', background: 'var(--clay)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{
            font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
          }}>
            FINAL{g.innings > 9 ? ` · ${g.innings} INNINGS` : ''}
            {' · '}{seasonDate(year, g.day).toUpperCase()}
          </span>
          <button onClick={onClose} style={{
            font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.14em', color: 'rgba(var(--cream-rgb), .8)',
          }}>CLOSE</button>
        </div>
        <Row i={g.away} school={away.def.school} runs={g.awayRuns} won={!homeWon} />
        <Row i={g.home} school={home.def.school} runs={g.homeRuns} won={homeWon} />
        <div style={{
          padding: '9px 12px 13px', font: "400 calc(11px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
        }}>
          Tap a school for the full picture. Box scores only survive for your
          own games; everyone else phones theirs in.
        </div>
      </div>
    </div>
  );
}

/** How the year ended, shown once between the last game and the roll over. */
function Postseason() {
  const season = useDynasty((x) => x.season);
  const userTeam = useDynasty((x) => x.userTeam);
  const result = useDynasty((x) => x.lastPostseason);
  if (!season || !result) return null;

  const me = result.finish[userTeam] ?? 'missed';
  const champion = season.teams[result.champion]?.def.school ?? '—';
  const wonConference = result.conferenceChampions.includes(userTeam);
  const big = me === 'champion';

  return (
    <div style={{
      marginBottom: 12, border: '1px solid var(--faint)', background: 'var(--paper)',
    }}>
      <div style={{ padding: '6px 10px', background: big ? 'var(--clay)' : 'var(--navy)' }}>
        <span style={{
          font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
        }}>POSTSEASON</span>
      </div>
      <div style={{ padding: '11px 12px 12px' }}>
        <div style={{
          font: "800 calc(22px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
          color: big ? 'var(--clay)' : 'var(--ink)',
        }}>{FINISH_LABEL[me]}</div>
        <div style={{
          marginTop: 6, font: "400 calc(11px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
        }}>
          {wonConference ? 'Won the conference tournament. ' : ''}
          {big ? 'Nobody can take this one away.' : `${champion} won the national title.`}
        </div>
      </div>
    </div>
  );
}

function Action(
  { label, onClick, primary, full, disabled, spinning }:
  {
    label: string; onClick: () => void; primary?: boolean; full?: boolean;
    disabled?: boolean;
    /** The button itself is where the wait shows: ring in, label dimmed. */
    spinning?: boolean;
  },
) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || spinning}
      style={{
        flex: full ? undefined : 1,
        width: full ? '100%' : undefined,
        padding: '13px 10px', minHeight: 44,
        background: primary ? 'var(--clay)' : 'transparent',
        border: `1px solid ${primary ? 'var(--clay)' : 'var(--faint)'}`,
        color: primary ? 'var(--cream)' : 'var(--ink)',
        font: "700 calc(13px * var(--ts)) var(--display)", letterSpacing: '.14em',
      }}
    >
      {spinning
        ? <span className="spinner" aria-label={`${label} in progress`} />
        : label}
    </button>
  );
}
