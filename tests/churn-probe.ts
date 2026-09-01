// churn-probe.ts
// Does the pecking order move? Thirty seasons, ninety six programmes.
//
//   npx tsx tests/churn-probe.ts
//
// Reported after a long save: "there is not enough disparity and teams always
// keep their status — the ones that are five star at the beginning are the
// same five star teams twenty five seasons down the road."
//
// The claim needs a number, and the number needs the REAL yearly loop:
// prestige only ever moves inside `reviewSeason` (the coached programme) and
// `runRivalYear` (the other ninety five), so a probe that rolls seasons
// without them measures a frozen world and calls it a finding. That mistake
// is documented in climb-probe.ts; this follows its harness.

import {
  createSeason, simSeason, seasonComplete, nextSeason, seasonLength,
  type SeasonState,
} from '../src/engine/season.js';
import { runPostseason } from '../src/engine/postseason.js';
import { runRivalYear, seatCoaches } from '../src/engine/rivals.js';
import { fillRosters, departAndDevelop } from '../src/engine/progression.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';

const YEARS = 30;

let season: SeasonState = createSeason(makeRng(90126), undefined, CONFERENCES);
season.year = 2027;
seatCoaches(season, -1, 2027);

const start = season.teams.map((t) => ({
  abbr: t.def.abbr, prestige: t.prestige, quality: t.team.quality,
}));
const startRank = [...start]
  .sort((a, b) => b.prestige - a.prestige)
  .map((t) => t.abbr);

for (let y = 0; y < YEARS; y++) {
  while (!seasonComplete(season)) simSeason(season);
  const post = runPostseason(season);
  runRivalYear(season, post, {
    year: season.year ?? 2027,
    userTeam: -1,                 // every programme graded, nobody exempt
    games: seasonLength(season.config),
  });
  departAndDevelop(season, season.rng, { userTeam: -1 });
  fillRosters(season, season.rng, { userTeam: -1 });
  const rolled = nextSeason(season);
  rolled.year = (season.year ?? 2027) + 1;
  season = rolled;
}

const end = season.teams.map((t) => ({
  abbr: t.def.abbr, prestige: t.prestige, quality: t.team.quality,
}));
const endRank = [...end]
  .sort((a, b) => b.prestige - a.prestige)
  .map((t) => t.abbr);

const spread = (xs: number[]): string => {
  const s = [...xs].sort((a, b) => a - b);
  const at = (q: number): number => s[Math.floor(s.length * q)] ?? 0;
  return `p10 ${at(0.1).toFixed(0)}  median ${at(0.5).toFixed(0)}  p90 ${at(0.9).toFixed(0)}`;
};

console.log(`=== ${YEARS} seasons ===\n`);
console.log(`prestige start  ${spread(start.map((t) => t.prestige))}`);
console.log(`prestige end    ${spread(end.map((t) => t.prestige))}`);
console.log(`quality  start  ${spread(start.map((t) => t.quality))}`);
console.log(`quality  end    ${spread(end.map((t) => t.quality))}`);

// The question the reporter actually asked: is the top table the same table?
const top12start = new Set(startRank.slice(0, 12));
const top12end = new Set(endRank.slice(0, 12));
const held = [...top12end].filter((a) => top12start.has(a));
console.log(`\ntop twelve, then and now: ${held.length} of 12 are the same programme`);
console.log(`  in:  ${[...top12end].filter((a) => !top12start.has(a)).join(' ') || '—'}`);
console.log(`  out: ${[...top12start].filter((a) => !top12end.has(a)).join(' ') || '—'}`);

// And the movers, which is the story a dynasty is supposed to be able to tell.
const moved = end.map((t, i) => ({
  abbr: t.abbr,
  d: t.prestige - (start[i]?.prestige ?? 0),
  from: start[i]?.prestige ?? 0, to: t.prestige,
  q: t.quality - (start[i]?.quality ?? 0),
})).sort((a, b) => b.d - a.d);

console.log('\nbiggest climbs');
for (const m of moved.slice(0, 4)) {
  console.log(`  ${m.abbr.padEnd(4)} ${m.from} → ${m.to}  (quality ${m.q >= 0 ? '+' : ''}${m.q.toFixed(1)})`);
}
console.log('biggest falls');
for (const m of moved.slice(-4)) {
  console.log(`  ${m.abbr.padEnd(4)} ${m.from} → ${m.to}  (quality ${m.q >= 0 ? '+' : ''}${m.q.toFixed(1)})`);
}

const rankOf = (list: string[], a: string): number => list.indexOf(a);
const shifts = end.map((t) => Math.abs(rankOf(endRank, t.abbr) - rankOf(startRank, t.abbr)));
const meanShift = shifts.reduce((a, b) => a + b, 0) / shifts.length;
console.log(`\nmean movement in the national order: ${meanShift.toFixed(1)} places of 96`);
