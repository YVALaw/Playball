// god-target.test.ts — every God Mode destination has a safe, compact overlay
// title. The four app tabs intentionally share one CONTROL CENTER title now;
// category navigation happens inside that control center rather than by growing
// the overlay header.

import { describe, expect, it } from 'vitest';
import { godTitle, type GodTarget } from '../src/ui/god/target.js';
import type { PlayerId } from '../src/engine/types.js';

const id = 'p1' as PlayerId;

describe('god targets', () => {
  it('names every kind of target for the bar over the sheet', () => {
    const targets: GodTarget[] = [
      { kind: 'tab', tab: 'home' }, { kind: 'tab', tab: 'team' }, { kind: 'tab', tab: 'season' }, { kind: 'tab', tab: 'program' },
      { kind: 'player', id }, { kind: 'program', team: 3 }, { kind: 'roster', team: 3 }, { kind: 'coach' }, { kind: 'money' },
      { kind: 'leagues' }, { kind: 'recruits' }, { kind: 'recruit', id }, { kind: 'portal' }, { kind: 'time' },
    ];
    for (const t of targets) {
      const { eyebrow, title } = godTitle(t);
      expect(eyebrow.startsWith('GOD MODE')).toBe(true);
      expect(title.length).toBeGreaterThan(3);
      // Overlay titles are deliberately short enough to survive long dynamic
      // school/player names beside them on a phone-sized header.
      expect(title.length).toBeLessThan(24);
    }
    expect(godTitle({ kind: 'tab', tab: 'home' }).title).toBe('Control Center');
    expect(godTitle({ kind: 'roster', team: 3 }).title).toBe('Roster');
  });
});
