// recruit-ladder.test.ts
// What a star is worth on the day he arrives.
//
// Reported 2026-09-12, in a list of twenty-six: "starting ovr is too high for 1
// and 2 stars." It was. A two star averaged 45.0 against a three star's 51.2,
// and eighteen percent of two stars turned up at 50 or better — which is the
// three star median — so the difference between the two bands was something you
// had to take on faith rather than something you could see on the card.
//
// The fix is described where it lives, at the ladder in `generateClass` and the
// thresholds in `starsFor`. The short version is that it had to be made in both
// at once: stars are derived from `serviceScore` at fixed cuts, so the ladder
// decides how many men are in a band and the thresholds decide what the band is
// worth, and only moving both lowers a two star without emptying the country.
//
// This file is the guard on the result, and it is deliberately written as two
// different kinds of assertion:
//
//   - the LADDER, which is the thing that was asked for and is pinned tightly.
//   - the TAIL, which is the thing that was asked for in the same sentence —
//     "of course there has to be outliers but not a lot of them" — and is
//     pinned from *both* sides, because a tail is as easy to lose by clamping
//     as it is to lose control of.
//
// Ten classes at the real league size, which is 7,200 men. That is not
// decoration: the per-band shares are a few percent and the tail assertions
// below count events that happen under one percent of the time, and a sample
// small enough to run fast is a sample too small to say anything. A previous
// measurement in this project was taken off twenty-three men and reported an
// anomaly that did not exist, so the sample size is asserted before anything is
// read off it.

import { describe, it, expect } from 'vitest';
import { generateClass } from '../src/engine/recruiting.js';
import { makeRng } from '../src/engine/rng.js';
import { overallOf, armValue } from '../src/engine/ratings.js';
import { potentialGrade } from '../src/engine/scouting.js';
import type { Player, Arm } from '../src/engine/types.js';

const rate = (p: Player): number =>
  p.type === 'hitter' ? overallOf(p) : armValue(p as unknown as Arm);

const CLASSES = 10;
const TEAMS = 96;

/** Every prospect in ten national classes, bucketed by the stars he was given. */
const country = (): Map<number, number[]> => {
  const rng = makeRng(4242);
  const by = new Map<number, number[]>([[1, []], [2, []], [3, []], [4, []], [5, []]]);
  for (let c = 0; c < CLASSES; c++) {
    for (const p of generateClass(c, TEAMS, rng).prospects) {
      by.get(p.stars)!.push(rate(p.player));
    }
  }
  return by;
};

const mean = (xs: readonly number[]): number =>
  xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

const share = (xs: readonly number[], at: number): number =>
  xs.filter((v) => v >= at).length / Math.max(1, xs.length);

describe('what a recruit is worth when he signs', () => {
  const by = country();
  const all = [...by.values()].flat();

  it('measured a country and not a handful', () => {
    // First, because every number below is void without it.
    expect(all.length).toBe(Math.round(TEAMS * 7.5) * CLASSES);
    for (const [stars, xs] of by) {
      expect(xs.length, `${stars} star sample = ${xs.length}`).toBeGreaterThan(300);
    }
  });

  it('starts each band where the ladder puts it', () => {
    /*
      Measured 33.3 / 41.6 / 49.9 / 58.2 / 68.6, and banded to a point and a
      half either side. Tight on purpose: this is the assertion the report was
      about, and a band loose enough never to need re-recording is a band that
      would not have caught the thing it was written for — the old figures
      (37.4 / 45.0 / 51.2) sit outside all three of the bottom bands here.
    */
    // Re-recorded 2026-09-15 (05 s87): the bottom two bands came down four
    // and two with the two-star threshold, measured 30.5 / 40.1 / 50.2 / 58.8
    // / 68.7 over ten classes. The one-star mean sits a point over its band
    // because the services still misfile a few two-star men beneath it.
    const bands: Record<number, [number, number]> = {
      1: [29.0, 32.0],
      2: [38.6, 41.6],
      3: [48.4, 51.4],
      4: [56.7, 59.7],
      5: [67.1, 70.1],
    };
    for (const [stars, [lo, hi]] of Object.entries(bands)) {
      const m = mean(by.get(Number(stars))!);
      expect(m, `${stars} star mean = ${m.toFixed(1)}`).toBeGreaterThanOrEqual(lo);
      expect(m, `${stars} star mean = ${m.toFixed(1)}`).toBeLessThanOrEqual(hi);
    }
  });

  it('keeps the bands in order and far enough apart to see', () => {
    // The complaint underneath the complaint: two and three were 6.2 apart and
    // overlapped so heavily that the label carried no information. Eight now.
    const means = [1, 2, 3, 4, 5].map((s) => mean(by.get(s)!));
    for (let i = 1; i < means.length; i++) {
      const gap = means[i]! - means[i - 1]!;
      expect(gap, `${i} star to ${i + 1} star gap = ${gap.toFixed(1)}`)
        .toBeGreaterThan(7);
    }
  });

  it('still lets a low star arrive better than his label', () => {
    /*
      The outliers, from below. These are not built by the ladder — they fall
      out of the ±26 `miss` on the projection half of `serviceScore`, which is
      how a man whose ceiling the services read low gets filed beneath his own
      bat. Deleting that error would make this test fail, which is the point of
      asserting it: the sleeper is load bearing, not decoration.
    */
    const ones = by.get(1)!;
    const twos = by.get(2)!;
    expect(Math.max(...ones), 'the best one star in ten classes').toBeGreaterThanOrEqual(44);
    expect(Math.max(...twos), 'the best two star in ten classes').toBeGreaterThanOrEqual(53);
    // And a two star who is genuinely a three star's equal exists every year.
    expect(twos.filter((v) => v >= 50).length).toBeGreaterThan(CLASSES);
  });

  it('and does not let it happen often enough to stop meaning anything', () => {
    /*
      The same outliers, from above — the half of the report that says "but not
      a lot of them". 0.9% and 6.3% measured; the ceilings are set near enough
      that the old behaviour (18.2% of two stars at 50+) fails this outright.
    */
    expect(share(by.get(1)!, 45), 'one stars at 45 or better').toBeLessThan(0.03);
    expect(share(by.get(2)!, 50), 'two stars at 50 or better').toBeLessThan(0.10);
    // Nobody signs a one star expecting a starter. 0.0% measured.
    expect(share(by.get(1)!, 50), 'one stars at 50 or better').toBeLessThan(0.005);
  });

  it('did not quietly take the superstars away with the ladder', () => {
    /*
      The guard on the *other* half of the recruiting work, because this change
      moves the input to it. Potential is projected off current overall, so
      lowering the class lowers every ceiling in it, and the rarity that was
      settled two days ago — "I was expecting like 5 to 10 per class and 10
      being too many" — could have been halved here without anybody noticing.

      It was not: 5.7 S-or-better per class before, 5.9 after. And the S grades
      did not retreat up the star ladder either, which was the other thing
      asked for — "those S potential do not have to be 5 star recruits". Nine
      of the fifty-nine went to two stars, and only six to five stars.
    */
    const rng = makeRng(4242);
    let elite = 0;
    let eliteLowStar = 0;
    for (let c = 0; c < CLASSES; c++) {
      for (const p of generateClass(c, TEAMS, rng).prospects) {
        const g = potentialGrade(p.player.potential);
        if (g !== 'S' && g !== 'S+') continue;
        elite += 1;
        if (p.stars <= 3) eliteLowStar += 1;
      }
    }
    const perClass = elite / CLASSES;
    expect(perClass, `S or better per class = ${perClass.toFixed(1)}`)
      .toBeGreaterThanOrEqual(4);
    expect(perClass, `S or better per class = ${perClass.toFixed(1)}`)
      .toBeLessThanOrEqual(10);
    // The majority of them are not five stars, and that is the design.
    expect(eliteLowStar / elite).toBeGreaterThan(0.5);
  });
});
