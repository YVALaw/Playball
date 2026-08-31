// StepRail.tsx
// Where you are in a sequence, and where you have been.
//
// Seven steps run between the last out of the season and the first pitch of the
// next one, and until this existed the only thing on screen saying so was
// "STEP 3 OF 7". A number tells you there is a sequence; it does not tell you
// what is in it, what you just did, or what is coming.
//
// Back only, deliberately. From recruiting you can go and re-read the awards,
// because that is a thing a coach would actually want; you cannot jump to
// signing day from the awards, because the class does not exist yet. A step you
// have not reached is drawn as a step, not as a button — reported from testing:
// "keep them but do not make them clickable until we get there."
//
// Bars became circles in the Roster Tabletop port, and the circles carry their
// own numbers. The bar said only how far along the row a step sat, which is the
// one thing a row of seven labels already says; a numbered node says which step
// this is, and a filled one says you have been through it. The connecting line
// runs behind them so the rail reads as a route rather than as seven buttons
// that happen to be adjacent.

import type { CSSProperties } from 'react';
import { CheckIcon } from '@radix-ui/react-icons';

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
      flex: 'none', display: 'grid',
      gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
      padding: '11px 6px 10px',
      background: 'var(--sunk)', borderBottom: '1px solid var(--line)',
      ...style,
    }}>
      {steps.map((s, i) => {
        const done = i < at;
        const here = i === at;
        const reached = i <= furthest;
        const open = reached && !here && !!onGo;
        return (
          <button
            key={s.key}
            onClick={open ? () => onGo(s.key) : undefined}
            disabled={!open}
            aria-current={here ? 'step' : undefined}
            style={{
              position: 'relative',
              display: 'grid', placeItems: 'center', alignContent: 'center', gap: 5,
              padding: 0, background: 'transparent',
              cursor: open ? 'pointer' : 'default',
              color: here || done ? 'var(--clay)' : 'rgba(var(--ink-rgb), .42)',
            }}
          >
            {/* The route between the nodes, drawn from each step to the next.
                Behind the circles rather than between them, so it does not have
                to know how wide a column turned out to be. */}
            {i < steps.length - 1 && (
              <span style={{
                position: 'absolute', top: 10, left: '50%', right: '-50%',
                height: 1, background: done ? 'var(--clay)' : 'var(--line)',
                transition: 'background 220ms ease',
              }} />
            )}
            <span style={{
              position: 'relative',
              width: 21, height: 21, display: 'grid', placeItems: 'center',
              borderRadius: '50%',
              border: `1px solid ${here || done ? 'var(--clay)' : 'var(--line)'}`,
              background: here || done ? 'var(--clay)' : 'var(--paper)',
              color: here || done ? 'var(--paper)' : 'rgba(var(--ink-rgb), .42)',
              font: "700 calc(9px * var(--ts))/1 var(--body)",
              transition: 'background 220ms ease, border-color 220ms ease',
            }}>
              {done ? <CheckIcon width={11} height={11} /> : i + 1}
            </span>
            <span style={{
              font: "700 calc(8px * var(--ts))/1.2 var(--body)", letterSpacing: '.04em',
              textAlign: 'center',
              transition: 'color 220ms ease',
            }}>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
