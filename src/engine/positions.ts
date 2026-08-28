// positions.ts
// Where a man can actually play, and what it costs to move him.
//
// Stage 8. Until now a player had one position and that was the whole model: a
// shortstop was a shortstop, and the question "could he catch?" had no answer
// because nothing could ask it.
//
// ---------------------------------------------------------------------------
// The spectrum is the model
// ---------------------------------------------------------------------------
//
// Baseball already has the answer and has had it for fifty years. Positions sit
// on a defensive spectrum from easiest to hardest, and the rule is that moving
// *down* it is close to free while moving *up* it is expensive:
//
//     DH -- 1B -- LF -- RF -- 3B -- CF -- 2B -- SS -- C
//
// A shortstop can play second tomorrow. A first baseman cannot play short in
// his career. So the penalty is a function of how far up the ladder you are
// asking a man to climb, and it is zero in the other direction -- which is why
// a coach moving an ageing shortstop to third is a sensible piece of management and
// moving his first baseman to short is not.
//
// Catcher is deliberately not on the same scale as everything else. It is the
// one position in the sport that is a separate trade rather than a harder
// version of the same one, and asking an outfielder to catch should read on the
// screen as the mistake it is.
//
// ---------------------------------------------------------------------------
// Nothing is stored, and that is the point
// ---------------------------------------------------------------------------
//
// Secondary positions are *derived* from the position a man already has, not
// generated onto him. That is not tidiness: adding a field to player generation
// would move every random draw after it, which moves every number in the game
// and breaks every golden. The DH already works this way -- `playedPosition`
// reads his glove rather than trusting the label -- and this follows it.
//
// The consequence for calibration is the good one. Rosters are built to fit
// positions, so nobody is played out of position today and this changes
// nothing until a depth chart lets it happen.

import type { Hitter, Pitcher, Position } from './types.js';

/**
 * The defensive spectrum, hardest last.
 *
 * Read as a ladder rather than as a score -- only the *gap* between two rungs
 * is ever used, so the absolute numbers mean nothing on their own and can be
 * respaced without anybody downstream caring.
 */
const LADDER: Record<Position, number> = {
  DH: 0,
  '1B': 1,
  LF: 2,
  RF: 3,
  '3B': 4,
  CF: 5,
  '2B': 6,
  SS: 7,
  C: 9,
  P: 9,
};

/**
 * What one rung costs, in points off his defensive ratings.
 *
 * Judgement rather than arithmetic, and deliberately steep enough to be felt: a
 * corner outfielder in centre is a rung and a half and should look like a man
 * out of his depth, not like a rounding error.
 */
const PER_RUNG = 4.5;

/**
 * The catcher surcharge, on top of the rungs.
 *
 * Catching is a trade. A man who has never done it does not do it passably
 * because he is athletic, and the number is large on purpose -- it is meant to
 * end the conversation rather than price it.
 */
const CATCHER_TAX = 22;

/** Whether this is a spot somebody actually stands in. */
const isFieldable = (pos: Position): boolean => pos !== 'P';

/**
 * What playing him here costs him, in rating points. Zero at his own position
 * and never negative -- moving down the spectrum is free rather than a bonus,
 * because a shortstop at first base is a shortstop standing at first base and
 * the sport does not pay him extra for it.
 */
export function positionPenalty(p: Hitter | Pitcher, at: Position): number {
  if (p.pos === at) return 0;
  if (!isFieldable(at)) return 0;
  // The DH is a lineup slot rather than a place on the grass. Nobody is out of
  // position there, which is the whole reason a bat-first man ends up in it.
  if (at === 'DH') return 0;

  const climb = Math.max(0, LADDER[at] - LADDER[p.pos]);
  const tax = at === 'C' && p.pos !== 'C' ? CATCHER_TAX : 0;
  return climb * PER_RUNG + tax;
}

/**
 * Every spot he can be put without it being a story, his own included.
 *
 * Derived, so it costs no field on the save and no draw at generation. The
 * threshold is one rung: the positions immediately around him and everything
 * easier than he is.
 */
export function secondaryPositions(p: Hitter | Pitcher): Position[] {
  if (p.type === 'pitcher') return [];
  const out: Position[] = [];
  for (const pos of Object.keys(LADDER) as Position[]) {
    if (pos === p.pos || !isFieldable(pos) || pos === 'DH') continue;
    if (positionPenalty(p, pos) <= PER_RUNG) out.push(pos);
  }
  // Hardest first, so a card reads "SS, 2B, 3B" rather than in ladder order --
  // the most flattering true thing about him, first.
  return out.sort((a, b) => LADDER[b] - LADDER[a]);
}

/**
 * His defensive ratings as they play at a given spot.
 *
 * Returned as a copy rather than applied to him, because he is not worse -- he
 * is worse *there*, and the moment the coach moves him back he is himself
 * again. Storing the penalty on the player would make that a fact about the man
 * instead of a fact about the lineup card.
 */
export function fieldingAt<T extends Hitter | Pitcher>(p: T, at: Position): T {
  const cost = positionPenalty(p, at);
  if (cost === 0) return p;
  const drop = (v: number): number => Math.max(1, v - cost);
  return {
    ...p,
    range: drop(p.range),
    hands: drop(p.hands),
    arm: drop(p.arm),
    armAccuracy: drop(p.armAccuracy),
    ...(p.type === 'hitter' ? { blocking: drop((p as Hitter).blocking) } : {}),
  };
}

/**
 * Roughly what the card should show him as, played here.
 *
 * Reported as the way it should feel, in the words of a game that already does
 * it: put an outfielder behind the plate in The Show and his overall drops. The
 * bat is untouched -- moving a man does not stop him hitting -- so this is the
 * glove half of `overallOf` moving and nothing else.
 */
export function penaltyLabel(p: Hitter | Pitcher, at: Position): string | null {
  const cost = positionPenalty(p, at);
  if (cost === 0) return null;
  if (cost >= CATCHER_TAX) return 'out of his depth';
  if (cost >= PER_RUNG * 2) return 'a stretch';
  return 'passable';
}
