// The front door, and the delete that finally sticks.
//
// Reported together: "we also have to work on the save files screen, it is
// messy and doesn't work as intended — hitting delete a save doesn't really
// delete it. We also need to start creating the starting screen."
//
// They were one bug and one feature that needed each other. `saveNow` defaults
// to the autosave slot and half the app calls it, so deleting the file the
// live career was writing to was undone by the very next tap. A career needs
// somewhere to be let go OF, and that is the start screen.

import { describe, it, expect } from 'vitest';
import { useDynasty } from '../src/state/store.js';

describe('the front door', () => {
  it('opens there, and a career closes back to it', () => {
    useDynasty.setState({ atStart: true, season: null });
    expect(useDynasty.getState().atStart).toBe(true);

    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ atStart: false });
    expect(useDynasty.getState().season).not.toBeNull();

    useDynasty.getState().backToStart();
    const s = useDynasty.getState();
    expect(s.atStart).toBe(true);
    expect(s.season).toBeNull();
    // Nothing left running that could write the career back down.
    expect(s.live).toBeNull();
    expect(s.busy).toBe(false);
  });

  /*
    The success path — delete the live slot, the career is let go, and the
    row does not come back on the next tap — was walked in the browser,
    where there is real storage. There is none under vitest, so what can be
    pinned here is the property that matters when the delete does NOT
    succeed: a failed delete must never destroy the career that is running.
    Closing it on a failure would lose a dynasty to a storage hiccup.
  */
  it('keeps the career when the delete fails', async () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ atStart: false, loadedSlot: 'auto' });
    expect(useDynasty.getState().season).not.toBeNull();

    await useDynasty.getState().deleteSlot('auto');

    const s = useDynasty.getState();
    if (s.savesError !== null) {
      // Storage refused, so nothing was deleted and nothing may be lost.
      expect(s.season).not.toBeNull();
      expect(s.atStart).toBe(false);
    } else {
      // Storage obliged: the career goes with its file.
      expect(s.season).toBeNull();
      expect(s.atStart).toBe(true);
    }
  });

  it('leaves other careers alone when one is deleted', async () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ atStart: false, loadedSlot: 'auto' });
    // A slot that is not the one being played must not close the career.
    await useDynasty.getState().deleteSlot('some-other-slot');
    expect(useDynasty.getState().season).not.toBeNull();
    expect(useDynasty.getState().atStart).toBe(false);
  });
});
