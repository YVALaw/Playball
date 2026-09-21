// Overlay.tsx
// The shell every full-frame page in the game wears (a player's card, a
// school's page): a bar with the way back, and one scrolling body under it.
//
// The bar stays put while the page scrolls under it, and it looks the same
// whatever was opened, so the way back is always in the same place. The page
// names what it is in its own header; the bar does not repeat it.
//
// It covers the frame rather than replacing it, which is what makes the screen
// underneath survive: a roster keeps its tab and its scroll position, and a step
// in the offseason is still the step you were on when the card closes.

import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from './dialogFocus.js';
import { Icon, cx } from './components/ui/index.js';

export function Overlay(
  { eyebrow, title, onClose, children, floating, className, backLabel = 'Back' }:
  {
    /** What kind of page this is ("Player card"), for a screen reader. */
    eyebrow?: string;
    /** The name of what was opened. The page prints it once, in its own header. */
    title: string;
    onClose: () => void;
    children: ReactNode;
    /** A control for the bar's right end, such as god mode's bolt. */
    floating?: ReactNode;
    className?: string;
    /** The way back, named when it is known. */
    backLabel?: string;
  },
) {
  // The dialog contract every sheet carries: focus held inside, Escape
  // closes, focus returns to what opened it. The store spent this layer's
  // history entry when it opened the overlay.
  const ref = useRef<HTMLElement | null>(null);
  useDialogFocus(ref, onClose, { layer: false });
  return (
    <section
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={eyebrow ? `${eyebrow}: ${title}` : title}
      className={cx('pb-fulloverlay', className)}
    >
      <div className="pb-overlaybar">
        <button type="button" className="pb-back" data-guide="overlay-back" onClick={onClose}>
          <Icon name="arrow-left" size={16} />{backLabel}
        </button>
        {floating && <span className="pb-overlaybar__trailing">{floating}</span>}
      </div>
      {/* The scroller. A div rather than a <main>: what it wraps is already a
          page with its own <main>. */}
      <div className="pb-fulloverlay__scroll">{children}</div>
    </section>
  );
}

/**
 * A scrim rendered into the app frame rather than in place.
 *
 * Every sheet and dialog in the game used to mount inside whatever scroller
 * its screen happened to be — and an absolutely-positioned layer inside an iOS
 * momentum scroller is a bug factory: the tutorial card rendered below the
 * fold, the recruiting sheet went on swallowing taps after a long scroll, the
 * player-actions button trailed a stale white ghost. One door for all of them:
 * the frame is the phone, and anything that covers the screen covers the frame.
 *
 * z-index 60 on the portal wrapper, above every layer the app stacks — the
 * overlays at 25–30, tutorials at 38, dialogs at 40, the FABs at 45 — because
 * a sheet is only ever mounted while it is the thing being interacted with.
 */
export function InFrame({ children }: { children: ReactNode }) {
  const host = document.querySelector('.app-frame');
  if (!host) return null;
  return createPortal(
    <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>{children}</div>,
    host,
  );
}
