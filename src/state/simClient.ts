// simClient.ts
// Main-thread handle on the simulation worker.
//
// The worker is created lazily and kept alive: spinning one up costs a module
// graph parse, and a dynasty asks for many seasons over its life.

import * as Comlink from 'comlink';
import type { SimApi, SimProgress } from './simWorker.js';
import type { Portable } from './seasonCodec.js';

let worker: Worker | null = null;
let api: Comlink.Remote<SimApi> | null = null;

/**
 * Rejects when the current worker dies. A Comlink call whose worker has
 * crashed never settles — the message port simply goes quiet — so without
 * this, `playSeason`'s await hung forever, `busy` stayed true, and the season
 * could never be simulated or rolled again. One deferred per worker, raced
 * against every call.
 */
let workerFailed: Promise<never> | null = null;

function remote(): Comlink.Remote<SimApi> {
  if (!api) {
    // `new URL(..., import.meta.url)` is the form Vite recognises for bundling a
    // worker; a bare string path would break in the production build.
    //
    // The extension is `.ts`, not the `.js` used everywhere else in this project.
    // Those are module specifiers, which TypeScript rewrites; this is a runtime
    // URL that the bundler resolves literally against the filesystem, and there
    // is no simWorker.js on disk to find.
    worker = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' });
    api = Comlink.wrap<SimApi>(worker);
    const w = worker;
    workerFailed = new Promise<never>((_, reject) => {
      const fail = (why: string) => (): void => {
        // A crashed worker stays crashed; cached, every later call would hang
        // against the same dead port. Tear it down so the next call builds a
        // fresh one.
        if (worker === w) disposeWorker();
        reject(new Error(why));
      };
      w.addEventListener('error', fail('the simulation worker crashed'));
      w.addEventListener('messageerror', fail('the simulation worker sent an unreadable message'));
    });
    // A worker that never fails would otherwise leave this rejection unhandled
    // at teardown. It is only ever consumed through the race below.
    workerFailed.catch(() => undefined);
  }
  return api;
}

/** True when this environment can run the worker at all. */
export const workerAvailable = typeof Worker !== 'undefined';

export function simSeasonInWorker(
  portable: Portable,
  onProgress?: (p: SimProgress) => void,
): Promise<Portable> {
  // Callbacks have to be proxied explicitly: Comlink cannot clone a function.
  // Each proxy holds a message listener until the worker goes away — a small,
  // bounded cost per season sim, reclaimed when `disposeWorker` runs (a new
  // dynasty, or a crash). Accepted rather than plumbing releaseProxy through:
  // a dynasty sims a few dozen seasons, not thousands.
  const call = remote().simSeason(portable, onProgress ? Comlink.proxy(onProgress) : undefined);
  // Raced against the worker dying, so the caller's await settles either way.
  return workerFailed ? Promise.race([call, workerFailed]) : call;
}

/** Release the worker. Called when a dynasty is closed, not between seasons. */
export function disposeWorker(): void {
  worker?.terminate();
  worker = null;
  api = null;
  workerFailed = null;
}
