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
  { kicker, title, lines, tone = 'ink', action, onClose }:
  {
    kicker: string;
    title: string;
    lines: ReactNode[];
    /** 'win' for something good, 'clay' for the end of a run. */
    tone?: 'ink' | 'win' | 'clay';
    action: string;
    onClose: () => void;
  },
) {
  const accent = tone === 'win' ? 'var(--win)' : tone === 'clay' ? 'var(--clay)' : 'var(--cream)';
  return (
    <div
      onClick={onClose}
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
