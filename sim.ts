#!/usr/bin/env -S npx tsx
// sim.ts
// Usage:
//   npm run sim -- game                    play one game with text play by play
//   npm run sim -- calibrate --n 2000      league totals vs real D1 targets
//   npm run sim -- compare --n 2000        run both engines side by side
//   npm run sim -- platoon --n 20000       verify the handedness effect is real
//   npm run sim -- parity --n 1000         how often does the better team win

import { makeRng, makeTeam, makeHitter, makePitcher } from './src/engine/players.js';
import { simGame, boxScore } from './src/engine/game.js';
import { ENGINES } from './src/engine/engines.js';
import { TARGETS, metrics, newTeams, runSeason } from './src/engine/calibration.js';
import type { Acc } from './src/engine/calibration.js';
import {
  createSeason, simSeason, standings, rpiOrder, leaders, winPct, conferenceIds,
  DEFAULT_SEASON, type LeaderRow,
} from './src/engine/season.js';
import {
  allConferenceTournaments, stageRegionals, stageNational, seasonAwards,
} from './src/engine/postseason.js';
import { CONFERENCE_NAME, HOME_CONFERENCE } from './src/data/schools.js';
import type { EngineName, Hitter, Pitcher } from './src/engine/types.js';

const args = process.argv.slice(2);
const cmd = args[0] ?? 'game';

const flag = (name: string, def: number): number => {
  const i = args.indexOf(`--${name}`);
  const v = i >= 0 ? args[i + 1] : undefined;
  return v === undefined ? def : Number(v);
};

const strFlag = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`);
  return (i >= 0 ? args[i + 1] : undefined) ?? def;
};

const engineFlag = (def: EngineName = 'log5'): EngineName => {
  const v = strFlag('engine', def);
  return v === 'pitch' ? 'pitch' : 'log5';
};

function report(acc: Acc, label: string): void {
  const m = metrics(acc);
  console.log(`\n=== ${label} ===`);
  console.log('metric'.padEnd(32) + 'sim'.padStart(8) + 'target'.padStart(9) + '   diff');
  for (const [k, v] of Object.entries(m.rows)) {
    const t = TARGETS[k];
    const fmt = (x: number): string => (Math.abs(x) < 1 ? x.toFixed(3) : x.toFixed(2));
    const diff = t ? (((v - t) / t) * 100).toFixed(0) + '%' : '';
    const alert = t && Math.abs((v - t) / t) > 0.10 ? '  <-- off' : '';
    console.log(k.padEnd(32) + fmt(v).padStart(8) + (t ? fmt(t).padStart(9) : ''.padStart(9)) + diff.padStart(7) + alert);
  }
  console.log('Errors per team per game'.padEnd(32) + m.errorsPerGame.toFixed(2).padStart(8));
  console.log('Stolen base pct'.padEnd(32) + m.stolenBasePct.toFixed(3).padStart(8));
}

// ---------------------------------------------------------------------------

if (cmd === 'game') {
  const engine = engineFlag();
  const { rng, a, b } = newTeams(flag('seed', Date.now() % 100000));
  const res = simGame(a, b, rng, { engine, verbose: true });
  console.log(`${b.name} at ${a.name}   [engine: ${engine}]`);
  console.log(res.log.join('\n'));
  console.log(boxScore(res));
}

else if (cmd === 'calibrate') {
  const n = flag('n', 1000);
  const engine = engineFlag();
  report(runSeason(engine, n), `${engine} engine, ${n} games`);
}

else if (cmd === 'compare') {
  const n = flag('n', 1000);
  report(runSeason('log5', n), `ENGINE A: log5, ${n} games`);
  report(runSeason('pitch', n), `ENGINE B: free pitch, ${n} games`);
}

else if (cmd === 'platoon') {
  // Same two hitters, same two pitchers. Only the handedness pairing changes,
  // so any difference is the platoon model and nothing else.
  const n = flag('n', 20000);
  const engine = ENGINES[engineFlag()];
  const rng = makeRng(99);

  const lhb: Hitter = makeHitter(rng, 60, { bats: 'L', throws: 'L' });
  const rhb: Hitter = { ...lhb, bats: 'R', throws: 'R' };   // identical bat, opposite hand
  lhb.platoonSkill = 0.09;
  rhb.platoonSkill = 0.045;

  const rhp: Pitcher = makePitcher(rng, 55, { throws: 'R' });
  const lhp: Pitcher = { ...rhp, throws: 'L' };             // identical arm, opposite hand
  rhp.platoonSkill = 0; lhp.platoonSkill = 0;

  interface Split { avg: number; slg: number; bb: number; k: number }

  const run = (batter: Hitter, pitcher: Pitcher): Split => {
    let h = 0, ab = 0, bb = 0, k = 0, tb = 0;
    for (let i = 0; i < n; i++) {
      const pa = engine(batter, pitcher, {}, rng);
      if (pa.event === 'walk' || pa.event === 'hbp') { bb++; continue; }
      ab++;
      if (pa.kind === 'strikeout') k++;
      if (pa.event === 'single') { h++; tb += 1; }
      if (pa.event === 'double') { h++; tb += 2; }
      if (pa.event === 'triple') { h++; tb += 3; }
      if (pa.event === 'homerun') { h++; tb += 4; }
    }
    return { avg: h / ab, slg: tb / ab, bb: bb / (ab + bb), k: k / (ab + bb) };
  };

  const rows: Array<[string, Split]> = [
    ['LHB vs RHP (opposite)', run(lhb, rhp)],
    ['LHB vs LHP (same)',     run(lhb, lhp)],
    ['RHB vs LHP (opposite)', run(rhb, lhp)],
    ['RHB vs RHP (same)',     run(rhb, rhp)],
  ];

  console.log(`\n=== Platoon check, ${n} PA per matchup ===`);
  console.log('matchup'.padEnd(24) + 'AVG'.padStart(7) + 'SLG'.padStart(7) + 'BB%'.padStart(7) + 'K%'.padStart(7));
  for (const [label, r] of rows) {
    console.log(label.padEnd(24) + r.avg.toFixed(3).padStart(7) + r.slg.toFixed(3).padStart(7) +
      (r.bb * 100).toFixed(1).padStart(7) + (r.k * 100).toFixed(1).padStart(7));
  }
  const lGap = ((rows[0] as [string, Split])[1].avg - (rows[1] as [string, Split])[1].avg) * 1000;
  const rGap = ((rows[2] as [string, Split])[1].avg - (rows[3] as [string, Split])[1].avg) * 1000;
  console.log(`\nLefty hitter platoon gap: ${lGap.toFixed(0)} points of AVG`);
  console.log(`Righty hitter platoon gap: ${rGap.toFixed(0)} points of AVG`);
  console.log('Both should be positive, and the lefty gap clearly larger.');
}

else if (cmd === 'parity') {
  // Baseball is the least predictable major sport game to game.
  // If the better team wins 85 percent, the engine has too little variance.
  //
  // NOTE (T1 in 04-implementation-plan.md): the 30 point gap below is far wider
  // than the shipped conference produces, and the 95 percent verdict it prints
  // is misleading. At the widest realistic gap of 13 points the better team wins
  // 78.5 percent, which is correct. See tests/parity-sweep.ts for the curve.
  const n = flag('n', 1000);
  const engine = engineFlag();
  const rng = makeRng(7);
  const strong = makeTeam(rng, 'Powerhouse U', 68);
  const weak = makeTeam(rng, 'Bottom Feeder State', 38);
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const res = simGame(strong, weak, rng, { engine });
    if (res.home.runs > res.away.runs) wins++;
  }
  console.log(`\n=== Parity check, ${n} games, ${engine} engine ===`);
  console.log(`Elite team (68 rated) vs weak team (38 rated) beat them ${(wins/n*100).toFixed(1)}% of the time.`);
  console.log('Real college baseball: a dominant team beats a bad team roughly 75 to 85 percent.');
  console.log('If you see 95 percent plus, your rating spread is too wide.');
}

else if (cmd === 'season') {
  const season = createSeason(makeRng(flag('seed', 2027)), {
    ...DEFAULT_SEASON,
    engine: engineFlag(),
  });
  simSeason(season);

  const abbr = (i: number): string => season.teams[i]?.def.abbr ?? '???';
  const school = (i: number): string => season.teams[i]?.def.school ?? '???';
  const conf = (i: number): string => season.teams[i]?.conference ?? '???';
  const home = strFlag('conference', HOME_CONFERENCE);
  const gp = season.teams[0]?.gp ?? 0;

  console.log(`\n=== ${season.teams.length} teams, ${conferenceIds(season).length} conferences, ${gp} games each ===`);
  console.log(`${season.results.length} regular season games played`);

  const table = standings(season, home);
  console.log(`\n=== ${CONFERENCE_NAME} — final standings ===`);
  console.log('    team                 conf     overall   pct    RS   RA  diff  strk');
  table.forEach((t, i) => {
    const diff = t.rs - t.ra;
    console.log(
      String(i + 1).padStart(3) + '  ' +
      `${t.def.abbr} ${t.def.school}`.padEnd(22) +
      `${t.cw}-${t.cl}`.padStart(6) + `${t.w}-${t.l}`.padStart(10) +
      winPct(t).toFixed(3).replace(/^0/, '').padStart(7) +
      String(t.rs).padStart(6) + String(t.ra).padStart(5) +
      (diff > 0 ? `+${diff}` : String(diff)).padStart(6) +
      `${t.streak > 0 ? 'W' : 'L'}${Math.abs(t.streak)}`.padStart(6),
    );
  });

  console.log('\n=== National RPI top 15 ===');
  rpiOrder(season).slice(0, 15).forEach((r, i) => {
    console.log(
      `${String(i + 1).padStart(3)}  ${r.team.def.school.padEnd(22)}${r.team.conference}` +
      `   ${r.rpi.toFixed(4)}   ${r.team.w}-${r.team.l}`,
    );
  });

  // --- conference tournaments: sixteen champions, sixteen automatic bids ---
  const cups = allConferenceTournaments(season);
  console.log('\n=== Conference tournament champions ===');
  for (const cup of cups) {
    const seedOfChamp = cup.seeds.indexOf(cup.champion) + 1;
    console.log(`   ${cup.conference}  ${school(cup.champion).padEnd(24)} (seed ${seedOfChamp})`);
  }

  // --- the regionals: conference champions, paired by region ---
  const regionals = stageRegionals(season, cups);
  console.log('\n=== Regionals ===');
  for (const r of regionals) {
    const a = r.seeds[0] as number;
    const b = r.seeds[1] as number;
    console.log(
      `   ${r.name.padEnd(9)} ${school(a).padEnd(24)} vs ${school(b).padEnd(24)}`
      + ` -> ${school(r.champion)}`,
    );
  }

  // --- the national stage: twenty in, two ten-team brackets, a series ---
  const national = stageNational(season, cups, regionals);
  console.log('\n=== National tournament — twenty team field ===');
  console.log(`   protected: ${national.field.protectedTeams.map(abbr).join(' ')}`);
  console.log(`   bracket A -> ${school(national.bracketA.champion)}`);
  console.log(`   bracket B -> ${school(national.bracketB.champion)}`);
  console.log(`\n   NATIONAL CHAMPION: ${school(national.champion)} (${conf(national.champion)})`);

  // --- how the home conference fared ---
  const homeTeams = season.teams.filter((t) => t.conference === home).map((t) => t.index);
  const gotOut = regionals.flatMap((r) => r.seeds).filter((t) => homeTeams.includes(t));
  console.log(
    `\n${home} out of the conference: `
    + (gotOut.length ? gotOut.map((t) => abbr(t)).join(', ') : 'nobody'),
  );

  console.log('\n=== Awards ===');
  for (const a of seasonAwards(season)) {
    console.log(`   ${a.title.padEnd(22)} ${a.name.padEnd(22)} ${a.team}   ${a.line}`);
  }

  const boards = leaders(season);
  const show = (title: string, rows: LeaderRow[], fmt: (v: number) => string): void => {
    console.log(`\n${title}`);
    for (const r of rows) {
      console.log(`   ${r.name.padEnd(22)} ${r.team}  ${fmt(r.value).padStart(7)}   ${r.detail}`);
    }
  };
  const rate = (v: number): string => v.toFixed(3).replace(/^0/, '');
  console.log('\n=== National leaders (including postseason) ===');
  show('Batting average', boards.average, rate);
  show('Home runs', boards.homeRuns, (v) => String(v));
  show('Earned run average', boards.era, (v) => v.toFixed(2));
  show('Strikeouts', boards.strikeouts, (v) => String(v));
}

else {
  console.log('Commands: game | season | calibrate | compare | platoon | parity');
}
