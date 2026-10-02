// nav-integration.test.ts
// The switch (back plan SW, 2026-09-30), end to end in node: the real store,
// nav.ts's one list of levels, the sheet registry and historySync.ts's ledger,
// in the fake Chromium and WebKit of tests/support/fakeBrowser.ts, wired the
// way App wires them. The ledger is installed StrictMode-style when the page
// boots, and its afterCommit runs after every commit that changes the levels'
// key or the era (App's `useLayoutEffect(..., [key, era])`).
//
// Every settle asserts I1: nothing in flight, the entry on screen is the era's
// base plus the depth, and no push came inside a pop or without a tap.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The saves, in memory (the seam `saves.test.ts` uses): the career paths
 * below save, load and leave for real.
 */
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

import { useDynasty, PHASES, railSteps, lineupHolds, blockingCardUp, resignTerms, type DynastyStore } from '../src/state/store.js';
import { frameOf, setEraReset } from '../src/state/era.js';
import { levels, depth, newest, levelsKey, eraNow, ledgerNav, type Level, type LevelKind } from '../src/state/nav.js';
import { registerBackLayer, releaseBackLayer, resetBackLayers, localLayers } from '../src/state/backLayers.js';
import { installHistorySync, isPbEntry, type HistorySync, type Engine, type UserPop } from '../src/ui/historySync.js';
import { movesScreen, toTarget, type TargetQuery } from '../src/ui/navTarget.js';
import { simSeason } from '../src/engine/season.js';
import type { PlayerId } from '../src/engine/types.js';
import { FakeBrowser, type FakeEnv } from './support/fakeBrowser.js';

const S = (): DynastyStore => useDynasty.getState();
const ids = (): string[] => levels().map((l) => l.id);
const route = (): string => `${S().tab}|${S().screen}`;
const pid = (): PlayerId => S().season!.teams[S().userTeam]!.team.lineup[0]!.id;
/** Promises the store left running (a save it did not wait for). */
const flush = (): Promise<void> => new Promise((r) => { setTimeout(r, 0); });

/** A sheet a screen holds itself; its dismiss unmounts it, as a real one's does. */
function sheet(): number {
  const box = { id: 0 };
  box.id = registerBackLayer(() => releaseBackLayer(box.id));
  return box.id;
}
const isUp = (id: number): boolean => localLayers().some((l) => l.id === id);

/** A nine with one position twice, which the lineup gate holds. */
function breakTheNine(): void {
  const nine = S().season!.teams[S().userTeam]!.team.lineup;
  nine[1]!.pos = nine[0]!.pos;
}

/** A career on the front door's far side: started, off Start, nothing over it. */
function career(team = 0): void {
  S().start(4242, team);
  S().leaveStart();
  useDynasty.setState({ godMode: true, seasonOpener: null, bigMoment: null, playbookInvite: null });
}

/**
 * The New career wizard as S2 built it: an exit level first, then one level
 * per finished step, each taking the wizard back to its step when peeled.
 */
class Wizard {
  step = 0;
  mounted = false;
  private exit = 0;
  private done: number[] = [];
  mount(): void {
    this.mounted = true;
    this.step = 0;
    this.exit = registerBackLayer(() => { S().backToStart(); this.unmount(); });
  }
  next(): void {
    const at = this.step;
    this.done.push(registerBackLayer(() => this.setStep(at)));
    this.step += 1;
  }
  setStep(i: number): void {
    while (this.done.length > i) releaseBackLayer(this.done.pop()!);
    this.step = i;
  }
  unmount(): void {
    this.setStep(0);
    releaseBackLayer(this.exit);
    this.mounted = false;
  }
}

// ---------------------------------------------------------------------------
// App, reduced to its wiring
// ---------------------------------------------------------------------------

interface Page {
  b: FakeBrowser;
  pops: UserPop[];
  ledger(): HistorySync;
  /** The entry on screen, by the index it carries. */
  i(): number;
  settle(): void;
  /** Settle, then I1 and the browser's fault counters. */
  aligned(): void;
}

function page(engine: Engine, opts: { navigationApi?: boolean } = {}): Page {
  const b = new FakeBrowser({ engine, navigationApi: opts.navigationApi });
  const pops: UserPop[] = [];
  let ledger: HistorySync | null = null;
  const commitKey = (): string => `${levelsKey()}#${eraNow()}`;
  let seen = '';
  const mount = (env: FakeEnv): (() => void) => {
    const deps = { ...env, nav: ledgerNav, boot: 'b1', dev: true };
    const hooks = { pushMark: () => {}, markReturn: () => {}, onUserPop: (pop: UserPop) => { pops.push(pop); } };
    installHistorySync(deps, hooks).dispose(); // StrictMode: mount, unmount, mount
    const mine = installHistorySync(deps, hooks);
    ledger = mine;
    seen = commitKey();
    return () => { mine.dispose(); if (ledger === mine) ledger = null; };
  };
  // App's layout effect: after a commit that moved the levels' key or the era.
  b.afterTask = () => {
    const k = commitKey();
    if (k !== seen) { seen = k; ledger?.afterCommit(); }
    b.paint(`${route()}|${S().phase}|${k}`);
  };
  b.open(mount);
  const p: Page = {
    b,
    pops,
    ledger: () => ledger!,
    i: () => (isPbEntry(b.state) ? b.state.i : -1),
    settle: () => {
      b.settle();
      for (let k = 0; k < 60 && (ledger?.inspect().pending || b.goPending); k++) b.advance(50);
    },
    aligned: () => {
      p.settle();
      const v = p.ledger().inspect();
      expect(v.pending, 'a traversal still in flight').toBeNull();
      expect(v.depth).toBe(depth());
      expect(v.want).toBe(v.eraBase + depth());
      expect(p.i(), 'I1: the entry on screen is the era base plus the depth').toBe(v.eraBase + depth());
      expect(b.pushesInsidePop, 'a push inside a pop').toBe(0);
      expect(b.pushesWithoutActivation, 'a push without a tap').toBe(0);
      expect(b.goWhilePending, 'two traversals at once').toBe(0);
      expect(b.flaggedPushes).toBe(0);
      expect(b.left).not.toBe('script');
    },
  };
  return p;
}

/** A tap that starts something the store finishes later; React commits what lands. */
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
  // On by default since the switch; `the era reset is on by default` pins it.
  setEraReset(true);
  resetBackLayers();
  saveNow = S().saveNow;
});
afterEach(() => {
  useDynasty.setState({ saveNow });
  setEraReset(true);
  resetBackLayers();
});

const ENGINES: Engine[] = ['chromium', 'webkit'];

// ---------------------------------------------------------------------------
// The scenarios
// ---------------------------------------------------------------------------

describe.each(ENGINES)('the switch on %s', (engine) => {
  it('opens and closes a card, a sheet and an overlay by their own controls and by a swipe', () => {
    career();
    const p = page(engine);
    p.aligned();
    expect(p.i()).toBe(0);
    expect(depth()).toBe(0); // the APK is disarmed: back at Home leaves

    // A player card: its own close gives the entry back, and so does a swipe.
    p.b.tap(() => S().openPlayer(pid()));
    p.aligned();
    expect(p.i()).toBe(1);
    p.b.tap(() => S().closePlayer());
    p.aligned();
    expect(p.i()).toBe(0);
    p.b.tap(() => S().openPlayer(pid()));
    p.aligned();
    p.b.swipeBack();
    p.aligned();
    expect(S().selectedPlayer).toBeNull();
    expect(p.i()).toBe(0);

    // A sheet the screen holds.
    let held = 0;
    p.b.tap(() => { held = sheet(); });
    p.aligned();
    expect(p.i()).toBe(1);
    p.b.tap(() => releaseBackLayer(held));
    p.aligned();
    expect(p.i()).toBe(0);
    p.b.tap(() => { held = sheet(); });
    p.aligned();
    p.b.swipeBack();
    p.aligned();
    expect(isUp(held)).toBe(false);
    expect(p.i()).toBe(0);

    // An overlay with a page of its own: back goes to the page's index first.
    p.b.tap(() => S().openOverlay('settings'));
    p.b.tap(() => S().setSettingsPage('display'));
    p.aligned();
    expect(ids()).toEqual(['o:0:settings', 'sp:display']);
    expect(p.i()).toBe(2);
    p.b.swipeBack();
    p.aligned();
    expect(S().overlay).toBe('settings');
    expect(S().settingsPage).toBe('index');
    expect(p.i()).toBe(1);
    p.b.tap(() => S().closeOverlay());
    p.aligned();
    expect(p.i()).toBe(0);

    // A letter, the school it names, a player on that school's page: one entry each.
    p.b.tap(() => S().openOverlay('inbox'));
    p.b.tap(() => S().openTeamCard(5));
    p.b.tap(() => S().openPlayer(pid()));
    p.aligned();
    expect(ids()).toEqual(['o:0:inbox', 't:5', `p:${pid()}`]);
    expect(p.i()).toBe(3);
    p.b.swipeBack();
    p.aligned();
    expect(S().selectedPlayer).toBeNull();
    expect(S().teamCard).toBe(5);
    p.b.swipeBack();
    p.aligned();
    expect(S().teamCard).toBeNull();
    expect(S().overlay).toBe('inbox');
    p.b.swipeBack();
    p.aligned();
    expect(S().overlay).toBeNull();
    expect(p.i()).toBe(0);
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
  });

  it('closes the team card on a move and gives its entry to the route', () => {
    career();
    const p = page(engine);
    p.b.tap(() => S().openTeamCard(4));
    p.aligned();
    expect(p.i()).toBe(1);
    const pushes = p.b.pushes;
    const gos = p.b.goCalls;
    p.b.tap(() => S().go('team'));
    p.aligned();
    expect(S().teamCard).toBeNull();
    expect(ids()).toHaveLength(1);
    expect(newest()?.kind).toBe('route');
    expect(p.i()).toBe(1);
    expect(p.b.pushes).toBe(pushes);
    expect(p.b.goCalls).toBe(gos);
    p.b.swipeBack();
    p.aligned();
    expect(route()).toBe('home|today');
    expect(S().teamCard).toBeNull();
  });

  it('walks the routes it took, back to the visits it left, and leaves at the root', () => {
    career();
    const p = page(engine);
    const home = S().routeVisit;
    p.b.tap(() => S().go('team'));
    const roster = S().routeVisit;
    p.b.tap(() => S().setScreen('stats'));
    p.b.tap(() => S().go('program', 'history'));
    p.aligned();
    expect(p.i()).toBe(3);
    p.b.swipeBack();
    p.aligned();
    expect(route()).toBe('team|stats');
    // App's rule for the kept screen and its scroll: a back move returned to this visit.
    expect(S().restoringVisit).toBe(S().routeVisit);
    p.b.swipeBack();
    p.aligned();
    expect(route()).toBe('team|roster');
    expect(S().routeVisit).toBe(roster);
    p.b.swipeBack();
    p.aligned();
    expect(route()).toBe('home|today');
    expect(S().routeVisit).toBe(home);
    expect(p.i()).toBe(0);
    // A tap forward takes a fresh visit: the screen opens as new.
    p.b.tap(() => S().go('office'));
    p.aligned();
    expect(S().restoringVisit).toBeNull();
    p.b.swipeBack();
    p.aligned();
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
  });

  it('a card open when the route moves hands its entry to the route', () => {
    career();
    const p = page(engine);
    p.b.tap(() => S().go('team'));
    p.b.tap(() => S().openPlayer(pid()));
    p.aligned();
    expect(p.i()).toBe(2);
    const pushes = p.b.pushes;
    const gos = p.b.goCalls;
    p.b.tap(() => S().go('program'));
    p.aligned();
    expect(p.i()).toBe(2);
    expect(p.b.pushes).toBe(pushes);
    expect(p.b.goCalls).toBe(gos);
    p.b.swipeBack();
    p.aligned();
    expect(route()).toBe('team|roster');
    expect(S().selectedPlayer).toBeNull();
  });

  it('refuses a swipe off a broken lineup: the card shakes, the entry comes back, no push in the pop', () => {
    career();
    const p = page(engine);
    p.b.tap(() => S().go('team', 'lineup'));
    p.aligned();
    expect(p.i()).toBe(1);
    breakTheNine();
    const nudge = S().cardNudge;
    const gate = S().lineupGate;
    p.b.swipeBack();
    p.aligned();
    expect(route()).toBe('team|lineup');
    expect(S().cardNudge).toBe(nudge + 1);
    expect(S().lineupGate).toBe(gate); // no modal mounts during a pop
    expect(p.i()).toBe(1);
    // What Lineup's nudge effect reads: the refusal is the card's, not a blocking card's.
    expect(lineupHolds(S())).toBe(true);
    expect(blockingCardUp(S())).toBe(false);
  });

  it('takes a season game back to Today, and the game waits', async () => {
    career();
    const p = page(engine);
    p.b.tap(() => S().go('team'));
    p.b.tap(() => S().go('home'));
    p.aligned();
    expect(p.i()).toBe(2);
    // PLAY BALL: the game is a level over the route, not a stop.
    await tapAsync(p, () => S().startManagedGame());
    p.aligned();
    expect(S().screen).toBe('box');
    expect(S().live).not.toBeNull();
    expect(newest()?.id).toBe('game');
    expect(p.i()).toBe(3);
    p.b.swipeBack();
    p.aligned();
    expect(route()).toBe('home|today');
    expect(S().live).not.toBeNull();
    expect(p.i()).toBe(2);
    // PLAY BALL again is the way back to the game in progress.
    await tapAsync(p, () => S().startManagedGame());
    p.aligned();
    expect(S().screen).toBe('box');
    expect(p.i()).toBe(3);
    // Recorded: the game goes, and its entry with it.
    S().live!.finish();
    await tapAsync(p, () => S().endManagedGame());
    p.aligned();
    expect(S().live).toBeNull();
    expect(route()).toBe('home|today');
    // A walk-off's card is a guard over the day, answered on its own terms.
    if (S().bigMoment !== null) {
      expect(newest()?.kind).toBe('guard');
      p.b.tap(() => S().clearBigMoment());
      p.aligned();
    }
    expect(p.i()).toBe(2);
    // The routes before the game are still there to walk.
    p.b.swipeBack();
    p.aligned();
    expect(route()).toBe('team|roster');
  });

  it('June: the seed dialog, the tab stops, and the game held under the dugout sheets', () => {
    career();
    simSeason(S().season!);
    const p = page(engine);
    p.b.tap(() => S().go('team'));
    p.aligned();
    expect(p.i()).toBe(1);
    // "Postseason": June is an era of its own, opened on its Home, with none of April's stops.
    p.b.tap(() => { void S().playPostseason(); });
    p.aligned();
    expect(frameOf(S())).toBe('june');
    expect(route()).toBe('home|today');
    expect(levels()).toEqual([]);
    const base = p.ledger().inspect().eraBase;
    expect(base).toBe(1);
    // The seeds, told once, in a dialog that mounts after June's first commit.
    let seeds = 0;
    p.b.act(() => { seeds = sheet(); });
    p.aligned();
    expect(p.i()).toBe(base + 1);
    p.b.tap(() => releaseBackLayer(seeds));
    p.aligned();
    expect(p.i()).toBe(base);
    // A tab in June is a stop like any other.
    p.b.tap(() => S().go('team'));
    p.aligned();
    expect(p.i()).toBe(base + 1);
    p.b.swipeBack();
    p.aligned();
    expect(route()).toBe('home|today');
    // A June game is played to its end: a guard, under the dugout's sheets.
    p.b.tap(() => useDynasty.setState({ live: {} as never }));
    p.aligned();
    expect(ids()).toEqual(['guard:june-game']);
    expect(p.i()).toBe(base + 1);
    let dugout = 0;
    let picker = 0;
    p.b.tap(() => { dugout = sheet(); });
    p.b.tap(() => { picker = sheet(); });
    p.aligned();
    expect(p.i()).toBe(base + 3);
    p.b.swipeBack();
    p.aligned();
    expect(isUp(picker)).toBe(false);
    expect(isUp(dugout)).toBe(true);
    p.b.swipeBack();
    p.aligned();
    expect(isUp(dugout)).toBe(false);
    const nudge = S().cardNudge;
    p.b.swipeBack();
    p.aligned();
    expect(S().cardNudge).toBe(nudge + 1);
    expect(ids()).toEqual(['guard:june-game']);
    expect(p.i()).toBe(base + 1);
    // The game over: the guard goes, and its entry with it.
    p.b.tap(() => useDynasty.setState({ live: null }));
    p.aligned();
    expect(p.i()).toBe(base);
    // Quiet at June's root: the ledger folds to its root, and the next swipe leaves.
    p.b.advance(1000);
    p.aligned();
    expect(p.i()).toBe(0);
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
  }, 30_000);

  it('the offseason steps back to Awards, and then leaves', () => {
    career();
    const p = page(engine);
    p.b.tap(() => S().go('team')); // April's stop: another era's by the winter
    p.aligned();
    // "End the season": Awards, a new era whose first step is its base.
    p.b.tap(() => useDynasty.setState({ phase: 'awards', furthestPhase: PHASES.length - 1 }));
    p.aligned();
    expect(frameOf(S())).toBe('winter');
    expect(S().stepBase).toBe('awards');
    expect(levels()).toEqual([]);
    const base = p.ledger().inspect().eraBase;
    const rail = railSteps(S());
    expect(rail[0]).toBe('awards');
    // Continue three times (rail taps forward): each step is a level.
    for (const step of rail.slice(1, 4)) p.b.tap(() => S().goPhase(step));
    p.aligned();
    expect(S().phase).toBe(rail[3]);
    expect(ids()).toEqual(rail.slice(1, 4).map((s) => `st:${s}`));
    expect(p.i()).toBe(base + 3);
    // The inbox from the header is a level over the step, not a step.
    p.b.tap(() => S().openOverlay('inbox'));
    p.aligned();
    p.b.swipeBack();
    p.aligned();
    expect(S().overlay).toBeNull();
    expect(S().phase).toBe(rail[3]);
    // A rail tap two steps back gives two entries back: steps are derived.
    p.b.tap(() => S().goPhase(rail[1]!));
    p.aligned();
    expect(p.i()).toBe(base + 1);
    p.b.swipeBack();
    p.aligned();
    expect(S().phase).toBe('awards');
    expect(depth()).toBe(0);
    // Awards is the era's root: once quiet the ledger folds to 0, and back leaves.
    p.b.advance(1000);
    p.aligned();
    expect(p.i()).toBe(0);
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
  });

  it('taking a job from the jobs overlay closes it in the same write, and back never walks the old school', async () => {
    career();
    const to = 7;
    const rec = S().season!.teams[to]!;
    useDynasty.setState({
      offers: [{ team: to, school: rec.def.school, conference: rec.conference, prestige: rec.prestige, pitch: 'Come and build it.' }],
    });
    const p = page(engine);
    p.b.tap(() => S().go('office', 'board'));
    p.b.tap(() => S().openOverlay('jobs'));
    p.b.tap(() => S().openTeamCard(to)); // the school's page, from its offer
    p.aligned();
    expect(p.i()).toBe(3);
    p.b.tap(() => S().closeTeamCard());
    p.aligned();
    expect(p.i()).toBe(2);
    await tapAsync(p, () => S().acceptOffer(to));
    p.aligned();
    expect(S().userTeam).toBe(to);
    expect(S().overlay).toBeNull();
    expect(route()).toBe('home|today');
    expect(levels()).toEqual([]);
    expect(p.ledger().inspect().eraBase).toBe(2);
    // No tap at the new school: Accept was the era's tap, so it folds to the
    // root once quiet, and the first swipe leaves instead of showing the old
    // school's Board under the jobs overlay (§6.1).
    p.b.advance(1200);
    p.aligned();
    expect(p.i()).toBe(0);
    expect(p.b.painted).toContain('home|today');
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
    expect(S().userTeam).toBe(to);
  });

  it('loading from Start: the saves overlay goes with the load, and back at Home leaves', async () => {
    career(3);
    const slot = S().loadedSlot!;
    expect(await S().saveNow()).toBe(true);
    S().backToStart();
    await flush();
    const p = page(engine);
    expect(frameOf(S())).toBe('front');
    p.aligned();
    expect(p.i()).toBe(0);
    p.b.tap(() => S().openOverlay('saves')); // Start's "Load"
    p.aligned();
    expect(p.i()).toBe(1);
    expect(await tapAsync(p, () => S().loadSlot(slot))).toBe(true);
    p.aligned();
    expect(frameOf(S())).toBe('season');
    expect(S().userTeam).toBe(3);
    expect(S().overlay).toBeNull();
    expect(route()).toBe('home|today');
    expect(levels()).toEqual([]);
    expect(p.i()).toBe(1);
    // Quiet, with no tap in the career (Load was its tap): the ledger folds to
    // its root, so back at its Home leaves the page instead of returning to Start.
    p.b.advance(1200);
    p.aligned();
    expect(p.i()).toBe(0);
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
    expect(S().atStart).toBe(false);
  });

  it('Save and leave: Start never walks back into the career it left', async () => {
    career();
    const p = page(engine);
    p.b.tap(() => S().go('team'));
    p.b.tap(() => S().openOverlay('settings'));
    p.aligned();
    expect(p.i()).toBe(2);
    await tapAsync(p, () => S().saveNow().then(() => S().backToStart()));
    p.aligned();
    expect(frameOf(S())).toBe('front');
    expect(S().atStart).toBe(true);
    expect(S().overlay).toBeNull();
    expect(levels()).toEqual([]);
    expect(p.i()).toBe(2);
    p.b.swipeBack();
    p.aligned();
    expect(S().atStart).toBe(true);
    expect(S().season).toBeNull();
    expect(p.i()).toBe(0);
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
  });

  // What the probe's S15 now tags as a leave (SW probe round 1): "Resign now"
  // on the graded season's profile opens the job market, an era of its own
  // with nothing of the winter under it (plan §6.1).
  it('resigning once the season is graded: the market is its own era, and its first swipe leaves', async () => {
    career();
    S().settleSeason();
    const p = page(engine);
    p.b.tap(() => useDynasty.setState({ phase: 'review', furthestPhase: PHASES.indexOf('review') }));
    p.aligned();
    expect(frameOf(S())).toBe('winter');
    expect(resignTerms(S())?.when).toBe('now');
    // The coach's profile, where the button is: a level over the step.
    p.b.tap(() => S().openOverlay('coach'));
    p.aligned();
    const base = p.ledger().inspect().eraBase;
    expect(p.i()).toBe(base + 1);
    await tapAsync(p, () => S().resign()); // "Tap again": leaves today
    p.aligned();
    expect(frameOf(S())).toBe('market');
    expect(S().overlay).toBeNull();
    expect(levels()).toEqual([]);
    // That tap was the market's own: once quiet the ledger folds to its root.
    p.b.advance(1200);
    p.aligned();
    expect(p.i()).toBe(0);
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
    expect(S().jobSearch).toBe(true);
  }, 30_000);

  it('New career: back walks the steps to Start, and taking the job starts a fresh era', async () => {
    S().backToStart();
    await flush();
    const p = page(engine);
    const wiz = new Wizard();
    const newCareer = (): void => { S().leaveStart(); useDynasty.setState({ needsTeam: true }); wiz.mount(); };
    p.b.tap(newCareer);
    p.b.tap(() => wiz.next());
    p.b.tap(() => wiz.next());
    p.aligned();
    expect(frameOf(S())).toBe('front');
    expect(p.i()).toBe(3);
    p.b.swipeBack();
    p.aligned();
    expect(wiz.step).toBe(1);
    p.b.swipeBack();
    p.aligned();
    expect(wiz.step).toBe(0);
    p.b.swipeBack();
    p.aligned();
    expect(wiz.mounted).toBe(false);
    expect(S().atStart).toBe(true);
    expect(p.i()).toBe(0);
    // Again, to the last step, and take the job: the wizard goes in the same commit.
    p.b.tap(newCareer);
    p.b.tap(() => wiz.next());
    p.b.tap(() => wiz.next());
    p.aligned();
    expect(p.i()).toBe(3);
    p.b.tap(() => { S().start(4242, 2); wiz.unmount(); });
    await flush();
    p.aligned();
    expect(frameOf(S())).toBe('season');
    expect(S().userTeam).toBe(2);
    expect(levels()).toEqual([]);
    expect(p.i()).toBe(3);
    p.b.advance(1200); // no tap at the new school: "Take the job" was the era's tap
    p.aligned();
    expect(p.i()).toBe(0);
    p.b.swipeBack();
    expect(p.b.left).toBe('user');
  });

  it('Settings to god mode hands the entry over, and CLOSE ALL gives three back in one step', () => {
    career();
    const p = page(engine);
    p.b.tap(() => S().openOverlay('settings'));
    p.aligned();
    expect(p.i()).toBe(1);
    const gos = p.b.goCalls;
    // "Open god mode" on Settings: the overlay closes, the sheet opens, one tap.
    p.b.tap(() => { S().closeOverlay(); S().openGod({ kind: 'tab', tab: 'program' }); });
    p.aligned();
    expect(ids()).toEqual(['g:0']);
    expect(p.i()).toBe(1);
    expect(p.b.goCalls).toBe(gos);
    p.b.tap(() => S().openGod({ kind: 'time' }));
    p.b.tap(() => S().openGod({ kind: 'player', id: pid() }));
    p.aligned();
    expect(p.i()).toBe(3);
    p.b.tap(() => S().closeGodAll());
    p.aligned();
    expect(p.i()).toBe(0);
    expect(p.b.goCalls).toBe(gos + 1);
  });

  it('refuses a swipe under a blocking card and refunds it; the APK stays armed for the shake', () => {
    career();
    const p = page(engine);
    p.b.act(() => useDynasty.setState({ bigMoment: {} as never }));
    p.b.tap();
    p.aligned();
    expect(ids()).toEqual(['guard:card']);
    expect(depth()).toBeGreaterThan(0);
    expect(p.i()).toBe(1);
    const nudge = S().cardNudge;
    p.b.swipeBack();
    p.aligned();
    expect(S().cardNudge).toBe(nudge + 1);
    expect(p.i()).toBe(1);
    p.b.tap(() => S().clearBigMoment());
    p.aligned();
    expect(p.i()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The wiring itself
// ---------------------------------------------------------------------------

describe('what App wires', () => {
  it('the era reset is on by default', async () => {
    vi.resetModules();
    const store = await import('../src/state/store.js');
    const s = store.useDynasty.getState;
    s().start(4242, 0);
    s().openOverlay('jobs');
    // A new school is a new era: its write closes the old one's overlay.
    store.useDynasty.setState({ userTeam: 3 });
    expect(s().overlay).toBeNull();
    vi.resetModules();
  });

  it('fades in exactly the levels that move as the screen', () => {
    const q: TargetQuery = { last: () => null, main: () => null };
    const kinds: LevelKind[] = ['route', 'step', 'game', 'guard', 'overlay', 'sp', 't', 'c', 'p', 'g', 'local'];
    for (const kind of kinds) {
      const level: Level = { id: kind, kind, stamp: 0, peel: () => 'none' };
      expect(movesScreen(kind), kind).toBe(toTarget(level, q).kind === 'screen');
    }
    expect(movesScreen(undefined)).toBe(false);
  });

  it('shows the ledger on the window in dev, for the probe', () => {
    career();
    const p = page('chromium');
    const hook = p.b.env.win['__nav'] as Record<string, unknown> | undefined;
    expect(hook).toBeDefined();
    p.b.tap(() => S().go('team'));
    p.aligned();
    expect(hook!['depth']).toBe(1);
    expect(hook!['want']).toBe(1);
    expect((hook!['cur'] as { i: number }).i).toBe(1);
    expect((hook!['levels'] as Level[]).map((l) => l.id)).toEqual(ids());
    expect(hook!['pending']).toBeNull();
    // App hands the dev flag in from the build.
    const app = readFileSync('src/ui/App.tsx', 'utf8');
    expect(app).toContain('browserDeps(nav.ledgerNav, DEV)');
    expect(app).toMatch(/const DEV = \(import\.meta as unknown as \{ env\?: \{ DEV\?: boolean \} \}\)\.env\?\.DEV === true;/);
  });

  it('a back press refused on a broken lineup shakes the line that says why (no modal, no words)', () => {
    const src = readFileSync('src/ui/screens/Lineup.tsx', 'utf8');
    // It answers cardNudge, for the card's own refusal only.
    expect(src).toContain('const nudge = useDynasty((s) => s.cardNudge);');
    expect(src).toContain('if (!lineupHolds(s) || blockingCardUp(s)) return;');
    // The "Nobody at ..." callout, or from the Pitching tab the Batting order tab.
    expect(src).toContain("querySelector<HTMLElement>('.pb-lineup-gap')");
    expect(src).toContain("querySelector<HTMLElement>('.pb-lineup-part > .pb-seg__opt:first-child')");
    expect(src).toMatch(/<Callout\s+tone="warning"\s+className="pb-lineup-gap"/);
    expect(src).toMatch(/label="Lineup part"\s+className="pb-lineup-part"/);
    expect(src).toMatch(/el\.classList\.remove\('is-nudged'\);\s+void el\.offsetWidth;\s+el\.classList\.add\('is-nudged'\);/);
    expect(src).toContain('<main className="pb-page" ref={pageEl}>');
    // The nudge effect opens nothing: the modal stays the lineup gate's, from a tap.
    const effect = src.slice(src.indexOf('const nudgedAt = useRef(nudge);'), src.indexOf('}, [nudge]);'));
    expect(effect).not.toMatch(/warnIfBroken|setGapWarn/);
    // Motion only, and none when motion is reduced.
    const css = readFileSync('src/ui/design/lineup.css', 'utf8');
    expect(css).toMatch(/\.pb-lineup-gap\.is-nudged,\s+\.pb-lineup-part > \.pb-seg__opt\.is-nudged \{ animation: pb-nudge 360ms ease; \}/);
    expect(css).toContain(":root[data-motion='reduced'] :is(.pb-lineup-gap, .pb-lineup-part > .pb-seg__opt).is-nudged { animation: none; }");
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(readFileSync('src/ui/design/screens.css', 'utf8')).toContain('@keyframes pb-nudge');
  });

  it('App is the ledger and nothing else writes history', () => {
    const app = readFileSync('src/ui/App.tsx', 'utf8');
    expect(app).not.toMatch(/\b(window\.)?history\.(pushState|replaceState|go|back|forward|state)\b/);
    expect(app).not.toContain('playball:history-');
    expect(app).not.toMatch(/\b(backRef|peekRef|hasLayer|routeTrail|restoringRoute)\b/);
    expect(app).toContain('useSyncExternalStore(nav.subscribe, nav.levelsKey, nav.levelsKey)');
    expect(app).toContain('useLayoutEffect(() => { ledger.current?.afterCommit(); }, [key, era]);');
    expect(app).toContain('void Back.arm({ armed: nav.depth() > 0 });');
    // The ledger stays out of the APK, whose plugin answers the gesture.
    expect(app).toMatch(/if \(isNativeShell\(\)\) return undefined;\s+const stopPresses = trackPresses\(\);\s+const sync = installHistorySync/);
  });
});
