// prep-sfx.mjs
// Turns the raw freesound downloads into the lean clips the app ships.
//
// No ffmpeg on this machine, and none needed: WAV and AIFF are uncompressed
// PCM with a header, so this file parses both by hand, downmixes to mono,
// resamples to 22050 Hz, trims the silence either side of the sound, applies
// a tiny fade to the cut edges, peak-normalizes, and writes 16-bit mono WAVs
// into public/sfx/. The MP3s are copied through untouched — every browser
// decodes MP3 natively and they are already small.
//
//   node scripts/prep-sfx.mjs
//
// Sources (freesound.org, ids in the names) are listed in public/sfx/CREDITS.md
// which this script rewrites. Check each license before store release.

import fs from 'node:fs';
import path from 'node:path';

const DL = 'C:/Users/cronu/Downloads';
const OUT = 'public/sfx';
const RATE = 22050;

fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/** Parse a RIFF WAV into float samples (channel-interleaved) + meta. */
function readWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not RIFF');
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        rate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = buf.subarray(body, body + size);
    }
    pos = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('missing fmt/data');
  const n = Math.floor(data.length / (fmt.bits / 8));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (fmt.format === 3 && fmt.bits === 32) out[i] = data.readFloatLE(i * 4);
    else if (fmt.bits === 16) out[i] = data.readInt16LE(i * 2) / 32768;
    else if (fmt.bits === 24) {
      const b = i * 3;
      let v = data[b] | (data[b + 1] << 8) | (data[b + 2] << 16);
      if (v & 0x800000) v |= ~0xffffff;
      out[i] = v / 8388608;
    } else if (fmt.bits === 32 && fmt.format === 1) out[i] = data.readInt32LE(i * 4) / 2147483648;
    else if (fmt.bits === 8) out[i] = (data[i] - 128) / 128;
    else throw new Error(`bits ${fmt.bits} fmt ${fmt.format}`);
  }
  return { samples: out, channels: fmt.channels, rate: fmt.rate };
}

/** Parse an AIFF (big-endian PCM) the same way. */
function readAiff(buf) {
  if (buf.toString('ascii', 0, 4) !== 'FORM') throw new Error('not FORM');
  let pos = 12;
  let comm = null;
  let ssnd = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32BE(pos + 4);
    const body = pos + 8;
    if (id === 'COMM') {
      // 80-bit extended float sample rate; the exponent/mantissa dance.
      const exp = buf.readUInt16BE(body + 8) - 16383;
      const mant = buf.readUInt32BE(body + 10);
      comm = {
        channels: buf.readUInt16BE(body),
        bits: buf.readUInt16BE(body + 6),
        rate: Math.round((mant / 0x80000000) * 2 ** exp),
      };
    } else if (id === 'SSND') {
      const offset = buf.readUInt32BE(body);
      ssnd = buf.subarray(body + 8 + offset, body + size);
    }
    pos = body + size + (size % 2);
  }
  if (!comm || !ssnd) throw new Error('missing COMM/SSND');
  const n = Math.floor(ssnd.length / (comm.bits / 8));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (comm.bits === 16) out[i] = ssnd.readInt16BE(i * 2) / 32768;
    else if (comm.bits === 24) {
      const b = i * 3;
      let v = (ssnd[b] << 16) | (ssnd[b + 1] << 8) | ssnd[b + 2];
      if (v & 0x800000) v |= ~0xffffff;
      out[i] = v / 8388608;
    } else if (comm.bits === 32) out[i] = ssnd.readInt32BE(i * 4) / 2147483648;
    else throw new Error(`aiff bits ${comm.bits}`);
  }
  return { samples: out, channels: comm.channels, rate: comm.rate };
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

function mono({ samples, channels }) {
  if (channels === 1) return samples;
  const n = Math.floor(samples.length / channels);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let a = 0;
    for (let c = 0; c < channels; c++) a += samples[i * channels + c];
    out[i] = a / channels;
  }
  return out;
}

function resample(samples, from, to) {
  if (from === to) return samples;
  const n = Math.floor(samples.length * (to / from));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = (i * from) / to;
    const a = Math.floor(t);
    const frac = t - a;
    out[i] = (samples[a] ?? 0) * (1 - frac) + (samples[a + 1] ?? samples[a] ?? 0) * frac;
  }
  return out;
}

/** Keep from the first loud-ish sample to the last, with padding + fades. */
function trim(samples, rate, { thresh = 0.02, padMs = 30, maxMs = null } = {}) {
  let start = 0;
  let end = samples.length - 1;
  while (start < samples.length && Math.abs(samples[start]) < thresh) start++;
  while (end > start && Math.abs(samples[end]) < thresh) end--;
  const pad = Math.round((padMs / 1000) * rate);
  start = Math.max(0, start - pad);
  end = Math.min(samples.length, end + pad * 4);
  if (maxMs) end = Math.min(end, start + Math.round((maxMs / 1000) * rate));
  const out = samples.slice(start, end);
  const fade = Math.min(Math.round(rate * 0.008), out.length >> 2);
  for (let i = 0; i < fade; i++) {
    out[i] *= i / fade;
    out[out.length - 1 - i] *= i / fade;
  }
  return out;
}

function normalize(samples, peakTo = 0.92) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  if (peak === 0) return samples;
  const g = peakTo / peak;
  for (let i = 0; i < samples.length; i++) samples[i] *= g;
  return samples;
}

function writeWav(file, samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
  return 44 + data.length;
}

// ---------------------------------------------------------------------------
// The pack
// ---------------------------------------------------------------------------

const JOBS = [
  // [source, out name, options]
  ['93136__cgeffex__hitting-baseball-w-wooden-bat.wav', 'crack.wav', { maxMs: 900 }],
  ['816984__luisa_sanchez__catching-a-baseball-glove.wav', 'glove.wav', { maxMs: 700 }],
  ['432502__keus92__baseball-into-glove.aiff', 'glove2.wav', { maxMs: 700 }],
  ['101137__cgeffex__play-ball.wav', 'playball.wav', { maxMs: 2500 }],
  // The ambience keeps ten seconds for a loop; quiet threshold, it is a bed.
  ['197285__adrian_gomar__nagoya-baseballregion_23.wav', 'crowd.wav',
    { thresh: 0.004, maxMs: 10000 }],
];

for (const [src, out, opts] of JOBS) {
  const file = path.join(DL, src);
  const buf = fs.readFileSync(file);
  const raw = src.endsWith('.aiff') ? readAiff(buf) : readWav(buf);
  let s = mono(raw);
  s = resample(s, raw.rate, RATE);
  s = normalize(trim(s, RATE, opts), out === 'crowd.wav' ? 0.5 : 0.92);
  const bytes = writeWav(path.join(OUT, out), s, RATE);
  console.log(`${out.padEnd(14)} ${(bytes / 1024).toFixed(1)} KB  (${(s.length / RATE).toFixed(2)}s)`);
}

// The MP3s pass through: browsers decode them natively and they are small.
for (const [src, out] of [
  ['628352__urkki69__hitting-a-finnish-baseball.mp3', 'crack2.mp3'],
  ['18364__jasinski__bb-claprhm.mp3', 'clap.mp3'],
]) {
  fs.copyFileSync(path.join(DL, src), path.join(OUT, out));
  console.log(`${out.padEnd(14)} copied`);
}

fs.writeFileSync(path.join(OUT, 'CREDITS.md'), `# Sound credits

All samples from freesound.org, processed (trim/mono/22 kHz) by
\`scripts/prep-sfx.mjs\`. **Verify each license before store release** —
CC-BY requires this credit shipped with the app; NC licenses cannot ship in
an app with paid IAP.

| file | freesound id | author |
|---|---|---|
| crack.wav | 93136 | CGEffex |
| crack2.mp3 | 628352 | urkki69 |
| glove.wav | 816984 | luisa_sanchez |
| glove2.wav | 432502 | keus92 |
| playball.wav | 101137 | CGEffex |
| crowd.wav | 197285 | adrian_gomar |
| clap.mp3 | 18364 | jasinski |
`);
console.log('CREDITS.md written');
