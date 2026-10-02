// history-sync.test.ts
// The ledger (src/ui/historySync.ts) against a fake Chromium and a fake
// WebKit (tests/support/fakeBrowser.ts), with a stack of levels standing in
// for nav.ts: the scenarios of back-design §5.2 and back-plan §4 X, then 2,000
// seeded operations per engine (2026-09-30).

import { describe, it, expect } from 'vitest';
import {
  installHistorySync, engineOf, isPbEntry, type HistorySync, type SyncNav, type UserPop, type PeelOutcome,
  type Engine,
} from '../src/ui/historySync.js';
import { FakeBrowser, type FakeEnv, type FakeOptions } from './support/fakeBrowser.js';
import type { Level } from '../src/state/nav.js';

// ---------------------------------------------------------------------------
// A stack of levels, and a page that wires it to the ledger
// ---------------------------------------------------------------------------

interface Lv { id: string; kind: string }

class FakeNav implements SyncNav {
  era = 'season|1|a|2026';
  stack: Lv[] = [];
  guard = false;
  busy = false;
  dirty = false;
  private n = 0;
  depth(): number { return this.stack.length + (this.guard ? 1 : 0); }
  eraKey(): string { return this.era; }
  idle(): boolean { return !this.busy; }
  newest(): { kind: string } | null { return this.guard ? { kind: 'guard' } : this.stack.at(-1) ?? null; }
  levels(): string[] { return [...this.stack.map((l) => l.id), ...(this.guard ? ['guard:card'] : [])]; }
  peelNewest(): PeelOutcome {
    if (this.guard) return 'refused';
    if (!this.stack.length) return 'none';
    this.stack.pop();
    this.dirty = true;
    return 'peeled';
  }
  open(kind = 'card'): Lv { const l = { id: `${kind}:${++this.n}`, kind }; this.stack.push(l); this.dirty = true; return l; }
  close(): void { this.stack.pop(); this.dirty = true; }
  remove(l: Lv): void { this.stack = this.stack.filter((x) => x !== l); this.dirty = true; }
  setGuard(on: boolean): void { this.guard = on; this.dirty = true; }
  newEra(key: string): void { this.era = key; this.stack = []; this.guard = false; this.dirty = true; }
  // V1's pictures: what the page shows with the bottom `d` levels up, and a
  // hold that hides every level from `from` up (a route moves as the screen).
  day = 0;
  held: number | null = null;
  holds = 0;
  levelSig(d: number): string { return `${this.era}|${this.levels().slice(0, d).join(',')}|d${this.day}`; }
  levelIds(): string[] { return this.levels(); }
  kindAt(d: number): string | undefined { return d > this.stack.length ? (this.guard ? 'guard' : undefined) : this.stack[d - 1]?.kind; }
  hold(from: number | null): boolean {
    if (from === null) { this.held = null; return true; }
    const kind = this.kindAt(from);
    if (kind === undefined || kind === 'route' || kind === 'game') { this.held = null; return false; }
    if (this.held !== from) this.holds++;
    this.held = from;
    return true;
  }
  sig(): string { return this.levelSig(this.depth()); }
  /** What a frame paints now: the held levels are hidden. */
  visible(): string { return this.levelSig(this.held !== null ? this.held - 1 : this.depth()); }
}

interface Page {
  b: FakeBrowser;
  nav: FakeNav;
  pops: UserPop[];
  marks: string[];
  ledger(): HistorySync;
  i(): number;
  settle(): void;
}

/** `seed`: the tab already holds these entries, and the page loads on `at` (a reload, say). */
interface Seed { states: unknown[]; at: number; type: string }

/** `pictures`: the page holds a level until the frame under it has painted (V1). */
function page(opts: FakeOptions & { strict?: boolean; seed?: Seed; pictures?: boolean }): Page {
  const b = new FakeBrowser(opts);
  const nav = new FakeNav();
  const pops: UserPop[] = [];
  const marks: string[] = [];
  let ledger: HistorySync | null = null;
  let boots = 0;
  const mount = (env: FakeEnv, type: string): (() => void) => {
    if (type !== 'navigate') { nav.newEra(`front|load${boots}`); nav.dirty = false; }
    const deps = { ...env, nav, boot: `boot${++boots}`, ...(opts.pictures ? { hold: (f: number | null) => nav.hold(f) } : {}) };
    const hooks = {
      pushMark: (i: number) => { marks.push(`push ${i}`); },
      markReturn: (i: number) => { marks.push(`return ${i}`); },
      onUserPop: (p: UserPop) => { pops.push(p); },
    };
    if (opts.strict) installHistorySync(deps, hooks).dispose(); // StrictMode: mount, unmount, mount
    const mine = installHistorySync(deps, hooks);
    ledger = mine;
    return () => { mine.dispose(); if (ledger === mine) ledger = null; };
  };
  b.afterTask = () => {
    if (nav.dirty) { nav.dirty = false; ledger?.afterCommit(); }
    if (!opts.pictures) b.paint(nav.visible());
  };
  // With pictures, the page paints once a frame instead, held levels hidden.
  if (opts.pictures) b.painter = () => nav.visible();
  if (opts.seed) { b.seed(opts.seed.states, opts.seed.at); b.load(mount, opts.seed.type); }
  else b.open(mount);
  const p: Page = {
    b, nav, pops, marks,
    ledger: () => ledger!,
    i: () => (isPbEntry(b.state) ? b.state.i : -1),
    settle: () => {
      b.settle();
      for (let k = 0; k < 60 && (ledger?.inspect().pending || b.goPending || ledger?.inspect().held != null); k++) b.advance(50);
      if (opts.pictures) b.advance(16); // a frame paints what settled
    },
  };
  return p;
}

/** I1: once settled, the entry on screen is the app's depth in this era. */
function expectAligned(p: Page): void {
  const v = p.ledger().inspect();
  expect(v.pending).toBeNull();
  expect(p.i()).toBe(v.want);
}

function expectClean(b: FakeBrowser): void {
  expect(b.pushesInsidePop).toBe(0);
  expect(b.pushesWithoutActivation).toBe(0);
  expect(b.goWhilePending).toBe(0);
  expect(b.flaggedPushes).toBe(0);
  expect(b.left).not.toBe('script');
}

const ENGINES: Engine[] = ['chromium', 'webkit'];

// ---------------------------------------------------------------------------
// The scenario table
// ---------------------------------------------------------------------------

describe.each(ENGINES)('the ledger on %s', (engine) => {
  it('boots by making the page its root, and pushes nothing before a tap', () => {
    const p = page({ engine });
    expect(p.b.state).toMatchObject({ pb: 2, i: 0, boot: 'boot1' });
    p.b.act(() => p.nav.open('plan')); // the Season plan on the first render
    p.settle();
    expect(p.b.pushes).toBe(0);
    expect(p.ledger().inspect().owed).toBe(true);
    p.b.tap();
    p.settle();
    expect(p.b.pushes).toBe(1);
    expectAligned(p);
    expectClean(p.b);
  });

  it('StrictMode register, release, register: one push', () => {
    const p = page({ engine, strict: true });
    p.b.tap(() => { const a = p.nav.open('local'); p.nav.remove(a); p.nav.open('local'); });
    p.settle();
    expect(p.b.pushes).toBe(1);
    expect(p.i()).toBe(1);
    expectAligned(p);
    expectClean(p.b);
  });

  it("Inbox 'Open recruiting' nets to one go(-1), with nothing left to drift", () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    let inbox!: Lv;
    p.b.tap(() => { inbox = p.nav.open('overlay'); });
    let letter!: Lv;
    p.b.tap(() => { letter = p.nav.open('local'); });
    p.settle();
    expect(p.i()).toBe(3);
    const gos = p.b.goCalls;
    const pushes = p.b.pushes;
    p.b.tap(() => { p.nav.remove(inbox); p.nav.open('route'); p.nav.remove(letter); });
    p.settle();
    expect(p.b.goCalls - gos).toBe(1);
    expect(p.b.log.filter((l) => l.startsWith('go')).at(-1)).toBe('go -1');
    expect(p.b.pushes).toBe(pushes);
    expectAligned(p);
    p.b.swipeBack();
    p.settle();
    expect(p.nav.depth()).toBe(1);
    expectAligned(p);
    expectClean(p.b);
  });

  it('a forward swipe is bounced and peels nothing', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.open('card'));
    p.b.tap(() => p.nav.close()); // closed on screen: the entry is given back
    p.settle();
    expect(p.i()).toBe(1);
    p.b.swipeForward();
    p.settle();
    expect(p.pops.at(-1)?.peeled).toBe(0);
    expect(p.nav.depth()).toBe(1);
    expect(p.i()).toBe(1);
    expectAligned(p);
    expectClean(p.b);
  });

  it('a refused guard refunds with go(+1) and zero pushes inside the pop', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.setGuard(true));
    p.settle();
    expect(p.i()).toBe(2);
    const pushes = p.b.pushes;
    p.b.swipeBack();
    p.settle();
    expect(p.b.pushes).toBe(pushes);
    expect(p.b.log).toContain('go 1');
    expect(p.nav.depth()).toBe(2);
    expect(p.i()).toBe(2);
    expect(p.marks.filter((m) => m.startsWith('return'))).toEqual([]);
    expectClean(p.b);
  });

  it('a blocking card at the root holds an entry, so the swipe is refused, not an exit', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.setGuard(true));
    p.settle();
    p.b.swipeBack();
    p.settle();
    expect(p.b.left).toBeNull();
    expect(p.i()).toBe(1);
    expectClean(p.b);
  });

  it('an era change a tap brought folds on its own a second later, so the first swipe never shows the old era', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.newEra('season|2|b|2027')); // Accept, Load, Take the job
    p.settle();
    expect(p.i()).toBe(2);
    expect(p.ledger().inspect().eraBase).toBe(2);
    p.b.advance(900);
    expect(p.i()).toBe(2); // a card the change brings late still finds the entries
    p.b.advance(200);
    p.settle();
    expect(p.i()).toBe(0);
    expect(p.ledger().inspect().eraBase).toBe(0);
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
    expectClean(p.b);
  });

  it('the carried tap survives a remount of the ledger between the change and the fold', () => {
    const b = new FakeBrowser({ engine });
    const nav = new FakeNav();
    const hooks = { pushMark() {}, markReturn() {}, onUserPop() {} };
    let deps!: Parameters<typeof installHistorySync>[0];
    let l!: HistorySync;
    b.open((env) => { deps = { ...env, nav, boot: 'r' }; l = installHistorySync(deps, hooks); return () => l.dispose(); });
    b.afterTask = () => { if (nav.dirty) { nav.dirty = false; l.afterCommit(); } };
    b.tap(() => nav.open('route'));
    b.tap(() => nav.newEra('season|2|b|2027'));
    b.settle();
    expect(b.state).toMatchObject({ i: 1 });
    l.dispose();
    l = installHistorySync(deps, hooks); // an effect run again (StrictMode, a hot reload)
    b.advance(1200);
    b.settle();
    expect(b.state).toMatchObject({ i: 0 });
    expectClean(b);
  });

  it('an era change landing well after the last tap (a long sim) collapses only after a tap in the new era', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => { p.nav.busy = true; }); // Sim to the end of the season
    p.b.advance(1500);
    p.b.act(() => { p.nav.busy = false; p.nav.newEra('winter|1|a|2026'); });
    p.settle();
    expect(p.i()).toBe(2);
    expect(p.ledger().inspect().eraBase).toBe(2);
    p.b.advance(2000);
    expect(p.i()).toBe(2); // no activation in this era yet
    p.b.tap();
    p.b.advance(200);
    expect(p.i()).toBe(2); // 300 ms of quiet first
    p.b.advance(200);
    p.settle();
    expect(p.i()).toBe(0);
    expect(p.ledger().inspect().eraBase).toBe(0);
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
    expectClean(p.b);
  });

  it('an era change with an arriving layer rebases, pushes, then collapses at depth 0', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => { p.nav.newEra('market|1|a|2026'); p.nav.open('card'); });
    p.settle();
    expect(p.i()).toBe(2);
    expect(p.ledger().inspect().eraBase).toBe(1);
    p.b.tap(() => p.nav.close());
    p.settle();
    expect(p.i()).toBe(1);
    p.b.advance(400);
    p.settle();
    expect(p.i()).toBe(0);
    expectAligned(p);
    expectClean(p.b);
  });

  it('a long press back three entries peels three, and lights the card above where it lands', () => {
    const p = page({ engine });
    for (const k of ['route', 'overlay', 'card', 'local']) p.b.tap(() => p.nav.open(k));
    p.settle();
    expect(p.i()).toBe(4);
    p.b.longPressBack(3);
    p.settle();
    expect(p.nav.depth()).toBe(1);
    expect(p.pops.at(-1)).toEqual({ uaAnimated: false, kinds: ['local', 'card', 'overlay'], peeled: 3 });
    expect(p.marks.at(-1)).toBe('return 2');
    expect(p.i()).toBe(1);
    expectAligned(p);
    expectClean(p.b);
  });

  it("loading from Saves collapses the front door; back then leaves the site", () => {
    const p = page({ engine });
    p.nav.newEra('front|0');
    p.b.tap(() => p.nav.open('overlay')); // Saved careers
    p.settle();
    expect(p.i()).toBe(1);
    p.b.tap(() => p.nav.newEra('season|2|b|2027')); // loadSlot
    p.b.tap(); // anything on the loaded Home
    p.b.advance(400);
    p.settle();
    expect(p.i()).toBe(0);
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
    expectClean(p.b);
  });

  it('a swipe below the era before any tap there lands on the root and stays', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('overlay'));
    p.b.tap(() => p.nav.newEra('season|2|b|2027'));
    p.settle();
    p.b.swipeBack();
    p.settle();
    expect(p.pops.at(-1)?.peeled).toBe(0);
    expect(p.ledger().inspect().eraBase).toBe(0);
    expectAligned(p);
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
  });

  it('a swipe below the era that lands above 0 collapses to the root at once, never bouncing', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.newEra('season|2|b|2027'));
    p.settle();
    expect(p.ledger().inspect().eraBase).toBe(2);
    p.b.swipeBack(); // onto 1: under the era, nothing to peel
    p.settle();
    expect(p.i()).toBe(0);
    expect(p.ledger().inspect().eraBase).toBe(0);
    expect(p.b.log).not.toContain('go 1');
    expectAligned(p);
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
    expectClean(p.b);
  });

  it('a tap during an in-flight traversal is spent by it; the level refunds, never pushes', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.open('card'));
    p.settle();
    p.b.tap(() => p.nav.close()); // go(-1) asked for, not yet run
    p.b.tap(() => p.nav.open('card'));
    const pushes = p.b.pushes;
    p.settle();
    expect(p.b.pushes).toBe(pushes);
    expect(p.i()).toBe(2);
    expectAligned(p);
    expectClean(p.b);
  });

  it('a long sim then a card: owed on WebKit, pushed on Chromium', () => {
    const p = page({ engine });
    p.b.tap(() => { p.nav.busy = true; });
    p.b.advance(12_000);
    p.b.act(() => { p.nav.busy = false; p.nav.open('card'); });
    p.settle();
    if (engine === 'webkit') {
      expect(p.i()).toBe(0);
      expect(p.ledger().inspect().owed).toBe(true);
      p.b.tap();
      p.settle();
    }
    expect(p.i()).toBe(1);
    expectAligned(p);
    expectClean(p.b);
  });

  it('a level arriving after a traversal, with no tap since, refunds into the entry just left', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.open('card'));
    p.settle();
    p.b.swipeBack(); // spends the tap
    p.settle();
    const pushes = p.b.pushes;
    p.b.act(() => p.nav.open('card'));
    p.settle();
    expect(p.b.pushes).toBe(pushes);
    expect(p.ledger().inspect().owed).toBe(false);
    expect(p.i()).toBe(2);
    expectClean(p.b);
  });

  it('with a push owed, a swipe peels one extra, landing where the preview showed', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.open('card'));
    p.settle();
    p.b.swipeBack();
    p.settle();
    p.b.act(() => p.nav.open('card')); // refunded into entry 2
    p.settle();
    p.b.act(() => p.nav.open('sheet')); // entry 3 never existed: owed
    p.settle();
    expect(p.i()).toBe(2);
    expect(p.ledger().inspect()).toMatchObject({ want: 3, owed: true });
    p.b.swipeBack(); // previews entry 1, the route alone
    p.settle();
    expect(p.pops.at(-1)?.peeled).toBe(2);
    expect(p.nav.levels()).toEqual(['route:1']);
    expectAligned(p);
    expectClean(p.b);
  });

  it('collapse waits for idle', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.newEra('winter|1|a|2026'));
    p.nav.busy = true;
    p.b.tap();
    p.b.advance(3000);
    expect(p.i()).toBe(1);
    p.nav.busy = false;
    p.b.advance(400);
    p.settle();
    expect(p.i()).toBe(0);
    expectClean(p.b);
  });

  it('a collapse never runs while the page is hidden; showing it again does', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.newEra('winter|1|a|2026'));
    p.b.tap();
    p.b.hide(); // before the 300 ms of quiet; the tap's own reconcile still arms it
    p.b.advance(2000);
    expect(p.i()).toBe(1);
    expect(p.b.log.some((l) => l.startsWith('go'))).toBe(false);
    p.b.show();
    p.b.advance(400);
    p.settle();
    expect(p.i()).toBe(0);
    expectAligned(p);
    expectClean(p.b);
  });

  it('only input that grants activation pays a push: not Escape, a touch pointerdown or a script event', () => {
    const p = page({ engine });
    p.b.act(() => p.nav.open('card'));
    p.settle();
    expect(p.ledger().inspect().owed).toBe(true);
    const w = p.b.env.win;
    w.dispatch('click', { isTrusted: false });
    w.dispatch('touchend', { isTrusted: false });
    w.dispatch('keydown', { key: 'Escape' });
    w.dispatch('pointerdown', { pointerType: 'touch' }); // Chrome activates on the pointerup
    w.dispatch('pointerup', { pointerType: 'mouse' }); // and a mouse on the pointerdown
    p.settle();
    expect(p.b.pushes).toBe(0);
    expect(p.ledger().inspect().owed).toBe(true);
    w.dispatch('pointerdown', { pointerType: 'mouse' });
    p.settle();
    expect(p.b.pushes).toBe(1);
    expectAligned(p);
  });

  it('a rollYear-shaped era, then the terms card later: the card gets an entry, no collapse between', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.newEra('season|1|a|2027')); // rollYear
    p.b.advance(600);
    const gos = p.b.goCalls;
    p.b.act(() => p.nav.setGuard(true)); // seasonOpener's late write
    p.settle();
    expect(p.b.goCalls).toBe(gos);
    expect(p.i()).toBe(2);
    expectAligned(p);
    expectClean(p.b);
  });

  it('a hidden page waits out the watchdog and re-reads history when shown', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.open('card'));
    p.settle();
    p.b.hide();
    p.b.dropGos = 1;
    p.b.act(() => p.nav.close());
    p.b.advance(900);
    const gos = p.b.goCalls;
    p.b.advance(5000);
    expect(p.b.goCalls).toBe(gos); // never re-issued while hidden
    expect(p.i()).toBe(2);
    p.b.show();
    p.settle();
    expect(p.i()).toBe(1);
    expectAligned(p);
    expectClean(p.b);
  });

  it('a push that throws SecurityError is owed, and paid by the next tap', () => {
    const p = page({ engine });
    p.b.throwOnPush = 2; // the commit's push, then the tap's deferred retry
    p.b.tap(() => p.nav.open('card'));
    p.settle();
    expect(p.i()).toBe(0);
    expect(p.ledger().inspect().owed).toBe(true);
    p.b.tap();
    p.settle();
    expect(p.i()).toBe(1);
    expectClean(p.b);
  });

  it.each(['same', 'cross'] as const)('reload at i = 5 (%s-document) rewinds to 0; stale entries bounce', (reloadMode) => {
    const p = page({ engine, reloadMode });
    for (let k = 0; k < 5; k++) p.b.tap(() => p.nav.open('route'));
    p.settle();
    expect(p.i()).toBe(5);
    p.b.reload();
    p.settle();
    expect(p.i()).toBe(0);
    expect(p.b.state).toMatchObject({ pb: 2, i: 0 });
    const boot = (p.b.state as { boot: string }).boot;
    expect(boot).not.toBe('boot1');
    p.b.swipeForward(); // into an entry from before the reload
    p.settle();
    expect(p.i()).toBe(0);
    expect(p.nav.depth()).toBe(0);
    p.b.tap(() => p.nav.open('card'));
    p.settle();
    expect(p.i()).toBe(1);
    expectAligned(p);
    expectClean(p.b);
  });

  it('StrictMode during the reload rewind: one traversal, not two', () => {
    const p = page({ engine, strict: true, reloadMode: 'same' });
    for (let k = 0; k < 3; k++) p.b.tap(() => p.nav.open('route'));
    p.settle();
    const gos = p.b.goCalls;
    p.b.reload();
    p.settle();
    expect(p.b.goCalls - gos).toBe(1);
    expect(p.i()).toBe(0);
    expectClean(p.b);
  });

  it.each([false, true])('legacy entries reached by back/forward keep leaving (Navigation API %s)', (navigationApi) => {
    const b = new FakeBrowser({ engine, navigationApi });
    const nav = new FakeNav();
    b.seed([{ playballRoot: true }, { playball: true }, { playball: true }], 2);
    b.load((env) => {
      const l = installHistorySync({ ...env, nav, boot: `boot${b.loads}` }, { pushMark() {}, markReturn() {}, onUserPop() {} });
      return () => l.dispose();
    }, 'back_forward');
    b.settle();
    for (let k = 0; k < 5 && !b.left; k++) b.settle();
    expect(b.left).toBe('script');
    if (navigationApi) expect(b.goCalls).toBe(1);
  });

  it('a legacy entry on a plain load becomes the root', () => {
    const b = new FakeBrowser({ engine });
    const nav = new FakeNav();
    b.seed([{ playballRoot: true }, { playball: true }], 1);
    b.load((env) => {
      const l = installHistorySync({ ...env, nav, boot: 'x' }, { pushMark() {}, markReturn() {}, onUserPop() {} });
      return () => l.dispose();
    }, 'reload');
    expect(b.state).toMatchObject({ pb: 2, i: 0, boot: 'x' });
    expect(b.left).toBeNull();
  });

  const legacy = [{ playballRoot: true }, { playball: true }, { playball: true }];

  it.each([false, true])('a swipe onto legacy entries in the same document keeps leaving (Navigation API %s)', (navigationApi) => {
    const p = page({ engine, navigationApi, seed: { states: legacy, at: 2, type: 'reload' } });
    expect(p.b.state).toMatchObject({ pb: 2, i: 0 });
    p.b.shareDoc();
    const loads = p.b.loads;
    const gos = p.b.goCalls;
    p.b.swipeBack();
    p.b.advance(2000);
    expect(p.b.loads).toBe(loads); // popstates, not a reboot
    expect(p.b.left).toBe('script');
    if (navigationApi) expect(p.b.goCalls - gos).toBe(1);
  });

  // Nothing before the site in the tab: leaving cannot finish, so the page takes over.
  const older = [{ pb: 2, boot: 'old', i: 0, era: 0 }, { pb: 2, boot: 'mid', i: 0, era: 0, below: { old: -1, '*': 0 } }];
  it.each([
    ['a legacy entry', false, legacy, 2, false], ['a legacy entry', true, legacy, 2, false],
    ['an older numbering', false, older, 1, true], ['an older numbering', true, older, 1, true],
  ] as const)('with nothing before the site, a swipe onto %s below the root takes the page over (Navigation API %s)', (_what, navigationApi, states, at, sameDoc) => {
    const p = page({ engine, navigationApi, firstInTab: true, seed: { states: [...states], at, type: 'reload' } });
    if (sameDoc) p.b.shareDoc();
    p.b.swipeBack();
    p.b.advance(3000);
    expect(p.ledger().inspect()).toMatchObject({ leaving: false, pending: null });
    expect(p.b.state).toMatchObject({ pb: 2, i: 0 });
    const pushes = p.b.pushes;
    p.b.tap(() => p.nav.open('card'));
    p.settle();
    expect(p.b.pushes).toBe(pushes + 1);
    expectAligned(p);
    p.b.swipeBack();
    p.settle();
    expect(p.nav.depth()).toBe(0);
    expectAligned(p);
    expectClean(p.b);
  });

  it.each([false, true])('a collapse whose root was pruned relabels the page as root (Navigation API %s)', (navigationApi) => {
    const p = page({ engine, cap: 4, navigationApi });
    for (let k = 0; k < 5; k++) p.b.tap(() => p.nav.open('route'));
    p.settle();
    expect(p.i()).toBe(5);
    p.b.tap(() => p.nav.newEra('winter|1|a|2026'));
    p.b.tap();
    p.b.advance(400);
    p.settle();
    // Clamped to what survives below: the Navigation API knows three entries are left.
    expect(p.b.log.filter((l) => l.startsWith('go'))).toEqual([navigationApi ? 'go -3' : 'go -5']);
    expect(p.i()).toBe(0);
    expectAligned(p);
    p.b.tap(() => p.nav.open('card'));
    p.settle();
    expect(p.i()).toBe(1);
    expectClean(p.b);
  });

  it('marks are pushed and returned by entry index; the swipe reports whether the UA animated', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.open('card'));
    p.settle();
    expect(p.marks).toEqual(['push 1', 'push 2']);
    p.b.swipeBack();
    p.settle();
    expect(p.marks.at(-1)).toBe('return 2');
    expect(p.pops.at(-1)).toEqual({ uaAnimated: true, kinds: ['card'], peeled: 1 });
  });

  it('dispose takes every listener away', () => {
    const p = page({ engine });
    expect(p.b.listeners('popstate')).toBe(1);
    p.ledger().dispose();
    for (const t of ['popstate', 'pageshow', 'click', 'pointerup', 'keydown']) expect(p.b.listeners(t)).toBe(0);
  });

  it('coming back from another site through the page cache re-reads history', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('card'));
    p.b.tap(() => p.nav.close());
    p.settle();
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
    p.b.swipeForward();
    p.settle();
    expect(p.b.left).toBeNull();
    expectAligned(p);
  });
});

describe('which rules an engine gets', () => {
  it('reads WebKit from the user agent, iOS Chrome included', () => {
    const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const crios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1';
    const android = 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
    const samsung = 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0 Mobile Safari/537.36';
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0';
    const firefox = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';
    expect(engineOf(ios)).toBe('webkit');
    expect(engineOf(crios)).toBe('webkit');
    expect(engineOf(android)).toBe('chromium');
    expect(engineOf(samsung)).toBe('chromium');
    expect(engineOf(edge)).toBe('chromium');
    expect(engineOf(firefox)).toBe('chromium');
  });

  it('never calls crypto.randomUUID', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/ui/historySync.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/randomUUID\(/);
  });
});

// ---------------------------------------------------------------------------
// Pictures: one push per painted frame (back plan V1)
// ---------------------------------------------------------------------------

/** One swipe back, settled: what it previewed and what the page then shows. */
function swipe(p: Page): { preview: string | null; live: string } {
  p.b.swipeBack();
  p.settle();
  return { preview: p.b.preview, live: p.b.painted };
}

describe.each(ENGINES)('pictures on %s', (engine) => {
  it('before V1, the plan a job brings shares its commit with the new school, so its swipe previews the old Board', () => {
    const p = page({ engine });
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.open('overlay')); // the jobs, over the Board
    p.settle();
    const board = p.nav.sig();
    p.b.tap(() => { p.nav.newEra('season|1|b|2026'); p.nav.open('plan'); });
    p.settle();
    expect(swipe(p).preview).toBe(board);
  });

  it('the Season plan after a job: held until the new Home has painted, so its swipe previews that Home', () => {
    const p = page({ engine, pictures: true });
    p.b.advance(100);
    p.b.tap(() => p.nav.open('route'));
    p.b.advance(100);
    p.b.tap(() => p.nav.open('overlay'));
    p.settle();
    expect(p.nav.holds).toBe(0); // one level a tap: the frame under it is up already
    const board = p.nav.sig();
    p.b.tap(() => { p.nav.newEra('season|1|b|2026'); p.nav.open('plan'); });
    expect(p.nav.held).toBe(1); // hidden, not pushed
    p.b.advance(16);
    expect(p.b.painted).toBe(p.nav.levelSig(0)); // the next frame paints the new Home alone
    expect(p.b.pushes).toBe(2);
    p.settle();
    expect(p.nav.held).toBeNull();
    expect(p.b.pushes).toBe(3);
    expectAligned(p);
    expectClean(p.b);
    const { preview, live } = swipe(p);
    expect(preview).not.toBe(board);
    expect(preview).toBe(live);
    expect(live).toBe(p.nav.levelSig(0));
    expectAligned(p);
  });

  it('the Season plan on Resume: held over the loaded Home, never previewing Start', () => {
    const p = page({ engine, pictures: true });
    p.b.act(() => p.nav.newEra('front|start'));
    p.settle();
    p.b.advance(100);
    const start = p.nav.sig();
    p.b.tap(() => { p.nav.newEra('season|slot1|a|2026'); p.nav.open('plan'); });
    expect(p.nav.held).toBe(1);
    p.settle();
    expectAligned(p);
    const { preview, live } = swipe(p);
    expect(preview).not.toBe(start);
    expect(preview).toBe(live);
  });

  it('the terms card as the year rolls: its entry waits for the new season, which the refused swipe then shows under it', () => {
    const p = page({ engine, pictures: true });
    p.b.tap(() => p.nav.open('route')); // a winter step
    p.settle();
    const lastSeason = p.nav.sig();
    p.b.tap(() => { p.nav.newEra('season|1|a|2027'); p.nav.setGuard(true); });
    expect(p.nav.held).toBe(1); // guards are held like any level
    p.settle();
    expectAligned(p);
    const { preview } = swipe(p);
    expect(preview).not.toBe(lastSeason);
    expect(preview).toBe(p.nav.levelSig(0)); // the new Home, under the card (§6.4)
    expect(p.nav.guard).toBe(true); // refused, and refunded
    expectAligned(p);
    expectClean(p.b);
  });

  it('the June seed dialog, mounted a commit after June itself: held until June has painted', () => {
    const p = page({ engine, pictures: true });
    p.b.tap(() => p.nav.open('route'));
    p.settle();
    p.b.advance(100);
    const april = p.nav.sig();
    p.b.tap(() => p.nav.newEra('june|1|a|2026'));
    p.b.act(() => p.nav.open('dialog')); // before any frame
    expect(p.nav.held).toBe(1);
    p.settle();
    expectAligned(p);
    const { preview, live } = swipe(p);
    expect(preview).not.toBe(april);
    expect(preview).toBe(live);
  });

  it('the injury card after a week: the day is in the picture, so the week paints before the card is pushed', () => {
    const p = page({ engine, pictures: true });
    p.b.advance(100);
    const lastWeek = p.nav.sig();
    p.b.tap(() => { p.nav.day += 7; p.nav.open('injury'); });
    expect(p.nav.held).toBe(1);
    p.settle();
    expectAligned(p);
    const { preview, live } = swipe(p);
    expect(preview).not.toBe(lastWeek);
    expect(preview).toBe(live);
  });

  it('Hire one: two levels in one tap, each entry pushed over its own frame', () => {
    const p = page({ engine, pictures: true });
    p.b.advance(100);
    p.b.tap(() => { p.nav.open('overlay'); p.nav.open('sheet'); });
    expect(p.b.pushes).toBe(1); // the room's entry at once: Home is on screen
    expect(p.nav.held).toBe(2); // the sheet waits for the room to paint
    p.settle();
    expect(p.b.pushes).toBe(2);
    expectAligned(p);
    let s = swipe(p);
    expect(s.preview).toBe(p.nav.levelSig(1)); // the room alone
    expect(s.preview).toBe(s.live);
    s = swipe(p);
    expect(s.preview).toBe(p.nav.levelSig(0));
    expect(s.preview).toBe(s.live);
    expectClean(p.b);
  });

  it('two taps inside one frame: the second level waits until the first has painted', () => {
    const p = page({ engine, pictures: true });
    p.b.advance(100);
    p.b.tap(() => p.nav.open('route'));
    p.b.tap(() => p.nav.open('card'));
    expect(p.nav.held).toBe(2);
    p.settle();
    expectAligned(p);
    let s = swipe(p);
    expect(s.preview).toBe(s.live);
    s = swipe(p);
    expect(s.preview).toBe(s.live);
  });

  it('a level that moves as the screen is never held: it is pushed as the frame stands', () => {
    const p = page({ engine, pictures: true });
    p.b.tap(() => { p.nav.newEra('season|1|b|2026'); p.nav.open('route'); });
    expect(p.nav.held).toBeNull();
    expect(p.b.pushes).toBe(1);
    expect(p.nav.holds).toBe(0);
    p.settle();
    expectAligned(p);
  });

  it('an owed push a tap pays is not held: the card is on screen already, and hiding it would blink under the finger', () => {
    const p = page({ engine, pictures: true });
    p.b.advance(100);
    p.b.throwOnPush = 2; // the commit's push, then the tap's deferred retry
    p.b.tap(() => p.nav.open('card'));
    p.settle();
    expect(p.ledger().inspect().owed).toBe(true);
    p.b.advance(100); // the card paints
    p.b.tap();
    p.settle();
    expect(p.nav.holds).toBe(0);
    expect(p.i()).toBe(1);
    expectAligned(p);
  });

  it('when frames stop, the hold lets go after 100 ms and the entry is pushed', () => {
    const p = page({ engine, pictures: true });
    p.b.tap(() => { p.nav.newEra('season|1|b|2026'); p.nav.open('plan'); });
    expect(p.nav.held).toBe(1);
    p.b.hide();
    p.b.advance(90);
    expect(p.nav.held).toBe(1);
    expect(p.b.pushes).toBe(0);
    p.b.advance(20);
    expect(p.nav.held).toBeNull();
    expect(p.b.pushes).toBe(1);
    p.b.show();
    p.settle();
    expectAligned(p);
  });

  it('a held level closed before its frame is never pushed, and nothing stays hidden', () => {
    const p = page({ engine, pictures: true });
    p.b.tap(() => { p.nav.newEra('season|1|b|2026'); p.nav.open('plan'); });
    expect(p.nav.held).toBe(1);
    p.b.tap(() => p.nav.close());
    expect(p.nav.held).toBeNull();
    p.settle();
    expect(p.b.pushes).toBe(0);
    expectAligned(p);
  });

  it('a swipe while a level waits: nothing pushed in the pop, nothing left hidden', () => {
    const p = page({ engine, pictures: true });
    p.b.tap(() => p.nav.open('route'));
    p.settle();
    p.b.advance(100);
    p.b.tap(() => { p.nav.open('overlay'); p.nav.open('sheet'); });
    expect(p.nav.held).toBe(3);
    p.b.swipeBack();
    expect(p.nav.held).toBeNull();
    p.settle();
    expectAligned(p);
    expectClean(p.b);
  });

  it('opening and closing one level a tap never holds anything', () => {
    const p = page({ engine, pictures: true });
    for (const kind of ['route', 'card', 'overlay', 'local', 'route']) {
      p.b.advance(200);
      p.b.tap(() => p.nav.open(kind));
      p.settle();
    }
    p.b.advance(200);
    p.b.tap(() => p.nav.close());
    p.settle();
    expect(p.nav.holds).toBe(0);
    expectAligned(p);
    for (let k = 0; k < 4; k++) {
      const s = swipe(p);
      expect(s.preview).toBe(s.live);
    }
  });
});

// ---------------------------------------------------------------------------
// Reshoot: a top level replaced in place (back plan V2)
// ---------------------------------------------------------------------------

/** A stop, then the terms card, refused once: the entry under the card was left with it up. */
function refusedCard(engine: Engine): Page {
  const p = page({ engine, pictures: true });
  p.b.advance(100);
  p.b.tap(() => p.nav.open('route'));
  p.settle();
  p.b.tap(() => p.nav.setGuard(true));
  p.settle();
  expectAligned(p);
  expect(p.i()).toBe(2);
  const s = swipe(p);
  expect(s.preview).toBe(p.nav.levelSig(1)); // V1: the first refusal shows what is under the card
  expect(p.nav.guard).toBe(true);
  expectAligned(p);
  return p;
}
/** Signing: the card goes and the Season plan takes its place, in one commit. */
const sign = (p: Page): void => { p.b.tap(() => { p.nav.setGuard(false); p.nav.open('plan'); }); };

describe.each(ENGINES)('reshoot on %s', (engine) => {
  it('P1.4B: the plan that takes a refused card\'s place is reshot, so back previews the Home under it, not the card', () => {
    const p = refusedCard(engine);
    const card = p.nav.sig();
    const [pushes, gos] = [p.b.pushes, p.b.goCalls];
    sign(p);
    expect(p.nav.depth()).toBe(2); // net zero: nothing to push
    expect(p.nav.held).toBe(2); // the plan waits, hidden
    expect(p.ledger().inspect().reshoot).toBe('down');
    p.settle();
    expect(p.nav.held).toBeNull();
    expect(p.b.pushes).toBe(pushes); // no push, so no tap is needed for it
    expect(p.b.goCalls).toBe(gos + 2); // go(-1), then go(+1)
    expectAligned(p);
    expectClean(p.b);
    const s = swipe(p);
    expect(s.preview).not.toBe(card);
    expect(s.preview).toBe(s.live);
    expect(s.live).toBe(p.nav.levelSig(1));
    expectAligned(p);
  });

  it('the same replacement over a picture that is still right: nothing held, no traversal (C4c)', () => {
    const p = page({ engine, pictures: true });
    p.b.advance(100);
    p.b.tap(() => p.nav.open('route'));
    p.settle();
    p.b.tap(() => p.nav.setGuard(true));
    p.settle();
    const [gos, holds] = [p.b.goCalls, p.nav.holds];
    sign(p);
    expect(p.nav.held).toBeNull();
    p.settle();
    expect(p.b.goCalls).toBe(gos);
    expect(p.nav.holds).toBe(holds);
    expectAligned(p);
    const s = swipe(p);
    expect(s.preview).toBe(s.live);
  });

  it('C4d: the game replaced by the injury card a day on is reshot over the new day\'s Today', () => {
    const p = page({ engine, pictures: true });
    p.b.advance(100);
    p.b.tap(() => p.nav.open('route'));
    p.settle();
    p.b.advance(100);
    p.b.tap(() => p.nav.open('game')); // moves as the screen: pushed as the frame stands
    p.settle();
    expectAligned(p);
    const yesterday = p.nav.levelSig(1);
    const gos = p.b.goCalls;
    p.b.tap(() => { p.nav.close(); p.nav.day++; p.nav.open('injury'); }); // Record the game
    expect(p.ledger().inspect().reshoot).toBe('down');
    p.settle();
    expect(p.b.goCalls).toBe(gos + 2);
    expectAligned(p);
    expectClean(p.b);
    const s = swipe(p);
    expect(s.preview).not.toBe(yesterday);
    expect(s.preview).toBe(s.live);
  });

  it('a replacement that moves as the screen is never reshot: there is nothing to show under it', () => {
    const p = page({ engine, pictures: true });
    p.b.advance(100);
    p.b.tap(() => p.nav.open('card'));
    p.settle();
    const gos = p.b.goCalls;
    p.b.tap(() => { p.nav.close(); p.nav.day++; p.nav.open('route'); });
    expect(p.ledger().inspect().reshoot).toBeNull();
    p.settle();
    expect(p.b.goCalls).toBe(gos);
    expectAligned(p);
  });

  it('a swipe while below: the held plan shows and goes with the swipe, nothing pushed in the pop', () => {
    const p = refusedCard(engine);
    sign(p);
    p.b.settle(); // go(-1) lands; the plan is still held while Home paints
    expect(p.ledger().inspect().reshoot).toBe('below');
    expect(p.i()).toBe(1);
    p.b.swipeBack();
    expect(p.nav.held).toBeNull();
    expect(p.ledger().inspect().reshoot).toBeNull();
    p.settle();
    expect(p.nav.depth()).toBe(0); // it previewed entry 0, so the plan and the stop went
    expect(p.b.preview).toBe(p.b.painted);
    expectAligned(p);
    expectClean(p.b);
  });

  it('frames stop while below: the 100 ms fallback steps back up and shows the plan', () => {
    const p = refusedCard(engine);
    sign(p);
    p.b.settle();
    expect(p.ledger().inspect().reshoot).toBe('below');
    p.b.hide();
    p.b.advance(150);
    expect(p.i()).toBe(2);
    expect(p.nav.held).toBeNull();
    p.b.show();
    p.settle();
    expectAligned(p);
    expectClean(p.b);
  });

  it('a step the browser never runs: the watchdog shows the plan and never retries', () => {
    const p = refusedCard(engine);
    p.b.dropGos = 1;
    const gos = p.b.goCalls;
    sign(p);
    expect(p.nav.held).toBe(2);
    p.b.advance(1000);
    expect(p.nav.held).toBeNull();
    p.settle();
    expect(p.b.goCalls).toBe(gos + 1);
    expectAligned(p);
    expectClean(p.b);
  });

  it('a tap while below that opens a sheet: the reshoot gives way, and the sheet\'s entry previews the plan', () => {
    const p = refusedCard(engine);
    sign(p);
    p.b.settle();
    expect(p.ledger().inspect().reshoot).toBe('below');
    p.b.tap(() => p.nav.open('sheet'));
    p.settle();
    expect(p.nav.held).toBeNull();
    expectAligned(p);
    expectClean(p.b);
    const s = swipe(p);
    expect(s.preview).toBe(s.live);
  });

  it('a reload mid-reshoot leaves nothing hidden and nothing out of line', () => {
    const p = refusedCard(engine);
    sign(p);
    p.b.reload();
    p.settle();
    expect(p.nav.held).toBeNull();
    expectAligned(p);
    expectClean(p.b);
  });
});

describe('the hold, as App does it', () => {
  it('hides with visibility only, pauses the entrance, and never takes the level out of the layout', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../src/ui/design/screens.css', import.meta.url), 'utf8');
    const rule = css.slice(css.indexOf('[data-pb-hold], [data-pb-hold] * {'));
    const body = rule.slice(0, rule.indexOf('}'));
    expect(body).toContain('visibility: hidden !important');
    expect(body).toContain('pointer-events: none !important');
    expect(body).toContain('animation-play-state: paused !important');
    expect(css).not.toMatch(/\[data-pb-hold\][^{]*\{[^}]*display/);
  });

  it('levelHolder marks the levels from `from` up, shows the rest again, and says when the first cannot be held', async () => {
    const { levelHolder, holdTarget } = await import('../src/ui/navTarget.js');
    type El = { attrs: Set<string>; setAttribute(n: string): void; removeAttribute(n: string): void; closest(sel: string): El | null };
    const el = (host: El | null = null): El => {
      const e: El = {
        attrs: new Set(),
        setAttribute: (n) => { e.attrs.add(n); },
        removeAttribute: (n) => { e.attrs.delete(n); },
        closest: (sel) => (host && /pb-sheet-host|pb-dialog-host|pb-picker-host/.test(sel) ? host : null),
      };
      return e;
    };
    const sheetHost = el();
    const sheet = el(sheetHost);
    const card = el();
    const q = { last: (sel: string) => (sel.includes('is-player') ? card : null) as unknown as HTMLElement | null, main: () => null };
    const lv = (id: string, kind: string, element?: El): Level => ({ id, kind, stamp: 0, element: element ? () => element as unknown as HTMLElement : undefined, peel: () => 'none' }) as Level;
    const list = [lv('r:1', 'route'), lv('p:9', 'p'), lv('l:4', 'local', sheet)];
    const hold = levelHolder(q, () => list);
    expect(hold(1)).toBe(false); // a route moves as the screen
    expect(hold(2)).toBe(true);
    expect(card.attrs.has('data-pb-hold')).toBe(true);
    expect(sheetHost.attrs.has('data-pb-hold')).toBe(true); // the sheet's host, scrim and all
    expect(sheet.attrs.has('data-pb-hold')).toBe(false);
    expect(hold(3)).toBe(true);
    expect(card.attrs.has('data-pb-hold')).toBe(false);
    expect(sheetHost.attrs.has('data-pb-hold')).toBe(true);
    expect(hold(null)).toBe(true);
    expect(sheetHost.attrs.has('data-pb-hold')).toBe(false);
    // Guards: the terms card or a big moment; a June game is the screen.
    const terms = el();
    const gq = { last: (sel: string) => (sel === '.pb-terms' ? terms : null) as unknown as HTMLElement | null, main: () => null };
    expect(holdTarget(lv('guard:card', 'guard'), gq)).toBe(terms);
    expect(holdTarget(lv('guard:june-game', 'guard'), gq)).toBeNull();
    for (const kind of ['route', 'step', 'game', 'sp']) expect(holdTarget(lv(kind, kind), gq)).toBeNull();
  });

  it('a dialog held when it opened takes focus once shown', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/ui/dialogFocus.ts', import.meta.url), 'utf8');
    expect(src).toContain("window.addEventListener('pb:reveal', onReveal);");
    expect(src).toContain("window.removeEventListener('pb:reveal', onReveal);");
    expect(src).toMatch(/if \(!box \|\| open\[open\.length - 1\] !== token\) return;/);
    const nt = readFileSync(new URL('../src/ui/navTarget.ts', import.meta.url), 'utf8');
    expect(nt).toContain("window.dispatchEvent(new Event('pb:reveal'))");
  });
});

// ---------------------------------------------------------------------------
// The fuzz
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `drops`: the browser now and then never runs one of our traversals. A
 * dropped collapse or rewind relabels the page as root, after which older
 * entries are read through the numbering map, not exactly; so with drops only
 * the rules that make Chrome skip entries and WebKit flag them are asserted.
 */
/** I2 at the push, with pictures: why an entry was left over a frame that was not the level under it. */
interface Misses { screen: number; shown: number; hidden: number; below: number; other: string[] }

function fuzz(engine: Engine, seed: number, navigationApi: boolean, drops = false, firstInTab = false, pictures = false): Misses {
  const rnd = mulberry32(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const p = page({ engine, navigationApi, firstInTab, pictures, reloadMode: seed % 2 ? 'same' : 'cross', webkitGo: seed % 3 ? 'replace' : 'adjust' });
  const { b, nav } = p;
  let eras = 0;
  let reshoots = 0;
  let faulted = false;
  const where = (step: number, op: string): string => `${engine} seed ${seed} step ${step} (${op}): ${b.log.slice(-12).join(', ')}`;
  // The allow-list: a level that moves as the screen (never held), one
  // already on screen when a tap paid its owed push (holding it would blink),
  // a hidden page, which paints nothing and lets its holds go at 100 ms, or
  // an entry at or under the era's base, which holds none of its levels.
  const misses: Misses = { screen: 0, shown: 0, hidden: 0, below: 0, other: [] };
  let shownIds: string[] = [];
  if (pictures) {
    const commit = b.afterTask;
    b.afterTask = () => { commit?.(); if (p.ledger()?.inspect().reshoot) reshoots++; };
    const paint = b.painter!;
    b.painter = () => { shownIds = nav.levelIds().slice(0, nav.held !== null ? nav.held - 1 : nav.depth()); return paint(); };
    b.beforePush = (data) => {
      const k = (data as { i: number }).i;
      const d = k - p.ledger().inspect().eraBase;
      if (d <= 0) { misses.below++; return; }
      if (b.painted === nav.levelSig(d - 1)) return;
      if (nav.kindAt(d) === 'route' || nav.kindAt(d) === 'game') misses.screen++;
      else if (shownIds.includes(nav.levelIds()[d - 1]!)) misses.shown++;
      else if (b.visibility === 'hidden') misses.hidden++;
      else misses.other.push(`entry ${k} left on ${b.painted}, not ${nav.levelSig(d - 1)} (levels ${nav.levelIds().join(',')}, held ${nav.held}); ${b.log.slice(-8).join(', ')}`);
    };
  }

  for (let step = 0; step < 2000; step++) {
    if (b.left) { b.swipeForward(); p.settle(); continue; }
    const r = rnd();
    let op = '';
    if (r < 0.17) { op = 'tap open'; if (nav.stack.length < 10) b.tap(() => nav.open(pick(['route', 'overlay', 'card', 'local']))); else b.tap(); }
    else if (r < 0.28) { op = 'tap close'; b.tap(() => { if (nav.stack.length) nav.close(); }); }
    else if (r < 0.32) { op = 'tap'; b.tap(); }
    else if (r < 0.36) { op = 'strict'; b.tap(() => { const l = nav.open('local'); nav.remove(l); nav.open('local'); }); }
    else if (r < 0.41) {
      // With pictures, a day played sometimes lands with it (the injury card after a week).
      op = 'arrive';
      if (pictures && nav.stack.length && rnd() < 0.35) {
        // V2: the top replaced in place, sometimes a day on (the game by the injury card).
        op = 'replace';
        b.act(() => { nav.close(); if (rnd() < 0.5) nav.day++; nav.open(pick(['card', 'local', 'game'])); });
      } else if (nav.stack.length < 10) b.act(() => { if (pictures && rnd() < 0.4) nav.day++; nav.open('card'); });
    }
    else if (r < 0.44) { op = 'leave'; b.act(() => { if (nav.stack.length) nav.close(); }); }
    else if (r < 0.48) { op = 'guard'; const on = !nav.guard; if (rnd() < 0.5) b.tap(() => nav.setGuard(on)); else b.act(() => nav.setGuard(on)); }
    else if (r < 0.62) { op = 'swipe back'; b.swipeBack(); }
    else if (r < 0.66) { op = 'swipe forward'; b.swipeForward(); }
    else if (r < 0.70) {
      // Holding the button takes long enough for any traversal of ours to run first.
      op = 'long press';
      b.settle();
      if (!b.left) b.longPressBack(1 + Math.floor(rnd() * 4));
    }
    else if (r < 0.74) { op = 'tap era'; b.tap(() => { nav.newEra(`era${++eras}`); if (rnd() < 0.5) nav.open('card'); }); }
    else if (r < 0.77) { op = 'era'; b.act(() => nav.newEra(`era${++eras}`)); }
    else if (r < 0.85) { op = 'time'; b.advance(Math.floor(rnd() * (rnd() < 0.2 ? 12_000 : 700))); }
    else if (r < 0.87) { op = 'visibility'; if (b.visibility === 'hidden') b.show(); else b.hide(); }
    else if (r < 0.89) { op = 'busy'; nav.busy = !nav.busy; }
    else if (r < 0.90) { op = 'reload'; b.reload(); }
    else if (r < 0.92) { op = 'drop go'; if (drops) b.dropGos = 1; }
    else if (r < 0.93) { op = 'throw push'; b.throwOnPush = 1; faulted = true; }
    else { op = 'quiet'; b.advance(400); }

    const ctx = where(step, op);
    expect(misses.other, ctx).toEqual([]);
    expect(b.pushesInsidePop, ctx).toBe(0);
    expect(b.pushesWithoutActivation, ctx).toBe(0);
    expect(b.flaggedPushes, ctx).toBe(0);
    if (drops) continue;
    expect(b.goWhilePending, ctx).toBe(0);
    // The page only leaves by itself to finish a swipe that went below its root.
    if (b.left === 'script') expect(p.ledger().inspect().leaving, ctx).toBe(true);
    if (!b.left) expect(b.current.foreign, ctx).toBe(false);
    // Read raw: isPbEntry already refuses a negative or broken `i`.
    const raw = b.state as { pb?: unknown; i?: unknown } | null;
    if (raw?.pb === 2) {
      expect(Number.isInteger(raw.i), ctx).toBe(true);
      expect(raw.i as number, ctx).toBeGreaterThanOrEqual(0);
    }

    // I1, once settled (not every step: some operations land mid-flight).
    if (rnd() < 0.2 || b.left || b.visibility === 'hidden') continue;
    p.settle();
    if (b.left) continue;
    const v = p.ledger().inspect();
    if (v.pending) {
      expect(p.i(), ctx).not.toBe(v.pending.target); // one traversal in flight, and it has not landed
      continue;
    }
    // An owed push (no tap since a traversal, or WebKit's window) waits for
    // the next tap; a thrown push can spend one.
    for (let k = 0; k < 3 && !b.left && p.i() !== p.ledger().inspect().want && (v.owed || faulted); k++) {
      b.tap();
      p.settle();
    }
    if (b.left) continue;
    if (b.throwOnPush === 0) faulted = false; // an armed fault may not have fired yet
    const w = p.ledger().inspect();
    expect(w.pending, ctx).toBeNull();
    expect(p.i(), `${ctx} want ${w.want} owed ${w.owed} eraBase ${w.eraBase}`).toBe(w.want);
    expect(w.held, `${ctx}: nothing stays hidden once aligned`).toBeNull();
    expect(nav.held, ctx).toBeNull();
  }
  expect(b.pushes).toBeGreaterThan(50);
  expect(b.loads).toBeGreaterThan(1);
  if (pictures) expect(nav.holds, 'the fuzz holds levels').toBeGreaterThan(5);
  if (pictures) expect(reshoots, 'the fuzz reshoots').toBeGreaterThan(0);
  return misses;
}

describe('2,000 seeded operations', () => {
  it.each([
    ['chromium', 1, false], ['chromium', 2, true], ['chromium', 3, false],
    ['webkit', 4, false], ['webkit', 5, true], ['webkit', 6, false],
  ] as const)('%s, seed %i, Navigation API %s: aligned once settled, one traversal at a time, no pushes in a pop or without a tap', (engine, seed, api) => {
    fuzz(engine, seed, api);
  });

  it.each([
    ['chromium', 7, false], ['chromium', 8, true], ['webkit', 9, false], ['webkit', 10, true],
  ] as const)('%s, seed %i, Navigation API %s, with dropped traversals: still no pushes in a pop or without a tap', (engine, seed, api) => {
    fuzz(engine, seed, api, true);
  });

  it.each([
    ['chromium', 11, true, false], ['chromium', 12, false, true], ['webkit', 13, true, true], ['webkit', 14, false, false],
  ] as const)('%s, seed %i, Navigation API %s, drops %s, nothing before the site: the same rules, never parked', (engine, seed, api, drops) => {
    fuzz(engine, seed, api, drops, true);
  });

  // V1: every push leaves its entry on the frame of the level under it, but
  // for the allow-list (a screen-moving level, or one already on screen).
  it.each([
    ['chromium', 15, true], ['chromium', 16, false], ['webkit', 17, true], ['webkit', 18, false],
  ] as const)('%s, seed %i, Navigation API %s, with pictures: each entry left on the frame under its level', (engine, seed, api) => {
    const m = fuzz(engine, seed, api, false, false, true);
    expect(m.other).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// returnMark by entry index
// ---------------------------------------------------------------------------

describe('returnMark keyed by entry', () => {
  it('lights the card that pushed the entry above, once; a lower push forgets it', async () => {
    const g = globalThis as Record<string, unknown>;
    const saved = { window: g.window, raf: g.requestAnimationFrame };
    const handlers: ((e: unknown) => void)[] = [];
    g.window = { addEventListener: (_t: string, fn: (e: unknown) => void) => { handlers.push(fn); }, removeEventListener: () => {} };
    g.requestAnimationFrame = (fn: () => void) => setTimeout(fn, 0);
    try {
      const { trackPresses, pushMark, markReturn } = await import('../src/ui/returnMark.js');
      const stop = trackPresses();
      const classes = new Set<string>();
      const el = { isConnected: true, classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } };
      const press = (target: unknown): void => handlers[0]!({ target: { closest: () => target } });
      press(el); pushMark(3);
      press(null); pushMark(4);
      markReturn(4);
      expect(classes.has('pb-returning')).toBe(false);
      markReturn(3);
      expect(classes.has('pb-returning')).toBe(true);
      classes.clear();
      markReturn(3); // lit once
      expect(classes.has('pb-returning')).toBe(false);
      press(el); pushMark(3);
      pushMark(2); // a push to 2 drops the marks above it
      markReturn(3);
      expect(classes.has('pb-returning')).toBe(false);
      stop();
      await new Promise((r) => setTimeout(r, 200)); // let the fades run while the stubs stand
    } finally {
      g.window = saved.window;
      g.requestAnimationFrame = saved.raf;
    }
  });
});
