// Roster.tsx
// Your players. This is the screen where the dynasty becomes legible — class
// years show you who is about to leave, and the gap between overall and
// potential shows you who is worth waiting on.
//
// Three views of one list: everybody, the bats, the arms. The glove work that
// used to be a third tab here lives with the rest of the numbers on the STATS
// screen now — fielding is a statistic, not a separate species of player.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { Avatar, teamColour } from '../Avatar.js';
import { FixedHeader } from '../Sticky.js';
import { FirstVisit } from '../Tutorial.js';
import { overallOf } from '../../engine/ratings.js';
import { potentialGrade } from '../../engine/scouting.js';
import { battingAverage, era, inningsPitched } from '../../engine/season.js';
import { pct } from '../format.js';
import type { Hitter, Pitcher, Player } from '../../engine/types.js';

type Mode = 'all' | 'bat' | 'arm';

export function Roster() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const openPlayer = useDynasty((s) => s.openPlayer);
  const [mode, setMode] = useState<Mode>('all');
  void version;

  if (!season || !team) return null;

  const hitters = [...team.team.lineup, ...team.team.bench];
  const arms = [...team.team.rotation, ...team.team.bullpen];
  const everybody: Player[] = [...hitters, ...arms]
    .sort((a, b) => overallOf(b) - overallOf(a));

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">ROSTER · {hitters.length + arms.length} PLAYERS</div>
            <div style={{
              font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
              color: teamColour(team.def.abbr),
            }}>{team.def.school}</div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <Chip on={mode === 'all'} onClick={() => setMode('all')}>ALL</Chip>
            <Chip on={mode === 'bat'} onClick={() => setMode('bat')}>HITTERS</Chip>
            <Chip on={mode === 'arm'} onClick={() => setMode('arm')}>PITCHERS</Chip>
          </div>
        </div>
      }
    >
    <div style={{ padding: '10px 14px 16px' }}>
      <FirstVisit id="roster" />
      <div style={{
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Head mode={mode} />
        {mode === 'all'
          ? everybody.map((p) => (
              <Cells
                key={p.id}
                grid={ALL_GRID}
                highlight={p.type === 'hitter'
                  ? team.team.lineup.includes(p as Hitter)
                  : team.team.rotation.includes(p as Pitcher)}
                onClick={() => openPlayer(p.id)}
                playerId={p.id}
                teamAbbr={team.def.abbr}
                values={[
                  p.name,
                  p.type === 'pitcher' ? (p as Pitcher).role : p.pos,
                  p.classYear,
                  String(overallOf(p)),
                  potentialGrade(p.potential),
                ]}
              />
            ))
          : mode === 'bat'
          ? hitters
              .map((p) => ({ p, line: season.batting.get(p.id) }))
              .sort((a, b) => overallOf(b.p) - overallOf(a.p))
              .map(({ p, line }) => (
                <HitterRow
                  key={p.id}
                  abbr={team.def.abbr}
                  p={p}
                  avg={line ? battingAverage(line) : 0}
                  hr={line?.hr ?? 0}
                  played={(line?.ab ?? 0) > 0}
                  starter={team.team.lineup.includes(p)}
                  onClick={() => openPlayer(p.id)}
                />
              ))
          : arms
              .map((p) => ({ p, line: season.pitching.get(p.id) }))
              .sort((a, b) => overallOf(b.p) - overallOf(a.p))
              .map(({ p, line }) => (
                <PitcherRow
                  key={p.id}
                  abbr={team.def.abbr}
                  p={p}
                  earned={line && line.outs > 0 ? era(line) : null}
                  ip={line ? inningsPitched(line) : 0}
                  rotation={team.team.rotation.includes(p)}
                  onClick={() => openPlayer(p.id)}
                />
              ))}
      </div>

      <div style={{ marginTop: 10, font: "400 11px/1.5 var(--body)", color: 'var(--dim)' }}>
        <strong>OVR</strong> is where a player is now, <strong>POT</strong> a letter for where he could
        end up. Seniors leave in June whatever happens; juniors leave if the draft wants them.
      </div>
    </div>
    </FixedHeader>
  );
}

function Chip(
  { on, onClick, children }: { on: boolean; onClick: () => void; children: string },
) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px', minHeight: 36,
        background: on ? 'var(--clay)' : 'transparent',
        border: `1px solid ${on ? 'var(--clay)' : 'rgba(28,36,48,.25)'}`,
        color: on ? 'var(--cream)' : 'rgba(28,36,48,.6)',
        font: "600 10px var(--mono)", letterSpacing: '.14em',
      }}
    >{children}</button>
  );
}

const GRID = '30px 1fr 30px 26px 30px 30px 44px 30px';
/** The everybody view: the five columns that describe any player. */
const ALL_GRID = '30px 1fr 34px 26px 34px 34px';

function Head({ mode }: { mode: Mode }) {
  const cols = mode === 'bat'
    ? ['', 'PLAYER', 'POS', 'YR', 'OVR', 'POT', 'AVG', 'HR']
    : mode === 'arm'
      ? ['', 'PLAYER', 'ROL', 'YR', 'OVR', 'POT', 'ERA', 'IP']
      : ['', 'PLAYER', 'POS', 'YR', 'OVR', 'POT'];
  return (
    <div style={{
      // Pinned to the top of the scroller. The title and the hitters/pitchers
      // switch already stay put; the row that says which column is AVG and which
      // is HR belongs with them, and it is the only part of the table you cannot
      // work out from the numbers themselves.
      position: 'sticky', top: 0, zIndex: 1, background: 'var(--paper)',
      display: 'grid', gridTemplateColumns: mode === 'all' ? ALL_GRID : GRID, gap: 4,
      padding: '7px 10px', borderBottom: '1px solid var(--hairline)',
    }}>
      {cols.map((c, i) => (
        <span key={i} className="label" style={{ textAlign: i > 1 ? 'right' : 'left' }}>{c}</span>
      ))}
    </div>
  );
}

/** Seniors are on their way out. Worth seeing at a glance, so they get the accent. */
const classColor = (cl: string): string => (cl === 'SR' ? 'var(--clay)' : 'var(--ink)');

function Cells(
  { values, highlight, onClick, playerId, teamAbbr, grid = GRID }:
  {
    values: string[]; highlight?: boolean; onClick?: () => void;
    playerId?: string; teamAbbr?: string; grid?: string;
  },
) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'grid',
        gridTemplateColumns: grid,
        gap: 4,
        alignItems: 'center',
        padding: '7px 10px',
        borderBottom: '1px solid var(--hairline)',
        background: highlight ? 'rgba(168,68,42,.05)' : 'transparent',
      }}
    >
      {/*
        The first column was a bullet marking a starter. It is a face now, with
        the starter's marker folded into the row highlight — a roster of names
        reads as a spreadsheet, and the point of a portrait is that a player
        becomes somebody you recognise across four years.
      */}
      {playerId
        ? <Avatar id={playerId} team={teamAbbr} size={26} />
        : <span />}
      {/* `i` starts at 1 because the avatar above occupies the grid's first
          column; the style rules below are written against grid position. */}
      {values.map((v0, i0) => { const i = i0 + 1; const v = v0; return (
        <span key={i} style={{
          font: `400 ${i === 1 ? 12 : 11}px ${i === 1 ? 'var(--body)' : 'var(--mono)'}`,
          textAlign: i > 1 ? 'right' : 'left',
          color: i === 3 ? classColor(v) : 'var(--ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{v}</span>
      ); })}
    </button>
  );
}

function HitterRow(
  { p, avg, hr, played, starter, onClick, abbr }:
  {
    p: Hitter; avg: number; hr: number; played: boolean; starter: boolean;
    onClick: () => void; abbr?: string;
  },
) {
  return (
    <Cells
      highlight={starter}
      onClick={onClick}
      playerId={p.id}
      teamAbbr={abbr}
      values={[
        p.name,
        p.pos,
        p.classYear,
        String(overallOf(p)),
        potentialGrade(p.potential),
        played ? pct(avg) : '—',
        String(hr),
      ]}
    />
  );
}

function PitcherRow(
  { p, earned, ip, rotation, onClick, abbr }:
  {
    p: Pitcher; earned: number | null; ip: number; rotation: boolean;
    onClick: () => void; abbr?: string;
  },
) {
  return (
    <Cells
      highlight={rotation}
      onClick={onClick}
      playerId={p.id}
      teamAbbr={abbr}
      values={[
        p.name,
        p.role,
        p.classYear,
        String(overallOf(p)),
        potentialGrade(p.potential),
        earned === null ? '—' : earned.toFixed(2),
        ip.toFixed(1),
      ]}
    />
  );
}
