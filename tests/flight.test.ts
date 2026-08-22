// flight.test.ts
// A ground ball has to look like a ground ball.
//
// Reported after watching it: every batted ball travelled on the same gentle
// parabola, so a routine grounder to short sailed through the air exactly like a
// fly to the warning track. Those are the two plays a viewer is most often
// watching to tell apart, and the animation made them identical.
//
// The trajectory is pure arithmetic, so it is checked here rather than by trying
// to photograph a moving object at the right millisecond.

import { describe, it, expect } from 'vitest';
import { flightHeight, flightSeconds, basePath } from '../src/ui/Diamond3D.js';

/** The bags, matching Diamond3D's world layout. */
const BAGS: Record<number, [number, number, number]> = {
  0: [0, 0, 0], 1: [2.1, 0, -2.1], 2: [0, 0, -4.2], 3: [-2.1, 0, -2.1],
};
import type { BattedBall } from '../src/engine/types.js';

/** The highest the ball gets, sampled along the whole flight. */
const peak = (kind: BattedBall, distance: number, homer = false): number => {
  let hi = 0;
  for (let i = 0; i <= 100; i++) hi = Math.max(hi, flightHeight(kind, i / 100, distance, homer));
  return hi;
};

const INFIELD = 3.5;   // a ball hit at the shortstop
const OUTFIELD = 8.0;  // a ball hit to the warning track

describe('how each kind of ball travels', () => {
  it('keeps a ground ball on the ground', () => {
    // Knee high at the very most, on a ball hit through the infield.
    expect(peak('ground', INFIELD)).toBeLessThan(0.75);
  });

  it('separates a grounder from a fly ball hit the same distance', () => {
    // The defect: these were the same number.
    expect(peak('fly', INFIELD)).toBeGreaterThan(peak('ground', INFIELD) * 1.8);
  });

  it('keeps a line drive flat, and well under a fly ball', () => {
    expect(peak('line', OUTFIELD)).toBeLessThan(peak('fly', OUTFIELD) * 0.4);
    expect(peak('line', OUTFIELD)).toBeGreaterThan(peak('ground', OUTFIELD));
  });

  it('sends a popup nearly straight up', () => {
    // Short distance, huge height — the one ball whose peak beats its length.
    expect(peak('popup', 2.5)).toBeGreaterThan(2.0);
  });

  it('carries a home run higher than anything else', () => {
    expect(peak('fly', OUTFIELD, true)).toBeGreaterThan(peak('fly', OUTFIELD));
  });

  it('never buries the ball under the turf', () => {
    for (const kind of ['ground', 'line', 'fly', 'popup'] as BattedBall[]) {
      for (let i = 0; i <= 20; i++) {
        expect(flightHeight(kind, i / 20, OUTFIELD, false)).toBeGreaterThan(0);
      }
    }
  });

  it('bounces a grounder more than once', () => {
    // Count direction changes in height: a skipping ball goes up and down
    // repeatedly, a single arc does not.
    let turns = 0;
    let prev = flightHeight('ground', 0, OUTFIELD, false);
    let rising = false;
    for (let i = 1; i <= 200; i++) {
      const h = flightHeight('ground', i / 200, OUTFIELD, false);
      const nowRising = h > prev;
      if (nowRising !== rising) { turns += 1; rising = nowRising; }
      prev = h;
    }
    expect(turns).toBeGreaterThan(3);
  });
});

describe('how long it takes', () => {
  it('gives a fly ball longer hang time than a liner the same distance', () => {
    expect(flightSeconds('fly', OUTFIELD, false))
      .toBeGreaterThan(flightSeconds('line', OUTFIELD, false));
  });

  it('takes longer to reach the outfield than the infield', () => {
    expect(flightSeconds('fly', OUTFIELD, false))
      .toBeGreaterThan(flightSeconds('fly', INFIELD, false));
  });

  it('never finishes instantly', () => {
    for (const kind of ['ground', 'line', 'fly', 'popup'] as BattedBall[]) {
      expect(flightSeconds(kind, 1, false)).toBeGreaterThan(0.2);
    }
  });
});

describe('runners run the bases', () => {
  it('touches every bag on the way, rather than cutting the corner', () => {
    // A man going first to third must go through second. Easing him straight at
    // the destination sends him diagonally across the pitcher's mound.
    const firstToThird = basePath(1, 3);
    expect(firstToThird).toHaveLength(2);
    expect(firstToThird[0]).toEqual(BAGS[2]);   // second
    expect(firstToThird[1]).toEqual(BAGS[3]);   // third
  });

  it('sends a man scoring from second through third and home', () => {
    const path = basePath(2, 4);
    expect(path).toHaveLength(2);
    expect(path[0]).toEqual(BAGS[3]);
    expect(path[1]).toEqual(BAGS[0]);           // home, wrapped from 4
  });

  it('takes one step for a single base', () => {
    expect(basePath(0, 1)).toEqual([BAGS[1]]);
    expect(basePath(3, 4)).toEqual([BAGS[0]]);
  });

  it('never routes a runner backwards', () => {
    for (let from = 0; from <= 3; from++) {
      for (let to = from + 1; to <= 4; to++) {
        const path = basePath(from as 0 | 1 | 2 | 3, to as 1 | 2 | 3 | 4);
        expect(path.length).toBe(to - from);
      }
    }
  });
});

describe('a batter reaching base', () => {
  it('runs from the plate, not from the bag he ends on', () => {
    // He appeared standing on first before. That is the same teleport the
    // advance bug produced; it just happened to be the one nobody looked at.
    expect(basePath(0, 1)).toEqual([BAGS[1]]);
    expect(basePath(0, 2)).toEqual([BAGS[1], BAGS[2]]);
    expect(basePath(0, 3)).toEqual([BAGS[1], BAGS[2], BAGS[3]]);
  });

  it('sends a man who clears the bases all the way round', () => {
    expect(basePath(0, 4)).toEqual([BAGS[1], BAGS[2], BAGS[3], BAGS[0]]);
  });
});
