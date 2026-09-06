// Baseball correctness regressions added after the September 2026 sim audit.
// These are rules/state tests, not balance tests: every case below once allowed
// an impossible base state or an incorrect official scoring decision.

import { describe, expect, it } from 'vitest';
import {
  TeamState, RULES, createHalfInning, moundVisit, canMoundVisit,
  resolveOut, winningPitcherFor, savingPitcherFor, landingFor, type Bases,
} from '../src/engine/game.js';
import { makeRng } from '../src/engine/rng.js';
import {
  createSeason, simNextDay, currentDay, injuryClock, pitcherReady, recoveryGap,
} from '../src/engine/season.js';
import { makeTeam, resetNames } from '../src/engine/players.js';
import type { EngineFn, Hitter, PAResult, Rng } from '../src/engine/types.js';

const scriptedRng = (values: number[], fallback = 0.5): Rng => {
  let at = 0;
  return (() => at < values.length ? values[at++] as number : fallback) as Rng;
};

const pa = (event: PAResult['event'], kind: PAResult['kind']): PAResult => ({
  event, kind, pitches: ['inplay'], engine: 'log5',
});

const scriptedEngine = (results: PAResult[]): EngineFn => {
  let at = 0;
  return (() => results[Math.min(at++, results.length - 1)] as PAResult) as EngineFn;
};

function clubs(seed = 100) {
  resetNames();
  const rng = makeRng(seed);
  return {
    batTeam: makeTeam(rng, 'Audit Batters', 50),
    fldTeam: makeTeam(rng, 'Audit Fielders', 50),
  };
}

describe('baseball-state correctness', () => {
  it('does not end after the top of the seventh merely because the visitor leads by ten', () => {
    const { batTeam, fldTeam } = clubs();
    const home = new TeamState(batTeam, true);
    const away = new TeamState(fldTeam, false);
    away.runs = 10;
    expect(RULES.decided('top', 7, home, away, true)).toBe(false);
    home.runs = 20;
    expect(RULES.decided('top', 7, home, away, true)).toBe(true);
  });

  it('moves the full force chain on a bases-loaded fielder choice', () => {
    const { batTeam, fldTeam } = clubs();
    const [fromFirst, fromSecond, fromThird, batter] = batTeam.lineup as [Hitter, Hitter, Hitter, Hitter, ...Hitter[]];
    const bases: Bases = [fromFirst, fromSecond, fromThird];
    const scored: Hitter[] = [];
    const out = resolveOut(
      bases, batter, 'ground', 0, scriptedRng([0.99, 0]), scored,
      new Map(), fldTeam.rotation[0]!,
    );
    expect(out.outs).toBe(1);
    expect(scored).toEqual([fromThird]);
    expect(bases).toEqual([batter, null, fromSecond]);
  });

  it('does not score a run on a bases-loaded force double play for the third out', () => {
    const { batTeam, fldTeam } = clubs();
    const [fromFirst, fromSecond, fromThird, batter] = batTeam.lineup as [Hitter, Hitter, Hitter, Hitter, ...Hitter[]];
    const bases: Bases = [fromFirst, fromSecond, fromThird];
    const scored: Hitter[] = [];
    const out = resolveOut(
      bases, batter, 'ground', 1, scriptedRng([0]), scored,
      new Map(), fldTeam.rotation[0]!,
    );
    expect(out.outs).toBe(2);
    expect(scored).toHaveLength(0);
  });

  it('replaces the outgoing defender when a pinch hitter enters', () => {
    const { batTeam } = clubs();
    const side = new TeamState(batTeam, true);
    const outgoing = side.order[0]!;
    const sub = side.benchTonight[0]!;
    const spot = [...side.byPosition].find(([, f]) => f.id === outgoing.id)?.[0];
    expect(spot).toBeDefined();
    side.pinchHit(0, sub);
    expect(side.byPosition.get(spot!)?.id).toBe(sub.id);
    expect([...side.byPosition.values()].some((f) => f.id === outgoing.id)).toBe(false);
  });

  it('uses a team mound-visit pool rather than resetting with each pitcher', () => {
    const { batTeam } = clubs();
    const side = new TeamState(batTeam, true);
    side.currentInning = 6;
    for (let i = 0; i < 6; i++) expect(moundVisit(side)).toBe(true);
    expect(moundVisit(side)).toBe(false);
    side.currentInning = 10;
    expect(moundVisit(side)).toBe(true);
    expect(moundVisit(side)).toBe(false);
    side.currentInning = 11;
    expect(canMoundVisit(side)).toBe(true);
  });
});

describe('official scoring correctness', () => {
  it('records a sacrifice fly as SF with no at-bat', () => {
    const { batTeam, fldTeam } = clubs(12);
    const bat = new TeamState(batTeam, false);
    const fld = new TeamState(fldTeam, true);
    const half = createHalfInning(
      bat, fld, 1, scriptedEngine([pa('out', 'fly')]), () => 0.1, () => {},
      false, null, undefined, true, true,
    );
    (half.bases as Bases)[2] = bat.order[8]!;
    const hitter = bat.order[0]!;
    half.step();
    const line = bat.hitLine(hitter);
    expect(bat.runs).toBe(1);
    expect(line.ab).toBe(0);
    expect(line.sf).toBe(1);
  });

  it('reconstructs error then homer as two runs but one earned', () => {
    const { batTeam, fldTeam } = clubs(44);
    for (const p of [...fldTeam.lineup, ...fldTeam.rotation, ...fldTeam.bullpen]) {
      p.range = 50; p.hands = 0;
    }
    const bat = new TeamState(batTeam, false);
    const fld = new TeamState(fldTeam, true);
    const half = createHalfInning(
      bat, fld, 1,
      scriptedEngine([pa('out', 'ground'), pa('homerun', 'fly')]),
      scriptedRng([0, 0, 0.99, 0.5]), () => {}, false, null, undefined, true, true,
    );
    half.step(); half.step();
    const line = fld.pitchLine(fld.starter);
    expect([bat.runs, line.r, line.er]).toEqual([2, 2, 1]);
  });

  it('makes all runs unearned after two outs then an error extends the inning', () => {
    const { batTeam, fldTeam } = clubs(45);
    for (const p of [...fldTeam.lineup, ...fldTeam.rotation, ...fldTeam.bullpen]) {
      p.range = 50; p.hands = 0;
    }
    const bat = new TeamState(batTeam, false);
    const fld = new TeamState(fldTeam, true);
    const half = createHalfInning(
      bat, fld, 1,
      scriptedEngine([
        pa('out', 'strikeout'), pa('out', 'strikeout'),
        pa('out', 'ground'), pa('homerun', 'fly'),
      ]),
      scriptedRng([0, 0, 0.99, 0.5]), () => {}, false, null, undefined, true, true,
    );
    half.step(); half.step(); half.step(); half.step();
    const line = fld.pitchLine(fld.starter);
    expect([bat.runs, line.r, line.er]).toEqual([2, 2, 0]);
  });

  it('enforces the starter five-inning win gate and recognizes a save', () => {
    const { batTeam } = clubs(88);
    const side = new TeamState(batTeam, true);
    side.pitchLine(side.starter).outs = 12;
    const reliever = batTeam.bullpen[0]!;
    side.pitchLine(reliever).outs = 9;
    expect(winningPitcherFor(side, side.starter)).toBe(reliever);
    side.pitcher = reliever;
    side.noteReliefEntry(reliever, 2, 0);
    expect(savingPitcherFor(side, null)).toBe(reliever);
  });
});

describe('what the merge review found', () => {
  it('strands the other runners on an inning-ending double play instead of losing them', () => {
    // With one out, a 6-4-3 ends the inning: the man on first and the batter
    // are the outs and everybody else is simply left on base. The first cut of
    // the force-chain fix cleared every base, so a runner on second vanished
    // with neither an out nor a run — the conservation sweep in
    // tests/liveGame.test.ts is what caught it.
    const { batTeam, fldTeam } = clubs(7);
    const [fromFirst, fromSecond, fromThird, batter] = batTeam.lineup as [Hitter, Hitter, Hitter, Hitter, ...Hitter[]];
    const bases: Bases = [fromFirst, fromSecond, fromThird];
    const scored: Hitter[] = [];
    const out = resolveOut(bases, batter, 'ground', 1, scriptedRng([0]), scored, new Map(), fldTeam.rotation[0]!);
    expect(out.outs).toBe(2);
    expect(scored).toHaveLength(0);
    expect(bases[0]).toBeNull();
    expect(bases[1]).toBe(fromSecond);
    expect(bases[2]).toBe(fromThird);
  });

  it('keeps where the man a pinch hitter replaced actually stood', () => {
    // The box score labels a lifted starter by the spot he played tonight, off
    // `playedAt`; the substitution must add the new man without erasing the old.
    const { batTeam } = clubs(9);
    const side = new TeamState(batTeam, true);
    const outgoing = side.order[0]!;
    const spot = side.playedAt.get(String(outgoing.id));
    expect(spot).toBeDefined();
    side.pinchHit(0, side.benchTonight[0]!);
    expect(side.playedAt.get(String(outgoing.id))).toBe(spot);
    expect(side.playedAt.get(String(side.benchTonight[0]!.id))).toBe(spot);
  });

  it('reads rest off the calendar and health off the injury clock', () => {
    // The season keeps two clocks: `currentDay` is the calendar the workload
    // ledger is written in, `injuryClock` the schedule index the trainer uses.
    // A week in they already disagree, and readiness has to read each on its
    // own scale — the first cut compared a calendar day against the index and
    // found every starter owed rest for the rest of the year.
    const season = createSeason(makeRng(31));
    for (let i = 0; i < 8; i++) simNextDay(season);
    expect(currentDay(season)).not.toBe(injuryClock(season));
    const arm = season.teams[0]!.team.rotation[0]!;
    const day = currentDay(season);
    (season.pitcherWorkload ??= new Map()).set(arm.id, { day: day - 2, pitches: 100, outs: 21 });
    expect(recoveryGap(100)).toBe(5);
    expect(pitcherReady(season, arm)).toBe(false);
    season.pitcherWorkload.set(arm.id, { day: day - 5, pitches: 100, outs: 21 });
    expect(pitcherReady(season, arm)).toBe(true);
    season.pitcherWorkload.set(arm.id, { day: day - 1, pitches: 12, outs: 3 });
    expect(pitcherReady(season, arm)).toBe(true);
  });
});

describe('a ball that gets away, as the dugout sees it', () => {
  // Reported: "runner on third, the pitcher walked my batter, and the runner
  // scored." A wild pitch had scored him inside the same tap as the walk. The
  // rules were right; the telling was wrong. With a coach watching, the loose
  // pitch is its own step now, the way a steal always was.
  const setup = (seed: number, manual: boolean) => {
    const { batTeam, fldTeam } = clubs(seed);
    const bat = new TeamState(batTeam, false);
    const fld = new TeamState(fldTeam, true);
    const log: string[] = [];
    const half = createHalfInning(
      bat, fld, 1, scriptedEngine([pa('walk', 'ground')]),
      // The first draw is the loose-pitch roll in a manual half; zero fires it.
      scriptedRng([0], 0), (s) => log.push(s), false, null, undefined, manual, manual,
    );
    const runner = bat.order[8]!;
    (half.bases as Bases)[2] = runner;
    return { bat, half, runner, log };
  };

  it('scores the run as its own play and leaves the same man at the plate', () => {
    const { bat, half, runner, log } = setup(21, true);
    const spot = bat.spot;
    expect(half.step()).toBe(false);
    expect(bat.runs).toBe(1);
    expect(bat.spot).toBe(spot);
    expect(half.bases[2]).toBeNull();
    expect(log.some((l) => /Wild pitch|Passed ball/.test(l))).toBe(true);
    expect(log.some((l) => l.startsWith('['))).toBe(false);

    // The next tap is the walk, with no second roll for a loose pitch: the
    // batter reaches, nobody else moves, the run count stands.
    const batter = bat.order[spot]!;
    expect(half.step()).toBe(false);
    expect(bat.runs).toBe(1);
    expect(half.bases[0]).toBe(batter);
    expect(half.bases[2]).toBeNull();
    expect(bat.spot).toBe((spot + 1) % 9);
    void runner;
  });

  it('keeps both in one step in the simulated game, so its draws do not move', () => {
    const { bat, half, log } = setup(21, false);
    const spot = bat.spot;
    expect(half.step()).toBe(false);
    expect(bat.runs).toBe(1);
    expect(bat.spot).toBe((spot + 1) % 9);
    expect(log.some((l) => /Wild pitch|Passed ball/.test(l))).toBe(true);
    expect(log.some((l) => /walks/.test(l))).toBe(true);
  });

  it('never scores a man from third on a walk by itself', () => {
    // The sweep behind the report: forty worlds, every tactic, both dugouts,
    // a walk with a runner on third and nobody else — not one run without a
    // loose pitch, a bunt or a steal line in front of it. Pinned narrowly.
    const { batTeam, fldTeam } = clubs(33);
    for (const manual of [true, false]) {
      const bat = new TeamState(batTeam, false);
      const fld = new TeamState(fldTeam, true);
      const half = createHalfInning(
        bat, fld, 1, scriptedEngine([pa('walk', 'ground')]),
        scriptedRng([], 0.999), () => {}, false, null, undefined, manual, manual,
      );
      const runner = bat.order[8]!;
      (half.bases as Bases)[2] = runner;
      half.step();
      expect(bat.runs).toBe(0);
      expect(half.bases[2]).toBe(runner);
      expect(half.bases[0]).not.toBeNull();
    }
  });
});

describe('where a single lands', () => {
  it('draws a single off an infielder on the grass, where an outfielder plays it', () => {
    // Reported from the emulator: a man scoring from second on a ball the
    // park drew inside the diamond, picked up by an infielder, no error. The
    // engine had sent the ball through the hole; the picture had it dying on
    // the dirt. Past the chaser ring (y ≈ .54 straightaway) or close to it,
    // never at the mound, for every infield spot and every count.
    const { fldTeam } = clubs(5);
    for (const pos of ['1B', '2B', 'SS', '3B'] as const) {
      const man = fldTeam.lineup.find((p) => p.pos === pos)!;
      for (let salt = 1; salt <= 60; salt++) {
        const at = landingFor(man, 'ground', 'single', salt)!;
        expect(at.y, `${pos} salt ${salt}`).toBeGreaterThanOrEqual(0.52);
        expect(at.y).toBeLessThanOrEqual(0.80);
      }
    }
    // A single dropped in front of an outfielder is still a shallow ball.
    const cf = fldTeam.lineup.find((p) => p.pos === 'CF')!;
    expect(landingFor(cf, 'fly', 'single', 3)!.y).toBeLessThan(landingFor(cf, 'fly', 'double', 3)!.y);
  });
});
