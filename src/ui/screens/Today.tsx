// Today.tsx
// The hub. Where you are in the season, how the program is doing, and the one
// button that moves the year forward.

import { FINISH_LABEL } from '../../engine/postseason.js';
import { RECRUITING_WEEKS } from '../../engine/recruiting.js';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { seasonComplete, rpiOrder, seasonLength } from '../../engine/season.js';
import { Rule, Tile, Card } from '../components/Kit.js';
import { FixedHeader } from '../Sticky.js';
import { seasonDate } from '../format.js';

export function Today() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const year = useDynasty((s) => s.year);
  const advanceDay = useDynasty((s) => s.advanceDay);
  const startManagedGame = useDynasty((s) => s.startManagedGame);
  const playPostseason = useDynasty((s) => s.playPostseason);
  const lastPostseason = useDynasty((s) => s.lastPostseason);
  const playSeason = useDynasty((s) => s.playSeason);
  const openOffseason = useDynasty((s) => s.openOffseason);
  const busy = useDynasty((s) => s.busy);
  const progress = useDynasty((s) => s.progress);
  const team = useUserTeam();
  void version;                         // in-place mutation: see store.ts

  const recruitingOpen = !!season
    && season.recruiting.week >= 1
    && season.recruiting.week <= RECRUITING_WEEKS;

  if (!season || !team) return null;

  const done = seasonComplete(season);
  const day = season.schedule[season.dayIndex];
  const diff = team.rs - team.ra;

  // Where the program sits nationally. Recomputed rather than cached — 96 teams
  // is cheap and a stale rank on the hub screen is worse than the work.
  // RPI needs games. Before any are played every team is 0-0, so the table is
  // ordered by the tiebreak backstop alone — showing "#1" off that would be
  // inventing a standing.
  const rank = team.gp === 0
    ? 0
    : rpiOrder(season).findIndex((r) => r.team.index === team.index) + 1;

  const todayGame = day?.games.find((g) => g.home === team.index || g.away === team.index);
  const opponent = todayGame
    ? season.teams[todayGame.home === team.index ? todayGame.away : todayGame.home]
    : null;
  const atHome = todayGame?.home === team.index;

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
      <div style={{
        display: 'flex',
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="OVERALL" v={`${team.w}-${team.l}`} />
        <Tile k="CONFERENCE" v={`${team.cw}-${team.cl}`} />
        <Tile k="RUN DIFF" v={`${diff > 0 ? '+' : ''}${diff}`} last />
      </div>

      {todayGame && opponent && (
        <Card
          tag={day?.kind === 'series' ? `TODAY · ${team.conference} SERIES` : 'TODAY · MIDWEEK'}
          note={`GAME ${team.gp + 1} OF ${seasonLength(season.config)}`}
        >
          <div style={{ padding: '12px 12px 10px' }}>
            <div style={{ font: "800 22px/1 var(--display)", textTransform: 'uppercase' }}>
              {atHome ? 'vs ' : 'at '}{opponent.def.school}
            </div>
            <div style={{
              marginTop: 4, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
            }}>
              {opponent.def.nickname} · {opponent.w}-{opponent.l} on the year
              {' · '}{atHome ? 'home' : 'road'}
            </div>
          </div>
        </Card>
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
            PLAY BALL is the game.

            It used to advance the day and print a score, with managing tucked
            behind a duller label above it — which put the one screen the whole
            engine exists to drive second in line behind watching it happen to
            you. The big button now takes you to the mound.

            All three are genuinely disabled while a sim runs. The store guards
            them too, but a button that only *looks* dead invites the tap that
            used to start a managed game against a season the worker was about
            to replace.
          */}
          <div style={{ marginTop: 12 }}>
            <Action
              label={todayGame ? 'PLAY BALL' : 'NEXT GAME'}
              primary full
              disabled={busy}
              onClick={startManagedGame}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Action label={todayGame ? 'SIM GAME' : 'ADVANCE'} disabled={busy} onClick={advanceDay} />
            {/* Testing only. A season you can skip in one press is a season
                nobody plays, and this comes out before we ship. */}
            <Action label={busy ? 'SIMULATING…' : 'SIM SEASON'} disabled={busy} onClick={() => void playSeason()} />
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
                The year cannot turn over while recruiting is open, so the button
                that would do it must not be sitting here looking clickable. It
                points at the board instead, which is where the work is.
              */}
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
        padding: '13px 10px',
        background: primary ? 'var(--clay)' : 'transparent',
        border: `1px solid ${primary ? 'var(--clay)' : 'var(--faint)'}`,
        color: primary ? 'var(--cream)' : 'var(--ink)',
        font: "700 13px var(--display)", letterSpacing: '.14em',
      }}
    >{label}</button>
  );
}
