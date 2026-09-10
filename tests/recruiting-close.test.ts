// recruiting-close.test.ts
// How a recruit decides, and how a coach closes.
//
// Reported 2026-09-10: "there are recruits who simply take too long to decide
// or never do, there are not enough instant commits, chasing a high profile
// recruit is a nightmare." Decision styles, a readiness clock, the ask, and a
// chase that tightens as the window runs.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateClass, closeWeek, aiTargets, chaseCut, decisionStyle, commitPriceFor,
  commitPointsFor, askBlocked, askForCommitment, LATE_DECIDER_WEEK, ASK_COOLDOWN,
  RECRUITING_FACTORS, recruitingPrioritiesOf,
  type Pitch, type Prospect, type RecruitClass, type DecisionStyle,
} from '../src/engine/recruiting.js';
import { makeRng } from '../src/engine/rng.js';
import { resetNames } from '../src/engine/players.js';

beforeEach(resetNames);

/** A program described purely by the pitch it can make. */
function program(prestige: number, opts: Partial<Pitch> = {}): Pitch {
  return {
    prestige,
    stars: prestige >= 0.72 ? 5 : prestige >= 0.6 ? 4 : prestige >= 0.48 ? 3
      : prestige >= 0.38 ? 2 : 1,
    playingTime: () => 0.5,
    winning: 0.5,
    region: 'Gulf',
    state: 'LA',
    development: 0.5,
    ...opts,
  };
}

const classOf = (seed: number, teams = 96): RecruitClass => generateClass(2027, teams, makeRng(seed));
const find = (recruits: RecruitClass, style: DecisionStyle): Prospect =>
  recruits.prospects.find((p) => decisionStyle(p) === style && p.stars === 3)!;

describe('how a recruit decides', () => {
  it('spreads decision styles across the class, early ones toward the top', () => {
    const recruits = classOf(31);
    const n = recruits.prospects.length;
    const early = recruits.prospects.filter((p) => decisionStyle(p) === 'early').length / n;
    const late = recruits.prospects.filter((p) => decisionStyle(p) === 'late').length / n;
    expect(early).toBeGreaterThan(0.15);
    expect(early).toBeLessThan(0.35);
    expect(late).toBeGreaterThan(0.1);
    expect(late).toBeLessThan(0.22);
    const top = recruits.prospects.filter((p) => p.rank <= 60);
    expect(top.filter((p) => decisionStyle(p) === 'early').length / top.length).toBeGreaterThan(early);
    // Derived, so the same man reads the same way twice.
    for (const p of recruits.prospects.slice(0, 50)) expect(decisionStyle(p)).toBe(decisionStyle(p));
  });

  it('lets a settled man wait three weeks at most', () => {
    const recruits = classOf(47);
    const man = find(recruits, 'steady');
    const price = commitPriceFor(man);
    man.points = { 0: price * 1.6, 1: price * 0.4 };
    const rng = makeRng(7);
    let signedAt: number | null = null;
    for (let w = 1; w <= 4 && signedAt === null; w++) {
      recruits.week = w;
      for (const c of closeWeek(recruits, rng)) if (c.prospect === man) signedAt = w;
    }
    expect(signedAt).not.toBeNull();
    expect(signedAt!).toBeLessThanOrEqual(3);
    expect(man.signedBy).toBe(0);
  });

  it('takes an early decider on less, and at once', () => {
    const recruits = classOf(47);
    const man = find(recruits, 'early');
    expect(commitPriceFor(man)).toBeLessThan(commitPointsFor(man.stars));
    man.points = { 0: commitPriceFor(man) * 1.1, 1: 0 };
    recruits.week = 2;
    const commits = closeWeek(recruits, makeRng(1));
    expect(commits.some((c) => c.prospect === man)).toBe(true);
  });

  it('holds a man who waits for the season until it has started', () => {
    const recruits = classOf(47);
    const man = find(recruits, 'late');
    man.points = { 0: commitPriceFor(man) * 3, 1: 0 };
    const rng = makeRng(3);
    for (let w = 1; w < LATE_DECIDER_WEEK; w++) {
      recruits.week = w;
      closeWeek(recruits, rng);
      expect(man.signedBy, `committed in week ${w}`).toBeNull();
    }
    for (let w = LATE_DECIDER_WEEK; w <= LATE_DECIDER_WEEK + 2 && man.signedBy === null; w++) {
      recruits.week = w;
      closeWeek(recruits, rng);
    }
    expect(man.signedBy).toBe(0);
  });

  it('signs a yes at the week close, whatever the margin', () => {
    const recruits = classOf(47);
    const man = find(recruits, 'steady');
    man.points = { 0: 10, 1: 9.5 };
    recruits.week = 4;
    man.askedBy = { 0: { week: 4, success: true } };
    const commits = closeWeek(recruits, makeRng(9));
    expect(commits.find((c) => c.prospect === man)?.team).toBe(0);
    expect(man.committedWeek).toBe(4);
  });
});

describe('asking him to commit', () => {
  const pitch = program(0.6, { state: 'LA' });

  it('is shut until the relationship, the price and the lead are there', () => {
    const recruits = classOf(31);
    const man = find(recruits, 'steady');
    expect(askBlocked(man, 0, 1)).toMatch(/week of interest/);
    man.points = { 0: 1 };
    expect(askBlocked(man, 0, 1)).toMatch(/week of interest/);
    expect(askBlocked(man, 0, 2)).toMatch(/more interest/);
    man.points = { 0: commitPriceFor(man) + 1, 1: commitPriceFor(man) + 5 };
    expect(askBlocked(man, 0, 2)).toMatch(/ahead of you/);
    man.points[1] = 0;
    expect(askBlocked(man, 0, 2)).toBeNull();
    expect(askBlocked(man, 0, 2, true)).toMatch(/scholarship/);
    man.askedBy = { 0: { week: 2, success: false } };
    expect(askBlocked(man, 0, 3)).toMatch(/said no/);
    expect(askBlocked(man, 0, 2 + ASK_COOLDOWN)).toBeNull();
  });

  it('answers the same way twice, and says yes to a coach who leads by a distance', () => {
    const recruits = classOf(31);
    let yes = 0;
    let asked = 0;
    for (const man of recruits.prospects.slice(0, 40)) {
      man.points = { 0: commitPriceFor(man) * 2, 1: commitPriceFor(man) * 0.2 };
      const a = askForCommitment(man, 0, pitch, 2027, 3);
      expect(askForCommitment(man, 0, pitch, 2027, 3)).toEqual(a);
      asked += 1;
      if (a.success) { yes += 1; continue; }
      // A no names a want he holds, not a random factor.
      const pr = recruitingPrioritiesOf(man);
      const wants = [...RECRUITING_FACTORS].sort((x, y) => pr[y] - pr[x]).slice(0, 3);
      expect(a.doubt !== undefined && wants.includes(a.doubt)).toBe(true);
    }
    expect(yes / asked).toBeGreaterThan(0.6);
  });

  it('is a coin at a narrow lead and a thin fit', () => {
    const recruits = classOf(31);
    const weak = program(0.4, { state: 'WY', region: 'Mountain' });
    let yes = 0;
    let asked = 0;
    for (const man of recruits.prospects.slice(0, 60)) {
      const price = commitPriceFor(man);
      man.points = { 0: price + 0.5, 1: price * 0.9 };
      asked += 1;
      if (askForCommitment(man, 0, weak, 2027, 5).success) yes += 1;
    }
    expect(yes / asked).toBeLessThan(0.75);
    expect(yes / asked).toBeGreaterThan(0.1);
  });
});

describe('the chase', () => {
  it('tightens as the window runs', () => {
    expect(chaseCut(1)).toBe(0.4);
    expect(chaseCut(4)).toBeLessThan(chaseCut(3));
    expect(chaseCut(6)).toBeLessThan(chaseCut(5));
    expect(chaseCut(9)).toBeLessThan(chaseCut(8));
    expect(chaseCut(12)).toBe(0.15);
  });

  it('drops a rival thirty percent back by week nine', () => {
    const recruits = classOf(31);
    const pitch = program(0.6);
    const man = recruits.prospects.find((p) => p.stars <= 3)!;
    man.points = { 0: 7, 1: 10 };
    const at = { [man.id]: 10 };
    const late = aiTargets(0, pitch, 45, recruits.prospects, 8, makeRng(1), at, 0, 9);
    expect(late.some((t) => t.prospect === man)).toBe(false);
  });
});
