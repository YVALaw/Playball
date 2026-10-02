// BadgeEmblem.tsx
// A player badge as its own emblem, framed in the metal of its tier.
//
// The art is the hexagon from each chip on the badge sheet, one webp per badge
// id in ./badges, all cut to one 96 by 110 box. The name plate the sheet drew
// beside it stays behind on purpose: at list size its lettering is a few
// pixels tall, so the row prints the name in type instead.
//
// One emblem serves bronze, silver and gold, so the tier is drawn here: a
// hexagon ring just outside the art, lit at the top and shaded at the foot so
// it reads as metal on either theme. A badge with no file falls back to the
// plain medal.

import { useId } from 'react';
import type { BadgeId, BadgeTier } from '../engine/badges.js';
import { Medal } from './components/ui/index.js';

/* The same glob-through-a-cast as Crest.tsx. */
type UrlGlob = (pattern: string, options: { eager: true; query: '?url'; import: 'default' }) => Record<string, string>;
const EMBLEMS = (import.meta as unknown as { glob: UrlGlob }).glob('./badges/*.webp', {
  eager: true, query: '?url', import: 'default',
});

const METAL = { 1: 'bronze', 2: 'silver', 3: 'gold' } as const;

/** Lit edge, then shadow. */
const SHINE: Record<(typeof METAL)[BadgeTier], readonly [string, string]> = {
  gold: ['#f6d97a', '#a87a14'],
  silver: ['#f1f4f7', '#7f8b97'],
  bronze: ['#ebb07c', '#8a5226'],
};

export function BadgeEmblem({ id, tier, size = 36 }: { id: BadgeId; tier: BadgeTier; size?: number }) {
  // An id per ring, so two emblems on one screen never share a gradient.
  const shine = `pb-shine-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const metal = METAL[tier];
  const src = EMBLEMS[`./badges/${id}.webp`];
  if (!src) return <Medal metal={metal} size={size} />;
  const [lit, shade] = SHINE[metal];
  return (
    <span className={`pb-emblem pb-emblem--${metal}`} style={{ width: size, height: size * (110 / 96) }} aria-hidden>
      <img src={src} alt="" draggable={false} decoding="async" />
      <svg viewBox="0 0 96 110" preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={lit} />
            <stop offset="1" stopColor={shade} />
          </linearGradient>
        </defs>
        <polygon points="48,0 96,25.7 96,84.3 48,110 0,84.3 0,25.7" stroke={`url(#${shine})`} />
      </svg>
    </span>
  );
}
