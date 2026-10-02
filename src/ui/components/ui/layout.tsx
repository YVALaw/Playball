// layout.tsx
// The design system's surfaces and structure: cards, lists and rows, callouts,
// headers, empty states, the pinned action bar, and the bottom sheet.

import { useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon.js';
import { Button, cx, type ButtonProps } from './core.js';
import { useDialogFocus } from '../../dialogFocus.js';
import { useScreenOwner } from '../../screenOwner.js';

/* -------------------------------------------------------------------- Card */

export function Card({
  title, eyebrow, trailing, footer, flush, label, children, className, onClick,
}: {
  title?: ReactNode; eyebrow?: string; trailing?: ReactNode; footer?: ReactNode; flush?: boolean;
  label?: string; children?: ReactNode; className?: string;
  /** The whole card is the control: a summary on the home page that opens its screen. */
  onClick?: () => void;
}) {
  const hasHead = title || eyebrow || trailing;
  const body = (
    <>
      {hasHead && (
        <header className="pb-card__head">
          <span className="pb-card__titles">
            {eyebrow && <span className="pb-eyebrow">{eyebrow}</span>}
            {title && <span className="pb-card__title">{title}</span>}
          </span>
          {trailing && <span className="pb-card__trailing">{trailing}</span>}
        </header>
      )}
      {children != null && <div className="pb-card__body">{children}</div>}
      {footer && <footer className="pb-card__foot">{footer}</footer>}
    </>
  );
  const cls = cx('pb-card', flush && 'pb-card--flush', onClick && 'is-interactive', className);
  if (!onClick) return <section className={cls} aria-label={label}>{body}</section>;
  return (
    <section
      className={cls}
      aria-label={label}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >{body}</section>
  );
}

/* ------------------------------------------------------------ List, ListRow */

export function List(
  { children, label, role, className, guide }: { children: ReactNode; label?: string; role?: string; className?: string; guide?: string },
) {
  return <div className={cx('pb-list', className)} role={role} aria-label={label} data-guide={guide}>{children}</div>;
}

export interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconName;
  markTone?: 'neutral' | 'warning' | 'info';
  /** Anything in place of the icon tile: a Monogram, a Crest. */
  lead?: ReactNode;
  value?: ReactNode;
  unit?: string;
  status?: ReactNode;
  selected?: boolean;
  chevron?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
  /** The guided tour's name for this row. */
  guide?: string;
  disabled?: boolean;
}

/** One thing in a list: what it is, its state, its number, and where it goes. */
export function ListRow({
  title, subtitle, icon, markTone, lead, value, unit, status, selected, chevron, onClick, children, className, guide, disabled,
}: ListRowProps) {
  const clickable = !!onClick;
  const body = (
    <>
      {lead ? <span className="pb-row__lead">{lead}</span>
        : icon ? <span className={cx('pb-row__mark', markTone && `pb-mark--${markTone}`)}><Icon name={icon} size={20} /></span>
          : null}
      <span className="pb-row__body">
        <span className="pb-row__title">{title}</span>
        {subtitle && <span className="pb-row__subtitle">{subtitle}</span>}
        {status && <span className="pb-row__status">{status}</span>}
        {children && <span className="pb-row__extra">{children}</span>}
      </span>
      {value != null && <span className="pb-row__value">{value}{unit && <small>{unit}</small>}</span>}
      {clickable && chevron !== false && <Icon name="chevron-right" size={20} className="pb-row__chevron" />}
    </>
  );
  const cls = cx('pb-row', clickable && 'is-interactive', selected && 'is-selected', className);
  if (!clickable) return <div className={cls} data-guide={guide}>{body}</div>;
  return (
    <button
      type="button"
      className={cls}
      data-guide={guide}
      disabled={disabled}
      aria-pressed={selected != null ? !!selected : undefined}
      onClick={onClick}
    >{body}</button>
  );
}

/* ----------------------------------------------------------------- Callout */

const CALLOUT_ICON: Record<string, IconName> = {
  info: 'info', positive: 'check-circled', warning: 'alert', negative: 'cross-circled', neutral: 'info',
};

export interface CalloutProps {
  tone?: 'info' | 'positive' | 'warning' | 'negative' | 'neutral';
  icon?: IconName | false;
  eyebrow?: string;
  title?: ReactNode;
  children?: ReactNode;
  /** One button under the text. Ignored when the whole callout is clickable. */
  action?: { label: string; onClick?: () => void; meta?: ReactNode; variant?: ButtonProps['variant'] };
  /** Makes the whole callout a button with a chevron. */
  onClick?: () => void;
  role?: string;
  className?: string;
  guide?: string;
}

/** Something the player should know now: a warning, a result, what is next. */
export function Callout({
  tone = 'info', icon, eyebrow, title, children, action, onClick, role, className, guide,
}: CalloutProps) {
  const glyph = icon === false ? null : (icon ?? CALLOUT_ICON[tone]!);
  const clickable = !!onClick;
  const inner = (
    <>
      {glyph && <span className="pb-callout__icon"><Icon name={glyph} size={20} /></span>}
      <span className="pb-callout__body">
        {eyebrow && <span className="pb-callout__eyebrow">{eyebrow}</span>}
        {title && <span className="pb-callout__title">{title}</span>}
        {children && <span className="pb-callout__text">{children}</span>}
        {action && !clickable && (
          <span className="pb-callout__actions">
            <Button size="sm" variant={action.variant ?? 'secondary'} onClick={action.onClick} meta={action.meta}>{action.label}</Button>
          </span>
        )}
      </span>
      {clickable && <Icon name="chevron-right" size={20} className="pb-callout__chevron" />}
    </>
  );
  const cls = cx('pb-callout', `pb-callout--${tone}`, clickable && 'is-interactive', className);
  if (clickable) return <button type="button" className={cls} onClick={onClick} data-guide={guide}>{inner}</button>;
  return <div className={cls} role={role ?? 'status'} data-guide={guide}>{inner}</div>;
}

/* ----------------------------------------------------------- SectionHeader */

export function SectionHeader({
  title, count, description, action, level = 2, className,
}: {
  title: string; count?: ReactNode; description?: ReactNode;
  action?: { label: string; onClick?: () => void }; level?: 2 | 3; className?: string;
}) {
  const Tag = level === 3 ? 'h3' : 'h2';
  return (
    <div className={cx('pb-section-head', className)}>
      <div className="pb-section-head__text">
        <Tag className="pb-section-head__title">
          {title}{count != null && <span className="pb-section-head__count">{count}</span>}
        </Tag>
        {description && <p className="pb-section-head__desc">{description}</p>}
      </div>
      {action && (
        <button type="button" className="pb-link" onClick={action.onClick}>
          {action.label}<Icon name="chevron-right" size={16} />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ ScreenHeader */

export function ScreenHeader({
  title, eyebrow, description, back, trailing, className,
}: {
  title: ReactNode; eyebrow?: ReactNode; description?: ReactNode;
  back?: { label: string; onClick?: () => void; guide?: string };
  trailing?: ReactNode; className?: string;
}) {
  return (
    <header className={cx('pb-screen-head', className)}>
      {back && (
        <button type="button" className="pb-back" onClick={back.onClick} data-guide={back.guide}>
          <Icon name="arrow-left" size={16} />{back.label}
        </button>
      )}
      {eyebrow && <span className="pb-eyebrow">{eyebrow}</span>}
      <div className="pb-screen-head__row">
        <h1 className="pb-screen-head__title">{title}</h1>
        {trailing}
      </div>
      {description && <p className="pb-screen-head__desc">{description}</p>}
    </header>
  );
}

/* -------------------------------------------------------------- EmptyState */

export function EmptyState({
  icon = 'info', title, text, action, className,
}: {
  icon?: IconName; title: string; text?: ReactNode;
  action?: { label: string; onClick?: () => void; variant?: ButtonProps['variant'] }; className?: string;
}) {
  return (
    <div className={cx('pb-empty', className)} role="status">
      <span className="pb-empty__icon"><Icon name={icon} size={24} /></span>
      <span className="pb-empty__title">{title}</span>
      {text && <span className="pb-empty__text">{text}</span>}
      {action && <Button variant={action.variant ?? 'secondary'} size="sm" onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}

/* --------------------------------------------------------------- ActionBar */

/** The screen's one forward action, pinned to the bottom of the frame. */
/**
 * The bar of buttons pinned to the foot of a screen.
 *
 * `note` is the line over the buttons. Pass `''` to keep the line's room
 * with nothing in it: a bar whose note comes and goes with the state changed
 * height with it, and the buttons rose and fell under the thumb.
 */
export function ActionBar({ note, children, className }: { note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('pb-actionbar', className)}>
      {note !== undefined && note !== null && note !== false && <span className="pb-actionbar__note">{note}</span>}
      <span className="pb-actionbar__buttons">{children}</span>
    </div>
  );
}

/* --------------------------------------------------------- DescriptionList */

export interface DescriptionItem {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: 'positive' | 'warning' | 'negative' | 'info';
  icon?: IconName;
}

export function DescriptionList(
  { items, columns = 2, className }: { items: DescriptionItem[]; columns?: 1 | 2; className?: string },
) {
  return (
    <dl className={cx('pb-dlist', columns === 1 && 'pb-dlist--1', className)}>
      {items.map((it, i) => (
        <div key={i} className="pb-dlist__item">
          <dt>{it.label}</dt>
          <dd className={it.tone ? `pb-tone--${it.tone}` : undefined}>
            {it.icon && <Icon name={it.icon} size={16} />}{it.value}
          </dd>
          {it.note && <span className="pb-dlist__note">{it.note}</span>}
        </div>
      ))}
    </dl>
  );
}

/* ----------------------------------------------------------- ProfileHeader */

export function ProfileHeader({
  media, eyebrow, name, meta, tags, stats, className,
}: {
  media?: ReactNode; eyebrow?: ReactNode; name: ReactNode; meta?: ReactNode; tags?: ReactNode;
  stats?: Array<{ label: string; value: ReactNode }>; className?: string;
}) {
  return (
    <header className={cx('pb-profile', className)}>
      {media && <span className="pb-profile__media">{media}</span>}
      <span className="pb-profile__text">
        {eyebrow && <span className="pb-eyebrow">{eyebrow}</span>}
        <h1 className="pb-profile__name">{name}</h1>
        {meta && <span className="pb-profile__meta">{meta}</span>}
        {tags && <span className="pb-profile__tags">{tags}</span>}
      </span>
      {stats && (
        <span className="pb-profile__stats">
          {stats.map((s, i) => (
            <span key={i} className="pb-profile__stat"><b>{s.value}</b><small>{s.label}</small></span>
          ))}
        </span>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------- Sheet */

export interface SheetProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  lead?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  /** Pinned under the scroller: the sheet's one action. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  /**
   * Whether the back gesture should peel this sheet by itself (the default).
   * False for a sheet the store already holds as a layer (a coach seat), which
   * spends its own history entry.
   */
  layer?: boolean;
  /** The guided tour's name for the whole sheet. */
  guide?: string;
  /** Tall sheets fill the frame; short ones sit at the bottom. */
  tall?: boolean;
  /** The guided tour's name for the close button. */
  closeGuide?: string;
  /**
   * Laid under a room it opened: kept mounted, so its back layer and history
   * entry stay where they are in the stack, but not shown and not reachable.
   * The Season plan uses it while a hiring desk or a building is up over it.
   */
  covered?: boolean;
}

/**
 * A sheet over the screen it was opened from: a person, a game, a decision.
 * Rendered into the app frame so it covers the phone, not the scroller, and
 * closed by the scrim, the close button, Escape or the back gesture.
 */
export function Sheet({
  title, eyebrow, subtitle, lead, onClose, closeLabel = 'Close', footer, children, className, layer = true, guide, tall, closeGuide,
  covered = false,
}: SheetProps) {
  const ref = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const host = typeof document === 'undefined' ? null : document.querySelector('.app-frame');
  const owner = useScreenOwner();
  useDialogFocus(ref, onClose, { layer, active: !!host });

  /*
    Pull the top of the sheet down to close it, the way a phone's own sheets
    close. The grip and the header are the handle; the body keeps its scroll.
    A long pull, or a short quick one, closes; anything less springs back.
  */
  const drag = useRef<{ y: number; t: number } | null>(null);
  const [pull, setPull] = useState(0);
  const [pulling, setPulling] = useState(false);
  const onDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    drag.current = { y: e.clientY, t: performance.now() };
    setPulling(true);
    // Keeps the pull alive when the finger runs off the handle. A pointer the
    // browser has already let go of cannot be captured; the pull still works.
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag.current) return;
    setPull(Math.max(0, e.clientY - drag.current.y));
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag.current) return;
    const distance = Math.max(0, e.clientY - drag.current.y);
    const speed = distance / Math.max(1, performance.now() - drag.current.t);
    drag.current = null;
    setPulling(false);
    if (distance > 96 || (distance > 24 && speed > 0.5)) { onClose(); return; }
    setPull(0);
  };

  if (!host) return null;
  return createPortal(
    <div
      className="pb-sheet-host"
      data-owner={owner}
      onClick={onClose}
      style={covered ? { display: 'none' } : undefined}
      inert={covered || undefined}
      aria-hidden={covered || undefined}
    >
      <section
        ref={ref}
        className={cx('pb-sheet', tall && 'pb-sheet--tall', pulling && 'is-pulling', className)}
        style={pull > 0 ? { transform: `translateY(${pull}px)` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-guide={guide}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pb-sheet__handle"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <span className="pb-sheet__grip" aria-hidden />
          <header className="pb-sheet__head">
            {lead}
            <div className="pb-sheet__titles">
              {eyebrow && <span className="pb-eyebrow">{eyebrow}</span>}
              <h2 id={titleId} className="pb-sheet__title">{title}</h2>
              {subtitle && <span className="pb-sheet__subtitle">{subtitle}</span>}
            </div>
            <button type="button" className="pb-icon-btn" aria-label={closeLabel} onClick={onClose} data-guide={closeGuide}>
              <Icon name="cross" size={20} />
            </button>
          </header>
        </div>
        <div className="pb-sheet__body">{children}</div>
        {footer && <footer className="pb-sheet__foot">{footer}</footer>}
      </section>
    </div>,
    host,
  );
}
