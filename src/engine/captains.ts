// captains.ts
// The one man in the room who is not only a player.
//
// Stage 9. One captain, appointed by the coach, and he has to have the makeup
// for it -- all three decided rather than inferred.
//
// ---------------------------------------------------------------------------
// Why the trait gate is the whole feature
// ---------------------------------------------------------------------------
//
// Asked for directly: "for captains they have to have the right traits in their
// personality." Without that, naming a captain is a free buff you apply to your
// best player and forget, and the answer is always the same man. With it, the
// question becomes *who in this room is actually like that*, which is a real
// question with a different answer every few years -- and sometimes the answer
// is a man who is not close to your best player, which is exactly what makes it
// worth a screen.
//
// The gate reads the `makeup` badge family, which already exists and already
// means what this needs it to mean: `gymRat` is the man who is first in,
// `noPanic` is the man who does not come apart, `bigStage` is the man who turns
// up in June. A player holding one of those is a player the room would follow.
//
// ---------------------------------------------------------------------------
// What he does
// ---------------------------------------------------------------------------
//
// He damps mood swings across the whole roster -- see `settleMood` -- and he
// does not make anybody happy. That distinction is the design: a captain is not
// a morale bonus, he is the reason a bad April does not become a mutiny.

import { uniquePlayers } from './types.js';
import type { Player, PlayerId, Team } from './types.js';
import { overallOf } from './ratings.js';

/** What a captaincy is, stored on the team. Sparse, so older saves have none. */
export interface Captained {
  captain?: PlayerId;
}

/** The badges that make a man captain material. */
const LEADERSHIP: readonly string[] = ['gymRat', 'noPanic', 'bigStage'];

/** Whether the room would follow him. */
export function canLead(p: Player): boolean {
  // Freshmen do not lead rooms, whatever they are made of. A year in the place
  // is the least the job asks.
  if (p.classYear === 'FR') return false;
  const badges = (p as Player & { badges?: { id: string }[] }).badges ?? [];
  return badges.some((b) => LEADERSHIP.includes(b.id));
}

/** Everybody eligible, best first — the shortlist the screen shows. */
export function candidates(team: Team): Player[] {
  // One body once: a two-way man is one name on the shortlist.
  const all: Player[] = uniquePlayers([
    ...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen,
  ]);
  return all.filter(canLead).sort((a, b) => overallOf(b) - overallOf(a));
}

/**
 * Who the room would pick if nobody asked the coach.
 *
 * Shown beside the choice rather than applied, so that ignoring it is a visible
 * decision instead of an invisible one. Seniority first and ability second,
 * because that is how a dressing room actually picks and not how a spreadsheet
 * would.
 */
export function roomsChoice(team: Team): Player | null {
  const rank: Record<string, number> = { SR: 3, JR: 2, SO: 1, FR: 0 };
  return [...candidates(team)]
    .sort((a, b) => (rank[b.classYear] ?? 0) - (rank[a.classYear] ?? 0)
      || overallOf(b) - overallOf(a))[0] ?? null;
}

/** The current captain, if he is still here and still eligible. */
export function captainOf(team: Team): Player | null {
  const id = (team as Team & Captained).captain;
  if (!id) return null;
  const all: Player[] = [
    ...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen,
  ];
  const man = all.find((p) => p.id === id);
  // A captain who graduated is not a captain, and the room notices before the
  // save file does.
  return man && canLead(man) ? man : null;
}

/** Name him. Refuses anybody the room would not follow. */
export function appoint(team: Team, p: Player): boolean {
  if (!canLead(p)) return false;
  (team as Team & Captained).captain = p.id;
  return true;
}

export function standDown(team: Team): void {
  delete (team as Team & Captained).captain;
}
