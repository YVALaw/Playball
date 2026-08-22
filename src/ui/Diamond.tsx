// Diamond.tsx
// The field, in two dimensions.
//
// The roadmap builds 2D first and treats Three.js as an enhancement layer, and
// this is why: almost all of the life comes from movement, not from geometry. A
// runner who *slides* from first to third reads as baseball; two lamps blinking
// off and on does not, however nicely they are rendered.
//
// Outs are deliberately NOT drawn here. Inside the box they collide with home
// plate; beneath it they float outside the panel with nothing to anchor them.
// A scoreboard counts outs, and that is where they now live.
//
// Runners are keyed by player id, so React keeps the same DOM node as a man
// advances and a CSS transform transition carries him between bags. Nothing here
// invents information: every position comes from the runner list the engine
// already reports.

import { useEffect, useRef, useState } from 'react';
import type { PlayerId } from '../engine/types.js';

export interface Runner {
  id: PlayerId;
  name: string;
  base: 1 | 2 | 3;
}

interface Props {
  runners: readonly Runner[];
  /** Bumped when a run scores, to flash the plate. */
  scoreTick?: number;
  size?: number;
}

/** Where each bag sits, as a fraction of the box. Home at the bottom. */
const SPOT: Record<0 | 1 | 2 | 3, { x: number; y: number }> = {
  0: { x: 0.50, y: 0.90 },  // home
  1: { x: 0.90, y: 0.54 },
  2: { x: 0.50, y: 0.14 },
  3: { x: 0.10, y: 0.54 },
};

export function Diamond({ runners, scoreTick = 0, size = 96 }: Props) {
  const [flash, setFlash] = useState(false);
  const firstRender = useRef(true);

  // Flash the plate when a run crosses. Skipped on mount so opening a game does
  // not announce a run that happened before you arrived.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 620);
    return () => clearTimeout(t);
  }, [scoreTick]);

  const occupied = new Set(runners.map((r) => r.base));
  const px = (v: number): number => v * size;

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      {/* the base paths */}
      <svg
        width={size}
        height={size}
        style={{ position: 'absolute', inset: 0 }}
        aria-hidden
      >
        <polygon
          points={[
            `${px(SPOT[0].x)},${px(SPOT[0].y)}`,
            `${px(SPOT[1].x)},${px(SPOT[1].y)}`,
            `${px(SPOT[2].x)},${px(SPOT[2].y)}`,
            `${px(SPOT[3].x)},${px(SPOT[3].y)}`,
          ].join(' ')}
          fill="none"
          stroke="rgba(28,36,48,.18)"
          strokeWidth="1"
        />
      </svg>

      {/* the bags */}
      {([1, 2, 3] as const).map((b) => (
        <span
          key={b}
          style={{
            position: 'absolute',
            left: px(SPOT[b].x) - 6,
            top: px(SPOT[b].y) - 6,
            width: 12,
            height: 12,
            transform: 'rotate(45deg)',
            border: `1px solid ${occupied.has(b) ? 'var(--clay)' : 'rgba(28,36,48,.3)'}`,
            background: occupied.has(b) ? 'rgba(168,68,42,.18)' : 'transparent',
            transition: 'background 220ms ease, border-color 220ms ease',
          }}
        />
      ))}

      {/* home plate, which flashes when someone crosses it */}
      <span
        style={{
          position: 'absolute',
          left: px(SPOT[0].x) - 6,
          top: px(SPOT[0].y) - 6,
          width: 12,
          height: 12,
          transform: 'rotate(45deg)',
          border: `1px solid ${flash ? 'var(--clay)' : 'var(--ink)'}`,
          background: flash ? 'var(--clay)' : 'transparent',
          transition: 'background 300ms ease, border-color 300ms ease',
        }}
      />

      {/*
        The runners. Keyed by id and positioned with a transform, so when a man
        moves up a base React reuses his node and the browser animates the trip.
        This one detail is most of the difference between a live field and a
        static one.
      */}
      {runners.map((r) => (
        <span
          key={r.id}
          title={r.name}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 9,
            height: 9,
            marginLeft: -4.5,
            marginTop: -4.5,
            borderRadius: '50%',
            background: 'var(--clay)',
            boxShadow: '0 0 0 2px var(--paper)',
            transform: `translate(${px(SPOT[r.base].x)}px, ${px(SPOT[r.base].y)}px)`,
            transition: 'transform 420ms cubic-bezier(.4,.9,.3,1)',
          }}
        />
      ))}

    </div>
  );
}
