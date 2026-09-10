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

import { describe, it, expect, vi } from 'vitest';
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

// IndexedDB is not in node; the same Map-backed stand-in the saves suite uses,
// because the reconsider test below is partly about what a save carries.
const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_store: string, value: { slot: string }) => { disk.set(value.slot, structuredClone(value)); },
    get: async (_store: string, key: string) => {
      const found = disk.get(key);
      return found === undefined ? undefined : structuredClone(found);
    },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_store: string, key: string) => { disk.delete(key); },
  }),
}));

/*
  Reported, again: "I asked them to take less wins, they accepted but the
  actual number they are asking in the board stayed the same — they were
  asking for 18, accepted to do less, and still the board kept 18."
*/
describe('asking the board to reconsider', () => {
  it('moves the number everywhere the board says it, and the save keeps it', async () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.getState().settleSeason();
    await useDynasty.getState().rollYear();
    const before = useDynasty.getState().boardAsk!;
    const report = useDynasty.getState().lastOffseason!;
    // A winter that took a whole side apart: seven men who would have played.
    const gone = Array.from({ length: 7 }, (_, i) => ({ id: `g${i}`, name: `Man ${i}`, pos: 'SS' }));
    useDynasty.setState({
      lastOffseason: { ...report, graduated: gone as unknown as typeof report.graduated, drafted: [] },
    });

    const give = useDynasty.getState().argueTerms();
    expect(give).toBeGreaterThan(0);
    const target = before.targetWins - give;
    const s = useDynasty.getState();
    expect(s.boardAsk!.targetWins).toBe(target);
    expect(s.boardAsk!.objectives.find((o) => o.key === 'wins')!.target).toBe(target);
    // The opener strip and modal say the same number as the board.
    expect(s.seasonOpener!.targetWins).toBe(target);

    // Once. A second case is refused and moves nothing.
    expect(useDynasty.getState().argueTerms()).toBe(0);
    expect(useDynasty.getState().boardAsk!.targetWins).toBe(target);

    // And the save carries the concession through a reload.
    await useDynasty.getState().saveNow('argued');
    useDynasty.setState({ boardAsk: before, arguedTerms: false });
    expect(await useDynasty.getState().loadSlot('argued')).toBe(true);
    expect(useDynasty.getState().boardAsk!.targetWins).toBe(target);
    expect(useDynasty.getState().arguedTerms).toBe(true);
  });
});
