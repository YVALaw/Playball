// program.test.ts
// The board's side of the dynasty: what it asks for, and how it reads a season.
//
// These pin a calibration that took several passes to get right, and every wrong
// version looked reasonable in the code. The failure mode is not a crash — it is
// a board that quietly asks for the impossible, which reads to a player as the
// game being unfair rather than as a bug.

import { describe, it, expect } from 'vitest';
import {
  expectationFor, objectivesFor, objectiveMet, gradeObjectives, judge,
  type Mandate, type SeasonOutcome, type Expectation,
} from '../src/engine/program.js';

const MANDATES: Mandate[] = ['develop', 'build', 'compete', 'contend', 'championship'];

/** A finished season, overridable field by field. */
const outcome = (over: Partial<SeasonOutcome> = {}): SeasonOutcome => ({
  wins: 16, losses: 17, conferenceRank: 4, conferenceSize: 8,
  wonConference: false, madeTournament: false, reachedOmaha: false, wonTitle: false,
  ...over,
});

/** A season that clears every required box of the given expectation and no bonus. */
function meetExactly(e: Expectation): SeasonOutcome {
  return outcome({
    wins: e.targetWins, losses: 33 - e.targetWins,
    conferenceRank: 1, conferenceSize: 8,
    madeTournament: e.objectives.some((o) => o.key === 'tournament' && o.required),
  });
}

describe('the checklist', () => {
  it('gives every mandate required boxes and bonus boxes', () => {
    for (const m of MANDATES) {
      const objectives = objectivesFor(m, 18);
      const required = objectives.filter((o) => o.required);
      const bonus = objectives.filter((o) => !o.required);
      expect(required.length, `${m} required`).toBeGreaterThanOrEqual(2);
      expect(bonus.length, `${m} bonus`).toBeGreaterThanOrEqual(2);
    }
  });

  it('never shows a placement box as met while the season is unranked', () => {
    // conferenceRank 0 is what the screen holds mid-season. A box that ticks
    // itself before the games are played is worse than showing nothing.
    const mid = outcome({ conferenceRank: 0, wins: 30 });
    for (const m of MANDATES) {
      for (const o of objectivesFor(m, 18)) {
        if (o.key === 'notLast' || o.key === 'topHalf' || o.key === 'topThree') {
          expect(objectiveMet(o, mid), `${m}/${o.key}`).toBe(false);
        }
      }
    }
  });
});

describe('the win target', () => {
  it('is set by the roster, not the reputation', () => {
    // The regression this guards: pricing the season off prestige asked proud
    // programs with gutted rosters for wins the roster could not produce, and
    // 93% of rebuild seasons ended in a negative review.
    const humble = expectationFor(30, 46, 33);
    const proud = expectationFor(80, 46, 33);
    expect(proud.targetWins).toBe(humble.targetWins);
  });

  it('still lets prestige decide what kind of job it is', () => {
    expect(expectationFor(80, 46, 33).mandate).not.toBe(expectationFor(30, 46, 33).mandate);
  });

  it('rises with the roster across the whole scale', () => {
    let last = -1;
    for (const roster of [30, 40, 50, 60, 70]) {
      const t = expectationFor(50, roster, 33).targetWins;
      expect(t).toBeGreaterThan(last);
      last = t;
    }
  });

  it('asks for a number that fits inside the season', () => {
    for (const prestige of [20, 50, 90]) {
      for (const roster of [25, 50, 75]) {
        const { targetWins } = expectationFor(prestige, roster, 33);
        expect(targetWins).toBeGreaterThan(0);
        expect(targetWins).toBeLessThanOrEqual(33);
      }
    }
  });
});

describe('the verdict', () => {
  it('reads the same checklist the player was shown', () => {
    // Not an independent opinion. Every required box filled cannot be a failure,
    // whatever the raw record looks like.
    for (const m of MANDATES) {
      const e = expectationFor(...jobFor(m), 33);
      const graded = gradeObjectives(e, meetExactly(e));
      const missedRequired = graded.filter((g) => g.objective.required && !g.met);
      expect(missedRequired, `${m}`).toHaveLength(0);
      expect(['met', 'exceeded']).toContain(judge(meetExactly(e), e));
    }
  });

  it('treats one bonus as doing the job and two as beating it', () => {
    const e = expectationFor(40, 45, 33);          // a develop job
    const base = meetExactly(e);
    expect(judge(base, e)).toBe('met');

    const bonuses = e.objectives.filter((o) => !o.required);
    expect(bonuses.length).toBeGreaterThanOrEqual(2);
    const two = { ...base, wins: e.targetWins + 4, madeTournament: true };
    expect(judge(two, e)).toBe('exceeded');
  });

  it('separates a near miss from a collapse', () => {
    const e = expectationFor(40, 45, 33);
    expect(judge({ ...meetExactly(e), wins: e.targetWins - 1 }, e)).toBe('missed');
    // Short of the number *and* dead last: two required boxes gone.
    expect(judge({
      ...meetExactly(e), wins: e.targetWins - 1, conferenceRank: 8, conferenceSize: 8,
    }, e)).toBe('failed');
  });

  it('lets a national title end the conversation', () => {
    const e = expectationFor(75, 70, 33);
    const disaster = outcome({ wins: 1, losses: 32, conferenceRank: 8, conferenceSize: 8, wonTitle: true });
    expect(judge(disaster, e)).toBe('exceeded');
  });
});

/** Prestige and roster that reliably produce each mandate. */
function jobFor(m: Mandate): [number, number] {
  const table: Record<Mandate, [number, number]> = {
    develop: [35, 40], build: [70, 48], compete: [50, 52],
    contend: [60, 62], championship: [80, 75],
  };
  return table[m];
}

describe('the offer matches the job', () => {
  it('advertises the roster the player actually gets', async () => {
    // The bug this pins: the selection screen estimated a roster from the
    // school's quality rating, which ran 1.7 points light on average and 7 in
    // the tail. That was enough to move a program across a mandate boundary, so
    // a job advertised as COMPETE / 61 / 20 wins became CONTEND / 65 / 22 the
    // moment you signed it.
    const { createSeason, seasonLength } = await import('../src/engine/season.js');
    const { makeRng } = await import('../src/engine/rng.js');
    const { CONFERENCES } = await import('../src/data/schools.js');
    const { rosterStrength } = await import('../src/engine/program.js');
    // From its own module, not the store: importing the store here pulled in
    // Zustand, IndexedDB and the worker client to read one integer, and the
    // transform cost alone timed this test out in a full parallel run.
    const { WORLD_SEED } = await import('../src/state/world.js');

    // Two independently generated worlds from the same seed: what the offer
    // screen builds, and what taking the job builds.
    const offered = createSeason(makeRng(WORLD_SEED), undefined, CONFERENCES);
    const signed = createSeason(makeRng(WORLD_SEED), undefined, CONFERENCES);

    expect(offered.teams).toHaveLength(signed.teams.length);
    for (let i = 0; i < offered.teams.length; i++) {
      const a = offered.teams[i]!, b = signed.teams[i]!;
      expect(a.def.abbr).toBe(b.def.abbr);

      const ra = rosterStrength(a.team), rb = rosterStrength(b.team);
      expect(ra, a.def.school).toBe(rb);

      const ea = expectationFor(a.prestige, ra, seasonLength(offered.config));
      const eb = expectationFor(b.prestige, rb, seasonLength(signed.config));
      expect(ea.mandate, a.def.school).toBe(eb.mandate);
      expect(ea.targetWins, a.def.school).toBe(eb.targetWins);
    }
  });
});

describe('the catcher', () => {
  it('changes whether runners go, and whether they make it', async () => {
    // Before individual fielders, a steal was settled by the runner's speed and
    // the pitcher's hold rating. Nobody threw the ball. This pins that the man
    // behind the plate now matters in both directions: a cannon deters attempts
    // AND retires more of the runners who go anyway.
    const { simGame } = await import('../src/engine/game.js');
    const { makeTeam, resetNames } = await import('../src/engine/players.js');
    const { makeRng } = await import('../src/engine/rng.js');

    const run = (catcherArm: number) => {
      resetNames();
      const rng = makeRng(99);
      const offense = makeTeam(rng, 'Offense', 50);
      const defense = makeTeam(rng, 'Defense', 50);
      for (const p of defense.lineup) if (p.pos === 'C') p.arm = catcherArm;

      let sb = 0, cs = 0;
      const games = makeRng(4242);
      for (let i = 0; i < 120; i++) {
        const res = simGame(offense, defense, games, { engine: 'log5' });
        for (const line of res.away.batting.values()) { sb += line.sb; cs += line.cs; }
        for (const line of res.home.batting.values()) { sb += line.sb; cs += line.cs; }
      }
      return { sb, cs, attempts: sb + cs };
    };

    const noodle = run(20);
    const cannon = run(90);

    // Fewer runners test a great arm.
    expect(cannon.attempts).toBeLessThan(noodle.attempts);
    // And a smaller share of the ones who do go make it.
    const noodlePct = noodle.sb / noodle.attempts;
    const cannonPct = cannon.sb / cannon.attempts;
    expect(cannonPct).toBeLessThan(noodlePct);
  });
});
