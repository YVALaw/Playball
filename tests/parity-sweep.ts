// parity-sweep.ts
// How often does the better team win, across the whole range of rating gaps?
//
// `sim.ts parity` only measures one 30 point gap, which the shipped conference
// never produces, and then prints a verdict based on it. This is the curve that
// verdict should be read against. Run with:
//
//   npx tsx tests/parity-sweep.ts

import { makeRng, makeTeam, resetNames } from '../src/engine/players.js';
import { simGame } from '../src/engine/game.js';

const N = 4000;
const PAIRS: ReadonlyArray<readonly [number, number]> = [
  [68, 38], [62, 44], [58, 46], [57, 44], [55, 48], [52, 50],
];

console.log(`\nWin% for the better team, ${N} games per pair, home/away split evenly`);
console.log('strong  weak   gap   win%   (home)  (away)');

for (const [sq, wq] of PAIRS) {
  resetNames();
  const rng = makeRng(7);
  const strong = makeTeam(rng, 'Strong', sq);
  const weak = makeTeam(rng, 'Weak', wq);

  let homeWins = 0;
  let awayWins = 0;
  for (let i = 0; i < N / 2; i++) {                    // strong at home
    const r = simGame(strong, weak, rng, {});
    if (r.home.runs > r.away.runs) homeWins++;
  }
  for (let i = 0; i < N / 2; i++) {                    // strong on the road
    const r = simGame(weak, strong, rng, {});
    if (r.away.runs > r.home.runs) awayWins++;
  }

  const pct = ((homeWins + awayWins) / N) * 100;
  console.log(
    String(sq).padStart(6) + String(wq).padStart(7) +
    String(sq - wq).padStart(6) + (pct.toFixed(1) + '%').padStart(8) +
    ((homeWins / (N / 2) * 100).toFixed(1) + '%').padStart(9) +
    ((awayWins / (N / 2) * 100).toFixed(1) + '%').padStart(8),
  );
}

console.log('\nThe shipped conference spans quality 44 to 57, so 13 is the widest');
console.log('gap it produces. 75 to 85 percent there is the real target.');
