// progression.test.ts
// The dynasty only works if the world turns over. A roster that never changes
// makes year five identical to year one, and a roster that changes wrongly
// breaks it in ways that are hard to see from a box score.

import { describe, it, expect } from 'vitest';
import { createSeason, simSeason, nextSeason } from '../src/engine/season.js';
import {
  advanceOffseason, departAndDevelop, fillRosters, walkOnShortfall,
  walkOnClass, walkOnSeed,
} from '../src/engine/progression.js';
import { coveredSince } from '../src/ui/screens/Board.js';
import { AI_KEEP_SHARE } from '../src/engine/draft.js';
import { windowBudget } from '../src/engine/recruiting.js';
import { overallOf } from '../src/engine/ratings.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import type { SeasonState } from '../src/engine/season.js';
import type { Player } from '../src/engine/types.js';

/** Two conferences is enough to prove the mechanics and keeps the suite quick. */
const SMALL = CONFERENCES.slice(0, 2);

const rosterOf = (s: SeasonState, i: number): Player[] => {
  const t = s.teams[i]!.team;
  return [...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen];
};

const everyone = (s: SeasonState): Player[] =>
  s.teams.flatMap((_, i) => rosterOf(s, i));

const slotOf = (p: Player): string => (p.type === 'pitcher' ? p.role : p.pos);

/**
 * Hand every program a class that covers the hole it is about to have.
 *
 * `departAndDevelop` plus `fillRosters` with nobody signed is not a dynasty, and
 * since walk-ons started leaving after a season it is not even a stable world:
 * every replacement is a walk-on, every walk-on is gone again next June, and by
 * year five the league is nothing but freshmen. That is the engine behaving
 * correctly on an input the game never supplies — the store runs a recruiting
 * window between the two halves of every offseason. This is the cheapest honest
 * stand-in for one: exactly as many recruits as there are spots, at the
 * positions the spots are at, which is what a program that recruits well gets.
 */
function signClasses(season: SeasonState): void {
  for (const record of season.teams) {
    const t = record.team;
    const survivors = [...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen];
    for (const row of walkOnShortfall(survivors, [])) {
      for (let i = 0; i < row.count; i++) {
        const match = season.recruiting.prospects.find(
          (p) => p.signedBy === null && slotOf(p.player) === row.pos,
        );
        if (match) match.signedBy = record.index;
      }
    }
  }
}

describe('the offseason', () => {
  const rng = makeRng(2027);
  const season = createSeason(rng, undefined, SMALL);
  simSeason(season);
  const before = everyone(season);
  // advanceOffseason mutates players in place — a returning freshman becomes a
  // sophomore on the same object. So anything about the old state has to be
  // copied out first; holding the array is not holding the past.
  const snapshot = before.map((p) => ({ id: p.id, classYear: p.classYear }));
  const report = advanceOffseason(season, rng);
  const after = everyone(season);

  it('graduates every senior', () => {
    const seniorsBefore = snapshot.filter((p) => p.classYear === 'SR');
    const departed = new Set([...report.graduated, ...report.drafted].map((d) => d.id));
    for (const s of seniorsBefore) expect(departed.has(s.id)).toBe(true);
    expect(seniorsBefore.length).toBe(
      report.graduated.length + report.drafted.filter((d) => d.classYear === 'SR').length,
    );
  });

  // A drafted man who was talked out of going is still on the notice — that is
  // what the notice is for — so "who actually left" is the drafted rows minus
  // the ones that came back. Every count below reads through this rather than
  // through `report.drafted`, because the other ninety five programs settle
  // their own drafted juniors now and some of them stay.
  const lost = () => [...report.graduated, ...report.drafted.filter((d) => !d.returned)];

  it('never lets a departed player stay on a roster', () => {
    const departed = new Set(lost().map((d) => d.id));
    for (const p of after) expect(departed.has(p.id)).toBe(false);
  });

  it('leaves a man it talked round on the roster he plays for', () => {
    const back = report.drafted.filter((d) => d.returned);
    expect(back.length).toBeGreaterThan(0);
    const here = new Set(after.map((p) => p.id));
    for (const d of back) expect(here.has(d.id)).toBe(true);
  });

  it('keeps every roster at full strength', () => {
    for (let i = 0; i < season.teams.length; i++) {
      const t = season.teams[i]!.team;
      expect(t.lineup).toHaveLength(9);
      expect(t.bench).toHaveLength(4);
      expect(t.rotation).toHaveLength(4);
      expect(t.bullpen).toHaveLength(6);
      expect(rosterOf(season, i)).toHaveLength(23);
    }
  });

  it('fields a complete diamond', () => {
    for (const record of season.teams) {
      const spots = record.team.lineup.map((p) => p.pos);
      expect(new Set(spots)).toEqual(new Set(['C','1B','2B','3B','SS','LF','CF','RF','DH']));
    }
  });

  it('replaces exactly what it lost', () => {
    expect(report.recruits).toBe(lost().length);
    expect(after).toHaveLength(before.length);
  });

  it('signs the replacements as freshmen', () => {
    const returning = new Set(before.map((p) => p.id));
    const newcomers = after.filter((p) => !returning.has(p.id));
    expect(newcomers.length).toBe(report.recruits);
    for (const p of newcomers) expect(p.classYear).toBe('FR');
  });

  it('never puts a man on two rosters', () => {
    const ids = after.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('advances everyone who stayed by exactly one class', () => {
    const wasFR = new Set(snapshot.filter((p) => p.classYear === 'FR').map((p) => p.id));
    const stayedFR = after.filter((p) => wasFR.has(p.id));
    expect(stayedFR.length).toBeGreaterThan(0);
    for (const p of stayedFR) expect(p.classYear).toBe('SO');
  });

  it('takes the good juniors and leaves the weak ones', () => {
    const juniorsDrafted = report.drafted.filter((d) => d.classYear === 'JR');
    expect(juniorsDrafted.length).toBeGreaterThan(0);
    const avgDrafted = juniorsDrafted.reduce((a, d) => a + d.overall, 0) / juniorsDrafted.length;
    const returningSeniors = after.filter((p) => p.classYear === 'SR');
    const avgReturning = returningSeniors.reduce((a, p) => a + overallOf(p), 0) / returningSeniors.length;
    expect(avgDrafted).toBeGreaterThan(avgReturning);
  });

  it('develops more players than it sets back', () => {
    expect(report.improved).toBeGreaterThan(report.declined);
    expect(report.developmentNet).toBeGreaterThan(0);
  });

  it('never leaves a player above his own ceiling', () => {
    for (const p of after) expect(p.potential).toBeGreaterThanOrEqual(overallOf(p));
  });
});

describe('a dynasty across five years', () => {
  const rng = makeRng(4242);
  let season = createSeason(rng, undefined, SMALL);
  const seen = new Set<string>();
  const ids = new Set<string>();
  let departures = 0;
  let arrivals = 0;

  for (let year = 0; year < 5; year++) {
    simSeason(season);
    for (const p of everyone(season)) { seen.add(p.name); ids.add(p.id); }
    // The offseason in the order the game runs it: who leaves, then a class is
    // signed against the holes that leaves, then the class arrives.
    const report = departAndDevelop(season, rng);
    signClasses(season);
    const filled = fillRosters(season, rng);
    departures += report.graduated.length
      + report.drafted.filter((d) => !d.returned).length;
    arrivals += filled.recruits;
    season = nextSeason(season);
  }

  it('turns the world over completely', () => {
    // Four class years means a roster empties roughly every four seasons.
    const rosterTotal = season.teams.length * 23;
    expect(departures).toBeGreaterThan(rosterTotal);
    expect(arrivals).toBe(departures);
  });

  it('never repeats a name across the whole run', () => {
    expect(seen.size).toBe(ids.size);
  });

  it('keeps all four classes populated every year', () => {
    const counts = new Map<string, number>();
    for (const p of everyone(season)) counts.set(p.classYear, (counts.get(p.classYear) ?? 0) + 1);
    for (const year of ['FR', 'SO', 'JR', 'SR']) {
      expect(counts.get(year) ?? 0).toBeGreaterThan(0);
    }
  });

  it('carries records and statistics into a clean new season', () => {
    for (const t of season.teams) {
      expect(t.w).toBe(0);
      expect(t.l).toBe(0);
      expect(t.gp).toBe(0);
    }
    expect(season.batting.size).toBe(0);
    expect(season.results).toHaveLength(0);
    expect(season.finalOrder).toBeNull();
  });

  it('still knows which conference everyone plays in', () => {
    for (const t of season.teams) expect(t.conference).toBeTruthy();
    expect(season.schedule.length).toBeGreaterThan(0);
  });
});

describe('a signed class actually arrives', () => {
  it('puts every recruit on the roster, hole or no hole', () => {
    // The worst bug the game can have from the player's side: you spend three
    // weeks and eight scholarships on men who then do not exist. `refill` only
    // placed a recruit when there was a *hole* at his position, so a class
    // signed into a roster that returns its starters was silently thrown away.
    const rng = makeRng(2027);
    const season = createSeason(rng, undefined, SMALL);
    simSeason(season);

    const me = 0;
    const signed = season.recruiting.prospects.slice(0, 8);
    for (const p of signed) { p.signedBy = me; p.committedWeek = 3; }
    const ids = new Set(signed.map((p) => p.player.id));

    advanceOffseason(season, rng, { userTeam: me });

    const t = season.teams[me]!.team;
    const roster = [...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen];
    const landed = roster.filter((p) => ids.has(p.id));

    expect(landed.length, 'signed recruits went missing').toBe(signed.length);
    // And the roster is still a fieldable team.
    expect(t.lineup).toHaveLength(9);
    expect(t.rotation).toHaveLength(4);
  });
});

describe('the training skill', () => {
  it('grows the user team a little more, and touches nobody else', () => {
    // Two identical worlds, one difference: the user coach has maxed training.
    // The multiplier scales only the systematic pull toward potential and
    // consumes no rng draws of its own, so the runs share every departure and
    // every noise roll — whatever separates the rosters afterwards is the
    // skill and nothing but.
    const run = (training: number) => {
      const s = createSeason(makeRng(777), undefined, SMALL);
      simSeason(s);
      departAndDevelop(s, s.rng, { userTeam: 0, training });
      return s;
    };
    const base = run(20);
    const trained = run(99);

    const meanOverall = (s: SeasonState, i: number): number => {
      const roster = rosterOf(s, i);
      return roster.reduce((a, p) => a + overallOf(p), 0) / roster.length;
    };

    // Same survivors on both sides — the streams never diverged.
    expect(rosterOf(trained, 0).map((p) => p.id))
      .toEqual(rosterOf(base, 0).map((p) => p.id));

    // A rival program develops identically: the skill is the user's alone.
    expect(meanOverall(trained, 1)).toBeCloseTo(meanOverall(base, 1), 9);

    // The user's program comes out ahead — slightly. This is a tiny edge by
    // design, worth about sixteen percent more systematic growth at the cap,
    // not a different tier of program.
    const edge = meanOverall(trained, 0) - meanOverall(base, 0);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(2);
  });
});

describe('the draft, over a settled league', () => {
  // One run of the whole world, asked several questions. Eight years of ninety
  // six programs is the expensive part of this file and there is no reason to
  // pay for it four times.
  let season = createSeason(makeRng(918), undefined, CONFERENCES);
  const programs = season.teams.length;
  const rounds = new Map<number, number>();
  const teamsHit = new Set<number>();
  let underclassmen = 0;
  let drafted = 0;
  let years = 0;

  for (let year = 0; year < 8; year++) {
    simSeason(season);
    // The offseason in the order the game runs it, classes and all. Running it
    // without a signed class turns the league into nothing but freshmen and
    // walk-ons inside three years — see `signClasses` — and a draft measured on
    // that league is measuring a world the game never produces.
    const report = departAndDevelop(season, season.rng);
    signClasses(season);
    fillRosters(season, season.rng);
    if (year >= 3) {
      years += 1;
      for (const d of report.drafted) {
        drafted += 1;
        teamsHit.add(d.team);
        rounds.set(d.round as number, (rounds.get(d.round as number) ?? 0) + 1);
        if (d.classYear === 'FR' || d.classYear === 'SO') underclassmen += 1;
      }
    }
    season = nextSeason(season);
  }

  it('only takes an underclassman the age clause has reached', () => {
    // The rule replaced a pair of talent bars, and this is the difference: a
    // sophomore is not exposed for being good, he is exposed for being twenty
    // one. The bars said the same thing about frequency and the wrong thing
    // about cause.
    expect(underclassmen, 'the age clause never fired in eight years')
      .toBeGreaterThan(0);
    // Rare rather than a second graduating class: nobody should be losing a
    // sophomore most years.
    expect(underclassmen / drafted).toBeLessThan(0.12);
  });

  it('spreads the country across the whole draft instead of the top of it', () => {
    // The bug this replaced: `round = floor(i / 32) + 1` over the forty to
    // sixty men a league sends up put everybody in round one or two, which made
    // a first round pick a thing every program had two of.
    const used = [...rounds.keys()].sort((a, b) => a - b);
    expect(Math.max(...used), 'nobody reached the late rounds').toBeGreaterThanOrEqual(18);
    expect(used.length, 'the draft used only a handful of rounds').toBeGreaterThanOrEqual(15);

    // Round one is a handful in the country, not a tier.
    const first = (rounds.get(1) ?? 0) / years;
    expect(first, 'nobody ever went in the first round').toBeGreaterThan(0);
    expect(first, 'the first round is not rare').toBeLessThan(6);

    // And the mass is nowhere near the top. Fewer than a fifth of the men
    // taken go inside five rounds.
    let top5 = 0;
    for (let r = 1; r <= 5; r++) top5 += rounds.get(r) ?? 0;
    expect(top5 / drafted).toBeLessThan(0.2);
  });

  it('empties rival rosters too, not just yours', () => {
    // Rival programs churn the way yours does. Without this a dynasty is the
    // only program in the country that ever loses anybody, and the league
    // quietly turns into ninety five teams of seniors.
    expect(teamsHit.size).toBeGreaterThan(programs * 0.8);
  });
});

describe('ages', () => {
  it('brings freshmen in mostly at eighteen, with a real minority older', () => {
    const s = createSeason(makeRng(2718), undefined, CONFERENCES);
    const freshmen = everyone(s).filter((p) => p.classYear === 'FR');
    const at = (n: number) => freshmen.filter((p) => p.age === n).length / freshmen.length;

    // Nobody arrives younger than eighteen or older than twenty.
    for (const p of freshmen) {
      expect(p.age, `${p.name} arrived at ${p.age}`).toBeGreaterThanOrEqual(18);
      expect(p.age).toBeLessThanOrEqual(20);
    }
    expect(at(18)).toBeGreaterThan(0.7);
    expect(at(18)).toBeLessThan(0.9);
    // "A genuine minority", which is the whole reason the age clause ever
    // fires: without these men the rule is three years and nothing else.
    expect(at(19) + at(20)).toBeGreaterThan(0.1);
  });

  it('agrees with the class year, and moves with the calendar', () => {
    const s = createSeason(makeRng(31337), undefined, SMALL);
    simSeason(s);
    const before = new Map(everyone(s).map((p) => [p.id, { age: p.age, cls: p.classYear }]));

    // A man three years in is three years older than he arrived, whichever
    // year he arrived at.
    const gap: Record<string, number> = { FR: 0, SO: 1, JR: 2, SR: 3 };
    for (const p of everyone(s)) {
      expect(p.age - gap[p.classYear]!).toBeGreaterThanOrEqual(18);
      expect(p.age - gap[p.classYear]!).toBeLessThanOrEqual(20);
    }

    advanceOffseason(s, s.rng);
    const survivors = everyone(s).filter((p) => before.has(p.id));
    expect(survivors.length).toBeGreaterThan(0);
    for (const p of survivors) {
      expect(p.age, `${p.name} did not have a birthday`).toBe(before.get(p.id)!.age + 1);
    }
  });
});

describe('the draft running before recruiting', () => {
  it('splits into departures then filling, with the same result as one pass', () => {
    // The two halves exist so the draft can be *shown* before the recruiting
    // board opens — the holes it leaves are what the board should be about.
    // Splitting it must not change the world it produces.
    const a = createSeason(makeRng(414));
    simSeason(a);
    const whole = advanceOffseason(a, a.rng, { userTeam: 0 });

    const b = createSeason(makeRng(414));
    simSeason(b);
    const first = departAndDevelop(b, b.rng, { userTeam: 0 });
    const second = fillRosters(b, b.rng, { userTeam: 0 });

    expect(first.drafted.length).toBe(whole.drafted.length);
    expect(first.graduated.length).toBe(whole.graduated.length);
    expect(first.developmentNet).toBe(whole.developmentNet);
    expect(second.recruits).toBe(whole.recruits);

    for (let i = 0; i < a.teams.length; i++) {
      const x = a.teams[i]!.team;
      const y = b.teams[i]!.team;
      expect(y.lineup.map((p) => p.id)).toEqual(x.lineup.map((p) => p.id));
      expect(y.rotation.map((p) => p.id)).toEqual(x.rotation.map((p) => p.id));
    }
  });

  it('reports holes the survivors cannot fill', () => {
    const s = createSeason(makeRng(415));
    simSeason(s);
    const report = departAndDevelop(s, s.rng, { userTeam: 0 });

    // Somebody always leaves, so there is always something to replace.
    expect(report.holes.length).toBeGreaterThan(0);
    for (const h of report.holes) {
      expect(h.count).toBeGreaterThan(0);
      expect(h.pos.length).toBeGreaterThan(0);
    }

    // And the holes are real: the roster is genuinely short until it is filled.
    const before = s.teams[0]!.team;
    const short = before.lineup.length + before.bench.length
      + before.rotation.length + before.bullpen.length;
    fillRosters(s, s.rng, { userTeam: 0 });
    const after = s.teams[0]!.team;
    const full = after.lineup.length + after.bench.length
      + after.rotation.length + after.bullpen.length;
    expect(full).toBeGreaterThan(short);
  });
});

describe('walk-ons', () => {
  /** A played season with a class already signed to the user's program. */
  const withClass = (seed: number, count: number): SeasonState => {
    const s = createSeason(makeRng(seed), undefined, SMALL);
    simSeason(s);
    for (const p of s.recruiting.prospects.slice(0, count)) {
      p.signedBy = 0;
      p.committedWeek = 3;
    }
    return s;
  };

  it('marks the men it manufactures, and nobody it was handed', () => {
    // Without the mark a walk-on is an ordinary freshman from the moment he
    // lands, which is how he used to stay four years.
    const s = withClass(2027, 6);
    const recruited = new Set(
      s.recruiting.prospects.filter((p) => p.signedBy === 0).map((p) => p.player.id),
    );
    advanceOffseason(s, s.rng, { userTeam: 0 });

    const walkOns = everyone(s).filter((p) => p.walkOn);
    expect(walkOns.length, 'nobody walked on anywhere').toBeGreaterThan(0);
    for (const p of walkOns) expect(recruited.has(p.id)).toBe(false);

    const landed = rosterOf(s, 0).filter((p) => recruited.has(p.id));
    expect(landed.length).toBeGreaterThan(0);
    for (const p of landed) expect(p.walkOn).toBeUndefined();
  });

  it('is gone after one season, where a signed freshman is not', () => {
    const s = withClass(4242, 8);
    advanceOffseason(s, s.rng, { userTeam: 0 });

    const arrived = rosterOf(s, 0);
    const walkOnIds = arrived.filter((p) => p.walkOn).map((p) => p.id);
    const freshmen = arrived
      .filter((p) => !p.walkOn && p.classYear === 'FR').map((p) => p.id);
    expect(walkOnIds.length).toBeGreaterThan(0);
    expect(freshmen.length).toBeGreaterThan(0);

    // One season later, and only one.
    const next = nextSeason(s);
    simSeason(next);
    const report = departAndDevelop(next, next.rng, { userTeam: 0 });
    const onRoster = new Map(rosterOf(next, 0).map((p) => [p.id, p]));
    const reasons = new Map(
      [...report.graduated, ...report.drafted].map((d) => [d.id, d.reason]),
    );

    for (const id of walkOnIds) {
      expect(onRoster.has(id), 'a walk-on stayed a second season').toBe(false);
      // And he left through the report, rather than disappearing between two
      // screens with nothing to say where he went.
      expect(reasons.get(id), 'a walk-on left without a departure notice')
        .toBe('walk-on');
    }

    // The men you actually signed are still yours — the rule is about how he
    // arrived, not about being a freshman.
    const stayed = freshmen.filter((id) => onRoster.has(id));
    expect(stayed.length, 'the whole signed class left too').toBeGreaterThan(0);
    for (const id of stayed) expect(onRoster.get(id)?.classYear).toBe('SO');
  });

  it('leaves after one season whatever class year he arrived in', () => {
    // Every walk-on the engine builds today is a freshman, and the rule must
    // not be reading that: one season is one season, and a body found to fill
    // a hole in an upperclassman's spot is not owed three more years.
    const s = createSeason(makeRng(88), undefined, SMALL);
    simSeason(s);

    const t = s.teams[0]!.team;
    const marked = [t.lineup[0]!, t.bench[0]!, t.rotation[0]!];
    for (const p of marked) p.walkOn = true;
    const classes = marked.map((p) => p.classYear);
    // Only worth asserting if the three are not all freshmen to begin with.
    expect(new Set(classes).size).toBeGreaterThan(1);

    const report = departAndDevelop(s, s.rng, { userTeam: 0 });
    const onRoster = new Set(rosterOf(s, 0).map((p) => p.id));
    const notices = new Map(report.graduated.map((d) => [d.id, d]));

    for (const p of marked) {
      expect(onRoster.has(p.id), `a ${p.classYear} walk-on stayed`).toBe(false);
      expect(notices.get(p.id)?.reason).toBe('walk-on');
    }
  });

  it('projects on signing day exactly the men who turn up in June', () => {
    // The class review renders before anybody is manufactured, so it shows the
    // shortfall rather than a cast list. This is the guarantee that makes that
    // honest: what the screen counts is what the year roll builds.
    for (const [seed, size] of [[415, 0], [415, 5], [911, 12], [777, 3]] as const) {
      const s = withClass(seed, size);
      departAndDevelop(s, s.rng, { userTeam: 0 });

      const t = s.teams[0]!.team;
      const survivors = [...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen];
      const signedClass = s.recruiting.prospects
        .filter((p) => p.signedBy === 0).map((p) => p.player);
      const projected = walkOnShortfall(survivors, signedClass);

      const filled = fillRosters(s, s.rng, { userTeam: 0 });

      const tally = (rows: readonly { pos: string; count: number }[]) => {
        const out: Record<string, number> = {};
        for (const r of rows) out[r.pos] = (out[r.pos] ?? 0) + r.count;
        return out;
      };
      expect(
        tally(projected),
        `seed ${seed} with ${size} signed`,
      ).toEqual(tally(filled.walkOns.map((w) => ({ pos: w.pos, count: 1 }))));
    }
  });

  it('projects the men themselves, name for name and face for face', () => {
    /*
      Reported from testing: "they arrive as names on a list with none of the
      information every other player has." The class review shows walk-ons as
      players now — a face, a rating, a card — which is only honest if the men
      on it are the men who report in June. This is that guarantee, and it is
      the reason the walk-ons come off a seed of their own rather than out of
      the middle of the ninety six program loop.

      Ids as well as names, because the face is drawn from the id: a card that
      showed a different man's portrait would be a lie the coach could see.
    */
    for (const [seed, size] of [[415, 0], [911, 6], [777, 3]] as const) {
      const s = withClass(seed, size);
      departAndDevelop(s, s.rng, { userTeam: 0 });

      const t = s.teams[0]!.team;
      const survivors = [...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen];
      const signedClass = s.recruiting.prospects
        .filter((p) => p.signedBy === 0).map((p) => p.player);

      // Exactly the call the class review makes.
      const shown = walkOnClass(
        survivors, signedClass, t.quality, walkOnSeed(s.recruiting.year, 0),
      );
      // And twice, because React renders a screen twice under StrictMode and a
      // preview that spent a name on the first pass would draw a different man
      // on the second.
      const again = walkOnClass(
        survivors, signedClass, t.quality, walkOnSeed(s.recruiting.year, 0),
      );
      expect(again.map((p) => p.id)).toEqual(shown.map((p) => p.id));
      expect(again.map((p) => p.name)).toEqual(shown.map((p) => p.name));

      const filled = fillRosters(s, s.rng, { userTeam: 0 });
      const arrived = filled.walkOns;
      expect(arrived.length, `seed ${seed}`).toBe(shown.length);
      expect(new Set(arrived.map((w) => w.id)))
        .toEqual(new Set(shown.map((p) => p.id)));
      expect(new Set(arrived.map((w) => w.name)))
        .toEqual(new Set(shown.map((p) => p.name)));
      expect(new Set(arrived.map((w) => w.overall)))
        .toEqual(new Set(shown.map((p) => overallOf(p))));
      // And they read as walk-ons rather than as a class anybody recruited.
      for (const p of shown) {
        expect(p.walkOn).toBe(true);
        expect(p.classYear).toBe('FR');
      }
    }
  });

  it('agrees with what the NEEDS tab tells the coach he is short', () => {
    /*
      Reported from testing: "NEEDS said every position was covered, and the
      class review then brought walk-ons anyway."

      Two causes, both on the tab. It read `lastOffseason.holes`, which a reload
      does not restore — so any dynasty picked up mid-offseason showed an empty
      NEEDS tab over a roster four men short. And with the report in hand it
      counted a signed player against his own position, where the roster rebuild
      spends him on the first hole it comes to and fills the bench out of
      whoever is left. Both tabs read `walkOnShortfall` now, off the roster in
      front of them, and this holds them to it.
    */
    for (const [seed, size] of [[415, 0], [415, 4], [911, 9], [777, 3]] as const) {
      const s = withClass(seed, size);
      departAndDevelop(s, s.rng, { userTeam: 0 });

      const t = s.teams[0]!.team;
      const survivors = [...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen];
      const signedClass = s.recruiting.prospects
        .filter((p) => p.signedBy === 0).map((p) => p.player);

      // The two things the tab draws: what is still open, and what the class
      // has already bought — the second being the difference between the two
      // projections rather than a count of signings by position.
      const before = walkOnShortfall(survivors, []);
      const still = walkOnShortfall(survivors, signedClass);
      const covered = coveredSince(before, still);

      const total = (rows: readonly { pos: string; count: number }[]) =>
        rows.reduce((a, r) => a + r.count, 0);

      // Nothing is invented and nothing is lost: every spot the roster was short
      // of is either covered by the class or waiting for a walk-on.
      expect(total(covered) + total(still)).toBe(total(before));
      for (const row of covered) expect(row.count).toBeGreaterThan(0);
      // A class cannot cover more of a position than was open there.
      const openAt = new Map(before.map((r) => [r.pos, r.count]));
      for (const row of covered) {
        expect(row.count).toBeLessThanOrEqual(openAt.get(row.pos) ?? 0);
      }

      // And "every position is covered" means exactly what the class review
      // means by it — the case the coach was lied to about.
      const filled = fillRosters(s, s.rng, { userTeam: 0 });
      expect(total(still) === 0, `seed ${seed} with ${size} signed`)
        .toBe(filled.walkOns.length === 0);
      expect(total(still)).toBe(filled.walkOns.length);
    }
  });

  it('puts the hole back on the board the winter after', () => {
    // The point of the one season rule from the coach's side: filling a spot
    // with a walk-on does not solve it, it postpones it.
    const s = withClass(31337, 0);
    advanceOffseason(s, s.rng, { userTeam: 0 });
    const spots = rosterOf(s, 0).filter((p) => p.walkOn)
      .map((p) => (p.type === 'pitcher' ? p.role : p.pos));
    expect(spots.length).toBeGreaterThan(0);

    const next = nextSeason(s);
    simSeason(next);
    const report = departAndDevelop(next, next.rng, { userTeam: 0 });
    const holes = new Set(report.holes.map((h) => h.pos));
    // Not every walk-on's slot is a named hole — a bench body is counted as
    // BENCH and a spare arm as RP — so this asks the weaker, true thing: the
    // roster is short again, and it is short somewhere he was standing.
    expect(report.holes.length).toBeGreaterThan(0);
    expect(spots.some((p) => holes.has(p) || holes.has('BENCH'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The other ninety five programs, in June
// ---------------------------------------------------------------------------

/*
  Retention used to be the user's alone: he could spend recruiting money to talk
  a drafted man out of professional baseball and no other program in the country
  could. Every rival's drafted men left, every year, without anybody picking up a
  phone.

  Closing it needs both halves at once and the second is the one that had been
  missing. A rival now runs the same `makeTheCase` against the same `keepPoints`
  out of a budget on the same `windowBudget` scale the user's comes from — which
  only became possible once `aiTargets` stopped allocating a flat forty a week
  that no June could touch. Given free money instead of a budget, an AI keeping
  players would not have been a rival, it would have been a cheat.

  What the tests below hold is the *shape* of the answer rather than a number:
  rivals keep somebody, they keep a clear minority, and no program holds a team
  together against the draft.
*/
describe('the other ninety five programs keep men too', () => {
  // One run of the whole world, asked several questions — the same economy as
  // the settled-league draft block above, for the same reason.
  let season = createSeason(makeRng(4471), undefined, CONFERENCES);
  const programs = season.teams.length;

  let exposed = 0;
  let kept = 0;
  let years = 0;
  /** Per program-year: how many were exposed and how many were talked round. */
  const rows: { team: number; exposed: number; kept: number }[] = [];
  const churn: number[] = [];
  let anySpend = 0;

  for (let year = 0; year < 7; year++) {
    simSeason(season);
    const before = new Map<number, Set<string>>(
      season.teams.map((r) => [r.index, new Set(rosterOf(season, r.index).map((p) => p.id))]),
    );

    const report = departAndDevelop(season, season.rng);
    const board = season.draft;
    signClasses(season);
    fillRosters(season, season.rng);

    if (year >= 3) {
      years += 1;
      const exp = new Map<number, number>();
      const ret = new Map<number, number>();
      for (const d of report.drafted) {
        // Seniors have no eligibility to come back to, so they were never part
        // of the conversation and must not be counted against it.
        if (d.classYear === 'SR') continue;
        exp.set(d.team, (exp.get(d.team) ?? 0) + 1);
        if (d.returned) ret.set(d.team, (ret.get(d.team) ?? 0) + 1);
      }
      for (const r of season.teams) {
        const e = exp.get(r.index) ?? 0;
        const k = ret.get(r.index) ?? 0;
        exposed += e;
        kept += k;
        rows.push({ team: r.index, exposed: e, kept: k });
        anySpend += board?.rivalSpend[r.index] ?? 0;

        const was = before.get(r.index) as Set<string>;
        const still = rosterOf(season, r.index).filter((p) => was.has(p.id)).length;
        churn.push(1 - still / Math.max(1, was.size));
      }
    }
    season = nextSeason(season);
  }

  it('lets a rival talk one of its own men out of professional baseball', () => {
    // The asymmetry itself. Before this, `kept` was zero for ninety five
    // programs every year of every dynasty.
    expect(exposed, 'nothing was exposed to the draft at all').toBeGreaterThan(0);
    expect(kept, 'no program outside the user office kept anybody').toBeGreaterThan(0);
    expect(anySpend, 'men were kept without anybody paying for them').toBeGreaterThan(0);
  });

  it('spreads it across the country rather than one lucky program', () => {
    const withOne = new Set(rows.filter((r) => r.kept > 0).map((r) => r.team));
    expect(withOne.size).toBeGreaterThan(programs * 0.25);
  });

  it('keeps a clear minority, so the draft is still the thing that empties a roster', () => {
    // Measured across the settled world this runs at about 18%. The bound is
    // loose because the number is emergent — what must not happen is retention
    // becoming the normal outcome, which is what an AI with a budget nothing
    // could touch would have produced.
    expect(kept / exposed).toBeGreaterThan(0.02);
    expect(kept / exposed).toBeLessThan(0.4);
  });

  it('lets no program keep everybody', () => {
    // The claim the whole brake exists for. A program may hold on to a man, and
    // it may not hold a team together: of the program-years where the draft
    // took two or more men with eligibility left, almost none get them all back.
    const many = rows.filter((r) => r.exposed >= 2);
    expect(many.length, 'no program ever lost two men in a year').toBeGreaterThan(20);
    const allBack = many.filter((r) => r.kept === r.exposed);
    expect(allBack.length / many.length).toBeLessThan(0.15);

    // And nobody hoards: a staff fights for its best man and maybe a second,
    // never for a class.
    const most = Math.max(...rows.map((r) => r.kept));
    expect(most).toBeLessThanOrEqual(4);
  });

  it('leaves rival rosters churning heavily', () => {
    // The roadmap promise this feature is closest to breaking: you never keep
    // your best players. A third of every roster in the country still turns
    // over every year with the mechanic switched on — measured at 35.5% against
    // 37.3% with it off, so it costs under two points of churn.
    const mean = churn.reduce((a, b) => a + b, 0) / churn.length;
    expect(mean).toBeGreaterThan(0.25);
    // Nor may any program sit still. A quiet June happens — a roster of
    // underclassmen nobody drafted is a real thing and one man in twenty three
    // is what it looks like — so the bound is on the shape of the tail rather
    // than on its worst case: nine program-years in ten lose a real piece of
    // the roster.
    expect(Math.min(...churn), 'a program lost nobody at all').toBeGreaterThan(0);
    const sorted = [...churn].sort((a, b) => a - b);
    const tenth = sorted[Math.floor(sorted.length * 0.1)] as number;
    expect(tenth, 'a tenth of the country barely turned over').toBeGreaterThan(0.15);
  });

  it('never lets a program spend past what June allows it', () => {
    // The ceiling is `AI_KEEP_SHARE` of the program window, and the window at
    // the very top of the league is the largest one there is.
    const ceiling = windowBudget(5) * AI_KEEP_SHARE;
    for (const r of season.teams) {
      expect(season.draft?.rivalSpend[r.index] ?? 0).toBeLessThanOrEqual(ceiling);
    }
  });
});
