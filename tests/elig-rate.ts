// elig-rate.ts
// How often the classroom actually takes somebody.
//
//   npx tsx tests/elig-rate.ts [seasons]
//
// Written because it was reported as happening "way too often", and the
// frequency is the product of three numbers that nobody set together: the share
// of a roster under the line, the number of weeks in a season, and the per-week
// chance. Each looked reasonable on its own.

import { createSeason, DEFAULT_SEASON } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { atRisk, failsThisWeek, standing } from '../src/engine/eligibility.js';

const SEASONS = Number(process.argv[2] ?? 40);

let totalAtRisk = 0;
let totalTrouble = 0;
let totalMen = 0;
let totalHits = 0;
let weeks = 0;

for (let s = 0; s < SEASONS; s++) {
  const season = createSeason(makeRng(1000 + s), DEFAULT_SEASON, [...CONFERENCES]);
  const rec = season.teams[0]!;
  const men = [
    ...rec.team.lineup, ...rec.team.bench, ...rec.team.rotation, ...rec.team.bullpen,
  ];
  totalMen += men.length;
  totalAtRisk += men.filter(atRisk).length;
  totalTrouble += men.filter((p) => standing(p) === 'trouble').length;

  const nWeeks = Math.floor(season.schedule.length / 7);
  weeks += nWeeks;
  for (let w = 0; w <= nWeeks; w++) {
    for (const p of men) {
      if (atRisk(p) && failsThisWeek(p, season.year ?? 0, w)) totalHits++;
    }
  }
}

console.log(`roster            ${(totalMen / SEASONS).toFixed(1)} men`);
console.log(`at risk           ${(totalAtRisk / SEASONS).toFixed(2)} per roster  (${(100 * totalAtRisk / totalMen).toFixed(1)}%)`);
console.log(`in trouble        ${(totalTrouble / SEASONS).toFixed(2)} per roster  (${(100 * totalTrouble / totalMen).toFixed(1)}%)`);
console.log(`weeks in a season ${(weeks / SEASONS).toFixed(1)}`);
console.log(`SUSPENSIONS       ${(totalHits / SEASONS).toFixed(2)} per season`);
