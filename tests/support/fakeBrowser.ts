// fakeBrowser.ts
// A session history close enough to Chromium's and WebKit's to catch the
// back gesture's faults in node (back-plan.md §4 X, 2026-09-30).
//
// Chromium: `go(n)` targets the index it was called at, resolved on flush();
// a push with no tap since the last traversal marks the document's entries
// skippable, and the back swipe jumps them. WebKit: one scheduled traversal,
// a second `go` replaces it; a push 10 s after the last tap is flagged, and a
// swipe from a flagged entry skips the flagged run plus one. Entry 0 is the
// page before ours, so a swipe off our root "leaves the site" (none with `firstInTab`).
// An entry's shot is what was painted when it was left; with a `painter` the
// page paints once a frame, after the frame's rAF callbacks (V1).

import type { Engine } from '../../src/ui/historySync.js';

export interface FakeEntry {
  state: unknown;
  /** The document it belongs to; traversing between documents loads a page. */
  doc: number;
  /** The painted signature when the entry was left: what a swipe previews. */
  shot: string | null;
  skippable: boolean;
  flagged: boolean;
  /** Not our site. */
  foreign: boolean;
}

type Listener = (e: Event) => void;

class Target {
  private map = new Map<string, Set<Listener>>();
  addEventListener(type: string, fn: Listener): void {
    let set = this.map.get(type);
    if (!set) this.map.set(type, (set = new Set()));
    set.add(fn);
  }
  removeEventListener(type: string, fn: Listener): void { this.map.get(type)?.delete(fn); }
  dispatch(type: string, fields: Record<string, unknown> = {}): void {
    const ev = { type, isTrusted: true, ...fields } as unknown as Event;
    for (const fn of [...(this.map.get(type) ?? [])]) fn(ev);
  }
  count(type: string): number { return this.map.get(type)?.size ?? 0; }
}

export interface FakeEnv {
  history: {
    readonly state: unknown; readonly length: number;
    pushState(data: unknown, unused: string): void;
    replaceState(data: unknown, unused: string): void;
    go(delta: number): void;
    back(): void;
    forward(): void;
  };
  win: Target & Record<string, unknown>;
  doc: Target & { readonly visibilityState: string };
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  requestAnimationFrame(fn: () => void): unknown;
  engine: Engine;
  navigation: { readonly currentEntry: { readonly index: number } | null } | null;
  navigationType(): string;
}

/** Boots the page on a document; returns its unload. */
export type Mount = (env: FakeEnv, navigationType: string) => () => void;

export interface FakeOptions {
  engine: Engine;
  cap?: number;
  /** Expose `navigation.currentEntry.index`. */
  navigationApi?: boolean;
  /** 'same': a reload keeps the old entries in the new document; 'cross': only the reloaded one. */
  reloadMode?: 'same' | 'cross';
  /** WebKit: a second `go` replaces the first, or adds to it. */
  webkitGo?: 'replace' | 'adjust';
  /** Nothing before our site in the tab (a new tab, iOS, a standalone PWA): no entry 0. */
  firstInTab?: boolean;
}

interface Timer { id: number; at: number; fn: () => void; frame?: boolean }

export class FakeBrowser {
  readonly engine: Engine;
  readonly cap: number;
  entries: FakeEntry[] = [];
  index = 0;
  clock = 1_000_000;
  painted = '';
  visibility: 'visible' | 'hidden' = 'visible';
  /** Where the page went when it left our site: 'user' by a swipe, 'script' by a go. */
  left: 'user' | 'script' | null = null;
  /** Commit hook: the harness calls the ledger's afterCommit here, as App's layout effect would. */
  afterTask: (() => void) | null = null;
  /** What the last swipe or long press previewed: its landing entry's shot as it stood (V1). */
  preview: string | null = null;
  /** Called with each push's state before it lands, while `painted` is what it records (V1). */
  beforePush: ((data: unknown) => void) | null = null;
  /**
   * Frames (V1): set, the page paints what this returns once every 16 ms
   * frame, after that frame's rAF callbacks, instead of the harness painting
   * after each task. A hidden page paints nothing and runs no rAF.
   */
  painter: (() => string) | null = null;

  // fault injection
  throwOnPush = 0;
  dropGos = 0;

  // counters
  pushes = 0;
  pushesInsidePop = 0;
  pushesWithoutActivation = 0;
  flaggedPushes = 0;
  goCalls = 0;
  goWhilePending = 0;
  loads = 0;
  log: string[] = [];

  private opts: FakeOptions;
  private timers: Timer[] = [];
  private frozen: (() => void)[] = [];
  private rafQueue: (() => void)[] = [];
  private frameTimer: number | null = null;
  private nextTimer = 1;
  private chromiumQueue: number[] = [];
  private webkitSlot: number | null = null;
  private lastTap = -Infinity;
  private activationSinceTraversal = false;
  private inPop = false;
  private docId = 0;
  private liveDoc = 0;
  private unmount: (() => void) | null = null;
  private mount: Mount | null = null;
  private win = new Target() as Target & Record<string, unknown>;
  private doc: Target & { visibilityState: string };
  private navType = 'navigate';

  readonly env: FakeEnv;

  constructor(opts: FakeOptions) {
    this.opts = opts;
    this.engine = opts.engine;
    this.cap = opts.cap ?? (opts.engine === 'webkit' ? 100 : 50);
    const doc = new Target() as Target & { visibilityState: string };
    Object.defineProperty(doc, 'visibilityState', { get: () => this.visibility });
    this.doc = doc;
    const me = this;
    this.env = {
      history: {
        get state(): unknown { return me.current.state; },
        get length(): number { return me.entries.length; },
        pushState: (data) => me.pushState(data),
        replaceState: (data) => { me.current.state = structuredClone(data); me.log.push(`replace ${idx(data)}`); },
        go: (n) => me.go(n),
        back: () => me.go(-1),
        forward: () => me.go(1),
      },
      win: this.win,
      doc,
      now: () => me.clock,
      setTimeout: (fn, ms) => me.setTimer(fn, ms),
      clearTimeout: (h) => { me.timers = me.timers.filter((t) => t.id !== h); },
      // A hidden page runs no frames: they wait for show().
      requestAnimationFrame: (fn) => {
        if (me.painter) { me.rafQueue.push(fn); me.scheduleFrame(); return 0; }
        return me.setTimer(() => { if (me.visibility === 'hidden') me.frozen.push(fn); else fn(); }, 16);
      },
      engine: opts.engine,
      navigation: opts.navigationApi ? { get currentEntry() { return { index: me.navIndex() }; } } : null,
      navigationType: () => me.navType,
    };
  }

  get current(): FakeEntry { return this.entries[this.index]!; }
  get state(): unknown { return this.current.state; }
  /** Listeners on the window, for dispose checks. */
  listeners(type: string): number { return this.win.count(type); }

  /** The previous site, unless the tab starts on ours. */
  private before(): FakeEntry[] {
    return this.opts.firstInTab ? [] : [{ state: null, doc: -1, shot: 'elsewhere', skippable: false, flagged: false, foreign: true }];
  }

  /** First load: the previous site at 0, our page at 1. */
  open(mount: Mount, state: unknown = null): void {
    this.mount = mount;
    this.entries = [
      ...this.before(),
      { state: structuredClone(state), doc: ++this.docId, shot: null, skippable: false, flagged: false, foreign: false },
    ];
    this.index = this.entries.length - 1;
    this.boot('navigate');
  }

  /** Our entries as they stand, for building a history before open(). */
  seed(states: unknown[], at: number): void {
    const doc = ++this.docId;
    const before = this.before();
    this.entries = [
      ...before,
      ...states.map((s) => ({ state: structuredClone(s), doc, shot: null, skippable: false, flagged: false, foreign: false })),
    ];
    this.index = at + before.length;
  }

  /** Every entry of ours joins the live document, as a reload that kept them would. */
  shareDoc(): void {
    for (const e of this.entries) if (!e.foreign) e.doc = this.liveDoc;
  }

  /** Boot on the current entry after seed(). */
  load(mount: Mount, navigationType = 'navigate'): void {
    this.mount = mount;
    this.current.doc = ++this.docId;
    this.boot(navigationType);
  }

  reload(): void {
    const old = this.current.doc;
    const doc = ++this.docId;
    if ((this.opts.reloadMode ?? 'cross') === 'same') {
      for (const e of this.entries) if (e.doc === old) e.doc = doc;
    } else this.current.doc = doc;
    this.teardown();
    this.boot('reload');
  }

  private boot(navigationType: string): void {
    this.navType = navigationType;
    this.liveDoc = this.current.doc;
    this.activationSinceTraversal = false;
    this.chromiumQueue = [];
    this.webkitSlot = null;
    this.timers = [];
    this.rafQueue = [];
    this.frameTimer = null;
    this.left = null;
    this.loads++;
    this.log.push(`load ${navigationType}`);
    this.unmount = this.mount!(this.env, navigationType);
    this.commit();
  }

  private teardown(): void {
    this.unmount?.();
    this.unmount = null;
    this.timers = [];
    this.frozen = [];
    this.rafQueue = [];
    this.frameTimer = null;
  }

  // ---- history ---------------------------------------------------------

  private pushState(data: unknown): void {
    if (this.throwOnPush > 0) {
      this.throwOnPush--;
      const err = new Error('Attempt to use history.pushState() more than 100 times per 30 seconds');
      err.name = 'SecurityError';
      throw err;
    }
    this.beforePush?.(data);
    this.pushes++;
    if (this.inPop) this.pushesInsidePop++;
    if (!this.activationSinceTraversal) {
      this.pushesWithoutActivation++;
      if (this.engine === 'chromium') for (const e of this.entries) if (e.doc === this.current.doc) e.skippable = true;
    }
    const flagged = this.engine === 'webkit' && this.clock - this.lastTap > 10_000;
    if (flagged) this.flaggedPushes++;
    this.current.shot = this.painted;
    this.entries.splice(this.index + 1);
    this.entries.push({ state: structuredClone(data), doc: this.current.doc, shot: null, skippable: false, flagged, foreign: false });
    this.index++;
    while (this.entries.length > this.cap) { this.entries.shift(); this.index--; }
    this.log.push(`push ${idx(data)}`);
  }

  private go(n: number): void {
    this.goCalls++;
    this.log.push(`go ${n}`);
    if (this.chromiumQueue.length || this.webkitSlot !== null) this.goWhilePending++;
    if (this.engine === 'chromium') this.chromiumQueue.push(this.index + n);
    else if (this.webkitSlot !== null && this.opts.webkitGo === 'adjust') this.webkitSlot += n;
    else this.webkitSlot = n;
  }

  /** Script traversals resolve here, after the task that asked for them. */
  flush(): void {
    for (;;) {
      let target: number | null = null;
      if (this.engine === 'chromium') target = this.chromiumQueue.shift() ?? null;
      else if (this.webkitSlot !== null) { target = this.index + this.webkitSlot; this.webkitSlot = null; }
      if (target === null) return;
      if (this.dropGos > 0) { this.dropGos--; this.log.push('dropped'); continue; }
      if (target === this.index || target < 0 || target >= this.entries.length) continue;
      this.traverseTo(target, 'script', false);
    }
  }

  private navIndex(): number {
    let lo = this.index;
    while (lo > 0 && !this.entries[lo - 1]!.foreign) lo--;
    return this.index - lo;
  }

  private traverseTo(target: number, by: 'user' | 'script', uaAnimated: boolean): void {
    const from = this.current;
    const to = this.entries[target]!;
    if (!from.foreign && from.doc === this.liveDoc) from.shot = this.painted;
    this.index = target;
    this.activationSinceTraversal = false;
    if (to.foreign) {
      // Our page goes into the back/forward cache, still mounted; what it
      // had asked of history is dropped with it.
      this.chromiumQueue = [];
      this.webkitSlot = null;
      this.left = by;
      this.log.push(`left by ${by}`);
      return;
    }
    if (from.foreign && to.doc === this.liveDoc && this.left) {
      this.left = null;
      this.log.push('pageshow persisted');
      this.win.dispatch('pageshow', { persisted: true });
      this.commit();
      return;
    }
    if (to.doc !== this.liveDoc) {
      this.teardown();
      to.doc = ++this.docId;
      this.boot('back_forward');
      return;
    }
    this.log.push(`pop ${idx(to.state)}`);
    this.inPop = true;
    this.win.dispatch('popstate', { state: to.state, hasUAVisualTransition: uaAnimated });
    this.commit(); // React's commit for the pop runs before anything else can
    this.inPop = false;
  }

  // ---- the user ----------------------------------------------------------

  /** A tap: the activation, then the tap's own handler, then its commit. */
  tap(action?: () => void): void {
    this.lastTap = this.clock;
    this.activationSinceTraversal = true;
    for (const e of this.entries) e.skippable = false;
    this.win.dispatch('pointerup', { pointerType: 'touch' });
    this.win.dispatch('click');
    action?.();
    this.commit();
  }

  /** Something the app does on its own (a timer, a sim finishing), then its commit. */
  act(action: () => void): void {
    action();
    this.commit();
  }

  swipeBack(): void {
    let t = this.index - 1;
    if (this.engine === 'chromium') while (t >= 0 && this.entries[t]!.skippable) t--;
    else {
      let j = this.index;
      while (j > 0 && this.entries[j]!.flagged) j--;
      t = j - 1;
    }
    this.userGo(t, true);
  }
  swipeForward(): void { this.userGo(this.index + 1, true); }
  longPressBack(n: number): void { this.userGo(this.index - n, false); }

  private userGo(t: number, uaAnimated: boolean): void {
    if (t < 0 || t >= this.entries.length) return;
    // A navigation the user starts cancels WebKit's scheduled one; Chromium keeps its queue.
    if (this.engine === 'webkit') this.webkitSlot = null;
    this.preview = this.entries[t]!.shot;
    this.traverseTo(t, 'user', uaAnimated);
  }

  hide(): void { this.visibility = 'hidden'; this.doc.dispatch('visibilitychange'); this.commit(); }
  show(): void {
    this.visibility = 'visible';
    this.doc.dispatch('visibilitychange');
    for (const fn of this.frozen.splice(0)) this.setTimer(fn, 16);
    this.commit(); // with a painter, the next frame runs what waited
  }
  paint(sig: string): void { this.painted = sig; }

  private commit(): void {
    this.afterTask?.();
    if (this.painter) this.scheduleFrame(); // something may have changed: the next frame paints it
  }

  // ---- frames (with a painter) ---------------------------------------------

  private scheduleFrame(): void {
    if (this.frameTimer !== null) return;
    const id = this.nextTimer++;
    this.frameTimer = id;
    this.timers.push({ id, at: (Math.floor(this.clock / 16) + 1) * 16, fn: () => this.frameTick(), frame: true });
  }

  /** One frame: its rAF callbacks, then the paint. A hidden page skips both. */
  private frameTick(): void {
    this.frameTimer = null;
    if (this.visibility === 'hidden' || !this.painter) return;
    for (const fn of this.rafQueue.splice(0)) fn();
    this.afterTask?.(); // what the callbacks committed
    this.painted = this.painter();
    if (this.rafQueue.length) this.scheduleFrame();
  }

  // ---- time ----------------------------------------------------------------

  private setTimer(fn: () => void, ms: number): number {
    const id = this.nextTimer++;
    this.timers.push({ id, at: this.clock + Math.max(0, ms), fn });
    return id;
  }

  /** Move the clock, running script traversals and timers in order. */
  advance(ms: number): void {
    const end = this.clock + ms;
    this.flush();
    for (;;) {
      if (this.left) break; // a page in the back/forward cache is frozen
      let next: Timer | null = null;
      for (const t of this.timers) if (t.at <= end && (!next || t.at < next.at || (t.at === next.at && t.id < next.id))) next = t;
      if (!next) break;
      this.timers = this.timers.filter((t) => t !== next);
      this.clock = Math.max(this.clock, next.at);
      next.fn();
      if (!next.frame) this.commit();
      this.flush();
    }
    this.clock = end;
  }

  /** Run everything due now: traversals, zero-delay timers. */
  settle(): void { this.advance(0); }

  /** True while a script traversal waits in the browser. */
  get goPending(): boolean { return this.chromiumQueue.length > 0 || this.webkitSlot !== null; }
}

function idx(data: unknown): string {
  const i = (data as { i?: unknown } | null)?.i;
  return typeof i === 'number' ? String(i) : JSON.stringify(data);
}
