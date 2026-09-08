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
const INK = '#152238';
const W = 5; // outline weight at 128px

/* ---------------------------------------------------------------- palette --
 * Anchored on the six tones already in Avatar.tsx so a PNG portrait and an SVG
 * portrait of the same league look like the same game. Extended to ten at the
 * light and dark ends to cover the range the reference sheet spans.
 */
const SKIN = [
  '#ffe0c4', '#f6cfa8', '#f0c9a6', '#e0ab82', '#c68a5e',
  '#b07a4e', '#a26b43', '#8a5a37', '#7a4e2d', '#5a3720',
];
const HAIR = {
  black: '#1c1410', darkBrown: '#2e1f16', brown: '#4a3121',
  midBrown: '#6b4a2a', lightBrown: '#9a6b3a', blonde: '#e0b95e',
};
const EYES = ['#4a3121', '#c68a5e', '#236b42', '#1f5fd0', '#9aa7b4'];

/* ------------------------------------------------------------- geometry --
 * One head for the whole kit. Changing these moves every layer together.
 */
const HEAD = { x: 30, y: 26, w: 68, h: 76, r: 32 };
const CY = HEAD.y + HEAD.h / 2;           // 64  - eye line sits just above
const EYE_Y = 70;
const EAR_Y = 72;

const svg = (body, w = S, h = S) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const stroke = (sw = W) =>
  `stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`;

/* ------------------------------------------------------------------ head -- */

/** Bare head, ears and neck. The base every face is built on. */
function head(skin) {
  return `
    <g ${stroke()} fill="${skin}">
      <ellipse cx="${HEAD.x}" cy="${EAR_Y}" rx="7" ry="9"/>
      <ellipse cx="${HEAD.x + HEAD.w}" cy="${EAR_Y}" rx="7" ry="9"/>
      <rect x="54" y="92" width="20" height="20" rx="8"/>
      <rect x="${HEAD.x}" y="${HEAD.y}" width="${HEAD.w}" height="${HEAD.h}" rx="${HEAD.r}"/>
    </g>`;
}

/** Shoulders. Drawn under the head so the neck disappears into the collar. */
function torso(fill) {
  return `<path d="M12 ${S} C12 110 32 100 64 100 C96 100 116 110 116 ${S} Z"
            ${stroke()} fill="${fill}"/>`;
}

/* ------------------------------------------------------------------ eyes --
 * Six pairs. At this size an eye is still only a few shapes, so the variation
 * has to come from placement and lid rather than from detail.
 */
const EYE_STYLES = {
  dots: (c) => `<circle cx="52" cy="${EYE_Y}" r="6" fill="${INK}"/>
                <circle cx="76" cy="${EYE_Y}" r="6" fill="${INK}"/>`,
  wide: (c) => `<g ${stroke(4)} fill="#fff">
      <circle cx="51" cy="${EYE_Y}" r="8"/><circle cx="77" cy="${EYE_Y}" r="8"/></g>
      <circle cx="52" cy="${EYE_Y}" r="4" fill="${c}"/>
      <circle cx="78" cy="${EYE_Y}" r="4" fill="${c}"/>`,
  narrow: (c) => `<g fill="${INK}">
      <ellipse cx="52" cy="${EYE_Y}" rx="6" ry="4"/>
      <ellipse cx="76" cy="${EYE_Y}" rx="6" ry="4"/></g>`,
  round: (c) => `<g fill="${c}" ${stroke(3.5)}>
      <circle cx="52" cy="${EYE_Y}" r="6.5"/><circle cx="76" cy="${EYE_Y}" r="6.5"/></g>`,
  close: (c) => `<circle cx="56" cy="${EYE_Y}" r="5.5" fill="${INK}"/>
                 <circle cx="74" cy="${EYE_Y}" r="5.5" fill="${INK}"/>`,
  tall: (c) => `<g fill="${INK}">
      <ellipse cx="52" cy="${EYE_Y}" rx="4.5" ry="7"/>
      <ellipse cx="76" cy="${EYE_Y}" rx="4.5" ry="7"/></g>`,
};

const brows = `<g ${stroke(4.5)} fill="none" opacity="0.85">
    <path d="M44 58 L60 55"/><path d="M68 55 L84 58"/></g>`;

const mouth = `<path d="M56 86 Q64 93 72 86" ${stroke(4)} fill="none"/>`;

/* ---------------------------------------------------------- facial hair --
 * Six, cut to sit under the mouth line so they compose with any eye style.
 */
const FACIAL = {
  goatee: (c) => `<path d="M54 88 C54 100 58 104 64 104 C70 104 74 100 74 88
      C71 95 68 97 64 97 C60 97 57 95 54 88 Z" ${stroke()} fill="${c}"/>`,
  mustacheThin: (c) => `<path d="M50 80 C56 74 60 78 64 78 C68 78 72 74 78 80
      C72 82 68 83 64 83 C60 83 56 82 50 80 Z" ${stroke()} fill="${c}"/>`,
  mustacheThick: (c) => `<path d="M46 78 C54 70 60 76 64 76 C68 76 74 70 82 78
      C82 86 74 88 64 88 C54 88 46 86 46 78 Z" ${stroke()} fill="${c}"/>`,
  chinstrap: (c) => `<path d="M34 66 C34 96 46 106 64 106 C82 106 94 96 94 66
      C90 88 80 96 64 96 C48 96 38 88 34 66 Z" ${stroke()} fill="${c}"/>`,
  full: (c) => `<path d="M34 62 C34 98 46 108 64 108 C82 108 94 98 94 62
      C94 84 84 90 64 90 C44 90 34 84 34 62 Z" ${stroke()} fill="${c}"/>
      <path d="M48 76 C56 68 60 74 64 74 C68 74 72 68 80 76 C74 80 68 81 64 81
      C60 81 54 80 48 76 Z" fill="${c}" ${stroke(3.5)}/>`,
  long: (c) => `<path d="M32 58 C32 104 46 118 64 118 C82 118 96 104 96 58
      C96 86 84 92 64 92 C44 92 32 86 32 58 Z" ${stroke()} fill="${c}"/>`,
};

/* ------------------------------------------------------------------ hair --
 * Twelve cuts. Each is authored twice: free, and cropped to sit under a cap.
 * `under` is the part that still shows with a hat on — sides, back, ponytail.
 */
const HAIR_STYLES = [
  { name: 'afro', color: HAIR.black,
    free: (c) => `<g ${stroke()} fill="${c}">
      <circle cx="44" cy="34" r="17"/><circle cx="64" cy="26" r="18"/>
      <circle cx="84" cy="34" r="17"/><circle cx="34" cy="50" r="13"/>
      <circle cx="94" cy="50" r="13"/></g>`,
    under: (c) => `<g ${stroke()} fill="${c}">
      <circle cx="32" cy="62" r="11"/><circle cx="96" cy="62" r="11"/></g>` },

  { name: 'buzz', color: HAIR.midBrown,
    free: (c) => `<path d="M30 58 C30 30 44 22 64 22 C84 22 98 30 98 58
      C92 42 80 36 64 36 C48 36 36 42 30 58 Z" ${stroke()} fill="${c}"/>`,
    under: (c) => `<path d="M30 58 C30 52 32 48 34 46 L34 66 L30 66 Z
      M98 58 C98 52 96 48 94 46 L94 66 L98 66 Z" ${stroke()} fill="${c}"/>` },

  { name: 'curls-tight', color: HAIR.brown,
    free: (c) => `<g ${stroke()} fill="${c}">
      <circle cx="42" cy="36" r="14"/><circle cx="58" cy="27" r="14"/>
      <circle cx="76" cy="28" r="14"/><circle cx="90" cy="40" r="13"/>
      <circle cx="33" cy="52" r="11"/></g>`,
    under: (c) => `<g ${stroke()} fill="${c}">
      <circle cx="33" cy="60" r="10"/><circle cx="95" cy="60" r="10"/></g>` },

  { name: 'spiky', color: HAIR.black,
    free: (c) => `<path d="M30 56 L36 34 L44 46 L50 24 L58 42 L64 20 L72 40
      L80 24 L86 44 L94 32 L98 56 C90 42 78 36 64 36 C50 36 38 42 30 56 Z"
      ${stroke()} fill="${c}"/>`,
    under: (c) => `<path d="M30 56 L34 46 L34 66 L30 66 Z M98 56 L94 46 L94 66 L98 66 Z"
      ${stroke()} fill="${c}"/>` },

  { name: 'side-part', color: HAIR.midBrown,
    free: (c) => `<path d="M28 58 C28 28 44 20 64 20 C86 20 100 30 98 58
      C94 44 86 38 70 38 C56 38 44 44 34 58 Z" ${stroke()} fill="${c}"/>`,
    under: (c) => `<path d="M30 56 L36 48 L36 66 L30 66 Z M98 56 L92 48 L92 66 L98 66 Z"
      ${stroke()} fill="${c}"/>` },

  { name: 'blonde-curls', color: HAIR.blonde,
    free: (c) => `<g ${stroke()} fill="${c}">
      <circle cx="46" cy="32" r="15"/><circle cx="64" cy="24" r="16"/>
      <circle cx="82" cy="32" r="15"/>
      <circle cx="30" cy="52" r="12"/><circle cx="98" cy="52" r="12"/>
      <circle cx="28" cy="72" r="10"/><circle cx="100" cy="72" r="10"/></g>`,
    under: (c) => `<g ${stroke()} fill="${c}">
      <circle cx="29" cy="64" r="11"/><circle cx="99" cy="64" r="11"/>
      <circle cx="28" cy="80" r="9"/><circle cx="100" cy="80" r="9"/></g>` },

  { name: 'wavy-mid', color: HAIR.brown,
    free: (c) => `<path d="M26 92 C22 44 40 20 64 20 C88 20 106 44 102 92
      L92 92 C96 56 86 40 64 40 C42 40 32 56 36 92 Z" ${stroke()} fill="${c}"/>`,
    under: (c) => `<path d="M28 62 C28 78 28 86 26 92 L36 92 C34 80 34 70 34 62 Z
      M100 62 C100 78 100 86 102 92 L92 92 C94 80 94 70 94 62 Z"
      ${stroke()} fill="${c}"/>` },

  { name: 'dreads', color: HAIR.black,
    free: (c) => `<g ${stroke()} fill="${c}">
      <path d="M30 54 C30 28 44 20 64 20 C84 20 98 28 98 54
        C92 40 80 34 64 34 C48 34 36 40 30 54 Z"/>
      <rect x="24" y="46" width="9" height="62" rx="4.5"/>
      <rect x="36" y="54" width="9" height="52" rx="4.5"/>
      <rect x="83" y="54" width="9" height="52" rx="4.5"/>
      <rect x="95" y="46" width="9" height="62" rx="4.5"/></g>`,
    under: (c) => `<g ${stroke()} fill="${c}">
      <rect x="24" y="58" width="9" height="50" rx="4.5"/>
      <rect x="36" y="64" width="9" height="42" rx="4.5"/>
      <rect x="83" y="64" width="9" height="42" rx="4.5"/>
      <rect x="95" y="58" width="9" height="50" rx="4.5"/></g>` },

  { name: 'bald', color: HAIR.black, free: () => '', under: () => '' },

  { name: 'mop', color: HAIR.midBrown,
    free: (c) => `<path d="M28 62 C24 30 42 18 64 18 C86 18 104 30 100 62
      C96 48 92 42 84 44 C76 46 72 40 64 40 C56 40 50 46 42 44 C34 42 32 48 28 62 Z"
      ${stroke()} fill="${c}"/>`,
    under: (c) => `<path d="M28 58 L36 50 L36 68 L28 68 Z M100 58 L92 50 L92 68 L100 68 Z"
      ${stroke()} fill="${c}"/>` },

  { name: 'curls-loose', color: HAIR.brown,
    free: (c) => `<g ${stroke()} fill="${c}">
      <circle cx="40" cy="38" r="15"/><circle cx="62" cy="26" r="16"/>
      <circle cx="84" cy="34" r="15"/><circle cx="96" cy="52" r="12"/>
      <circle cx="30" cy="56" r="12"/></g>`,
    under: (c) => `<g ${stroke()} fill="${c}">
      <circle cx="31" cy="62" r="11"/><circle cx="97" cy="62" r="11"/></g>` },

  { name: 'ponytail', color: HAIR.brown,
    free: (c) => `<g ${stroke()} fill="${c}">
      <path d="M100 74 C112 76 116 90 112 104 C108 116 100 118 96 112
        C102 102 102 88 96 80 Z"/>
      <path d="M28 62 C26 30 42 20 64 20 C86 20 102 30 100 62
        C94 46 84 40 64 40 C44 40 34 46 28 62 Z"/></g>`,
    under: (c) => `<g ${stroke()} fill="${c}">
      <path d="M100 74 C112 76 116 90 112 104 C108 116 100 118 96 112
        C102 102 102 88 96 80 Z"/>
      <path d="M30 58 L36 50 L36 68 L30 68 Z"/></g>` },
];

/* ------------------------------------------------------------------ hats --
 * Crown, then brim over it, then the front panel's letter. The brim overhangs
 * the head on the left so the cap reads as worn rather than balanced on top.
 */
function hat({ crown, brim, panel, letter, letterColor, flat, camo }) {
  const front = panel ?? crown;
  // The bill is the whole silhouette. Without it a cap reads as a beanie, so it
  // juts a good third of a head-width past the temple and dips below the band.
  // Everything here stays above EYE_Y. A bill that crosses the eyes reads as a
  // welding mask, which is the failure mode this geometry is tuned to avoid.
  const bill = flat
    ? `<path d="M32 46 L7 46 C3 46 3 60 7 60 L40 60 C34 56 32 52 32 46 Z"/>`
    : `<path d="M36 44 C18 45 8 51 9 58 C10 65 24 67 42 63 C35 58 33 51 36 44 Z"/>`;
  return `
    <g ${stroke()}>
      <path d="M30 54 C30 28 44 18 64 18 C84 18 98 28 98 54 Z" fill="${crown}"/>
      ${panel ? `<path d="M52 19 C58 18 70 18 76 19 L78 54 L50 54 Z" fill="${front}"/>` : ''}
      ${camo ? `<g fill="#3f4a2a" stroke="none" opacity="0.85">
          <ellipse cx="46" cy="34" rx="9" ry="7"/><ellipse cx="72" cy="28" rx="10" ry="7"/>
          <ellipse cx="86" cy="44" rx="8" ry="6"/><ellipse cx="56" cy="48" rx="9" ry="6"/></g>` : ''}
      <g fill="${brim}">${bill}</g>
      <rect x="28" y="46" width="72" height="14" rx="7" fill="${brim}"/>
      <circle cx="64" cy="21" r="3.5" fill="${brim}"/>
    </g>
    ${letter ? `<text x="64" y="42" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="25"
        fill="${letterColor}" stroke="${INK}" stroke-width="1.2"
        paint-order="stroke">${letter}</text>` : ''}`;
}

const HATS = [
  { name: 'navy',       crown: '#1b2a52', brim: '#1b2a52' },
  { name: 'red',        crown: '#c8202e', brim: '#c8202e' },
  { name: 'white-blue', crown: '#ffffff', brim: '#1f5fd0', panel: '#ffffff',
    letter: 'S', letterColor: '#1f5fd0' },
  { name: 'black-gold', crown: '#141414', brim: '#e0b500', panel: '#141414',
    letter: 'A', letterColor: '#e0b500' },
  { name: 'green-white',crown: '#ffffff', brim: '#0f5c34', panel: '#0f5c34' },
  { name: 'red-white',  crown: '#ffffff', brim: '#c8202e', panel: '#c8202e' },
  { name: 'purple',     crown: '#6b2fb5', brim: '#e0b500' },
  { name: 'orange',     crown: '#e86a10', brim: '#1f5fd0' },
  { name: 'grey',       crown: '#9aa0a6', brim: '#2b2b2b' },
  { name: 'camo',       crown: '#7a8455', brim: '#5c6440', camo: true },
  { name: 'white',      crown: '#ffffff', brim: '#ffffff' },
  { name: 'snapback',   crown: '#ffffff', brim: '#ffffff', flat: true },
];

/* --------------------------------------------------------------- jerseys --
 * Placket, buttons and piping on a shoulder shape. The catcher's rig at the end
 * is the one that is not a jersey, and it is drawn as its own thing.
 */
function jersey({ body, trim, pinstripe, catcher }) {
  if (catcher) {
    return `
      ${torso('#2b3d5c')}
      <g ${stroke()} fill="${body}">
        <path d="M30 128 C30 108 44 100 64 100 C84 100 98 108 98 128 Z"/>
        <path d="M14 128 C14 116 20 108 30 106 L34 128 Z"/>
        <path d="M114 128 C114 116 108 108 98 106 L94 128 Z"/>
      </g>
      <g stroke="${trim}" stroke-width="4" fill="none" stroke-linecap="round">
        <path d="M38 112 L90 112"/><path d="M38 122 L90 122"/></g>`;
  }
  return `
    ${torso(body)}
    ${pinstripe ? `<g stroke="${trim}" stroke-width="2.5" opacity="0.9">
        ${[26, 38, 50, 78, 90, 102].map((x) => `<path d="M${x} ${x < 64 ? 108 - (64 - x) * 0.25 : 108 - (x - 64) * 0.25} L${x} 128"/>`).join('')}
      </g>` : ''}
    <path d="M52 101 L64 118 L76 101 L70 99 L64 108 L58 99 Z" ${stroke(3.5)} fill="#f4efe4"/>
    <g stroke="${trim}" stroke-width="4" fill="none" stroke-linecap="round">
      <path d="M64 118 L64 128"/></g>
    <g fill="${trim}"><circle cx="64" cy="122" r="2.6"/></g>`;
}

/**
 * The garment on its own, sleeves and all.
 *
 * The portrait only ever shows a collar and two shoulders, but the kit row has
 * to show the shirt, so the two are drawn separately rather than one cropped
 * into the other.
 */
function jerseyGarment({ body, trim, pinstripe, catcher }) {
  if (catcher) {
    return `
      <path d="M64 26 C50 26 40 30 32 36 L14 58 L30 74 L38 64 L38 118
        C38 122 41 125 45 125 L83 125 C87 125 90 122 90 118 L90 64 L98 74
        L114 58 L96 36 C88 30 78 26 64 26 Z" ${stroke()} fill="#2b3d5c"/>
      <path d="M42 46 C50 40 78 40 86 46 L88 112 C78 118 50 118 40 112 Z"
        ${stroke(4)} fill="${body}"/>
      <g stroke="${trim}" stroke-width="4.5" fill="none" stroke-linecap="round">
        <path d="M46 62 L82 62"/><path d="M46 80 L82 80"/><path d="M46 98 L82 98"/></g>`;
  }
  return `
    <path d="M64 26 C50 26 40 30 32 36 L14 58 L30 74 L38 64 L38 118
      C38 122 41 125 45 125 L83 125 C87 125 90 122 90 118 L90 64 L98 74
      L114 58 L96 36 C88 30 78 26 64 26 Z" ${stroke()} fill="${body}"/>
    ${pinstripe ? `<g stroke="${trim}" stroke-width="2.5" opacity="0.9" fill="none">
        ${[48, 58, 70, 80].map((x) => `<path d="M${x} 40 L${x} 122"/>`).join('')}</g>` : ''}
    <path d="M52 27 L64 46 L76 27" ${stroke(4)} fill="none"/>
    <g stroke="${trim}" stroke-width="4" fill="none" stroke-linecap="round">
      <path d="M64 46 L64 122"/>
      <path d="M30 70 L38 62"/><path d="M98 70 L90 62"/></g>
    <g fill="${trim}">${[60, 78, 96, 114].map((y) =>
      `<circle cx="57" cy="${y}" r="2.8"/>`).join('')}</g>`;
}

const JERSEYS = [
  { name: 'pinstripe-navy', body: '#f7f4ec', trim: '#1b2a52', pinstripe: true },
  { name: 'white-red',      body: '#ffffff', trim: '#c8202e' },
  { name: 'grey',           body: '#9aa0a6', trim: '#5b6167' },
  { name: 'navy',           body: '#1b2a52', trim: '#ffffff' },
  { name: 'cream-gold',     body: '#f4efe0', trim: '#e0b500' },
  { name: 'black-gold',     body: '#141414', trim: '#e0b500' },
  { name: 'red',            body: '#c8202e', trim: '#ffffff' },
  { name: 'green',          body: '#0f5c34', trim: '#ffffff' },
  { name: 'purple',         body: '#6b2fb5', trim: '#ffffff' },
  { name: 'orange',         body: '#e86a10', trim: '#1f5fd0' },
  { name: 'light-blue',     body: '#6fb2e0', trim: '#1b2a52' },
  { name: 'catcher',        body: '#2b3d5c', trim: '#6fb2e0', catcher: true },
];

/* -------------------------------------------------------------- examples --
 * Twelve worked portraits, one per hat. Module scope so the contact sheet and
 * the exported PNGs draw the same twelve rather than drifting apart.
 */
const EX_SPECS = [
  { skin: 1, hairIdx: 1,  hatIdx: 0,  jerseyIdx: 0,  eyeStyle: 'dots',   facial: null },
  { skin: 5, hairIdx: 2,  hatIdx: 1,  jerseyIdx: 1,  eyeStyle: 'round',  facial: null },
  { skin: 0, hairIdx: 5,  hatIdx: 2,  jerseyIdx: 2,  eyeStyle: 'wide',   facial: null },
  { skin: 8, hairIdx: 0,  hatIdx: 3,  jerseyIdx: 5,  eyeStyle: 'narrow', facial: 'full' },
  { skin: 2, hairIdx: 4,  hatIdx: 4,  jerseyIdx: 4,  eyeStyle: 'dots',   facial: null },
  { skin: 6, hairIdx: 7,  hatIdx: 5,  jerseyIdx: 1,  eyeStyle: 'tall',   facial: null },
  { skin: 1, hairIdx: 10, hatIdx: 6,  jerseyIdx: 8,  eyeStyle: 'close',  facial: 'mustacheThick' },
  { skin: 2, hairIdx: 3,  hatIdx: 7,  jerseyIdx: 9,  eyeStyle: 'dots',   facial: null },
  { skin: 7, hairIdx: 8,  hatIdx: 8,  jerseyIdx: 2,  eyeStyle: 'round',  facial: 'goatee' },
  { skin: 0, hairIdx: 5,  hatIdx: 10, jerseyIdx: 3,  eyeStyle: 'wide',   facial: null },
  { skin: 4, hairIdx: 11, hatIdx: 9,  jerseyIdx: 7,  eyeStyle: 'dots',   facial: null },
  { skin: 3, hairIdx: 6,  hatIdx: 11, jerseyIdx: 11, eyeStyle: 'narrow', facial: null },
];

/* ----------------------------------------------------------------- build -- */

const render = async (body, path, w = S, h = S) => {
  await sharp(Buffer.from(svg(body, w, h))).png().toFile(path);
};

/** A full portrait, composed in the one order that layers correctly. */
function portrait({ skin, hairIdx, hatIdx, jerseyIdx, eyeStyle, eyeColor, facial, hairColor }) {
  const cut = HAIR_STYLES[hairIdx];
  const hc = hairColor ?? cut.color;
  const hasHat = hatIdx !== null && hatIdx !== undefined;
  return `
    ${jersey(JERSEYS[jerseyIdx])}
    ${hasHat ? cut.under(hc) : cut.free(hc)}
    ${head(skin)}
    ${EYE_STYLES[eyeStyle](eyeColor)}
    ${brows}
    ${mouth}
    ${facial ? FACIAL[facial](hc) : ''}
    ${hasHat ? hat(HATS[hatIdx]) : ''}`;
}

async function main() {
  const dirs = ['skin', 'eyes', 'facial-hair', 'hair', 'hair-hat', 'hats', 'jerseys', 'examples'];
  for (const d of dirs) await mkdir(join(OUT, 'parts', d), { recursive: true });

  const manifest = { size: S, ink: INK, parts: {} };

  // Swatches, drawn at the size the reference sheet shows them.
  manifest.parts.skin = [];
  for (const [i, c] of SKIN.entries()) {
    const n = `skin-${String(i + 1).padStart(2, '0')}`;
    await render(`<circle cx="32" cy="32" r="28" fill="${c}" ${stroke(4)}/>`,
      join(OUT, 'parts/skin', `${n}.png`), 64, 64);
    manifest.parts.skin.push({ name: n, color: c });
  }

  manifest.parts.eyes = [];
  for (const [i, c] of EYES.entries()) {
    const n = `eye-color-${i + 1}`;
    await render(`<circle cx="32" cy="32" r="28" fill="${c}" ${stroke(4)}/>`,
      join(OUT, 'parts/eyes', `${n}.png`), 64, 64);
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
  for (const cut of HAIR_STYLES) {
    await render(`${head(SKIN[2])}${cut.free(cut.color)}`, join(OUT, 'parts/hair', `${cut.name}.png`));
    await render(cut.free(cut.color), join(OUT, 'parts/hair', `${cut.name}-alone.png`));
    await render(cut.under(cut.color), join(OUT, 'parts/hair-hat', `${cut.name}-under.png`));
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
    await render(jersey(j), join(OUT, 'parts/jerseys', `${j.name}-shoulders.png`));
    manifest.parts.jerseys.push(j.name);
  }

  // Twelve worked portraits, one per hat, so the kit ships proof it composes.
  const EX = EX_SPECS;
  manifest.parts.examples = [];
  for (const [i, e] of EX.entries()) {
    const n = `example-${String(i + 1).padStart(2, '0')}`;
    await render(portrait({ ...e, skin: SKIN[e.skin], eyeColor: EYES[i % EYES.length] }),
      join(OUT, 'parts/examples', `${n}.png`));
    manifest.parts.examples.push(n);
  }

  await buildSheet();
  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

/* ----------------------------------------------------------------- sheet --
 * One page laid out like the reference, rendered in a single pass rather than
 * composited from the PNGs. It is the thing you actually look at to judge the
 * kit, and the thing you open in Aseprite to trace or recolour.
 */
const COLS = 12, CELL = 132, PAD = 24, LBL = 30;

async function buildSheet() {
  const rows = [];
  const row = (label, cells, cell = CELL) => rows.push({ label, cells, cell });

  row('SKIN TONES', SKIN.map((c) =>
    `<circle cx="33" cy="33" r="29" fill="${c}" ${stroke(4)}/>`), 70);
  row('EYES', EYES.map((c) =>
    `<circle cx="33" cy="33" r="29" fill="${c}" ${stroke(4)}/>`), 70);
  row('EYE STYLES', Object.values(EYE_STYLES).map((f) => f(EYES[0])));
  row('FACIAL HAIR', Object.values(FACIAL).map((f) => f(HAIR.black)));
  row('HAIR (NO HAT)', HAIR_STYLES.map((h, i) =>
    `${h.free(h.color)}${head(SKIN[i % SKIN.length])}${h.free(h.color)}
     ${EYE_STYLES.dots()}${brows}${mouth}`));
  row('HAIR (WITH HAT)', HAIR_STYLES.map((h, i) =>
    `${h.under(h.color)}${head(SKIN[i % SKIN.length])}
     ${EYE_STYLES.dots()}${brows}${mouth}${hat(HATS[i])}`));
  row('HATS', HATS.map((h) => hat(h)));
  row('UNIFORMS / JERSEYS', JERSEYS.map((j) => jerseyGarment(j)));
  row('FULL AVATAR EXAMPLES', EX_SPECS.map((e, i) =>
    portrait({ ...e, skin: SKIN[e.skin], eyeColor: EYES[i % EYES.length] })));

  let y = PAD, body = '';
  for (const r of rows) {
    body += `<text x="${PAD}" y="${y + 20}" font-family="Arial, Helvetica, sans-serif"
      font-weight="700" font-size="17" letter-spacing="1.2" fill="#55606e">${r.label}</text>`;
    y += LBL;
    r.cells.forEach((c, i) => {
      body += `<g transform="translate(${PAD + (i % COLS) * r.cell},${y + Math.floor(i / COLS) * r.cell})">${c}</g>`;
    });
    y += Math.ceil(r.cells.length / COLS) * r.cell + 14;
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
