// ProgramBits.tsx
// Two small drawings the program menu needs in more than one room.
//
// Nothing here reads or writes the simulation. `LevelTrack` is the same three
// squares the facility tiles already drew inline, lifted out so the hub can
// show them too; `FacilityArt` is a drafting elevation of each building, drawn
// in currentColor so it follows the theme and the school accent without a
// second palette. Both are square on purpose — the only circles are the ones
// that depict round things.

import { FACILITY_MAX_LEVEL, type Building } from '../engine/economy.js';

/** How far a building has come, as filled segments. */
export function LevelTrack(
  { level, label, max = FACILITY_MAX_LEVEL }: { level: number; label?: string; max?: number },
) {
  return (
    <span
      className="program-level-track"
      aria-label={`${label ? `${label}: ` : ''}level ${level} of ${max}`}
    >
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < level ? 'on' : ''} />)}
    </span>
  );
}

/**
 * The three specialties, drawn rather than named.
 *
 * Line work at a mitred joint, one flat ground plane, and knockout fills in
 * var(--paper) where a near object has to punch through a far one. The bat, the
 * ball, the target and the crest are round because they are round; the boxes
 * are not.
 */
export function FacilityArt({ kind }: { kind: Building }) {
  return (
    <svg className={`facility-art facility-art-${kind}`} viewBox="0 0 240 130" fill="none" aria-hidden="true">
      <path d="m20 95 105-55 100 49-103 33L20 95Z" fill="currentColor" opacity=".07" />
      <g stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" strokeLinecap="butt">
        {kind === 'cage' ? (
          <>
            <path d="m43 91 103-39 48 24-103 36-48-21Z" fill="currentColor" opacity=".1" />
            <path d="M43 91V51l48-21 55 22v39M91 30v82m55-60 48 24v-40l-48-24-55 18M43 51l48 21 103-36M91 72v40m103-76v40" />
            <path d="m59 44 49 21m-32-28 49 22m-19-35 49 22m-31-29 49 20M59 58v40m16-33v40m34-40v41m18-48v43m35-54v40m16-47v42" opacity=".3" />
            <path d="m112 96 35-30m-38 33 6-2m-1-4-5 6" strokeWidth="4" />
            <circle cx="153" cy="90" r="4" fill="var(--paper)" />
          </>
        ) : kind === 'pen' ? (
          <>
            <path d="m35 85 122-45 53 27-123 45-52-27Z" fill="currentColor" opacity=".1" />
            <path d="M35 85V40l53 27v45m0-45 122-45v45" />
            <path d="M51 48v45m18-36v45m43-44v45m25-54v45m24-54v45m25-54v45M35 55l53 27 122-45M35 70l53 27 122-45" opacity=".25" />
            <ellipse cx="151" cy="69" rx="18" ry="8" fill="var(--paper)" />
            <path d="m144 69 12-4" strokeWidth="3" />
            <path d="m86 96 6 3 9-4-3-4-7 1-5 4Z" fill="currentColor" />
            <path d="m102 88 28-10" strokeDasharray="3 5" />
          </>
        ) : (
          <>
            <path d="M46 93V51l72-30 78 32v41l-76 25-74-26Z" fill="currentColor" opacity=".08" />
            <path d="M46 93V51l72-30 78 32v41l-76 25-74-26ZM46 51l74 27 76-25m-76 25v41M39 50l79-39 85 41" />
            <path d="M62 62v18l18 6V69l-18-7Zm29 11v17l16 5V79l-16-6Zm42 7v34l22-7V73l-22 7Zm35-10v16l16-6V64l-16 6Z" fill="currentColor" opacity=".25" />
            <path d="M118 11V2m0 0 22 7-22 4" fill="currentColor" />
            <circle cx="118" cy="50" r="10" />
            <path d="m114 51 3 3 6-8" />
          </>
        )}
      </g>
    </svg>
  );
}
