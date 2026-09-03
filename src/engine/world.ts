// world.ts
// The country moves — stage 12.
//
// Two systems that make ninety-six programs behave like a country rather than
// a table: conference realignment, and the rivalry finally doing something.
// Both are **derived, never drawn** — the same discipline as the economy — so
// a reload cannot re-roll who defected, and not one golden moves.
//
// ---------------------------------------------------------------------------
// Realignment
// ---------------------------------------------------------------------------
//
// The model is a trade, not a migration. Every move is a one-for-one swap —
// the program that outgrew its league changes places with the one sliding out
// of a better one — because the schedule generator builds from the conference
// groups and equal-sized leagues are a structural invariant nobody gets to
// break. The realistic reading is the honest one too: a chair only opens in a
// power conference when somebody falls out of it.
//
// **The user's program never moves down against its will.** Moving up is an
// invitation a board never refuses, so it happens and the inbox frames it as
// the good news it is; being relegated by an algorithm three years into a
// rebuild is the "most likely to feel arbitrary" case the plan flagged, and
// the answer is that it does not happen to you. Rivals rise and fall by the
// same rule you rise by.

import type { SeasonState } from './season.js';
import { regionOf } from './postseason.js';

/** One realignment: two programs change places. */
export interface Realignment {
  /** The riser: outgrew his league. */
  up: number;
  /** The faller: slid out of a better one. */
  down: number;
  /** The conferences they trade. */
  upTo: string;
  downTo: string;
}

/** The same stable string hash the economy and the classroom use. */
function hash(s: string): number {
  let h = 7919;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** How far a program must outgrow its league before the country notices. */
const RISE_GAP = 15;
/** How far one must slide before a better league shows him the door. */
const SLIDE_GAP = 12;
/** Roughly one winter in three moves somebody. "Every few years." */
const FIRES = 34;

/**
 * Which regions touch which — the country's map, for the winter's moves.
 *
 * A program changes leagues the way real ones do: into its own region or the
 * one next door, never across the country. Reported from a long run — "a
 * 2028 run sent Piedmont State to the Pacific" — and decided September 2,
 * night (`06` §U): with "the conference IS the region" as core fiction, a
 * cross-country trade breaks the world's own story. Unknown conferences (the
 * tests' synthetic leagues) all fall back to one region and stay tradeable.
 */
const NEIGHBOURS: Record<string, readonly string[]> = {
  SOUTH: ['CENTRAL', 'NORTH'],
  NORTH: ['SOUTH', 'CENTRAL'],
  CENTRAL: ['SOUTH', 'NORTH', 'WEST'],
  WEST: ['CENTRAL'],
};

const nearEnough = (a: string, b: string): boolean => {
  const ra = regionOf(a);
  const rb = regionOf(b);
  return ra === rb || (NEIGHBOURS[ra] ?? []).includes(rb);
};

/**
 * The winter's move, if the country makes one. Pure and derived: the same
 * world, year and standings always produce the same trade.
 *
 * The riser is the program with the biggest positive gap over its own
 * conference's average prestige; the faller is the weakest program in the
 * strongest conference the riser could join, provided he has genuinely slid.
 * Nobody trades into the league he is already in, and the user's chair is
 * skipped when it would be the one relegated.
 */
export function realignmentFor(
  worldKey: string, year: number,
  teams: readonly { index: number; conference: string; prestige: number }[],
  userTeam: number,
): Realignment | null {
  if (hash(`${worldKey}:realign:${year}`) % 100 >= FIRES) return null;

  const confs = new Map<string, number[]>();
  for (const t of teams) {
    const list = confs.get(t.conference) ?? [];
    list.push(t.index);
    confs.set(t.conference, list);
  }
  if (confs.size < 2) return null;

  const avg = new Map<string, number>();
  for (const [id, list] of confs) {
    avg.set(id, list.reduce((a, i) => a + (teams.find((t) => t.index === i)?.prestige ?? 0), 0)
      / Math.max(1, list.length));
  }

  // The riser: biggest positive gap over his own league's average.
  let up: { index: number; conference: string; prestige: number } | null = null;
  let upGap = RISE_GAP;
  for (const t of teams) {
    const gap = t.prestige - (avg.get(t.conference) ?? 50);
    if (gap >= upGap) { up = t; upGap = gap; }
  }
  if (!up) return null;

  // The faller: the weakest man in the strongest league above the riser's,
  // provided he has genuinely slid — and never the user's chair.
  const better = [...avg.entries()]
    .filter(([id, a]) => id !== up!.conference && a > (avg.get(up!.conference) ?? 0)
      // Geography holds: his own region, or the one next door. A winter with
      // no near-enough league simply passes — rarer moves beat absurd ones.
      && nearEnough(up!.conference, id))
    .sort((a, b) => b[1] - a[1]);
  for (const [confId, confAvg] of better) {
    const weakest = (confs.get(confId) ?? [])
      .map((i) => teams.find((t) => t.index === i)!)
      .filter((t) => t.index !== userTeam)
      .sort((a, b) => a.prestige - b.prestige)[0];
    if (weakest && confAvg - weakest.prestige >= SLIDE_GAP) {
      return {
        up: up.index,
        down: weakest.index,
        upTo: confId,
        downTo: up.conference,
      };
    }
  }
  return null;
}

/** Apply the trade to the records the next schedule will be built from. */
export function applyRealignment(
  teams: { index: number; conference: string }[], move: Realignment,
): void {
  const riser = teams.find((t) => t.index === move.up);
  const faller = teams.find((t) => t.index === move.down);
  if (!riser || !faller) return;
  riser.conference = move.upTo;
  faller.conference = move.downTo;
}

// ---------------------------------------------------------------------------
// The rivalry
// ---------------------------------------------------------------------------

/** This season's head-to-head between two programs, from the results log. */
export function headToHead(
  season: Pick<SeasonState, 'results'>, a: number, b: number,
): { w: number; l: number } {
  let w = 0;
  let l = 0;
  for (const r of season.results) {
    const ours = r.home === a && r.away === b ? 'home'
      : r.home === b && r.away === a ? 'away' : null;
    if (!ours) continue;
    const aRuns = ours === 'home' ? r.homeRuns : r.awayRuns;
    const bRuns = ours === 'home' ? r.awayRuns : r.homeRuns;
    if (aRuns > bRuns) w++;
    else l++;
  }
  return { w, l };
}

/**
 * What tonight is worth, when tonight is part of a three-game series.
 *
 * The half of R8 the overhaul left out: the game number and the lead shipped
 * with stage 4, and the *stake* — what a win actually settles — did not.
 * Returns null when tonight settles nothing worth a line.
 */
export function seriesStake(gamesPlayed: number, yourWins: number): string | null {
  const theirs = gamesPlayed - yourWins;
  if (gamesPlayed === 1 && yourWins === 1) return 'A win takes the series.';
  if (gamesPlayed === 2 && yourWins === 1) return 'The decider.';
  if (gamesPlayed === 2 && yourWins === 2) return 'The sweep is on the table.';
  if (gamesPlayed === 2 && theirs === 2) return 'The salvage game.';
  return null;
}
