// coach-badges.test.ts
// Every coach badge does what its line says (src/engine/coachEdges.ts).
//
// They were defined and awarded for a long time with nothing behind them
// (audit 17, L-finding on coach badges). These pin that each one is read, and
// that the in-game ones move a game in the direction the badge promises.

import { describe, it, expect } from 'vitest';
import { BADGES } from '../src/data/badges.js';
import { BADGES_WITH_EFFECT, edgesFor, leversFor } from '../src/engine/coachEdges.js';
import { TeamState, edgeBoost, simGame } from '../src/engine/game.js';
import { entersPortal } from '../src/engine/portal.js';
import { makeTeam } from '../src/engine/roster.js';
import { makeRng } from '../src/engine/rng.js';

describe('every coach badge has an effect', () => {
  for (const b of BADGES) {
    it(`${b.name} (${b.id})`, () => {
      // Rival tendencies are free to every career while scouting is held back,
      // so READS THE ROOM has nothing to make easier yet (coachEdges.ts).
      if (b.id === 'newsman') return;
      expect(BADGES_WITH_EFFECT).toContain(b.id);
      const inGame = edgesFor([b.id]);
      const lv = leversFor([b.id]);
      const neutral = leversFor([]);
      const moved = inGame !== undefined
        || (Object.keys(lv) as (keyof typeof lv)[]).some((k) => lv[k] !== neutral[k]);
      expect(moved).toBe(true);
    });
  }
});

describe('the in-game edges act where their lines say', () => {
  const team = makeTeam(makeRng(1), 'T', 50);
  const side = (badges: string[], home = true): TeamState =>
    new TeamState(team, home, 0, team.bullpen, team.lineup, undefined, { offense: 20, defense: 20, ...(edgesFor(badges) ? { edges: edgesFor(badges)! } : {}) });

  it('HARD-NOSED only late, GRINDER only late and close, NEVER DEAD only behind late', () => {
    expect(edgeBoost(side(['hardnosed']), 3, 0, true, false)).toBe(0);
    expect(edgeBoost(side(['hardnosed']), 8, 0, true, false)).toBeGreaterThan(0);
    expect(edgeBoost(side(['grinder']), 8, 3, true, false)).toBe(0);
    expect(edgeBoost(side(['grinder']), 8, -1, true, false)).toBeGreaterThan(0);
    expect(edgeBoost(side(['comeback']), 8, 2, true, false)).toBe(0);
    expect(edgeBoost(side(['comeback']), 8, -2, true, false)).toBeGreaterThan(0);
  });

  it('TRAVELS WELL only on the road, GAMBLER only on the call, NEVER A NIGHT OFF only managed', () => {
    expect(edgeBoost(side(['roadman'], true), 2, 0, true, false)).toBe(0);
    expect(edgeBoost(side(['roadman'], false), 2, 0, true, false)).toBeGreaterThan(0);
    expect(edgeBoost(side(['gambler']), 2, 0, true, false)).toBe(0);
    expect(edgeBoost(side(['gambler']), 2, 0, true, true)).toBeGreaterThan(0);
    const managed = side(['ironman']);
    expect(edgeBoost(managed, 2, 0, true, false)).toBe(0);
    managed.managedTonight = true;
    expect(edgeBoost(managed, 2, 0, true, false)).toBeGreaterThan(0);
  });

  it('a bench with every edge wins more than the same bench without', () => {
    const all = edgesFor(['hardnosed', 'grinder', 'comeback', 'roadman', 'smallball', 'penhand', 'methodical'])!;
    const winRate = (withEdges: boolean): number => {
      const rng = makeRng(42);
      let w = 0;
      const n = 1500;
      for (let i = 0; i < n; i++) {
        const a = makeTeam(makeRng(100 + (i % 30)), 'A', 50);
        const b = makeTeam(makeRng(900 + (i % 30)), 'B', 50);
        const mods = { offense: 20, defense: 20, ...(withEdges ? { edges: all } : {}) };
        const home = i % 2 === 0;
        const r = home ? simGame(a, b, rng, { homeCoachMods: mods }) : simGame(b, a, rng, { awayCoachMods: mods });
        const mine = home ? r.home.runs : r.away.runs;
        const theirs = home ? r.away.runs : r.home.runs;
        if (mine > theirs) w++;
      }
      return w / n;
    };
    expect(winRate(true)).toBeGreaterThan(winRate(false));
  }, 120_000);
});

describe('the off-field levers', () => {
  it('THE KEEPER keeps a man who would otherwise have walked', () => {
    const team = makeTeam(makeRng(3), 'T', 50);
    const men = [...team.lineup, ...team.bench].filter((p) => p.classYear !== 'SR');
    const at = { squadRank: 18, starts: 0, games: 50, year: 2030, seed: 7 };
    const leaving = men.filter((p) => entersPortal(p, at));
    const kept = leaving.filter((p) => !entersPortal(p, { ...at, exitMult: 0 }));
    expect(kept.length).toBe(leaving.length);
    expect(men.filter((p) => entersPortal(p, { ...at, exitMult: 0.85 })).length).toBeLessThanOrEqual(leaving.length);
  });

  it('the development badges add training on their own side', () => {
    expect(leversFor(['slugger']).trainBat).toBeGreaterThan(0);
    expect(leversFor(['armsman']).trainArm).toBeGreaterThan(0);
    expect(leversFor(['developer']).trainBat).toBeGreaterThan(0);
    expect(leversFor(['developer']).trainArm).toBeGreaterThan(0);
    expect(leversFor(['youth']).youngGrowth).toBeGreaterThan(1);
  });
});
