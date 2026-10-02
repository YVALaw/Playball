// navTarget.ts
// What moves under the finger for the level a back press would take.
//
// The shapes are App's old peek's, unchanged (2026-09-30): a card or an
// overlay is a layer, a coach's desk or a screen-held sheet sinks as a sheet,
// a route, a winter step or the game is the screen, and a guard is blocked.
// The level comes from nav.ts; the page is asked through `q`, so node tests
// hand in a stub and App hands in `domQuery`.

import type { Level } from '../state/nav.js';
import type { BackTarget } from './predictiveBack.js';
import { lastShown } from './screenOwner.js';

export interface TargetQuery {
  /** The newest element on show for a selector (a hidden kept screen's copy is skipped). */
  last(sel: string): HTMLElement | null;
  /** The screen's scroller. */
  main(): HTMLElement | null;
}

/** A sheet sinks with its scrim; anything else moves as the layer it sits in. */
export function asShown(el: HTMLElement | null): BackTarget {
  if (!el) return { kind: 'plain' };
  const host = el.closest<HTMLElement>('.pb-sheet-host');
  if (host) return { kind: 'sheet', el: host.querySelector<HTMLElement>(':scope > .pb-sheet') ?? el, host };
  return { kind: 'layer', el: el.closest<HTMLElement>('.pb-fulloverlay, .pb-tableoverlay') ?? el };
}

export function toTarget(level: Level | null, q: TargetQuery): BackTarget {
  if (!level) return { kind: 'none' };
  switch (level.kind) {
    case 'guard': return { kind: 'blocked' };
    case 'local': return asShown(level.element?.() ?? null);
    case 'g': return { kind: 'layer', el: q.last('.pb-fulloverlay.god-sheet') };
    case 'p': return { kind: 'layer', el: q.last('.pb-fulloverlay.is-player') };
    case 'c': return asShown(q.last('.pb-sheet-host > .pb-sheet'));
    case 't': return { kind: 'layer', el: q.last('.pb-fulloverlay.is-team') };
    case 'sp': return { kind: 'screen', el: q.last('.pb-tableoverlay__body') };
    case 'overlay': return { kind: 'layer', el: q.last('.pb-tableoverlay') };
    default: return { kind: 'screen', el: q.main() };
  }
}

/**
 * Whether a level of this kind moves as the screen (`toTarget`'s 'screen'): a
 * route, a winter step, the game, a Settings page. App fades such a screen in
 * after a back that animated nothing (a desktop Back button).
 */
export function movesScreen(kind: string | undefined): boolean {
  return kind === 'route' || kind === 'step' || kind === 'game' || kind === 'sp';
}

/**
 * What a hold hides for a level (back plan V1, 2026-09-30): its portal root,
 * scrim and all, or the card or layer itself. Null for a level that moves as
 * the screen, since hiding the screen shows nothing under it.
 */
export function holdTarget(level: Level, q: TargetQuery): HTMLElement | null {
  const root = (el: HTMLElement | null): HTMLElement | null => (
    el ? el.closest<HTMLElement>('.pb-sheet-host, .pb-dialog-host, .pb-picker-host') ?? el : null);
  switch (level.kind) {
    case 'guard': return level.id === 'guard:card' ? q.last('.pb-terms') ?? q.last('.big-moment') : null;
    case 'local': return root(level.element?.() ?? null);
    case 'c': return root(q.last('.pb-sheet-host > .pb-sheet'));
    case 'g': case 'p': case 't': case 'overlay': {
      const t = toTarget(level, q);
      return t.kind === 'layer' ? t.el ?? null : null;
    }
    default: return null;
  }
}

/**
 * App's `hold` for the ledger: hides every level from `from` (1-based, this
 * era's) up with `data-pb-hold`, and shows the rest again; null shows them
 * all. False, hiding nothing, when the level at `from` cannot be hidden.
 * Visibility only, so nothing moves; `pb:reveal` lets a dialog take focus.
 */
export function levelHolder(q: TargetQuery, list: () => readonly Level[]): (from: number | null) => boolean {
  let held: HTMLElement[] = [];
  return (from) => {
    const next: HTMLElement[] = [];
    let ok = true;
    if (from !== null) {
      const ls = list();
      const first = ls[from - 1];
      if (first && holdTarget(first, q)) {
        for (const l of ls.slice(from - 1)) {
          const el = holdTarget(l, q);
          if (el && !next.includes(el)) next.push(el);
        }
      } else ok = false;
    }
    for (const el of next) if (!held.includes(el)) el.setAttribute('data-pb-hold', '');
    const shown = held.filter((el) => !next.includes(el));
    for (const el of shown) el.removeAttribute('data-pb-hold');
    held = next;
    if (shown.length > 0 && typeof window !== 'undefined') window.dispatchEvent(new Event('pb:reveal'));
    return ok;
  };
}

/** The live page's query, for App. */
export function domQuery(main: () => HTMLElement | null): TargetQuery {
  return {
    last: (sel) => (typeof document === 'undefined'
      ? null : lastShown(document.querySelectorAll<HTMLElement>(sel))),
    main,
  };
}
