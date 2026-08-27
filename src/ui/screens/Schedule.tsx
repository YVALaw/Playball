import { useState } from 'react';
// Schedule.tsx
// The 33 game calendar. Played games carry their result; the rest is what is
// coming. Weekend series are grouped, because that is how a college season is
// actually experienced — three games against one opponent, then a week.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { teamColour } from '../Avatar.js';
import { FixedHeader } from '../Sticky.js';
import { FirstVisit } from '../Tutorial.js';
import { LineScore } from '../LineScore.js';
import { regularRecord } from '../../engine/season.js';
import type { BoxScore, BoxLine, SeasonState } from '../../engine/season.js';
import { seasonDate } from '../format.js';

export function Schedule() {
  const [openDay, setOpenDay] = useState<number | null>(null);
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  void version;

  if (!season || !team) return null;

  // Every date this program plays, in order, with the result if it has happened.
  const rows = season.schedule.flatMap((day) => {
    const g = day.games.find((x) => x.home === team.index || x.away === team.index);
    if (!g) return [];
    const home = g.home === team.index;
    const opponent = season.teams[home ? g.away : g.home];
    const result = season.results.find(
      (r) => r.day === day.day && (r.home === team.index || r.away === team.index),
    );
    return [{ day, g, home, opponent, result }];
  });

  return (
    <>
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">SCHEDULE · {year}</div>
            <div style={{
              font: "800 calc(21px * var(--ts))/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
            }}>{regularRecord(team).w}-{regularRecord(team).l} overall</div>
          </div>
          {/* The program's vitals, moved off the dashboard. The season tab is
              where you come to ask how the year is going, so the year's three
              numbers live here now. */}
          <div style={{
            display: 'flex', marginTop: 8,
            border: '1px solid var(--faint)', background: 'var(--paper)',
          }}>
            {([
              ['OVERALL', `${team.w}-${team.l}`],
              ['CONFERENCE', `${team.cw}-${team.cl}`],
              ['RUN DIFF', `${team.rs - team.ra > 0 ? '+' : ''}${team.rs - team.ra}`],
            ] as const).map(([k, v], i) => (
              <div key={k} style={{
                flex: 1, padding: '7px 8px',
                borderRight: i < 2 ? '1px solid var(--hairline)' : 'none',
              }}>
                <div className="label">{k}</div>
                <div style={{ font: "700 calc(16px * var(--ts))/1 var(--display)", marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      }
    >
    <div style={{ padding: '2px 14px 16px' }}>
      <FirstVisit id="season" />
      <div style={{
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {rows.map(({ day, home, opponent, result }, i) => {
          const won = result
            ? (home ? result.homeRuns > result.awayRuns : result.awayRuns > result.homeRuns)
            : null;
          const us = result ? (home ? result.homeRuns : result.awayRuns) : null;
          const them = result ? (home ? result.awayRuns : result.homeRuns) : null;

          // A played game opens its box score. An unplayed one has nothing to
          // show, so it stays inert rather than offering a tap that does nothing.
          const box = season.boxScores?.[day.day];

          return (
            <button
              key={`${day.day}-${i}`}
              onClick={() => box && setOpenDay(day.day)}
              disabled={!box}
              style={{
                width: '100%', textAlign: 'left',
                display: 'grid',
                gridTemplateColumns: '68px 14px 1fr 26px 46px',
                gap: 6, alignItems: 'center',
                padding: '8px 10px',
                borderBottom: '1px solid var(--hairline)',
                background: 'transparent',
              }}
            >
              <span style={{ font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
                {seasonDate(year, day.day)}
              </span>
              <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
                {home ? 'vs' : '@'}
              </span>
              <span style={{
                font: "400 calc(12px * var(--ts)) var(--body)",
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{opponent?.def.school ?? '—'}</span>
              <span style={{
                font: "600 calc(11px * var(--ts)) var(--mono)",
                color: won === null ? 'var(--dim)' : (won ? 'var(--win)' : 'var(--loss)'),
                textAlign: 'right',
              }}>{won === null ? '' : (won ? 'W' : 'L')}</span>
              <span style={{
                font: "400 calc(11px * var(--ts)) var(--mono)", textAlign: 'right',
                color: won === null ? 'rgba(28,36,48,.35)' : 'var(--ink)',
              }}>
                {result ? `${us}-${them}` : day.kind === 'series' ? 'series' : 'mid'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
    </FixedHeader>
    {/*
      The sheet is a sibling of the screen rather than a child of its scroller.
      It covers the frame, and a full-screen cover that lives inside the box it
      is covering is one that scrolls with it — the header would ride out from
      under the sheet the first time you dragged a long box score.
    */}
    {openDay !== null && season.boxScores?.[openDay] && (
      <BoxScoreSheet
        box={season.boxScores[openDay]}
        season={season}
        onClose={() => setOpenDay(null)}
      />
    )}
    </>
  );
}


/**
 * One game, in full.
 *
 * Both sides, batting and pitching, with every name tappable. A schedule that
 * only carries a final score answers "did we win" and nothing else — the reason
 * to look back at a game in March is to find out who did it.
 */
export function BoxScoreSheet(
  { box, season, onClose }:
  { box: BoxScore; season: SeasonState; onClose: () => void },
) {
  const openPlayer = useDynasty((s) => s.openPlayer);
  const home = season.teams[box.home];
  const away = season.teams[box.away];

  const Side = (
    { label, abbr, runs, batting, pitching }:
    { label: string; abbr: string; runs: number; batting: BoxLine[]; pitching: BoxLine[] },
  ) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '6px 0', borderBottom: '2px solid var(--ink)',
      }}>
        <span style={{
          font: "700 calc(14px * var(--ts)) var(--display)", textTransform: 'uppercase',
          color: teamColour(abbr),
        }}>{label}</span>
        <span style={{ font: "800 calc(20px * var(--ts))/1 var(--display)" }}>{runs}</span>
      </div>
      {[...batting, ...pitching].map((l) => (
        <button
          key={l.id}
          onClick={() => openPlayer(l.id)}
          style={{
            width: '100%', textAlign: 'left', display: 'flex', gap: 8,
            alignItems: 'baseline', padding: '6px 0',
            borderBottom: '1px solid var(--hairline)', background: 'transparent',
          }}
        >
          <span style={{
            font: "600 calc(9px * var(--ts)) var(--mono)", color: 'var(--dim)', minWidth: 26,
          }}>{l.slot}</span>
          <span style={{
            flex: 1, font: "400 calc(12px * var(--ts)) var(--body)",
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{l.name}</span>
          <span style={{
            font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)', whiteSpace: 'nowrap',
          }}>{l.line}</span>
        </button>
      ))}
    </div>
  );

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
          width: '100%', height: '80%',
          display: 'flex', flexDirection: 'column',
          background: 'var(--paper)', borderTop: '3px solid var(--clay)',
        }}
      >
        <div style={{
          flex: 'none', padding: '7px 12px', background: 'var(--clay)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{
            font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
          }}>BOX SCORE · {box.innings} INNINGS</span>
          <button onClick={onClose} style={{
            font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.14em', color: 'rgba(246,241,230,.8)',
          }}>CLOSE</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px' }}>
          {/*
            The linescore, when the save has one. Boxes stored before it existed
            have no lines to show, and the sheet must still open for them. The
            home line is one inning short when the bottom of the last was never
            needed, which is what the 'X' says.
          */}
          {box.awayLine && box.homeLine && (
            <div style={{
              marginBottom: 14, padding: '6px 8px',
              border: '1px solid var(--faint)', background: 'var(--paper)',
            }}>
              <LineScore
                innings={Math.max(box.awayLine.length, box.homeLine.length)}
                rows={[
                  {
                    abbr: away?.def.abbr ?? 'AWY',
                    cells: box.awayLine.map((n) => n),
                    r: box.awayRuns, h: box.awayHits ?? 0, e: box.awayErrors ?? 0,
                  },
                  {
                    abbr: home?.def.abbr ?? 'HOM',
                    cells: [
                      ...box.homeLine,
                      ...(box.homeLine.length < box.awayLine.length ? ['X'] : []),
                    ],
                    r: box.homeRuns, h: box.homeHits ?? 0, e: box.homeErrors ?? 0,
                  },
                ]}
              />
            </div>
          )}
          <Side
            label={away?.def.school ?? 'Away'} abbr={away?.def.abbr ?? ''}
            runs={box.awayRuns} batting={box.awayBatting} pitching={box.awayPitching}
          />
          <Side
            label={home?.def.school ?? 'Home'} abbr={home?.def.abbr ?? ''}
            runs={box.homeRuns} batting={box.homeBatting} pitching={box.homePitching}
          />
        </div>
      </div>
    </div>
  );
}
