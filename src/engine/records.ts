// records.ts
// The all-time book: league-wide, ninety-six programs, roughly forty rows.
//
// The whole thing rests on one observation. A record book does not need the
// seasons, it needs the *holders* — a value, the man who set it, his program and
// the year. Every finished game already passes through `recordResult`, so a
// candidate can be offered against the standing mark as it happens and thrown
// away the instant it fails to beat it. Storing every player's line across
// ninety-six rosters is what would be expensive, and none of it is necessary to
// answer "who hit the most home runs anybody ever hit here".
//
// Career records are deliberately not here. They need archiving widened past the
// user's own program, which is the one genuinely expensive piece (B13), and the
// screen says so rather than showing an empty section that looks like a bug.

import type { GameResult, TeamState } from './game.js';
import type { PlayerId } from './types.js';

/** One standing mark. Everything the book knows about a record. */
export interface RecordMark {
  value: number;
  /** The man, or the program where the program is the one who did it. */
  holder: string;
  /** His program: our abbreviation, or a real school on a seeded mark. */
  team: string;
  year: number;
  /**
   * Whose it is, so the card can be opened. Absent on team marks, on coach
   * marks, and on every seeded one — Pete Incaviglia does not have a card.
   */
  id?: PlayerId;
  /** The line behind the number: "48 in 75 games", "vs TEX, 12 K". */
  detail?: string;
  /**
   * Set on a mark that came out of the real NCAA book rather than out of this
   * dynasty. The distinction is the point of seeding: a record with nobody's
   * name against it is a blank, and a record with Incaviglia's name against it
   * is a target.
   */
  ncaa?: boolean;
}

export type RecordGroup = 'game' | 'feat' | 'season' | 'team' | 'coach';

export type RecordKey =
  // single game, player
  | 'gameHR' | 'gameHits' | 'gameRBI' | 'gameRuns' | 'gameSB' | 'gameK'
  // single game, the ones that are not a number
  | 'featNoHitter' | 'featPerfect' | 'featShutout'
  // single season, hitting
  | 'seasonAvg' | 'seasonHR' | 'seasonRBI' | 'seasonHits' | 'seasonRuns'
  | 'seasonSB' | 'seasonDoubles' | 'seasonTriples' | 'seasonTB' | 'seasonSlg'
  | 'seasonHitStreak'
  // single season, pitching
  | 'seasonERA' | 'seasonWHIP' | 'seasonK' | 'seasonWins' | 'seasonSaves'
  | 'seasonIP' | 'seasonK9' | 'seasonScoreless'
  // team
  | 'teamGameRuns' | 'teamGameHits' | 'teamGameMargin'
  | 'teamSeasonWins' | 'teamSeasonDiff' | 'teamSeasonStreak'
  // coach
  | 'coachWins' | 'coachTitles' | 'coachRegionals' | 'coachConfTitles'
  | 'coachTournaments';

/** How a value is written down. The UI reads it; nothing else does. */
export type RecordShape = 'count' | 'avg' | 'era' | 'tenth' | 'innings';

export interface RecordSpec {
  group: RecordGroup;
  label: string;
  /** Lower is better. True for exactly two records, ERA and WHIP. */
  ascending?: boolean;
  shape: RecordShape;
  /**
   * Why this row can never change hands, where that is true by construction
   * rather than by nobody having managed it yet. Shown instead of a hint that
   * the mark is in reach, because telling a player to chase something a 45-game
   * season cannot arithmetically hold is a lie the screen would be telling.
   */
  frozen?: string;
}

/**
 * The book, in the order it reads. A category with no entry is genuinely unset:
 * nobody has done it and no real mark was verified for it, and the screen says
 * so rather than inventing a holder.
 */
export const RECORDS: Record<RecordKey, RecordSpec> = {
  gameHR: { group: 'game', label: 'HOME RUNS', shape: 'count' },
  gameHits: { group: 'game', label: 'HITS', shape: 'count' },
  gameRBI: { group: 'game', label: 'RUNS BATTED IN', shape: 'count' },
  gameRuns: { group: 'game', label: 'RUNS SCORED', shape: 'count' },
  gameSB: { group: 'game', label: 'STOLEN BASES', shape: 'count' },
  gameK: { group: 'game', label: 'STRIKEOUTS, PITCHER', shape: 'count' },

  featPerfect: { group: 'feat', label: 'PERFECT GAMES', shape: 'count' },
  featNoHitter: { group: 'feat', label: 'NO-HITTERS', shape: 'count' },
  featShutout: { group: 'feat', label: 'COMPLETE GAME SHUTOUTS', shape: 'count' },

  seasonAvg: { group: 'season', label: 'BATTING AVERAGE', shape: 'avg' },
  seasonHR: { group: 'season', label: 'HOME RUNS', shape: 'count' },
  seasonRBI: { group: 'season', label: 'RUNS BATTED IN', shape: 'count' },
  seasonHits: { group: 'season', label: 'HITS', shape: 'count' },
  seasonRuns: { group: 'season', label: 'RUNS', shape: 'count' },
  seasonSB: { group: 'season', label: 'STOLEN BASES', shape: 'count' },
  seasonDoubles: { group: 'season', label: 'DOUBLES', shape: 'count' },
  seasonTriples: { group: 'season', label: 'TRIPLES', shape: 'count' },
  seasonTB: { group: 'season', label: 'TOTAL BASES', shape: 'count' },
  seasonSlg: { group: 'season', label: 'SLUGGING', shape: 'avg' },
  seasonHitStreak: {
    group: 'season', label: 'CONSECUTIVE GAMES HITTING', shape: 'count',
    frozen: 'A 45-game season cannot hold 58. This one is here to be admired.',
  },
  seasonERA: { group: 'season', label: 'EARNED RUN AVERAGE', shape: 'era', ascending: true },
  seasonWHIP: { group: 'season', label: 'WALKS AND HITS PER INNING', shape: 'era', ascending: true },
  seasonK: { group: 'season', label: 'STRIKEOUTS', shape: 'count' },
  seasonWins: { group: 'season', label: 'WINS', shape: 'count' },
  seasonSaves: { group: 'season', label: 'SAVES', shape: 'count' },
  seasonIP: { group: 'season', label: 'INNINGS PITCHED', shape: 'innings' },
  seasonK9: { group: 'season', label: 'STRIKEOUTS PER NINE', shape: 'tenth' },
  seasonScoreless: { group: 'season', label: 'CONSECUTIVE SCORELESS INNINGS', shape: 'count' },

  teamGameRuns: { group: 'team', label: 'RUNS, GAME', shape: 'count' },
  teamGameHits: { group: 'team', label: 'HITS, GAME', shape: 'count' },
  teamGameMargin: { group: 'team', label: 'MARGIN OF VICTORY', shape: 'count' },
  teamSeasonWins: { group: 'team', label: 'WINS, SEASON', shape: 'count' },
  teamSeasonDiff: { group: 'team', label: 'RUN DIFFERENTIAL, SEASON', shape: 'count' },
  teamSeasonStreak: { group: 'team', label: 'WINNING STREAK', shape: 'count' },

  coachWins: { group: 'coach', label: 'CAREER WINS', shape: 'count' },
  coachTitles: { group: 'coach', label: 'NATIONAL TITLES', shape: 'count' },
  // Between the national and the conference row, which is where it sits in the
  // pyramid: win your league, win your region, win the country. Its absence was
  // the whole of B6 — the postseason had a regional round and nothing in the
  // game counted winning one.
  coachRegionals: { group: 'coach', label: 'REGIONAL TITLES', shape: 'count' },
  coachConfTitles: { group: 'coach', label: 'CONFERENCE TITLES', shape: 'count' },
  coachTournaments: { group: 'coach', label: 'TOURNAMENT APPEARANCES', shape: 'count' },
};

/** Every key of one group, in book order. */
export const recordsIn = (group: RecordGroup): RecordKey[] =>
  (Object.keys(RECORDS) as RecordKey[]).filter((k) => RECORDS[k].group === group);

/**
 * A book is a sparse map of holders. Absent means unset, which is a state the
 * screen prints honestly — it is not the same as zero, and a category nobody has
 * ever managed should read as open rather than as held by a man with none.
 */
export type RecordBook = Partial<Record<RecordKey, RecordMark>>;

/**
 * Offer a candidate. True if it took the record.
 *
 * **Ties go to the incumbent**: a mark has to be beaten, not equalled. That is
 * the rule the seeded marks need — matching Incaviglia is not passing him — and
 * it is also the only rule whose answer does not depend on the order two
 * identical performances happened to be evaluated in, which across ninety-six
 * programs playing the same afternoon is not a fact anybody should have to
 * reason about.
 */
export function offer(book: RecordBook, key: RecordKey, mark: RecordMark): boolean {
  const held = book[key];
  if (held) {
    const better = RECORDS[key].ascending
      ? mark.value < held.value
      : mark.value > held.value;
    if (!better) return false;
  }
  book[key] = mark;
  return true;
}

/**
 * The three that are not quantities.
 *
 * A no-hitter is not more or less than another no-hitter, so there is nothing to
 * rank and nothing to beat. What a book can honestly keep is how many have been
 * thrown and who threw the last one, which is what this does: the value is the
 * running count, so a new one always beats the standing row by exactly one, and
 * the name on it is the most recent man rather than a permanent owner.
 */
function tally(book: RecordBook, key: RecordKey, mark: Omit<RecordMark, 'value'>): void {
  offer(book, key, { ...mark, value: (book[key]?.value ?? 0) + 1 });
}

// ---------------------------------------------------------------------------
// The seeded marks
// ---------------------------------------------------------------------------

/**
 * Our season, in games: eleven three-game conference series plus twelve midweek.
 *
 * Written down here rather than read from `seasonLength(DEFAULT_SEASON)`, which
 * lives in the module that imports this one. A test asserts the two agree, so
 * the duplication cannot rot in silence.
 */
export const BOOK_SEASON_GAMES = 45;

/**
 * The length of the season a real mark was set in, where the source does not say.
 *
 * Seventy five: the top of the 56-to-75 band, and the length of both seasons
 * that *are* recorded below. Guessing high scales a mark down, which is the safe
 * direction — the entire reason for seeding is to give a dynasty something to
 * chase, and a mark pitched too high is furniture.
 */
const ERA_GAMES = 75;

/**
 * A counting mark, in our season. Rate marks are not passed through here:
 * a .400 average means the same thing in a 45-game season as in a 75-game one.
 */
const scaled = (real: number, games: number): number =>
  Math.round((real * BOOK_SEASON_GAMES) / games);

/**
 * The real marks, scaled, exactly as agreed in `docs/06-backlog.md`.
 *
 * The arithmetic, all of it, so nobody has to re-derive it:
 *
 * | Mark | Real | Games | Scaled |
 * |---|---|---|---|
 * | Home runs, Incaviglia 1985 | 48 | 75 | 48 × 45/75 = 28.8 → **29** |
 * | RBI, Incaviglia 1985 | 143 | 75 | 143 × 45/75 = 85.8 → **86** |
 * | Total bases, Incaviglia 1985 | 285 | 75 | 285 × 45/75 = **171** |
 * | Triples, Hagman 1980 | 17 | 63 | 17 × 45/63 = 12.1 → **12** |
 * | Doubles, Hawpe 2000 | 36 | 75* | 36 × 45/75 = 21.6 → **22** |
 * | Wins, Loynd 1986 | 20 | 75* | 20 × 45/75 = **12** |
 * | Innings, Bannister 1976 | 186 | 75* | 186 × 45/75 = 111.6 → **112** |
 * | Scoreless innings, Helton 1994 | 47 | 75* | 47 × 45/75 = 28.2 → **28** |
 *
 * An asterisk is a season length the source does not record; see `ERA_GAMES`.
 * Batting average (.551), slugging (1.140) and strikeouts per nine (16.8) are
 * rates and are taken as they stand.
 *
 * **Ventura's 58-game hitting streak keeps its real value on purpose.** Forty
 * five games cannot hold fifty eight, so the mark can never change hands, and
 * that is the point of it: one untouchable record that exists to be admired is
 * good, and more than one turns a game system into a museum. It is the only row
 * in the book carrying `frozen`, and nothing computes a candidate for it — there
 * is no arrangement of a 45-game season that would produce one.
 *
 * **One conflict left open.** Incaviglia's 1985 home run total is 48 in Wikipedia
 * and 45 in The Hardball Times. 48 is used, and the detail line says so.
 *
 * **What the engine can currently reach.** One simulated season of 96 programs
 * produced these league bests: 9 HR, 56 RBI, 111 total bases, .427 average, .678
 * slugging, 5 triples, 18 doubles, 11 wins, 96 innings, 10.9 K/9. So seven of
 * the twelve seeds are out of reach of the offensive environment as it stands —
 * these were set with aluminium bats in the 1980s and the engine is calibrated
 * to modern Division I run scoring. Scaling by games played is the decision on
 * record and this follows it; the gap is written down so it can be revisited
 * with numbers instead of rediscovered.
 */
const SEEDS: Partial<Record<RecordKey, RecordMark>> = {
  seasonAvg: {
    value: 0.551, holder: 'Keith Hagman', team: 'New Mexico', year: 1980,
    detail: '125-for-227', ncaa: true,
  },
  seasonHR: {
    value: scaled(48, ERA_GAMES), holder: 'Pete Incaviglia',
    team: 'Oklahoma State', year: 1985,
    detail: 'real mark 48 in 75 games — sources give 48 or 45', ncaa: true,
  },
  seasonRBI: {
    value: scaled(143, ERA_GAMES), holder: 'Pete Incaviglia',
    team: 'Oklahoma State', year: 1985, detail: 'real mark 143 in 75 games', ncaa: true,
  },
  seasonTB: {
    value: scaled(285, ERA_GAMES), holder: 'Pete Incaviglia',
    team: 'Oklahoma State', year: 1985, detail: 'real mark 285 in 75 games', ncaa: true,
  },
  seasonSlg: {
    value: 1.140, holder: 'Pete Incaviglia', team: 'Oklahoma State', year: 1985,
    ncaa: true,
  },
  seasonTriples: {
    value: scaled(17, 63), holder: 'Keith Hagman', team: 'New Mexico', year: 1980,
    detail: 'real mark 17 in 63 games', ncaa: true,
  },
  seasonDoubles: {
    value: scaled(36, ERA_GAMES), holder: 'Brad Hawpe', team: 'LSU', year: 2000,
    detail: 'real mark 36', ncaa: true,
  },
  seasonHitStreak: {
    value: 58, holder: 'Robin Ventura', team: 'Oklahoma State', year: 1987,
    ncaa: true,
  },
  seasonWins: {
    value: scaled(20, ERA_GAMES), holder: 'Mike Loynd', team: 'Florida State',
    year: 1986, detail: 'real mark 20', ncaa: true,
  },
  seasonIP: {
    value: scaled(186, ERA_GAMES), holder: 'Floyd Bannister',
    team: 'Arizona State', year: 1976, detail: 'real mark 186', ncaa: true,
  },
  seasonK9: {
    value: 16.8, holder: 'Ryan Wagner', team: 'Houston', year: 2003,
    ncaa: true,
  },
  seasonScoreless: {
    value: scaled(47, ERA_GAMES), holder: 'Todd Helton', team: 'Tennessee',
    year: 1994, detail: 'real mark 47 straight', ncaa: true,
  },
};

/**
 * A book with the real marks already in it.
 *
 * Fresh objects every call. The seeds are module-level constants and a book is
 * mutated in place all season, so handing out the same rows twice would let one
 * dynasty rewrite another's history.
 */
export function seededBook(): RecordBook {
  const book: RecordBook = {};
  for (const [key, mark] of Object.entries(SEEDS)) {
    book[key as RecordKey] = { ...mark };
  }
  return book;
}

// ---------------------------------------------------------------------------
// What one finished game puts in the book
// ---------------------------------------------------------------------------

/** A program, as the book needs to name it. */
export interface BookSide {
  abbr: string;
  school: string;
}

/**
 * Everything one game can add, checked as it is folded into the season.
 *
 * Here rather than in a season-end pass because a single-game mark is gone by
 * then: the box score of a Tuesday in the Mountain conference is never written
 * down, and the per-player lines this reads exist for about a microsecond. Both
 * teams are in hand, which is what makes the book league-wide for free.
 */
export function recordGameMarks(
  book: RecordBook,
  year: number,
  home: BookSide,
  away: BookSide,
  result: GameResult,
): void {
  const sides: Array<{ mine: TeamState; me: BookSide; them: BookSide; theirs: TeamState }> = [
    { mine: result.home, me: home, them: away, theirs: result.away },
    { mine: result.away, me: away, them: home, theirs: result.home },
  ];

  for (const { mine, me, them, theirs } of sides) {
    const vs = `vs ${them.abbr}`;

    for (const line of mine.batting.values()) {
      const who = {
        holder: line.player.name, team: me.abbr, year,
        id: line.player.id, detail: vs,
      };
      if (line.hr > 0) offer(book, 'gameHR', { ...who, value: line.hr });
      if (line.h > 0) offer(book, 'gameHits', { ...who, value: line.h });
      if (line.rbi > 0) offer(book, 'gameRBI', { ...who, value: line.rbi });
      if (line.r > 0) offer(book, 'gameRuns', { ...who, value: line.r });
      if (line.sb > 0) offer(book, 'gameSB', { ...who, value: line.sb });
    }

    // Every out this side's staff recorded, so "he went the distance" is a
    // comparison rather than a guess at how long the game was. A road pitcher in
    // a home win throws eight, and the feats below all want nine.
    let staffOuts = 0;
    for (const line of mine.pitching.values()) staffOuts += line.outs;

    for (const line of mine.pitching.values()) {
      const who = {
        holder: line.player.name, team: me.abbr, year,
        id: line.player.id, detail: vs,
      };
      if (line.k > 0) offer(book, 'gameK', { ...who, value: line.k });

      // A complete game, by the only definition available here: he recorded
      // every out his side recorded, and there were at least nine innings of
      // them. The nine-inning floor is the real rule and it also disposes of the
      // shortened road start, which is a complete game and is not a no-hitter.
      if (line.outs !== staffOuts || line.outs < 27) continue;

      const ip = `${Math.floor(line.outs / 3)}.${line.outs % 3} IP, ${line.k} K`;
      // Nobody reached, by any route: `bf` counts every man he faced, so a
      // walk, a hit batsman or a man on by error all show up as a batter faced
      // who was not retired. That is the perfect game rule, in one comparison.
      if (theirs.hits === 0 && line.bf === line.outs) {
        tally(book, 'featPerfect', { ...who, detail: `${ip}, perfect ${vs}` });
      }
      if (theirs.hits === 0) {
        tally(book, 'featNoHitter', { ...who, detail: `${ip} ${vs}` });
      }
      if (theirs.runs === 0) {
        tally(book, 'featShutout', { ...who, detail: `${ip} ${vs}` });
      }
    }

    const team = { holder: me.school, team: me.abbr, year, detail: vs };
    offer(book, 'teamGameRuns', { ...team, value: mine.runs });
    offer(book, 'teamGameHits', { ...team, value: mine.hits });
    if (mine.runs > theirs.runs) {
      offer(book, 'teamGameMargin', {
        ...team, value: mine.runs - theirs.runs,
        detail: `${mine.runs}-${theirs.runs} ${vs}`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// The coach
// ---------------------------------------------------------------------------

/**
 * What the book reads off a career.
 *
 * `CoachState` satisfies it and so does `RivalCoach`, which is the point of the
 * shape: the coaching section cannot end up describing your career off one set
 * of counters and everybody else's off another.
 */
export interface BookCoach {
  name: string;
  careerWins: number;
  careerLosses: number;
  titles: number;
  conferenceTitles: number;
  regionalTitles: number;
  tournaments: number;
}

/**
 * A career, offered to the book at the close of each season.
 *
 * **All ninety six of them now.** This used to be yours alone, and the comment
 * here said so honestly: the other ninety five programs had no coach object
 * behind them, so a rival bench was a strategy and a prestige number rather than
 * a man with a record. B7 made them men with records, and a coaching section
 * that still ranked one career against nothing would have been telling the
 * player he held every mark in the country by default — which is the opposite of
 * what a record book is for.
 *
 * Ninety six calls a year of five comparisons each. It is the cheapest thing in
 * the offseason by some distance.
 */
export function recordCoachMarks(
  book: RecordBook, year: number, coach: BookCoach, team: string,
): void {
  const who = { holder: coach.name, team, year };
  offer(book, 'coachWins', {
    ...who, value: coach.careerWins,
    detail: `${coach.careerWins}-${coach.careerLosses}`,
  });
  if (coach.titles > 0) offer(book, 'coachTitles', { ...who, value: coach.titles });
  if (coach.regionalTitles > 0) {
    offer(book, 'coachRegionals', { ...who, value: coach.regionalTitles });
  }
  if (coach.conferenceTitles > 0) {
    offer(book, 'coachConfTitles', { ...who, value: coach.conferenceTitles });
  }
  if (coach.tournaments > 0) {
    offer(book, 'coachTournaments', { ...who, value: coach.tournaments });
  }
}
