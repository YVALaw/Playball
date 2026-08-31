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

import { useEffect, useRef, type ReactNode } from 'react';

export function Modal(
  { kicker, title, lines, tone = 'ink', action, onClose, cancel }:
  {
    kicker: string;
    title: string;
    lines: ReactNode[];
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
  },
) {

  /*
    A dialog a keyboard can leave and a screen reader can name. The app is
    built for thumbs, but it runs in a browser today and every dialog was a
    div: no Escape, no role, focus left sitting behind the scrim on whatever
    opened it. Escape follows the scrim's rule — cancel when one exists, never
    the action for a destructive ask. Focus lands on the safest control on
    open and goes home when the dialog closes.
  */
  const dismiss = cancel ? cancel.onClick : onClose;
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  const firstButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstButton.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.stopPropagation(); dismissRef.current(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  return (
    <div
      className="modal-scrim fade-in"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={`${kicker} ${title}`}
    >
      {/*
        The proposal's season verdict, doing a second job. It is the one dark
        panel in the whole stylesheet built to carry an announcement — a green
        kicker, a huge condensed line, a paragraph under it — which is exactly
        what this dialog is for. The tone rides on the title's colour: gold for
        a trophy, red for a season that is over, and cream for the middle case
        that is neither.
      */}
      <section
        className={`modal-card season-verdict rise-in tone-${tone}`}
        onClick={(e) => e.stopPropagation()}
      >
        <small>{kicker}</small>
        <strong>{title}</strong>
        {lines.map((l, i) => <p key={i}>{l}</p>)}
        {/* The way out sits above the action rather than beside it. Side by
            side, the two are the same size and a thumb aimed at one is a thumb
            that can land on the other; stacked, the destructive one is the one
            you have to reach past the safe one to get to. It is also where
            focus starts, so Enter on a fresh dialog acknowledges or cancels —
            it never destroys. */}
        <footer>
          {cancel && (
            <button
              className="modal-cancel tap"
              ref={firstButton}
              type="button"
              onClick={cancel.onClick}
            >{cancel.label}</button>
          )}
          <button
            className="modal-action tap"
            ref={cancel ? undefined : firstButton}
            type="button"
            onClick={onClose}
          >{action}</button>
        </footer>
      </section>
    </div>
  );
}
