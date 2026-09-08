// merged-audit.test.ts
// The verification pass over the September 7 outside pass (05 §63), which
// arrived with none of its own. Each test is a defect that pass shipped,
// found by measurement and fixed.

import { describe, it, expect, beforeEach, vi } from 'vitest';
const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_s: string, v: { slot: string }) => { disk.set(v.slot, structuredClone(v)); },
    get: async (_s: string, k: string) => {
      const found = disk.get(k);
      return found === undefined ? undefined : structuredClone(found);
    },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_s: string, k: string) => { disk.delete(k); },
  }),
}));

import { useDynasty } from '../src/state/store.js';
import { simSeason, injuryClock } from '../src/engine/season.js';
import { hurt } from '../src/engine/injury.js';

import { RECRUITING_WEEKS } from '../src/engine/recruiting.js';
import type { Player } from '../src/engine/types.js';

beforeEach(() => { disk.clear(); useDynasty.getState().newDynasty(); });

// ---------------------------------------------------------------------------
// §63.3 The roster-decision hold
// ---------------------------------------------------------------------------

describe('the hold names a decision the coach can actually make', () => {
  /*
    The hold stops the calendar. Every route out of it refuses an unavailable
    body, so a program with nobody fit to come in was held for ever — the
    career could not reach tomorrow. The bench is four men at creation, so
    this was reachable rather than theoretical.
  */
  it('lets the day pass when there is nobody left to bring in', () => {
    useDynasty.getState().start(4242, 0);
    const season = useDynasty.getState().season!;
    const team = season.teams[0]!.team;
    const day = injuryClock(season);
    // Every bench bat unavailable — the whole bench on the shelf.
    for (const b of team.bench) hurt(b, day, 'knee', 60);
    // And a man in the nine goes down.
    hurt(team.lineup[3]!, day, 'hamstring', 30);

    const before = season.dayIndex;
    useDynasty.getState().advanceDay();
    expect(useDynasty.getState().season!.dayIndex).toBeGreaterThan(before);
  });

  it('still holds when somebody fit is sitting there', () => {
    useDynasty.getState().start(4242, 0);
    const season = useDynasty.getState().season!;
    const team = season.teams[0]!.team;
    hurt(team.lineup[3]!, injuryClock(season), 'hamstring', 30);
    const before = season.dayIndex;
    useDynasty.getState().advanceDay();
    // The bench is full of fit men, so the coach is asked and the day waits.
    expect(useDynasty.getState().season!.dayIndex).toBe(before);
    expect(useDynasty.getState().screen).toBe('lineup');
  });

  it('does not hold a rotation slot when the pen is empty too', () => {
    useDynasty.getState().start(4242, 0);
    const season = useDynasty.getState().season!;
    const team = season.teams[0]!.team;
    const day = injuryClock(season);
    for (const a of team.bullpen) hurt(a, day, 'elbow', 60);
    hurt(team.rotation[0]!, day, 'shoulder', 40);
    const before = season.dayIndex;
    useDynasty.getState().advanceDay();
    expect(useDynasty.getState().season!.dayIndex).toBeGreaterThan(before);
  });

  it('never asks a chart-only coach to settle a return he has no screen for', () => {
    useDynasty.getState().start(4242, 0, undefined, 'casual');
    // Casual, but he took the depth chart back — and not the lineup.
    useDynasty.setState({ depth: { mode: 'casual', overrides: { depthChart: true } } });
    const season = useDynasty.getState().season!;
    const team = season.teams[0]!.team;
    const day = injuryClock(season);
    // A healed man off the nine: the return decision the lineup screen answers.
    const man = team.bench[0] as Player & { outUntil?: number; why?: string };
    man.why = 'injury';
    man.outUntil = day;
    const before = season.dayIndex;
    useDynasty.getState().advanceDay();
    expect(useDynasty.getState().season!.dayIndex).toBeGreaterThan(before);
  });

  it('KEEP THE COVER answers a returning arm, not only a returning bat', () => {
    useDynasty.getState().start(4242, 0);
    const season = useDynasty.getState().season!;
    const arm = season.teams[0]!.team.bullpen[0] as Player & {
      outUntil?: number; why?: string; returnDecided?: number;
    };
    const day = injuryClock(season);
    arm.why = 'injury';
    arm.outUntil = day;
    useDynasty.getState().keepCover(arm.id);
    // Settled: the strip has its answer and stops asking.
    expect(arm.returnDecided).toBe(day);
  });
});

// ---------------------------------------------------------------------------
// §63.6 Season-long recruiting
// ---------------------------------------------------------------------------

describe('a season simmed in one press still recruits', () => {
  /*
    The worker branch of `playSeason` never banked a recruiting week, and
    `workerAvailable` is true in every browser — so the branch that shipped
    was the one nobody tested. One press voided the whole country's class.
    Node has no Worker, so this drives the same sequence the worker branch
    runs and asserts the calendar it must leave behind.
  */
  it('banks every week of the class the schedule crossed', () => {
    useDynasty.getState().start(4242, 0, undefined, 'casual');
    const season = useDynasty.getState().season!;
    expect(season.recruiting.week).toBe(1);
    simSeason(season);
    useDynasty.getState().syncRecruitingCalendar();

    expect(useDynasty.getState().season!.recruiting.week).toBe(RECRUITING_WEEKS + 1);
    const signed = useDynasty.getState().season!.recruiting.prospects
      .filter((p) => p.signedBy !== null && p.signedBy !== undefined).length;
    expect(signed).toBeGreaterThan(200);
  });
});

// ---------------------------------------------------------------------------
// §63.1 / §63.2 God mode's stack and the browser's history
// ---------------------------------------------------------------------------

describe('the god-mode stack', () => {
  it('raises a sheet that is already open rather than opening it twice', () => {
    useDynasty.getState().start(4242, 0, undefined, 'full', undefined, true);
    const s = () => useDynasty.getState();
    s().openGod({ kind: 'tab', tab: 'program' });
    s().openGod({ kind: 'coach' });
    // Bouncing back to the first: already in the stack, so nothing is pushed.
    s().openGod({ kind: 'tab', tab: 'program' });
    expect(s().godStack).toHaveLength(2);
  });

  it('is capped, so a stuck finger cannot grow it without end', () => {
    useDynasty.getState().start(4242, 0, undefined, 'full', undefined, true);
    const s = () => useDynasty.getState();
    for (let i = 0; i < 40; i++) {
      s().openGod({ kind: 'player', id: `p${i}` as unknown as Player['id'] });
    }
    expect(s().godStack.length).toBeLessThanOrEqual(8);
  });

  it('CLOSE ALL gives the browser back one entry per sheet it opened', () => {
    // Vitest runs in node, where the store's history bridge is a no-op. The
    // bridge is a pair of window events, so an EventTarget standing in for
    // `window` is enough to hear what it asks the shell for.
    const shell = new EventTarget();
    (globalThis as { window?: unknown }).window = shell;
    useDynasty.getState().start(4242, 0, undefined, 'full', undefined, true);
    const asked: number[] = [];
    const listen = (e: Event): void => {
      asked.push(Number((e as CustomEvent<{ count?: number }>).detail?.count ?? 1));
    };
    shell.addEventListener('playball:history-consume', listen);
    try {
      const s = () => useDynasty.getState();
      s().openGod({ kind: 'tab', tab: 'program' });
      s().openGod({ kind: 'coach' });
      s().openGod({ kind: 'money' });
      expect(s().godStack).toHaveLength(3);
      s().closeGodAll();
      expect(s().godStack).toHaveLength(0);
      // Three sheets pushed three checkpoints, so three come back. Asking for
      // one left two orphans, and the next two browser Back presses walked the
      // screen underneath backwards.
      expect(asked).toEqual([3]);
    } finally {
      shell.removeEventListener('playball:history-consume', listen);
      delete (globalThis as { window?: unknown }).window;
    }
  });
});
