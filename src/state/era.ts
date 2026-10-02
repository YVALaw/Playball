// era.ts
// Which frame the game is in, and the store middleware that knows it.
//
// App decided the frame with its own chain of `if`s and the store had no word
// for it, so the two could drift: a write that moved the game into the market
// or a new year left whatever layers the last frame had open (2026-09-30).
// `frameOf` is the one answer, App's frame branches read it, and `eraKey` is
// the frame of one career in one year -- the span a back gesture can walk.
//
// `withNav` sits under every store write, `useDynasty.setState` included. It
// stamps each store layer by its own id in the registry the local sheets share
// (`backLayers.ts`), and closes the old era's layers in the same write that
// ends it (`setEraReset` turns that off for a test). Keys the write names
// itself always win.
//
// No React, no DOM, and only types from the store: the store imports this.

import type { StateCreator } from 'zustand';
import type { DynastyStore } from './store.js';
import { stampLayer, unstampLayer } from './backLayers.js';

export type Frame = 'front' | 'legacy' | 'market' | 'loading' | 'june' | 'winter' | 'season';

type FrameState = Pick<DynastyStore,
  'atStart' | 'season' | 'needsTeam' | 'coach' | 'jobSearch' | 'userTeam' | 'bracket' | 'phase'>;
type EraState = FrameState & Pick<DynastyStore, 'loadedSlot' | 'year'>;
type LayerState = Pick<DynastyStore,
  'overlay' | 'overlayStack' | 'settingsPage' | 'coachSeat' | 'selectedPlayer' | 'godStack'>
  & { teamCard?: number | null };

/**
 * The frame on screen. Legacy before the market: a man let go and finished in
 * the same week retires. A resigner stays in the winter until `rollYear` sets
 * `jobSearch`. The live game is a level of the season, not a frame.
 */
export function frameOf(s: FrameState): Frame {
  if (!s.season && (s.atStart || s.needsTeam)) return 'front';
  if (s.season && s.coach.retiredYear !== undefined) return 'legacy';
  if (s.season && s.jobSearch) return 'market';
  if (!s.season || !s.season.teams[s.userTeam]) return 'loading';
  if (s.bracket !== null) return 'june';
  if (s.phase !== null) return 'winter';
  return 'season';
}

/** One frame of one career at one school in one year. */
export function eraKey(s: EraState): string {
  return `${frameOf(s)}|${s.loadedSlot}|${s.userTeam}|${s.year}`;
}

/** Every store-held layer open, bottom first, each by an id of its own. */
export function storeLayerIds(s: LayerState): string[] {
  const ids: string[] = [];
  /*
    The Settings page sits just over its Settings, covered or not: an overlay
    laid over it keeps the page, and uncovering it is no new open, so the page
    keeps its first stamp (2026-09-30).
  */
  const top = s.overlayStack.length;
  const at = s.settingsPage === 'index' || s.overlay === null ? -1
    : s.overlay === 'settings' ? top : s.overlayStack.map((l) => l.overlay).lastIndexOf('settings');
  s.overlayStack.forEach((l, i) => { ids.push(`o:${i}:${l.overlay}`); if (i === at) ids.push(`sp:${s.settingsPage}`); });
  if (s.overlay !== null) ids.push(`o:${top}:${s.overlay}`);
  if (at === top) ids.push(`sp:${s.settingsPage}`);
  if (s.teamCard !== undefined && s.teamCard !== null) ids.push(`t:${s.teamCard}`);
  if (s.coachSeat !== null) ids.push(`c:${s.coachSeat}`);
  if (s.selectedPlayer !== null) ids.push(`p:${s.selectedPlayer}`);
  s.godStack.forEach((_, i) => ids.push(`g:${i}`));
  return ids;
}

/**
 * On since the switch (SW, 2026-09-30): the ledger keeps one era's levels, so
 * the write that ends an era closes the old one's. Tests may turn it off.
 */
let eraReset = true;
export function setEraReset(on: boolean): void { eraReset = on; }

/*
  Visits: one number per arrival on a route, never reused, so a screen
  returned to by back and a later fresh visit to it are told apart (T,
  2026-09-30). Here, not in the store, because the era reset starts one too.
*/
let visitSeq = 0;
export function nextVisit(): number { return ++visitSeq; }

/**
 * What a write carries besides its own keys. Always: a move of tab, screen or
 * phase closes the team card, and a winter step taken below the era's first
 * lowers `stepBase` to it. With the era reset on, a new era also closes the
 * old one's layers, drops its trail and starts a visit. Not saved, any of it.
 */
function extraFor(
  prev: DynastyStore, patch: Partial<DynastyStore>, order: readonly string[],
): Partial<DynastyStore> | null {
  // Most writes are about neither: no copy of the whole state for them.
  if (!eraReset && !('tab' in patch || 'screen' in patch || 'phase' in patch || 'stepBase' in patch)) return null;
  const next = { ...prev, ...patch };
  const extra: Partial<DynastyStore> = {};
  if (prev.teamCard !== null
    && (next.tab !== prev.tab || next.screen !== prev.screen || next.phase !== prev.phase)) extra.teamCard = null;
  if (next.phase !== null && next.stepBase !== null && frameOf(next) === 'winter'
    && order.indexOf(next.phase) < order.indexOf(next.stepBase)) extra.stepBase = next.phase;
  if (eraReset && eraKey(next) !== eraKey(prev)) {
    Object.assign(extra, {
      overlay: null, overlayStack: [], selectedPlayer: null, coachSeat: null, godStack: [], settingsPage: 'index',
      teamCard: null, navTrail: [], restoringVisit: null, routeVisit: nextVisit(), stepBase: next.phase,
    } satisfies Partial<DynastyStore>);
    const frame = frameOf(next);
    if (frame === 'season' || frame === 'june') { extra.tab = 'home'; extra.screen = 'today'; }
  }
  // Under the patch: a key the write names is the write's.
  for (const k of Object.keys(patch)) delete (extra as Record<string, unknown>)[k];
  return Object.keys(extra).length > 0 ? extra : null;
}

/*
  The ids stamped now. Kept here rather than diffed from the write's `prev`,
  so a subscriber that writes during the notification cannot stamp twice.
*/
const stamped = new Set<string>();

function sameLayers(a: LayerState, b: LayerState): boolean {
  return a.overlay === b.overlay && a.overlayStack === b.overlayStack && a.settingsPage === b.settingsPage
    && a.coachSeat === b.coachSeat && a.selectedPlayer === b.selectedPlayer && a.godStack === b.godStack
    && a.teamCard === b.teamCard;
}

function syncStamps(s: LayerState): void {
  const now = new Set(storeLayerIds(s));
  for (const id of [...stamped]) if (!now.has(id)) { stamped.delete(id); unstampLayer(id); }
  for (const id of now) if (!stamped.has(id)) { stamped.add(id); stampLayer(id); }
}

type AnySet = (partial: unknown, replace?: boolean) => void;

/**
 * The store's middleware: one inner `set` per write, then the stamps. `order`
 * is the store's `PHASES`, handed in so this file needs no value from it.
 */
export function withNav(
  f: StateCreator<DynastyStore, [], []>, order: readonly string[] = [],
): StateCreator<DynastyStore, [], []> {
  return (set, get, api) => {
    const inner = set as AnySet;
    const write = ((partial: unknown, replace?: boolean) => {
      const prev = api.getState() as DynastyStore | undefined;
      const patch = typeof partial === 'function' ? (partial as (s: DynastyStore | undefined) => unknown)(prev) : partial;
      if (!prev || replace || patch === null || typeof patch !== 'object' || Object.is(patch, prev)) {
        inner(patch, replace);
      } else {
        const extra = extraFor(prev, patch as Partial<DynastyStore>, order);
        inner(extra ? { ...extra, ...patch } : patch);
      }
      const next = api.getState() as DynastyStore | undefined;
      if (next && !(prev && sameLayers(prev, next))) syncStamps(next);
    }) as typeof api.setState;
    api.setState = write;
    return f(write, get, api);
  };
}
