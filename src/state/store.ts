// store.ts
// The app's state. Thin on purpose: the engine owns the simulation, this owns
// what the player is currently looking at.
//
// One thing to know. The engine mutates its own structures in place — a season
// accumulates into the same objects, and the offseason rewrites rosters on the
// players themselves. That is right for a simulation and wrong for React, which
// re-renders on reference change. So every mutation bumps `version`, and screens
// read that when they need to recompute. Cloning a 96-team world on every
// simulated day would be the alternative, and it would be slower than the
// simulation it exists to display.

import { create } from 'zustand';
import {
  createSeason, simNextDay, simSeason, seasonComplete, standings, nextSeason, rpi, rpiOrder,
  seasonLength, regularRecord, archiveSeason, recordSeasonMarks,
  recordCareerMarks, recordResult, restedFirst, seedTeams,
  type SeasonState, type TeamRecord,
} from '../engine/season.js';
import { activeIds, honoursByPlayer, inductees } from '../engine/hall.js';
import { BADGES } from '../engine/badges.js';
import {
  recordCoachMarks, RECORDS, type RecordKey, type RecordMark,
} from '../engine/records.js';
import { overallOf } from '../engine/ratings.js';
import type { GameResult } from '../engine/game.js';
import { playerId } from '../engine/types.js';
import type { Hitter, Pitcher, PlayerId, Tactic } from '../engine/types.js';
import { createLiveGame, type LiveGame } from '../engine/liveGame.js';
import {
  departAndDevelop, fillRosters, holesFor as rosterHoles, reinstate,
  type OffseasonReport,
} from '../engine/progression.js';
import {
  letHimGo, makeTheCase, sceneFrom, type KeepPitch, type KeepScene,
} from '../engine/draft.js';
import {
  newCoach, restoreCoach, reviewSeason, jobOffers, rosterStrength, contractFor, playerBoard,
  prestigeStars, skillPoints, takeChair,
  type CoachState, type CoachSkills, type CoachProfile, type JobOffer, type Review,
  type SeasonOutcome,
} from '../engine/program.js';
import {
  runRivalYear, seatCoaches, syncCoachMods, type CarouselMove,
} from '../engine/rivals.js';
import {
  ACHIEVEMENTS, awardFirstOverall, awardSeason, awardTopRecruit, noFeats,
  type AchievementId,
} from '../engine/achievements.js';
import {
  markAllRead, newItem, push, restoreInbox, unreadCount, type InboxItem,
} from '../engine/inbox.js';
import {
  runPostseason, freezeRegularSeason, stageConferenceTournaments,
  stageRegionals, regionalPairing, summarize,
  startSeriesBracket, stepBracket, nextGameFor, resultOf, pairKey, hostOfGame,
  REGIONAL_LENGTHS, SERIES, regionOf, deAsResult, roundName,
  seasonAwards, allConference, coachOfTheYear,
  conferenceField, conferenceIds, conferenceTournament, singleElimination, REGIONS,
  recordSchoolAnnals,
  selectNationalField, openingPairs, splitShowdown, stageOpening, bestOf,
  type SeriesBracket,
  type Finish, type PostseasonSummary, type ConferenceTournament,
  type RegionalSeries, type TournamentResult, type NationalField,
  type OpeningResult, type NationalResult,
} from '../engine/postseason.js';
import {
  startDoubleElim, stepDoubleElim, runDoubleElim, liveSlotFor, slotName,
  resultOfDE,
  type DoubleElim, type DoubleElimResult, type DESlot,
} from '../engine/doubleElim.js';
import {
  SCHOLARSHIPS, RECRUITING_BUDGET, MAX_PER_RECRUIT, RECRUITING_WEEKS, budgetFor,
  weeklyBudget, windowBudget,
  aiTargets, weeklyPoints, closeWeek, resetWeeklySpend, canPursue, inPipeline,
  leadersAtWeekStart,
} from '../engine/recruiting.js';
import { pitchFor, developmentScore } from '../engine/pitch.js';

/**
 * Give the rest of the country a head start on the board.
 *
 * Runs once as the window opens: every other program picks its targets and banks
 * a week's worth of interest, so the player arrives at a board that is already
 * contested. The user's own program is skipped — his head start is the one he
 * chooses.
 *
 * Exported for the tests, which hold the seeded board to a coverage standard:
 * a top prospect with nobody on him at the open is the bug this exists to fix.
 */
export function seedRivalInterest(season: SeasonState, userTeam: number): void {
  // Two passes, not one. A single pass leaves the top of the class half
  // covered — every board is picked against an empty field, so the elite
  // programs all converge on the same handful of names and the rest of the
  // five stars open the window with nobody on them. The second pass sees the
  // first pass's leaders and spreads to whoever is still uncovered. Its points
  // land at half weight: coverage comes from target selection, not point size,
  // and full weight would double the AI's head start over the player.
  for (const scale of [1, 0.5]) {
    const snapshot = leadersAtWeekStart(season.recruiting);
    for (const record of season.teams) {
      if (record.index === userTeam) continue;
      const conf = CONFERENCES.find((c) => c.id === record.conference);
      const pitch = pitchFor(season, record, conf?.region ?? 'Gulf', developmentScore(record));
      // His own coach, where the world has been seated with them: a program run
      // by a recruiter opens the window ahead of one that is not, which is the
      // same head start the user's own reputation buys him. Forty five and
      // twenty are what a chair with nobody in it is worth.
      const staff = record.coach;
      for (const { prospect, actions } of aiTargets(
        record.index, pitch, staff?.prestige ?? 45, season.recruiting.prospects,
        holesFor(record), season.rng, snapshot,
        season.draft?.rivalSpend[record.index] ?? 0,
      )) {
        prospect.points[record.index] =
          (prospect.points[record.index] ?? 0)
          + weeklyPoints(
            prospect, pitch, actions,
            staff?.prestige ?? 45, staff?.skills.recruiting ?? 20,
          ) * scale;
      }
    }
  }
  // The spend is the AI's own; the player's budget is untouched.
  resetWeeklySpend(season.recruiting);
}

/**
 * What one week of the recruiting board is worth to this program.
 *
 * Its own prestige tier, less whatever the draft phase has already spent
 * keeping people. Read through one function because two screens and one action
 * all have to agree about it: the board header prints it, the spend control
 * caps against it, and `recruit` refuses above it.
 */
export function boardBudget(season: SeasonState | null, userTeam: number): number {
  return weeklyBudget(
    prestigeStars(season?.teams[userTeam]?.prestige ?? 50),
    season?.draft?.spent ?? 0,
  );
}

/**
 * The case a coach can honestly make to a man professional baseball has just
 * taken, assembled from what is true of the program right now.
 *
 * Same principle as `pitchFor` in the recruiting model: every number is read
 * off real state, so a promise is credible exactly where the program can back
 * it and nowhere else. `blockedBy` is the one that has to be per player — a
 * role is only open if nobody better is standing in it — and it reads the
 * roster *after* the draft has emptied it, which is the roster he would
 * actually be coming back to.
 */
function sceneFor(
  season: SeasonState, userTeam: number, coach: CoachState, p: Hitter | Pitcher,
  round: number,
): KeepScene {
  const record = season.teams[userTeam];
  const roster = record
    ? [...record.team.lineup, ...record.team.bench,
      ...record.team.rotation, ...record.team.bullpen]
    : [];
  // The assembly itself lives in `sceneFrom`, because the other ninety five
  // programs now build the same object for the same negotiation and two copies
  // of "what is coming back worth" would drift. All this supplies is the one
  // thing that is genuinely yours: an actual coach, instead of the league
  // average their staffs are.
  return sceneFrom(
    record?.prestige ?? 50, roster,
    { prestige: coach.prestige, tenure: coach.tenure, training: coach.skills.training },
    p, round,
  );
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
import {
  autoBattingOrder, strategyFor, strategyForPhilosophy, type Strategy,
} from '../engine/strategy.js';
import { HOME_CONFERENCE, CONFERENCES } from '../data/schools.js';
import {
  saveDynasty, loadDynasty, listSaves, deleteSave, newSlotId, AUTOSAVE_SLOT,
  type SaveSummary,
} from './persistence.js';
// Re-exported because the slot is the store's vocabulary as much as the disk's,
// and every existing caller already imports it from here.
export { AUTOSAVE_SLOT } from './persistence.js';
export type { SaveSummary } from './persistence.js';
import { toPortable, fromPortable } from './seasonCodec.js';
import { WORLD_SEED, START_YEAR } from './world.js';
// Re-exported so the screens that already import it from here keep working.
export { WORLD_SEED, START_YEAR, careerSeed } from './world.js';
import {
  workerAvailable, simSeasonInWorker, disposeWorker,
} from './simClient.js';
import type { SimProgress } from './simWorker.js';

export type Tab = 'home' | 'team' | 'season' | 'program';

/** A screen laid over whatever frame the game is in. See `overlay` below. */
export type Overlay =
  'schedule' | 'standings' | 'rankings' | 'saves' | 'inbox' | 'program' | 'book';

/** The three tabs of the program page, which is addressable from the inbox. */
export type ProgramSheet = 'board' | 'coach' | 'hall';

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
/**
 * The order the offseason runs in.
 *
 * The draft comes *before* recruiting, which is the order that makes the two
 * screens about each other: the holes the draft leaves are the holes you go
 * shopping for. With recruiting first you were signing a class against a roster
 * that had not lost anybody yet, and the draft was a receipt.
 */
export const PHASES: readonly Exclude<Phase, null>[] =
  ['awards', 'review', 'coach', 'draft', 'recruiting', 'signing'];

/** What each step is called on the rail across the top. */
export const PHASE_LABEL: Record<Exclude<Phase, null>, string> = {
  awards: 'AWARDS',
  review: 'SEASON',
  coach: 'COACH',
  draft: 'DRAFT',
  recruiting: 'RECRUIT',
  signing: 'CLASS',
};

export interface TabDef {
  id: Tab;
  label: string;
  screens: Array<{ id: string; label: string }>;
}

/** Bottom nav and the sub-nav under it, exactly as the mockup lays them out. */
export const TABS: readonly TabDef[] = [
  // TODAY and the WIRE only. The inbox and the scorebook used to sit here too,
  // and both were second doors to rooms with better entrances: the inbox is
  // the bell on the top bar (reachable from every frame, offseason included),
  // and the scorebook is where PLAY BALL takes you. A nav item that duplicates
  // a control an inch away is one more thing to read on a phone.
  { id: 'home', label: 'HOME', screens: [
    { id: 'today', label: 'TODAY' }, { id: 'wire', label: 'WIRE' }] },
  // Statistics are your players, so they live with your players. Strategy is a
  // standing policy rather than a thing you check, so it sits with the program.
  // Awards are now part of the record books: only the ones your program won,
  // year by year, which is the only version of that list anybody cares about.
  { id: 'team', label: 'TEAM', screens: [
    { id: 'roster', label: 'ROSTER' }, { id: 'lineup', label: 'LINEUP' }, { id: 'stats', label: 'STATS' }] },
  { id: 'season', label: 'SEASON', screens: [
    // CONFERENCE, not STANDINGS: the tab beside it is the national table, and
    // two tabs that both mean "the standings" leave the player working out
    // which one he is looking at from the contents rather than the name.
    { id: 'sched', label: 'SCHEDULE' }, { id: 'stand', label: 'CONFERENCE' }, { id: 'rankings', label: 'NATIONAL' }] },

  // Saves sit here because this tab is the one that is about the career rather
  // than about the season: the board, the record books, the standing policies.
  // Which dynasty you are coaching, and whether there are others, is the same
  // kind of question — and it is the one place in the app where the bottom nav
  // is present and nothing is half-decided, which is the only safe moment to
  // put a career down and pick a different one up.
  // SAVES left this strip when the coach portrait grew a menu: the menu is on
  // every frame, the offseason included, and a second door to the same room
  // was one more label sharing 360 pixels. The 'saves' screen id still
  // resolves — the menu and the overlay both route to it.
  { id: 'program', label: 'PROGRAM', screens: [
    { id: 'records', label: 'PROGRAM' },
    // The whole country, one door. Every other route to a rival's page goes
    // through a table that happens to mention them; this one is the directory.
    { id: 'colleges', label: 'COLLEGES' },
    { id: 'history', label: 'HISTORY' },
    { id: 'strategy', label: 'STRATEGY' }] },
];

/** How far through the postseason we are, and what has happened so far. */
/**
 * The national stage, in progress. Grown piece by piece so a reload resumes
 * exactly where June stood: the field is selected once, the opening series
 * accumulate to four, the two showdown brackets land when they finish, and
 * the championship series closes it.
 */
export interface NationalProgress {
  field: NationalField;
  opening: OpeningResult[];
  bracketA: DoubleElimResult | null;
  bracketB: DoubleElimResult | null;
  final: TournamentResult | null;
}

export interface PostseasonProgress {
  /**
   * Three stages that are played, not steps that are clicked through. The old
   * names stay in the type because a save written before the format changed
   * still has to load; `usableBracket` refuses anything it cannot play.
   */
  stage: 'conference' | 'regional' | 'national' | 'done' | 'selection' | 'omaha';
  cups: ConferenceTournament[];
  /** Sixteen regional championship series, as they are decided. */
  regionals: RegionalSeries[];
  /** The whole national stage, from field selection to the trophy. */
  national: NationalProgress | null;
}

/**
 * Your tournament, in progress.
 *
 * `others` is everything at this stage that does not involve you, already
 * played — the world does not wait while you take your games one at a time.
 * `slot` is where your result belongs when it is finished, because Omaha seeds
 * off regional order and dropping yours on the end would reseed the country.
 */
export type MyBracketKind =
  | 'conference' | 'regional' | 'opening' | 'national' | 'final';

export type MyBracket =
  | {
      kind: 'conference' | 'national';
      format: 'double';
      state: DoubleElim;
      /** Which showdown half, when kind is 'national'. */
      half?: 'A' | 'B';
      preplayed: Map<string, GameResult>;
    }
  | {
      kind: 'regional' | 'opening' | 'final';
      format: 'series';
      state: SeriesBracket;
      /** The regional's identity, carried so the result can be filed. */
      meta?: { region: string; name: string; aLabel: string; bLabel: string };
      preplayed: Map<string, GameResult>;
    };

/**
 * The end of your run, written down at the moment it happens.
 *
 * Elimination used to be read off the live bracket, and the live bracket is
 * gone by the time anything can look at it. Losing a deciding game folds the
 * tournament into the stage results in the same breath — one React commit
 * carries both, so no screen ever renders the instant where you are out and
 * your bracket still exists. A game you managed is worse: the postseason screen
 * is unmounted behind the manage screen while it is decided, so it remounts
 * knowing nothing at all.
 *
 * So the fact is stored rather than derived. It survives the bracket, the
 * unmount and a reload, which is what makes it possible to say so exactly once.
 */
export interface Knockout {
  year: number;
  kind: MyBracketKind;
  /** The round that ended it, already in words: "the losers final". */
  label: string;
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
  /**
   * Move to the next step. At the end of the sequence, rolls the year over.
   *
   * `from` is the step the pressed button was rendered on. Passing it makes a
   * doubled call harmless: the second invocation still says "leave the coach
   * step", the store has already left it, and nothing happens — where an
   * unqualified second call would read the *new* phase and advance again,
   * skipping a whole step (and, past the coach step, releasing every drafted
   * man without the retention screen ever appearing). Omitted, the call is
   * unconditional — the form the tests and the store's own tail use.
   */
  nextPhase: (from?: Phase) => Promise<void>;
  /**
   * Make one of the four cases to a man a professional club has just taken.
   *
   * The offer is recruiting budget and it is gone whether it works or not, so
   * this is the one action in the game that can cost a coach a class and give
   * him nothing back. See `engine/draft.ts`.
   */
  keepPlayer: (id: PlayerId, pitch: KeepPitch, offer: number) => void;
  /** Shake his hand and keep the money. */
  releasePlayer: (id: PlayerId) => void;
  /** Put a skill point into one of the coach's four attributes. */
  spendSkill: (skill: keyof CoachSkills) => void;
  /**
   * Take a point back off a skill, if it was put there on this visit.
   *
   * Reported: three points went into one skill by mistake and there was no way
   * back. Spending is still permanent — a coach does not get to redistribute a
   * career every June — but it is only permanent from the moment the step
   * closes, which is the difference between a decision and a slip of the thumb.
   */
  refundSkill: (skill: keyof CoachSkills) => void;
  /**
   * What has been spent since the coach step opened, per skill.
   *
   * The ledger is what makes an undo an undo rather than a respec: only points
   * put on during this visit can come off, so the four skills cannot be
   * rearranged years later. Cleared when the step is left — including by a
   * reload, which is honest, since leaving the screen is exactly what commits
   * them.
   */
  spentThisStep: Partial<Record<keyof CoachSkills, number>>;
  /** Close the books on the season just played. Called when the review opens. */
  settleSeason: () => void;
  /** Re-enter the offseason sequence. The phase is not persisted, so a reload
   *  between steps lands back on the dashboard and needs a way in. */
  openOffseason: () => void;
  /** What the season came to, kept for the review screen. */
  lastOutcome: SeasonOutcome | null;

  /**
   * What has happened to your world, newest first.
   *
   * The one place in the store that only ever grows during a career, which is
   * why `push` trims it — see `engine/inbox.ts`.
   */
  inbox: InboxItem[];
  /**
   * File something. Everything that posts goes through here so the trim and the
   * id are in one place rather than at a dozen call sites.
   *
   * `key` makes the post idempotent within its year — see `newItem`. Anything
   * written by a scan rather than by an event needs it, because a scan runs
   * again every time the calendar moves.
   */
  post: (item: Omit<InboxItem, 'id' | 'read'> & { key?: string }) => void;
  /** What opening the screen does. Nothing else clears the badge. */
  readInbox: () => void;
  /**
   * What has happened to you since the last time the calendar moved.
   *
   * Called after anything that advances the season — a day, a managed game, a
   * whole year in the worker. See the writers in `seasonNews`.
   */
  noteSeasonNews: () => void;

  /**
   * Begin a dynasty. Pass a team index to choose the job, and the profile the
   * creation step collected. Without the profile the career belongs to a man
   * called "Coach", which is the pre-v0.6.3 behaviour and what the tests use.
   */
  start: (seed?: number, team?: number, profile?: CoachProfile) => void;
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
  /** Leave a finished stage for the next one. */
  advanceBracket: () => void;
  /** Open whatever stage the bracket is on. Called on arrival, not by a press. */
  openStage: () => void;
  /** The national stage's own sub-steps: field, opening, showdown, final. */
  openNationalStep: () => void;
  /**
   * The furthest step of the offseason you have reached this year.
   *
   * The rail is a map, not a menu: you can go back and re-read the awards from
   * recruiting, but you cannot skip forward past a step you have not done.
   */
  furthestPhase: number;
  /** Jump back to a step already visited. Ignored for anything further on. */
  goPhase: (phase: Exclude<Phase, null>) => void;
  /**
   * Your own tournament, one round at a time.
   *
   * Never persisted: it holds a live season reference and two Maps, and it only
   * exists between the moment a stage opens and the moment your run in it ends.
   * The stage results it folds into `bracket` are what survive.
   */
  myBracket: MyBracket | null;
  /** Take your own bracket game. Opens the manage screen. */
  manageBracketGame: () => void;
  /**
   * Let the computer play it: the round you are in, every round until you are
   * next on the field, or the whole rest of the tournament.
   */
  /**
   * Let the computer play it.
   *
   * A game is one night — a game in every series still going, which is the
   * unit when one of them is yours. A round finishes the whole round, which is
   * the unit when none of them are: a knocked-out coach should not have to
   * press twenty times to watch a best of seven he is not in.
   */
  simBracket: (mode: 'game' | 'round' | 'rest') => void;
  /** Fold a finished run into the stage results and move on. Internal. */
  closeMyBracket: () => void;
  /** How your June ended, once it has. Null while you are still alive in it. */
  knockout: Knockout | null;
  /** Read elimination off the live bracket and keep it. Internal. */
  noteKnockout: () => void;
  /**
   * What June has already said to you, keyed `${year}:in:${stage}` and
   * `${year}:out:${kind}`.
   *
   * A ref held across renders is not enough: the postseason screen is unmounted
   * and rebuilt every time you manage a game, and a fresh ref believes it has
   * never spoken. Saved with the dynasty, so a reload does not repeat itself
   * either.
   */
  postseasonSeen: string[];
  markPostseasonSeen: (key: string) => void;

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
  /**
   * The saves menu is in here with the tables for exactly the reason the tables
   * are: the offseason owns the whole screen, so there is no nav to hang it off
   * between the last game of one year and the first of the next — which is the
   * stretch containing every decision somebody would want a copy of the dynasty
   * before making.
   */
  /**
   * The inbox, the program page and the record book are in here for a third
   * reason, and it is the one that made the inbox worth building twice: they are
   * where the *cards* point. An item that names a man, a program or a verdict
   * has to be able to open it from wherever the card was read, and the card can
   * now be read during the offseason and the postseason — where there is no nav
   * at all. A destination that only works in one of the three frames is a
   * notification that is tappable on Tuesdays.
   */
  overlay: Overlay | null;
  openOverlay: (o: Overlay) => void;
  closeOverlay: () => void;
  /**
   * Which sheet the program page opens on.
   *
   * In the store rather than in `Program.tsx`'s own state because it is now
   * addressed from outside — a board verdict in the inbox opens the board, an
   * achievement opens the cabinet — and a component that owns its tab cannot be
   * told which tab to be on.
   */
  programSheet: ProgramSheet;
  setProgramSheet: (s: ProgramSheet) => void;

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
  /**
   * Deal the current nine into a sound batting order in one tap.
   *
   * Reorders only — the same men, every position intact — through the engine's
   * `autoBattingOrder`, so the card it produces obeys every rule a hand-built
   * one does. Manual swaps stay available afterwards; AUTO is a starting point,
   * not a lock.
   */
  autoLineup: () => void;
  /**
   * Play out the rest of the current week — today through the weekend series.
   *
   * The middle gear the dashboard was missing: SIM GAME advanced one day and
   * the next press up simulated the entire season. A week is the unit the
   * calendar actually thinks in (a midweek game, then the Friday–Sunday
   * series), so it is the unit a casual session advances by.
   */
  simWeek: () => void;

  /**
   * Which first-visit tutorials have been shown, by screen id.
   *
   * On the save rather than the device, because a dynasty is the unit of
   * "having learned this game": a second career on the same phone belongs to
   * the same player and should not re-teach, which is why the list survives
   * `newDynasty`. Reset lives on the saves screen, beside the other
   * start-again controls.
   */
  seenTutorials: string[];
  markTutorialSeen: (id: string) => void;
  /** Forget every tutorial, so the next visit to each screen teaches again. */
  resetTutorials: () => void;

  /**
   * Write the dynasty down. `name` is what the saves list will call it; left
   * out, a save is filed under the school, which is what the autosave has
   * always been called.
   */
  saveNow: (slot?: string, name?: string) => Promise<void>;
  loadSlot: (slot?: string) => Promise<boolean>;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  lastSaveError: string | null;
  /** Why the save on disk could not be opened, if it could not. */
  loadError: string | null;

  /**
   * Every dynasty on this device, newest first.
   *
   * Held in the store rather than fetched by the screen so that the actions
   * which change it — a save, a delete — can refresh it from one place. A list
   * that goes stale the moment you act on it is a list that offers to load a
   * save that is no longer there.
   */
  saves: SaveSummary[];
  savesState: 'idle' | 'loading' | 'ready' | 'error';
  /** Why the list could not be read. Almost always storage being refused. */
  savesError: string | null;
  refreshSaves: () => Promise<void>;
  /**
   * Copy the career as it stands into a slot of its own, under a name the
   * player typed. The key is generated; see `newSlotId`.
   */
  saveAs: (name: string) => Promise<void>;
  deleteSlot: (slot: string) => Promise<void>;
  /**
   * Put the game back on the creation screen.
   *
   * Everything that belongs to the career being left has to go with it, and
   * `start` clears only some of it — a bracket, a live game or an offseason
   * phase left behind would come back up over the top of a world that has not
   * been built yet.
   */
  newDynasty: () => void;
}

/**
 * A saved postseason, but only if this build can still play it.
 *
 * The format changed from double elimination to a knockout tree of series, so a
 * bracket saved by an older build describes a tournament that no longer exists.
 * Dropping it costs that year's postseason and nothing else — it is re-run from
 * the top — which is a far better outcome than resuming into a shape the screen
 * cannot read.
 */
function usableBracket(saved: unknown): PostseasonProgress | null {
  if (!saved || typeof saved !== 'object') return null;
  const b = saved as Partial<PostseasonProgress> & { regionals?: unknown };
  if ((b as { field?: unknown }).field !== undefined) return null;  // a selected field
  if (!Array.isArray(b.cups) || !Array.isArray(b.regionals)) return null;
  if (b.stage !== 'conference' && b.stage !== 'regional' && b.stage !== 'national') {
    return null;
  }
  // The expanded format: a cup without placings, a regional without its
  // labels, or a national that is a bare tree was written by the old
  // knockout build. Dropping it re-runs that June from the top, which beats
  // resuming into a shape the screen cannot read.
  if (b.cups.some((c) => !Array.isArray((c as ConferenceTournament).placings))) return null;
  if ((b.regionals as RegionalSeries[]).some((r) => typeof r.aLabel !== 'string')) return null;
  if (b.national !== null && b.national !== undefined
    && (b.national as Partial<NationalProgress>).field === undefined) return null;
  return {
    stage: b.stage, cups: b.cups, regionals: b.regionals as RegionalSeries[],
    national: (b.national as NationalProgress | undefined) ?? null,
  };
}

/**
 * Your own tournament, flattened for the disk.
 *
 * Two things in a live sub-bracket cannot make the trip. `state.season` points
 * back at the whole world, and the world carries its generator, which is a
 * function — storing it would duplicate the season and fail the clone. And
 * `preplayed` holds a game you managed while it waits for its round, as engine
 * objects with methods on them; `stepBracket` consumes an entry in the same
 * breath it is set, so at any moment a save can be taken it is already empty.
 *
 * Both are put back on the way in: the season is the one being loaded, and the
 * map starts fresh.
 */
type StoredMyBracket = {
  kind: MyBracket['kind'];
  format: 'double' | 'series';
  half?: 'A' | 'B';
  meta?: { region: string; name: string; aLabel: string; bLabel: string };
  state: Omit<SeriesBracket, 'season'> | Omit<DoubleElim, 'season'>;
};

function portableMyBracket(mine: MyBracket | null): StoredMyBracket | null {
  if (!mine) return null;
  const { season, ...state } = mine.state;
  void season;
  return {
    kind: mine.kind, format: mine.format,
    ...(mine.format === 'double' && mine.half ? { half: mine.half } : {}),
    ...(mine.format === 'series' && mine.meta ? { meta: mine.meta } : {}),
    state,
  };
}

/** Which sub-tournament the user could be live in at each stage. */
const STAGE_KINDS: Record<string, MyBracket['kind'][]> = {
  conference: ['conference'],
  regional: ['regional'],
  national: ['opening', 'national', 'final'],
};

/**
 * The tournament you were in the middle of, if this build can still play it.
 *
 * Refused unless it belongs to the stage the bracket says we are on, because
 * resuming a conference draw into the regionals would put the wrong teams on
 * screen and step a tree nobody is in. A refusal is not a loss: `openStage`
 * rebuilds the stage from the top, which is what a save written before this was
 * stored gets too.
 */
function usableMyBracket(
  saved: unknown, season: SeasonState, bracket: PostseasonProgress | null,
): MyBracket | null {
  if (!saved || typeof saved !== 'object' || !bracket) return null;
  const m = saved as Partial<StoredMyBracket>;
  if (!m.kind || !(STAGE_KINDS[bracket.stage] ?? []).includes(m.kind)) return null;

  if (m.format === 'double' && (m.kind === 'conference' || m.kind === 'national')) {
    const s = m.state as Partial<DoubleElim> | undefined;
    if (!s || !Array.isArray(s.winners) || !Array.isArray(s.seeds)) return null;
    if (s.done) return null;
    if (!(s.appearances instanceof Map) || !(s.seedOf instanceof Map)
      || !(s.losses instanceof Map)) return null;
    return {
      kind: m.kind, format: 'double',
      ...(m.half ? { half: m.half } : {}),
      state: { ...(s as Omit<DoubleElim, 'season'>), season },
      preplayed: new Map(),
    };
  }

  if (m.format === 'series'
    && (m.kind === 'regional' || m.kind === 'opening' || m.kind === 'final')) {
    const s = m.state as Partial<SeriesBracket> | undefined;
    if (!s || !Array.isArray(s.rounds) || !Array.isArray(s.seeds)) return null;
    if (s.done) return null;
    if (!(s.appearances instanceof Map) || !(s.seedOf instanceof Map)) return null;
    return {
      kind: m.kind, format: 'series',
      ...(m.meta ? { meta: m.meta } : {}),
      state: { ...(s as Omit<SeriesBracket, 'season'>), season },
      preplayed: new Map(),
    };
  }
  return null;
}

/** A saved elimination, refused unless it belongs to the year being loaded. */
function usableKnockout(saved: unknown, year: number): Knockout | null {
  if (!saved || typeof saved !== 'object') return null;
  const k = saved as Partial<Knockout>;
  if (k.year !== year) return null;
  const kinds: MyBracketKind[] = ['conference', 'regional', 'opening', 'national', 'final'];
  if (!k.kind || !kinds.includes(k.kind)) return null;
  if (typeof k.label !== 'string') return null;
  return { year, kind: k.kind, label: k.label };
}

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
  const coy = coachOfTheYear(season, lastPostseason);
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

/**
 * Stamp the user coach's offense and defense skills onto his own program's
 * record — and off everybody else's, so a job change or an old save can never
 * leave the edge behind on a team he no longer runs. `playGame` and the managed
 * game read it from there, which is how those two skills reach the field.
 */
function applyCoachMods(season: SeasonState, userTeam: number, coach: CoachState): void {
  // Every chair, not just yours. It used to clear the field and write one row,
  // which was right when the other ninety five benches were nobody's — now each
  // of them has a man with an OFFENSE and a DEFENSE of his own, and the pass
  // that forgets to write them is the pass that hands the user the only bench
  // edge in the country.
  syncCoachMods(season, userTeam, coach.skills);
}

/**
 * Put the coach's philosophy on the bench of the program he is now running.
 *
 * This is the whole reason the creation screen's play-style step is not a
 * decoration: what it collects is written onto `TeamRecord.strategy`, which is
 * the same field the strategy screen edits and the same one every game is built
 * from. Pick SMALL BALL on the way in and the first pitch of the first game is
 * already being played that way.
 *
 * Every other program is handed its own personality back for the same reason
 * `applyCoachMods` clears itself off everybody: a program you have left should
 * go back to playing like itself rather than keeping your bench for ever.
 * `strategyFor` is what built those benches in the first place, so for the
 * ninety-five teams this does not concern, it is a no-op that writes the value
 * that was already there.
 *
 * Deliberately *not* called on load. The saved season carries the strategy that
 * was actually in force, overrides included, and re-stamping the philosophy over
 * it every reload would quietly undo the strategy screen.
 */
function applyPhilosophy(season: SeasonState, userTeam: number, coach: CoachState): void {
  for (const t of season.teams) t.strategy = strategyFor(t.index);
  const me = season.teams[userTeam];
  if (me) me.strategy = strategyForPhilosophy(coach.philosophy);
}

/** The board's verdict as a headline, since `message` is the paragraph. */
const BOARD_HEADLINE: Record<Review['verdict'], string> = {
  exceeded: 'The board is delighted',
  met: 'The board is satisfied',
  missed: 'The board expected more',
  failed: 'The board is not happy',
};

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The carousel, filed at a volume a person can actually read.
 *
 * A league of ninety five careers produces somewhere between five and twenty
 * moves a year, and posting every one of them would bury the four items that
 * are about you under a directory of strangers. Two rules, and they are the
 * only two:
 *
 *   - **Your conference gets named.** Eleven programs whose games decide your
 *     season, and a change of coach at one of them is a change to your league.
 *   - **Everybody else gets counted.** One line saying how many chairs turned
 *     over is the honest summary of news you cannot act on, and it is enough to
 *     tell the player the country is alive.
 *
 * A poach out of your conference is named at both ends, because a rival being
 * taken by a bigger school is the single event the whole system exists to
 * produce and it should never be a number in a total.
 */
function postCarousel(
  store: DynastyStore, year: number, myConference: string,
  moves: readonly CarouselMove[],
): void {
  const inConference = (t: number | undefined): boolean =>
    t !== undefined && store.season?.teams[t]?.conference === myConference;

  let counted = 0;
  for (const m of moves) {
    const near = inConference(m.team) || inConference(m.from);
    if (!near) { counted += 1; continue; }
    const title = m.kind === 'poached'
      ? `${m.coach} leaves ${m.fromSchool} for ${m.school}`
      : m.kind === 'sacked'
        ? `${m.school} sack ${m.coach}`
        : m.kind === 'retired'
          ? `${m.coach} retires at ${m.school}`
          : `${m.school} hire ${m.coach}`;
    store.post({
      kind: 'carousel', year, title, body: m.detail,
      // The program the move is about, which is the page with the man on it.
      ...(m.team !== undefined ? { link: { to: 'team' as const, index: m.team } } : {}),
    });
  }
  if (counted > 0) {
    store.post({
      kind: 'carousel', year,
      title: `${counted} more coaching change${counted === 1 ? '' : 's'} around the country`,
      body: 'Outside your conference. The full picture is on the rankings table.',
    });
  }
}

/*
  ---------------------------------------------------------------------------
  The season's own news
  ---------------------------------------------------------------------------

  Reported: "the inbox stayed empty for a whole season." It did, and it was
  built that way. Every writer in this file — the verdict, the offers, the
  achievements, the draft, the carousel, the hall — fires between the last game
  of one year and the first of the next, so the notification centre had nothing
  to say during the four months it is actually being looked at, and the screen
  showed its empty state to a coach who was thirty games into a season.

  What follows is the other half: four things that happen *while* you are
  playing, filed as they happen. They are scans rather than events, because the
  calendar does not advance one day at a time — `playSeason` hands back a
  finished year from a worker — so every one of them is keyed and idempotent
  and produces the same cards whether the season was simmed in one press or
  walked through a game at a time. See `newItem`.

  The volume rule is the carousel's, applied to a season: a card has to be
  something you would tell somebody about. A typical year files two to five.
*/

/** Whether a mark in the book belongs to this program, set this season. */
const freshMark = (mark: RecordMark, abbr: string, year: number): boolean =>
  mark.team === abbr && mark.year === year;

/**
 * Your regular season so far, oldest first, as a list of won or lost.
 *
 * Off the game log rather than off the live `TeamRecord`, and that is what
 * makes every writer below path-independent. A season simmed in one press
 * arrives finished — `streak` says whatever it happened to end on and `w`/`l`
 * are the final numbers — so anything read off the record would describe a
 * different season depending on how the player chose to play it. The log is the
 * same either way.
 *
 * Bracket games are recorded through the same door and have to come off the
 * end, or a run of wins quietly spans May and June. They are counted out rather
 * than filtered by the calendar: `day` is the simulation's clock and runs well
 * past the length of the schedule even in the regular season, whereas
 * `regularRecord` is the frozen count of exactly the games that belong here.
 */
function regularGames(season: SeasonState, rec: TeamRecord): boolean[] {
  const team = rec.index;
  const played = regularRecord(rec);
  const out: boolean[] = [];
  for (const g of season.results) {
    if (g.home !== team && g.away !== team) continue;
    out.push(g.home === team ? g.homeRuns > g.awayRuns : g.awayRuns > g.homeRuns);
  }
  return out.slice(0, played.w + played.l);
}

/** The longest run of each kind in a list of results. */
function bestRuns(games: readonly boolean[]): { won: number; lost: number } {
  let won = 0;
  let lost = 0;
  let w = 0;
  let l = 0;
  for (const win of games) {
    if (win) { w += 1; l = 0; } else { l += 1; w = 0; }
    won = Math.max(won, w);
    lost = Math.max(lost, l);
  }
  return { won, lost };
}

/** Runs long enough to be worth a card, and what to call one. */
const RUN_MARKS: readonly { at: number; won: boolean; title: string }[] = [
  { at: 6, won: true, title: 'Six in a row' },
  { at: 10, won: true, title: 'Ten straight' },
  { at: 5, won: false, title: 'Five straight defeats' },
  { at: 9, won: false, title: 'Nine straight defeats' },
];

function seasonNews(store: DynastyStore): void {
  const { season, userTeam, year } = store;
  const me = season?.teams[userTeam];
  if (!season || !me) return;
  if (season.results.length === 0) return;

  /*
    THE BOOK. A mark in the all-time book with your program's name against it,
    set this year. Game records and feats are offered on the night they happen,
    so these arrive during the season; the season and career sections are
    written in June and arrive then. Either way the man who set it is one tap
    away, which is the whole reason the card exists rather than the player
    finding out months later by scrolling the book.

    The coaching section is deliberately skipped. Those marks are re-offered
    every June for as long as you hold them, so they would post a card a year
    for fifteen years saying the same thing, and the cabinet on the coach page
    already says it better.
  */
  for (const [key, mark] of Object.entries(season.records ?? {})) {
    if (!mark || !freshMark(mark, me.def.abbr, year)) continue;
    const spec = RECORDS[key as RecordKey];
    if (spec.group === 'coach') continue;
    store.post({
      kind: 'record', year, key: `book-${key}`,
      title: `${mark.holder} — ${spec.label.toLowerCase()}`,
      body: `The all-time ${spec.group} record${mark.detail ? `, ${mark.detail}` : ''}. `
        + 'It is in the book under your program now.',
      link: mark.id ? { to: 'player', id: mark.id } : { to: 'book' },
    });
  }

  const played = regularGames(season, me);
  const won = played.filter(Boolean).length;

  // A RUN. Six wins is a thing people notice; five defeats is a thing the board
  // notices. Only the longer of the two rungs is filed, so a season simmed in
  // one press does not report the same ten game run twice on its way past six.
  const runs = bestRuns(played);
  for (const r of RUN_MARKS) {
    const run = r.won ? runs.won : runs.lost;
    if (run < r.at) continue;
    if (RUN_MARKS.some((o) => o.won === r.won && o.at > r.at && run >= o.at)) continue;
    store.post({
      kind: 'season', year, key: `run-${r.won ? 'w' : 'l'}-${r.at}`,
      title: r.title,
      body: r.won
        ? `${run} straight wins. The country's tables are on the season tab.`
        : `${run} in a row the wrong way. The schedule says where it went.`,
      link: { to: 'schedule' },
    });
  }

  // THE POLL. Only the three rungs that mean anything, and only the best one
  // reached — three cards in one press saying you passed 25th, 10th and first
  // is the same news three times.
  if (played.length >= 12) {
    const rank = rpiOrder(season).findIndex((r) => r.team.index === userTeam) + 1;
    const at = [1, 10, 25].find((n) => rank > 0 && rank <= n);
    if (at !== undefined) {
      store.post({
        kind: 'season', year, key: `rpi-${at}`,
        title: at === 1 ? 'Number one in the country' : `Into the top ${at}`,
        body: `${me.def.school} are ${rank === 1 ? 'top' : `No. ${rank}`} in the RPI at `
          + `${won}-${played.length - won}.`,
        link: { to: 'program', sheet: 'board' },
      });
    }
  }

  /*
    THE BOARD, at the halfway mark.

    The one card that fires every single season, and the reason one has to. The
    inbox is where a coach is told things, and a year in which it says nothing
    at all until June teaches him not to open it — so the season's own midpoint
    is reported against the number the board gave him in February. It is not a
    new judgement and it does not move anything: the checklist is the same one
    the program page has been showing all along.

    Counted at the halfway game rather than from the current record, so the card
    says the same thing whether it was posted the night it happened or found by
    the scan after a season was simmed in one press.
  */
  const games = seasonLength(season.config);
  const half = Math.floor(games / 2);
  if (played.length >= half) {
    const at = played.slice(0, half);
    const w = at.filter(Boolean).length;
    const want = playerBoard(me.prestige, rosterStrength(me.team), games).expectation;
    store.post({
      kind: 'board', year, key: 'halfway',
      title: 'Halfway, and the board is watching',
      body: `${w}-${half - w} at the turn, on for ${Math.round((w / half) * games)} wins `
        + `against the ${want.targetWins} they asked for. ${want.detail}`,
      link: { to: 'program', sheet: 'board' },
    });
  }
}

/** Ridgemont State, the founding program, unless told otherwise. */
function defaultUserTeam(season: SeasonState): number {
  const home = season.teams.find((t) => t.conference === HOME_CONFERENCE);
  return home?.index ?? 0;
}

/**
 * Re-entrancy latch for `nextPhase`. A fast double-tap on CONTINUE delivered
 * two clicks before the first call's `set` landed, and the second call read the
 * *new* phase and advanced again — the draft step could vanish between two
 * taps, releasing every drafted man unseen. One press, one step.
 */
let phaseAdvancing = false;

/**
 * Which season-simulation request is current. `playSeason` hands the whole
 * season to a worker and, minutes of taps later, replaces the store's season
 * with whatever comes back. If the user loaded a different dynasty (or started
 * a new one) in the meantime, that result describes a world that no longer
 * exists — applying it overwrote the freshly loaded save with the old career.
 * Bumped by anything that changes which world is live; a completion whose
 * generation is stale is dropped on the floor.
 */
let simGeneration = 0;

/**
 * Which save request is the latest. Saves are fire-and-forget from a dozen
 * call sites — every recruiting spend fires one — and they all share one
 * status field. Unordered, a failing older write could stamp 'error' over a
 * newer success, and the other way round. Only the newest request gets to
 * report.
 */
let saveTicket = 0;

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
  lastWeek: null,
  phase: null,

  start: (seed = WORLD_SEED, team?: number, profile?: CoachProfile) => {
    const season = createSeason(makeRng(seed), undefined, CONFERENCES);
    // Whose games to keep box scores for. A season is built before anybody has
    // taken a job, so the engine cannot know this on its own.
    season.captureBoxFor = team ?? defaultUserTeam(season);
    // And what year it is, which the engine has no other way of knowing and the
    // record book cannot do without — a mark with no year against it is a rumour.
    season.year = START_YEAR;
    const seat = team ?? defaultUserTeam(season);
    const here = season.teams[seat]?.prestige ?? 50;
    const coach = takeChair(newCoach(profile, contractFor(here)), here);
    // The other ninety five get their men before the first pitch, seeded at what
    // their programs are worth. Without it the entire hiring ladder would be
    // open to whoever won a game first — you included.
    seatCoaches(season, seat, START_YEAR);
    applyCoachMods(season, seat, coach);
    applyPhilosophy(season, seat, coach);

    /*
      TESTING ONLY — remove before v1.0, together with the guaranteed PSC
      offer in `NewGame.tsx`. Pascagoula Tech opens every dynasty with five
      men at 99 so a tester can ride one roster to the national title and
      exercise every June screen on the way. Ratings are assigned, not
      rolled — no draw is consumed, so the rest of the world is bit-for-bit
      the world it would have been.

      Not under vitest: five best-in-country players sweep the awards of
      whatever conference they sit in, and every store test that reads an
      award off a fresh world would be testing the hack instead of the game.
    */
    if (typeof process === 'undefined' || !process.env?.['VITEST']) {
      const psc = season.teams.find((t) => t.def.abbr === 'PSC');
      if (psc) {
        const bats = psc.team.lineup.slice(0, 3);
        const arms = psc.team.rotation.slice(0, 2);
        for (const h of bats) {
          h.contact = 99; h.power = 99; h.eye = 99; h.speed = 99;
          h.range = 99; h.hands = 99; h.arm = 99; h.armAccuracy = 99;
          h.potential = 99;
        }
        for (const a of arms) {
          a.stuff = 99; a.movement = 99; a.control = 99; a.stamina = 99;
          a.potential = 99;
        }
      }
    }
    set({
      season,
      userTeam: seat,
      needsTeam: false,
      year: START_YEAR,
      version: 1,
      coach,
      lastReview: null,
      offers: [],
      history: [],
      tab: 'home',
      screen: 'today',
      lastOffseason: null,
      lastWeek: null,
      inbox: [],
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
    if (!season || get().busy) return;
    // Only during the window. Outside it the board is a scouting list.
    if (season.recruiting.week < 1 || season.recruiting.week > RECRUITING_WEEKS) return;

    const prospect = season.recruiting.prospects.find((p) => p.id === prospectId);
    if (!prospect || prospect.signedBy !== null) return;

    // Out of reach for a program this size. Refused here as well as hidden in
    // the screen, so the rule holds wherever the call comes from — and with the
    // pipeline, because a gate that forgets it here refuses the one recruit the
    // board has just told the coach he can chase. A home state kid is worth a
    // star of reach; see `canPursue`.
    const me = get().season?.teams[userTeam];
    const myStars = me ? prestigeStars(me.prestige) : 1;
    if (!canPursue(prospect, myStars, inPipeline(prospect, me?.def.state ?? ''))) return;

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
    // Against this program's budget, not a flat league-wide one: prestige buys
    // attention, and that is most of what a good job is worth on the board.
    // Less whatever the draft phase already took to keep somebody, which is the
    // sequencing the whole retention mechanic hangs on.
    const budget = boardBudget(get().season, userTeam);
    const allowed = Math.min(wanted, budget - spentElsewhere);
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
    const { season, userTeam, coach, version, busy } = get();
    if (!season || busy) return;
    const recruits = season.recruiting;
    if (recruits.week < 1 || recruits.week > RECRUITING_WEEKS) return;

    const regionOf = (teamIndex: number): Region => {
      const rec = season.teams[teamIndex];
      const conf = CONFERENCES.find((c) => c.id === rec?.conference);
      return conf?.region ?? 'Gulf';
    };

    // Taken before anyone spends, so every program judges the week against the
    // same standings. This is what lets the AI walk away from a recruit
    // somebody else has clearly locked up — without it the lost-causes filter
    // in aiTargets compares against nothing and never fires.
    const atWeekStart = leadersAtWeekStart(recruits);

    for (const record of season.teams) {
      const pitch = pitchFor(season, record, regionOf(record.index), developmentScore(record));
      const mine = record.index === userTeam;

      const staff = record.coach;
      const spends: { prospect: typeof recruits.prospects[number]; actions: number }[] = mine
        ? recruits.prospects
            .filter((p) => (p.spent[userTeam] ?? 0) > 0)
            .map((p) => ({ prospect: p, actions: p.spent[userTeam] as number }))
        : aiTargets(
            // Whatever this program spent in June comes off its week, the same
            // way `boardBudget` takes the user's draft spend off his.
            record.index, pitch, staff?.prestige ?? 45, recruits.prospects,
            holesFor(record), season.rng, atWeekStart,
            season.draft?.rivalSpend[record.index] ?? 0,
          );

      for (const { prospect, actions } of spends) {
        // Every pitch carries the reputation and the recruiting skill of the man
        // making it. That used to be true of exactly one program in ninety six,
        // which meant the player's RECRUITING points bought him an edge nobody
        // in the country could ever answer. A chair with nobody in it — an
        // unseated world, or a save from before B7 — still works at the flat
        // league-average defaults.
        const gained = weeklyPoints(
          prospect, pitch, actions,
          mine ? coach.prestige : (staff?.prestige ?? 45),
          mine ? coach.skills.recruiting : (staff?.skills.recruiting ?? 20),
        );
        prospect.points[record.index] = (prospect.points[record.index] ?? 0) + gained;
      }
    }

    const finalWeek = recruits.week >= RECRUITING_WEEKS;
    const closed = recruits.week;
    const commits = closeWeek(recruits, season.rng, finalWeek);
    resetWeeklySpend(recruits);
    recruits.week += 1;

    const mineThisWeek = commits.filter((c) => c.team === userTeam);
    const yours = mineThisWeek.map((c) => c.prospect.player.name);
    set({
      version: version + 1,
      lastWeek: { closed, yours, gone: commits.length - yours.length },
    });

    // The number one recruit in the country, at the moment he commits. Read
    // here rather than at signing day because `rank` is a fact about the class
    // as it was published and the class is regenerated at the year roll — by
    // signing day the man is on a roster and the board he was ranked on is gone.
    const chair = season.teams[userTeam];
    const top = mineThisWeek.find((c) => c.prospect.rank === 1);
    if (top && chair) {
      for (const id of awardTopRecruit(
        get().coach.achievements, get().year, chair.def.abbr, top.prospect.player.name,
      )) {
        get().post({
          kind: 'achievement', year: get().year,
          title: ACHIEVEMENTS[id].name.toUpperCase(),
          body: `${top.prospect.player.name}, the number one recruit in the country, is coming here.`,
          link: { to: 'program', sheet: 'coach' },
        });
      }
    }

    // A closed week is banked points, commitments and a burned third of the
    // window — irreversible, and until now unsaved.
    void get().saveNow();
  },

  keepPlayer: (id, pitch, offer) => {
    const { season, userTeam, coach, version, phase } = get();
    const board = season?.draft;
    if (!season || !board || phase !== 'draft') return;
    const man = board.men.find((m) => m.player.id === id);
    if (!man || man.outcome !== 'pending') return;

    const stars = prestigeStars(season.teams[userTeam]?.prestige ?? 50);
    const left = windowBudget(stars) - board.spent;
    const scene = sceneFor(season, userTeam, coach, man.player, man.round);
    const { spent, kept } = makeTheCase(man, pitch, offer, scene, left);
    board.spent += spent;

    if (kept) {
      const record = season.teams[userTeam];
      const report = get().lastOffseason;
      if (record) {
        // He takes the class-year bump and the development year he was skipped
        // for on the way out, the user's TRAINING included — this is his year,
        // and it is the year the coach just bought on his behalf.
        const gained = reinstate(
          record.team, man.player, season.rng,
          1 + (coach.skills.training - 20) / 500,
        );
        if (report) {
          report.developmentNet += gained;
          if (gained > 0) report.improved += 1; else report.declined += 1;
          // The notice stays and changes its mind. Every count of what you lost
          // reads `returned`, and the holes he no longer leaves are recomputed
          // from the roster he is standing on again.
          const row = report.drafted.find((d) => d.id === id);
          if (row) row.returned = true;
          report.holes = rosterHoles([
            ...record.team.lineup, ...record.team.bench,
            ...record.team.rotation, ...record.team.bullpen,
          ]);
        }
      }
    }
    set({ version: version + 1 });
    void get().saveNow();
  },

  releasePlayer: (id) => {
    const { season, version, phase } = get();
    const man = season?.draft?.men.find((m) => m.player.id === id);
    if (!man || phase !== 'draft') return;
    letHimGo(man);
    set({ version: version + 1 });
    void get().saveNow();
  },

  /**
   * Walk one step through the offseason.
   *
   * The steps are gated on their own work being finished — recruiting will not
   * hand over until the three weeks are spent — so this is the only thing that
   * moves the game forward once the season ends, and it cannot skip a phase that
   * still has a decision waiting in it.
   */
  nextPhase: async (from) => {
    const { phase, season, busy } = get();
    if (!season || phase === null || busy) return;
    // The press named the step it was leaving, and the store is no longer on
    // it: a doubled press, already honoured. See the interface note.
    if (from !== undefined && from !== phase) return;
    // One step per press, however fast the presses come. See `phaseAdvancing`.
    if (phaseAdvancing) return;
    phaseAdvancing = true;
    try {

    // Nothing carries over between steps. A table left open over the season
    // review would still be sitting over the top of recruiting.
    //
    // The skill ledger goes with them, and that is the whole of the rule about
    // taking points back: they can come off until the step is left, and leaving
    // it is what commits them.
    set({ overlay: null, selectedPlayer: null, spentThisStep: {} });

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
      // Anybody still sitting on the draft board has run out of time to be
      // talked to. Signing with the club that took him is what happens when a
      // coach does nothing, so doing nothing has to mean that here too rather
      // than leaving him in limbo on a screen nobody will come back to.
      for (const man of season.draft?.men ?? []) letHimGo(man);

      /*
        And with the last of them decided, the hall of fame meets. B12.

        **Here rather than at the draft step, and the reason is the same one that
        put Kingmaker at the draft step rather than on the draft screen: the
        honest moment is the one where the fact is finally true.** A junior taken
        in the fourth round is off the roster from the instant `departAndDevelop`
        runs, and induct him there and a coach who then talks him into coming back
        has a hall of famer on next year's lineup card. Every man on the board is
        resolved one line above this, either by a conversation the coach paid for
        or by the loop that lets the rest go, so this is the first moment in the
        year at which "his career is over" is a settled question.

        It is a moment on purpose. A list that silently recomputed itself would
        make induction a leaderboard with a threshold, which is what the HALL tab
        already was; the point of B12 is that somebody goes in, it is announced,
        and it stays true afterwards. `season.hall` is written once per man and
        never rescored — see `engine/hall.ts`.

        Idempotent, and it has to be: this branch is not behind `furthestPhase`,
        so walking back to the draft step and forward again runs it twice. The men
        already in are passed in as `inducted` and are never reconsidered.
      */
      const hallYear = get().year;
      /*
        `history` now includes the season that has just ended — it is written at
        the board meeting rather than at the year roll (see `settleSeason`) —
        which is what lets this line be as simple as it looks.

        It was not, and the ballot was reading every season the coach had ever
        finished *except* the last one. That is the season a graduating senior
        wins things in, and he is on the ballot precisely because it was his
        last, so the case that went to the vote was systematically missing the
        honours that argue for him.
      */
      const going = inductees({
        careers: season.careers ?? {},
        active: activeIds(season.teams),
        inducted: new Set((season.hall ?? []).map((m) => String(m.id))),
        honours: honoursByPlayer(get().history),
        year: hallYear,
      });
      if (going.length > 0) {
        season.hall = [...(season.hall ?? []), ...going];
        get().post({
          kind: 'hall',
          year: hallYear,
          title: going.length === 1
            ? `${going[0]!.name} goes into the hall`
            : `${going.length} men go into the hall`,
          body: `${going.map((m) => `${m.name}, ${m.line}`).join('. ')}. `
            + 'The plaques are on the program page, under HALL OF FAME.',
          // One man opens his own card; a class opens the wall they are on.
          link: going.length === 1 && going[0]
            ? { to: 'player', id: going[0].id }
            : { to: 'program', sheet: 'hall' },
        });
      }

      /*
        Guarded the same way `departAndDevelop` is, and for the same reason:
        the rail lets you walk back to the draft step and come forward again.
        `seedRivalInterest` is explicitly additive — run twice it doubled the
        whole country's head start on the class — and rewinding `week` to 1
        handed the player a fresh three-week window with the weeks already
        played still banked. First arrival seeds the board and starts the
        clock; a revisit changes neither.
      */
      if (get().furthestPhase < PHASES.indexOf('recruiting')) {
        seedRivalInterest(season, get().userTeam);
        season.recruiting.week = 1;
      }
      set({
        phase: next,
        furthestPhase: Math.max(get().furthestPhase, PHASES.indexOf(next)),
        // A fresh window starts with a fresh board. Last year's "week 3 is
        // over" recap surviving into this year's week 1 read as the window
        // being already finished.
        lastWeek: null,
        version: get().version + 1,
      });
      void get().saveNow();
      return;
    }

    // Entering the draft empties the roster: who leaves, and who got better.
    // The class is not placed here — recruiting has not happened yet, which is
    // the entire point of the draft coming first.
    if (next === 'draft') {
      /*
        Both scans of the finished season happen here, in the last moment the
        rosters that produced the numbers still exist.

        `departAndDevelop`, below, strips every departure off every one of the
        ninety-six rosters — and both scans work by walking a roster. Run at the
        year roll instead, a graduating senior who led the country in home runs
        entered the book with no name and no program against him, and his final
        year never reached his career page at all. That is the best season most
        players ever have and exactly what a record book and a hall of fame are
        for, so it is the one season that must not be the one that is lost.

        The archive goes first, and there are three of them now. Your program's
        seasons, so the hall of fame has a career to read; the league's season
        marks; and the league's career totals, which is B13 — one running row per
        man on a roster anywhere in the country, added to here and pruned the year
        after he leaves.

        All three are idempotent, which they have to be: walking back to the coach
        step and forward again runs this branch a second time. A year already in a
        man's career is not written twice, a mark has to be beaten rather than
        equalled, and a career total carries the year it was last folded in. The
        third was the only one that needed anything doing to it — a running total
        is the one thing here that does not get idempotence for free.
      */
      const year = get().year;
      archiveSeason(season, get().userTeam, year);
      recordSeasonMarks(season, year);
      recordCareerMarks(season, year);
      const chair = season.teams[get().userTeam];
      // Every career in the country, not only yours. It was yours alone for as
      // long as a rival bench was a strategy and a prestige number; now each of
      // them is a man with a record, and a coaching section that ranked one
      // career against nothing was measuring you against an empty field.
      if (season.records) {
        if (chair) recordCoachMarks(season.records, year, get().coach, chair.def.abbr);
        for (const t of season.teams) {
          if (t.coach) recordCoachMarks(season.records, year, t.coach, t.def.abbr);
        }
      }

      /*
        The third thing here is emphatically *not* idempotent, and the rail lets
        you walk back to the coach step and come forward again.

        `departAndDevelop` empties every roster in the league and develops
        everybody who stays. Run twice it would graduate a second class out of
        rosters that had already lost one, and it would rebuild the draft board
        over the top of decisions the coach had already paid for — an ace talked
        out of professional baseball would be gone again with his price still
        deducted. `furthestPhase` is the record of having been here, and it is
        the one thing in the offseason that only ever moves forward.
      */
      if (get().furthestPhase < PHASES.indexOf('draft')) {
        const report = departAndDevelop(season, season.rng, {
          userTeam: get().userTeam,
          training: get().coach.skills.training,
        });
        set({ lastOffseason: report });

        /*
          First overall, which is a fact about the national board and not about
          your roster — so it is read here, off the sorted list, rather than by
          asking which of your men went highest.

          `report.drafted` is ordered round then ability, which *is* the order
          the clubs took them in, so the top row is the number one pick in the
          country. It has to be checked in this branch and not on the draft
          screen: `returned` gets written the moment a coach talks somebody
          round, and a man who goes back to school was still taken first.
        */
        const first = report.drafted[0];
        const mine = get().userTeam;
        if (first && first.round === 1 && first.team === mine && chair) {
          for (const id of awardFirstOverall(
            get().coach.achievements, year, chair.def.abbr, first.name,
          )) {
            get().post({
              kind: 'achievement', year,
              title: ACHIEVEMENTS[id].name.toUpperCase(),
              body: `${first.name} went first overall. Nobody in the country was taken ahead of one of yours.`,
              link: { to: 'program', sheet: 'coach' },
            });
          }
        }
        const lost = report.drafted.filter((d) => d.team === mine && !d.returned).length;
        if (lost > 0) {
          get().post({
            kind: 'draft', year,
            title: `${lost} of your men drafted`,
            body: 'The conversation about keeping them is on the draft step, and it is paid for out of the recruiting budget you are about to open the board with.',
          });
        }
        /*
          What the winter actually produced, which is otherwise invisible.

          Development moves a rating a point or two and shows up as a number on
          a screen nobody opens twice. A badge is a thing with a name, and it is
          the only visible return on the TRAINING skill — so it gets a line
          rather than being something a coach finds by chance six months later
          on a player card. One item for the whole class, because four separate
          notices about four sophomores is how an inbox becomes noise.
        */
        if (report.badges.length > 0) {
          const list = report.badges
            .map((b) => `${b.name} — ${BADGES[b.badge].label}`)
            .slice(0, 8)
            .join('; ');
          const more = report.badges.length > 8 ? `, and ${report.badges.length - 8} more` : '';
          get().post({
            kind: 'draft', year,
            title: report.badges.length === 1
              ? 'One of your men picked something up'
              : `${report.badges.length} of your men picked something up`,
            body: `${list}${more}. Earned from what they did last spring, or worked on over the winter.`,
          });
        }
      }
      set({
        phase: next,
        furthestPhase: Math.max(get().furthestPhase, PHASES.indexOf(next)),
        version: get().version + 1,
      });
      void get().saveNow();
      return;
    }

    // Signing day is the last step; leaving it turns the year over.
    if (phase === 'signing') {
      set({ phase: null });
      await get().rollYear();
      return;
    }

    set({
      phase: next,
      furthestPhase: next
        ? Math.max(get().furthestPhase, PHASES.indexOf(next))
        : get().furthestPhase,
      version: get().version + 1,
    });
    // The quiet transitions (awards→review, review→coach) moved prestige, the
    // carousel, the history entry and spent skill points without ever writing a
    // save — a reload after any of them silently lost the lot.
    void get().saveNow();
    } finally {
      phaseAdvancing = false;
    }
  },

  spendSkill: (skill) => {
    const { coach, season, userTeam, version, spentThisStep } = get();
    if (coach.skillPoints <= 0) return;
    if (coach.skills[skill] >= 99) return;
    const next = {
      ...coach,
      skillPoints: coach.skillPoints - 1,
      skills: { ...coach.skills, [skill]: coach.skills[skill] + 1 },
    };
    // The in-game skills live on the team record too; keep the copy current the
    // moment a point lands, or the next game plays at last year's numbers.
    if (season) applyCoachMods(season, userTeam, next);
    set({
      coach: next,
      spentThisStep: { ...spentThisStep, [skill]: (spentThisStep[skill] ?? 0) + 1 },
      version: version + 1,
    });
    // The point is already off the coach; a reload before the draft step's save
    // used to lose the rating while keeping it spent.
    void get().saveNow();
  },

  spentThisStep: {},

  refundSkill: (skill) => {
    const { coach, season, userTeam, version, spentThisStep } = get();
    const on = spentThisStep[skill] ?? 0;
    // Only what this visit put there. Nothing else can come off, which is what
    // keeps this an undo rather than a way to rebuild a coach from scratch.
    if (on <= 0) return;
    const next = {
      ...coach,
      skillPoints: coach.skillPoints + 1,
      skills: { ...coach.skills, [skill]: coach.skills[skill] - 1 },
    };
    if (season) applyCoachMods(season, userTeam, next);
    set({
      coach: next,
      spentThisStep: { ...spentThisStep, [skill]: on - 1 },
      version: version + 1,
    });
    void get().saveNow();
  },

  advanceDay: () => {
    const { season, version, busy } = get();
    // `busy` because a day simmed on the main thread while the worker holds the
    // season is a day simmed into an object the worker's result will replace;
    // `live` because tonight's game is still being played and the day it
    // belongs to must not pass underneath it.
    if (!season || busy || get().live || seasonComplete(season)) return;
    simNextDay(season);
    set({ version: version + 1 });
    get().noteSeasonNews();
    // A day is a game for every team in the country; it was the largest single
    // mutation in the game that never wrote a save.
    void get().saveNow();
  },

  playSeason: async () => {
    const { season, busy } = get();
    if (!season || busy) return;
    set({ busy: true, progress: null });
    const generation = ++simGeneration;

    if (!workerAvailable) {
      // No worker: the screen freezes, but the game still works. Better a hang
      // than a dead button.
      simSeason(season);
      set({ version: get().version + 1, busy: false });
      get().noteSeasonNews();
      void get().saveNow();
      return;
    }

    try {
      const result = await simSeasonInWorker(
        toPortable(season),
        (p) => { if (generation === simGeneration) set({ progress: p }); },
      );
      // Stale: the user loaded another dynasty or started over while the worker
      // ran. The result describes a world that is no longer on screen; applying
      // it would overwrite the freshly loaded save with the old one.
      if (generation !== simGeneration) return;
      set({
        season: fromPortable(result),
        version: get().version + 1,
        busy: false,
        progress: null,
      });
      // A whole year arriving at once is still a year of things that happened
      // to you, and the scan is written so that a season simmed in one press
      // files the same cards as one walked through a day at a time.
      get().noteSeasonNews();
      void get().saveNow();
    } catch (e) {
      // Routed somewhere the player can actually see. This used to write only
      // `lastSaveError`, which nothing renders unless `saveState` is 'error' —
      // a failed sim un-dimmed the button and looked like nothing happened.
      set({
        busy: false,
        progress: null,
        saveState: 'error',
        lastSaveError: `The season could not be simulated: ${e instanceof Error ? e.message : String(e)}`,
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
      // A bid is a seat in the twenty-team national field, not a finish
      // string: the finish now records every regional participant, and a
      // regional exit is not a tournament appearance.
      madeTournament: post?.nationalField?.includes(me.index)
        ?? (post?.finish[me.index] !== undefined && post?.finish[me.index] !== 'regional'),
      // Off the regional round itself rather than off the finish string. The
      // two used to say the same thing and were never the same fact.
      wonRegional: post?.regionChampions.includes(me.index) ?? false,
      reachedOmaha: ['omaha', 'runner-up', 'champion'].includes(post?.finish[me.index] ?? ''),
      wonTitle: post?.champion === me.index,
    };

    const review = reviewSeason(
      coach, me.prestige, rosterStrength(me.team), outcome, seasonLength(season.config),
    );

    // Prestige belongs to the school and survives a coaching change.
    me.prestige = review.prestigeAfter;

    const year = get().year;
    const tenure = review.fired ? 0 : coach.tenure + 1;

    /*
      The cabinet, before the coach object is replaced.

      Read against `tenure`, which is this season counted — a man finishing his
      fifteenth year is a Lifer at the meeting that closes it, not a year later.
      `titleLastYear` comes off the history array rather than off a flag on the
      coach: the array is read here before this season is added to it, and is
      therefore exactly "the
      seasons before this one", which is the question Dynasty asks.

      The two game-level feats are read off the season and not recomputed. By
      now the box scores of ninety five programs are gone and the streak on the
      team record says whatever April left it on.
    */
    const previous = get().history[get().history.length - 1];
    const earned = awardSeason(coach.achievements, {
      year,
      team: me.def.abbr,
      conference: me.conference,
      conferenceWins: me.cw,
      conferenceLosses: me.cl,
      wonConference: outcome.wonConference,
      wonRegional: outcome.wonRegional,
      wonTitle: outcome.wonTitle,
      titleLastYear: previous?.finish === 'champion',
      stars: prestigeStars(review.prestigeBefore),
      arrivedStars: prestigeStars(coach.arrivedPrestige),
      tenure,
      feats: season.feats ?? noFeats(),
    });

    /*
      And now the other ninety five, at the one moment everything they are graded
      on is in hand: the postseason is settled, the regular season records are
      frozen, and no roster has been touched. Run at the year roll instead it
      would judge coaches against teams that had already graduated.

      It moves their programs' prestige too, which is the line that did not exist
      anywhere before B7 — `nextPrestige` was written once and only the user's
      school was ever passed through it.
    */
    const rivals = runRivalYear(season, post, {
      year,
      userTeam,
      games: seasonLength(season.config),
      userOpen: review.fired,
    });
    // Their benches changed hands, so the edge every one of their games is
    // played with has to be restamped before the next season starts.
    syncCoachMods(season, userTeam, coach.skills);

    /*
      The season, into the record books, here rather than at the year roll.

      It moved for the reason the archive moved before it: `departAndDevelop`
      empties every roster at the draft step, and `recordFor` resolves an award
      through `rosterIndex` — so a Player of the Year who graduated in June was
      simply not in the country any more by the time the record was assembled,
      and his award went into no season's list at all. The men most likely to
      win something are the men most likely to have just left, which made the
      loss systematic rather than occasional.

      Written at the board meeting, the rosters that produced the season are
      still standing and every winner resolves. It also means `history` is
      complete by the time the hall of fame meets two steps later, which is the
      other half of the same bug: the ballot could not read a man's final-year
      honours because nothing had written them down yet.
    */
    const record = recordFor(get());

    set({
      lastReview: review,
      lastOutcome: outcome,
      history: record ? [...get().history, record] : get().history,
      coach: {
        ...coach,
        prestige: review.coachPrestigeAfter,
        security: review.securityAfter,
        tenure,
        badRun: review.badRun,
        contractYears: review.contractYears,
        careerWins: coach.careerWins + outcome.wins,
        careerLosses: coach.careerLosses + outcome.losses,
        titles: coach.titles + (outcome.wonTitle ? 1 : 0),
        conferenceTitles: coach.conferenceTitles + (outcome.wonConference ? 1 : 0),
        regionalTitles: coach.regionalTitles + (outcome.wonRegional ? 1 : 0),
        tournaments: coach.tournaments + (outcome.madeTournament ? 1 : 0),
        skillPoints: coach.skillPoints + skillPoints(outcome),
      },
      version: get().version + 1,
    });

    // Filed after the state is set, so nothing here can be lost to the write
    // above it clobbering an inbox that grew while it was being assembled.
    get().post({
      kind: 'board', year,
      title: BOARD_HEADLINE[review.verdict],
      body: review.message,
      link: { to: 'program', sheet: 'board' },
    });
    if (review.prestigePenalty > 0) {
      get().post({
        kind: 'board', year,
        link: { to: 'program', sheet: 'coach' },
        title: 'Your prestige has taken a hit',
        body: `${review.badRun} seasons in a row the board did not accept. `
          + `Coaches around the country notice a pattern where they forgive an `
          + `accident — ${review.prestigePenalty} points off your reputation, on `
          + `top of the season itself.`,
      });
    }
    for (const id of earned) {
      const spec = ACHIEVEMENTS[id];
      const row = coach.achievements[id];
      get().post({
        kind: 'achievement', year,
        title: spec.name.toUpperCase(),
        body: row?.detail ? `${spec.note} ${capitalise(row.detail)}.` : spec.note,
        // The cabinet, which is where the thing he just earned is kept.
        link: { to: 'program', sheet: 'coach' },
      });
    }
    postCarousel(get(), year, me.conference, rivals.moves);

    // Prestige, the coach's career line, skill points, the history entry and a
    // whole rival year just happened; none of it was persisted before the draft
    // step's save, so a reload from the review or coach screens lost it all.
    void get().saveNow();
  },

  rollYear: async () => {
    const { season, year, busy } = get();
    if (!season || busy) return;
    set({ busy: true });

    // Every program's finished season goes into its own book before anything
    // resets — ninety six rows, the user's chair included, idempotent by year.
    // This is what a school's History page reads, and it is deliberately not
    // the coach's personal record: his career follows him, a school's past
    // stays with the school.
    recordSchoolAnnals(season, year, get().lastPostseason, get().userTeam, get().coach.name);

    /*
      The season is already in the record books: `settleSeason` writes it at the
      board meeting, where the rosters that produced it are still standing and an
      award still resolves to a man. This is the fallback for the one case that
      does not go through that door — a career that was never graded, which is
      what a reload landing past the review step looks like — and it is a worse
      record than the one above, because by now the departing class is gone and
      its awards cannot be named. Better than no season at all, and it cannot
      double up: the record for a year already written is not written again.
    */
    const last = get().history[get().history.length - 1];
    const record = last?.year === year ? null : recordFor(get());
    const review = get().lastReview;

    // The all-time book was written on the way into the draft — see `nextPhase`.
    // Nothing is archived here, because by now every man who left is off the
    // roster this would have read.

    const done = (next: SeasonState, report: OffseasonReport): void => {
      const rolled = nextSeason(next);
      // A year passes for him too. Purely what the screen prints — nothing in
      // the simulation asks how old the coach is, and no year of a career plays
      // differently because of the number.
      const coach = { ...get().coach, age: get().coach.age + 1 };

      /*
        Who would actually take a call from you.

        Before B7 this was every program that would have you, which quietly meant
        all ninety six were permanently hiring — the ladder was a shopping list
        rather than a market. Now every chair has a man in it, and the honest
        question is not "is it empty" but "would the board move him on for you".

        Empty is *not* enough on its own, and this is the trap that had to be
        avoided rather than the obvious version of the rule. `runCarousel` never
        leaves a chair open, so a filter of `!t.coach` would have produced an
        empty market every single time — and the job search screen has no way
        forward with nothing on it, so a sacked coach's career would simply have
        ended on a page that said nobody was calling.

        So: an empty chair, or one held by somebody the country rates below you.
        That is also exactly what `acceptOffer` already does when you say yes —
        the incumbent is moved on, and the inbox says so.
      */
      const offers = review?.fired
        ? jobOffers(coach, rolled.teams, (t) => t.prestige, get().userTeam, 4,
          (t) => !t.coach || coach.prestige > t.coach.prestige)
        : [];

      set({
        season: rolled,
        year: year + 1,
        version: get().version + 1,
        lastOffseason: report,
        phase: null,
        lastPostseason: null,
        lastOutcome: null,
        // Cleared with the rest of last year, and for a sharper reason than the
        // others: `settleSeason` refuses to run a second time while a review is
        // still sitting here, so a review left undismissed did not merely linger
        // on screen — it swallowed the whole of the next season's meeting.
        // Prestige, the seat, the career totals and the points you improve with
        // were all skipped in silence. Only the dismiss button on the program
        // page ever cleared it, so whether a season was graded at all came down
        // to whether the player had tapped a card.
        lastReview: null,
        lastWeek: null,
        furthestPhase: 0,
        coach,
        // Being let go puts you on the market immediately. Nobody waits.
        offers,
        // Dismissed means dismissed. The world carries on without you until you
        // take another job, and the career record is what you take with you.
        jobSearch: review?.fired ?? false,
        history: record ? [...get().history, record] : get().history,
        busy: false,
        tab: 'home',
        screen: 'today',
      });
      for (const o of offers) {
        get().post({
          kind: 'offer', year: year + 1,
          title: `${o.school} want to talk to you`,
          body: `${o.conference}, ${prestigeStars(o.prestige)} star. ${o.pitch}`,
          // The program itself. Taking the job is the job search screen's, which
          // is the whole frame while you are out of work; this is the page that
          // says what you would be taking on.
          link: { to: 'team', index: o.team },
        });
      }
      void get().saveNow();
    };

    // Departures and development already ran, on the way into the draft step.
    // What is left is the half that needed a signed class to exist: the recruits
    // go on the roster, and walk-ons fill whatever the class did not.
    const filled = fillRosters(season, season.rng, {
      userTeam: get().userTeam,
    });
    const report: OffseasonReport = {
      ...(get().lastOffseason ?? {
        graduated: [], drafted: [], recruits: 0, signed: [], walkOns: [],
        developmentNet: 0, improved: 0, declined: 0, badges: [], holes: [],
      }),
      recruits: filled.recruits,
      signed: filled.signed,
      walkOns: filled.walkOns,
    };
    done(season, report);
  },

  history: [],
  jobSearch: false,
  lastPostseason: null,
  bracket: null,
  furthestPhase: 0,
  goPhase: (phase) => {
    const at = PHASES.indexOf(phase);
    if (at < 0 || at > get().furthestPhase) return;
    set({
      phase, overlay: null, selectedPlayer: null, spentThisStep: {},
      version: get().version + 1,
    });
  },
  selectedPlayer: null,
  coach: newCoach(),
  lastReview: null,
  offers: [],

  clearReview: () => set({ lastReview: null }),
  inbox: [],
  post: (item) => set({ inbox: push(get().inbox, newItem(item)) }),
  noteSeasonNews: () => {
    const before = get().inbox;
    seasonNews(get());
    // One version bump for the whole scan rather than one per card, and none at
    // all when there was nothing to say — every caller is already re-rendering
    // for its own reasons and a scan that finds nothing must not add a frame.
    if (get().inbox !== before) set({ version: get().version + 1 });
  },
  readInbox: () => {
    const inbox = get().inbox;
    if (unreadCount(inbox) === 0) return;
    set({ inbox: markAllRead(inbox), version: get().version + 1 });
    void get().saveNow();
  },

  acceptOffer: async (team) => {
    const { season, coach, userTeam, year } = get();
    if (!season) return;
    // Only an offer that is actually on the table. Accepting clears the list in
    // the same breath, so a double-tap's second click — or a tap on a second
    // offer after the first was taken — finds nothing here and does nothing,
    // instead of seating coaches twice and posting duplicate carousel news.
    if (!get().offers.some((o) => o.team === team)) return;
    // The new job's games are the ones worth keeping now.
    season.captureBoxFor = team;
    // A new job is a clean slate with a patient board, but your reputation
    // comes with you — that is the whole point of tracking it separately.
    const next = takeChair(coach, season.teams[team]?.prestige ?? 50);
    // Somebody was sitting in this chair, and now he is not. The chair you are
    // leaving goes back on the market in the same breath — `seatCoaches` fills
    // every empty one but the one you are in, which after this line is the new
    // program rather than the old.
    const displaced = seatCoaches(season, team, year);
    const leaving = season.teams[userTeam];
    // The old program loses the in-game edge, the new one gains it.
    applyCoachMods(season, team, next);
    if (displaced) {
      get().post({
        kind: 'carousel', year,
        title: `${displaced.name} out at ${season.teams[team]?.def.school ?? 'your new job'}`,
        body: `They moved him on to hire you. ${displaced.careerWins}-${displaced.careerLosses} in the chair.`,
      });
    }
    if (leaving && leaving.index !== team) {
      const took = leaving.coach;
      if (took) {
        get().post({
          kind: 'carousel', year,
          title: `${took.name} takes over at ${leaving.def.school}`,
          body: 'The job you left did not stay open long.',
        });
      }
    }
    // And the way he plays comes with him. A philosophy is a trait of the coach,
    // not of the job, so the new bench starts where he starts — including the
    // case where the old one had been tuned away from it by hand, which belonged
    // to the program he just left.
    applyPhilosophy(season, team, next);
    set({
      userTeam: team,
      offers: [],
      jobSearch: false,
      lastReview: null,
      coach: next,
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
  programSheet: 'board',
  setProgramSheet: (s) => set({ programSheet: s, version: get().version + 1 }),

  openPlayer: (id) => set({ selectedPlayer: id }),

  closePlayer: () => set({ selectedPlayer: null }),

  playPostseason: async () => {
    const { season, busy, version } = get();
    if (!season || busy || !seasonComplete(season) || get().lastPostseason) return;
    // A bracket already exists: the postseason is running. A second press used
    // to re-freeze the regular season, throw away seven finished conference
    // tournaments, and replay the whole of June on top of itself — sixty extra
    // days on the calendar from one double-tap.
    if (get().bracket) return;

    // Freeze the regular season before a single bracket game moves a record.
    // This is the one unambiguous boundary, which is why it happens here rather
    // than being threaded through every game.
    freezeRegularSeason(season);
    set({
      bracket: { stage: 'conference', cups: [], regionals: [], national: null },
      // Last June's ending, and everything it was told, belong to last June.
      knockout: null,
      postseasonSeen: [],
      version: version + 1,
    });
    get().openStage();
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
  /**
   * Open the stage the bracket is sitting on, without a press.
   *
   * Reported from testing: "it has two unnecessary clicks — the first play the
   * tournament, after that it should appear the bracket directly." He is right.
   * A screen whose only content is the name of a tournament and whose only
   * action is to start it is a loading screen with a button on it. Arriving at a
   * stage *is* the instruction to open it, so the bracket is on screen the
   * moment you get there, with your first game already named.
   *
   * A stage you are not in is played out immediately for the same reason: there
   * is nothing for you to decide, so there is nothing to press.
   */
  openStage: () => {
    const { season, bracket, userTeam, version } = get();
    if (!season || !bracket || get().myBracket) return;

    const me = season.teams[userTeam];

    /**
     * Whether this stage still owes you a tournament.
     *
     * Not "has anything been played here yet". Opening a stage decides every
     * tournament you are not in and leaves yours live, so a save taken from
     * that moment carries the other seven and no record of yours — and a reload
     * reading `cups.length === 0` concluded the stage was finished and moved
     * past the one tournament the player was actually in. The question that
     * survives a reload is whether *your* result is on the books.
     */
    if (bracket.stage === 'conference'
      && me && !bracket.cups.some((c) => c.conference === me.conference)) {
      const mine = conferenceField(season, me.conference);
      if (mine.field.includes(userTeam)) {
        // Kept if a reload already carries them: replaying the other seven
        // would roll fresh dice and quietly change who you are about to face.
        const cups = bracket.cups.length > 0 ? bracket.cups : conferenceIds(season)
          .filter((id) => id !== me.conference)
          .map((id) => conferenceTournament(season, id));
        set({
          bracket: { ...bracket, cups },
          myBracket: {
            kind: 'conference', format: 'double',
            state: startDoubleElim(season, mine.field),
            preplayed: new Map(),
          },
          version: version + 1,
        });
        return;
      }
      set({
        bracket: { ...bracket, cups: stageConferenceTournaments(season) },
        version: version + 1,
      });
      return;
    }

    if (bracket.stage === 'regional') {
      const pairings = regionalPairing(season, bracket.cups);
      const played = (p: { a: number; b: number }): boolean =>
        bracket.regionals.some((r) => r.seeds.includes(p.a) && r.seeds.includes(p.b));
      const mine = pairings.find((p) =>
        (p.a === userTeam || p.b === userTeam) && !played(p));
      if (mine) {
        // Every other series is decided now; yours is played a game at a
        // time. Already-decided ones are kept, for the same reason the cups
        // are.
        const others = bracket.regionals.length > 0 ? bracket.regionals
          : pairings
            .filter((p) => p !== mine)
            .map((p) => ({
              ...singleElimination(
                season, seedTeams(season,
                  [p.a, p.b].map((i) => season.teams[i]!),
                  (t) => regularRecord(t).w,
                ).map((t) => t.index), REGIONAL_LENGTHS),
              region: p.id, name: p.name, aLabel: p.aLabel, bLabel: p.bLabel,
            }));
        const seeds = seedTeams(season,
          [mine.a, mine.b].map((i) => season.teams[i]!),
          (t) => regularRecord(t).w,
        ).map((t) => t.index);
        set({
          bracket: { ...bracket, regionals: others },
          myBracket: {
            kind: 'regional', format: 'series',
            state: startSeriesBracket(season, seeds, REGIONAL_LENGTHS),
            meta: {
              region: mine.id, name: mine.name,
              aLabel: mine.aLabel, bLabel: mine.bLabel,
            },
            preplayed: new Map(),
          },
          version: version + 1,
        });
        return;
      }
      if (bracket.regionals.length < pairings.length) {
        set({
          bracket: { ...bracket, regionals: stageRegionals(season, bracket.cups) },
          version: version + 1,
        });
      }
      return;
    }

    if (bracket.stage === 'national') get().openNationalStep();
  },

  /**
   * The national stage, one sub-step at a time.
   *
   * Field selection, the opening round, the two showdown brackets, then the
   * championship series. Each check asks what is missing next, so a reload
   * lands exactly where June stood; a step the user is not part of resolves
   * on arrival, the same rule every stage follows.
   */
  openNationalStep: () => {
    const { season, bracket, userTeam, version } = get();
    if (!season || !bracket || bracket.stage !== 'national' || get().myBracket) return;

    // The field, selected exactly once. `openingPairs` also settles the
    // protection swaps, so it runs here rather than lazily at drawing time.
    let national = bracket.national;
    if (!national) {
      const field = selectNationalField(season, bracket.cups, bracket.regionals);
      openingPairs(field);
      national = { field, opening: [], bracketA: null, bracketB: null, final: null };
      set({ bracket: { ...bracket, national }, version: version + 1 });
    }
    const b = get().bracket!;
    const nat = b.national!;
    const seeds = nat.field.seeds;

    // The opening round: seeds 13 through 20, best of three.
    if (nat.opening.length < 4) {
      const pairs = [
        { a: seeds[12]!, b: seeds[19]! },
        { a: seeds[13]!, b: seeds[18]! },
        { a: seeds[14]!, b: seeds[17]! },
        { a: seeds[15]!, b: seeds[16]! },
      ];
      const played = (p: { a: number; b: number }): boolean =>
        nat.opening.some((o) => o.seeds.includes(p.a) && o.seeds.includes(p.b));
      const mine = pairs.find((p) =>
        (p.a === userTeam || p.b === userTeam) && !played(p));
      if (mine) {
        const others = nat.opening.length > 0 ? nat.opening
          : pairs.filter((p) => p !== mine).map((p) => ({
            ...singleElimination(season, [p.a, p.b], [SERIES.opening]),
            aSeed: seeds.indexOf(p.a) + 1,
            bSeed: seeds.indexOf(p.b) + 1,
          }));
        set({
          bracket: { ...b, national: { ...nat, opening: others } },
          myBracket: {
            kind: 'opening', format: 'series',
            state: startSeriesBracket(season, [mine.a, mine.b], [SERIES.opening]),
            preplayed: new Map(),
          },
          version: get().version + 1,
        });
        return;
      }
      const opening = pairs.map((p) => {
        const done = nat.opening.find((o) => o.seeds.includes(p.a) && o.seeds.includes(p.b));
        return done ?? {
          ...singleElimination(season, [p.a, p.b], [SERIES.opening]),
          aSeed: seeds.indexOf(p.a) + 1,
          bSeed: seeds.indexOf(p.b) + 1,
        };
      });
      set({
        bracket: { ...b, national: { ...nat, opening } },
        version: get().version + 1,
      });
    }

    const b2 = get().bracket!;
    const nat2 = b2.national!;
    if (nat2.opening.length < 4) return;

    // The sixteen, split into two eight-team double eliminations.
    if (nat2.bracketA === null || nat2.bracketB === null) {
      const sixteen = [
        ...seeds.slice(0, 12),
        ...nat2.opening.map((o) => o.champion),
      ];
      const { bracketA, bracketB } = splitShowdown(sixteen);
      const inA = bracketA.includes(userTeam);
      const inB = bracketB.includes(userTeam);

      const next: NationalProgress = { ...nat2 };
      if (nat2.bracketA === null && !inA) {
        next.bracketA = resultOfDE(runDoubleElim(season, bracketA));
      }
      if (nat2.bracketB === null && !inB) {
        next.bracketB = resultOfDE(runDoubleElim(season, bracketB));
      }
      if (inA || inB) {
        set({
          bracket: { ...b2, national: next },
          myBracket: {
            kind: 'national', format: 'double',
            state: startDoubleElim(season, inA ? bracketA : bracketB),
            half: inA ? 'A' : 'B',
            preplayed: new Map(),
          },
          version: get().version + 1,
        });
        return;
      }
      set({ bracket: { ...b2, national: next }, version: get().version + 1 });
    }

    const b3 = get().bracket!;
    const nat3 = b3.national!;
    if (!nat3.bracketA || !nat3.bracketB) return;

    // The championship series between the two bracket champions.
    if (nat3.final === null) {
      const A = nat3.bracketA.champion;
      const B = nat3.bracketB.champion;
      if (A === userTeam || B === userTeam) {
        set({
          myBracket: {
            kind: 'final', format: 'series',
            state: startSeriesBracket(season, [A, B], [SERIES.final]),
            preplayed: new Map(),
          },
          version: get().version + 1,
        });
        return;
      }
      const final = bestOf(season, SERIES.final, A, B, 'National championship');
      const summary = summarize(b3.cups, b3.regionals, {
        field: nat3.field, opening: nat3.opening,
        bracketA: nat3.bracketA, bracketB: nat3.bracketB,
        final, champion: final.champion,
      });
      set({
        bracket: { ...b3, national: { ...nat3, final } },
        lastPostseason: summary,
        version: get().version + 1,
      });
    }
  },

  /** Leave a finished tier for the next one, which opens itself. */
  advanceBracket: () => {
    const { season, bracket, version } = get();
    if (!season || !bracket) return;
    // A tier can only be left once it is actually finished. Your own tournament
    // still live means the tier is not done; and a stage whose results are not
    // all on the books yet must not be walked past — a double-tap used to step
    // conference → regional → national in one gesture, staging the national
    // round off an empty regional list.
    if (get().myBracket) return;
    if (bracket.stage === 'conference'
      && bracket.cups.length < conferenceIds(season).length) return;
    if (bracket.stage === 'regional'
      && bracket.regionals.length < regionalPairing(season, bracket.cups).length) return;

    if (bracket.stage === 'conference') {
      set({ bracket: { ...bracket, stage: 'regional' }, version: version + 1 });
      get().openStage();
      void get().saveNow();
      return;
    }
    if (bracket.stage === 'regional') {
      set({ bracket: { ...bracket, stage: 'national' }, version: version + 1 });
      get().openStage();
      void get().saveNow();
      return;
    }
    // The national stage advances through its own sub-steps until the trophy.
    if (bracket.national === null || bracket.national.final === null) {
      get().openNationalStep();
      void get().saveNow();
      return;
    }

    set({ bracket: null, phase: 'awards', version: version + 1 });
    void get().saveNow();
  },

  myBracket: null,

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
    if (!season || !myBracket || get().busy) return;
    // A game is already being managed. Building a second LiveGame would consume
    // the season's rng again and silently discard the one in progress.
    if (get().live) return;

    // The host and the arm are worked out exactly as the tournament would:
    // in a series, home alternates from the better seed; in the double
    // elimination the better seed hosts and the final hosts the winners
    // champion. The starter is chosen by how deep into June that team is.
    let h: number; let a: number;
    if (myBracket.format === 'series') {
      const next = nextGameFor(myBracket.state, userTeam);
      if (!next) return;
      h = hostOfGame(next.series, next.series.games.length);
      a = h === next.a ? next.b : next.a;
    } else {
      const slot0 = liveSlotFor(myBracket.state, userTeam);
      if (!slot0 || slot0.a === null || slot0.b === null) return;
      h = slot0.side === 'F' ? slot0.a
        : (slot0.aSeed <= slot0.bSeed ? slot0.a : slot0.b);
      a = h === slot0.a ? slot0.b : slot0.a;
    }
    const home = season.teams[h];
    const away = season.teams[a];
    if (!home || !away) return;

    const slot = (myBracket.state.appearances.get(h) ?? 0) % 3;
    set({
      live: createLiveGame(home.team, away.team, season.rng, {
        managing: h === userTeam ? 'home' : 'away',
        engine: season.config.engine,
        homeStarter: slot,
        awayStarter: slot,
        // The same wiring the fast path gets: the Strategy screen's settings
        // govern the game you manage, and the pen is offered most rested first.
        homeStrategy: home.strategy,
        awayStrategy: away.strategy,
        homeBullpen: restedFirst(season, home),
        awayBullpen: restedFirst(season, away),
        // And the coach-skill nudge, so a managed game and a simmed one play
        // to the same odds.
        ...(home.coachMods ? { homeCoachMods: home.coachMods } : {}),
        ...(away.coachMods ? { awayCoachMods: away.coachMods } : {}),
      }),
      liveMeta: {
        home: h, away: a, day: season.dayIndex,
        conference: false, postseason: true,
      },
      version: version + 1,
    });
  },

  simBracket: (mode) => {
    const { myBracket, version } = get();
    if (!myBracket) return;
    const { state, preplayed } = myBracket;

    const step = (): void => {
      if (myBracket.format === 'series') stepBracket(myBracket.state, preplayed);
      else stepDoubleElim(myBracket.state, preplayed);
    };

    if (mode === 'game') {
      step();
    } else if (mode === 'round') {
      if (myBracket.format === 'series') {
        // To the end of this round, however many nights that takes.
        const from = myBracket.state.roundIndex;
        let guard = 0;
        while (!myBracket.state.done && myBracket.state.roundIndex === from
          && guard++ < 40) step();
      } else {
        // A double elimination has no single round index: one night is the
        // honest unit, every playable game played.
        step();
      }
    } else {
      let guard = 0;
      while (!state.done && guard++ < 200) step();
    }

    set({ version: version + 1 });
    // Before the close, which is what takes the bracket away: a round that ends
    // your run without ending the tournament is still the end of your run.
    get().noteKnockout();
    if (state.done) get().closeMyBracket();
  },

  knockout: null,

  noteKnockout: () => {
    const { myBracket, userTeam, year, knockout } = get();
    if (!myBracket) return;
    if (knockout && knockout.year === year) return;
    if (!myBracket.state.eliminated.includes(userTeam)) return;

    // The game or series that did it, so the modal can say where the year
    // stopped, already in words.
    let label = '';
    if (myBracket.format === 'series') {
      const state = myBracket.state;
      const lost = state.rounds.flat().find(
        (s) => s.winner !== null && s.winner !== userTeam
          && (s.a === userTeam || s.b === userTeam),
      );
      label = roundName(
        state.rounds.length, lost ? lost.round : state.rounds.length - 1,
      ).toLowerCase();
    } else {
      const state = myBracket.state;
      const slots = [...state.winners.flat(), ...state.losers.flat(), ...state.final];
      const fell = [...slots].reverse().find(
        (s) => s.winner !== null && s.winner !== userTeam
          && (s.a === userTeam || s.b === userTeam),
      );
      label = fell ? slotName(fell).toLowerCase() : 'the bracket';
    }
    set({ knockout: { year, kind: myBracket.kind, label } });
  },

  postseasonSeen: [],

  markPostseasonSeen: (key) => {
    const { postseasonSeen } = get();
    if (postseasonSeen.includes(key)) return;
    set({ postseasonSeen: [...postseasonSeen, key] });
    // Written through immediately. The alternative is a reload between a modal
    // and the next stage boundary showing it a second time, which is the whole
    // reason this is state rather than a ref.
    void get().saveNow();
  },

  closeMyBracket: () => {
    const { season, bracket, myBracket, userTeam, version } = get();
    if (!season || !bracket || !myBracket || !myBracket.state.done) return;
    get().noteKnockout();

    if (myBracket.kind === 'conference' && myBracket.format === 'double') {
      const me = season.teams[userTeam];
      const missed = me ? conferenceField(season, me.conference).missed : [];
      const cups: ConferenceTournament[] = [
        ...bracket.cups,
        { ...deAsResult(myBracket.state), conference: me ? me.conference : '', missed },
      ];
      // The tier does not move. Your tournament just finished and the result is
      // the thing to look at; leaving is the next press.
      set({
        bracket: { ...bracket, cups },
        myBracket: null, version: version + 1,
      });
    } else if (myBracket.kind === 'regional' && myBracket.format === 'series') {
      const mine = resultOf(myBracket.state);
      const me = season.teams[userTeam];
      const id = myBracket.meta?.region ?? (me ? regionOf(me.conference) : 'SOUTH');
      const name = myBracket.meta?.name
        ?? (REGIONS.find((r) => r.id === id)?.name ?? id);
      set({
        bracket: {
          ...bracket,
          regionals: [...bracket.regionals, {
            ...mine, region: id, name,
            aLabel: myBracket.meta?.aLabel ?? '',
            bLabel: myBracket.meta?.bLabel ?? '',
          }],
        },
        myBracket: null, version: version + 1,
      });
    } else if (myBracket.kind === 'opening' && myBracket.format === 'series') {
      const mine = resultOf(myBracket.state);
      const nat = bracket.national!;
      const seeds = nat.field.seeds;
      set({
        bracket: {
          ...bracket,
          national: {
            ...nat,
            opening: [...nat.opening, {
              ...mine,
              aSeed: seeds.indexOf(mine.seeds[0] ?? -1) + 1,
              bSeed: seeds.indexOf(mine.seeds[1] ?? -1) + 1,
            }],
          },
        },
        myBracket: null, version: version + 1,
      });
    } else if (myBracket.kind === 'national' && myBracket.format === 'double') {
      const nat = bracket.national!;
      const done = resultOfDE(myBracket.state);
      set({
        bracket: {
          ...bracket,
          national: myBracket.half === 'A'
            ? { ...nat, bracketA: done }
            : { ...nat, bracketB: done },
        },
        myBracket: null, version: version + 1,
      });
    } else if (myBracket.kind === 'final' && myBracket.format === 'series') {
      const mine = resultOf(myBracket.state);
      const nat = bracket.national!;
      const summary = summarize(bracket.cups, bracket.regionals, {
        field: nat.field, opening: nat.opening,
        bracketA: nat.bracketA!, bracketB: nat.bracketB!,
        final: mine, champion: mine.champion,
      });
      set({
        bracket: { ...bracket, national: { ...nat, final: mine } },
        lastPostseason: summary,
        myBracket: null, version: version + 1,
      });
    }
    void get().saveNow();
  },

  live: null,
  liveMeta: null,

  startManagedGame: () => {
    const { season, userTeam, version } = get();
    // `busy` because the worker owns the season during a sim — a game started
    // against that object would be recorded into whatever world replaces it.
    if (!season || get().busy) return;
    // A game already in progress: PLAY BALL is the way back to it, not a
    // second game over the top of it. The scorebook left the nav — this button
    // is now the room's only door, so it has to open the room that exists.
    if (get().live) { set({ tab: 'home', screen: 'box' }); return; }
    if (seasonComplete(season)) return;

    // Play forward through any days we are not involved in. The world does not
    // wait, but our own game is left untouched for us to manage.
    let guard = 0;
    const hasMine = (): boolean => {
      const d = season.schedule[season.dayIndex];
      return !!d?.games.some((g) => g.home === userTeam || g.away === userTeam);
    };
    let simmed = 0;
    while (!seasonComplete(season) && !hasMine() && guard++ < 60) { simNextDay(season); simmed++; }
    if (simmed > 0) {
      // Those days consumed the season's rng. Unsaved, a reload replayed them
      // from the older stream and produced a *different* league — the save has
      // to move forward with the world. The save file never carries `live`, so
      // writing here does not half-save the game about to be played.
      void get().saveNow();
    }
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
        // The same wiring the fast path gets: the Strategy screen's settings
        // govern the game you manage, and the pen is offered most rested first.
        homeStrategy: home.strategy,
        awayStrategy: away.strategy,
        homeBullpen: restedFirst(season, home),
        awayBullpen: restedFirst(season, away),
        // And the coach-skill nudge, so a managed game and a simmed one play
        // to the same odds.
        ...(home.coachMods ? { homeCoachMods: home.coachMods } : {}),
        ...(away.coachMods ? { awayCoachMods: away.coachMods } : {}),
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

    // Whoever threw is unavailable for a while, exactly as playGame records it.
    // Without this, arms used in a managed game counted as fully rested the
    // next morning and the rotation quietly rode its best relievers every night.
    for (const side of [live.result.home, live.result.away]) {
      for (const line of side.pitching.values()) {
        if (line.outs > 0 || line.bf > 0) season.lastPitched.set(line.player.id, liveMeta.day);
      }
    }

    // A bracket game belongs to the bracket, not to the calendar. It is handed
    // back as a pre-played result and the round steps around it, so the game you
    // managed is recorded exactly as a simulated one would have been.
    if (liveMeta.postseason) {
      const mb = get().myBracket;
      if (mb) {
        mb.preplayed.set(pairKey(liveMeta.home, liveMeta.away), live.result);
        if (mb.format === 'series') stepBracket(mb.state, mb.preplayed);
        else stepDoubleElim(mb.state, mb.preplayed);
      }
      set({ live: null, liveMeta: null, version: version + 1 });
      // The postseason screen is not mounted right now — it is behind this
      // game — so a loss it could have noticed has to be recorded for it.
      get().noteKnockout();
      // Saved only when the tournament ends, by `closeMyBracket`.
      //
      // A save taken mid-bracket would write a season carrying games the saved
      // `bracket` has no record of — the live sub-bracket is not serialisable —
      // so a reload would resume at the top of the stage and play them again on
      // top of themselves. Stage boundaries are the only consistent moments.
      if (mb && mb.state.done) get().closeMyBracket();
      return;
    }

    // Defence in depth behind the guards on `loadSlot` and `startManagedGame`:
    // a game must only ever be written into the season it was played against.
    // A finished season taking a forty-sixth game, or a game recorded after the
    // calendar has moved past its day, is corruption however it got here — the
    // orphaned game is dropped rather than written.
    const today = season.schedule[season.dayIndex];
    if (seasonComplete(season) || !today || today.day !== liveMeta.day) {
      set({ live: null, liveMeta: null, version: version + 1, screen: 'today' });
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
    get().noteSeasonNews();
    await get().saveNow();
  },

  setStrategy: (key, value) => {
    const { season, userTeam, version } = get();
    const me = season?.teams[userTeam];
    if (!me || get().busy) return;
    // Mutated in place: the engine reads TeamRecord.strategy when it builds each
    // game, so this is live from the next pitch onward.
    me.strategy = { ...me.strategy, [key]: value };
    set({ version: version + 1 });
    void get().saveNow();
  },

  swapLineup: (a, b) => {
    const { season, userTeam, version } = get();
    const team = season?.teams[userTeam]?.team;
    if (!team || get().busy) return;
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
    if (!team || get().busy) return;
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

  autoLineup: () => {
    const { season, userTeam, version } = get();
    const team = season?.teams[userTeam]?.team;
    if (!team || get().busy) return;
    const dealt = autoBattingOrder(team.lineup);
    // Same nine or nothing. The helper only reorders, but the invariant is
    // cheap to hold at the door and a corrupted lineup is a corrupted season.
    if (dealt.length !== team.lineup.length) return;
    team.lineup.splice(0, team.lineup.length, ...dealt);
    set({ version: version + 1 });
    void get().saveNow();
  },

  simWeek: () => {
    const { season } = get();
    // Same doors `advanceDay` guards, for the same reasons — plus `live`,
    // because a week cannot pass while tonight's game is still being managed.
    if (!season || get().busy || get().live || seasonComplete(season)) return;
    const start = season.schedule[season.dayIndex]?.week;
    if (start === undefined) return;
    let guard = 0;
    while (!seasonComplete(season)
      && season.schedule[season.dayIndex]?.week === start
      && guard++ < 10) {
      simNextDay(season);
    }
    set({ version: get().version + 1 });
    get().noteSeasonNews();
    void get().saveNow();
  },

  seenTutorials: [],

  markTutorialSeen: (id) => {
    const seen = get().seenTutorials;
    if (seen.includes(id)) return;
    set({ seenTutorials: [...seen, id] });
    // Written through, or a reload re-teaches whatever was learned since the
    // last game ended.
    void get().saveNow();
  },

  resetTutorials: () => {
    set({ seenTutorials: [] });
    void get().saveNow();
  },

  saveState: 'idle',
  lastSaveError: null,
  loadError: null,

  saveNow: async (slot = AUTOSAVE_SLOT, name?: string) => {
    const { season, year, userTeam, history, lastPostseason } = get();
    if (!season) return;
    const team = season.teams[userTeam];
    const ticket = ++saveTicket;
    set({ saveState: 'saving', lastSaveError: null });
    try {
      await saveDynasty(slot, name ?? (team ? team.def.school : 'Dynasty'), season, year, userTeam, {
        history,
        postseason: lastPostseason,
        bracket: get().bracket,
        myBracket: portableMyBracket(get().myBracket),
        knockout: get().knockout,
        postseasonSeen: get().postseasonSeen,
        jobSearch: get().jobSearch,
        // The offers themselves, not just the fact of being on the market.
        // `jobSearch: true` with no offers stored was a career that could
        // never be resumed: the job screen renders the list, and an empty
        // one has no way forward.
        offers: get().offers,
        coach: get().coach,
        phase: get().phase,
        furthestPhase: get().furthestPhase,
        review: get().lastReview,
        outcome: get().lastOutcome,
        inbox: get().inbox,
        tutorials: get().seenTutorials,
      });
      if (ticket === saveTicket) set({ saveState: 'saved' });
    } catch (e) {
      // A failed save must say so. Silently losing a dynasty is the worst
      // outcome this app has available to it. Stale requests stay quiet — a
      // newer save has already reported, and its answer is the true one.
      if (ticket === saveTicket) {
        set({ saveState: 'error', lastSaveError: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  loadSlot: async (slot = AUTOSAVE_SLOT) => {
    /**
     * A save that will not load must not take the app with it.
     *
     * Reported from testing: "tried running it from my phone but it is stuck at
     * building the league". That screen is what shows while the save is being
     * read, and the read is only ever finished by a `.then` — so a throw left
     * it on screen for ever. `loadDynasty` throws on a save from a newer build
     * by design, and the codec can throw on one whose shape has moved, which is
     * exactly what an old phone has sitting in IndexedDB.
     *
     * So: catch it, say so, and let the player start a new dynasty. Losing a
     * save is bad. Losing a save *and* being unable to play is worse.
     */
    let loaded;
    try {
      loaded = await loadDynasty(slot);
    } catch (e) {
      set({
        loadError: e instanceof Error ? e.message : String(e),
        needsTeam: true,
      });
      return false;
    }
    if (!loaded) return false;
    // Saves written before box scores existed carry none, and would otherwise
    // resume capturing for nobody.
    loaded.season.captureBoxFor = loaded.userTeam;
    loaded.season.boxScores ??= {};
    // Restamped from the save's own year rather than trusted off the season, so
    // a dynasty from before the engine carried one dates its records correctly
    // from the next game it plays.
    loaded.season.year = loaded.year;
    // Saves made before the dynasty layer carry no coach at all, and saves made
    // before the profile carry one with no age or hometown on it. Both come back
    // filled in rather than refusing to load or rendering holes.
    const coach = restoreCoach(loaded.coach);
    // Every empty chair gets a man, which for a save written before B7 is all
    // ninety five of them. Idempotent, so a career fifteen years into its own
    // carousel keeps every coach it has hired and fired — the only chair this
    // touches on a modern save is one the market genuinely failed to fill.
    seatCoaches(loaded.season, loaded.userTeam, loaded.year);
    // Restamped on every load rather than trusted from the save, so a save from
    // before the in-game skills were wired — or one that predates a job change —
    // comes up with the edge on the right program.
    applyCoachMods(loaded.season, loaded.userTeam, coach);
    /*
      Older saves carry no school annals. The one program whose past such a
      save *does* know is the user's own — his career rows name their school —
      so rows that match the current chair seed its book, and every other
      program's history honestly begins at the next June. Rows from before the
      school was stamped on them are skipped rather than guessed at: a wrong
      year in a permanent book is worse than a missing one. Idempotent by year,
      so a save that already has real annals is left exactly as it was.
    */
    const chair = loaded.season.teams[loaded.userTeam];
    if (chair) {
      chair.annals ??= [];
      for (const row of (loaded.history ?? []) as SeasonRecord[]) {
        if (!row || typeof row.year !== 'number') continue;
        if (row.school !== chair.def.school) continue;
        if (chair.annals.some((a) => a.year === row.year)) continue;
        chair.annals.push({
          year: row.year, w: row.w, l: row.l, cw: row.cw, cl: row.cl,
          // The career row's `rpi` is the *value*, not a place in a table, and
          // the table it was computed against is gone — so the seeded year
          // honestly has no rank rather than a rating dressed up as one.
          confPlace: row.confPlace, rank: 0,
          wonConference: row.wonConference,
          madeTournament: row.finish !== 'missed', finish: row.finish,
          coach: coach.name,
        });
      }
      chair.annals.sort((a, b) => a.year - b.year);
    }
    const bracket = usableBracket(loaded.bracket);
    /*
      The market, back on the table. Older saves stored `jobSearch: true` and
      nothing else — the screen that renders the offers came up empty, with no
      nav and no way out, and the career was over in a way no button could
      undo. A modern save carries the offers; an old one gets them regenerated
      from the same predicate `rollYear` used to make them, which is honest
      because a chair's willingness to hire is a fact about the world, not a
      dice roll that must be preserved.
    */
    const jobSearch = Boolean(loaded.jobSearch);
    const offers = jobSearch
      ? (Array.isArray(loaded.offers) && loaded.offers.length > 0
        ? loaded.offers as JobOffer[]
        : jobOffers(coach, loaded.season.teams, (t) => t.prestige, loaded.userTeam, 4,
          (t) => !t.coach || coach.prestige > t.coach.prestige))
      : [];
    // A world is being swapped underneath everything else in flight: any sim
    // result still coming back from the worker describes the old one.
    simGeneration += 1;
    set({
      season: loaded.season,
      year: loaded.year,
      userTeam: loaded.userTeam,
      needsTeam: false,
      // Whatever went wrong last time went wrong with a different save. Left
      // set, a newer-build slot refused once would keep warning about itself
      // over the top of the career that loaded perfectly well afterwards.
      loadError: null,
      history: (loaded.history ?? []) as SeasonRecord[],
      coach,
      lastPostseason: (loaded.postseason ?? null) as PostseasonSummary | null,
      // Back into the postseason where it was left, your own half-played
      // tournament included. A save that predates storing it — or one this
      // build cannot read — comes back without it, and `openStage` starts that
      // stage again rather than skipping the part you were in.
      bracket,
      myBracket: usableMyBracket(loaded.myBracket, loaded.season, bracket),
      // How June ended and what it has already said about it. Both are only
      // ever read against the year on them, so a save from an older build —
      // which carries neither — resumes with nothing said and nothing lost.
      knockout: usableKnockout(loaded.knockout, loaded.year),
      postseasonSeen: Array.isArray(loaded.postseasonSeen)
        ? (loaded.postseasonSeen as string[]).filter((k) => typeof k === 'string')
        : [],
      jobSearch,
      offers,
      // Merged rather than replaced: what the player has learned is a fact
      // about the player, not the save. Loading an old dynasty from before the
      // tutorials existed must not re-teach nine screens to a veteran who has
      // been playing all evening.
      seenTutorials: [...new Set([
        ...get().seenTutorials,
        ...(Array.isArray(loaded.tutorials)
          ? (loaded.tutorials as unknown[]).filter((t): t is string => typeof t === 'string')
          : []),
      ])],
      // Unread stays unread across a restart. It is the one thing the inbox
      // knows that nothing else in the save does.
      inbox: restoreInbox(loaded.inbox),
      // Back to the step the offseason was on, so a reload mid-sequence resumes
      // rather than stranding the player on the dashboard with a week of
      // recruiting budget already spent and nowhere to spend the rest.
      phase: (loaded.phase ?? null) as Phase,
      /**
       * And how far he had got, which is a different fact from where he is.
       *
       * Left at nought, a reload greyed out every step the player had already
       * walked: the rail refuses anything past this number, so a career picked
       * up at recruiting could not look back at its own awards or draft.
       *
       * Falling back to the position of `phase` is the obvious repair and is
       * wrong in a way worth naming. Walking back a step moves `phase` and
       * deliberately leaves this alone, and the inbox — reachable from the top
       * bar at any moment — writes a save when it is read. So a save genuinely
       * can say `coach` while the career had reached recruiting, and deriving
       * from it would hand the draft step permission to run the departures a
       * second time: another class graduated, and any man kept out of the draft
       * paid for and lost. The fallback is therefore only for a save written
       * before this was stored, where no better answer exists.
       */
      furthestPhase: typeof loaded.furthestPhase === 'number'
        ? loaded.furthestPhase
        : Math.max(0, PHASES.indexOf((loaded.phase ?? null) as Exclude<Phase, null>)),
      lastReview: (loaded.review ?? null) as Review | null,
      lastOutcome: (loaded.outcome ?? null) as SeasonOutcome | null,
      version: get().version + 1,
      tab: 'home',
      screen: 'today',
      // Whatever was covering the screen belonged to the dynasty being put
      // down — including the saves menu this was very likely pressed from.
      overlay: null,
      selectedPlayer: null,
      lastOffseason: null,
      // Week recaps are not saved, and a stale one from the previous session
      // would sit over a board it does not describe.
      lastWeek: null,
      /*
        And the game in progress, which belongs to the dynasty being put down.
        The saves menu is reachable mid-game; left set, the old game stayed on
        screen over the new world and RECORD wrote its result into a season it
        was never played against — a finished 45-game season took a 46th game,
        credited to the wrong rosters, and saved it.
      */
      live: null,
      liveMeta: null,
      // A sim that was running belonged to the old world too; the generation
      // bump above makes its result unwelcome, and the flags come home.
      busy: false,
      progress: null,
      // The skill ledger is a fact about a step of the *old* career's offseason.
      spentThisStep: {},
    });
    return true;
  },

  saves: [],
  savesState: 'idle',
  savesError: null,

  refreshSaves: async () => {
    set({ savesState: 'loading' });
    try {
      set({ saves: await listSaves(), savesState: 'ready', savesError: null });
    } catch (e) {
      // Storage refused. The list is empty rather than wrong, and the screen
      // says why — a saves page that silently shows nothing reads as "you have
      // no dynasties", which is the one thing it must never say by accident.
      set({
        saves: [], savesState: 'error',
        savesError: e instanceof Error ? e.message : String(e),
      });
    }
  },

  saveAs: async (name) => {
    if (!get().season) return;
    const typed = name.trim();
    // The key is generated and owes nothing to the text above. See `newSlotId`.
    await get().saveNow(newSlotId(), typed.length > 0 ? typed : undefined);
    await get().refreshSaves();
  },

  deleteSlot: async (slot) => {
    let failure: string | null = null;
    try {
      await deleteSave(slot);
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    }
    await get().refreshSaves();
    // After the refresh, which clears `savesError` on success — a delete that
    // failed used to have its message wiped by the very refresh that followed
    // it, so the row simply stayed and the screen never said why.
    set({ savesError: failure });
  },

  newDynasty: () => {
    // The old world is gone; a sim still in flight for it must not land, and
    // its worker has nothing left to do.
    simGeneration += 1;
    disposeWorker();
    set({
    season: null,
    needsTeam: true,
    busy: false,
    progress: null,
    spentThisStep: {},
    // The career being left takes all of its furniture with it. `start` clears
    // the history and the offers and stops there, which was safe only while the
    // creation screen could be reached from nowhere but a cold boot.
    phase: null,
    furthestPhase: 0,
    bracket: null,
    myBracket: null,
    knockout: null,
    postseasonSeen: [],
    lastPostseason: null,
    live: null,
    liveMeta: null,
    jobSearch: false,
    offers: [],
    lastReview: null,
    lastOutcome: null,
    lastOffseason: null,
    lastWeek: null,
    history: [],
    // Somebody else's post. `start` does not clear it either, and an inbox is
    // exactly the kind of furniture that would follow a player into a new
    // career and tell him his old board was delighted.
    inbox: [],
    overlay: null,
    selectedPlayer: null,
    loadError: null,
    });
  },
}));

/**
 * The record you coach. Null before a dynasty is started.
 */
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
