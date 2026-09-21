// chrome.tsx
// The frame every screen sits in: the header, the top tabs (the sections of
// an area) and the bottom nav (the four areas).

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon.js';
import { cx } from './core.js';

/* --------------------------------------------------------------- AppHeader */

/** Who you are and how the year is going, on every screen. */
export function AppHeader({
  mark, abbr, kicker, title, trailing, onTitle, className,
}: {
  /** The school's crest; falls back to the abbreviation on the accent. */
  mark?: ReactNode;
  abbr?: string;
  kicker?: ReactNode;
  title: ReactNode;
  trailing?: ReactNode;
  onTitle?: () => void;
  className?: string;
}) {
  const titles = (
    <>
      {mark ? <span className="pb-appbar__crest" aria-hidden>{mark}</span>
        : <span className="pb-appbar__mark" aria-hidden>{abbr}</span>}
      <span className="pb-appbar__titles">
        {kicker && <small>{kicker}</small>}
        <strong>{title}</strong>
      </span>
    </>
  );
  return (
    <header className={cx('pb-appbar', className)}>
      {onTitle
        ? <button type="button" className="pb-appbar__id" onClick={onTitle}>{titles}</button>
        : <span className="pb-appbar__id">{titles}</span>}
      {trailing && <span className="pb-appbar__trailing">{trailing}</span>}
    </header>
  );
}

/** One number in the header, with its label: the record. */
export function HeaderStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="pb-headstat">
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

/* ----------------------------------------------------------------- TopTabs */

export interface NavItem<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  alert?: boolean;
  /** The guided tour's name for this tab. */
  guide?: string;
}

/** The sections of an area. Scrolls rather than squeezes, and brings the current one into view. */
export function TopTabs<T extends string>({
  items, value, onChange, label = 'Sections', className,
}: { items: ReadonlyArray<NavItem<T>>; value: T; onChange?: (value: T) => void; label?: string; className?: string }) {
  const ref = useRef<HTMLElement | null>(null);

  // A fade at the edge says there is more to the right.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = (): void => {
      const more = el.scrollWidth - el.clientWidth - el.scrollLeft > 2;
      if (more) el.dataset.more = 'right'; else delete el.dataset.more;
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', measure); ro?.disconnect(); };
  }, [items.length]);

  useLayoutEffect(() => {
    const el = ref.current;
    const on = el?.querySelector<HTMLElement>('button.is-active');
    if (!el || !on) return;
    const left = on.offsetLeft;
    const right = left + on.offsetWidth;
    if (left < el.scrollLeft) el.scrollLeft = left - 12;
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth + 12;
  }, [value]);

  return (
    <nav ref={ref} className={cx('pb-toptabs', className)} aria-label={label}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            className={on ? 'is-active' : undefined}
            aria-current={on ? 'page' : undefined}
            data-guide={it.guide}
            onClick={() => onChange?.(it.value)}
          >
            {it.label}
            {it.alert && <span className="pb-dot" role="img" aria-label="needs attention" />}
          </button>
        );
      })}
    </nav>
  );
}

/* --------------------------------------------------------------- BottomNav */

/** The four areas of the game. Navigation only: it reports nothing but a dot. */
export function BottomNav<T extends string>({
  items, value, onChange, label = 'Main', className,
}: {
  items: ReadonlyArray<NavItem<T> & { icon: IconName }>;
  value: T;
  onChange?: (value: T) => void;
  label?: string;
  className?: string;
}) {
  return (
    <nav className={cx('pb-tabbar', className)} aria-label={label}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            className={on ? 'is-active' : undefined}
            aria-current={on ? 'page' : undefined}
            data-guide={it.guide}
            onClick={() => onChange?.(it.value)}
          >
            <Icon name={it.icon} size={20} />
            <span>{it.label}</span>
            {it.alert && <span className="pb-dot pb-tabbar__dot" role="img" aria-label="needs attention" />}
          </button>
        );
      })}
    </nav>
  );
}
