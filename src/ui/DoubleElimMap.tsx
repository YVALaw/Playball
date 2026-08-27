// DoubleElimMap.tsx
// One double-elimination tournament, one view at a time.
//
// The winners bracket and the losers bracket are never on screen together —
// that was the unreadable map that got double elimination thrown out of the
// game the first time. Each view is an ordinary left-to-right column layout:
// small matchup cards, seed numbers, the school's own colour down each row,
// and the champion's card wearing the win. The container scrolls horizontally
// on its own; the page never does.
//
// Draws either a live `DoubleElim` or the slots kept on a finished result —
// the two carry the same `DESlot` arrays, which is the point of keeping them.

import type { DESlot } from '../engine/doubleElim.js';
import { teamColour } from './Avatar.js';

export interface DECols {
  winners: DESlot[][];
  losers: DESlot[][];
  final: DESlot[];
}

const W_TITLES = ['OPENING', 'SEMIS', 'W FINAL'];
const L_TITLES = ['ELIM 1', 'ELIM 2', 'L SEMI', 'L FINAL'];

export function DoubleElimMap(
  { de, view, abbr, userTeam }:
  {
    de: DECols;
    view: 'winners' | 'losers';
    abbr: (i: number) => string;
    userTeam: number;
  },
) {
  const columns: { title: string; slots: DESlot[] }[] = view === 'winners'
    ? [
      ...de.winners.map((r, i) => ({ title: W_TITLES[i] ?? `W${i + 1}`, slots: r })),
      { title: 'FINAL', slots: finalsToShow(de.final) },
    ]
    : [
      ...de.losers.map((r, i) => ({ title: L_TITLES[i] ?? `L${i + 1}`, slots: r })),
      { title: 'FINAL', slots: finalsToShow(de.final) },
    ];

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{
        display: 'flex', gap: 10, padding: '4px 14px 8px', minWidth: 'min-content',
      }}>
        {columns.map((col, ci) => (
          <div key={ci} style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'space-around',
            gap: 8, minWidth: 104,
          }}>
            <div className="label" style={{ textAlign: 'center' }}>{col.title}</div>
            {col.slots.map((s) => (
              <SlotCard key={`${s.side}${s.round}${s.slot}`}
                s={s} abbr={abbr} userTeam={userTeam} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The reset only appears once it exists; an empty column says nothing. */
function finalsToShow(final: DESlot[]): DESlot[] {
  const reset = final[1];
  return reset && reset.a !== null ? final : final.slice(0, 1);
}

function SlotCard(
  { s, abbr, userTeam }:
  { s: DESlot; abbr: (i: number) => string; userTeam: number },
) {
  const mine = s.a === userTeam || s.b === userTeam;
  return (
    <div style={{
      border: mine ? '1.5px solid var(--clay)' : '1px solid var(--faint)',
      background: 'var(--paper)',
      boxShadow: mine ? '0 1px 0 rgba(168,68,42,.25)' : 'none',
    }}>
      <Row team={s.a} seed={s.aSeed} s={s} abbr={abbr} userTeam={userTeam} top />
      <Row team={s.b} seed={s.bSeed} s={s} abbr={abbr} userTeam={userTeam} />
    </div>
  );
}

function Row(
  { team, seed, s, abbr, userTeam, top }:
  {
    team: number | null; seed: number; s: DESlot;
    abbr: (i: number) => string; userTeam: number; top?: boolean;
  },
) {
  const won = team !== null && s.winner === team;
  const lost = team !== null && s.winner !== null && s.winner !== team;
  const runs = s.game && team !== null
    ? (s.game.home === team ? s.game.homeRuns : s.game.awayRuns)
    : null;
  const tint = team !== null ? teamColour(abbr(team)) : 'var(--faint)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '4px 6px',
      borderBottom: top ? '1px solid var(--hairline)' : 'none',
      borderLeft: `3px solid ${tint}`,
      opacity: lost ? 0.5 : 1,
      background: won ? `${tint}1c` : 'transparent',
    }}>
      <span style={{
        font: "600 8px var(--mono)", color: 'var(--dim)', minWidth: 10,
      }}>{seed > 0 ? seed : ''}</span>
      <span style={{
        flex: 1, font: `${won ? 700 : 500} 10.5px var(--mono)`,
        letterSpacing: '.04em',
        color: team === null ? 'rgba(28,36,48,.3)' : tint,
        whiteSpace: 'nowrap',
      }}>
        {team === null ? 'TBD' : abbr(team)}
        {team === userTeam ? ' ★' : ''}
      </span>
      <span style={{
        font: `${won ? 700 : 400} 10px var(--mono)`,
        color: won ? 'var(--ink)' : 'var(--dim)',
      }}>{runs !== null ? runs : ''}</span>
    </div>
  );
}
