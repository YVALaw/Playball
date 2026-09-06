import { describe, expect, it } from 'vitest';
import {
  contractFor, newCoach, objectivesFor, prestigeStars, reviewSeason,
  type Board, type CoachState, type SeasonOutcome,
} from '../src/engine/program.js';

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
