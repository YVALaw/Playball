// calibration-seasons.test.ts
// Does the league still play like college baseball in year six?
//
// `calibration.test.ts` measures `simGame` against two freshly generated 50
// quality teams. That is the right way to ask whether the **engine** is
// calibrated and it cannot answer whether the **world** stays calibrated: a
// year-six league is whatever progression, the draft, the portal and five
// recruiting classes left behind, and every number the suite took was from a
// world one day old.
//
// The outside audit of 2026-09-11 put three consecutive seasons at 6.86, 6.98
// and 7.25 runs against a 6.73 target and nothing here would have noticed. Run
// properly, over ten seasons and two worlds, the shape is clearer and worse
// than three points suggested:
//
//   seed 4242   y1 7.111  y3 7.539  y4 7.722  y6 7.325  y10 7.432
//   seed 909    y1 6.934  y3 7.885  y4 7.744  y6 7.347  y10 7.329
//
// Three things in that, and they are different findings:
//
//   1. A fresh **league** opens at 6.93-7.11 where the two-team harness sits on
//      6.73. Run scoring is convex in the gap between two clubs, and a real
//      league has a spread of quality where the harness has none.
//   2. It then CLIMBS for three or four years and peaks 13-17% above target.
//   3. It settles around 7.3-7.4 and stays there — flat from year five to year
//      ten, so this is a new equilibrium rather than an unbounded drift.
//
// The climb is almost entirely on-base: walks go 4.65 to 5.0-5.2 and OBP .386
// to .395-.405 while home runs and strikeouts barely move. Something about the
// first few cycles of development favours the bat over the arm.
//
// **This file does not fix any of that.** It is a guard: it pins what is true
// today, so that whoever does fix it can see the numbers move, and so that a
// change made for some other reason cannot quietly make it worse. The bands are
// set from the ten-season, two-world measurement above, wide enough that a
// different seed passes and tight enough that a real regression does not.

import { describe, it, expect } from 'vitest';
import { createSeason, simSeason, seasonComplete } from '../src/engine/season.js';
import { leagueRates, type LeagueRates } from '../src/engine/calibration.js';
import { runPostseason } from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { headlessYear } from './headlessYear.js';

/**
 * Six, which is the shortest run that sees all three phases.
 *
 * The climb peaks in year three or four and the plateau is established by year
 * five, so six seasons covers the opening, the bulge and the settle. Ten was
 * measured and told us nothing years seven to ten that year six had not; it
 * cost thirty seconds a world.
 */
const SEASONS = 6;

/**
 * Every band below is [measured floor, measured ceiling] over ten seasons of
 * two worlds, widened to the nearest round number. A season outside one of
 * these is not noise.
 */
const BANDS: Record<keyof Omit<LeagueRates, 'teamGames'>, [number, number]> = {
  runs: [6.5, 8.2],     // measured 6.934 - 7.885
  avg: [0.270, 0.300],  // measured .2787 - .2945
  obp: [0.375, 0.412],  // measured .3841 - .4050
  slg: [0.425, 0.475],  // measured .4374 - .4681
  hr: [0.95, 1.25],     // measured 1.039 - 1.178
  k: [7.3, 8.3],        // measured 7.66 - 7.89
  bb: [4.4, 5.5],       // measured 4.65 - 5.27
};

/** One world, played forward, measured after each regular season. */
function seasons(seed: number, years: number): LeagueRates[] {
  let season = createSeason(makeRng(seed), undefined, CONFERENCES);
  season.captureBoxFor = 0;
  const out: LeagueRates[] = [];
  for (let y = 1; y <= years; y++) {
    while (!seasonComplete(season)) simSeason(season);
    // Before the postseason, because `season.batting` keeps counting through
    // June the way NCAA totals do, and the targets describe a regular season.
    out.push(leagueRates(season));
    if (y === years) break;
    season = headlessYear(season, 0, runPostseason(season));
  }
  return out;
}

describe('a league six years old', () => {
  const years = seasons(4242, SEASONS);

  it('played every one of its seasons', () => {
    expect(years.length).toBe(SEASONS);
    for (const y of years) expect(y.teamGames).toBe(96 * 45);
  });

  it('still plays college baseball, season by season', () => {
    years.forEach((rates, i) => {
      for (const [key, [lo, hi]] of Object.entries(BANDS)) {
        const value = rates[key as keyof typeof BANDS];
        expect(value, `year ${i + 1} ${key} = ${value.toFixed(4)}`)
          .toBeGreaterThanOrEqual(lo);
        expect(value, `year ${i + 1} ${key} = ${value.toFixed(4)}`)
          .toBeLessThanOrEqual(hi);
      }
    });
  });

  it('settles rather than running away', () => {
    /*
      The one property worth more than any single band: whatever the league
      gains in its first few cycles, it has to stop gaining. Measured from
      year one to year six, +3.1% on one seed and +6.1% on the other; an
      unbounded drift would blow straight through ten.
    */
    const first = years[0]!.runs;
    const last = years[years.length - 1]!.runs;
    expect(Math.abs(last - first) / first).toBeLessThan(0.10);
  });

  it('records what the climb is actually made of', () => {
    // Not a band — a statement about the shape, so that a fix which moved
    // power instead of patience would fail here and be looked at.
    const first = years[0]!;
    const peak = years.reduce((a, b) => (b.runs > a.runs ? b : a));
    expect(peak.runs).toBeGreaterThan(first.runs);
    // On-base carries it; the ball does not start flying further.
    expect(peak.obp - first.obp).toBeGreaterThan(0.004);
    expect(Math.abs(peak.hr - first.hr)).toBeLessThan(0.2);
  });
});
