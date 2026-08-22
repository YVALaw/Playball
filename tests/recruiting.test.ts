// recruiting.test.ts
// Prestige has to gate talent — but not decide everything on its own.
//
// The whole point of the pitch system is that a recruit's own priorities, not a
// raw prestige gap, decide where he goes. Two failure modes look identical from
// inside a single class: prestige deciding everything, which makes the board a
// sorted table, and prestige deciding nothing, which makes a dynasty pointless.
// The tests here bound both sides.

import { describe, it, expect } from 'vitest';
import {
  generateClass, aiTargets, closeWeek, resetWeeklySpend, weeklyPoints, fit, canPursue,
  PRIORITIES, RECRUITING_WEEKS, SCHOLARSHIPS, RECRUITING_BUDGET, MAX_PER_RECRUIT,
  type Pitch, type Prospect,
} from '../src/engine/recruiting.js';
import { makeRng } from '../src/engine/rng.js';
import type { Region } from '../src/data/schools.js';

const REGIONS: Region[] = [
  'Gulf', 'Atlantic', 'Pacific', 'Heartland',
  'Desert', 'Great Lakes', 'Mountain', 'Northeast',
];

/** A program described purely by the pitch it can make. */
function program(prestige: number, opts: Partial<Pitch> = {}): Pitch {
  return {
    prestige,
    // Same mapping the real game uses, so the tests hold the AI to the player's gate.
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

/** Run a full three week cycle for a league of programs, and report who signed. */
function runWindow(seed: number, programs: Pitch[]) {
  const rng = makeRng(seed);
  const recruits = generateClass(2027, programs.length, rng);
  recruits.week = 1;

  const signed = new Map<number, Prospect[]>();

  for (let w = 1; w <= RECRUITING_WEEKS; w++) {
    recruits.week = w;
    programs.forEach((pitch, team) => {
      for (const { prospect, actions } of aiTargets(team, pitch, 45, recruits.prospects, 8, rng)) {
        prospect.spent[team] = actions;
        prospect.points[team] =
          (prospect.points[team] ?? 0) + weeklyPoints(prospect, pitch, actions, 45);
      }
    });
    for (const c of closeWeek(recruits, rng, w >= RECRUITING_WEEKS)) {
      const list = signed.get(c.team) ?? [];
      list.push(c.prospect);
      signed.set(c.team, list);
    }
    resetWeeklySpend(recruits);
  }

  return { recruits, signed };
}

/** A league whose only difference between programs is prestige. */
const LADDER = Array.from({ length: 16 }, (_, i) =>
  program(0.2 + (i / 15) * 0.75, { region: REGIONS[i % REGIONS.length] as Region }));

describe('a recruit knows what he wants', () => {
  it('gives every recruit priorities that sum to one', () => {
    const { prospects } = generateClass(2027, 16, makeRng(4242));
    for (const p of prospects) {
      const total = PRIORITIES.reduce((a, k) => a + p.priorities[k], 0);
      expect(total).toBeCloseTo(1, 6);
      for (const k of PRIORITIES) expect(p.priorities[k]).toBeGreaterThan(0);
    }
  });

  it('leans the best recruits toward the name and the rest toward playing', () => {
    const { prospects } = generateClass(2027, 64, makeRng(4242));
    const avg = (stars: number, k: 'prestige' | 'playingTime') => {
      const rows = prospects.filter((p) => p.stars === stars);
      return rows.reduce((a, p) => a + p.priorities[k], 0) / Math.max(1, rows.length);
    };
    expect(avg(5, 'prestige')).toBeGreaterThan(avg(1, 'prestige'));
    expect(avg(1, 'playingTime')).toBeGreaterThan(avg(5, 'playingTime'));
  });

  it('still produces outliers, which is the whole point', () => {
    // A five star who wants to play immediately is the one a small program can
    // actually take. Without him the board is the prestige table sorted twice.
    const { prospects } = generateClass(2027, 64, makeRng(4242));
    const fives = prospects.filter((p) => p.stars >= 4);
    const wantsToPlay = fives.filter(
      (p) => p.priorities.playingTime > p.priorities.prestige,
    );
    expect(fives.length).toBeGreaterThan(20);
    expect(wantsToPlay.length).toBeGreaterThan(2);
  });
});

describe('fit', () => {
  it('rates a blue blood highly for a recruit who wants the name', () => {
    const { prospects } = generateClass(2027, 16, makeRng(7));
    const p = prospects[0] as Prospect;
    p.priorities = {
      prestige: 1, playingTime: 0, winning: 0, proximity: 0, development: 0,
    };
    expect(fit(p, program(0.95))).toBeGreaterThan(0.9);
    expect(fit(p, program(0.2))).toBeLessThan(0.3);
  });

  it('lets a small program win a recruit who only wants to play', () => {
    // The load-bearing case for the whole design.
    const { prospects } = generateClass(2027, 16, makeRng(7));
    const p = prospects[0] as Prospect;
    p.priorities = {
      prestige: 0, playingTime: 1, winning: 0, proximity: 0, development: 0,
    };
    const blueBlood = program(0.95, { playingTime: () => 0.1 });
    const small = program(0.2, { playingTime: () => 0.95 });
    expect(fit(p, small)).toBeGreaterThan(fit(p, blueBlood));
  });

  it('rewards a program in the recruit\'s home region', () => {
    const { prospects } = generateClass(2027, 16, makeRng(7));
    const p = prospects[0] as Prospect;
    p.hometown = 'Gulf';
    p.priorities = {
      prestige: 0, playingTime: 0, winning: 0, proximity: 1, development: 0,
    };
    expect(fit(p, program(0.5, { region: 'Gulf' })))
      .toBeGreaterThan(fit(p, program(0.5, { region: 'Northeast' })));
  });
});

describe('points, not a lottery', () => {
  it('gives the recruit to whoever banked the most', () => {
    const rng = makeRng(11);
    const recruits = generateClass(2027, 8, rng);
    recruits.week = RECRUITING_WEEKS;
    const p = recruits.prospects[0] as Prospect;
    p.points = { 0: 40, 1: 95, 2: 12 };

    const commits = closeWeek(recruits, rng, true);
    const his = commits.find((c) => c.prospect.id === p.id);
    expect(his?.team).toBe(1);
  });

  it('lets persistence beat a better program', () => {
    // Out-work a blue blood and you take the player. Under the old lottery this
    // could not be relied on at all, which made effort decorative.
    const { prospects } = generateClass(2027, 16, makeRng(7));
    const p = prospects[0] as Prospect;
    p.priorities = {
      prestige: 0.45, playingTime: 0.2, winning: 0.15, proximity: 0.1, development: 0.1,
    };
    const blueBlood = program(0.95);
    const small = program(0.45);

    let bigPoints = 0, smallPoints = 0;
    for (let w = 0; w < RECRUITING_WEEKS; w++) {
      bigPoints += weeklyPoints(p, blueBlood, 1, 45);       // barely trying
      smallPoints += weeklyPoints(p, small, MAX_PER_RECRUIT, 45);  // all in
    }
    expect(smallPoints).toBeGreaterThan(bigPoints);
  });

  it('does not let effort manufacture interest that is not there', () => {
    // The other half: a program a recruit has no interest in cannot simply spend
    // its way past one he likes, or the priorities would be decoration.
    const { prospects } = generateClass(2027, 16, makeRng(7));
    const p = prospects[0] as Prospect;
    p.priorities = {
      prestige: 1, playingTime: 0, winning: 0, proximity: 0, development: 0,
    };
    const hopeless = weeklyPoints(p, program(0.08), MAX_PER_RECRUIT, 45);
    const natural = weeklyPoints(p, program(0.95), 2, 45);
    expect(hopeless).toBeLessThan(natural);
  });
});

describe('the window', () => {
  it('signs nobody twice', () => {
    const { signed } = runWindow(4242, LADDER);
    const ids = [...signed.values()].flat().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never signs a class past its scholarships', () => {
    const { signed } = runWindow(4242, LADDER);
    for (const [team, list] of signed) {
      expect(list.length, `team ${team} oversigned`).toBeLessThanOrEqual(SCHOLARSHIPS);
    }
  });

  it('leaves a recruit unsigned when every suitor is full', () => {
    // The cap has to bite somewhere or it is not a cap. Built as a case where it
    // must: one program, chasing far more players than it has room for. The
    // sixteen program ladder above never fills a class, so it cannot show this —
    // a fixture that cannot produce the condition is not a test of it.
    const rng = makeRng(31337);
    const recruits = generateClass(2027, 8, rng);
    recruits.week = RECRUITING_WEEKS;

    const wanted = recruits.prospects.slice(0, SCHOLARSHIPS + 12);
    for (const p of wanted) p.points = { 0: 100 };

    const commits = closeWeek(recruits, rng, true);
    expect(commits.length).toBe(SCHOLARSHIPS);
    expect(wanted.filter((p) => p.signedBy === null).length).toBe(12);
  });

  it('commits some recruits early, so waiting costs something', () => {
    const { recruits } = runWindow(4242, LADDER);
    const early = recruits.prospects.filter(
      (p) => p.committedWeek !== null && p.committedWeek < RECRUITING_WEEKS,
    );
    expect(early.length).toBeGreaterThan(0);
  });

  it('sends better recruits to better programs on average', () => {
    const { signed } = runWindow(4242, LADDER);
    const tierAvg = (from: number, to: number) => {
      let stars = 0, n = 0;
      for (const [team, list] of signed) {
        if (team < from || team > to) continue;
        for (const p of list) { stars += p.stars; n += 1; }
      }
      return n === 0 ? 0 : stars / n;
    };
    // Top third of the ladder against the bottom third.
    expect(tierAvg(11, 15)).toBeGreaterThan(tierAvg(0, 4));
  });

  it('does not let the biggest programs take everybody', () => {
    // Prestige deciding everything is as broken as prestige deciding nothing.
    const { signed } = runWindow(4242, LADDER);
    let small = 0;
    for (const [team, list] of signed) if (team <= 4) small += list.length;
    expect(small).toBeGreaterThan(0);
  });
});

describe('the AI recruits inside the same rules', () => {
  it('never exceeds the board or the weekly action budget', () => {
    const rng = makeRng(555);
    const recruits = generateClass(2027, 16, rng);
    for (let team = 0; team < 16; team++) {
      const board = aiTargets(team, LADDER[team] as Pitch, 45, recruits.prospects, 9, rng);
      expect(board.length).toBeLessThanOrEqual(SCHOLARSHIPS);
      for (const b of board) expect(b.actions).toBeLessThanOrEqual(MAX_PER_RECRUIT);
      const spent = board.reduce((a, b) => a + b.actions, 0);
      expect(spent).toBeLessThanOrEqual(RECRUITING_BUDGET + board.length);
    }
  });

  it('chases recruits it actually fits, not just the highest rated', () => {
    const rng = makeRng(99);
    const recruits = generateClass(2027, 16, rng);
    // A small program that can offer immediate playing time should not build a
    // board entirely out of five stars it will never sign.
    const small = program(0.25, { playingTime: () => 0.95 });
    const board = aiTargets(0, small, 45, recruits.prospects, 8, rng);
    const reaches = board.filter((b) => b.prospect.stars === 5).length;
    expect(reaches).toBeLessThan(board.length);
  });
});

describe('prestige gates who will even listen', () => {
  it('keeps five stars away from small programs entirely', () => {
    const { prospects } = generateClass(2027, 64, makeRng(4242));
    const fives = prospects.filter((p) => p.stars === 5);
    expect(fives.length).toBeGreaterThan(20);
    for (const p of fives) {
      expect(canPursue(p, 1), 'a one star program got a hearing from a five star').toBe(false);
      expect(canPursue(p, 2), 'a two star program got a hearing from a five star').toBe(false);
    }
  });

  it('leaves a narrow door open for a program recruiting above its weight', () => {
    // The Campus Dynasty behaviour: landing a big prospect from the lower
    // leagues is rare, not impossible. A gate with no door at all would make
    // prestige a ceiling instead of a ladder.
    const { prospects } = generateClass(2027, 64, makeRng(4242));
    const fives = prospects.filter((p) => p.stars === 5);
    const reachableAtThree = fives.filter((p) => canPursue(p, 3));
    expect(reachableAtThree.length).toBeGreaterThan(0);
    expect(reachableAtThree.length).toBeLessThan(fives.length / 2);
  });

  it('opens the door for the reasons it should', () => {
    // A five star only comes down for a program that can offer what he wants —
    // playing time or home. One chasing the biggest name does not come down.
    const { prospects } = generateClass(2027, 64, makeRng(4242));
    const fives = prospects.filter((p) => p.stars === 5);
    const flexible = fives.filter((p) => canPursue(p, 3));
    const rigid = fives.filter((p) => !canPursue(p, 4));

    const openness = (list: typeof fives) => list.length === 0 ? 0
      : list.reduce((a, p) => a + p.priorities.playingTime + p.priorities.proximity, 0) / list.length;

    expect(openness(flexible)).toBeGreaterThan(openness(rigid));
  });

  it('never leaves a program with nobody to recruit', () => {
    const { prospects } = generateClass(2027, 64, makeRng(4242));
    for (const tier of [1, 2, 3, 4, 5]) {
      const open = prospects.filter((p) => canPursue(p, tier));
      expect(open.length, `a ${tier} star program had nothing to chase`).toBeGreaterThan(200);
    }
  });

  it('stops the AI chasing recruits it is barred from', () => {
    const rng = makeRng(99);
    const recruits = generateClass(2027, 64, rng);
    const small = program(0.15, { playingTime: () => 0.9 });   // a one star program
    const board = aiTargets(0, small, 45, recruits.prospects, 8, rng);
    for (const { prospect } of board) {
      expect(canPursue(prospect, 1)).toBe(true);
    }
  });
});
