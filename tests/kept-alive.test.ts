// kept-alive.test.ts
// One live instance per visit (back-plan S6, 2026-09-30). A screen the trail
// holds twice keeps two instances and two heights, so back to the first visit
// shows its own filter, not the second visit's (P0.5, probe S13). History
// keeps its page per visit, seeded from the hub's preset.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useDynasty, type DynastyStore } from '../src/state/store.js';
import { setEraReset } from '../src/state/era.js';
import { resetBackLayers } from '../src/state/backLayers.js';
import { KEEP_ALIVE, SCROLL_MEMORY, keptAlive, leftScroll, rememberScroll, scrollId, visitKey, type Alive } from '../src/ui/keptAlive.js';
import { History } from '../src/ui/screens/History.js';

type Stop = { tab: string; screen: string };
const key = (r: Stop): string => `${r.tab}|${r.screen}`;
const fresh = (): { current: Alive<Stop> } => ({ current: { list: [], last: null, gen: 0 } });
const at = (screen: string): Stop => ({ tab: 'program', screen });
const shown = (list: ReturnType<typeof keptAlive<Stop>>): number => list[list.length - 1]!.gen;

describe('keptAlive keys on the visit', () => {
  it('two visits to Colleges are two instances; back gets each its own', () => {
    const ref = fresh();
    keptAlive(ref, at('overview'), key, 1, false);
    const desert = shown(keptAlive(ref, at('colleges'), key, 2, false));
    keptAlive(ref, at('alumni'), key, 3, false);
    const mountain = shown(keptAlive(ref, at('colleges'), key, 4, false));
    expect(mountain).not.toBe(desert);
    const hall = keptAlive(ref, at('hall'), key, 5, false);
    // Both Colleges visits are still alive beside each other.
    expect(hall.filter((e) => e.r.screen === 'colleges').map((e) => e.gen)).toEqual([desert, mountain]);
    expect(shown(keptAlive(ref, at('colleges'), key, 4, true))).toBe(mountain);
    keptAlive(ref, at('alumni'), key, 3, true);
    expect(shown(keptAlive(ref, at('colleges'), key, 2, true))).toBe(desert);
  });

  it('a forward visit opens fresh and leaves the earlier visit alive', () => {
    const ref = fresh();
    const first = shown(keptAlive(ref, at('colleges'), key, 1, false));
    keptAlive(ref, at('alumni'), key, 2, false);
    const list = keptAlive(ref, at('colleges'), key, 3, false);
    expect(shown(list)).not.toBe(first);
    expect(list.map((e) => e.gen)).toContain(first);
  });

  it('the one on show is always last, and the list is capped', () => {
    const ref = fresh();
    let list = keptAlive(ref, at('a'), key, 1, false);
    for (let v = 2; v <= 7; v++) list = keptAlive(ref, at(v % 2 ? 'a' : 'b'), key, v, false);
    expect(list).toHaveLength(KEEP_ALIVE);
    expect(list[list.length - 1]!.id).toBe(visitKey(7, 'program|a'));
    // Evicted: a back to visit 1 mounts it again.
    const before = ref.current.gen;
    expect(shown(keptAlive(ref, at('a'), key, 1, true))).toBe(before + 1);
  });

  it('a screen change on the same visit is its own entry (a game left, a direct write)', () => {
    const ref = fresh();
    const today = shown(keptAlive(ref, { tab: 'home', screen: 'today' }, key, 9, true));
    const box = shown(keptAlive(ref, { tab: 'home', screen: 'box' }, key, 9, true));
    expect(box).not.toBe(today);
    // Back on that restored visit, the Today kept for it comes back.
    expect(shown(keptAlive(ref, { tab: 'home', screen: 'today' }, key, 9, true))).toBe(today);
    // Not restoring, the same visit's screen opens fresh and replaces the old one.
    const list = keptAlive(ref, { tab: 'home', screen: 'box' }, key, 9, false);
    expect(shown(list)).not.toBe(box);
    expect(list.map((e) => e.gen)).not.toContain(box);
  });

  it('is idempotent: a second render changes nothing', () => {
    const ref = fresh();
    const a = keptAlive(ref, at('colleges'), key, 1, false);
    const b = keptAlive(ref, at('colleges'), key, 1, false);
    expect(b).toBe(a);
    expect(ref.current.gen).toBe(1);
  });
});

describe('scroll memory keys on the visit', () => {
  it('two visits to one screen keep two heights', () => {
    const memory = new Map<string, number>();
    rememberScroll(memory, visitKey(2, 'program|colleges'), 900);
    rememberScroll(memory, visitKey(4, 'program|colleges'), 120);
    expect(memory.get(visitKey(2, 'program|colleges'))).toBe(900);
    expect(memory.get(visitKey(4, 'program|colleges'))).toBe(120);
  });

  it('is capped, the oldest visit going first', () => {
    const memory = new Map<string, number>();
    for (let v = 1; v <= SCROLL_MEMORY + 5; v++) rememberScroll(memory, visitKey(v, 'x'), v);
    expect(memory.size).toBe(SCROLL_MEMORY);
    expect(memory.has(visitKey(1, 'x'))).toBe(false);
    expect(memory.get(visitKey(SCROLL_MEMORY + 5, 'x'))).toBe(SCROLL_MEMORY + 5);
  });

  it('a move files the height under the visit being left, not the one arriving', () => {
    const colleges = { tab: 'program', screen: 'colleges', routeVisit: 2 };
    expect(leftScroll({ tab: 'program', screen: 'alumni', routeVisit: 3 }, colleges, key)).toBe(visitKey(2, 'program|colleges'));
    // Same screen, new visit (a tab re-tap, a back between two visits): still filed.
    expect(leftScroll({ ...colleges, routeVisit: 4 }, colleges, key)).toBe(visitKey(2, 'program|colleges'));
    // Nothing moved: nothing filed.
    expect(leftScroll({ ...colleges }, colleges, key)).toBeNull();
    expect(scrollId(colleges, key)).toBe(visitKey(2, 'program|colleges'));
  });
});

describe('with the store: probe S13 by hand', () => {
  const S = (): DynastyStore => useDynasty.getState();
  beforeEach(() => {
    setEraReset(false);
    S().start(4242, 0);
    useDynasty.setState({
      tab: 'home', screen: 'today', phase: null, bracket: null, jobSearch: false, live: null,
      overlay: null, overlayStack: [], navTrail: [], restoringVisit: null,
    });
    resetBackLayers();
  });
  afterEach(() => setEraReset(false));

  // Since M45 (2026-10-07) a screen visited again is the visit already in the
  // trail, not a second copy of it: Colleges twice is one Colleges.
  it('Colleges, Alumni, Colleges, Hall, then back x3: Colleges as left, the area, Home', () => {
    const ref = fresh();
    const render = (): number => {
      const s = S();
      const restoring = s.restoringVisit !== null && s.restoringVisit === s.routeVisit;
      return shown(keptAlive(ref, { tab: s.tab, screen: s.screen }, key, s.routeVisit, restoring));
    };
    render();
    S().go('program'); render();
    S().setScreen('colleges'); const desert = render();
    S().setScreen('alumni'); const alumni = render();
    S().setScreen('colleges'); expect(render()).toBe(desert);
    void alumni;
    S().setScreen('hall'); render();
    expect(S().goBack()).toBe('peeled'); expect(render()).toBe(desert);
    expect(S().goBack()).toBe('peeled'); expect(S().screen).toBe('records');
    expect(S().goBack()).toBe('peeled'); expect(S().screen).toBe('today');
    expect(S().goBack()).toBe('none');
  });

  it('the same trail, back x2: Colleges gets back the height it was left at', () => {
    // App's subscription, with the height the page sat at when each move left it.
    const memory = new Map<string, number>();
    let height = 0;
    const stop = useDynasty.subscribe((s, prev) => {
      const id = leftScroll(s, prev, key);
      if (id !== null) rememberScroll(memory, id, height);
    });
    const back = (): number | undefined => { expect(S().goBack()).toBe('peeled'); return memory.get(scrollId(S(), key)); };
    try {
      S().go('program');
      S().setScreen('colleges'); height = 900;
      S().setScreen('alumni'); height = 300;
      S().setScreen('colleges'); height = 120;
      S().setScreen('hall'); height = 40;
      expect(back()).toBe(120);
      expect(S().screen).toBe('colleges');
      height = 0; back();
      expect(S().screen).toBe('records');
    } finally { stop(); }
  });
});

describe('History keeps its page per visit', () => {
  const first = useDynasty.getInitialState();
  const kept = { ...first };
  const render = (): string => {
    Object.assign(first, useDynasty.getState());
    try { return renderToStaticMarkup(createElement(History)); } finally { Object.assign(first, kept); }
  };
  beforeEach(() => { useDynasty.getState().start(4242, 0); });

  it('a fresh History opens on the page the preset names', () => {
    useDynasty.setState({ historySheet: 'book' });
    const book = render();
    useDynasty.setState({ historySheet: 'seasons' });
    const seasons = render();
    expect(book).not.toBe(seasons);
  });

  it('the page is local state seeded once, not a store read every render', () => {
    const src = readFileSync('src/ui/screens/History.tsx', 'utf8');
    expect(src).toContain('useState(() => useDynasty.getState().historySheet)');
    expect(src).not.toContain('useDynasty((s) => s.historySheet)');
  });

  it('App keys its kept screens on the visit and shows the last one', () => {
    const app = readFileSync('src/ui/App.tsx', 'utf8');
    expect(app).toContain('keptAlive(aliveRef, routeStop(tab, screen), routeKey, routeVisit, restoring)');
    // Scroll memory is written and read through the one key the tests above drive.
    expect(app).toContain('const id = leftScroll(s, prev, routeKey);');
    expect(app).toContain('rememberScroll(scrollMemory.current, id, el.scrollTop)');
    expect(app).toContain('scrollMemory.current.get(scrollId({ tab, screen, routeVisit }, routeKey))');
    expect(app).not.toContain('mode={r.tab === tab && r.screen === screen');
  });
});
