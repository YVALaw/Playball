// records.test.ts
// The all-time book.
//
// Four things here are worth more than the rest. A mark must be *beaten* rather
// than matched, or the seeded NCAA records fall to the first man who ties them.
// The book must be league-wide, or it is the program record book that already
// exists one tab away. It must survive a save, because the save record is
// assembled field by field and this project has lost data to exactly that twice.
// And a dynasty that predates the book must open with the seeded marks rather
// than a page of blanks, which is not the same rule the other backfills follow.

import { describe, it, expect } from 'vitest';
import {
  createSeason, simNextDay, recordSeasonMarks, recordCareerMarks, seasonLength,
  nextSeason, DEFAULT_SEASON, type SeasonState,
} from '../src/engine/season.js';
import {
  BOOK_SEASON_GAMES, CAREER_MIN_AB, RECORDS, offer, recordGameMarks,
  recordCoachMarks, seededBook, recordsIn, type RecordBook, type RecordKey,
} from '../src/engine/records.js';
import { restoreCoach, type CoachState } from '../src/engine/program.js';
import { TeamState, type GameResult } from '../src/engine/game.js';
import { makeTeam } from '../src/engine/players.js';
import { makeRng } from '../src/engine/rng.js';
import { buildSaveFile } from '../src/state/persistence.js';
import { toPortable, fromPortable } from '../src/state/seasonCodec.js';

const world = (seed = 7171): SeasonState => {
  const s = createSeason(makeRng(seed));
  s.year = 2027;
  return s;
};

// ---------------------------------------------------------------------------

describe('the seeded marks', () => {
  it('are in the book of a brand new dynasty', () => {
    const book = world().records ?? {};
    expect(book.seasonHR?.holder).toBe('Pete Incaviglia');
    expect(book.seasonAvg?.holder).toBe('Keith Hagman');
    expect(book.seasonWins?.holder).toBe('Mike Loynd');
    expect(book.seasonIP?.holder).toBe('Floyd Bannister');
    expect(book.seasonK9?.holder).toBe('Ryan Wagner');
    expect(book.seasonScoreless?.holder).toBe('Todd Helton');
  });

  it('are all flagged as real-world marks', () => {
    for (const mark of Object.values(seededBook())) expect(mark.ncaa).toBe(true);
  });

  it('scales counting records by games played and leaves rates alone', () => {
    const book = seededBook();
    // The season the scaling is against has to be the season actually played.
    expect(BOOK_SEASON_GAMES).toBe(seasonLength(DEFAULT_SEASON));

    expect(book.seasonHR?.value).toBe(29);       // 48 in 75 → 48 × 45/75 = 28.8
    expect(book.seasonRBI?.value).toBe(86);      // 143 in 75 → 85.8
    expect(book.seasonTB?.value).toBe(171);      // 285 in 75
    expect(book.seasonTriples?.value).toBe(12);  // 17 in 63 → 12.1
    expect(book.seasonDoubles?.value).toBe(22);  // 36 → 21.6
    expect(book.seasonWins?.value).toBe(12);     // 20 → 12
    expect(book.seasonIP?.value).toBe(112);      // 186 → 111.6
    expect(book.seasonScoreless?.value).toBe(28);// 47 → 28.2

    expect(book.seasonAvg?.value).toBeCloseTo(0.551, 5);
    expect(book.seasonSlg?.value).toBeCloseTo(1.140, 5);
    expect(book.seasonK9?.value).toBeCloseTo(16.8, 5);
  });

  it('keeps Ventura at his real number, and marks it as the one out of reach', () => {
    const book = seededBook();
    expect(book.seasonHitStreak?.value).toBe(58);
    expect(book.seasonHitStreak?.value).toBeGreaterThan(BOOK_SEASON_GAMES);
    // Exactly one row in the book is allowed to be unreachable by construction.
    const frozen = (Object.keys(RECORDS) as RecordKey[])
      .filter((k) => RECORDS[k].frozen !== undefined);
    expect(frozen).toEqual(['seasonHitStreak']);
  });

  it('hands out fresh rows, so one dynasty cannot rewrite another', () => {
    const a = seededBook();
    const b = seededBook();
    (a.seasonHR as { value: number }).value = 99;
    expect(b.seasonHR?.value).toBe(29);
  });

  it('leaves a category with no verified mark genuinely unset', () => {
    const book = seededBook();
    // Nothing was invented for these, so the first man to do it takes them.
    expect(book.seasonHits).toBeUndefined();
    expect(book.seasonERA).toBeUndefined();
    expect(book.gameHR).toBeUndefined();
    expect(book.teamSeasonWins).toBeUndefined();
    expect(book.coachWins).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('taking a record', () => {
  const mark = (value: number) => ({ value, holder: 'A', team: 'AAA', year: 2027 });

  it('takes it when beaten', () => {
    const book: RecordBook = { gameHR: mark(3) };
    expect(offer(book, 'gameHR', { ...mark(4), holder: 'B' })).toBe(true);
    expect(book.gameHR?.holder).toBe('B');
  });

  it('leaves it alone when equalled', () => {
    const book: RecordBook = { gameHR: mark(3) };
    expect(offer(book, 'gameHR', { ...mark(3), holder: 'B' })).toBe(false);
    expect(book.gameHR?.holder).toBe('A');
  });

  it('reads the two ascending records the other way up', () => {
    const book: RecordBook = { seasonERA: mark(2.0) };
    expect(offer(book, 'seasonERA', { ...mark(2.5), holder: 'B' })).toBe(false);
    expect(offer(book, 'seasonERA', { ...mark(2.0), holder: 'B' })).toBe(false);
    expect(offer(book, 'seasonERA', { ...mark(1.9), holder: 'B' })).toBe(true);
    expect(book.seasonERA?.holder).toBe('B');
  });

  it('will not let a tie unseat a seeded mark', () => {
    const book = seededBook();
    expect(offer(book, 'seasonHR', { ...mark(29), holder: 'Somebody' })).toBe(false);
    expect(book.seasonHR?.holder).toBe('Pete Incaviglia');
    expect(offer(book, 'seasonHR', { ...mark(30), holder: 'Somebody' })).toBe(true);
    expect(book.seasonHR?.ncaa).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

/**
 * A finished game, built by hand.
 *
 * Assembling the two sides directly is the only way to test a no-hitter: they
 * happen roughly once in three thousand games, so waiting for the simulation to
 * produce one is not a test, it is a search.
 */
function stagedGame(
  build: (home: TeamState, away: TeamState) => void,
): GameResult {
  const rng = makeRng(99);
  const home = new TeamState(makeTeam(rng, 'Home Nine', 60), true);
  const away = new TeamState(makeTeam(rng, 'Away Nine', 60), false);
  build(home, away);
  return {
    home, away, innings: 9, log: [], playEvents: [],
    winningPitcher: null, losingPitcher: null,
  };
}

const HOME = { abbr: 'HOM', school: 'Home State' };
const AWAY = { abbr: 'AWY', school: 'Away State' };

describe('single game detection', () => {
  it('finds a no-hitter, and does not call it perfect', () => {
    const book: RecordBook = {};
    const game = stagedGame((home, away) => {
      const arm = home.pitchLine(home.starter);
      arm.outs = 27; arm.bf = 30; arm.k = 9; arm.bb = 3;   // three walks
      home.runs = 2; home.hits = 6;
      away.runs = 0; away.hits = 0;
    });
    recordGameMarks(book, 2027, HOME, AWAY, game);

    expect(book.featNoHitter?.value).toBe(1);
    expect(book.featNoHitter?.team).toBe('HOM');
    expect(book.featPerfect).toBeUndefined();
    // It is a shutout too, because it is one.
    expect(book.featShutout?.value).toBe(1);
  });

  it('finds a perfect game only when nobody reached at all', () => {
    const book: RecordBook = {};
    const game = stagedGame((home, away) => {
      const arm = home.pitchLine(home.starter);
      arm.outs = 27; arm.bf = 27; arm.k = 12;
      home.runs = 1; home.hits = 4;
      away.runs = 0; away.hits = 0;
    });
    recordGameMarks(book, 2027, HOME, AWAY, game);

    expect(book.featPerfect?.value).toBe(1);
    expect(book.featNoHitter?.value).toBe(1);
    expect(book.featShutout?.value).toBe(1);
    expect(book.gameK?.value).toBe(12);
  });

  it('refuses a no-hitter that was not a complete game', () => {
    const book: RecordBook = {};
    const game = stagedGame((home, away) => {
      const starter = home.pitchLine(home.starter);
      const relief = home.pitchLine(home.team.bullpen[0] ?? home.starter);
      starter.outs = 21; starter.bf = 21;
      relief.outs = 6; relief.bf = 6;
      away.runs = 0; away.hits = 0;
      home.runs = 5; home.hits = 9;
    });
    recordGameMarks(book, 2027, HOME, AWAY, game);

    // A combined no-hitter is a real thing and this book does not keep one:
    // the row is about a man, and two men threw it.
    expect(book.featNoHitter).toBeUndefined();
    expect(book.featShutout).toBeUndefined();
  });

  it('refuses a shortened road complete game as a feat', () => {
    const book: RecordBook = {};
    const game = stagedGame((home, away) => {
      // The home team led and never batted in the ninth: eight innings.
      const arm = away.pitchLine(away.starter);
      arm.outs = 24; arm.bf = 24;
      home.runs = 2; home.hits = 5;
      away.runs = 0; away.hits = 0;
    });
    recordGameMarks(book, 2027, HOME, AWAY, game);
    expect(book.featNoHitter).toBeUndefined();
    expect(book.featPerfect).toBeUndefined();
  });

  it('counts feats rather than ranking them, and names the last man', () => {
    const book: RecordBook = {};
    const one = stagedGame((home, away) => {
      const arm = home.pitchLine(home.starter);
      arm.outs = 27; arm.bf = 28; arm.k = 4;
      away.hits = 0; away.runs = 0; home.runs = 1; home.hits = 3;
    });
    recordGameMarks(book, 2027, HOME, AWAY, one);
    const first = book.featNoHitter?.holder;

    const two = stagedGame((home, away) => {
      const arm = away.pitchLine(away.starter);
      arm.outs = 27; arm.bf = 29; arm.k = 2;
      home.hits = 0; home.runs = 0; away.runs = 3; away.hits = 7;
    });
    recordGameMarks(book, 2029, HOME, AWAY, two);

    expect(book.featNoHitter?.value).toBe(2);
    expect(book.featNoHitter?.year).toBe(2029);
    expect(book.featNoHitter?.team).toBe('AWY');
    expect(book.featNoHitter?.holder).not.toBe(first);
  });

  it('takes the team marks from both sides of the same game', () => {
    const book: RecordBook = {};
    const game = stagedGame((home, away) => {
      home.runs = 14; home.hits = 20;
      away.runs = 3; away.hits = 22;
    });
    recordGameMarks(book, 2027, HOME, AWAY, game);

    expect(book.teamGameRuns?.value).toBe(14);
    expect(book.teamGameHits?.value).toBe(22);   // the losing side had more
    expect(book.teamGameHits?.team).toBe('AWY');
    expect(book.teamGameMargin?.value).toBe(11);
    expect(book.teamGameMargin?.team).toBe('HOM');
  });
});

// ---------------------------------------------------------------------------

describe('the season scan', () => {
  it('respects the qualifying minimum on a rate', () => {
    const s = world();
    for (const t of s.teams) t.gp = 45;          // so the bar is 90 plate appearances
    const cameo = s.teams[0]?.team.lineup[0];
    const everyday = s.teams[5]?.team.lineup[0];
    expect(cameo && everyday).toBeTruthy();

    const line = (ab: number, h: number) => ({
      g: 45, ab, r: 0, h, d: 0, t: 0, hr: 0, rbi: 0, bb: 0, k: 0, hbp: 0, sb: 0, cs: 0,
    });
    // Twenty for twenty is a 1.000 average and eighty at bats short of a title.
    s.batting.set(cameo!.id, line(20, 20));
    s.batting.set(everyday!.id, line(200, 130));   // .650, and qualified

    recordSeasonMarks(s, 2027);
    expect(s.records?.seasonAvg?.value).toBeCloseTo(0.65, 5);
    expect(s.records?.seasonAvg?.id).toBe(everyday!.id);
  });

  it('does not hand an unset count to a man with none of them', () => {
    const s = world();
    for (const t of s.teams) t.gp = 45;
    const p = s.teams[0]?.team.lineup[0];
    s.batting.set(p!.id, {
      g: 45, ab: 100, r: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, bb: 0, k: 0,
      hbp: 0, sb: 0, cs: 0,
    });
    recordSeasonMarks(s, 2027);
    expect(s.records?.seasonHits).toBeUndefined();
    expect(s.records?.seasonSB).toBeUndefined();
  });

  it('names a holder off his roster, which is why it runs before the draft', () => {
    // Past Incaviglia's 29, or the seeded mark simply keeps the row.
    const line = {
      g: 45, ab: 200, r: 40, h: 90, d: 10, t: 1, hr: 35, rbi: 95, bb: 20,
      k: 30, hbp: 2, sb: 4, cs: 1,
    };

    const s = world();
    for (const t of s.teams) t.gp = 45;
    const rec = s.teams[3]!;
    const p = rec.team.lineup[0]!;
    s.batting.set(p.id, { ...line });
    recordSeasonMarks(s, 2027);
    expect(s.records?.seasonHR?.holder).toBe(p.name);
    expect(s.records?.seasonHR?.team).toBe(rec.def.abbr);

    // And what the same scan produces once the offseason has taken him off the
    // roster, which is the whole reason the store settles the book on the way
    // into the draft rather than at the year roll: the best season a graduating
    // senior ever has, filed under nobody.
    const after = world();
    for (const t of after.teams) t.gp = 45;
    const gone = after.teams[3]!;
    const q = gone.team.lineup[0]!;
    after.batting.set(q.id, { ...line });
    gone.team.lineup = gone.team.lineup.filter((h) => h !== q);
    recordSeasonMarks(after, 2027);
    expect(after.records?.seasonHR?.team).toBe('---');
  });

  it('reads the whole country and not only one program', () => {
    const s = world();
    for (let d = 0; d < 8; d++) simNextDay(s);
    recordSeasonMarks(s, 2027);

    const ours = s.teams[0]?.def.abbr;
    const dynasty = Object.values(s.records ?? {}).filter((m) => !m.ncaa);
    expect(dynasty.length).toBeGreaterThan(5);

    const programs = new Set(dynasty.map((m) => m.team));
    expect(programs.size).toBeGreaterThan(3);
    // And the point of the whole exercise: most of the book belongs to schools
    // the player does not coach.
    expect([...programs].filter((p) => p !== ours).length).toBeGreaterThan(2);
  });

  it('carries the book across a year roll and empties the streak counter', () => {
    const s = world();
    for (let d = 0; d < 4; d++) simNextDay(s);
    recordSeasonMarks(s, 2027);
    const runs = s.records?.teamGameRuns?.value;

    const next = nextSeason(s);
    expect(next.year).toBe(2028);
    expect(next.records?.teamGameRuns?.value).toBe(runs);
    expect(next.records?.seasonHR?.holder).toBe('Pete Incaviglia');
    expect(next.scorelessOuts?.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------

/**
 * B13. The career section, and the thing it had to prove before it could ship.
 *
 * The expensive reading of "career records league-wide" was to archive every
 * program's seasons the way the user's are archived — measured at seven and a
 * half megabytes after twenty years, and growing. What shipped instead is one
 * running total per man on a roster, pruned the year after he leaves: three
 * hundred kilobytes, and it does not grow. These tests pin the three properties
 * that makes the cheap version honest — it accumulates, it is league-wide, and a
 * man's total is finished rather than lost when he goes.
 */
describe('career records, league-wide', () => {
  /** A season played out, with everybody's line in hand. */
  const season = (seed: number): SeasonState => {
    const s = world(seed);
    for (let d = 0; d < 6; d++) simNextDay(s);
    return s;
  };

  /** The rows with a qualifying minimum on them, and the rows without. */
  const RATES = ['careerAvg', 'careerSlg', 'careerERA'] as const;
  const COUNTS = recordsIn('career').filter((k) => !(RATES as readonly string[]).includes(k));

  it('sets every counting career row off six days, from all over the country', () => {
    const s = season(3131);
    recordCareerMarks(s, 2027);

    for (const key of COUNTS) {
      expect(s.records?.[key], `${key} should be set`).toBeDefined();
    }
    // Nothing in the career section came out of the NCAA book: the real career
    // marks are four times a season mark and would have been furniture.
    for (const key of recordsIn('career')) expect(s.records?.[key]?.ncaa).toBeUndefined();
    // And nobody has anything like two seasons behind him yet, so the three rows
    // with a qualifying minimum are still open. That is the bar working.
    for (const key of RATES) expect(s.records?.[key]).toBeUndefined();

    const holders = new Set(COUNTS.map((k) => s.records?.[k]?.team));
    expect(holders.size).toBeGreaterThan(2);
    expect([...holders].filter((t) => t !== s.teams[0]?.def.abbr).length).toBeGreaterThan(1);
  });

  it('adds a second season onto the first rather than replacing it', () => {
    const s = season(3131);
    recordCareerMarks(s, 2027);
    const first = s.records?.careerHits?.value ?? 0;
    const oneYear = new Map(s.careerTotals);

    // The same men, a second summer. `nextSeason` wipes the statistics and keeps
    // the totals, which is the property the whole design rests on.
    const next = nextSeason(s);
    for (let d = 0; d < 6; d++) simNextDay(next);
    recordCareerMarks(next, 2028);

    const stayed = [...next.careerTotals ?? []].find(([id]) => oneYear.has(id));
    expect(stayed).toBeDefined();
    const [id, after] = stayed!;
    expect(after.y).toBe(2);
    expect(after.h).toBeGreaterThanOrEqual(oneYear.get(id)?.h ?? 0);
    expect(next.records?.careerHits?.value).toBeGreaterThan(first);
  });

  it('does not fold the same season in twice when the rail is walked back', () => {
    // Every other pass over a finished season is idempotent because a mark has
    // to be beaten. A running total is the one thing that is not, and `last` is
    // what makes it so.
    const s = season(3131);
    recordCareerMarks(s, 2027);
    const once = new Map([...s.careerTotals ?? []].map(([k, v]) => [k, { ...v }]));
    recordCareerMarks(s, 2027);
    for (const [id, before] of once) {
      expect(s.careerTotals?.get(id)).toEqual(before);
    }
  });

  it('keeps a departed man in the book and drops him from the ledger', () => {
    const s = season(3131);
    recordCareerMarks(s, 2027);

    // Whoever leads the country in career hits, taken off his roster the way the
    // offseason takes a graduating senior off it.
    const leader = s.records?.careerHits;
    expect(leader?.id).toBeDefined();
    const rec = s.teams.find((t) => t.def.abbr === leader?.team);
    expect(rec).toBeDefined();
    const strip = <T extends { id: unknown }>(xs: T[]): T[] =>
      xs.filter((p) => p.id !== leader?.id);
    rec!.team.lineup = strip(rec!.team.lineup);
    rec!.team.bench = strip(rec!.team.bench);
    rec!.team.rotation = strip(rec!.team.rotation);
    rec!.team.bullpen = strip(rec!.team.bullpen);

    // A second June with nobody having played a game, which is enough: the scan
    // walks rosters, and he is not on one. No games are simulated because a
    // lineup one man short is a state the engine is entitled to refuse.
    const next = nextSeason(s);
    recordCareerMarks(next, 2028);

    // His row is gone from the running ledger — which is the pruning that keeps
    // it bounded — and his mark is exactly where he left it.
    expect(next.careerTotals?.has(leader!.id!)).toBe(false);
    expect(next.careerTotals?.size).toBeLessThan(s.careerTotals?.size ?? 0);
    expect(next.records?.careerHits?.value).toBe(leader!.value);
    expect(next.records?.careerHits?.holder).toBe(leader!.holder);
  });

  it('holds a career rate to two qualifying seasons', () => {
    const s = world(3131);
    for (const t of s.teams) t.gp = 45;
    const cameo = s.teams[1]?.team.lineup[0];
    const everyday = s.teams[2]?.team.lineup[0];
    const line = (ab: number, h: number) => ({
      g: 45, ab, r: 0, h, d: 0, t: 0, hr: 0, rbi: 0, bb: 0, k: 0, hbp: 0, sb: 0, cs: 0,
    });
    // Forty for forty is a 1.000 career and a hundred and forty at bats short.
    s.batting.set(cameo!.id, line(40, 40));
    s.batting.set(everyday!.id, line(CAREER_MIN_AB, Math.round(CAREER_MIN_AB * 0.6)));

    recordCareerMarks(s, 2027);
    expect(s.records?.careerAvg?.id).toBe(everyday!.id);
    expect(s.records?.careerAvg?.value).toBeCloseTo(0.6, 2);
  });

  it('survives a save and a load, ledger and all', () => {
    const s = season(3131);
    recordCareerMarks(s, 2027);
    const mark = s.records?.careerTB;
    const rows = s.careerTotals?.size ?? 0;
    expect(mark).toBeDefined();
    expect(rows).toBeGreaterThan(100);

    const file = buildSaveFile('slot', 'Test', s, 2027, 0, {}, 0);
    const back = fromPortable({ season: file.season, rngState: file.rngState });

    expect(back.records?.careerTB?.value).toBe(mark?.value);
    expect(back.records?.careerTB?.holder).toBe(mark?.holder);
    expect(back.careerTotals?.size).toBe(rows);

    // And a career carries on from the disk rather than restarting: the reloaded
    // ledger is what the next June adds to.
    for (let d = 0; d < 4; d++) simNextDay(back);
    recordCareerMarks(back, 2028);
    expect(back.records?.careerTB?.value).toBeGreaterThanOrEqual(mark!.value);
  });

  it('opens a dynasty from before the ledger existed on an empty one', () => {
    const portable = toPortable(world());
    delete (portable.season as { careerTotals?: unknown }).careerTotals;
    const back = fromPortable(portable);
    // Genuinely empty, not seeded. Nobody's career was being counted, so counting
    // starts now — the same rule the scoreless streak follows.
    expect(back.careerTotals?.size).toBe(0);
    for (const key of recordsIn('career')) expect(back.records?.[key]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('the coaching section', () => {
  it('takes a career only when it beats the standing one', () => {
    const book: RecordBook = {};
    const coach = {
      name: 'Ray Vance', careerWins: 120, careerLosses: 60,
      titles: 0, conferenceTitles: 2, regionalTitles: 1, tournaments: 4,
    };
    recordCoachMarks(book, 2031, coach, 'RID');
    expect(book.coachWins?.value).toBe(120);
    // No title yet, so the row stays open rather than reading "0, Ray Vance".
    expect(book.coachTitles).toBeUndefined();
    // Winning a region is counted, which it was not anywhere in the game
    // before B6 — the postseason had the round and nothing kept the number.
    expect(book.coachRegionals?.value).toBe(1);

    recordCoachMarks(book, 2032, { ...coach, careerWins: 120 }, 'RID');
    expect(book.coachWins?.year).toBe(2031);
    recordCoachMarks(book, 2033, { ...coach, careerWins: 155, titles: 1 }, 'RID');
    expect(book.coachWins?.value).toBe(155);
    expect(book.coachTitles?.value).toBe(1);
  });

  it('says the same thing about your career as the coach page does', () => {
    /*
      The two screens read one set of counters, and the day they stop is the day
      a coach is told he has three conference titles on one tab and four on the
      next. `BookCoach` exists to make that a compile error — a real `CoachState`
      has to satisfy it — and this pins the other half: every row the book prints
      is the field the coach page prints, untouched.

      B6 is the reason the guarantee is worth a test. TRIPS TO OMAHA used to be
      derived on the coach page by filtering the season history, against a book
      that had no regional row at all, so the two could not even be compared.
    */
    const coach: CoachState = {
      ...restoreCoach(undefined),
      name: 'Ray Vance',
      careerWins: 341, careerLosses: 188,
      titles: 2, conferenceTitles: 6, regionalTitles: 3, tournaments: 9,
    };
    const book: RecordBook = {};
    recordCoachMarks(book, 2041, coach, 'RID');

    // Left of each equals sign is the book; right is the string the COACH tab
    // renders in `Program.tsx`.
    expect(book.coachWins?.value).toBe(coach.careerWins);
    expect(book.coachWins?.detail).toBe(`${coach.careerWins}-${coach.careerLosses}`);
    expect(book.coachTournaments?.value).toBe(coach.tournaments);
    expect(book.coachConfTitles?.value).toBe(coach.conferenceTitles);
    expect(book.coachRegionals?.value).toBe(coach.regionalTitles);
    expect(book.coachTitles?.value).toBe(coach.titles);
    expect(book.coachWins?.holder).toBe(coach.name);
  });
});

// ---------------------------------------------------------------------------

describe('the book on disk', () => {
  it('survives a save and a load', () => {
    const s = world();
    for (let d = 0; d < 4; d++) simNextDay(s);
    recordSeasonMarks(s, 2027);
    const before = s.records?.teamGameRuns;
    expect(before).toBeDefined();

    const file = buildSaveFile('slot', 'Test', s, 2027, 0, {}, 0);
    expect(file.season.records?.teamGameRuns?.value).toBe(before?.value);

    const back = fromPortable({ season: file.season, rngState: file.rngState });
    expect(back.records?.teamGameRuns?.value).toBe(before?.value);
    expect(back.records?.teamGameRuns?.team).toBe(before?.team);
    expect(back.records?.seasonHR?.holder).toBe('Pete Incaviglia');
    expect(back.year).toBe(2027);
  });

  it('opens a dynasty from before the book existed on the seeded marks', () => {
    const portable = toPortable(world());
    // Exactly what a save written by an older build looks like.
    delete (portable.season as { records?: unknown }).records;
    delete (portable.season as { scorelessOuts?: unknown }).scorelessOuts;

    const back = fromPortable(portable);
    expect(back.records?.seasonHR?.holder).toBe('Pete Incaviglia');
    expect(back.records?.seasonHitStreak?.value).toBe(58);
    expect(back.scorelessOuts?.size).toBe(0);
    // And nothing invented: the unseeded categories are still open.
    expect(back.records?.gameHR).toBeUndefined();
  });

  it('keeps every group reachable from the book', () => {
    // A key added to the union and left out of the table would render nowhere.
    const seen = new Set<RecordKey>();
    for (const g of ['game', 'feat', 'season', 'career', 'team', 'coach'] as const) {
      for (const k of recordsIn(g)) seen.add(k);
    }
    expect(seen.size).toBe(Object.keys(RECORDS).length);
  });
});
