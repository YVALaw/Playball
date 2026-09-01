// balance-probe.ts
// Measuring the September 1 balance pass, rather than asserting it.
//
//   npx tsx tests/balance-probe.ts
//
// Four questions the reporter's thirty-season save raised, each answered with
// a number instead of an opinion:
//
//   1. Do recruiting classes actually carry a freshman's ceiling now?
//   2. Are stars a noisy enough signal to produce busts and steals?
//   3. Does a programme's floor (Team.quality) move over a career?
//   4. Do professional careers end?
//
// Deliberately a probe and not a test. These are distributions; a suite that
// asserted them to two decimal places would fail on any future tuning and
// teach nobody anything. The numbers here are meant to be READ.

import { generateClass, serviceScore, starsFor } from '../src/engine/recruiting.js';
import { proCareer } from '../src/engine/legacy.js';
import { createSeason, nextSeason } from '../src/engine/season.js';
import { overallOf } from '../src/engine/ratings.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';

const pct = (n: number, of: number): string => `${((n / of) * 100).toFixed(1)}%`;

// ---------------------------------------------------------------------------
// 1 & 2 — the class
// ---------------------------------------------------------------------------
const cls = generateClass(1, 96, makeRng(20260901));
const men = cls.prospects;

const headroom = men.map((p) => p.player.potential - overallOf(p.player));
const meanHead = headroom.reduce((a, b) => a + b, 0) / headroom.length;
const gems = headroom.filter((h) => h >= 20).length;

console.log('=== the class ===');
console.log(`men            ${men.length}`);
console.log(`mean headroom  ${meanHead.toFixed(1)} points of growth`);
console.log(`real sleepers  ${gems} (${pct(gems, men.length)}) with 20+ to come`);

// How far the services can be from the truth, in bands.
const byStars = new Map<number, number[]>();
for (const p of men) {
  const list = byStars.get(p.stars) ?? [];
  list.push(p.player.potential);
  byStars.set(p.stars, list);
}
console.log('\n=== what a star is worth, by ceiling ===');
for (const s of [5, 4, 3, 2, 1]) {
  const list = (byStars.get(s) ?? []).sort((a, b) => a - b);
  if (list.length === 0) continue;
  const at = (q: number): number => list[Math.floor(list.length * q)] ?? 0;
  console.log(
    `${s}★  n=${String(list.length).padStart(3)}  `
    + `ceiling p10 ${at(0.1)}  median ${at(0.5)}  p90 ${at(0.9)}`,
  );
}

// The two the reporter actually asked for: a five-star who cannot grow, and a
// low-star with a genuine ceiling that no program above him is allowed to chase.
const busts = men.filter((p) => p.stars >= 4 && p.player.potential - overallOf(p.player) <= 4);
const steals = men.filter((p) => p.stars <= 2 && p.player.potential >= 78);
console.log(`\nfour-star-plus with nothing left   ${busts.length}`);
console.log(`two-star-or-less with a real ceiling ${steals.length}`);
if (steals[0]) {
  const s = steals[0];
  console.log(
    `  e.g. ${s.player.name}, ${s.stars}★, `
    + `${overallOf(s.player)} now → ${s.player.potential} ceiling, `
    + `rated ${serviceScore(s.player).toFixed(1)} (${starsFor(s.player)}★)`,
  );
}

// ---------------------------------------------------------------------------
// 3 — does the floor move?
// ---------------------------------------------------------------------------
let season = createSeason(makeRng(4242), undefined, CONFERENCES);
const first = season.teams.map((t) => ({
  abbr: t.def.abbr, q0: t.team.quality, p0: t.prestige,
}));
for (let y = 0; y < 25; y++) season = nextSeason(season);

console.log('\n=== twenty five years of drift ===');
const moved = season.teams.map((t, i) => ({
  abbr: t.def.abbr,
  q0: first[i]!.q0, q1: t.team.quality,
  p0: first[i]!.p0, p1: t.prestige,
})).sort((a, b) => (b.q1 - b.q0) - (a.q1 - a.q0));
for (const row of [...moved.slice(0, 3), ...moved.slice(-3)]) {
  console.log(
    `${row.abbr.padEnd(4)} quality ${String(row.q0).padStart(5)} → ${String(row.q1).padStart(5)}`
    + `   prestige ${String(row.p0).padStart(3)} → ${String(row.p1).padStart(3)}`,
  );
}
const spread0 = Math.max(...first.map((t) => t.q0)) - Math.min(...first.map((t) => t.q0));
const spread1 = Math.max(...season.teams.map((t) => t.team.quality))
  - Math.min(...season.teams.map((t) => t.team.quality));
console.log(`quality spread ${spread0.toFixed(1)} → ${spread1.toFixed(1)}`);

// ---------------------------------------------------------------------------
// 4 — do careers end?
// ---------------------------------------------------------------------------
console.log('\n=== professional careers ===');
let longest = 0;
let unfinished = 0;
const lengths: number[] = [];
for (let i = 0; i < 400; i++) {
  const id = `probe${i}`;
  const note = {
    name: 'A Man', teamAbbr: 'PSA', year: 2030,
    reason: 'drafted' as const, overall: 55 + (i % 40), classYear: 'SR' as const,
    round: (i % 12) + 1,
  };
  const rows = proCareer(id, note, 2030 + 30);
  if (rows.length === 0) continue;
  const last = rows[rows.length - 1]!;
  if (!last.final) unfinished++;
  lengths.push(rows.length);
  longest = Math.max(longest, rows.length);
}
const meanLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
console.log(`careers        ${lengths.length}`);
console.log(`mean length    ${meanLen.toFixed(1)} years`);
console.log(`longest        ${longest} years`);
console.log(`still going after 30 seasons: ${unfinished}`);
