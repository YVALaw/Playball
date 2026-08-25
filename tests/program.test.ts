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
  initialPrestige, leagueShape, playerBoard, rivalBoard, rivalExpectation,
  CALIBRATED_LEAGUE, PLAYER_RENEW_BAR, SACK_BAR,
  type Mandate, type SeasonOutcome, type Expectation, type CoachState,
  type Verdict,
} from '../src/engine/program.js';
import { createSeason, DEFAULT_SEASON } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';

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

// ---------------------------------------------------------------------------
// The seam
// ---------------------------------------------------------------------------

/*
  Two boards, and the tests that stop them becoming one or becoming three.

  The first block is the one that matters and it is deliberately blunt: it runs
  every board decision over a grid of programs, seasons and seats, and pins the
  totals to literal numbers. Anything that touches `expectationFor`,
  `objectivesFor`, `judge`, `SECURITY_DELTA` or either firing rule moves one of
  them whatever else it was trying to do. The point of giving rival programs
  their own path was that the player's would not move, and a promise that broad
  needs a test that broad — a handful of spot cases lets a retune through on all
  the cases nobody happened to write down.

  The numbers were taken by running the same sweep against `program.ts` as it
  stood before the split and again after, and they came out identical to the
  digit. That is what they are here to keep true.
*/

/** Every kind of program, every kind of season, every kind of seat. */
const GRID: { prestige: number; roster: number }[] = [];
for (let p = 20; p <= 90; p += 5) {
  for (let r = 20; r <= 90; r += 5) GRID.push({ prestige: p, roster: r });
}

const SEASONS: SeasonOutcome[] = [
  outcome({ wins: 8, losses: 37, conferenceRank: 8, conferenceSize: 8 }),
  outcome({ wins: 16, losses: 29, conferenceRank: 6, conferenceSize: 8 }),
  outcome({ wins: 23, losses: 22, conferenceRank: 4, conferenceSize: 8 }),
  outcome({ wins: 30, losses: 15, conferenceRank: 2, conferenceSize: 8, madeTournament: true }),
  outcome({
    wins: 36, losses: 9, conferenceRank: 1, conferenceSize: 8,
    wonConference: true, madeTournament: true, wonRegional: true, reachedOmaha: true,
  }),
];

/**
 * Four chairs that between them reach both firing rules: a first year inside
 * the grace, a deal with one year left at full confidence, a coach the board has
 * already cooled on, and a long server out of contract.
 */
const SEATS = [
  { tenure: 0, security: 62, contractYears: 4 },
  { tenure: 3, security: 62, contractYears: 1 },
  { tenure: 6, security: 30, contractYears: 2 },
  { tenure: 9, security: 30, contractYears: 1 },
];

describe('your board, pinned', () => {
  const sweep = (): {
    verdicts: Record<Verdict, number>;
    security: number; fired: number; sacked: number;
    notRenewed: number; extended: number; wins: number;
  } => {
    const verdicts: Record<Verdict, number> = { exceeded: 0, met: 0, missed: 0, failed: 0 };
    let security = 0; let fired = 0; let sacked = 0;
    let notRenewed = 0; let extended = 0; let wins = 0;
    for (const { prestige, roster } of GRID) {
      for (const o of SEASONS) {
        for (const seat of SEATS) {
          const coach: CoachState = { ...newCoach(), ...seat, contractLength: 4 };
          const review = reviewSeason(coach, prestige, roster, o, 45);
          verdicts[review.verdict] += 1;
          security += review.securityAfter - review.securityBefore;
          if (review.fired) fired += 1;
          if (review.notRenewed) notRenewed += 1;
          if (review.fired && !review.notRenewed) sacked += 1;
          if (review.extended) extended += 1;
          wins += review.expectation.targetWins;
        }
      }
    }
    return { verdicts, security, fired, sacked, notRenewed, extended, wins };
  };

  it('reaches the same verdict on the same season it always reached', () => {
    // 225 programs × 5 seasons × 4 seats. Move any of these four and the board
    // the player is standing in front of is not the board that was tuned.
    expect(sweep().verdicts)
      .toEqual({ exceeded: 1564, met: 472, missed: 724, failed: 1740 });
  });

  it('asks for the same wins and moves security by the same amount', () => {
    const { wins, security } = sweep();
    expect(wins).toBe(107620);
    expect(security).toBe(-15971);
  });

  it('keeps and lets go of exactly the same men, by the same two routes', () => {
    const { fired, sacked, notRenewed, extended } = sweep();
    expect(fired).toBe(1785);
    expect(sacked).toBe(1232);
    expect(notRenewed).toBe(553);
    expect(extended).toBe(1173);
  });

  it('is what `reviewSeason` uses when nobody says otherwise', () => {
    // The default argument is the whole guarantee. If it stopped being
    // `playerBoard`, every call in `state/store.ts` would change board without
    // a line of the store being edited.
    for (const { prestige, roster } of GRID.slice(0, 40)) {
      for (const o of SEASONS) {
        const coach: CoachState = { ...newCoach(), tenure: 3 };
        expect(reviewSeason(coach, prestige, roster, o, 45)).toEqual(
          reviewSeason(coach, prestige, roster, o, 45, playerBoard(prestige, roster, 45)),
        );
      }
    }
  });

  it('keeps both of the bars it has always had', () => {
    expect(SACK_BAR).toBe(20);
    expect(PLAYER_RENEW_BAR).toBe(45);
    const board = playerBoard(50, 50, 45);
    expect(board.renewAt).toBe(PLAYER_RENEW_BAR);
    expect(board.expectation).toEqual(expectationFor(50, 50, 45));
  });
});

describe('a rival\'s board', () => {
  const poor = outcome({ wins: 4, losses: 41, conferenceRank: 8, conferenceSize: 8 });

  it('is your board exactly, when the league is where it was calibrated', () => {
    // The translation is a shift and nothing else, so at zero shift the two must
    // be indistinguishable. A rescale, a clamp, or a second opinion sneaking in
    // shows up here before it shows up anywhere else.
    for (const { prestige, roster } of GRID) {
      expect(rivalExpectation(prestige, roster, CALIBRATED_LEAGUE, 45))
        .toEqual(expectationFor(prestige, roster, 45));
    }
  });

  it('asks the middle of the league for a number the league can win', () => {
    // The churn diagnosis in one assertion. Wins are zero-sum — forty five games
    // between ninety six programs produce 22.5 wins a program whatever the
    // rosters are — so the average program's target has to stay under that
    // however far the pipeline lifts the roster number. The player's board does
    // not, which is what put a required box out of reach for half the country.
    const half = 45 / 2;
    for (const roster of [45, 49, 55, 60]) {
      const target = rivalExpectation(41, roster, { prestige: 41, roster }, 45).targetWins;
      expect(half - target).toBeGreaterThan(1);
      expect(half - target).toBeLessThan(3);
    }
    expect(expectationFor(41, 45, 45).targetWins).toBeLessThan(half);
    expect(expectationFor(41, 60, 45).targetWins).toBeGreaterThan(half);
  });

  it('still tells the good programs from the poor ones', () => {
    // Level-invariant is not the same as flat. Whatever the league is doing, a
    // program above it is asked for more than one below it, on the same slope.
    const league = { prestige: 51, roster: 55 };
    const weak = rivalExpectation(30, 42, league, 45);
    const middling = rivalExpectation(51, 55, league, 45);
    const strong = rivalExpectation(85, 75, league, 45);
    expect(weak.targetWins).toBeLessThan(middling.targetWins);
    expect(middling.targetWins).toBeLessThan(strong.targetWins);
    expect(weak.mandate).toBe('develop');
    expect(strong.mandate).toBe('championship');
  });

  it('has one firing bar where yours has two', () => {
    expect(rivalBoard(50, 50, CALIBRATED_LEAGUE, 45).renewAt).toBe(SACK_BAR);

    // The same man, the same season, the same security movement — kept by one
    // board and let go by the other. That is the whole of the second difference,
    // and it is isolated here by handing both boards the identical checklist so
    // that nothing but the bar can be responsible for the two answers.
    const cooled: CoachState = {
      ...newCoach(), tenure: 4, security: 45, contractYears: 1, contractLength: 4,
    };
    // Wins made, cellar finish: one required box, so security lands in the band
    // between the two bars rather than below both of them.
    const middling = outcome({ wins: 25, losses: 20, conferenceRank: 8, conferenceSize: 8 });
    const mine = reviewSeason(cooled, 45, 45, middling, 45);
    const theirs = reviewSeason(cooled, 45, 45, middling, 45, {
      expectation: mine.expectation, renewAt: SACK_BAR,
    });
    expect(mine.securityAfter).toBeGreaterThanOrEqual(SACK_BAR);
    expect(mine.securityAfter).toBeLessThan(PLAYER_RENEW_BAR);
    expect(theirs.verdict).toBe(mine.verdict);
    expect(theirs.securityAfter).toBe(mine.securityAfter);
    expect(mine.notRenewed).toBe(true);
    expect(mine.fired).toBe(true);
    expect(theirs.fired).toBe(false);
  });

  it('still sacks a man it has seen enough of', () => {
    // Patience is not immortality. The sacking bar, the security deltas and the
    // first-year grace are the player's and untouched, so a rival who collapses
    // goes on exactly the arithmetic that would cost the player his job.
    let coach: CoachState = {
      ...newCoach(), tenure: 4, security: 62, contractYears: 4, contractLength: 4,
    };
    let sackedAfter = 0;
    for (let year = 1; year <= 6; year++) {
      const review = reviewSeason(coach, 45, 45, poor, 45,
        rivalBoard(45, 45, CALIBRATED_LEAGUE, 45));
      if (review.fired) { sackedAfter = year; break; }
      coach = {
        ...coach, security: review.securityAfter, tenure: coach.tenure + 1,
        badRun: review.badRun, contractYears: review.contractYears,
      };
    }
    // Not the first — one disaster is survivable and that is the point of job
    // security being a number rather than a switch — and not never.
    expect(sackedAfter).toBeGreaterThan(1);
    expect(sackedAfter).toBeLessThanOrEqual(4);
  });

  it('is priced off the world the world actually starts in', () => {
    // `CALIBRATED_LEAGUE.prestige` claims to be what `initialPrestige` produces
    // over the school table. Add a conference of blue bloods and the claim stops
    // being true, and every rival board in the country quietly shifts with it.
    const seeded = CONFERENCES.flatMap(
      (c) => c.schools.map((s) => initialPrestige(s.prestige)),
    );
    const mean = seeded.reduce((a, b) => a + b, 0) / seeded.length;
    expect(Math.abs(mean - CALIBRATED_LEAGUE.prestige)).toBeLessThan(1.5);

    // And `roster` claims to be the roster `expectationFor`'s own fitted line
    // says goes .500, which is the only defensible reference for a zero-sum
    // quantity: a program on it is asked for a shade under half the season.
    const atReference = expectationFor(41, CALIBRATED_LEAGUE.roster, 45).targetWins;
    expect(atReference).toBeGreaterThan(45 / 2 - 3);
    expect(atReference).toBeLessThan(45 / 2);
  });

  it('reads the league off every chair, including yours', () => {
    const season = createSeason(makeRng(99), DEFAULT_SEASON, CONFERENCES.slice(0, 2));
    const byHand = season.teams.reduce((a, t) => a + t.prestige, 0) / season.teams.length;
    expect(leagueShape(season.teams).prestige).toBeCloseTo(byHand, 6);
    // A world with no chairs in it is the calibrated one, which is what makes a
    // test that never seats anybody behave like the game did before the split.
    expect(leagueShape([])).toEqual(CALIBRATED_LEAGUE);
  });
});
