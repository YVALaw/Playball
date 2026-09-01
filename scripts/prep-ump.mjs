// prep-ump.mjs
// Cuts the umpire's calls out of the reporter's second freesound download.
//
//   node scripts/prep-ump.mjs
//
// The source (freesound 625473, jcookvoice, CC0) is one 25-second take. The
// page's description lists four calls, but the reporter LISTENED and the
// description lies about at least one of them: the third region says "Ball
// four, take your base." Ears beat metadata, so that region is the one cut
// shipped and the rest of the take is left on the floor — the mislabeled
// segments were reaching the game as the wrong words at the wrong moments.

import fs from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/cronu/Downloads/625473__jcookvoice__american-baseball-the-umpire.wav';
const OUT = 'public/sfx';
const RATE = 22050;

const buf = fs.readFileSync(SRC);
let pos = 12, fmt = null, data = null;
while (pos + 8 <= buf.length) {
  const id = buf.toString('ascii', pos, pos + 4);
  const size = buf.readUInt32LE(pos + 4);
  const body = pos + 8;
  if (id === 'fmt ') fmt = {
    channels: buf.readUInt16LE(body + 2),
    rate: buf.readUInt32LE(body + 4),
    bits: buf.readUInt16LE(body + 14),
  };
  else if (id === 'data') data = buf.subarray(body, body + size);
  pos = body + size + (size % 2);
}

const frames = Math.floor(data.length / 2 / fmt.channels);
const mono = new Float32Array(frames);
for (let i = 0; i < frames; i++) {
  let a = 0;
  for (let c = 0; c < fmt.channels; c++) a += data.readInt16LE((i * fmt.channels + c) * 2) / 32768;
  mono[i] = a / fmt.channels;
}

function resample(s, from, to) {
  const n = Math.floor(s.length * (to / from));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = (i * from) / to, a = Math.floor(t), f = t - a;
    out[i] = (s[a] ?? 0) * (1 - f) + (s[a + 1] ?? s[a] ?? 0) * f;
  }
  return out;
}
function trim(s, rate) {
  let a = 0, b = s.length - 1;
  while (a < s.length && Math.abs(s[a]) < 0.02) a++;
  while (b > a && Math.abs(s[b]) < 0.02) b--;
  const pad = Math.round(rate * 0.03);
  a = Math.max(0, a - pad); b = Math.min(s.length, b + pad * 3);
  const out = s.slice(a, b);
  const fade = Math.min(Math.round(rate * 0.008), out.length >> 2);
  for (let i = 0; i < fade; i++) { out[i] *= i / fade; out[out.length - 1 - i] *= i / fade; }
  return out;
}
function normalize(s, to = 0.92) {
  let peak = 0;
  for (const v of s) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < s.length; i++) s[i] *= to / peak;
  return s;
}
function writeWav(file, s, rate) {
  const d = Buffer.alloc(s.length * 2);
  for (let i = 0; i < s.length; i++) d.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s[i] * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + d.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(d.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, d]));
  return 44 + d.length;
}

// [start s, end s, out] — regions from the RMS segmentation, order from the
// freesound description.
const CUTS = [
  // The reporter's ears: "in reality it says ball four take a base."
  [8.35, 9.95, 'ump-ballfour.wav'],
];

for (const [t0, t1, name] of CUTS) {
  let s = mono.slice(Math.round(t0 * fmt.rate), Math.round(t1 * fmt.rate));
  s = normalize(trim(resample(s, fmt.rate, RATE), RATE));
  const bytes = writeWav(path.join(OUT, name), s, RATE);
  console.log(`${name.padEnd(18)} ${(bytes / 1024).toFixed(1)} KB (${(s.length / RATE).toFixed(2)}s)`);
}
console.log('done — remember CREDITS.md');
