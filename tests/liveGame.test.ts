// liveGame.test.ts
// The managed game: the calls a human makes, and the calls the engine must not
// make for him.
//
// Every failure here shipped at least once. A caught runner used to vanish from
// first with the outs counter untouched; the engine stole with the manager's
// runners and burned his relievers uninvited; picking the third arm on the pen
// list silently discarded the two ahead of him; and a pinch hitter was spliced
// out of the season's bench for good — a substitution that doubled as a roster
// cut.

import { describe, it, expect } from 'vitest';
import { makeRng } from '../src/engine/rng.js';
import { makeTeam, resetNames } from '../src/engine/players.js';
import { createHalfInning, TeamState } from '../src/engine/game.js';
import { createLiveGame } from '../src/engine/liveGame.js';
import type { EngineFn, PAContext, Rng } from '../src/engine/types.js';

/**
 * A scripted engine: each plate appearance resolves to the next entry in the
 * queue, no dice involved. Lets a test place runners exactly where it wants
 * them. Paired with a constant rng of 0.99, which fails every optional roll —
 * no errors, no extra bases taken, no automatic steal attempts, and any steal
 * that is forced anyway is thrown out (success caps at 0.94).
 */
const script = (queue: Array<'single' | 'strikeout'>): EngineFn => () => {
  const next = queue.shift() ?? 'strikeout';
  return next === 'single'
    ? { event: 'single', kind: 'line', pitches: ['inplay'], engine: 'log5' }
    : { event: 'out', kind: 'strikeout', pitches: ['swinging', 'swinging', 'swinging'], engine: 'log5' };
};

const alwaysCaught: Rng = () => 0.99;

function twoTeams(seed: number) {
  resetNames();
  const rng = makeRng(seed);
  const bats = makeTeam(rng, 'Bats', 50);
  const field = makeTeam(rng, 'Field', 50);
  return { rng, bats, field };
}

describe('caught stealing', () => {
  it('records an out', () => {
    const { bats, field } = twoTeams(99);
    const bat = new TeamState(bats, false);
    const fld = new TeamState(field, true);
    const half = createHalfInning(
      bat, fld, 1, script(['single']), alwaysCaught, () => {},
      false, null, undefined, true, false,
    );

    half.step();                            // leadoff single: a runner on first
    const runner = half.bases[0];
    expect(runner).not.toBeNull();

    const spotBefore = bat.spot;
    const ended = half.step('steal');       // success roll 0.99: he is out
    expect(ended).toBe(false);              // one out is not three
    expect(half.outs).toBe(1);              // the out that used to go missing
    expect(half.bases).toEqual([null, null, null]);
    expect(bat.hitLine(runner!).cs).toBe(1);
    // The steal did not consume the batter: the same man is still due up.
    expect(bat.spot).toBe(spotBefore);
    // And the out is charged to the pitcher on the mound.
    expect(fld.pitchLine(fld.pitcher).outs).toBe(1);
  });

  it('can end the inning, with the batter keeping his turn', () => {
    const { bats, field } = twoTeams(99);
    const bat = new TeamState(bats, false);
    const fld = new TeamState(field, true);
    const half = createHalfInning(
      bat, fld, 1, script(['strikeout', 'strikeout', 'single']), alwaysCaught, () => {},
      false, null, undefined, true, false,
    );

    half.step();                            // one down
    half.step();                            // two down
    half.step();                            // single: two out, man on first
    expect(half.outs).toBe(2);
    const spotBefore = bat.spot;

    expect(half.step('steal')).toBe(true);  // caught: that is the third out
    expect(half.outs).toBe(3);
    expect(half.done).toBe(true);
    // The batter never saw a pitch; he leads off the next inning.
    expect(bat.spot).toBe(spotBefore);
  });
});

describe('the coach-skill nudge', () => {
  // Asserted at the plumbing level rather than as a win rate on purpose. The
  // edge is roughly a third of home field (1.0079 against 1.020, itself worth
  // about five points of win probability), so proving the direction empirically
  // needs tens of thousands of games to clear sampling noise — a scratchpad
  // probe, not a CI test. What CI can pin exactly is that the multipliers are
  // computed right and arrive in the plate appearance context, which is the
  // part that silently died once already for defenseMult.
  it('turns skills into multipliers, neutral at the starting 20', () => {
    const { bats } = twoTeams(321);
    const modded = new TeamState(
      bats, false, 0, undefined, undefined, undefined, { offense: 99, defense: 99 },
    );
    expect(modded.coachOffMult).toBeCloseTo(1.0079, 9);
    expect(modded.coachDefMult).toBeCloseTo(0.9921, 9);

    const neutral = new TeamState(
      bats, false, 0, undefined, undefined, undefined, { offense: 20, defense: 20 },
    );
    expect(neutral.coachOffMult).toBe(1);
    expect(neutral.coachDefMult).toBe(1);

    const unset = new TeamState(bats, false);
    expect(unset.coachOffMult).toBe(1);
    expect(unset.coachDefMult).toBe(1);
  });

  it('reaches the plate appearance context on the right sides', () => {
    const { bats, field } = twoTeams(322);
    const seen: PAContext[] = [];
    const spy: EngineFn = (_b, _p, ctx) => {
      seen.push(ctx);
      return {
        event: 'out', kind: 'strikeout',
        pitches: ['swinging', 'swinging', 'swinging'], engine: 'log5',
      };
    };

    const play = (batMods?: { offense: number; defense: number },
                  fldMods?: { offense: number; defense: number }): PAContext => {
      const bat = new TeamState(bats, false, 0, undefined, undefined, undefined, batMods);
      const fld = new TeamState(field, true, 0, undefined, undefined, undefined, fldMods);
      // Both sides manual, so no automatic call consumes a die roll before the
      // engine sees the context.
      const half = createHalfInning(
        bat, fld, 1, spy, alwaysCaught, () => {},
        false, null, undefined, true, true,
      );
      half.step();
      return seen[seen.length - 1] as PAContext;
    };

    const base = play();
    expect(base.offenseMult).toBe(1);

    // The batting side's offense skill lifts its own events...
    const withOffense = play({ offense: 99, defense: 20 });
    expect(withOffense.offenseMult).toBeCloseTo(1.0079, 9);
    // ...without touching the defence it faces.
    expect(withOffense.defenseMult).toBeCloseTo(base.defenseMult as number, 9);

    // And the fielding side's defense skill shades its own defenseMult down.
    const withDefense = play(undefined, { offense: 20, defense: 99 });
    expect((withDefense.defenseMult as number) / (base.defenseMult as number))
      .toBeCloseTo(0.9921, 9);
    expect(withDefense.offenseMult).toBe(1);
  });
});

describe('a managed game', () => {
  it('never steals or changes pitchers on the manager\'s side uninvited', () => {
    for (const seed of [7, 1234, 55555]) {
      const { rng, bats: homeTeam, field: awayTeam } = twoTeams(seed);
      const live = createLiveGame(homeTeam, awayTeam, rng, { managing: 'home' });

      let guard = 0;
      while (!live.over && guard++ < 800) {
        const p = live.pending;
        if (!p) break;
        live.submit(p.side === 'offense' ? 'swing' : 'pitch');
      }
      expect(live.over).toBe(true);

      // Anything the log says my players did on the bases or the mound, I did
      // not ask for — the test never calls steal, pinch hit or the bullpen.
      const mine = new Set([
        ...homeTeam.lineup.map((h) => h.name),
        ...homeTeam.bench.map((h) => h.name),
      ]);
      const myArms = new Set(homeTeam.bullpen.map((p) => p.name));
      for (const raw of live.log) {
        const line = raw.trim();
        const steal = /^(.+) (?:steals second|is caught stealing)/.exec(line);
        if (steal) expect(mine.has(steal[1]!)).toBe(false);
        const change = /^Pitching change: (.+) \(/.exec(line);
        if (change) expect(myArms.has(change[1]!)).toBe(false);
      }
    }
  });
});

describe('the bullpen', () => {
  it('spends only the arm chosen, and never offers a used arm again', () => {
    const { rng, bats: homeTeam, field: awayTeam } = twoTeams(42);
    // Managing the home side, which fields the top of the first: the pen is
    // ours to work from the first decision.
    const live = createLiveGame(homeTeam, awayTeam, rng, { managing: 'home' });
    expect(live.pending?.side).toBe('defense');

    const pen = [...live.bullpenAvailable];
    expect(pen.length).toBeGreaterThanOrEqual(3);
    const [first, second, third] = pen;

    // Take the third-listed arm. The two ahead of him are not discarded.
    expect(live.changePitcher(third!)).toBe(true);
    expect(live.bullpenAvailable).toContain(first);
    expect(live.bullpenAvailable).toContain(second);
    expect(live.bullpenAvailable).not.toContain(third);

    // Go back for an earlier arm; the man he replaced never re-enters.
    expect(live.changePitcher(first!)).toBe(true);
    expect(live.bullpenAvailable).not.toContain(first);
    expect(live.bullpenAvailable).not.toContain(third);
    expect(live.bullpenAvailable).toContain(second);
    expect(live.changePitcher(third!)).toBe(false);
  });
});

describe('pinch hitting', () => {
  it('marks the man used without touching the season roster', () => {
    const { rng, bats: homeTeam, field: awayTeam } = twoTeams(7);
    // Managing the away side, which bats first.
    const live = createLiveGame(homeTeam, awayTeam, rng, { managing: 'away' });
    expect(live.pending?.side).toBe('offense');

    const benchBefore = [...awayTeam.bench];
    const sub = live.benchAvailable[0]!;
    expect(live.pinchHit(sub)).toBe(true);

    // The persistent Team is untouched: this used to splice him out for good.
    expect(awayTeam.bench).toEqual(benchBefore);
    // But for this game he is spent, and he is now in the order.
    expect(live.benchAvailable).not.toContain(sub);
    expect(live.pinchHit(sub)).toBe(false);
    expect(live.pending?.batter.id).toBe(sub.id);
  });
});
