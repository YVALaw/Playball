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
 * The calls waiting on the current worker, each with the way to fail it. A
 * Comlink call whose worker has crashed never settles — the message port
 * simply goes quiet — so without this, `playSeason`'s await hung forever,
 * `busy` stayed true, and the season could never be simulated or rolled again.
 *
 * Per call, and removed when the call settles. It used to be one promise per
 * worker raced against every call, and each race left a reaction on it that
 * held the season the worker sent back — about 7 MB a season, for the life of
 * the worker (audit 17, M47).
 */
const pending = new Set<(e: Error) => void>();

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
    const fail = (why: string) => (): void => {
      // A crashed worker stays crashed; cached, every later call would hang
      // against the same dead port. Tear it down so the next call builds a
      // fresh one.
      if (worker === w) disposeWorker();
      const waiting = [...pending];
      pending.clear();
      for (const reject of waiting) reject(new Error(why));
    };
    w.addEventListener('error', fail('the simulation worker crashed'));
    w.addEventListener('messageerror', fail('the simulation worker sent an unreadable message'));
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
  // The worker releases the proxy when the season is done.
  const call = remote().simSeason(portable, onProgress ? Comlink.proxy(onProgress) : undefined);
  // Failed by the worker dying too, so the caller's await settles either way.
  return new Promise<Portable>((resolve, reject) => {
    pending.add(reject);
    call.then(resolve, reject).finally(() => pending.delete(reject));
  });
}

/** Release the worker. Called when a dynasty is closed, not between seasons. */
export function disposeWorker(): void {
  worker?.terminate();
  worker = null;
  api = null;
}
