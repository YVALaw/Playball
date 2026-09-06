// leagueNames.ts
// What a league is called on screen, once a sandbox has renamed it.
//
// A conference's id is also its short label — "GULF" is what the desk, the
// standings and the bracket print — and the id is a key the regions, the
// cups and the schedule hang from, so it cannot itself change. A rename is
// therefore a display map, held here so the thirty-odd places that print a
// league need no season in hand: the store loads the map with the save and
// writes it as the desk edits it, and every screen re-renders on the
// version bump that follows. Absent, a league is called what it always was.

import { CONFERENCES } from '../data/schools.js';

let overrides: Record<string, string> = {};

/** Load the save's map, or clear it. */
export function setLeagueNames(map: Record<string, string> | undefined): void {
  overrides = { ...(map ?? {}) };
}

/** The current map, copied. */
export function leagueNames(): Record<string, string> {
  return { ...overrides };
}

/** The short label: the rename, else the id. */
export function leagueLabel(id: string): string {
  return overrides[id] ?? id;
}

/** The long name: the rename, else the data file's, else the id. */
export function leagueName(id: string): string {
  return overrides[id] ?? CONFERENCES.find((c) => c.id === id)?.name ?? id;
}

/** A save's map, from whatever an older or hand-edited file carries. */
export function usableLeagueNames(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim().length > 0) out[k] = v.trim().slice(0, 40);
  }
  return out;
}
