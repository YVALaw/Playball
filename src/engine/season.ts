// season.ts
// The calendar is the game. A conference schedule, a day by day loop, season
// long statistics, standings, and an RPI approximation.
//
// Headless and pure, like everything else in this directory. Note there are no
// Date objects anywhere: a day is an integer offset from the start of the
// season. Real calendar dates are a presentation concern, and keeping them out
// of here is what lets a season replay exactly from its seed.

import {
  largestDeficit, noFeats, noteGame, type SeasonFeats,
} from './achievements.js';
import { coverFor } from './depthChart.js';
import { makeTeam, reserveNames, resetNames } from './players.js';
import { overallOf } from './ratings.js';
import { initialPrestige } from './program.js';
import { strategyFor, type Strategy } from './strategy.js';
import { generateClass, type RecruitClass } from './recruiting.js';
// Type only, and it has to stay that way: draft.ts reads this file's rate
// helpers at runtime, so a value import here would close the loop.
import type { DraftBoard } from './draft.js';
// Type only, and it has to stay that way: `rivals.ts` imports this module for
// `SeasonState`, so a runtime import here would close the loop.
import type { RivalCoach } from './rivals.js';
import { simGame, type GameResult, type TeamState } from './game.js';
import { blankWatch, type Watch } from './tendencies.js';
import {
  CAREER_MIN_IP, CAREER_MIN_AB, offer, recordGameMarks, seededBook,
  type RecordBook,
} from './records.js';
import { CONFERENCES, type ConferenceDef, type SchoolDef } from '../data/schools.js';
import type { SchoolCulture } from '../data/cultures.js';
import { teamId } from './types.js';
// Type only, and it has to stay that way: `hall.ts` reads `careerName` out of
// this module, so a value import back the other way would be a runtime cycle.
import type { Inductee } from './hall.js';
// Type only, and it has to stay that way: `postseason.ts` is built on this
// module, so a value import back the other way would be a runtime cycle. The
// school annals speak the postseason's vocabulary for how a year ended.
import type { Finish } from './postseason.js';
import type {
  EngineName, FieldLine, HitLine, Hitter, PitchLine, Pitcher, Player, PlayerId, Rng,
  Team, TeamId,
} from './types.js';

// ---------------------------------------------------------------------------
// Shape of a season
// ---------------------------------------------------------------------------

export interface SeasonConfig {
  /** Three game weekend series against a conference opponent. */
  seriesRounds: number;
  /** Single midweek games against a team from another conference. */
  nonConferenceGames: number;
  engine: EngineName;
}

/**
 * 45 games: eleven three-game conference series (33) plus twelve non-conference
 * midweek games.
 *
 * Eleven series against an eleven team field is a **full round robin**: you play
 * everybody in your conference, every season, and after three years you know
 * them. That property is the reason the schedule is built this way, and it
 * survived the world growing from eight programs a conference to twelve.
 *
 * Twelve rather than eight so that qualifying for the conference tournament is
 * an achievement — six of twelve get in, so half the league is finished in May.
 * At eight the cut was two teams and finishing seventh cost you nothing.
 *
 * The non-conference games are not flavour. A league that only played itself
 * would be eight sealed islands: every conference would post identical aggregate
 * records, RPI would have nothing to compare, and there would be no honest basis
 * for an at-large national field. Crossing conferences is what makes strength of
 * schedule a real quantity.
 *
 * The midweek arm — rotation slot 3 — starts all twelve non-conference games, so
 * the Friday/Saturday/Sunday/midweek rotation the mockup shows is real.
 */
export const DEFAULT_SEASON: SeasonConfig = {
  // Eleven conference opponents, three games each, plus twelve midweek
  // non-conference games: forty five. Closer to the real thing than thirty three
  // was, and long enough that a batting average starts to mean something.
  seriesRounds: 11,
  nonConferenceGames: 12,
  engine: 'log5',
};

/**
 * How many games a season is, from the config rather than from how many have
 * been played so far. The board's target has to be a full-season number on day
 * one — scaling it by games played meant the target crept upward all year and
 * was only correct on the final day.
 */
export const seasonLength = (config: SeasonConfig): number =>
  config.seriesRounds * 3 + config.nonConferenceGames;

/** The record a board actually judges: regular season only. */
/** One season of one player's college career, as the record book keeps it. */
export interface CareerYear {
  year: number;
  classYear: string;
  /** The program he played it for. */
  team: string;
  /**
   * What he was called, written on the row rather than looked up.
   *
   * The record book is the last thing in a save that remembers a man: rosters
   * are rewritten every June and a departure notice survives one offseason, so
   * four years after he left this is all there is. While the id was his name the
   * book did not have to write it down. Now that it is not, the hall of fame and
   * the alumnus card have nothing else to print.
   *
   * Optional because rows written before this field existed have none — and
   * those are exactly the rows filed under an id that *is* the name, which is
   * what both screens fall back to.
   */
  name?: string;
  /**
   * Hitters.
   *
   * Doubles and triples are here for the hall of fame, which prices a career in
   * runs and cannot do that without total bases. While they were missing the
   * only available approximation was hits plus home runs, which scores every
   * gap hitter in the archive as a singles hitter — a systematic libel against
   * exactly the kind of player a hall exists to argue about. Optional like the
   * rest, so a row written before they were kept simply has none.
   */
  ab?: number; h?: number; d?: number; t?: number;
  hr?: number; rbi?: number; bb?: number; sb?: number;
  /** Pitchers. */
  w?: number; l?: number; outs?: number; er?: number; k?: number;
  /**
   * Gloves. Everyone who took the field, which is nearly everyone.
   *
   * Only the three that carry the story — how many came at him, how many he
   * turned into outs, and how many he did not. Plays above expected is the
   * difference against `expected`, and that stays out of the record book on
   * purpose: it is measured against the team he happened to play for that year,
   * so it does not mean the same thing in two different rows and cannot be
   * summed down a career column.
   */
  chances?: number; plays?: number; errors?: number;
}

/**
 * One man's career so far, league-wide, as a running total.
 *
 * This is B13, and it is the cheap half of the expensive idea. Career records
 * need every program's careers and not only the user's — but a record book does
 * not need the *seasons*, it needs the totals, which is the same observation
 * `records.ts` is built on one level down. So instead of archiving twenty five
 * hundred `CareerYear` rows a year for ever, one row per active player is kept
 * and added to each June.
 *
 * **It is pruned by construction, which is what makes it bounded.** The map is
 * rebuilt each June from the rosters, so a man who has graduated falls out of it
 * the following year — and that is safe precisely because his total was final the
 * moment he left and had already been offered to the book. The map is therefore
 * never larger than the league is: about twenty four hundred rows, for ever,
 * rather than twenty four hundred more every season.
 *
 * Only what a career record actually reads. There is no walks column because
 * there is no career on-base record, and no games column because a career rate
 * qualifies on plate appearances.
 */
export interface CareerTotals {
  /** Seasons he has appeared in. */
  y: number;
  /**
   * The last season folded in.
   *
   * The offseason rail can be walked backwards and forwards, so the scan that
   * writes this can run twice on the same June. Every other pass over a finished
   * season is idempotent because a record has to be beaten rather than equalled;
   * a running total is the one thing that is not, and this is what makes it so.
   */
  last: number;
  ab: number; h: number; d: number; t: number; hr: number;
  r: number; rbi: number; sb: number;
  outs: number; w: number; l: number; er: number; k: number;
  /**
   * And the same career, June only.
   *
   * A separate line rather than a flag, because the two questions are different
   * and both get asked: what a man did over four years, and what he did when it
   * mattered. "He hit .380 in three tournaments" is the kind of fact a dynasty
   * is actually made of, and it is unrecoverable after the fact — box scores are
   * kept only for the user's own program, so a rival's June would be gone.
   *
   * Optional, because every career row written before postseason splits existed
   * has none, and a man who has never reached June has none either. A missing
   * line and a line of zeroes mean the same thing to every reader.
   */
  post?: PostTotals;
}

/** A career's postseason half. The same columns, counted only in June. */
export interface PostTotals {
  /** Tournaments appeared in — the postseason's equivalent of seasons. */
  y: number;
  /** The last June folded in, for the same idempotence reason `last` exists. */
  last: number;
  ab: number; h: number; d: number; t: number; hr: number;
  r: number; rbi: number; sb: number;
  outs: number; w: number; l: number; er: number; k: number;
}

/**
 * What a man was called, out of the only record that outlives him.
 *
 * Two screens ask this — the hall of fame lists him, the alumnus card opens him
 * — and they must not answer differently, which is the whole reason it is one
 * function and not two fallbacks written twice. Rows carry the name since ids
 * stopped being names; older rows do not, and for those the key they are filed
 * under is the name, because that is what an id was.
 *
 * Never empty. A career with no rows at all is a different question and belongs
 * to the caller, who is the only one who knows whether he is a departed player
 * or a bad id.
 */
export const careerName = (id: PlayerId, years: readonly CareerYear[]): string =>
  years.find((y) => y.name)?.name ?? String(id);

/**
 * Write one team's season into the record book.
 *
 * Two constraints, and the second is the one that was got wrong for a long
 * time. It has to run before `nextSeason` wipes the statistics, which is
 * obvious; and it has to run before `departAndDevelop`, which is not. That
 * function strips every graduating senior, every drafted junior and every
 * walk-on off the roster arrays this reads, so an archive taken at the year
 * roll silently skipped the entire departing class — a man's last season, which
 * is usually his best, and the only one a hall of fame really weighs.
 *
 * It also decides what class year the row is filed under. `departAndDevelop`
 * ages every survivor as it goes, so an archive taken afterwards recorded a
 * junior's year as SR. Running first records the class he actually played at.
 *
 * Players who never appeared are skipped: a line of zeroes is not a season.
 */
export function archiveSeason(season: SeasonState, teamIndex: number, year: number): void {
  const rec = season.teams[teamIndex];
  if (!rec) return;
  season.careers ??= {};

  const roster = [
    ...rec.team.lineup, ...rec.team.bench, ...rec.team.rotation, ...rec.team.bullpen,
  ];
  for (const p of roster) {
    const row = seasonRow(season, rec, p, year);
    if (!row) continue;

    const list = season.careers[p.id] ?? [];
    // A year is written once. Re-entering the offseason must not duplicate it.
    if (list.some((r) => r.year === year)) continue;
    season.careers[p.id] = [...list, row];
  }
}

/**
 * One man's line for one season, in the shape the record book keeps.
 *
 * Null for a man who never appeared: a line of zeroes is not a season.
 *
 * Shared by the two callers that must not disagree — the archive above, and
 * {@link liveCareerYear} below, which is the same row for a year that is still
 * being played. Written twice they would eventually round a different way, and
 * the whole point of showing the live row is that it becomes the archived one
 * unchanged.
 */
function seasonRow(
  season: SeasonState, rec: TeamRecord, p: Player, year: number,
): CareerYear | null {
  const bat = season.batting.get(p.id);
  const pit = season.pitching.get(p.id);
  const fld = season.fielding?.get(p.id);
  const played = (bat && bat.ab > 0) || (pit && pit.outs > 0);
  if (!played) return null;

  return {
    year, classYear: p.classYear, team: rec.def.abbr, name: p.name,
    ...(bat && bat.ab > 0
      ? {
        ab: bat.ab, h: bat.h, d: bat.d, t: bat.t,
        hr: bat.hr, rbi: bat.rbi, bb: bat.bb, sb: bat.sb,
      }
      : {}),
    ...(pit && pit.outs > 0
      ? { w: pit.w, l: pit.l, outs: pit.outs, er: pit.er, k: pit.k }
      : {}),
    // A man can have a fielding line and no bat — a reliever who came in for
    // one out and had a ball hit back at him — but the played test above is
    // what decides whether the year is a season at all, and it should stay
    // that way: nobody's career page wants a row for one comebacker.
    ...(fld && fld.chances > 0
      ? { chances: fld.chances, plays: fld.plays, errors: fld.errors }
      : {}),
  };
}

/**
 * The season in progress, as the row it is going to become.
 *
 * A career page reads the archive, and the archive is written in June — so from
 * the first pitch of February until the draft step nine months later, the year
 * the player is actually watching is not on the page. Reported as "after two
 * seasons only one year shows, and the numbers do not update": both halves of
 * that are this. The man's second spring is live in `season.batting`, his first
 * is in the book, and the card was only ever showing one of the two places.
 *
 * So the card asks for this and stacks it under the archived years, marked as
 * unfinished. Nothing is written down — the archive is still the only copy, and
 * it is still written once, in June, by `archiveSeason`. This is the same row
 * computed early so the page can be honest about the year in front of it.
 */
export function liveCareerYear(
  season: SeasonState, teamIndex: number, id: PlayerId,
): CareerYear | null {
  const rec = season.teams[teamIndex];
  if (!rec) return null;
  const p = [
    ...rec.team.lineup, ...rec.team.bench, ...rec.team.rotation, ...rec.team.bullpen,
  ].find((x) => x.id === id);
  if (!p) return null;
  return seasonRow(season, rec, p, season.year ?? 0);
}

export const regularRecord = (t: TeamRecord): { w: number; l: number } =>
  ({ w: t.rw ?? t.w, l: t.rl ?? t.l });

/**
 * The parts of a save a name can be hiding in. Loose enough to accept the stored
 * shape as well as a live season, and to accept a dynasty old enough to predate
 * any of the three.
 */
type NameSources = Partial<Pick<SeasonState, 'teams' | 'careers' | 'recruiting'>>;

/**
 * Every display name a save still knows about.
 *
 * Three places hold one. The ninety-six rosters, obviously. The record book,
 * which outlives the roster and is the only trace of a man who has graduated.
 * And the recruiting board, whose prospects are real generated players waiting
 * to sign — leave them out and the first walk-on of the offseason can be handed
 * the name of a recruit the coach is still chasing.
 *
 * A career row from before names were kept has none, and for those the key it is
 * filed under is the name: that is what the old ids were.
 */
function namesIn(save: NameSources): string[] {
  const names: string[] = [];
  for (const t of save.teams ?? []) {
    for (const p of [
      ...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen,
    ]) names.push(p.name);
  }
  for (const [id, years] of Object.entries(save.careers ?? {})) {
    names.push(years.find((y) => y.name)?.name ?? id);
  }
  for (const p of save.recruiting?.prospects ?? []) names.push(p.player.name);
  return names;
}

/**
 * Put the name pool back, from the save that is being opened.
 *
 * The pool lives in players.ts as module-level state and has never been written
 * into a save, so a cold reload started the world with every name in it
 * available again — and since an id used to *be* a name, the next man generated
 * could land on top of somebody's career. Ids no longer work that way, so this
 * is now the narrower job it always should have been: keeping the league from
 * fielding two Cole Rourkes.
 *
 * Rebuilt rather than added to. The pool afterwards is exactly a function of the
 * save, which is what stops a dynasty opened second in the same session from
 * inheriting the first one's names and drawing a different world because of it.
 *
 * It cannot be complete and does not pretend to be: a rival's shortstop who
 * graduated three years ago is in no roster and in no record book — the book is
 * the user's program only — so his name comes back into circulation. That is a
 * repeated name on some other team's bench, and nothing more, which is the whole
 * reason identity was moved off the name first.
 */
export function rebuildNameIndex(save: NameSources): void {
  resetNames();
  reserveNames(namesIn(save));
}

export interface ScheduledGame {
  home: number;
  away: number;
  conference: boolean;
  /** Rotation slot that starts. 0,1,2 across a weekend; 3 is the midweek arm. */
  slot: number;
}

export interface GameDay {
  /** Days since opening day. */
  day: number;
  week: number;
  kind: 'series' | 'midweek';
  label: string;
  games: ScheduledGame[];
}

export interface TeamRecord {
  id: TeamId;
  index: number;
  def: SchoolDef;
  /** Conference id, e.g. 'PAC'. */
  conference: string;
  /**
   * What this programme believes *now*, when that has moved.
   *
   * Absent means it still believes what it was written to believe, which is
   * most schools most of the time -- so this costs the save nothing until a
   * decade actually changes somebody. See `driftCulture`.
   */
  culture?: SchoolCulture;
  /**
   * How this coach plays. Every program gets one — an aggressive coach steals and
   * pulls starters early, a conservative one bunts and plays for a run. Without
   * it 96 programs are one program repeated.
   */
  strategy: Strategy;
  /**
   * What the school is, as opposed to what this year's roster is. Seeded from
   * quality and then moves with results — slowly, so a blue blood survives a bad
   * season and one good year does not remake a cellar program.
   */
  prestige: number;
  team: Team;
  w: number;
  l: number;
  /**
   * The regular season record, frozen the moment bracket play starts.
   *
   * `w`/`l` keep counting through the postseason, which is right for a record
   * book and wrong for a board review: judged on the running total, a deep
   * tournament run *raised* the coach's win target retroactively, so succeeding
   * moved the goalposts roughly as fast as it moved the coach. Undefined until a
   * postseason has been played; callers fall back to `w`/`l`.
   */
  rw?: number;
  rl?: number;
  /**
   * Last year's regular season record, carried across the year roll so an award
   * can recognise a turnaround. Absent in season one and in saves from before it
   * existed, in which case the turnaround category simply does not fire.
   */
  lastW?: number;
  lastL?: number;
  cw: number;
  cl: number;
  rs: number;
  ra: number;
  gp: number;
  /** Positive is a winning streak, negative a losing one. */
  streak: number;
  /** Team indices faced, once per game. Feeds strength of schedule. */
  opponents: number[];
  /**
   * The user coach's offense and defense skills, set only on the program he
   * runs. `playGame` forwards them into every game this team plays — managed or
   * simmed, the same tiny edge — and the store keeps them current when a skill
   * point is spent or the coach changes jobs. Absent everywhere else, so the
   * other ninety five programs play at their raw ratings.
   */
  coachMods?: { offense: number; defense: number };
  /**
   * The man in the chair, on every program except the one you are running.
   *
   * On the team record rather than in a parallel array because the coach belongs
   * to the job: `nextSeason` spreads a record forward and the codec writes one
   * whole, so a career survives a year roll and a reload without either of them
   * knowing this field exists. Absent on your chair, and absent on any world
   * that has not been through `seatCoaches` — which is most tests, and which is
   * why every reader treats a missing coach as the league-average staff the
   * ninety five had before B7.
   */
  coach?: RivalCoach;
  /**
   * The school's own book: one row per finished season, whoever was coaching it.
   *
   * On the team record for the same reason the coach is — `nextSeason` spreads a
   * record forward and the codec writes one whole, so a program's history rides
   * every save and every year roll for free. This is what lets a coach who takes
   * a new job in year eleven read what that school did during the ten years he
   * was somewhere else. The user's *personal* career lives in the store's
   * history and is a different fact: a coach's 2029 and his school's 2029 agree
   * only while he was in that chair. Absent on saves from before it existed;
   * rows only accumulate from the first June the save plays through.
   */
  annals?: SchoolSeason[];
}

/**
 * One finished season, as the school remembers it.
 *
 * Only what the simulation actually computes. Fields that would need inventing
 * (attendance, budgets) are deliberately absent; new real ones can be added
 * later because every reader treats the row as open.
 */
export interface SchoolSeason {
  year: number;
  /** Regular season, the record the conference race was run on. */
  w: number;
  l: number;
  cw: number;
  cl: number;
  /** Place in the final conference table, 1 based. 0 when never frozen. */
  confPlace: number;
  /** Final national ranking by RPI, 1 based. */
  rank: number;
  wonConference: boolean;
  madeTournament: boolean;
  /** How the year ended, same vocabulary the postseason uses. */
  finish: Finish;
  /** Who was in the chair. The user's name when it was the user. */
  coach?: string;
}

export interface BattingSeason extends HitLine { g: number }
export interface PitchingSeason extends PitchLine {
  g: number; gs: number; w: number; l: number; sv: number;
}
export interface FieldingSeason extends FieldLine { g: number }

/** One player's line in a single game. */
export interface BoxLine {
  id: PlayerId;
  name: string;
  slot: string;
  /** "2-4, HR, 3 RBI" for a hitter; "6.0 IP, 2 ER, 7 K" for an arm. */
  line: string;
}

/**
 * A finished game, in enough detail to read afterwards.
 *
 * Kept **only for the games the user's program played**. A full season is a
 * thousand games across the league and storing every line would put tens of
 * thousands of rows in a save to serve a screen nobody opens — you want to look
 * back at your own games, not at a Tuesday in the Mountain conference.
 */
export interface BoxScore {
  day: number;
  home: number;
  away: number;
  homeRuns: number;
  awayRuns: number;
  innings: number;
  homeBatting: BoxLine[];
  awayBatting: BoxLine[];
  homePitching: BoxLine[];
  awayPitching: BoxLine[];
  /**
   * The classic linescore: runs per inning, then hits and errors. The two lines
   * can legitimately differ in length — the home half of the ninth is not
   * played when the home team already leads. Optional because saves from before
   * these existed still have to open; the screen renders the strip only when
   * they are here.
   */
  awayLine?: number[];
  homeLine?: number[];
  awayHits?: number;
  homeHits?: number;
  awayErrors?: number;
  homeErrors?: number;
}

export interface GameSummary {
  day: number;
  home: number;
  away: number;
  homeRuns: number;
  awayRuns: number;
  conference: boolean;
  innings: number;
}

export interface SeasonState {
  config: SeasonConfig;
  rng: Rng;
  /**
   * The calendar year this season is being played in.
   *
   * The engine has never needed one — a day is an integer offset from opening
   * day and that is what lets a season replay from its seed — but a record
   * without a year is not a record, and the single-game marks are taken inside
   * `recordResult`, which is three call layers below anybody holding the number.
   * Threading it through every caller would have put a `year` parameter on the
   * whole postseason for the sake of one string in a book.
   *
   * The store is the source of truth and stamps it on the way in, exactly as it
   * stamps `captureBoxFor`; `nextSeason` carries it forward. Optional because a
   * headless harness has no calendar at all, and because a save written before
   * the book existed has none.
   */
  year?: number;
  teams: TeamRecord[];
  schedule: GameDay[];
  /** Next unplayed day in the schedule. */
  dayIndex: number;
  /**
   * Rotates the pairings each year. Without it every season is the same
   * schedule — you would open against the same opponent in perpetuity, and a
   * dynasty would never see a different corner of its own conference.
   */
  scheduleRotation: number;
  /**
   * The day each pitcher last threw. Relief work is handed out longest-rested
   * first, which is the only thing stopping one arm from carrying the whole
   * bullpen — before this, five of six relievers finished a season with zero
   * innings while the first threw ninety.
   */
  lastPitched: Map<PlayerId, number>;
  batting: Map<PlayerId, BattingSeason>;
  pitching: Map<PlayerId, PitchingSeason>;
  /**
   * June only, kept alongside the season totals rather than instead of them.
   *
   * NCAA season totals include tournament play and this game has always
   * followed that, so  and  keep counting through the
   * postseason. These two count the same games a second time, on their own, so
   * a screen can ask what a man did in June without subtracting one book from
   * another and hoping the rounding agrees.
   *
   * Optional in the type and only in the type: a save written before the split
   * existed has neither, and refusing to load a dynasty is the one thing a save
   * file must never do.
   */
  postBatting?: Map<PlayerId, BattingSeason>;
  postPitching?: Map<PlayerId, PitchingSeason>;
  /**
   * What each man did with a glove, alongside the other two books.
   *
   * Optional in the type and only in the type: a save written before defensive
   * statistics existed has no such map, and refusing to load a dynasty is the
   * one thing a save file must never do. Read it through `fieldingFor`, which
   * puts the map back when it finds it missing.
   */
  fielding?: Map<PlayerId, FieldingSeason>;
  results: GameSummary[];
  /**
   * Box scores for the user's games, by day. See BoxScore for why only his.
   *
   * `captureBoxFor` is the team to keep them for — set by the app once a job is
   * taken, because a season is built before anybody has chosen one.
   */
  boxScores: Record<number, BoxScore>;
  captureBoxFor: number | null;
  /**
   * What your players did, year by year, kept after the season is gone.
   *
   * The statistics live in maps that are wiped every June, so a junior's
   * freshman year did not exist anywhere by the time anybody could look at it —
   * and a dynasty game where you cannot see a player develop is asking you to
   * take the development on faith.
   *
   * Your program only. This is your record book, not the country's, and keeping
   * every line for all ninety six schools would put tens of thousands of rows
   * through a structured clone on every autosave for the sake of somebody
   * else's shortstop.
   */
  careers: Record<PlayerId, CareerYear[]>;
  /**
   * The men you have put in the hall, and the case that put them there.
   *
   * Beside `careers` rather than on the coach, for the same reason the archive
   * is: a hall of fame is about the men, it spans every program the coach has
   * run, and it has to outlive the roster that produced it. Written once, in the
   * June after a career ends, and never recomputed — see `engine/hall.ts` for
   * why a plaque is frozen and a leaderboard is not.
   *
   * Optional because a dynasty from before induction existed has none, and an
   * empty hall is the truthful state for it: nobody was ever inducted. Its men
   * are still in the archive and will be considered at the next year roll.
   */
  hall?: Inductee[];
  /**
   * Career totals for every man on a roster in the country. See `CareerTotals`.
   *
   * Optional and genuinely empty on a save that predates it, on the same terms as
   * `scorelessOuts`: nobody's career was being counted, so the honest answer is
   * that counting starts now. The career records such a dynasty goes on to set
   * will be short by whatever was played before the upgrade, which is a smaller
   * lie than inventing the missing seasons would be.
   */
  careerTotals?: Map<PlayerId, CareerTotals>;
  /**
   * The all-time book, league-wide and permanent. See engine/records.ts.
   *
   * On the season rather than in the store because the two things that write it
   * are `recordResult`, which is pure engine and sees every game any program
   * plays, and a scan of the season statistics. Carrying it here also means it
   * rides `toPortable` with everything else — the save assembles the record field
   * by field and a book kept beside it would have been dropped on the first
   * reload.
   *
   * Optional so a dynasty from before it existed still opens; `fromPortable`
   * gives that save the seeded book rather than an empty one, because a record
   * book with nothing in it looks like a bug and a book with Incaviglia in it
   * looks like a target.
   */
  records?: RecordBook;
  /**
   * How many outs each pitcher has gone without allowing a run, right now.
   *
   * The one piece of state the book adds beyond its holders, and it is here
   * because a streak cannot be reconstructed from season totals: a man with a
   * 3.10 ERA might have thrown twenty eight straight scoreless in the middle of
   * it, and nothing in `pitching` remembers that. One number per arm, reset the
   * moment he is scored on, offered to the book as it grows.
   *
   * The streak is measured in whole appearances, which understates it slightly:
   * a start where he is scored on in the seventh ends the streak at zero rather
   * than crediting the six scoreless innings in front of the run, because the
   * game line records outs and runs and not the order they came in.
   *
   * There is deliberately no equivalent for a hitting streak. The mark is
   * Ventura's 58 and forty five games cannot hold it, so no candidate this
   * engine can produce would ever be offered — tracking one would be a map of
   * fifteen hundred numbers maintained to answer a question with a fixed answer.
   */
  scorelessOuts?: Map<PlayerId, number>;
  /**
   * The two achievements only a finished game can see, for your program alone.
   *
   * Exactly the same argument as `scorelessOuts` above: a comeback is a fact
   * about the scoreboard in the sixth inning and a winning streak is only ever
   * correct at the instant a game ends, so neither survives to a season-end
   * scan — by then the box score of a Tuesday has been thrown away and the
   * streak reads whatever the team happened to finish on. Two integers, updated
   * as each of your games is folded in, read once when the board sits down.
   *
   * Your program only, because achievements are the user coach's and nobody
   * else's. See `engine/achievements.ts` for why the other ninety five do not
   * get a cabinet.
   */
  feats?: SeasonFeats;
  /**
   * How much of each of your own men you have actually watched.
   *
   * A tendency on your own player is not visible on the day he signs — it is
   * learned by watching him play, and this is the record of that watching. Three
   * counters per man, accrued out of the box score of every game your program
   * plays, simulated or managed. `engine/tendencies.ts` owns what the numbers
   * mean and how much of each is enough.
   *
   * **Your program only**, because the rule for the other ninety five is the
   * opposite: a tendency on an opponent is visible immediately, on the grounds
   * that a scouting report saying their leadoff man runs is exactly what a
   * defensive setting is for. So there is nothing to accumulate about them.
   *
   * Carried forward across the season roll, unlike every other counter here,
   * because a thing you spent a year learning about a sophomore is still true
   * when he is a junior. Optional so a save written before it loads unchanged —
   * such a save simply starts learning about its roster from that day.
   */
  watch?: Map<PlayerId, Watch>;
  /**
   * The recruiting class in front of the program right now.
   *
   * Carried on the season rather than the offseason because that is when
   * recruiting happens — a coach works a board all year, he is not handed a list
   * in June. Effort spent during the season is what signing day resolves.
   */
  recruiting: RecruitClass;
  /**
   * Your own men taken in this June's draft, and what is being offered to keep
   * them.
   *
   * Beside the recruiting class rather than in the store for exactly the reason
   * the class is: it holds live players who are on nobody's roster while the
   * decision is open, and it has to survive a reload the way a half-worked
   * board does. Put in the store it would be lost the moment a phone put the
   * app to sleep, and the men on it would be lost with it.
   *
   * Optional and not carried forward. A new season builds a new one, because by
   * then every man on the old one has either signed with a professional club or
   * been talked back onto the roster.
   */
  draft?: DraftBoard;
  /**
   * Every conference's final regular season table, one after another, recorded
   * the moment the schedule runs out.
   *
   * This has to be a snapshot rather than something recomputed on demand.
   * `standings()` breaks ties partly on run differential, and postseason games
   * move it — so asking for the table again after the tournament would quietly
   * return a different regular season than the one that was actually played,
   * and seeding would disagree with itself.
   *
   * Conference by conference rather than as one national table, because that is
   * the only way it is ever read and a tie broken against the rest of the
   * country can order two league-mates differently from their own table.
   */
  finalOrder: number[] | null;
  /**
   * What day it is once the schedule has run out, on the schedule's own
   * calendar. Null until the first bracket game is played.
   *
   * June needs a date for the same reason May does. Without one the postseason
   * fell back on `dayIndex`, which is an array position and not a date at all —
   * forty five, while the last regular season game was played on day seventy
   * eight. Everything that asks how long ago a pitcher threw got the answer
   * backwards: an arm that had just worked the bracket looked *fresher* than one
   * that had been resting since May, so the same reliever came out of the pen in
   * every game of every round. Box scores collided on the one key too.
   */
  postseasonDay?: number | null;
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/**
 * Circle method. Team 0 is fixed and everyone else rotates around it, which
 * produces a different full pairing of the league on every round.
 */
export function roundPairs(round: number, teamCount: number): Array<[number, number]> {
  if (teamCount % 2 !== 0) throw new Error('roundPairs needs an even team count');
  const rest: number[] = [];
  for (let i = 1; i < teamCount; i++) rest.push(i);
  const k = ((round % rest.length) + rest.length) % rest.length;
  const rotated = [...rest.slice(k), ...rest.slice(0, k)];
  const list = [0, ...rotated];
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < teamCount / 2; i++) {
    pairs.push([list[i] as number, list[teamCount - 1 - i] as number]);
  }
  return pairs;
}

/**
 * A week is seven days. The weekend series runs Friday through Sunday (days 4,
 * 5, 6); midweek games land on Wednesday (day 2) of the weeks that have one.
 * Home and away swap on alternate rounds so the season stays even.
 */
interface Fixture {
  day: number;
  week: number;
  kind: 'series' | 'midweek';
  a: number;
  b: number;
}

/**
 * Who hosts.
 *
 * There is no neat formula for this. The circle method pins team 0 and rotates
 * everyone else around it, so any rule keyed on the round or on a team's
 * position in the pairing list correlates with the rotation and produces wildly
 * lopsided home schedules — alternating on round and position gave one team 31
 * home games and another 1.
 *
 * So assign explicitly: walk the fixtures in date order and give home field to
 * whichever team has hosted less so far, a whole series at a time since a
 * weekend series is played at one venue. Deterministic, and it lands every team
 * within a game of an even split. Now that home field advantage is real, an
 * uneven home schedule would quietly distort the standings.
 */
type Placed = Fixture & { home: number; away: number };

const fixtureWeight = (f: Fixture): number => (f.kind === 'series' ? 3 : 1);

function assignHosts(fixtures: readonly Fixture[], teamCount: number): Placed[] {
  const hosted = new Array<number>(teamCount).fill(0);

  // First pass, greedy in date order: whoever has hosted less takes the venue.
  const placed: Placed[] = fixtures.map((f) => {
    const w = fixtureWeight(f);
    const [home, away] = (hosted[f.b] ?? 0) < (hosted[f.a] ?? 0) ? [f.b, f.a] : [f.a, f.b];
    hosted[home] = (hosted[home] ?? 0) + w;
    return { ...f, home, away };
  });

  // Greedy alone gets stuck: by late season the teams that could fix an
  // imbalance are not the ones still playing each other, and one team ends up
  // four games light on home dates. So repair it — walk the fixtures and flip
  // any venue where flipping moves both teams closer to an even split. Squared
  // deviation, so a big imbalance outweighs several small ones. Deterministic,
  // and it converges in a handful of sweeps.
  const totalGames = hosted.reduce((a, b) => a + b, 0);
  const target = totalGames / teamCount;
  const cost = (n: number): number => (n - target) ** 2;

  for (let sweep = 0; sweep < 50; sweep++) {
    let improved = false;
    for (const f of placed) {
      const w = fixtureWeight(f);
      const h = hosted[f.home] ?? 0;
      const a = hosted[f.away] ?? 0;
      if (cost(h - w) + cost(a + w) < cost(h) + cost(a)) {
        hosted[f.home] = h - w;
        hosted[f.away] = a + w;
        const swap = f.home;
        f.home = f.away;
        f.away = swap;
        improved = true;
      }
    }
    if (!improved) break;
  }

  return placed;
}

/** Which team indices belong to each conference, in world order. */
export interface WorldShape {
  conferences: Array<{ id: string; teams: number[] }>;
}

export function worldFromConferences(defs: readonly ConferenceDef[]): WorldShape {
  let next = 0;
  return {
    conferences: defs.map((c) => ({
      id: c.id,
      teams: c.schools.map(() => next++),
    })),
  };
}

/**
 * The same shape, read off a season that already exists.
 *
 * A save does not carry its schedule — the schedule is a pure function of the
 * config, the world and the rotation, so it is cheaper to rebuild than to store.
 * But rebuilding it needs a world, and taking that world from `CONFERENCES` took
 * it from *today's* data file rather than from the career being opened. A team
 * is an index in the schedule, and reordering `schools.ts`, moving a program
 * between conferences or adding one silently repointed every one of those
 * indices: the same dynasty came back with its team in somebody else's league,
 * playing a schedule that belonged to a world it had never been part of.
 *
 * Nothing has to be written down to fix that, because it already is. Every
 * `TeamRecord` carries its own `index` and its own `conference`, and
 * `createSeason` walks the conferences in order, so grouping the saved teams by
 * conference in order of first appearance reproduces exactly the shape the
 * season was built from — including a world that was never the default one, such
 * as the two-conference worlds the tests build.
 */
export function worldFromTeams(
  teams: readonly Pick<TeamRecord, 'index' | 'conference'>[],
): WorldShape {
  const conferences: WorldShape['conferences'] = [];
  const byId = new Map<string, { id: string; teams: number[] }>();
  for (const t of teams) {
    let conf = byId.get(t.conference);
    if (!conf) {
      conf = { id: t.conference, teams: [] };
      byId.set(t.conference, conf);
      conferences.push(conf);
    }
    conf.teams.push(t.index);
  }
  return { conferences };
}

/**
 * A week is seven days: a non-conference game on Tuesday, a conference series
 * Friday through Sunday.
 *
 * Conference series come from a circle-method round robin inside each
 * conference. Non-conference games use the same method one level up — the
 * conferences themselves are paired against each other, and within a paired
 * couple the nth team of one plays a rotating team of the other. That keeps
 * every school playing on every date and stops anyone drawing the same
 * non-conference opponent twice.
 */
export function buildSchedule(
  config: SeasonConfig,
  world: WorldShape,
  rotation = 0,
): GameDay[] {
  const seriesLabels = ['Series opener', 'Game two', 'Series finale'];
  const confCount = world.conferences.length;
  const fixtures: Fixture[] = [];

  const weeks = Math.max(config.seriesRounds, config.nonConferenceGames);
  for (let week = 0; week < weeks; week++) {
    const base = week * 7;

    if (week < config.nonConferenceGames) {
      if (confCount % 2 !== 0) throw new Error('non-conference play needs an even number of conferences');
      for (const [ca, cb] of roundPairs(week, confCount)) {
        const a = world.conferences[ca];
        const b = world.conferences[cb];
        if (!a || !b) continue;
        const size = Math.min(a.teams.length, b.teams.length);
        for (let i = 0; i < size; i++) {
          fixtures.push({
            day: base + 1,
            week: week + 1,
            kind: 'midweek',
            a: a.teams[i] as number,
            b: b.teams[(i + week + rotation) % size] as number,  // rotate so nobody repeats
          });
        }
      }
    }

    if (week < config.seriesRounds) {
      for (const conf of world.conferences) {
        for (const [x, y] of roundPairs(week + rotation, conf.teams.length)) {
          fixtures.push({
            day: base + 4,
            week: week + 1,
            kind: 'series',
            a: conf.teams[x] as number,
            b: conf.teams[y] as number,
          });
        }
      }
    }
  }

  fixtures.sort((x, y) => x.day - y.day);

  const teamCount = world.conferences.reduce((n, c) => n + c.teams.length, 0);
  const placed = assignHosts(fixtures, teamCount);

  const byDay = new Map<number, GameDay>();
  const dayFor = (day: number, week: number, kind: GameDay['kind'], label: string): GameDay => {
    let d = byDay.get(day);
    if (!d) { d = { day, week, kind, label, games: [] }; byDay.set(day, d); }
    return d;
  };

  for (const f of placed) {
    if (f.kind === 'midweek') {
      dayFor(f.day, f.week, 'midweek', 'Midweek').games.push({
        home: f.home, away: f.away, conference: false, slot: 3,
      });
      continue;
    }
    for (let g = 0; g < 3; g++) {
      dayFor(f.day + g, f.week, 'series', seriesLabels[g] as string).games.push({
        home: f.home, away: f.away, conference: true, slot: g,
      });
    }
  }

  return [...byDay.values()].sort((x, y) => x.day - y.day);
}

// ---------------------------------------------------------------------------
// Building and running a season
// ---------------------------------------------------------------------------

export function createSeason(
  rng: Rng,
  config: SeasonConfig = DEFAULT_SEASON,
  conferences: readonly ConferenceDef[] = CONFERENCES,
): SeasonState {
  // Fresh world, fresh name pool. See the note in calibration.ts: leaving this
  // out makes a second season in the same process generate different players.
  resetNames();

  const teams: TeamRecord[] = [];
  for (const conf of conferences) {
    for (const def of conf.schools) {
      teams.push({
        id: teamId(def.abbr),
        index: teams.length,
        def,
        conference: conf.id,
        strategy: strategyFor(teams.length),
        prestige: initialPrestige(def.prestige),
        team: makeTeam(rng, `${def.school} ${def.nickname}`, def.quality),
        w: 0, l: 0, cw: 0, cl: 0, rs: 0, ra: 0, gp: 0, streak: 0,
        opponents: [],
      });
    }
  }

  return {
    config,
    rng,
    teams,
    schedule: buildSchedule(config, worldFromConferences(conferences), 0),
    dayIndex: 0,
    scheduleRotation: 0,
    lastPitched: new Map(),
    batting: new Map(),
    pitching: new Map(),
    postBatting: new Map(),
    postPitching: new Map(),
    fielding: new Map(),
    results: [],
    boxScores: {},
    captureBoxFor: null,
    careers: {},
    careerTotals: new Map(),
    // A brand new dynasty opens with the real marks already standing, so the
    // book has something in it on day one.
    records: seededBook(),
    scorelessOuts: new Map(),
    feats: noFeats(),
    recruiting: generateClass(0, teams.length, rng),
    finalOrder: null,
    postseasonDay: null,
  };
}

/**
 * Next year, same programs.
 *
 * Carries the rosters forward — whatever `advanceOffseason` left behind — and
 * resets everything that belongs to the season just finished: records, streaks,
 * statistics, schedule. Deliberately does not touch the name pool, because the
 * world is continuous now and a returning junior must keep his name.
 */
export function nextSeason(prev: SeasonState, config: SeasonConfig = prev.config): SeasonState {
  // Coerced rather than trusted: a non-finite rotation silently degrades the
  // schedule into the same pairing every round instead of throwing.
  const rotation = (Number.isFinite(prev.scheduleRotation) ? prev.scheduleRotation : 0) + 1;
  const teams: TeamRecord[] = prev.teams.map((t) => ({
    ...t,
    w: 0, l: 0, cw: 0, cl: 0, rs: 0, ra: 0, gp: 0, streak: 0,
    // Last June's frozen regular season record goes with last June. It is
    // spread in from the previous team otherwise, and `regularRecord` prefers
    // it over the live one — so a brand new season opened showing last year's
    // 22-11 above a schedule of games nobody had played yet.
    rw: undefined, rl: undefined,
    // But it does not vanish entirely: it becomes last year's record, which is
    // what lets Coach of the Year recognise a turnaround.
    lastW: t.rw ?? t.w, lastL: t.rl ?? t.l,
    opponents: [],
  }));

  const world: WorldShape = { conferences: [] };
  for (const t of teams) {
    let conf = world.conferences.find((c) => c.id === t.conference);
    if (!conf) { conf = { id: t.conference, teams: [] }; world.conferences.push(conf); }
    conf.teams.push(t.index);
  }

  return {
    config,
    rng: prev.rng,
    // A year passes. The store keeps its own count and restamps this on load,
    // so the two cannot drift far; incrementing here is what keeps a season
    // rolled inside the worker from dating its records to last year.
    ...(prev.year === undefined ? {} : { year: prev.year + 1 }),
    teams,
    schedule: buildSchedule(config, world, rotation),
    dayIndex: 0,
    scheduleRotation: rotation,
    lastPitched: new Map(),
    batting: new Map(),
    pitching: new Map(),
    postBatting: new Map(),
    postPitching: new Map(),
    fielding: new Map(),
    // The book is the one thing here that is not about a season. It carries
    // forward for as long as the dynasty does, seeded if this save predates it.
    records: prev.records ?? seededBook(),
    // Neither is what you know about your own men. Four years of watching a
    // player is what a tendency is discovered out of, and resetting it every
    // June would mean nobody was ever known for anything.
    ...(prev.watch ? { watch: prev.watch } : {}),
    // The streak does not: it is a single-season record, and a scoreless run
    // does not survive an offseason and a new roster.
    scorelessOuts: new Map(),
    // Nor do the feats. They were read by the board in June and hanging one up
    // is permanent, so what carries forward is the cabinet on the coach, not the
    // evidence that filled it.
    feats: noFeats(),
    results: [],
    // Last year's box scores belong to last year. The career lines do not —
    // they are the only copy, and they carry forward for as long as the dynasty
    // does.
    boxScores: {},
    careers: prev.careers ?? {},
    // And nor does the hall, or the running career totals under the book. Both
    // are permanent records of things that already happened, and both are the
    // only copy of what they hold.
    ...(prev.hall ? { hall: prev.hall } : {}),
    careerTotals: prev.careerTotals ?? new Map(),
    captureBoxFor: prev.captureBoxFor,
    // A new class every year. Last year's board is spent, and so is last
    // June's draft: `draft` is deliberately not carried, because a man still
    // sitting on it undecided has by now either gone to professional baseball
    // or been talked back onto the roster above.
    recruiting: generateClass(prev.recruiting.year + 1, teams.length, prev.rng),
    finalOrder: null,
    // June belongs to the year it was played in. A new season opens on its own
    // schedule, and the clock picks up again from the last day of it.
    postseasonDay: null,
  };
}

function battingFor(season: SeasonState, id: PlayerId): BattingSeason {
  let line = season.batting.get(id);
  if (!line) {
    line = { g: 0, ab: 0, r: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, bb: 0, k: 0, hbp: 0, sb: 0, cs: 0 };
    season.batting.set(id, line);
  }
  return line;
}

/**
 * The same two books again, June only.
 *
 * Lazy for the reason  is: a save written before the split
 * existed arrives with the maps simply absent, and putting one back when it is
 * missing is cheaper than a migration and impossible to get wrong.
 */
function postBattingFor(season: SeasonState, id: PlayerId): BattingSeason {
  if (!season.postBatting) season.postBatting = new Map();
  let line = season.postBatting.get(id);
  if (!line) {
    line = { g: 0, ab: 0, r: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, bb: 0, k: 0, hbp: 0, sb: 0, cs: 0 };
    season.postBatting.set(id, line);
  }
  return line;
}

function postPitchingFor(season: SeasonState, id: PlayerId): PitchingSeason {
  if (!season.postPitching) season.postPitching = new Map();
  let line = season.postPitching.get(id);
  if (!line) {
    line = { g: 0, gs: 0, w: 0, l: 0, sv: 0, outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, pitches: 0, bf: 0 };
    season.postPitching.set(id, line);
  }
  return line;
}

function pitchingFor(season: SeasonState, id: PlayerId): PitchingSeason {
  let line = season.pitching.get(id);
  if (!line) {
    line = { g: 0, gs: 0, w: 0, l: 0, sv: 0, outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, pitches: 0, bf: 0 };
    season.pitching.set(id, line);
  }
  return line;
}

/**
 * The fielding book, created on demand — for the player, and for the map.
 *
 * The map itself is lazy on purpose. Batting and pitching have been on every
 * save ever written; fielding has not, and a dynasty carried forward from before
 * it existed arrives here with the property simply absent. Putting it back on
 * first use is a two-word backfill that costs nothing and means an old save
 * opens into a season that keeps score properly from its next pitch, rather than
 * throwing on a `.get` of undefined.
 */
export function fieldingFor(season: SeasonState, id: PlayerId): FieldingSeason {
  const map = (season.fielding ??= new Map());
  let line = map.get(id);
  if (!line) {
    line = { g: 0, chances: 0, plays: 0, expected: 0, errors: 0, throwing: 0, pb: 0, sba: 0, cs: 0 };
    map.set(id, line);
  }
  return line;
}

/**
 * Fold one game's box score into the season totals.
 *
 * The decision rules are approximations, not the scorer's rulebook: the starter
 * takes the win or the loss, and a save goes to a reliever who finished a win of
 * three runs or fewer. Real scoring hangs the win on whoever was pitching when
 * the lead changed for good, which needs a leverage trail the engine does not
 * keep yet.
 */
interface Decision {
  winner: Pitcher | null;
  loser: Pitcher | null;
}

function foldSide(
  season: SeasonState,
  side: TeamState,
  won: boolean,
  margin: number,
  decision: Decision,
  june = false,
): void {
  for (const line of side.batting.values()) {
    const s = battingFor(season, line.player.id);
    s.g += 1;
    s.ab += line.ab; s.r += line.r; s.h += line.h; s.d += line.d; s.t += line.t;
    s.hr += line.hr; s.rbi += line.rbi; s.bb += line.bb; s.k += line.k;
    s.hbp += line.hbp; s.sb += line.sb; s.cs += line.cs;
    // The same game a second time, in its own book. Season totals include
    // tournament play — that is the NCAA convention and this game has always
    // followed it — so June is counted twice on purpose rather than moved.
    if (june) {
      const j = postBattingFor(season, line.player.id);
      j.g += 1;
      j.ab += line.ab; j.r += line.r; j.h += line.h; j.d += line.d; j.t += line.t;
      j.hr += line.hr; j.rbi += line.rbi; j.bb += line.bb; j.k += line.k;
      j.hbp += line.hbp; j.sb += line.sb; j.cs += line.cs;
    }
  }

  for (const line of side.pitching.values()) {
    const s = pitchingFor(season, line.player.id);
    s.g += 1;
    s.outs += line.outs; s.h += line.h; s.r += line.r; s.er += line.er;
    s.bb += line.bb; s.k += line.k; s.hr += line.hr;
    s.pitches += line.pitches; s.bf += line.bf;
    if (line.player === side.starter) s.gs += 1;
    if (june) {
      const j = postPitchingFor(season, line.player.id);
      j.g += 1;
      j.outs += line.outs; j.h += line.h; j.r += line.r; j.er += line.er;
      j.bb += line.bb; j.k += line.k; j.hr += line.hr;
      j.pitches += line.pitches; j.bf += line.bf;
      if (line.player === side.starter) j.gs += 1;
    }
  }

  // Pitchers appear in here as well as above: a comebacker is his play to make
  // and his error to commit, so the fielding book is keyed on everybody who
  // touched a ball rather than on the batting order.
  for (const line of side.fielding.values()) {
    const s = fieldingFor(season, line.player.id);
    s.g += 1;
    s.chances += line.chances; s.plays += line.plays; s.expected += line.expected;
    s.errors += line.errors; s.throwing += line.throwing;
    s.pb += line.pb; s.sba += line.sba; s.cs += line.cs;
  }

  // The decision goes to the pitcher of record, not the starter. Falls back to
  // the starter only if the game somehow produced no lead change — a shutout
  // where the winner scored first and never trailed still records one, so this
  // is defensive rather than routine.
  const credited = won
    ? decision.winner ?? side.starter
    : decision.loser ?? side.starter;
  const line = pitchingFor(season, credited.id);
  if (won) line.w += 1; else line.l += 1;
  if (june) {
    const j = postPitchingFor(season, credited.id);
    if (won) j.w += 1; else j.l += 1;
  }

  // A save needs a reliever who finished a close win he did not win himself.
  if (won && side.pitcher !== side.starter && side.pitcher !== credited && margin <= 3) {
    pitchingFor(season, side.pitcher.id).sv += 1;
    if (june) postPitchingFor(season, side.pitcher.id).sv += 1;
  }
}

export interface PlayOptions {
  /** Record the text log and PlayEvent stream for this game. */
  capture?: boolean;
  onCapture?: (result: GameResult) => void;
  /** Counts toward the conference race. Postseason games do not. */
  conference?: boolean;
  /** Rotation slot for both sides. */
  slot?: number;
  /**
   * Rotation slot for one side only, where the two teams are not at the same
   * point in their week. A weekend series runs both rotations in step and wants
   * `slot`; a bracket does not, because a team that has played three games in
   * this tournament and a team that has played none are not both on their
   * Friday arm.
   */
  homeSlot?: number;
  awaySlot?: number;
  day?: number;
  /** Whether the result moves records and streaks. Statistics always accumulate. */
  standings?: boolean;
  /** Appended to season.results. Off for exhibition or replay use. */
  record?: boolean;
  /**
   * A bracket game. Only the BIG STAGE badge reads it, and only through
   * `SimOptions.postseason`; nothing about how the game is recorded changes.
   */
  postseason?: boolean;
}

/**
 * The date the postseason opens: a few days after the last regular season game,
 * which is roughly the gap the real calendar leaves for it.
 */
export function firstPostseasonDay(season: SeasonState): number {
  const last = season.schedule[season.schedule.length - 1]?.day;
  return (last ?? season.dayIndex) + 3;
}

/**
 * Today, on the schedule's own calendar.
 *
 * Read the fixture while there is one, and the postseason clock after that. One
 * answer for the whole engine, so rest, box scores and result dates cannot
 * disagree about what day a game was played on.
 */
export function currentDay(season: SeasonState): number {
  return season.schedule[season.dayIndex]?.day
    ?? season.postseasonDay
    ?? firstPostseasonDay(season);
}

/**
 * One more night of the postseason.
 *
 * A bracket round is a night, so arms recover between rounds and a bullpen
 * emptied in game one is not the first thing a manager reaches for in game two.
 * Ignored while the schedule still has days left in it: the regular season gets
 * its dates from the fixture list, not from here.
 */
export function advancePostseasonDay(season: SeasonState): void {
  if (!seasonComplete(season)) return;
  season.postseasonDay = currentDay(season) + 1;
}

/**
 * Relief order for one game: longest rested first, ties broken by quality so a
 * manager reaches for his best available arm rather than an arbitrary one.
 *
 * Deliberately simple. A real bullpen is organised by leverage and role, which
 * needs the closer concept and a save situation to hand — worth doing, and not
 * a reason to leave five pitchers idle in the meantime.
 */
export function restedFirst(season: SeasonState, team: TeamRecord): Pitcher[] {
  const day = currentDay(season);
  return [...team.team.bullpen].sort((a, b) => {
    const restA = day - (season.lastPitched.get(a.id) ?? -99);
    const restB = day - (season.lastPitched.get(b.id) ?? -99);
    if (restA !== restB) return restB - restA;
    return overallOf(b) - overallOf(a);
  });
}

/**
 * A day off.
 *
 * Pinch hitting alone leaves a bench bat with a handful of plate appearances
 * across a whole season — technically present, practically invisible. Real
 * programs rest regulars: a backup catcher starts eight or ten games, a fourth
 * outfielder spells the corners. That is where a reserve's numbers come from.
 *
 * One regular sits on roughly a third of days. Over 33 games that is about
 * eleven starts spread across four reserves, which is what a bench looks like.
 * The replacement takes the spot of whoever plays his position, so the lineup
 * stays coherent rather than putting a catcher in centre field.
 */
function restedLineup(team: Team, rng: Rng): readonly Hitter[] | undefined {
  if (team.bench.length === 0) return undefined;

  // A regular sits on most days, two on some. Weekend series are three games in
  // three days and college rosters are not deep enough to run nine men through
  // all of it — the back end of a series is where reserves play.
  const resting = rng() < 0.55 ? (rng() < 0.30 ? 2 : 1) : 0;
  if (resting === 0) return undefined;

  const lineup = [...team.lineup];
  const used = new Set<number>();

  for (let i = 0; i < resting; i++) {
    const pool = team.bench.filter((h) => !lineup.includes(h));
    const sub = pool[Math.floor(rng() * pool.length)];
    if (!sub) break;

    // Replace whoever plays his position, so the lineup stays coherent rather
    // than putting a catcher in centre field.
    const same = lineup.findIndex((h, idx) => h.pos === sub.pos && !used.has(idx));
    let spot = same;
    if (spot < 0) {
      do { spot = Math.floor(rng() * lineup.length); } while (used.has(spot));
    }
    used.add(spot);
    lineup[spot] = sub;
  }

  return lineup;
}

/**
 * Play one game and fold it into the season. Shared by the regular season and
 * the postseason so both accumulate statistics the same way — NCAA season
 * totals include tournament play, and two code paths would drift.
 */
export function playGame(
  season: SeasonState,
  homeIndex: number,
  awayIndex: number,
  opts: PlayOptions = {},
): GameSummary {
  const home = season.teams[homeIndex];
  const away = season.teams[awayIndex];
  if (!home || !away) throw new Error('unknown team index');

  const conference = opts.conference ?? true;
  const slot = opts.slot ?? 0;

  /*
    The card, and then who is actually available to be on it.

    `coverFor` hands back the very same array when every man in it can play,
    which is every game in the country except the ones where the program being
    coached has somebody in the classroom or sitting out the year -- so this
    line costs one pass over nine men and changes nothing else. Ordering
    matters: `restedLineup` takes the random draws, and covering afterwards
    keeps that stream untouched.
  */
  const homeRested = restedLineup(home.team, season.rng);
  const awayRested = restedLineup(away.team, season.rng);
  const homeLineup = coverFor(home.team, homeRested ?? home.team.lineup, season.dayIndex);
  const awayLineup = coverFor(away.team, awayRested ?? away.team.lineup, season.dayIndex);

  const result = simGame(home.team, away.team, season.rng, {
    engine: season.config.engine,
    homeStarter: opts.homeSlot ?? slot,
    awayStarter: opts.awaySlot ?? slot,
    ...(homeLineup ? { homeLineup } : {}),
    ...(awayLineup ? { awayLineup } : {}),
    homeStrategy: home.strategy,
    awayStrategy: away.strategy,
    homeBullpen: restedFirst(season, home),
    awayBullpen: restedFirst(season, away),
    // The coach-skill nudge, present only on the user's program. Passing it
    // here rather than in the store means simmed and managed games get it the
    // same way — one wiring, not two.
    ...(home.coachMods ? { homeCoachMods: home.coachMods } : {}),
    ...(away.coachMods ? { awayCoachMods: away.coachMods } : {}),
    ...(opts.postseason ? { postseason: true } : {}),
    verbose: opts.capture ?? false,
    playEvents: opts.capture ?? false,
  });
  if (opts.capture) opts.onCapture?.(result);

  return recordResult(season, homeIndex, awayIndex, result, opts);
}

/**
 * Fold a finished game into the season: records, standings, statistics, and the
 * pitcher of record. Called for simulated games and for games the manager played
 * himself, so a hand-managed win counts exactly like any other.
 */
/** A hitter's day, the way a newspaper would set it. */
function battingLines(side: GameResult['home']): BoxLine[] {
  const out: BoxLine[] = [];
  // Who actually started, so a substitute can be labelled as one. `pos` is the
  // man's roster position, and printing it for a pinch hitter produced two DH
  // rows in one box while saying nothing about how he got into the game.
  const started = new Set(side.starters.map((p) => p.id));
  for (const l of side.batting.values()) {
    // Anybody with a batting entry appeared at the plate — including a man
    // whose only trip was a sacrifice, which takes no time at bat. The old
    // filter on ab/bb/hbp dropped him from the box with his RBI.
    const extras: string[] = [];
    if (l.d) extras.push(`${l.d} 2B`);
    if (l.t) extras.push(`${l.t} 3B`);
    if (l.hr) extras.push(`${l.hr} HR`);
    if (l.rbi) extras.push(`${l.rbi} RBI`);
    if (l.bb) extras.push(`${l.bb} BB`);
    if (l.k) extras.push(`${l.k} K`);
    if (l.sb) extras.push(`${l.sb} SB`);
    out.push({
      id: l.player.id, name: l.player.name,
      slot: started.has(l.player.id) ? l.player.pos : 'PH',
      line: `${l.h}-${l.ab}${extras.length ? ', ' + extras.join(', ') : ''}`,
    });
  }
  // A starter lifted before he ever batted still played the field and belongs
  // in the book — he used to vanish from his own game entirely.
  for (const p of side.starters) {
    if (!side.batting.has(p.name)) {
      out.push({ id: p.id, name: p.name, slot: p.pos, line: '0-0' });
    }
  }
  return out;
}

/** And an arm's. */
function pitchingLines(side: GameResult['home']): BoxLine[] {
  const out: BoxLine[] = [];
  for (const l of side.pitching.values()) {
    if (l.outs === 0 && l.bf === 0) continue;
    const ip = `${Math.floor(l.outs / 3)}.${l.outs % 3}`;
    out.push({
      id: l.player.id, name: l.player.name, slot: l.player.role,
      line: `${ip} IP, ${l.h} H, ${l.r} R, ${l.er} ER, ${l.bb} BB, ${l.k} K`,
    });
  }
  return out;
}

/**
 * A day's worth of watching one of your own men, folded into what you know.
 *
 * This is the whole of tendency discovery, and it is deliberately not a flag
 * that gets set the first time somebody appears. What accrues is *evidence*, in
 * the unit the tendency is read in — plate appearances or batters faced, times
 * on base, balls in play — and a reading only becomes something a coach will say
 * out loud once there is enough of it. So a green light is obvious inside a
 * month and whether a man is clutch is a question you are still asking in his
 * second year, which is the right order and is also what the research says.
 *
 * It runs here rather than anywhere prettier for the reason the record book runs
 * here: **every finished game comes through this door**, whether it was
 * simulated by the hundred or managed pitch by pitch. Discovery therefore
 * happens through ordinary play without anybody having to opt into it.
 */
function noteWatch(season: SeasonState, side: TeamState): void {
  const book = (season.watch ??= new Map());
  const of = (id: PlayerId): Watch => {
    let w = book.get(id);
    if (!w) { w = blankWatch(); book.set(id, w); }
    return w;
  };
  for (const l of side.batting.values()) {
    const pa = l.ab + l.bb + l.hbp;
    if (pa === 0) continue;
    const w = of(l.player.id);
    w.pa += pa;
    w.on += l.h + l.bb + l.hbp;
    // A strikeout is not a ball in play, and neither is a ball over the fence —
    // a spray chart is made of the ones a fielder had to go and get.
    w.bip += Math.max(0, l.ab - l.k - l.hr);
  }
  for (const l of side.pitching.values()) {
    if (l.bf === 0) continue;
    of(l.player.id).pa += l.bf;
  }
}

export function recordResult(
  season: SeasonState,
  homeIndex: number,
  awayIndex: number,
  result: GameResult,
  opts: PlayOptions = {},
): GameSummary {
  const home = season.teams[homeIndex];
  const away = season.teams[awayIndex];
  if (!home || !away) throw new Error('unknown team index');
  const conference = opts.conference ?? true;
  const today = opts.day ?? currentDay(season);

  // Whoever threw is unavailable for a while. Recorded here rather than in
  // `playGame` so a game the manager played himself carries the same cost as a
  // simulated one — it arrives through this door and no other.
  for (const side of [result.home, result.away]) {
    for (const line of side.pitching.values()) {
      if (line.outs > 0 || line.bf > 0) season.lastPitched.set(line.player.id, today);
    }
  }

  const hr = result.home.runs;
  const ar = result.away.runs;
  const homeWon = hr > ar;
  const margin = Math.abs(hr - ar);

  // Keep the full lines for the user's games, wherever the game came from —
  // simulated, or managed pitch by pitch. Both arrive here.
  const keepFor = season.captureBoxFor;
  if (keepFor !== null && (homeIndex === keepFor || awayIndex === keepFor)) {
    season.boxScores[today] = {
      day: today, home: homeIndex, away: awayIndex,
      homeRuns: hr, awayRuns: ar, innings: result.innings,
      homeBatting: battingLines(result.home),
      awayBatting: battingLines(result.away),
      homePitching: pitchingLines(result.home),
      awayPitching: pitchingLines(result.away),
      // Copied, not referenced: the TeamState is a live object the caller may
      // still be holding, and a save must not share arrays with it.
      awayLine: [...result.away.lineScore],
      homeLine: [...result.home.lineScore],
      awayHits: result.away.hits,
      homeHits: result.home.hits,
      awayErrors: result.away.errors,
      homeErrors: result.home.errors,
    };
  }

  // What you learned by watching, from the same test that decides whose box
  // score is worth keeping — and gated on `record` so that a replayed game does
  // not teach you the same thing twice.
  if ((opts.record ?? true) && keepFor !== null) {
    if (homeIndex === keepFor) noteWatch(season, result.home);
    else if (awayIndex === keepFor) noteWatch(season, result.away);
  }

  if (opts.standings ?? true) {
    home.gp += 1; away.gp += 1;
    home.rs += hr; home.ra += ar;
    away.rs += ar; away.ra += hr;
    home.opponents.push(away.index);
    away.opponents.push(home.index);

    const winner = homeWon ? home : away;
    const loser = homeWon ? away : home;
    winner.w += 1; loser.l += 1;
    if (conference) { winner.cw += 1; loser.cl += 1; }
    winner.streak = winner.streak > 0 ? winner.streak + 1 : 1;
    loser.streak = loser.streak < 0 ? loser.streak - 1 : -1;

    // What only this moment knows, for the one program that has a cabinet.
    // Both numbers are gone by the end of the season: the scoreboard is not
    // written down for anybody's game, and `streak` is a running total that
    // says nothing about the run a team put together in April.
    if (winner.index === keepFor) {
      const iAmHome = homeWon;
      noteGame(
        (season.feats ??= noFeats()), true, winner.streak,
        largestDeficit(
          iAmHome ? result.home.lineScore : result.away.lineScore,
          iAmHome ? result.away.lineScore : result.home.lineScore,
          iAmHome,
        ),
      );
    }
  }

  const decision: Decision = {
    winner: result.winningPitcher,
    loser: result.losingPitcher,
  };
  const june = opts.postseason === true;
  foldSide(season, result.home, homeWon, margin, decision, june);
  foldSide(season, result.away, !homeWon, margin, decision, june);

  // Into the all-time book, from the one door every finished game comes through.
  //
  // Gated on the same flag that decides whether the game happened at all: a
  // replayed or exhibition game must not put a second no-hitter in the tally for
  // the one no-hitter that was thrown.
  if (opts.record ?? true) {
    const book = (season.records ??= seededBook());
    const year = season.year ?? 0;
    recordGameMarks(
      book, year,
      { abbr: home.def.abbr, school: home.def.school },
      { abbr: away.def.abbr, school: away.def.school },
      result,
    );

    // The winning streak is taken here rather than at the close of the season
    // because `streak` is a running number: it is only ever correct at the
    // instant it is set, and a season-end scan would read whatever the team
    // happened to finish on.
    if (opts.standings ?? true) {
      const winner = homeWon ? home : away;
      offer(book, 'teamSeasonStreak', {
        value: winner.streak, holder: winner.def.school, team: winner.def.abbr,
        year, detail: `${winner.w}-${winner.l}`,
      });
    }

    const outs = (season.scorelessOuts ??= new Map());
    for (const side of [result.home, result.away]) {
      for (const line of side.pitching.values()) {
        if (line.outs === 0 && line.bf === 0) continue;
        const run = line.r > 0 ? 0 : (outs.get(line.player.id) ?? 0) + line.outs;
        outs.set(line.player.id, run);
        if (run < 3) continue;
        const team = side === result.home ? home : away;
        offer(book, 'seasonScoreless', {
          value: Math.floor(run / 3), holder: line.player.name,
          team: team.def.abbr, year, id: line.player.id,
        });
      }
    }
  }

  const summary: GameSummary = {
    day: today,
    home: homeIndex,
    away: awayIndex,
    homeRuns: hr,
    awayRuns: ar,
    conference,
    innings: result.innings,
  };
  if (opts.record ?? true) season.results.push(summary);
  return summary;
}

/** Sim every game on the next scheduled day. Returns that day's summaries. */
export interface DayOptions {
  /**
   * Hold this team's game back instead of simulating it. The rest of the world
   * still plays — the schedule does not wait while you manage.
   */
  hold?: number;
  /**
   * Capture the full play by play for this team's game, so it can be watched
   * rather than just read as a final score. Only one game per day is captured —
   * building a log for all 96 would cost far more than it is worth.
   */
  watch?: number;
  onCapture?: (result: GameResult) => void;
}

export function simNextDay(season: SeasonState, opts: DayOptions = {}): GameSummary[] {
  const day = season.schedule[season.dayIndex];
  if (!day) return [];
  season.dayIndex += 1;

  const summaries: GameSummary[] = [];
  for (const g of day.games) {
    if (opts.hold !== undefined && (g.home === opts.hold || g.away === opts.hold)) continue;
    const watched = opts.watch !== undefined
      && (g.home === opts.watch || g.away === opts.watch);
    summaries.push(playGame(season, g.home, g.away, {
      conference: g.conference,
      slot: g.slot,
      day: day.day,
      capture: watched,
      ...(watched && opts.onCapture ? { onCapture: opts.onCapture } : {}),
    }));
  }

  // The schedule just ran out. Freeze the regular season order before any
  // postseason game can move a tiebreaker.
  //
  // Taken one conference at a time rather than as a single world-wide table,
  // because the only thing that ever reads it filters it back down to one
  // conference — and a tie broken across the whole country can put two teams
  // from the same league in an order their own table disagrees with. The
  // tournament a program is seeded into must match the standings it has been
  // reading all season.
  if (seasonComplete(season) && season.finalOrder === null) {
    season.finalOrder = conferenceIds(season)
      .flatMap((id) => standings(season, id).map((t) => t.index));
  }

  return summaries;
}

export function seasonComplete(season: SeasonState): boolean {
  return season.dayIndex >= season.schedule.length;
}

export function simSeason(season: SeasonState): void {
  while (!seasonComplete(season)) simNextDay(season);
}

// ---------------------------------------------------------------------------
// Standings and rankings
// ---------------------------------------------------------------------------

const pct = (w: number, l: number): number => (w + l === 0 ? 0 : w / (w + l));

export function winPct(t: TeamRecord): number { return pct(t.w, t.l); }
export function confPct(t: TeamRecord): number { return pct(t.cw, t.cl); }

/**
 * Who beat whom, in the regular season, counted.
 *
 * Postseason games are excluded deliberately. A bracket is seeded off what the
 * regular season decided, and a tiebreaker that moved while the bracket was
 * being played would reseed the rounds still to come from underneath them —
 * the same hazard `finalOrder` exists to prevent, arriving by a second door.
 * The schedule's last day is the boundary: `currentDay` gives every June game a
 * date past it.
 *
 * Every meeting counts, conference or midweek. That happens to be exactly the
 * sport's rule rather than a simplification of it: inside a conference the
 * season is a full round robin, so every meeting between two of its members is
 * a conference game, and two teams in different conferences can only ever have
 * met in non-conference play.
 */
function headToHead(season: SeasonState): Map<string, number> {
  const lastDay = season.schedule[season.schedule.length - 1]?.day ?? Infinity;
  const beat = new Map<string, number>();
  for (const g of season.results) {
    if (g.day > lastDay) continue;
    const home = g.homeRuns > g.awayRuns;
    const key = `${home ? g.home : g.away}>${home ? g.away : g.home}`;
    beat.set(key, (beat.get(key) ?? 0) + 1);
  }
  return beat;
}

/**
 * Put teams in a defensible order, on any ranking, with the ties actually
 * broken.
 *
 * Ties used to fall out of `Array.sort` in whatever order the pool happened to
 * be in — which is `data/schools.ts` order, so the coin flip was invisible, and
 * reordering the data file reseeded old careers. Nothing that decides who hosts
 * a game may work that way.
 *
 * `rank` is the thing being seeded on and nothing more: conference percentage
 * for a league table, RPI for the national one, regular season wins for a
 * bracket. Everyone who comes out equal on it goes through the chain below, in
 * the order the sport uses.
 *
 *   1. **head to head**, as a mini round robin *within the tied group* — wins
 *      over the others minus losses to them. Group-relative on purpose: a
 *      pairwise comparison is not transitive, and three teams in a beats-b
 *      beats-c beats-a cycle would sort into whatever order the comparator
 *      happened to visit them in, which is the problem this function exists to
 *      remove. A net figure is a number, and numbers sort.
 *   2. conference record
 *   3. overall record, taken from `regularRecord` so June cannot move it
 *   4. run differential
 *   5. **the school's abbreviation, ascending.** The last resort has to be
 *      something, the real sport draws lots, and a draw is exactly what cannot
 *      be allowed here. An abbreviation is unique, it is the key the rest of
 *      the save already identifies a program by, and it does not move when the
 *      data file is reordered. It is arbitrary — but it is arbitrary in public,
 *      which is the whole difference.
 *
 * Run differential is the one term still live during the postseason. It sits
 * fourth, behind three frozen keys, and the abbreviation behind it is what
 * actually guarantees an answer.
 */
export function seedTeams(
  season: SeasonState,
  pool: readonly TeamRecord[],
  rank: (t: TeamRecord) => number,
): TeamRecord[] {
  const beat = headToHead(season);
  const ranked = pool.map((t) => ({ t, r: rank(t) }))
    .sort((a, b) => b.r - a.r);

  const out: TeamRecord[] = [];
  for (let i = 0; i < ranked.length;) {
    let j = i + 1;
    while (j < ranked.length && (ranked[j] as typeof ranked[number]).r
      === (ranked[i] as typeof ranked[number]).r) j++;
    const tied = ranked.slice(i, j).map((x) => x.t);
    i = j;

    if (tied.length === 1) { out.push(tied[0] as TeamRecord); continue; }

    const net = new Map<number, number>();
    for (const a of tied) {
      let n = 0;
      for (const b of tied) {
        if (a.index === b.index) continue;
        n += (beat.get(`${a.index}>${b.index}`) ?? 0)
          - (beat.get(`${b.index}>${a.index}`) ?? 0);
      }
      net.set(a.index, n);
    }

    tied.sort((a, b) =>
      (net.get(b.index) ?? 0) - (net.get(a.index) ?? 0) ||
      confPct(b) - confPct(a) ||
      overallPct(b) - overallPct(a) ||
      (b.rs - b.ra) - (a.rs - a.ra) ||
      (a.def.abbr < b.def.abbr ? -1 : a.def.abbr > b.def.abbr ? 1 : 0));
    out.push(...tied);
  }
  return out;
}

const overallPct = (t: TeamRecord): number => {
  const r = regularRecord(t);
  return pct(r.w, r.l);
};

/**
 * Conference race order: conference record, then the tiebreak chain in
 * `seedTeams`. Pass a conference id for one league's table; omit it for the
 * whole world, which is really only useful as a stable ordering to filter from.
 */
export function standings(season: SeasonState, conference?: string): TeamRecord[] {
  const pool = conference === undefined
    ? season.teams
    : season.teams.filter((t) => t.conference === conference);
  return seedTeams(season, pool, confPct);
}

/** Every conference id in the world, in world order. */
export function conferenceIds(season: SeasonState): string[] {
  const seen: string[] = [];
  for (const t of season.teams) if (!seen.includes(t.conference)) seen.push(t.conference);
  return seen;
}

/**
 * RPI, the NCAA's own formula: a quarter your record, half your opponents',
 * a quarter your opponents' opponents'. It rewards a hard schedule, which is
 * why teams schedule up. This is the real weighting, computed over conference
 * play only, since that is the whole world at the moment.
 */
export function rpi(season: SeasonState, index: number): number {
  const team = season.teams[index];
  if (!team) return 0;

  const owp = average(team.opponents.map((o) => winPct(season.teams[o] as TeamRecord)));
  const oowp = average(team.opponents.map((o) => {
    const opp = season.teams[o] as TeamRecord;
    return average(opp.opponents.map((oo) => winPct(season.teams[oo] as TeamRecord)));
  }));

  return 0.25 * winPct(team) + 0.50 * owp + 0.25 * oowp;
}

function average(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Teams ordered by RPI, best first, ties broken by `seedTeams`.
 *
 * The ties are not the rarity a float suggests. Before a ball is thrown every
 * program in the country has an RPI of exactly zero, and this is what the
 * national rankings screen draws in February — so the table opened on the data
 * file's own order and called it a ranking.
 */
export function rpiOrder(season: SeasonState): Array<{ team: TeamRecord; rpi: number }> {
  const value = new Map<number, number>(
    season.teams.map((t) => [t.index, rpi(season, t.index)]),
  );
  return seedTeams(season, season.teams, (t) => value.get(t.index) ?? 0)
    .map((team) => ({ team, rpi: value.get(team.index) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Statistical leaders
// ---------------------------------------------------------------------------

export interface LeaderRow {
  id: PlayerId;
  name: string;
  team: string;
  value: number;
  detail: string;
}

export const battingAverage = (s: BattingSeason): number => (s.ab === 0 ? 0 : s.h / s.ab);
export const onBase = (s: BattingSeason): number => {
  const pa = s.ab + s.bb + s.hbp;
  return pa === 0 ? 0 : (s.h + s.bb + s.hbp) / pa;
};
export const slugging = (s: BattingSeason): number => {
  if (s.ab === 0) return 0;
  const singles = s.h - s.d - s.t - s.hr;
  return (singles + s.d * 2 + s.t * 3 + s.hr * 4) / s.ab;
};
/**
 * Fielding percentage, on the only denominator this engine honestly has.
 *
 * NOT the scorer's number, which divides errors into putouts plus assists — and
 * most of those assists and putouts are a throw to a first baseman the
 * simulation never decides to make. What it divides by instead is balls hit at
 * him, which is a quantity the engine really produces. It therefore runs a few
 * points below a published fielding percentage and carries the same meaning:
 * league-wide it lands around .960, against a real D1 figure near .967.
 */
export const fieldingPct = (s: FieldingSeason): number =>
  s.chances === 0 ? 1 : (s.chances - s.errors) / s.chances;

/**
 * Outs he made that an average glove on his own team would not have. The single
 * number for "is this a good defender", and the reason `expected` is recorded.
 *
 * Errors are inside it, because an error is a play not made. That also means the
 * league average is not zero but slightly negative — about minus one per team
 * per game, which is the league's error rate. Compare defenders to each other,
 * not to zero. Add `errors` back if you want range alone.
 */
export const playsAboveExpected = (s: FieldingSeason): number => s.plays - s.expected;

/**
 * The same thing per hundred balls hit at him, which is how two fielders at two
 * positions can be put in one order. A centre fielder sees six times the traffic
 * a catcher does, and the raw count reads that difference as talent.
 */
export const paePer100 = (s: FieldingSeason): number =>
  s.chances === 0 ? 0 : (playsAboveExpected(s) / s.chances) * 100;

/**
 * The bar a glove has to clear to be ranked, in balls hit at him.
 *
 * The same idea as the batting title's plate appearances and the ERA title's
 * innings, and it exists for a sharper reason than either: the ranking statistic
 * is a *count* of plays made above average, so a man who never took the field
 * sits at exactly zero and would outrank every real fielder having a bad month.
 *
 * A third of a chance per team game, which is far lower than it sounds. Balls in
 * play are shared out very unevenly by the spray model: a centre fielder sees
 * three and a half a game, and a catcher a little under half of one, because the
 * only ball he fields is a pop-up off the plate. A one-per-game bar reads like a
 * light touch and in practice tells every catcher in the country that he cannot
 * be rated — while his real defensive work, blocking and throwing runners out, is
 * not in this statistic at all and lives on his own card. So the bar sits where a
 * season behind the plate clears it, and a reliever with five comebackers does
 * not.
 */
const MIN_CHANCES_FLOOR = 15;
const CHANCES_PER_GAME = 0.35;

/** The bar in this season, in balls hit at him. Exported so a screen can hide a rate that cannot mean anything yet. */
export const rankableChances = (season: SeasonState): number =>
  Math.max(MIN_CHANCES_FLOOR,
    Math.floor(Math.max(...season.teams.map((t) => t.gp), 1) * CHANCES_PER_GAME));

/**
 * And the higher bar the national board uses, because leading the country is a
 * different question from being placed in it.
 *
 * An everyday fielder, at roughly a chance and a half a game. The board is
 * ranked on a rate, and a rate off twenty-six chances is one lucky afternoon
 * printed as a season.
 */
const BOARD_CHANCES_FLOOR = 30;
const BOARD_CHANCES_PER_GAME = 1.5;

/**
 * Where a fielder sits against the rest of the league, which is the only way
 * plays above expected can honestly be printed.
 *
 * The statistic is a redistribution: `expected` is what his own team's average
 * glove would have done with the same balls, so the league sums to roughly the
 * league's error count rather than to zero, and every fielder alive reads
 * slightly negative. Printed bare it says "this player is bad" about all of
 * them. Printed next to the league's own figure and a rank, it says the thing it
 * actually knows — better or worse than the men he is competing with.
 *
 * The rate is per hundred chances so a shortstop and a first baseman can be
 * compared without the shortstop winning on volume alone; the leaderboard ranks
 * on the count, which is a different and equally fair question.
 */
export interface FieldingContext {
  /** Plays above expected per hundred chances, for this player. */
  rate: number;
  /** The same figure for every glove in the league. Not zero, and never was. */
  leagueRate: number;
  /** 1 is the best qualified glove in the pool. */
  rank: number;
  /** How many gloves cleared the bar he is being ranked against. */
  qualified: number;
  /** False when he has not fielded enough for the rank to mean anything. */
  ranked: boolean;
}

/**
 * Where zero actually is, in plays per hundred chances.
 *
 * Exported so a screen can print the league's own line beside a fielder's
 * instead of asking the reader to take "slightly below zero" on trust. It is
 * about minus four — one play a team a game, spread over the twenty-odd balls a
 * team fields in one — and it is the league's error rate, nothing more.
 */
export function leagueFieldingRate(season: SeasonState): number {
  let plays = 0; let expected = 0; let chances = 0;
  for (const s of (season.fielding ?? new Map<PlayerId, FieldingSeason>()).values()) {
    plays += s.plays; expected += s.expected; chances += s.chances;
  }
  return chances === 0 ? 0 : ((plays - expected) / chances) * 100;
}

export function fieldingContext(
  season: SeasonState,
  id: PlayerId,
  opts: { minChances?: number; team?: string } = {},
): FieldingContext | null {
  const mine = season.fielding?.get(id);
  if (!mine || mine.chances === 0) return null;

  const minChances = opts.minChances ?? rankableChances(season);

  const pool = opts.team === undefined
    ? [...(season.fielding ?? new Map<PlayerId, FieldingSeason>()).entries()]
    : (() => {
      const teams = teamLookup(season);
      return [...(season.fielding ?? new Map<PlayerId, FieldingSeason>()).entries()]
        .filter(([pid]) => teams.get(pid) === opts.team);
    })();

  let leaguePlays = 0;
  let leagueExpected = 0;
  let leagueChances = 0;
  for (const [, s] of pool) {
    leaguePlays += s.plays; leagueExpected += s.expected; leagueChances += s.chances;
  }

  const rate = paePer100(mine);
  const qualified = pool.filter(([, s]) => s.chances >= minChances);
  const better = qualified.filter(([, s]) => paePer100(s) > rate).length;

  return {
    rate,
    leagueRate: leagueChances === 0
      ? 0 : ((leaguePlays - leagueExpected) / leagueChances) * 100,
    rank: better + 1,
    qualified: qualified.length,
    ranked: mine.chances >= minChances,
  };
}

export const inningsPitched = (s: PitchingSeason): number => s.outs / 3;
export const era = (s: PitchingSeason): number => {
  const ip = inningsPitched(s);
  return ip === 0 ? 0 : (s.er * 9) / ip;
};
export const whip = (s: PitchingSeason): number => {
  const ip = inningsPitched(s);
  return ip === 0 ? 0 : (s.h + s.bb) / ip;
};

/** Where each player plays, built once so leaderboards can name a team. */
function teamLookup(season: SeasonState): Map<PlayerId, string> {
  const map = new Map<PlayerId, string>();
  for (const t of season.teams) {
    const roster = [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen];
    for (const p of roster) map.set(p.id, t.def.abbr);
  }
  return map;
}

function nameLookup(season: SeasonState): Map<PlayerId, string> {
  const map = new Map<PlayerId, string>();
  for (const t of season.teams) {
    const roster = [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen];
    for (const p of roster) map.set(p.id, p.name);
  }
  return map;
}

export interface LeaderOptions {
  limit?: number;
  /** Minimum plate appearances for rate stats. Keeps a 3-for-5 bench bat off the top. */
  minPA?: number;
  /** Minimum innings for pitching rate stats. */
  minIP?: number;
  /** Minimum balls hit at him before a glove is ranked. */
  minChances?: number;
  /**
   * Restrict the whole pool to one team before ranking.
   *
   * This has to happen before the cut, not after. Ranking the nation and then
   * filtering to one roster returns almost nothing, because a given program
   * rarely has anybody in the national top five.
   */
  team?: string;
  /**
   * Rank June instead of the season.
   *
   * Reads the postseason books rather than the season ones, and nothing else
   * changes — the same sorts, the same rows, the same shape out. The caller is
   * responsible for the qualifiers, because a national minimum built for fifty
   * games would empty a leaderboard covering at most a fortnight.
   */
  june?: boolean;
}

export interface Leaderboards {
  average: LeaderRow[];
  homeRuns: LeaderRow[];
  rbi: LeaderRow[];
  stolenBases: LeaderRow[];
  era: LeaderRow[];
  strikeouts: LeaderRow[];
  wins: LeaderRow[];
  /**
   * Gloves, ranked on plays made above what an average fielder would have made
   * of the same chances — **per hundred chances**.
   *
   * Not errors, which is the number a real box score prints and the wrong one to
   * rank on: the fewest errors in the country belongs to the man nobody hits it
   * to, and fielding percentage rewards the same player for the same reason. The
   * only statistic here that asks whether a defender did anything is the one that
   * counts outs he had no business making.
   *
   * A rate rather than the raw count, which is the second half of the same
   * problem. The count is biased downward by volume — the league average is
   * negative, so every extra chance drags a man further below zero — and ranking
   * on it put a backup with twelve chances and a flat zero above a shortstop who
   * had played every inning of the season. Positions differ by six times in how
   * often the ball comes, so the count is not comparable between two of them and
   * the rate is.
   */
  fielding: LeaderRow[];
}

/**
 * The bar a bat and an arm have to clear before a rate statistic about them
 * means anything.
 *
 * The NCAA's own qualifiers: 2.0 plate appearances per team game for a batting
 * title, 1.0 inning per team game for an ERA title. (MLB is stricter at 3.1 and
 * 1.0.) Without the innings rule a reliever with twenty good innings outranks an
 * ace with a hundred, which is not an ERA champion.
 *
 * The qualifier scales with games played, which is right at the end of a season
 * and useless at the start of one: six games in it admits a hitter who is
 * 10-for-17 and puts .588 at the top of the leaderboard. A floor keeps early
 * season boards honest — nobody leads the nation on seventeen at bats.
 *
 * One function because there is one house convention. The record book asks the
 * same question as the leaderboards and must not answer it differently: a rate
 * that leads the country in June and a rate the book will not accept would be
 * two different definitions of a season.
 */
export interface Qualifiers { minPA: number; minIP: number }

export function qualifiers(season: SeasonState): Qualifiers {
  const gamesPlayed = Math.max(...season.teams.map((t) => t.gp), 1);
  const MIN_PA_FLOOR = 40;
  const MIN_IP_FLOOR = 15;
  return {
    minPA: Math.max(MIN_PA_FLOOR, Math.floor(gamesPlayed * 2.0)),
    minIP: Math.max(MIN_IP_FLOOR, Math.floor(gamesPlayed * 1.0)),
  };
}

export function leaders(season: SeasonState, opts: LeaderOptions = {}): Leaderboards {
  const limit = opts.limit ?? 5;
  const teams = teamLookup(season);
  const names = nameLookup(season);

  const gamesPlayed = Math.max(...season.teams.map((t) => t.gp), 1);
  const bars = qualifiers(season);
  const minPA = opts.minPA ?? bars.minPA;
  const minIP = opts.minIP ?? bars.minIP;
  const minChances = opts.minChances
    ?? Math.max(BOARD_CHANCES_FLOOR, Math.floor(gamesPlayed * BOARD_CHANCES_PER_GAME));

  const row = (id: PlayerId, value: number, detail: string): LeaderRow => ({
    id,
    name: names.get(id) ?? String(id),
    team: teams.get(id) ?? '---',
    value,
    detail,
  });

  const onTeam = (id: PlayerId): boolean =>
    opts.team === undefined || teams.get(id) === opts.team;

  const batBook = opts.june ? (season.postBatting ?? new Map()) : season.batting;
  const pitBook = opts.june ? (season.postPitching ?? new Map()) : season.pitching;
  const bat = [...batBook.entries()].filter(([id]) => onTeam(id));
  const pit = [...pitBook.entries()].filter(([id]) => onTeam(id));
  // Optional on the save: a dynasty rolled forward from before the defensive
  // layer has no fielding map at all until the next pitch is thrown.
  const fld = [...(season.fielding ?? new Map<PlayerId, FieldingSeason>()).entries()]
    .filter(([id]) => onTeam(id));

  const qualifiedBat = bat.filter(([, s]) => s.ab + s.bb + s.hbp >= minPA);
  const qualifiedPit = pit.filter(([, s]) => inningsPitched(s) >= minIP);
  const qualifiedFld = fld.filter(([, s]) => s.chances >= minChances);

  const top = <T>(
    rows: Array<[PlayerId, T]>,
    value: (s: T) => number,
    detail: (s: T) => string,
    ascending = false,
  ): LeaderRow[] =>
    rows
      .map(([id, s]) => row(id, value(s), detail(s)))
      .sort((a, b) => (ascending ? a.value - b.value : b.value - a.value))
      .slice(0, limit);

  return {
    average: top(qualifiedBat, battingAverage, (s) => `${s.h}-for-${s.ab}`),
    homeRuns: top(bat, (s) => s.hr, (s) => `${s.rbi} RBI`),
    rbi: top(bat, (s) => s.rbi, (s) => `${s.hr} HR`),
    stolenBases: top(bat, (s) => s.sb, (s) => `${s.cs} CS`),
    era: top(qualifiedPit, era, (s) => `${inningsPitched(s).toFixed(1)} IP`, true),
    strikeouts: top(pit, (s) => s.k, (s) => `${inningsPitched(s).toFixed(1)} IP`),
    wins: top(pit, (s) => s.w, (s) => `${s.l} L, ${era(s).toFixed(2)} ERA`),
    // Ties broken by volume, which `top` cannot do and this board needs: on a
    // rate off a hundred-odd chances two men land on the same tenth often, and
    // the one who has been out there more has earned it over the smaller sample.
    fielding: qualifiedFld
      .slice()
      .sort((a, b) => paePer100(b[1]) - paePer100(a[1]) || b[1].chances - a[1].chances)
      .slice(0, limit)
      .map(([id, s]) => {
        const pae = playsAboveExpected(s);
        return row(
          id,
          paePer100(s),
          `${s.chances} CH, ${pae > 0 ? '+' : ''}${pae} PLAYS, `
            + `${fieldingPct(s).toFixed(3).replace(/^0/, '')} PCT`,
        );
      }),
  };
}

// ---------------------------------------------------------------------------
// The all-time book, at the close of a season
// ---------------------------------------------------------------------------

/**
 * Everything a finished season puts in the book.
 *
 * Here rather than in records.ts because it reads a whole `SeasonState` and the
 * rate helpers that sit beside it — and because the three statistics maps are
 * already league-wide, being exactly what the national leaderboards are computed
 * from. So this is a scan of what is in hand at the end of June rather than a new
 * store. Single-game marks cannot be taken this way, because the box score is
 * gone by now; season marks cannot be taken the other way, because a season
 * leader is not knowable until the season stops.
 *
 * Must run before `nextSeason` wipes the statistics. The store calls it next to
 * `archiveSeason`, which lives under the same constraint for the same reason.
 *
 * Counts are only offered when there is something to offer. A category nobody has
 * ever managed should read as open rather than as held by a man with none of
 * them, and without the guard the first name out of the map takes it at zero.
 */
export function recordSeasonMarks(season: SeasonState, year: number): void {
  const book = (season.records ??= seededBook());
  const teams = teamLookup(season);
  const names = nameLookup(season);
  const { minPA, minIP } = qualifiers(season);

  for (const [id, s] of season.batting) {
    const who = {
      holder: names.get(id) ?? String(id), team: teams.get(id) ?? '---', year, id,
    };
    const games = `${s.g} G`;
    if (s.hr > 0) offer(book, 'seasonHR', { ...who, value: s.hr, detail: `${s.rbi} RBI` });
    if (s.rbi > 0) offer(book, 'seasonRBI', { ...who, value: s.rbi, detail: `${s.hr} HR` });
    if (s.h > 0) offer(book, 'seasonHits', { ...who, value: s.h, detail: `${s.ab} AB` });
    if (s.r > 0) offer(book, 'seasonRuns', { ...who, value: s.r, detail: games });
    if (s.sb > 0) offer(book, 'seasonSB', { ...who, value: s.sb, detail: `${s.cs} CS` });
    if (s.d > 0) offer(book, 'seasonDoubles', { ...who, value: s.d, detail: games });
    if (s.t > 0) offer(book, 'seasonTriples', { ...who, value: s.t, detail: games });
    // Singles once, doubles twice, and so on, which folds to this.
    const tb = s.h + s.d + s.t * 2 + s.hr * 3;
    if (tb > 0) offer(book, 'seasonTB', { ...who, value: tb, detail: `${s.ab} AB` });

    // The rates, behind the same bar the national leaderboards use.
    if (s.ab + s.bb + s.hbp < minPA) continue;
    offer(book, 'seasonAvg', {
      ...who, value: battingAverage(s), detail: `${s.h}-for-${s.ab}`,
    });
    offer(book, 'seasonSlg', { ...who, value: slugging(s), detail: `${tb} TB` });
  }

  for (const [id, s] of season.pitching) {
    const who = {
      holder: names.get(id) ?? String(id), team: teams.get(id) ?? '---', year, id,
    };
    const ip = inningsPitched(s);
    const shown = `${Math.floor(s.outs / 3)}.${s.outs % 3} IP`;
    if (s.k > 0) offer(book, 'seasonK', { ...who, value: s.k, detail: shown });
    if (s.w > 0) offer(book, 'seasonWins', { ...who, value: s.w, detail: `${s.l} L` });
    if (s.sv > 0) offer(book, 'seasonSaves', { ...who, value: s.sv, detail: `${s.g} G` });
    if (s.outs > 0) offer(book, 'seasonIP', { ...who, value: ip, detail: `${s.gs} GS` });

    if (ip < minIP) continue;
    offer(book, 'seasonERA', { ...who, value: era(s), detail: shown });
    offer(book, 'seasonWHIP', { ...who, value: whip(s), detail: shown });
    offer(book, 'seasonK9', { ...who, value: (s.k * 9) / ip, detail: `${s.k} K, ${shown}` });
  }

  for (const t of season.teams) {
    if (t.gp === 0) continue;
    const who = { holder: t.def.school, team: t.def.abbr, year };
    const record = `${t.w}-${t.l}`;
    offer(book, 'teamSeasonWins', { ...who, value: t.w, detail: record });
    offer(book, 'teamSeasonDiff', {
      ...who, value: t.rs - t.ra, detail: `${t.rs} RS, ${t.ra} RA`,
    });
  }
}

/**
 * Career marks, for every program in the country. B13.
 *
 * The expensive reading of this was "archive every program's seasons the way the
 * user's are archived", and it was rejected on measurement: twenty five hundred
 * rows a year that are never deleted, against a book that only ever wants totals.
 * What is kept instead is one running total per man on a roster, added to each
 * June and dropped the year after he leaves — bounded by the size of the league
 * rather than by the age of the dynasty. A departed man's total is final the
 * moment he goes, and it has already been offered to the book, so there is
 * nothing left in the row to lose.
 *
 * Runs beside `recordSeasonMarks`, under the same constraint and for the same
 * reason: before `departAndDevelop`, which is the last moment the men who played
 * the season are still on the rosters this walks. Miss that and every career in
 * the book is short by its final year, which is usually its best.
 *
 * **Idempotent, which took the one extra field on the row.** Every other pass
 * over a finished season is idempotent for free because a mark has to be beaten
 * rather than equalled — a running total is not, and the offseason rail can be
 * walked backwards and forwards. `last` is the year already folded in, so a
 * second call re-offers the same totals and changes nothing.
 */
export function recordCareerMarks(season: SeasonState, year: number): void {
  const book = (season.records ??= seededBook());
  const prev = season.careerTotals ?? new Map<PlayerId, CareerTotals>();
  const next = new Map<PlayerId, CareerTotals>();

  for (const rec of season.teams) {
    const roster = [
      ...rec.team.lineup, ...rec.team.bench, ...rec.team.rotation, ...rec.team.bullpen,
    ];
    for (const p of roster) {
      const bat = season.batting.get(p.id);
      const pit = season.pitching.get(p.id);
      const played = (bat && bat.ab > 0) || (pit && pit.outs > 0);
      const before = prev.get(p.id);
      if (!played && !before) continue;

      const base: CareerTotals = before ?? {
        y: 0, last: 0,
        ab: 0, h: 0, d: 0, t: 0, hr: 0, r: 0, rbi: 0, sb: 0,
        outs: 0, w: 0, l: 0, er: 0, k: 0,
      };
      const total: CareerTotals = before?.last === year ? before : {
        y: base.y + (played ? 1 : 0),
        last: year,
        ab: base.ab + (bat?.ab ?? 0),
        h: base.h + (bat?.h ?? 0),
        d: base.d + (bat?.d ?? 0),
        t: base.t + (bat?.t ?? 0),
        hr: base.hr + (bat?.hr ?? 0),
        r: base.r + (bat?.r ?? 0),
        rbi: base.rbi + (bat?.rbi ?? 0),
        sb: base.sb + (bat?.sb ?? 0),
        outs: base.outs + (pit?.outs ?? 0),
        w: base.w + (pit?.w ?? 0),
        l: base.l + (pit?.l ?? 0),
        er: base.er + (pit?.er ?? 0),
        k: base.k + (pit?.k ?? 0),
      };

      /*
        And the June half of the same career.

        Folded here rather than anywhere else because this is the one pass that
        already runs once a year, over every roster in the country, with the
        idempotence problem already solved — and a running postseason total has
        exactly the same problem for exactly the same reason. `post.last` is
        the tournament already folded in, so walking the offseason rail
        backwards and forwards cannot count a June twice.

        A man who never reached June carries no line at all rather than a line
        of zeroes: the map is one row per active player already, and the
        cheapest row is the one that is not there.
      */
      const jBat = season.postBatting?.get(p.id);
      const jPit = season.postPitching?.get(p.id);
      const playedJune = (jBat && jBat.g > 0) || (jPit && jPit.g > 0);
      const priorPost = before?.post;
      if (playedJune || priorPost) {
        const pBase: PostTotals = priorPost ?? {
          y: 0, last: 0,
          ab: 0, h: 0, d: 0, t: 0, hr: 0, r: 0, rbi: 0, sb: 0,
          outs: 0, w: 0, l: 0, er: 0, k: 0,
        };
        total.post = priorPost?.last === year ? priorPost : {
          y: pBase.y + (playedJune ? 1 : 0),
          last: year,
          ab: pBase.ab + (jBat?.ab ?? 0),
          h: pBase.h + (jBat?.h ?? 0),
          d: pBase.d + (jBat?.d ?? 0),
          t: pBase.t + (jBat?.t ?? 0),
          hr: pBase.hr + (jBat?.hr ?? 0),
          r: pBase.r + (jBat?.r ?? 0),
          rbi: pBase.rbi + (jBat?.rbi ?? 0),
          sb: pBase.sb + (jBat?.sb ?? 0),
          outs: pBase.outs + (jPit?.outs ?? 0),
          w: pBase.w + (jPit?.w ?? 0),
          l: pBase.l + (jPit?.l ?? 0),
          er: pBase.er + (jPit?.er ?? 0),
          k: pBase.k + (jPit?.k ?? 0),
        };
      }

      next.set(p.id, total);

      const who = { holder: p.name, team: rec.def.abbr, year, id: p.id };
      const span = `${total.y} season${total.y === 1 ? '' : 's'}`;

      if (total.ab > 0) {
        const tb = total.h + total.d + total.t * 2 + total.hr * 3;
        if (total.hr > 0) offer(book, 'careerHR', { ...who, value: total.hr, detail: span });
        if (total.rbi > 0) offer(book, 'careerRBI', { ...who, value: total.rbi, detail: span });
        if (total.h > 0) {
          offer(book, 'careerHits', { ...who, value: total.h, detail: `${total.ab} AB` });
        }
        if (total.r > 0) offer(book, 'careerRuns', { ...who, value: total.r, detail: span });
        if (total.sb > 0) offer(book, 'careerSB', { ...who, value: total.sb, detail: span });
        if (total.d > 0) offer(book, 'careerDoubles', { ...who, value: total.d, detail: span });
        if (tb > 0) offer(book, 'careerTB', { ...who, value: tb, detail: `${total.ab} AB` });

        if (total.ab >= CAREER_MIN_AB) {
          offer(book, 'careerAvg', {
            ...who, value: total.h / total.ab, detail: `${total.h}-for-${total.ab}`,
          });
          offer(book, 'careerSlg', { ...who, value: tb / total.ab, detail: `${tb} TB` });
        }
      }

      if (total.outs > 0) {
        const innings = total.outs / 3;
        const shown = `${Math.floor(total.outs / 3)}.${total.outs % 3} IP`;
        if (total.k > 0) offer(book, 'careerK', { ...who, value: total.k, detail: shown });
        if (total.w > 0) {
          offer(book, 'careerWins', {
            ...who, value: total.w, detail: `${total.w}-${total.l}`,
          });
        }
        offer(book, 'careerIP', { ...who, value: innings, detail: span });
        if (innings >= CAREER_MIN_IP) {
          offer(book, 'careerERA', {
            ...who, value: (total.er * 9) / innings, detail: shown,
          });
        }
      }
    }
  }

  // Rebuilt rather than merged, which is the pruning. Anybody who was on a roster
  // last June and is not on one now has graduated, been drafted or was a walk-on,
  // and his total is finished — so the map that replaces this one simply does not
  // contain him.
  season.careerTotals = next;
}
