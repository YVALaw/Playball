// backLayers.ts — the layers the back gesture can see, in the order they opened.
//
// Every sheet a screen holds in its own state -- a box score, the dugout
// picker, a prospect's file, the June lineup card, a confirm -- was once
// invisible to the back gesture, so a press with one open changed the screen
// underneath while the sheet stayed up. Reported 2026-09-16 as the gesture
// that "showed me the home menu with the hurt card, then after a split second
// went back to lineup on its own". The release audit had filed the mechanism
// (`15` §D): a counter every sheet holds while mounted.
//
// This is that counter, with a dismiss on each entry. `useDialogFocus` -- the
// contract every sheet already carries -- registers here on open, and the
// gesture peels it by calling its own dismiss. `era.ts` stamps the store's
// layers from the same counter, so `nav.ts` lists a sheet and a card in the
// order they were opened. Only state: `historySync.ts` turns the levels into
// history entries (CL, 2026-09-30). No React and no store in here: the store
// imports it.

/** One number for every layer, store or local, in the order they opened. */
let seq = 0;

const stamps = new Map<string, number>();

/** A store-held layer opened, by its `era.ts` id (`o:0:inbox`, `p:<id>` ...). The middleware calls these. */
export function stampLayer(kind: string): void { stamps.set(kind, ++seq); }
export function unstampLayer(kind: string): void { stamps.delete(kind); }
/** The newest store-held layer's number, or zero with none open. */
export function newestStoreLayer(): number {
  let top = 0;
  for (const v of stamps.values()) if (v > top) top = v;
  return top;
}
/** When this store layer opened, by the id `era.ts` stamps it under; zero if it is not stamped. */
export function stampOf(key: string): number { return stamps.get(key) ?? 0; }

interface Local {
  id: number;
  dismiss: () => void;
  /** The element that shows the layer, for the predictive back gesture to move. */
  element?: () => HTMLElement | null;
  /** The gesture took it and its dismiss is on the way: no longer a level. */
  peeled: boolean;
}

const locals: Local[] = [];
const listeners = new Set<() => void>();
const notify = (): void => { for (const l of listeners) l(); };

/** A locally held sheet opened. Returns the handle to release. */
export function registerBackLayer(dismiss: () => void, element?: () => HTMLElement | null): number {
  const id = ++seq;
  locals.push({ id, dismiss, element, peeled: false });
  notify();
  return id;
}

/** The sheet closed by its own control, or unmounted: it only leaves the list. */
export function releaseBackLayer(id: number): void {
  const i = locals.findIndex((l) => l.id === id);
  if (i < 0) return;
  locals.splice(i, 1);
  notify();
}

/** The newest local layer's number, or zero with none open. */
export function topBackLayer(): number {
  for (let i = locals.length - 1; i >= 0; i--) if (!locals[i]!.peeled) return locals[i]!.id;
  return 0;
}

/** The newest local layer's element, when it told us one. */
export function topBackLayerElement(): HTMLElement | null {
  for (let i = locals.length - 1; i >= 0; i--) {
    const l = locals[i]!;
    if (!l.peeled) return l.element?.() ?? null;
  }
  return null;
}

/**
 * Peel a local layer: mark it taken and call its dismiss. No id means
 * the newest; nav.ts names the one its list of levels has on top.
 */
export function peelBackLayer(id?: number): boolean {
  for (let i = locals.length - 1; i >= 0; i--) {
    const top = locals[i]!;
    if (top.peeled || (id !== undefined && top.id !== id)) continue;
    top.peeled = true;
    top.dismiss();
    notify();
    return true;
  }
  return false;
}

/** How many local layers are up, for arming the native gesture. */
export function backLayerCount(): number {
  return locals.filter((l) => !l.peeled).length;
}

/** The local layers still up, oldest first: nav.ts places each among the store's by its id. */
export function localLayers(): { id: number; element?: () => HTMLElement | null }[] {
  return locals.filter((l) => !l.peeled).map((l) => ({ id: l.id, element: l.element }));
}

export function subscribeBackLayers(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Tests only: forget everything. */
export function resetBackLayers(): void {
  locals.length = 0;
  stamps.clear();
  seq = 0;
  notify();
}

// On the console in a dev build, so a phone report about the gesture can be
// read against what the registry held: `__backLayers.count()`, `.top()`,
// `.store()`. Costs nothing in a build.
if (typeof window !== 'undefined' && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
  (window as unknown as { __backLayers: unknown }).__backLayers = {
    count: backLayerCount, top: topBackLayer, store: newestStoreLayer,
    stamps: () => Object.fromEntries(stamps),
  };
}
