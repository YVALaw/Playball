// broadcast.tsx
// The parts a screen is built FROM, when the thing on it is a place rather
// than a record: a room you walk into, a skill you spend a point on, a plaque
// on a wall, a name on a door. A grid of objects reads as a place; a column of
// rows reads as a list.
//
// There is no banner here. `Marquee` is the screen's ordinary header with its
// numbers under it — the same ScreenHeader and StatGroup every other screen
// uses — kept as one component so a screen states its title and its numbers in
// one call.

import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon.js';
import { cx, pctOf, StatGroup, type StatTileProps } from './core.js';
import { ScreenHeader } from './layout.js';

/* ---------------------------------------------------------------- Marquee */

export interface MarqueeNumber {
  label: string;
  value: ReactNode;
  /** The scale or unit, set small beside the number: "/100", "/3". */
  unit?: string;
  note?: ReactNode;
  tone?: 'positive' | 'warning' | 'negative' | 'info';
}

export interface MarqueeProps {
  /** The line over the name: "Offseason · Year 3". */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** A crest, a portrait, a monogram, at the right of the header. */
  mark?: ReactNode;
  back?: { label: string; onClick?: () => void; guide?: string };
  trailing?: ReactNode;
  /** The screen's numbers, in the same tiles StatGroup draws everywhere. */
  numbers?: MarqueeNumber[];
  children?: ReactNode;
  className?: string;
}

/** A screen's header and, under it, the numbers that screen is about. */
export function Marquee({
  eyebrow, title, subtitle, mark, back, trailing, numbers, children, className,
}: MarqueeProps) {
  const rail = (numbers ?? []).filter(Boolean);
  const items: StatTileProps[] = rail.map((n) => ({
    label: n.label,
    value: n.value,
    unit: n.unit,
    note: n.note,
    noteTone: n.tone,
  }));
  return (
    <div className={cx('pb-head', className)}>
      <ScreenHeader
        back={back}
        eyebrow={eyebrow}
        title={title}
        description={subtitle}
        trailing={(mark || trailing) ? (
          <span className="pb-head__trailing">{trailing}{mark}</span>
        ) : undefined}
      />
      {items.length > 0 && (
        <StatGroup size={items.length > 3 ? 'sm' : undefined} label="At a glance" items={items} />
      )}
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- TileGrid */

/** Tiles side by side. Two across by default; three for compact plaques. */
export function TileGrid({
  cols = 2, label, children, className,
}: { cols?: 2 | 3 | 'auto'; label?: string; children: ReactNode; className?: string }) {
  return (
    <div
      className={cx('pb-tiles', cols === 3 && 'pb-tiles--3', cols === 'auto' && 'pb-tiles--auto', className)}
      role={label ? 'group' : undefined}
      aria-label={label}
    >{children}</div>
  );
}

/* --------------------------------------------------------------- RoomTile */

export interface RoomTileProps {
  /** The room's glyph, in the plaque at the top left. */
  icon: IconName;
  name: string;
  /** The room's one number, set large. */
  value?: ReactNode;
  unit?: string;
  /** One short line of state. Not a sentence about what the room is for. */
  status?: ReactNode;
  statusTone?: 'positive' | 'warning' | 'negative' | 'info';
  /** A badge at the top right: "Needs you", a count. */
  badge?: ReactNode;
  /** Anything across the bottom: pips, a bar, a row of crests. */
  footer?: ReactNode;
  /** Draws the school colour down the tile's edge: this is where to go next. */
  flagged?: boolean;
  onClick?: () => void;
  guide?: string;
  className?: string;
}

/** A place in the program, as a tile you press rather than a row you read. */
export function RoomTile({
  icon, name, value, unit, status, statusTone, badge, footer, flagged, onClick, guide, className,
}: RoomTileProps) {
  const inner = (
    <>
      <span className="pb-tile__top">
        <span className="pb-tile__glyph"><Icon name={icon} size={18} /></span>
        {badge && <span className="pb-tile__badge">{badge}</span>}
      </span>
      {value != null && (
        <span className="pb-tile__value"><b>{value}</b>{unit && <i>{unit}</i>}</span>
      )}
      <span className="pb-tile__name">{name}</span>
      {status && <span className={cx('pb-tile__status', statusTone && `pb-tone--${statusTone}`)}>{status}</span>}
      {footer && <span className="pb-tile__foot">{footer}</span>}
    </>
  );
  const cls = cx('pb-tile', flagged && 'is-flagged', onClick && 'is-interactive', className);
  if (!onClick) return <div className={cls} data-guide={guide}>{inner}</div>;
  return <button type="button" className={cls} data-guide={guide} onClick={onClick}>{inner}</button>;
}

/* --------------------------------------------------------------- SpendTile */

export interface SpendTileProps {
  name: string;
  value: number;
  max?: number;
  /** Points added on this visit, still undoable. */
  added?: number;
  /** What the staff adds on top of the number, and who adds it. */
  bonus?: number;
  bonusLabel?: string;
  canAdd?: boolean;
  onAdd?: () => void;
  onUndo?: () => void;
  className?: string;
}

/**
 * One skill and the two keys that change it. The number is the point of the
 * tile, so it is set large and nothing explains it: the bar shows the room
 * left, the chip shows what the staff adds.
 */
export function SpendTile({
  name, value, max = 99, added = 0, bonus = 0, bonusLabel, canAdd, onAdd, onUndo, className,
}: SpendTileProps) {
  const maxed = value >= max;
  const withStaff = Math.min(max, value + bonus);
  return (
    <article className={cx('pb-spend', maxed && 'is-max', added > 0 && 'is-added', className)}>
      <header className="pb-spend__head">
        <span className="pb-spend__name">{name}</span>
        {added > 0 && <span className="pb-spend__added">+{added}</span>}
        {added === 0 && maxed && <span className="pb-spend__added is-max">Max</span>}
      </header>
      <span className="pb-spend__value">
        <b>{value}</b><i>/{max}</i>
      </span>
      <span className="pb-spend__bar" aria-hidden>
        <i style={{ width: `${pctOf(value, max)}%` }} />
        {bonus > 0 && (
          <em style={{ left: `${pctOf(value, max)}%`, width: `${pctOf(withStaff, max) - pctOf(value, max)}%` }} />
        )}
      </span>
      {bonus > 0 && (
        <span className="pb-spend__bonus">
          <b>{withStaff}</b> in games{bonusLabel ? ` · ${bonusLabel} +${bonus}` : ` · staff +${bonus}`}
        </span>
      )}
      <span className="pb-spend__keys">
        <button
          type="button"
          className="pb-spend__key"
          disabled={added === 0}
          aria-label={`Undo a point in ${name}`}
          onClick={onUndo}
        ><Icon name="minus" size={18} /></button>
        <button
          type="button"
          className="pb-spend__key pb-spend__key--add"
          disabled={!canAdd || maxed}
          aria-label={`Add a point to ${name}`}
          onClick={onAdd}
        ><Icon name="plus" size={18} /></button>
      </span>
    </article>
  );
}

/* ----------------------------------------------------------------- Plaque */

export interface PlaqueProps {
  /** Art in place of a glyph: a building's drawing, a crest. */
  art?: ReactNode;
  icon?: IconName;
  label: string;
  /** The plaque's number, in the numeral face. */
  value?: ReactNode;
  unit?: string;
  note?: ReactNode;
  tone?: 'positive' | 'warning' | 'negative' | 'info';
  /** Pips, a bar, a badge: whatever says the state in one glance. */
  meta?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  guide?: string;
  className?: string;
}

/** A compact thing on a wall: a building on the campus row, a state, a seat. */
export function Plaque({
  art, icon, label, value, unit, note, tone, meta, selected, onClick, guide, className,
}: PlaqueProps) {
  const inner = (
    <>
      {(art || icon) && <span className="pb-plaque__art">{art ?? (icon && <Icon name={icon} size={18} />)}</span>}
      <span className="pb-plaque__label">{label}</span>
      {value != null && <span className="pb-plaque__value"><b>{value}</b>{unit && <i>{unit}</i>}</span>}
      {note && <span className={cx('pb-plaque__note', tone && `pb-tone--${tone}`)}>{note}</span>}
      {meta && <span className="pb-plaque__meta">{meta}</span>}
    </>
  );
  const cls = cx('pb-plaque', selected && 'is-selected', onClick && 'is-interactive', className);
  if (!onClick) return <div className={cls} data-guide={guide}>{inner}</div>;
  return (
    <button type="button" className={cls} data-guide={guide} aria-pressed={selected != null ? !!selected : undefined} onClick={onClick}>
      {inner}
    </button>
  );
}

/* --------------------------------------------------------------- NamePlate */

export interface NamePlateProps {
  /** A monogram, a portrait. */
  mark?: ReactNode;
  name: ReactNode;
  role: ReactNode;
  /** The rating, set large at the right. */
  value?: ReactNode;
  unit?: string;
  badge?: ReactNode;
  vacant?: boolean;
  onClick?: () => void;
  guide?: string;
  className?: string;
}

/** A person's plate on a door: who they are, what they run, how good they are. */
export function NamePlate({
  mark, name, role, value, unit, badge, vacant, onClick, guide, className,
}: NamePlateProps) {
  const inner = (
    <>
      {mark && <span className="pb-plate__mark">{mark}</span>}
      <span className="pb-plate__who">
        <span className="pb-plate__role">{role}</span>
        <span className="pb-plate__name">{name}</span>
        {badge && <span className="pb-plate__badge">{badge}</span>}
      </span>
      {value != null && <span className="pb-plate__value"><b>{value}</b>{unit && <i>{unit}</i>}</span>}
      {onClick && <Icon name="chevron-right" size={18} className="pb-plate__chevron" />}
    </>
  );
  const cls = cx('pb-plate', vacant && 'is-vacant', onClick && 'is-interactive', className);
  if (!onClick) return <div className={cls} data-guide={guide}>{inner}</div>;
  return <button type="button" className={cls} data-guide={guide} onClick={onClick}>{inner}</button>;
}
