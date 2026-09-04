// Start.tsx
// The front door.
//
// Asked for by name: "we need to start creating the starting screen. Like new
// game, load game etc." Until now the app resumed the autosave the instant it
// booted, which meant a career could only be left by deleting it — and gave a
// player no moment to choose a different one, or to start again without first
// landing inside the last dynasty.
//
// It also fixes a reported bug by giving it somewhere to stand. Deleting the
// live career's file "doesn't really delete it", because `saveNow` defaults to
// the autosave slot and half the app calls it: the next tap wrote the file
// straight back. A career now has a place to be let go OF — the door closes
// behind it and nothing is left running to rewrite the slot.

import { useEffect, useState } from 'react';
import { useDynasty } from '../../state/store.js';

/** How long ago, in the fewest words that are still true. */
function when(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function Start(
  { onNew, onLoad, onSettings }:
  { onNew: () => void; onLoad: () => void; onSettings: () => void },
) {
  const saves = useDynasty((s) => s.saves);
  const refreshSaves = useDynasty((s) => s.refreshSaves);
  const loadSlot = useDynasty((s) => s.loadSlot);
  const leaveStart = useDynasty((s) => s.leaveStart);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void refreshSaves(); }, [refreshSaves]);

  // The one to come back to: the most recently written, whatever it is called.
  const latest = saves.length === 0
    ? null
    : [...saves].sort((a, b) => b.savedAt - a.savedAt)[0]!;

  const resume = (): void => {
    if (!latest || busy) return;
    setBusy(true);
    void loadSlot(latest.slot)
      .then((ok) => { if (!ok) setBusy(false); })
      .catch(() => setBusy(false));
  };

  return (
    <div className="start-screen">
      <header>
        <small>COLLEGE BASEBALL</small>
        <h1>Playball</h1>
      </header>

      <div className="start-doors">
        {latest && (
          <button
            className="start-continue tap"
            type="button"
            disabled={busy}
            onClick={resume}
          >
            <span>
              <small>CONTINUE</small>
              <strong>{latest.school}</strong>
              <em>{latest.year} · {latest.record} · {when(latest.savedAt)}</em>
            </span>
          </button>
        )}

        <button
          className="start-door tap"
          type="button"
          disabled={busy}
          onClick={() => { leaveStart(); onNew(); }}
        >
          <strong>New career</strong>
          <small>A new world, and a chair to take.</small>
        </button>

        {saves.length > 0 && (
          <button className="start-door tap" type="button" onClick={onLoad}>
            <strong>Load a career</strong>
            <small>
              {saves.length} on this device.
            </small>
          </button>
        )}

        <button className="start-door tap" type="button" onClick={onSettings}>
          <strong>Settings</strong>
          <small>Text size, sound, and how much you are asked.</small>
        </button>
      </div>
    </div>
  );
}
