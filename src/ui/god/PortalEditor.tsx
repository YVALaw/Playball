// god/PortalEditor.tsx — everyone in the transfer portal, yours for nothing.
//
// Opened from the bolt on the transfer portal while the window is open.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { overallOf } from '../../engine/ratings.js';
import type { Hitter, Pitcher, Player } from '../../engine/types.js';
import { EmptyState, Face, List, PlayerRow } from '../components/ui/index.js';
import { CLASS_NAME, POSITION_NAME } from '../words.js';
import { GodPage, Toast } from './controls.js';

const slotOf = (p: Player): string =>
  p.type === 'pitcher' ? (p as Pitcher).role : (p as Hitter).pos;

export function PortalEditor() {
  const portal = useDynasty((s) => s.portal);
  const version = useDynasty((s) => s.version);
  const signPortal = useDynasty((s) => s.godSignPortal);
  const [note, setNote] = useState<string | null>(null);
  void version;
  if (!portal) {
    return (
      <main className="pb-page">
        <EmptyState icon="lock" title="The portal is closed" text="It opens in the offseason." />
      </main>
    );
  }

  return (
    <GodPage eyebrow="God mode · Transfer portal" title="Sign anyone" description="Tap a player to sign him, free">
      {portal.available.length === 0 ? (
        <EmptyState icon="person" title="Nobody is left in the portal" />
      ) : (
        <List label="In the portal">
          {portal.available.map((m) => {
            const code = slotOf(m.player);
            return (
              <PlayerRow
                key={m.player.id}
                name={m.player.name}
                avatar={<Face id={m.player.id} size={36} />}
                tags={[{ text: code, title: POSITION_NAME[code as keyof typeof POSITION_NAME] ?? code }, CLASS_NAME[m.player.classYear]]}
                meta={`From ${m.fromName}`}
                value={overallOf(m.player)}
                valueLabel="of 100"
                trailing={<span className="pb-link">Sign</span>}
                chevron={false}
                onClick={() => { if (signPortal(m.player.id)) setNote(`${m.player.name} signed from the portal.`); }}
              />
            );
          })}
        </List>
      )}
      <Toast note={note} />
    </GodPage>
  );
}
