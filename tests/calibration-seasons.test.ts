// calibration-seasons.test.ts
// Does the league still play like college baseball in year five?
//
// `calibration.test.ts` measures `simGame` against two freshly generated 50
// quality teams. That is the right way to ask whether the **engine** is
// calibrated, and it cannot answer whether the **world** stays calibrated: a
// year-five league is whatever progression, the draft, the portal and five
// recruiting classes left behind, and every number the suite took was from a
// world one day old.
//
// ---------------------------------------------------------------------------
// The first version of this file measured a world nobody plays
// ---------------------------------------------------------------------------
//
// Worth the space, because the mistake took twenty minutes to make and would
// have stood indefinitely. `tests/headlessYear.ts` was cut out of
// `climb-probe.ts` — from the lines immediately above a block headed **"KNOWN
// WRONG — do not read numbers off this file yet"**, which was not read. The
// engine has no recruiting driver: `aiTargets` and `closeWeek` live in
// `state/store.ts` and nothing in `src/engine` calls them. So the harness signed
// nobody, every hole fell through `fillRosters` to a walk-on at quality minus
// thirteen, walk-ons are released after one season, and from year five not one
// man in the country had ever been through `develop()`.
//
// It produced a tidy, plausible, entirely fictional result: a climb to 7.7 runs
// peaking in year three and settling at 7.3. None of it was a fact about the
// game. The recruiting window is in `headlessYear` now, driven the way
// `carousel-probe.ts` and `hall.test.ts` already drive it, and this file asserts
// that men actually sign — because a harness that measures nothing looks exactly
// like a harness that measures something reassuring.
//
// ---------------------------------------------------------------------------
// What the world did, until September 15 2026
// ---------------------------------------------------------------------------
//
// It gained two runs a game over four seasons and held there. Runs per team
// per game, against an NCAA D1 target of 6.73, ten seasons, two worlds:
//
//   seed 4242  7.015  7.337  8.101  8.426  8.637  8.458  8.537  8.616  8.533  8.541
//   seed 909   6.880  7.686  8.375  8.948  8.907  8.626  8.679  8.678  8.810  8.692
//
// Every rate inflated together — average .278 to .307, slugging .435 to .501,
// home runs 1.02 to 1.36 — and strikeouts fell. `05` §71 filed it as a defect
// with three suspected causes; `tests/class-census.ts` was written to separate
// them, and it turned out to be all three, in these proportions:
//
//   1. `makeTeam` never aged the roster it generated. A generated senior was
//      no better than a generated freshman (bats FR 40.8 / SR 41.8), so the
//      engine was calibrated against a population that exists on day one of a
//      career and never again. Building every man as a freshman and ageing him
//      into his class through `develop` (engine/development.ts) put a real
//      ladder on day one — bats 41.7 to 52.1 — and moved year one from 7.02
//      to 7.31. A quarter of the climb.
//   2. The recruiting class supplied five arms in thirteen prospects for a
//      roster that is ten arms in twenty-three, so 141 to 180 of the nation's
//      ~1,070 pitchers every season were walk-ons at overall 32 — one arm in
//      six, against one bat in twenty-five — and a walk-on is released after a
//      season, so the hole reopened every winter. The country's arms fell three
//      points while its bats rose two. Seven arms in fifteen now.
//   3. `makeTeam` drew its rotation three above the programme's quality and
//      its bench six below, a shape no recruited roster ever has — a recruit
//      is drawn at one quality and the card sorts him. The generated world was
//      therefore about three points arm-favoured against the world its own
//      recruiting produced. Everybody is drawn at quality now, and
//      `setTheCard` makes the rotation and the bench on day one as it does
//      every June.
//
// With all three in, generation and recruiting draw the same man, and the
// world is stationary: seed 4242 plays 7.98 7.96 8.07 8.08 8.10 with no
// engine change at all. Then the engine was recalibrated against that
// population — home runs, doubles and singles had been riding the asymmetry
// between the batter's and the pitcher's sensitivities on a stronger mean —
// and the eight-seed harness sweep landed inside 3% on every row.
//
// ---------------------------------------------------------------------------
// What the world did on September 15, and what the "drift" was
// ---------------------------------------------------------------------------
//
// Five seasons, two worlds, the engine as it stood that afternoon:
//
//   seed 4242   7.39  7.37  7.37  7.41  7.46      avg .285 -> .284   hr 1.10 -> 1.09
//   seed 12161  7.26  7.56  7.67  7.73  7.93      avg .283 -> .296   hr 1.10 -> 1.19
//
// Flat on one seed, nine percent on the other, and `06` §AH.1 asked for ten
// seasons on four seeds before anybody touched the ladder. Ten seasons on four
// seeds said (05 §85): the nine was noise -- 12161 peaked at 7.85 in year seven
// and was back at 7.49 by year ten -- and under it was a three percent step
// from year one to year two that never grew. Year one was the odd year out.
// A generated roster was twenty-three men drawn to the shape, nine four four
// and six; a recruited one is twenty-eight, with the extras a class leaves on
// the bench and in the pen, two walk-ons who play, seniors the draft has
// thinned, and freshmen the ladder signs a few points above the table. The
// nine and the four of the recruited roster were two and four points better,
// being the best of a deeper pool, and its pen and bench worse. That step was
// the whole of the drift; from year two the world was flat for a decade.
//
// ---------------------------------------------------------------------------
// What the world does now
// ---------------------------------------------------------------------------
//
// A generated roster is the one June leaves (roster.ts `makeTeam`: four signed
// classes through `refill`), the harness plays its games the way a season
// does, and the engine was refit once against the honest pair. Ten seasons,
// four seeds, the final engine (tests/class-census.ts):
//
//   seed 4242   6.45  6.55  6.53  6.58  6.74  6.61  6.61  6.49  6.49  6.62
//   seed 12161  6.47  6.70  6.81  6.86  6.63  6.46  6.74  6.66  6.54  6.72
//   seed 20080  6.63  6.72  6.81  6.69  6.66  6.61  6.67  6.59  6.54  6.61
//   seed 27999  6.50  6.79  6.70  6.53  6.48  6.51  6.53  6.60  6.51  6.53
//
// Year one 6.51, years two to ten 6.62, every rate flat (average .268 -> .270,
// on-base .375 -> .378, slugging .419 -> .422, home runs 0.94 -> 0.95,
// strikeouts 8.02 -> 8.12, walks 4.62 -> 4.77). The one and a half percent
// that remains is the walk-ons a June leaves on thin rosters and a day-one
// roster does not (05 §85.4); it is inside the seed spread and recorded
// rather than tuned. The world sits two percent under the harness now, where
// it sat eight above, because the old harness measured an undealt nine and a
// fixed starter; the harness is still what the league is defined by.
//
// This file is a guard. It pins the stationarity, so that whoever touches
// generation, development, recruiting or the norms next can watch it move.

import { describe, it, expect } from 'vitest';
import { createSeason, simSeason, seasonComplete } from '../src/engine/season.js';
import { leagueRates, type LeagueRates } from '../src/engine/calibration.js';
import { runPostseason } from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { headlessYear, lastSigned } from './headlessYear.js';

/**
 * Five, which is where the old climb had finished climbing.
 *
 * The old run rose from year two to year five and was flat from there to year
 * ten, so five is the first year that would have shown the whole of a climb
 * if one were back. Ten was measured and years six to ten said nothing year
 * five had not.
 *
 * **One world per process.** `uniqueName`/`reserveNames` in `players.ts` is
 * module-level mutable state, and `calibration.ts` already documents that
 * sharing it across runs changes which draws are consumed and therefore the
 * numbers. This file builds exactly one world for that reason; a second in the
 * same file would not reproduce the series in the header.
 */
const SEASONS = 5;

/**
 * What every season is allowed to be -- one band for the whole run, because
 * the run is flat. Taken from the four-world, ten-season census in the header
 * and widened to the nearest round number; all forty season-rows sit inside
 * every row. A band this wide would not have held the old world: its year
 * five read 8.6 runs, .307 and 1.36 home runs -- nor the September 15
 * afternoon's, at 7.3 to 7.9.
 */
const BAND: Record<keyof Omit<LeagueRates, 'teamGames'>, [number, number]> = {
  runs: [6.2, 7.1],     // measured 6.45 - 6.86
  avg: [0.255, 0.285],  // measured .266 - .273
  obp: [0.360, 0.395],  // measured .373 - .384
  slg: [0.400, 0.445],  // measured .415 - .431
  hr: [0.82, 1.10],     // measured 0.90 - 1.01
  k: [7.5, 8.7],        // measured 7.89 - 8.35
  bb: [4.3, 5.2],       // measured 4.55 - 4.95
};

/** One world, played forward, measured after each regular season. */
function seasons(seed: number, years: number): { rates: LeagueRates[]; signed: number[] } {
  let season = createSeason(makeRng(seed), undefined, CONFERENCES);
  season.captureBoxFor = 0;
  const rates: LeagueRates[] = [];
  const signed: number[] = [];
  for (let y = 1; y <= years; y++) {
    while (!seasonComplete(season)) simSeason(season);
    // Before the postseason, because `season.batting` keeps counting through
    // June the way NCAA totals do, and the targets describe a regular season.
    rates.push(leagueRates(season));
    if (y === years) break;
    season = headlessYear(season, 0, runPostseason(season));
    signed.push(lastSigned);
  }
  return { rates, signed };
}

describe('a league five years old', () => {
  const { rates, signed } = seasons(4242, SEASONS);
  const check = (at: LeagueRates, label: string) => {
    for (const [key, [lo, hi]] of Object.entries(BAND)) {
      const value = at[key as keyof typeof BAND];
      expect(value, `${label} ${key} = ${value.toFixed(4)}`).toBeGreaterThanOrEqual(lo);
      expect(value, `${label} ${key} = ${value.toFixed(4)}`).toBeLessThanOrEqual(hi);
    }
  };

  it('signed a class every winter', () => {
    /*
      The most important assertion in this file, and the one that would have
      saved the first version of it.

      A harness that signs nobody does not look broken — it looks like a league
      that quietly got worse, which is a finding somebody will act on. Six
      hundred and forty to six hundred and sixty five men sign each winter out
      of a class of seven hundred and twenty; nought means the recruiting
      window is not running and every number below is void.
    */
    expect(signed.length).toBe(SEASONS - 1);
    for (const [i, n] of signed.entries()) {
      expect(n, `winter ${i + 1} signed ${n}`).toBeGreaterThan(400);
    }
  });

  it('played every one of its seasons', () => {
    expect(rates.length).toBe(SEASONS);
    for (const y of rates) expect(y.teamGames).toBe(96 * 45);
  });

  it('opens on the world the engine was calibrated against', () => {
    check(rates[0]!, 'year 1');
  });

  it('is still playing the same sport in year five', () => {
    // .307 and 8.6 runs, against .280 and 6.73, was the defect this file used
    // to pin rather than fix. The band is one band now, and year five has to
    // sit in it beside year one.
    check(rates[rates.length - 1]!, 'year 5');
  });

  it('does not climb', () => {
    /*
      The old assertion here was the inverse -- `last.runs / first.runs > 1.15`,
      with home runs and slugging rising alongside and strikeouts falling --
      because the climb was pinned as a fact. The year-five-over-year-one ratio
      the four worlds in the header read is 1.05, 1.03, 1.01 and 1.00; the bar
      leaves room for a hot fifth year and none for the twenty-two percent
      that was.
    */
    const first = rates[0]!;
    const last = rates[rates.length - 1]!;
    expect(last.runs / first.runs).toBeLessThan(1.12);
    expect(last.runs / first.runs).toBeGreaterThan(0.90);
    expect(last.hr / first.hr).toBeLessThan(1.15);
    expect(last.slg / first.slg).toBeLessThan(1.08);
  });
});
