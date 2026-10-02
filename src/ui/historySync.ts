// historySync.ts
// The ledger: from the switch on, the only code that writes browser history.
//
// Every entry says where it sits, `{pb:2, boot, i, era}`, and after each
// commit the ledger moves the browser until `history.state.i` equals
// `eraBase + nav.depth()`. It never pushes from a popstate, never pushes
// without a tap since the last traversal (nor, on WebKit, 9 s after one), and
// keeps at most one traversal in flight. A back swipe is measured by the `i`
// it landed on, so a forward swipe or a jump of three reads as what it is
// (back-plan.md §4 X, 2026-09-30). An entry is pushed only once the frame on
// screen shows the level under it, holding what arrived too soon (V1). A top
// level replaced in place over a stale picture is reshot: held, go(-1),
// go(+1), shown (V2).
//
// Everything browser-shaped comes in through `deps`, so node tests drive it
// with tests/support/fakeBrowser.ts. No React, no store: `nav` is injected.

export type Engine = 'webkit' | 'chromium';
export type PeelOutcome = 'peeled' | 'refused' | 'none';

/**
 * What every entry this code writes holds. A root written after a relabel
 * also carries `below`, the older numberings' shifts ('*' for the rest), so
 * the next load of the page still reads them.
 */
export interface PbEntry { pb: 2; boot: string; i: number; era: number; below?: Record<string, number> }

export interface HistoryPort {
  readonly state: unknown;
  pushState(data: unknown, unused: string): void;
  replaceState(data: unknown, unused: string): void;
  go(delta: number): void;
  back(): void;
}

type Handler = (e: Event) => void;
export interface EventPort {
  addEventListener(type: string, fn: Handler, opts?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, fn: Handler, opts?: boolean | EventListenerOptions): void;
}

/** The levels, as nav.ts will give them (package N). */
export interface SyncNav {
  depth(): number;
  eraKey(): string;
  peelNewest(): PeelOutcome;
  idle(): boolean;
  newest?(): { kind: string } | null;
  levels?(): readonly unknown[];
  /** What the page shows with only the bottom `d` levels up (V1). */
  levelSig?(d: number): string;
  /** The levels' ids, bottom first (V1). */
  levelIds?(): readonly string[];
}

export interface SyncDeps {
  history: HistoryPort;
  /** popstate, pageshow and the activation events. */
  win: EventPort;
  doc: EventPort & { readonly visibilityState: string };
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  /** Samples what each frame paints, for V1's one push per painted frame. */
  requestAnimationFrame(fn: () => void): unknown;
  /**
   * Hides every level from `from` (1-based, this era's) up and shows the rest;
   * null shows them all. False, hiding nothing, when the level at `from`
   * cannot be hidden. Absent (the node tests of X), no level is ever held.
   */
  hold?(from: number | null): boolean;
  engine: Engine;
  nav: SyncNav;
  /** The Navigation API where it exists, for clamping and leaving in one hop. */
  navigation?: { readonly currentEntry: { readonly index: number } | null } | null;
  /** `performance.getEntriesByType('navigation')[0]?.type`. */
  navigationType?(): string | undefined;
  /** Tests name their page loads; the browser uses this module's BOOT. */
  boot?: string;
  /** Expose `win.__nav` for the probe. */
  dev?: boolean;
}

export interface UserPop {
  /** `hasUAVisualTransition`: false means nothing moved on screen, so App fades. */
  uaAnimated: boolean | undefined;
  /** The kinds peeled, newest first. */
  kinds: string[];
  peeled: number;
}

export interface SyncHooks {
  pushMark(i: number): void;
  markReturn(i: number): void;
  onUserPop(pop: UserPop): void;
}

type PendingKind = 'give' | 'refund' | 'collapse' | 'rewind' | 'bounce' | 'ghost' | 'leave' | 'reshoot';
export interface Pending { target: number; kind: PendingKind }

export interface LedgerView {
  cur: PbEntry;
  pending: Pending | null;
  eraBase: number;
  eraId: number;
  owed: boolean;
  want: number;
  depth: number;
  forwardTop: number;
  leaving: boolean;
  /** The level a hold starts at while its frame paints, or null. */
  held: number | null;
  /** V2: stepping down to retake the entry below ('down', 'below') and back up ('up'). */
  reshoot: Reshoot;
}
type Reshoot = 'down' | 'below' | 'up' | null;

export interface HistorySync {
  /** App's layout effect, after every commit that changed the levels or the era. */
  afterCommit(): void;
  /** Any commit that may change the picture (a day played): sample the next frames. */
  painting(): void;
  dispose(): void;
  inspect(): LedgerView;
}

const WATCHDOG_MS = 800;
const QUIET_MS = 300;
const WEBKIT_WINDOW_MS = 9000;
/**
 * The tap that changed the era counts as the era's own when the change lands
 * within this long of it: Accept, Load, Save and leave, Take the job. A change
 * a long sim brings seconds later still waits for a tap there (correction 14).
 */
const ERA_TAP_MS = 1000;
/** With only that carried tap, the fold waits this long after the change, for a card the change brings late. */
const ERA_SETTLE_MS = 1000;
/** A held level shows and its entry is pushed anyway when frames stop (a hidden page). */
const HOLD_MS = 100;

/** A painted frame: what it read as, and the levels it had up. */
interface Frame { sig: string; ids: readonly string[] }

/** Not crypto.randomUUID: that is missing over plain http on the LAN. */
export function makeBoot(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
const BOOT = makeBoot();

/** iOS Chrome says CriOS, not Chrome, and is WebKit underneath. */
export function engineOf(ua: string): Engine {
  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR|SamsungBrowser/.test(ua) ? 'webkit' : 'chromium';
}

export function isPbEntry(st: unknown): st is PbEntry {
  if (!st || typeof st !== 'object') return false;
  const e = st as Partial<PbEntry>;
  return e.pb === 2 && typeof e.boot === 'string' && typeof e.i === 'number' && Number.isInteger(e.i) && e.i >= 0;
}

function isLegacy(st: unknown): boolean {
  if (!st || typeof st !== 'object') return false;
  const e = st as { playball?: unknown; playballRoot?: unknown };
  return e.playball === true || e.playballRoot === true;
}

/** Trusted input that counts as a user activation on every engine we meet. */
function activates(e: Event): boolean {
  if (!e.isTrusted) return false;
  switch (e.type) {
    case 'keydown': return (e as KeyboardEvent).key !== 'Escape';
    case 'mousedown': case 'touchend': case 'click': return true;
    case 'pointerdown': return (e as PointerEvent).pointerType === 'mouse';
    case 'pointerup': return (e as PointerEvent).pointerType !== 'mouse';
    default: return false;
  }
}
const ACTIVATION_EVENTS = ['keydown', 'mousedown', 'pointerdown', 'pointerup', 'touchend', 'click'];

/** What a disposed ledger hands the next install of the same page load (StrictMode). */
interface Carried {
  boot: string; id: string; relabels: number; shift: Map<string, number>; baseShift: number; cur: PbEntry; pending: Pending | null; eraId: number; eraKey0: string; eraBase: number;
  forwardTop: number; known: Set<number>; owed: boolean; leaving: boolean; rooted: boolean;
  lastActivation: number; activatedSinceTraversal: boolean; activatedInEra: boolean; eraAt: number; carriedTap: boolean;
  painted: Frame | null; shotOf: Map<number, string>; topOf: Map<number, string>;
}
const carried = new WeakMap<object, Carried>();

export function installHistorySync(deps: SyncDeps, hooks: SyncHooks): HistorySync {
  const { history, nav } = deps;
  const boot = deps.boot ?? BOOT;

  let eraId = 0;
  /**
   * Whose numbering `i` is in. A relabel (a failed rewind or collapse) starts
   * a new one, and `shift` maps older numberings onto it, so an entry from
   * before still reads as above or below our root.
   */
  let id = boot;
  let relabels = 0;
  let shift = new Map<string, number>();
  let baseShift = 0;
  const ours = (st: PbEntry): boolean => st.boot === id;
  const placeOf = (st: PbEntry): number => (ours(st) ? st.i : st.i + (shift.get(st.boot) ?? baseShift));
  const entry = (i: number): PbEntry => {
    const e: PbEntry = { pb: 2, boot: id, i, era: eraId };
    if (i === 0 && (shift.size > 0 || baseShift !== 0)) e.below = { ...Object.fromEntries(shift), '*': baseShift };
    return e;
  };
  /** Rooting on an entry an earlier load wrote: take over what it knew of the entries below. */
  function adoptBelow(st: unknown): void {
    const below = isPbEntry(st) ? st.below : undefined;
    if (!below || typeof below !== 'object') return;
    for (const [b, s] of Object.entries(below)) {
      if (typeof s !== 'number') continue;
      if (b === '*') baseShift = s; else shift.set(b, s);
    }
    if (isPbEntry(st)) shift.set(st.boot, 0); // its own numbering is ours
  }
  /** The entry on screen; `cur.i` is always in our numbering. */
  let cur: PbEntry = entry(0);
  let pending: Pending | null = null;
  let eraKey0 = nav.eraKey();
  let eraBase = 0;
  let forwardTop = 0;
  let known = new Set<number>([0]);
  let owed = false;
  let leaving = false;
  let rooted = false;
  let disposed = false;
  let lastActivation = -Infinity;
  let activatedSinceTraversal = false;
  let activatedInEra = false;
  /** When the era last changed, and whether its only tap is the one that changed it. */
  let eraAt = -Infinity;
  let carriedTap = false;
  let failures = 0;
  let waitingVisible = false;
  let watchdog: unknown = null;
  let quiet: unknown = null;
  let deferred: unknown = null;
  /*
    Pictures (back plan V1, 2026-09-30). A swipe previews the frame that was
    on screen when its entry was left, which is when the next one is pushed.
    `drawn` is sampled in a frame's rAF and becomes `painted` at the next one,
    by which time that frame is on screen. Before pushing the entry for level
    j, the frame must read as level j-1; if not, level j and those above it
    are held (hidden, not removed) until it does, then pushed and shown.
  */
  const pictures = deps.hold !== undefined && nav.levelSig !== undefined && nav.levelIds !== undefined;
  let painted: Frame | null = null;
  let drawn: Frame | null = null;
  let framing = false;
  let heldFrom: number | null = null;
  let holdTimer: unknown = null;
  let inFrame = false;
  /*
    Reshoot (V2). A top level can be replaced in place -- the terms card by
    the Season plan, the game by the injury card -- with no push, so the entry
    under it keeps whatever it was last left on (the card, after a refused
    swipe; yesterday's Today). `shotOf[k]` is what entry k was left on, as far
    as this page knows, and `topOf[k]` the level entry k stood for.
  */
  let shotOf = new Map<number, string>();
  let topOf = new Map<number, string>();
  let reshoot: Reshoot = null;

  const want = (): number => eraBase + nav.depth();
  const hidden = (): boolean => deps.doc.visibilityState === 'hidden';

  // Every history call can throw (WebKit's SecurityError after ~100 in 30 s).
  const tryPush = (e: PbEntry): boolean => { try { history.pushState(e, ''); return true; } catch { return false; } };
  const tryReplace = (e: PbEntry): boolean => { try { history.replaceState(e, ''); return true; } catch { return false; } };
  const tryGo = (n: number): boolean => { try { history.go(n); return true; } catch { return false; } };

  const clearWatchdog = (): void => {
    if (watchdog !== null) deps.clearTimeout(watchdog);
    watchdog = null;
    waitingVisible = false;
  };
  const armWatchdog = (): void => { clearWatchdog(); watchdog = deps.setTimeout(onWatchdog, WATCHDOG_MS); };
  const cancelQuiet = (): void => { if (quiet !== null) deps.clearTimeout(quiet); quiet = null; };
  const armQuiet = (): void => { cancelQuiet(); if (cur.i > 0) quiet = deps.setTimeout(onQuiet, QUIET_MS); };

  /** The entry on screen becomes entry `i`; what we knew about the rest is gone. */
  function relabel(i: number): void {
    const d = cur.i - i;
    if (d !== 0) {
      for (const [b, s] of shift) shift.set(b, s - d);
      shift.set(id, -d);
      baseShift -= d;
      id = `${boot}.${++relabels}`;
    }
    const e = entry(i);
    tryReplace(e);
    cur = e;
    known = new Set([i]);
    shotOf = new Map();
    topOf = new Map();
    forwardTop = i;
    failures = 0;
    rooted = true;
  }
  function makeRoot(): void { eraBase = 0; relabel(0); }

  function canPush(): boolean {
    return activatedSinceTraversal && (deps.engine !== 'webkit' || deps.now() - lastActivation < WEBKIT_WINDOW_MS);
  }

  /** A new era rebases where history already stands; no traversal. */
  function syncEra(): void {
    const k = nav.eraKey();
    if (k === eraKey0) return;
    eraKey0 = k;
    eraId++;
    eraBase = cur.i;
    // The tap that brought the era (nothing traversed since) is the era's own,
    // so a fresh Home folds without waiting for a second tap (§6.1).
    eraAt = deps.now();
    carriedTap = activatedSinceTraversal && eraAt - lastActivation < ERA_TAP_MS;
    activatedInEra = carriedTap;
  }

  /** What the page shows now, held levels left out. */
  function sample(): Frame {
    const d = heldFrom !== null ? heldFrom - 1 : nav.depth();
    return { sig: nav.levelSig!(d), ids: nav.levelIds!().slice(0, d) };
  }

  /** Watch the next frames until what they paint stops changing. */
  function frame(): void {
    if (!pictures || framing || disposed) return;
    framing = true;
    deps.requestAnimationFrame(onFrame);
  }

  function onFrame(): void {
    framing = false;
    if (disposed) return;
    if (drawn !== null) painted = drawn; // the last frame's picture is on screen now
    // Held: push if the frame reads right, else hold again (a remounted level).
    if (heldFrom !== null) {
      inFrame = true;
      try { reconcile(); } finally { inFrame = false; }
    }
    drawn = sample();
    if (painted === null || drawn.sig !== painted.sig || heldFrom !== null) frame();
  }

  function unhold(): void {
    if (holdTimer !== null) deps.clearTimeout(holdTimer);
    holdTimer = null;
    reshoot = null; // every way out of a reshoot shows its level again
    if (heldFrom === null) return;
    heldFrom = null;
    deps.hold!(null);
    frame();
  }

  /**
   * Hidden, shown again or back from the page cache: nothing is known painted
   * until a frame runs, and a hold gets its full wait from now.
   */
  function unseen(): void {
    painted = drawn = null;
    if (heldFrom !== null) {
      if (holdTimer !== null) deps.clearTimeout(holdTimer);
      holdTimer = deps.setTimeout(onHoldTimeout, HOLD_MS);
    }
    frame();
  }

  /** Frames stopped (a hidden page): take the held frame as painted and go on. */
  function onHoldTimeout(): void {
    holdTimer = null;
    if (disposed || heldFrom === null) return;
    painted = drawn = sample();
    reconcile();
  }

  /**
   * Whether entry `k` can be pushed now. It can when the frame on screen reads
   * as the level under it, when that level was painted already (an owed push
   * a tap pays: hiding it would blink under the finger), or when it moves as
   * the screen and cannot be held. Otherwise it and all above it are held.
   */
  function framedFor(k: number): boolean {
    if (!pictures) return true;
    const d = k - eraBase;
    if (d <= 0) return true; // filler at or under the era's base: none of its levels
    // The frame last seen painted, and the one sampled since (it may be up by now).
    const under = nav.levelSig!(d - 1);
    if (painted !== null && painted.sig === under && (drawn === null || drawn.sig === under)) return true;
    const id = nav.levelIds!()[d - 1];
    if (id !== undefined && (drawn ?? painted)?.ids.includes(id)) return true;
    if (!deps.hold!(d)) { // it hid nothing
      if (holdTimer !== null) deps.clearTimeout(holdTimer);
      holdTimer = null;
      heldFrom = null;
      frame();
      return true;
    }
    if (heldFrom !== d) {
      heldFrom = d;
      if (holdTimer !== null) deps.clearTimeout(holdTimer);
      holdTimer = deps.setTimeout(onHoldTimeout, HOLD_MS);
    }
    frame();
    return false;
  }

  /**
   * What is on screen now. Inside a frame's rAF the frame before it is; at any
   * other time the last one sampled has painted since.
   */
  const onScreen = (): string | undefined => (inFrame ? painted : drawn ?? painted)?.sig;
  /** Entry `k` is being left: file what it will preview. */
  function leftOn(k: number): void {
    const sig = pictures ? onScreen() : undefined;
    if (sig !== undefined) shotOf.set(k, sig); else shotOf.delete(k);
  }

  /**
   * Aligned, with the top level replaced since its entry was pushed: when the
   * entry below was left on another picture than the one under the new level,
   * hold that level and step down and up again so the browser retakes it.
   * No push, so no tap is needed (back plan V2).
   */
  function startReshoot(): boolean {
    const d = cur.i - eraBase;
    if (!pictures || d < 1) return false;
    const top = nav.levelIds!()[d - 1];
    const was = topOf.get(cur.i);
    if (top !== undefined) topOf.set(cur.i, top);
    if (was === undefined || top === undefined || was === top) return false;
    const shot = shotOf.get(cur.i - 1);
    if (shot === undefined || shot === nav.levelSig!(d - 1)) return false;
    // Only onto an entry of ours we know is there, on a page that paints.
    if (!known.has(cur.i - 1) || hidden()) return false;
    const idx = deps.navigation?.currentEntry?.index;
    if (typeof idx === 'number' && idx < 1) return false;
    if (!deps.hold!(d)) return false; // it moves as the screen: nothing to show under it
    heldFrom = d;
    if (holdTimer !== null) deps.clearTimeout(holdTimer);
    holdTimer = null;
    reshoot = 'down';
    leftOn(cur.i);
    pending = { target: cur.i - 1, kind: 'reshoot' };
    if (!tryGo(-1)) { pending = null; unhold(); return false; }
    armWatchdog();
    frame();
    return true;
  }

  /** Below, the level held: once the frame under it has painted, back up. */
  function reshootUp(w: number): boolean {
    if (w !== cur.i + 1 || heldFrom !== w - eraBase) { reshoot = null; return false; } // the levels moved meanwhile
    const under = nav.levelSig!(w - eraBase - 1);
    if (painted === null || painted.sig !== under || (drawn !== null && drawn.sig !== under)) { frame(); return true; }
    reshoot = 'up';
    shotOf.set(cur.i, under);
    pending = { target: cur.i + 1, kind: 'reshoot' };
    if (!tryGo(1)) { pending = null; reshoot = null; return false; }
    armWatchdog();
    return true;
  }

  function refundable(w: number): boolean {
    if (w > forwardTop) return false;
    for (let k = cur.i + 1; k <= w; k++) if (!known.has(k)) return false;
    return true;
  }

  /** Pushes up to `w`: all of it, 'held' waiting on a frame, or 'failed' on a throw. */
  function pushTo(w: number): 'done' | 'held' | 'failed' {
    let ok: 'done' | 'held' | 'failed' = 'done';
    for (let k = cur.i + 1; k <= w; k++) {
      if (!framedFor(k)) { ok = 'held'; break; }
      const e = entry(k);
      const shot = pictures ? onScreen() : undefined;
      if (!tryPush(e)) { ok = 'failed'; break; }
      hooks.pushMark(k);
      if (shot !== undefined) shotOf.set(k - 1, shot); else shotOf.delete(k - 1);
      const top = pictures && k > eraBase ? nav.levelIds!()[k - eraBase - 1] : undefined;
      if (top !== undefined) topOf.set(k, top); else topOf.delete(k);
      cur = e;
      forwardTop = k;
      known.add(k);
      failures = 0;
    }
    for (const k of known) if (k > cur.i) known.delete(k);
    for (const m of [shotOf, topOf]) for (const k of m.keys()) if (k > cur.i) m.delete(k);
    return ok;
  }

  function traverse(n: number, kind: PendingKind): void {
    unhold(); // nothing waits hidden through a traversal
    const asked = n;
    if (n < 0) {
      n = Math.max(n, -cur.i);
      const idx = deps.navigation?.currentEntry?.index;
      if (typeof idx === 'number') n = Math.max(n, -idx);
    }
    const down = kind === 'rewind' || kind === 'collapse';
    if (n === 0) {
      // Nothing of ours below: the browser pruned it, and this page is the root
      // now. (Asked for nothing: the entry already sits where we want it.)
      if (asked < 0) makeRoot(); else relabel(cur.i);
      if (!down) reconcile();
      return;
    }
    pending = { target: cur.i + n, kind };
    leftOn(cur.i);
    if (!tryGo(n)) {
      pending = null;
      if (down) makeRoot();
      return;
    }
    armWatchdog();
  }

  function reconcile(): void {
    if (disposed || leaving || pending || !rooted) return;
    syncEra();
    const w = want();
    if (reshoot === 'below' && reshootUp(w)) return;
    if (cur.i > w) { owed = false; cancelQuiet(); traverse(w - cur.i, 'give'); return; }
    if (cur.i < w) {
      cancelQuiet();
      if (canPush()) {
        const done = pushTo(w);
        owed = done === 'failed';
        if (done !== 'held') unhold();
        return;
      }
      unhold();
      if (refundable(w)) { owed = false; traverse(w - cur.i, 'refund'); return; }
      owed = true;
      return;
    }
    owed = false;
    if (startReshoot()) return;
    unhold();
    armQuiet();
  }

  /** One of our traversals arrived (or, read by the watchdog, was already there). */
  function land(st: PbEntry, popped: boolean): void {
    const p = pending;
    pending = null;
    clearWatchdog();
    failures = 0;
    if (popped) activatedSinceTraversal = false;
    leaving = false;
    cur = ours(st) ? st : { ...st, i: placeOf(st) };
    if (p?.kind === 'rewind') { if (cur.i === 0) adoptBelow(st); makeRoot(); }
    else {
      known.add(cur.i);
      if (p?.kind === 'collapse') { if (cur.i === 0) eraBase = 0; else makeRoot(); }
    }
    if (p?.kind === 'reshoot') {
      if (reshoot === 'down') {
        // Below, with the level still held: frames stopping must not strand it.
        reshoot = 'below';
        if (holdTimer !== null) deps.clearTimeout(holdTimer);
        holdTimer = deps.setTimeout(onHoldTimeout, HOLD_MS);
      } else if (reshoot === 'up') reshoot = null; // retaken: reconcile shows it
    }
    reconcile();
  }

  /** An entry from an earlier load of the page, or from before a relabel. */
  function arriveForeign(st: PbEntry, from: PbEntry | null): void {
    activatedSinceTraversal = false;
    const at = placeOf(st);
    cur = { ...st, i: at };
    if (pending) { armWatchdog(); return; } // ours has yet to run; never two at once
    // Below our root: backwards, the user is leaving; from another site, climb to the root.
    if (rooted && at < 0) { if (from) leave(); else traverse(-at, 'bounce'); return; }
    if (!rooted) { if (at === 0) { adoptBelow(st); makeRoot(); reconcile(); } else traverse(-at, 'rewind'); }
    else traverse((from?.i ?? 0) - at, 'bounce');
  }

  /** Legacy or foreign entries below our root: keep going, in one hop where the API allows. */
  function leave(): void {
    leaving = true;
    cancelQuiet();
    unhold();
    const idx = deps.navigation?.currentEntry?.index;
    // A call that throws is a hop that never ran: the watchdog retries it or takes over.
    if (typeof idx === 'number') tryGo(-(idx + 1));
    else { try { history.back(); } catch { /* as above */ } }
    pending = { target: -1, kind: 'leave' };
    armWatchdog();
  }

  /**
   * Nothing before us to leave to (a new tab, iOS, a standalone PWA): the
   * entry on screen becomes the root, so the ledger never parks in `leaving`.
   */
  function takeOver(): void {
    leaving = false;
    makeRoot();
    reconcile();
  }

  /** Below our root (legacy, or an older load's entry): true when the page should keep leaving. */
  const belowRoot = (st: unknown): boolean => !isPbEntry(st) || (rooted && !ours(st) && placeOf(st) < 0);
  /** Standing on such an entry: an older one reads through the map, a legacy one at least a step below. */
  const standBelow = (st: unknown): void => {
    cur = isPbEntry(st) ? { ...st, i: placeOf(st) } : { ...cur, i: Math.min(cur.i, 0) - 1 };
  };

  function onPop(ev: Event): void {
    if (disposed) return;
    const e = ev as PopStateEvent & { hasUAVisualTransition?: boolean };
    const st: unknown = e.state;
    cancelQuiet();
    const from = cur;
    if (pending?.kind === 'leave') {
      if (belowRoot(st)) {
        // Our one hop landed (history.back() without the Navigation API): the next.
        // A swipe of the user's meanwhile leaves ours to run.
        standBelow(st);
        activatedSinceTraversal = false;
        if (e.hasUAVisualTransition === true) armWatchdog(); else leave();
        return;
      }
      pending = null; // forward into our own entries: stay
      clearWatchdog();
      leaving = false;
    }
    if (!isPbEntry(st)) {
      standBelow(st);
      activatedSinceTraversal = false;
      if (pending) armWatchdog(); else leave();
      return;
    }
    // Ours never animate: a swipe that happens to land on our target is the user's.
    if (pending && placeOf(st) === pending.target && (ours(st) || pending.kind === 'rewind') && e.hasUAVisualTransition !== true) {
      land(st, true);
      return;
    }
    if (!ours(st)) { arriveForeign(st, from); return; }
    // The user's own pop. A traversal of ours still in flight may yet land.
    leaving = false;
    leftOn(from.i);
    if (reshoot !== null) unhold(); // a reshoot cut short: its level shows, then the pop peels as usual
    forwardTop = Math.max(forwardTop, from.i);
    failures = 0;
    if (pending) { pending = { target: pending.target, kind: 'ghost' }; armWatchdog(); }
    activatedSinceTraversal = false;
    cur = st;
    known.add(st.i);
    syncEra();
    const w = want();
    let peeled = 0;
    const kinds: string[] = [];
    // Back by n (a long press can jump several). With a push owed, this peels
    // one more than the entries, so the app lands where the preview showed.
    for (let n = w - st.i; n > 0; n--) {
      const kind = nav.newest?.()?.kind;
      if (nav.peelNewest() !== 'peeled') break;
      peeled++;
      if (kind) kinds.push(kind);
    }
    if (peeled) hooks.markReturn(st.i + 1);
    hooks.onUserPop({ uaAnimated: e.hasUAVisualTransition, kinds, peeled });
    if (st.i < eraBase && nav.depth() === 0 && !pending) {
      // Fell below the era with nothing to peel: collapse now.
      if (st.i === 0) eraBase = 0; else { traverse(-st.i, 'collapse'); return; }
    }
    reconcile(); // refunds or gives back; canPush() is false here, so never a push
  }

  function onWatchdog(): void {
    watchdog = null;
    if (!pending) return;
    if (hidden()) { waitingVisible = true; return; } // never re-issue while hidden
    expire();
  }

  /** A traversal fired no popstate: read where the browser is. */
  function expire(): void {
    const p = pending;
    waitingVisible = false;
    if (!p) return;
    const st: unknown = history.state;
    pending = null;
    if (p.kind === 'leave') {
      if (!belowRoot(st)) { // back inside: stay
        leaving = false;
        if (isPbEntry(st) && ours(st)) { cur = st; known.add(st.i); }
        reconcile();
      }
      else if (failures++ < 1) leave(); // the hop never ran: once more
      else takeOver();
      return;
    }
    if (rooted && belowRoot(st)) { leave(); return; } // the user went below our root meanwhile
    if (isPbEntry(st)) {
      const at = placeOf(st);
      if (at === p.target && (ours(st) || p.kind === 'rewind')) { pending = p; land(st, false); return; }
      cur = ours(st) ? st : { ...st, i: at };
      if (ours(st)) known.add(st.i);
      if (p.kind === 'rewind' && !ours(st) && at > 0 && failures++ < 1) {
        traverse(-at, 'rewind'); // the user moved during the rewind: once more from here
        return;
      }
    }
    if (p.kind === 'collapse' || p.kind === 'rewind') { makeRoot(); reconcile(); return; }
    if (p.kind === 'ghost') { reconcile(); return; }
    if (p.kind === 'reshoot') { unhold(); reconcile(); return; } // a step that never ran: show the level, never retry
    failures++;
    if (failures < 2) reconcile(); // after that, only a new commit, tap or pop tries again
  }

  function onQuiet(): void {
    quiet = null;
    if (disposed || leaving || pending || owed) return;
    syncEra();
    if (nav.depth() !== 0 || cur.i !== eraBase || cur.i === 0) return;
    if (!activatedInEra || hidden()) return; // the next tap, or showing the page, re-arms
    const settle = carriedTap ? eraAt + ERA_SETTLE_MS - deps.now() : 0;
    if (settle > 0) { quiet = deps.setTimeout(onQuiet, settle); return; }
    if (!nav.idle()) { quiet = deps.setTimeout(onQuiet, QUIET_MS); return; }
    traverse(-cur.i, 'collapse');
  }

  function onActivate(e: Event): void {
    if (disposed || !activates(e)) return;
    lastActivation = deps.now();
    activatedSinceTraversal = true;
    activatedInEra = true;
    carriedTap = false;
    cancelQuiet();
    // After the tap's own handlers, so an owed push is paid for what it opened.
    if (deferred === null) deferred = deps.setTimeout(() => { deferred = null; reconcile(); }, 0);
  }

  function onPageShow(ev: Event): void {
    if (disposed || !(ev as PageTransitionEvent).persisted) return;
    leaving = false;
    pending = null;
    clearWatchdog();
    unseen();
    activatedSinceTraversal = false; // coming back was a traversal too
    const st: unknown = history.state;
    if (isPbEntry(st) && ours(st)) { cur = st; known.add(st.i); }
    else if (isPbEntry(st)) { arriveForeign(st, null); return; }
    else makeRoot();
    reconcile();
  }

  function onVisibility(): void {
    if (disposed) return;
    unseen();
    if (hidden()) { cancelQuiet(); return; }
    if (waitingVisible && pending) { expire(); return; }
    if (!pending && !leaving) {
      const st: unknown = history.state;
      if (isPbEntry(st) && ours(st) && st.i !== cur.i) { cur = st; known.add(st.i); }
    }
    reconcile();
  }

  const capture = { capture: true, passive: true };
  for (const t of ACTIVATION_EVENTS) deps.win.addEventListener(t, onActivate, capture);
  deps.win.addEventListener('popstate', onPop);
  deps.win.addEventListener('pageshow', onPageShow);
  deps.doc.addEventListener('visibilitychange', onVisibility);

  const inspect = (): LedgerView => ({
    cur: { ...cur }, pending: pending && { ...pending }, eraBase, eraId, owed, want: want(), depth: nav.depth(), forwardTop, leaving,
    held: heldFrom, reshoot,
  });
  if (deps.dev) {
    (deps.win as unknown as Record<string, unknown>).__nav = {
      get levels() { return nav.levels?.(); },
      get depth() { return nav.depth(); },
      get want() { return want(); },
      get cur() { return { ...cur }; },
      get pending() { return pending && { ...pending }; },
      get eraBase() { return eraBase; },
      get owed() { return owed; },
      get held() { return heldFrom; },
      get reshoot() { return reshoot; },
    };
  }

  // Boot. A second install in the same page load (StrictMode) takes over.
  const st: unknown = history.state;
  const snap = carried.get(history);
  carried.delete(history);
  if (snap && snap.boot === boot && (snap.pending || (isPbEntry(st) && st.boot === snap.id && st.i === snap.cur.i))) {
    ({ id, relabels, shift, baseShift, cur, pending, eraId, eraKey0, eraBase, forwardTop, known, owed, leaving, rooted,
      lastActivation, activatedSinceTraversal, activatedInEra, eraAt, carriedTap, painted, shotOf, topOf } = snap);
    if (pending) armWatchdog();
    else reconcile();
  } else if (isPbEntry(st) && (st.boot === boot || st.boot.startsWith(`${boot}.`))) {
    id = st.boot;
    cur = st;
    rooted = true;
    forwardTop = st.i;
    for (let k = 0; k <= st.i; k++) known.add(k);
    eraBase = Math.max(0, st.i - nav.depth());
    reconcile();
  } else if (isPbEntry(st) && st.i > 0) {
    // Reloaded above our old root: go back down to it. Same-document, a
    // popstate lands; cross-document, the next load boots at i = 0.
    cur = { ...st };
    traverse(-st.i, 'rewind');
  } else if (isLegacy(st) && deps.navigationType?.() === 'back_forward') {
    leave();
  } else {
    adoptBelow(st);
    makeRoot();
    reconcile();
  }
  frame();

  return {
    afterCommit(): void {
      cancelQuiet();
      reconcile();
      frame();
    },
    painting: frame,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearWatchdog();
      cancelQuiet();
      unhold();
      if (deferred !== null) deps.clearTimeout(deferred);
      for (const t of ACTIVATION_EVENTS) deps.win.removeEventListener(t, onActivate, capture);
      deps.win.removeEventListener('popstate', onPop);
      deps.win.removeEventListener('pageshow', onPageShow);
      deps.doc.removeEventListener('visibilitychange', onVisibility);
      if (deps.dev) delete (deps.win as unknown as Record<string, unknown>).__nav;
      carried.set(history, {
        boot, id, relabels, shift, baseShift, cur, pending, eraId, eraKey0, eraBase, forwardTop, known, owed, leaving, rooted,
        lastActivation, activatedSinceTraversal, activatedInEra, eraAt, carriedTap, painted, shotOf, topOf,
      });
    },
    inspect,
  };
}

/** The real browser's deps, for App at the switch. Touches `window` only when called. */
export function browserDeps(nav: SyncNav, dev = false): SyncDeps {
  const navigation = (window as unknown as { navigation?: SyncDeps['navigation'] }).navigation ?? null;
  return {
    history: window.history,
    win: window,
    doc: document,
    now: () => performance.now(),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (h) => window.clearTimeout(h as number),
    requestAnimationFrame: (fn) => window.requestAnimationFrame(() => fn()),
    engine: engineOf(navigator.userAgent),
    nav,
    navigation,
    navigationType: () => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type,
    dev,
  };
}
