// fielding-blast-radius.ts
// One-off measurement harness for folding defence into `overallOf`.
//
// Not a test — a probe. Generates recruiting classes and league rosters and
// prints the distributions the change is at risk of moving: overall itself,
// the potential grades the recent ceiling rework tuned, the star ratings and
// national ranks the services cut from `serviceScore`, and `rosterStrength`.
//
// Run with `npx tsx tests/fielding-blast-radius.ts`. Cheap: nothing here plays
// a game.

import { makeRng } from '../src/engine/rng.js';
import { makeTeam, resetNames } from '../src/engine/players.js';
import { overallOf } from '../src/engine/ratings.js';
import { generateClass, starsFor, serviceScore } from '../src/engine/recruiting.js';
import { potentialGrade, type PotentialGrade } from '../src/engine/scouting.js';
import { rosterStrength } from '../src/engine/program.js';
import type { Player } from '../src/engine/types.js';

const SEEDS = [11, 23, 37, 41, 59, 71, 83, 97];

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const pctile = (xs: number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] as number;
};
const f = (n: number): string => n.toFixed(2).padStart(7);

const GRADES: PotentialGrade[] = ['S+', 'S', 'A+', 'A', 'B', 'C', 'D'];

// ---------------------------------------------------------------------------
// Recruiting classes
// ---------------------------------------------------------------------------

const classOveralls: number[] = [];
const classPotentials: number[] = [];
const gradeCounts: Record<string, number[]> = {};
const starCounts: number[][] = [[], [], [], [], []];
const byPos: Record<string, number[]> = {};

for (const seed of SEEDS) {
  resetNames();
  const rng = makeRng(seed);
  const klass = generateClass(2030, 64, rng);
  const grades: Record<string, number> = {};
  const stars = [0, 0, 0, 0, 0];
  for (const pr of klass.prospects) {
    const p: Player = pr.player;
    classOveralls.push(overallOf(p));
    classPotentials.push(p.potential);
    const g = potentialGrade(p.potential);
    grades[g] = (grades[g] ?? 0) + 1;
    stars[starsFor(p) - 1] = (stars[starsFor(p) - 1] ?? 0) + 1;
    const key = p.type === 'pitcher' ? `P-${p.role}` : p.pos;
    (byPos[key] ??= []).push(overallOf(p));
  }
  for (const g of GRADES) (gradeCounts[g] ??= []).push(grades[g] ?? 0);
  stars.forEach((n, i) => (starCounts[i] as number[]).push(n));
}

console.log(`RECRUITING CLASS (${SEEDS.length} classes of ${Math.round(64 * 7.5)})`);
console.log(`  overall     mean ${f(mean(classOveralls))}  sd ${f(sd(classOveralls))}`
  + `  p10 ${f(pctile(classOveralls, 0.10))}  p50 ${f(pctile(classOveralls, 0.50))}`
  + `  p90 ${f(pctile(classOveralls, 0.90))}  p99 ${f(pctile(classOveralls, 0.99))}`
  + `  max ${f(Math.max(...classOveralls))}`);
console.log(`  potential   mean ${f(mean(classPotentials))}  sd ${f(sd(classPotentials))}`
  + `  p90 ${f(pctile(classPotentials, 0.90))}  p99 ${f(pctile(classPotentials, 0.99))}`
  + `  at cap ${classPotentials.filter((x) => x >= 94).length / SEEDS.length} per class`);
console.log('  potential grades, per class:');
for (const g of GRADES) {
  console.log(`    ${g.padEnd(3)} ${f(mean(gradeCounts[g] ?? [0]))}`);
}
console.log('  stars, per class:');
starCounts.forEach((c, i) => console.log(`    ${i + 1}★ ${f(mean(c))}`));
console.log('  overall by slot:');
for (const k of Object.keys(byPos).sort()) {
  console.log(`    ${k.padEnd(4)} mean ${f(mean(byPos[k] as number[]))}`
    + `  sd ${f(sd(byPos[k] as number[]))}`);
}

// ---------------------------------------------------------------------------
// National rank churn: does the service board reorder?
// ---------------------------------------------------------------------------

resetNames();
const rankRng = makeRng(11);
const rankClass = generateClass(2030, 64, rankRng);
const ordered = [...rankClass.prospects].sort(
  (a, b) => serviceScore(b.player) - serviceScore(a.player),
);
console.log('\nTOP 12 BY SERVICE SCORE (seed 11)');
ordered.slice(0, 12).forEach((pr, i) => {
  const p = pr.player;
  console.log(`  ${String(i + 1).padStart(3)}  ${p.name.padEnd(20)}`
    + ` ${(p.type === 'pitcher' ? p.role : p.pos).padEnd(3)}`
    + ` ovr ${String(overallOf(p)).padStart(3)}  pot ${String(p.potential).padStart(3)}`
    + ` ${potentialGrade(p.potential).padEnd(2)} ${pr.stars}★`
    + `  score ${f(serviceScore(p))}`);
});

// ---------------------------------------------------------------------------
// League rosters
// ---------------------------------------------------------------------------

const strengths: number[] = [];
const rosterOveralls: number[] = [];
for (const seed of SEEDS) {
  resetNames();
  const rng = makeRng(seed);
  for (let i = 0; i < 64; i++) {
    const quality = 38 + (i / 63) * 24;
    const t = makeTeam(rng, `T${i}`, quality);
    strengths.push(rosterStrength(t));
    for (const p of [...t.lineup, ...t.rotation, ...t.bullpen, ...t.bench]) {
      rosterOveralls.push(overallOf(p));
    }
  }
}
console.log('\nLEAGUE ROSTERS (8 worlds of 64)');
console.log(`  player overall  mean ${f(mean(rosterOveralls))}  sd ${f(sd(rosterOveralls))}`
  + `  p90 ${f(pctile(rosterOveralls, 0.90))}  max ${f(Math.max(...rosterOveralls))}`);
console.log(`  rosterStrength  mean ${f(mean(strengths))}  sd ${f(sd(strengths))}`
  + `  min ${f(Math.min(...strengths))}  max ${f(Math.max(...strengths))}`);
