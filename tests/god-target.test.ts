// god-target.test.ts
// The sheet's bar names every kind of target, and the stack steps back the
// way it came (05 §61.5).

import { describe, expect, it } from 'vitest';
import { godTitle, type GodTarget } from '../src/ui/god/target.js';
import type { PlayerId } from '../src/engine/types.js';

const id = 'p1' as PlayerId;

describe('god targets', () => {
  it('names every kind of target for the bar over the sheet', () => {
    const targets: GodTarget[] = [
      { kind: 'tab', tab: 'home' }, { kind: 'tab', tab: 'team' }, { kind: 'tab', tab: 'season' }, { kind: 'tab', tab: 'program' },
      { kind: 'player', id }, { kind: 'program', team: 3 }, { kind: 'coach' }, { kind: 'money' },
      { kind: 'leagues' }, { kind: 'recruits' }, { kind: 'recruit', id }, { kind: 'portal' }, { kind: 'time' },
    ];
    const seen = new Set<string>();
    for (const t of targets) {
      const { eyebrow, title } = godTitle(t);
      expect(eyebrow.startsWith('GOD MODE')).toBe(true);
      expect(title.length).toBeGreaterThan(3);
      seen.add(`${eyebrow}|${title}`);
    }
    // Four tabs, four titles; every other kind its own.
    expect(seen.size).toBe(targets.length);
  });
});
