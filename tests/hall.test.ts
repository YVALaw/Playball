// hall.test.ts
// Who gets a plaque.
//
// The first test in this file is the most important one in it, and it is the
// brief written back as an assertion: a man who holds one enormous single-game
// record and was otherwise ordinary must not be inducted. Everything else here
// exists to stop the fix for that from breaking something else — that a real
// career still goes in, that the two year star who left for the draft is judged
// against the four year man on terms both can live with, and that the whole thing
// only ever looks at the men the user coached.
//
// The long run at the bottom is the one that decides whether `HALL_BAR` is a
// number or a guess. It is the same shape as the long run in rivals.test.ts and
// for the same reason: a rate is not visible in one season.

import { describe, it, expect } from 'vitest';
import {
  buildCase, electable, honourRuns, honoursByPlayer, inductees, seasonRuns,
  activeIds, HALL_BAR, MIN_SEASONS, PEAK_SEASONS,
} from '../src/engine/hall.js';
import {
  createSeason, simSeason, nextSeason, archiveSeason, liveCareerYear, DEFAULT_SEASON,
  type CareerYear, type SeasonState,
} from '../src/engine/season.js';
import { seasonAwards, allConference } from '../src/engine/postseason.js';
import { departAndDevelop, fillRosters, holesFor } from '../src/engine/progression.js';
import { seatCoaches, syncCoachMods } from '../src/engine/rivals.js';
import {
  RECRUITING_WEEKS, aiTargets, closeWeek, leadersAtWeekStart, resetWeeklySpend,
  weeklyPoints,
} from '../src/engine/recruiting.js';
import { pitchFor, developmentScore } from '../src/engine/pitch.js';
import { offer, type RecordBook } from '../src/engine/records.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES, type Region } from '../src/data/schools.js';
import { playerId, type PlayerId } from '../src/engine/types.js';

const id = (s: string): PlayerId => playerId(s);

/** One archived season, in the shape `archiveSeason` writes. */
const bat = (
  year: number, classYear: string,
  ab: number, h: number, d: number, t: number, hr: number, rbi: number, bb: number,
): CareerYear => ({ year, classYear, team: 'HOM', name: 'A Man', ab, h, d, t, hr, rbi, bb, sb: 0 });

const arm = (
  year: number, classYear: string,
  outs: number, w: number, l: number, er: number, k: number,
): CareerYear => ({ year, classYear, team: 'HOM', name: 'An Arm', outs, w, l, er, k });

/** A season a good everyday player has. Nowhere near a plaque, on purpose. */
const ORDINARY = (year: number, cls: string): CareerYear =>
  bat(year, cls, 170, 48, 9, 1, 5, 27, 18);

/** A season the country notices. */
const HUGE = (year: number, cls: string): CareerYear =>
  bat(year, cls, 180, 72, 18, 2, 15, 65, 30);

const caseOf = (rows: CareerYear[], honours: string[] = []) =>
  buildCase(id('p1'), rows, honours);

// ---------------------------------------------------------------------------

describe('the failure mode the whole thing was designed against', () => {
  /*
    "What I don't want is one player who holds one game record but out of that
    was a bad player to get inducted." So: an ordinary four year career, and the
    single best afternoon anybody in the country has ever had sitting in the book
    against his name.
  */
  const ordinary = [
    ORDINARY(2027, 'FR'), ORDINARY(2028, 'SO'), ORDINARY(2029, 'JR'), ORDINARY(2030, 'SR'),
  ];

  it('does not induct a man for one enormous game', () => {
    const book: RecordBook = {};
    const who = { holder: 'A Man', team: 'HOM', year: 2029, id: id('p1') };
    offer(book, 'gameHR', { ...who, value: 5, detail: 'vs AWY' });
    offer(book, 'gameRBI', { ...who, value: 12, detail: 'vs AWY' });
    offer(book, 'gameHits', { ...who, value: 6, detail: 'vs AWY' });

    // He is in the book three times over, and the book has nothing to do with it.
    expect(book.gameHR?.id).toBe(id('p1'));
    expect(electable(caseOf(ordinary))).toBe(false);
  });

  it('scores a career identically whatever the record book says', () => {
    // The strongest form of the guarantee: the ballot cannot read the book, so
    // no arrangement of records can move a score by a point. If a future change
    // wires the book into the case, this is the test that fails.
    const before = caseOf(ordinary).score;
    const book: RecordBook = {};
    for (const key of ['gameHR', 'gameRBI', 'gameHits', 'gameRuns', 'gameSB'] as const) {
      offer(book, key, { value: 99, holder: 'A Man', team: 'HOM', year: 2029, id: id('p1') });
    }
    expect(caseOf(ordinary).score).toBe(before);
  });

  it('does not induct one monstrous season either, however monstrous', () => {
    // The other shape of a spike, and the reason for the two season floor. This
    // man's single year is worth more than most whole careers and he still does
    // not go in.
    const oneYear = caseOf([bat(2027, 'SR', 200, 110, 30, 5, 35, 120, 40)]);
    expect(oneYear.score).toBeGreaterThan(HALL_BAR);
    expect(oneYear.seasons).toBeLessThan(MIN_SEASONS);
    expect(electable(oneYear)).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('a real career goes in', () => {
  it('inducts four years of the production a great college player has', () => {
    const c = caseOf([HUGE(2027, 'FR'), HUGE(2028, 'SO'), HUGE(2029, 'JR'), HUGE(2030, 'SR')]);
    expect(electable(c)).toBe(true);
    expect(c.line).toContain('4 seasons');
  });

  it('inducts an arm on the same scale as a bat', () => {
    // Three years as a Friday starter at an ERA nobody else in the league has.
    const ace = buildCase(id('a1'), [
      arm(2027, 'FR', 270, 10, 2, 22, 110),
      arm(2028, 'SO', 300, 12, 1, 20, 130),
      arm(2029, 'JR', 300, 13, 1, 18, 140),
    ]);
    expect(ace.pitcher).toBe(true);
    expect(electable(ace)).toBe(true);
    expect(ace.line).toContain('ERA');
  });

  it('leaves the good but not great outside', () => {
    const solid = caseOf([
      bat(2027, 'FR', 170, 55, 12, 1, 8, 38, 22),
      bat(2028, 'SO', 175, 58, 13, 1, 9, 41, 24),
      bat(2029, 'JR', 178, 60, 14, 2, 10, 44, 25),
      bat(2030, 'SR', 180, 61, 14, 1, 11, 46, 26),
    ]);
    expect(solid.score).toBeGreaterThan(0);
    expect(electable(solid)).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('the two year star against the four year man', () => {
  /*
    The case the draft made ordinary. A junior taken in the second round leaves
    with two or three seasons behind him; the man who was never drafted leaves
    with four. Adding seasons up alone hands the hall to whoever nobody wanted;
    taking the best year alone hands it to whoever had one. So both, and these
    tests pin what "both" means at the two places it could go wrong.
  */
  const star2 = caseOf([HUGE(2027, 'SO'), HUGE(2028, 'JR')]);
  const plodder4 = caseOf([
    ORDINARY(2027, 'FR'), ORDINARY(2028, 'SO'), ORDINARY(2029, 'JR'), ORDINARY(2030, 'SR'),
  ]);

  it('does not let longevity alone beat a genuinely great short career', () => {
    expect(plodder4.seasons).toBeGreaterThan(star2.seasons);
    expect(star2.score).toBeGreaterThan(plodder4.score);
    expect(electable(star2)).toBe(true);
    expect(electable(plodder4)).toBe(false);
  });

  it('gives the peak to the man who had it, at equal career totals', () => {
    // Same runs, spread differently: two years at full value against four at
    // half. The career halves of the two scores match; the peak halves do not,
    // and that is the entire adjustment for an early departure.
    const spread = caseOf([
      bat(2027, 'FR', 90, 36, 9, 1, 7, 32, 15),
      bat(2028, 'SO', 90, 36, 9, 1, 8, 33, 15),
      bat(2029, 'JR', 90, 36, 9, 1, 8, 33, 15),
      bat(2030, 'SR', 90, 36, 9, 1, 7, 32, 15),
    ]);
    expect(spread.career).toBeCloseTo(star2.career, 0);
    expect(star2.peak).toBeGreaterThan(spread.peak);
    expect(star2.score).toBeGreaterThan(spread.score);
  });

  it('still puts the better four year man ahead of the two year star', () => {
    // The guard on the other side: the peak bonus is one season's worth, not a
    // multiplier, so it cannot buy a short career past a long one that was
    // nearly as good every year.
    const great4 = caseOf([
      HUGE(2027, 'FR'), HUGE(2028, 'SO'), HUGE(2029, 'JR'), HUGE(2030, 'SR'),
    ]);
    expect(great4.score).toBeGreaterThan(star2.score);
  });

  it('weighs a peak over exactly two seasons, whatever the career length', () => {
    const four = caseOf([
      HUGE(2027, 'FR'), HUGE(2028, 'SO'), ORDINARY(2029, 'JR'), ORDINARY(2030, 'SR'),
    ]);
    expect(PEAK_SEASONS).toBe(2);
    // His peak is the two big years and is not diluted by the two quiet ones.
    expect(four.peak).toBeCloseTo(seasonRuns(HUGE(2027, 'FR')), 5);
  });
});

// ---------------------------------------------------------------------------

describe('what the honours are worth', () => {
  it('prices a national award above a conference one', () => {
    expect(honourRuns(['Player of the Year']))
      .toBeGreaterThan(honourRuns(['All-conference SS']));
    expect(honourRuns(['Pitcher of the Year'])).toBe(honourRuns(['Player of the Year']));
  });

  it('cannot get an ordinary man in on its own', () => {
    // Four years of everything the game has to give a hitter, on an otherwise
    // unremarkable career. The bar does not move.
    const decorated = caseOf(
      [ORDINARY(2027, 'FR'), ORDINARY(2028, 'SO'), ORDINARY(2029, 'JR'), ORDINARY(2030, 'SR')],
      ['Player of the Year', 'Freshman of the Year', 'All-conference SS'],
    );
    expect(decorated.honours).toBeGreaterThan(0);
    expect(electable(decorated)).toBe(false);
  });

  it('counts a repeated title once, so a plaque does not stutter', () => {
    const map = honoursByPlayer([
      { awards: [{ id: 'p1', title: 'All-conference SS' }] },
      { awards: [{ id: 'p1', title: 'All-conference SS' }] },
    ]);
    expect(map.get('p1')).toEqual(['All-conference SS']);
  });
});

// ---------------------------------------------------------------------------

describe('the ballot', () => {
  const greatCareer = [
    HUGE(2027, 'FR'), HUGE(2028, 'SO'), HUGE(2029, 'JR'), HUGE(2030, 'SR'),
  ];

  const ballot = (over: Partial<Parameters<typeof inductees>[0]> = {}) => inductees({
    careers: { [id('p1')]: greatCareer },
    active: new Set<string>(),
    inducted: new Set<string>(),
    honours: new Map<string, string[]>(),
    year: 2031,
    ...over,
  });

  it('inducts a finished career', () => {
    const going = ballot();
    expect(going.map((m) => String(m.id))).toEqual(['p1']);
    expect(going[0]?.year).toBe(2031);
  });

  it('will not induct a man who is still playing', () => {
    // The reason induction waits until the draft board is empty: a junior taken
    // in the fourth round is off the roster the moment the offseason runs, and a
    // coach may still talk him into coming back.
    expect(ballot({ active: new Set(['p1']) })).toEqual([]);
  });

  it('does not consider a man who is already in', () => {
    expect(ballot({ inducted: new Set(['p1']) })).toEqual([]);
  });

  it('freezes the case at the moment he goes in', () => {
    const m = ballot()[0];
    expect(m?.first).toBe(2027);
    expect(m?.last).toBe(2030);
    expect(m?.teams).toEqual(['HOM']);
    expect(m?.score).toBe(Math.round(caseOf(greatCareer).score));
  });

  it('reads nobody but the men in the archive', () => {
    // Which is the whole of "your own players only": the archive is written by
    // `archiveSeason` for the user's team alone, and this function has no other
    // source of men. A rival's monster is not on the ballot because he is not in
    // the book to be on it.
    expect(ballot({ careers: {} })).toEqual([]);
  });

  it('orders a class best first', () => {
    const going = inductees({
      careers: {
        [id('p1')]: greatCareer,
        [id('p2')]: [HUGE(2027, 'FR'), HUGE(2028, 'SO'), HUGE(2029, 'JR')],
      },
      active: new Set<string>(),
      inducted: new Set<string>(),
      honours: new Map<string, string[]>(),
      year: 2031,
    });
    expect(going.length).toBe(2);
    expect(going[0]!.score).toBeGreaterThanOrEqual(going[1]!.score);
  });
});

// ---------------------------------------------------------------------------

/*
  Reported: "after two seasons only one year shows on a player's card, and the
  numbers do not update in real time."

  Both halves are the same thing. The archive is written once, in June, on the
  way into the draft step — so from February until then the season the player is
  actually watching is in `season.batting` and nowhere else, and a card that read
  the archive alone showed a sophomore his freshman row and nothing since. The
  fix is not to archive earlier, which would put an unfinished year in a record
  book; it is for the card to be able to ask for the row this season is going to
  become.
*/
describe('the season in progress is a row too', () => {
  const played = (): SeasonState => {
    const season = createSeason(makeRng(9091), DEFAULT_SEASON, CONFERENCES.slice(0, 2));
    season.year = 2027;
    simSeason(season);
    return season;
  };

  it('gives a man his second year while he is still playing it', () => {
    const season = played();
    archiveSeason(season, 0, 2027);

    // Somebody who actually played, and his year in the book.
    const man = season.teams[0]!.team.lineup.find(
      (p) => (season.batting.get(p.id)?.ab ?? 0) > 20,
    )!;
    expect(season.careers[man.id]).toHaveLength(1);

    // A second season, live: the year rolls, the statistics are wiped, and he
    // starts hitting again. This is May of his second year.
    const next = nextSeason(season);
    next.year = 2028;
    simSeason(next);

    const archived = next.careers[man.id] ?? [];
    const live = liveCareerYear(next, 0, man.id);
    expect(archived).toHaveLength(1);
    expect(live).not.toBeNull();
    expect(live!.year).toBe(2028);

    // Which is what the card stacks: one finished year and the one in front of
    // him. Before this it had the first and no way to reach the second.
    const rows = [...archived.filter((y) => y.year !== live!.year), live!];
    expect(rows.map((y) => y.year)).toEqual([2027, 2028]);
  });

  it('is the same row June will write, and does not write it', () => {
    const season = played();
    const man = season.teams[0]!.team.lineup.find(
      (p) => (season.batting.get(p.id)?.ab ?? 0) > 20,
    )!;

    const live = liveCareerYear(season, 0, man.id);
    // Nothing is recorded by looking.
    expect(season.careers[man.id]).toBeUndefined();

    archiveSeason(season, 0, 2027);
    expect(season.careers[man.id]).toEqual([live]);
  });

  it('says nothing about a man who has not been in a game', () => {
    const season = createSeason(makeRng(9091), DEFAULT_SEASON, CONFERENCES.slice(0, 2));
    season.year = 2027;
    const man = season.teams[0]!.team.lineup[0]!;
    expect(liveCareerYear(season, 0, man.id)).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('only the men you coached are eligible', () => {
  it('archives your program and nobody else, so nobody else can be inducted', () => {
    const season = createSeason(makeRng(6161), DEFAULT_SEASON, CONFERENCES.slice(0, 2));
    season.year = 2027;
    simSeason(season);
    archiveSeason(season, 0, 2027);

    const mine = new Set(
      [...season.teams[0]!.team.lineup, ...season.teams[0]!.team.bench,
        ...season.teams[0]!.team.rotation, ...season.teams[0]!.team.bullpen]
        .map((p) => String(p.id)),
    );
    const archived = Object.keys(season.careers);
    expect(archived.length).toBeGreaterThan(10);
    for (const key of archived) expect(mine.has(key)).toBe(true);

    // And the men who are on the ballot are exactly the men in that archive.
    const everybody = activeIds(season.teams);
    for (const key of archived) expect(everybody.has(key)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

/**
 * The rate, over a career's worth of seasons.
 *
 * Two conferences rather than the whole country, because the postseason is the
 * only thing that needs ninety six programs and this does not run one — a hall of
 * fame is decided off the archive and the archive is written off the regular
 * season. The programs watched are the strongest and the weakest of the
 * twenty four, which is what makes this a test of the *gradient* rather than of
 * one number: an absolute bar has to induct often at a good program and rarely at
 * a bad one, or it is measuring the league instead of the men.
 */
describe('the rate a dynasty inducts at', () => {
  const YEARS = 12;
  const START = 2027;

  const regionOf = (season: SeasonState, i: number): Region =>
    CONFERENCES.find((c) => c.id === season.teams[i]?.conference)?.region ?? 'Gulf';

  function recruitWindow(season: SeasonState): void {
    for (let w = 1; w <= RECRUITING_WEEKS; w++) {
      season.recruiting.week = w;
      const atWeekStart = leadersAtWeekStart(season.recruiting);
      for (const record of season.teams) {
        const pitch = pitchFor(season, record, regionOf(season, record.index),
          developmentScore(record));
        const staff = record.coach;
        const need = holesFor([
          ...record.team.lineup, ...record.team.bench,
          ...record.team.rotation, ...record.team.bullpen,
        ]).reduce((a, h) => a + h.count, 0);
        for (const { prospect, actions } of aiTargets(
          record.index, pitch, staff?.prestige ?? 45, season.recruiting.prospects,
          need, season.rng, atWeekStart, 0,
        )) {
          prospect.points[record.index] = (prospect.points[record.index] ?? 0)
            + weeklyPoints(prospect, pitch, actions,
              staff?.prestige ?? 45, staff?.skills.recruiting ?? 20);
        }
      }
      closeWeek(season.recruiting, season.rng, w >= RECRUITING_WEEKS);
      resetWeeklySpend(season.recruiting);
    }
  }

  let season = createSeason(makeRng(4242), DEFAULT_SEASON, CONFERENCES.slice(0, 2));
  season.year = START;
  seatCoaches(season, -1, START);
  syncCoachMods(season, -1, null);

  const ranked = [...season.teams].sort((a, b) => b.prestige - a.prestige);
  const watched = [ranked[0]!.index, ranked[ranked.length - 1]!.index].map((index) => ({
    index,
    careers: {} as Record<PlayerId, CareerYear[]>,
    honours: new Map<string, string[]>(),
    hall: [] as string[],
  }));

  for (let y = 0; y < YEARS; y++) {
    const year = START + y;
    simSeason(season);

    const awards = [
      ...seasonAwards(season),
      ...allConference(season).map((a) => ({ ...a, title: `All-conference ${a.position}` })),
    ];
    const live = season.careers;
    for (const w of watched) {
      const abbr = season.teams[w.index]!.def.abbr;
      for (const a of awards) {
        if (a.team !== abbr) continue;
        const list = w.honours.get(a.id) ?? [];
        if (!list.includes(a.title)) list.push(a.title);
        w.honours.set(a.id, list);
      }
      season.careers = w.careers;
      archiveSeason(season, w.index, year);
    }
    season.careers = live;

    departAndDevelop(season, season.rng, { userTeam: -1 });
    const active = activeIds(season.teams);
    for (const w of watched) {
      for (const m of inductees({
        careers: w.careers, active, inducted: new Set(w.hall),
        honours: w.honours, year,
      })) w.hall.push(String(m.id));
    }
    recruitWindow(season);
    fillRosters(season, season.rng, { userTeam: -1 });
    season = nextSeason(season);
  }

  const [best, worst] = watched as [typeof watched[0], typeof watched[0]];

  it('inducts somebody at a strong program, and not every year', () => {
    // The two failure modes named in the brief, as one assertion each. A hall
    // that admits somebody every season is a roster; one that admits nobody in
    // twenty is a locked room.
    expect(best.hall.length).toBeGreaterThan(0);
    expect(best.hall.length).toBeLessThan(YEARS);
  });

  it('is harder to get into at a weak program than at a strong one', () => {
    // The gradient an absolute bar is for. The bar does not move; the men do.
    expect(worst.hall.length).toBeLessThanOrEqual(best.hall.length);
  });

  it('holds every man in it to the bar it published', () => {
    for (const w of watched) {
      for (const key of w.hall) {
        const c = buildCase(key as PlayerId, w.careers[key as PlayerId] ?? [],
          w.honours.get(key) ?? []);
        expect(c.seasons).toBeGreaterThanOrEqual(MIN_SEASONS);
        expect(c.score).toBeGreaterThanOrEqual(HALL_BAR);
      }
    }
  });
}, 240_000);
