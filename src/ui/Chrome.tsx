// Chrome.tsx
// The frame every screen sits in: the school header, the section tabs and the
// four areas, built from the design system's chrome (components/ui/chrome.tsx).
//
// The header says who you are and how the year is going: the school, the
// record, the inbox bell with its count (one way into the inbox, from
// anywhere), and your portrait, which opens the coach menu. The top tabs are
// the sections of the area you are in; the bottom nav is the four areas and
// reports nothing but a dot.
//
// Every control keeps the `data-guide` name the first-season tour looks for:
// `tab-<area>`, `screen-<section>`, `coach-menu`, `coach-profile`.

import { useState, type ReactNode } from 'react';
import { CoachPortrait } from './CoachPortrait.js';
import { Crest } from './Crest.js';
import { useBackLayer } from './useBackLayer.js';
import {
  AppHeader, BottomNav, HeaderStat, Icon, IconButton, TopTabs, type IconName, type NavItem,
} from './components/ui/index.js';
import { useDynasty, useUserTeam } from '../state/store.js';
import { unreadCount } from '../engine/inbox.js';

/** The four areas' icons, which mean the same thing wherever they appear. */
export const AREA_ICON: Record<string, IconName> = {
  home: 'home',
  team: 'id-card',
  office: 'backpack',
  program: 'star',
};

/**
 * The school, the record, and the two doors every screen needs.
 *
 * `record` is omitted where there is no season to report (between jobs).
 * `extra` sits before the bell: the god-mode bolt, in a sandbox career.
 */
export function SchoolHeader(
  { abbr, kicker, name, record, recordLabel = 'Record', extra }:
  { abbr?: string; kicker?: ReactNode; name: ReactNode; record?: string; recordLabel?: string; extra?: ReactNode },
) {
  return (
    <AppHeader
      mark={abbr ? <Crest abbr={abbr} size={30} /> : undefined}
      abbr={abbr ? undefined : '—'}
      kicker={kicker}
      title={name}
      trailing={(
        <>
          {record !== undefined && <HeaderStat label={recordLabel} value={record} />}
          {extra}
          <InboxBell />
          <CoachMenuButton />
        </>
      )}
    />
  );
}

/** The inbox's own mark: the ball from the brand set, where a stock bell used to be. */
const INBOX_BALL = new URL('./brand/ball.webp', import.meta.url).href;

/** The inbox, from anywhere, with the unread count on the ball. */
export function InboxBell() {
  const unread = useDynasty((s) => unreadCount(s.inbox));
  const openOverlay = useDynasty((s) => s.openOverlay);
  return (
    <IconButton
      icon="bell"
      art={<img className="pb-iconbtn__art" src={INBOX_BALL} alt="" draggable={false} decoding="async" />}
      label="Inbox"
      tone="quiet"
      badge={unread > 0 ? unread : undefined}
      data-guide="inbox"
      onClick={() => openOverlay('inbox')}
    />
  );
}

/**
 * You, in the corner, and the short menu behind your face: your profile and
 * the settings (saves live inside settings). The dot is a coach achievement
 * you have not looked at yet.
 */
export function CoachMenuButton() {
  const coach = useDynasty((s) => s.coach);
  const team = useUserTeam();
  // Between jobs `team` is still the chair he left.
  const jobSearch = useDynasty((s) => s.jobSearch);
  const openOverlay = useDynasty((s) => s.openOverlay);
  const trophyDot = useDynasty((s) => s.unseenTrophies.length > 0);
  /*
    A back level while it is up, and shut by any nav tap (2026-09-30): held
    as the nav count it opened at, so a route that moves under it closes it
    in the same render. Left open, a back swipe moved the screen and the menu
    stayed over the new one.
  */
  const navEpoch = useDynasty((s) => s.navEpoch);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const open = openAt === navEpoch;
  const setOpen = (v: boolean): void => setOpenAt(v ? navEpoch : null);
  useBackLayer(open, () => setOpenAt(null));
  // The menu hands its level to what it opens, in the same commit: no push, no pop.
  const go = (run: () => void): void => { setOpen(false); run(); };

  return (
    <span className="pb-coachmenu">
      <button
        type="button"
        className="pb-coachmenu__btn"
        data-guide="coach-menu"
        aria-label={trophyDot ? 'Coach menu, new achievement' : 'Coach menu'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <CoachPortrait look={coach.look} size={36} />
        {trophyDot && <span className="pb-dot pb-coachmenu__dot" aria-hidden />}
      </button>
      {open && (
        <>
          <button className="pb-menu-scrim" type="button" aria-label="Close coach menu" onClick={() => setOpen(false)} />
          <section className="pb-menu" role="menu" aria-label="Coach menu">
            <button
              type="button"
              role="menuitem"
              className="pb-menu__profile"
              data-guide="coach-profile"
              onClick={() => go(() => openOverlay('coach'))}
            >
              <span className="pb-menu__face"><CoachPortrait look={coach.look} size={40} /></span>
              <span className="pb-menu__who">
                <strong>{coach.name}</strong>
                <small>{team && !jobSearch ? `Head coach · ${team.def.school}` : 'Between jobs'}</small>
              </span>
              {trophyDot && <span className="pb-dot" role="img" aria-label="New achievement" />}
              <Icon name="chevron-right" size={20} />
            </button>
            <button type="button" role="menuitem" className="pb-menu__item" onClick={() => go(() => openOverlay('settings'))}>
              <Icon name="gear" size={20} /><span>Settings and saves</span><Icon name="chevron-right" size={20} />
            </button>
          </section>
        </>
      )}
    </span>
  );
}

/** The sections of the current area, as top tabs. */
export function SectionTabs<T extends string>(
  { label, items, active, onSelect }:
  { label: string; items: ReadonlyArray<{ id: T; label: string; alert?: boolean }>; active: T; onSelect: (id: T) => void },
) {
  const tabs: NavItem<T>[] = items.map((it) => ({ value: it.id, label: it.label, alert: it.alert, guide: `screen-${it.id}` }));
  return <TopTabs label={label} items={tabs} value={active} onChange={onSelect} />;
}

/** The four areas. */
export function AreaNav<T extends string>(
  { tabs, active, onSelect }:
  { tabs: ReadonlyArray<{ id: T; label: string; alert?: boolean }>; active: T; onSelect: (id: T) => void },
) {
  const items = tabs.map((t) => ({
    value: t.id, label: t.label, alert: t.alert, icon: AREA_ICON[t.id] ?? 'dot', guide: `tab-${t.id}`,
  }));
  return <BottomNav label="Career areas" items={items} value={active} onChange={onSelect} />;
}
