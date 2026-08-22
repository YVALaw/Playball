// scouting.ts
// What you think a recruit is, which is not what he is.
//
// A recruiting board that showed true ratings would make the whole exercise
// arithmetic: sort by the number, spend on the top of the list, done. The reason
// recruiting is a decision at all is that you are buying a *guess*, and the
// guess is worse the further down the board you look — nobody has watched the
// two star from Wyoming as closely as the five star from Texas.
//
// The error is stable per player. Refreshing a screen does not re-roll a scout's
// opinion, and two coaches looking at the same recruit see the same report.

import { overallOf } from './ratings.js';
import type { Player } from './types.js';

/** A stable pseudo-random in [0,1) from a string and a salt. */
function noise(seed: string, salt: number): number {
  let h = salt * 2654435761;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const v = Math.sin(h * 0.0001 + salt * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * How far off a scouting report can be, in rating points.
 *
 * Wider for the players nobody drove out to see. A five star has been watched by
 * everybody and his report is close to right; a one star is a rumour with a
 * height attached.
 */
export function scoutingError(stars: number): number {
  return 3 + (5 - stars) * 2.6;
}

/**
 * The reported value of one rating.
 *
 * Rounded to the nearest five below four stars, because a scout who has seen a
 * player twice does not come back with "63" — precision that is not there is
 * itself a lie, and showing it teaches the player to trust the number.
 */
export function scouted(id: string, stars: number, rating: number, salt: number): number {
  const spread = scoutingError(stars);
  const off = (noise(id, salt) - 0.5) * 2 * spread;
  const raw = Math.max(1, Math.min(99, Math.round(rating + off)));
  return stars >= 4 ? raw : Math.round(raw / 5) * 5;
}

/** The band a scout will commit to, rather than a single number. */
export function scoutedRange(
  id: string, stars: number, rating: number, salt: number,
): { low: number; high: number } {
  const mid = scouted(id, stars, rating, salt);
  const spread = Math.round(scoutingError(stars) * 0.7);
  return {
    low: Math.max(1, mid - spread),
    high: Math.min(99, mid + spread),
  };
}

/** Reported overall, from the same machinery. */
export const scoutedOverall = (p: Player, stars: number): number =>
  scouted(p.id, stars, overallOf(p), 1);

/**
 * What the scouts think he might become — a grade, not a number.
 *
 * Showing a numeric ceiling collapses recruiting into arithmetic: sort by it and
 * take the top of the list. Nobody in the room knows what an eighteen year old
 * becomes, and a board that pretends otherwise removes the only interesting part
 * of the job.
 *
 * The grade is deliberately coarse and deliberately wrong sometimes. The error
 * is much wider than on current ability, because projection is the hard part —
 * so a HIGH grade is a bet rather than a promise, and the gem and the bust both
 * live inside the same label. That is what makes finding one feel like anything.
 */
/**
 * One letter scale for ceilings, used for recruits and for your own roster.
 *
 * Words like FRINGE meant nothing to anybody who had not written them, and a
 * number meant too much: a ceiling of 84 reads as a fact when it is a guess.
 * A letter is coarse enough to stay honest and short enough to sit in a table.
 * S+ is the top of the game; D is a player who is already what he will be.
 */
export type PotentialGrade = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D' | '?';

export const POTENTIAL_BLURB: Record<PotentialGrade, string> = {
  'S+': 'Scouts think there is a star in there.',
  S: 'Very high ceiling, if it ever comes together.',
  A: 'Real room to grow.',
  B: 'Should become a useful college player.',
  C: 'A little left to unlock, they think.',
  D: 'What you see is close to what you get.',
  '?': 'Nobody has seen enough of him to say.',
};

/** Ceilings you already know: your own players, whose development you run. */
export function potentialGrade(potential: number): PotentialGrade {
  // Calibrated against the league: the median college player projects to about
  // 53 and the ninetieth percentile to 71, so a scale pinned at 95 for S+ with
  // even spacing below it would grade nearly everybody D and say nothing.
  if (potential >= 95) return 'S+';
  if (potential >= 85) return 'S';
  if (potential >= 74) return 'A';
  if (potential >= 63) return 'B';
  if (potential >= 50) return 'C';
  return 'D';
}

export function scoutedPotential(p: Player, stars: number): PotentialGrade {
  // Barely anybody has watched a one star. His grade is a shrug, and saying so
  // is more honest than inventing a number.
  if (stars <= 1 && noise(p.id, 21) > 0.45) return '?';

  // Weighted toward what he can already do, because that is what anybody has
  // actually watched. Reading the true ceiling straight off meant a raw player
  // — ordinary now, enormous later — was graded ELITE on the strength of a
  // future nobody had seen, and the gem announced itself. Grading mostly on
  // present ability is what lets him hide in plain sight.
  const spread = scoutingError(stars) * 2.0;
  const visible = overallOf(p) * 0.72 + p.potential * 0.28;
  const guess = visible + (noise(p.id, 2) - 0.5) * 2 * spread;

  // Thresholds sit on the blend, not on the ceiling, so they are lower than the
  // ones a known ceiling is graded against. Same letters, because a recruit and
  // a sophomore have to be comparable on the board — that comparison is the
  // whole reason anybody takes a project over a finished player.
  // S and S+ are meant to be the players a program remembers, so they are set
  // where a class of five hundred produces a handful rather than a page of them.
  if (guess >= 86) return 'S+';
  if (guess >= 78) return 'S';
  if (guess >= 68) return 'A';
  if (guess >= 58) return 'B';
  if (guess >= 49) return 'C';
  return 'D';
}

/** The true ceiling, for a player already on your roster. */
export const knownPotential = (p: Player): number => p.potential;

// ---------------------------------------------------------------------------
// The high school line
// ---------------------------------------------------------------------------

export interface SchoolLine {
  label: string;
  value: string;
}

/**
 * What he did last spring.
 *
 * Derived from his real ratings so the numbers agree with the player — a slugger
 * has slugger's numbers — but against high school pitching, which is why they
 * look absurd next to a college line. That gap is the point: a .500 hitter in
 * high school is a normal recruit, not a superstar, and a board that showed
 * college-scaled numbers would quietly mislead about what a prospect is.
 */
export function highSchoolLine(player: Player): SchoolLine[] {
  const id = player.id;

  if (player.type === 'pitcher') {
    const era = Math.max(0.28, 3.6 - (overallOf(player) - 45) * 0.055 + noise(id, 7) * 0.7);
    const ip = 48 + Math.round(noise(id, 8) * 34);
    const k = Math.round(ip * (0.9 + (player.stuff - 45) * 0.022));
    const bb = Math.round(ip * (0.42 - (player.control - 45) * 0.004));
    const w = Math.round((ip / 7) * (0.55 + noise(id, 9) * 0.3));
    return [
      { label: 'ERA', value: era.toFixed(2) },
      { label: 'W-L', value: `${w}-${Math.max(0, Math.round(ip / 7) - w)}` },
      { label: 'IP', value: ip.toFixed(1) },
      { label: 'K', value: String(k) },
      { label: 'BB', value: String(Math.max(2, bb)) },
      { label: 'WHIP', value: (1.05 - (player.control - 45) * 0.006 + noise(id, 10) * 0.2).toFixed(2) },
    ];
  }

  const ab = 78 + Math.round(noise(id, 11) * 30);
  const avg = Math.min(0.680, 0.300 + (player.contact - 40) * 0.0062 + noise(id, 12) * 0.05);
  const hits = Math.round(ab * avg);
  const hr = Math.max(0, Math.round((player.power - 42) * 0.30 + noise(id, 13) * 3));
  const sb = Math.max(0, Math.round((player.speed - 45) * 0.42 + noise(id, 14) * 5));
  return [
    { label: 'AVG', value: avg.toFixed(3).replace(/^0/, '') },
    { label: 'AB', value: String(ab) },
    { label: 'H', value: String(hits) },
    { label: 'HR', value: String(hr) },
    { label: 'RBI', value: String(Math.round(hits * 0.55 + hr * 1.6)) },
    { label: 'SB', value: String(sb) },
  ];
}
