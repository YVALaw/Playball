// injury.ts
// The thing a depth chart is for.
//
// Stage 9. Stage 8 built the machinery -- `outUntil`, `why`, and a chart that
// promotes the next man -- and left `'injury'` in the union with nothing to
// write it. This writes it.
//
// ---------------------------------------------------------------------------
// League-wide, and what that costs
// ---------------------------------------------------------------------------
//
// Decided rather than assumed, and the opposite of the call grades got. Grades
// are one program's business because nobody can see another program's
// classroom. An injury is the other way round entirely: a rival losing his ace
// is visible, it changes the team you are about to play, and a league where
// only the coached program breaks down is a league that is lying to you.
//
// The price is that this moves calibration -- fewer good players on the field
// means fewer runs -- so the goldens are re-recorded against a measured pass
// rather than assumed to be fine.
//
// ---------------------------------------------------------------------------
// Derived, not drawn
// ---------------------------------------------------------------------------
//
// Asked for as pure chance, with no durability rating to read. That makes the
// roll invisible, which makes *where it comes from* matter more, not less: a
// hidden roll a player could re-roll by reloading is a slot machine. So it is
// derived from the man, the day and the world -- the same discipline as
// `badgeThreshold`, the press pool and the classroom.
//
// It also means adding this took no draw out of the season generator. The
// numbers move because men miss games, which is the honest reason, and not
// because the stream shifted underneath everything.

import type { Player, PlayerId } from './types.js';

/** What an injury is, once it has happened. */
export interface Injured {
  /** Day index he is fit again. */
  outUntil?: number;
  why?: 'academic' | 'injury';
  /** What it was, for the card. */
  hurt?: string;
  /** Games missed this season, so a card can add them up. */
  missed?: number;
}

/**
 * How often, per man per game.
 *
 * Calibrated to a season rather than to a game, which is the only scale the
 * number means anything on: a program plays 45 games with 9 men on the field,
 * so this rate times 405 appearances is how many injuries a roster carries in a
 * year. At 0.0022 that is roughly one man hurt per program per season and a
 * little change -- enough that a depth chart earns its keep, not so much that a
 * roster is a casualty ward by May.
 *
 * Asked for explicitly: "we don't want to have our roster dead after a few
 * games."
 */
const PER_APPEARANCE = 0.0022;

/**
 * What kind, and for how long.
 *
 * Weighted heavily toward the short end because that is what the sport looks
 * like -- most of what takes a man out takes him out for a weekend series, and
 * the long ones are rare enough to be a story when they happen.
 *
 * The season-ending tail is deliberately thin: at three percent of injuries, a
 * program sees one roughly every three seasons. It is the case the whole depth
 * chart exists for, and a game that produced it monthly would be a game about
 * injuries rather than a game with them in it.
 */
const KINDS: readonly { what: string; days: readonly [number, number]; weight: number }[] = [
  { what: 'a tight hamstring', days: [3, 6], weight: 30 },
  { what: 'a jammed thumb', days: [4, 8], weight: 22 },
  { what: 'a bruised heel', days: [3, 7], weight: 15 },
  { what: 'a strained oblique', days: [10, 18], weight: 14 },
  { what: 'a sprained ankle', days: [12, 24], weight: 9 },
  { what: 'a shoulder problem', days: [20, 40], weight: 7 },
  { what: 'a torn ligament', days: [200, 200], weight: 3 },
];

const TOTAL_WEIGHT = KINDS.reduce((a, k) => a + k.weight, 0);

/** A small integer hash. Same trick, same reasons: stable, and it costs no draw. */
function hash(id: PlayerId, day: number, worldSeed: number, salt: number): number {
  let h = (((worldSeed ^ 0x9e3779b9) >>> 0) + day * 2654435761 + salt * 40503) >>> 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Whether today is the day, for one man who is playing.
 *
 * `strain` is what stage 9's workload adds on top: a tired man is likelier to
 * pull something, which is the whole reason resting somebody is a decision. It
 * is a multiplier and it is deliberately gentle -- see `workload.ts`.
 */
export function hurtsToday(
  p: Player, day: number, worldSeed: number, strain = 1,
): { what: string; days: number } | null {
  const roll = hash(p.id, day, worldSeed, 1) % 100000 / 100000;
  if (roll >= PER_APPEARANCE * strain) return null;

  // Which one, off a second, independent hash -- the same draw deciding both
  // whether and how badly would correlate the tail with the near-misses.
  const pick = (hash(p.id, day, worldSeed, 2) % TOTAL_WEIGHT);
  let seen = 0;
  for (const k of KINDS) {
    seen += k.weight;
    if (pick < seen) {
      const [lo, hi] = k.days;
      const spread = hash(p.id, day, worldSeed, 3) % Math.max(1, hi - lo + 1);
      return { what: k.what, days: lo + spread };
    }
  }
  return null;
}

/** Put him on the shelf. */
export function hurt(p: Player, day: number, what: string, days: number): void {
  const i = p as Player & Injured;
  i.outUntil = day + days;
  i.why = 'injury';
  i.hurt = what;
}

/** Whether he is currently hurt, as opposed to ineligible or fine. */
export function isHurt(p: Player, day: number): boolean {
  const i = p as Player & Injured;
  return i.why === 'injury' && typeof i.outUntil === 'number' && day < i.outUntil;
}

/** How long is left, in days, for a card to print. */
export function daysLeft(p: Player, day: number): number {
  const i = p as Player & Injured;
  if (!isHurt(p, day)) return 0;
  return Math.max(0, (i.outUntil ?? 0) - day);
}

/**
 * What the card says, without a number of days nobody can feel.
 *
 * "Out four weeks" is a fact; "out 27 days" is a spreadsheet. The bands are the
 * ones a trainer would actually use.
 */
export function prognosis(p: Player, day: number): string {
  const left = daysLeft(p, day);
  if (left === 0) return 'fit';
  if (left >= 150) return 'out for the season';
  if (left >= 28) return `out about ${Math.round(left / 7)} weeks`;
  if (left >= 10) return 'out a fortnight or so';
  if (left >= 4) return 'out a few days';
  return 'day to day';
}

/** Clear everything an injury left, at the year roll. */
export function healUp(p: Player): void {
  const i = p as Player & Injured;
  if (i.why === 'injury') { delete i.outUntil; delete i.why; delete i.hurt; }
  delete i.missed;
}
