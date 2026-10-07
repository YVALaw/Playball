import { progressStaffProjects, projectCandidates, PROJECT_FOCUS, newSeasonWork, staffPicksSeasonWork, suggestedTargets, seasonGainFull, SEASON_GROUP_MAX, staffPickFor, type StaffPick } from '../engine/staffProjects.js';
import { recruitingPlan, programRecruitingPitch, delegateEffort } from '../engine/recruitingPlan.js';
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
  appliedStrategy,
  injuryClock, currentDay, startableSlot, shortRest, dayInTheLegs, seasonInTheArm, fitBench,
  createSeason, simNextDay, freezeFinalOrder, simSeason, seasonComplete, standings, nextSeason, rebuildNameIndex, rpi, rpiOrder,
  seasonLength, regularRecord, archiveSeason, recordSeasonMarks, nationalRank, onBase, slugging,
  recordCareerMarks, recordResult, restedFirst, closerFrom, seedTeams,
  rulesOf, configForRules, DEFAULT_RULES,
  type SeasonState, type TeamRecord, type SeasonRules,
} from '../engine/season.js';
import { activeIds, honoursByPlayer, inductees } from '../engine/hall.js';
import {
  recordCoachMarks, RECORDS, type RecordKey, type RecordMark,
} from '../engine/records.js';
import { armValue, overallOf } from '../engine/ratings.js';
import type { GameResult } from '../engine/game.js';
import { playerId } from '../engine/types.js';
import { isTwoWay, uniquePlayers } from '../engine/types.js';
import type {Arm, Hitter, Pitcher, Player, PlayerId, Position, Rng, Tactic } from '../engine/types.js';
import type { ClassYear, PitcherRole } from '../engine/types.js';
import {
  addToTeam, authorPlayer, editPlayer, findPlayer, grantMoney, grantRecruiting, renameProgram,
  reshuffleSchedule, setPrestige, setStaff, swapConferences, type PlayerPatch,
  healPlayer, setIronMan, movePlayer, cutPlayer, signPortalMan, setRedshirt, setAge,
  grantBadge, revokeBadge, makeTwoWayOf, unmakeTwoWay, authorProspect, setRecruitStars,
  setRecruitWants, commitRecruit, presetParity, presetChaos, presetSuperteam, setMood as setMoodOf,
  type BadgeId, type BadgeTier,
} from '../engine/godMode.js';
import { leagueName, setLeagueNames, usableLeagueNames } from '../engine/leagueNames.js';
import type { GodTarget } from '../ui/god/target.js';

/** One physical tap can arrive twice on touch hardware. Do not make Back reveal
 * the exact same God editor underneath itself. */
function sameGodTarget(a: GodTarget | undefined, b: GodTarget): boolean {
  if (!a || a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'tab': return b.kind === 'tab' && a.tab === b.tab;
    case 'player':
    case 'recruit': return b.kind === a.kind && a.id === b.id;
    case 'program': return b.kind === 'program' && a.team === b.team;
    case 'roster': return b.kind === 'roster' && a.team === b.team;
    default: return true;
  }
}
import { setStarGateOpen, type RecruitingPriorities } from '../engine/recruiting.js';
import { createLiveGame, type LiveGame } from '../engine/liveGame.js';
import { edgesFor, leversFor } from '../engine/coachEdges.js';
import {
  departAndDevelop, fillRosters, holesFor as rosterHoles, reinstate, walkOnShortfall, departureOdds, staffKeeps,
  type OffseasonReport,
} from '../engine/progression.js';
import {
  letHimGo, makeTheCase, sceneFrom, draftContextOf, type KeepPitch, type KeepScene,
} from '../engine/draft.js';
import {
  planStaffWeek, tendStaffList, suggestStaffList, staffWeekRng, STAFF_LIST_MAX,
} from '../engine/staffRecruiting.js';
import {
  newCoach, restoreCoach, reviewSeason, boardWords, jobOffers, rosterStrength, contractFor, playerBoard,
  startingOffers, ROOKIE_PRESTIGE,
  leagueShape,
  canBeHired,
  approachSchool, APPROACHES_PER_SEASON, CAUGHT_SECURITY_COST, type ApproachOutcome,
  prestigeStars, skillPoints, SKILLS, takeChair, bankStint, objectivesFor, resignationCost,
  type CoachState, type CoachSkills, type CoachProfile, type JobOffer, type Review,
  type SeasonOutcome, type Expectation,
} from '../engine/program.js';
import {
  runRivalYear, seatCoaches, syncCoachMods, coachFromAssistant, type CarouselMove, type FreeAgent,
} from '../engine/rivals.js';
import {
  retirementStatus, legacyScore, type Legend, type LegendStint, type LegendYear,
} from '../engine/retirement.js';
import {
  ACHIEVEMENTS, awardFirstOverall, awardSeason, awardTopRecruit, noFeats,
  type AchievementId,
} from '../engine/achievements.js';
import {
  markAllRead, markRead, newItem, push, restoreInbox, unreadCount, type InboxItem,
} from '../engine/inbox.js';
import {
  applyRealignment, headToHead, realignmentFor,
} from '../engine/world.js';
import { proCareer, type AlumnusNote } from '../engine/legacy.js';
import {
  annualBudget, freshEconomy, marketFor, poached, developAssistant, remaining, wageBill,
  withStaff, FACILITIES, MAX_FACILITY, SCOUT_COST, SCOUT_DAYS, SEATS,
  devBonus, armCareFor, buildingSpec, builtBonus, facilityEffects, facilityLevel,
  facilityUpgradeCost, FACILITY_MAX_LEVEL, pipelineStrength, addPipelineSigning, agePipelines,
  recruitingFacilityScore, DEFAULT_DIRECTIVE, staffPlan, projectFacility,
  staffProjectInjuryGuard, PIPELINE_MIN,
  SEAT_LABEL, BUILDINGS, type Assistant, type Economy, type StaffSeat, type Building,
  type StaffDirective, type StaffProjectKind,
} from '../engine/economy.js';
import {
  readJournal, writeJournal, noteAction, clearJournal, journalMatches, reconcileJournal,
} from './liveJournal.js';
import {
  DEFAULT_DEPTH, normalizeDepth, setMode, setSystem, handles,
  type DepthSettings, type DepthMode, type SystemKey,
} from './depth.js';
import {
  runPostseason, freezeRegularSeason, stageConferenceTournaments,
  stageRegionals, regionalPairing, summarize, onTheSameNights, STAGE_BREAK,
  startSeriesBracket, stepBracket, nextGameFor, resultOf, pairKey, hostOfGame,
  REGIONAL_LENGTHS, SERIES, regionOf, deAsResult, roundName,
  protectedTopFour, CONF_ADVANCE,
  seasonAwards, allConference, coachOfTheYear, ceremonyOf,
  conferenceField, conferenceIds, conferenceTournament, singleElimination, REGIONS,
  recordSchoolAnnals,
  selectNationalField, seatProtected, splitShowdown, bestOf, NATIONAL_BIDS,
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
  SCHOLARSHIPS, RECRUITING_BUDGET, MAX_PER_RECRUIT, RECRUITING_WEEKS, budgetFor, PITCH_COST,
  weeklyBudget, flexibleOffseasonBudget,
  aiTargets, weeklyPoints, closeWeek, resetWeeklySpend, canPursue, inPipeline,
  leadersAtWeekStart, totalWeekSpend, weekActionCost, majorActionCost,
  hasRecruitingRelationship, swayRecruit, planAiRecruitActions, availableRecruitPromises,
  askBlocked, askForCommitment, scholarshipsPledged,
  type RecruitingFactor, type RecruitMajorAction, type RecruitMajorInput, type Pitch,
  boardsByTier,
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
export function seedRivalInterest(
  season: SeasonState, userTeam: number,
  /**
   * Whether the coached programme is seeded too. True only when its board has
   * been handed to its coordinator.
   *
   * Measured 2026-09-12, in the app, on a real save: a delegated one-star
   * programme signed **three** men while the thirty three rivals within four
   * quality points of it averaged **6.85**. That is not "a bit worse", it is
   * broken, and the cause was here rather than in the handicap.
   *
   * These two passes run before the window opens and every rival gets them.
   * The coached programme is skipped, correctly, because a human coach's board
   * is his own to build and starting him with interest he did not earn would
   * hand him a week he never worked. But `aiTargets` is written for a staff
   * that HAS been seeded: its lost-causes filter walks away from any recruit
   * somebody else already leads, so a staff that opens on an empty board walks
   * away from nearly everybody and never starts. The two rules are a pair, and
   * giving a delegated coach one without the other is what produced the three.
   *
   * So a board the coordinator works is seeded the way his rivals' boards are,
   * and the handicap that makes him worse than his coach stays where it was
   * documented to be — in the size of his week, and nowhere else.
   */
  alsoSeedUser = false,
  /**
   * The coached programme's own pitch, pipelines and all, for a board its
   * staff works (2026-09-28). Without it the seed reads the programme the way
   * a rival's is read — home state only — and the staff that then works the
   * board reaches through the pipelines the seed never looked at.
   */
  userPitch?: Pitch,
): void {
  // Two passes, not one. A single pass leaves the top of the class half
  // covered — every board is picked against an empty field, so the elite
  // programs all converge on the same handful of names and the rest of the
  // five stars open the window with nobody on them. The second pass sees the
  // first pass's leaders and spreads to whoever is still uncovered. Its points
  // land at half weight: coverage comes from target selection, not point size,
  // and full weight would double the AI's head start over the player.
  for (const scale of [0.5, 0.25]) {
    const snapshot = leadersAtWeekStart(season.recruiting);
    for (const record of season.teams) {
      if (record.index === userTeam && !alsoSeedUser) continue;
      const pitch = record.index === userTeam && userPitch
        ? userPitch
        : pitchFor(season, record, regionOfTeam(season, record.index), developmentScore(record));
      seedPass(season, record, pitch, snapshot, scale, season.rng);
    }
  }
  // The spend is the AI's own; the player's budget is untouched.
  resetWeeklySpend(season.recruiting);
}

/**
 * One program's head start, for a chair that was the coached one when the
 * window opened and is a rival's now — the school a coach has just left.
 *
 * `seedRivalInterest` skips the coached programme, and `aiTargets` walks away
 * from a board nobody seeded (the three-against-6.85 measured above), so the
 * school he left recruited almost nobody the year after. Only while the
 * window is open, and only a board with no interest on it anywhere: the
 * seeding is additive.
 */
function seedLeftBehind(season: SeasonState, index: number): void {
  const record = season.teams[index];
  const week = season.recruiting.week;
  if (!record || week < 1 || week > RECRUITING_WEEKS) return;
  if (season.recruiting.prospects.some((p) => (p.points[index] ?? 0) > 0)) return;
  const pitch = pitchFor(season, record, regionOfTeam(season, index), developmentScore(record));
  for (const scale of [0.5, 0.25]) {
    seedPass(season, record, pitch, leadersAtWeekStart(season.recruiting), scale, season.rng);
  }
}

/** A program's region, off its conference. */
function regionOfTeam(season: SeasonState, teamIndex: number): Region {
  const rec = season.teams[teamIndex];
  const conf = CONFERENCES.find((c) => c.id === rec?.conference);
  return conf?.region ?? 'Gulf';
}

/**
 * One program's seeding pass: its board picked against the snapshot, and a
 * week's interest banked at `scale`. Points only; nothing lands in `spent`.
 * Returns how many men it banked interest on.
 */
function seedPass(
  season: SeasonState, record: TeamRecord, pitch: Pitch,
  snapshot: Record<string, number>, scale: number, rng: Rng,
): number {
  // His own coach, where the world has been seated with them: a program run
  // by a recruiter opens the window ahead of one that is not, which is the
  // same head start the user's own reputation buys him. Forty five and
  // twenty are what a chair with nobody in it is worth.
  const staff = record.coach;
  const board = aiTargets(
    record.index, pitch, staff?.prestige ?? 45, season.recruiting.prospects,
    holesFor(record), rng, snapshot,
    season.draft?.rivalSpend[record.index] ?? 0,
    0, 1, boardsByTier(season.teams.map((t) => prestigeStars(t.prestige))),
  );
  for (const { prospect, actions } of board) {
    prospect.points[record.index] =
      (prospect.points[record.index] ?? 0)
      + weeklyPoints(
        prospect, pitch, actions,
        staff?.prestige ?? 45, staff?.skills.recruiting ?? 20,
      ) * scale;
  }
  return board.length;
}

/**
 * Who will still be here when the class arrives, and how many will not.
 *
 * Until the draft step runs the departures, seniors and anyone likelier than
 * not to be drafted (`departureOdds`, the odds the draw is made against, his
 * season so far included) count as gone. Moved here from the board so the
 * staff's suggested list reads the same roster the board's needs do.
 */
export function classSurvivors(
  season: SeasonState, team: number, phase: Phase,
): { survivors: Player[]; leaving: number } {
  const rec = season.teams[team];
  const roster: Player[] = rec
    ? [...rec.team.lineup, ...rec.team.bench, ...rec.team.rotation, ...rec.team.bullpen]
    : [];
  const departed = phase !== null && PHASES.indexOf(phase) >= PHASES.indexOf('draft');
  const ctx = departed ? null : draftContextOf(season);
  const survivors = departed
    ? roster
    : roster.filter((p) => p.classYear !== 'SR' && departureOdds(p, season, ctx) < 0.5);
  return { survivors, leaving: roster.length - survivors.length };
}

/**
 * The list the staff would star for this program this week, sized to the
 * scholarships still open (and two spare). Empty outside the window and for a
 * full class. The board's "Use these" and the Season plan both read this.
 */
export function suggestedStaffList(
  season: SeasonState | null, userTeam: number, coach: CoachState, economy: Economy, phase: Phase,
): PlayerId[] {
  if (!season) return [];
  const rec = season.teams[userTeam];
  const recruits = season.recruiting;
  if (!rec || recruits.week < 1 || recruits.week > RECRUITING_WEEKS) return [];
  const signed = recruits.prospects.filter((p) => p.signedBy === userTeam);
  if (signed.length >= SCHOLARSHIPS) return [];
  const { survivors } = classSurvivors(season, userTeam, phase);
  const needs = walkOnShortfall(survivors, signed.map((p) => p.player));
  const pitch = programRecruitingPitch(season, rec, regionOfTeam(season, userTeam), coach.prestige, economy);
  const size = Math.min(STAFF_LIST_MAX, SCHOLARSHIPS - signed.length + 2);
  return suggestStaffList(recruits.prospects, userTeam, pitch, needs, recruits.week, size);
}

/** The shared empty list, so a selector with nothing starred returns one stable reference. */
const NO_STAFF_LIST: readonly PlayerId[] = Object.freeze([]);

/** The coach's staff list, in order. The stored array itself, or one shared empty one. */
export const staffListOf = (s: DynastyStore): readonly PlayerId[] =>
  s.season?.recruiting.staffList ?? NO_STAFF_LIST;

/**
 * The athletic director fills the empty seats, the day a chair is taken.
 *
 * A career that leaves the staff to its AD had its seats filled only at the
 * winter roll, so its whole first season, and every season after a move to a
 * school with holes, ran with nobody in them and nobody who could hire
 * (2026-09-29: "there are two positions empty and it wont let me click any of
 * them to try and hire them"). The same pick the roll makes — the best man the
 * market prices under what is left — signed the way a coach signs one.
 */
/**
 * What an athletic director keeps back when he hires: the price of the next
 * building, so the budget always has room for one thing a year. He hired the
 * best man he could afford at every seat, which took 58-89% of the money and
 * left nothing to build with, so the staff he hired could not do their season
 * work either (audit 17, M33). A flat share of the budget was tried first and
 * measured short at the bottom of the country: a one-star program kept under
 * $550k, below the cheapest building. Nothing is kept once every building is
 * finished.
 */
function buildReserve(eco: Economy): number {
  const next = BUILDINGS
    .map((b) => facilityLevel(eco, b.key) + 1)
    .map((lv, i) => (lv <= FACILITY_MAX_LEVEL ? facilityUpgradeCost(BUILDINGS[i]!.key, lv) : Infinity));
  const cheapest = Math.min(...next);
  return Number.isFinite(cheapest) ? cheapest : 0;
}
// Wages come round every year and a building is paid once, so the test is
// on a year's money: with this man on the books, is a building still in
// reach next year? And he has to be affordable today.
const adCanPay = (eco: Economy, prestige: number, wage: number): boolean =>
  remaining(eco, prestige) >= wage
  && annualBudget(prestige) + (eco.grant ?? 0) - wageBill(eco.staff) - wage >= buildReserve(eco);

function adFillsSeats(economy: Economy, seed: string, year: number, prestige: number): Economy {
  let eco = economy;
  for (const seat of SEATS) {
    if (eco.staff[seat]) continue;
    const man = marketFor(seed, year, seat)
      .filter((m) => adCanPay(eco, prestige, m.wage))
      .sort((a, b) => b.rating - a.rating)[0];
    if (!man) continue;
    const signed: Assistant = { ...man, joinedYear: year, until: year + 2 };
    eco = { ...eco, staff: { ...eco.staff, [seat]: signed } };
  }
  return eco;
}

/**
 * The athletic director staffs up now, wherever he runs the staff and a seat
 * is empty: a career loaded mid-season from a save written before he hired on
 * day one, and the staff handed to him in Settings. Nothing, where the coach
 * hires his own or every seat is filled.
 *
 * The review of 2026-09-29 found the reporter's own casual save would have
 * kept its empty seats all season: the row said "Your AD hires", and nobody
 * could.
 */
function adStaffsUp(get: () => DynastyStore, set: (patch: Partial<DynastyStore>) => void): void {
  const s = get();
  const season = s.season;
  const me = season?.teams[s.userTeam];
  if (!season || !me || s.jobSearch || handles(s.depth, 'assistants')) return;
  if (SEATS.every((seat) => s.economy.staff[seat])) return;
  const staffed = adFillsSeats(s.economy, String(season.seed ?? 0), s.year, me.prestige);
  if (staffed === s.economy) return;
  applyCoachMods(season, s.userTeam, s.coach, staffed);
  set({ economy: staffed, version: s.version + 1 });
}

/**
 * The staff takes the board over from the coach, mid-window.
 *
 * A board with no interest on it anywhere is seeded first, on the staff's own
 * generator (bug 1: a switch mid-season used to leave the staff walking away
 * from every man somebody else led). Then the week is planned — unless the
 * coach already planned it, in which case his week stands and the staff's
 * starts at the next open.
 */
function staffTakesTheBoard(get: () => DynastyStore): void {
  const s = get();
  const season = s.season;
  if (!season || s.busy || s.jobSearch) return;
  const week = season.recruiting.week;
  if (week < 1 || week > RECRUITING_WEEKS) return;
  // No seeding: the staff works only the men the coach stars (2026-09-30).
  get().staffPlanWeek();
}

/**
 * What one week of the recruiting board is worth to this program.
 *
 * Its own prestige tier, less whatever the draft phase has already spent
 * keeping people. Read through one function because two screens and one action
 * all have to agree about it: the board header prints it, the spend control
 * caps against it, and `recruit` refuses above it.
 */
/** This week's board budget. `extra` is god mode's standing grant, if any. */
export function boardBudget(season: SeasonState | null, userTeam: number, extra = 0): number {
  /*
    Two pools, and they do not touch.

    This passed June's draft and portal spending in and the comment said "one
    pool, three claims" — but `weeklyBudget` takes that argument and throws it
    away, and `recruiting-expansion.test.ts` pins that it does. The split was
    deliberate: a protected share signs the class, a flexible share pays for
    the draft and the portal. Passing a number nobody reads only made the next
    reader believe the opposite of what runs.
  */
  return weeklyBudget(prestigeStars(season?.teams[userTeam]?.prestige ?? 50))
    + Math.max(0, Math.round(extra ?? 0));
}


/** Build the user's expanded recruiting pitch from live program state. */
function userRecruitingPitch(
  season: SeasonState, userTeam: number, coach: CoachState, eco: Economy,
) {
  const record = season.teams[userTeam];
  const conf = CONFERENCES.find((c) => c.id === record?.conference);
  if (!record) return null;
  const fx = facilityEffects(eco);
  const dev = (FACILITIES[eco.facilities]?.devPitch ?? 0) + fx.pitch;
  return pitchFor(
    season, record, conf?.region ?? 'Gulf',
    Math.min(1, developmentScore(record) + dev),
    (state) => pipelineStrength(eco, state, record.def.state),
    { coachPrestige: coach.prestige, facilities: recruitingFacilityScore(eco) },
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

/** A healed injured player whose return has not yet been decided. */
function returnDecisionOpen(man: Player, day: number): boolean {
  const u = man as Player & { outUntil?: number; why?: string; returnDecided?: number };
  return u.why === 'injury' && u.outUntil !== undefined && day >= u.outUntil
    && u.returnDecided !== u.outUntil && day - u.outUntil < 14;
}

/**
 * A lineup/rotation decision that must be resolved before a full career advances.
 *
 * The hold stops the calendar, so it may only ever name a man the coach can
 * actually do something about. Every route out of it — `swapStarter`,
 * `assignPosition`, `promoteArm` — refuses an unavailable body, so a program
 * with nobody fit to come in was held for ever: a bench of four with two
 * redshirts and two men in the classroom, plus one hurt starter, and the
 * career could not reach tomorrow (05 §63.3). When there is genuinely nobody,
 * `coverFor` fields the man honestly and the day is allowed to pass, which is
 * the engine's own answer to the same question.
 */
function unresolvedRosterDecision(season: SeasonState, userTeam: number, depth: DepthSettings): Player | null {
  /*
    Only a decision the coach has a control for (audit 17, H8). A coach whose
    bench coach writes the card has no lineup edits, so a hurt starter held
    his calendar for good; his staff covers the man before the game instead.
    And a coach who writes his own card but handed injury replacements to the
    staff is not asked either: the cover is fielded the way `coverFor` fields
    one, which is what the switch promises.
  */
  const writesCard = handles(depth, 'lineups');
  if (!writesCard) return null;
  const team = season.teams[userTeam]?.team;
  if (!team) return null;
  const day = injuryClock(season);
  const active = new Set([...team.lineup, ...team.rotation].map((p) => String(p.id)));
  const spare = (pool: readonly Player[]): boolean =>
    pool.some((p) => !active.has(String(p.id)) && available(p, day));

  const unavailable = handles(depth, 'depthChart') && [...team.lineup, ...team.rotation].find((p) => {
    if (available(p, day)) return false;
    // A bat is covered from the bench, an arm from the pen. No cover, no ask.
    return team.lineup.includes(p as never)
      ? spare(squad(team))
      : spare(team.bullpen);
  });
  if (unavailable) return unavailable;

  /*
    And the man walking back in. Only for a coach who writes the card: the
    Needs card and both KEEP THE COVER strips are on the lineup screen, which
    a chart-only coach does not have, so holding him here stopped the day on
    a decision with no button (05 §63.3).
  */
  const back = squad(team).find((p) => !active.has(String(p.id)) && returnDecisionOpen(p, day));
  if (back) return back;
  /*
    And a card with a hole or a man twice: two catchers and nobody in left.
    The lineup screen's own guard held it only while the coach stood on that
    screen, so a relaunch, which lands on Home, simmed and played it as it
    was (audit 17, M105). Named by the second man wearing the label, or the
    first of the nine for a plain hole: either is a tap on the card.
  */
  const gaps = cardGaps(team.lineup);
  if (gaps.doubled.length > 0) {
    const seen = new Set<string>();
    const twice = team.lineup.find((m) => { if (seen.has(m.pos)) return true; seen.add(m.pos); return false; });
    if (twice) return twice;
  }
  if (gaps.missing.length > 0 && team.lineup.length > 0) return team.lineup[0]!;
  return null;
}

/** A roster change worth a card. See `rosterAlert`. */
export interface RosterAlert {
  kind: 'hurt' | 'fit';
  id: string;
  name: string;
  /** How long he is out, in the trainer's words, for a hurt man. */
  what?: string;
  /** Other men the same stretch hurt or brought back. */
  more: number;
  /** A simulated week stopped for it. */
  stopped?: boolean;
}

/** Who on the coach's roster is out hurt, and who is fit and waiting on his call. */
function rosterWatch(season: SeasonState, userTeam: number): { hurt: Set<string>; back: Set<string> } {
  const hurtIds = new Set<string>();
  const backIds = new Set<string>();
  const team = season.teams[userTeam]?.team;
  if (!team) return { hurt: hurtIds, back: backIds };
  const day = injuryClock(season);
  const active = new Set([...team.lineup, ...team.rotation].map((p) => String(p.id)));
  for (const p of [...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen]) {
    const id = String(p.id);
    if (isHurt(p, day)) hurtIds.add(id);
    else if (!active.has(id) && returnDecisionOpen(p, day)) backIds.add(id);
  }
  return { hurt: hurtIds, back: backIds };
}

/** The roster as it was last looked at, keyed to the career and year it belongs to. */
let rosterSeen: { key: string; hurt: Set<string>; back: Set<string> } | null = null;

/** Roughly how many bodies a program has to replace, which sizes its board. */
const holesFor = (record: { team: { lineup: unknown[]; bench: unknown[]; rotation: unknown[]; bullpen: unknown[] } }): number => {
  const roster = [
    ...record.team.lineup, ...record.team.bench,
    ...record.team.rotation, ...record.team.bullpen,
  ] as { classYear: string }[];
  return Math.max(3, roster.filter((p) => p.classYear === 'SR' || p.classYear === 'JR').length);
};
import type { Region } from '../data/schools.js';
import { cultureFor, type CultureEdge } from '../data/cultures.js';
import { note, earnedBadges, type HabitKey } from '../engine/habits.js';
import {
  openPortal, makeTheCase as portalCase, releaseFrom, signFromPortal, staffWorksPortal, rivalHolds, STAR_LINE,
  type PortalMan,
} from '../engine/portal.js';
import {
  chartFor, depthAt, reorder, squad, available, promotions, SPOTS, bestNine, healPositions,
  adoptSpot, restoreHome, settleReturn, cardGaps, coverFor,
} from '../engine/depthChart.js';
import {
  gradesOf, standing, failsThisWeek, suspend, haveAWord, driftGrades,
  WORDS_A_SEASON, atRisk,
} from '../engine/eligibility.js';
import {
  canRedshirt, redshirt, unRedshirt, redshirtCount, MAX_REDSHIRTS, staffRedshirts,
} from '../engine/redshirt.js';
import { movePosition, settleIn, secondaryPositions } from '../engine/positions.js';
import { withNav, frameOf, eraKey, nextVisit } from './era.js';
import { healUp, isHurt, prognosis } from '../engine/injury.js';
import { resetWorkload, legWeariness } from '../engine/workload.js';
import {
  settleMood, setMood, squadRanks, mood, moodOf, promiseOf, flightRisk,
  explicitRecruitPromiseBroken, promiseSpent, armShare, isArm,
} from '../engine/morale.js';
import { captainOf, candidates, roomsChoice, appoint, standDown, canLead } from '../engine/captains.js';
import { MAX_BADGES, badgeOf } from '../data/badges.js';
import { makeRng } from '../engine/rng.js';
import {
  autoBattingOrder, strategyFor, strategyForPhilosophy,
  DEFAULT_STRATEGY, type Strategy, type PhilosophyId,
} from '../engine/strategy.js';
import { opponentPlan } from '../engine/counters.js';
import { HOME_CONFERENCE, CONFERENCES } from '../data/schools.js';
import {
  saveDynasty, loadDynasty, listSaves, deleteSave, newSlotId, AUTOSAVE_SLOT,
  backupOf, backupSlotOf, isBackupSlot,
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

export type Tab = 'home' | 'team' | 'office' | 'program';

/** A screen laid over whatever frame the game is in. See `overlay` below. */
/** The settings screen's four pages, plus the list that leads to them. */
export type SettingsPage = 'index' | 'display' | 'sound' | 'play' | 'god' | 'about';

/**
 * Everything that can be laid over a frame. The rooms (see `Room`) are
 * overlays in their own right: the coach profile opened from the portrait,
 * the board from a letter, the staff room in the offseason. Each is one
 * layer with one history entry, and none of them borrows Program's frame.
 */
export type Overlay =
  'schedule' | 'standings' | 'rankings' | 'saves' | 'inbox' | 'book'
  | 'settings' | 'captain' | 'jobs' | Room;

/** A page of the program archive: its seasons and its record book. Alumni is a screen of its own. */
export type ArchiveSheet = 'seasons' | 'book';

/**
 * The offseason, as a sequence you are walked through rather than a set of tabs
 * you can wander into.
 *
 * Recruiting used to be a nav entry, which meant it was reachable in March and
 * meaningless in June — a screen whose whole point is a three week deadline,
 * available at all times and urgent at none. Every step here happens once, in
 * order, and the game does not go forward until you have done it.
 */
/**
 * A screen change that the outgoing screen is present for.
 *
 * ---------------------------------------------------------------------------
 * What was wrong
 * ---------------------------------------------------------------------------
 *
 * Reported after playing the iOS competition: *"one screen doesn't just appear
 * when we tap on another option, it does a transition."* Ours appeared.
 *
 * The cause is one attribute. `App` renders `<main key={phase ?? screen}>`, so a
 * screen change unmounts the old subtree and mounts the new one in the same
 * commit — there is no frame on which both exist. `.screen-in` then plays its
 * 260ms rise into an empty frame, which is a cut with a flourish on the end
 * rather than a transition. A native push has both screens on screen the whole
 * way, and that continuity is the entire effect.
 *
 * ---------------------------------------------------------------------------
 * Why a view transition rather than keeping both mounted
 * ---------------------------------------------------------------------------
 *
 * Keeping both screens alive would mean holding two subtrees, two scroll
 * positions and two sets of effects, and it would fight the remount the frame
 * depends on. `startViewTransition` snapshots the outgoing DOM instead, so both
 * are on screen without either being mounted twice. It works with the `key`
 * rather than against it.
 *
 * Supported in modern Android WebView, which is where this ships.
 *
 * ---------------------------------------------------------------------------
 * Two frames rather than flushSync
 * ---------------------------------------------------------------------------
 *
 * The API wants the DOM updated inside the callback. The usual way to make
 * React comply is `flushSync`, and the usual way to reach it is importing
 * `react-dom` — into the store, which has never imported a renderer and should
 * not start. Returning a promise that resolves after two animation frames gives
 * React the same guarantee from the outside: by the second frame the commit
 * this callback triggered has painted.
 *
 * Measured before writing any of this, because it is the thing that would make
 * it worse rather than better: the heaviest screen in the game commits in about
 * 40ms on a dev machine. A phone is three to five times slower on script, so
 * budget roughly 120–200ms there — still inside a transition nobody is waiting
 * on, and the reason this was safe to add at all.
 */
/*
  No history events any more (CL, 2026-09-30): the store only changes state.
  `nav.ts` reads the levels off it and `historySync.ts` keeps the browser's
  entries in step, so no action here spends or gives back an entry.
*/

/**
 * The next navigation swaps screens instantly, with no view transition.
 *
 * Set by the back gesture (App.tsx) before it restores the previous route:
 * the platform has already animated the swipe, the snapshot a view transition
 * takes of a heavy screen is where the gesture "janks from time to time"
 * (reported 2026-09-10), and a transition fighting the scroll restore under
 * it is how the screen "resets and starts from the top".
 */
let navInstant = false;

/**
 * The mark the stylesheet reads, and the other half of the same fix.
 *
 * Turning off the view transition still left `.screen-in` — the frame's own
 * 260ms rise on every arriving screen — to play after a swipe that had already
 * carried the page across. Reported 2026-09-10, globally: the gesture "does a
 * quick flick the screen".
 *
 * It comes off at the next forward navigation rather than a frame later,
 * because turning an animation back on is how you start it: clearing the mark
 * early would play the very rise it exists to prevent, on a screen that had
 * already finished arriving.
 */
function navMark(back: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (back) root.dataset.nav = 'back';
  else delete root.dataset.nav;
}

export function nextNavInstant(): void { navInstant = true; navMark(true); }

/**
 * `fn` once the frame being committed now has painted: two frames on, or
 * 100 ms on a page that runs none. With no document (node), at once. Used by
 * the two-step Resume (back plan V2, 2026-09-30).
 */
export function afterPaint(fn: () => void): void {
  if (typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') { fn(); return; }
  let done = false;
  const run = (): void => { if (!done) { done = true; fn(); } };
  requestAnimationFrame(() => requestAnimationFrame(run));
  setTimeout(run, 100);
}

/**
 * The next few hundred milliseconds belong to a back gesture.
 *
 * Stamps the root the way `nextNavInstant` does, without making the next
 * forward navigation instant: a layer the gesture peels -- a card, an
 * overlay -- starts no crossfade, but the screen it uncovers mounts with the
 * rises and fades every screen makes, and a rise on top of a swipe the
 * platform has already animated is the flick reported on 2026-09-16. The
 * stamp comes off by itself (05 §90.6).
 */
let backStamp: ReturnType<typeof setTimeout> | null = null;
export function markBackGesture(): void {
  navMark(true);
  if (backStamp !== null) clearTimeout(backStamp);
  backStamp = setTimeout(() => { backStamp = null; navMark(false); }, 700);
}

/**
 * Whether the browser is already capturing one of these.
 *
 * Measured in Chrome on 2026-09-10, with `startViewTransition` wrapped to log:
 * two calls in the same task print `start 0`, `start 1`, `callback-ran 0` —
 * and then nothing. The second transition is dropped, its update callback is
 * never invoked, and neither `updateCallbackDone` nor `finished` ever settles.
 *
 * Everything this app does on navigation lived inside that callback, so the
 * second navigation was silently thrown away while its history checkpoint had
 * already been pushed: two quick taps left the coach on the first screen with
 * a spare entry underneath him, and the next back press then walked somewhere
 * nobody asked for. Reported as the app "glitching" on 2026-09-10, globally.
 */
let vtInFlight = false;

/**
 * Which navigation is the current one.
 *
 * The insurance below fires on a timer, and a timer that has been overtaken
 * must not fire: a dropped transition whose screen was already replaced by the
 * next tap would otherwise drag the coach back to it a tenth of a second
 * later, which is a worse glitch than the one being fixed.
 */
let navGen = 0;

function crossfade(run: () => void): void {
  const gen = ++navGen;
  if (navInstant) { navInstant = false; run(); return; }
  navMark(false);
  const doc = typeof document === 'undefined' ? null : document;
  const start = (doc as unknown as {
    startViewTransition?: (cb: () => Promise<void> | void) => unknown;
  } | null)?.startViewTransition;

  /*
    No API, no DOM (the store is exercised in node by a thousand tests), or a
    player who has asked for less movement. `data-motion` is stamped on the root
    by devicePrefs; "system" defers to the media query, which is the same switch
    every other animation in the app honours.
  */
  const motion = doc?.documentElement.dataset.motion;
  const stopped = motion === 'reduced'
    || (motion !== 'full' && typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches);
  /*
    And a document that is not painting cannot finish one at all.

    A view transition suspends rendering of the whole page until its update
    callback's promise settles; the last painted frame stays on screen and
    nothing repaints. The insurance below is a 100ms timer — but the very
    condition it was written for, a WebView that has stopped serving animation
    frames, is also the condition under which a browser throttles timers to
    one a second. Measured 2026-09-12 on a non-rendering page: eight
    consecutive `setTimeout(…, 100)` fired at 781, 995, 1011, 993, 1009, 995,
    999 and 991ms, and `requestAnimationFrame` never fired at all.

    That is the two-second freeze reported the same day — "it got like frozen
    for 2 seconds and then took me to the program overview". So a navigation
    on a page that is not visible takes the plain path. There is nothing to
    decorate on a page nobody is looking at.
  */
  const unseen = !!doc && doc.visibilityState !== undefined && doc.visibilityState !== 'visible';
  // A second one over a live one is the dropped-callback case above: take the
  // navigation without the decoration rather than risk losing it.
  if (!start || !doc || stopped || unseen || vtInFlight) { run(); return; }

  /*
    `.screen-in` is the other half of this and must stand down while it runs.
    The frame puts a 260ms rise on every arriving screen, which was the whole
    of the old transition; left on, it plays inside the snapshot the API is
    already animating and the screen arrives twice. It stays in the stylesheet
    because it is still the fallback wherever there is no view transition to
    replace it — a browser without the API, or a player who turned motion off.
  */
  const root = doc.documentElement;
  root.dataset.vt = '1';
  vtInFlight = true;
  const done = (): void => { vtInFlight = false; delete root.dataset.vt; };
  /*
    The navigation itself, exactly once and never later than a frame budget.
    The transition may call this, or may never call anything at all; the state
    change is the point and the animation is the decoration, so the decoration
    does not get to decide whether the app moved.
  */
  let applied = false;
  const apply = (): void => {
    if (applied || navGen !== gen) return;
    applied = true;
    run();
  };

  const t = start.call(doc, () => {
    apply();
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        doc.removeEventListener('visibilitychange', finish);
        resolve();
      };
      requestAnimationFrame(() => requestAnimationFrame(finish));
      /*
        The third exit, for a transition that begins visible and is occluded
        before it ends — a notification shade, a task switch, the screen going
        off. Both of the others are frame- or timer-driven and both stop being
        served at exactly that moment, so without this the page stays frozen on
        its last frame until the coach comes back and the throttle lifts.
      */
      doc.addEventListener('visibilitychange', finish);
      /*
        A frame budget's worth of insurance, and it is not theoretical: a hidden
        or backgrounded WebView stops serving animation frames entirely. Found
        exactly that way — the transition never completed because the two frames
        never arrived. `run()` has already been called by then, so the state is
        correct either way; without this the transition simply never ends.
      */
      setTimeout(finish, 100);
    });
  }) as {
    finished?: Promise<unknown>;
    ready?: Promise<unknown>;
    updateCallbackDone?: Promise<unknown>;
  } | undefined;

  // `finished` resolves when the animation ends and rejects if it is skipped —
  // a second navigation landing on top of this one, which is a thing a thumb
  // does. Either way the attribute comes off, and the timer covers the case
  // where neither ever settles.
  // Outside the callback on purpose: the insurance inside it is no use when
  // the callback is the thing that never runs.
  setTimeout(apply, 100);
  if (t?.finished) void t.finished.then(done, done);
  /*
    And the other two promises are swallowed on purpose. A transition started
    while the document is hidden aborts with InvalidStateError, and the
    rejection lands on `ready` — a promise nothing here ever needed — as an
    uncaught error in the console, once per navigation, every time the app is
    driven in the background. The navigation itself is fine: `run()` already
    happened. Found by navigating a hidden pane and watching the console fill.
  */
  t?.ready?.catch(() => {});
  t?.updateCallbackDone?.catch(() => {});
  setTimeout(done, 600);
}

/**
 * A back move overtakes a crossfade the way a newer `go` does. Without this a
 * `go` still waiting on its capture ran after the back and undid it, with a
 * stop pushed on top (T fix, 2026-09-30).
 */
function supersedeNav(): void { navGen++; }

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
  ['awards', 'review', 'coach', 'draft', 'portal', 'signing'];

/**
 * Whether this world runs that step at all.
 *
 * `PHASES` stays the canonical list whatever the rules say, and its indices
 * stay fixed — `furthestPhase` is a number in a save file and a dozen callers
 * compare against `PHASES.indexOf`. A switched-off step is skipped on the way
 * past and hidden on the rail; it is never removed from the list.
 */
export const liveStep = (step: Exclude<Phase, null>, rules: SeasonRules): boolean =>
  step !== 'portal' || rules.portal;

/** The offseason as this world actually walks it. */
export const stepsFor = (rules: SeasonRules): Exclude<Phase, null>[] =>
  PHASES.filter((p) => liveStep(p, rules));

/** The step after this one, walking past anything the world turned off. */
export function stepAfter(phase: Exclude<Phase, null>, rules: SeasonRules): Phase {
  for (let at = PHASES.indexOf(phase) + 1; at < PHASES.length; at++) {
    const step = PHASES[at];
    if (step && liveStep(step, rules)) return step;
  }
  return null;
}

/** What each step is called on the rail across the top. */
export const PHASE_LABEL: Record<Exclude<Phase, null>, string> = {
  awards: 'Awards',
  review: 'Season review',
  coach: 'Coach points',
  draft: 'Draft',
  portal: 'Transfer portal',
  recruiting: 'Recruiting',
  signing: 'Signing day',
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
  { id: 'home', label: 'Home', screens: [
    { id: 'today', label: 'Today' }, { id: 'wire', label: 'News' }] },
  // Your players and how the team stands (2026-09-24). The SEASON tab went:
  // Home's wheel is the schedule now (the full list is an overlay), and the
  // conference and national tables are one screen with a switch. Strategy is
  // how this team plays, so it sits beside the lineup.
  { id: 'team', label: 'Team', screens: [
    { id: 'roster', label: 'Roster' }, { id: 'lineup', label: 'Lineup' }, { id: 'stats', label: 'Stats' },
    { id: 'stand', label: 'Standings' }, { id: 'strategy', label: 'Strategy' }] },
  // Running the program, every week: the rooms that used to hide as sheets
  // behind Program's overview, each a screen of its own.
  { id: 'office', label: 'Office', screens: [
    { id: 'recruiting', label: 'Recruiting' }, { id: 'staff', label: 'Staff' },
    { id: 'facilities', label: 'Facilities' }, { id: 'budget', label: 'Budget' }, { id: 'board', label: 'Board' }] },
  // What the program has become: the silverware, the seasons, the Hall, the
  // men who went on, and the rest of the country.
  { id: 'program', label: 'Program', screens: [
    { id: 'records', label: 'Overview' },
    { id: 'history', label: 'History' },
    { id: 'hall', label: 'Hall' },
    { id: 'alumni', label: 'Alumni' },
    { id: 'colleges', label: 'Colleges' }] },
];

/**
 * A room: a page of the office or the program with a home on a tab, or one
 * that only ever opens over something (the coach profile, the watchlist, the
 * recruiting network). `openRoom` shows it on its tab when the frame has a
 * nav and nothing is laid over the screen, and as an overlay otherwise.
 */
export type Room = 'staff' | 'facilities' | 'budget' | 'board' | 'network' | 'watchlist' | 'hall' | 'coach';

export const ROOM_HOME: Partial<Record<Room, { tab: Tab; screen: string }>> = {
  staff: { tab: 'office', screen: 'staff' },
  facilities: { tab: 'office', screen: 'facilities' },
  budget: { tab: 'office', screen: 'budget' },
  board: { tab: 'office', screen: 'board' },
  hall: { tab: 'program', screen: 'hall' },
};

/** Which room an overlay id is, when it is one. */
export const ROOMS: readonly Room[] = ['staff', 'facilities', 'budget', 'board', 'network', 'watchlist', 'hall', 'coach'];
export const isRoom = (o: string | null): o is Room => o !== null && (ROOMS as readonly string[]).includes(o);

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
  /**
   * June's calendar, kept beside the results (audit 17, H5, M76). The night
   * each stage opened, set once so a reload or a second visit cannot move it,
   * and the latest night any tournament you are not in reached, so the next
   * stage waits the break after the last of them rather than after yours.
   * Absent on saves from before: the stage then opens off today.
   */
  openNights?: Partial<Record<'conference' | 'regional' | 'national', number>>;
  lastNight?: number;
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
/**
 * What the national field still owes a team that has just been knocked out.
 *
 * `secure` is a protected top-four seed: `selectNationalField` adds every one
 * of them whatever June did to it, so the place is already his. `awaiting`
 * is a team inside the national table's bid range with the selection not yet
 * made — at-large bids come off `rpiOrder`, so losing a conference tournament
 * early does not settle anything. `none` is a team the table cannot reach.
 */
export type KnockoutBid = 'secure' | 'awaiting' | 'none';

export interface Knockout {
  year: number;
  kind: MyBracketKind;
  /** The round that ended it, already in words: "the losers final". */
  label: string;
  /**
   * Whether a national place survives this exit — which is a different
   * question from whether the tournament does.
   *
   * Reported by audit on 2026-09-11: a protected team eliminated in its own
   * conference tournament was handed "The season is over" while the national
   * selector was still guaranteeing it a seat. The conference branch decided
   * everything from a top-four placing and never asked about protection, and
   * the regional branch beside it had asked all along.
   */
  bid?: KnockoutBid;
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
  /** He resigned the chair at the meeting that closed this season, or just after it. */
  resigned?: boolean;
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
  /**
   * Say you are finished.
   *
   * Mid-season it is an announcement and the year plays out; with the season
   * already graded there is nothing left to play and it ends there.
   */
  announceRetirement: () => void;
  /**
   * Hand in his notice. With a season still to coach it is notice, and the June
   * meeting is his last here; with the season already graded he leaves today
   * for the job market. No take-backs. Costs `resignationCost` of the years
   * left, charged when the tenure ends. See `resignTerms`.
   */
  resign: () => Promise<void>;
  /** Put the career in the book and let go of the chair. */
  endCareer: () => Promise<void>;
  /** The next man, in the same world, with the doors your name opens. */
  startNewCoach: (
    profile: CoachProfile,
    made?: { skills: CoachSkills; badges: string[]; leans: Partial<Record<CultureEdge, number>>; ambition?: number },
  ) => Promise<void>;
  /** Take one. Ends the current tenure and starts a new one. */
  acceptOffer: (team: number) => Promise<void>;
  /** Close the board meeting. */
  clearReview: () => void;
  /**
   * The review card was dismissed while the winter still needs it: the year's
   * roll reads the verdict off `lastReview` to write next season's terms, so
   * in the offseason the card is hidden rather than the review thrown away
   * (audit 17, M74).
   */
  reviewDismissed: boolean;
  season: SeasonState | null;
  /** Index into season.teams. The program you coach. */
  userTeam: number;
  year: number;
  tab: Tab;
  screen: string;
  /** Bumped whenever the engine mutates in place. See the note at the top. */
  version: number;
  busy: boolean;
  /** The winter's report, held from the draft step to the next one, and saved with it. */
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
   * What the board asked for, stamped the day the season opened.
   *
   * The program page used to recompute this from the live roster on every
   * render, so the target moved as players developed. Reported from play,
   * word for word: "it was asking me for 18 wins, now it is saying 19" — and
   * the reporter asked whether he was imagining it. He was not. The board's
   * number is set in February and lives with it now, the same way `judge`'s
   * own comment demands one source of truth in front of the player.
   *
   * Stamped at `start`, at the year roll, and on taking a new job; read by the
   * program page, the halfway card and the June review, so the promise and the
   * verdict are the same numbers. Old saves load without one and are stamped
   * once on the way in — mildly drifted, then frozen.
   */
  boardAsk: Expectation | null;
  /**
   * Give a board that has no stamp one, once.
   *
   * A save that reaches the program page without an ask used to make the
   * screen recompute from the live roster on every render, so the mandate
   * crept upward as men developed — "it was asking me for 18 wins, now it is
   * saying 19". The number is settled the first time it is needed and held
   * from there.
   */
  stampBoardAsk: () => void;
  /**
   * Ask the board to reconsider what it wants, once a season.
   *
   * Returns the wins it came down by, or zero when it will not move. Built
   * to the case the reporter described rather than as a general haggle:
   * "if we are coming from a national championship year but most of our
   * good players leave, the board comes with unrealistic expectations — we
   * could talk them into better milestones." That case is measurable, so
   * the board concedes when last winter genuinely took the side apart and
   * declines when it did not. The full negotiation is stage 20b.
   */
  argueTerms: () => number;
  /** Whether the board has already heard it this season. */
  arguedTerms: boolean;

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
  /** Explicit bulk action. Opening a message marks only that message. */
  markInboxRead: (id: string) => void;
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

  /**
   * Begin a dynasty. Pass a team index to choose the job, and the profile the
   * creation step collected. Without the profile the career belongs to a man
   * called "Coach", which is the pre-v0.6.3 behaviour and what the tests use.
   */
  start: (
    seed?: number, team?: number, profile?: CoachProfile, mode?: DepthMode,
    /** What his background made of him. See `BACKGROUNDS` in `data/backgrounds.ts`. */
    made?: { skills: CoachSkills; badges: string[]; leans: Partial<Record<CultureEdge, number>> },
    /** A sandbox career. Chosen on the How-you-play step; never cleared. */
    godMode?: boolean,
    /**
     * The rules this world plays by — see `SeasonRules`. Set once, here, and
     * never written again: they are what the record book is comparable across.
     */
    rules?: SeasonRules,
    /**
     * Systems the creation step answered differently from the preset —
     * today the recruiting rule ("I run it / Staff runs it"). Left out, the
     * career follows its preset exactly.
     */
    overrides?: Partial<Record<SystemKey, boolean>>,
  ) => void;
  /** True before a job has been taken, so the app can show the setup screen. */
  needsTeam: boolean;
  go: (tab: Tab, screen?: string, focus?: string) => void;
  /**
   * Every nav tap, counted. Screens that keep local full-screen takeovers
   * (June, whose component never unmounts within its month) watch this and
   * stand them down — a nav tap is an instruction to leave wherever you
   * stand, even when the destination renders the same component.
   */
  navEpoch: number;
  /*
    The route trail, written by intent (back-plan T, 2026-09-30): `go` and
    `setScreen` record the route they leave, `goBack` takes the newest of this
    era's stops. Nothing reads it for history until the switch (SW). None of
    these is saved.
  */
  /** Routes left in the nav frames (season, June), oldest first, each with its era. */
  navTrail: NavStop[];
  /** The visit on screen: a fresh number per arrival, the stop's own on a back. */
  routeVisit: number;
  /** The visit `goBack` returned to, until the next forward move. */
  restoringVisit: number | null;
  /** The winter step this era began at; back walks the rail no lower. */
  stepBase: Phase;
  /** The rival school's card open over the screen, by team index. */
  teamCard: number | null;
  openTeamCard: (index: number) => void;
  closeTeamCard: () => void;
  /** Back to this era's newest stop; 'refused' on a broken nine (the pickbar shakes). */
  goBack: () => PeelResult;
  /** Out of a managed season game to Today; the game waits. */
  leaveGame: () => PeelResult;
  /** One winter step back along the rail, no lower than `stepBase`. */
  stepBack: () => PeelResult;
  /**
   * Trophies earned and not yet looked at. The PROGRAM tab wears a red dot
   * while any exist; opening the cabinet clears them. Replaced the
   * achievement letters at the reporter's ask — the cabinet is where they
   * live, so the dot points there instead of the inbox retelling them.
   */
  unseenTrophies: string[];
  /**
   * All-time marks taken since you last opened the book.
   *
   * The same grammar the cabinet uses: a dot on PROGRAM, then on the book,
   * then on the row itself, instead of a letter for every first-ever
   * anything in a young career.
   */
  unseenRecords: string[];
  clearUnseenRecords: () => void;
  clearUnseenTrophies: () => void;
  portalArrivals: string[];
  /**
   * The board, before the first pitch — one modal at the top of a new
   * season: last year's verdict, both prestige moves, the new asks and the
   * winter's stings. Null once accepted. Saved with the dynasty since
   * 2026-09-16: it was transient, and a phone that reloaded the page while
   * the card was up came back with no card and no way to accept the mandate
   * (05 §90.10).
   */
  seasonOpener: {
    year: number; headline: string; message: string;
    schoolBefore: number; schoolAfter: number;
    coachBefore: number; coachAfter: number;
    askSummary: string; askDetail: string; targetWins: number;
    stings: string[];
    /**
     * Men who would have played and left over the winter, graduated or
     * drafted: the case `argueTerms` puts to the board. Kept here because the
     * winter's own report is not saved, and a push back made after the app
     * was reopened met a board that saw nobody leave (2026-09-25).
     */
    departed?: number;
  } | null;
  dismissSeasonOpener: () => void;
  /**
   * The season whose plan was put to the coach at the chair he holds: the
   * year stamped when the Season plan closed. Null on a new career, a new job
   * and a save from before the sheet, each of which is owed one.
   */
  seasonPlanYear: number | null;
  /**
   * Close the Season plan for this season, by either of its buttons or any
   * dismissal. The defaults apply: the staff's own picks start on every idle
   * seat (`letStaffPick`), in every mode. Everything else on the sheet took
   * effect when it was tapped. Once a season; a second call does nothing.
   */
  closeSeasonPlan: () => void;

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
  /**
   * A first-time errand being taught, by lighting the path rather than
   * writing a paragraph. Designed by the reporter for the failing-man card:
   * "the action button should be glowing red in the borders, then school tab
   * should be glowing red, then have a word should be glowing." Transient
   * like focusPlayer; the once-ness lives in seenTutorials ('guide:word'),
   * stamped only when the word is actually had.
   */
  guide: 'word' | null;
  startGuide: (g: 'word') => void;
  clearGuide: () => void;
  /**
   * The other answer to "is he going back in?" — keep the cover, on purpose.
   * The first answer is putting him back, which every route into the nine
   * stamps by itself. See Unavailable.returnDecided.
   */
  keepCover: (id: PlayerId) => void;
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
  /**
   * Open whatever stage the bracket is on.
   *
   * Called on arrival with no argument, which draws the stage and stops. Called
   * with `true` by a press, which plays a tier the coach has no team in.
   */
  openStage: (advance?: boolean) => void;
  /**
   * The national stage's own sub-steps: field, opening, showdown, final.
   *
   * `advance` is a press rather than an arrival — see the note inside. A step
   * you are only watching resolves on a press and never behind your back.
   */
  openNationalStep: (advance?: boolean) => void;
  /** The half of the showdown you are not in, played alongside yours. */
  sideShow: { half: 'A' | 'B'; state: DoubleElim } | null;
  /**
   * One night of it, filed into the results when it finishes. `night` is the
   * night your own half just played, so the two halves share it rather than
   * each moving the calendar a day (audit 17, H5).
   */
  stepSideShow: (night?: number) => void;
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
  /**
   * Plays June forward. Synchronous by default; `paced` plays a night per
   * frame under `busy` and resolves when done (the screen's path).
   */
  simBracket: (mode: 'game' | 'round' | 'mine' | 'rest', paced?: boolean) => void | Promise<void>;
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
  /**
   * How many back presses a blocking card has refused. A counter, not a flag.
   *
   * Reported 2026-09-12, of the season opener: "the back gesture didn't work
   * from there either." It did not, and it was not supposed to — a blocking
   * card is the screen while it lasts and the press is swallowed by design
   * (see `blockingCardUp`). But *invisibly* swallowed is indistinguishable
   * from broken, and the coach had just watched the same gesture misbehave
   * twice on the way in, so "nothing happened" read as the third fault rather
   * than as a rule.
   *
   * A counter rather than a boolean because the card has to be able to answer
   * the second press as well as the first, and a flag that is already true
   * cannot. Transient: never persisted, never part of a save.
   */
  cardNudge: number;
  /** Tell the blocking card a press was refused, so it can say so. */
  nudgeCard: () => void;
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
  bringIn: (p: Arm) => void;
  /** Go and talk to him. Once per pitcher per outing, confidence only. */
  visitMound: () => void;
  /** The bench coach takes your pitching changes and visits, or hands them back. */
  setBenchCoach: (on: boolean) => void;
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
   * The layers underneath `overlay`, bottom first.
   *
   * `overlay` was a single value, so a letter that opened the board REPLACED
   * the inbox, and the back press from the board landed on whatever screen
   * the inbox had been over rather than on the inbox: a coach reading his
   * mail followed one letter and could not get back to the pile (06 §AE.2).
   * Each entry is a layer he opened and has not closed. A room opened from a
   * room (the budget's Staff door, in the offseason) stacks the same way, so
   * the back press walks them in the order he opened them.
   *
   * Session state: it describes what is open right now and never reaches a
   * save file.
   */
  overlayStack: { overlay: Overlay }[];
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
  /** A room, on its tab when the frame allows it and as an overlay otherwise. See `Room`. */
  openRoom: (room: Room) => void;
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

  /** Which page of the archive HISTORY opens on, so the overview can aim its doors. */
  historySheet: ArchiveSheet;
  setHistorySheet: (s: ArchiveSheet) => void;

  /** Whose card is open. Cleared when you navigate away. */
  selectedPlayer: PlayerId | null;
  /** The room a contextual shortcut wants the card to open on. */
  playerCardSection: 'overview' | 'stats';
  openPlayer: (id: PlayerId, section?: 'overview' | 'stats') => void;
  /** Close the card and return to whatever was underneath it. */
  closePlayer: () => void;

  /**
   * Whose coaching seat is open as a profile — a layer over the Budget's
   * staff view, the way a player card sits over a roster (2026-09-10: "tapping
   * on the coach card opens a profile with the coaching staff information and
   * decisions"). Cleared when you navigate away, and peeled by the back gesture.
   */
  coachSeat: StaffSeat | null;
  openCoach: (seat: StaffSeat) => void;
  closeCoach: () => void;

  /** Change one of your coaching policies. Takes effect on the next pitch. */
  setStrategy: <K extends keyof Strategy>(key: K, value: Strategy[K]) => void;
  /** Put raw recruiting effort on a recruit this week, or take it off. */
  recruit: (prospectId: PlayerId, actions: number) => void;
  /** One honest program strength can be emphasized each week. */
  recruitPitch: (prospectId: PlayerId, factor: RecruitingFactor | null) => boolean;
  /** One escalation per recruit/week: hard sell, visit, sway, or binding promise. */
  recruitMajor: (prospectId: PlayerId, action: RecruitMajorInput | null) => boolean;
  /** Bank the week, let recruits commit, and move to the next one. */
  advanceRecruitingWeek: () => void;
  /**
   * Whether the staff replaces a starred recruit who signs elsewhere with a
   * similar one. Per career; on by default. Acts at the next tending.
   */
  replaceLostRecruits: boolean;
  setReplaceLostRecruits: (on: boolean) => void;
  /**
   * Put the staff's week on the board, when the staff runs recruiting. Tends
   * the list every time; plans only a week nobody has planned, unless forced
   * (a list change replans the whole week). Idempotent. Does not save.
   */
  staffPlanWeek: (force?: boolean) => void;
  /**
   * Star a recruit for the staff, or unstar him. Refused (false) for a man
   * who is gone, out of reach, or when the list already holds eight.
   */
  starRecruit: (id: PlayerId) => boolean;
  /** Move a starred recruit one place up (-1) or down (1) the list. */
  moveStaffRecruit: (id: PlayerId, by: -1 | 1) => void;
  /** Replace the whole list: open, reachable men only, at most eight, in this order. */
  setStaffList: (ids: readonly PlayerId[]) => void;
  /** Close any recruiting weeks the regular-season calendar has passed. */
  syncRecruitingCalendar: () => void;
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
  /**
   * Put this man at this position, tonight and until somebody else takes it.
   *
   * The rail's second job — asked for as: "when you press on one and then
   * press on the player, the player is assigned to that position... in case
   * someone gets injured and you want your next best player here instead of
   * the one suggested by the engine." A man already in the nine trades labels
   * with the spot's holder; a bench man comes in for him. Returns false when
   * the man cannot play today.
   */
  assignPosition: (id: PlayerId, pos: Position) => boolean;
  /** Move a starter up or down the weekend rotation. */
  moveRotation: (index: number, delta: number) => void;
  /**
   * A pen arm into the rotation, the man he replaces sliding down.
   *
   * The pen used to be read-only on the lineup screen on the argument that
   * who comes IN is a game-night decision — true of the pen's order, and
   * nothing to do with staff roles. Reported from the phone: "I had a
   * freshman SP better than another one who's starting and it would not
   * let me bring him up from the bullpen." Same gates as swapStarter: no
   * hurt arm takes a rotation slot.
   */
  promoteArm: (penId: PlayerId, slot: number) => boolean;
  /**
   * Two pen arms trade places. The order is the coach's from then on:
   * the top man closes and the rest come in from the top (05 §91.1).
   */
  swapPen: (a: PlayerId, b: PlayerId) => boolean;
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
  /** A week of days, a day at a time with the screen let through between (H4). */
  simWeek: () => Promise<void>;
  /**
   * The man whose injury cut a simulated week short, if one did.
   *
   * Reported: a week should stop when it costs you somebody, not run to the
   * end and tell you afterwards. Read once by the card that says so.
   */
  weekStoppedBy: string | null;
  clearWeekStop: () => void;
  /**
   * A roster change the coach hears about the moment it happens, however the
   * day was played: a man newly hurt, or a hurt man fit again and waiting on
   * the coach's call (2026-09-24: "when a player gets injured I still want the
   * warning like the card warning, same thing once they are fit to return to
   * the lineup"). It used to exist only when SIM WEEK stopped, so a man hurt
   * in a simmed game, a coached game or June came with no card at all.
   * Session state, never saved.
   */
  rosterAlert: RosterAlert | null;
  clearRosterAlert: () => void;
  /** Look at the roster before time moves ('prime'), and say what changed after ('report'). */
  noteRoster: (mode: 'prime' | 'report', opts?: { stopped?: boolean }) => void;

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
  /** Two more years for a man whose contract is up, in the offseason only. */
  renewAssistant: (seat: StaffSeat) => boolean;
  /** Set the standing instruction for one assistant. */
  setStaffDirective: (seat: StaffSeat, directive: StaffDirective) => boolean;
  /** Start this season's work. A coordinator names a state; a coach names 1-3 of his men (none: the staff's suggestion). */
  startStaffProject: (seat: StaffSeat, kind: StaffProjectKind, state?: string, playerIds?: readonly string[]) => boolean;
  /** Stop the season's work; its weeks are lost (pipeline strength already added stays). */
  cancelStaffProject: (seat: StaffSeat) => void;
  /**
   * Let the staff pick its own season work on these seats (all by default):
   * seats with a man, a building at L1 or higher and nothing running. Works in
   * both modes. Returns the seats started. The Season plan's defaults.
   */
  letStaffPick: (seats?: readonly StaffSeat[]) => StaffSeat[];
  /** One rung up, paid once, forever. */
  /**
   * Put one of the three buildings up.
   *
   * Reported of the old ladder: "I would just build one of the buildings"
   * — there was only ever a next rung, so there was no question of which.
   * Returns false when it is already up or the money is not there.
   */
  build: (which: Building) => boolean;
  /** Deepen one facility's specialty from level one to three. */
  upgradeFacility: (which: Building) => boolean;
  /** Buy the book on one opponent, good for the next stretch of days. */
  scoutTeam: (team: number) => void;
  /**
   * Stage 23: bumped every time a navigation is refused because the nine
   * is short. The lineup screen re-presents its gate modal on each bump.
   */
  lineupGate: number;
  /** Stage 22: write one control of the playbook against a club. */
  setPlaybook: (abbr: string, key: keyof Strategy, value: Strategy[keyof Strategy]) => void;
  /** Fill the whole book from what the desk knows about them. */
  /** Builds the plan against them; returns how many rows moved, or null if there was nobody to plan against. */
  autoSetPlaybook: (abbr: string) => number | null;
  /** The club whose freshly-bought book is waiting to be set up. */
  playbookInvite: string | null;
  dismissPlaybookInvite: () => void;
  /** Which book the strategy screen has open. Null is the standing default. */
  playbookFocus: string | null;
  setPlaybookFocus: (abbr: string | null) => void;
  markTutorialSeen: (id: string) => void;
  /** Several at once — a tour step and the cards it stood in for — under one save. */
  markTutorialsSeen: (ids: readonly string[]) => void;
  /** Forget every tutorial, so the next visit to each screen teaches again. */
  resetTutorials: () => void;

  /**
   * How deep a game this career is. See `depth.ts` for the three rules that
   * keep this from becoming two games in one codebase — the first of which is
   * that none of it ever reaches the engine.
   */
  depth: DepthSettings;
  /**
   * God mode (05 §61). This career is a sandbox: set at creation, never
   * cleared. Every god action is a no-op unless it is on.
   */
  godMode: boolean;
  godEditPlayer: (id: PlayerId, patch: PlayerPatch) => boolean;
  godAddPlayer: (team: number, kind: 'hitter' | 'pitcher', opts?: { classYear?: ClassYear; pos?: Position; role?: PitcherRole }) => PlayerId | null;
  godSetPrestige: (team: number, prestige: number) => void;
  godRenameProgram: (team: number, school: string, nickname: string) => void;
  godSwapConferences: (a: number, b: number) => boolean;
  godSetCoach: (patch: { skills?: Partial<CoachSkills>; prestige?: number; skillPoints?: number }) => void;
  godSetStaff: (seat: StaffSeat, patch: { rating?: number; name?: string }) => void;
  godGrant: (kind: 'money' | 'recruiting', amount: number) => void;
  godReshuffleSchedule: () => boolean;
  /** A sandbox's league renames, by conference id. Empty otherwise. */
  leagueNames: Record<string, string>;
  godSetLeagueName: (id: string, name: string) => void;
  godHeal: (id: PlayerId) => void;
  godIronMan: (id: PlayerId, on: boolean) => void;
  godMovePlayer: (id: PlayerId, team: number) => boolean;
  godCutPlayer: (id: PlayerId) => boolean;
  godSignPortal: (id: PlayerId) => boolean;
  godSetMood: (id: PlayerId, mood: number) => void;
  godSetRedshirt: (id: PlayerId, on: boolean) => void;
  godSetAge: (id: PlayerId, age: number) => void;
  godGrantBadge: (id: PlayerId, badge: BadgeId, tier: BadgeTier) => void;
  godRevokeBadge: (id: PlayerId, badge: BadgeId) => void;
  godTwoWay: (id: PlayerId, on: boolean) => boolean;
  godAddRecruit: (kind: 'hitter' | 'pitcher') => PlayerId | null;
  godSetRecruitStars: (id: PlayerId, stars: number) => void;
  godSetRecruitWants: (id: PlayerId, weights: Partial<RecruitingPriorities>) => void;
  godCommitRecruit: (id: PlayerId) => void;
  godSetCoachMore: (patch: {
    badges?: string[]; philosophy?: PhilosophyId; contractYears?: number; contractLength?: number;
    security?: number; tenure?: number; habits?: Record<string, number>;
    /** The man himself and his record — the reporter's ask, September 6. */
    name?: string; age?: number; careerWins?: number; careerLosses?: number; titles?: number;
    conferenceTitles?: number; regionalTitles?: number; tournaments?: number;
  }) => void;
  godPreset: (kind: 'parity' | 'chaos' | 'superteam') => void;
  /** Copy the career into a new sandbox slot and load it; the original keeps a snapshot. */
  godForkToSandbox: () => Promise<boolean>;
  /**
   * The god-mode sheets open over the screen, as a stack: a man opened from
   * his program's roster steps back to the roster, not out (05 §61.5).
   */
  godStack: GodTarget[];
  /**
   * A managed game is being built. The guard used to be checked before the
   * one await inside starting a game, so two overlapping taps built two live
   * games and the second re-anchored the journal on a generator the first
   * had already moved (05 §62.1). Set before the await, cleared with the game.
   */
  liveStarting: boolean;
  openGod: (target: GodTarget) => void;
  closeGod: () => void;
  closeGodAll: () => void;
  setDepthMode: (mode: DepthMode) => void;
  setDepthSystem: (key: SystemKey, value: boolean) => void;

  /**
   * Write the dynasty down. `name` is what the saves list will call it; left
   * out, a save is filed under the school, which is what the autosave has
   * always been called.
   */
  saveNow: (slot?: string, name?: string) => Promise<boolean>;
  /** Asks for a save of this career soon: bursts become one write (M43). */
  autosave: () => void;
  /** Writes a pending autosave now, if there is one. */
  flushAutosave: () => void;
  loadSlot: (slot?: string) => Promise<boolean>;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  lastSaveError: string | null;
  /**
   * A failed season simulation, on its own channel.
   *
   * The audit's best engineering find: this used to ride `lastSaveError`,
   * so a crashed sim wore the NOT SAVED banner and its retry ran `saveNow`
   * — an action that could not fix anything. The season is only replaced on
   * success (the generation guard), so re-running the sim from the same
   * state is safe, and that is what the banner's tap does now.
   */
  simError: string | null;
  /** Why the save on disk could not be opened, if it could not. */
  loadError: string | null;
  /**
   * The slot that just refused to open, when an earlier copy of it is kept
   * (audit 17, M41): the screens that show `loadError` offer that copy.
   */
  backupFor: { slot: string; savedAt: number } | null;
  /** Open the kept earlier copy of a slot, which then carries on as that slot. */
  loadBackup: (slot: string) => Promise<boolean>;

  /**
   * Every dynasty on this device, newest first.
   *
   * Held in the store rather than fetched by the screen so that the actions
   * which change it — a save, a delete — can refresh it from one place. A list
   * that goes stale the moment you act on it is a list that offers to load a
   * save that is no longer there.
   */
  saves: SaveSummary[];
  /** The slot this career was loaded from, when it was not the autosave. */
  loadedSlot: string | null;
  /**
   * The front door is standing open.
   *
   * True until the player chooses a career to be in — which is the whole
   * point of the start screen. It also gives a deleted career somewhere to
   * go: the app used to resume the autosave on boot and never leave it, so
   * deleting the live slot "didn't really delete it" — `saveNow` defaults
   * to that slot and half the app calls it, so the next tap wrote the file
   * straight back.
   */
  atStart: boolean;
  /** Chosen a door. */
  leaveStart: () => void;
  /** Close the career and stand at the door again, writing nothing. */
  backToStart: () => void;
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
    ...(b.openNights && typeof b.openNights === 'object' ? { openNights: b.openNights } : {}),
    ...(typeof b.lastNight === 'number' ? { lastNight: b.lastNight } : {}),
  };
}

/**
 * The night a June stage opens. The conference stage opens on the first
 * night of June; each later stage opens STAGE_BREAK nights after the last game
 * anybody played in the one before, the coach's or anyone else's. Set once,
 * then read back.
 */
function openNightFor(
  season: SeasonState, bracket: PostseasonProgress, stage: 'conference' | 'regional' | 'national',
): number {
  const fixed = bracket.openNights?.[stage];
  if (fixed !== undefined) return fixed;
  const after = Math.max(currentDay(season), bracket.lastNight ?? 0);
  return stage === 'conference' ? after : after + STAGE_BREAK;
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

/**
 * What a season must look like before the app will play it (05 §62.6).
 *
 * The loader validates the schema version and nothing else, and the codec
 * backfills fields; nothing ever asked whether the shape was one the engine
 * could run. A team with no starting pitcher throws inside the first game,
 * and a throw inside a day loses the day for the whole country. Returns the
 * reason it refuses, or null.
 */
/**
 * What a season did to the men, settled once -- and settled before the
 * portal reads it.
 *
 * The settle used to run at the year roll, which is after the portal step in
 * the same offseason: the portal read a mood a full season stale, and on a
 * fresh career it read the untouched default, so the first winter had no
 * morale door at all -- none of the eighty-odd men in that pool went for a
 * reason (05 §62.8). It runs here, when the portal opens, on the season that
 * just finished; the roll skips it when the rail has been through the step.
 * The coached program's men are read against the promise and the room; the
 * ninety-five against playing time and winning, the way they always were.
 */
function settleTheMoods(season: SeasonState, userTeam: number, swing = 1): void {
  if (season.moraleSettled === true) return;
  for (const rec of season.teams) {
    const played = (rec.w ?? 0) + (rec.l ?? 0);
    const winPct = played > 0 ? (rec.w ?? 0) / played : 0.5;
    const ranks = squadRanks(rec.team);
    const mine = rec.index === userTeam;
    const leader = mine ? captainOf(rec.team) : null;
    // Nothing ever counted a pitcher playing, so every arm in the country took
    // a playing-time hit every February for a season he had in fact worked.
    const staff = [...rec.team.rotation, ...rec.team.bullpen];
    const outings = (id: PlayerId): number => season.pitching.get(id)?.g ?? 0;
    for (const p of uniquePlayers([...squad(rec.team), ...rec.team.rotation, ...rec.team.bullpen])) {
      const arm = isArm(p) ? armShare(p, staff, outings) : null;
      // A promise that has been judged for every season it covered comes off
      // him before this season is judged, so a one-year word is not held
      // against a junior.
      if (mine && promiseSpent(p.recruitPromise)) delete p.recruitPromise;
      const before = moodOf(p);
      const settled = settleMood(p, {
        starts: arm ? arm.starts : (p as Player & { starts?: number }).starts ?? 0,
        games: arm ? arm.games : played,
        squadRank: ranks.get(p.id) ?? 20,
        winPct,
        ...(mine ? {
          movedUnwillingly: (p as Player & { movedFrom?: string }).movedFrom !== undefined,
          promiseBroken: explicitRecruitPromiseBroken(p, {
            battingGames: season.batting.get(p.id)?.g ?? 0,
            pitchingGames: season.pitching.get(p.id)?.g ?? 0,
          }),
          damped: leader !== null,
        } : {}),
      });
      // PLAYERS' COACH: his room moves less of the way, good or bad (coachEdges.ts).
      setMood(p, mine && swing !== 1 ? before + (settled - before) * swing : settled);
      if (mine && p.recruitPromise) p.recruitPromise.judged = (p.recruitPromise.judged ?? 0) + 1;
    }
  }
  season.moraleSettled = true;
}

/**
 * Who a staff sits, for the ninety-five and for a coach who asked not to be
 * asked.
 *
 * `staffRedshirts` had no caller: casual's "your staff decides who sits a
 * year" was never kept, and no rival program ever redshirted anybody, so the
 * fifth year existed for one program in the country (05 §62.8). The rank is
 * his place at his own spot on the chart the program actually plays off; a
 * rotation arm is playing whatever his slot, and a reliever is measured from
 * the back of the pen, where a real staff finds the freshman it sits.
 */
function staffSitsTheFreshmen(season: SeasonState, userTeam: number, userDecides: boolean): void {
  for (const rec of season.teams) {
    if (rec.index === userTeam && userDecides) continue;
    const rank = new Map<PlayerId, number>();
    const place = (id: PlayerId, at: number): void => {
      rank.set(id, Math.min(rank.get(id) ?? Infinity, at));
    };
    const chart = chartFor(rec.team);
    for (const spot of SPOTS) (chart[spot] ?? []).forEach((id, i) => place(id, i));
    for (const p of rec.team.rotation) place(p.id, 0);
    rec.team.bullpen.forEach((p, i) => place(p.id, Math.max(0, i - 2)));
    staffRedshirts(rec.team, (p) => rank.get(p.id) ?? 9);
  }
}

function assertSeason(season: SeasonState, userTeam: number): string | null {
  if (!Array.isArray(season.teams) || season.teams.length === 0) return 'The save has no programs in it.';
  if (!Number.isInteger(userTeam) || !season.teams[userTeam]) return 'The save does not say which program is yours.';
  if (!Number.isFinite(season.scheduleRotation)) return 'The save has no schedule rotation.';
  if (!Number.isInteger(season.dayIndex) || season.dayIndex < 0 || season.dayIndex > season.schedule.length) {
    return 'The save is on a day the schedule does not have.';
  }
  /*
    The nine and the rotation are only promises while the season is in play.
    Between the draft step and the year roll the departures have already gone
    and the refill has not happened yet, so a program can legitimately stand
    with no starter — a save taken on the portal step showed exactly that.
  */
  const inPlay = !seasonComplete(season);
  const perConference = new Map<string, number>();
  for (const t of season.teams) {
    const units: Array<readonly Player[]> = [t.team.lineup, t.team.bench, t.team.rotation, t.team.bullpen];
    for (const unit of units) {
      const seen = new Set<string>();
      for (const p of unit) {
        if (seen.has(String(p.id))) return `${t.def.school} carries the same man twice.`;
        seen.add(String(p.id));
      }
    }
    if (inPlay && t.team.lineup.length < 9) return `${t.def.school} has fewer than nine in its lineup.`;
    if (inPlay && t.team.rotation.length < 1) return `${t.def.school} has no starting pitcher.`;
    perConference.set(t.conference, (perConference.get(t.conference) ?? 0) + 1);
  }
  for (const [id, n] of perConference) {
    if (n % 2 !== 0) return `The ${id} league has an odd number of programs.`;
  }
  return null;
}

/** The transfer pool, flattened to ids for the file. */
interface StoredPortalMan { id: string; from: number; fromName: string; cost: number; reason: string }
interface StoredPortal { leaving: StoredPortalMan[]; available: StoredPortalMan[]; spent: number }
type PortalPool = { leaving: PortalMan[]; available: PortalMan[]; spent: number };

function portablePortal(portal: PortalPool | null): StoredPortal | null {
  if (!portal) return null;
  const flat = (m: PortalMan): StoredPortalMan => ({
    id: String(m.player.id), from: m.from, fromName: m.fromName, cost: m.cost, reason: m.reason,
  });
  return { leaving: portal.leaving.map(flat), available: portal.available.map(flat), spent: portal.spent };
}

/**
 * The pool re-linked to the men the loaded season actually holds. A man who
 * cannot be found (a save from a build this one cannot read) is dropped
 * rather than invented; the rest of the pool survives.
 */
function usablePortal(raw: unknown, season: SeasonState): PortalPool | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<StoredPortal>;
  if (!Array.isArray(p.leaving) || !Array.isArray(p.available)) return null;
  const byId = new Map<string, Player>();
  for (const t of season.teams) {
    for (const man of [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen]) {
      byId.set(String(man.id), man);
    }
  }
  const relink = (list: unknown[]): PortalMan[] => {
    const out: PortalMan[] = [];
    for (const raw of list) {
      const m = raw as Partial<StoredPortalMan> | null;
      if (!m || typeof m.id !== 'string' || typeof m.from !== 'number') continue;
      const player = byId.get(m.id);
      if (!player) continue;
      out.push({
        player, from: m.from,
        fromName: typeof m.fromName === 'string' ? m.fromName : (season.teams[m.from]?.def.school ?? ''),
        cost: typeof m.cost === 'number' ? m.cost : 0,
        reason: typeof m.reason === 'string' ? m.reason : '',
      });
    }
    return out;
  };
  return { leaving: relink(p.leaving), available: relink(p.available), spent: typeof p.spent === 'number' ? p.spent : 0 };
}

function usableApproaches(raw: unknown): { tried: number[]; interest: number[] } {
  const a = raw as Partial<{ tried: unknown; interest: unknown }> | null;
  const nums = (x: unknown): number[] => (Array.isArray(x) ? x.filter((n): n is number => typeof n === 'number') : []);
  return { tried: nums(a?.tried), interest: nums(a?.interest) };
}

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
/**
 * The room names its own captain when the coach has handed captains over, as
 * the Settings row promises (audit 17, M35). Nothing read the switch, so a
 * casual career went without a captain for good. Only into an empty chair:
 * a man the coach named himself before handing it over keeps the C.
 */
function roomPicksLeader(get: () => DynastyStore): void {
  const { season, userTeam, depth } = get();
  if (!season || handles(depth, 'captains')) return;
  const team = season.teams[userTeam]?.team;
  if (!team || captainOf(team)) return;
  const pick = roomsChoice(team);
  if (pick) appoint(team, pick);
}

/**
 * 'Rotation and bullpen' handed to the pitching coach: the coach's hand-set
 * order stops binding, so the staff's rest-based order is the one used (M77).
 */
function staffTakesThePen(get: () => DynastyStore): void {
  const team = get().season?.teams[get().userTeam]?.team;
  if (!team) return;
  delete team.penByHand;
  delete team.rotationByHand;
}

/**
 * What a man on a wage has earned so far this year: the share of the regular
 * season played, and all of it once the season is over. Booked into `spent`
 * when he leaves, so the year's money is not paid twice (audit 17, M8).
 */
function wagesEarned(season: SeasonState, phase: Phase, wage: number): number {
  if (phase !== null || seasonComplete(season)) return wage;
  const played = season.schedule.length > 0 ? season.dayIndex / season.schedule.length : 0;
  return Math.round(wage * Math.max(0, Math.min(1, played)));
}

/** One turn of the event loop: lets the screen paint and taps land between chunks of a sim (H4). */
const breathe = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

/** The coach's points onto his strongest suit, one at a time (M72). */
function staffSpendsPoints(get: () => DynastyStore, set: (p: Partial<DynastyStore>) => void): void {
  const { coach, season, userTeam } = get();
  if (coach.skillPoints <= 0) return;
  const skills = { ...coach.skills };
  let points = coach.skillPoints;
  while (points > 0) {
    const open = SKILLS.filter((k) => skills[k] < 99);
    if (open.length === 0) break;
    const best = open.reduce((a, b) => (skills[b] > skills[a] ? b : a));
    skills[best] += 1;
    points -= 1;
  }
  const next = { ...coach, skills, skillPoints: points };
  if (season) applyCoachMods(season, userTeam, next, get().economy);
  set({ coach: next, version: get().version + 1 });
}

/** The staff's cases for the coach's drafted men, the rivals' way (M72). */
function staffAnswersTheClubs(get: () => DynastyStore): void {
  const { season, userTeam, coach } = get();
  const board = season?.draft;
  const record = season?.teams[userTeam];
  if (!season || !board || !record) return;
  const pending = board.men.filter((m) => m.outcome === 'pending');
  if (pending.length === 0) return;
  const survivors = [...record.team.lineup, ...record.team.bench, ...record.team.rotation, ...record.team.bullpen];
  const cases = staffKeeps(
    pending, (m) => sceneFor(season, userTeam, coach, m.player, m.round),
    survivors, prestigeStars(record.prestige), board.spent,
  );
  for (const c of cases) get().keepPlayer(c.man.player.id, c.kind, c.price);
}

/** The name each file was saved under, so a save keeps the one it has. */
const slotNames = new Map<string, string>();

/** The earlier copy to offer when `slot` will not open, if one is kept. */
async function offerBackup(slot: string): Promise<{ slot: string; savedAt: number } | null> {
  if (isBackupSlot(slot)) return null;
  try {
    const savedAt = await backupOf(slot);
    return savedAt === null ? null : { slot, savedAt };
  } catch {
    return null;
  }
}

function pendingFromJournal(
  season: SeasonState, year: number, slot: string,
): { home: number; away: number; line: string } | null {
  const j = readJournal();
  if (!j) return null;
  // Another slot's game is not this career's to throw away: opening a
  // different save must leave it for that save to offer back (audit M54).
  if (j.slot !== slot) return null;
  if (!journalMatches(j, slot, year, season.rng.state?.() ?? -1)) {
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
/**
 * A coaching-tree branch from before September 6 2026 knew its coach only by
 * name; the chair is matched by the assistant's id now. Stamp the id onto a
 * coach a legacy branch still names, once, so the name never decides again.
 */
function stampTreeChairs(season: SeasonState, economy: Economy): void {
  for (const branch of economy.tree ?? []) {
    if (season.teams.some((t) => t.coach?.fromAssistant === branch.id)) continue;
    const chair = season.teams.find((t) =>
      t.coach !== null && t.coach !== undefined && t.coach.fromAssistant === undefined && t.coach.name === branch.name);
    if (chair?.coach) chair.coach.fromAssistant = branch.id;
  }
}

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
  const buildings: Building[] = ['cage', 'pen', 'clubhouse'];
  const built = Array.isArray(e.built)
    ? e.built.filter((x): x is Building => buildings.includes(x as Building))
    : [];
  const facilityLevels: Partial<Record<Building, number>> = {};
  for (const b of buildings) {
    const raw = (e.facilityLevels as Partial<Record<Building, unknown>> | undefined)?.[b];
    if (typeof raw === 'number' && raw > 0) facilityLevels[b] = Math.min(FACILITY_MAX_LEVEL, Math.round(raw));
    else if (built.includes(b)) facilityLevels[b] = 1;
  }
  const tree = Array.isArray(e.tree)
    ? e.tree.filter((x): x is NonNullable<Economy['tree']>[number] => {
        if (!x || typeof x !== 'object') return false;
        const t = x as unknown as Record<string, unknown>;
        return typeof t.id === 'string' && typeof t.name === 'string'
          && typeof t.leftYear === 'number';
      })
    : [];
  const pipelines: NonNullable<Economy['pipelines']> = {};
  if (e.pipelines && typeof e.pipelines === 'object') {
    for (const [state, value] of Object.entries(e.pipelines)) {
      if (!value || typeof value !== 'object') continue;
      const q = value as unknown as Record<string, unknown>;
      if (typeof q.strength !== 'number') continue;
      pipelines[state] = {
        state,
        strength: Math.max(0, Math.min(100, q.strength)),
        signings: typeof q.signings === 'number' ? Math.max(0, Math.round(q.signings)) : 0,
        lastSignedYear: typeof q.lastSignedYear === 'number' ? q.lastSignedYear : 0,
        ...(typeof q.lastWorkedYear === 'number' ? { lastWorkedYear: q.lastWorkedYear } : {}),
      };
    }
  }
  const directiveValues = new Set<string>([
    'balanced','contact','power','discipline','command','velocity','armCare',
    'pipeline','stars','sleepers','needs',
  ]);
  const projectValues = new Set<string>([
    'hitting-contact','hitting-power','hitting-discipline',
    'pitching-command','pitching-velocity','pitching-arm-care',
    'pipeline-build','pipeline-deepen','pipeline-maintain',
  ]);
  const staffPlans: NonNullable<Economy['staffPlans']> = {};
  for (const seat of SEATS) {
    const raw = (e.staffPlans as Record<string, unknown> | undefined)?.[seat];
    if (!raw || typeof raw !== 'object') continue;
    const q = raw as Record<string, unknown>;
    const directive = typeof q.directive === 'string' && directiveValues.has(q.directive)
      ? q.directive as StaffDirective : DEFAULT_DIRECTIVE[seat];
    const plan: NonNullable<Economy['staffPlans']>[StaffSeat] = { directive };
    const project = q.project;
    if (project && typeof project === 'object') {
      const r = project as Record<string, unknown>;
      if (typeof r.kind === 'string' && projectValues.has(r.kind)
        && typeof r.weeksTotal === 'number' && typeof r.weeksLeft === 'number') {
        plan.project = {
          kind: r.kind as StaffProjectKind,
          ...(typeof r.targetCount === 'number' ? { targetCount: Math.max(1, Math.min(9, Math.round(r.targetCount))) } : {}),
          ...(typeof r.playerId === 'string' ? { playerId: r.playerId } : {}),
          ...(typeof r.odds === 'number' ? { odds: Math.max(0, Math.min(1, r.odds)) } : {}),
          ...(Array.isArray(r.targetIds) ? { targetIds: r.targetIds.filter((id): id is string => typeof id === 'string').slice(0, 10) } : {}),
          ...(typeof r.alignedWeeks === 'number' ? { alignedWeeks: Math.max(0, Math.min(r.weeksTotal, r.alignedWeeks)) } : {}),
          ...(typeof r.state === 'string' ? { state: r.state } : {}),
          // Season work (2026-09-28). Absent: a legacy project, finished the old way.
          ...(r.season === true ? { season: true as const } : {}),
          ...(typeof r.weeksRun === 'number' ? { weeksRun: Math.max(0, Math.min(RECRUITING_WEEKS, Math.round(r.weeksRun))) } : {}),
          ...(typeof r.from === 'number' ? { from: Math.max(0, Math.min(100, r.from)) } : {}),
          weeksTotal: Math.max(1, Math.round(r.weeksTotal)),
          weeksLeft: Math.max(0, Math.round(r.weeksLeft)),
          startedWeek: typeof r.startedWeek === 'number' ? Math.max(1, Math.round(r.startedWeek)) : 1,
        };
      }
    }
    staffPlans[seat] = plan;
  }

  return {
    facilities: Number.isInteger(e.facilities)
      ? Math.max(0, Math.min(MAX_FACILITY, e.facilities as number)) : built.length,
    built,
    facilityLevels,
    staff,
    staffPlans,
    projectHistory: Array.isArray(e.projectHistory) ? e.projectHistory.filter((r) => r && typeof r === 'object'
      && r.kind in PROJECT_FOCUS && SEATS.includes(r.seat) && typeof r.year === 'number' && typeof r.week === 'number'
      && Array.isArray(r.changes) && r.changes.every((c) => c && typeof c.name === 'string' && typeof c.attribute === 'string'
        && Number.isFinite(c.before) && Number.isFinite(c.after))).slice(0, 9) : [],
    tree,
    pipelines,
    spent: typeof e.spent === 'number' && e.spent >= 0 ? e.spent : 0,
    ...(typeof e.grant === 'number' && e.grant > 0 ? { grant: Math.round(e.grant) } : {}),
    ...(typeof e.recruitingGrant === 'number' && e.recruitingGrant > 0
      ? { recruitingGrant: Math.round(e.recruitingGrant) } : {}),
    scouted: e.scouted && typeof e.scouted === 'object'
      ? Object.fromEntries(Object.entries(e.scouted)
          .filter(([, v]) => typeof v === 'number')) as Record<number, number>
      : {},
  };
}

/**
 * His men who would have played and left over a winter: graduated, or drafted
 * and not kept. The report lists the whole country's departures (the draft
 * board is read off it), and the case put to the board counted all of them,
 * so every push back found seven hundred men gone and won the largest cut
 * there is (found 2026-09-25). It is his own side the board is asked about.
 */
function winterLosses(report: DynastyStore['lastOffseason'] | undefined, team: number): number {
  if (!report) return 0;
  const his = (d: { team: number }): boolean => d.team === team;
  return report.graduated.filter(his).length + report.drafted.filter((d) => his(d) && !d.returned).length;
}

/** The alumni book, from whatever an older save carries. */
/** The season opener as the save wrote it, or null for anything else. */
function usableOpener(raw: unknown): DynastyStore['seasonOpener'] {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o['year'] !== 'number' || typeof o['headline'] !== 'string' || typeof o['message'] !== 'string') return null;
  const num = (k: string): number => (typeof o[k] === 'number' ? (o[k] as number) : 0);
  const str = (k: string): string => (typeof o[k] === 'string' ? (o[k] as string) : '');
  return {
    year: o['year'], headline: o['headline'], message: o['message'],
    schoolBefore: num('schoolBefore'), schoolAfter: num('schoolAfter'),
    coachBefore: num('coachBefore'), coachAfter: num('coachAfter'),
    askSummary: str('askSummary'), askDetail: str('askDetail'), targetWins: num('targetWins'),
    stings: Array.isArray(o['stings']) ? o['stings'].filter((s): s is string => typeof s === 'string') : [],
    ...(typeof o['departed'] === 'number' ? { departed: o['departed'] } : {}),
  };
}

/** The season whose plan was put to the coach, or null (owed one) for anything else. */
function usableSeasonPlanYear(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) ? raw : null;
}

/**
 * The winter's report as the save wrote it, or null for anything else.
 *
 * Null when it is not a report at all, which is what a save from before it was
 * kept looks like too. A row that is not a whole departure, walk-on, badge or
 * hole is dropped rather than guessed at, and a missing count reads nought.
 */
function usableOffseason(raw: unknown): OffseasonReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o['graduated']) || !Array.isArray(o['drafted'])) return null;
  type Row = Record<string, unknown>;
  const rows = <T>(key: string, whole: (r: Row) => boolean): T[] => {
    const list = o[key];
    if (!Array.isArray(list)) return [];
    return list.filter((r): r is Row => !!r && typeof r === 'object' && whole(r as Row)) as unknown as T[];
  };
  const count = (key: string): number => {
    const v = o[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  };
  const classes: readonly unknown[] = ['FR', 'SO', 'JR', 'SR'];
  const reasons: readonly unknown[] = ['graduated', 'drafted', 'walk-on'];
  const departure = (d: Row): boolean =>
    typeof d['id'] === 'string' && typeof d['name'] === 'string'
    && typeof d['team'] === 'number' && typeof d['teamAbbr'] === 'string'
    && classes.includes(d['classYear']) && typeof d['age'] === 'number'
    && typeof d['overall'] === 'number' && reasons.includes(d['reason'])
    && (d['round'] === undefined || typeof d['round'] === 'number')
    && (d['returned'] === undefined || typeof d['returned'] === 'boolean');
  type Report = OffseasonReport;
  return {
    graduated: rows<Report['graduated'][number]>('graduated', departure),
    drafted: rows<Report['drafted'][number]>('drafted', departure),
    recruits: count('recruits'),
    signed: rows<Report['signed'][number]>('signed', (p) =>
      typeof p['id'] === 'string' && !!p['player'] && typeof p['player'] === 'object'),
    walkOns: rows<Report['walkOns'][number]>('walkOns', (w) =>
      typeof w['id'] === 'string' && typeof w['name'] === 'string'
      && typeof w['pos'] === 'string' && typeof w['overall'] === 'number'),
    developmentNet: count('developmentNet'),
    improved: count('improved'),
    declined: count('declined'),
    badges: rows<Report['badges'][number]>('badges', (b) =>
      typeof b['id'] === 'string' && typeof b['name'] === 'string' && typeof b['badge'] === 'string'
      && (b['tier'] === 1 || b['tier'] === 2 || b['tier'] === 3)),
    holes: rows<Report['holes'][number]>('holes', (h) =>
      typeof h['pos'] === 'string' && typeof h['count'] === 'number'),
  };
}

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

/**
 * A man standing on your roster is not an alumnus, whatever the book says.
 *
 * The book is written on the way into the draft step, before the coach has
 * talked anybody round, and until 2026-09-10 keeping a man left his note
 * standing — so a save from before that opened with two men in the alumni
 * archive who were also in the lineup. `keepPlayer` tears the note up now;
 * this heals the files written before it did, on the way in.
 */
function withoutRosterMen(
  notes: Record<string, AlumnusNote>, season: SeasonState | null | undefined, userTeam: number,
): Record<string, AlumnusNote> {
  const team = season?.teams[userTeam]?.team;
  if (!team) return notes;
  const here = new Set(
    [...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen].map((p) => String(p.id)),
  );
  const out: Record<string, AlumnusNote> = {};
  for (const [id, note] of Object.entries(notes)) if (!here.has(id)) out[id] = note;
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

/** Whether the staff replaces lost recruits: only an explicit false is off. */
const usableReplaceLost = (v: unknown): boolean => v !== false;

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

  const madeConferenceTournament = conferenceField(season, me.conference).field.includes(me.index);

  return {
    year,
    // The coach's overall record, June included; his career total counts the
    // same way now (audit 17, M60). The school's own book keeps the regular
    // season, which is what the load-time repair below relies on.
    w: me.w, l: me.l, cw: me.cw, cl: me.cl,
    confPlace: table.findIndex((t) => t.index === me.index) + 1,
    rpi: rpi(season, me.index),
    wonConference: champions.includes(me.index),
    finish: lastPostseason?.finish[me.index] ?? (madeConferenceTournament ? 'conference' : 'missed'),
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
/**
 * The AUTO press, as a function: the best nine, the order, the rotation.
 *
 * Pulled out of the action on 2026-09-15 so the roll can make the same deal
 * -- "every start of the season the app should automatically set the best
 * lineup just like if we went into lineup and tapped auto lineup" -- while
 * the store is busy and the button would refuse. The comments are the
 * button's; every report that shaped it applies to opening day as well.
 */
/**
 * How many seasons a man has actually coached.
 *
 * `tenure` counts the chair he is in and `history` counts finished seasons, and
 * the two tick a moment apart in the offseason — so the longer of them is the
 * only honest answer. The coach's own profile prints the same number.
 */
function careerSeasons(s: { history: SeasonRecord[]; coach: CoachState }): number {
  return Math.max(s.history.length, s.coach.tenure);
}

/**
 * Whether the man at the board meeting has coached his last game: he said so in
 * the spring, or the years have run out on him. See `engine/retirement.ts`.
 *
 * Read at the meeting, where his age is still the age he coached the season at
 * — the year rolls afterwards — so "over at seventy" means he finishes the
 * season he was seventy for.
 */
/**
 * Why a standing job offer cannot be taken right now, or null when it can.
 *
 * Taking a job swaps `userTeam`, and everything still in flight was the old
 * chair's: a managed game waiting in the dugout, a June bracket, an offseason
 * step's draft board or portal. Accepted in the middle of any of them, the
 * code that finishes the flow ran on the new chair — the waiting game was
 * recorded twice, a draftee kept by the old school joined the new roster, and
 * a season half-coached at one school was booked to the other (audit 17, C4).
 * So the door opens only between seasons: while the coach is out of work, or
 * before opening day, with nothing of the old chair's still running.
 */
/**
 * The portal without one man. A god move or cut takes a man off his roster,
 * but the open pool still listed him, and at the close another program signed
 * him: the same player on two rosters for good, or a cut man back to life
 * (audit 17, C2).
 */
function outOfPortal(portal: DynastyStore['portal'], id: PlayerId): Partial<DynastyStore> {
  if (!portal) return {};
  const keep = (m: PortalMan): boolean => m.player.id !== id;
  if (portal.available.every(keep) && portal.leaving.every(keep)) return {};
  return { portal: { ...portal, available: portal.available.filter(keep), leaving: portal.leaving.filter(keep) } };
}

export function jobOfferBlock(s: Pick<DynastyStore,
  'live' | 'pendingGame' | 'liveStarting' | 'busy' | 'jobSearch' | 'bracket' | 'myBracket' | 'phase' | 'season'>,
): string | null {
  if (s.live || s.pendingGame || s.liveStarting) return 'Finish the game in progress first.';
  if (s.busy) return 'Wait for the sim to finish.';
  if (s.jobSearch) return null;
  if (s.bracket || s.myBracket || s.phase !== null) return 'You can change jobs once the winter is over.';
  if ((s.season?.dayIndex ?? 0) > 0) return 'You can change jobs after this season.';
  return null;
}

export function careerFinished(s: {
  history: SeasonRecord[]; coach: CoachState; year: number;
}): boolean {
  if (s.coach.retiredYear !== undefined) return false;
  if (s.coach.farewellYear === s.year) return true;
  return retirementStatus({ age: s.coach.age, seasons: careerSeasons(s) }) === 'over';
}

/**
 * The offseason's season has been through the June meeting: the review is in
 * hand, the year is in the book, or the rail is already past the review step
 * (a save from before the grading was written can land there with neither).
 */
function seasonGraded(s: {
  phase: Phase; lastReview: Review | null; history: SeasonRecord[]; year: number; furthestPhase: number;
}): boolean {
  if (s.phase === null) return false;
  const review = PHASES.indexOf('review');
  return s.lastReview !== null
    || s.history.some((h) => h.year === s.year)
    || PHASES.indexOf(s.phase) > review
    || s.furthestPhase > review;
}

type ResignState = Pick<DynastyStore,
  'season' | 'coach' | 'year' | 'phase' | 'lastReview' | 'history' | 'jobSearch' | 'furthestPhase'>;

/**
 * The years will call it at this year's meeting, read before it: the season in
 * hand is not in the book yet, so an ungraded year counts it. Age needs no look
 * ahead — it rolls after the meeting. Retirement wins over a resignation, so a
 * man in his last season is never offered a price and a market he will not get.
 */
function careerEndsAtMeeting(s: ResignState): boolean {
  if (careerFinished(s)) return true;
  if (s.coach.retiredYear !== undefined || seasonGraded(s)) return false;
  return retirementStatus({ age: s.coach.age, seasons: careerSeasons(s) + 1 }) === 'over';
}

/**
 * He has handed in his notice and it still stands as a resignation: no farewell
 * or finished career has overtaken it, and he is not already on the market.
 * The coach page's callout and the Board's signpost row both read this.
 */
export function resignPending(s: ResignState): boolean {
  return s.coach.resignYear === s.year
    && s.coach.farewellYear === undefined && s.coach.retiredYear === undefined
    && !s.jobSearch && !careerEndsAtMeeting(s);
}

/**
 * Contract years he walks out on if he resigns now: the years after the season
 * he leaves in. Before the meeting `contractYears` still counts this season.
 */
export function resignYearsLeft(s: ResignState): number {
  return seasonGraded(s)
    ? Math.max(0, s.coach.contractYears)
    : Math.max(0, s.coach.contractYears - 1);
}

/**
 * Whether he can resign, and what it means today; null when he cannot.
 *
 * 'notice' while a season is still to be coached — the spring, or an offseason
 * whose meeting has not graded it — and the meeting is his last. 'now' once it
 * has, and he goes today. Retirement wins over it: a farewell, a finished
 * career or the years calling it hide the door. Not gated on `busy`, so the
 * control does not blink out during a sim; `resign` refuses then instead.
 *
 * A new object each call: select its fields, never the whole thing.
 */
export function resignTerms(s: ResignState): { when: 'notice' | 'now'; years: number; cost: number } | null {
  if (!s.season || s.jobSearch) return null;
  if (s.coach.retiredYear !== undefined || s.coach.farewellYear !== undefined) return null;
  if (s.coach.resignYear === s.year) return null;
  if (s.lastReview?.fired) return null;
  if (careerEndsAtMeeting(s)) return null;
  const years = resignYearsLeft(s);
  return { when: seasonGraded(s) ? 'now' : 'notice', years, cost: resignationCost(years) };
}

// ---------------------------------------------------------------------------
// The route trail's reads (back-plan T, 2026-09-30)
// ---------------------------------------------------------------------------

/** A route left behind: where it was, which visit, and the era it belongs to. */
export type NavStop = { tab: Tab; screen: string; visit: number; era: string };

/** What one back press did: took a level, was held, or found nothing to take. */
export type PeelResult = 'peeled' | 'refused' | 'none';

/**
 * The broken nine holds the door: the lineup is on screen, the card is the
 * coach's to fix, and it has a hole or a man twice. One read for `go`,
 * `setScreen`, `openOverlay` and `goBack`, the same `cardGaps` the lineup's
 * own warning prints from.
 */
export function lineupHolds(s: Pick<DynastyStore, 'screen' | 'depth' | 'season' | 'userTeam'>): boolean {
  if (s.screen !== 'lineup' || !handles(s.depth, 'lineups')) return false;
  const team = s.season?.teams[s.userTeam]?.team;
  if (!team) return false;
  const gaps = cardGaps(team.lineup);
  return gaps.missing.length > 0 || gaps.doubled.length > 0;
}

/**
 * The offseason rail as this career walks it. A career that ends at this
 * meeting, or a tenure he has resigned, stops at the review: no draft and no
 * signing day come after it. App's StepRail and `stepBack` both read this.
 */
export function railSteps(s: Pick<DynastyStore, 'season' | 'history' | 'coach' | 'year'>): Exclude<Phase, null>[] {
  const all = stepsFor(rulesOf(s.season));
  return careerFinished(s) || s.coach.resignYear === s.year ? all.slice(0, all.indexOf('review') + 1) : all;
}

/**
 * A step that has already happened and cannot be stood on again. Only the
 * portal: leaving it closes the national window for everybody and drops the
 * pool, so a walk back used to land on a blank step, and a save taken there
 * reopened a second window with the budget refilled (audit 17, H7).
 */
export function closedStep(s: Pick<DynastyStore, 'furthestPhase' | 'portal'>, step: Exclude<Phase, null>): boolean {
  return step === 'portal' && s.portal === null && s.furthestPhase > PHASES.indexOf('portal');
}

/** This era's stops, oldest first. Other eras' stay in the trail and are not walked. */
export function eraStops(s: DynastyStore): NavStop[] {
  const era = eraKey(s);
  return s.navTrail.filter((x) => x.era === era);
}

/**
 * The winter steps back can take: each rail step after `stepBase`, up to the
 * step on screen. Derived, never pushed, so a rail tap backwards cannot leave
 * a step for back to walk forward into. No base yet means the rail's first.
 */
export function stepStops(s: DynastyStore): Exclude<Phase, null>[] {
  if (frameOf(s) !== 'winter' || s.phase === null) return [];
  const rail = railSteps(s);
  const at = PHASES.indexOf(s.phase);
  const base = PHASES.indexOf(s.stepBase ?? rail[0] ?? 'awards');
  return rail.filter((p) => PHASES.indexOf(p) > base && PHASES.indexOf(p) <= at);
}

/** Where a move lands the trail: the stop it leaves and a fresh visit, or nothing. */
function trailStep(s: DynastyStore, tab: Tab, screen: string): Partial<DynastyStore> {
  const frame = frameOf(s);
  if (frame !== 'season' && frame !== 'june') return {};
  // June Home ignores `screen`: all of it is one route.
  const key = (t: Tab, sc: string): string => (frame === 'june' && t === 'home' ? 'home' : `${t}|${sc}`);
  if (key(s.tab, s.screen) === key(tab, screen)) return {};
  // The game is a level over the route, never a stop, going in or coming out.
  const box = s.screen === 'box' || screen === 'box';
  return {
    navTrail: box ? s.navTrail : [...s.navTrail, { tab: s.tab, screen: s.screen, visit: s.routeVisit, era: eraKey(s) }],
    routeVisit: nextVisit(),
    restoringVisit: null,
  };
}

/**
 * A move in a nav frame shuts every page laid over the route, in the same
 * write (PF, 2026-09-30). WeekStopped's "Set the lineup" moved the route
 * under an open Schedule, and the coach fixed nothing he could see (C20).
 */
function overlaysShut(s: DynastyStore): Partial<DynastyStore> {
  const frame = frameOf(s);
  if (frame !== 'season' && frame !== 'june') return {};
  if (s.overlay === null && s.overlayStack.length === 0 && s.settingsPage === 'index') return {};
  return { overlay: null, overlayStack: [], settingsPage: 'index' };
}

/**
 * The career, written down for good.
 *
 * Everything a plaque or a ranking will ever want is copied in rather than
 * referenced, because the `CoachState` it is read from is thrown away the
 * moment a successor takes a chair, and the seasons in `history` go with him.
 * The score is frozen here for the same reason the hall freezes a plaque: a
 * book that re-scored itself would re-order men who are not around to earn
 * their place again.
 */
function legendFrom(s: {
  coach: CoachState; history: SeasonRecord[]; year: number;
  season: SeasonState | null; userTeam: number;
}, ending: Legend['ending']): Legend {
  const here = s.season?.teams[s.userTeam]?.def.school;
  // History names schools in full; the career book files players by their
  // letters. Resolved once, here, while the world still has both.
  const abbrOf = (school: string): string =>
    s.season?.teams.find((t) => t.def.school === school)?.def.abbr ?? '';
  const stints: LegendStint[] = [];
  const years: LegendYear[] = [];
  for (const row of s.history) {
    const school = row.school ?? here ?? 'A program';
    const abbr = abbrOf(school);
    const last = stints[stints.length - 1];
    const title = row.finish === 'champion' ? 1 : 0;
    if (last && last.school === school) {
      last.to = row.year; last.w += row.w; last.l += row.l; last.titles += title;
    } else {
      stints.push({ school, abbr, from: row.year, to: row.year, w: row.w, l: row.l, titles: title });
    }
    years.push({
      year: row.year, school, w: row.w, l: row.l,
      finish: row.finish, wonConference: row.wonConference,
      ...(abbr ? { abbr } : {}),
      // Copied rather than looked up later: the awards live on the history
      // row, and the history goes when a successor is made.
      ...(row.awards && row.awards.length > 0 ? { awards: row.awards.map((a) => ({ ...a })) } : {}),
    });
  }
  // What the last program became while he had it, for the builder's ending.
  const chair = s.season?.teams[s.userTeam];
  const seasons = careerSeasons(s);
  const coach = s.coach;
  return {
    name: coach.name,
    you: true,
    from: s.history[0]?.year ?? s.year,
    // The year he finished in, not the last year that got a row: a season the
    // record book never graded is still a season he coached.
    to: Math.max(s.history[s.history.length - 1]?.year ?? s.year, s.year),
    age: coach.age,
    seasons,
    careerWins: coach.careerWins,
    careerLosses: coach.careerLosses,
    titles: coach.titles,
    conferenceTitles: coach.conferenceTitles,
    regionalTitles: coach.regionalTitles,
    tournaments: coach.tournaments,
    stints,
    score: legacyScore({ ...coach, seasons }),
    ending,
    homeState: coach.homeState,
    look: coach.look,
    ...(coach.badges && coach.badges.length > 0 ? { badges: [...coach.badges] } : {}),
    years,
    // The most any program of his gained while he had it. `bestBuild` carries
    // the earlier chairs; the arithmetic below covers the one he is in.
    built: Math.max(
      coach.bestBuild ?? 0,
      chair ? Math.round(chair.prestige - coach.arrivedPrestige) : 0,
    ),
  };
}

/**
 * What the last man is worth to the next one.
 *
 * The successor is a rookie — twenty in every skill, no record, nothing of his
 * own — and the only thing he has is whose staff he came off. That is worth a
 * few points of standing and no more. Thirteen at the very top puts him at 38,
 * which is the three-star rung of `requiredCoachPrestige` exactly: a legendary
 * mentor opens the three-star band to him and can never open a four. A modest
 * career is worth two or three, which is the honest value of a good reference.
 */
function legacyHeadStart(score: number): number {
  return Math.max(0, Math.min(13, Math.round(score / 45)));
}

/**
 * The year, into the books: the career lines, the marks, the coaching marks.
 *
 * Idempotent to a man — a season already in a career is not written twice and a
 * mark has to be beaten rather than equalled — so it can run at the draft step
 * and again on the paths that never reach it.
 */
function bookTheYear(get: () => DynastyStore): void {
  const s = get();
  const season = s.season;
  if (!season) return;
  const year = s.year;
  archiveSeason(season, s.userTeam, year);
  recordSeasonMarks(season, year);
  recordCareerMarks(season, year);
  if (season.records) {
    const chair = season.teams[s.userTeam];
    if (chair) recordCoachMarks(season.records, year, s.coach, chair.def.abbr);
    for (const t of season.teams) {
      if (t.coach) recordCoachMarks(season.records, year, t.coach, t.def.abbr);
    }
  }
}

/**
 * The league's winter: everybody who is leaving leaves, everybody who stays
 * gets a year better or worse, and your own departures become alumni.
 *
 * `departAndDevelop` is emphatically not idempotent — run twice it graduates a
 * second class out of rosters that already lost one, and rebuilds the draft
 * board over decisions the coach has already paid for — so it is guarded by
 * `furthestPhase`, the one number in the offseason that only moves forward.
 *
 * Called from the draft step, where a coach walks through it, **and from the
 * two exits that never reach that step**: a sacking and a retirement. Without
 * the second, the whole country skipped a winter every time a career ended.
 * Nobody graduated anywhere, nobody developed, and the next class landed on
 * ninety-six rosters that had never been emptied — a year of the world frozen,
 * silently, and inherited by whoever coached next.
 */
function leagueWinter(get: () => DynastyStore, set: (patch: Partial<DynastyStore>) => void): void {
  const season = get().season;
  if (!season || get().furthestPhase >= PHASES.indexOf('draft')) return;
  const chair = season.teams[get().userTeam];
  const year = get().year;
  const eco = get().economy;
  const facility = facilityEffects(eco);
  const baseTraining = get().coach.skills.training
    + (FACILITIES[eco.facilities]?.trainBump ?? 0);
  const levers = leversFor(get().coach.badges);
  const report = departAndDevelop(season, season.rng, {
    userTeam: get().userTeam,
    training: baseTraining + Math.round((facility.bat + facility.arm) / 4),
    // Specialized facilities now matter on their own side of the roster.
    // The coach's development badges: SWING AWAY (the Hitting guru's card,
    // audit 17 L30), ARMS MAN, DEVELOPER and PLAYS THE KIDS (coachEdges.ts).
    trainingBat: baseTraining + Math.round(facility.bat) + devBonus(eco.staff).bat + levers.trainBat,
    trainingArm: baseTraining + Math.round(facility.arm) + devBonus(eco.staff).arm + levers.trainArm,
    youngGrowth: levers.youngGrowth,
    draftExit: levers.draftExit,
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
    const won = awardFirstOverall(
      get().coach.achievements, year, chair.def.abbr, first.name,
    );
    if (won.length > 0) {
      set({ unseenTrophies: [...get().unseenTrophies, ...won] });
    }
  }
  // The "N of your men drafted" card went in the 15.5 noise cut: it
  // posted while you were standing ON the draft step it pointed at.
  /*
    The winter-badges card went in the 15.5 noise cut, named outright:
    "when they get badges, not needed to be announced." The argument it
    used to make for itself — that badges are TRAINING's only visible
    return — lost to the routing rule; the chips on the player card are
    where a badge lives, and finding one there is its own small moment.
  */

}

/**
 * The last of the draft board, and then the hall of fame meets.
 *
 * Anybody still sitting on the board has run out of time to be talked to;
 * signing with the club that took him is what happens when a coach does
 * nothing, so doing nothing means that here as well. The ballot follows,
 * because the honest moment is the one where "his career is over" is finally a
 * settled question.
 *
 * Idempotent: the men already in are passed as `inducted` and never
 * reconsidered, and a man already released is released again to no effect.
 *
 * Run on the way out of a career as well as at the portal step, and for a
 * reason beyond tidiness: the ballot weighs a man's honours out of the coach's
 * `history`, and a retirement throws that history away the moment a successor
 * is made. Left to next June, his last class would be voted on with nothing
 * said in their favour.
 */
function settleTheDraft(get: () => DynastyStore): void {
  const season = get().season;
  if (!season) return;
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
  const staying = new Set<string>(
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
      body: going.length === 1 && going[0]
        ? `Coach — ${going[0].line}. There is a plaque with his name on it `
          + 'now. Bring a handkerchief.'
        : `Coach — ${going.map((m) => m.name).join(', ')}. Plaques all `
          + 'round. Bring a handkerchief.',
      // One man opens his own card; a class opens the wall they are on.
      link: going.length === 1 && going[0]
        ? { to: 'player', id: going[0].id }
        : { to: 'program', sheet: 'hall' },
    });
  }
}

/**
 * The winter, for a tenure that ends before the draft step: the book, the
 * league's departures and development, and the draft board settled.
 *
 * The three calls every exit at the meeting makes, in one place since the
 * resignation made a fourth exit. `furthestPhase` is moved past the draft once
 * `leagueWinter` has run, so a roll that fails and walks back through the
 * meeting cannot run `departAndDevelop` a second time.
 */
function winterWithoutHim(get: () => DynastyStore, set: (patch: Partial<DynastyStore>) => void): void {
  bookTheYear(get);
  leagueWinter(get, set);
  set({ furthestPhase: Math.max(get().furthestPhase, PHASES.indexOf('draft')) });
  settleTheDraft(get);
}

/**
 * The tenure ends on a resignation: the name pays for the years left, and the
 * season he left after says so in the book.
 *
 * Read after the meeting, where `contractYears` is the years after the graded
 * season (a leaving coach is never extended or renewed, so it is the number the
 * confirm showed). Charged once: the mark on the history row and the charge go
 * together, and a row already marked is not charged again.
 */
function chargeResignation(get: () => DynastyStore, set: (patch: Partial<DynastyStore>) => void): void {
  const s = get();
  if (s.history.some((h) => h.year === s.year && h.resigned === true)) return;
  const cost = resignationCost(s.coach.contractYears);
  const p = s.coach.prestige;
  set({
    // Floored at five, the clamp every other writer keeps, and never raised by it.
    coach: { ...s.coach, prestige: Math.max(Math.min(5, p), p - cost) },
    history: s.history.map((h) => (h.year === s.year ? { ...h, resigned: true } : h)),
    version: s.version + 1,
  });
}

/**
 * The one line on the new year's desk that says he left. Posted after the
 * roll, which wipes the inbox — the notice's own letter goes with it.
 * `userTeam` is still the old school until he takes a chair.
 */
function postResignation(get: () => DynastyStore): void {
  const s = get();
  get().post({
    kind: 'carousel', year: s.year,
    title: `${s.coach.name} leaves ${s.season?.teams[s.userTeam]?.def.school ?? 'the program'}`,
    body: 'Coach — the desk is cleared. The calls are yours to take.',
  });
}

/**
 * The portal closes: the coach's own leavers go, the other ninety-five shop
 * the pool, and whoever is left has left college baseball.
 *
 * Out of `nextPhase` so that a coach who resigns on the portal step leaves a
 * closed portal behind him rather than one half-run for the whole country.
 */
function closePortal(get: () => DynastyStore, set: (patch: Partial<DynastyStore>) => void): void {
  const season = get().season;
  if (!season) return;
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
      // `continue`, not `break`: a program with nothing left to take is
      // one program, not the end of the queue behind it.
      if (going.length === 0) continue;
      const budget = flexibleOffseasonBudget(prestigeStars(other.prestige))
        - (season.draft?.rivalSpend[other.index] ?? 0)
        - (season.portalSpend?.[other.index] ?? 0);
      for (const m of staffWorksPortal(other.team, going, budget)) {
        taken.add(m.player.id);
        const from = season.teams[m.from];
        if (from) releaseFrom(from.team, m.player.id);
        // The same pool for all ninety six: what a rival spends here
        // thins its own recruiting week, the rule the user now plays by.
        (season.portalSpend ??= {})[other.index] =
          (season.portalSpend[other.index] ?? 0) + m.cost;
      }
    }
    /*
      Whoever is left has genuinely left college baseball -- from every
      roster, not only the coached one. A rival's unsigned man used to
      stay on the roster he was leaving, wearing `inPortal` for good, so
      the rule read one way for the user and another for the ninety-five
      (05 §62.8).
    */
    for (const m of stillOut) {
      if (taken.has(m.player.id) || m.from === get().userTeam) continue;
      const from = season.teams[m.from];
      if (from) releaseFrom(from.team, m.player.id);
    }
  }

  /*
    The window's one letter. Individual signings stopped writing home
    the moment they happened; this is the whole haul in a sentence,
    posted as the portal closes so it reads as news about a finished
    thing rather than a running commentary.
  */
  const came = get().portalArrivals;
  if (came.length > 0) {
    const names = came.length === 1
      ? came[0]
      : `${came.slice(0, -1).join(', ')} and ${came[came.length - 1]}`;
    get().post({
      kind: 'season', year: get().year,
      title: came.length === 1
        ? 'One came in through the portal'
        : `${came.length} came in through the portal`,
      body: `Coach — ${names}. Eligible immediately, on the roster now.`,
      link: { to: 'team', index: get().userTeam },
    });
  }
  set({ portal: null, portalArrivals: [] });
}

function dealLikeAuto(team: TeamRecord['team'], day: number, form?: BatForm): void {
  /*
    Bench the men who cannot play, THEN order the card.

    Reported: "the auto button doesn't move hurt players out." It called a
    helper whose contract is a pure reorder, so it never could, and a fit
    pass went above it that swapped every unavailable starter out.

    Then, 2026-09-10: "it kept two freshmen at 50 overall on the bench and
    two juniors at 25 overall starting." The fit pass only ever moved a man
    who could not play. `bestNine` picks the card from the whole squad by
    merit, the unavailable skipped, so AUTO fields the best nine it has.
  */
  const best = bestNine(team, day, form);
  team.lineup.splice(0, team.lineup.length, ...best.lineup);
  team.bench.splice(0, team.bench.length, ...best.bench);
  // AUTO is the button that promises a sound card, so it repairs the set as
  // part of the deal — and it is the ONLY automation allowed to touch a
  // label, per the report that reversed the manual adoption. It also sends
  // every bench man home: the bench is where a man is himself again.
  healPositions(team.lineup);
  for (const b of team.bench) restoreHome(b);
  // AUTO is a decision too: whoever it fielded is back on purpose.
  for (const m of team.lineup) settleReturn(m);
  const dealt = autoBattingOrder(team.lineup);
  // Same nine or nothing. The helper only reorders, but the invariant is
  // cheap to hold at the door and a corrupted lineup is a corrupted season.
  if (dealt.length !== team.lineup.length) return;
  team.lineup.splice(0, team.lineup.length, ...dealt);
  /*
    And the rotation, in the same press — asked for directly: "when hitting
    auto lineup it should also automatically rework the pitching rotation."
    Best arm takes Friday, the weekend follows in order, and the fourth-best
    gets the midweek start, which is what the slot labels have always meant.
    Available arms first, so a hurt ace does not hold Friday from the bench.
  */
  /*
    Rebuilt from every arm, not reordered. Reported 2026-09-10: "I have a
    lot of better freshman SP in the bullpen but they are not being brought
    to the starting position." Available arms first, then starters by
    trade — the role he was drawn with, or the one he keeps under a
    borrowed label — then the better arm; relievers fill the back of the
    rotation only when there are not four starters. The same labels
    promoteArm writes, so a reliever who takes Friday is an SP tonight and
    an RP again on the way back down, and a surplus starter in the pen
    stays an SP by trade.
  */
  const arms = uniquePlayers([...team.rotation, ...team.bullpen]) as Arm[];
  const trade = (a: Arm): 'SP' | 'RP' => a.homeRole ?? a.role;
  const ranked = [...arms].sort((a, b) =>
    (Number(available(b, day)) - Number(available(a, day)))
    || (Number(trade(b) === 'SP') - Number(trade(a) === 'SP'))
    // armValue: a two-way man's slot in the rotation is his arm's.
    || armValue(b) - armValue(a));
  const size = Math.max(1, team.rotation.length);
  const rotation = ranked.slice(0, size);
  const bullpen = ranked.slice(size);
  for (const a of rotation) { a.homeRole = trade(a); a.role = 'SP'; settleReturn(a); }
  for (const a of bullpen) { a.homeRole = trade(a); a.role = trade(a); }
  team.rotation.splice(0, team.rotation.length, ...rotation);
  team.bullpen.splice(0, team.bullpen.length, ...bullpen);
  // AUTO's order is rest's order again, and the walk past short rest returns.
  delete team.penByHand;
  delete team.rotationByHand;
}

function staffSetsTheCard(season: SeasonState, userTeam: number): void {
  const team = season.teams[userTeam]?.team;
  if (!team) return;
  // The staff field the best nine they have, the unfit benched — a casual
  // career was the one place nobody was ever told and nobody ever moved. The
  // same call AUTO makes (`bestNine`), so the two cards stay one card.
  // The injury clock, which runs on through June; the schedule index stops (M58).
  const best = bestNine(team, injuryClock(season), battingForm(season));
  team.lineup.splice(0, team.lineup.length, ...best.lineup);
  team.bench.splice(0, team.bench.length, ...best.bench);
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
  economy: Economy = freshEconomy(),
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
  const fx = facilityEffects(economy);
  syncCoachMods(season, userTeam, withStaff(coach.skills, economy.staff), {
    armCare: armCareFor(economy.staff),
    injuryGuard: (FACILITIES[economy.facilities]?.injuryGuard ?? 1) * fx.guard * staffProjectInjuryGuard(economy, season.recruiting.week <= RECRUITING_WEEKS),
  }, edgesFor(coach.badges));
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
  void myConference;
  /*
    Narrowed twice in the 15.5 noise cut. It used to post every in-conference
    move plus a rollup of the rest; the reporter's routing rule ("just super
    important things") and the wire-watch's "watched only" answer leave one
    case: a chair on YOUR job watchlist changing hands. That is the assistant
    watching the wire — so the card wears the wire's kind, not the carousel's.
    Everything else is still on the rankings table where it always was.
  */
  const watched = new Set(store.watch.jobs);
  const abbrOf = (t: number | undefined): string | null =>
    t !== undefined ? store.season?.teams[t]?.def.abbr ?? null : null;
  for (const m of moves) {
    const chair = abbrOf(m.team);
    const left = abbrOf(m.from);
    const hit = (chair && watched.has(chair)) || (left && watched.has(left));
    if (!hit) continue;
    const title = m.kind === 'poached'
      ? `${m.coach} leaves ${m.fromSchool} for ${m.school}`
      : m.kind === 'sacked'
        ? `${m.school} sack ${m.coach}`
        : m.kind === 'retired'
          ? `${m.coach} retires at ${m.school}`
          : `${m.school} hire ${m.coach}`;
    store.post({
      kind: 'wire', year, title,
      body: `Coach — ${m.detail}. You asked me to watch this chair.`,
      ...(m.team !== undefined ? { link: { to: 'team' as const, index: m.team } } : {}),
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

/*
  What the season just did that is worth being asked about.

  Every trigger here is a fact the season already produced -- a streak it
  already counts, a result it already recorded, a bracket it already settled.
  Nothing is measured specially to feed the press, which is the rule that keeps
  a press conference a consequence rather than a scheduled event.

  Returns the first thing worth asking about, most important first: a season
  ending outranks a trophy outranks a run outranks one night's result.
*/
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
/*
  Gone in the 15.5 noise cut — the reporter's routing rule, given with names:
  "stop having so many things coming into inbox such as... when someone gets
  injured (we already had that in needs you)... just super important things."
  Ineligibility, injuries and recoveries are all roster facts with a better
  surface: the needs list carries the injury and the healed-return hold, the
  roster rows say who is out and why. The engine logs they read
  (season.classroom, season.trainer) still fill — nothing downstream lost its
  data, the inbox just stopped repeating it.
*/

/*
  The trainer's room, read off what the season already did.

  Same shape and same reason as `classroomNews`: the engine writes down who
  went and when, so a season simulated in one press still owes the coach the
  news. Keyed on the man and the day, so it cannot post twice.
*/


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
    // A dot, not a letter — see `unseenRecords`.
    if (!store.unseenRecords.includes(key)) {
      store.unseenRecords = [...store.unseenRecords, key];
    }
  }

  const played = regularGames(season, me);
  const won = played.filter(Boolean).length;

  // The RUN cards (six straight, five dropped) went in the 15.5 noise cut: a
  // streak is texture, not a trophy, and the schedule tells the story better.

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
        body: `Coach — ${won}-${played.length - won}, and the country has `
          + 'noticed. I bought a paper just to read it out loud.',
        // A letter about where the programme sits in the COUNTRY opens the
        // national table. It pointed at the board room, which had nothing to do
        // with it and was simply the nearest door `InboxLink` offered.
        link: { to: 'rankings' },
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
    // The stamped ask, so the halfway card quotes the number February gave
    // rather than one the roster has drifted to since. The fallback is for a
    // season loaded from a save that predates the stamp.
    const want = store.boardAsk
      ?? playerBoard(me.prestige, rosterStrength(me.team), games).expectation;
    /*
      A man who has announced his last season is not being watched, he is being
      seen off, and the letter should know which. Reported 2026-09-20: "once
      you decide to retire, things like the halfway inbox should be something
      different, so far ive notice nothing about the farewell tour".
    */
    const leaving = store.coach.farewellYear === year;
    // A man on notice is not watched either, but his year is still graded.
    const going = !leaving && store.coach.resignYear === year;
    store.post({
      kind: 'board', year, key: 'halfway',
      title: leaving ? 'Halfway through your last summer'
        : going ? 'Halfway through your last season here'
          : 'Halfway, and the board is watching',
      body: leaving
        ? `Coach — ${w}-${half - w} at the turn, and every room you walk into `
          + 'from here knows it is the last time. Nobody upstairs is counting '
          + `to ${want.targetWins} any more.`
        : going
          ? `Coach — ${w}-${half - w} at the turn, against the ${want.targetWins} `
            + 'upstairs asked for. They still grade the year.'
        : `Coach — ${w}-${half - w} at the turn puts us on for `
          + `${Math.round((w / half) * games)} wins, against the ${want.targetWins} `
          + 'upstairs asked for.',
      /*
        And this one opens the league table. Reported 2026-09-12: "in cases like
        coach we are x-x, instead of taking the player to the board should take
        them to the season menu to see their standings." The board room holds
        the mandate, which this letter quotes — but what a coach wants after
        reading "we are 12-9" is the table he is 12-9 in.
      */
      link: { to: 'standings' },
    });
  }
}

/** Ridgemont State, the founding program, unless told otherwise. */
function defaultUserTeam(season: SeasonState): number {
  const home = season.teams.find((t) => t.conference === HOME_CONFERENCE);
  return home?.index ?? 0;
}

/**
 * The board's ask, computed once — see `boardAsk` on the interface.
 *
 * The drift-corrected form, with `leagueShape`, because that is the form the
 * June review already uses: the correction every rival board gets was once
 * withheld from the player's (see the note at the review), and stamping the
 * uncorrected number here would reopen that seam from the other side.
 */
/**
 * The seed the board's rotating bonuses are drawn with (`boardExtras`): the
 * year and the chair, so a spring's pair holds through every read and every
 * argument, and next spring's is a different pair. Never 0, which is the
 * seed that adds nothing.
 */
function askSeed(season: SeasonState | null, userTeam: number): number {
  return season ? (season.year ?? 0) * 97 + userTeam + 1 : 0;
}

function boardAskFor(season: SeasonState, userTeam: number): Expectation | null {
  const me = season.teams[userTeam];
  if (!me) return null;
  const ask = playerBoard(
    me.prestige, rosterStrength(me.team), seasonLength(season.config),
    me.culture?.patience, leagueShape(season.teams),
  ).expectation;
  return { ...ask, objectives: objectivesFor(ask.mandate, ask.targetWins, askSeed(season, userTeam)) };
}

/**
 * What the rotating bonuses read (`boardExtras`), off the season itself.
 * `final` withholds the two that only mean something once the schedule is
 * done — the poll and the all-conference team — so a box does not tick in
 * April and untick in May. Read by the settled outcome and by the board
 * room's live one.
 */
export function boardFacts(
  season: SeasonState, me: TeamRecord, final: boolean,
): Pick<SeasonOutcome, 'rivalSeries' | 'finalRank' | 'conferenceWins' | 'runDiff' | 'firstTeamMen' | 'bestRecruitStars' | 'sweeps' | 'longestStreak'> {
  const rival = season.teams.findIndex((t) => t.def.abbr === me.def.rival);
  const series = { w: 0, l: 0 };
  // Conference series by opponent and week, for the sweeps.
  const sets = new Map<string, { w: number; n: number }>();
  for (const g of season.results) {
    if (g.home !== me.index && g.away !== me.index) continue;
    const home = g.home === me.index;
    const won = home ? g.homeRuns > g.awayRuns : g.awayRuns > g.homeRuns;
    const opp = home ? g.away : g.home;
    if (opp === rival) { if (won) series.w += 1; else series.l += 1; }
    if (g.conference) {
      const key = `${opp}:${season.schedule[g.day]?.week ?? g.day}`;
      const s = sets.get(key) ?? { w: 0, n: 0 };
      s.n += 1;
      if (won) s.w += 1;
      sets.set(key, s);
    }
  }
  return {
    rivalSeries: series,
    finalRank: final ? nationalRank(season, me.index) : 0,
    conferenceWins: me.cw,
    runDiff: me.rs - me.ra,
    firstTeamMen: final ? allConference(season).filter((p) => p.team === me.def.abbr).length : 0,
    bestRecruitStars: season.recruiting.prospects
      .reduce((best, p) => (p.signedBy === me.index ? Math.max(best, p.stars) : best), 0),
    sweeps: [...sets.values()].filter((s) => s.n >= 3 && s.w === s.n).length,
    longestStreak: season.feats?.streak ?? 0,
  };
}

type BatForm = NonNullable<Parameters<typeof bestNine>[2]>;

/**
 * A bat's season against the league's, in rating points, for AUTO's card.
 *
 * On-base plus slugging, against the league's at-bat-weighted mean, at fifty
 * points of rating per point of OPS and half weight at forty at-bats: a hot
 * week is a hint, a season is a fact. Capped at eight either way, so the
 * ratings still decide between two men with ordinary lines.
 */
function battingForm(season: SeasonState): BatForm {
  let num = 0;
  let den = 0;
  for (const s of season.batting.values()) {
    if (s.ab > 0) { num += (onBase(s) + slugging(s)) * s.ab; den += s.ab; }
  }
  const league = den > 0 ? num / den : 0.7;
  return (m) => {
    const s = season.batting.get(m.id);
    if (!s || s.ab === 0) return 0;
    const weight = s.ab / (s.ab + 40);
    return Math.max(-8, Math.min(8, (onBase(s) + slugging(s) - league) * 50 * weight));
  };
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
 * Autosaves, coalesced (audit 17, M43). A recruiting week used to write the
 * whole 2.6 MB career a dozen times, each one cloned on the tap. Now a burst
 * of changes is one write, a second after the last of them — and the file is
 * built in that timer, not under the finger. Anything that must be on disk
 * now still awaits `saveNow`; the app going to the background flushes.
 * Tests run it on the next tick, so a test that yields still finds the file.
 */
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let autosaveMs = (import.meta as { env?: { MODE?: string } }).env?.MODE === 'test' ? 0 : 1000;
/** For tests of the coalescing itself. */
export const setAutosaveDelay = (ms: number): void => { autosaveMs = ms; };
/** A double tap on FORK must still create one protected original and one sandbox. */
let godForkInFlight = false;

/**
 * Is the season's opener actually drawn right now?
 *
 * Not the same question as "is there one pending". The card stands down while
 * you are reading the board it sent you to, and it stays in the store the
 * whole time so it can come back if you leave without taking the terms — so
 * the store says "opener" for as long as that errand is open.
 *
 * The back gesture asked the store rather than the screen, and was therefore
 * swallowed for the whole of it. Reported 2026-09-10: "if at the start of the
 * year I hit go to the board and then try going back it glitches and shows as
 * if the card was still there and does a quick flick the screen."
 *
 * Since the UI clarity review (2026-09-25) the opener is a full-frame step
 * that is signed where it stands (`SeasonTerms.tsx`) and sends nobody to the
 * board. It still stands down there, and the board page says the terms are
 * waiting and steps off itself to bring them back, so a board reached with
 * them unsigned is never a dead end. And it is never drawn for a man with no
 * chair: the year roll writes one even for a coach the review has just let
 * go, and the step would have asked him to sign for the school that fired him
 * over the top of the job market; a finished career has no season to sign for.
 */
export function openerShowing(s: DynastyStore): boolean {
  // The card stands down while the coach is reading the board it sent him to,
  // on the Office tab or laid over something else.
  return s.seasonOpener !== null && !s.live && s.phase === null
    && !s.jobSearch && s.coach.retiredYear === undefined
    && !(s.tab === 'office' && s.screen === 'board') && s.overlay !== 'board';
}

/** A card that answers the back press itself, rather than letting it through. */
export function blockingCardUp(s: DynastyStore): boolean {
  return s.playbookInvite !== null || s.bigMoment !== null || openerShowing(s);
}

/**
 * Is the Season plan drawn right now?
 *
 * Once a season at each chair: owed until `closeSeasonPlan` stamps the year,
 * and drawn only while the recruiting weeks are open and nothing else owns the
 * frame. It follows from state, so it opens the moment the terms are signed
 * (the opener goes null), and on day one of a first season or a new job,
 * neither of which has terms. The store never waits on it. It is not part of
 * `blockingCardUp`: the back press closes it, which is "Decide later".
 */
export function seasonPlanShowing(s: DynastyStore): boolean {
  if (!seasonPlanOwedNow(s)) return false;
  return !(s.overlay !== null || s.selectedPlayer !== null || s.coachSeat !== null || s.godStack.length > 0);
}

/** Owed this season and nothing but its own time in the window stands in the way. */
function seasonPlanOwedNow(s: DynastyStore): boolean {
  const season = s.season;
  if (!season || s.needsTeam || s.seasonPlanYear === s.year) return false;
  if (s.seasonOpener !== null || s.phase !== null || s.jobSearch || s.coach.retiredYear !== undefined) return false;
  if (s.live !== null || s.liveStarting || s.pendingGame !== null || s.busy) return false;
  if (s.playbookInvite !== null || s.bigMoment !== null || s.rosterAlert !== null || s.weekStoppedBy !== null) return false;
  const week = season.recruiting.week;
  return week >= 1 && week <= RECRUITING_WEEKS;
}

/**
 * The plan is up but a room or a card lies over it: the hiring desk, a
 * building, a coach's sheet, a player it named. It stays mounted and hidden
 * (Sheet `covered`), so its back layer and history entry keep their place and
 * the back press peels the room first, then comes back to the plan. Unmounting
 * it spent its entry while the room pushed one, and the next back left the app
 * (2026-09-29 review).
 */
export function seasonPlanCovered(s: DynastyStore): boolean {
  return seasonPlanOwedNow(s) && s.godStack.length === 0
    && (s.overlay !== null || s.selectedPlayer !== null || s.coachSeat !== null);
}

/**
 * The staff's pick for an idle seat: what the plan's row offers, and what
 * closing the plan starts (`letStaffPick` is built on the same pure choice).
 * `alignFocus` is a casual staff's, which turns the focus to the work.
 */
export function planPick(
  eco: Economy, rec: TeamRecord, seat: StaffSeat, week: number, opts: { alignFocus?: boolean } = {},
): StaffPick | null {
  return staffPickFor(eco, rec.team, rec.def.state, seat, week, opts);
}

// `withNav` (era.ts) sits under every write, `setState` included (2026-09-30).
export const useDynasty = create<DynastyStore>(withNav((set, get) => ({
  season: null,
  userTeam: 0,
  needsTeam: true,
  lastOutcome: null,
  year: 2027,
  tab: 'home', /* nav-write */
  screen: 'today', /* nav-write */
  version: 0,
  godMode: false,
  busy: false,
  progress: null,
  lastOffseason: null,
  lastWeek: null,
  phase: null,
  replaceLostRecruits: true,

  start: (seed = WORLD_SEED, team?: number, profile?: CoachProfile, mode: DepthMode = 'full', made?: { skills: CoachSkills; badges: string[]; leans: Partial<Record<CultureEdge, number>> }, godMode = false, rules: SeasonRules = DEFAULT_RULES, overrides?: Partial<Record<SystemKey, boolean>>) => {
    // The depth this career is being given: the preset, and whatever the
    // creation step answered differently (the recruiting rule). Normalised,
    // so an override that agrees with the preset is not stored.
    // The career being left keeps its last changes (M43).
    get().flushAutosave();
    const depth = normalizeDepth({ mode, overrides: overrides ?? {} });
    // The schedule is part of the world, so the config has to be right before a
    // single fixture is laid out. Nothing above this draws, so the ninety-six
    // rosters are the rosters the offer screen previewed whatever the rules say.
    const season = createSeason(makeRng(seed), configForRules(rules), CONFERENCES);
    season.rules = rules;
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
      skill, no badges, no leanings -- and the background is applied on top.
      That ordering matters: a career started without choosing one is exactly
      the career it used to be, so the background is an addition to creation
      rather than a rewrite of it, and every save that predates it still
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
    applyCoachMods(season, seat, coach, get().economy);
    set({ godMode, leagueNames: {} });
    setLeagueNames({});
    setStarGateOpen(godMode);
    applyPhilosophy(season, seat, coach);
    // Recruiting now runs with the spring. The class opens already contested,
    // so week one reads like a national market rather than an empty spreadsheet.
    /*
      The depth this career is about to be given, not the one the store is
      still holding from whatever was open before it.

      `start` installs `depth` thirty lines below, so
      `get().depth` here is the previous career's — and reading it would seed
      this world off a setting that is about to be thrown away. Today both
      presets work their own board (`recruiting` is `casual: true`) so the
      answer is the same either way and nothing is visibly wrong; the day
      somebody flips that flag it would not be, and the failure would be a
      recruiting class quietly missing from year one of every casual career.
      The creation step now asks who runs recruiting (2026-09-28), so `depth`
      carries its answer.
    */
    // The coached programme is never seeded, whoever runs its board: a staff
    // works only the coach's list (2026-09-30), and interest seeded in men he
    // never chose could sign one behind his back.
    seedRivalInterest(season, seat, false);

    set({
      season,
      userTeam: seat,
      // A game left waiting in the career before this one is not this one's.
      live: null,
      liveMeta: null,
      pendingGame: null,
      boardAsk: boardAskFor(season, seat),
      // And no letter from the board that hired somebody else. `acceptOffer`
      // has cleared this since the two-number mandate was first reported;
      // `start` never did, so a second career begun in one session opened on
      // the previous school's terms.
      seasonOpener: null,
      // A first season has no terms, so its plan is owed from day one.
      seasonPlanYear: null,
      needsTeam: false,
      year: START_YEAR,
      version: 1,
      coach,
      lastReview: null,
      offers: [],
      history: [],
      tab: 'home', /* nav-write */
      screen: 'today', /* nav-write */
      godStack: [],
      loadedSlot: null,
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
      // lands, with only what the creation step disagreed about.
      depth,
      // The staff replaces a starred recruit who signs elsewhere until the
      // coach says otherwise; a second career does not inherit the first's no.
      replaceLostRecruits: true,
      /*
        And none of the last career's winter or June. Found 2026-09-26: a
        second career begun in one session kept `furthestPhase` from the
        first one's offseason, and `leagueWinter` reads a number past the
        draft as "this winter has run", so the new career's first winter
        skipped graduations, development and the draft outright. Its portal
        and its brackets were still standing too. Everything a load restores
        per career is set back to where a first launch has it.
      */
      phase: null,
      furthestPhase: 0,
      spentThisStep: {},
      portal: null,
      portalArrivals: [],
      bracket: null,
      myBracket: null,
      sideShow: null,
      knockout: null,
      postseasonSeen: [],
      lastPostseason: null,
      lastOutcome: null,
      arguedTerms: false,
      wordsUsed: 0,
      jobSearch: false,
      approaches: { tried: [], interest: [] },
    });
    // A staff left to its athletic director is hired on day one, not at the
    // first winter: before week one is planned, so the coordinator works it.
    if (!handles(depth, 'assistants')) {
      const staffed = adFillsSeats(get().economy, String(season.seed ?? 0), START_YEAR, here);
      applyCoachMods(season, seat, get().coach, staffed);
      set({ economy: staffed });
    }
    // Whichever card the staff would write, written before the first day rather
    // than after it, so a casual coach's opening lineup is his coach's lineup.
    if (!handles(depth, 'lineups')) staffSetsTheCard(season, seat);
    // And week one's recruiting, where the staff runs it: on the board from the
    // first day, so the points band shows it before a game is played.
    get().staffPlanWeek();
    roomPicksLeader(get);
    /*
      A file of its own from the first day. This wrote the autosave slot —
      the one slot every career made before it had also been writing — so
      creating a career silently replaced the last one before a day had been
      played, with no question asked (05 §62.3). Older careers already in the
      autosave slot keep writing there; nothing new ever claims it.
    */
    const slot = newSlotId();
    set({ loadedSlot: slot });
    void get().saveNow(slot);
  },

  go: (tab, screen, focus) => {
    // Stage 23: a broken nine holds the door. cardGaps is the same read
    // the lineup's own warning prints from, and the gate only ever holds
    // a card that is YOURS to fix.
    {
      const st = get();
      if (lineupHolds(st)) {
        set({ lineupGate: st.lineupGate + 1 });
        return;
      }
    }
    const def = TABS.find((t) => t.id === tab);
    const nextScreen = screen ?? def?.screens[0]?.id ?? 'today';
    // The card this drops goes in the same write as the move: one level
    // swapped for another, so the ledger (historySync.ts) spends no entry.
    // The trail is read inside the run, so a dropped or overtaken
    // transition leaves no stop behind (T, 2026-09-30). The pages over the
    // route go with it (PF); a caller's own closeOverlay() first is harmless.
    crossfade(() => set({
      ...trailStep(get(), tab, nextScreen),
      ...overlaysShut(get()),
      tab, /* nav-write */
      screen: nextScreen, /* nav-write */
      selectedPlayer: null,
      coachSeat: null,
      teamCard: null,
      focusPlayer: focus ?? null,
      // Every nav tap, counted. June renders the Postseason component in
      // place for the whole month, so its local takeovers (the lineup
      // card, a stage review) survive a tap that was supposed to leave —
      // reported as HOME not working until some other tab was visited
      // first. The screens watch this and stand their takeovers down.
      navEpoch: get().navEpoch + 1,
    }));
  },

  navEpoch: 0,
  navTrail: [],
  routeVisit: 0,
  restoringVisit: null,
  stepBase: null,
  teamCard: null,
  openTeamCard: (index) => set({ teamCard: index }),
  closeTeamCard: () => { if (get().teamCard !== null) set({ teamCard: null }); },

  goBack: () => {
    const s = get();
    const era = eraKey(s);
    let at = s.navTrail.length - 1;
    while (at >= 0 && s.navTrail[at]!.era !== era) at--;
    const stop = s.navTrail[at];
    if (!stop) return 'none';
    // Refused, not a modal: nothing may mount during a pop (plan correction 17).
    if (lineupHolds(s)) { set({ cardNudge: s.cardNudge + 1 }); return 'refused'; }
    supersedeNav();
    navMark(true);
    set({
      tab: stop.tab, screen: stop.screen, /* nav-write */
      navTrail: s.navTrail.filter((_, i) => i !== at),
      routeVisit: stop.visit, restoringVisit: stop.visit,
      selectedPlayer: null, coachSeat: null, teamCard: null, focusPlayer: null,
      navEpoch: s.navEpoch + 1,
    });
    return 'peeled';
  },

  leaveGame: () => {
    const s = get();
    if (frameOf(s) !== 'season' || !s.live || s.screen !== 'box') return 'none';
    supersedeNav();
    navMark(true);
    set({ screen: 'today' }); /* nav-write */
    get().autosave();
    return 'peeled';
  },

  stepBack: () => {
    const s = get();
    if (stepStops(s).length === 0 || s.phase === null) return 'none';
    const at = PHASES.indexOf(s.phase);
    const prev = railSteps(s).filter((p) => PHASES.indexOf(p) < at && !closedStep(s, p)).at(-1);
    if (!prev) return 'none';
    // Like a rail tap, so Coach points spent on the way out are kept.
    get().goPhase(prev);
    if (get().phase !== prev) return 'none';
    supersedeNav();
    navMark(true);
    return 'peeled';
  },
  /** Who arrived through the portal this window; one letter at its close. */
  portalArrivals: [],
  seasonOpener: null,
  nudgeCard: () => set((s) => ({ cardNudge: s.cardNudge + 1 })),

  dismissSeasonOpener: () => {
    set({ seasonOpener: null });
    get().autosave();
  },
  seasonPlanYear: null,
  closeSeasonPlan: () => {
    const { season, year } = get();
    if (!season || get().seasonPlanYear === year) return;
    // The defaults: the staff's own picks on idle seats, in every mode. The
    // recruiting rule and the staff list are never touched by closing.
    get().letStaffPick();
    set({ seasonPlanYear: year, version: get().version + 1 });
    get().autosave();
  },
  unseenTrophies: [],
  unseenRecords: [],
  clearUnseenRecords: () => {
    if (get().unseenRecords.length === 0) return;
    set({ unseenRecords: [] });
  },
  clearUnseenTrophies: () => {
    if (get().unseenTrophies.length === 0) return;
    set({ unseenTrophies: [] });
  },
  clearFocusPlayer: () => set({ focusPlayer: null }),
  guide: null,
  startGuide: (g) => set({ guide: g }),
  clearGuide: () => set({ guide: null }),
  keepCover: (id) => {
    // Not while the season sims in the worker: its copy replaces this one (M71).
    if (get().busy) return;
    const { season, userTeam, version } = get();
    const team = season?.teams[userTeam]?.team;
    if (!team) return;
    // The bench AND the pen: the lineup screen offers KEEP THE COVER on a
    // returning bullpen arm too, and searching the bench alone left that
    // strip on screen for ever, pressed and unanswered (05 §63.3).
    const man = [...team.bench, ...team.bullpen].find((p) => p.id === id);
    if (!man) return;
    settleReturn(man);
    set({ version: version + 1 });
    get().autosave();
  },

  // Navigating any other way drops the mark: it belongs to the errand that set
  // it, and an errand you walked away from is over.
  // Context/sub-navigation should be immediate. `crossfade` deliberately waits
  // for a view-transition snapshot and two animation frames; that is pleasant
  // when moving between the four primary rooms, but it made adjacent sections
  // such as PROGRAM · COLLEGES -> HISTORY feel as though the tap had stalled.
  // Every context nav in the app comes through `setScreen`, so keeping this
  // path synchronous removes the artificial delay globally while primary-tab
  // moves through `go()` retain the broader transition.
  setScreen: (screen) => {
    // The lineup gate holds the sub-nav too: it held `go` and the overlays
    // and was walked around here (15 sD, closed 2026-09-16).
    {
      const st = get();
      if (screen !== 'lineup' && lineupHolds(st)) {
        set({ lineupGate: st.lineupGate + 1 });
        return;
      }
    }
    // Same as `go`: a card this drops goes in the same write as the move.
    navMark(false);
    set({
      ...trailStep(get(), get().tab, screen),
      selectedPlayer: null, coachSeat: null, teamCard: null, focusPlayer: null, screen, /* nav-write */
    });
  },

  recruit: (prospectId, actions) => {
    const { season, userTeam, version } = get();
    if (!season || get().busy) return;
    // The staff's week is the staff's while it runs recruiting: a plan half
    // edited by hand would be neither his nor theirs.
    if (!handles(get().depth, 'recruiting')) return;
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
    if (!canPursue(
      prospect, myStars, pipelineStrength(get().economy, prospect.state, me?.def.state ?? ''),
    )) return;

    // A full class cannot sign anybody else, so there is nothing to spend on him.
    const signed = season.recruiting.prospects
      .filter((p) => p.signedBy === userTeam).length;
    if (signed >= SCHOLARSHIPS) return;

    const wanted = Math.max(0, Math.min(MAX_PER_RECRUIT, Math.round(actions)));
    /*
      Everybody else's week, plus this recruit's own actions; his points are
      the one thing being set, so they are the one thing not already spent.

      This was `totalWeekSpend minus his points`, and then his action cost was
      taken off again below — but totalWeekSpend already carries his action
      cost, so a pitched recruit was clamped three points short of the truth.
      Reported: "when you have less than 4 budget points you cannot allocate
      them to an offer." With a pitch on him, four was the first number that
      left anything at all.
    */
    const ownActions = weekActionCost(prospect, userTeam);
    const spentElsewhere = totalWeekSpend(season.recruiting.prospects, userTeam)
      - (prospect.spent[userTeam] ?? 0) - ownActions;

    // The weekly budget is the only cap on *chasing*. There is deliberately no
    // limit on how many recruits may be on the board: having more irons in the
    // fire than you can finish is a legitimate way to work, and the scholarships
    // already limit what you can actually sign.
    // Against this program's budget, not a flat league-wide one: prestige buys
    // attention, and that is most of what a good job is worth on the board.
    // Less whatever the draft phase already took to keep somebody, which is the
    // sequencing the whole retention mechanic hangs on.
    const budget = boardBudget(get().season, userTeam, get().economy.recruitingGrant);
    const allowed = Math.min(wanted, budget - spentElsewhere - ownActions);
    if (allowed <= 0) delete prospect.spent[userTeam];
    else prospect.spent[userTeam] = allowed;

    set({ version: version + 1 });
    get().autosave();
  },

  recruitPitch: (prospectId, factor) => {
    const { season, userTeam, version } = get();
    if (!season || get().busy) return false;
    if (!handles(get().depth, 'recruiting')) return false;
    const week = season.recruiting.week;
    if (week < 1 || week > RECRUITING_WEEKS) return false;
    const prospect = season.recruiting.prospects.find((p) => p.id === prospectId);
    if (!prospect || prospect.signedBy !== null) return false;
    const me = season.teams[userTeam];
    if (!me || !canPursue(
      prospect, prestigeStars(me.prestige),
      pipelineStrength(get().economy, prospect.state, me.def.state),
    )) return false;

    const current = prospect.weekActions?.[userTeam] ?? {};
    const next = { ...current };
    if (factor === null) delete next.pitch; else next.pitch = factor;
    const oldCost = weekActionCost(prospect, userTeam);
    const raw = prospect.spent[userTeam] ?? 0;
    const nextCost = (next.pitch ? PITCH_COST : 0) + majorActionCost(next.major);
    const usedWithout = totalWeekSpend(season.recruiting.prospects, userTeam) - oldCost - raw;
    if (usedWithout + raw + nextCost > boardBudget(season, userTeam, get().economy.recruitingGrant)) return false;
    (prospect.weekActions ??= {})[userTeam] = next;
    set({ version: version + 1 });
    get().autosave();
    return true;
  },

  recruitMajor: (prospectId, input) => {
    const { season, userTeam, coach, version } = get();
    if (!season || get().busy) return false;
    if (!handles(get().depth, 'recruiting')) return false;
    const week = season.recruiting.week;
    if (week < 1 || week > RECRUITING_WEEKS) return false;
    const prospect = season.recruiting.prospects.find((p) => p.id === prospectId);
    const me = season.teams[userTeam];
    if (!prospect || !me || prospect.signedBy !== null) return false;
    if (!canPursue(
      prospect, prestigeStars(me.prestige),
      pipelineStrength(get().economy, prospect.state, me.def.state),
    )) return false;

    const current = prospect.weekActions?.[userTeam] ?? {};
    // A sway that has been rolled is final for the week. Its success moved the
    // recruit's priorities the moment it was rolled, so letting it be withdrawn
    // refunded the cost and left the shift in place — and re-applying rolled
    // again on the already-moved priorities, ×1.6 a time, for as long as the
    // budget held. The attempt is the move; it cannot be taken back.
    if (current.major?.kind === 'sway') return false;
    // An ask is answered the moment it is made and, like a sway, is the
    // week's move: it cannot be withdrawn or repeated.
    if (current.major?.kind === 'ask') return false;
    // Major moves are relationship actions, never cold-call shortcuts. Week 2+
    // only. Sway is a one-time attempt across the full spring relationship.
    if (input && (week < 2 || !hasRecruitingRelationship(prospect, userTeam))) return false;
    if (input?.kind === 'sway' && prospect.swayedBy?.[userTeam]) return false;
    if (input?.kind === 'ask') {
      const full = scholarshipsPledged(season.recruiting.prospects, userTeam) >= SCHOLARSHIPS;
      if (askBlocked(prospect, userTeam, week, full) !== null) return false;
    }
    if (input?.kind === 'promise' && !availableRecruitPromises(prospect.player).includes(input.promise)) return false;
    // A promise is a binding recruitment commitment, not a coupon that resets
    // with the weekly action ledger. It can be changed/withdrawn during the same
    // week it is made, but once that week is banked the promise on file is final.
    const promiseOnFile = prospect.promiseBy?.[userTeam];
    if (input?.kind === 'promise' && promiseOnFile && current.major?.kind !== 'promise') return false;

    // Check affordability before a Sway is rolled, because a failed budget
    // check must not be able to change a recruit's priorities for free.
    const pricedMajor: RecruitMajorAction | undefined = input
      ? input.kind === 'sway'
        ? { kind: 'sway', factor: input.factor, success: false }
        : input.kind === 'ask'
          ? { kind: 'ask', success: false }
          : input
      : undefined;
    const pricedNext = { ...current };
    if (!pricedMajor) delete pricedNext.major; else pricedNext.major = pricedMajor;
    const oldCost = weekActionCost(prospect, userTeam);
    const raw = prospect.spent[userTeam] ?? 0;
    const nextCost = (pricedNext.pitch ? PITCH_COST : 0) + majorActionCost(pricedNext.major);
    const usedWithout = totalWeekSpend(season.recruiting.prospects, userTeam) - oldCost - raw;
    if (usedWithout + raw + nextCost > boardBudget(season, userTeam, get().economy.recruitingGrant)) return false;

    let major: RecruitMajorAction | undefined = pricedMajor;
    if (input?.kind === 'sway') {
      const pitch = userRecruitingPitch(season, userTeam, coach, get().economy);
      if (!pitch) return false;
      const skills = withStaff(coach.skills, get().economy.staff);
      const success = swayRecruit(
        prospect, input.factor, pitch, coach.prestige, skills.recruiting, season.rng,
      );
      (prospect.swayedBy ??= {})[userTeam] = true;
      major = { kind: 'sway', factor: input.factor, success };
    }
    if (input?.kind === 'ask') {
      const pitch = userRecruitingPitch(season, userTeam, coach, get().economy);
      if (!pitch) return false;
      // Answered here, deterministically, and written on him: the week close
      // reads a yes as the commitment, and a no shuts the door for a while.
      const answer = askForCommitment(prospect, userTeam, pitch, get().year, week);
      (prospect.askedBy ??= {})[userTeam] = { week, ...answer };
      major = { kind: 'ask', ...answer };
    }
    const next = { ...current };
    if (!major) delete next.major; else next.major = major;

    // Replacing a promise withdraws the old one before recording a new bargain.
    if (current.major?.kind === 'promise') delete prospect.promiseBy?.[userTeam];
    (prospect.weekActions ??= {})[userTeam] = next;
    if (major?.kind === 'promise') (prospect.promiseBy ??= {})[userTeam] = major.promise;
    set({ version: version + 1 });
    get().autosave();
    return true;
  },

  setReplaceLostRecruits: (on) => {
    set({ replaceLostRecruits: on });
    get().autosave();
  },

  /*
    The staff's week, on the board (2026-09-28).

    Planned at the week's open — here — and written into the ledger the
    coach's own week uses, so the band shows it and the close banks exactly
    it. It used to be planned inside the close and never written anywhere:
    the band read "Nothing planned" all season while the staff spent, and
    `resetWeeklySpend` wiped what it had spent before anybody could see it.
  */
  staffPlanWeek: (force = false) => {
    const s = get();
    const { season, userTeam: ut, coach, economy } = s;
    if (!season || s.busy || s.jobSearch || handles(s.depth, 'recruiting')) return;
    const recruits = season.recruiting;
    const week = recruits.week;
    if (week < 1 || week > RECRUITING_WEEKS) return;
    const rec = season.teams[ut];
    if (!rec) return;
    const pitch = programRecruitingPitch(season, rec, regionOfTeam(season, ut), coach.prestige, economy);
    tendStaffList(recruits, ut, pitch, s.replaceLostRecruits);
    if (force || totalWeekSpend(recruits.prospects, ut) === 0) {
      planStaffWeek(recruits, {
        team: ut,
        pitch,
        list: recruits.staffList ?? [],
        week,
        year: s.year,
        effort: delegateEffort(economy),
        coachPrestige: coach.prestige,
        recruitingSkill: withStaff(coach.skills, economy.staff).recruiting,
        signed: recruits.prospects.filter((p) => p.signedBy === ut).length,
        rng: staffWeekRng(season.seed ?? 0, s.year, week, ut),
      });
    }
    set({ version: get().version + 1 });
  },

  starRecruit: (id) => {
    const s = get();
    const season = s.season;
    if (!season || s.busy) return false;
    const recruits = season.recruiting;
    const list = recruits.staffList ?? [];
    if (list.includes(id)) {
      recruits.staffList = list.filter((x) => x !== id);
      if (recruits.staffStandIns?.[id] !== undefined) {
        const standIns = { ...recruits.staffStandIns };
        delete standIns[id];
        if (Object.keys(standIns).length > 0) recruits.staffStandIns = standIns;
        else delete recruits.staffStandIns;
      }
    } else {
      const p = recruits.prospects.find((x) => x.id === id);
      const me = season.teams[s.userTeam];
      if (!p || !me || p.signedBy !== null || list.length >= STAFF_LIST_MAX) return false;
      if (!canPursue(p, prestigeStars(me.prestige), pipelineStrength(s.economy, p.state, me.def.state))) return false;
      recruits.staffList = [...list, id];
    }
    // A list change replans the whole week; while the coach runs recruiting
    // himself the list is only data, and this does nothing.
    get().staffPlanWeek(true);
    set({ version: get().version + 1 });
    get().autosave();
    return true;
  },

  moveStaffRecruit: (id, by) => {
    const season = get().season;
    if (!season || get().busy) return;
    const list = season.recruiting.staffList ?? [];
    const at = list.indexOf(id);
    const to = at + by;
    if (at < 0 || to < 0 || to >= list.length) return;
    const next = [...list];
    next[at] = list[to]!;
    next[to] = id;
    season.recruiting.staffList = next;
    get().staffPlanWeek(true);
    set({ version: get().version + 1 });
    get().autosave();
  },

  setStaffList: (ids) => {
    const s = get();
    const season = s.season;
    if (!season || s.busy) return;
    const recruits = season.recruiting;
    const me = season.teams[s.userTeam];
    const stars = prestigeStars(me?.prestige ?? 50);
    const next: PlayerId[] = [];
    for (const id of ids) {
      if (next.length >= STAFF_LIST_MAX) break;
      if (next.includes(id)) continue;
      const p = recruits.prospects.find((x) => x.id === id);
      if (!p || p.signedBy !== null) continue;
      if (!canPursue(p, stars, pipelineStrength(s.economy, p.state, me?.def.state ?? ''))) continue;
      next.push(id);
    }
    recruits.staffList = next;
    delete recruits.staffStandIns;
    get().staffPlanWeek(true);
    set({ version: get().version + 1 });
    get().autosave();
  },

  /**
   * Bank the week's points for every program, let recruits commit, move on.
   *
   * The user's actions are already on the board; the AI decides its own here so
   * that both sides are working from the same state of the class, and neither
   * gets to see the other's spend first.
   */
  advanceRecruitingWeek: () => {
    const { season, userTeam, coach, busy } = get();
    if (!season || busy) return;
    const recruits = season.recruiting;
    if (recruits.week < 1 || recruits.week > RECRUITING_WEEKS) return;

    const regionOf = (teamIndex: number): Region => regionOfTeam(season, teamIndex);

    // Taken before anyone spends, so every program judges the week against the
    // same standings. This is what lets the AI walk away from a recruit
    // somebody else has clearly locked up — without it the lost-causes filter
    // in aiTargets compares against nothing and never fires.
    const atWeekStart = leadersAtWeekStart(recruits);

    const myEconomy = get().economy;
    const effSkills = withStaff(coach.skills, myEconomy.staff);

    /*
      Whether the coach is working his own board this week.

      The switch has existed on the settings sheet since the depth model went
      in — "Your coordinator works the board" — and until now it reached
      nothing at all: `handles` was never once asked about `recruiting`, so a
      coach who turned it off simply lost his recruiting. His board was read
      for whatever he had already put on it, which after a week of not touching
      it was nothing, and the class signed itself somewhere else. That is worse
      than not having the row.

      Delegating now means his week is worked by the same routine the other
      ninety five get, with his own pitch and his own programme behind it, at
      `delegateEffort` of the size he would have had. See the note above
      `delegateEffort` for why the handicap lives in the size of the week and
      in nothing else.

      And since 2026-09-28 that week is on the board: planned at the week's
      open by `staffPlanWeek` (working the coach's starred list first), and
      read at the close exactly as a coach's own week is. This covers a week
      nobody planned — an old save, or a test that set the depth directly.
    */
    const worksOwnBoard = handles(get().depth, 'recruiting');
    if (!worksOwnBoard) get().staffPlanWeek();

    // A program with no scholarship left stops recruiting: its points would
    // only stand in front of programs that can still sign the man (H6).
    const signedBy = new Map<number, number>();
    for (const p of recruits.prospects) {
      if (p.signedBy !== null) signedBy.set(p.signedBy, (signedBy.get(p.signedBy) ?? 0) + 1);
    }
    for (const record of season.teams) {
      if ((signedBy.get(record.index) ?? 0) >= SCHOLARSHIPS) continue;
      const mine = record.index === userTeam;
      // The coached programme's week is always the one on its board, whoever
      // planned it: the coach himself, or his staff at the week's open.
      const fromBoard = mine;
      // Your facilities are part of your pitch: a development lab is the one
      // thing on the tour a recruit's father asks about.
      const staff = record.coach;
      const pitch = programRecruitingPitch(season, record, regionOf(record.index),
        mine ? coach.prestige : (staff?.prestige ?? 45), mine ? myEconomy : undefined);

      const priorSpend = mine
        ? (season.draft?.spent ?? 0) + (season.portalSpend?.[userTeam] ?? 0)
        : (season.draft?.rivalSpend[record.index] ?? 0)
          + (season.portalSpend?.[record.index] ?? 0);
      const spends: { prospect: typeof recruits.prospects[number]; actions: number }[] = fromBoard
        ? recruits.prospects
            .filter((p) => (p.spent[userTeam] ?? 0) > 0 || weekActionCost(p, userTeam) > 0)
            .map((p) => ({ prospect: p, actions: p.spent[userTeam] ?? 0 }))
        // The ninety five, who are not delegating to anybody: they are the
        // staff, and they work their whole week.
        : aiTargets(
            record.index, pitch, staff?.prestige ?? 45,
            recruits.prospects,
            holesFor(record), season.rng, atWeekStart, priorSpend, recruits.week,
            1,
            boardsByTier(season.teams.map((t) => prestigeStars(t.prestige))),
          );
      if (!fromBoard) {
        planAiRecruitActions(
          record.index, pitch, spends,
          Math.max(1, Math.round(weeklyBudget(pitch.stars, priorSpend))),
          recruits.week,
          staff?.prestige ?? 45,
          staff?.skills.recruiting ?? 20,
          season.rng,
        );
      }

      for (const { prospect, actions } of spends) {
        // Every pitch carries the reputation and the recruiting skill of the man
        // making it. That used to be true of exactly one program in ninety six,
        // which meant the player's RECRUITING points bought him an edge nobody
        // in the country could ever answer. A chair with nobody in it — an
        // unseated world, or a save from before B7 — still works at the flat
        // league-average defaults.
        const { gain: gained } = recruitingPlan(prospect, pitch, {
          team: record.index, actions,
          prestige: mine ? coach.prestige : (staff?.prestige ?? 45),
          skill: mine ? effSkills.recruiting : (staff?.skills.recruiting ?? 20),
          ...(mine ? { economy: myEconomy, roster: [
            ...record.team.lineup, ...record.team.bench, ...record.team.rotation, ...record.team.bullpen,
          ] } : {}),
        });
        // THE CLOSER: his hours on a man count for more; a hollow pitch's
        // cost is not scaled (coachEdges.ts).
        const worth = mine && gained > 0 ? gained * leversFor(coach.badges).recruitPoints : gained;
        // A hollow pitch costs interest; it cannot take him below nothing.
        prospect.points[record.index] = Math.max(0, (prospect.points[record.index] ?? 0) + worth);
      }
    }

    const finalWeek = recruits.week >= RECRUITING_WEEKS;
    const closed = recruits.week;
    const commits = closeWeek(recruits, season.rng, finalWeek);
    resetWeeklySpend(recruits);
    recruits.week += 1;
    // An athletic director's staff picks its own season work the first week it
    // can (2026-09-28). The week being closed counts: the pick starts on it and
    // `progressStaffProjects` runs it straight after.
    if (!handles(get().depth, 'assistants')) {
      const mine = season.teams[userTeam]!;
      staffPicksSeasonWork(myEconomy, mine.team, mine.def.state, closed, { alignFocus: true });
    }
    // Season work runs week by week and lands as week 12 closes; a legacy
    // project still finishes on its own week. The outcome is kept on
    // economy.projectHistory (the coach's Recent results, the man's card, the
    // season review); no letter, the season is quiet (2026-09-28).
    progressStaffProjects(myEconomy, season.teams[userTeam]!.team, season.teams[userTeam]!.def.state, get().year, closed);
    const nextEconomy: Economy = {
      ...myEconomy,
      staffPlans: { ...(myEconomy.staffPlans ?? {}) },
      pipelines: { ...(myEconomy.pipelines ?? {}) },
    };
    applyCoachMods(season, userTeam, coach, nextEconomy);

    const mineThisWeek = commits.filter((c) => c.team === userTeam);
    const yours = mineThisWeek.map((c) => c.prospect.player.name);
    // The week's news is the board's "Week N is over" callout. Off the live
    // version: the staff's plan above has already bumped it once.
    set({
      economy: nextEconomy,
      version: get().version + 1,
      lastWeek: { closed, yours, gone: commits.length - yours.length },
    });

    // The number one recruit in the country, at the moment he commits. Read
    // here rather than at signing day because `rank` is a fact about the class
    // as it was published and the class is regenerated at the year roll — by
    // signing day the man is on a roster and the board he was ranked on is gone.
    const chair = season.teams[userTeam];
    const top = mineThisWeek.find((c) => c.prospect.rank === 1);
    if (top && chair) {
      const won = awardTopRecruit(
        get().coach.achievements, get().year, chair.def.abbr, top.prospect.player.name,
      );
      if (won.length > 0) {
        set({ unseenTrophies: [...get().unseenTrophies, ...won] });
      }
    }

    // The staff tends its list (a replacement for anyone this close lost) and
    // puts next week on the board, so the band shows it the moment the week
    // opens. A no-op past the last week.
    if (!worksOwnBoard) get().staffPlanWeek();

    // A closed week is banked points, commitments and a burned third of the
    // window — irreversible, and until now unsaved.
    get().autosave();
  },

  syncRecruitingCalendar: () => {
    const season = get().season;
    if (!season || get().phase !== null || get().busy) return;
    // A recruiting week remains live for the whole baseball week. Close it
    // only once the schedule has actually crossed into the following week.
    // The earlier conversion used `<= currentWeek`, which banked Week 1 after
    // Wednesday's first game and silently stole the Friday/Sunday recruiting
    // window. At season end, close every remaining week.
    const currentCalendarWeek = season.schedule[season.dayIndex]?.week ?? (RECRUITING_WEEKS + 1);
    const target = seasonComplete(season)
      ? RECRUITING_WEEKS
      : Math.max(0, currentCalendarWeek - 1);
    let guard = 0;
    while (season.recruiting.week >= 1
      && season.recruiting.week <= RECRUITING_WEEKS
      && season.recruiting.week <= target
      && guard++ < RECRUITING_WEEKS + 1) {
      get().advanceRecruitingWeek();
    }
  },

  keepPlayer: (id, pitch, offer) => {
    const { season, userTeam, coach, version, phase } = get();
    const board = season?.draft;
    if (!season || !board || phase !== 'draft') return;
    const man = board.men.find((m) => m.player.id === id);
    if (!man || man.outcome !== 'pending') return;

    const stars = prestigeStars(season.teams[userTeam]?.prestige ?? 50);
    const left = flexibleOffseasonBudget(stars) - board.spent;
    const scene = sceneFor(season, userTeam, coach, man.player, man.round);
    const { spent, kept } = makeTheCase(man, pitch, offer, scene, left, leversFor(coach.badges).caseWorth);
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
      /*
        And he is not an alumnus. The book is written on the way into the
        draft step, one note per man the clubs took, before the coach has had
        his say — and the note stood after he was talked round. Reported
        2026-09-10: "there are 2 players I talked into returning and when the
        season started I went to alumni and they were there but also in my
        roster." Torn up here; `withoutRosterMen` heals the saves from before.
      */
      if (String(id) in get().alumni) {
        const notes = { ...get().alumni };
        delete notes[String(id)];
        set({ alumni: notes });
      }
    }
    set({ version: version + 1 });
    get().autosave();
  },

  releasePlayer: (id) => {
    const { season, version, phase } = get();
    const man = season?.draft?.men.find((m) => m.player.id === id);
    if (!man || phase !== 'draft') return;
    letHimGo(man);
    set({ version: version + 1 });
    get().autosave();
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
    set({ overlay: null, overlayStack: [], selectedPlayer: null, coachSeat: null, spentThisStep: {} });

    const next = stepAfter(phase, rulesOf(season));

    if (next === 'review') get().settleSeason();

    /*
      A sacked coach does not run the school’s winter.

      Reported 2026-09-11: "if the university doesn’t extend you, you can still
      keep going with the same university". `jobSearch` was only raised at the
      year roll, and the roll is the far side of the whole offseason — so a man
      the board had already let go spent the programme’s coaching points, worked
      its draft, shopped its portal and signed its next class before anybody
      told him to clear his desk.

      The verdict is the end of the tenure. Leaving the review turns the year
      over from here, and the roll builds the market it always built for him.
      Sacked or simply not renewed: `fired` covers both, which is the thing
      the report asked for.
    */
    /*
      A finished career does not run the school's winter either.

      Two ways in and the same door: a farewell announced in the spring, and
      the years running out on a man who never announced anything. Both are
      settled by now — the meeting above has already graded the last season
      and written it into the history — so there is a whole career to put in
      the book and nothing left to coach.

      Checked before the sacking for the reason `rivals.ts` checks it before
      the sacking: a man at the end of his last season did not get sacked, he
      finished. See `retirementStatus`.
    */
    if (phase === 'review' && careerFinished(get())) {
      await get().endCareer();
      return;
    }

    /*
      And a man who handed in his notice leaves at the same door (2026-09-30).
      The meeting above could not sack or renew him; leaving it ends the
      tenure, he pays for the years left on the deal, and the roll puts him
      on the market. After the retirement check, so a farewell that wins pays
      nothing.
    */
    const resigning = get().coach.resignYear === get().year;
    if (phase === 'review' && (get().lastReview?.fired || resigning)) {
      /*
        And the winter runs whether or not he is here to work it.

        A career that ends at this meeting never reaches the draft step, where
        the league graduates its seniors, develops everybody who stays and
        settles the board. Without these three lines the whole country skipped
        a year every time a coach was sacked or retired: no graduations, no
        development, and the next class signed onto ninety-six rosters that had
        never been emptied. The man leaving does not see any of it, which is
        exactly why it was missed.
      */
      if (resigning && !get().lastReview?.fired) chargeResignation(get, set);
      winterWithoutHim(get, set);
      set({ phase: null });
      await get().rollYear();
      if (resigning && get().jobSearch) {
        // The roll saved before this letter was posted; save it too, as `resign` does.
        postResignation(get);
        await get().saveNow();
      }
      return;
    }

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
      // The season's verdict on every man, before the portal asks him.
      settleTheMoods(season, get().userTeam, leversFor(get().coach.badges).moodSwing);
      const pool = openPortal(season.teams, {
        year: get().year, seed: season.seed ?? 0, batting: season.batting, pitching: season.pitching,
        // THE KEEPER, on the coached program only (coachEdges.ts).
        exitFor: (team) => (team === get().userTeam ? leversFor(get().coach.badges).portalExit : 1),
      });
      /*
        And the other ninety-five ring their own men before anybody else does.

        The draft has had `rivalKeeps` since the ninety-five got decisions of
        their own; the portal never grew the matching half, so a rival’s best
        player walked every winter and nobody so much as asked him to stay. A
        man who is held is simply not in the pool — he is still on the roster
        he was always on. Half the winter’s flexible money, because the other
        half is what the same staff shops with.
      */
      const held = new Set<PlayerId>();
      for (const other of season.teams) {
        if (other.index === get().userTeam) continue;
        const leaving = pool.filter((m) => m.from === other.index);
        if (leaving.length === 0) continue;
        const keepBudget = flexibleOffseasonBudget(prestigeStars(other.prestige)) / 2;
        for (const m of rivalHolds(other.team, leaving, keepBudget)) {
          held.add(m.player.id);
          // Onto the same one-pool ledger a signing goes onto, so what a staff
          // spends holding a man is money it cannot also spend shopping.
          (season.portalSpend ??= {})[other.index] =
            (season.portalSpend[other.index] ?? 0) + m.cost;
        }
      }
      const open = pool.filter((m) => !held.has(m.player.id));
      const mine = open.filter((m) => m.from === get().userTeam);
      const theirs = open
        .filter((m) => m.from !== get().userTeam)
        .sort((a, b) => overallOf(b.player) - overallOf(a.player));

      /*
        The wire hears about the big ones — the assistant's other card,
        asked for by name: "rumors that a very high ranking player is going
        into the portal." Worded as rumour, never a stat line, per the
        plan. The rarity that makes this an event (roughly one winter in
        five or six) is stage 16's portal-balance knob, STAR_WANDER — landed
        — and the threshold is the same STAR_LINE the model itself uses, so
        the mail and the mechanism cannot drift apart. The cap of two stays
        as a belt against a rich market year.
      */
      for (const m of theirs.filter((x) => overallOf(x.player) >= STAR_LINE).slice(0, 2)) {
        const fromRec = season.teams[m.from];
        get().post({
          kind: 'wire', year: get().year,
          title: `Word is ${m.player.name} wants out`,
          body: `Coach — ${fromRec?.def.school ?? 'somebody'}'s locker room has `
            + 'a draught. Two people heard it from the same guy, which around '
            + 'here counts as confirmed.',
          link: { to: 'player', id: m.player.id },
        });
      }

      if (rec && !handles(get().depth, 'portal')) {
        // Your staff, out of sight. It still costs the same budget, so a
        // casual career is not quietly richer than a full one.
        const budget = flexibleOffseasonBudget(prestigeStars(rec.prestige))
          - (season.draft?.spent ?? 0);
        const took = staffWorksPortal(rec.team, theirs, budget);
        for (const m of took) {
          const from = season.teams[m.from];
          if (from) releaseFrom(from.team, m.player.id);
        }
        // And onto the one-pool ledger, exactly as a hands-on signing goes.
        (season.portalSpend ??= {})[get().userTeam] =
          (season.portalSpend[get().userTeam] ?? 0)
          + took.reduce((a, m) => a + m.cost, 0);
        if (took.length > 0) {
          set({
            portalArrivals: [
              ...get().portalArrivals, ...took.map((m) => m.player.name),
            ],
          });
        }
        // What the staff spent is what the card counts and the keeps are
        // budgeted against: the step's own ledger said nought (M73).
        // The rest of the national pool stays in `available`: it is what
        // `closePortal` hands the other 95 staffs. Emptied here so the screen
        // would read "your staff is working it", it shut the market for
        // everyone (audit 17, H1). The screen reads the switch instead.
        const signed = new Set(took.map((m) => String(m.player.id)));
        set({ portal: {
          leaving: mine,
          available: theirs.filter((m) => !signed.has(String(m.player.id))),
          spent: season.portalSpend[get().userTeam] ?? 0,
        } });
      } else {
        set({ portal: { leaving: mine, available: theirs, spent: 0 } });
      }
    }

    // The portal closes as the step is left. See `closePortal`.
    if (phase === 'portal' && next === 'signing') closePortal(get, set);

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
      settleTheDraft(get);

      /*
        Guarded the same way `departAndDevelop` is, and for the same reason:
        the rail lets you walk back to the draft step and come forward again.
        `seedRivalInterest` is explicitly additive — run twice it doubled the
        whole country's head start on the class — and rewinding `week` to 1
        handed the player a fresh three-week window with the weeks already
        played still banked. First arrival seeds the board and starts the
        clock; a revisit changes neither.
      */
      set({
        phase: next,
        furthestPhase: Math.max(get().furthestPhase, PHASES.indexOf(next)),
        // A fresh window starts with a fresh board. Last year's "week 3 is
        // over" recap surviving into this year's week 1 read as the window
        // being already finished.
        lastWeek: null,
        version: get().version + 1,
      });
      get().autosave();
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
      bookTheYear(get);
      get().noteSeasonNews();

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
      leagueWinter(get, set);
      set({
        phase: next,
        furthestPhase: Math.max(get().furthestPhase, PHASES.indexOf(next)),
        version: get().version + 1,
      });
      // 'Draft conversations' handed to the staff: they make the cases the
      // other ninety-five make for their own men (M72).
      if (!handles(get().depth, 'draftTalk')) staffAnswersTheClubs(get);
      get().autosave();
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
    get().autosave();
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
    if (season) applyCoachMods(season, userTeam, next, get().economy);
    set({
      coach: next,
      spentThisStep: { ...spentThisStep, [skill]: (spentThisStep[skill] ?? 0) + 1 },
      version: version + 1,
    });
    // The point is already off the coach; a reload before the draft step's save
    // used to lose the rating while keeping it spent.
    get().autosave();
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
    if (season) applyCoachMods(season, userTeam, next, get().economy);
    set({
      coach: next,
      spentThisStep: { ...spentThisStep, [skill]: on - 1 },
      version: version + 1,
    });
    get().autosave();
  },

  advanceDay: () => {
    const { season, version, busy } = get();
    // `busy` because a day simmed on the main thread while the worker holds the
    // season is a day simmed into an object the worker's result will replace;
    // `live` because tonight's game is still being played and the day it
    // belongs to must not pass underneath it.
    // And not while a managed game is starting: its day must not be simmed
    // out from under it (audit 17, M84).
    if (!season || busy || get().live || get().liveStarting || seasonComplete(season)) return;
    const hold = unresolvedRosterDecision(season, get().userTeam, get().depth);
    if (hold) {
      set({ lineupGate: get().lineupGate + 1 });
      get().go('team', 'lineup', hold.id);
      return;
    }
    // A casual coach's card is filled out before the day is played, not after,
    // or the nine names the game used would be yesterday's.
    if (!handles(get().depth, 'lineups')) staffSetsTheCard(season, get().userTeam);
    get().noteRoster('prime');
    simNextDay(season);
    set({ version: version + 1 });
    get().noteRoster('report');
    get().syncRecruitingCalendar();
    get().noteSeasonNews();
    // A day is a game for every team in the country; it was the largest single
    // mutation in the game that never wrote a save.
    get().autosave();
  },

  playSeason: async () => {
    set({ simError: null });
    const { season, busy } = get();
    if (!season || busy) return;
    const hold = unresolvedRosterDecision(season, get().userTeam, get().depth);
    if (hold) { set({ lineupGate: get().lineupGate + 1 }); get().go('team', 'lineup', hold.id); return; }
    set({ busy: true, progress: null });
    const generation = ++simGeneration;

    if (!workerAvailable) {
      // No worker: the screen freezes, but the game still works. Better a hang
      // than a dead button. Caught like the worker path is — a throw here
      // used to pin `busy` for good and the app went dead (05 §62.6).
      try {
        simSeason(season);
        set({ version: get().version + 1, busy: false });
        get().syncRecruitingCalendar();
        get().noteSeasonNews();
        get().autosave();
      } catch (e) {
        set({ busy: false, progress: null, simError: e instanceof Error ? e.message : String(e) });
      }
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
      /*
        The recruiting calendar, banked the way every other path banks it.

        Recruiting runs alongside the schedule now (05 §63.6) and the weeks
        close when the season crosses them. The no-worker branch above syncs;
        this one did not — and `workerAvailable` is true in every browser, so
        the branch that shipped was the branch nobody tested. One press of SIM
        THE SEASON left `recruiting.week` at 1, closed nothing, and signed
        nobody: the whole country's class was voided and all ninety-six
        rosters refilled from walk-ons. Nothing downstream recovers it —
        `syncRecruitingCalendar` refuses once a phase is open, and no
        offseason step banks a week.
      */
      get().syncRecruitingCalendar();
      // A whole year arriving at once is still a year of things that happened
      // to you, and the scan is written so that a season simmed in one press
      // files the same cards as one walked through a day at a time.
      get().noteSeasonNews();
      get().autosave();
    } catch (e) {
      // Its own channel — see simError on the store. The save banner used to
      // wear this failure, and its retry saved instead of simulating.
      set({
        busy: false,
        progress: null,
        simError: e instanceof Error ? e.message : String(e),
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
  openOffseason: () => {
    const { lastPostseason, season, userTeam } = get();
    if (!lastPostseason) return;
    if (season) ceremonyOf(season, userTeam, lastPostseason);
    set({ phase: 'awards' });
  },

  settleSeason: () => {
    const { season, userTeam, coach, lastPostseason: post } = get();
    const me = season?.teams[userTeam];
    if (!season || !me || get().lastReview) return;
    // Once per year. The card above is a thing the player dismisses, and the
    // offseason rail lets him walk back to AWARDS after he has; guarded only
    // on the card, a second pass doubled his career record and wrote a second
    // history row for the same season (05 §62.3).
    if (get().history.some((h) => h.year === get().year)) return;

    // The regular season is what the board's win target was written against —
    // bracket wins are counted by their own boxes, not folded into the total.
    const played = regularRecord(me);
    const outcome: SeasonOutcome = {
      wins: played.w,
      losses: played.l,
      conferenceRank: standings(season, me.conference).findIndex((t) => t.index === me.index) + 1,
      conferenceSize: season.teams.filter((t) => t.conference === me.conference).length,
      madeConferenceTournament: conferenceField(season, me.conference).field.includes(me.index),
      ...boardFacts(season, me, true),
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
    me.drought = outcome.madeConferenceTournament ? 0 : (me.drought ?? 0) + 1;
    outcome.drought = me.drought;
    // The title drought too — the summit reads it; see summitDrag.
    me.sinceTitle = outcome.wonTitle ? 0 : (me.sinceTitle ?? 0) + 1;
    outcome.sinceTitle = me.sinceTitle;

    /*
      Judged against the country as it is now, like everybody else. See
      `playerBoard` — the drift correction every rival board gets was never
      handed to the player's, and thirty seasons of league inflation landed
      on him alone.
    */
    /*
      Judged against the checklist he was shown in February, not one recomputed
      off the June roster. The board object still forms fresh — renew and sack
      bars read patience, which is current — but its expectation is the stamped
      one, so the promise and the verdict are the same numbers. The fallback
      recompute only fires for a save from before the stamp existed.
    */
    const board = playerBoard(
      me.prestige, rosterStrength(me.team), seasonLength(season.config),
      me.culture?.patience, leagueShape(season.teams),
    );
    const ask = get().boardAsk;
    if (ask) board.expectation = ask;
    // The one rule of the world that reaches a single chair: a world opened
    // with firing off hands this board the verdict and takes away the sack
    // (`SeasonRules.firing`; 05 §82). The other ninety-five never see it.
    if (!rulesOf(season).firing) board.tenured = true;
    const review = reviewSeason(
      // A man who announced this as his last is reviewed like anybody else and
      // cannot be sacked out of a season he has already left. Read off the
      // store rather than the `year` bound further down this function, which
      // does not exist yet here. A man who has handed in his notice is
      // reviewed the same way: never sacked, never renewed or extended.
      { ...coach, farewell: coach.farewellYear === get().year || coach.resignYear === get().year },
      me.prestige, rosterStrength(me.team), outcome, seasonLength(season.config),
      board,
    );
    /*
      In words that know what year it is. `reviewSeason` speaks for ninety-six
      chairs; this board's headline and paragraph are chosen off the seasons
      before this one, and rotate by year (05 §90.9).
    */
    {
      /*
        Except for a farewell. Every line `boardWords` can choose from is a
        board deciding what to do about next year — "five years left to
        convince them" — and there is no next year to convince anybody in.
        `reviewSeason` already wrote the one sentence that fits, so leave it.
        The same for a man on notice: there is no next year here for him.
      */
      if (coach.farewellYear !== get().year && coach.resignYear !== get().year) {
        const words = boardWords(review, { prior: get().history, tenure: coach.tenure, year: get().year });
        review.headline = words.headline;
        review.message = words.message;
      }
    }

    /*
      MORE THAN HE HAD and TRADITIONALIST (coachEdges.ts): a good year's gain
      goes further under the first, and any gain at a school that prizes its
      history goes further under the second. Only a gain; a fall is a fall.
      Written onto the review so the meeting shows the number that lands.
    */
    {
      const gain = review.prestigeAfter - review.prestigeBefore;
      if (gain > 0) {
        const lv = leversFor(coach.badges);
        const goodYear = review.verdict === 'exceeded' || review.verdict === 'met';
        const prized = cultureFor(me)?.edge === 'tradition';
        const mult = (goodYear ? lv.goodYearPrestige : 1) * (prized ? lv.traditionPrestige : 1);
        if (mult !== 1) review.prestigeAfter = Math.min(100, review.prestigeBefore + Math.round(gain * mult));
      }
    }
    // Prestige belongs to the school and survives a coaching change.
    me.prestige = review.prestigeAfter;
    /*
      And what he has built with it, banked every season rather than on the
      way out -- the rule every rival's board meeting keeps (`runRivalYear`).
      Nothing called `bankStint` before, so the player's `bestBuild` sat at
      nought and Builder was a title only the other ninety five could wear.

      A move needs nothing of its own. Outside god mode this meeting is the only
      thing that moves his program's prestige, so the number `takeChair`
      carries to the next chair is already the last one's final word.
    */
    const bestBuild = bankStint(coach, me.prestige).bestBuild ?? 0;

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
    // Assistants who are ready for their own program enter the SAME national
    // carousel as every other coach. This is the coaching tree becoming part of
    // the world rather than a trophy list disconnected from it.
    const staffPoaches = SEATS
      .map((seat) => ({ seat, man: get().economy.staff[seat] }))
      .filter((x): x is { seat: StaffSeat; man: Assistant } =>
        !!x.man && rulesOf(season).poaching && poached(x.man, year));
    const extraFreeAgents: FreeAgent[] = staffPoaches.map(({ man }) => ({
      coach: coachFromAssistant(man, coach.prestige),
      from: -1,
    }));
    const rivals = runRivalYear(season, post, {
      year,
      userTeam,
      games: seasonLength(season.config),
      // A man who announced his last season in the spring is as gone as a
      // sacked one by the time the carousel sits down, and his chair belongs
      // on the same market. A decision taken later — at the meeting itself —
      // misses this winter, and the chair is filled by `seatCoaches` the
      // moment his successor signs anywhere. A man on notice, likewise.
      userOpen: review.fired || coach.farewellYear === year || coach.resignYear === year,
      extraFreeAgents,
    });
    // Their benches changed hands, so the edge every one of their games is
    // played with has to be restamped before the next season starts.
    syncCoachMods(season, userTeam, withStaff(coach.skills, get().economy.staff), {
      armCare: armCareFor(get().economy.staff),
      injuryGuard: (FACILITIES[get().economy.facilities]?.injuryGuard ?? 1) * facilityEffects(get().economy).guard * staffProjectInjuryGuard(get().economy, season.recruiting.week <= RECRUITING_WEEKS),
    });

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
      reviewDismissed: false,
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
        contractLength: review.contractLength,
        // His overall record, June included, as his season rows are: the
        // total counted the regular season only, and the Career page's header
        // never equalled its own rows (audit 17, M60). The board still grades
        // the regular season, through \`outcome\`.
        careerWins: coach.careerWins + me.w,
        careerLosses: coach.careerLosses + me.l,
        titles: coach.titles + (outcome.wonTitle ? 1 : 0),
        conferenceTitles: coach.conferenceTitles + (outcome.wonConference ? 1 : 0),
        regionalTitles: coach.regionalTitles + (outcome.wonRegional ? 1 : 0),
        tournaments: coach.tournaments + (outcome.madeTournament ? 1 : 0),
        skillPoints: coach.skillPoints + skillPoints(outcome),
        bestBuild,
      },
      version: get().version + 1,
    });
    // 'Coaching points' handed to the staff: they go to his strongest suit,
    // as the Settings row says. Nothing read the switch (audit 17, M72).
    if (!handles(get().depth, 'skillPoints')) staffSpendsPoints(get, set);

    // The verdict letter retired at the reporter's ask: the board's word is
    // now the season opener the new year begins with — reviewed and
    // accepted, beside the NEW asks — rather than a card in the pile. The
    // prestige-hit letter below stays: a penalty deserves its own paper.
    if (review.prestigePenalty > 0) {
      get().post({
        kind: 'board', year,
        link: { to: 'program', sheet: 'coach' },
        title: 'Your prestige has taken a hit',
        // "We go again" is next year's line, and a man leaving has none here.
        body: `Coach — word travels. ${review.prestigePenalty} points off your `
          + 'name, on top of the season itself.'
          + (coach.farewellYear === year || coach.resignYear === year ? '' : ' We go again.'),
      });
    }
    /*
      Achievements leave the inbox for a red dot on the door — the
      reporter's ask: "instead of getting them in the inbox, add the red
      dot where we need to go and see it." They live in the cabinet on
      PROGRAM, so the PROGRAM tab wears the dot until the cabinet is read.
    */
    if (earned.length > 0) {
      set({ unseenTrophies: [...get().unseenTrophies, ...earned] });
    }
    postCarousel(get(), year, me.conference, rivals.moves);

    // Prestige, the coach's career line, skill points, the history entry and a
    // whole rival year just happened; none of it was persisted before the draft
    // step's save, so a reload from the review or coach screens lost it all.
    get().autosave();
  },

  rollYear: async () => {
    const { season, year, busy } = get();
    if (!season || busy) return;
    set({ busy: true });
    /*
      Everything below runs guarded. The one `busy: false` on this path sits
      inside `finish()` at the very end, so a throw anywhere in the roll —
      the year's rosters, the carousel, the schedule — froze the app for
      good with a save on disk that reloaded into the same state (05 §62.6).
    */
    try {
    // See pendingGame in the reset below: last year's interrupted game cannot
    // be resumed against next year's season, so the journal dies with the year.
    clearJournal();

    /*
      The inbox turns over with the year — reported: "we need to clean the
      inbox every time a season is over." Wiped here, before the winter is
      posted, so realignment, poaching and the carousel open the new year's
      mail on a clean desk instead of under last season's pile.
    */
    /*
      Except the hall. A man goes in at the draft step and the letter that
      says so was wiped here, a step later, before anybody who had not opened
      the inbox during the winter could read it. Reported 2026-09-16: "when a
      player is inducted to the hall of fame, we should be notified." The
      unread hall letters cross into the new year, and the opener names the
      men as well.
    */
    set({ inbox: get().inbox.filter((i) => i.kind === 'hall' && !i.read) });

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
    // A "poach" only becomes a departure when the national carousel actually
    // gives the assistant a chair. Interest without an offer should not make a
    // paid employee vanish into an off-screen free-agent pool.
    // Where each poached assistant landed, resolved once for the letter and
    // for the tree below — by the id `coachFromAssistant` stamped on his
    // record, never by name: a rival who happens to share it is not your man.
    const landings = new Map<StaffSeat, (typeof season.teams)[number]>();
    for (const seat of SEATS) {
      const man = eco0.staff[seat];
      if (!man || !poached(man, year)) continue;
      const chair = season.teams.find((t) => t.coach?.fromAssistant === man.id);
      if (chair) landings.set(seat, chair);
    }
    let poachNews: { name: string; seat: StaffSeat } | null = null;
    for (const seat of SEATS) {
      const man = eco0.staff[seat];
      if (!man) continue;
      const landing = landings.get(seat);
      if (landing) {
        poachNews ??= { name: man.name, seat };
        get().post({
          kind: 'season', year: year + 1,
          /*
            The subject names the ROLE and the body carries the school.

            Reported 2026-09-12: "right now I got 'x got x university jo'".
            Two faults in that — the subject never contained the words 'head
            coach' at all, and the mailbox clips a subject to one line, so a
            long school name lost its own last syllable. The wire has said it
            properly all along ("lose their pitching coach to a head job");
            the inbox was the odd one out. The link already opens his new
            program, so nothing is lost by moving the school down a line.
          */
          title: `${man.name} is a head coach now`,
          body: `Coach — ${landing.def.school} have made your ${SEAT_LABEL[seat].toLowerCase()} their head coach. He spent ${Math.max(1, year - (man.joinedYear ?? year) + 1)} years on your staff. The seat is open.`,
          link: { to: 'team' as const, index: landing.index },
        });
      } else if (man.until !== undefined && man.until <= year) {
        // His contract ran out and nobody renewed it in the winter: the seat
        // opens with the year, and the letter says so by name.
        get().post({
          kind: 'season', year: year + 1,
          title: `${man.name}'s contract ends`,
          body: `Coach — your ${SEAT_LABEL[seat].toLowerCase()} was signed through ${man.until} and was not renewed. The seat is open.`,
        });
      } else {
        // A man from a save before contracts is stamped one here, two more
        // seasons, so nothing expires without the winter to see it coming.
        keptStaff[seat] = developAssistant({ ...man, until: man.until ?? year + 2 }, year + 1);
      }
    }
    // Refresh the career line of every branch while he is still in the world.
    // If he later retires or falls out of the carousel, the last known record
    // remains in the tree instead of disappearing with the chair.
    const tree = (eco0.tree ?? []).map((branch) => {
      const chair = season.teams.find((t) => t.coach?.fromAssistant === branch.id);
      const c = chair?.coach;
      return c && chair ? {
        ...branch,
        lastSchool: chair.def.school,
        careerWins: c.careerWins,
        careerLosses: c.careerLosses,
        titles: c.titles,
        active: true,
      } : { ...branch, active: false };
    });
    for (const seat of SEATS) {
      const man = eco0.staff[seat];
      if (!man) continue;
      const landing = landings.get(seat);
      if (!landing?.coach || tree.some((b) => b.id === man.id)) continue;
      const joined = man.joinedYear ?? year;
      tree.push({
        id: man.id,
        name: man.name,
        seat,
        joinedYear: joined,
        leftYear: year + 1,
        yearsWithYou: Math.max(1, year - joined + 1),
        lastSchool: landing.def.school,
        careerWins: landing.coach.careerWins,
        careerLosses: landing.coach.careerLosses,
        titles: landing.coach.titles,
        active: true,
      });
    }
    const rolledEconomy: Economy = agePipelines({
      ...eco0, staff: keptStaff, tree, spent: 0, scouted: {},
      // A season's work never crosses the year: it lands as week 12 closes, and
      // anything that did not is dropped here (the focus stays).
      staffPlans: Object.fromEntries(SEATS.filter((seat) => keptStaff[seat]?.id === eco0.staff[seat]?.id && keptStaff[seat]).map((seat) => {
        const plan = staffPlan(eco0, seat);
        return [seat, plan.project?.season ? { directive: plan.directive } : plan];
      })),
    }, year + 1);
    if (!handles(get().depth, 'facilities')) {
      // The AD keeps the weakest specialty moving instead of marching through a
      // generic ladder. One project a winter, with headroom for staff/scouting.
      const me0 = get().season?.teams[get().userTeam];
      const prestige = me0?.prestige ?? 40;
      const choices = BUILDINGS
        .map((b) => {
          const level = facilityLevel(rolledEconomy, b.key);
          const nextLevel = level + 1;
          return { b, level, nextLevel, cost: facilityUpgradeCost(b.key, nextLevel) };
        })
        .filter((x) => x.nextLevel <= FACILITY_MAX_LEVEL)
        // No standing reserve on top: the wage cap already keeps money
        // back, and with the staff retained the old +300 could never be met.
        .filter((x) => remaining(rolledEconomy, prestige) >= x.cost)
        .sort((a, b) => a.level - b.level || a.cost - b.cost);
      const pick = choices[0];
      if (pick) {
        const built = rolledEconomy.built ?? [];
        if (!built.includes(pick.b.key)) rolledEconomy.built = [...built, pick.b.key];
        rolledEconomy.facilityLevels = {
          ...(rolledEconomy.facilityLevels ?? {}),
          [pick.b.key]: pick.nextLevel,
        };
        // Off the UPDATED list. Reading `built` here, captured before the
        // push, left the rung one behind on every new building until the
        // next winter — the old-ladder readers under-applied for a season.
        rolledEconomy.facilities = Math.min(MAX_FACILITY, (rolledEconomy.built ?? []).length);
        rolledEconomy.spent += pick.cost;
      }
    }
    if (!handles(get().depth, 'assistants')) {
      const me = get().season?.teams[get().userTeam];
      const prestige = me?.prestige ?? 40;
      for (const seat of SEATS) {
        if (rolledEconomy.staff[seat]) continue;
        const affordable = marketFor(String(season.seed ?? 0), year + 1, seat)
          .filter((m) => adCanPay(rolledEconomy, prestige, m.wage))
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
    /*
      Out of the chair: sacked, or resigned (`year` is still the old year
      here). Never a man who has retired — `endCareer` rolls through here too,
      and a market built for him posts letters nobody is there to read.
    */
    const outOfChair = get().coach.retiredYear === undefined
      && (review?.fired === true || get().coach.resignYear === year);

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
      const move = rulesOf(season).realignment
        ? realignmentFor(String(next.seed ?? 0), year, next.teams, get().userTeam)
        : null;
      if (move) {
        const riser = next.teams[move.up]?.def;
        const faller = next.teams[move.down]?.def;
        applyRealignment(next.teams, move);
        const mine = move.up === get().userTeam;
        const touchesMe = mine
          || next.teams[get().userTeam]?.conference === move.upTo
          || next.teams[get().userTeam]?.conference === move.downTo;
        // Scoped in the noise cut: realignment that does not touch your
        // leagues is the rankings table's business, not the desk's.
        if (touchesMe) {
          get().post({
            kind: 'season', year: year + 1,
            title: mine
              ? `You are moving up: ${move.upTo} baseball`
              : `Realignment: ${riser?.school ?? '?'} join the ${move.upTo}`,
            body: mine
              ? `Coach — the ${move.upTo} called and the board said yes before `
                + `the phone was down. ${faller?.school ?? 'Somebody'} goes the `
                + 'other way. Pack for better ballparks.'
              : `Coach — they traded places with ${faller?.school ?? '?'}. `
                + 'Your league reads different in the spring.',
          });
        }
      }

      /*
        The name pool from the save, not from the session (audit 17, M42). A
        name already taken costs another draw, so the pool steers the season
        RNG through the 720-man class drawn here. A running app still held
        every graduated rival's name; a reload of the same save did not, and
        the two drew different worlds. Rebuilt here, both paths draw from the
        pool a load would build.
      */
      rebuildNameIndex(next);
      const rolled = nextSeason(next);
      {
        // The coached programme is never seeded: a staff works only the
        // coach's list (2026-09-30).
        seedRivalInterest(rolled, get().userTeam, false);
      }

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
      /*
        Settled already, at the portal step, for every man in the country
        (`settleTheMoods`). The roll only settles a winter the rail never
        walked through that step -- there is no such winter on the rail
        today, and this is what keeps a mood from being judged twice.
      */
      const settled = season.moraleSettled === true
        // The belt, for a winter whose portal step wrote the flag before the
        // flag existed. A world with the portal switched off never walks that
        // step at all, so `furthestPhase` passing its index proves nothing and
        // the settle has to happen here.
        || (rulesOf(season).portal && get().furthestPhase >= PHASES.indexOf('portal'));
      const mineNow = rolled.teams[get().userTeam];
      if (mineNow) {
        // One body once: a two-way man's mood, grades and winter healing
        // settle a single time however many units carry him.
        const men = uniquePlayers([
          ...squad(mineNow.team), ...mineNow.team.rotation, ...mineNow.team.bullpen,
        ]);
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
          // A promise that has been judged for every season it covered comes
          // off him now, BEFORE this roll judges anything — so the portal,
          // which runs later in the same offseason, still saw a first-season
          // break, and a one-year word is not held against a junior.
          if (!settled && promiseSpent(p.recruitPromise)) delete p.recruitPromise;
          if (!settled) setMood(p, settleMood(p, {
            starts: (p as Player & { starts?: number }).starts ?? 0,
            games: played,
            squadRank: ranks.get(p.id) ?? 20,
            winPct,
            movedUnwillingly: (p as Player & { movedFrom?: string }).movedFrom !== undefined,
            promiseBroken: explicitRecruitPromiseBroken(p, {
              battingGames: get().season?.batting.get(p.id)?.g ?? 0,
              pitchingGames: get().season?.pitching.get(p.id)?.g ?? 0,
            }),
            damped: leader !== null,
          }));
          if (!settled && p.recruitPromise) p.recruitPromise.judged = (p.recruitPromise.judged ?? 0) + 1;
          // The portal has already seen the verdict. Completed obligations
          // now expire before the player starts another season.
          if (promiseSpent(p.recruitPromise)) delete p.recruitPromise;
          delete (p as Player & { starts?: number }).starts;

          driftGrades(p, get().year + 1);
          // A winter heals everything, which is why a torn ligament is a
          // season rather than a career -- these are nineteen year olds.
          healUp(p);
          resetWorkload(p);
          delete (p as Player & { outUntil?: number }).outUntil;
          if (p.type === 'hitter') {
            // A move chosen during the season is made here, on the same
            // footing as one chosen on the rail: one winter of settling
            // before opening day. See `changePosition`.
            const planned = (p as Hitter & { retrainTo?: Position }).retrainTo;
            if (planned !== undefined) {
              delete (p as Hitter & { retrainTo?: Position }).retrainTo;
              // Made from his own spot, the one the plan was chosen from, and
              // not from a cover the card still has him in: planned into the
              // spot he was covering, he read as already there and the move
              // was dropped. The card is dealt again below either way.
              restoreHome(p as Hitter);
              movePosition(p as Hitter, planned);
            }
            settleIn(p as Hitter);
          }
        }
      }
      /*
        The ninety-five others: their starts cleared and their mood settled
        too. `started` runs for every program on every game day, but only the
        coached roster ever had the count wiped or the mood read — so a third
        of the country carried more starts than the season had games, the
        portal's "buried" door was pinned shut, and no rival could ever break
        a promise: flight risk was zero for 95 of 96 programs (05 §62.4).
        Settled BEFORE the starts are cleared, on the season that just ended.
      */
      for (const other of rolled.teams) {
        if (other.index === get().userTeam) continue;
        const rec = get().season?.teams[other.index];
        const played = (rec?.w ?? 0) + (rec?.l ?? 0);
        const winPct = played > 0 ? (rec?.w ?? 0) / played : 0.5;
        const ranks = squadRanks(other.team);
        for (const p of uniquePlayers([...squad(other.team), ...other.team.rotation, ...other.team.bullpen])) {
          if (!settled) {
            setMood(p, settleMood(p, {
              starts: (p as Player & { starts?: number }).starts ?? 0,
              games: played,
              squadRank: ranks.get(p.id) ?? 20,
              winPct,
            }));
          }
          delete (p as Player & { starts?: number }).starts;
          // The winter's healing is the world's now -- `nextSeason` clears
          // every roster's shelf and arm mileage, this one included (05 §62.8).
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

      const market = outOfChair
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

      /*
        The winter's staff, priced onto the new season's benches. The sync
        above ran before the assistants developed, before the AD hired into
        vacancies and before it built — all of which landed in
        `rolledEconomy` — and `nextSeason` carries the old mods forward, so
        without this the games played a whole season on last year's staff
        until a reload, a hire or a build happened to re-sync.
      */
      // An athletic director's staff picks the new season's work on the new
      // roster, after his hires and builds; the same sync stamps the arm guard.
      if (!handles(get().depth, 'assistants')) {
        const mine = rolled.teams[get().userTeam];
        if (mine) staffPicksSeasonWork(rolledEconomy, mine.team, mine.def.state, rolled.recruiting.week, { alignFocus: true });
      }
      applyCoachMods(rolled, get().userTeam, coach, rolledEconomy);

      /*
        Opening day's card, dealt the way AUTO deals it.

        Reported 2026-09-15: "every start of the season the app should
        automatically set the best lineup just like if we went into lineup
        and tapped auto lineup ... it just keeps playing the previous year
        players even if they are worse than the freshmen." The engine's roll
        leaves the coached card alone by design (05 §62.4): graduation takes
        men off it, the class lands on the bench, and nothing dealt it again
        until the coach did. Once, here, the same press as AUTO -- the best
        nine, the order, the rotation -- and what he changes after this is
        his. A delegated card is dealt again before every day regardless.
      */
      const opening = rolled.teams[get().userTeam]?.team;
      if (opening) dealLikeAuto(opening, rolled.dayIndex);

      set({
        season: rolled,
        year: year + 1,
        version: get().version + 1,
        // The new board's number, set on opening day and held all season. A
        // fired coach gets a meaningless stamp for a chair he no longer holds;
        // acceptOffer restamps for the one he takes.
        boardAsk: boardAskFor(rolled, get().userTeam),
        arguedTerms: false,
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
        reviewDismissed: false,
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
        // Nobody is looking for a man who has stopped. `endCareer` rolls the
        // year the way a sacking does, and the market it would have built is
        // for somebody who is not coming back.
        jobSearch: outOfChair,
        // A half-closed portal never crosses the year (`closePortal` is the
        // way out of it); a belt for any exit that missed it.
        portal: null,
        portalArrivals: [],
        history: record ? [...get().history, record] : get().history,
        busy: false,
        tab: 'home', /* nav-write */
        screen: 'today', /* nav-write */
      });
      // The new class's first week, on the board before the season's first
      // day, where the staff runs recruiting. Saved with the roll below.
      get().staffPlanWeek();
      roomPicksLeader(get);
      for (const o of offers) {
        get().post({
          kind: 'offer', year: year + 1,
          title: `${o.school} want to talk to you`,
          body: `Coach — ${o.conference}, `
            + `${prestigeStars(o.prestige)} star. ${o.pitch}`,
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

      // Alumni only interrupt the inbox for the two professional moments a
      // college coach would actually remember: reaching the top level and
      // closing a top-level career. The full year-by-year path still lives on
      // the player's card, so minor-league promotions do not turn the inbox
      // into a transaction log. `proCareer` is deterministic, and the key makes
      // re-entering this phase safe.
      for (const [id, note] of Object.entries(get().alumni as Record<string, AlumnusNote>)) {
        const pro = proCareer(id, note, year + 1);
        const now = pro.find((row) => row.year === year + 1);
        if (!now || now.level !== 'THE SHOW') continue;
        const debut = now.debut === true;
        if (!debut && !now.final) continue;
        get().post({
          kind: 'season', year: year + 1,
          key: `alumni-${debut ? 'debut' : 'retire'}-${id}`,
          title: debut ? `${note.name} reaches The Show` : `${note.name} ends his pro career`,
          body: debut
            ? `One of your former players made the highest level. ${now.line}`
            : now.line,
          link: { to: 'player', id },
        });
      }
      get().autosave();
    };

    // Departures and development already ran, on the way into the draft step.
    // What is left is the half that needed a signed class to exist: the recruits
    // go on the roster, and walk-ons fill whatever the class did not.
    await breathe();
    const filled = fillRosters(season, season.rng, {
      userTeam: get().userTeam,
    });
    // The freshmen nobody will play, sat for the year by the staff -- every
    // program's, and the coached one's when the coach asked not to be asked.
    staffSitsTheFreshmen(season, get().userTeam, handles(get().depth, 'redshirts'));
    // Pipeline 2.0: a market gets stronger because you actually landed
    // players from it, not because a toggle says it is a pipeline. The same
    // relationship follows the staff and cools gradually when ignored.
    for (const signed of filled.signed) {
      const updated = addPipelineSigning(rolledEconomy, signed.state, year + 1, signed.stars);
      rolledEconomy.pipelines = updated.pipelines;
    }
    const report: OffseasonReport = {
      ...(get().lastOffseason ?? {
        graduated: [], drafted: [], recruits: 0, signed: [], walkOns: [],
        developmentNet: 0, improved: 0, declined: 0, badges: [], holes: [],
      }),
      recruits: filled.recruits,
      signed: filled.signed,
      walkOns: filled.walkOns,
    };
    /*
      The winter, in one page — chosen from the phone: "I like the
      card/email when the season starts letting you know whatever super
      important at the beginning." The reporter lost Hans Hood to the July
      draft and only found the letter days later, so the season now opens
      with ONE letter that leads with exactly the things a coach would be
      angriest to learn late: signed kids the pros took, and the men the
      draft pulled off the roster. Posted last so it sits newest and
      unread at first pitch; every individual letter it summarises is
      still underneath it. Quiet winters write no letter at all.
    */
    {
      /*
        Only the surprises make the opener — refined from the phone: "don't
        add the players that left in the draft or graduated; just if a
        recruit ends up not coming to the team, and the board mandates."
        The draft was its own screen and its own night; a signed kid
        silently never arriving is the one roster fact nothing else showed.
      */
      // The July high-school draft that used to write the one sting here
      // went on 2026-09-10 — a signed kid always arrives now — so the list
      // stays empty until the winter grows another surprise worth the opener.
      const lines: string[] = [];
      for (const m of (season.hall ?? []).filter((m) => m.year === year)) {
        lines.push(`${m.name} went into the hall of fame.`);
      }
      // The roll is finished and committed here, so everything the opener
      // reads below — the ask, the year — is the new season's.
      // A frame first: `done` builds next spring (audit 17, H4).
      await breathe();
      done(season, report);
      /*
        The season opener — the reporter's design, from the phone: "the
        board is delighted notification could be something we need to
        accept and review at the beginning of the year, with the new board
        expectations also showing there," and "the winter letter should
        open like a modal once the offseason ends." One modal at the top of
        the new season: last year's verdict in the board's own words, what
        it did to both names, the NEW asks, and the winter's stings.

        `done` is called above this now, and the comment that used to sit
        here said it already was — "the boardAsk read here is the fresh
        stamp — the roll set it above, before this runs" — while the call
        sat thirty lines BELOW. So the opener carried the PREVIOUS season's
        ask: last year's target, last year's summary and detail, so a mandate
        that had just changed was described in the old mandate's words.
        Reported 2026-09-12: "the start of the season banner card says the
        team is looking for x wins but then we press go to the board and they
        are asking for a different number."

        `review` is the outer binding captured before the roll, not a fresh
        read — `done` nulls `lastReview` on its way through, and that is
        exactly why it could not be called first before.
      */
      const ask = get().boardAsk;
      if (review && ask) {
        const winter = get().lastOffseason;
        set({
          seasonOpener: {
            year: get().year,
            headline: review.headline ?? BOARD_HEADLINE[review.verdict],
            message: review.message,
            schoolBefore: review.prestigeBefore,
            schoolAfter: review.prestigeAfter,
            coachBefore: review.coachPrestigeBefore,
            coachAfter: review.coachPrestigeAfter,
            askSummary: ask.summary,
            askDetail: ask.detail,
            targetWins: ask.targetWins,
            stings: lines,
            departed: winterLosses(winter, get().userTeam),
          },
        });
        // The opener is in the save (05 §90.10), but `done` saved before it
        // was written: a reload on opening day lost the terms, and the Season
        // plan that follows them.
        get().autosave();
      }
    }
    } catch (e) {
      set({ busy: false, progress: null, simError: e instanceof Error ? e.message : String(e) });
    }
  },

  history: [],
  jobSearch: false,
  lastPostseason: null,
  bracket: null,
  furthestPhase: 0,
  goPhase: (phase) => {
    const at = PHASES.indexOf(phase);
    if (at < 0 || at > get().furthestPhase) return;
    // A step this world does not run is not reachable, however far the rail
    // has got: skipping it pushes `furthestPhase` past its index.
    if (!liveStep(phase, rulesOf(get().season))) return;
    if (closedStep(get(), phase)) return;
    navMark(false);
    set({
      phase, overlay: null, overlayStack: [], selectedPlayer: null, coachSeat: null, spentThisStep: {},
      version: get().version + 1,
    });
  },
  selectedPlayer: null, coachSeat: null,
  playerCardSection: 'overview',
  coach: newCoach(),
  lastReview: null,
  reviewDismissed: false,
  offers: [],

  clearReview: () => set(get().phase !== null ? { reviewDismissed: true } : { lastReview: null }),
  inbox: [],
  post: (item) => set({ inbox: push(get().inbox, newItem(item)) }),
  portal: null,

  keepFromPortal: (id, offer) => {
    const { season, userTeam, portal, version } = get();
    const rec = season?.teams[userTeam];
    if (!season || !rec || !portal) return false;
    const man = portal.leaving.find((m) => m.player.id === id);
    if (!man) return false;
    const stars = prestigeStars(rec.prestige);
    // One pool, three claims: June's draft spending comes off the portal's
    // window exactly as both come off the recruiting weeks.
    const left = flexibleOffseasonBudget(stars) - (season.draft?.spent ?? 0) - portal.spent;
    const { spent, stayed } = portalCase(man, offer, left);
    (season.portalSpend ??= {})[userTeam] =
      (season.portalSpend[userTeam] ?? 0) + spent;
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
        body: 'Coach — he was in the portal and he is not any more.',
        link: { to: 'player', id: man.player.id },
      });
    }
    get().autosave();
    return stayed;
  },

  takeFromPortal: (id) => {
    const { season, userTeam, portal, version } = get();
    const rec = season?.teams[userTeam];
    if (!season || !rec || !portal) return false;
    // The staff is working the portal; the pool is the other programs' (H1).
    if (!handles(get().depth, 'portal')) return false;
    const man = portal.available.find((m) => m.player.id === id);
    if (!man) return false;
    const stars = prestigeStars(rec.prestige);
    if ((season.draft?.spent ?? 0) + portal.spent + man.cost > flexibleOffseasonBudget(stars)) {
      return false;
    }

    // Off his old roster and onto yours, in that order -- a man on two rosters
    // is the kind of thing that only shows up as a duplicated name in June.
    const from = season.teams[man.from];
    if (from) releaseFrom(from.team, man.player.id);
    signFromPortal(rec.team, man);

    (season.portalSpend ??= {})[userTeam] =
      (season.portalSpend[userTeam] ?? 0) + man.cost;
    set({
      portal: {
        ...portal,
        spent: portal.spent + man.cost,
        available: portal.available.filter((m) => m.player.id !== id),
      },
      // One letter when the window closes, not one per man — the
      // reporter's ask: "I brought 3 players from the portal, give me just
      // one notification once the portal is over."
      portalArrivals: [...get().portalArrivals, man.player.name],
      version: version + 1,
    });
    get().autosave();
    return true;
  },

  wordsUsed: 0,

  wordWith: (id) => {
    // Not while the season sims in the worker: its copy replaces this one (M71).
    if (get().busy) return false;
    const { season, userTeam, coach, wordsUsed, version } = get();
    const rec = season?.teams[userTeam];
    if (!rec || wordsUsed >= WORDS_A_SEASON) return false;
    const man = [...squad(rec.team), ...rec.team.rotation, ...rec.team.bullpen]
      .find((p) => p.id === id);
    if (!man) return false;
    /*
      No letter. Reported twice: "in inbox, don't notify about the players
      you had a word with", and again — "I remember telling you to remove
      the notification inbox when we have a word with a player."

      He is right, and it is the inbox rule the whole audit turned on: you
      were standing there when it happened, so a letter telling you about it
      is the assistant reporting your own morning back to you. The lift is
      real and shows where it belongs, on the man.
    */
    const lift = haveAWord(man, coach.skills.training);
    void lift;
    set({ wordsUsed: wordsUsed + 1, version: version + 1 });
    get().autosave();
    return true;
  },

  nameCaptain: (id) => {
    // Not while the season sims in the worker: its copy replaces this one (M71).
    if (get().busy) return false;
    const { season, userTeam, version } = get();
    const rec = season?.teams[userTeam];
    if (!rec) return false;
    const man = [...squad(rec.team), ...rec.team.rotation, ...rec.team.bullpen]
      .find((p) => p.id === id);
    if (!man || !appoint(rec.team, man)) return false;
    set({ version: version + 1 });
    // The captain card went in the 15.5 noise cut, named outright: "when we
    // name someone captain... not needed to be announced." You just did it —
    // mail telling you so is the inbox writing to itself. The C on his row
    // is the record.
    get().autosave();
    return true;
  },

  clearCaptain: () => {
    const { season, userTeam, version } = get();
    const rec = season?.teams[userTeam];
    if (!rec) return;
    standDown(rec.team);
    set({ version: version + 1 });
    get().autosave();
  },

  restMan: (id, days) => {
    // Not while the season sims in the worker: its copy replaces this one (M71).
    if (get().busy) return false;
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
    // The injury clock, which keeps running in June; the schedule index stops (M75).
    if (!available(man, injuryClock(season))) return false;
    /*
      A day off is not an injury, so it is written the same way and read the
      same way and says something else. The depth chart promotes behind him
      exactly as it would for a hamstring -- which is the point of having built
      the chart first.
    */
    const m = man as Player & { outUntil?: number; why?: 'academic' | 'injury' };
    m.outUntil = injuryClock(season) + days;
    delete m.why;
    set({ version: version + 1 });
    get().autosave();
    return true;
  },

  moveDepth: (spot, id, delta) => {
    // Not while the season sims in the worker: its copy replaces this one (M71).
    if (get().busy) return;
    const { season, userTeam, version } = get();
    const rec = season?.teams[userTeam];
    if (!rec) return;
    reorder(rec.team, spot, id, delta);
    set({ version: version + 1 });
    get().autosave();
  },

  setRedshirt: (id, on) => {
    // Not while the season sims in the worker: its copy replaces this one (M71).
    if (get().busy) return false;
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
    if (ok) { set({ version: version + 1 }); get().autosave(); }
    return ok;
  },

  changePosition: (id, to) => {
    // Not while the season sims in the worker: its copy replaces this one (M71).
    if (get().busy) return false;
    const { season, userTeam, version } = get();
    const rec = season?.teams[userTeam];
    if (!rec) return false;
    const man = squad(rec.team).find((p) => p.id === id);
    if (!man || man.type !== 'hitter') return false;
    const hitter = man as Hitter & { retrainTo?: Position; homePos?: Position };
    /*
      Any day of the year, made at the roll.

      This was an offseason ritual with the gate on the rail: `phase` is
      non-null exactly while the winter is open, so a move committed then was
      settled once by the roll's `settleIn` before he played a game, and the
      button read IN THE WINTER for eleven months. Reported 2026-09-16: "we
      should just leave this button available all year round but the outcome
      of it happening is decided when the season ends." So: in the winter the
      move is made now, as before; during the season it is written down
      (`retrainTo`) and made by the roll at the same point a winter move
      would be, which puts both on the same footing -- one winter of settling
      before opening day. Choosing the spot already planned cancels the plan,
      and so does choosing his own spot.
    */
    if (get().phase !== null) {
      delete hitter.retrainTo;
      /*
        From his own spot, which is where the sheet offering the move reads
        him (`ownSpot`), and not from a cover the card still has him in. Made
        off the label, a move into the spot he was covering read as no move
        at all, and the button did nothing. His own spot is still no move.
      */
      if (to === (hitter.homePos ?? hitter.pos)) return false;
      restoreHome(hitter);
      if (!movePosition(hitter, to)) return false;
      set({ version: version + 1 });
      get().post({
        kind: 'season', year: get().year,
        title: `${man.name} moves to ${to}`,
        body: 'Coach — he retrains over the winter and opens next season there, '
          + 'a step behind for a while.',
        link: { to: 'player', id: man.id },
      });
      get().autosave();
      return true;
    }
    const home = hitter.homePos ?? hitter.pos;
    const cancel = to === home || hitter.retrainTo === to;
    if (cancel && hitter.retrainTo === undefined) return false;
    if (cancel) delete hitter.retrainTo;
    else hitter.retrainTo = to;
    set({ version: version + 1 });
    if (!cancel) {
      get().post({
        kind: 'season', year: get().year,
        title: `${man.name} will move to ${to}`,
        body: 'Coach — he finishes the season where he is, retrains over the '
          + 'winter and opens next season there, a step behind for a while.',
        link: { to: 'player', id: man.id },
      });
    }
    get().autosave();
    return true;
  },

  /*
    What he said, and what it cost.

    The prestige move goes through the same clamp the board's own verdict uses,
    because a coach cannot talk his way past the ceiling any more than he can
    win his way past it -- and a season of pressers is a personality, not a
    second career ladder.
  */
  noteSeasonNews: () => {
    const before = get().inbox;
    const marksBefore = get().unseenRecords.length;
    // classroomNews / trainerNews / recoveryNews lived here until the 15.5
    // noise cut — see the note where they were defined.
    seasonNews(get());
    /*
      One version bump for the whole scan rather than one per card, and none at
      all when there was nothing to say — every caller is already re-rendering
      for its own reasons and a scan that finds nothing must not add a frame.

      `unseenRecords` is counted as well as the inbox, and it has to be: the
      scan pushes onto that array on the live state object rather than through
      `set`, so a scan that found a record and no letter changed nothing React
      was watching and the dot stayed dark until the next unrelated repaint.
    */
    if (get().inbox !== before || get().unseenRecords.length !== marksBefore) {
      set({ version: get().version + 1 });
    }
  },
  markInboxRead: (id) => {
    const inbox = get().inbox;
    if (!inbox.some((i) => i.id === id && !i.read)) return;
    set({ inbox: markRead(inbox, id), version: get().version + 1 });
    get().autosave();
  },
  readInbox: () => {
    const inbox = get().inbox;
    if (unreadCount(inbox) === 0) return;
    set({ inbox: markAllRead(inbox), version: get().version + 1 });
    get().autosave();
  },

  /*
    Saying it.

    Two doors, and which one a coach is standing at depends on whether there is
    a season left to coach. In the spring there is: the year plays out as a
    farewell and the meeting at the end of it is his last. In the offseason,
    with the season already graded, there is nothing left to play — so it is
    today. The one case in between is an offseason whose meeting has not
    happened yet, and there the announcement still has a season to be about.

    It touches nothing else on purpose. A game in progress finishes, the
    schedule plays out, June happens: the season a man announces in is a season
    like any other except that everybody knows.
  */
  announceRetirement: () => {
    const { season, year, userTeam, coach } = get();
    if (!season || coach.retiredYear !== undefined || coach.farewellYear !== undefined) return;
    if (seasonGraded(get())) { void get().endCareer(); return; }
    set({ coach: { ...coach, farewellYear: year }, version: get().version + 1 });
    get().post({
      kind: 'carousel',
      year,
      title: `${coach.name} will step down after the season`,
      body: `Coach — the country knows this is your last year at ${season.teams[userTeam]?.def.school ?? 'the program'}. Whatever else happens now, nobody is taking the job off you.`,
    });
    get().autosave();
  },

  /*
    Handing it in. Reported 2026-09-30: "we should add a way to resign to our
    current job in case we would like to move on to a different team or
    something before our contract is up."

    The retirement's two doors, and the user chose them: "at season's end".
    With a season still to coach it is notice — the year plays out, the June
    meeting cannot sack or renew him, and leaving it is the end (`nextPhase`).
    With the season graded he goes today, through the exit a sacking takes.
    The price is the user's too, "small hit per year left", and it is paid
    when the tenure ends, not when the notice is handed in.
  */
  resign: async () => {
    if (phaseAdvancing || get().busy) return;
    const s = get();
    const terms = resignTerms(s);
    if (!terms || !s.season) return;
    const { coach, year, userTeam } = s;
    const school = s.season.teams[userTeam]?.def.school ?? 'the program';
    if (terms.when === 'notice') {
      set({ coach: { ...coach, resignYear: year }, version: get().version + 1 });
      get().post({
        kind: 'carousel', year,
        title: `${coach.name} will leave ${school} after the season`,
        body: `Coach — ${school} know you are going. The season is still yours to coach.`,
      });
      await get().saveNow();
      return;
    }
    // Graded: today. Nothing on screen carries over, the way `nextPhase`
    // clears it — the profile he pressed this on is an overlay.
    set({
      overlay: null, overlayStack: [], selectedPlayer: null, coachSeat: null, spentThisStep: {},
      coach: { ...coach, resignYear: year },
      version: get().version + 1,
    });
    chargeResignation(get, set);
    // Pressed on the portal step, the portal closes for the whole country.
    if (get().portal !== null) closePortal(get, set);
    winterWithoutHim(get, set);
    set({ phase: null, version: get().version + 1 });
    await get().rollYear();
    if (get().jobSearch) postResignation(get);
    await get().saveNow();
  },

  /*
    The end.

    Called from the board meeting, where the season has already been graded and
    written into the history — so what goes in the book is a whole career, the
    last season included. The world then turns over the way it turns over for a
    sacking: the school plays its winter without him, and whoever comes next
    arrives into the year after his last.
  */
  endCareer: async () => {
    const { season, coach, year } = get();
    if (!season || coach.retiredYear !== undefined) return;
    /*
      His last season, and the league's winter with it.

      Neither happens anywhere else on this path: the draft step does both and
      a career that ends at the board meeting returns two steps before it. The
      first is why the roster that won a man's final title was missing from the
      one screen the whole ending is about; the second is why the country used
      to skip a year whenever somebody finished.
    */
    // Ended on the portal step, the portal closes for everybody first.
    if (get().portal !== null) closePortal(get, set);
    winterWithoutHim(get, set);
    const forced = retirementStatus({ age: coach.age, seasons: careerSeasons(get()) }) === 'over';
    const legend = legendFrom(get(), coach.farewellYear !== undefined || !forced ? 'chose' : 'age');
    // Onto the world, where it outlives him. The roll below carries it.
    season.legends = [...(season.legends ?? []), legend];
    set({
      coach: { ...coach, retiredYear: year },
      phase: null,
      version: get().version + 1,
    });
    await get().rollYear();
    /*
      The roll builds next spring — a market, and a board asking the man in the
      chair for thirty-three wins. Neither is addressed to him: the market is
      for a coach looking for work and the letter is for whoever takes the job.
      Left standing, the opener card comes up over the legacy screen and asks a
      retired man what he is going to do about the season.
    */
    set({ jobSearch: false, offers: [], seasonOpener: null });
    await get().saveNow();
  },

  /*
    The next man, in the same world.

    Not a new dynasty: the ninety six schools keep their banners, their record
    book, their hall, their alumni and the man you have just been, who is in
    the book with them. What he does not keep is anything that was yours — the
    program was never his, the assistants worked for the man who hired them,
    and the seasons in the history belong to a career that is closed. He starts
    on the market, because that is where a coach with no chair is.
  */
  startNewCoach: async (profile, made) => {
    const { season, year } = get();
    if (!season) return;
    const mine = [...(season.legends ?? [])].reverse().find((l) => l.you);
    const prestige = ROOKIE_PRESTIGE + legacyHeadStart(mine?.score ?? 0);
    const fresh = newCoach(profile, contractFor(prestige));
    const next: CoachState = {
      ...fresh,
      prestige,
      ...(made ? { skills: made.skills, badges: made.badges, leans: made.leans } : {}),
    };
    // Seeded off the world and the year, so this succession's desk is fixed
    // and the next one's is not the same five schools.
    const rng = makeRng(((season.seed ?? WORLD_SEED) ^ ((year * 2654435761) >>> 0)) >>> 0);
    const offers: JobOffer[] = startingOffers(season.teams, 5, {
      leans: next.leans,
      ambition: made?.ambition,
      rng,
      prestige,
      // The same test the market uses everywhere else: an empty chair, or one
      // held by a man the school would move on for him.
      open: (t) => !t.coach || prestige > t.coach.prestige,
    })
      .map((i) => season.teams[i])
      .filter((t): t is NonNullable<typeof t> => !!t)
      .map((t) => ({
        team: t.index,
        school: t.def.school,
        conference: t.conference,
        prestige: t.prestige,
        pitch: mine ? 'They know whose staff you came off.' : 'They would like to talk.',
      }));
    set({
      coach: next,
      history: [],
      economy: freshEconomy(),
      rivalry: { w: 0, l: 0 },
      watch: { programs: [], jobs: [] },
      approaches: { tried: [], interest: [] },
      inbox: [],
      offers,
      seasonOpener: null,
      seasonPlanYear: null,
      lastReview: null,
      lastOutcome: null,
      lastOffseason: null,
      jobSearch: true,
      // A new man's preference, not the last one's.
      replaceLostRecruits: true,
      tab: 'home', /* nav-write */
      screen: 'today', /* nav-write */
      version: get().version + 1,
    });
    await get().saveNow();
  },

  acceptOffer: async (team) => {
    const { season, coach, userTeam, year } = get();
    // A rivalry belongs to a chair, not a man — the new school has its own,
    // and its ledger opens at nought the day you arrive. The staff stays
    // yours: assistants follow the coach who hired them.
    if (!season) return;
    // Only an offer that is actually on the table. Accepting clears the list in
    // the same breath, so a double-tap's second click — or a tap on a second
    // offer after the first was taken — finds nothing here and does nothing,
    // instead of seating coaches twice and posting duplicate carousel news.
    if (!get().offers.some((o) => o.team === team)) return;
    if (jobOfferBlock(get()) !== null) return;
    set({ rivalry: { w: 0, l: 0 } });
    // The new job's games are the ones worth keeping now.
    season.captureBoxFor = team;
    // A new job is a clean slate with a patient board, but your reputation
    // comes with you — that is the whole point of tracking it separately.
    // `takeChair` also drops a pending notice: it was handed to the old board.
    // A move off a standing offer stays the free move it always was.
    const next = takeChair(coach, season.teams[team]?.prestige ?? 50);
    // Somebody was sitting in this chair, and now he is not. The chair you are
    // leaving goes back on the market in the same breath — `seatCoaches` fills
    // every empty one but the one you are in, which after this line is the new
    // program rather than the old.
    const displaced = seatCoaches(season, team, year);
    const leaving = season.teams[userTeam];
    // The school he leaves recruits as a rival from today, and a rival
    // needs a head start to recruit at all. Seated above, so its new coach
    // is the one it is seeded at.
    if (leaving && leaving.index !== team) seedLeftBehind(season, leaving.index);
    // The staff works for the coach; the physical program does not travel with him.
    // A move therefore keeps assistants and the coaching tree, while the old
    // school's facilities, earned recruiting relationships, current scouting
    // reports, and annual spending ledger stay behind. A coordinator's own
    // geographic network still comes with that assistant via `pipelineState`.
    const oldEconomy = get().economy;
    const carried: Economy = {
      ...freshEconomy(),
      staff: { ...oldEconomy.staff },
      staffPlans: Object.fromEntries(SEATS.map((seat) => [seat, { directive: staffPlan(oldEconomy, seat).directive }])),
      tree: [...(oldEconomy.tree ?? [])],
    };
    /*
      A poorer school cannot carry a richer one's wage bill. Whoever the new
      budget cannot pay does not make the move, dearest first, and the coach is
      told; before, the ledger simply went negative and the Budget room showed
      it as $0k left (audit 17, M9).
    */
    {
      const prestige = season.teams[team]?.prestige ?? 50;
      const leftBehind: string[] = [];
      while (remaining(carried, prestige) < 0) {
        const dearest = SEATS
          .filter((seat) => carried.staff[seat])
          .sort((a, b) => carried.staff[b]!.wage - carried.staff[a]!.wage)[0];
        if (!dearest) break;
        leftBehind.push(carried.staff[dearest]!.name);
        const staff = { ...carried.staff };
        delete staff[dearest];
        carried.staff = staff;
        if (carried.staffPlans) {
          const plans = { ...carried.staffPlans };
          delete plans[dearest];
          carried.staffPlans = plans;
        }
      }
      if (leftBehind.length > 0) {
        get().post({
          kind: 'board', year,
          title: leftBehind.length === 1 ? `${leftBehind[0]} stays behind` : 'Some of your staff stay behind',
          body: `The new budget cannot carry ${leftBehind.join(' and ')}. ${leftBehind.length === 1 ? 'He stays' : 'They stay'} where ${leftBehind.length === 1 ? 'he was' : 'they were'}.`,
        });
      }
    }
    // A staff left to its athletic director has its holes filled the day the
    // new chair is taken, not at the next winter (`adFillsSeats`).
    const nextEconomy: Economy = handles(get().depth, 'assistants')
      ? carried
      : adFillsSeats(carried, String(season.seed ?? 0), year, season.teams[team]?.prestige ?? 50);
    // The old program loses the in-game edge, the new one gains it.
    applyCoachMods(season, team, next, nextEconomy);
    if (displaced) {
      get().post({
        kind: 'carousel', year,
        title: `${displaced.name} out at ${season.teams[team]?.def.school ?? 'your new job'}`,
        body: `Coach — they moved him on to hire you. ${displaced.careerWins}-${displaced.careerLosses} in the chair.`,
      });
    }
    if (leaving && leaving.index !== team) {
      const took = leaving.coach;
      if (took) {
        get().post({
          kind: 'carousel', year,
          title: `${took.name} takes over at ${leaving.def.school}`,
          body: 'Coach — the job you left did not stay open long.',
        });
      }
    }
    // And the way he plays comes with him. A philosophy is a trait of the coach,
    // not of the job, so the new bench starts where he starts — including the
    // case where the old one had been tuned away from it by hand, which belonged
    // to the program he just left.
    applyPhilosophy(season, team, next);
    // The staff list belonged to the old board. The rule itself (who runs
    // recruiting) and `replaceLostRecruits` come with him: same career.
    season.recruiting.staffList = [];
    delete season.recruiting.staffStandIns;
    set({
      userTeam: team,
      // A new chair is a new board, and its ask is stamped the day you sit
      // down — even mid-season, where a part-year target is still the number
      // this board will actually judge.
      boardAsk: season ? boardAskFor(season, team) : get().boardAsk,
      arguedTerms: false,
      /*
        And the old board's letter goes with the old board. The season
        opener carries ITS OWN copy of the ask, stamped at the roll; left
        standing across a move it would keep presenting the number the
        previous school wanted while the board upstairs showed the new
        one. That is the two-number mandate the reporter kept meeting.
      */
      seasonOpener: null,
      // A new job owes a Season plan, even mid-season.
      seasonPlanYear: null,
      offers: [],
      jobSearch: false,
      lastReview: null,
      coach: next,
      economy: nextEconomy,
      tab: 'home', /* nav-write */
      screen: 'today', /* nav-write */
      version: get().version + 1,
    });
    // A staff that runs recruiting takes the new board over at once: seeded if
    // the programme has no interest anywhere, and this week planned.
    if (!handles(get().depth, 'recruiting')) staffTakesTheBoard(get);
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
    get().autosave();
    return outcome;
  },

  openOverlay: (o) => {
    // Stage 23: the lineup gate holds overlays too — the player card is
    // the one allowed excursion, and it does not come through here.
    const st = get();
    if (lineupHolds(st)) {
      set({ lineupGate: st.lineupGate + 1 });
      return;
    }
    /*
      One visible layer, one history entry — and every layer is a layer.

      `overlay` used to be a single value, so opening the board from an inbox
      letter REPLACED the inbox: one layer before, one after, and the back
      press from the board landed on whatever the inbox had been over. That
      swap once minted a second entry and orphaned the inbox's own, which is
      what the gesture walked into afterwards — reported 2026-09-12, "it gets
      crazy and makes me go to different tabs as well", and fixed that day by
      checkpointing only on a genuinely new layer. This is the other half
      (06 §AE.2): the inbox goes UNDERNEATH, keeping the entry it already
      spent, the board spends one of its own, and the gesture peels them in
      the order they were opened. Re-opening the layer already on top is not
      a new layer — INBOX pressed twice must not bury the inbox under itself.
    */
    if (st.overlay === o) return;
    if (st.overlay !== null) set({ overlayStack: [...st.overlayStack, { overlay: st.overlay }] });
    set(o === 'settings' ? { overlay: o, settingsPage: 'index' } : { overlay: o });
  },
  closeOverlay: () => {
    const st = get();
    if (st.overlay === null) return;
    const below = st.overlayStack[st.overlayStack.length - 1];
    if (!below) { set({ overlay: null }); return; }
    set({ overlay: below.overlay, overlayStack: st.overlayStack.slice(0, -1) });
  },
  openRoom: (room) => {
    /*
      A room is a screen of its own tab (2026-09-24: "make sure they are no
      longer linked to program"). On a frame with the nav and nothing laid
      over it, it is simply a place you go, and the route trail brings you
      back. Anywhere else — the offseason, the job market, over the inbox or
      another room — it opens as its own layer and the back press peels it.
      Never a sheet inside another page: the coach profile used to be one of
      Program's, so closing it could land on Program's overview.
    */
    const st = get();
    const home = ROOM_HOME[room];
    const navFrame = st.season !== null && st.phase === null && !st.jobSearch
      && st.coach.retiredYear === undefined && !(st.live && st.screen === 'box');
    if (home && navFrame && st.overlay === null) {
      // `go` closes an open card and hands its entry to the route.
      if (st.tab !== home.tab || st.screen !== home.screen) get().go(home.tab, home.screen);
      else {
        // Both cards, by name: closePlayer leaves the coach's sheet (PF).
        if (st.selectedPlayer !== null) get().closePlayer();
        if (st.coachSeat !== null) get().closeCoach();
      }
      return;
    }
    /*
      A card open when a room is asked for (the coach's sheet saying "Build
      the Hitting Barn") closes and hands its history entry to the room, the
      way `go` does: one visible layer, one entry. Closing it the usual way
      would pop an entry while the room pushed one, and the browser runs the
      pop later: the room's entry would be the one lost.
    */
    if (st.selectedPlayer !== null || st.coachSeat !== null) {
      set({ selectedPlayer: null, coachSeat: null, focusPlayer: null });
      if (st.overlay === room) return;
      if (st.overlay !== null) set({ overlayStack: [...st.overlayStack, { overlay: st.overlay }] });
      set({ overlay: room });
      return;
    }
    get().openOverlay(room);
  },
  overlayStack: [],
  settingsPage: 'index',
  setSettingsPage: (p) => set({ settingsPage: p }),

  // Plain UI state: the archive's own tab strip writes it and the Program
  // overview's doors preset it. No history entry of its own — HISTORY is a
  // screen, and `setScreen` already keeps that stop.
  historySheet: 'seasons',
  setHistorySheet: (s) => set({ historySheet: s }),

  openPlayer: (id, section = 'overview') => {
    set({ selectedPlayer: id, playerCardSection: section });
  },

  // The guide dies with the card: a glow that survived onto some OTHER
  // player's card would be teaching the wrong errand. A coach's sheet under
  // the card stays: one close, one level (PF, 2026-09-30).
  closePlayer: () => {
    set({ selectedPlayer: null, playerCardSection: 'overview', guide: null });
  },

  openCoach: (seat) => set({ coachSeat: seat }),
  closeCoach: () => set({ coachSeat: null }),

  playPostseason: async () => {
    const { season, busy, version } = get();
    if (!season || busy || !seasonComplete(season) || get().lastPostseason) return;
    // A bracket already exists: the postseason is running. A second press used
    // to re-freeze the regular season, throw away seven finished conference
    // tournaments, and replay the whole of June on top of itself — sixty extra
    // days on the calendar from one double-tap.
    if (get().bracket) return;
    // The regular season's order, if nothing took it yet (a held game whose
    // result came in some other way). A no-op once frozen.
    freezeFinalOrder(season);

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
    get().autosave();
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
   * A stage you are not in used to be played out immediately for the same
   * reason — there is nothing for you to decide, so there is nothing to press.
   * That was wrong, and reported 2026-09-12: "when your team doesn't make the
   * post season it automatically decides all once I hit play postseason, not
   * giving the players the opportunity to either simulate full post season or
   * sim by round." Eight conference tournaments resolved inside the effect that
   * merely opens the screen, before it had drawn a frame. Watching is not the
   * same as not caring, and one press per tier is what was asked for.
   */
  openStage: (advance = false) => {
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
        // All eight on the same nights: the other seven used to be played one
        // after another on the shared calendar, so yours opened some forty
        // nights into June (audit 17, M76).
        const open = openNightFor(season, bracket, 'conference');
        season.postseasonDay = open;
        const cups = bracket.cups.length > 0 ? bracket.cups : onTheSameNights(season, conferenceIds(season)
          .filter((id) => id !== me.conference)
          .map((id) => () => conferenceTournament(season, id)));
        const othersEnd = currentDay(season);
        season.postseasonDay = open;
        set({
          bracket: {
            ...bracket, cups,
            openNights: { ...bracket.openNights, conference: open },
            lastNight: Math.max(bracket.lastNight ?? 0, othersEnd),
          },
          myBracket: {
            kind: 'conference', format: 'double',
            state: startDoubleElim(season, mine.field),
            preplayed: new Map(),
          },
          version: version + 1,
        });
        return;
      }
      // Nothing of his is in it, so it plays on a press and not on arrival.
      if (!advance) return;
      season.postseasonDay = openNightFor(season, bracket, 'conference');
      const cups = stageConferenceTournaments(season);
      set({
        bracket: { ...bracket, cups, lastNight: Math.max(bracket.lastNight ?? 0, currentDay(season)) },
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
        // Sixteen series on one opening night, after the break that follows
        // the last cup game anywhere (H5). They used to open off wherever
        // your own cup had left the calendar, one after another.
        const open = openNightFor(season, bracket, 'regional');
        season.postseasonDay = open;
        const others = bracket.regionals.length > 0 ? bracket.regionals
          : onTheSameNights(season, pairings
            .filter((p) => p !== mine)
            .map((p) => () => ({
              ...singleElimination(
                season, seedTeams(season,
                  [p.a, p.b].map((i) => season.teams[i]!),
                  (t) => regularRecord(t).w,
                ).map((t) => t.index), REGIONAL_LENGTHS),
              region: p.id, name: p.name, aLabel: p.aLabel, bLabel: p.bLabel,
            })));
        const othersEnd = currentDay(season);
        season.postseasonDay = open;
        const seeds = seedTeams(season,
          [mine.a, mine.b].map((i) => season.teams[i]!),
          (t) => regularRecord(t).w,
        ).map((t) => t.index);
        set({
          bracket: {
            ...bracket, regionals: others,
            openNights: { ...bracket.openNights, regional: open },
            lastNight: Math.max(bracket.lastNight ?? 0, othersEnd),
          },
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
        // Same as the conference tier above: a press, not an arrival.
        if (!advance) return;
        // `stageRegionals` adds the break itself, so it starts from the last
        // night of the cups rather than from wherever yours ended.
        const open = openNightFor(season, bracket, 'regional');
        season.postseasonDay = open - STAGE_BREAK;
        const regionals = stageRegionals(season, bracket.cups);
        set({
          bracket: {
            ...bracket, regionals,
            openNights: { ...bracket.openNights, regional: open },
            lastNight: Math.max(bracket.lastNight ?? 0, currentDay(season)),
          },
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
      get().autosave();
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
      // Both halves open on one night, the break after the last regional
      // game anywhere (H5). The spectator path ran one half to its end and
      // then the other, and nothing waited the break.
      const open = openNightFor(season, b2, 'national');
      const nights = {
        openNights: { ...b2.openNights, national: open },
        lastNight: Math.max(b2.lastNight ?? 0, currentDay(season)),
      };
      if (mineIsA || mineIsB) {
        season.postseasonDay = open;
        const otherHalf = mineIsA ? 'B' : 'A';
        const otherDone = mineIsA ? nat2.bracketB : nat2.bracketA;
        set({
          bracket: { ...b2, ...nights },
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
      get().autosave();
        return;
      }

      if (!advance) return;                 // the twenty are on screen, waiting
      season.postseasonDay = open;
      const next: NationalProgress = { ...nat2 };
      onTheSameNights(season, [
        () => { if (nat2.bracketA === null) next.bracketA = resultOfDE(runDoubleElim(season, bracketA)); },
        () => { if (nat2.bracketB === null) next.bracketB = resultOfDE(runDoubleElim(season, bracketB)); },
      ]);
      set({ bracket: { ...b2, ...nights, national: next }, version: get().version + 1 });
      get().autosave();
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
      get().autosave();
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
      get().autosave();
    }
  },

  sideShow: null,

  /**
   * Step the other half of the showdown, and file it when it is finished.
   *
   * Called from wherever your own tournament is stepped, so the two stay in
   * lockstep — see the note in `openNationalStep`.
   */
  stepSideShow: (night) => {
    const { bracket, sideShow, version } = get();
    if (!sideShow) return;
    if (!sideShow.state.done) {
      const season = sideShow.state.season;
      const after = currentDay(season);
      if (night !== undefined) season.postseasonDay = night;
      stepDoubleElim(sideShow.state);
      if (night !== undefined) season.postseasonDay = Math.max(after, currentDay(season));
    }
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
    /*
      A tier that has not been played yet is played by this press rather than
      refused by it. The two guards below exist to stop a double tap walking
      conference → regional → national in one gesture off an empty list, and
      they used to be unreachable for a spectator because `openStage` had
      already resolved his tier on arrival. Now that it waits, the first press
      lands here with nothing on the books — so it stages, and the NEXT press
      leaves.
    */
    if (bracket.stage === 'conference'
      && bracket.cups.length < conferenceIds(season).length) {
      get().openStage(true);
      get().autosave();
      return;
    }
    if (bracket.stage === 'regional'
      && bracket.regionals.length < regionalPairing(season, bracket.cups).length) {
      get().openStage(true);
      get().autosave();
      return;
    }

    if (bracket.stage === 'conference') {
      set({ bracket: { ...bracket, stage: 'regional' }, version: version + 1 });
      get().openStage();
      get().autosave();
      return;
    }
    if (bracket.stage === 'regional') {
      set({ bracket: { ...bracket, stage: 'national' }, version: version + 1 });
      get().openStage();
      get().autosave();
      return;
    }
    // The national stage advances through its own sub-steps until the trophy,
    // and this is a press, so a step you are watching resolves now.
    if (bracket.national === null || bracket.national.final === null) {
      get().openNationalStep(true);
      get().autosave();
      return;
    }

    // The ceremony as it stands tonight, before the draft rewrites the rosters.
    ceremonyOf(season, get().userTeam, get().lastPostseason);
    set({ bracket: null, phase: 'awards', version: version + 1 });
    get().autosave();
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
    get().noteRoster('prime');
    const { season, myBracket, userTeam, version } = get();
    if (!season || !myBracket || get().busy) return;
    // June honors the same roster decisions as the regular season. An injured
    // starter or a healed player waiting on a return decision cannot be
    // bypassed simply because the next game is in a tournament bracket.
    const hold = unresolvedRosterDecision(season, userTeam, get().depth);
    if (hold) { set({ lineupGate: get().lineupGate + 1 }); get().go('team', 'lineup', hold.id); return; }
    // A game taken rather than handed over. Counted only after the roster gate
    // clears, so opening the card while blocked is not logged as a managed game.
    get().noteHabit('managed');
    // A game is already being managed. Building a second LiveGame would consume
    // the season's rng again and silently discard the one in progress. An
    // interrupted one waiting to be picked up is the same game (M95).
    if (get().live || get().liveStarting || get().pendingGame) return;

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
    // The staff's card first, so the lineup played, the one the anchor save
    // holds and the one a resume rebuilds are all the same card (M78). It ran
    // after the lineups below were captured and before the save.
    if (!handles(get().depth, 'lineups')) staffSetsTheCard(season, userTeam);

    /*
      Each side's rotation slot is its own — a team arriving off a bye and a
      team that has just played three games in three days are not both on
      their Friday starter. The bracket sim keeps the two counts apart; this
      path handed the away dugout the host's slot, so a managed title game
      faced the losers-bracket team's ace instead of its second arm (05 §62.1).
    */
    const clock = injuryClock(season);
    const hSlot = (myBracket.state.appearances.get(h) ?? 0) % 3;
    const aSlot = (myBracket.state.appearances.get(a) ?? 0) % 3;
    /*
      The calendar, not the schedule index. `pitcherReady` compares the day
      it is handed against the day an outing was written on, and outings are
      written on the calendar (`currentDay`); in June the schedule index is
      frozen at the season's length while the calendar runs on past it, so
      every arm read as owed rest for ever and the walk fell to its fallback
      -- the longest-rested arm, whatever slot the coach had set. Reported
      2026-09-16 from a title game: "I changed the rotation to have him pitch
      that night but the game still picked the one it previously had."
      The day sim's bracket games already read the calendar (05 §91.3).
    */
    const homeStarter = startableSlot(season, home.team, hSlot, currentDay(season), clock);
    const awayStarter = startableSlot(season, away.team, aSlot, currentDay(season), clock);
    const homeLineup = coverFor(home.team, home.team.lineup, clock);
    const awayLineup = coverFor(away.team, away.team.lineup, clock);
    const homeBench = fitBench(home.team, clock);
    const awayBench = fitBench(away.team, clock);

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
    // Its own key, not the pen's. They are two rows on the settings sheet and
    // somebody can want either without the other; while the engine read only
    // the pen's, a coach who kept his bullpen and delegated the conversations
    // had nobody visiting his mound at all (05 §72).
    const autoVisits = !handles(get().depth, 'moundVisits');
    set({ liveStarting: true });
    const rngState = season.rng.state?.() ?? 0;
    /*
      No anchor, no game.

      The point of awaiting this is that the file on disk has to hold the
      generator position the first pitch will be drawn from. It awaited the
      save and then ignored what it said, so a storage failure let a coach
      manage nine innings whose recovery prerequisite had never been written.
      `saveNow` sets `saveState: 'error'`, which the save banner is already
      watching, so refusing here explains itself.
    */
    if (!await get().saveNow()) { set({ liveStarting: false }); return; }
    // Nothing may have moved the tournament while the anchor was writing
    // (M59): a sim of this very game would otherwise be played twice.
    if (get().myBracket !== myBracket || get().season !== season || get().live
      || (season.rng.state?.() ?? 0) !== rngState) {
      set({ liveStarting: false });
      return;
    }
    writeJournal({
      slot: get().loadedSlot ?? AUTOSAVE_SLOT, year: get().year, rngState,
      home: h, away: a, day: season.dayIndex,
      homeStarter, awayStarter,
      managing: h === userTeam ? 'home' : 'away',
      autoPitching: autoPen,
      autoVisits,
      postseason: true,
      conference: false,
      actions: [],
    });

    set({
      liveStarting: false,
      live: createLiveGame(home.team, away.team, season.rng, {
        managing: h === userTeam ? 'home' : 'away',
        autoPitching: autoPen,
        autoVisits,
        engine: season.config.engine,
        postseason: true,
        homeStarter,
        awayStarter,
        // A by-hand starter on short rest tires sooner (05 §91.3).
        homeShortRest: shortRest(season, home.team.rotation[homeStarter], currentDay(season)),
        awayShortRest: shortRest(season, away.team.rotation[awayStarter], currentDay(season)),
        homeLineup,
        awayLineup,
        homeBench,
        awayBench,
        // The same wiring the fast path gets: the Strategy screen's settings
        // govern the game you manage, and the pen is offered most rested first.
        homeStrategy: appliedStrategy(season, home, away),
        awayStrategy: appliedStrategy(season, away, home),
        homeBullpen: restedFirst(season, home),
        awayBullpen: restedFirst(season, away),
        // The other dugout keeps a man for the ninth in a game you manage too.
        ...(closerFrom(restedFirst(season, home), home.team.penByHand) ? { homeCloser: closerFrom(restedFirst(season, home), home.team.penByHand) } : {}),
        ...(closerFrom(restedFirst(season, away), away.team.penByHand) ? { awayCloser: closerFrom(restedFirst(season, away), away.team.penByHand) } : {}),
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

  simBracket: (mode, paced = false) => {
    const { myBracket, season, userTeam, busy } = get();
    if (!myBracket || !season || busy) return;
    // Not while your game is being played, starting, or waiting to be picked
    // back up: simming it here recorded it and threw the managed one away
    // (audit 17, M59, M95).
    if (get().live || get().liveStarting || get().pendingGame) return;
    const hold = unresolvedRosterDecision(season, userTeam, get().depth);
    if (hold) { set({ lineupGate: get().lineupGate + 1 }); get().go('team', 'lineup', hold.id); return; }
    const { state, preplayed } = myBracket;
    get().noteRoster('prime');

    const step = (): void => {
      if (myBracket.format === 'series') stepBracket(myBracket.state, preplayed);
      else stepDoubleElim(myBracket.state, preplayed);
    };

    // The other half of the showdown keeps pace, night for night, so the two
    // brackets on screen are always at the same point in the tournament.
    // On the same night: the side show plays the night your half just did.
    const both = (): void => {
      const night = currentDay(season);
      step();
      get().stepSideShow(night);
    };

    const finish = (): void => {
      set({ version: get().version + 1 });
      get().noteRoster('report');
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
      get().autosave();
    };

    // Each mode is a "keep going" test, checked before every night.
    let more: () => boolean;
    if (mode === 'game') {
      let once = true;
      more = () => { const go = once; once = false; return go; };
    } else if (mode === 'round') {
      if (myBracket.format === 'series') {
        // To the end of this round, however many nights that takes.
        const from = myBracket.state.roundIndex;
        let guard = 0;
        more = () => !myBracket.state.done && myBracket.state.roundIndex === from && guard++ < 40;
      } else {
        // A double elimination has no single round index: one night is the
        // honest unit, every playable game played.
        let once = true;
        more = () => { const go = once; once = false; return go; };
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
      more = () => !state.done && !mineIsUp() && guard++ < 200;
    } else {
      let guard = 0;
      more = () => !state.done && guard++ < 200;
    }

    if (!paced) {
      while (more()) both();
      finish();
      return;
    }
    /*
      Paced for the screen: a night at a time, with a frame between, so the
      rest of a June does not hold the tap for two seconds, and `busy` keeps a
      second press out until it is done (audit 17, H4, M46).
    */
    set({ busy: true });
    return (async () => {
      try {
        while (more()) {
          both();
          await breathe();
          if (get().season !== season || get().myBracket !== myBracket) return;
        }
      } finally {
        set({ busy: false });
      }
      finish();
    })();
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
        /*
          Decided the way the field is actually decided. Protection is only
          four of the twenty seats; the rest fill at large off the national
          table, and the other fifteen regionals are on the books by the time
          the coached program's own series ends — so the same selection the
          bracket will run is available now. Read off protection alone, one
          regional loser in seven was told the season was over and then
          seeded in the national field (05 §62.5).
        */
        const progress = get().bracket;
        const mine = resultOf(state);
        const meRec = season.teams[userTeam];
        const regionId = myBracket.meta?.region ?? (meRec ? regionOf(meRec.conference) : 'SOUTH');
        const played = progress ? [...progress.regionals, {
          ...mine, region: regionId,
          name: myBracket.meta?.name ?? (REGIONS.find((r) => r.id === regionId)?.name ?? regionId),
          aLabel: myBracket.meta?.aLabel ?? '', bLabel: myBracket.meta?.bLabel ?? '',
        }] : [];
        const expected = progress ? regionalPairing(season, progress.cups).length : Infinity;
        advanced = progress && played.length >= expected
          ? selectNationalField(season, progress.cups, played).seeds.includes(userTeam)
          : protectedTopFour(season).includes(userTeam);
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
      And separately: what the national field still owes him.

      `advanced` means this tournament carries on with him in it. It never
      meant "the season continues", and the conference branch was reading it
      that way — so a protected seed, whose place the selector guarantees
      before a regional is played, was told the season was over.

      Three answers, because there are three. Protection is certain. An
      at-large bid is not: the selector fills the last seats off the national
      table, so a team inside that range has not been decided about yet and
      should not be told it has.
    */
    const bid: KnockoutBid = protectedTopFour(season).includes(userTeam)
      ? 'secure'
      : rpiOrder(season).findIndex((r) => r.team.index === userTeam) < NATIONAL_BIDS
        ? 'awaiting'
        : 'none';
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
      ? `Coach — out of ${where}, and somehow that is fine: ${
        myBracket.kind === 'conference' ? 'a regional championship series is next'
          : 'the national field still has a place for us'}. Bus leaves early.`
      : bid === 'secure'
        ? `Coach — out of ${where}, and it costs us nothing: we are in the `
          + 'national field on the strength of the regular season. Bus leaves early.'
        : bid === 'awaiting'
          ? `Coach — out of ${where}. The committee has not sat yet and we are `
            + 'inside the numbers, so nobody is packing anything away tonight.'
          : `Coach — ${me?.w ?? 0}-${me?.l ?? 0} on the year. I will start on `
            + `next season's binder tonight.`;
    set({
      knockout: {
        year, kind: myBracket.kind, label, advanced, bid,
        ...(placing > 0 ? { placing } : {}),
      },
      // Only the ending is worth a letter. STILL ALIVE was cut by the
      // reporter: surviving a stage already has its modal, and a letter
      // restating it was one more thing between him and the mail that
      // matters.
      inbox: advanced ? get().inbox : push(get().inbox, newItem({
        year, kind: 'season',
        key: `knockout-${myBracket.kind}`,
        title: bid === 'secure' ? 'Out of the tournament, into the field'
          : bid === 'awaiting' ? 'Out of the tournament, awaiting the committee'
            : 'The season is over',
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
    get().autosave();
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
          // The conference by its name, not its code: "Pacific Coast", not PAC.
          line: `${leagueName(me.conference).replace(/\s+Conference$/i, '')} tournament champions`,
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
      // The card says the season and the final, not just the word: a title
      // is the biggest thing the game can hand over (05 §91.4).
      const rec = get().season?.teams[userTeam];
      const other = mine.seeds.find((t) => t !== userTeam);
      const otherName = other !== undefined ? get().season?.teams[other]?.def.school ?? 'the other bracket' : 'the field';
      get().offerBigMoment(mine.champion === userTeam
        ? {
          kind: 'title', team: userTeam, year: get().year,
          line: `${rec?.w ?? 0}–${rec?.l ?? 0} · over ${otherName} in the final`,
        }
        : {
          kind: 'runner-up', team: userTeam, year: get().year,
          line: 'Runners-up in the country',
        });
    }
    get().autosave();
  },

  live: null,
  liveMeta: null,
  pendingGame: null,

  bigMoment: null,
  cardNudge: 0,
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
    if (j.slot !== (get().loadedSlot ?? AUTOSAVE_SLOT)) return;
    if (!journalMatches(j, get().loadedSlot ?? AUTOSAVE_SLOT, get().year, season.rng.state?.() ?? -1)) {
      clearJournal();
      return;
    }

    const home = season.teams[j.home];
    const away = season.teams[j.away];
    if (!home || !away) { clearJournal(); return; }

    // The same covered card the game was started with: the season is back at
    // the same day with the same men on the shelf, so this is the same nine.
    const clock = injuryClock(season);
    const live = createLiveGame(home.team, away.team, season.rng, {
      managing: j.managing,
      // Off the journal, not off today's settings: the replay has to rebuild
      // the game that was interrupted, not the one this coach would start now.
      autoPitching: j.autoPitching === true,
      // Absent in a journal written before the conversations had their own
      // switch. Those games were played with the visit gated on the pen, which
      // is what `autoPitching` alone reproduces — so the fallback is the pen's
      // answer rather than a default, and an old game resumes into itself.
      autoVisits: j.autoVisits ?? (j.autoPitching === true),
      engine: season.config.engine,
      ...(j.postseason ? { postseason: true } : {}),
      homeStarter: j.homeStarter,
      awayStarter: j.awayStarter,
      // The same flag the interrupted game ran with: the workload it is read
      // off has not moved, so the replay is the same game (05 §62.1).
      homeShortRest: shortRest(season, home.team.rotation[j.homeStarter], currentDay(season)),
      awayShortRest: shortRest(season, away.team.rotation[j.awayStarter], currentDay(season)),
      homeLineup: coverFor(home.team, home.team.lineup, clock),
      awayLineup: coverFor(away.team, away.team.lineup, clock),
      homeBench: fitBench(home.team, clock),
      awayBench: fitBench(away.team, clock),
      homeStrategy: appliedStrategy(season, home, away),
      awayStrategy: appliedStrategy(season, away, home),
      homeBullpen: restedFirst(season, home),
      awayBullpen: restedFirst(season, away),
      // The other dugout keeps a man for the ninth in a game you manage too.
      ...(closerFrom(restedFirst(season, home), home.team.penByHand) ? { homeCloser: closerFrom(restedFirst(season, home), home.team.penByHand) } : {}),
      ...(closerFrom(restedFirst(season, away), away.team.penByHand) ? { awayCloser: closerFrom(restedFirst(season, away), away.team.penByHand) } : {}),
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
      if (a.k === 'coach') { live.setBenchCoach(a.on); continue; }
      const arm = live.bullpenAvailable.find((p) => String(p.id) === a.id);
      if (arm) live.changePitcher(arm);
    }
    void mine;

    const liveMeta = {
      home: j.home, away: j.away, day: j.day,
      // Off the journal. A journal from before the flag was written is a
      // regular-season game far more often than not; a bracket game never counts.
      conference: j.conference ?? !j.postseason,
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

    /*
      The dugout reopens in your hands. A bench coach who had the game when the
      app closed hands it back, and the journal says so, so the next replay
      takes it back at the same batter this one did.
    */
    const lastCoach = [...j.actions].reverse().find((a) => a.k === 'coach');
    if (lastCoach?.k === 'coach' && lastCoach.on && !live.over) {
      live.setBenchCoach(false);
      noteAction({ k: 'coach', on: false });
    }

    // June draws the dugout off `live` alone, so there the whole game waits a
    // frame: the bracket paints without the card first, and the guard's entry
    // is left on that. One write, so the dugout rises once (2026-09-30).
    if (get().bracket !== null) {
      const bracket = get().bracket;
      afterPaint(() => {
        const s = get();
        if (s.season !== season || s.bracket !== bracket || s.live !== null) return;
        set({
          live, liveMeta, version: s.version + 1,
          tab: 'home', screen: 'box', /* nav-write */
        });
      });
      return;
    }

    // Today first, the game a frame later (back plan V2, 2026-09-30): the
    // game's entry is then left on a painted Today, where back from it lands.
    set({
      live, liveMeta, version: version + 1,
      tab: 'home', screen: 'today', /* nav-write */
    });
    afterPaint(() => {
      const s = get();
      if (s.live === live && s.tab === 'home' && s.screen === 'today') set({ screen: 'box' }); /* nav-write */
    });
    void userTeam;
  },

  startManagedGame: async () => {
    get().noteRoster('prime');
    const { season, userTeam, version } = get();
    // `busy` because the worker owns the season during a sim — a game started
    // against that object would be recorded into whatever world replaces it.
    if (!season || get().busy) return;
    // A game already in progress: PLAY BALL is the way back to it, not a
    // second game over the top of it. The scorebook left the nav — this button
    // is now the room's only door, so it has to open the room that exists.
    if (get().live) { set({ tab: 'home', screen: 'box' }); return; } /* nav-write */
    if (get().liveStarting) return;
    if (seasonComplete(season)) return;
    const hold = unresolvedRosterDecision(season, userTeam, get().depth);
    if (hold) { set({ lineupGate: get().lineupGate + 1 }); get().go('team', 'lineup', hold.id); return; }
    // A game taken rather than handed over. Counted only after the lineup/rotation gate clears.
    get().noteHabit('managed');

    // Play forward through any days we are not involved in. The world does not
    // wait, but our own game is left untouched for us to manage.
    let guard = 0;
    const hasMine = (): boolean => {
      const d = season.schedule[season.dayIndex];
      return !!d?.games.some((g) => g.home === userTeam || g.away === userTeam);
    };
    while (!seasonComplete(season) && !hasMine() && guard++ < 60) simNextDay(season);
    get().syncRecruitingCalendar();
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
    // Its own key, not the pen's. They are two rows on the settings sheet and
    // somebody can want either without the other; while the engine read only
    // the pen's, a coach who kept his bullpen and delegated the conversations
    // had nobody visiting his mound at all (05 §72).
    const autoVisits = !handles(get().depth, 'moundVisits');
    if (!handles(get().depth, 'lineups')) staffSetsTheCard(season, userTeam);
    /*
      The card and the arms, exactly as the day sim would field them: injured
      and ineligible men covered off both nines, and each rotation slot walked
      forward past an arm on short rest. Neither takes a draw, so the journal
      anchor below still holds and the replay rebuilds the same game (05 §62.1).
    */
    const clock = injuryClock(season);
    const today = currentDay(season);
    const homeStarter = startableSlot(season, home.team, g.slot, today, clock);
    const awayStarter = startableSlot(season, away.team, g.slot, today, clock);
    const homeLineup = coverFor(home.team, home.team.lineup, clock);
    const awayLineup = coverFor(away.team, away.team.lineup, clock);
    const homeBench = fitBench(home.team, clock);
    const awayBench = fitBench(away.team, clock);
    set({ liveStarting: true });
    const rngState = season.rng.state?.() ?? 0;
    /*
      No anchor, no game.

      The point of awaiting this is that the file on disk has to hold the
      generator position the first pitch will be drawn from. It awaited the
      save and then ignored what it said, so a storage failure let a coach
      manage nine innings whose recovery prerequisite had never been written.
      `saveNow` sets `saveState: 'error'`, which the save banner is already
      watching, so refusing here explains itself.
    */
    if (!await get().saveNow()) { set({ liveStarting: false }); return; }
    writeJournal({
      slot: get().loadedSlot ?? AUTOSAVE_SLOT, year: get().year, rngState,
      home: g.home, away: g.away, day: day.day,
      homeStarter, awayStarter,
      managing: g.home === userTeam ? 'home' : 'away',
      autoPitching: autoPen,
      autoVisits,
      postseason: false,
      conference: g.conference,
      actions: [],
    });

    set({
      liveStarting: false,
      live: createLiveGame(home.team, away.team, season.rng, {
        managing: g.home === userTeam ? 'home' : 'away',
        autoPitching: autoPen,
        autoVisits,
        engine: season.config.engine,
        homeStarter,
        awayStarter,
        // A by-hand starter on short rest tires sooner (05 §91.3).
        homeShortRest: shortRest(season, home.team.rotation[homeStarter], currentDay(season)),
        awayShortRest: shortRest(season, away.team.rotation[awayStarter], currentDay(season)),
        homeLineup,
        awayLineup,
        homeBench,
        awayBench,
        // The same wiring the fast path gets: the Strategy screen's settings
        // govern the game you manage, and the pen is offered most rested first.
        homeStrategy: appliedStrategy(season, home, away),
        awayStrategy: appliedStrategy(season, away, home),
        homeBullpen: restedFirst(season, home),
        awayBullpen: restedFirst(season, away),
        // The other dugout keeps a man for the ninth in a game you manage too.
        ...(closerFrom(restedFirst(season, home), home.team.penByHand) ? { homeCloser: closerFrom(restedFirst(season, home), home.team.penByHand) } : {}),
        ...(closerFrom(restedFirst(season, away), away.team.penByHand) ? { awayCloser: closerFrom(restedFirst(season, away), away.team.penByHand) } : {}),
        // And the coach-skill nudge, so a managed game and a simmed one play
        // to the same odds.
        ...(home.coachMods ? { homeCoachMods: home.coachMods } : {}),
        ...(away.coachMods ? { awayCoachMods: away.coachMods } : {}),
      }),
      liveMeta: { home: g.home, away: g.away, day: day.day, conference: g.conference },
      version: version + 1,
      tab: 'home', /* nav-write */
      screen: 'box', /* nav-write */
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

  setBenchCoach: (on) => {
    const { live, version } = get();
    if (!live || live.over) return;
    // Journalled before the engine hears it, like every call.
    noteAction({ k: 'coach', on });
    live.setBenchCoach(on);
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

    /*
      The season's bookkeeping a simulated game gets inside playGame, paid
      here for a game the coach sat in: a day in the legs for the men who
      played and the men who did not, a season in the arm for every man who
      threw. Without it the coached program's starts, leg weariness and arm
      mileage stayed at zero all year — a third fewer lineup injuries than the
      rest of the country, a mood settle that read every regular as buried,
      and a pitching coach whose arm care never applied (05 §62.1).
    */
    for (const [index, side] of [[liveMeta.home, live.result.home], [liveMeta.away, live.result.away]] as const) {
      const rec = season.teams[index];
      if (!rec) continue;
      dayInTheLegs(rec, side.starters);
      seasonInTheArm(rec, side);
    }

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
        const night = currentDay(season);
        if (mb.format === 'series') stepBracket(mb.state, mb.preplayed);
        else stepDoubleElim(mb.state, mb.preplayed);
        // And the other half of the showdown plays its night too: the same one.
        get().stepSideShow(night);
      }
      set({ live: null, liveMeta: null, version: version + 1 });
      get().noteRoster('report');
      // The postseason screen is not mounted right now — it is behind this
      // game — so a loss it could have noticed has to be recorded for it.
      get().noteKnockout();
      /*
        The save, then the journal -- in that order. The comment that stood
        here said a mid-bracket save was impossible; it stopped being true
        when `portableMyBracket` learned to carry the live tournament, and
        `manageBracketGame` has anchored before the first pitch since the
        audit. Clearing the journal first left a window in which a kill lost
        the game with no resume offer, because the file on disk was still the
        pre-game anchor (05 §62.6). `closeMyBracket` saves when the
        tournament is over; otherwise this does.
      */
      /*
        And the journal only goes when the result it describes is safely on
        disk. This saved and then cleared regardless, so a failed write threw
        away the one record that could have offered the game back — the exact
        window the note above says it exists to close.
      */
      if (mb && mb.state.done) { get().closeMyBracket(); clearJournal(); }
      else if (await get().saveNow()) clearJournal();
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
      set({ live: null, liveMeta: null, version: version + 1, screen: 'today' }); /* nav-write */
      return;
    }

    // The rest of the day happens now, with our game held out, then ours is
    // written down through the same path a simulated game takes.
    // Held by the fixture, not by whoever sits in the chair now: the two are
    // the same team unless the chair changed mid-game, and if it ever did,
    // holding `userTeam` simulated this game and then recorded it again.
    simNextDay(season, { hold: liveMeta.home });
    get().syncRecruitingCalendar();
    recordResult(season, liveMeta.home, liveMeta.away, live.result, {
      conference: liveMeta.conference,
      day: liveMeta.day,
    });
    // Now the order can be taken: with the managed game in it (M67).
    freezeFinalOrder(season);

    set({ live: null, liveMeta: null, version: version + 1, screen: 'today' }); /* nav-write */
    get().noteRoster('report');
    get().noteSeasonNews();
    // The save first, then the journal: the other way round left a window in
    // which a kill lost the game with no resume offer (05 §62.6). And only if
    // the save actually landed — clearing it after a failed write reopens the
    // same window from the other side.
    if (await get().saveNow()) clearJournal();
  },

  setStrategy: (key, value) => {
    const { season, userTeam, version } = get();
    const me = season?.teams[userTeam];
    if (!me || get().busy) return;
    // The signature is typed, but an untyped caller (a console, a future bug)
    // could still write a junk key straight into the save. Optional positioning
    // fields are absent from older saves, so validate against
    // the canonical strategy shape rather than the saved object itself; otherwise
    // Alignment works while Infield/Outfield/Overshift silently refuse to write.
    if (!(key in DEFAULT_STRATEGY)) return;
    // Mutated in place: the engine reads TeamRecord.strategy when it builds each
    // game, so this is live from the next pitch onward.
    me.strategy = { ...me.strategy, [key]: value };
    set({ version: version + 1 });
    get().autosave();
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
    if (!available(inMan, injuryClock(season))) return false;
    /*
      No relabelling. This adopted the slot's position for one day and was
      reversed on the report: "I don't want them to be automatically
      assigned, the automation is only if I tap on auto lineup." A manual
      start brings the man in as what he is; if that leaves the card missing
      a spot, the lineup screen says so out loud (see `cardGaps`) and the
      coach fixes it with the rail or with AUTO, deliberately.

      The man walking to the bench does get himself back — the bench is where
      a man is himself again, whatever he was covering.
    */
    restoreHome(out);
    // And the man coming IN has answered the return question, if one was open.
    settleReturn(inMan);
    team.lineup[slot] = inMan;
    team.bench[bIdx] = out;
    set({ version: version + 1 });
    get().autosave();
    return true;
  },

  assignPosition: (id, pos) => {
    const { season, userTeam, version } = get();
    const team = season?.teams[userTeam]?.team;
    if (!season || !team || get().busy) return false;
    const day = injuryClock(season);
    const holder = team.lineup.findIndex((p) => p.pos === pos);

    const inLineup = team.lineup.findIndex((p) => p.id === id);
    if (inLineup >= 0) {
      // Two men already in the nine trade labels, batting order untouched —
      // a substitution is not a reason to rewrite the card, and neither is
      // this. If nobody held the spot the set was broken, and he heals it.
      // Through adoptSpot, so both remember themselves and a later trip to
      // the bench undoes the appointment.
      const man = team.lineup[inLineup]!;
      if (holder === inLineup) return true;
      if (holder >= 0) adoptSpot(team.lineup[holder]!, man.pos);
      adoptSpot(man, pos);
      set({ version: version + 1 });
      get().autosave();
      return true;
    }

    const bIdx = team.bench.findIndex((p) => p.id === id);
    const man = team.bench[bIdx];
    if (!man || !available(man, day)) return false;
    if (holder >= 0) {
      // A bench man takes the spot; its holder walks to the bench and is
      // himself again there, whatever he had been covering.
      const out = team.lineup[holder]!;
      team.lineup[holder] = man;
      team.bench[bIdx] = out;
      adoptSpot(man, pos);
      settleReturn(man);
      restoreHome(out);
      set({ version: version + 1 });
      get().autosave();
      return true;
    }
    /*
      Nobody holds the spot, so the set is broken — a card from before covers
      adopted their slots. Somebody in the nine is wearing a duplicate; he is
      the one displaced, which makes this gesture the manual repair for
      exactly the two-first-basemen card that was reported.
    */
    const seen = new Set<string>();
    const dupe = team.lineup.findIndex((p) => {
      if (seen.has(p.pos)) return true;
      seen.add(p.pos);
      return false;
    });
    if (dupe < 0) return false;
    const out = team.lineup[dupe]!;
    team.lineup[dupe] = man;
    team.bench[bIdx] = out;
    adoptSpot(man, pos);
    settleReturn(man);
    restoreHome(out);
    set({ version: version + 1 });
    get().autosave();
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
    get().autosave();
  },

  promoteArm: (penId, slot) => {
    const { season, userTeam, version } = get();
    const team = season?.teams[userTeam]?.team;
    if (!season || !team || get().busy) return false;
    // The pitching coach's, when 'Rotation and bullpen' is his (M77).
    if (!handles(get().depth, 'bullpen')) return false;
    if (slot < 0 || slot >= team.rotation.length) return false;
    const up = team.bullpen.find((p) => p.id === penId);
    const down = team.rotation[slot];
    if (!up || !down) return false;
    if (!available(up, injuryClock(season))) return false;
    // Staff role is provenance, not the chair a pitcher happens to occupy.
    // Snapshot it permanently the first time either arm participates in a
    // rotation/bullpen swap. The earlier implementation deleted homeRole when
    // a promoted RP returned to the pen; repeated RP -> rotation -> pen cycles
    // could then leave the temporary SP label as the only surviving role.
    // Keeping the natural role makes the swap reversible forever:
    //
    //   RP in pen -> borrows SP while starting -> returns as RP
    //   SP in rotation -> slides to pen -> remains an SP by trade
    //
    // This is intentionally independent of which order the two taps happen in.
    // A bullpen arm labelled SP with no `homeRole` is NOT evidence of the old
    // corruption: `refill` and `regroup` in progression.ts have always parked
    // surplus starters in the pen exactly that way. The first version of this
    // "healed" such a man to RP, which demoted every honest sixth starter for
    // life the first time he was promoted and sent back. The corrupted shape
    // and the honest one are indistinguishable from the role alone, so the
    // role IS his home when nothing else says otherwise.
    const upHome = up.homeRole ?? up.role;
    const downHome = down.homeRole ?? down.role;
    up.homeRole = upHome;
    up.role = 'SP';
    settleReturn(up);
    down.homeRole = downHome;
    down.role = downHome;
    team.rotation[slot] = up;
    // The man coming down takes the promoted arm's place in the pen's order,
    // which is a swap the way every other move on the screen is a swap.
    team.bullpen = team.bullpen.map((p) => (p.id === penId ? down : p));
    // Both lists are his now (05 §91.1, §91.3).
    team.rotationByHand = true;
    team.penByHand = true;
    set({ version: version + 1 });
    get().autosave();
    return true;
  },

  moveRotation: (index, delta) => {
    const { season, userTeam, version } = get();
    const team = season?.teams[userTeam]?.team;
    if (!team || get().busy || !handles(get().depth, 'bullpen')) return;
    const to = index + delta;
    const rot = team.rotation;
    if (to < 0 || to >= rot.length) return;
    const x = rot[index];
    const y = rot[to];
    if (!x || !y) return;
    rot[index] = y;
    rot[to] = x;
    // His order: tonight's slot starts if the man is fit and has had two
    // nights, short rest or not (05 §91.3).
    team.rotationByHand = true;
    set({ version: version + 1 });
    get().autosave();
  },

  swapPen: (a, b) => {
    const { season, userTeam, version } = get();
    const team = season?.teams[userTeam]?.team;
    if (!team || get().busy || a === b || !handles(get().depth, 'bullpen')) return false;
    const i = team.bullpen.findIndex((p) => p.id === a);
    const j = team.bullpen.findIndex((p) => p.id === b);
    if (i < 0 || j < 0) return false;
    const x = team.bullpen[i]!;
    team.bullpen[i] = team.bullpen[j]!;
    team.bullpen[j] = x;
    team.penByHand = true;
    set({ version: version + 1 });
    get().autosave();
    return true;
  },

  autoLineup: () => {
    const { season, userTeam, version } = get();
    const team = season?.teams[userTeam]?.team;
    if (!team || !season || get().busy) return;
    // The injury clock: in June the schedule index has stopped, and a healed
    // man read as still out (M58).
    dealLikeAuto(team, injuryClock(season), battingForm(season));
    set({ version: version + 1 });
    get().autosave();
  },

  simWeek: async () => {
    const { season } = get();
    // Same doors `advanceDay` guards, for the same reasons — plus `live`,
    // because a week cannot pass while tonight's game is still being managed,
    // and a game that is starting (M84).
    if (!season || get().busy || get().live || get().liveStarting || seasonComplete(season)) return;
    const hold = unresolvedRosterDecision(season, get().userTeam, get().depth);
    if (hold) { set({ lineupGate: get().lineupGate + 1 }); get().go('team', 'lineup', hold.id); return; }
    const start = season.schedule[season.dayIndex]?.week;
    if (start === undefined) return;
    let guard = 0;
    const auto = !handles(get().depth, 'lineups');
    /*
      A week stops the moment it costs you somebody.

      Reported: "if after the first game of the week one of my players got
      injured, I want the simulation to stop and ask me to fix the lineup
      instead of keeping going until the sim ends and then informing me."
      He is right — the whole point of the week button is that nothing needs
      deciding, and a man going down is exactly the thing that does. The
      card is set for you only in casual; a coach who sets his own nine gets
      the week back so he can set it again.
    */
    const mine = get().userTeam;
    const roster = (): Player[] => {
      const t = season.teams[mine]?.team;
      return t ? [...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen] : [];
    };
    const walkingWounded = (): Set<string> => {
      const day = injuryClock(season);
      return new Set(roster().filter((p) => isHurt(p, day)).map((p) => String(p.id)));
    };
    let hurt = walkingWounded();
    let struck: string | null = null;
    get().noteRoster('prime');

    /*
      A day at a time, with the screen let through between them (audit 17,
      H4). The week ran as one block of 500-700 ms on a desktop, two to three
      seconds on a phone, with the spinner frozen and every tap queued behind
      it; a second tap on SIM WEEK then played a second week (M46). \`busy\`
      holds the door for the length of it, which every action that edits the
      season already respects.
    */
    set({ busy: true });
    try {
      while (!seasonComplete(season)
        && season.schedule[season.dayIndex]?.week === start
        && guard++ < 10) {
        if (auto) staffSetsTheCard(season, mine);
        simNextDay(season);
        const now = walkingWounded();
        const fresh = [...now].filter((id) => !hurt.has(id));
        hurt = now;
        if (fresh.length > 0 && !auto) {
          struck = fresh[0] ?? null;
          break;
        }
        await breathe();
        // The career may have been left mid-week (Leave to the front door).
        if (get().season !== season) return;
      }
    } finally {
      set({ busy: false });
    }
    get().syncRecruitingCalendar();
    if (struck !== null) {
      const man = roster().find((p) => String(p.id) === struck);
      if (man) set({ weekStoppedBy: man.name });
    }
    get().noteRoster('report', { stopped: struck !== null });
    set({ version: get().version + 1 });
    get().noteSeasonNews();
    get().autosave();
  },

  weekStoppedBy: null,
  clearWeekStop: () => {
    if (get().weekStoppedBy !== null || get().rosterAlert !== null) set({ weekStoppedBy: null, rosterAlert: null });
  },
  rosterAlert: null,
  clearRosterAlert: () => {
    if (get().rosterAlert !== null || get().weekStoppedBy !== null) set({ rosterAlert: null, weekStoppedBy: null });
  },
  noteRoster: (mode, opts) => {
    const { season, userTeam, depth } = get();
    if (!season) return;
    const key = `${season.seed ?? 0}:${userTeam}:${season.year ?? 0}`;
    const now = rosterWatch(season, userTeam);
    const before = rosterSeen && rosterSeen.key === key ? rosterSeen : null;
    rosterSeen = { key, ...now };
    if (mode === 'prime' || !before) return;
    // A coach who does not write the card has a staff that covers the man;
    // the lineup is not his to fix, and there is no decision to wait on.
    if (!handles(depth, 'lineups') && !handles(depth, 'depthChart')) return;
    const freshHurt = [...now.hurt].filter((id) => !before.hurt.has(id));
    const freshBack = handles(depth, 'lineups') ? [...now.back].filter((id) => !before.back.has(id)) : [];
    const team = season.teams[userTeam]?.team;
    if (!team || (freshHurt.length === 0 && freshBack.length === 0)) return;
    const everyone = [...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen];
    const find = (id: string): Player | undefined => everyone.find((p) => String(p.id) === id);
    const hurtMan = freshHurt.length > 0 ? find(freshHurt[0]!) : undefined;
    const fitMan = !hurtMan && freshBack.length > 0 ? find(freshBack[0]!) : undefined;
    const more = freshHurt.length + freshBack.length - 1;
    if (hurtMan) {
      set({ rosterAlert: {
        kind: 'hurt', id: String(hurtMan.id), name: hurtMan.name,
        what: prognosis(hurtMan, injuryClock(season)), more, stopped: opts?.stopped,
      } });
    } else if (fitMan) {
      set({ rosterAlert: { kind: 'fit', id: String(fitMan.id), name: fitMan.name, more } });
    }
  },
  seenTutorials: [],
  focusPlayer: null,
  boardAsk: null,
  stampBoardAsk: () => {
    const { season, userTeam, boardAsk } = get();
    if (boardAsk || !season) return;
    set({ boardAsk: boardAskFor(season, userTeam) });
    get().autosave();
  },

  arguedTerms: false,
  argueTerms: () => {
    const { boardAsk, lastOffseason, arguedTerms, season } = get();
    if (!boardAsk || !season || arguedTerms) return 0;

    /*
      The case, in the only terms that can be checked: how many men who
      would have played left over the winter. Graduations and the draft
      both count — a side is just as gone either way — and the bar is set
      where "most of our good players left" stops being a figure of speech.
    */
    // The winter's report, which the save carries now; the count the opener
    // kept of it stands in for a save from before it did.
    const lost = lastOffseason ? winterLosses(lastOffseason, get().userTeam) : get().seasonOpener?.departed ?? 0;
    // Nine is a whole starting side. Six is enough to be arguing in good
    // faith; below that the board is being asked for a favour, not a fix.
    const HEAVY = 6;
    set({ arguedTerms: true });
    if (lost < HEAVY) { get().autosave(); return 0; }

    // One win back per man beyond the bar, and never more than a fifth of
    // the ask — a board that concedes the season is not a board.
    const give = Math.min(lost - HEAVY + 1, Math.max(1, Math.round(boardAsk.targetWins * 0.2)));
    const target = Math.max(1, boardAsk.targetWins - give);
    // The opener carries its own copy of the number — the modal's "They want
    // N wins" and the strip the case is put from — and it kept the old one
    // after the board had come down. Reported 2026-09-10: "they accepted to
    // do less and still the board kept 18." One number, in both places.
    const opener = get().seasonOpener;
    set({
      boardAsk: {
        ...boardAsk,
        targetWins: target,
        objectives: objectivesFor(boardAsk.mandate, target, askSeed(get().season, get().userTeam)),
      },
      ...(opener ? { seasonOpener: { ...opener, targetWins: target } } : {}),
      version: get().version + 1,
    });
    get().autosave();
    return give;
  },
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
    get().autosave();
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
    get().autosave();
  },

  economy: freshEconomy(),
  rivalry: { w: 0, l: 0 },
  alumni: {},

  hireAssistant: (seat, slot) => {
    const { season, userTeam, year, economy } = get();
    const me = season?.teams[userTeam];
    if (!season || !me) return;
    const man = marketFor(String(season.seed ?? 0), year, seat)[slot];
    if (!man) return;
    // A filled seat is a REPLACEMENT, not a refusal: the Staff room offers
    // `Replace · $X` on an occupied seat, and the early return that used to
    // sit here made that button a no-op. The incumbent goes first (no
    // severance — his wage simply stops, the same as `fireAssistant`), so the
    // room the new man has to fit is what is left plus the wage freed.
    const without = { ...economy.staff };
    delete without[seat];
    // What the man going has already earned this year stays spent (M8).
    const owed = wagesEarned(season, get().phase, economy.staff[seat]?.wage ?? 0);
    // The wage has to fit what is left this year — a hire the ledger cannot
    // carry would be a negative number the screen has to explain.
    if (remaining({ ...economy, staff: without, spent: economy.spent + owed }, me.prestige) < man.wage) return;
    // A contract, not a standing arrangement (2026-09-10: "staff we hire
    // should have an expiring contract, right now it is easy to forget they
    // are even there"). The dear man signs for three years, the rest for two;
    // the offseason before it runs out is when he is renewed or let go.
    const signed: Assistant = { ...man, joinedYear: year, until: year + (slot === 0 ? 3 : 2) };
    const staff = { ...without, [seat]: signed };
    const plans = { ...(economy.staffPlans ?? {}) };
    plans[seat] = { directive: staffPlan(economy, seat).directive };
    const nextEconomy: Economy = { ...economy, staff, staffPlans: plans, spent: economy.spent + owed };
    applyCoachMods(season, userTeam, get().coach, nextEconomy);
    set({ economy: nextEconomy, version: get().version + 1 });
    get().autosave();
  },

  fireAssistant: (seat) => {
    const { season, userTeam, economy } = get();
    if (!season) return;
    if (!economy.staff[seat]) return;
    const staff = { ...economy.staff };
    delete staff[seat];
    const plans = { ...(economy.staffPlans ?? {}) };
    delete plans[seat];
    // His wage stops, but what he has earned this year stays spent: firing a
    // man after the season's work handed the whole wage back to build with
    // (audit 17, M8).
    const owed = wagesEarned(season, get().phase, economy.staff[seat]!.wage);
    const nextEconomy: Economy = { ...economy, staff, staffPlans: plans, spent: economy.spent + owed };
    applyCoachMods(season, userTeam, get().coach, nextEconomy);
    set({ economy: nextEconomy, version: get().version + 1 });
    get().autosave();
  },


  renewAssistant: (seat) => {
    const { economy, year, phase } = get();
    const man = economy.staff[seat];
    // The offseason only, and only a contract that is up: renewing early
    // would be a way to lock a wage the market is about to move.
    if (!man || phase === null || (man.until ?? Infinity) > year) return false;
    const renewed: Assistant = { ...man, until: year + 2, wage: Math.round(man.wage * 1.08) };
    const nextEconomy: Economy = { ...economy, staff: { ...economy.staff, [seat]: renewed } };
    set({ economy: nextEconomy, version: get().version + 1 });
    get().post({
      kind: 'season', year,
      title: `${man.name} signs on through ${year + 2}`,
      body: `Coach — your ${SEAT_LABEL[seat].toLowerCase()} stays two more seasons, at a little more than before.`,
    });
    get().autosave();
    return true;
  },

  setStaffDirective: (seat, directive) => {
    const { economy } = get();
    if (!handles(get().depth, 'assistants') || !economy.staff[seat]) return false;
    const allowed: Record<StaffSeat, StaffDirective[]> = {
      hitting: ['balanced','contact','power','discipline'],
      pitching: ['balanced','command','velocity','armCare'],
      recruiting: ['balanced','pipeline','stars','sleepers','needs'],
    };
    if (!allowed[seat].includes(directive)) return false;
    const plan = staffPlan(economy, seat);
    const next: Economy = {
      ...economy,
      staffPlans: { ...(economy.staffPlans ?? {}), [seat]: { ...plan, directive } },
    };
    if (get().season) applyCoachMods(get().season!, get().userTeam, get().coach, next);
    set({ economy: next, version: get().version + 1 });
    get().autosave();
    return true;
  },

  startStaffProject: (seat, kind, state, playerIds) => {
    const { economy, season } = get();
    if (!season || !handles(get().depth, 'assistants') || !economy.staff[seat]) return false;
    const facility = projectFacility(seat);
    const level = facilityLevel(economy, facility);
    if (level < 1) return false;
    const expectedSeat: StaffSeat = kind.startsWith('hitting-') ? 'hitting'
      : kind.startsWith('pitching-') ? 'pitching' : 'recruiting';
    if (expectedSeat !== seat) return false;
    if (seat === 'recruiting' && (!state || state.trim().length < 2)) return false;
    // One assignment a season: switching means cancelling first.
    const plan = staffPlan(economy, seat);
    if (plan.project) return false;
    const home = season.teams[get().userTeam]?.def.state ?? '';
    if (seat === 'recruiting' && state) {
      const strength = pipelineStrength(economy, state.trim().toUpperCase(), home);
      if (kind === 'pipeline-build' && strength >= PIPELINE_MIN) return false;
      if ((kind === 'pipeline-deepen' || kind === 'pipeline-maintain') && strength < PIPELINE_MIN) return false;
    }
    // The season runs to week 12, whenever it starts; a coach needs enough of
    // it left to be worth a point (the last week is too late for one).
    const week = season.recruiting.week;
    if (week < 1 || week > RECRUITING_WEEKS) return false;
    const weeks = RECRUITING_WEEKS - week + 1;
    const club = season.teams[get().userTeam]!.team;
    let ids: string[] = [];
    if (seat !== 'recruiting') {
      if (seasonGainFull(level, true, weeks) < 1) return false;
      // His own men, and ones the seat can work with: a hitting coach's are
      // bats, a pitching coach's arms. None named: the staff's suggestion.
      ids = playerIds?.length ? [...new Set(playerIds.map(String))] : suggestedTargets(economy, club, seat, kind, weeks);
      const pool = new Set(projectCandidates(club, seat, kind).map((p) => String(p.id)));
      if (ids.length === 0 || ids.length > SEASON_GROUP_MAX || ids.some((id) => !pool.has(id))) return false;
    }
    const project = newSeasonWork(economy, seat, kind, week, { home, state: state?.trim().toUpperCase(), targetIds: ids });
    const next: Economy = {
      ...economy,
      staffPlans: { ...(economy.staffPlans ?? {}), [seat]: { ...plan, project } },
    };
    if (season) applyCoachMods(season, get().userTeam, get().coach, next);
    set({ economy: next, version: get().version + 1 });
    get().autosave();
    return true;
  },

  cancelStaffProject: (seat) => {
    if (!handles(get().depth, 'assistants')) return;
    const { economy } = get();
    const plan = staffPlan(economy, seat);
    if (!plan.project) return;
    const next: Economy = {
      ...economy,
      staffPlans: { ...(economy.staffPlans ?? {}), [seat]: { ...plan, project: undefined } },
    };
    if (get().season) applyCoachMods(get().season!, get().userTeam, get().coach, next);
    set({ economy: next, version: get().version + 1 });
    get().autosave();
  },

  letStaffPick: (seats) => {
    const { season, userTeam, economy, coach } = get();
    const mine = season?.teams[userTeam];
    if (!season || !mine) return [];
    const next: Economy = { ...economy, staffPlans: { ...(economy.staffPlans ?? {}) } };
    // A casual staff turns its focus to the work; a coach's focus moves only off Balanced.
    const picked = staffPicksSeasonWork(next, mine.team, mine.def.state, season.recruiting.week, {
      seats, alignFocus: !handles(get().depth, 'assistants'),
    });
    if (picked.length) {
      applyCoachMods(season, userTeam, coach, next);
      set({ economy: next, version: get().version + 1 });
      get().autosave();
    }
    return picked;
  },

  build: (which) => {
    const { season, userTeam, economy } = get();
    const me = season?.teams[userTeam];
    if (!season || !me) return false;
    const up = economy.built ?? [];
    if (facilityLevel(economy, which) > 0) return false;
    const spec = buildingSpec(which);
    if (remaining(economy, me.prestige) < spec.cost) return false;

    const built = [...up, which];
    const facilityLevels = { ...(economy.facilityLevels ?? {}), [which]: 1 };
    const nextEconomy: Economy = {
      ...economy,
      built,
      facilityLevels,
      facilities: Math.min(MAX_FACILITY, built.length),
      spent: economy.spent + spec.cost,
    };
    applyCoachMods(season, userTeam, get().coach, nextEconomy);
    set({ economy: nextEconomy, version: get().version + 1 });
    get().autosave();
    return true;
  },

  upgradeFacility: (which) => {
    const { season, userTeam, economy } = get();
    const me = season?.teams[userTeam];
    if (!season || !me) return false;
    const level = facilityLevel(economy, which);
    if (level <= 0 || level >= FACILITY_MAX_LEVEL) return false;
    const nextLevel = level + 1;
    const cost = facilityUpgradeCost(which, nextLevel);
    if (remaining(economy, me.prestige) < cost) return false;
    const nextEconomy: Economy = {
      ...economy,
      facilityLevels: { ...(economy.facilityLevels ?? {}), [which]: nextLevel },
      spent: economy.spent + cost,
    };
    applyCoachMods(season, userTeam, get().coach, nextEconomy);
    set({ economy: nextEconomy, version: get().version + 1 });
    get().autosave();
    return true;
  },

  scoutTeam: (team) => {
    const { season, userTeam, economy } = get();
    const me = season?.teams[userTeam];
    if (!season || !me || team === userTeam) return;
    const until = economy.scouted[team] ?? -1;
    if (until >= season.dayIndex + SCOUT_DAYS) return;
    if (remaining(economy, me.prestige) < SCOUT_COST) return;
    /*
      Stage 22: buying the book mints the playbook — the reporter's flow:
      "the moment you scout a team it right away asks you to set up their
      playbook against them and takes you to do it." The book starts as a
      copy of the standing strategy, deliberately NOT pre-filled with
      counters; AUTO SET on the screen is the shortcut for whoever wants
      the desk's opinion.
    */
    const abbr = season.teams[team]?.def.abbr;
    if (abbr && !season.playbooks?.[abbr]) {
      season.playbooks = {
        ...(season.playbooks ?? {}),
        [abbr]: { ...DEFAULT_STRATEGY, ...me.strategy },
      };
    }
    set({
      economy: {
        ...economy,
        spent: economy.spent + SCOUT_COST,
        scouted: { ...economy.scouted, [team]: season.dayIndex + SCOUT_DAYS },
      },
      ...(abbr ? { playbookInvite: abbr } : {}),
      version: get().version + 1,
    });
    get().autosave();
  },

  setPlaybook: (abbr, key, value) => {
    const { season, version } = get();
    const book = season?.playbooks?.[abbr];
    if (!season || !book) return;
    season.playbooks = {
      ...season.playbooks,
      [abbr]: { ...book, [key]: value } as Strategy,
    };
    set({ version: version + 1 });
    get().autosave();
  },

  autoSetPlaybook: (abbr) => {
    const { season, version, userTeam } = get();
    const opp = season?.teams.find((t) => t.def.abbr === abbr);
    const me = season?.teams[userTeam];
    if (!season || !opp || !me) return null;
    // Staff-managed scouting can legitimately know an opponent before a manual
    // purchase has minted a book. In that case the staff start from the club's
    // standing strategy, then layer the same report-driven counters on top.
    const book = season.playbooks?.[abbr] ?? { ...DEFAULT_STRATEGY, ...me.strategy };
    /*
      The desk's opinion of how to play them, both sides of the ball, from
      what the purchase legitimately bought — see engine/counters.ts. Every
      threshold is a distance from this season's league, so the rows that
      move are the ones this club is actually unusual in, and an ordinary
      club keeps the standing plan's row. It used to set four positioning
      rows from absolute numbers a typical lineup never crossed, and the
      report was that AUTO moved nothing.
    */
    const plan = opponentPlan(season, opp, book);
    season.playbooks = { ...season.playbooks, [abbr]: plan };
    set({ version: version + 1 });
    get().autosave();
    // Counted so the screen can say it: an ordinary club moves nothing, and
    // "nothing moved" has to be told as a finding rather than felt as a fault.
    return (Object.keys(plan) as (keyof Strategy)[])
      .filter((k) => (plan[k] ?? null) !== (book[k as keyof typeof book] ?? null)).length;
  },

  lineupGate: 0,
  playbookInvite: null,
  dismissPlaybookInvite: () => set({ playbookInvite: null }),
  playbookFocus: null,
  setPlaybookFocus: (abbr) => set({ playbookFocus: abbr }),

  markTutorialSeen: (id) => {
    const seen = get().seenTutorials;
    if (seen.includes(id)) return;
    set({ seenTutorials: [...seen, id] });
    // Written through, or a reload re-teaches whatever was learned since the
    // last game ended.
    get().autosave();
  },

  markTutorialsSeen: (ids) => {
    const seen = get().seenTutorials;
    const add = ids.filter((id, i) => !seen.includes(id) && ids.indexOf(id) === i);
    if (add.length === 0) return;
    set({ seenTutorials: [...seen, ...add] });
    get().autosave();
  },

  resetTutorials: () => {
    set({ seenTutorials: [] });
    get().autosave();
  },

  depth: { ...DEFAULT_DEPTH, overrides: {} },

  // ---------------------------------------------------------------------------
  // God mode (05 §61). Thin: the rules live in engine/godMode.ts; every
  // action here checks the flag, writes, bumps the version and saves.
  // ---------------------------------------------------------------------------
  godEditPlayer: (id, patch) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return false;
    const found = findPlayer(season, id);
    if (!found) return false;
    editPlayer(found.player, patch);
    set({ version: version + 1 });
    get().autosave();
    return true;
  },

  godAddPlayer: (team, kind, opts = {}) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return null;
    const record = season.teams[team];
    if (!record) return null;
    const made = authorPlayer(season.rng, kind, 60, opts);
    addToTeam(record, made);
    set({ version: version + 1 });
    get().autosave();
    return made.id;
  },

  godSetPrestige: (team, prestige) => {
    const { season, version } = get();
    const record = season?.teams[team];
    if (!get().godMode || get().busy || !season || !record) return;
    setPrestige(record, prestige);
    set({ version: version + 1 });
    get().autosave();
  },

  godRenameProgram: (team, school, nickname) => {
    const { season, version } = get();
    const record = season?.teams[team];
    if (!get().godMode || get().busy || !season || !record) return;
    renameProgram(record, school, nickname);
    set({ version: version + 1 });
    get().autosave();
  },

  godSwapConferences: (a, b) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return false;
    // Not while a game or June is in flight: the managed game was built on the
    // schedule this would rewrite (audit 17, M68).
    const s0 = get();
    if (s0.live || s0.pendingGame || s0.liveStarting || s0.bracket || s0.myBracket) return false;
    if (!swapConferences(season, a, b)) return false;
    set({ version: version + 1 });
    get().autosave();
    return true;
  },

  godSetCoach: (patch) => {
    const { coach, season, userTeam, version } = get();
    if (!get().godMode || get().busy) return;
    const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));
    const skills = { ...coach.skills };
    for (const [k, v] of Object.entries(patch.skills ?? {})) {
      if (typeof v === 'number' && k in skills) skills[k as keyof CoachSkills] = clamp(v, 1, 99);
    }
    const next = {
      ...coach,
      skills,
      ...(patch.prestige !== undefined ? { prestige: clamp(patch.prestige, 1, 100) } : {}),
      ...(patch.skillPoints !== undefined ? { skillPoints: clamp(patch.skillPoints, 0, 999) } : {}),
    };
    // The in-game skills live on the team record too, as spendSkill notes.
    if (season) applyCoachMods(season, userTeam, next, get().economy);
    set({ coach: next, version: version + 1 });
    get().autosave();
  },

  godSetStaff: (seat, patch) => {
    const { economy, season, userTeam, coach, version } = get();
    if (!get().godMode || get().busy) return;
    const next: Economy = { ...economy, staff: { ...economy.staff } };
    if (!setStaff(next, seat, patch)) return;
    // A rated assistant is a different edge on the field.
    if (season) applyCoachMods(season, userTeam, coach, next);
    set({ economy: next, version: version + 1 });
    get().autosave();
  },

  godGrant: (kind, amount) => {
    const { economy, version } = get();
    if (!get().godMode || get().busy) return;
    const next: Economy = { ...economy };
    if (kind === 'money') grantMoney(next, amount);
    else grantRecruiting(next, amount);
    set({ economy: next, version: version + 1 });
    get().autosave();
  },

  godReshuffleSchedule: () => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return false;
    // Not while a game or June is in flight: the managed game was built on the
    // schedule this would rewrite (audit 17, M68).
    const s0 = get();
    if (s0.live || s0.pendingGame || s0.liveStarting || s0.bracket || s0.myBracket) return false;
    if (!reshuffleSchedule(season)) return false;
    set({ version: version + 1 });
    get().autosave();
    return true;
  },

  leagueNames: {},
  godSetLeagueName: (id, name) => {
    if (!get().godMode || get().busy) return;
    const next = { ...get().leagueNames };
    const clean = name.trim().slice(0, 40);
    if (clean.length > 0) next[id] = clean; else delete next[id];
    setLeagueNames(next);
    set({ leagueNames: next, version: get().version + 1 });
    get().autosave();
  },

  godHeal: (id) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return;
    const found = findPlayer(season, id);
    if (!found) return;
    healPlayer(found.player);
    set({ version: version + 1 });
    get().autosave();
  },

  godIronMan: (id, on) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return;
    const found = findPlayer(season, id);
    if (!found) return;
    setIronMan(found.player, on);
    set({ version: version + 1 });
    get().autosave();
  },

  godMovePlayer: (id, team) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return false;
    if (!movePlayer(season, id, team)) return false;
    set({ version: version + 1, ...outOfPortal(get().portal, id) });
    get().autosave();
    return true;
  },

  godCutPlayer: (id) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return false;
    if (!cutPlayer(season, id)) return false;
    set({ version: version + 1, selectedPlayer: null, ...outOfPortal(get().portal, id) });
    get().autosave();
    return true;
  },

  godSignPortal: (id) => {
    const { season, userTeam, portal, version } = get();
    if (!get().godMode || get().busy || !season || !portal) return false;
    const man = signPortalMan(season, portal.available, userTeam, id);
    if (!man) return false;
    set({
      portal: { ...portal, available: portal.available.filter((m) => m.player.id !== id) },
      portalArrivals: [...get().portalArrivals, man.player.name],
      version: version + 1,
    });
    get().autosave();
    return true;
  },

  godSetMood: (id, mood) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return;
    const found = findPlayer(season, id);
    if (!found) return;
    setMoodOf(found.player, mood);
    set({ version: version + 1 });
    get().autosave();
  },

  godSetRedshirt: (id, on) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return;
    const found = findPlayer(season, id);
    if (!found) return;
    setRedshirt(found.player, on);
    set({ version: version + 1 });
    get().autosave();
  },

  godSetAge: (id, age) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return;
    const found = findPlayer(season, id);
    if (!found) return;
    setAge(found.player, age);
    set({ version: version + 1 });
    get().autosave();
  },

  godGrantBadge: (id, badge, tier) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return;
    const found = findPlayer(season, id);
    if (!found) return;
    grantBadge(found.player, badge, tier);
    set({ version: version + 1 });
    get().autosave();
  },

  godRevokeBadge: (id, badge) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return;
    const found = findPlayer(season, id);
    if (!found) return;
    revokeBadge(found.player, badge);
    set({ version: version + 1 });
    get().autosave();
  },

  godTwoWay: (id, on) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return false;
    const found = findPlayer(season, id);
    if (!found) return false;
    const done = on ? makeTwoWayOf(found.team, found.player, season.rng) : unmakeTwoWay(found.team, found.player);
    if (!done) return false;
    set({ version: version + 1 });
    get().autosave();
    return true;
  },

  godAddRecruit: (kind) => {
    const { season, version } = get();
    if (!get().godMode || get().busy || !season) return null;
    const made = authorProspect(season, kind, 70);
    if (!made) return null;
    set({ version: version + 1 });
    get().autosave();
    return made.id;
  },

  godSetRecruitStars: (id, stars) => {
    const { season, version } = get();
    const p = season?.recruiting?.prospects.find((x) => x.id === id);
    if (!get().godMode || get().busy || !season || !p) return;
    setRecruitStars(p, stars);
    set({ version: version + 1 });
    get().autosave();
  },

  godSetRecruitWants: (id, weights) => {
    const { season, version } = get();
    const p = season?.recruiting?.prospects.find((x) => x.id === id);
    if (!get().godMode || get().busy || !season || !p) return;
    setRecruitWants(p, weights);
    set({ version: version + 1 });
    get().autosave();
  },

  godCommitRecruit: (id) => {
    const { season, userTeam, version } = get();
    const p = season?.recruiting?.prospects.find((x) => x.id === id);
    if (!get().godMode || get().busy || !season?.recruiting || !p) return;
    commitRecruit(season.recruiting, p, userTeam);
    set({ version: version + 1 });
    get().autosave();
  },

  godSetCoachMore: (patch) => {
    const { coach, season, userTeam, version } = get();
    if (!get().godMode || get().busy) return;
    const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));
    const habits: Record<string, number> = { ...(coach.habits ?? {}) };
    for (const [k, v] of Object.entries(patch.habits ?? {})) if (typeof v === 'number') habits[k] = clamp(v, 0, 9999);
    const count = (v: number | undefined, key: keyof CoachState): Record<string, number> =>
      v !== undefined && Number.isFinite(v) ? { [key]: clamp(v, 0, 9999) } : {};
    const name = patch.name?.trim().slice(0, 40);
    const next: CoachState = {
      ...coach,
      ...(name ? { name } : {}),
      ...(patch.age !== undefined ? { age: clamp(patch.age, 22, 80) } : {}),
      ...(patch.badges ? { badges: patch.badges } : {}),
      ...(patch.philosophy ? { philosophy: patch.philosophy } : {}),
      ...(patch.contractYears !== undefined ? { contractYears: clamp(patch.contractYears, 0, 10) } : {}),
      ...(patch.contractLength !== undefined ? { contractLength: clamp(patch.contractLength, 1, 10) } : {}),
      ...(patch.security !== undefined ? { security: clamp(patch.security, 0, 100) } : {}),
      ...(patch.tenure !== undefined ? { tenure: clamp(patch.tenure, 0, 40) } : {}),
      ...count(patch.careerWins, 'careerWins'),
      ...count(patch.careerLosses, 'careerLosses'),
      ...count(patch.titles, 'titles'),
      ...count(patch.conferenceTitles, 'conferenceTitles'),
      ...count(patch.regionalTitles, 'regionalTitles'),
      ...count(patch.tournaments, 'tournaments'),
      ...(patch.habits ? { habits } : {}),
    };
    // A philosophy change is a standing-strategy change too, as creation makes it.
    if (patch.philosophy && season) {
      const me = season.teams[userTeam];
      if (me) me.strategy = strategyForPhilosophy(patch.philosophy);
    }
    if (season) applyCoachMods(season, userTeam, next, get().economy);
    set({ coach: next, version: version + 1 });
    get().autosave();
  },

  godPreset: (kind) => {
    const { season, userTeam, version } = get();
    if (!get().godMode || get().busy || !season) return;
    if (kind === 'parity') presetParity(season);
    else if (kind === 'chaos') presetChaos(season, ((season.rng.state?.() ?? 0) ^ version) >>> 0);
    else { const me = season.teams[userTeam]; if (me) presetSuperteam(me); }
    set({ version: version + 1 });
    get().autosave();
  },

  godStack: [],
  liveStarting: false,
  openGod: (target) => {
    if (!get().godMode || get().busy) return;
    const stack = get().godStack;
    if (sameGodTarget(stack[stack.length - 1], target)) return;
    /*
      A sheet already open anywhere in the stack is raised rather than opened
      twice, and the stack is capped. Only the top was checked before, so
      bouncing between two editors grew the stack without bound — and every
      push spends a browser history entry (05 §63.1).
    */
    if (stack.some((t) => sameGodTarget(t, target)) || stack.length >= 8) return;
    set({ godStack: [...stack, target] });
  },
  closeGod: () => set({ godStack: get().godStack.slice(0, -1) }),
  // Every sheet in one write: one level each, all given back at once.
  closeGodAll: () => set({ godStack: [] }),

  godForkToSandbox: async () => {
    const { season, userTeam } = get();
    if (!season || get().godMode || godForkInFlight) return false;
    godForkInFlight = true;
    try {
      const school = season.teams[userTeam]?.def.school ?? 'Dynasty';
      // The original first, as a named snapshot, so the fork can never cost it.
      // Do not turn the live career into a sandbox unless that protection copy
      // actually reached storage.
      // Into its own file, which the fork leaves alone: a second named copy
      // of it here only put a third row of the same name on the list (M37).
      const protectedOriginal = await get().saveNow();
      if (!protectedOriginal) return false;

      // Then the copy, flagged, into its own slot — and into the chair.
      const slot = newSlotId();
      set({ godMode: true });
      setStarGateOpen(true);
      const sandboxSaved = await get().saveNow(slot, `${school} · sandbox`);
      if (!sandboxSaved) {
        set({ godMode: false });
        setStarGateOpen(false);
        return false;
      }
      await get().refreshSaves();
      return get().loadSlot(slot);
    } finally {
      godForkInFlight = false;
    }
  },

  setDepthMode: (mode) => {
    const before = handles(get().depth, 'recruiting');
    const armsBefore = handles(get().depth, 'bullpen');
    set({ depth: setMode(get().depth, mode) });
    if (armsBefore && !handles(get().depth, 'bullpen')) staffTakesThePen(get);
    // No preset hands recruiting over today; checked anyway, so the day one
    // does, the staff is seeded and planned the way the switch below does it.
    if (before && !handles(get().depth, 'recruiting')) staffTakesTheBoard(get);
    // A staff handed to the AD is his to fill, now rather than next winter.
    adStaffsUp(get, set);
    roomPicksLeader(get);
    get().autosave();
  },

  setDepthSystem: (key, value) => {
    const before = handles(get().depth, 'recruiting');
    const armsBefore = handles(get().depth, 'bullpen');
    set({ depth: setSystem(get().depth, key, value) });
    if (armsBefore && !handles(get().depth, 'bullpen')) staffTakesThePen(get);
    /*
      Handing recruiting to the staff mid-season takes effect now: a cold board
      is seeded and this week is planned, unless the coach had already planned
      it (2026-09-28, bug 1). Taking it back does nothing: the staff's week
      stays on the board as the coach's own, and he can edit it.
    */
    if (key === 'recruiting' && before && !handles(get().depth, 'recruiting')) staffTakesTheBoard(get);
    // A staff handed to the AD is his to fill, now rather than next winter.
    if (key === 'assistants') adStaffsUp(get, set);
    if (key === 'captains') roomPicksLeader(get);
    get().autosave();
  },

  saveState: 'idle',
  lastSaveError: null,
  simError: null,
  loadError: null,
  backupFor: null,

  autosave: () => {
    if (!get().season) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    // Owed is as good as under way: the chip must not read 'saved' over a
    // change that is not on disk yet.
    ++saveTicket;
    if (get().saveState !== 'saving') set({ saveState: 'saving', lastSaveError: null });
    autosaveTimer = setTimeout(() => { autosaveTimer = null; void get().saveNow(); }, autosaveMs);
  },

  flushAutosave: () => {
    if (!autosaveTimer) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
    void get().saveNow();
  },

  saveNow: async (slot?: string, name?: string) => {
    const { season, year, userTeam, history, lastPostseason } = get();
    if (!season) return false;
    // A full write of this career answers any autosave still waiting for it.
    if (autosaveTimer && (slot === undefined || slot === (get().loadedSlot ?? AUTOSAVE_SLOT))) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    /*
      The file this career was opened from, unless a caller names another. It
      used to default to the autosave slot however the career had been
      opened, so loading a named save and playing a day overwrote whatever
      career the autosave held — one tap on a row in the saves menu, and the
      career that lived only there was gone (05 §62.3).
    */
    const target = slot ?? get().loadedSlot ?? AUTOSAVE_SLOT;
    const team = season.teams[userTeam];
    const ticket = ++saveTicket;
    set({ saveState: 'saving', lastSaveError: null });
    try {
      // Mid-game, the file keeps the journal's first-pitch generator (H2).
      const live = get().live;
      const anchor = live && !live.over ? readJournal() : null;
      // A file keeps the name it was given: an autosave used to rename every
      // copy, and the sandbox, back to the school (audit 17, M55).
      const label = name ?? slotNames.get(target) ?? (team ? team.def.school : 'Dynasty');
      await saveDynasty(target, label, season, year, userTeam, {
        ...(anchor && anchor.slot === target && anchor.year === year ? { rngState: anchor.rngState } : {}),
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
        boardAsk: get().boardAsk,
        // Whether the case was already put to the board this season. Without
        // it a reload offered the button again, and a second concession.
        arguedTerms: get().arguedTerms,
        seasonOpener: get().seasonOpener,
        seasonPlanYear: get().seasonPlanYear,
        // The winter's report, held from the draft step to the next one. Left
        // out, a career reopened mid-offseason had no Draft board to show.
        lastOffseason: get().lastOffseason,
        watch: get().watch,
        economy: get().economy,
        rivalry: get().rivalry,
        alumni: get().alumni,
        depth: get().depth,
        replaceLost: get().replaceLostRecruits,
        godMode: get().godMode,
        leagueNames: get().leagueNames,
        portal: portablePortal(get().portal),
        approaches: get().approaches,
        /*
          How many the room has had this season, and the one still open.

          Both matter across a reload for the same reason: without `press` a
          resumed season starts its eight again, and without the open question
          a coach who closed the app mid-answer never gets asked. Stored as an
          id rather than the question itself, so the pool can be rewritten
          without stranding a save on a version of a sentence.
        */
        wordsUsed: get().wordsUsed,
      });
      slotNames.set(target, label);
      if (ticket === saveTicket) set({ saveState: 'saved' });
      return true;
    } catch (e) {
      // A failed save must say so. Silently losing a dynasty is the worst
      // outcome this app has available to it. Stale requests stay quiet — a
      // newer save has already reported, and its answer is the true one.
      if (ticket === saveTicket) {
        set({ saveState: 'error', lastSaveError: e instanceof Error ? e.message : String(e) });
      }
      return false;
    }
  },

  loadBackup: async (slot) => {
    if (!(await get().loadSlot(backupSlotOf(slot)))) return false;
    const kept = slotNames.get(backupSlotOf(slot));
    if (kept !== undefined) slotNames.set(slot, kept);
    // The copy carries on as the career it was kept for: the next save
    // writes over the record that would not open.
    set({ loadedSlot: slot, backupFor: null });
    return true;
  },

  loadSlot: async (slot = AUTOSAVE_SLOT) => {
    // The career being left keeps its last changes (M43).
    get().flushAutosave();
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
      // The journal's two stores to agreement first, so the offer of an
      // interrupted game below reads the copy that survived the phone.
      await reconcileJournal();
    } catch (e) {
      set({
        loadError: e instanceof Error ? e.message : String(e),
        needsTeam: true,
        backupFor: await offerBackup(slot),
      });
      return false;
    }
    if (!loaded) return false;
    slotNames.set(slot, loaded.name);
    // A save that would throw on its first game is refused here, where the
    // player is told and can start again, rather than a day into a career
    // that cannot move (05 §62.6).
    const broken = assertSeason(loaded.season, loaded.userTeam);
    if (broken) {
      set({ loadError: broken, needsTeam: true, backupFor: await offerBackup(slot) });
      return false;
    }
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
    /*
      Except a chair he is leaving. Between the meeting that let him go (sacked,
      retiring, or on notice) and the job he takes, the carousel has already
      put a successor in it, and `seatCoaches` empties the user's chair — so a
      reload there deleted the man the carousel posts had named.
    */
    const leavingChair = Boolean(loaded.jobSearch) || (loaded.phase === 'review' && (
      (loaded.review as Review | null | undefined)?.fired === true
      || coach.farewellYear === loaded.year || coach.resignYear === loaded.year));
    seatCoaches(loaded.season, leavingChair ? -1 : loaded.userTeam, loaded.year);
    stampTreeChairs(loaded.season, usableEconomy(loaded.economy));
    // Restamped on every load rather than trusted from the save, so a save from
    // before the in-game skills were wired — or one that predates a job change —
    // comes up with the edge on the right program.
    applyCoachMods(loaded.season, loaded.userTeam, coach, usableEconomy(loaded.economy));
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
        /*
          A year the roll has closed, and no other.

          The career row is booked at the board meeting and the school's own
          row at the year roll, and `year` only moves at the roll — so for the
          whole winter the season just played has the first and not yet the
          second. A save loaded anywhere in there seeded it from the career
          row, which counts June's games (it is the coach's overall record),
          and the roll then found the year already in the book and kept the
          seed. Reported 2026-09-25 from the season-start terms: "You won 45
          last season" for a 39-6 year that finished 45-10. That year is the
          roll's to write, from the frozen regular season.
        */
        if (row.year >= loaded.year) continue;
        if (row.school !== chair.def.school) continue;
        if (chair.annals.some((a) => a.year === row.year)) continue;
        chair.annals.push({
          year: row.year, w: row.w, l: row.l, cw: row.cw, cl: row.cl,
          // The career row's `rpi` is the *value*, not a place in a table, and
          // the table it was computed against is gone — so the seeded year
          // honestly has no rank rather than a rating dressed up as one.
          confPlace: row.confPlace, rank: 0,
          wonConference: row.wonConference,
          madeTournament: ['national', 'omaha', 'runner-up', 'champion'].includes(row.finish), finish: row.finish,
          coach: coach.name,
        });
      }
      chair.annals.sort((a, b) => a.year - b.year);
    }
    /*
      And last year's seeded row put right, where the save still knows how.

      A seeded row is the one with no rank: every row the roll writes carries
      the program's place in the national table, and a seed never can. The
      seed's record is the career row's, June included, where the book keeps
      the regular season. The roll carries each program's regular season into
      the next one as `lastW`/`lastL`, and nothing else writes them, so on any
      save they describe the year before the save's own, whichever step of the
      winter it was taken on — the one year a wrong seed can be corrected.
      Every program rather than the chair alone: a coach who has since moved
      on left his seeded year in his old school's book. A record shorter than
      the regular season cannot be the overall one and is left alone, and the
      years before this one have nothing left to correct them from.
    */
    for (const t of loaded.season.teams) {
      const last = t.annals?.find((a) => a.year === loaded.year - 1);
      if (!last || last.rank !== 0) continue;
      if (typeof t.lastW !== 'number' || typeof t.lastL !== 'number') continue;
      if (last.w === t.lastW && last.l === t.lastL) continue;
      if (last.w < t.lastW || last.l < t.lastL) continue;
      last.w = t.lastW;
      last.l = t.lastL;
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
    const loadedLeagueNames = usableLeagueNames(loaded.leagueNames);
    // These two are module-level readers used by systems outside Zustand.
    // Restoring only the store fields made God Mode leak across save changes:
    // a normal career loaded after a sandbox could inherit the open star gate,
    // while a sandbox loaded fresh could lose it; league renames had the same
    // cross-save problem. Put the live save back into both modules before the
    // UI or recruiting board can read the new world.
    setStarGateOpen(loaded.godMode);
    setLeagueNames(loadedLeagueNames);
    // The portal board itself is transient gameplay state, not derivable from
    // `phase` alone. Older saves could say `phase: 'portal'` while loading a
    // null board, which rendered an entirely blank offseason step. A modern
    // save carries the board as ids (`portablePortal`), re-linked here to the
    // loaded season's own men; a save from before that is rebuilt below, after
    // the world is in place, with the moods settled the way the step itself
    // settles them (05 §62.3, §62.8).
    const restoredPortal = usablePortal(loaded.portal, loaded.season);

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
      /*
        The frozen ask, or one freeze for a save that predates the stamp: a
        career loaded mid-season computes it once here — mildly drifted by
        however far the roster has come, but held from this moment on, which
        is the property that actually matters.
      */
      boardAsk: (loaded.boardAsk as Expectation | null | undefined)
        ?? boardAskFor(loaded.season, loaded.userTeam),
      arguedTerms: loaded.arguedTerms === true,
      seasonOpener: usableOpener(loaded.seasonOpener),
      // Absent (an older save) is owed one: the plan comes up once.
      seasonPlanYear: usableSeasonPlanYear(loaded.seasonPlanYear),
      needsTeam: false,
      // Through the front door and into the career. Remembering WHICH file it
      // came from is what lets a delete of that file take the career with it,
      // rather than being undone by the next autosave.
      atStart: false,
      loadedSlot: slot,
      // Whatever went wrong last time went wrong with a different save. Left
      // set, a newer-build slot refused once would keep warning about itself
      // over the top of the career that loaded perfectly well afterwards.
      loadError: null,
      backupFor: null,
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
      alumni: withoutRosterMen(usableAlumni(loaded.alumni), loaded.season, loaded.userTeam),
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
      // Absent is on, which is every save from before the staff list.
      replaceLostRecruits: usableReplaceLost(loaded.replaceLost),
      godMode: loaded.godMode,
      leagueNames: loadedLeagueNames,
      approaches: usableApproaches(loaded.approaches),
      liveStarting: false,
      // Unread stays unread across a restart. It is the one thing the inbox
      // knows that nothing else in the save does.
      inbox: restoreInbox(loaded.inbox),
      // Back to the step the offseason was on, so a reload mid-sequence resumes
      // rather than stranding the player on the dashboard with a week of
      // recruiting budget already spent and nowhere to spend the rest.
      phase: (loaded.phase === 'recruiting' ? 'signing' : (loaded.phase ?? null)) as Phase,
      portal: restoredPortal,
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
        : Math.max(0, PHASES.indexOf((loaded.phase === 'recruiting' ? 'signing' : loaded.phase ?? null) as Exclude<Phase, null>)),
      lastReview: (loaded.review ?? null) as Review | null,
      reviewDismissed: false,
      lastOutcome: (loaded.outcome ?? null) as SeasonOutcome | null,
      version: get().version + 1,
      tab: 'home', /* nav-write */
      screen: 'today', /* nav-write */
      // Whatever was covering the screen belonged to the dynasty being put
      // down — including the saves menu this was very likely pressed from.
      overlay: null, overlayStack: [],
      selectedPlayer: null, coachSeat: null,
      godStack: [],
      /*
        The winter's report, back as it was left. It used to be dropped here,
        so a career reopened on the draft step showed an empty Draft board tab
        and lost its own departures, and one reopened anywhere later in the
        winter opened the next season on a report with nobody in it. A save
        from before it rode the file has none, and the draft step says so.
      */
      lastOffseason: usableOffseason(loaded.lastOffseason),
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
      pendingGame: pendingFromJournal(loaded.season, loaded.year, slot),
      // A sim that was running belonged to the old world too; the generation
      // bump above makes its result unwelcome, and the flags come home.
      busy: false,
      progress: null,
      // The skill ledger is a fact about a step of the *old* career's offseason.
      spentThisStep: {},
    });
    // The two module registries the screens read were synced above, before
    // the world was swapped in — with the save that just landed rather than
    // with whichever career was started last (05 §62.3).
    /*
      A save taken on the portal step before the pool rode the file comes
      back without one. Rebuilt from the season, quietly — no wire, no staff
      pass — so the step has a screen and a way out (05 §62.3).
    */
    /*
      A save from before recruiting moved into the regular season (05 §63.6)
      carries `recruiting.week` 0 — the old offseason window, not yet open —
      and a class nobody was seeded against. Left alone, the board read
      CLASS CLOSED for the whole spring while the desk still promised points,
      and every recruit read NOBODY ON HIM. Opened here the way a new season
      opens it: seeded once (the seeding is additive, so only a board with no
      interest on it), week one, and then the calendar banks whatever weeks
      the schedule has already crossed. A season already over is closed out
      week by week, so the ninety-five still sign their classes.
    */
    {
      const s = get().season;
      if (s && s.recruiting.week === 0 && s.recruiting.prospects.length > 0) {
        const untouched = !s.recruiting.prospects
          .some((p) => Object.values(p.points).some((v) => v > 0));
        if (untouched) {
          // The coached programme is never seeded: a staff works only the
          // coach's list (2026-09-30).
          seedRivalInterest(s, get().userTeam, false);
        }
        s.recruiting.week = 1;
        if (get().phase === null) {
          get().syncRecruitingCalendar();
        } else if (seasonComplete(s)) {
          let guard = 0;
          while (s.recruiting.week <= RECRUITING_WEEKS && guard++ <= RECRUITING_WEEKS) {
            get().advanceRecruitingWeek();
          }
        }
        set({ version: get().version + 1 });
      }
    }
    /*
      The staff's week, where the staff runs recruiting. A save written before
      the staff's week lived on the board (2026-09-28) has nothing there
      mid-week, and the band would read "nothing planned" until the close; a
      modern one has its plan already, and this only tends the list.
      Staffed first, where the AD runs the staff and a seat stood empty, so a
      new coordinator works this week.
    */
    adStaffsUp(get, set);
    get().staffPlanWeek();
    roomPicksLeader(get);
    // A save stood on a portal that had already closed (written by a build
    // that let the rail walk back onto it) moves on rather than reopening it.
    if (get().phase === 'portal' && closedStep(get(), 'portal')) {
      set({ phase: stepAfter('portal', rulesOf(get().season)), version: get().version + 1 });
    }
    if (get().phase === 'portal' && get().portal === null) {
      const season = get().season;
      const rec = season?.teams[get().userTeam];
      if (season && rec) {
        // A save from before the settle moved to this step has not had one.
        settleTheMoods(season, get().userTeam, leversFor(get().coach.badges).moodSwing);
        const pool = openPortal(season.teams, {
        year: get().year, seed: season.seed ?? 0, batting: season.batting, pitching: season.pitching,
        // THE KEEPER, on the coached program only (coachEdges.ts).
        exitFor: (team) => (team === get().userTeam ? leversFor(get().coach.badges).portalExit : 1),
      });
        const mine = pool.filter((m) => m.from === get().userTeam);
        const theirs = pool
          .filter((m) => m.from !== get().userTeam)
          .sort((a, b) => overallOf(b.player) - overallOf(a.player));
        set({ portal: { leaving: mine, available: theirs, spent: 0 } });
      }
    }
    return true;
  },

  saves: [],
  /** The slot this career was loaded from or last written to by name. */
  loadedSlot: null,
  atStart: true,
  leaveStart: () => set({ atStart: false }),
  backToStart: () => {
    /*
      Everything in flight stops. A sim landing after this would write the
      career back into the slot it was just let go of, which is the bug
      this screen exists to end.
    */
    simGeneration += 1;
    disposeWorker();
    setStarGateOpen(false);
    setLeagueNames({});
    set({
      atStart: true,
      season: null,
      godMode: false,
      leagueNames: {},
      live: null,
      liveMeta: null,
      pendingGame: null,
      bracket: null,
      needsTeam: false,
      busy: false,
      progress: null,
      seasonOpener: null,
      seasonPlanYear: null,
      selectedPlayer: null, coachSeat: null,
      godStack: [],
      overlay: null, overlayStack: [],
      loadedSlot: null,
      phase: null,
      inbox: [],
      boardAsk: null,
      lastReview: null,
      replaceLostRecruits: true,
      version: get().version + 1,
    });
    void get().refreshSaves();
  },
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
    // Whether this is the file the live career is writing to. Deleting that
    // one used to be undone by the very next tap, because saveNow defaults
    // to the autosave slot — reported as "hitting delete a save doesn't
    // really delete it". Letting the file go now lets the career go too.
    const live = get().season !== null
      && (slot === AUTOSAVE_SLOT || slot === get().loadedSlot);
    try {
      await deleteSave(slot);
      // Remove it from the visible list immediately. IndexedDB refreshes can
      // arrive a frame later on mobile; leaving the deleted row on screen made
      // a successful delete look like it failed.
      set({ saves: get().saves.filter((s) => s.slot !== slot) });
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    }
    if (failure === null && live) get().backToStart();
    else await get().refreshSaves();
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
    setStarGateOpen(false);
    setLeagueNames({});
    set({
    season: null,
    godMode: false,
    needsTeam: true,
    busy: false,
    liveStarting: false,
    approaches: { tried: [], interest: [] },
    leagueNames: {},
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
    overlay: null, overlayStack: [],
    selectedPlayer: null, coachSeat: null,
    godStack: [],
    loadError: null,
    backupFor: null,
    replaceLostRecruits: true,
    seasonPlanYear: null,
    });
  },
}), PHASES));

// The app going to the background is the last chance a phone gives: whatever
// autosave is still waiting is written now (audit 17, M43).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') useDynasty.getState().flushAutosave();
  });
  window.addEventListener('pagehide', () => useDynasty.getState().flushAutosave());
}

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
