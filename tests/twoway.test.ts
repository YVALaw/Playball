// twoway.test.ts
// One man in two rating systems at once — stage 16's biggest unit, split out
// of stage 8 with the design already settled: they arrive two-way rather
// than being made, they are rare the way they are in life, and pitching
// does not suppress the bat. He is ONE object standing in two arrays, which
// is what makes the fatigue crossing real and what these tests hold.

import { describe, it, expect } from 'vitest';
import { makeTwoWay, makeTeam, resetNames } from '../src/engine/players.js';
import { makeRng } from '../src/engine/rng.js';
import { generateClass } from '../src/engine/recruiting.js';
import { isTwoWay, uniquePlayers } from '../src/engine/types.js';
import { armValue, overallOf, platoonMultiplier } from '../src/engine/ratings.js';
import { tendenciesOf, HITTER_TENDENCIES, PITCHER_TENDENCIES, teamReads } from '../src/engine/tendencies.js';
import { repertoireOf } from '../src/engine/pitches.js';
import { simGame, TeamState } from '../src/engine/game.js';
import { threw } from '../src/engine/workload.js';
import type { Player, TwoWay } from '../src/engine/types.js';

const fresh = (seed = 4242): TwoWay => {
  resetNames();
  return makeTwoWay(makeRng(seed), 55);
};

describe('the man himself', () => {
  it('is a hitter who carries a whole arm, flattened', () => {
    const man = fresh();
    expect(man.type).toBe('hitter');
    expect(man.twoWay).toBe(true);
    expect(man.pos).toBe('DH');
    expect(man.role).toBe('SP');
    for (const k of ['stuff', 'movement', 'control', 'stamina', 'velocity', 'groundBall', 'holdRunners'] as const) {
      expect(Number.isFinite(man[k]), k).toBe(true);
    }
    // Two worths, one body: the card ranks his bat, the rotation his arm.
    expect(overallOf(man)).not.toBeNaN();
    expect(armValue(man)).not.toBeNaN();
  });

  it('reads on both sides of the ball', () => {
    const man = fresh();
    const slots = Object.keys(tendenciesOf(man));
    for (const slot of [...HITTER_TENDENCIES, ...PITCHER_TENDENCIES]) {
      expect(slots).toContain(slot);
    }
    // His repertoire builds off the flattened arm without a cast in sight.
    expect(repertoireOf(man).length).toBeGreaterThanOrEqual(2);
    // And the mound split rides armPlatoon, not his batting split.
    const bat = makeTeam(makeRng(7), 'T', 50).lineup[0]!;
    expect(Number.isFinite(platoonMultiplier(bat, man))).toBe(true);
  });

  it('arrives at most three to a national class, and usually fewer', () => {
    resetNames();
    const rng = makeRng(1717);
    let total = 0;
    let most = 0;
    for (let y = 0; y < 8; y++) {
      const cls = generateClass(2030 + y, 96, rng);
      const n = cls.prospects.filter((pr) => isTwoWay(pr.player)).length;
      total += n;
      most = Math.max(most, n);
    }
    expect(most).toBeLessThanOrEqual(3);
    expect(total).toBeGreaterThan(0);
    expect(total / 8).toBeLessThan(3);
  });
});

describe('both jobs at once', () => {
  /** A club whose Friday starter is also its DH — the whole door in one team. */
  const club = (seed: number) => {
    resetNames();
    const rng = makeRng(seed);
    const team = makeTeam(rng, 'TW', 55);
    const man = makeTwoWay(rng, 58);
    team.lineup[8] = man;          // the DH spot
    team.rotation[0] = man;        // and the Friday ball
    return { team, man, rng };
  };

  it('bats for himself while he pitches, and the game balances', () => {
    const { team, man, rng } = club(31);
    resetNames();
    const other = makeTeam(rng, 'OPP', 52);
    const res = simGame(team, other, rng, { homeStarter: 0 });
    // He took the mound: his pitching line exists and holds real outs.
    const hisArm = [...res.home.pitching.values()].find((l) => l.player.id === man.id);
    expect(hisArm).toBeDefined();
    expect((hisArm?.outs ?? 0)).toBeGreaterThan(0);
    // And he batted for himself: a batting line in the same box score.
    const hisBat = [...res.home.batting.values()].find((l) => l.player.id === man.id);
    expect(hisBat).toBeDefined();
    expect((hisBat?.ab ?? 0) + (hisBat?.bb ?? 0)).toBeGreaterThan(0);
  });

  it('never stands in the field while he pitches', () => {
    // Stage 21: the field map used to seat him in left while he stood
    // sixty feet six away. On his pitching night he is mound and bat only.
    const { team, man } = club(58);
    const st = new TeamState(team, true, 0);
    for (const fielder of st.byPosition.values()) {
      expect(String(fielder.id)).not.toBe(String(man.id));
    }
  });

  it('a bench glove covers the spot his bat vacates, and the DH keeps the DH seat', () => {
    resetNames();
    const rng = makeRng(66);
    const team = makeTeam(rng, 'TW', 55);
    const man = makeTwoWay(rng, 58);
    // He grew into left field over a winter; the DH seat belongs to
    // another bat entirely.
    man.pos = 'LF';
    const lfIdx = team.lineup.findIndex((h) => h.pos === 'LF');
    expect(lfIdx).toBeGreaterThanOrEqual(0);
    team.lineup[lfIdx] = man;
    team.rotation[0] = man;
    const st = new TeamState(team, true, 0);
    // Nobody in the field is him.
    for (const fielder of st.byPosition.values()) {
      expect(String(fielder.id)).not.toBe(String(man.id));
    }
    // The DH man was not dragged into the grass to pay for it.
    expect(st.byPosition.get('DH')?.pos).toBe('DH');
    // And a bench body holds his spot for the night, batting nowhere.
    const cover = st.byPosition.get('LF');
    expect(cover).toBeDefined();
    expect(st.order.some((m) => String(m.id) === String(cover?.id))).toBe(false);
    expect(st.fieldCover?.spot).toBe('LF');
  });

  it('a two-way reliever is covered the moment he takes the ball', () => {
    resetNames();
    const rng = makeRng(77);
    const team = makeTeam(rng, 'TW', 55);
    const man = makeTwoWay(rng, 58);
    man.pos = 'LF';
    man.role = 'RP';
    const lfIdx = team.lineup.findIndex((h) => h.pos === 'LF');
    team.lineup[lfIdx] = man;
    // An ordinary starter has the ball; the two-way man is out in left.
    const st = new TeamState(team, true, 0);
    expect([...st.byPosition.values()].some((f) => String(f.id) === String(man.id))).toBe(true);
    st.coverPitcher(man);
    expect([...st.byPosition.values()].some((f) => String(f.id) === String(man.id))).toBe(false);
  });

  it('crosses the fatigue: a real start leans on the same body', () => {
    const { man } = club(47);
    const legsBefore = (man as Player & { straight?: number }).straight ?? 0;
    threw(man, 18);                // six innings
    const w = man as Player & { straight?: number; outs?: number };
    expect(w.outs).toBe(18);
    expect((w.straight ?? 0)).toBeGreaterThan(legsBefore);
  });

  it('is one body to every count that used to concat four arrays', () => {
    const { team, man } = club(63);
    const everybody = uniquePlayers([
      ...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen,
    ]);
    expect(everybody.filter((p) => p.id === man.id)).toHaveLength(1);
    // And the scout's book counts his arm among the arms without crashing.
    expect(teamReads(team).length).toBeGreaterThan(0);
  });
});

describe('the save', () => {
  it('keeps him one body through a structured clone, not two strangers', () => {
    /*
      The whole architecture leans on this: he is one object standing in two
      arrays, and both the IndexedDB save and the sim worker's postMessage
      serialize with the structured clone algorithm, which preserves shared
      references. If this ever fails — some codec starts round-tripping
      through JSON — his two jobs silently become two men and every
      one-body invariant in the engine rots from the save file up.
    */
    resetNames();
    const rng = makeRng(99);
    const team = makeTeam(rng, 'TW', 55);
    const man = makeTwoWay(rng, 58);
    team.lineup[8] = man;
    team.rotation[0] = man;
    const back = structuredClone(team);
    expect(back.rotation[0]).toBe(back.lineup[8]);
    expect(isTwoWay(back.rotation[0] as Player)).toBe(true);
  });
});
