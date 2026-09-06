import { describe, expect, it } from 'vitest';
import {
  actionInterest, budgetFor, flexibleOffseasonBudget, generateClass,
  hasRecruitingRelationship, PITCH_COST, protectedRecruitingBudget,
  recruitingPrioritiesOf, recruitingWindowBudget, resetWeeklySpend,
  weeklyBudget, weekActionCost, weeklyPoints, windowBudget, RECRUITING_FACTORS,
  type Pitch,
} from '../src/engine/recruiting.js';
import {
  explicitRecruitPromiseBroken, expectationOf, promiseHorizon, promiseSpent,
} from '../src/engine/morale.js';
import { reasonFor } from '../src/engine/portal.js';
import { makeRng } from '../src/engine/rng.js';
import type { Player } from '../src/engine/types.js';

const pitch = (overrides: Partial<Pitch> = {}): Pitch => ({
  prestige: 0.45,
  stars: 2,
  playingTime: () => 0.75,
  winning: 0.55,
  region: 'Gulf',
  state: 'LA',
  development: 0.65,
  coachReputation: 0.62,
  conferencePrestige: 0.58,
  facilities: 0.7,
  proPipeline: 0.5,
  ...overrides,
});

describe('the protected offseason recruiting budget', () => {
  it('gives Draft + Portal forty percent of the offseason pool', () => {
    expect(flexibleOffseasonBudget(1)).toBe(67);
    expect(protectedRecruitingBudget(1)).toBe(101);
    expect(flexibleOffseasonBudget(5)).toBe(91);
    expect(protectedRecruitingBudget(5)).toBe(137);
  });

  it('preserves the old ceiling while protecting a freshman-class floor', () => {
    for (let stars = 1; stars <= 5; stars++) {
      expect(flexibleOffseasonBudget(stars) + protectedRecruitingBudget(stars))
        .toBe(windowBudget(stars));
      expect(recruitingWindowBudget(stars, 0)).toBe(windowBudget(stars));
      expect(weeklyBudget(stars, 0)).toBe(budgetFor(stars));
      expect(recruitingWindowBudget(stars, flexibleOffseasonBudget(stars)))
        .toBe(protectedRecruitingBudget(stars));
    }
  });
});

describe('recruiting actions', () => {
  it('charges pitches out of the same weekly budget as raw effort', () => {
    const cls = generateClass(2027, 8, makeRng(91));
    const p = cls.prospects[0]!;
    (p.weekActions ??= {})[0] = { pitch: 'playingTime' };
    expect(weekActionCost(p, 0)).toBe(PITCH_COST);
  });

  it('requires an existing relationship before the major-move phase', () => {
    const p = generateClass(2027, 8, makeRng(92)).prospects[0]!;
    expect(hasRecruitingRelationship(p, 0)).toBe(false);
    p.points[0] = 0.1;
    expect(hasRecruitingRelationship(p, 0)).toBe(true);
  });

  it('makes an honest pitch worth more when it matches what the recruit values', () => {
    const p = generateClass(2027, 8, makeRng(93)).prospects[0]!;
    const priorities = recruitingPrioritiesOf(p);
    for (const key of Object.keys(priorities) as Array<keyof typeof priorities>) priorities[key] = 0;
    priorities.playingTime = 1;
    p.recruitingPriorities = priorities;
    p.weekActions = { 0: { pitch: 'playingTime' } };
    const strong = actionInterest(p, pitch({ playingTime: () => 0.95 }), 0);
    const weak = actionInterest(p, pitch({ playingTime: () => 0.1 }), 0);
    expect(strong).toBeGreaterThan(weak);
  });

  it('clears weekly actions but keeps a promise that has already been put on file', () => {
    const cls = generateClass(2027, 8, makeRng(94));
    const p = cls.prospects[0]!;
    p.weekActions = { 0: { pitch: 'coach', major: { kind: 'promise', promise: 'noRedshirt' } } };
    p.promiseBy = { 0: 'noRedshirt' };
    resetWeeklySpend(cls);
    expect(p.weekActions?.[0]).toBeUndefined();
    expect(p.promiseBy?.[0]).toBe('noRedshirt');
  });
});

describe('promises have consequences after signing day', () => {
  it('turns an immediate-role promise into a real playing-time expectation', () => {
    const p = generateClass(2027, 8, makeRng(95)).prospects[0]!.player;
    p.recruitPromise = { kind: 'immediateRole', madeYear: 2027 };
    expect(expectationOf(p, 20)).toBeGreaterThanOrEqual(0.62);
  });

  it('detects a broken keep-position promise and explains a portal exit in those terms', () => {
    const p = generateClass(2027, 8, makeRng(96)).prospects
      .map((x) => x.player)
      .find((x): x is Player => 'pos' in x)!;
    const promised = p.pos;
    p.recruitPromise = { kind: 'keepPosition', madeYear: 2027, promisedPos: promised };
    p.pos = promised === 'SS' ? '2B' : 'SS';
    expect(explicitRecruitPromiseBroken(p)).toBe(true);
    expect(reasonFor(p, { squadRank: 20, starts: 45, games: 45 }))
      .toBe('He was promised he could stay at his position.');
  });
});

describe('what the merge review changed', () => {
  it('prices an action at least as well as raw effort, and better when it names what he wants', () => {
    // The first cut paid a flat bonus per action — a visit bought a third of
    // what the same eight points bought as raw effort — so every action was a
    // worse use of the budget and the AI, made to reserve a fifth of its week
    // for them, was handicapped. Priced per point now, against the raw rate.
    const p = generateClass(2027, 8, makeRng(97)).prospects[0]!;
    const w = recruitingPrioritiesOf(p);
    const ranked = [...RECRUITING_FACTORS].sort((a, b) => w[b] - w[a]);
    const top = ranked[0]!;
    const bottom = ranked[ranked.length - 1]!;
    const raw = weeklyPoints(p, pitch(), PITCH_COST, 45, 20);
    p.weekActions = { 0: { pitch: top } };
    const named = actionInterest(p, pitch(), 0);
    p.weekActions = { 0: { pitch: bottom } };
    const ignored = actionInterest(p, pitch(), 0);
    expect(named).toBeGreaterThan(raw);
    expect(named).toBeGreaterThan(ignored);
    // Even the wrong pitch is not a write-off: it is a conversation.
    expect(ignored).toBeGreaterThan(raw * 0.25);
  });

  it('takes a promise off a man once every season it covered has been judged', () => {
    // A first-year word is not held against a junior. The roll judges it
    // once (twice for keeping a position), the portal that follows still
    // sees it, and the next roll takes it off before judging anything.
    expect(promiseHorizon('immediateRole')).toBe(1);
    expect(promiseHorizon('noRedshirt')).toBe(1);
    expect(promiseHorizon('twoWayOpportunity')).toBe(1);
    expect(promiseHorizon('keepPosition')).toBe(2);
    expect(promiseSpent(undefined)).toBe(false);
    expect(promiseSpent({ kind: 'noRedshirt', madeYear: 0 })).toBe(false);
    expect(promiseSpent({ kind: 'noRedshirt', madeYear: 0, judged: 1 })).toBe(true);
    expect(promiseSpent({ kind: 'keepPosition', madeYear: 0, judged: 1 })).toBe(false);
    expect(promiseSpent({ kind: 'keepPosition', madeYear: 0, judged: 2 })).toBe(true);
  });

  it('derives the nine factors from the five on every read, so a changed mind is seen', () => {
    // The pass cached the nine at generation, so anything that later moved the
    // five — the old tests do, and so would any future system — was invisible
    // to fit. Only a sway writes the cache now.
    const p = generateClass(2027, 8, makeRng(98)).prospects[0]!;
    expect(p.recruitingPriorities).toBeUndefined();
    p.priorities = { prestige: 1, playingTime: 0, winning: 0, proximity: 0, development: 0 };
    const a = recruitingPrioritiesOf(p);
    p.priorities = { prestige: 0, playingTime: 1, winning: 0, proximity: 0, development: 0 };
    const b = recruitingPrioritiesOf(p);
    expect(a.tradition).toBeGreaterThan(b.tradition);
    expect(b.playingTime).toBeGreaterThan(a.playingTime);
  });
});
