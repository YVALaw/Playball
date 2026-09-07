// billing.test.ts
// The one purchase, against a fake of the plugin's surface (05 §61.3, stage 19).
//
// The real store is a device with Play services and a product the reporter
// creates by hand; what can be pinned here is the contract around it: no
// plugin means nothing is available and nothing is owned, an approved
// transaction is finished and reported once, a product the store already
// marks owned is reported at start-up (the restore on a reinstall), and a
// failure is a line of state rather than a throw.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GOD_MODE_PRODUCT, initBilling, buyGodMode, restorePurchases,
  billingState, onBilling, resetBillingForTests, type CdvPurchaseGlobal,
} from '../src/state/billing.js';

type Approved = (t: { finish(): void; products: { id: string }[] }) => void;
type Updated = (p: FakeProduct) => void;

interface FakeProduct {
  id: string;
  owned: boolean;
  pricing: { price: string } | null;
  getOffer: () => { order(): Promise<unknown> } | undefined;
}

function fakeStore(opts: { owned?: boolean; price?: string; noOffer?: boolean; failOrder?: boolean } = {}) {
  const calls: string[] = [];
  let approved: Approved = () => {};
  let updated: Updated = () => {};
  const product: FakeProduct = {
    id: GOD_MODE_PRODUCT,
    owned: opts.owned ?? false,
    pricing: { price: opts.price ?? '$4.99' },
    getOffer: () => (opts.noOffer ? undefined : {
      order: async () => {
        calls.push('order');
        if (opts.failOrder) throw new Error('declined');
        // The store approves: the plugin calls back, the product is owned.
        product.owned = true;
        approved({ finish: () => calls.push('finish'), products: [{ id: GOD_MODE_PRODUCT }] });
      },
    }),
  };
  const when = {
    approved: (cb: Approved) => { approved = cb; return when; },
    productUpdated: (cb: Updated) => { updated = cb; return when; },
  };
  const g: CdvPurchaseGlobal = {
    ProductType: { NON_CONSUMABLE: 'non consumable' },
    Platform: { GOOGLE_PLAY: 'android-playstore' },
    store: {
      register: (ps) => { calls.push(`register:${ps.map((p) => `${p.id}/${p.type}/${p.platform}`).join(',')}`); },
      when: () => when,
      error: () => {},
      initialize: async () => { calls.push('initialize'); updated(product); },
      get: (id) => (id === GOD_MODE_PRODUCT ? product : undefined),
      restorePurchases: async () => { calls.push('restore'); product.owned = true; updated(product); },
    },
  };
  return { g, calls, product };
}

const G = globalThis as { CdvPurchase?: CdvPurchaseGlobal };

beforeEach(() => { resetBillingForTests(); delete G.CdvPurchase; });
afterEach(() => { delete G.CdvPurchase; });

describe('without the plugin', () => {
  it('is not available, owns nothing, and buying or restoring does nothing', async () => {
    let owned = 0;
    const s = await initBilling({ owned: () => { owned++; } });
    expect(s.available).toBe(false);
    expect(s.owned).toBe(false);
    expect(await buyGodMode()).toBe(false);
    expect(await restorePurchases()).toBe(false);
    expect(owned).toBe(0);
    expect(billingState().error).toBeNull();
  });
});

describe('with the store', () => {
  it('registers one non-consumable on Google Play and reads its price', async () => {
    const { g, calls } = fakeStore({ price: '$3.49' });
    G.CdvPurchase = g;
    const s = await initBilling({ owned: () => {} });
    expect(calls[0]).toBe(`register:${GOD_MODE_PRODUCT}/non consumable/android-playstore`);
    expect(calls).toContain('initialize');
    expect(s.available).toBe(true);
    expect(s.price).toBe('$3.49');
    expect(s.owned).toBe(false);
  });

  it('finishes an approved purchase and reports ownership exactly once', async () => {
    const { g, calls } = fakeStore();
    G.CdvPurchase = g;
    let owned = 0;
    const seen: boolean[] = [];
    await initBilling({ owned: () => { owned++; } });
    onBilling(() => seen.push(billingState().owned));
    expect(await buyGodMode()).toBe(true);
    expect(calls).toContain('order');
    expect(calls).toContain('finish');
    expect(billingState().owned).toBe(true);
    expect(billingState().busy).toBe(false);
    expect(owned).toBe(1);
    // A second report from the store changes nothing.
    await restorePurchases();
    expect(owned).toBe(1);
    expect(seen).toContain(true);
  });

  it('restores what the account already owns at start-up, with no button pressed', async () => {
    const { g } = fakeStore({ owned: true });
    G.CdvPurchase = g;
    let owned = 0;
    const s = await initBilling({ owned: () => { owned++; } });
    expect(s.owned).toBe(true);
    expect(owned).toBe(1);
  });

  it('turns a declined order into a line of state, not a throw', async () => {
    const { g } = fakeStore({ failOrder: true });
    G.CdvPurchase = g;
    await initBilling({ owned: () => {} });
    expect(await buyGodMode()).toBe(false);
    expect(billingState().error).toBe('declined');
    expect(billingState().busy).toBe(false);
    expect(billingState().owned).toBe(false);
  });

  it('says so when the store has no offer', async () => {
    const { g } = fakeStore({ noOffer: true });
    G.CdvPurchase = g;
    await initBilling({ owned: () => {} });
    expect(await buyGodMode()).toBe(false);
    expect(billingState().error).toMatch(/no offer/);
  });

  it('initialises once however often the app asks', async () => {
    const { g, calls } = fakeStore();
    G.CdvPurchase = g;
    await initBilling({ owned: () => {} });
    await initBilling({ owned: () => {} });
    expect(calls.filter((c) => c === 'initialize')).toHaveLength(1);
  });
});
