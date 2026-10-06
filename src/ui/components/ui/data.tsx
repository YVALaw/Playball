// data.tsx
// The design system's data displays: the compare table, the stat table, team
// and player rows, the line score, the bases, game cards and rows, the feed,
// bracket matches, the phase rail and the recruit card.

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon.js';
import {
  Button, Delta, Meter, StatusBadge, Stars, Tag, cx,
  type ButtonProps, type TagTone, type Tone,
} from './core.js';
import { Crest } from '../../Crest.js';
import { Avatar } from '../../Avatar.js';

/* ------------------------------------------------------------ CompareTable */

export interface CompareRow {
  label: string;
  hint?: string;
  now?: number | string;
  next?: number | string;
  /** Printed instead of the number ("—", "Locked", "5 wk"). */
  nowText?: string;
  nextText?: string;
  unit?: string;
  /** Print a + on positive numbers (bonuses). */
  signed?: boolean;
  better?: 'up' | 'down';
  change?: number;
  /** Words in place of a computed change ("Unlocks"). */
  changeText?: string;
}

export function showValue(v: number | string | undefined | null, row: { signed?: boolean; unit?: string }): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'string') return v;
  const sign = row.signed && v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v)}${row.unit ?? ''}`;
}

/** What you have, what you would have, and the change, row by row. */
export function CompareTable({
  rows, from = 'Now', to = 'Next', labelHeader = 'Effect', label, className,
}: { rows: CompareRow[]; from?: string; to?: string; labelHeader?: string; label?: string; className?: string }) {
  return (
    <div className={cx('pb-compare', className)} role="table" aria-label={label}>
      <div className="pb-compare__row pb-compare__head" role="row">
        <span role="columnheader">{labelHeader}</span>
        <span role="columnheader">{from}</span>
        <span role="columnheader">{to}</span>
        <span role="columnheader">Change</span>
      </div>
      {rows.map((r, i) => {
        const nums = typeof r.now === 'number' && typeof r.next === 'number';
        const change = r.change ?? (nums ? Math.round(((r.next as number) - (r.now as number)) * 100) / 100 : null);
        return (
          <div key={i} className="pb-compare__row" role="row">
            <span className="pb-compare__label" role="rowheader">{r.label}{r.hint && <small>{r.hint}</small>}</span>
            {/* Money and other long text at a smaller size: "$1.25M" at the
                numeral size ran over the next column (M103). */}
            <span className={cx('pb-compare__now', String(r.nowText ?? r.now).length > 4 && 'pb-compare__cell--long')} role="cell">{showValue(r.nowText ?? r.now, r)}</span>
            <span className={cx('pb-compare__next', String(r.nextText ?? r.next).length > 4 && 'pb-compare__cell--long')} role="cell">{showValue(r.nextText ?? r.next, r)}</span>
            <span className="pb-compare__delta" role="cell">
              {r.changeText != null
                ? <Delta value={change == null ? 1 : change} text={r.changeText} better={r.better} icon={false} />
                : change != null ? <Delta value={change} unit={r.unit} better={r.better} /> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- Table */

export interface TableColumn {
  label: ReactNode;
  width?: string;
  grow?: boolean;
  align?: 'left' | 'right';
  /** The full meaning of an abbreviated header. */
  title?: string;
  sorted?: 'asc' | 'desc';
  mono?: boolean;
  strong?: boolean;
  rowHeader?: boolean;
  onSort?: () => void;
}
export interface TableRow { key?: string | number; cells: ReactNode[]; you?: boolean; divider?: boolean; onClick?: () => void; muted?: boolean }

/** A table that keeps its columns on a phone: few columns, full words in the header's title. */
export function Table({
  columns, rows, caption, dense, label, className, empty,
}: {
  columns: TableColumn[]; rows: TableRow[]; caption?: ReactNode; dense?: boolean; label?: string;
  className?: string; empty?: ReactNode;
}) {
  const tmpl = columns.map((c) => c.width ?? (c.grow ? 'minmax(0, 1fr)' : 'auto')).join(' ');
  return (
    <div className={cx('pb-table', dense && 'pb-table--dense', className)} role="table" aria-label={label}>
      <div className="pb-table__row pb-table__head" role="row" style={{ gridTemplateColumns: tmpl }}>
        {columns.map((c, i) => {
          const inner = <>{c.label}{c.sorted && <Icon name={c.sorted === 'asc' ? 'arrow-up' : 'arrow-down'} size={12} />}</>;
          return c.onSort ? (
            <button
              key={i}
              type="button"
              role="columnheader"
              aria-sort={c.sorted === 'asc' ? 'ascending' : c.sorted === 'desc' ? 'descending' : 'none'}
              className={cx('pb-table__sort', c.align === 'right' && 'is-num', c.sorted && 'is-sorted')}
              title={c.title}
              onClick={c.onSort}
            >{inner}</button>
          ) : (
            <span key={i} role="columnheader" className={cx(c.align === 'right' && 'is-num', c.sorted && 'is-sorted')} title={c.title}>
              {inner}
            </span>
          );
        })}
      </div>
      {rows.length === 0 && empty ? <div className="pb-table__empty">{empty}</div> : null}
      {rows.map((r, ri) => {
        const cells = r.cells.map((cell, ci) => {
          const c = columns[ci] ?? {} as TableColumn;
          return (
            <span
              key={ci}
              role={ci === 0 && c.rowHeader !== false ? 'rowheader' : 'cell'}
              className={cx(c.align === 'right' && 'is-num', c.mono && 'is-mono', c.strong && 'is-strong')}
            >{cell}</span>
          );
        });
        const cls = cx('pb-table__row', r.you && 'is-you', r.onClick && 'is-interactive', r.divider && 'has-divider', r.muted && 'is-muted');
        return r.onClick ? (
          <button key={r.key ?? ri} type="button" role="row" className={cls} style={{ gridTemplateColumns: tmpl }} onClick={r.onClick}>{cells}</button>
        ) : (
          <div key={r.key ?? ri} role="row" className={cls} style={{ gridTemplateColumns: tmpl }}>{cells}</div>
        );
      })}
      {caption && <p className="pb-table__caption">{caption}</p>}
    </div>
  );
}

/** A school in a table cell: crest, name, and a line under it. */
export function TeamCell({
  abbr, name, sub, you, size = 24,
}: { abbr: string; name: ReactNode; sub?: ReactNode; you?: boolean; size?: number }) {
  return (
    <span className="pb-teamcell">
      <Crest abbr={abbr} size={size} />
      <span className="pb-teamcell__text">
        <span className="pb-teamcell__name"><span className="pb-ellipsis">{name}</span>{you && <Tag tone="you">You</Tag>}</span>
        {sub && <span className="pb-teamcell__sub">{sub}</span>}
      </span>
    </span>
  );
}

/* --------------------------------------------------------------- PlayerRow */

export interface PlayerRowProps {
  name: ReactNode;
  /** The player's id and school, for the drawn face. */
  avatar?: ReactNode;
  tags?: Array<string | { text: string; title?: string; tone?: TagTone }>;
  meta?: ReactNode;
  mark?: ReactNode;
  lead?: ReactNode;
  flags?: ReactNode;
  warning?: ReactNode;
  stats?: Array<{ label: string; value: ReactNode; title?: string }>;
  value?: ReactNode;
  valueLabel?: string;
  trailing?: ReactNode;
  selected?: boolean;
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
  guide?: string;
  disabled?: boolean;
  /** The row's element, for a screen that measures or scrolls to it. */
  elRef?: (el: HTMLElement | null) => void;
  /** Extra handlers for the row's button: a long press, for one. */
  buttonProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'className' | 'type'>;
}

/** A player in a list: face, name, what he is, and the one number that matters here. */
export function PlayerRow({
  name, avatar, tags, meta, mark, lead, flags, warning, stats, value, valueLabel, trailing, selected, chevron,
  onClick, className, guide, disabled, elRef, buttonProps,
}: PlayerRowProps) {
  const clickable = !!onClick;
  const inner = (
    <>
      {lead != null && <span className="pb-prow__lead">{lead}</span>}
      {avatar}
      <span className="pb-prow__body">
        <span className="pb-prow__name"><span className="pb-ellipsis">{name}</span>{mark}</span>
        {(tags?.length || meta) && (
          <span className="pb-prow__meta">
            {(tags ?? []).map((t, i) => (typeof t === 'string'
              ? <Tag key={i}>{t}</Tag>
              : <Tag key={i} tone={t.tone} title={t.title}>{t.text}</Tag>))}
            {meta && <span className="pb-prow__metatext">{meta}</span>}
          </span>
        )}
        {flags && <span className="pb-prow__flags">{flags}</span>}
      </span>
      {stats && (
        <span className="pb-prow__stats">
          {stats.map((s, i) => (
            <span key={i} className="pb-prow__stat" title={s.title}><small>{s.label}</small><b>{s.value}</b></span>
          ))}
        </span>
      )}
      {value != null && (
        <span className="pb-prow__value"><b>{value}</b>{valueLabel && <small>{valueLabel}</small>}</span>
      )}
      {trailing}
      {clickable && chevron !== false && <Icon name="chevron-right" size={20} className="pb-prow__chevron" />}
      {/* Its own line under the row, the full width: the text column beside
          the stats is too narrow for even a short warning to keep its number. */}
      {warning && <span className="pb-prow__warning"><Icon name="alert" size={14} /><span className="pb-ellipsis">{warning}</span></span>}
    </>
  );
  const cls = cx(
    'pb-prow', clickable && 'is-interactive', selected && 'is-selected', warning ? 'has-warning' : null,
    lead != null && 'has-lead', avatar ? 'has-avatar' : null, className,
  );
  if (!clickable) return <div ref={elRef} className={cls} data-guide={guide}>{inner}</div>;
  return (
    <button
      {...buttonProps}
      ref={elRef}
      type="button"
      className={cls}
      data-guide={guide}
      disabled={disabled}
      aria-pressed={selected != null ? !!selected : undefined}
      onClick={onClick}
    >{inner}</button>
  );
}

/** The drawn face, on its disc, for a PlayerRow or a header. */
export function Face({ id, team, number, size = 40 }: { id: string; team?: string; number?: number; size?: number }) {
  return (
    <span className="pb-avatar" style={{ width: size, height: size }} aria-hidden>
      <Avatar id={id} team={team} number={number} size={size} />
    </span>
  );
}

/* --------------------------------------------------------------- LineScore */

export interface LineScoreTeam {
  abbr: string;
  /** Runs per inning; a string for the X of an unneeded bottom half. */
  innings: Array<number | string | null | undefined>;
  r: number; h: number; e: number;
  you?: boolean;
  batting?: boolean;
}

export function LineScore({
  teams, innings = 9, inning, status, className,
}: { teams: LineScoreTeam[]; innings?: number; inning?: number; status?: ReactNode; className?: string }) {
  const n = Math.max(innings, ...teams.map((t) => t.innings.length));
  const tmpl = `64px repeat(${n}, minmax(0, 1fr)) 8px repeat(3, 26px)`;
  return (
    <div className={cx('pb-linescore', className)} role="table" aria-label="Line score">
      <div className="pb-linescore__row pb-linescore__head" role="row" style={{ gridTemplateColumns: tmpl }}>
        <span role="columnheader">{status ?? ''}</span>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} role="columnheader" className={i + 1 === inning ? 'is-now' : undefined}>{i + 1}</span>
        ))}
        <span aria-hidden />
        <span role="columnheader" title="Runs">R</span>
        <span role="columnheader" title="Hits">H</span>
        <span role="columnheader" title="Errors">E</span>
      </div>
      {teams.map((t, ti) => (
        <div key={ti} role="row" className={cx('pb-linescore__row', t.you && 'is-you', t.batting && 'is-batting')} style={{ gridTemplateColumns: tmpl }}>
          <span role="rowheader" className="pb-linescore__team"><Crest abbr={t.abbr} size={18} />{t.abbr}</span>
          {Array.from({ length: n }, (_, i) => {
            const v = t.innings[i];
            return (
              <span key={i} role="cell" className={cx(i + 1 === inning && 'is-now', (v == null || v === '') && 'is-empty')}>
                {v == null ? '' : String(v)}
              </span>
            );
          })}
          <span aria-hidden />
          <span role="cell" className="is-total">{t.r}</span>
          <span role="cell">{t.h}</span>
          <span role="cell">{t.e}</span>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- BaseState */

const BASE_NAMES = ['first', 'second', 'third'];

export function baseStateText(bases: [boolean, boolean, boolean], outs: number): string {
  const on = BASE_NAMES.filter((_, i) => bases[i]);
  const runners = on.length === 0 ? 'Bases empty'
    : on.length === 3 ? 'Bases loaded'
      : `Runner${on.length > 1 ? 's' : ''} on ${on.join(' and ')}`;
  return `${runners}, ${outs === 0 ? 'no outs' : outs === 1 ? 'one out' : `${outs} outs`}`;
}

/** The diamond's runners and the outs, drawn, with the words for a screen reader. */
export function BaseState({
  bases = [false, false, false], outs = 0, count, size = 56, showText, className,
}: { bases?: [boolean, boolean, boolean]; outs?: number; count?: string; size?: number; showText?: boolean; className?: string }) {
  const text = baseStateText(bases, outs);
  return (
    <span className={cx('pb-bases', className)} role="img" aria-label={text + (count ? `, count ${count}` : '')}>
      <svg viewBox="0 0 56 44" width={size} height={size * 44 / 56} aria-hidden focusable="false">
        <rect className={cx('pb-bases__base', bases[1] && 'is-on')} x="21" y="3" width="14" height="14" rx="2" transform="rotate(45 28 10)" />
        <rect className={cx('pb-bases__base', bases[2] && 'is-on')} x="5" y="19" width="14" height="14" rx="2" transform="rotate(45 12 26)" />
        <rect className={cx('pb-bases__base', bases[0] && 'is-on')} x="37" y="19" width="14" height="14" rx="2" transform="rotate(45 44 26)" />
      </svg>
      <span className="pb-bases__side">
        <span className="pb-bases__outs" aria-hidden>
          {[0, 1, 2].map((i) => <i key={i} className={i < outs ? 'is-on' : undefined} />)}
          <small>{outs === 1 ? '1 out' : `${outs} outs`}</small>
        </span>
        {count && <span className="pb-bases__count" aria-hidden>{count}</span>}
      </span>
      {showText && <span className="pb-bases__text">{text}</span>}
    </span>
  );
}

/* ---------------------------------------------------------------- GameCard */

export interface GameSide { abbr: string; name: ReactNode; record?: ReactNode; you?: boolean; onClick?: () => void }

function TeamSide({ side }: { side: GameSide }) {
  const inner = (
    <>
      <Crest abbr={side.abbr} size={44} />
      <span className="pb-game__name">{side.name}</span>
      {side.record != null && <span className="pb-game__record">{side.record}</span>}
    </>
  );
  return side.onClick
    ? <button type="button" className={cx('pb-game__team', 'is-interactive', side.you && 'is-you')} onClick={side.onClick}>{inner}</button>
    : <span className={cx('pb-game__team', side.you && 'is-you')}>{inner}</span>;
}

/** The next game (or the last one): who, where, when, what is at stake, and the ways to play it. */
export function GameCard({
  when, kind, kindTone = 'neutral', headAction, away, home, score, facts, actions, actionsNote, label, children, className,
}: {
  when: ReactNode; kind?: ReactNode; kindTone?: Tone;
  /** A small control at the right of the head, in place of room for a badge: June's "Lineup". */
  headAction?: ReactNode;
  away: GameSide; home: GameSide; score?: ReactNode;
  facts?: Array<{ label: string; value: ReactNode; note?: ReactNode }>;
  actions?: ReactNode; actionsNote?: ReactNode; label?: string; children?: ReactNode; className?: string;
}) {
  return (
    <section className={cx('pb-game', className)} aria-label={label ?? 'Next game'}>
      <header className="pb-game__head">
        <span className="pb-game__when">{when}</span>
        {kind && <StatusBadge tone={kindTone} icon={false}>{kind}</StatusBadge>}
        {headAction}
      </header>
      <div className="pb-game__teams">
        <TeamSide side={away} />
        <span className="pb-game__at">{score ? <b>{score}</b> : '@'}</span>
        <TeamSide side={home} />
      </div>
      {facts && facts.length > 0 && (
        <dl className="pb-game__facts">
          {facts.map((f, i) => (
            <div key={i}><dt>{f.label}</dt><dd>{f.value}{f.note && <small>{f.note}</small>}</dd></div>
          ))}
        </dl>
      )}
      {actions && <footer className="pb-game__actions">{actions}</footer>}
      {actionsNote && <p className="pb-game__note">{actionsNote}</p>}
      {/* The notes come last. Between the facts and the buttons, a note that
          arrived — a rivalry, a hold on the lineup — pushed the buttons down
          the screen; under them, the card grows where nothing is tapped. */}
      {children && <div className="pb-game__body">{children}</div>}
    </section>
  );
}

/* ----------------------------------------------------------------- GameRow */

export function GameRow({
  day, date, opponent, abbr, home, kind, result, status, current, onClick, className,
}: {
  day: ReactNode; date: ReactNode; opponent: ReactNode; abbr: string; home?: boolean; kind?: ReactNode;
  result?: { win: boolean; score: ReactNode }; status?: ReactNode; current?: boolean;
  onClick?: () => void; className?: string;
}) {
  const clickable = !!onClick;
  const inner = (
    <>
      <span className="pb-gamerow__date"><b>{day}</b><small>{date}</small></span>
      <Crest abbr={abbr} size={28} />
      <span className="pb-gamerow__body">
        <span className="pb-gamerow__opp"><span className="pb-gamerow__vs">{home ? 'vs' : 'at'}</span>{opponent}</span>
        {kind && <span className="pb-gamerow__kind">{kind}</span>}
      </span>
      {result ? (
        <span className={cx('pb-gamerow__result', result.win ? 'is-win' : 'is-loss')}>
          <b>{result.win ? 'W' : 'L'}</b><span>{result.score}</span>
        </span>
      ) : status ? <span className="pb-gamerow__status">{status}</span> : null}
      {clickable && <Icon name="chevron-right" size={20} className="pb-gamerow__chevron" />}
    </>
  );
  const cls = cx('pb-gamerow', clickable && 'is-interactive', current && 'is-current', className);
  return clickable
    ? <button type="button" className={cls} onClick={onClick} aria-current={current ? 'true' : undefined}>{inner}</button>
    : <div className={cls} aria-current={current ? 'true' : undefined}>{inner}</div>;
}

/* ---------------------------------------------------------------- FeedItem */

export function FeedItem({
  lead, meta, title, text, unread, tone, onClick, children, className,
}: {
  lead?: ReactNode; meta?: ReactNode; title: ReactNode; text?: ReactNode; unread?: boolean;
  tone?: 'positive' | 'negative'; onClick?: () => void; children?: ReactNode; className?: string;
}) {
  const clickable = !!onClick;
  const inner = (
    <>
      {lead && <span className="pb-feed__lead">{lead}</span>}
      <span className="pb-feed__body">
        {meta && <span className="pb-feed__meta">{meta}</span>}
        <span className="pb-feed__title">{title}</span>
        {text && <span className="pb-feed__text">{text}</span>}
        {children}
      </span>
      {unread && <span className="pb-feed__dot" role="img" aria-label="unread" />}
      {clickable && <Icon name="chevron-right" size={20} className="pb-feed__chevron" />}
    </>
  );
  const cls = cx('pb-feed', clickable && 'is-interactive', unread && 'is-unread', tone && `pb-feed--${tone}`, className);
  return clickable
    ? <button type="button" className={cls} onClick={onClick}>{inner}</button>
    : <div className={cls}>{inner}</div>;
}

/* ------------------------------------------------------------ BracketMatch */

export interface BracketTeam {
  abbr: string; name: ReactNode; seed?: number; score?: number | string; winner?: boolean; out?: boolean; you?: boolean;
}

export function BracketMatch({
  teams, status, live, label, onClick, className,
}: { teams: BracketTeam[]; status?: ReactNode; live?: boolean; label?: string; onClick?: () => void; className?: string }) {
  const inner = (
    <>
      {status && <span className={cx('pb-match__status', live && 'is-live')}>{status}</span>}
      {teams.map((t, i) => (
        <span key={i} className={cx('pb-match__team', t.winner && 'is-winner', t.out && 'is-out', t.you && 'is-you')}>
          {t.seed != null && <span className="pb-match__seed">{t.seed}</span>}
          {t.abbr ? <Crest abbr={t.abbr} size={22} /> : <span className="pb-match__tbd" aria-hidden />}
          <span className="pb-match__name">{t.name}</span>
          {t.you && <Tag tone="you">You</Tag>}
          {t.score != null && <span className="pb-match__score">{t.score}</span>}
          {t.winner && <Icon name="check" size={14} className="pb-match__check" />}
        </span>
      ))}
    </>
  );
  const cls = cx('pb-match', onClick && 'is-interactive', className);
  return onClick
    ? <button type="button" className={cls} onClick={onClick} aria-label={label}>{inner}</button>
    : <div className={cls} aria-label={label}>{inner}</div>;
}

/* --------------------------------------------------------------- PhaseRail */

export interface PhaseStep { label: string; state?: 'done' | 'current' | 'upcoming'; onClick?: () => void }

/** Where a sequence is: done steps ticked, the current one filled, the rest waiting. */
export function PhaseRail({ steps, label = 'Steps', className }: { steps: PhaseStep[]; label?: string; className?: string }) {
  const cur = steps.findIndex((s) => s.state === 'current');
  return (
    <nav className={cx('pb-phases', className)} aria-label={label}>
      <ol>
        {steps.map((s, i) => {
          const inner = (
            <>
              <span className="pb-phases__dot" aria-hidden>{s.state === 'done' ? <Icon name="check" size={12} /> : i + 1}</span>
              <span className="pb-phases__label">{s.label}</span>
            </>
          );
          return (
            <li key={i} className={`is-${s.state ?? 'upcoming'}`} aria-current={s.state === 'current' ? 'step' : undefined}>
              {s.onClick ? <button type="button" className="pb-phases__btn" onClick={s.onClick}>{inner}</button> : inner}
            </li>
          );
        })}
      </ol>
      {cur >= 0 && <span className="pb-phases__count">Step {cur + 1} of {steps.length}</span>}
    </nav>
  );
}

/* ------------------------------------------------------------ ProspectCard */

export interface ProspectCardProps {
  name: ReactNode;
  id: string;
  team?: string;
  tags?: string[];
  meta?: ReactNode;
  stars?: number;
  rank?: number;
  ratingLow: number;
  ratingHigh: number;
  ceiling: ReactNode;
  status?: { tone: Tone; icon?: IconName; label: string };
  interest?: { you: number; leader?: number; leaderName?: string };
  wants?: Array<string | { text: string; fit?: boolean }>;
  action?: { label: string; meta?: ReactNode; variant?: ButtonProps['variant']; disabled?: boolean; onClick?: () => void };
  onOpen?: () => void;
  children?: ReactNode;
  className?: string;
}

/**
 * A recruit: how good he is now, how good he can get, and how much he likes you.
 *
 * Built short. The first cut stacked a two-cell grid, a captioned meter and a
 * labelled tag row under the head, and a board of thirty read as a scroll
 * ("we have to scroll way too much"). The numbers now share one line, the
 * meter is a bare bar with the leader's tick, and the sheet the head opens
 * keeps every caption this card no longer carries.
 */
export function ProspectCard({
  name, id, team, tags, meta, stars = 0, rank, ratingLow, ratingHigh, ceiling,
  status, interest, wants, action, onOpen, children, className,
}: ProspectCardProps) {
  const head = (
    <>
      <Face id={id} team={team} size={40} />
      <span className="pb-prospect__who">
        <span className="pb-prospect__name">{name}</span>
        <span className="pb-prospect__meta">
          {(tags ?? []).map((t, i) => <Tag key={i}>{t}</Tag>)}
          <Stars value={stars} size={12} label="Recruit rating" />
          {meta && <span>{meta}</span>}
        </span>
        {status && (
          <span className="pb-prospect__line">
            <StatusBadge tone={status.tone} icon={status.icon}>{status.label}</StatusBadge>
          </span>
        )}
      </span>
      {rank != null && <span className="pb-prospect__rank"><small>National</small><b>#{rank}</b></span>}
      {onOpen && <Icon name="chevron-right" size={20} className="pb-prospect__chevron" />}
    </>
  );
  return (
    <article className={cx('pb-prospect', className)}>
      {onOpen
        ? <button type="button" className="pb-prospect__head" onClick={onOpen}>{head}</button>
        : <div className="pb-prospect__head">{head}</div>}
      <span className="pb-prospect__facts">
        <span><small>Now</small><b>{ratingLow === ratingHigh ? ratingLow : `${ratingLow}–${ratingHigh}`}</b></span>
        <span><small>Ceiling</small><b>{ceiling}</b></span>
        {interest && (
          <span>
            <small>Interest</small>
            <b>{interest.you}%</b>
            {interest.leader != null && <em>{interest.leaderName ?? 'Leader'} {interest.leader}%</em>}
          </span>
        )}
      </span>
      {interest && (
        <Meter
          value={interest.you}
          max={100}
          size="sm"
          ariaLabel="Interest in you"
          markers={interest.leader != null ? [{ at: interest.leader }] : undefined}
        />
      )}
      {wants && wants.length > 0 && (
        <span className="pb-prospect__wants">
          <small>Wants</small>
          {wants.map((w, i) => {
            const it = typeof w === 'string' ? { text: w, fit: false } : w;
            return <Tag key={i} tone={it.fit ? 'positive' : undefined}>{it.fit && <Icon name="check" size={12} />}{it.text}</Tag>;
          })}
        </span>
      )}
      {children}
      {action && (
        <div className="pb-prospect__actions">
          <Button variant={action.variant ?? 'tonal'} block size="sm" meta={action.meta} onClick={action.onClick} disabled={action.disabled}>
            {action.label}
          </Button>
        </div>
      )}
    </article>
  );
}

/* ----------------------------------------------------------------- Trend */

export interface TrendBar { key: string | number; label: ReactNode; value: number; max?: number; top?: ReactNode; highlight?: boolean }

/** A few bars over time, each with its number on top and its label underneath. */
export function Trend({ bars, label, className }: { bars: TrendBar[]; label: string; className?: string }) {
  return (
    <div className={cx('pb-trend', className)} role="img" aria-label={label}>
      {bars.map((b) => (
        <span key={b.key} className={cx('pb-trend__col', b.highlight && 'is-highlight')}>
          <b>{b.top ?? b.value}</b>
          <span className="pb-trend__track"><i style={{ height: `${Math.max(4, Math.min(100, (b.value / (b.max ?? 100)) * 100))}%` }} /></span>
          <small>{b.label}</small>
        </span>
      ))}
    </div>
  );
}
