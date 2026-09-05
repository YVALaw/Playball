// Crest.tsx
// Ninety six schools, ninety six shields, zero image files.
//
// The letter-squares said "a school" the way a spreadsheet does. A collegiate
// shield says it the way a letterman jacket does — and drawn procedurally from
// the abbreviation and the school's own colour, every save agrees on every
// crest forever and the app ships not one asset.
//
// Stage 25 made the generator worth looking at rather than replacing it — the
// reporter's call, verbatim: "they are generated, don't worry about them being
// similar." So the variety grew where variety reads (a second colour, six
// field divisions, baseball devices instead of abstract ones) and the whole
// thing became SIZE-AWARE, which was the other half of the ask: a 26px crest
// in a nav row now drops the fine detail a 64px one carries, instead of
// smearing it.
//
// The variety is hashed, never drawn: the same string hash the economy and the
// world run on picks everything, so two neighbouring rows get visibly
// different shields and a reload cannot restyle anybody. The letters stay the
// centrepiece — after a season of standings they are what a reader actually
// recognises.

import { teamColour } from './Avatar.js';

/** The house hash. Stable across sessions, platforms and years. */
function hash(s: string): number {
  let h = 7919;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Darken toward ink without leaving the school's hue. Shared with the takeover card. */
export function shade(hex: string, f: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const ch = (v: number): string =>
    Math.round(v * f).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/*
  Shield silhouettes, drawn once in a 64x72 box. Four is enough: with the
  divisions and devices multiplied in there are hundreds of distinct crests,
  and more outlines than four stop reading as one league's heraldry.
*/
const SHAPES = [
  // Gothic — straight shoulders, drawn to a point.
  'M4 6 H60 V38 C60 56 46 66 32 70 C18 66 4 56 4 38 Z',
  // Rounded base, the varsity patch.
  'M4 6 H60 V44 C60 60 48 68 32 70 C16 68 4 60 4 44 Z',
  // Swiss — flared shoulders before the taper.
  'M4 6 C13 10 51 10 60 6 V40 C60 57 47 66 32 70 C17 66 4 57 4 40 Z',
  // Chamfered chief, squared hips.
  'M8 6 H56 L60 12 V42 C60 58 46 66 32 70 C18 66 4 58 4 42 Z',
] as const;

/*
  The metal — heraldry's word for the second colour. One league, three
  metals: old gold, athletic cream, and silver, hashed per school so a
  conference table is not a wall of white trim. Fixed rather than derived
  from the field colour, because ninety six derived accents drift apart and
  stop looking like one country's college baseball.
*/
const METALS = ['#d9b64e', '#f2ead8', '#c9cdd2'] as const;

export function Crest({ abbr, size = 34 }: { abbr: string; size?: number }) {
  const colour = teamColour(abbr);
  const dark = shade(colour, 0.62);
  const h = hash(abbr);
  const shape = SHAPES[h % SHAPES.length]!;
  const metal = METALS[hash(`${abbr}:m`) % METALS.length]!;
  const division = hash(`${abbr}:d`) % 6;
  const device = hash(`${abbr}:v`) % 5;
  const letters = abbr.slice(0, 4);
  const fontSize = letters.length <= 2 ? 21 : letters.length === 3 ? 16.5 : 12.5;

  /*
    What the size can carry. Below 40px a device is a smudge and an inner
    stroke is fuzz, so the small crest keeps the silhouette, the field, the
    division and the letters — the four things that survive 26 pixels — and
    thickens its outline so the shape still reads as an object.
  */
  const fine = size >= 40;

  // Where the monogram sits, per division, so it never fights the geometry.
  const textY = division === 0 ? 46 : division === 4 ? 40 : 42;

  return (
    <svg
      viewBox="0 0 64 76" width={size} height={size * (76 / 64)}
      aria-hidden="true" focusable="false" style={{ display: 'block' }}
    >
      <defs>
        <clipPath id={`crest-${abbr}`}><path d={shape} /></clipPath>
      </defs>

      {/* The field, in the school's colour. */}
      <path d={shape} fill={colour} />

      <g clipPath={`url(#crest-${abbr})`}>
        {/* A chief band across the top, in the metal. */}
        {division === 0 && (
          <>
            <rect x="0" y="0" width="64" height="20" fill={dark} />
            <rect x="0" y="18" width="64" height="2" fill={metal} opacity="0.8" />
          </>
        )}
        {/* A bend, corner to corner. */}
        {division === 1 && (
          <>
            <path d="M-8 82 L46 -6 L64 -6 L10 82 Z" fill={dark} opacity="0.55" />
            <path d="M6 82 L60 -6 L64 -6 L10 82 Z" fill={metal} opacity="0.5" />
          </>
        )}
        {/* A bordure — the inner line, in the metal now. */}
        {division === 2 && fine && (
          <path
            d="M8.5 10.5 H55.5 V38 C55.5 52 44 61.5 32 65 C20 61.5 8.5 52 8.5 38 Z"
            fill="none" stroke={metal} strokeWidth="1.8" opacity="0.75"
          />
        )}
        {/* Per pale: the left half dark, a metal seam down the middle. */}
        {division === 3 && (
          <>
            <rect x="0" y="0" width="32" height="76" fill={dark} opacity="0.6" />
            <rect x="31" y="0" width="2" height="76" fill={metal} opacity="0.55" />
          </>
        )}
        {/* A chevron, point up, worn low so the letters keep the middle. */}
        {division === 4 && (
          <path
            d="M2 62 L32 44 L62 62 L62 70 L32 52 L2 70 Z"
            fill={metal} opacity="0.65"
          />
        )}
        {/* Rays from the base — the sunrise patch. */}
        {division === 5 && (
          <g fill={dark} opacity="0.5">
            <path d="M32 70 L12 26 L20 26 Z" />
            <path d="M32 70 L28 22 L36 22 Z" />
            <path d="M32 70 L44 26 L52 26 Z" />
          </g>
        )}
        {/* A sheen along the top edge: the one concession to depth. */}
        <path d="M0 0 H64 V9 H0 Z" fill="#fff" opacity="0.14" />
      </g>

      {/* The monogram carries the crest; everything else is dressing. */}
      <text
        x="32" y={textY}
        textAnchor="middle" fill="#fff"
        style={{
          font: `800 ${fontSize}px var(--display)`,
          letterSpacing: '0.03em',
          paintOrder: 'stroke',
          stroke: dark, strokeWidth: 0.75,
        }}
      >{letters}</text>

      {/*
        The device, in the metal, and only where there is room for it. A star
        for the traditionalists; the rest are the game's own furniture —
        crossed bats, a ball with its seams, laurel dashes for the programmes
        that will not stop telling you about 1974.
      */}
      {fine && device === 0 && (
        <path
          d={division === 0
            ? 'M32 6 L33.8 10 L38 10.5 L34.9 13.2 L35.8 17.4 L32 15.2 L28.2 17.4 L29.1 13.2 L26 10.5 L30.2 10Z'
            : 'M32 12 L33.8 16 L38 16.5 L34.9 19.2 L35.8 23.4 L32 21.2 L28.2 23.4 L29.1 19.2 L26 16.5 L30.2 16Z'}
          fill={metal} opacity="0.95"
        />
      )}
      {fine && device === 1 && (
        // Crossed bats, under the letters.
        <g
          stroke={metal} strokeWidth="2.6" strokeLinecap="round" opacity="0.85"
          transform={`translate(0 ${division === 0 ? 4 : 0})`}
        >
          <path d="M23 60 L41 48" />
          <path d="M41 60 L23 48" />
        </g>
      )}
      {fine && device === 2 && (
        // The ball, seams and all, where the chevron leaves room.
        <g transform={`translate(32 ${division === 4 ? 60 : division === 0 ? 58 : 55})`}>
          <circle r="4.6" fill={metal} />
          <path
            d="M-2.4 -3.4 C-0.8 -1 -0.8 1 -2.4 3.4 M2.4 -3.4 C0.8 -1 0.8 1 2.4 3.4"
            stroke={dark} strokeWidth="0.9" fill="none"
          />
        </g>
      )}
      {fine && device === 3 && (
        // Laurel dashes flanking the base.
        <g stroke={metal} strokeWidth="1.8" strokeLinecap="round" opacity="0.8">
          <path d="M18 52 C16 55 16 58 18 61" fill="none" />
          <path d="M46 52 C48 55 48 58 46 61" fill="none" />
        </g>
      )}

      {/* The outline last, so nothing bleeds past the edge. Heavier when the
          crest is small, because the silhouette is all a nav row gets. */}
      <path d={shape} fill="none" stroke={dark} strokeWidth={fine ? 2.6 : 3.4} />
    </svg>
  );
}
