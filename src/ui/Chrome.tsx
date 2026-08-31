// Chrome.tsx
// The furniture: the bar at the top, the tabs under it, the nav at the bottom,
// and the rail that runs across the offseason.
//
// It used to live inline in App.tsx, four times over — the regular season, the
// offseason, the postseason and the job search each drew their own header out
// of the same handful of ideas, and a change to any of them was a change in
// four places that had already drifted apart in two. Pulling them out was not
// tidying: the Roster Tabletop header is a five-column grid with a club mark, a
// switcher, a record, a badge and a face in it, and writing that inline five
// times would have been the last honest moment this file had.
//
// The parts, not a component with a mode switch. Each frame still composes its
// own header, because a job search genuinely has nothing to put in four of the
// five slots and a component that took `variant="jobsearch"` would only be
// hiding that.

import type { ReactNode } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';

/*
  The chrome is light now, which is the single biggest change in the re-skin.

  The old bar was navy with a pinstripe and a clay rule under it, and it read as
  a masthead: the app announced itself before it told you anything. The proposal
  puts the same information on paper with a hairline under it, and the effect is
  that the screen starts at the top of the screen. `--navy` did not go away — it
  is still the dark surface under a featured player, a scoreboard and the live
  game — it simply stopped being the ceiling.
*/
const BAR: React.CSSProperties = {
  flex: 'none',
  display: 'grid',
  alignItems: 'end',
  gap: 8,
  padding: '0 14px 10px',
  // Content-box so the safe-area inset adds to the bar rather than eating the
  // row height, which is the same trick the old header used.
  paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
  background: 'var(--paper)',
  borderBottom: '1px solid var(--line)',
};

/** The top bar, as a grid. `cols` is whatever that frame actually has in it. */
export function HeaderShell(
  { cols, children }: { cols: string; children: ReactNode },
) {
  return <header style={{ ...BAR, gridTemplateColumns: cols }}>{children}</header>;
}

/**
 * The club, as a mark.
 *
 * Three letters in a green box with a double rule around it — the proposal's
 * one piece of decoration, and it earns its place by being the only thing in
 * the header that is the same shape every day. The double border is a `border:
 * 3px double`, not two elements: it draws the inner line by itself and stays a
 * single box for the grid to place.
 */
export function ClubMark({ abbr, size = 40 }: { abbr: string; size?: number }) {
  return (
    <div
      aria-hidden
      style={{
        width: size, height: size, display: 'grid', placeItems: 'center',
        background: 'var(--clay)', color: 'var(--paper)',
        border: '3px double rgba(255, 255, 255, .62)',
        font: `800 calc(${Math.round(size * 0.52)}px * var(--ts))/.9 var(--display)`,
        letterSpacing: '.01em',
      }}
    >{abbr}</div>
  );
}

/**
 * Who you are, at the top left: a green kicker over a condensed name.
 *
 * `onOpen` draws the chevron and makes the whole block a button. Without it the
 * block is text, because a control that goes nowhere is worse than a label.
 */
export function ClubIdentity(
  { kicker, name, onOpen }:
  { kicker: string; name: string; onOpen?: () => void },
) {
  const inner = (
    <>
      <div style={{
        font: "700 calc(9px * var(--ts))/1 var(--body)", letterSpacing: '.1em',
        color: 'var(--clay)', textTransform: 'uppercase',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{kicker}</div>
      <div style={{
        marginTop: 2,
        font: "800 calc(23px * var(--ts))/.9 var(--display)", letterSpacing: '.01em',
        color: 'var(--ink)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{name}</div>
    </>
  );

  if (!onOpen) return <div style={{ minWidth: 0 }}>{inner}</div>;
  return (
    <button
      onClick={onOpen}
      className="tap"
      aria-label={`${name} club card`}
      style={{
        minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 14px',
        alignItems: 'center', gap: 6, textAlign: 'left', background: 'transparent',
      }}
    >
      <div style={{ minWidth: 0 }}>{inner}</div>
      <ChevronDownIcon style={{ color: 'var(--dim)' }} />
    </button>
  );
}

/**
 * One number, right-aligned, in the corner where the eye already goes.
 *
 * Kept from the old header on purpose. It was added because the record was lost
 * in a line of small print beside the nickname and the conference, and nothing
 * about repainting the app makes that less true.
 */
export function RecordChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 'none', textAlign: 'right', lineHeight: 1, paddingBottom: 2 }}>
      <div style={{
        font: "700 calc(8px * var(--ts))/1 var(--body)", letterSpacing: '.12em',
        color: 'var(--dim)', textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        marginTop: 3,
        font: "800 calc(19px * var(--ts))/1 var(--display)",
        color: 'var(--ink)', fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}

/**
 * A 40px square in the header, and the count that rides on its shoulder.
 *
 * The badge is `--alert` rather than the accent, which is the whole reason
 * `--alert` exists: a green dot on a green-accented bar says nothing.
 */
export function HeaderIcon(
  { label, onClick, badge, children }:
  { label: string; onClick: () => void; badge?: number; children: ReactNode },
) {
  return (
    <button
      onClick={onClick}
      className="tap"
      aria-label={badge && badge > 0 ? `${label}, ${badge} unread` : label}
      style={{
        position: 'relative', width: 40, height: 40, padding: 0,
        display: 'grid', placeItems: 'center',
        border: '1px solid var(--line)', background: 'var(--paper)',
        color: 'var(--clay)',
      }}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span style={{
          position: 'absolute', top: -6, right: -5,
          minWidth: 17, height: 17, padding: '0 4px',
          display: 'grid', placeItems: 'center', borderRadius: 9,
          border: '2px solid var(--paper)', background: 'var(--alert)',
          color: '#fff', font: "700 calc(9px * var(--ts))/1 var(--body)",
        }}>{badge > 9 ? '9+' : badge}</span>
      )}
    </button>
  );
}

/**
 * The sub-nav: a green underline rather than a filled tab.
 *
 * Scrolls rather than squeezing. PROGRAM carries four screens and the old bar
 * dropped to eight-and-a-half point mono to fit them, which solved the layout
 * by making the labels harder to read than the thing they label. Here they keep
 * their size and the row scrolls, which is what the proposal does and what
 * every phone tab bar has done for a decade.
 */
export function ContextNav<T extends string>(
  { items, active, onSelect }:
  { items: ReadonlyArray<{ id: T; label: string }>; active: T; onSelect: (id: T) => void },
) {
  return (
    <nav
      aria-label="Sections"
      style={{
        flex: 'none', height: 42, display: 'flex', overflowX: 'auto',
        background: 'var(--paper)', borderBottom: '1px solid var(--line)',
        scrollbarWidth: 'none',
      }}
    >
      {items.map((item) => {
        const on = item.id === active;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            aria-current={on ? 'page' : undefined}
            className="tap"
            style={{
              position: 'relative', flex: '1 0 auto', minWidth: 76, padding: '0 14px',
              background: 'transparent',
              color: on ? 'var(--clay)' : 'var(--dim)',
              font: "700 calc(11px * var(--ts)) var(--body)", letterSpacing: '.04em',
            }}
          >
            {item.label}
            {on && (
              <span style={{
                position: 'absolute', left: 12, right: 12, bottom: 0,
                height: 3, background: 'var(--clay)',
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * The bottom nav: an icon, a name, and one live number under it.
 *
 * The number was already there and is the best idea in the old bar — the date,
 * the roster count, the record, the stars, so the menu reports rather than only
 * labels. What is new is the icon above it and the ground under it. A filled
 * clay block marked the active tab before; now the bar is paper and the active
 * tab is drawn by a rule along its top edge, which is quieter and survives the
 * accent being a colour that no longer shouts.
 */
export function PrimaryNav<T extends string>(
  { tabs, active, onSelect }:
  {
    tabs: ReadonlyArray<{
      id: T; label: string; meta?: string; icon: ReactNode; alert?: boolean;
    }>;
    active: T;
    onSelect: (id: T) => void;
  },
) {
  return (
    <nav
      aria-label="Career areas"
      style={{
        flex: 'none', display: 'grid',
        gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
        background: 'var(--paper)', borderTop: '1px solid var(--line)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map((t, i) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            aria-current={on ? 'page' : undefined}
            className="tap"
            style={{
              position: 'relative',
              display: 'grid', placeItems: 'center', alignContent: 'center', gap: 3,
              minHeight: 62, padding: '9px 0 10px',
              background: 'transparent',
              borderRight: i === tabs.length - 1 ? 0 : '1px solid var(--line)',
              boxShadow: on ? 'inset 0 3px 0 var(--clay)' : 'none',
              color: on ? 'var(--clay)' : 'var(--dim)',
            }}
          >
            <span style={{
              position: 'relative', display: 'grid', placeItems: 'center',
              width: 20, height: 20,
            }}>
              {t.icon}
              {/* Unread has to be visible from wherever the player normally is,
                  and where he normally is is not the home tab. */}
              {t.alert && (
                <span style={{
                  position: 'absolute', top: -2, right: -4,
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--alert)',
                }} />
              )}
            </span>
            <span style={{
              font: "700 calc(11px * var(--ts))/1 var(--body)",
              color: on ? 'var(--clay)' : 'var(--ink)',
            }}>{t.label}</span>
            <span style={{
              font: "700 calc(8px * var(--ts))/1 var(--body)", letterSpacing: '.08em',
              color: 'var(--dim)', textTransform: 'uppercase',
            }}>{t.meta ?? ''}</span>
          </button>
        );
      })}
    </nav>
  );
}
