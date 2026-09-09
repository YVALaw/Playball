// avatar-compose.mjs
// Turns the sliced reference parts into a composable portrait set for the game.
//
// The sheet gives pictures of parts, not parts that fit together: the heads
// carry one skin tone and no neck, the jerseys have nothing to sit under, there
// is no mouth, and nothing is registered to anything else. This script derives
// a set that does fit:
//
//   - one 144x216 canvas for every layer, anchored on the chin, so the game
//     stacks PNGs at 0,0 and never positions anything;
//   - each head split into a skin *mask* and the rest, so skin tone is a CSS
//     background behind a mask instead of ten copies of every head;
//   - each capped head split further into crown and brim masks, so the cap
//     takes the program's colours the same way;
//   - a neck and a mouth drawn in the sheet's own style, because the sheet has
//     neither and a portrait needs both;
//   - eyes, facial hair and jerseys placed and scaled to the head.
//
// Edge pixels between a tintable region and its outline are unmixed against
// their neighbours, so a recoloured face keeps the sheet's anti-aliasing exactly.
//
//   node scripts/avatar-compose.mjs
//
// Reads design/avatar-kit/parts (from slice-reference.mjs). Writes public/avatars.

import sharp from 'sharp';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PARTS = 'design/avatar-kit/parts';
const OUT = 'public/avatars';
const CW = 144, CH = 216;            // the shared canvas
const CX = 72, CHIN = 138;           // where every head's chin lands
const INK = [0, 0, 8];

const HAIR = ['afro-short', 'buzz', 'curls-tight', 'spiky', 'side-swept', 'blonde-curls',
  'bob', 'dreads', 'bald', 'crop', 'curls-short', 'ponytail'];
const BEARDS = ['beard-round', 'mustache-handlebar', 'mustache', 'beard-full', 'beard-open', 'beard-long'];
const JERSEYS = ['pinstripe', 'white-red', 'grey', 'navy', 'cream-gold', 'black-gold',
  'red', 'green', 'purple', 'orange', 'light-blue', 'catcher'];

/* ------------------------------------------------------------ raster io -- */

async function load(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, w: info.width, h: info.height };
}
const px = (img, x, y) => { const i = (y * img.w + x) * 4; return [img.d[i], img.d[i + 1], img.d[i + 2], img.d[i + 3]]; };
const blank = () => ({ d: Buffer.alloc(CW * CH * 4), w: CW, h: CH });
function put(img, x, y, rgba) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  img.d[i] = rgba[0]; img.d[i + 1] = rgba[1]; img.d[i + 2] = rgba[2]; img.d[i + 3] = rgba[3];
}
const save = (img, path) => sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } }).png().toFile(path);

/** Rasterise an SVG fragment onto a canvas-sized buffer. */
async function svgLayer(body) {
  const buf = await sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}">${body}</svg>`)).ensureAlpha().raw().toBuffer();
  return { d: buf, w: CW, h: CH };
}

/** Resize a raw image by a factor. */
async function scaled(img, f) {
  const w = Math.round(img.w * f), h = Math.round(img.h * f);
  const buf = await sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } })
    .resize(w, h, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
  return { d: buf, w, h };
}

/** Copy `src` onto a fresh canvas so that src point (ax, ay) lands at (tx, ty). */
function place(src, ax, ay, tx, ty) {
  const out = blank();
  const ox = Math.round(tx - ax), oy = Math.round(ty - ay);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) put(out, x + ox, y + oy, px(src, x, y));
  return out;
}

/* -------------------------------------------------------------- colour -- */

const isSkin = ([r, g, b]) => r > g && g > b && r - b > 40 && r > 90;
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/** The one flat skin colour a head was drawn in. */
function skinColour(img) {
  const m = new Map();
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const p = px(img, x, y);
    if (p[3] < 250 || !isSkin(p)) continue;
    const k = ((p[0] >> 3) << 16) | ((p[1] >> 3) << 8) | (p[2] >> 3);
    m.set(k, (m.get(k) || 0) + 1);
  }
  const k = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return [((k >> 16) << 3) + 4, (((k >> 8) & 255) << 3) + 4, ((k & 255) << 3) + 4];
}

/** Face geometry: centre x from the skin box, chin from the central columns. */
function faceAnchor(img, S) {
  let x0 = 1e9, x1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const p = px(img, x, y); if (p[3] > 200 && dist(p, S) < 48) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  }
  const cx = (x0 + x1) / 2;
  let chin = 0;
  for (let y = img.h - 1; y >= 0 && !chin; y--) for (let x = Math.round(cx) - 6; x <= cx + 6; x++) {
    const p = px(img, x, y); if (p[3] > 200 && dist(p, S) < 48) { chin = y; break; }
  }
  return { cx, chin, faceW: x1 - x0 + 1 };
}

/**
 * Split a head into tintable masks and the rest.
 *
 * Confident pixels classify by colour. Anything else — the anti-aliased edge
 * between two regions — is unmixed against the two classes it touches, and its
 * coverage is shared out between them. That is what keeps a recoloured face
 * from growing a halo of the original peach.
 */
function split(img, S, withCap) {
  const CROWN = [248, 248, 248], BRIM = [0, 32, 72];
  const classes = {
    skin: { col: S, tint: true },
    crown: { col: CROWN, tint: withCap },
    brim: { col: BRIM, tint: withCap },
    ink: { col: INK, tint: false },
  };
  const classify = (p) => {
    if (dist(p, S) < 36) return 'skin';
    if (withCap && p[0] > 228 && p[1] > 228 && p[2] > 228) return 'crown';
    if (withCap && p[2] >= 40 && p[0] < 60 && p[2] > p[1] + 10) return 'brim';
    if (Math.max(p[0], p[1], p[2]) < 48) return 'ink';
    return null;
  };
  const conf = new Array(img.w * img.h).fill(null);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const p = px(img, x, y); if (p[3] >= 250) conf[y * img.w + x] = classify(p);
  }
  const out = { skin: blankLike(img), crown: blankLike(img), brim: blankLike(img), rest: blankLike(img) };
  const maskPut = (m, x, y, a) => { if (a > 0) put(m, x, y, [255, 255, 255, Math.min(255, Math.round(a))]); };

  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const p = px(img, x, y); const a = p[3]; if (a === 0) continue;
    const c = conf[y * img.w + x];
    if (c && classes[c].tint) { maskPut(out[c], x, y, a); continue; }
    if (c) { put(out.rest, x, y, p); continue; }

    // An edge pixel. Which confident classes does it touch?
    const counts = {};
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= img.w || yy >= img.h) continue;
      const k = conf[yy * img.w + xx]; if (k) counts[k] = (counts[k] || 0) + 1;
    }
    const tints = Object.keys(counts).filter((k) => classes[k].tint).sort((a, b) => counts[b] - counts[a]);
    if (!tints.length) { put(out.rest, x, y, p); continue; }
    const A = tints[0], B = tints[1] ?? 'ink';
    const ca = classes[A].col, cb = classes[B].col;
    const u = [ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]];
    const v = [p[0] - cb[0], p[1] - cb[1], p[2] - cb[2]];
    const uu = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
    const t = Math.max(0, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / uu));
    const fit = [cb[0] + t * u[0], cb[1] + t * u[1], cb[2] + t * u[2]];
    if (dist(p, fit) > 40) { put(out.rest, x, y, p); continue; }   // not a blend of these two
    maskPut(out[A], x, y, a * t);
    if (classes[B].tint) maskPut(out[B], x, y, a * (1 - t));
    else put(out.rest, x, y, [INK[0], INK[1], INK[2], Math.round(a * (1 - t))]);
  }
  return out;
}
const blankLike = (img) => ({ d: Buffer.alloc(img.w * img.h * 4), w: img.w, h: img.h });

/** Bounding box of a mask's coverage, for the cap-letter anchor. */
function maskBox(m) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (px(m, x, y)[3] > 200) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return { x0, y0, x1, y1 };
}

/* --------------------------------------------------------------- build -- */

await rm(OUT, { recursive: true, force: true });
for (const d of ['head', 'cap', 'eyes', 'beard', 'jersey']) await mkdir(join(OUT, d), { recursive: true });

const atlas = { width: CW, height: CH, chin: CHIN, cx: CX, hair: [], eyes: [], beards: [], jerseys: [], skins: [], crown: {} };

// Skin tones, read off the sheet's own swatches.
for (let i = 1; i <= 10; i++) {
  const sw = await load(join(PARTS, 'skin', `skin-${String(i).padStart(2, '0')}.png`));
  const p = px(sw, Math.round(sw.w / 2), Math.round(sw.h / 2));
  atlas.skins.push('#' + p.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join(''));
}

// Heads, bare and capped.
for (const name of HAIR) {
  for (const [folder, withCap, outDir] of [['hair', false, 'head'], ['hair-hat', true, 'cap']]) {
    const img = await load(join(PARTS, folder, `${name}.png`));
    const S = skinColour(img);
    const { cx, chin } = faceAnchor(img, S);
    const parts = split(img, S, withCap);
    const layers = withCap ? ['skin', 'crown', 'brim', 'rest'] : ['skin', 'rest'];
    for (const l of layers) await save(place(parts[l], cx, chin, CX, CHIN), join(OUT, outDir, `${name}.${l}.png`));
    if (withCap) {
      const b = maskBox(place(parts.crown, cx, chin, CX, CHIN));
      atlas.crown[name] = { x: Math.round((b.x0 + b.x1) / 2), y: Math.round((b.y0 + b.y1) / 2), w: b.x1 - b.x0, h: b.y1 - b.y0 };
    }
  }
  atlas.hair.push(name);
}

// The neck the sheet never drew: flat skin between two ink lines, hidden at the
// top by the chin and at the bottom by the collar.
{
  const nx = CX - 17, ny = CHIN - 14, nw = 34, nh = 40;
  await save(await svgLayer(`<rect x="${nx}" y="${ny}" width="${nw}" height="${nh}" fill="#fff"/>`), join(OUT, 'neck.skin.png'));
  await save(await svgLayer(`<g stroke="rgb(${INK})" stroke-width="4.5" fill="none">
      <path d="M${nx + 2} ${ny} L${nx + 2} ${ny + nh}"/><path d="M${nx + nw - 2} ${ny} L${nx + nw - 2} ${ny + nh}"/></g>`),
    join(OUT, 'neck.rest.png'));
}

// The mouth, likewise: the busts' small dark smile, at head scale.
await save(await svgLayer(`<path d="M${CX - 8} ${CHIN - 19} Q${CX} ${CHIN - 14} ${CX + 8} ${CHIN - 19}"
    stroke="rgb(${INK})" stroke-width="3" fill="none" stroke-linecap="round"/>`), join(OUT, 'mouth.png'));

// Eyes: the sheet drew the eye row larger than the heads; 0.6 brings a pair to
// the busts' 28px spacing. Centred 42px above the chin.
for (let i = 1; i <= 4; i++) {
  const img = await scaled(await load(join(PARTS, 'eyes', `style-${i}.png`)), 0.6);
  await save(place(img, img.w / 2, img.h / 2, CX, CHIN - 42), join(OUT, 'eyes', `style-${i}.png`));
  atlas.eyes.push(`style-${i}`);
}

// Facial hair, also drawn a little large on the sheet. Beards hang from the
// chin; mustaches sit over the mouth.
for (const name of BEARDS) {
  const img = await scaled(await load(join(PARTS, 'facial-hair', `${name}.png`)), 0.8);
  const mustache = name.startsWith('mustache');
  const placed = mustache
    ? place(img, img.w / 2, img.h / 2, CX, CHIN - 24)
    : place(img, img.w / 2, img.h, CX, CHIN + 7);
  await save(placed, join(OUT, 'beard', `${name}.png`));
  atlas.beards.push(name);
}

// Jerseys: the garment seated so its collar meets the neck 22px under the chin.
for (const name of JERSEYS) {
  const img = await load(join(PARTS, 'jerseys', `${name}.png`));
  await save(place(img, img.w / 2, 0, CX, CHIN + 22), join(OUT, 'jersey', `${name}.png`));
  // The body colour, for matching a program to its nearest colourway.
  const p = px(img, Math.round(img.w * 0.3), Math.round(img.h * 0.75));
  atlas.jerseys.push({ name, body: '#' + p.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('') });
}

// The atlas goes to the source tree, not public/: Avatar.tsx imports it, so it
// is bundled and typed rather than fetched. A .ts module rather than JSON so
// the names come through as literal types and nothing needs import attributes.
await writeFile('src/ui/avatar-atlas.ts',
  `// avatar-atlas.ts\n// Generated by scripts/avatar-compose.mjs from design/avatar-kit. Do not edit.\n` +
  `// Canvas geometry and part names for the layered portraits in public/avatars.\n\n` +
  `export const ATLAS = ${JSON.stringify(atlas, null, 2)} as const;\n`);

/* --------------------------------------------------------------- proof -- */

const tint = async (maskPath, hex) => sharp({ create: { width: CW, height: CH, channels: 4, background: hex } })
  .composite([{ input: maskPath, blend: 'dest-in' }]).png().toBuffer();

async function portrait({ hair, skin, cap, crown, brim, eyes, beard, jersey }) {
  const L = [];
  L.push({ input: await tint(join(OUT, 'neck.skin.png'), skin) });
  L.push({ input: join(OUT, 'neck.rest.png') });
  L.push({ input: join(OUT, 'jersey', `${jersey}.png`) });
  const dir = cap ? 'cap' : 'head';
  L.push({ input: await tint(join(OUT, dir, `${hair}.skin.png`), skin) });
  L.push({ input: join(OUT, 'eyes', `${eyes}.png`) });
  L.push({ input: join(OUT, 'mouth.png') });
  if (beard) L.push({ input: join(OUT, 'beard', `${beard}.png`) });
  if (cap) {
    L.push({ input: await tint(join(OUT, 'cap', `${hair}.crown.png`), crown) });
    L.push({ input: await tint(join(OUT, 'cap', `${hair}.brim.png`), brim) });
  }
  L.push({ input: join(OUT, dir, `${hair}.rest.png`) });
  return sharp({ create: { width: CW, height: CH, channels: 4, background: '#0000' } }).composite(L).png().toBuffer();
}

{
  const TEAMS = [['#1b2a52', '#c8202e'], ['#c8202e', '#ffffff'], ['#ffffff', '#1f5fd0'], ['#141414', '#e0b500'],
    ['#0f5c34', '#ffffff'], ['#7a1a2b', '#ffffff'], ['#6b2fb5', '#ffffff'], ['#e86a10', '#1f5fd0'],
    ['#9aa0a6', '#141414'], ['#ffffff', '#1b2a52'], ['#1c3f6e', '#ffffff'], ['#2f6b4f', '#e0b500']];
  const tiles = [];
  for (let i = 0; i < 24; i++) {
    const h = HAIR[i % 12], cap = i >= 12;
    tiles.push({ input: await portrait({
      hair: h, skin: atlas.skins[(i * 3) % 10], cap, crown: TEAMS[i % 12][0], brim: TEAMS[i % 12][1],
      eyes: atlas.eyes[i % 4], beard: [null, null, 'beard-full', null, 'mustache', null, null, 'beard-round', null, 'mustache-handlebar', null, null][i % 12],
      jersey: JERSEYS[i % 11],
    }), left: (i % 6) * (CW + 8) + 8, top: Math.floor(i / 6) * (CH + 8) + 8 });
  }
  await sharp({ create: { width: 6 * (CW + 8) + 8, height: 4 * (CH + 8) + 8, channels: 4, background: '#ffffff' } })
    .composite(tiles).png().toFile('design/avatar-kit/compose-check.png');
}

const n = atlas.hair.length * 6 + 2 + 1 + atlas.eyes.length + atlas.beards.length + atlas.jerseys.length;
console.log(`wrote ${n} layers to ${OUT}, atlas.json, and design/avatar-kit/compose-check.png`);
