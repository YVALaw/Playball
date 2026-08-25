// draft.test.ts
// The three things professional baseball does to a program, held to the rules
// they are supposed to follow.
//
// Eligibility, because it is a real rule with a real edge and a game that gets
// it wrong loses a player a year early. Valuation, because the clubs must not
// be able to see a ceiling nobody outside the program can see — that one is the
// difference between a draft that makes mistakes and an oracle. And the
// persuasion, because it spends the recruiting budget and a mechanic that takes
// money has to be exactly as honest as it says it is.

import { describe, it, expect } from 'vitest';
import {
  AI_KEEP_EDGE, AVERAGE_STAFF, DRAFT_AGE, DRAFT_ROUNDS,
  bestCase, draftContext, draftEligible, draftRound, keepPoints, keepPrice,
  letHimGo, makeTheCase, offerWorth, pitchCredibility, prioritiesOf, pullHints,
  rivalKeeps, sceneFrom, seasonForm, visibleValue, yearsCompleted,
  KEEP_PITCHES,
  type DraftedMan, type KeepScene, type RivalKeep,
} from '../src/engine/draft.js';
import { reinstate } from '../src/engine/progression.js';
import { makeHitter, makePitcher, arrivalAge, ageFor } from '../src/engine/players.js';
import { overallOf } from '../src/engine/ratings.js';
import { PRIORITIES } from '../src/engine/recruiting.js';
import { createSeason, simSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import type { Hitter, Priorities } from '../src/engine/types.js';

const SMALL = CONFERENCES.slice(0, 2);

/** A weight vector with everything on one thing, for isolating the match. */
const wants = (k: keyof Priorities): Priorities => {
  const out = { prestige: 0.1, playingTime: 0.1, winning: 0.1, proximity: 0.1, development: 0.1 };
  out[k] = 0.6;
  return out as Priorities;
};

const scene = (over: Partial<KeepScene> = {}): KeepScene => ({
  prestige: 0.5, returning: 0.5, coachPrestige: 45, tenure: 4, training: 40,
  blockedBy: 0, round: 10, ...over,
});

const pending = (player: Hitter, round: number): DraftedMan =>
  ({ player, round, pitch: null, offered: 0, made: 0, needed: 0, outcome: 'pending' });

// ---------------------------------------------------------------------------

describe('draft eligibility', () => {
  it('is three years completed, or twenty one, whichever comes first', () => {
    // The four cases the rule actually turns on, written out, because every one
    // of them is a different year of somebody's career.
    expect(draftEligible({ classYear: 'SO', age: 20 }), 'a 20 year old sophomore')
      .toBe(false);
    expect(draftEligible({ classYear: 'SO', age: 21 }), 'a 21 year old sophomore')
      .toBe(true);
    expect(draftEligible({ classYear: 'JR', age: 20 }), 'a junior, three years in')
      .toBe(true);
    expect(draftEligible({ classYear: 'SR', age: 21 }), 'a senior')
      .toBe(true);
  });

  it('leaves an ordinary freshman and sophomore alone', () => {
    expect(draftEligible({ classYear: 'FR', age: 19 })).toBe(false);
    expect(draftEligible({ classYear: 'SO', age: 20 })).toBe(false);
    // And catches the one who turned up late. A twenty year old freshman is
    // twenty one after one season, which is the whole exception.
    expect(draftEligible({ classYear: 'FR', age: DRAFT_AGE })).toBe(true);
  });

  it('counts a year of college as a year completed', () => {
    expect(yearsCompleted('FR')).toBe(1);
    expect(yearsCompleted('JR')).toBe(3);
    expect(yearsCompleted('SR')).toBe(4);
  });

  it('gives a generated player an age that matches his class year', () => {
    const rng = makeRng(11);
    for (let i = 0; i < 200; i++) {
      const p = makeHitter(rng, 50);
      expect(p.age).toBe(ageFor(p.id, p.classYear));
      expect(arrivalAge(p.id)).toBeGreaterThanOrEqual(18);
      expect(arrivalAge(p.id)).toBeLessThanOrEqual(20);
    }
  });
});

// ---------------------------------------------------------------------------

describe('what the clubs can see', () => {
  const rng = makeRng(4242);
  const season = createSeason(rng, undefined, SMALL);
  simSeason(season);
  const ctx = draftContext(season);

  it('does not read a ceiling nobody outside the program can see', () => {
    // The one assertion this whole system stands on. A club that could read
    // `potential` would never take a bust, and a coach's private knowledge of
    // who is going to grow would be worth nothing.
    const roster = season.teams[0]!.team;
    for (const p of [...roster.lineup, ...roster.rotation]) {
      const before = visibleValue(p, season, ctx);
      const was = p.potential;
      p.potential = 99;
      expect(visibleValue(p, season, ctx), `${p.name} was re-priced by his ceiling`)
        .toBe(before);
      p.potential = 15;
      expect(visibleValue(p, season, ctx)).toBe(before);
      p.potential = was;
    }
  });

  it('reads the season he actually had', () => {
    const p = makeHitter(makeRng(7), 55);
    const quiet = seasonForm(p, season, ctx);
    // A man who never took an at bat is graded at exactly average rather than
    // punished, because a club has nothing to hold against him.
    expect(quiet).toBe(50);

    season.batting.set(p.id, {
      g: 45, ab: 170, r: 50, h: 75, d: 18, t: 3, hr: 14,
      rbi: 60, bb: 30, k: 22, hbp: 2, sb: 8, cs: 2,
    });
    const loud = seasonForm(p, season, ctx);
    expect(loud, 'a huge season did not move him').toBeGreaterThan(quiet + 5);
    expect(visibleValue(p, season, ctx)).toBeGreaterThan(overallOf(p) * 0.6 + 20);
    season.batting.delete(p.id);
  });

  it('shrinks a rate nobody has seen enough of', () => {
    // The same line in a fifth of the at bats is worth a fraction of the credit,
    // which is the honest version of "he did not play enough for us to know".
    const a = makeHitter(makeRng(21), 55);
    const b = makeHitter(makeRng(22), 55);
    season.batting.set(a.id, {
      g: 45, ab: 200, r: 40, h: 80, d: 16, t: 2, hr: 12,
      rbi: 55, bb: 25, k: 30, hbp: 1, sb: 4, cs: 1,
    });
    season.batting.set(b.id, {
      g: 12, ab: 40, r: 8, h: 16, d: 3, t: 0, hr: 2,
      rbi: 11, bb: 5, k: 6, hbp: 0, sb: 1, cs: 0,
    });
    expect(seasonForm(a, season, ctx)).toBeGreaterThan(seasonForm(b, season, ctx));
    season.batting.delete(a.id);
    season.batting.delete(b.id);
  });

  it('prices a pitcher off strikeouts as well as runs', () => {
    const p = makePitcher(makeRng(31), 55, { role: 'SP' });
    const line = {
      g: 14, gs: 14, w: 8, l: 3, sv: 0, outs: 270, h: 70, r: 30, er: 27,
      bb: 22, k: 60, hr: 6, pitches: 1300, bf: 370,
    };
    season.pitching.set(p.id, line);
    const plain = seasonForm(p, season, ctx);
    season.pitching.set(p.id, { ...line, k: 130 });
    expect(seasonForm(p, season, ctx)).toBeGreaterThan(plain);
    season.pitching.delete(p.id);
  });
});

// ---------------------------------------------------------------------------

describe('the round a man goes in', () => {
  it('is rare at the top and reaches the bottom of the board', () => {
    expect(draftRound(90)).toBe(1);
    expect(draftRound(40)).toBe(DRAFT_ROUNDS);
    // Monotone: a better player never falls further.
    for (let v = 35; v < 95; v++) {
      expect(draftRound(v + 1)).toBeLessThanOrEqual(draftRound(v));
    }
  });

  it('puts the median man the draft takes deep into the board', () => {
    // Measured over a settled league the median drafted player grades out near
    // 60, and he is not a second round pick. This is the arithmetic the old
    // thirty-two-names-per-round rule got wrong.
    expect(draftRound(60)).toBeGreaterThan(8);
    expect(draftRound(70)).toBeGreaterThan(2);
    expect(draftRound(70)).toBeLessThan(8);
  });
});

// ---------------------------------------------------------------------------

describe('talking him out of it', () => {
  const rng = makeRng(99);
  const player = makeHitter(rng, 70, { pos: 'SS' });
  player.classYear = 'JR';
  player.age = 21;

  it('carries the priorities he was recruited on, and invents a set if he has none', () => {
    const carried = { ...wants('winning') };
    player.priorities = carried;
    expect(prioritiesOf(player)).toBe(carried);

    delete player.priorities;
    const hashed = prioritiesOf(player);
    const total = PRIORITIES.reduce((a, k) => a + hashed[k], 0);
    expect(total).toBeCloseTo(1, 6);
    // Stable, so the man does not change his mind between two renders.
    expect(prioritiesOf(player)).toEqual(hashed);
  });

  it('costs materially less when the case matches what he wants', () => {
    // Two men who differ in one thing: what they care about. Same round, same
    // program, same depth chart — so the whole gap is the read.
    const ballplayer = { ...player, priorities: wants('playingTime') };
    const winner = { ...player, priorities: wants('winning') };
    const s = scene({ round: 8 });

    const matched = keepPrice('role', ballplayer, s, 8);
    const guessed = keepPrice('role', winner, s, 8);
    expect(matched).toBeLessThan(guessed);
    expect(guessed / matched, 'reading him right barely paid').toBeGreaterThan(2.5);
  });

  it('is worth nothing at all if you say something the depth chart denies', () => {
    // A promise contradicted by the roster fails, and the money is spent
    // anyway. That is the sting the whole mechanic is built around.
    const blocked = { ...player, priorities: wants('playingTime') };
    const s = scene({ round: 12, blockedBy: overallOf(player) + 20 });
    expect(pitchCredibility('role', blocked, s)).toBe(0);
    expect(keepPrice('role', blocked, s, 12)).toBe(Infinity);

    const man = pending(blocked as Hitter, 12);
    const paid = makeTheCase(man, 'role', 60, s, 200);
    expect(paid.kept, 'a promise the roster denies still worked').toBe(false);
    expect(paid.spent, 'a failed promise cost nothing').toBe(60);
    expect(man.outcome).toBe('gone');
  });

  it('will not promise a finished man he can go higher', () => {
    const finished = { ...player, potential: overallOf(player) };
    expect(pitchCredibility('stock', finished, scene({ round: 2 }))).toBe(0);
    // But a man taken late has room above him whatever his ceiling, because
    // draft stock is a claim about the board as well as about the player.
    expect(pitchCredibility('stock', finished, scene({ round: 16 })))
      .toBeGreaterThan(0.2);
  });

  it('scales the price with the round, steeply', () => {
    expect(keepPoints(1)).toBeGreaterThan(keepPoints(2));
    expect(keepPoints(20)).toBeLessThan(10);
    // A first rounder costs more than a whole recruiting window at its widest;
    // a twentieth rounder costs about one week's attention on one recruit.
    expect(keepPoints(1)).toBeGreaterThan(150);
    for (let r = 1; r < DRAFT_ROUNDS; r++) {
      expect(keepPoints(r + 1)).toBeLessThan(keepPoints(r));
    }
  });

  it('never spends more than there is', () => {
    const man = pending({ ...player, priorities: wants('winning') } as Hitter, 14);
    const { spent } = makeTheCase(man, 'ring', 500, scene({ round: 14 }), 22);
    expect(spent).toBe(22);
  });

  it('cannot be asked twice', () => {
    const man = pending({ ...player, priorities: wants('winning') } as Hitter, 14);
    makeTheCase(man, 'ring', 10, scene({ round: 14 }), 200);
    const again = makeTheCase(man, 'ring', 200, scene({ round: 14 }), 200);
    expect(again.spent).toBe(0);
    expect(man.offered).toBe(10);
  });

  it('lets him go for nothing', () => {
    const man = pending({ ...player } as Hitter, 9);
    letHimGo(man);
    expect(man.outcome).toBe('gone');
    expect(man.offered).toBe(0);
  });

  it('keeps him once the offer clears what the round wanted', () => {
    const keen = { ...player, priorities: wants('winning') } as Hitter;
    const s = scene({ round: 12, prestige: 0.9, returning: 0.9 });
    const price = keepPrice('ring', keen, s, 12);
    expect(Number.isFinite(price)).toBe(true);

    const short = pending(keen, 12);
    expect(makeTheCase(short, 'ring', price - 1, s, 500).kept).toBe(false);

    const enough = pending(keen, 12);
    expect(makeTheCase(enough, 'ring', price, s, 500).kept).toBe(true);
    expect(enough.made).toBeGreaterThanOrEqual(enough.needed);
  });

  it('buys nothing with nothing', () => {
    for (const k of KEEP_PITCHES) {
      expect(offerWorth(k, player, scene(), 0)).toBe(0);
    }
  });

  it('hints at what is pulling him without naming it', () => {
    const [a, b] = pullHints(player);
    expect(a.length).toBeGreaterThan(10);
    expect(b.length).toBeGreaterThan(10);
    expect(a).not.toBe(b);
    // Stable across renders, like every other scouting line in the game.
    expect(pullHints(player)).toEqual([a, b]);
    // And never a number.
    expect(`${a} ${b}`).not.toMatch(/\d/);
  });

  // One id happening not to collide is not the property. The pools overlap, so
  // this only holds because the second pick is drawn from what the first left.
  it('never says the same thing to him twice', () => {
    for (let i = 0; i < 400; i++) {
      const [a, b] = pullHints({ ...player, id: `pull-${i}` as typeof player.id });
      expect(a).not.toBe(b);
    }
  });
});

// ---------------------------------------------------------------------------

describe('a man who comes back', () => {
  it('returns as a senior, with no leverage left', () => {
    const rng = makeRng(505);
    const season = createSeason(rng, undefined, SMALL);
    const team = season.teams[0]!.team;
    const junior = team.lineup[0]!;
    junior.classYear = 'JR';
    junior.age = 21;
    const before = overallOf(junior);

    // Off the roster, as the draft leaves him.
    team.lineup = team.lineup.slice(1);
    reinstate(team, junior, rng);

    const roster = [...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen];
    expect(roster.some((p) => p.id === junior.id), 'he did not come back').toBe(true);
    expect(junior.classYear, 'a returning junior is a senior').toBe('SR');
    // Which is the bet: a senior leaves whatever happens, drafted or not.
    expect(draftEligible(junior)).toBe(true);
    // And the year he was bought is a real year of development.
    expect(overallOf(junior)).not.toBe(before);
  });
});

// ---------------------------------------------------------------------------
// The other ninety five programs, doing the same thing
// ---------------------------------------------------------------------------

/*
  Until now the user was the only coach in the country who could talk a drafted
  man out of professional baseball. The other ninety five lost theirs every year
  without a word, which is an advantage in his favour that nothing in the fiction
  justifies — a rival staff has a phone too.

  What was in the way was money rather than machinery: the AI allocated a flat
  forty actions a week that no June could reduce, so giving it a retention
  mechanic would have given it a second budget for free. With `aiTargets` reading
  `weeklyBudget`, the two sides now spend from the same pool on the same scale,
  and the rest of this is the negotiation itself, run by a staff instead of a
  screen.
*/
describe('a rival program keeps its own men', () => {
  const backline = (n: number, quality: number): Hitter[] =>
    Array.from({ length: n }, (_, i) =>
      makeHitter(makeRng(900 + i), quality, { pos: 'LF' }));

  it('assembles a scene out of the program, not out of nothing', () => {
    const back = backline(6, 55);
    const p = makeHitter(makeRng(11), 70, { pos: 'LF' });
    const sc = sceneFrom(72, back, AVERAGE_STAFF, p, 9);

    expect(sc.prestige).toBeCloseTo(0.72, 6);
    expect(sc.round).toBe(9);
    // The best man at his own spot who is coming back, which is what decides
    // whether a promise of a role is a lie.
    expect(sc.blockedBy).toBe(Math.max(...back.map(overallOf)));
    // Rival staffs are the league average the recruiting model already hands
    // them, not a hidden coach the user can neither see nor out-recruit.
    expect(sc.coachPrestige).toBe(AVERAGE_STAFF.prestige);
    expect(sc.training).toBe(AVERAGE_STAFF.training);
  });

  it('reads nobody at his position as nobody standing there', () => {
    const arms = Array.from({ length: 4 }, (_, i) =>
      makePitcher(makeRng(950 + i), 60, { role: 'SP' }));
    const p = makeHitter(makeRng(12), 62, { pos: 'C' });
    expect(sceneFrom(50, arms, AVERAGE_STAFF, p, 12).blockedBy).toBe(0);
  });

  it('makes the cheapest case that is actually true', () => {
    const p = makeHitter(makeRng(13), 70, { pos: 'SS' });
    p.priorities = wants('playingTime');
    const sc = scene({ blockedBy: 0, prestige: 0.15, returning: 0.1, round: 10 });
    const picked = bestCase(p, sc, 10);

    // It has to be the cheapest of the four, whichever one that is. The claim
    // is that a staff reads its own player, not that it always says "role".
    for (const other of KEEP_PITCHES) {
      expect(picked.price).toBeLessThanOrEqual(keepPrice(other, p, sc, 10));
    }
    expect(keepPrice(picked.kind, p, sc, 10)).toBe(picked.price);
  });

  it('has no case worth making for a finished man nobody has room for', () => {
    // Everything a staff could say is a lie: he cannot get better, somebody far
    // better is standing in front of him, and the program has nothing to sell.
    const p = makeHitter(makeRng(14), 60, { pos: '1B' });
    p.potential = 60;
    p.priorities = wants('playingTime');
    const sc = scene({
      blockedBy: 99, prestige: 0, returning: 0, coachPrestige: 0, tenure: 0,
      training: 20, round: 1,
    });
    // A coach word is never quite worthless, so the price is finite rather than
    // infinite — and hopeless all the same, well past the whole window of the
    // best funded program in the country.
    expect(bestCase(p, sc, 1).price).toBeGreaterThan(180);
  });
});

describe('a rival program spends like a program, not like a cheat', () => {
  const men = (qualities: number[], round: number, seed: number): DraftedMan[] =>
    qualities.map((q, i) => {
      const p = makeHitter(makeRng(seed + i), q, { pos: 'LF' });
      p.priorities = wants('playingTime');
      return pending(p, round);
    });

  it('spends down to the budget and then stops', () => {
    const board = men([70, 68, 66, 64], 12, 20);
    const sc = scene({ blockedBy: 0, round: 12 });

    const rich = rivalKeeps(board, () => sc, 1000, 0);
    expect(rich.length, 'a program with money could not afford anybody').toBe(4);

    const cheapest = Math.min(...rich.map((k) => k.price));
    const again = men([75, 68, 62, 56], 12, 20);
    const poor = rivalKeeps(again, () => sc, cheapest, 0);
    expect(poor.length).toBe(1);
    expect(poor.reduce((a, k) => a + k.price, 0)).toBeLessThanOrEqual(cheapest);
    // Best man first, because that is the order a staff cares in.
    const best = [...again].sort(
      (a, b) => overallOf(b.player) - overallOf(a.player),
    )[0] as DraftedMan;
    expect((poor[0] as RivalKeep).man.player.id).toBe(best.player.id);
  });

  it('will not fight for a man the roster can replace', () => {
    // A bar set exactly where the better man clears it and the other cannot,
    // and money is not what decides it — there is a thousand points on the
    // table and the cheaper man is the one being turned down.
    const board = men([75, 52], 14, 40);
    const [good, weak] = board as [DraftedMan, DraftedMan];
    expect(overallOf(good.player)).toBeGreaterThan(overallOf(weak.player));

    const bar = overallOf(good.player) - AI_KEEP_EDGE;
    const kept = rivalKeeps(
      board, () => scene({ blockedBy: 0, round: 14 }), 1000, bar,
    );
    expect(kept.length).toBe(1);
    expect((kept[0] as RivalKeep).man.player.id).toBe(good.player.id);
  });

  it('leaves a man whose June is already settled alone', () => {
    const board = men([75], 15, 60);
    letHimGo(board[0] as DraftedMan);
    expect(rivalKeeps(board, () => scene({ round: 15 }), 1000, 0)).toEqual([]);
  });

  it('pays for the case it priced, against the roster it priced it on', () => {
    // The scene a decision was made against travels with it. Rebuilt at the
    // moment of paying, it would price the second man against a depth chart the
    // first man had just rejoined — so a staff would find itself buying a case
    // that stopped being true between deciding on it and saying it out loud.
    const board = men([72, 70], 11, 70);
    const sc = scene({ blockedBy: 0, round: 11 });
    const kept = rivalKeeps(board, () => sc, 1000, 0);
    expect(kept.length).toBe(2);
    for (const k of kept) {
      const { kept: stayed } = makeTheCase(k.man, k.kind, k.price, k.scene, 1000);
      expect(stayed, 'a case the staff had priced failed when it was made').toBe(true);
    }
  });
});
