// world.test.ts
// Stage 12: realignment and the rivalry. Mostly determinism and invariants —
// the two properties everything rests on are that a reload changes nothing
// and that a trade never changes the shape of a league.

import { describe, expect, it } from 'vitest';
import {
  realignmentFor, applyRealignment, headToHead, seriesStake,
} from '../src/engine/world.js';

/** A little country: three leagues of four, prestige shaped for a story. */
function country() {
  const teams: { index: number; conference: string; prestige: number }[] = [];
  const spec: [string, number[]][] = [
    ['POWER', [80, 74, 70, 40]],   // 40 is the faller-in-waiting
    ['MID', [76, 52, 50, 48]],     // 76 is the riser
    ['LOW', [38, 34, 32, 30]],
  ];
  let i = 0;
  for (const [conference, prestiges] of spec) {
    for (const prestige of prestiges) teams.push({ index: i++, conference, prestige });
  }
  return teams;
}

describe('realignment', () => {
  it('is derived: same world, year and table always answer the same', () => {
    for (let y = 2027; y < 2047; y++) {
      const a = realignmentFor('w', y, country(), 99);
      const b = realignmentFor('w', y, country(), 99);
      expect(a).toEqual(b);
    }
  });

  it('fires some winters and not others', () => {
    let fired = 0;
    for (let y = 2027; y < 2127; y++) {
      if (realignmentFor('w', y, country(), 99)) fired++;
    }
    expect(fired).toBeGreaterThan(15);
    expect(fired).toBeLessThan(60);
  });

  it('trades the outgrown program up and the slid one down', () => {
    // Find a year it fires.
    let move = null;
    for (let y = 2027; y < 2060 && !move; y++) move = realignmentFor('w', y, country(), 99);
    expect(move).not.toBeNull();
    // Riser is the MID league's 76; faller is POWER's 40.
    expect(move!.up).toBe(4);
    expect(move!.down).toBe(3);
    expect(move!.upTo).toBe('POWER');
    expect(move!.downTo).toBe('MID');
  });

  it('a trade never changes the size of any league', () => {
    const teams = country();
    const before = new Map<string, number>();
    for (const t of teams) before.set(t.conference, (before.get(t.conference) ?? 0) + 1);
    let move = null;
    for (let y = 2027; y < 2060 && !move; y++) move = realignmentFor('w', y, teams, 99);
    applyRealignment(teams, move!);
    const after = new Map<string, number>();
    for (const t of teams) after.set(t.conference, (after.get(t.conference) ?? 0) + 1);
    expect(after).toEqual(before);
  });

  it('never relegates the user, and skips to the next faller instead', () => {
    // Make the user the natural faller (index 3, POWER's 40-prestige chair).
    for (let y = 2027; y < 2127; y++) {
      const move = realignmentFor('w', y, country(), 3);
      if (move) expect(move.down).not.toBe(3);
    }
  });

  it('keeps a trade inside the region or next door', () => {
    /*
      Real conference names, so regionOf answers honestly: the riser plays in
      the PAC (WEST). The strongest league above him is the ATL — SOUTH, the
      other side of the country — and the near option is the MTN, one region
      over is not even needed: same region. Decided September 2, night, after
      Piedmont State was sent to the Pacific: the move goes nearby or not at
      all.
    */
    const teams: { index: number; conference: string; prestige: number }[] = [];
    const spec: [string, number[]][] = [
      ['ATL', [90, 84, 80, 40]],  // strongest league, far away — never legal
      ['MTN', [80, 74, 70, 42]],  // strong AND same region — the destination
      ['PAC', [76, 52, 50, 48]],  // the riser's league (WEST)
    ];
    let i = 0;
    for (const [conference, prestiges] of spec) {
      for (const prestige of prestiges) teams.push({ index: i++, conference, prestige });
    }
    let moved = 0;
    for (let y = 2027; y < 2127; y++) {
      const move = realignmentFor('w', y, teams, 99);
      if (!move) continue;
      moved++;
      expect(move.upTo).not.toBe('ATL');
      expect(move.upTo).toBe('MTN');
    }
    // The rule must bend the moves, not stop them: winters still trade.
    expect(moved).toBeGreaterThan(0);
  });

  it('stays home when nobody has outgrown anywhere', () => {
    const flat = country().map((t) => ({ ...t, prestige: 50 }));
    for (let y = 2027; y < 2077; y++) {
      expect(realignmentFor('w', y, flat, 99)).toBeNull();
    }
  });
});

describe('the rivalry ledger', () => {
  it('reads a season head-to-head from the results log', () => {
    const season = {
      results: [
        { home: 1, away: 2, homeRuns: 5, awayRuns: 3 },
        { home: 2, away: 1, homeRuns: 7, awayRuns: 1 },
        { home: 1, away: 2, homeRuns: 4, awayRuns: 2 },
        { home: 1, away: 3, homeRuns: 9, awayRuns: 0 }, // not the rivalry
      ],
    } as never;
    expect(headToHead(season, 1, 2)).toEqual({ w: 2, l: 1 });
    expect(headToHead(season, 2, 1)).toEqual({ w: 1, l: 2 });
    expect(headToHead(season, 1, 4)).toEqual({ w: 0, l: 0 });
  });
});

describe('series stakes', () => {
  it('says what tonight settles, and only when it settles something', () => {
    expect(seriesStake(0, 0)).toBeNull();                       // game 1
    expect(seriesStake(1, 1)).toBe('A win takes the series.');  // up 1-0
    expect(seriesStake(1, 0)).toBeNull();                       // down 1-0
    expect(seriesStake(2, 1)).toBe('The decider.');             // level in game 3
    expect(seriesStake(2, 2)).toBe('The sweep is on the table.');
    expect(seriesStake(2, 0)).toBe('The salvage game.');
  });
});
