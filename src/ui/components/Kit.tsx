// Kit.tsx
// The handful of shapes every screen is built from. Kept small on purpose: the
// mockup's visual language is a rule, a card with a clay header, and a row of
// tiles, repeated. Anything more elaborate belongs on a screen, not in here.

import type { ReactNode } from 'react';

export function Rule() {
  return <div style={{ height: 1, background: 'var(--faint)', margin: '14px 0 0' }} />;
}

export function Tile({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '9px 8px',
      borderRight: last ? undefined : '1px solid var(--hairline)',
    }}>
      <div className="label">{k}</div>
      <div style={{ font: "700 calc(24px * var(--ts))/1 var(--display)", marginTop: 2 }}>{v}</div>
    </div>
  );
}

export function Card(
  { tag, note, children }: { tag: string; note?: string; children: ReactNode },
) {
  return (
    <div style={{
      marginTop: 12, border: '1px solid var(--faint)', background: 'var(--paper)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', background: 'var(--clay)',
      }}>
        <span style={{
          font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
        }}>{tag}</span>
        {note && <span style={{
          font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em',
          color: 'rgba(246,241,230,.75)',
        }}>{note}</span>}
      </div>
      {children}
    </div>
  );
}
