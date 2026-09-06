// wants-probe.ts — calibrating the wants and the depth ladder against the league (05 §60).
//
//   npx tsx tests/wants-probe.ts
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { generateClass, recruitingPrioritiesOf, factorScore, RECRUITING_FACTORS, canPursue } from '../src/engine/recruiting.js';
import { pitchFor, developmentScore } from '../src/engine/pitch.js';
import { overallOf, armValue } from '../src/engine/ratings.js';
const season = createSeason(makeRng(7), undefined, CONFERENCES);
const cls = generateClass(2027, season.teams.length, makeRng(7));
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(xs.length * p))]!; };
const bands = (xs: number[]) => `mean ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)} p10 ${q(xs, .1).toFixed(2)} p50 ${q(xs, .5).toFixed(2)} p90 ${q(xs, .9).toFixed(2)}`;
// 1. recruits vs the men at their spot
const rec: number[] = []; const ros: number[] = []; const armsR: number[] = []; const armsT: number[] = [];
for (const p of cls.prospects.slice(0, 300)) { if (p.player.type === 'hitter') rec.push(overallOf(p.player)); else armsR.push(armValue(p.player as never)); }
for (const t of season.teams.slice(0, 24)) { for (const h of [...t.team.lineup, ...t.team.bench]) ros.push(overallOf(h)); for (const a of [...t.team.rotation, ...t.team.bullpen]) armsT.push(armValue(a)); }
console.log('recruit hitters overall', bands(rec)); console.log('roster hitters overall ', bands(ros));
console.log('recruit arms value     ', bands(armsR)); console.log('roster arms value      ', bands(armsT));
console.log('roster sizes: lineup', season.teams[0]!.team.lineup.length, 'bench', season.teams[0]!.team.bench.length, 'rotation', season.teams[0]!.team.rotation.length, 'bullpen', season.teams[0]!.team.bullpen.length);
// 2. program grades across the league, per factor (recruit-independent ones)
const grades: Record<string, number[]> = {};
const pitches = season.teams.map((t) => pitchFor(season, t, 'Gulf', developmentScore(t)));
const sample = cls.prospects.slice(0, 60);
for (const pitch of pitches) for (const f of RECRUITING_FACTORS) for (const p of sample) (grades[f] ??= []).push(factorScore(p, pitch, f));
for (const f of RECRUITING_FACTORS) console.log(`grade ${f.padEnd(12)} ${bands(grades[f]!)}`);
// 3. verdict shares on his top want for candidate formulas
const verdictOf = (gap: number) => gap >= 0.07 ? 'strong' : gap >= -0.07 ? 'fair' : gap >= -0.16 ? 'thin' : 'hollow';
for (const [base, slope, star] of [[0.12, 1.4, 0.04], [0.16, 1.4, 0.06], [0.18, 1.4, 0.07]] as const) {
  const shares: Record<string, number> = {}; let n = 0;
  const all: Record<string, number> = {};
  // Only the pairs the gate allows: a one-star program never courts a five-star.
  for (const pitch of pitches.slice(0, 32)) for (const p of sample) {
    if (!canPursue(p, pitch.stars, pitch.state === p.state ? 45 : 0)) continue;
    const w = recruitingPrioritiesOf(p);
    const top = [...RECRUITING_FACTORS].sort((a, b) => w[b] - w[a])[0]!;
    const want = Math.max(0, Math.min(1, base + w[top] * slope + (p.stars - 3) * star));
    const v = verdictOf(factorScore(p, pitch, top) - want); shares[v] = (shares[v] ?? 0) + 1; n++;
    for (const f of RECRUITING_FACTORS) { const wf = Math.max(0, Math.min(1, base + w[f] * slope + (p.stars - 3) * star)); const vf = verdictOf(factorScore(p, pitch, f) - wf); all[vf] = (all[vf] ?? 0) + 1; }
  }
  const pct = (o: Record<string, number>, k: string, tot: number) => ((o[k] ?? 0) / tot * 100).toFixed(0) + '%';
  console.log(`want = ${base} + w*${slope} + (stars-3)*${star}: top want -> strong ${pct(shares, 'strong', n)} fair ${pct(shares, 'fair', n)} thin ${pct(shares, 'thin', n)} hollow ${pct(shares, 'hollow', n)} | all factors -> hollow ${pct(all, 'hollow', n * 9)} strong ${pct(all, 'strong', n * 9)}`);
}
