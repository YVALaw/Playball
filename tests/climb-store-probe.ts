// climb-store-probe.ts
// How long a low-star programme takes to climb, measured through the store.
//
// The second attempt. The first (`climb-probe.ts`) reassembled the offseason out
// of engine parts and so never signed a recruit -- `aiTargets` and `closeWeek`
// live in the store and nothing else calls them -- which meant every programme
// in the country played thirty seasons with a walk-on roster. Everything read
// off it was an artefact.
//
// The check that catches that class of mistake, and the reason it is written
// down here: **change an input and confirm the output moves**. Raising
// `PIPELINE_EDGE` by eighty percent changed not one digit of the old harness,
// which is only possible if recruiting was not running. This file asserts the
// opposite up front -- it prints how many men the coached programme signs each
// year, and if that number is ever zero the measurement is void.
//
//   npx tsx tests/climb-store-probe.ts
//
// Saving touches IndexedDB, which node does not have. The store already treats
// a failed save as a surfaced error rather than a crash, so those rejections
// land in `saveState` and are ignored, exactly as `store.test.ts` does.

import { useDynasty, PHASES } from '../src/state/store.js';
import { simSeason, seasonComplete } from '../src/engine/season.js';
import { runPostseason } from '../src/engine/postseason.js';
import { prestigeStars } from '../src/engine/program.js';
import {
  RECRUITING_WEEKS, aiTargets, leadersAtWeekStart,
} from '../src/engine/recruiting.js';
import { pitchFor, developmentScore } from '../src/engine/pitch.js';
import { CONFERENCES } from '../src/data/schools.js';

/*
  Recruit the coached programme the way the other ninety-five are recruited.

  The store's weekly pass reads `prospect.spent[userTeam]` for your programme
  and `aiTargets` for everybody else -- deliberately, because working the board
  is the player's job. Which means a headless walk gives your programme *no*
  recruiting at all: not a competent baseline, but a coach who never opens the
  screen, and the worst career in the country by construction.

  So this spends your budget on the same targets the same function would pick
  for a rival at your standing. What it measures is therefore "a programme run
  by the automatic staff every other programme gets" -- the floor a real player
  should beat, which is the number actually worth knowing.
*/
function recruitLikeAStaff(me: number): void {
  const st = useDynasty.getState();
  const season = st.season;
  const rec = season?.teams[me];
  if (!season || !rec) return;
  const conf = CONFERENCES.find((c) => c.id === rec.conference);
  const pitch = pitchFor(season, rec, conf?.region ?? 'Gulf', developmentScore(rec));
  const holes = rec.team.lineup.length + rec.team.bench.length
    + rec.team.rotation.length + rec.team.bullpen.length;
  const targets = aiTargets(
    me, pitch, st.coach.prestige, season.recruiting.prospects,
    Math.max(0, 23 - holes), season.rng, leadersAtWeekStart(season.recruiting), 0,
  );
  for (const { prospect, actions } of targets) {
    useDynasty.getState().recruit(prospect.id, actions);
  }
}

const YEARS = Number(process.env.YEARS ?? 24);
const WORLDS = Number(process.env.WORLDS ?? 6);
const START_STARS = Number(process.env.STARS ?? 1);

process.on('unhandledRejection', () => { /* IndexedDB saves, see the header */ });

/** The weakest programme at the rung being asked about. */
function pick(stars: number): number {
  const season = useDynasty.getState().season!;
  const at = season.teams.filter((t) => prestigeStars(t.prestige) === stars);
  const pool = at.length > 0 ? at : season.teams;
  let worst = pool[0]!.index;
  for (const t of pool) if (t.prestige < season.teams[worst]!.prestige) worst = t.index;
  return worst;
}

const rows: string[] = [];
let anySigned = 0;

for (let w = 0; w < WORLDS; w++) {
  const seed = 4000 + w * 53;

  // Start once to see the world, then restart on the programme we want.
  useDynasty.getState().start(seed, 0);
  const me = pick(START_STARS);
  useDynasty.getState().start(seed, me);

  const stars = prestigeStars(useDynasty.getState().season!.teams[me]!.prestige);
  const ladder: number[] = [];
  const wins: number[] = [];
  const signings: number[] = [];
  let title: number | null = null;
  let omaha: number | null = null;

  for (let y = 1; y <= YEARS; y++) {
    const s = useDynasty.getState();
    const season = s.season!;

    while (!seasonComplete(season)) simSeason(season);
    ladder.push(Math.round(season.teams[me]!.prestige));
    wins.push(season.teams[me]!.w);

    // June, off the engine, then handed to the store so the board can grade it.
    const post = runPostseason(season);
    useDynasty.setState({ lastPostseason: post, phase: 'awards', furthestPhase: 0 });
    if (post.champion === me) { title = y; break; }
    const finish = post.finish[me] ?? 'missed';
    if (omaha === null && ['omaha', 'runner-up', 'champion'].includes(finish)) omaha = y;

    // The offseason, one step at a time, exactly as a player walks it -- which
    // is what makes the recruiting weeks actually run.
    for (let guard = 0; guard < 12; guard++) {
      const at = useDynasty.getState().phase;
      if (at === null) break;
      if (at === 'recruiting') {
        for (let week = 0; week < RECRUITING_WEEKS; week++) {
          recruitLikeAStaff(me);
          useDynasty.getState().advanceRecruitingWeek();
        }
      }
      // eslint-disable-next-line no-await-in-loop
      await useDynasty.getState().nextPhase();
      if (useDynasty.getState().phase === at) break;   // it refused to move
    }
    /*
      What actually arrived, which roster size cannot tell you.

      The first version counted men on the roster and always got twenty-three,
      because `fillRosters` builds to exactly nine, four, four and six every
      year -- a signed class and an empty one produce the same number. That is
      the same shape of mistake as the harness this file replaces: measuring a
      quantity that cannot move.

      `lastOffseason.signed` is the class that actually turned up.
    */
    signings.push(useDynasty.getState().lastOffseason?.signed?.length ?? 0);
  }

  anySigned += signings.reduce((a, b) => a + b, 0);
  const at = (y: number): string =>
    String(ladder[y - 1] ?? ladder[ladder.length - 1] ?? 0).padStart(2);
  const avg = (a: number[]): number =>
    (a.length ? Math.round(a.reduce((x, y2) => x + y2, 0) / a.length) : 0);
  rows.push(
    `world ${seed}  ${stars}*  `
    + `prestige y1 ${at(1)} y5 ${at(5)} y10 ${at(10)} y${YEARS} ${at(YEARS)}  `
    + `avg wins ${String(avg(wins)).padStart(2)}  `
    + `signed/yr ${String(avg(signings)).padStart(2)}  `
    + `Omaha ${omaha === null ? ' -' : String(omaha).padStart(2)}  `
    + `title ${title === null ? ' -' : String(title).padStart(2)}`,
  );
  console.log(rows[rows.length - 1]);
}

console.log('');
console.log(`${WORLDS} careers at a ${START_STARS}-star programme, ${YEARS} seasons each`);
if (anySigned === 0) {
  console.log('  *** VOID: nobody signed anybody. Recruiting is not running. ***');
} else {
  console.log(`  recruiting is live (${anySigned} recruits signed across the run)`);
}
