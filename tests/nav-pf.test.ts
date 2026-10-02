// nav-pf.test.ts
// Product fixes the ledger makes safe (back-plan package PF, 2026-09-30):
// a move in a nav frame shuts every overlay in the same write, so a route
// never changes under an open page (C20: WeekStopped's "Set the lineup"
// under the Schedule), and `closePlayer` leaves a coach's sheet under the
// card, so one peel takes one level.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDynasty, PHASES, type DynastyStore } from '../src/state/store.js';
import { setEraReset } from '../src/state/era.js';
import { levels, depth, newest, peelNewest, levelsKey, eraNow, ledgerNav } from '../src/state/nav.js';
import { registerBackLayer, releaseBackLayer, resetBackLayers } from '../src/state/backLayers.js';
import { installHistorySync, isPbEntry, type HistorySync, type Engine } from '../src/ui/historySync.js';
import { FakeBrowser, type FakeEnv } from './support/fakeBrowser.js';

const S = (): DynastyStore => useDynasty.getState();
const route = (): string => `${S().tab}|${S().screen}`;
const ids = (): string[] => levels().map((l) => l.id);
const pid = (): NonNullable<DynastyStore['selectedPlayer']> => S().season!.teams[S().userTeam]!.team.lineup[0]!.id;
const shut = (): unknown => [S().overlay, S().overlayStack, S().settingsPage];

/** A `document` whose view transition never calls back (backNav.test.ts). */
function stubDocument(): void {
  (globalThis as { document?: unknown }).document = {
    documentElement: { dataset: {} as Record<string, string | undefined> },
    startViewTransition: (): unknown => ({ finished: Promise.resolve() }),
  };
}
const dropDocument = (): void => { delete (globalThis as { document?: unknown }).document; };

/** A nine with one position twice, which the lineup gate holds. */
function breakTheNine(): void {
  const nine = S().season!.teams[S().userTeam]!.team.lineup;
  nine[1]!.pos = nine[0]!.pos;
}

/** A sheet a screen holds itself; its dismiss unmounts it, as a real one's does. */
function sheet(): number {
  const box = { id: 0 };
  box.id = registerBackLayer(() => releaseBackLayer(box.id));
  return box.id;
}

function career(): void {
  S().start(4242, 0);
  S().leaveStart();
  useDynasty.setState({
    godMode: true, seasonOpener: null, bigMoment: null, playbookInvite: null, rosterAlert: null,
    tab: 'home', screen: 'today', phase: null, bracket: null, jobSearch: false, live: null,
    overlay: null, overlayStack: [], settingsPage: 'index', selectedPlayer: null, coachSeat: null,
    godStack: [], navTrail: [], restoringVisit: null, stepBase: null, teamCard: null,
  });
}

/** Three pages deep, the top one Settings on a sub-page. */
function stackThree(): void {
  S().openOverlay('schedule');
  S().openOverlay('inbox');
  S().openOverlay('settings');
  S().setSettingsPage('display');
  expect(S().overlayStack.length).toBe(2);
}

beforeEach(() => { dropDocument(); setEraReset(true); resetBackLayers(); career(); });
afterEach(() => { dropDocument(); setEraReset(true); resetBackLayers(); });

describe('a move in a nav frame shuts the pages over the route', () => {
  it('closes every overlay and the Settings page in the same write as the move', () => {
    stackThree();
    let writes = 0;
    const off = useDynasty.subscribe(() => { writes++; });
    S().go('team', 'lineup');
    off();
    expect(writes).toBe(1);
    expect(route()).toBe('team|lineup');
    expect(shut()).toEqual([null, [], 'index']);
    // The pages' levels went with them: what is left is the stop for Today.
    expect(levels().map((l) => l.kind)).toEqual(['route']);
  });

  it('closes them when the route does not move too (Set the lineup, from the lineup)', () => {
    S().go('team', 'lineup');
    S().openOverlay('schedule');
    const trail = S().navTrail.length;
    S().go('team', 'lineup');
    expect(shut()).toEqual([null, [], 'index']);
    expect(S().navTrail.length).toBe(trail);
  });

  it("leaves nothing for a caller's own closeOverlay() first (Inbox's Open recruiting)", () => {
    S().openOverlay('schedule');
    S().openOverlay('inbox');
    S().closeOverlay();
    S().go('office', 'recruiting');
    expect(route()).toBe('office|recruiting');
    expect(shut()).toEqual([null, [], 'index']);
  });

  it('does it in June as well', () => {
    useDynasty.setState({ bracket: {} as never });
    stackThree();
    S().go('team', 'roster');
    expect(shut()).toEqual([null, [], 'index']);
  });

  it('touches nothing when no page is open', () => {
    const stack = S().overlayStack;
    S().go('team');
    expect(S().overlayStack).toBe(stack);
  });

  it('leaves the pages alone outside the nav frames', () => {
    useDynasty.setState({ phase: 'draft', stepBase: 'awards', furthestPhase: PHASES.length - 1 });
    S().openOverlay('inbox');
    S().go('team');
    expect(S().overlay).toBe('inbox');
  });

  it('leaves them when the broken nine holds the door', () => {
    S().go('team', 'lineup');
    breakTheNine();
    // openOverlay is held too, so the page is laid on by hand.
    useDynasty.setState({ overlay: 'schedule' });
    const gate = S().lineupGate;
    S().go('home');
    expect(S().lineupGate).toBe(gate + 1);
    expect(route()).toBe('team|lineup');
    expect(S().overlay).toBe('schedule');
  });

  it('closes them with the move that runs, not before it', async () => {
    S().openOverlay('inbox');
    stubDocument();
    S().go('team');
    // The capture is live and nothing has run: the page is still up.
    expect(route()).toBe('home|today');
    expect(S().overlay).toBe('inbox');
    await new Promise((r) => setTimeout(r, 250));
    expect(route()).toBe('team|roster');
    expect(S().overlay).toBeNull();
  });

  it('keeps the god sheets and the team card rules as they were', () => {
    S().openOverlay('schedule');
    S().openTeamCard(3);
    S().openGod({ kind: 'money' });
    S().go('team');
    expect(S().teamCard).toBeNull();
    expect(S().godStack.length).toBe(1);
    expect(S().overlay).toBeNull();
  });
});

describe('one close, one level', () => {
  it('closePlayer leaves the coach sheet the card was opened from', () => {
    S().openCoach('hitting');
    S().openPlayer(pid());
    S().closePlayer();
    expect(S().selectedPlayer).toBeNull();
    expect(S().coachSeat).toBe('hitting');
  });

  it('a back press takes the card, then the sheet', () => {
    S().openCoach('hitting');
    S().openPlayer(pid());
    expect(levels().slice(-2).map((l) => l.kind)).toEqual(['c', 'p']);
    const d = depth();
    expect(peelNewest()).toBe('peeled');
    expect(depth()).toBe(d - 1);
    expect(newest()?.id).toBe('c:hitting');
    expect(peelNewest()).toBe('peeled');
    expect(depth()).toBe(d - 2);
    expect(S().coachSeat).toBeNull();
  });

  it("openRoom at the room's own screen closes both cards by name", () => {
    S().go('office', 'staff');
    const trail = S().navTrail.length;
    S().openCoach('pitching');
    S().openPlayer(pid());
    S().openRoom('staff');
    expect([S().selectedPlayer, S().coachSeat]).toEqual([null, null]);
    expect(route()).toBe('office|staff');
    expect(S().navTrail.length).toBe(trail);
    expect(S().overlay).toBeNull();
  });

  it('openRoom closes a lone coach sheet or a lone card the same way', () => {
    S().go('office', 'staff');
    S().openCoach('recruiting');
    S().openRoom('staff');
    expect(S().coachSeat).toBeNull();
    S().openPlayer(pid());
    S().openRoom('staff');
    expect(S().selectedPlayer).toBeNull();
  });

  it('go still closes both cards in its move', () => {
    S().openCoach('hitting');
    S().openPlayer(pid());
    S().go('team');
    expect([S().selectedPlayer, S().coachSeat]).toEqual([null, null]);
  });
});

/** App's wiring, reduced (nav-together.test.ts): the ledger, and its afterCommit after each commit that moved the levels or the era. */
function page(engine: Engine): { b: FakeBrowser; i(): number; aligned(): void } {
  const b = new FakeBrowser({ engine });
  let ledger: HistorySync | null = null;
  const key = (): string => `${levelsKey()}#${eraNow()}`;
  let seen = '';
  b.afterTask = () => {
    const k = key();
    if (k !== seen) { seen = k; ledger?.afterCommit(); }
  };
  b.open((env: FakeEnv) => {
    const mine = installHistorySync({ ...env, nav: ledgerNav, boot: 'b1', dev: true },
      { pushMark: () => {}, markReturn: () => {}, onUserPop: () => {} });
    ledger = mine;
    seen = key();
    return () => { mine.dispose(); if (ledger === mine) ledger = null; };
  });
  const i = (): number => (isPbEntry(b.state) ? b.state.i : -1);
  return {
    b,
    i,
    aligned: () => {
      b.settle();
      for (let k = 0; k < 60 && (ledger?.inspect().pending || b.goPending); k++) b.advance(50);
      const v = ledger!.inspect();
      expect(v.pending).toBeNull();
      expect(i()).toBe(v.eraBase + depth());
      expect(b.pushesInsidePop).toBe(0);
      expect(b.pushesWithoutActivation).toBe(0);
      expect(b.goWhilePending).toBe(0);
    },
  };
}

describe.each<Engine>(['chromium', 'webkit'])('C20 in the browser, on %s', (engine) => {
  it('Set the lineup over the Schedule lands on the lineup, and back goes to Today', () => {
    const p = page(engine);
    p.b.tap(() => S().openOverlay('schedule'));
    let stopped = 0;
    p.b.tap(() => { stopped = sheet(); }); // WeekStopped's card, over the page
    p.aligned();
    expect(p.i()).toBe(2);
    // "Set the lineup": the card goes and the route moves, in one tap.
    p.b.tap(() => { releaseBackLayer(stopped); S().go('team', 'lineup'); });
    p.aligned();
    expect(route()).toBe('team|lineup');
    expect(S().overlay).toBeNull();
    expect(ids().length).toBe(1);
    expect(newest()?.kind).toBe('route');
    expect(p.i()).toBe(1);
    p.b.swipeBack();
    p.aligned();
    expect(route()).toBe('home|today');
    expect(S().overlay).toBeNull();
    expect(p.i()).toBe(0);
  });
});
