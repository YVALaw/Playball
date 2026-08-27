// block-probe.ts
// The two numbers this block is judged on, measured the same way before and
// after: the eight-seed calibration sweep, and how often the better seed takes
// a bracket game.
//
//   npx tsx tests/block-probe.ts [seasons]
//
// Not a Vitest file on purpose. It plays whole seasons of ninety six programs,
// which takes minutes rather than the seconds a test suite is allowed, and its
// output is a judgment call rather than an assertion.

import { runSeason, metrics, TARGETS } from '../src/engine/calibration.js';
import { createSeason, simSeason } from '../src/engine/season.js';
import { allConferenceTournaments, stageRegionals, stageNational } from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';
import { resetNames } from '../src/engine/players.js';
import type { TournamentResult } from '../src/engine/postseason.js';

const SWEEP_SEEDS = [4242, 12161, 20080, 27999, 35918, 43837, 51756, 59675];

function sweep(): { rows: Record<string, number>; worst: number } {
  const runs = SWEEP_SEEDS.map((seed) => metrics(runSeason('log5', 2400, seed)).rows);
  const mean: Record<string, number> = {};
  for (const key of Object.keys(runs[0] as object)) {
    const values = runs.map((r) => r[key]).filter((v): v is number => typeof v === 'number');
    mean[key] = values.reduce((a, b) => a + b, 0) / values.length;
  }
  let worst = 0;
  console.log('\n=== eight-seed sweep ===');
  console.log('metric                                sim   target    diff');
  for (const [key, value] of Object.entries(mean)) {
    const target = TARGETS[key];
    if (target === undefined) continue;
    const diff = ((value - target) / target) * 100;
    worst = Math.max(worst, Math.abs(diff));
    console.log(
      `${key.padEnd(34)}${value.toFixed(3).padStart(7)}${target.toFixed(3).padStart(9)}` +
      `${((diff >= 0 ? '+' : '') + diff.toFixed(1) + '%').padStart(8)}`,
    );
  }
  console.log(`worst deviation: ${worst.toFixed(1)}%`);
  return { rows: mean, worst };
}

/** Every game of every tournament, scored by whether the better seed took it. */
function tally(result: TournamentResult, out: { better: number; total: number }): void {
  const rank = new Map<number, number>();
  result.seeds.forEach((t, i) => rank.set(t, i));
  for (const g of result.games) {
    const w = rank.get(g.winner);
    const l = rank.get(g.loser);
    if (w === undefined || l === undefined) continue;
    out.total += 1;
    if (w < l) out.better += 1;
  }
}

function brackets(seasons: number): void {
  const out = { better: 0, total: 0 };
  const wins: number[] = [];
  let best = 0;
  for (let i = 0; i < seasons; i++) {
    resetNames();
    const season = createSeason(makeRng(9000 + i * 37));
    simSeason(season);
    for (const t of season.teams) { t.rw = t.w; t.rl = t.l; wins.push(t.w); best = Math.max(best, t.w); }
    const cups = allConferenceTournaments(season);
    for (const c of cups) tally(c, out);
    const regionals = stageRegionals(season, cups);
    for (const r of regionals) tally(r, out);
    const national = stageNational(season, cups, regionals);
    for (const o of national.opening) tally(o, out);
    tally(national.bracketA, out);
    tally(national.bracketB, out);
    tally(national.final, out);
  }
  const mean = wins.reduce((a, b) => a + b, 0) / wins.length;
  const sd = Math.sqrt(wins.reduce((a, b) => a + (b - mean) ** 2, 0) / wins.length);
  console.log(`\n=== ${seasons} seasons ===`);
  console.log(`better seed wins ${(100 * out.better / out.total).toFixed(1)}% of ${out.total} bracket games`);
  console.log(`team win totals: sd ${sd.toFixed(2)}, best record ${best}`);
}

const seasons = Number(process.argv[2] ?? 4);
sweep();
brackets(seasons);
