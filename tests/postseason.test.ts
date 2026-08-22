// postseason.test.ts
// A bracket that loses a team, plays one twice, or crowns somebody with two
// losses is worse than no bracket at all.

import { describe, it, expect } from 'vitest';
import { createSeason, simSeason, standings } from '../src/engine/season.js';
import {
  doubleElimination, bestOf, conferenceTournament, seasonAwards, allConference, runPostseason,
} from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';

function playedSeason(seed = 2027) {
  const season = createSeason(makeRng(seed));
  simSeason(season);
  return season;
}

describe('double elimination', () => {
  const season = playedSeason();
  const seeds = standings(season, 'PAC').slice(0, 8).map((t) => t.index);
  const result = doubleElimination(season, seeds);

  it('crowns exactly one champion from the field', () => {
    expect(seeds).toContain(result.champion);
  });

  it('eliminates everyone else, once each', () => {
    expect(result.eliminated).toHaveLength(seeds.length - 1);
    expect(new Set(result.eliminated).size).toBe(result.eliminated.length);
    expect(result.eliminated).not.toContain(result.champion);
    expect(new Set([...result.eliminated, result.champion])).toEqual(new Set(seeds));
  });

  it('sends nobody home before their second loss', () => {
    const losses = new Map<number, number>();
    for (const g of result.games) losses.set(g.loser, (losses.get(g.loser) ?? 0) + 1);
    for (const team of result.eliminated) expect(losses.get(team)).toBe(2);
    expect(losses.get(result.champion) ?? 0).toBeLessThanOrEqual(1);
  });

  it('takes the number of games a double elimination bracket should', () => {
    // Every team but the champion needs two losses; the champion may take one.
    expect(result.games.length).toBeGreaterThanOrEqual(seeds.length * 2 - 2);
    expect(result.games.length).toBeLessThanOrEqual(seeds.length * 2 - 1);
  });

  it('never plays a team against itself, and never ties', () => {
    for (const g of result.games) {
      expect(g.home).not.toBe(g.away);
      expect(g.homeRuns).not.toBe(g.awayRuns);
      expect([g.home, g.away]).toContain(g.winner);
      expect([g.home, g.away]).toContain(g.loser);
      expect(g.winner).not.toBe(g.loser);
    }
  });

  it('gives home field to the better seed', () => {
    const seedOf = new Map(seeds.map((t, i) => [t, i]));
    for (const g of result.games) {
      expect(seedOf.get(g.home)!).toBeLessThan(seedOf.get(g.away)!);
    }
  });

  it('refuses a field too small to be a tournament', () => {
    expect(() => doubleElimination(season, [0])).toThrow();
  });

  it('handles an odd field by giving the top seed a bye', () => {
    const odd = standings(season, 'PAC').slice(0, 5).map((t) => t.index);
    const r = doubleElimination(season, odd);
    expect(odd).toContain(r.champion);
    expect(r.eliminated).toHaveLength(4);
  });
});

describe('best of N series', () => {
  const season = playedSeason();

  it('ends as soon as one side clinches', () => {
    for (const n of [3, 5, 7]) {
      const r = bestOf(season, n, 0, 1);
      const needed = Math.floor(n / 2) + 1;
      expect(r.games.length).toBeGreaterThanOrEqual(needed);
      expect(r.games.length).toBeLessThanOrEqual(n);
      const wins = r.games.filter((g) => g.winner === r.champion).length;
      expect(wins).toBe(needed);
    }
  });
});

describe('conference tournament', () => {
  const season = playedSeason();
  const cup = conferenceTournament(season, 'PAC', 6);

  it('seeds the field off the recorded regular season order', () => {
    expect(season.finalOrder).not.toBeNull();
    expect(cup.seeds).toEqual(season.finalOrder!.filter((i) => season.teams[i]!.conference === 'PAC').slice(0, 6));
  });

  it('leaves the rest of the league out', () => {
    expect(cup.missed).toHaveLength(8 - 6);
    for (const team of cup.missed) expect(cup.seeds).not.toContain(team);
  });

  it('does not touch the conference race it was seeded from', () => {
    // Tournament games count toward overall records and statistics, never the
    // conference standings the bracket was built from. Seven series of three is
    // 21 conference games; the other twelve are non-conference and never counted
    // here.
    const table = standings(season);
    for (const t of table) expect(t.cw + t.cl).toBe(21);
  });

  it('counts tournament games toward overall records', () => {
    const champion = season.teams[cup.champion]!;
    expect(champion.w + champion.l).toBeGreaterThan(33);  // 33 regular season plus bracket games
  });
});

describe('awards', () => {
  const season = playedSeason();
  conferenceTournament(season, 'PAC', 6);
  const awards = seasonAwards(season);

  it('names a player, a pitcher and a freshman of the year', () => {
    const titles = awards.map((a) => a.title);
    expect(titles).toContain('Player of the Year');
    expect(titles).toContain('Pitcher of the Year');
    expect(titles).toContain('Freshman of the Year');
  });

  it('does not hand Player of the Year to a pitcher', () => {
    const poy = awards.find((a) => a.title === 'Player of the Year')!;
    const pitchers = new Set(
      season.teams.flatMap((t) => [...t.team.rotation, ...t.team.bullpen]).map((p) => p.id),
    );
    expect(pitchers.has(poy.id)).toBe(false);
  });

  it('picks a full all-conference first team', () => {
    const picks = allConference(season);
    const spots = picks.filter((p) => p.position !== 'P').map((p) => p.position);
    expect(new Set(spots)).toEqual(new Set(['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']));
    expect(picks.filter((p) => p.position === 'P')).toHaveLength(3);
    expect(new Set(picks.map((p) => p.id)).size).toBe(picks.length);
  });
});

describe('postseason determinism', () => {
  const run = (seed: number): string => {
    const season = playedSeason(seed);
    const cup = conferenceTournament(season, 'PAC', 6);
    return `${cup.champion}:${cup.games.length}:${cup.eliminated.join(',')}`;
  };

  it('replays identically from the same seed', () => {
    expect(run(2027)).toBe(run(2027));
  });

  it('produces a different bracket from a different seed', () => {
    expect(run(2027)).not.toBe(run(2031));
  });
});

describe('the whole postseason', () => {
  const season = playedSeason(31337);
  const result = runPostseason(season);

  it('crowns a champion in every conference', () => {
    const confs = new Set(season.teams.map((t) => t.conference));
    expect(result.conferenceChampions).toHaveLength(confs.size);
    expect(new Set(result.conferenceChampions).size).toBe(confs.size);
  });

  it('fills a 16 team field', () => {
    // A quarter of the sixty four programs, which is roughly the share of
    // Division I that reaches the real tournament.
    expect(result.field).toHaveLength(16);
    expect(new Set(result.field.map((b) => b.team)).size).toBe(16);
  });

  it('splits the field evenly between automatic and at-large bids', () => {
    const autos = result.field.filter((b) => b.kind === 'automatic');
    expect(autos).toHaveLength(8);
    expect(result.field.filter((b) => b.kind === 'at-large')).toHaveLength(8);
  });

  it('gives every conference champion an automatic bid', () => {
    for (const champ of result.conferenceChampions) {
      const bid = result.field.find((b) => b.team === champ);
      expect(bid, 'a conference champion must be in the field').toBeDefined();
      expect(bid?.kind).toBe('automatic');
    }
  });

  it('records a finish for everyone in the field and nobody else', () => {
    const placed = Object.keys(result.finish).map(Number);
    expect(placed).toHaveLength(16);
    for (const team of placed) {
      expect(result.field.some((b) => b.team === team)).toBe(true);
    }
  });

  it('names exactly one champion and one runner-up', () => {
    const values = Object.values(result.finish);
    expect(values.filter((f) => f === 'champion')).toHaveLength(1);
    expect(values.filter((f) => f === 'runner-up')).toHaveLength(1);
    expect(result.finish[result.champion]).toBe('champion');
  });

  it('sends the four regional winners to Omaha', () => {
    const values = Object.values(result.finish);
    const inOmaha = values.filter(
      (f) => f === 'omaha' || f === 'runner-up' || f === 'champion',
    );
    expect(inOmaha).toHaveLength(4);
  });
});
