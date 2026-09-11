// climb-probe.ts
// How long does it take a bad program to win the whole thing?
//
// Asked directly: take a low-star school and report how many seasons it takes
// to win the nationals. Driven headless rather than through the screens,
// because a played career runs at roughly one offseason a minute and this needs
// a distribution rather than an anecdote — one career that won in year three
// says almost nothing, and one that never won says less.
//
// What this measures, precisely: a two-star program, run by the same automatic
// staff every other program gets, playing out full seasons and postseasons with
// stages 8, 9 and 10 all live. It is the *floor* — a coach who recruits well,
// works the portal and keeps his players happy should beat it, and if he cannot
// then the coaching layers are not worth their screens.
//
//   npx tsx tests/climb-probe.ts

import { createSeason, simSeason, seasonComplete, type SeasonState } from '../src/engine/season.js';
/*
  The year roll this probe was built around now lives beside it, because the
  multi-season calibration guard needs the same one. Two copies of an offseason
  would drift, and the drift would be invisible: both would still run.
*/
import { headlessYear } from './headlessYear.js';
import { runPostseason } from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { prestigeStars } from '../src/engine/program.js';

const YEARS = 30;
const WORLDS = 10;
/*
  Which rung to start on.

  One star is the floor of the country and answers "can the very worst program
  ever win it", which turned out to be no -- nought of twelve reached Omaha in
  thirty years. Two is the useful number, because two is what the job board
  actually offers a new coach: the five openings a rookie sees are two and three
  star programmes, so this is the climb a player really faces.
*/
const START_STARS = Number(process.env.STARS ?? 2);

/** The weakest program at the rung being asked about. */
function lowStarTeam(season: SeasonState): number {
  const at = season.teams.filter((t) => prestigeStars(t.prestige) === START_STARS);
  const pool = at.length > 0 ? at : season.teams;
  let worst = pool[0]!.index;
  for (const t of pool) {
    if (t.prestige < season.teams[worst]!.prestige) worst = t.index;
  }
  return worst;
}

const firstTitle: (number | null)[] = [];
const firstOmaha: (number | null)[] = [];
const bestFinish: string[] = [];

for (let w = 0; w < WORLDS; w++) {
  const seed = 1000 + w * 37;
  let season = createSeason(makeRng(seed), undefined, CONFERENCES);
  const me = lowStarTeam(season);
  season.captureBoxFor = me;
  const stars = prestigeStars(season.teams[me]!.prestige);

  let title: number | null = null;
  let omaha: number | null = null;
  let best = 'missed';
  const RANK = ['missed', 'regional', 'omaha', 'runner-up', 'champion'];
  /*
    The ladder itself, which is the thing actually being asked about.

    A one-star programme is not supposed to sign five-star recruits -- it is
    supposed to *climb*: sign at its level, develop, win more, rise a rung, then
    sign at the new level. So the question is not whether it lands elite men, it
    is whether its prestige moves at all. If this line is flat the ladder is
    broken; if it rises slowly the rate is wrong; and those are different fixes.
  */
  const ladder: number[] = [];
  const wins: number[] = [];

  for (let y = 1; y <= YEARS; y++) {
    while (!seasonComplete(season)) simSeason(season);
    ladder.push(Math.round(season.teams[me]!.prestige));
    wins.push(season.teams[me]!.w);
    const post = runPostseason(season);
    const finish = post.finish[me] ?? 'missed';
    if (RANK.indexOf(finish) > RANK.indexOf(best)) best = finish;
    if (omaha === null && (finish === 'omaha' || finish === 'runner-up' || finish === 'champion')) omaha = y;
    if (post.champion === me) { title = y; break; }
    season = headlessYear(season, me, post);
  }

  firstTitle.push(title);
  firstOmaha.push(omaha);
  bestFinish.push(best);
  const at = (y: number): string => String(ladder[y - 1] ?? ladder[ladder.length - 1] ?? 0).padStart(2);
  const avgWins = wins.length ? Math.round(wins.reduce((a, b) => a + b, 0) / wins.length) : 0;
  console.log(
    `world ${String(seed).padStart(4)}  ${stars}*  `
    + `prestige y1 ${at(1)} y5 ${at(5)} y10 ${at(10)} y20 ${at(20)} y30 ${at(30)}  `
    + `avg wins ${String(avgWins).padStart(2)}  `
    + `Omaha ${omaha === null ? ' -' : String(omaha).padStart(2)}  best ${best}`,
  );
}

const won = firstTitle.filter((x): x is number => x !== null);
const toOmaha = firstOmaha.filter((x): x is number => x !== null);
const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length === 0 ? 0 : s[Math.floor(s.length / 2)]!;
};

console.log('');
console.log(`${WORLDS} careers at the weakest program in the country, ${YEARS} seasons each`);
console.log(`  reached Omaha   ${toOmaha.length}/${WORLDS}, median year ${median(toOmaha) || '-'}`);
console.log(`  won it all      ${won.length}/${WORLDS}, median year ${median(won) || '-'}`);
if (won.length) console.log(`  fastest ${Math.min(...won)}, slowest ${Math.max(...won)}`);
const never = bestFinish.filter((b) => b === 'missed').length;
console.log(`  never made a regional in thirty years: ${never}/${WORLDS}`);

/*
  ---------------------------------------------------------------------------
  KNOWN WRONG — do not read numbers off this file yet
  ---------------------------------------------------------------------------

  This harness walks the engine's offseason directly, and the engine has no
  recruiting driver: `aiTargets` and `closeWeek` live in `state/store.ts` and
  nothing else calls them. So no prospect is ever signed here, `fillRosters`
  refills every roster in the country with walk-ons, and every programme plays
  out thirty seasons with the same replacement-level squad.

  Everything that produced: fourteen wins a year for ever, a prestige line that
  converges to 34 and stops, nobody reaching Omaha. All of it is this bug and
  none of it is a fact about the game.

  The proof, and the check worth stealing: raising `PIPELINE_EDGE` from 0.25 to
  0.45 changed not one digit of the output. An input that cannot move the output
  is not a lever -- it means the thing you think you are measuring is not
  running.

  To make this file honest it has to drive the store the way `store.test.ts`
  does -- `useDynasty.getState().start(...)` and then walk the phases -- rather
  than reassembling the offseason out of engine parts.
*/
