// portal.test.ts
// Both directions, and the hole it leaves behind.
//
// The last of those is the one this file exists for. The portal is the first
// system in the game that can take men *off* a roster in the middle of an
// offseason, and stage 9 already produced the sibling of that bug — a lineup
// that came back with eight men in it because nobody had asked what happens
// when a roster runs out. So the roster-integrity tests here are not
// box-ticking; they are the specific thing most likely to be wrong.

import { describe, it, expect } from 'vitest';
import {
  portalCost, entersPortal, reasonFor, openPortal, makeTheCase, STAR_LINE, portalMarket,
  releaseFrom, signFromPortal, staffWorksPortal, type PortalMan,
} from '../src/engine/portal.js';
import { setMood, squadRanks, SETTLED } from '../src/engine/morale.js';
import { createSeason } from '../src/engine/season.js';
import { fillRosters } from '../src/engine/progression.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { overallOf } from '../src/engine/ratings.js';
import { startersFrom, SPOTS, squad } from '../src/engine/depthChart.js';
import type { Player, Team } from '../src/engine/types.js';

const fresh = () => createSeason(makeRng(4242), undefined, CONFERENCES);

/** A man made unhappy and buried, which is what the portal is for. */
const aggrieved = (team: Team): Player => {
  const man = team.bench.find((p) => p.classYear !== 'SR') ?? team.bench[0]!;
  setMood(man, 4);
  (man as Player & { starts?: number }).starts = 0;
  return man;
};

describe('who leaves', () => {
  it('takes no draw, and answers the same way twice', () => {
    const world = fresh();
    const rng = makeRng(7);
    const before = rng.state?.();
    const p = world.teams[0]!.team.lineup[0]!;
    const at = { squadRank: 1, starts: 40, games: 45, year: 2027, seed: 4242 };
    expect(entersPortal(p, at)).toBe(entersPortal(p, at));
    expect(rng.state?.()).toBe(before);
  });

  it('leaves a happy man who played alone', () => {
    // The property the whole design rests on: a coach who keeps his word does
    // not lose people. If this ever fails the portal has become weather.
    const world = fresh();
    let went = 0;
    let asked = 0;
    for (const rec of world.teams) {
      for (const p of rec.team.lineup) {
        if (p.classYear === 'SR') continue;
        asked++;
        // Everybody at rest: settled mood, started every game, top of the
        // squad. Nobody here has a reason.
        if (entersPortal(p, {
          squadRank: 1, starts: 45, games: 45, year: 2027, seed: 4242,
        })) went++;
      }
    }
    expect(asked).toBeGreaterThan(100);
    expect(went, 'men left a program that had done nothing wrong').toBe(0);
  });

  it('takes a miserable man, and a buried one', () => {
    const world = fresh();
    const team = world.teams[3]!.team;
    const man = aggrieved(team);
    /*
      Sampled across years rather than asserted on one.

      The roll is derived, which makes it *stable* rather than certain: an
      unhappy buried man is about an eighty percent chance of leaving, and one
      particular year being in the other twenty is not a bug. Asserting a single
      year was a test that measured which hash it got.
    */
    let left = 0;
    for (let year = 2027; year < 2037; year++) {
      if (entersPortal(man, { squadRank: 4, starts: 0, games: 45, year, seed: 4242 })) left++;
    }
    expect(left, 'an unhappy, buried man never left in ten years').toBeGreaterThan(5);

    // And a man who is fine but has not played, which is the case college
    // coaches actually lose people to.
    const content = team.bench[1] ?? team.bench[0]!;
    setMood(content, SETTLED);
    let anyBuried = false;
    for (let year = 2027; year < 2040; year++) {
      if (entersPortal(content, { squadRank: 2, starts: 0, games: 45, year, seed: 4242 })) {
        anyBuried = true; break;
      }
    }
    expect(anyBuried, 'a buried man never once looked around').toBe(true);
  });

  it('never takes a senior, or a man who has already moved', () => {
    const world = fresh();
    const team = world.teams[5]!.team;
    const sr = [...team.lineup, ...team.bench].find((p) => p.classYear === 'SR');
    if (sr) {
      setMood(sr, 0);
      expect(entersPortal(sr, {
        squadRank: 9, starts: 0, games: 45, year: 2027, seed: 4242,
      })).toBe(false);
    }
    const moved = aggrieved(team);
    (moved as Player & { transferred?: boolean }).transferred = true;
    expect(entersPortal(moved, {
      squadRank: 9, starts: 0, games: 45, year: 2027, seed: 4242,
    }), 'a man moved twice').toBe(false);
  });

  it('says why, in his terms rather than the model’s', () => {
    const world = fresh();
    const p = world.teams[2]!.team.bench[0]!;
    expect(reasonFor(p, { squadRank: 1, starts: 0, games: 45 }))
      .toBe('He was told he would play.');
    setMood(p, 5);
    expect(reasonFor(p, { squadRank: 18, starts: 45, games: 45 }))
      .toBe('He was not happy here.');
  });
});

describe('the pool', () => {
  it('opens across the whole country, not just for the player', () => {
    // "Both directions or it is not a portal." A pool drawn only from the
    // coached program is a tax; one drawn only from elsewhere is a shop.
    const world = fresh();
    for (const rec of world.teams) {
      for (const p of [...rec.team.lineup, ...rec.team.bench]) {
        if (p.classYear === 'SR') continue;
        setMood(p, 10);
        (p as Player & { starts?: number }).starts = 0;
      }
    }
    const pool = openPortal(world.teams, { year: 2027, seed: 4242, games: 45 });
    const programs = new Set(pool.map((m) => m.from));
    expect(pool.length, 'nobody in the country entered').toBeGreaterThan(20);
    expect(programs.size, 'only one program lost anybody').toBeGreaterThan(10);
  });

  it('costs more for a better man, and is never free', () => {
    const world = fresh();
    const men = world.teams.flatMap((t) => t.team.lineup);
    const best = [...men].sort((a, b) => overallOf(b) - overallOf(a))[0]!;
    const worst = [...men].sort((a, b) => overallOf(a) - overallOf(b))[0]!;
    expect(portalCost(best)).toBeGreaterThan(portalCost(worst));
    expect(portalCost(worst)).toBeGreaterThanOrEqual(8);
  });
});

/*
  Stage 16's balance pass, measured before it was written (carousel probe,
  30 seasons, seed 4242): the developed league carries about fifteen men at
  STAR_LINE, the old model's only star channel was an ace reading squadRank
  twenty -- "he was told he would play" as bookkeeping -- and a proven
  ninety cost seventy-one points against a window of about a hundred and
  seventy. The door: rarer stars (one per five or six winters, the wire's
  event), noisier outcomes, the pool priced against the class.
*/
describe('the balance pass', () => {
  /** A star, made rather than found: a seeded league holds nobody above 82. */
  const starFrom = (team: Team): Player => {
    const man = team.lineup.find((p) => p.classYear !== 'SR') ?? team.lineup[0]!;
    const h = man as Player & {
      contact: number; power: number; eye: number; speed: number;
    };
    h.contact = 99; h.power = 99; h.eye = 99; h.speed = 99;
    expect(overallOf(man)).toBeGreaterThanOrEqual(STAR_LINE);
    return man;
  };

  it('prices a star at the class he would replace', () => {
    const world = fresh();
    const star = starFrom(world.teams[2]!.team);
    // The most a courtship can put on one recruit is thirty-six points; a
    // proven man above the premium line must cost well past that, and a true
    // star most of a whole window -- otherwise the portal out-deals the
    // board it shares a budget with.
    expect(portalCost(star)).toBeGreaterThan(100);
    // While the ordinary shelf stays priced for depth programs to shop.
    const journeyman = world.teams[2]!.team.bench[0]!;
    expect(portalCost(journeyman)).toBeLessThan(60);
  });

  it('keeps a content star out of the pool that bookkeeping used to put him in', () => {
    const world = fresh();
    const star = starFrom(world.teams[4]!.team);
    setMood(star, SETTLED);
    // The exact case of the report: a top man whose promise arithmetic reads
    // "buried" (squadRank twenty, no starts recorded) walked into the portal.
    // Under the star door his settled mood and the wander are all that is
    // left, and the wander is priced at about one entry per five or six
    // winters across the WHOLE league's stars -- so this one man, sampled
    // over thirty winters, goes at most once.
    let went = 0;
    for (let year = 2027; year < 2057; year++) {
      if (entersPortal(star, { squadRank: 20, starts: 0, games: 45, year, seed: 4242 })) went++;
    }
    expect(went).toBeLessThanOrEqual(1);
  });

  it('still loses a genuinely miserable star', () => {
    const world = fresh();
    const star = starFrom(world.teams[6]!.team);
    setMood(star, 2);
    // Stage 9's promises keep their teeth above the line: mood is the one
    // channel the star door leaves at full strength.
    let went = 0;
    for (let year = 2027; year < 2037; year++) {
      if (entersPortal(star, { squadRank: 1, starts: 45, games: 45, year, seed: 4242 })) went++;
    }
    expect(went, 'a miserable star never left in ten winters').toBeGreaterThanOrEqual(3);
  });

  it('runs a different market every winter, and the same market twice', () => {
    const years = Array.from({ length: 12 }, (_, i) => portalMarket(2027 + i, 4242));
    // Derived, so it answers the same way twice.
    expect(portalMarket(2030, 4242)).toBe(portalMarket(2030, 4242));
    // Noisy, so the shelf cannot be planned around: the swing between the
    // richest and thinnest of a dozen winters is real money.
    expect(Math.max(...years) - Math.min(...years)).toBeGreaterThan(0.3);
    // And bounded, so no winter is a flood or a famine.
    for (const m of years) { expect(m).toBeGreaterThanOrEqual(0.6); expect(m).toBeLessThanOrEqual(1.4); }
  });
});

describe('talking him round', () => {
  it('keeps him if you spend enough, and not if you do not', () => {
    const world = fresh();
    const team = world.teams[7]!.team;
    const man = aggrieved(team);
    const entry: PortalMan = {
      player: man, from: 7, fromName: 'X', cost: portalCost(man), reason: 'x',
    };
    expect(makeTheCase(entry, 1, 100).stayed).toBe(false);
    const rich = makeTheCase(entry, 500, 500);
    expect(rich.stayed).toBe(true);
    expect((man as Player & { inPortal?: boolean }).inPortal).toBeUndefined();
  });

  it('never spends more than is left', () => {
    const world = fresh();
    const man = world.teams[8]!.team.bench[0]!;
    const entry: PortalMan = {
      player: man, from: 8, fromName: 'X', cost: 30, reason: 'x',
    };
    expect(makeTheCase(entry, 999, 12).spent).toBe(12);
  });

  it('is dearer the unhappier he is', () => {
    const world = fresh();
    const team = world.teams[9]!.team;
    const man = team.bench[0]!;
    const entry: PortalMan = {
      player: man, from: 9, fromName: 'X', cost: 20, reason: 'x',
    };
    setMood(man, SETTLED);
    const easy = makeTheCase({ ...entry }, 20, 100).stayed;
    setMood(man, 2);
    const hard = makeTheCase({ ...entry }, 20, 100).stayed;
    expect(easy).toBe(true);
    expect(hard, 'a man you ignored all year was talked round for the same price')
      .toBe(false);
  });
});

describe('the hole it leaves', () => {
  it('takes him off the roster he left', () => {
    const world = fresh();
    const team = world.teams[11]!.team;
    const man = team.bench[0]!;
    const before = squad(team).length;
    releaseFrom(team, man.id);
    expect(squad(team).length).toBe(before - 1);
    expect(squad(team).some((p) => p.id === man.id)).toBe(false);
  });

  it('reports a short squad honestly rather than inventing men', () => {
    /*
      Checked because the portal is the first system that removes men
      mid-offseason, which is the shape that produced stage 9's empty lineup
      slot. It turns out not to be the same bug, and the difference matters.

      Stage 9's fault was a roster of thirteen that *could* field nine coming
      back with eight, because the cover pass gave up. This is a squad of seven
      that genuinely cannot field nine — arithmetic rather than a defect. The
      chart says so, with nulls, instead of crashing or repeating somebody.

      What makes it safe is the calendar: the portal runs inside the offseason
      and `fillRosters` refills before a pitch is thrown, which the next test
      holds. If a game were ever played in this state it would be a real bug,
      and it is the reason these two tests sit next to each other.
    */
    const world = fresh();
    const team = world.teams[13]!.team;
    for (const p of [...team.bench].slice(0, 4)) releaseFrom(team, p.id);
    for (const p of [...team.lineup].slice(0, 2)) releaseFrom(team, p.id);

    expect(squad(team).length).toBeLessThan(9);
    const nine = startersFrom(team, 0);
    const ids = SPOTS.map((sp) => nine[sp]?.id).filter(Boolean);
    // Everybody it did name is a real, distinct man -- no ghosts, no doubles.
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(squad(team).length);
  });

  it('is filled back up by the offseason, so next February is a squad', () => {
    // `fillRosters` is what repairs it, and it has never had to repair a hole
    // this large before.
    const world = fresh();
    const team = world.teams[15]!.team;
    for (const p of [...team.bench]) releaseFrom(team, p.id);
    for (const p of [...team.lineup].slice(0, 3)) releaseFrom(team, p.id);

    fillRosters(world, world.rng, { userTeam: 15 });
    expect(team.lineup.length, 'the lineup was not refilled').toBe(9);
    expect(team.bench.length, 'the bench was not refilled').toBeGreaterThan(0);
    const nine = startersFrom(team, 0);
    expect(SPOTS.map((s) => nine[s]?.id).filter(Boolean).length).toBe(9);
  });
});

describe('signing him', () => {
  it('puts him where he belongs and stamps the one-move rule', () => {
    const world = fresh();
    const to = world.teams[17]!.team;
    const man = world.teams[18]!.team.bench[0]!;
    const entry: PortalMan = {
      player: man, from: 18, fromName: 'X', cost: 20, reason: 'x',
    };
    signFromPortal(to, entry);
    expect(squad(to).some((p) => p.id === man.id)).toBe(true);
    expect((man as Player & { transferred?: boolean }).transferred).toBe(true);
    // And he can never enter it again.
    setMood(man, 0);
    expect(entersPortal(man, {
      squadRank: 20, starts: 0, games: 45, year: 2030, seed: 4242,
    })).toBe(false);
  });

  it('puts an arm in the right half of the staff', () => {
    const world = fresh();
    const to = world.teams[19]!.team;
    const starter = world.teams[20]!.team.rotation[0]!;
    const rotationBefore = to.rotation.length;
    signFromPortal(to, {
      player: starter, from: 20, fromName: 'X', cost: 20, reason: 'x',
    });
    expect(to.rotation.length).toBe(rotationBefore + 1);
  });
});

describe('what a staff does with it', () => {
  it('signs men who improve the roster, within budget', () => {
    const world = fresh();
    const to = world.teams[21]!.team;
    const pool: PortalMan[] = world.teams[22]!.team.lineup.slice(0, 4).map((p) => ({
      player: p, from: 22, fromName: 'X', cost: portalCost(p), reason: 'x',
    }));
    const took = staffWorksPortal(to, pool, 200);
    expect(took.length).toBeGreaterThan(0);
    expect(took.length, 'the staff signed the entire portal').toBeLessThanOrEqual(2);
    for (const m of took) {
      expect(squad(to).some((p) => p.id === m.player.id)).toBe(true);
    }
  });

  it('signs nobody it cannot afford', () => {
    const world = fresh();
    const to = world.teams[23]!.team;
    const pool: PortalMan[] = world.teams[24]!.team.lineup.slice(0, 3).map((p) => ({
      player: p, from: 24, fromName: 'X', cost: 999, reason: 'x',
    }));
    expect(staffWorksPortal(to, pool, 10)).toEqual([]);
  });
});
