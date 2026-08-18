#!/usr/bin/env node
// sim.js
// Usage:
//   node sim.js game                    play one game with text play by play
//   node sim.js calibrate --n 2000      league totals vs real D1 targets
//   node sim.js compare --n 2000        run both engines side by side
//   node sim.js platoon --n 20000       verify the handedness effect is real
//   node sim.js parity --n 1000         how often does the better team win

import { makeRng, makeTeam } from './src/players.js';
import { simGame, boxScore } from './src/game.js';
import { ENGINES } from './src/engines.js';
import { makeHitter, makePitcher } from './src/players.js';

const args = process.argv.slice(2);
const cmd = args[0] ?? 'game';
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const strFlag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};

// Real NCAA Division I reference points.
const TARGETS = {
  'Runs per team per game': 6.79,
  'PA per team per game': 41.0,
  'Batting average': 0.290,
  'On base percentage': 0.372,
  'Home runs per team per game': 0.90,
  'Strikeouts per team per game': 8.5,
  'Walks per team per game': 4.3,
  'Pitches per plate appearance': 3.75,
  'Foul share of swings': 0.365,
};

function newTeams(seed) {
  const rng = makeRng(seed);
  return {
    rng,
    a: makeTeam(rng, 'Ridgemont State Ravens', 52),
    b: makeTeam(rng, 'Callahan Tech Miners', 50),
  };
}

function accumulate(acc, side) {
  for (const r of side.batting.values()) {
    acc.ab += r.ab; acc.h += r.h; acc.hr += r.hr; acc.d += r.d; acc.t += r.t;
    acc.bb += r.bb; acc.k += r.k; acc.hbp += r.hbp; acc.sb += r.sb; acc.cs += r.cs;
  }
  for (const r of side.pitching.values()) {
    acc.pitches += r.pitches; acc.bf += r.bf; acc.outs += r.outs;
  }
  acc.runs += side.runs;
  acc.errors += side.errors;
  acc.teamGames += 1;
}

function blankAcc() {
  return { ab:0,h:0,hr:0,d:0,t:0,bb:0,k:0,hbp:0,sb:0,cs:0,runs:0,errors:0,pitches:0,bf:0,outs:0,teamGames:0 };
}

function report(acc, label) {
  const g = acc.teamGames;
  const pa = acc.bf;
  const avg = acc.h / acc.ab;
  const obp = (acc.h + acc.bb + acc.hbp) / pa;
  const tb = (acc.h - acc.d - acc.t - acc.hr) + acc.d * 2 + acc.t * 3 + acc.hr * 4;
  const slg = tb / acc.ab;
  const rows = {
    'Runs per team per game': acc.runs / g,
    'PA per team per game': pa / g,
    'Batting average': avg,
    'On base percentage': obp,
    'Home runs per team per game': acc.hr / g,
    'Strikeouts per team per game': acc.k / g,
    'Walks per team per game': acc.bb / g,
    'Pitches per plate appearance': acc.pitches / pa,
  };
  console.log(`\n=== ${label} ===`);
  console.log('metric'.padEnd(32) + 'sim'.padStart(8) + 'target'.padStart(9) + '   diff');
  for (const [k, v] of Object.entries(rows)) {
    const t = TARGETS[k];
    const fmt = (x) => (Math.abs(x) < 1 ? x.toFixed(3) : x.toFixed(2));
    const diff = t ? (((v - t) / t) * 100).toFixed(0) + '%' : '';
    const alert = t && Math.abs((v - t) / t) > 0.10 ? '  <-- off' : '';
    console.log(k.padEnd(32) + fmt(v).padStart(8) + (t ? fmt(t).padStart(9) : ''.padStart(9)) + diff.padStart(7) + alert);
  }
  console.log('Slugging'.padEnd(32) + slg.toFixed(3).padStart(8));
  console.log('Errors per team per game'.padEnd(32) + (acc.errors / g).toFixed(2).padStart(8));
  console.log('Stolen base pct'.padEnd(32) + (acc.sb / Math.max(1, acc.sb + acc.cs)).toFixed(3).padStart(8));
}

function runSeason(engine, n, seed = 4242) {
  const { rng, a, b } = newTeams(seed);
  const acc = blankAcc();
  for (let i = 0; i < n; i++) {
    const res = simGame(a, b, rng, { engine });
    accumulate(acc, res.home);
    accumulate(acc, res.away);
  }
  return acc;
}

// ---------------------------------------------------------------------------

if (cmd === 'game') {
  const engine = strFlag('engine', 'log5');
  const { rng, a, b } = newTeams(flag('seed', Date.now() % 100000));
  const res = simGame(a, b, rng, { engine, verbose: true });
  console.log(`${b.name} at ${a.name}   [engine: ${engine}]`);
  console.log(res.log.join('\n'));
  console.log(boxScore(res));
}

else if (cmd === 'calibrate') {
  const n = flag('n', 1000);
  const engine = strFlag('engine', 'log5');
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
  const engine = ENGINES[strFlag('engine', 'log5')];
  const rng = makeRng(99);

  const lhb = makeHitter(rng, 60, { bats: 'L', throws: 'L' });
  const rhb = { ...lhb, bats: 'R', throws: 'R' };   // identical bat, opposite hand
  lhb.platoonSkill = 0.09;
  rhb.platoonSkill = 0.045;

  const rhp = makePitcher(rng, 55, { throws: 'R' });
  const lhp = { ...rhp, throws: 'L' };              // identical arm, opposite hand
  rhp.platoonSkill = 0; lhp.platoonSkill = 0;

  const run = (batter, pitcher) => {
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

  const rows = [
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
  const lGap = (rows[0][1].avg - rows[1][1].avg) * 1000;
  const rGap = (rows[2][1].avg - rows[3][1].avg) * 1000;
  console.log(`\nLefty hitter platoon gap: ${lGap.toFixed(0)} points of AVG`);
  console.log(`Righty hitter platoon gap: ${rGap.toFixed(0)} points of AVG`);
  console.log('Both should be positive, and the lefty gap clearly larger.');
}

else if (cmd === 'parity') {
  // Baseball is the least predictable major sport game to game.
  // If the better team wins 85 percent, the engine has too little variance.
  const n = flag('n', 1000);
  const engine = strFlag('engine', 'log5');
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

else {
  console.log('Commands: game | calibrate | compare | platoon | parity');
}
