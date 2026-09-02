// Kit.tsx
// The proposal's shared vocabulary, as components.
//
// Eleven shapes account for most of the two hundred and thirty classes in
// prototype.css, and the screens that use them are compositions rather than
// walls of markup. Every one of them is the proposal's own DOM — same elements,
// same class names, same order — so the stylesheet is the only opinion about
// how any of it looks. There are no style objects in this file, deliberately;
// one here would be a second opinion about a rule that already exists.
//
// The three that used to live here — Rule, Tile, Card — belonged to the design
// this port replaced and went with it.

import { useEffect, useRef, type ReactNode } from 'react';
import {
  ChevronRightIcon, DotFilledIcon, PersonIcon, SewingPinIcon,
} from '@radix-ui/react-icons';
import { useDynasty } from '../../state/store.js';

/**
 * The head of a screen: a green kicker, a condensed title, a line of prose.
 *
 * The prose is not decoration. Every screen in the proposal opens by saying
 * what it is for, which is the one thing a dense table of numbers cannot say
 * about itself.
 *
 * ---------------------------------------------------------------------------
 * It says it once, and then it stops saying it
 * ---------------------------------------------------------------------------
 *
 * Measured on the roster at 375x812: the header, the context nav, this block
 * and the filter row cost 248px before the first row of the list — thirty-one
 * per cent of the screen, on every screen, forever. The competition spends
 * about a hundred. Our rows are fine at 58px; the preamble was the whole gap.
 *
 * Deleting the prose is the wrong fix, because the rule above is a good one:
 * "OVR is what a man is, POT is what he might become" genuinely earns its
 * height the first time somebody meets the roster. It earns nothing the
 * fortieth time.
 *
 * So it retires. Full on the first visit, kicker and title afterwards, and
 * about fifty pixels back on every screen from then on.
 *
 * Two things worth knowing about how:
 *
 * The key is `kicker + title` rather than a new prop, so all sixty-two call
 * sites across twenty-eight screens are untouched — a screen that shows two
 * intros in two branches retires them separately, which is what you want.
 *
 * The memory is `seenTutorials`, the array `FirstVisit` already keeps in the
 * save. Reusing it means intros are remembered per career, written through the
 * same way, and forgotten by the same RESET TUTORIALS the saves screen already
 * offers — asking to be taught again should bring the prose back with it.
 * `markTutorialSeen` early-returns on a repeat, so the unmount below is free
 * after the first one.
 *
 * Marked on unmount, not on mount: marking on arrival would collapse the block
 * under the reader on the one visit it exists for.
 *
 * And marked only if the screen was actually up long enough to read — which is
 * a rule that earns its keep twice. It means a screen you bounced off in half a
 * second still introduces itself next time. It also fixes the bug the first
 * version shipped with: `StrictMode` runs setup, cleanup, setup on every mount
 * in development, so a bare unmount handler marked every intro as read the
 * instant it appeared, and the prose was never seen once. The timer is cleared
 * by that first synthetic cleanup, so the flag is still false and nothing is
 * recorded.
 */
export function ModuleIntro(
  { kicker, title, text }: { kicker: string; title: string; text?: string },
) {
  const key = `intro:${kicker}:${title}`;
  const seen = useDynasty((s) => s.seenTutorials).includes(key);
  const markSeen = useDynasty((s) => s.markTutorialSeen);

  const read = useRef(false);
  useEffect(() => {
    read.current = false;
    const t = setTimeout(() => { read.current = true; }, 1200);
    return () => {
      clearTimeout(t);
      if (read.current) markSeen(key);
    };
  }, [key, markSeen]);

  const brief = seen || !text;
  return (
    <section className={brief ? 'module-intro is-brief' : 'module-intro'}>
      <small>{kicker}</small>
      <h1>{title}</h1>
      {!brief && <p>{text}</p>}
    </section>
  );
}

/** The rule between sections, with an optional way out on the right. */
export function SectionHeading(
  { kicker, title, action, onAction }:
  { kicker: string; title: string; action?: string; onAction?: () => void },
) {
  return (
    <section className="dashboard-heading">
      <div><small>{kicker}</small><h2>{title}</h2></div>
      {action && (
        <button type="button" onClick={onAction}>{action} <ChevronRightIcon /></button>
      )}
    </section>
  );
}

/** One number with a label over it and a note under it. */
export function Metric(
  { label, value, note }: { label: string; value: string; note?: string },
) {
  return (
    <div className="metric">
      <small>{label}</small>
      <strong>{value}</strong>
      {note && <span>{note}</span>}
    </div>
  );
}

/** Three of them in a row, hairline-ruled. */
export function MetricStrip({ children }: { children: ReactNode }) {
  return <section className="metric-strip">{children}</section>;
}

/**
 * A rating as five pips.
 *
 * Twenty points a pip, and never fewer than one lit — a row of five empty boxes
 * reads as missing data rather than as a 20 contact hitter, and this game has
 * plenty of genuinely missing data to distinguish it from.
 */
export function Rating({ label, value }: { label: string; value: number }) {
  const filled = Math.max(1, Math.round(value / 20));
  return (
    <span className="rating">
      <small>{label}</small>
      <span>{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < filled ? 'on' : ''} />)}</span>
    </span>
  );
}

/** The tab strip. Scrolls when there are more options than there is room. */
export function Segmented<T extends string>(
  { value, options, onChange, label }:
  {
    value: T;
    options: ReadonlyArray<{ value: T; label: string }>;
    onChange: (value: T) => void;
    label: string;
  },
) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          className={value === option.value ? 'active' : ''}
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
        >{option.label}</button>
      ))}
    </div>
  );
}

/**
 * The workhorse: a portrait, a name, a line of detail, a number, a chevron.
 *
 * Rows carry an explicit `key` rather than deriving one from their text, which
 * the proposal does — two men can genuinely share a name and a line in a game
 * with four thousand of them, and React would quietly keep the wrong row.
 *
 * `face` takes whatever draws the portrait. The proposal reuses one photograph;
 * this app has a face per player id, and passing it in keeps this component
 * from having to know that.
 */
export interface Row {
  key: string;
  title: string;
  detail: string;
  value?: string;
  face?: ReactNode;
  /** Rendered right after the title — the captain's C rides here. */
  mark?: ReactNode;
}

export function DataTable(
  { rows, onOpen, empty }:
  { rows: readonly Row[]; onOpen?: (key: string) => void; empty?: string },
) {
  if (rows.length === 0 && empty) {
    return (
      <section className="empty-state">
        <PersonIcon />
        <h2>Nothing here</h2>
        <p>{empty}</p>
      </section>
    );
  }
  return (
    <section className="data-table">
      {rows.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={onOpen ? () => onOpen(r.key) : undefined}
        >
          <span className="portrait">{r.face ?? <PersonIcon />}</span>
          <span><strong>{r.title}{r.mark}</strong><small>{r.detail}</small></span>
          {r.value !== undefined && <b>{r.value}</b>}
          {onOpen && <ChevronRightIcon />}
        </button>
      ))}
    </section>
  );
}

/**
 * The C, worn wherever the captain's name is printed.
 *
 * Reported from testing: naming a captain changed nothing anybody could see —
 * 'we need to give the captain some type of symbol that appears in his name
 * everywhere letting us know who the captain is.' The patch a hockey sweater
 * wears, as a chip the height of the text it follows.
 */
export function CaptainC() {
  return <i className="captain-c" aria-label="Captain">C</i>;
}

/** A stack of full-width links, hairline-ruled, chevron on the right. */
export function InlineActions(
  { actions }: { actions: ReadonlyArray<{ label: string; onClick: () => void }> },
) {
  return (
    <section className="inline-actions">
      {actions.map((a) => (
        <button key={a.label} type="button" onClick={a.onClick}>
          {a.label} <ChevronRightIcon />
        </button>
      ))}
    </section>
  );
}

/**
 * How full the room is, in three counts and a row of pips.
 *
 * The pips are capped: a 26 man roster drawn as 26 dots is a texture rather
 * than a count, and the number beside them is already exact.
 */
export function Capacity(
  { groups }:
  { groups: ReadonlyArray<{ label: string; used: number; cap: number }> },
) {
  return (
    <section className="club-capacity">
      {groups.map((g) => (
        <div key={g.label}>
          <small>{g.label}</small>
          <strong>{g.used} <em>/{g.cap}</em></strong>
          <p>
            {Array.from({ length: Math.min(g.used, 8) }, (_, i) => (
              <DotFilledIcon key={i} />
            ))}
          </p>
        </div>
      ))}
    </section>
  );
}

/** The pinned aside: a red rule, a heading, a sentence of why. */
export function FieldNote({ title, text }: { title: string; text: string }) {
  return (
    <section className="field-note">
      <SewingPinIcon />
      <div><strong>{title}</strong><p>{text}</p></div>
    </section>
  );
}

/** A meter with its own numbers over it. */
export function BudgetBar(
  { label, value, fraction }: { label: string; value: string; fraction: number },
) {
  return (
    <section className="budget-bar">
      <span><small>{label}</small><strong>{value}</strong></span>
      <i><b style={{ width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` }} /></i>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   The programme leaves.

   These lived twice: Program.tsx had the ported versions, drawn with the
   classes the adapt script generates, and TeamCard.tsx had hand-built copies
   with the same names and inline styles — the pre-port originals, never
   revisited. Reported repeatedly as "the universities overview still has the
   old styling", and it was exactly that: the college profile was the last
   screen in the app still wearing the design the port replaced.

   One home now. A leaf that changes changes on every screen that uses it.
   --------------------------------------------------------------------------- */

/** A section rule, above a panel. */
export function PanelHead({ children }: { children: ReactNode }) {
  return (
    <div className="flow-section-title"><span className="label">{children}</span></div>
  );
}

/** The bordered card the rows sit in. */
export function Panel({ children }: { children: ReactNode }) {
  return <div className="program-panel">{children}</div>;
}

/** The quiet line under a panel. */
export function PanelNote({ children }: { children: ReactNode }) {
  return <div className="program-note">{children}</div>;
}

/** Nothing to show, said in the house voice. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <div className="program-empty">{children}</div>;
}

/** A label and its value, one row of a panel. */
export function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="program-stat">
      <span className="label">{k}</span>
      <b>{v}</b>
    </div>
  );
}

/** Three or four numbers across, inside one border. */
export function Tiles({ children }: { children: ReactNode }) {
  return <div className="program-tiles">{children}</div>;
}

export function Tile(
  { k, v, accent }: { k: string; v: string; accent?: boolean },
) {
  return (
    <div className={`program-tile${accent ? ' accent' : ''}`}>
      <span className="label">{k}</span>
      <strong>{v}</strong>
    </div>
  );
}

/**
 * A stat that also shows where its number sits on its own scale.
 *
 * `note` is for the sentence a bar cannot say. Patience and ambition are
 * opinions rather than quantities, which is why the college profile passes a
 * phrase there and no number at all.
 */
export function Meter(
  { k, v, value, note }:
  { k: string; v: string; value: number; note?: string },
) {
  return (
    <div className="program-meter">
      <div>
        <span className="label">{k}</span>
        <b>{v}</b>
      </div>
      <i><em style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></i>
      {note && <p>{note}</p>}
    </div>
  );
}
