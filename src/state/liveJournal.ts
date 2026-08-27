// liveJournal.ts
// The game a phone call interrupted, written down as it is played.
//
// A managed game cannot be serialised. `LiveGame` is a running coroutine that
// carries `submit`, `finish` and two closures over private state, and there is
// no honest way to freeze one — which is why a backgrounded game has always
// been lost, and why the mobile report called that the most player-hostile
// behaviour in the app.
//
// So it is not frozen, it is **replayed**. Two facts make that exact:
//
//   1. The engine is deterministic. Given the same generator position and the
//      same inputs, a game produces the same game, pitch for pitch. This is
//      the property the goldens have been protecting since the first file.
//   2. Every decision a manager makes is a small enum — a tactic, a bench bat,
//      a reliever. The whole of a nine-inning game is forty of them.
//
// So the journal is an anchor and a list: where the season's generator stood
// when the game began, which two teams and which arms, and every call since.
// Replaying that list against a season restored to the anchor lands on exactly
// the same sixth inning, one out, four to two.
//
// **It lives in `localStorage`, not IndexedDB, and that is the whole design.**
// A write to IndexedDB is asynchronous, and the moment this exists to survive
// is the moment the operating system kills the app without warning — where a
// pending async write is a lost write. `localStorage.setItem` returns when the
// bytes are down. The journal is a few hundred bytes and it is written after
// every call, which is affordable precisely because it is small and because it
// is not the save file.

import type { Tactic } from '../engine/types.js';

const KEY = 'playball.liveGame.v1';

/** One thing the manager did, in the order he did it. */
export type JournalAction =
  | { k: 'tactic'; t: Tactic }
  | { k: 'pinch'; id: string }
  | { k: 'pen'; id: string };

export interface LiveJournal {
  /** The save slot this belongs to. A journal never crosses dynasties. */
  slot: string;
  year: number;
  /**
   * The season generator's position at the first pitch.
   *
   * The guard as well as the anchor: a save whose generator has moved past
   * this has played on without the game, and the journal is stale.
   */
  rngState: number;
  home: number;
  away: number;
  /** The calendar day, so an orphaned journal can be recognised as one. */
  day: number;
  homeStarter: number;
  awayStarter: number;
  managing: 'home' | 'away';
  /** Bracket games rebuild through a different door. */
  postseason: boolean;
  actions: JournalAction[];
}

/** Whether this browser will let us keep one at all. */
function store(): Storage | null {
  try {
    // Touched rather than assumed: private windows and blocked site data both
    // throw on access rather than returning null, and a game that cannot be
    // journalled must still be playable.
    const s = window.localStorage;
    const probe = '__pb__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function readJournal(): LiveJournal | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<LiveJournal>;
    if (typeof j.rngState !== 'number' || typeof j.home !== 'number'
      || typeof j.away !== 'number' || !Array.isArray(j.actions)
      || typeof j.slot !== 'string') return null;
    return j as LiveJournal;
  } catch {
    // A half-written or hand-edited journal is not worth a crash on boot.
    return null;
  }
}

export function writeJournal(j: LiveJournal): void {
  const s = store();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(j));
  } catch {
    // Quota, most likely. The game carries on unjournalled rather than dying.
  }
}

/** Append one call and write it down in the same breath. */
export function noteAction(a: JournalAction): void {
  const j = readJournal();
  if (!j) return;
  j.actions.push(a);
  writeJournal(j);
}

export function clearJournal(): void {
  const s = store();
  if (!s) return;
  try { s.removeItem(KEY); } catch { /* nothing to do about it */ }
}

/**
 * Whether this journal describes a game the loaded season is still waiting on.
 *
 * Three ways it can be stale, and all of them mean the same thing — throw it
 * away rather than replay it into a world that has moved on: it belongs to
 * another dynasty, another year, or a season whose generator has already run
 * past the first pitch.
 */
export function journalMatches(
  j: LiveJournal, slot: string, year: number, rngState: number,
): boolean {
  return j.slot === slot && j.year === year && j.rngState === rngState;
}
