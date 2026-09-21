import { describe, expect, it } from 'vitest';
import {
  bankStint, coachStanding, contractFor, newCoach, objectivesFor, prestigeStars, reviewSeason,
  takeChair,
  type Board, type CoachState, type SeasonOutcome,
} from '../src/engine/program.js';
import { useDynasty } from '../src/state/store.js';

function outcome(over: Partial<SeasonOutcome> = {}): SeasonOutcome {
  return {
    wins: 13,
    losses: 32,
    conferenceRank: 6,
    conferenceSize: 12,
    madeConferenceTournament: true,
    wonConference: false,
    madeTournament: false,
    wonRegional: false,
    madeRegionals: false,
    reachedOmaha: false,
    wonTitle: false,
    ...over,
  };
}

const developBoard: Board = {
  expectation: {
    mandate: 'develop',
    targetWins: 13,
    summary: 'Develop the program',
    detail: '',
    objectives: objectivesFor('develop', 13),
  },
  renewAt: 38,
  sackAt: 20,
};

function coach(over: Partial<CoachState> = {}): CoachState {
  return {
    ...newCoach(),
    prestige: 25,
    security: 62,
    tenure: 2,
    contractYears: 5,
    contractLength: 5,
    badRun: 0,
    ...over,
  };
}

describe('rebuild prestige progression', () => {
  it('rewards the exact 3-of-6 mandate shape plus a conference postseason berth', () => {
    // Wins + not-last are required. Sixth of twelve also clears the top-half
    // bonus, while winning season, stretch wins and national bid all miss.
    const review = reviewSeason(coach(), 35, 35, outcome(), 45, developBoard);

    expect(review.verdict).toBe('met');
    expect(review.prestigeAfter).toBe(37);
    expect(review.prestigeReasons).toEqual([
      { label: 'Met board expectations', amount: 1 },
      { label: 'Reached conference tournament', amount: 1 },
    ]);
    expect(review.coachPrestigeAfter).toBeGreaterThanOrEqual(review.coachPrestigeBefore);
  });

  it('still progresses for meeting the mandate without inventing postseason credit', () => {
    const review = reviewSeason(
      coach(),
      35,
      35,
      outcome({ conferenceRank: 9, madeConferenceTournament: false }),
      45,
      developBoard,
    );

    expect(review.verdict).toBe('met');
    expect(review.prestigeAfter).toBe(36);
    expect(review.prestigeReasons).toEqual([
      { label: 'Met board expectations', amount: 1 },
    ]);
  });

  it('carries rebuild assistance through the entire two-star band', () => {
    expect(prestigeStars(47)).toBe(2);
    const review = reviewSeason(
      coach(),
      47,
      45,
      outcome({ wins: 23, losses: 22 }),
      45,
      developBoard,
    );
    expect(review.prestigeAfter).toBeGreaterThanOrEqual(48);
  });
});

describe('coaching contracts', () => {
  it('uses longer rebuild-friendly contract lengths', () => {
    expect(contractFor(25)).toBe(7);
    expect(contractFor(38)).toBe(6);
    expect(contractFor(48)).toBe(5);
    expect(contractFor(60)).toBe(5);
    expect(contractFor(72)).toBe(4);
  });

  it('renews an approved coach instead of leaving him at zero years', () => {
    const review = reviewSeason(
      coach({ contractYears: 1, contractLength: 5, security: 62, tenure: 4 }),
      35,
      35,
      outcome(),
      45,
      developBoard,
    );

    expect(review.verdict).toBe('met');
    expect(review.renewed).toBe(true);
    expect(review.fired).toBe(false);
    expect(review.contractYears).toBe(7);
    expect(review.contractLength).toBe(7);
  });

  it('keeps a two-year cushion for a secure coach who keeps meeting the job', () => {
    const review = reviewSeason(
      coach({ contractYears: 2, contractLength: 7, security: 62, tenure: 4 }),
      35,
      35,
      outcome(),
      45,
      developBoard,
    );

    expect(review.verdict).toBe('met');
    expect(review.extended).toBe(true);
    expect(review.renewed).toBe(false);
    expect(review.contractYears).toBe(2);
  });
});

describe('the builder title', () => {
  // Rivals bank what they built at every board meeting; the player's
  // `bestBuild` was never raised at all, so Builder was a rivals-only title.
  it('is earned at the board meeting by a coach who lifted his program', () => {
    useDynasty.getState().start(4242, 0);
    const s = useDynasty.getState();
    // Walked into a 30 five seasons ago, and it is a 66 now.
    s.season!.teams[s.userTeam]!.prestige = 66;
    useDynasty.setState({
      coach: { ...s.coach, arrivedPrestige: 30, tenure: 5, careerWins: 140, careerLosses: 110 },
    });
    expect(coachStanding(useDynasty.getState().coach).title).not.toBe('Builder');

    useDynasty.getState().settleSeason();

    const after = useDynasty.getState();
    const now = after.season!.teams[after.userTeam]!.prestige;
    // Whatever this season cost the program, it is still a build worth the name.
    expect(now - 30).toBeGreaterThanOrEqual(12);
    expect(after.coach.bestBuild).toBe(now - 30);
    expect(coachStanding(after.coach).title).toBe('Builder');
  });

  it('keeps the best build rather than the latest, and takes it to the next chair', () => {
    const lifted = bankStint(
      { ...newCoach(), careerWins: 140, careerLosses: 110, arrivedPrestige: 36, bestBuild: 0 },
      60,
    );
    expect(lifted.bestBuild).toBe(24);
    // The program slipping after he lifted it does not take the build back.
    expect(bankStint(lifted, 50).bestBuild).toBe(24);

    // A new job is a new baseline, not a new build.
    const moved = takeChair(lifted, 30);
    expect(moved.arrivedPrestige).toBe(30);
    expect(moved.bestBuild).toBe(24);
    expect(coachStanding(moved).title).toBe('Builder');
  });
});
