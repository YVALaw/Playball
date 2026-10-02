// nav-pictures.test.ts
// V1, one push per painted frame (back plan §4 V1, 2026-09-30), end to end in
// node: the real store, nav.ts and the sheet registry, historySync.ts in the
// fake Chromium and WebKit, and a page that paints once a frame. A swipe
// previews the frame that was up when its entry was left; each scenario is a
// probe miss of the switch (S1, S4, S5, S6, S8, S11), and each checks that
// the swipe now previews what it lands on.

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

import { useDynasty, seasonPlanShowing, type DynastyStore } from '../src/state/store.js';
import { frameOf, eraKey, setEraReset } from '../src/state/era.js';
import { levels, depth, levelSig, levelsKey, eraNow, ledgerNav } from '../src/state/nav.js';
import { registerBackLayer, releaseBackLayer, resetBackLayers, localLayers } from '../src/state/backLayers.js';
import { installHistorySync, isPbEntry, type HistorySync, type Engine } from '../src/ui/historySync.js';
import { simSeason } from '../src/engine/season.js';
import { FakeBrowser, type FakeEnv } from './support/fakeBrowser.js';

const S = (): DynastyStore => useDynasty.getState();
const route = (): string => `${S().tab}|${S().screen}`;
const flush = (): Promise<void> => new Promise((r) => { setTimeout(r, 0); });

/** A sheet a screen holds itself; its dismiss unmounts it. */
function sheet(): number {
  const box = { id: 0 };
  box.id = registerBackLayer(() => releaseBackLayer(box.id));
  return box.id;
}
const isUp = (id: number): boolean => localLayers().some((l) => l.id === id);

function career(team = 0): void {
  S().start(4242, team);
  S().leaveStart();
  useDynasty.setState({ godMode: true, seasonOpener: null, bigMoment: null, playbookInvite: null });
}

/**
 * The Season plan as SeasonPlan.tsx mounts it: in the commit its state turns
 * up, kept while a room lies over it, gone once decided or with its era.
 */
class Plan {
  id: number | null = null;
  private era = '';
  sync(): void {
    const s = S();
    const keep = this.id !== null && isUp(this.id) && s.seasonPlanYear !== s.year && eraKey(s) === this.era;
    if (this.id !== null && !keep) { if (isUp(this.id)) releaseBackLayer(this.id); this.id = null; }
    if (this.id === null && seasonPlanShowing(s)) {
      this.era = eraKey(s);
      const box = { id: 0 };
      box.id = registerBackLayer(() => { S().closeSeasonPlan(); releaseBackLayer(box.id); });
      this.id = box.id;
    }
  }
}

// ---------------------------------------------------------------------------
// App, reduced to its wiring, with a page that paints once a frame
// ---------------------------------------------------------------------------

interface Page {
  b: FakeBrowser;
  plan: Plan;
  ledger(): HistorySync;
  i(): number;
  /** The level a hold starts at, as App's levelHolder would mark it. */
  held(): number | null;
  settle(): void;
  aligned(): void;
  /** One swipe back, settled: what it previewed and what is painted after. */
  swipe(): { preview: string | null; live: string };
}

/** Levels that move as the screen are never hidden (navTarget.holdTarget). */
const holdable = (id: string, kind: string): boolean => !['route', 'step', 'game', 'sp'].includes(kind) && id !== 'guard:june-game';

function page(engine: Engine): Page {
  const b = new FakeBrowser({ engine });
  const plan = new Plan();
  let ledger: HistorySync | null = null;
  let heldFrom: number | null = null;
  const hold = (from: number | null): boolean => {
    if (from === null) { heldFrom = null; return true; }
    const l = levels()[from - 1];
    heldFrom = l && holdable(l.id, l.kind) ? from : null;
    return heldFrom !== null;
  };
  const commitKey = (): string => `${levelsKey()}#${eraNow()}`;
  let seen = '';
  const mount = (env: FakeEnv): (() => void) => {
    const deps = { ...env, nav: ledgerNav, boot: 'b1', hold };
    const hooks = { pushMark: () => {}, markReturn: () => {}, onUserPop: () => {} };
    installHistorySync(deps, hooks).dispose(); // StrictMode: mount, unmount, mount
    const mine = installHistorySync(deps, hooks);
    ledger = mine;
    seen = commitKey();
    return () => { mine.dispose(); if (ledger === mine) ledger = null; };
  };
  // A commit: the plan mounts with its state, then App's layout effects.
  b.afterTask = () => {
    plan.sync();
    const k = commitKey();
    if (k !== seen) { seen = k; ledger?.afterCommit(); } else ledger?.painting();
  };
  b.painter = () => levelSig(heldFrom !== null ? heldFrom - 1 : depth());
  b.open(mount);
  const p: Page = {
    b,
    plan,
    ledger: () => ledger!,
    i: () => (isPbEntry(b.state) ? b.state.i : -1),
    held: () => heldFrom,
    settle: () => {
      b.settle();
      for (let k = 0; k < 60 && (ledger?.inspect().pending || b.goPending || heldFrom !== null); k++) b.advance(50);
      b.advance(16); // a frame paints what settled
    },
    aligned: () => {
      p.settle();
      const v = p.ledger().inspect();
      expect(v.pending).toBeNull();
      expect(v.held).toBeNull();
      expect(heldFrom, 'nothing stays hidden').toBeNull();
      expect(p.i(), 'I1').toBe(v.eraBase + depth());
      expect(b.pushesInsidePop).toBe(0);
      expect(b.pushesWithoutActivation).toBe(0);
      expect(b.goWhilePending).toBe(0);
      expect(b.flaggedPushes).toBe(0);
    },
    swipe: () => {
      b.swipeBack();
      p.settle();
      return { preview: b.preview, live: b.painted };
    },
  };
  return p;
}

async function tapAsync<T>(p: Page, run: () => Promise<T>): Promise<T> {
  let pending!: Promise<T>;
  p.b.tap(() => { pending = run(); });
  const out = await pending;
  await flush();
  p.b.act(() => {});
  return out;
}

let saveNow: DynastyStore['saveNow'];
beforeEach(() => {
  delete (globalThis as { document?: unknown }).document;
  disk.clear();
  setEraReset(true);
  resetBackLayers();
  saveNow = S().saveNow;
});
afterEach(() => {
  useDynasty.setState({ saveNow });
  resetBackLayers();
});

const ENGINES: Engine[] = ['chromium', 'webkit'];

describe('levelSig: what the page shows with the bottom d levels up', () => {
  it('is the frame under a level that opened over it', () => {
    career();
    useDynasty.setState({ seasonPlanYear: S().year });
    const home = levelSig(depth());
    S().go('team');
    expect(levelSig(0)).toBe(home); // the stop returns to Home
    const roster = levelSig(depth());
    S().openPlayer(S().season!.teams[S().userTeam]!.team.lineup[0]!.id);
    expect(depth()).toBe(2);
    expect(levelSig(1)).toBe(roster);
    expect(levelSig(2)).not.toBe(roster);
  });

  it('under the game reads as Today, which leaving it lands on', () => {
    career();
    useDynasty.setState({ seasonPlanYear: S().year });
    const today = levelSig(0);
    useDynasty.setState({ live: {} as never, screen: 'box' });
    expect(levels().map((l) => l.kind)).toEqual(['game']);
    expect(levelSig(0)).toBe(today);
    useDynasty.setState({ live: null, screen: 'today' });
  });

  it('carries the era and the day, so a new school or a week played reads as another picture', () => {
    career();
    useDynasty.setState({ seasonPlanYear: S().year });
    const before = levelSig(0);
    S().season!.dayIndex += 1;
    expect(levelSig(0)).not.toBe(before);
    S().season!.dayIndex -= 1;
    expect(levelSig(0)).toBe(before);
    useDynasty.setState({ userTeam: 5 });
    expect(levelSig(0)).not.toBe(before);
  });

  it('below the bottom reads as the bottom, never a throw', () => {
    career();
    useDynasty.setState({ seasonPlanYear: S().year });
    expect(levelSig(-1)).toBe(levelSig(0));
  });
});

describe.each(ENGINES)('pictures in the real app on %s', (engine) => {
  it('S1: the plan a new career opens with is held over its Home, so back previews that Home, never Start', () => {
    career();
    S().backToStart();
    const p = page(engine);
    expect(frameOf(S())).toBe('front');
    p.b.advance(100);
    const start = p.b.painted;
    p.b.tap(() => { S().start(4242, 3); S().leaveStart(); });
    expect(p.plan.id).not.toBeNull();
    expect(p.held()).toBe(1); // the plan waits, hidden, for Home to paint
    p.aligned();
    expect(p.i()).toBe(1);
    const s = p.swipe();
    expect(isUp(p.plan.id ?? -1)).toBe(false);
    expect(s.preview).not.toBe(start);
    expect(s.preview).toBe(s.live);
    p.aligned();
  });

  it('S6: taking a job from the jobs overlay, the new chair\'s plan previews its Home, not the old Board', async () => {
    career();
    useDynasty.setState({ seasonPlanYear: S().year });
    const to = 7;
    const rec = S().season!.teams[to]!;
    useDynasty.setState({
      offers: [{ team: to, school: rec.def.school, conference: rec.conference, prestige: rec.prestige, pitch: 'Come and build it.' }],
    });
    const p = page(engine);
    p.b.tap(() => S().go('office', 'board'));
    p.b.advance(100);
    p.b.tap(() => S().openOverlay('jobs'));
    p.aligned();
    const board = p.b.painted;
    await tapAsync(p, () => S().acceptOffer(to));
    expect(S().userTeam).toBe(to);
    expect(p.plan.id).not.toBeNull();
    p.aligned();
    expect(p.i()).toBe(3);
    const s = p.swipe();
    expect(s.preview).not.toBe(board);
    expect(s.preview).toBe(s.live);
    expect(route()).toBe('home|today');
  });

  it('S8: Resume with the plan owed: held over the loaded Home, never previewing Start', async () => {
    career(3);
    useDynasty.setState({ seasonPlanYear: null });
    const slot = S().loadedSlot!;
    expect(await S().saveNow()).toBe(true);
    S().backToStart();
    await flush();
    const p = page(engine);
    p.b.advance(100);
    const start = p.b.painted;
    expect(await tapAsync(p, () => S().loadSlot(slot))).toBe(true);
    expect(frameOf(S())).toBe('season');
    expect(p.plan.id).not.toBeNull();
    p.aligned();
    expect(p.i()).toBe(1);
    const s = p.swipe();
    expect(s.preview).not.toBe(start);
    expect(s.preview).toBe(s.live);
  });

  it('S11: Hire one opens the room and its sheet in one tap; each entry previews its own level', () => {
    career();
    const p = page(engine);
    expect(p.plan.id).not.toBeNull(); // the plan, up on day one
    p.b.tap();
    p.aligned();
    expect(p.i()).toBe(1);
    p.b.advance(100);
    let seat = 0;
    p.b.tap(() => { S().openOverlay('staff'); seat = sheet(); });
    expect(p.b.pushes).toBe(2); // the room's entry at once, over the plan's painted frame
    expect(p.held()).toBe(3); // the seat waits for the room
    p.aligned();
    expect(p.i()).toBe(3);
    let s = p.swipe();
    expect(isUp(seat)).toBe(false);
    expect(s.preview).toBe(s.live);
    s = p.swipe();
    expect(S().overlay).toBeNull();
    expect(s.preview).toBe(s.live);
  });

  it('S4: the June seed dialog, a commit after June itself, previews June\'s Home', () => {
    career();
    useDynasty.setState({ seasonPlanYear: S().year });
    simSeason(S().season!);
    const p = page(engine);
    p.b.tap(() => S().go('team'));
    p.aligned();
    const april = p.b.painted;
    let seeds = 0;
    p.b.tap(() => { void S().playPostseason(); });
    expect(frameOf(S())).toBe('june');
    p.b.act(() => { seeds = sheet(); }); // before any frame
    expect(p.held()).toBe(1);
    p.aligned();
    const s = p.swipe();
    expect(isUp(seeds)).toBe(false);
    expect(s.preview).not.toBe(april);
    expect(s.preview).toBe(s.live);
  });

  it('S5: the terms card that rolls in with the year: the refused swipe shows the new season under it', () => {
    career();
    useDynasty.setState({ seasonPlanYear: S().year + 1 });
    const p = page(engine);
    p.b.tap(() => S().go('team'));
    p.aligned();
    const lastYear = p.b.painted;
    const opener = { year: S().year + 1 } as unknown as DynastyStore['seasonOpener'];
    p.b.tap(() => useDynasty.setState({ year: S().year + 1, seasonOpener: opener }));
    expect(levels().map((l) => l.id)).toEqual(['guard:card']);
    expect(p.held()).toBe(1);
    p.aligned();
    const nudge = S().cardNudge;
    const s = p.swipe();
    expect(S().cardNudge).toBe(nudge + 1); // refused, and the card shakes
    expect(s.preview).not.toBe(lastYear);
    expect(s.preview).toBe(levelSig(0)); // the new season's Home, under the card (§6.4)
    p.aligned();
    useDynasty.setState({ seasonOpener: null });
  });

  it('C4c: the plan that follows the terms takes the card\'s place, no push, and previews the new Home', () => {
    career();
    useDynasty.setState({ seasonPlanYear: S().year, saveNow: async () => true }); // owed once the year rolls
    const p = page(engine);
    p.b.tap(() => S().go('team'));
    p.aligned();
    const opener = { year: S().year + 1 } as unknown as DynastyStore['seasonOpener'];
    p.b.tap(() => useDynasty.setState({ year: S().year + 1, seasonOpener: opener }));
    p.aligned();
    p.b.advance(100);
    const card = p.b.painted;
    const [d0, pushes] = [depth(), p.b.pushes];
    p.b.tap(() => S().dismissSeasonOpener());
    expect(p.plan.id).not.toBeNull();
    expect(depth()).toBe(d0);
    expect(p.b.pushes).toBe(pushes);
    p.aligned();
    const s = p.swipe();
    expect(isUp(p.plan.id ?? -1)).toBe(false);
    expect(s.preview).not.toBe(card);
    expect(s.preview).toBe(s.live);
    expect(s.preview).toBe(levelSig(0));
  });

  it('the injury card after a day played: the day paints before the card\'s entry is pushed', () => {
    career();
    useDynasty.setState({ seasonPlanYear: S().year });
    const p = page(engine);
    p.b.advance(100);
    const before = p.b.painted;
    let card = 0;
    p.b.tap(() => { S().season!.dayIndex += 1; useDynasty.setState({ version: S().version + 1 }); card = sheet(); });
    expect(p.held()).toBe(1);
    p.aligned();
    const s = p.swipe();
    expect(isUp(card)).toBe(false);
    expect(s.preview).not.toBe(before);
    expect(s.preview).toBe(s.live);
  });

  it('the injury card after a June night: the bracket paints before the card\'s entry is pushed', async () => {
    career();
    useDynasty.setState({ seasonPlanYear: S().year });
    simSeason(S().season!);
    const p = page(engine);
    await tapAsync(p, () => S().playPostseason());
    expect(frameOf(S())).toBe('june');
    expect(S().myBracket).not.toBeNull();
    p.aligned();
    p.b.advance(100);
    const before = p.b.painted;
    let card = 0;
    p.b.tap(() => { S().simBracket('game'); card = sheet(); }); // WeekStopped mounts with the night's results
    expect(levelSig(0)).not.toBe(before); // a night played is another picture, though dayIndex stands
    expect(p.held()).toBe(1);
    p.aligned();
    const s = p.swipe();
    expect(isUp(card)).toBe(false);
    expect(s.preview).not.toBe(before);
    expect(s.preview).toBe(s.live);
  });

  // WebKit only: its 9 s rule is what leaves the card's push owed.
  it.runIf(engine === 'webkit')('a push owed from under the era base pays without reading a level below the bottom', () => {
    career();
    useDynasty.setState({ seasonPlanYear: S().year });
    const p = page(engine);
    p.b.tap(() => S().go('team'));
    p.aligned();
    expect(p.i()).toBe(1);
    p.b.advance(12_000); // past the tap
    p.b.act(() => useDynasty.setState({ userTeam: (S().userTeam + 1) % S().season!.teams.length }));
    expect(p.ledger().inspect().eraBase).toBe(1);
    p.b.act(() => useDynasty.setState({ bigMoment: { kind: 'title' } as never }));
    expect(levels().map((l) => l.id)).toEqual(['guard:card']);
    p.settle();
    expect(p.ledger().inspect().owed).toBe(true); // no tap since the era came
    p.b.swipeBack(); // to entry 0, under the era; the card refuses
    p.settle();
    expect(p.i()).toBe(0);
    expect(depth()).toBe(1);
    expect(() => p.b.tap()).not.toThrow();
    expect(() => p.b.tap(() => useDynasty.setState({ bigMoment: null }))).not.toThrow();
    p.aligned();
  });
});

// V2: a top level replaced in place, the entry under it reshot (back plan §4 V2).
describe.each(ENGINES)('reshoot in the real app on %s', (engine) => {
  it('S5 P1.4B: signing after a refused swipe, the plan takes the card\'s entry and back previews the new Home, not the card', () => {
    career();
    useDynasty.setState({ seasonPlanYear: S().year, saveNow: async () => true }); // owed once the year rolls
    const p = page(engine);
    p.b.tap(() => S().go('team'));
    p.aligned();
    const opener = { year: S().year + 1 } as unknown as DynastyStore['seasonOpener'];
    p.b.tap(() => useDynasty.setState({ year: S().year + 1, seasonOpener: opener }));
    p.aligned();
    p.b.swipeBack(); // refused: the card shakes, and the entry under it is left with the card up
    p.settle();
    expect(levels().map((l) => l.id)).toEqual(['guard:card']);
    p.aligned();
    p.b.advance(100);
    const card = p.b.painted;
    const [pushes, gos] = [p.b.pushes, p.b.goCalls];
    p.b.tap(() => S().dismissSeasonOpener());
    expect(p.plan.id).not.toBeNull();
    expect(p.held()).toBe(1); // the plan waits, hidden, while the entry under it is retaken
    expect(p.ledger().inspect().reshoot).toBe('down');
    p.aligned();
    expect(p.b.pushes).toBe(pushes);
    expect(p.b.goCalls).toBe(gos + 2);
    const s = p.swipe();
    expect(isUp(p.plan.id ?? -1)).toBe(false);
    expect(s.preview).not.toBe(card);
    expect(s.preview).toBe(s.live);
    expect(s.preview).toBe(levelSig(0));
  });

  it('C4d: Record the game with a man hurt: the injury card takes the game\'s entry, reshot over the new day\'s Today', () => {
    career();
    useDynasty.setState({ seasonPlanYear: S().year });
    const p = page(engine);
    p.b.advance(100);
    p.b.tap(() => useDynasty.setState({ live: {} as never, screen: 'box' })); // Play ball
    expect(levels().map((l) => l.kind)).toEqual(['game']);
    p.aligned();
    p.b.advance(100);
    const yesterday = levelSig(0);
    let card = 0;
    p.b.tap(() => {
      useDynasty.setState({ live: null, screen: 'today' });
      S().season!.dayIndex += 1;
      useDynasty.setState({ version: S().version + 1 });
      card = sheet(); // WeekStopped, in the same commit
    });
    expect(depth()).toBe(1);
    expect(p.ledger().inspect().reshoot).toBe('down');
    p.aligned();
    const s = p.swipe();
    expect(isUp(card)).toBe(false);
    expect(s.preview).not.toBe(yesterday);
    expect(s.preview).toBe(s.live);
  });
});
