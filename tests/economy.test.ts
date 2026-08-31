// economy.test.ts
// The program's money. Mostly determinism tests, because everything in the
// module is derived — the one property the whole stage rests on is that a
// reload changes nothing about the market, the wages or a poaching.

import { describe, expect, it } from 'vitest';
import {
  annualBudget, dollars, marketFor, wageFor, wageBill, staffBonus, withStaff,
  poached, remaining, freshEconomy, FACILITIES, MAX_FACILITY, SEATS,
  SCOUT_COST, type Assistant,
} from '../src/engine/economy.js';

describe('the budget', () => {
  it('scales with prestige and never goes silly', () => {
    expect(annualBudget(0)).toBe(750);
    expect(annualBudget(25)).toBe(1075);
    expect(annualBudget(80)).toBe(1790);
    // Clamped: a corrupted prestige cannot mint money.
    expect(annualBudget(500)).toBe(annualBudget(100));
    expect(annualBudget(-40)).toBe(annualBudget(0));
  });

  it('prints like money', () => {
    expect(dollars(430)).toBe('$430k');
    expect(dollars(1280)).toBe('$1.28M');
  });

  it('a full staff at low prestige eats most of the purse', () => {
    // The design sentence: every dollar has two things it could have been.
    const eco = freshEconomy();
    for (const seat of SEATS) {
      const best = marketFor('w', 2027, seat)[0]!;
      eco.staff[seat] = best;
    }
    const left = remaining(eco, 25);
    expect(left).toBeLessThan(annualBudget(25) / 2);
    // But never negative from wages alone — the market prices itself under
    // the poorest budget.
    expect(left).toBeGreaterThan(0);
  });
});

describe('the market', () => {
  it('is derived: the same world and year always offer the same men', () => {
    const a = marketFor('world-1', 2030, 'hitting');
    const b = marketFor('world-1', 2030, 'hitting');
    expect(a).toEqual(b);
  });

  it('differs by year, seat and world', () => {
    const base = marketFor('world-1', 2030, 'hitting').map((m) => m.id).join();
    expect(marketFor('world-1', 2031, 'hitting').map((m) => m.id).join()).not.toBe(base);
    expect(marketFor('world-1', 2030, 'pitching').map((m) => m.id).join()).not.toBe(base);
    expect(marketFor('world-2', 2030, 'hitting').map((m) => m.id).join()).not.toBe(base);
  });

  it('offers a real spread: best first, and the floor is affordable', () => {
    for (let year = 2027; year < 2047; year++) {
      const men = marketFor('w', year, 'recruiting');
      expect(men).toHaveLength(3);
      expect(men[0]!.rating).toBeGreaterThanOrEqual(men[2]!.rating);
      expect(men[0]!.rating).toBeLessThanOrEqual(88);
      expect(men[2]!.rating).toBeGreaterThanOrEqual(25);
      for (const m of men) expect(m.wage).toBe(wageFor(m.rating));
    }
  });
});

describe('the staff', () => {
  const man = (seat: 'pitching' | 'hitting' | 'recruiting', rating: number): Assistant =>
    ({ id: `t:${seat}`, name: 'T', age: 40, rating, wage: wageFor(rating), seat });

  it('stacks on the calibrated skills and nowhere else', () => {
    const skills = { offense: 30, defense: 30, training: 30, recruiting: 30 };
    const staffed = withStaff(skills, {
      hitting: man('hitting', 60),
      pitching: man('pitching', 60),
      recruiting: man('recruiting', 60),
    });
    expect(staffed.offense).toBe(42);
    expect(staffed.defense).toBe(42);
    expect(staffed.recruiting).toBe(45);
    // Training belongs to the facilities, not a seat.
    expect(staffed.training).toBe(30);
  });

  it('caps where the skills cap', () => {
    const skills = { offense: 95, defense: 95, training: 95, recruiting: 95 };
    const staffed = withStaff(skills, { hitting: man('hitting', 88) });
    expect(staffed.offense).toBe(99);
  });

  it('empty seats add nothing', () => {
    expect(staffBonus({})).toEqual({ offense: 0, defense: 0, training: 0, recruiting: 0 });
    expect(wageBill({})).toBe(0);
  });

  it('poaching is derived and follows quality', () => {
    const star = man('recruiting', 80);
    const plain = man('recruiting', 35);
    // Deterministic: the same man and year always answer the same way.
    expect(poached(star, 2030)).toBe(poached(star, 2030));
    // And measured over many winters, the star leaves far more often.
    let starGone = 0;
    let plainGone = 0;
    for (let y = 2027; y < 2127; y++) {
      if (poached(star, y)) starGone++;
      if (poached(plain, y)) plainGone++;
    }
    expect(starGone).toBeGreaterThan(plainGone * 2);
    expect(starGone).toBeGreaterThan(10);
    expect(starGone).toBeLessThan(45);
  });
});

describe('facilities and the desk', () => {
  it('rungs are ordered and priced like an argument with the wage bill', () => {
    expect(FACILITIES).toHaveLength(MAX_FACILITY + 1);
    expect(FACILITIES[0]!.cost).toBe(0);
    for (let i = 1; i < FACILITIES.length; i++) {
      expect(FACILITIES[i]!.cost).toBeGreaterThan(FACILITIES[i - 1]!.cost);
      expect(FACILITIES[i]!.trainBump).toBeGreaterThan(FACILITIES[i - 1]!.trainBump);
    }
    // The top rung costs more than a year of the best staff's wages.
    expect(FACILITIES[MAX_FACILITY]!.cost).toBeGreaterThan(wageFor(88) * 3);
  });

  it('a scouting habit is what no budget survives', () => {
    // Thirty-odd series a year at the scout cost outruns what is left after a
    // real staff — the number is sized to make every book a bad plan.
    expect(SCOUT_COST * 30).toBeGreaterThan(annualBudget(25) - wageFor(70) * 3);
  });
});
