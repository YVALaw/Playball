// potential-forecast.test.ts
// Is the letter on a man's card a forecast, or a restatement of what he is?
//
// Reported after fifteen seasons: *"they all progress or develop at similar
// rates when actually depending on their potential and boom/boost etc it should
// feel different. An A potential grew 3 ovr just like a C potential each year."*
//
// The development engine was never the problem. Growth tracks the gap between a
// man's ceiling and his current rating, and it does so almost perfectly —
// measured across 18,331 man-winters in six worlds, gain divided by gap is
// 0.385 / 0.382 / 0.384 / 0.367 / 0.344 / 0.333 from S down to D. The engine
// does not know or care what letter he wears.
//
// The problem was upstream: `projectPotential` drew headroom from class year
// and from **nothing about the player**, so potential was current ability plus
// a class-year constant and 72.6% of every recruiting class landed in two
// adjacent headroom bands. Headroom is a roll now, and how wide that roll is
// depends on how raw he already is.
//
// Measured, six worlds, ~18,350 man-winters each, before and after:
//
//   grade    old gain    new gain     old n    new n
//   S         +10.72      +11.41        72      122
//   A+         +6.91       +7.28       204      207
//   A          +4.87       +5.36      1127     1403
//   B          +3.44       +4.00      2697     2860
//   C          +2.42       +2.70      5518     5005
//   D          +1.80       +1.29      8743     8734
//
// The ladder was monotone before and still is. What moved is its SPREAD —
// S-over-D goes 5.96x to 8.84x — and it moved mostly at the bottom, because a
// finished man now correctly has almost nothing left. And more men with real
// ceilings reach a roster at all: S man-winters up 69%, A up 24%.

import { describe, it, expect } from 'vitest';
import { createSeason } from '../src/engine/season.js';
import { generateClass } from '../src/engine/recruiting.js';
import { departAndDevelop } from '../src/engine/progression.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { overallOf, armValue } from '../src/engine/ratings.js';
import { potentialGrade } from '../src/engine/scouting.js';
import type { Player, Arm } from '../src/engine/types.js';

const ratingOf = (p: Player): number =>
  (p.type === 'hitter' ? overallOf(p) : armValue(p as unknown as Arm));
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Four winters of six worlds, which is enough men for the S band to mean
 * something. One world gives about twenty S-grade man-winters and a standard
 * error of ±2 on a gain of 11 — wide enough to reverse the ladder by accident,
 * which is exactly the mistake this file exists to stop somebody repeating.
 *
 * It was three worlds until the landing strip landed (`05` §75). Making the S
 * grade rare — which is what it was for — halved that band, so the sample had
 * to be bought back rather than the threshold lowered. A guard against reading
 * noise is worthless the moment it is relaxed to accommodate noise.
 */
interface Step { grade: string; gap: number; gain: number }
const steps: Step[] = [];
for (const seed of [4242, 909, 1717, 2103, 31337, 77]) {
  const season = createSeason(makeRng(seed), undefined, CONFERENCES);
  const everybody = (): Player[] => season.teams.flatMap((t) =>
    [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen] as Player[]);
  for (let y = 0; y < 4; y++) {
    const before = new Map<string, { grade: string; ovr: number; gap: number }>();
    for (const p of everybody()) {
      const ovr = ratingOf(p);
      before.set(String(p.id), { grade: potentialGrade(p.potential), ovr, gap: p.potential - ovr });
    }
    departAndDevelop(season, season.rng, { userTeam: 0 });
    for (const p of everybody()) {
      const was = before.get(String(p.id));
      if (was) steps.push({ grade: was.grade, gap: was.gap, gain: ratingOf(p) - was.ovr });
    }
  }
}

const band = (g: string): Step[] => steps.filter((s) => s.grade === g);
const gainOf = (g: string): number => mean(band(g).map((s) => s.gain));

describe('the ceiling on a card', () => {
  it('has enough men in every band to be worth asserting about', () => {
    // The guard on the guard. An S band of twenty is noise, and reading noise
    // as signal is how an imaginary defect gets reported as a real one.
    expect(steps.length).toBeGreaterThan(8000);
    expect(band('S').length).toBeGreaterThan(40);
    expect(band('A+').length).toBeGreaterThan(80);
  });

  it('predicts growth, in the right order, all the way down', () => {
    const ladder = ['S', 'A+', 'A', 'B', 'C', 'D'];
    for (let i = 1; i < ladder.length; i++) {
      const above = gainOf(ladder[i - 1]!);
      const below = gainOf(ladder[i]!);
      expect(above, `${ladder[i - 1]} (${above.toFixed(2)}) must out-grow ${ladder[i]} (${below.toFixed(2)})`)
        .toBeGreaterThan(below);
    }
  });

  it('puts a real distance between the top of the board and the bottom', () => {
    // 8.84x measured over six worlds; asserted at 6x so a seed cannot fail it,
    // and so the old formula's 5.96x would not have passed.
    expect(gainOf('S') / gainOf('D')).toBeGreaterThan(6);
  });

  it('grows a man on his headroom and not on his letter', () => {
    /*
      The engine must stay blind to the grade. If gain-per-point-of-gap differed
      by band, the ladder above would be a thumb on the scale rather than a
      consequence — and a coach could no longer read a man's remaining room off
      the two numbers on his card.
    */
    for (const g of ['S', 'A+', 'A', 'B']) {
      const set = band(g);
      const rate = mean(set.map((s) => s.gain)) / mean(set.map((s) => s.gap));
      expect(rate, `${g} grows at ${rate.toFixed(3)} of its gap`).toBeGreaterThan(0.30);
      expect(rate, `${g} grows at ${rate.toFixed(3)} of its gap`).toBeLessThan(0.45);
    }
  });
});

describe('a recruiting class', () => {
  const potentials: { ovr: number; pot: number; stars: number }[] = [];
  const rng = makeRng(4242);
  for (let c = 0; c < 6; c++) {
    for (const p of generateClass(c, 96, rng).prospects) {
      potentials.push({ ovr: ratingOf(p.player), pot: p.player.potential, stars: p.stars });
    }
  }
  const gapOf = (r: { ovr: number; pot: number }) => r.pot - r.ovr;

  it('no longer piles most of the country into two headroom bands', () => {
    // Before: gap 6-10 and 11-15 held 72.6% of every class between them, with
    // mean star ratings of 2.48 and 2.56 — indistinguishable. That is what made
    // one man's development look like another's.
    const inBand = (lo: number, hi: number) =>
      potentials.filter((r) => gapOf(r) >= lo && gapOf(r) <= hi).length / potentials.length;
    expect(inBand(6, 10) + inBand(11, 15)).toBeLessThan(0.45);
    for (const [lo, hi] of [[0, 5], [6, 10], [11, 15], [16, 20], [21, 30]] as [number, number][]) {
      expect(inBand(lo, hi), `gap ${lo}-${hi} holds too much of the class`).toBeLessThan(0.40);
    }
  });

  it('hides its gems on the boards a small program can actually shop', () => {
    // Measured: 30.2% of three-star recruits carry twenty or more points of
    // room, against 1.8% of five-stars. "Stars still buy certainty; gems are
    // what scouting buys" — enforced by arithmetic rather than asserted.
    const bigRoom = (s: number) => {
      const set = potentials.filter((r) => r.stars === s);
      return set.filter((r) => gapOf(r) > 20).length / Math.max(1, set.length);
    };
    expect(bigRoom(3)).toBeGreaterThan(0.20);
    expect(bigRoom(5)).toBeLessThan(0.06);
    expect(bigRoom(3)).toBeGreaterThan(bigRoom(5) * 4);
  });

  it('sells some of its best recruits as elite and delivers a finished man', () => {
    /*
      Reported: *"not all 5 star recruits are supposed to be high potential,
      there should be some that could be 5 star recruits but still be D. Just
      like in real life there are players projected to be 1 pick overall and
      end up not paying out and never developing."*

      A literal five-star with a D ceiling cannot exist — he averages 68
      overall and a ceiling below current ability is not a ceiling — so what is
      asserted is the faithful version: sold as elite, and already finished.
      2.2% before the bust lobe, 10.6% after.
    */
    const five = potentials.filter((r) => r.stars === 5);
    expect(five.length).toBeGreaterThan(200);
    const finished = five.filter((r) => gapOf(r) <= 2).length / five.length;
    expect(finished, `${(100 * finished).toFixed(1)}% of five-stars were finished`)
      .toBeGreaterThan(0.06);
    expect(finished).toBeLessThan(0.20);
    // And the ladder still slopes: a one-star is likelier to be finished than
    // a five-star, or the bust lobe has eaten the thing it was meant to spice.
    const shareAt = (s: number) => {
      const set = potentials.filter((r) => r.stars === s);
      return set.filter((r) => gapOf(r) <= 2).length / Math.max(1, set.length);
    };
    expect(shareAt(1)).toBeGreaterThan(shareAt(5));
  });

  it('keeps the best grade in the game rare', () => {
    /*
      Reported: *"About S, it should be rare, I've noticed it appears a lot, I
      was expecting like 5 to 10 per class and 10 being too many."* It was
      12.4 a national class; it is 5.5.

      The cause was never the threshold. `GENERATED_POTENTIAL_CAP` was a wall,
      and a distribution reaching past 110 folded flat onto one number put 9.9
      men a class at exactly 94 — three quarters of every S. Truncation is what
      makes a top dense.
    */
    const classes = 6;
    const S = potentials.filter((r) => r.pot >= 92).length / classes;
    expect(S, `${S.toFixed(1)} S-grade men a class`).toBeGreaterThan(3);
    expect(S, `${S.toFixed(1)} S-grade men a class`).toBeLessThan(9);
    // The wall is gone, which is the part a threshold could never have fixed.
    const atCap = potentials.filter((r) => r.pot === 94).length / classes;
    expect(atCap, `${atCap.toFixed(1)} men a class pinned at the cap`).toBeLessThan(1.5);
  });

  it('lets a raw man carry the best ceiling in the country', () => {
    /*
      Reported: *"those S potential do not have to be 5 star recruits, it could
      even be a 25 ovr 1 star that becomes a superstar."* Before this, not one
      man under 55 overall and not a single one-star in ten classes carried an
      S ceiling — the top of the board was the only place it lived.
    */
    const S = potentials.filter((r) => r.pot >= 92);
    expect(S.length).toBeGreaterThan(10);
    // Most of them are projects, not finished articles.
    const raw = S.filter((r) => r.ovr < 55).length / S.length;
    expect(raw, `only ${(100 * raw).toFixed(0)}% of S men are raw`).toBeGreaterThan(0.5);
    // And the floor reaches a long way down.
    expect(Math.min(...S.map((r) => r.ovr))).toBeLessThan(45);
    // A five-star does not own the grade.
    expect(S.filter((r) => r.stars === 5).length / S.length).toBeLessThan(0.4);
  });

  it('keeps the ceiling a forecast rather than a restatement of ability', () => {
    // r was 0.751 and is 0.636. It must not return to being a relabelling of
    // current overall, and it must not decouple entirely either — a five-star
    // who might be anything is a different game, and not the one on offer.
    const xs = potentials.map((r) => r.ovr);
    const ys = potentials.map((r) => r.pot);
    const mx = mean(xs);
    const my = mean(ys);
    const cov = mean(xs.map((x, i) => (x - mx) * (ys[i]! - my)));
    const sx = Math.sqrt(mean(xs.map((x) => (x - mx) ** 2)));
    const sy = Math.sqrt(mean(ys.map((y) => (y - my) ** 2)));
    const r = cov / (sx * sy);
    expect(r).toBeLessThan(0.70);
    expect(r).toBeGreaterThan(0.50);
  });
});
