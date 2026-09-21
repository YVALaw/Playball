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

/** The palette. `system` follows prefers-color-scheme; the other two override. */
export type ThemePref = 'system' | 'light' | 'dark';

export interface DevicePrefs {
  /**
   * Whether the screens explain themselves the first time you reach them.
   *
   * A device preference rather than a save one: somebody who has played this
   * game before has played it before, and should not be taught the recruiting
   * board again because they started a second dynasty.
   */
  tutorials: boolean;
  /**
   * God mode, owned on this device. One purchase, permanent, for every
   * career on the phone; each career chooses at creation whether it is a
   * sandbox. The store purchase sets this at release; until then the
   * Settings page stands in for it.
   */
  godMode: boolean;
  /**
   * The text scale, multiplied into every font size in the app through the
   * `--ts` custom property. 1 is the design exactly as drawn.
   */
  textScale: number;
  /**
   * Stamped once the default became LARGE. Its absence means the stored
   * scale predates that and was never anybody's choice.
   */
  tsz?: boolean;
  /**
   * Stamped once the redesign set Normal as the default again. Before it, a
   * stored 1.3 was the old default rather than a choice.
   */
  ts2?: boolean;
  /** The dugout's field. 3D is the default and the design; 2D is the fallback. */
  field: FieldMode;
  /** Motion. `system` honours `prefers-reduced-motion`, the other two override. */
  motion: MotionPref;
  /**
   * Light or dark, or whatever the phone says.
   *
   * Asked for by name: 'this white is too bright and I am sure some players
   * would appreciate dark mode.' A device preference like the text size --
   * the same save on two phones should be allowed to look right on both.
   */
  theme: ThemePref;
  /**
   * Sound and haptics. Real since stage 14 (`ui/sound.ts`): default on, the
   * mute in Settings; `bcast` marks prefs written before that so an older
   * device is not switched on behind its owner's back.
   */
  sound: boolean;
  haptics: boolean;
  /**
   * Stamped once broadcast exists. Prefs written before it carried
   * sound/haptics values from an era when the toggles were disabled
   * placeholders — a stored false from then was never anybody's choice, so
   * the absence of this marker means "take the new defaults".
   */
  bcast?: boolean;
}

export const TEXT_SCALES: readonly { value: number; label: string }[] = [
  { value: 0.9, label: 'Small' },
  { value: 1, label: 'Normal' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Larger' },
];

export const DEFAULT_PREFS: DevicePrefs = {
  /*
    Normal again.

    The default was raised to Larger when the labels were seven-point mono
    capitals ("make the large text the default when we first start"). The
    redesign's type scale is readable at 1 — 13px labels, 15px body — so
    Normal is the comfortable size now, and the bigger ones are still one tap
    away in Settings.
  */
  textScale: 1,
  tsz: true,
  ts2: true,
  field: '3d',
  motion: 'system',
  theme: 'system',
  // ON since stage 14 — a silent game that ships its sound behind a toggle
  // stays a silent game. The mute is one tap away in settings.
  sound: true,
  haptics: true,
  bcast: true,
  // On, because a first-time player is the one who needs it and the one least
  // likely to go looking for a switch.
  tutorials: true,
  godMode: false,
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
  /*
    A stored 1 from before the default moved is not a choice.

    Same problem the broadcast had with its toggles: everybody who played
    before this change has `textScale: 1` written down, and none of them
    picked it. The `tsz` marker separates the eras — without it, take the
    new default; with it, the number really was chosen.
  */
  const chosen = TEXT_SCALES.some((t) => t.value === o.textScale);
  /*
    And a stored 1.3 from before the redesign is the old default, not a
    choice: Normal on the new scale is already bigger than Larger was on the
    old one, so it moves to Normal. Anything else that was chosen stays.
  */
  const oldDefault = o.ts2 !== true && o.textScale === 1.3;
  const scale = o.tsz === true && chosen && !oldDefault ? o.textScale! : DEFAULT_PREFS.textScale;
  return {
    textScale: scale,
    tsz: true,
    ts2: true,
    field: o.field === '2d' ? '2d' : '3d',
    motion: o.motion === 'reduced' || o.motion === 'full' ? o.motion : 'system',
    theme: o.theme === 'light' || o.theme === 'dark' ? o.theme : 'system',
    sound: o.bcast === true ? o.sound === true : true,
    haptics: o.bcast === true ? o.haptics === true : true,
    bcast: true,
    // Absent means on, unlike the two above: a save written before this switch
    // existed belongs to somebody who was being taught, and silently turning
    // their tutorials off would be a change they never asked for.
    tutorials: o.tutorials !== false,
    godMode: o.godMode === true,
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
  /*
    Two multipliers while the app moves over. --pb-ts is the setting itself
    and drives the design system's components. --ts drives the legacy
    stylesheets, whose sizes were drawn to be read at Larger, so it keeps
    them where they were: Normal on the new scale is 1.3 on the old one.
  */
  root.style.setProperty('--pb-ts', String(prefs.textScale));
  root.style.setProperty('--ts', String(Math.round(prefs.textScale * 1.3 * 1000) / 1000));
  // `system` removes the attribute entirely rather than writing a value,
  // because the media query is the correct answer whenever the user has not
  // overridden it, and an attribute that says "ask the OS" would still need the
  // media query to interpret it.
  if (prefs.motion === 'system') root.removeAttribute('data-motion');
  else root.setAttribute('data-motion', prefs.motion);
  // Same contract as motion: absent means 'ask the OS', and the media query in
  // tokens.css is what interprets the OS's answer.
  if (prefs.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', prefs.theme);
}
