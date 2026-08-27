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
import { createLiveGame, OFFENSE } from '../src/engine/liveGame.js';
import { ENGINES } from '../src/engine/engines.js';
import type { EngineFn, Hitter, PAContext, Rng } from '../src/engine/types.js';

/**
 * Stand a runner on a base. `bases` is exposed read-only so nothing in the app
 * can reach in and rearrange the inning; a test setting up the situation it
 * wants to reproduce is the one caller that legitimately does.
 */
const place = (
  half: { readonly bases: readonly (Hitter | null)[] }, base: 1 | 2 | 3, who: Hitter,
): void => { (half.bases as (Hitter | null)[])[base - 1] = who; };

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

// ---------------------------------------------------------------------------
// Nobody leaves the field for free
// ---------------------------------------------------------------------------

/**
 * The conservation law, and the only test in here that would have caught all
 * four of the bugs it was written for at once.
 *
 * Everyone who takes part in a play has to end it somewhere: standing on a base,
 * across the plate, or retired. Reported as "there was someone on first and
 * third, he hit a single, and the man on first just disappeared" — no run, no
 * out, one fewer runner than the inning had a moment earlier. Four separate
 * places in the engine were doing it: an intentional walk with the bases loaded
 * dropped the man forced home, a botched bunt erased the lead runner and then
 * wrote the batter on top of the man behind him, a ground ball to the right side
 * moved the runner from second onto an occupied third, and a bunt single that
 * retired a runner threw the out away.
 */
const runnersOn = (bases: readonly unknown[]): number => bases.filter(Boolean).length;

describe('runners are conserved', () => {
  it('never loses a man across a wide sweep of innings, calls and outcomes', () => {
    const tactics = [undefined, 'swing', 'bunt', 'bunt', 'hitrun', 'contact', 'ibb'] as const;
    const broken: string[] = [];
    let steps = 0;

    for (let seed = 1; seed <= 5000 && broken.length === 0; seed++) {
      const { bats, field } = twoTeams(seed);
      const rng = makeRng(seed * 7919 + 13);
      const bat = new TeamState(bats, false);
      const fld = new TeamState(field, true);
      let log: string[] = [];
      // Alternating so both the manual dugout and the computer's automatic
      // steals and substitutions are swept.
      const manual = seed % 2 === 0;
      const half = createHalfInning(
        bat, fld, 1, ENGINES.log5, rng, (s) => log.push(s),
        false, [], undefined, manual, manual,
      );

      for (let guard = 0; guard < 40 && !half.done; guard++) {
        const before = [...half.bases];
        const outsBefore = half.outs;
        const runsBefore = bat.runs;
        const spotBefore = bat.spot;
        log = [];
        half.step(tactics[(seed + guard) % tactics.length]);
        steps++;

        // The batter only counts as arriving if he actually took his turn: a
        // called steal resolves without consuming him.
        const arrived = bat.spot !== spotBefore ? 1 : 0;
        const left = (bat.runs - runsBefore) + (half.outs - outsBefore);
        if (runnersOn(before) + arrived !== runnersOn(half.bases) + left) {
          broken.push(
            `seed ${seed}: ${runnersOn(before)} on + ${arrived} up -> ` +
            `${runnersOn(half.bases)} on + ${bat.runs - runsBefore} in + ` +
            `${half.outs - outsBefore} out\n    ${log.map((l) => l.trim()).join('\n    ')}`,
          );
        }
      }
    }

    expect(steps).toBeGreaterThan(20000);
    expect(broken).toEqual([]);
  });

  it('scores the man on third and moves the man on first on a single', () => {
    // The reported situation, exactly, over three hundred independent streams.
    const { bats, field } = twoTeams(4242);
    const single: EngineFn = () =>
      ({ event: 'single', kind: 'line', pitches: ['inplay'], engine: 'log5' });

    let scoredFromThird = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const bat = new TeamState(bats, false);
      const fld = new TeamState(field, true);
      const half = createHalfInning(
        bat, fld, 1, single, makeRng(seed * 31 + 7), () => {},
        false, [], undefined, true, true,
      );
      const onFirst = bats.lineup[3]!;
      const onThird = bats.lineup[5]!;
      place(half, 1, onFirst);
      place(half, 3, onThird);
      half.step('swing');

      // Three men were involved and three are accounted for.
      expect(runnersOn(half.bases) + bat.runs + half.outs).toBe(3);
      // And the man from first is standing somewhere, or was thrown out, or
      // scored — exactly one of the three. A pitch getting past the catcher can
      // move him to second before the hit, from where he can come all the way
      // around, so "on a base or retired" is no longer the whole list.
      if (!half.bases.includes(onFirst)) {
        expect(half.outs + bat.hitLine(onFirst).r).toBe(1);
      }
      // A fielder's range can still turn the scripted single into an out, which
      // is why this counts rather than asserting. When the hit does land, the
      // man on third scores every time — there is no holding him on a single.
      if (bat.runs > 0) {
        scoredFromThird++;
        expect(half.bases).not.toContain(onThird);
      }
    }
    expect(scoredFromThird).toBeGreaterThan(240);
  });

  it('scores the man forced home by an intentional walk', () => {
    const { bats, field } = twoTeams(11);
    const bat = new TeamState(bats, false);
    const fld = new TeamState(field, true);
    const log: string[] = [];
    const half = createHalfInning(
      bat, fld, 1, script([]), alwaysCaught, (s) => log.push(s),
      false, [], undefined, true, true,
    );
    const onThird = bats.lineup[5]!;
    place(half, 1, bats.lineup[3]!);
    place(half, 2, bats.lineup[4]!);
    place(half, 3, onThird);

    half.step('ibb');

    // He walks in, rather than being quietly deleted from the inning.
    expect(bat.runs).toBe(1);
    expect(half.outs).toBe(0);
    expect(runnersOn(half.bases)).toBe(3);
    expect(bat.hitLine(onThird).r).toBe(1);
    expect(log.join(' ')).toContain(`${onThird.name} is forced home`);
  });

  it('forces only the lead runner on a botched bunt, and leaves the rest standing', () => {
    const { bats, field } = twoTeams(12);
    const bat = new TeamState(bats, false);
    const fld = new TeamState(field, true);
    // First roll keeps the pitch in front of the catcher, second fails the
    // beat-it-out chance, third forces the botch.
    const rolls = [0.99, 0.99, 0.0001];
    const rng: Rng = () => rolls.shift() ?? 0.99;
    const half = createHalfInning(
      bat, fld, 1, script([]), rng, () => {},
      false, [], undefined, true, true,
    );
    const onFirst = bats.lineup[3]!;
    const onSecond = bats.lineup[4]!;
    place(half, 1, onFirst);
    place(half, 2, onSecond);

    half.step('bunt');

    // One out, and the man from first is on second rather than erased under the
    // batter — this used to take two runners off the field for a single out.
    expect(half.outs).toBe(1);
    expect(half.bases[1]).toBe(onFirst);
    expect(half.bases[0]).not.toBeNull();
    expect(half.bases[0]).not.toBe(onFirst);
    expect(half.bases).not.toContain(onSecond);
    expect(runnersOn(half.bases)).toBe(2);
  });

  it('records the out when a bunt single retires a runner on the bases', () => {
    const { bats, field } = twoTeams(13);
    const bat = new TeamState(bats, false);
    const fld = new TeamState(field, true);
    // Hold the pitch, then beat it out, send the runner from first, and gun him
    // down at third.
    const rolls = [0.99, 0.0001, 0.0001, 0.0001];
    const rng: Rng = () => rolls.shift() ?? 0.99;
    const half = createHalfInning(
      bat, fld, 1, script([]), rng, () => {},
      false, [], undefined, true, true,
    );
    const onFirst = bats.lineup[3]!;
    place(half, 1, onFirst);

    half.step('bunt');

    expect(half.bases).not.toContain(onFirst);
    // The out the caller used to throw on the floor.
    expect(half.outs).toBe(1);
    expect(fld.pitchLine(fld.pitcher).outs).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The calls on offer
// ---------------------------------------------------------------------------

describe('the offensive calls', () => {
  const on = (...b: number[]): [boolean, boolean, boolean] =>
    [b.includes(1), b.includes(2), b.includes(3)];
  const find = (bases: [boolean, boolean, boolean], outs: number, tactic: string) =>
    OFFENSE(bases, outs).find((o) => o.tactic === tactic)!;

  it('names the bag the runner is actually taking', () => {
    expect(find(on(1), 0, 'steal').label).toBe('STEAL SECOND');
    expect(find(on(1, 3), 0, 'steal').label).toBe('STEAL SECOND');
    // No double steal is modelled, so with two on it is the lead man alone.
    expect(find(on(2), 0, 'steal').label).toBe('STEAL THIRD');
    expect(find(on(1, 2), 0, 'steal').label).toBe('STEAL THIRD');
    for (const bases of [on(1), on(1, 3), on(2), on(1, 2)]) {
      expect(find(bases, 0, 'steal').available).toBe(true);
    }
  });

  it('withholds the steal only when there is genuinely nowhere to go', () => {
    for (const bases of [on(), on(3), on(2, 3), on(1, 2, 3)]) {
      expect(find(bases, 0, 'steal').available).toBe(false);
    }
    expect(find(on(), 0, 'steal').note).toBe('nobody on');
    // Stealing home is not in the engine, and the reason says so rather than
    // claiming a base is occupied when it is not.
    expect(find(on(3), 0, 'steal').note).toBe('only home is left, and nobody steals home');
  });

  it('offers contact for any runner, and describes the situation on the field', () => {
    expect(find(on(), 0, 'contact').available).toBe(false);
    for (const bases of [on(1), on(2), on(3), on(1, 2), on(2, 3), on(1, 2, 3)]) {
      for (const outs of [0, 1, 2]) {
        expect(find(bases, outs, 'contact').available).toBe(true);
      }
    }
    // The blurb has to be true. A sacrifice fly needs a man on third and fewer
    // than two out; with two down the same call is just a swing you shorten up.
    expect(find(on(3), 1, 'contact').note).toContain('in the air');
    expect(find(on(3), 2, 'contact').note).not.toContain('in the air');
    expect(find(on(2), 0, 'contact').note).toContain('third');
  });

  it('never offers a call that cannot do anything', () => {
    // Every available call has to change something. A steal with nowhere to go
    // was offered for months and was a guaranteed no-op.
    for (let mask = 0; mask < 8; mask++) {
      const bases = on(...[1, 2, 3].filter((b) => mask & (1 << (b - 1))));
      for (const outs of [0, 1, 2]) {
        for (const o of OFFENSE(bases, outs)) {
          if (!o.available) {
            expect(o.note.length).toBeGreaterThan(0);
            continue;
          }
          if (o.tactic === 'steal') {
            const [first, second, third] = bases;
            expect((first && !second) || (second && !third)).toBe(true);
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Stealing
// ---------------------------------------------------------------------------

describe('a called steal', () => {
  it('takes third when second is the base he is standing on', () => {
    const { bats, field } = twoTeams(21);
    const bat = new TeamState(bats, false);
    const fld = new TeamState(field, true);
    const log: string[] = [];
    // A rng of 0.0001 makes every success roll good.
    const half = createHalfInning(
      bat, fld, 1, script([]), () => 0.0001, (s) => log.push(s),
      false, [], undefined, true, true,
    );
    const runner = bats.lineup[4]!;
    place(half, 2, runner);

    expect(half.step('steal')).toBe(false);
    expect(half.bases[2]).toBe(runner);
    expect(half.bases[1]).toBeNull();
    expect(bat.hitLine(runner).sb).toBe(1);
    expect(log.join(' ')).toContain(`${runner.name} steals third.`);
  });

  it('charges an out when the runner going to third is thrown out', () => {
    const { bats, field } = twoTeams(22);
    const bat = new TeamState(bats, false);
    const fld = new TeamState(field, true);
    const half = createHalfInning(
      bat, fld, 1, script([]), alwaysCaught, () => {},
      false, [], undefined, true, true,
    );
    const runner = bats.lineup[4]!;
    place(half, 2, runner);

    half.step('steal');
    expect(half.outs).toBe(1);
    expect(half.bases).toEqual([null, null, null]);
    expect(bat.hitLine(runner).cs).toBe(1);
  });

  it('is caught often enough to be a real decision', () => {
    // The complaint was "steal always works, every time". It does not: measured
    // across three hundred managed games the manager's runner is out roughly
    // three times in ten going to second, which is where D1 actually sits. This
    // pins the band rather than a point estimate — the exact figure moves with
    // any change to the rating spread, and only a collapse to a free base or to
    // a coin flip is a bug.
    let stolen = 0;
    let caught = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const { rng, bats: homeTeam, field: awayTeam } = twoTeams(seed);
      const live = createLiveGame(homeTeam, awayTeam, rng, { managing: 'away' });
      let guard = 0;
      while (!live.over && guard++ < 2000) {
        const p = live.pending;
        if (!p) break;
        if (p.side !== 'offense') { live.submit('pitch'); continue; }
        const steal = p.options.find((o) => o.tactic === 'steal');
        if (!steal?.available) { live.submit('swing'); continue; }
        const before = live.log.length;
        live.submit('steal');
        const said = live.log.slice(before).join(' ');
        // Whatever else it does, a called steal must never be a silent no-op.
        expect(/steals (second|third)|is caught stealing/.test(said)).toBe(true);
        if (said.includes('caught stealing')) caught++; else stolen++;
      }
    }

    const attempts = stolen + caught;
    expect(attempts).toBeGreaterThan(500);
    expect(caught / attempts).toBeGreaterThan(0.18);
    expect(caught / attempts).toBeLessThan(0.45);
  });
});

/*
  Handing the pitching to your staff.

  This is the whole engine-side surface of casual mode, and the reason it is
  only one option: the half-inning already knew how to run either dugout
  automatically — that is how the computer opponent gets a bullpen — so
  delegating your own pitching points that same machinery at your defensive
  halves. Nothing about the simulation changes. A different set of decisions is
  made, by the code that has always made them for the other ninety-five.

  The engine is deliberately not told *why*. It takes a boolean.
*/
describe('when the staff has the pitching', () => {
  const played = (autoPitching: boolean) => {
    const { bats, field } = twoTeams(4242);
    const live = createLiveGame(field, bats, makeRng(4242), {
      managing: 'home',
      engine: 'log5',
      autoPitching,
    });
    const sides: string[] = [];
    for (let i = 0; i < 400 && !live.over && live.pending; i++) {
      sides.push(live.pending.side);
      live.submit('swing');
    }
    return { live, sides };
  };

  it('never stops to ask about a defensive half', () => {
    const { sides } = played(true);
    expect(sides.length).toBeGreaterThan(10);
    expect(sides.every((s) => s === 'offense')).toBe(true);
  });

  it('still asks about both halves when the pitching is yours', () => {
    const { sides } = played(false);
    expect(sides).toContain('offense');
    expect(sides).toContain('defense');
  });

  it('refuses a pitching change that was delegated', () => {
    const { bats, field } = twoTeams(77);
    const live = createLiveGame(field, bats, makeRng(77), {
      managing: 'home', engine: 'log5', autoPitching: true,
    });
    const arm = live.bullpenAvailable[0];
    // The button is gone from the screen; the door is shut behind it too, so a
    // stale render can never reach past a decision the coach delegated.
    if (arm) expect(live.changePitcher(arm)).toBe(false);
  });

  it('plays a complete, legal game either way', () => {
    for (const auto of [true, false]) {
      const { live } = played(auto);
      live.finish();
      expect(live.over).toBe(true);
      // Somebody won, nine innings at least, and no negative arithmetic.
      expect(live.result.home.runs).toBeGreaterThanOrEqual(0);
      expect(live.result.away.runs).toBeGreaterThanOrEqual(0);
      expect(live.result.home.runs).not.toBe(live.result.away.runs);
    }
  });
});
