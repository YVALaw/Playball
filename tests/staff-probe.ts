// staff-probe.ts
// What an assistant is actually worth on the field, measured.
//
// Asked directly: "do these facilities and hirings really affect the game?"
// The answer has to be a number, not an assertion — the coach-skill channel
// was sized deliberately small in stage 7 and the staff stacks on it, so the
// honest question is how many runs a season the stack buys.
//
//   npx tsx tests/staff-probe.ts

import { createSeason } from '../src/engine/season.js';
import { simGame } from '../src/engine/game.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { withStaff, marketFor } from '../src/engine/economy.js';

const GAMES = 12000;

const world = createSeason(makeRng(20260831), undefined, CONFERENCES);
const a = world.teams[10]!.team;
const b = world.teams[40]!.team;

const skills = { offense: 25, defense: 25, training: 25, recruiting: 25 };
const staff = {
  hitting: marketFor('probe', 2027, 'hitting')[0]!,
  pitching: marketFor('probe', 2027, 'pitching')[0]!,
  recruiting: marketFor('probe', 2027, 'recruiting')[0]!,
};
const staffed = withStaff(skills, staff);
console.log('staff ratings:', staff.hitting.rating, staff.pitching.rating, '->', staffed);

function runsFor(mods: { offense: number; defense: number } | undefined): [number, number] {
  const rng = makeRng(777);
  let forRuns = 0;
  let against = 0;
  for (let i = 0; i < GAMES; i++) {
    const r = simGame(a, b, rng, {
      homeStarter: i % 4,
      awayStarter: i % 4,
      ...(mods ? { homeCoachMods: mods } : {}),
    });
    forRuns += r.home.runs;
    against += r.away.runs;
  }
  return [forRuns / GAMES, against / GAMES];
}

// Channel isolation at the extremes first: sign and scale, or nothing else
// matters.
const [, da] = runsFor({ offense: 20, defense: 20 });
const [, db] = runsFor({ offense: 20, defense: 99 });
console.log(`defense 20 vs 99 : runs against ${da.toFixed(3)} -> ${db.toFixed(3)}`
  + ` (${(((db - da) / da) * 100).toFixed(2)}%)`);
const [oa] = runsFor({ offense: 20, defense: 20 });
const [ob] = runsFor({ offense: 99, defense: 20 });
console.log(`offense 20 vs 99 : runs for ${oa.toFixed(3)} -> ${ob.toFixed(3)}`
  + ` (${(((ob - oa) / oa) * 100).toFixed(2)}%)`);

const [f1, a1] = runsFor({ offense: skills.offense, defense: skills.defense });
const [f2, a2] = runsFor({ offense: staffed.offense, defense: staffed.defense });
console.log(`bare coach 25  : ${f1.toFixed(3)} for, ${a1.toFixed(3)} against`);
console.log(`with the staff : ${f2.toFixed(3)} for, ${a2.toFixed(3)} against`);
console.log(`staff effect   : ${(((f2 - f1) / f1) * 100).toFixed(2)}% runs for, `
  + `${(((a2 - a1) / a1) * 100).toFixed(2)}% runs against`);
console.log(`per 45 games   : ${((f2 - f1) * 45).toFixed(1)} runs gained, `
  + `${((a1 - a2) * 45).toFixed(1)} runs saved`);
