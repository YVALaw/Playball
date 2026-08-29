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

import { createSeason, simSeason, seasonComplete, nextSeason, type SeasonState } from '../src/engine/season.js';
import { runPostseason } from '../src/engine/postseason.js';
import { departAndDevelop, fillRosters } from '../src/engine/progression.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { prestigeStars } from '../src/engine/program.js';
import { openPortal, staffWorksPortal, releaseFrom } from '../src/engine/portal.js';
import { runRivalYear } from '../src/engine/rivals.js';
import { seasonLength } from '../src/engine/season.js';
import type { PostseasonSummary } from '../src/engine/postseason.js';
import { windowBudget } from '../src/engine/recruiting.js';
import { setMood, settleMood, squadRanks } from '../src/engine/morale.js';
import { healUp } from '../src/engine/injury.js';
import { resetWorkload } from '../src/engine/workload.js';
import type { Player } from '../src/engine/types.js';

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

/** One offseason, the way the store runs it, minus the screens. */
function rollYear(season: SeasonState, me: number, post: PostseasonSummary | null): SeasonState {
  /*
    Prestige moves here, and leaving it out invalidated the first two runs.

    `nextPrestige` is only ever called from `reviewSeason`, which the store runs
    for the coached programme, and from `runRivalYear`, which it runs for the
    other ninety-five. This probe called neither -- so every programme in the
    country sat on its opening prestige for thirty seasons and *no* climb was
    possible for anybody, which is not a finding about the game at all.

    It read as one: a one-star programme showed prestige 19 in year one and 19
    in year thirty, ten worlds out of ten. That is exactly what a broken ladder
    would look like, which is why it needed checking rather than believing.
  */
  runRivalYear(season, post, {
    year: season.year ?? 0,
    userTeam: -1,                 // -1 so the coached programme is graded too
    games: seasonLength(season.config),
  });
  const rec = season.teams[me]!;
  const games = rec.w + rec.l;
  const ranks = squadRanks(rec.team);

  // Mood settles against the promise, exactly as the store does it in June.
  for (const p of [...rec.team.lineup, ...rec.team.bench]) {
    setMood(p, settleMood(p, {
      starts: (p as Player & { starts?: number }).starts ?? 0,
      games,
      squadRank: ranks.get(p.id) ?? 20,
      winPct: games > 0 ? rec.w / games : 0.5,
    }));
  }

  /*
    The order matters, and getting it wrong crashes the game.

    The store runs departures on the way into the draft, the portal one step
    later, and `fillRosters` at the year roll -- so the portal empties rosters
    and the refill puts them back. This probe originally called
    `advanceOffseason`, which is both halves at once, and so refilled *before*
    emptying: the next season opened with short rosters and the engine threw
    "Newport Bay Whalers has an empty lineup slot".

    That was the probe's bug rather than the game's, but it is worth the note --
    the two halves are separable for exactly this reason and anything that
    removes players has to sit between them.
  */
  departAndDevelop(season, season.rng, { userTeam: me });

  // The portal, both directions, with every staff shopping it.
  const pool = openPortal(season.teams, {
    year: season.year ?? 0, seed: season.seed ?? 0, games,
  });
  const taken = new Set<string>();
  for (const other of season.teams) {
    const going = pool.filter((m) => !taken.has(String(m.player.id)) && m.from !== other.index);
    if (going.length === 0) break;
    for (const m of staffWorksPortal(other.team, going, windowBudget(prestigeStars(other.prestige)))) {
      taken.add(String(m.player.id));
      const from = season.teams[m.from];
      if (from) releaseFrom(from.team, m.player.id);
    }
  }
  // Anybody unsigned has left college baseball.
  for (const m of pool) {
    if (taken.has(String(m.player.id))) continue;
    const from = season.teams[m.from];
    if (from) releaseFrom(from.team, m.player.id);
  }

  // And now the refill, which repairs every hole the portal just made.
  fillRosters(season, season.rng, { userTeam: me });

  const rolled = nextSeason(season);
  const mine = rolled.teams[me];
  if (mine) {
    for (const p of [...mine.team.lineup, ...mine.team.bench, ...mine.team.rotation, ...mine.team.bullpen]) {
      healUp(p);
      resetWorkload(p);
      delete (p as Player & { outUntil?: number }).outUntil;
      delete (p as Player & { starts?: number }).starts;
    }
  }
  rolled.captureBoxFor = me;
  return rolled;
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
    season = rollYear(season, me, post);
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
