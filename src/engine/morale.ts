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

import type { RecruitPromise } from './types.js';
import type { Player, PlayerId, Position, Team } from './types.js';
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
  const ordinary = Math.max(0, Math.min(0.95, base + seniority + walkOn));
  // A recruiting promise is explicit. It outranks the expectation inferred
  // from his current squad rank because that was the bargain used to sign him.
  return p.recruitPromise?.kind === 'immediateRole' ? Math.max(0.62, ordinary) : ordinary;
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
 * How many seasons a promise binds. An immediate role, no redshirt and a
 * two-way chance are all about the first year on campus; keeping a man at
 * his position is a two-year word. After its last judgement the promise comes
 * off him at the following roll — kept or broken, it has been answered.
 */
export const promiseHorizon = (kind: RecruitPromise['kind']): number =>
  kind === 'keepPosition' ? 2 : 1;

/** True once every season the promise covered has been judged. */
export const promiseSpent = (promise: RecruitPromise | undefined): boolean =>
  promise !== undefined && (promise.judged ?? 0) >= promiseHorizon(promise.kind);

export const TWO_WAY_BATTING_GAMES = 8;
export const TWO_WAY_PITCHING_GAMES = 3;
export const PROMISE_DETAIL: Record<RecruitPromise['kind'], string> = {
  immediateRole: 'First season: start at least 62% of games. His squad standing can raise that expectation.',
  noRedshirt: 'First season: keep him on the active roster instead of redshirting.',
  keepPosition: 'First two seasons: keep his recruited position.',
  twoWayOpportunity: `First season: at least ${TWO_WAY_BATTING_GAMES} batting appearances and ${TWO_WAY_PITCHING_GAMES} pitching appearances.`,
};
export interface PromiseParticipation { battingGames?: number; pitchingGames?: number }

/** The same requirements used to judge a promise, expressed for the player card. */
export function recruitPromiseProgress(p: Player, at: PromiseParticipation & { starts: number; games: number }) {
  const promise = p.recruitPromise;
  if (!promise) return null;
  const duration = promiseHorizon(promise.kind);
  const term = `${duration === 1 ? 'First season' : 'First two seasons'} · ${promise.judged ?? 0}/${duration} seasons reviewed`;
  if (promise.kind === 'twoWayOpportunity') return {
    title: 'Two-way opportunity', term,
    detail: `Batting appearances: ${at.battingGames ?? 0}/${TWO_WAY_BATTING_GAMES}. Pitching appearances: ${at.pitchingGames ?? 0}/${TWO_WAY_PITCHING_GAMES}. Both totals must be met by season end.`,
  };
  if (promise.kind === 'keepPosition') {
    // The same home the judge reads, or the sheet would report a broken
    // promise about a man covering second base for one afternoon.
    const home = (p as Player & { homePos?: Position }).homePos ?? p.pos;
    return {
      title: 'Keep position', term,
      detail: `Promised position: ${promise.promisedPos ?? home}. Current position: ${home}. A permanent position change can break this promise.`,
    };
  }
  if (promise.kind === 'noRedshirt') return {
    title: 'No redshirt', term,
    detail: (p as Player & { redshirt?: boolean }).redshirt ? 'Currently redshirted. This conflicts with the promise.' : 'Not redshirted. Keep him eligible to play this season.',
  };
  return {
    title: 'Immediate role', term,
    detail: `${at.starts} starts in ${at.games} team games. He expects to start at least 62% of games; a higher squad standing can raise that expectation.`,
  };
}

/** Whether a promise can already be judged from the player's state. */
export function explicitRecruitPromiseBroken(
  p: Player, opts: PromiseParticipation = {},
): boolean {
  const promise = p.recruitPromise;
  if (!promise) return false;
  if (promise.kind === 'keepPosition') {
    /*
      Judged from where he lives, not from what the card says tonight.

      `p.pos` is the lineup-card label and `adoptSpot` overwrites it whenever a
      man covers a spot that is not his, stashing the real one in `homePos` for
      `restoreHome` to put back. So a shortstop filling in at second for an
      afternoon was reading as a broken promise, and `bestNine` relabels the
      whole country's nine every time a card is dealt.

      Measured 2026-09-11, seed 4242: 180 of 1248 hitters — 14.4% — are wearing
      a cover label at any moment, and every one of the 180 is a pure relabel
      with `homePos` intact. Nobody had been moved anywhere.
    */
    const home = (p as Player & { homePos?: Position }).homePos ?? p.pos;
    return promise.promisedPos !== undefined && home !== promise.promisedPos;
  }
  if (promise.kind === 'noRedshirt') return (p as Player & { redshirt?: boolean }).redshirt === true;
  if (promise.kind === 'twoWayOpportunity') {
    // Unknown participation is not evidence of a broken promise. Season callers
    // pass explicit zeroes when a player really has no appearances.
    if (opts.battingGames === undefined || opts.pitchingGames === undefined) return false;
    return opts.battingGames < TWO_WAY_BATTING_GAMES || opts.pitchingGames < TWO_WAY_PITCHING_GAMES;
  }
  return false;
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
    /** A specific recruiting promise (position/redshirt/two-way role) was broken. */
    promiseBroken?: boolean;
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
  const broken = opts.promiseBroken ? -13 : 0;

  const raw = before + promise + winning + moved + broken;
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

/**
 * Where a man sits in his own squad, best first, for the promise.
 *
 * Two rooms, because a pitcher is not competing with a shortstop for a place.
 * Until 2026-09-11 this walked the lineup and the bench only, so every arm in
 * the country fell through to the caller's default of twentieth and read as a
 * man nobody had any use for — for life, whatever he did.
 *
 * The arms come back on the hitters' scale rather than their own, so one
 * number means one thing everywhere it is read: the four who take the ball
 * are the equivalent of an everyday nine, the next four of a bench, and the
 * rest of a roster spot. A staff is ten men where a squad is thirty, and
 * without the shift the eighth-best arm would have been asked to work like a
 * number one.
 */
export function squadRanks(team: Team): Map<PlayerId, number> {
  const out = new Map<PlayerId, number>();
  const rank = (group: readonly Player[], scale: (at: number) => number): void => {
    const order = [...group].sort((a, b) => overallOf(b) - overallOf(a));
    order.forEach((p, i) => {
      const at = scale(i + 1);
      const had = out.get(p.id);
      // A two-way man stands in both rooms, and is judged by the better of them.
      if (had === undefined || at < had) out.set(p.id, at);
    });
  };
  rank([...team.lineup, ...team.bench], (at) => at);
  rank([...team.rotation, ...team.bullpen], (at) => (at <= 4 ? at : at + 4));
  return out;
}

/** True for a man whose season is measured in appearances, not starts. */
export const isArm = (p: Player): boolean => p.type === 'pitcher';

/**
 * A pitcher's season in the terms the expectation model speaks.
 *
 * A hitter's share is starts over games his team played. An arm's cannot be:
 * nobody pitches forty-five times, and a starter who takes every turn he is
 * given has taken all there was to take. So he is measured against the
 * busiest man on his own staff — which needs no invented constant, and asks
 * the question he would actually ask, which is whether he is being used like
 * the men around him.
 *
 * **Against the busiest man doing HIS job, though.** Reported 2026-09-12: "I
 * have a starter trying for the portal because he was told he was going to
 * play was broken, but he had started 8 games in the season."
 *
 * The busiest arm on any staff is always a reliever — a four-man rotation
 * makes eleven to fourteen starts while the pen's workhorse appears fourteen
 * to twenty-eight times — so every starter in the country was measured against
 * a number no starter can reach, and an ace who took every single turn read as
 * a man being buried. Measured across seeds 4242, 7 and 99: starters reading
 * "He was told he would play" fall from 143 of 1152 (12.4%) to 7 of 1152
 * (0.6%), while relievers are unmoved at 123 to 122 of 1728 — which is right,
 * because a reliever who never gets the ball genuinely is buried.
 *
 * The fallback to the whole staff is what keeps the never-divide-by-zero
 * guard honest for a program that has no arm of his kind at all.
 */
export function armShare(
  p: Player, staff: readonly Player[], appearances: (id: PlayerId) => number,
): { starts: number; games: number } {
  const startsGames = (a: Player): boolean =>
    (a as Player & { role?: string }).role === 'SP';
  const mine = startsGames(p);
  let group = 0;
  let any = 0;
  for (const a of staff) {
    const n = appearances(a.id);
    any = Math.max(any, n);
    if (startsGames(a) === mine) group = Math.max(group, n);
  }
  return { starts: appearances(p.id), games: Math.max(1, group || any) };
}
