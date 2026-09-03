// identity.test.ts
// Who a player is, as against what he is called.
//
// The id used to be the name. Everything that keeps a record keys on the id —
// season statistics, the record book, awards, box scores — so two men with one
// name were one man in all of them, and the only thing keeping names apart was a
// set in players.ts that no save has ever written down. A cold reload emptied it
// and handed the whole name pool back, which is how a recruit generated in
// October could be given a graduated shortstop's career.
//
// Three things have to hold together now, and each fails quietly on its own:
//
//   - An id is unique and stable and owes nothing to the name.
//   - A load rebuilds the name pool from the players the save still holds, so
//     display names stay unique going forward even in a save written before any
//     of this existed.
//   - The record book carries the name, because it is the last thing in a save
//     that remembers a man and the screens have nothing else to print.
//
// The determinism case at the bottom is the one that would go unnoticed longest:
// a resumed save must produce the same world an uninterrupted run would, and the
// name pool is an input to that whether anybody wrote it down or not.

import { describe, it, expect } from 'vitest';
import { makeRng, rngFromState } from '../src/engine/rng.js';
import { makeHitter, makePitcher, resetNames } from '../src/engine/players.js';
import {
  archiveSeason, careerName, createSeason, simNextDay,
  type CareerYear, type SeasonState,
} from '../src/engine/season.js';
import { generateClass } from '../src/engine/recruiting.js';
import { seasonAwards } from '../src/engine/postseason.js';
import { toPortable, fromPortable } from '../src/state/seasonCodec.js';
import { playerId } from '../src/engine/types.js';
import type { Player, TeamId } from '../src/engine/types.js';

const world = (seed = 4242): SeasonState => createSeason(makeRng(seed));

const roster = (season: SeasonState): Player[] =>
  season.teams.flatMap((t) => [
    ...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen,
  ]);

/** A save written, put on a disk, and opened again. */
const trip = (season: SeasonState): SeasonState =>
  fromPortable(structuredClone(toPortable(season)));

/**
 * A class generated the way the offseason generates one, from a save's own
 * generator position. Takes the state rather than the season so the caller
 * controls whether the load happened.
 */
const classFrom = (state: number, teams = 96): Player[] =>
  generateClass(2027, teams, rngFromState(state)).prospects.map((p) => p.player);

describe('a player id', () => {
  it('is unique across a whole world, and is nobody in it', () => {
    const men = roster(world());
    expect(men.length).toBeGreaterThan(2000);

    const ids = new Set(men.map((p) => String(p.id)));
    expect(ids.size).toBe(men.length);

    // Not the name, not a slug of it, not anything a second man with the same
    // name could arrive at.
    const names = new Set(men.map((p) => p.name));
    for (const id of ids) expect(names.has(id)).toBe(false);
  });

  it('comes out the same from the same seed', () => {
    expect(roster(world(77)).map((p) => String(p.id)))
      .toEqual(roster(world(77)).map((p) => String(p.id)));
  });

  it('survives a save and a load, and the statistics still find him', () => {
    const season = world();
    for (let d = 0; d < 3; d++) simNextDay(season);

    const before = roster(season).map((p) => String(p.id));
    const loaded = trip(season);
    expect(roster(loaded).map((p) => String(p.id))).toEqual(before);

    // The point of the ids being stable is that the books keyed on them still
    // open. A roster full of matching strings that no longer index anything
    // would pass the line above and fail the game.
    const played = roster(loaded).filter((p) => (loaded.batting.get(p.id)?.g ?? 0) > 0);
    expect(played.length).toBeGreaterThan(50);
  });
});

describe('a cold reload', () => {
  /*
    The bug, reproduced. A new process has an empty name pool, so a recruiting
    class generated before anything has been loaded draws names the world is
    already using — and while the id was the name, that recruit *was* the man he
    was named after everywhere a record is kept.

    The class here is generated from the save's own generator state, which is
    what the offseason would resume from, so this is the real sequence and not a
    contrivance.
  */
  it('still hands out a name twice, and never an id', () => {
    const season = world();
    const men = roster(season);
    const names = new Set(men.map((p) => p.name));
    const ids = new Set(men.map((p) => String(p.id)));
    const state = toPortable(season).rngState;

    resetNames();
    const recruits = classFrom(state, season.teams.length);

    // The hazard is real: with nothing reserved, names come back around.
    expect(recruits.filter((p) => names.has(p.name)).length).toBeGreaterThan(0);
    // And it no longer costs anybody his career.
    expect(recruits.filter((p) => ids.has(String(p.id)))).toEqual([]);
  });
});

describe('loading a save puts the name pool back', () => {
  it('from every roster in it', () => {
    const season = world();
    const names = new Set(roster(season).map((p) => p.name));

    resetNames();
    const loaded = trip(season);
    for (const p of classFrom(toPortable(loaded).rngState, loaded.teams.length)) {
      expect(names.has(p.name), `${p.name} was already on a roster`).toBe(false);
    }
  });

  it('from the recruiting board, whose men have not signed yet', () => {
    const season = world();
    const board = new Set(season.recruiting.prospects.map((p) => p.player.name));

    resetNames();
    const loaded = trip(season);
    // A walk-on is drawn straight from the generator during the offseason, at
    // which point the board is still full of men the coach is chasing. Two
    // thousand of them, because the pool holds a quarter of a million names and
    // a handful of draws proves nothing: with the board unreserved this loop
    // takes seven of its names.
    const rng = rngFromState(toPortable(loaded).rngState);
    for (let i = 0; i < 2000; i++) {
      const p = i % 2 === 0 ? makeHitter(rng, 46) : makePitcher(rng, 46);
      expect(board.has(p.name), `${p.name} is on the board`).toBe(false);
    }
  });

  it('from the record book, in both shapes a career row is written in', () => {
    /*
      A graduated player is in no roster. The only trace of him is his career
      rows, and those come in two shapes: written before this fix, keyed by an id
      that *is* his name and carrying no name of its own; and written after,
      keyed opaquely with the name on the row. Both are names the world must not
      hand out again.

      The men are borrowed from a second world so they are unmistakably foreign
      to the save under test — nothing else in it has ever heard of them.
    */
    const season = world(1);
    const alumni = roster(world(2));

    const careers: Record<string, CareerYear[]> = {};
    alumni.forEach((p, i) => {
      const row: CareerYear = { year: 2024, classYear: 'SR', team: 'RID', ab: 180, h: 55 };
      if (i % 2 === 0) careers[p.name] = [row];              // the old shape
      else careers[String(p.id)] = [{ ...row, name: p.name }]; // and the new one
    });
    season.careers = careers as SeasonState['careers'];

    resetNames();
    const loaded = trip(season);
    const gone = new Set(alumni.map((p) => p.name));
    for (const p of classFrom(toPortable(loaded).rngState, loaded.teams.length)) {
      expect(gone.has(p.name), `${p.name} is in the record book`).toBe(false);
    }
  });

  it('and rebuilds it rather than adding to it', () => {
    /*
      Two dynasties in one session must not see each other. Adding to the pool
      would leave the second one drawing around the first one's names, which is
      a different world from the one it would have got on its own — the same
      class of divergence the empty pool caused, wearing better clothes.
    */
    const a = world(1);
    const b = world(2);
    const state = toPortable(b).rngState;

    const alone = classFrom(state, b.teams.length).map((p) => p.name);

    resetNames();
    trip(a);
    trip(b);
    const afterA = classFrom(state, b.teams.length).map((p) => p.name);

    expect(afterA).toEqual(alone);
  });
});

describe('the record book', () => {
  it('writes the name on every year it records', () => {
    const season = world();
    for (let d = 0; d < 8; d++) simNextDay(season);
    archiveSeason(season, 0, 2027);

    const rows = Object.entries(season.careers);
    expect(rows.length).toBeGreaterThan(10);

    const named = new Map(roster(season).map((p) => [String(p.id), p.name]));
    for (const [id, years] of rows) {
      for (const y of years) expect(y.name).toBe(named.get(id));
      expect(careerName(playerId(id), years)).toBe(named.get(id));
    }
  });

  it('falls back to the id for a row written before it carried one', () => {
    // Which is exactly right for those rows, because back then the id was the
    // name. This is the line standing between the hall of fame and a page of
    // men called "Former player".
    const legacy = playerId('Cole Rourke');
    const rows: CareerYear[] = [{ year: 2024, classYear: 'JR', team: 'RID', ab: 190, h: 62 }];
    expect(careerName(legacy, rows)).toBe('Cole Rourke');

    // And a career that starts old and continues new takes the name it is given.
    expect(careerName(legacy, [...rows, { ...rows[0] as CareerYear, year: 2025, name: 'Cole Rourke' }]))
      .toBe('Cole Rourke');
  });
});

describe('an old save', () => {
  it('opens with its name-shaped ids intact and still names the men behind them', () => {
    const season = world();
    const legacy = playerId('Ellis Vandermeer');
    season.careers = {
      [legacy]: [
        { year: 2024, classYear: 'JR', team: 'RID', ab: 201, h: 68, hr: 11 },
        { year: 2025, classYear: 'SR', team: 'RID', ab: 195, h: 71, hr: 14 },
      ],
    } as SeasonState['careers'];

    const loaded = trip(season);
    const rows = loaded.careers[legacy];
    expect(rows).toHaveLength(2);
    // Grandfathered, not migrated: the key it went in under is the key it comes
    // out under, so nothing that already points at it has to be found and fixed.
    expect(Object.keys(loaded.careers)).toEqual([String(legacy)]);
    expect(careerName(legacy, rows ?? [])).toBe('Ellis Vandermeer');
  });

  it('joins an award to the career it belongs to', () => {
    const season = world();
    for (let d = 0; d < 10; d++) simNextDay(season);

    const awards = seasonAwards(season);
    expect(awards.length).toBeGreaterThan(0);

    const teamOf = new Map<string, number>();
    for (const t of season.teams) {
      for (const p of [
        ...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen,
      ]) teamOf.set(String(p.id), t.index);
    }
    for (const a of awards) archiveSeason(season, teamOf.get(String(a.id)) as number, 2027);

    const loaded = trip(season);
    for (const a of awards) {
      const rows = loaded.careers[a.id];
      expect(rows, `${a.title} for ${a.name}`).toBeDefined();
      // The award carries a name of its own; the book carries one too. A screen
      // that reads either must not be able to tell them apart.
      expect(careerName(a.id, rows ?? [])).toBe(a.name);
    }
  });
});

describe('determinism', () => {
  /*
    The quiet one. A save restores the generator's position exactly, so a resumed
    dynasty is supposed to be indistinguishable from one that was never closed —
    and it was not, because the name pool is an input to the draw stream (a name
    already taken costs the rejection loop two more draws) and a cold process had
    none of it. The world after the reload was a *different* world from the one
    the same save would have grown into if nobody had shut the app.
  */
  it('grows the same world whether or not the app was closed', () => {
    const season = world(99);
    const state = toPortable(season).rngState;

    // Uninterrupted: the process has been running since the world was built, so
    // it knows every name in it.
    const straight = classFrom(state, season.teams.length);

    // Resumed: nothing in memory, a save read off the disk, and on from there.
    resetNames();
    const loaded = trip(season);
    const resumed = classFrom(toPortable(loaded).rngState, loaded.teams.length);

    expect(resumed.map((p) => p.name)).toEqual(straight.map((p) => p.name));
    expect(resumed.map((p) => String(p.id))).toEqual(straight.map((p) => String(p.id)));
  });

  it('keeps a loaded season pointing at the same teams', () => {
    // Cheap guard on the round trip itself, so a determinism failure above can
    // never be explained away as the codec having rebuilt a different world.
    const season = world(99);
    const loaded = trip(season);
    expect(loaded.teams.map((t) => t.id as TeamId))
      .toEqual(season.teams.map((t) => t.id as TeamId));
  });

  it('gives the same seed the same class only once', () => {
    // Stated as a property rather than left as a footnote, because a
    // calibration figure taken from a generated class is worthless without it.
    // Two figures in the systems reference were: the same call, written down
    // twice, disagreed — and the disagreement was read as the generator having
    // drifted rather than as the second reading having been taken in a process
    // that already knew nine hundred names.
    const names = (): string[] =>
      generateClass(2027, 8, makeRng(4242)).prospects.map((p) => p.player.name);

    resetNames();
    const first = names();
    expect(names()).not.toEqual(first);

    resetNames();
    expect(names()).toEqual(first);
  });

  /*
    A stray draw is the one change to this file nothing else in the suite can
    see. Ratings come out of distributions, so an rng() added or removed
    anywhere in player generation moves every man in the world without moving
    any average the calibration probes read — and the golden fixtures that would
    catch it are re-recorded as a matter of course whenever a block of work
    lands, which is exactly when one would be introduced.

    A count is different: it has one right answer, and re-recording it is a
    deliberate act. If these numbers move, the draw sequence moved, and whoever
    moved it has to say so.
  */
  describe('the draws a player costs', () => {
    /** The same generator, counting how many times it is turned. */
    function counted(seed: number): { rng: ReturnType<typeof makeRng>; spent: () => number } {
      const inner = makeRng(seed);
      let n = 0;
      const rng = (() => { n++; return inner(); }) as ReturnType<typeof makeRng>;
      // `nextPlayerId` reads the position without turning it, so the counter has
      // to pass the real one through rather than hide it.
      rng.state = inner.state;
      return { rng, spent: () => n };
    }

    // Two sequences rather than one number each, because the count is not
    // constant: the projectable-ceiling branch and the platoon draw both spend
    // extra numbers on some men and not others, and a pin that only ever saw
    // the common path would miss a draw added inside a branch.
    it.each([
      { what: 'a hitter', spent: [31, 31, 31, 31, 31, 34, 31, 31] },
      { what: 'a pitcher', spent: [30, 30, 30, 30, 31, 30, 30, 30] },
    ])('is fixed for $what', ({ what, spent }) => {
      const got = spent.map((_, i) => {
        // An empty pool on every seed: a name already taken costs the rejection
        // loop two more draws, which is a real cost and a different measurement.
        resetNames();
        const c = counted(i + 1);
        if (what === 'a hitter') makeHitter(c.rng, 50, { pos: 'SS' });
        else makePitcher(c.rng, 50, { role: 'SP' });
        return c.spent();
      });
      expect(got).toEqual(spent);
    });

    it('is fixed for a whole recruiting class', () => {
      // The class pipeline on top of the two above: the quality roll, the home
      // region, the state inside it and the five priority weights. Sixty
      // prospects is enough that a draw added to any one of them shows.
      resetNames();
      const c = counted(4242);
      const cls = generateClass(2027, 8, c.rng);
      expect(cls.prospects.length).toBe(60);
      // 2413 before September 1, 2463 until stage 16. The class is built AS
      // freshmen — the class year is passed in rather than stamped on
      // afterwards — and the projectable-freshman clause costs a draw that
      // only a freshman was ever asked for. The findable-gems knob then
      // gated that clause to sub-52 currents, so the polished half of the
      // class stopped spending the gate draw and the count came DOWN even
      // as the raw draw itself got a longer, occasionally rejected tail.
      // Still fixed, which is the property this test exists to hold. 2466
      // after stage 16's two-way quota: every SP slot rolls the gate.
      expect(c.spent()).toBe(2466);
    });
  });
});
