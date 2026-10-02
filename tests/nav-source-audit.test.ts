// nav-source-audit.test.ts
//
// The back gesture has one history writer and one list of levels (CL,
// 2026-09-30). These read the source, so a new writer is caught the day it is
// written rather than the day a swipe previews the wrong screen:
//   - only `src/ui/historySync.ts` touches `history` (plan correction 24);
//   - the store's old `playball:history-*` events are gone for good;
//   - the store moves `tab`/`screen` only in the actions that own a move, each
//     line tagged `/* nav-write */`, so a new direct write has to say so;
//   - store layers are stamped by `era.ts`'s middleware alone.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

function sources(dir = join(ROOT, 'src')): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.(ts|tsx|mts|js|jsx)$/.test(name)) out.push(path);
  }
  return out;
}
const rel = (path: string): string => relative(ROOT, path).replace(/\\/g, '/');
const FILES = sources().map((path) => ({ file: rel(path), text: readFileSync(path, 'utf8') }));

/** Plan correction 24, as written. */
const HISTORY = /\b(window\.)?history\.(pushState|replaceState|go|back|forward|state)\b/;

describe('one history writer', () => {
  it('only historySync.ts names the history API', () => {
    const hits = FILES.filter((f) => HISTORY.test(f.text)).map((f) => f.file);
    expect(hits).toEqual(['src/ui/historySync.ts']);
  });

  it('the store sends the shell no history events any more', () => {
    expect(FILES.filter((f) => f.text.includes('playball:history-')).map((f) => f.file)).toEqual([]);
  });

  it('store layers are stamped by the middleware alone', () => {
    const callers = FILES
      .filter((f) => /\b(un)?stampLayer\(/.test(f.text))
      .map((f) => f.file)
      .sort();
    expect(callers).toEqual(['src/state/backLayers.ts', 'src/state/era.ts']);
  });

  it('the old model is not exported, and the names tests pin still are', async () => {
    const layers = await import('../src/state/backLayers.js');
    expect(Object.keys(layers)).not.toContain('together');
    for (const name of ['stampLayer', 'unstampLayer', 'newestStoreLayer', 'resetBackLayers', 'peelBackLayer']) {
      expect(typeof (layers as Record<string, unknown>)[name], name).toBe('function');
    }
    const backNav = await import('../src/ui/backNav.js');
    expect(Object.keys(backNav)).not.toContain('hasLayerToClose');
    expect(Object.keys(backNav)).toEqual(expect.arrayContaining(['Back', 'isNativeShell']));
    const level = await import('../src/ui/BackLevel.js');
    expect(Object.keys(level)).toEqual(['BackLevel']);
  });
});

// ---------------------------------------------------------------------------
// The store's direct moves
// ---------------------------------------------------------------------------

/** The actions allowed to write `tab` or `screen` themselves; 'initial' is the starting state. */
const MOVERS = new Set([
  'initial', 'go', 'setScreen', 'goBack', 'leaveGame', 'start', 'rollYear', 'endCareer', 'startNewCoach',
  'acceptOffer', 'loadSlot', 'backToStart', 'resumeGame', 'startManagedGame', 'endManagedGame', 'resign',
]);
const TAG = '/* nav-write */';
/** `tab:`/`screen:` with a value (not a type), or the shorthand ending a line or an object. */
const KEYED = /(?:^|[{,]\s*)(tab|screen)\s*(?::(?!\s*(?:Tab|string)\b)|,\s*$|\s*\})/;
/** The shorthand mid-line, counted only inside `{ ... }` so a parameter or argument list stays out
 *  (fixer, 2026-09-30). A spread such as `set({ ...ROOM_HOME[room] })` is past a line scan. */
const SHORT = /\{\s*(?:[\w.]+(?:\s*:\s*(?:[^,{}()]|\([^()]*\))*)?\s*,\s*)*(tab|screen)\s*[,}]/;
const WRITE = { test: (code: string): boolean => KEYED.test(code) || SHORT.test(code) };
const ACTION = /^ {2}([A-Za-z]+): (?:async )?\(/;

interface Line { n: number; action: string; code: string; raw: string }

/** The store creator's lines, with comments and string contents blanked out. */
function storeLines(): Line[] {
  const raw = readFileSync(join(ROOT, 'src/state/store.ts'), 'utf8').split('\n');
  const start = raw.findIndex((l) => l.includes('create<DynastyStore>('));
  expect(start, 'the store creator').toBeGreaterThan(0);
  const out: Line[] = [];
  let action = 'initial';
  let inBlock = false;
  for (let n = start; n < raw.length; n++) {
    const l = raw[n]!;
    const named = ACTION.exec(l);
    if (named) action = named[1]!;
    let code = '';
    for (let j = 0; j < l.length;) {
      if (inBlock) {
        const end = l.indexOf('*/', j);
        if (end < 0) break;
        inBlock = false;
        j = end + 2;
      } else if (l.startsWith('//', j)) break;
      else if (l.startsWith('/*', j)) { inBlock = true; j += 2; }
      else if (l[j] === "'" || l[j] === '"' || l[j] === '`') {
        const q = l[j]!;
        let k = j + 1;
        while (k < l.length && l[k] !== q) k += l[k] === '\\' ? 2 : 1;
        code += q + q;
        j = k + 1;
      } else { code += l[j]; j++; }
    }
    out.push({ n: n + 1, action, code: code.trim(), raw: l });
  }
  return out;
}

describe("the store's direct moves", () => {
  const lines = storeLines();
  const writes = lines.filter((l) => WRITE.test(l.code));

  it('finds the moves it should (the audit is not blind)', () => {
    const where = new Set(writes.map((l) => l.action));
    for (const a of ['initial', 'go', 'setScreen', 'goBack', 'leaveGame', 'start', 'acceptOffer', 'loadSlot']) {
      expect(where.has(a), a).toBe(true);
    }
  });

  it('every tab or screen write is tagged and sits in an action that owns a move', () => {
    const untagged = writes.filter((l) => !l.raw.includes(TAG)).map((l) => `${l.n} [${l.action}] ${l.raw.trim()}`);
    expect(untagged).toEqual([]);
    const strays = writes.filter((l) => !MOVERS.has(l.action)).map((l) => `${l.n} [${l.action}] ${l.raw.trim()}`);
    expect(strays).toEqual([]);
  });

  it('every tag marks a write', () => {
    const idle = lines.filter((l) => l.raw.includes(TAG) && !WRITE.test(l.code)).map((l) => `${l.n} ${l.raw.trim()}`);
    expect(idle).toEqual([]);
  });

  it('the scanner itself tells a write from a type or a call', () => {
    const is = (code: string): boolean => WRITE.test(code);
    expect(is("tab: 'home',")).toBe(true);
    expect(is('tab: stop.tab, screen: stop.screen,')).toBe(true);
    expect(is("set({ screen: 'today' });")).toBe(true);
    expect(is('tab,')).toBe(true);
    expect(is('selectedPlayer: null, screen,')).toBe(true);
    expect(is('set({ tab, screen, overlay: null });')).toBe(true);
    expect(is('return { tab, screen, overlay: null };')).toBe(true);
    expect(is('set({ overlay: null, stack: pop(s.stack), screen, seen: 1 });')).toBe(true);
    expect(is('tab: Tab;')).toBe(false);
    expect(is('go: (tab, screen, focus) => {')).toBe(false);
    expect(is('...trailStep(get(), tab, nextScreen),')).toBe(false);
    expect(is('if (s.screen !== screen) return;')).toBe(false);
    expect(is('set({ ...trail, focus: f(tab, screen) });')).toBe(false);
  });
});
