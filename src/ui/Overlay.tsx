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

import {
  createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from './dialogFocus.js';
import { useScreenOwner } from './screenOwner.js';
import { Icon, cx } from './components/ui/index.js';

/**
 * The bar's way back, borrowed by the page inside it.
 *
 * A player's card goes one level deeper inside itself — his ratings, his
 * season, his career (the UI clarity review, 2026-09-25) — and from there the
 * way back is his card, not the screen under it: the bar names him and goes
 * to him. At the top of the card the bar keeps closing it, and can name what
 * it closes to ("Roster"). A page that borrows nothing gets the bar exactly
 * as it always was, so every other overlay is untouched.
 */
export interface OverlayBack {
  /** What the way back is called: the place it returns to. */
  label: string;
  /** Where it goes instead of closing the page. Left out, it still closes. */
  onBack?: () => void;
}

const BackContext = createContext<((back: OverlayBack | null) => void) | null>(null);

/**
 * Hand the bar a way back while this page is up; `null` hands it back. Set
 * before paint, so the bar never shows one level's name over another's page.
 */
export function useOverlayBack(back: OverlayBack | null): void {
  const lend = useContext(BackContext);
  const onBack = useRef(back?.onBack);
  onBack.current = back?.onBack;
  const label = back?.label;
  const goes = back?.onBack !== undefined;
  useLayoutEffect(() => {
    if (!lend || label === undefined) return undefined;
    lend({ label, onBack: goes ? () => onBack.current?.() : undefined });
    return () => lend(null);
  }, [lend, label, goes]);
}

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
  // A way back the page inside has borrowed (see `useOverlayBack`).
  const [inner, setInner] = useState<OverlayBack | null>(null);
  const back = inner?.onBack ?? onClose;
  // The dialog contract every sheet carries: focus held inside, Escape
  // closes, focus returns to what opened it. The store spent this layer's
  // history entry when it opened the overlay. Escape goes where the bar
  // goes: one level up inside a card, out of it from the top.
  const ref = useRef<HTMLElement | null>(null);
  useDialogFocus(ref, back, { layer: false });
  /*
    Opened from inside a sheet — a draft conversation's name or picture
    (2026-09-24) — the page goes over the sheet instead of under it, so the
    way back from it is the conversation, not the list behind it. Rendered at
    the end of the frame at the sheets' own level, so anything opened from the
    page after this still lands on top of it.
  */
  const [overSheet] = useState(() => typeof document !== 'undefined' && document.querySelector('.app-frame .pb-sheet-host') !== null);
  const host = overSheet && typeof document !== 'undefined' ? document.querySelector('.app-frame') : null;
  const owner = useScreenOwner();
  const page = (
    <section
      ref={ref}
      data-owner={host ? owner : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={eyebrow ? `${eyebrow}: ${title}` : title}
      className={cx('pb-fulloverlay', overSheet && 'is-over-sheet', className)}
    >
      <div className="pb-overlaybar">
        <button
          type="button"
          className="pb-back"
          onClick={back}
        >
          <Icon name="arrow-left" size={16} />{inner?.label ?? backLabel}
        </button>
        {floating && <span className="pb-overlaybar__trailing">{floating}</span>}
      </div>
      {/* The scroller. A div rather than a <main>: what it wraps is already a
          page with its own <main>. */}
      <BackContext.Provider value={setInner}>
        <div className="pb-fulloverlay__scroll">{children}</div>
      </BackContext.Provider>
    </section>
  );
  return host ? createPortal(page, host) : page;
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
  const owner = useScreenOwner();
  const host = document.querySelector('.app-frame');
  if (!host) return null;
  return createPortal(
    <div data-owner={owner} style={{ position: 'absolute', inset: 0, zIndex: 60 }}>{children}</div>,
    host,
  );
}
