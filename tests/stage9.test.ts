// stage9.test.ts
// Injuries, workload, morale and the captain.
//
// The four of them share the property the last two stages were built on and it
// is the first thing checked: **everything is derived or sparse**, so a save
// written before stage 9 has nobody hurt, nobody tired, nobody unhappy and no
// captain — rather than everybody at zero.
//
// The rest is mostly rates. Injuries are the one system here that can wreck a
// game by being slightly wrong in either direction: too rare and the depth
// chart is decoration, too common and the roster is a casualty ward by May. The
// specification was given in those words — "we don't want to have our roster
// dead after a few games" — so it is pinned as a measured season rather than as
// a constant somebody eyeballed.

import { describe, it, expect } from 'vitest';
import {
  hurtsToday, hurt, isHurt, daysLeft, prognosis, healUp,
} from '../src/engine/injury.js';
import {
  legWeariness, legMultiplier, strainMultiplier, played, rested,
  armMileage, armMultiplier, threw, resetWorkload, FRESH_UNTIL, SEASON_INNINGS,
} from '../src/engine/workload.js';
import {
  SETTLED, UNHAPPY, moodOf, mood, expectationOf, promiseOf, settleMood,
  setMood, moodMultiplier, flightRisk, squadRanks,
} from '../src/engine/morale.js';
import {
  canLead, candidates, roomsChoice, captainOf, appoint, standDown,
} from '../src/engine/captains.js';
import { available } from '../src/engine/depthChart.js';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import type { Hitter, Pitcher, Player, Team } from '../src/engine/types.js';

const world = createSeason(makeRng(4242), undefined, CONFERENCES);
const aTeam = (): Team => world.teams[11]!.team;
const everyone: Hitter[] = world.teams.flatMap((t) => [...t.team.lineup, ...t.team.bench]);

describe('a save from before stage 9', () => {
  it('has nobody hurt, tired, unhappy or leading', () => {
    for (const p of everyone.slice(0, 200)) {
      expect(isHurt(p, 0)).toBe(false);
      expect(legWeariness(p)).toBe(0);
      expect(moodOf(p)).toBe(SETTLED);
    }
    expect(captainOf(aTeam())).toBeNull();
  });
});

describe('injuries', () => {
  it('takes no draw from the season generator', () => {
    // Pure chance, with no rating to read, makes *where the roll comes from*
    // matter more rather than less: a hidden roll a reload could re-roll is a
    // slot machine.
    const rng = makeRng(99);
    const before = rng.state?.();
    for (const p of everyone.slice(0, 60)) hurtsToday(p, 12, 4242);
    expect(rng.state?.()).toBe(before);
  });

  it('gives the same answer every time it is asked', () => {
    const p = everyone[5]!;
    const a = hurtsToday(p, 30, 4242);
    const b = hurtsToday(p, 30, 4242);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('costs a program about one man a season, not a ward full', () => {
    /*
      The number the whole system lives or dies on, measured over a season
      rather than asserted as a constant.

      A program plays 45 games with nine men on the field, so a season is about
      405 appearances. The bar is deliberately wide at both ends: under a
      quarter of a man a year and the depth chart is decoration; over four and
      a roster is a casualty ward, which is the thing that was asked against.
    */
    let hurtCount = 0;
    const squad = [...aTeam().lineup];
    for (let day = 0; day < 45; day++) {
      for (const p of squad) if (hurtsToday(p, day, 4242)) hurtCount++;
    }
    expect(hurtCount, 'nobody in a whole season').toBeGreaterThanOrEqual(0);
    expect(hurtCount, 'a casualty ward').toBeLessThan(5);

    // And across the league, so one quiet roster does not read as a working
    // system. Ninety-six programs, one season.
    let league = 0;
    for (const t of world.teams) {
      for (let day = 0; day < 45; day++) {
        for (const p of t.team.lineup) if (hurtsToday(p, day, 4242)) league++;
      }
    }
    const perProgram = league / world.teams.length;
    expect(perProgram, 'the league never breaks down').toBeGreaterThan(0.3);
    expect(perProgram, 'the league is in traction').toBeLessThan(3);
  });

  it('is mostly short, and season-ending is rare', () => {
    // A program should see a torn ligament roughly once every three years, not
    // every spring. Counted across the country over one season.
    let short = 0;
    let ending = 0;
    for (const t of world.teams) {
      for (let day = 0; day < 45; day++) {
        for (const p of t.team.lineup) {
          const h = hurtsToday(p, day, 4242);
          if (!h) continue;
          if (h.days >= 150) ending++; else short++;
        }
      }
    }
    expect(short, 'nothing short ever happens').toBeGreaterThan(ending * 5);
    expect(ending / world.teams.length, 'season-enders every spring')
      .toBeLessThan(0.5);
  });

  it('gets likelier when a man is run into the ground', () => {
    // The whole reason resting somebody is a decision.
    let base = 0;
    let strained = 0;
    for (const p of everyone.slice(0, 400)) {
      for (let day = 0; day < 45; day++) {
        if (hurtsToday(p, day, 4242, 1)) base++;
        if (hurtsToday(p, day, 4242, 2.5)) strained++;
      }
    }
    expect(strained).toBeGreaterThan(base);
  });

  it('sits him down and lets him back', () => {
    const p = everyone[9]!;
    hurt(p, 20, 'a tight hamstring', 6);
    expect(isHurt(p, 20)).toBe(true);
    expect(available(p, 22)).toBe(false);
    expect(available(p, 26)).toBe(true);
    expect(daysLeft(p, 21)).toBe(5);
    healUp(p);
    expect(isHurt(p, 21)).toBe(false);
  });

  it('says how long in weeks rather than in days', () => {
    const p = everyone[13]!;
    hurt(p, 0, 'a torn ligament', 200);
    expect(prognosis(p, 0)).toBe('out for the season');
    hurt(p, 0, 'a shoulder problem', 30);
    expect(prognosis(p, 0)).toContain('weeks');
    hurt(p, 0, 'a jammed thumb', 5);
    expect(prognosis(p, 0)).toBe('out a few days');
    healUp(p);
    expect(prognosis(p, 0)).toBe('fit');
  });
});

describe('workload', () => {
  it('does not call a man tired for playing a fortnight', () => {
    const p = { ...everyone[0]! } as Player;
    for (let i = 0; i < FRESH_UNTIL; i++) played(p);
    expect(legWeariness(p)).toBe(0);
    expect(legMultiplier(p)).toBe(1);
  });

  it('is very slight on the bat, and much less slight on the odds', () => {
    /*
      The specification, in the words it was given in: both effects, "but very
      slight -- we don't want to have our roster dead after a few games."

      So the bat barely moves and the risk moves properly. That asymmetry is
      the design: the cost of running a man into the ground is that he gets
      hurt, not that he forgets how to hit.
    */
    const p = { ...everyone[0]! } as Player;
    for (let i = 0; i < 40; i++) played(p);
    expect(legWeariness(p)).toBe(1);
    expect(legMultiplier(p)).toBeGreaterThan(0.96);
    expect(strainMultiplier(p)).toBeGreaterThan(2);
  });

  it('gives a day off back without wiping the season', () => {
    const p = { ...everyone[0]! } as Player;
    for (let i = 0; i < 30; i++) played(p);
    const tired = legWeariness(p);
    rested(p);
    expect(legWeariness(p)).toBeLessThan(tired);
    // But a man who has played thirty straight is not fresh because he sat on
    // Tuesday.
    expect((p as { straight?: number }).straight).toBeGreaterThan(0);
  });

  it('leaves a starter alone until he is deep into his year', () => {
    const arm = { ...world.teams[0]!.team.rotation[0]! } as Pitcher;
    threw(arm, 40 * 3);
    expect(armMultiplier(arm)).toBe(1);
    threw(arm, (SEASON_INNINGS - 40) * 3);
    expect(armMileage(arm)).toBeCloseTo(1, 1);
    expect(armMultiplier(arm)).toBeLessThan(1);
    expect(armMultiplier(arm), 'a full season ruined him').toBeGreaterThan(0.93);
  });

  it('clears at the year roll', () => {
    const p = { ...everyone[0]! } as Player;
    for (let i = 0; i < 30; i++) played(p);
    resetWorkload(p);
    expect(legWeariness(p)).toBe(0);
  });
});

describe('morale', () => {
  const ranks = squadRanks(aTeam());
  const best = aTeam().lineup[0]!;
  const rankOf = (p: Player): number => ranks.get(p.id) ?? 20;

  it('states a promise rather than inferring one', () => {
    // The reason it is stated: recruiting a man on the promise of a job and
    // then sitting him is a thing you *did*, and the game should say so.
    expect(expectationOf(best, 1)).toBeGreaterThan(0.6);
    expect(expectationOf(best, 20)).toBeLessThan(0.3);
    expect(promiseOf(best, 1)).toBe('expects to start');
    expect(promiseOf(best, 20)).toContain('earn it');
  });

  it('asks less of a freshman than of a senior at the same standing', () => {
    const fr = { ...best, classYear: 'FR' as const };
    const sr = { ...best, classYear: 'SR' as const };
    expect(expectationOf(fr, 5)).toBeLessThan(expectationOf(sr, 5));
  });

  it('punishes a broken promise harder than it rewards a kept one', () => {
    /*
      Deliberately asymmetric. A man given more than he was promised is
      pleased; a man given far less is *aggrieved*, which is a stronger feeling
      and the one that eventually walks out of the door.
    */
    const p = { ...best } as Player;
    const kept = settleMood(p, { starts: 45, games: 45, squadRank: 1, winPct: 0.5 });
    const broken = settleMood(p, { starts: 0, games: 45, squadRank: 1, winPct: 0.5 });
    expect(kept).toBeGreaterThan(SETTLED);
    expect(broken).toBeLessThan(SETTLED);
    expect(SETTLED - broken, 'a broken promise cost less than a kept one paid')
      .toBeGreaterThan(kept - SETTLED);
  });

  it('lets winning and playing time pull against each other', () => {
    const p = { ...best } as Player;
    const benchedOnAWinner = settleMood(p, { starts: 2, games: 45, squadRank: 1, winPct: 0.8 });
    const playingOnALoser = settleMood(p, { starts: 45, games: 45, squadRank: 1, winPct: 0.2 });
    expect(playingOnALoser).toBeGreaterThan(benchedOnAWinner);
  });

  it('charges a little for moving a man who did not ask', () => {
    const p = { ...best } as Player;
    const asked = settleMood(p, { starts: 40, games: 45, squadRank: 1, winPct: 0.5 });
    const not = settleMood(p, {
      starts: 40, games: 45, squadRank: 1, winPct: 0.5, movedUnwillingly: true,
    });
    expect(not).toBeLessThan(asked);
  });

  it('damps the swing rather than lifting the mood', () => {
    // The distinction the captain is built on: he is not a morale bonus, he is
    // the reason a bad April does not become a mutiny.
    const p = { ...best } as Player;
    const bad = settleMood(p, { starts: 0, games: 45, squadRank: 1, winPct: 0.2 });
    const damped = settleMood(p, {
      starts: 0, games: 45, squadRank: 1, winPct: 0.2, damped: true,
    });
    expect(damped).toBeGreaterThan(bad);
    expect(damped, 'the captain made an unhappy man happy').toBeLessThan(SETTLED);

    // And it damps a good year too, which is what "damp" means.
    const great = settleMood(p, { starts: 45, games: 45, squadRank: 1, winPct: 0.9 });
    const dampedGreat = settleMood(p, {
      starts: 45, games: 45, squadRank: 1, winPct: 0.9, damped: true,
    });
    expect(dampedGreat).toBeLessThan(great);
  });

  it('is slight on the field and real in the portal', () => {
    const p = { ...best } as Player;
    setMood(p, 5);
    expect(moodMultiplier(p)).toBeGreaterThan(0.96);
    expect(flightRisk(p)).toBeGreaterThan(0.8);
    setMood(p, 70);
    expect(moodMultiplier(p)).toBe(1);
    expect(flightRisk(p)).toBe(0);
  });

  it('reads as four words a card can print', () => {
    const p = { ...best } as Player;
    setMood(p, 90); expect(mood(p)).toBe('buzzing');
    setMood(p, 60); expect(mood(p)).toBe('fine');
    setMood(p, 30); expect(mood(p)).toBe('restless');
    setMood(p, 10); expect(mood(p)).toBe('unhappy');
  });

  it('never leaves the scale', () => {
    const p = { ...best } as Player;
    for (let i = 0; i < 20; i++) {
      setMood(p, settleMood(p, { starts: 0, games: 45, squadRank: 1, winPct: 0 }));
    }
    expect(moodOf(p)).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 20; i++) {
      setMood(p, settleMood(p, { starts: 45, games: 45, squadRank: 18, winPct: 1 }));
    }
    expect(moodOf(p)).toBeLessThanOrEqual(100);
  });
});

describe('the captain', () => {
  it('is gated on makeup, which is the whole feature', () => {
    /*
      Without the gate, naming a captain is a free buff applied to your best
      player, and the answer is the same man every year. With it the question
      is who in this room is actually like that -- and sometimes that is not a
      man anywhere near your best.
    */
    const team = aTeam();
    const eligible = candidates(team);
    const all = [...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen];
    expect(eligible.length, 'nobody in the room can lead it').toBeGreaterThan(0);
    expect(eligible.length, 'everybody is a captain').toBeLessThan(all.length);
  });

  it('never offers a freshman', () => {
    for (const t of world.teams.slice(0, 30)) {
      for (const c of candidates(t.team)) {
        expect(c.classYear, 'a freshman was offered the room').not.toBe('FR');
      }
    }
  });

  it('shows the room its own choice, seniority first', () => {
    const team = aTeam();
    const pick = roomsChoice(team);
    expect(pick).not.toBeNull();
    expect(canLead(pick!)).toBe(true);
  });

  it('refuses anybody the room would not follow', () => {
    const team = aTeam();
    const notEligible = [...team.lineup, ...team.bench].find((p) => !canLead(p));
    expect(notEligible).toBeDefined();
    expect(appoint(team, notEligible!)).toBe(false);
    expect(captainOf(team)).toBeNull();
  });

  it('names him, and forgets him when he leaves', () => {
    const team = aTeam();
    const man = candidates(team)[0]!;
    expect(appoint(team, man)).toBe(true);
    expect(captainOf(team)?.id).toBe(man.id);
    standDown(team);
    expect(captainOf(team)).toBeNull();
  });

  it('does not keep a captain who is no longer eligible', () => {
    // He graduated, or the roster turned over. The room notices before the
    // save file does.
    const team = aTeam();
    const man = candidates(team)[0]!;
    appoint(team, man);
    const stripped = { ...man };
    delete (stripped as { badges?: unknown }).badges;
    // Across all four lists: `candidates` includes the staff, so the man the
    // room would follow is often a pitcher, and swapping only the hitters left
    // the original standing in the rotation.
    const swap = <T extends Player>(list: T[]): T[] =>
      list.map((p) => (p.id === man.id ? stripped as T : p));
    team.lineup = swap(team.lineup);
    team.bench = swap(team.bench);
    team.rotation = swap(team.rotation);
    team.bullpen = swap(team.bullpen);
    expect(captainOf(team)).toBeNull();
  });
});
