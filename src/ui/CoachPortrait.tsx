// CoachPortrait.tsx
// The one face in this game that is chosen rather than derived.
//
// Avatar.tsx draws four thousand players out of their own ids, because nobody is
// going to sit and dress four thousand people. This is its sibling for the one
// person the player actually is: same flat vector idiom, same palette, same
// sixty-four unit box — and explicit choices instead of a hash, because a career
// belongs to somebody in particular.
//
// The choices are stored as four small integers (engine/program.ts, CoachLook)
// and the palettes live here. That way the drawing can be redrawn — better
// shapes, a wider range of tones — without touching a single save file, and a
// save file cannot pin the art to whatever the palette happened to be the day it
// was written. Every lookup wraps, so an index from a build with more colours
// than this one produces the wrong shade rather than an empty square.
//
// The engine still has to know how many of each there are, to draw a random
// coach and to validate one off the disk: that is `LOOK_CHOICES`, and a test
// holds it to the lengths of the lists below so a colour added here is a colour
// the rest of the game can actually reach.

import { type CoachLook } from '../engine/program.js';

/**
 * Skin tones and hair colours, matched to the player avatars so a coach and his
 * roster look like they were drawn by the same hand.
 *
 * The hair list swaps the avatars' lightest blond for grey, which is the one
 * thing a head coach can plausibly be and an eighteen year old cannot.
 */
export const COACH_SKIN =
  ['#f0c9a6', '#e0ab82', '#c68a5e', '#a26b43', '#7a4e2d', '#5a3720'] as const;

export const COACH_HAIR =
  ['#1c1410', '#3a2a1c', '#5a3b23', '#8a6234', '#c9a05c', '#8d8b86'] as const;

/** Hair styles, bald first, so the shortest answer is the first one you meet. */
export const CUT_LABEL = ['BALD', 'SHORT', 'PART', 'CURLS', 'LONG'] as const;

export const BEARD_LABEL = ['CLEAN', 'STUBBLE', 'TASH', 'FULL'] as const;

/** Wrap rather than clamp: see the note at the top about palettes drifting. */
const at = <T,>(list: readonly T[], i: number): T =>
  list[((i % list.length) + list.length) % list.length] as T;

interface Props {
  look: CoachLook;
  size?: number;
}

/**
 * Head and shoulders, drawn from four numbers.
 *
 * The shirt is deliberately not a team colour. This is drawn on the creation
 * screen before anybody has been hired, and putting a program's colour on a
 * coach who has not taken a job yet would be the screen answering a question the
 * player has not reached.
 */
export function CoachPortrait({ look, size = 96 }: Props) {
  const skin = at(COACH_SKIN, look.skin);
  const hair = at(COACH_HAIR, look.hair);
  const cut = at(CUT_LABEL, look.cut);
  const beard = at(BEARD_LABEL, look.beard);

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      style={{ display: 'block', borderRadius: '50%', background: 'var(--field)' }}
      aria-hidden="true"
    >
      {/* Shoulders, then a collar, so the head sits over something. */}
      <path d="M8 64 C8 50 20 44 32 44 C44 44 56 50 56 64 Z" fill="var(--navy)" />
      <path d="M26 45 L32 53 L38 45 L34 44 L32 46.5 L30 44 Z" fill="var(--cream)" />

      <rect x="27" y="36" width="10" height="9" rx="3" fill={skin} />
      <ellipse cx="32" cy="26" rx="13" ry="14.5" fill={skin} />

      <ellipse cx="19" cy="27" rx="2.4" ry="3.2" fill={skin} />
      <ellipse cx="45" cy="27" rx="2.4" ry="3.2" fill={skin} />

      {cut === 'SHORT' && (
        <path
          d="M19 22 C20 13 26 11 32 11 C38 11 44 13 45 22 C42 17 36 15 32 15 C28 15 22 17 19 22 Z"
          fill={hair}
        />
      )}
      {cut === 'PART' && (
        // Swept to one side off a hard parting, which is the single most
        // recognisable difference between two short haircuts at this size.
        <path
          d="M19 23 C19 13 26 10 33 10 C40 10 45 13 45 21 C41 17 36 16 30 17 C25 18 21 20 19 23 Z"
          fill={hair}
        />
      )}
      {cut === 'CURLS' && (
        <g fill={hair}>
          <circle cx="23" cy="16" r="6" />
          <circle cx="32" cy="13" r="6.5" />
          <circle cx="41" cy="16" r="6" />
          <circle cx="19" cy="22" r="4.5" />
          <circle cx="45" cy="22" r="4.5" />
        </g>
      )}
      {cut === 'LONG' && (
        <path
          d="M18 24 C17 12 25 10 32 10 C39 10 47 12 46 24 L46 36 L42 36 L42 20 C38 16 26 16 22 20 L22 36 L18 36 Z"
          fill={hair}
        />
      )}

      {/* Eyes and brows. Two dots read as a face at 28 pixels; anything more
          becomes noise at the sizes this is actually used. */}
      <circle cx="27" cy="26" r="1.7" fill="#1c2430" />
      <circle cx="37" cy="26" r="1.7" fill="#1c2430" />
      <path d="M24 22 L30 21" stroke="#1c2430" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      <path d="M34 21 L40 22" stroke="#1c2430" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />

      {(beard === 'FULL' || beard === 'STUBBLE') && (
        <path
          d="M21 29 C21 39 26 43 32 43 C38 43 43 39 43 29 C40 36 36 38 32 38 C28 38 24 36 21 29 Z"
          fill={hair}
          // Stubble is the same shape thinned out. Drawing a second, smaller
          // beard for it produced two beards that read as the same beard.
          opacity={beard === 'FULL' ? 0.85 : 0.32}
        />
      )}
      <path d="M29 33 Q32 35.5 35 33" stroke="#1c2430" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.7" />
      {(beard === 'TASH' || beard === 'FULL') && (
        <path d="M27.5 31 C29 29.8 35 29.8 36.5 31 C35 31.9 29 31.9 27.5 31 Z" fill={hair} />
      )}
    </svg>
  );
}
