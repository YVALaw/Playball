// pitch-level-check.ts
// Measures the pitch-by-pitch texture of both engines against LEAGUE_PITCH.
//
// Season stats do not depend on any of this — Engine A fixes the outcome before
// it builds a sequence — but the play by play is what the player actually reads,
// and it was badly wrong until 2026-08-19 (B4). Tune SEQUENCE in ratings.ts
// against this. Run with:
//
//   npx tsx tests/pitch-level-check.ts

import { makeRng, makeTeam, resetNames } from '../src/engine/players.js';
import { ENGINES } from '../src/engine/engines.js';
import { LEAGUE_PITCH } from '../src/engine/ratings.js';
import type { EngineFn, PitchResult } from '../src/engine/types.js';

const STRIKE = new Set<PitchResult>(['called', 'swinging', 'foul', 'inplay']);
const SWING = new Set<PitchResult>(['swinging', 'foul', 'inplay']);

function analyse(name: string, engine: EngineFn, n: number): void {
  resetNames();
  const rng = makeRng(4242);
  const team = makeTeam(rng, 'T', 50);
  const hitters = [...team.lineup, ...team.bench];
  const arms = [...team.rotation, ...team.bullpen];

  let pa = 0, firstPitchStrikes = 0, swings = 0, fouls = 0, misses = 0;
  let count30 = 0, strike30 = 0, pitches = 0;

  for (let i = 0; i < n; i++) {
    const batter = hitters[i % hitters.length];
    const pitcher = arms[i % arms.length];
    if (!batter || !pitcher) throw new Error('empty roster');

    const result = engine(batter, pitcher, { runnersOn: false, timesThrough: 1, fatigueMult: 1 }, rng);
    pa++;

    let balls = 0;
    let strikes = 0;
    result.pitches.forEach((res, idx) => {
      pitches++;
      if (idx === 0 && STRIKE.has(res)) firstPitchStrikes++;
      if (balls === 3 && strikes === 0) { count30++; if (STRIKE.has(res)) strike30++; }
      if (SWING.has(res)) swings++;
      if (res === 'foul') fouls++;
      if (res === 'swinging') misses++;

      if (res === 'ball') balls++;
      else if (res === 'called' || res === 'swinging') strikes++;
      else if (res === 'foul' && strikes < 2) strikes++;
    });
  }

  const row = (label: string, got: number, target: number): void => {
    const diff = ((got / target - 1) * 100).toFixed(0);
    console.log(`  ${label.padEnd(28)}${got.toFixed(3)}   target ${target.toFixed(3)}   ${diff}%`);
  };

  console.log(`\n=== ${name} — ${n} plate appearances ===`);
  row('First pitch strike rate', firstPitchStrikes / pa, LEAGUE_PITCH.firstPitchStrike);
  row('3-0 strike rate', count30 ? strike30 / count30 : 0, LEAGUE_PITCH.strike30);
  row('Foul share of swings', fouls / swings, LEAGUE_PITCH.foulShareOfSwings);
  row('Miss share of swings', misses / swings, LEAGUE_PITCH.missShareOfSwings);
  row('Pitches per PA', pitches / pa, 3.75);
  console.log(`  (3-0 counts observed: ${count30})`);
}

analyse('ENGINE A (log5) — the shipping engine', ENGINES.log5, 200000);
analyse('ENGINE B (pitch) — the comparison engine', ENGINES.pitch, 200000);
