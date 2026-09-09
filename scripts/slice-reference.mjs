// slice-reference.mjs
// Cuts the avatar reference sheet into its component parts.
//
// The sheet is the artwork. This does not redraw anything: it finds each part
// in the sheet's alpha channel, crops it to its own transparent PNG, and writes
// the crop rectangles to slices.json in sheet coordinates — which is exactly
// what an Aseprite slice is, so the sheet can also be opened whole with every
// part named.
//
// Two rows are drawn touching (the jerseys, and the busts whose shoulders
// overlap), so those are cut at the sparsest column between neighbours. A bust
// therefore keeps a sliver of the next bust's shoulder; that is a two-minute
// eraser job in Aseprite and not something worth guessing at here.
//
//   node scripts/slice-reference.mjs

import sharp from 'sharp';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SRC = 'design/avatar-kit/reference-sheet.png';
const OUT = 'design/avatar-kit';
const PAD = 2;

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const A = (x, y) => data[(y * W + x) * 4 + 3];

// The generator that made this sheet left stray faint pixels through the empty
// areas: tens of thousands at alpha 1-4, a sparse dusting up to about alpha 45.
// Invisible, but each would be a phantom pixel on an Aseprite layer and they
// drag crop bounds outward. A flat floor high enough to catch them would also
// nibble every outline's anti-aliased fringe, so instead drop faint pixels that
// have no solid pixel near them — a fringe always touches the ink it softens.
{
  const solid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) solid[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = data[(y * W + x) * 4 + 3];
    if (a === 0 || a >= 96) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < W && yy >= 0 && yy < H && solid[yy * W + xx]) { near = true; break; }
    }
    if (!near) { data[(y * W + x) * 4 + 3] = 0; n++; }
  }
  console.log(`dropped ${n} isolated faint pixels`);
}

/* ------------------------------------------------------- strip the labels --
 * The row titles are the only text on the sheet. Every glyph is a component
 * under 20px tall; nothing that is artwork is that short (the smallest real
 * part, an eye dot, is 22px). Find them and clear their alpha before slicing.
 */
{
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  let cleared = 0;
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || data[s * 4 + 3] <= 128) continue;
    let top = 0; stack[top++] = s; seen[s] = 1;
    const members = [];
    let miny = H, maxy = 0;
    while (top) {
      const i = stack[--top]; members.push(i);
      const x = i % W, y = (i / W) | 0;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      const nb = [];
      if (x > 0) nb.push(i - 1); if (x < W - 1) nb.push(i + 1);
      if (y > 0) nb.push(i - W); if (y < H - 1) nb.push(i + W);
      for (const j of nb) if (!seen[j] && data[j * 4 + 3] > 128) { seen[j] = 1; stack[top++] = j; }
    }
    if (maxy - miny + 1 <= 19) {
      // Clear the glyph and its anti-aliased halo.
      for (const i of members) {
        const x = i % W, y = (i / W) | 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < W && yy >= 0 && yy < H) data[(yy * W + xx) * 4 + 3] = 0;
        }
      }
      cleared++;
    }
  }
  console.log(`cleared ${cleared} label glyphs`);
}

/* ------------------------------------------------------------ the map --
 * Positions come from a connected-component pass over the sheet. Separated
 * rows split themselves at empty columns; the two touching rows split at the
 * sparsest column near each expected boundary.
 */
const HAIR = ['afro-short', 'buzz', 'curls-tight', 'spiky', 'side-swept', 'blonde-curls',
  'bob', 'dreads', 'bald', 'crop', 'curls-short', 'ponytail'];
const HATS = ['navy', 'red', 'white-blue-s', 'black-gold-a', 'white-green', 'white-red',
  'white-purple', 'orange-blue', 'grey', 'camo', 'white-navy-side', 'snapback-back'];
const JERSEYS = ['pinstripe', 'white-red', 'grey', 'navy', 'cream-gold', 'black-gold',
  'red', 'green', 'purple', 'orange', 'light-blue', 'catcher'];
const BUSTS = ['01-b-navy', '02-w-red', '03-s-white-blue', '04-a-black-gold', '05-m-white-green',
  '06-t-maroon', '07-c-white-purple', '08-r-navy-orange', '09-p-grey', '10-h-catcher'];
const FACIAL = ['beard-round', 'mustache-handlebar', 'mustache', 'beard-full', 'beard-open', 'beard-long'];

/** Split band y0..y1 spanning x0..x1 into n windows at the sparsest columns. */
function autoWindows(y0, y1, x0, x1, n) {
  const density = new Int32Array(W);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (A(x, y) > 128) density[x]++;
  const pitch = (x1 - x0) / n, reach = Math.round(pitch * 0.25);
  const cuts = [x0];
  for (let k = 1; k < n; k++) {
    const e = Math.round(x0 + k * pitch);
    let min = Infinity;
    for (let x = e - reach; x <= e + reach; x++) min = Math.min(min, density[x]);
    // Cut in the middle of the longest run at that minimum, not at its edge:
    // an edge column sits against the neighbour's anti-aliased fringe, and the
    // fringe would then set this part's bounds.
    let bestStart = e, bestLen = 0, runStart = null;
    for (let x = e - reach; x <= e + reach + 1; x++) {
      const inRun = x <= e + reach && density[x] === min;
      if (inRun && runStart === null) runStart = x;
      if (!inRun && runStart !== null) {
        if (x - runStart > bestLen) { bestLen = x - runStart; bestStart = runStart; }
        runStart = null;
      }
    }
    cuts.push(bestStart + Math.floor(bestLen / 2));
  }
  cuts.push(x1);
  return cuts.slice(0, -1).map((c, i) => [c, cuts[i + 1], y0, y1]);
}
const fixed = (y0, y1, xs) => xs.map(([a, b]) => [a, b, y0, y1]);

const ROWS = [
  { folder: 'skin', names: [...Array(5)].map((_, i) => `skin-${String(i + 1).padStart(2, '0')}`),
    windows: fixed(40, 104, [[10, 76], [77, 143], [144, 210], [211, 277], [278, 344]]) },
  { folder: 'skin', names: [...Array(5)].map((_, i) => `skin-${String(i + 6).padStart(2, '0')}`),
    windows: fixed(104, 166, [[10, 76], [77, 143], [144, 210], [211, 277], [278, 344]]) },
  { folder: 'eyes', names: [...Array(5)].map((_, i) => `color-${i + 1}`),
    windows: fixed(44, 104, [[398, 459], [460, 521], [522, 583], [584, 645], [646, 708]]) },
  { folder: 'eyes', names: ['style-1', 'style-2', 'style-3', 'style-4'],
    windows: [[786, 862, 52, 90], [906, 990, 54, 92], [786, 862, 100, 138], [904, 992, 102, 140]] },
  { folder: 'facial-hair', names: FACIAL,
    windows: fixed(52, 132, [[1040, 1121], [1124, 1198], [1200, 1272], [1274, 1350], [1352, 1432], [1436, 1518]]) },
  { folder: 'hair', names: HAIR, windows: autoWindows(186, 318, 14, 1502, 12) },
  { folder: 'hair-hat', names: HAIR, windows: autoWindows(318, 474, 14, 1502, 12) },
  { folder: 'hats', names: HATS, windows: autoWindows(480, 578, 14, 1512, 12) },
  { folder: 'jerseys', names: JERSEYS, windows: autoWindows(596, 724, 8, 1526, 12) },
  { folder: 'avatars', names: BUSTS, windows: autoWindows(742, 998, 2, 1533, 10) },
];

/* -------------------------------------------------------------- slice -- */

await rm(join(OUT, 'parts'), { recursive: true, force: true });
const slices = [];
let overlay = '';

for (const row of ROWS) {
  await mkdir(join(OUT, 'parts', row.folder), { recursive: true });
  for (const [i, name] of row.names.entries()) {
    const [wx0, wx1, wy0, wy1] = row.windows[i];
    // Tight bounds of anything visible inside the window, then a little air.
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = wy0; y <= wy1; y++) for (let x = wx0; x <= wx1; x++) {
      if (A(x, y) > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) { console.warn(`empty: ${row.folder}/${name}`); continue; }
    x0 = Math.max(wx0, x0 - PAD); y0 = Math.max(wy0, y0 - PAD);
    x1 = Math.min(wx1, x1 + PAD); y1 = Math.min(wy1, y1 + PAD);
    const rect = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };

    // Copy just this window's pixels so a touching neighbour cannot leak in.
    const buf = Buffer.alloc(rect.w * rect.h * 4);
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
      const si = ((rect.y + y) * W + rect.x + x) * 4, di = (y * rect.w + x) * 4;
      buf[di] = data[si]; buf[di + 1] = data[si + 1]; buf[di + 2] = data[si + 2]; buf[di + 3] = data[si + 3];
    }
    await sharp(buf, { raw: { width: rect.w, height: rect.h, channels: 4 } })
      .png().toFile(join(OUT, 'parts', row.folder, `${name}.png`));

    slices.push({ folder: row.folder, name, ...rect });
    overlay += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="none" stroke="#e0007a" stroke-width="1.5"/>
      <text x="${rect.x + 2}" y="${rect.y + rect.h - 3}" font-family="Arial" font-size="9" font-weight="700" fill="#e0007a">${name}</text>`;
  }
}

await writeFile(join(OUT, 'slices.json'), JSON.stringify({
  source: 'reference-sheet.png', width: W, height: H, slices,
}, null, 2));

// Proof sheet: the artwork on white with every slice outlined and named.
const cleaned = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
await sharp({ create: { width: W, height: H, channels: 4, background: '#ffffff' } })
  .composite([
    { input: cleaned },
    { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${overlay}</svg>`) },
  ]).png().toFile(join(OUT, 'slice-check.png'));

console.log(`wrote ${slices.length} parts, slices.json, slice-check.png`);
