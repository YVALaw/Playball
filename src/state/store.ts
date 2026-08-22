// store.ts
// The app's state. Thin on purpose: the engine owns the simulation, this owns
// what the player is currently looking at.
//
// One thing to know. The engine mutates its own structures in place — a season
// accumulates into the same objects, and the offseason rewrites rosters on the
// players themselves. That is right for a simulation and wrong for React, which
// re-renders on reference change. So every mutation bumps `version`, and screens
// read that when they need to recompute. Cloning a 64-team world on every
// simulated day would be the alternative, and it would be slower than the
// simulation it exists to display.

import { create } from 'zustand';
import {
  createSeason, simNextDay, simSeason, seasonComplete, standings, nextSeason, rpi,
  seasonLength, regularRecord, archiveSeason,
  recordResult,
  type SeasonState,
} from '../engine/season.js';
import type { GameResult } from '../engine/game.js';
import { playerId } from '../engine/types.js';
import type { Hitter, Pitcher, PlayerId, Tactic } from '../engine/types.js';
import { createLiveGame, type LiveGame } from '../engine/liveGame.js';
import { advanceOffseason, type OffseasonReport } from '../engine/progression.js';
import {
  newCoach, reviewSeason, jobOffers, rosterStrength, contractFor, prestigeStars,
  skillPoints,
  type CoachState, type CoachSkills, type JobOffer, type Review, type SeasonOutcome,
} from '../engine/program.js';
import {
  runPostseason, freezeRegularSeason, stageConferenceTournaments, stageSelection,
  stageRegionals, stageOmaha, summarize,
  startBracket, stepBracket, nextGameFor, resultOf, pairKey,
  seasonAwards, allConference, coachOfTheYear,
  conferenceField, conferenceIds, conferenceTournament, regionalGroups,
  doubleElimination,
  type BracketState,
  type Finish, type PostseasonSummary, type ConferenceTournament, type Bid,
  type TournamentResult,
} from '../engine/postseason.js';
import {
  SCHOLARSHIPS, RECRUITING_BUDGET, MAX_PER_RECRUIT, RECRUITING_WEEKS,
  aiTargets, weeklyPoints, closeWeek, resetWeeklySpend, canPursue, leadersAtWeekStart,
} from '../engine/recruiting.js';
import { pitchFor, developmentScore } from '../engine/pitch.js';

/**
 * Give the rest of the country a head start on the board.
 *
 * Runs once as the window opens: every other program picks its targets and banks
 * a week's worth of interest, so the player arrives at a board that is already
 * contested. The user's own program is skipped — his head start is the one he
 * chooses.
 */
function seedRivalInterest(season: SeasonState, userTeam: number): void {
  const snapshot = leadersAtWeekStart(season.recruiting);
  for (const record of season.teams) {
    if (record.index === userTeam) continue;
    const conf = CONFERENCES.find((c) => c.id === record.conference);
    const pitch = pitchFor(season, record, conf?.region ?? 'Gulf', developmentScore(record));
    for (const { prospect, actions } of aiTargets(
      record.index, pitch, 45, season.recruiting.prospects,
      holesFor(record), season.rng, snapshot,
    )) {
      prospect.points[record.index] =
        (prospect.points[record.index] ?? 0) + weeklyPoints(prospect, pitch, actions, 45);
    }
  }
  // The spend is the AI's own; the player's budget is untouched.
  resetWeeklySpend(season.recruiting);
}

/** Roughly how many bodies a program has to replace, which sizes its board. */
const holesFor = (record: { team: { lineup: unknown[]; bench: unknown[]; rotation: unknown[]; bullpen: unknown[] } }): number => {
  const roster = [
    ...record.team.lineup, ...record.team.bench,
    ...record.team.rotation, ...record.team.bullpen,
  ] as { classYear: string }[];
  return Math.max(3, roster.filter((p) => p.classYear === 'SR' || p.classYear === 'JR').length);
};
import type { Region } from '../data/schools.js';
import { makeRng } from '../engine/rng.js';
import type { Strategy } from '../engine/strategy.js';
import { HOME_CONFERENCE, CONFERENCES } from '../data/schools.js';
import { saveDynasty, loadDynasty } from './persistence.js';
import { toPortable, fromPortable } from './seasonCodec.js';
import { WORLD_SEED } from './world.js';
// Re-exported so the screens that already import it from here keep working.
export { WORLD_SEED };
import {
  workerAvailable, simSeasonInWorker, offseasonInWorker,
} from './simClient.js';
import type { SimProgress } from './simWorker.js';

export type Tab = 'home' | 'team' | 'season' | 'program';

/**
 * The offseason, as a sequence you are walked through rather than a set of tabs
 * you can wander into.
 *
 * Recruiting used to be a nav entry, which meant it was reachable in March and
 * meaningless in June — a screen whose whole point is a three week deadline,
 * available at all times and urgent at none. Every step here happens once, in
 * order, and the game does not go forward until you have done it.
 */
export type Phase =
  | null            // the season is on
  | 'awards'
  | 'review'
  | 'coach'
  | 'recruiting'
  | 'signing'       // where the class landed
  | 'draft';        // who leaves for professional ball

/** The order the offseason runs in. */
export const PHASES: readonly Exclude<Phase, null>[] =
  ['awards', 'review', 'coach', 'recruiting', 'signing', 'draft'];

export interface TabDef {
  id: Tab;
  label: string;
  screens: Array<{ id: string; label: string }>;
}

/** Bottom nav and the sub-nav under it, exactly as the mockup lays them out. */
export const TABS: readonly TabDef[] = [
  { id: 'home', label: 'HOME', screens: [
    { id: 'today', label: 'TODAY' }, { id: 'wire', label: 'WIRE' }, { id: 'box', label: 'SCOREBOOK' }] },
  // Statistics are your players, so they live with your players. Strategy is a
  // standing policy rather than a thing you check, so it sits with the program.
  // Awards are now part of the record books: only the ones your program won,
  // year by year, which is the only version of that list anybody cares about.
  { id: 'team', label: 'TEAM', screens: [
    { id: 'roster', label: 'ROSTER' }, { id: 'lineup', label: 'LINEUP' }, { id: 'stats', label: 'STATS' }] },
  { id: 'season', label: 'SEASON', screens: [
    { id: 'sched', label: 'SCHEDULE' }, { id: 'stand', label: 'STANDINGS' }, { id: 'rankings', label: 'NATIONAL' }] },

  { id: 'program', label: 'PROGRAM', screens: [
    { id: 'records', label: 'PROGRAM' }, { id: 'history', label: 'HISTORY' }, { id: 'strategy', label: 'STRATEGY' }] },
];

/** How far through the postseason we are, and what has happened so far. */
export interface PostseasonProgress {
  /**
   * 'selection' and 'done' are gone as steps but stay in the type: a save
   * written before this change can still be sitting on one, and it has to load.
   */
  stage: 'conference' | 'selection' | 'regional' | 'omaha' | 'done';
  cups: ConferenceTournament[];
  field: Bid[];
  regionals: TournamentResult[];
  omaha: TournamentResult | null;
}

/**
 * Your tournament, in progress.
 *
 * `others` is everything at this stage that does not involve you, already
 * played — the world does not wait while you take your games one at a time.
 * `slot` is where your result belongs when it is finished, because Omaha seeds
 * off regional order and dropping yours on the end would reseed the country.
 */
export interface MyBracket {
  kind: 'conference' | 'regional' | 'omaha';
  state: BracketState;
  others: TournamentResult[];
  slot: number;
  /** A game you played by hand, waiting for the round it belongs to. */
  preplayed: Map<string, GameResult>;
}

/** One completed year, kept forever. A dynasty is the list of these. */
export interface SeasonRecord {
  year: number;
  w: number;
  l: number;
  cw: number;
  cl: number;
  /** Place in the conference standings, 1 based. */
  confPlace: number;
  rpi: number;
  wonConference: boolean;
  finish: Finish;
  /** Which program you were at. A career can span more than one. */
  school?: string;
  /** Whoever won it all that year, by school name. */
  nationalChampion: string;
  /**
   * What your own players won that year.
   *
   * Kept on the record rather than recomputed, because the season it came from
   * is gone by the time anybody reads it — rosters are rewritten every June and
   * the statistics go with them.
   */
  awards?: { title: string; name: string; id: PlayerId }[];
}

export interface DynastyStore {
  /** You. Follows you between jobs; see engine/program.ts. */
  coach: CoachState;
  /** The end of season meeting, held until acknowledged. */
  lastReview: Review | null;
  /** Jobs on the table, after a firing or when you go looking. */
  offers: JobOffer[];
  /**
   * You have no job.
   *
   * Being dismissed used to set a verdict and leave you in charge of the program
   * that dismissed you, which made the board's decision a piece of text rather
   * than a consequence. While this is true there is no team, and the only screen
   * is the one where you find another one.
   */
  jobSearch: boolean;
  /** Take one. Ends the current tenure and starts a new one. */
  acceptOffer: (team: number) => Promise<void>;
  /** Close the board meeting. */
  clearReview: () => void;
  season: SeasonState | null;
  /** Index into season.teams. The program you coach. */
  userTeam: number;
  year: number;
  tab: Tab;
  screen: string;
  /** Bumped whenever the engine mutates in place. See the note at the top. */
  version: number;
  busy: boolean;
  lastOffseason: OffseasonReport | null;
  /** Which step of the offseason is on screen, or null during the season. */
  phase: Phase;
  /** Move to the next step. At the end of the sequence, rolls the year over. */
  nextPhase: () => Promise<void>;
  /** Put a skill point into one of the coach's four attributes. */
  spendSkill: (skill: keyof CoachSkills) => void;
  /** Close the books on the season just played. Called when the review opens. */
  settleSeason: () => void;
  /** Re-enter the offseason sequence. The phase is not persisted, so a reload
   *  between steps lands back on the dashboard and needs a way in. */
  openOffseason: () => void;
  /** What the season came to, kept for the review screen. */
  lastOutcome: SeasonOutcome | null;

  /** Begin a dynasty. Pass a team index to choose the job. */
  start: (seed?: number, team?: number) => void;
  /** True before a job has been taken, so the app can show the setup screen. */
  needsTeam: boolean;
  go: (tab: Tab, screen?: string) => void;
  setScreen: (screen: string) => void;
  advanceDay: () => void;
  playSeason: () => Promise<void>;
  rollYear: () => Promise<void>;
  /** Non-null while a season is simulating in the worker. */
  progress: SimProgress | null;

  /** Every completed season, oldest first. This is the dynasty. */
  history: SeasonRecord[];
  /** Result of the postseason just played, cleared at roll over. */
  lastPostseason: PostseasonSummary | null;
  playPostseason: () => Promise<void>;
  /**
   * The postseason, in progress.
   *
   * Held as plain results rather than a live bracket so it survives a reload
   * like everything else. A coach who wins twenty five games and is then shown a
   * summary has not been to the postseason — he has been told about it.
   */
  bracket: PostseasonProgress | null;
  /** Play the next stage. */
  advanceBracket: () => void;
  /**
   * Your own tournament, one round at a time.
   *
   * Never persisted: it holds a live season reference and two Maps, and it only
   * exists between the moment a stage opens and the moment your run in it ends.
   * The stage results it folds into `bracket` are what survive.
   */
  myBracket: MyBracket | null;
  /** The game you are due to play next in it, if there is one. */
  myNextGame: () => { a: number; b: number; round: string } | null;
  /** Take your own bracket game. Opens the manage screen. */
  manageBracketGame: () => void;
  /**
   * Let the computer play it: the round you are in, every round until you are
   * next on the field, or the whole rest of the tournament.
   */
  simBracket: (mode: 'round' | 'until' | 'rest') => void;
  /** Fold a finished run into the stage results and move on. Internal. */
  closeMyBracket: () => void;

  /**
   * The game you are managing right now, if any. Holds closures, so it is never
   * persisted — and the day is not advanced until it finishes, so a reload
   * mid-game loses the game rather than orphaning it in a half-played day.
   */
  live: LiveGame | null;
  liveMeta: {
    home: number; away: number; day: number; conference: boolean;
    /** A bracket game. There is no day to advance and no standings day to hold. */
    postseason?: boolean;
  } | null;
  startManagedGame: () => void;
  submitTactic: (t: Tactic) => void;
  pinchHitFor: (h: Hitter) => void;
  bringIn: (p: Pitcher) => void;
  autoFinish: () => void;
  endManagedGame: () => Promise<void>;

  /**
   * A table laid over whatever is on screen: your schedule, your conference,
   * the national rankings.
   *
   * The offseason and the postseason own the whole screen, so `go()` — which
   * only moves the tab bar — does nothing from either. That is why the season
   * review's record and rankings tiles looked tappable and did nothing. An
   * overlay works everywhere, and nothing underneath unmounts.
   */
  overlay: 'schedule' | 'standings' | 'rankings' | null;
  openOverlay: (o: 'schedule' | 'standings' | 'rankings') => void;
  closeOverlay: () => void;

  /** Whose card is open. Cleared when you navigate away. */
  selectedPlayer: PlayerId | null;
  openPlayer: (id: PlayerId) => void;
  /** Close the card and return to whatever was underneath it. */
  closePlayer: () => void;

  /** Change one of your five coaching policies. Takes effect on the next pitch. */
  setStrategy: <K extends keyof Strategy>(key: K, value: Strategy[K]) => void;
  /** Put actions on a recruit this week, or take them off. */
  recruit: (prospectId: PlayerId, actions: number) => void;
  /** Bank the week, let recruits commit, and move to the next one. */
  advanceRecruitingWeek: () => void;
  /** Recruits who committed to you in the week just closed. */
  lastCommits: string[];
  /**
   * What the week that just closed actually did.
   *
   * Reported from testing: "when we tap end week there is not any real visual
   * cue that the week advanced". The budget resets and the board reshuffles, but
   * neither of those reads as *time passing* — and time passing is the entire
   * pressure the recruiting window is built on.
   */
  lastWeek: { closed: number; yours: string[]; gone: number } | null;

  /** Swap two batting order spots. The engine reads team.lineup directly. */
  swapLineup: (a: number, b: number) => void;
  /** Move a starter up or down the weekend rotation. */
  moveRotation: (index: number, delta: number) => void;

  saveNow: (slot?: string) => Promise<void>;
  loadSlot: (slot?: string) => Promise<boolean>;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  lastSaveError: string | null;
}

export const AUTOSAVE_SLOT = 'auto';

/**
 * Snapshot the season that just finished. Returns null before the schedule is
 * done, so a half-played year cannot end up in the record books.
 */
function recordFor(state: DynastyStore): SeasonRecord | null {
  const { season, userTeam, year, lastPostseason } = state;
  const me = season?.teams[userTeam];
  if (!season || !me || !seasonComplete(season)) return null;

  const table = standings(season, me.conference);
  const champions = lastPostseason?.conferenceChampions ?? [];

  // Ours only. A record book listing the whole country's award winners is a
  // list of other people's achievements filed under your program's history.
  const mine = [
    ...seasonAwards(season),
    ...allConference(season).map((a) => ({ ...a, title: `All-conference ${a.position}` })),
  ].filter((a) => a.team === me.def.abbr)
    .map((a) => ({ title: a.title, name: a.name, id: a.id }));

  // And yours, when you were the one who got more out of a roster than it was
  // worth. It goes at the top: it is the only line on the page about you.
  const coy = coachOfTheYear(season);
  if (coy && coy.team === me.index) {
    mine.unshift({
      title: 'Coach of the Year',
      name: state.coach.name,
      id: playerId(state.coach.name),
    });
  }
  const winner = lastPostseason
    ? season.teams[lastPostseason.champion]?.def.school ?? '—'
    : '—';

  return {
    year,
    w: me.w, l: me.l, cw: me.cw, cl: me.cl,
    confPlace: table.findIndex((t) => t.index === me.index) + 1,
    rpi: rpi(season, me.index),
    wonConference: champions.includes(me.index),
    finish: lastPostseason?.finish[me.index] ?? 'missed',
    school: me.def.school,
    nationalChampion: winner,
    awards: mine,
  };
}

/** Ridgemont State, the founding program, unless told otherwise. */
function defaultUserTeam(season: SeasonState): number {
  const home = season.teams.find((t) => t.conference === HOME_CONFERENCE);
  return home?.index ?? 0;
}

export const useDynasty = create<DynastyStore>((set, get) => ({
  season: null,
  userTeam: 0,
  needsTeam: true,
  lastOutcome: null,
  year: 2027,
  tab: 'home',
  screen: 'today',
  version: 0,
  busy: false,
  progress: null,
  lastOffseason: null,
  lastCommits: [],
  lastWeek: null,
  phase: null,

  start: (seed = WORLD_SEED, team?: number) => {
    const season = createSeason(makeRng(seed), undefined, CONFERENCES);
    // Whose games to keep box scores for. A season is built before anybody has
    // taken a job, so the engine cannot know this on its own.
    season.captureBoxFor = team ?? defaultUserTeam(season);
    set({
      season,
      userTeam: team ?? defaultUserTeam(season),
      needsTeam: false,
      year: seed,
      version: 1,
      coach: newCoach('Coach', contractFor(season.teams[team ?? 0]?.prestige ?? 50)),
      lastReview: null,
      offers: [],
      history: [],
      tab: 'home',
      screen: 'today',
      lastOffseason: null,
    });
    void get().saveNow();
  },

  go: (tab, screen) => {
    const def = TABS.find((t) => t.id === tab);
    set({ tab, screen: screen ?? def?.screens[0]?.id ?? 'today', selectedPlayer: null });
  },

  setScreen: (screen) => set({ selectedPlayer: null, screen }),

  recruit: (prospectId, actions) => {
    const { season, userTeam, version } = get();
    if (!season) return;
    // Only during the window. Outside it the board is a scouting list.
    if (season.recruiting.week < 1 || season.recruiting.week > RECRUITING_WEEKS) return;

    const prospect = season.recruiting.prospects.find((p) => p.id === prospectId);
    if (!prospect || prospect.signedBy !== null) return;

    // Out of reach for a program this size. Refused here as well as hidden in
    // the screen, so the rule holds wherever the call comes from.
    const me = get().season?.teams[userTeam];
    const myStars = me ? prestigeStars(me.prestige) : 1;
    if (!canPursue(prospect, myStars)) return;

    // A full class cannot sign anybody else, so there is nothing to spend on him.
    const signed = season.recruiting.prospects
      .filter((p) => p.signedBy === userTeam).length;
    if (signed >= SCHOLARSHIPS) return;

    const wanted = Math.max(0, Math.min(MAX_PER_RECRUIT, Math.round(actions)));
    const spentElsewhere = season.recruiting.prospects.reduce(
      (a, p) => a + (p.id === prospectId ? 0 : (p.spent[userTeam] ?? 0)), 0,
    );

    // The weekly budget is the only cap on *chasing*. There is deliberately no
    // limit on how many recruits may be on the board: having more irons in the
    // fire than you can finish is a legitimate way to work, and the scholarships
    // already limit what you can actually sign.
    const allowed = Math.min(wanted, RECRUITING_BUDGET - spentElsewhere);
    if (allowed <= 0) delete prospect.spent[userTeam];
    else prospect.spent[userTeam] = allowed;

    set({ version: version + 1 });
    void get().saveNow();
  },

  /**
   * Bank the week's points for every program, let recruits commit, move on.
   *
   * The user's actions are already on the board; the AI decides its own here so
   * that both sides are working from the same state of the class, and neither
   * gets to see the other's spend first.
   */
  advanceRecruitingWeek: () => {
    const { season, userTeam, coach, version } = get();
    if (!season) return;
    const recruits = season.recruiting;
    if (recruits.week < 1 || recruits.week > RECRUITING_WEEKS) return;

    const regionOf = (teamIndex: number): Region => {
      const rec = season.teams[teamIndex];
      const conf = CONFERENCES.find((c) => c.id === rec?.conference);
      return conf?.region ?? 'Gulf';
    };

    for (const record of season.teams) {
      const pitch = pitchFor(season, record, regionOf(record.index), developmentScore(record));
      const mine = record.index === userTeam;

      const spends: { prospect: typeof recruits.prospects[number]; actions: number }[] = mine
        ? recruits.prospects
            .filter((p) => (p.spent[userTeam] ?? 0) > 0)
            .map((p) => ({ prospect: p, actions: p.spent[userTeam] as number }))
        : aiTargets(
            record.index, pitch, 45, recruits.prospects,
            holesFor(record), season.rng,
          );

      for (const { prospect, actions } of spends) {
        const gained = weeklyPoints(prospect, pitch, actions, mine ? coach.prestige : 45);
        prospect.points[record.index] = (prospect.points[record.index] ?? 0) + gained;
      }
    }

    const finalWeek = recruits.week >= RECRUITING_WEEKS;
    const closed = recruits.week;
    const commits = closeWeek(recruits, season.rng, finalWeek);
    resetWeeklySpend(recruits);
    recruits.week += 1;

    const yours = commits
      .filter((c) => c.team === userTeam)
      .map((c) => c.prospect.player.name);
    set({
      version: version + 1,
      lastCommits: yours,
      lastWeek: { closed, yours, gone: commits.length - yours.length },
    });
  },

  /**
   * Walk one step through the offseason.
   *
   * The steps are gated on their own work being finished — recruiting will not
   * hand over until the three weeks are spent — so this is the only thing that
   * moves the game forward once the season ends, and it cannot skip a phase that
   * still has a decision waiting in it.
   */
  nextPhase: async () => {
    const { phase, season } = get();
    if (!season || phase === null) return;

    // Nothing carries over between steps. A table left open over the season
    // review would still be sitting over the top of recruiting.
    set({ overlay: null, selectedPlayer: null });

    const at = PHASES.indexOf(phase);
    const next = PHASES[at + 1] ?? null;

    if (next === 'review') get().settleSeason();

    // Opening recruiting starts its clock — and every other program has already
    // been working the board.
    //
    // Without this the window opened with nobody on anybody, so the first week
    // was a free run at the entire country: every recruit read NOBODY ON HIM and
    // a single point of effort led the field. Recruiting is a competition and it
    // has to look like one on the day it starts.
    if (next === 'recruiting') {
      seedRivalInterest(season, get().userTeam);
      season.recruiting.week = 1;
      set({ phase: next, version: get().version + 1 });
      void get().saveNow();
      return;
    }

    // Entering the draft runs the offseason, so the screen reports what happened
    // rather than what might. Rolling it at the end instead meant the draft step
    // could only ever show odds — the one screen whose entire job is results.
    if (next === 'draft') {
      const report = advanceOffseason(season, season.rng, {
        userTeam: get().userTeam,
        coachPrestige: get().coach.prestige,
      });
      set({ lastOffseason: report, phase: next, version: get().version + 1 });
      void get().saveNow();
      return;
    }

    // The draft is the last step; leaving it turns the year over.
    if (phase === 'draft') {
      set({ phase: null });
      await get().rollYear();
      return;
    }

    set({ phase: next, version: get().version + 1 });
  },

  spendSkill: (skill) => {
    const { coach, version } = get();
    if (coach.skillPoints <= 0) return;
    if (coach.skills[skill] >= 99) return;
    set({
      coach: {
        ...coach,
        skillPoints: coach.skillPoints - 1,
        skills: { ...coach.skills, [skill]: coach.skills[skill] + 1 },
      },
      version: version + 1,
    });
  },

  advanceDay: () => {
    const { season, version } = get();
    if (!season || seasonComplete(season)) return;
    simNextDay(season);
    set({ version: version + 1 });
  },

  playSeason: async () => {
    const { season, busy } = get();
    if (!season || busy) return;
    set({ busy: true, progress: null });

    if (!workerAvailable) {
      // No worker: the screen freezes, but the game still works. Better a hang
      // than a dead button.
      simSeason(season);
      set({ version: get().version + 1, busy: false });
      void get().saveNow();
      return;
    }

    try {
      const result = await simSeasonInWorker(
        toPortable(season),
        (p) => set({ progress: p }),
      );
      set({
        season: fromPortable(result),
        version: get().version + 1,
        busy: false,
        progress: null,
      });
      void get().saveNow();
    } catch (e) {
      set({
        busy: false,
        progress: null,
        lastSaveError: e instanceof Error ? e.message : String(e),
      });
    }
  },

  /**
   * Settle the season that just finished: the board's verdict, prestige, and the
   * coach's own standing.
   *
   * Runs when the review screen opens rather than at the year roll over, because
   * everything after it depends on the result — the skill points are spent
   * before recruiting, and recruiting is pitched on the prestige this produced.
   * Computing it at the end would mean the offseason spent itself against last
   * year's numbers.
   */
  openOffseason: () => { if (get().lastPostseason) set({ phase: 'awards' }); },

  settleSeason: () => {
    const { season, userTeam, coach, lastPostseason: post } = get();
    const me = season?.teams[userTeam];
    if (!season || !me || get().lastReview) return;

    // The regular season is what the board's win target was written against —
    // bracket wins are counted by their own boxes, not folded into the total.
    const played = regularRecord(me);
    const outcome: SeasonOutcome = {
      wins: played.w,
      losses: played.l,
      conferenceRank: standings(season, me.conference).findIndex((t) => t.index === me.index) + 1,
      conferenceSize: season.teams.filter((t) => t.conference === me.conference).length,
      wonConference: post?.conferenceChampions.includes(me.index) ?? false,
      madeTournament: post?.finish[me.index] !== undefined,
      reachedOmaha: ['omaha', 'runner-up', 'champion'].includes(post?.finish[me.index] ?? ''),
      wonTitle: post?.champion === me.index,
    };

    const review = reviewSeason(
      coach, me.prestige, rosterStrength(me.team), outcome, seasonLength(season.config),
    );

    // Prestige belongs to the school and survives a coaching change.
    me.prestige = review.prestigeAfter;

    set({
      lastReview: review,
      lastOutcome: outcome,
      coach: {
        ...coach,
        prestige: review.coachPrestigeAfter,
        security: review.securityAfter,
        tenure: review.fired ? 0 : coach.tenure + 1,
        contractYears: review.contractYears,
        careerWins: coach.careerWins + outcome.wins,
        careerLosses: coach.careerLosses + outcome.losses,
        titles: coach.titles + (outcome.wonTitle ? 1 : 0),
        conferenceTitles: coach.conferenceTitles + (outcome.wonConference ? 1 : 0),
        tournaments: coach.tournaments + (outcome.madeTournament ? 1 : 0),
        skillPoints: coach.skillPoints + skillPoints(outcome),
      },
      version: get().version + 1,
    });
  },

  rollYear: async () => {
    const { season, year, busy } = get();
    if (!season || busy) return;
    set({ busy: true });

    // Written into the record books before the offseason overwrites the rosters
    // that produced it. A dynasty that forgets last season is just a series of
    // unrelated seasons.
    const record = recordFor(get());
    const review = get().lastReview;

    // Into the record book before the statistics are wiped.
    archiveSeason(season, get().userTeam, year);

    const done = (next: SeasonState, report: OffseasonReport): void => {
      const rolled = nextSeason(next);
      const coach = get().coach;

      set({
        season: rolled,
        year: year + 1,
        version: get().version + 1,
        lastOffseason: report,
        phase: null,
        lastPostseason: null,
        lastOutcome: null,
        coach,
        // Being let go puts you on the market immediately. Nobody waits.
        offers: review?.fired
          ? jobOffers(coach, rolled.teams, (t) => t.prestige, get().userTeam)
          : [],
        // Dismissed means dismissed. The world carries on without you until you
        // take another job, and the career record is what you take with you.
        jobSearch: review?.fired ?? false,
        history: record ? [...get().history, record] : get().history,
        busy: false,
        tab: 'home',
        screen: 'today',
      });
      void get().saveNow();
    };

    // The offseason itself already ran, on the way into the draft step. All that
    // is left is turning the calendar.
    done(season, get().lastOffseason ?? {
      graduated: [], drafted: [], recruits: 0, signed: [], walkOns: [],
      developmentNet: 0, improved: 0, declined: 0,
    });
  },

  history: [],
  jobSearch: false,
  lastPostseason: null,
  bracket: null,
  selectedPlayer: null,
  coach: newCoach('Coach'),
  lastReview: null,
  offers: [],

  clearReview: () => set({ lastReview: null }),

  acceptOffer: async (team) => {
    const { season, coach } = get();
    if (!season) return;
    // The new job's games are the ones worth keeping now.
    season.captureBoxFor = team;
    set({
      userTeam: team,
      offers: [],
      jobSearch: false,
      lastReview: null,
      // A new job is a clean slate with a patient board, but your reputation
      // comes with you — that is the whole point of tracking it separately.
      coach: (() => {
        const length = contractFor(season.teams[team]?.prestige ?? 50);
        return { ...coach, tenure: 0, security: 62, contractYears: length, contractLength: length };
      })(),
      tab: 'home',
      screen: 'today',
      version: get().version + 1,
    });
    await get().saveNow();
  },

  /**
   * Open a player's card.
   *
   * Sets the selection and nothing else. The card renders as an overlay above
   * whatever is on screen, so navigating would be worse than pointless: it
   * unmounts the screen underneath, which is what made the roster forget it was
   * on the pitchers tab and a list forget where it had been scrolled.
   */
  overlay: null,
  openOverlay: (o) => set({ overlay: o }),
  closeOverlay: () => set({ overlay: null }),

  openPlayer: (id) => set({ selectedPlayer: id }),

  closePlayer: () => set({ selectedPlayer: null }),


  playPostseason: async () => {
    const { season, busy, version } = get();
    if (!season || busy || !seasonComplete(season) || get().lastPostseason) return;

    // Freeze the regular season before a single bracket game moves a record.
    // This is the one unambiguous boundary, which is why it happens here rather
    // than being threaded through every game.
    freezeRegularSeason(season);
    set({
      bracket: { stage: 'conference', cups: [], field: [], regionals: [], omaha: null },
      version: version + 1,
    });
    void get().saveNow();
  },

  /**
   * Play the next stage of the postseason.
   *
   * One press per stage, each with something to look at: your conference
   * tournament, the field being announced, your regional, then Omaha. The old
   * behaviour ran all four in a single call and landed on the awards screen,
   * which is how a twenty five win season could end without the player seeing a
   * postseason game.
   */
  advanceBracket: () => {
    const { season, bracket, userTeam, version } = get();
    if (!season || !bracket) return;

    // Three stages, not four, and no press that does nothing.
    //
    // Selection used to be its own step, which meant a screen whose only content
    // was a list and whose only action was to leave — "the selection phase seems
    // pointless since we don't really do anything there", and it was. The field
    // is announced as the regionals open, which is where it matters. Omaha ends
    // the postseason directly rather than passing through a 'done' stage that
    // looked identical and took a second press to get past.
    if (bracket.stage === 'conference') {
      if (bracket.cups.length > 0) {
        set({
          bracket: {
            ...bracket, stage: 'regional',
            field: stageSelection(season, bracket.cups.map((c) => c.champion)),
          },
          version: version + 1,
        });
      } else {
        const me = season.teams[userTeam];
        const mine = me ? conferenceField(season, me.conference) : null;
        if (me && mine && mine.field.includes(userTeam)) {
          const cups = conferenceIds(season)
            .filter((id) => id !== me.conference)
            .map((id) => conferenceTournament(season, id));
          set({
            bracket: { ...bracket, cups },
            myBracket: {
              kind: 'conference', state: startBracket(season, mine.field),
              others: [], slot: 0, preplayed: new Map(),
            },
            version: version + 1,
          });
          return;
        }
        set({
          bracket: { ...bracket, cups: stageConferenceTournaments(season) },
          version: version + 1,
        });
      }
    } else if (bracket.stage === 'regional') {
      if (bracket.regionals.length > 0) {
        set({ bracket: { ...bracket, stage: 'omaha' }, version: version + 1 });
      } else {
        const groups = regionalGroups(bracket.field);
        const slot = groups.findIndex((g) => g.includes(userTeam));
        if (slot >= 0) {
          const others = groups
            .filter((_, i) => i !== slot)
            .map((g) => doubleElimination(season, g));
          set({
            myBracket: {
              kind: 'regional', state: startBracket(season, groups[slot] as number[]),
              others, slot, preplayed: new Map(),
            },
            version: version + 1,
          });
          return;
        }
        set({
          bracket: { ...bracket, regionals: stageRegionals(season, bracket.field) },
          version: version + 1,
        });
      }
    } else if (bracket.stage === 'omaha') {
      if (bracket.omaha !== null) {
        set({ bracket: null, phase: 'awards', version: version + 1 });
      } else {
        const champions = bracket.regionals.map((r) => r.champion);
        if (champions.includes(userTeam)) {
          set({
            myBracket: {
              kind: 'omaha', state: startBracket(season, champions),
              others: [], slot: 0, preplayed: new Map(),
            },
            version: version + 1,
          });
          return;
        }
        const omaha = stageOmaha(season, bracket.regionals);
        set({
          bracket: { ...bracket, omaha },
          lastPostseason: summarize(bracket.cups, bracket.field, bracket.regionals, omaha),
          version: version + 1,
        });
      }
    } else {
      // A save written while 'selection' or 'done' still existed as stages.
      set({ bracket: null, phase: 'awards', version: version + 1 });
    }
    void get().saveNow();
  },

  myBracket: null,

  myNextGame: () => {
    const { myBracket, userTeam } = get();
    return myBracket ? nextGameFor(myBracket.state, userTeam) : null;
  },

  /**
   * Take your own bracket game.
   *
   * The host and the arm of the rotation are worked out exactly as the bracket
   * would have done it: better seed hosts, and the starter is chosen by how deep
   * into the tournament that team already is. Otherwise the game you manage
   * would quietly be a different game from the one simulating it produces.
   */
  manageBracketGame: () => {
    const { season, myBracket, userTeam, version } = get();
    if (!season || !myBracket) return;
    const next = nextGameFor(myBracket.state, userTeam);
    if (!next) return;

    const { seedOf, appearances } = myBracket.state;
    const seedA = seedOf.get(next.a) ?? Number.MAX_SAFE_INTEGER;
    const seedB = seedOf.get(next.b) ?? Number.MAX_SAFE_INTEGER;
    const [h, a] = seedA <= seedB ? [next.a, next.b] : [next.b, next.a];
    const home = season.teams[h];
    const away = season.teams[a];
    if (!home || !away) return;

    const slot = (appearances.get(h) ?? 0) % 3;
    set({
      live: createLiveGame(home.team, away.team, season.rng, {
        managing: h === userTeam ? 'home' : 'away',
        engine: season.config.engine,
        homeStarter: slot,
        awayStarter: slot,
      }),
      liveMeta: {
        home: h, away: a, day: season.dayIndex,
        conference: false, postseason: true,
      },
      version: version + 1,
    });
  },

  simBracket: (mode) => {
    const { myBracket, userTeam, version } = get();
    if (!myBracket) return;
    const { state, preplayed } = myBracket;

    if (mode === 'round') {
      stepBracket(state, preplayed);
    } else if (mode === 'until') {
      // Straight to your next game. A double elimination bracket byes whoever
      // is left at the top of an odd list, so a good seed can sit out three
      // rounds in a row — and a round you are not in is not a decision, it is a
      // button press standing between you and the one that is.
      let guard = 0;
      do {
        stepBracket(state, preplayed);
      } while (
        !state.done
        && !state.eliminated.includes(userTeam)
        && !nextGameFor(state, userTeam)
        && guard++ < 40
      );
    } else {
      while (!state.done) stepBracket(state, preplayed);
    }

    set({ version: version + 1 });
    if (state.done) get().closeMyBracket();
  },

  closeMyBracket: () => {
    const { season, bracket, myBracket, userTeam, version } = get();
    if (!season || !bracket || !myBracket || !myBracket.state.done) return;
    const mine = resultOf(myBracket.state);

    if (myBracket.kind === 'conference') {
      const me = season.teams[userTeam];
      const missed = me ? conferenceField(season, me.conference).missed : [];
      const cups: ConferenceTournament[] = [
        ...bracket.cups,
        { ...mine, conference: me ? me.conference : '', missed },
      ];
      // The stage does not move. Your tournament just finished and the result
      // is the thing to look at; leaving is the next press.
      set({
        bracket: { ...bracket, cups },
        myBracket: null, version: version + 1,
      });
    } else if (myBracket.kind === 'regional') {
      // Back in its own slot: Omaha seeds off regional order, so a result
      // dropped on the end would reseed the national bracket.
      const regionals = [...myBracket.others];
      regionals.splice(myBracket.slot, 0, mine);
      set({
        bracket: { ...bracket, regionals },
        myBracket: null, version: version + 1,
      });
    } else {
      const summary = summarize(bracket.cups, bracket.field, bracket.regionals, mine);
      set({
        bracket: { ...bracket, omaha: mine },
        lastPostseason: summary, myBracket: null, version: version + 1,
      });
    }
    void get().saveNow();
  },

  live: null,
  liveMeta: null,

  startManagedGame: () => {
    const { season, userTeam, version } = get();
    if (!season || seasonComplete(season)) return;

    // Play forward through any days we are not involved in. The world does not
    // wait, but our own game is left untouched for us to manage.
    let guard = 0;
    const hasMine = (): boolean => {
      const d = season.schedule[season.dayIndex];
      return !!d?.games.some((g) => g.home === userTeam || g.away === userTeam);
    };
    while (!seasonComplete(season) && !hasMine() && guard++ < 60) simNextDay(season);
    if (seasonComplete(season)) return;

    const day = season.schedule[season.dayIndex];
    const g = day?.games.find((x) => x.home === userTeam || x.away === userTeam);
    if (!day || !g) return;

    const home = season.teams[g.home];
    const away = season.teams[g.away];
    if (!home || !away) return;

    set({
      live: createLiveGame(home.team, away.team, season.rng, {
        managing: g.home === userTeam ? 'home' : 'away',
        engine: season.config.engine,
        homeStarter: g.slot,
        awayStarter: g.slot,
      }),
      liveMeta: { home: g.home, away: g.away, day: day.day, conference: g.conference },
      version: version + 1,
      tab: 'home',
      screen: 'box',
    });
  },

  submitTactic: (t) => {
    const { live, version } = get();
    if (!live || live.over) return;
    live.submit(t);
    set({ version: version + 1 });
  },

  pinchHitFor: (h) => {
    const { live, version } = get();
    if (!live) return;
    live.pinchHit(h);
    set({ version: version + 1 });
  },

  bringIn: (p) => {
    const { live, version } = get();
    if (!live) return;
    live.changePitcher(p);
    set({ version: version + 1 });
  },

  autoFinish: () => {
    const { live, version } = get();
    if (!live) return;
    live.finish();
    set({ version: version + 1 });
  },

  endManagedGame: async () => {
    const { season, live, liveMeta, userTeam, version } = get();
    if (!season || !live || !liveMeta || !live.over) return;

    // A bracket game belongs to the bracket, not to the calendar. It is handed
    // back as a pre-played result and the round steps around it, so the game you
    // managed is recorded exactly as a simulated one would have been.
    if (liveMeta.postseason) {
      const mb = get().myBracket;
      if (mb) {
        mb.preplayed.set(pairKey(liveMeta.home, liveMeta.away), live.result);
        stepBracket(mb.state, mb.preplayed);
      }
      set({ live: null, liveMeta: null, version: version + 1 });
      // Saved only when the tournament ends, by `closeMyBracket`.
      //
      // A save taken mid-bracket would write a season carrying games the saved
      // `bracket` has no record of — the live sub-bracket is not serialisable —
      // so a reload would resume at the top of the stage and play them again on
      // top of themselves. Stage boundaries are the only consistent moments.
      if (mb && mb.state.done) get().closeMyBracket();
      return;
    }

    // The rest of the day happens now, with our game held out, then ours is
    // written down through the same path a simulated game takes.
    simNextDay(season, { hold: userTeam });
    recordResult(season, liveMeta.home, liveMeta.away, live.result, {
      conference: liveMeta.conference,
      day: liveMeta.day,
    });

    set({ live: null, liveMeta: null, version: version + 1, screen: 'today' });
    await get().saveNow();
  },

  setStrategy: (key, value) => {
    const { season, userTeam, version } = get();
    const me = season?.teams[userTeam];
    if (!me) return;
    // Mutated in place: the engine reads TeamRecord.strategy when it builds each
    // game, so this is live from the next pitch onward.
    me.strategy = { ...me.strategy, [key]: value };
    set({ version: version + 1 });
    void get().saveNow();
  },

  swapLineup: (a, b) => {
    const { season, userTeam, version } = get();
    const team = season?.teams[userTeam]?.team;
    if (!team) return;
    const order = team.lineup;
    const x = order[a];
    const y = order[b];
    if (!x || !y) return;
    order[a] = y;
    order[b] = x;
    set({ version: version + 1 });
    void get().saveNow();
  },

  moveRotation: (index, delta) => {
    const { season, userTeam, version } = get();
    const team = season?.teams[userTeam]?.team;
    if (!team) return;
    const to = index + delta;
    const rot = team.rotation;
    if (to < 0 || to >= rot.length) return;
    const x = rot[index];
    const y = rot[to];
    if (!x || !y) return;
    rot[index] = y;
    rot[to] = x;
    set({ version: version + 1 });
    void get().saveNow();
  },

  saveState: 'idle',
  lastSaveError: null,

  saveNow: async (slot = AUTOSAVE_SLOT) => {
    const { season, year, userTeam, history, lastPostseason } = get();
    if (!season) return;
    const team = season.teams[userTeam];
    set({ saveState: 'saving', lastSaveError: null });
    try {
      await saveDynasty(slot, team ? team.def.school : 'Dynasty', season, year, userTeam, {
        history,
        postseason: lastPostseason,
        bracket: get().bracket,
        jobSearch: get().jobSearch,
        coach: get().coach,
        phase: get().phase,
        review: get().lastReview,
        outcome: get().lastOutcome,
      });
      set({ saveState: 'saved' });
    } catch (e) {
      // A failed save must say so. Silently losing a dynasty is the worst
      // outcome this app has available to it.
      set({ saveState: 'error', lastSaveError: e instanceof Error ? e.message : String(e) });
    }
  },

  loadSlot: async (slot = AUTOSAVE_SLOT) => {
    const loaded = await loadDynasty(slot);
    if (!loaded) return false;
    // Saves written before box scores existed carry none, and would otherwise
    // resume capturing for nobody.
    loaded.season.captureBoxFor = loaded.userTeam;
    loaded.season.boxScores ??= {};
    set({
      season: loaded.season,
      year: loaded.year,
      userTeam: loaded.userTeam,
      needsTeam: false,
      history: (loaded.history ?? []) as SeasonRecord[],
      // Saves made before the dynasty layer carry no coach; start a fresh one
      // rather than refusing to load them.
      coach: (loaded.coach as CoachState | undefined) ?? newCoach('Coach'),
      lastPostseason: (loaded.postseason ?? null) as PostseasonSummary | null,
      // Back into the postseason where it was left. A live sub-bracket is not
      // saved, so a reload taken mid-tournament replays that stage from the top
      // rather than resuming inside a round.
      bracket: (loaded.bracket ?? null) as PostseasonProgress | null,
      jobSearch: Boolean(loaded.jobSearch),
      // Back to the step the offseason was on, so a reload mid-sequence resumes
      // rather than stranding the player on the dashboard with a week of
      // recruiting budget already spent and nowhere to spend the rest.
      phase: (loaded.phase ?? null) as Phase,
      lastReview: (loaded.review ?? null) as Review | null,
      lastOutcome: (loaded.outcome ?? null) as SeasonOutcome | null,
      version: get().version + 1,
      tab: 'home',
      screen: 'today',
      lastOffseason: null,
    });
    return true;
  },
}));

/**
 * The seed the world is built from.
 *
 * Exported because the team-selection screen generates the same world to show
 * real roster numbers before you sign. Both sides must use this constant — if
 * they ever seed differently the screen goes back to advertising a job that does
 * not exist.
 */


/** The record you coach. Null before a dynasty is started. */
export function useUserTeam() {
  return useDynasty((s) => (s.season ? s.season.teams[s.userTeam] ?? null : null));
}

/** Your conference table, recomputed when the engine reports a change. */
export function useConferenceTable() {
  const season = useDynasty((s) => s.season);
  const team = useUserTeam();
  useDynasty((s) => s.version);          // subscribe to in-place mutation
  if (!season || !team) return [];
  return standings(season, team.conference);
}
