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
  /** Since this step's light came on: a play was made, the order changed, a position changed. */
  playedSinceLit: boolean;
  lineupChanged: boolean;
  positionsChanged: boolean;
  /** A control by `data-guide` name is in the frame right now. */
  has: (name: string) => boolean;
}

export interface GuideCard { title: string; body: string }

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
    id: 'word',
    aside: true,
    where: (v) => v.playerOpen && v.wordGuide,
    card: {
      title: 'Have a word',
      body: 'He is failing his classes and a week from missing a series — that '
        + 'is what held the day. MANAGE, on his card, is every decision you '
        + 'can make about a man: rest, a word, his future. Open it, and have '
        + 'the word.',
    },
    target: ['have-a-word', 'player-actions'],
    caption: {
      'player-actions': 'MANAGE. His decisions live here.',
      'have-a-word': 'HAVE A WORD. One of four you get a season.',
    },
    // Stamped by the errand itself, the moment the word is had.
    done: (v) => v.wordSeen,
  },
  {
    id: 'word-back',
    aside: true,
    where: (v) => v.playerOpen && v.wordSeen && !v.wordGuide,
    card: {
      title: 'That is a word had',
      body: 'He is on the watch list now, not the failing list, and the day is '
        + 'no longer held. You have three of these left this season, so spend '
        + 'them on the men who need them. Back to the desk.',
    },
    target: ['overlay-back'],
    caption: { 'overlay-back': 'BACK to the desk.' },
    // Not merely "the card is closed": that holds before the word was ever
    // had, and would stamp this aside away at the tour's first breath.
    done: (v) => v.wordSeen && !v.playerOpen,
  },
  {
    id: 'field-1',
    where: (v) => onField(v) && !v.over && v.inning === 1 && v.half === 'top' && v.has('call-default'),
    card: (v) => (v.batting
      ? {
        title: 'Your call',
        body: 'The line score is across the top; the man at bat and the man on '
          + 'the mound sit under it, and the play-by-play fills in between. '
          + 'Nothing happens until you call it: YOUR CALL, at the bottom, is '
          + 'the decision for this plate appearance. SWING AWAY is the ordinary '
          + 'one — the rest are situations. Make the call, and read what comes '
          + 'back.',
      }
      : {
        title: 'Your pitch',
        body: 'The line score is across the top; the man at bat and your man on '
          + 'the mound sit under it, and the play-by-play fills in between. '
          + 'Nothing happens until you call it: YOUR CALL, at the bottom, is '
          + 'the decision for this batter. PITCH is the ordinary one — the '
          + 'rest are situations. Make the call, and read what comes back.',
      }),
    target: ['call-default'],
    caption: { 'call-default': 'The ordinary call. Tap it.' },
    done: (v) => v.playedSinceLit,
    covers: ['manage'],
  },
  {
    id: 'field-2',
    where: (v) => onField(v) && !v.over && v.inning === 1 && v.half === 'bottom' && v.has('call-default'),
    card: (v) => (v.batting
      ? {
        title: 'Now you are batting',
        body: 'Sides change. Your man is up, and the calls are the offense’s: '
          + 'SWING AWAY, or a bunt, a steal, a hit-and-run when the situation '
          + 'allows one. Same rule — one call per plate appearance. Make it, '
          + 'then play the inning out your own way.',
      }
      : {
        title: 'Now you are in the field',
        body: 'Sides change. Your man is on the mound, and the calls are the '
          + 'defense’s: PITCH, or pitch around him, bring the infield in, put '
          + 'him on when the situation calls for it. Same rule — one call per '
          + 'batter. Make it, then play the inning out your own way.',
      }),
    target: ['call-default'],
    caption: { 'call-default': 'The ordinary call. Tap it.' },
    done: (v) => v.playedSinceLit,
  },
  {
    id: 'dugout',
    where: (v) => onField(v) && !v.over && v.inning >= 2,
    card: {
      title: 'One inning is plenty',
      body: 'You have run a full inning from the top step, and that is the '
        + 'whole job in miniature. The round button in the corner is your '
        + 'dugout — every managing tool lives behind it. Open it, and hand the '
        + 'rest of the night to your bench coach.',
    },
    target: ['sim-rest', 'dugout'],
    caption: {
      dugout: 'Your dugout.',
      'sim-rest': 'SIM THE REST. The bench coach finishes; the result is still yours.',
    },
    done: (v) => v.over,
  },
  {
    id: 'record',
    where: (v) => onField(v) && v.over,
    card: {
      title: 'That is the ballgame',
      body: 'The bench coach played it out and the score stands. RECORD THE '
        + 'GAME writes it into the books — the standings, the statistics, the '
        + 'story — and moves the calendar on to tomorrow.',
    },
    target: ['record-game'],
    caption: { 'record-game': 'RECORD THE GAME.' },
    done: (v) => !v.live && !v.pending,
  },
  {
    id: 'program',
    where: (v) => onScreen(v) && v.tab !== 'program',
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
    where: (v) => onScreen(v) && v.tab === 'program',
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
    done: (v) => onMoney(v),
    covers: ['program'],
  },
  {
    id: 'staff',
    where: (v) => onMoney(v) && (v.has('money-staff') || v.has('seg-staff')),
    card: {
      title: 'The room',
      body: 'Three seats: a hitting coach, a pitching coach, a recruiting '
        + 'coordinator. Each costs a wage every year, and each changes what '
        + 'your players become. The seats are empty, and an empty seat is '
        + 'development you are not doing. Open STAFF.',
    },
    target: ['money-staff', 'seg-staff'],
    caption: { 'money-staff': 'STAFF.', 'seg-staff': 'STAFF.' },
    done: (v) => v.has('seat-hitting'),
  },
  {
    id: 'hire',
    where: (v) => onMoney(v) && v.has('seat-hitting'),
    card: {
      title: 'The hitting coach',
      body: 'The room opens on the hitting coach’s seat. Under it is the '
        + 'market: every candidate with his development and game-management '
        + 'marks, how he fits your program, and what the budget looks like '
        + 'after him. The first card is the best fit this cycle. Hire him.',
    },
    target: ['hire-cta', 'seat-hitting'],
    caption: {
      'hire-cta': 'HIRE. His wage comes off the budget every year.',
      'seat-hitting': 'The hitting coach’s seat.',
    },
    done: (v) => v.hittingHired || v.has('hire-blocked') || v.has('staff-delegated'),
  },
  {
    id: 'task',
    where: (v) => onMoney(v) && v.hittingHired && v.has('directive'),
    card: {
      title: 'Give him a job',
      body: 'A coach with no instruction keeps the seat warm. His standing '
        + 'directive is the job he does every week — contact, power or '
        + 'discipline, for a hitting coach — and once his building stands he '
        + 'can run projects on named men as well. Pick a directive. It is not '
        + 'a promise; change it whenever the season asks.',
    },
    target: ['directive'],
    caption: { directive: 'A standing directive. Contact, power or discipline.' },
    done: (v) => (v.hittingHired && v.hittingDirective !== 'balanced') || v.has('staff-delegated'),
  },
  {
    id: 'facilities',
    where: (v) => onMoney(v) && (v.has('money-facilities') || v.has('seg-facilities')),
    card: {
      title: 'The buildings',
      body: 'Three facilities, one for each seat: the hitting barn, the '
        + 'bullpen, the clubhouse. A building is how fast your men develop, '
        + 'and it is what lets the coach beside it run a project. Open '
        + 'FACILITIES.',
    },
    target: ['money-facilities', 'seg-facilities'],
    caption: { 'money-facilities': 'FACILITIES.', 'seg-facilities': 'FACILITIES.' },
    done: (v) => v.has('facility-cta') || v.has('facility-blocked') || v.has('facility-delegated'),
  },
  {
    id: 'build',
    where: (v) => onMoney(v) && (v.has('facility-cta') || v.has('facility-blocked') || v.has('facility-delegated')),
    card: {
      title: 'The hitting barn',
      body: 'Your hitting coach’s building, and the first project worth the '
        + 'money: bats come back from the winter further along, and his '
        + 'projects unlock. It is a real bite of this year’s room — the '
        + 'button says exactly how much, and what is left after. Build it.',
    },
    target: ['facility-cta', 'facility-cage'],
    caption: {
      'facility-cta': 'BUILD. It comes out of this year’s room.',
      'facility-cage': 'The hitting barn.',
    },
    done: (v) => v.cageLevel > 0 || v.has('facility-blocked') || v.has('facility-delegated'),
  },
  {
    id: 'team',
    where: (v) => onScreen(v) && v.tab !== 'team',
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
    where: (v) => onScreen(v) && v.tab === 'team' && v.screen !== 'lineup',
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
    id: 'lineup-swap',
    where: (v) => onScreen(v) && v.tab === 'team' && v.screen === 'lineup',
    card: {
      title: 'The card that counts',
      body: 'The engine reads this straight tonight. The order is nine men, '
        + 'and two taps move them: tap a man to pick him up, then tap the man '
        + 'you want him to trade places with. Try it now — the leadoff man, '
        + 'then the man behind him.',
    },
    target: ['lineup-second', 'lineup-first'],
    caption: {
      'lineup-first': 'Pick him up.',
      'lineup-second': 'And put him here. They trade places.',
    },
    done: (v) => v.lineupChanged,
    covers: ['lineup'],
  },
  {
    id: 'lineup-spot',
    where: (v) => onScreen(v) && v.tab === 'team' && v.screen === 'lineup',
    card: {
      title: 'Who plays where',
      body: 'The squares down the right edge are the field, one per position. '
        + 'Tap a square to ask who plays there; tap a man next and he takes '
        + 'the spot. Hold anyone, anywhere, to read his numbers without '
        + 'leaving. Try it: centre field, then a man.',
    },
    target: ['lineup-assign', 'lineup-spot'],
    caption: {
      'lineup-spot': 'Centre field. Who plays here?',
      'lineup-assign': 'This man takes the spot.',
    },
    done: (v) => v.positionsChanged,
  },
  {
    id: 'coach',
    where: (v) => onScreen(v),
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
