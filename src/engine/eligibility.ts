// eligibility.ts
// The one thing in this sport that has nothing to do with baseball.
//
// Stage 8. A man fails a class and he sits, and no professional league has an
// equivalent -- which is exactly why it is here. It is the most college thing
// the game can model, and it turns "recruit the best player available" into a
// question with a second half.
//
// ---------------------------------------------------------------------------
// Your program only
// ---------------------------------------------------------------------------
//
// Decided rather than assumed: grades are kept for the men you coach and for
// nobody else. Ninety-five other programs quietly losing shortstops to a
// classroom would be ninety-five sets of numbers nobody ever reads, a slower
// season roll, and a save that grows for it -- to model a thing the player
// cannot see, act on, or be affected by except as noise in somebody else's
// record. The rule the whole game keeps is that the engine models everything
// that reaches the player. This never reaches him.
//
// ---------------------------------------------------------------------------
// Visible and manageable, not a hidden roll
// ---------------------------------------------------------------------------
//
// Asked for in those terms, and it is the right call: a hidden roll that takes
// your shortstop out of a regional is a punishment, while a number you could
// see and did not act on is a decision you got wrong. So every man carries a
// standing you can read, the ones in trouble say so, and there is something you
// can spend on them.
//
// ---------------------------------------------------------------------------
// Derived, and it takes no draw
// ---------------------------------------------------------------------------
//
// A man's standing is derived from his id when nothing has been written for
// him, the way `badgeThreshold` and the press pool derive theirs. Two reasons,
// both load-bearing: adding a generated field would move every random draw
// after it and break every golden, and a check that consumed from the season
// generator would make *whether the player looked at a screen* change the rest
// of the year.

import type { Player, PlayerId } from './types.js';

/** Below this he is one bad week from sitting. */
export const AT_RISK = 42;
/** Below this he is already sitting, or about to be. */
export const FAILING = 28;
/** How long he misses. One week, decided. */
export const WEEK = 7;

/** How much a conversation is worth, and how many you get. */
export const WORD_LIFT = 9;
export const WORDS_A_SEASON = 4;

/** What a man carries. Sparse, so a save from before stage 8 has none. */
export interface Academic {
  /** 0 to 100. Absent means "never written", and is derived. */
  grades?: number;
  /** Day index he is eligible again. */
  outUntil?: number;
  why?: 'academic' | 'injury';
  /** Conversations already spent on him this season. */
  talkedTo?: number;
}

/**
 * A small integer hash of the id, so a man's standing is the same every time
 * anybody asks and different between men.
 *
 * The same trick `badgeThreshold` uses, and for the same two reasons: it costs
 * no field on the save and no draw from any generator.
 */
function derive(id: PlayerId): number {
  let h = 0x811c9dc5 >>> 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  /*
    Skewed high, and it has to reach the bottom.

    Most college players are fine, so a distribution centred mid-scale would
    flag a third of every roster and turn a colour on a card into wallpaper.
    The first version handled that by starting at 34 -- which put the floor
    *above* `FAILING` and made 'trouble' a state nobody in the country could
    ever be in. That is the same mistake as a title nobody could wear, caught
    by the test that asks for a man in it.

    So the range spans the whole scale and the shape does the work instead:
    one man in six under `AT_RISK`, one in eighteen genuinely failing.
  */
  const u = (h % 1000) / 1000;
  return Math.round(20 + 75 * (1 - (1 - u) ** 2));
}

/** His standing, written or derived. */
export function gradesOf(p: Player): number {
  const a = p as Player & Academic;
  return a.grades ?? derive(p.id);
}

/** Whether the card should be saying something about him. */
export const atRisk = (p: Player): boolean => gradesOf(p) < AT_RISK;

/** What the card says, in the registrar's words rather than a number. */
export function standing(p: Player): 'fine' | 'watch' | 'trouble' {
  const g = gradesOf(p);
  if (g < FAILING) return 'trouble';
  if (g < AT_RISK) return 'watch';
  return 'fine';
}

/**
 * Whether this week is the week it catches up with him.
 *
 * Derived from the man, the year and the week rather than drawn, so a reload
 * cannot re-roll a suspension and reading the screen cannot change the season.
 * Only men already under `AT_RISK` are ever asked about.
 */
function failsAt(p: Player, year: number, week: number): boolean {
  const g = gradesOf(p);
  if (g >= AT_RISK) return false;
  let h = ((year * 2654435761) ^ (week * 40503)) >>> 0;
  const s = String(p.id);
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  /*
    How likely, and why it is not certain.

    A man under the line every week would be a man you simply cannot play,
    which is a roster spot removed rather than a risk taken. Steeper the worse
    he is doing, so that the man in real trouble is the one it keeps taking.

    ---------------------------------------------------------------------------
    Why these numbers are a third of what they were
    ---------------------------------------------------------------------------

    Reported as happening "way too often", and it was: `tests/elig-rate.ts` put
    it at 3.27 suspensions a season. The reason is a number nobody set and
    everybody assumed. This runs on `dayIndex % 7`, and a college regular season
    here is about forty five days -- so it is asked SIX times a year, not the
    fifteen-odd a real spring would have. The old 7%-to-23% band was a sane
    per-week rate for a long season, and against six checks it meant somebody
    was in the classroom better than every other week, which is not a program
    with a couple of academic problems on it. It is a program where nobody goes
    to class.

    So the band is set against the six checks that actually happen, for a little
    over one suspension a season: rare enough to be an event, common enough that
    a roster with two men in trouble on it is a roster you have to think about.
  */
  const depth = Math.max(0, AT_RISK - g) / AT_RISK;
  const chance = 0.008 + depth * 0.09;
  return (h % 1000) / 1000 < chance;
}

/**
 * Whether this week is the week it catches up with him.
 *
 * Derived from the man, the year and the week rather than drawn, so a reload
 * cannot re-roll a suspension and reading the screen cannot change the season.
 * Only men already under `AT_RISK` are ever asked about.
 *
 * Never twice running. A man who sat out last week has had the conversation,
 * the study table and the fright; taking him again immediately is the game
 * repeating itself rather than saying something new. Done by asking the same
 * pure function about last week instead of by remembering anything, so it still
 * costs no field on the save and no draw from any generator.
 */
export function failsThisWeek(p: Player, year: number, week: number): boolean {
  if (!failsAt(p, year, week)) return false;
  return !(week > 0 && failsAt(p, year, week - 1));
}

/** Sit him down. Mutates, because being ineligible is a fact about the man. */
export function suspend(p: Player, day: number): void {
  const a = p as Player & Academic;
  a.outUntil = day + WEEK;
  a.why = 'academic';
}

/**
 * A word with him.
 *
 * The one thing a coach can spend on this, and deliberately not money: the
 * economy is stage 11 and building against a system that does not exist is how
 * a title nobody could earn shipped. It is the same shape as the three letters
 * a season and the draft's keep budget -- scarce, per-season, does not carry.
 *
 * Reads the coach so the man you built matters, which is the rule stage 7
 * established: a coach who trains gets more out of the same conversation.
 */
export function haveAWord(p: Player, trainingSkill: number): number {
  const a = p as Player & Academic;
  const lift = WORD_LIFT + Math.round((trainingSkill - 20) / 12);
  const before = gradesOf(p);
  a.grades = Math.min(100, before + Math.max(4, lift));
  a.talkedTo = (a.talkedTo ?? 0) + 1;
  return a.grades - before;
}

/** A term's drift, applied at the year roll. */
export function driftGrades(p: Player, year: number): void {
  const a = p as Player & Academic;
  const g = gradesOf(p);
  let h = ((year * 374761393) ^ 0x9e3779b9) >>> 0;
  const s = String(p.id);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  /*
    Toward the middle, slowly, with a nudge either way.

    A man who was talked back up to eighty does not stay at eighty for four
    years on one conversation, and one who scraped through at thirty is not
    doomed by a number he was generated with. Both drift home, which is what
    keeps the conversations worth having every season rather than once.
  */
  const nudge = ((h % 13) - 6);
  a.grades = Math.max(5, Math.min(100, Math.round(g + (55 - g) * 0.12 + nudge)));
  a.talkedTo = 0;
}
