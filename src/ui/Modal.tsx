// Modal.tsx
// The one moment a screen should stop and say something.
//
// Used sparingly and only for the two events in a postseason that a page of
// brackets cannot say loudly enough: you are in, and you are out. Both are
// facts the player would otherwise have to infer from a table changing colour
// — reported from testing: "when the user loses I would like some type of
// visual, a modal that tells them they are disqualified and how far they got."
//
// Dismissable by tapping anywhere, because a modal you have to aim at is a
// modal that has outstayed its welcome.

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from './dialogFocus.js';
import { Icon, cx } from './components/ui/index.js';

/**
 * A label a caller wrote in capitals, in sentence case: "LET'S GO" reads
 * "Let's go". Anything already in mixed case is left as written.
 */
function words(text: string): string {
  if (!/[A-Z]/.test(text) || text !== text.toUpperCase()) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function Modal(
  { kicker, title, lines, body, tone = 'ink', action, onClose, cancel, nudge }:
  {
    kicker: string;
    title: string;
    lines: ReactNode[];
    /** Rich context that belongs between the announcement copy and controls. */
    body?: ReactNode;
    /** 'win' for something good, 'clay' for the end of a run. */
    tone?: 'ink' | 'win' | 'clay';
    action: string;
    onClose: () => void;
    /**
     * The way out, for the one case where the button is not merely an
     * acknowledgement.
     *
     * Announcing something and asking something look the same and are not: a
     * modal you dismiss by tapping anywhere is right for "you are out of the
     * tournament" and catastrophic for "delete this dynasty", because the scrim
     * is most of the screen and a stray tap on it would be the answer. So while
     * a `cancel` is offered, tapping outside means cancel — never the action —
     * and the action is only ever the button itself.
     */
    cancel?: { label: string; onClick: () => void };
    /**
     * A counter of back presses this card has refused.
     *
     * Passed in rather than read from the store, because this file is the one
     * dialog every screen shares and it has never imported the store. Only the
     * three cards that actually block the gesture pass it; for everything else
     * it is undefined and the effect below never runs.
     */
    nudge?: number;
  },
) {

  /*
    A dialog a keyboard can leave and a screen reader can name. The app is
    built for thumbs, but it runs in a browser today and every dialog was a
    div: no Escape, no role, focus left sitting behind the scrim on whatever
    opened it. Escape follows the scrim's rule — cancel when one exists, never
    the action for a destructive ask. Focus lands on the safest control on
    open and goes home when the dialog closes. The contract lives in
    useDialogFocus now, and every sheet carries it.
  */
  const dismiss = cancel ? cancel.onClick : onClose;
  const firstButton = useRef<HTMLButtonElement | null>(null);
  const card = useRef<HTMLElement | null>(null);
  // A blocking card (one that carries `nudge`) swallows the press itself and
  // holds no entry; every other modal is a layer the gesture peels.
  useDialogFocus(card, dismiss, { initial: firstButton, layer: nudge === undefined });

  /*
    The refused back press, made visible.

    Driven off the DOM rather than off a class in the render, because the whole
    point is that the SECOND press has to shake as well as the first and React
    will not re-run an animation for a class that never changed. Remove, force
    a reflow by reading `offsetWidth`, add: the standard restart, and the only
    one that works without remounting the card and taking focus with it.

    `nudge` starts at whatever the counter already was when the card mounted,
    so the effect's first run is skipped — a card that opens after some earlier
    card refused a press must not open mid-shake.
  */
  const nudgedAt = useRef(nudge);
  useEffect(() => {
    if (nudge === undefined || nudge === nudgedAt.current) return;
    nudgedAt.current = nudge;
    const el = card.current;
    if (!el) return;
    el.classList.remove('is-nudged');
    void el.offsetWidth;
    el.classList.add('is-nudged');
  }, [nudge]);

  const titleId = useId();
  const host = typeof document === 'undefined' ? null : document.querySelector('.app-frame');
  const dialog = (
    <div className="pb-dialog-host" onClick={dismiss}>
      <section
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx('pb-dialog', `pb-dialog--${tone}`)}
        onClick={(e) => e.stopPropagation()}
      >
        {tone !== 'ink' && (
          <span className="pb-dialog__icon" aria-hidden>
            <Icon name={tone === 'win' ? 'check-circled' : 'info'} size={28} />
          </span>
        )}
        <span className="pb-eyebrow">{words(kicker)}</span>
        <h2 id={titleId} className="pb-dialog__title">{words(title)}</h2>
        {lines.map((l, i) => <p key={i} className="pb-dialog__text">{l}</p>)}
        {body}
        {/* The safe way out sits above the action rather than beside it: side
            by side, a thumb aimed at one can land on the other. Focus starts
            on it, so Enter on a fresh dialog cancels and never destroys. */}
        <footer className="pb-dialog__foot">
          {cancel && (
            <button
              className="pb-btn pb-btn--secondary pb-btn--md pb-btn--block"
              ref={firstButton}
              type="button"
              onClick={cancel.onClick}
            ><span className="pb-btn__label">{words(cancel.label)}</span></button>
          )}
          <button
            className="pb-btn pb-btn--primary pb-btn--md pb-btn--block"
            ref={cancel ? undefined : firstButton}
            type="button"
            onClick={onClose}
          ><span className="pb-btn__label">{words(action)}</span></button>
        </footer>
      </section>
    </div>
  );
  // Into the frame, like every sheet, so it covers the phone rather than
  // whatever scroller the caller happens to sit in.
  return host ? createPortal(dialog, host) : dialog;
}
