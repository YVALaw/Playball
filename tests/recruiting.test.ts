// recruiting.test.ts
// Prestige has to gate talent — but not decide everything on its own.
//
// The whole point of the pitch system is that a recruit's own priorities, not a
// raw prestige gap, decide where he goes. Two failure modes look identical from
// inside a single class: prestige deciding everything, which makes the board a
// sorted table, and prestige deciding nothing, which makes a dynasty pointless.
// The tests here bound both sides.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  generateClass, aiTargets, closeWeek, resetWeeklySpend, weeklyPoints, fit, canPursue,
  leadersAtWeekStart, byRank,
  PRIORITIES, RECRUITING_WEEKS, SCHOLARSHIPS, RECRUITING_BUDGET, MAX_PER_RECRUIT,
  commitPointsFor, budgetFor,
  type Pitch, type Prospect,
} from '../src/engine/recruiting.js';
import { makeRng } from '../src/engine/rng.js';
import { resetNames } from '../src/engine/players.js';
import { createSeason } from '../src/engine/season.js';
import { seedRivalInterest } from '../src/state/store.js';
import { CONFERENCES, type Region } from '../src/data/schools.js';

// Names are unique for the life of the process, so a second call to
// generateClass with a given seed does not produce the class the first one did:
// different names mean different ids, and ids are what the scouting noise
// hashes. Without this reset every test in this file quietly depends on its own
// position in the file, and a change anywhere upstream reshuffles what each one
// is actually asserting about.
beforeEach(resetNames);

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
    // The same snapshot the store hands the real weekly loop, so the window
    // here runs under the same rules — including walking away from a recruit
    // somebody else has already put clear of the field.
    const atWeekStart = leadersAtWeekStart(recruits);
    programs.forEach((pitch, team) => {
      for (const { prospect, actions } of aiTargets(team, pitch, 45, recruits.prospects, 8, rng, atWeekStart)) {
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

  it('pays a trained recruiter more for the same hours, on the effort half only', () => {
    // The recruiting skill multiplies what the staff spends pitching — never
    // the passive share, which accrues for being a good match whether or not
    // the coach ever picks up a phone. At the cap it is worth just under
    // twenty percent, about half the span of the prestige lever.
    const { prospects } = generateClass(2027, 16, makeRng(9));
    const p = prospects[0] as Prospect;
    const pitch = program(0.7);

    const base = weeklyPoints(p, pitch, 6, 45);
    const trained = weeklyPoints(p, pitch, 6, 45, 99);
    const passive = fit(p, pitch) * 2.2;

    // The default skill of 20 is exactly neutral.
    expect(weeklyPoints(p, pitch, 6, 45, 20)).toBeCloseTo(base, 9);
    // And 99 scales the pitched share by 1 + 79/400.
    expect((trained - passive) / (base - passive)).toBeCloseTo(1.1975, 3);
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

  it('points an elite program\'s board at the top of the class', () => {
    // A five star program has no tier to reach into, so its board *is* the top
    // of the class — the generic reach/core/safe ladder pointed slots at an
    // empty band above it and left the best recruits under-chased.
    const rng = makeRng(99);
    const recruits = generateClass(2027, 16, rng);
    const board = aiTargets(0, program(0.9), 45, recruits.prospects, 8, rng);
    const elite = board.filter((b) => b.prospect.stars >= 4).length;
    expect(elite).toBeGreaterThanOrEqual(board.length / 2);
  });
});

describe('the seeded board the player walks into', () => {
  // The full store path: a real 96 program world, seeded exactly as the window
  // opens. Reported from testing: "many of the recruits end up with nobody on
  // him when they are even high ranking" — at its worst, nearly half the five
  // stars and the number one player in the country opened with zero suitors.
  it('leaves no meaningful part of the top of the class unchased', () => {
    const season = createSeason(makeRng(12345), undefined, CONFERENCES);
    seedRivalInterest(season, 0);

    const prospects = season.recruiting.prospects;
    const suitorsOf = (p: Prospect): number =>
      Object.values(p.points).filter((v) => v > 0).length;
    const covered = (stars: number): number => {
      const tier = prospects.filter((p) => p.stars === stars);
      return tier.filter((p) => suitorsOf(p) > 0).length / Math.max(1, tier.length);
    };

    // Blue chips essentially always have somebody on them...
    expect(covered(5)).toBeGreaterThan(0.98);
    expect(covered(4)).toBeGreaterThan(0.98);
    // ...and coverage thins as the talent does. Not mean suitor count — three
    // stars are chased by programs of every tier, so they carry the biggest
    // crowds — but whether anybody is on you at all tracks what you are. The
    // gap at the bottom is deliberate: an unchased one star is Tuesday.
    expect(covered(4)).toBeGreaterThanOrEqual(covered(2));
    expect(covered(2)).toBeGreaterThan(covered(1));
    expect(covered(1)).toBeLessThan(0.95);

    // Nobody in the national top fifty is sitting by a silent phone.
    const top = [...prospects].sort((a, b) => a.rank - b.rank).slice(0, 50);
    expect(top.filter((p) => suitorsOf(p) === 0).length).toBe(0);
  });

  it('still finds suitors for the four stars the reach gate narrowed', () => {
    // The interaction the reach retune risks. Two thirds of four stars will not
    // hear from a three star program any more, which leaves the fourteen elite
    // programs as their entire market — and if that market is too small to cover
    // the band, the tightening has simply moved the "nobody is on him" failure
    // down one tier instead of fixing anything.
    const season = createSeason(makeRng(2468), undefined, CONFERENCES);
    seedRivalInterest(season, 0);

    const suitorsOf = (p: Prospect): number =>
      Object.values(p.points).filter((v) => v > 0).length;
    const fours = season.recruiting.prospects.filter((p) => p.stars === 4);
    const eliteOnly = fours.filter((p) => p.minProgram >= 4);

    // The gate really is shut on most of them...
    expect(eliteOnly.length).toBeGreaterThan(fours.length / 3);
    // ...and every one of them still has somebody in the conversation.
    expect(eliteOnly.filter((p) => suitorsOf(p) === 0).length).toBe(0);
  });
});

describe('a class reads in ranking order', () => {
  // Reported from testing: "in the class review, the players should be organized
  // in the ranking order." Both class lists print #rank on every row and then
  // sorted on stars, which puts a hundred and twenty players in one bucket and
  // leaves their order to however the array came out.

  it('puts the best in the country first', () => {
    const { prospects } = generateClass(2027, 32, makeRng(818));
    const someClass = prospects.filter((_, i) => i % 17 === 0).slice(0, 12);
    const sorted = [...someClass].sort(byRank);

    expect(sorted.map((p) => p.rank)).toEqual(
      [...someClass.map((p) => p.rank)].sort((a, b) => a - b),
    );
    // And it is genuinely a re-ordering, not the input handed back.
    expect(sorted[0]?.rank).toBeLessThan(sorted[sorted.length - 1]?.rank as number);
  });

  it('does not fall back to stars, which was the bug', () => {
    // The load-bearing case: a lower graded recruit who is ranked higher belongs
    // above the four star, because the rank is the number on the row.
    const { prospects } = generateClass(2027, 32, makeRng(818));
    const a = { ...prospects[0], rank: 9, stars: 3 } as Prospect;
    const b = { ...prospects[1], rank: 140, stars: 4 } as Prospect;
    expect([b, a].sort(byRank).map((p) => p.rank)).toEqual([9, 140]);
  });

  it('sorts an unranked recruit last and breaks ties the same way twice', () => {
    // A save written before ranks existed carries a zero for everybody. Zero
    // must not read as "best in the country", and equal keys must not reshuffle
    // between renders.
    const { prospects } = generateClass(2027, 32, makeRng(818));
    const unranked = { ...prospects[0], rank: 0, stars: 5 } as Prospect;
    const ranked = { ...prospects[1], rank: 300, stars: 1 } as Prospect;
    expect([unranked, ranked].sort(byRank)[0]?.rank).toBe(300);

    const tied = [3, 1, 2].map((i) => ({
      ...prospects[i], rank: 0, stars: 3,
    } as Prospect));
    const once = [...tied].sort(byRank).map((p) => p.player.name);
    const again = [...tied].reverse().sort(byRank).map((p) => p.player.name);
    expect(again).toEqual(once);
  });

  it('is the comparator both class screens actually use', () => {
    // The point of exporting it. The board's COMMITS tab and the signing day
    // report show the same eight names with the same #rank beside each of them,
    // so two hand-written sorts is two chances for them to disagree and make one
    // of the screens look broken.
    const screens = ['../src/ui/screens/Board.tsx', '../src/ui/screens/SigningDay.tsx'];
    for (const rel of screens) {
      const src = readFileSync(join(import.meta.dirname, rel), 'utf8');
      expect(src, `${rel} does not import byRank`).toContain('byRank');
      expect(src.includes('sort(byRank)'), `${rel} sorts a class some other way`).toBe(true);
    }
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

  it('only lets a four or five star program work the whole board', () => {
    // The line the user drew: "only 4 and 5 stars are actually able to reach all
    // players, from 3 and down should all have some caps based on their
    // prestige." Everything below four is capped, and the cap tightens all the
    // way down rather than only biting at the top of the class.
    const { prospects } = generateClass(2027, 64, makeRng(4242));
    const share = (tier: number) =>
      prospects.filter((p) => canPursue(p, tier)).length / prospects.length;

    expect(share(5)).toBe(1);
    expect(share(4)).toBe(1);
    expect(share(3)).toBeLessThan(1);
    expect(share(3)).toBeGreaterThan(share(2));
    expect(share(2)).toBeGreaterThan(share(1));

    // The specific hole this closed: a three star program could pursue *every*
    // four star in the country, so the only rung the gate ever cost anybody was
    // the five stars.
    const fours = prospects.filter((p) => p.stars === 4);
    expect(fours.length).toBeGreaterThan(40);
    expect(fours.filter((p) => canPursue(p, 3)).length).toBeLessThan(fours.length * 0.6);
  });

  it('keeps the top of the national board away from a three star program', () => {
    // The complaint this retune answers: "I as a three star college have access
    // to the very top players." The top fifty is only about half five stars, and
    // the old gate tightened for five stars alone — so every four star in the
    // country was open and a three star program could pursue nearly half of the
    // national top fifty. A handful is the drama; half is a broken ladder.
    const { prospects } = generateClass(2027, 64, makeRng(4242));
    const top = [...prospects].sort(byRank).slice(0, 50);

    const openAt = (tier: number) => top.filter((p) => canPursue(p, tier)).length;
    expect(openAt(5)).toBe(50);
    expect(openAt(4)).toBe(50);
    // Seventeen of the top fifty on this fixture before, eight after. A dozen is
    // the line: below it the top of the board is a reach, above it it is a menu.
    expect(openAt(3)).toBeLessThan(12);
    // The bottom of the ladder stays shut out of the top of the board outright,
    // which was already true and is the half of "caps based on their prestige"
    // that has to be a wall rather than a slope.
    expect(openAt(2)).toBeLessThanOrEqual(1);
    expect(openAt(1)).toBeLessThanOrEqual(1);
  });

  it('leaves a small program a class to sign out of what it can reach', () => {
    // The other side of the gate. A board that is mostly locked rows is a
    // screen that says no eight times and offers nothing, so every tier has to
    // keep a pool far larger than the eight scholarships it can fill.
    const { prospects } = generateClass(2027, 64, makeRng(4242));
    for (const tier of [1, 2, 3]) {
      const open = prospects.filter((p) => canPursue(p, tier));
      expect(open.length / prospects.length,
        `a ${tier} star program's board was mostly locked`).toBeGreaterThan(0.5);
    }
  });

  it('still sends somebody after the four stars it just shut three star programs out of', () => {
    // The risk the retune carries. Two thirds of four stars will not hear from a
    // three star program now, which leaves the elite programs as their entire
    // market — and a prospect nobody may chase is worse than a prospect anybody
    // may chase. The AI's board plans lean into the four star band to pay for it.
    const rng = makeRng(99);
    const recruits = generateClass(2027, 64, rng);
    const elite = program(0.9);
    const strong = program(0.65);

    const foursOn = (pitch: Pitch) =>
      aiTargets(0, pitch, 45, recruits.prospects, 8, rng)
        .filter((b) => b.prospect.stars === 4).length;

    // One more slot apiece than the boards carried before the gate moved.
    expect(foursOn(elite)).toBeGreaterThanOrEqual(3);
    expect(foursOn(strong)).toBeGreaterThanOrEqual(4);
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

describe('the price of a top recruit', () => {
  it('scales with what he is', () => {
    // Flat across the board meant a five star cost exactly what a two star did,
    // so any program allowed to chase the top of the class simply took it —
    // reported from testing as landing the number one recruit three years
    // running without trying.
    expect(commitPointsFor(5)).toBeGreaterThan(commitPointsFor(2) * 2);
    expect(commitPointsFor(4)).toBeGreaterThan(commitPointsFor(3));
    expect(commitPointsFor(3)).toBeGreaterThan(commitPointsFor(2));
    // Below three stars nothing changes: those recruits were never the problem.
    expect(commitPointsFor(1)).toBe(commitPointsFor(2));
  });

  it('gives a better program a bigger budget, but not a decisive one', () => {
    expect(budgetFor(1)).toBe(RECRUITING_BUDGET);
    expect(budgetFor(5)).toBeGreaterThan(budgetFor(1));
    // Prestige buys attention, not the class outright.
    expect(budgetFor(5)).toBeLessThan(budgetFor(1) * 2);
  });
});
