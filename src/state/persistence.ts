// persistence.ts
// Dynasty saves, in IndexedDB.
//
// IndexedDB rather than localStorage because a save is roughly a megabyte —
// 2,200 players across 96 programs, plus a season of statistics — and
// localStorage caps out around five and stores strings, which would mean
// stringifying the whole world on every write.
//
// Saves go in via structured clone, which handles Map natively. That matters:
// season statistics are keyed Maps, and hand-converting them to arrays and back
// is exactly the kind of code that silently drops a field two schema versions
// later.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { toPortable, fromPortable, type StoredSeason } from './seasonCodec.js';
import type { SeasonState } from '../engine/season.js';

/**
 * Bump on any change to the shape below, and add a migration. The roadmap is
 * explicit that migrations get written before there are users, not after.
 *
 * 2 — `scheduleRotation` added to the season. Version 1 saves do not have it,
 *     and the field is arithmetic: `nextSeason` computes `prev.scheduleRotation
 *     + 1`, so `undefined` becomes NaN, and a NaN rotation makes `roundPairs`
 *     return the same pairing every round. The symptom was a schedule where
 *     every conference series was against the same opponent and every
 *     non-conference opponent was blank. Nothing threw; it just quietly stopped
 *     being a schedule.
 */
export const SCHEMA_VERSION = 4;

const DB_NAME = 'playball';
const STORE = 'dynasties';

export interface SaveFile {
  /** The season's press conferences so far, and the one still open. */
  press?: unknown;
  pendingPress?: unknown;
  /** Stage 8: conversations spent this season. */
  wordsUsed?: unknown;
  schemaVersion: number;
  slot: string;
  name: string;
  savedAt: number;
  year: number;
  userTeam: number;
  /** Where the generator had got to. Without it a resumed season diverges. */
  rngState: number;
  season: StoredSeason;
  /**
   * Completed seasons. Optional so saves written before the record books
   * existed still load — they simply come back with an empty history.
   */
  history?: unknown[];
  coach?: unknown;
  /**
   * Where the offseason had got to, and the verdict it was built on.
   *
   * Without these a reload between steps drops the player back on the dashboard
   * mid-sequence — the recruiting budget spent that week is still on the season,
   * but the sequence itself has forgotten where it was. Optional so saves made
   * before the offseason became a sequence still load.
   */
  phase?: unknown;
  /**
   * How far into the offseason this career has ever got.
   *
   * Not derivable from `phase`, and the difference is load bearing. Walking
   * back a step moves `phase` and deliberately leaves this where it was, so a
   * save taken while the player is looking at an earlier step records the two
   * disagreeing — which is exactly the state that has to survive. Recomputing
   * it from `phase` on the way in would hand the offseason permission to run
   * the departures a second time.
   */
  furthestPhase?: unknown;
  review?: unknown;
  outcome?: unknown;
  /** The postseason of the current year, if it has been played. */
  postseason?: unknown;
  /** True while the coach has been dismissed and has not taken a new job. */
  jobSearch?: unknown;
  /**
   * The chairs that would take his call while he is out of work.
   *
   * The one companion `jobSearch` cannot live without. A save that recorded
   * the dismissal but not the offers came back as a job-search screen with
   * nothing on it — no rows, no nav, no way forward — and the career was
   * unrecoverable. Optional so older saves load; the store regenerates a
   * missing list from the same rule that built it.
   */
  offers?: unknown;
  /**
   * The postseason in progress, stage by stage.
   *
   * Same reason `phase` is here: without it a reload between stages drops the
   * player onto the dashboard of a season that is already over, with a bracket
   * half played and no way back into it.
   */
  bracket?: unknown;
  /**
   * The tournament you are in the middle of, minus the two things that cannot
   * be written down. Without it a reload mid-June found the other seven
   * conferences already decided, decided your own stage was therefore over, and
   * skipped the tournament you were playing — which also left you out of the
   * regional, since you never won anything to qualify with.
   */
  myBracket?: unknown;
  /** The other half of the national showdown, mid-tournament. */
  sideShow?: unknown;
  /**
   * How your run in the postseason ended, and what June has already told you.
   *
   * A reload lands between the elimination and the screen that reports it, so
   * both sides of that have to survive one: without the first the player is
   * never told, and without the second he is told twice.
   */
  knockout?: unknown;
  postseasonSeen?: unknown;
  /**
   * What has happened to the coach's world, unread flags included.
   *
   * The one thing in the save that is *only* here. Everything else the inbox
   * reports has a permanent home — the season is in the history, the mark is in
   * the record book, the achievement is on the coach — but whether the player
   * has read a given card exists nowhere else, and losing it on every reload
   * would mean the badge came back the moment the app restarted.
   */
  inbox?: unknown;
  /**
   * Which first-visit tutorials have been shown. Screen ids, nothing more —
   * losing this costs a re-taught screen, not a career, so it is the least
   * precious field in the file. Absent on older saves, which simply teach.
   */
  tutorials?: unknown;
  /** The watchlists — programs followed and chairs the career points at. */
  watch?: unknown;
  /**
   * How deep a game this career is: the preset, plus whichever systems the
   * player has decided differently about.
   *
   * In the save rather than on the device because it describes a *dynasty*, not
   * a person — a career begun as a casual one is still that career on another
   * phone, while a text size is not. Absent on every save written before the
   * mode existed, and those load as full: they have been played with every
   * decision in the player's hands, and defaulting them to anything else would
   * be taking something away from a career already in progress.
   */
  depth?: unknown;
}

export interface SaveSummary {
  slot: string;
  name: string;
  savedAt: number;
  year: number;
  record: string;
  /**
   * Where the dynasty is being coached. Read off the season rather than stored
   * beside the name, because the name is now the player's own text and a career
   * can move between programs — so the school is a fact about the save, not a
   * label somebody typed once and never revisited.
   */
  school: string;
}

/**
 * The one slot the game writes to on its own, and the only reserved key.
 *
 * Lives here rather than in the store because it is a fact about the file
 * format: everything that generates a key has to know which one is spoken for.
 */
export const AUTOSAVE_SLOT = 'auto';

/**
 * What every slot the player creates begins with.
 *
 * The reserved key above is a bare word and this is a prefix no bare word
 * carries, which is the whole of the collision argument — it does not depend on
 * anybody remembering to check.
 */
const SLOT_PREFIX = 'dyn-';

/**
 * The key a named save is filed under.
 *
 * Deliberately takes no name. A display name is text a player chose and a slot
 * is a primary key, and the two have different rules: a dynasty called "auto"
 * would be filed straight on top of the autosave and take a running career with
 * it, and no amount of stripping punctuation out of the typed name makes that
 * safe — it only makes the collision harder to reason about. So the typed name
 * goes in `name`, where it is only ever read, and the key is generated: a prefix
 * the reserved slot cannot wear, the clock so the ordering is at least sensible
 * in a database viewer, and a random tail so two saves taken in the same
 * millisecond are still two saves.
 */
export function newSlotId(now = Date.now(), rand = Math.random): string {
  const stamp = Math.max(0, Math.floor(now)).toString(36);
  const tail = Math.floor(rand() * 0x1000000).toString(36).padStart(5, '0');
  return `${SLOT_PREFIX}${stamp}-${tail}`;
}

interface PlayballDB extends DBSchema {
  dynasties: { key: string; value: SaveFile };
}

let dbPromise: Promise<IDBPDatabase<PlayballDB>> | null = null;

/**
 * How long to wait for the database before deciding it is not coming.
 *
 * Opening IndexedDB has failure modes that never resolve *and* never reject.
 * The open request fires `blocked` when another tab is holding the database at
 * a different version, and then simply waits — for that tab to close, which may
 * be never. Some browsers also stall the request outright when site data is
 * restricted. Neither case can be caught, because there is nothing to catch:
 * the promise just stays pending.
 *
 * Reported from testing: "still stuck at building the league when opening from
 * Chrome, from Safari it works". A loading screen with no timeout is a loading
 * screen that can last for ever, and the only defence is to stop waiting.
 */
const OPEN_TIMEOUT_MS = 4000;

/** Thrown when the browser will not give us storage. The game still runs. */
export class StorageUnavailable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'StorageUnavailable';
  }
}

/** True once an open has failed, so the app can say saving is off. */
export let storageBlocked = false;

function openDatabase(): Promise<IDBPDatabase<PlayballDB>> {
  const open = openDB<PlayballDB>(DB_NAME, SCHEMA_VERSION, {
    upgrade(database, oldVersion) {
      // Version 0 means a fresh browser. Each later case falls through so an
      // old save walks every migration between its version and this one.
      if (oldVersion < 1) {
        database.createObjectStore(STORE, { keyPath: 'slot' });
      }
      // Version 2 changed the record shape, not the store shape, so there is
      // nothing to do here — migrateFile handles it on read. Structural
      // migrations go in this block; field migrations go there.

      // Version 4 replaced the world: 192 programs in sixteen conferences
      // became 64 in eight. A version 3 save stores team *indices*, and those
      // indices now point at different schools — 128 of which no longer exist.
      // There is no honest migration for that, because the schools the dynasty
      // was about are gone. Dropping the store is the truthful outcome, and it
      // beats the alternative, which is loading into a world where your team is
      // quietly somebody else.
      //
      // The world has grown again since — eight conferences of twelve, ninety
      // six programs — and that one did not need a version. A save carries its
      // own teams, each with its own school and its own conference, and the
      // schedule is rebuilt from those rather than from the data file as it
      // stands today. See `worldFromTeams`. Version 4 was different only
      // because the schools themselves stopped existing.
      if (oldVersion > 0 && oldVersion < 4) {
        database.deleteObjectStore(STORE);
        database.createObjectStore(STORE, { keyPath: 'slot' });
      }
    },
    /**
     * Another tab is holding the database and ours cannot upgrade past it.
     *
     * Nothing to do but let the timeout below take over — but without this
     * callback the request stays pending silently, which is the whole bug.
     */
    blocked() {
      storageBlocked = true;
    },
    /**
     * We are the tab in the way. Close, so the other one can get on with it.
     *
     * Without this, two tabs of the game deadlock each other: whichever opened
     * first blocks the upgrade, and the second waits on it for ever.
     */
    blocking(_current, _blocked, event) {
      (event.target as IDBPDatabase<PlayballDB> | null)?.close();
      dbPromise = null;
    },
    terminated() {
      dbPromise = null;
    },
  });

  // Stop waiting eventually. A game that cannot reach its save is still a game.
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new StorageUnavailable(
        'the browser did not open local storage within four seconds',
      )),
      OPEN_TIMEOUT_MS,
    );
  });

  return Promise.race([open, timeout]).finally(() => clearTimeout(timer)) as
    Promise<IDBPDatabase<PlayballDB>>;
}

function db(): Promise<IDBPDatabase<PlayballDB>> {
  // A failed open is not cached. The next attempt gets a fresh request, so a
  // tab that was blocking can be closed and the game carries on working.
  dbPromise ??= openDatabase().catch((e) => {
    dbPromise = null;
    storageBlocked = true;
    throw e;
  });
  return dbPromise;
}

export interface SaveExtras {
  /** The season's press conferences so far, and the one still open. */
  press?: unknown;
  pendingPress?: unknown;
  /** Stage 8: conversations spent this season. */
  wordsUsed?: unknown;
  phase?: unknown;
  /** The furthest step this career has reached. See `SaveFile`. */
  furthestPhase?: unknown;
  review?: unknown;
  outcome?: unknown;
  history?: unknown[];
  postseason?: unknown;
  bracket?: unknown;
  /** Your own half-played tournament, so a reload resumes inside it. */
  myBracket?: unknown;
  /** The other half of the national showdown, mid-tournament. */
  sideShow?: unknown;
  /** The end of your June, and the modals it has already shown. */
  knockout?: unknown;
  postseasonSeen?: unknown;
  /** True while the coach has no job. Without it, a reload rehires him. */
  jobSearch?: unknown;
  /** The offers on the table while he has no job. See `SaveFile.offers`. */
  offers?: unknown;
  /** Optional so saves predating the dynasty layer still load. */
  coach?: unknown;
  /** The notification centre, read flags and all. */
  inbox?: unknown;
  /** First-visit tutorial ids already shown. */
  tutorials?: unknown;
  /** The program and job-path watchlists, by school abbreviation. */
  watch?: unknown;
  /** How deep a game this career is. See `SaveFile.depth`. */
  depth?: unknown;
}

/**
 * Build the record that goes on disk.
 *
 * Pulled out of `saveDynasty` so it can be tested without IndexedDB, and
 * because the bug it exists to prevent lives exactly here: the record is
 * assembled field by field, so a value not named below is dropped no matter what
 * `SaveExtras` and `SaveFile` say they carry. Widening both types and changing
 * nothing else compiled perfectly and lost the offseason on every reload.
 */
export function buildSaveFile(
  slot: string,
  name: string,
  season: SeasonState,
  year: number,
  userTeam: number,
  extras: SaveExtras = {},
  now = Date.now(),
): SaveFile {
  const portable = toPortable(season);

  return {
    schemaVersion: SCHEMA_VERSION,
    slot,
    name,
    savedAt: now,
    year,
    userTeam,
    rngState: portable.rngState,
    season: portable.season,
    history: extras.history ?? [],
    coach: extras.coach,
    ...(extras.postseason ? { postseason: extras.postseason } : {}),
    ...(extras.bracket ? { bracket: extras.bracket } : {}),
    // Named here for the same reason everything else is: this record is built
    // field by field, so widening the types above and stopping there would
    // compile and still drop them.
    ...(extras.myBracket ? { myBracket: extras.myBracket } : {}),
    ...(extras.sideShow ? { sideShow: extras.sideShow } : {}),
    ...(extras.knockout ? { knockout: extras.knockout } : {}),
    ...(Array.isArray(extras.postseasonSeen) && extras.postseasonSeen.length > 0
      ? { postseasonSeen: extras.postseasonSeen }
      : {}),
    ...(extras.jobSearch ? { jobSearch: true } : {}),
    // Beside `jobSearch`, because the two are one fact: dismissed, with these
    // chairs willing to talk. Saving the flag without the offers produced a
    // job-search screen with nothing on it and no way forward.
    ...(Array.isArray(extras.offers) && extras.offers.length > 0
      ? { offers: extras.offers }
      : {}),
    // Where the offseason had got to. Widening `SaveExtras` alone was not
    // enough — this record is built field by field, so anything not named here
    // is silently dropped no matter what the type says it accepts.
    // Stage 7 piece 8. Named here for the reason the comment above gives, and
    // the press state is tested for presence rather than truth: an empty
    // object is a real value meaning "asked nothing yet", and the truthiness
    // idiom would drop it and let a resumed season start its eight again.
    ...(extras.press !== undefined ? { press: extras.press } : {}),
    ...(extras.pendingPress ? { pendingPress: extras.pendingPress } : {}),
    // Nought is a real value -- no conversations spent yet -- so this is
    // tested for presence rather than truth.
    ...(extras.wordsUsed !== undefined ? { wordsUsed: extras.wordsUsed } : {}),
    ...(extras.phase ? { phase: extras.phase } : {}),
    // Tested for presence rather than for truth, unlike every line around it.
    // Nought is a real value here — it means the offseason has only ever been
    // as far as its first step — and the truthiness idiom this record is built
    // on would throw it away and let a reload believe the departures had never
    // run.
    ...(extras.furthestPhase !== undefined
      ? { furthestPhase: extras.furthestPhase }
      : {}),
    ...(extras.review ? { review: extras.review } : {}),
    ...(extras.outcome ? { outcome: extras.outcome } : {}),
    // Same rule again, and this one is the easiest of the lot to lose: an inbox
    // that was dropped and an inbox that was empty look identical on the next
    // load, so nothing would ever report the mistake.
    ...(Array.isArray(extras.inbox) && extras.inbox.length > 0
      ? { inbox: extras.inbox }
      : {}),
    ...(Array.isArray(extras.tutorials) && extras.tutorials.length > 0
      ? { tutorials: extras.tutorials }
      : {}),
    ...(extras.watch ? { watch: extras.watch } : {}),
    // Written whenever it exists rather than only when it differs from the
    // default, because absence already means something here: it is how a save
    // from before the mode says "played in full". A full career that stopped
    // writing the field would be indistinguishable from one that never had it,
    // which is fine today and would stop being fine the moment the default
    // changed. Two keys is a cheap way to never have that conversation.
    ...(extras.depth ? { depth: extras.depth } : {}),
  };
}

export async function saveDynasty(
  slot: string,
  name: string,
  season: SeasonState,
  year: number,
  userTeam: number,
  extras: SaveExtras = {},
): Promise<void> {
  await (await db()).put(STORE, buildSaveFile(slot, name, season, year, userTeam, extras));
}

export interface LoadedDynasty {
  /** The season's press conferences so far, and the one still open. */
  press?: unknown;
  pendingPress?: unknown;
  /** Stage 8: conversations spent this season. */
  wordsUsed?: unknown;
  season: SeasonState;
  year: number;
  userTeam: number;
  name: string;
  /** Completed seasons. Empty for saves written before the record books existed. */
  history: unknown[];
  coach?: unknown;
  postseason: unknown;
  /** The postseason in progress, if a reload landed in the middle of one. */
  bracket: unknown;
  /** Your own tournament inside it, still being played. */
  myBracket: unknown;
  sideShow: unknown;
  /** How your run in it ended, and which modals have already been shown. */
  knockout: unknown;
  postseasonSeen: unknown;
  /** Whether the coach is currently out of a job. */
  jobSearch: unknown;
  /** The offers on his table if he is. Null on saves that predate storing them. */
  offers: unknown;
  /** Where the offseason sequence had got to, and the verdict behind it. */
  phase: unknown;
  furthestPhase: unknown;
  review: unknown;
  outcome: unknown;
  /** Empty for every save written before the inbox existed. */
  inbox: unknown;
  /** First-visit tutorial ids. Empty for saves that predate teaching. */
  tutorials: unknown;
  /** The watchlists, or undefined on saves that predate them. */
  watch: unknown;
  /** The depth preset and its overrides. Null on saves that predate the mode. */
  depth: unknown;
}

/**
 * Bring an older record up to the current shape.
 *
 * Runs on read rather than on database upgrade because these are field
 * migrations, and doing them on read means a save written by an older build
 * still loads even if the browser never ran the upgrade path.
 */
function migrateFile(file: SaveFile): SaveFile {
  if (!Number.isFinite(file.season.scheduleRotation)) {
    // A version 1 save. Rotation 0 is the schedule it was actually played on.
    file.season.scheduleRotation = 0;
  }
  file.schemaVersion = SCHEMA_VERSION;
  return file;
}

export async function loadDynasty(slot: string): Promise<LoadedDynasty | null> {
  const raw = await (await db()).get(STORE, slot);
  if (!raw) return null;

  // Refuse a save from the future BEFORE migrating — migrateFile stamps the
  // current version onto the record, so checking afterwards would always pass.
  if (raw.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `save "${slot}" was written by a newer version of Playball ` +
      `(schema ${raw.schemaVersion}, this build reads ${SCHEMA_VERSION})`,
    );
  }

  const file = migrateFile(raw);

  const season: SeasonState = fromPortable({
    season: file.season,
    rngState: file.rngState,
  });

  return {
    season,
    year: file.year,
    userTeam: file.userTeam,
    name: file.name,
    history: file.history ?? [],
    coach: file.coach,
    postseason: file.postseason ?? null,
    bracket: file.bracket ?? null,
    myBracket: file.myBracket ?? null,
    sideShow: file.sideShow ?? null,
    knockout: file.knockout ?? null,
    postseasonSeen: file.postseasonSeen ?? [],
    jobSearch: file.jobSearch ?? false,
    offers: file.offers ?? null,
    press: file.press ?? {},
    pendingPress: file.pendingPress ?? null,
    wordsUsed: file.wordsUsed ?? 0,
    phase: file.phase ?? null,
    furthestPhase: file.furthestPhase ?? null,
    review: file.review ?? null,
    outcome: file.outcome ?? null,
    inbox: file.inbox ?? [],
    tutorials: file.tutorials ?? [],
    watch: file.watch,
    depth: file.depth ?? null,
  };
}

export async function listSaves(): Promise<SaveSummary[]> {
  const files = await (await db()).getAll(STORE);
  return files
    .map((f) => {
      const team = f.season.teams[f.userTeam];
      return {
        slot: f.slot,
        name: f.name,
        savedAt: f.savedAt,
        year: f.year,
        record: team ? `${team.w}-${team.l}` : '—',
        school: team ? team.def.school : '—',
      };
    })
    .sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteSave(slot: string): Promise<void> {
  await (await db()).delete(STORE, slot);
}
