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
//   SEED=12161 WORLDS=1 YEARS=10 npx tsx tests/class-census.ts   one world, alone in its process
//
// Same offseason the calibration guard uses (`headlessYear`), so the numbers
// here and the bands in `calibration-seasons.test.ts` describe one world.

import { createSeason, simSeason, seasonComplete, type SeasonState } from '../src/engine/season.js';
import { leagueRates } from '../src/engine/calibration.js';
import { runPostseason } from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { overallOf, armValue } from '../src/engine/ratings.js';
import { isTwoWay } from '../src/engine/types.js';
import type { Arm, ClassYear, Player } from '../src/engine/types.js';
import { headlessYear, lastSigned } from './headlessYear.js';

const YEARS = Number(process.env.YEARS ?? 5);
const WORLDS = Number(process.env.WORLDS ?? 2);
// The first world's seed; each further world in the process is 7919 on.
// `uniqueName` is module state, so a world run second in a process is not
// the world of the same seed run first -- run one per process to compare.
const SEED = Number(process.env.SEED ?? 4242);
// BY_TEAM=1 prints one line per programme every year, so a change in the
// country's mean can be read against the school's quality and prestige.
const BY_TEAM = process.env.BY_TEAM === '1';
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

/**
 * Who actually played, and how good he was.
 *
 * The roster mean cannot see this. A recruited roster is five men deeper
 * than a generated one (28 against 23 by year five) and carries a tenth of
 * walk-ons at thirty who never take the field, so its mean reads level with
 * day one while its nine and its four are better. The run environment is
 * made by the men in the box score, so this weights every hitter by his
 * plate appearances and every arm by his outs -- and says how much of each
 * the walk-ons took, which is the other thing a walk-on can do to a league.
 */
function played(season: SeasonState): string {
  const bats = new Map<string, Player>();
  const arms = new Map<string, Arm>();
  let card = { lineup: 0, rotation: 0, pen: 0, bench: 0, men: 0, teams: 0 };
  // The four best arms on the roster by any label, against the four rotating:
  // a gap here is June's relabelling, which parks a signed starter in the pen
  // as an RP for life and then picks next year's rotation from SP labels.
  let best4 = 0, sp = 0, spLabelled = 0;
  for (const rec of season.teams) {
    const t = rec.team;
    for (const p of [...t.lineup, ...t.bench]) bats.set(String(p.id), p);
    for (const p of [...t.rotation, ...t.bullpen]) {
      arms.set(String(p.id), p as Arm);
      if (isTwoWay(p)) bats.set(String(p.id), p);
    }
    const avg = (xs: readonly Player[], f: (p: Player) => number): number =>
      xs.length === 0 ? 0 : xs.reduce((a, p) => a + f(p), 0) / xs.length;
    const armsHere = [...t.rotation, ...t.bullpen] as Arm[];
    const top = [...armsHere].sort((x, y) => armValue(y) - armValue(x)).slice(0, t.rotation.length);
    best4 += avg(top, (p) => armValue(p as Arm));
    const spMen = armsHere.filter((p) => p.role === 'SP');
    sp += spMen.length;
    spLabelled += avg(spMen.sort((x, y) => armValue(y) - armValue(x)).slice(0, t.rotation.length), (p) => armValue(p as Arm));
    card = {
      lineup: card.lineup + avg(t.lineup, overallOf),
      rotation: card.rotation + avg(t.rotation, (p) => armValue(p as Arm)),
      pen: card.pen + avg(t.bullpen, (p) => armValue(p as Arm)),
      bench: card.bench + avg(t.bench, overallOf),
      men: card.men + new Set([...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen].map((p) => String(p.id))).size,
      teams: card.teams + 1,
    };
  }
  let pa = 0, paSum = 0, paWalk = 0;
  for (const [id, line] of season.batting) {
    const p = bats.get(String(id));
    if (!p) continue;
    const n = line.ab + line.bb + line.hbp + (line.sf ?? 0) + (line.sh ?? 0);
    pa += n; paSum += n * overallOf(p);
    if (p.walkOn) paWalk += n;
  }
  let outs = 0, outSum = 0, outWalk = 0;
  for (const [id, line] of season.pitching) {
    const p = arms.get(String(id));
    if (!p) continue;
    outs += line.outs; outSum += line.outs * armValue(p);
    if (p.walkOn) outWalk += line.outs;
  }
  const k = card.teams;
  // Where the walk-ons stand, by the spot they were found for.
  const woBy = new Map<string, number>();
  for (const rec of season.teams) {
    for (const p of [...rec.team.lineup, ...rec.team.bench, ...rec.team.rotation, ...rec.team.bullpen]) {
      if (!p.walkOn) continue;
      const key = p.type === 'pitcher' ? (p as { role: string }).role : (p as { pos: string }).pos;
      woBy.set(key, (woBy.get(key) ?? 0) + 1);
    }
  }
  const woLine = [...woBy.entries()].sort((a, b) => b[1] - a[1]).map(([k2, n]) => `${k2}:${n}`).join(' ');
  return `  walk-ons by spot  ${woLine}
  arms   best four by value ${(best4 / k).toFixed(1)}  best four SP-labelled ${(spLabelled / k).toFixed(1)}  SP-labelled per roster ${(sp / k).toFixed(1)}
  card   lineup ${(card.lineup / k).toFixed(1)}  rotation ${(card.rotation / k).toFixed(1)}`
    + `  pen ${(card.pen / k).toFixed(1)}  bench ${(card.bench / k).toFixed(1)}  roster ${(card.men / k).toFixed(1)}`
    + `   played  bats ${(paSum / Math.max(1, pa)).toFixed(2)} (walk-on PA ${(100 * paWalk / Math.max(1, pa)).toFixed(1)}%)`
    + `  arms ${(outSum / Math.max(1, outs)).toFixed(2)} (walk-on outs ${(100 * outWalk / Math.max(1, outs)).toFixed(1)}%)`;
}

/** One programme, one line: what it was built at and what it holds. */
function byTeam(season: SeasonState): void {
  const rows = [...season.teams].sort((a, b) => b.def.quality - a.def.quality);
  console.log('  abbr  qual prest  men  wo   FR   SO   JR   SR  |  FRsig/n  lineup  rot   pen  bench');
  for (const rec of rows) {
    const t = rec.team;
    const all = [...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen];
    const men = new Map(all.map((p) => [String(p.id), p]));
    const byClass = (cls: ClassYear): number => [...men.values()].filter((p) => p.classYear === cls).length;
    const wo = [...men.values()].filter((p) => p.walkOn).length;
    const frSigned = [...men.values()].filter((p) => p.classYear === 'FR' && !p.walkOn);
    const avg = (xs: readonly Player[], f: (p: Player) => number): string =>
      xs.length === 0 ? '   -' : (xs.reduce((a, p) => a + f(p), 0) / xs.length).toFixed(1).padStart(5);
    console.log(
      `  ${rec.def.abbr.padEnd(5)} ${String(rec.def.quality).padStart(3)}  ${String(Math.round(rec.prestige)).padStart(3)}`
      + `  ${String(men.size).padStart(3)}  ${String(wo).padStart(2)}`
      + `  ${String(byClass('FR')).padStart(3)}  ${String(byClass('SO')).padStart(3)}  ${String(byClass('JR')).padStart(3)}  ${String(byClass('SR')).padStart(3)}`
      + `  | ${avg(frSigned, overallOf)}/${String(frSigned.length).padStart(2)}  ${avg(t.lineup, overallOf)}  ${avg(t.rotation, (p) => armValue(p as Arm))}`
      + `  ${avg(t.bullpen, (p) => armValue(p as Arm))}  ${avg(t.bench, overallOf)}`,
    );
  }
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
  const seed = SEED + w * 7919;
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
    console.log(played(season));
    {
      const ps = season.teams.map((rec) => rec.prestige);
      const pm = ps.reduce((a, b) => a + b, 0) / ps.length;
      const psd = Math.sqrt(ps.reduce((a, b) => a + (b - pm) * (b - pm), 0) / ps.length);
      const qs = season.teams.map((rec) => rec.team.quality);
      const qm = qs.reduce((a, b) => a + b, 0) / qs.length;
      console.log(`  prestige ${pm.toFixed(1)} sd ${psd.toFixed(1)}   quality ${qm.toFixed(1)}`);
    }
    if (BY_TEAM) byTeam(season);
    if (y === YEARS) break;
    season = headlessYear(season, 0, runPostseason(season));
  }
}
