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
  createSeason, simNextDay, recordSeasonMarks, seasonLength, nextSeason,
  DEFAULT_SEASON, type SeasonState,
} from '../src/engine/season.js';
import {
  BOOK_SEASON_GAMES, RECORDS, offer, recordGameMarks, recordCoachMarks,
  seededBook, recordsIn, type RecordBook, type RecordKey,
} from '../src/engine/records.js';
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

describe('the coaching section', () => {
  it('takes a career only when it beats the standing one', () => {
    const book: RecordBook = {};
    const coach = {
      name: 'Ray Vance', careerWins: 120, careerLosses: 60,
      titles: 0, conferenceTitles: 2, tournaments: 4,
    };
    recordCoachMarks(book, 2031, coach, 'RID');
    expect(book.coachWins?.value).toBe(120);
    // No title yet, so the row stays open rather than reading "0, Ray Vance".
    expect(book.coachTitles).toBeUndefined();

    recordCoachMarks(book, 2032, { ...coach, careerWins: 120 }, 'RID');
    expect(book.coachWins?.year).toBe(2031);
    recordCoachMarks(book, 2033, { ...coach, careerWins: 155, titles: 1 }, 'RID');
    expect(book.coachWins?.value).toBe(155);
    expect(book.coachTitles?.value).toBe(1);
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
    for (const g of ['game', 'feat', 'season', 'team', 'coach'] as const) {
      for (const k of recordsIn(g)) seen.add(k);
    }
    expect(seen.size).toBe(Object.keys(RECORDS).length);
  });
});
