// PlayerName.tsx
// A name you can tap, anywhere a name appears.
//
// Reported from testing: "everywhere where a player appears should be able to
// tap and see their information, globally in every page". Most lists already
// made the whole row a button, but the rows that were already buttons for
// something else — the batting order, which taps to swap — had nowhere to put a
// second target, and the in-game screen had none at all.
//
// A span rather than a button, because these live inside rows that are
// themselves buttons and nesting one button in another is invalid and behaves
// differently on every browser. The click is stopped here so the row's own
// action does not also fire.

import { useDynasty } from '../state/store.js';
import type { PlayerId } from '../engine/types.js';
import type { CSSProperties, ReactNode } from 'react';

export function PlayerName(
  { id, children, style }:
  { id: PlayerId; children: ReactNode; style?: CSSProperties },
) {
  const openPlayer = useDynasty((s) => s.openPlayer);
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); openPlayer(id); }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.stopPropagation();
        openPlayer(id);
      }}
      style={{
        cursor: 'pointer',
        // A dotted rule under the name is the whole affordance: it reads as a
        // link without turning every roster into a page of blue text.
        borderBottom: '1px dotted rgba(var(--ink-rgb), .35)',
        ...style,
      }}
    >{children}</span>
  );
}
