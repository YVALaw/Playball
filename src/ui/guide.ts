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
// Revised the same night from the first phone run: "you have to be very
// detailed with the tutorial and go along with every decision." So the word
// errand is walked under the mask rather than left to its own glow, the
// field's basic controls are taught before the inning, RECORD THE GAME is
// lit, the budget lesson hires the hitting coach, gives him a directive and
// builds his barn, and the lineup lesson is two swaps done by hand.
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
  /** Its inning and half, polled — the live game is a mutable object, not store state. */
  inning: number;
  half: 'top' | 'bottom';
  /** Our side is at bat in the current half. */
  batting: boolean;
  /** The game is over and waiting to be recorded. */
  over: boolean;
  /** A game a phone call interrupted, waiting for its resume prompt. */
  pending: boolean;
  /** A player's card is open over the screen. */
  playerOpen: boolean;
  /** The failing-man errand is lit (store `guide`), and whether it has ever been done. */
  wordGuide: boolean;
  wordSeen: boolean;
  /** The front office, for the budget lesson. */
  hittingHired: boolean;
  hittingDirective: string;
  cageLevel: number;
  /** At least one completed game in this season, including simulated games. */
  gamesPlayed?: number;
  /** Since this step's light came on: a play was made, the order changed, a position changed. */
  playedSinceLit: boolean;
  lineupChanged: boolean;
  positionsChanged: boolean;
  /** A control by `data-guide` name is in the frame right now. */
  has: (name: string) => boolean;
}

export interface GuideCard { title: string; body: string; action: string }

export interface GuideStep {
  id: string;
  /**
   * A side errand. It is never the tour's current step — the current step is
   * always the first unstamped main step — but it shows whenever its `where`
   * holds and it is not yet stamped, and it is stamped by its own `done`.
   * The word errand is one: a career whose first day is not held never sees
   * it, and the tour must not wait on it.
   */
  aside?: boolean;
  /** Where the card shows and the light lives. */
  where: (v: GuideView) => boolean;
  /** The card that names the errand. A function when the words depend on the situation. */
  card: GuideCard | ((v: GuideView) => GuideCard);
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

const onScreen = (v: GuideView): boolean => !v.live && v.overlay === null && !v.playerOpen;
const onField = (v: GuideView): boolean => v.live && v.screen === 'box';
const onMoney = (v: GuideView): boolean =>
  onScreen(v) && v.tab === 'program' && v.screen === 'records' && v.programSheet === 'money';

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: 'welcome',
    where: (v) => onScreen(v) && v.tab === 'home' && v.screen === 'today',
    card: {
      title: "Welcome to Playball",
      body: "Play an inning, meet your staff, and set your lineup. Skip anytime.",
      action: "Clear required items, then tap PLAY BALL.",
    },
    target: ['play-ball', 'need-must'],
    caption: {
      "play-ball": "Choose PLAY BALL to start the game.",
      "need-must": "Open this required item before you play.",
    },
    done: (v) => v.live,
    covers: ['today'],
  },
  {
    id: 'word',
    aside: true,
    where: (v) => v.playerOpen && v.wordGuide,
    card: {
      title: "Help with classes",
      body: "Academic trouble can sideline a player. Conversations are limited each season.",
      action: "Open MANAGE, then tap HAVE A WORD.",
    },
    target: ['have-a-word', 'player-actions'],
    caption: {
      "player-actions": "Open MANAGE to see this player’s available actions.",
      "have-a-word": "Choose HAVE A WORD. This uses a season conversation.",
    },
    // Stamped by the errand itself, the moment the word is had.
    done: (v) => v.wordSeen,
  },
  {
    id: 'word-back',
    aside: true,
    where: (v) => v.playerOpen && v.wordSeen && !v.wordGuide,
    card: {
      title: "Conversation complete",
      body: "Check the player’s academic standing and conversations left.",
      action: "Tap BACK to return to Today.",
    },
    target: ['overlay-back'],
    caption: {
      "overlay-back": "Use BACK to return to Today.",
    },
    // Not merely "the card is closed": that holds before the word was ever
    // had, and would stamp this aside away at the tour's first breath.
    done: (v) => v.wordSeen && !v.playerOpen,
  },
  {
    id: 'field-1',
    where: (v) => onField(v) && !v.over && v.inning === 1 && v.half === 'top' && v.has('call-default'),
    card: (v) => (v.batting
      ? {
        title: "Your call",
        body: 'Your team is batting. SWING AWAY is the standard play.',
        action: 'Tap SWING AWAY, then read the result.',
      }
      : {
        title: "Your pitch",
        body: 'Your team is pitching. PITCH is the standard play.',
        action: 'Tap PITCH, then read the result.',
      }),
    target: ['call-default'],
    caption: {
      "call-default": "Choose the standard call, then read the result.",
    },
    done: (v) => v.playedSinceLit || (v.live && (v.over || v.inning > 1 || v.half === 'bottom'))
      || (!v.live && !v.pending && (v.gamesPlayed ?? 0) > 0),
    covers: ['manage'],
  },
  {
    id: 'field-2',
    where: (v) => onField(v) && !v.over && v.inning === 1 && v.half === 'bottom' && v.has('call-default'),
    card: (v) => (v.batting
      ? {
        title: "Now you are batting",
        body: 'Your team is batting. SWING AWAY is the standard play.',
        action: 'Tap SWING AWAY, then read the result.',
      }
      : {
        title: "Now you are pitching",
        body: 'Your team is pitching. PITCH is the standard play.',
        action: 'Tap PITCH, then read the result.',
      }),
    target: ['call-default'],
    caption: {
      "call-default": "Choose the standard call, then read the result.",
    },
    done: (v) => v.playedSinceLit || (v.live && (v.over || v.inning > 1))
      || (!v.live && !v.pending && (v.gamesPlayed ?? 0) > 0),
  },
  {
    id: 'dugout',
    where: (v) => onField(v) && !v.over && v.inning >= 2,
    card: {
      title: "Open the dugout",
      body: "Find substitutions, pitching changes, and simulation here.",
      action: "Tap SIM THE REST, or skip to keep managing.",
    },
    target: ['sim-rest', 'dugout'],
    caption: {
      "dugout": "Open the dugout tools.",
      "sim-rest": "SIM THE REST completes this game for you.",
    },
    done: (v) => v.over || (!v.live && !v.pending && (v.gamesPlayed ?? 0) > 0),
  },
  {
    id: 'record',
    where: (v) => onField(v) && v.over,
    card: {
      title: "Record the result",
      body: "This saves the result and advances your season.",
      action: "Tap RECORD THE GAME.",
    },
    target: ['record-game'],
    caption: {
      "record-game": "Record the result and advance the season.",
    },
    done: (v) => !v.live && !v.pending,
  },
  {
    id: 'program',
    where: (v) => onScreen(v) && v.tab !== 'program',
    card: {
      title: "Your program",
      body: "Find board goals, budget, staff, and facilities here.",
      action: "Tap PROGRAM below.",
    },
    target: ['tab-program'],
    caption: {
      "tab-program": "Open PROGRAM.",
    },
    done: (v) => v.tab === 'program',
  },
  {
    id: 'money',
    where: (v) => onScreen(v) && v.tab === 'program',
    card: {
      title: "Your budget",
      body: "Cash pays for staff, facilities, and scouting. Recruiting uses separate points.",
      action: "Open BUDGET.",
    },
    target: ['budget'],
    caption: {
      "budget": "Open BUDGET to review your funds.",
    },
    done: (v) => onMoney(v),
    covers: ['program'],
  },
  {
    id: 'staff',
    where: (v) => onMoney(v) && (v.has('money-staff') || v.has('seg-staff')),
    card: {
      title: "Your coaching staff",
      body: "Hire a hitting coach, pitching coach, and recruiting coordinator.",
      action: "Open STAFF.",
    },
    target: ['money-staff', 'seg-staff'],
    caption: {
      "money-staff": "Open STAFF.",
      "seg-staff": "Open STAFF.",
    },
    done: (v) => v.has('seat-hitting'),
  },
  {
    id: 'hire',
    where: (v) => onMoney(v) && v.has('seat-hitting'),
    card: {
      title: "Choose a hitting coach",
      body: "Compare skills and annual wages. Hiring uses your real budget.",
      action: "Tap a candidate for details. Hire or skip.",
    },
    target: ['hire-detail', 'hire-options', 'seat-hitting'],
    caption: {
      "hire-detail": "Check skills and cost. Hire or close to compare another coach.",
      "hire-options": "Tap a candidate to compare skills and cost.",
      "seat-hitting": "Open the hitting coach’s role.",
    },
    done: (v) => v.hittingHired || v.has('hire-blocked') || v.has('staff-delegated'),
  },
  {
    id: 'task',
    where: (v) => onMoney(v) && v.hittingHired && v.has('directive'),
    card: {
      title: "Set a focus",
      body: "A matching focus strengthens the coach’s projects.",
      action: "Choose a focus, or skip to keep Balanced.",
    },
    target: ['directive'],
    caption: {
      "directive": "Choose a focus. You can change it later.",
    },
    done: (v) => !v.hittingHired || v.hittingDirective !== 'balanced' || v.has('staff-delegated'),
  },
  {
    id: 'facilities',
    where: (v) => onMoney(v) && (v.has('money-facilities') || v.has('seg-facilities')),
    card: {
      title: "Your facilities",
      body: "Facilities improve development and unlock staff projects.",
      action: "Open FACILITIES.",
    },
    target: ['money-facilities', 'seg-facilities'],
    caption: {
      "money-facilities": "Open FACILITIES.",
      "seg-facilities": "Open FACILITIES.",
    },
    done: (v) => v.has('facility-cta') || v.has('facility-blocked') || v.has('facility-delegated'),
  },
  {
    id: 'build',
    where: (v) => onMoney(v) && (v.has('facility-cta') || v.has('facility-blocked') || v.has('facility-delegated')),
    card: {
      title: "The Hitting Barn",
      body: "Supports batting development and hitting projects. Building spends cash immediately.",
      action: "Check the price. Build or skip.",
    },
    target: ['facility-cta', 'facility-cage'],
    caption: {
      "facility-cta": "Review the price, then build if it fits your budget.",
      "facility-cage": "Select the Hitting Barn.",
    },
    done: (v) => v.cageLevel > 0 || v.has('facility-blocked') || v.has('facility-delegated'),
  },
  {
    id: 'team',
    where: (v) => onScreen(v) && v.tab !== 'team',
    card: {
      title: "Meet your team",
      body: "Review players, lineups, and performance here.",
      action: "Tap TEAM below.",
    },
    target: ['tab-team'],
    caption: {
      "tab-team": "Open TEAM.",
    },
    done: (v) => v.tab === 'team',
  },
  {
    id: 'roster',
    where: (v) => onScreen(v) && v.tab === 'team' && v.screen !== 'lineup',
    card: {
      title: "Read the roster",
      body: "OVR is current ability. POT is potential for growth.",
      action: "Open LINEUP to choose your starters.",
    },
    target: ['screen-lineup'],
    caption: {
      "screen-lineup": "Open LINEUP.",
    },
    done: (v) => v.tab === 'team' && v.screen === 'lineup',
    covers: ['roster'],
  },
  {
    id: 'lineup-swap',
    where: (v) => onScreen(v) && v.tab === 'team' && v.screen === 'lineup',
    card: {
      title: "Set the batting order",
      body: "Swaps save immediately. Delegated lineups remain your bench coach’s call.",
      action: "Tap two players to swap them, or skip.",
    },
    target: ['lineup-second', 'lineup-first'],
    caption: {
      "lineup-first": "Select the first player.",
      "lineup-second": "Select the second player to swap their batting order.",
    },
    done: (v) => v.lineupChanged,
    covers: ['lineup'],
  },
  {
    id: 'lineup-spot',
    where: (v) => onScreen(v) && v.tab === 'team' && v.screen === 'lineup',
    card: {
      title: "Assign a position",
      body: "Position changes save immediately. Hold a player for stats.",
      action: "Tap CF, then a player to assign center field.",
    },
    target: ['lineup-assign', 'lineup-spot'],
    caption: {
      "lineup-spot": "Select CF to choose your center fielder.",
      "lineup-assign": "Choose a player to assign them to center field.",
    },
    done: (v) => v.positionsChanged,
  },
  {
    id: 'coach',
    where: (v) => onScreen(v),
    card: {
      title: "Your coaching career",
      body: "Skills, achievements, and coach prestige follow you between schools.",
      action: "Open your portrait, then your profile.",
    },
    target: ['coach-profile', 'coach-menu'],
    caption: {
      "coach-menu": "Open your coach menu.",
      "coach-profile": "Open your coach profile.",
    },
    done: (v) => v.overlay === 'program' && v.programSheet === 'coach',
    covers: ['coach'],
  },
  {
    id: 'done',
    where: (v) => !v.live && v.overlay === 'program' && v.programSheet === 'coach',
    card: {
      title: "You’re ready",
      body: "Check Today for games and decisions. Recruit during the season.",
      action: "Replay tutorials or turn them off in Settings → Display.",
    },
    target: null,
    done: null,
  },
];

/** The save's word for a step being over. */
export const guideStamp = (id: string): string => `guide:${id}`;

/** The words on a step's card, for where the player is. */
export const guideCard = (step: GuideStep, v: GuideView): GuideCard =>
  (typeof step.card === 'function' ? step.card(v) : step.card);

/**
 * The tour's current step, or null when there is no tour to be on.
 *
 * Always a main step: asides show beside it but never hold the tour up.
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
  return GUIDE_STEPS.find((s) => !s.aside && !seen.includes(guideStamp(s.id))) ?? null;
}

/**
 * The step to draw right now: an unstamped aside whose moment this is, else
 * the current step if the player is where it lives, else nothing.
 */
export function visibleGuideStep(
  seen: readonly string[],
  current: GuideStep,
  v: GuideView,
): GuideStep | null {
  const aside = GUIDE_STEPS.find((s) => s.aside && !seen.includes(guideStamp(s.id)) && s.where(v));
  if (aside) return aside;
  return current.where(v) ? current : null;
}

/**
 * Every stamp the moment has earned: the current step's, when its `done`
 * holds — wherever the player is looking — and any unstamped aside's.
 */
export function dueGuideStamps(
  seen: readonly string[],
  current: GuideStep,
  v: GuideView,
): string[] {
  const out: string[] = [];
  const earn = (s: GuideStep): void => {
    if (!s.done || !s.done(v)) return;
    for (const id of [guideStamp(s.id), ...(s.covers ?? [])]) {
      if (!seen.includes(id) && !out.includes(id)) out.push(id);
    }
  };
  earn(current);
  for (const s of GUIDE_STEPS) if (s.aside && !seen.includes(guideStamp(s.id))) earn(s);
  return out;
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

/** Progress excludes situational player errands, which may never appear. */
export function guideProgress(step: GuideStep): { current: number; total: number } {
  const main = GUIDE_STEPS.filter((s) => !s.aside);
  return { current: Math.max(1, main.findIndex((s) => s.id === step.id) + 1), total: main.length };
}

export function guideStepStamps(step: GuideStep): string[] {
  return [guideStamp(step.id), ...(step.covers ?? [])];
}
