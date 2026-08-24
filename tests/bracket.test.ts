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
  conferenceField, conferenceIds, conferenceTournament, allConferenceTournaments,
  stageRegionals, stageNational, regionalPairing, freezeRegularSeason,
  conferenceLengths, REGIONAL_LENGTHS, NATIONAL_LENGTHS, REGIONS, regionOf,
  CONF_FIELD, SERIES,
} from '../src/engine/postseason.js';
import { createSeason, simSeason, currentDay, restedFirst } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { simGame } from '../src/engine/game.js';

const world = (seed: number) => {
  const s = createSeason(makeRng(seed));
  simSeason(s);
  return s;
};

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
    const b = startSeriesBracket(s, field, conferenceLengths());
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
    const b = startSeriesBracket(s, field, conferenceLengths());
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
        const b = startSeriesBracket(s, field, conferenceLengths());
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
        kind: 'regional', state,
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
    expect(roundName(after.knockout!.rounds, after.knockout!.round)).toBe('Final');

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
    const me = 0;
    const rest = s.teams.filter((t) => t.index !== me).slice(0, 3).map((t) => t.index);
    const state = startSeriesBracket(s, [me, ...rest], [1, 1]);
    const mine = state.rounds[0]!.find((x) => x.a === me || x.b === me)!;
    const foe = (mine.a === me ? mine.b : mine.a) as number;

    useDynasty.setState({
      season: s, userTeam: me, year: 2099,
      bracket: { stage: 'conference', cups: [], regionals: [], national: null },
      myBracket: {
        kind: 'conference', state,
        preplayed: new Map([[pairKey(me, foe), defeatFor(s, mine, me)]]),
      },
      knockout: null, postseasonSeen: [],
    });

    useDynasty.getState().simBracket('round');
    const mid = useDynasty.getState();
    expect(mid.myBracket).not.toBeNull();
    expect(mid.knockout).not.toBeNull();
    expect(roundName(mid.knockout!.rounds, mid.knockout!.round)).toBe('Semifinal');

    // Watching the rest of it out is what a knocked-out coach does, and it must
    // not rewrite where his own year ended.
    useDynasty.getState().simBracket('rest');
    const end = useDynasty.getState();
    expect(end.myBracket).toBeNull();
    expect(end.knockout).toEqual(mid.knockout);
    expect(end.bracket!.cups[0]!.champion).not.toBe(me);
  });
});

describe('the conference tournament', () => {
  it('takes half the league, so finishing seventh costs you something', () => {
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

describe('the pyramid', () => {
  it('advances only champions, at every tier', () => {
    // The whole reason the format is shaped this way: one rule, all the way up.
    // Win your conference, win your region, win the country. Nothing is
    // selected, so there is nothing to explain.
    const s = world(808);
    freezeRegularSeason(s);
    const cups = allConferenceTournaments(s);
    const regionals = stageRegionals(s, cups);
    const national = stageNational(s, regionals);

    const conferenceChampions = new Set(cups.map((c) => c.champion));
    expect(conferenceChampions.size).toBe(conferenceIds(s).length);

    // Every team in a regional won its conference.
    for (const r of regionals) {
      for (const t of r.seeds) expect(conferenceChampions.has(t)).toBe(true);
    }

    // Every team in the national tournament won its region.
    const regionChampions = new Set(regionals.map((r) => r.champion));
    expect(regionChampions.size).toBe(REGIONS.length);
    for (const t of national.seeds) expect(regionChampions.has(t)).toBe(true);
    expect(regionChampions.has(national.champion)).toBe(true);
  });

  it('pairs each region from the two conferences that sit in it', () => {
    const s = world(811);
    freezeRegularSeason(s);
    const cups = allConferenceTournaments(s);
    const pairings = regionalPairing(s, cups);

    expect(pairings).toHaveLength(REGIONS.length);
    for (const r of pairings) {
      expect(r.seeds).toHaveLength(2);
      const region = REGIONS.find((x) => x.id === r.id);
      expect(region).toBeDefined();
      // Both teams come from conferences in this region, and from different ones.
      const confs = r.seeds.map((t) => s.teams[t]!.conference);
      expect(new Set(confs).size).toBe(2);
      for (const c of confs) expect(region!.conferences).toContain(c);
      for (const c of confs) expect(regionOf(c)).toBe(r.id);
    }
  });

  it('seeds the regional by regular season record', () => {
    // Winning your conference does not make the forty five games irrelevant:
    // the better record still hosts the odd game of the series.
    const s = world(812);
    freezeRegularSeason(s);
    const cups = allConferenceTournaments(s);
    for (const r of regionalPairing(s, cups)) {
      const [a, b] = r.seeds as [number, number];
      const ra = s.teams[a]!;
      const rb = s.teams[b]!;
      expect(ra.rw ?? ra.w).toBeGreaterThanOrEqual(rb.rw ?? rb.w);
    }
  });

  it('keeps June shorter than the season that earned it', () => {
    const s = world(813);
    freezeRegularSeason(s);
    const cups = allConferenceTournaments(s);
    const regionals = stageRegionals(s, cups);
    const national = stageNational(s, regionals);

    const champ = national.champion;
    const played = (games: readonly { home: number; away: number }[]): number =>
      games.filter((g) => g.home === champ || g.away === champ).length;

    const total = played(cups.find((c) => c.seeds.includes(champ))?.games ?? [])
      + played(regionals.find((r) => r.seeds.includes(champ))?.games ?? [])
      + played(national.games);

    // Six series at worst: three of three, one of five, two of seven.
    expect(total).toBeLessThanOrEqual(3 * 3 + 5 + 7 * 2);
    expect(total).toBeGreaterThan(5);
  });
});

describe('the postseason map', () => {
  it('is one graph from conferences to a champion', async () => {
    const { buildGraph, layoutGraph } = await import('../src/ui/postseasonGraph.js');
    const s = world(909);
    freezeRegularSeason(s);
    const cups = allConferenceTournaments(s);
    const regionals = stageRegionals(s, cups);
    const national = stageNational(s, regionals);

    const g = buildGraph({ season: s, userTeam: 0, cups, regionals, national, live: null });

    expect(g.nodes.some((n) => n.kind === 'champ')).toBe(true);
    expect(g.edges.some((e) => e.kind === 'qualifies')).toBe(true);

    // Every edge joins two nodes that exist, and nothing points backwards.
    const layout = layoutGraph(g);
    for (const e of g.edges) {
      const from = layout.pos.get(e.from);
      const to = layout.pos.get(e.to);
      expect(from).toBeDefined();
      expect(to).toBeDefined();
      expect((to as { x: number }).x).toBeGreaterThan((from as { x: number }).x);
    }

    // Nothing overlaps: two cards in the same column keep their distance.
    const byColumn = new Map<number, { y: number; h: number }[]>();
    for (const n of g.nodes) {
      const p = layout.pos.get(n.id);
      if (!p) continue;
      const list = byColumn.get(p.x) ?? [];
      list.push(p);
      byColumn.set(p.x, list);
    }
    for (const list of byColumn.values()) {
      list.sort((a, b) => a.y - b.y);
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1] as { y: number; h: number };
        expect((list[i] as { y: number }).y).toBeGreaterThanOrEqual(prev.y + prev.h - 0.01);
      }
    }
  });

  it('draws all three tiers from the first press', async () => {
    // Nothing has been played here. The map still has to be a map: eight
    // conference trees, four regional series, and the last four above them.
    const { buildGraph } = await import('../src/ui/postseasonGraph.js');
    const s = world(910);
    freezeRegularSeason(s);

    const g = buildGraph({
      season: s, userTeam: 0, cups: [], regionals: [], national: null, live: null,
    });

    // A field of six pads up to an eight slot tree: four, then two, then one.
    let slots = 1;
    while (slots < CONF_FIELD) slots *= 2;
    const conf = g.nodes.filter((n) => n.kind === 'series' && n.bracket.startsWith('c-'));
    expect(conf).toHaveLength(conferenceIds(s).length * (slots - 1));

    const regional = g.nodes.filter((n) => n.kind === 'series' && n.bracket.startsWith('reg-'));
    expect(regional).toHaveLength(REGIONS.length);

    const nat = g.nodes.filter((n) => n.kind === 'series' && n.bracket === 'nat');
    expect(nat).toHaveLength(3);   // two semifinals and a final

    const champ = g.nodes.find((n) => n.kind === 'champ');
    expect(champ && champ.kind === 'champ' && champ.team).toBeNull();
  });
});

describe('the series lengths', () => {
  it('get longer as the stakes do', () => {
    expect(SERIES.conference).toBeLessThan(SERIES.regional);
    expect(SERIES.regional).toBeLessThan(SERIES.national);
    // Six teams is three rounds; a region is one series; the last four is two.
    expect(conferenceLengths()).toHaveLength(3);
    expect(REGIONAL_LENGTHS).toHaveLength(1);
    expect(NATIONAL_LENGTHS).toHaveLength(2);
  });
});
