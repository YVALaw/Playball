// postseason.test.ts
// A bracket that loses a team, plays one twice, or crowns somebody with two
// losses is worse than no bracket at all.

import { describe, it, expect } from 'vitest';
import {
  createSeason, simSeason, standings, seasonLength, DEFAULT_SEASON,
} from '../src/engine/season.js';
import {
  singleElimination, bestOf, conferenceTournament, seasonAwards, allConference, runPostseason,
  conferenceLengths, CONF_FIELD, clincher,
  coachOfTheYear, freezeRegularSeason,
} from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';

function playedSeason(seed = 2027) {
  const season = createSeason(makeRng(seed));
  simSeason(season);
  return season;
}

describe('the knockout bracket', () => {
  const season = playedSeason();
  const seeds = standings(season, 'PAC').slice(0, CONF_FIELD).map((t) => t.index);
  const result = singleElimination(season, seeds, conferenceLengths());

  it('crowns exactly one champion from the field', () => {
    expect(seeds).toContain(result.champion);
  });

  it('eliminates everyone else, once each', () => {
    expect(result.eliminated).toHaveLength(seeds.length - 1);
    expect(new Set(result.eliminated).size).toBe(result.eliminated.length);
    expect(result.eliminated).not.toContain(result.champion);
    expect(new Set([...result.eliminated, result.champion])).toEqual(new Set(seeds));
  });

  it('sends a team home the moment it loses a series, and not before', () => {
    // One loss ends you, but a loss is a series rather than a game — so a team
    // that goes out can still have won games on the way.
    const bestOf = conferenceLengths()[0] as number;
    const need = clincher(bestOf);
    for (const round of result.rounds ?? []) {
      for (const s of round) {
        if (s.winner === null) continue;
        // A bye: a slot with a winner and nobody to play. The top two seeds of
        // a six team field get one, and that is the point of finishing first.
        if (s.games.length === 0) continue;
        const wins = s.games.filter((g) => g.winner === s.winner).length;
        expect(wins).toBe(need);
        expect(s.games.length).toBeLessThanOrEqual(bestOf);
      }
    }
  });

  it('takes the number of series a knockout tree should', () => {
    // Eight teams, seven series, every one of them decided.
    const series = (result.rounds ?? []).flat().filter((s) => s.games.length > 0);
    expect(series).toHaveLength(seeds.length - 1);
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

  it('gives the better seed the odd game at home, not every game', () => {
    // Home field is worth something real in this engine. Handing the higher
    // seed all seven games of a series would let the seeding decide it before
    // anybody played, so hosting alternates from him.
    const seedOf = new Map(seeds.map((t, i) => [t, i]));
    for (const round of result.rounds ?? []) {
      for (const s of round) {
        if (s.games.length < 2) continue;
        const better = (seedOf.get(s.a as number) as number)
          < (seedOf.get(s.b as number) as number) ? s.a : s.b;
        const homes = s.games.filter((g) => g.home === better).length;
        expect(homes).toBeGreaterThan(0);
        expect(homes).toBeLessThan(s.games.length);
      }
    }
  });

  it('refuses a field too small to be a tournament', () => {
    expect(() => singleElimination(season, [0], [3])).toThrow();
  });

  it('byes the best seeds when the field is short', () => {
    const short = standings(season, 'PAC').slice(0, 5).map((t) => t.index);
    const r = singleElimination(season, short, [3, 3, 3]);
    expect(short).toContain(r.champion);
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
  const cup = conferenceTournament(season, 'PAC');

  it('seeds the field off the recorded regular season order', () => {
    expect(season.finalOrder).not.toBeNull();
    expect(cup.seeds).toEqual(season.finalOrder!.filter((i) => season.teams[i]!.conference === 'PAC').slice(0, CONF_FIELD));
  });

  it('leaves the rest of the league out', () => {
    const inConference = season.teams.filter((x) => x.conference === 'PAC').length;
    expect(cup.missed).toHaveLength(inConference - CONF_FIELD);
    for (const team of cup.missed) expect(cup.seeds).not.toContain(team);
  });

  it('does not touch the conference race it was seeded from', () => {
    // Tournament games count toward overall records and statistics, never the
    // conference standings the bracket was built from. Read from the config
    // rather than hardcoded, so changing the shape of the world does not turn
    // this into a test of arithmetic nobody performs.
    const conferenceGames = DEFAULT_SEASON.seriesRounds * 3;
    const table = standings(season);
    for (const t of table) expect(t.cw + t.cl).toBe(conferenceGames);
  });

  it('counts tournament games toward overall records', () => {
    const champion = season.teams[cup.champion]!;
    expect(champion.w + champion.l).toBeGreaterThan(seasonLength(DEFAULT_SEASON));
  });
});

describe('awards', () => {
  const season = playedSeason();
  conferenceTournament(season, 'PAC');
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
    const cup = conferenceTournament(season, 'PAC');
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

  it('takes the last four from the four regions', () => {
    // Nothing is selected any more: you reach the national tournament by
    // winning your conference and then your region. One rule the whole way up.
    expect(result.regionChampions).toHaveLength(4);
    expect(new Set(result.regionChampions).size).toBe(4);
    for (const t of result.regionChampions) {
      expect(result.conferenceChampions).toContain(t);
    }
  });

  it('crowns a champion from the last four', () => {
    expect(result.regionChampions).toContain(result.champion);
    expect(result.finish[result.champion]).toBe('champion');
  });

  it('records a finish for every conference champion and nobody else', () => {
    // Getting out of your conference is what puts you in the record: the eight
    // champions, and nobody who did not win a league.
    const placed = Object.keys(result.finish).map(Number);
    expect(placed).toHaveLength(result.conferenceChampions.length);
    for (const team of placed) {
      expect(result.conferenceChampions).toContain(team);
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

describe('coach of the year', () => {
  it('goes to overachievement, not to the best roster', () => {
    // The award exists because "most wins" always lands on whoever was handed
    // the best players, which says nothing about coaching. This pins the
    // property that makes it worth having: the winner is not simply the team
    // with the most wins, and never a team with a losing record.
    const s = createSeason(makeRng(606));
    simSeason(s);
    freezeRegularSeason(s);

    const award = coachOfTheYear(s);
    expect(award).not.toBeNull();
    expect(award!.wins).toBeGreaterThan(award!.losses);

    // He beat his roster's worth.
    expect(award!.wins).toBeGreaterThan(award!.expected);

    // And across a handful of leagues it is not always the winningest team —
    // if it were, the measurement would be doing nothing.
    let sameAsMostWins = 0;
    for (const seed of [11, 202, 3003, 4004, 5005]) {
      const w = createSeason(makeRng(seed));
      simSeason(w);
      freezeRegularSeason(w);
      const a = coachOfTheYear(w);
      const most = [...w.teams].sort((x, y) => (y.rw ?? y.w) - (x.rw ?? x.w))[0]!;
      if (a && a.team === most.index) sameAsMostWins += 1;
    }
    expect(sameAsMostWins).toBeLessThan(5);
  });
});
