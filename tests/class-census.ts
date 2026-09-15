// class-census.ts
// The ladder by class year, and the run environment that stands on it.
//
// `05` §71.4 measured the country by class and found the defect this file
// exists to watch: a generated senior was no better than a generated
// freshman, because `makeTeam` drew every man from one distribution and
// stamped a class on him afterwards. The engine was therefore calibrated
// against a population that exists on day one of a career and never again.
//
// This prints the two things that decide whether that is fixed: mean overall
// by class for bats and for arms, and the league's rates, in the opening
// world and again after four winters of the world's own development. Run it
// before and after any change to generation or development, and read both
// checkpoints — a fix that makes day one look like year five has done half
// the job, and the other half is what year five plays like.
//
//   npx tsx tests/class-census.ts            two worlds, five seasons each
//   YEARS=3 WORLDS=1 npx tsx tests/class-census.ts
//
// Same offseason the calibration guard uses (`headlessYear`), so the numbers
// here and the bands in `calibration-seasons.test.ts` describe one world.

import { createSeason, simSeason, seasonComplete, type SeasonState } from '../src/engine/season.js';
import { leagueRates } from '../src/engine/calibration.js';
import { runPostseason } from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { overallOf } from '../src/engine/ratings.js';
import { isTwoWay } from '../src/engine/types.js';
import type { ClassYear, Player } from '../src/engine/types.js';
import { headlessYear, lastSigned } from './headlessYear.js';

const YEARS = Number(process.env.YEARS ?? 5);
const WORLDS = Number(process.env.WORLDS ?? 2);
const CLASSES: readonly ClassYear[] = ['FR', 'SO', 'JR', 'SR'];

interface Cell { n: number; sum: number; walkOns: number; walkOnSum: number }
interface Census {
  bats: Record<ClassYear, Cell>;
  arms: Record<ClassYear, Cell>;
}

const cell = (): Cell => ({ n: 0, sum: 0, walkOns: 0, walkOnSum: 0 });
const blank = (): Census => ({
  bats: { FR: cell(), SO: cell(), JR: cell(), SR: cell() },
  arms: { FR: cell(), SO: cell(), JR: cell(), SR: cell() },
});

/** Everybody on every roster, split by the job they hold rather than by type. */
function census(season: SeasonState): Census {
  const c = blank();
  for (const rec of season.teams) {
    const t = rec.team;
    const add = (side: 'bats' | 'arms', p: Player): void => {
      const at = c[side][p.classYear];
      at.n += 1; at.sum += overallOf(p);
      // A walk-on is a hole the class did not fill, at thirteen under the
      // programme's quality. How many of them a side carries is the other
      // half of what a class-year mean is made of.
      if (p.walkOn) { at.walkOns += 1; at.walkOnSum += overallOf(p); }
    };
    for (const p of [...t.lineup, ...t.bench]) add('bats', p);
    for (const p of [...t.rotation, ...t.bullpen]) add(isTwoWay(p) ? 'bats' : 'arms', p);
  }
  return c;
}

const mean = (c: { n: number; sum: number }): string =>
  c.n === 0 ? '   —' : (c.sum / c.n).toFixed(1).padStart(5);

function row(label: string, side: Record<ClassYear, Cell>): string {
  const all = CLASSES.reduce((a, k) => ({
    n: a.n + side[k].n, sum: a.sum + side[k].sum,
    walkOns: a.walkOns + side[k].walkOns, walkOnSum: a.walkOnSum + side[k].walkOnSum,
  }), cell());
  const signed = { n: all.n - all.walkOns, sum: all.sum - all.walkOnSum };
  const frSigned = { n: side.FR.n - side.FR.walkOns, sum: side.FR.sum - side.FR.walkOnSum };
  return `  ${label.padEnd(6)}${CLASSES.map((k) => mean(side[k])).join(' ')}   all ${mean(all)}  (n=${all.n})`
    + `   walk-ons ${all.walkOns} @${mean({ n: all.walkOns, sum: all.walkOnSum })}`
    + `   signed ${mean(signed)}   FR signed ${mean(frSigned)} (n=${frSigned.n})`;
}

for (let w = 0; w < WORLDS; w++) {
  const seed = 4242 + w * 7919;
  let season = createSeason(makeRng(seed), undefined, CONFERENCES);
  season.captureBoxFor = 0;
  console.log(`\nworld ${seed}`);
  console.log(`  ${''.padEnd(6)}${CLASSES.map((k) => k.padStart(5)).join(' ')}`);
  for (let y = 1; y <= YEARS; y++) {
    const c = census(season);
    console.log(`year ${y}  signed ${y === 1 ? '—' : lastSigned}`);
    console.log(row('bats', c.bats));
    console.log(row('arms', c.arms));
    while (!seasonComplete(season)) simSeason(season);
    const r = leagueRates(season);
    console.log(
      `  runs ${r.runs.toFixed(2)}  avg ${r.avg.toFixed(3)}  obp ${r.obp.toFixed(3)}  slg ${r.slg.toFixed(3)}` +
      `  hr ${r.hr.toFixed(2)}  k ${r.k.toFixed(2)}  bb ${r.bb.toFixed(2)}`,
    );
    if (y === YEARS) break;
    season = headlessYear(season, 0, runPostseason(season));
  }
}
