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
import { openDB, type IDBPDatabase } from 'idb';

const KEY = 'playball.liveGame.v1';

/*
  The durable copy.

  Reported from the Android 16 emulator, September 6 2026: a few innings in,
  the app closed, and the pick-up offered on return started the game from
  the beginning. localStorage is written synchronously but committed to disk
  on the browser's own schedule, and when Android kills the process the
  writes since the last commit are gone — the journal that survived was the
  one written at the first pitch, with no calls in it. IndexedDB commits a
  transaction before it reports it done, so every call is mirrored there as
  well, in order, and on load the copy that knows more wins.
*/
const DB_NAME = 'playball-journal';
const DB_STORE = 'journal';
const DB_ROW = 'live';
let opening: Promise<IDBPDatabase | null> | null = null;
function durable(): Promise<IDBPDatabase | null> {
  if (opening) return opening;
  opening = typeof indexedDB === 'undefined'
    ? Promise.resolve(null)
    : openDB(DB_NAME, 1, { upgrade(d) { d.createObjectStore(DB_STORE); } }).catch(() => null);
  return opening;
}
// One writer, in order: a call written after another lands after it.
let queue: Promise<void> = Promise.resolve();
function mirror(op: (d: IDBPDatabase) => Promise<unknown>): void {
  queue = queue
    .then(async () => { const d = await durable(); if (d) await op(d); })
    .catch(() => undefined);
}
/** The journal this process last wrote, for a call made while local storage is unavailable. */
let current: LiveJournal | null = null;

/** One thing the manager did, in the order he did it. */
export type JournalAction =
  | { k: 'tactic'; t: Tactic }
  | { k: 'pinch'; id: string }
  | { k: 'pen'; id: string }
  /*
    A mound visit. It carries nothing because there is nothing to carry -- there
    is one per pitcher and it always does the same thing -- but it has to be in
    the journal all the same, because it changes confidence and confidence
    changes the game. A replay that skipped it would land somewhere else.
  */
  | { k: 'visit' };

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
  /**
   * Whether the pitching ran itself in the game being recorded.
   *
   * Part of the anchor rather than a detail, because it changes which halves
   * the engine stops to ask about and therefore the whole sequence of draws.
   * A player who switched out of casual between backgrounding a game and
   * resuming it would otherwise replay into a *different* game and be handed it
   * as though it were the one he left.
   */
  autoPitching?: boolean;
  /** Bracket games rebuild through a different door. */
  postseason: boolean;
  /**
   * Whether the game counts in the conference race. Absent on a journal
   * written before it was recorded — a resumed game was folded as
   * non-conference for want of it (05 §62.1).
   */
  conference?: boolean;
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
  current = j;
  const s = store();
  if (s) {
    try {
      s.setItem(KEY, JSON.stringify(j));
    } catch {
      // Quota, most likely. The game carries on unjournalled rather than dying.
    }
  }
  mirror((d) => d.put(DB_STORE, j, DB_ROW));
}

/** Append one call and write it down in the same breath. */
export function noteAction(a: JournalAction): void {
  const j = readJournal() ?? current;
  if (!j) return;
  j.actions.push(a);
  writeJournal(j);
}

export function clearJournal(): void {
  current = null;
  const s = store();
  if (s) {
    try { s.removeItem(KEY); } catch { /* nothing to do about it */ }
  }
  mirror((d) => d.delete(DB_STORE, DB_ROW));
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

/** A journal parsed off any store, or null if it is not one. */
function asJournal(raw: unknown): LiveJournal | null {
  const j = raw as Partial<LiveJournal> | null;
  if (!j || typeof j !== 'object') return null;
  if (typeof j.rngState !== 'number' || typeof j.home !== 'number'
    || typeof j.away !== 'number' || !Array.isArray(j.actions)
    || typeof j.slot !== 'string') return null;
  return j as LiveJournal;
}

/**
 * Of two copies of the journal, the one to trust. The same game — same
 * anchor — with more calls in it knows more; a different game is a newer
 * one, and the synchronous store is written first, so it wins that.
 */
export function richer(local: LiveJournal | null, kept: LiveJournal | null): LiveJournal | null {
  if (!local) return kept;
  if (!kept) return local;
  const same = local.slot === kept.slot && local.year === kept.year
    && local.rngState === kept.rngState && local.home === kept.home && local.away === kept.away;
  if (!same) return local;
  return kept.actions.length > local.actions.length ? kept : local;
}

/**
 * Bring the two stores to agreement before anything reads the journal, and
 * return what they agree on. Called once on load; the synchronous readers
 * (readJournal, noteAction) then see the durable copy's calls.
 */
export async function reconcileJournal(): Promise<LiveJournal | null> {
  const local = readJournal();
  const d = await durable();
  const kept = d ? asJournal(await d.get(DB_STORE, DB_ROW).catch(() => null)) : null;
  const best = richer(local, kept);
  if (best && best !== local) {
    current = best;
    const s = store();
    try { s?.setItem(KEY, JSON.stringify(best)); } catch { /* the durable copy still stands */ }
  } else if (best && best !== kept) {
    // The synchronous copy knew more, or the mirror had nothing yet: catch it up.
    current = best;
    mirror((d) => d.put(DB_STORE, best, DB_ROW));
  }
  return best;
}
