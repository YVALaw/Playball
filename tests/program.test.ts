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
  coachStanding, newCoach, LIFER_SEASONS, badRunPenalty, reviewSeason, takeChair,
  type Mandate, type SeasonOutcome, type Expectation, type CoachState,
} from '../src/engine/program.js';

const MANDATES: Mandate[] = ['develop', 'build', 'compete', 'contend', 'championship'];

/** A finished season, overridable field by field. */
const outcome = (over: Partial<SeasonOutcome> = {}): SeasonOutcome => ({
  wins: 16, losses: 17, conferenceRank: 4, conferenceSize: 8,
  wonConference: false, madeTournament: false, wonRegional: false,
  reachedOmaha: false, wonTitle: false,
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
      for (let i = 0; i < 240; i++) {
        const res = simGame(offense, defense, games, { engine: 'log5' });
        // The home side only, which is the side batting against the catcher
        // whose arm this trial moved. Counting both used to double the sample
        // and halve the signal — every steal the *defence* team attempted was
        // against a catcher nothing here had touched, so it was pure noise
        // stirred into the measurement. It passed on the old random stream and
        // was one unlucky reshuffle from not.
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

describe('what they call you', () => {
  // The line beside HEAD COACH used to read "seasons completed", which the two
  // counters either side of the portrait already say. A standing has to be
  // earned, so these pin the one property that matters: time served does not
  // climb the ladder, and a trophy cannot be taken back off you.

  const coachWith = (over: Partial<CoachState>): CoachState =>
    ({ ...newCoach(), ...over });

  it('starts nobody as anything', () => {
    expect(coachStanding(newCoach()).title).toBe('Unproven');
    expect(coachStanding(newCoach()).lifer).toBe(false);
  });

  it('does not promote a coach for merely surviving', () => {
    // Twenty years of losing. Long service, no standing — this is the whole
    // reason the line stopped counting seasons.
    const timeServer = coachWith({
      tenure: 20, careerWins: 300, careerLosses: 400, prestige: 30,
    });
    expect(coachStanding(timeServer).title).toBe('Journeyman');
  });

  it('never introduces a national champion as a journeyman', () => {
    // Prestige decays when nothing happens, so a title winner having a thin
    // decade would otherwise slide back down to the bottom of the ladder.
    const champion = coachWith({
      titles: 1, prestige: 20, careerWins: 200, careerLosses: 300,
    });
    expect(coachStanding(champion).title).toBe('Legendary');
  });

  it('climbs with what a coach has actually won', () => {
    const order = ['Unproven', 'Journeyman', 'Respected', 'Established', 'Renowned', 'Legendary'];
    const rung = (c: CoachState) => order.indexOf(coachStanding(c).title);

    const nobody = newCoach();
    const winning = coachWith({ careerWins: 120, careerLosses: 80, prestige: 45 });
    const bidMaker = coachWith({
      careerWins: 200, careerLosses: 120, prestige: 58, tournaments: 4,
    });
    const contender = coachWith({
      careerWins: 300, careerLosses: 150, prestige: 72,
      tournaments: 8, conferenceTitles: 3,
    });

    expect(rung(nobody)).toBeLessThan(rung(winning));
    expect(rung(winning)).toBeLessThan(rung(bidMaker));
    expect(rung(bidMaker)).toBeLessThan(rung(contender));
  });

  it('gives winning a region its own rung, above a league and below the country', () => {
    // B6's other half. A regional title is the second best thing available and
    // had no counter anywhere, so the ladder could not read it.
    const order = ['Unproven', 'Journeyman', 'Respected', 'Established', 'Renowned', 'Legendary'];
    const rung = (c: CoachState) => order.indexOf(coachStanding(c).title);

    const league = coachWith({
      careerWins: 200, careerLosses: 150, prestige: 30,
      tournaments: 4, conferenceTitles: 2,
    });
    const region = coachWith({ ...league, regionalTitles: 1 });
    const country = coachWith({ ...region, titles: 1 });

    expect(rung(league)).toBeLessThan(rung(region));
    expect(rung(region)).toBeLessThan(rung(country));
    expect(coachStanding(region).title).toBe('Renowned');
  });

  it('calls a man who stayed fifteen years a lifer, whatever else he is', () => {
    // Deliberately apart from the ladder: it is the one thing here earned by
    // staying rather than winning, so a bad run must not be able to take it.
    const lifer = coachWith({ tenure: LIFER_SEASONS, careerWins: 200, careerLosses: 250 });
    expect(coachStanding(lifer).lifer).toBe(true);

    const nearly = coachWith({ tenure: LIFER_SEASONS - 1 });
    expect(coachStanding(nearly).lifer).toBe(false);
  });

  it('does not hand a lifer a winner\'s title for the tenure alone', () => {
    // The load-bearing case for the whole ladder, and the failure it replaced:
    // fifteen years and nothing won reads as LIFER beside a title he has not
    // earned, not as a title *because* of the fifteen years.
    const served = coachWith({
      tenure: LIFER_SEASONS + 5, careerWins: 260, careerLosses: 340, prestige: 28,
    });
    const standing = coachStanding(served);
    expect(standing.lifer).toBe(true);
    expect(standing.title).toBe('Journeyman');
  });
});

describe('two bad seasons running', () => {
  // B5. One bad year is variance and the ordinary arithmetic already prices it;
  // two is a pattern, and until `badRun` existed nothing in the game could tell
  // the difference between a coach's first poor season and his fourth.

  const coachWith = (over: Partial<CoachState>): CoachState =>
    ({ ...newCoach(), ...over });

  /** A season that misses one required box and nothing else. */
  const poor = outcome({ wins: 4, losses: 41, conferenceRank: 8, conferenceSize: 8 });
  /** A season the board accepts at a modest program. */
  const fine = outcome({ wins: 30, losses: 15, conferenceRank: 2, conferenceSize: 8 });

  it('charges nothing for the first and something for the second', () => {
    expect(badRunPenalty(0)).toBe(0);
    expect(badRunPenalty(1)).toBe(0);
    expect(badRunPenalty(2)).toBeGreaterThan(0);
    expect(badRunPenalty(3)).toBeGreaterThan(badRunPenalty(2));
  });

  it('remembers the run across seasons and forgets it after a good one', () => {
    const first = reviewSeason(coachWith({ tenure: 3 }), 45, 45, poor, 45);
    expect(first.verdict === 'missed' || first.verdict === 'failed').toBe(true);
    expect(first.badRun).toBe(1);
    expect(first.prestigePenalty).toBe(0);

    const second = reviewSeason(coachWith({ tenure: 4, badRun: 1 }), 45, 45, poor, 45);
    expect(second.badRun).toBe(2);
    expect(second.prestigePenalty).toBeGreaterThan(0);

    // One acceptable year wipes it out completely rather than decrementing it.
    const recovered = reviewSeason(coachWith({ tenure: 5, badRun: 2 }), 45, 45, fine, 45);
    expect(recovered.verdict === 'met' || recovered.verdict === 'exceeded').toBe(true);
    expect(recovered.badRun).toBe(0);
    expect(recovered.prestigePenalty).toBe(0);
  });

  it('costs the same coach real standing on the second and not on the first', () => {
    // Two identical seasons at the same job, one from a clean sheet and one from
    // a coach who did it last year too. The only difference is the memory.
    const clean = reviewSeason(coachWith({ tenure: 4, prestige: 60 }), 45, 45, poor, 45);
    const repeat = reviewSeason(
      coachWith({ tenure: 4, prestige: 60, badRun: 1 }), 45, 45, poor, 45,
    );
    expect(repeat.coachPrestigeAfter).toBeLessThan(clean.coachPrestigeAfter);
    expect(clean.coachPrestigeAfter - repeat.coachPrestigeAfter)
      .toBe(badRunPenalty(2));
    // And the board says so out loud, because a silent penalty is a bug report.
    expect(repeat.message).toMatch(/in a row/i);
    expect(clean.message).not.toMatch(/in a row/i);
  });

  it('starts the run again when he takes a new chair', () => {
    // The run is a board's patience running out, and this is a different board.
    // Carrying it across meant a coach sacked after four bad years, who then
    // took a rebuild and missed in his first season there, paid fourteen points
    // in a building he had been in for five minutes.
    const sacked = coachWith({ badRun: 4, prestige: 40 });
    const rehired = takeChair(sacked, 45);
    expect(rehired.badRun).toBe(0);
    // What travels is the prestige the run already cost him.
    expect(rehired.prestige).toBe(40);
    expect(rehired.tenure).toBe(0);
    expect(rehired.arrivedPrestige).toBe(45);
  });

  it('leaves job security to the security model', () => {
    // Deliberately not a second sacking pressure: security already fell for
    // both of those seasons on its own, and doubling it would mean nobody ever
    // reaches a third bad year for the escalation above to apply to.
    const clean = reviewSeason(coachWith({ tenure: 4, prestige: 60 }), 45, 45, poor, 45);
    const repeat = reviewSeason(
      coachWith({ tenure: 4, prestige: 60, badRun: 3 }), 45, 45, poor, 45,
    );
    expect(repeat.securityAfter).toBe(clean.securityAfter);
  });
});
