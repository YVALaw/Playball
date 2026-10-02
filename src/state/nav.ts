// nav.ts
// Everything a back press can take, as one list, bottom first.
//
// App kept three hand-written copies of that answer -- `backRef` peeled in a
// fixed order, `peekRef` guessed what it would peel, `hasLayerToClose` armed
// the Android gesture -- and every drift between them was a preview that
// showed one screen and a release that landed on another (2026-09-30,
// back-plan §4 N). Here the list is derived from the store and the sheet
// registry, and the one level on top is both what the gesture shows and what
// it takes.
//
// Bottom to top: the frame's base (this era's route stops and the game, June's
// stops and its game guard, or the winter steps), the store's layers in the
// order they are drawn, each screen-held sheet just above the store layers
// opened before it, and a blocking card, which is always last.
//
// No React and no DOM; the element a level shows is found by navTarget.ts.

import {
  useDynasty, eraStops, stepStops, blockingCardUp, markBackGesture,
  type DynastyStore, type PeelResult,
} from './store.js';
import { eraKey, frameOf, storeLayerIds } from './era.js';
import { injuryClock } from '../engine/season.js';
import { localLayers, peelBackLayer, stampOf, subscribeBackLayers } from './backLayers.js';

export type LevelKind =
  | 'route' | 'step' | 'game' | 'guard'
  | 'overlay' | 'sp' | 't' | 'c' | 'p' | 'g'
  | 'local';

export interface Level {
  /** `r:<visit>` `st:<phase>` `game` `guard:<why>` `o:<i>:<name>` `sp:<page>` `t:<i>` `c:<seat>` `p:<id>` `g:<i>` `l:<registry id>` */
  id: string;
  kind: LevelKind;
  /** The registry's open order; 0 for the base and the guards. */
  stamp: number;
  /** A screen-held sheet's element, when it told the registry one. */
  element?: () => HTMLElement | null;
  peel(): PeelResult;
}

const S = (): DynastyStore => useDynasty.getState();
const refuse = (): PeelResult => { S().nudgeCard(); return 'refused'; };

function base(s: DynastyStore): Level[] {
  const frame = frameOf(s);
  if (frame === 'season' || frame === 'june') {
    const out: Level[] = eraStops(s).map((x) => ({
      id: `r:${x.visit}`, kind: 'route', stamp: 0, peel: () => S().goBack(),
    }));
    if (frame === 'season' && s.live && s.screen === 'box') {
      out.push({ id: 'game', kind: 'game', stamp: 0, peel: () => S().leaveGame() });
    }
    // A June game is played to its end: back is held, under the dugout's sheets.
    if (frame === 'june' && s.live) out.push({ id: 'guard:june-game', kind: 'guard', stamp: 0, peel: refuse });
    return out;
  }
  if (frame === 'winter') {
    return stepStops(s).map((p) => ({ id: `st:${p}`, kind: 'step', stamp: 0, peel: () => S().stepBack() }));
  }
  return [];
}

/** How each store layer closes, by the prefix of its id. */
function storeLevel(id: string): Level {
  const stamp = stampOf(id);
  switch (id.slice(0, id.indexOf(':'))) {
    case 'o': return { id, kind: 'overlay', stamp, peel: () => { S().closeOverlay(); return 'peeled'; } };
    case 'sp': return { id, kind: 'sp', stamp, peel: () => { S().setSettingsPage('index'); return 'peeled'; } };
    case 't': return { id, kind: 't', stamp, peel: () => { S().closeTeamCard(); return 'peeled'; } };
    case 'c': return { id, kind: 'c', stamp, peel: () => { S().closeCoach(); return 'peeled'; } };
    case 'p': return { id, kind: 'p', stamp, peel: () => { S().closePlayer(); return 'peeled'; } };
    default: return { id, kind: 'g', stamp, peel: () => { S().closeGod(); return 'peeled'; } };
  }
}

/**
 * Every level, bottom first. A sheet goes just above the highest store layer
 * opened before it (below them all if none was); sheets that land together
 * keep the order they registered in. A Settings page under an overlay laid
 * over it stays listed, with its own stamp (era.ts `storeLayerIds`).
 */
export function levels(s: DynastyStore = S()): Level[] {
  const store = storeLayerIds(s).map(storeLevel);
  const slots: Level[][] = store.map(() => []);
  const under: Level[] = [];
  for (const l of localLayers()) {
    const level: Level = {
      id: `l:${l.id}`, kind: 'local', stamp: l.id, element: l.element,
      peel: () => (peelBackLayer(l.id) ? 'peeled' : 'none'),
    };
    let at = -1;
    for (let j = store.length - 1; j >= 0; j--) if (store[j]!.stamp < l.id) { at = j; break; }
    (at < 0 ? under : slots[at]!).push(level);
  }
  const out = base(s).concat(under);
  store.forEach((lv, j) => { out.push(lv, ...slots[j]!); });
  if (blockingCardUp(s)) out.push({ id: 'guard:card', kind: 'guard', stamp: 0, peel: refuse });
  return out;
}

export function depth(s: DynastyStore = S()): number { return levels(s).length; }
export function newest(s: DynastyStore = S()): Level | null { return levels(s).at(-1) ?? null; }

/** One back press: whatever it uncovers arrives still, then the top level goes. */
export function peelNewest(): PeelResult {
  markBackGesture();
  return newest()?.peel() ?? 'none';
}

/** The ids as one string, so `useSyncExternalStore` compares a primitive. */
export function levelsKey(): string { return levels().map((l) => l.id).join(' '); }

/**
 * What the page shows with only the bottom `d` levels up: the era, the route
 * the peeled stops (or the game) would return to, the levels left and the
 * day. The ledger pushes an entry only once the frame on screen reads as the
 * level below it, so the swipe's picture is that frame (back plan V1,
 * 2026-09-30). The day is the injury clock, so a June night played reads as
 * another picture too; below the bottom (d < 0) reads as the bottom.
 */
export function levelSig(d: number, s: DynastyStore = S()): string {
  d = Math.max(0, d);
  const list = levels(s);
  const frame = frameOf(s);
  const key = (t: string, sc: string): string => (frame === 'june' && t === 'home' ? 'home' : `${t}|${sc}`);
  let route = key(s.tab, s.screen);
  if (frame === 'season' || frame === 'june') {
    const stops = eraStops(s);
    if (d < stops.length) route = key(stops[d]!.tab, stops[d]!.screen);
    else if (list[d]?.kind === 'game') route = key(s.tab, 'today'); // leaveGame's Today
  }
  const ids = list.slice(0, d).map((l) => l.id).join(',');
  return `${eraKey(s)}|${frame}|${route}|${ids}|${s.season ? injuryClock(s.season) : -1}`;
}

/** Both sources the list is read from. */
export function subscribe(fn: () => void): () => void {
  const offStore = useDynasty.subscribe(fn);
  const offLocal = subscribeBackLayers(fn);
  return () => { offStore(); offLocal(); };
}

/** Nothing running that a history collapse could race. */
export function idle(s: DynastyStore = S()): boolean { return !s.busy; }

/** The era now: the span the ledger keeps its entries in. */
export function eraNow(): string { return eraKey(S()); }

/** The shape `historySync` takes as its `nav`. */
export const ledgerNav = {
  depth: (): number => depth(),
  eraKey: eraNow,
  peelNewest,
  idle: (): boolean => idle(),
  newest: (): Level | null => newest(),
  levels: (): Level[] => levels(),
  levelSig: (d: number): string => levelSig(d),
  levelIds: (): string[] => levels().map((l) => l.id),
};
