// calibration.ts
// The measurement harness. Sims a pile of games and reduces them to the league
// rates that can be checked against real NCAA Division I numbers.
//
// Lives here rather than in the CLI so the command line and the Vitest
// regression test measure the same way. Two copies of this would drift, which is
// the exact failure mode documented as B2 in 04-implementation-plan.md.

import { makeRng, makeTeam, resetNames } from './players.js';
import { simGame, type TeamState } from './game.js';
import type { EngineName, Rng, Team } from './types.js';

/**
 * Real NCAA Division I reference points.
 *
 * SOURCED, finally. The originals were inherited with the project and several
 * were wrong — the strikeout figure in particular was MLB's, which pulled the
 * engine toward the professional game the spec is most insistent about avoiding.
 *
 * Rate-based figures come from a Division I play-by-play study by Robert Frey
 * (rfrey22 on Medium, "More About Counts in D1 Baseball"): from a 0-0 count,
 * which is every plate appearance, D1 hitters bat **.270 with a .374 slugging
 * percentage, strike out 16.4% of the time and walk 9.1%**.
 *
 * The first-pitch-strike figure is corroborated twice over: 58.4% in
 * `02-sim-engine-spec.md`, and 57% with 66% of strikeouts starting 0-1 and 74%
 * of walks starting 1-0 in the ABCA / D1 Baseball 2020 data.
 *
 * Per-game counts are those rates over 41 plate appearances. They are marked
 * DERIVED because the plate appearance figure is itself an estimate.
 */
export const TARGETS: Record<string, number> = {
  // DERIVED, and bracketed two ways. Basic Runs Created over this rate profile
  // gives 4.63, which is known to run low and ignores the unearned runs a one
  // error per game league produces. The sourced BBCOR figure is 5.63 at a .279
  // average; scaling to .270 lands near 5.3. The project's old 6.79 is simply
  // not reachable from a .270/.374 environment.
  'Runs per team per game': 5.30,
  'PA per team per game': 41.0,
  'Batting average': 0.270,          // sourced
  'On base percentage': 0.347,       // derived from the sourced rate components
  'Slugging': 0.374,                 // sourced — never had a target before
  'Home runs per team per game': 0.51,   // derived: the .270/.374 profile implies ~0.5
  'Strikeouts per team per game': 6.72,   // derived: 16.4% of 41 PA
  'Walks per team per game': 3.73,        // derived: 9.1% of 41 PA
  'Pitches per plate appearance': 3.75,
  'First pitch strike rate': 0.584,
  'Foul share of swings': 0.365,
};

export interface Acc {
  ab: number; h: number; hr: number; d: number; t: number;
  bb: number; k: number; hbp: number; sb: number; cs: number;
  runs: number; errors: number; pitches: number; bf: number; outs: number;
  teamGames: number;
}

export function blankAcc(): Acc {
  return { ab:0,h:0,hr:0,d:0,t:0,bb:0,k:0,hbp:0,sb:0,cs:0,runs:0,errors:0,pitches:0,bf:0,outs:0,teamGames:0 };
}

export function accumulate(acc: Acc, side: TeamState): void {
  for (const r of side.batting.values()) {
    acc.ab += r.ab; acc.h += r.h; acc.hr += r.hr; acc.d += r.d; acc.t += r.t;
    acc.bb += r.bb; acc.k += r.k; acc.hbp += r.hbp; acc.sb += r.sb; acc.cs += r.cs;
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
      const res = simGame(a, b, rng, { engine });
      accumulate(acc, res.home);
      accumulate(acc, res.away);
    }
    played += games;
    pair += 1;
  }

  return acc;
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
      'On base percentage': (acc.h + acc.bb + acc.hbp) / pa,
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
