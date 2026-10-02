// second-career.test.ts
// A second career begun in the same session starts clean.
//
// Found 2026-09-26: `start` left `furthestPhase` where the first career's
// winter had put it, and `leagueWinter` reads a number past the draft as "this
// winter has run", so the new career's first winter skipped graduations,
// development and the draft. The old portal was still standing too.

import { describe, it, expect } from 'vitest';
import { useDynasty, PHASES } from '../src/state/store.js';

describe('a second career begun in one session', () => {
  it('does not inherit the first one\'s winter', () => {
    const g = () => useDynasty.getState();
    g().start(4242, 0);
    // The first career, deep in its winter: past the draft, the portal open.
    useDynasty.setState({
      phase: 'portal',
      furthestPhase: PHASES.indexOf('portal'),
      portal: { leaving: [], available: [], spent: 30 },
      portalArrivals: ['Somebody'],
      arguedTerms: true,
    });
    g().start(918, 3);
    expect(g().phase).toBeNull();
    expect(g().furthestPhase).toBe(0);
    expect(g().portal).toBeNull();
    expect(g().portalArrivals).toEqual([]);
    expect(g().arguedTerms).toBe(false);
    expect(g().knockout).toBeNull();
    expect(g().lastPostseason).toBeNull();
  });
});
