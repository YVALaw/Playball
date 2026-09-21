// retirement-career.test.ts
// The end of a career as the store runs it: saying it, the board meeting that
// closes it, the book it is written into, and the man who takes the world on.
//
// The pure arithmetic — the clocks and the score — is in retirement.test.ts.

import { describe, it, expect } from 'vitest';
import { useDynasty, type SeasonRecord } from '../src/state/store.js';
import { ROOKIE_PRESTIGE, DEFAULT_PROFILE } from '../src/engine/program.js';
import { LAST_AGE } from '../src/engine/retirement.js';
import { buildSaveFile } from '../src/state/persistence.js';

/** One finished season on the career, as `history` keeps them. */
function season(
  year: number, school: string, w: number, l: number, finish = 'none',
): SeasonRecord {
  return {
    year, w, l, cw: Math.round(w / 2), cl: Math.round(l / 2),
    confPlace: 1, rpi: 0.6, wonConference: false,
    finish: finish as SeasonRecord['finish'],
    school, nationalChampion: school,
  };
}

/** A career, graded, with the board's verdict sitting in the store. */
function graded(seed = 4242, team = 0): void {
  useDynasty.getState().start(seed, team);
  useDynasty.getState().settleSeason();
  useDynasty.setState({ phase: 'review' });
}

const state = () => useDynasty.getState();

describe('saying it', () => {
  it('announces a farewell in the spring and leaves the season alone', () => {
    useDynasty.getState().start(4242, 0);
    const before = state();
    const seasonBefore = before.season;
    const year = before.year;

    state().announceRetirement();

    const after = state();
    expect(after.coach.farewellYear).toBe(year);
    // Nothing else moved: the season is the same object, still being played.
    expect(after.season).toBe(seasonBefore);
    expect(after.coach.retiredYear).toBeUndefined();
    expect(after.phase).toBeNull();
    expect(after.jobSearch).toBe(false);
  });

  it('says it once', () => {
    useDynasty.getState().start(4242, 0);
    state().announceRetirement();
    const said = state().coach.farewellYear;
    useDynasty.setState({ year: state().year + 1 });
    state().announceRetirement();
    expect(state().coach.farewellYear).toBe(said);
  });
});

describe('the meeting that closes it', () => {
  it('ends the career when the season was announced as the last', async () => {
    graded();
    const year = state().year;
    useDynasty.setState({ coach: { ...state().coach, farewellYear: year } });

    await state().nextPhase('review');

    const after = state();
    expect(after.coach.retiredYear).toBe(year);
    // Not on the market: he is not looking for anything.
    expect(after.jobSearch).toBe(false);
    expect(after.offers).toEqual([]);
    expect(after.phase).toBeNull();
  });

  it('ends it on the years alone, with nothing announced', async () => {
    graded();
    useDynasty.setState({ coach: { ...state().coach, age: LAST_AGE + 1 } });

    await state().nextPhase('review');

    expect(state().coach.retiredYear).not.toBeUndefined();
  });

  it('lets a coach under the clocks walk straight through', async () => {
    graded();
    useDynasty.setState({ coach: { ...state().coach, age: 44 } });

    await state().nextPhase('review');

    expect(state().coach.retiredYear).toBeUndefined();
    // The offseason carried on to the next step rather than ending.
    expect(state().phase).not.toBeNull();
  });

  /*
    The mirror of `rivals.ts`, where retirement is checked before the sacking:
    a man at the end of his last season did not get sacked, he finished.
  */
  it('retires a man the board also let go in the same week', async () => {
    graded();
    const year = state().year;
    useDynasty.setState({
      coach: { ...state().coach, age: LAST_AGE + 2 },
      lastReview: { ...state().lastReview!, fired: true },
    });

    await state().nextPhase('review');

    const after = state();
    expect(after.coach.retiredYear).toBe(year);
    expect(after.jobSearch).toBe(false);
  });
});

describe('the book', () => {
  it('writes the career down, one entry per program', async () => {
    graded();
    const before = state();
    const year = before.year;
    const name = before.coach.name;
    useDynasty.setState({
      coach: { ...before.coach, farewellYear: year, careerWins: 480, careerLosses: 300, titles: 1 },
      // Two chairs and four seasons, the way a career actually reads.
      history: [
        season(year - 3, 'Ridgemont State', 30, 25),
        season(year - 2, 'Ridgemont State', 34, 21),
        season(year - 1, 'Marbury Tech', 41, 14, 'champion'),
        season(year, 'Marbury Tech', 38, 17),
      ],
    });

    await state().nextPhase('review');

    const book = state().season?.legends ?? [];
    expect(book).toHaveLength(1);
    const legend = book[0]!;
    expect(legend.name).toBe(name);
    expect(legend.you).toBe(true);
    expect(legend.careerWins).toBe(480);
    expect(legend.from).toBe(year - 3);
    expect(legend.to).toBe(year);
    expect(legend.seasons).toBe(4);
    expect(legend.stints.map((s) => s.school)).toEqual(['Ridgemont State', 'Marbury Tech']);
    expect(legend.stints[0]).toMatchObject({ from: year - 3, to: year - 2, w: 64, l: 46, titles: 0 });
    expect(legend.stints[1]).toMatchObject({ from: year - 1, to: year, w: 79, l: 31, titles: 1 });
    expect(legend.score).toBeGreaterThan(0);

    /*
      And its own seasons, because `history` is thrown away the moment a
      successor is made — without these a legend on the wall could never open
      the year it won, and the roster that won it is looked up by year.
    */
    expect(legend.years).toHaveLength(4);
    expect(legend.years!.map((y) => y.year)).toEqual([year - 3, year - 2, year - 1, year]);
    expect(legend.years!.find((y) => y.year === year - 1)).toMatchObject({
      school: 'Marbury Tech', finish: 'champion', w: 41, l: 14,
    });
  });

  /*
    The roster of a coach's last season is the whole point of the ending: the
    men who won the title in his final June. `archiveSeason` has one other
    caller, the draft step, and a career that ends at the board meeting returns
    two steps before it — so without this the last team a man ever had was
    missing from the one screen that is about him.
  */
  it('writes his last season into the career book, which nothing else would', async () => {
    graded();
    const year = state().year;
    useDynasty.setState({ coach: { ...state().coach, farewellYear: year } });
    const squad = state().season!.teams[state().userTeam]!.team;
    const someone = squad.lineup[0]!;
    // A man with no line is never archived, played or not, so give him one.
    state().season!.batting.set(someone.id, {
      g: 52, ab: 190, r: 34, h: 61, d: 13, t: 1, hr: 9, rbi: 40,
      bb: 22, k: 31, hbp: 2, sb: 5, cs: 2,
    });

    await state().nextPhase('review');

    const rows = state().season?.careers?.[someone.id] ?? [];
    expect(rows.some((r) => r.year === year)).toBe(true);
  });

  it('keeps the seasons through the successor that wipes the history', async () => {
    graded();
    const year = state().year;
    useDynasty.setState({
      coach: { ...state().coach, farewellYear: year },
      history: [season(year - 1, 'Ridgemont State', 41, 14, 'champion'), season(year, 'Ridgemont State', 38, 17)],
    });
    await state().nextPhase('review');
    await state().startNewCoach({ ...DEFAULT_PROFILE, name: 'The Next One' });

    // His own history is gone, and the book still has his seasons in it.
    expect(state().history).toEqual([]);
    const mine = (state().season?.legends ?? []).find((l) => l.you);
    expect(mine?.years).toHaveLength(2);
    expect(mine?.years?.some((y) => y.finish === 'champion')).toBe(true);
  });

  /*
    `nextSeason` carries a named whitelist forward and empties everything else,
    so a book kept on the world is one line away from being wiped every June.
    `endCareer` rolls the year itself, which is exactly the path this walks.
  */
  it('survives the year roll that follows it', async () => {
    graded();
    useDynasty.setState({ coach: { ...state().coach, farewellYear: state().year } });
    await state().nextPhase('review');
    expect(state().season?.legends).toHaveLength(1);

    await state().rollYear();

    expect(state().season?.legends).toHaveLength(1);
  });

  it('writes one career once, however many times the button is pressed', async () => {
    graded();
    useDynasty.setState({ coach: { ...state().coach, farewellYear: state().year } });

    await state().endCareer();
    await state().endCareer();

    expect(state().season?.legends).toHaveLength(1);
  });

  it('rides the save file', async () => {
    graded();
    useDynasty.setState({ coach: { ...state().coach, farewellYear: state().year } });
    await state().nextPhase('review');

    const s = state();
    const file = buildSaveFile('slot', 'Test', s.season!, s.year, s.userTeam, {
      history: s.history, coach: s.coach,
    });
    expect(file.coach).toMatchObject({ retiredYear: s.coach.retiredYear });
    expect((file.season as { legends?: unknown[] }).legends).toHaveLength(1);
  });
});

/*
  The winter nobody watches.

  `departAndDevelop` — the pass that graduates every senior in the country and
  develops everybody who stays — runs at the draft step, and the two ways a
  tenure ends at the board meeting never reach it. So the league used to skip a
  whole year whenever a coach was sacked or retired: nobody left, nobody
  improved, and the next class signed onto rosters that had never been emptied.
  Neither exit shows the player any of it, which is why it went unnoticed.
*/
describe('the winter that runs whether or not he is there', () => {
  /** Everybody on a roster in the country, by id. */
  function everyone(): Set<string> {
    const ids = new Set<string>();
    for (const t of state().season?.teams ?? []) {
      for (const p of [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen]) {
        ids.add(String(p.id));
      }
    }
    return ids;
  }

  it('graduates the country when a career ends', async () => {
    graded();
    useDynasty.setState({ coach: { ...state().coach, farewellYear: state().year } });
    const before = everyone();
    expect(Object.keys(state().alumni)).toHaveLength(0);

    await state().nextPhase('review');

    // Men left, everywhere — not merely at his own school.
    const after = everyone();
    const gone = [...before].filter((id) => !after.has(id));
    expect(gone.length).toBeGreaterThan(20);
    // And his own last class is in the alumni book, which is the only place a
    // pro career is ever read from.
    expect(Object.keys(state().alumni).length).toBeGreaterThan(0);
  });

  it('does the same for a coach the board has sacked', async () => {
    graded();
    useDynasty.setState({ lastReview: { ...state().lastReview!, fired: true } });
    const before = everyone();

    await state().nextPhase('review');

    const after = everyone();
    expect([...before].filter((id) => !after.has(id)).length).toBeGreaterThan(20);
    expect(state().jobSearch).toBe(true);
  });
});

describe('the man who comes next', () => {
  /** Retire, then build the successor. Returns the world before and after. */
  async function succeed(): Promise<{ before: ReturnType<typeof state>; after: ReturnType<typeof state> }> {
    graded();
    useDynasty.setState({ coach: { ...state().coach, farewellYear: state().year } });
    await state().nextPhase('review');
    const before = state();
    await state().startNewCoach({ ...DEFAULT_PROFILE, name: 'Next Man' });
    return { before, after: state() };
  }

  it('keeps the world and drops the career', async () => {
    const { before, after } = await succeed();

    // The same world, still staffed and still remembering.
    expect(after.season).toBe(before.season);
    expect(after.season?.legends).toHaveLength(1);
    expect(after.season?.teams.filter((t) => t.coach).length)
      .toBe(before.season?.teams.filter((t) => t.coach).length);

    // And nothing of the man who left.
    expect(after.coach.name).toBe('Next Man');
    expect(after.coach.retiredYear).toBeUndefined();
    expect(after.coach.farewellYear).toBeUndefined();
    expect(after.history).toEqual([]);
    expect(after.coach.careerWins).toBe(0);
    expect(after.economy.tree ?? []).toEqual([]);
    expect(after.inbox).toEqual([]);
  });

  it('puts him on the market with somewhere to go', async () => {
    const { after } = await succeed();
    expect(after.jobSearch).toBe(true);
    expect(after.offers.length).toBeGreaterThan(0);
  });

  it('opens a door or two for whose staff he came off', async () => {
    graded();
    // A career worth remembering: the head start is read off its score.
    useDynasty.setState({
      coach: {
        ...state().coach, farewellYear: state().year,
        titles: 3, regionalTitles: 6, conferenceTitles: 9, careerWins: 800,
      },
    });
    await state().nextPhase('review');
    await state().startNewCoach({ ...DEFAULT_PROFILE, name: 'Protege' });

    expect(state().coach.prestige).toBeGreaterThan(ROOKIE_PRESTIGE);
  });

  it('starts a man with no mentor at the bottom', async () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ season: { ...state().season!, legends: [] } });
    await state().startNewCoach({ ...DEFAULT_PROFILE, name: 'Nobody' });
    expect(state().coach.prestige).toBe(ROOKIE_PRESTIGE);
  });
});
