// StepRail.tsx
// The offseason route: always visible, always centred on where you are.
//
// The old version had a second header saying OFFSEASON ROADMAP / STEP X OF 7
// above the tabs. It repeated what the tabs already said and took the most
// valuable vertical space on a phone. The route is the navigation now: a compact
// horizontal rail that automatically moves the current stage into view.

import { useEffect, useRef, type CSSProperties } from 'react';
import { CheckIcon } from '@radix-ui/react-icons';
import { wantsMotion } from './celebrate.js';

export interface Step {
  key: string;
  label: string;
}

export function StepRail(
  { steps, at, furthest, onGo, style }:
  {
    steps: readonly Step[];
    at: number;
    furthest: number;
    onGo?: (key: string) => void;
    style?: CSSProperties;
  },
) {
  const track = useRef<HTMLDivElement | null>(null);
  const current = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const el = current.current;
    const rail = track.current;
    if (!el || !rail) return;
    // The app's own gate, not the OS media query alone: "reduced" chosen in
    // Settings on a system with no preference set must stop this too.
    const left = el.offsetLeft - (rail.clientWidth - el.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: wantsMotion() ? 'smooth' : 'auto' });
  }, [at]);

  return (
    <nav className="season-flow-rail season-flow-rail-compact" style={style} aria-label="Offseason stages">
      <div className="season-flow-track" ref={track}>
        {steps.map((s, i) => {
          const done = i < at;
          const here = i === at;
          const reached = i <= furthest;
          const open = reached && !here && !!onGo;
          return (
            <button
              ref={here ? current : undefined}
              key={s.key}
              className={`${done ? 'done' : ''}${here ? ' here' : ''}${!reached ? ' locked' : ''}`.trim()}
              onClick={open ? () => onGo(s.key) : undefined}
              disabled={!open}
              aria-current={here ? 'step' : undefined}
              type="button"
            >
              <i>{done ? <CheckIcon /> : i + 1}</i>
              <span>
                <strong>{s.label}</strong>
                <small>{here ? 'NOW' : done ? 'DONE' : reached ? 'REVISIT' : 'LOCKED'}</small>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
