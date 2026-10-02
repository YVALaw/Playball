// resume-two-step.test.ts
// "Pick it up" lands on Today first and opens the game a frame later, so the
// game's history entry is left on a painted Today, the screen back from the
// game lands on (back plan §4 V2, 2026-09-30). Only resumeGame does this; a
// game started with Play ball still opens at once (overhaul.test.ts).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_store: string, value: { slot: string }) => { disk.set(value.slot, structuredClone(value)); },
    get: async (_store: string, key: string) => {
      const found = disk.get(key);
      return found === undefined ? undefined : structuredClone(found);
    },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_store: string, key: string) => { disk.delete(key); },
  }),
}));

import { useDynasty, afterPaint, type DynastyStore } from '../src/state/store.js';
import { clearJournal } from '../src/state/liveJournal.js';
import { depth, levels, levelSig, levelsKey, eraNow, ledgerNav } from '../src/state/nav.js';
import { resetBackLayers } from '../src/state/backLayers.js';
import { installHistorySync, type HistorySync, type Engine } from '../src/ui/historySync.js';
import { FakeBrowser, type FakeEnv } from './support/fakeBrowser.js';
import { simSeason } from '../src/engine/season.js';

const S = (): DynastyStore => useDynasty.getState();
const g = globalThis as Record<string, unknown>;

/** A page with frames the test runs by hand. */
function frames(): { run(): void; queued(): number } {
  let q: (() => void)[] = [];
  g['document'] = {
    documentElement: { dataset: {} }, visibilityState: 'visible',
    addEventListener() {}, removeEventListener() {},
  };
  g['requestAnimationFrame'] = (fn: () => void) => { q.push(fn); return q.length; };
  return { run: () => { const now = q; q = []; for (const fn of now) fn(); }, queued: () => q.length };
}

beforeEach(() => {
  disk.clear();
  const mem = new Map<string, string>();
  const shim: Storage = {
    get length() { return mem.size; },
    key: (i: number) => [...mem.keys()][i] ?? null,
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, String(v)); },
    removeItem: (k: string) => { mem.delete(k); },
    clear: () => { mem.clear(); },
  };
  g['window'] = { localStorage: shim };
  clearJournal();
  useDynasty.setState({ live: null, liveMeta: null, pendingGame: null }); // the last test's game
});
afterEach(() => {
  vi.useRealTimers();
  delete g['document'];
  delete g['requestAnimationFrame'];
  delete g['window'];
});

/** The same, for a June bracket game: the app reopens on the bracket with it pending. */
async function juneInterrupted(): Promise<void> {
  for (let team = 0; ; team++) {
    expect(team).toBeLessThan(40);
    S().start(4242, team);
    S().autoLineup();
    simSeason(S().season!);
    await S().playPostseason();
    if (S().myBracket) break;
  }
  await S().manageBracketGame();
  expect(S().live).not.toBeNull();
  const slot = S().loadedSlot!;
  S().backToStart();
  expect(await S().loadSlot(slot)).toBe(true);
  expect(S().bracket).not.toBeNull();
  expect(S().pendingGame).not.toBeNull();
  expect(S().live).toBeNull();
}

/** A managed game started, saved at its first pitch, and the app closed: loaded again with it pending. */
async function interrupted(): Promise<void> {
  S().start(4242, 0);
  S().autoLineup();
  await S().startManagedGame();
  expect(S().live).not.toBeNull();
  const slot = S().loadedSlot!;
  S().backToStart();
  expect(await S().loadSlot(slot)).toBe(true);
  expect(S().pendingGame).not.toBeNull();
  expect(S().live).toBeNull();
}

describe('afterPaint', () => {
  it('runs at once with no document (node)', () => {
    let ran = 0;
    afterPaint(() => { ran++; });
    expect(ran).toBe(1);
  });

  it('runs two frames on, once, and not again when its 100 ms fallback comes due', () => {
    vi.useFakeTimers();
    const f = frames();
    let ran = 0;
    afterPaint(() => { ran++; });
    expect(ran).toBe(0);
    f.run(); // the frame being committed: it paints after this
    expect(ran).toBe(0);
    f.run();
    expect(ran).toBe(1);
    vi.advanceTimersByTime(200);
    expect(ran).toBe(1);
  });

  it('a page that runs no frames gets it after 100 ms', () => {
    vi.useFakeTimers();
    frames();
    let ran = 0;
    afterPaint(() => { ran++; });
    vi.advanceTimersByTime(99);
    expect(ran).toBe(0);
    vi.advanceTimersByTime(1);
    expect(ran).toBe(1);
  });
});

describe('Pick it up: Today first, the game a frame later', () => {
  it('in node (no document) it still ends on the game, as before', async () => {
    await interrupted();
    await S().resumeGame(true);
    expect(S().live).not.toBeNull();
    expect(`${S().tab}|${S().screen}`).toBe('home|box');
  });

  it('on a page: Today with the game live for one painted frame, then the game', async () => {
    await interrupted();
    const f = frames();
    await S().resumeGame(true);
    expect(S().live).not.toBeNull();
    expect(`${S().tab}|${S().screen}`).toBe('home|today');
    f.run();
    expect(S().screen).toBe('today'); // Today paints after this frame
    f.run();
    expect(`${S().tab}|${S().screen}`).toBe('home|box');
  });

  it('a move made in that frame wins: the game waits behind Back to game', async () => {
    await interrupted();
    const f = frames();
    await S().resumeGame(true);
    useDynasty.setState({ tab: 'team', screen: 'roster' });
    f.run(); f.run();
    expect(`${S().tab}|${S().screen}`).toBe('team|roster');
    expect(S().live).not.toBeNull();
  });

  it.each(['chromium', 'webkit'] as Engine[])('on %s, the game\'s entry is left on Today with the game waiting, so back from it previews where it lands', async (engine) => {
    await interrupted();
    resetBackLayers();
    const b = new FakeBrowser({ engine });
    // What a frame shows: the levels' picture, plus the "Pick it up" card the picture leaves out.
    b.painter = () => `${levelSig(depth())}|${S().pendingGame ? 'pick it up' : '-'}|${S().screen}`;
    let ledger: HistorySync | null = null;
    let seen = '';
    b.afterTask = () => {
      const k = `${levelsKey()}#${eraNow()}`;
      if (k !== seen) { seen = k; ledger?.afterCommit(); } else ledger?.painting();
    };
    b.open((env: FakeEnv) => {
      const mine = installHistorySync({ ...env, nav: ledgerNav, boot: 'r1', hold: () => false },
        { pushMark: () => {}, markReturn: () => {}, onUserPop: () => {} });
      ledger = mine;
      return () => mine.dispose();
    });
    // The store's frames are the page's frames.
    g['document'] = { documentElement: { dataset: {} }, visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
    g['requestAnimationFrame'] = b.env.requestAnimationFrame;
    b.advance(100);
    expect(b.painted).toContain('pick it up');
    let resumed!: Promise<void>;
    b.tap(() => { resumed = S().resumeGame(true); });
    await resumed;
    expect(S().screen).toBe('today');
    for (let k = 0; k < 10 && b.pushes === 0; k++) b.advance(16);
    expect(S().screen).toBe('box');
    expect(levels().map((l) => l.kind)).toEqual(['game']);
    expect(b.pushes).toBe(1);
    b.advance(50);
    b.swipeBack();
    b.advance(100);
    expect(S().screen).toBe('today'); // the game waits
    expect(S().live).not.toBeNull();
    expect(b.preview).not.toContain('pick it up');
    expect(b.preview).toBe(b.painted);
    ledger!.dispose();
  });

  it('only resumeGame takes two steps: Play ball opens the game at once', async () => {
    S().start(4242, 0);
    S().autoLineup();
    frames();
    await S().startManagedGame();
    expect(S().screen).toBe('box');
  });
});

// June draws the dugout off `live` alone and its game is a refused guard, so
// there the bracket paints without the card first and the game arrives whole,
// one write, a frame later (V2 fixes, 2026-09-30).
describe('Pick it up in June: the bracket first, the game in one write a frame later', () => {
  it('in node it opens the game at once', async () => {
    await juneInterrupted();
    await S().resumeGame(true);
    expect(S().live).not.toBeNull();
    expect(`${S().tab}|${S().screen}`).toBe('home|box');
  });

  it('on a page the dugout never shows on Today: live and box land in the same write', async () => {
    await juneInterrupted();
    const f = frames();
    const seen: string[] = [];
    const off = useDynasty.subscribe((s) => { if (s.live) seen.push(s.screen); });
    await S().resumeGame(true);
    expect(S().pendingGame).toBeNull(); // the card goes now
    expect(S().live).toBeNull();
    f.run();
    expect(S().live).toBeNull(); // the bracket paints after this frame
    f.run();
    off();
    expect(S().live).not.toBeNull();
    expect(`${S().tab}|${S().screen}`).toBe('home|box');
    expect(seen).toEqual(['box']);
  });

  it.each(['chromium', 'webkit'] as Engine[])('on %s, the guard\'s entry is left on the bracket, not the card', async (engine) => {
    await juneInterrupted();
    resetBackLayers();
    const b = new FakeBrowser({ engine });
    b.painter = () => `${levelSig(depth())}|${S().pendingGame ? 'pick it up' : '-'}|${S().live ? 'dugout' : 'bracket'}`;
    let ledger: HistorySync | null = null;
    let seen = '';
    b.afterTask = () => {
      const k = `${levelsKey()}#${eraNow()}`;
      if (k !== seen) { seen = k; ledger?.afterCommit(); } else ledger?.painting();
    };
    b.open((env: FakeEnv) => {
      const mine = installHistorySync({ ...env, nav: ledgerNav, boot: 'r1', hold: () => false },
        { pushMark: () => {}, markReturn: () => {}, onUserPop: () => {} });
      ledger = mine;
      return () => mine.dispose();
    });
    g['document'] = { documentElement: { dataset: {} }, visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
    g['requestAnimationFrame'] = b.env.requestAnimationFrame;
    b.advance(100);
    expect(b.painted).toContain('pick it up');
    let resumed!: Promise<void>;
    b.tap(() => { resumed = S().resumeGame(true); });
    await resumed;
    for (let k = 0; k < 10 && b.pushes === 0; k++) b.advance(16);
    expect(levels().map((l) => l.kind)).toEqual(['guard']);
    expect(b.pushes).toBe(1);
    const under = b.entries[b.index - 1]!.shot;
    expect(under).not.toContain('pick it up');
    expect(under).toContain('bracket');
    b.advance(50);
    b.swipeBack();
    b.advance(100);
    expect(S().live).not.toBeNull(); // refused: the game is played to its end
    expect(b.preview).not.toContain('pick it up');
    ledger!.dispose();
  });
});
