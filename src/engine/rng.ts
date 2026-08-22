// rng.ts
// Seeded xorshift32. Deterministic by design: the same seed and the same inputs
// reproduce a season exactly, which buys reproducible bug reports, replays
// without storing every play, and small save files. Store the seed in the save.

import type { Rng } from './types.js';

/**
 * The generator exposes its own state, which sounds like a leak and is actually
 * the point: a save has to resume mid-season exactly where it left off. Storing
 * the seed alone is not enough once thousands of draws have been consumed, and
 * replaying a multi-year dynasty from the seed on every load would take seconds.
 */
export function makeRng(seed = 12345): Rng {
  let s = seed >>> 0;
  const rng = function (): number {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  } as Rng;
  rng.state = (): number => s;
  return rng;
}

/** Resume a generator mid-stream from a saved state. */
export function rngFromState(state: number): Rng {
  return makeRng(state);
}

/** Standard normal via Box-Muller. */
export function gauss(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Normal draw clamped to a rating range. */
export function normal(rng: Rng, mean: number, sd: number, lo = 15, hi = 95): number {
  return Math.max(lo, Math.min(hi, mean + gauss(rng) * sd));
}
