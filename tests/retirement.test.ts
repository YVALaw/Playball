// retirement.test.ts
// The end of a career: when the years start asking, when they stop taking an
// answer, and what a finished career is worth beside the ones already in the
// book.

import { describe, it, expect } from 'vitest';
import {
  retirementStatus, legacyScore, legacyRank, inTheHall, endingOf,
  ASK_AGE, ASK_SEASONS, LAST_AGE, LAST_SEASONS, COACH_HALL_BAR,
  type Legend,
} from '../src/engine/retirement.js';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { seatCoaches, runRivalYear, retireAge } from '../src/engine/rivals.js';
import { reviewSeason } from '../src/engine/program.js';

describe('when the years start asking', () => {
  it('leaves a young coach alone', () => {
    expect(retirementStatus({ age: 41, seasons: 6 })).toBe('early');
    expect(retirementStatus({ age: ASK_AGE - 1, seasons: ASK_SEASONS - 1 })).toBe('early');
  });

  it('asks on age alone, for a man who started late', () => {
    expect(retirementStatus({ age: ASK_AGE, seasons: 2 })).toBe('asked');
  });

  it('asks on seasons alone, for a man who started at 28', () => {
    expect(retirementStatus({ age: 48, seasons: ASK_SEASONS })).toBe('asked');
  });

  it('takes the answer away at either end', () => {
    expect(retirementStatus({ age: LAST_AGE, seasons: 1 })).toBe('over');
    expect(retirementStatus({ age: 46, seasons: LAST_SEASONS })).toBe('over');
  });

  /*
    A career that began at 28 and ran thirty years ends on the seasons clock at
    58; one that began at 55 ends on the age clock in its fifteenth year. Both
    end, which is the whole point of having two.
  */
  it('ends both shapes of career', () => {
    expect(retirementStatus({ age: 58, seasons: 30 })).toBe('over');
    expect(retirementStatus({ age: 70, seasons: 15 })).toBe('over');
  });

  it('is not upset by a garbage age', () => {
    expect(retirementStatus({ age: Number.NaN, seasons: 3 })).toBe('early');
  });
});

describe('what a career was worth', () => {
  const career = (over: Partial<Parameters<typeof legacyScore>[0]> = {}): number => legacyScore({
    careerWins: 0, careerLosses: 0, titles: 0, conferenceTitles: 0,
    regionalTitles: 0, tournaments: 0, seasons: 0, ...over,
  });

  it('puts the national title above everything else', () => {
    expect(career({ titles: 1 })).toBeGreaterThan(career({ regionalTitles: 3, conferenceTitles: 3 }));
  });

  it('will not let one good year outrank a trophy', () => {
    expect(career({ careerWins: 45, seasons: 1, conferenceTitles: 1 })).toBeLessThan(career({ titles: 1 }));
  });

  it('lets a whole life of winning compete with a title and a half', () => {
    expect(career({ careerWins: 900, seasons: 25 })).toBeGreaterThan(career({ titles: 1 }));
    expect(career({ careerWins: 900, seasons: 25 })).toBeLessThan(career({ titles: 2 }));
  });

  it('separates two men who won the same and stayed different lengths', () => {
    expect(career({ careerWins: 500, careerLosses: 400, seasons: 22 }))
      .toBeGreaterThan(career({ careerWins: 500, careerLosses: 400, seasons: 12 }));
  });

  it('is never negative, whatever it is handed', () => {
    expect(career({ careerWins: -50, titles: Number.NaN })).toBe(0);
  });
});

describe('where a career stands', () => {
  const legend = (name: string, score: number): Legend => ({
    name, you: false, from: 2000, to: 2020, age: 66, seasons: 20,
    careerWins: 0, careerLosses: 0, titles: 0, conferenceTitles: 0,
    regionalTitles: 0, tournaments: 0, stints: [], score, ending: 'age',
  });

  it('counts the book plus the man being placed in it', () => {
    const book = [legend('A', 800), legend('B', 400), legend('C', 100)];
    expect(legacyRank(500, book)).toEqual({ rank: 2, of: 4 });
    expect(legacyRank(900, book)).toEqual({ rank: 1, of: 4 });
    expect(legacyRank(50, book)).toEqual({ rank: 4, of: 4 });
  });

  it('is first of one when nobody has finished before you', () => {
    expect(legacyRank(120, [])).toEqual({ rank: 1, of: 1 });
  });

  it('shares a place on a tie rather than inventing an order', () => {
    const book = [legend('A', 800), legend('B', 500), legend('C', 500)];
    expect(legacyRank(500, book).rank).toBe(2);
  });
});

describe('the board, to a man who is leaving', () => {
  /*
    Reported 2026-09-20: "I selected to retire at the beginning of the season
    but now in season review is telling me the board extended my contract."
    A board that signs a coach for four more years on the day he finishes has
    not been listening, and it made the screen that follows — the end of the
    career — read as a non sequitur.
  */
  const great = {
    wins: 44, losses: 12, conferenceRank: 1, conferenceSize: 12,
    wonConference: true, madeTournament: true, wonRegional: true,
    reachedOmaha: true, wonTitle: true,
  };
  const bad = {
    wins: 12, losses: 33, conferenceRank: 11, conferenceSize: 12,
    wonConference: false, madeTournament: false, wonRegional: false,
    reachedOmaha: false, wonTitle: false,
  };
  const man = (over: Record<string, unknown> = {}) => ({
    prestige: 40, security: 60, tenure: 6, badRun: 0,
    contractYears: 1, contractLength: 4, caughtLooking: false, ...over,
  } as unknown as Parameters<typeof reviewSeason>[0]);

  it('does not extend a farewell season', () => {
    const r = reviewSeason(man({ farewell: true }), 45, 45, great, 45);
    expect(r.extended).toBe(false);
    expect(r.renewed).toBe(false);
    expect(r.fired).toBe(false);
    expect(r.message).toMatch(/next man/);
  });

  it('extends the same season when he is staying', () => {
    const r = reviewSeason(man(), 45, 45, great, 45);
    expect(r.extended || r.renewed).toBe(true);
  });

  it('does not sack him on the way out either', () => {
    const r = reviewSeason(man({ farewell: true, security: 12, contractYears: 3 }), 45, 45, bad, 45);
    expect(r.fired).toBe(false);
    expect(r.notRenewed).toBe(false);
  });
});

describe('the other ninety five', () => {
  it('writes a rival career into the world the day the years take him', () => {
    const season = createSeason(makeRng(9), undefined, CONFERENCES.slice(0, 2));
    seatCoaches(season, -1, 2027);
    const chair = season.teams[0]!;
    const man = chair.coach!;
    man.age = retireAge(man.name);
    man.careerWins = 300; man.careerLosses = 200; man.titles = 1; man.seasons = 12;
    for (const t of season.teams) { t.rw = 28; t.rl = 17; t.cw = 20; t.cl = 13; }

    const { moves } = runRivalYear(season, null, { year: 2027, userTeam: -1, games: 45 });

    expect(moves.some((m) => m.kind === 'retired')).toBe(true);
    const book = season.legends ?? [];
    const his = book.find((l) => l.name === man.name);
    expect(his).toBeDefined();
    expect(his!.you).toBe(false);
    expect(his!.ending).toBe('age');
    expect(his!.titles).toBe(1);
    // The season he just coached counts, so the totals are his plus this one.
    expect(his!.careerWins).toBeGreaterThanOrEqual(300);
    expect(his!.seasons).toBe(13);
    expect(his!.score).toBeGreaterThan(0);
  });

  it('does not write down a man who never coached a game', () => {
    const season = createSeason(makeRng(11), undefined, CONFERENCES.slice(0, 2));
    seatCoaches(season, -1, 2027);
    const chair = season.teams[0]!;
    const man = chair.coach!;
    man.age = retireAge(man.name);
    man.careerWins = 0; man.careerLosses = 0;
    // Nothing played: every record is at nought, so nobody has a season.
    for (const t of season.teams) { t.rw = 0; t.rl = 0; t.cw = 0; t.cl = 0; t.gp = 0; }

    runRivalYear(season, null, { year: 2027, userTeam: -1, games: 45 });

    expect((season.legends ?? []).some((l) => l.name === man.name)).toBe(false);
  });
});

describe('which story a career tells', () => {
  const career = (over: Partial<Legend> = {}): Legend => ({
    name: 'A Man', you: true, from: 2010, to: 2030, age: 64, seasons: 21,
    careerWins: 700, careerLosses: 500, titles: 0, conferenceTitles: 2,
    regionalTitles: 0, tournaments: 5,
    // Two spells, neither long enough to be a lifer: the default career has no
    // shape of its own, so each test below turns on the one thing it sets.
    stints: [
      { school: 'First', from: 2010, to: 2019, w: 340, l: 250, titles: 0 },
      { school: 'State', from: 2020, to: 2030, w: 360, l: 250, titles: 0 },
    ],
    score: 400, ending: 'chose', years: [], ...over,
  });
  const titleIn = (year: number) => ({
    year, school: 'State', abbr: 'STA', w: 45, l: 12,
    finish: 'champion' as const, wonConference: true,
  });

  it('gives the rarest story to a man who won it and left', () => {
    const e = endingOf(career({ titles: 1, years: [titleIn(2030)] }));
    expect(e.id).toBe('on-top');
    expect(e.tone).toBe('gold');
  });

  it('counts the year before as going out on top too', () => {
    expect(endingOf(career({ titles: 1, years: [titleIn(2029)] })).id).toBe('on-top');
  });

  it('does not, when the years took him rather than his own say', () => {
    expect(endingOf(career({ titles: 1, ending: 'age', years: [titleIn(2030)] })).id).toBe('champion');
  });

  it('does not, when the title was a decade ago', () => {
    expect(endingOf(career({ titles: 1, years: [titleIn(2020)] })).id).toBe('champion');
  });

  it('calls three titles a dynasty', () => {
    expect(endingOf(career({ titles: 3, years: [titleIn(2020)] })).id).toBe('dynasty');
  });

  it('calls fifteen years in one chair a lifer', () => {
    const e = endingOf(career({
      stints: [{ school: 'State', from: 2010, to: 2026, w: 600, l: 400, titles: 0 }],
    }));
    expect(e.id).toBe('lifer');
    expect(e.line).toContain('State');
  });

  it('calls a program lifted a long way a builder', () => {
    const e = endingOf(career({
      built: 24,
      stints: [
        { school: 'First', from: 2010, to: 2018, w: 300, l: 250, titles: 0 },
        { school: 'Second', from: 2019, to: 2030, w: 400, l: 250, titles: 0 },
      ],
    }));
    expect(e.id).toBe('builder');
  });

  it('gives Omaha without a title its own name', () => {
    expect(endingOf(career({ regionalTitles: 2 })).id).toBe('nearly');
  });

  it('tells a quiet career plainly, and never as a failure', () => {
    const e = endingOf(career());
    expect(e.id).toBe('long-road');
    expect(e.tone).toBe('quiet');
    expect(e.line).toContain('700');
  });

  /*
    A rival legend has no seasons — nothing was ever archived for the other
    ninety five — so the one ending that needs them must never fire on him.
  */
  it('never claims a man went out on top without the seasons to say so', () => {
    const rival = endingOf(career({ you: false, titles: 1, years: undefined }));
    expect(rival.id).toBe('champion');
  });
});

describe('the wall', () => {
  it('takes a champion', () => {
    const score = legacyScore({
      careerWins: 700, careerLosses: 500, titles: 1, conferenceTitles: 4,
      regionalTitles: 2, tournaments: 6, seasons: 20,
    });
    expect(inTheHall({ score })).toBe(true);
  });

  it('takes a long life of Junes without one', () => {
    const score = legacyScore({
      careerWins: 800, careerLosses: 600, titles: 0, conferenceTitles: 8,
      regionalTitles: 4, tournaments: 10, seasons: 26,
    });
    expect(score).toBeGreaterThanOrEqual(COACH_HALL_BAR);
  });

  it('leaves out a decent career that never got anywhere', () => {
    const score = legacyScore({
      careerWins: 400, careerLosses: 350, titles: 0, conferenceTitles: 1,
      regionalTitles: 0, tournaments: 2, seasons: 15,
    });
    expect(inTheHall({ score })).toBe(false);
  });
});
