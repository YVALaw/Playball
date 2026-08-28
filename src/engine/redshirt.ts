// redshirt.ts
// The year that does not count.
//
// Stage 8, and the rule was decided here rather than asked, so it is worth
// writing down what it actually is.
//
// ---------------------------------------------------------------------------
// The real rule
// ---------------------------------------------------------------------------
//
// A college player has five calendar years to play four seasons. Sit out a full
// year and the year is spent but the *season* is not, so he is still yours for
// four playing years afterwards. Baseball is stricter than football about it:
// there is no four-game grace period, and one appearance burns the season. So a
// redshirt here is all or nothing, which is what makes it a decision instead of
// a formality.
//
// ---------------------------------------------------------------------------
// What it costs and what it buys
// ---------------------------------------------------------------------------
//
// It costs a body on a twenty-three man roster for a whole season -- a real
// price, and the reason `MAX_REDSHIRTS` exists at all is that without one the
// answer is to redshirt every freshman every year. It buys a fifth year, which
// turns a man you would lose to graduation into a man you still have.
//
// The decision it creates is the one worth having: your promising freshman is
// behind a senior. Play him now for a hundred at-bats he is not ready for, or
// sit him and have him as a senior when the senior is gone.

import type { Player, Team } from './types.js';
import { squad } from './depthChart.js';

/** Three a season. Without a cap, a whole class sits every year. */
export const MAX_REDSHIRTS = 3;

/** What a redshirt carries. Sparse, so an older save has nobody sitting. */
export interface Redshirtable {
  /** Sitting out this season. */
  redshirt?: boolean;
  /** Seasons already used up. A man gets four. */
  seasonsUsed?: number;
  /** Years he has already spent sitting. A man gets one. */
  redshirtsUsed?: number;
}

/**
 * Who may be sat down.
 *
 * Freshmen and sophomores only. A junior sitting out is a man who has already
 * given you most of what he has, and a senior sitting out is a man saying
 * goodbye a year late -- neither is the decision this is for. He must also not
 * have done it before: the rule is one redshirt year, not a way to keep a good
 * player for eight.
 */
export function canRedshirt(p: Player): boolean {
  const r = p as Player & Redshirtable;
  if (r.redshirt) return false;
  if ((r.redshirtsUsed ?? 0) > 0) return false;
  return p.classYear === 'FR' || p.classYear === 'SO';
}

/** How many this program is already sitting. */
export function redshirtCount(team: Team): number {
  return squad(team).filter((p) => (p as Player & Redshirtable).redshirt).length
    + [...team.rotation, ...team.bullpen]
      .filter((p) => (p as Player & Redshirtable).redshirt).length;
}

/** Sit him down for the year, if the rules allow it. */
export function redshirt(team: Team, p: Player): boolean {
  if (!canRedshirt(p)) return false;
  if (redshirtCount(team) >= MAX_REDSHIRTS) return false;
  (p as Player & Redshirtable).redshirt = true;
  return true;
}

/** Change your mind, which is only allowed before he has missed anything. */
export function unRedshirt(p: Player): void {
  delete (p as Player & Redshirtable).redshirt;
}

/**
 * What the year did to a man who sat it out, applied at the roll.
 *
 * He does *not* advance a class year -- that is the whole point, and it is what
 * `departAndDevelop` must be told to skip for him. He does age, and he banks
 * the redshirt so he cannot take a second one.
 *
 * Returns the multiplier his development should use. Slightly under one: a year
 * in the weight room against a year of live pitching is a real trade, and a
 * redshirt who came back *better* than the man who played would make sitting
 * everybody the correct move.
 */
export const REDSHIRT_GROWTH = 0.85;

export function bankRedshirt(p: Player): number {
  const r = p as Player & Redshirtable;
  r.redshirtsUsed = (r.redshirtsUsed ?? 0) + 1;
  delete r.redshirt;
  return REDSHIRT_GROWTH;
}

/**
 * What a staff would do, for a career that has asked not to be asked.
 *
 * Sits the men who would not have played anyway: a freshman who is nobody's
 * first or second choice is a freshman spending a season on the bench, and
 * spending it in the weight room instead is what a real staff does with him.
 */
export function staffRedshirts(team: Team, depthRank: (p: Player) => number): Player[] {
  const out: Player[] = [];
  const candidates = [...squad(team), ...team.rotation, ...team.bullpen]
    .filter((p) => canRedshirt(p) && p.classYear === 'FR')
    .sort((a, b) => depthRank(b) - depthRank(a));
  for (const p of candidates) {
    if (out.length >= MAX_REDSHIRTS) break;
    // Third choice or worse at his own spot. Anybody higher is playing.
    if (depthRank(p) < 2) continue;
    if (redshirt(team, p)) out.push(p);
  }
  return out;
}
