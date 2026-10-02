// ConferenceBanner.tsx
// Each league's own wordmark, cut from the top of its logo sheet.
//
// One webp per conference id in ./conferences. The wordmark spells the name
// the league was born with, so a league renamed in a sandbox gets no banner:
// a banner must never say something the game no longer calls it. Callers that
// need the name either way ask `hasBanner` and print it in type otherwise.

import { leagueName, leagueNames } from '../engine/leagueNames.js';

/* The same glob-through-a-cast as Crest.tsx. */
type UrlGlob = (pattern: string, options: { eager: true; query: '?url'; import: 'default' }) => Record<string, string>;
const BANNERS = (import.meta as unknown as { glob: UrlGlob }).glob('./conferences/*.webp', {
  eager: true, query: '?url', import: 'default',
});

function bannerOf(id: string): string | undefined {
  return leagueNames()[id] ? undefined : BANNERS[`./conferences/${id}.webp`];
}

/** Whether this league has a wordmark that still says its name. */
export const hasBanner = (id: string): boolean => bannerOf(id) !== undefined;

/**
 * The wordmark, in a box as wide as it is given and this tall; it keeps its
 * own proportions inside. Carries the league's name for screen readers, so it
 * can stand in for a heading.
 */
export function ConferenceBanner(
  { id, height = 56, align = 'left', className }:
  { id: string; height?: number; align?: 'left' | 'center'; className?: string },
) {
  const src = bannerOf(id);
  if (!src) return null;
  const cls = ['pb-banner', align === 'center' && 'pb-banner--center', className].filter(Boolean).join(' ');
  return (
    <img
      className={cls} src={src} alt={leagueName(id)} draggable={false} decoding="async"
      style={{ height, objectPosition: align === 'center' ? 'center' : 'left center' }}
    />
  );
}
