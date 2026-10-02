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
import { readFileSync } from 'node:fs';
import { TUTORIALS } from '../src/ui/tutorials.js';
import {
  delegateEffort, DELEGATE_FLOOR, DELEGATE_CEILING, DELEGATE_TOP_CRAFT,
  programRecruitingPitch, recruitingPlan,
} from '../src/engine/recruitingPlan.js';
import {
  aiTargets, weeklyBudget, totalWeekSpend, pursuable, lostCause, canPursue,
  commitPriceFor, decisionStyle, closeWeek, setStarGateOpen, ASK_COST, MAX_PER_RECRUIT,
  type DecisionStyle, type Pitch, type Prospect, type RecruitClass,
} from '../src/engine/recruiting.js';
import {
  planStaffWeek, clearStaffWeek, staffAskDue, tendStaffList, suggestStaffList, staffWeekRng, samePosition, sameGroup,
  STAFF_LIST_MAX, STAFF_ORDER_SHARE, STAFF_RAW_SHARE, type StaffWeek,
} from '../src/engine/staffRecruiting.js';
import { freshEconomy, pipelineStrength, withStaff } from '../src/engine/economy.js';
import { prestigeStars } from '../src/engine/program.js';
import { createSeason, type SeasonState } from '../src/engine/season.js';
import { pitchFor, developmentScore } from '../src/engine/pitch.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES, type Region } from '../src/data/schools.js';
import type { PlayerId } from '../src/engine/types.js';
import { staffLine } from '../src/ui/screens/recruitRace.js';
import { seedRivalInterest } from '../src/state/store.js';

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
//
// 2026-09-30: the store no longer seeds the coached program, staff or not. The
// staff works only the coach's list ("the plan was for the player to create
// its own list"), and a starred man it has banked nothing on is worked whoever
// leads him, so the pair no longer applies to it. Seeding put interest on men
// the coach never chose, which read on the board as the staff picking for him.
// The option stays on `seedRivalInterest`; the end-to-end guard is now the
// list's own, below.

describe('a delegated board opens the way its rivals do', () => {
  it('is seeded when the coordinator has it, and not when the coach does', async () => {
    const { seedRivalInterest } = await import('../src/state/store.js');
    const { createSeason } = await import('../src/engine/season.js');
    const me = 0;

    const seeded = (alsoSeedUser: boolean): { mine: number; rivals: number[] } => {
      const season = createSeason(makeRng(31), undefined, CONFERENCES);
      seedRivalInterest(season, me, alsoSeedUser);
      const count = (team: number): number => season.recruiting.prospects
        .filter((p) => (p.points[team] ?? 0) > 0).length;
      return { mine: count(me), rivals: season.teams.filter((t) => t.index !== me).map((t) => count(t.index)) };
    };

    // A coach working his own board starts from nothing, which is the game.
    expect(seeded(false).mine).toBe(0);
    // His coordinator starts where every other staff in the country starts —
    // measured against them rather than against a number, because how many
    // names a staff opens on depends on the holes it has, and a roster the
    // generator ages into its classes has fewer of them.
    const { mine, rivals } = seeded(true);
    const sorted = [...rivals].sort((a, b) => a - b);
    expect(mine).toBeGreaterThan(0);
    expect(mine).toBeGreaterThanOrEqual(sorted[Math.floor(sorted.length * 0.1)]!);
  });

  it('is never seeded by the store, and an empty list spends nothing all window', async () => {
    /*
      2026-09-30, the user: "it is still picking the recruits automatically for
      me instead of letting me select the list at the planning stage". Two
      things did: the store seeded the staff's board the way it seeds a
      rival's, and the staff filled every open slot with picks of its own.
      Twelve weeks through the store with nobody starred: not a point, not a
      move, not a signing. Team 95 and seed 4242, the career the e2e tests use.
    */
    const { useDynasty } = await import('../src/state/store.js');
    const { RECRUITING_WEEKS } = await import('../src/engine/recruiting.js');
    const me = 95;
    await staffCareer(4242, me);
    const season = useDynasty.getState().season!;
    expect(season.recruiting.staffList ?? []).toHaveLength(0);
    const touched = (): number => season.recruiting.prospects
      .filter((p) => (p.points[me] ?? 0) > 0 || (p.spent[me] ?? 0) > 0 || p.weekActions?.[me]).length;
    expect(touched(), 'day one').toBe(0);
    for (let w = 0; w < RECRUITING_WEEKS; w++) {
      useDynasty.getState().advanceRecruitingWeek();
      expect(touched(), `after week ${w + 1}`).toBe(0);
    }
    expect(useDynasty.getState().season!.recruiting.prospects.filter((p) => p.signedBy === me)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// The staff works the coach's list (2026-09-28)
// ---------------------------------------------------------------------------
//
// Asked for as a career rule: a coach who hands weekly recruiting to his staff
// still decides who. He stars up to eight recruits; the staff works them in his
// order, and since 2026-09-30 nobody else. The staff's week lives on the board now,
// planned at the week's open on a generator of its own, and three bugs went
// with the change: no seeding on a mid-season switch, a points band blind to
// the staff's spending, and a staff whose reach ignored the pipelines.

/** A program's region, as the store reads it. */
const regionOf = (season: SeasonState, i: number): Region =>
  CONFERENCES.find((c) => c.id === season.teams[i]?.conference)?.region ?? 'Gulf';

/** A fresh class and one program's own pitch, for the engine tests. */
const engineBoard = (me: number, economy = freshEconomy(), seed = 31) => {
  const season = createSeason(makeRng(seed), undefined, CONFERENCES);
  const rec = season.teams[me]!;
  const pitch = programRecruitingPitch(season, rec, regionOf(season, me), 45, economy);
  const recruits: RecruitClass = season.recruiting;
  const byId = (id: string): Prospect => recruits.prospects.find((p) => p.id === id)!;
  return { season, rec, pitch, recruits, prospects: recruits.prospects, byId };
};

/** One staff week at the floor of the effort scale. */
const weekOf = (me: number, pitch: Pitch, list: readonly PlayerId[], week: number): StaffWeek => ({
  team: me, pitch, list, week, year: 2027, effort: DELEGATE_FLOOR,
  coachPrestige: 45, recruitingSkill: 20, signed: 0, need: 8,
  rng: staffWeekRng(1, 2027, week, me),
});

/** A career whose staff runs recruiting from day one. */
const staffCareer = async (seed = 4242, team = 95) => {
  const { useDynasty } = await import('../src/state/store.js');
  useDynasty.getState().start(seed, team, undefined, 'casual', undefined, false, undefined, { recruiting: false });
  return useDynasty;
};

describe('the staff works the list', () => {
  it('a career can start with the staff running recruiting', async () => {
    const { useDynasty } = await import('../src/state/store.js');
    const { handles } = await import('../src/state/depth.js');
    await staffCareer();
    const s = useDynasty.getState();
    expect(handles(s.depth, 'recruiting')).toBe(false);
    expect(s.depth.overrides.recruiting).toBe(false);
    const prospects = s.season!.recruiting.prospects;
    // Nothing on the board until the coach picks, then week one is.
    expect(prospects.some((p) => (p.points[95] ?? 0) > 0)).toBe(false);
    expect(totalWeekSpend(prospects, 95)).toBe(0);
    const { suggestedStaffList } = await import('../src/state/store.js');
    const list = suggestedStaffList(s.season, 95, s.coach, s.economy, s.phase);
    expect(list.length).toBeGreaterThan(0);
    s.setStaffList(list);
    expect(totalWeekSpend(prospects, 95)).toBeGreaterThan(0);
    for (const p of prospects) {
      if (!list.includes(p.id)) expect(p.spent[95] ?? 0, p.player.name).toBe(0);
    }

    // The store's default is unchanged: both presets work their own board.
    useDynasty.getState().start(4242, 95, undefined, 'casual');
    expect(handles(useDynasty.getState().depth, 'recruiting')).toBe(true);
  });

  it("the band counts the staff's week, and the close banks exactly that", async () => {
    /*
      Bug 2: the band read "nothing planned" all season because the staff's
      week was planned inside the close and never written down. Now it is on
      the board from the open — and the close must bank that week and nothing
      else: no second, hidden plan, and no week counted twice.
    */
    const useDynasty = await staffCareer();
    const { suggestedStaffList } = await import('../src/state/store.js');
    {
      const t = useDynasty.getState();
      t.setStaffList(suggestedStaffList(t.season, 95, t.coach, t.economy, t.phase));
    }
    const s = useDynasty.getState();
    const season = s.season!;
    const me = 95;
    const prospects = season.recruiting.prospects;
    const stars = prestigeStars(season.teams[me]!.prestige);
    const spend = totalWeekSpend(prospects, me);
    expect(spend).toBeGreaterThan(0);
    expect(spend).toBeLessThanOrEqual(Math.round(weeklyBudget(stars) * delegateEffort(s.economy)));

    const rec = season.teams[me]!;
    const pitch = programRecruitingPitch(season, rec, regionOf(season, me), s.coach.prestige, s.economy);
    const roster = [...rec.team.lineup, ...rec.team.bench, ...rec.team.rotation, ...rec.team.bullpen];
    const skill = withStaff(s.coach.skills, s.economy.staff).recruiting;
    const before = new Map(prospects.map((p) => [p.id, p.points[me] ?? 0]));
    const expected = new Map<string, number>();
    for (const p of prospects) {
      const planned = (p.spent[me] ?? 0) > 0 || (p.weekActions?.[me] ? true : false);
      if (!planned) continue;
      const { gain } = recruitingPlan(p, pitch, {
        team: me, actions: p.spent[me] ?? 0, prestige: s.coach.prestige, skill, economy: s.economy, roster,
      });
      expected.set(p.id, Math.max(0, (p.points[me] ?? 0) + gain));
    }
    expect(expected.size).toBeGreaterThan(0);

    useDynasty.getState().advanceRecruitingWeek();
    for (const p of prospects) {
      expect(p.points[me] ?? 0, p.player.name).toBeCloseTo(expected.get(p.id) ?? before.get(p.id)!, 9);
    }
  });

  it("replanning is deterministic and never touches the world's generator", async () => {
    const useDynasty = await staffCareer();
    const season = useDynasty.getState().season!;
    const me = 95;
    const ledger = (): string => JSON.stringify(season.recruiting.prospects
      .map((p) => [p.id, p.spent[me] ?? 0, p.weekActions?.[me] ?? null]));
    const rngBefore = season.rng.state!();
    // A list, or there is no week to replan.
    const { suggestedStaffList } = await import('../src/state/store.js');
    const t = useDynasty.getState();
    t.setStaffList(suggestedStaffList(t.season, me, t.coach, t.economy, t.phase));
    expect(totalWeekSpend(season.recruiting.prospects, me)).toBeGreaterThan(0);
    const first = ledger();
    useDynasty.getState().staffPlanWeek(true);
    expect(ledger()).toBe(first);
    useDynasty.getState().staffPlanWeek(true);
    expect(ledger()).toBe(first);
    expect(season.rng.state!()).toBe(rngBefore);
  });

  it('works the list first and in order', () => {
    const me = 0;
    const { season, pitch, recruits, prospects, byId } = engineBoard(me);
    seedFor(season, me);
    const list = suggestStaffList(prospects, me, pitch, [], 1).slice(0, 5);
    expect(list).toHaveLength(5);

    planStaffWeek(recruits, weekOf(me, pitch, list, 1));
    const listed = list.map((id) => byId(id).spent[me] ?? 0);
    for (let i = 1; i < listed.length; i++) {
      expect(listed[i]!, `slot ${i + 1}`).toBeLessThanOrEqual(listed[i - 1]!);
    }
    for (const a of listed) expect(a).toBeGreaterThanOrEqual(1);
    // Nobody off the list is worked at all (2026-09-30).
    for (const p of prospects) {
      if (!list.includes(p.id)) expect(p.spent[me] ?? 0, p.player.name).toBe(0);
    }
    // And the week is the staff's week, not the coach's.
    expect(totalWeekSpend(prospects, me))
      .toBeLessThanOrEqual(Math.max(1, Math.round(weeklyBudget(pitch.stars) * DELEGATE_FLOOR)));

    // Nobody starred: nothing spent, nobody worked. The open slots are the
    // coach's to fill.
    const alone = planStaffWeek(recruits, weekOf(me, pitch, [], 1));
    expect(alone.spends).toEqual([]);
    expect(alone.asked).toEqual([]);
    expect(totalWeekSpend(prospects, me)).toBe(0);
  });

  it('asks for the commitment once the lead is safe', () => {
    const me = 0;
    const other = 1;
    const plan = (style: (s: DecisionStyle) => boolean, rival: number, week: number) => {
      const { pitch, recruits, prospects } = engineBoard(me);
      const p = prospects.find((q) => style(decisionStyle(q)) && pursuable(q, pitch))!;
      const price = commitPriceFor(p);
      p.points = { [me]: price * 1.5, [other]: price * rival };
      recruits.week = week;
      planStaffWeek(recruits, weekOf(me, pitch, [p.id], week));
      return { p, recruits };
    };

    // A lead of better than the settle margin, his price banked, week three.
    const { p, recruits } = plan((s) => s !== 'early', 0.4, 3);
    expect(p.askedBy?.[me]?.week).toBe(3);
    expect(p.weekActions?.[me]?.major?.kind).toBe('ask');
    if (p.askedBy![me]!.success) {
      closeWeek(recruits, makeRng(5), false);
      expect(p.signedBy).toBe(me);
    }

    // Not while the lead is thin, not on the last week (the close signs the
    // leader anyway), and never an early decider (he settles at this close).
    expect(plan((s) => s !== 'early', 1.2, 3).p.askedBy?.[me]).toBeUndefined();
    expect(plan((s) => s !== 'early', 0.4, 12).p.askedBy?.[me]).toBeUndefined();
    expect(plan((s) => s === 'early', 0.4, 3).p.askedBy?.[me]).toBeUndefined();
  });

  /*
    The order test above runs a small week. The next ones run the weeks where
    each rule decides something, so taking one out fails here.
  */

  it('works nobody off the list on its biggest week, and a lost one passes his share on', () => {
    const me = 0;
    const ceiling = (pitch: Pitch, list: readonly PlayerId[]): StaffWeek =>
      ({ ...weekOf(me, pitch, list, 1), effort: DELEGATE_CEILING });

    // One starred man on a five-star program's biggest week, in a class with
    // three other men still open: 14 raw points, two of them his by his share.
    // The twelve left used to go to the staff's own picks. Now the three are
    // left alone and the rest goes back to him, up to what one man can take.
    {
      const { pitch, recruits, prospects, byId } = engineBoard(me);
      expect(pitch.stars).toBe(5);
      const open = suggestStaffList(prospects, me, pitch, [], 1).slice(0, 4);
      const list = open.slice(0, 1);
      for (const p of prospects) if (!open.includes(p.id)) p.signedBy = 1;
      planStaffWeek(recruits, ceiling(pitch, list));
      const his = byId(list[0]!).spent[me] ?? 0;
      const others = prospects.filter((p) => p.id !== list[0]).map((p) => p.spent[me] ?? 0);
      expect(others.filter((a) => a > 0).length, 'the open men are left alone').toBe(0);
      const raw = Math.floor(weeklyBudget(pitch.stars) * STAFF_RAW_SHARE * DELEGATE_CEILING);
      expect(his).toBe(Math.min(MAX_PER_RECRUIT, raw));
    }

    // A man well lost in the middle of the list is kept in touch on a point,
    // and the man under him works on both their shares.
    {
      const { season, pitch, recruits, prospects, byId } = engineBoard(me);
      seedFor(season, me);
      const list = suggestStaffList(prospects, me, pitch, [], 1).slice(0, 3);
      const lost = byId(list[1]!);
      lost.points = { [me]: 1, 1: 100 };
      expect(lostCause(lost, me, pitch.stars, 1)).toBe(true);
      planStaffWeek(recruits, ceiling(pitch, list));
      const raw = Math.floor(weeklyBudget(pitch.stars) * STAFF_RAW_SHARE * DELEGATE_CEILING);
      expect(lost.spent[me]).toBe(1);
      expect(byId(list[2]!).spent[me] ?? 0)
        .toBeGreaterThanOrEqual(Math.round(raw * (STAFF_ORDER_SHARE[1]! + STAFF_ORDER_SHARE[2]!)));
    }
  });

  /** A man leading well clear, his price banked: due to be asked from week two. */
  const dueMan = (prospects: Prospect[], pitch: Pitch, me: number): Prospect => {
    const p = prospects.find((q) => decisionStyle(q) !== 'early' && pursuable(q, pitch))!;
    const price = commitPriceFor(p);
    p.points = { [me]: price * 1.5, [me + 1]: price * 0.4 };
    return p;
  };

  it('never asks an unstarred man, however safe his lead', () => {
    // It used to ask the leader it had while a seat was spare. A man the
    // coach did not star is not the staff's to sign (2026-09-30).
    const me = 0;
    const plan = (starred: number): Prospect => {
      const { pitch, recruits, prospects } = engineBoard(me);
      const u = dueMan(prospects, pitch, me);
      const list = suggestStaffList(prospects, me, pitch, [], 3).filter((id) => id !== u.id).slice(0, starred);
      recruits.week = 3;
      // Six signed, so two seats left.
      planStaffWeek(recruits, { ...weekOf(me, pitch, list, 3), signed: 6 });
      return u;
    };
    expect(plan(0).askedBy?.[me]).toBeUndefined();
    expect(plan(1).askedBy?.[me]).toBeUndefined();
    // Starred, the same man is asked.
    const { pitch, recruits, prospects } = engineBoard(me);
    const u = dueMan(prospects, pitch, me);
    recruits.week = 3;
    planStaffWeek(recruits, { ...weekOf(me, pitch, [u.id], 3), signed: 6 });
    expect(u.askedBy?.[me]?.week).toBe(3);
  });

  it('never asks a man whose mind is already made up', () => {
    const me = 0;
    const { pitch, prospects } = engineBoard(me);
    const u = dueMan(prospects, pitch, me);
    expect(staffAskDue(u, me, 5, false)).toBe(true);
    // Settled last week: this close may still be too soon for him.
    u.settledSince = 4;
    expect(staffAskDue(u, me, 5, false)).toBe(true);
    // Settled two weeks back: he is ready, and the close signs him anyway.
    u.settledSince = 3;
    expect(staffAskDue(u, me, 5, false)).toBe(false);
  });

  it('a replan keeps the answered moves and their cost, and takes back a promise', () => {
    const me = 0;
    const { pitch, recruits, prospects } = engineBoard(me);
    const u = dueMan(prospects, pitch, me);
    recruits.week = 3;
    const cap = Math.max(1, Math.round(weeklyBudget(pitch.stars) * DELEGATE_FLOOR));
    planStaffWeek(recruits, weekOf(me, pitch, [u.id], 3));
    const asked = u.weekActions?.[me]?.major;
    expect(asked?.kind).toBe('ask');
    // A list change mid-week replans the whole week. The ask was answered, so
    // it stands, costed once, and the week still fits the staff's cap.
    planStaffWeek(recruits, weekOf(me, pitch, [u.id], 3));
    expect(u.weekActions?.[me]?.major).toEqual(asked);
    expect(totalWeekSpend(prospects, me)).toBeGreaterThanOrEqual(ASK_COST);
    expect(totalWeekSpend(prospects, me)).toBeLessThanOrEqual(cap);

    // Taking the week off the board: a sway stays, a promise made this week
    // is withdrawn, and the rest goes.
    const [s, q, r] = prospects.filter((p) => p !== u).slice(0, 3) as [Prospect, Prospect, Prospect];
    s.weekActions = { [me]: { major: { kind: 'sway', factor: 'coach', success: true } } };
    q.weekActions = { [me]: { major: { kind: 'promise', promise: 'noRedshirt' } } };
    q.promiseBy = { [me]: 'noRedshirt' };
    r.weekActions = { [me]: { pitch: 'coach' } };
    r.spent[me] = 4;
    clearStaffWeek(prospects, me);
    expect(s.weekActions?.[me]?.major?.kind).toBe('sway');
    expect(u.weekActions?.[me]?.major?.kind).toBe('ask');
    expect(q.weekActions?.[me]).toBeUndefined();
    expect(q.promiseBy?.[me]).toBeUndefined();
    expect(r.weekActions?.[me]).toBeUndefined();
    expect(r.spent[me]).toBeUndefined();
  });

  it('replaces a starred recruit who signs elsewhere, and can be told not to', async () => {
    // A seeded class, as the window opens it: the man he loses must be
    // replaced by one the staff could still win, and on a board where rivals
    // already lead hundreds of men the lost-cause rule has someone to turn
    // away. (An unseeded class has no lost causes, so it proved nothing.)
    // Team 95, the program the store tests use; team 0's pool comes up empty.
    const me = 95;
    const other = 0;
    const { season, pitch, recruits, prospects, byId } = engineBoard(me);
    seedFor(season, me);
    expect(prospects.some((p) => p.signedBy === null && pursuable(p, pitch)
      && lostCause(p, me, pitch.stars, recruits.week)), 'the seeded board has lost causes').toBe(true);
    const [aId, bId] = suggestStaffList(prospects, me, pitch, [], 1) as [PlayerId, PlayerId];
    const a = byId(aId);
    recruits.staffList = [aId, bId];
    a.signedBy = other;

    tendStaffList(recruits, me, pitch, true);
    expect(recruits.staffList).toHaveLength(2);
    const cId = recruits.staffList![0]!;
    expect(cId).not.toBe(aId);
    expect(recruits.staffList![1]).toBe(bId);
    const c = byId(cId);
    expect(samePosition(c, a) || sameGroup(c, a)).toBe(true);
    expect(Math.abs(c.stars - a.stars)).toBeLessThanOrEqual(1);
    expect(pursuable(c, pitch)).toBe(true);
    expect(lostCause(c, me, pitch.stars, recruits.week)).toBe(false);
    expect(recruits.staffStandIns?.[cId]).toBe(aId);

    // Told not to: the lost man simply goes.
    recruits.staffList = [aId, bId];
    delete recruits.staffStandIns;
    tendStaffList(recruits, me, pitch, false);
    expect(recruits.staffList).toEqual([bId]);
    expect(recruits.staffStandIns).toBeUndefined();

    const { useDynasty } = await import('../src/state/store.js');
    useDynasty.getState().setReplaceLostRecruits(false);
    expect(useDynasty.getState().replaceLostRecruits).toBe(false);
    useDynasty.getState().setReplaceLostRecruits(true);
  });

  it('the list never holds more than eight', async () => {
    const { staffListOf } = await import('../src/state/store.js');
    const useDynasty = await staffCareer();
    const st = () => useDynasty.getState();
    const season = st().season!;
    const chair = season.teams[95]!;
    const reach = (p: Prospect): boolean => p.signedBy === null
      && canPursue(p, prestigeStars(chair.prestige), pipelineStrength(st().economy, p.state, chair.def.state));
    const open = season.recruiting.prospects.filter(reach).slice(0, 10).map((p) => p.id);
    expect(open).toHaveLength(10);

    for (let i = 0; i < STAFF_LIST_MAX; i++) expect(st().starRecruit(open[i]!), `star ${i + 1}`).toBe(true);
    expect(st().starRecruit(open[STAFF_LIST_MAX]!)).toBe(false);
    expect(staffListOf(st())).toHaveLength(STAFF_LIST_MAX);

    st().setStaffList(open);
    expect(staffListOf(st())).toEqual(open.slice(0, STAFF_LIST_MAX));

    // Unstarring a stand-in takes his key with him.
    const recruits = season.recruiting;
    const first = recruits.staffList![0]!;
    recruits.staffStandIns = { [first]: open[9]! };
    expect(st().starRecruit(first)).toBe(true);
    expect(recruits.staffList).not.toContain(first);
    expect(recruits.staffStandIns?.[first]).toBeUndefined();
  });

  it('the targets view keeps its rows while the coach stars and unstars', async () => {
    /*
      Every star tap replans the staff's week. A man with nothing banked whom
      a rival leads is on "Your targets" only while he is starred (the staff's
      own board walks away from him), so unstarring him there took his row out
      from under the thumb. The view holds the rows it opened with.
    */
    const { onYourBoard, holdRows } = await import('../src/ui/screens/Board.js');
    const useDynasty = await staffCareer();
    const st = () => useDynasty.getState();
    const me = 95;
    for (let w = 0; w < 2; w++) st().advanceRecruitingWeek();
    const season = st().season!;
    expect(season.recruiting.week).toBe(3);
    const chair = season.teams[me]!;
    const prospects = season.recruiting.prospects;
    const man = prospects.find((p) => p.signedBy === null && (p.points[me] ?? 0) === 0
      && Object.entries(p.points).some(([t, v]) => Number(t) !== me && v > 0)
      && !onYourBoard(p, me)
      && canPursue(p, prestigeStars(chair.prestige), pipelineStrength(st().economy, p.state, chair.def.state)))!;
    expect(man).toBeDefined();
    const targets = (): Prospect[] => prospects.filter((p) => onYourBoard(p, me));

    expect(st().starRecruit(man.id)).toBe(true);
    expect(onYourBoard(man, me), 'starred, the staff works him').toBe(true);
    const key = `${me}:${st().year}:3`;
    const opened = holdRows(null, key, targets());
    expect(opened!.ids).toContain(man.id);

    expect(st().starRecruit(man.id)).toBe(true);
    expect(onYourBoard(man, me), 'unstarred, nobody works him').toBe(false);
    // The same rows, the same order, until the coach leaves or the week closes.
    expect(holdRows(opened, key, targets())).toBe(opened);
    expect(holdRows(opened, `${me}:${st().year}:4`, targets())!.ids).not.toContain(man.id);
    expect(holdRows(opened, null, targets())).toBeNull();
  });

  it('switching to staff mid-season plans the list and nobody else', async () => {
    /*
      Bug 1 was a staff that took over an empty board and never started: it
      walked away from every man somebody else led. The fix seeded the board
      the way a rival's is, and that put interest on men the coach never chose
      (2026-09-30). Now the switch seeds nothing, and the first star plans
      the week, on that man alone, lead or no lead.
    */
    const { useDynasty } = await import('../src/state/store.js');
    const me = 95;
    useDynasty.getState().start(4242, me);
    for (let w = 0; w < 3; w++) useDynasty.getState().advanceRecruitingWeek();
    const season = useDynasty.getState().season!;
    const prospects = season.recruiting.prospects;
    expect(prospects.some((p) => (p.points[me] ?? 0) > 0)).toBe(false);

    const rngBefore = season.rng.state!();
    useDynasty.getState().setDepthSystem('recruiting', false);
    expect(prospects.some((p) => (p.points[me] ?? 0) > 0)).toBe(false);
    expect(totalWeekSpend(prospects, me)).toBe(0);
    const chair0 = season.teams[me]!;
    const led = prospects.find((p) => p.signedBy === null
      && Object.entries(p.points).some(([t, v]) => Number(t) !== me && v > 0)
      && canPursue(p, prestigeStars(chair0.prestige), pipelineStrength(useDynasty.getState().economy, p.state, chair0.def.state)))!;
    expect(useDynasty.getState().starRecruit(led.id)).toBe(true);
    expect(led.spent[me] ?? 0).toBeGreaterThan(0);
    expect(totalWeekSpend(prospects, me)).toBe(totalWeekSpend([led], me));
    expect(season.rng.state!()).toBe(rngBefore);

    // A week the coach already planned stands: his, not the staff's.
    useDynasty.getState().start(4242, me);
    const fresh = useDynasty.getState().season!;
    const chair = fresh.teams[me]!;
    const target = fresh.recruiting.prospects.find((p) => p.signedBy === null
      && canPursue(p, prestigeStars(chair.prestige), pipelineStrength(useDynasty.getState().economy, p.state, chair.def.state)))!;
    useDynasty.getState().recruit(target.id, 5);
    expect(target.spent[me]).toBe(5);
    const total = totalWeekSpend(fresh.recruiting.prospects, me);
    useDynasty.getState().setDepthSystem('recruiting', false);
    expect(target.spent[me]).toBe(5);
    expect(totalWeekSpend(fresh.recruiting.prospects, me)).toBe(total);
  });

  it("the staff reaches through the program's pipelines", () => {
    // Bug 3: the staff's reach read the home state only, so a pipeline the
    // coach could recruit through was one his staff could not.
    setStarGateOpen(false);
    const probe = createSeason(makeRng(31), undefined, CONFERENCES);
    const me = probe.teams.find((t) => prestigeStars(t.prestige) === 1)!.index;
    const home = probe.teams[me]!.def.state;
    const target = probe.recruiting.prospects.find((p) => p.stars === 3 && p.state !== home && p.signedBy === null)!;
    const state = target.state;

    const economy = freshEconomy();
    economy.pipelines = { [state]: { state, strength: 70, signings: 0, lastSignedYear: 0 } };
    const built = engineBoard(me, economy);
    const p = built.byId(target.id);
    expect(pursuable(p, built.pitch)).toBe(true);
    planStaffWeek(built.recruits, weekOf(me, built.pitch, [p.id], 1));
    expect(p.spent[me] ?? 0).toBeGreaterThan(0);

    const bare = engineBoard(me);
    const q = bare.byId(target.id);
    expect(pursuable(q, bare.pitch)).toBe(false);
    planStaffWeek(bare.recruits, weekOf(me, bare.pitch, [q.id], 1));
    expect(q.spent[me] ?? 0).toBe(0);
  });

  it('staffLine says what the staff did', () => {
    const me = 0;
    const { prospects } = engineBoard(me);
    const p = prospects[0]!;
    p.weekActions = { [me]: { major: { kind: 'ask', success: true } } };
    // Short enough for the staff list's 145px line on a 375 phone, answer and all.
    expect(staffLine(p, me, 3, 3)).toBe('Asked · he said yes');
    p.weekActions = { [me]: { major: { kind: 'ask', success: false } } };
    expect(staffLine(p, me, 3, 3)).toBe('Asked · he said no');
    p.weekActions = {};
    p.spent = {};
    expect(staffLine(p, me, 3, 3)).toBe('Not worked this week');
    // Well behind with interest banked: a point to keep in touch.
    p.points = { [me]: 1, 1: 10 };
    p.spent = { [me]: 1 };
    expect(staffLine(p, me, 3, 3)).toBe('Keeping in touch');
    // Worked: the raw effort and the pitch together.
    p.points = { [me]: 10, 1: 4 };
    p.spent = { [me]: 4 };
    p.weekActions = { [me]: { pitch: 'coach' } };
    expect(staffLine(p, me, 3, 3)).toBe('7 pts this week');
  });

  it('the suggested list signs a class its peers would recognise', async () => {
    /*
      The end-to-end guard, on the weakest program in the world, where a
      staff that cannot start collapses (see the top of this section; 0.41 of
      the peer average was the bug). The coach who taps "Use these" and walks
      away gets a class that holds 0.5 of its peers' across three worlds, and
      fills the list: sized to the open seats and two over, a staff that
      signs fewer than the seats has let the coach down.

      It used to be measured against the staff picking alone. There is no
      alone now (2026-09-30): an empty list spends nothing.
    */
    const { suggestedStaffList } = await import('../src/state/store.js');
    const me = 95;
    const signedBy = (season: SeasonState, team: number): number =>
      season.recruiting.prospects.filter((p) => p.signedBy === team).length;
    // Starred men who signed elsewhere with weeks still to play, and the
    // stand-ins the staff starred in their slots ("Replace lost recruits",
    // on by default).
    let lost = 0;
    const standIns = new Set<string>();
    for (const seed of [4242, 909, 1717]) {
      const b = await staffCareer(seed, me);
      const s = b.getState();
      expect(s.replaceLostRecruits).toBe(true);
      s.setStaffList(suggestedStaffList(s.season, me, s.coach, s.economy, s.phase));
      const size = b.getState().season!.recruiting.staffList!.length;
      expect(size, `list at seed ${seed}`).toBeGreaterThan(0);
      for (let w = 0; w < 12; w++) {
        const before = [...(b.getState().season!.recruiting.staffList ?? [])];
        b.getState().advanceRecruitingWeek();
        const rec = b.getState().season!.recruiting;
        if (w < 11) {
          lost += before.filter((id) => {
            const p = rec.prospects.find((q) => q.id === id);
            return p !== undefined && p.signedBy !== null && p.signedBy !== me;
          }).length;
        }
        for (const id of Object.keys(rec.staffStandIns ?? {})) standIns.add(id);
      }
      const done = b.getState().season!;
      const mine = signedBy(done, me);

      const quality = (i: number): number => done.teams[i]!.team.quality;
      const peers = done.teams
        .filter((t) => t.index !== me && Math.abs(quality(t.index) - quality(me)) <= 6)
        .map((t) => signedBy(done, t.index));
      const peerAvg = peers.reduce((x, y) => x + y, 0) / Math.max(1, peers.length);
      expect(peers.length, 'peers found').toBeGreaterThan(5);
      expect(mine, `seed ${seed}: listed staff signed ${mine}, peers ${peerAvg.toFixed(2)}`)
        .toBeGreaterThan(peerAvg * 0.5);
      // The seats the list was sized to (two over), all filled.
      expect(mine, `seed ${seed}: signed ${mine} from a list of ${size}`).toBeGreaterThanOrEqual(size - 2);
    }
    // Replacement is wired into a real career: a starred man lost mid-window
    // has had a stand-in take his slot.
    expect(lost, 'starred men lost mid-window').toBeGreaterThan(0);
    expect(standIns.size, `stand-ins for ${lost} lost starred men`).toBeGreaterThan(0);
    // The order shares still sum to one: the list spends the staff's week, no more.
    expect(STAFF_ORDER_SHARE.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 9);
  });
});

describe('the board a staff runs says so', () => {
  // A new casual career starts with the staff running recruiting, so the
  // board's first-visit tip must not tell that coach to spend points or pitch:
  // neither is his to do there. Starring is.
  it('has its own first-visit tip, about starring', () => {
    const board = readFileSync('src/ui/screens/Board.tsx', 'utf8');
    expect(board).toContain("worksBoard ? 'recruiting' : 'recruiting-staff'");
    const tip = TUTORIALS['recruiting-staff'];
    expect(tip?.length).toBe(1);
    const words = `${tip![0]!.body} ${tip![0]!.action}`;
    expect(words).toMatch(/star/i);
    expect(words).not.toMatch(/points|pitch|promise/i);
  });
});

/** Seed the class the way the window's open does, the coached programme included. */
function seedFor(season: SeasonState, me: number): void {
  seedRivalInterest(season, me, true);
}
