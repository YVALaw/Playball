// depthchart.test.ts
// That the chart fills nine different spots with nine different men, and that
// it does the right thing when one of them cannot play.
//
// The bug this file is mostly about is the one the naive implementation always
// has: every spot takes its own best available man, the shortstop tops the list
// at short, second and third, and the card comes back with him playing three
// positions at once. A man taken has to be a man spent, and the order the spots
// are filled in decides whether the result is sensible or silly.

import { describe, it, expect } from 'vitest';
import {
  SPOTS, chartFor, depthAt, startersFrom, promotions, reorder, available, squad,
  type DepthChart,
} from '../src/engine/depthChart.js';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { overallOf } from '../src/engine/ratings.js';
import type { Team, Position, PlayerId } from '../src/engine/types.js';

const fresh = (): Team => {
  const world = createSeason(makeRng(4242), undefined, CONFERENCES);
  return world.teams[11]!.team;
};

describe('the chart', () => {
  it('ranks every spot even when nothing has been written down', () => {
    const team = fresh();
    const chart = chartFor(team);
    for (const spot of SPOTS) {
      expect(chart[spot], `${spot} has no order`).toBeDefined();
      expect(chart[spot]!.length, `${spot} is short`).toBe(squad(team).length);
    }
  });

  it('ranks a man by what he is at that spot, not by what he is', () => {
    /*
      The reason the ranking runs through `fieldingAt`. A shortstop is usually
      the best second baseman on the roster, and ranking by plain overall would
      put the incumbent second baseman above him and then be surprised when the
      card looked wrong.
    */
    const team = fresh();
    const behindThePlate = depthAt(team, 'C');
    // The actual catcher leads the catching order, because everybody else pays
    // the trade surcharge to stand there.
    expect(behindThePlate[0]!.pos).toBe('C');
  });

  it('keeps what a coach wrote and fills in behind it', () => {
    const team = fresh();
    const men = squad(team);
    const last = men[men.length - 1]!.id;
    (team as Team & { depth?: DepthChart }).depth = { SS: [last] };
    const order = chartFor(team).SS!;
    expect(order[0], 'the coach was overruled').toBe(last);
    expect(order.length, 'the rest of the roster fell off').toBe(men.length);
    expect(new Set(order).size, 'somebody is listed twice').toBe(order.length);
  });
});

describe('today\'s nine', () => {
  it('fills every spot with a different man', () => {
    // The bug this file exists for.
    const team = fresh();
    const nine = startersFrom(team, 0);
    const ids = SPOTS.map((s) => nine[s]?.id).filter(Boolean);
    expect(ids.length, 'a spot went unfilled').toBe(9);
    expect(new Set(ids).size, 'somebody is playing two positions at once').toBe(9);
  });

  it('does not spend a shortstop at first base', () => {
    /*
      Why the spots are filled hardest first. Fill in scorebook order and first
      base takes the best available bat -- often the shortstop -- and then
      nobody is left who can play short.
    */
    const team = fresh();
    const nine = startersFrom(team, 0);
    expect(nine.SS, 'short went unfilled').not.toBeNull();
    // The man at short is a shortstop, or at worst somebody who can cover it.
    expect(['SS', '2B', '3B', 'CF']).toContain(nine.SS!.pos);
  });

  it('steps over a man who cannot play, and says who came in', () => {
    const team = fresh();
    const before = startersFrom(team, 0);
    const catcher = before.C!;
    (catcher as typeof catcher & { outUntil?: number }).outUntil = 30;

    const after = startersFrom(team, 10);
    expect(after.C, 'nobody caught').not.toBeNull();
    expect(after.C!.id, 'a suspended man was picked anyway').not.toBe(catcher.id);

    const news = promotions(team, 10);
    const forC = news.find((n) => n.spot === 'C');
    expect(forC, 'the promotion was not reported').toBeDefined();
    expect(forC!.out.id).toBe(catcher.id);
    expect(forC!.inFor.id).toBe(after.C!.id);
  });

  it('has him back the day his week is up', () => {
    const team = fresh();
    const nine = startersFrom(team, 0);
    const man = nine['2B']!;
    (man as typeof man & { outUntil?: number }).outUntil = 30;
    expect(available(man, 29)).toBe(false);
    expect(available(man, 30)).toBe(true);
    expect(startersFrom(team, 30)['2B']!.id).toBe(man.id);
  });

  it('leaves a redshirt out all year', () => {
    const team = fresh();
    const man = startersFrom(team, 0).LF!;
    (man as typeof man & { redshirt?: boolean }).redshirt = true;
    expect(available(man, 0)).toBe(false);
    expect(available(man, 200)).toBe(false);
    expect(startersFrom(team, 100).LF!.id).not.toBe(man.id);
  });

  it('still fields nine with several men out', () => {
    // A roster is thirteen hitters. Losing four still has to produce a card.
    const team = fresh();
    const nine = startersFrom(team, 0);
    for (const spot of ['C', 'SS', 'CF', '1B'] as Position[]) {
      (nine[spot] as { outUntil?: number }).outUntil = 50;
    }
    const after = startersFrom(team, 10);
    const ids = SPOTS.map((s) => after[s]?.id).filter(Boolean);
    expect(ids.length, 'the card came back short').toBe(9);
    expect(new Set(ids).size).toBe(9);
  });

  it('reports nothing when everybody is fit', () => {
    expect(promotions(fresh(), 0)).toEqual([]);
  });
});

describe('what the coach can change', () => {
  it('moves a man up a rung and remembers it', () => {
    const team = fresh();
    const order = chartFor(team)['3B']!;
    const second = order[1]!;
    reorder(team, '3B', second, -1);
    expect(chartFor(team)['3B']![0]).toBe(second);
    // And it is written down rather than recomputed by luck.
    expect((team as Team & { depth?: DepthChart }).depth?.['3B']?.[0]).toBe(second);
  });

  it('refuses to move a man off either end', () => {
    const team = fresh();
    const order = chartFor(team).LF!;
    reorder(team, 'LF', order[0]!, -1);
    expect(chartFor(team).LF![0]).toBe(order[0]);
    reorder(team, 'LF', order[order.length - 1]!, 1);
    expect(chartFor(team).LF![order.length - 1]).toBe(order[order.length - 1]);
  });

  it('ignores a man who is not on the roster', () => {
    const team = fresh();
    const before = chartFor(team).CF!;
    reorder(team, 'CF', 'nobody' as PlayerId, -1);
    expect(chartFor(team).CF!).toEqual(before);
  });

  it('drops a departed man out of a stored chart rather than crashing', () => {
    // Next June half of this chart has graduated.
    const team = fresh();
    (team as Team & { depth?: DepthChart }).depth = {
      SS: ['gone-1' as PlayerId, 'gone-2' as PlayerId],
    };
    const order = chartFor(team).SS!;
    expect(order).not.toContain('gone-1');
    expect(order.length).toBe(squad(team).length);
    expect(startersFrom(team, 0).SS).not.toBeNull();
  });
});

describe('what it did to the league', () => {
  it('picks the same nine the roster already had, on a fit team', () => {
    /*
      The calibration guard. Every program is built to fit its positions, so
      the chart's answer on day one has to be the lineup the generator already
      produced -- otherwise turning this on quietly re-picks ninety-six lineups
      and every number in the game moves.
    */
    const world = createSeason(makeRng(77), undefined, CONFERENCES);
    let differing = 0;
    for (const rec of world.teams) {
      const nine = startersFrom(rec.team, 0);
      const chartIds = new Set(SPOTS.map((s) => nine[s]?.id));
      const lineupIds = new Set(rec.team.lineup.map((p) => p.id));
      if (chartIds.size !== lineupIds.size) { differing++; continue; }
      for (const id of lineupIds) if (!chartIds.has(id)) { differing++; break; }
    }
    // Not asserted at zero: the generator fills a lineup by position in
    // scorebook order, which is exactly the greedy pass this deliberately does
    // not do, so a handful of rosters legitimately produce a better nine. The
    // bar is that it is a handful rather than the league.
    expect(differing, 'the chart re-picked most of the league').toBeLessThan(20);
  });

  it('never leaves a hitter ranked at a position he is not on the roster for', () => {
    const team = fresh();
    const ids = new Set(squad(team).map((m) => m.id));
    for (const spot of SPOTS) {
      for (const id of chartFor(team)[spot] ?? []) {
        expect(ids.has(id), `${spot} ranks somebody who is not here`).toBe(true);
      }
    }
  });

  it('leaves the incumbent DH in front and ranks the rest on the bat', () => {
    const team = fresh();
    const dh = depthAt(team, 'DH');
    // The man already in the slot leads it, because the chart's day-one answer
    // has to be the card the generator wrote. See `chartFor`.
    expect(dh[0]!.id).toBe(team.lineup.find((p) => p.pos === 'DH')!.id);
    // Behind him it is the bat and nothing else -- no fielding penalty applies
    // anywhere at DH, so the order is plain overall.
    const rest = dh.slice(1);
    for (let i = 1; i < rest.length; i++) {
      expect(overallOf(rest[i - 1]!)).toBeGreaterThanOrEqual(overallOf(rest[i]!));
    }
  });
});
