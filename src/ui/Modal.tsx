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

import type { ReactNode } from 'react';

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
  const accent = tone === 'win' ? 'var(--win)' : tone === 'clay' ? 'var(--clay)' : 'var(--cream)';
  return (
    <div
      onClick={cancel ? cancel.onClick : onClose}
      className="fade-in"
      style={{
        position: 'absolute', inset: 0, zIndex: 40,
        background: 'rgba(28,36,48,.62)',
        display: 'grid', placeItems: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rise-in"
        style={{
          width: '100%', maxWidth: 330,
          background: 'var(--ink)',
          border: `2px solid ${accent}`,
          boxShadow: '0 18px 50px rgba(0,0,0,.45)',
        }}
      >
        <div style={{ padding: '18px 18px 16px', textAlign: 'center' }}>
          <div style={{
            font: "600 8.5px var(--mono)", letterSpacing: '.2em',
            color: 'rgba(246,241,230,.6)',
          }}>{kicker}</div>
          <div style={{
            font: "800 30px/1 var(--display)", marginTop: 8,
            color: accent === 'var(--cream)' ? 'var(--cream)' : accent,
            textTransform: 'uppercase',
          }}>{title}</div>
          {lines.map((l, i) => (
            <div key={i} style={{
              marginTop: i === 0 ? 10 : 6,
              font: "400 12.5px/1.5 var(--body)", color: 'rgba(246,241,230,.72)',
            }}>{l}</div>
          ))}
        </div>
        {/* The way out sits above the action rather than beside it. Side by
            side, the two are the same size and a thumb aimed at one is a
            thumb that can land on the other; stacked, the destructive one is
            the one you have to reach past the safe one to get to. */}
        {cancel && (
          <button
            onClick={cancel.onClick}
            className="tap"
            style={{
              width: '100%', padding: '13px 0',
              background: 'transparent', borderTop: '1px solid rgba(246,241,230,.2)',
              color: 'rgba(246,241,230,.72)',
              font: "700 11px var(--mono)", letterSpacing: '.16em',
            }}
          >{cancel.label}</button>
        )}
        <button
          onClick={onClose}
          className="tap"
          style={{
            width: '100%', padding: '14px 0',
            background: accent === 'var(--cream)' ? 'var(--clay)' : accent,
            border: 'none', color: 'var(--cream)',
            font: "700 11px var(--mono)", letterSpacing: '.16em',
          }}
        >{action}</button>
      </div>
    </div>
  );
}
