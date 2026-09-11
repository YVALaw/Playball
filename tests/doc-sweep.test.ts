// doc-sweep.test.ts
// The six faults the September 11 2026 documentation sweep turned up.
//
// The docs had drifted a week behind the code, so the sweep checked every
// standing claim against the source and threw most of them away. What survived
// was six things a player meets in ordinary play, four of them written down
// somewhere as a measured decision nobody had taken and two of them never
// written down at all. This file is the guard on each.

import { describe, it, expect } from 'vitest';
import { createSeason } from '../src/engine/season.js';
import { tacticMods, winningPitcherFor } from '../src/engine/game.js';
import { BASERUNNING } from '../src/engine/ratings.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { autoBattingOrder, DEFAULT_STRATEGY } from '../src/engine/strategy.js';
import { leagueBaselines, opponentPlan } from '../src/engine/counters.js';
import { advanceOffseason } from '../src/engine/progression.js';
import { armShare, squadRanks } from '../src/engine/morale.js';
import { SPOTS } from '../src/engine/depthChart.js';
import { overallOf } from '../src/engine/ratings.js';
import type { Arm, Player, PlayerId } from '../src/engine/types.js';

const world = () => createSeason(makeRng(4242), undefined, CONFERENCES);

// ---------------------------------------------------------------------------
// 1. The catcher led off for ninety-five programs, forever
// ---------------------------------------------------------------------------

describe('every program in the country', () => {
  it('bats a dealt order rather than the list its roster was built in', () => {
    /*
      `makeTeam` writes a lineup in positional order — C, 1B, 2B, 3B, SS, LF,
      CF, RF, DH — and `bestNine`/`autoBattingOrder` were only ever called for
      the coached program. Measured at 0.06 runs a game and a point of winning
      percentage (05 §62.7), and visible in every box score in the league.
    */
    const season = world();
    const catchersLeadingOff = season.teams
      .filter((t) => t.team.lineup[0]?.pos === 'C').length;
    expect(catchersLeadingOff).toBeLessThan(season.teams.length / 4);

    // Dealt means dealt: running the deal again is running it once.
    for (const rec of season.teams) {
      const again = autoBattingOrder(rec.team.lineup);
      expect(again.map((p) => p.id)).toEqual(rec.team.lineup.map((p) => p.id));
    }
  });

  it('fields nine different men at nine different spots', () => {
    const season = world();
    for (const rec of season.teams) {
      const nine = rec.team.lineup;
      expect(nine).toHaveLength(9);
      expect(new Set(nine.map((p) => p.id)).size).toBe(9);
      for (const spot of SPOTS) {
        expect(nine.some((p) => p.pos === spot), `${rec.def.abbr} has nobody at ${spot}`).toBe(true);
      }
    }
  });

  it('deals again after a roll, when a quarter of the country has graduated', () => {
    const season = world();
    const rng = makeRng(7);
    advanceOffseason(season, rng, { userTeam: 0 });
    // Somebody other than the coached program, whose card is his own.
    for (const rec of season.teams.slice(1)) {
      const again = autoBattingOrder(rec.team.lineup);
      expect(again.map((p) => p.id)).toEqual(rec.team.lineup.map((p) => p.id));
    }
  });

  it('leaves the coached program his own card at the roll', () => {
    // His card is his: the lineup screen writes it, or his staff does.
    const season = world();
    const mine = season.teams[0]!;
    const before = mine.team.lineup.map((p) => p.id);
    // Scramble it the way a coach who likes his catcher leading off would.
    mine.team.lineup.reverse();
    const scrambled = mine.team.lineup.map((p) => p.id);
    expect(scrambled).not.toEqual(before);
    advanceOffseason(season, makeRng(7), { userTeam: 0 });
    // Graduation moves men, so the order is not compared; what matters is
    // that nothing re-dealt it behind him.
    const survivors = mine.team.lineup.map((p) => p.id).filter((id) => scrambled.includes(id));
    const inScrambledOrder = scrambled.filter((id) => survivors.includes(id));
    expect(survivors).toEqual(inScrambledOrder);
  });
});

// ---------------------------------------------------------------------------
// 2. PLAY FOR CONTACT made the run on third less likely
// ---------------------------------------------------------------------------

describe('playing for contact', () => {
  it('raises the sacrifice fly rather than lowering it', () => {
    // The rate was 0.58 against a 0.62 default, so the one call whose whole
    // purpose is the run on third made it less likely than doing nothing.
    const contact = tacticMods('contact');
    expect(contact?.sacFly).toBeDefined();
    expect(contact!.sacFly!).toBeGreaterThan(BASERUNNING.sacFlyOnFly);
  });

  it('still gives away the power it is trading', () => {
    const contact = tacticMods('contact');
    expect(contact!.events!.homerun!).toBeLessThan(1);
    expect(contact!.events!.single!).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// 3. The counter-plan's standing INFIELD IN
// ---------------------------------------------------------------------------

describe('the plan against an opponent', () => {
  it('never brings the infield in for a whole season', () => {
    /*
      It did so against fifty-one of ninety-six, and the strategy audit
      measured it as the one positioning call that costs runs against every
      lineup shape tried — 0.316 a game (docs/15 §L). Playing in is a decision
      about one run with a man on third; it is not a plan for March.
    */
    const season = world();
    const baselines = leagueBaselines(season);
    for (const opp of season.teams) {
      const plan = opponentPlan(season, opp, DEFAULT_STRATEGY, baselines);
      expect(plan.infield, `${opp.def.abbr}`).not.toBe('in');
    }
  });

  it('still plays back against the lineups that earn it', () => {
    const season = world();
    const baselines = leagueBaselines(season);
    const plans = season.teams.map((opp) => opponentPlan(season, opp, DEFAULT_STRATEGY, baselines));
    expect(plans.some((p) => p.infield === 'back')).toBe(true);
    expect(plans.some((p) => p.infield === 'normal')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. The starter's win in a game the run rule cut short
// ---------------------------------------------------------------------------

describe("the starter's win", () => {
  const sideWith = (outs: number): Parameters<typeof winningPitcherFor>[0] => {
    const starter = { id: 'sp1' as PlayerId } as unknown as Arm;
    return {
      starter,
      pitching: new Map([[starter.id, { outs }]]),
    } as unknown as Parameters<typeof winningPitcherFor>[0];
  };

  it('asks five innings in a nine-inning game', () => {
    const side = sideWith(12);
    expect(winningPitcherFor(side, side.starter, 9)).not.toBe(side.starter);
    const long = sideWith(15);
    expect(winningPitcherFor(long, long.starter, 9)).toBe(long.starter);
  });

  it('asks four in one the run rule ended at seven', () => {
    // The run rule is on by default and stops a game at seven, so a starter
    // who went four of a rout had his win handed to a reliever.
    const side = sideWith(12);
    expect(winningPitcherFor(side, side.starter, 7)).toBe(side.starter);
  });

  it('never takes a win off a reliever', () => {
    const side = sideWith(3);
    const reliever = { id: 'rp1' as PlayerId } as unknown as Arm;
    expect(winningPitcherFor(side, reliever, 9)).toBe(reliever);
  });
});

// ---------------------------------------------------------------------------
// 5. Every arm in the country read as buried
// ---------------------------------------------------------------------------

describe('a pitcher in his own squad', () => {
  it('is ranked among pitchers, not lost behind thirty hitters', () => {
    // `squadRanks` walked the lineup and the bench only, so every arm fell
    // through to the caller's default of twentieth — for life.
    const season = world();
    const rec = season.teams[3]!;
    const ranks = squadRanks(rec.team);
    for (const arm of [...rec.team.rotation, ...rec.team.bullpen]) {
      expect(ranks.get(arm.id), `${arm.name} is unranked`).toBeDefined();
    }
    const best = [...rec.team.rotation, ...rec.team.bullpen]
      .sort((a, b) => overallOf(b) - overallOf(a))[0]!;
    expect(ranks.get(best.id)).toBe(1);
  });

  it('puts the four who take the ball on the everyday nine’s rung', () => {
    const season = world();
    const rec = season.teams[3]!;
    const ranks = squadRanks(rec.team);
    const byQuality = [...rec.team.rotation, ...rec.team.bullpen]
      .sort((a, b) => overallOf(b) - overallOf(a));
    expect(ranks.get(byQuality[3]!.id)).toBe(4);
    // And the fifth arm lands on the bench's rung rather than the nine's.
    expect(ranks.get(byQuality[4]!.id)).toBe(9);
  });

  it('is measured against the busiest man on his own staff', () => {
    // A hitter's share is starts over games played. Nobody pitches forty-five
    // times, so an arm is asked whether he was used like the men around him.
    const season = world();
    const rec = season.teams[3]!;
    const staff: Player[] = [...rec.team.rotation, ...rec.team.bullpen];
    const outings = new Map<PlayerId, number>(staff.map((a, i) => [a.id, i === 0 ? 14 : 7]));
    const ace = armShare(staff[0]!, staff, (id) => outings.get(id) ?? 0);
    expect(ace.starts / ace.games).toBe(1);
    const middle = armShare(staff[1]!, staff, (id) => outings.get(id) ?? 0);
    expect(middle.starts / middle.games).toBe(0.5);
  });

  it('never divides by a staff that has not pitched', () => {
    const season = world();
    const staff: Player[] = [...season.teams[3]!.team.rotation];
    const share = armShare(staff[0]!, staff, () => 0);
    expect(share.games).toBeGreaterThan(0);
    expect(share.starts).toBe(0);
  });
});
