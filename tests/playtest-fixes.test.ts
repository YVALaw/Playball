// playtest-fixes.test.ts
// The 2026-10-07 playtest: hiring from the Season plan, the hire confirm, a
// screen card that came up mid-hire, and a chip row that drifted vertically.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { seasonPlanCovered, seasonPlanShowing, useDynasty } from '../src/state/store.js';
import { coveredFor } from '../src/ui/Tutorial.js';
import { overlayOwner } from '../src/ui/screenOwner.js';

const S = () => useDynasty.getState();
const read = (p: string): string => readFileSync(p, 'utf8');

describe('hiring from the Season plan opens the coach sheet over the plan', () => {
  it('no Staff room under it, so a pull or back lands on the plan', () => {
    S().start(4242, 17);
    expect(seasonPlanShowing(S())).toBe(true);
    S().openCoach('pitching');
    // Covered, not closed: it comes back when the sheet does.
    expect(S().overlay).toBeNull();
    expect(seasonPlanShowing(S())).toBe(false);
    expect(seasonPlanCovered(S())).toBe(true);
    S().closeCoach();
    expect(seasonPlanShowing(S())).toBe(true);
  });

  it('the plan draws the sheet itself instead of opening the room', () => {
    const plan = read('src/ui/screens/SeasonPlan.tsx');
    expect(plan).toContain('<CoachSeatSheet');
    expect(plan).toContain(': () => openDesk(s)}');
    expect(plan).not.toContain('openStaffDesk(s, { layer: true })');
    expect(read('src/ui/screens/ProgramRooms.tsx')).toContain('export function CoachSeatSheet(');
  });
});

describe('a hire asks for a second tap', () => {
  it('an open seat confirms the way a replacement does', () => {
    const dialog = read('src/ui/StaffCandidateDialog.tsx');
    expect(dialog).toContain('armed="Tap again to hire"');
    expect(dialog).toContain('armed="Tap again to replace"');
    expect(dialog).not.toContain('onClick={onHire}');
  });
});

describe('a screen card waits while something covers its screen', () => {
  const clear: Parameters<typeof coveredFor>[0] = { selectedPlayer: null, teamCard: null, coachSeat: null, godStack: [], overlay: null };
  const route = 'home|today#1';

  it('a screen’s card waits for an overlay, a card or a coach sheet over it', () => {
    expect(coveredFor(clear, route)).toBe(false);
    expect(coveredFor({ ...clear, overlay: 'staff' }, route)).toBe(true);
    expect(coveredFor({ ...clear, coachSeat: 'pitching' }, route)).toBe(true);
    expect(coveredFor({ ...clear, selectedPlayer: 'p1' as never }, route)).toBe(true);
  });

  it('an overlay’s own card is the overlay on top, so only a card over it waits', () => {
    expect(coveredFor({ ...clear, overlay: 'staff' }, overlayOwner(0))).toBe(false);
    expect(coveredFor({ ...clear, overlay: 'staff', coachSeat: 'hitting' }, overlayOwner(0))).toBe(true);
  });

  it('and every card waits while the Season plan is up or only covered', () => {
    const tip = read('src/ui/Tutorial.tsx');
    expect(tip).toContain('seasonPlanShowing(s) || seasonPlanCovered(s)');
    expect(tip).toContain('!planUp && !under');
  });
});

describe('rows that scroll sideways scroll only sideways', () => {
  it('the 48px hit areas fit the padding and the rows clip vertically', () => {
    const css = read('src/ui/design/components.css');
    expect(css).toContain('.pb-chips, .pb-rc-views, .pb-rc-filters { padding-block: 8px; margin-block: -8px; }');
    expect(css).toContain('.pb-chips:not(.pb-chips--wrap), .pb-rc-views, .pb-rc-filters { overflow-y: hidden; }');
  });
});
