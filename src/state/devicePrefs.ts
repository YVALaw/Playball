// devicePrefs.ts
// The settings that belong to the phone rather than to the dynasty.
//
// There are two kinds of preference in this game and keeping them apart is the
// whole design of the settings sheet. **How you want to play** — the depth mode
// and its per-system toggles — is a property of a career: it was chosen when the
// coach was created, it describes that dynasty, and it rides the save so a
// dynasty carried to another device is still the dynasty you were playing.
//
// **How the app should behave** is not. Text size, sound, whether the field is
// drawn in three dimensions — those describe a person and a screen, not a coach.
// Loading an old save must not shrink your text, and starting a new dynasty must
// not turn the sound back on. So they live here, in `localStorage`, keyed to the
// device and shared by every save on it.
//
// Written synchronously for the same reason the live-game journal is (see
// `liveJournal.ts`): a preference that needed an async write would be a
// preference that could be lost by closing the app at the wrong moment, and
// nothing is more irritating than a text size that does not stick.

/** Where the field is drawn as a diamond rather than a 3D scene. */
export type FieldMode = '3d' | '2d';

/** Following the OS, or overriding it in either direction. */
export type MotionPref = 'system' | 'reduced' | 'full';

export interface DevicePrefs {
  /**
   * The text scale, multiplied into every font size in the app through the
   * `--ts` custom property. 1 is the design exactly as drawn.
   */
  textScale: number;
  /** The dugout's field. 3D is the default and the design; 2D is the fallback. */
  field: FieldMode;
  /** Motion. `system` honours `prefers-reduced-motion`, the other two override. */
  motion: MotionPref;
  /**
   * Sound and haptics. Neither exists yet — the game is completely silent and
   * always has been — so these are stored, defaulted off, and shown disabled
   * until the broadcast stage builds them. Kept here rather than added later so
   * that turning them on is a one-line change rather than a migration.
   */
  sound: boolean;
  haptics: boolean;
}

export const TEXT_SCALES: readonly { value: number; label: string }[] = [
  { value: 0.9, label: 'Small' },
  { value: 1, label: 'Normal' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Larger' },
];

export const DEFAULT_PREFS: DevicePrefs = {
  textScale: 1,
  field: '3d',
  motion: 'system',
  sound: false,
  haptics: false,
};

const KEY = 'playball.prefs.v1';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // A browser set to block site data throws on the property itself rather
    // than on the call, so the guard has to be around the access.
    return null;
  }
}

/**
 * Read the stored preferences, falling back to the defaults for anything
 * missing or nonsensical.
 *
 * Deliberately forgiving field by field rather than all-or-nothing: a
 * preferences file from a future version with one unknown value should cost the
 * user that one value, not every setting they have ever chosen.
 */
export function readPrefs(): DevicePrefs {
  const s = storage();
  if (!s) return { ...DEFAULT_PREFS };
  let raw: unknown;
  try {
    const text = s.getItem(KEY);
    if (!text) return { ...DEFAULT_PREFS };
    raw = JSON.parse(text);
  } catch {
    return { ...DEFAULT_PREFS };
  }
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFS };
  const o = raw as Partial<DevicePrefs>;
  const scale = TEXT_SCALES.some((t) => t.value === o.textScale)
    ? o.textScale! : DEFAULT_PREFS.textScale;
  return {
    textScale: scale,
    field: o.field === '2d' ? '2d' : '3d',
    motion: o.motion === 'reduced' || o.motion === 'full' ? o.motion : 'system',
    sound: o.sound === true,
    haptics: o.haptics === true,
  };
}

export function writePrefs(prefs: DevicePrefs): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Out of quota, or private browsing. The app keeps working with whatever is
    // in memory; the preference simply will not survive a reload, which is
    // better than a crash on a settings screen.
  }
}

/**
 * Push the preferences that are expressed in CSS onto the document.
 *
 * Only two of them are: the text scale, which every font size multiplies
 * against, and motion, which turns the animation classes off by forcing the
 * same switch `prefers-reduced-motion` throws. The rest are read by components.
 *
 * Called on load and on every change, so it must be cheap and idempotent.
 */
export function applyPrefs(prefs: DevicePrefs): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--ts', String(prefs.textScale));
  // `system` removes the attribute entirely rather than writing a value,
  // because the media query is the correct answer whenever the user has not
  // overridden it, and an attribute that says "ask the OS" would still need the
  // media query to interpret it.
  if (prefs.motion === 'system') root.removeAttribute('data-motion');
  else root.setAttribute('data-motion', prefs.motion);
}
