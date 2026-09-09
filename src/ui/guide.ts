// guide.ts
// The guided first stretch — what it teaches, in what order, and when.
//
// Grew from the phone, September 4 and 9. The card tutorials taught by
// reading; this teaches by doing. A card in the assistant's voice names the
// errand, then the screen goes dark except for the one control that does it,
// and the player's own tap moves the tour on. Designed in the reporter's
// words: "welcome the player and let them know they are in the dashboard,
// then have them play a game — just play one inning and then show them the
// dugout button and sim the rest — then guide them to program/budget ... then
// team/roster, 'meet the team', then lineup ... then the coach profile ... the
// rest can be explained in the regular cards." And: "it should obscure the
// whole screen except the button they are supposed to tap."
//
// Pure. Which step is live is derived from the save — one `seenTutorials`
// stamp per step — and from the store's navigation fields, so the tour
// survives a reload exactly as far as it got. A step interrupted restarts
// from its card, which is the honest place to restart, and no new field rides
// the save. `GuidedStretch.tsx` is the half that touches the DOM.

import type { Overlay, ProgramSheet, Tab } from '../state/store.js';

/** What a step is allowed to know about where the player is. */
export interface GuideView {
  tab: Tab;
  screen: string;
  overlay: Overlay | null;
  programSheet: ProgramSheet;
  /** A game is on the field. */
  live: boolean;
  /** Its inning, polled — the live game is a mutable object, not store state. */
  inning: number;
  /** A game a phone call interrupted, waiting for its resume prompt. */
  pending: boolean;
}

export interface GuideStep {
  id: string;
  /** Where the card shows and the light lives. */
  where: (v: GuideView) => boolean;
  /** The card that names the errand. Null: straight to the light. */
  card: { title: string; body: string } | null;
  /**
   * `data-guide` names to light, in order of preference: the first one that
   * is on screen and enabled wins. Two names is how a step follows a tap into
   * the thing it opened — the dugout trigger until the tools are out, then
   * SIM THE REST. Null: the card alone teaches, and GOT IT finishes it.
   */
  target: string[] | null;
  /** A line beside the light, per lit name. */
  caption?: Record<string, string>;
  /** The step is over the moment this holds. Null: GOT IT ends it. */
  done: ((v: GuideView) => boolean) | null;
  /** The screens' own first-visit cards this step stands in for. */
  covers?: string[];
}

const inSeasonScreen = (v: GuideView): boolean => !v.live && v.overlay === null;

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: 'welcome',
    where: (v) => inSeasonScreen(v) && v.tab === 'home' && v.screen === 'today',
    card: {
      title: 'Welcome to the office',
      body: 'This is your desk, skipper — TODAY. Tonight’s game, the mail, the '
        + 'men who need a word: everything that needs you lands here. The '
        + 'fastest way to learn the job is to do it, so let’s get you a game.',
    },
    // PLAY BALL is dark while a red need holds the day, so the light falls
    // back to the need itself; clearing it brings the light back to the button.
    target: ['play-ball', 'need-must'],
    caption: {
      'play-ball': 'PLAY BALL.',
      'need-must': 'Something needs you before first pitch. Tap it.',
    },
    done: (v) => v.live,
    covers: ['today'],
  },
  {
    id: 'dugout',
    where: (v) => v.live && v.screen === 'box' && v.inning >= 2,
    card: {
      title: 'One inning is plenty',
      body: 'You have run a frame from the top step, and that is the whole job '
        + 'in miniature. The round button in the corner is your dugout — every '
        + 'managing tool lives behind it. Open it, and hand the rest of the '
        + 'night to your bench coach.',
    },
    target: ['sim-rest', 'dugout'],
    caption: {
      dugout: 'Your dugout.',
      'sim-rest': 'SIM THE REST. The bench coach finishes; the result is still yours.',
    },
    done: (v) => !v.live && !v.pending,
    covers: ['manage'],
  },
  {
    id: 'program',
    where: (v) => inSeasonScreen(v) && v.tab !== 'program',
    card: {
      title: 'The front office',
      body: 'Games are won on the field; seasons are built upstairs. PROGRAM is '
        + 'the board, the budget, the staff and the buildings. Let’s go and '
        + 'look at the money.',
    },
    target: ['tab-program'],
    caption: { 'tab-program': 'PROGRAM.' },
    done: (v) => v.tab === 'program',
  },
  {
    id: 'money',
    where: (v) => inSeasonScreen(v) && v.tab === 'program',
    card: {
      title: 'Mind the budget',
      body: 'One annual budget pays for everything. Three seats on your staff '
        + 'to fill — each coach changes what your men become. Three facilities '
        + 'to build — they decide how fast. And the scout’s reports come out of '
        + 'the same pot, so keep some back: you will want them before you '
        + 'spend on a recruit.',
    },
    target: ['budget'],
    caption: { budget: 'BUDGET. Where the money is, and where it went.' },
    done: (v) => v.tab === 'program' && v.screen === 'records' && v.programSheet === 'money',
    covers: ['program'],
  },
  {
    id: 'team',
    where: (v) => inSeasonScreen(v) && v.tab !== 'team',
    card: {
      title: 'Meet the team',
      body: 'Twenty-odd men and a locker room. TEAM is who they are, who plays, '
        + 'and what they have done. Go and meet them.',
    },
    target: ['tab-team'],
    caption: { 'tab-team': 'TEAM.' },
    done: (v) => v.tab === 'team',
  },
  {
    id: 'roster',
    where: (v) => inSeasonScreen(v) && v.tab === 'team' && v.screen !== 'lineup',
    card: {
      title: 'Your roster',
      body: 'Every man on the books, with his position, his class and his '
        + 'rating. Tap anyone for his card. The card that decides tonight is '
        + 'next door: LINEUP.',
    },
    target: ['screen-lineup'],
    caption: { 'screen-lineup': 'LINEUP.' },
    done: (v) => v.tab === 'team' && v.screen === 'lineup',
    covers: ['roster'],
  },
  {
    id: 'lineup',
    where: (v) => inSeasonScreen(v) && v.tab === 'team' && v.screen === 'lineup',
    card: {
      title: 'The card that counts',
      body: 'The engine reads this straight. Tap one man, then another, and '
        + 'they swap places in the order. To change who plays where, tap a '
        + 'position square on the right edge, then the man you want there. '
        + 'Hold anyone to read his numbers without leaving.',
    },
    target: null,
    done: null,
    covers: ['lineup'],
  },
  {
    id: 'coach',
    where: (v) => inSeasonScreen(v),
    card: {
      title: 'Your own card',
      body: 'Last stop. The portrait at the top is you — your record, your '
        + 'prestige, your contract, and what the board makes of it. Everything '
        + 'the country knows about you is in there.',
    },
    target: ['coach-profile', 'coach-menu'],
    caption: { 'coach-menu': 'Your portrait.', 'coach-profile': 'Your profile.' },
    done: (v) => v.overlay === 'program' && v.programSheet === 'coach',
    covers: ['coach'],
  },
  {
    id: 'done',
    where: (v) => !v.live && v.overlay === 'program' && v.programSheet === 'coach',
    card: {
      title: 'That’s the tour',
      body: 'The rest you will pick up as you go — every new room still '
        + 'introduces itself once, and Settings can switch that off. Good '
        + 'luck, skipper. The first pitch is yours.',
    },
    target: null,
    done: null,
  },
];

/** The save's word for a step being over. */
export const guideStamp = (id: string): string => `guide:${id}`;

/**
 * The step the tour is on, or null when there is no tour to be on.
 *
 * Only a first season, and only for a career that met the tour on its first
 * day: a save whose TODAY card was seen before the stretch existed belongs to
 * somebody who already knows where the desk is, and must not be walked to it.
 */
export function activeGuideStep(
  seen: readonly string[],
  firstSeason: boolean,
  tutorialsOn: boolean,
): GuideStep | null {
  if (!tutorialsOn || !firstSeason) return null;
  if (!seen.includes(guideStamp('welcome')) && seen.includes('today')) return null;
  return GUIDE_STEPS.find((s) => !seen.includes(guideStamp(s.id))) ?? null;
}

/** Everything one SKIP stamps: every step, and every card a step stood in for. */
export function guideSkipStamps(): string[] {
  const out: string[] = [];
  for (const s of GUIDE_STEPS) {
    out.push(guideStamp(s.id));
    for (const c of s.covers ?? []) if (!out.includes(c)) out.push(c);
  }
  return out;
}
