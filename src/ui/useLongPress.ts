// useLongPress.ts
// Hold to open the card.
//
// Reported from the APK, and the reason the gesture changed: "I tap someone by
// mistake, when I tapped again to deselect him it instead went to the profile."
// The lineup read a second tap on the same man as "open his card", so
// deselecting and opening were the SAME gesture and the screen had to guess.
//
// Double-tap was the obvious replacement and is the wrong one: allowing it
// taxes every tap, because a tap can no longer act until the window for a
// second one has passed. Deselecting — the commonest thing on the screen —
// would feel late every time, to serve the rarer gesture. A hold has no such
// race: a tap acts the instant it lands, and a hold is unambiguous the moment
// it crosses the threshold.
//
// One controller serves a whole screen rather than one per row, because a
// thumb can only hold one thing at a time — and a hook cannot be called inside
// a `.map`.

import { useRef } from 'react';

/** Long enough not to fire on a slow tap, short enough not to feel stuck. */
const HOLD_MS = 450;
/** A thumb that travels this far is scrolling, not holding. */
const SLIP_PX = 10;

interface Pointerish { clientX: number; clientY: number }

export interface HoldProps {
  onPointerDown: (e: Pointerish) => void;
  onPointerMove: (e: Pointerish) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onContextMenu: (e: { preventDefault: () => void }) => void;
}

export function useHold(): {
  /** Spread onto a row; the callback runs when the hold completes. */
  hold: (onLong: () => void) => HoldProps;
  /**
   * True for exactly the click that follows a completed hold. The row's own
   * onClick asks first and stands down, so a hold opens the card without
   * also selecting the man behind it.
   */
  consumed: () => boolean;
} {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = (): void => {
    if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; }
    from.current = null;
  };

  return {
    hold: (onLong) => ({
      onPointerDown: (e) => {
        fired.current = false;
        from.current = { x: e.clientX, y: e.clientY };
        clear();
        from.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          fired.current = true;
          timer.current = null;
          onLong();
        }, HOLD_MS);
      },
      onPointerMove: (e) => {
        const start = from.current;
        if (!start || timer.current === null) return;
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLIP_PX) clear();
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onPointerLeave: clear,
      // A hold on a touch screen raises the browser's own menu otherwise,
      // right over the card the hold just opened.
      onContextMenu: (e) => { e.preventDefault(); },
    }),
    consumed: () => {
      const was = fired.current;
      fired.current = false;
      return was;
    },
  };
}
