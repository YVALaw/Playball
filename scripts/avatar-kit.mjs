// avatar-kit.mjs
// Draws the profile-avatar component kit and renders it to PNG.
//
// The kit is authored as SVG and rasterised with sharp, which is already in the
// tree for the Capacitor icon pipeline. Every part lands on its own transparent
// 128x128 canvas on a shared head geometry, so any hair stacks onto any skin
// onto any jersey without registration marks or hand-nudging.
//
// Output is a standalone kit under design/avatar-kit/. It deliberately does not
// touch src/ui/Avatar.tsx: that renderer works, ships no bytes, and replacing it
// with seventy PNGs on a mobile build is a decision to make after seeing the art.
//
//   node scripts/avatar-kit.mjs

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = 'design/avatar-kit';
const S = 128;

// The reference sheet's near-black navy, not true black. It is what makes the
// flat fills read as drawn rather than as clip art.
const INK = '#1a2333';
const W = 4.5; // outline weight at 128px
const CREAM = '#f6f1e6';

/* ---------------------------------------------------------------- palette --
 * Anchored on the six tones already in Avatar.tsx so a PNG portrait and an SVG
 * portrait of the same league look like the same game. Extended to ten at the
 * light and dark ends to cover the range the reference sheet spans.
 */
const SKIN = [
  '#ffe3c8', '#f7d0ad', '#f0c9a6', '#e0ab82', '#c68a5e',
  '#b07a4e', '#a26b43', '#8a5a37', '#7a4e2d', '#5a3720',
];
const HAIR = {
  black: '#1c1410', darkBrown: '#2e1f16', brown: '#4a3121',
  midBrown: '#6b4a2a', lightBrown: '#9a6b3a', blonde: '#e3bd62',
};
const EYES = ['#4a3121', '#c68a5e', '#236b42', '#1f5fd0', '#9aa7b4'];

/* ------------------------------------------------------------- geometry --
 * One head for the whole kit. The top half is a true ellipse so hairlines can
 * be computed against it; the bottom half is a jaw.
 */
const HEAD_CY = 58, RX = 32, RY = 34;        // top of head at y=24
const EYE_Y = 58, EAR_Y = 62;
const HEAD_PATH = 'M32 58 A32 34 0 0 1 96 58 C96 78 84 92 64 92 C44 92 32 78 32 58 Z';
/** x-offset from centre of the head ellipse at height y. */
const ovalX = (y) => RX * Math.sqrt(Math.max(0, 1 - ((y - HEAD_CY) / RY) ** 2));

const svg = (body, w = S, h = S) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const stroke = (sw = W) =>
  `stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`;

/* ------------------------------------------------------------------ head -- */

const ears = (skin) => `<g ${stroke()} fill="${skin}">
    <ellipse cx="32" cy="${EAR_Y}" rx="7" ry="8.5"/>
    <ellipse cx="96" cy="${EAR_Y}" rx="7" ry="8.5"/></g>`;
const neck = (skin) => `<rect x="55" y="82" width="18" height="20" rx="6" ${stroke()} fill="${skin}"/>`;
const face = (skin) => `<path d="${HEAD_PATH}" ${stroke()} fill="${skin}"/>`;

/** The bare head: ears, neck, face. Everything the reference calls a head. */
const head = (skin) => `${neck(skin)}${ears(skin)}${face(skin)}`;

const mouth = `<path d="M58 78 Q64 83.5 70 78" ${stroke(3.5)} fill="none"/>`;

/* ------------------------------------------------------------------ eyes --
 * The reference draws eyes as dots and nothing else — no brows, no lids. Six
 * variations on the dot.
 */
const EYE_STYLES = {
  dots:      (c) => `<g fill="${INK}"><circle cx="51" cy="${EYE_Y}" r="5"/><circle cx="77" cy="${EYE_Y}" r="5"/></g>`,
  small:     (c) => `<g fill="${INK}"><circle cx="52" cy="${EYE_Y}" r="4"/><circle cx="76" cy="${EYE_Y}" r="4"/></g>`,
  large:     (c) => `<g fill="${INK}"><circle cx="50" cy="${EYE_Y}" r="6.5"/><circle cx="78" cy="${EYE_Y}" r="6.5"/></g>`,
  highlight: (c) => `<g fill="${INK}"><circle cx="50" cy="${EYE_Y}" r="6.5"/><circle cx="78" cy="${EYE_Y}" r="6.5"/></g>
                     <g fill="#fff"><circle cx="52" cy="${EYE_Y - 2}" r="2"/><circle cx="80" cy="${EYE_Y - 2}" r="2"/></g>`,
  iris:      (c) => `<g fill="${c}" ${stroke(3)}><circle cx="51" cy="${EYE_Y}" r="6"/><circle cx="77" cy="${EYE_Y}" r="6"/></g>
                     <g fill="${INK}"><circle cx="51" cy="${EYE_Y}" r="2.5"/><circle cx="77" cy="${EYE_Y}" r="2.5"/></g>`,
  oval:      (c) => `<g fill="${INK}"><ellipse cx="51" cy="${EYE_Y}" rx="4.5" ry="6"/><ellipse cx="77" cy="${EYE_Y}" rx="4.5" ry="6"/></g>`,
};

/* ---------------------------------------------------------- facial hair --
 * Six, all hung off the jaw. The mustache is shared: it sits just above the
 * mouth line so it composes with any eye style.
 */
const mustache = (c) => `<path d="M49 74 C55 67 60 71 64 71 C68 71 73 67 79 74
    C74 78 68 79 64 79 C60 79 54 78 49 74 Z" ${stroke()} fill="${c}"/>`;

const FACIAL = {
  full: (c) => `<path d="M33 60 C32 86 46 98 64 98 C82 98 96 86 95 60
      C93 80 80 88 64 88 C48 88 35 80 33 60 Z" ${stroke()} fill="${c}"/>${mustache(c)}`,
  handlebar: (c) => `<path d="M44 76 C50 66 58 71 64 71 C70 71 78 66 84 76
      C86 81 80 83 78 79 C74 82 68 83 64 83 C60 83 54 82 50 79 C48 83 42 81 44 76 Z"
      ${stroke()} fill="${c}"/>`,
  pencil: (c) => `<path d="M52 74 C58 70 62 72 64 72 C66 72 70 70 76 74
      C70 76.5 66 77.5 64 77.5 C62 77.5 58 76.5 52 74 Z" ${stroke(3.5)} fill="${c}"/>
      <ellipse cx="64" cy="88" rx="4" ry="3" ${stroke(3.5)} fill="${c}"/>`,
  goatee: (c) => `<path d="M52 80 C52 94 57 100 64 100 C71 100 76 94 76 80
      C74 90 69 92 64 92 C59 92 54 90 52 80 Z" ${stroke()} fill="${c}"/>${mustache(c)}`,
  thick: (c) => `<path d="M31 56 C30 90 46 106 64 106 C82 106 98 90 97 56
      C94 80 82 88 64 88 C46 88 34 80 31 56 Z" ${stroke()} fill="${c}"/>${mustache(c)}`,
  long: (c) => `<path d="M31 56 C28 96 44 120 64 120 C84 120 100 96 97 56
      C94 80 82 88 64 88 C46 88 34 80 31 56 Z" ${stroke()} fill="${c}"/>${mustache(c)}`,
};

/* ------------------------------------------------------------------ hair --
 * Every cut is two layers: `back` goes behind the head (volume, strands,
 * ponytail), `front` goes over it (the hairline and anything framing the
 * face). A cap simply draws on top; whatever it does not cover is what shows.
 *
 * cap() builds the front layer: the top of the head ellipse from a given
 * height, closed by a hairline that runs right-to-left back to the start. A
 * hairline function emits path commands up to but not including that final
 * point; cap() supplies it.
 */
const g = (c, inner, sw = W) => `<g ${stroke(sw)} fill="${c}">${inner}</g>`;
const p = (d) => `<path d="${d}"/>`;
const circles = (pts, r) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');

/** The two hairlines the reference uses most: a clean arc and a bumpy one. */
const smoothLine = (peak) => (xr, xl) => `C${+xr - 8} ${peak} ${+xl + 8} ${peak}`;
const bumpyLine  = (peak) => (xr, xl) =>
  `C${+xr - 2} ${peak + 8} ${+xr - 8} ${peak - 2} ${+xr - 14} ${peak + 2}
   C${+xr - 20} ${peak - 4} ${+xr - 26} ${peak + 4} 64 ${peak}
   C${+xl + 26} ${peak + 4} ${+xl + 20} ${peak - 4} ${+xl + 14} ${peak + 2}
   C${+xl + 8} ${peak - 2} ${+xl + 2} ${peak + 8}`;

function cap(yl, fn) {
  const ox = ovalX(yl);
  const xl = (64 - ox).toFixed(1), xr = (64 + ox).toFixed(1);
  return `M${xl} ${yl} A${RX} ${RY} 0 0 1 ${xr} ${yl} ${fn(xr, xl)} ${xl} ${yl} Z`;
}

const HAIR_STYLES = [
  { name: 'afro', color: HAIR.black,
    back:  (c) => g(c, `<ellipse cx="64" cy="40" rx="38" ry="28"/>${circles([[30, 48], [38, 30], [54, 18], [74, 18], [90, 30], [98, 48]], 13)}`),
    front: (c) => g(c, p(cap(50, bumpyLine(38)))) },

  { name: 'buzz', color: HAIR.midBrown,
    back:  () => '',
    front: (c) => g(c, p(cap(52, smoothLine(36)))) },

  { name: 'curls-tight', color: HAIR.brown,
    back:  (c) => g(c, circles([[35, 46], [40, 33], [50, 24], [64, 20], [78, 24], [88, 33], [93, 46]], 8.5)),
    front: (c) => g(c, p(cap(50, bumpyLine(40)))) },

  { name: 'spiky', color: HAIR.black,
    back:  (c) => g(c, p('M32 52 L36 30 L44 38 L50 16 L58 30 L64 12 L70 30 L78 16 L84 38 L92 30 L96 52 Z')),
    front: (c) => g(c, p(cap(50, smoothLine(38)))) },

  { name: 'side-part', color: HAIR.midBrown,
    back:  () => '',
    front: (c) => g(c, p(cap(52, (xr, xl) => `C${+xr - 2} 40 ${+xr - 12} 33 70 34 C54 36 44 42 41 54 C39 58 ${+xl + 2} 57`))) },

  { name: 'blonde-curls', color: HAIR.blonde,
    back:  (c) => g(c, `<ellipse cx="64" cy="52" rx="44" ry="38"/>${circles([[24, 58], [104, 58], [26, 76], [102, 76], [30, 34], [98, 34], [48, 16], [80, 16]], 12)}`),
    front: (c) => g(c, `${p(cap(48, bumpyLine(36)))}${circles([[31, 66], [97, 66], [33, 82], [95, 82]], 10)}`) },

  { name: 'bob', color: HAIR.brown,
    back:  (c) => g(c, p('M26 60 C26 30 42 18 64 18 C86 18 102 30 102 60 L102 86 C102 93 96 94 92 92 L36 92 C32 94 26 93 26 86 Z')),
    front: (c) => g(c, `${p(cap(50, smoothLine(36)))}
      <path d="M33 50 C27 58 26 76 30 92 L41 92 C36 78 36 62 41 52 Z"/>
      <path d="M95 50 C101 58 102 76 98 92 L87 92 C92 78 92 62 87 52 Z"/>`) },

  { name: 'dreads', color: HAIR.black,
    back:  (c) => g(c, `<ellipse cx="64" cy="38" rx="38" ry="22"/>
      <rect x="21" y="38" width="9" height="66" rx="4.5"/><rect x="33" y="48" width="9" height="56" rx="4.5"/>
      <rect x="86" y="48" width="9" height="56" rx="4.5"/><rect x="98" y="38" width="9" height="66" rx="4.5"/>`),
    front: (c) => g(c, `${p(cap(50, bumpyLine(40)))}
      <rect x="29" y="50" width="8" height="40" rx="4"/><rect x="91" y="50" width="8" height="40" rx="4"/>`) },

  { name: 'bald', color: HAIR.black, back: () => '', front: () => '' },

  { name: 'crop', color: HAIR.darkBrown,
    back:  (c) => g(c, circles([[40, 30], [52, 22], [64, 20], [76, 22], [88, 30]], 6)),
    front: (c) => g(c, p(cap(50, smoothLine(40)))) },

  { name: 'curls-loose', color: HAIR.black,
    back:  (c) => g(c, circles([[33, 42], [39, 28], [51, 19], [64, 16], [77, 19], [89, 28], [95, 42]], 10.5)),
    front: (c) => g(c, p(cap(50, bumpyLine(38)))) },

  { name: 'ponytail', color: HAIR.brown,
    back:  (c) => g(c, p('M94 62 C110 62 116 82 110 100 C106 110 96 110 94 102 C100 92 98 76 90 68 Z')),
    front: (c) => g(c, p(cap(50, smoothLine(36)))) },
];

/* ------------------------------------------------------------------ hats --
 * A cap seen from a little left of front: the dome sits over the top of the
 * head and the bill sweeps out to the viewer's left, tip at about brow height.
 * The bill is drawn first so the crown overlaps its root.
 */
function hat({ crown, brim, panel, letter, letterColor, camo, back }) {
  if (back) {
    // The snapback seen from behind: no bill, strap through an arch.
    return `<g ${stroke()}>
      <path d="M28 50 C28 26 44 8 64 8 C84 8 100 26 100 50 Q64 56 28 50 Z" fill="${crown}"/>
      <path d="M50 50 C50 39 78 39 78 50 Z" fill="${crown}"/>
      <rect x="49" y="44" width="30" height="7" rx="2" fill="${brim}"/>
      <circle cx="64" cy="10" r="3" fill="${brim}"/></g>
      <g fill="#fff"><circle cx="57" cy="47.5" r="1.4"/><circle cx="64" cy="47.5" r="1.4"/><circle cx="71" cy="47.5" r="1.4"/></g>`;
  }
  return `
    <g ${stroke()}>
      <path d="M38 44 C26 42 8 46 4 54 C2 60 10 64 20 62 C30 60 34 54 40 52 Z" fill="${brim}"/>
      <path d="M28 50 C28 26 44 8 64 8 C84 8 100 26 100 50 Q64 56 28 50 Z" fill="${crown}"/>
      ${panel ? `<path d="M50 51 C52 30 56 12 64 9 C72 12 76 30 78 51 Q64 54 50 51 Z" fill="${panel}"/>` : ''}
      ${camo ? `<g fill="#3f4a2a" stroke="none" opacity="0.8">
          <ellipse cx="46" cy="32" rx="9" ry="7"/><ellipse cx="70" cy="22" rx="10" ry="7"/>
          <ellipse cx="86" cy="40" rx="8" ry="6"/><ellipse cx="58" cy="44" rx="9" ry="6"/></g>` : ''}
      <circle cx="64" cy="10" r="3" fill="${brim}"/>
    </g>
    ${letter ? `<text x="64" y="41" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="24"
        fill="${letterColor}" stroke="${INK}" stroke-width="1" paint-order="stroke">${letter}</text>` : ''}`;
}

const NAVY = '#1b2a52', RED = '#c8202e', BLUE = '#1f5fd0', GOLD = '#e0b500',
  GREEN = '#0f5c34', PURPLE = '#6b2fb5', ORANGE = '#e86a10', WHITE = '#ffffff',
  GREY = '#9aa0a6', BLACK = '#141414', MAROON = '#7a1a2b';

const HATS = [
  { name: 'navy',        crown: NAVY,  brim: NAVY },
  { name: 'red',         crown: RED,   brim: RED },
  { name: 'white-blue',  crown: WHITE, brim: BLUE,  letter: 'S', letterColor: BLUE },
  { name: 'black-gold',  crown: BLACK, brim: GOLD,  letter: 'A', letterColor: GOLD },
  { name: 'white-green', crown: WHITE, brim: GREEN, panel: GREEN },
  { name: 'white-red',   crown: WHITE, brim: RED,   panel: RED },
  { name: 'white-purple',crown: WHITE, brim: PURPLE, panel: PURPLE },
  { name: 'orange-blue', crown: ORANGE, brim: BLUE },
  { name: 'grey-black',  crown: GREY,  brim: BLACK },
  { name: 'camo',        crown: '#7a8455', brim: '#5c6440', camo: true },
  { name: 'white-navy',  crown: WHITE, brim: NAVY },
  { name: 'snapback-back', crown: WHITE, brim: NAVY, back: true },
];

/* --------------------------------------------------------------- jerseys --
 * Button-front baseball jersey: boxy body, short sleeves, V opening over a
 * white undershirt, placket with buttons, piping in the trim colour.
 */
function jerseyGarment({ body, trim, pinstripe, catcher }) {
  const shell = 'M50 34 C56 30 72 30 78 34 L98 40 L116 64 L96 74 L90 66 L90 120 C90 124 88 126 84 126 L44 126 C40 126 38 124 38 120 L38 66 L32 74 L12 64 L30 40 Z';
  if (catcher) {
    return `
      <path d="${shell}" ${stroke()} fill="#2b3d5c"/>
      <path d="M52 34 L64 50 L76 34 Z" ${stroke()} fill="${CREAM}"/>
      <path d="M42 52 C50 44 78 44 86 52 L88 114 C78 122 50 122 40 114 Z" ${stroke()} fill="${body}"/>
      <g stroke="${trim}" stroke-width="4" fill="none" stroke-linecap="round">
        <path d="M47 66 L81 66"/><path d="M47 82 L81 82"/><path d="M47 98 L81 98"/></g>`;
  }
  return `
    <path d="${shell}" ${stroke()} fill="${body}"/>
    ${pinstripe ? `<g stroke="${trim}" stroke-width="2" fill="none" opacity="0.9">
        ${[46, 53, 75, 82].map((x) => `<path d="M${x} 42 L${x} 124"/>`).join('')}</g>` : ''}
    <path d="M52 34 L64 50 L76 34 Z" ${stroke()} fill="${CREAM}"/>
    <g stroke="${trim}" stroke-width="3.5" fill="none" stroke-linecap="round">
      <path d="M64 50 L64 124"/>
      <path d="M14 63 L33 73"/><path d="M114 63 L95 73"/></g>
    <g fill="${trim}" ${stroke(1.5)}>${[62, 76, 90, 104, 118].map((y) =>
      `<circle cx="64" cy="${y}" r="2.6"/>`).join('')}</g>`;
}

/** The shoulders a portrait shows: collar, placket, and the top of the shirt. */
function jerseyShoulders({ body, trim, pinstripe, catcher }, chestLetter) {
  if (catcher) {
    return `
      <path d="M4 128 C4 112 26 100 52 98 L64 112 L76 98 C102 100 124 112 124 128 Z" ${stroke()} fill="#2b3d5c"/>
      <path d="M50 98 L64 114 L78 98 L73 95 L64 105 L55 95 Z" ${stroke(3)} fill="${CREAM}"/>
      <path d="M30 128 C30 114 42 108 64 108 C86 108 98 114 98 128 Z" ${stroke()} fill="${body}"/>
      <g stroke="${trim}" stroke-width="3.5" fill="none" stroke-linecap="round">
        <path d="M40 118 L88 118"/></g>`;
  }
  return `
    <path d="M4 128 C4 112 26 100 52 98 L64 112 L76 98 C102 100 124 112 124 128 Z" ${stroke()} fill="${body}"/>
    ${pinstripe ? `<g stroke="${trim}" stroke-width="2" fill="none" opacity="0.9">
        ${[30, 42, 86, 98].map((x) => `<path d="M${x} ${x < 64 ? 104 + (52 - x) * 0.5 : 104 + (x - 76) * 0.5} L${x} 128"/>`).join('')}</g>` : ''}
    <path d="M50 98 L64 114 L78 98 L73 95 L64 105 L55 95 Z" ${stroke(3)} fill="${CREAM}"/>
    <g stroke="${trim}" stroke-width="3.5" fill="none" stroke-linecap="round"><path d="M64 114 L64 128"/></g>
    <g fill="${trim}" ${stroke(1.5)}><circle cx="64" cy="121" r="2.6"/></g>
    ${chestLetter ? `<text x="42" y="122" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="14"
        fill="${trim}" stroke="${body}" stroke-width="3" paint-order="stroke">${chestLetter}</text>` : ''}`;
}

const JERSEYS = [
  { name: 'pinstripe-navy', body: '#f7f4ec', trim: NAVY, pinstripe: true },
  { name: 'white-red',      body: WHITE,     trim: RED },
  { name: 'grey',           body: GREY,      trim: '#5b6167' },
  { name: 'navy',           body: NAVY,      trim: WHITE },
  { name: 'cream-green',    body: '#f4efe0', trim: GREEN },
  { name: 'black-gold',     body: BLACK,     trim: GOLD },
  { name: 'red',            body: RED,       trim: WHITE },
  { name: 'green',          body: GREEN,     trim: WHITE },
  { name: 'purple',         body: PURPLE,    trim: WHITE },
  { name: 'orange',         body: ORANGE,    trim: BLUE },
  { name: 'light-blue',     body: '#6fb2e0', trim: NAVY },
  { name: 'catcher',        body: '#2b3d5c', trim: '#6fb2e0', catcher: true },
];

/* -------------------------------------------------------------- examples --
 * Twelve worked portraits. Module scope so the contact sheet and the exported
 * PNGs draw the same twelve rather than drifting apart.
 */
const EX_SPECS = [
  { skin: 1, hair: 'buzz',         hat: 'navy',        letter: 'B', letterColor: WHITE,  jersey: 'pinstripe-navy', chest: 'B', eyes: 'dots' },
  { skin: 5, hair: 'curls-tight',  hat: 'red',         letter: 'W', letterColor: WHITE,  jersey: 'white-red',      eyes: 'dots' },
  { skin: 0, hair: 'blonde-curls', hat: 'white-blue',  letter: 'S', letterColor: BLUE,   jersey: 'grey',           eyes: 'dots' },
  { skin: 8, hair: 'crop',         hat: 'black-gold',  letter: 'A', letterColor: GOLD,   jersey: 'black-gold',     eyes: 'dots', facial: 'full' },
  { skin: 2, hair: 'bob',          hat: 'white-green', letter: 'M', letterColor: GREEN,  jersey: 'cream-green',    eyes: 'dots' },
  { skin: 6, hair: 'dreads',       hat: 'maroon',      letter: 'T', letterColor: WHITE,  jersey: 'white-maroon',   eyes: 'dots' },
  { skin: 1, hair: 'side-part',    hat: 'white-purple',letter: 'C', letterColor: PURPLE, jersey: 'purple',         eyes: 'dots', facial: 'handlebar' },
  { skin: 2, hair: 'curls-loose',  hat: 'navy-orange', letter: 'R', letterColor: ORANGE, jersey: 'orange',         eyes: 'dots' },
  { skin: 7, hair: 'bald',         hat: 'grey-black',  letter: 'P', letterColor: NAVY,   jersey: 'grey',           eyes: 'dots' },
  { skin: 0, hair: 'bob',          hat: 'white-navy',  letter: 'H', letterColor: BLUE,   jersey: 'catcher',        eyes: 'dots', hairColor: HAIR.blonde },
  { skin: 4, hair: 'ponytail',     hat: 'camo',        letter: 'K', letterColor: CREAM,  jersey: 'green',          eyes: 'dots' },
  { skin: 3, hair: 'spiky',        hat: 'red',         letter: 'J', letterColor: WHITE,  jersey: 'red',            eyes: 'dots', facial: 'goatee' },
];

// Hats and jerseys the examples use that are not in the twelve-strong rows.
const EXTRA_HATS = {
  maroon:        { crown: MAROON, brim: MAROON },
  'navy-orange': { crown: NAVY, brim: ORANGE },
};
const EXTRA_JERSEYS = {
  'white-maroon': { body: WHITE, trim: MAROON },
};
const findHat = (n) => HATS.find((h) => h.name === n) ?? EXTRA_HATS[n];
const findJersey = (n) => JERSEYS.find((j) => j.name === n) ?? EXTRA_JERSEYS[n];
const findHair = (n) => HAIR_STYLES.find((h) => h.name === n);

/** A full portrait, composed in the one order that layers correctly. */
function portrait(e) {
  const cut = findHair(e.hair);
  const hc = e.hairColor ?? cut.color;
  const skin = SKIN[e.skin];
  // A lettered cap drops its front panel: the letter is the same colour as the
  // panel would be, and the reference puts letters on plain crowns.
  const h = e.hat ? { ...findHat(e.hat), panel: undefined, letter: e.letter, letterColor: e.letterColor } : null;
  return `
    ${jerseyShoulders(findJersey(e.jersey), e.chest)}
    ${cut.back(hc)}
    ${head(skin)}
    ${EYE_STYLES[e.eyes ?? 'dots'](EYES[0])}
    ${mouth}
    ${e.facial ? FACIAL[e.facial](hc) : ''}
    ${cut.front(hc)}
    ${h ? hat(h) : ''}`;
}

/* ----------------------------------------------------------------- build -- */

const render = async (body, path, w = S, h = S) => {
  await sharp(Buffer.from(svg(body, w, h))).png().toFile(path);
};

const bareFace = (skin, eyes = 'dots') => `${head(skin)}${EYE_STYLES[eyes](EYES[0])}${mouth}`;
const WHITE_NAVY = HATS.find((h) => h.name === 'white-navy');

async function main() {
  const dirs = ['skin', 'eyes', 'facial-hair', 'hair', 'hair-hat', 'hats', 'jerseys', 'heads', 'examples'];
  for (const d of dirs) await mkdir(join(OUT, 'parts', d), { recursive: true });

  const manifest = { size: S, ink: INK, parts: {} };
  const swatch = (c) => `<circle cx="32" cy="32" r="27" fill="${c}" ${stroke(4)}/>`;

  manifest.parts.skin = [];
  for (const [i, c] of SKIN.entries()) {
    const n = `skin-${String(i + 1).padStart(2, '0')}`;
    await render(swatch(c), join(OUT, 'parts/skin', `${n}.png`), 64, 64);
    await render(bareFace(c), join(OUT, 'parts/heads', `head-${String(i + 1).padStart(2, '0')}.png`));
    manifest.parts.skin.push({ name: n, color: c });
  }

  manifest.parts.eyes = [];
  for (const [i, c] of EYES.entries()) {
    const n = `eye-color-${i + 1}`;
    await render(swatch(c), join(OUT, 'parts/eyes', `${n}.png`), 64, 64);
    manifest.parts.eyes.push({ name: n, color: c });
  }

  manifest.parts.eyeStyles = [];
  for (const [name, fn] of Object.entries(EYE_STYLES)) {
    await render(fn(EYES[0]), join(OUT, 'parts/eyes', `style-${name}.png`));
    manifest.parts.eyeStyles.push(name);
  }

  manifest.parts.facialHair = [];
  for (const [name, fn] of Object.entries(FACIAL)) {
    await render(fn(HAIR.black), join(OUT, 'parts/facial-hair', `${name}.png`));
    manifest.parts.facialHair.push(name);
  }

  manifest.parts.hair = [];
  for (const [i, cut] of HAIR_STYLES.entries()) {
    const skin = SKIN[[2, 1, 3, 2, 4, 0, 5, 7, 8, 6, 2, 3][i]];
    await render(`${cut.back(cut.color)}${bareFace(skin)}${cut.front(cut.color)}`,
      join(OUT, 'parts/hair', `${cut.name}.png`));
    await render(cut.back(cut.color), join(OUT, 'parts/hair', `${cut.name}-back.png`));
    await render(cut.front(cut.color), join(OUT, 'parts/hair', `${cut.name}-front.png`));
    await render(`${cut.back(cut.color)}${bareFace(skin)}${cut.front(cut.color)}${hat(WHITE_NAVY)}`,
      join(OUT, 'parts/hair-hat', `${cut.name}-capped.png`));
    manifest.parts.hair.push({ name: cut.name, color: cut.color });
  }

  manifest.parts.hats = [];
  for (const h of HATS) {
    await render(hat(h), join(OUT, 'parts/hats', `${h.name}.png`));
    manifest.parts.hats.push(h.name);
  }

  manifest.parts.jerseys = [];
  for (const j of JERSEYS) {
    await render(jerseyGarment(j), join(OUT, 'parts/jerseys', `${j.name}.png`));
    await render(jerseyShoulders(j), join(OUT, 'parts/jerseys', `${j.name}-shoulders.png`));
    manifest.parts.jerseys.push(j.name);
  }

  manifest.parts.examples = [];
  for (const [i, e] of EX_SPECS.entries()) {
    const n = `example-${String(i + 1).padStart(2, '0')}`;
    await render(portrait(e), join(OUT, 'parts/examples', `${n}.png`));
    manifest.parts.examples.push(n);
  }

  await buildSheet();
  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

/* ----------------------------------------------------------------- sheet --
 * One page laid out like the reference: a top band of swatches, then five
 * twelve-wide rows. Rendered in a single pass rather than composited from the
 * PNGs; it is the thing you look at to judge the kit.
 */
const COLS = 12, CELL = 128, PAD = 16;
const label = (x, y, t) => `<text x="${x}" y="${y}" font-family="Arial Narrow, Arial, Helvetica, sans-serif"
    font-weight="700" font-size="17" letter-spacing="0.5" fill="#2b3a55">${t}</text>`;
const at = (x, y, inner, s = 1) => `<g transform="translate(${x},${y}) scale(${s})">${inner}</g>`;

async function buildSheet() {
  let body = '';
  const swatch = (c) => `<circle cx="27" cy="27" r="24" fill="${c}" ${stroke(4)}/>`;

  // Top band.
  body += label(PAD, 30, 'SKIN TONES');
  SKIN.forEach((c, i) => { body += at(PAD + (i % 5) * 62, 40 + Math.floor(i / 5) * 62, swatch(c)); });
  body += label(400, 30, 'EYES');
  EYES.forEach((c, i) => { body += at(400 + i * 62, 40, swatch(c)); });
  body += label(780, 30, 'EYE STYLES');
  Object.values(EYE_STYLES).forEach((f, i) => {
    body += at(760 + (i % 3) * 78, 30 + Math.floor(i / 3) * 62, f(EYES[0]), 0.6);
  });
  body += label(1050, 30, 'FACIAL HAIR');
  Object.values(FACIAL).forEach((f, i) => { body += at(1040 + i * 82, 20, f(HAIR.black), 0.75); });

  const rows = [];
  rows.push(['HAIR (NO HAT)', HAIR_STYLES.map((h, i) => {
    const skin = SKIN[[2, 1, 3, 2, 4, 0, 5, 7, 8, 6, 2, 3][i]];
    return `${h.back(h.color)}${bareFace(skin)}${h.front(h.color)}`;
  })]);
  rows.push(['HAIR (WITH HAT)', HAIR_STYLES.map((h, i) => {
    const skin = SKIN[[2, 1, 3, 2, 4, 0, 5, 7, 8, 6, 2, 3][i]];
    return `${h.back(h.color)}${bareFace(skin)}${h.front(h.color)}${hat(WHITE_NAVY)}`;
  })]);
  rows.push(['HATS', HATS.map((h) => hat(h))]);
  rows.push(['UNIFORMS / JERSEYS', JERSEYS.map((j) => jerseyGarment(j))]);
  rows.push(['FULL AVATAR EXAMPLES', EX_SPECS.map((e) => portrait(e))]);

  let y = 176;
  for (const [t, cells] of rows) {
    body += label(PAD, y, t);
    cells.forEach((c, i) => { body += at(PAD + i * CELL, y + 6, c); });
    y += CELL + 36;
  }

  const w = PAD * 2 + COLS * CELL;
  await sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${y}" viewBox="0 0 ${w} ${y}">
       <rect width="${w}" height="${y}" fill="#ffffff"/>${body}</svg>`))
    .png().toFile(join(OUT, 'avatar-kit-sheet.png'));
  console.log(`sheet ${w}x${y}`);
}

main().then((m) => {
  const n = Object.values(m.parts).reduce((a, v) => a + v.length, 0);
  console.log(`wrote ${n} parts to ${OUT}/parts`);
}).catch((e) => { console.error(e); process.exit(1); });
