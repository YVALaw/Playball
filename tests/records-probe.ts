// records-probe.ts
// What the best season in the country actually looks like, measured rather than
// argued about.
//
//   npx tsx tests/records-probe.ts [seasons] [dynasty] [seed]
//
// Not a Vitest file, for the reason `block-probe.ts` gives: it plays whole
// seasons of ninety six programs, which takes minutes rather than the seconds a
// test suite is allowed. What it decided is the value of every seeded mark in
// `engine/records.ts`; the assertions that pin that decision live in
// tests/records.test.ts, and they read `LEAGUE_BEST` and `yearsToBeat` from the
// top of this file rather than simulating anything themselves.
//
// The question is the only one that matters about a seeded mark: how many years
// would this league need to produce a season that beats it. So it keeps the
// single best value in each category from each year played, which is exactly the
// sample a record chase draws from — one league-leading season per season.
//
// Two modes, because the fast one has an obvious objection to it. **Fresh
// leagues** (the default) draw ninety six rosters straight from the generator
// each year, which is cheap enough to run forty of. **Dynasty** rolls one league
// forward through the real offseason — draft, development, graduation, ninety six
// AI recruiting classes — which is the league a record is actually chased in, and
// costs about twice as much per year. They do not agree, and the difference is
// the finding: a mature league's best hitter is a home run and thirty points of
// slugging past a generated one, because recruiting concentrates power where a
// generator spreads it. The dynasty is the honest population and the numbers
// below come from it.

import {
  createSeason, simSeason, nextSeason, recordSeasonMarks, DEFAULT_SEASON,
  type SeasonState,
} from '../src/engine/season.js';
import { runPostseason } from '../src/engine/postseason.js';
import { departAndDevelop, fillRosters, holesFor } from '../src/engine/progression.js';
import {
  RECRUITING_WEEKS, aiTargets, closeWeek, leadersAtWeekStart, resetWeeklySpend,
  weeklyPoints,
} from '../src/engine/recruiting.js';
import { pitchFor, developmentScore } from '../src/engine/pitch.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES, type Region } from '../src/data/schools.js';
import { RECORDS, seededBook, type RecordKey } from '../src/engine/records.js';

/** The shape of a league best: where it sits, and how far it swings. */
export interface Spread { mean: number; sd: number }

/**
 * The best season in the country, as this engine produces it.
 *
 * Forty four seasons: two independent dynasties of twenty two years each, seeds
 * 5000 and 81119, ninety six programs apiece, every chair on the AI, offseason
 * and postseason included. Neither series trends across its twenty two years, so
 * this is a settled league rather than one still filling up.
 *
 * Re-measure with `npx tsx tests/records-probe.ts 22 dynasty` and pool the two
 * runs; the probe prints the rows paste-ready. Anything that moves the run
 * environment or §9.7's rating curve moves these, and the seeded marks in
 * `engine/records.ts` are chosen off them.
 */
export const LEAGUE_BEST: Partial<Record<RecordKey, Spread>> = {
  seasonHR: { mean: 14.500, sd: 2.435 },
  seasonRBI: { mean: 80.772, sd: 7.008 },
  seasonTB: { mean: 170.931, sd: 15.874 },
  seasonAvg: { mean: 0.463, sd: 0.023 },
  seasonSlg: { mean: 0.757, sd: 0.044 },
  seasonDoubles: { mean: 27.136, sd: 2.216 },
  seasonTriples: { mean: 8.091, sd: 1.254 },
  seasonWins: { mean: 14.319, sd: 1.196 },
  seasonIP: { mean: 136.181, sd: 12.828 },
  seasonK9: { mean: 12.006, sd: 0.775 },
  seasonScoreless: { mean: 25.454, sd: 4.043 },
};

/**
 * How many years this league needs to beat a mark, from a Gumbel fit.
 *
 * A league best is the maximum of about fifteen hundred seasons, and the maximum
 * of a large sample takes the Gumbel shape whatever the seasons themselves look
 * like — which is why this and not a normal curve. The difference is not
 * pedantry: the extreme-value curve has the fatter upper tail, and a normal fit
 * would report every mark as harder to beat than it is.
 *
 * The half added to a counting mark is the continuity correction. A record of 18
 * is beaten by 19 and not by 18.4, so the threshold sits between them.
 *
 * Only for marks where more is better. The two ascending rows, ERA and WHIP, are
 * not seeded and would need the fit taken on the other tail.
 */
export function yearsToBeat(mark: number, spread: Spread, count: boolean): number {
  const beta = (spread.sd * Math.sqrt(6)) / Math.PI;
  const mu = spread.mean - 0.5772156649 * beta;
  const x = count ? mark + 0.5 : mark;
  return 1 / (1 - Math.exp(-Math.exp(-(x - mu) / beta)));
}

// ---------------------------------------------------------------------------
// The measurement itself, which only runs when this file is the script.
// ---------------------------------------------------------------------------

/** Every seeded category, plus the ones a future seed might want. */
const WATCHED: RecordKey[] = [
  'seasonHR', 'seasonRBI', 'seasonTB', 'seasonAvg', 'seasonSlg',
  'seasonDoubles', 'seasonTriples', 'seasonHits', 'seasonRuns', 'seasonSB',
  'seasonWins', 'seasonIP', 'seasonK', 'seasonK9', 'seasonScoreless',
  'seasonERA', 'seasonWHIP', 'seasonSaves',
];

/** The recruiting window with every chair on the AI, exactly as hall-probe runs it. */
function recruitWindow(season: SeasonState): void {
  const regionOf = (i: number): Region =>
    CONFERENCES.find((c) => c.id === season.teams[i]?.conference)?.region ?? 'Gulf';
  for (let w = 1; w <= RECRUITING_WEEKS; w++) {
    season.recruiting.week = w;
    const atWeekStart = leadersAtWeekStart(season.recruiting);
    for (const record of season.teams) {
      const pitch = pitchFor(season, record, regionOf(record.index), developmentScore(record));
      const staff = record.coach;
      const need = holesFor([
        ...record.team.lineup, ...record.team.bench,
        ...record.team.rotation, ...record.team.bullpen,
      ]).reduce((a, h) => a + h.count, 0);
      for (const { prospect, actions } of aiTargets(
        record.index, pitch, staff?.prestige ?? 45, season.recruiting.prospects,
        need, season.rng, atWeekStart, season.draft?.rivalSpend[record.index] ?? 0,
      )) {
        prospect.points[record.index] = (prospect.points[record.index] ?? 0)
          + weeklyPoints(
            prospect, pitch, actions, staff?.prestige ?? 45, staff?.skills.recruiting ?? 20,
          );
      }
    }
    closeWeek(season.recruiting, season.rng, w >= RECRUITING_WEEKS);
    resetWeeklySpend(season.recruiting);
  }
}

const stats = (v: number[]): Spread => {
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
  return { mean, sd };
};

function measure(years: number, dynasty: boolean, seed: number): void {
  const best: Record<string, number[]> = {};
  for (const key of WATCHED) best[key] = [];

  /**
   * One year, played and read.
   *
   * The book is emptied before a pitch is thrown rather than before the scan, and
   * that is not tidiness. The scoreless-innings streak is offered inside
   * `recordResult` as the season runs, so a book wiped afterwards loses it —
   * which is exactly the bug this probe had in its first draft, and it read as
   * the league never producing a streak at all.
   *
   * **The postseason counts.** `store.ts` settles the book on the way into the
   * draft, which is after the bracket, and a bracket game's line goes into
   * `season.batting` like any other. A league best measured off the regular
   * season alone is measuring a book this game does not keep: it is worth about
   * two home runs and thirty innings on the leader, because the man who leads
   * the country is on the team that played into June.
   */
  const playYear = (season: SeasonState, year: number): void => {
    // Empty rather than seeded, so what comes out is what the league produced
    // and not what the league produced that happened to beat Incaviglia.
    season.records = {};
    simSeason(season);
    runPostseason(season);
    recordSeasonMarks(season, year);
    for (const key of WATCHED) {
      const value = season.records?.[key]?.value;
      if (value !== undefined) best[key]!.push(value);
    }
  };

  const started = Date.now();
  const tick = (n: number): void => {
    process.stderr.write(`  ${n}/${years}  ${((Date.now() - started) / 1000).toFixed(0)}s\r`);
  };

  if (dynasty) {
    let season = createSeason(makeRng(seed), DEFAULT_SEASON);
    for (let y = 0; y < years; y++) {
      playYear(season, 2027 + y);
      // Every chair on the AI. There is no user program, so no one roster is
      // stocked by a human who is better at recruiting than the machine.
      departAndDevelop(season, season.rng, { userTeam: -1 });
      recruitWindow(season);
      fillRosters(season, season.rng, { userTeam: -1 });
      season = nextSeason(season);
      tick(y + 1);
    }
  } else {
    for (let i = 0; i < years; i++) {
      playYear(createSeason(makeRng(seed + i * 977)), 2027);
      tick(i + 1);
    }
  }

  const seeded = seededBook();
  console.log(
    `\n\n=== best in the country, ${years} `
    + `${dynasty ? 'seasons of one dynasty' : 'independent leagues'} ===\n`,
  );
  console.log(
    `${'record'.padEnd(16)}${'mean'.padStart(9)}${'sd'.padStart(8)}${'median'.padStart(9)}`
    + `${'best'.padStart(9)}${'seeded'.padStart(9)}${'1 in'.padStart(8)}`,
  );
  for (const key of WATCHED) {
    const values = best[key] as number[];
    if (values.length === 0) continue;
    const asc = RECORDS[key].ascending === true;
    const sorted = [...values].sort((a, b) => (asc ? a - b : b - a));
    const spread = stats(values);
    const mark = seeded[key]?.value;
    const dp = (v: number): string => v.toFixed(spread.mean < 10 ? 3 : 1);
    console.log(
      key.padEnd(16) + dp(spread.mean).padStart(9) + spread.sd.toFixed(3).padStart(8)
      + dp(sorted[Math.floor(sorted.length / 2)] as number).padStart(9)
      + dp(sorted[0] as number).padStart(9)
      + (mark === undefined ? '—' : dp(mark)).padStart(9)
      + (mark === undefined || asc
        ? '—'
        : yearsToBeat(mark, spread, RECORDS[key].shape === 'count').toFixed(0)).padStart(8),
    );
  }

  console.log('\npaste-ready, for LEAGUE_BEST above:\n');
  for (const key of WATCHED) {
    const values = best[key] as number[];
    if (values.length === 0) continue;
    const { mean, sd } = stats(values);
    console.log(`  ${key}: { mean: ${mean.toFixed(3)}, sd: ${sd.toFixed(3)} },`);
  }

  // In the order they were played rather than sorted, which is what says whether
  // a dynasty's league is still getting better at year twenty or has settled.
  console.log('\nraw, in season order:\n');
  for (const key of WATCHED) {
    const values = best[key] as number[];
    if (values.length === 0) continue;
    console.log(`${key.padEnd(16)}${values.map((v) => v.toFixed(2)).join(' ')}`);
  }
}

// The test imports the two exports above, and importing a module runs it. Without
// this guard a `vitest run` would quietly start playing four hundred seasons.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('tests/records-probe.ts')) {
  measure(Number(process.argv[2] ?? 40), process.argv[3] === 'dynasty', Number(process.argv[4] ?? 5000));
}
