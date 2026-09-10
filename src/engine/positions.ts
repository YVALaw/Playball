// positions.ts
// Where a man can actually play, and what it costs to move him.
//
// Stage 8. Until now a player had one position and that was the whole model: a
// shortstop was a shortstop, and the question "could he catch?" had no answer
// because nothing could ask it.
//
// ---------------------------------------------------------------------------
// The cover matrix is the model
// ---------------------------------------------------------------------------
//
// Who can stand where, the way a dugout actually treats it. The pair decides:
// a man's own spot costs nothing; a NATURAL cover is the move a coach makes
// without a second thought (the shortstop at second, the centre fielder in a
// corner, the catcher at first when his knees go); a STRETCH is the move he
// makes when he has to and expects to pay for (the second baseman at short,
// the corner outfielder in centre, the first baseman at third); everything
// else is OUT OF HIS DEPTH, and catching for anybody who is not a catcher is
// the deepest water there is.
//
// Until 2026-09-10 this was a single ladder, DH to C, where moving down was
// free. A shortstop cost nothing anywhere, a corner outfielder was a free
// first baseman, and since the glove is a small share of overall, a bat
// outranked a fielder almost everywhere the card looked — AUTO "picking
// crazily", in the report. The ladder survives only as the order a card
// prints in, hardest first.
//
// Catcher is deliberately not a harder version of the same trade. Asking an
// outfielder to catch should read on the screen as the mistake it is.
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
 * How hard each spot is to fill, for the order a card prints in. Only the
 * order is read; the numbers mean nothing on their own.
 */
const HARDNESS: Record<Position, number> = {
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

/** Own, natural cover, a stretch, out of his depth. */
export type CoverTier = 0 | 1 | 2 | 3;

/**
 * The cover a coach makes without a second thought, by the man's own spot.
 *
 * The shortstop is the best athlete on the dirt and covers the whole infield
 * and centre; the centre fielder covers both corners; the corners cover each
 * other and first; the third baseman covers first, second and the corners;
 * the second baseman covers third and first, but short is a stretch for him,
 * because the arm is not there. The catcher covers first, which is where
 * catchers go when their knees give up. A DH-labelled man is a first baseman
 * by trade (see `naturalPos`), so first is his one natural spot.
 */
const NATURAL: Record<Position, readonly Position[]> = {
  C: ['1B'],
  '1B': [],
  '2B': ['3B', '1B'],
  '3B': ['1B', '2B', 'LF', 'RF'],
  SS: ['2B', '3B', 'CF', '1B', 'LF', 'RF'],
  LF: ['RF', '1B'],
  RF: ['LF', '1B'],
  CF: ['LF', 'RF', '1B'],
  DH: ['1B'],
  P: [],
};

/** The move a coach makes when he has to, and pays for. */
const STRETCH: Record<Position, readonly Position[]> = {
  C: ['3B', 'LF', 'RF'],
  '1B': ['3B', 'LF', 'RF'],
  '2B': ['SS', 'CF', 'LF', 'RF'],
  '3B': ['SS', 'CF'],
  SS: [],
  LF: ['CF', '3B'],
  RF: ['CF', '3B'],
  CF: ['2B', '3B', 'SS'],
  DH: ['LF', 'RF', '3B'],
  P: [],
};

/**
 * What each tier costs, in points off his defensive ratings.
 *
 * Judgement rather than arithmetic, and steep enough to be felt: a natural
 * cover is a rung, a stretch should look like a man out of his depth rather
 * than a rounding error, and the deep end should end the conversation.
 */
const TIER_COST: Record<CoverTier, number> = { 0: 0, 1: 4.5, 2: 11, 3: 22 };

/**
 * The catcher surcharge. Catching is a trade: a man who has never done it does
 * not do it passably because he is athletic, and the number is large on
 * purpose — it is meant to end the conversation rather than price it.
 */
const CATCHER_TAX = 26;

/** Whether this is a spot somebody actually stands in. */
const isFieldable = (pos: Position): boolean => pos !== 'P';

/**
 * Which tier a man plays a spot at. The DH is a lineup slot rather than a
 * place on the grass, so nobody is out of position there — which is the whole
 * reason a bat-first man ends up in it.
 */
export function coverTier(p: Hitter | Pitcher, at: Position): CoverTier {
  if (p.pos === at) return 0;
  if (!isFieldable(at) || at === 'DH') return 0;
  if (NATURAL[p.pos].includes(at)) return 1;
  if (STRETCH[p.pos].includes(at)) return 2;
  return 3;
}

/**
 * What playing him here costs him, in rating points. Zero at his own position
 * and at the DH, never negative, and the plate is the deep end for anybody
 * who is not a catcher.
 */
export function positionPenalty(p: Hitter | Pitcher, at: Position): number {
  const settling = (p as { settling?: number }).settling ?? 0;
  const tier = coverTier(p, at);
  if (tier === 0) return p.pos === at ? settling : 0;
  const cost = at === 'C' ? CATCHER_TAX : TIER_COST[tier];
  return cost + settling;
}

const hardestFirst = (a: Position, b: Position): number => HARDNESS[b] - HARDNESS[a];

/**
 * Every spot he can be put without it being a story: his natural covers,
 * hardest first — so a card reads "2B · CF · 3B" for a shortstop and leads
 * with the most flattering true thing about him. A first baseman has none,
 * which is the model being honest rather than generous. Never the plate for a
 * man who is not a catcher, and never the DH, which is a slot.
 *
 * Derived, so it costs no field on the save and no draw at generation.
 */
export function secondaryPositions(p: Hitter | Pitcher): Position[] {
  if (p.type === 'pitcher') return [];
  return [...NATURAL[p.pos]].sort(hardestFirst).filter((pos) => pos !== p.pos);
}

/**
 * Every spot a winter could retrain him into: the natural covers and then
 * the stretches, each hardest first. A stretch is a real move (see
 * `movePosition`) and settles harder, but a first baseman can be taught a
 * corner, and this is the list the retrain action chooses from.
 */
export function retrainablePositions(p: Hitter | Pitcher): Position[] {
  if (p.type === 'pitcher') return [];
  return [
    ...[...NATURAL[p.pos]].sort(hardestFirst),
    ...[...STRETCH[p.pos]].sort(hardestFirst),
  ].filter((pos) => pos !== p.pos);
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
  const tier = coverTier(p, at);
  if (tier === 0) return null;
  if (tier === 3) return 'out of his depth';
  if (tier === 2) return 'a stretch';
  return 'passable';
}

// ---------------------------------------------------------------------------
// Moving a man, which is not the same as playing him out of position
// ---------------------------------------------------------------------------
//
// Playing a shortstop at third for one night costs him the rung and nothing
// else. *Moving* him there is a different act: he is a third baseman now, his
// card says so, and the rung is gone -- but he is not a natural one yet, and
// for a while he is worse there than his ratings claim.
//
// So a move is instant on the card and carries a settling penalty that decays,
// which is what was asked for. It is deliberately not position *training*: a
// man is here two to four years, and a system that spends one of them teaching
// him second base spends most of what you have.

/** What a man carries while he is learning a new spot. */
export interface Settling {
  /** Extra penalty points, on top of any rung. Decays each season. */
  settling?: number;
  /** Where he used to play, so a card can say what happened to him. */
  movedFrom?: Position;
  /** The retraining never took: the residual stays, and the card says so. */
  stuck?: boolean;
}

/** What a move costs on the day it happens, before any of it decays. */
export const SETTLING_COST = 9;

/** How much of it he sheds per season. Two years to be a natural. */
export const SETTLING_DECAY = 4.5;

/**
 * Move him, and make him pay for it for a while.
 *
 * Returns false when there is nothing to do -- moving a man to the position he
 * already plays is not a move, and the screen should not report one.
 */
export function movePosition(p: Hitter, to: Position): boolean {
  if (p.pos === to) return false;
  const s = p as Hitter & Settling;
  /*
    Uphill moves settle harder.

    A shortstop moving to third has done this his whole life and is nearly
    there already, so a natural cover settles at the flat cost; a left
    fielder moving to short has a great deal to learn, and a stretch or the
    deep end adds its own price on top. Charging the same for both would make
    the easy move feel punished and the hard one free.
  */
  const climb = coverTier(p, to) >= 2 ? positionPenalty(p, to) : 0;
  s.movedFrom = p.pos;
  p.pos = to;
  s.settling = SETTLING_COST + climb;
  return true;
}

/** What a retraining that never took leaves on his glove, for good. */
export const RETRAIN_RESIDUAL = 4.5;

/** The same stable string hash the rest of the engine derives with. */
function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/**
 * How likely a winter of retraining makes him a natural at a spot.
 *
 * The tier sets the base — a natural cover takes almost always, a stretch
 * about half the time, the deep end rarely, the plate never for a man who is
 * not a catcher — and the tool the spot lives on moves it either way: range
 * up the middle and in centre, the arm at third and in right, hands at first.
 * Printed in the retrain modal and rolled by `settleIn`, so what the coach
 * was told is what happens. Asked for 2026-09-10: "a modal with the
 * positions the player can be retrained to, showing the % of how likely
 * they are to actually get to be good in that position."
 */
export function retrainOdds(p: Hitter, to: Position): number {
  const tier = coverTier(p, to);
  if (tier === 0) return 1;
  if (to === 'C') return 0.05;
  const base = tier === 1 ? 0.85 : tier === 2 ? 0.5 : 0.15;
  const tool = to === 'SS' || to === '2B' || to === 'CF' ? p.range
    : to === '3B' || to === 'RF' ? p.arm
      : to === '1B' ? p.hands
        : (p.range + p.arm) / 2;
  const swing = ((tool - 50) / 50) * 0.2;
  return Math.max(0.05, Math.min(0.95, base + swing));
}

/**
 * A season of getting used to it.
 *
 * The winter the settling runs out is the winter it either took or did not.
 * Rolled off the man and the move rather than drawn, so a reload cannot
 * re-roll it and the odds the retrain modal printed were the odds. A move
 * that took leaves nothing behind; one that did not leaves a rung of glove
 * for good, and the lineup row says he never took to it.
 */
export function settleIn(p: Hitter): void {
  const s = p as Hitter & Settling;
  if (s.settling === undefined || s.stuck) return;
  const left = s.settling - SETTLING_DECAY;
  if (left > 0) { s.settling = left; return; }
  const from = s.movedFrom;
  const odds = from ? retrainOdds({ ...p, pos: from }, p.pos) : 1;
  const roll = (stableHash(`${p.id}:${from ?? '-'}:${p.pos}:retrain`) % 1000) / 1000;
  if (roll < odds) { delete s.settling; delete s.movedFrom; return; }
  s.settling = RETRAIN_RESIDUAL;
  s.stuck = true;
}
