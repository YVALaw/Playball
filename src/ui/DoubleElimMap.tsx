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

import type { CSSProperties } from 'react';
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
  { de, view, abbr, userTeam, onOpen, showFinal = true }:
  {
    de: DECols;
    view: 'winners' | 'losers';
    abbr: (i: number) => string;
    userTeam: number;
    /**
     * Whether this instance draws the FINAL column. The one-map layout
     * stacks a winners view over a losers view, and the final belongs to
     * the pair — drawn once, on top — not to each half twice.
     */
    showFinal?: boolean;
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
  const finalCol = showFinal
    ? [{ title: 'FINAL', slots: finalsToShow(de.final) }]
    : [];
  const columns: { title: string; slots: DESlot[] }[] = view === 'winners'
    ? [
      ...de.winners.map((r, i) => ({ title: headingFor(r, `W${i + 1}`), slots: r })),
      ...finalCol,
    ]
    : [
      ...de.losers.map((r, i) => ({ title: headingFor(r, `L${i + 1}`), slots: r })),
      ...finalCol,
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
    <div key={view} className="card-in bracket-map-scroll">
      <div className="bracket-map-track">
        {columns.map((col, ci) => (
          <section className="bracket-map-column" key={`${view}-${ci}`}>
            <header className="bracket-column-head">
              <small>{view === 'winners' ? 'WINNERS ROAD' : 'ELIMINATION ROAD'}</small>
              <strong>{col.title}</strong>
            </header>
            <div className="bracket-column-slots">
              {col.slots.map((slot) => (
                <SlotCard
                  key={`${slot.side}${slot.round}${slot.slot}`}
                  s={slot}
                  abbr={abbr}
                  userTeam={userTeam}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </section>
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
      className={`bracket-slot-card${mine ? ' is-yours' : ''}${open ? ' tap' : ''}${s.winner !== null ? ' is-final' : ' is-live'}`}
    >
      <Row team={s.a} seed={s.aSeed} s={s} abbr={abbr} userTeam={userTeam} />
      <Row team={s.b} seed={s.bSeed} s={s} abbr={abbr} userTeam={userTeam} />
      {mine && <span className="bracket-you-tag">YOU</span>}
    </div>
  );
}

function Row(
  { team, seed, s, abbr, userTeam }:
  {
    team: number | null; seed: number; s: DESlot;
    abbr: (i: number) => string; userTeam: number;
  },
) {
  const won = team !== null && s.winner === team;
  const lost = team !== null && s.winner !== null && s.winner !== team;
  const runs = s.game && team !== null
    ? (s.game.home === team ? s.game.homeRuns : s.game.awayRuns)
    : null;
  const tint = team !== null ? teamColour(abbr(team)) : 'var(--faint)';
  return (
    <div
      className={`bracket-team-line${won ? ' is-winner' : ''}${lost ? ' is-loser' : ''}${team === userTeam ? ' is-user' : ''}`}
      style={{ '--team-accent': tint } as CSSProperties}
    >
      <span className="bracket-seed">{seed > 0 ? seed : ''}</span>
      <span className="bracket-team-name">
        {team === null ? 'TBD' : abbr(team)}
        {team === userTeam ? ' ★' : ''}
      </span>
      <span className="bracket-score">{runs !== null ? runs : ''}</span>
    </div>
  );
}
