// hall.ts
// Who gets a plaque, and what it takes.
//
// The brief was one sentence and it is the whole design: *a man who holds one
// enormous single-game record and was otherwise ordinary must not get in.* So the
// case is built out of production repeated over seasons, and nothing else. No
// record in the book — single game, single season or career — is worth a point
// here. A record is one measurement; a hall of fame is a verdict on a career, and
// the two must not be allowed to substitute for one another. The plaque prints
// the marks a man holds because they are worth reading; the ballot never sees
// them.
//
// **Peak and longevity, not one or the other.** The draft means a four year
// career and a two year career are both ordinary outcomes here, so a rule that
// only added seasons up would hand the hall to whoever nobody wanted, and a rule
// that only took the best year would hand it to whoever had one. This does what
// Jaffe's JAWS does for Cooperstown: score the whole career, score the peak of
// it, and induct on the two together. The peak window is two seasons rather than
// JAWS's seven because a college career is four and a man who left after his
// junior year has three — a seven year window on a four year career is just the
// career again.
//
// **Runs above replacement is the currency**, because it is the only one that can
// compare a shortstop's summer with a Friday starter's. It is computed off the
// archive rather than off anything the simulation stores, so it works for a man
// who graduated eleven years ago exactly as well as for last June's senior.
//
// **Your own men only**, as agreed: `season.careers` is the user's program (and
// any other program he has coached), and this reads nothing else. A national
// ballot would be a list of strangers.

import { careerName, type CareerYear } from './season.js';
import type { PlayerId } from './types.js';

/**
 * League offence, in the one number a value model needs: runs created per plate
 * appearance for an average hitter.
 *
 * Measured off the engine rather than assumed — a full season of ninety six
 * programs, basic Runs Created summed and divided by plate appearances, comes
 * out at .126. It agrees with the calibration targets to two places: basic RC
 * over a .347/.374 profile is on-base times slugging, which is .130.
 */
const LEAGUE_RC_PER_PA = 0.126;

/**
 * What the man who would play instead is worth.
 *
 * Seventy two percent of average, which is where the sabermetric literature puts
 * replacement level for a position player and is the number WAR is built on. The
 * choice matters more than it looks: set it at average and half the league scores
 * zero, so a career is judged on whether he was better than a coin flip rather
 * than on how much he was worth to a program that had to field somebody.
 */
const REPLACEMENT_SHARE = 0.72;

const REPLACEMENT_RC_PER_PA = LEAGUE_RC_PER_PA * REPLACEMENT_SHARE;

/**
 * The earned run average a program could get out of whoever was left.
 *
 * The same idea from the other side, and it has to be *worse* than league
 * average by roughly the same margin: 5.30 runs a game over nine innings is the
 * calibrated environment, and a replacement arm gives up a quarter more of them.
 */
const REPLACEMENT_ERA = 5.30 * 1.25;

/**
 * How much of a career the peak window is.
 *
 * Two, and the two-year star is the reason. His whole case is two seasons, so a
 * window wider than that would average his peak against years he never played
 * and rank him below a four year man who was never as good — which is exactly the
 * comparison the user asked to be made fairly.
 */
export const PEAK_SEASONS = 2;

/**
 * The floor under a career, before anything is scored.
 *
 * One season is a spike by definition and this is a hall built against spikes, so
 * a single summer cannot carry a man in however enormous it was. It is also the
 * cheapest possible statement of the rule the whole file exists for: sustained
 * means more than once.
 */
export const MIN_SEASONS = 2;

/**
 * What it takes, and it was measured rather than chosen.
 *
 * `tests/hall-probe.ts` plays twenty seasons of the whole country and scores
 * every finished career at three programs — the strongest in the world it
 * generates, the median, and the weakest. What each candidate bar would have
 * admitted, per program, over those twenty years:
 *
 * | bar | blue blood | median | cellar |
 * |---|---|---|---|
 * | 100 | 30 | 7 | 0 |
 * | 110 | 19 | 3 | 0 |
 * | 120 | 14 | 2 | 0 |
 * | **130** | **10** | **1** | **0** |
 * | 140 | 8 | 0 | 0 |
 *
 * The two failure modes were named in the brief: a hall that admits somebody
 * every year is a roster, and one that admits nobody in twenty is a locked room.
 * At 110 the best program in the country inducts almost every season, which is
 * the first. At 140 nothing outside the elite ever inducts anybody, which is the
 * second. **130 is the last row where a great program is honouring its best man
 * about every second year and the rest of the country is not shut out.**
 *
 * Read the middle column as a floor rather than as the user's experience. Every
 * program in that measurement is run by the machine, and a rival coach spends his
 * points badly on purpose — the country's recruiting skill plateaus near 30
 * against a player who can reach 99 by concentrating (§16.4). A coach who
 * recruits properly at an average program produces careers somewhere between
 * those two columns, which is exactly where a hall of fame should make him work
 * for it.
 *
 * The bar is absolute and is deliberately not a quota. A hall of fame that
 * admitted the best two men of every decade would say nothing about the program
 * the coach built; this one says a great deal, because at a bad program it stays
 * nearly empty and filling it is the achievement.
 */
export const HALL_BAR = 130;

/** What the ballot is allowed to look at, for one man. */
export interface CareerCase {
  id: PlayerId;
  name: string;
  /** First and last season he played for you. */
  first: number;
  last: number;
  /** Every program of yours he played for, in order. */
  teams: string[];
  seasons: number;
  /** Which half of the book he is in, decided the same way the player card does. */
  pitcher: boolean;
  /** Runs above replacement, summed over every season in the archive. */
  career: number;
  /** The mean of his best `PEAK_SEASONS`, or of what he played if that is fewer. */
  peak: number;
  /** What the country voted him, converted to runs on the scale above. */
  honours: number;
  /** `career + peak + honours`, which is the number the bar is set against. */
  score: number;
  /** The line the plaque leads with. */
  line: string;
}

/**
 * A man, inducted. Frozen at the moment he goes in.
 *
 * Everything the plaque needs is written down here rather than recomputed from
 * the archive on render, and that is deliberate: the archive is the only copy of
 * a career and a hall of fame is a permanent statement about one. If the scoring
 * ever changes, the men already in stay in with the case that put them there,
 * which is how every real hall works and the opposite of how a leaderboard does.
 */
export interface Inductee {
  id: PlayerId;
  name: string;
  /** The offseason he went in, which is the June after his last game. */
  year: number;
  first: number;
  last: number;
  teams: string[];
  pitcher: boolean;
  score: number;
  line: string;
}

const sum = (years: readonly CareerYear[], key: keyof CareerYear): number =>
  years.reduce((a, y) => a + ((y[key] as number | undefined) ?? 0), 0);

/**
 * What one season of one man was worth, in runs above replacement.
 *
 * Basic Runs Created for the bat — on-base times slugging times opportunity, in
 * the form James wrote it — against what a replacement would have produced in the
 * same number of trips. Runs prevented for the arm, against a replacement earned
 * run average over the same innings. A two way player gets both, which is right:
 * he did both.
 *
 * Doubles and triples are read off the row rather than guessed at, which is why
 * `CareerYear` carries them. Before it did, total bases had to be approximated as
 * hits plus home runs and every gap hitter in the archive was scored as a singles
 * hitter.
 */
export function seasonRuns(y: CareerYear): number {
  let runs = 0;

  const ab = y.ab ?? 0;
  const bb = y.bb ?? 0;
  const pa = ab + bb;
  if (pa > 0) {
    const h = y.h ?? 0;
    const tb = h + (y.d ?? 0) + (y.t ?? 0) * 2 + (y.hr ?? 0) * 3;
    const rc = ((h + bb) * tb) / pa;
    runs += rc - pa * REPLACEMENT_RC_PER_PA;
  }

  const outs = y.outs ?? 0;
  if (outs > 0) {
    const innings = outs / 3;
    const era = ((y.er ?? 0) * 9) / innings;
    runs += ((REPLACEMENT_ERA - era) * innings) / 9;
  }

  return runs;
}

/**
 * What the voters said at the time, priced in runs.
 *
 * An award is not production counted twice, it is the one contemporaneous
 * judgment of a season the archive cannot reconstruct — the country looked at
 * everybody and picked him. Priced small on purpose: a national award is worth
 * about one and a half average seasons and a place on the all-conference team
 * about half of one, so four years of honours cannot get a man past the bar on
 * their own. They tip a borderline case, which is what they should do.
 */
export function honourRuns(titles: readonly string[]): number {
  let runs = 0;
  for (const t of titles) {
    if (t.startsWith('All-conference')) runs += 4;
    else if (t === 'Freshman of the Year') runs += 5;
    // Named rather than matched on the suffix, because Coach of the Year is
    // filed in the same list under an id made out of the coach's own name. It
    // cannot collide with a player today — ids come off the generator's stream
    // position — and naming the two awards means it never can.
    else if (t === 'Player of the Year' || t === 'Pitcher of the Year') runs += 12;
  }
  return runs;
}

/** A batting line, as the plaque reads it. */
const rate = (v: number): string =>
  (v < 1 ? v.toFixed(3).slice(1) : v.toFixed(3));

/**
 * One man's whole case, out of the archive.
 *
 * `honours` is his titles, which live in the store's season history rather than
 * in the season, because they are a fact about the years the user coached.
 */
export function buildCase(
  id: PlayerId,
  rows: readonly CareerYear[],
  honours: readonly string[] = [],
): CareerCase {
  const years = [...rows].sort((a, b) => a.year - b.year);
  const teams: string[] = [];
  for (const y of years) if (!teams.includes(y.team)) teams.push(y.team);

  const values = years.map(seasonRuns).sort((a, b) => b - a);
  const career = values.reduce((a, b) => a + b, 0);
  const best = values.slice(0, PEAK_SEASONS);
  const peak = best.length > 0
    ? best.reduce((a, b) => a + b, 0) / best.length
    : 0;
  const honourValue = honourRuns(honours);

  // The same test the player card and the old hall leaderboard use, so a two way
  // man lands in the same half of the book wherever he is printed.
  const pitcher = years.some((y) => (y.outs ?? 0) > 0)
    || !years.some((y) => (y.ab ?? 0) > 0);

  const ab = sum(years, 'ab');
  const h = sum(years, 'h');
  const outs = sum(years, 'outs');
  const er = sum(years, 'er');
  const seasons = years.length;
  const word = `${seasons} season${seasons === 1 ? '' : 's'}`;

  const line = pitcher
    ? `${word} · ${sum(years, 'w')}-${sum(years, 'l')}, `
      + `${outs > 0 ? ((er * 27) / outs).toFixed(2) : '—'} ERA, ${sum(years, 'k')} K`
    : `${word} · ${ab > 0 ? rate(h / ab) : '—'}, `
      + `${sum(years, 'hr')} HR, ${sum(years, 'rbi')} RBI`;

  return {
    id,
    name: careerName(id, years),
    first: years[0]?.year ?? 0,
    last: years[years.length - 1]?.year ?? 0,
    teams,
    seasons,
    pitcher,
    career,
    peak,
    honours: honourValue,
    score: career + peak + honourValue,
    line,
  };
}

/** Whether a finished career clears the bar. Two clauses, and both are the point. */
export const electable = (c: CareerCase): boolean =>
  c.seasons >= MIN_SEASONS && c.score >= HALL_BAR;

export interface BallotInput {
  /** The archive: every season of every man the coach has run out. */
  careers: Record<PlayerId, CareerYear[]>;
  /**
   * Everybody still playing, anywhere in the country.
   *
   * A career is not over until he is off every roster, and it has to be every
   * roster rather than the user's: a coach who changes jobs leaves men behind who
   * are still sophomores, and inducting a man who has two seasons left to play is
   * the one mistake a hall of fame cannot walk back.
   */
  active: ReadonlySet<string>;
  /** Who is already in. They are not reconsidered, and they cannot be removed. */
  inducted: ReadonlySet<string>;
  /** What each man won, by id. Titles as the history screen files them. */
  honours: ReadonlyMap<string, string[]>;
  /** The offseason this is being decided in. */
  year: number;
}

/**
 * The class of one June.
 *
 * Every finished career that is not already in, scored, and the ones over the bar
 * inducted. There is no waiting period and no ballot limit: a coach's career is
 * fifteen years if he is lucky and a five year wait would mean a third of the men
 * he coached were still pending when he retired. He goes in the June after his
 * last game or he does not go in at all — and because the bar is absolute rather
 * than a quota, a man who misses it has missed it for good, which is why last
 * year's near misses are not reconsidered.
 *
 * Ordered best first, so a class of three reads as a class rather than as
 * whatever order the archive happened to be keyed in.
 */
export function inductees(input: BallotInput): Inductee[] {
  const out: Inductee[] = [];
  for (const [key, rows] of Object.entries(input.careers)) {
    if (input.inducted.has(key) || input.active.has(key)) continue;
    const id = key as PlayerId;
    const c = buildCase(id, rows, input.honours.get(key) ?? []);
    if (!electable(c)) continue;
    out.push({
      id,
      name: c.name,
      year: input.year,
      first: c.first,
      last: c.last,
      teams: c.teams,
      pitcher: c.pitcher,
      score: Math.round(c.score),
      line: c.line,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Everything the user's players have won, gathered under the man who won it.
 *
 * Here rather than on the program screen because two things read it now — the
 * screen and the ballot — and a hall that scored honours differently from the way
 * the plaque printed them would be indefensible the first time somebody checked.
 */
export function honoursByPlayer(
  history: readonly { awards?: { id: string; title: string }[] }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const season of history) {
    for (const a of season.awards ?? []) {
      const list = map.get(a.id) ?? [];
      // Once each. A man who was all-conference three times is a better player
      // than one who did it once and the score should say so — but the plaque
      // prints a list of what he won, and the same words three times is a
      // rendering bug rather than a distinction.
      if (!list.includes(a.title)) list.push(a.title);
      map.set(a.id, list);
    }
  }
  return map;
}

/**
 * Everybody on a roster anywhere in the country.
 *
 * The one input the ballot cannot derive for itself, and the definition of a
 * career being over.
 */
export function activeIds(
  teams: readonly { team: { lineup: { id: PlayerId }[]; bench: { id: PlayerId }[];
    rotation: { id: PlayerId }[]; bullpen: { id: PlayerId }[] } }[],
): Set<string> {
  const ids = new Set<string>();
  for (const t of teams) {
    for (const p of [
      ...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen,
    ]) ids.add(p.id);
  }
  return ids;
}
