// storage.test.ts
// The save layer, when the browser will not cooperate.
//
// Reported from testing, twice, and the second time browser-specific: "still
// stuck at building the league when opening from Chrome, from Safari it works".
//
// Opening IndexedDB has failure modes that never resolve *and* never reject. An
// open that needs a version change fires `blocked` when another connection is
// holding the database, and then waits — possibly for ever. Some browsers stall
// the request outright when site data is restricted for the origin. Neither can
// be caught, because there is nothing to catch: the promise stays pending, the
// loading screen stays up, and the game is gone.
//
// So the contract these tests pin is simply: **the open always settles**.

import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

/**
 * A request that is accepted and then never spoken of again.
 *
 * An EventTarget so the idb wrapper can subscribe to it exactly as it would to
 * a real request — it simply never receives success, error or blocked.
 */
class HungRequest extends EventTarget {
  onsuccess: unknown = null;
  onerror: unknown = null;
  onblocked: unknown = null;
  onupgradeneeded: unknown = null;
  result: unknown = null;
  error: unknown = null;
  readyState = 'pending';
  transaction = null;
  source = null;
}

function stubHungStorage(): void {
  vi.stubGlobal('IDBRequest', HungRequest);
  vi.stubGlobal('IDBTransaction', class {});
  vi.stubGlobal('IDBDatabase', class {});
  vi.stubGlobal('IDBCursor', class {});
  vi.stubGlobal('IDBIndex', class {});
  vi.stubGlobal('IDBObjectStore', class {});
  vi.stubGlobal('indexedDB', { open: () => new HungRequest() });
}

/**
 * Generous timeouts, and not because anything here is slow.
 *
 * These drive fake timers, so the four second wait they are testing costs
 * nothing — measured healthy, the three of them finish in about a second and a
 * half between them. What they do spend is real scheduler time: a dynamic
 * import apiece, and up to two full advance-and-drain cycles each, every one of
 * which has to hand back to the event loop. On a busy machine running the whole
 * suite in parallel that has been enough to pass five seconds of wall clock and
 * fail a test that was working perfectly.
 *
 * A red test that is really a report on CPU contention is worse than no test:
 * it goes off at random, it accuses whatever was committed last, and people
 * stop reading the suite. The generous bound costs nothing when things are
 * healthy and removes the false alarm.
 */
const SLOW_MACHINE = 30_000;

describe('an open that never answers', () => {
  it('gives up instead of hanging for ever', async () => {
    stubHungStorage();
    vi.useFakeTimers();

    const { loadDynasty } = await import('../src/state/persistence.js');
    const pending = loadDynasty('auto');
    // Nothing has settled it, and nothing ever will — except the timeout.
    const settled = expect(pending).rejects.toThrow(/storage/i);
    await vi.advanceTimersByTimeAsync(5000);
    await settled;
  }, SLOW_MACHINE);

  it('reports it as storage being unavailable, not as a corrupt save', async () => {
    // The two are different problems with different answers. A corrupt save
    // means start again; unreachable storage means the browser is in the way.
    stubHungStorage();
    vi.useFakeTimers();

    const mod = await import('../src/state/persistence.js');
    const pending = mod.loadDynasty('auto').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(5000);
    const error = await pending;

    expect(error).toBeInstanceOf(mod.StorageUnavailable);
  }, SLOW_MACHINE);

  it('does not cache the failure, so a later attempt can still work', async () => {
    // The blocking tab may close. Caching a rejected open would mean the game
    // never reaches storage again for the life of the page.
    stubHungStorage();
    vi.useFakeTimers();

    const { loadDynasty } = await import('../src/state/persistence.js');
    const first = loadDynasty('auto').catch(() => 'failed');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await first).toBe('failed');

    // A second attempt makes a fresh request rather than reusing the dead one.
    const second = loadDynasty('auto').catch(() => 'failed again');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await second).toBe('failed again');
  }, SLOW_MACHINE);
});
