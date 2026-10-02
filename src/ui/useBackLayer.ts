// useBackLayer.ts — a screen-held sheet tells the back gesture it is up.
//
// For the layers that are not dialogs -- the June lineup card, a stage being
// reviewed -- and so never pass through `useDialogFocus`, which registers the
// dialogs itself. Active in, released out; the gesture peels it by calling
// `dismiss`. See `state/backLayers.ts`.

import { useLayoutEffect, useRef } from 'react';
import { registerBackLayer, releaseBackLayer } from '../state/backLayers.js';

export function useBackLayer(active: boolean, dismiss: () => void): void {
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  // Before paint, for the reason in dialogFocus.ts: the entry must be spent
  // while the screen still looks the way the back swipe will return to.
  useLayoutEffect(() => {
    if (!active) return undefined;
    const id = registerBackLayer(() => dismissRef.current());
    return () => releaseBackLayer(id);
  }, [active]);
}
