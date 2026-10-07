// retirement.ts
// The end of a coaching career, which this game did not have.
//
// A career could only ever be taken away here: the board sacked you and the
// market caught you, because `jobOffers` guarantees a chair. Nothing let a man
// decide he was finished, and nothing ever decided it for him -- his age went
// up every June and not one line of the simulation read it.
//
// Everything in this file is arithmetic on a record. When the years start
// asking, when they stop asking, and what a finished career was worth beside
// the ones already in the book. Nothing here decides anything on its own: the
// store asks at the board meeting, the screens read the answer afterwards.

import type { CoachLook, CoachRecord } from './program.js';
import type { Finish } from './postseason.js';

/**
 * When the game starts asking, and when it stops taking an answer.
 *
 * Two clocks rather than one, whichever runs out first, because a career has
 * two honest lengths. A man who took his first chair at 55 has a short one
 * however well it goes, and a man who started at 28 can be thirty years in and
 * still be younger than the first man was on day one. Age alone would let that
 * second career run past forty seasons; seasons alone would make the age on
 * his profile a decoration.
 *
 * The ages sit either side of where the other ninety five men go: a rival
 * retires somewhere in 64 to 72 (`retireAge`, rivals.ts). Asking at 62 means
 * the question arrives before his peers start leaving, and 70 means nobody
 * outlasts the oldest of them by more than a season.
 */
export const ASK_AGE = 62;
export const ASK_SEASONS = 20;
export const LAST_AGE = 70;
export const LAST_SEASONS = 30;

/**
 * Where a career is against those clocks.
 *
 * `early` -- nobody is asking; the button is still yours to press.
 * `asked`  -- the board meeting puts the question every June from here.
 * `over`   -- the answer is no longer yours to give.
 */
export type RetirementStatus = 'early' | 'asked' | 'over';

export function retirementStatus(at: { age: number; seasons: number }): RetirementStatus {
  const age = Number.isFinite(at.age) ? at.age : 0;
  const seasons = Number.isFinite(at.seasons) ? Math.max(0, at.seasons) : 0;
  if (age >= LAST_AGE || seasons >= LAST_SEASONS) return 'over';
  if (age >= ASK_AGE || seasons >= ASK_SEASONS) return 'asked';
  return 'early';
}

/** One program, and the years he had it. */
export interface LegendStint {
  school: string;
  /**
   * The school's letters, which is how the career book files its rows -- the
   * key that turns "Marbury Tech, 2031" into the men who played there. Absent
   * on a legend written before it was kept, where the screen maps by name.
   */
  abbr?: string;
  from: number;
  to: number;
  w: number;
  l: number;
  /** National titles won at this one. */
  titles: number;
}

/**
 * One finished season, as the book keeps it for as long as the world does.
 *
 * Copied off the coach's `history` when the career is written, because that
 * history is thrown away the moment a successor takes a chair -- and without
 * it a legend on the wall could never open its own seasons again. Everything
 * a drill-down needs to find the rest (the roster, the awards, the runner-up)
 * is keyed off the year and the letters here.
 */
export interface LegendYear {
  year: number;
  school: string;
  /** Absent when the school could not be resolved -- see {@link LegendStint}. */
  abbr?: string;
  w: number;
  l: number;
  finish: Finish;
  wonConference: boolean;
  /** What his players won that year. Copied, because the history is not kept. */
  awards?: { title: string; name: string; id: string }[];
}

/**
 * A finished career, kept for as long as the world is.
 *
 * Flat, plain and self-contained on purpose. It outlives the coach it was
 * written from -- his `CoachState` is thrown away the moment a successor takes
 * a chair -- and it has to describe a rival just as well as it describes you,
 * from the much thinner record `rivals.ts` keeps. Anything a plaque or a
 * ranking wants to say has to be *in here*, because there will be nothing left
 * to ask.
 */
export interface Legend {
  name: string;
  /** Yours, rather than one of the ninety five. */
  you: boolean;
  /** First and last season he coached. Equal for a one-year career. */
  from: number;
  to: number;
  /** How old he was when he walked away. */
  age: number;
  seasons: number;
  careerWins: number;
  careerLosses: number;
  titles: number;
  conferenceTitles: number;
  regionalTitles: number;
  tournaments: number;
  /** Where he coached, oldest first. */
  stints: LegendStint[];
  /**
   * What the career scored the day it ended -- see {@link legacyScore}.
   *
   * Stored rather than recomputed because the ranking has to hold still. A
   * weight changed in a later build would otherwise quietly re-order a hall
   * full of men who are no longer around to earn their place again.
   */
  score: number;
  /** Whether he chose the day, or the years chose it. */
  ending: 'chose' | 'age';
  homeState?: string;
  look?: CoachLook;
  badges?: string[];
  /**
   * His seasons, one row each, oldest first. Only yours: nothing was ever
   * archived season by season for the other ninety five, so a rival legend
   * has none and his page shows what his totals can say.
   */
  years?: LegendYear[];
  /** Prestige the last program gained while he had it. Read by the ending. */
  built?: number;
}

/**
 * What a career was worth, in one number.
 *
 * Only for ordering a list of them; nothing in the simulation reads it. The
 * weights say what the game already says everywhere else -- the national title
 * is the thing, and everything below it is a step on the way there.
 *
 *   national title   150   one of ninety six programs, once a year
 *   trip to Omaha     25   sixteen regionals a June, four men get out
 *   conference title  10
 *   tournament bid     5
 *   a win           0.25
 *   a season           1   longevity, and no more than a nudge
 *
 * The title is priced so that one of them beats any realistic pile of the
 * things below it -- three trips to Omaha and three league titles is a fine
 * decade and it still loses to the man who won the country once, which is what
 * the ladder in `coachStanding` already says out loud.
 *
 * Wins are in at all so that a man who never won anything but turned up for
 * twenty-five years outranks a man who did the same for six. A season of them
 * is worth about a fifteenth of a trophy, so no single year can buy a ranking,
 * and nine hundred of them -- a whole life -- come to a title and a half. That
 * is the only place longevity is allowed to compete with winning.
 */
export function legacyScore(record: {
  careerWins: number; careerLosses: number; titles: number;
  conferenceTitles: number; regionalTitles: number; tournaments: number;
  seasons: number;
}): number {
  const n = (v: number): number => (Number.isFinite(v) ? Math.max(0, v) : 0);
  return Math.round(
    n(record.titles) * 150
    + n(record.regionalTitles) * 25
    + n(record.conferenceTitles) * 10
    + n(record.tournaments) * 5
    + n(record.careerWins) * 0.25
    + n(record.seasons),
  );
}

/**
 * The same number off a live coach, who counts his seasons somewhere else.
 *
 * `tenure` is seasons in the current chair, so a career's length has to be
 * handed in rather than read -- see the store, where it is the longer of the
 * history and the tenure.
 */
export function scoreOf(coach: CoachRecord, seasons: number): number {
  return legacyScore({ ...coach, seasons });
}

/**
 * Where a career stands among the ones on record, 1 is best.
 *
 * Ties share the better place, the way a leaderboard does: two men on the same
 * number are both seventh and nobody is eighth.
 */
export function legacyRank(score: number, legends: readonly Legend[]): { rank: number; of: number } {
  const better = legends.filter((l) => l.score > score).length;
  return { rank: better + 1, of: legends.length + 1 };
}

/**
 * One of the other ninety five, written down the day the years take him.
 *
 * Thinner than yours and honestly so: `rivals.ts` keeps no badges, no
 * achievements and no per-school history, so a rival legend carries the chair
 * he retired from and nothing before it. What it does carry is the same career
 * totals, scored on the same weights — a rival is graded by `reviewSeason` and
 * paid by `skillPoints` exactly as you are, so there is no handicap to apply in
 * either direction.
 */
export function legendFromRival(
  coach: {
    name: string; age: number; careerWins: number; careerLosses: number;
    titles: number; conferenceTitles: number; regionalTitles: number; tournaments: number;
  },
  at: {
    year: number; school: string; heldFor: number; seasons: number;
    abbr?: string; built?: number;
  },
): Legend {
  const seasons = Math.max(1, at.seasons);
  const held = Math.max(1, at.heldFor);
  return {
    name: coach.name,
    you: false,
    from: at.year - seasons + 1,
    to: at.year,
    age: coach.age,
    seasons,
    careerWins: coach.careerWins,
    careerLosses: coach.careerLosses,
    titles: coach.titles,
    conferenceTitles: coach.conferenceTitles,
    regionalTitles: coach.regionalTitles,
    tournaments: coach.tournaments,
    // The one chair anybody can still name. His earlier stops are in the
    // schools' own annals and nowhere on him.
    stints: [{
      school: at.school,
      ...(at.abbr ? { abbr: at.abbr } : {}),
      from: at.year - held + 1,
      to: at.year,
      // What he did in this one chair is not kept anywhere: his totals are the
      // whole career, and the screens read the school's own book instead.
      w: 0,
      l: 0,
      titles: 0,
    }],
    ...(at.built ? { built: at.built } : {}),
    score: legacyScore({ ...coach, seasons }),
    ending: 'age',
  };
}

/** How a career ended, as a story rather than a number. */
export type EndingId =
  | 'on-top' | 'dynasty' | 'champion' | 'lifer' | 'builder' | 'nearly' | 'long-road';

export interface Ending {
  id: EndingId;
  /** The headline the ceremony closes on. */
  title: string;
  /** One sentence under it, written from his own numbers. */
  line: string;
  /**
   * How it should look. Gold is a trophy's colour and gets the confetti; warm
   * is a life's work; quiet is a career told plainly, which is not the same as
   * told sadly.
   */
  tone: 'gold' | 'warm' | 'quiet';
}

/** Seasons at one school that make a man part of its furniture. */
export const LIFER_RUN = 15;
/** Prestige lifted at the last chair that makes a program his work. */
export const BUILT_BY = 20;

/**
 * Which story a finished career tells.
 *
 * Read top down, the first one that fits: a trophy outranks a shape, and the
 * best trophy story is the one the fewest men get -- winning it and leaving on
 * the same afternoon. Everything is read off the Legend alone, so a career in
 * the hall tells the same story twenty years later that it told the day it
 * ended.
 *
 * Nothing here is allowed to mock a modest career. The quiet endings are the
 * ones where the words have to carry more, not less.
 */
export function endingOf(l: Legend): Ending {
  const years = l.years ?? [];
  const wins = l.careerWins;
  const longest = l.stints.reduce((best, s) => Math.max(best, s.to - s.from + 1), 0);
  const home = l.stints.find((s) => s.to - s.from + 1 === longest)?.school ?? 'one school';
  const lastTitle = years.filter((y) => y.finish === 'champion').reduce((a, y) => Math.max(a, y.year), -Infinity);

  if (l.ending === 'chose' && lastTitle >= l.to - 1) {
    return {
      id: 'on-top', tone: 'gold', title: 'Went out on top',
      line: lastTitle === l.to
        ? 'You won the country and walked out the same summer. Almost nobody gets to.'
        : 'A title, one more year to be sure, and then your own day. Almost nobody gets to.',
    };
  }
  if (l.titles >= 3) {
    return {
      id: 'dynasty', tone: 'gold', title: 'The dynasty',
      line: `${l.titles} national titles. Every coach after you will be measured against them.`,
    };
  }
  if (l.titles > 0) {
    return {
      id: 'champion', tone: 'gold', title: 'A champion',
      line: l.titles === 1
        ? 'You won the country once. Whatever else the years held, nobody can take that back.'
        : 'Two national titles. Most men who do this for a living never see one.',
    };
  }
  if (longest >= LIFER_RUN) {
    return {
      id: 'lifer', tone: 'warm', title: 'The lifer',
      line: `${longest} seasons at ${home}. Some places are a job. That one was yours.`,
    };
  }
  if ((l.built ?? 0) >= BUILT_BY) {
    return {
      id: 'builder', tone: 'warm', title: 'The builder',
      line: 'You took a program nobody wanted and left one everybody does.',
    };
  }
  // Trips to Omaha off the seasons themselves, the way the plaque and its
  // list count them (M98); the running total for a career kept before them.
  const omaha = l.years
    ? l.years.filter((y) => y.finish === 'omaha' || y.finish === 'runner-up' || y.finish === 'champion').length
    : l.regionalTitles;
  if (omaha > 0) {
    return {
      id: 'nearly', tone: 'quiet', title: 'The nearly man',
      line: omaha === 1
        ? 'Omaha once. The last step was the one that never came.'
        : `Omaha ${omaha} times. The last step was the one that never came.`,
    };
  }
  return {
    id: 'long-road', tone: 'quiet', title: 'The long road',
    line: `${l.seasons} ${l.seasons === 1 ? 'season' : 'seasons'} and ${wins} wins. The game is bigger for the men who came through your teams.`,
  };
}

/**
 * What gets a coach on the wall.
 *
 * A national title and the career it sat in clears it: 150 for the trophy and
 * a working decade around it gets there and not much further, which is right
 * -- winning the country once should put a man on the wall and should not put
 * him at the top of it. Without one it takes a long life of Junes, four trips
 * to Omaha or a decade of league titles on top of six hundred wins: the honest
 * shape of a man remembered for something other than a trophy.
 */
export const COACH_HALL_BAR = 300;

export const inTheHall = (legend: { score: number }): boolean => legend.score >= COACH_HALL_BAR;
