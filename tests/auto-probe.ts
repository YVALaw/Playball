// auto-probe.ts — what an opponent looks like to the scouting desk.
//
// The AUTO button on an opponent plan used absolute thresholds (power ≥ 54,
// speed ≥ 53, a handedness split of 3) that a typical lineup never crossed,
// so it moved one row of eight. This measures, across a generated league,
// the things a plan can be built from — lineup power and speed, the
// catcher's arm, the outfield's arms, the staff's quality and its hold on
// runners, pull hitters and handedness — so `opponentPlan` can set its
// thresholds a standard deviation out and be sure they fire.
//
//   npx tsx tests/auto-probe.ts

import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { tendenciesOf } from '../src/engine/tendencies.js';
import { opponentPlan, leagueBaselines } from '../src/engine/counters.js';
import { DEFAULT_STRATEGY, type Strategy } from '../src/engine/strategy.js';

const stats = (xs: number[]): string => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  const s = [...xs].sort((a, b) => a - b);
  return `mean ${m.toFixed(1)} sd ${sd.toFixed(1)} p10 ${s[Math.floor(xs.length * .1)]!.toFixed(1)} p90 ${s[Math.floor(xs.length * .9)]!.toFixed(1)}`;
};

for (const seed of [11, 23]) {
  const season = createSeason(makeRng(seed), undefined, CONFERENCES);
  const rows = season.teams.map((t) => {
    const bats = t.team.lineup;
    const arms = [...t.team.rotation, ...t.team.bullpen];
    const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const catcher = bats.find((h) => h.pos === 'C');
    const of = bats.filter((h) => h.pos === 'LF' || h.pos === 'CF' || h.pos === 'RF');
    return {
      power: avg(bats.map((h) => h.power)),
      speed: avg(bats.map((h) => h.speed)),
      catcherArm: catcher?.arm ?? 0,
      ofArm: avg(of.map((h) => h.arm)),
      staff: avg(arms.map((p) => (p.stuff + p.movement + p.control) / 3)),
      hold: avg(arms.map((p) => p.holdRunners)),
      pull: bats.filter((h) => (tendenciesOf(h).spray ?? 0) > 0).length,
      whole: bats.filter((h) => (tendenciesOf(h).spray ?? 0) < 0).length,
      split: bats.filter((h) => h.bats === 'R').length - bats.filter((h) => h.bats === 'L').length,
    };
  });
  console.log(`\nseed ${seed}, ${rows.length} teams`);
  for (const k of ['power', 'speed', 'catcherArm', 'ofArm', 'staff', 'hold', 'pull', 'whole', 'split'] as const) {
    console.log(`  ${k.padEnd(11)} ${stats(rows.map((r) => r[k]))}`);
  }

  // What the new plan does, team by team, against a default standing plan.
  const base = leagueBaselines(season);
  const keys = Object.keys(DEFAULT_STRATEGY) as (keyof Strategy)[];
  const moved: Record<string, number> = {};
  let atLeastThree = 0;
  for (const t of season.teams) {
    const plan = opponentPlan(season, t, { ...DEFAULT_STRATEGY }, base);
    let n = 0;
    for (const k of keys) {
      if (plan[k] !== DEFAULT_STRATEGY[k]) { moved[k] = (moved[k] ?? 0) + 1; n++; }
    }
    if (n >= 3) atLeastThree++;
  }
  console.log(`  rows moved off the default, per key:`, moved);
  console.log(`  teams with three or more rows moved: ${atLeastThree} of ${season.teams.length}`);
}
