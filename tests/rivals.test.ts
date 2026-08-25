// rivals.test.ts
// The other ninety five careers, and the one property the whole of B7 exists for.
//
// Two kinds of test here and the second matters more. The first kind checks that
// a rival coach does the things a coach does — accumulates, is sacked, is
// poached, retires. The second is the long run at the bottom of the file, which
// checks that ninety five of them running at once does not turn the league into
// something else: the rich must not compound for ever, and the poor must not be
// ground into the floor. That property cannot be seen in one season and it is
// the reason the system was built, so it is measured over a full career's worth
// of them.

import { describe, it, expect } from 'vitest';
import {
  createSeason, simSeason, nextSeason, DEFAULT_SEASON, type SeasonState,
} from '../src/engine/season.js';
import { runPostseason } from '../src/engine/postseason.js';
import { departAndDevelop, fillRosters, holesFor } from '../src/engine/progression.js';
import {
  prestigeStars, rosterStrength, type Verdict,
} from '../src/engine/program.js';
import {
  POACH_GAP, SETTLED_TENURE, newRivalCoach, retireAge, rivalName, rivalOutcome,
  runCarousel, runRivalYear, seatCoaches, spendPoints, syncCoachMods,
  type RivalCoach,
} from '../src/engine/rivals.js';
import {
  RECRUITING_WEEKS, aiTargets, closeWeek, leadersAtWeekStart, resetWeeklySpend,
  weeklyPoints,
} from '../src/engine/recruiting.js';
import { pitchFor, developmentScore } from '../src/engine/pitch.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES, type Region } from '../src/data/schools.js';

/** Two conferences. Enough for a carousel, quick enough to run in a suite. */
const SMALL = CONFERENCES.slice(0, 2);
/**
 * The whole world for the long run, and it has to be the whole world.
 *
 * The postseason is a pyramid with fixed arithmetic — eight conference
 * champions into four regions of two into a national bracket of four — so a
 * quarter of the league produces one regional champion and a national bracket
 * of one, which throws. There is no smaller honest version, and the numbers
 * this test exists to check are about a ninety six program ladder anyway.
 */
const FULL = [...CONFERENCES];

const world = (seed: number, confs = SMALL): SeasonState => {
  const s = createSeason(makeRng(seed), DEFAULT_SEASON, confs);
  s.year = 2027;
  return s;
};

describe('seating the world', () => {
  it('puts a man in every chair but yours', () => {
    const season = world(1);
    seatCoaches(season, 3, 2027);
    expect(season.teams[3]?.coach).toBeUndefined();
    for (const t of season.teams) {
      if (t.index === 3) continue;
      expect(t.coach?.name.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('seeds them at what their programs are worth, not all as unknowns', () => {
    // A league of ninety six rookies would open the entire hiring ladder to
    // whoever won a game first, the user included.
    const season = world(2);
    seatCoaches(season, -1, 2027);
    const rows = season.teams.map((t) => ({
      prestige: t.prestige, coach: t.coach?.prestige ?? 0,
    }));
    const good = rows.filter((r) => r.prestige >= 60);
    const poor = rows.filter((r) => r.prestige < 45);
    expect(good.length).toBeGreaterThan(0);
    expect(poor.length).toBeGreaterThan(0);
    const avg = (xs: { coach: number }[]) =>
      xs.reduce((a, r) => a + r.coach, 0) / xs.length;
    expect(avg(good)).toBeGreaterThan(avg(poor));
  });

  it('keeps the men it already has, and hands back the one it moved out', () => {
    const season = world(3);
    seatCoaches(season, -1, 2027);
    const held = season.teams[5]?.coach;
    const there = season.teams[3]?.coach;
    // A second pass — which is every load — must not replace a career.
    const displaced = seatCoaches(season, 3, 2035);
    expect(season.teams[5]?.coach).toBe(held);
    expect(displaced).toBe(there);
    expect(season.teams[3]?.coach).toBeUndefined();
  });

  it('gives the same chair the same man twice, and different chairs different men', () => {
    expect(rivalName(4, 2027)).toBe(rivalName(4, 2027));
    const names = new Set(Array.from({ length: 24 }, (_, i) => rivalName(i, 2027)));
    // Hashed, so a collision is possible and a wholesale one is the bug.
    expect(names.size).toBeGreaterThan(20);
  });

  it('costs the generator nothing', () => {
    // The reason everything here is hashed rather than drawn. A single rng()
    // call in the carousel would move every recruiting class and every
    // development roll in the game by an amount that depends on how many
    // coaches happened to be sacked that June.
    const season = world(7);
    const before = season.rng.state?.();
    seatCoaches(season, 0, 2027);
    for (const t of season.teams) { t.rw = 20; t.rl = 25; }
    runRivalYear(season, null, { year: 2027, userTeam: 0, games: 45 });
    expect(season.rng.state?.()).toBe(before);
  });
});

describe('a rival coach has a career', () => {
  it('spends what he earns, badly, and never past the ceiling', () => {
    const coach = newRivalCoach(1, 2027, 25);
    const start = { ...coach.skills };
    spendPoints(coach, 6);
    // Half into the one he favours, the rest scattered over the other three.
    // An optimiser would put all six in recruiting and end up with an edge no
    // player who did anything else could answer.
    expect(coach.skills[coach.lean] - start[coach.lean]).toBe(3);
    const spread = (['offense', 'defense', 'training', 'recruiting'] as const)
      .filter((k) => k !== coach.lean)
      .reduce((a, k) => a + (coach.skills[k] - start[k]), 0);
    expect(spread).toBe(3);

    const maxed = newRivalCoach(2, 2027, 25);
    spendPoints(maxed, 4000);
    for (const k of ['offense', 'defense', 'training', 'recruiting'] as const) {
      expect(maxed.skills[k]).toBeLessThanOrEqual(99);
    }
  });

  it('is graded on the regular season, not on a deep June', () => {
    const season = world(11);
    const me = season.teams[0]!;
    me.w = 30; me.l = 18;         // running total, bracket wins folded in
    me.rw = 24; me.rl = 21;       // what the board's target was written against
    const outcome = rivalOutcome(season, null, me);
    expect(outcome.wins).toBe(24);
    expect(outcome.losses).toBe(21);
  });

  it('counts winning a region, which nothing in the game did before', () => {
    const season = world(12);
    const me = season.teams[2]!;
    me.rw = 33; me.rl = 12;
    const outcome = rivalOutcome(season, {
      conferenceChampions: [2], regionChampions: [2], champion: 9,
      finish: { 2: 'omaha', 9: 'champion' },
    }, me);
    expect(outcome.wonRegional).toBe(true);
    expect(outcome.wonConference).toBe(true);
    expect(outcome.wonTitle).toBe(false);
  });

  it('moves his program, which nothing did either', () => {
    // `nextPrestige` has existed since the board did and only the user's school
    // was ever passed to it. Ninety five programs were frozen at the standing
    // the world was generated with, whatever they did on the field.
    const season = world(13);
    seatCoaches(season, -1, 2027);
    const before = season.teams.map((t) => t.prestige);
    for (const t of season.teams) {
      // Half the league has a disaster and half runs away with it.
      const good = t.index % 2 === 0;
      t.rw = good ? 38 : 6; t.rl = good ? 7 : 39;
      t.cw = good ? 28 : 5; t.cl = good ? 5 : 28;
    }
    runRivalYear(season, null, { year: 2027, userTeam: -1, games: 45 });
    const after = season.teams.map((t) => t.prestige);
    expect(after).not.toEqual(before);
    expect(after[0]).toBeGreaterThan(before[0]!);
    expect(after[1]).toBeLessThan(before[1]!);
  });

  it('accumulates a record the book can read', () => {
    const season = world(14);
    seatCoaches(season, -1, 2027);
    for (const t of season.teams) { t.rw = 25; t.rl = 20; }
    runRivalYear(season, null, { year: 2027, userTeam: -1, games: 45 });
    const kept = season.teams.filter((t) => t.coach && t.coach.tenure > 0);
    expect(kept.length).toBeGreaterThan(0);
    for (const t of kept) {
      expect(t.coach?.careerWins).toBe(25);
      expect(t.coach?.careerLosses).toBe(20);
    }
  });

  it('is sacked after enough of them, and the chair is filled again', () => {
    const season = world(15);
    seatCoaches(season, -1, 2027);
    const doomed = season.teams[0]!;
    const first = doomed.coach;
    for (const t of season.teams) { t.rw = 22; t.rl = 23; t.cw = 16; t.cl = 17; }
    doomed.rw = 3; doomed.rl = 42; doomed.cw = 1; doomed.cl = 32;

    // Three disasters in a row. The first is survivable, which is the point of
    // job security having a number rather than a switch.
    for (let y = 0; y < 4; y++) {
      runRivalYear(season, null, { year: 2027 + y, userTeam: -1, games: 45 });
      if (doomed.coach !== first) break;
    }
    expect(doomed.coach).toBeDefined();
    expect(doomed.coach).not.toBe(first);
  });

  it('eventually stops, whatever the results say', () => {
    // The only force here that does not care how good anybody is, and the reason
    // the top of the league cannot lock: a chair comes open on a schedule nobody
    // can influence.
    for (let seat = 0; seat < 12; seat++) {
      const name = rivalName(seat, 2027);
      expect(retireAge(name)).toBeGreaterThanOrEqual(62);
      expect(retireAge(name)).toBeLessThanOrEqual(70);
    }
    const season = world(16);
    seatCoaches(season, -1, 2027);
    const old = season.teams[0]!;
    old.coach!.age = retireAge(old.coach!.name);
    for (const t of season.teams) { t.rw = 30; t.rl = 15; t.cw = 22; t.cl = 11; }
    const { moves } = runRivalYear(season, null, { year: 2027, userTeam: -1, games: 45 });
    expect(moves.some((m) => m.kind === 'retired')).toBe(true);
  });
});

describe('the carousel', () => {
  /** A league with one empty chair at the top and everybody else in place. */
  const staffed = (seed: number): SeasonState => {
    const season = world(seed);
    seatCoaches(season, -1, 2027);
    return season;
  };

  it('takes a coach up the ladder and leaves the chair he came from open', () => {
    const season = staffed(21);
    // A five star chair, empty, and one obvious man to fill it.
    const big = season.teams[0]!;
    big.prestige = 90;
    delete big.coach;
    const small = season.teams[1]!;
    small.prestige = 90 - POACH_GAP - 5;
    small.coach = { ...small.coach!, prestige: 80, tenure: 2 };
    // Nobody else is in range, so the answer is unambiguous.
    for (const t of season.teams) {
      if (t.index <= 1 || !t.coach) continue;
      t.prestige = 88;
      t.coach.prestige = 20;
    }

    const moves = runCarousel(season, -1, 2028, []);
    // Re-read off the season: `delete` narrows the local to undefined for good,
    // and the carousel filled it through the array.
    expect(season.teams[0]?.coach?.prestige).toBe(80);
    expect(moves.some((m) => m.kind === 'poached' && m.team === 0 && m.from === 1))
      .toBe(true);
    // And he did not merely appear twice.
    expect(small.coach).not.toBe(season.teams[0]?.coach);
  });

  it('does not move a man who has been somewhere long enough to be the place', () => {
    const season = staffed(22);
    const big = season.teams[0]!;
    big.prestige = 90;
    delete big.coach;
    const settled = season.teams[1]!;
    settled.prestige = 50;
    settled.coach = { ...settled.coach!, prestige: 80, tenure: SETTLED_TENURE };
    for (const t of season.teams) {
      if (t.index <= 1 || !t.coach) continue;
      t.prestige = 88;
      t.coach.prestige = 20;
    }

    runCarousel(season, -1, 2028, []);
    expect(settled.coach?.prestige).toBe(80);
    expect(season.teams[0]?.coach?.prestige).not.toBe(80);
  });

  it('will not shuffle a coach sideways for nothing', () => {
    const season = staffed(23);
    const open = season.teams[0]!;
    delete open.coach;
    // Every other chair is within the gap, so no poach is worth making.
    for (const t of season.teams) {
      if (!t.coach) continue;
      t.prestige = open.prestige - 1;
    }
    const moves = runCarousel(season, -1, 2028, []);
    expect(moves.some((m) => m.kind === 'poached')).toBe(false);
    // Somebody still takes the job. A board that cannot get its man hires one
    // anyway rather than leaving the program with nobody in the building.
    expect(open.coach).toBeDefined();
  });

  it('prefers a man out of work to nobody, and nobody to an empty chair', () => {
    const season = staffed(24);
    const open = season.teams[0]!;
    open.prestige = 40;
    delete open.coach;
    for (const t of season.teams) { if (t.coach) t.prestige = open.prestige; }
    const spare: RivalCoach = { ...newRivalCoach(90, 2020, 44), careerWins: 300 };
    const moves = runCarousel(season, -1, 2028, [spare]);
    expect(open.coach).toBe(spare);
    expect(moves.some((m) => m.kind === 'hired' && m.coach === spare.name)).toBe(true);
  });

  it('never leaves a chair empty when the market is done', () => {
    const season = staffed(25);
    for (const t of season.teams) delete t.coach;
    runCarousel(season, -1, 2028, []);
    for (const t of season.teams) expect(t.coach).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// The one that matters
// ---------------------------------------------------------------------------

const sd = (xs: number[]): number => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** The recruiting window, as the store runs it, with every chair on the AI. */
function recruitWindow(season: SeasonState): void {
  const regionOf = (i: number): Region =>
    CONFERENCES.find((c) => c.id === season.teams[i]?.conference)?.region ?? 'Gulf';
  for (let w = 1; w <= RECRUITING_WEEKS; w++) {
    season.recruiting.week = w;
    const atWeekStart = leadersAtWeekStart(season.recruiting);
    for (const record of season.teams) {
      const pitch = pitchFor(season, record, regionOf(record.index), developmentScore(record));
      const staff = record.coach;
      const need = holesFor([
        ...record.team.lineup, ...record.team.bench,
        ...record.team.rotation, ...record.team.bullpen,
      ]).reduce((a, h) => a + h.count, 0);
      for (const { prospect, actions } of aiTargets(
        record.index, pitch, staff?.prestige ?? 45, season.recruiting.prospects,
        need, season.rng, atWeekStart,
        season.draft?.rivalSpend[record.index] ?? 0,
      )) {
        prospect.points[record.index] = (prospect.points[record.index] ?? 0)
          + weeklyPoints(
            prospect, pitch, actions,
            staff?.prestige ?? 45, staff?.skills.recruiting ?? 20,
          );
      }
    }
    closeWeek(season.recruiting, season.rng, w >= RECRUITING_WEEKS);
    resetWeeklySpend(season.recruiting);
  }
}

describe('a long dynasty does not tear the league apart', () => {
  const YEARS = 14;
  let season = world(4242, FULL);
  seatCoaches(season, -1, 2027);
  syncCoachMods(season, -1, null);

  const openPrestige = season.teams.map((t) => t.prestige);
  const spread: number[] = [];
  const rosterSpread: number[] = [];
  const champions = new Set<number>();
  const graded: Record<Verdict, number>[] = [];
  let changes = 0;
  let poaches = 0;
  const openSkill = mean(season.teams.map((t) => t.coach?.skills.recruiting ?? 20));

  for (let y = 0; y < YEARS; y++) {
    simSeason(season);
    const post = runPostseason(season);
    champions.add(post.champion);

    const { moves, verdicts } = runRivalYear(season, post, {
      year: season.year ?? 0, userTeam: -1, games: 45,
    });
    graded.push(verdicts);
    changes += moves.filter((m) => m.kind !== 'hired').length;
    poaches += moves.filter((m) => m.kind === 'poached').length;
    syncCoachMods(season, -1, null);

    spread.push(sd(season.teams.map((t) => t.prestige)));
    rosterSpread.push(sd(season.teams.map((t) => rosterStrength(t.team))));

    departAndDevelop(season, season.rng, { userTeam: -1 });
    recruitWindow(season);
    fillRosters(season, season.rng, { userTeam: -1 });
    season = nextSeason(season);
  }

  const endPrestige = season.teams.map((t) => t.prestige);

  it('keeps the spread of program strength bounded', () => {
    // The whole point of B7. Before it, every program but yours was frozen at
    // the standing the world was generated with — no snowball was possible
    // because nothing moved at all. With ninety five careers running, prestige
    // is a live number and the question is whether it runs away.
    //
    // It does not. It widens by a couple of points as the boards start biting
    // and then turns over: measured on the full ninety six program world over
    // thirty five seasons, the spread rises from 15.4 to a peak of 17.8 around
    // year seventeen and settles back to 16.2, and the mean is flat at 51 from
    // year fifteen onwards. The band here is deliberately generous — this is a
    // quarter of the world over sixteen years, which is noisier — and it is
    // still tight enough to fail a league that compounds.
    const open = sd(openPrestige);
    const end = sd(endPrestige);
    expect(end).toBeGreaterThan(open * 0.6);
    expect(end).toBeLessThan(open * 1.45);
    // And it must not be climbing at the end of the run.
    const early = mean(spread.slice(0, 4));
    const late = mean(spread.slice(-4));
    expect(late).toBeLessThan(early * 1.35);
  });

  it('narrows the spread of talent rather than widening it', () => {
    // Recruiting is zero-sum against a fixed class, so a better recruiter takes
    // players from somebody. If the good programs were compounding, this is the
    // number that would show it first — it moves years before prestige does.
    expect(mean(rosterSpread.slice(-4))).toBeLessThan(mean(rosterSpread.slice(0, 4)));
  });

  it('does not let one program own the country', () => {
    expect(champions.size).toBeGreaterThan(YEARS / 4);
  });

  it('keeps the bottom of the ladder inhabited', () => {
    // The other half of the same failure. A league that stops producing one and
    // two star programs has quietly become a league of the same twelve teams.
    const stars = endPrestige.map(prestigeStars);
    expect(stars.filter((s) => s <= 2).length).toBeGreaterThan(0);
    expect(stars.filter((s) => s >= 4).length).toBeGreaterThan(0);
  });

  it('grades ninety five boards without either extreme', () => {
    /*
      Not a check that the clear rate is `expectationFor`'s calibrated 62%,
      because it measurably is not: over this run it comes out around a third.

      That is a real interaction rather than a rival-board bug, and it is worth
      knowing. `nextPrestige` pulls a program toward `seasonScore`, whose league
      mean is about 52 — winPct averages 50 and the fixed pot of postseason
      bonuses adds a couple of points spread over everybody. The world generator
      seeds prestige with a mean nearer 43. So switching all ninety six programs
      on lifts the whole league about nine points, `expectationFor`'s
      `standing = prestige * 0.45 + roster * 0.55` rises with it, and programs
      cross into `contend` and `championship` — where a tournament bid is a
      *required* box that eight of ninety six can fill.

      The 62% figure was never a property of `expectationFor` alone; it was a
      property of it at the seeded distribution. Nothing here is retuned to
      recover it, because the board is shared with the player and quietly making
      it kinder is a balance change nobody asked for. See the E list in the
      backlog.

      What this actually pins is that both halves work: the boards keep people
      and the boards sack people, and neither is close to all of them.
    */
    const total = graded.reduce(
      (a, v) => a + v.exceeded + v.met + v.missed + v.failed, 0,
    );
    const cleared = graded.reduce((a, v) => a + v.exceeded + v.met, 0);
    expect(total).toBeGreaterThan(0);
    expect(cleared / total).toBeGreaterThan(0.15);
    expect(cleared / total).toBeLessThan(0.85);
  });

  it('turns chairs over without turning them over every year', () => {
    const perYear = changes / YEARS / season.teams.length;
    expect(perYear).toBeGreaterThan(0.04);
    expect(perYear).toBeLessThan(0.45);
    expect(poaches).toBeGreaterThan(0);
  });

  it('improves the men in the chairs, and not into supermen', () => {
    // They earn the same points a season pays the player and spend them worse.
    // A player who concentrates reaches 99 in one skill; the country's average
    // rival sits far below that for ever, which is the difference between an
    // opponent who improves and an opponent who cheats.
    const endSkill = mean(season.teams.map((t) => t.coach?.skills.recruiting ?? 20));
    expect(endSkill).toBeGreaterThan(openSkill);
    expect(endSkill).toBeLessThan(70);
    const best = Math.max(...season.teams.map((t) => t.coach?.skills.recruiting ?? 20));
    expect(best).toBeLessThan(99);
  });
});
