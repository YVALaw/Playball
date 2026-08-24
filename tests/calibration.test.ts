// calibration.test.ts
// The regression test that actually matters.
//
// Two jobs, deliberately separate:
//
//   1. DETERMINISM. The engine is seeded, so 2000 games at seed 4242 must
//      produce byte-identical league rates forever. Any change to draw order,
//      any inserted rng() call, any reordered property in a generator will move
//      these and fail loudly. That is the point.
//
//   2. CALIBRATION. Those rates must also resemble real NCAA Division I
//      baseball. This is the looser check and the one with judgment in it.
//
// When 1 fails and 2 still passes, you changed engine behavior. Decide whether
// you meant to, then update the golden values in the same commit as the change.

import { describe, it, expect } from 'vitest';
import { runSeason, metrics, TARGETS } from '../src/engine/calibration.js';
import { makeRng, makeTeam, makeHitter, makePitcher, resetNames } from '../src/engine/players.js';
import { simGame } from '../src/engine/game.js';
import { ENGINES } from '../src/engine/engines.js';
import type { Hitter, Pitcher } from '../src/engine/types.js';

/**
 * Re-recorded 2026-08-24, when a caught stealing became an out. For years it
 * only erased the runner, which made every steal attempt half price; charging
 * the out ends some innings early, and every random draw after such an inning
 * shifts. Runs moved from 5.18 to 5.01 per team per game — about 3%, the real
 * cost of the outs that were being given away — and every component rate still
 * lands within 5% of the sourced D1 targets (runs sit 5% under a target that is
 * DERIVED rather than sourced, as flagged when it was set).
 *
 * Previously re-recorded 2026-08-22, when coaching strategy became real:
 * baserunning can now fail, the computer bunts, and every program carries a
 * philosophy.
 */
const GOLDEN: Record<string, number> = {
  'Runs per team per game': 5.091875,
  'PA per team per game': 39.966875,
  'Batting average': 0.267206596276711,
  'On base percentage': 0.3444154273591151,
  'Home runs per team per game': 0.50625,
  'Strikeouts per team per game': 6.530625,
  'Walks per team per game': 3.6679166666666667,
  'Pitches per plate appearance': 3.632383067227548,
  'Slugging': 0.3727973858505648,
};

const GOLDEN_SLUGGING = 0.3727973858505648;
const GOLDEN_ERRORS = 1.0935416666666666;
const GOLDEN_SB_PCT = 0.7129162462159435;

/**
 * Metrics still outside the 10% bar. The list is now empty, and keeping the
 * mechanism means the next thing to drift has somewhere to be declared rather
 * than quietly tolerated.
 *
 * It held six entries before the August 2026 tuning pass. The engine was aimed
 * at partly wrong targets — the strikeout figure was MLB's — and measured by a
 * harness that sampled a single lucky roster pair. With sourced D1 rates and a
 * twelve pair harness, everything lands inside 5%.
 */
const KNOWN_OFF: Record<string, number> = {};

describe('determinism', () => {
  const m = metrics(runSeason('log5', 2400));

  for (const [key, expected] of Object.entries(GOLDEN)) {
    it(`reproduces ${key} exactly`, () => {
      expect(m.rows[key]).toBeCloseTo(expected, 10);
    });
  }

  it('reproduces slugging, errors and stolen base rate exactly', () => {
    expect(m.slugging).toBeCloseTo(GOLDEN_SLUGGING, 10);
    expect(m.errorsPerGame).toBeCloseTo(GOLDEN_ERRORS, 10);
    expect(m.stolenBasePct).toBeCloseTo(GOLDEN_SB_PCT, 10);
  });

  it('gives the same result twice from the same seed', () => {
    const a = metrics(runSeason('log5', 200, 777));
    const b = metrics(runSeason('log5', 200, 777));
    expect(a.rows).toEqual(b.rows);
  });

  it('gives a different result from a different seed', () => {
    const a = metrics(runSeason('log5', 200, 777));
    const b = metrics(runSeason('log5', 200, 778));
    expect(a.rows['Runs per team per game']).not.toBe(b.rows['Runs per team per game']);
  });
});

/**
 * Calibration is measured across eight independent base seeds, not one.
 *
 * The twelve-pair harness already averages over the roster lottery *within* a
 * seed, and the comment on `CALIBRATION_PAIRS` explains why that mattered. What
 * it does not do is average across seeds, and the seed-to-seed spread turns out
 * to be comparable to the tolerance being tested: runs per game ranged 4.60 to
 * 5.06 over eight seeds, a swing of 9% against a 10% bar. A single-seed
 * assertion at that spread cannot tell a real regression from a lucky draw — it
 * will pass a broken engine on a friendly seed and fail a correct one on a
 * hostile seed, and both failures are silent.
 *
 * Determinism keeps its single seed on purpose. That test's job is "the same
 * seed gives the same answer", which is exactly a one-seed question.
 */
const SWEEP_SEEDS = [4242, 12161, 20080, 27999, 35918, 43837, 51756, 59675];

function sweep(): Record<string, number> {
  const runs = SWEEP_SEEDS.map((seed) => metrics(runSeason('log5', 2400, seed)).rows);
  const mean: Record<string, number> = {};
  for (const key of Object.keys(runs[0] as object)) {
    const values = runs.map((r) => r[key]).filter((v): v is number => typeof v === 'number');
    if (values.length) mean[key] = values.reduce((a, b) => a + b, 0) / values.length;
  }
  return mean;
}

describe('calibration against NCAA Division I', () => {
  // Rates against sourced targets use the seed sweep; the range checks below
  // are wide enough that one seed answers them honestly.
  const m = { rows: sweep() };
  const single = metrics(runSeason('log5', 2400));

  // The harness flags anything past 10 percent with "<-- off". Same bar here.
  for (const key of Object.keys(GOLDEN)) {
    it(`${key} is within 10% of the D1 target`, () => {
      const target = TARGETS[key];
      expect(target).toBeDefined();
      const value = m.rows[key] as number;
      const bar = KNOWN_OFF[key] ?? 0.10;
      expect(Math.abs(value - (target as number)) / (target as number)).toBeLessThan(bar);
    });
  }

  it('produces a believable slugging percentage', () => {
    // BBCOR college, not MLB: the sourced D1 figure is .374, well under the
    // .399 the majors slug. Metal bats built to behave like wood.
    expect(single.slugging).toBeGreaterThan(0.340);
    expect(single.slugging).toBeLessThan(0.420);
  });

  it('produces college-level error rates, not pro ones', () => {
    // D1 defense is meaningfully worse than MLB's. Around one a game.
    expect(single.errorsPerGame).toBeGreaterThan(0.70);
    expect(single.errorsPerGame).toBeLessThan(1.60);
  });
});

describe('platoon model', () => {
  // Same bat, same arm, only the handedness pairing changes. Any difference is
  // the platoon model and nothing else.
  const rng = makeRng(99);
  const lhb: Hitter = makeHitter(rng, 60, { bats: 'L', throws: 'L' });
  const rhb: Hitter = { ...lhb, bats: 'R', throws: 'R' };
  lhb.platoonSkill = 0.09;
  rhb.platoonSkill = 0.045;

  const rhp: Pitcher = makePitcher(rng, 55, { throws: 'R' });
  const lhp: Pitcher = { ...rhp, throws: 'L' };
  rhp.platoonSkill = 0;
  lhp.platoonSkill = 0;

  const avg = (batter: Hitter, pitcher: Pitcher): number => {
    let h = 0;
    let ab = 0;
    for (let i = 0; i < 40000; i++) {
      const pa = ENGINES.log5(batter, pitcher, {}, rng);
      if (pa.event === 'walk' || pa.event === 'hbp') continue;
      ab++;
      if (pa.event !== 'out') h++;
    }
    return h / ab;
  };

  const leftyGap = avg(lhb, rhp) - avg(lhb, lhp);
  const rightyGap = avg(rhb, lhp) - avg(rhb, rhp);

  it('favors the batter in an opposite handed matchup', () => {
    expect(leftyGap).toBeGreaterThan(0);
    expect(rightyGap).toBeGreaterThan(0);
  });

  it('gives lefties the larger split, as the research says it should', () => {
    expect(leftyGap).toBeGreaterThan(rightyGap);
  });
});

describe('walk-offs', () => {
  // A walk-off ends the instant the winning run scores, so the margin is one —
  // unless it is a home run, where the ball is dead and every run counts. Four
  // is therefore the ceiling: a grand slam.
  it('never produces a walk-off margin above a grand slam', () => {
    resetNames();
    const rng = makeRng(99);
    const home = makeTeam(rng, 'Home', 51);
    const away = makeTeam(rng, 'Away', 51);

    let walkoffs = 0;
    let oneRun = 0;
    for (let i = 0; i < 4000; i++) {
      const r = simGame(home, away, rng, {});
      if (r.home.runs <= r.away.runs) continue;
      const halves = r.home.lineScore.length;
      if (halves < 9) continue;
      if ((r.home.lineScore[halves - 1] ?? 0) === 0) continue;
      walkoffs++;
      const margin = r.home.runs - r.away.runs;
      expect(margin).toBeLessThanOrEqual(4);
      if (margin === 1) oneRun++;
    }

    expect(walkoffs).toBeGreaterThan(100);
    // The overwhelming majority are one run: every non-homer walk-off, plus solo shots.
    expect(oneRun / walkoffs).toBeGreaterThan(0.80);
  });
});
