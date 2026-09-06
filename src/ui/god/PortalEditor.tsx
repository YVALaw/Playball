// god/PortalEditor.tsx — every man in the portal, yours for nothing.
//
// Opened from the bolt on the transfer room while the window is open.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { overallOf } from '../../engine/ratings.js';
import type { Hitter, Pitcher, Player } from '../../engine/types.js';
import { Toast } from './controls.js';

const slotOf = (p: Player): string =>
  p.type === 'pitcher' ? (p as Pitcher).role : (p as Hitter).pos;

export function PortalEditor() {
  const portal = useDynasty((s) => s.portal);
  const version = useDynasty((s) => s.version);
  const signPortal = useDynasty((s) => s.godSignPortal);
  const [note, setNote] = useState<string | null>(null);
  void version;
  if (!portal) return <p className="god-note">The portal is closed. It opens in the offseason.</p>;

  return (
    <main className="module-workspace god-desk">
      <section className="god-card">
        {portal.available.length === 0 ? (
          <p className="god-note">Nobody is left in the portal.</p>
        ) : (
          <div className="god-roster">
            {portal.available.map((m) => (
              <button
                key={m.player.id}
                type="button"
                className="tap"
                onClick={() => { if (signPortal(m.player.id)) setNote(`${m.player.name} signed from the portal.`); }}
              >
                <strong>{m.player.name}</strong>
                <small>{slotOf(m.player)} · {m.player.classYear} · {overallOf(m.player)} OVR · from {m.fromName}</small>
              </button>
            ))}
          </div>
        )}
        <p className="god-note">Tap a man and he is yours, at no cost to the offseason budget.</p>
      </section>
      <Toast note={note} />
    </main>
  );
}
