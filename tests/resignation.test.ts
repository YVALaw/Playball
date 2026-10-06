// resignation.test.ts
// Handing in the job before the contract is up (2026-09-30: "a way to resign
// to our current job in case we would like to move on to a different team or
// something before our contract is up").
//
// The user's two answers are what this pins: "at season's end" — notice in the
// spring, the June meeting his last, and straight out once the season is
// graded — and "small hit per year left", two points of coach prestige per
// contract year walked out on, nothing in the final year.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  useDynasty, resignTerms, resignPending, PHASES, type SeasonRecord,
} from '../src/state/store.js';
import { resignationCost, restoreCoach } from '../src/engine/program.js';
import { rulesOf } from '../src/engine/season.js';
import { RECRUITING_WEEKS } from '../src/engine/recruiting.js';
import { buildSaveFile } from '../src/state/persistence.js';

// IndexedDB is not in node; the same Map-backed stand-in the saves suite uses,
// so the reloads below go through the real save and load.
const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_store: string, value: { slot: string }) => { disk.set(value.slot, structuredClone(value)); },
    get: async (_store: string, key: string) => {
      const found = disk.get(key);
      return found === undefined ? undefined : structuredClone(found);
    },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_store: string, key: string) => { disk.delete(key); },
  }),
}));

const state = () => useDynasty.getState();

/** The book row the meeting writes for a played season, for one never played. */
function ensureRow(): void {
  const year = state().year;
  if (state().history.some((h) => h.year === year)) return;
  const row: SeasonRecord = {
    year, w: 30, l: 26, cw: 15, cl: 13, confPlace: 3, rpi: 0.55,
    wonConference: false, finish: 'missed' as SeasonRecord['finish'],
    school: state().season?.teams[state().userTeam]?.def.school, nationalChampion: 'Somebody',
  };
  useDynasty.setState({ history: [...state().history, row] });
}

/** Who sits in a chair, by name. */
const chairCoach = (team: number): string | undefined => state().season?.teams[team]?.coach?.name;

/** A career in its first spring, with nothing played. */
function spring(seed = 4242, team = 0): void {
  useDynasty.getState().start(seed, team);
  // Young and early, so the years never call it inside a test.
  useDynasty.setState({ coach: { ...state().coach, age: 44 } });
}

/** A career, graded, with the board's verdict sitting in the store. */
function graded(seed = 4242, team = 0): void {
  spring(seed, team);
  state().settleSeason();
  useDynasty.setState({ phase: 'review' });
}

/** Through the meeting that closes a season he handed in his notice for. */
async function noticeAndMeeting(): Promise<void> {
  await state().resign();
  state().settleSeason();
  useDynasty.setState({ phase: 'review' });
}

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

const carouselTitles = (): string[] =>
  state().inbox.filter((i) => i.kind === 'carousel').map((i) => i.title);

describe('handing it in', () => {
  it('is notice in the spring: the flag, one letter, and the season left alone', async () => {
    spring();
    const year = state().year;
    const season = state().season;
    expect(resignTerms(state())?.when).toBe('notice');

    await state().resign();

    expect(state().coach.resignYear).toBe(year);
    expect(state().season).toBe(season);
    expect(state().phase).toBeNull();
    expect(state().jobSearch).toBe(false);
    expect(carouselTitles().filter((t) => t.includes('will leave'))).toHaveLength(1);

    // No take-backs, and no second letter.
    expect(resignTerms(state())).toBeNull();
    await state().resign();
    expect(state().coach.resignYear).toBe(year);
    expect(carouselTitles().filter((t) => t.includes('will leave'))).toHaveLength(1);
  });

  it('is still notice in an offseason whose meeting has not happened', () => {
    spring();
    useDynasty.setState({ phase: 'awards' });
    expect(resignTerms(state())?.when).toBe('notice');
  });

  it('counts a save past the meeting as graded, whatever it lost on the way', () => {
    spring();
    useDynasty.setState({ phase: 'coach', furthestPhase: PHASES.indexOf('coach'), lastReview: null });
    expect(resignTerms(state())?.when).toBe('now');

    // Walked back to a step before the meeting, with no review and no row for
    // the year: only how far the rail got says the season is graded.
    spring();
    useDynasty.setState({ phase: 'awards', furthestPhase: PHASES.indexOf('coach'), lastReview: null });
    expect(state().history.some((h) => h.year === state().year)).toBe(false);
    expect(resignTerms(state())?.when).toBe('now');
  });

  it('is not offered in the season the years will call it', () => {
    // The thirtieth season, in the spring: the book holds twenty-nine, and the
    // meeting will write the one that ends it.
    spring();
    useDynasty.setState({ coach: { ...state().coach, tenure: 29 } });
    expect(resignTerms(state())).toBeNull();
    useDynasty.setState({ phase: 'awards' });
    expect(resignTerms(state())).toBeNull();

    // The twenty-ninth still is.
    spring();
    useDynasty.setState({ coach: { ...state().coach, tenure: 28 } });
    expect(resignTerms(state())?.when).toBe('notice');

    // And a notice somehow standing in that season is not a pending resignation.
    spring();
    useDynasty.setState({ coach: { ...state().coach, tenure: 29, resignYear: state().year } });
    expect(resignPending(state())).toBe(false);
  });

  it('is refused during a sim, and says nothing', async () => {
    spring();
    useDynasty.setState({ busy: true });
    await state().resign();
    expect(state().coach.resignYear).toBeUndefined();
    useDynasty.setState({ busy: false });
  });
});

describe('the meeting', () => {
  it('cannot sack a man on notice', async () => {
    spring();
    const firing = rulesOf(state().season).firing;
    await state().resign();
    useDynasty.setState({ coach: { ...state().coach, security: 0, tenure: 3, badRun: 2 } });
    state().settleSeason();
    expect(state().lastReview?.fired).toBe(false);
    expect(state().lastReview?.notRenewed).toBe(false);

    // The control: the same seat without the notice does get the door.
    if (firing) {
      spring();
      useDynasty.setState({ coach: { ...state().coach, security: 0, tenure: 3, badRun: 2 } });
      state().settleSeason();
      expect(state().lastReview?.fired).toBe(true);
    }
  });

  it('neither renews nor extends him, and does not talk about next year', async () => {
    spring();
    await state().resign();
    useDynasty.setState({ coach: { ...state().coach, contractYears: 1, security: 95 } });
    state().settleSeason();
    const review = state().lastReview!;
    expect(review.renewed).toBe(false);
    expect(review.extended).toBe(false);
    expect(review.contractYears).toBe(0);
    expect(review.headline).toBeUndefined();
    expect(review.message).toMatch(/next man/);

    spring();
    await state().resign();
    useDynasty.setState({ coach: { ...state().coach, contractYears: 3, security: 95 } });
    state().settleSeason();
    expect(state().lastReview?.contractYears).toBe(2);
  });

  it('puts his chair on the rival carousel', async () => {
    spring();
    await state().resign();
    state().settleSeason();
    expect(state().season?.teams[state().userTeam]?.coach).toBeDefined();

    spring();
    state().settleSeason();
    expect(state().season?.teams[state().userTeam]?.coach).toBeUndefined();
  });
});

describe('leaving the meeting', () => {
  it('puts him on the market, his old school nowhere on it', async () => {
    spring();
    const old = state().userTeam;
    const year = state().year;
    await noticeAndMeeting();

    await state().nextPhase('review');

    const after = state();
    expect(after.jobSearch).toBe(true);
    expect(after.phase).toBeNull();
    expect(after.year).toBe(year + 1);
    expect(after.offers.length).toBeGreaterThan(0);
    expect(after.offers.every((o) => o.team !== old)).toBe(true);
    expect(after.coach.retiredYear).toBeUndefined();
    // One line on the new desk says he left.
    expect(carouselTitles().some((t) => t.includes(' leaves '))).toBe(true);
  });

  it('runs the league winter he never sees', async () => {
    spring();
    await noticeAndMeeting();
    const before = everyone();

    await state().nextPhase('review');

    const after = everyone();
    expect([...before].filter((id) => !after.has(id)).length).toBeGreaterThan(20);
    expect(Object.keys(state().alumni).length).toBeGreaterThan(0);
  });

  it('costs two points of prestige per contract year left', async () => {
    spring();
    useDynasty.setState({ coach: { ...state().coach, contractYears: 3, prestige: 50 } });
    expect(resignTerms(state())?.years).toBe(2);
    expect(resignTerms(state())?.cost).toBe(4);
    await noticeAndMeeting();
    const p = state().coach.prestige;

    await state().nextPhase('review');

    expect(state().coach.prestige).toBe(p - 4);
    expect(resignationCost(3)).toBe(6);
    expect(resignationCost(0)).toBe(0);
    expect(resignationCost(-1)).toBe(0);
  });

  it('is free in the final year of the deal', async () => {
    spring();
    useDynasty.setState({ coach: { ...state().coach, contractYears: 1, prestige: 50 } });
    expect(resignTerms(state())?.cost).toBe(0);
    await noticeAndMeeting();
    const p = state().coach.prestige;

    await state().nextPhase('review');

    expect(state().coach.prestige).toBe(p);
  });

  it('prices the exit off the coach, so a dismissed review card cannot hide it', async () => {
    spring();
    useDynasty.setState({ coach: { ...state().coach, contractYears: 3, prestige: 50 } });
    await noticeAndMeeting();
    // The Board room's Continue on the review card, during the step.
    state().clearReview();
    // Hidden, not thrown away: the roll still needs it for next season's
    // terms (audit 17, M74).
    expect(state().reviewDismissed).toBe(true);
    // What the review screen prints, read off the coach.
    const shown = resignationCost(state().coach.contractYears);
    expect(shown).toBe(4);
    const p = state().coach.prestige;

    await state().nextPhase('review');

    expect(state().coach.prestige).toBe(p - shown);
    // The screen reads the coach, not the review.
    const src = readFileSync(new URL('../src/ui/screens/SeasonReview.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/const cost = resigning \? resignationCost\(coach\.contractYears\) : 0/);
    expect(src).not.toMatch(/resignationCost\(review\.contractYears\)/);
  });

  it('keeps its letter through a reload on the market', async () => {
    spring();
    await noticeAndMeeting();
    // Opened from a named slot, so the saves below land where we read them.
    expect(await state().saveNow('resign-letter')).toBe(true);
    expect(await state().loadSlot('resign-letter')).toBe(true);

    await state().nextPhase('review');
    expect(state().jobSearch).toBe(true);
    expect(carouselTitles().some((t) => t.includes(' leaves '))).toBe(true);

    useDynasty.setState({ inbox: [] });
    expect(await state().loadSlot('resign-letter')).toBe(true);
    expect(state().jobSearch).toBe(true);
    expect(carouselTitles().some((t) => t.includes(' leaves '))).toBe(true);
  });

  it('runs the winter and the charge once, when the roll fails and he leaves again', async () => {
    spring();
    useDynasty.setState({ coach: { ...state().coach, contractYears: 3, prestige: 50 } });
    await noticeAndMeeting();
    ensureRow();
    const year = state().year;
    const p = state().coach.prestige;
    const roll = state().rollYear;
    // A roll that goes nowhere: the year stays, and the rail is off the steps.
    useDynasty.setState({ rollYear: async () => {} });
    try {
      await state().nextPhase('review');
      expect(state().year).toBe(year);
      expect(state().phase).toBeNull();
      expect(state().furthestPhase).toBeGreaterThanOrEqual(PHASES.indexOf('draft'));
      expect(state().coach.prestige).toBe(p - 4);
      const once = everyone();

      // Back through the meeting and out again.
      state().goPhase('review');
      expect(state().phase).toBe('review');
      await state().nextPhase('review');

      expect(state().coach.prestige).toBe(p - 4);
      // No second class left the country.
      expect(everyone()).toEqual(once);
    } finally {
      useDynasty.setState({ rollYear: roll });
    }

    // And the real roll still gets him to the market.
    state().goPhase('review');
    await state().nextPhase('review');
    expect(state().jobSearch).toBe(true);
    expect(state().year).toBe(year + 1);
    expect(state().coach.prestige).toBe(p - 4);
  });

  it('writes the resignation into the book', async () => {
    spring();
    const year = state().year;
    await noticeAndMeeting();
    // The meeting writes the row for a finished season; this one was never
    // played, so it is written here the way the meeting would have.
    const row0: SeasonRecord = {
      year, w: 30, l: 26, cw: 15, cl: 13, confPlace: 3, rpi: 0.55,
      wonConference: false, finish: 'missed' as SeasonRecord['finish'],
      school: state().season?.teams[state().userTeam]?.def.school, nationalChampion: 'Somebody',
    };
    if (!state().history.some((h) => h.year === year)) {
      useDynasty.setState({ history: [...state().history, row0] });
    }

    await state().nextPhase('review');

    const row = state().history.find((h: SeasonRecord) => h.year === year);
    expect(row?.resigned).toBe(true);
  });
});

describe('resigning after the meeting', () => {
  it('goes to the market today, and pays for the years left', async () => {
    graded();
    const old = state().userTeam;
    const year = state().year;
    useDynasty.setState({ coach: { ...state().coach, contractYears: 2, prestige: 50 } });
    expect(resignTerms(state())?.when).toBe('now');
    expect(resignTerms(state())?.cost).toBe(4);
    const p = state().coach.prestige;
    const before = everyone();

    await state().resign();

    const after = state();
    expect(after.jobSearch).toBe(true);
    expect(after.phase).toBeNull();
    expect(after.year).toBe(year + 1);
    expect(after.coach.prestige).toBe(p - 4);
    expect(after.offers.length).toBeGreaterThan(0);
    expect(after.offers.every((o) => o.team !== old)).toBe(true);
    expect(after.overlay).toBeNull();
    expect(carouselTitles().filter((t) => t.includes(' leaves '))).toHaveLength(1);
    const now = everyone();
    expect([...before].filter((id) => !now.has(id)).length).toBeGreaterThan(20);
  });

  it('closes the portal for everybody when pressed on the portal step', async () => {
    graded();
    if (!rulesOf(state().season).portal) return;
    useDynasty.setState({ coach: { ...state().coach, age: 44 } });
    await state().nextPhase('review');
    await state().nextPhase('coach');
    await state().nextPhase('draft');
    expect(state().phase).toBe('portal');
    expect(state().portal).not.toBeNull();
    const old = state().userTeam;
    const leaving = (state().portal?.leaving ?? []).map((m) => String(m.player.id));

    await state().resign();

    expect(state().jobSearch).toBe(true);
    expect(state().portal).toBeNull();
    expect(state().portalArrivals).toEqual([]);
    const rec = state().season?.teams[old];
    const still = new Set(
      [...(rec?.team.lineup ?? []), ...(rec?.team.bench ?? []), ...(rec?.team.rotation ?? []), ...(rec?.team.bullpen ?? [])]
        .map((p) => String(p.id)),
    );
    expect(leaving.filter((id) => still.has(id))).toEqual([]);
  });
});

describe('a new chair', () => {
  it('takes the notice off him, and the new board keeps him', async () => {
    spring();
    const old = state().userTeam;
    await state().resign();
    const target = state().season!.teams.find((t) => t.index !== old)!;
    useDynasty.setState({
      offers: [{
        team: target.index, school: target.def.school, conference: target.conference,
        prestige: target.prestige, pitch: 'x',
      }],
    });

    await state().acceptOffer(target.index);

    expect(state().coach.resignYear).toBeUndefined();
    expect(state().userTeam).toBe(target.index);

    state().settleSeason();
    useDynasty.setState({ phase: 'review' });
    await state().nextPhase('review');
    expect(state().jobSearch).toBe(false);
    expect(state().phase).not.toBeNull();
  });

  it('leaves the old school a recruiting board to work', async () => {
    graded();
    const old = state().userTeam;
    await state().resign();
    const season = state().season!;
    const week = season.recruiting.week;
    // The roll opens the new class's window with the spring.
    expect(week).toBeGreaterThanOrEqual(1);
    const offer = state().offers[0]!;

    await state().acceptOffer(offer.team);

    if (week >= 1 && week <= RECRUITING_WEEKS) {
      expect(season.recruiting.prospects.some((p) => (p.points[old] ?? 0) > 0)).toBe(true);
    }
  });
});

describe('retirement wins', () => {
  it('ends the career when both are pending, and charges nothing', async () => {
    spring();
    const year = state().year;
    useDynasty.setState({ coach: { ...state().coach, contractYears: 3 } });
    await state().resign();
    state().announceRetirement();
    expect(state().coach.farewellYear).toBe(year);
    expect(resignTerms(state())).toBeNull();
    state().settleSeason();
    useDynasty.setState({ phase: 'review' });
    const p = state().coach.prestige;

    await state().nextPhase('review');

    expect(state().coach.retiredYear).toBe(year);
    expect(state().jobSearch).toBe(false);
    expect(state().offers).toEqual([]);
    expect(state().coach.prestige).toBe(p);
    // Nobody wrote to a retired man.
    expect(state().inbox.some((i) => i.kind === 'offer')).toBe(false);
  });

  it('hides the door once a farewell is announced', async () => {
    spring();
    state().announceRetirement();
    await state().resign();
    expect(state().coach.resignYear).toBeUndefined();
  });

  it('takes the notice off the signposts once a farewell overtakes it', async () => {
    spring();
    await state().resign();
    expect(resignPending(state())).toBe(true);
    state().announceRetirement();
    expect(resignPending(state())).toBe(false);
    expect(resignTerms(state())).toBeNull();
    // The Board's row and the coach page's callout both read it.
    const src = readFileSync(new URL('../src/ui/screens/Program.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/\(canResign \|\| onNotice\)/);
    expect(src).toMatch(/const pending = useDynasty\(resignPending\)/);
  });

  it('is closed to a sacked, unemployed or retired man', () => {
    graded();
    useDynasty.setState({ lastReview: { ...state().lastReview!, fired: true } });
    expect(resignTerms(state())).toBeNull();

    graded();
    useDynasty.setState({ jobSearch: true });
    expect(resignTerms(state())).toBeNull();

    graded();
    useDynasty.setState({ jobSearch: false, coach: { ...state().coach, retiredYear: state().year } });
    expect(resignTerms(state())).toBeNull();
  });
});

describe('the save', () => {
  it('carries the notice through a save and a load', async () => {
    spring();
    const year = state().year;
    await state().resign();
    const s = state();
    const file = buildSaveFile('slot', 'Test', s.season!, s.year, s.userTeam, {
      history: s.history, coach: s.coach,
    });
    expect((file.coach as { resignYear?: number }).resignYear).toBe(year);
    expect(restoreCoach(JSON.parse(JSON.stringify(file)).coach).resignYear).toBe(year);
  });

  it('keeps the successor in the chair he left across reloads', async () => {
    spring();
    const old = state().userTeam;
    await noticeAndMeeting();
    const successor = chairCoach(old);
    expect(successor).toBeDefined();

    // At the meeting.
    expect(await state().saveNow('resign-chair')).toBe(true);
    expect(await state().loadSlot('resign-chair')).toBe(true);
    expect(chairCoach(old)).toBe(successor);

    // And on the market after it.
    await state().nextPhase('review');
    const onMarket = chairCoach(old);
    const offers = state().offers.map((o) => o.team);
    expect(onMarket).toBeDefined();
    expect(await state().saveNow('resign-chair')).toBe(true);
    expect(await state().loadSlot('resign-chair')).toBe(true);
    expect(state().jobSearch).toBe(true);
    expect(state().offers.map((o) => o.team)).toEqual(offers);
    expect(chairCoach(old)).toBe(onMarket);
  });

  it('keeps the successor for a sacked man reloaded at the meeting', async () => {
    spring();
    if (!rulesOf(state().season).firing) return;
    const old = state().userTeam;
    useDynasty.setState({ coach: { ...state().coach, security: 0, tenure: 3, badRun: 2 } });
    state().settleSeason();
    useDynasty.setState({ phase: 'review' });
    expect(state().lastReview?.fired).toBe(true);
    const successor = chairCoach(old);
    expect(successor).toBeDefined();

    expect(await state().saveNow('fired-chair')).toBe(true);
    expect(await state().loadSlot('fired-chair')).toBe(true);
    expect(chairCoach(old)).toBe(successor);
  });

  it('adds no step to the offseason', () => {
    expect(PHASES).toEqual(['awards', 'review', 'coach', 'draft', 'portal', 'signing']);
  });
});
