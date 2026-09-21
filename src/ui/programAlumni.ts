import { careerName, type CareerYear } from '../engine/season.js';
import type { AlumnusNote } from '../engine/legacy.js';
import type { Inductee } from '../engine/hall.js';
import type { PlayerId } from '../engine/types.js';
import type { useDynasty } from '../state/store.js';

type ArchiveState = Pick<ReturnType<typeof useDynasty.getState>, 'season' | 'alumni' | 'portal'>;
export interface ProgramAlumnus {
  id: PlayerId;
  name: string;
  year: number;
  classYear?: string;
  career: CareerYear[];
  note?: AlumnusNote;
  hall?: Inductee;
}

/**
 * Older saves can have college careers and Hall plaques without departure
 * notes. Merge the evidence for this school without inventing a draft result,
 * graduation, rating, or professional career, or changing the save.
 */
export function programAlumni({ season, alumni, portal }: ArchiveState, teamAbbr: string): ProgramAlumnus[] {
  const active = new Set<string>();
  for (const t of season?.teams ?? []) {
    for (const p of [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen]) active.add(p.id);
  }
  // Portal players are still in college, even while between rosters.
  for (const p of [...(portal?.leaving ?? []), ...(portal?.available ?? [])]) active.add(p.player.id);
  const hall = new Map((season?.hall ?? []).map(p => [String(p.id), p]));
  const ids = new Set([...Object.keys(alumni), ...Object.keys(season?.careers ?? {}), ...hall.keys()]);
  const rows: ProgramAlumnus[] = [];
  for (const key of ids) {
    if (active.has(key)) continue;
    const id = key as PlayerId, note = alumni[id], plaque = hall.get(id);
    const career = (season?.careers?.[id] ?? []).filter(y => y.team === teamAbbr);
    if (note?.teamAbbr !== teamAbbr && career.length === 0 && !plaque?.teams.includes(teamAbbr)) continue;
    const last = [...career].sort((a, b) => b.year - a.year)[0];
    rows.push({
      id, note, hall: plaque, career,
      name: note?.name ?? plaque?.name ?? careerName(id, career),
      year: note?.teamAbbr === teamAbbr ? note.year : last?.year ?? plaque?.last ?? note!.year,
      classYear: last?.classYear ?? note?.classYear,
    });
  }
  return rows;
}
