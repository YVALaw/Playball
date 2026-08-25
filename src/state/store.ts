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
  recordResult, restedFirst,
  type SeasonState,
} from '../engine/season.js';
import type { GameResult } from '../engine/game.js';
import { playerId } from '../engine/types.js';
import type { Hitter, Pitcher, PlayerId, Tactic } from '../engine/types.js';
import { createLiveGame, type LiveGame } from '../engine/liveGame.js';
import {
  departAndDevelop, fillRosters, type OffseasonReport,
} from '../engine/progression.js';
import {
  newCoach, restoreCoach, reviewSeason, jobOffers, rosterStrength, contractFor,
  prestigeStars, skillPoints,
  type CoachState, type CoachSkills, type CoachProfile, type JobOffer, type Review,
  type SeasonOutcome,
} from '../engine/program.js';
import {
  runPostseason, freezeRegularSeason, stageConferenceTournaments,
  stageRegionals, stageNational, regionalPairing, summarize,
  startSeriesBracket, stepBracket, nextGameFor, resultOf, pairKey, hostOfGame,
  conferenceLengths, REGIONAL_LENGTHS, NATIONAL_LENGTHS, regionOf,
  seasonAwards, allConference, coachOfTheYear,
  conferenceField, conferenceIds, conferenceTournament, singleElimination, REGIONS,
  type SeriesBracket,
  type Finish, type PostseasonSummary, type ConferenceTournament,
  type RegionalResult, type TournamentResult,
} from '../engine/postseason.js';
import {
  SCHOLARSHIPS, RECRUITING_BUDGET, MAX_PER_RECRUIT, RECRUITING_WEEKS, budgetFor,
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
      for (const { prospect, actions } of aiTargets(
        record.index, pitch, 45, season.recruiting.prospects,
        holesFor(record), season.rng, snapshot,
      )) {
        prospect.points[record.index] =
          (prospect.points[record.index] ?? 0)
          + weeklyPoints(prospect, pitch, actions, 45) * scale;
      }
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
import { strategyFor, strategyForPhilosophy, type Strategy } from '../engine/strategy.js';
import { HOME_CONFERENCE, CONFERENCES } from '../data/schools.js';
import { saveDynasty, loadDynasty } from './persistence.js';
import { toPortable, fromPortable } from './seasonCodec.js';
import { WORLD_SEED, START_YEAR } from './world.js';
// Re-exported so the screens that already import it from here keep working.
export { WORLD_SEED, START_YEAR, careerSeed } from './world.js';
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
  { id: 'home', label: 'HOME', screens: [
    { id: 'today', label: 'TODAY' }, { id: 'wire', label: 'WIRE' }, { id: 'box', label: 'SCOREBOOK' }] },
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

  { id: 'program', label: 'PROGRAM', screens: [
    { id: 'records', label: 'PROGRAM' }, { id: 'history', label: 'HISTORY' }, { id: 'strategy', label: 'STRATEGY' }] },
];

/** How far through the postseason we are, and what has happened so far. */
export interface PostseasonProgress {
  /**
   * 'selection' and 'done' are gone as steps but stay in the type: a save
   * written before this change can still be sitting on one, and it has to load.
   */
  /**
   * Two stages now, not four.
   *
   * The national bracket is one sixteen team tree, so the regionals and Omaha
   * are its first two and last two rounds rather than separate tournaments. The
   * old names stay in the type because a save written before the format changed
   * still has to load; `openStage` treats anything unknown as finished.
   */
  stage: 'conference' | 'regional' | 'national' | 'done' | 'selection' | 'omaha';
  cups: ConferenceTournament[];
  /** One per region, once they have been played. */
  regionals: RegionalResult[];
  /** The last four, once they have been played. */
  national: TournamentResult | null;
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
  kind: 'conference' | 'regional' | 'national';
  state: SeriesBracket;
  /** A game you played by hand, waiting for the round it belongs to. */
  preplayed: Map<string, GameResult>;
}

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
  kind: 'conference' | 'regional' | 'national';
  /** Which round ended it, and how many the bracket had — enough to name it. */
  round: number;
  rounds: number;
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
  /** The game you are due to play next in it, if there is one. */
  myNextGame: () => { a: number; b: number; round: string } | null;
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
  /** Why the save on disk could not be opened, if it could not. */
  loadError: string | null;
}

export const AUTOSAVE_SLOT = 'auto';

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
  return {
    stage: b.stage, cups: b.cups, regionals: b.regionals,
    national: b.national ?? null,
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
type StoredMyBracket = { kind: MyBracket['kind']; state: Omit<SeriesBracket, 'season'> };

function portableMyBracket(mine: MyBracket | null): StoredMyBracket | null {
  if (!mine) return null;
  const { season, ...state } = mine.state;
  void season;
  return { kind: mine.kind, state };
}

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
  if (m.kind !== bracket.stage) return null;
  const s = m.state as Partial<SeriesBracket> | undefined;
  if (!s || !Array.isArray(s.rounds) || !Array.isArray(s.seeds)) return null;
  // A finished tournament belongs in the stage results, not still in your hands.
  if (s.done) return null;
  // Maps survive a structured clone, but a hand-edited or half-written record
  // would arrive without them, and every step reads both.
  if (!(s.appearances instanceof Map) || !(s.seedOf instanceof Map)) return null;
  return {
    kind: m.kind,
    state: { ...(s as Omit<SeriesBracket, 'season'>), season },
    preplayed: new Map(),
  };
}

/** A saved elimination, refused unless it belongs to the year being loaded. */
function usableKnockout(saved: unknown, year: number): Knockout | null {
  if (!saved || typeof saved !== 'object') return null;
  const k = saved as Partial<Knockout>;
  if (k.year !== year) return null;
  if (k.kind !== 'conference' && k.kind !== 'regional' && k.kind !== 'national') return null;
  if (typeof k.round !== 'number' || typeof k.rounds !== 'number') return null;
  return { year, kind: k.kind, round: k.round, rounds: k.rounds };
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
  for (const t of season.teams) delete t.coachMods;
  const me = season.teams[userTeam];
  if (me) me.coachMods = { offense: coach.skills.offense, defense: coach.skills.defense };
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
 * sixty-three teams this does not concern, it is a no-op that writes the value
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

  start: (seed = WORLD_SEED, team?: number, profile?: CoachProfile) => {
    const season = createSeason(makeRng(seed), undefined, CONFERENCES);
    // Whose games to keep box scores for. A season is built before anybody has
    // taken a job, so the engine cannot know this on its own.
    season.captureBoxFor = team ?? defaultUserTeam(season);
    const coach = newCoach(profile, contractFor(season.teams[team ?? 0]?.prestige ?? 50));
    applyCoachMods(season, team ?? defaultUserTeam(season), coach);
    applyPhilosophy(season, team ?? defaultUserTeam(season), coach);
    set({
      season,
      userTeam: team ?? defaultUserTeam(season),
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
      lastCommits: [],
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
    // Against this program's budget, not a flat league-wide one: prestige buys
    // attention, and that is most of what a good job is worth on the board.
    const budget = budgetFor(prestigeStars(get().season?.teams[userTeam]?.prestige ?? 50));
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
    const { season, userTeam, coach, version } = get();
    if (!season) return;
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

      const spends: { prospect: typeof recruits.prospects[number]; actions: number }[] = mine
        ? recruits.prospects
            .filter((p) => (p.spent[userTeam] ?? 0) > 0)
            .map((p) => ({ prospect: p, actions: p.spent[userTeam] as number }))
        : aiTargets(
            record.index, pitch, 45, recruits.prospects,
            holesFor(record), season.rng, atWeekStart,
          );

      for (const { prospect, actions } of spends) {
        // The user's pitch carries his own reputation and recruiting skill;
        // every AI program works at the league-average defaults.
        const gained = weeklyPoints(
          prospect, pitch, actions,
          mine ? coach.prestige : 45,
          mine ? coach.skills.recruiting : 20,
        );
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
      set({
        phase: next,
        furthestPhase: Math.max(get().furthestPhase, PHASES.indexOf(next)),
        // A fresh window starts with a fresh board. Last year's "week 3 is
        // over" recap surviving into this year's week 1 read as the window
        // being already finished.
        lastWeek: null,
        lastCommits: [],
        version: get().version + 1,
      });
      void get().saveNow();
      return;
    }

    // Entering the draft empties the roster: who leaves, and who got better.
    // The class is not placed here — recruiting has not happened yet, which is
    // the entire point of the draft coming first.
    if (next === 'draft') {
      const report = departAndDevelop(season, season.rng, {
        userTeam: get().userTeam,
        training: get().coach.skills.training,
      });
      set({
        lastOffseason: report, phase: next,
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
  },

  spendSkill: (skill) => {
    const { coach, season, userTeam, version } = get();
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
    set({ coach: next, version: version + 1 });
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
      // A year passes for him too. Purely what the screen prints — nothing in
      // the simulation asks how old the coach is, and no year of a career plays
      // differently because of the number.
      const coach = { ...get().coach, age: get().coach.age + 1 };

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
        lastCommits: [],
        furthestPhase: 0,
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

    // Departures and development already ran, on the way into the draft step.
    // What is left is the half that needed a signed class to exist: the recruits
    // go on the roster, and walk-ons fill whatever the class did not.
    const filled = fillRosters(season, season.rng, {
      userTeam: get().userTeam,
    });
    const report: OffseasonReport = {
      ...(get().lastOffseason ?? {
        graduated: [], drafted: [], recruits: 0, signed: [], walkOns: [],
        developmentNet: 0, improved: 0, declined: 0, holes: [],
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
    set({ phase, overlay: null, selectedPlayer: null, version: get().version + 1 });
  },
  selectedPlayer: null,
  coach: newCoach(),
  lastReview: null,
  offers: [],

  clearReview: () => set({ lastReview: null }),

  acceptOffer: async (team) => {
    const { season, coach } = get();
    if (!season) return;
    // The new job's games are the ones worth keeping now.
    season.captureBoxFor = team;
    // A new job is a clean slate with a patient board, but your reputation
    // comes with you — that is the whole point of tracking it separately.
    const length = contractFor(season.teams[team]?.prestige ?? 50);
    const next = { ...coach, tenure: 0, security: 62, contractYears: length, contractLength: length };
    // The old program loses the in-game edge, the new one gains it.
    applyCoachMods(season, team, next);
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
    const mineMissing = (recorded: readonly { conference?: string; region?: string }[],
      key: string | null): boolean =>
      key !== null && !recorded.some((r) => r.conference === key || r.region === key);

    if (bracket.stage === 'conference'
      && mineMissing(bracket.cups, me ? me.conference : null)) {
      const mine = me ? conferenceField(season, me.conference) : null;
      if (me && mine && mine.field.includes(userTeam)) {
        // Kept if a reload already carries them: replaying the other seven
        // would roll fresh dice and quietly change who you are about to face.
        const cups = bracket.cups.length > 0 ? bracket.cups : conferenceIds(season)
          .filter((id) => id !== me.conference)
          .map((id) => conferenceTournament(season, id));
        set({
          bracket: { ...bracket, cups },
          myBracket: {
            kind: 'conference',
            state: startSeriesBracket(season, mine.field, conferenceLengths()),
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

    if (bracket.stage === 'regional'
      && mineMissing(bracket.regionals, me ? regionOf(me.conference) : null)) {
      const pairings = regionalPairing(season, bracket.cups);
      const mine = pairings.find((r) => r.seeds.includes(userTeam));
      if (mine) {
        // Every other region is decided now; yours is played a game at a time.
        // Already-decided ones are kept, for the same reason the cups are.
        const others = bracket.regionals.length > 0 ? bracket.regionals : pairings
          .filter((r) => r.id !== mine.id)
          .map((r) => ({
            ...singleElimination(season, r.seeds, REGIONAL_LENGTHS),
            region: r.id, name: r.name,
          }));
        set({
          bracket: { ...bracket, regionals: others },
          myBracket: {
            kind: 'regional',
            state: startSeriesBracket(season, mine.seeds, REGIONAL_LENGTHS),
            preplayed: new Map(),
          },
          version: version + 1,
        });
        return;
      }
      set({
        bracket: { ...bracket, regionals: stageRegionals(season, bracket.cups) },
        version: version + 1,
      });
      return;
    }

    if (bracket.stage === 'national' && bracket.national === null) {
      const champions = bracket.regionals.map((r) => r.champion);
      if (champions.includes(userTeam)) {
        const seeds = [...champions].sort((a, b) => {
          const ra = season.teams[a];
          const rb = season.teams[b];
          return (rb ? (rb.rw ?? rb.w) : 0) - (ra ? (ra.rw ?? ra.w) : 0);
        });
        set({
          myBracket: {
            kind: 'national',
            state: startSeriesBracket(season, seeds, NATIONAL_LENGTHS),
            preplayed: new Map(),
          },
          version: version + 1,
        });
        return;
      }
      const national = stageNational(season, bracket.regionals);
      set({
        bracket: { ...bracket, national },
        lastPostseason: summarize(bracket.cups, bracket.regionals, national),
        version: version + 1,
      });
    }
  },

  /** Leave a finished tier for the next one, which opens itself. */
  advanceBracket: () => {
    const { season, bracket, version } = get();
    if (!season || !bracket) return;

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

    set({ bracket: null, phase: 'awards', version: version + 1 });
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

    // The host and the arm are worked out exactly as the bracket would: home
    // alternates from the better seed through the series, and the starter is
    // chosen by how deep into the tournament that team already is.
    const h = hostOfGame(next.series, next.series.games.length);
    const a = h === next.a ? next.b : next.a;
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

    if (mode === 'game') {
      stepBracket(state, preplayed);
    } else if (mode === 'round') {
      // To the end of this round, however many nights that takes.
      const from = state.roundIndex;
      let guard = 0;
      while (!state.done && state.roundIndex === from && guard++ < 40) {
        stepBracket(state, preplayed);
      }
    } else {
      let guard = 0;
      while (!state.done && guard++ < 200) stepBracket(state, preplayed);
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
    const { state } = myBracket;
    if (!state.eliminated.includes(userTeam)) return;

    // The series that did it, so the modal can say where the year stopped. A
    // bracket cannot eliminate a team without one, but the fall back to the
    // last round keeps a malformed tree from producing a nameless round.
    const lost = state.rounds.flat().find(
      (s) => s.winner !== null && s.winner !== userTeam
        && (s.a === userTeam || s.b === userTeam),
    );
    set({
      knockout: {
        year,
        kind: myBracket.kind,
        round: lost ? lost.round : state.rounds.length - 1,
        rounds: state.rounds.length,
      },
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
    const mine = resultOf(myBracket.state);

    if (myBracket.kind === 'conference') {
      const me = season.teams[userTeam];
      const missed = me ? conferenceField(season, me.conference).missed : [];
      const cups: ConferenceTournament[] = [
        ...bracket.cups,
        { ...mine, conference: me ? me.conference : '', missed },
      ];
      // The tier does not move. Your tournament just finished and the result is
      // the thing to look at; leaving is the next press.
      set({
        bracket: { ...bracket, cups },
        myBracket: null, version: version + 1,
      });
    } else if (myBracket.kind === 'regional') {
      const me = season.teams[userTeam];
      const id = me ? regionOf(me.conference) : 'SOUTH';
      const name = REGIONS.find((r) => r.id === id)?.name ?? id;
      set({
        bracket: {
          ...bracket,
          regionals: [...bracket.regionals, { ...mine, region: id, name }],
        },
        myBracket: null, version: version + 1,
      });
    } else {
      set({
        bracket: { ...bracket, national: mine },
        lastPostseason: summarize(bracket.cups, bracket.regionals, mine),
        myBracket: null, version: version + 1,
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
        stepBracket(mb.state, mb.preplayed);
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
  loadError: null,

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
        myBracket: portableMyBracket(get().myBracket),
        knockout: get().knockout,
        postseasonSeen: get().postseasonSeen,
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
    // Saves made before the dynasty layer carry no coach at all, and saves made
    // before the profile carry one with no age or hometown on it. Both come back
    // filled in rather than refusing to load or rendering holes.
    const coach = restoreCoach(loaded.coach);
    // Restamped on every load rather than trusted from the save, so a save from
    // before the in-game skills were wired — or one that predates a job change —
    // comes up with the edge on the right program.
    applyCoachMods(loaded.season, loaded.userTeam, coach);
    const bracket = usableBracket(loaded.bracket);
    set({
      season: loaded.season,
      year: loaded.year,
      userTeam: loaded.userTeam,
      needsTeam: false,
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
      // Week recaps are not saved, and a stale one from the previous session
      // would sit over a board it does not describe.
      lastWeek: null,
      lastCommits: [],
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
