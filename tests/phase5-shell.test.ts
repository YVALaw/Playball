// phase5-shell.test.ts
// docs/18-fix-plan.md Phase 5, the Android side that JS can reach: the system
// bars follow the in-app theme (audit 17, M1), and the phone's font size
// becomes the app's Text size once, since the shell turns text zoom off (L59).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const native = vi.hoisted(() => ({ styles: [] as string[], scale: 1.3, plugin: true }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android' },
  SystemBars: { setStyle: async ({ style }: { style: string }) => { native.styles.push(style); } },
  SystemBarsStyle: { Dark: 'DARK', Light: 'LIGHT', Default: 'DEFAULT' },
  registerPlugin: () => ({
    fontScale: async () => {
      if (!native.plugin) throw new Error('not implemented');
      return { scale: native.scale };
    },
  }),
}));

const stored = new Map<string, string>();
const attrs = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => { stored.set(k, v); },
  },
};
(globalThis as unknown as { document: unknown }).document = {
  documentElement: {
    style: { setProperty: () => {} },
    setAttribute: (k: string, v: string) => { attrs.set(k, v); },
    removeAttribute: (k: string) => { attrs.delete(k); },
  },
};

import { applyPrefs, readPrefs, writePrefs, seedTextScaleFromPhone, DEFAULT_PREFS } from '../src/state/devicePrefs.js';

beforeEach(() => { stored.clear(); native.styles.length = 0; native.scale = 1.3; native.plugin = true; });

describe('the system bars follow the in-app theme (M1)', () => {
  it('dark, light, and the phone’s own answer for system', () => {
    applyPrefs({ ...DEFAULT_PREFS, theme: 'dark' });
    applyPrefs({ ...DEFAULT_PREFS, theme: 'light' });
    applyPrefs({ ...DEFAULT_PREFS, theme: 'system' });
    expect(native.styles).toEqual(['DARK', 'LIGHT', 'DEFAULT']);
  });
});

describe('the phone’s font size seeds the Text size once (L59)', () => {
  it('a first launch at a large system font starts at Larger, and is not asked again', async () => {
    await seedTextScaleFromPhone();
    expect(readPrefs().textScale).toBe(1.3);
    expect(readPrefs().tzs).toBe(true);
    native.scale = 0.85;
    await seedTextScaleFromPhone();
    expect(readPrefs().textScale, 'seeded once').toBe(1.3);
  });

  it('an existing choice is multiplied in, to the nearest step', async () => {
    writePrefs({ ...DEFAULT_PREFS, textScale: 1.15 });
    native.scale = 1.1;
    await seedTextScaleFromPhone();
    expect(readPrefs().textScale).toBe(1.3);
  });

  it('a shell without the plugin still zooms, so nothing changes', async () => {
    native.plugin = false;
    writePrefs({ ...DEFAULT_PREFS, textScale: 1.15 });
    await seedTextScaleFromPhone();
    expect(readPrefs().textScale).toBe(1.15);
    expect(readPrefs().tzs).toBeUndefined();
  });
});
