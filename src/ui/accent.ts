// accent.ts
// The app in your school's colours.
//
// Proposed from play: "instead of white and green or gray and green, the green
// accent is instead changed to the team's colors they select." The whole design
// runs through `--clay`, so this is possible at all: everything active, every
// primary command, every selected row already reads one token.
//
// The token is not simply overwritten with the school's hex, for two reasons
// the palette learned the hard way:
//
//   1. Contrast. School colours are jersey colours — some are near-black navy,
//      some are a yellow that white text dies on. The accent has to carry
//      white text on the light theme and read against near-black on the dark
//      one, so the hue is kept and the lightness is clamped into the band each
//      theme needs.
//   2. Themes. An inline custom property beats *both* theme blocks, so writing
//      `--clay` directly would hand dark mode the light theme's accent. The
//      tokens file reads `--clay` through a pair of hooks instead — one per
//      theme — and this file fills the hooks.
//
// The alarm stays `--alert`. A crimson school makes the accent and the alarm
// neighbours again, which is the price of wearing your colours; the alarm
// keeps its own meaning by keeping its own places.

/** Hex to [r, g, b] 0-255. Returns null for anything that is not #rrggbb. */
function rgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
    : max === gn ? ((bn - rn) / d + 2) / 6
      : ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function fromHsl([h, s, l]: [number, number, number]): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const one = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(one(h + 1 / 3) * 255),
    Math.round(one(h) * 255),
    Math.round(one(h - 1 / 3) * 255),
  ];
}

const hex = ([r, g, b]: [number, number, number]): string =>
  `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

/** The team hue at a given lightness/saturation band. */
function tuned(
  base: [number, number, number], lLo: number, lHi: number, sMin: number,
): [number, number, number] {
  const [h, s, l] = toHsl(base);
  return fromHsl([h, clamp(Math.max(s, sMin), 0, 0.72), clamp(l, lLo, lHi)]);
}

/*
  Lightness is not brightness, and that is the whole problem.

  Every cut above is clamped on HSL lightness, which treats a saturated blue
  at 55% and a yellow at 55% as the same thing. The eye does not: relative
  luminance weights green at 0.72 and blue at 0.07, so a navy school's accent
  came out of a 48-60% band looking almost black. Measured across all ninety
  six colours, the dark cut failed to carry text on more than half of them —
  Selma Forge and Albuquerque landed at 2.34 against a card, where 4.5 is the
  floor for reading.

  So the band is a starting point and the CONTRAST is the constraint: walk
  the lightness until the colour can actually carry the text it has to, or
  until there is nowhere left to walk. tests/contrast.test.ts is the proof.
*/

const relLum = ([r, g, b]: [number, number, number]): number => {
  const ch = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};

const ratio = (a: [number, number, number], b: [number, number, number]): number => {
  const l1 = Math.max(relLum(a), relLum(b));
  const l2 = Math.min(relLum(a), relLum(b));
  return (l1 + 0.05) / (l2 + 0.05);
};

/**
 * The app's own dark surfaces, which the dark accent has to sit on.
 *
 * Kept in step with the dark blocks of `tokens.css` by the contrast test —
 * change one without the other and it fails.
 */
const DARK_PAPER: [number, number, number] = [28, 35, 29];
const DARK_FIELD: [number, number, number] = [18, 23, 17];
const WHITE: [number, number, number] = [255, 255, 255];
/** What the announcement panels actually print on `--navy`. */
const CREAM: [number, number, number] = [246, 241, 230];
const GOLD: [number, number, number] = [236, 184, 61];

/**
 * The navy-surface cut, contrast-walked like the dark one.
 *
 * `--accent-deep` was the one value still cut on the HSL band alone, and
 * the file's own warning above applied to it in full: a yellow or sky
 * school at lightness 0.20 is still BRIGHT to the eye, and the June banner
 * printed cream body and gold display on it — reported from the phone as
 * "bright color plus white letters, kind of hard to see." The panel's own
 * inks are the constraint: walk darker until cream body text clears 4.6
 * and the gold display line clears 3.0 (it is 32px display type, so the
 * large-text floor is the honest one).
 */
/**
 * The command accent. Every primary button is this colour under white
 * text, so the band is a starting point and white is the constraint —
 * the same lesson the dark cut and the deep cut each learned separately.
 */
function lightAccent(base: [number, number, number]): [number, number, number] {
  return untilLegible(base, 0.34, 0.30, -0.02, (c) => ratio(c, WHITE) >= 4.5);
}

function deepCut(base: [number, number, number]): [number, number, number] {
  return untilLegible(base, 0.20, 0.26, -0.02, (c) => (
    ratio(c, CREAM) >= 4.6 && ratio(c, GOLD) >= 3.0
  ));
}

/** Walk lightness one way until the colour clears every bar set for it. */
function untilLegible(
  base: [number, number, number], startL: number, sMin: number,
  step: number,
  clears: (c: [number, number, number]) => boolean,
): [number, number, number] {
  const [h, s] = toHsl(base);
  const sat = clamp(Math.max(s, sMin), 0, 0.72);
  let l = startL;
  let out = fromHsl([h, sat, l]);
  for (let i = 0; i < 60 && !clears(out); i++) {
    l = clamp(l + step, 0.04, 0.96);
    out = fromHsl([h, sat, l]);
    if (l <= 0.04 || l >= 0.96) break;
  }
  return out;
}

/** The custom properties this file owns, for a clean reset. */
const HOOKS = [
  '--accent', '--accent-rgb', '--accent-deep', '--accent-soft',
  '--accent-dk', '--accent-dk-rgb', '--accent-soft-dk', '--accent-raised-dk',
] as const;

/**
 * Dress the app in a school's colour, or take the suit back off with `null`.
 *
 * Every value is derived from one hue so the app still reads as one palette:
 * the accent at command strength, a deep version for the navy surfaces, a
 * whisper of it for selected rows, and the dark theme's brighter cut of each.
 */
/**
 * The eight values a school's colour becomes, without touching the document.
 *
 * Split out of `applyTeamAccent` so the palette can be CHECKED rather than
 * trusted: `tests/contrast.test.ts` runs every one of the ninety six school
 * colours through this and asserts that the text each value has to carry is
 * actually legible on the surface it sits on, in both themes. That test
 * exists because `--navy` shipped for weeks painting dark ink on dark
 * surfaces, and no amount of looking at one save was going to find it.
 */
export function accentPalette(colour: string): Record<string, string> | null {
  const base = rgb(colour);
  if (!base) return null;
  const softDk = tuned(base, 0.14, 0.19, 0.22);
  return {
    accent: hex(lightAccent(base)),
    accentDeep: hex(deepCut(base)),
    accentSoft: hex(tuned(base, 0.90, 0.94, 0.14)),
    accentSoftDk: hex(softDk),
    accentDk: hex(untilLegible(base, 0.54, 0.34, 0.02, (c) => (
      ratio(c, DARK_PAPER) >= 4.6
      && ratio(c, DARK_FIELD) >= 4.6
      && ratio(c, softDk) >= 4.6
    ))),
    accentRaisedDk: hex(untilLegible(base, 0.39, 0.32, -0.02, (c) => ratio(c, WHITE) >= 4.6)),
  };
}

export function applyTeamAccent(colour: string | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const base = colour ? rgb(colour) : null;
  if (!base) {
    for (const k of HOOKS) root.style.removeProperty(k);
    return;
  }
  const light = lightAccent(base);
  const deep = deepCut(base);
  const soft = tuned(base, 0.90, 0.94, 0.14);
  const softDk = tuned(base, 0.14, 0.19, 0.22);
  // Bright enough to be read on a card, on the chrome, and on its own tint.
  const dark = untilLegible(base, 0.54, 0.34, 0.02, (c) => (
    ratio(c, DARK_PAPER) >= 4.6
    && ratio(c, DARK_FIELD) >= 4.6
    && ratio(c, softDk) >= 4.6
  ));
  // Dark enough that the white on the action button's disc survives it.
  const raisedDk = untilLegible(base, 0.39, 0.32, -0.02, (c) => ratio(c, WHITE) >= 4.6);

  root.style.setProperty('--accent', hex(light));
  root.style.setProperty('--accent-rgb', light.join(', '));
  root.style.setProperty('--accent-deep', hex(deep));
  root.style.setProperty('--accent-soft', hex(soft));
  root.style.setProperty('--accent-dk', hex(dark));
  root.style.setProperty('--accent-dk-rgb', dark.join(', '));
  root.style.setProperty('--accent-soft-dk', hex(softDk));
  root.style.setProperty('--accent-raised-dk', hex(raisedDk));
}
