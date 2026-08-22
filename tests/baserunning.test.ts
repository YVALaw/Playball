// baserunning.test.ts
// Nobody vanishes.
//
// Reported from a managed game: a runner was aboard, the next batter reached on
// an error, and the runner already on base simply disappeared — no out, no line
// in the log, gone.
//
// `advanceOnHit` wrote each runner to his destination without checking whether
// the man ahead was standing on it. With men on first and second on a single,
// the runner from second holds at third, then the runner from first is also sent
// to third and overwrites him.
//
// This hides from every other kind of check. The game stays internally
// consistent — outs still reach 27, the linescore still adds up — it just
// quietly scores fewer runs than it should.

import { describe, it, expect } from 'vitest';
import { advanceOnHit, type Bases } from '../src/engine/game.js';
import { makeHitter, makePitcher, resetNames } from '../src/engine/players.js';
import { makeRng } from '../src/engine/rng.js';
import { RUNNING } from '../src/engine/strategy.js';
import type { Hitter, Pitcher } from '../src/engine/types.js';

function cast(): { men: Hitter[]; arm: Pitcher } {
  resetNames();
  const rng = makeRng(7);
  return {
    men: [makeHitter(rng, 50), makeHitter(rng, 50), makeHitter(rng, 50)],
    arm: makePitcher(rng, 50),
  };
}

/**
 * A generator that plays exactly the script it is given, then settles at 0.5.
 *
 * A seeded RNG cannot do this job. The first version of this test used one and
 * passed against the *unfixed* engine, because the sequence it happened to
 * produce always let the lead runner score — which leaves nobody at third for
 * the trailing runner to be written on top of, so the collision never occurred.
 * The bug needs one specific pair of dice rolls, so the test supplies them.
 */
const scripted = (values: number[]) => {
  let i = 0;
  return () => (i < values.length ? values[i++] as number : 0.5);
};

describe('runners are conserved on a hit', () => {
  it('holds the trailing runner up instead of overwriting the man on third', () => {
    const { men, arm } = cast();
    const [fromFirst, fromSecond, batter] =
      men as [Hitter, Hitter, Hitter];

    const bases: Bases = [fromFirst, fromSecond, null];
    const scored: Hitter[] = [];

    // 0.99: the man from second fails to score, so he holds at third.
    // 0.01: the man from first succeeds in trying for third — the collision.
    // 0.99: and is not thrown out, so he must be somewhere afterwards.
    const retired = advanceOnHit(
      bases, batter, 1, scripted([0.99, 0.01, 0.99]),
      scored, new Map(), arm, RUNNING.balanced, 50,
    );

    const onBase = bases.filter((r: Hitter | null): r is Hitter => r !== null);
    const accounted = onBase.length + scored.length + retired;

    expect(accounted, 'a runner fell out of the game').toBe(3);
    expect(new Set(onBase.map((p: Hitter) => p.name)).size).toBe(onBase.length);

    // The specific correct outcome: he cannot pass the man ahead, so he stops.
    expect(bases[2]?.name, 'third belongs to the runner who got there first')
      .toBe(fromSecond.name);
    expect(bases[1]?.name, 'the trailing runner is held at second')
      .toBe(fromFirst.name);
    expect(bases[0]?.name).toBe(batter.name);
  });

  it('never loses a man from any base state, on any hit', () => {
    const states = [[0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]];
    for (const occupied of states) {
      for (const numBases of [1, 2, 3]) {
        for (let seed = 1; seed <= 200; seed++) {
          const { men, arm } = cast();
          const bases: Bases = [null, null, null];
          const before: Hitter[] = [];
          occupied.forEach((b, i) => {
            bases[b] = men[i] as Hitter; before.push(men[i] as Hitter);
          });
          const batter = makeHitter(makeRng(seed + 5000), 50);
          const scored: Hitter[] = [];

          const retired = advanceOnHit(
            bases, batter, numBases, makeRng(seed * 104729),
            scored, new Map(), arm, RUNNING.balanced, 50,
          );

          const onBase = bases.filter((r: Hitter | null): r is Hitter => r !== null);
          const names = [...onBase, ...scored].map((p: Hitter) => p.name);
          expect(new Set(names).size, 'a runner is in two places').toBe(names.length);
          expect(
            onBase.length + scored.length + retired,
            `lost a runner (seed ${seed}, ${numBases} bases, from ${occupied.join(',')})`,
          ).toBe(before.length + 1);
        }
      }
    }
  });
});
