// record-goldens.ts
// Rewrites the golden block in calibration.test.ts from a fresh measurement.
//
//   npm run goldens
//
// Re-baselining is a normal part of changing the engine on purpose, and doing it
// by hand is where mistakes live: transcribing sixteen digit floats, forgetting
// slugging, pasting a stale run. This does it the same way every time.
//
// It is deliberately NOT automatic. Determinism failing is a signal, and the
// only correct response is to look at the calibration suite first and decide
// whether the change was intended. Run this after that decision, not instead
// of it.

import { readFileSync, writeFileSync } from 'node:fs';
import { runSeason, metrics, TARGETS } from '../src/engine/calibration.js';

const TEST_FILE = new URL('./calibration.test.ts', import.meta.url);

const m = metrics(runSeason('log5', 2400));

/**
 * The safety check runs on the sweep, not on the seed being recorded.
 *
 * The goldens themselves are seed 4242 and have to be — determinism is a
 * one-seed question by definition. But the guard below is asking a different
 * question, "is the engine in a fit state to be baselined at all", and one seed
 * cannot answer it. `calibration.test.ts` says so at length and the seed's own
 * biases are documented there: 4242 drew a league that does not walk and does
 * not homer, and its home run row has read anywhere between 3% and 10% under
 * target across changes that moved the eight-seed mean by one percent.
 *
 * Guarding on that number meant the recorder refused to baseline a healthy
 * engine because one seed of twelve roster pairs got unlucky, which is the exact
 * mistake the sweep exists to prevent. Same seeds as the test, so the two agree
 * about what the league is.
 */
const SWEEP_SEEDS = [4242, 12161, 20080, 27999, 35918, 43837, 51756, 59675];

const sweep: Record<string, number> = {};
for (const seed of SWEEP_SEEDS) {
  for (const [k, v] of Object.entries(metrics(runSeason('log5', 2400, seed)).rows)) {
    sweep[k] = (sweep[k] ?? 0) + v / SWEEP_SEEDS.length;
  }
}

console.log('measured against the sourced targets:\n');
console.log(`  ${'metric'.padEnd(32)}${'seed'.padStart(8)}${'sweep'.padStart(8)}${'target'.padStart(9)}`);
let worst = 0;
for (const [key, value] of Object.entries(m.rows)) {
  const target = TARGETS[key];
  if (target === undefined) continue;
  const mean = sweep[key] as number;
  const diff = ((mean - target) / target) * 100;
  worst = Math.max(worst, Math.abs(diff));
  const flag = Math.abs(diff) > 10 ? '   <-- OUTSIDE THE BAR' : '';
  console.log(
    `  ${key.padEnd(32)}${value.toFixed(3).padStart(8)}${mean.toFixed(3).padStart(8)}` +
    `${target.toFixed(3).padStart(9)}${((diff >= 0 ? '+' : '') + diff.toFixed(1) + '%').padStart(8)}` +
    flag,
  );
}

if (worst > 10) {
  console.error(`\nrefusing to record: the sweep is ${worst.toFixed(1)}% off target somewhere.`);
  console.error('fix the engine, or move the target and say why, before baselining.');
  process.exit(1);
}

const rows = Object.entries(m.rows).map(([k, v]) => `  '${k}': ${v},`).join('\n');
const block =
  `const GOLDEN: Record<string, number> = {\n${rows}\n};\n\n` +
  `const GOLDEN_SLUGGING = ${m.slugging};\n` +
  `const GOLDEN_ERRORS = ${m.errorsPerGame};\n` +
  `const GOLDEN_SB_PCT = ${m.stolenBasePct};`;

const source = readFileSync(TEST_FILE, 'utf8');
const pattern = /const GOLDEN: Record<string, number> = \{[\s\S]*?const GOLDEN_SB_PCT = [0-9.]+;/;
if (!pattern.test(source)) {
  console.error('\ncould not find the golden block in calibration.test.ts');
  process.exit(1);
}

writeFileSync(TEST_FILE, source.replace(pattern, block));
console.log(`\nrecorded. worst deviation ${worst.toFixed(0)}%.`);
