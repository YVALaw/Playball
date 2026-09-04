// playbooks.test.ts
// Stage 22: positioning made real, and the opponent playbooks that carry it.
//
// Three families of pin. The FACTORS hold the zero-sum rule — every control's
// neutral row is exactly the engine as calibrated, and every aggressive row
// pays somewhere. The SEAM holds auto-apply — the user's side reads the book
// against a scouted club and nobody else's game changes. The STATIONS hold
// the reporter's "please please please": the dugout's men stand where the
// playbook says, and the chase follows the actual stations — an outfielder
// can never own a ball on the dirt.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_STRATEGY, defenseFactors, type Strategy,
} from '../src/engine/strategy.js';
import { appliedStrategy, type SeasonState, type TeamRecord } from '../src/engine/season.js';
import { stationsFor, chaserFor, STATIONS } from '../src/ui/Diamond3D.js';
import type { Hitter } from '../src/engine/types.js';

const puller = { power: 72, speed: 42, bats: 'R' } as Hitter;
const lefty = { power: 68, speed: 45, bats: 'L' } as Hitter;

describe('the factors: every neutral row is the engine as calibrated', () => {
  it('the defaults change nothing at all', () => {
    const f = defenseFactors(DEFAULT_STRATEGY, puller);
    expect(f.singles).toBe(1);
    expect(f.gaps).toBe(1);
    expect(f.fromThird).toBe(1);
    expect(f.sacFly).toBe(1);
    expect(f.buntBeat).toBe(1);
  });

  it('a strategy from before the controls existed reads as neutral', () => {
    const old = {
      running: 'balanced', steals: 'selective', bunt: 'rare',
      hook: 'standard', alignment: 'straight',
    } as Strategy;
    const f = defenseFactors(old, puller);
    expect(f.singles).toBe(1);
    expect(f.gaps).toBe(1);
  });

  it('the infield on the grass kills the run and the bunt, and pays in singles', () => {
    const f = defenseFactors({ ...DEFAULT_STRATEGY, infield: 'in' }, puller);
    expect(f.fromThird).toBeLessThan(1);
    expect(f.buntBeat).toBeLessThan(1);
    expect(f.singles).toBeGreaterThan(1);
  });

  it('a deep outfield closes the gaps and opens the grass in front', () => {
    const f = defenseFactors({ ...DEFAULT_STRATEGY, outfield: 'deep' }, puller);
    expect(f.gaps).toBeLessThan(1);
    expect(f.singles).toBeGreaterThan(1);
    expect(f.sacFly).toBeGreaterThan(1);
  });

  it('the called shift: right call takes singles, wrong call is a gift', () => {
    const right = defenseFactors({ ...DEFAULT_STRATEGY, shift: 'left' }, puller);
    const wrong = defenseFactors({ ...DEFAULT_STRATEGY, shift: 'right' }, puller);
    expect(right.singles).toBeLessThan(1);
    expect(wrong.singles).toBeGreaterThan(1);
    // And the same call flips with the batter's hands.
    const vsLefty = defenseFactors({ ...DEFAULT_STRATEGY, shift: 'right' }, lefty);
    expect(vsLefty.singles).toBeLessThan(1);
  });
});

describe('the seam: whose strategy plays tonight', () => {
  const rec = (index: number, abbr: string, strategy: Strategy): TeamRecord =>
    ({ index, strategy, def: { abbr } }) as unknown as TeamRecord;
  const book: Strategy = { ...DEFAULT_STRATEGY, infield: 'in', shift: 'left' };
  const season = {
    captureBoxFor: 3,
    playbooks: { OPP: book },
  } as unknown as SeasonState;
  const me = rec(3, 'ME', DEFAULT_STRATEGY);
  const opp = rec(7, 'OPP', DEFAULT_STRATEGY);
  const other = rec(9, 'OTH', DEFAULT_STRATEGY);

  it('the user reads the book against the club it names', () => {
    expect(appliedStrategy(season, me, opp)).toBe(book);
  });

  it('no book, no change — and rivals always play their own game', () => {
    expect(appliedStrategy(season, me, other)).toBe(me.strategy);
    expect(appliedStrategy(season, opp, me)).toBe(opp.strategy);
  });
});

describe('the stations: the men stand where the playbook says', () => {
  const v = (s: [number, number, number]): THREE.Vector3 =>
    new THREE.Vector3(s[0], 0.26, s[2]);

  it('neutral positioning is the chart as it always stood', () => {
    expect(stationsFor()).toEqual(STATIONS.map((s) => [...s]));
    expect(stationsFor({ infield: 'normal', outfield: 'normal', shift: 'none' }))
      .toEqual(STATIONS.map((s) => [...s]));
  });

  it('the infield on the grass steps toward the plate; back steps away', () => {
    const grass = stationsFor({ infield: 'in' });
    const back = stationsFor({ infield: 'back' });
    for (const i of [2, 3, 4, 5]) {
      expect(grass[i]![2]).toBeGreaterThan(STATIONS[i]![2]);
      expect(back[i]![2]).toBeLessThan(STATIONS[i]![2]);
    }
  });

  it('outfield depth moves the leash radially, both ways', () => {
    const deep = stationsFor({ outfield: 'deep' });
    const shallow = stationsFor({ outfield: 'shallow' });
    for (const i of [6, 7, 8]) {
      const r0 = Math.hypot(STATIONS[i]![0], STATIONS[i]![2]);
      expect(Math.hypot(deep[i]![0], deep[i]![2])).toBeGreaterThan(r0);
      expect(Math.hypot(shallow[i]![0], shallow[i]![2])).toBeLessThan(r0);
    }
  });

  it('a called shift shades the dirt four toward the pull side', () => {
    const left = stationsFor({ shift: 'left' });
    for (const i of [2, 3, 4, 5]) {
      expect(left[i]![0]).toBeLessThan(STATIONS[i]![0]);
    }
  });

  it('the chase follows the stations, and the grass never chases the dirt', () => {
    const moved = stationsFor({ outfield: 'deep', shift: 'left', infield: 'in' })
      .map((s) => v(s));
    // A ball dying on the dirt is an infielder's, whatever the outfield does.
    for (const spot of [v([1.4, 0, -2.8]), v([-1.3, 0, -3.2]), v([0.2, 0, -4.2])]) {
      expect([2, 3, 4, 5]).toContain(chaserFor(spot, moved));
    }
    // A ball in the grass belongs to the grass.
    expect([6, 7, 8]).toContain(chaserFor(v([-4, 0, -9]), moved));
    // And the mound's lane is still the mound's.
    expect(chaserFor(v([0, 0, -1.4]), moved)).toBe(1);
  });

  it('a shaded outfield hands the pulled ball to the man now standing there', () => {
    const straight = stationsFor().map((s) => v(s));
    const shaded = stationsFor({ shift: 'left' }).map((s) => v(s));
    // Deep toward the left-centre gap: with the whole outfield spun left,
    // the man nearest the ball can change — and whoever it is, he came
    // from the outfield ring.
    const ball = v([-5.2, 0, -8.6]);
    expect([6, 7]).toContain(chaserFor(ball, straight));
    expect([6, 7]).toContain(chaserFor(ball, shaded));
  });
});

// ---------------------------------------------------------------------------
// The money half: what the wages and the bricks now buy.
// ---------------------------------------------------------------------------

import { devBonus, armCareFor, FACILITIES, marketFor } from '../src/engine/economy.js';
import { threw } from '../src/engine/workload.js';
import type { Arm, Pitcher } from '../src/engine/types.js';

describe('the money: each seat and rung buys something a season can feel', () => {
  // Winter stated rather than inherited from the market's hash: an
  // assistant is a SHAPE now, and development reads the winter half, so a
  // fixture that leaves it to chance is a fixture that pins nothing.
  const staffOf = (seat: 'hitting' | 'pitching', rating: number, winter = 0.5) => ({
    [seat]: { ...marketFor('w', 2030, seat)[0]!, rating, winter },
  });

  it('the game-side coaches develop their own side', () => {
    expect(devBonus({})).toEqual({ bat: 0, arm: 0 });
    const hitting = devBonus(staffOf('hitting', 84));
    expect(hitting.bat).toBe(11);
    expect(hitting.arm).toBe(0);
    const pitching = devBonus(staffOf('pitching', 60));
    expect(pitching.arm).toBe(8);
    expect(pitching.bat).toBe(0);
    // And the shape is what decides it: the same man spent on the winter
    // builds more than the one who is worth his rating on the night.
    expect(devBonus(staffOf('hitting', 84, 1)).bat)
      .toBeGreaterThan(devBonus(staffOf('hitting', 84, 0.2)).bat);
  });

  it('the pitching coach carries the mileage, floor held', () => {
    expect(armCareFor({})).toBe(1);
    expect(armCareFor(staffOf('pitching', 80))).toBeCloseTo(0.8, 5);
    expect(armCareFor(staffOf('pitching', 99))).toBe(0.78);
  });

  it('the rungs guard bodies, best lab best guard', () => {
    const guards = FACILITIES.map((f) => f.injuryGuard);
    expect(guards[0]).toBe(1);
    for (let i = 1; i < guards.length; i++) {
      expect(guards[i]!).toBeLessThan(guards[i - 1]!);
    }
  });

  it('cared-for innings put less mileage in the arm, and none in the stats', () => {
    const raw = { id: 'a1', type: 'pitcher' } as unknown as Arm;
    const cared = { id: 'a2', type: 'pitcher' } as unknown as Arm;
    threw(raw, 18);
    threw(cared, 18, 0.8);
    const w = (a: Arm): number => (a as Pitcher & { outs?: number }).outs ?? 0;
    expect(w(raw)).toBe(18);
    expect(w(cared)).toBeCloseTo(14.4, 5);
  });
});
