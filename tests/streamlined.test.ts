import { describe, expect, it } from 'vitest';
import {
  coordinatorFamiliarity, freshEconomy, marketFor, nightCraft, pipelineStrength,
  SEATS, shapeOf, staffBonus, winterCraft,
} from '../src/engine/economy.js';
import { availableRecruitPromises } from '../src/engine/recruiting.js';
import { makeHitter, makePitcher, makeTwoWay } from '../src/engine/players.js';
import { makeRng } from '../src/engine/rng.js';

describe('staff market variety', () => {
  it('offers three different specialties in every seat, year, and sampled world', () => {
    for (const world of ['starter', '789', 'same-name']) {
      for (let year = 2027; year < 2047; year++) {
        for (const seat of SEATS) {
          const market = marketFor(world, year, seat);
          expect(new Set(market.map(shapeOf)).size).toBe(3);
          expect(new Set(market.map((m) => `${winterCraft(m)}:${nightCraft(m)}`)).size).toBe(3);
          expect(market.filter((m) => m.winter >= 0.68)).toHaveLength(1);
          expect(market.filter((m) => m.winter <= 0.32)).toHaveLength(1);
          expect(market.every((m) => m.winter >= 0.18 && m.winter <= 0.82)).toBe(true);
          expect(marketFor(world, year, seat)).toEqual(market);
        }
      }
    }
  });

  it('does not tie one specialty to the most expensive candidate', () => {
    const styles = new Set(Array.from({ length: 30 }, (_, i) => shapeOf(marketFor('w', 2027 + i, 'hitting')[0]!)));
    expect(styles.size).toBe(3);
  });

  it('gives coordinators a real tradeoff between recruiting and state relationships', () => {
    const base = { ...marketFor('coordinators', 2027, 'recruiting')[0]!, rating: 60, pipelineState: 'TX' };
    const network = { ...base, winter: 0.75 };
    const recruiter = { ...base, winter: 0.25 };
    expect(coordinatorFamiliarity(network)).toBeGreaterThan(coordinatorFamiliarity(recruiter));
    expect(staffBonus({ recruiting: recruiter }).recruiting).toBeGreaterThan(staffBonus({ recruiting: network }).recruiting);
    const eco = freshEconomy();
    eco.staff.recruiting = network;
    expect(pipelineStrength(eco, 'TX', 'LA')).toBe(coordinatorFamiliarity(network));
    expect(pipelineStrength(eco, 'TX', 'LA')).toBeLessThan(35);
    eco.pipelines = { TX: { state: 'TX', strength: 70, signings: 3, lastSignedYear: 2027 } };
    expect(pipelineStrength(eco, 'TX', 'LA')).toBe(70);
    expect(pipelineStrength(eco, 'LA', 'LA')).toBe(60);
  });
});

describe('recruit promise eligibility', () => {
  it('omits a two-way promise for ordinary hitters and pitchers', () => {
    const rng = makeRng(512);
    for (const player of [makeHitter(rng), makePitcher(rng)]) {
      expect(availableRecruitPromises(player)).toEqual(['immediateRole', 'noRedshirt', 'keepPosition']);
    }
  });

  it('offers the two-way promise to an actual two-way recruit', () => {
    const player = makeTwoWay(makeRng(513));
    expect(availableRecruitPromises(player)).toContain('twoWayOpportunity');
    expect(availableRecruitPromises(player)).toHaveLength(4);
  });
});
