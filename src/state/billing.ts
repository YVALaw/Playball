// billing.ts — the one purchase, through Google Play.
//
// God mode is owned once on the device (`DevicePrefs.godMode`, 05 §61.3) and
// until stage 19 a free button in Settings stood in for the purchase. This is
// the purchase: one non-consumable product on Google Play, bought here and
// restored here, through cordova-plugin-purchase, which Capacitor carries into
// the shell like any Cordova plugin. The rules of the file:
//
//   - Nothing in the app ever flips the entitlement except this module or the
//     test build's stand-in (`TEST_SHORTCUTS`). A store build has no free
//     button (05 §62.3).
//   - The plugin is a global the shell provides (`window.CdvPurchase`). In the
//     browser, in Vitest and in a shell without Play services it is absent, and
//     every export here answers honestly: not available, nothing bought.
//   - The module owns no React and no device prefs. It reports through a tiny
//     external store the settings screen subscribes to, and it tells whoever
//     initialised it when the product is owned — the app writes the pref.
//   - Nothing throws out of here. A billing failure is a line on the screen,
//     never a dead app.
//
// The product id is the one thing the reporter creates in the Play Console by
// hand; it has to match `GOD_MODE_PRODUCT` exactly.

export const GOD_MODE_PRODUCT = 'god_mode';

export interface BillingState {
  /** Play billing is reachable on this device: the plugin is present and initialised. */
  available: boolean;
  /** The store's own price string, once the product has been fetched ("$4.99"). */
  price: string | null;
  /** The store says this device owns the product. */
  owned: boolean;
  /** A purchase or a restore is in flight. */
  busy: boolean;
  /** The last thing that went wrong, in the store's words, or null. */
  error: string | null;
}

/*
  The slice of cordova-plugin-purchase v13 this file uses, typed here rather
  than imported from the plugin's own declarations: the plugin is a runtime
  global, and a compile-time dependency on its 8,000-line d.ts for six calls
  would tie every `tsc` to a file the browser build never sees.
*/
interface CdvProduct {
  id: string;
  owned: boolean;
  pricing?: { price: string } | null;
  getOffer(): { order(): Promise<unknown> } | undefined;
}
interface CdvTransaction {
  finish(): void;
  products: { id: string }[];
}
interface CdvWhen {
  approved(cb: (t: CdvTransaction) => void): CdvWhen;
  productUpdated(cb: (p: CdvProduct) => void): CdvWhen;
}
interface CdvStore {
  register(products: { id: string; type: string; platform: string }[]): void;
  when(): CdvWhen;
  error(cb: (e: { message?: string }) => void): void;
  initialize(platforms: string[]): Promise<unknown>;
  get(id: string, platform?: string): CdvProduct | undefined;
  restorePurchases(): Promise<unknown>;
}
export interface CdvPurchaseGlobal {
  store: CdvStore;
  ProductType: { NON_CONSUMABLE: string };
  Platform: { GOOGLE_PLAY: string };
}

const plugin = (): CdvPurchaseGlobal | null => {
  const g = globalThis as { CdvPurchase?: CdvPurchaseGlobal };
  return g.CdvPurchase?.store ? g.CdvPurchase : null;
};

let state: BillingState = { available: false, price: null, owned: false, busy: false, error: null };
const listeners = new Set<() => void>();
let initialised = false;
let onOwned: (() => void) | null = null;

function patch(next: Partial<BillingState>): void {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

/** The current state, for `useSyncExternalStore`. Stable between changes. */
export function billingState(): BillingState { return state; }

/** Subscribe, for `useSyncExternalStore`. Returns the unsubscribe. */
export function onBilling(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The store said the product is owned: remember it, and tell the app once. */
function nowOwned(): void {
  if (state.owned) return;
  patch({ owned: true, busy: false, error: null });
  onOwned?.();
}

function readProduct(p: CdvProduct | undefined): void {
  if (!p || p.id !== GOD_MODE_PRODUCT) return;
  patch({ price: p.pricing?.price ?? state.price });
  if (p.owned) nowOwned();
}

/**
 * Wire the store up, once, and find out what this device already owns.
 *
 * `opts.owned` is called the first time the store reports the product as
 * owned — on a fresh purchase and on a restore alike, which is what makes
 * a reinstall or a second device get its sandbox back without a button.
 * Safe to call anywhere: without the plugin it records `available: false`
 * and returns.
 */
export async function initBilling(opts: { owned: () => void }): Promise<BillingState> {
  onOwned = opts.owned;
  if (initialised) return state;
  const cdv = plugin();
  if (!cdv) { patch({ available: false }); return state; }
  initialised = true;
  try {
    const { store } = cdv;
    store.register([{
      id: GOD_MODE_PRODUCT,
      type: cdv.ProductType.NON_CONSUMABLE,
      platform: cdv.Platform.GOOGLE_PLAY,
    }]);
    store.error((e) => patch({ busy: false, error: e?.message ?? 'Google Play could not complete that.' }));
    store.when()
      // No server of our own to verify against: a non-consumable is finished
      // on approval, and the product's `owned` flag is the store's word.
      .approved((t) => {
        t.finish();
        if (t.products.some((p) => p.id === GOD_MODE_PRODUCT)) nowOwned();
      })
      .productUpdated((p) => readProduct(p));
    await store.initialize([cdv.Platform.GOOGLE_PLAY]);
    patch({ available: true });
    readProduct(store.get(GOD_MODE_PRODUCT, cdv.Platform.GOOGLE_PLAY));
  } catch (e) {
    patch({ available: false, error: e instanceof Error ? e.message : String(e) });
  }
  return state;
}

/**
 * Open the store's purchase sheet for god mode. Resolves once the sheet has
 * been handed the order; ownership arrives through `initBilling`'s callback
 * when the store approves it. False when there is nothing to buy from.
 */
export async function buyGodMode(): Promise<boolean> {
  const cdv = plugin();
  if (!cdv || !state.available || state.busy) return false;
  const product = cdv.store.get(GOD_MODE_PRODUCT, cdv.Platform.GOOGLE_PLAY);
  const offer = product?.getOffer();
  if (!offer) { patch({ error: 'Google Play has no offer for the sandbox right now.' }); return false; }
  patch({ busy: true, error: null });
  try {
    await offer.order();
    // The sheet closed; if the store approved, `approved` already fired.
    patch({ busy: false });
    return true;
  } catch (e) {
    patch({ busy: false, error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

/** Ask the store what this account owns — a reinstall, a new phone. */
export async function restorePurchases(): Promise<boolean> {
  const cdv = plugin();
  if (!cdv || !state.available || state.busy) return false;
  patch({ busy: true, error: null });
  try {
    await cdv.store.restorePurchases();
    readProduct(cdv.store.get(GOD_MODE_PRODUCT, cdv.Platform.GOOGLE_PLAY));
    patch({ busy: false });
    return true;
  } catch (e) {
    patch({ busy: false, error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

/** Tests only: forget the plugin and the listeners between cases. */
export function resetBillingForTests(): void {
  state = { available: false, price: null, owned: false, busy: false, error: null };
  listeners.clear();
  initialised = false;
  onOwned = null;
}
