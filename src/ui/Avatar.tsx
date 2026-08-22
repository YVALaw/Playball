// Avatar.tsx
// A face for every player.
//
// Four thousand players and no artist, so the portraits are drawn from the
// player's own id: the same man gets the same face on the recruiting board, on
// his card, and in the draft results four years later. That consistency is the
// whole point — a face that shuffles on every render is worse than no face,
// because it stops being *his*.
//
// Deliberately flat vector shapes rather than anything rendered. It costs a few
// dozen SVG nodes, matches the app's palette, scales to any size without assets,
// and adds nothing to the bundle.

import { CONFERENCES } from '../data/schools.js';

/** A stable value in [0,1) from an id and a salt. Same input, same face. */
function hash(seed: string, salt: number): number {
  let h = salt * 2654435761;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const v = Math.sin(h * 0.0001 + salt * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

const pick = <T,>(list: readonly T[], seed: string, salt: number): T =>
  list[Math.floor(hash(seed, salt) * list.length)] as T;

/**
 * Skin tones, spread across the range college baseball actually draws from.
 *
 * Ordered light to dark and sampled uniformly, so a roster looks like a roster
 * rather than one tone with occasional exceptions.
 */
const SKIN = ['#f0c9a6', '#e0ab82', '#c68a5e', '#a26b43', '#7a4e2d', '#5a3720'] as const;
const HAIR = ['#1c1410', '#2e1f16', '#4a3121', '#6b4a2a', '#9a6b3a', '#c9a05c'] as const;

/** Cap, short, curly, long. Enough that a lineup does not look cloned. */
type Cut = 'cap' | 'short' | 'curls' | 'long' | 'bald';
const CUTS: readonly Cut[] = ['cap', 'short', 'curls', 'long', 'cap', 'short', 'bald'];

interface Props {
  /** The player's id. Everything is derived from it. */
  id: string;
  /** Team abbreviation, for the jersey colour. Falls back to the app's clay. */
  team?: string;
  /** Shirt number. Two digits look right; anything works. */
  number?: number;
  size?: number;
}

export function Avatar({ id, team, number, size = 40 }: Props) {
  const skin = pick(SKIN, id, 1);
  const hair = pick(HAIR, id, 2);
  const cut = pick(CUTS, id, 3);
  const beard = hash(id, 4) > 0.78;

  // The jersey takes the program's own colour, which is what makes a roster read
  // as a team rather than a set of individuals.
  const jersey = teamColour(team);
  const shirt = number ?? Math.floor(hash(id, 5) * 89) + 1;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      style={{ display: 'block', borderRadius: '50%', background: 'var(--field)' }}
      aria-hidden="true"
    >
      {/* Shoulders and jersey. Drawn first so the head sits over the collar. */}
      <path d="M8 64 C8 50 20 44 32 44 C44 44 56 50 56 64 Z" fill={jersey} />
      <path d="M26 45 L32 54 L38 45 L34 44 L32 47 L30 44 Z" fill="var(--cream)" />
      <text
        x="32" y="61"
        textAnchor="middle"
        style={{ font: "700 9px var(--mono)", fill: 'var(--cream)', opacity: 0.9 }}
      >{shirt}</text>

      {/* Neck, then the head. */}
      <rect x="27" y="36" width="10" height="9" rx="3" fill={skin} />
      <ellipse cx="32" cy="26" rx="13" ry="14.5" fill={skin} />

      {/* Ears, tucked behind whatever the hair does. */}
      <ellipse cx="19" cy="27" rx="2.4" ry="3.2" fill={skin} />
      <ellipse cx="45" cy="27" rx="2.4" ry="3.2" fill={skin} />

      {cut === 'short' && (
        <path d="M19 22 C20 13 26 11 32 11 C38 11 44 13 45 22 C42 17 36 15 32 15 C28 15 22 17 19 22 Z" fill={hair} />
      )}
      {cut === 'curls' && (
        <g fill={hair}>
          <circle cx="23" cy="16" r="6" />
          <circle cx="32" cy="13" r="6.5" />
          <circle cx="41" cy="16" r="6" />
          <circle cx="19" cy="22" r="4.5" />
          <circle cx="45" cy="22" r="4.5" />
        </g>
      )}
      {cut === 'long' && (
        <path d="M18 24 C17 12 25 10 32 10 C39 10 47 12 46 24 L46 36 L42 36 L42 20 C38 16 26 16 22 20 L22 36 L18 36 Z" fill={hair} />
      )}
      {cut === 'cap' && (
        <>
          <path d="M18 22 C18 12 25 9 32 9 C39 9 46 12 46 22 Z" fill={jersey} />
          <path d="M17 22 L52 22 C52 25 48 26 44 26 L17 26 Z" fill={jersey} opacity="0.85" />
          <circle cx="32" cy="12" r="1.8" fill="var(--cream)" opacity="0.7" />
        </>
      )}

      {/* Eyes and brows. Two dots read as a face at 28 pixels; anything more
          becomes noise at the sizes this is actually used. */}
      <circle cx="27" cy="26" r="1.7" fill="#1c2430" />
      <circle cx="37" cy="26" r="1.7" fill="#1c2430" />
      <path d="M24 22 L30 21" stroke="#1c2430" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <path d="M34 21 L40 22" stroke="#1c2430" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />

      {beard && (
        <path d="M21 29 C21 39 26 43 32 43 C38 43 43 39 43 29 C40 36 36 38 32 38 C28 38 24 36 21 29 Z" fill={hair} opacity="0.85" />
      )}
      <path d="M29 33 Q32 35.5 35 33" stroke="#1c2430" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/**
 * The program's colour, from the frozen school table.
 *
 * Exported because a school's name should carry it too. Sixty four programs in
 * one typeface are sixty four strings; in their own colours they are places you
 * start to recognise, which is most of what makes a league feel inhabited.
 */
export function teamColour(abbr?: string): string {
  if (!abbr) return '#a8442a';
  for (const conf of CONFERENCES) {
    for (const school of conf.schools) {
      if (school.abbr === abbr) return school.color;
    }
  }
  return '#a8442a';
}
