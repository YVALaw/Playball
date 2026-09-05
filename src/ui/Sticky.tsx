// Sticky.tsx
// The two things that should never scroll away.
//
// A phone screen is short and these lists are long. Reported from testing: the
// back control disappears the moment you scroll, so getting out of a screen
// means scrolling all the way up first — and on the offseason screens the
// button that advances the game sits below however much content that step
// happens to have.
//
// Both are solved the same way: keep the control pinned to the frame rather
// than letting it ride the content. A control you have to go looking for is a
// control the player has to think about, and neither of these deserves a thought.
//
// The proposal has no equivalent, because a prototype's screens are all short
// enough to end on the screen they started on. What it does have is
// `.primary-command` and `.secondary-command`, which is what the button below
// wears now.

import { useRef, type ReactNode } from 'react';

/**
 * A screen with a header that stays put while the body scrolls.
 *
 * The alternative — one long scrolling page — puts the title, the filter and the
 * tabs off screen the moment you start reading, which is exactly when you want
 * them. Anything a screen is *controlled* by belongs in `header`; anything it is
 * *made of* belongs in the body.
 */
export function FixedHeader(
  { header, children, action }:
  { header?: ReactNode; children: ReactNode; action?: ReactNode },
) {
  return (
    <div className="fixed-header-screen">
      {header !== undefined && header !== null && <div className="fixed-header-bar">{header}</div>}
      <div className="screen-scroll fixed-header-body">{children}</div>
      {/*
        The action, outside the scroller.

        Reported: on an offseason step with less content the button rides up
        and sits under the text rather than at the bottom, so the one control
        that is meant to be in the same place every single time is not.

        It was `position: sticky; bottom: 0` inside the scrolling body, and
        that can only ever be half a solution — sticky pins an element while
        its containing block reaches the edge being stuck to, and on a short
        step the body stops halfway down the screen and takes the button with
        it. A row of the frame cannot move, whatever any step's content does.
      */}
      {action !== undefined && <div className="fixed-header-action">{action}</div>}
    </div>
  );
}

/**
 * The button that moves the game forward, pinned to the bottom of the frame.
 *
 * Every step of the offseason ends in one decision, and it should be reachable
 * without reading to the end of a list first. Floating it also means the amount
 * of content on a step stops deciding how far away its button is — three signings
 * and thirty signings put CONTINUE in the same place.
 */
export function FloatingAction(
  { label, onClick, note, secondary, disabled }:
  {
    label: string;
    onClick: () => void;
    note?: string;
    /**
     * The other thing you might do here, sitting above the primary.
     *
     * Two actions on one screen belong in the same place, stacked, rather than
     * one on the button bar and one buried in whatever card happens to be about
     * the decision — that arrangement made "simulate it instead" a control you
     * had to go find.
     */
    secondary?: { label: string; onClick: () => void } | null;
    disabled?: boolean;
  },
) {
  /*
    One press means one press. Every load-bearing button in the game rides this
    component — END WEEK, CONTINUE, the postseason advance — and a fast
    double-tap used to deliver both clicks: two recruiting weeks burned, an
    offseason step skipped, a postseason stage walked past unseen. The store
    guards the corrupting cases, but the pacing ones (two *legitimate*
    advances a heartbeat apart) can only be caught at the button, because by
    the second tap the screen has re-rendered and the action really would be
    valid. Long enough to outlast a double-tap, short enough that deliberate
    play never meets it.
  */
  const lastTap = useRef(0);
  const once = (fn: () => void) => (): void => {
    const now = Date.now();
    if (now - lastTap.current < 600) return;
    lastTap.current = now;
    fn();
  };
  return (
    /*
      A row of the frame, not a sticky element inside the scroller. See
      `FixedHeader` for the whole argument; the short version is that sticky
      cannot hold a position the content is allowed to end above.

      The gradient stays: rendered as the last row of the frame it sits over
      nothing, but the postseason screen still places one of these directly
      over its bracket, and a hard edge there reads as a seam.
    */
    <div className="command-bar">
      {secondary && (
        <button className="secondary-command tap" type="button" onClick={once(secondary.onClick)}>
          {secondary.label}
        </button>
      )}
      {note && <p className="command-note">{note}</p>}
      <button
        className="primary-command tap"
        type="button"
        onClick={once(onClick)}
        disabled={disabled}
      >{label}</button>
    </div>
  );
}
