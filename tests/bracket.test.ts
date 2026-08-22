// bracket.test.ts
// A bracket you can watch, and take a game out of.
//
// `doubleElimination` ran the whole tournament inside one loop, which is right
// for a season being simulated and useless for a manager who wants to sit
// through his own regional: there was no point at which anything could be shown
// and no way to hand one game to a person. The state machine underneath it is
// the same loop, stopped between rounds.

import { describe, it, expect } from 'vitest';
import {
  doubleElimination, startBracket, stepBracket, nextGameFor, pairingsOf, pairKey,
  resultOf, conferenceField, conferenceIds, conferenceTournament, regionalGroups,
  allConferenceTournaments, stageSelection, stageRegionals,
} from '../src/engine/postseason.js';
import { createSeason, simSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';

const world = (seed: number) => {
  const s = createSeason(makeRng(seed));
  simSeason(s);
  return s;
};

describe('stepping a bracket', () => {
  it('reaches the same champion as running it in one go', () => {
    // The refactor has to be invisible. Same seeds, same season, same winner —
    // otherwise every recorded golden and every dynasty in flight shifts.
    const a = world(4242);
    const b = world(4242);
    const seeds = [0, 1, 2, 3, 4, 5, 6, 7];

    const whole = doubleElimination(a, seeds);

    const state = startBracket(b, seeds);
    let rounds = 0;
    while (!state.done && rounds < 40) { stepBracket(state); rounds += 1; }

    expect(state.done).toBe(true);
    expect(state.champion).toBe(whole.champion);
    expect(state.games.length).toBe(whole.games.length);
  });

  it('finishes, and eliminates everybody but one', () => {
    const state = startBracket(world(7), [0, 1, 2, 3, 4, 5, 6, 7]);
    let rounds = 0;
    while (!state.done && rounds < 40) { stepBracket(state); rounds += 1; }
    expect(state.champion).not.toBeNull();
    expect(state.eliminated).toHaveLength(7);
    expect(state.eliminated).not.toContain(state.champion);
  });

  it('says what a team plays next, before it is played', () => {
    const state = startBracket(world(11), [0, 1, 2, 3, 4, 5, 6, 7]);
    const game = nextGameFor(state, 0);
    expect(game).not.toBeNull();
    expect([game?.a, game?.b]).toContain(0);

    // And that pairing is the one that actually happens.
    const before = state.games.length;
    stepBracket(state);
    const played = state.games.slice(before);
    const mine = played.find((g) => g.home === 0 || g.away === 0);
    expect(mine).toBeDefined();
    expect([mine?.home, mine?.away].sort()).toEqual([game?.a, game?.b].sort());
  });

  it('reports nothing for a team that is out', () => {
    const state = startBracket(world(11), [0, 1, 2, 3, 4, 5, 6, 7]);
    while (!state.done) stepBracket(state);
    expect(nextGameFor(state, 0)).toBeNull();
  });
});

describe('pairings', () => {
  it('puts the best against the worst', () => {
    const { bye, pairs } = pairingsOf([0, 1, 2, 3]);
    expect(bye).toBeNull();
    expect(pairs).toEqual([[0, 3], [1, 2]]);
  });

  it('byes the top seed on an odd field', () => {
    const { bye, pairs } = pairingsOf([0, 1, 2]);
    expect(bye).toBe(0);
    expect(pairs).toEqual([[1, 2]]);
  });
});

describe('a game played by hand', () => {
  it('is used instead of simulating, and counts the same', async () => {
    const { simGame } = await import('../src/engine/game.js');
    const season = world(31337);
    const seeds = [0, 1, 2, 3, 4, 5, 6, 7];
    const state = startBracket(season, seeds);

    const game = nextGameFor(state, 0);
    expect(game).not.toBeNull();

    // Play it "by hand" and force a result the simulation would rarely produce.
    const a = season.teams[game!.a]!.team;
    const b = season.teams[game!.b]!.team;
    const result = simGame(a, b, season.rng, { engine: 'log5' });

    const preplayed = new Map([[pairKey(game!.a, game!.b), result]]);
    const before = state.games.length;
    stepBracket(state, preplayed);

    const played = state.games.slice(before);
    const mine = played.find((g) => g.home === game!.a || g.away === game!.a);
    expect(mine, 'the hand played game was not recorded').toBeDefined();
    // The score is the one that was handed in, not a fresh simulation.
    const handedHomeRuns = mine!.home === game!.a
      ? result.home.runs : result.away.runs;
    expect(mine!.homeRuns === handedHomeRuns || mine!.awayRuns === handedHomeRuns).toBe(true);
  });
});

describe('splitting a tournament so the manager can play his own games', () => {
  it('seeds a conference the same way whether or not the app does it', () => {
    // The app needs the field before the games so it can tell whether you are
    // in it. If `conferenceField` seeded differently from `conferenceTournament`
    // you would be handed somebody else's bracket.
    const a = world(77);
    const b = world(77);
    const conf = a.teams[0]!.conference;

    const cup = conferenceTournament(a, conf);
    const { field, missed } = conferenceField(b, conf);

    expect(field).toEqual(cup.seeds);
    expect(missed).toEqual(cup.missed);
    expect(field.length + missed.length).toBe(
      b.teams.filter((t) => t.conference === conf).length,
    );
  });

  it('names every conference once', () => {
    const s = world(78);
    const ids = conferenceIds(s);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of s.teams) expect(ids).toContain(t.conference);
  });

  it('groups the regionals the same way the stage does', () => {
    // The store plays three regionals and lives through the fourth. It finds
    // its own by index, and puts its result back at that index, because Omaha
    // seeds off regional order.
    const a = world(79);
    const b = world(79);
    const champs = allConferenceTournaments(a).map((c) => c.champion);
    const champsB = allConferenceTournaments(b).map((c) => c.champion);
    expect(champsB).toEqual(champs);

    const field = stageSelection(a, champs);
    const played = stageRegionals(a, field);
    const groups = regionalGroups(stageSelection(b, champsB));

    expect(groups.length).toBe(played.length);
    for (let i = 0; i < groups.length; i++) {
      expect(groups[i]).toEqual(played[i]!.seeds);
    }
  });

  it('gives back the same result whether played live or in one go', () => {
    const a = world(80);
    const b = world(80);
    const seeds = [3, 1, 4, 1 + 5, 9, 2];

    const whole = doubleElimination(a, seeds);
    const state = startBracket(b, seeds);
    while (!state.done) stepBracket(state);
    const live = resultOf(state);

    expect(live.champion).toBe(whole.champion);
    expect(live.seeds).toEqual(whole.seeds);
    expect(live.eliminated).toEqual(whole.eliminated);
    expect(live.games.map((g) => g.round)).toEqual(whole.games.map((g) => g.round));
  });

  it('refuses to hand back a bracket that is still being played', () => {
    const state = startBracket(world(81), [0, 1, 2, 3]);
    expect(() => resultOf(state)).toThrow(/not finished/);
  });
});

describe('the winner take all game', () => {
  it('is offered as its own game, not played behind the championship', () => {
    // A challenger who beats the unbeaten finalist forces one more game. It used
    // to be played inside the same call as the first, so a manager could take
    // the title game and then be told what happened in the decider.
    const s = world(91);
    const sets = [
      [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
      [0, 2, 4, 6], [1, 3, 5, 7], [2, 4, 8, 16], [3, 6, 9, 12],
      [0, 1, 2, 3, 4, 5], [6, 7, 8, 9, 10, 11],
    ];

    let deciders = 0;
    for (const seeds of sets) {
      const st = startBracket(s, seeds);
      let guard = 0;
      while (!st.done && guard++ < 40) {
        stepBracket(st);
        if (st.decider && !st.done) {
          deciders += 1;
          // Both finalists are still live, and both are shown the same game.
          const a = nextGameFor(st, st.unbeaten[0] as number);
          const b = nextGameFor(st, st.oneLoss[0] as number);
          expect(a).not.toBeNull();
          expect(b).not.toBeNull();
          expect(a?.round).toBe('Winner take all');
          expect(pairKey(a!.a, a!.b)).toBe(pairKey(b!.a, b!.b));
        }
      }
      expect(st.done).toBe(true);
      expect(st.champion).not.toBeNull();
    }

    // If no bracket in ten ever went to a decider the test proves nothing.
    expect(deciders).toBeGreaterThan(0);
  });
});
