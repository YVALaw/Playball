// backNav.test.ts
// The back gesture's one question — is there a layer to peel? — pinned in the
// same order the handler peels them, because Android 16 asks it before the
// press and the answer decides whether the system previews an exit.

import { describe, it, expect } from 'vitest';
import { hasLayerToClose, type BackState } from '../src/ui/backNav.js';
import { blockingCardUp, openerShowing, nextNavInstant, useDynasty, TABS } from '../src/state/store.js';

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
    useDynasty.setState({ overlay: 'program', programSheet: 'board' });
    expect(openerShowing(useDynasty.getState())).toBe(false);
    expect(blockingCardUp(useDynasty.getState())).toBe(false);

    // And as the PROGRAM tab's own records screen, which is the same page.
    useDynasty.setState({ overlay: null, tab: 'program', screen: 'records' });
    expect(openerShowing(useDynasty.getState())).toBe(false);

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

describe("Program's sheets and the browser's history", () => {
  it('spends an entry when a sheet is a destination, and none when it is a level in an overlay', () => {
    /*
      The route trail keys on the tab and the screen, so it cannot see a sheet
      changing inside an overlay — Program opened from the inbox, or from the
      board the season's opener sends you to. Pushing an entry for each one
      left an orphan per sheet the coach looked at, and the next few back
      presses walked the screen underneath backwards. The gesture peels those
      levels itself (App.tsx) and hands the pop's entry straight back.
    */
    useDynasty.getState().start(4242, 0);
    const shell = new EventTarget();
    (globalThis as { window?: unknown }).window = shell;
    const asked: string[] = [];
    const onPush = (): void => { asked.push('push'); };
    const onConsume = (): void => { asked.push('consume'); };
    shell.addEventListener('playball:history-checkpoint', onPush);
    shell.addEventListener('playball:history-consume', onConsume);
    try {
      // As the PROGRAM tab's own screen, every sheet is somewhere you went.
      useDynasty.setState({ tab: 'program', screen: 'records', overlay: null, programSheet: 'overview' });
      useDynasty.getState().setProgramSheet('money');
      expect(asked).toEqual(['push']);
      useDynasty.getState().setProgramSheet('overview');
      expect(asked).toEqual(['push', 'consume']);

      // As an overlay over something else, the sheets are one layer.
      asked.length = 0;
      useDynasty.setState({ tab: 'home', screen: 'today', overlay: 'program', programSheet: 'overview' });
      useDynasty.getState().setProgramSheet('staff');
      useDynasty.getState().setProgramSheet('facilities');
      useDynasty.getState().setProgramSheet('overview');
      expect(asked).toEqual([]);
    } finally {
      shell.removeEventListener('playball:history-checkpoint', onPush);
      shell.removeEventListener('playball:history-consume', onConsume);
      delete (globalThis as { window?: unknown }).window;
      useDynasty.setState({ overlay: null, programSheet: 'overview' });
    }
  });
});

/*
  The test above covered `overlay: null` and `overlay: 'program'` and passed
  for months, while the gesture was broken the whole time — because the path a
  coach actually takes is neither of those. He opens the board from an INBOX
  letter, and `overlay` is still 'inbox' when the sheet is set.

  Reported 2026-09-12: "if I'm in inbox and tap on go to the board, and then
  try to go back by doing the back gesture, it gets crazy and makes me go to
  different tabs as well." Measured from PROGRAM · OVERVIEW before the fix:
  three history entries for one visible layer, five back presses to undo one
  tap, and one of those presses moving the wrong way — forward, into the board.

  The rule the whole file is really about, and the one none of it stated:
  **one visible layer, one history entry.**
*/
describe('one visible layer, one history entry', () => {
  /** Count what the store asks the shell for, while a sequence runs. */
  const asking = (run: () => void): string[] => {
    const shell = new EventTarget();
    (globalThis as { window?: unknown }).window = shell;
    const asked: string[] = [];
    const onPush = (): void => { asked.push('push'); };
    const onConsume = (): void => { asked.push('consume'); };
    shell.addEventListener('playball:history-checkpoint', onPush);
    shell.addEventListener('playball:history-consume', onConsume);
    try { run(); } finally {
      shell.removeEventListener('playball:history-checkpoint', onPush);
      shell.removeEventListener('playball:history-consume', onConsume);
      delete (globalThis as { window?: unknown }).window;
    }
    return asked;
  };

  it('spends nothing extra when a letter swaps the inbox for the board', () => {
    /*
      `Inbox.tsx` runs `setProgramSheet(link.sheet)` and then
      `openOverlay('program')`. `overlay` is a single value, so that REPLACES
      the inbox: one layer before, one layer after, and the inbox's entry still
      covers it. Both calls used to checkpoint — the sheet because its guard
      asked `overlay !== 'program'` and the overlay because its guard asked
      `overlay !== o` — so one tap minted two entries and orphaned a third.
    */
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({
      tab: 'program', screen: 'records', overlay: 'inbox', programSheet: 'overview',
      selectedPlayer: null, coachSeat: null,
    });
    const asked = asking(() => {
      useDynasty.getState().setProgramSheet('board');
      useDynasty.getState().openOverlay('program');
    });
    expect(asked, 'a swap minted an entry').toEqual([]);
    useDynasty.setState({ overlay: null, programSheet: 'overview' });
  });

  it('peels a sheet back to the one the overlay opened at, not to the overview', () => {
    /*
      Reported 2026-09-12: "I tapped 'take me to the board' then back gesture,
      it took me back to the card saying take me to the board... and then took
      me to the program overview."

      Both the opener's card and an inbox letter send the coach straight to the
      BOARD sheet. The back press peeled any sheet that was not 'overview', so
      the first press parked him on a Program overview he never asked for and
      cost him the press; only the second closed the overlay, and by then the
      opener card was back on top.

      A coach who opened Program himself and walked down into Money is the case
      that rule was written for, and it still holds — the difference is which
      sheet is behind him, which is now recorded when the overlay opens.
    */
    useDynasty.getState().start(4242, 0);
    // Sent straight to the board: nothing behind it.
    useDynasty.setState({ tab: 'home', screen: 'today', overlay: null, programSheet: 'board' });
    useDynasty.getState().openOverlay('program');
    expect(useDynasty.getState().overlayEntrySheet).toBe('board');

    // Walked down into Money himself: the overview IS behind him.
    useDynasty.setState({ tab: 'home', screen: 'today', overlay: null, programSheet: 'overview' });
    useDynasty.getState().openOverlay('program');
    expect(useDynasty.getState().overlayEntrySheet).toBe('overview');
    useDynasty.getState().setProgramSheet('money');
    expect(useDynasty.getState().programSheet).toBe('money');
    useDynasty.setState({ overlay: null, programSheet: 'overview' });
  });

  it('still spends one when a layer is genuinely opened over nothing', () => {
    // The other half: the fix must not stop a real layer from being recorded,
    // or the gesture has nothing to peel and walks out of the app instead.
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ tab: 'home', screen: 'today', overlay: null, selectedPlayer: null, coachSeat: null });
    expect(asking(() => { useDynasty.getState().openOverlay('inbox'); })).toEqual(['push']);
    expect(asking(() => { useDynasty.getState().closeOverlay(); })).toEqual(['consume']);
  });

  it("spends the card's entry when a tab change drops the card", () => {
    /*
      `openPlayer` checkpoints and `closePlayer` consumes, but `go` closes the
      card too — its `set` nulls `selectedPlayer` and `coachSeat` — and used to
      walk off without paying. One orphan per card the coach opened before
      changing tab, and the orphans are what the gesture spends later on
      somebody else's screen.
    */
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ tab: 'team', screen: 'roster', overlay: null, selectedPlayer: null, coachSeat: null });
    const id = useDynasty.getState().season?.teams[0]?.team.lineup[0]?.id;
    expect(id).toBeDefined();
    const asked = asking(() => {
      useDynasty.getState().openPlayer(id!);
      useDynasty.getState().go('home');
    });
    expect(asked, 'the card was dropped without spending its entry')
      .toEqual(['push', 'consume', 'push']);
    expect(useDynasty.getState().selectedPlayer).toBeNull();
  });

  it('and when a screen change within a tab drops it', () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ tab: 'team', screen: 'roster', overlay: null, selectedPlayer: null, coachSeat: null });
    const id = useDynasty.getState().season?.teams[0]?.team.lineup[0]?.id;
    const asked = asking(() => {
      useDynasty.getState().openPlayer(id!);
      useDynasty.getState().setScreen('lineup');
    });
    expect(asked).toEqual(['push', 'consume', 'push']);
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
