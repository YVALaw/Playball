// counters.test.ts
// The scouting desk's plan against an opponent, and the report that made it.
//
// "Hit auto, nothing moves." The plan is built from distances to the
// league now, so the promise to keep is the one the reporter wanted: against
// most clubs it visibly moves several rows, it never invents a row against a
// club that is ordinary in that respect, and the same club always gets the
// same plan.

import { describe, it, expect } from 'vitest';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { leagueBaselines, opponentPlan, teamMeasures } from '../src/engine/counters.js';
import { DEFAULT_STRATEGY, type Strategy } from '../src/engine/strategy.js';

const KEYS = Object.keys(DEFAULT_STRATEGY) as (keyof Strategy)[];
const VALID: Record<keyof Strategy, readonly string[]> = {
  running: ['patient', 'balanced', 'aggressive'],
  steals: ['never', 'selective', 'constant'],
  bunt: ['never', 'rare', 'often'],
  hook: ['quick', 'standard', 'patient'],
  alignment: ['straight', 'situational', 'shift'],
  infield: ['in', 'normal', 'back'],
  outfield: ['shallow', 'normal', 'deep'],
  shift: ['left', 'none', 'right'],
};

describe('the plan against an opponent', () => {
  const season = createSeason(makeRng(23), undefined, CONFERENCES);
  const base = leagueBaselines(season);

  it('moves several rows against most clubs, and every value is one the game knows', () => {
    let three = 0;
    for (const t of season.teams) {
      const plan = opponentPlan(season, t, { ...DEFAULT_STRATEGY }, base);
      let moved = 0;
      for (const k of KEYS) {
        expect(VALID[k], `${t.def.abbr} ${k}`).toContain(plan[k]);
        if (plan[k] !== DEFAULT_STRATEGY[k]) moved++;
      }
      if (moved >= 3) three++;
    }
    // The old counters moved one row against nearly everybody.
    expect(three).toBeGreaterThan(season.teams.length * 0.6);
  });

  it('is the same plan every time, and spends no draw', () => {
    const t = season.teams[7]!;
    const a = opponentPlan(season, t, { ...DEFAULT_STRATEGY });
    const b = opponentPlan(season, t, { ...DEFAULT_STRATEGY });
    expect(a).toEqual(b);
  });

  it('keeps the standing plan where the club is ordinary', () => {
    // A baseline centred on this club itself makes every distance zero, so
    // nothing the report measures is unusual and the offensive rows stay.
    const t = season.teams[3]!;
    const m = teamMeasures(t);
    const centred = {
      power: { mean: m.power, sd: 10 }, speed: { mean: m.speed, sd: 10 },
      catcherArm: { mean: m.catcherArm, sd: 10 }, outfieldArm: { mean: m.outfieldArm, sd: 10 },
      staff: { mean: m.staff, sd: 10 }, hold: { mean: m.hold, sd: 10 },
    };
    const standing: Strategy = { ...DEFAULT_STRATEGY, running: 'aggressive', steals: 'constant', bunt: 'often', hook: 'quick' };
    const plan = opponentPlan(season, t, standing, centred);
    expect(plan.running).toBe('aggressive');
    expect(plan.steals).toBe('constant');
    expect(plan.bunt).toBe('often');
    expect(plan.hook).toBe('quick');
  });

  it('calls a side only when one hand owns the pull, and never against the wrong hand', () => {
    for (const t of season.teams) {
      const m = teamMeasures(t);
      const plan = opponentPlan(season, t, { ...DEFAULT_STRATEGY }, base);
      if (plan.shift === 'left') expect(m.pullSide).toBe('left');
      if (plan.shift === 'right') expect(m.pullSide).toBe('right');
      if (plan.shift !== 'none') expect(plan.alignment).toBe('shift');
    }
  });
});
