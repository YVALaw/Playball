// offers.test.ts
// That what you said at creation decides who rings.
//
// This is the test that says the interview was worth writing. Eighty questions
// and ninety-six cultures are decoration if the desk comes out the same
// whatever a man answers — and that is not a hypothetical failure, it is what
// the first two implementations actually did.
//
// The first weighted culture so heavily that every offer matched, which reads
// as a filter rather than a market. The second weighted it so lightly that the
// same five best jobs rang for everybody. Both passed a typecheck and neither
// would have been noticed without measuring, so the balance is pinned here in
// both directions.

import { describe, it, expect } from 'vitest';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { startingOffers, offerPitch } from '../src/engine/program.js';
import { CONFERENCES } from '../src/data/schools.js';
import { cultureOf, type CultureEdge } from '../src/data/cultures.js';

const world = createSeason(makeRng(4242), undefined, CONFERENCES);

const desk = (leans: Partial<Record<CultureEdge, number>>, ambition = 0, seed = 7) =>
  startingOffers(world.teams, 5, { leans, ambition, rng: makeRng(seed) });

const edgesOf = (picks: readonly number[]): CultureEdge[] =>
  picks.map((i) => cultureOf(world.teams[i]!.def.abbr)!.edge);

describe('the desk reads the interview', () => {
  it('always fills, and never twice from one conference', () => {
    const picks = desk({ development: 4 });
    expect(picks.length).toBe(5);
    expect(new Set(picks).size, 'a programme offered twice').toBe(5);
    const confs = picks.map((i) => world.teams[i]!.conference);
    for (const c of new Set(confs)) {
      expect(confs.filter((x) => x === c).length, `${c} over-represented`)
        .toBeLessThanOrEqual(2);
    }
  });

  it('gives two different men two different desks', () => {
    const arms = desk({ pitching: 6, defense: 2 });
    const seller = desk({ recruiting: 6, ambition: 3 });
    const overlap = arms.filter((i) => seller.includes(i));
    // Some overlap is right: the best job a rookie can get should ring for
    // anybody. Four of five would mean the answers changed nothing.
    expect(overlap.length, 'two opposite coaches got the same desk')
      .toBeLessThanOrEqual(2);
  });

  it('rings from the places that actually want him', () => {
    /*
      The number that matters, held from both sides.

      Too low and the interview is decoration. Too high and the market is a
      filter — every programme on the desk sharing your one edge is not a
      country, it is a search result.
    */
    for (const [edge, leans] of [
      ['pitching', { pitching: 6, defense: 2 }],
      ['recruiting', { recruiting: 6, ambition: 2 }],
      ['development', { development: 6, loyalty: 2 }],
    ] as [CultureEdge, Partial<Record<CultureEdge, number>>][]) {
      const hits = edgesOf(desk(leans)).filter((e) => e === edge).length;
      expect(hits, `nobody who wants a ${edge} coach rang`).toBeGreaterThanOrEqual(1);
      expect(hits, `every offer was a ${edge} school`).toBeLessThanOrEqual(4);
    }
  });

  it('lets a programme reach below its standing for the right man', () => {
    // The whole point of culture in the market: a smaller school that wants
    // exactly what you are should be able to outbid a better one that does not.
    const picks = desk({ recruiting: 7 });
    const best = Math.max(...world.teams.map((t) => t.prestige));
    const reaching = picks
      .map((i) => world.teams[i]!)
      .filter((t) => cultureOf(t.def.abbr)!.edge === 'recruiting');
    expect(reaching.length, 'no recruiting school reached').toBeGreaterThan(0);
    // And at least one of them is not simply a good job that happened to match.
    expect(Math.min(...reaching.map((t) => t.prestige)))
      .toBeLessThan(best);
  });

  it('is the same desk for the same career, and moves between careers', () => {
    const leans = { development: 5 };
    expect(desk(leans, 0, 11)).toEqual(desk(leans, 0, 11));

    const seen = new Set<string>();
    for (let s = 0; s < 25; s++) seen.add(desk(leans, 0, s).join());
    expect(seen.size, 'every career gets an identical desk').toBeGreaterThan(4);
  });

  it('says why they called, in the school’s own terms', () => {
    const picks = desk({ pitching: 7 });
    const lines = picks.map((i) => offerPitch(world.teams[i]!, { leans: { pitching: 7 } }));
    for (const l of lines) {
      expect(l.endsWith('.'), 'a pitch is not a sentence').toBe(true);
      expect(l.length).toBeGreaterThan(20);
    }
    // At least one of them explains the match rather than the rung.
    expect(lines.some((l) => /arms/i.test(l)), 'nothing said why an arms man was wanted')
      .toBe(true);
  });

  it('still works for a man who answered nothing', () => {
    // Casual asks two questions, and a save from before this existed has no
    // leanings at all. Neither may produce an empty desk.
    expect(startingOffers(world.teams, 5).length).toBe(5);
    expect(startingOffers(world.teams, 5, {}).length).toBe(5);
  });
});
