// useLongPress.ts
// Hold to open the card, with an optional visible press state.
//
// A hold must never feel like a dead touch. The screen can subscribe to the
// press state and draw a progress cue immediately, while the common tap remains
// instantaneous and the completed hold still consumes the click that follows.

import { useRef } from 'react';

/** Long enough not to fire on a slow tap, short enough not to feel stuck. */
export const HOLD_MS = 450;
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
  /**
   * Spread onto a row. `onPress` is true from touch-down until cancellation or
   * completion, which lets a screen show that the hold is actually charging.
   */
  hold: (onLong: () => void, onPress?: (active: boolean) => void) => HoldProps;
  /** The click immediately following a completed hold belongs to the hold. */
  consumed: () => boolean;
} {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const press = useRef<((active: boolean) => void) | null>(null);

  const clear = (): void => {
    if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; }
    from.current = null;
    press.current?.(false);
    press.current = null;
  };

  return {
    hold: (onLong, onPress) => ({
      onPointerDown: (e) => {
        // A previous pointer sequence may have been interrupted by the OS.
        clear();
        fired.current = false;
        from.current = { x: e.clientX, y: e.clientY };
        press.current = onPress ?? null;
        onPress?.(true);
        timer.current = setTimeout(() => {
          fired.current = true;
          timer.current = null;
          from.current = null;
          press.current?.(false);
          press.current = null;
          // A tiny native haptic where supported makes the threshold obvious
          // without becoming a sound effect or slowing the navigation.
          try { navigator.vibrate?.(10); } catch { /* presentation only */ }
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
      onContextMenu: (e) => { e.preventDefault(); },
    }),
    consumed: () => {
      const was = fired.current;
      fired.current = false;
      return was;
    },
  };
}
