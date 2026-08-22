// fielding.test.ts
// Individual fielders have to actually field.
//
// The whole point of splitting `fielding` into range and hands, generating them
// to fit the position, and building a spray model is that the man standing where
// the ball goes decides what happens. If a team of statues allows the same
// batting average as a team of acrobats, none of that machinery is real.

import { describe, it, expect } from 'vitest';
import { simGame } from '../src/engine/game.js';
import { makeTeam, resetNames } from '../src/engine/players.js';
import { makeRng } from '../src/engine/rng.js';
import type { Team } from '../src/engine/types.js';

/** Same bats and arms every time; only the gloves behind them change. */
function season(setRange: (n: number) => number, setHands: (n: number) => number) {
  resetNames();
  const build = makeRng(20260820);
  const offense = makeTeam(build, 'Offense', 50);
  const defense: Team = makeTeam(build, 'Defense', 50);

  for (const p of defense.lineup) {
    p.range = setRange(p.range);
    p.hands = setHands(p.hands);
  }

  // Enough games that an 8% difference in error rate is signal rather than
  // noise. The first version ran 300 and reported the *bad* hands committing
  // fewer errors, which was 1.5 standard errors of nothing.
  const rng = makeRng(555);
  let ab = 0, hits = 0, errors = 0;
  const GAMES = 1200;
  for (let i = 0; i < GAMES; i++) {
    const res = simGame(offense, defense, rng, { engine: 'log5' });
    // simGame takes (home, away), so `offense` is the home side and the
    // manipulated defence is away. Measure the home team's hitting — that is the
    // half played against the gloves under test — and the away team's errors.
    // Getting this backwards measures the manipulated team batting against an
    // untouched defence, which is a test of nothing.
    for (const line of res.home.batting.values()) { ab += line.ab; hits += line.h; }
    errors += res.away.errors;
  }
  return { avg: hits / ab, errors: errors / GAMES };
}

describe('the men on the field', () => {
  it('turns more balls into outs when the gloves are better', () => {
    const statues = season(() => 20, (h) => h);
    const acrobats = season(() => 80, (h) => h);

    expect(acrobats.avg, 'a great defence must allow a lower average')
      .toBeLessThan(statues.avg);

    // And by an amount worth having: this is a 60 point range gap across the
    // whole diamond, which should be plainly visible, not a rounding difference.
    expect(statues.avg - acrobats.avg).toBeGreaterThan(0.008);
  });

  it('boots more balls when the hands are worse', () => {
    const sure = season((r) => r, () => 85);
    const stony = season((r) => r, () => 15);

    expect(stony.errors, 'bad hands must produce more errors')
      .toBeGreaterThan(sure.errors);
  });

  it('keeps errors on the ground, where they belong', async () => {
    // Errors are overwhelmingly a ground ball event. A defence that never sees a
    // grounder should make far fewer of them than one that sees nothing else.
    const { KIND_ERROR_RISK } = await import('../src/engine/game.js');
    expect(KIND_ERROR_RISK.ground).toBeGreaterThan(KIND_ERROR_RISK.fly as number);
    expect(KIND_ERROR_RISK.ground).toBeGreaterThan(KIND_ERROR_RISK.popup as number);
  });
});
