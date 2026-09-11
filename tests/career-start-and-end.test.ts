// career-start-and-end.test.ts
// Two reported on 2026-09-11, both about the shape of a career rather than a
// season inside one: the desk you are offered when you start, and what happens
// to the job when the board is finished with you.

import { describe, it, expect } from 'vitest';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import {
  startingOffers, reviewSeason, canBeHired, ROOKIE_PRESTIGE, rosterStrength,
} from '../src/engine/program.js';
import { BACKGROUNDS } from '../src/data/backgrounds.js';

// ---------------------------------------------------------------------------
// "All the time we are getting what I feel are the same schools"
// ---------------------------------------------------------------------------

describe('the desk a new coach is offered', () => {
  const bg = BACKGROUNDS[0]!;
  const deskFor = (n: number): string[] => {
    const seed = (n * 2654435761 + 7) >>> 0;
    const world = createSeason(makeRng(seed), undefined, CONFERENCES);
    return startingOffers(world.teams, 5, {
      leans: bg.leans, ambition: bg.ambition, rng: makeRng(seed ^ 0x0ffe4),
    }).map((i) => world.teams[i]!.def.abbr);
  };

  it('is not the same handful of programmes every career', () => {
    /*
      Measured before the fix across ten careers: twenty distinct schools
      filled fifty seats and two of them rang on seven desks out of ten. The
      pool was never the problem — sixty-seven of ninety-six programmes would
      hire a rookie, the same sixty-six in every world. All three orders were
      read strictly from the head, two of them sort on prestige, and prestige
      is a fixed property of a school.
    */
    const desks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(deskFor);
    const tally = new Map<string, number>();
    for (const desk of desks) for (const a of desk) tally.set(a, (tally.get(a) ?? 0) + 1);
    // Distinct schools across fifty seats.
    expect(tally.size).toBeGreaterThanOrEqual(20);
    // And nobody is on most of them.
    const worst = Math.max(...tally.values());
    expect(worst, `one programme rang on ${worst} of 10 desks`).toBeLessThanOrEqual(6);
  });

  it('still gives five distinct programmes, no more than two per conference', () => {
    const seed = 909;
    const world = createSeason(makeRng(seed), undefined, CONFERENCES);
    const picks = startingOffers(world.teams, 5, {
      leans: bg.leans, ambition: bg.ambition, rng: makeRng(seed),
    });
    expect(new Set(picks).size).toBe(picks.length);
    const perConf = new Map<string, number>();
    for (const i of picks) {
      const c = world.teams[i]!.conference;
      perConf.set(c, (perConf.get(c) ?? 0) + 1);
    }
    expect(Math.max(...perConf.values())).toBeLessThanOrEqual(2);
  });

  it('only ever rings from programmes that would actually hire a rookie', () => {
    const seed = 4242;
    const world = createSeason(makeRng(seed), undefined, CONFERENCES);
    const picks = startingOffers(world.teams, 5, {
      leans: bg.leans, ambition: bg.ambition, rng: makeRng(seed),
    });
    for (const i of picks) {
      const t = world.teams[i]!;
      // The fit softening is worth at most three points of coach prestige.
      expect(canBeHired(ROOKIE_PRESTIGE + 3, t.prestige, rosterStrength(t.team))).toBe(true);
    }
  });

  it('is the same desk twice for the same career', () => {
    // A seed is a career. Re-rendering the screen must not reshuffle it.
    expect(deskFor(3)).toEqual(deskFor(3));
  });

  it('takes the head of each order when nobody hands it a draw', () => {
    // A caller with no rng gets the old deterministic desk, unchanged.
    const world = createSeason(makeRng(77), undefined, CONFERENCES);
    const a = startingOffers(world.teams, 5, { leans: bg.leans, ambition: bg.ambition });
    const b = startingOffers(world.teams, 5, { leans: bg.leans, ambition: bg.ambition });
    expect(a).toEqual(b);
    expect(a.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// "You can still keep going with the same university"
// ---------------------------------------------------------------------------

describe('the board at the end of a deal', () => {
  const bad = {
    wins: 12, losses: 33, conferenceRank: 11, conferenceSize: 12,
    wonConference: false, madeTournament: false, wonRegional: false,
    reachedOmaha: false, wonTitle: false,
  };
  const coachAt = (contractYears: number, security: number) => ({
    prestige: 40, security, tenure: 3, badRun: 0,
    contractYears, contractLength: 4, caughtLooking: false,
  } as unknown as Parameters<typeof reviewSeason>[0]);

  it('lets a man go when the deal runs out and nobody wants him back', () => {
    const r = reviewSeason(coachAt(1, 50), 45, 45, bad, 45);
    expect(r.notRenewed).toBe(true);
    expect(r.fired).toBe(true);
    expect(r.contractYears).toBe(0);
  });

  it('sacks him outright when the seat goes cold, deal or no deal', () => {
    const r = reviewSeason(coachAt(3, 20), 45, 45, bad, 45);
    expect(r.fired).toBe(true);
    // Sacked is not the same as running out the deal.
    expect(r.notRenewed).toBe(false);
  });

  it('keeps him when the board still believes in him', () => {
    const r = reviewSeason(coachAt(3, 80), 45, 45, bad, 45);
    expect(r.fired).toBe(false);
    expect(r.contractYears).toBeGreaterThan(0);
  });

  it('renews an expired deal when the seat is warm enough', () => {
    const r = reviewSeason(coachAt(1, 80), 45, 45, bad, 45);
    expect(r.fired).toBe(false);
    expect(r.contractYears).toBeGreaterThan(0);
  });
});
