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
  { header, children }: { header: ReactNode; children: ReactNode },
) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column', minHeight: 0,
    }}>
      <div style={{
        flex: 'none', background: 'var(--field)',
        borderBottom: '1px solid var(--faint)',
      }}>{header}</div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
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
    <div style={{
      position: 'sticky', bottom: 0, zIndex: 10,
      margin: '18px -14px 0', padding: '12px 14px',
      paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
      background: 'linear-gradient(to top, var(--field) 68%, rgba(242,236,224,0))',
    }}>
      {secondary && (
        <button
          onClick={once(secondary.onClick)}
          className="tap"
          style={{
            width: '100%', padding: '11px 10px', marginBottom: 8,
            background: 'transparent', border: '1px solid rgba(28,36,48,.4)',
            color: 'var(--ink)', font: "700 10px/1.25 var(--mono)", letterSpacing: '.1em',
            whiteSpace: 'normal', overflowWrap: 'break-word',
          }}
        >{secondary.label}</button>
      )}
      {note && (
        <div style={{
          marginBottom: 8, font: "400 11px/1.45 var(--body)", color: 'var(--dim)',
          textAlign: 'center',
        }}>{note}</div>
      )}
      <button
        onClick={once(onClick)}
        disabled={disabled}
        style={{
          width: '100%', padding: '15px 10px',
          background: 'var(--clay)', border: '1px solid var(--clay)',
          opacity: disabled ? 0.45 : 1,
          color: 'var(--cream)', font: "700 12px/1.25 var(--mono)", letterSpacing: '.1em',
          // Long labels wrap rather than running off the end of the button —
          // between words only. `anywhere` is for unbroken strings like a URL:
          // on a label it licenses a break in the middle of a word, which is
          // what a label with a space in it never needs and what a photograph
          // of a button split mid-word is evidence of.
          whiteSpace: 'normal', overflowWrap: 'break-word',
          boxShadow: '0 2px 10px rgba(28,36,48,.22)',
        }}
      >{label}</button>
    </div>
  );
}
