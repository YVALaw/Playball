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

/**
 * A column heading, off the round's own name.
 *
 * These used to be two hardcoded arrays, which was fine while every tournament
 * in the game had exactly three winners rounds and four losers rounds. A
 * ten-team bracket has four and five, and the extra column came out as "W4".
 * The engine names each round when it builds it — the same string the log and
 * the stake line use — so the map reads that and abbreviates it for a heading
 * rather than keeping a second, shorter list that can fall out of step.
 */
const SHORT: Record<string, string> = {
  'Play-in': 'PLAY-IN',
  'Opening round': 'OPENING',
  'Winners semifinal': 'SEMIS',
  'Winners final': 'W FINAL',
  'Elimination round': 'ELIM 1',
  'Losers round 2': 'ELIM 2',
  'Losers round 3': 'ELIM 3',
  'Losers semifinal': 'L SEMI',
  'Losers final': 'L FINAL',
};

const headingFor = (slots: DESlot[], fallback: string): string => {
  const name = slots[0]?.name;
  return (name && SHORT[name]) ?? fallback;
};

export function DoubleElimMap(
  { de, view, abbr, userTeam, onOpen }:
  {
    de: DECols;
    view: 'winners' | 'losers';
    abbr: (i: number) => string;
    userTeam: number;
    /**
     * Open a played game.
     *
     * Asked for more than once: a bracket where every game is a frozen score is
     * a table with corners on it. The map does not know what opening one means
     * — that is the screen's business — so it hands back the slot and lets the
     * caller decide whether there is a box score to show.
     */
    onOpen?: (s: DESlot) => void;
  },
) {
  const columns: { title: string; slots: DESlot[] }[] = view === 'winners'
    ? [
      ...de.winners.map((r, i) => ({ title: headingFor(r, `W${i + 1}`), slots: r })),
      { title: 'FINAL', slots: finalsToShow(de.final) },
    ]
    : [
      ...de.losers.map((r, i) => ({ title: headingFor(r, `L${i + 1}`), slots: r })),
      { title: 'FINAL', slots: finalsToShow(de.final) },
    ];

  /*
    The half you are looking at, keyed so a change is a change.

    The screen moves you to the losers side on its own now, the moment you take
    a loss, and a silent swap of one column layout for another reads as a
    glitch rather than a move. Keying the map on the view makes React tear the
    old one down and mount the new, which is all `card-in` needs to run --
    about a third of a second, and it is off entirely for anybody who has asked
    the system to stop moving things.
  */
  return (
    <div
      key={view}
      className="card-in"
      style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
    >
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
                s={s} abbr={abbr} userTeam={userTeam} onOpen={onOpen} />
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
  { s, abbr, userTeam, onOpen }:
  {
    s: DESlot; abbr: (i: number) => string; userTeam: number;
    onOpen?: (s: DESlot) => void;
  },
) {
  const mine = s.a === userTeam || s.b === userTeam;
  /*
    The one box worth keeping on screen.

    Marked in the DOM rather than reported upward through a ref, because the
    screen that needs it is three components above this one and only wants it
    for a moment -- after the winners/losers toggle swaps the map out from under
    the reader. See `Postseason.tsx`, `keepYouCentred`.
  */
  const youAnchor = mine
    ? (s.winner === null ? { 'data-you': '', 'data-you-live': '' } : { 'data-you': '' })
    : {};
  // Only a game that has actually been played is worth opening. A TBD slot
  // that reacted to a tap would be promising something it has not got.
  const open = s.game && onOpen ? () => onOpen(s) : undefined;
  return (
    <div
      {...youAnchor}
      onClick={open}
      role={open ? 'button' : undefined}
      tabIndex={open ? 0 : undefined}
      onKeyDown={open ? (e) => { if (e.key === 'Enter' || e.key === ' ') open(); } : undefined}
      className={open ? 'tap' : undefined}
      style={{
      border: mine ? '1.5px solid var(--you)' : '1px solid var(--faint)',
      background: 'var(--paper)',
      boxShadow: mine ? '0 1px 0 rgba(47,79,122,.25)' : 'none',
      cursor: open ? 'pointer' : 'default',
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
        font: "600 calc(8px * var(--ts)) var(--mono)", color: 'var(--dim)', minWidth: 10,
      }}>{seed > 0 ? seed : ''}</span>
      <span style={{
        flex: 1, font: `${won ? 700 : 500} calc(10.5px * var(--ts)) var(--mono)`,
        letterSpacing: '.04em',
        color: team === null ? 'rgba(var(--ink-rgb), .3)' : tint,
        whiteSpace: 'nowrap',
      }}>
        {team === null ? 'TBD' : abbr(team)}
        {team === userTeam ? ' ★' : ''}
      </span>
      <span style={{
        font: `${won ? 700 : 400} calc(10px * var(--ts)) var(--mono)`,
        color: won ? 'var(--ink)' : 'var(--dim)',
      }}>{runs !== null ? runs : ''}</span>
    </div>
  );
}
