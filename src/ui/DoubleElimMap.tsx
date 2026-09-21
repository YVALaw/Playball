// DoubleElimMap.tsx
// One side of a double-elimination tournament, as a bracket you can read.
//
// Columns left to right, one per round, each headed with the side it belongs
// to and the round's own name in words. Every game is a match card: both
// schools with their seeds, the score once it is played, a check on the
// winner, and a You tag on your own team. The track scrolls sideways on its
// own; the page never does. A played game opens its box score.
//
// Draws either a live `DoubleElim` or the slots kept on a finished result —
// the two carry the same `DESlot` arrays, which is the point of keeping them.

import type { DESlot } from '../engine/doubleElim.js';
import { BracketMatch, type BracketTeam } from './components/ui/index.js';
import { roundWords } from './words.js';

export interface DECols {
  winners: DESlot[][];
  losers: DESlot[][];
  final: DESlot[];
}

/** A column's heading, off the round's own name as the engine wrote it. */
const headingFor = (slots: DESlot[], fallback: string): string => {
  const name = slots[0]?.name;
  return name ? roundWords(name) : fallback;
};

export function DoubleElimMap(
  { de, view, abbr, name, userTeam, onOpen, showFinal = true }:
  {
    de: DECols;
    view: 'winners' | 'losers';
    abbr: (i: number) => string;
    /** The school's name for a card; the code is the fallback. */
    name?: (i: number) => string;
    userTeam: number;
    /**
     * Whether this map draws the championship column. When both sides are
     * stacked, the championship belongs to the pair and is drawn once.
     */
    showFinal?: boolean;
    /** Open a played game. The map hands back the slot; the screen decides. */
    onOpen?: (s: DESlot) => void;
  },
) {
  const finalCol = showFinal
    ? [{ title: 'Championship', side: 'Championship', slots: finalsToShow(de.final) }]
    : [];
  const side = view === 'winners' ? 'Winners side' : 'Elimination side';
  const columns: { title: string; side: string; slots: DESlot[] }[] = view === 'winners'
    ? [
      ...de.winners.map((r, i) => ({ title: headingFor(r, `Round ${i + 1}`), side, slots: r })),
      ...finalCol,
    ]
    : [
      ...de.losers.map((r, i) => ({ title: headingFor(r, `Elimination round ${i + 1}`), side, slots: r })),
      ...finalCol,
    ];

  return (
    <div className="pb-bracket" role="group" aria-label={side}>
      <div className="pb-bracket__track">
        {columns.map((col, ci) => (
          <section className="pb-bracket__col" key={`${view}-${ci}`} aria-label={`${col.side}: ${col.title}`}>
            <header className="pb-bracket__head">
              <span className="pb-eyebrow">{col.side}</span>
              <span className="pb-bracket__title">{col.title}</span>
            </header>
            <div className="pb-bracket__slots">
              {col.slots.map((slot) => (
                <SlotMatch
                  key={`${slot.side}${slot.round}${slot.slot}`}
                  s={slot}
                  abbr={abbr}
                  name={name ?? abbr}
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

/** The deciding game only appears once it exists; an empty column says nothing. */
function finalsToShow(final: DESlot[]): DESlot[] {
  const reset = final[1];
  return reset && reset.a !== null ? final : final.slice(0, 1);
}

function SlotMatch(
  { s, abbr, name, userTeam, onOpen }:
  {
    s: DESlot; abbr: (i: number) => string; name: (i: number) => string; userTeam: number;
    onOpen?: (s: DESlot) => void;
  },
) {
  const mine = s.a === userTeam || s.b === userTeam;
  // Marked in the DOM so the screen can bring your game into view.
  const youAnchor = mine
    ? (s.winner === null ? { 'data-you': '', 'data-you-live': '' } : { 'data-you': '' })
    : {};
  // Only a game that has been played is worth opening.
  const open = s.game && onOpen ? () => onOpen(s) : undefined;
  const team = (t: number | null, seed: number): BracketTeam => ({
    abbr: t !== null ? abbr(t) : '',
    name: t !== null ? name(t) : 'To be decided',
    seed: seed > 0 ? seed : undefined,
    score: s.game && t !== null ? (s.game.home === t ? s.game.homeRuns : s.game.awayRuns) : undefined,
    winner: t !== null && s.winner === t,
    out: t !== null && s.winner !== null && s.winner !== t,
    you: t === userTeam,
  });
  const ready = s.a !== null && s.b !== null;
  const status = s.winner !== null ? 'Final' : mine && ready ? 'Your game' : undefined;
  return (
    <div {...youAnchor} className="pb-bracket__slot">
      <BracketMatch
        teams={[team(s.a, s.aSeed), team(s.b, s.bSeed)]}
        status={status}
        live={mine && ready && s.winner === null}
        onClick={open}
      />
    </div>
  );
}
