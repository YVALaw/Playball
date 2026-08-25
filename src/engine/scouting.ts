// scouting.ts
// What a ceiling is called, and what a recruit did last spring.
//
// Two things live here that the rest of the game agrees on. The letter scale a
// ceiling is written in — the same one for a recruit and for a sophomore you
// already own, because the whole reason anybody takes a project over a finished
// player is that the two can be compared. And the stable noise every scouting
// report is cut from: refreshing a screen does not re-roll a scout's opinion,
// and two coaches looking at the same recruit see the same report.
//
// What a recruit's report actually *says* is in `recruiting.ts`, because its
// width is a property of the coach reading it rather than of the player.

import { overallOf } from './ratings.js';
import type { Player } from './types.js';

/**
 * A stable pseudo-random in [0,1) from a string and a salt.
 *
 * Exported because the recruiting board's estimates have to be the same numbers
 * on every render and after a reload, which means they can only be hashed out of
 * things the save already holds — an id and a constant.
 */
export function scoutNoise(seed: string, salt: number): number {
  let h = salt * 2654435761;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const v = Math.sin(h * 0.0001 + salt * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * One letter scale for ceilings, used for recruits and for your own roster.
 *
 * Words like FRINGE meant nothing to anybody who had not written them, and a
 * number meant too much: a ceiling of 84 reads as a fact when it is a guess.
 * A letter is coarse enough to stay honest and short enough to sit in a table.
 * S+ is the top of the game; D is a player who is already what he will be.
 *
 * '?' is not a grade a player *has*. It is what a screen prints where a ceiling
 * is none of your business — a rival's freshman — and it sorts below D.
 */
export type PotentialGrade = 'S+' | 'S' | 'A+' | 'A' | 'B' | 'C' | 'D' | '?';

/**
 * Where S+ starts, and therefore where ordinary generation has to stop.
 *
 * Kept as a name rather than written twice, because the two numbers below are
 * the same decision seen from either side and a gap opening between them would
 * quietly let an S+ into a recruiting class without anybody editing the gate.
 */
const S_PLUS_FLOOR = 95;

/**
 * The highest ceiling anything the game generates on its own may carry.
 *
 * S+ is not a grade the world produces. It belongs to a store player, and the
 * only honest way to reserve it is to stop the *number* short rather than to
 * cap the letter. Development pulls a man toward his raw potential, the
 * scouting bands are cut from it, and the draft is decided by what he grew
 * into — so a player sitting at 97 whose card read S would be a lie three
 * separate systems could see through, and the first coach to watch a supposed
 * S outgrow every S in the country would be right to call it a bug.
 *
 * One below `S_PLUS_FLOOR`, applied in `projectPotential` — the single funnel
 * every generated player passes through, whether he arrives in a recruiting
 * class, as a walk-on, or in the roster a rival program starts the world with.
 * A store player is made by computing his ceiling **without** this clamp, and
 * that deliberate bypass is the whole reason the cap is a named export rather
 * than a literal buried in a `Math.min`.
 *
 * This does not chase a man who *earns* his way past it. `develop` revises a
 * ceiling upward when a player clears it, because a ceiling somebody has
 * already beaten is not a ceiling; measured over four years of development that
 * happens to nobody, since a career closes only a fraction of the gap it starts
 * with. The cap governs what is handed out, not what is achieved.
 */
export const GENERATED_POTENTIAL_CAP = S_PLUS_FLOOR - 1;

/** Ceilings you already know: your own players, whose development you run. */
export function potentialGrade(potential: number): PotentialGrade {
  // Calibrated against the league: the median college player projects to about
  // 53 and the ninetieth percentile to 71, so a scale pinned at 95 for S+ with
  // even spacing below it would grade nearly everybody D and say nothing.
  //
  // The top of the ladder is cut far tighter than that spacing suggests, and
  // that is the point of it. S began at 85 and arrived nine times in a national
  // class of seven hundred and twenty — often enough that the best grade in the
  // game was a thing you waited for rather than a thing you found. It starts at
  // 92 now, which is two or three men in the entire country in a year. A+ took
  // over the band S vacated, so the population of players who are visibly
  // special is exactly what it always was; only the name of its top sliver
  // moved, and only that sliver got rare.
  if (potential >= S_PLUS_FLOOR) return 'S+';
  if (potential >= 92) return 'S';
  if (potential >= 85) return 'A+';
  if (potential >= 74) return 'A';
  if (potential >= 63) return 'B';
  if (potential >= 50) return 'C';
  return 'D';
}

/**
 * The grades in order, worst first, so a range of them can be written down.
 *
 * '?' is left out on purpose: it is the absence of a grade, and putting it at
 * the bottom of a ladder would let a screen ask whether a shrug is better than
 * a D.
 */
export const GRADE_LADDER: readonly PotentialGrade[] =
  ['D', 'C', 'B', 'A', 'A+', 'S', 'S+'];

/**
 * The best grade the game will hand out to a player it made itself.
 *
 * Read off the cap rather than written down, so it can only ever be the truth.
 * Anything drawing a range of grades wants this as its top: a span that reached
 * for S+ would be naming a grade nobody in the world can hold.
 */
export const TOP_GENERATED_GRADE: PotentialGrade =
  potentialGrade(GENERATED_POTENTIAL_CAP);

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
    const era = Math.max(0.28, 3.6 - (overallOf(player) - 45) * 0.055 + scoutNoise(id, 7) * 0.7);
    const ip = 48 + Math.round(scoutNoise(id, 8) * 34);
    const k = Math.round(ip * (0.9 + (player.stuff - 45) * 0.022));
    const bb = Math.round(ip * (0.42 - (player.control - 45) * 0.004));
    const w = Math.round((ip / 7) * (0.55 + scoutNoise(id, 9) * 0.3));
    return [
      { label: 'ERA', value: era.toFixed(2) },
      { label: 'W-L', value: `${w}-${Math.max(0, Math.round(ip / 7) - w)}` },
      { label: 'IP', value: ip.toFixed(1) },
      { label: 'K', value: String(k) },
      { label: 'BB', value: String(Math.max(2, bb)) },
      { label: 'WHIP', value: (1.05 - (player.control - 45) * 0.006 + scoutNoise(id, 10) * 0.2).toFixed(2) },
    ];
  }

  const ab = 78 + Math.round(scoutNoise(id, 11) * 30);
  const avg = Math.min(0.680, 0.300 + (player.contact - 40) * 0.0062 + scoutNoise(id, 12) * 0.05);
  const hits = Math.round(ab * avg);
  const hr = Math.max(0, Math.round((player.power - 42) * 0.30 + scoutNoise(id, 13) * 3));
  const sb = Math.max(0, Math.round((player.speed - 45) * 0.42 + scoutNoise(id, 14) * 5));
  return [
    { label: 'AVG', value: avg.toFixed(3).replace(/^0/, '') },
    { label: 'AB', value: String(ab) },
    { label: 'H', value: String(hits) },
    { label: 'HR', value: String(hr) },
    { label: 'RBI', value: String(Math.round(hits * 0.55 + hr * 1.6)) },
    { label: 'SB', value: String(sb) },
  ];
}
