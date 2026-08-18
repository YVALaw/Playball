// game.js
// Nine innings. Baserunning, errors, steals, pitching changes, box score,
// and readable text play by play.

import { ENGINES } from './engines.js';
import { fatigueMultiplier, mult, clamp } from './ratings.js';

const ORD = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th','13th','14th','15th'];

const blankHit = () => ({ ab: 0, r: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, bb: 0, k: 0, hbp: 0, sb: 0, cs: 0 });
const blankPit = () => ({ outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, pitches: 0, bf: 0 });

class TeamState {
  constructor(team) {
    this.team = team;
    this.order = team.lineup.slice(0, 9);
    this.spot = 0;
    this.runs = 0; this.hits = 0; this.errors = 0;
    this.lineScore = [];
    this.pitcher = team.rotation[0];
    this.penIndex = 0;
    this.pitcherPitches = 0;
    this.batting = new Map();
    this.pitching = new Map();
    this.timesThrough = new Map();
    this.defense = team.lineup.reduce((a, p) => a + p.fielding, 0) / team.lineup.length;
  }
  hitLine(p) {
    if (!this.batting.has(p.name)) this.batting.set(p.name, { player: p, ...blankHit() });
    return this.batting.get(p.name);
  }
  pitchLine(p) {
    if (!this.pitching.has(p.name)) this.pitching.set(p.name, { player: p, ...blankPit() });
    return this.pitching.get(p.name);
  }
  nextBatter() {
    const b = this.order[this.spot];
    this.spot = (this.spot + 1) % 9;
    return b;
  }
}

export function simGame(homeTeam, awayTeam, rng, opts = {}) {
  const engine = ENGINES[opts.engine ?? 'log5'];
  const verbose = opts.verbose ?? false;
  const log = [];
  const say = (s) => { if (verbose) log.push(s); };

  const home = new TeamState(homeTeam);
  const away = new TeamState(awayTeam);

  let inning = 1;
  let over = false;

  while (!over) {
    for (const half of ['top', 'bottom']) {
      if (half === 'bottom' && inning >= 9 && home.runs > away.runs) { over = true; break; }
      const bat = half === 'top' ? away : home;
      const fld = half === 'top' ? home : away;

      say(`\n--- ${half === 'top' ? 'Top' : 'Bottom'} ${ORD[inning - 1]} --- (${away.runs}-${home.runs})`);
      const before = bat.runs;
      playHalfInning(bat, fld, inning, engine, rng, say, opts);
      bat.lineScore.push(bat.runs - before);

      if (half === 'top' && inning >= 9 && home.runs > away.runs) { over = true; break; }
      if (half === 'bottom' && inning >= 9 && home.runs !== away.runs) { over = true; break; }
      if (opts.runRule !== false && inning >= 7 && Math.abs(home.runs - away.runs) >= 10) { over = true; break; }
    }
    inning++;
    if (inning > 18) over = true;
  }

  return { home, away, innings: inning - 1, log };
}

function playHalfInning(bat, fld, inning, engine, rng, say, opts) {
  let outs = 0;
  const bases = [null, null, null];
  const blame = new Map();   // runner -> pitcher who allowed him on

  const addOuts = (n) => { outs += n; fld.pitchLine(fld.pitcher).outs += n; };

  while (outs < 3) {
    maybeChangePitcher(fld, say);
    const pitcher = fld.pitcher;
    const batter = bat.nextBatter();
    const bLine = bat.hitLine(batter);
    const pLine = fld.pitchLine(pitcher);

    maybeSteal(bases, bat, fld, rng, say);

    const fatigueMult = fatigueMultiplier(pitcher, fld.pitcherPitches);
    const tto = (fld.timesThrough.get(batter.name) ?? 0) + 1;
    fld.timesThrough.set(batter.name, tto);

    const ctx = {
      runnersOn: bases.some(Boolean),
      timesThrough: tto,
      fatigueMult,
      defenseMult: mult(fld.defense, -0.12),
    };

    const pa = engine(batter, pitcher, ctx, rng);
    fld.pitcherPitches += pa.pitches.length;
    pLine.pitches += pa.pitches.length;
    pLine.bf++;

    const hand = `${batter.bats} vs ${pitcher.throws}HP`;
    const cnt = describeCount(pa.pitches);
    const scored = [];

    let event = pa.event;
    let errored = false;
    if (event === 'out' && pa.kind !== 'strikeout') {
      if (rng() < 0.055 * mult(fld.defense, -0.55)) { event = 'error'; errored = true; }
    }

    switch (event) {
      case 'walk':
        bLine.bb++; pLine.bb++;
        forceAdvance(bases, batter, scored, blame, pitcher);
        say(`${cnt} ${batter.name} walks. (${hand})`);
        break;
      case 'hbp':
        bLine.hbp++;
        forceAdvance(bases, batter, scored, blame, pitcher);
        say(`${cnt} ${batter.name} is hit by the pitch.`);
        break;
      case 'error':
        bLine.ab++; fld.errors++;
        advanceOnHit(bases, batter, 1, rng, scored, blame, pitcher);
        say(`${cnt} ${batter.name} reaches on an error by the defense.`);
        break;
      case 'single':
        bLine.ab++; bLine.h++; bat.hits++; pLine.h++;
        advanceOnHit(bases, batter, 1, rng, scored, blame, pitcher);
        say(`${cnt} ${batter.name} singles${scored.length ? `, ${scored.length} in` : ''}. (${hand})`);
        break;
      case 'double':
        bLine.ab++; bLine.h++; bLine.d++; bat.hits++; pLine.h++;
        advanceOnHit(bases, batter, 2, rng, scored, blame, pitcher);
        say(`${cnt} ${batter.name} doubles${scored.length ? `, ${scored.length} in` : ''}. (${hand})`);
        break;
      case 'triple':
        bLine.ab++; bLine.h++; bLine.t++; bat.hits++; pLine.h++;
        advanceOnHit(bases, batter, 3, rng, scored, blame, pitcher);
        say(`${cnt} ${batter.name} triples into the gap${scored.length ? `, ${scored.length} in` : ''}.`);
        break;
      case 'homerun':
        bLine.ab++; bLine.h++; bLine.hr++; bat.hits++; pLine.h++; pLine.hr++;
        advanceOnHit(bases, batter, 4, rng, scored, blame, pitcher);
        say(`${cnt} ${batter.name} HOMERS to deep left${scored.length > 1 ? `, ${scored.length} run shot` : ''}. (${hand})`);
        break;
      default: {
        bLine.ab++;
        if (pa.kind === 'strikeout') {
          bLine.k++; pLine.k++;
          addOuts(1);
          const looking = pa.pitches[pa.pitches.length - 1] === 'called';
          say(`${cnt} ${batter.name} strikes out ${looking ? 'looking' : 'swinging'}.`);
        } else {
          const res = resolveOut(bases, batter, pa.kind, outs, rng, scored, blame, pitcher);
          addOuts(res.outs);
          say(`${cnt} ${batter.name} ${res.text}`);
        }
      }
    }

    // Credit runs to the runners who scored and to the pitchers responsible.
    for (const runner of scored) {
      bat.hitLine(runner).r++;
      const guilty = blame.get(runner) ?? pitcher;
      const gl = fld.pitchLine(guilty);
      gl.r++;
      if (!errored) gl.er++;
    }
    bat.runs += scored.length;
    bLine.rbi += errored ? 0 : scored.length;

    if (outs >= 3) break;
  }
}

function describeCount(pitches) {
  let b = 0, s = 0;
  for (const p of pitches.slice(0, -1)) {
    if (p === 'ball') b++;
    else if (p === 'foul') { if (s < 2) s++; }
    else if (p === 'called' || p === 'swinging') s++;
  }
  return `[${b}-${s} ${pitches.length}p]`;
}

function forceAdvance(bases, batter, scored, blame, pitcher) {
  if (bases[0] && bases[1] && bases[2]) { scored.push(bases[2]); bases[2] = null; }
  if (bases[0] && bases[1]) { bases[2] = bases[1]; bases[1] = null; }
  if (bases[0]) { bases[1] = bases[0]; bases[0] = null; }
  bases[0] = batter;
  blame.set(batter, pitcher);
}

function advanceOnHit(bases, batter, numBases, rng, scored, blame, pitcher) {
  for (let i = 2; i >= 0; i--) {
    const runner = bases[i];
    if (!runner) continue;
    let adv = numBases;
    if (numBases === 1 && i === 1) adv = rng() < clamp(0.63 * mult(runner.speed, 0.35), 0.20, 0.94) ? 2 : 1;
    else if (numBases === 1 && i === 0) adv = rng() < clamp(0.31 * mult(runner.speed, 0.45), 0.06, 0.75) ? 2 : 1;
    else if (numBases === 2 && i === 0) adv = rng() < clamp(0.55 * mult(runner.speed, 0.35), 0.18, 0.92) ? 3 : 2;
    const dest = i + adv;
    bases[i] = null;
    if (dest >= 3) scored.push(runner);
    else bases[dest] = runner;
  }
  if (numBases >= 4) { scored.push(batter); blame.set(batter, pitcher); }
  else { bases[numBases - 1] = batter; blame.set(batter, pitcher); }
}

function resolveOut(bases, batter, kind, outs, rng, scored, blame, pitcher) {
  if (kind === 'ground' && bases[0] && outs < 2) {
    if (rng() < clamp(0.36 * mult(batter.speed, -0.40), 0.08, 0.62)) {
      if (bases[2] && rng() < 0.55) { scored.push(bases[2]); bases[2] = null; }
      bases[0] = null;
      if (bases[1] && !bases[2]) { bases[2] = bases[1]; bases[1] = null; }
      return { outs: 2, text: 'grounds into a double play.' };
    }
    if (rng() < 0.45) {
      bases[0] = batter;
      blame.set(batter, pitcher);
      return { outs: 1, text: "reaches on a fielder's choice." };
    }
  }
  if ((kind === 'fly' || kind === 'line') && bases[2] && outs < 2) {
    if (rng() < (kind === 'fly' ? 0.62 : 0.18)) {
      scored.push(bases[2]); bases[2] = null;
      return { outs: 1, text: 'lifts a sacrifice fly, run scores.' };
    }
  }
  if (kind === 'ground' && bases[1] && !bases[0] && rng() < 0.35) {
    bases[2] = bases[1]; bases[1] = null;
    return { outs: 1, text: 'grounds out to the right side, runner moves up.' };
  }
  const text = { ground: 'grounds out.', fly: 'flies out.', line: 'lines out.', popup: 'pops out.' }[kind] ?? 'is retired.';
  return { outs: 1, text };
}

function maybeSteal(bases, bat, fld, rng, say) {
  const runner = bases[0];
  if (!runner || bases[1]) return;
  const attempt = clamp(0.11 * mult(runner.speed, 1.1) * mult(fld.pitcher.holdRunners, -0.35), 0, 0.55);
  if (rng() >= attempt) return;
  const success = clamp(0.70 * mult(runner.speed, 0.30) * mult(fld.pitcher.holdRunners, -0.15), 0.30, 0.94);
  const line = bat.hitLine(runner);
  if (rng() < success) { bases[0] = null; bases[1] = runner; line.sb++; say(`   ${runner.name} steals second.`); }
  else { bases[0] = null; line.cs++; say(`   ${runner.name} is caught stealing.`); }
}

function maybeChangePitcher(fld, say) {
  const p = fld.pitcher;
  const budget = 30 + p.stamina * 0.85;
  const line = fld.pitchLine(p);
  const gassed = fld.pitcherPitches > budget + 12;
  const shelled = line.er >= 6 && fld.pitcherPitches > 35;
  if (!gassed && !shelled) return;
  if (fld.penIndex >= fld.team.bullpen.length) return;
  const next = fld.team.bullpen[fld.penIndex++];
  fld.pitcher = next;
  fld.pitcherPitches = 0;
  say(`   Pitching change: ${next.name} (${next.throws}HP) enters.`);
}

export function boxScore(result) {
  const { home, away } = result;
  const out = [];
  const pad = (s, n) => String(s).padEnd(n);
  const num = (s, n) => String(s).padStart(n);

  out.push('');
  out.push('FINAL' + (result.innings > 9 ? ` (${result.innings})` : ''));
  out.push(`${pad(away.team.name, 24)} ${num(away.runs, 3)}R ${num(away.hits, 3)}H ${num(away.errors, 2)}E`);
  out.push(`${pad(home.team.name, 24)} ${num(home.runs, 3)}R ${num(home.hits, 3)}H ${num(home.errors, 2)}E`);

  for (const side of [away, home]) {
    out.push('');
    out.push(`${side.team.name} batting`);
    out.push(`${pad('', 26)}${num('AB',3)}${num('R',3)}${num('H',3)}${num('RBI',5)}${num('BB',4)}${num('K',3)}`);
    for (const r of side.batting.values()) {
      out.push(`${pad(`${r.player.name} ${r.player.pos} (${r.player.bats})`, 26)}${num(r.ab,3)}${num(r.r,3)}${num(r.h,3)}${num(r.rbi,5)}${num(r.bb,4)}${num(r.k,3)}`);
    }
    out.push(`${side.team.name} pitching`);
    out.push(`${pad('', 26)}${num('IP',5)}${num('H',3)}${num('R',3)}${num('ER',4)}${num('BB',4)}${num('K',3)}${num('P',5)}`);
    for (const r of side.pitching.values()) {
      out.push(`${pad(`${r.player.name} (${r.player.throws}HP)`, 26)}${num(`${Math.floor(r.outs/3)}.${r.outs%3}`,5)}${num(r.h,3)}${num(r.r,3)}${num(r.er,4)}${num(r.bb,4)}${num(r.k,3)}${num(r.pitches,5)}`);
    }
  }
  return out.join('\n');
}
