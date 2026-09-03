// postseason.ts
// Conference tournament and season awards.
//
// The bracket machinery here is generic — double elimination over any field
// size, and best-of-N series — so the same code runs a national bracket the day
// the world grows past one conference. See the note on scope at the bottom.

import {
  playGame, recordResult, onBase, slugging, era, inningsPitched, standings, rpiOrder,
  advancePostseasonDay, seedTeams, regularRecord, rollHurtsFor,
} from './season.js';
import type {
  BattingSeason, GameSummary, PitchingSeason, SeasonState, TeamRecord,
} from './season.js';
import {
  runDoubleElim, resultOfDE,
  type DoubleElim, type DoubleElimResult,
} from './doubleElim.js';
import { armValue, overallOf } from './ratings.js';
import type { ClassYear, PlayerId, Position } from './types.js';
import type { GameResult } from './game.js';

// ---------------------------------------------------------------------------
// Brackets
// ---------------------------------------------------------------------------

export interface BracketGame extends GameSummary {
  round: string;
  winner: number;
  loser: number;
}

export interface TournamentResult {
  /** Team indices in seed order, best first. */
  seeds: number[];
  games: BracketGame[];
  champion: number;
  /** Team indices in the order they were knocked out, first out first. */
  eliminated: number[];
  /**
   * The tree it was played on, round by round.
   *
   * Kept on the result so a finished tournament draws exactly like a live one —
   * the screen never has to rebuild a bracket from a flat list of games.
   */
  rounds?: Series[][];
}

interface Bracket {
  season: SeasonState;
  seedOf: Map<number, number>;
  appearances: Map<number, number>;
  games: BracketGame[];
  /**
   * A game the manager already played himself, keyed by its two teams.
   *
   * The bracket cannot run a managed game — that takes a screen and a person —
   * so the app plays it and hands the finished result back here. Without this,
   * the only postseason available is one that happens to you.
   */
  preplayed?: Map<string, GameResult>;
}

/** Key for a pre-played game. Order independent: a bracket picks the home side. */
export const pairKey = (a: number, b: number): string =>
  (a < b ? `${a}:${b}` : `${b}:${a}`);

/**
 * One game. The better seed hosts, which is the whole prize for a good regular
 * season — and it is worth something now that home field advantage is real.
 *
 * Each side's arm is chosen by how many games *that* team has already played
 * here, so a club that goes deep works down its rotation exactly as it would in
 * a real bracket. The two counts are kept apart deliberately: a team arriving
 * off a bye and a team that has just played three games in three days are not
 * both on their Friday starter, and running the whole bracket off the host's
 * count meant they always were.
 */
function play(bracket: Bracket, round: string, a: number, b: number): BracketGame {
  const seedA = bracket.seedOf.get(a) ?? Number.MAX_SAFE_INTEGER;
  const seedB = bracket.seedOf.get(b) ?? Number.MAX_SAFE_INTEGER;
  const [home, away] = seedA <= seedB ? [a, b] : [b, a];

  const homeUsed = bracket.appearances.get(home) ?? 0;
  const awayUsed = bracket.appearances.get(away) ?? 0;
  bracket.appearances.set(home, homeUsed + 1);
  bracket.appearances.set(away, awayUsed + 1);

  // A game the manager already played takes precedence over simulating one.
  // It is recorded exactly like any other bracket game, so a hand-played
  // regional counts the same as a simulated one.
  const ready = bracket.preplayed?.get(pairKey(a, b));
  const summary = ready
    ? recordResult(bracket.season, home, away, ready, {
        // `postseason` matters here even though the game is already played:
        // it is what puts the line in June's own book. Without it the only
        // postseason statistics missing from the league would be the user's,
        // because his are the games that arrive down this branch.
        conference: false, standings: true, record: true, postseason: true,
      })
    : playGame(bracket.season, home, away, {
        conference: false,        // tournament play is not the conference race
        homeSlot: homeUsed % 3,
        awaySlot: awayUsed % 3,
        standings: true,
        record: true,
        // A bracket game, which the BIG STAGE badge is the only thing that
        // reads. Set here rather than inferred from the calendar, because a
        // schedule assumption three layers down is how these things go wrong.
        postseason: true,
      });
  if (ready) bracket.preplayed?.delete(pairKey(a, b));
  advancePostseasonDay(bracket.season);
  // June hurts at full severity — stage 16's door. Rolled after the night
  // so tomorrow's pregame hold catches it; derived, so it moves no stream.
  rollHurtsFor(bracket.season, home);
  rollHurtsFor(bracket.season, away);

  const homeWon = summary.homeRuns > summary.awayRuns;
  const game: BracketGame = {
    ...summary,
    round,
    winner: homeWon ? home : away,
    loser: homeWon ? away : home,
  };
  bracket.games.push(game);
  return game;
}

/**
 * Seeding order for a knockout tree.
 *
 * The classic recursive interleave: 1 plays the lowest seed, and the bracket is
 * built so the top two seeds can only meet in the final. Eight teams come out as
 * 1-8, 4-5, 2-7, 3-6, which is the order every printed bracket in the world uses.
 */
export function seedOrder(n: number): number[] {
  let order = [1];
  while (order.length < n) {
    const size = order.length * 2;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed, size + 1 - seed);
    }
    order = next;
  }
  return order;
}

/** One series: two teams, a stack of games, and a winner once somebody clinches. */
export interface Series {
  /** Round index, 0 for the opening round. */
  round: number;
  /** Position within the round, top to bottom. */
  slot: number;
  /** Null until the feeding series has produced somebody. */
  a: number | null;
  b: number | null;
  /** Seed within the whole bracket, 1 based. Zero when the slot is empty. */
  aSeed: number;
  bSeed: number;
  games: BracketGame[];
  winner: number | null;
}

/**
 * A knockout bracket of series.
 *
 * Replaced double elimination, deliberately and with a trade made open-eyed.
 * Double elimination is what college baseball actually plays, and losing and
 * surviving is the best drama the format has. It is also unreadable on a phone:
 * the losers' bracket pairings do not exist until somebody loses, so **there is
 * no full bracket to draw** — the picture can only ever show you the next round.
 * Reported from testing three separate times, ending in "we were supposed to see
 * all the bracket before it all started".
 *
 * A knockout tree can be drawn whole on day one, with every slot in it and TBD
 * where the names have not arrived. Series length carries the drama instead: a
 * best of seven that goes to six is its own story, and it is one the screen can
 * tell in a line.
 */
export interface SeriesBracket {
  season: SeasonState;
  /** Teams in seed order, best first. */
  seeds: number[];
  /** Games needed to take each round. One entry per round. */
  lengths: number[];
  rounds: Series[][];
  /** Which round is being played. */
  roundIndex: number;
  champion: number | null;
  done: boolean;
  /** Teams knocked out, first out first. */
  eliminated: number[];
  /** How many games each team has played here, for rotation order. */
  appearances: Map<number, number>;
  seedOf: Map<number, number>;
}

const ROUND_NAMES: Record<number, string[]> = {
  1: ['Final'],
  2: ['Semifinal', 'Final'],
  3: ['Quarterfinal', 'Semifinal', 'Final'],
  4: ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final'],
  5: ['Round of 32', 'Round of 16', 'Quarterfinal', 'Semifinal', 'Final'],
};

/** What a round is called, given how many rounds the bracket has in total. */
export function roundName(total: number, index: number): string {
  const names = ROUND_NAMES[total];
  return names?.[index] ?? `Round ${index + 1}`;
}

/**
 * Build the whole tree up front.
 *
 * Every slot exists from here, including the ones nobody has qualified for. That
 * is the entire point: the bracket is a thing you can look at before it starts.
 */
export function startSeriesBracket(
  season: SeasonState, seeds: readonly number[], lengths: readonly number[],
): SeriesBracket {
  if (seeds.length < 2) throw new Error('a bracket needs at least two teams');

  // Round up to a power of two. A short field byes its best seeds, which is
  // what a real bracket does with an awkward number of qualifiers.
  let size = 1;
  while (size < seeds.length) size *= 2;
  const totalRounds = Math.log2(size);
  if (lengths.length !== totalRounds) {
    throw new Error(`${totalRounds} rounds need ${totalRounds} series lengths`);
  }

  const order = seedOrder(size);
  const rounds: Series[][] = [];
  for (let r = 0; r < totalRounds; r++) {
    const count = size / 2 ** (r + 1);
    const list: Series[] = [];
    for (let slot = 0; slot < count; slot++) {
      list.push({
        round: r, slot, a: null, b: null, aSeed: 0, bSeed: 0,
        games: [], winner: null,
      });
    }
    rounds.push(list);
  }

  // Fill the opening round from the seeding order.
  const first = rounds[0] as Series[];
  for (let i = 0; i < first.length; i++) {
    const seedA = order[i * 2] as number;
    const seedB = order[i * 2 + 1] as number;
    const s = first[i] as Series;
    s.a = seeds[seedA - 1] ?? null;
    s.b = seeds[seedB - 1] ?? null;
    s.aSeed = seedA;
    s.bSeed = seedB;
    // A bye: the slot exists, nobody is in it, so the other side walks through.
    if (s.a !== null && s.b === null) s.winner = s.a;
    if (s.b !== null && s.a === null) s.winner = s.b;
  }

  const state: SeriesBracket = {
    season, seeds: [...seeds], lengths: [...lengths], rounds,
    roundIndex: 0, champion: null, done: false, eliminated: [],
    appearances: new Map(),
    seedOf: new Map(seeds.map((t, i) => [t, i + 1])),
  };
  promote(state);
  return state;
}

/** Carry decided series into the round above, and settle a finished bracket. */
function promote(state: SeriesBracket): void {
  for (;;) {
    const round = state.rounds[state.roundIndex] as Series[];
    if (!round.every((s) => s.winner !== null)) return;

    const last = state.roundIndex === state.rounds.length - 1;
    if (last) {
      state.champion = round[0]?.winner ?? null;
      state.done = true;
      return;
    }

    const next = state.rounds[state.roundIndex + 1] as Series[];
    for (let i = 0; i < round.length; i++) {
      const from = round[i] as Series;
      const into = next[Math.floor(i / 2)] as Series;
      const seed = from.winner === from.a ? from.aSeed : from.bSeed;
      if (i % 2 === 0) { into.a = from.winner; into.aSeed = seed; }
      else { into.b = from.winner; into.bSeed = seed; }
    }
    for (const s of next) {
      if (s.a !== null && s.b === null) s.winner = s.a;
      if (s.b !== null && s.a === null) s.winner = s.b;
    }
    state.roundIndex += 1;
  }
}

/** Wins needed to take a series of this length. */
export const clincher = (bestOf: number): number => Math.floor(bestOf / 2) + 1;

const winsIn = (s: Series, team: number): number =>
  s.games.filter((g) => g.winner === team).length;

/**
 * Who hosts each game of a series.
 *
 * Alternating from the better seed, so a best of seven gives him four of the
 * seven and a best of three gives him two of the three. Home field is worth
 * something real in this engine, and handing the higher seed every game of a
 * seven game series would make the seeding decide it before anybody played.
 */
export function hostOfGame(s: Series, gameIndex: number): number {
  const better = s.aSeed <= s.bSeed ? s.a : s.b;
  const worse = s.aSeed <= s.bSeed ? s.b : s.a;
  return (gameIndex % 2 === 0 ? better : worse) as number;
}

/** The series this team is due to play in next, if any. */
export function liveSeries(state: SeriesBracket, team: number): Series | null {
  if (state.done) return null;
  const round = state.rounds[state.roundIndex] as Series[];
  return round.find(
    (s) => s.winner === null && (s.a === team || s.b === team),
  ) ?? null;
}

export function nextGameFor(
  state: SeriesBracket, team: number,
): { a: number; b: number; round: string; series: Series } | null {
  const s = liveSeries(state, team);
  if (!s || s.a === null || s.b === null) return null;
  return {
    a: s.a, b: s.b,
    round: roundName(state.rounds.length, s.round),
    series: s,
  };
}

/** One game of one series. */
function playSeriesGame(
  state: SeriesBracket, s: Series, preplayed?: Map<string, GameResult>,
): void {
  if (s.winner !== null || s.a === null || s.b === null) return;

  const home = hostOfGame(s, s.games.length);
  const away = home === s.a ? s.b : s.a;
  const homeUsed = state.appearances.get(home) ?? 0;
  const awayUsed = state.appearances.get(away) ?? 0;
  state.appearances.set(home, homeUsed + 1);
  state.appearances.set(away, awayUsed + 1);

  const label = `${roundName(state.rounds.length, s.round)} · Game ${s.games.length + 1}`;
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
  s.games.push({
    ...summary, round: label,
    winner: homeWon ? home : away,
    loser: homeWon ? away : home,
  });

  const need = clincher(state.lengths[s.round] as number);
  if (winsIn(s, s.a) >= need) { s.winner = s.a; state.eliminated.push(s.b); }
  else if (winsIn(s, s.b) >= need) { s.winner = s.b; state.eliminated.push(s.a); }
}

/**
 * One night of the postseason: a game in every series still being played.
 *
 * Series in a round run side by side, the way real playoff rounds do, so a press
 * moves the whole round on by a game rather than resolving one matchup at a time
 * while the others wait.
 */
export function stepBracket(
  state: SeriesBracket, preplayed?: Map<string, GameResult>,
): void {
  if (state.done) return;
  const round = state.rounds[state.roundIndex] as Series[];
  for (const s of round) playSeriesGame(state, s, preplayed);
  // The whole round played tonight, so tomorrow is one day later. This is what
  // lets a bullpen recover between games instead of the same three arms
  // carrying a team through every round of June.
  advancePostseasonDay(state.season);
  // And the trainer's room stays open in June — stage 16's door, full
  // severity. Everyone who took the field tonight rolls once; derived, so
  // nothing downstream shifts.
  for (const s of round) {
    if (s.a !== null) rollHurtsFor(state.season, s.a);
    if (s.b !== null) rollHurtsFor(state.season, s.b);
  }
  promote(state);
}

/**
 * A bracket, as the plain result everything else reads.
 *
 * The tree comes with it: a finished tournament has to draw exactly like a live
 * one, and rebuilding a bracket from a flat list of games is guesswork.
 */
export function resultOf(state: SeriesBracket): TournamentResult {
  if (!state.done || state.champion === null) throw new Error('bracket is not finished');
  return {
    seeds: state.seeds,
    games: state.rounds.flat().flatMap((x) => x.games),
    champion: state.champion,
    eliminated: state.eliminated,
    rounds: state.rounds,
  };
}

/** The whole thing at once, which is what a simulated season wants. */
export function singleElimination(
  season: SeasonState, seeds: readonly number[], lengths: readonly number[],
): TournamentResult {
  const state = startSeriesBracket(season, seeds, lengths);
  let guard = 0;
  while (!state.done && guard++ < 200) stepBracket(state);
  return resultOf(state);
}

/** Best of N. Higher seed hosts every game, which is close enough at this scale. */
export function bestOf(
  season: SeasonState,
  n: number,
  a: number,
  b: number,
  round = 'Series',
): TournamentResult {
  const needed = Math.floor(n / 2) + 1;
  const bracket: Bracket = {
    season,
    seedOf: new Map([[a, 0], [b, 1]]),
    appearances: new Map(),
    games: [],
  };

  let winsA = 0;
  let winsB = 0;
  while (winsA < needed && winsB < needed) {
    const game = play(bracket, `${round} game ${winsA + winsB + 1}`, a, b);
    if (game.winner === a) winsA += 1; else winsB += 1;
  }

  const champion = winsA > winsB ? a : b;
  return {
    seeds: [a, b],
    games: bracket.games,
    champion,
    eliminated: [champion === a ? b : a],
  };
}

// ---------------------------------------------------------------------------
// The conference tournament
// ---------------------------------------------------------------------------

export interface ConferenceTournament extends TournamentResult {
  conference: string;
  /** Teams that missed the field entirely. */
  missed: number[];
  /**
   * Champion, runner-up, third, fourth — the four this conference sends to
   * the regionals, in the order the bracket itself decided. Absent on results
   * written by the old knockout format; those saves re-run the stage.
   */
  placings?: number[];
  /** The double-elimination structure, so a finished cup draws like a live one. */
  de?: Omit<DoubleElimResult, 'seeds' | 'games' | 'champion' | 'eliminated' | 'placings'>;
}

/**
 * Top `size` teams by conference record. Eight of twelve, so a third of the
 * league is finished in May and finishing ninth costs you something real.
 */
export function conferenceField(
  season: SeasonState,
  conference: string,
  size: number = CONF_FIELD,
): { field: number[]; missed: number[] } {
  // Seed off the recorded regular season order, not a fresh standings call.
  // Tournament games move run differential, which is a standings tiebreaker —
  // recomputing mid-bracket would reseed underneath us. The snapshot is stored
  // conference by conference for the same reason, so filtering it here returns
  // exactly the table the program has been reading all season.
  const global = season.finalOrder ?? standings(season).map((t) => t.index);
  const order = global.filter((i) => season.teams[i]?.conference === conference);
  return { field: order.slice(0, size), missed: order.slice(size) };
}

/** Every conference in the world, in a stable order. */
export function conferenceIds(season: SeasonState): string[] {
  const ids: string[] = [];
  for (const t of season.teams) if (!ids.includes(t.conference)) ids.push(t.conference);
  return ids;
}

export function conferenceTournament(
  season: SeasonState,
  conference: string,
  size: number = CONF_FIELD,
): ConferenceTournament {
  const { field, missed } = conferenceField(season, conference, size);
  const de = runDoubleElim(season, field);
  return {
    ...deAsResult(de),
    conference, missed,
  };
}

/** A finished double elimination, wearing the shape every stage list expects. */
export function deAsResult(
  de: DoubleElim,
): TournamentResult & { placings: number[]; de: ConferenceTournament['de'] } {
  const r = resultOfDE(de);
  return {
    seeds: r.seeds,
    games: r.games,
    champion: r.champion,
    eliminated: r.eliminated,
    placings: r.placings,
    de: { winners: r.winners, losers: r.losers, final: r.final },
  };
}

/** Every conference crowns a champion. Eight of the country's banners a June. */
export function allConferenceTournaments(
  season: SeasonState,
  size: number = CONF_FIELD,
): ConferenceTournament[] {
  return conferenceIds(season).map((id) => conferenceTournament(season, id, size));
}

// ---------------------------------------------------------------------------
// The national tournament
// ---------------------------------------------------------------------------

/**
 * How long each stage's series is.
 *
 * The one place to change the length of June. The conference and national
 * showdowns are double elimination and play single games; everything else is
 * a best-of.
 */
export const SERIES = {
  /** A regional championship: one best of three. */
  regional: 3,
  /** The national championship series. */
  final: 3,
} as const;

/**
 * Teams from each conference tournament: eight of twelve, double elimination.
 *
 * A third of the league is finished in May, and the top four *finishers* of
 * each tournament — read off the bracket, not assigned — go on to the
 * regionals.
 */
export const CONF_FIELD = 8;

/** How many each conference sends on. */
export const CONF_ADVANCE = 4;

/**
 * The four regions, each a pair of conferences.
 *
 * The postseason is a pyramid and this is its middle tier: finish top four in
 * your conference tournament, then win a best-of-three against the
 * neighbouring conference for a regional banner. Sixteen of those series,
 * sixteen regional champions.
 */
export const REGIONS: readonly { id: string; name: string; conferences: readonly string[] }[] = [
  { id: 'SOUTH', name: 'South', conferences: ['GULF', 'ATL'] },
  { id: 'NORTH', name: 'North', conferences: ['NEC', 'GLK'] },
  { id: 'WEST', name: 'West', conferences: ['PAC', 'MTN'] },
  { id: 'CENTRAL', name: 'Central', conferences: ['DES', 'HRT'] },
];

/** Which region a conference belongs to. */
export const regionOf = (conference: string): string =>
  REGIONS.find((r) => r.conferences.includes(conference))?.id ?? 'SOUTH';

/**
 * How many programs the national field seats: sixteen regional champions plus
 * four protected or at-large bids.
 *
 * It is not a number anybody looks up for its own sake — it is the ceiling on
 * how many boards may *require* a bid. A checklist that asks more programs
 * than this to reach the tournament is asking for something the format cannot
 * hand out. `objectivesFor` in `program.ts` is where the ask is spent and a
 * test in `program.test.ts` holds the two together.
 */
export const PROTECTED_BIDS = 4;
export const NATIONAL_BIDS = REGIONS.length * CONF_ADVANCE + PROTECTED_BIDS;

/**
 * Programs that reach the national showdown proper. "Omaha", as the game names
 * the trip.
 *
 * The same number as the field now, and that is the change: a best-of-three
 * opening round used to cut twenty to sixteen before the showdown began, and it
 * was a single-elimination gate standing in front of a double elimination
 * tournament. Everybody who qualifies now plays in the showdown itself, with
 * the bottom four of each half playing their way through a first round they can
 * survive losing.
 */
export const OMAHA_BERTHS = NATIONAL_BIDS;

/** The regional stage: sixteen best-of-three series. */
export const REGIONAL_LENGTHS: readonly number[] = [SERIES.regional];

/** One regional championship series: who, from where, and how it went. */
export interface RegionalSeries extends TournamentResult {
  region: string;
  name: string;
  /** "GULF #1" and the like, so a card can say what each man won to be here. */
  aLabel: string;
  bLabel: string;
}

export interface RegionalResult extends RegionalSeries {}

/**
 * Bracket seeding, by regular season wins and then the standings tiebreakers.
 *
 * `regularRecord` rather than the live one because every caller runs in the
 * middle of June, with earlier rounds already in the books.
 */
function seedByRecord(season: SeasonState, indices: readonly number[]): number[] {
  const teams = indices
    .map((i) => season.teams[i])
    .filter((t): t is TeamRecord => t !== undefined);
  return seedTeams(season, teams, (t) => regularRecord(t).w).map((t) => t.index);
}

/**
 * The sixteen regional pairings: each region crosses its two conferences'
 * finishers, first against fourth and second against third, both directions.
 *
 * A conference that could not fill its four (which the format never produces,
 * but a hand-edited save could) simply fields fewer series.
 */
export function regionalPairing(
  season: SeasonState, cups: readonly ConferenceTournament[],
): { id: string; name: string; a: number; b: number; aLabel: string; bLabel: string }[] {
  void season;
  const finishers = new Map(cups.map((c) => [
    c.conference,
    c.placings ?? [c.champion],
  ]));
  const out: { id: string; name: string; a: number; b: number; aLabel: string; bLabel: string }[] = [];
  for (const r of REGIONS) {
    const [confA, confB] = r.conferences;
    const A = finishers.get(confA ?? '') ?? [];
    const B = finishers.get(confB ?? '') ?? [];
    // A1 v B4, A2 v B3, B1 v A4, B2 v A3 — every series is somebody's champion
    // or contender against the conference next door, and the two champions
    // cannot meet each other for a regional banner.
    const pairs: [number | undefined, number | undefined, string, string][] = [
      [A[0], B[3], `${confA} #1`, `${confB} #4`],
      [A[1], B[2], `${confA} #2`, `${confB} #3`],
      [B[0], A[3], `${confB} #1`, `${confA} #4`],
      [B[1], A[2], `${confB} #2`, `${confA} #3`],
    ];
    for (const [a, b, aLabel, bLabel] of pairs) {
      if (a === undefined || b === undefined) continue;
      out.push({ id: r.id, name: r.name, a, b, aLabel, bLabel });
    }
  }
  return out;
}

/** Every regional series played out. Sixteen champions, sixteen banners. */
export function stageRegionals(
  season: SeasonState, cups: readonly ConferenceTournament[],
): RegionalSeries[] {
  return regionalPairing(season, cups).map((p) => {
    // The better regular season hosts the odd game, which is the last thing
    // those forty five games are still paying for at this stage.
    const seeds = seedByRecord(season, [p.a, p.b]);
    return {
      ...singleElimination(season, seeds, REGIONAL_LENGTHS),
      region: p.id,
      name: p.name,
      aLabel: p.aLabel,
      bLabel: p.bLabel,
    };
  });
}

// ---------------------------------------------------------------------------
// The national field
// ---------------------------------------------------------------------------

/**
 * The four teams the regular season protects.
 *
 * Locked before a postseason game is played: the top four of the final
 * regular-season national table. Protection means the national field cannot
 * happen without them and the opening round cannot touch them. It is not a
 * banner and it is not a seed — a protected team that goes out early in its
 * conference and its regional still travels, and travels humbler.
 */
export function protectedTopFour(season: SeasonState): number[] {
  return rpiOrder(season).slice(0, PROTECTED_BIDS).map((r) => r.team.index);
}

export interface NationalField {
  /** All twenty, in seed order, best first. */
  seeds: number[];
  /** The sixteen who won a regional banner. */
  regionalChampions: number[];
  /** The regular season's locked top four, qualified or not. */
  protectedTeams: number[];
  /** Teams in the field on protection or at-large, not a banner. */
  atLarge: number[];
}

/**
 * Twenty unique teams: sixteen regional champions, every protected team that
 * did not win its regional, and at-large bids off the national table until
 * the field is full.
 *
 * Seeding is the regular season's order with a thumb on the scale for June:
 * a regional banner is worth a bump, and a protected team that failed to win
 * anything keeps its access but not its perch.
 */
export function selectNationalField(
  season: SeasonState, cups: readonly ConferenceTournament[],
  regionals: readonly RegionalSeries[],
): NationalField {
  const regionalChampions = regionals.map((r) => r.champion);
  const protectedTeams = protectedTopFour(season);
  const field = new Set<number>(regionalChampions);
  const atLarge: number[] = [];

  // Protection first: a top-four team that did not win a regional is added,
  // never duplicated.
  for (const t of protectedTeams) {
    if (!field.has(t)) { field.add(t); atLarge.push(t); }
  }

  // Then the best of the rest by the national table until twenty.
  const table = rpiOrder(season).map((r) => r.team.index);
  for (const t of table) {
    if (field.size >= NATIONAL_BIDS) break;
    if (!field.has(t)) { field.add(t); atLarge.push(t); }
  }

  /*
    Seed score: national table position, credited for what June added. A
    regional banner is two rungs, a conference banner one. Protected teams get
    no artificial perch — their regular season already put them high — but
    they can fall past teams that won things they did not.
  */
  const rank = new Map(table.map((t, i) => [t, i]));
  const conferenceChampions = new Set(cups.map((c) => c.champion));
  const score = (t: number): number => {
    let s = rank.get(t) ?? 99;
    if (regionalChampions.includes(t)) s -= 2;
    if (conferenceChampions.has(t)) s -= 1;
    return s;
  };
  const seeds = [...field].sort((a, b) => score(a) - score(b) || (rank.get(a) ?? 99) - (rank.get(b) ?? 99));

  return { seeds, regionalChampions, protectedTeams, atLarge };
}

/**
 * Keep the protected four out of the seeds that have to play their way in.
 *
 * Seeds 13–20 are the ones who land in a play-in round once the field is split,
 * and a top-four regular season is supposed to buy exemption from exactly that.
 * `selectNationalField` gives a protected team no artificial perch, so one that
 * won nothing in June can drift below the line; when it does it swaps up with
 * the lowest unprotected seed above it.
 *
 * This is all that survives of the old opening round, and it is the half worth
 * keeping: the round itself is gone, but the promise the regular season made
 * about it is not.
 */
export function seatProtected(field: NationalField): void {
  const seeds = [...field.seeds];
  for (let i = 12; i < seeds.length; i++) {
    const t = seeds[i]!;
    if (!field.protectedTeams.includes(t)) continue;
    for (let j = 11; j >= 0; j--) {
      const u = seeds[j]!;
      if (!field.protectedTeams.includes(u)) {
        seeds[i] = u; seeds[j] = t;
        break;
      }
    }
  }
  field.seeds.splice(0, field.seeds.length, ...seeds);
}

/**
 * The twenty of the showdown, split into two ten-team double eliminations.
 *
 * Snaked so the top two seeds are on opposite sides and strength spreads:
 * bracket A takes overall 1, 4, 5, 8, 9, 12, 13, 16, 17, 20 — B the rest.
 * Within each half those become seeds 1–10, so the bottom four of each, which
 * is overall 13–20, are the ones who play in. That is the same eight teams the
 * old opening round used to take, arriving at the same place by a route that
 * cannot end their season in one night.
 */
export function splitShowdown(
  field: readonly number[],
): { bracketA: number[]; bracketB: number[] } {
  const A: number[] = [];
  const B: number[] = [];
  field.forEach((t, i) => {
    // 0-indexed snake: A gets 0,3,4,7,8,11,12,15,16,19 — B the rest.
    (i % 4 === 0 || i % 4 === 3 ? A : B).push(t);
  });
  return { bracketA: A, bracketB: B };
}

export interface NationalResult {
  field: NationalField;
  bracketA: TournamentResult & { placings: number[] };
  bracketB: TournamentResult & { placings: number[] };
  /** The championship series between the two bracket champions. */
  final: TournamentResult;
  champion: number;
}

/** The whole national stage at once, for a summer nobody is watching. */
export function stageNational(
  season: SeasonState, cups: readonly ConferenceTournament[],
  regionals: readonly RegionalSeries[],
): NationalResult {
  const field = selectNationalField(season, cups, regionals);
  seatProtected(field);
  const { bracketA, bracketB } = splitShowdown(field.seeds);
  const A = deAsResult(runDoubleElim(season, bracketA));
  const B = deAsResult(runDoubleElim(season, bracketB));
  const final = bestOf(season, SERIES.final, A.champion, B.champion, 'National championship');
  return { field, bracketA: A, bracketB: B, final, champion: final.champion };
}

// ---------------------------------------------------------------------------
// The whole postseason, packaged
// ---------------------------------------------------------------------------

/**
 * How far a program got. Ordered worst to best.
 *
 * 'regional' — finished top four of its conference tournament and played a
 * regional championship series. 'omaha' — reached the national showdown. The
 * last two are the championship series.
 *
 * 'national' is history. It meant "made the twenty-team field but went out in
 * the opening round", and there is no opening round any more — every team that
 * qualifies now plays in the showdown itself. Nothing produces the value, and
 * it stays in the union because saves written before the change still carry it
 * and a history screen must be able to read them.
 */
export type Finish =
  | 'missed' | 'regional' | 'national' | 'omaha' | 'runner-up' | 'champion';

export interface PostseasonSummary {
  /** Conference tournament winners, by team index. Eight of them. */
  conferenceChampions: number[];
  /** Regional series winners: sixteen banners. */
  regionChampions: number[];
  /** The twenty-team national field, in seed order. */
  nationalField?: number[];
  /** The regular season's locked top four. Qualification metadata, not a banner. */
  protectedTeams?: number[];
  champion: number;
  /** Only contains teams that got out of their conference. */
  finish: Record<number, Finish>;
}

/**
 * The postseason, one stage at a time.
 *
 * `runPostseason` does the whole thing in a single call, which is right for the
 * ninety five programs nobody is watching and wrong for the one that is: a coach
 * who wins twenty five games and then sees a summary screen has not been to the
 * postseason, he has been told about it. These functions are the same work,
 * stopped where there is something worth looking at.
 *
 * Each returns plain results, so progress through the stages is ordinary
 * serialisable state and survives a reload like everything else.
 */

/** Freeze the regular season before a bracket game moves a single record. */
export function freezeRegularSeason(season: SeasonState): void {
  for (const t of season.teams) { t.rw = t.w; t.rl = t.l; }
}

/** Stage one: every conference crowns a champion. */
export function stageConferenceTournaments(season: SeasonState): ConferenceTournament[] {
  return allConferenceTournaments(season);
}

/** Reduce the finished stages to the summary a dynasty remembers. */
export function summarize(
  cups: readonly ConferenceTournament[],
  regionals: readonly RegionalSeries[],
  national: NationalResult,
): PostseasonSummary {
  const finish: Record<number, Finish> = {};
  // Reaching the regionals is the postseason proper: everybody in one earned
  // it with a top-four conference finish.
  for (const r of regionals) for (const t of r.seeds) finish[t] = 'regional';
  // Everybody in the field is in the showdown now. The line above this used to
  // mark all twenty 'national' and then promote the sixteen who survived the
  // opening round; with the play-in living inside the winners bracket, there is
  // no group left between "qualified" and "reached the showdown".
  for (const t of national.field.seeds) finish[t] = 'omaha';
  const runnerUp = national.final.eliminated[0];
  if (runnerUp !== undefined) finish[runnerUp] = 'runner-up';
  finish[national.champion] = 'champion';

  return {
    conferenceChampions: cups.map((c) => c.champion),
    regionChampions: regionals.map((r) => r.champion),
    nationalField: national.field.seeds,
    protectedTeams: national.field.protectedTeams,
    champion: national.champion,
    finish,
  };
}

export function runPostseason(season: SeasonState): PostseasonSummary {
  // Freeze the regular season before a single bracket game moves a record. This
  // is the one moment where the boundary is unambiguous, which is why the
  // snapshot lives here rather than being threaded through playGame.
  for (const t of season.teams) { t.rw = t.w; t.rl = t.l; }

  const cups = allConferenceTournaments(season);
  const regionals = stageRegionals(season, cups);
  return summarize(cups, regionals, stageNational(season, cups, regionals));
}

export const FINISH_LABEL: Record<Finish, string> = {
  missed: 'Missed the tournament',
  regional: 'Regional',
  national: 'National tournament',
  omaha: 'Omaha',
  'runner-up': 'National runner-up',
  champion: 'NATIONAL CHAMPION',
};

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------

export interface Award {
  title: string;
  id: PlayerId;
  name: string;
  team: string;
  line: string;
}

interface RosterEntry {
  name: string;
  pos: Position;
  classYear: ClassYear;
  team: TeamRecord;
  isPitcher: boolean;
}

function rosterIndex(season: SeasonState): Map<PlayerId, RosterEntry> {
  const index = new Map<PlayerId, RosterEntry>();
  for (const team of season.teams) {
    for (const p of [...team.team.lineup, ...team.team.bench]) {
      index.set(p.id, { name: p.name, pos: p.pos, classYear: p.classYear, team, isPitcher: false });
    }
    for (const p of [...team.team.rotation, ...team.team.bullpen]) {
      // Never overwrite the lineup entry: a two-way man reads as a position
      // player to the awards, which is how the real award reads the real
      // archetype.
      if (!index.has(p.id)) {
        index.set(p.id, { name: p.name, pos: p.pos, classYear: p.classYear, team, isPitcher: true });
      }
    }
  }
  return index;
}

const ops = (s: BattingSeason): number => onBase(s) + slugging(s);
const rate = (v: number): string => v.toFixed(3).replace(/^0/, '');

/**
 * Pitching value in one number: innings carried, discounted by how many runs
 * came with them. A reliever with a shiny ERA over thirty innings should not
 * beat an ace who carried a hundred.
 */
const pitcherValue = (s: PitchingSeason): number => {
  const ip = inningsPitched(s);
  if (ip <= 0) return 0;
  const leagueEra = 5.0;
  return ip * Math.max(0, leagueEra - era(s)) / 9 + s.k / 45;
};

/**
 * Coach of the Year: four stories, and the one this season told loudest.
 *
 * The first version had one measure — wins against what the roster was worth —
 * and it was a good measure with a bad consequence: the citation read the same
 * every June, so five seasons in, the award was wallpaper. The fix is not a
 * precedence list. Some category always fires (a plus-ten turnaround exists in
 * practically every simulated season), so fixed precedence just swaps one
 * repeated headline for another. Instead each category is scored by how loud
 * it was *this* season — the winner's number divided by that number's spread
 * across the league — and the loudest story wins. Dividing by the per-season
 * standard deviation is what makes wins, win-jumps and run margins comparable
 * at all: each becomes "how far outside a normal season was this".
 *
 * The regression baseline is unchanged and still self-calibrating: fit wins
 * against roster strength across all ninety six programs, and overachievement
 * is distance above the line. It is the one category that can always fire, so
 * it is the fallback when the others have nothing to say.
 */
export type CoachAwardReason =
  | 'overachieved'   // furthest above what his roster was worth
  | 'giantKiller'    // won it all without a top-ten roster
  | 'turnaround'     // biggest one-year jump in wins
  | 'wireToWire';    // conference champion with the country's best run margin

export interface CoachAward {
  team: number;
  school: string;
  wins: number;
  losses: number;
  /** What a roster this good was worth, to one decimal. */
  expected: number;
  strength: number;
  reason: CoachAwardReason;
  /** The headline stat, written here so every screen tells the same story. */
  line: string;
}

/** One story this season could be told as, and how loudly it was told. */
export interface CoachAwardCandidate {
  team: number;
  school: string;
  wins: number;
  losses: number;
  expected: number;
  strength: number;
  reason: CoachAwardReason;
  line: string;
  /**
   * How far outside a normal season this was, on its own category's scale —
   * see {@link TYPICAL_SALIENCE}. One is an ordinary year for this story.
   */
  salience: number;
  /** Before normalisation, which is what the tuning table is measured in. */
  raw: number;
}

/**
 * What a normal year's winner scores, per category, before normalising.
 *
 * The four saliences are not on one scale and treating them as though they were
 * is why the citation read the same every June. Three of them are maxima over
 * different sized pools: overachievement and the turnaround are the largest of
 * ninety six draws, wire-to-wire is the largest of the eight programs that won
 * a league, and the largest of ninety six is systematically further from the
 * mean than the largest of eight. Dividing each by its own typical winner is
 * what makes "how unusual was this, for this kind of story" the question being
 * asked, rather than "which statistic has the fattest tail".
 *
 * Measured with `coachAwardCandidates` over twenty seasons of the full world
 * (seed 4242), taking the median of each category's raw score:
 *
 *   overachieved  2.6    turnaround  2.5    wireToWire  2.0
 *
 * The giant-killer is not a measurement and does not get one. It is binary and
 * it fires perhaps one year in five, so it carries a raw score high enough to
 * win outright whenever it happens — a champion nobody saw coming is the story
 * of that season, full stop.
 */
const TYPICAL_SALIENCE: Record<CoachAwardReason, number> = {
  overachieved: 2.6,
  turnaround: 2.5,
  wireToWire: 2.0,
  giantKiller: 1,
};

/**
 * Every story the season could be told as, loudest first.
 *
 * Exported for the test that holds this honest: a category that cannot fire in
 * a normal world is a promise the game does not keep, and the only way to check
 * that is to look at the candidates rather than at the one that won.
 */
export function coachAwardCandidates(
  season: SeasonState, post?: PostseasonSummary | null,
): CoachAwardCandidate[] {
  const strengthOf = (t: TeamRecord): number => {
    const all: number[] = [
      ...t.team.lineup.map((p) => overallOf(p)),
      ...t.team.rotation.slice(0, 3).map((p) => armValue(p)),
    ];
    return all.length === 0 ? 50 : all.reduce((a, b) => a + b, 0) / all.length;
  };

  const rows = season.teams.map((t) => {
    const rec = { w: t.rw ?? t.w, l: t.rl ?? t.l };
    return { t, strength: strengthOf(t), wins: rec.w, losses: rec.l };
  });
  if (rows.length < 4) return [];

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = (xs: number[]): number => {
    if (xs.length < 2) return 0;
    const m = mean(xs);
    return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
  };
  const ms = mean(rows.map((r) => r.strength));
  const mw = mean(rows.map((r) => r.wins));
  let cov = 0;
  let varS = 0;
  for (const r of rows) {
    cov += (r.strength - ms) * (r.wins - mw);
    varS += (r.strength - ms) ** 2;
  }
  const slope = varS > 0 ? cov / varS : 0;
  const expectedOf = (r: typeof rows[number]): number => mw + slope * (r.strength - ms);

  // A losing season wins nothing, whatever the story. This holds for every
  // category, not just overachievement.
  const eligible = rows.filter((r) => r.wins > r.losses);
  if (eligible.length === 0) return [];

  type Candidate = {
    row: typeof rows[number];
    reason: CoachAwardReason;
    salience: number;
    line: string;
  };
  const candidates: Candidate[] = [];

  // OVERACHIEVER — the original measure, and the guaranteed fallback: some
  // team is always furthest above the line.
  const residuals = rows.map((r) => r.wins - expectedOf(r));
  const residualSd = sd(residuals);
  let best = eligible[0] as typeof rows[number];
  let bestGap = -Infinity;
  for (const r of eligible) {
    const gap = r.wins - expectedOf(r);
    if (gap > bestGap || (gap === bestGap && r.wins > best.wins)) { best = r; bestGap = gap; }
  }
  candidates.push({
    row: best,
    reason: 'overachieved',
    salience: residualSd > 0 ? bestGap / residualSd : 0,
    line: `${bestGap.toFixed(1)} wins above what that roster was worth`,
  });

  /*
    GIANT-KILLER — the national champion at a program that has no business
    winning one.

    Read off what the *school* is rather than what the roster is, and the first
    version is why. It asked for a roster outside the country's top ten, which
    reads reasonably and is very nearly unreachable: the national field is the
    eight conference champions, and a program does not win a twelve team league
    without one of the best rosters in the country. Measured over twenty seasons
    the champion's roster ranked between first and ninth every single time, and
    within the four in Omaha it was the strongest or the second strongest every
    single time. The category could not fire, which is the same defect as a
    board objective the format has no seats for (see `objectivesFor` in
    engine/program.ts) — a promise the game does not keep.

    Prestige is a different axis and it is the one the phrase actually means. A
    modest school with a loaded senior class is exactly the situation the
    `compete` mandate exists for, and when one of those wins it all it is the
    story of the decade rather than of the season. Over the same twenty seasons
    the champion's prestige ranked 1st thirteen times and outside the top twelve
    once, so the gate below fires about one year in twenty.

    Binary and genuinely rare, so it keeps a fixed salience high enough to win
    outright whenever it does fire.
  */
  if (post) {
    const champ = rows.find((r) => r.t.index === post.champion);
    const rank = champ
      ? rows.filter((r) => r.t.prestige > champ.t.prestige).length + 1
      : 0;
    if (champ && rank > 12 && champ.wins > champ.losses) {
      candidates.push({
        row: champ,
        reason: 'giantKiller',
        salience: 4.0,
        line: `national champions, and only the No. ${rank} name in the country`,
      });
    }
  }

  // TURNAROUND — the biggest one-year jump in wins. lastW is only present once
  // a season has rolled over, so this stays silent in year one and for saves
  // from before the field existed.
  const jumps = rows
    .filter((r) => r.t.lastW !== undefined)
    .map((r) => r.wins - (r.t.lastW as number));
  const jumpSd = sd(jumps);
  const turnable = eligible.filter((r) => r.t.lastW !== undefined);
  if (turnable.length > 0 && jumpSd > 0) {
    const top = turnable.reduce((a, b) =>
      (b.wins - (b.t.lastW as number)) > (a.wins - (a.t.lastW as number)) ? b : a);
    const jump = top.wins - (top.t.lastW as number);
    if (jump > 0) {
      candidates.push({
        row: top,
        reason: 'turnaround',
        salience: jump / jumpSd,
        line: `from ${top.t.lastW}-${top.t.lastL} to ${top.wins}-${top.losses} in one year`,
      });
    }
  }

  /*
    WIRE-TO-WIRE — a conference champion who was also nobody's idea of a fair
    fight: dominant in the standings and dominant on the field, all season long.
    Both halves are required, because the margin alone is a stat and the title
    alone is a bracket.

    The first version asked for the country's *outright* best run margin and
    then checked whether that team happened to have won its league. That is two
    independent events rather than one story, and it fired once in twenty
    seasons: the margin leader is usually a team that got knocked over in its
    conference tournament. The candidate is now the best margin *among*
    conference champions, which is the same sentence read in the order it is
    spoken — he won his league, and of everybody who did, he outscored the lot.

    The salience is still measured against the whole country's spread, so a year
    when no champion was especially dominant scores low and loses to whatever
    else the season had to say. That is the part doing the work: the category is
    now allowed to compete every June instead of being decided by a coincidence.
  */
  if (post) {
    const diffOf = (r: typeof rows[number]): number =>
      r.t.gp > 0 ? (r.t.rs - r.t.ra) / r.t.gp : 0;
    const diffSd = sd(rows.map(diffOf));
    const champions = eligible.filter((r) => post.conferenceChampions.includes(r.t.index));
    const leader = champions.length > 0
      ? champions.reduce((a, b) => (diffOf(b) > diffOf(a) ? b : a))
      : null;
    if (leader && diffSd > 0 && diffOf(leader) > 0) {
      const best = Math.max(...rows.map(diffOf));
      const margin = diffOf(leader);
      candidates.push({
        row: leader,
        reason: 'wireToWire',
        salience: margin / diffSd,
        line: margin >= best
          ? `outscored the country by ${margin.toFixed(1)} runs a game, wire to wire`
          : `won the league at ${margin.toFixed(1)} runs a game, wire to wire`,
      });
    }
  }

  return candidates
    .map((c) => ({
      team: c.row.t.index,
      school: c.row.t.def.school,
      wins: c.row.wins,
      losses: c.row.losses,
      expected: Math.round(expectedOf(c.row) * 10) / 10,
      strength: Math.round(c.row.strength),
      reason: c.reason,
      line: c.line,
      salience: c.salience / TYPICAL_SALIENCE[c.reason],
      raw: c.salience,
    }))
    .sort((a, b) => b.salience - a.salience);
}

export function coachOfTheYear(
  season: SeasonState, post?: PostseasonSummary | null,
): CoachAward | null {
  const winner = coachAwardCandidates(season, post)[0];
  if (!winner) return null;
  const { salience, raw, ...award } = winner;
  void salience;
  void raw;
  return award;
}

export function seasonAwards(season: SeasonState): Award[] {
  const roster = rosterIndex(season);
  const gp = Math.max(...season.teams.map((t) => t.gp), 1);
  const minPA = Math.floor(gp * 2.0);
  const minIP = Math.max(1, Math.floor(gp * 1.0));

  const awards: Award[] = [];
  const make = (title: string, id: PlayerId, line: string): void => {
    const who = roster.get(id);
    if (!who) return;
    awards.push({ title, id, name: who.name, team: who.team.def.abbr, line });
  };

  const hitters = [...season.batting.entries()]
    .filter(([id, s]) => s.ab + s.bb + s.hbp >= minPA && !roster.get(id)?.isPitcher);
  const pitchers = [...season.pitching.entries()]
    .filter(([, s]) => inningsPitched(s) >= minIP);

  const best = <T>(rows: Array<[PlayerId, T]>, score: (s: T) => number): [PlayerId, T] | undefined =>
    rows.length === 0 ? undefined
      : rows.reduce((a, b) => (score(b[1]) > score(a[1]) ? b : a));

  const poy = best(hitters, ops);
  if (poy) {
    const [id, s] = poy;
    make('Player of the Year', id,
      `${rate(s.h / Math.max(1, s.ab))} / ${s.hr} HR / ${s.rbi} RBI / ${rate(ops(s))} OPS`);
  }

  const py = best(pitchers, pitcherValue);
  if (py) {
    const [id, s] = py;
    make('Pitcher of the Year', id,
      `${s.w}-${s.l} / ${era(s).toFixed(2)} ERA / ${s.k} K / ${inningsPitched(s).toFixed(1)} IP`);
  }

  const freshHitters = hitters.filter(([id]) => roster.get(id)?.classYear === 'FR');
  const freshPitchers = pitchers.filter(([id]) => roster.get(id)?.classYear === 'FR');
  const bestFreshHitter = best(freshHitters, ops);
  const bestFreshPitcher = best(freshPitchers, pitcherValue);

  // Freshmen arrive on a three year clock before the draft takes them, so this
  // one is really a projection award. Compare the two on the same scale.
  const hitterScore = bestFreshHitter ? (ops(bestFreshHitter[1]) - 0.700) * 12 : -1;
  const pitcherScore = bestFreshPitcher ? pitcherValue(bestFreshPitcher[1]) : -1;

  if (bestFreshHitter && hitterScore >= pitcherScore) {
    const [id, s] = bestFreshHitter;
    make('Freshman of the Year', id,
      `${rate(s.h / Math.max(1, s.ab))} / ${s.hr} HR / ${rate(ops(s))} OPS`);
  } else if (bestFreshPitcher) {
    const [id, s] = bestFreshPitcher;
    make('Freshman of the Year', id,
      `${s.w}-${s.l} / ${era(s).toFixed(2)} ERA / ${s.k} K`);
  }

  return awards;
}

export interface AllConferencePick extends Award {
  position: Position;
}

/** First team: the best bat at each spot on the diamond, plus three arms. */
export function allConference(season: SeasonState): AllConferencePick[] {
  const roster = rosterIndex(season);
  const gp = Math.max(...season.teams.map((t) => t.gp), 1);
  const minPA = Math.floor(gp * 1.5);
  const minIP = Math.max(1, Math.floor(gp * 0.8));

  const picks: AllConferencePick[] = [];
  const spots: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

  for (const pos of spots) {
    let bestId: PlayerId | undefined;
    let bestLine: BattingSeason | undefined;
    for (const [id, s] of season.batting) {
      const who = roster.get(id);
      if (!who || who.pos !== pos) continue;
      if (s.ab + s.bb + s.hbp < minPA) continue;
      if (!bestLine || ops(s) > ops(bestLine)) { bestId = id; bestLine = s; }
    }
    if (bestId && bestLine) {
      const who = roster.get(bestId) as RosterEntry;
      picks.push({
        title: 'All-Conference',
        position: pos,
        id: bestId,
        name: who.name,
        team: who.team.def.abbr,
        line: `${rate(bestLine.h / Math.max(1, bestLine.ab))} / ${bestLine.hr} HR / ${rate(ops(bestLine))} OPS`,
      });
    }
  }

  const arms = [...season.pitching.entries()]
    .filter(([, s]) => inningsPitched(s) >= minIP)
    .sort((a, b) => pitcherValue(b[1]) - pitcherValue(a[1]))
    .slice(0, 3);

  for (const [id, s] of arms) {
    const who = roster.get(id);
    if (!who) continue;
    picks.push({
      title: 'All-Conference',
      position: 'P',
      id,
      name: who.name,
      team: who.team.def.abbr,
      line: `${s.w}-${s.l} / ${era(s).toFixed(2)} ERA / ${s.k} K`,
    });
  }

  return picks;
}

// ---------------------------------------------------------------------------
// On the shape of the national tournament
// ---------------------------------------------------------------------------
//
// The real format is a 64 team field out of roughly 300 Division I programs:
// sixteen four-team regionals, eight best-of-three super regionals, then eight
// teams in Omaha. That is about a fifth of the country reaching the tournament.
//
// This world has 96 programs, and it takes a wider net to the same place. Six of
// each conference's twelve play a tournament — half the country, which is the
// one round that is deliberately generous, because it is the round that makes
// finishing seventh cost something. From there it narrows hard: eight champions,
// four regionals of two, and the last four in Omaha. Four of ninety six is a
// rarer thing than eight of three hundred, which is the intended feeling.
//
// The super regional is the round that is missing, and it is the right one to
// lose: its job is to halve the field, and here the regionals already do that.
// What is kept is the part that carries the weight — every round is a series, so
// a bad Friday does not end your year, and the title is decided by a bracket
// rather than by a single game.

// ---------------------------------------------------------------------------
// The school's own book
// ---------------------------------------------------------------------------

/**
 * Write the finished season into every program's annals.
 *
 * Ninety six rows a year, whoever was coaching where. This is what makes a
 * school a place with a past rather than a prestige number: take a new job in
 * year eleven and its History page can show you the ten seasons it played while
 * you were somewhere else. The user's *personal* career is a different record
 * (the store's history) and the two must never be merged — a coach's 2029 and
 * his school's 2029 agree only while he was in that chair.
 *
 * Idempotent by year, because the year roll is reachable twice from a reload
 * mid-offseason: a season already in a school's book is not written again.
 */
export function recordSchoolAnnals(
  season: SeasonState,
  year: number,
  post: PostseasonSummary | null,
  userTeam?: number,
  userCoach?: string,
): void {
  const rpi = rpiOrder(season);
  const rank = new Map<number, number>();
  rpi.forEach((r, i) => rank.set(r.team.index, i + 1));

  // The final conference tables, frozen if the postseason froze them.
  const order = season.finalOrder ?? standings(season).map((t) => t.index);
  const placeOf = new Map<number, number>();
  const counters = new Map<string, number>();
  for (const idx of order) {
    const conf = season.teams[idx]?.conference;
    if (conf === undefined) continue;
    const n = (counters.get(conf) ?? 0) + 1;
    counters.set(conf, n);
    placeOf.set(idx, n);
  }

  for (const t of season.teams) {
    t.annals ??= [];
    if (t.annals.some((a) => a.year === year)) continue;
    const played = regularRecord(t);
    t.annals.push({
      year,
      w: played.w,
      l: played.l,
      cw: t.cw,
      cl: t.cl,
      confPlace: placeOf.get(t.index) ?? 0,
      rank: rank.get(t.index) ?? 0,
      wonConference: post?.conferenceChampions.includes(t.index) ?? false,
      // A seat in the national field, not merely a June appearance — the
      // finish records every regional participant now.
      madeTournament: post?.nationalField?.includes(t.index)
        ?? (post ? post.finish[t.index] !== undefined && post.finish[t.index] !== 'regional' : false),
      finish: post?.finish[t.index] ?? 'missed',
      ...(t.index === userTeam
        ? (userCoach ? { coach: userCoach } : {})
        : (t.coach ? { coach: t.coach.name } : {})),
    });
  }
}
