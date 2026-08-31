import { useState } from 'react';
// Schedule.tsx
// The 33 game calendar. Played games carry their result; the rest is what is
// coming. Weekend series are grouped, because that is how a college season is
// actually experienced — three games against one opponent, then a week.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { teamColour } from '../Avatar.js';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { useOpenTeam } from './TeamCard.js';
import {
  FieldNote, Metric, MetricStrip, ModuleIntro, SectionHeading,
} from '../components/Kit.js';
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
  const openTeam = useOpenTeam();
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

  /*
    The next four dates, across the top.

    The proposal calls this the schedule rail and fills it with a week. A week
    is not the unit this calendar thinks in — the season plays Friday to Sunday
    against one opponent and one midweek game — so the rail carries the next
    four things that actually happen, played or not, which is the same idea with
    the right grain.
  */
  const played = rows.filter((r) => r.result).length;
  const rail = rows.slice(Math.max(0, played - 1), Math.max(0, played - 1) + 4);

  const reg = regularRecord(team);
  const diff = team.rs - team.ra;

  return (
    <>
      <main className="module-workspace">
        <FirstVisit id="season" />

        <div className="screen-title-row">
          <ModuleIntro
            kicker={`${year} SEASON`}
            title={played === rows.length ? 'The year, in full' : 'The road ahead'}
            text="Every series, result and box score in one season view."
          />
          <span className="month-button">{reg.w}-{reg.l}</span>
        </div>

        <section className="schedule-rail">
          {rail.map(({ day, home, opponent, result }) => {
            const box = season.boxScores?.[day.day];
            const us = result ? (home ? result.homeRuns : result.awayRuns) : null;
            const them = result ? (home ? result.awayRuns : result.homeRuns) : null;
            const won = result ? us! > them! : null;
            return (
              <button
                key={day.day}
                type="button"
                onClick={() => (box
                  ? setOpenDay(day.day)
                  : opponent && openTeam(opponent.index))}
              >
                <small>{seasonDate(year, day.day).split(' ').slice(1).join(' ')}</small>
                <strong>{home ? '' : '@ '}{opponent?.def.abbr ?? '—'}</strong>
                {/* A played date carries its result; one still to come carries
                    what kind of game it is, which is the only thing known about
                    it. Red is reserved for a loss — the proposal spends it on
                    an off day, and a fixture you have not played yet is not an
                    alarm. */}
                <i className={won === null ? '' : won ? 'won' : 'lost'}>
                  {won === null
                    ? (day.kind === 'series' ? 'series' : 'midweek')
                    : `${won ? 'W' : 'L'} ${us}-${them}`}
                </i>
              </button>
            );
          })}
        </section>

        {/* The program's vitals, moved off the dashboard. The season tab is
            where you come to ask how the year is going, so the year's three
            numbers live here. */}
        <MetricStrip>
          <Metric label="OVERALL" value={`${team.w}-${team.l}`} note={`${played} PLAYED`} />
          <Metric label="CONFERENCE" value={`${team.cw}-${team.cl}`} note={team.conference.toUpperCase()} />
          <Metric label="RUN DIFF" value={`${diff > 0 ? '+' : ''}${diff}`} note={`${team.rs} FOR`} />
        </MetricStrip>

        <SectionHeading kicker="SERIES VIEW" title={`${year} schedule`} />
        <section className="series-list">
          {rows.map(({ day, home, opponent, result }, i) => {
            const won = result
              ? (home ? result.homeRuns > result.awayRuns : result.awayRuns > result.homeRuns)
              : null;
            const us = result ? (home ? result.homeRuns : result.awayRuns) : null;
            const them = result ? (home ? result.awayRuns : result.homeRuns) : null;
            // A played game opens its box score. An unplayed one has nothing to
            // show, so it opens the other program instead of offering a tap
            // that does nothing.
            const box = season.boxScores?.[day.day];
            const next = won === null && i === played;
            return (
              <button
                className={`series-match${next ? ' is-yours' : ''}`}
                key={`${day.day}-${i}`}
                type="button"
                onClick={() => (box
                  ? setOpenDay(day.day)
                  : opponent && openTeam(opponent.index))}
              >
                <span>
                  <b>{home ? 'vs ' : 'at '}{opponent?.def.school ?? '—'}</b>
                  <strong>{result ? `${us}-${them}` : ''}</strong>
                  <em className={won === null ? '' : won ? 'won' : 'lost'}>
                    {won === null ? '' : won ? 'W' : 'L'}
                  </em>
                  <small>
                    {seasonDate(year, day.day)} · {day.kind === 'series' ? 'conference series' : 'midweek'}
                    {next ? ' · next up' : ''}
                  </small>
                </span>
                <ChevronRightIcon />
              </button>
            );
          })}
        </section>

        <FieldNote
          title="Every played game keeps its book"
          text="Tap a final to open the full box score — both sides, batting and pitching, with every name in it tappable. A game still to come opens the program you are playing."
        />
      </main>

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
        position: 'absolute', inset: 0, background: 'rgba(var(--ink-rgb), .55)',
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
            font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.14em', color: 'rgba(var(--cream-rgb), .8)',
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
