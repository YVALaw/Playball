// backgrounds.test.ts
// The four backgrounds are a choice of shape, never a choice of strength.
//
// They replaced the interview on September 6 2026, and they inherit its one
// promise: nothing you pick at creation can be the wrong answer. Four cards
// that sum to the same total, each strongest somewhere different, each
// granting a badge that exists and leaning on culture edges that exist.

import { describe, it, expect } from 'vitest';
import { BACKGROUNDS } from '../src/data/backgrounds.js';
import { badgeOf } from '../src/data/badges.js';
import { CULTURE_LABEL } from '../src/data/cultures.js';

describe('the four backgrounds', () => {
  it('are four, with distinct ids', () => {
    expect(BACKGROUNDS.length).toBe(4);
    expect(new Set(BACKGROUNDS.map((b) => b.id)).size).toBe(4);
  });

  it('sum to the same year-one total, so none is the correct pick', () => {
    const totals = BACKGROUNDS.map((b) => Object.values(b.skills).reduce((s, v) => s + v, 0));
    expect(new Set(totals).size).toBe(1);
    expect(totals[0]).toBe(90);
  });

  it('each is strongest somewhere different, so the cards read as four shapes', () => {
    const tops = BACKGROUNDS.map((b) =>
      Object.entries(b.skills).sort((x, y) => y[1] - x[1])[0]![0]);
    expect(new Set(tops).size).toBe(4);
  });

  it('each grants a badge a background can grant, and leans on edges that exist', () => {
    for (const b of BACKGROUNDS) {
      expect(b.badges.length, b.id).toBeGreaterThan(0);
      for (const id of b.badges) {
        const badge = badgeOf(id);
        expect(badge, `${b.id} grants ${id}`).toBeDefined();
        expect(badge!.source).toBe('background');
      }
      for (const edge of Object.keys(b.leans)) {
        expect(CULTURE_LABEL, `${b.id} leans on ${edge}`).toHaveProperty(edge);
      }
    }
  });
});
