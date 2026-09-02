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
import type { Hitter, Pitcher, Player, PlayerId, Position, Tactic } from '../engine/types.js';
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
  leagueShape,
  canBeHired,
  approachSchool, APPROACHES_PER_SEASON, CAUGHT_SECURITY_COST, type ApproachOutcome,
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
  applyRealignment, headToHead, realignmentFor,
} from '../engine/world.js';
import type { AlumnusNote } from '../engine/legacy.js';
import {
  annualBudget, freshEconomy, marketFor, poached, remaining, wageBill,
  withStaff, FACILITIES, MAX_FACILITY, SCOUT_COST, SCOUT_DAYS, SEATS,
  SEAT_LABEL, type Assistant, type Economy, type StaffSeat,
} from '../engine/economy.js';
import {
  readJournal, writeJournal, noteAction, clearJournal, journalMatches,
} from './liveJournal.js';
import {
  DEFAULT_DEPTH, normalizeDepth, setMode, setSystem, handles,
  type DepthSettings, type DepthMode, type SystemKey,
} from './depth.js';
import {
  runPostseason, freezeRegularSeason, stageConferenceTournaments,
  stageRegionals, regionalPairing, summarize,
  startSeriesBracket, stepBracket, nextGameFor, resultOf, pairKey, hostOfGame,
  REGIONAL_LENGTHS, SERIES, regionOf, deAsResult, roundName,
  protectedTopFour, CONF_ADVANCE,
  seasonAwards, allConference, coachOfTheYear,
  conferenceField, conferenceIds, conferenceTournament, singleElimination, REGIONS,
  recordSchoolAnnals,
  selectNationalField, seatProtected, splitShowdown, bestOf,
  type SeriesBracket,
  type Finish, type PostseasonSummary, type ConferenceTournament,
  type RegionalSeries, type TournamentResult, type NationalField,
  type NationalResult,
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
  ensureWonderGuy,
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
import type { CultureEdge } from '../data/cultures.js';
import { note, earnedBadges, type HabitKey } from '../engine/habits.js';
import {
  shouldAsk, pickPresser, settlePress, notePress, clearPress,
  type PressState,
} from '../engine/press.js';
import { PRESSERS, type Presser, type PressTrigger, type PressAnswer } from '../data/pressers.js';
import {
  openPortal, makeTheCase as portalCase, releaseFrom, signFromPortal, staffWorksPortal,
  type PortalMan,
} from '../engine/portal.js';
import {
  chartFor, depthAt, reorder, squad, available, promotions, SPOTS, fitTheNine,
} from '../engine/depthChart.js';
import {
  gradesOf, standing, failsThisWeek, suspend, haveAWord, driftGrades,
  WORDS_A_SEASON, atRisk,
} from '../engine/eligibility.js';
import {
  canRedshirt, redshirt, unRedshirt, redshirtCount, MAX_REDSHIRTS,
} from '../engine/redshirt.js';
import { movePosition, settleIn, secondaryPositions } from '../engine/positions.js';
import { healUp, isHurt, prognosis } from '../engine/injury.js';
import { resetWorkload, legWeariness } from '../engine/workload.js';
import {
  settleMood, setMood, squadRanks, mood, moodOf, promiseOf, flightRisk,
} from '../engine/morale.js';
import { captainOf, candidates, roomsChoice, appoint, standDown, canLead } from '../engine/captains.js';
import { MAX_BADGES, badgeOf } from '../data/badges.js';
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
/** The settings screen's four pages, plus the list that leads to them. */
export type SettingsPage = 'index' | 'display' | 'sound' | 'play';

export type Overlay =
  'schedule' | 'standings' | 'rankings' | 'saves' | 'inbox' | 'program' | 'book'
  | 'settings' | 'depth' | 'press' | 'captain' | 'jobs';

/** The three tabs of the program page, which is addressable from the inbox. */
export type ProgramSheet = 'board' | 'money' | 'watchlist' | 'coach' | 'hall';

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
  | 'draft'         // who leaves for professional ball
  | 'portal';       // who leaves for somewhere else

/**
 * The order the offseason runs in.
 *
 * The draft comes *before* recruiting, which is the order that makes the two
 * screens about each other: the holes the draft leaves are the holes you go
 * shopping for. With recruiting first you were signing a class against a roster
 * that had not lost anybody yet, and the draft was a receipt.
 */
/*
  The portal sits between the draft and recruiting, and the order is the point.

  Both of the two before it are men *leaving*: the draft takes the ones a club
  wanted, the portal takes the ones you gave a reason to go. Recruiting comes
  after both because it is where the holes get filled, and a coach who has not
  yet found out who walked out cannot know what he is shopping for.
*/
export const PHASES: readonly Exclude<Phase, null>[] =
  ['awards', 'review', 'coach', 'draft', 'portal', 'recruiting', 'signing'];

/** What each step is called on the rail across the top. */
export const PHASE_LABEL: Record<Exclude<Phase, null>, string> = {
  awards: 'AWARDS',
  review: 'SEASON',
  coach: 'COACH',
  draft: 'DRAFT',
  portal: 'PORTAL',
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
 * exactly where June stood: the field is selected once, the two showdown
 * brackets land when they finish, and the championship series closes it.
 *
 * There used to be a fourth field here, `opening`, holding four best-of-three
 * series that cut the field from twenty to sixteen. It is gone: those eight
 * teams now play their way in *inside* the winners bracket, where losing costs
 * a drop to the losers side rather than a season.
 */
export interface NationalProgress {
  field: NationalField;
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
  | 'conference' | 'regional' | 'national' | 'final';

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
      kind: 'regional' | 'final';
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
  /**
   * Whether June carries on without this tournament.
   *
   * Being knocked out of a tournament and being knocked out of the postseason
   * stopped being the same thing when the format expanded, and the screen went
   * on saying they were. The top four of a conference tournament advance to a
   * regional; a protected top-four seed reaches the national field whatever its
   * regional does. Both were told their season was over.
   *
   * Computed at the moment of elimination, because that is the moment the
   * structure still knows where the team fell.
   */
  advanced: boolean;
  /** Where the conference tournament left you, 1 to 8. Zero when not one. */
  placing?: number;
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

/**
 * A takeover moment — stage 14. The full screen, for the handful of nights
 * that earn it: walk-offs, clinchers and titles, plus the other side of a
 * walk-off, because being walked off is as big as doing it and a game that
 * only celebrates hides half the sport.
 */
export interface BigMoment {
  kind: 'walkoff' | 'walkoff-against' | 'cup' | 'regional' | 'final4'
    | 'title' | 'runner-up';
  /** Whose crest the card wears. */
  team: number;
  /** The man, where one man did it (walk-offs). */
  name?: string;
  /** One factual line under the headline: a score, a league, a series. */
  line: string;
  year: number;
}

/**
 * When two moments land in the same beat — a walk-off that also wins the
 * title — the bigger one takes the screen and the smaller is folded into it,
 * because two takeovers in a row is a slideshow, not a moment.
 */
const MOMENT_RANK: Record<BigMoment['kind'], number> = {
  'walkoff-against': 1, walkoff: 2, cup: 3, regional: 4,
  final4: 5, 'runner-up': 6, title: 7,
};

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

  /*
    The press conference, waiting to happen.

    Stage 7 piece 8. Held as "which question, and why" rather than as a boolean,
    because the card has to print the room's reason and because a save reloaded
    mid-question must come back to the same one -- which it does, since the
    question is derived rather than drawn. See `engine/press.ts`.
  */
  press: PressState;
  pendingPress: { presser: Presser; trigger: PressTrigger } | null;

  /*
    Stage 8. The roster, as something you manage rather than read.

    All four of these act on the user's program and nobody else's -- grades are
    kept for the men you coach, redshirts are declared by a coach, and a
    position is moved by one. Ninety-five programs quietly doing the same thing
    would be a slower roll and a bigger save to model what nobody can see.
  */
  /** Conversations spent this season. Four a year, and they do not carry. */
  wordsUsed: number;
  /** Have a word with him about the classroom. */
  wordWith: (id: PlayerId) => boolean;
  /** Move a man up or down one rung at a position on the chart. */
  moveDepth: (spot: Position, id: PlayerId, delta: number) => void;
  /** Sit him out the year, or change your mind. */
  setRedshirt: (id: PlayerId, on: boolean) => boolean;
  /** Move him to a new position for good. */
  changePosition: (id: PlayerId, to: Position) => boolean;

  /*
    Stage 9. One captain, and a man you can sit down.

    Both act on the coached program only, like everything the coach does. The
    injuries themselves are league-wide -- see `engine/injury.ts` -- because a
    rival losing his ace is a fact about the game you are about to play.
  */
  nameCaptain: (id: PlayerId) => boolean;
  clearCaptain: () => void;
  /** Sit him for a stretch, to take the miles out of his legs. */
  restMan: (id: PlayerId, days: number) => boolean;

  /*
    Stage 10. Both directions, which is the whole specification.

    `leaving` is your own men; `available` is everybody else's. They are held
    apart because they are two different decisions with two different verbs --
    you talk one lot round and you sign the other -- and folding them into one
    list was the first thing that made the screen unreadable.
  */
  portal: { leaving: PortalMan[]; available: PortalMan[]; spent: number } | null;
  /** Talk a man out of it, out of the same pool everything else spends. */
  keepFromPortal: (id: PlayerId, offer: number) => boolean;
  /** Sign somebody else's. */
  takeFromPortal: (id: PlayerId) => boolean;
  /** Say it, take what it costs, and close the room. */
  answerPress: (answer: PressAnswer) => void;
  /** Walk out without answering. Costs nothing; the question is spent. */
  duckPress: () => void;

  /**
   * Begin a dynasty. Pass a team index to choose the job, and the profile the
   * creation step collected. Without the profile the career belongs to a man
   * called "Coach", which is the pre-v0.6.3 behaviour and what the tests use.
   */
  start: (
    seed?: number, team?: number, profile?: CoachProfile, mode?: DepthMode,
    /** What five answers made of him. See `engine/interviewResult.ts`. */
    made?: { skills: CoachSkills; badges: string[]; leans: Partial<Record<CultureEdge, number>> },
  ) => void;
  /** True before a job has been taken, so the app can show the setup screen. */
  needsTeam: boolean;
  go: (tab: Tab, screen?: string, focus?: string) => void;

  /**
   * A man the screen you are about to land on should point at.
   *
   * Reported: tapping a hurt man's card in NEEDS YOU dropped you on the lineup
   * with no indication of which of twenty-three names the card had been about —
   * the errand was handed over and the answer to "which one" was left behind.
   *
   * Deliberately transient. It is not persisted, it is not part of the save,
   * and the screen that honours it clears it on the way out, because a mark
   * that survives being looked at is a mark nobody trusts the second time.
   */
  focusPlayer: string | null;
  clearFocusPlayer: () => void;
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
  /**
   * The national stage's own sub-steps: field, opening, showdown, final.
   *
   * `advance` is a press rather than an arrival — see the note inside. A step
   * you are only watching resolves on a press and never behind your back.
   */
  openNationalStep: (advance?: boolean) => void;
  /** The half of the showdown you are not in, played alongside yours. */
  sideShow: { half: 'A' | 'B'; state: DoubleElim } | null;
  /** One night of it, filed into the results when it finishes. */
  stepSideShow: () => void;
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
  manageBracketGame: () => Promise<void>;
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
  simBracket: (mode: 'game' | 'round' | 'mine' | 'rest') => void;
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
  /** The takeover on screen, if one is owed. Transient, like `live`. */
  bigMoment: BigMoment | null;
  /** Offer a moment; a bigger one already showing keeps the screen. */
  offerBigMoment: (m: BigMoment) => void;
  clearBigMoment: () => void;

  live: LiveGame | null;
  liveMeta: {
    home: number; away: number; day: number; conference: boolean;
    /** A bracket game. There is no day to advance and no standings day to hold. */
    postseason?: boolean;
  } | null;
  startManagedGame: () => Promise<void>;
  /**
   * A game a phone call interrupted, waiting to be picked up.
   *
   * Set on load when a journal matches the save. Null the rest of the time.
   */
  pendingGame: { home: number; away: number; line: string } | null;
  /** Rebuild it and hand it back, or rebuild it and let the bench coach finish. */
  resumeGame: (take: boolean) => Promise<void>;
  submitTactic: (t: Tactic) => void;
  pinchHitFor: (h: Hitter) => void;
  bringIn: (p: Pitcher) => void;
  /** Go and talk to him. Once per pitcher per outing, confidence only. */
  visitMound: () => void;
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
  /**
   * Programmes approached this season, and the ones that bit.
   *
   * `tried` is cleared at the year roll and holds team indices, so the three-a-
   * season limit and the never-the-same-school rule are one list rather than
   * two counters. `interest` is *not* cleared: a school that would take your
   * call keeps that opinion until the carousel, which is the only place it can
   * become an offer.
   */
  approaches: { tried: number[]; interest: number[] };
  /**
   * Badges earned at the last board meeting, waiting to be announced.
   *
   * Cleared once the card has been shown. Held in the store rather than derived
   * because "what is new" is a fact about a moment, and by the time a screen
   * renders, the badge is simply on the card like all the others.
   */
  newBadges: string[];
  clearNewBadges: () => void;
  /** Put a feeler out. Returns what happened, for the screen to say. */
  approach: (team: number) => ApproachOutcome | 'spent' | 'already' | 'no';
  /** Record something the coach did. See `engine/habits.ts`. */
  noteHabit: (key: HabitKey, n?: number) => void;
  openOverlay: (o: Overlay) => void;
  closeOverlay: () => void;
  /**
   * Which page of settings is open.
   *
   * Up here rather than inside the component because the *overlay's* back bar
   * has to know about it. Reported plainly: opening a settings page and
   * pressing back left the whole screen rather than returning to the list,
   * because the prominent back control belongs to the overlay and the overlay
   * had no idea its child had pages. A component cannot own state that the
   * frame around it needs to read.
   */
  settingsPage: SettingsPage;
  setSettingsPage: (p: SettingsPage) => void;
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
  /**
   * Put a bench man into a batting slot; the man there goes to the bench.
   *
   * THE fix behind "he didn't appear in the lineup to be selected since he is
   * on the bench, and we should be able to pick whoever we want to start."
   * `team.lineup` is the nine the engine actually fields — the depth chart
   * never was — so the swap writes there and nowhere else. Returns false when
   * the incoming man cannot play today.
   */
  swapStarter: (slot: number, benchId: PlayerId) => boolean;
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
  /**
   * The programs and career paths you follow, by school abbreviation.
   *
   * The mockup's Program Actions, wired: TRACK PROGRAM files a school under
   * the program tab's watchlist; TRACK JOB PATH marks its chair as one your
   * career is pointed at, and the job market stars it when it calls. Career
   * state, not season state — it rides the save and survives the year roll.
   */
  watch: { programs: string[]; jobs: string[] };
  toggleProgramWatch: (abbr: string) => void;
  toggleJobWatch: (abbr: string) => void;

  /**
   * The program's money and what it pays for — stage 11.
   *
   * One annual budget in $k derived from prestige, and three claims on it:
   * the staff's wages, the facilities, the scouting desk. Sparse by the house
   * rule: a save from before the stage has empty seats, level-0 facilities and
   * a clean ledger. See engine/economy.ts for every number.
   */
  economy: Economy;
  /**
   * The rivalry, counted for the whole career — stage 12. Your record against
   * the school the data has always named your rival, across every season on
   * this save. The Today card prints it the week the fixture comes round.
   */
  rivalry: { w: number; l: number };
  /**
   * The men you coached who left, one durable note each — stage 13. The pro
   * career itself is derived from the note whenever a card asks, so ten years
   * of a first-rounder's summers cost the save one row. Career-wide, not
   * program-wide: they are the men YOU coached, wherever you coach now.
   */
  alumni: Record<string, AlumnusNote>;
  /** Hire from this offseason's derived market. Seat must be empty. */
  hireAssistant: (seat: StaffSeat, slot: number) => void;
  /** Let him go. No severance — the wage simply stops next roll. */
  fireAssistant: (seat: StaffSeat) => void;
  /** One rung up, paid once, forever. */
  upgradeFacilities: () => void;
  /** Buy the book on one opponent, good for the next stretch of days. */
  scoutTeam: (team: number) => void;
  markTutorialSeen: (id: string) => void;
  /** Forget every tutorial, so the next visit to each screen teaches again. */
  resetTutorials: () => void;

  /**
   * How deep a game this career is. See `depth.ts` for the three rules that
   * keep this from becoming two games in one codebase — the first of which is
   * that none of it ever reaches the engine.
   */
  depth: DepthSettings;
  setDepthMode: (mode: DepthMode) => void;
  setDepthSystem: (key: SystemKey, value: boolean) => void;

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
  national: ['national', 'final'],
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
    && (m.kind === 'regional' || m.kind === 'final')) {
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

/**
 * The other half of the showdown, flattened for the disk and back.
 *
 * Same treatment as your own tournament: the season reference is stripped on
 * the way out and put back on the way in, and anything that does not arrive
 * whole is refused rather than half-restored — `openNationalStep` will simply
 * resolve that bracket instead.
 */
type StoredSideShow = { half: 'A' | 'B'; state: Omit<DoubleElim, 'season'> };

function portableSideShow(
  side: { half: 'A' | 'B'; state: DoubleElim } | null,
): StoredSideShow | null {
  if (!side) return null;
  const { season, ...state } = side.state;
  void season;
  return { half: side.half, state };
}

function usableSideShow(
  saved: unknown, season: SeasonState, bracket: PostseasonProgress | null,
): { half: 'A' | 'B'; state: DoubleElim } | null {
  if (!saved || typeof saved !== 'object' || !bracket) return null;
  if (bracket.stage !== 'national') return null;
  const s = saved as Partial<StoredSideShow>;
  if (s.half !== 'A' && s.half !== 'B') return null;
  const st = s.state as Partial<DoubleElim> | undefined;
  if (!st || !Array.isArray(st.winners) || !Array.isArray(st.seeds)) return null;
  if (st.done) return null;
  if (!(st.appearances instanceof Map) || !(st.seedOf instanceof Map)
    || !(st.losses instanceof Map)) return null;
  return { half: s.half, state: { ...(st as Omit<DoubleElim, 'season'>), season } };
}

/**
 * The interrupted game, if this save is still waiting on one.
 *
 * Returns the offer rather than the game: rebuilding costs a replay of the
 * whole thing, and there is no reason to pay it for a player who is going to
 * say no. The line is written here because this is where both teams are in
 * hand.
 */
function pendingFromJournal(
  season: SeasonState, year: number,
): { home: number; away: number; line: string } | null {
  const j = readJournal();
  if (!j) return null;
  if (!journalMatches(j, 'auto', year, season.rng.state?.() ?? -1)) {
    clearJournal();
    return null;
  }
  const home = season.teams[j.home];
  const away = season.teams[j.away];
  if (!home || !away) { clearJournal(); return null; }
  return {
    home: j.home,
    away: j.away,
    line: `${away.def.school} at ${home.def.school}`,
  };
}

/** The economy, from whatever an older save carries. Sparse: absent is fresh. */
function usableEconomy(saved: unknown): Economy {
  const fresh = freshEconomy();
  if (!saved || typeof saved !== 'object') return fresh;
  const e = saved as Partial<Economy>;
  const seatOk = (a: unknown): a is Assistant => {
    if (!a || typeof a !== 'object') return false;
    const m = a as Partial<Assistant>;
    return typeof m.id === 'string' && typeof m.name === 'string'
      && typeof m.rating === 'number' && typeof m.wage === 'number';
  };
  const staff: Economy['staff'] = {};
  for (const seat of SEATS) {
    const man = (e.staff as Record<string, unknown> | undefined)?.[seat];
    if (seatOk(man)) staff[seat] = man;
  }
  return {
    facilities: Number.isInteger(e.facilities)
      ? Math.max(0, Math.min(MAX_FACILITY, e.facilities as number)) : 0,
    staff,
    spent: typeof e.spent === 'number' && e.spent >= 0 ? e.spent : 0,
    scouted: e.scouted && typeof e.scouted === 'object'
      ? Object.fromEntries(Object.entries(e.scouted)
          .filter(([, v]) => typeof v === 'number')) as Record<number, number>
      : {},
  };
}

/** The alumni book, from whatever an older save carries. */
function usableAlumni(saved: unknown): Record<string, AlumnusNote> {
  if (!saved || typeof saved !== 'object') return {};
  const out: Record<string, AlumnusNote> = {};
  for (const [id, v] of Object.entries(saved as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const n = v as Partial<AlumnusNote>;
    if (typeof n.name === 'string' && typeof n.year === 'number'
      && typeof n.overall === 'number'
      && (n.reason === 'drafted' || n.reason === 'graduated' || n.reason === 'walk-on')) {
      out[id] = n as AlumnusNote;
    }
  }
  return out;
}

/** The rivalry ledger, from whatever an older save carries. */
function usableRivalry(saved: unknown): { w: number; l: number } {
  const r = (saved ?? {}) as Partial<{ w: unknown; l: unknown }>;
  return {
    w: typeof r.w === 'number' && r.w >= 0 ? r.w : 0,
    l: typeof r.l === 'number' && r.l >= 0 ? r.l : 0,
  };
}

/** The watchlists, from whatever an older save carries. */
function usableWatch(saved: unknown): { programs: string[]; jobs: string[] } {
  const w = (saved ?? {}) as Partial<{ programs: unknown; jobs: unknown }>;
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return { programs: list(w.programs), jobs: list(w.jobs) };
}

/** A saved elimination, refused unless it belongs to the year being loaded. */
function usableKnockout(saved: unknown, year: number): Knockout | null {
  if (!saved || typeof saved !== 'object') return null;
  const k = saved as Partial<Knockout>;
  if (k.year !== year) return null;
  const kinds: MyBracketKind[] = ['conference', 'regional', 'national', 'final'];
  if (!k.kind || !kinds.includes(k.kind)) return null;
  if (typeof k.label !== 'string') return null;
  // `advanced` and `placing` arrived with A13. A save written before them
  // resumes as an ending, which is what it was told at the time.
  return {
    year, kind: k.kind, label: k.label,
    advanced: k.advanced === true,
    ...(typeof k.placing === 'number' ? { placing: k.placing } : {}),
  };
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
 * Your bench coach fills out the card.
 *
 * The whole of what "casual handles lineups" means, and it is deliberately the
 * same call the LINEUP screen's AUTO button makes — a casual coach's card is
 * not a worse card or a different kind of card, it is the one the game would
 * have suggested to him. Nothing here touches the simulation: the nine names
 * are a decision, made before the first pitch, exactly as the other ninety-five
 * programs have always had theirs made.
 *
 * Silent by design. The answer to "how does casual tell you what it decided?"
 * is that it does not, unless you go and look — and the card is right there on
 * the LINEUP screen, correct and current, whenever you do.
 */
function staffSetsTheCard(season: SeasonState, userTeam: number): void {
  const team = season.teams[userTeam]?.team;
  if (!team) return;
  // The staff bench the unfit too — a casual career was the one place
  // nobody was ever told and nobody ever moved.
  const fit = fitTheNine(team, season.dayIndex);
  team.lineup.splice(0, team.lineup.length, ...fit.lineup);
  team.bench.splice(0, team.bench.length, ...fit.bench);
  const dealt = autoBattingOrder(team.lineup);
  // Same nine or nothing, the same guard `autoLineup` holds at its own door.
  if (dealt.length !== team.lineup.length) return;
  team.lineup.splice(0, team.lineup.length, ...dealt);
}

/**
 * Stamp the user coach's offense and defense skills onto his own program's
 * record — and off everybody else's, so a job change or an old save can never
 * leave the edge behind on a team he no longer runs. `playGame` and the managed
 * game read it from there, which is how those two skills reach the field.
 */
function applyCoachMods(
  season: SeasonState, userTeam: number, coach: CoachState,
  staff: Economy['staff'] = {},
): void {
  // Every chair, not just yours. It used to clear the field and write one row,
  // which was right when the other ninety five benches were nobody's — now each
  // of them has a man with an OFFENSE and a DEFENSE of his own, and the pass
  // that forgets to write them is the pass that hands the user the only bench
  // edge in the country.
  //
  // The user's row carries his staff as well — stage 11. An assistant is a
  // bonus on the calibrated skills, applied here so every path that dresses
  // the mods prices him the same way.
  syncCoachMods(season, userTeam, withStaff(coach.skills, staff));
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

/*
  What the season just did that is worth being asked about.

  Every trigger here is a fact the season already produced -- a streak it
  already counts, a result it already recorded, a bracket it already settled.
  Nothing is measured specially to feed the press, which is the rule that keeps
  a press conference a consequence rather than a scheduled event.

  Returns the first thing worth asking about, most important first: a season
  ending outranks a trophy outranks a run outranks one night's result.
*/
function pressTriggerFor(store: DynastyStore): PressTrigger | null {
  const { season, userTeam, coach } = store;
  const me = season?.teams[userTeam];
  if (!season || !me) return null;

  // The letter got out. Once, and only while it is still news.
  if (coach.caughtLooking) return 'caughtLooking';

  const post = store.lastPostseason;
  if (post) {
    if (post.champion === userTeam
      || post.regionChampions.includes(userTeam)
      || post.conferenceChampions.includes(userTeam)) return 'trophy';
    return 'knockedOut';
  }

  // A run, which the board and the room both notice at different lengths.
  if (me.streak <= -4) return 'losingStreak';
  if (me.streak >= 6) return 'winningStreak';

  /*
    One night against the odds, in either direction.

    Read off prestige rather than off the RPI table, because the table moves all
    year and the question is about who those two programs *are*. Twenty points
    is roughly two stars, which is the gap where a result stops being a result
    and starts being a story.
  */
  const last = season.results[season.results.length - 1];
  if (last && (last.home === userTeam || last.away === userTeam)) {
    const iAmHome = last.home === userTeam;
    const themIndex = iAmHome ? last.away : last.home;
    const them = season.teams[themIndex];
    if (them) {
      const iWon = iAmHome ? last.homeRuns > last.awayRuns : last.awayRuns > last.homeRuns;
      const gap = them.prestige - me.prestige;
      if (iWon && gap >= 20) return 'bigWin';
      if (!iWon && gap <= -20) return 'badLoss';
    }
  }
  return null;
}

/**
 * The one worth raising, if the season has earned it and the coach is not sick
 * of them yet.
 *
 * Returns it rather than writing it. The first version assigned straight onto
 * the store the way `seasonNews` appends to the inbox, which reads naturally
 * and does nothing: a plain field assignment is not a `set`, so the question
 * existed in state and no screen ever heard about it.
 */
function pressToRaise(store: DynastyStore): { presser: Presser; trigger: PressTrigger } | null {
  if (store.pendingPress) return null;
  /*
    What this coach has said he wants to be asked.

    `depth.ts` has carried a `pressers` key since the mode was designed --
    "your sports information director speaks for you" -- and piece 8 shipped
    without consulting it, which is the one rule the depth mode is not allowed
    to break in either direction. The engine still models everything: the
    season raises exactly the same triggers, and a casual career simply is not
    stopped to answer for them.
  */
  if (!handles(store.depth, 'pressers')) return null;
  const { season, userTeam } = store;
  const me = season?.teams[userTeam];
  if (!season || !me) return null;
  const trigger = pressTriggerFor(store);
  if (!trigger) return null;
  if (!shouldAsk(store.press, { trigger, gamesPlayed: me.gp })) return null;
  /*
    Mixed with the man's own name, so a second dynasty is not asked the same
    questions in the same order as the first.

    `WORLD_SEED` alone is what `earnedBadges` uses and it is the same number in
    every career, which is fine for a threshold nobody sees and wrong for a
    question the player reads. Cheap, derived, and it takes no draw.
  */
  let careerish = WORLD_SEED >>> 0;
  for (let i = 0; i < store.coach.name.length; i++) {
    careerish = Math.imul(careerish ^ store.coach.name.charCodeAt(i), 16777619) >>> 0;
  }
  const presser = pickPresser(trigger, store.press, careerish, store.year);
  if (!presser) return null;
  return { presser, trigger };
}

/*
  The classroom's news, read off what the season already did.

  The check itself moved into the engine's day loop -- see `simNextDay`. It had
  to: this ran from the store's news hook, which fires once after a whole season
  has been simulated, so SIM SEASON checked a single week after every game had
  been played and the feature did nothing on the path most players use. The
  worker path could not have called back here at all.

  So the engine suspends and writes down who and when; this reads the list and
  posts one card each. Keyed on the man and the day, so a season simmed in one
  press and a season played out a day at a time produce the same cards, and
  neither posts the same one twice.
*/
function classroomNews(store: DynastyStore): void {
  const { season, year } = store;
  for (const row of season?.classroom ?? []) {
    store.post({
      kind: 'season', year,
      key: `grades-${row.id}-${row.day}`,
      title: `${row.name} is ineligible`,
      body: 'He is short of where he needs to be in the classroom and misses '
        + 'the week. Whoever is next on the depth chart plays.',
      link: { to: 'player', id: row.id },
    });
  }
}

/*
  The trainer's room, read off what the season already did.

  Same shape and same reason as `classroomNews`: the engine writes down who
  went and when, so a season simulated in one press still owes the coach the
  news. Keyed on the man and the day, so it cannot post twice.
*/
function trainerNews(store: DynastyStore): void {
  const { season, year } = store;
  for (const row of season?.trainer ?? []) {
    store.post({
      kind: 'season', year,
      key: `hurt-${row.id}-${row.day}`,
      title: `${row.name} is hurt`,
      body: `${row.what.charAt(0).toUpperCase()}${row.what.slice(1)}. `
        + `${row.days >= 150 ? 'He is done for the season.' : `About ${row.days} days.`} `
        + (handles(store.depth, 'lineups') || handles(store.depth, 'depthChart')
          ? 'Nobody is moved for you — choose his cover on the chart.'
          : 'The next man on the depth chart plays.'),
      link: { to: 'player', id: row.id },
    });
  }
}

/*
  The other end of the trainer's table.

  Reported: "when the player heals we should be prompted with a card that lets
  us know the player is back and can go back to the lineup." Scanned off the
  men rather than the trainer log so the fit day is exactly the day
  `available` starts saying yes; keyed on the man and that day, so a week of
  calls posts one card. Arms included — a rotation piece coming back is news
  by the same rule.
*/
function recoveryNews(store: DynastyStore): void {
  const { season, userTeam, year } = store;
  const me = season?.teams[userTeam];
  if (!season || !me) return;
  const day = season.dayIndex;
  const men = [...squad(me.team), ...me.team.rotation, ...me.team.bullpen];
  for (const man of men) {
    const u = man as typeof man & { outUntil?: number; why?: string };
    if (u.why !== 'injury' || u.outUntil === undefined) continue;
    if (day < u.outUntil || day - u.outUntil > 6) continue;
    store.post({
      kind: 'season', year,
      key: `healed-${man.id}-${u.outUntil}`,
      title: `${man.name} is fit again`,
      body: 'The trainer has cleared him. He does not walk back into the nine '
        + 'on his own — open the chart and put him where you want him.',
      link: { to: 'player', id: man.id },
    });
  }
}

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

/**
 * The open question, back from a save.
 *
 * By id, so a rewritten pool does not strand a career on a sentence that no
 * longer exists -- an unknown id simply comes back as no question pending,
 * which costs the player one presser and nothing else.
 */
function restorePending(raw: unknown): { presser: Presser; trigger: PressTrigger } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { id, trigger } = raw as { id?: unknown; trigger?: unknown };
  if (typeof id !== 'string' || typeof trigger !== 'string') return null;
  const presser = PRESSERS.find((p) => p.id === id);
  return presser ? { presser, trigger: trigger as PressTrigger } : null;
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
  lastWeek: null,
  phase: null,

  start: (seed = WORLD_SEED, team?: number, profile?: CoachProfile, mode: DepthMode = 'full', made?: { skills: CoachSkills; badges: string[]; leans: Partial<Record<CultureEdge, number>> }) => {
    const season = createSeason(makeRng(seed), undefined, CONFERENCES);
    // Whose games to keep box scores for. A season is built before anybody has
    // taken a job, so the engine cannot know this on its own.
    season.captureBoxFor = team ?? defaultUserTeam(season);
    // And what year it is, which the engine has no other way of knowing and the
    // record book cannot do without — a mark with no year against it is a rumour.
    season.year = START_YEAR;
    const seat = team ?? defaultUserTeam(season);
    const here = season.teams[seat]?.prestige ?? 50;
    /*
      The man who walks in, rather than the default one.

      `newCoach` builds the coach this game has always built -- twenty in every
      skill, no badges, no leanings -- and the interview is applied on top. That
      ordering matters: a career started without answering anything is exactly
      the career it used to be, so the questions are an addition to creation
      rather than a rewrite of it, and every save that predates them still
      loads as the coach it was written with.
    */
    const fresh = newCoach(profile, contractFor(here));
    const coach = takeChair(
      made
        ? { ...fresh, skills: made.skills, badges: made.badges, leans: made.leans }
        : fresh,
      here,
    );
    // The other ninety five get their men before the first pitch, seeded at what
    // their programs are worth. Without it the entire hiring ladder would be
    // open to whoever won a game first — you included.
    seatCoaches(season, seat, START_YEAR);
    applyCoachMods(season, seat, coach, get().economy.staff);
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
      // A new career starts with the school's bare gift: empty seats, level-0
      // facilities, a clean ledger. Explicit for the same reason as the inbox
      // below — a second dynasty must not inherit the first one's staff.
      economy: freshEconomy(),
      rivalry: { w: 0, l: 0 },
      alumni: {},
      watch: { programs: [], jobs: [] },
      inbox: [],
      // Set explicitly rather than left alone, because a second dynasty started
      // on the same device would otherwise silently inherit the first one's
      // answer. The question is asked at creation; this is where the answer
      // lands, and every override starts empty because nothing has been
      // disagreed with yet.
      depth: { mode, overrides: {} },
    });
    // Whichever card the staff would write, written before the first day rather
    // than after it, so a casual coach's opening lineup is his coach's lineup.
    if (!handles({ mode, overrides: {} }, 'lineups')) staffSetsTheCard(season, seat);
    void get().saveNow();
  },

  go: (tab, screen, focus) => {
    const def = TABS.find((t) => t.id === tab);
    set({
      tab,
      screen: screen ?? def?.screens[0]?.id ?? 'today',
      selectedPlayer: null,
      focusPlayer: focus ?? null,
    });
  },

  clearFocusPlayer: () => set({ focusPlayer: null }),

  // Navigating any other way drops the mark: it belongs to the errand that set
  // it, and an errand you walked away from is over.
  setScreen: (screen) => set({ selectedPlayer: null, focusPlayer: null, screen }),

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

    const effSkills = withStaff(coach.skills, get().economy.staff);
    const myDevPitch = FACILITIES[get().economy.facilities]?.devPitch ?? 0;
    for (const record of season.teams) {
      const mine = record.index === userTeam;
      // Your facilities are part of your pitch: a development lab is the one
      // thing on the tour a recruit's father asks about.
      const pitch = pitchFor(
        season, record, regionOf(record.index),
        Math.min(1, developmentScore(record) + (mine ? myDevPitch : 0)),
      );

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
          // The coordinator's whole job: every hour on a recruit counts for
          // more. Stacked through the same skill the points already price.
          mine ? effSkills.recruiting : (staff?.skills.recruiting ?? 20),
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
      // A man who was leaving and did not. The persuader badge is watching for
      // exactly this, and it is the one habit that rewards engaging with a
      // screen rather than optimising a number.
      get().noteHabit('talkedDown');
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
    /*
      The portal opens once, when the step is first reached.

      Guarded on `furthestPhase` for the reason the recruiting seeding is: the
      rail lets a coach walk back to the draft and come forward again, and
      opening it twice would put every man in the country in it twice and let
      the same signing be made from two pools.

      In casual the staff works it and the screen never appears -- the men still
      leave, the pool still exists, and somebody competent still shops it, which
      is the depth mode's rule exactly.
    */
    if (next === 'portal' && get().furthestPhase < PHASES.indexOf('portal')) {
      const rec = season.teams[get().userTeam];
      const games = (rec?.w ?? 0) + (rec?.l ?? 0);
      const pool = openPortal(season.teams, {
        year: get().year, seed: season.seed ?? 0, games,
      });
      const mine = pool.filter((m) => m.from === get().userTeam);
      const theirs = pool
        .filter((m) => m.from !== get().userTeam)
        .sort((a, b) => overallOf(b.player) - overallOf(a.player));

      if (rec && !handles(get().depth, 'portal')) {
        // Your staff, out of sight. It still costs the same budget, so a
        // casual career is not quietly richer than a full one.
        const budget = windowBudget(prestigeStars(rec.prestige));
        const took = staffWorksPortal(rec.team, theirs, budget);
        for (const m of took) {
          const from = season.teams[m.from];
          if (from) releaseFrom(from.team, m.player.id);
        }
        set({ portal: { leaving: mine, available: [], spent: 0 } });
      } else {
        set({ portal: { leaving: mine, available: theirs, spent: 0 } });
      }
    }

    if (next === 'recruiting') {
      /*
        Everybody still in the portal has gone.

        The same rule the draft board keeps one step earlier: doing nothing has
        to *mean* something, or a coach could leave a man hanging in a list
        nobody comes back to and keep him by accident.
      */
      const rec = season.teams[get().userTeam];
      for (const m of get().portal?.leaving ?? []) {
        if (rec) releaseFrom(rec.team, m.player.id);
      }

      /*
        And the other ninety-five shop it, which is the half that makes this a
        portal rather than a tax.

        Without this every man who entered simply evaporated: off the roster he
        left, onto nobody's, out of the league. That is wrong twice over -- the
        pool a coach signs from should be other programs' broken promises, and a
        man still playing college baseball somewhere must not turn up eligible
        for a hall of fame two steps later.

        Cheapest-first and at most two apiece, so one rich program cannot hoover
        the whole board. Whoever is left over has genuinely left college
        baseball, which is a real thing that happens to transfers.
      */
      const stillOut = [
        ...(get().portal?.available ?? []),
        ...(get().portal?.leaving ?? []),
      ];
      if (stillOut.length > 0) {
        const taken = new Set<PlayerId>();
        for (const other of season.teams) {
          if (other.index === get().userTeam) continue;
          const going = stillOut.filter((m) => !taken.has(m.player.id) && m.from !== other.index);
          if (going.length === 0) break;
          const budget = windowBudget(prestigeStars(other.prestige));
          for (const m of staffWorksPortal(other.team, going, budget)) {
            taken.add(m.player.id);
            const from = season.teams[m.from];
            if (from) releaseFrom(from.team, m.player.id);
          }
        }
      }

      set({ portal: null });
    }

    /*
      The draft settles when the draft step ends, which since stage 10 is one
      boundary earlier than recruiting.

      Moved rather than left where it was. A man sitting 'pending' on the board
      while the coach works the portal is a decision the game is pretending is
      still open, and the hall of fame two lines down is explicitly "when the
      draft settles" -- both belong to leaving the draft, not to leaving the
      step after it.
    */
    if (next === 'portal') {
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
      /*
        A man you talked out of the draft is not a man whose career is over.

        Reported: "the player that got inducted was brought back from the draft,
        so he shouldn't be in the hall -- only players that are no longer in the
        league." `activeIds` reads the rosters, which is the right definition
        and the wrong moment to rely on alone: it is one `reinstate` away from
        being true, and this ballot runs on the very step where that happens.

        The board itself knows the answer without inferring it. An outcome of
        'stayed' *is* the statement that he is still playing here, so it is read
        directly rather than trusted to have already been reflected on a roster.
      */
      const staying = new Set(
        (season.draft?.men ?? [])
          .filter((m) => m.outcome === 'stayed')
          .map((m) => String(m.player.id)),
      );
      const going = inductees({
        careers: season.careers ?? {},
        active: new Set([...activeIds(season.teams), ...staying]),
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
          // The facilities are the training staff's tools. A level-3 lab is
          // worth nine points of the skill — see engine/economy.ts.
          training: get().coach.skills.training
            + (FACILITIES[get().economy.facilities]?.trainBump ?? 0),
        });
        /*
          The alumni book — stage 13. One durable note per man who left YOUR
          program, written the June he leaves, because the departure notice
          itself survives one offseason and the pro career needs his round and
          his rating for ever.
        */
        const notes = { ...get().alumni };
        const myAbbr = season.teams[get().userTeam]?.def.abbr;
        for (const d of [...report.drafted, ...report.graduated]) {
          if (d.teamAbbr !== myAbbr) continue;
          notes[d.id] = {
            name: d.name, teamAbbr: d.teamAbbr, year: get().year,
            reason: d.reason === 'drafted' ? 'drafted'
              : d.reason === 'walk-on' ? 'walk-on' : 'graduated',
            ...(d.round !== undefined ? { round: d.round } : {}),
            overall: d.overall, classYear: d.classYear,
          };
        }
        set({ lastOffseason: report, alumni: notes });

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
    if (season) applyCoachMods(season, userTeam, next, get().economy.staff);
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
    if (season) applyCoachMods(season, userTeam, next, get().economy.staff);
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
    // A casual coach's card is filled out before the day is played, not after,
    // or the nine names the game used would be yesterday's.
    if (!handles(get().depth, 'lineups')) staffSetsTheCard(season, get().userTeam);
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
      // Played one, whatever came of it. Everything from the regional round
      // onward writes a finish string, and only a program that stayed home has
      // none — so this is "was in the field" rather than a list of outcomes to
      // keep in step with the bracket.
      madeRegionals: post ? post.finish[me.index] !== undefined : false,
      reachedOmaha: ['omaha', 'runner-up', 'champion'].includes(post?.finish[me.index] ?? ''),
      wonTitle: post?.champion === me.index,
    };

    // The drought. Same rule as the other ninety five — see `runRivalYear`.
    me.drought = outcome.madeRegionals ? 0 : (me.drought ?? 0) + 1;
    outcome.drought = me.drought;

    /*
      Judged against the country as it is now, like everybody else. See
      `playerBoard` — the drift correction every rival board gets was never
      handed to the player's, and thirty seasons of league inflation landed
      on him alone.
    */
    const review = reviewSeason(
      coach, me.prestige, rosterStrength(me.team), outcome, seasonLength(season.config),
      playerBoard(
        me.prestige, rosterStrength(me.team), seasonLength(season.config),
        me.culture?.patience, leagueShape(season.teams),
      ),
    );

    // Prestige belongs to the school and survives a coaching change.
    me.prestige = review.prestigeAfter;

    /*
      The four habits a season answers rather than a moment.

      Everything else is counted where it happens -- a mound visit at the mound,
      a steal at the steal. These four are properties of a whole year and there
      is no earlier point at which the question can be asked.

      Read off state that already exists rather than tracked as they occur:
      the results are all in `season.results`, the roster is standing right
      here, and a counter incremented in six places is a counter that will
      eventually be forgotten in a seventh.
    */
    {
      const games = season.results.filter(
        (g) => g.home === userTeam || g.away === userTeam,
      );
      // rpiOrder hands back rows, not indices, so the ladder is read off the
      // team each row carries.
      const rank = rpiOrder(season).map((r) => r.team.index);
      const myRank = rank.indexOf(userTeam);

      let comebacks = 0;
      let roadUpsets = 0;
      for (const g of games) {
        const mine = g.home === userTeam;
        const them = mine ? g.away : g.home;
        const my = mine ? g.homeRuns : g.awayRuns;
        const their = mine ? g.awayRuns : g.homeRuns;
        if (my <= their) continue;
        // Won on the road against somebody the country rates above you.
        if (!mine && myRank >= 0 && rank.indexOf(them) >= 0
          && rank.indexOf(them) < myRank) roadUpsets += 1;
        // A one-run win is the closest thing to a comeback the stored result
        // can testify to: the box score keeps the line, not the lead changes.
        if (my - their === 1) comebacks += 1;
      }

      const roster = [
        ...me.team.lineup, ...me.team.bench, ...me.team.rotation, ...me.team.bullpen,
      ];
      const freshmen = roster.filter((p) => p.classYear === 'FR').length;
      const walkOns = roster.filter((p) => p.walkOn).length;

      let habits = coach.habits ?? {};
      habits = note(habits, 'comebacks', comebacks);
      habits = note(habits, 'roadUpsets', roadUpsets);
      habits = note(habits, 'freshmen', freshmen);
      habits = note(habits, 'walkOns', walkOns);
      if (review.verdict === 'exceeded') habits = note(habits, 'overachieved');
      coach.habits = habits;
    }

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
    syncCoachMods(season, userTeam, withStaff(coach.skills, get().economy.staff));

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

    /*
      What the year made him, checked at the one moment a career pauses.

      Not checked as the counters move: a badge arriving in the fourth inning of
      a Tuesday would interrupt a game to tell somebody about a habit, and the
      board meeting is where a career is already being summed up.

      The cap is applied here rather than in `earnedBadges`, because a man whose
      card is full has still earned the sixth and the wire should still say so --
      the badge simply does not go on.
    */
    const fresh = earnedBadges(coach.habits ?? {}, coach.badges ?? [], WORLD_SEED);
    const badges = fresh.length > 0
      ? [...(coach.badges ?? []), ...fresh].slice(0, MAX_BADGES)
      : coach.badges;

    set({
      lastReview: review,
      lastOutcome: outcome,
      newBadges: fresh,
      history: record ? [...get().history, record] : get().history,
      coach: {
        ...coach,
        ...(badges ? { badges } : {}),
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
    // See pendingGame in the reset below: last year's interrupted game cannot
    // be resumed against next year's season, so the journal dies with the year.
    clearJournal();

    /*
      The inbox turns over with the year — reported: "we need to clean the
      inbox every time a season is over." Wiped here, before the winter is
      posted, so realignment, poaching and the carousel open the new year's
      mail on a clean desk instead of under last season's pile.
    */
    set({ inbox: [] });

    /*
      The staff's winter — stage 11.

      Poaching is derived from the man and the year (a reload cannot keep
      him), and it is what being good costs: your 75-rated coordinator is
      somebody's next head coach. The inbox says so by name. Then, for a
      career that asked its athletic director to run the staff, the AD fills
      whatever is empty with the best man the new market prices under what is
      left — the same market a full coach reads himself.
    */
    const eco0 = get().economy;
    const keptStaff: typeof eco0.staff = {};
    // The first man out the door is the wire's story; see the stamp below.
    let poachNews: { name: string; seat: StaffSeat } | null = null;
    for (const seat of SEATS) {
      const man = eco0.staff[seat];
      if (!man) continue;
      if (poached(man, year)) {
        poachNews ??= { name: man.name, seat };
        get().post({
          kind: 'season', year: year + 1,
          title: `${man.name} is leaving`,
          body: `Your ${SEAT_LABEL[seat].toLowerCase()} has been hired to run `
            + 'his own program. The seat is open, and the market has names.',
        });
      } else keptStaff[seat] = man;
    }
    const rolledEconomy: Economy = {
      ...eco0, staff: keptStaff, spent: 0, scouted: {},
    };
    if (!handles(get().depth, 'facilities')) {
      // The AD builds when the money is truly there: next rung plus a season
      // of headroom, so an automated career is never wage-poor in February.
      const me0 = get().season?.teams[get().userTeam];
      const nextRung = FACILITIES[rolledEconomy.facilities + 1];
      if (nextRung
        && remaining(rolledEconomy, me0?.prestige ?? 40) >= nextRung.cost + 300) {
        rolledEconomy.facilities += 1;
        rolledEconomy.spent += nextRung.cost;
      }
    }
    if (!handles(get().depth, 'assistants')) {
      const me = get().season?.teams[get().userTeam];
      const prestige = me?.prestige ?? 40;
      for (const seat of SEATS) {
        if (rolledEconomy.staff[seat]) continue;
        const affordable = marketFor(String(season.seed ?? 0), year + 1, seat)
          .filter((m) => remaining(rolledEconomy, prestige) >= m.wage)
          .sort((a, b) => b.rating - a.rating)[0];
        if (affordable) {
          rolledEconomy.staff = { ...rolledEconomy.staff, [seat]: affordable };
        }
      }
    }

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
      /*
        The rivalry's year goes into the career ledger before the results are
        wiped — stage 12. Counted here, once, rather than live, so a replayed
        day cannot double-count a game.
      */
      const myDef = next.teams[get().userTeam]?.def;
      const rivalRec = next.teams.find((t) => t.def.abbr === myDef?.rival);
      if (myDef && rivalRec) {
        const hh = headToHead(next, get().userTeam, rivalRec.index);
        if (hh.w + hh.l > 0) {
          const led = get().rivalry;
          set({ rivalry: { w: led.w + hh.w, l: led.l + hh.l } });
        }
      }

      /*
        The country moves — stage 12. Derived from the world and the year, so
        a reload cannot re-roll who defected; applied to the records the next
        schedule is built from, so the leagues simply ARE different next
        spring. A one-for-one trade, which is what keeps every league the size
        the scheduler needs. The user's chair is never the one relegated; it
        can absolutely be the one invited up.
      */
      const move = realignmentFor(
        String(next.seed ?? 0), year, next.teams, get().userTeam,
      );
      if (move) {
        const riser = next.teams[move.up]?.def;
        const faller = next.teams[move.down]?.def;
        applyRealignment(next.teams, move);
        const mine = move.up === get().userTeam;
        const touchesMe = mine
          || next.teams[get().userTeam]?.conference === move.upTo
          || next.teams[get().userTeam]?.conference === move.downTo;
        get().post({
          kind: 'season', year: year + 1,
          title: mine
            ? `You are moving up: ${move.upTo} baseball`
            : `Realignment: ${riser?.school ?? '?'} join the ${move.upTo}`,
          body: mine
            ? `The ${move.upTo} called and the board said yes before the phone was
              down. ${faller?.school ?? 'Somebody'} goes the other way.`
            : `${riser?.school ?? '?'} outgrew the ${move.downTo} and traded places
              with ${faller?.school ?? '?'}.${touchesMe ? ' Your league looks different in the spring.' : ''}`,
        });
      }

      const rolled = nextSeason(next);

      /*
        The winter, stamped for the paper — stage 14. The inbox already told
        YOU; the wire is the country finding out. Facts only the roll knows are
        written onto the new season here, and the feed retires them itself as
        the spring's actual results pile up.
      */
      if (move) {
        rolled.newsRealign = {
          school: rolled.teams[move.up]?.def.school ?? '?',
          abbr: rolled.teams[move.up]?.def.abbr ?? '?',
          from: move.downTo, to: move.upTo,
          downSchool: rolled.teams[move.down]?.def.school ?? '?',
          downAbbr: rolled.teams[move.down]?.def.abbr ?? '?',
        };
      }
      if (poachNews) {
        rolled.newsStaff = {
          name: poachNews.name,
          seat: SEAT_LABEL[poachNews.seat],
          school: rolled.teams[get().userTeam]?.def.school ?? '?',
        };
      }

      /*
        A year passing for the men, in the two ways stage 8 added.

        Grades drift home, so a man talked back up to eighty is not still at
        eighty in three years and the conversations stay worth having; and a
        man who was moved to a new position sheds a season of settling, so a
        move is a cost that ends rather than a mark he carries for good.

        The user's program only, for the same reason the classroom is: nobody
        can see, act on, or be affected by ninety-five other rosters doing it.
        Anybody suspended is let out here too -- a week in April is not a week
        that should still be running in February.
      */
      // Last season's absences, cleared with the season that produced them.
      delete rolled.classroom;
      delete rolled.trainer;
      const mineNow = rolled.teams[get().userTeam];
      if (mineNow) {
        const men = [
          ...squad(mineNow.team), ...mineNow.team.rotation, ...mineNow.team.bullpen,
        ];
        /*
          What a season did to the men, settled once, in June.

          The mood goes first because it reads the season that just finished --
          how often he actually started against what he was told he would be --
          and everything under it wipes the counters that answer.
        */
        const record = get().season?.teams[get().userTeam];
        const played = (record?.w ?? 0) + (record?.l ?? 0);
        const winPct = played > 0 ? (record?.w ?? 0) / played : 0.5;
        const ranks = squadRanks(mineNow.team);
        const leader = captainOf(mineNow.team);

        for (const p of men) {
          setMood(p, settleMood(p, {
            starts: (p as Player & { starts?: number }).starts ?? 0,
            games: played,
            squadRank: ranks.get(p.id) ?? 20,
            winPct,
            movedUnwillingly: (p as Player & { movedFrom?: string }).movedFrom !== undefined,
            damped: leader !== null,
          }));
          delete (p as Player & { starts?: number }).starts;

          driftGrades(p, get().year + 1);
          // A winter heals everything, which is why a torn ligament is a
          // season rather than a career -- these are nineteen year olds.
          healUp(p);
          resetWorkload(p);
          delete (p as Player & { outUntil?: number }).outUntil;
          if (p.type === 'hitter') settleIn(p as Hitter);
        }
      }
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
      /*
        Who is calling, and who you called.

        Offers used to arrive only when you were sacked, which made a career
        something that happened *to* a coach. A school you approached and that
        was interested belongs on the desk whether or not the board has moved
        you on -- that is the entire point of being allowed to go looking, and
        it is what turns the years left on a contract into a decision.

        Interested schools come first and are not filtered by the hiring ladder:
        they have already said they would take the call, and re-asking whether
        they would have you would throw away the only thing the approach bought.
      */
      const wanted = get().approaches.interest
        .map((i) => rolled.teams[i])
        .filter((t): t is NonNullable<typeof t> => !!t && t.index !== get().userTeam)
        .map((t) => ({
          team: t.index,
          school: t.def.school,
          conference: t.conference,
          prestige: t.prestige,
          pitch: 'You wrote to them. They would like to talk.',
        }));

      const market = review?.fired
        ? jobOffers(coach, rolled.teams, (t) => t.prestige, get().userTeam, 4,
          (t) => !t.coach || coach.prestige > t.coach.prestige)
        : [];

      /*
        The chairs the career watches, honoured.

        TRACK JOB PATH promised "your agent will flag a real opening" and until
        now only starred an offer that arrived by other means. This is the
        flag: a watched chair that would genuinely take the call — winnable by
        the same board test the market uses, hireable by the same ladder — rings
        whether or not you were sacked. Watching is the act of going looking,
        the same as writing to a school, so it earns the same standing desk.
      */
      const flagged = get().watch.jobs
        .map((abbr) => rolled.teams.find((t) => t.def.abbr === abbr))
        .filter((t): t is NonNullable<typeof t> => !!t)
        .filter((t) => t.index !== get().userTeam)
        .filter((t) => (!t.coach || coach.prestige > t.coach.prestige)
          && canBeHired(coach.prestige, t.prestige, t.team.quality))
        .map((t) => ({
          team: t.index,
          school: t.def.school,
          conference: t.conference,
          prestige: t.prestige,
          pitch: 'Your agent flagged it. The chair can be won.',
        }));

      const offers = [
        ...wanted,
        ...flagged.filter((o) => !wanted.some((w) => w.team === o.team)),
        ...market.filter((o) =>
          !wanted.some((w) => w.team === o.team)
          && !flagged.some((f) => f.team === o.team)),
      ];

      set({
        season: rolled,
        year: year + 1,
        version: get().version + 1,
        lastOffseason: report,
        /*
          A new season, and the slate is clean twice over.

          `tried` resets because three feelers is a per-season allowance.
          `interest` resets because a school that would have taken your call
          last winter has hired somebody by now -- carrying it forward would
          build a permanent list of schools that always want you, which is the
          opposite of a market.

          And `caughtLooking` goes with them: the board has had its say at the
          review, and a man should not be tried twice for the same letter.
        */
        approaches: { tried: [], interest: [] },
        // Eight a season means eight *this* season. The ids reset with it, so
        // next year may ask a question this one already used.
        press: clearPress(),
        pendingPress: null,
        // Four conversations a season means four *this* season.
        wordsUsed: 0,
        // Last winter's announcements, cleared with everything else. The action
        // that does this by hand lives with the other actions; it was pasted in
        // here as well, which re-declared it to itself on every year roll.
        newBadges: [],
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
        /*
          The resume offer, which does not survive a year.

          Reported: a brand-new season opened with 'GAME IN PROGRESS · YOU LEFT
          THIS ONE ON THE FIELD'. The offer is written at load from the live
          journal, and a save reloaded mid-offseason could still be carrying
          one when the year rolled — nothing on this path cleared it, so it
          walked into opening day of a season it predates. The journal on disk
          goes with it: a game from last year is not a game anybody can pick
          back up.
        */
        pendingGame: null,
        /*
          The economy's year turns over. The ledger and the scouting books are
          annual; the staff and the facilities persist — a building does not
          un-build. Poaching resolved above, where the inbox can still name
          the man.
        */
        economy: rolledEconomy,
        furthestPhase: 0,
        // The board has had its say at the review, so a man is not tried twice
        // for the same letter.
        coach: { ...coach, caughtLooking: false },
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
          /*
            Where the decision is, not where the description is.

            Reported: "an inbox offer, when I tap it, it just opens the school
            overview and nothing happens." It was doing exactly what it was
            written to do -- show what you would be taking on -- but a card
            headed WANT TO TALK TO YOU that lands on a read-only page reads as
            broken, because the one thing it invited you to do is not there.
            WHO IS CALLING is on the program page and every offer in it is a
            button, so that is where the arrow goes.
          */
          link: { to: 'program', sheet: 'board' },
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
  press: {},
  pendingPress: null,
  portal: null,

  keepFromPortal: (id, offer) => {
    const { season, userTeam, portal, version } = get();
    const rec = season?.teams[userTeam];
    if (!season || !rec || !portal) return false;
    const man = portal.leaving.find((m) => m.player.id === id);
    if (!man) return false;
    const stars = prestigeStars(rec.prestige);
    const left = windowBudget(stars) - portal.spent;
    const { spent, stayed } = portalCase(man, offer, left);
    set({
      portal: {
        ...portal,
        spent: portal.spent + spent,
        leaving: stayed ? portal.leaving.filter((m) => m.player.id !== id) : portal.leaving,
      },
      version: version + 1,
    });
    if (stayed) {
      get().post({
        kind: 'season', year: get().year,
        title: `${man.player.name} is staying`,
        body: 'He was in the portal and he is not any more.',
        link: { to: 'player', id: man.player.id },
      });
    }
    void get().saveNow();
    return stayed;
  },

  takeFromPortal: (id) => {
    const { season, userTeam, portal, version } = get();
    const rec = season?.teams[userTeam];
    if (!season || !rec || !portal) return false;
    const man = portal.available.find((m) => m.player.id === id);
    if (!man) return false;
    const stars = prestigeStars(rec.prestige);
    if (portal.spent + man.cost > windowBudget(stars)) return false;

    // Off his old roster and onto yours, in that order -- a man on two rosters
    // is the kind of thing that only shows up as a duplicated name in June.
    const from = season.teams[man.from];
    if (from) releaseFrom(from.team, man.player.id);
    signFromPortal(rec.team, man);

    set({
      portal: {
        ...portal,
        spent: portal.spent + man.cost,
        available: portal.available.filter((m) => m.player.id !== id),
      },
      version: version + 1,
    });
    get().post({
      kind: 'season', year: get().year,
      title: `${man.player.name} is coming`,
      body: `From ${man.fromName}. He is eligible immediately.`,
      link: { to: 'player', id: man.player.id },
    });
    void get().saveNow();
    return true;
  },

  wordsUsed: 0,

  wordWith: (id) => {
    const { season, userTeam, coach, wordsUsed, version } = get();
    const rec = season?.teams[userTeam];
    if (!rec || wordsUsed >= WORDS_A_SEASON) return false;
    const man = [...squad(rec.team), ...rec.team.rotation, ...rec.team.bullpen]
      .find((p) => p.id === id);
    if (!man) return false;
    const lift = haveAWord(man, coach.skills.training);
    set({ wordsUsed: wordsUsed + 1, version: version + 1 });
    get().post({
      kind: 'season', year: get().year,
      title: `A word with ${man.name}`,
      body: `He is on top of it again — ${lift} to the good. `
        + `${WORDS_A_SEASON - wordsUsed - 1} left this season.`,
      link: { to: 'player', id: man.id },
    });
    void get().saveNow();
    return true;
  },

  nameCaptain: (id) => {
    const { season, userTeam, version } = get();
    const rec = season?.teams[userTeam];
    if (!rec) return false;
    const man = [...squad(rec.team), ...rec.team.rotation, ...rec.team.bullpen]
      .find((p) => p.id === id);
    if (!man || !appoint(rec.team, man)) return false;
    set({ version: version + 1 });
    get().post({
      kind: 'season', year: get().year,
      title: `${man.name} is your captain`,
      body: 'The room has somebody to look at when it goes badly. He will not '
        + 'make anybody happy; he will stop a bad month becoming a bad year.',
      link: { to: 'player', id: man.id },
    });
    void get().saveNow();
    return true;
  },

  clearCaptain: () => {
    const { season, userTeam, version } = get();
    const rec = season?.teams[userTeam];
    if (!rec) return;
    standDown(rec.team);
    set({ version: version + 1 });
    void get().saveNow();
  },

  restMan: (id, days) => {
    const { season, userTeam, version } = get();
    const rec = season?.teams[userTeam];
    if (!season || !rec) return false;
    /*
      Arms included.

      This searched `squad` — the lineup and the bench — so a pitcher could
      never be rested at all: the control rendered, it was disabled by a
      fatigue number that is always zero for arms, and the action behind it
      could not have found him anyway. Found in audit.
    */
    const man = [...squad(rec.team), ...rec.team.rotation, ...rec.team.bullpen]
      .find((p) => p.id === id);
    if (!man) return false;
    // Never over a man who is already out; resting the injured is not a
    // decision, it is a no-op wearing one's clothes.
    if (!available(man, season.dayIndex)) return false;
    /*
      A day off is not an injury, so it is written the same way and read the
      same way and says something else. The depth chart promotes behind him
      exactly as it would for a hamstring -- which is the point of having built
      the chart first.
    */
    const m = man as Player & { outUntil?: number; why?: 'academic' | 'injury' };
    m.outUntil = season.dayIndex + days;
    delete m.why;
    set({ version: version + 1 });
    void get().saveNow();
    return true;
  },

  moveDepth: (spot, id, delta) => {
    const { season, userTeam, version } = get();
    const rec = season?.teams[userTeam];
    if (!rec) return;
    reorder(rec.team, spot, id, delta);
    set({ version: version + 1 });
    void get().saveNow();
  },

  setRedshirt: (id, on) => {
    const { season, userTeam, version } = get();
    const rec = season?.teams[userTeam];
    if (!rec) return false;
    const man = [...squad(rec.team), ...rec.team.rotation, ...rec.team.bullpen]
      .find((p) => p.id === id);
    if (!man) return false;
    /*
      Only before he has played, which is the actual rule.

      Baseball has no four-game grace: one appearance burns the season, so a
      man cannot be redshirted in April having already played in February. The
      season's own day index is the clock -- day zero is the only moment this
      is a decision rather than a rewrite of history.
    */
    if (on && season.dayIndex > 0) return false;
    const ok = on ? redshirt(rec.team, man) : (unRedshirt(man), true);
    if (ok) { set({ version: version + 1 }); void get().saveNow(); }
    return ok;
  },

  changePosition: (id, to) => {
    const { season, userTeam, version } = get();
    const rec = season?.teams[userTeam];
    if (!rec) return false;
    const man = squad(rec.team).find((p) => p.id === id);
    if (!man) return false;
    if (!movePosition(man, to)) return false;
    set({ version: version + 1 });
    get().post({
      kind: 'season', year: get().year,
      title: `${man.name} moves to ${to}`,
      body: 'He will be a step behind there for a season or two, and then he '
        + 'will not.',
      link: { to: 'player', id: man.id },
    });
    void get().saveNow();
    return true;
  },

  /*
    What he said, and what it cost.

    The prestige move goes through the same clamp the board's own verdict uses,
    because a coach cannot talk his way past the ceiling any more than he can
    win his way past it -- and a season of pressers is a personality, not a
    second career ladder.
  */
  answerPress: (answer) => {
    const { pendingPress, coach, season, userTeam, version } = get();
    if (!pendingPress) return;
    const me = season?.teams[userTeam];
    const out = settlePress(answer, coach.badges ?? []);
    /*
      A receipt, because this was the one decision in the game that did not
      leave one.

      Found in audit: answering moved prestige and security and closed the
      overlay in the same breath, so the room simply vanished and nothing
      anywhere told the coach what he had just bought or spent. Every other
      consequential action in the game posts a card — a word with a man, a
      captaincy, a signing — and this is the loudest of them.

      The direction is named and the numbers are not, which is the same rule
      the board's own verdict follows: a coach knows how a press conference
      went, he does not know it went 3.
    */
    const moved = out.prestige === 0 && out.security === 0
      ? 'It will not have changed anybody\'s mind.'
      : [
        out.prestige > 0 ? 'Your name is worth a little more this morning.'
          : out.prestige < 0 ? 'It cost you something with the people who write about you.' : '',
        out.security > 0 ? 'The board liked hearing it.'
          : out.security < 0 ? 'The board did not enjoy reading it.' : '',
      ].filter(Boolean).join(' ');
    get().post({
      kind: 'season', year: get().year,
      key: `press-${pendingPress.presser.id}-${me?.gp ?? 0}`,
      title: 'You faced the press',
      body: `"${answer.text}" ${moved}`,
    });
    set({
      coach: {
        ...coach,
        // NaN slides through a clamp untouched; a finite floor does not.
        prestige: Math.max(0, Math.min(100,
          (Number.isFinite(coach.prestige) ? coach.prestige : 40) + out.prestige)),
        security: Math.max(0, Math.min(100,
          (Number.isFinite(coach.security) ? coach.security : 55) + out.security)),
        // Answering it is the end of it. A man tried twice for the same letter
        // is the fault the board review already refuses to commit.
        caughtLooking: false,
      },
      press: notePress(get().press, pendingPress.presser.id, me?.gp ?? 0),
      pendingPress: null,
      // The room is an overlay now, so answering it has to close it. Without
      // this the question is spent and the player is left looking at the
      // screen that asked it, with nothing on it.
      overlay: null,
      version: version + 1,
    });
    void get().saveNow();
  },

  duckPress: () => {
    const { pendingPress, coach, season, userTeam, version } = get();
    if (!pendingPress) return;
    // Saying nothing is still an answer, and it still gets a line in the
    // record — see the note in `answerPress`.
    get().post({
      kind: 'season', year: get().year,
      key: `press-duck-${pendingPress.presser.id}-${season?.teams[userTeam]?.gp ?? 0}`,
      title: 'You said nothing to the press',
      body: 'No quote, no cost. The room will ask somebody else, and it will '
        + 'ask you again.',
    });
    // Saying nothing costs nothing and spends the question. It is a real
    // option: a coach who does not want to answer tonight should be able not
    // to, and the room moves on to somebody who will.
    set({
      coach: { ...coach, caughtLooking: false },
      press: notePress(get().press, pendingPress.presser.id, season?.teams[userTeam]?.gp ?? 0),
      pendingPress: null,
      overlay: null,
      version: version + 1,
    });
    void get().saveNow();
  },

  noteSeasonNews: () => {
    const before = get().inbox;
    classroomNews(get());
    trainerNews(get());
    recoveryNews(get());
    seasonNews(get());
    // On the same beat the wire is written, because both answer the same
    // question -- what just happened that is worth telling you about.
    const raised = pressToRaise(get());
    if (raised) set({ pendingPress: raised });
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
    // A rivalry belongs to a chair, not a man — the new school has its own,
    // and its ledger opens at nought the day you arrive. The staff stays
    // yours: assistants follow the coach who hired them.
    set({ rivalry: { w: 0, l: 0 } });
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
    applyCoachMods(season, team, next, get().economy.staff);
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
  // Settings always opens on its index. Coming back to a screen you left three
  // sessions ago on the Sound page is a screen remembering something nobody
  // asked it to.
  approaches: { tried: [], interest: [] },
  newBadges: [],
  clearNewBadges: () => set({ newBadges: [] }),

  /*
    One place to record a habit.

    Every hook below is a single call, which matters more than it looks: a
    counter incremented in six places is a counter that will eventually be
    forgotten in a seventh, and these are hidden numbers -- nobody would notice
    for months.

    Deliberately does not save. These fire during a game, several times an
    inning, and a write per steal would be a write per steal. The save that
    already happens at the end of a game carries them.
  */
  noteHabit: (key, n = 1) => {
    const { coach } = get();
    set({ coach: { ...coach, habits: note(coach.habits ?? {}, key, n) } });
  },

  approach: (team) => {
    const { season, coach, userTeam, approaches, year, version } = get();
    if (!season || team === userTeam) return 'no';
    if (approaches.tried.includes(team)) return 'already';
    if (approaches.tried.length >= APPROACHES_PER_SEASON) return 'spent';
    const target = season.teams[team];
    if (!target) return 'no';

    /*
      Seeded off the world, the year and the chair -- never off Math.random.

      An approach that can be re-rolled by reloading the save is not a gamble,
      it is a slot machine with a free respin, and the risk is the whole point
      of the feature. The season generator position is the world clock, so the
      same feeler to the same school in the same season always comes back the
      same way.

      Deliberately does not *consume* a draw from that generator. Reading the
      state is free; spending one here would move every number in the rest of
      the season depending on which schools a player happened to write to.
    */
    const rng = makeRng(
      ((season.rng.state?.() ?? 1) ^ (year * 7919) ^ (team * 104729)) >>> 0,
    );
    const outcome = approachSchool(coach, target, rng);

    const tried = [...approaches.tried, team];
    const interest = outcome === 'interested'
      ? [...new Set([...approaches.interest, team])] : approaches.interest;

    set({
      approaches: { tried, interest },
      coach: outcome === 'caught'
        ? {
            ...coach,
            security: Math.max(0, coach.security - CAUGHT_SECURITY_COST),
            caughtLooking: true,
          }
        : coach,
      version: version + 1,
    });
    void get().saveNow();
    return outcome;
  },

  openOverlay: (o) => set(o === 'settings' ? { overlay: o, settingsPage: 'index' } : { overlay: o }),
  closeOverlay: () => set({ overlay: null }),
  settingsPage: 'index',
  setSettingsPage: (p) => set({ settingsPage: p }),
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
      sideShow: null,
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
  openNationalStep: (advance = false) => {
    const { season, bracket, userTeam, version } = get();
    if (!season || !bracket || bracket.stage !== 'national' || get().myBracket) return;

    // The field, selected exactly once. `seatProtected` settles the protection
    // swaps at the same moment, so the seeding a screen draws is the seeding
    // the tournament is played from.
    let national = bracket.national;
    if (!national) {
      const field = selectNationalField(season, bracket.cups, bracket.regionals);
      seatProtected(field);
      national = { field, bracketA: null, bracketB: null, final: null };
      set({ bracket: { ...bracket, national }, version: version + 1 });
      void get().saveNow();
    }

    /*
      Nothing resolves off screen.

      Reported from testing: "the opening wasn't clear — when I went into
      winners or losers all games appeared to be played out already." They
      were: arriving at this stage used to play every series and every
      bracket the user was not personally in, all inside the effect that
      opens the stage, so the first thing anybody saw was a finished
      tournament. `advance` is the difference between *arriving somewhere*
      and *pressing the button*: arriving only ever starts a tournament of
      your own, and a step you are watching rather than playing waits for a
      press, like every other thing in June that is worth looking at.
    */

    const b2 = get().bracket!;
    const nat2 = b2.national!;

    // The twenty, split into two ten-team double eliminations.
    if (nat2.bracketA === null || nat2.bracketB === null) {
      const { bracketA, bracketB } = splitShowdown(nat2.field.seeds);
      const mineIsA = nat2.bracketA === null && bracketA.includes(userTeam);
      const mineIsB = nat2.bracketB === null && bracketB.includes(userTeam);

      /*
        Both halves of the showdown play at the same pace.

        The other bracket used to be run to its champion the moment yours
        began, so the screen showed one finished tournament beside one that
        had not started — which is what read as "everything is already
        played". It is a live tournament now, stepped a night at a time
        beside yours by `simBracket`, and folded into the results when it
        finishes.
      */
      if (mineIsA || mineIsB) {
        const otherHalf = mineIsA ? 'B' : 'A';
        const otherDone = mineIsA ? nat2.bracketB : nat2.bracketA;
        set({
          myBracket: {
            kind: 'national', format: 'double',
            state: startDoubleElim(season, mineIsA ? bracketA : bracketB),
            half: mineIsA ? 'A' : 'B',
            preplayed: new Map(),
          },
          sideShow: otherDone ? null : {
            half: otherHalf,
            state: startDoubleElim(season, mineIsA ? bracketB : bracketA),
          },
          version: get().version + 1,
        });
      void get().saveNow();
        return;
      }

      if (!advance) return;                 // the sixteen are on screen, waiting
      const next: NationalProgress = { ...nat2 };
      if (nat2.bracketA === null) next.bracketA = resultOfDE(runDoubleElim(season, bracketA));
      if (nat2.bracketB === null) next.bracketB = resultOfDE(runDoubleElim(season, bracketB));
      set({ bracket: { ...b2, national: next }, version: get().version + 1 });
      void get().saveNow();
      return;
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
      void get().saveNow();
        return;
      }
      if (!advance) return;                 // the matchup is on screen, waiting
      const final = bestOf(season, SERIES.final, A, B, 'National championship');
      const summary = summarize(b3.cups, b3.regionals, {
        field: nat3.field,
        bracketA: nat3.bracketA, bracketB: nat3.bracketB,
        final, champion: final.champion,
      });
      set({
        bracket: { ...b3, national: { ...nat3, final } },
        lastPostseason: summary,
        version: get().version + 1,
      });
      void get().saveNow();
    }
  },

  sideShow: null,

  /**
   * Step the other half of the showdown, and file it when it is finished.
   *
   * Called from wherever your own tournament is stepped, so the two stay in
   * lockstep — see the note in `openNationalStep`.
   */
  stepSideShow: () => {
    const { bracket, sideShow, version } = get();
    if (!sideShow) return;
    if (!sideShow.state.done) stepDoubleElim(sideShow.state);
    if (!sideShow.state.done) { set({ version: version + 1 }); return; }

    const nat = bracket?.national;
    if (!bracket || !nat) { set({ sideShow: null, version: version + 1 }); return; }
    const done = resultOfDE(sideShow.state);
    set({
      bracket: {
        ...bracket,
        national: sideShow.half === 'A'
          ? { ...nat, bracketA: done }
          : { ...nat, bracketB: done },
      },
      sideShow: null,
      version: version + 1,
    });
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
    // The national stage advances through its own sub-steps until the trophy,
    // and this is a press, so a step you are watching resolves now.
    if (bracket.national === null || bracket.national.final === null) {
      get().openNationalStep(true);
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
  manageBracketGame: async () => {
    // A game taken rather than handed over. Counted here rather than at the
    // final out, so a game abandoned halfway still counts as one he sat in.
    get().noteHabit('managed');
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

    /*
      June anchors the same way April does now.

      This used to refuse to save, on the grounds that "a save taken
      mid-bracket would write a season carrying games the saved `bracket` has
      no record of — the live sub-bracket is not serialisable". That was true
      when it was written and stopped being true during the overhaul:
      `portableMyBracket` and `usableMyBracket` carry the live tournament
      through a save and back, and `sideShow` joined them with the national
      redesign. So the restriction was protecting against a hazard that no
      longer exists, and it was the one thing standing between a bracket game
      and being resumable.
    */
    // What this coach has said he wants to be asked. Read once, here, so
    // the journal and the game it anchors can never disagree about it.
    const autoPen = !handles(get().depth, 'bullpen');
    if (!handles(get().depth, 'lineups')) staffSetsTheCard(season, userTeam);
    const rngState = season.rng.state?.() ?? 0;
    await get().saveNow();
    writeJournal({
      slot: 'auto', year: get().year, rngState,
      home: h, away: a, day: season.dayIndex,
      homeStarter: slot, awayStarter: slot,
      managing: h === userTeam ? 'home' : 'away',
      autoPitching: autoPen,
      postseason: true,
      actions: [],
    });

    set({
      live: createLiveGame(home.team, away.team, season.rng, {
        managing: h === userTeam ? 'home' : 'away',
        autoPitching: autoPen,
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

    // The other half of the showdown keeps pace, night for night, so the two
    // brackets on screen are always at the same point in the tournament.
    const both = (): void => { step(); get().stepSideShow(); };

    if (mode === 'game') {
      both();
    } else if (mode === 'round') {
      if (myBracket.format === 'series') {
        // To the end of this round, however many nights that takes.
        const from = myBracket.state.roundIndex;
        let guard = 0;
        while (!myBracket.state.done && myBracket.state.roundIndex === from
          && guard++ < 40) both();
      } else {
        // A double elimination has no single round index: one night is the
        // honest unit, every playable game played.
        both();
      }
    } else if (mode === 'mine') {
      /*
        Straight to the next game you are actually in.

        Round by round is the honest unit and it is kept -- but it is not what
        somebody wants when four of the next five rounds have nothing of theirs
        in them. Asked for directly, and asked for as the *primary* button,
        which is the right call: the reason to be on this screen is your own
        team.

        Stops on the first round that contains one of your games, before
        playing it, so the game is still yours to play or sim. Also stops if
        you go out or the tournament ends, because there is no next game then.
      */
      const userTeam = get().userTeam;
      const mineIsUp = (): boolean => {
        if (myBracket.format === 'series') return !myBracket.state.done;
        return liveSlotFor(myBracket.state, userTeam) !== null;
      };
      let guard = 0;
      while (!state.done && !mineIsUp() && guard++ < 200) both();
    } else {
      let guard = 0;
      while (!state.done && guard++ < 200) both();
    }

    set({ version: version + 1 });
    // Before the close, which is what takes the bracket away: a round that ends
    // your run without ending the tournament is still the end of your run.
    get().noteKnockout();
    if (state.done) get().closeMyBracket();
    /*
      And written down.

      Reported: simmed the play-in and the opening round, left the screen, came
      back and the tournament was at the play-in again. It was — nothing here
      ever reached the disk. Every other thing that moves the game forward saves
      on its way out and this did not, so an entire evening of June lived in
      memory until some unrelated action happened to write it.

      It also cost more than the bracket. The postseason statistics are folded
      in as games are played, so an unsaved June took those with it too, and
      the leaderboard came back empty for a tournament that had been played.
    */
    void get().saveNow();
  },

  knockout: null,

  noteKnockout: () => {
    const { season, myBracket, userTeam, year, knockout } = get();
    if (!myBracket || !season) return;
    /*
      Once per tournament, not once per year.

      This used to refuse any second knockout in a season, on the reasonable
      assumption that a season ends once. It does not any more: a team can be
      put out of its conference tournament and carry on to a regional, put out
      of that and carry on to the national field. Reported from playing it —
      knocked out of the nationals in the losers bracket with no card, no
      letter, nothing, because May had already spoken for the year.

      Keyed on the tournament as well as the year, so each of the three can
      report its own ending exactly once.
    */
    if (knockout && knockout.year === year && knockout.kind === myBracket.kind) return;
    if (!myBracket.state.eliminated.includes(userTeam)) return;

    // The game or series that did it, so the modal can say where the year
    // stopped, already in words — and how far it left you, because a
    // tournament ending is not a season ending any more.
    let label = '';
    let advanced = false;
    let placing = 0;

    if (myBracket.format === 'series') {
      const state = myBracket.state;
      const lost = state.rounds.flat().find(
        (s) => s.winner !== null && s.winner !== userTeam
          && (s.a === userTeam || s.b === userTeam),
      );
      label = roundName(
        state.rounds.length, lost ? lost.round : state.rounds.length - 1,
      ).toLowerCase();
      /*
        A regional loss is not the end for a protected team. The top four of
        the final regular-season table reach the national field whatever June
        does to them, and `protectedTopFour` is pure arithmetic over the
        finished season, so the answer is available the moment the series is.
      */
      if (myBracket.kind === 'regional') {
        advanced = protectedTopFour(season).includes(userTeam);
      }
    } else {
      const state = myBracket.state;
      const slots = [...state.winners.flat(), ...state.losers.flat(), ...state.final];
      const fell = [...slots].reverse().find(
        (s) => s.winner !== null && s.winner !== userTeam
          && (s.a === userTeam || s.b === userTeam),
      );
      label = fell ? slotName(fell).toLowerCase() : 'the bracket';

      /*
        Where a double elimination leaves you is written in the slot you took
        your second loss in: the championship is first or second, the losers
        final is third, the losers semifinal is fourth. The conference sends
        its top `CONF_ADVANCE` on, so those four are still playing.

        Counted back from the end rather than at fixed indices, which is what
        the ten-team national bracket broke: its losers final is round four and
        its semifinal round three, where an eight-team bracket has three and
        two. The rule is positional — the last losers round is always the
        final — so it is read that way, exactly as `placings` reads it.
      */
      if (fell) {
        const last = state.losers.length - 1;
        if (fell.side === 'F') placing = 2;
        else if (fell.side === 'L' && fell.round === last) placing = 3;
        else if (fell.side === 'L' && fell.round === last - 1) placing = 4;
      }
      if (myBracket.kind === 'conference') {
        advanced = placing > 0 && placing <= CONF_ADVANCE;
      }
    }
    /*
      And a letter, beside the card.

      The card is the moment and it fires once; this is the record, and it is
      what makes the moment re-readable in September. Asked for as both, and the
      two really are different jobs — a card you tapped past at 1am is gone, and
      "how did that year actually end" is a question the inbox is already the
      place for.

      Keyed on the year and the tournament, so the same ending can never be
      filed twice however many times a reload walks back through this.
    */
    const me = season.teams[userTeam];
    const where = myBracket.kind === 'conference' ? 'the conference tournament'
      : myBracket.kind === 'regional' ? 'the regional'
      : 'the national tournament';
    const body = advanced
      ? `Out of ${where} in the ${label}, but the season goes on — ${
        myBracket.kind === 'conference' ? 'a regional championship series is next'
          : 'the national field still has a place for you'}.`
      : `Out of ${where} in the ${label}. ${
        me?.w ?? 0}-${me?.l ?? 0} on the year.`;
    set({
      knockout: {
        year, kind: myBracket.kind, label, advanced,
        ...(placing > 0 ? { placing } : {}),
      },
      inbox: push(get().inbox, newItem({
        year, kind: 'season',
        key: `knockout-${myBracket.kind}`,
        title: advanced ? 'Still alive' : 'The season is over',
        body,
      })),
    });
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
      // The cup is a takeover — stage 14. The first thing a program wins.
      if (me && deAsResult(myBracket.state).champion === userTeam) {
        get().offerBigMoment({
          kind: 'cup', team: userTeam, year: get().year,
          line: `${me.conference} tournament champions`,
        });
      }
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
      // The ticket, punched — stage 14.
      if (mine.champion === userTeam) {
        get().offerBigMoment({
          kind: 'regional', team: userTeam, year: get().year,
          line: `${name} regional champions`,
        });
      }
    } else if (myBracket.kind === 'national' && myBracket.format === 'double') {
      // Your half is finished, so the other one runs out its remaining nights
      // here rather than holding the championship up. A stage boundary is the
      // one place the world is allowed to catch up in a single step.
      const side = get().sideShow;
      if (side) {
        let guard = 0;
        while (!side.state.done && guard++ < 40) stepDoubleElim(side.state);
        get().stepSideShow();
      }
      const after = get().bracket ?? bracket;
      const nat = after.national!;
      const done = resultOfDE(myBracket.state);
      set({
        bracket: {
          ...after,
          national: myBracket.half === 'A'
            ? { ...nat, bracketA: done }
            : { ...nat, bracketB: done },
        },
        myBracket: null, version: version + 1,
      });
      // Through the showdown — stage 14. Two teams left in the country.
      if (done.champion === userTeam) {
        get().offerBigMoment({
          kind: 'final4', team: userTeam, year: get().year,
          line: 'Through the showdown bracket',
        });
      }
    } else if (myBracket.kind === 'final' && myBracket.format === 'series') {
      const mine = resultOf(myBracket.state);
      const nat = bracket.national!;
      const summary = summarize(bracket.cups, bracket.regionals, {
        field: nat.field,
        bracketA: nat.bracketA!, bracketB: nat.bracketB!,
        final: mine, champion: mine.champion,
      });
      set({
        bracket: { ...bracket, national: { ...nat, final: mine } },
        lastPostseason: summary,
        myBracket: null, version: version + 1,
      });
      // The whole thing, or the longest June that ends without it — stage 14.
      // You were in the final either way; both are the biggest screen owed.
      get().offerBigMoment(mine.champion === userTeam
        ? {
          kind: 'title', team: userTeam, year: get().year,
          line: 'National champions',
        }
        : {
          kind: 'runner-up', team: userTeam, year: get().year,
          line: 'Runners-up in the country',
        });
    }
    void get().saveNow();
  },

  live: null,
  liveMeta: null,
  pendingGame: null,

  bigMoment: null,
  offerBigMoment: (m) => {
    const cur = get().bigMoment;
    if (cur && MOMENT_RANK[cur.kind] >= MOMENT_RANK[m.kind]) return;
    set({ bigMoment: m, version: get().version + 1 });
  },
  clearBigMoment: () => set({ bigMoment: null, version: get().version + 1 }),

  /**
   * Pick the interrupted game back up, or let the bench coach finish it.
   *
   * Either way the game is rebuilt and replayed first: the alternative to
   * replaying is inventing a different game, and a day that resolves
   * differently depending on whether you were interrupted is worse than losing
   * the day. `take` only decides who holds the clipboard afterwards.
   */
  resumeGame: async (take) => {
    const { season, userTeam, version } = get();
    const j = readJournal();
    set({ pendingGame: null });
    if (!season || !j) return;
    if (!journalMatches(j, 'auto', get().year, season.rng.state?.() ?? -1)) {
      clearJournal();
      return;
    }

    const home = season.teams[j.home];
    const away = season.teams[j.away];
    if (!home || !away) { clearJournal(); return; }

    const live = createLiveGame(home.team, away.team, season.rng, {
      managing: j.managing,
      // Off the journal, not off today's settings: the replay has to rebuild
      // the game that was interrupted, not the one this coach would start now.
      autoPitching: j.autoPitching === true,
      engine: season.config.engine,
      homeStarter: j.homeStarter,
      awayStarter: j.awayStarter,
      homeStrategy: home.strategy,
      awayStrategy: away.strategy,
      homeBullpen: restedFirst(season, home),
      awayBullpen: restedFirst(season, away),
      ...(home.coachMods ? { homeCoachMods: home.coachMods } : {}),
      ...(away.coachMods ? { awayCoachMods: away.coachMods } : {}),
    });

    /*
      The replay. Every call in the order it was made, against a generator
      standing exactly where it stood at the first pitch — so this is not a
      similar game, it is the same one.

      A call that no longer applies is skipped rather than forced: the bench
      is looked up by id and a man who is not on it is not sent up. In a
      correct journal that never happens, and if it ever does, dropping one
      call beats throwing the innings away.
    */
    const mine = j.managing === 'home' ? home : away;
    for (const a of j.actions) {
      if (live.over) break;
      if (a.k === 'tactic') { live.submit(a.t); continue; }
      if (a.k === 'pinch') {
        const bat = live.benchAvailable.find((h) => String(h.id) === a.id);
        if (bat) live.pinchHit(bat);
        continue;
      }
      if (a.k === 'visit') { live.visitMound(); continue; }
      const arm = live.bullpenAvailable.find((p) => String(p.id) === a.id);
      if (arm) live.changePitcher(arm);
    }
    void mine;

    const liveMeta = {
      home: j.home, away: j.away, day: j.day,
      conference: false,
      ...(j.postseason ? { postseason: true } : {}),
    };

    if (!take) {
      // Declined. The day still happens — it simply happens without you,
      // which is a better answer than un-playing it.
      live.finish();
      set({ live, liveMeta, version: version + 1 });
      await get().endManagedGame();
      return;
    }

    set({
      live, liveMeta, version: version + 1,
      tab: 'home', screen: 'box',
    });
    void userTeam;
  },

  startManagedGame: async () => {
    // A game taken rather than handed over. Counted here rather than at the
    // final out, so a game abandoned halfway still counts as one he sat in.
    get().noteHabit('managed');
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
    while (!seasonComplete(season) && !hasMine() && guard++ < 60) simNextDay(season);
    if (seasonComplete(season)) return;

    const day = season.schedule[season.dayIndex];
    const g = day?.games.find((x) => x.home === userTeam || x.away === userTeam);
    if (!day || !g) return;

    const home = season.teams[g.home];
    const away = season.teams[g.away];
    if (!home || !away) return;

    /*
      The anchor, and why the save is awaited rather than fired off.

      The journal replays this game against a season restored to the generator
      position it had at the first pitch. That only works if the save on disk
      holds *that* position — so the write has to complete before a single
      draw is spent, and `createLiveGame` spends them immediately. Awaiting
      also covers the days simmed above, which used to be saved for the same
      reason in a separate call.
    */
    // What this coach has said he wants to be asked. Read once, here, so
    // the journal and the game it anchors can never disagree about it.
    const autoPen = !handles(get().depth, 'bullpen');
    if (!handles(get().depth, 'lineups')) staffSetsTheCard(season, userTeam);
    const rngState = season.rng.state?.() ?? 0;
    await get().saveNow();
    writeJournal({
      slot: 'auto', year: get().year, rngState,
      home: g.home, away: g.away, day: day.day,
      homeStarter: g.slot, awayStarter: g.slot,
      managing: g.home === userTeam ? 'home' : 'away',
      autoPitching: autoPen,
      postseason: false,
      actions: [],
    });

    set({
      live: createLiveGame(home.team, away.team, season.rng, {
        managing: g.home === userTeam ? 'home' : 'away',
        autoPitching: autoPen,
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

  /*
    Every call is written down as it is made.

    Three lines each, and they are the whole of the resume feature's cost at
    play time: a synchronous `localStorage` write of a few hundred bytes. The
    order is deliberate — the journal is appended *before* the engine is
    stepped, so a crash inside the engine leaves a journal that replays to the
    same crash rather than one that has silently skipped a call.
  */
  submitTactic: (t) => {
    const { live, version } = get();
    if (!live || live.over) return;
    // The calls that mark a man out as a small-ball coach. Not every tactic --
    // "swing" and "pitch" are the absence of a decision rather than one.
    if (t === 'steal' || t === 'bunt' || t === 'hitrun') get().noteHabit('aggressive');
    noteAction({ k: 'tactic', t });
    live.submit(t);
    set({ version: version + 1 });
  },

  pinchHitFor: (h) => {
    const { live, version } = get();
    if (!live) return;
    noteAction({ k: 'pinch', id: String(h.id) });
    live.pinchHit(h);
    set({ version: version + 1 });
  },

  bringIn: (p) => {
    const { live, version } = get();
    if (!live) return;
    get().noteHabit('pen');
    noteAction({ k: 'pen', id: String(p.id) });
    live.changePitcher(p);
    set({ version: version + 1 });
  },

  visitMound: () => {
    const { live, version } = get();
    if (!live) return;
    get().noteHabit('pen');
    // Journalled before the engine is stepped, like every other call, so a
    // crash replays to the same crash rather than skipping the visit.
    noteAction({ k: 'visit' });
    live.visitMound();
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

    /*
      The walk-off takeover — stage 14. The engine stamps walkOffBy on the
      home half the moment it says "win it.", so the fact is already in the
      result; this only decides whose night it was. Offered, not set: a
      walk-off that clinches something bigger loses the screen to the clinch.
    */
    const woId = live.result.home.walkOffBy;
    if (woId && (liveMeta.home === userTeam || liveMeta.away === userTeam)) {
      let woName: string | undefined;
      for (const l of live.result.home.batting.values()) {
        if (l.player.id === woId) { woName = l.player.name; break; }
      }
      const line = `${season.teams[liveMeta.away]?.def.abbr ?? '?'} `
        + `${live.result.away.runs} — ${live.result.home.runs} `
        + `${season.teams[liveMeta.home]?.def.abbr ?? '?'}`;
      get().offerBigMoment({
        kind: liveMeta.home === userTeam ? 'walkoff' : 'walkoff-against',
        team: liveMeta.home, name: woName, line, year: get().year,
      });
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
        // And the other half of the showdown plays its night too.
        get().stepSideShow();
      }
      clearJournal();
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
      clearJournal();
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

    clearJournal();
    set({ live: null, liveMeta: null, version: version + 1, screen: 'today' });
    get().noteSeasonNews();
    await get().saveNow();
  },

  setStrategy: (key, value) => {
    const { season, userTeam, version } = get();
    const me = season?.teams[userTeam];
    if (!me || get().busy) return;
    // The signature is typed, but an untyped caller (a console, a future bug)
    // could still write a junk key straight into the save. Refuse anything the
    // strategy does not already carry.
    if (!(key in me.strategy)) return;
    // Mutated in place: the engine reads TeamRecord.strategy when it builds each
    // game, so this is live from the next pitch onward.
    me.strategy = { ...me.strategy, [key]: value };
    set({ version: version + 1 });
    void get().saveNow();
  },

  swapStarter: (slot, benchId) => {
    const { season, userTeam, version } = get();
    const team = season?.teams[userTeam]?.team;
    if (!season || !team || get().busy) return false;
    const bIdx = team.bench.findIndex((p) => p.id === benchId);
    const out = team.lineup[slot];
    const inMan = team.bench[bIdx];
    if (bIdx < 0 || !out || !inMan) return false;
    // A man who cannot play cannot be started — refusing here is the whole
    // point of the manual-cover rule.
    if (!available(inMan, season.dayIndex)) return false;
    team.lineup[slot] = inMan;
    team.bench[bIdx] = out;
    set({ version: version + 1 });
    void get().saveNow();
    return true;
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
    /*
      Bench the men who cannot play, THEN order the card.

      Reported: "the auto button doesn't move hurt players out." It called a
      helper whose contract is a pure reorder, so it never could. The fit pass
      swaps every unavailable starter for the best available cover first.
    */
    if (season) {
      const fit = fitTheNine(team, season.dayIndex);
      team.lineup.splice(0, team.lineup.length, ...fit.lineup);
      team.bench.splice(0, team.bench.length, ...fit.bench);
    }
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
    const auto = !handles(get().depth, 'lineups');
    while (!seasonComplete(season)
      && season.schedule[season.dayIndex]?.week === start
      && guard++ < 10) {
      if (auto) staffSetsTheCard(season, get().userTeam);
      simNextDay(season);
    }
    set({ version: get().version + 1 });
    get().noteSeasonNews();
    void get().saveNow();
  },

  seenTutorials: [],
  focusPlayer: null,
  watch: { programs: [], jobs: [] },
  toggleProgramWatch: (abbr) => {
    const w = get().watch;
    set({
      watch: {
        ...w,
        programs: w.programs.includes(abbr)
          ? w.programs.filter((a) => a !== abbr)
          : [...w.programs, abbr],
      },
    });
    void get().saveNow();
  },
  toggleJobWatch: (abbr) => {
    const w = get().watch;
    set({
      watch: {
        ...w,
        jobs: w.jobs.includes(abbr)
          ? w.jobs.filter((a) => a !== abbr)
          : [...w.jobs, abbr],
      },
    });
    void get().saveNow();
  },

  economy: freshEconomy(),
  rivalry: { w: 0, l: 0 },
  alumni: {},

  hireAssistant: (seat, slot) => {
    const { season, userTeam, year, economy } = get();
    const me = season?.teams[userTeam];
    if (!season || !me) return;
    if (economy.staff[seat]) return;
    const man = marketFor(String(season.seed ?? 0), year, seat)[slot];
    if (!man) return;
    // The wage has to fit what is left this year — a hire the ledger cannot
    // carry would be a negative number the screen has to explain.
    if (remaining(economy, me.prestige) < man.wage) return;
    const staff = { ...economy.staff, [seat]: man };
    // Re-dress the mods the games read; the staff stacks on the coach's own.
    syncCoachMods(season, userTeam, withStaff(get().coach.skills, staff));
    set({ economy: { ...economy, staff }, version: get().version + 1 });
    void get().saveNow();
  },

  fireAssistant: (seat) => {
    const { season, userTeam, economy } = get();
    if (!season) return;
    if (!economy.staff[seat]) return;
    const staff = { ...economy.staff };
    delete staff[seat];
    syncCoachMods(season, userTeam, withStaff(get().coach.skills, staff));
    set({ economy: { ...economy, staff }, version: get().version + 1 });
    void get().saveNow();
  },

  upgradeFacilities: () => {
    const { season, userTeam, economy } = get();
    const me = season?.teams[userTeam];
    if (!season || !me) return;
    if (economy.facilities >= MAX_FACILITY) return;
    const next = FACILITIES[economy.facilities + 1];
    if (!next || remaining(economy, me.prestige) < next.cost) return;
    set({
      economy: {
        ...economy,
        facilities: economy.facilities + 1,
        spent: economy.spent + next.cost,
      },
      version: get().version + 1,
    });
    void get().saveNow();
  },

  scoutTeam: (team) => {
    const { season, userTeam, economy } = get();
    const me = season?.teams[userTeam];
    if (!season || !me || team === userTeam) return;
    const until = economy.scouted[team] ?? -1;
    if (until >= season.dayIndex + SCOUT_DAYS) return;
    if (remaining(economy, me.prestige) < SCOUT_COST) return;
    set({
      economy: {
        ...economy,
        spent: economy.spent + SCOUT_COST,
        scouted: { ...economy.scouted, [team]: season.dayIndex + SCOUT_DAYS },
      },
      version: get().version + 1,
    });
    void get().saveNow();
  },

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

  depth: { ...DEFAULT_DEPTH, overrides: {} },

  setDepthMode: (mode) => {
    set({ depth: setMode(get().depth, mode) });
    void get().saveNow();
  },

  setDepthSystem: (key, value) => {
    set({ depth: setSystem(get().depth, key, value) });
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
        sideShow: portableSideShow(get().sideShow),
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
        watch: get().watch,
        economy: get().economy,
        rivalry: get().rivalry,
        alumni: get().alumni,
        depth: get().depth,
        /*
          How many the room has had this season, and the one still open.

          Both matter across a reload for the same reason: without `press` a
          resumed season starts its eight again, and without the open question
          a coach who closed the app mid-answer never gets asked. Stored as an
          id rather than the question itself, so the pool can be rewritten
          without stranding a save on a version of a sentence.
        */
        wordsUsed: get().wordsUsed,
        press: get().press,
        pendingPress: get().pendingPress
          ? { id: get().pendingPress!.presser.id, trigger: get().pendingPress!.trigger }
          : null,
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
    // TESTING ONLY, with the godsquad: the wonder guy joins a class that was
    // generated before he existed, so an in-flight save can test him too.
    ensureWonderGuy(loaded.season.recruiting);
    // Restamped on every load rather than trusted from the save, so a save from
    // before the in-game skills were wired — or one that predates a job change —
    // comes up with the edge on the right program.
    applyCoachMods(loaded.season, loaded.userTeam, coach, usableEconomy(loaded.economy).staff);
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
      sideShow: usableSideShow(loaded.sideShow, loaded.season, bracket),
      // How June ended and what it has already said about it. Both are only
      // ever read against the year on them, so a save from an older build —
      // which carries neither — resumes with nothing said and nothing lost.
      knockout: usableKnockout(loaded.knockout, loaded.year),
      postseasonSeen: Array.isArray(loaded.postseasonSeen)
        ? (loaded.postseasonSeen as string[]).filter((k) => typeof k === 'string')
        : [],
      // The season's press so far, and the question that was open. A save from
      // before any of this has neither, which is a coach nobody has asked
      // anything yet -- the correct starting state rather than a crash.
      press: (loaded.press ?? {}) as PressState,
      pendingPress: restorePending(loaded.pendingPress),
      wordsUsed: typeof loaded.wordsUsed === 'number' ? loaded.wordsUsed : 0,
      jobSearch,
      offers,
      // Merged rather than replaced: what the player has learned is a fact
      // about the player, not the save. Loading an old dynasty from before the
      // tutorials existed must not re-teach nine screens to a veteran who has
      // been playing all evening.
      watch: usableWatch(loaded.watch),
      economy: usableEconomy(loaded.economy),
      rivalry: usableRivalry(loaded.rivalry),
      alumni: usableAlumni(loaded.alumni),
      seenTutorials: [...new Set([
        ...get().seenTutorials,
        ...(Array.isArray(loaded.tutorials)
          ? (loaded.tutorials as unknown[]).filter((t): t is string => typeof t === 'string')
          : []),
      ])],
      // Replaced rather than merged, unlike the tutorials above, and the
      // difference is the point: what a player has *learned* belongs to the
      // player, but how deep a game he wanted belongs to this dynasty. A save
      // from before the mode existed carries nothing and normalises to full,
      // which leaves a career in progress exactly as it was being played.
      depth: normalizeDepth(loaded.depth),
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
      /*
        A game a phone call interrupted, offered rather than restored.

        The journal is checked against the save it claims to belong to — same
        dynasty, same year, same generator position — and anything that fails
        that is thrown away rather than replayed into a world that has moved
        on. What survives is not the game; it is the offer of the game, which
        `Today` puts to the player.
      */
      pendingGame: pendingFromJournal(loaded.season, loaded.year),
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
    sideShow: null,
    knockout: null,
    postseasonSeen: [],
    lastPostseason: null,
    live: null,
    liveMeta: null,
    pendingGame: null,
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
