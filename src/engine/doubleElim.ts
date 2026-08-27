// doubleElim.ts
// Eight teams, two brackets, and nobody goes home on one loss.
//
// Double elimination is what college baseball actually plays, and it came out
// of this codebase once already — the first attempt drew both brackets on one
// map and the map was unreadable on a phone. The format is back because the
// *reading* problem was solved instead: the winners bracket and the losers
// bracket are two views under a toggle, each an ordinary tree, and the screen
// never shows both at once. The engine here does not care how it is drawn.
//
// The shape is the standard 8-team double elimination, single games:
//
//   WINNERS  W0: four games (1v8, 4v5, 2v7, 3v6)
//            W1: two games          W2: the winners final
//   LOSERS   L0: two games (the W0 losers, paired as they fell)
//            L1: two games (L0 winners vs W1 losers, crossed)
//            L2: one game           L3: the losers final (vs the W2 loser)
//   FINAL    F0: winners champion vs losers survivor
//            F1: the reset, only if the losers survivor takes F0 — the
//                winners champion has to lose twice like everybody else.
//
// Fourteen games, fifteen with the reset. The finish order the tournament
// settles beyond its champion: 2nd is the final's loser, 3rd fell in the
// losers final, 4th in L2 — which is exactly the top four a conference sends
// on to the regionals, read off the structure rather than assigned.
//
// Everything here is plain data plus two Maps, the same diet `SeriesBracket`
// keeps, so a live tournament survives a structured clone with its season
// reference stripped and put back — see `portableMyBracket` in the store.

import type { SeasonState } from './season.js';
import { playGame, recordResult, advancePostseasonDay } from './season.js';
import type { GameResult } from './game.js';
import { pairKey, seedOrder, type BracketGame } from './postseason.js';

/** One matchup slot: a single game, once both names have arrived. */
export interface DESlot {
  /** 'W' winners, 'L' losers, 'F' the final (and its reset). */
  side: 'W' | 'L' | 'F';
  round: number;
  slot: number;
  a: number | null;
  b: number | null;
  aSeed: number;
  bSeed: number;
  game: BracketGame | null;
  winner: number | null;
}

export interface DoubleElim {
  season: SeasonState;
  /** Teams in seed order, best first. Exactly eight. */
  seeds: number[];
  winners: DESlot[][];
  losers: DESlot[][];
  /** [the final, the reset]. The reset stays empty unless it is forced. */
  final: DESlot[];
  champion: number | null;
  done: boolean;
  /** Two losses and out, in the order they went out. */
  eliminated: number[];
  /** Loss count per team. The structure implies it; this states it. */
  losses: Map<number, number>;
  /** Games played here per team, for rotation order. */
  appearances: Map<number, number>;
  seedOf: Map<number, number>;
}

const slot = (side: 'W' | 'L' | 'F', round: number, i: number): DESlot => ({
  side, round, slot: i, a: null, b: null, aSeed: 0, bSeed: 0,
  game: null, winner: null,
});

/** Build the whole structure up front, every slot drawn, TBD where empty. */
export function startDoubleElim(
  season: SeasonState, seeds: readonly number[],
): DoubleElim {
  if (seeds.length !== 8) {
    throw new Error(`double elimination is built for eight, got ${seeds.length}`);
  }

  const winners = [
    [slot('W', 0, 0), slot('W', 0, 1), slot('W', 0, 2), slot('W', 0, 3)],
    [slot('W', 1, 0), slot('W', 1, 1)],
    [slot('W', 2, 0)],
  ];
  const losers = [
    [slot('L', 0, 0), slot('L', 0, 1)],
    [slot('L', 1, 0), slot('L', 1, 1)],
    [slot('L', 2, 0)],
    [slot('L', 3, 0)],
  ];
  const final = [slot('F', 0, 0), slot('F', 1, 0)];

  const order = seedOrder(8);
  for (let i = 0; i < 4; i++) {
    const s = winners[0]![i]!;
    const seedA = order[i * 2]!;
    const seedB = order[i * 2 + 1]!;
    s.a = seeds[seedA - 1] ?? null;
    s.b = seeds[seedB - 1] ?? null;
    s.aSeed = seedA;
    s.bSeed = seedB;
  }

  return {
    season,
    seeds: [...seeds],
    winners, losers, final,
    champion: null, done: false,
    eliminated: [],
    losses: new Map(seeds.map((t) => [t, 0])),
    appearances: new Map(),
    seedOf: new Map(seeds.map((t, i) => [t, i + 1])),
  };
}

/** Feed a decided slot's winner and loser to wherever the structure sends them. */
function propagate(state: DoubleElim, s: DESlot): void {
  const winner = s.winner as number;
  const loser = (s.winner === s.a ? s.b : s.a) as number;
  const wSeed = s.winner === s.a ? s.aSeed : s.bSeed;
  const lSeed = s.winner === s.a ? s.bSeed : s.aSeed;

  const put = (into: DESlot, team: number, seed: number, first: boolean): void => {
    if (first) { into.a = team; into.aSeed = seed; }
    else { into.b = team; into.bSeed = seed; }
  };

  const fell = (team: number): void => {
    const n = (state.losses.get(team) ?? 0) + 1;
    state.losses.set(team, n);
    if (n >= 2) state.eliminated.push(team);
  };

  if (s.side === 'W' && s.round === 0) {
    put(state.winners[1]![Math.floor(s.slot / 2)]!, winner, wSeed, s.slot % 2 === 0);
    fell(loser);
    put(state.losers[0]![Math.floor(s.slot / 2)]!, loser, lSeed, s.slot % 2 === 0);
    return;
  }
  if (s.side === 'W' && s.round === 1) {
    put(state.winners[2]![0]!, winner, wSeed, s.slot === 0);
    fell(loser);
    // Crossed into the losers bracket, so a team cannot meet the same
    // opponent again one game after losing to him.
    put(state.losers[1]![1 - s.slot]!, loser, lSeed, false);
    return;
  }
  if (s.side === 'W' && s.round === 2) {
    put(state.final[0]!, winner, wSeed, true);
    fell(loser);
    put(state.losers[3]![0]!, loser, lSeed, false);
    return;
  }

  if (s.side === 'L') {
    fell(loser);
    if (s.round === 0) { put(state.losers[1]![s.slot]!, winner, wSeed, true); return; }
    if (s.round === 1) { put(state.losers[2]![0]!, winner, wSeed, s.slot === 0); return; }
    if (s.round === 2) { put(state.losers[3]![0]!, winner, wSeed, true); return; }
    // Losers final: the survivor earns the winners champion.
    put(state.final[0]!, winner, wSeed, false);
    return;
  }

  // The final. The winners champion sits in `a` with no losses; if he wins,
  // it is over. If the losers survivor takes it, the winners champion has
  // his first loss and the reset is staged with the same two teams.
  if (s.round === 0) {
    if (winner === s.a) {
      fell(loser);
      state.champion = winner;
      state.done = true;
      return;
    }
    fell(loser); // the winners champion's first loss — not elimination
    const reset = state.final[1]!;
    reset.a = s.a; reset.aSeed = s.aSeed;
    reset.b = s.b; reset.bSeed = s.bSeed;
    return;
  }
  fell(loser);
  state.champion = winner;
  state.done = true;
}

/** Every slot with both names in and no result yet. */
export function readySlots(state: DoubleElim): DESlot[] {
  if (state.done) return [];
  const all = [...state.winners.flat(), ...state.losers.flat(), ...state.final];
  return all.filter((s) => s.a !== null && s.b !== null && s.winner === null);
}

/** The game this team is due to play, if any. */
export function liveSlotFor(state: DoubleElim, team: number): DESlot | null {
  return readySlots(state).find((s) => s.a === team || s.b === team) ?? null;
}

/** What a slot is called on screen and in the log. */
export function slotName(s: DESlot): string {
  if (s.side === 'F') return s.round === 0 ? 'Championship' : 'Championship · the reset';
  if (s.side === 'W') return ['Opening round', 'Winners semifinal', 'Winners final'][s.round]!;
  return ['Elimination round', 'Losers round 2', 'Losers semifinal', 'Losers final'][s.round]!;
}

/** Play one slot's game, on the season's own dice. */
function playSlot(
  state: DoubleElim, s: DESlot, preplayed?: Map<string, GameResult>,
): void {
  if (s.winner !== null || s.a === null || s.b === null) return;

  // The better seed hosts. The final hosts the winners-bracket champion,
  // which is the other thing coming through undefeated buys.
  const home = s.side === 'F' ? s.a : (s.aSeed <= s.bSeed ? s.a : s.b);
  const away = home === s.a ? s.b : s.a;
  const homeUsed = state.appearances.get(home) ?? 0;
  const awayUsed = state.appearances.get(away) ?? 0;
  state.appearances.set(home, homeUsed + 1);
  state.appearances.set(away, awayUsed + 1);

  const ready = preplayed?.get(pairKey(s.a, s.b));
  const summary = ready
    ? recordResult(state.season, home, away, ready, {
        conference: false, standings: true, record: true,
      })
    : playGame(state.season, home, away, {
        conference: false,
        homeSlot: homeUsed % 3,
        awaySlot: awayUsed % 3,
        standings: true, record: true, postseason: true,
      });
  if (ready) preplayed?.delete(pairKey(s.a, s.b));

  const homeWon = summary.homeRuns > summary.awayRuns;
  s.game = {
    ...summary, round: slotName(s),
    winner: homeWon ? home : away,
    loser: homeWon ? away : home,
  };
  s.winner = s.game.winner;
  propagate(state, s);
}

/**
 * One night of the tournament: every game that can be played, played.
 *
 * The same shape `stepBracket` gives a knockout round — the whole frontier
 * moves together, then the calendar turns so the bullpens breathe.
 */
export function stepDoubleElim(
  state: DoubleElim, preplayed?: Map<string, GameResult>,
): void {
  if (state.done) return;
  for (const s of readySlots(state)) playSlot(state, s, preplayed);
  advancePostseasonDay(state.season);
}

/** The whole thing at once, for the seven tournaments nobody is watching. */
export function runDoubleElim(
  season: SeasonState, seeds: readonly number[],
): DoubleElim {
  const state = startDoubleElim(season, seeds);
  let guard = 0;
  while (!state.done && guard++ < 40) stepDoubleElim(state);
  return state;
}

/**
 * The finish order beyond the trophy, read off the structure.
 *
 * 1st the champion, 2nd the final's loser, 3rd fell in the losers final, 4th
 * in the losers semifinal — the four the conference sends to the regionals,
 * in an order the bracket itself decided rather than one anybody assigned.
 */
export function placings(state: DoubleElim): number[] {
  if (!state.done || state.champion === null) {
    throw new Error('tournament is not finished');
  }
  // The final's two teams are the top two by definition; the reset never
  // changes who they are, so the first final answers for both.
  const runnerUp = state.final[0]!.a === state.champion
    ? state.final[0]!.b : state.final[0]!.a;
  const lf = state.losers[3]![0]!;
  const third = lf.winner === lf.a ? lf.b : lf.a;
  const ls = state.losers[2]![0]!;
  const fourth = ls.winner === ls.a ? ls.b : ls.a;
  return [state.champion, runnerUp as number, third as number, fourth as number];
}

/** Every game played, flattened, oldest structure position first. */
export function gamesOf(state: DoubleElim): BracketGame[] {
  return [...state.winners.flat(), ...state.losers.flat(), ...state.final]
    .map((s) => s.game)
    .filter((g): g is BracketGame => g !== null);
}

/**
 * The finished tournament as plain serialisable results, for the stage list.
 * The slots ride along so a finished bracket draws exactly like a live one.
 */
export interface DoubleElimResult {
  seeds: number[];
  games: BracketGame[];
  champion: number;
  eliminated: number[];
  /** Champion, runner-up, third, fourth. */
  placings: number[];
  winners: DESlot[][];
  losers: DESlot[][];
  final: DESlot[];
}

export function resultOfDE(state: DoubleElim): DoubleElimResult {
  if (!state.done || state.champion === null) {
    throw new Error('tournament is not finished');
  }
  return {
    seeds: state.seeds,
    games: gamesOf(state),
    champion: state.champion,
    eliminated: state.eliminated,
    placings: placings(state),
    winners: state.winners,
    losers: state.losers,
    final: state.final,
  };
}
