// controls.tsx
// The design system's inputs: the segmented control, option cards, steps,
// chips, switches, steppers and text fields.

import { useId, type ChangeEventHandler, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon.js';
import { cx } from './core.js';

/* -------------------------------------------------------- SegmentedControl */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** A count, or true for a dot. */
  badge?: number | string | true;
}

/** Two to four views of one thing, or one value out of a few. */
export function SegmentedControl<T extends string>({
  value, options, onChange, label, kind = 'tabs', className,
}: {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  label: string;
  /** tabs switch a view (the default); radio sets a value. */
  kind?: 'tabs' | 'radio';
  className?: string;
}) {
  const radio = kind === 'radio';
  return (
    <div className={cx('pb-seg', className)} role={radio ? 'radiogroup' : 'tablist'} aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            className={cx('pb-seg__opt', on && 'is-active')}
            role={radio ? 'radio' : 'tab'}
            aria-checked={radio ? on : undefined}
            aria-selected={radio ? undefined : on}
            onClick={() => onChange(o.value)}
          >
            {o.label}
            {o.badge === true
              ? <span className="pb-seg__badge is-dot" role="img" aria-label="needs attention" />
              : o.badge != null ? <span className="pb-seg__badge">{o.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------- OptionCard / OptionGroup */

export function OptionCard({
  title, hint, meta, badge, selected, disabled, role = 'radio', onSelect, className,
}: {
  title: ReactNode; hint?: ReactNode; meta?: ReactNode;
  /** A small positive tag under the title: "Matches focus". */
  badge?: ReactNode;
  selected?: boolean; disabled?: boolean; role?: 'radio' | 'checkbox';
  onSelect?: () => void; className?: string;
}) {
  const sel = !!selected;
  return (
    <button
      type="button"
      role={role}
      aria-checked={sel}
      disabled={disabled}
      onClick={onSelect}
      className={cx('pb-option', sel && 'is-selected', className)}
    >
      <span className="pb-option__radio" aria-hidden>{sel && <Icon name="check" size={14} />}</span>
      <span className="pb-option__body">
        <span className="pb-option__title">{title}</span>
        {hint && <span className="pb-option__hint">{hint}</span>}
        {badge && <span className="pb-option__badge">{badge}</span>}
      </span>
      {meta != null && <span className="pb-option__meta">{meta}</span>}
    </button>
  );
}

export function OptionGroup({
  label, columns, children, className,
}: { label: string; columns?: 1 | 2 | 3; children: ReactNode; className?: string }) {
  return (
    <div
      className={cx('pb-options', columns && columns > 1 ? `pb-options--${columns}` : null, className)}
      role="radiogroup"
      aria-label={label}
    >{children}</div>
  );
}

/* -------------------------------------------------------------------- Step */

/** One numbered step of a short sequence, with the choice made at the right. */
export function Step({
  number, title, state = 'current', summary, children, className,
}: {
  number: number; title: string; state?: 'current' | 'done' | 'upcoming';
  summary?: ReactNode; children?: ReactNode; className?: string;
}) {
  return (
    <section className={cx('pb-step', `is-${state}`, className)}>
      <header className="pb-step__head">
        <span className="pb-step__num" aria-hidden>{state === 'done' ? <Icon name="check" size={14} /> : String(number)}</span>
        <span className="pb-step__title">
          <span className="pb-sr">{`Step ${number}${state === 'done' ? ', done: ' : ': '}`}</span>{title}
        </span>
        {summary && <span className="pb-step__summary">{summary}</span>}
      </header>
      {children && state !== 'upcoming' && <div className="pb-step__body">{children}</div>}
    </section>
  );
}

/* -------------------------------------------------------------------- Chip */

export function Chip({
  selected, count, icon, onClick, children, className,
}: {
  selected?: boolean; count?: number; icon?: IconName; onClick?: () => void; children: ReactNode; className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      onClick={onClick}
      className={cx('pb-chip', selected && 'is-selected', className)}
    >
      {selected ? <Icon name="check" size={14} /> : icon ? <Icon name={icon} size={14} /> : null}
      <span>{children}</span>
      {count != null && <span className="pb-chip__count">{count}</span>}
    </button>
  );
}

/** A row of chips that scrolls sideways rather than wrapping. */
export function Chips({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div className={cx('pb-chips', className)} role="group" aria-label={label}>{children}</div>;
}

/* ------------------------------------------------------------------ Switch */

export function Switch({
  label, description, checked, disabled, onChange, className,
}: {
  label: ReactNode; description?: ReactNode; checked?: boolean; disabled?: boolean;
  onChange?: (checked: boolean) => void; className?: string;
}) {
  const id = useId();
  return (
    <label className={cx('pb-switch', disabled && 'is-disabled', className)} htmlFor={id}>
      <span className="pb-switch__text">
        <span className="pb-switch__label">{label}</span>
        {description && <span className="pb-switch__desc">{description}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.currentTarget.checked)}
        className="pb-switch__input"
      />
      <span className="pb-switch__track" aria-hidden><span className="pb-switch__thumb" /></span>
    </label>
  );
}

/* ----------------------------------------------------------------- Stepper */

export function Stepper({
  label, hint, value, min = -Infinity, max = Infinity, step = 1, format, onChange, className,
}: {
  label: string; hint?: ReactNode; value: number; min?: number; max?: number; step?: number;
  format?: (v: number) => string; onChange?: (v: number) => void; className?: string;
}) {
  const set = (n: number): void => { onChange?.(Math.max(min, Math.min(max, n))); };
  return (
    <div className={cx('pb-stepper', className)} role="group" aria-label={label}>
      <span className="pb-stepper__text">
        <span className="pb-stepper__label">{label}</span>
        {hint && <span className="pb-stepper__hint">{hint}</span>}
      </span>
      <span className="pb-stepper__control">
        <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => set(value - step)}>
          <Icon name="minus" size={16} />
        </button>
        <output aria-live="polite">{format ? format(value) : String(value)}</output>
        <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => set(value + step)}>
          <Icon name="plus" size={16} />
        </button>
      </span>
    </div>
  );
}

/* ------------------------------------------------------ TextField, Search */

export function TextField({
  label, value, placeholder, hint, error, maxLength, type = 'text', onChange, className, autoFocus,
}: {
  label: string; value?: string; placeholder?: string; hint?: ReactNode; error?: ReactNode; maxLength?: number;
  type?: string; onChange?: ChangeEventHandler<HTMLInputElement>; className?: string; autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <label className={cx('pb-field', error ? 'has-error' : null, className)} htmlFor={id}>
      <span className="pb-field__label">{label}</span>
      <input
        id={id}
        className="pb-field__input"
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={onChange}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
      />
      {error
        ? <span className="pb-field__error"><Icon name="cross-circled" size={14} />{error}</span>
        : hint ? <span className="pb-field__hint">{hint}</span> : null}
    </label>
  );
}

export function SearchField({
  label = 'Search', placeholder = 'Search', value, onChange, trailing, className,
}: {
  label?: string; placeholder?: string; value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>; trailing?: ReactNode; className?: string;
}) {
  return (
    <label className={cx('pb-search', className)}>
      <Icon name="search" size={20} />
      <input type="search" aria-label={label} placeholder={placeholder} value={value} onChange={onChange} />
      {trailing}
    </label>
  );
}
