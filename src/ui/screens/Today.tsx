// Today.tsx
// The hub. Where you are in the season, how the program is doing, and the one
// button that moves the year forward.

import { FINISH_LABEL } from '../../engine/postseason.js';
import { useDynasty, useUserTeam } from '../../state/store.js';
import {
  seasonComplete, rpiOrder, seasonLength, era,
  type SeasonState, type TeamRecord,
} from '../../engine/season.js';
import { Rule, Tile, Card } from '../components/Kit.js';
import { FixedHeader } from '../Sticky.js';
import { FirstVisit } from '../Tutorial.js';
import { useOpenTeam } from './TeamCard.js';
import { seasonDate } from '../format.js';
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
  const startManagedGame = useDynasty((s) => s.startManagedGame);
  const playPostseason = useDynasty((s) => s.playPostseason);
  const lastPostseason = useDynasty((s) => s.lastPostseason);
  const openOffseason = useDynasty((s) => s.openOffseason);
  const busy = useDynasty((s) => s.busy);
  const progress = useDynasty((s) => s.progress);
  const live = useDynasty((s) => s.live);
  const openTeam = useOpenTeam();
  const team = useUserTeam();
  void version;                         // in-place mutation: see store.ts

  if (!season || !team) return null;

  const done = seasonComplete(season);
  const day = season.schedule[season.dayIndex];
  const diff = team.rs - team.ra;

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

  // Last night around the conference: every game a conference program played
  // on the most recent day that saw one. Real results only — a quiet Monday
  // shows the weekend rather than inventing scores.
  const confGames = season.results.filter((r) =>
    season.teams[r.home]?.conference === team.conference
    || season.teams[r.away]?.conference === team.conference);
  const lastNightDay = confGames.length > 0
    ? Math.max(...confGames.map((r) => r.day))
    : null;
  const lastNight = lastNightDay === null
    ? []
    : confGames.filter((r) => r.day === lastNightDay).slice(0, 8);

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
                font: "500 9px/1 var(--mono)", letterSpacing: '.2em', color: 'var(--dim)',
              }}>
                {done ? 'REGULAR SEASON COMPLETE'
                  : `WEEK ${day?.week ?? 1} · ${day?.kind === 'series' ? 'CONFERENCE SERIES' : 'MIDWEEK'}`}
              </div>
              <div style={{
                font: "800 34px/0.9 var(--display)", marginTop: 4, textTransform: 'uppercase',
              }}>{done ? `${year} FINAL` : seasonDate(year, day?.day ?? 0)}</div>
            </div>
            <div style={{
              textAlign: 'right', font: "500 9.5px/1.6 var(--mono)", color: 'var(--dim)',
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
      <div style={{
        display: 'flex',
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="OVERALL" v={`${team.w}-${team.l}`} />
        <Tile k="CONFERENCE" v={`${team.cw}-${team.cl}`} />
        <Tile k="RUN DIFF" v={`${diff > 0 ? '+' : ''}${diff}`} last />
      </div>

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
              <div style={{ font: "800 22px/1 var(--display)", textTransform: 'uppercase' }}>
                {atHome ? 'vs ' : 'at '}{opponent.def.school}
              </div>
              <div style={{
                marginTop: 4, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
              }}>
                {opponent.def.nickname} · {opponent.w}-{opponent.l}
                {' '}({opponent.cw}-{opponent.cl} {opponent.conference})
                {ranks.get(opponent.index) ? ` · RPI #${ranks.get(opponent.index)}` : ''}
                {' · '}{atHome ? 'home' : 'road'}
                {opponent.streak >= 3 ? ` · won ${opponent.streak} straight` : ''}
                {opponent.streak <= -3 ? ` · lost ${-opponent.streak} straight` : ''}
              </div>
              <div style={{
                marginTop: 7, font: "400 10.5px/1.5 var(--mono)", color: 'var(--ink)',
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
                  <div style={{ marginTop: 2, font: "700 15px var(--display)" }}>
                    {us}
                    <span style={{
                      font: "400 10px var(--mono)", color: 'var(--dim)', marginLeft: 6,
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
          <div style={{ padding: '12px', font: "400 12px/1.5 var(--body)", color: 'var(--dim)' }}>
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
            <span style={{ font: "500 9.5px var(--mono)", color: 'var(--dim)' }}>
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
              disabled={busy}
              onClick={startManagedGame}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Action label={todayGame ? 'SIM GAME' : 'ADVANCE'} disabled={busy || !!live} onClick={advanceDay} />
            <Action label="SIM WEEK" disabled={busy || !!live} onClick={simWeek} />
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {!lastPostseason ? (
            <>
              <Action
                label={busy ? 'PLAYING…' : 'PLAY THE POSTSEASON'}
                onClick={() => void playPostseason()}
                disabled={busy}
                primary
                full
              />
              <div style={{
                marginTop: 8, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
              }}>
                Win your conference, then your region, then the country. Eight
                conference champions, four regional champions, and one team left
                standing.
              </div>
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
                marginTop: 8, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
              }}>
                Awards, the board's verdict, your own development, then three
                weeks of recruiting and the draft.
              </div>
            </>
          )}
        </div>
      )}

      {/* Around the conference last night. Real scores off the season's own
          results; a day with no conference games shows the most recent one that
          had any rather than inventing a slate. */}
      {lastNight.length > 0 && lastNightDay !== null && (
        <>
          <div style={{
            marginTop: 20, borderBottom: '2px solid var(--ink)', paddingBottom: 6,
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <div className="label">
              {lastNightDay === (day?.day ?? 0) - 1 || done ? 'LAST NIGHT' : 'LATEST'} IN THE {team.conference}
            </div>
            <div style={{ font: "500 9px var(--mono)", color: 'var(--dim)' }}>
              {seasonDate(year, lastNightDay).toUpperCase()}
            </div>
          </div>
          <div style={{
            marginTop: 8, border: '1px solid var(--faint)', background: 'var(--paper)',
          }}>
            {lastNight.map((g, i) => {
              const home = season.teams[g.home];
              const away = season.teams[g.away];
              if (!home || !away) return null;
              const homeWon = g.homeRuns > g.awayRuns;
              const winner = homeWon ? g.home : g.away;
              const gap = (season.teams[homeWon ? g.away : g.home]?.prestige ?? 50)
                - (season.teams[winner]?.prestige ?? 50);
              const mine = g.home === team.index || g.away === team.index;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'baseline', gap: 8,
                  padding: '7px 10px', borderBottom: '1px solid var(--hairline)',
                  background: mine ? 'rgba(168,68,42,.06)' : 'transparent',
                }}>
                  <span style={{
                    flex: 1, font: "400 11px var(--mono)",
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    <b style={{ fontWeight: homeWon ? 400 : 700 }}>{away.def.abbr}</b>
                    {' at '}
                    <b style={{ fontWeight: homeWon ? 700 : 400 }}>{home.def.abbr}</b>
                    {gap >= 12 && (
                      <span style={{
                        marginLeft: 6, font: "600 8px var(--mono)", color: 'var(--clay)',
                        letterSpacing: '.1em',
                      }}>UPSET</span>
                    )}
                    {g.innings > 9 && (
                      <span style={{
                        marginLeft: 6, font: "600 8px var(--mono)", color: 'var(--dim)',
                        letterSpacing: '.1em',
                      }}>F/{g.innings}</span>
                    )}
                  </span>
                  <span style={{ font: "700 12px var(--mono)" }}>
                    {g.awayRuns}-{g.homeRuns}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
    </FixedHeader>
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
          font: "600 9px var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
        }}>POSTSEASON</span>
      </div>
      <div style={{ padding: '11px 12px 12px' }}>
        <div style={{
          font: "800 22px/1 var(--display)", textTransform: 'uppercase',
          color: big ? 'var(--clay)' : 'var(--ink)',
        }}>{FINISH_LABEL[me]}</div>
        <div style={{
          marginTop: 6, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
        }}>
          {wonConference ? 'Won the conference tournament. ' : ''}
          {big ? 'Nobody can take this one away.' : `${champion} won the national title.`}
        </div>
      </div>
    </div>
  );
}

function Action(
  { label, onClick, primary, full, disabled }:
  { label: string; onClick: () => void; primary?: boolean; full?: boolean; disabled?: boolean },
) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: full ? undefined : 1,
        width: full ? '100%' : undefined,
        padding: '13px 10px', minHeight: 44,
        background: primary ? 'var(--clay)' : 'transparent',
        border: `1px solid ${primary ? 'var(--clay)' : 'var(--faint)'}`,
        color: primary ? 'var(--cream)' : 'var(--ink)',
        font: "700 13px var(--display)", letterSpacing: '.14em',
      }}
    >{label}</button>
  );
}
