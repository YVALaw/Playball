// navprobe3.test.ts
// The browser probe (tests/probes/navprobe3.js) runs in a page. Here it is
// read (2026-09-30): it must still parse, carry every scenario the plan names,
// and its driver must refuse the user's dev port. It is also run in a small
// fake window (below), enough for its rows, faults, counts and guards.

import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

const probe = readFileSync(new URL('./probes/navprobe3.js', import.meta.url), 'utf8');
const driver = readFileSync(new URL('./probes/navprobe3-driver.mjs', import.meta.url), 'utf8');

/* eslint-disable @typescript-eslint/no-explicit-any */
class FakeEl {
  textContent = '';
  className = '';
  isConnected = true;
  parentElement: FakeEl | null = null;
  rect = { left: 0, top: 10, width: 100, height: 20 };
  attrs: Record<string, string> = {};
  clicks = 0;
  onClick?: () => void;
  find?: (sel: string) => FakeEl[];
  closestFn?: (sel: string) => FakeEl | null;
  constructor(o: Partial<FakeEl> = {}) { Object.assign(this, o); }
  getClientRects() { return [this.rect]; }
  getBoundingClientRect() { const r = this.rect; return { ...r, bottom: r.top + r.height, right: r.left + r.width }; }
  getAttribute(k: string) { return this.attrs[k] ?? null; }
  querySelector(sel: string) { return this.querySelectorAll(sel)[0] ?? null; }
  querySelectorAll(sel: string) { return this.find?.(sel) ?? []; }
  closest(sel: string) { return this.closestFn?.(sel) ?? null; }
  contains(o: unknown) { return o === this; }
  click() { this.clicks++; this.onClick?.(); }
  scrollIntoView() { /* already in view */ }
  get classList() { return { contains: (c: string) => this.className.split(' ').includes(c) }; }
}

type Win = Record<string, any> & { dispatch: (type: string, ev: unknown) => void };
const stops: Array<() => void> = [];
afterEach(() => { while (stops.length) stops.pop()!(); });

/** The probe in a window with no page: history, storage, events, no DOM. */
function boot({ port = '5176', allow = false, before }: {
  port?: string; allow?: boolean; before?: (w: { win: Win; doc: any; hist: any }) => void;
} = {}) {
  const listeners: Array<{ type: string; fn: (e: unknown) => void; capture: boolean }> = [];
  const timers: any[] = [];
  let stopped = false;
  const storage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } }; };
  const ss = storage();
  const doc: any = {
    q: (_sel: string): FakeEl[] => [],
    querySelector(sel: string) { return this.q(sel)[0] ?? null; },
    querySelectorAll(sel: string) { return this.q(sel); },
    documentElement: { dataset: {} }, scrollingElement: { scrollTop: 0 }, body: {}, hidden: false,
    elementFromPoint: (): FakeEl | null => null,
  };
  // At the target, capture listeners run before bubble ones (Chrome 89+).
  const win: Win = {
    addEventListener(type: string, fn: (e: unknown) => void, cap?: boolean | { capture?: boolean }) {
      listeners.push({ type, fn, capture: cap === true || (typeof cap === 'object' && !!cap?.capture) });
    },
    dispatch(type: string, ev: unknown) {
      const on = listeners.filter((l) => l.type === type);
      for (const l of [...on.filter((l) => l.capture), ...on.filter((l) => !l.capture)]) l.fn(ev);
    },
  };
  if (allow) win['__np3Allow'] = true;
  const entries: Array<{ state: unknown }> = [{ state: null }];
  let at = 0;
  const travel = (n: number) => {
    timers.push(setTimeout(() => {
      const to = at + n;
      if (to < 0 || to >= entries.length) return;
      at = to;
      win.dispatch('popstate', { isTrusted: true, state: entries[at]!.state });
    }, 5));
  };
  const hist: any = {
    get state() { return entries[at]!.state; },
    get length() { return entries.length; },
    pushState(st: unknown) { entries.splice(at + 1); entries.push({ state: st }); at++; },
    replaceState(st: unknown) { entries[at] = { state: st }; },
    go(n: number) { travel(n); }, back() { travel(-1); }, forward() { travel(1); },
  };
  before?.({ win, doc, hist });
  const env: Record<string, unknown> = {
    window: win, history: hist, document: doc, sessionStorage: ss, localStorage: storage(),
    location: { port, href: `http://localhost:${port}/`, reload() { /* none */ } },
    navigator: { userActivation: { isActive: false, hasBeenActive: false }, userAgent: 'node' },
    requestAnimationFrame: (cb: (t: number) => void) => { if (!stopped) timers.push(setTimeout(() => cb(0), 16)); },
    setInterval: (fn: () => void, ms: number) => { const h = setInterval(fn, ms); timers.push(h); return h; },
    getComputedStyle: () => ({ visibility: 'visible', opacity: '1', overflowY: 'visible' }),
    Element: FakeEl, innerHeight: 812, Event: class {}, navigation: undefined,
  };
  const names = Object.keys(env);
  const said = new Function(...names, `const said = ${probe};\nreturn said;`)(...names.map((k) => env[k])) as string;
  const stop = () => { stopped = true; for (const t of timers) clearTimeout(t); };
  stops.push(stop);
  return { said, win, doc, hist, ss, listeners, np3: win['__np3'] as any };
}
const pb = (i: number) => ({ pb: 2, boot: 'b', i, era: 'e' });

describe('navprobe3', () => {
  it('parses as the script pasted into a page', () => {
    expect(() => new Function(probe)).not.toThrow();
  });

  it('has a runner for S1 to S16', () => {
    const have = [...probe.matchAll(/async (S\d+)\(c/g)].map((m) => m[1]);
    expect(have).toEqual(Array.from({ length: 16 }, (_, i) => `S${i + 1}`));
  });

  it('returns the table the plan asks for, with the invariant carried and counted', async () => {
    const { hist, win, np3 } = boot({ before: ({ win: w }) => { w['__nav'] = { want: () => 1 }; } });
    expect(np3).toBeTruthy();
    np3.RUNNERS.T1 = async (c: any) => {
      hist.replaceState(pb(0), '');
      await c.W(60);
      hist.pushState(pb(1), '');
      await c.W(60);
      await c.back();                                     // lands on i 0 while the ledger wants 1
    };
    const res = await np3.run('T1');
    const row = res.rows.find((r: any) => r.press === 'back');
    for (const k of ['scenario', 'press', 'i', 'preview', 'live', 'match', 'inv']) expect(row).toHaveProperty(k);
    expect(row).toMatchObject({ scenario: 'T1', press: 'back', i: 0, match: true, inv: false });
    expect(typeof row.preview).toBe('string');
    expect(res.summary.invFailed).toBe(1);
    expect(np3.table([res])[0]).toMatchObject({ scenario: 'T1', press: 'back', i: 0, match: true, inv: false });
    expect(win['__np3']).toBe(np3);
  }, 10000);

  it('counts guard and refused presses apart from real misses', () => {
    const { np3 } = boot();
    const s = np3.summarize([
      { press: 'back', match: false, tag: 'guard' },
      { press: 'back', match: false, tag: 'refused' },
      { press: 'back', match: false, tag: 'guard', leaves: 'ledger root' },   // held nothing: a miss
      { press: 'back', match: false, tag: null },
      { press: 'back', match: true, inv: false },
      { press: 'plan up', match: false },
    ], [{ kind: 'push-during-vt', info: true }, { kind: 'push-in-pop', soft: false }]);
    expect(s).toMatchObject({ presses: 5, match: 1, mismatch: 2, tagged: 2, invFailed: 1, checksFailed: 1, faults: 1, softFaults: 0, vtPushes: 1 });
  });

  // SW probe round 1 (2026-09-30): the plan's other trade-offs, the misses a
  // later package owns, and a leave the page did not take, each counted apart.
  it('counts known misses by package and the plan\'s other trade-offs apart, and a leave the page did not take', () => {
    const { np3 } = boot();
    const s = np3.summarize([
      { press: 'back', match: false, tag: 'residual' },                         // §7, P0.6
      { press: 'forward', match: false, tag: 'refused' },                       // §6.6
      { press: 'back', match: false, tag: 'no-tap' },                           // §6.10
      { press: 'back', match: false, tag: 'known:V1' },
      { press: 'back', match: false, tag: 'known:S5' },
      { press: 'back', match: true, tag: 'known:S6' },                          // fixed since: a match
      { press: 'back', match: false, tag: 'known:V1', leaves: 'ledger root' },  // held nothing: a miss
      { press: 'back', match: false, tag: null },
      { press: 'back', match: true, tag: 'leave' },                             // pressed: something was still up
      { press: 'back', match: true, tag: 'leave', leaves: 'another document' },
    ], []);
    expect(s).toMatchObject({ presses: 10, match: 3, mismatch: 2, tagged: 3, known: 2, leaveHeld: 1 });
  });

  it('reads the preview the swipe showed: the landed entry as the pop found it, not as the app\'s refund left it', async () => {
    let screen = 'Roster';
    const heading = new FakeEl();
    Object.defineProperty(heading, 'textContent', { get: () => screen });
    const { hist, np3 } = boot({
      before: ({ win: w, doc: d, hist: h }) => {
        d.q = (sel: string) => (sel.startsWith('main h1') ? [heading] : []);
        // The app refuses a swipe onto entry 0 and refunds it: go(+1), the screen unchanged.
        w.addEventListener('popstate', (e: any) => { if (e.state?.i === 0) h.go(1); });
      },
    });
    np3.RUNNERS.T6 = async (c: any) => {
      hist.replaceState(pb(0), '');
      await c.W(60);                                      // Roster is painted
      hist.pushState(pb(1), '');                          // entry 0 is left showing Roster
      screen = 'Lineup';
      await c.W(60);                                      // Lineup is painted
      await c.back('refused');                            // the swipe shows Roster; the app stays on Lineup
    };
    const res = await np3.run('T6');
    const row = res.rows.find((r: any) => r.press === 'back');
    expect(row.preview).toMatch(/h=Roster/);
    expect(row.live).toMatch(/h=Lineup/);
    expect(row).toMatchObject({ i: 0, match: false, reshot: true, tag: 'refused' });
    expect(res.summary).toMatchObject({ mismatch: 0, tagged: 1 });
    expect(np3.table([res])[0]).toMatchObject({ reshot: true });
  }, 10000);

  it('fresh({ tapped }) taps Start between the dev calls, as the job\'s own tap would be', async () => {
    const title = new FakeEl({ textContent: 'Playball', className: 'pb-start__title' });
    const calls: string[] = [];
    const state = {
      backToStart: () => calls.push('backToStart'),
      start: () => calls.push('start'),
      leaveStart: () => calls.push('leaveStart'),
    };
    const { np3 } = boot({
      before: ({ win: w, doc: d }) => {
        w['store'] = { getState: () => state };
        d.q = (sel: string) => (sel === '.pb-start__title' ? [title] : []);
        d.elementFromPoint = () => title;
      },
    });
    title.onClick = () => calls.push('tap');
    np3.RUNNERS.T7 = async (c: any) => { await c.fresh({ plan: 'keep', tapped: true }); };
    const res = await np3.run('T7');
    expect(res.error).toBeUndefined();
    expect(calls).toEqual(['backToStart', 'tap', 'start', 'leaveStart']);
    expect(res.steps).toEqual(['dev: back to Start', 'a tap on Start', 'dev: career 4242/3']);
  }, 10000);

  it('listens to popstate in capture, so a pasted probe sees the app push inside its pop', async () => {
    const { hist, listeners, np3 } = boot({
      // The app's own bubble listener, added before the probe (a paste).
      before: ({ win: w, hist: h }) => w.addEventListener('popstate', () => h.pushState(pb(1), '')),
    });
    expect(listeners.find((l) => l.type === 'popstate' && l.capture)).toBeTruthy();
    np3.RUNNERS.T2 = async (c: any) => {
      hist.replaceState(pb(0), '');
      hist.pushState(pb(1), '');
      await c.W(60);
      await c.back();
    };
    const res = await np3.run('T2');
    expect(res.faults.map((f: any) => f.kind)).toContain('push-in-pop');
  }, 10000);

  it('keeps a push after a traversal hard even when a store call came before it', async () => {
    const { hist, np3 } = boot({ before: ({ win: w }) => { w['store'] = { getState: () => ({}) }; } });
    np3.RUNNERS.T3 = async (c: any) => {
      hist.replaceState(pb(0), '');
      await c.dev('setup', () => undefined);
      hist.pushState(pb(1), '');
      await c.W(60);
      await c.back();
      hist.pushState(pb(1), '');                          // the app, after the swipe: hard
      await c.dev('a store call', () => hist.pushState(pb(2), ''));   // the probe's hand: soft
    };
    const res = await np3.run('T3');
    const pushes = res.faults.filter((f: any) => f.kind === 'push-no-activation');
    expect(pushes.map((f: any) => f.soft)).toEqual([false, true]);
    expect(res.summary).toMatchObject({ faults: 1, softFaults: 1 });
  }, 10000);

  it('marks a push made while a view transition holds the old frame', () => {
    const pending = new Promise(() => undefined);
    const { doc, hist, np3 } = boot({
      before: ({ doc: d }) => { d.startViewTransition = () => ({ updateCallbackDone: pending, finished: pending }); },
    });
    doc.startViewTransition(() => undefined);
    hist.pushState(pb(1), '');
    const f = np3.faults().find((x: any) => x.kind === 'push-during-vt');
    expect(f).toMatchObject({ info: true, vt: 'update' });
    expect(np3.hardFaults()).toEqual([]);
  });

  it('reads in-screen picks (a chip, a segment) into the painted signature', () => {
    const { doc, np3 } = boot();
    const chip = new FakeEl({ textContent: 'Desert' });
    const main = new FakeEl({ find: (sel) => (sel.includes('aria-pressed') ? [chip] : []) });
    doc.q = (sel: string) => (sel === 'main' ? [main] : []);
    const a = np3.sample('t');
    chip.textContent = 'Mountain';
    const b = np3.sample('t');
    expect(a.dom.picks).toBe('Desert');
    expect(np3.compare(a, b).diff.picks).toEqual(['Desert', 'Mountain']);
  });

  it('puts a dialog away before tapping behind it, and never clicks through anything else', async () => {
    const { doc, np3 } = boot();
    const target = new FakeEl({ textContent: 'Go' });
    const later = new FakeEl({ textContent: 'Later', className: 'pb-btn pb-btn--secondary', rect: { left: 0, top: 300, width: 100, height: 20 } });
    const host = new FakeEl({ className: 'pb-dialog-host', find: (sel) => (sel === 'button' ? [later] : []) });
    const scrim = new FakeEl({ className: 'pb-dialog-host', closestFn: (sel) => (sel.includes('.pb-dialog-host') ? host : null) });
    let up = true;
    later.onClick = () => { up = false; };
    doc.elementFromPoint = (_x: number, y: number) => (up ? (y > 200 ? later : scrim) : target);
    np3.RUNNERS.T4 = async (c: any) => { await c.tap(target, { name: 'Go', wait: 50 }); };
    const ok = await np3.run('T4');
    expect(ok.error).toBeUndefined();
    expect(target.clicks).toBe(1);
    expect(ok.steps[0]).toMatch(/Go \[put away/);

    const sheet = new FakeEl({ className: 'pb-sheet-host' });
    const behind = new FakeEl({ textContent: 'Behind' });
    doc.elementFromPoint = () => sheet;
    np3.RUNNERS.T5 = async (c: any) => { await c.tap(behind, { name: 'Behind' }); };
    const blocked = await np3.run('T5');
    expect(blocked.error).toMatch(/Behind: occluded by pb-sheet-host/);
    expect(behind.clicks).toBe(0);
  }, 10000);

  it("refuses to install where the user plays, and elsewhere unless allowed", () => {
    for (const port of ['5173', '5174']) {
      const r = boot({ port, allow: true });
      expect(r.said).toMatch(/refused/);
      expect(r.np3).toBeUndefined();
      expect(r.ss.getItem('navprobe3:src')).toBeNull();
    }
    expect(boot({ port: '3000' }).np3).toBeUndefined();
    expect(boot({ port: '3000', allow: true }).np3).toBeTruthy();
    expect(boot({ port: '5175' }).np3).toBeTruthy();
    const ok = boot({ port: '5176' });
    expect(ok.said).toMatch(/installed/);
    expect(ok.ss.getItem('navprobe3:src')).toContain('navprobe3');
  });

  it('reinstalls from sessionStorage and reads __nav only when present', () => {
    expect(probe).toContain("sessionStorage.setItem('navprobe3:src'");
    expect(probe).toMatch(/window\.__nav\b/);
    expect(probe).not.toContain('crypto.randomUUID');
  });

  it("keeps the driver off 5174, the user's dev server", () => {
    expect(driver).toMatch(/5174/);
    expect(driver).toContain('process.exit(2)');
  });
});

/*
  What each runner presses, and what it expects of each press, after the
  switch (SW probe round 1, 2026-09-30). The runners run against a stand-in
  ctx that finds every control and records the presses; the tags say where
  the plan expects a press to leave the page (§6.1, §6.5), to be refused or
  held (§6.3, §6.4, §6.6), to miss by design (§6.10, §7), or to miss until a
  named package lands. Round 1's runners predated eras: they pressed at era
  roots expecting more trail, kept a 'leave' where a Season plan comes up,
  and started S1's career with no tap at all.
*/
describe('navprobe3 runners, against the plan', () => {
  function script(np3: any, name: string, part?: number): Promise<{ presses: string[]; log: string[] }> {
    const presses: string[] = [];
    const log: string[] = [];
    const found = new FakeEl({ textContent: 'found' });
    const c: any = {
      W: async () => undefined, settle: async () => undefined, Skip: Error, find: () => null, vis: () => true, brief: () => '',
      store: () => ({ offers: [{}], season: { teams: [] }, userTeam: 0, year: 2027 }),
      live: () => 'live', entries: () => 1, row: (r: unknown) => r,
      tutorials: () => undefined, endTour: async () => undefined, gotIt: async () => false,
      clearDialogs: async () => undefined, sheetClose: async () => undefined,
      fresh: async (o: { plan?: string; tapped?: boolean } = {}) => { log.push(`fresh${o.plan === 'keep' ? ' keep' : ''}${o.tapped ? ' tapped' : ''}`); },
      tabbar: async (l: string) => { log.push(`tab ${l}`); return found; },
      section: async (l: string) => { log.push(`section ${l}`); return found; },
      tap: async (what: unknown, o: { name?: string } = {}) => { log.push(`tap ${o.name ?? String(what)}`); return found; },
      dev: async (what: string) => { log.push(`dev ${what}`); },
      note: (press: string) => { log.push(`note ${press}`); },
      back: async (tag: string | null = null) => { const p = tag ? `back:${tag}` : 'back'; presses.push(p); log.push(p); },
      forward: async (tag: string | null = null) => { const p = tag ? `forward:${tag}` : 'forward'; presses.push(p); log.push(p); },
    };
    return Promise.resolve(np3.RUNNERS[name](c, part)).then(() => ({ presses, log }));
  }

  const SPEC: Array<[string, string[], number?]> = [
    ['S1', ['back', 'back', 'back', 'back', 'back', 'back:leave']],
    ['S2', ['back', 'back', 'back', 'back', 'back', 'back:leave']],
    ['S3', ['back', 'back', 'back', 'back', 'back', 'back:leave']],
    ['S4', ['back', 'back', 'back', 'back', 'back:leave', 'back:guard']],
    ['S5', ['back:leave', 'back', 'back', 'back:guard', 'back:guard', 'back', 'back:leave']],
    ['S6', ['back', 'back', 'back:leave', 'back', 'back:leave']],
    ['S7', ['back:leave', 'back', 'back', 'back', 'back']],
    ['S8', ['back', 'back:leave'], 2],
    ['S9', ['forward:refused', 'back', 'forward:refused', 'forward:refused', 'back:leave']],
    ['S10', ['back:refused', 'back:residual', 'back', 'back:leave']],
    ['S11', ['back', 'back', 'back', 'back', 'back', 'back', 'back', 'back', 'back:leave']],
    ['S12', ['back:known:S5', 'back', 'back', 'back', 'back:leave']],
    ['S13', ['back', 'back', 'back:known:S6', 'back', 'back', 'back:leave']],
    ['S14', ['back', 'back', 'back:leave']],
    ['S15', ['back:leave']],
    ['S16', ['back', 'back:no-tap', 'back:leave']],
  ];

  it.each(SPEC)('%s presses where the plan says, tagged with what it expects', async (name, want, part) => {
    const { np3 } = boot();
    const { presses } = await script(np3, name, part);
    expect(presses).toEqual(want);
  });

  it('starts S1\'s career from a tap, so the Season plan\'s entry is pushed as in play', async () => {
    const { np3 } = boot();
    const { log } = await script(np3, 'S1');
    expect(log[0]).toBe('fresh keep tapped');
  });

  it('presses once at an era root: the runner that expects the page to go does not press there again', async () => {
    const { np3 } = boot();
    for (const [name, , part] of SPEC) {
      const { log } = await script(np3, name, part);
      // A 'leave' is the last press before the next tap or dev call, never followed by another press.
      log.forEach((step, k) => {
        if (step !== 'back:leave') return;
        const next = log[k + 1];
        expect(next === undefined || !/^(back|forward)/.test(next), `${name}: a press after its leave`).toBe(true);
      });
    }
  });
});
