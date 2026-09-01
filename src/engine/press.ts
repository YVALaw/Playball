// press.ts
// Which question the room asks, and what the answer costs.
//
// The pool is in `data/pressers.ts`. This is the part that decides *when* a
// coach is put in front of it, *which* question he gets, and what saying a
// given thing does to him.
//
// ---------------------------------------------------------------------------
// Only after something real
// ---------------------------------------------------------------------------
//
// The whole design rests on this. A press conference after a Tuesday win over
// nobody is a dialogue box; one after you lose to the worst team on the
// schedule is a moment. So every trigger below is a fact the season already
// produced and already stores -- there is no counter invented to feed this.
//
// Five to eight a season is the target, and `SEASON_CAP` is what actually holds
// it: triggers can bunch up (a bad week is three of them) and a game that stops
// to talk after every one of those is a game people stop playing.
//
// ---------------------------------------------------------------------------
// Seeded, and it never moves the world
// ---------------------------------------------------------------------------
//
// Which question you get is derived from the world seed, the year and how many
// you have already had. Two consequences, both deliberate: reloading the save
// cannot re-roll a question you did not like, and asking *what* the question is
// takes no draw from the season generator -- the same rule the wire, the
// play-by-play and `badgeThreshold` all keep. A screen that previewed a
// presser must not change every number after it.

import { PRESSERS, type Presser, type PressTrigger, type PressAnswer } from '../data/pressers.js';

/**
 * How many a coach faces in one season.
 *
 * Retuned on report: "the press thing happens way too much, let's do 2 or 3
 * per year." Three is the cap and two is the likely count -- the triggers are
 * lumpy, and with a twelve-game cooldown a season simply runs out of room for
 * a third unless it earns one.
 */
export const SEASON_CAP = 3;

/**
 * The smallest gap between two of them, in games played.
 *
 * Stops a single bad week producing three in a row, which is the shape that
 * makes the whole feature read as nagging rather than as punctuation.
 */
export const COOLDOWN_GAMES = 12;

/** What the season has to say for itself when a presser is considered. */
export interface PressSituation {
  readonly trigger: PressTrigger;
  /** Games played this season, for the cooldown. */
  readonly gamesPlayed: number;
}

/** What a coach carries between pressers. Sparse, so an old save has none. */
export interface PressState {
  /** How many he has faced this season. */
  faced?: number;
  /** `gamesPlayed` when the last one happened. */
  lastAt?: number;
  /** Ids already used this season, so a year does not repeat itself. */
  asked?: string[];
}

/**
 * Whether the room gets him at all.
 *
 * Separate from `pickPresser` because "should this happen" and "what is asked"
 * are different questions, and only the first one is allowed to look at how
 * tired the player is of being asked.
 */
export function shouldAsk(state: PressState, at: PressSituation): boolean {
  const faced = state.faced ?? 0;
  if (faced >= SEASON_CAP) return false;
  // A trigger that fires on the same night as the last one is the lumpiness the
  // cooldown exists for. The elimination is exempt: a season ending is the one
  // moment worth interrupting whatever else just happened.
  if (at.trigger === 'knockedOut') return true;
  const last = state.lastAt;
  if (last !== undefined && at.gamesPlayed - last < COOLDOWN_GAMES) return false;
  return true;
}

/**
 * A small integer hash, so the question is fixed for a save and different
 * between saves.
 *
 * Deliberately not a draw from the season generator; see the header.
 */
function hash(worldSeed: number, year: number, n: number, salt: string): number {
  let h = (((worldSeed ^ 0x9e3779b9) >>> 0) + year * 2654435761 + n * 40503) >>> 0;
  for (let i = 0; i < salt.length; i++) {
    h = Math.imul(h ^ salt.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Which question, given what just happened.
 *
 * Prefers one this season has not used, so a year of bad losses is a
 * conversation rather than the same question four times. Falls back to the
 * whole set for that trigger once they are exhausted, because repeating
 * yourself in year three is better than saying nothing.
 */
export function pickPresser(
  trigger: PressTrigger,
  state: PressState,
  worldSeed: number,
  year: number,
): Presser | null {
  const all = PRESSERS.filter((p) => p.trigger === trigger);
  if (all.length === 0) return null;
  const asked = state.asked ?? [];
  const fresh = all.filter((p) => !asked.includes(p.id));
  const pool = fresh.length > 0 ? fresh : all;
  const h = hash(worldSeed, year, state.faced ?? 0, trigger);
  return pool[h % pool.length] ?? null;
}

/** What an answer did. Applied by the store; returned so a card can print it. */
export interface PressResult {
  readonly prestige: number;
  readonly security: number;
  /** True when the answer matched a badge he actually wears. */
  readonly inCharacter: boolean;
}

/**
 * How much wearing the badge is worth, on his name alone.
 *
 * A lean rather than a gate: enough that a coach built one way is better off
 * talking that way, small enough that the player is choosing what he would say
 * rather than reading answers off a table. `tests/press.test.ts` holds it from
 * both sides, because the offers desk shipped each failure once -- weighted
 * hard the badges decide the answer, weighted lightly they are decoration.
 */
const IN_CHARACTER = 0.5;

export function settlePress(
  answer: PressAnswer,
  badges: readonly string[] = [],
): PressResult {
  const wears = answer.badge !== undefined && badges.includes(answer.badge);
  // Only an answer that names a badge can be in or out of character. One that
  // names none is just a thing he said, and is worth exactly what it says.
  const lean = answer.badge === undefined ? 0 : (wears ? IN_CHARACTER : -IN_CHARACTER);
  /*
    The lean lands on his name and not on the board.

    It applied to both at first, and that made it a gate rather than a lean:
    half a point rounds a neutral channel to a whole one in each direction, so
    an answer worth one and nothing swung by three depending on a badge. Two
    channels doubled a nudge into a verdict.

    Which is also the truer reading. Whether a man sounded like himself is a
    question about his reputation -- the room has heard him before. The board
    is judging what he actually said.
  */
  // A malformed answer must cost nothing, not poison the career with NaN.
  const v = (answer.prestige ?? 0) + lean;
  return {
    prestige: v >= 0 ? Math.round(v) : -Math.round(-v),
    security: answer.security ?? 0,
    inCharacter: wears,
  };
}

/** Fold one answered presser into the coach's running state. */
export function notePress(state: PressState, id: string, gamesPlayed: number): PressState {
  return {
    faced: (state.faced ?? 0) + 1,
    lastAt: gamesPlayed,
    asked: [...(state.asked ?? []), id],
  };
}

/** A fresh slate, at the year roll. */
export function clearPress(): PressState {
  return { faced: 0, asked: [] };
}
