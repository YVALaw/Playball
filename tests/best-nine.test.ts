// best-nine.test.ts
// AUTO fields the best nine the squad has, not the nine it was handed.
//
// Reported from the phone on 2026-09-10: AUTO "kept two freshmen at 50 overall
// on the bench and two juniors at 25 overall starting". The fit pass under AUTO
// only ever moved a man who could not play, so a card written in August kept
// its August starters all spring. `bestNine` picks by merit.

import { describe, it, expect } from 'vitest';
import { bestNine, fitAt, SPOTS, squad, type DepthChart } from '../src/engine/depthChart.js';
import { naturalPos } from '../src/engine/positions.js';
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

  it('leaves two corner outfielders where they are rather than swapping them', () => {
    // Reported: AUTO sent the RF to LF and the LF to RF, both a rung worse.
    const team = fresh();
    const lf = team.lineup.find((p) => p.pos === 'LF')!;
    const rf = team.lineup.find((p) => p.pos === 'RF')!;
    // Make the left fielder the slightly better bat, the way it was found.
    rate(lf, 52);
    rate(rf, 50);
    const { lineup } = bestNine(team, 0);
    expect(lineup.find((p) => p.id === lf.id)!.pos).toBe('LF');
    expect(lineup.find((p) => p.id === rf.id)!.pos).toBe('RF');
  });

  it('never trades two men into each other\'s spots, whatever the gap between their bats', () => {
    // The second report: a left fielder six points better still swapped
    // with the right fielder, both a rung worse. A pure swap is never a gain.
    const team = fresh();
    const lf = team.lineup.find((p) => p.pos === 'LF')!;
    const rf = team.lineup.find((p) => p.pos === 'RF')!;
    rate(lf, 56);
    rate(rf, 44);
    const { lineup } = bestNine(team, 0);
    expect(lineup.find((p) => p.id === lf.id)!.pos).toBe('LF');
    expect(lineup.find((p) => p.id === rf.id)!.pos).toBe('RF');
  });

  it('leaves a DH by label at first base without a tax', () => {
    const team = fresh();
    const dh = [...team.lineup, ...team.bench].find((p) => p.pos === 'DH');
    if (!dh) return;
    const real = naturalPos(dh);
    const { lineup } = bestNine(team, 0);
    const placed = lineup.find((p) => p.id === dh.id);
    if (placed && placed.pos === real) expect(fitAt(placed, placed.pos)).toBe('his own');
  });

  it('still moves a cover in when he is clearly the better man', () => {
    const team = fresh();
    const weak2b = team.lineup.find((p) => p.pos === '2B')!;
    // A bench third baseman — a natural cover at second — far better than
    // the man standing there. Third itself stays with its own man.
    const third = team.bench[0]!;
    third.pos = '3B';
    delete third.homePos;
    rate(third, 70);
    rate(weak2b, 30);
    const { lineup } = bestNine(team, 0);
    // He is in the nine, at second or — if the passenger was a better cover
    // at third than the man there, so the pair went home — at his own third.
    const placed = lineup.find((p) => p.id === third.id);
    expect(placed).toBeDefined();
    expect(['2B', '3B']).toContain(placed!.pos);
    expect(fitAt(placed!, placed!.pos)).not.toBe('stretch');
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

  it('brings a better starter up from the pen, and sends the worst one down as a starter by trade', () => {
    // Reported: "a lot of better freshman SP in the bullpen but they are not
    // being brought to the starting position."
    useDynasty.getState().start(4242, 0);
    const state = useDynasty.getState();
    const team = state.season!.teams[state.userTeam]!.team;
    const arm = team.bullpen[0]!;
    arm.role = 'SP';
    delete arm.homeRole;
    Object.assign(arm, { stuff: 85, movement: 85, control: 85, stamina: 80 });
    const before = [...team.rotation];

    useDynasty.getState().autoLineup();
    expect(team.rotation.some((p) => p.id === arm.id)).toBe(true);
    expect(team.rotation).toHaveLength(before.length);
    const sentDown = before.find((p) => !team.rotation.some((r) => r.id === p.id))!;
    expect(team.bullpen.some((p) => p.id === sentDown.id)).toBe(true);
    // A starter by trade keeps the label in the pen; a reliever borrowed for
    // Friday would go back to RP.
    expect(sentDown.role).toBe('SP');
  });
});
