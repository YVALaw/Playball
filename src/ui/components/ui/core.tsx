// core.tsx
// The design system's small parts: buttons, the two-press confirm, badges,
// tags, deltas, meters, level pips and stat tiles. Styled by
// design/components.css; every class starts with pb-.

import {
  useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type ReactNode,
} from 'react';
import { Icon, type IconName } from './Icon.js';
import { armedLock } from './armed.js';

/** Status and data tones. Status colours are fixed: the accent never means good or bad. */
export type Tone = 'neutral' | 'accent' | 'positive' | 'warning' | 'negative' | 'info';
/** The fills a meter segment may use. */
export type FillTone = 'accent' | 'ink' | 'positive' | 'warning' | 'negative' | 'info';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function pctOf(value: number, max: number): number {
  const m = max || 100;
  return Math.max(0, Math.min(100, ((Number(value) || 0) / m) * 100));
}

/* ------------------------------------------------------------------ Button */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: the one command on a screen. secondary: outlined. tonal: in-card actions. quiet: text only. danger: releasing, cancelling. */
  variant?: 'primary' | 'secondary' | 'tonal' | 'quiet' | 'danger';
  /** md is 48px tall; sm is 40px, for actions inside a card. */
  size?: 'md' | 'sm';
  icon?: IconName;
  iconAfter?: IconName;
  /** The cost or the duration, at the right of a block button: "$450k", "5 weeks". */
  meta?: ReactNode;
  block?: boolean;
}

export function Button({
  variant = 'secondary', size = 'md', icon, iconAfter, meta, block, children, className, type, ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type ?? 'button'}
      className={cx('pb-btn', `pb-btn--${variant}`, `pb-btn--${size}`,
        block && 'pb-btn--block', meta != null && 'pb-btn--has-meta', className)}
    >
      {icon && <Icon name={icon} size={16} />}
      <span className="pb-btn__label">{children}</span>
      {meta != null && <span className="pb-btn__meta">{meta}</span>}
      {iconAfter && <Icon name={iconAfter} size={16} />}
    </button>
  );
}

/* ------------------------------------------------------------- IconButton */

export function IconButton({
  icon, art, label, badge, tone, size = 20, onClick, className, ...rest
}: {
  icon: IconName;
  /** Drawn art in place of the glyph: the inbox's ball. The glyph stays the fallback. */
  art?: ReactNode;
  label: string; badge?: number | string; tone?: 'quiet'; size?: number;
  onClick?: () => void; className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  const shown = typeof badge === 'number' ? (badge > 9 ? '9+' : badge > 0 ? String(badge) : '') : badge;
  return (
    <button
      {...rest}
      type="button"
      onClick={onClick}
      aria-label={shown ? `${label}, ${badge} new` : label}
      className={cx('pb-iconbtn', tone && `pb-iconbtn--${tone}`, className)}
    >
      {art ?? <Icon name={icon} size={size} />}
      {shown ? <span className="pb-iconbtn__badge" aria-hidden>{shown}</span> : null}
    </button>
  );
}

/* ---------------------------------------------------------- ConfirmButton */

export interface ConfirmButtonProps {
  /** Verb first, with the object: "Upgrade to Level 2". */
  idle: ReactNode;
  /** The second-press label: "Tap again to confirm". */
  armed: ReactNode;
  done?: ReactNode;
  failed?: ReactNode;
  /** Shown with idle: the price. */
  meta?: ReactNode;
  /** Shown while armed: the consequence, "$33k left after". */
  armedMeta?: ReactNode;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger' | 'tonal';
  size?: 'md' | 'sm';
  block?: boolean;
  disabled?: boolean;
  /** Return false when the attempt did not come off. */
  onConfirm: () => boolean | void;
  className?: string;
}

/**
 * A press that has to be meant: the first arms and restates the cost, the
 * second acts. Touching anything else stands it down, and only one control in
 * the app is armed at a time (see armed.ts). No timer: a player reading a cost
 * should not be racing one.
 */
export function ConfirmButton({
  idle, armed, done, failed, meta, armedMeta, icon, variant = 'primary', size = 'md', block,
  disabled, onConfirm, className,
}: ConfirmButtonProps) {
  const [state, setState] = useState<'idle' | 'armed' | 'done' | 'failed'>('idle');
  const me = useRef(Symbol('confirm'));
  const btn = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const id = me.current;
    return () => { if (armedLock.current?.id === id) armedLock.current = null; };
  }, []);

  useEffect(() => {
    if (state !== 'armed') return undefined;
    const stand = (e: PointerEvent): void => {
      if (btn.current && e.target instanceof Node && btn.current.contains(e.target)) return;
      if (armedLock.current?.id === me.current) armedLock.current = null;
      setState('idle');
    };
    document.addEventListener('pointerdown', stand, true);
    return () => document.removeEventListener('pointerdown', stand, true);
  }, [state]);

  const press = (): void => {
    if (state === 'done') return;
    if (state !== 'armed') {
      armedLock.current?.disarm();
      armedLock.current = { id: me.current, disarm: () => setState('idle') };
      setState('armed');
      return;
    }
    armedLock.current = null;
    const ok = onConfirm();
    if (ok === false) { setState(failed ? 'failed' : 'idle'); return; }
    setState(done ? 'done' : 'idle');
  };

  const label = state === 'armed' ? armed
    : state === 'done' ? (done ?? idle)
      : state === 'failed' ? (failed ?? idle)
        : idle;
  const shownMeta = state === 'armed' ? armedMeta : state === 'idle' ? meta : undefined;
  const shownIcon: IconName | undefined = state === 'done' ? 'check'
    : state === 'failed' ? 'cross-circled' : state === 'idle' ? icon : undefined;

  return (
    <button
      ref={btn}
      type="button"
      disabled={disabled || state === 'done'}
      aria-live={state === 'armed' ? 'polite' : undefined}
      onClick={press}
      className={cx('pb-btn', `pb-btn--${variant}`, `pb-btn--${size}`, block && 'pb-btn--block',
        shownMeta != null && 'pb-btn--has-meta', 'pb-confirm', `is-${state}`, className)}
    >
      {shownIcon && <Icon name={shownIcon} size={16} />}
      <span className="pb-btn__label">{label}</span>
      {shownMeta != null && <span className="pb-btn__meta">{shownMeta}</span>}
    </button>
  );
}

/* ------------------------------------------------------------ StatusBadge */

const TONE_ICON: Record<Tone, IconName | null> = {
  positive: 'check', warning: 'alert', negative: 'cross-circled', info: 'info', accent: null, neutral: null,
};

/** A state, said three ways at once: an icon, a word and a colour. */
export function StatusBadge({
  tone = 'neutral', icon, size, children, className,
}: { tone?: Tone; icon?: IconName | false; size?: 'md' | 'lg'; children: ReactNode; className?: string }) {
  const glyph = icon === false ? null : (icon ?? TONE_ICON[tone]);
  return (
    <span className={cx('pb-badge', `pb-badge--${tone}`, size === 'lg' && 'pb-badge--lg', className)}>
      {glyph && <Icon name={glyph} size={14} />}
      <span>{children}</span>
    </span>
  );
}

/* -------------------------------------------------------------------- Tag */

export type TagTone = 'you' | 'positive' | 'warning' | 'negative';

/** A short fact about a thing: a position, a class year, "You". */
export function Tag(
  { tone, title, children, className }: { tone?: TagTone; title?: string; children: ReactNode; className?: string },
) {
  return <span className={cx('pb-tag', tone && `pb-tag--${tone}`, className)} title={title}>{children}</span>;
}

/* ------------------------------------------------------------------ Delta */

/** A change with its direction judged: green when better, red when worse. */
export function Delta({
  value, unit, better = 'up', text, icon, className,
}: { value: number; unit?: string; better?: 'up' | 'down'; text?: string; icon?: false; className?: string }) {
  const v = Number(value) || 0;
  const good = v === 0 ? null : (v > 0) === (better === 'up');
  const tone = v === 0 ? 'neutral' : good ? 'positive' : 'negative';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const shown = text ?? (v === 0 ? 'No change' : `${sign}${Math.abs(v)}${unit ?? ''}`);
  return (
    <span
      className={cx('pb-delta', `pb-delta--${tone}`, className)}
      aria-label={shown + (good === true ? ', better' : good === false ? ', worse' : '')}
    >
      {v === 0 || icon === false ? null : <Icon name={v > 0 ? 'arrow-up' : 'arrow-down'} size={12} />}
      <span aria-hidden>{shown}</span>
    </span>
  );
}

/* ------------------------------------------------------------ Stars, Medal */

export function Stars(
  { value, max = 5, size = 14, label, className }: { value: number; max?: number; size?: number; label?: string; className?: string },
) {
  const v = Math.max(0, Math.min(max, Math.round(value || 0)));
  return (
    <span className={cx('pb-stars', className)} role="img" aria-label={`${label ? `${label}: ` : ''}${v} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Icon key={i} name={i < v ? 'star-filled' : 'star'} size={size} className={i < v ? 'is-on' : undefined} />
      ))}
    </span>
  );
}

export function Medal(
  { metal = 'gold', size = 40, label, className }: { metal?: 'gold' | 'silver' | 'bronze'; size?: number; label?: string; className?: string },
) {
  return (
    <span
      className={cx('pb-medal', `pb-medal--${metal}`, className)}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Icon name="star-filled" size={Math.round(size * 0.5)} />
    </span>
  );
}

/* --------------------------------------------------------------- Monogram */

function initials(name?: string): string {
  return String(name ?? '').split(/\s+/).filter(Boolean).map((w) => w.charAt(0)).slice(0, 2).join('').toUpperCase();
}

/** A person without a drawn face (a coach on the staff), or an open seat. */
export function Monogram({
  name, icon, vacant, size = 40, tone, label, className,
}: { name?: string; icon?: IconName; vacant?: boolean; size?: number; tone?: 'neutral' | 'info'; label?: string; className?: string }) {
  return (
    <span
      className={cx('pb-mono', tone && `pb-mono--${tone}`, vacant && 'is-vacant', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {vacant ? <Icon name="plus" size={Math.round(size * 0.45)} />
        : icon ? <Icon name={icon} size={Math.round(size * 0.5)} />
          : initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ Meter */

export interface MeterSegment { value: number; label: string; tone?: FillTone; display?: string }
export interface MeterMarker {
  at: number;
  label?: string;
  /** The whole caption, in place of "at label": for a marker whose number needs its unit. */
  text?: ReactNode;
}
export interface MeterProps {
  value?: number;
  max?: number;
  label?: ReactNode;
  /** The right side of the head. Defaults to "value / max". */
  valueText?: ReactNode;
  tone?: FillTone;
  size?: 'sm' | 'md' | 'lg';
  /** A split bar: the parts add up to the whole. */
  segments?: MeterSegment[];
  legend?: boolean;
  /** Thresholds drawn across the bar and labelled under it. */
  markers?: MeterMarker[];
  ariaLabel?: string;
  ariaValueText?: string;
  className?: string;
}

/** A quantity against its scale, always with the scale printed. */
export function Meter({
  value, max = 100, label, valueText, tone = 'accent', size = 'md', segments, legend,
  markers = [], ariaLabel, ariaValueText, className,
}: MeterProps) {
  const id = useId();
  const total = segments ? segments.reduce((n, s) => n + (Number(s.value) || 0), 0) : (Number(value) || 0);
  const hasHead = label != null || valueText != null;
  const fillTone = (s: MeterSegment, i: number): FillTone => s.tone ?? (i === 0 ? 'accent' : 'ink');
  return (
    <span className={cx('pb-meter', `pb-meter--${size}`, className)}>
      {hasHead && (
        <span className="pb-meter__head">
          {label != null ? <span className="pb-meter__label" id={id}>{label}</span> : <span />}
          <span className="pb-meter__value">
            {valueText ?? <>{total}<small> / {max}</small></>}
          </span>
        </span>
      )}
      <span className="pb-meter__bar">
        <span
          className="pb-meter__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={total}
          aria-valuetext={ariaValueText}
          aria-labelledby={label != null ? id : undefined}
          aria-label={label == null ? ariaLabel : undefined}
        >
          {segments
            ? segments.map((s, i) => (
              <span key={i} className={cx('pb-meter__fill', `pb-fill--${fillTone(s, i)}`)} style={{ width: `${pctOf(s.value, max)}%` }} />
            ))
            : <span className={cx('pb-meter__fill', `pb-fill--${tone}`)} style={{ width: `${pctOf(total, max)}%` }} />}
        </span>
        {markers.map((m, i) => (
          <span key={i} className="pb-meter__marker" style={{ left: `${pctOf(m.at, max)}%` }} aria-hidden />
        ))}
      </span>
      {markers.some((m) => m.label || m.text) && (
        <span className="pb-meter__ticks" aria-hidden>
          {markers.map((m, i) => {
            const p = pctOf(m.at, max);
            const shift = p < 12 ? '0' : p > 88 ? '-100%' : '-50%';
            return (
              <span key={i} className="pb-meter__tick" style={{ left: `${p}%`, transform: `translateX(${shift})` }}>
                {m.text ?? <><b>{m.at}</b> {m.label}</>}
              </span>
            );
          })}
        </span>
      )}
      {segments && legend !== false && (
        <span className="pb-meter__legend">
          {segments.map((s, i) => (
            <span key={i} className="pb-meter__key">
              <i className={cx('pb-swatch', `pb-fill--${fillTone(s, i)}`)} />
              {s.label}<b>{s.display ?? String(s.value)}</b>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------- LevelPips */

/** A building's level as filled pips, with the level in words. */
export function LevelPips({
  level, max = 3, label, text, emptyText, showText = true, size = 'md', layout = 'inline', className,
}: {
  level: number; max?: number; label?: string; text?: string; emptyText?: string;
  showText?: boolean; size?: 'md' | 'lg'; layout?: 'inline' | 'stacked'; className?: string;
}) {
  const lv = Math.max(0, Math.min(max, level || 0));
  const maxed = lv >= max;
  const shown = text ?? (lv === 0 ? (emptyText ?? 'Not built') : maxed ? `Level ${lv} · Max` : `Level ${lv} of ${max}`);
  return (
    <span
      className={cx('pb-pips', size === 'lg' && 'pb-pips--lg', layout === 'stacked' && 'pb-pips--stacked', maxed && 'is-max', className)}
      role="img"
      aria-label={`${label ? `${label}: ` : ''}${lv === 0 ? (emptyText ?? 'not built') : `level ${lv} of ${max}`}`}
    >
      <span className="pb-pips__track" aria-hidden>
        {Array.from({ length: max }, (_, i) => <i key={i} className={i < lv ? 'is-on' : undefined} />)}
      </span>
      {showText && <span className="pb-pips__text" aria-hidden>{shown}</span>}
    </span>
  );
}

/* -------------------------------------------------------------- RatingRow */

/** One rating on its 0–100 bar, with the potential ghosted ahead of it. */
export function RatingRow({
  label, value, potential, max = 100, className,
}: { label: string; value: number; potential?: number; max?: number; className?: string }) {
  const v = value || 0;
  const pot = potential && potential > v ? potential : undefined;
  return (
    <span className={cx('pb-rating', className)}>
      <span className="pb-rating__label">{label}</span>
      <span className="pb-rating__track" role="img" aria-label={`${label} ${v}${pot ? `, potential ${pot}` : ''} of ${max}`}>
        <span className="pb-rating__fill" style={{ width: `${pctOf(v, max)}%` }} />
        {pot && <span className="pb-rating__ghost" style={{ left: `${pctOf(v, max)}%`, width: `${pctOf(pot, max) - pctOf(v, max)}%` }} />}
      </span>
      <span className="pb-rating__value">{v}{pot && <small>{'→'} {pot}</small>}</span>
    </span>
  );
}

/* ------------------------------------------------------- StatTile / Group */

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** The scale or unit, set small beside the value: "/100", "/yr". */
  unit?: string;
  note?: ReactNode;
  noteTone?: 'positive' | 'warning' | 'negative' | 'info' | 'muted';
  delta?: number;
  deltaUnit?: string;
  better?: 'up' | 'down';
  /**
   * When the number has the rest of itself somewhere: the tile becomes a
   * button and says so. A count is the shortest possible summary of a list,
   * and the list is what the player actually wanted.
   */
  onClick?: () => void;
  className?: string;
}

export function StatTile({ label, value, unit, note, noteTone, delta, deltaUnit, better, onClick, className }: StatTileProps) {
  const body = (
    <>
      <span className="pb-stat__label">{label}</span>
      <span className="pb-stat__value">{value}{unit && <small>{unit}</small>}</span>
      {(note || delta != null) && (
        <span className="pb-stat__note">
          {delta != null && <Delta value={delta} unit={deltaUnit} better={better} />}
          {note && <span className={noteTone ? `pb-tone--${noteTone}` : undefined}>{note}</span>}
        </span>
      )}
    </>
  );
  if (!onClick) return <div className={cx('pb-stat', className)}>{body}</div>;
  return (
    <button type="button" className={cx('pb-stat', 'is-interactive', className)} onClick={onClick}>
      {body}
      <Icon name="chevron-right" size={16} className="pb-stat__chevron" />
    </button>
  );
}

export function StatGroup(
  { items, children, size, label, className }:
  { items?: StatTileProps[]; children?: ReactNode; size?: 'md' | 'sm'; label?: string; className?: string },
) {
  return (
    <div className={cx('pb-stats', size === 'sm' && 'pb-stats--sm', className)} role="group" aria-label={label}>
      {items ? items.map((it, i) => <StatTile key={i} {...it} />) : children}
    </div>
  );
}
