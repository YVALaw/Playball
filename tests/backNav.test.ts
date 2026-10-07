// backNav.test.ts
// The back gesture's one question — is there a level to peel? — asked of
// `nav.ts`, the one list App arms Android with (`nav.depth() > 0`) and the
// browser's ledger keeps one entry per level of. Android 16 asks it before
// the press, and the answer decides whether the system previews an exit.
// (CL, 2026-09-30: this asked `hasLayerToClose`, App's hand-kept copy.)

import { describe, it, expect } from 'vitest';
import { blockingCardUp, openerShowing, nextNavInstant, useDynasty, TABS } from '../src/state/store.js';
import { depth, newest } from '../src/state/nav.js';

/** A fresh career on HOME's first screen, nothing open and nothing behind it. */
function atHomeRoot(): void {
  useDynasty.getState().start(4242, 0);
  useDynasty.setState({
    tab: 'home', screen: TABS.find((t) => t.id === 'home')!.screens[0]!.id,
    overlay: null, overlayStack: [], selectedPlayer: null, coachSeat: null, teamCard: null, godStack: [],
    seasonOpener: null, playbookInvite: null, bigMoment: null, navTrail: [], live: null,
  });
}

describe('what the back gesture has to close', () => {
  it('has nothing at the root of HOME, which is the one press that leaves', () => {
    atHomeRoot();
    expect(depth()).toBe(0);
    expect(newest()).toBeNull();
  });

  it('claims the press for a guard, a player card, a team card and an overlay', () => {
    atHomeRoot();
    useDynasty.setState({ playbookInvite: 'PST' });
    expect([depth(), newest()?.kind]).toEqual([1, 'guard']);
    useDynasty.setState({ playbookInvite: null });

    const id = useDynasty.getState().season!.teams[0]!.team.lineup[0]!.id;
    useDynasty.getState().openPlayer(id);
    expect([depth(), newest()?.kind]).toEqual([1, 'p']);
    useDynasty.getState().closePlayer();

    useDynasty.getState().openTeamCard(3);
    expect([depth(), newest()?.kind]).toEqual([1, 't']);
    useDynasty.getState().closeTeamCard();

    useDynasty.getState().openOverlay('inbox');
    expect([depth(), newest()?.kind]).toEqual([1, 'overlay']);
    useDynasty.getState().closeOverlay();
    expect(depth()).toBe(0);
  });

  it('counts each route stop behind the screen as a level, and back walks them', () => {
    atHomeRoot();
    const team = TABS.find((t) => t.id === 'team')!;
    const second = team.screens[1]?.id ?? team.screens[0]!.id;
    useDynasty.getState().go('team');
    expect([depth(), newest()?.kind]).toEqual([1, 'route']);
    useDynasty.getState().setScreen(second);
    expect(depth()).toBe(2);
    expect(newest()!.peel()).toBe('peeled');
    expect([useDynasty.getState().tab, useDynasty.getState().screen, depth()]).toEqual(['team', team.screens[0]!.id, 1]);
    expect(newest()!.peel()).toBe('peeled');
    expect([useDynasty.getState().tab, depth()]).toEqual(['home', 0]);
  });

  it('still claims a blocking card, so the press is swallowed rather than an exit', () => {
    // The opener, the playbook invite and the big moment are answered on
    // their own terms; a gesture during one must not leave the game.
    atHomeRoot();
    useDynasty.setState({ playbookInvite: 'PST' });
    const nudged = useDynasty.getState().cardNudge;
    expect(newest()!.peel()).toBe('refused');
    expect(depth()).toBe(1);
    expect(useDynasty.getState().cardNudge).toBe(nudged + 1);
    useDynasty.setState({ playbookInvite: null });
  });
});

// ---------------------------------------------------------------------------
// Which card the press actually has to answer
// ---------------------------------------------------------------------------

const OPENER = {
  year: 2027, headline: 'A quiet winter', message: 'They will watch the spring.',
  schoolBefore: 50, schoolAfter: 51, coachBefore: 50, coachAfter: 52,
  askSummary: 'Thirty wins', askDetail: 'And a conference finish.', targetWins: 30,
  stings: [],
};

describe('the card the back press has to answer', () => {
  it('stops claiming the press once the coach is reading the board it sent him to', () => {
    /*
      Reported 2026-09-10: "if at the start of the year I hit go to the board
      and then try going back it glitches and shows as if the card was still
      there and does a quick flick the screen."

      The opener stays in the store while you are at the board, so that leaving
      without taking the terms brings it back. The gesture asked the store, so
      it was swallowed for the whole of that errand: one swipe, nothing peeled,
      and a browser history entry spent on nothing.
    */
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ seasonOpener: OPENER, tab: 'home', screen: 'today', overlay: null });
    expect(openerShowing(useDynasty.getState())).toBe(true);
    expect(blockingCardUp(useDynasty.getState())).toBe(true);

    // The errand it sent him on, as an overlay over whatever he was reading.
    useDynasty.setState({ overlay: 'board' });
    expect(openerShowing(useDynasty.getState())).toBe(false);
    expect(blockingCardUp(useDynasty.getState())).toBe(false);

    // And as the OFFICE tab's own board screen, which is the same page.
    useDynasty.setState({ overlay: null, tab: 'office', screen: 'board' });
    expect(openerShowing(useDynasty.getState())).toBe(false);

    // The program's overview is not the board: the card is still owed.
    useDynasty.setState({ tab: 'program', screen: 'records' });
    expect(openerShowing(useDynasty.getState())).toBe(true);

    // Leave without taking the terms and the card is owed an answer again.
    useDynasty.setState({ tab: 'home', screen: 'today' });
    expect(openerShowing(useDynasty.getState())).toBe(true);

    // Taken, it is gone for good.
    useDynasty.getState().dismissSeasonOpener();
    expect(openerShowing(useDynasty.getState())).toBe(false);
  });

  it('never shows the opener over a live game or an offseason step', () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ seasonOpener: OPENER, tab: 'home', screen: 'today', overlay: null });
    useDynasty.setState({ phase: 'recruiting' });
    expect(openerShowing(useDynasty.getState())).toBe(false);
    useDynasty.setState({ phase: null });
    expect(openerShowing(useDynasty.getState())).toBe(true);
  });

  it('still claims the press for the two cards that have no errand to send you on', () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ seasonOpener: null, tab: 'program', screen: 'records', overlay: null });
    expect(blockingCardUp(useDynasty.getState())).toBe(false);
    // The scouting invite and a big moment are answered where they stand, so
    // they claim the press from anywhere — the board included.
    useDynasty.setState({ playbookInvite: 'PST' });
    expect(blockingCardUp(useDynasty.getState())).toBe(true);
    useDynasty.setState({ playbookInvite: null, bigMoment: { kind: 'title', team: 0, line: 'Bayou State 4, Gulf 2', year: 2027 } });
    expect(blockingCardUp(useDynasty.getState())).toBe(true);
    useDynasty.getState().clearBigMoment();
    expect(blockingCardUp(useDynasty.getState())).toBe(false);
  });
});

describe('a screen the gesture brought back', () => {
  it('is marked so it does not rise again under a finger that already moved it', () => {
    /*
      `.screen-in` is the frame's 260ms rise on every arriving screen. Killing
      the view transition left that playing after the swipe had already carried
      the page across — the "quick flick" half of the same report.

      The mark survives the restore it was set for and comes off at the next
      forward navigation, because removing it a frame later would start the
      very animation it exists to prevent.
    */
    const root = { dataset: {} as Record<string, string | undefined> };
    (globalThis as { document?: unknown }).document = { documentElement: root };
    try {
      useDynasty.getState().start(4242, 0);
      nextNavInstant();
      expect(root.dataset.nav).toBe('back');
      // The restore itself. The mark has to outlive it: the screen mounts here.
      useDynasty.getState().go('team');
      expect(root.dataset.nav).toBe('back');
      // The next move forward is a screen that should rise.
      useDynasty.getState().go('home');
      expect(root.dataset.nav).toBeUndefined();
    } finally {
      delete (globalThis as { document?: unknown }).document;
    }
  });
});

// ---------------------------------------------------------------------------
// The navigation the browser throws the animation away for
// ---------------------------------------------------------------------------

/** A `document` with Chrome's measured behaviour: the second capture is
 *  dropped and its update callback is never invoked. */
function stubDocument(): { root: { dataset: Record<string, string | undefined> }; starts: () => number } {
  const root = { dataset: {} as Record<string, string | undefined> };
  let starts = 0;
  (globalThis as { document?: unknown }).document = {
    documentElement: root,
    // `finished` settles so the module-level in-flight flag clears between
    // cases; the update callback, faithfully, is never called at all.
    startViewTransition: (): unknown => { starts += 1; return { finished: Promise.resolve() }; },
  };
  return { root, starts: () => starts };
}

describe('a navigation whose animation the browser throws away', () => {
  it('does not leave the second tap waiting behind the first', () => {
    /*
      Measured in Chrome on 2026-09-10 by wrapping `startViewTransition`: two
      calls in one task log `start 0`, `start 1`, `callback-ran 0`, and then
      nothing at all. Everything the store did on navigation lived in that
      callback, so the second tap was thrown away — while its history
      checkpoint had already been pushed underneath it.
    */
    const { root } = stubDocument();
    try {
      useDynasty.getState().start(4242, 0);
      useDynasty.setState({ tab: 'home', screen: 'today' });
      useDynasty.getState().go('team');
      // The capture is live and its callback has not run: nothing has moved.
      expect(useDynasty.getState().tab).toBe('home');
      expect(root.dataset.vt).toBe('1');
      // The second one takes the navigation rather than queueing behind it.
      useDynasty.getState().go('program');
      expect(useDynasty.getState().tab).toBe('program');
    } finally {
      delete (globalThis as { document?: unknown }).document;
    }
  });

  it('lands on its own within a frame budget when nothing ever calls back', async () => {
    stubDocument();
    try {
      useDynasty.getState().start(4242, 0);
      useDynasty.setState({ tab: 'home', screen: 'today' });
      useDynasty.getState().go('team');
      expect(useDynasty.getState().tab).toBe('home');
      await new Promise((r) => setTimeout(r, 180));
      expect(useDynasty.getState().tab).toBe('team');
    } finally {
      delete (globalThis as { document?: unknown }).document;
    }
  });

  it('never drags the coach back to a screen a later tap has already replaced', async () => {
    // The hazard the insurance itself creates: an overtaken timer must not
    // fire. A dropped transition whose screen was superseded stays dropped.
    stubDocument();
    try {
      useDynasty.getState().start(4242, 0);
      useDynasty.setState({ tab: 'home', screen: 'today' });
      useDynasty.getState().go('team');
      useDynasty.getState().go('program');
      expect(useDynasty.getState().tab).toBe('program');
      await new Promise((r) => setTimeout(r, 250));
      expect(useDynasty.getState().tab).toBe('program');
    } finally {
      delete (globalThis as { document?: unknown }).document;
    }
  });
});

describe("a room and the browser's history", () => {
  it('is a screen of its tab where there is a nav, and one layer over anything else', () => {
    /*
      The rooms used to be sheets inside Program's overview, and the sheets
      were levels, routes or neither depending on how they were opened. They
      are screens of their own now (2026-09-24), so a room is either a place
      you went — the route trail's entry — or a layer, with one entry each.
    */
    useDynasty.getState().start(4242, 0);
    try {
      useDynasty.setState({ tab: 'home', screen: 'today', overlay: null, overlayStack: [], selectedPlayer: null, coachSeat: null });
      // One level more is one history entry more (historySync.ts keeps them equal).
      expect(levelsAdded(() => useDynasty.getState().openRoom('staff'))).toBe(1);
      expect(newest()?.kind).toBe('route');
      expect(useDynasty.getState().tab).toBe('office');
      expect(useDynasty.getState().screen).toBe('staff');
      expect(useDynasty.getState().overlay).toBeNull();

      // Over the inbox, the board is a layer of its own, and the inbox stays.
      useDynasty.setState({ overlay: 'inbox', overlayStack: [] });
      expect(levelsAdded(() => useDynasty.getState().openRoom('board'))).toBe(1);
      expect(useDynasty.getState().overlay).toBe('board');
      expect(useDynasty.getState().overlayStack.map((l) => l.overlay)).toEqual(['inbox']);

      // In the offseason there is no nav: the room lays over the step.
      useDynasty.setState({ overlay: null, overlayStack: [], phase: 'review' });
      expect(levelsAdded(() => useDynasty.getState().openRoom('staff'))).toBe(1);
      expect(newest()?.kind).toBe('overlay');
      expect(useDynasty.getState().overlay).toBe('staff');

      // The coach profile has no tab: always a layer, never Program's page.
      useDynasty.setState({ overlay: null, overlayStack: [], phase: null, tab: 'team', screen: 'roster' });
      expect(levelsAdded(() => useDynasty.getState().openRoom('coach'))).toBe(1);
      expect(newest()?.kind).toBe('overlay');
      expect(useDynasty.getState().overlay).toBe('coach');
      expect(useDynasty.getState().tab).toBe('team');
    } finally {
      useDynasty.setState({ overlay: null, overlayStack: [], phase: null });
    }
  });
});

/** How many levels a sequence adds (negative: gives back). The ledger keeps one entry per level. */
function levelsAdded(run: () => void): number {
  const before = depth();
  run();
  return depth() - before;
}

/*
  The old version of the test above covered a Program sheet opened over
  nothing and inside the Program overlay, and passed for months while the
  gesture was broken the whole time — because the path a coach actually takes
  is neither of those. He opens the board from an INBOX letter.

  Reported 2026-09-12: "if I'm in inbox and tap on go to the board, and then
  try to go back by doing the back gesture, it gets crazy and makes me go to
  different tabs as well." Measured from PROGRAM · OVERVIEW before the fix:
  three history entries for one visible layer, five back presses to undo one
  tap, and one of those presses moving the wrong way — forward, into the board.

  The rule the whole file is really about, and the one none of it stated:
  **one visible layer, one history entry.**
*/
describe('one visible layer, one history entry', () => {
  // Since CL (2026-09-30) the store sends the shell nothing: each count here
  // is the change in `nav.depth()`, which the ledger turns into entries.

  it('spends one for the board a letter opens, and keeps the inbox underneath it', () => {
    /*
      `Inbox.tsx` runs `setProgramSheet(link.sheet)` and then
      `openOverlay('program')`. `overlay` used to be a single value, so that
      REPLACED the inbox — and the back press from the board landed on
      whatever screen the inbox had been over, not on the inbox (06 §AE.2).
      Both calls once checkpointed as well, minting two entries for the swap
      and orphaning a third; that half was fixed by checkpointing only a
      genuinely new layer, and it still holds: the sheet spends nothing.

      Now the board IS a new layer. It spends one entry, the inbox keeps the
      one it already spent underneath, and closing peels them in order.
    */
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({
      tab: 'program', screen: 'records', overlay: 'inbox',
      overlayStack: [], selectedPlayer: null, coachSeat: null,
    });
    const added = levelsAdded(() => { useDynasty.getState().openRoom('board'); });
    expect(added, 'one layer, one entry').toBe(1);
    expect(useDynasty.getState().overlay).toBe('board');
    expect(useDynasty.getState().overlayStack.map((l) => l.overlay)).toEqual(['inbox']);

    // Back from the board: the inbox, not the screen under it.
    expect(levelsAdded(() => { useDynasty.getState().closeOverlay(); })).toBe(-1);
    expect(useDynasty.getState().overlay).toBe('inbox');
    expect(useDynasty.getState().overlayStack).toEqual([]);
    // And back from the inbox: nothing.
    expect(levelsAdded(() => { useDynasty.getState().closeOverlay(); })).toBe(-1);
    expect(useDynasty.getState().overlay).toBeNull();
    useDynasty.setState({ overlay: null, overlayStack: [] });
  });

  it('brings a buried room back when the layers over it close', () => {
    /*
      The deeper case: the budget open as a layer, the inbox opened over it
      from the coach menu, a letter in there to the board. Three layers, three
      entries, and the back press peels them in the order they were opened.
    */
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({
      tab: 'home', screen: 'today', overlay: null, overlayStack: [], phase: 'review',
      selectedPlayer: null, coachSeat: null,
    });
    expect(levelsAdded(() => { useDynasty.getState().openRoom('budget'); })).toBe(1);
    expect(levelsAdded(() => { useDynasty.getState().openOverlay('inbox'); })).toBe(1);
    expect(levelsAdded(() => { useDynasty.getState().openRoom('board'); })).toBe(1);
    expect(useDynasty.getState().overlayStack.map((l) => l.overlay)).toEqual(['budget', 'inbox']);

    useDynasty.getState().closeOverlay();
    expect(useDynasty.getState().overlay).toBe('inbox');
    useDynasty.getState().closeOverlay();
    expect(useDynasty.getState().overlay).toBe('budget');
    useDynasty.getState().closeOverlay();
    expect(useDynasty.getState().overlay).toBeNull();
    expect(useDynasty.getState().overlayStack).toEqual([]);
    useDynasty.setState({ phase: null });
  });

  it('does not bury a layer under itself', () => {
    // INBOX from the coach menu while the inbox is already up.
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ tab: 'home', screen: 'today', overlay: 'inbox', overlayStack: [] });
    expect(levelsAdded(() => { useDynasty.getState().openOverlay('inbox'); })).toBe(0);
    expect(useDynasty.getState().overlayStack).toEqual([]);
    useDynasty.setState({ overlay: null, overlayStack: [] });
  });

  it("hands a coach sheet's entry to the room it asked for", () => {
    /*
      The coach's sheet says "Build the Hitting Barn". Closing the sheet the
      usual way pops an entry while the room pushes one, and the browser runs
      the pop later — the room's own entry is the one lost. The sheet hands its
      entry over instead, on a tab and as a layer alike.
    */
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ tab: 'office', screen: 'staff', overlay: null, overlayStack: [], selectedPlayer: null, coachSeat: null });
    expect(levelsAdded(() => { useDynasty.getState().openCoach('hitting'); })).toBe(1);
    expect(levelsAdded(() => { useDynasty.getState().openRoom('facilities'); })).toBe(0);
    expect(useDynasty.getState().coachSeat).toBeNull();
    expect(useDynasty.getState().screen).toBe('facilities');

    // The same in the offseason, where the staff room is a layer.
    useDynasty.setState({ tab: 'home', screen: 'today', overlay: 'staff', overlayStack: [], phase: 'review', coachSeat: null });
    expect(levelsAdded(() => { useDynasty.getState().openCoach('hitting'); })).toBe(1);
    expect(levelsAdded(() => { useDynasty.getState().openRoom('facilities'); })).toBe(0);
    expect(useDynasty.getState().coachSeat).toBeNull();
    expect(useDynasty.getState().overlay).toBe('facilities');
    expect(useDynasty.getState().overlayStack.map((l) => l.overlay)).toEqual(['staff']);
    // Back from the buildings: the staff room, one entry spent.
    expect(levelsAdded(() => { useDynasty.getState().closeOverlay(); })).toBe(-1);
    expect(useDynasty.getState().overlay).toBe('staff');
    useDynasty.setState({ overlay: null, overlayStack: [], phase: null });
  });

  it('still spends one when a layer is genuinely opened over nothing', () => {
    // The other half: the fix must not stop a real layer from being recorded,
    // or the gesture has nothing to peel and walks out of the app instead.
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ tab: 'home', screen: 'today', overlay: null, selectedPlayer: null, coachSeat: null });
    expect(levelsAdded(() => { useDynasty.getState().openOverlay('inbox'); })).toBe(1);
    expect(levelsAdded(() => { useDynasty.getState().closeOverlay(); })).toBe(-1);
  });

  it("spends the card's entry when a tab change drops the card", () => {
    /*
      `go` closes the card too — its `set` nulls `selectedPlayer` and
      `coachSeat` — and once walked off without paying: one orphan entry per
      card the coach opened before changing tab, spent later by the gesture on
      somebody else's screen.
    */
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ tab: 'team', screen: 'roster', overlay: null, selectedPlayer: null, coachSeat: null });
    const id = useDynasty.getState().season?.teams[0]?.team.lineup[0]?.id;
    expect(id).toBeDefined();
    const added = levelsAdded(() => {
      useDynasty.getState().openPlayer(id!);
      // Within the area: a bottom-tab tap now resets the trail instead (M45).
      useDynasty.getState().go('team', 'stats');
    });
    /*
      One entry, handed over, since 2026-09-16 (05 §90.6): the card's level
      goes in the same write that adds the route's, so the ledger sees one
      level more and pushes once. Spending the card's entry and pushing the
      route's in one breath was a race the browser lost, leaving the route's
      entry in the FORWARD list.
    */
    expect(added, "the card's entry is the route's now").toBe(1);
    expect(newest()?.kind).toBe('route');
    expect(useDynasty.getState().selectedPlayer).toBeNull();
  });

  it('and when a screen change within a tab drops it', () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ tab: 'team', screen: 'roster', overlay: null, selectedPlayer: null, coachSeat: null });
    const id = useDynasty.getState().season?.teams[0]?.team.lineup[0]?.id;
    const added = levelsAdded(() => {
      useDynasty.getState().openPlayer(id!);
      useDynasty.getState().setScreen('lineup');
    });
    // The same hand-over as `go`: one entry, the card's, now the screen's.
    expect(added).toBe(1);
    expect(newest()?.kind).toBe('route');
  });
});

/*
  And the freeze, which is the other half of the same report: "it got like
  frozen for 2 seconds and then took me to the program overview".
*/
describe('a navigation on a page nobody is looking at', () => {
  /*
    `vtInFlight` is module state that clears on a 600ms timer, so a test that
    starts a transition and returns synchronously leaves the next one unable to
    start its own. Both tests below hand back a resolved `finished` and flush
    the microtask queue, so each leaves the store as it found it.
  */
  const seeing = (visibilityState: string): { started: () => number } => {
    const root = { dataset: {} as Record<string, string | undefined> };
    let started = 0;
    (globalThis as { document?: unknown }).document = {
      documentElement: root,
      visibilityState,
      addEventListener: () => {},
      removeEventListener: () => {},
      /*
        The callback is never called, faithfully, exactly as `stubDocument`
        above does not call it — that is what Chrome does when a transition is
        dropped, and calling it here would reach `requestAnimationFrame`, which
        node does not have. `finished` settles so the in-flight flag clears
        between cases.
      */
      startViewTransition: () => { started++; return { finished: Promise.resolve() }; },
    };
    return { started: () => started };
  };
  const settle = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    delete (globalThis as { document?: unknown }).document;
  };

  it('takes the plain path rather than a transition it cannot finish', async () => {
    /*
      A view transition suspends rendering of the whole document until its
      update callback settles. `crossfade` settles on a double
      `requestAnimationFrame` with a 100ms timer as insurance — and the very
      condition that insurance was written for, a WebView that has stopped
      serving frames, is also when a browser throttles timers to one a second.
      Measured 2026-09-12 on a non-rendering page: `requestAnimationFrame`
      never fired, and eight `setTimeout(…, 100)` fired at 781 to 1011ms.
    */
    const seen = seeing('hidden');
    try {
      useDynasty.getState().start(4242, 0);
      useDynasty.setState({ tab: 'home', screen: 'today' });
      useDynasty.getState().go('team');
      expect(seen.started(), 'a hidden page started a transition').toBe(0);
      // And the navigation still happened, which is the whole point.
      expect(useDynasty.getState().tab).toBe('team');
    } finally {
      await settle();
    }
  });

  it('still decorates one the coach can actually see', async () => {
    const seen = seeing('visible');
    try {
      useDynasty.getState().start(4242, 0);
      useDynasty.setState({ tab: 'home', screen: 'today' });
      useDynasty.getState().go('team');
      expect(seen.started(), 'a visible page skipped its transition').toBe(1);
      // The landing is not asserted here: with the callback dropped, the state
      // arrives on crossfade's 100ms fallback, which is the case the three
      // tests above this block already cover.
    } finally {
      await settle();
    }
  });
});
