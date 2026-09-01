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
  coachStanding,
  TITLE_BLURB, newCoach, LIFER_SEASONS, badRunPenalty, reviewSeason, takeChair,
  initialPrestige, leagueShape, playerBoard, rivalBoard, rivalExpectation,
  rosterStrength, CALIBRATED_LEAGUE, PLAYER_RENEW_BAR, SACK_BAR,
  nextPrestige, programTarget, seasonScore, climbLift, climbBonus,
  CLIMBING_UNDER, DROUGHT_GRACE,
  type Mandate, type SeasonOutcome, type Expectation, type CoachState,
  type ObjectiveKey, type Verdict,
} from '../src/engine/program.js';
import { NATIONAL_BIDS, OMAHA_BERTHS } from '../src/engine/postseason.js';
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

/**
 * A season that clears every required box of the given expectation and no bonus.
 *
 * Built off the checklist rather than off a hand-written season per mandate, so
 * that moving a box between required and bonus cannot quietly leave this handing
 * out a required tick it was never asked for — which is how a checklist change
 * comes to prove itself.
 */
function meetExactly(e: Expectation): SeasonOutcome {
  const required = (key: ObjectiveKey): boolean =>
    e.objectives.some((o) => o.key === key && o.required);
  return outcome({
    wins: e.targetWins, losses: 33 - e.targetWins,
    conferenceRank: 1, conferenceSize: 8,
    wonConference: required('conferenceTitle'),
    wonRegional: required('regionalTitle'),
    // A regional banner guarantees a seat in the twenty-team field, so a
    // season that ticks the one ticks the other whether it was asked to or
    // not. Anything else would be a season that cannot happen.
    madeTournament: required('conferenceTitle') || required('regionalTitle')
      || required('tournament'),
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

  /*
    The arithmetic guard, and the reason it is structural rather than a number.

    `objectivesFor` may only *require* something the format can actually hand out
    to everybody it asks. The rule was written for placement — six of twelve
    finish in the top half, so requiring it of more than half the league fails
    them by construction — and was then broken by a postseason box: a national
    bid was required of every contend and championship program, and the country
    awards `NATIONAL_BIDS` of them. Fifteen to twenty programs a year carried a
    box with eight seats behind it, at a measured cost of 12.8 clear reviews a
    year.

    So the seats are read off the postseason and the conference table rather than
    written down here. The day the field grows — the backlog's expanded format
    seats twenty — this test re-prices itself, which is the point: the expansion
    must not be able to quietly reintroduce the breach, and it must not be able
    to quietly forbid a requirement it has since made honest either.
  */
  const world = createSeason(makeRng(20260825), DEFAULT_SEASON, CONFERENCES);
  const conferences = [...new Set(world.teams.map((t) => t.conference))];
  const confSize = world.teams.filter((t) => t.conference === conferences[0]).length;

  /** How many programs the format can hand each box to, in one season. */
  const SEATS: Partial<Record<ObjectiveKey, number>> = {
    notLast: (confSize - 1) * conferences.length,
    topHalf: Math.ceil(confSize / 2) * conferences.length,
    topThree: 3 * conferences.length,
    conferenceTitle: conferences.length,
    // Sixteen regional banners a June under the expanded format.
    regionalTitle: 16,
    tournament: NATIONAL_BIDS,
    omaha: OMAHA_BERTHS,
    title: 1,
  };

  /**
   * What this league's boards ask for, box by box.
   *
   * `stretch` widens the league about its own mean without moving the mean,
   * because that is the one thing thirty five seasons do to the distribution
   * that a shift cannot model — the prestige spread goes 15.4 to 17.1 as the
   * boards start biting, and it is the tails that decide how many programs reach
   * `contend` and `championship`. Read through `rivalExpectation`, which is the
   * translation every board in the country except the player's own goes through.
   */
  const demand = (stretch: number): Partial<Record<ObjectiveKey, number>> => {
    const league = leagueShape(world.teams);
    const asked: Partial<Record<ObjectiveKey, number>> = {};
    for (const t of world.teams) {
      const e = rivalExpectation(
        league.prestige + (t.prestige - league.prestige) * stretch,
        league.roster + (rosterStrength(t.team) - league.roster) * stretch,
        league, 45,
      );
      for (const o of e.objectives) {
        if (o.required) asked[o.key] = (asked[o.key] ?? 0) + 1;
      }
    }
    return asked;
  };

  it('never requires a box of more programs than the format seats', () => {
    // 1.0 is the world as generated and 1.1 is the world thirty five seasons
    // later — the prestige spread goes 15.4 to 17.1 as the boards start biting.
    // The two tightest rungs are close to full, and are meant to be: over those
    // thirty five seasons `championship` peaks at 7 programs against 8 conference
    // titles, and `contend` and `championship` together at 22 against 24 top
    // three finishes. A change that makes either mandate commoner breaks this,
    // which is the point of it — the live version, counted off leagues that have
    // actually been played, is in `rivals.test.ts`.
    for (const stretch of [0.9, 1.0, 1.1]) {
      for (const [key, n] of Object.entries(demand(stretch))) {
        const seats = SEATS[key as ObjectiveKey];
        if (seats === undefined) continue;      // `wins` and `winningSeason`
        expect(n, `${key} at stretch ${stretch}`).toBeLessThanOrEqual(seats);
      }
    }
  });

  it('leaves no zero-sum box outside the guard above', () => {
    // A box with no seat count is a box the test above skips, so adding one and
    // forgetting to price it is how the breach comes back. `wins` and
    // `winningSeason` are the only two that are genuinely not rationed by the
    // format — a whole league can win twenty games in the same year — and every
    // other key has to be in SEATS whether or not anybody requires it today.
    const unpriced: ObjectiveKey[] = ['wins', 'stretchWins', 'winningSeason'];
    for (const m of MANDATES) {
      for (const o of objectivesFor(m, 18)) {
        if (unpriced.includes(o.key)) continue;
        expect(SEATS[o.key], `${m}/${o.key}`).toBeGreaterThan(0);
      }
    }
  });

  it('does not require a national bid while the field is smaller than the ask', () => {
    // The specific regression, stated in its own terms so the diff that
    // reintroduces it is unambiguous. Contend and championship together run to
    // twenty two programs at their peak over thirty five seasons; the field
    // seats eight.
    const asked = demand(1.1).tournament ?? 0;
    expect(asked).toBeLessThanOrEqual(NATIONAL_BIDS);
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
  /*
    Twelve shapes, not six sizes.

    The old ladder measured how much a man had won and nothing else, and it
    produced the fault that started the rewrite: "Journeyman" sat at the bottom
    meaning *has coached one game*, so seventy-one of ninety-six coaches wore it
    at year thirty and the word did no work at all.

    A journeyman is a man who has been six places. Everything here follows from
    that: a title describes the shape of a career, so two men with identical
    records read differently if one never left town and the other has packed six
    times — and achievement still outranks shape, because a man who moved six
    times and won two titles is a champion who happened to move.

    The properties carried over from the old block are the ones that were about
    honesty rather than about rungs: time served does not promote you, a trophy
    cannot be taken back off you, and a good season that won nothing moves
    nothing.
  */

  const coachWith = (over: Partial<CoachState>): CoachState =>
    ({ ...newCoach(), ...over });

  it('starts nobody as anything', () => {
    expect(coachStanding(newCoach()).title).toBe('Unproven');
    expect(coachStanding(newCoach()).lifer).toBe(false);
  });

  it('means six programmes by journeyman, not one game', () => {
    // The whole reason for the rewrite, stated as a test.
    const beginner = coachWith({ careerWins: 8, careerLosses: 6, stints: 1 });
    expect(coachStanding(beginner).title).not.toBe('Journeyman');

    const drifter = coachWith({
      careerWins: 300, careerLosses: 320, stints: 6,
    });
    expect(coachStanding(drifter).title).toBe('Journeyman');
  });

  it('calls a drifter who won things a champion, not a drifter', () => {
    // Priority: achievement above shape. A man who moved six times and won two
    // national titles is not introduced as somebody who cannot hold a job.
    const both = coachWith({
      careerWins: 400, careerLosses: 300, stints: 7, titles: 2,
    });
    expect(coachStanding(both).title).toBe('Champion');
  });

  it('does not promote a coach for merely surviving', () => {
    // Twenty years of losing at one place. He is a lifer, which is true and is
    // not a promotion — nothing here says he was any good.
    const timeServer = coachWith({
      tenure: 20, careerWins: 300, careerLosses: 400, prestige: 30, stints: 1,
    });
    const title = coachStanding(timeServer).title;
    expect(['Lifer', 'Journeyman']).toContain(title);
    expect(title).not.toBe('Respected');
    expect(title).not.toBe('Contender');
  });

  it('never introduces a national champion as anything less', () => {
    // Prestige decays when nothing happens, so a title winner having a thin
    // decade must not slide back down.
    const champion = coachWith({
      titles: 1, prestige: 20, careerWins: 200, careerLosses: 300, stints: 3,
    });
    expect(coachStanding(champion).title).toBe('Champion');
  });

  it('separates three titles from one, and a long career from a short one', () => {
    const once = coachWith({ titles: 1, careerWins: 200, careerLosses: 150 });
    const thrice = coachWith({ titles: 3, careerWins: 300, careerLosses: 200 });
    const forever = coachWith({ titles: 3, careerWins: 600, careerLosses: 400 });
    expect(coachStanding(once).title).toBe('Champion');
    expect(coachStanding(thrice).title).toBe('Dynasty');
    expect(coachStanding(forever).title).toBe('Legend');
  });

  it('has a word for the man who keeps reaching June and never wins it', () => {
    // The career most coaches would actually take, and the old ladder called it
    // Established, which says nothing about him.
    const regular = coachWith({
      careerWins: 300, careerLosses: 180, tournaments: 4, conferenceTitles: 2,
    });
    expect(coachStanding(regular).title).toBe('Respected');

    // And one for the man who got closer than that, more than once.
    const nearly = coachWith({ ...regular, regionalTitles: 1 });
    expect(coachStanding(nearly).title).toBe('Nearly man');

    // Three regional banners is a different career again -- and three rather
    // than two because June hangs sixteen of them a year, so two is the
    // seventy-fifth percentile rather than an achievement.
    const contender = coachWith({ ...regular, regionalTitles: 3 });
    expect(coachStanding(contender).title).toBe('Contender');
  });

  it('reads a career spent on wrecks, and one spent building', () => {
    const firefighter = coachWith({
      careerWins: 200, careerLosses: 240, stints: 4, rebuilds: 3,
    });
    expect(coachStanding(firefighter).title).toBe('Firefighter');

    const builder = coachWith({
      careerWins: 200, careerLosses: 160, stints: 2, rebuilds: 1, bestBuild: 18,
    });
    expect(coachStanding(builder).title).toBe('Builder');
  });

  it('calls a man who stayed fifteen years a lifer, whatever else he is', () => {
    // Deliberately apart from the ladder: it is the one thing here earned by
    // staying rather than winning, so a bad run must not be able to take it.
    const lifer = coachWith({ tenure: LIFER_SEASONS, careerWins: 200, careerLosses: 250 });
    expect(coachStanding(lifer).lifer).toBe(true);

    const nearly = coachWith({ tenure: LIFER_SEASONS - 1 });
    expect(coachStanding(nearly).lifer).toBe(false);
  });

  /*
    Reported against the first version: UNPROVEN to RESPECTED in a single
    season with nothing won. Two rungs on one year, because a win percentage
    clause with no minimum career behind it read one 25-14 spring as a decade of
    winning baseball.

    Under shapes it cannot happen at all — nothing here reads a season, only a
    career — but the property is worth keeping pinned, because it is the one
    that made the original ladder dishonest.
  */
  it('does not pay a good season that won nothing', () => {
    const winning = coachWith({ careerWins: 25, careerLosses: 14, prestige: 34 });
    expect(coachStanding(winning).title).toBe('Rookie');

    const overachieved = coachWith({ careerWins: 40, careerLosses: 5, prestige: 46 });
    expect(coachStanding(overachieved).title).toBe('Rookie');
  });

  it('pays a trophy on the day it is won', () => {
    // A man who wins the thing in his first June is not a rookie that
    // afternoon, whatever a ladder climbed with seasons has to say about it.
    const champion = coachWith({
      careerWins: 40, careerLosses: 12, titles: 1, tournaments: 1,
      regionalTitles: 1, conferenceTitles: 1,
    });
    expect(coachStanding(champion).title).toBe('Champion');
  });

  it('gives every rung a line explaining it', () => {
    // A word nobody can interpret is a word doing no work, which is what
    // "Established" was.
    for (const t of Object.keys(TITLE_BLURB) as (keyof typeof TITLE_BLURB)[]) {
      expect(TITLE_BLURB[t].length, `${t} has no line`).toBeGreaterThan(15);
      expect(TITLE_BLURB[t].endsWith('.'), `${t} is not a sentence`).toBe(true);
    }
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

  **They have been re-recorded once, deliberately**, when the checklist stopped
  requiring a national bid of contenders. Worth reading what moved, because it is
  the argument that the change was surgical: `missed` and `failed` did not move
  at all, and neither did the wins asked for. Every review that failed a required
  box before fails exactly one before and after — a contender that used to miss
  the bid now misses the top three instead, and a championship board's conference
  title is the same event as the bid it replaced. What moved is 72 reviews from
  `met` to `exceeded`, because a contender now carries three bonus boxes where it
  carried two, and the security and contract totals that follow from those 72.
*/

/** Every kind of program, every kind of season, every kind of seat. */
const GRID: { prestige: number; roster: number }[] = [];
for (let p = 20; p <= 90; p += 5) {
  for (let r = 20; r <= 90; r += 5) GRID.push({ prestige: p, roster: r });
}

/*
  Five seasons, and the fourth one carries a correction.

  It used to reach the national field without winning its conference, which is a
  season this format cannot produce: the field *is* the eight conference
  champions, so `madeTournament` and `wonConference` are the same fact until the
  postseason grows. Nothing read `wonConference` as a requirement, so the
  contradiction cost nothing and sat there. It stopped being free the moment a
  championship board started requiring the conference title — a fifth of the
  sweep was then failing a box that the `madeTournament` beside it said had been
  cleared, which prices a checklist change against a world that does not exist.
*/
const SEASONS: SeasonOutcome[] = [
  outcome({ wins: 8, losses: 37, conferenceRank: 8, conferenceSize: 8 }),
  outcome({ wins: 16, losses: 29, conferenceRank: 6, conferenceSize: 8 }),
  outcome({ wins: 23, losses: 22, conferenceRank: 4, conferenceSize: 8 }),
  outcome({
    wins: 30, losses: 15, conferenceRank: 2, conferenceSize: 8,
    wonConference: true, madeTournament: true,
  }),
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
    //
    // Re-pinned twice, deliberately, and both times for the same reason: a
    // required box moved because it had more askers than the format has seats.
    //
    // First when the postseason expanded and the championship mandate's trophy
    // went from the conference title to the regional banner. Then again when
    // its *placement* box went from top three to top half — `topThree` has
    // twenty-four seats a year, three in each of eight conferences, and both
    // top tiers were being sent at them, so the worst year in a played league
    // asked twenty-six programs to fill twenty-four chairs.
    //
    // Four rows move from missed to failed and nothing else does, which is the
    // shape to expect: the same programs, graded against a box that has room
    // behind it. The live-league tuning tests in `rivals.test.ts` (clear rate,
    // turnover, capacity) are the real gauge.
    // Re-pinned a third time, September 1, and this one is a rule change
    // rather than a format change: a winning record is now a BONUS box on
    // the develop and build lists. Reported from a thirty-season save —
    // "I ended with a winning record the last two seasons but they neither
    // counted nor improved my relationship with the board" — and they did
    // not, because .500 was only ever scored on the compete list, which the
    // smallest programmes in the country are never handed.
    //
    // Forty-four rows move from met to exceeded and NOTHING else moves:
    // missed and failed are identical to the digit. That is the shape to
    // expect from a bonus — it can only lift a season that already cleared
    // its required boxes, and it can never save one that did not.
    expect(sweep().verdicts)
      .toEqual({ exceeded: 1680, met: 316, missed: 612, failed: 1892 });
  });

  it('asks for the same wins and moves security by the same amount', () => {
    const { wins, security } = sweep();
    // The win target has never moved and must not: the clear rate was closed by
    // taking a box the format could not supply off the list, not by lowering the
    // number beside it, which would have hidden the incoherence behind a digit.
    // The win target still has not moved, and that is the point of keeping
    // it here: the September 1 pass softened the board by scoring a real
    // achievement and by narrowing the renew band, NOT by lowering the
    // number beside the ask.
    expect(wins).toBe(107620);
    // Security is 484 kinder across 3600 reviews — the forty-four seasons
    // that became exceeded, and nothing else.
    expect(security).toBe(-17407);
  });

  it('keeps and lets go of exactly the same men, by the same two routes', () => {
    const { fired, sacked, notRenewed, extended } = sweep();
    // Sacked mid-contract is untouched at 1252: the bar that stops the car
    // is still 20, and it is the same bar every rival has. What moved is the
    // second route — the contract that simply is not renewed — where the
    // player's bar came down from 45 to 38. Ninety fewer men lose the job.
    //
    // The bar was tried at 34 first and the route caught nobody at all in
    // this sweep. A rule that never fires is worse than a harsh one: it
    // reads as a promise the game does not keep.
    expect(fired).toBe(1725);
    expect(sacked).toBe(1252);
    expect(notRenewed).toBe(473);
    expect(extended).toBe(1260);
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
    expect(PLAYER_RENEW_BAR).toBe(38);
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
      expectation: mine.expectation, renewAt: SACK_BAR, sackAt: SACK_BAR,
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

/*
  The low-star climb. Backlog §P, and the user's own design.

  Measured before it was written: a one-star programme run competently won ten
  to twelve of forty five for twenty four straight years and settled at a
  standing of about twenty two. It was not being beaten down; it was being held
  level, which is worse, because a league whose bottom cannot move is a league
  whose bottom is scenery.

  The constraint these pin is the one that came with the request -- *"1 star
  schools should not be able to shoot for 5 star but at least be able to
  progressively climb"* -- so every test here has a matching test that the door
  stays shut for a programme that has not won anything.
*/
describe('a small programme climbing', () => {
  const small = 22;
  const blue = 78;

  it('pays a small school more for the same June than a blue blood', () => {
    const june = outcome({ wins: 30, losses: 15, madeRegionals: true, madeTournament: true });
    const smallGain = nextPrestige(small, june) - small;
    const blueGain = nextPrestige(blue, june) - blue;
    expect(smallGain).toBeGreaterThan(0);
    // The blue blood is above `CLIMBING_UNDER`, so none of this touches it and
    // its number moves on the season's own merit alone.
    expect(climbLift(blue)).toBe(1);
    expect(climbBonus(blue, june)).toBe(0);
    expect(smallGain).toBeGreaterThan(blueGain);
  });

  it('gives a school with nothing to show for it exactly nothing', () => {
    /*
      The whole shape of the request, and the reason the first version of this
      was measured and rejected. A lift that pays for merely existing is a
      league where ninety six programmes all drift upward, and the bottom
      empties. Eleven wins of forty five is what the measured baseline actually
      does, and it must stay where it is.
    */
    const nothing = outcome({ wins: 11, losses: 34, madeRegionals: false, drought: 6 });
    expect(climbBonus(small, nothing)).toBe(0);
    expect(nextPrestige(small, nothing)).toBe(small);
  });

  it('cannot be ridden from one star to five', () => {
    // A one-star programme that plays a regional every year for a decade and
    // never wins one. It should become a real programme; it should not become
    // a blue blood, and `CLIMBING_UNDER` is where the help stops.
    let p = 19;
    const decent = outcome({ wins: 27, losses: 18, madeRegionals: true, madeTournament: true });
    for (let y = 0; y < 12; y++) p = nextPrestige(p, decent);
    expect(p).toBeGreaterThan(40);
    expect(p, 'the bottom rung reached the top of the table').toBeLessThan(75);
  });

  it('lets it slide back down if the good years stop', () => {
    // The other half of the sentence: "and descend if they do a bad job."
    // The bank is not a ratchet — the drift is still pulling toward what the
    // programme has actually been doing lately.
    let p = 42;
    const bad = outcome({ wins: 11, losses: 34, madeRegionals: false, drought: 6 });
    for (let y = 0; y < 10; y++) p = nextPrestige(p, bad);
    expect(p).toBeLessThan(32);
  });

  it('shelters a short drought and not a long one', () => {
    /*
      The season has to be one that actually argues for a *lower* standing than
      the programme currently holds, or the shelter never engages and the test
      proves nothing. Eighteen and twenty seven is a .400 year, which targets 40
      — a programme sitting at 34 is *rising* on that, and the first version of
      this test asserted a difference between two numbers that were both a climb.
    */
    const missed = outcome({ wins: 9, losses: 36, madeRegionals: false });
    const short = nextPrestige(small + 12, { ...missed, drought: 1 });
    const long = nextPrestige(small + 12, { ...missed, drought: DROUGHT_GRACE });
    // Both fall — a bad year is still a bad year — but one bad year does not
    // unwind five good ones.
    expect(short).toBeGreaterThan(long);
    expect(long).toBeLessThan(small + 12);
  });

  it('does not shelter a programme that has already arrived', () => {
    const missed = outcome({ wins: 18, losses: 27, madeRegionals: false, drought: 0 });
    const at = CLIMBING_UNDER + 20;
    // No grace above `CLIMBING_UNDER`: a real programme having a bad year is
    // exactly the case the ordinary drift is for.
    expect(nextPrestige(at, missed)).toBe(nextPrestige(at, { ...missed, drought: 9 }));
  });

  it('keeps the coach graded on the absolute season, not the school size', () => {
    /*
      The reason `programTarget` exists as a second function rather than as an
      argument to `seasonScore`. `nextCoachPrestige` reads
      `seasonScore(o) - programPrestige`, i.e. overachievement. Fold the
      school's standing into the score and a coach at a small school is paid
      twice for the same regional, which would make the smallest jobs the most
      rewarding in the country.
    */
    const june = outcome({ wins: 30, losses: 15, madeRegionals: true, madeTournament: true });
    expect(seasonScore(june)).toBe(seasonScore(june));
    expect(programTarget(small, june)).toBeGreaterThan(seasonScore(june));
    expect(programTarget(blue, june)).toBe(seasonScore(june));
  });
});
