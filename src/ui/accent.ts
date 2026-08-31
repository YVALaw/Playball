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
export function applyTeamAccent(colour: string | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const base = colour ? rgb(colour) : null;
  if (!base) {
    for (const k of HOOKS) root.style.removeProperty(k);
    return;
  }
  const light = tuned(base, 0.24, 0.40, 0.30);
  const deep = tuned(base, 0.13, 0.20, 0.26);
  const soft = tuned(base, 0.90, 0.94, 0.14);
  const dark = tuned(base, 0.48, 0.60, 0.34);
  const softDk = tuned(base, 0.14, 0.19, 0.22);
  const raisedDk = tuned(base, 0.34, 0.44, 0.32);

  root.style.setProperty('--accent', hex(light));
  root.style.setProperty('--accent-rgb', light.join(', '));
  root.style.setProperty('--accent-deep', hex(deep));
  root.style.setProperty('--accent-soft', hex(soft));
  root.style.setProperty('--accent-dk', hex(dark));
  root.style.setProperty('--accent-dk-rgb', dark.join(', '));
  root.style.setProperty('--accent-soft-dk', hex(softDk));
  root.style.setProperty('--accent-raised-dk', hex(raisedDk));
}
