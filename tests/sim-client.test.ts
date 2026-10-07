// sim-client.test.ts
// The worker handle (audit 17, M47): each call is failed by the worker dying,
// and settles on its own result otherwise, with nothing kept per call.

import { describe, it, expect, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ resolve: (v: unknown) => void }>);
vi.mock('comlink', () => ({
  wrap: () => ({
    simSeason: () => new Promise((resolve) => { calls.push({ resolve }); }),
  }),
  proxy: <T>(f: T) => f,
  releaseProxy: Symbol('release'),
}));

class FakeWorker {
  static last: FakeWorker | null = null;
  listeners = new Map<string, Array<() => void>>();
  terminated = false;
  constructor() { FakeWorker.last = this; }
  addEventListener(t: string, f: () => void): void {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), f]);
  }
  terminate(): void { this.terminated = true; }
  emit(t: string): void { for (const f of this.listeners.get(t) ?? []) f(); }
}
(globalThis as unknown as { Worker: unknown }).Worker = FakeWorker;

import { simSeasonInWorker, disposeWorker } from '../src/state/simClient.js';
import type { Portable } from '../src/state/seasonCodec.js';

const world = {} as Portable;

describe('the sim worker handle (M47)', () => {
  it('settles each call on its own result', async () => {
    const a = simSeasonInWorker(world);
    const b = simSeasonInWorker(world);
    calls[0]!.resolve('first');
    calls[1]!.resolve('second');
    expect(await a).toBe('first');
    expect(await b).toBe('second');
  });

  it('fails every waiting call when the worker crashes, and builds a fresh one after', async () => {
    const before = FakeWorker.last!;
    const waiting = simSeasonInWorker(world);
    before.emit('error');
    await expect(waiting).rejects.toThrow('crashed');
    expect(before.terminated).toBe(true);
    // A settled call is not failed again by a later crash.
    const next = simSeasonInWorker(world);
    expect(FakeWorker.last).not.toBe(before);
    calls[calls.length - 1]!.resolve('fine');
    expect(await next).toBe('fine');
    FakeWorker.last!.emit('error');
    disposeWorker();
  });
});
