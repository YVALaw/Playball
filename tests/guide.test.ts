// The guided first stretch's pure half: which step is live, and when a step
// is over. The DOM half is exercised by hand in the pane; this pins the
// derivation the save relies on.

import { describe, expect, it } from 'vitest';
import {
  GUIDE_STEPS, activeGuideStep, guideSkipStamps, guideStamp, type GuideView,
} from '../src/ui/guide.js';

const at = (over: Partial<GuideView> = {}): GuideView => ({
  tab: 'home', screen: 'today', overlay: null, programSheet: 'overview',
  live: false, inning: 0, pending: false, ...over,
});

describe('the guided first stretch', () => {
  it('starts at the welcome on a new career and walks the steps in order', () => {
    expect(activeGuideStep([], true, true)?.id).toBe('welcome');
    const seen: string[] = [];
    for (const step of GUIDE_STEPS) {
      expect(activeGuideStep(seen, true, true)?.id).toBe(step.id);
      seen.push(guideStamp(step.id));
    }
    expect(activeGuideStep(seen, true, true)).toBeNull();
  });

  it('never starts for a save that met TODAY before the tour existed', () => {
    expect(activeGuideStep(['today', 'roster'], true, true)).toBeNull();
    // But a career that began on the tour keeps it through its own stamps.
    expect(activeGuideStep([guideStamp('welcome'), 'today'], true, true)?.id).toBe('dugout');
  });

  it('is a first-season thing, and respects the tutorials switch', () => {
    expect(activeGuideStep([], false, true)).toBeNull();
    expect(activeGuideStep([], true, false)).toBeNull();
  });

  it('SKIP stamps every step and every card a step stood in for', () => {
    const stamps = guideSkipStamps();
    for (const s of GUIDE_STEPS) expect(stamps).toContain(guideStamp(s.id));
    for (const c of ['today', 'manage', 'program', 'roster', 'lineup', 'coach']) expect(stamps).toContain(c);
    expect(activeGuideStep(stamps, true, true)).toBeNull();
  });

  it('finishes each doing-step on the thing the tap produces', () => {
    const by = Object.fromEntries(GUIDE_STEPS.map((s) => [s.id, s]));
    expect(by.welcome!.done!(at({ live: true, screen: 'box' }))).toBe(true);
    expect(by.welcome!.done!(at())).toBe(false);
    // A game a phone call interrupted is not a game that ended.
    expect(by.dugout!.done!(at({ live: false, pending: true }))).toBe(false);
    expect(by.dugout!.done!(at({ live: false }))).toBe(true);
    expect(by.money!.done!(at({ tab: 'program', screen: 'records', programSheet: 'money' }))).toBe(true);
    expect(by.money!.done!(at({ tab: 'program', screen: 'records' }))).toBe(false);
    expect(by.coach!.done!(at({ overlay: 'program', programSheet: 'coach' }))).toBe(true);
  });

  it('shows the dugout only once a full inning has been played', () => {
    const dugout = GUIDE_STEPS.find((s) => s.id === 'dugout')!;
    expect(dugout.where(at({ live: true, screen: 'box', inning: 1 }))).toBe(false);
    expect(dugout.where(at({ live: true, screen: 'box', inning: 2 }))).toBe(true);
  });

  it('keeps its cards off the field and out from under overlays', () => {
    for (const s of GUIDE_STEPS) {
      if (s.id === 'dugout') continue;
      expect(s.where(at({ live: true, screen: 'box' }))).toBe(false);
    }
    for (const s of GUIDE_STEPS) {
      if (s.id === 'done') continue;
      expect(s.where(at({ overlay: 'inbox' }))).toBe(false);
    }
  });
});
