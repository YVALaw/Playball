// calibration.ts
// The measurement harness. Sims a pile of games and reduces them to the league
// rates that can be checked against real NCAA Division I numbers.
//
// Lives here rather than in the CLI so the command line and the Vitest
// regression test measure the same way. Two copies of this would drift, which is
// the exact failure mode documented as B2 in 04-implementation-plan.md.

import { makeRng, resetNames } from './players.js';
import { makeTeam } from './roster.js';
import { closerFrom } from './season.js';
import { simGame, type TeamState } from './game.js';
import type { Arm, EngineName, Rng, Team } from './types.js';

/**
 * Modern NCAA Division I reference points.
 *
 * The 2025 conference-by-conference table published by FanGraphs from
 * Baseball-Reference data averages roughly .280/.384/.438, 6.73 runs and 1.03
 * home runs per team game across the 29 D-I conferences (independent Oregon
 * State excluded). Walk and strikeout targets are the same table's mean rates
 * applied to Playball's measured ~41.7 PA/team game. This deliberately targets
 * the middle of Division I rather than a power-conference extreme.
 */
export const TARGETS: Record<string, number> = {
  'Runs per team per game': 6.73,
  'PA per team per game': 41.7,
  'Batting average': 0.280,
  'On base percentage': 0.384,
  'Slugging': 0.438,
  'Home runs per team per game': 1.03,
  'Strikeouts per team per game': 8.01,
  'Walks per team per game': 4.70,
  'Pitches per plate appearance': 3.75,
  'First pitch strike rate': 0.584,
  'Foul share of swings': 0.365,
};

export interface Acc {
  ab: number; h: number; hr: number; d: number; t: number;
  bb: number; k: number; hbp: number; sb: number; cs: number; sf: number; sh: number;
  runs: number; errors: number; pitches: number; bf: number; outs: number;
  teamGames: number;
}

export function blankAcc(): Acc {
  return { ab:0,h:0,hr:0,d:0,t:0,bb:0,k:0,hbp:0,sb:0,cs:0,sf:0,sh:0,runs:0,errors:0,pitches:0,bf:0,outs:0,teamGames:0 };
}

export function accumulate(acc: Acc, side: TeamState): void {
  for (const r of side.batting.values()) {
    acc.ab += r.ab; acc.h += r.h; acc.hr += r.hr; acc.d += r.d; acc.t += r.t;
    acc.bb += r.bb; acc.k += r.k; acc.hbp += r.hbp; acc.sb += r.sb; acc.cs += r.cs;
    acc.sf += r.sf ?? 0; acc.sh += r.sh ?? 0;
  }
  for (const r of side.pitching.values()) {
    acc.pitches += r.pitches; acc.bf += r.bf; acc.outs += r.outs;
  }
  acc.runs += side.runs;
  acc.errors += side.errors;
  acc.teamGames += 1;
}

/**
 * The two teams every calibration run uses. Fixed seed, so it is reproducible.
 *
 * The resetNames() call is load bearing. The unique-name pool in players.ts is
 * module level mutable state: without clearing it, a second run in the same
 * process skips names it already used, which consumes different random draws,
 * which generates different players, which produces different league rates from
 * the same seed. Two calibration runs in one process would silently disagree.
 */
export function newTeams(seed: number): { rng: Rng; a: Team; b: Team } {
  resetNames();
  const rng = makeRng(seed);
  return {
    rng,
    a: makeTeam(rng, 'Ridgemont State Ravens', 50),
    b: makeTeam(rng, 'Callahan Tech Miners', 50),
  };
}

/**
 * How many distinct team pairs a calibration run is spread across.
 *
 * This matters more than it looks. Measuring one pair for the whole run makes
 * the result a property of twenty-three particular players rather than of the
 * engine: change anything about player generation — even something unrelated,
 * like adding a potential rating that consumes two extra random draws — and the
 * league rates lurch, because a different pair of teams got built. That is a
 * harness that cannot tell "the engine changed" from "the dice changed".
 *
 * Rebuilding the teams periodically averages over the roster lottery, so the
 * numbers describe the simulation instead of the sample.
 */
const CALIBRATION_PAIRS = 12;

export function runSeason(engine: EngineName, n: number, seed = 4242): Acc {
  const acc = blankAcc();
  const perPair = Math.max(1, Math.ceil(n / CALIBRATION_PAIRS));
  let played = 0;
  let pair = 0;

  while (played < n) {
    const { rng, a, b } = newTeams(seed + pair * 1000);
    const games = Math.min(perPair, n - played);
    for (let i = 0; i < games; i++) {
      /*
        The staff a season would use tonight, not the top of two arrays.

        `simGame` left to its defaults starts `rotation[0]` and calls the pen
        in array order, and until 2026-09-15 that measured nothing: a roster
        was four starters drawn in no order and six relievers much alike. A
        roster is the one June leaves now (roster.ts) -- the four best
        starters of seven or eight, best first, over a pen of nine that runs
        from the fifth starter down to a walk-on -- so the defaults had the
        ace start every game and the two best relievers finish it, and the
        harness read walks nine percent under a league whose seasons had
        not moved. A season starts the scheduled slot and calls the rested
        arm first (`restedFirst`, season.ts), which over a spring is every
        arm in turn; the rotation of both here is the same thing without the
        calendar. The closer is the season's rule verbatim.
      */
      const relief = (pen: readonly Arm[]): Arm[] => {
        const k = pen.length === 0 ? 0 : i % pen.length;
        return [...pen.slice(k), ...pen.slice(0, k)];
      };
      const homePen = relief(a.bullpen);
      const awayPen = relief(b.bullpen);
      const homeClose = closerFrom(homePen);
      const awayClose = closerFrom(awayPen);
      const res = simGame(a, b, rng, {
        engine,
        homeStarter: i % Math.max(1, a.rotation.length),
        awayStarter: i % Math.max(1, b.rotation.length),
        homeBullpen: homePen,
        awayBullpen: awayPen,
        ...(homeClose ? { homeCloser: homeClose } : {}),
        ...(awayClose ? { awayCloser: awayClose } : {}),
      });
      accumulate(acc, res.home);
      accumulate(acc, res.away);
    }
    played += games;
    pair += 1;
  }

  return acc;
}

/**
 * One season of one whole league, read off the books it actually kept.
 *
 * Everything above this measures `simGame` against two freshly generated 50
 * quality teams, which is the right way to ask whether the *engine* is
 * calibrated and the wrong way to ask whether the *world* still is. A year-five
 * league is whatever progression, the draft, the portal and five recruiting
 * classes left behind, and nothing measured that: the outside audit of
 * 2026-09-11 put three consecutive seasons at 6.86, 6.98 and 7.25 runs against
 * a 6.73 target and nothing in the suite would have noticed.
 *
 * Read after the regular season and before the postseason, so it is the same
 * forty-five games a year the targets describe — `season.batting` keeps
 * counting through June, deliberately, the way NCAA totals do.
 */
export interface LeagueRates {
  /** Team-games behind the numbers, so a caller can tell a thin sample. */
  teamGames: number;
  runs: number;
  avg: number;
  obp: number;
  slg: number;
  hr: number;
  k: number;
  bb: number;
}

export function leagueRates(season: {
  teams: readonly { rs: number; gp: number }[];
  batting: ReadonlyMap<unknown, {
    ab: number; h: number; d: number; t: number; hr: number;
    bb: number; k: number; hbp: number; sf?: number;
  }>;
}): LeagueRates {
  let teamGames = 0;
  let runs = 0;
  for (const t of season.teams) { teamGames += t.gp; runs += t.rs; }

  let ab = 0, h = 0, d = 0, tr = 0, hr = 0, bb = 0, k = 0, hbp = 0, sf = 0;
  for (const line of season.batting.values()) {
    ab += line.ab; h += line.h; d += line.d; tr += line.t; hr += line.hr;
    bb += line.bb; k += line.k; hbp += line.hbp; sf += line.sf ?? 0;
  }
  const g = Math.max(1, teamGames);
  const tb = (h - d - tr - hr) + d * 2 + tr * 3 + hr * 4;
  return {
    teamGames,
    runs: runs / g,
    avg: h / Math.max(1, ab),
    obp: (h + bb + hbp) / Math.max(1, ab + bb + hbp + sf),
    slg: tb / Math.max(1, ab),
    hr: hr / g,
    k: k / g,
    bb: bb / g,
  };
}

export interface Metrics {
  rows: Record<string, number>;
  slugging: number;
  errorsPerGame: number;
  stolenBasePct: number;
}

export function metrics(acc: Acc): Metrics {
  const g = acc.teamGames;
  const pa = acc.bf;
  const tb = (acc.h - acc.d - acc.t - acc.hr) + acc.d * 2 + acc.t * 3 + acc.hr * 4;
  return {
    rows: {
      'Runs per team per game': acc.runs / g,
      'PA per team per game': pa / g,
      'Batting average': acc.h / acc.ab,
      'On base percentage': (acc.h + acc.bb + acc.hbp) / (acc.ab + acc.bb + acc.hbp + acc.sf),
      'Home runs per team per game': acc.hr / g,
      'Strikeouts per team per game': acc.k / g,
      'Walks per team per game': acc.bb / g,
      'Pitches per plate appearance': acc.pitches / pa,
      'Slugging': tb / acc.ab,
    },
    slugging: tb / acc.ab,
    errorsPerGame: acc.errors / g,
    stolenBasePct: acc.sb / Math.max(1, acc.sb + acc.cs),
  };
}
