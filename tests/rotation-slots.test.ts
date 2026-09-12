// rotation-slots.test.ts
// What each arm's chip says, on all three schedules.
//
// `SLOTS` in `Lineup.tsx` was the literal `['FRI', 'SAT', 'SUN', 'MID']` — right
// for the only schedule that existed when it was written, and wrong for both of
// the others from the day they shipped. Found while tracing the fifty-six game
// season for a testing script, not by a test and not by playing: on a long
// world the rotation is five arms and the array held four, so the fifth row
// drew an **empty** chip, and on a short world the two-game weekend is Saturday
// and Sunday while the rows still said Friday.
//
// The lesson is the one `05` §78 already paid for once: a constant that encodes
// an assumption about the world outlives the assumption silently. `rotationSizeFor`
// derives the SIZE of the staff from the schedule; this derives the NAMES from
// the same place, so a fourth schedule cannot reintroduce the fault.

import { describe, it, expect } from 'vitest';
import { slotNames } from '../src/ui/screens/Lineup.js';
import { SEASON_SPANS, seriesGames, rotationSizeFor } from '../src/engine/season.js';

describe('what a rotation slot is called', () => {
  const forWorld = (length: 'short' | 'standard' | 'long'): string[] => {
    const config = SEASON_SPANS[length];
    return slotNames(seriesGames(config), rotationSizeFor(config));
  };

  it('names the standard weekend exactly as it always did', () => {
    // The world every existing save is in. If this line ever changes, the
    // change is a regression however good the reason sounded.
    expect(forWorld('standard')).toEqual(['FRI', 'SAT', 'SUN', 'MID']);
  });

  it('starts a four-game weekend on Thursday and gives the fifth arm the midweek', () => {
    /*
      The reported defect. A four-game series adds a Thursday rather than
      playing into Monday, and the midweek arm takes the slot AFTER the
      weekend's — which is the entire reason this schedule needs five starters
      (`rotationSizeFor`). Nobody may be nameless.
    */
    expect(forWorld('long')).toEqual(['THU', 'FRI', 'SAT', 'SUN', 'MID']);
    expect(forWorld('long')).toHaveLength(rotationSizeFor(SEASON_SPANS.long));
  });

  it('calls the short season\'s spare arm what he is', () => {
    /*
      A two-game weekend uses two arms and a midweek, and `rotationSizeFor`
      floors the staff at four anyway — so the fourth man is depth rather than
      a starter, which is what a short season should cost. The chip says so
      instead of naming a day he never pitches on.
    */
    expect(forWorld('short')).toEqual(['SAT', 'SUN', 'MID', 'DEPTH']);
  });

  it('names every arm on every schedule, with no gaps', () => {
    // The actual bug was an undefined chip, so this is the assertion that
    // would have caught it whatever the labels turned out to be.
    for (const length of ['short', 'standard', 'long'] as const) {
      const names = forWorld(length);
      const size = rotationSizeFor(SEASON_SPANS[length]);
      expect(names.length, `${length} names`).toBeGreaterThanOrEqual(size);
      for (const [i, n] of names.slice(0, size).entries()) {
        expect(n, `${length} slot ${i}`).toBeTruthy();
        expect(typeof n).toBe('string');
      }
    }
  });

  it('survives a schedule nobody has built yet', () => {
    // A five-game weekend is not a thing today. It must still not produce a
    // blank chip if somebody adds one.
    const names = slotNames(5, 6);
    expect(names).toHaveLength(6);
    for (const n of names) expect(n).toBeTruthy();
  });
});
