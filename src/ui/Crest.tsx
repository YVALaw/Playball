// Crest.tsx
// Ninety six schools, ninety six shields, zero image files.
//
// The letter-squares said "a school" the way a spreadsheet does. A collegiate
// shield says it the way a letterman jacket does — and drawn procedurally from
// the abbreviation and the school's own colour, every save agrees on every
// crest forever and the app ships not one asset.
//
// The variety is hashed, never drawn: the same string hash the economy and the
// world run on picks a silhouette, a field division and a small device, so two
// neighbouring rows get visibly different shields and a reload cannot restyle
// anybody. The letters stay the centrepiece — after a season of standings they
// are what a reader actually recognises.

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
  divisions and devices multiplied in there are dozens of distinct crests, and
  more outlines than four stop reading as one league's heraldry.
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

export function Crest({ abbr, size = 34 }: { abbr: string; size?: number }) {
  const colour = teamColour(abbr);
  const dark = shade(colour, 0.62);
  const h = hash(abbr);
  const shape = SHAPES[h % SHAPES.length]!;
  const division = hash(`${abbr}:d`) % 3; // chief band / bend / bordure
  const device = hash(`${abbr}:v`) % 4; // star / dots / bar / none
  const letters = abbr.slice(0, 4);
  const fontSize = letters.length <= 2 ? 21 : letters.length === 3 ? 16.5 : 13;

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
        {division === 0 && <rect x="0" y="0" width="64" height="20" fill={dark} />}
        {division === 1 && <path d="M-8 82 L46 -6 L64 -6 L10 82 Z" fill={dark} opacity="0.55" />}
        {division === 2 && (
          <path
            d="M8.5 10.5 H55.5 V38 C55.5 52 44 61.5 32 65 C20 61.5 8.5 52 8.5 38 Z"
            fill="none" stroke="#fff" strokeWidth="1.6" opacity="0.5"
          />
        )}
        {/* A sheen along the top edge: the one concession to depth. */}
        <path d="M0 0 H64 V9 H0 Z" fill="#fff" opacity="0.14" />
      </g>

      {/* The monogram carries the crest; everything else is dressing. */}
      <text
        x="32" y={division === 0 ? 46 : 42}
        textAnchor="middle" fill="#fff"
        style={{
          font: `800 ${fontSize}px var(--display)`,
          letterSpacing: '0.03em',
          paintOrder: 'stroke',
          stroke: dark, strokeWidth: 0.75,
        }}
      >{letters}</text>

      {device === 0 && (
        <path
          d={division === 0
            ? 'M32 6 L33.8 10 L38 10.5 L34.9 13.2 L35.8 17.4 L32 15.2 L28.2 17.4 L29.1 13.2 L26 10.5 L30.2 10Z'
            : 'M32 12 L33.8 16 L38 16.5 L34.9 19.2 L35.8 23.4 L32 21.2 L28.2 23.4 L29.1 19.2 L26 16.5 L30.2 16Z'}
          fill="#fff" opacity={division === 0 ? 0.9 : 0.75}
        />
      )}
      {device === 1 && (
        <g fill="#fff" opacity="0.75">
          <circle cx="24" cy={division === 0 ? 56 : 52} r="2" />
          <circle cx="40" cy={division === 0 ? 56 : 52} r="2" />
        </g>
      )}
      {device === 2 && (
        <rect
          x="20" y={division === 0 ? 53 : 50} width="24" height="2.4"
          fill="#fff" opacity="0.7"
        />
      )}

      {/* The outline last, so nothing bleeds past the edge. */}
      <path d={shape} fill="none" stroke={dark} strokeWidth="2.6" />
    </svg>
  );
}
