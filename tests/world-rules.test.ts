// world-rules.test.ts
// The switches a coach sets when he takes his first job.
//
// `docs/06-backlog.md` §AC.2 called these "the highest-value thing on this
// page: the only way to turn off a system a player hates without abandoning
// the career". They are deliberately NOT depth preferences — `state/depth.ts`
// names injuries and realignment in its own header as the counter-example to
// everything in that catalogue, because a rule that changes the world changes
// it for all ninety-six programs and cannot be a matter of taste.
//
// Two properties matter more than any individual switch, and both are pinned
// here: a world opened on the defaults is bit-for-bit the world the game always
// had, and a save written before the switches existed loads as a standard one.

import { describe, it, expect } from 'vitest';
import {
  createSeason, simSeason, nextSeason, seasonLength, seriesGames,
  rulesOf, configForRules, injuryScale, buildSchedule,
  DEFAULT_RULES, DEFAULT_SEASON, SEASON_SPANS,
  type SeasonRules, type SeasonState,
} from '../src/engine/season.js';
import { toPortable, fromPortable } from '../src/state/seasonCodec.js';
import { runCarousel } from '../src/engine/rivals.js';
import {
  PHASES, stepAfter, stepsFor, liveStep, useDynasty,
} from '../src/state/store.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import type { Player } from '../src/engine/types.js';

const under = (over: Partial<SeasonRules>): SeasonRules => ({ ...DEFAULT_RULES, ...over });

const world = (seed: number, rules: SeasonRules = DEFAULT_RULES): SeasonState => {
  const s = createSeason(makeRng(seed), configForRules(rules), CONFERENCES);
  s.rules = rules;
  return s;
};

/** Everybody in the league who was hurt at some point this season. */
const hurtCount = (s: SeasonState): number => {
  let n = 0;
  for (const rec of s.teams) {
    for (const p of [
      ...rec.team.lineup, ...rec.team.bench, ...rec.team.rotation, ...rec.team.bullpen,
    ]) {
      // `why` is set by `hurt` and distinguishes an injury from a suspension.
      if ((p as Player & { why?: string }).why === 'injury') n++;
    }
  }
  return n;
};

// ---------------------------------------------------------------------------
// The world that was always there
// ---------------------------------------------------------------------------

describe('a world with no rules written on it', () => {
  it('is a standard world, because every career before the switches was one', () => {
    expect(rulesOf(undefined)).toEqual(DEFAULT_RULES);
    expect(rulesOf(null)).toEqual(DEFAULT_RULES);
    expect(rulesOf({})).toEqual(DEFAULT_RULES);
    expect(rulesOf(createSeason(makeRng(7), undefined, CONFERENCES))).toEqual(DEFAULT_RULES);
  });

  it('plays the schedule it has always played', () => {
    // The default rules must not move a single fixture, or every calibration
    // number the game has ever taken would be measuring a different league.
    expect(configForRules(DEFAULT_RULES)).toBe(DEFAULT_SEASON);
    expect(seriesGames(DEFAULT_SEASON)).toBe(3);
    expect(seasonLength(DEFAULT_SEASON)).toBe(45);
    // And a config written before the field existed still means three.
    expect(seriesGames({ seriesRounds: 11, nonConferenceGames: 12, engine: 'log5' })).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Injuries
// ---------------------------------------------------------------------------

describe('the trainer', () => {
  it('scales the same roll rather than running a different model', () => {
    expect(injuryScale(under({ injuries: 'on' }))).toBe(1);
    expect(injuryScale(under({ injuries: 'off' }))).toBe(0);
    const half = injuryScale(under({ injuries: 'reduced' }));
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
  });

  it('breaks nobody in a world that turned him off', () => {
    const s = world(4242, under({ injuries: 'off' }));
    simSeason(s);
    expect(hurtCount(s)).toBe(0);
    // And the season still happened.
    expect(s.results.length).toBeGreaterThan(0);
  });

  it('is busy in a world that did not', () => {
    const s = world(4242);
    simSeason(s);
    expect(hurtCount(s)).toBeGreaterThan(0);
  });

  it('works about half as often when asked to', () => {
    const full = world(4242);
    simSeason(full);
    const half = world(4242, under({ injuries: 'reduced' }));
    simSeason(half);
    expect(hurtCount(half)).toBeGreaterThan(0);
    expect(hurtCount(half)).toBeLessThan(hurtCount(full));
  });
});

// ---------------------------------------------------------------------------
// Season length
// ---------------------------------------------------------------------------

describe('the short schedule', () => {
  it('is a two-game weekend, not a shorter league', () => {
    const short = SEASON_SPANS.short;
    expect(seriesGames(short)).toBe(2);
    expect(seasonLength(short)).toBe(34);
    // The two things that are never traded away: the full conference round
    // robin, and the crossover games RPI is computed from.
    expect(short.seriesRounds).toBe(DEFAULT_SEASON.seriesRounds);
    expect(short.nonConferenceGames).toBe(DEFAULT_SEASON.nonConferenceGames);
  });

  it('still plays everybody in the conference', () => {
    const s = world(4242, under({ length: 'short' }));
    simSeason(s);
    const me = s.teams[0]!;
    const rivals = s.teams.filter((t) => t.conference === me.conference && t.index !== me.index);
    const met = new Set(me.opponents);
    for (const r of rivals) {
      expect(met.has(r.index), `${me.def.abbr} never played ${r.def.abbr}`).toBe(true);
    }
    expect(me.gp).toBe(34);
  });

  it('gives the midweek arm the slot after the weekend, whatever the weekend is', () => {
    /*
      A two-game weekend plus a midweek is a three man rotation. Leaving the
      midweek arm pinned at slot 3 would have idled the third starter entirely
      and given the fourth every crossover game — a rotation with a hole in it
      rather than a shorter one.
    */
    // Two leagues, because crossover play pairs the conferences against each
    // other and cannot do that with an odd number of them.
    const shape = {
      conferences: [
        { id: 'EAST', teams: [0, 1, 2, 3] },
        { id: 'WEST', teams: [4, 5, 6, 7] },
      ],
    };
    for (const [config, expected] of [
      [SEASON_SPANS.standard, 3],
      [SEASON_SPANS.short, 2],
    ] as const) {
      const days = buildSchedule(config, shape, 0);
      const midweek = days.filter((d) => d.kind === 'midweek').flatMap((d) => d.games);
      expect(midweek.length).toBeGreaterThan(0);
      for (const g of midweek) expect(g.slot).toBe(expected);
      const series = days.filter((d) => d.kind === 'series').flatMap((d) => d.games);
      const slots = new Set(series.map((g) => g.slot));
      expect([...slots].sort()).toEqual(
        Array.from({ length: seriesGames(config) }, (_, i) => i),
      );
    }
  });

  it('names a two-game weekend for what it is', () => {
    const days = buildSchedule(
      SEASON_SPANS.short,
      { conferences: [{ id: 'EAST', teams: [0, 1] }, { id: 'WEST', teams: [2, 3] }] },
      0,
    );
    const labels = days.filter((d) => d.kind === 'series').map((d) => d.label);
    expect(labels.slice(0, 2)).toEqual(['Series opener', 'Series finale']);
    expect(labels).not.toContain('Game two');
  });
});

// ---------------------------------------------------------------------------
// The portal, as a step that may not exist
// ---------------------------------------------------------------------------

describe('an offseason without a portal', () => {
  it('walks from the draft straight to the class', () => {
    expect(stepAfter('draft', DEFAULT_RULES)).toBe('portal');
    expect(stepAfter('draft', under({ portal: false }))).toBe('signing');
  });

  it('keeps the canonical list, and its indices, exactly as they were', () => {
    // `furthestPhase` is an index into PHASES and it lives in save files.
    expect(PHASES).toEqual(['awards', 'review', 'coach', 'draft', 'portal', 'signing']);
    expect(stepsFor(DEFAULT_RULES)).toEqual([...PHASES]);
    expect(stepsFor(under({ portal: false }))).not.toContain('portal');
    expect(stepsFor(under({ portal: false })).length).toBe(PHASES.length - 1);
  });

  it('does not make the last step unreachable', () => {
    expect(stepAfter('signing', under({ portal: false }))).toBeNull();
    expect(liveStep('signing', under({ portal: false }))).toBe(true);
    expect(liveStep('portal', under({ portal: false }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Poaching
// ---------------------------------------------------------------------------

describe('the coaching carousel', () => {
  const withVacancies = (rules: SeasonRules) => {
    const s = world(99, rules);
    // Everybody has a coach on day one except three chairs, which is the shape
    // the carousel is handed every winter.
    for (const t of s.teams) {
      t.coach = {
        name: `Coach ${t.index}`, prestige: 30 + (t.index % 40), tenure: 1,
        careerWins: 40, careerLosses: 40, titles: 0, conferenceTitles: 0,
      } as NonNullable<typeof t.coach>;
    }
    for (const i of [3, 17, 41]) delete s.teams[i]!.coach;
    return s;
  };

  it('promotes a sitting coach when the world allows it', () => {
    const s = withVacancies(DEFAULT_RULES);
    const moves = runCarousel(s, 0, 2030, []);
    expect(moves.some((m) => m.kind === 'poached')).toBe(true);
  });

  it('leaves every staff where it is when the world does not', () => {
    const s = withVacancies(under({ poaching: false }));
    const moves = runCarousel(s, 0, 2030, []);
    expect(moves.some((m) => m.kind === 'poached')).toBe(false);
    // A chair still gets filled — an empty one recruits at nobody's skill for
    // ever, which is why the fallback exists.
    expect(moves.length).toBeGreaterThan(0);
    expect(s.teams[3]!.coach).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Realignment
// ---------------------------------------------------------------------------

describe('the map', () => {
  /*
    Seed 1 is not arbitrary: its world realigns in its very first winter, with
    the Gulf taking team 12 and team 11 sliding to the Atlantic, and neither of
    them is the coached program. Found by scanning seeds, because a rule that
    suppresses a thing that was never going to happen proves nothing.
  */
  it('moves in a world that allows it', async () => {
    useDynasty.getState().start(1, 0);
    const before = useDynasty.getState().season!.teams[12]!.conference;
    useDynasty.getState().settleSeason();
    await useDynasty.getState().rollYear();
    expect(useDynasty.getState().season!.teams[12]!.conference).not.toBe(before);
  });

  it('holds still in a world that does not', async () => {
    useDynasty.getState().start(
      1, 0, undefined, 'full', undefined, false, under({ realignment: false }),
    );
    const before = useDynasty.getState().season!.teams.map((t) => t.conference);
    useDynasty.getState().settleSeason();
    await useDynasty.getState().rollYear();
    const after = useDynasty.getState().season!.teams.map((t) => t.conference);
    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// They outlive the season
// ---------------------------------------------------------------------------

describe('the rules of a world', () => {
  const odd = under({ injuries: 'off', portal: false, length: 'short' });

  it('carry into next spring', () => {
    const s = world(4242, odd);
    const next = nextSeason(s);
    expect(rulesOf(next)).toEqual(odd);
    // And so does the schedule they imply.
    expect(seriesGames(next.config)).toBe(2);
  });

  it('survive a save and a load', () => {
    const s = world(4242, odd);
    const back = fromPortable(JSON.parse(JSON.stringify(toPortable(s), (_k, v) =>
      (v instanceof Map ? [...v.entries()] : v))) as never);
    expect(rulesOf(back)).toEqual(odd);
    expect(seriesGames(back.config)).toBe(2);
    // The schedule is rebuilt on load rather than stored, so it has to come
    // back the length the rules asked for.
    expect(back.schedule.flatMap((d) => d.games).length / back.teams.length * 2).toBe(34);
  });

  it('are stamped by the job, once', () => {
    useDynasty.getState().start(4242, 0, undefined, 'full', undefined, false, odd);
    expect(rulesOf(useDynasty.getState().season)).toEqual(odd);
    // A standard career gets the defaults without anybody passing them.
    useDynasty.getState().start(4242, 0);
    expect(rulesOf(useDynasty.getState().season)).toEqual(DEFAULT_RULES);
  });
});
