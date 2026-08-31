// adapt-prototype-css.mjs
// Turns design/Roster Tabletop/prototype.css into src/ui/prototype.css.
//
// The proposal's stylesheet is the design of record and we want to stay able to
// diff against it, so it is not edited by hand. Four mechanical differences
// separate the prototype from the app, and this script is all four of them:
//
//   1. Token names. The prototype calls the accent `--green` and the alarm
//      `--red`; this app has called them `--clay` and `--alert` since long
//      before the port, across twenty thousand lines. The stylesheet is the
//      newcomer, so the stylesheet moves.
//   2. Type scale. Every size in the prototype is a bare pixel value. Every
//      size in this app is `calc(Npx * var(--ts))`, which is the whole of the
//      text-size setting; a stylesheet that ignored it would be a stylesheet
//      the setting could not reach.
//   3. Faces, to `--display` and `--body`, so there is one place to change them.
//   4. The simulated phone. `--mobile-safe-area-height` and
//      `--device-safe-area-bottom` are the mockup harness's idea of a notch;
//      here that is `env(safe-area-inset-*)`.
//
// What it deliberately does NOT do is fix the layout model — the prototype
// positions its chrome absolutely against a phone-shaped box, and this app
// hangs it off a flex column. Those dozen rules are overridden in
// src/ui/prototype-frame.css, which is hand-written and loaded after this file.
//
//   node scripts/adapt-prototype-css.mjs

import fs from 'node:fs';

const SRC = 'design/Roster Tabletop/prototype.css';
const OUT = 'src/ui/prototype.css';

let css = fs.readFileSync(SRC, 'utf8');

// The fonts arrive from index.html, which preconnects; an @import here would
// serialise a second stylesheet fetch behind this one.
css = css.replace(/^@import url\([^)]*\);\s*/m, '');

// The palette lives in tokens.css. Dropping the prototype's :root is what makes
// the two files one design rather than two arguing about the same colours.
const rootBlock = /^:root \{[^}]*\}\s*/m;
if (!rootBlock.test(css)) throw new Error('prototype.css: no :root block to drop');
css = css.replace(rootBlock, '');

const RENAME = [
  [/var\(--green-dark\)/g, 'var(--navy)'],
  [/var\(--green-soft\)/g, 'var(--soft)'],
  [/var\(--green\)/g, 'var(--clay)'],
  [/var\(--muted\)/g, 'var(--dim)'],
  [/var\(--red\)/g, 'var(--alert)'],
  // The prototype's --paper is the ground the app sits on, which this app has
  // always called --field; --paper here means a card.
  [/var\(--paper\)/g, 'var(--field)'],
  [/var\(--mobile-safe-area-height\)/g, 'env(safe-area-inset-bottom)'],
  [/var\(--device-safe-area-bottom, 34px\)/g, 'env(safe-area-inset-bottom)'],
  [/"Barlow Condensed",\s*sans-serif/g, 'var(--display)'],
  [/"DM Sans",\s*sans-serif/g, 'var(--body)'],
];
for (const [re, to] of RENAME) css = css.replace(re, to);

/*
  5. Literals onto tokens, for the dark theme.

  The prototype paints its cards #fff and its recessed washes in a family of
  near-whites, which is correct for a mockup with one palette and fatal for an
  app with two: dark mode repaints the tokens, and a literal is a colour the
  repaint cannot reach. Only *surfaces* are mapped -- color:#fff is text on
  the navy panels and stays white in both themes, so it is left alone.
*/
const SURFACES = [
  // Cards and table surfaces.
  [/background:\s*#fff(?![0-9a-f])/g, 'background:var(--paper)'],
  // The recessed washes: filters, toolbars, selected rows, the step rail's
  // chip. One token, because they were never meaningfully different colours.
  [/#fffaf5|#f0f4ec|#f7f8f4|#f4f6f1|#f5f6f1|#f5f7f3|#f5f7f2|#f8faf6|#f8f8f5|#f8f8f4/g, 'var(--wash)'],
  // The dark bands: table heads, question cards, the FAB. They are black in
  // the light theme and must STAY dark in the dark one, where --ink flips
  // light -- so they get a surface token of their own.
  [/background:var\(--ink\)/g, 'background:var(--band)'],
  // The two translucent chrome bars. A .98 white is a theme decision the
  // tokens have to own; both bars are fixed rows of the frame, so opacity
  // was buying nothing.
  [/background:rgba\(255,255,255,\.98\)/g, 'background:var(--field)'],
  [/background:rgba\(255,254,250,\.98\)/g, 'background:var(--field)'],
  // Selected rows: the accent at rest, which is what --soft has always meant.
  [/#f3f7f2|#f2f7f2/g, 'var(--soft)'],
  // Light strokes that read as the hairline.
  [/#d9dcd7|#e1e6e1|#e1e5df|#bdc7bb/g, 'var(--line)'],
  // Grey ink on theme surfaces. Literals chosen against white, unreadable the
  // moment the surface goes dark: the log's body, the phase rail's unreached
  // steps, hairline borders in the log and stage rail.
  [/#647067|#7a807b|#8d958e|#a3a8a3/g, 'var(--dim)'],
  [/#dbe2d9|#cfd6cf/g, 'var(--line)'],
  // The inactive rail number and its greyed kin.
  [/#afb4af|#cfd3ce|#b9c4ba/g, 'var(--mute)'],
];
for (const [re, to] of SURFACES) css = css.replace(re, to);

// Sizes onto the text scale. Two shapes appear: the `font-size` longhand, and a
// `font:` shorthand whose size sits after the weight and may carry a line
// height. Anything already wearing a calc() is left alone so the script is safe
// to re-run.
let sized = 0;
css = css.replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, (_, px) => {
  sized++; return `font-size:calc(${px}px * var(--ts))`;
});
css = css.replace(/font:(\s*\d+\s+)(\d+(?:\.\d+)?)px/g, (_, weight, px) => {
  sized++; return `font:${weight}calc(${px}px * var(--ts))`;
});

const leftovers = css.match(/var\(--(green|red|muted|mobile-safe-area-height|device-safe-area-bottom)[^)]*\)/g);
if (leftovers) throw new Error(`prototype.css: un-renamed tokens: ${[...new Set(leftovers)].join(', ')}`);

const header = `/* prototype.css — GENERATED. Do not edit.
 *
 * Source: design/Roster Tabletop/prototype.css, the design of record.
 * Generated by: scripts/adapt-prototype-css.mjs
 *
 * Edit the source and re-run the script. The four mechanical adaptations are
 * documented at the top of it; the layout model is overridden by hand in
 * prototype-frame.css, which loads after this file.
 */

`;

fs.writeFileSync(OUT, header + css.trimStart());
console.log(`${OUT}: ${css.split('\n').length} lines, ${sized} sizes put on --ts`);
