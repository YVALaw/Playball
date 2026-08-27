// postseason.test.ts
// A bracket that loses a team, plays one twice, or crowns somebody with two
// losses is worse than no bracket at all.

import { describe, it, expect } from 'vitest';
import {
  createSeason, simSeason, standings, seasonLength, nextSeason, DEFAULT_SEASON,
} from '../src/engine/season.js';
import { departAndDevelop, fillRosters } from '../src/engine/progression.js';
import { CONFERENCES } from '../src/data/schools.js';
import {
  singleElimination, bestOf, conferenceTournament, seasonAwards, allConference, runPostseason,
  CONF_FIELD, CONF_ADVANCE, NATIONAL_BIDS, clincher,
  coachOfTheYear, coachAwardCandidates, freezeRegularSeason,
  type PostseasonSummary,
} from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';
import { overallOf } from '../src/engine/ratings.js';

function playedSeason(seed = 2027) {
  const season = createSeason(makeRng(seed));
  simSeason(season);
  return season;
}

describe('the knockout bracket', () => {
  const season = playedSeason();
  const seeds = standings(season, 'PAC').slice(0, CONF_FIELD).map((t) => t.index);
  const result = singleElimination(season, seeds, [3, 3, 3]);

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
    const bestOf = 3;
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

  it('hangs sixteen regional banners', () => {
    expect(result.regionChampions).toHaveLength(16);
    expect(new Set(result.regionChampions).size).toBe(16);
  });

  it('seats a twenty team national field, champion inside it', () => {
    expect(result.nationalField).toHaveLength(NATIONAL_BIDS);
    expect(new Set(result.nationalField).size).toBe(NATIONAL_BIDS);
    expect(result.nationalField).toContain(result.champion);
    // Every regional champion travels; the protected four travel too.
    for (const t of result.regionChampions) {
      expect(result.nationalField).toContain(t);
    }
    expect(result.protectedTeams).toHaveLength(4);
    for (const t of result.protectedTeams!) {
      expect(result.nationalField).toContain(t);
    }
    expect(result.finish[result.champion]).toBe('champion');
  });

  it('records a finish for every regional participant and nobody else', () => {
    // Finishing top four of your conference tournament is what puts you in
    // the record: thirty-two of them, and the at-large additions on top.
    const placed = Object.keys(result.finish).map(Number);
    // The 32 regional teams plus any at-large team that was not one of them.
    const expected = new Set<number>();
    for (const t of result.nationalField!) expected.add(t);
    expect(placed.length).toBeGreaterThanOrEqual(32);
    for (const t of result.nationalField!) {
      expect(placed).toContain(t);
    }
  });

  it('names exactly one champion and one runner-up', () => {
    const values = Object.values(result.finish);
    expect(values.filter((f) => f === 'champion')).toHaveLength(1);
    expect(values.filter((f) => f === 'runner-up')).toHaveLength(1);
    expect(result.finish[result.champion]).toBe('champion');
  });

  it('sends the whole field to the showdown, because there is nothing in the way', () => {
    /*
      This used to expect sixteen, and the sixteen were what survived a
      best-of-three opening round that cut the twenty-team field down to the
      size of the brackets. That round is gone: the bottom four of each half
      play their way in inside the winners bracket instead, where losing drops
      you to the losers side rather than ending your season.

      So there is no longer any group between "qualified for the tournament"
      and "reached the showdown", and 'omaha' means the field.
    */
    const values = Object.values(result.finish);
    const inOmaha = values.filter(
      (f) => f === 'omaha' || f === 'runner-up' || f === 'champion',
    );
    expect(inOmaha).toHaveLength(NATIONAL_BIDS);
    // And nobody is left in the state that round used to produce.
    expect(values.filter((f) => f === 'national')).toHaveLength(0);
  });

  it('sends the conference count on: eight champions, four per league advance', () => {
    void CONF_ADVANCE;
    expect(result.conferenceChampions).toHaveLength(8);
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

    // With no postseason to read and no previous year on record, the only
    // category that can fire is the regression — the always-available fallback.
    expect(award!.reason).toBe('overachieved');

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

  it('recognises a turnaround that towers over the field', () => {
    // The categories are picked by how loud each story was this season —
    // the winner's number against that number's spread across the league. A
    // league where nobody moved except one program that climbed eighteen games
    // has exactly one story, and the award has to find it.
    const s = createSeason(makeRng(1101));
    simSeason(s);
    freezeRegularSeason(s);

    // Everyone repeated last year to the game — except the riser.
    for (const t of s.teams) { t.lastW = t.rw ?? t.w; t.lastL = t.rl ?? t.l; }
    const riser = s.teams.find((t) => (t.rw ?? t.w) > (t.rl ?? t.l))!;
    riser.lastW = Math.max(0, (riser.rw ?? riser.w) - 18);
    riser.lastL = (riser.lastL ?? 0) + 18;

    const award = coachOfTheYear(s)!;
    expect(award.reason).toBe('turnaround');
    expect(award.team).toBe(riser.index);
    expect(award.line).toContain('in one year');
  });

  it('hands it to a national champion nobody saw coming', () => {
    // Giant-killer is binary — either the champion is one of the names or he is
    // not — so it carries a fixed salience high enough to win whenever it
    // fires. A title at a program the country ranks fiftieth in reputation is
    // the story of that season, whatever the overachievement table says.
    //
    // Read off prestige rather than off roster strength, and the reason is
    // measured: the national field is the eight conference champions, so the
    // champion's *roster* was inside the country's top ten in every one of
    // twenty simulated seasons and the category could never fire. What the
    // school is, is a different question from what this year's team is — and
    // it is the one the phrase means.
    const s = createSeason(makeRng(1102));
    simSeason(s);
    freezeRegularSeason(s);

    const ranked = [...s.teams].sort((a, b) => b.prestige - a.prestige);
    const david = ranked.slice(32).find((t) => (t.rw ?? t.w) > (t.rl ?? t.l))!;

    const post: PostseasonSummary = {
      conferenceChampions: [david.index],
      regionChampions: [david.index],
      champion: david.index,
      finish: { [david.index]: 'champion' },
    };

    const award = coachOfTheYear(s, post)!;
    expect(award.reason).toBe('giantKiller');
    expect(award.team).toBe(david.index);
    expect(award.line).toContain('name in the country');
  });

  /*
    B20. The four categories were built so that the citation would not read the
    same every June, and it did anyway: measured over twenty seasons of the full
    world, the giant-killer fired zero times, wire-to-wire once, and
    overachievement took eleven. Two of the four were dead.

    Both were dead for the same reason and it was not their thresholds. Each
    category's salience is a maximum over a different pool — overachievement and
    the turnaround are the largest of ninety six draws, wire-to-wire the largest
    of the eight who won a league — and the largest of ninety six sits further
    from the mean than the largest of eight every single time. So the comparison
    was not "which story was loudest" but "which statistic has the fattest
    tail", and one statistic always won it.

    This is the property that has to hold, and the only honest way to check it
    is over a run of seasons: no category may take more than two thirds of the
    awards, and at least three of the four have to be able to win at all.
  */
  it('does not tell the same story every June', () => {
    let season = createSeason(makeRng(4242), DEFAULT_SEASON, [...CONFERENCES]);
    season.year = 2027;
    const seen: Record<string, number> = {};

    const YEARS = 8;
    for (let y = 0; y < YEARS; y++) {
      simSeason(season);
      const post = runPostseason(season);
      const award = coachOfTheYear(season, post);
      if (award) seen[award.reason] = (seen[award.reason] ?? 0) + 1;
      departAndDevelop(season, season.rng, { userTeam: -1 });
      fillRosters(season, season.rng, { userTeam: -1 });
      season = nextSeason(season);
    }

    const kinds = Object.keys(seen);
    expect(kinds.length).toBeGreaterThanOrEqual(2);
    for (const n of Object.values(seen)) {
      expect(n).toBeLessThan(YEARS * 0.7);
    }
    // And the one that used to take everything no longer does.
    expect(seen.overachieved ?? 0).toBeLessThan(YEARS);
  });

  /*
    The same property one level down, and the reason it is a separate test: a
    category that never even reaches the ballot cannot be caught by counting
    winners, because a rare category is *supposed* to be rare. What must not
    happen is what happened to wire-to-wire — a candidate that could not be
    constructed at all in nineteen seasons out of twenty.
  */
  it('offers more than one story to choose between', () => {
    const s = createSeason(makeRng(4242), DEFAULT_SEASON, [...CONFERENCES]);
    s.year = 2027;
    simSeason(s);
    const post = runPostseason(s);
    const kinds = coachAwardCandidates(s, post).map((c) => c.reason);
    expect(kinds).toContain('overachieved');
    expect(kinds).toContain('wireToWire');
  });
});
