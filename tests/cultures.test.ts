// cultures.test.ts
// That every programme believes something, and that the beliefs are not all the
// same belief wearing different hats.
//
// The first half is bookkeeping: a school with no culture would silently want
// nothing, and a culture with no school is a line nobody ever reads.
//
// The second half is the interesting one. Culture exists to stop the world being
// flat, so a set of cultures that simply restates prestige has failed at the one
// job it has — and that is exactly what the cheap derived version would have
// produced. These tests are what say the hand-writing was worth doing.

import { describe, it, expect } from 'vitest';
import { CONFERENCES } from '../src/data/schools.js';
import { CULTURES, cultureOf, type CultureEdge } from '../src/data/cultures.js';

const SCHOOLS = CONFERENCES.flatMap((c) => c.schools);

describe('every programme believes something', () => {
  it('covers all ninety-six, and invents none', () => {
    const abbrs = new Set(SCHOOLS.map((s) => s.abbr));
    const cultured = new Set(Object.keys(CULTURES));

    const missing = [...abbrs].filter((a) => !cultured.has(a));
    const orphaned = [...cultured].filter((a) => !abbrs.has(a));

    expect(missing, `programmes with no culture: ${missing.join(', ')}`).toEqual([]);
    expect(orphaned, `cultures with no programme: ${orphaned.join(', ')}`).toEqual([]);
    expect(abbrs.size).toBe(96);
  });

  it('says something, in a sentence, in range', () => {
    for (const [abbr, c] of Object.entries(CULTURES)) {
      expect(c.name.length, `${abbr} name`).toBeGreaterThan(2);
      // Short enough to sit on a card without wrapping to three lines.
      expect(c.name.length, `${abbr} name too long`).toBeLessThan(24);
      expect(c.creed.length, `${abbr} creed`).toBeGreaterThan(20);
      expect(c.creed.endsWith('.'), `${abbr} creed is not a sentence`).toBe(true);
      expect(c.patience, `${abbr} patience`).toBeGreaterThanOrEqual(0);
      expect(c.patience, `${abbr} patience`).toBeLessThanOrEqual(100);
      expect(c.ambition, `${abbr} ambition`).toBeGreaterThanOrEqual(0);
      expect(c.ambition, `${abbr} ambition`).toBeLessThanOrEqual(100);
    }
  });

  it('gives no two programmes the same words', () => {
    const creeds = Object.values(CULTURES).map((c) => c.creed);
    expect(new Set(creeds).size, 'a creed is used twice').toBe(creeds.length);
    const names = Object.values(CULTURES).map((c) => c.name);
    expect(new Set(names).size, 'a culture name is used twice').toBe(names.length);
  });
});

describe('the country is not flat', () => {
  it('uses every edge, and leans on none of them', () => {
    const counts = new Map<CultureEdge, number>();
    for (const c of Object.values(CULTURES)) {
      counts.set(c.edge, (counts.get(c.edge) ?? 0) + 1);
    }
    // All eight represented, and none of them more than a third of the country
    // — a world where forty schools are "development" has one identity, not
    // eight.
    expect(counts.size, 'an edge nobody has').toBe(8);
    for (const [edge, n] of counts) {
      expect(n, `${edge} is over-used`).toBeLessThan(SCHOOLS.length / 3);
    }
  });

  it('does not simply restate prestige', () => {
    /*
      The test that justifies hand-writing all ninety-six.

      Derived culture would have made ambition a copy of prestige: every
      blueblood impatient and demanding, every doormat patient and modest. That
      is a world with one axis in it, and the offers would be a ladder again.

      A correlation is expected and fine — rich schools *do* tend to want more.
      What is checked is that it is not the whole story, measured as the
      proportion of programmes whose ambition disagrees meaningfully with their
      standing. There have to be arrogant poor schools and relaxed rich ones.
    */
    const rows = SCHOOLS.map((s) => ({ s, c: cultureOf(s.abbr)! }));
    const surprising = rows.filter(({ s, c }) => Math.abs(c.ambition - s.prestige) >= 15);
    expect(surprising.length, 'ambition is just prestige again').toBeGreaterThan(20);

    // And specifically both directions, so it is not one long tail.
    expect(rows.filter(({ s, c }) => c.ambition - s.prestige >= 15).length)
      .toBeGreaterThan(5);
    expect(rows.filter(({ s, c }) => s.prestige - c.ambition >= 15).length)
      .toBeGreaterThan(5);
  });

  it('keeps patience independent of how good the school is', () => {
    // The best programme in the country being impatient is a cliché that
    // happens to be true; the point is that it must not be a rule. There have
    // to be strong patient schools and weak twitchy ones.
    const rows = SCHOOLS.map((s) => ({ s, c: cultureOf(s.abbr)! }));
    const strongAndPatient = rows.filter(({ s, c }) => s.prestige >= 50 && c.patience >= 60);
    const weakAndTwitchy = rows.filter(({ s, c }) => s.prestige < 45 && c.patience <= 55);
    expect(strongAndPatient.length, 'no good school will wait').toBeGreaterThan(2);
    expect(weakAndTwitchy.length, 'no small school is in a hurry').toBeGreaterThan(2);
  });
});
