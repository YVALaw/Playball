// Chrome.tsx
// The furniture: the bar at the top, the tabs under it, the nav at the bottom.
//
// The proposal's markup, with the proposal's class names, wired to the store.
// There is no styling in this file on purpose — `.global-header`,
// `.club-switcher`, `.context-nav` and `.primary-nav` are all defined in
// prototype.css, which is generated from the design of record. A style object
// here would be a second opinion about a rule that already exists.
//
// It used to live inline in App.tsx, four times over: the regular season, the
// offseason, the postseason and the job search each drew their own header out
// of the same handful of ideas, and two of the four had already drifted.

import type { ReactNode } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { CoachPortrait } from './CoachPortrait.js';
import { useSlide } from './slide.js';
import type { CoachLook } from '../engine/program.js';

/**
 * The club, top left: a mark, a kicker, a name, and a chevron if it opens.
 *
 * `onOpen` is what makes it a switcher rather than a label. Without it the
 * block is still a button in the proposal's markup, which is a control that
 * goes nowhere — so here it degrades to a plain div and the chevron goes with
 * it.
 */
export function ClubSwitcher(
  { abbr, kicker, name, onOpen }:
  { abbr: string; kicker: string; name: string; onOpen?: () => void },
) {
  const inner = (
    <>
      <span className="club-mark">{abbr}</span>
      <span>
        <small>{kicker}</small>
        <strong>{name}</strong>
      </span>
    </>
  );
  if (!onOpen) return <div className="club-switcher">{inner}</div>;
  return (
    <button
      className="club-switcher tap"
      type="button"
      aria-label={`${name} club card`}
      onClick={onOpen}
    >
      {inner}
      <ChevronDownIcon />
    </button>
  );
}

/**
 * One number, right-aligned, on the club name's baseline.
 *
 * Kept through the port because of why it was added: the record rode the
 * identity line in the same weight as the nickname and the conference, and was
 * reported as hard to see and easy to lose — the one number that changes every
 * day set like two that never change.
 */
export function RecordChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="record-chip">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

/**
 * A square in the header, and the count that rides on its shoulder.
 *
 * The badge is `--alert` rather than the accent, which is the whole reason
 * `--alert` exists: a green dot on a green-accented bar says nothing.
 */
export function HeaderIcon(
  { label, onClick, badge, children }:
  { label: string; onClick: () => void; badge?: number; children: ReactNode },
) {
  const count = badge ?? 0;
  return (
    <button
      className="header-icon tap"
      type="button"
      aria-label={count > 0 ? `${label}, ${count} unread` : label}
      onClick={onClick}
    >
      {children}
      {count > 0 && <span>{count > 9 ? '9+' : count}</span>}
    </button>
  );
}

/**
 * You, in the corner.
 *
 * The proposal puts a photograph here. This app draws the face from the coach's
 * own look, the same way it draws four thousand players — see Avatar.tsx for
 * why that is worth keeping over an asset.
 */
export function CoachAvatar(
  { look, onClick, badge }: { look: CoachLook; onClick: () => void; badge?: number },
) {
  const count = badge ?? 0;
  return (
    /*
      The wrapper exists for the badge. When the inbox moved into this menu it
      took the only unread count in the header with it — reported straight
      back: "I should get the notification number as well in the coach picture
      up top." The count cannot ride the button itself, because .coach-avatar
      clips its overflow to keep the portrait round, so a shoulder badge would
      lose its top half. The slot is the un-clipped shoulder.
    */
    <span className="coach-slot">
      <button
        className="coach-avatar tap"
        type="button"
        aria-label={count > 0 ? `Coach menu, ${count} unread` : 'Coach menu'}
        aria-haspopup="menu"
        onClick={onClick}
      >
        <CoachPortrait look={look} size={38} />
      </button>
      {count > 0 && <span className="coach-badge" aria-hidden>{count > 9 ? '9+' : count}</span>}
    </span>
  );
}

/** The sub-nav: a green underline, and a row that scrolls rather than squeezes. */
export function ContextNav<T extends string>(
  { label, items, active, onSelect }:
  {
    label: string;
    items: ReadonlyArray<{ id: T; label: string }>;
    active: T;
    onSelect: (id: T) => void;
  },
) {
  // The underline slides between tabs; 12 keeps the inset the static
  // underline always had. See slide.ts.
  const ref = useSlide<HTMLElement>(12);
  return (
    <nav ref={ref} className="context-nav" aria-label={label}>
      {items.map((item) => (
        <button
          className={item.id === active ? 'active' : ''}
          key={item.id}
          type="button"
          aria-current={item.id === active ? 'page' : undefined}
          onClick={() => onSelect(item.id)}
        >{item.label}</button>
      ))}
    </nav>
  );
}

/**
 * The bottom nav: an icon, a name, and one live number under it.
 *
 * The number was already the best idea in the old bar — the date, the roster
 * count, the record, the stars — so the menu reports rather than only labels.
 * `alert` is the dot on HOME: unread has to be visible from wherever the player
 * normally is, and where he normally is is not the home tab.
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
  // "Same with the line in the main nav bar" — the top line slides too.
  const ref = useSlide<HTMLElement>();
  return (
    <nav ref={ref} className="primary-nav" aria-label="Career areas">
      {tabs.map((t) => (
        <button
          className={t.id === active ? 'active' : ''}
          key={t.id}
          type="button"
          aria-current={t.id === active ? 'page' : undefined}
          onClick={() => onSelect(t.id)}
        >
          {t.icon}
          <span>{t.label}{t.alert && <i className="nav-alert" />}</span>
          <small>{t.meta}</small>
        </button>
      ))}
    </nav>
  );
}
