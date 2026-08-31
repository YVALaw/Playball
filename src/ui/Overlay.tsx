// Overlay.tsx
// The shell every full-frame page in the game wears: a back arrow, an eyebrow,
// a title, and one scrolling body under them.
//
// The proposal's `.full-overlay`, and the reason it is worth having as a
// component rather than a class is the header. Before the port, a player card
// drew its own name inside its own scroller and the table overlays drew a bar
// with the word BACK on it — two different objects to the player, and the card's
// title scrolled away while the bar's did not. One shell, so the thing you
// opened is named in the same place whatever it was.
//
// It covers the frame rather than replacing it, which is what makes the screen
// underneath survive: a roster keeps its tab and its scroll position, and a step
// in the offseason is still the step you were on when the card closes.

import type { ReactNode } from 'react';
import { ArrowLeftIcon } from '@radix-ui/react-icons';

export function Overlay(
  { eyebrow, title, onClose, children, floating }:
  {
    eyebrow: string;
    title: string;
    onClose: () => void;
    children: ReactNode;
    /**
     * The action button, which sits outside the scroller so it cannot be
     * scrolled away from the thing it acts on.
     */
    floating?: ReactNode;
  },
) {
  return (
    <section className="full-overlay">
      <header>
        <button className="tap" type="button" aria-label="Back" onClick={onClose}>
          <ArrowLeftIcon />
        </button>
        <div>
          <small>{eyebrow}</small>
          <h1>{title}</h1>
        </div>
      </header>
      {/* The scroller. A div rather than a <main>, because what it wraps is
          already a screen with its own <main> in it. */}
      <div className="overlay-scroll screen-in">{children}</div>
      {floating}
    </section>
  );
}
