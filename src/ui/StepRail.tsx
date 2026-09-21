// StepRail.tsx
// The offseason route: always visible, always centred on where you are.
//
// The design system's phase rail, with the step names every button uses: done
// steps ticked, the current one filled, the rest waiting. A step already
// reached can be opened again; one not reached yet cannot. The rail scrolls
// sideways on a phone and brings the current step into view on its own.

import { useEffect, useRef, type CSSProperties } from 'react';
import { wantsMotion } from './celebrate.js';
import { PhaseRail } from './components/ui/index.js';

export interface Step {
  key: string;
  label: string;
}

export function StepRail(
  { steps, at, furthest, onGo, style, label = 'Offseason steps' }:
  {
    steps: readonly Step[];
    at: number;
    furthest: number;
    onGo?: (key: string) => void;
    style?: CSSProperties;
    /** What a screen reader calls the rail. */
    label?: string;
  },
) {
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const rail = box.current?.querySelector<HTMLElement>('.pb-phases ol');
    const el = rail?.querySelector<HTMLElement>('li.is-current');
    if (!rail || !el) return;
    // The app's own motion setting, not the OS query alone.
    const left = el.offsetLeft - (rail.clientWidth - el.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: wantsMotion() ? 'smooth' : 'auto' });
  }, [at]);

  return (
    <div ref={box} className="pb-steprail" style={style}>
      <PhaseRail
        label={label}
        steps={steps.map((s, i) => ({
          label: s.label,
          state: i < at ? 'done' : i === at ? 'current' : 'upcoming',
          onClick: i <= furthest && i !== at && onGo ? () => onGo(s.key) : undefined,
        }))}
      />
    </div>
  );
}
