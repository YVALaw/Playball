// god/target.ts — what a god-mode sheet is about.
//
// God mode is not a place (05 §61.5). Every screen that shows a thing the
// sandbox can rewrite carries a bolt that opens the editor for that thing,
// and the header's bolt opens the editors for the tab you are on. A target
// names the thing; the store keeps a stack of them so an editor reached
// from inside another (a man from his program's roster) steps back rather
// than out.

import type { PlayerId } from '../../engine/types.js';
import type { Tab } from '../../state/store.js';

export type GodTarget =
  | { kind: 'tab'; tab: Tab }
  | { kind: 'player'; id: PlayerId }
  | { kind: 'program'; team: number }
  | { kind: 'coach' }
  | { kind: 'money' }
  | { kind: 'leagues' }
  | { kind: 'recruits' }
  | { kind: 'recruit'; id: PlayerId }
  | { kind: 'portal' }
  | { kind: 'time' };

/** What the bar over the sheet says. */
export function godTitle(t: GodTarget): { eyebrow: string; title: string } {
  switch (t.kind) {
    case 'tab': return { eyebrow: 'GOD MODE', title: TAB_TITLE[t.tab] };
    case 'player': return { eyebrow: 'GOD MODE · PLAYER', title: 'Edit the man' };
    case 'program': return { eyebrow: 'GOD MODE · PROGRAM', title: 'Edit the program' };
    case 'coach': return { eyebrow: 'GOD MODE · COACH', title: 'Edit your coach' };
    case 'money': return { eyebrow: 'GOD MODE · MONEY', title: 'The budget and the staff' };
    case 'leagues': return { eyebrow: 'GOD MODE · LEAGUES', title: 'The leagues' };
    case 'recruits': return { eyebrow: 'GOD MODE · RECRUITING', title: 'The class' };
    case 'recruit': return { eyebrow: 'GOD MODE · RECRUIT', title: 'Edit the recruit' };
    case 'portal': return { eyebrow: 'GOD MODE · PORTAL', title: 'Sign for nothing' };
    case 'time': return { eyebrow: 'GOD MODE · TIME', title: 'The calendar and the world' };
  }
}

const TAB_TITLE: Record<Tab, string> = {
  home: 'The season',
  team: 'Your roster',
  season: 'The leagues and the calendar',
  program: 'Your program',
};
