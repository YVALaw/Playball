// bracket.test.ts
// A bracket you can draw before it starts, and take a game out of.
//
// The format changed for one reason: double elimination has no full bracket to
// draw. Its losers' bracket pairings do not exist until somebody loses, so the
// picture could only ever show the next round — reported from testing three
// separate times. A knockout tree of series is determined by its seeding, so
// every slot exists from the first press.
//
// These tests pin the two properties that makes true: the tree is complete and
// correctly seeded before a ball is thrown, and a series ends exactly when
// somebody clinches it.

import { describe, it, expect } from 'vitest';
import {
  singleElimination, startSeriesBracket, stepBracket, nextGameFor, liveSeries,
  resultOf, pairKey, seedOrder, roundName, clincher, hostOfGame,
  conferenceField, conferenceIds, allConferenceTournaments,
  stageRegionals, stageNational, regionalPairing, freezeRegularSeason,
  REGIONAL_LENGTHS, REGIONS, regionOf,
  CONF_FIELD, CONF_ADVANCE, SERIES, NATIONAL_BIDS, PROTECTED_BIDS,
  protectedTopFour, selectNationalField, openingPairs, splitShowdown,
} from '../src/engine/postseason.js';
import {
  startDoubleElim, stepDoubleElim, runDoubleElim, resultOfDE, placings,
  liveSlotFor, readySlots,
} from '../src/engine/doubleElim.js';
import { createSeason, simSeason, currentDay, restedFirst } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { simGame } from '../src/engine/game.js';

const world = (seed: number) => {
  const s = createSeason(makeRng(seed));
  simSeason(s);
  return s;
};

/** A generic eight-team knockout, for the tests about the tree machinery. */
const KNOCKOUT8 = [3, 3, 3];

describe('seeding a knockout tree', () => {
  it('puts one against the worst, and keeps one and two apart until the final', () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);

    // The property that matters, at every size: the top two seeds are in
    // opposite halves, so they can only meet in the last series.
    for (const n of [4, 8, 16]) {
      const order = seedOrder(n);
      expect(order.indexOf(1) < n / 2).toBe(true);
      expect(order.indexOf(2) >= n / 2).toBe(true);
    }
  });
});

describe('a bracket before it starts', () => {
  it('has every slot in it, with nobody in the ones nobody has reached', () => {
    // This is the whole point of the change. A sixteen team tree is fifteen
    // series the moment it is built — eight of them named, seven of them TBD.
    const s = world(11);
    const seeds = Array.from({ length: 16 }, (_, i) => i);
    const b = startSeriesBracket(s, seeds, [5, 5, 7, 7]);

    expect(b.rounds).toHaveLength(4);
    expect(b.rounds.map((r) => r.length)).toEqual([8, 4, 2, 1]);
    expect(b.rounds.flat()).toHaveLength(15);

    // Round one is entirely known; nothing above it is.
    for (const x of b.rounds[0] as { a: number | null; b: number | null }[]) {
      expect(x.a).not.toBeNull();
      expect(x.b).not.toBeNull();
    }
    for (const round of b.rounds.slice(1)) {
      for (const x of round) {
        expect(x.a).toBeNull();
        expect(x.b).toBeNull();
      }
    }
  });

  it('names its rounds the way a bracket is talked about', () => {
    expect(roundName(4, 0)).toBe('Round of 16');
    expect(roundName(4, 3)).toBe('Final');
    expect(roundName(2, 0)).toBe('Semifinal');
    expect(roundName(2, 1)).toBe('Final');
  });
});

describe('a series', () => {
  it('ends the moment somebody clinches, and never runs longer', () => {
    for (const [len, need] of [[3, 2], [5, 3], [7, 4]] as [number, number][]) {
      const s = world(202);
      const b = startSeriesBracket(s, [0, 1, 2, 3], [len, len]);
      let guard = 0;
      while (!b.done && guard++ < 100) stepBracket(b);

      for (const round of b.rounds) {
        for (const x of round) {
          if (x.games.length === 0) continue;
          const wins = x.games.filter((g) => g.winner === x.winner).length;
          expect(wins).toBe(need);
          expect(x.games.length).toBeGreaterThanOrEqual(need);
          expect(x.games.length).toBeLessThanOrEqual(len);
          // And the loser never reached the clincher.
          const other = x.winner === x.a ? x.b : x.a;
          expect(x.games.filter((g) => g.winner === other).length).toBeLessThan(need);
        }
      }
    }
  });

  it('alternates home from the better seed', () => {
    const s = world(303);
    const b = startSeriesBracket(s, [0, 1, 2, 3], [7, 7]);
    const first = b.rounds[0]?.[0];
    expect(first).toBeDefined();
    const better = (first as { aSeed: number; a: number; b: number }).aSeed === 1
      ? (first as { a: number }).a : (first as { b: number }).b;
    // Games 1, 3, 5, 7 at the better seed: four of seven, not seven of seven.
    expect(hostOfGame(first as never, 0)).toBe(better);
    expect(hostOfGame(first as never, 1)).not.toBe(better);
    expect(hostOfGame(first as never, 2)).toBe(better);
  });

  it('says what it takes to win one', () => {
    expect(clincher(3)).toBe(2);
    expect(clincher(5)).toBe(3);
    expect(clincher(7)).toBe(4);
  });
});

describe('June has a calendar', () => {
  // The postseason used to run on `dayIndex` — an array position, forty five,
  // while the last regular season game had been played on day seventy eight.
  // Everything that asks how long ago a pitcher threw got the answer backwards.
  it('starts after the last regular season game and moves a day per round', () => {
    const s = world(717);
    const last = s.schedule[s.schedule.length - 1]?.day ?? 0;
    expect(currentDay(s)).toBeGreaterThan(last);

    const opened = currentDay(s);
    const b = startSeriesBracket(s, [0, 1, 2, 3], [3, 3]);
    stepBracket(b);
    expect(currentDay(s)).toBe(opened + 1);
    stepBracket(b);
    expect(currentDay(s)).toBe(opened + 2);
  });

  it('leaves an arm that just worked at the back of the pen, not the front', () => {
    // The bug this pins: a bracket appearance was stamped with a day *earlier*
    // than every regular season game, so the reliever who had just thrown read
    // as the freshest man on the staff and came out again in the next game —
    // the same two or three arms carrying a team through the whole of June.
    const s = world(818);
    freezeRegularSeason(s);
    const before = new Map(s.lastPitched);
    const { field } = conferenceField(s, s.teams[0]?.conference ?? 'GULF');
    const b = startSeriesBracket(s, field, KNOCKOUT8);
    stepBracket(b);

    let checked = 0;
    for (const team of field.map((i) => s.teams[i])) {
      if (!team) continue;
      const order = restedFirst(s, team);
      // Whoever's last outing moved tonight is who worked the bracket game.
      const worked = new Set(order
        .filter((p) => s.lastPitched.get(p.id) !== before.get(p.id))
        .map((p) => p.id));
      if (worked.size === 0 || worked.size === order.length) continue;

      checked += 1;
      const firstWorked = order.findIndex((p) => worked.has(p.id));
      // Everybody who threw last night sits behind everybody who did not.
      expect(firstWorked).toBe(order.length - worked.size);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('gives every postseason game its own box score instead of one shared key', () => {
    const s = world(919);
    s.captureBoxFor = 0;
    freezeRegularSeason(s);
    const before = Object.keys(s.boxScores).length;
    const { field } = conferenceField(s, s.teams[0]?.conference ?? 'GULF');
    const b = startSeriesBracket(s, field, KNOCKOUT8);
    let guard = 0;
    while (!b.done && guard++ < 100) stepBracket(b);

    const mine = b.rounds.flat()
      .flatMap((x) => x.games)
      .filter((g) => g.home === 0 || g.away === 0);
    expect(mine.length).toBeGreaterThan(1);
    // One key each. They all collided on `dayIndex` before, so a run to the
    // final left exactly one box score behind.
    expect(Object.keys(s.boxScores).length - before).toBe(mine.length);
    expect(new Set(mine.map((g) => g.day)).size).toBe(mine.length);
  });
});

describe('rotations in a bracket', () => {
  it('runs each side down its own rotation, not the host\'s', () => {
    // A team arriving off a bye and a team that has just played three games in
    // three days are not both on their Friday arm. The bracket used to take one
    // count — the host's — and hand it to both dugouts, so every game of every
    // series was ace against ace and third starter against third starter.
    //
    // Played through several conferences because the property needs a semifinal
    // where the two sides are genuinely at different points in their week.
    let checked = 0;
    for (const seed of [1021, 1022, 1023, 1024]) {
      const s = world(seed);
      freezeRegularSeason(s);

      for (const conf of conferenceIds(s)) {
        const { field } = conferenceField(s, conf);
        s.captureBoxFor = field[0] as number;   // the top seed, who has a bye
        const b = startSeriesBracket(s, field, KNOCKOUT8);
        let guard = 0;
        while (b.roundIndex === 0 && guard++ < 20) stepBracket(b);
        stepBracket(b);                          // one semifinal game

        const semi = (b.rounds[1] as { a: number | null; b: number | null; games: { day: number; home: number; away: number }[] }[])
          .find((x) => x.games.length > 0 && (x.a === s.captureBoxFor || x.b === s.captureBoxFor));
        const game = semi?.games[0];
        const box = game ? s.boxScores[game.day] : undefined;
        if (!box) continue;

        const slotOf = (team: number, name: string): number =>
          s.teams[team]?.team.rotation.findIndex((p) => p.name === name) ?? -1;
        const homeStarter = slotOf(box.home, box.homePitching[0]?.name ?? '');
        const awayStarter = slotOf(box.away, box.awayPitching[0]?.name ?? '');
        if (homeStarter < 0 || awayStarter < 0) continue;

        // Each side threw the arm its own tournament so far had come round to.
        // `appearances` counts this game, so a turn back is one fewer.
        const turn = (t: number): number =>
          (((b.appearances.get(t) ?? 1) - 1) % 3 + 3) % 3;
        expect(homeStarter).toBe(turn(box.home));
        expect(awayStarter).toBe(turn(box.away));
        // And at least once the two dugouts must be at different points in
        // their week, which is the thing a single shared count made impossible.
        if (homeStarter !== awayStarter) checked += 1;
      }
      if (checked >= 2) break;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('stepping a bracket', () => {
  it('reaches the same champion as running it in one go', () => {
    const a = world(4242);
    const b = world(4242);
    const seeds = [0, 1, 2, 3];

    const whole = singleElimination(a, seeds, [3, 3]);

    const state = startSeriesBracket(b, seeds, [3, 3]);
    let guard = 0;
    while (!state.done && guard++ < 100) stepBracket(state);

    expect(state.done).toBe(true);
    expect(state.champion).toBe(whole.champion);
    expect(resultOf(state).games.length).toBe(whole.games.length);
  });

  it('says what a team plays next, before it is played', () => {
    const s = world(55);
    const seeds = [0, 1, 2, 3];
    const state = startSeriesBracket(s, seeds, [3, 3]);

    const next = nextGameFor(state, seeds[0] as number);
    expect(next).not.toBeNull();
    expect([next!.a, next!.b]).toContain(seeds[0]);
    expect(next!.round).toBe('Semifinal');

    // And the series it belongs to is the one that team is in.
    expect(liveSeries(state, seeds[0] as number)).toBe(next!.series);
  });

  it('reports nothing for a team that is out', () => {
    const s = world(56);
    const seeds = [0, 1, 2, 3];
    const state = startSeriesBracket(s, seeds, [3, 3]);
    let guard = 0;
    while (!state.done && guard++ < 100) stepBracket(state);

    for (const t of state.eliminated) expect(nextGameFor(state, t)).toBeNull();
    expect(nextGameFor(state, state.champion as number)).toBeNull();
  });
});

describe('a game played by hand', () => {
  it('is used instead of simulating, and counts the same', () => {
    // The manager plays his own games. The bracket cannot run one — that takes
    // a screen and a person — so the app hands the finished result back and it
    // is recorded exactly as a simulated one would have been.
    const s = world(77);
    const seeds = [0, 1, 2, 3];
    const state = startSeriesBracket(s, seeds, [3, 3]);

    const next = nextGameFor(state, seeds[0] as number);
    expect(next).not.toBeNull();

    // A real result, produced the way the live game produces one.
    const host = hostOfGame(next!.series, 0);
    const guest = host === next!.a ? next!.b : next!.a;
    const byHand = simGame(
      s.teams[host]!.team, s.teams[guest]!.team, makeRng(4242), {},
    );

    const preplayed = new Map([[pairKey(next!.a, next!.b), byHand]]);
    stepBracket(state, preplayed);

    const played = state.rounds.flat().flatMap((x) => x.games)
      .find((g) => g.home === host && g.away === guest);
    expect(played).toBeDefined();
    expect(played!.homeRuns).toBe(byHand.home.runs);
    expect(played!.awayRuns).toBe(byHand.away.runs);
    // Consumed, so a later round cannot replay it.
    expect(preplayed.size).toBe(0);
  });
});

describe('the end of your run', () => {
  // Being knocked out is the one thing June has to say out loud, and it was the
  // one thing it could not: the screen read elimination off the live bracket,
  // and losing a deciding game folds that bracket into the stage results in the
  // same commit. There was no render in which the player was out and his
  // bracket still existed, so the modal never fired at all — worse, the losing
  // side of a tier still got the button that reads ON TO THE REGIONALS.
  //
  // So the store records it. These pin the fact rather than the drawing: what
  // the screen reads has to be true after the bracket is gone.

  /**
   * A finished game this series' `loser` loses, to hand back as a played one.
   *
   * Handed in the way a managed game is, because the point is the state left
   * behind and not which side the simulation happened to favour: a test of
   * elimination that only runs when the dice agree is a test of the dice.
   */
  const defeatFor = (
    s: ReturnType<typeof world>,
    series: { a: number | null; b: number | null; aSeed: number; bSeed: number },
    loser: number,
  ) => {
    const host = hostOfGame(series as never, 0);
    const guest = host === series.a ? (series.b as number) : (series.a as number);
    for (let seed = 1; seed < 60; seed++) {
      const g = simGame(s.teams[host]!.team, s.teams[guest]!.team, makeRng(seed * 977), {});
      const won = g.home.runs > g.away.runs ? host : guest;
      if (won !== loser) return g;
    }
    throw new Error('sixty games and the loser never lost one');
  };

  it('remembers a loss in the last round, after the bracket is gone', async () => {
    const { useDynasty } = await import('../src/state/store.js');
    const s = world(2101);
    freezeRegularSeason(s);

    // Two teams, one series: whatever happens here happens in a final.
    const me = 0;
    const foe = s.teams.find(
      (t) => t.index !== me && t.conference !== s.teams[me]!.conference,
    )!.index;
    const state = startSeriesBracket(s, [me, foe], [1]);
    const final = state.rounds[0]![0]!;

    useDynasty.setState({
      season: s, userTeam: me, year: 2099,
      bracket: { stage: 'regional', cups: [], regionals: [], national: null },
      myBracket: {
        kind: 'regional', format: 'series', state,
        preplayed: new Map([[pairKey(me, foe), defeatFor(s, final, me)]]),
      },
      knockout: null, postseasonSeen: [],
    });

    useDynasty.getState().simBracket('rest');
    const after = useDynasty.getState();

    // The bracket is gone, exactly as it is on screen.
    expect(after.myBracket).toBeNull();
    expect(after.knockout).not.toBeNull();
    expect(after.knockout!.year).toBe(2099);
    expect(after.knockout!.kind).toBe('regional');
    expect(after.knockout!.label).toBe('final');

    // And the result the screen reads its verdict from says the same thing, so
    // nothing downstream can congratulate him for it.
    expect(after.bracket!.regionals[0]!.champion).toBe(foe);
  });

  it('remembers a loss that does not end the tournament, and keeps it through the rest', async () => {
    const { useDynasty } = await import('../src/state/store.js');
    const s = world(2102);
    freezeRegularSeason(s);

    // Four teams: the top seed's semifinal, lost, leaves a tournament still
    // being played. Nothing folds the bracket away here, and the elimination
    // still has to be recorded — the screen's own copy of it is a round old by
    // the time anything renders.
    // The user's conference tournament is a double elimination now, so the
    // mid-tournament loss is a first loss that drops him to the losers
    // bracket, and the run ends only on the second.
    const me = 0;
    const { field } = conferenceField(s, s.teams[me]!.conference);
    const seeds = field.includes(me) ? field : [me, ...field.slice(0, 7)];
    const state = startDoubleElim(s, seeds.slice(0, 8));
    const mine = state.winners[0]!.find((x) => x.a === me || x.b === me)!;
    const foe = (mine.a === me ? mine.b : mine.a) as number;

    useDynasty.setState({
      season: s, userTeam: me, year: 2099,
      bracket: { stage: 'conference', cups: [], regionals: [], national: null },
      myBracket: {
        kind: 'conference', format: 'double', state,
        preplayed: new Map([[pairKey(me, foe), defeatFor(s, mine, me)]]),
      },
      knockout: null, postseasonSeen: [],
    });

    // One loss is not a knockout in a double elimination.
    useDynasty.getState().simBracket('round');
    const mid1 = useDynasty.getState();
    expect(mid1.myBracket).not.toBeNull();
    expect((mid1.myBracket!.state as { losses: Map<number, number> })
      .losses.get(me)).toBe(1);

    // Play it out. Whether the run ends in the losers bracket or with the
    // trophy, the fact the store keeps has to match the structure's.
    useDynasty.getState().simBracket('rest');
    const end = useDynasty.getState();
    expect(end.myBracket).toBeNull();
    const cup = end.bracket!.cups[0]!;
    if (cup.champion === me) {
      expect(end.knockout).toBeNull();
    } else {
      expect(end.knockout).not.toBeNull();
      expect(end.knockout!.kind).toBe('conference');
      expect(end.knockout!.label.length).toBeGreaterThan(0);
    }
    // The finished cup carries its top four, read off the bracket.
    expect(cup.placings).toHaveLength(4);
    expect(cup.placings![0]).toBe(cup.champion);
  });

  it('knows a tournament ending from a season ending', async () => {
    /*
      A13. Reported from testing: *"we won the first and lost the second and
      got knocked out."* True of that tournament and false of his season —
      the top four of a conference tournament go to a regional. The store has
      to know the difference at the moment it records the elimination,
      because that is the only moment the structure still says where the team
      fell.
    */
    const { useDynasty } = await import('../src/state/store.js');
    const s = world(2103);
    freezeRegularSeason(s);

    const me = 0;
    const { field } = conferenceField(s, s.teams[me]!.conference);
    const seeds = field.includes(me) ? field : [me, ...field.filter((t) => t !== me)];
    const state = startDoubleElim(s, seeds.slice(0, 8));

    useDynasty.setState({
      season: s, userTeam: me, year: 2099,
      bracket: { stage: 'conference', cups: [], regionals: [], national: null },
      myBracket: { kind: 'conference', format: 'double', state, preplayed: new Map() },
      knockout: null, postseasonSeen: [], sideShow: null,
    });
    useDynasty.getState().simBracket('rest');

    const k = useDynasty.getState().knockout;
    const cup = useDynasty.getState().bracket!.cups[0]!;
    const placings = cup.placings ?? [];

    if (cup.champion === me) {
      expect(k).toBeNull();                       // nothing ended
      return;
    }
    expect(k).not.toBeNull();
    // The one property that matters: the card's verdict agrees with the
    // bracket's own finish order, whichever way this particular June went.
    expect(k!.advanced).toBe(placings.includes(me));
    if (k!.advanced) {
      expect(k!.placing).toBeGreaterThanOrEqual(2);
      expect(k!.placing).toBeLessThanOrEqual(CONF_ADVANCE);
      expect(placings.indexOf(me) + 1).toBe(k!.placing);
    }
  });

  it('keeps a protected team alive when its regional goes wrong', async () => {
    // The other half of A13: the top four of the final regular-season table
    // reach the national field whatever a regional does to them.
    const { useDynasty } = await import('../src/state/store.js');
    const s = world(2104);
    freezeRegularSeason(s);

    const me = protectedTopFour(s)[0]!;
    const foe = s.teams.find(
      (t) => t.index !== me && t.conference !== s.teams[me]!.conference,
    )!.index;
    const state = startSeriesBracket(s, [me, foe], REGIONAL_LENGTHS);

    useDynasty.setState({
      season: s, userTeam: me, year: 2099,
      bracket: { stage: 'regional', cups: [], regionals: [], national: null },
      myBracket: {
        kind: 'regional', format: 'series', state,
        meta: { region: 'SOUTH', name: 'South', aLabel: '', bLabel: '' },
        preplayed: new Map(),
      },
      knockout: null, postseasonSeen: [], sideShow: null,
    });
    useDynasty.getState().simBracket('rest');

    const k = useDynasty.getState().knockout;
    const won = useDynasty.getState().bracket!.regionals[0]!.champion === me;
    if (won) { expect(k).toBeNull(); return; }
    expect(k!.kind).toBe('regional');
    expect(k!.advanced).toBe(true);      // protection outlives the series
  });
});

describe('the conference tournament', () => {
  it('takes eight of twelve, so finishing ninth costs you something', () => {
    const s = world(78);
    const conf = s.teams[0]!.conference;
    const { field, missed } = conferenceField(s, conf);
    expect(field).toHaveLength(CONF_FIELD);
    expect(missed.length).toBeGreaterThan(0);
    expect(field.length + missed.length).toBe(
      s.teams.filter((t) => t.conference === conf).length,
    );
  });

  it('names every conference once', () => {
    const s = world(79);
    const ids = conferenceIds(s);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of s.teams) expect(ids).toContain(t.conference);
  });
});

describe('double elimination', () => {
  it('sends nobody home on one loss, everybody on two', () => {
    const s = world(4801);
    freezeRegularSeason(s);
    const seeds = Array.from({ length: 8 }, (_, i) => i);
    const de = runDoubleElim(s, seeds);

    expect(de.done).toBe(true);
    expect(seeds).toContain(de.champion);
    // Seven go out, each with exactly two losses.
    expect(de.eliminated).toHaveLength(7);
    expect(new Set(de.eliminated).size).toBe(7);
    for (const t of de.eliminated) expect(de.losses.get(t)).toBe(2);
    expect(de.losses.get(de.champion!)).toBeLessThanOrEqual(1);
  });

  it('plays fourteen games, fifteen with the reset', () => {
    for (const seed of [4802, 4803, 4804, 4805]) {
      const s = world(seed);
      freezeRegularSeason(s);
      const de = runDoubleElim(s, Array.from({ length: 8 }, (_, i) => i));
      const games = resultOfDE(de).games.length;
      const reset = de.final[1]!.game !== null;
      expect(games).toBe(reset ? 15 : 14);
      // The reset only exists when the losers survivor took the first final.
      if (reset) {
        expect(de.final[0]!.winner).toBe(de.final[0]!.b);
      }
    }
  });

  it('settles a full finish order off the structure', () => {
    const s = world(4806);
    freezeRegularSeason(s);
    const seeds = Array.from({ length: 8 }, (_, i) => i);
    const de = runDoubleElim(s, seeds);
    const top4 = placings(de);
    expect(top4).toHaveLength(4);
    expect(new Set(top4).size).toBe(4);
    expect(top4[0]).toBe(de.champion);
    for (const t of top4) expect(seeds).toContain(t);
    // Third and fourth were eliminated; first was not.
    expect(de.eliminated).toContain(top4[2]);
    expect(de.eliminated).toContain(top4[3]);
    expect(de.eliminated).not.toContain(top4[0]);
  });

  it('steps to the same tournament as running it in one go', () => {
    const a = world(4807);
    const b = world(4807);
    freezeRegularSeason(a);
    freezeRegularSeason(b);
    const seeds = Array.from({ length: 8 }, (_, i) => i);

    const whole = runDoubleElim(a, seeds);
    const stepped = startDoubleElim(b, seeds);
    let guard = 0;
    while (!stepped.done && guard++ < 40) stepDoubleElim(stepped);

    expect(stepped.champion).toBe(whole.champion);
    expect(resultOfDE(stepped).games.length).toBe(resultOfDE(whole).games.length);
    expect(stepped.eliminated).toEqual(whole.eliminated);
  });

  it('takes a game played by hand and counts it the same', () => {
    const s = world(4808);
    freezeRegularSeason(s);
    const seeds = Array.from({ length: 8 }, (_, i) => i);
    const de = startDoubleElim(s, seeds);
    const slot = liveSlotFor(de, seeds[0]!)!;
    const host = slot.aSeed <= slot.bSeed ? slot.a! : slot.b!;
    const guest = host === slot.a ? slot.b! : slot.a!;
    const byHand = simGame(s.teams[host]!.team, s.teams[guest]!.team, makeRng(9), {});
    const preplayed = new Map([[pairKey(slot.a!, slot.b!), byHand]]);
    stepDoubleElim(de, preplayed);
    expect(slot.game!.homeRuns).toBe(byHand.home.runs);
    expect(preplayed.size).toBe(0);
  });

  it('always has something playable until it is done', () => {
    const s = world(4809);
    freezeRegularSeason(s);
    const de = startDoubleElim(s, Array.from({ length: 8 }, (_, i) => i));
    let guard = 0;
    while (!de.done && guard++ < 40) {
      expect(readySlots(de).length).toBeGreaterThan(0);
      stepDoubleElim(de);
    }
    expect(de.done).toBe(true);
    expect(readySlots(de)).toHaveLength(0);
  });
});

describe('the pyramid', () => {
  it('advances the top four finishers of every conference', () => {
    const s = world(808);
    freezeRegularSeason(s);
    const cups = allConferenceTournaments(s);
    const regionals = stageRegionals(s, cups);

    const conferenceChampions = new Set(cups.map((c) => c.champion));
    expect(conferenceChampions.size).toBe(conferenceIds(s).length);

    // Every cup settled a top four off the bracket.
    for (const c of cups) {
      expect(c.placings).toHaveLength(CONF_ADVANCE);
      expect(c.placings![0]).toBe(c.champion);
      expect(new Set(c.placings).size).toBe(CONF_ADVANCE);
    }

    // Sixteen regional series; every team in one finished top four.
    expect(regionals).toHaveLength(16);
    const advancers = new Set(cups.flatMap((c) => c.placings ?? []));
    for (const r of regionals) {
      for (const t of r.seeds) expect(advancers.has(t)).toBe(true);
    }
    // Sixteen distinct regional champions, each a banner.
    const regionChampions = regionals.map((r) => r.champion);
    expect(new Set(regionChampions).size).toBe(16);
  });

  it('pairs each region across its two conferences, champions apart', () => {
    const s = world(811);
    freezeRegularSeason(s);
    const cups = allConferenceTournaments(s);
    const pairings = regionalPairing(s, cups);

    expect(pairings).toHaveLength(REGIONS.length * 4);
    const championOf = new Map(cups.map((c) => [c.conference, c.champion]));
    for (const p of pairings) {
      const region = REGIONS.find((x) => x.id === p.id)!;
      const confs = [p.a, p.b].map((t) => s.teams[t]!.conference);
      // Cross-conference, both from this region.
      expect(new Set(confs).size).toBe(2);
      for (const c of confs) expect(region.conferences).toContain(c);
      for (const c of confs) expect(regionOf(c)).toBe(p.id);
      // The two conference champions never meet for a regional banner.
      const champs = [...championOf.values()];
      expect(champs.includes(p.a) && champs.includes(p.b)).toBe(false);
    }
  });

  it('seeds each regional series by regular season record', () => {
    const s = world(812);
    freezeRegularSeason(s);
    const cups = allConferenceTournaments(s);
    for (const r of stageRegionals(s, cups)) {
      const [a, b] = r.seeds as [number, number];
      const ra = s.teams[a]!;
      const rb = s.teams[b]!;
      expect(ra.rw ?? ra.w).toBeGreaterThanOrEqual(rb.rw ?? rb.w);
    }
  });
});

describe('the national field', () => {
  const build = (seed: number) => {
    const s = world(seed);
    freezeRegularSeason(s);
    const cups = allConferenceTournaments(s);
    const regionals = stageRegionals(s, cups);
    return { s, cups, regionals };
  };

  it('seats twenty unique teams: sixteen banners plus protection and at-large', () => {
    const { s, cups, regionals } = build(901);
    const field = selectNationalField(s, cups, regionals);

    expect(field.seeds).toHaveLength(NATIONAL_BIDS);
    expect(new Set(field.seeds).size).toBe(NATIONAL_BIDS);
    // Every regional champion is in; every protected team is in; nobody twice.
    for (const t of field.regionalChampions) expect(field.seeds).toContain(t);
    for (const t of field.protectedTeams) expect(field.seeds).toContain(t);
    expect(field.protectedTeams).toHaveLength(PROTECTED_BIDS);
    expect(field.protectedTeams).toEqual(protectedTopFour(s));
    // A protected team that won its regional does not eat an at-large slot.
    const champions = new Set(field.regionalChampions);
    for (const t of field.atLarge) expect(champions.has(t)).toBe(false);
  });

  it('never sends a protected team through the opening round', () => {
    for (const seed of [902, 903, 904]) {
      const { s, cups, regionals } = build(seed);
      const field = selectNationalField(s, cups, regionals);
      const pairs = openingPairs(field);
      expect(pairs).toHaveLength(4);
      for (const p of pairs) {
        expect(field.protectedTeams).not.toContain(p.a);
        expect(field.protectedTeams).not.toContain(p.b);
      }
      // And the pairs are exactly seeds 13 through 20, outside in.
      const inRound = new Set(pairs.flatMap((p) => [p.a, p.b]));
      expect(inRound.size).toBe(8);
      for (const t of field.seeds.slice(12)) expect(inRound.has(t)).toBe(true);
    }
  });

  it('splits the showdown with the top two seeds apart', () => {
    const sixteen = Array.from({ length: 16 }, (_, i) => 100 + i);
    const { bracketA, bracketB } = splitShowdown(sixteen);
    expect(bracketA).toHaveLength(8);
    expect(bracketB).toHaveLength(8);
    expect(new Set([...bracketA, ...bracketB]).size).toBe(16);
    expect(bracketA).toContain(100);
    expect(bracketB).toContain(101);
  });

  it('runs the whole stage to one champion, with the arithmetic intact', () => {
    const { s, cups, regionals } = build(905);
    const national = stageNational(s, cups, regionals);

    expect(national.opening).toHaveLength(4);
    const sixteen = [
      ...national.field.seeds.slice(0, 12),
      ...national.opening.map((o) => o.champion),
    ];
    expect(new Set(sixteen).size).toBe(16);
    const all = [...national.bracketA.seeds, ...national.bracketB.seeds];
    expect(new Set(all).size).toBe(16);
    for (const t of all) expect(sixteen).toContain(t);

    // The championship series is the two bracket champions, and its winner
    // is the country's.
    expect(national.final.seeds).toEqual(
      expect.arrayContaining([national.bracketA.champion, national.bracketB.champion]),
    );
    expect([national.bracketA.champion, national.bracketB.champion])
      .toContain(national.champion);
  });
});

describe('the series lengths', () => {
  it('are the format the backlog locked', () => {
    expect(SERIES.regional).toBe(3);
    expect(SERIES.opening).toBe(3);
    expect(SERIES.final).toBe(3);
    expect(REGIONAL_LENGTHS).toHaveLength(1);
    expect(CONF_FIELD).toBe(8);
    expect(CONF_ADVANCE).toBe(4);
    expect(NATIONAL_BIDS).toBe(20);
    expect(KNOCKOUT8).toHaveLength(3);
  });
});
