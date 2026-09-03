// traits.ts
// Where a tendency and a badge become one number the plate appearance can use.
//
// Two systems reach the same moment from opposite directions. A **tendency**
// redistributes: it changes the shape of a man's season without changing its
// size, and every pair of poles averages to exactly one across the league. A
// **badge** adds: a small, specific edge on one channel in one situation. Both
// arrive at the same plate appearance and the engine should not have to know
// there were two of them, so they are multiplied together here and handed on as
// a single set of factors.
//
// Kept out of `game.ts` so the combination is testable on its own, and out of
// `tendencies.ts` and `badges.ts` so neither has to import the other.

import { badgeMods } from './badges.js';
import { tendencyMods, type Situation } from './tendencies.js';
import type {Arm, Hitter, Pitcher, TraitMods } from './types.js';

export type { Situation, TraitMods };

export function plateTraits(
  batter: Hitter,
  pitcher: Arm,
  catcher: Hitter | null,
  sit: Situation,
): TraitMods {
  const t = tendencyMods(batter, pitcher, sit);
  const b = badgeMods(batter, pitcher, catcher, sit);
  return {
    all: t.all * b.all,
    walk: t.walk * b.walk,
    hbp: b.hbp,
    single: t.single,
    double: t.double,
    homerun: t.homerun * b.homerun,
    strikeout: t.strikeout * b.strikeout,
    groundBall: t.groundBall * b.groundBall,
    pace: t.pace,
  };
}
