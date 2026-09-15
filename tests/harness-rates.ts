// harness-rates.ts
// The per-plate-appearance rate of every event on the calibration harness,
// which is what the norm fit in ratings.ts reads.
//
// `BAT_NORM` and `PIT_NORM` carry, per widened event, the constant that puts
// the league's realised rate back where it was, and the documented procedure
// for re-fitting them is: run the eight-seed sweep, read the per-plate-
// appearance rate of every event before and after, and multiply the constant
// by the ratio. `record-goldens.ts` prints per-game totals and a batting
// line, which is the wrong denominator for that arithmetic and does not split
// the hits. This prints the rates themselves, over the same eight seeds the
// recorder and the calibration test use, so a before-and-after is two runs
// of one file rather than a transcription.
//
//   npx tsx tests/harness-rates.ts
//
// Same `runSeason('log5', 2400, seed)` the recorder sweeps, so a rate here is
// a rate the goldens stand on.

import { runSeason, blankAcc, type Acc } from '../src/engine/calibration.js';

const SWEEP_SEEDS = [4242, 12161, 20080, 27999, 35918, 43837, 51756, 59675];

const acc: Acc = blankAcc();
for (const seed of SWEEP_SEEDS) {
  const r = runSeason('log5', 2400, seed);
  for (const k of Object.keys(acc) as (keyof Acc)[]) acc[k] += r[k];
}

const pa = acc.bf;
const g = acc.teamGames;
const single = acc.h - acc.d - acc.t - acc.hr;
const row = (label: string, n: number): void =>
  console.log(`  ${label.padEnd(10)}${(n / pa).toFixed(5).padStart(9)}   per game ${(n / g).toFixed(3).padStart(7)}`);

console.log(`eight seeds, ${g} team-games, ${pa} plate appearances\n`);
console.log('  event      per PA       per team-game');
row('single', single);
row('double', acc.d);
row('triple', acc.t);
row('homerun', acc.hr);
row('walk', acc.bb);
row('hbp', acc.hbp);
row('strikeout', acc.k);
console.log(`\n  runs per team-game ${(acc.runs / g).toFixed(4)}   PA per team-game ${(pa / g).toFixed(3)}`);
console.log(`  avg ${(acc.h / acc.ab).toFixed(4)}   obp ${((acc.h + acc.bb + acc.hbp) / (acc.ab + acc.bb + acc.hbp + acc.sf)).toFixed(4)}`
  + `   slg ${((single + 2 * acc.d + 3 * acc.t + 4 * acc.hr) / acc.ab).toFixed(4)}`);
