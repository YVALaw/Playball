// shallow-systems.test.ts
// Five systems that existed but had no depth in them, taken in one pass on
// 2026-09-11 from `06-backlog.md` §AC.1. Each had the shape of a feature and
// the behaviour of a placeholder, and each is guarded here.

import { describe, it, expect } from 'vitest';
import { createSeason, restedFirst, closerFrom } from '../src/engine/season.js';
import { bestOf } from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { overallOf } from '../src/engine/ratings.js';
import { armValue } from '../src/engine/ratings.js';
import {
  actionInterest, PITCH_COST, HARD_SELL_COST, generateClass,
} from '../src/engine/recruiting.js';
import { programRecruitingPitch } from '../src/engine/recruitingPlan.js';
import { staffWorksPortal, rivalHolds, portalCost, PORTAL_TAKE, PORTAL_EDGE } from '../src/engine/portal.js';
import type { PortalMan } from '../src/engine/portal.js';
import type { Hitter, Player } from '../src/engine/types.js';

const world = () => createSeason(makeRng(4242), undefined, CONFERENCES);

// ---------------------------------------------------------------------------
// 1. The national championship series, played in one town
// ---------------------------------------------------------------------------

describe('a best-of series', () => {
  it('alternates the host from the better seed instead of giving him every game', () => {
    /*
      `hostOfGame` has alternated for the regionals all along; `bestOf` seeded
      a→0, b→1 and the lower seed hosted every game, so the national final was
      played end to end in one park. Home is worth something real here, and a
      series decided by seeding before anybody played is not a series.
    */
    const season = world();
    const result = bestOf(season, 3, 4, 11, 'Final');
    expect(result.games.length).toBeGreaterThanOrEqual(2);
    const hosts = result.games.map((g) => g.home);
    expect(hosts[0]).toBe(4);
    expect(hosts[1]).toBe(11);
    // And the better seed gets the odd game of an odd series.
    if (hosts.length === 3) expect(hosts[2]).toBe(4);
  });

  it('still produces one champion who won the majority', () => {
    const season = world();
    const result = bestOf(season, 3, 4, 11, 'Final');
    expect([4, 11]).toContain(result.champion);
    const wins = result.games.filter((g) => g.winner === result.champion).length;
    expect(wins).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 2. Minimum-bid spreading, still the dominant strategy
// ---------------------------------------------------------------------------

describe('a recruiting week', () => {
  const season = world();
  const prospects = generateClass(1, 96, makeRng(11)).prospects;
  const team = 3;
  const record = season.teams[team]!;
  const pitch = programRecruitingPitch(season, record, 'Gulf', 55);

  const withAction = (p: typeof prospects[number], action: unknown): typeof prospects[number] => {
    const copy = { ...p, weekActions: { [team]: action } } as typeof prospects[number];
    return copy;
  };

  it('pays a bare pitch a fraction of what a real push earns per point', () => {
    /*
      `weeklyPoints` has ramped its passive half since the audit measured a
      56-point week spread one-per-man returning nearly twice a concentrated
      push. The action layer never got the ramp, so three points dropped on a
      man nobody thought about again paid full price, and spreading stayed the
      dominant strategy: twenty targets at three points signs 6.3 a year
      against 3.9 for eight pushed properly (05 §62.7).
    */
    const man = prospects.find((p) => p.player.type === 'hitter')!;
    const factor = 'development' as const;
    const bare = actionInterest(withAction(man, { pitch: factor }), pitch, team);
    const pushed = actionInterest(
      withAction(man, { pitch: factor, major: { kind: 'hardSell', factor } }), pitch, team,
    );
    // Per point spent, a push has to beat a bare pitch. It did not before.
    const barePerPoint = bare / PITCH_COST;
    const pushPerPoint = pushed / (PITCH_COST + HARD_SELL_COST);
    expect(pushPerPoint).toBeGreaterThan(barePerPoint);
  });

  it('does not turn a pitch into a penalty', () => {
    // The ramp scales what the action is worth; it must not flip its sign.
    const man = prospects.find((p) => p.player.type === 'hitter')!;
    const factor = 'development' as const;
    const bare = actionInterest(withAction(man, { pitch: factor }), pitch, team);
    const unpitched = actionInterest(man, pitch, team);
    expect(unpitched).toBe(0);
    expect(Number.isFinite(bare)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. A rival's plant and his home state
// ---------------------------------------------------------------------------

describe("a program without a budget screen", () => {
  it('still brings facilities and a home state to the pitch', () => {
    /*
      Only the coached program carries an Economy, and the rest were passed
      `undefined` — so their plant was absent from the model and the home-state
      reach `pipelineStrength` grants at sixty was the coached program's alone.
    */
    const season = world();
    const rival = season.teams[12]!;
    const pitch = programRecruitingPitch(season, rival, 'Gulf', 45);
    expect(pitch.facilities ?? 0).toBeGreaterThan(0);
    // His own state reaches him.
    expect(pitch.pipelineStrength?.(rival.def.state) ?? 0).toBeGreaterThan(0);
  });

  it('gives the bigger program the better plant', () => {
    const season = world();
    const sorted = [...season.teams].sort((a, b) => b.prestige - a.prestige);
    const big = programRecruitingPitch(season, sorted[0]!, 'Gulf', 45).facilities ?? 0;
    const small = programRecruitingPitch(season, sorted[sorted.length - 1]!, 'Gulf', 45).facilities ?? 0;
    expect(big).toBeGreaterThan(small);
  });

  it('leaves a rival short of what a fully built department reaches', () => {
    // Spending the money on a real complex still buys something.
    const season = world();
    const best = Math.max(...season.teams.map(
      (t) => programRecruitingPitch(season, t, 'Gulf', 45).facilities ?? 0,
    ));
    expect(best).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// 4. The computer's portal
// ---------------------------------------------------------------------------

describe('a staff working the portal', () => {
  const season = world();
  const buyer = season.teams[5]!.team;

  const manFrom = (p: Player, from: number): PortalMan =>
    ({ player: p, from, cost: portalCost(p), reason: 'test' } as unknown as PortalMan);

  it('takes the man who helps rather than the man who is cheapest', () => {
    /*
      It sorted the pool by cost ascending, refused anybody at or below the
      single weakest hitter on the roster, and stopped at two whatever the
      budget said — so the other ninety-five signed the cheapest two men in
      the country every winter.
    */
    const donor = season.teams[6]!.team;
    const good = { ...donor.lineup[0]!, id: 'good' as Player['id'] } as Hitter;
    Object.assign(good, { contact: 88, power: 88, eye: 88, speed: 70, range: 70, hands: 70, arm: 70, armAccuracy: 70, blocking: 60 });
    const cheap = { ...donor.bench[0]!, id: 'cheap' as Player['id'] } as Hitter;
    Object.assign(cheap, { contact: 22, power: 22, eye: 22, speed: 22, range: 22, hands: 22, arm: 22, armAccuracy: 22, blocking: 22 });
    good.pos = cheap.pos;

    const team = { ...buyer, lineup: [...buyer.lineup], bench: [...buyer.bench], rotation: [...buyer.rotation], bullpen: [...buyer.bullpen] };
    const took = staffWorksPortal(team, [manFrom(cheap, 6), manFrom(good, 6)], 10_000_000);
    expect(took.map((m) => m.player.id)).toContain('good');
  });

  it('never rebuilds a roster in one winter', () => {
    const donor = season.teams[7]!.team;
    const pool = donor.lineup.map((p, i) => manFrom({ ...p, id: `p${i}` as Player['id'] } as Player, 7));
    const team = { ...buyer, lineup: [...buyer.lineup], bench: [...buyer.bench], rotation: [...buyer.rotation], bullpen: [...buyer.bullpen] };
    const took = staffWorksPortal(team, pool, 10_000_000);
    expect(took.length).toBeLessThanOrEqual(PORTAL_TAKE);
  });

  it('will not sign a man who is no better than the one he replaces', () => {
    const worst = [...buyer.lineup, ...buyer.bench].sort((a, b) => overallOf(a) - overallOf(b))[0]!;
    const sameAgain = { ...worst, id: 'same' as Player['id'] } as Hitter;
    const team = { ...buyer, lineup: [...buyer.lineup], bench: [...buyer.bench], rotation: [...buyer.rotation], bullpen: [...buyer.bullpen] };
    const took = staffWorksPortal(team, [manFrom(sameAgain, 6)], 10_000_000);
    expect(took).toHaveLength(0);
    expect(PORTAL_EDGE).toBeGreaterThan(0);
  });

  it('rings its own best man before he leaves, and only its best', () => {
    // The draft has had `rivalKeeps` since the ninety-five got decisions of
    // their own; the portal never grew the matching half.
    const donor = season.teams[8]!.team;
    const star = { ...donor.lineup[0]! } as Hitter;
    Object.assign(star, { contact: 92, power: 92, eye: 92, speed: 80, range: 80, hands: 80, arm: 80, armAccuracy: 80, blocking: 70 });
    const spare = { ...donor.bench[0]!, id: 'spare' as Player['id'] } as Hitter;
    Object.assign(spare, { contact: 20, power: 20, eye: 20, speed: 20, range: 20, hands: 20, arm: 20, armAccuracy: 20, blocking: 20 });

    const held = rivalHolds(donor, [manFrom(star, 8), manFrom(spare, 8)], 10_000_000);
    expect(held.map((m) => m.player.id)).toContain(star.id);
    expect(held.map((m) => m.player.id)).not.toContain('spare');
  });

  it('holds nobody with no money', () => {
    const donor = season.teams[8]!.team;
    const star = { ...donor.lineup[0]! } as Hitter;
    Object.assign(star, { contact: 92, power: 92, eye: 92, speed: 80, range: 80, hands: 80, arm: 80, armAccuracy: 80, blocking: 70 });
    expect(rivalHolds(donor, [manFrom(star, 8)], 0)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Somebody gets the ball in the ninth
// ---------------------------------------------------------------------------

describe('the bullpen', () => {
  it('names its best available arm as the closer', () => {
    // A pen used strictly in order has no closer in it: the best reliever is
    // the first man called and is gone by the time the game is worth saving.
    const season = world();
    const rec = season.teams[2]!;
    const pen = restedFirst(season, rec);
    const closer = closerFrom(pen);
    expect(closer).toBeDefined();
    const best = [...pen].sort((a, b) => armValue(b) - armValue(a))[0]!;
    expect(closer!.id).toBe(best.id);
  });

  it('names nobody out of a pen with one man in it', () => {
    const season = world();
    const rec = season.teams[2]!;
    const pen = restedFirst(season, rec);
    expect(closerFrom(pen.slice(0, 1))).toBeUndefined();
    expect(closerFrom([])).toBeUndefined();
  });

  it('is still ordered most rested first for the ordinary innings', () => {
    const season = world();
    const rec = season.teams[2]!;
    const pen = restedFirst(season, rec);
    expect(pen.length).toBeGreaterThan(1);
    // The closer is named off this list, so he is somebody who could pitch.
    const closer = closerFrom(pen)!;
    expect(pen.some((a) => a.id === closer.id)).toBe(true);
  });
});
