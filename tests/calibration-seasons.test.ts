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
// What the world actually does
// ---------------------------------------------------------------------------
//
// Ten seasons, two worlds, one node process per seed (see SEASONS below for why
// that matters). Runs per team per game, against an NCAA D1 target of 6.73.
//
// Re-recorded 2026-09-12 after the starting-OVR ladder came down (`05` §76):
//
//   seed 4242  7.015  7.337  8.101  8.426  8.637  8.458  8.537  8.616  8.533  8.541
//   seed 909   6.880  7.686  8.375  8.948  8.907  8.626  8.679  8.678  8.810  8.692
//
//   before it, for comparison:
//   seed 4242  7.111  7.430  8.109  8.536  8.816  8.955  8.941  8.735  8.594  8.624
//   seed 909   6.934  7.551  8.246  8.731  8.922  8.888  8.924  9.050  8.873  8.781
//
// **Year one moved and no year-one talent did.** `createSeason` builds its
// teams and *then* draws the recruiting class off the same generator, so a
// ladder that spends a different number of numbers moves every game played
// afterwards without touching a single rating. Checked rather than assumed:
// the year-one league is 2208 men at mean overall 42.8012 on both sides of the
// change, hash for hash. The 7.111 → 7.015 is dice.
//
// The plateau came down with the ladder — about a fifth of a run, 8.77 → 8.55
// on 4242 and 8.87 → 8.73 on 909 — which is the right direction and nowhere
// near far enough. Worth knowing **why** it is only a fifth of a run: the
// climb is not built out of where freshmen start, it is built out of what four
// winters of `develop()` do to them. Lowering the door by three points buys
// almost nothing at the plateau, so whoever recalibrates should not spend any
// more time on the recruiting ladder — the lever is development.
//
// The league still gains **two runs a game** over four years and then holds
// there, a fifth above target. And it is not one channel — every rate inflates
// together (year 5 and year 10 are the two measured checkpoints; both seeds):
//
//                        year 1        year 5        year 10       D1 target
//   batting average      .278-.282     .307-.311     .305-.308     .280
//   on base              .381-.385     .418-.422     .415-.419     .384
//   slugging             .435-.444     .501-.508     .498-.506     .438
//   home runs            1.02-1.07     1.36-1.39     1.35-1.39     1.03
//   walks                4.57-4.57     5.46-5.61     5.42-5.50     4.70
//   strikeouts           7.86-7.90     7.07-7.16     7.08-7.22     8.01
//
// ---------------------------------------------------------------------------
// The cause, which is a defect and not a curve
// ---------------------------------------------------------------------------
//
// Census by class year, league-wide, mean overall:
//
//   YEAR 1, generated   BATS  FR 40.8  SO 41.3  JR 40.3  SR 41.8
//                       ARMS  FR 45.6  SO 45.2  JR 45.0  SR 44.4
//   YEAR 5, recruited   BATS  FR 41.9  SO 50.4  JR 52.0  SR 50.2
//                       ARMS  FR 40.0  SO 52.2  JR 56.0  SR 53.1
//
//   (seed 4242. Before the ladder came down the year-five line read BATS FR
//   45.1 SO 54.3 JR 56.5 SR 54.8 / ARMS FR 41.5 SO 55.4 JR 58.1 SR 53.8. The
//   freshman row is the one the ladder was aimed at and it moved most — bats
//   45.1 → 41.9 — which is the change doing exactly what it says. The upper
//   classes came down about two, all of it inherited from a weaker door.)
//
// **`makeTeam` never ages the roster it generates.** In the opening world a
// senior is no better than a freshman — all four classes are drawn flat from one
// distribution. A world that has run its own development for four years has a
// real ladder, a junior eleven to sixteen points above a freshman, and a league
// mean of 52 against the generated 41.
//
// So the engine is calibrated against a population that exists on day one of a
// career and never again. Both ends are wrong and they are wrong differently:
// the opening world is too raw, and the developed world is too strong.
//
// Two further notes, both load bearing. The talent swings **toward the bats** —
// arms open 4.1 points above bats and end 1.5 below, a 5.6-point relative shift
// — which is why scoring moves more than either side alone. And the plateau is
// real: years five to ten are flat to within 3%, so this is an equilibrium, not
// a runaway.
//
// **This file fixes none of that.** It is a guard. It pins what is true today so
// that whoever recalibrates can watch the numbers move, and so that a change
// made for some other reason cannot quietly make it worse. See `05` §71.

import { describe, it, expect } from 'vitest';
import { createSeason, simSeason, seasonComplete } from '../src/engine/season.js';
import { leagueRates, type LeagueRates } from '../src/engine/calibration.js';
import { runPostseason } from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { headlessYear, lastSigned } from './headlessYear.js';

/**
 * Five, which reaches the plateau and stops.
 *
 * The climb runs from year two to year five and is flat from there to year ten,
 * so the two checkpoints worth asserting are the opening world and the settled
 * one, and year five is the first year that is settled. Ten was measured and
 * years six to ten said nothing year five had not.
 *
 * **One world per process.** `uniqueName`/`reserveNames` in `players.ts` is
 * module-level mutable state, and `calibration.ts` already documents that
 * sharing it across runs changes which draws are consumed and therefore the
 * numbers. This file builds exactly one world for that reason; a second in the
 * same file would not reproduce the series in the header.
 */
const SEASONS = 5;

/**
 * What each checkpoint is allowed to be.
 *
 * Taken from the ten-season, two-world measurement in the header and widened to
 * the nearest round number. These are deliberately per-phase rather than one
 * band spanning the whole run: a single band wide enough to hold both 6.9 and
 * 9.1 would not catch anything.
 */
const OPENING: Record<keyof Omit<LeagueRates, 'teamGames'>, [number, number]> = {
  runs: [6.6, 7.4],     // measured 6.880, 7.015
  avg: [0.270, 0.290],  // measured .2777, .2819
  obp: [0.375, 0.396],  // measured .3809, .3848
  slg: [0.425, 0.455],  // measured .4346, .4441
  hr: [0.95, 1.18],     // measured 1.020, 1.069
  k: [7.4, 8.3],        // measured 7.86, 7.90
  bb: [4.4, 5.0],       // measured 4.57, 4.57
};

const PLATEAU: Record<keyof Omit<LeagueRates, 'teamGames'>, [number, number]> = {
  // Spans are years 5 and 10 on both seeds, which are the two checkpoints the
  // probe records. The bands themselves are unchanged and were not re-fitted:
  // every one of these fourteen figures already sat inside the band drawn for
  // the old ladder, which is the reassuring half of the result.
  runs: [8.3, 9.5],     // measured 8.458 - 8.948 across years 5-10
  avg: [0.295, 0.325],  // measured .3050 - .3109
  obp: [0.405, 0.435],  // measured .4150 - .4222
  slg: [0.490, 0.535],  // measured .4980 - .5081
  hr: [1.28, 1.55],     // measured 1.350 - 1.389
  k: [6.5, 7.5],        // measured 7.07 - 7.22
  bb: [5.1, 6.0],       // measured 5.42 - 5.61
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
  const check = (at: LeagueRates, bands: typeof OPENING, label: string) => {
    for (const [key, [lo, hi]] of Object.entries(bands)) {
      const value = at[key as keyof typeof bands];
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
    check(rates[0]!, OPENING, 'year 1');
  });

  it('and by year five is playing a different sport', () => {
    // Not a metaphor: .307 and 8.6 runs against a .280, 6.73 target. This is
    // the defect, pinned rather than fixed — see the header and `05` §71. The
    // recruiting ladder took a fifth of a run off it and that is all it had to
    // give; the rest is development, which nothing has touched yet.
    check(rates[rates.length - 1]!, PLATEAU, 'year 5');
  });

  it('gains its runs across the board, not through one channel', () => {
    /*
      The first version of this file claimed the climb was "patience, not
      power" — walks and on-base moving while home runs stayed flat. That was
      the walk-on artefact. With recruiting running, every channel inflates and
      power moves most of all, which is what a league-wide talent rise looks
      like and what a plate-discipline bug would not.
    */
    const first = rates[0]!;
    const last = rates[rates.length - 1]!;
    expect(last.runs / first.runs).toBeGreaterThan(1.15);
    expect(last.hr / first.hr).toBeGreaterThan(1.15);
    expect(last.slg / first.slg).toBeGreaterThan(1.08);
    // And strikeouts fall, which no explanation involving better pitching survives.
    expect(last.k).toBeLessThan(first.k);
  });
});
