// nav-together.test.ts
//
// A tap that closes several layers at once gives their history entries back
// in one step. Hit by a dugout pick (picker and dugout), taking a job from the
// New career wizard (six levels) and the coach menu opening Settings (the menu
// released while the overlay opened). One `history.go(-1)` per layer in one
// task was a single traversal, and the spares ate the next back swipes.
//
// S2 netted the old store/registry events with `together` (back-together.test,
// 2026-09-30). CL deleted the events: the ledger (historySync.ts) now reads
// `nav.depth()` once per commit, so a tap's levels net by construction. These
// are the same cases, asserted on the browser's own history calls.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDynasty, type DynastyStore } from '../src/state/store.js';
import { setEraReset } from '../src/state/era.js';
import { depth, levelsKey, eraNow, ledgerNav } from '../src/state/nav.js';
import { registerBackLayer, releaseBackLayer, resetBackLayers, localLayers } from '../src/state/backLayers.js';
import { installHistorySync, isPbEntry, type HistorySync, type Engine } from '../src/ui/historySync.js';
import { FakeBrowser, type FakeEnv } from './support/fakeBrowser.js';

const S = (): DynastyStore => useDynasty.getState();

/** A sheet a screen holds itself; its dismiss unmounts it, as a real one's does. */
function sheet(): number {
  const box = { id: 0 };
  box.id = registerBackLayer(() => releaseBackLayer(box.id));
  return box.id;
}

function career(): void {
  S().start(4242, 0);
  S().leaveStart();
  useDynasty.setState({ godMode: true, seasonOpener: null, bigMoment: null, playbookInvite: null });
}

/** App's wiring, reduced: the ledger, and its afterCommit after each commit that moved the levels or the era. */
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

beforeEach(() => { delete (globalThis as { document?: unknown }).document; setEraReset(true); resetBackLayers(); });
afterEach(() => { resetBackLayers(); });

describe.each<Engine>(['chromium', 'webkit'])('several layers closed by one tap, on %s', (engine) => {
  it('each layer on its own still spends and gives back its own entry', () => {
    career();
    const p = page(engine);
    let a = 0;
    p.b.tap(() => { a = sheet(); });
    p.aligned();
    expect(p.i()).toBe(1);
    const gos = p.b.goCalls;
    p.b.tap(() => releaseBackLayer(a));
    p.aligned();
    expect(p.i()).toBe(0);
    expect(p.b.goCalls).toBe(gos + 1);
  });

  it('a dugout pick gives back the picker and the dugout in one step', () => {
    career();
    const p = page(engine);
    let dugout = 0;
    let picker = 0;
    p.b.tap(() => { dugout = sheet(); });
    p.b.tap(() => { picker = sheet(); });
    p.aligned();
    expect(p.i()).toBe(2);
    const gos = p.b.goCalls;
    p.b.tap(() => { releaseBackLayer(picker); releaseBackLayer(dugout); });
    p.aligned();
    expect(p.i()).toBe(0);
    expect(p.b.goCalls).toBe(gos + 1);
  });

  it('taking a job gives back the whole wizard in one step, less what the new frame opens', () => {
    career();
    const p = page(engine);
    const wizard: number[] = [];
    for (let k = 0; k < 6; k++) p.b.tap(() => { wizard.push(sheet()); });
    p.aligned();
    expect(p.i()).toBe(6);
    const gos = p.b.goCalls;
    const pushes = p.b.pushes;
    p.b.tap(() => {
      for (const id of wizard) releaseBackLayer(id);
      sheet(); // a tip on the new career's first screen
    });
    p.aligned();
    expect(p.i()).toBe(1);
    expect(p.b.goCalls).toBe(gos + 1);
    expect(p.b.pushes).toBe(pushes);
  });

  it('the coach menu hands its entry to the overlay it opens: no push, no pop', () => {
    career();
    const p = page(engine);
    let menu = 0;
    p.b.tap(() => { menu = sheet(); });
    p.aligned();
    expect(p.i()).toBe(1);
    const gos = p.b.goCalls;
    const pushes = p.b.pushes;
    p.b.tap(() => { releaseBackLayer(menu); S().openOverlay('settings'); });
    p.aligned();
    expect(S().overlay).toBe('settings');
    expect(p.i()).toBe(1);
    expect(p.b.goCalls).toBe(gos);
    expect(p.b.pushes).toBe(pushes);
  });

  it('a layer the gesture already peeled gives nothing more back', () => {
    career();
    const p = page(engine);
    let dugout = 0;
    p.b.tap(() => { dugout = sheet(); });
    p.b.tap(() => { sheet(); });
    p.aligned();
    expect(p.i()).toBe(2);
    p.b.swipeBack(); // peels the picker: its dismiss unmounts it
    p.aligned();
    expect(p.i()).toBe(1);
    expect(localLayers().map((l) => l.id)).toEqual([dugout]);
    const gos = p.b.goCalls;
    p.b.tap(() => releaseBackLayer(dugout));
    p.aligned();
    expect(p.i()).toBe(0);
    expect(p.b.goCalls).toBe(gos + 1);
  });

  it('two layers opened by one tap are two entries', () => {
    career();
    const p = page(engine);
    p.b.tap(() => { sheet(); S().openOverlay('inbox'); });
    p.aligned();
    expect(depth()).toBe(2);
    expect(p.i()).toBe(2);
  });
});
