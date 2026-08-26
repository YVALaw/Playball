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
  generateClass, aiTargets, closeWeek, resetWeeklySpend, weeklyPoints, fit,
  canPursue, inPipeline, reachFloor,
  leadersAtWeekStart, byRank,
  PRIORITIES, RECRUITING_WEEKS, SCHOLARSHIPS, RECRUITING_BUDGET, MAX_PER_RECRUIT,
  commitPointsFor, budgetFor, weeklyBudget, windowBudget,
  reportWidth, reportGradeSteps, reportedOverall, reportedPotential, reportedTool,
  hintsFor, ceilingLinesFor, developmentLinesFor, rawnessOf,
  CEILING_LINES, DEVELOPMENT_LINES,
  type Pitch, type Prospect, type Rawness,
} from '../src/engine/recruiting.js';
import {
  GRADE_LADDER, potentialGrade, GENERATED_POTENTIAL_CAP, TOP_GENERATED_GRADE,
  type PotentialGrade,
} from '../src/engine/scouting.js';
import { makeHitter, makePitcher } from '../src/engine/players.js';
import { overallOf } from '../src/engine/ratings.js';
import { makeRng } from '../src/engine/rng.js';
import { resetNames } from '../src/engine/players.js';
import { createSeason } from '../src/engine/season.js';
import { seedRivalInterest } from '../src/state/store.js';
import { ALL_STATES, CONFERENCES, type Region } from '../src/data/schools.js';
import {
  pinnedAction, matchesFilters, anyFilter, NO_FILTERS, ROW_CAP,
} from '../src/ui/screens/Board.js';

// Names are unique for the life of the process, so a second call to
// generateClass with a given seed does not produce the class the first one did.
// The mechanism is the rejection loop in `uniqueName`: a name already taken
// costs two extra draws, and everything downstream of them lands somewhere else
// — every rating in the class, and the stream position each man's id is read
// from, which is in turn what the scouting noise hashes. Without this reset
// every test in this file quietly depends on its own position in the file, and a
// change anywhere upstream reshuffles what each one is actually asserting about.
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
      const pitch = LADDER[team] as Pitch;
      const board = aiTargets(team, pitch, 45, recruits.prospects, 9, rng);
      expect(board.length).toBeLessThanOrEqual(SCHOLARSHIPS);
      for (const b of board) expect(b.actions).toBeLessThanOrEqual(MAX_PER_RECRUIT);
      const spent = board.reduce((a, b) => a + b.actions, 0);
      // The program's own week, not the flat forty. `aiTargets` reads
      // `weeklyBudget` now, so a five star program legitimately has fifty to
      // spend and the old constant would have failed it for being rich.
      expect(spent).toBeLessThanOrEqual(budgetFor(pitch.stars) + board.length);
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

  it('finds suitors for the five stars only the top two tiers can call', () => {
    // The band the gate narrows most. A five star hears from a four star
    // program and up, plus whoever happens to be in his own state — so the
    // fourteen or so elite programs are very nearly his whole market, and if
    // that market is too small to cover the band the gate has simply moved the
    // "nobody is on him" failure up one tier instead of fixing anything.
    //
    // This used to be the four star band, back when a three star program could
    // not call two thirds of it. The one-star-up rule opened that band to every
    // three star program in the league, which is most of them; five stars are
    // where the squeeze lives now.
    const season = createSeason(makeRng(2468), undefined, CONFERENCES);
    seedRivalInterest(season, 0);

    const suitorsOf = (p: Prospect): number =>
      Object.values(p.points).filter((v) => v > 0).length;
    const fives = season.recruiting.prospects.filter((p) => p.stars === 5);

    expect(fives.length).toBeGreaterThan(20);
    for (const p of fives) expect(canPursue(p, 3)).toBe(false);
    expect(fives.filter((p) => suitorsOf(p) === 0).length).toBe(0);
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

describe('a program reaches one star above itself, and one more at home', () => {
  /*
    The rule this replaced, and why there is only one of them now.

    There used to be a per-recruit floor drawn off how badly a prospect wanted
    playing time or home — a measured, tuned thing, and invisible. It has been
    replaced rather than layered under the new rule, because the two disagreed
    in both directions: the old ladder let a flexible five star hear out a three
    star program that the new rule refuses, and let a rigid four star refuse a
    three star program that the new rule admits. Two gates that disagree is a
    worse thing than either alone, and between a hidden roll and a ladder a
    coach can read off the screen, the readable one has to win.

    What is measured here is the whole of it: floor by grade, the pipeline
    exception, and the invariant the old gate existed for — a three star program
    cannot reach the top of the national board.
  */

  /** One recruit of each grade, in the state the fixtures call home. */
  const gradedClass = () => {
    resetNames();
    return generateClass(2027, 96, makeRng(4242)).prospects;
  };

  it('lets a program call one grade up and refuses two', () => {
    const prospects = gradedClass();
    const at = (stars: number) => prospects.find((p) => p.stars === stars) as Prospect;

    // The table is the rule, written out. Rows are program tiers, columns the
    // best grade of recruit that tier may call with no pipeline in play.
    const ceiling: Record<number, number> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 5 };
    for (const tier of [1, 2, 3, 4, 5]) {
      for (const stars of [1, 2, 3, 4, 5]) {
        expect(
          canPursue(at(stars), tier),
          `a ${tier} star program and a ${stars} star recruit`,
        ).toBe(stars <= (ceiling[tier] as number));
      }
    }
  });

  it('adds exactly one more grade inside the program\'s own state', () => {
    const prospects = gradedClass();
    const at = (stars: number) => prospects.find((p) => p.stars === stars) as Prospect;

    // His words: "a 2 star school can shoot for a pipeline 4 star, a 1 star
    // school can shoot for a 3 star pipeline player."
    const ceiling: Record<number, number> = { 1: 3, 2: 4, 3: 5, 4: 5, 5: 5 };
    for (const tier of [1, 2, 3, 4, 5]) {
      for (const stars of [1, 2, 3, 4, 5]) {
        const home = at(stars).state;
        expect(
          canPursue(at(stars), tier, inPipeline(at(stars), home)),
          `a ${tier} star program and a home state ${stars} star`,
        ).toBe(stars <= (ceiling[tier] as number));
      }
    }
  });

  it('gives the pipeline to the recruit\'s state and nowhere else', () => {
    const prospects = gradedClass();
    const five = prospects.find((p) => p.stars === 5) as Prospect;
    const elsewhere = ALL_STATES.find((s) => s !== five.state) as string;

    expect(inPipeline(five, five.state)).toBe(true);
    expect(inPipeline(five, elsewhere)).toBe(false);
    // The region is not the pipeline. Four states and an eighth of the country
    // would make the exception the rule.
    expect(canPursue(five, 3, inPipeline(five, five.state))).toBe(true);
    expect(canPursue(five, 3, inPipeline(five, elsewhere))).toBe(false);
  });

  it('does not read the floor stored on an old save', () => {
    // `minProgram` was drawn per recruit under the ladder this replaced, and a
    // dynasty saved then still carries those numbers. The gate reads his star
    // rating instead, so one rule runs whatever the save remembers.
    const prospects = gradedClass();
    const five = { ...prospects.find((p) => p.stars === 5) as Prospect, minProgram: 1 };
    expect(canPursue(five, 1)).toBe(false);
    expect(canPursue(five, 3)).toBe(false);
    expect(canPursue(five, 4)).toBe(true);

    const two = { ...prospects.find((p) => p.stars === 2) as Prospect, minProgram: 5 };
    expect(canPursue(two, 1)).toBe(true);
  });

  it('writes the floor it actually uses onto every prospect', () => {
    // The board prints it, so it has to be the same number the gate applies.
    for (const p of gradedClass()) {
      expect(p.minProgram).toBe(reachFloor(p.stars));
      expect(canPursue(p, p.minProgram)).toBe(true);
      expect(canPursue(p, p.minProgram - 1)).toBe(false);
    }
  });

  it('keeps the top of the national board out of a three star program\'s reach', () => {
    /*
      The invariant the whole gate exists for, measured the way the retune it
      replaces was measured: across twenty four classes rather than one, because
      the top fifty is a sample of fifty and the count swings by five either way
      on the draw. A threshold read off a single seed records which board came
      up that day.

      Measured here: the top fifty is 80% five stars, and a three star program
      opens **9.8 of it on average** — every one of them a four star — against a
      mean of about twelve under the ladder this replaced. The top twenty five
      is zero in all twenty four classes, which is stronger than the old gate
      managed: it let a handful of the top ten through in a good year.
    */
    const CLASSES = 24;
    const tens: number[] = [];
    const twentyFives: number[] = [];
    const fifties: number[] = [];
    let fivesOpenToThree = 0;

    for (let i = 0; i < CLASSES; i++) {
      resetNames();
      const { prospects } = generateClass(2027, 96, makeRng(4242 + i * 7919));
      const ranked = [...prospects].sort(byRank);
      tens.push(ranked.slice(0, 10).filter((p) => canPursue(p, 3)).length);
      twentyFives.push(ranked.slice(0, 25).filter((p) => canPursue(p, 3)).length);
      const open = ranked.slice(0, 50).filter((p) => canPursue(p, 3));
      fifties.push(open.length);
      fivesOpenToThree += open.filter((p) => p.stars === 5).length;
    }
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

    for (const n of tens) expect(n).toBe(0);
    for (const n of twentyFives) expect(n).toBe(0);
    expect(mean(fifties)).toBeLessThan(14);
    // Not one of them, ever. The four stars in the top fifty are the whole of
    // what a three star program can call, and the rule says so exactly.
    expect(fivesOpenToThree).toBe(0);
  });

  it('shuts the bottom of the ladder out of the top of the board entirely', () => {
    const SEEDS = [4242, 101, 202, 303, 404, 505, 606, 707];
    for (const seed of SEEDS) {
      resetNames();
      const { prospects } = generateClass(2027, 64, makeRng(seed));
      const top = [...prospects].sort(byRank).slice(0, 50);
      expect(top.filter((p) => canPursue(p, 1)).length).toBe(0);
      expect(top.filter((p) => canPursue(p, 2)).length).toBe(0);
      // And the top two tiers work the whole of it, which is the other half of
      // the rule: "4 and 5 star schools can go for anyone they like."
      expect(top.filter((p) => canPursue(p, 4)).length).toBe(50);
      expect(top.filter((p) => canPursue(p, 5)).length).toBe(50);
    }
  });

  it('leaves the pipeline as the one door into the top of the class', () => {
    // A small program is not shut out of blue chips, it is shut out of *other
    // people's* blue chips. About one state in three has no five star in a
    // given year and the rest have one or two, so the door is real and narrow.
    let withDoor = 0;
    let states = 0;
    for (let i = 0; i < 8; i++) {
      resetNames();
      const { prospects } = generateClass(2027, 96, makeRng(4242 + i * 7919));
      for (const st of new Set(prospects.map((p) => p.state))) {
        states += 1;
        const reachable = prospects.filter(
          (p) => p.stars === 5 && canPursue(p, 3, inPipeline(p, st)),
        );
        if (reachable.length > 0) withDoor += 1;
      }
    }
    expect(withDoor / states).toBeGreaterThan(0.4);
    expect(withDoor / states).toBeLessThan(0.9);
  });

  it('never leaves a program with nobody to recruit', () => {
    const { prospects } = generateClass(2027, 64, makeRng(4242));
    for (const tier of [1, 2, 3, 4, 5]) {
      const open = prospects.filter((p) => canPursue(p, tier));
      expect(open.length, `a ${tier} star program had nothing to chase`).toBeGreaterThan(200);
    }
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
    // And the ceiling still tightens all the way down rather than only biting
    // at the top of the class.
    const share = (tier: number) =>
      prospects.filter((p) => canPursue(p, tier)).length / prospects.length;
    expect(share(5)).toBe(1);
    expect(share(4)).toBe(1);
    expect(share(3)).toBeLessThan(1);
    expect(share(3)).toBeGreaterThan(share(2));
    expect(share(2)).toBeGreaterThan(share(1));
  });

  it('holds the AI to the same gate, pipeline included', () => {
    const rng = makeRng(99);
    const recruits = generateClass(2027, 64, rng);
    for (const [prestige, tier] of [[0.15, 1], [0.42, 2], [0.5, 3]] as const) {
      const small = program(prestige, { playingTime: () => 0.9, state: 'TX' });
      expect(small.stars).toBe(tier);
      for (const { prospect } of aiTargets(0, small, 45, recruits.prospects, 8, rng)) {
        expect(
          canPursue(prospect, tier, inPipeline(prospect, small.state)),
          `a ${tier} star program put a board slot on a ${prospect.stars} star from ${prospect.state}`,
        ).toBe(true);
      }
    }
  });

  it('sends a small program after the blue chip in its own back yard', () => {
    // The pipeline is not the user's private exception. A program whose home
    // state holds a five star should have him on its board, or the door only
    // ever opens for the human.
    const rng = makeRng(7);
    const recruits = generateClass(2027, 96, rng);
    const home = [...new Set(recruits.prospects.map((p) => p.state))]
      .find((st) => recruits.prospects.some((p) => p.stars === 5 && p.state === st)) as string;
    const small = program(0.5, { state: home, region: 'Gulf' });
    expect(small.stars).toBe(3);

    const board = aiTargets(0, small, 45, recruits.prospects, 8, rng);
    expect(board.some((b) => b.prospect.stars === 5)).toBe(true);
    for (const { prospect } of board) {
      if (prospect.stars === 5) expect(prospect.state).toBe(home);
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

// ---------------------------------------------------------------------------
// The week the other ninety five programs work with
// ---------------------------------------------------------------------------

/*
  The asymmetry this closes was the blocker under the whole retention mechanic,
  and it was quiet: `aiTargets` allocated a flat forty actions regardless of what
  the program was, while the user's week came off `budgetFor(stars)` and had
  whatever he spent in June taken out of it. So a computer program's budget was
  a number nothing could touch — which meant handing it a way to spend money on
  keeping players would have been handing it money it never had to find.
*/
describe('the AI works off the same week the user does', () => {
  const total = (board: { actions: number }[]): number =>
    board.reduce((a, b) => a + b.actions, 0);

  /** One week's allocation for a program of this tier, on a full class. */
  const weekFor = (stars: number, spentInJune = 0) => {
    const rng = makeRng(77);
    const recruits = generateClass(2027, 16, rng);
    recruits.week = 1;
    // A pitch whose prestige is the tier's, so `canPursue` gates it honestly.
    const prestige = stars >= 5 ? 0.8 : stars >= 4 ? 0.65 : stars >= 3 ? 0.52
      : stars >= 2 ? 0.42 : 0.3;
    return aiTargets(
      0, program(prestige), 45, recruits.prospects, 8, rng, {}, spentInJune,
    );
  };

  it('gives a blue blood a bigger week than a nobody', () => {
    const small = total(weekFor(1));
    const big = total(weekFor(5));
    expect(small).toBeLessThanOrEqual(budgetFor(1));
    expect(big).toBeLessThanOrEqual(budgetFor(5));
    // The gap is the whole point: a flat constant made these identical.
    expect(big).toBeGreaterThan(small);
  });

  it('never spends more in a week than the program has', () => {
    for (const stars of [1, 2, 3, 4, 5]) {
      expect(total(weekFor(stars)), `a ${stars} star program overspent`)
        .toBeLessThanOrEqual(budgetFor(stars));
    }
  });

  it('is thinner for three weeks after a program spends in June', () => {
    // The same rule the user's header prints: what the draft took comes off
    // every week evenly rather than shutting week one and leaving the rest
    // untouched, so keeping an ace cannot be recovered by waiting.
    const june = 60;
    const before = total(weekFor(5));
    const after = total(weekFor(5, june));
    expect(after).toBeLessThan(before);
    expect(after).toBeLessThanOrEqual(weeklyBudget(5, june));
    // And it is a third of the bill each week, not the whole bill at once.
    expect(weeklyBudget(5, june) * RECRUITING_WEEKS)
      .toBeGreaterThanOrEqual(windowBudget(5) - june - RECRUITING_WEEKS);
  });

  it('leaves a program that spent its whole window with nothing to work with', () => {
    expect(total(weekFor(3, windowBudget(3)))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The report, which is not the truth
// ---------------------------------------------------------------------------

/*
  The board used to print an exact overall and an exact ceiling letter. Free, and
  right, so there was nothing to scout and signing day could not surprise anybody.
  What replaced it is a band whose width is the coach's recruiting skill and
  nothing else, plus two lines of prose that narrow the field without settling it.

  Four properties have to hold together or the feature is worthless, and each
  fails in a different, quiet way:

  - He is always inside the band, or the estimate is a lie rather than a guess.
  - The band narrows with skill, or the coach points bought nothing.
  - He is not in the middle of it, or the midpoint is an exact number in disguise.
  - No line is ever false, and no line pins down a grade on its own.
*/

/** One national class, the size the real game builds. */
const nationalClass = (seed = 12345): Prospect[] => {
  resetNames();
  return generateClass(2027, 96, makeRng(seed)).prospects;
};

const gradeIndex = (g: PotentialGrade): number => GRADE_LADDER.indexOf(g);

const RAWNESS: Rawness[] = ['finished', 'close', 'raw', 'project'];

describe('a scouting report is a band, not a number', () => {
  it('always has him inside it, at every level of skill', () => {
    // The one property with no give in it. A band that misses is not a vague
    // report, it is a wrong one, and it would make the class review read as a
    // bug the first time a recruit came out above what the screen said he could
    // possibly be.
    const prospects = nationalClass();
    for (const skill of [20, 33, 47, 60, 74, 88, 99]) {
      for (const p of prospects) {
        const band = reportedOverall(p, skill);
        const truth = overallOf(p.player);
        expect(truth, `${p.player.name} overall at recruiting ${skill}`)
          .toBeGreaterThanOrEqual(band.low);
        expect(truth, `${p.player.name} overall at recruiting ${skill}`)
          .toBeLessThanOrEqual(band.high);

        const ceiling = reportedPotential(p, skill);
        const grade = gradeIndex(potentialGrade(p.player.potential));
        expect(grade, `${p.player.name} ceiling at recruiting ${skill}`)
          .toBeGreaterThanOrEqual(gradeIndex(ceiling.low));
        expect(grade, `${p.player.name} ceiling at recruiting ${skill}`)
          .toBeLessThanOrEqual(gradeIndex(ceiling.high));
      }
    }
  });

  it('holds a tool inside its band too, so the sheet cannot be averaged out', () => {
    // Six independently placed tool bands would let a player average the
    // midpoints and recover the truth to a third of the width he was supposed
    // to be stuck with. They share one bias, which also has to keep every tool
    // honestly bracketed.
    const prospects = nationalClass();
    for (const p of prospects.slice(0, 200)) {
      const player = p.player;
      const tools = player.type === 'pitcher'
        ? [player.stuff, player.movement, player.control, player.stamina]
        : [player.contact, player.power, player.eye, player.speed];
      for (const tool of tools) {
        const band = reportedTool(p, tool, 45);
        expect(tool).toBeGreaterThanOrEqual(band.low);
        expect(tool).toBeLessThanOrEqual(band.high);
      }
    }
  });

  it('narrows every single point of recruiting skill, and never widens', () => {
    let previous = Infinity;
    for (let skill = 20; skill <= 99; skill++) {
      const width = reportWidth(skill);
      expect(width, `recruiting ${skill}`).toBeLessThan(previous);
      previous = width;
    }

    // The payoff has to be visible, not statistical: thirty rating points of
    // daylight on your first day and six at the top of the profession.
    expect(Math.round(reportWidth(20))).toBe(30);
    expect(Math.round(reportWidth(40))).toBe(24);
    expect(Math.round(reportWidth(60))).toBe(18);
    expect(Math.round(reportWidth(99))).toBe(6);

    // Ceilings the same way — four letters of a six letter scale down to two.
    expect(reportGradeSteps(20)).toBe(3);
    expect(reportGradeSteps(60)).toBe(2);
    expect(reportGradeSteps(99)).toBe(1);
    // Never one letter. A single grade is an exact answer, and the ceiling is
    // the thing nobody is ever allowed to be certain about.
    for (let skill = 20; skill <= 99; skill++) {
      expect(reportGradeSteps(skill), `recruiting ${skill}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('shows one width for the whole board, so the width means only one thing', () => {
    // Not per recruit and not per star rating. If a band narrowed for a five
    // star, its width would be telling you about *him* rather than about you —
    // and the top of the class would be quietly easier to read than the bottom,
    // which is the opposite of where the value of scouting is.
    const prospects = nationalClass();
    for (const skill of [20, 45, 70, 99]) {
      const widths = new Set(
        prospects.map((p) => {
          const band = reportedOverall(p, skill);
          return band.high - band.low;
        }),
      );
      expect(widths.size, `recruiting ${skill} produced ${[...widths].join(', ')}`).toBe(1);
    }
  });

  it('does not sit him in the middle, which would be an exact number in disguise', () => {
    const prospects = nationalClass();
    for (const skill of [20, 40, 60, 99]) {
      const where = prospects.map((p) => {
        const band = reportedOverall(p, skill);
        return (overallOf(p.player) - band.low) / (band.high - band.low);
      });

      // A centred band would put all of them in the middle fifth; an even
      // scatter would put a fifth of them there. Fewer than that land there,
      // because the draw bows away from the centre on purpose.
      const middle = where.filter((f) => Math.abs(f - 0.5) < 0.1).length / where.length;
      expect(middle, `recruiting ${skill}`).toBeLessThan(0.15);

      // So reading the midpoint is wrong by a real fraction of the band.
      const off = where.reduce((a, f) => a + Math.abs(f - 0.5), 0) / where.length;
      expect(off, `recruiting ${skill}`).toBeGreaterThan(0.22);

      // Unbiased, though. Unreadable is the goal, not consistently high or low
      // — a band you knew leaned one way is a band you can correct for.
      const mean = where.reduce((a, f) => a + f, 0) / where.length;
      expect(Math.abs(mean - 0.5), `recruiting ${skill}`).toBeLessThan(0.04);
    }
  });

  it('does not sit him in the middle of his ceiling band either', () => {
    // Three letters wide at this skill, so a band that centred him would say
    // the middle one every time and the other two would be decoration.
    const prospects = nationalClass();
    const middle = prospects.filter((p) => {
      const band = reportedPotential(p, 60);
      return gradeIndex(potentialGrade(p.player.potential)) - gradeIndex(band.low) === 1;
    }).length / prospects.length;
    expect(reportGradeSteps(60)).toBe(2);
    expect(middle).toBeLessThan(0.45);
  });

  it('says the same thing every time it is asked, and after a reload', () => {
    // Drawn at render time this would flicker on every React pass, which reads
    // as the screen being broken rather than as uncertainty. It is hashed out
    // of the recruit's id, which is the one thing the save actually carries.
    const first = nationalClass();
    const second = nationalClass();
    expect(second.map((p) => p.id)).toEqual(first.map((p) => p.id));

    for (let i = 0; i < first.length; i += 7) {
      const a = first[i] as Prospect;
      const b = second[i] as Prospect;
      expect(reportedOverall(b, 55)).toEqual(reportedOverall(a, 55));
      expect(reportedPotential(b, 55)).toEqual(reportedPotential(a, 55));
      expect(hintsFor(a).ceiling.text).toBe(hintsFor(a).ceiling.text);
      expect(hintsFor(b).ceiling.text).toBe(hintsFor(a).ceiling.text);
      expect(hintsFor(b).development.text).toBe(hintsFor(a).development.text);
    }
  });
});

describe('a hint is vague, and never false', () => {
  it('draws every line only for a grade it stays honest at', () => {
    const prospects = nationalClass();
    for (const p of prospects) {
      const { ceiling, development } = hintsFor(p);

      const grade = gradeIndex(potentialGrade(p.player.potential));
      expect(grade, `"${ceiling.text}" about a ${potentialGrade(p.player.potential)}`)
        .toBeGreaterThanOrEqual(gradeIndex(ceiling.from));
      expect(grade, `"${ceiling.text}" about a ${potentialGrade(p.player.potential)}`)
        .toBeLessThanOrEqual(gradeIndex(ceiling.to));

      const band = RAWNESS.indexOf(rawnessOf(p.player));
      expect(band, `"${development.text}" about a ${rawnessOf(p.player)} player`)
        .toBeGreaterThanOrEqual(RAWNESS.indexOf(development.from));
      expect(band).toBeLessThanOrEqual(RAWNESS.indexOf(development.to));
    }
  });

  it('writes no line that belongs to a single grade', () => {
    // The whole system turns on this. A line eligible for exactly one grade is
    // the letter spelled out in words: see it twice, learn what it means, and
    // the band underneath it becomes decoration.
    for (const line of CEILING_LINES) {
      expect(gradeIndex(line.to), line.text).toBeGreaterThan(gradeIndex(line.from));
    }
    for (const line of DEVELOPMENT_LINES) {
      expect(RAWNESS.indexOf(line.to), line.text)
        .toBeGreaterThan(RAWNESS.indexOf(line.from));
    }
  });

  it('lets adjacent grades share, so the same words turn up on different players', () => {
    // Structurally: a line a D can draw is still on the table for an S.
    const modest = ceilingLinesFor('D');
    const elite = ceilingLinesFor('S');
    expect(modest.filter((l) => elite.includes(l)).length).toBeGreaterThan(0);

    // And in a real class it actually happens, rather than being possible in
    // principle: most of the lines that get used are used on more than one
    // grade, so hearing one leaves you genuinely unsure which you are looking at.
    const prospects = nationalClass();
    const heard = new Map<string, Set<PotentialGrade>>();
    for (const p of prospects) {
      const text = hintsFor(p).ceiling.text;
      const grades = heard.get(text) ?? new Set<PotentialGrade>();
      grades.add(potentialGrade(p.player.potential));
      heard.set(text, grades);
    }
    const ambiguous = [...heard.values()].filter((g) => g.size > 1).length;
    expect(heard.size).toBeGreaterThan(20);
    expect(ambiguous).toBeGreaterThan(heard.size / 2);
  });

  it('gives a better ceiling more to say, without taking the quiet lines away', () => {
    // Higher grades draw from a wider pool *and* keep everything underneath, so
    // an understated line on a genuinely special player is honest rather than a
    // bug. That is where a steal comes from.
    expect(ceilingLinesFor('D').length).toBeLessThan(ceilingLinesFor('C').length);
    expect(ceilingLinesFor('C').length).toBeLessThan(ceilingLinesFor('B').length);
    expect(ceilingLinesFor('A').length).toBeGreaterThan(ceilingLinesFor('B').length);
    expect(ceilingLinesFor('S').length).toBeGreaterThan(ceilingLinesFor('B').length);

    // Nothing an ordinary recruit could have had is withheld from a great one.
    for (const line of ceilingLinesFor('D')) {
      if (line.to === 'S+') expect(ceilingLinesFor('S')).toContain(line);
    }

    // And a real class produces the hidden ones: some of the best players in
    // the country get described in words a nobody could have earned.
    const prospects = nationalClass();
    const understated = prospects.filter((p) => {
      const grade = potentialGrade(p.player.potential);
      return (grade === 'A' || grade === 'S' || grade === 'S+')
        && hintsFor(p).ceiling.from === 'D';
    });
    expect(understated.length).toBeGreaterThan(0);
  });

  it('is a big enough pool that the board does not read like a form letter', () => {
    expect(CEILING_LINES.length + DEVELOPMENT_LINES.length).toBeGreaterThanOrEqual(30);
    // Every grade clears the sketch the design started from, comfortably.
    expect(ceilingLinesFor('D').length).toBeGreaterThanOrEqual(2);
    expect(ceilingLinesFor('C').length).toBeGreaterThanOrEqual(4);
    expect(ceilingLinesFor('B').length).toBeGreaterThanOrEqual(4);
    expect(ceilingLinesFor('A').length).toBeGreaterThanOrEqual(5);
    expect(ceilingLinesFor('S').length).toBeGreaterThanOrEqual(8);
    for (const band of RAWNESS) {
      expect(developmentLinesFor(band).length, band).toBeGreaterThanOrEqual(4);
    }
  });

  it('draws the second line on a different fact from the first', () => {
    // Two signals that moved together would be one signal printed twice. How
    // much of a player is still to come is close to independent of how high he
    // can go: every grade the class actually produces contains both finished
    // players and projects, which is what makes reading the pair worth doing.
    const prospects = nationalClass();
    const seen = new Map<PotentialGrade, Set<Rawness>>();
    for (const p of prospects) {
      const grade = potentialGrade(p.player.potential);
      const bands = seen.get(grade) ?? new Set<Rawness>();
      bands.add(rawnessOf(p.player));
      seen.set(grade, bands);
    }
    for (const grade of ['D', 'C', 'B', 'A'] as PotentialGrade[]) {
      expect(seen.get(grade)?.size ?? 0, `${grade} recruits`).toBeGreaterThan(2);
    }
  });
});

describe('the national rank is an opinion, not the answer', () => {
  it('does not hand the truth over in a number printed on every row', () => {
    // The rank was computed straight off `overallOf` and the **true** ceiling
    // with no error in it at all — a perfectly ordered index of the hidden
    // ratings, sitting on every row above a band that was deliberately vague.
    // Sorting by it beat scouting, which made scouting decoration.
    //
    // It carries the projection error the stars carry now, so the truly better
    // player is sometimes ranked below the worse one. Under the old formula
    // that count was exactly zero and could not have been anything else: both
    // halves of the score were the truth, so beating a man on both meant
    // outranking him.
    const prospects = nationalClass();
    let better = 0;
    let outranked = 0;
    for (const a of prospects) {
      for (const b of prospects) {
        if (a === b) continue;
        if (overallOf(a.player) <= overallOf(b.player)) continue;
        if (a.player.potential <= b.player.potential) continue;
        better += 1;
        if (a.rank > b.rank) outranked += 1;
      }
    }
    expect(better).toBeGreaterThan(1000);
    expect(outranked).toBeGreaterThan(100);
  });

  it('agrees with the star rating, because both are the same opinion', () => {
    // The two numbers sit on the same row. A four star ranked above a five star
    // would make one of them look broken, and they used to be cut from
    // different cloth entirely — the stars from a score with an error in it,
    // the rank from the truth.
    const prospects = nationalClass();
    for (let stars = 5; stars >= 2; stars--) {
      const above = prospects.filter((p) => p.stars === stars).map((p) => p.rank);
      const below = prospects.filter((p) => p.stars === stars - 1).map((p) => p.rank);
      if (above.length === 0 || below.length === 0) continue;
      expect(Math.max(...above), `${stars} star against ${stars - 1} star`)
        .toBeLessThan(Math.min(...below));
    }
  });
});

describe('the top of the ladder is reserved', () => {
  // S+ is a store player and nobody else. The gate is on the *number* rather
  // than the letter, because development, the scouting bands and the draft all
  // read the raw ceiling — capping only the grade would be a lie three separate
  // systems could see through. These pin the gate at the one funnel every
  // generated player passes through, so a future store bypass has to be
  // deliberate rather than accidental.

  it('never hands S+ to anybody the world generates', () => {
    let highest = 0;
    let seen = 0;
    for (let c = 0; c < 12; c++) {
      const cls = generateClass(2027 + c, 96, makeRng(31_000 + c * 97));
      for (const p of cls.prospects) {
        highest = Math.max(highest, p.player.potential);
        expect(potentialGrade(p.player.potential)).not.toBe('S+');
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(5000);
    expect(highest).toBeLessThanOrEqual(GENERATED_POTENTIAL_CAP);
  });

  it('holds the cap for walk-ons and rival rosters too, not just recruits', () => {
    // A walk-on is made straight from `makeHitter`/`makePitcher` rather than
    // through a class, so a gate that only knew about recruiting would leak here.
    const rng = makeRng(4242);
    for (let i = 0; i < 3000; i++) {
      const p = i % 2 === 0 ? makeHitter(rng, 95) : makePitcher(rng, 95);
      expect(p.potential).toBeLessThanOrEqual(GENERATED_POTENTIAL_CAP);
    }
  });

  it('keeps S genuinely scarce and A+ merely rare', () => {
    const CLASSES = 20;
    let s = 0;
    let aPlus = 0;
    for (let c = 0; c < CLASSES; c++) {
      for (const p of generateClass(2027 + c, 96, makeRng(77_000 + c * 53)).prospects) {
        const g = potentialGrade(p.player.potential);
        if (g === 'S') s++;
        if (g === 'A+') aPlus++;
      }
    }
    // A couple of men in the country in a year, which is the whole point of the
    // grade. Bounded on both sides: nought would make it decoration.
    expect(s / CLASSES).toBeGreaterThan(1);
    expect(s / CLASSES).toBeLessThan(6);
    // Rare, but findable often enough to be worth scouting for.
    expect(aPlus).toBeGreaterThan(s);
  });

  it('orders the ladder and names the best grade the world can reach', () => {
    expect(GRADE_LADDER.indexOf('A')).toBeLessThan(GRADE_LADDER.indexOf('A+'));
    expect(GRADE_LADDER.indexOf('A+')).toBeLessThan(GRADE_LADDER.indexOf('S'));
    expect(GRADE_LADDER.indexOf('S')).toBeLessThan(GRADE_LADDER.indexOf('S+'));
    // Derived, so it cannot drift away from the cap it describes.
    expect(TOP_GENERATED_GRADE).toBe('S');
    expect(potentialGrade(GENERATED_POTENTIAL_CAP + 1)).toBe('S+');
  });
});

describe('the board screen', () => {
  /*
    The two things on the recruiting board that are decisions rather than
    layout: what the pinned button says, and what the filter panel keeps.

    Both used to be written inline in the JSX, and both went wrong there. The
    button was assembled at two branches of a ternary and the branch that owned
    it came apart from the state it described; the filter was six clauses in a
    closure nobody could hold to its own labels. They are functions now, and
    this is what they promise.
  */

  const board = (over: Partial<Parameters<typeof pinnedAction>[0]> = {}) =>
    pinnedAction({ filtersOpen: false, live: true, week: 1, matches: 0, shown: 0, ...over });

  it('says END WEEK when the filter is closed, and never the filter\'s label', () => {
    // Reported from testing: the advance-week button reading "SHOW THE TOP 50
    // OF 518" where END WEEK belonged. Whatever the board has matched, a closed
    // filter is a week you can end.
    for (const week of [1, 2]) {
      for (const matches of [0, 1, 50, 518]) {
        const a = board({ week, matches, shown: Math.min(matches, 50) });
        expect(a.kind).toBe('end-week');
        expect(a.label).toBe(`END WEEK ${week}`);
        expect(a.label).not.toMatch(/SHOW|MATCH/);
      }
    }
  });

  it('hands the last week over to signing day instead of ending it', () => {
    const a = board({ week: RECRUITING_WEEKS });
    expect(a.kind).toBe('signing-day');
    expect(a.label).toBe('SIGNING DAY');
  });

  it('shows nothing at all once the window has closed', () => {
    expect(board({ live: false }).kind).toBe(null);
    // Except while filtering, which is a thing you can still do on a shut board.
    expect(board({ live: false, filtersOpen: true, matches: 3, shown: 3 }).kind)
      .toBe('close-filter');
  });

  it('counts the class behind the filter, and says when it is capped', () => {
    expect(board({ filtersOpen: true, matches: 518, shown: 50 }).label)
      .toBe('SHOW THE TOP 50 OF 518');
    expect(board({ filtersOpen: true, matches: 518, shown: 518 }).label)
      .toBe('SHOW 518 RECRUITS');
    expect(board({ filtersOpen: true, matches: 1, shown: 1 }).label)
      .toBe('SHOW 1 RECRUIT');
    expect(board({ filtersOpen: true, matches: 0, shown: 0 }).label)
      .toBe('NOBODY MATCHES — BACK TO THE BOARD');
  });

  it('lifts the row cap without changing what the filter caught', () => {
    // Fifty is the default and the whole class is one tap away. The number on
    // the button is what the filter matched either way — the capped count is
    // the wrong one to print, because it reads 50 whatever you do.
    expect(ROW_CAP).toBe(50);
    const capped = board({ filtersOpen: true, matches: 600, shown: ROW_CAP });
    const lifted = board({ filtersOpen: true, matches: 600, shown: 600 });
    expect(capped.label).toContain('600');
    expect(lifted.label).toContain('600');
    expect(capped.label).toContain(String(ROW_CAP));
    expect(lifted.label).not.toContain('TOP');
  });

  describe('each filter narrows to what it claims', () => {
    const classOf = () => {
      resetNames();
      return generateClass(2027, 96, makeRng(4242)).prospects;
    };
    const HOME = 'TX';

    it('keeps everybody when nothing is set', () => {
      const prospects = classOf();
      expect(prospects.filter((p) => matchesFilters(p, NO_FILTERS, HOME, 3)).length)
        .toBe(prospects.length);
      expect(anyFilter(NO_FILTERS)).toBe(false);
    });

    it('narrows to one position and one state', () => {
      const prospects = classOf();
      const byPos = prospects.filter(
        (p) => matchesFilters(p, { ...NO_FILTERS, pos: 'C' }, HOME, 3),
      );
      expect(byPos.length).toBeGreaterThan(0);
      expect(byPos.length).toBeLessThan(prospects.length);
      for (const p of byPos) expect(p.player.pos).toBe('C');

      const byState = prospects.filter(
        (p) => matchesFilters(p, { ...NO_FILTERS, state: 'LA' }, HOME, 3),
      );
      expect(byState.length).toBeGreaterThan(0);
      for (const p of byState) expect(p.state).toBe('LA');
    });

    it('takes more than one star rating at a time', () => {
      const prospects = classOf();
      const only = (stars: number[]) =>
        prospects.filter((p) => matchesFilters(p, { ...NO_FILTERS, stars }, HOME, 3));

      const fours = only([4]);
      const threes = only([3]);
      const both = only([4, 3]);
      expect(fours.length).toBeGreaterThan(0);
      expect(threes.length).toBeGreaterThan(0);
      // A union inside the star filter, not an intersection — which is the one
      // way a multi-select can silently mean the opposite of what it looks like.
      expect(both.length).toBe(fours.length + threes.length);
      for (const p of both) expect([3, 4]).toContain(p.stars);
    });

    it('shows only the program\'s own state for the pipeline', () => {
      const prospects = classOf();
      const home = prospects.filter(
        (p) => matchesFilters(p, { ...NO_FILTERS, pipelineOnly: true }, HOME, 3),
      );
      expect(home.length).toBeGreaterThan(0);
      for (const p of home) expect(p.state).toBe(HOME);
      // And a pipeline four star is in it for a three star program, which the
      // gate would refuse him anywhere else.
      const reach = prospects.filter(
        (p) => matchesFilters(p, { ...NO_FILTERS, pipelineOnly: true, reachOnly: true }, HOME, 3),
      );
      expect(reach.some((p) => p.stars === 5)).toBe(
        prospects.some((p) => p.stars === 5 && p.state === HOME),
      );
    });

    it('shows only the men nobody has called', () => {
      const prospects = classOf();
      // Nobody has spent anything on a fresh class, so put somebody in on two.
      (prospects[0] as Prospect).points[7] = 4;
      (prospects[1] as Prospect).points[7] = 0.0;
      const quiet = prospects.filter(
        (p) => matchesFilters(p, { ...NO_FILTERS, untouchedOnly: true }, HOME, 3),
      );
      expect(quiet.length).toBe(prospects.length - 1);
      expect(quiet).not.toContain(prospects[0]);
      // A zero is not a suitor. A program that took its points back off him is
      // not somebody who is on him.
      expect(quiet).toContain(prospects[1]);
    });

    it('hides the men who will not take the call, and only those', () => {
      const prospects = classOf();
      const reachable = prospects.filter(
        (p) => matchesFilters(p, { ...NO_FILTERS, reachOnly: true }, HOME, 3),
      );
      for (const p of reachable) {
        expect(canPursue(p, 3, inPipeline(p, HOME))).toBe(true);
      }
      const hidden = prospects.filter((p) => !reachable.includes(p));
      expect(hidden.length).toBeGreaterThan(0);
      for (const p of hidden) expect(p.stars).toBe(5);
    });

    it('stacks, so two filters mean both', () => {
      const prospects = classOf();
      const set = { ...NO_FILTERS, pos: 'SP', stars: [3] };
      const got = prospects.filter((p) => matchesFilters(p, set, HOME, 3));
      expect(got.length).toBeGreaterThan(0);
      for (const p of got) {
        expect(p.stars).toBe(3);
        expect(p.player.type).toBe('pitcher');
      }
      expect(anyFilter(set)).toBe(true);
    });
  });
});
