// pitch.ts
// What a program can honestly tell a recruit about itself.
//
// Split out from recruiting.ts because it is the seam where the recruiting model
// meets the rest of the game. Every number here is read off real season state —
// the prestige the program earned, the record it just posted, the depth chart as
// it actually stands. Nothing is a figure invented for the recruiting screen,
// which is the only thing stopping the pitch system from being flavour text with
// a multiplier attached.

import { armValue, overallOf } from './ratings.js';
import { prestigeStars } from './program.js';
import type { Pitch, Prospect } from './recruiting.js';
import type { SeasonState, TeamRecord } from './season.js';
import type { Region } from '../data/schools.js';
import { uniquePlayers } from './types.js';
import type { Player } from './types.js';

/** Clamp to the 0..1 scale every pitch component uses. */
const unit = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * How open the depth chart is at a recruit's position.
 *
 * The honest version of "you'll play right away": compare him to whoever is
 * standing there now, and account for that man leaving. A senior blocking you is
 * barely blocking you at all.
 *
 * This is the factor that lets a small program beat a blue blood for a specific
 * player, so it has to be real. If it were a flat number per program it would
 * just be prestige again, wearing a different label.
 */
function playingTimeAt(record: TeamRecord, prospect: Prospect): number {
  const p = prospect.player;
  const roster: Player[] = p.type === 'pitcher'
    ? [...record.team.rotation, ...record.team.bullpen]
    : [...record.team.lineup, ...record.team.bench];

  const here = p.type === 'pitcher'
    ? roster
    : roster.filter((r) => r.pos === p.pos);

  const rivals = (here.length > 0 ? here : roster)
    .filter((r): r is Player => r !== undefined);
  if (rivals.length === 0) return 1;

  // The best man in his way, discounted by how soon that man is gone.
  let blocked = 0;
  for (const r of rivals) {
    const leaving = r.classYear === 'SR' ? 0.15 : r.classYear === 'JR' ? 0.6 : 1;
    // In the arm pool a two-way man blocks with his arm, not his bat.
    const worth = p.type === 'pitcher' ? armValue(r as import('./types.js').Arm) : overallOf(r);
    blocked = Math.max(blocked, worth * leaving);
  }

  // Level with the man ahead of him is a real chance to play; well behind is not.
  return unit(0.5 + (overallOf(p) - blocked) / 40);
}

/**
 * A program's pitch, assembled from what is true about it.
 *
 * `winning` reads last season because that is what a recruit signing in the
 * winter actually saw. `development` is the program's record of improving the
 * players it already has, which is the one thing a low prestige program can sell
 * honestly and build an identity around.
 */
export function pitchFor(
  season: SeasonState,
  record: TeamRecord,
  region: Region,
  development = 0.5,
  pipelineStrength?: (state: string) => number,
): Pitch {
  const played = record.w + record.l;
  const winPct = played > 0 ? record.w / played : 0.5;

  return {
    prestige: unit(record.prestige / 100),
    stars: prestigeStars(record.prestige),
    playingTime: (prospect) => playingTimeAt(record, prospect),
    // Centred so a .500 season is a neutral pitch rather than half a good one.
    winning: unit((winPct - 0.35) / 0.4),
    region,
    state: record.def.state,
    development: unit(development),
    ...(pipelineStrength ? { pipelineStrength } : {}),
  };
}

/**
 * How well a program has developed the players it already had.
 *
 * Uses the roster it is carrying right now: how much of each man's ceiling he
 * has actually reached. A program full of players performing near their
 * potential has a real case to make to a recruit; one whose talent stagnates
 * does not, whatever its record says.
 */
export function developmentScore(record: TeamRecord): number {
  const roster: Player[] = uniquePlayers([
    ...record.team.lineup, ...record.team.bench,
    ...record.team.rotation, ...record.team.bullpen,
  ]);
  const grown = roster.filter((p) => p.classYear !== 'FR');
  if (grown.length === 0) return 0.5;

  let sum = 0;
  for (const p of grown) {
    const ceiling = Math.max(1, p.potential);
    sum += Math.min(1.2, overallOf(p) / ceiling);
  }
  return unit((sum / grown.length - 0.62) / 0.3);
}
