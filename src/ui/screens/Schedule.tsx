// Schedule.tsx
// The season calendar: how the year is going, what is next, and how each
// series went.
//
// Three numbers at the top, each with its scale: the regular-season record,
// the conference record and the run difference with its parts. Then the next
// games, tonight's tinted, and the results grouped the way a college season is
// lived: a weekend series against one opponent, a midweek game. A played game
// opens its box score; one still to come opens the opponent.

import { useEffect, useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { GodBolt } from '../god/GodBolt.js';
import { useOpenTeam } from './TeamCard.js';
import { FirstVisit } from '../Tutorial.js';
import { regularRecord } from '../../engine/season.js';
import type { BoxScore, BoxLine, SeasonState } from '../../engine/season.js';
import { cleanPlay, longDate, shortDate } from '../format.js';
import { buildFrames } from '../replay.js';
import { Crest } from '../Crest.js';
import {
  BaseState, Button, Callout, Card, EmptyState, GameRow, LineScore, List, Marquee, SectionHeader,
  SegmentedControl, Sheet, StatusBadge, Table, type TableColumn,
} from '../components/ui/index.js';
import { boxSlotWords, conferenceName, ordinal, plural, recordText } from '../words.js';

type Row = {
  day: SeasonState['schedule'][number];
  home: boolean;
  opponent: SeasonState['teams'][number] | undefined;
  result: SeasonState['results'][number] | undefined;
};

/** Our runs and theirs in a played game. */
function score(r: Row): { us: number; them: number; won: boolean } | null {
  if (!r.result) return null;
  const us = r.home ? r.result.homeRuns : r.result.awayRuns;
  const them = r.home ? r.result.awayRuns : r.result.homeRuns;
  return { us, them, won: us > them };
}

/** Consecutive games against one opponent in one series, or a single midweek game. */
function groupSeries(rows: Row[]): Row[][] {
  const out: Row[][] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    const prev = last?.[last.length - 1];
    if (last && prev && r.day.kind === 'series' && prev.day.kind === 'series'
      && prev.opponent?.index === r.opponent?.index && r.day.day - prev.day.day <= 2) {
      last.push(r);
    } else {
      out.push([r]);
    }
  }
  return out;
}

export function Schedule() {
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [allAhead, setAllAhead] = useState(false);
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const openTeam = useOpenTeam();
  void version;

  if (!season || !team) return null;

  // Every date this program plays, in order, with the result once it happens.
  const rows: Row[] = season.schedule.flatMap((day) => {
    const g = day.games.find((x) => x.home === team.index || x.away === team.index);
    if (!g) return [];
    const home = g.home === team.index;
    const opponent = season.teams[home ? g.away : g.home];
    const result = season.results.find(
      (r) => r.day === day.day && (r.home === team.index || r.away === team.index),
    );
    return [{ day, home, opponent, result }];
  });

  const played = rows.filter((r) => r.result);
  const ahead = rows.filter((r) => !r.result);
  const shownAhead = allAhead ? ahead : ahead.slice(0, 5);
  const reg = regularRecord(team);
  const diff = team.rs - team.ra;

  // A played game opens its box score; one still to come opens the opponent.
  const open = (r: Row): (() => void) | undefined => {
    if (r.result && season.boxScores?.[r.day.day]) return () => setOpenDay(r.day.day);
    if (r.opponent) { const i = r.opponent.index; return () => openTeam(i); }
    return undefined;
  };
  const kindWord = (r: Row): string => (r.day.kind === 'series' ? 'Conference series' : 'Midweek');

  const series = groupSeries(played).reverse();

  return (
    <>
      <main className="pb-page">
        <FirstVisit id="season" />
        <Marquee
          mark={<Crest abbr={team.def.abbr} size={44} />}
          eyebrow={`${year} season · ${played.length} of ${rows.length} played`}
          title="Schedule"
          trailing={<GodBolt target={{ kind: 'time' }} label="Reshuffle or sim the season in god mode" />}
          numbers={[
            { label: 'Record', value: recordText(reg.w, reg.l), note: 'Regular season' },
            { label: 'Conference', value: recordText(team.cw, team.cl), note: conferenceName(team.conference) },
            {
              label: 'Run diff',
              value: `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff)}`,
              note: `${team.rs} for, ${team.ra} against`,
            },
          ]}
        />

        {ahead.length > 0 && (
          <section>
            <SectionHeader
              title="Coming up"
              count={ahead.length}
            />
            <List label="Coming up">
              {shownAhead.map((r, i) => {
                const when = shortDate(year, r.day.day);
                return (
                  <GameRow
                    key={r.day.day}
                    day={when.weekday}
                    date={when.date}
                    opponent={r.opponent?.def.school ?? '—'}
                    abbr={r.opponent?.def.abbr ?? ''}
                    home={r.home}
                    kind={i === 0 ? `Next · ${kindWord(r)}` : kindWord(r)}
                    current={i === 0}
                    onClick={open(r)}
                  />
                );
              })}
            </List>
            {ahead.length > shownAhead.length && (
              <Button variant="quiet" size="sm" iconAfter="chevron-down" onClick={() => setAllAhead(true)}>
                Show all {ahead.length} games left
              </Button>
            )}
          </section>
        )}

        <section className="pb-stack">
          <SectionHeader
            title="Results"
          />
          {series.length === 0 ? (
            <EmptyState icon="calendar" title="No games played yet" text="Results appear here, series by series, once the season starts." />
          ) : series.map((games) => {
            const first = games[0]!;
            const lines = games.map(score);
            const w = lines.filter((s) => s?.won).length;
            const l = games.length - w;
            const midweek = first.day.kind !== 'series';
            const status = midweek
              ? (w ? <StatusBadge tone="positive">Won</StatusBadge> : <StatusBadge tone="negative">Lost</StatusBadge>)
              : games.length >= 3 && l === 0 ? <StatusBadge tone="positive">Swept {w}–0</StatusBadge>
                : games.length >= 3 && w === 0 ? <StatusBadge tone="negative">Swept 0–{l}</StatusBadge>
                  : w > l ? <StatusBadge tone="positive">Won {w}–{l}</StatusBadge>
                    : w < l ? <StatusBadge tone="negative">Lost {w}–{l}</StatusBadge>
                      : <StatusBadge tone="neutral">Split {w}–{l}</StatusBadge>;
            return (
              <Card
                key={first.day.day}
                eyebrow={midweek ? 'Midweek' : `Series · ${plural(games.length, 'game')}`}
                title={`${first.home ? 'vs' : 'at'} ${first.opponent?.def.school ?? '—'}`}
                trailing={status}
                flush
              >
                <List className="pb-list--inset" label={`Games against ${first.opponent?.def.school ?? 'this opponent'}`}>
                  {games.map((r) => {
                    const s = score(r)!;
                    const when = shortDate(year, r.day.day);
                    return (
                      <GameRow
                        key={r.day.day}
                        day={when.weekday}
                        date={when.date}
                        opponent={r.opponent?.def.school ?? '—'}
                        abbr={r.opponent?.def.abbr ?? ''}
                        home={r.home}
                        kind="Final"
                        result={{ win: s.won, score: `${s.us}–${s.them}` }}
                        onClick={open(r)}
                      />
                    );
                  })}
                </List>
              </Card>
            );
          })}
        </section>
      </main>

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

// ---------------------------------------------------------------------------
// The box score
// ---------------------------------------------------------------------------

/** A box score line, split into its columns: "2-4, 1 HR, 3 RBI" to { H: 2, AB: 4, HR: 1, RBI: 3 }. */
function columnsOf(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of line.split(', ')) {
    const hits = part.match(/^(\d+)-(\d+)$/);
    if (hits) { out.H = hits[1]!; out.AB = hits[2]!; continue; }
    const m = part.match(/^([\d.]+) ([A-Z0-9]+)$/);
    if (m) out[m[2]!] = m[1]!;
  }
  return out;
}

/** Innings in thirds, the way a box score means them: 6.2 is 6⅔. */
function thirds(ip: string | undefined): string {
  if (!ip) return '0';
  const [whole = '0', part = '0'] = ip.split('.');
  const frac = part === '1' ? '⅓' : part === '2' ? '⅔' : '';
  if (!frac) return whole;
  return whole === '0' ? frac : `${whole}${frac}`;
}

const BAT_COLUMNS: TableColumn[] = [
  { label: 'Batting', grow: true },
  { label: 'AB', title: 'At-bats', width: '28px', align: 'right' },
  { label: 'H', title: 'Hits', width: '26px', align: 'right', strong: true },
  { label: 'HR', title: 'Home runs', width: '28px', align: 'right' },
  { label: 'RBI', title: 'Runs batted in', width: '32px', align: 'right' },
  { label: 'BB', title: 'Walks', width: '28px', align: 'right' },
  { label: 'K', title: 'Strikeouts', width: '24px', align: 'right' },
];
const ARM_COLUMNS: TableColumn[] = [
  { label: 'Pitching', grow: true },
  { label: 'IP', title: 'Innings pitched', width: '34px', align: 'right', strong: true },
  { label: 'H', title: 'Hits allowed', width: '26px', align: 'right' },
  { label: 'R', title: 'Runs allowed', width: '26px', align: 'right' },
  { label: 'ER', title: 'Earned runs', width: '28px', align: 'right' },
  { label: 'BB', title: 'Walks', width: '28px', align: 'right' },
  { label: 'K', title: 'Strikeouts', width: '24px', align: 'right' },
];

/**
 * One game, in full: the line score, then either side's batting and pitching
 * with every column named, and every name opening that player's card. When
 * the game was recorded play by play, a replay steps through it.
 */
export function BoxScoreSheet(
  { box, season, onClose }:
  { box: BoxScore; season: SeasonState; onClose: () => void },
) {
  const openPlayer = useDynasty((s) => s.openPlayer);
  const year = useDynasty((s) => s.year);
  const userTeam = useDynasty((s) => s.userTeam);
  const home = season.teams[box.home];
  const away = season.teams[box.away];
  const frames = useMemo(() => (box.replay ? buildFrames(box.replay) : []), [box.replay]);
  const hasReplay = frames.length > 1;
  const [view, setView] = useState<'box' | 'replay'>('box');
  const [side, setSide] = useState<'away' | 'home'>(box.home === userTeam ? 'home' : 'away');
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || view !== 'replay' || frames.length < 2) return undefined;
    const id = window.setInterval(() => {
      setFrameIndex((current) => {
        if (current >= frames.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 850);
    return () => window.clearInterval(id);
  }, [playing, view, frames.length]);

  useEffect(() => {
    if (view !== 'replay') setPlaying(false);
  }, [view]);

  const current = frames[Math.min(frameIndex, Math.max(0, frames.length - 1))];
  const homeWon = box.homeRuns > box.awayRuns;
  const [winner, loser] = homeWon ? [home, away] : [away, home];
  const [wr, lr] = homeWon ? [box.homeRuns, box.awayRuns] : [box.awayRuns, box.homeRuns];
  const nameOf = (t: typeof home): string => t?.def.school ?? '—';

  // A name opens that player's card. The card is a page, not a sheet, so the
  // box score steps aside for it.
  const openMan = (id: BoxLine['id']): void => { onClose(); openPlayer(id); };

  const seekScore = (dir: -1 | 1): void => {
    let i = frameIndex + dir;
    while (i >= 0 && i < frames.length) {
      if (frames[i]?.scored) {
        setFrameIndex(i);
        setPlaying(false);
        return;
      }
      i += dir;
    }
  };

  const batting = side === 'away' ? box.awayBatting : box.homeBatting;
  const pitching = side === 'away' ? box.awayPitching : box.homePitching;
  const nameCell = (l: BoxLine) => (
    <span className="pb-teamcell">
      <span className="pb-teamcell__text">
        <span className="pb-teamcell__name"><span className="pb-ellipsis">{l.name}</span></span>
        <span className="pb-teamcell__sub">{boxSlotWords(l.slot)}</span>
      </span>
    </span>
  );

  return (
    <Sheet
      eyebrow={longDate(year, box.day)}
      title={`${nameOf(winner)} ${wr}, ${nameOf(loser)} ${lr}`}
      subtitle={box.innings !== 9 ? `Final · ${box.innings} innings` : 'Final'}
      onClose={onClose}
      tall
    >
      {hasReplay && (
        <SegmentedControl<'box' | 'replay'>
          label="Game view"
          value={view}
          onChange={setView}
          options={[
            { value: 'box', label: 'Box score' },
            { value: 'replay', label: 'Replay' },
          ]}
        />
      )}

      {view === 'replay' && current ? (
        <section className="pb-replay" aria-label="Game replay">
          <div className="pb-replay__board">
            <span className="pb-replay__team">
              <Crest abbr={away?.def.abbr ?? ''} size={28} />
              <span>{away?.def.nickname ?? away?.def.school}</span>
              <b>{current.awayRuns}</b>
            </span>
            <span className="pb-replay__inning">
              {current.half === 'top' ? 'Top' : 'Bottom'} of the {ordinal(current.inning)}
            </span>
            <span className="pb-replay__team">
              <Crest abbr={home?.def.abbr ?? ''} size={28} />
              <span>{home?.def.nickname ?? home?.def.school}</span>
              <b>{current.homeRuns}</b>
            </span>
          </div>
          <BaseState bases={current.bases} outs={Math.min(3, current.outs)} showText />
          <Callout
            tone={current.scored ? 'positive' : 'neutral'}
            icon={false}
            eyebrow={`Play ${frameIndex + 1} of ${frames.length}${current.text ? (cleanPlay(current.text).count ? ` · ${cleanPlay(current.text).count}` : '') : ''}`}
          >
            {current.text ? cleanPlay(current.text).text : 'The game is under way.'}
          </Callout>
          <input
            className="pb-range"
            aria-label="Replay position"
            type="range"
            min={0}
            max={frames.length - 1}
            value={frameIndex}
            onChange={(e) => {
              setPlaying(false);
              setFrameIndex(Number(e.target.value));
            }}
          />
          <div className="pb-replay__controls">
            <Button size="sm" variant="secondary" icon="arrow-left" onClick={() => seekScore(-1)}>Last run</Button>
            <Button
              size="sm"
              variant="primary"
              icon={playing ? 'pause' : 'play'}
              onClick={() => {
                if (frameIndex >= frames.length - 1) setFrameIndex(0);
                setPlaying((v) => !v);
              }}
            >{playing ? 'Pause' : 'Play'}</Button>
            <Button size="sm" variant="secondary" iconAfter="arrow-right" onClick={() => seekScore(1)}>Next run</Button>
          </div>
          <div className="pb-replay__controls">
            <Button size="sm" variant="quiet" onClick={() => { setPlaying(false); setFrameIndex(0); }}>Start</Button>
            <Button size="sm" variant="quiet" icon="chevron-left" onClick={() => { setPlaying(false); setFrameIndex((i) => Math.max(0, i - 1)); }}>Back a play</Button>
            <Button size="sm" variant="quiet" iconAfter="chevron-right" onClick={() => { setPlaying(false); setFrameIndex((i) => Math.min(frames.length - 1, i + 1)); }}>Next play</Button>
            <Button size="sm" variant="quiet" onClick={() => { setPlaying(false); setFrameIndex(frames.length - 1); }}>End</Button>
          </div>
        </section>
      ) : (
        <>
          {box.awayLine && box.homeLine && (
            <LineScore
              status="Final"
              innings={Math.max(box.awayLine.length, box.homeLine.length)}
              teams={[
                {
                  abbr: away?.def.abbr ?? 'AWY',
                  innings: box.awayLine,
                  r: box.awayRuns, h: box.awayHits ?? 0, e: box.awayErrors ?? 0,
                  you: box.away === userTeam,
                },
                {
                  abbr: home?.def.abbr ?? 'HOM',
                  // The home side does not bat in the ninth when it is already ahead.
                  innings: [...box.homeLine, ...(box.homeLine.length < box.awayLine.length ? ['X'] : [])],
                  r: box.homeRuns, h: box.homeHits ?? 0, e: box.homeErrors ?? 0,
                  you: box.home === userTeam,
                },
              ]}
            />
          )}
          <SegmentedControl<'away' | 'home'>
            label="Which team"
            value={side}
            onChange={setSide}
            options={[
              { value: 'away', label: away?.def.nickname ?? away?.def.school ?? 'Away' },
              { value: 'home', label: home?.def.nickname ?? home?.def.school ?? 'Home' },
            ]}
          />
          <Table
            dense
            label="Batting"
            columns={BAT_COLUMNS}
            rows={batting.map((l) => {
              const c = columnsOf(l.line);
              return {
                key: `${l.id}-${l.slot}`,
                onClick: () => openMan(l.id),
                cells: [nameCell(l), c.AB ?? '0', c.H ?? '0', c.HR ?? '0', c.RBI ?? '0', c.BB ?? '0', c.K ?? '0'],
              };
            })}
            caption="AB at-bats · H hits · HR home runs · RBI runs batted in · BB walks · K strikeouts. Tap a name for his card."
          />
          <Table
            dense
            label="Pitching"
            columns={ARM_COLUMNS}
            rows={pitching.map((l) => {
              const c = columnsOf(l.line);
              return {
                key: `${l.id}-arm`,
                onClick: () => openMan(l.id),
                cells: [nameCell(l), thirds(c.IP), c.H ?? '0', c.R ?? '0', c.ER ?? '0', c.BB ?? '0', c.K ?? '0'],
              };
            })}
            caption="IP innings pitched, in thirds (6⅔ is six and two thirds) · H hits · R runs · ER earned runs · BB walks · K strikeouts."
          />
        </>
      )}
    </Sheet>
  );
}
