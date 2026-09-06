// god-mode-2.test.ts
// The rest of the sandbox: health, roster moves, the facts around a man,
// recruiting, presets, and the league names.

import { describe, expect, it } from 'vitest';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import {
  authorProspect, commitRecruit, cutPlayer, grantBadge, healPlayer, isIronMan, makeTwoWayOf,
  moodValue, movePlayer, presetChaos, presetParity, presetSuperteam, revokeBadge, setAge,
  setIronMan, setMood, setRecruitStars, setRecruitWants, setRedshirt, unmakeTwoWay,
  BADGE_IDS, RECRUIT_FACTOR_KEYS,
} from '../src/engine/godMode.js';
import { hurt, hurtsToday, isHurt } from '../src/engine/injury.js';
import { isTwoWay } from '../src/engine/types.js';
import { canPursue, generateClass, recruitingPrioritiesOf, setStarGateOpen } from '../src/engine/recruiting.js';
import { leagueLabel, leagueName, setLeagueNames, usableLeagueNames } from '../src/engine/leagueNames.js';
import { overallOf } from '../src/engine/ratings.js';

const fresh = (seed = 9) => createSeason(makeRng(seed), undefined, CONFERENCES);

describe('health', () => {
  it('heals a hurt man and keeps an iron man off the roll', () => {
    const season = fresh();
    const p = season.teams[0]!.team.lineup[0]!;
    hurt(p, 10, 'a hamstring', 20);
    expect(isHurt(p, 12)).toBe(true);
    healPlayer(p);
    expect(isHurt(p, 12)).toBe(false);
    setIronMan(p, true);
    expect(isIronMan(p)).toBe(true);
    for (let day = 0; day < 400; day++) {
      expect(hurtsToday(p, day, 77, 3, 2027)).toBeNull();
    }
    setIronMan(p, false);
    expect(isIronMan(p)).toBe(false);
  });
});

describe('roster moves', () => {
  it('moves a starter to another program and fills his spot from the bench', () => {
    const season = fresh();
    const from = season.teams[1]!;
    const to = season.teams[2]!;
    const starter = from.team.lineup[3]!;
    const spot = starter.pos;
    const benchAtSpot = from.team.bench.find((b) => b.pos === spot);
    const nineBefore = from.team.lineup.length;
    expect(movePlayer(season, starter.id, 2)).toBe(true);
    expect(from.team.lineup.some((h) => h.id === starter.id)).toBe(false);
    expect(to.team.bench.some((h) => h.id === starter.id)).toBe(true);
    if (benchAtSpot) {
      expect(from.team.lineup.length).toBe(nineBefore);
      expect(from.team.lineup.some((h) => h.id === benchAtSpot.id)).toBe(true);
    }
    expect(movePlayer(season, starter.id, 2)).toBe(false);
  });

  it('cuts a man out of the world', () => {
    const season = fresh();
    const arm = season.teams[4]!.team.bullpen[0]!;
    expect(cutPlayer(season, arm.id)).toBe(true);
    expect(season.teams.some((t) => t.team.bullpen.some((a) => a.id === arm.id))).toBe(false);
    expect(cutPlayer(season, arm.id)).toBe(false);
  });
});

describe('the facts around a man', () => {
  it('mood, redshirt, age, badges', () => {
    const season = fresh();
    const p = season.teams[3]!.team.bench[0]!;
    setMood(p, 140); expect(moodValue(p)).toBe(100);
    setMood(p, -4); expect(moodValue(p)).toBe(0);
    setRedshirt(p, true); expect((p as { redshirt?: boolean }).redshirt).toBe(true);
    setRedshirt(p, false); expect((p as { redshirt?: boolean }).redshirt).toBeUndefined();
    setAge(p, 12); expect(p.age).toBe(17);
    const badge = BADGE_IDS[0]!;
    grantBadge(p, badge, 2);
    expect(p.badges?.find((b) => b.id === badge)?.tier).toBe(2);
    grantBadge(p, badge, 3);
    expect(p.badges?.filter((b) => b.id === badge).length).toBe(1);
    revokeBadge(p, badge);
    expect(p.badges?.some((b) => b.id === badge) ?? false).toBe(false);
  });

  it('gives a bat an arm and a seat in the pen, and takes it back', () => {
    const season = fresh();
    const record = season.teams[5]!;
    const bat = record.team.bench.find((b) => !isTwoWay(b))!;
    expect(makeTwoWayOf(record, bat, season.rng, 65)).toBe(true);
    expect(isTwoWay(bat)).toBe(true);
    expect(record.team.bullpen.some((a) => a.id === bat.id)).toBe(true);
    expect(typeof (bat as unknown as { stuff: number }).stuff).toBe('number');
    expect(makeTwoWayOf(record, bat, season.rng)).toBe(false);
    expect(unmakeTwoWay(record, bat)).toBe(true);
    expect(isTwoWay(bat)).toBe(false);
    expect(record.team.bullpen.some((a) => a.id === bat.id)).toBe(false);
  });
});

describe('recruiting', () => {
  it('authors a recruit into the class, rewrites him, and commits him on the spot', () => {
    const season = fresh();
    season.recruiting = generateClass(2027, season.teams.length, makeRng(3));
    const before = season.recruiting.prospects.length;
    const p = authorProspect(season, 'hitter', 80, { pos: 'CF', stars: 5 })!;
    expect(season.recruiting.prospects.length).toBe(before + 1);
    expect(p.stars).toBe(5);
    expect(p.player.classYear).toBe('FR');
    setRecruitStars(p, 9);
    expect(p.stars).toBe(5);
    setRecruitWants(p, { facilities: 5, winning: 0 });
    const w = recruitingPrioritiesOf(p);
    const total = RECRUIT_FACTOR_KEYS.reduce((s, f) => s + w[f], 0);
    expect(total).toBeCloseTo(1, 6);
    expect(w.facilities).toBeGreaterThan(0.5);
    expect(w.winning).toBe(0);
    commitRecruit(season.recruiting, p, 7);
    expect(p.signedBy).toBe(7);
    expect(p.points[7]).toBeGreaterThan(0);
  });

  it('opens the star gate for a sandbox and closes it again', () => {
    const season = fresh();
    season.recruiting = generateClass(2027, season.teams.length, makeRng(4));
    const five = season.recruiting.prospects.find((x) => x.stars === 5)!;
    expect(canPursue(five, 1, false)).toBe(false);
    setStarGateOpen(true);
    expect(canPursue(five, 1, false)).toBe(true);
    setStarGateOpen(false);
    expect(canPursue(five, 1, false)).toBe(false);
  });
});

describe('presets', () => {
  it('parity, chaos and a superteam', () => {
    const season = fresh();
    presetParity(season);
    expect(new Set(season.teams.map((t) => t.prestige)).size).toBe(1);
    presetChaos(season, 12);
    const a = season.teams.map((t) => t.prestige);
    expect(new Set(a).size).toBeGreaterThan(20);
    for (const v of a) { expect(v).toBeGreaterThanOrEqual(20); expect(v).toBeLessThanOrEqual(95); }
    presetChaos(season, 12);
    expect(season.teams.map((t) => t.prestige)).toEqual(a);
    const me = season.teams[0]!;
    presetSuperteam(me);
    for (const p of [...me.team.lineup, ...me.team.rotation]) expect(overallOf(p)).toBeGreaterThanOrEqual(95);
  });
});

describe('league names', () => {
  it('renames a league everywhere it is printed, and reads an old file as nothing', () => {
    setLeagueNames({ GULF: 'SEC' });
    expect(leagueLabel('GULF')).toBe('SEC');
    expect(leagueName('GULF')).toBe('SEC');
    expect(leagueLabel('ATLANTIC')).toBe('ATLANTIC');
    setLeagueNames(undefined);
    expect(leagueLabel('GULF')).toBe('GULF');
    expect(usableLeagueNames(null)).toEqual({});
    expect(usableLeagueNames({ GULF: ' Big Ten ', X: 3, Y: '' })).toEqual({ GULF: 'Big Ten' });
  });
});
