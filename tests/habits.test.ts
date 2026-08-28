// habits.test.ts
// That every earned badge can actually be earned.
//
// This file exists because of a specific mistake made one piece earlier in the
// same stage: `Builder` shipped as a career title nobody could ever wear,
// because the number behind it was recorded for the player and for none of the
// ninety-five rival careers. It typechecked, it had a sensible threshold, and it
// was decoration.
//
// So the first test here is not about balance. It asks whether each badge names
// a counter that exists and whether that counter is one the game actually
// touches — and the answer has to keep being yes as badges are added.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BADGES, MAX_BADGES } from '../src/data/badges.js';
import {
  BADGE_HABIT, badgeThreshold, earnedBadges, note, habitsFor,
  type CoachHabits, type HabitKey,
} from '../src/engine/habits.js';
import { makeRng } from '../src/engine/rng.js';

const EARNED = BADGES.filter((b) => b.source === 'earned');

describe('every earned badge is earnable', () => {
  it('names a habit, and every habit belongs to a badge', () => {
    for (const b of EARNED) {
      expect(BADGE_HABIT[b.id], `${b.id} watches nothing`).toBeDefined();
    }
    for (const id of Object.keys(BADGE_HABIT)) {
      expect(EARNED.some((b) => b.id === id), `${id} watches for a badge that does not exist`)
        .toBe(true);
    }
  });

  it('is fed by something the game actually does', () => {
    /*
      The Builder test, generalised.

      A counter that is declared, thresholded and never incremented is exactly
      as useless as one that does not exist, and far harder to notice — so this
      greps the source for a write to each habit rather than trusting that one
      was wired. Crude on purpose: a subtler check would be a check that could
      itself be satisfied by a subtler mistake.
    */
    const sources = [
      readFileSync('src/state/store.ts', 'utf8'),
      readFileSync('src/ui/screens/Wire.tsx', 'utf8'),
    ].join('\n');

    for (const [id, spec] of Object.entries(BADGE_HABIT)) {
      const written = sources.includes(`'${spec.habit}'`);
      expect(written, `nothing ever increments ${spec.habit}, so ${id} is unreachable`)
        .toBe(true);
    }
  });

  it('asks for enough of it to mean something', () => {
    // A badge earned in a fortnight describes a fortnight. These should be two
    // or three seasons of consistent behaviour, which for the per-game counters
    // means comfortably more than one season's worth of chances.
    expect(badgeThreshold('ironman', 1)).toBeGreaterThan(60);
    expect(badgeThreshold('smallball', 1)).toBeGreaterThan(100);
    for (const id of Object.keys(BADGE_HABIT)) {
      expect(badgeThreshold(id, 1), `${id} is free`).toBeGreaterThan(1);
    }
  });
});

describe('the thresholds', () => {
  it('are the same all career, and different between careers', () => {
    // The whole point of seeding them: a player cannot look one up, and two
    // dynasties do not reward the same style at the same moment.
    for (const id of Object.keys(BADGE_HABIT)) {
      expect(badgeThreshold(id, 4242)).toBe(badgeThreshold(id, 4242));
    }
    const spreads = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      spreads.add(Object.keys(BADGE_HABIT).map((id) => badgeThreshold(id, seed)).join());
    }
    expect(spreads.size, 'every world asks for the same numbers').toBeGreaterThan(20);
  });

  it('never drops below four fifths of the base', () => {
    // The spread exists to hide the number, not to make a badge cheap. A world
    // where a badge cost a third of the usual would be a world where a player
    // noticed, which defeats the hiding.
    for (let seed = 0; seed < 200; seed++) {
      for (const [id, spec] of Object.entries(BADGE_HABIT)) {
        expect(badgeThreshold(id, seed), `${id} went cheap on seed ${seed}`)
          .toBeGreaterThanOrEqual(Math.round(spec.base * 0.8));
        expect(badgeThreshold(id, seed), `${id} went dear on seed ${seed}`)
          .toBeLessThanOrEqual(Math.round(spec.base * 1.25));
      }
    }
  });

  it('takes no draw from any generator it is asked about', () => {
    // Reading a threshold must not move the world — the same rule the wire and
    // the play-by-play keep. If this ever consumed a draw, a screen that showed
    // badge progress would change every number after it.
    const rng = makeRng(99);
    const before = rng.state?.();
    for (const id of Object.keys(BADGE_HABIT)) badgeThreshold(id, 99);
    expect(rng.state?.()).toBe(before);
  });
});

describe('what a career earns', () => {
  const full = (): CoachHabits => {
    let h: CoachHabits = {};
    for (const spec of Object.values(BADGE_HABIT)) {
      h = note(h, spec.habit, spec.base * 3);
    }
    return h;
  };

  it('gives nothing to a coach who has done nothing', () => {
    expect(earnedBadges({}, [], 1)).toEqual([]);
  });

  it('gives everything to a coach who has done all of it', () => {
    expect(earnedBadges(full(), [], 1).sort())
      .toEqual(Object.keys(BADGE_HABIT).sort());
  });

  it('never hands the same badge twice', () => {
    const already = Object.keys(BADGE_HABIT);
    expect(earnedBadges(full(), already, 1)).toEqual([]);
  });

  it('reports a badge earned past the cap, so it can still be announced', () => {
    /*
      The cap belongs to the card, not to the earning.

      A coach whose five slots are full has still done the thing, and a game
      that silently stopped noticing would be a game that stops rewarding play
      after the fifth badge. The store applies `MAX_BADGES` when it writes; this
      keeps reporting.
    */
    expect(MAX_BADGES).toBe(5);
    const some = earnedBadges(full(), [], 1);
    expect(some.length).toBeGreaterThan(MAX_BADGES);
  });

  it('counts up rather than replacing', () => {
    let h: CoachHabits = {};
    h = note(h, 'managed', 3);
    h = note(h, 'managed', 4);
    expect(h.managed).toBe(7);
    // And an absent counter is zero rather than a crash.
    expect(note({}, 'wire').wire).toBe(1);
  });

  it('earns a plausible spread over a plausible career', () => {
    // Not every badge, and not none: a coach who plays a normal amount of a
    // normal game should collect a few things and miss others.
    const counts: number[] = [];
    for (let seed = 0; seed < 30; seed++) {
      const h = habitsFor(makeRng(seed), 0.7);
      counts.push(earnedBadges(h, [], seed).length);
    }
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    expect(mean, 'nobody earns anything').toBeGreaterThan(0.5);
    expect(mean, 'everybody earns everything').toBeLessThan(EARNED.length - 1);
  });
});

describe('the habit keys', () => {
  it('are all reachable from a badge', () => {
    const used = new Set<HabitKey>(Object.values(BADGE_HABIT).map((s) => s.habit));
    // Ten badges, ten counters, no spares. A counter nobody reads is a counter
    // somebody will keep incrementing for years.
    expect(used.size).toBe(Object.keys(BADGE_HABIT).length);
  });
});
