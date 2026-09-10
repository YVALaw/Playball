// best-nine.test.ts
// AUTO fields the best nine the squad has, not the nine it was handed.
//
// Reported from the phone on 2026-09-10: AUTO "kept two freshmen at 50 overall
// on the bench and two juniors at 25 overall starting". The fit pass under AUTO
// only ever moved a man who could not play, so a card written in August kept
// its August starters all spring. `bestNine` picks by merit.

import { describe, it, expect } from 'vitest';
import { bestNine, fitAt, SPOTS, squad, type DepthChart } from '../src/engine/depthChart.js';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { overallOf } from '../src/engine/ratings.js';
import { useDynasty } from '../src/state/store.js';
import type { Hitter, Team } from '../src/engine/types.js';

const fresh = (): Team => {
  const world = createSeason(makeRng(4242), undefined, CONFERENCES);
  return world.teams[11]!.team;
};

/** Make him the best, or the worst, position player on the roster by a mile. */
const rate = (h: Hitter, v: number): void => {
  Object.assign(h, {
    contact: v, power: v, eye: v, speed: v,
    range: v, hands: v, arm: v, armAccuracy: v, blocking: v,
  });
};

describe('the best nine', () => {
  it('promotes a better bench man over a healthy weaker starter', () => {
    const team = fresh();
    const weak = team.lineup.find((p) => p.pos === '1B')!;
    const kid = team.bench[0]!;
    kid.pos = '1B';
    delete kid.homePos;
    rate(kid, 80);
    // A passenger: below every man on this bench, which on this roster means
    // single digits — the fixture's reserves are in the low twenties.
    rate(weak, 5);
    expect(overallOf(kid)).toBeGreaterThan(overallOf(weak));

    const { lineup, bench } = bestNine(team, 0);
    expect(lineup.map((p) => p.id)).toContain(kid.id);
    expect(bench.map((p) => p.id)).toContain(weak.id);
    // He plays somewhere he can play — first base, a corner he covers, or the
    // DH — not behind the plate on the strength of his bat.
    const placed = lineup.find((p) => p.id === kid.id)!;
    expect(fitAt(placed, placed.pos)).not.toBe('stretch');
    // Sent down, he is himself again.
    expect(weak.homePos).toBeUndefined();
  });

  it('does not put a big bat behind the plate', () => {
    const team = fresh();
    const catcher = team.lineup.find((p) => p.pos === 'C')!;
    const kid = team.bench[0]!;
    kid.pos = '1B';
    delete kid.homePos;
    rate(kid, 80);
    const { lineup } = bestNine(team, 0);
    expect(lineup.find((p) => p.pos === 'C')!.id).toBe(catcher.id);
  });

  it('fields nine different men at nine different spots', () => {
    const team = fresh();
    const { lineup, bench } = bestNine(team, 0);
    expect(lineup).toHaveLength(9);
    expect(new Set(lineup.map((p) => p.id)).size).toBe(9);
    expect(new Set(lineup.map((p) => p.pos)).size).toBe(9);
    for (const spot of SPOTS) {
      expect(lineup.some((p) => p.pos === spot), `${spot} is empty`).toBe(true);
    }
    expect(lineup.length + bench.length).toBe(squad(team).length);
  });

  it('skips a man who cannot play, however good he is', () => {
    const team = fresh();
    const kid = team.bench[0]!;
    rate(kid, 90);
    (kid as Hitter & { outUntil?: number }).outUntil = 999;
    const { lineup } = bestNine(team, 0);
    expect(lineup.map((p) => p.id)).not.toContain(kid.id);
  });

  it('is the same nine twice', () => {
    const team = fresh();
    const once = bestNine(team, 0);
    team.lineup.splice(0, team.lineup.length, ...once.lineup);
    team.bench.splice(0, team.bench.length, ...once.bench);
    const twice = bestNine(team, 0);
    expect(twice.lineup.map((p) => p.id)).toEqual(once.lineup.map((p) => p.id));
  });

  it('keeps what a coach wrote at a spot', () => {
    const team = fresh();
    const men = squad(team);
    const chosen = men[men.length - 1]!;
    (team as Team & { depth?: DepthChart }).depth = { SS: [chosen.id] };
    const { lineup } = bestNine(team, 0);
    expect(lineup.find((p) => p.pos === 'SS')!.id).toBe(chosen.id);
  });
});

describe('AUTO on the lineup screen', () => {
  it('fields the freshman over the passenger', () => {
    useDynasty.getState().start(4242, 0);
    const state = useDynasty.getState();
    const team = state.season!.teams[state.userTeam]!.team;
    const weak = team.lineup.find((p) => p.pos === '1B')!;
    const kid = team.bench[0]!;
    kid.pos = '1B';
    delete kid.homePos;
    rate(kid, 80);
    rate(weak, 5);

    useDynasty.getState().autoLineup();
    expect(team.lineup.map((p) => p.id)).toContain(kid.id);
    expect(team.bench.map((p) => p.id)).toContain(weak.id);
    expect(new Set(team.lineup.map((p) => p.pos)).size).toBe(9);
  });
});
