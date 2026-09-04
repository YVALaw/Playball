// The mandate says one number.
//
// Reported three separate times, most recently: "the beginning of the year
// card asked me for 17 wins, when I tap to go see the board it says 23. It
// shouldn't change from what they first asked at the beginning of the year or
// after hiring you."
//
// A fresh career always agreed with itself, which is why this took three
// reports to place. The divergence needs a SECOND stamp, and there is exactly
// one: taking another job. `acceptOffer` restamps for the new chair, and the
// opener built at the roll went on carrying the old board's number.

import { describe, it, expect } from 'vitest';
import { useDynasty } from '../src/state/store.js';

describe('the board asks for one number', () => {
  it('stamps the opener and the board from the same ask', async () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.getState().settleSeason();
    await useDynasty.getState().rollYear();

    const s = useDynasty.getState();
    expect(s.seasonOpener).not.toBeNull();
    expect(s.boardAsk).not.toBeNull();
    // The one number, in both places the player can read it.
    expect(s.seasonOpener?.targetWins).toBe(s.boardAsk?.targetWins);
  });

  it('does not leave the old board\'s letter standing after a move', async () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.getState().settleSeason();
    await useDynasty.getState().rollYear();
    expect(useDynasty.getState().seasonOpener).not.toBeNull();

    // Somewhere else entirely, and its board is not the one that wrote the
    // letter — so the letter goes rather than presenting a stale number
    // beside the new chair's.
    const mine = useDynasty.getState().userTeam;
    const elsewhere = mine === 0 ? 1 : 0;
    await useDynasty.getState().acceptOffer(elsewhere);

    const s = useDynasty.getState();
    if (s.userTeam === elsewhere) {
      expect(s.seasonOpener).toBeNull();
      expect(s.boardAsk).not.toBeNull();
    }
  });

  it('settles an unstamped board once instead of recomputing it', () => {
    useDynasty.getState().start(4242, 0);
    // A save that arrived without one — the state the drift used to come from.
    useDynasty.setState({ boardAsk: null });
    useDynasty.getState().stampBoardAsk();
    const first = useDynasty.getState().boardAsk;
    expect(first).not.toBeNull();

    // Asking again must not move it, however far the roster has come.
    useDynasty.getState().stampBoardAsk();
    expect(useDynasty.getState().boardAsk).toBe(first);
  });
});
