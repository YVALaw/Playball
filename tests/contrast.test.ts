// contrast.test.ts
// Every school's colour, on every surface it lands on, in both themes.
//
// This exists because `--navy` shipped for weeks painting dark ink on dark
// surfaces. It was defined once in the light block and never given a dark
// value, so the moment the theme flipped, ten rules kept using it as a text
// colour: the dugout's call buttons, the manager panel, the watch and sim
// commands, the round trigger, the postseason stage rail, the portal and
// recruit DONE states, the final-game link. Measured on the stage rail, the
// active tab was text `rgb(38,64,57)` on background `rgb(36,61,54)` — a
// contrast ratio of 1.04. Not low. Invisible.
//
// Reading one save in one theme was never going to find that, and neither was
// reading the stylesheet: the accent is filled at runtime from whichever
// school you coach, so the palette is ninety six palettes. Hence a test.
//
// The rule it enforces is WCAG AA: 4.5 for body text, 3.0 for large or bold.

import { describe, it, expect } from 'vitest';
import { accentPalette } from '../src/ui/accent.js';
import { CONFERENCES } from '../src/data/schools.js';

// ---------------------------------------------------------------------------
// Contrast, by the book
// ---------------------------------------------------------------------------

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255)
    + 0.7152 * channel((n >> 8) & 255)
    + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const l1 = Math.max(luminance(a), luminance(b));
  const l2 = Math.min(luminance(a), luminance(b));
  return (l1 + 0.05) / (l2 + 0.05);
}

// ---------------------------------------------------------------------------
// The surfaces, as tokens.css defines them
// ---------------------------------------------------------------------------

// Read off the light :root block. Guessing these once produced a failure
// that was the test being wrong rather than the palette, which is its own
// small lesson: a contrast test is only as true as its inputs.
const LIGHT = {
  paper: '#ffffff', wash: '#f5f7f2', field: '#fffefa', band: '#1d201d',
  ink: '#1d201d', cream: '#f4f8f4', mute: '#888e87',
  alert: '#c9362f', win: '#236b42', alertInk: '#f4f8f4',
};

const DARK = {
  paper: '#1c231d', wash: '#161c17', field: '#121711', band: '#26312a',
  ink: '#e4eae4', cream: '#f4f8f4', mute: '#93a094',
  alert: '#e0655e', win: '#4da97a', alertInk: '#121711',
};

/**
 * The pairs the stylesheet actually draws, named by what breaks if they fail.
 *
 * `large` marks the ones set in the display face at heading sizes, which AA
 * lets sit at 3.0 — the call buttons and the rail labels are 800-weight and
 * scale with the text-size setting, so they qualify.
 */
const PAIRS: readonly { text: string; on: string; large?: boolean; what: string }[] = [
  { text: 'ink', on: 'paper', what: 'body copy on a card' },
  { text: 'ink', on: 'wash', what: 'body copy on a quiet fill' },
  { text: 'ink', on: 'field', what: 'body copy on the chrome' },
  /*
    --mute marks the inactive: a step the career has not reached. AA exempts
    disabled controls from 4.5 entirely, so holding it there would make an
    unreached step look live. 3.0 is the floor that keeps it legible without
    letting it shout — and it is a real floor, because the light theme
    shipped this at 2.11 for months.
  */
  { text: 'mute', on: 'paper', large: true, what: 'an inactive label on a card' },
  { text: 'mute', on: 'wash', large: true, what: 'an inactive label on a fill' },
  { text: 'cream', on: 'band', what: 'reversed text on a dark band' },
  /*
    The confirm grammar — `Confirmable` in Kit.tsx.

    Three states that only ever appear on an irreversible press, which makes
    them the states least likely to be seen during ordinary development and the
    worst ones to have shipped illegible. The armed fill is the one that will
    be read under pressure: it is the sentence naming what is about to be
    spent.

    All three are held to the strict 4.5 rather than the 3.0 that AA allows
    bold text, because all three clear it — a pair that does not need the
    allowance should not be given it.

    The armed pair is the reason `--alert-ink` exists. `--alert` has to stay
    light in the dark theme, where it is a text colour on dark ground, so cream
    on it measured 3.16 and this test caught it before the button shipped. The
    fill flips its ink instead of its ground.
  */
  { text: 'alertInk', on: 'alert', what: 'the armed label on an armed button' },
  { text: 'alert', on: 'wash', what: 'a failed action reporting on a quiet fill' },
  { text: 'win', on: 'paper', what: 'a settled action on a card' },
];

describe('the palette carries its own text', () => {
  it('holds in the light theme', () => {
    for (const p of PAIRS) {
      const r = contrast(
        LIGHT[p.text as keyof typeof LIGHT], LIGHT[p.on as keyof typeof LIGHT],
      );
      expect(r, `${p.what} (${p.text} on ${p.on})`).toBeGreaterThanOrEqual(p.large ? 3 : 4.5);
    }
  });

  it('holds in the dark theme', () => {
    for (const p of PAIRS) {
      const r = contrast(
        DARK[p.text as keyof typeof DARK], DARK[p.on as keyof typeof DARK],
      );
      expect(r, `${p.what} (${p.text} on ${p.on})`).toBeGreaterThanOrEqual(p.large ? 3 : 4.5);
    }
  });

  it('separates a card from the page it sits on', () => {
    // Not by brightness — the surfaces are deliberately close, because
    // lifting a card on a dark ground reads as washed-out grey. The border
    // is what draws the edge, so the border is what has to be visible.
    expect(contrast('#3a463c', DARK.paper), 'the line against a card').toBeGreaterThan(1.5);
    expect(contrast('#3a463c', DARK.field), 'the line against the chrome').toBeGreaterThan(1.5);
  });
});

// ---------------------------------------------------------------------------
// And now all ninety six of them
// ---------------------------------------------------------------------------

const SCHOOLS = CONFERENCES.flatMap((c) => c.schools);

describe('every school can wear its own colour', () => {
  it('gives all ninety six a palette', () => {
    expect(SCHOOLS.length).toBe(96);
    for (const s of SCHOOLS) {
      expect(accentPalette(s.color), `${s.abbr} (${s.color})`).not.toBeNull();
    }
  });

  /*
    The accent as a text colour, which is where --navy went wrong.

    In the light theme the deep cut carries text on white and on the soft
    tint; in the dark theme the bright cut does the same job on the dark
    surfaces. Both are clamped by `tuned()` in accent.ts precisely so they
    can — this is the test that says whether the clamps are wide enough, for
    a crimson school and a gold one alike.
  */
  it('carries text on light surfaces, in every school colour', () => {
    const failures: string[] = [];
    for (const s of SCHOOLS) {
      const p = accentPalette(s.color)!;
      const onPaper = contrast(p.accentDeep!, LIGHT.paper);
      const onSoft = contrast(p.accentDeep!, p.accentSoft!);
      if (onPaper < 4.5) failures.push(`${s.abbr} deep on paper ${onPaper.toFixed(2)}`);
      if (onSoft < 4.5) failures.push(`${s.abbr} deep on its own soft ${onSoft.toFixed(2)}`);
    }
    expect(failures, failures.join(' · ')).toEqual([]);
  });

  it('carries text on dark surfaces, in every school colour', () => {
    const failures: string[] = [];
    for (const s of SCHOOLS) {
      const p = accentPalette(s.color)!;
      // --clay and --navy both resolve to the dark cut in the dark theme.
      const onPaper = contrast(p.accentDk!, DARK.paper);
      const onSoft = contrast(p.accentDk!, p.accentSoftDk!);
      const onField = contrast(p.accentDk!, DARK.field);
      if (onPaper < 4.5) failures.push(`${s.abbr} on paper ${onPaper.toFixed(2)}`);
      if (onSoft < 4.5) failures.push(`${s.abbr} on its own soft ${onSoft.toFixed(2)}`);
      if (onField < 4.5) failures.push(`${s.abbr} on chrome ${onField.toFixed(2)}`);
    }
    expect(failures, failures.join(' · ')).toEqual([]);
  });

  /*
    The settled state, which is the one pairing in the confirm grammar that is
    not a fixed pair at all.

    `.confirmable.is-done` puts `--win` on `--soft`, and `--soft` is the school
    accent's own tint — so a green word sits on ninety six different grounds,
    one of which might be a green. That is the exact shape of the bug this file
    was written for, and the header names the portal's DONE state as one of the
    rules that shipped broken the first time.
  */
  it('keeps a settled action legible on every school tint', () => {
    const failures: string[] = [];
    for (const s of SCHOOLS) {
      const p = accentPalette(s.color)!;
      const light = contrast(LIGHT.win, p.accentSoft!);
      const dark = contrast(DARK.win, p.accentSoftDk!);
      // 800-weight display at ten point: AA large, so 3.0.
      if (light < 3) failures.push(`${s.abbr} done on light tint ${light.toFixed(2)}`);
      if (dark < 3) failures.push(`${s.abbr} done on dark tint ${dark.toFixed(2)}`);
    }
    expect(failures, failures.join(' · ')).toEqual([]);
  });

  it('keeps white legible on the raised accent surfaces', () => {
    // The action button's disc, and the crest fields, both carry cream text
    // or a white monogram on the accent itself.
    const failures: string[] = [];
    for (const s of SCHOOLS) {
      const p = accentPalette(s.color)!;
      const light = contrast('#ffffff', p.accentDeep!);
      const dark = contrast('#ffffff', p.accentRaisedDk!);
      if (light < 4.5) failures.push(`${s.abbr} white on deep ${light.toFixed(2)}`);
      if (dark < 4.5) failures.push(`${s.abbr} white on raised ${dark.toFixed(2)}`);
    }
    expect(failures, failures.join(' · ')).toEqual([]);
  });
});
