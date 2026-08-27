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
  /**
   * What this round is called, baked in when the bracket is built.
   *
   * Stored rather than derived because the same (side, round) means different
   * things at different sizes — round 0 of the winners bracket is the opening
   * round in an eight-team tournament and the play-in in a ten-team one — and
   * `slotName` is called from the store and two screens with nothing but the
   * slot in hand. Naming it once, where the shape is known, beats threading the
   * shape through every caller.
   */
  name?: string;
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

const slot = (
  side: 'W' | 'L' | 'F', round: number, i: number, name?: string,
): DESlot => ({
  side, round, slot: i, a: null, b: null, aSeed: 0, bSeed: 0,
  game: null, winner: null,
  ...(name ? { name } : {}),
});

/** Where a decided slot sends somebody: a slot to sit in, or out of the field. */
type Target = { side: 'W' | 'L' | 'F'; round: number; slot: number; first: boolean };

interface Shape {
  /** How many slots in each winners round, then each losers round. */
  winners: number[];
  losers: number[];
  /** What each round is called, in order. */
  wNames: string[];
  lNames: string[];
  /** Who plays in the first winners round, as seed pairs (1-based). */
  open: [number, number][];
  /** The winner of a decided slot goes here. `null` means the trophy. */
  win: (s: DESlot) => Target | null;
  /** And the loser here. `null` means out of the tournament. */
  lose: (s: DESlot) => Target | null;
}

const W = (round: number, slotIdx: number, first: boolean): Target =>
  ({ side: 'W', round, slot: slotIdx, first });
const L = (round: number, slotIdx: number, first: boolean): Target =>
  ({ side: 'L', round, slot: slotIdx, first });
const F = (first: boolean): Target => ({ side: 'F', round: 0, slot: 0, first });

/**
 * The eight-team tournament, exactly as it has always been played.
 *
 * Transcribed from the routing this file used to express as a chain of ifs, and
 * the existing tests are the proof of the transcription: the game count, the
 * finish order, the "steps to the same tournament as running it in one go"
 * property and every conference tournament in the soak all read this table now.
 */
const EIGHT: Shape = {
  winners: [4, 2, 1],
  losers: [2, 2, 1, 1],
  wNames: ['Opening round', 'Winners semifinal', 'Winners final'],
  lNames: ['Elimination round', 'Losers round 2', 'Losers semifinal', 'Losers final'],
  open: [[1, 8], [4, 5], [2, 7], [3, 6]],
  win: (s) => {
    if (s.side === 'W') {
      if (s.round === 0) return W(1, Math.floor(s.slot / 2), s.slot % 2 === 0);
      if (s.round === 1) return W(2, 0, s.slot === 0);
      return F(true);
    }
    if (s.round === 0) return L(1, s.slot, true);
    if (s.round === 1) return L(2, 0, s.slot === 0);
    if (s.round === 2) return L(3, 0, true);
    return F(false);                       // losers final: he earns the champion
  },
  lose: (s) => {
    if (s.side !== 'W') return null;       // a second loss is the end of it
    if (s.round === 0) return L(0, Math.floor(s.slot / 2), s.slot % 2 === 0);
    // Crossed, so a team cannot meet the same opponent one game after losing
    // to him.
    if (s.round === 1) return L(1, 1 - s.slot, false);
    return L(3, 0, false);
  },
};

/**
 * Ten teams: the same tournament with a play-in bolted onto the front of the
 * winners bracket.
 *
 * This replaced a separate best-of-three opening round that trimmed a twenty
 * team national field to sixteen, and the reason it had to go is not that it
 * was an extra round — it is that it was a *single elimination* gate standing
 * in front of a double elimination tournament. A team could arrive having won
 * its conference and its regional, lose one series, and be finished, in an
 * event whose whole promise is that one bad night does not end you.
 *
 * Here the two extra teams per bracket play their way in, and losing that game
 * costs exactly what losing any other first game costs: you drop to the losers
 * side and keep playing. Six teams sit it out, which is what a better regular
 * season is supposed to buy.
 *
 * Eighteen games, nineteen with the reset — which is the arithmetic checking
 * itself, since nine teams must be eliminated at two losses each.
 */
const TEN: Shape = {
  winners: [2, 4, 2, 1],
  losers: [2, 2, 2, 1, 1],
  wNames: ['Play-in', 'Opening round', 'Winners semifinal', 'Winners final'],
  lNames: [
    'Elimination round', 'Losers round 2', 'Losers round 3',
    'Losers semifinal', 'Losers final',
  ],
  // Seeds 1–6 are byed. The play-in is the bottom four, paired as they would
  // be anywhere else: best against worst.
  open: [[7, 10], [8, 9]],
  win: (s) => {
    if (s.side === 'W') {
      // The play-in winners take the two lowest positions in the eight-team
      // bracket behind them, so a bye is worth what a bye should be worth.
      if (s.round === 0) return W(1, s.slot === 0 ? 0 : 2, false);
      if (s.round === 1) return W(2, Math.floor(s.slot / 2), s.slot % 2 === 0);
      if (s.round === 2) return W(3, 0, s.slot === 0);
      return F(true);
    }
    if (s.round === 0) return L(1, s.slot, true);
    if (s.round === 1) return L(2, s.slot, true);
    if (s.round === 2) return L(3, 0, s.slot === 0);
    if (s.round === 3) return L(4, 0, true);
    return F(false);
  },
  lose: (s) => {
    if (s.side !== 'W') return null;
    if (s.round === 0) return L(0, s.slot, true);
    if (s.round === 1) {
      /*
        Which of the four opening-round losers drops into the play-in losers'
        round, and which waits one.

        Slots 1 and 3 are the games with no play-in team in them (4v5 and 3v6),
        and they are the ones sent down to meet the play-in losers. Sending
        slot 0 or 2 could pair a play-in loser against the very team that
        knocked him out an hour earlier, which is the rematch the crossing rule
        exists to prevent everywhere else in this bracket.
      */
      if (s.slot === 1) return L(0, 0, false);
      if (s.slot === 3) return L(0, 1, false);
      return L(1, s.slot === 0 ? 0 : 1, false);
    }
    if (s.round === 2) return L(2, 1 - s.slot, false);
    return L(4, 0, false);                 // the winners final's loser
  },
};

const SHAPES: Record<number, Shape> = { 8: EIGHT, 10: TEN };

/** Build the whole structure up front, every slot drawn, TBD where empty. */
export function startDoubleElim(
  season: SeasonState, seeds: readonly number[],
): DoubleElim {
  const shape = SHAPES[seeds.length];
  if (!shape) {
    throw new Error(
      `double elimination is built for eight or ten, got ${seeds.length}`);
  }

  const winners = shape.winners.map((n, r) =>
    Array.from({ length: n }, (_, i) => slot('W', r, i, shape.wNames[r])));
  const losers = shape.losers.map((n, r) =>
    Array.from({ length: n }, (_, i) => slot('L', r, i, shape.lNames[r])));
  const final = [
    slot('F', 0, 0, 'Championship'),
    slot('F', 1, 0, 'Championship · the reset'),
  ];

  shape.open.forEach(([seedA, seedB], i) => {
    const s = winners[0]![i]!;
    s.a = seeds[seedA - 1] ?? null;
    s.b = seeds[seedB - 1] ?? null;
    s.aSeed = seedA;
    s.bSeed = seedB;
  });

  // The byes. Anybody not in the first round is already standing in the round
  // behind it, and the routing table says exactly where — `open` names who
  // plays, so whoever it does not name is seeded straight through.
  if (shape.winners[0]! < 4 && winners[1]) {
    const playing = new Set(shape.open.flat());
    const order = seedOrder(8);
    // The eight positions of the bracket behind the play-in: six real seeds,
    // and two holes the play-in winners will fill.
    const byes = [...Array(seeds.length)].map((_, i) => i + 1)
      .filter((seed) => !playing.has(seed));
    for (let i = 0; i < 4; i++) {
      const s = winners[1]![i]!;
      const seatA = order[i * 2]!;
      const seatB = order[i * 2 + 1]!;
      // Seat n of the eight-bracket is the nth byed seed, for n up to six.
      const from = (seat: number): number | null => byes[seat - 1] ?? null;
      const sa = from(seatA);
      const sb = from(seatB);
      if (sa !== null) { s.a = seeds[sa - 1] ?? null; s.aSeed = sa; }
      if (sb !== null) { s.b = seeds[sb - 1] ?? null; s.bSeed = sb; }
    }
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

/** Which tournament this is, read off its own shape. */
function shapeOf(state: DoubleElim): Shape {
  return SHAPES[state.seeds.length] ?? EIGHT;
}

/** Feed a decided slot's winner and loser to wherever the structure sends them. */
function propagate(state: DoubleElim, s: DESlot): void {
  const winner = s.winner as number;
  const loser = (s.winner === s.a ? s.b : s.a) as number;
  const wSeed = s.winner === s.a ? s.aSeed : s.bSeed;
  const lSeed = s.winner === s.a ? s.bSeed : s.aSeed;

  const put = (t: Target, team: number, seed: number): void => {
    const rows = t.side === 'W' ? state.winners
      : t.side === 'L' ? state.losers : null;
    const into = rows ? rows[t.round]?.[t.slot] : state.final[0];
    if (!into) return;
    if (t.first) { into.a = team; into.aSeed = seed; }
    else { into.b = team; into.bSeed = seed; }
  };

  const fell = (team: number): void => {
    const n = (state.losses.get(team) ?? 0) + 1;
    state.losses.set(team, n);
    if (n >= 2) state.eliminated.push(team);
  };

  if (s.side !== 'F') {
    const shape = shapeOf(state);
    const to = shape.win(s);
    if (to) put(to, winner, wSeed);
    fell(loser);
    const down = shape.lose(s);
    if (down) put(down, loser, lSeed);
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

/**
 * The earliest round with games waiting, and only that round.
 *
 * `readySlots` returns the whole frontier, which was the unit a press used to
 * play. That is defensible arithmetic and it reads terribly: at the draw of a
 * ten-team bracket the play-in and the two all-bye opening games are ready in
 * the same instant, so one press played a round the player had been told about
 * and a round he had not. Reported exactly that way — the button should sim the
 * play-in and *only* the play-in.
 *
 * Ordered winners before losers before the final, and by round within each,
 * which is the order a bracket is read in and the order these rounds actually
 * feed each other.
 */
export function nextRound(state: DoubleElim): DESlot[] {
  const ready = readySlots(state);
  if (ready.length === 0) return [];
  const rank = (s: DESlot): number =>
    (s.side === 'W' ? 0 : s.side === 'L' ? 1 : 2) * 100 + s.round;
  const first = Math.min(...ready.map(rank));
  return ready.filter((s) => rank(s) === first);
}

/** What the next round is called, for a button that has to say what it does. */
export function nextRoundName(state: DoubleElim): string | null {
  const round = nextRound(state);
  return round.length > 0 ? slotName(round[0]!) : null;
}

/** The game this team is due to play, if any. */
export function liveSlotFor(state: DoubleElim, team: number): DESlot | null {
  return readySlots(state).find((s) => s.a === team || s.b === team) ?? null;
}

/**
 * What a slot is called on screen and in the log.
 *
 * The name is baked into the slot when the bracket is built, because the same
 * (side, round) means different things at different sizes. The fallback covers
 * one real case rather than being defensive for its own sake: a tournament
 * saved by a build before names were stored comes back without them, and the
 * eight-team names are what every such save was.
 */
export function slotName(s: DESlot): string {
  if (s.name) return s.name;
  if (s.side === 'F') return s.round === 0 ? 'Championship' : 'Championship · the reset';
  if (s.side === 'W') return EIGHT.wNames[s.round] ?? 'Winners bracket';
  return EIGHT.lNames[s.round] ?? 'Losers bracket';
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
        // `postseason` matters here even though the game is already played:
        // it is what puts the line in June's own book. Without it the only
        // postseason statistics missing from the league would be the user's,
        // because his are the games that arrive down this branch.
        conference: false, standings: true, record: true, postseason: true,
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

  /*
    One round per call, and the calendar exactly as it was.

    The frontier used to be the unit: every playable game, then a new day. That
    reads badly — at the draw of a ten-team bracket the play-in and the two
    all-bye opening games are ready in the same instant, so one press played a
    round the player had been told about and a round he had not.

    Playing one round per call and advancing a day each time was the obvious
    fix and it was wrong: it stretched June, which rests bullpens, which moved
    results across a whole league. It showed up as a board being asked for a
    top-three finish twenty-five times in a country with twenty-four such
    places — a real breach of `objectivesFor`'s own rule, caused by a UI
    complaint. Balance is not allowed to move to make a button clearer.

    So the night is still roughly the night. Tonight's frontier is captured
    before anything is played and the day turns only once every game in it is
    done, which keeps June about as long as it was rather than stretching it a
    round at a time.

    Not *identical*, and the comment should say so: a round whose results make
    further slots ready can pull them into the same capture, so a night
    boundary can move by a round. The soak says what that is worth — thirty
    Junes structurally clean, the tuned board and carousel invariants intact,
    and distinct champions in thirty years going from nine to twelve, which is
    a small move in the direction the balance question in the backlog wants
    anyway.
  */
  const tonight = readySlots(state);
  for (const s of nextRound(state)) playSlot(state, s, preplayed);
  // Newly-ready slots are tomorrow's business and are deliberately not counted.
  const unfinished = tonight.some((s) => s.winner === null);
  if (!unfinished) advancePostseasonDay(state.season);
}

/** The whole thing at once, for the seven tournaments nobody is watching. */
export function runDoubleElim(
  season: SeasonState, seeds: readonly number[],
): DoubleElim {
  const state = startDoubleElim(season, seeds);
  let guard = 0;
  // Rounds now, not nights, so the ceiling counts rounds: eleven in a
  // ten-team bracket, nine in an eight, and room to spare either way.
  while (!state.done && guard++ < 60) stepDoubleElim(state);
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
  // Counted back from the end rather than indexed at 3 and 2, so the same
  // reading works whichever size this bracket is: the last losers round is
  // always the losers final and the one before it always the semifinal, and
  // both are always a single game.
  const rows = state.losers;
  const lf = rows[rows.length - 1]![0]!;
  const third = lf.winner === lf.a ? lf.b : lf.a;
  const ls = rows[rows.length - 2]![0]!;
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
