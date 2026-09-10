import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/engine/rng.js';
import { makeTwoWay } from '../src/engine/players.js';
import { createSeason } from '../src/engine/season.js';
import { CONFERENCES } from '../src/data/schools.js';
import { entersPortal, openPortal, reasonFor } from '../src/engine/portal.js';
import { explicitRecruitPromiseBroken, SETTLED, setMood, recruitPromiseProgress } from '../src/engine/morale.js';
import { markRead, markAllRead, newItem, restoreInbox, unreadCount } from '../src/engine/inbox.js';
import { generateClass, type Pitch, weeklyPoints, actionInterest } from '../src/engine/recruiting.js';
import { freshEconomy, marketFor } from '../src/engine/economy.js';
import { recruitingPlan } from '../src/engine/recruitingPlan.js';
import { nationalBidReason, type NationalField } from '../src/engine/postseason.js';

describe('two-way promises use real season appearances', () => {
  const man = () => {
    const p = makeTwoWay(makeRng(4242), 55);
    p.classYear = 'SO';
    p.recruitPromise = { kind: 'twoWayOpportunity', madeYear: 2026, judged: 1 };
    setMood(p, SETTLED);
    return p;
  };
  const at = { squadRank: 1, starts: 45, games: 45, year: 2027, seed: 1 };
  it('does not add portal risk when both promised roles were fulfilled', () => {
    const p = man();
    const without = { ...p, recruitPromise: undefined };
    for (let seed = 0; seed < 500; seed++) {
      expect(entersPortal(p, { ...at, seed, battingGames: 8, pitchingGames: 3 }))
        .toBe(entersPortal(without, { ...at, seed }));
    }
  });
  it('still penalizes genuinely missing batting OR pitching opportunities', () => {
    const p = man();
    for (const participation of [{ battingGames: 7, pitchingGames: 3 }, { battingGames: 8, pitchingGames: 2 }]) {
      expect(explicitRecruitPromiseBroken(p, participation)).toBe(true);
      expect(Array.from({ length: 500 }, (_, seed) => entersPortal(p, { ...at, ...participation, seed })).some(Boolean)).toBe(true);
      expect(reasonFor(p, { ...at, ...participation })).toContain('both hit and pitch');
    }
    expect(reasonFor(p, { ...at, battingGames: 8, pitchingGames: 3 })).not.toContain('both hit and pitch');
  });
  it('distinguishes unknown records from actual zero appearances', () => {
    expect(explicitRecruitPromiseBroken(man())).toBe(false);
    expect(explicitRecruitPromiseBroken(man(), { battingGames: 0, pitchingGames: 0 })).toBe(true);
  });
  it('threads appearances through the league portal, including a missing stat row', () => {
    const world = createSeason(makeRng(4242), undefined, CONFERENCES);
    const p = man();
    Object.assign(p, { starts: 45 });
    const rec = world.teams[0]!;
    rec.w = 30; rec.l = 15;
    rec.team.lineup = [p]; rec.team.bench = []; rec.team.rotation = [p]; rec.team.bullpen = [];
    const batting = new Map([[p.id, { g: 8 }]]);
    const pitching = new Map([[p.id, { g: 3 }]]);
    let brokenEntries = 0;
    for (let seed = 0; seed < 100; seed++) {
      expect(openPortal([rec], { year: 2027, seed, batting, pitching })).toHaveLength(0);
      brokenEntries += openPortal([rec], { year: 2027, seed, batting, pitching: new Map() }).length;
    }
    expect(brokenEntries).toBeGreaterThan(0);
    expect(recruitPromiseProgress(p, { ...at, battingGames: 8, pitchingGames: 3 })?.detail).toContain('8/8');
  });
});

describe('weekly recruiting forecast', () => {
  const pitch: Pitch = { prestige: .45, stars: 2, playingTime: () => .75, winning: .55, region: 'Gulf', state: 'LA', development: .65 };
  it('shows no gain without a plan and includes an action-only pitch', () => {
    const p = generateClass(2027, 8, makeRng(91)).prospects[0]!;
    const at = { team: 0, actions: 0, prestige: 45, skill: 20 };
    expect(recruitingPlan(p, pitch, at)).toMatchObject({ rp: 0, gain: 0 });
    p.weekActions = { 0: { pitch: 'playingTime' } };
    expect(recruitingPlan(p, pitch, at).gain).toBe(actionInterest(p, pitch, 0));
  });
  it('applies coordinator focus to the same raw effort and pitch gain as the week end', () => {
    const p = generateClass(2027, 8, makeRng(91)).prospects[0]!;
    p.stars = 5;
    p.weekActions = { 0: { pitch: 'playingTime' } };
    const economy = freshEconomy();
    economy.staff.recruiting = marketFor('test', 2027, 'recruiting')[0]!;
    economy.staffPlans = { recruiting: { directive: 'stars' } };
    const at = { team: 0, actions: 4, prestige: 55, skill: 40, economy };
    const expected = (weeklyPoints(p, pitch, 4, 55, 40) + actionInterest(p, pitch, 0)) * 1.1;
    expect(recruitingPlan(p, pitch, at).gain).toBeCloseTo(expected);
    delete economy.staff.recruiting;
    expect(recruitingPlan(p, pitch, at).multiplier).toBe(1);
  });
});

it('opening one message leaves the others unread across a save/reload', () => {
  const items = [newItem({ kind: 'season', year: 2027, title: 'A', body: 'A' }), newItem({ kind: 'season', year: 2027, title: 'B', body: 'B' })];
  const read = markRead(items, items[0]!.id);
  expect(unreadCount(read)).toBe(1);
  expect(unreadCount(items)).toBe(2);
  expect(unreadCount(restoreInbox(JSON.parse(JSON.stringify(read))))).toBe(1);
  expect(unreadCount(markAllRead(read))).toBe(0);
});

it('distinguishes regional, protected and ordinary at-large national bids', () => {
  const field: NationalField = { seeds: [1, 2, 3], regionalChampions: [1], protectedTeams: [1, 2], atLarge: [2, 3] };
  expect(nationalBidReason(field, 1)).toBe('regionalChampion');
  expect(nationalBidReason(field, 2)).toBe('protected');
  expect(nationalBidReason(field, 3)).toBe('atLarge');
  expect(nationalBidReason(field, 4)).toBeNull();
});
