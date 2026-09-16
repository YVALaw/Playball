// backLayers.ts — the layers the back gesture can see, in the order they opened.
//
// The back handler in App.tsx peels the store's layers in a fixed order: a
// player card, a coaching seat, a team card, an overlay, a god sheet. Every
// sheet a screen holds in its own state -- a box score, the dugout picker, a
// prospect's file, the June lineup card, a confirm -- was invisible to it, so a
// press with one of those open popped a history entry and changed the screen
// underneath while the sheet stayed up; and the browser, which previews the
// screenshot of the entry it is returning to, showed a page the app then did
// not produce. Reported 2026-09-16 as the gesture that "showed me the home
// menu with the hurt card, then after a split second went back to lineup on
// its own". The release audit had filed the mechanism (`15` §D): a counter
// every sheet holds while mounted.
//
// This is that counter, with a dismiss on each entry. `useDialogFocus` -- the
// contract every sheet already carries -- registers here on open, so a sheet
// spends one history entry the way a store layer does, and the gesture peels
// it by calling its own dismiss. The store's layers stamp themselves when they
// open, so a sheet and a card can be peeled in the order they were opened,
// whichever holds which. No React and no store in here: the store imports it.

/** One number for every layer, store or local, in the order they opened. */
let seq = 0;

const stamps = new Map<string, number>();

/** A store-held layer opened: a player card, a coach seat, an overlay, a god sheet, a team card. */
export function stampLayer(kind: string): void { stamps.set(kind, ++seq); }
export function unstampLayer(kind: string): void { stamps.delete(kind); }
/** The newest store-held layer's number, or zero with none open. */
export function newestStoreLayer(): number {
  let top = 0;
  for (const v of stamps.values()) if (v > top) top = v;
  return top;
}

interface Local {
  id: number;
  dismiss: () => void;
  /** The gesture already spent this layer's entry; the release must not spend another. */
  peeled: boolean;
}

const locals: Local[] = [];
const listeners = new Set<() => void>();
const notify = (): void => { for (const l of listeners) l(); };

/** The same two events the store's own layers use; App.tsx answers them. */
function checkpoint(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('playball:history-checkpoint'));
}
function consume(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('playball:history-consume', { detail: { count: 1 } }));
}

/** A locally held sheet opened. Spends one history entry; returns the handle to release. */
export function registerBackLayer(dismiss: () => void): number {
  const id = ++seq;
  locals.push({ id, dismiss, peeled: false });
  checkpoint();
  notify();
  return id;
}

/** The sheet closed by its own control (or unmounted): its entry is given back unless the gesture already spent it. */
export function releaseBackLayer(id: number): void {
  const i = locals.findIndex((l) => l.id === id);
  if (i < 0) return;
  const [gone] = locals.splice(i, 1);
  if (gone && !gone.peeled) consume();
  notify();
}

/** The newest local layer's number, or zero with none open. */
export function topBackLayer(): number {
  for (let i = locals.length - 1; i >= 0; i--) if (!locals[i]!.peeled) return locals[i]!.id;
  return 0;
}

/** Peel the newest local layer: mark its entry spent and call its dismiss. */
export function peelBackLayer(): boolean {
  for (let i = locals.length - 1; i >= 0; i--) {
    const top = locals[i]!;
    if (top.peeled) continue;
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
