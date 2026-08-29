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
import { windowBudget } from '../src/engine/recruiting.js';
import { setMood, settleMood, squadRanks } from '../src/engine/morale.js';
import { healUp } from '../src/engine/injury.js';
import { resetWorkload } from '../src/engine/workload.js';
import type { Player } from '../src/engine/types.js';

const YEARS = 30;
const WORLDS = 12;

/** The weakest program in the world, which is the one worth asking about. */
function lowStarTeam(season: SeasonState): number {
  let worst = 0;
  for (const t of season.teams) {
    if (t.prestige < season.teams[worst]!.prestige) worst = t.index;
  }
  return worst;
}

/** One offseason, the way the store runs it, minus the screens. */
function rollYear(season: SeasonState, me: number): SeasonState {
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

  for (let y = 1; y <= YEARS; y++) {
    while (!seasonComplete(season)) simSeason(season);
    const post = runPostseason(season);
    const finish = post.finish[me] ?? 'missed';
    if (RANK.indexOf(finish) > RANK.indexOf(best)) best = finish;
    if (omaha === null && (finish === 'omaha' || finish === 'runner-up' || finish === 'champion')) omaha = y;
    if (post.champion === me) { title = y; break; }
    season = rollYear(season, me);
  }

  firstTitle.push(title);
  firstOmaha.push(omaha);
  bestFinish.push(best);
  console.log(
    `world ${String(seed).padStart(4)}  ${stars}-star  `
    + `first Omaha ${omaha === null ? ' -' : String(omaha).padStart(2)}  `
    + `title ${title === null ? ' -' : String(title).padStart(2)}  best ${best}`,
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
