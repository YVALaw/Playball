// simClient.ts
// Main-thread handle on the simulation worker.
//
// The worker is created lazily and kept alive: spinning one up costs a module
// graph parse, and a dynasty asks for many seasons over its life.

import * as Comlink from 'comlink';
import type { SimApi, SimProgress } from './simWorker.js';
import type { Portable } from './seasonCodec.js';
import type { OffseasonReport } from '../engine/progression.js';

let worker: Worker | null = null;
let api: Comlink.Remote<SimApi> | null = null;

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
  return remote().simSeason(portable, onProgress ? Comlink.proxy(onProgress) : undefined);
}

export function simDayInWorker(portable: Portable): Promise<Portable> {
  return remote().simDay(portable);
}

export function offseasonInWorker(
  portable: Portable,
): Promise<{ portable: Portable; report: OffseasonReport }> {
  return remote().offseason(portable);
}

/** Release the worker. Called when a dynasty is closed, not between seasons. */
export function disposeWorker(): void {
  worker?.terminate();
  worker = null;
  api = null;
}
