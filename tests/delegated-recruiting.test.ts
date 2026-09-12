// delegated-recruiting.test.ts
// Handing the recruiting board to your coordinator.
//
// Asked for 2026-09-12, last of a list of twenty-six: "we should also add
// automated or delegated recruiting as an option." The brief for how it should
// feel came back when I asked: **"a bit worse than a user would do it plus
// depending on their stats they get a bit better."**
//
// The row for it had existed on the settings sheet since the depth model went
// in, reading "Your coordinator works the board", and it reached **nothing** —
// `handles` was never once asked about `recruiting`. So a coach who turned it
// off did not delegate his recruiting, he lost it: his board was read for
// whatever he had already put on it, which after a week of not touching it was
// nothing at all. That is the failure this file exists to catch, and it is why
// the first test here asserts that a delegated week *moves* something. A
// delegated system that silently does nothing looks exactly like a delegated
// system that is working, right up until signing day.

import { describe, it, expect } from 'vitest';
import {
  delegateEffort, DELEGATE_FLOOR, DELEGATE_CEILING, DELEGATE_TOP_CRAFT,
} from '../src/engine/recruitingPlan.js';
import { aiTargets, weeklyBudget } from '../src/engine/recruiting.js';
import { createSeason } from '../src/engine/season.js';
import { pitchFor, developmentScore } from '../src/engine/pitch.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';

/**
 * How many roster holes the programme is recruiting to fill.
 *
 * A number, not a list: `aiTargets` takes a count, and the store computes it
 * with a *local* helper of its own rather than `progression`'s same-named
 * export. Fixed here so the two weeks being compared differ in exactly one
 * thing, which is the only reason this file exists.
 */
const NEED = 8;
import { handles, type DepthSettings } from '../src/state/depth.js';
import type { Assistant, Economy } from '../src/engine/economy.js';

/** A coordinator of a given rating and shape, with nothing else filled in. */
const coordinator = (rating: number, winter: number): Assistant => ({
  id: `co-${rating}-${winter}`, name: 'A Coordinator', age: 44,
  rating, winter, wage: 100, seat: 'recruiting',
});

const economyWith = (a?: Assistant): Economy =>
  ({ staff: a ? { recruiting: a } : {} } as unknown as Economy);

describe('how much of a week a delegated staff gets through', () => {
  it('never gets through all of it, however good he is', () => {
    /*
      The first half of the brief, and the half that keeps the feature from
      being a button that strictly dominates playing the game. An elite
      coordinator, an absurd one, and one better than the scale allows all stop
      at the ceiling.
    */
    for (const rating of [60, 88, 500]) {
      const eff = delegateEffort(economyWith(coordinator(rating, 0)));
      expect(eff, `rating ${rating}`).toBeLessThanOrEqual(DELEGATE_CEILING);
      expect(eff, `rating ${rating}`).toBeLessThan(1);
    }
  });

  it('gets through least with nobody in the chair', () => {
    // An unseated staff, and a save from before the staff screen existed, are
    // the same case and both land on the floor rather than throwing.
    expect(delegateEffort(economyWith())).toBeCloseTo(DELEGATE_FLOOR, 6);
    expect(delegateEffort(undefined)).toBeCloseTo(DELEGATE_FLOOR, 6);
  });

  it('gets better as the man gets better, which is the other half of the brief', () => {
    const ladder = [0, 20, 40, 60, 88].map((r) =>
      delegateEffort(economyWith(coordinator(r, 0))));
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]!, `rating step ${i}`).toBeGreaterThanOrEqual(ladder[i - 1]!);
    }
    // And the ends are genuinely far apart — a scale nobody can feel is a
    // scale that may as well be a constant.
    expect(ladder.at(-1)! - ladder[0]!).toBeGreaterThan(0.15);
  });

  it('reads the board half of his craft, not his rating', () => {
    /*
      The decision the staff screen already exists to pose, made to matter
      here. Two men of the SAME rating: one who spends everything on winter
      relationships and one who spends it all on working a board. The network
      builder brings you a state — `coordinatorFamiliarity` is his — and he is
      deliberately poor at this.
    */
    const networkBuilder = delegateEffort(economyWith(coordinator(80, 0.9)));
    const boardWorker = delegateEffort(economyWith(coordinator(80, 0.0)));
    expect(boardWorker).toBeGreaterThan(networkBuilder);
    // The specialist at the top of the craft scale is at the ceiling.
    expect(boardWorker).toBeCloseTo(DELEGATE_CEILING, 6);
    // And a full-rating network builder is still only a little off the floor.
    expect(networkBuilder).toBeLessThan(DELEGATE_FLOOR + 0.06);
  });

  it('puts the top of the scale where a real coordinator can reach it', () => {
    // 60 board-craft is a rating in the seventies spent mostly on the board,
    // which the hiring screen actually produces. A ceiling nobody can reach is
    // a ceiling that does not exist.
    expect(DELEGATE_TOP_CRAFT).toBeLessThan(88);
    expect(delegateEffort(economyWith(coordinator(DELEGATE_TOP_CRAFT, 0))))
      .toBeCloseTo(DELEGATE_CEILING, 6);
  });
});

describe('the switch the feature hangs on', () => {
  it('is off for a casual career and on for a full one', () => {
    const casual: DepthSettings = { mode: 'casual', overrides: {} };
    const full: DepthSettings = { mode: 'full', overrides: {} };
    // A casual coach still works his own board — the row's `casual: true` — so
    // delegating is a thing you choose, not a thing a preset does to you.
    expect(handles(casual, 'recruiting')).toBe(true);
    expect(handles(full, 'recruiting')).toBe(true);
    // And the override is what actually turns it over.
    expect(handles({ mode: 'full', overrides: { recruiting: false } }, 'recruiting'))
      .toBe(false);
  });
});

describe('a delegated week actually works the board', () => {
  /**
   * One programme's week, as the store runs it for a rival — which is exactly
   * what a delegated coach now gets.
   */
  const weekFor = (effort: number) => {
    const season = createSeason(makeRng(7), undefined, CONFERENCES);
    const record = season.teams[0]!;
    const pitch = pitchFor(season, record, 'Gulf', developmentScore(record));
    const spends = aiTargets(
      record.index, pitch, 45, season.recruiting.prospects,
      NEED, makeRng(99), {}, 0, 1, effort,
    );
    return {
      targets: spends.length,
      points: spends.reduce((sum, s) => sum + s.actions, 0),
    };
  };

  it('spends a real week rather than nothing', () => {
    /*
      THE assertion in this file. The bug being fixed is not "delegation is
      badly balanced", it is "delegation silently did nothing", and a zero here
      is indistinguishable on screen from a quiet week.
    */
    const delegated = weekFor(delegateEffort(economyWith(coordinator(50, 0.2))));
    expect(delegated.targets).toBeGreaterThan(3);
    expect(delegated.points).toBeGreaterThan(0);
  });

  it('spends less of it than the coach would have', () => {
    const byHand = weekFor(1);
    const floor = weekFor(DELEGATE_FLOOR);
    const ceiling = weekFor(DELEGATE_CEILING);
    expect(floor.points).toBeLessThan(byHand.points);
    expect(ceiling.points).toBeLessThan(byHand.points);
    // Better coordinator, more of the week worked.
    expect(ceiling.points).toBeGreaterThan(floor.points);
  });

  it('is thinner, not stupider — it still works a full board', () => {
    /*
      The design the handicap was chosen for, asserted so a future "make it
      worse" cannot quietly reach for the wrong lever. A staff that stopped
      *covering* the class would leave scholarships unfilled and walk-ons in
      the gaps, which is not "a bit worse", it is broken. So the delegated week
      chases the same number of men on the same board; it just funds them less.
    */
    const byHand = weekFor(1);
    const floor = weekFor(DELEGATE_FLOOR);
    expect(floor.targets).toBe(byHand.targets);
  });

  it('leaves every rival untouched, which is what the default is for', () => {
    // `effort` defaults to 1, so the ninety five are byte-identical to the
    // week they had before delegation existed. Nothing else in this change is
    // allowed to move their world.
    const season = createSeason(makeRng(7), undefined, CONFERENCES);
    const record = season.teams[0]!;
    const pitch = pitchFor(season, record, 'Gulf', developmentScore(record));
    const argsFor = () => [
      record.index, pitch, 45, season.recruiting.prospects,
      NEED, makeRng(99), {}, 0, 1,
    ] as const;
    // A fresh `makeRng` per call: the generator is consumed by the scoring
    // pass, so sharing one would compare two different draws and pass or fail
    // for a reason that has nothing to do with `effort`.
    const withDefault = aiTargets(...argsFor());
    const withExplicitOne = aiTargets(...argsFor(), 1);
    expect(withExplicitOne.map((s) => s.actions))
      .toEqual(withDefault.map((s) => s.actions));
  });

  it('never asks for a week the budget cannot pay for', () => {
    // The scaled cap the store hands `planAiRecruitActions` must stay a real
    // number of points at every rung, including the smallest programme.
    for (const stars of [1, 2, 3, 4, 5]) {
      for (const effort of [DELEGATE_FLOOR, DELEGATE_CEILING, 1]) {
        const cap = Math.max(1, Math.round(weeklyBudget(stars, 0) * effort));
        expect(cap, `${stars} star at ${effort}`).toBeGreaterThanOrEqual(1);
        expect(cap).toBeLessThanOrEqual(weeklyBudget(stars, 0));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The defect the unit tests above could not see
// ---------------------------------------------------------------------------
//
// Everything above passed, and the feature was still broken. Found by playing
// it: a delegated one-star programme finished a window with **three** signed
// men while the thirty three rivals within four quality points of it averaged
// **6.85**, range three to eight. "A bit worse" is not half a class.
//
// The handicap was not the cause. `seedRivalInterest` runs two passes over the
// class before week one and every rival gets them; the coached programme is
// skipped, correctly, because a human coach's board is his to build. But
// `aiTargets` is written for a staff that HAS been seeded — its lost-causes
// filter walks away from anyone another programme already leads — so a staff
// opening on an empty board walks away from nearly everybody and never starts.
// The two rules are a pair and the delegate had been given one of them.
//
// These tests are the guard on the pair, and they are the reason this file is
// not just a table of constants: a handicap you can read off a curve is easy to
// assert and was never the part that was wrong.

describe('a delegated board opens the way its rivals do', () => {
  it('is seeded when the coordinator has it, and not when the coach does', async () => {
    const { seedRivalInterest } = await import('../src/state/store.js');
    const { createSeason } = await import('../src/engine/season.js');
    const me = 0;

    const seeded = (alsoSeedUser: boolean): number => {
      const season = createSeason(makeRng(31), undefined, CONFERENCES);
      seedRivalInterest(season, me, alsoSeedUser);
      return season.recruiting.prospects
        .filter((p) => (p.points[me] ?? 0) > 0).length;
    };

    // A coach working his own board starts from nothing, which is the game.
    expect(seeded(false)).toBe(0);
    // His coordinator starts where every other staff in the country starts.
    expect(seeded(true)).toBeGreaterThan(10);
  });

  it('signs a class its peers would recognise', async () => {
    /*
      The end-to-end assertion, and the one that fails on the original bug.

      **Team 95, the weakest programme in the world, and the choice is the
      whole test.** Run on team 0 — a 66 quality programme — the bug is nearly
      invisible: it signs 6 against a peer average of 8, because an elite
      programme may chase most of the class and takes a lead from a cold start
      anyway. The collapse belongs to the bottom of the league, where the pool
      `canPursue` leaves is thin and an unseeded board is crowded out of all of
      it. Measured both ways at quality 24:

        unseeded (the bug)  signed 2, peers averaged 4.85   → 0.41x
        seeded (the fix)    signed 5, peers averaged 5.15   → 0.97x

      A test written against the comfortable case would have passed on the bug,
      which is exactly what the unit tests above did.

      Twelve weeks driven through the store the way the calendar drives them,
      then the class measured against every rival within six quality points.
      The floor is 0.6 of the peer average: clear of the bug at 0.41 and clear
      of the fix at 0.97, so it catches a collapse without pinning a number
      that one noisy seed cannot support.
    */
    const { useDynasty } = await import('../src/state/store.js');
    const { RECRUITING_WEEKS } = await import('../src/engine/recruiting.js');
    const me = 95;

    useDynasty.getState().start(4242, me);
    // After `start`, which installs `{ mode, overrides: {} }` of its own.
    useDynasty.setState({ depth: { mode: 'casual', overrides: { recruiting: false } } });

    const season = useDynasty.getState().season!;
    // The window as the year roll would have opened it for a delegated coach.
    const { seedRivalInterest } = await import('../src/state/store.js');
    season.recruiting.week = 0;
    for (const p of season.recruiting.prospects) p.points = {};
    seedRivalInterest(season, me, true);
    season.recruiting.week = 1;

    for (let w = 0; w < RECRUITING_WEEKS; w++) {
      useDynasty.getState().advanceRecruitingWeek();
    }

    const done = useDynasty.getState().season!;
    const signed = new Map<number, number>();
    for (const p of done.recruiting.prospects) {
      if (p.signedBy === null) continue;
      signed.set(p.signedBy, (signed.get(p.signedBy) ?? 0) + 1);
    }

    const quality = (i: number): number => done.teams[i]!.team.quality;
    const mineQ = quality(me);
    const peers = done.teams
      .filter((t) => t.index !== me && Math.abs(quality(t.index) - mineQ) <= 6)
      .map((t) => signed.get(t.index) ?? 0);
    const mine = signed.get(me) ?? 0;
    const peerAvg = peers.reduce((a, b) => a + b, 0) / Math.max(1, peers.length);

    // The harness has to have run at all before its verdict means anything.
    expect(peers.length, 'peers found').toBeGreaterThan(5);
    expect(peerAvg, 'peer average class').toBeGreaterThan(3);

    expect(
      mine,
      `delegated signed ${mine}, peers averaged ${peerAvg.toFixed(2)}`,
    ).toBeGreaterThan(peerAvg * 0.6);
  });
});
