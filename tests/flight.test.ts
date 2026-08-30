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
import * as THREE from 'three';
import {
  flightHeight, flightSeconds, basePath, playPlan, STATIONS, type BallHit,
} from '../src/ui/Diamond3D.js';

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

/*
  When the field says the play is over.

  Reported after watching it: *"when a hit is out, it still goes out of the
  player's dot into the green area and then blinks red, it makes it look like it
  was actually a hit."* The colour was timed off the ball landing, and the
  landing is the decisive moment for only two of the three cases -- so a ground
  out flashed red in empty grass, which is the picture a single makes.

  Pinned here rather than in a screenshot for the same reason as everything else
  in this file: it is arithmetic on a plan object, and the alternative is trying
  to photograph a moving object at the right millisecond.
*/
describe('when the outcome shows', () => {
  const stations = STATIONS.map((s) => new THREE.Vector3(s[0], 0.26, s[2]));

  const plan = (over: Partial<BallHit>) => playPlan({
    x: 0, y: 0.45, kind: 'ground', hit: false, caught: false, tick: 1,
    ...over,
  } as BallHit, stations);

  it('calls a catch the moment it is caught', () => {
    const p = plan({ kind: 'fly', caught: true, y: 0.8 });
    expect(p.outcomeAt).toBe(p.flight);
  });

  it('calls a base hit the moment it lands, because that is the event', () => {
    // Nobody was there. The ball reaching the grass is the whole story.
    const p = plan({ hit: true });
    expect(p.outcomeAt).toBe(p.flight);
  });

  it('waits for a man to actually have it before calling a ground out', () => {
    const p = plan({ hit: false, caught: false });
    expect(p.outcomeAt).toBeGreaterThan(p.flight);
    // And not later than the throw, or the out is announced after it is made.
    expect(p.outcomeAt).toBeLessThanOrEqual(p.throwAt);
  });

  it('never lets a ground out flash before the ball has stopped rolling', () => {
    // The specific failure: red in the grass, yards from the nearest dot, a
    // second before anybody reached it.
    for (const kind of ['ground', 'line', 'fly'] as BattedBall[]) {
      const p = plan({ kind, hit: false, caught: false, x: -0.6, y: 0.7 });
      expect(p.outcomeAt, `${kind} announced its out early`)
        .toBeGreaterThanOrEqual(p.flight);
    }
  });

  it('says nothing at all about a ball that left the yard', () => {
    const p = plan({ kind: 'fly', hit: true, y: 1.3 });
    expect(p.homer).toBe(true);
    expect(Number.isFinite(p.outcomeAt)).toBe(false);
  });
});
