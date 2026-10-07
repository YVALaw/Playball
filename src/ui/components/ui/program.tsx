// program.tsx
// The Office rooms' own parts: the coaching staff, the coach's sheet, the
// campus and the budget. Drawn from the UI clarity review
// (design/UI Clarity Review/Staff and Facilities.dc.html, 2026-09-25), which
// asked for less prose and more state you can read at a glance: a card for
// every seat, a ladder for every building, a bar for the money. Styled by
// design/office.css.
//
// Each part still answers the four questions every card in the Office
// answers: what is it, what state is it in, what would change, and what do I
// do and what does it cost. Numbers only ever come in from the caller, which
// reads them off the engine.

import { useId, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon.js';
import { Button, ConfirmButton, Monogram, StatusBadge, cx, pctOf } from './core.js';
import { showValue, type CompareRow } from './data.js';
import { FacilityArt } from '../../ProgramBits.js';
import { dollars, type Building } from '../../../engine/economy.js';

/* ----------------------------------------------------------------- SubHead */

/**
 * The line over a group: its name, a muted aside after a dot ("Focus · always
 * on"), and a fact at the right ("Change any time", "Cheapest first").
 */
export function SubHead({
  title, muted, aside, size = 'sm', className,
}: { title: string; muted?: string; aside?: ReactNode; size?: 'sm' | 'md'; className?: string }) {
  const Tag = size === 'md' ? 'h2' : 'h3';
  return (
    <div className={cx('pb-subhead', size === 'md' && 'pb-subhead--md', className)}>
      <Tag className="pb-subhead__title">{title}{muted && <span> · {muted}</span>}</Tag>
      {aside != null && <span className="pb-subhead__aside">{aside}</span>}
    </div>
  );
}

/* ----------------------------------------------------------- HowCoachHelps */

/**
 * The two layers of a coach, as one line of boxes: the focus that is always
 * on, the one assignment a season on up to three men, and the reason to line
 * them up. The mechanics behind them are in engine/staffProjects.ts (a
 * matching focus adds one to each man's season gain).
 */
export function HowCoachHelps({ className }: { className?: string }) {
  return (
    <section className={cx('pb-howto', className)} aria-label="How a coach helps">
      <span className="pb-howto__title">How a coach helps</span>
      <div className="pb-howto__row">
        <span className="pb-howto__box"><b>Focus</b><small>Always on, all year</small></span>
        <span className="pb-howto__op" aria-hidden>+</span>
        <span className="pb-howto__box"><b>Season work</b><small>Up to 3 players</small></span>
        <Icon name="arrow-right" size={14} className="pb-howto__op" />
        <span className="pb-howto__box is-accent"><b>Match them</b><small>+1 each</small></span>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- NeedsList */

export interface NeedItem {
  key: string;
  tone: 'warning' | 'info';
  icon: IconName;
  text: ReactNode;
  /** One word at the right: "Assign", "Review", "Hire". */
  cta: string;
  onClick: () => void;
}

/** What in the room is waiting on the coach, one tinted line each. Nothing, when nothing is. */
export function NeedsList({ items, title = 'Needs you', className }: { items: NeedItem[]; title?: string; className?: string }) {
  if (items.length === 0) return null;
  return (
    <section className={cx('pb-needs', className)} aria-label={title}>
      <span className="pb-needs__title">{title}</span>
      {items.map((n) => (
        <button key={n.key} type="button" className={cx('pb-needs__row', `is-${n.tone}`)} onClick={n.onClick}>
          <Icon name={n.icon} size={15} className="pb-needs__icon" />
          <span className="pb-needs__text">{n.text}</span>
          <span className="pb-needs__cta">{n.cta}</span>
        </button>
      ))}
    </section>
  );
}

/* ---------------------------------------------------------------- WeekPips */

/** A project's weeks as one pip each: done, the week under way, and the rest. */
export function WeekPips({
  done, total, size = 'sm', paused, label, className,
}: { done: number; total: number; size?: 'sm' | 'md'; paused?: boolean; label?: string; className?: string }) {
  const t = Math.max(1, Math.round(total));
  const d = Math.max(0, Math.min(t, Math.round(done)));
  const style: CSSProperties = { gridTemplateColumns: `repeat(${t}, minmax(0, 1fr))` };
  return (
    <span
      className={cx('pb-weeks', size === 'md' && 'pb-weeks--md', paused && 'is-paused', className)}
      style={style}
      role="img"
      aria-label={label ?? `Week ${Math.min(t, d + 1)} of ${t}${paused ? ', paused' : ''}`}
    >
      {Array.from({ length: t }, (_, i) => <i key={i} className={i < d ? 'is-done' : i === d ? 'is-now' : undefined} />)}
    </span>
  );
}

/* --------------------------------------------------------------- StaffCard */

export interface StaffCardProps {
  /** "Pitching coach": set small and in capitals over the name. */
  roleLabel: string;
  name?: string;
  /** One line under the name: "Player developer · Age 58 · Season 4 here". */
  spec?: ReactNode;
  rating?: number;
  focus?: ReactNode;
  /** The strip's second cell: the season work's name, or why there is none. */
  project?: { text: ReactNode; tone?: 'warning' | 'muted' };
  /** Running work: who and what it can earn, the week, and a pip per week. */
  progress?: { who: ReactNode; when: ReactNode; done: number; total: number; paused?: boolean };
  /** "$210k", printed as "$210k a year". */
  wage?: string;
  contract?: { text: ReactNode; ending?: boolean };
  vacant?: boolean;
  /** For an open seat: what the role does for you, in one sentence. */
  pitch?: ReactNode;
  ctaLabel?: string;
  onOpen?: () => void;
  className?: string;
}

/**
 * One seat in the staff room. A filled seat is the man, his focus and his
 * project side by side, the weeks the project has run, and what he costs and
 * until when. An open seat is a dashed outline with one line about the role
 * and the way to its candidates.
 */
export function StaffCard({
  roleLabel, name, spec, rating, focus, project, progress, wage, contract, vacant, pitch, ctaLabel,
  onOpen, className,
}: StaffCardProps) {
  if (vacant) {
    return (
      <article className={cx('pb-seat', 'is-vacant', className)} aria-label={`${roleLabel}, open seat`}>
        <button type="button" className="pb-seat__head" onClick={onOpen} aria-haspopup="dialog">
          <Monogram vacant size={44} />
          <span className="pb-seat__who">
            <span className="pb-seat__role">{roleLabel}</span>
            <span className="pb-seat__name">Open seat</span>
          </span>
          <Icon name="chevron-right" size={20} className="pb-seat__chevron" />
        </button>
        {pitch && <p className="pb-seat__pitch">{pitch}</p>}
        <div className="pb-seat__cta">
          <Button variant="tonal" block onClick={onOpen}>{ctaLabel ?? 'See candidates'}</Button>
        </div>
      </article>
    );
  }

  return (
    <article className={cx('pb-seat', className)} aria-label={`${roleLabel}, ${name ?? ''}`}>
      <button type="button" className="pb-seat__head" onClick={onOpen} aria-haspopup="dialog">
        <Monogram name={name} size={44} />
        <span className="pb-seat__who">
          <span className="pb-seat__role">{roleLabel}</span>
          <span className="pb-seat__name">{name}</span>
          {spec && <span className="pb-seat__spec">{spec}</span>}
        </span>
        {rating != null && <span className="pb-seat__rating"><b>{rating}</b><small>of 100</small></span>}
        <Icon name="chevron-right" size={20} className="pb-seat__chevron" />
      </button>
      <div className="pb-seat__strip">
        <span className="pb-seat__cell"><small>Focus · always on</small><b>{focus}</b></span>
        <span className="pb-seat__cell">
          <small>Season work</small>
          <b className={project?.tone ? `is-${project.tone}` : undefined}>{project?.text}</b>
        </span>
      </div>
      {progress && (
        <div className="pb-seat__progress">
          <span className="pb-seat__progress-top">
            <span>{progress.who}</span>
            <span className={progress.paused ? 'is-warning' : undefined}>{progress.when}</span>
          </span>
          <WeekPips done={progress.done} total={progress.total} paused={progress.paused} />
        </div>
      )}
      <footer className="pb-seat__foot">
        <span>{wage && <><b>{wage}</b> a year</>}</span>
        {contract && (
          <span className={cx('pb-seat__contract', contract.ending && 'is-ending')}>
            {contract.ending && <Icon name="clock" size={13} />}{contract.text}
          </span>
        )}
      </footer>
    </article>
  );
}

/* --------------------------------------------------------- ProjectProgress */

export interface ProjectFact {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  noteTone?: 'positive' | 'warning';
}

export interface ProjectProgressProps {
  /** A face for a man, a globe for a state. */
  lead: ReactNode;
  name: ReactNode;
  /** "Command lab · Starting pitcher · Sophomore". */
  sub?: ReactNode;
  done: number;
  total: number;
  /** The strip under the pips: if it works, the chance, the week. */
  facts: ProjectFact[];
  /** Why the weeks are not moving, when they are not. */
  paused?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Running work: who it is about, a pip per week, and what it can still earn. */
export function ProjectProgress({
  lead, name, sub, done, total, facts, paused, children, className,
}: ProjectProgressProps) {
  return (
    <section className={cx('pb-proj', className)} aria-label="Season work">
      <header className="pb-proj__head">
        {lead}
        <span className="pb-proj__who">
          <b>{name}</b>
          {sub && <span>{sub}</span>}
        </span>
      </header>
      <WeekPips done={done} total={total} size="md" paused={paused != null && paused !== false} />
      <div className="pb-proj__facts">
        {facts.map((f, i) => (
          <span key={i} className="pb-proj__fact">
            <small>{f.label}</small>
            <b>{f.value}</b>
            {f.note && <small className={f.noteTone ? `is-${f.noteTone}` : undefined}>{f.note}</small>}
          </span>
        ))}
      </div>
      {paused != null && paused !== false && (
        <p className="pb-proj__paused"><Icon name="pause" size={14} />{paused}</p>
      )}
      {children}
    </section>
  );
}

/* -------------------------------------------------------------- FocusChips */

/** One standing choice out of a few, as a wrap of pills. */
export function FocusChips<T extends string>({
  label, value, options, onChange, disabled, className,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('pb-focus', className)} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            className={cx('pb-focus__chip', on && 'is-on')}
            onClick={() => onChange(o.value)}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- KindTiles */

/**
 * The project's kind as a row of tiles. The "Matches focus" badge keeps its
 * room on every tile, shown or not, so changing the focus above never moves
 * the list below.
 */
export function KindTiles<T extends string>({
  label, value, options, onChange, disabled, className,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; meta?: ReactNode; match?: boolean }>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('pb-kinds', className)} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            className={cx('pb-kind', on && 'is-on')}
            onClick={() => onChange(o.value)}
          >
            <b>{o.label}</b>
            {o.meta != null && <small>{o.meta}</small>}
            <span className={cx('pb-kind__badge', !o.match && 'is-hidden')} aria-hidden={!o.match}>Matches focus</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- PickList */

export interface PickItem { id: string; name: string; sub?: ReactNode; value: ReactNode; disabled?: boolean }

/**
 * Pick up to `max` from a list headed by what the number means. At the max
 * the other rows only grey out, so nothing moves.
 */
export function PickList({
  label, head, items, values, max, onToggle, disabled, className,
}: {
  label: string;
  head: [string, string];
  items: PickItem[];
  values: readonly string[];
  max: number;
  onToggle: (id: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('pb-pick', className)} role="group" aria-label={label}>
      <div className="pb-pick__head" aria-hidden><span>{head[0]}</span><span>{head[1]}</span></div>
      {items.map((p) => {
        const on = values.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            disabled={disabled || p.disabled || (!on && values.length >= max)}
            className={cx('pb-pick__row', on && 'is-on')}
            onClick={() => onToggle(p.id)}
          >
            <span className="pb-pick__check" aria-hidden>{on && <Icon name="check" size={14} />}</span>
            <span className="pb-pick__who"><b>{p.name}</b>{p.sub && <small>{p.sub}</small>}</span>
            <span className="pb-pick__value"><b>{p.value}</b></span>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- SkillBars */

/** A coach's skills as bars out of 100, each with what it does for you under its name. */
export function SkillBars({
  title, rows, className,
}: { title: string; rows: Array<{ label: string; hint?: ReactNode; value: number; max?: number }>; className?: string }) {
  return (
    <section className={cx('pb-adds', className)} aria-label={title}>
      <span className="pb-adds__title">{title}</span>
      {rows.map((r) => (
        <div key={r.label} className="pb-adds__row">
          <span className="pb-adds__label">{r.label}{r.hint && <small>{r.hint}</small>}</span>
          <span className="pb-adds__bar" role="img" aria-label={`${r.label} ${r.value} of ${r.max ?? 100}`}>
            <i style={{ width: `${pctOf(r.value, r.max ?? 100)}%` }} />
          </span>
          <b className="pb-adds__value">{r.value}</b>
        </div>
      ))}
    </section>
  );
}

/* ----------------------------------------------------------- CandidateList */

export interface CandidateItem {
  id: string;
  name: string;
  /** "Player developer · $150k · knows Georgia". */
  sub: ReactNode;
  rating: number;
  over?: boolean;
  onClick?: () => void;
}

/** The men on the market for a seat, headed by what each line says. */
export function CandidateList({
  label, head, items, className,
}: { label: string; head: string; items: CandidateItem[]; className?: string }) {
  return (
    <div className={cx('pb-cands', className)} role="group" aria-label={label}>
      <div className="pb-cands__head" aria-hidden><span>{head}</span><span>Rating</span></div>
      {items.map((c) => (
        <button key={c.id} type="button" className="pb-cands__row" onClick={c.onClick} aria-haspopup="dialog">
          <Monogram name={c.name} size={36} />
          <span className="pb-cands__who"><b>{c.name}</b><small>{c.sub}</small></span>
          {c.over && <StatusBadge tone="warning" icon={false}>Over budget</StatusBadge>}
          <b className="pb-cands__rating" aria-label={`Rating ${c.rating}`}>{c.rating}</b>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ FacilityCard */

export interface FacilityCardProps {
  kind: Building;
  name: string;
  /** One line: what it mostly helps. */
  helps?: ReactNode;
  level: number;
  max?: number;
  /** Cost of the next level, $k. */
  cost?: number;
  /** Budget left this season, $k. */
  budgetLeft: number;
  /** The now-versus-next rows the open card draws. */
  rows?: CompareRow[];
  open: boolean;
  onToggle: () => void;
  delegated?: boolean;
  onUpgrade?: () => boolean | void;
  className?: string;
}

/**
 * One building on the campus, as a row: its drawing, what it helps, a ladder
 * of its levels and the price of the next one. Tapping the row opens it where
 * it stands — the rows above never move — onto what the next level changes
 * and a build button that takes two taps.
 */
export function FacilityCard({
  kind, name, helps, level, max = 3, cost, budgetLeft, rows = [], open, onToggle, delegated, onUpgrade,
  className,
}: FacilityCardProps) {
  const panel = useId();
  const maxed = level >= max;
  const next = Math.min(max, level + 1);
  const left = Math.max(0, budgetLeft);
  const price = maxed ? undefined : cost;
  const fits = price != null && price <= left;

  let action: ReactNode = null;
  if (price != null) {
    if (delegated) {
      action = <p className="pb-fac__note">Your athletic director decides when to build.</p>;
    } else if (!fits) {
      action = (
        <Button variant="primary" block disabled meta={`${dollars(price - left)} short`}>
          Not enough budget
        </Button>
      );
    } else {
      // Keyed by the level, so the next rung's button starts fresh the
      // moment this one is bought.
      action = (
        <ConfirmButton
          key={level}
          block
          idle={level === 0 ? `Build the ${name}` : `Upgrade to level ${next}`}
          meta={dollars(price)}
          armed="Tap again to spend it"
          armedMeta={`${dollars(left - price)} left after`}
          failed="Not approved"
          onConfirm={() => onUpgrade?.()}
        />
      );
    }
  }

  return (
    <article
      className={cx('pb-fac', open && 'is-open', level === 0 && 'is-unbuilt', className)}
      data-facility={kind}
      aria-label={name}
    >
      <button
        type="button"
        className="pb-fac__head"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? panel : undefined}
      >
        <span className="pb-fac__art"><FacilityArt kind={kind} /></span>
        <span className="pb-fac__text">
          <span className="pb-fac__name">{name}</span>
          {helps && <span className="pb-fac__helps">{helps}</span>}
          <span
            className="pb-ladder"
            role="img"
            aria-label={level === 0 ? `${name}: not built` : `${name}: level ${level} of ${max}`}
          >
            {Array.from({ length: max + 1 }, (_, i) => (
              <span
                key={i}
                className={cx('pb-ladder__step', i > 0 && i <= level && 'is-built', i === level && 'is-now', i === level + 1 && 'is-next')}
                aria-hidden
              >L{i}</span>
            ))}
          </span>
        </span>
        <span className="pb-fac__price">
          <small>{maxed ? 'Fully built' : level === 0 ? 'Build' : `Upgrade to L${next}`}</small>
          <b>{maxed || price == null ? 'Max' : dollars(price)}</b>
          {!maxed && price != null && (
            <small className={fits ? 'is-positive' : 'is-warning'}>{fits ? 'Within budget' : 'Over budget'}</small>
          )}
        </span>
      </button>
      {open && (
        <div className="pb-fac__panel" id={panel}>
          {rows.length > 0 && (
            <div className={cx('pb-fac__table', maxed && 'is-max')} role="table" aria-label={`What the ${name} does`}>
              <div className="pb-fac__tr pb-fac__th" role="row">
                <span role="columnheader">What it does</span>
                <span role="columnheader">Now</span>
                {!maxed && <span role="columnheader">{level === 0 ? 'Built' : `L${next}`}</span>}
              </div>
              {rows.map((r) => {
                const now = showValue(r.nowText ?? r.now, r);
                const then = showValue(r.nextText ?? r.next, r);
                return (
                  <div key={r.label} className="pb-fac__tr" role="row">
                    <span className="pb-fac__label" role="rowheader">{r.label}{r.hint && <small>{r.hint}</small>}</span>
                    <b className="pb-fac__now" role="cell">{now}</b>
                    {!maxed && <b className={cx('pb-fac__next', then !== now && 'is-up')} role="cell">{then}</b>}
                  </div>
                );
              })}
            </div>
          )}
          {action}
        </div>
      )}
    </article>
  );
}

/* --------------------------------------------------------------- BudgetBar */

export interface BudgetPart { label: string; value: number; tone: 'ink' | 'info' }

/** The year's money as one bar: what each claim has taken, the track what is left. */
export function BudgetBar({
  total, parts, size = 'md', className,
}: { total: number; parts: BudgetPart[]; size?: 'md' | 'lg'; className?: string }) {
  const used = parts.reduce((n, p) => n + Math.max(0, p.value), 0);
  const scale = Math.max(1, total, used);
  return (
    <span
      className={cx('pb-stackbar', size === 'lg' && 'pb-stackbar--lg', className)}
      role="img"
      aria-label={`${parts.map((p) => `${p.label} ${dollars(Math.max(0, p.value))}`).join(', ')}, of ${dollars(total)}`}
    >
      {parts.map((p) => (p.value > 0
        ? <i key={p.label} className={`is-${p.tone}`} style={{ width: `${(p.value / scale) * 100}%` }} />
        : null))}
    </span>
  );
}

/* ----------------------------------------------------------- BudgetSummary */

/** The season's money in one card: what is left of what, and where the rest went. */
export function BudgetSummary({
  total, left, parts, title = 'This season’s budget', className,
}: { total: number; left: number; parts: BudgetPart[]; title?: string; className?: string }) {
  return (
    <section className={cx('pb-fund', className)} aria-label={title}>
      <div className="pb-fund__top">
        <span>{title}</span>
        <span><b>{dollars(Math.max(0, left))}</b> left of {dollars(total)}</span>
      </div>
      <BudgetBar total={total} parts={parts} />
      <div className="pb-fund__legend">
        {parts.map((p) => <span key={p.label}><i className={cx('pb-swatch', `is-${p.tone}`)} />{p.label}</span>)}
        <span><i className="pb-swatch is-track" />Left</span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ BudgetLedger */

export interface LedgerRow {
  key: string;
  label: string;
  sub: ReactNode;
  value: number;
  tone: 'ink' | 'info' | 'track';
  /** The room this money is spent in. */
  onClick?: () => void;
}

/** The budget room's card: what is left, the bar, and each claim on its own line. */
export function BudgetLedger({
  total, left, note, rows, className,
}: { total: number; left: number; note?: ReactNode; rows: LedgerRow[]; className?: string }) {
  const links = rows.some((r) => r.onClick);
  const parts: BudgetPart[] = rows
    .filter((r): r is LedgerRow & { tone: 'ink' | 'info' } => r.tone !== 'track')
    .map((r) => ({ label: r.label, value: r.value, tone: r.tone }));
  return (
    <section className={cx('pb-ledger', className)} aria-label="Budget">
      <div className="pb-ledger__top">
        <span className="pb-ledger__left">
          <span>Left this season</span>
          <b className={left <= 0 ? 'is-negative' : undefined}>{dollars(Math.max(0, left))}</b>
        </span>
        <span className="pb-ledger__of">of {dollars(total)}{note && <><br />{note}</>}</span>
      </div>
      <BudgetBar total={total} parts={parts} size="lg" />
      {rows.map((r) => {
        const inner = (
          <>
            <i className={cx('pb-swatch', `is-${r.tone}`)} />
            <span className="pb-ledger__what"><b>{r.label}</b><small>{r.sub}</small></span>
            <b className="pb-ledger__value">{dollars(Math.max(0, r.value))}</b>
            {links && (r.onClick
              ? <Icon name="chevron-right" size={18} className="pb-ledger__chevron" />
              : <span className="pb-ledger__chevron" aria-hidden />)}
          </>
        );
        return r.onClick
          ? <button key={r.key} type="button" className="pb-ledger__row" onClick={r.onClick}>{inner}</button>
          : <div key={r.key} className="pb-ledger__row">{inner}</div>;
      })}
    </section>
  );
}

/* ----------------------------------------------------------------- BuyList */

export interface BuyItem {
  key: string;
  icon: IconName;
  title: string;
  sub: ReactNode;
  /** $k. */
  cost: number;
  onClick?: () => void;
}

/** What the money left could buy, each line saying whether it fits and taking you to where it is bought. */
export function BuyList({
  label, items, left, className,
}: { label: string; items: BuyItem[]; left: number; className?: string }) {
  const have = Math.max(0, left);
  return (
    <div className={cx('pb-buys', className)} role="group" aria-label={label}>
      {items.map((b) => {
        const fits = b.cost <= have;
        return (
          <button key={b.key} type="button" className="pb-buy" onClick={b.onClick}>
            <span className="pb-buy__icon"><Icon name={b.icon} size={17} /></span>
            <span className="pb-buy__what"><b>{b.title}</b><small>{b.sub}</small></span>
            <span className="pb-buy__cost">
              <b>{dollars(b.cost)}</b>
              <small className={fits ? 'is-positive' : 'is-warning'}>{fits ? 'Within budget' : `${dollars(b.cost - have)} short`}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
