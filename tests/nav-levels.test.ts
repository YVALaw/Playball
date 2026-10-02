// nav-levels.test.ts
// One list of levels (src/state/nav.ts, back-plan package N, 2026-09-30):
// the order a back press sees them in, what each kind's peel does, that the
// level on top is always the one a peel takes (500 seeded sequences), the
// predictive-back shapes (src/ui/navTarget.ts), and the ledger
// (src/ui/historySync.ts) run against the real store and registry in the fake
// browsers of tests/support/fakeBrowser.ts.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useDynasty, PHASES, type DynastyStore } from '../src/state/store.js';
import { setEraReset } from '../src/state/era.js';
import {
  levels, depth, newest, peelNewest, levelsKey, subscribe, idle, eraNow, ledgerNav, type Level,
} from '../src/state/nav.js';
import {
  registerBackLayer, releaseBackLayer, resetBackLayers, localLayers, stampOf, peelBackLayer, backLayerCount,
} from '../src/state/backLayers.js';
import { toTarget, asShown, type TargetQuery } from '../src/ui/navTarget.js';
import { installHistorySync, isPbEntry, type HistorySync, type Engine } from '../src/ui/historySync.js';
import { FakeBrowser, type FakeEnv } from './support/fakeBrowser.js';

const S = (): DynastyStore => useDynasty.getState();
const ids = (): string[] => levels().map((l) => l.id);
const route = (): string => `${S().tab}|${S().screen}`;

/** A sheet a screen holds itself; its dismiss unmounts it, as a real one would. */
function sheet(el?: () => HTMLElement | null): number {
  const box = { id: 0 };
  box.id = registerBackLayer(() => releaseBackLayer(box.id), el);
  return box.id;
}

function breakTheNine(): void {
  const s = S();
  const nine = s.season!.teams[s.userTeam]!.team.lineup;
  nine[1]!.pos = nine[0]!.pos;
}

const clean: Partial<DynastyStore> = {
  tab: 'home', screen: 'today', phase: null, bracket: null, jobSearch: false, live: null,
  overlay: null, overlayStack: [], selectedPlayer: null, coachSeat: null, godStack: [], settingsPage: 'index',
  navTrail: [], restoringVisit: null, stepBase: null, teamCard: null,
  bigMoment: null, playbookInvite: null, seasonOpener: null, godMode: true, busy: false,
};

let saveNow: DynastyStore['saveNow'];
beforeEach(() => {
  delete (globalThis as { document?: unknown }).document;
  setEraReset(false);
  S().start(4242, 0);
  saveNow = S().saveNow;
  // `leaveGame` saves; a peel under test has no disk to write to.
  useDynasty.setState({ ...clean, saveNow: async () => false });
  resetBackLayers();
});
afterEach(() => {
  useDynasty.setState({ saveNow });
  setEraReset(false);
  resetBackLayers();
});

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

describe('the order a back press sees', () => {
  it('has nothing at Home with nothing open', () => {
    expect(levels()).toEqual([]);
    expect(depth()).toBe(0);
    expect(newest()).toBeNull();
    expect(peelNewest()).toBe('none');
    expect(levelsKey()).toBe('');
  });

  it('puts a sheet opened over a card above it', () => {
    S().openPlayer('p1' as never);
    const l = sheet();
    expect(ids()).toEqual(['p:p1', `l:${l}`]);
  });

  it('puts a card opened over a sheet above it', () => {
    const l = sheet();
    S().openPlayer('p1' as never);
    expect(ids()).toEqual([`l:${l}`, 'p:p1']);
  });

  it('stacks an overlay over an overlay, each by its slot', () => {
    S().openOverlay('inbox');
    S().openOverlay('schedule');
    expect(ids()).toEqual(['o:0:inbox', 'o:1:schedule']);
    expect(newest()!.kind).toBe('overlay');
  });

  it('draws a god sheet over the card it was opened from', () => {
    S().openPlayer('p1' as never);
    S().openGod({ kind: 'player', id: 'p1' as never });
    S().openGod({ kind: 'money' });
    expect(ids()).toEqual(['p:p1', 'g:0', 'g:1']);
  });

  it('keeps the team card above the overlay and under the cards', () => {
    S().openOverlay('standings');
    S().openTeamCard(3);
    S().openCoach('pitching');
    S().openPlayer('p1' as never);
    expect(ids()).toEqual(['o:0:standings', 't:3', 'c:pitching', 'p:p1']);
  });

  it('keeps a Settings page a level under an overlay laid over it', () => {
    S().openOverlay('settings');
    S().setSettingsPage('display');
    expect(ids()).toEqual(['o:0:settings', 'sp:display']);
    S().openOverlay('saves');
    expect(ids()).toEqual(['o:0:settings', 'sp:display', 'o:1:saves']);
    expect(peelNewest()).toBe('peeled');
    expect(ids()).toEqual(['o:0:settings', 'sp:display']);
    expect(peelNewest()).toBe('peeled');
    expect(S().settingsPage).toBe('index');
    expect(ids()).toEqual(['o:0:settings']);
  });

  it('keeps a sheet over a Settings page newest once an overlay over both closes', () => {
    S().openOverlay('settings');
    S().setSettingsPage('display');
    const a = sheet();
    const page = stampOf('sp:display');
    S().openOverlay('saves');
    expect(ids()).toEqual(['o:0:settings', 'sp:display', `l:${a}`, 'o:1:saves']);
    expect(stampOf('sp:display')).toBe(page);
    S().closeOverlay();
    // Uncovered, the page is not opened anew: it keeps its stamp, under the sheet.
    expect(stampOf('sp:display')).toBe(page);
    expect(ids()).toEqual(['o:0:settings', 'sp:display', `l:${a}`]);
    expect(peelNewest()).toBe('peeled');
    expect(S().settingsPage).toBe('display');
    expect(ids()).toEqual(['o:0:settings', 'sp:display']);
  });

  it('places a sheet just above the store layers opened before it', () => {
    S().openOverlay('inbox');
    const a = sheet();
    S().openPlayer('p1' as never);
    const b = sheet();
    const c = sheet();
    expect(ids()).toEqual(['o:0:inbox', `l:${a}`, 'p:p1', `l:${b}`, `l:${c}`]);
    // A sheet older than every store layer sits under them all.
    resetBackLayers();
    useDynasty.setState({ overlay: null, selectedPlayer: null });
    const d = sheet();
    S().openOverlay('inbox');
    expect(ids()).toEqual([`l:${d}`, 'o:0:inbox']);
  });

  it('keeps route stops at the bottom and the game above them', () => {
    S().go('team');
    S().go('program');
    const [a, b] = S().navTrail;
    useDynasty.setState({ live: {} as never, tab: 'home', screen: 'box' });
    S().openPlayer('p1' as never);
    expect(ids()).toEqual([`r:${a!.visit}`, `r:${b!.visit}`, 'game', 'p:p1']);
  });

  it("holds June's game under the dugout's sheets", () => {
    useDynasty.setState({ bracket: {} as never, live: {} as never, screen: 'box' });
    expect(ids()).toEqual(['guard:june-game']);
    const dugout = sheet();
    const picker = sheet();
    expect(ids()).toEqual(['guard:june-game', `l:${dugout}`, `l:${picker}`]);
    expect(peelNewest()).toBe('peeled');
    expect(peelNewest()).toBe('peeled');
    const nudge = S().cardNudge;
    expect(peelNewest()).toBe('refused');
    expect(S().cardNudge).toBe(nudge + 1);
    expect(ids()).toEqual(['guard:june-game']);
  });

  it('puts a blocking card last, over anything opened after it', () => {
    useDynasty.setState({ bigMoment: {} as never });
    S().openPlayer('p1' as never);
    const l = sheet();
    expect(ids()).toEqual(['p:p1', `l:${l}`, 'guard:card']);
  });
});

// ---------------------------------------------------------------------------
// Each kind
// ---------------------------------------------------------------------------

describe('what each level does when peeled', () => {
  it('walks the route stops back, restoring each visit', () => {
    S().go('team');
    const teamVisit = S().routeVisit;
    S().setScreen('stats');
    expect(depth()).toBe(2);
    expect(newest()!.kind).toBe('route');
    expect(peelNewest()).toBe('peeled');
    expect(route()).toBe('team|roster');
    expect(S().restoringVisit).toBe(teamVisit);
    expect(peelNewest()).toBe('peeled');
    expect(route()).toBe('home|today');
    expect(depth()).toBe(0);
  });

  it("does not count another era's stops", () => {
    S().go('team');
    S().go('program');
    expect(depth()).toBe(2);
    useDynasty.setState({ year: S().year + 1 });
    expect(levels()).toEqual([]);
    expect(peelNewest()).toBe('none');
    useDynasty.setState({ year: S().year - 1 });
    expect(depth()).toBe(2);
  });

  it('counts no route stops in the winter, the market or the legacy screen', () => {
    S().go('team');
    useDynasty.setState({ phase: 'awards', stepBase: 'awards' });
    expect(levels()).toEqual([]);
    useDynasty.setState({ phase: null, jobSearch: true });
    expect(levels()).toEqual([]);
    useDynasty.setState({ jobSearch: false, coach: { ...S().coach, retiredYear: S().year } });
    expect(levels()).toEqual([]);
  });

  it('follows the winter steps from stepBase to the phase', () => {
    useDynasty.setState({ phase: 'draft', stepBase: 'review', furthestPhase: PHASES.length - 1 });
    expect(ids()).toEqual(['st:coach', 'st:draft']);
    expect(newest()!.kind).toBe('step');
    expect(peelNewest()).toBe('peeled');
    expect(S().phase).toBe('coach');
    expect(ids()).toEqual(['st:coach']);
    expect(peelNewest()).toBe('peeled');
    expect(S().phase).toBe('review');
    expect(levels()).toEqual([]);
    useDynasty.setState({ stepBase: 'awards' });
    expect(ids()).toEqual(['st:review']);
  });

  it('takes the season game back to Today, the game waiting', () => {
    useDynasty.setState({ live: {} as never, tab: 'home', screen: 'box' });
    expect(ids()).toEqual(['game']);
    expect(peelNewest()).toBe('peeled');
    expect(route()).toBe('home|today');
    expect(S().live).not.toBeNull();
    expect(levels()).toEqual([]);
  });

  it('closes each store layer by its own action', () => {
    S().openOverlay('settings');
    S().setSettingsPage('sound');
    S().openTeamCard(2);
    S().openCoach('hitting');
    S().openPlayer('p9' as never);
    S().openGod({ kind: 'coach' });
    const kinds: string[] = [];
    for (let n = 0; n < 10 && depth() > 0; n++) {
      kinds.push(newest()!.kind);
      expect(peelNewest()).toBe('peeled');
    }
    // The player card leaves the coach's sheet under it (PF): one level each.
    expect(kinds).toEqual(['g', 'p', 'c', 't', 'sp', 'overlay']);
    expect(S().overlay).toBeNull();
  });

  it('peels the named sheet, not merely the newest one', () => {
    const a = sheet();
    S().openPlayer('p1' as never);
    const b = sheet();
    expect(peelBackLayer(a)).toBe(true);
    expect(localLayers().map((l) => l.id)).toEqual([b]);
    expect(peelBackLayer()).toBe(true);
    expect(backLayerCount()).toBe(0);
    expect(peelBackLayer(a)).toBe(false);
  });

  it('leaves the depth alone when a guard refuses', () => {
    S().openPlayer('p1' as never);
    useDynasty.setState({ bigMoment: {} as never });
    const before = ids();
    const nudge = S().cardNudge;
    expect(peelNewest()).toBe('refused');
    expect(peelNewest()).toBe('refused');
    expect(ids()).toEqual(before);
    expect(S().cardNudge).toBe(nudge + 2);
  });

  it('leaves the depth alone when a broken nine refuses a route', () => {
    S().go('team', 'lineup');
    breakTheNine();
    const before = ids();
    const { cardNudge, lineupGate } = S();
    expect(peelNewest()).toBe('refused');
    expect(ids()).toEqual(before);
    expect(route()).toBe('team|lineup');
    expect(S().cardNudge).toBe(cardNudge + 1);
    expect(S().lineupGate).toBe(lineupGate);
  });

  it('stamps store layers by the ids it lists', () => {
    S().openOverlay('inbox');
    S().openPlayer('p1' as never);
    expect(stampOf('o:0:inbox')).toBeGreaterThan(0);
    expect(stampOf('p:p1')).toBeGreaterThan(stampOf('o:0:inbox'));
    expect(levels().map((l) => l.stamp)).toEqual([stampOf('o:0:inbox'), stampOf('p:p1')]);
    expect(stampOf('p:nobody')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Peek and peel parity
// ---------------------------------------------------------------------------

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OVERLAYS = ['inbox', 'schedule', 'standings', 'settings', 'saves', 'book', 'coach'] as const;
const PAGES = ['display', 'sound', 'play', 'god'] as const;
const SEATS = ['pitching', 'hitting', 'recruiting'] as const;
const ROUTES: [DynastyStore['tab'], string][] = [
  ['home', 'today'], ['home', 'wire'], ['team', 'roster'], ['team', 'stats'], ['office', 'staff'],
  ['office', 'budget'], ['program', 'records'], ['program', 'hall'],
];

/** One press, checked: the level on top is the one that goes, and nothing else does. */
function peelChecked(): void {
  const before = ids();
  const top = newest();
  const outcome = peelNewest();
  const after = ids();
  if (!top) {
    expect(outcome).toBe('none');
    expect(after).toEqual(before);
    return;
  }
  expect(top.id).toBe(before.at(-1));
  if (outcome === 'refused') {
    expect(top.kind).toBe('guard');
    expect(after).toEqual(before);
    return;
  }
  expect(outcome).toBe('peeled');
  expect(after).not.toContain(top.id);
  expect(after.filter((id) => !before.includes(id))).toEqual([]);
  // One press, one level: closePlayer leaves the coach's sheet under it (PF).
  const extra = before.filter((id) => id !== top.id && !after.includes(id));
  expect(extra).toEqual([]);
  const expected = before.filter((id) => id !== top.id);
  expect([...after].sort()).toEqual([...expected].sort());
  /*
    The base and the store layers keep their order. A sheet is placed by the
    store layers opened before it, so one that outlives the card it opened
    over can settle lower once that card goes (a sheet held by the card goes
    with it, so only these seeded stand-ins do that; see pkg-N.md).
  */
  const fixed = (xs: string[]): string[] => xs.filter((id) => !id.startsWith('l:'));
  expect(fixed(after)).toEqual(fixed(expected));
}

describe('peek and peel parity', () => {
  it('peels exactly the level it shows on top, over 500 seeded sequences', () => {
    const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
    let peels = 0;
    const seen = new Set<string>();
    for (let seed = 1; seed <= 500; seed++) {
      const r = rng(seed);
      resetBackLayers();
      const frame = r();
      useDynasty.setState({
        ...clean,
        ...(frame < 0.15 ? { bracket: {} as never } : {}),
        ...(frame > 0.85 ? { phase: 'draft', stepBase: 'awards', furthestPhase: PHASES.length - 1 } : {}),
      });
      const mine: number[] = [];
      const trace: string[] = [];
      try {
      for (let step = 0; step < 40; step++) {
        const s = S();
        const op = r();
        trace.push(`${op.toFixed(3)} [${ids().join(' ')}] ov=${s.overlay} st=${s.overlayStack.map((x) => x.overlay).join('/')} sp=${s.settingsPage}`);
        if (op < 0.3) { peelChecked(); peels++; }
        else if (op < 0.38) s.openOverlay(pick(r, OVERLAYS));
        else if (op < 0.42) s.closeOverlay();
        else if (op < 0.45) s.setSettingsPage(pick(r, PAGES));
        else if (op < 0.5) s.openPlayer(`p${Math.floor(r() * 3)}` as never);
        else if (op < 0.52) s.closePlayer();
        else if (op < 0.56) s.openCoach(pick(r, SEATS));
        else if (op < 0.58) s.closeCoach();
        else if (op < 0.61) s.openGod(r() < 0.5 ? { kind: 'money' } : { kind: 'player', id: `p${Math.floor(r() * 3)}` as never });
        else if (op < 0.63) s.closeGod();
        else if (op < 0.66) s.openTeamCard(Math.floor(r() * 4));
        else if (op < 0.67) s.closeTeamCard();
        else if (op < 0.74) mine.push(sheet());
        else if (op < 0.77) { if (mine.length) releaseBackLayer(mine.splice(Math.floor(r() * mine.length), 1)[0]!); }
        else if (op < 0.86) { const [tab, screen] = pick(r, ROUTES); s.go(tab, screen); }
        else if (op < 0.89) s.setScreen(pick(r, ROUTES)[1]);
        else if (op < 0.92) useDynasty.setState(s.live ? { live: null } : { live: {} as never, tab: 'home', screen: 'box' });
        else if (op < 0.95) useDynasty.setState({ bigMoment: s.bigMoment ? null : {} as never });
        else if (op < 0.97 && s.phase !== null) useDynasty.setState({ phase: pick(r, ['review', 'coach', 'draft'] as const) });
        else { peelChecked(); peels++; }
        for (const l of levels()) seen.add(l.kind);
      }
      // Drain: with the card answered and no June game, every level goes.
      useDynasty.setState({ bigMoment: null, ...(S().bracket ? { live: null } : {}) });
      for (let n = 0; n < 80 && depth() > 0; n++) { trace.push(`drain [${ids().join(' ')}]`); peelChecked(); peels++; }
      expect(levels()).toEqual([]);
      } catch (e) {
        throw new Error(`seed ${seed}:\n${trace.join('\n')}\n${(e as Error).message}`);
      }
    }
    expect(peels).toBeGreaterThan(5000);
    // Every kind turned up somewhere in the run.
    expect([...seen].sort()).toEqual(['c', 'g', 'game', 'guard', 'local', 'overlay', 'p', 'route', 'sp', 'step', 't']);
  });
});

// ---------------------------------------------------------------------------
// The shapes the Android gesture moves
// ---------------------------------------------------------------------------

type Fake = HTMLElement & { name: string };
function el(name: string, up: Record<string, Fake | null> = {}, inside: Record<string, Fake> = {}): Fake {
  return {
    name,
    closest: (sel: string) => up[sel] ?? null,
    querySelector: (sel: string) => inside[sel] ?? null,
  } as unknown as Fake;
}

describe('toTarget', () => {
  const main = el('main');
  const found: Record<string, Fake> = {};
  const q: TargetQuery = { last: (sel) => found[sel] ?? null, main: () => main };
  const lv = (kind: Level['kind'], element?: () => HTMLElement | null): Level =>
    ({ id: kind, kind, stamp: 0, element, peel: () => 'none' });

  it("gives each kind today's shape", () => {
    const god = el('god'); found['.pb-fulloverlay.god-sheet'] = god;
    const card = el('card'); found['.pb-fulloverlay.is-player'] = card;
    const team = el('team'); found['.pb-fulloverlay.is-team'] = team;
    const body = el('body'); found['.pb-tableoverlay__body'] = body;
    const table = el('table'); found['.pb-tableoverlay'] = table;
    const deskSheet = el('desk');
    const deskHost = el('host', {}, { ':scope > .pb-sheet': deskSheet });
    found['.pb-sheet-host > .pb-sheet'] = el('desk-inner', { '.pb-sheet-host': deskHost });

    expect(toTarget(null, q)).toEqual({ kind: 'none' });
    expect(toTarget(lv('guard'), q)).toEqual({ kind: 'blocked' });
    expect(toTarget(lv('g'), q)).toEqual({ kind: 'layer', el: god });
    expect(toTarget(lv('p'), q)).toEqual({ kind: 'layer', el: card });
    expect(toTarget(lv('t'), q)).toEqual({ kind: 'layer', el: team });
    expect(toTarget(lv('sp'), q)).toEqual({ kind: 'screen', el: body });
    expect(toTarget(lv('overlay'), q)).toEqual({ kind: 'layer', el: table });
    expect(toTarget(lv('c'), q)).toEqual({ kind: 'sheet', el: deskSheet, host: deskHost });
    for (const k of ['route', 'step', 'game'] as const) expect(toTarget(lv(k), q)).toEqual({ kind: 'screen', el: main });
  });

  it('moves a local sheet as a sheet, a layer, or not at all', () => {
    const sheetEl = el('s');
    const host = el('h', {}, { ':scope > .pb-sheet': sheetEl });
    const inSheet = el('in-sheet', { '.pb-sheet-host': host });
    expect(toTarget(lv('local', () => inSheet), q)).toEqual({ kind: 'sheet', el: sheetEl, host });
    const frame = el('frame');
    const inLayer = el('in-layer', { '.pb-fulloverlay, .pb-tableoverlay': frame });
    expect(toTarget(lv('local', () => inLayer), q)).toEqual({ kind: 'layer', el: frame });
    const bare = el('bare');
    expect(toTarget(lv('local', () => bare), q)).toEqual({ kind: 'layer', el: bare });
    expect(toTarget(lv('local'), q)).toEqual({ kind: 'plain' });
    expect(toTarget(lv('local', () => null), q)).toEqual({ kind: 'plain' });
    expect(asShown(null)).toEqual({ kind: 'plain' });
  });

  it("reads a real level's element from the registry", () => {
    const frame = el('frame');
    const inLayer = el('x', { '.pb-fulloverlay, .pb-tableoverlay': frame });
    sheet(() => inLayer);
    expect(toTarget(newest(), q)).toEqual({ kind: 'layer', el: frame });
  });
});

// ---------------------------------------------------------------------------
// The hooks App will use
// ---------------------------------------------------------------------------

describe('what App subscribes to', () => {
  it('hears the store and the registry, and gives a primitive key', () => {
    let heard = 0;
    const off = subscribe(() => { heard++; });
    S().openPlayer('p1' as never);
    const afterStore = heard;
    expect(afterStore).toBeGreaterThan(0);
    const l = sheet();
    expect(heard).toBeGreaterThan(afterStore);
    expect(levelsKey()).toBe(`p:p1 l:${l}`);
    expect(levelsKey()).toBe(levelsKey());
    off();
    const was = heard;
    S().closePlayer();
    releaseBackLayer(l);
    expect(heard).toBe(was);
  });

  it('is idle unless the store is busy, and names the era', () => {
    expect(idle()).toBe(true);
    useDynasty.setState({ busy: true });
    expect(idle()).toBe(false);
    expect(ledgerNav.idle()).toBe(false);
    expect(eraNow().startsWith('season|')).toBe(true);
    expect(ledgerNav.eraKey()).toBe(eraNow());
  });

  it('loads ahead of the store without a cycle', async () => {
    vi.resetModules();
    const nav = await import('../src/state/nav.js');
    const store = await import('../src/state/store.js');
    expect(nav.levels(store.useDynasty.getState())).toEqual([]);
    vi.resetModules();
  });
});

// ---------------------------------------------------------------------------
// The ledger on the real levels
// ---------------------------------------------------------------------------

interface Page {
  b: FakeBrowser;
  ledger(): HistorySync;
  i(): number;
  settle(): void;
  aligned(): void;
}

/** App, reduced: the ledger installed once, and its layout effect keyed on the levels and the era. */
function page(engine: Engine): Page {
  const b = new FakeBrowser({ engine });
  let ledger: HistorySync | null = null;
  let seen = '';
  const mount = (env: FakeEnv): (() => void) => {
    const deps = { ...env, nav: ledgerNav, boot: 'b1' };
    const hooks = { pushMark: () => {}, markReturn: () => {}, onUserPop: () => {} };
    installHistorySync(deps, hooks).dispose(); // StrictMode: mount, unmount, mount
    const mine = installHistorySync(deps, hooks);
    ledger = mine;
    seen = `${levelsKey()}#${eraNow()}`;
    return () => { mine.dispose(); ledger = null; };
  };
  b.afterTask = () => {
    const key = `${levelsKey()}#${eraNow()}`;
    if (key !== seen) { seen = key; ledger?.afterCommit(); }
    b.paint(key);
  };
  b.open(mount);
  const p: Page = {
    b,
    ledger: () => ledger!,
    i: () => (isPbEntry(b.state) ? b.state.i : -1),
    settle: () => {
      b.settle();
      for (let k = 0; k < 60 && (ledger?.inspect().pending || b.goPending); k++) b.advance(50);
    },
    aligned: () => {
      p.settle();
      const v = p.ledger().inspect();
      expect(v.pending).toBeNull();
      expect(p.i()).toBe(v.want);
      expect(v.depth).toBe(depth());
      expect(b.pushesInsidePop).toBe(0);
      expect(b.pushesWithoutActivation).toBe(0);
      expect(b.goWhilePending).toBe(0);
      expect(b.left).not.toBe('script');
    },
  };
  return p;
}

describe.each(['chromium', 'webkit'] as Engine[])('the ledger on the real levels, %s', (engine) => {
  it('opens a card with one entry and a swipe closes it', () => {
    const p = page(engine);
    p.b.tap(() => S().openPlayer('p1' as never));
    p.aligned();
    expect(p.i()).toBe(1);
    p.b.swipeBack();
    p.aligned();
    expect(S().selectedPlayer).toBeNull();
    expect(p.i()).toBe(0);
  });

  it('walks the routes back one swipe at a time, then leaves', () => {
    const p = page(engine);
    p.b.tap(() => S().go('team'));
    p.b.tap(() => S().setScreen('stats'));
    p.aligned();
    expect(p.i()).toBe(2);
    p.b.swipeBack();
    p.aligned();
    expect(route()).toBe('team|roster');
    p.b.swipeBack();
    p.aligned();
    expect(route()).toBe('home|today');
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
  });

  it('peels a sheet, a card and an overlay in the order they show, a long press of three included', () => {
    const p = page(engine);
    p.b.tap(() => S().openOverlay('inbox'));
    p.b.tap(() => S().openOverlay('schedule'));
    p.b.tap(() => S().openPlayer('p1' as never));
    p.b.tap(() => { sheet(); });
    p.aligned();
    expect(p.i()).toBe(4);
    p.b.longPressBack(3);
    p.aligned();
    expect(ids()).toEqual(['o:0:inbox']);
    expect(p.i()).toBe(1);
    p.b.swipeBack();
    p.aligned();
    expect(S().overlay).toBeNull();
  });

  it('refuses a swipe under a blocking card, refunds the entry and pushes nothing in the pop', () => {
    const p = page(engine);
    p.b.tap(() => S().openPlayer('p1' as never));
    p.b.act(() => useDynasty.setState({ bigMoment: {} as never }));
    p.aligned();
    expect(p.i()).toBe(2);
    const nudge = S().cardNudge;
    p.b.swipeBack();
    p.aligned();
    expect(S().cardNudge).toBe(nudge + 1);
    expect(ids()).toEqual(['p:p1', 'guard:card']);
    expect(p.i()).toBe(2);
    p.b.tap(() => useDynasty.setState({ bigMoment: null }));
    p.aligned();
    expect(p.i()).toBe(1);
  });

  it('takes a season game back to Today', () => {
    const p = page(engine);
    p.b.tap(() => S().go('team'));
    p.b.tap(() => useDynasty.setState({ live: {} as never, tab: 'home', screen: 'box' }));
    p.aligned();
    expect(p.i()).toBe(2);
    p.b.swipeBack();
    p.aligned();
    expect(route()).toBe('home|today');
    expect(S().live).not.toBeNull();
    expect(p.i()).toBe(1);
  });

  it("holds June's game under the dugout's sheets", () => {
    const p = page(engine);
    p.b.tap(() => useDynasty.setState({ bracket: {} as never, live: {} as never }));
    p.b.tap(() => { sheet(); });
    p.b.tap(() => { sheet(); });
    p.aligned();
    const base = p.ledger().inspect().eraBase;
    expect(p.i()).toBe(base + 3);
    p.b.swipeBack();
    p.b.swipeBack();
    p.aligned();
    expect(ids()).toEqual(['guard:june-game']);
    const nudge = S().cardNudge;
    p.b.swipeBack();
    p.aligned();
    expect(S().cardNudge).toBe(nudge + 1);
    expect(p.i()).toBe(base + 1);
  });

  it('walks the winter steps back to where the era began, with the era reset on', () => {
    setEraReset(true);
    const p = page(engine);
    p.b.tap(() => S().go('team'));
    p.b.tap(() => useDynasty.setState({ phase: 'review', furthestPhase: PHASES.length - 1 }));
    expect(S().stepBase).toBe('review');
    expect(levels()).toEqual([]);
    p.b.tap(() => useDynasty.setState({ phase: 'coach' }));
    p.b.tap(() => useDynasty.setState({ phase: 'draft' }));
    p.aligned();
    const base = p.ledger().inspect().eraBase;
    expect(p.i()).toBe(base + 2);
    p.b.swipeBack();
    p.aligned();
    expect(S().phase).toBe('coach');
    p.b.swipeBack();
    p.aligned();
    expect(S().phase).toBe('review');
    expect(depth()).toBe(0);
    // The season's route stop is another era's: once the page is quiet the
    // ledger folds back to its root, and the next swipe leaves.
    p.b.advance(1000);
    p.aligned();
    expect(p.i()).toBe(0);
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
  });
});
