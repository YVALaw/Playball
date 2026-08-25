// achievements.ts
// Ten things a coach can only do once.
//
// The distinction against the record book next door is the whole design, and it
// decides the shape of everything here. A record exists to be broken: it holds a
// value and a holder, and a better one replaces it. An achievement has no value
// and cannot be beaten — you have either won back to back national titles or you
// have not, and doing it a third time does not upgrade anything. So where
// `records.ts` keeps a sparse map of *marks*, this keeps a sparse map of
// *dates*: present means earned, and the entry says when and where.
//
// They belong to the coach rather than to the program, and they travel with him,
// which is the other half of the difference. The book is the league's; this is
// one man's.
//
// The awkward part is *when*. A comeback is a fact about the seventh inning of
// one Tuesday, a streak is a running count that is only ever correct at the
// instant a game ends, a draft pick is a fact about June and a title is a fact
// about the last day of it. A single scan at the end of the year can see none of
// the first two — by then the scoreboard has been thrown away and the streak
// reads whatever the team happened to finish on. So there are four doors, one
// per honest moment, and the two that a season-end scan genuinely cannot reach
// leave a mark on the season as they pass. That is the same trick
// `season.scorelessOuts` already plays for the scoreless-innings record.
//
// **The user's coach only.** Rival coaches have careers now (B7) and could in
// principle earn these, but nothing would ever read them: there is no screen for
// another man's cabinet, and the inbox announcing that a coach in the Mountain
// conference had just gone twenty in a row would be noise rather than news. A
// list nobody reads is still a list that has to be written to disk ninety five
// times a year.

/** Every one of them, in the order the screen lists them. */
export type AchievementId =
  | 'perfectConference'
  | 'cinderella'
  | 'dynasty'
  | 'grandSlam'
  | 'lifer'
  | 'builder'
  | 'kingmaker'
  | 'recruiter'
  | 'ironWill'
  | 'streak';

export interface AchievementSpec {
  /** What it is called. */
  name: string;
  /** What it takes, in the words the screen uses while it is still unearned. */
  note: string;
}

/**
 * Fifteen years in one chair.
 *
 * Lives here rather than beside `coachStanding`, which is the other thing that
 * reads it, because the number is the definition of an achievement and the
 * standing flag is a second reading of the same fact. Two constants would
 * eventually be two different numbers on two screens.
 */
export const LIFER_SEASONS = 15;

/** How far behind he has to have been for a win to be worth remembering. */
export const IRON_WILL_DEFICIT = 6;

/** Consecutive wins. */
export const STREAK_WINS = 20;

/** The most a program can be worth and still have its title read as a shock. */
export const CINDERELLA_STARS = 2;

export const ACHIEVEMENTS: Record<AchievementId, AchievementSpec> = {
  perfectConference: {
    name: 'Perfect Conference',
    note: 'Go through league play without losing a game.',
  },
  cinderella: {
    name: 'Cinderella',
    note: `Win the national title at a program of ${CINDERELLA_STARS} stars or fewer.`,
  },
  dynasty: {
    name: 'Dynasty',
    note: 'Win the national title in consecutive seasons.',
  },
  grandSlam: {
    name: 'Grand Slam',
    note: 'Win the conference, the regional and the national title in one year.',
  },
  lifer: {
    name: 'Lifer',
    note: `Coach ${LIFER_SEASONS} seasons at the same school.`,
  },
  builder: {
    name: 'Builder',
    note: 'Take a one star program to five without leaving.',
  },
  kingmaker: {
    name: 'Kingmaker',
    note: 'Have one of your men taken first overall in the draft.',
  },
  recruiter: {
    name: 'Recruiter',
    note: 'Sign the number one recruit in the country.',
  },
  ironWill: {
    name: 'Iron Will',
    note: `Win a game after trailing by ${IRON_WILL_DEFICIT} runs or more.`,
  },
  streak: {
    name: 'Streak',
    note: `Win ${STREAK_WINS} games in a row.`,
  },
};

/** Every id, in book order. */
export const ACHIEVEMENT_IDS =
  Object.keys(ACHIEVEMENTS) as readonly AchievementId[];

/** When and where. There is nothing to compare, so there is nothing else. */
export interface Earned {
  year: number;
  /** The program's abbreviation. He may not be there any more. */
  team: string;
  /** The line under the name: "33-0 in the GULF", "back from 7 down". */
  detail?: string;
}

/**
 * A cabinet, as a sparse map. Absent means unearned, which is a state the screen
 * prints honestly rather than as a zero.
 */
export type AchievementLog = Partial<Record<AchievementId, Earned>>;

/**
 * Hang one up. False if it was already there.
 *
 * **First time wins, and the first time is never overwritten.** This is the one
 * rule that makes an achievement different from a record: the book gives a tie
 * to the incumbent because a mark has to be *beaten*, and here there is nothing
 * to beat, so the second occurrence is not a candidate at all. A coach who wins
 * back to back titles twice keeps the year he first did it.
 */
export function award(
  log: AchievementLog, id: AchievementId, earned: Earned,
): boolean {
  if (log[id]) return false;
  log[id] = earned;
  return true;
}

/**
 * A cabinet off the disk, with anything that is not one of ours thrown away.
 *
 * A save is structured-cloned straight back in, so a key renamed in a later
 * build would come back as a row the screen cannot name and cannot draw. The
 * filter is cheap and it is the difference between a stale key being ignored and
 * it reaching a `Record` lookup that returns undefined three components deep.
 */
export function restoreAchievements(saved: unknown): AchievementLog {
  if (!saved || typeof saved !== 'object') return {};
  const out: AchievementLog = {};
  for (const id of ACHIEVEMENT_IDS) {
    const row = (saved as AchievementLog)[id];
    if (!row || typeof row !== 'object') continue;
    if (typeof row.year !== 'number' || typeof row.team !== 'string') continue;
    out[id] = {
      year: row.year,
      team: row.team,
      ...(typeof row.detail === 'string' ? { detail: row.detail } : {}),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// The door a game comes through
// ---------------------------------------------------------------------------

/**
 * What one season noticed that only a finished game could have told it.
 *
 * Two running numbers, for the user's program alone, reset with the season. They
 * are not achievements — they are the evidence, kept because the evidence is
 * destroyed at the final out. The season-end pass reads them and decides.
 */
export interface SeasonFeats {
  /** The largest deficit he has come back from and won. */
  comeback: number;
  /** The longest winning streak of the year, whether or not it is still alive. */
  streak: number;
}

export const noFeats = (): SeasonFeats => ({ comeback: 0, streak: 0 });

/**
 * The biggest number the scoreboard ever showed against him.
 *
 * Walked half inning by half inning rather than by whole innings, because the
 * deficit a team actually stared at is the one that existed while it was batting
 * — a side that goes down seven in the top of the first and answers with eight
 * in the bottom was never behind on a whole-inning reading, and it plainly was.
 *
 * The two line scores can differ in length by one: the home half of the last
 * inning is not played when the home side is already ahead.
 */
export function largestDeficit(
  mine: readonly number[], theirs: readonly number[], iAmHome: boolean,
): number {
  let me = 0;
  let them = 0;
  let worst = 0;
  const innings = Math.max(mine.length, theirs.length);
  for (let i = 0; i < innings; i++) {
    // The away side bats first, so whichever line that is lands on the board
    // before the other one in every single inning.
    const first = iAmHome ? (theirs[i] ?? 0) : (mine[i] ?? 0);
    const second = iAmHome ? (mine[i] ?? 0) : (theirs[i] ?? 0);
    if (iAmHome) them += first; else me += first;
    worst = Math.max(worst, them - me);
    if (iAmHome) me += second; else them += second;
    worst = Math.max(worst, them - me);
  }
  return worst;
}

/** One finished game, folded into the evidence. */
export function noteGame(
  feats: SeasonFeats,
  won: boolean,
  /** The winner's running streak, or anything at all on a loss. */
  streak: number,
  deficit: number,
): void {
  if (!won) return;
  feats.streak = Math.max(feats.streak, streak);
  feats.comeback = Math.max(feats.comeback, deficit);
}

// ---------------------------------------------------------------------------
// The door a finished season comes through
// ---------------------------------------------------------------------------

/**
 * Everything the season-end pass needs, assembled by the caller.
 *
 * A flat bag of facts rather than the store's own objects on purpose: it keeps
 * this module free of `SeasonOutcome`, `CoachState` and `SeasonState`, none of
 * which it has any business knowing about, and it is what lets a test hand it
 * ten fields and check one rule.
 */
export interface SeasonFacts {
  year: number;
  /** The program's abbreviation, for the line under the name. */
  team: string;
  /** Its conference, for the same reason. */
  conference: string;
  /** League play only. `losses` of zero with `wins` above zero is the perfect one. */
  conferenceWins: number;
  conferenceLosses: number;
  wonConference: boolean;
  wonRegional: boolean;
  wonTitle: boolean;
  /** Whether he won it the year before as well, at this program or another. */
  titleLastYear: boolean;
  /** Star tier of the program this season, and on the day he arrived. */
  stars: number;
  arrivedStars: number;
  /** Seasons at this school, this one counted. */
  tenure: number;
  feats: SeasonFeats;
}

/**
 * Everything a finished season can hang up, in one pass.
 *
 * Returns what was *newly* earned, in book order, which is what the inbox needs
 * — a coach who wins his second title should not be told again about Cinderella.
 */
export function awardSeason(log: AchievementLog, f: SeasonFacts): AchievementId[] {
  const got: AchievementId[] = [];
  const hang = (id: AchievementId, detail?: string): void => {
    if (award(log, id, { year: f.year, team: f.team, ...(detail ? { detail } : {}) })) {
      got.push(id);
    }
  };

  // A program with no conference games played has not gone undefeated in league
  // play, it has not played any — which is the state a test fixture arrives in
  // and, more usefully, the state a season abandoned in March would be in.
  if (f.conferenceWins > 0 && f.conferenceLosses === 0) {
    hang('perfectConference', `${f.conferenceWins}-0 in the ${f.conference}`);
  }

  if (f.wonTitle && f.stars <= CINDERELLA_STARS) {
    hang('cinderella', `${f.stars} star program`);
  }
  if (f.wonTitle && f.titleLastYear) hang('dynasty', 'back to back');
  if (f.wonTitle && f.wonConference && f.wonRegional) {
    hang('grandSlam', `${f.conference}, region and country`);
  }

  if (f.tenure >= LIFER_SEASONS) {
    hang('lifer', `${f.tenure} seasons at one school`);
  }
  // Both ends of the journey, at the same school. `arrivedStars` is reset every
  // time he takes a chair, so a man who inherits a five star program has nothing
  // to build and cannot collect this by standing still.
  if (f.arrivedStars <= 1 && f.stars >= 5) {
    hang('builder', `one star to five in ${f.tenure}`);
  }

  if (f.feats.comeback >= IRON_WILL_DEFICIT) {
    hang('ironWill', `back from ${f.feats.comeback} down`);
  }
  if (f.feats.streak >= STREAK_WINS) {
    hang('streak', `${f.feats.streak} straight`);
  }

  return got;
}

// ---------------------------------------------------------------------------
// The two that belong to the offseason
// ---------------------------------------------------------------------------

/**
 * The first name off the national board, if he was one of yours.
 *
 * The caller answers "was he mine", because whose he was is a fact about the
 * dynasty and not about the draft.
 */
export function awardFirstOverall(
  log: AchievementLog, year: number, team: string, name: string,
): AchievementId[] {
  return award(log, 'kingmaker', { year, team, detail: name }) ? ['kingmaker'] : [];
}

/** The number one recruit in the country, signed. */
export function awardTopRecruit(
  log: AchievementLog, year: number, team: string, name: string,
): AchievementId[] {
  return award(log, 'recruiter', { year, team, detail: name }) ? ['recruiter'] : [];
}
