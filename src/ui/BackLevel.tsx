// BackLevel.tsx — one level the back gesture walks, with nothing to draw.
//
// For a screen whose steps live in its own state (the New career wizard,
// 2026-09-30): one of these per step behind the current one, so back goes to
// the step before instead of leaving. Rendered in order, oldest first, so the
// registry peels the newest. See `useBackLayer`.

import { useBackLayer } from './useBackLayer.js';

export function BackLevel({ onBack }: { onBack: () => void }): null {
  useBackLayer(true, onBack);
  return null;
}
