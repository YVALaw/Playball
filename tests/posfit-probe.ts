// posfit-probe.ts
// What playing out of position is worth, now that it is worth anything.
//
//   npx tsx tests/posfit-probe.ts
//
// Until September 1 the simulation had no opinion about where a man stood. A
// catcher at shortstop fielded exactly like a shortstop; a covered nine with
// two catchers and nobody in left defended like a sound one, because the
// engine took the first man at each spot and let the rest not exist. The nine
// are assigned to nine distinct spots now, hardest first, and each is passed
// through `fieldingAt`, which drops range, hands and arm by what the move
// costs him. The bat is untouched.
//
// ---------------------------------------------------------------------------
// Two false starts, kept because they are the finding
// ---------------------------------------------------------------------------
//
// The first attempt shuffled the batting order and measured nothing: moving
// the same nine men around changes nobody's position, because the assignment
// simply puts every man back where he belongs — his own spot is his cheapest.
// That is a property worth having (a scrambled-but-complete nine heals
// itself), not a measurement.
//
// The second swapped in a man from another club and reported that a catcher
// at short IMPROVED the defence — because the catcher reached for was a
// better fielder, and "different body" had been conflated with "different
// position". The assignment then made it worse still by doing its job: given
// two catchers and no shortstop it does NOT put a catcher at short, it slides
// a real infielder across and hides the catcher at first.
//
// The only honest isolation is to hold the card fixed and toggle the penalty
// itself. That was run with a temporary switch inside the assignment, and the
// numbers below are what it produced. The switch is not in the shipped code —
// this file is the record of the run.
//
//   sound nine, penalty off      7.293 runs allowed per game
//   sound nine, penalty on       7.293      <- identical, as designed
//   covered nine, penalty off    7.100
//   covered nine, penalty on     7.188      <- +0.088, about 4 runs a season
//
// The first pair is the important one: a well-built team's numbers do not
// move at all, which is why the whole calibration suite and every golden
// passed unchanged. Only the covered, the scrambled and the shorthanded pay.
//
// What this file still measures directly is that first property, since it is
// the one a future change is most likely to break.

import { simGame } from '../src/engine/game.js';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import type { Hitter } from '../src/engine/types.js';

const GAMES = 4000;
const season = createSeason(makeRng(5150), undefined, CONFERENCES);
const home = season.teams[10]!;
const away = season.teams[40]!;

function runsAllowed(lineup: readonly Hitter[] | undefined, label: string): number {
  const rng = makeRng(20260901);
  let runs = 0;
  for (let i = 0; i < GAMES; i++) {
    runs += simGame(home.team, away.team, rng, lineup ? { homeLineup: lineup } : {}).away.runs;
  }
  const per = runs / GAMES;
  console.log(`${label.padEnd(36)} ${per.toFixed(3)}`);
  return per;
}

console.log(`=== ${GAMES} games ===\n`);
const base = runsAllowed(undefined, 'the card as built');
const sound = [...home.team.lineup];
const same = runsAllowed(sound, 'the same nine, handed in');

// A genuine cover: the shortstop cannot play and the backup catcher fills in.
const cover = [...sound];
const ss = cover.findIndex((p) => p.pos === 'SS');
const backup = home.team.bench.find((p) => p.pos === 'C') ?? home.team.bench[0]!;
if (ss >= 0) cover[ss] = backup;
runsAllowed(cover, 'a backup catcher covering short');

console.log('\n=== the property that must hold ===');
console.log(`a sound nine is untouched: ${(same - base).toFixed(3)} runs of difference`);
if (Math.abs(same - base) > 0.0005) {
  console.log('!! A sound nine moved. The assignment is no longer the identity');
  console.log('!! for a well-built card, and every golden in the suite is at risk.');
}
