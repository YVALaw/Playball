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
import { useDialogFocus } from './dialogFocus.js';

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
        ref={card}
        className={`modal-card season-verdict rise-in tone-${tone}`}
        onClick={(e) => e.stopPropagation()}
      >
        <small>{kicker}</small>
        <strong>{title}</strong>
        {lines.map((l, i) => <p key={i}>{l}</p>)}
        {body}
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
