// god/target.ts — what a god-mode sheet is about.
//
// God Mode is a control layer, not one giant page. Targets keep each editor
// focused on one responsibility so a roster, a program and a league move never
// have to share the same form merely because they are related in the save.

import type { PlayerId } from '../../engine/types.js';
import type { Tab } from '../../state/store.js';

export type GodTarget =
  | { kind: 'tab'; tab: Tab }
  | { kind: 'player'; id: PlayerId }
  | { kind: 'program'; team: number }
  | { kind: 'roster'; team: number }
  | { kind: 'coach' }
  | { kind: 'money' }
  | { kind: 'leagues' }
  | { kind: 'recruits' }
  | { kind: 'recruit'; id: PlayerId }
  | { kind: 'portal' }
  | { kind: 'time' };

/** What the fixed bar over the sheet says. Keep these deliberately short. */
export function godTitle(t: GodTarget): { eyebrow: string; title: string } {
  switch (t.kind) {
    case 'tab': return { eyebrow: 'GOD MODE', title: 'Control Center' };
    case 'player': return { eyebrow: 'GOD MODE · PLAYER', title: 'Player' };
    case 'program': return { eyebrow: 'GOD MODE · PROGRAM', title: 'Program' };
    case 'roster': return { eyebrow: 'GOD MODE · ROSTER', title: 'Roster' };
    case 'coach': return { eyebrow: 'GOD MODE · COACH', title: 'Coach' };
    case 'money': return { eyebrow: 'GOD MODE · PROGRAM', title: 'Budget & Staff' };
    case 'leagues': return { eyebrow: 'GOD MODE · LEAGUES', title: 'Leagues' };
    case 'recruits': return { eyebrow: 'GOD MODE · RECRUITING', title: 'Recruiting' };
    case 'recruit': return { eyebrow: 'GOD MODE · RECRUIT', title: 'Recruit' };
    case 'portal': return { eyebrow: 'GOD MODE · PORTAL', title: 'Transfer Portal' };
    case 'time': return { eyebrow: 'GOD MODE · WORLD', title: 'World' };
  }
}
