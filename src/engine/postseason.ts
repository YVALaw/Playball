// postseason.ts
// Conference tournament and season awards.
//
// The bracket machinery here is generic — double elimination over any field
// size, and best-of-N series — so the same code runs a national bracket the day
// the world grows past one conference. See the note on scope at the bottom.

import { playGame, recordResult, onBase, slugging, era, inningsPitched, standings, rpiOrder } from './season.js';
import type {
  BattingSeason, GameSummary, PitchingSeason, SeasonState, TeamRecord,
} from './season.js';
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
 * A tournament arm is chosen by how many games the team has already played
 * here, so a club that goes deep works down its rotation exactly as it would in
 * a real bracket.
 */
function play(bracket: Bracket, round: string, a: number, b: number): BracketGame {
  const seedA = bracket.seedOf.get(a) ?? Number.MAX_SAFE_INTEGER;
  const seedB = bracket.seedOf.get(b) ?? Number.MAX_SAFE_INTEGER;
  const [home, away] = seedA <= seedB ? [a, b] : [b, a];

  const used = bracket.appearances.get(home) ?? 0;
  bracket.appearances.set(home, used + 1);
  bracket.appearances.set(away, (bracket.appearances.get(away) ?? 0) + 1);

  // A game the manager already played takes precedence over simulating one.
  // It is recorded exactly like any other bracket game, so a hand-played
  // regional counts the same as a simulated one.
  const ready = bracket.preplayed?.get(pairKey(a, b));
  const summary = ready
    ? recordResult(bracket.season, home, away, ready, {
        conference: false, standings: true, record: true,
      })
    : playGame(bracket.season, home, away, {
        conference: false,        // tournament play is not the conference race
        slot: used % 3,
        standings: true,
        record: true,
      });
  if (ready) bracket.preplayed?.delete(pairKey(a, b));

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

/** Standard bracket pairing: best against worst. An odd field byes the top seed. */
/**
 * Who plays whom in a round, without playing it.
 *
 * Best against worst, with a bye to the top seed on an odd field — exactly what
 * `playRound` does, extracted so the app can ask what is coming before anything
 * is decided. That question is the whole basis of letting a manager take his own
 * postseason game rather than watching it get simulated.
 */
export function pairingsOf(teams: readonly number[]): {
  bye: number | null; pairs: [number, number][];
} {
  let list = [...teams];
  let bye: number | null = null;
  if (list.length % 2 === 1) { bye = list[0] as number; list = list.slice(1); }

  const pairs: [number, number][] = [];
  for (let i = 0; i < list.length / 2; i++) {
    pairs.push([list[i] as number, list[list.length - 1 - i] as number]);
  }
  return { bye, pairs };
}

/**
 * The game this team is due to play next in a live bracket, if any.
 *
 * Null when the team has a bye, is already out, or the bracket is finished.
 */
export function nextGameFor(
  state: BracketState, team: number,
): { a: number; b: number; round: string } | null {
  if (state.done) return null;

  if (state.unbeaten.length === 1 && state.oneLoss.length === 1) {
    const [a, b] = [state.unbeaten[0] as number, state.oneLoss[0] as number];
    const round = state.decider ? 'Winner take all' : 'Championship';
    return a === team || b === team ? { a, b, round } : null;
  }

  for (const [list, label] of [
    [state.unbeaten, `Winners round ${state.round}`],
    [state.oneLoss, `Elimination round ${state.round}`],
  ] as [number[], string][]) {
    if (list.length <= 1) continue;
    const { pairs } = pairingsOf(list);
    for (const [a, b] of pairs) {
      if (a === team || b === team) return { a, b, round: label };
    }
  }
  return null;
}

function playRound(
  bracket: Bracket,
  round: string,
  teams: readonly number[],
): { advanced: number[]; defeated: number[] } {
  const advanced: number[] = [];
  const defeated: number[] = [];

  let list = [...teams];
  if (list.length % 2 === 1) {
    advanced.push(list[0] as number);      // bye to the best remaining seed
    list = list.slice(1);
  }

  for (let i = 0; i < list.length / 2; i++) {
    const game = play(bracket, round, list[i] as number, list[list.length - 1 - i] as number);
    advanced.push(game.winner);
    defeated.push(game.loser);
  }

  return { advanced, defeated };
}

/**
 * Double elimination, the format almost every real conference tournament uses.
 * Losing once drops you into the elimination bracket; losing twice sends you
 * home. If a team that has already lost beats the undefeated finalist, they play
 * again — both then have one loss, and the bracket has to be settled on the field.
 */
/**
 * A bracket in progress.
 *
 * Split out of `doubleElimination` so the postseason can be *watched* rather
 * than only computed. The old function ran the whole tournament inside one
 * `while` loop, which is fine for a season being simulated and useless for a
 * player who wants to sit through his own regional — there was no point at which
 * anything could be shown, and no way to hand one game to the manager.
 *
 * The loop is unchanged; it just lives outside the function now.
 */
export interface BracketState {
  season: SeasonState;
  seeds: number[];
  unbeaten: number[];
  oneLoss: number[];
  eliminated: number[];
  round: number;
  games: BracketGame[];
  seedOf: Map<number, number>;
  appearances: Map<number, number>;
  champion: number | null;
  done: boolean;
  /**
   * The unbeaten team has been beaten, and the title is on one more game.
   *
   * A flag rather than a second call inside the same step, because the manager
   * has to be able to play that game too — a bracket that hands you the
   * championship and then simulates the decider behind it is worse than one
   * that simulated both.
   */
  decider: boolean;
}

export function startBracket(season: SeasonState, seeds: readonly number[]): BracketState {
  if (seeds.length < 2) throw new Error('a tournament needs at least two teams');
  return {
    season,
    seeds: [...seeds],
    unbeaten: [...seeds],
    oneLoss: [],
    eliminated: [],
    round: 1,
    games: [],
    seedOf: new Map(seeds.map((t, i) => [t, i])),
    appearances: new Map(),
    champion: null,
    done: false,
    decider: false,
  };
}

/** Play one round. Exactly the body of the old loop. */
export function stepBracket(
  state: BracketState, preplayed?: Map<string, GameResult>,
): void {
  if (state.done) return;

  const bracket: Bracket = {
    season: state.season,
    seedOf: state.seedOf,
    appearances: state.appearances,
    games: state.games,
    ...(preplayed ? { preplayed } : {}),
  };

  if (state.unbeaten.length + state.oneLoss.length <= 1) {
    state.champion = state.unbeaten[0] ?? state.oneLoss[0] ?? (state.seeds[0] as number);
    state.done = true;
    return;
  }

  if (state.unbeaten.length === 1 && state.oneLoss.length === 1) {
    // The title game, and the one after it if the challenger wins. Both are
    // played here one at a time so either can be handed to the manager.
    const unbeaten = state.unbeaten[0] as number;
    const challenger = state.oneLoss[0] as number;
    const game = play(
      bracket,
      state.decider ? 'Championship, if necessary' : 'Championship',
      unbeaten, challenger,
    );
    if (game.winner === unbeaten) {
      state.eliminated.push(challenger);
      state.champion = unbeaten;
      state.done = true;
    } else if (state.decider) {
      state.eliminated.push(unbeaten);
      state.champion = challenger;
      state.done = true;
    } else {
      // Both have one loss now. Winner take all, and it is a separate game.
      state.decider = true;
    }
    return;
  }

  const dropped: number[] = [];
  if (state.unbeaten.length > 1) {
    const r = playRound(bracket, `Winners round ${state.round}`, state.unbeaten);
    state.unbeaten = r.advanced;
    dropped.push(...r.defeated);
  }
  if (state.oneLoss.length > 1) {
    const r = playRound(bracket, `Elimination round ${state.round}`, state.oneLoss);
    state.oneLoss = r.advanced;
    state.eliminated.push(...r.defeated);
  }
  state.oneLoss = [...state.oneLoss, ...dropped];
  state.round += 1;

  // Every round eliminates someone once the elimination bracket is running, so
  // this cannot spin. The guard fails loudly rather than hanging.
  if (state.round > state.seeds.length * 3) throw new Error('bracket failed to converge');
}

/** The whole thing at once, which is what a simulated season wants. */
export function doubleElimination(
  season: SeasonState, seeds: readonly number[],
): TournamentResult {
  const state = startBracket(season, seeds);
  while (!state.done) stepBracket(state);
  return {
    seeds: state.seeds,
    games: state.games,
    champion: state.champion as number,
    eliminated: state.eliminated,
  };
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
}

/**
 * Top `size` teams by conference record, double elimination. Six of eight keeps
 * the same proportion a twelve team league had at eight, so the bottom
 * quarter of the conference still misses out and finishing seventh costs you
 * something real.
 */
export function conferenceField(
  season: SeasonState,
  conference: string,
  size = 6,
): { field: number[]; missed: number[] } {
  // Seed off the recorded regular season order, not a fresh standings call.
  // Tournament games move overall records and run differential, which are
  // standings tiebreakers — recomputing mid-bracket would reseed underneath us.
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
  size = 6,
): ConferenceTournament {
  const { field, missed } = conferenceField(season, conference, size);
  return { ...doubleElimination(season, field), conference, missed };
}

/** Every conference crowns a champion. Eight automatic bids to the national field. */
export function allConferenceTournaments(
  season: SeasonState,
  size = 6,
): ConferenceTournament[] {
  return conferenceIds(season).map((id) => conferenceTournament(season, id, size));
}

// ---------------------------------------------------------------------------
// The national tournament
// ---------------------------------------------------------------------------

/**
 * Sixteen of sixty four programs, a quarter of the world. The real tournament
 * takes 64 of roughly 300 Division I schools — about a fifth — so a quarter is
 * the honest analogue at this scale, and it leaves the field evenly divisible
 * into four regionals of four.
 *
 * Eight of the sixteen are automatic: win your conference and nobody can leave
 * you out. The other eight are chosen on RPI, which is what makes a soft
 * non-conference schedule cost something.
 */
export const FIELD_SIZE = 16;

export interface Bid {
  team: number;
  /** An automatic bid is a conference title. Everyone else is chosen. */
  kind: 'automatic' | 'at-large';
  conference: string;
  rpi: number;
}

export interface NationalTournament {
  field: Bid[];
  regionals: TournamentResult[];
  /** The four regional winners, one four team double elimination. */
  omaha: TournamentResult;
  champion: number;
}

/**
 * Selection Monday. Every conference champion is in automatically, however they
 * finished in the regular season — win your tournament and nobody can leave you
 * out. The rest of the field is chosen on RPI, which is why non-conference
 * scheduling matters: a soft schedule shows up here.
 */
export function selectField(
  season: SeasonState,
  champions: readonly number[],
  size = FIELD_SIZE,
): Bid[] {
  const rpiOf = new Map(rpiOrder(season).map((r) => [r.team.index, r.rpi]));
  const confOf = (i: number): string => season.teams[i]?.conference ?? '';
  const bid = (team: number, kind: Bid['kind']): Bid =>
    ({ team, kind, conference: confOf(team), rpi: rpiOf.get(team) ?? 0 });

  const automatic = champions.map((t) => bid(t, 'automatic'));
  const taken = new Set(champions);

  const atLarge = [...rpiOf.entries()]
    .filter(([team]) => !taken.has(team))
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(0, size - automatic.length))
    .map(([team]) => bid(team, 'at-large'));

  // Seeded on RPI regardless of how they got in.
  return [...automatic, ...atLarge].sort((a, b) => b.rpi - a.rpi);
}

/**
 * Serpentine the seeded field into regionals so each one gets a band from the
 * top, the second quarter, the third and the bottom. The real thing is done by a
 * committee balancing geography and avoiding conference rematches; this is the
 * honest mechanical version of the same idea.
 */
function intoRegionals(field: readonly Bid[], count: number): number[][] {
  const bands: number[][] = [];
  for (let b = 0; b < 4; b++) {
    bands.push(field.slice(b * count, (b + 1) * count).map((x) => x.team));
  }
  const regionals: number[][] = [];
  for (let r = 0; r < count; r++) {
    const group: number[] = [];
    for (let b = 0; b < 4; b++) {
      const band = bands[b] as number[];
      const pick = b % 2 === 0 ? band[r] : band[count - 1 - r];
      if (pick !== undefined) group.push(pick);
    }
    regionals.push(group);
  }
  return regionals;
}

/**
 * Which four teams meet in each regional, without playing a game.
 *
 * The app needs the groups before the results so it can find the one its own
 * team is in and hand those games to the manager, leaving the rest to simulate.
 */
export function regionalGroups(field: readonly Bid[]): number[][] {
  return intoRegionals(field, Math.max(1, Math.floor(field.length / 4)));
}

/** A live bracket that has finished, as the plain result everything else reads. */
export function resultOf(state: BracketState): TournamentResult {
  if (!state.done || state.champion === null) throw new Error('bracket is not finished');
  return {
    seeds: state.seeds,
    games: state.games,
    champion: state.champion,
    eliminated: state.eliminated,
  };
}

/**
 * Regionals, then Omaha.
 *
 * Four four-team double elimination regionals out of a sixteen team field, and
 * the four survivors play one more double elimination for the title.
 */
export function nationalTournament(
  season: SeasonState,
  champions: readonly number[],
  size = FIELD_SIZE,
): NationalTournament {
  const field = selectField(season, champions, size);
  const regionalCount = Math.max(1, Math.floor(field.length / 4));

  const regionals = intoRegionals(field, regionalCount)
    .map((group) => doubleElimination(season, group));

  // Omaha. The four regional winners, one double elimination, and whoever is
  // standing at the end is the national champion.
  //
  // The real tournament puts a best-of-three super regional in between and then
  // takes eight to Omaha, but eight of sixty four would be an eighth of every
  // program in the world reaching the College World Series, which would make it
  // routine. Four out of sixty four is the same rarity the real thing has, and
  // it keeps Omaha the thing you remember a season for.
  const omaha = doubleElimination(season, regionals.map((r) => r.champion));

  return { field, regionals, omaha, champion: omaha.champion };
}

// ---------------------------------------------------------------------------
// The whole postseason, packaged
// ---------------------------------------------------------------------------

/** How far a program got. Ordered worst to best. */
export type Finish =
  | 'missed' | 'regional' | 'omaha' | 'runner-up' | 'champion';

export interface PostseasonSummary {
  /** Conference tournament winners, by team index. Eight automatic bids. */
  conferenceChampions: number[];
  field: Bid[];
  champion: number;
  /** Only contains teams that made the national field. */
  finish: Record<number, Finish>;
}

/**
 * Run every conference tournament, then the national bracket, and reduce it to
 * what a dynasty actually wants to remember: who won their league, who made the
 * field, and how far each of them got.
 */
/**
 * The postseason, one stage at a time.
 *
 * `runPostseason` does the whole thing in a single call, which is right for the
 * sixty three programs nobody is watching and wrong for the one that is: a coach
 * who wins twenty five games and then sees a summary screen has not been to the
 * postseason, he has been told about it. These four functions are the same work,
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

/** Stage two: selection. Who is in, and who was left out. */
export function stageSelection(
  season: SeasonState, champions: readonly number[], size = FIELD_SIZE,
): Bid[] {
  return selectField(season, champions, size);
}

/** Stage three: the regionals. */
export function stageRegionals(
  season: SeasonState, field: readonly Bid[],
): TournamentResult[] {
  return regionalGroups(field).map((g) => doubleElimination(season, g));
}

/** Stage four: Omaha, and a champion. */
export function stageOmaha(
  season: SeasonState, regionals: readonly TournamentResult[],
): TournamentResult {
  return doubleElimination(season, regionals.map((r) => r.champion));
}

/** Reduce the finished stages to the summary a dynasty remembers. */
export function summarize(
  cups: readonly ConferenceTournament[],
  field: readonly Bid[],
  regionals: readonly TournamentResult[],
  omaha: TournamentResult,
): PostseasonSummary {
  const finish: Record<number, Finish> = {};
  for (const bid of field) finish[bid.team] = 'regional';
  for (const r of regionals) finish[r.champion] = 'omaha';
  const runnerUp = omaha.eliminated[omaha.eliminated.length - 1];
  if (runnerUp !== undefined) finish[runnerUp] = 'runner-up';
  finish[omaha.champion] = 'champion';

  return {
    conferenceChampions: cups.map((c) => c.champion),
    field: [...field],
    champion: omaha.champion,
    finish,
  };
}

export function runPostseason(season: SeasonState, size = FIELD_SIZE): PostseasonSummary {
  // Freeze the regular season before a single bracket game moves a record. This
  // is the one moment where the boundary is unambiguous, which is why the
  // snapshot lives here rather than being threaded through playGame.
  for (const t of season.teams) { t.rw = t.w; t.rl = t.l; }

  const cups = allConferenceTournaments(season);
  const conferenceChampions = cups.map((c) => c.champion);
  const nat = nationalTournament(season, conferenceChampions, size);

  const finish: Record<number, Finish> = {};
  for (const bid of nat.field) finish[bid.team] = 'regional';
  for (const r of nat.regionals) finish[r.champion] = 'omaha';

  // The last team knocked out of Omaha is the one that lost the deciding game.
  const runnerUp = nat.omaha.eliminated[nat.omaha.eliminated.length - 1];
  if (runnerUp !== undefined) finish[runnerUp] = 'runner-up';
  finish[nat.champion] = 'champion';

  return {
    conferenceChampions,
    field: nat.field,
    champion: nat.champion,
    finish,
  };
}

export const FINISH_LABEL: Record<Finish, string> = {
  missed: 'Missed the tournament',
  regional: 'Regional',
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
      index.set(p.id, { name: p.name, pos: p.pos, classYear: p.classYear, team, isPitcher: true });
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
// This world has 64 programs in total, so the same proportions give a 16 team
// field, and 16 teams do not stretch to three rounds without making each one
// trivial. The super regional is the round that goes: it is the one whose job —
// cutting the field in half — the regionals already do here.
//
// What is left keeps the two things that carry the weight. A regional is still
// four teams and double elimination, so a bad Friday does not end your year but
// two of them do. Omaha is still the last four, which out of 64 programs is the
// same rarity it has in the real thing, and it is still decided by a bracket
// rather than a single game.
