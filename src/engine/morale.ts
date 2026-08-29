// morale.ts
// What a man thinks of where he has ended up.
//
// Stage 9, and the channel two finished systems have been waiting for: the
// press room was written to move prestige, morale and how recruits see you, and
// shipped moving two of the three because this did not exist. Stage 8's "a word
// with him" was built as a conversation that happened to be about grades, on the
// explicit understanding that morale would extend it rather than duplicate it.
//
// ---------------------------------------------------------------------------
// What it does, and what it deliberately does not
// ---------------------------------------------------------------------------
//
// Performance and transfer risk. Not development -- decided, and it is the
// right call: a man who is unhappy does not get worse at baseball, he plays a
// little below himself and he starts looking around. Tying development to it
// would compound, and a compounding penalty on a nineteen year old who lost a
// job in March is a death spiral rather than a mood.
//
// ---------------------------------------------------------------------------
// A promise you can break
// ---------------------------------------------------------------------------
//
// The driver that matters is playing time against what he was *told*. That is
// why the expectation is stated rather than inferred: recruiting a man on the
// promise of a job and then sitting him is a thing you did, and the game should
// be able to say so. See `expectationOf`.
//
// Everything here is derived or sparse. A save from before stage 9 has nobody
// unhappy, rather than everybody at zero.

import type { Player, PlayerId, Team } from './types.js';
import { overallOf } from './ratings.js';

/** What a man carries. Sparse, so an older save has none of it. */
export interface Morale {
  /** 0 to 100. Absent means "never moved", which is `SETTLED`. */
  mood?: number;
  /** Games he has started this season, for measuring against the promise. */
  starts?: number;
}

/** Where everybody begins, and where an untouched save reads as. */
export const SETTLED = 62;

/** Below this he is a problem; below `SOURED` he is looking at the portal. */
export const UNHAPPY = 42;
export const SOURED = 25;

export function moodOf(p: Player): number {
  return (p as Player & Morale).mood ?? SETTLED;
}

/** What the card says, in the room's words rather than a number. */
export function mood(p: Player): 'buzzing' | 'fine' | 'restless' | 'unhappy' {
  const m = moodOf(p);
  if (m >= 78) return 'buzzing';
  if (m >= UNHAPPY) return 'fine';
  if (m >= SOURED) return 'restless';
  return 'unhappy';
}

/**
 * What he was told he would be, expressed as the share of games he expects to
 * start.
 *
 * Derived rather than generated, for the reason everything in stages 8 and 9 is
 * derived: a new field at generation moves every draw after it. It reads his
 * standing and his year, which between them are what a coach would actually
 * have promised him -- a top recruit is told he will play, a walk-on is told to
 * earn it, and a senior who has waited three years expects his turn.
 */
export function expectationOf(p: Player, squadRank: number): number {
  const base = squadRank <= 8 ? 0.75 : squadRank <= 12 ? 0.35 : 0.1;
  const seniority = p.classYear === 'SR' ? 0.12
    : p.classYear === 'JR' ? 0.06
      : p.classYear === 'FR' ? -0.14 : 0;
  // A walk-on was told nothing at all, and knows it.
  const walkOn = (p as Player & { walkOn?: boolean }).walkOn ? -0.2 : 0;
  return Math.max(0, Math.min(0.95, base + seniority + walkOn));
}

/** In words, for the card, since a share of games is not how anybody thinks. */
export function promiseOf(p: Player, squadRank: number): string {
  const e = expectationOf(p, squadRank);
  if (e >= 0.7) return 'expects to start';
  if (e >= 0.3) return 'expects to play a good deal';
  if (e >= 0.12) return 'expects to be in the mix';
  return 'is here to earn it';
}

/**
 * A season's worth of mood, settled at the year roll.
 *
 * Four things move it, and the first is the one with teeth.
 */
export function settleMood(
  p: Player,
  opts: {
    /** Games he started, and games the team played. */
    starts: number;
    games: number;
    squadRank: number;
    /** Winning percentage, which everybody feels. */
    winPct: number;
    /** True if the coach moved him off his position and he did not ask. */
    movedUnwillingly?: boolean;
    /** A captain in the room damps everything. See `captains.ts`. */
    damped?: boolean;
  },
): number {
  const before = moodOf(p);
  const expected = expectationOf(p, opts.squadRank);
  const got = opts.games > 0 ? opts.starts / opts.games : 0;

  /*
    The promise, kept or broken.

    Scaled so that missing the promise entirely is worth about twenty points and
    beating it is worth about ten -- deliberately asymmetric. A man given more
    than he was promised is pleased; a man given far less than he was promised
    is *aggrieved*, which is a stronger feeling and the one that eventually
    walks out of the door.
  */
  const gap = got - expected;
  const promise = gap >= 0 ? gap * 14 : gap * 28;

  // Winning, which everybody feels and nobody feels as strongly as their own
  // playing time.
  const winning = (opts.winPct - 0.5) * 16;

  // Being moved off your position without asking. Small, and it is the reason
  // stage 8's position change is *proposed* rather than ordered.
  const moved = opts.movedUnwillingly ? -7 : 0;

  const raw = before + promise + winning + moved;
  /*
    A captain does not make anybody happy. He stops a room swinging, which is a
    different and more truthful thing -- so this pulls the *change* back toward
    nothing rather than pulling the mood up.
  */
  const next = opts.damped ? before + (raw - before) * 0.6 : raw;
  return Math.max(0, Math.min(100, Math.round(next)));
}

/** Write it. */
export function setMood(p: Player, to: number): void {
  (p as Player & Morale).mood = Math.max(0, Math.min(100, Math.round(to)));
}

/**
 * What being unhappy does on the field.
 *
 * Three percent at the very bottom, and nothing at all until he is genuinely
 * unhappy -- the same size as the legs, and for the same reason. A mood is not
 * a rating, and a game where the sulking man cannot hit is a game about
 * management rather than about baseball.
 */
export function moodMultiplier(p: Player): number {
  const m = moodOf(p);
  if (m >= UNHAPPY) return 1;
  return 1 - ((UNHAPPY - m) / UNHAPPY) * 0.03;
}

/**
 * How likely he is to look elsewhere, nought to one.
 *
 * Read by the portal in stage 10. Nothing consumes it yet, and it is written
 * now rather than later because the mood that drives it is being modelled now
 * and a number nobody reads is cheaper to keep honest than one added in a hurry
 * against a system already shipped.
 */
export function flightRisk(p: Player): number {
  const m = moodOf(p);
  if (m >= UNHAPPY) return 0;
  return Math.min(1, (UNHAPPY - m) / UNHAPPY);
}

/** A day started, counted. */
export function started(p: Player): void {
  const m = p as Player & Morale;
  m.starts = (m.starts ?? 0) + 1;
}

/** Where a man sits in his own squad, best first, for the promise. */
export function squadRanks(team: Team): Map<PlayerId, number> {
  const all = [...team.lineup, ...team.bench];
  const order = [...all].sort((a, b) => overallOf(b) - overallOf(a));
  const out = new Map<PlayerId, number>();
  order.forEach((p, i) => out.set(p.id, i + 1));
  return out;
}
