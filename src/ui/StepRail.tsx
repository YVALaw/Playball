// StepRail.tsx
// Where you are in a sequence, and where you have been.
//
// Six steps run between the last out of the season and the first pitch of the
// next one, and until now the only thing on screen saying so was "STEP 3 OF 6".
// A number tells you there is a sequence; it does not tell you what is in it,
// what you just did, or what is coming.
//
// Back only, deliberately. From recruiting you can go and re-read the awards,
// because that is a thing a coach would actually want; you cannot jump to
// signing day from the awards, because the class does not exist yet. A step you
// have not reached is drawn as a step, not as a button — reported from testing:
// "keep them but do not make them clickable until we get there."

import type { CSSProperties } from 'react';

export interface Step {
  key: string;
  label: string;
}

export function StepRail(
  { steps, at, furthest, onGo, style }:
  {
    steps: readonly Step[];
    /** Index of the step being shown. */
    at: number;
    /** Index of the furthest step reached. Anything past it is not tappable. */
    furthest: number;
    onGo?: (key: string) => void;
    style?: CSSProperties;
  },
) {
  return (
    <div style={{
      flex: 'none', display: 'flex', gap: 2,
      padding: '8px 10px 9px',
      background: '#e7dfd0', borderBottom: '1px solid rgba(28,36,48,.16)',
      ...style,
    }}>
      {steps.map((s, i) => {
        const done = i < at;
        const here = i === at;
        const open = i <= furthest && !here && !!onGo;
        return (
          <button
            key={s.key}
            onClick={open ? () => onGo(s.key) : undefined}
            disabled={!open}
            style={{
              flex: 1, textAlign: 'left', background: 'transparent', padding: '0 2px',
              cursor: open ? 'pointer' : 'default',
            }}
          >
            <div style={{
              height: 4, borderRadius: 2,
              background: done ? 'rgba(168,68,42,.45)'
                : here ? 'var(--clay)' : 'rgba(28,36,48,.16)',
              transition: 'background 220ms ease',
            }} />
            <div style={{
              marginTop: 5,
              font: "600 8px/1.3 var(--mono)", letterSpacing: '.06em',
              textAlign: 'center',
              color: here ? 'var(--clay)'
                : i <= furthest ? 'rgba(28,36,48,.62)' : 'rgba(28,36,48,.34)',
              transition: 'color 220ms ease',
            }}>{s.label}</div>
          </button>
        );
      })}
    </div>
  );
}
