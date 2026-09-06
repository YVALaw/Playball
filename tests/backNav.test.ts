// backNav.test.ts
// The back gesture's one question — is there a layer to peel? — pinned in the
// same order the handler peels them, because Android 16 asks it before the
// press and the answer decides whether the system previews an exit.

import { describe, it, expect } from 'vitest';
import { hasLayerToClose, type BackState } from '../src/ui/backNav.js';
import { TABS } from '../src/state/store.js';

const home: BackState = {
  blocked: false, playerOpen: false, teamCardOpen: false, overlayOpen: false,
  tab: 'home', screen: TABS.find((t) => t.id === 'home')!.screens[0]!.id,
};

describe('what the back gesture has to close', () => {
  it('has nothing at the root of HOME, which is the one press that leaves', () => {
    expect(hasLayerToClose(home)).toBe(false);
  });

  it('claims the press for every layer the handler peels, in its order', () => {
    expect(hasLayerToClose({ ...home, blocked: true })).toBe(true);
    expect(hasLayerToClose({ ...home, playerOpen: true })).toBe(true);
    expect(hasLayerToClose({ ...home, teamCardOpen: true })).toBe(true);
    expect(hasLayerToClose({ ...home, overlayOpen: true })).toBe(true);
  });

  it("claims a tab's second screen, and any tab that is not HOME", () => {
    const team = TABS.find((t) => t.id === 'team')!;
    const second = team.screens[1]?.id ?? team.screens[0]!.id;
    expect(hasLayerToClose({ ...home, tab: 'team', screen: team.screens[0]!.id })).toBe(true);
    expect(hasLayerToClose({ ...home, tab: 'team', screen: second })).toBe(true);
    const homeSecond = TABS.find((t) => t.id === 'home')!.screens[1]?.id;
    if (homeSecond) expect(hasLayerToClose({ ...home, screen: homeSecond })).toBe(true);
  });

  it('still claims a blocking card, so the press is swallowed rather than an exit', () => {
    // The opener, the playbook invite and the big moment are answered on
    // their own terms; a gesture during one must not leave the game.
    expect(hasLayerToClose({ ...home, blocked: true, tab: 'home' })).toBe(true);
  });
});
