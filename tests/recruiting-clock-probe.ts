// recruiting-clock-probe.ts
// What the window looks like now that recruits decide: commits per week, how
// many are still standing at the deadline, and where the five-stars land.
//
//   npx tsx tests/recruiting-clock-probe.ts
//
// Ninety-six programs on a prestige spread, everybody spending greedily, five
// classes. The rows a coach feels: whether the board empties across the
// window or piles up on the last day, and whether a five-star program still
// has to earn its share of the top.

import {
  generateClass, closeWeek, resetWeeklySpend, aiTargets, weeklyPoints, leadersAtWeekStart,
  RECRUITING_WEEKS, decisionStyle, type Pitch,
} from '../src/engine/recruiting.js';
import { makeRng } from '../src/engine/rng.js';
import { resetNames } from '../src/engine/players.js';
import type { Region } from '../src/data/schools.js';

const REGIONS: Region[] = [
  'Gulf', 'Atlantic', 'Pacific', 'Heartland', 'Desert', 'Great Lakes', 'Mountain', 'Northeast',
];

function program(prestige: number, i: number): Pitch {
  return {
    prestige,
    stars: prestige >= 0.72 ? 5 : prestige >= 0.6 ? 4 : prestige >= 0.48 ? 3
      : prestige >= 0.38 ? 2 : 1,
    playingTime: () => 0.5,
    winning: 0.5,
    region: REGIONS[i % REGIONS.length]!,
    state: 'LA',
    development: 0.5,
  };
}

const programs = Array.from({ length: 96 }, (_, i) => program(0.3 + (i / 95) * 0.55, i));
const byWeek = new Array<number>(RECRUITING_WEEKS + 1).fill(0);
let total = 0;
let unsigned = 0;
let fiveStars = 0;
const fiveStarsBy: Record<number, number> = {};
const styleCommits: Record<string, number[]> = { early: [], steady: [], late: [] };

for (const seed of [11, 22, 33, 44, 55]) {
  resetNames();
  const rng = makeRng(seed);
  const recruits = generateClass(2027, programs.length, rng);
  for (let w = 1; w <= RECRUITING_WEEKS; w++) {
    recruits.week = w;
    const at = leadersAtWeekStart(recruits);
    programs.forEach((pitch, team) => {
      for (const { prospect, actions } of aiTargets(team, pitch, 45, recruits.prospects, 8, rng, at, 0, w)) {
        prospect.spent[team] = actions;
        prospect.points[team] = (prospect.points[team] ?? 0) + weeklyPoints(prospect, pitch, actions, 45);
      }
    });
    for (const c of closeWeek(recruits, rng, w >= RECRUITING_WEEKS)) {
      byWeek[w]! += 1;
      total += 1;
      styleCommits[decisionStyle(c.prospect)]!.push(w);
      if (c.prospect.stars === 5) {
        fiveStars += 1;
        const s = programs[c.team]!.stars;
        fiveStarsBy[s] = (fiveStarsBy[s] ?? 0) + 1;
      }
    }
    resetWeeklySpend(recruits);
  }
  unsigned += recruits.prospects.filter((p) => p.signedBy === null).length;
}

const classes = 5;
console.log('commits per week, averaged over five classes:');
for (let w = 1; w <= RECRUITING_WEEKS; w++) {
  const n = byWeek[w]! / classes;
  console.log(`  week ${String(w).padStart(2)}  ${String(Math.round(n)).padStart(4)}  ${'#'.repeat(Math.round(n / 4))}`);
}
console.log(`\ncommitted ${Math.round(total / classes)} per class; unsigned at the deadline ${Math.round(unsigned / classes)}`);
const mean = (xs: number[]): string => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);
console.log(`mean commit week — early ${mean(styleCommits.early!)}, steady ${mean(styleCommits.steady!)}, late ${mean(styleCommits.late!)}`);
console.log(`five-stars signed ${Math.round(fiveStars / classes)} per class, by program tier:`,
  Object.entries(fiveStarsBy).map(([s, n]) => `${s}★ ${Math.round(n / classes)}`).join(', '));
