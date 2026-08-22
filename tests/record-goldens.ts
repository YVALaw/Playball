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

// Show what the numbers look like against the D1 targets before touching
// anything, so a bad baseline is obvious rather than quietly enshrined.
console.log('measured against the sourced targets:\n');
let worst = 0;
for (const [key, value] of Object.entries(m.rows)) {
  const target = TARGETS[key];
  if (target === undefined) continue;
  const diff = ((value - target) / target) * 100;
  worst = Math.max(worst, Math.abs(diff));
  const flag = Math.abs(diff) > 10 ? '   <-- OUTSIDE THE BAR' : '';
  console.log(
    `  ${key.padEnd(32)}${value.toFixed(3).padStart(8)}` +
    `${target.toFixed(3).padStart(9)}${(diff >= 0 ? '+' : '') + diff.toFixed(0) + '%'}` .padStart(7) +
    flag,
  );
}

if (worst > 10) {
  console.error(`\nrefusing to record: something is ${worst.toFixed(0)}% off target.`);
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
