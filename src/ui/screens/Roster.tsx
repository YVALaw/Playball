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
import { overallOf, naturalPos } from '../../engine/ratings.js';
import { potentialGrade } from '../../engine/scouting.js';
import { battingAverage, era, inningsPitched } from '../../engine/season.js';
import { pct } from '../format.js';
import type { Hitter, Pitcher, Player } from '../../engine/types.js';

type Mode = 'all' | 'bat' | 'arm';

/** The order a lineup card thinks in; pitcher roles ride at the end. */
const SLOT_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

// A DH reads as the position he actually plays — the DH is a lineup slot, not
// a man. The lineup screen still shows DH where he bats; this list shows who
// he is. See `naturalPos`.
const slotOf = (p: Player): string =>
  p.type === 'pitcher' ? (p as Pitcher).role : naturalPos(p as Hitter);

export function Roster() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const openPlayer = useDynasty((s) => s.openPlayer);
  const [mode, setMode] = useState<Mode>('all');
  /*
    The filters, both optional and both toggles. Reported from testing: "in
    teams in the roster we need a filter so we can filter players like if i
    want to see players in a position or year." One class, one spot, or both
    at once; tapping the active chip clears it.
  */
  const [yearF, setYearF] = useState<string | null>(null);
  const [posF, setPosF] = useState<string | null>(null);
  /*
    And behind an icon, because two labelled selects is a whole row of screen
    standing above the list they filter.

    Reported: the filters were far too big and eating the space the roster pass
    was trying to win back. They were also the *second* attempt — nineteen
    wrapping chips came first — and the lesson both times is that filtering is
    something you do occasionally to a list you read constantly. So the list
    keeps the room and the controls come to it, with the button carrying a mark
    when a filter is on so a filtered roster can never look like a short one.
  */
  const [filterSheet, setFilterSheet] = useState(false);
  void version;

  if (!season || !team) return null;

  const hittersAll = [...team.team.lineup, ...team.team.bench];
  const armsAll = [...team.team.rotation, ...team.team.bullpen];

  const keep = (p: Player): boolean =>
    (yearF === null || p.classYear === yearF)
    && (posF === null || slotOf(p) === posF);

  const hitters = hittersAll.filter(keep);
  const arms = armsAll.filter(keep);
  const everybody: Player[] = [...hitters, ...arms]
    .sort((a, b) => overallOf(b) - overallOf(a));

  // Only spots somebody actually plays get a chip, in scorebook order.
  const slots = [...new Set([...hittersAll, ...armsAll].map(slotOf))]
    .sort((a, b) => {
      const ai = SLOT_ORDER.indexOf(a); const bi = SLOT_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
    });

  const filtered = yearF !== null || posF !== null;
  const shown = mode === 'all' ? everybody.length : mode === 'bat' ? hitters.length : arms.length;

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">
              ROSTER · {filtered
                ? `${shown} OF ${hittersAll.length + armsAll.length}`
                : `${hittersAll.length + armsAll.length} PLAYERS`}
            </div>
            <div style={{
              font: "800 calc(21px * var(--ts))/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
              color: teamColour(team.def.abbr),
            }}>{team.def.school}</div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <Chip on={mode === 'all'} onClick={() => setMode('all')}>ALL</Chip>
            <Chip on={mode === 'bat'} onClick={() => setMode('bat')}>HITTERS</Chip>
            <Chip on={mode === 'arm'} onClick={() => setMode('arm')}>PITCHERS</Chip>
            <div style={{ flex: 1 }} />
            {/* The filters, one tap away instead of a row of screen away. The
                dot is not decoration: a filtered roster and a short roster
                look identical, and the count in the header only says so if you
                read it. */}
            <button
              onClick={() => setFilterSheet(true)}
              aria-label="Filter the roster"
              className="tap"
              style={{
                minHeight: 36, padding: '8px 12px',
                background: filtered ? 'var(--ink)' : 'transparent',
                border: `1px solid ${filtered ? 'var(--ink)' : 'rgba(28,36,48,.25)'}`,
                color: filtered ? 'var(--cream)' : 'rgba(28,36,48,.6)',
                font: "600 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.14em',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              FILTER
              {filtered && (
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', background: 'var(--clay)',
                }} />
              )}
            </button>
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
        {shown === 0 && (
          <div style={{
            padding: '16px 12px', textAlign: 'center',
            font: "400 calc(12px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
          }}>
            Nobody fits that filter. Whole roster, no such man.
          </div>
        )}
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
                  slotOf(p),
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

    </div>
    {filterSheet && (
      <>
        <div
          className="sheet-scrim"
          onClick={() => setFilterSheet(false)}
          style={{
            position: 'absolute', inset: 0, zIndex: 40,
            background: 'rgba(28,36,48,.45)',
          }}
        />
        <div className="sheet" style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 41,
          background: 'var(--field)', borderTop: '3px solid var(--clay)',
          padding: '14px 14px calc(16px + env(safe-area-inset-bottom))',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            borderBottom: '2px solid var(--ink)', paddingBottom: 6, marginBottom: 12,
          }}>
            <span className="label">FILTER THE ROSTER</span>
            {filtered && (
              <button
                onClick={() => { setYearF(null); setPosF(null); }}
                className="tap"
                style={{
                  font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.14em',
                  color: 'var(--clay)',
                }}
              >CLEAR</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Select
              label="YEAR"
              value={yearF}
              options={['FR', 'SO', 'JR', 'SR']}
              onChange={setYearF}
            />
            <Select
              label="POS"
              value={posF}
              options={slots}
              onChange={setPosF}
            />
          </div>
          <button
            onClick={() => setFilterSheet(false)}
            className="tap"
            style={{
              width: '100%', marginTop: 14, padding: '12px 0', minHeight: 44,
              background: 'var(--ink)', color: 'var(--cream)',
              font: "700 calc(11px * var(--ts)) var(--mono)", letterSpacing: '.14em',
            }}
          >SHOW {shown} {shown === 1 ? 'PLAYER' : 'PLAYERS'}</button>
        </div>
      </>
    )}
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
        font: "600 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.14em',
      }}
    >{children}</button>
  );
}

/**
 * One filter, one line.
 *
 * A native `<select>` on purpose: the platform picker is a better list than
 * anything drawn here, it costs one row of the screen whatever the option
 * count, and it is already the control a phone user reaches for. ALL is the
 * empty value rather than a separate clear button.
 */
function Select(
  { label, value, options, onChange }:
  {
    label: string;
    value: string | null;
    options: readonly string[];
    onChange: (v: string | null) => void;
  },
) {
  const on = value !== null;
  return (
    <label style={{ flex: 1, minWidth: 0, display: 'block' }}>
      <span className="label" style={{ display: 'block', marginBottom: 3 }}>{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        style={{
          width: '100%', minHeight: 34, padding: '6px 8px',
          background: on ? 'var(--ink)' : 'var(--paper)',
          border: `1px solid ${on ? 'var(--ink)' : 'rgba(28,36,48,.25)'}`,
          borderRadius: 0,
          color: on ? 'var(--cream)' : 'var(--ink)',
          // 16px is the floor on anything a phone can focus, or the browser
          // zooms the page in and stays there. Same rule as the text inputs.
          font: "600 calc(16px * var(--ts)) var(--mono)",
          appearance: 'none', WebkitAppearance: 'none',
        }}
      >
        <option value="">ALL</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
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
          font: `400 calc(${i === 1 ? 12 : 11}px * var(--ts)) ${i === 1 ? 'var(--body)' : 'var(--mono)'}`,
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
        naturalPos(p),
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
