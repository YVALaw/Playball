// players.js
// Fictional player generation. Ratings are 0 to 100 with 50 as D1 average.

const FIRST = ['Jake','Cole','Tyler','Brady','Mason','Owen','Luke','Gavin','Reese','Chase',
  'Drew','Kade','Blake','Trey','Wyatt','Carson','Beau','Ryder','Nolan','Miles',
  'Diego','Mateo','Elias','Tanner','Hudson','Bryce','Colton','Landon','Griffin','Sawyer',
  'Camden','Jonah','Rhett','Silas','Emmett','Declan','Bennett','Roman','Cash','Zane','Micah','Grant','Wesley','Preston','Finn','Jasper','Dominic','Andres','Rafael','Marcus','Trent','Dallas','Kellan','Brooks','Tate','Holden','Corbin','Easton','Braxton','Rowan','Ezra','Julian','Santiago','Bo','Chance','Peyton','Kyler','Ryland','Dax','Nash'];

const LAST = ['Whitfield','Barrera','Kowalski','Hendren','Vasquez','Mullen','Ashby','Traver',
  'Delgado','Rourke','Kingsley','Pruitt','Salazar','Winslow','Bracken','Oduya','Ferris',
  'Callahan','Marchetti','Redding','Solano','Vance','Hollis','Quintero','Baxley','Nakamura',
  'Ellender','Crowder','Ibarra','Sutcliffe',
  'Thibodeaux','Arrington','Vandermeer','Okafor','Lindqvist','Bellamy','Castellano','Ruvalcaba','Hargrove','Pemberton','Yamashita','Escobedo','Fairbanks','Novotny','Blackwell','Sanderson','Cavanaugh','Montoya','Kirkpatrick','Alvarado','Sheffield','Dunlap','Wexler','Zamora','Hollingsworth','Beauchamp','Trujillo','Stanfield','Aguirre','Lockhart','Duplantis','Merriweather','Osgood','Renteria','Blanchard','Kaminski','Tavares','Whitmore','Grissom','Vaughn','Halloran','Cisneros','Ledbetter','Sunderland','Aldridge','Fontenot','Radcliffe','Ybarra','Chastain','Kirby','Delacroix','Norwood','Pelletier','Strickland','Vandiver','Ashcroft','Guerrero','Hathaway','Mireles','Tillman'];

const POSITIONS = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];
const CLASSES = ['FR','SO','JR','SR'];

export function makeRng(seed = 12345) {
  let s = seed >>> 0;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

// Normal draw, clamped to a rating range.
function normal(rng, mean, sd, lo = 15, hi = 95) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(lo, Math.min(hi, mean + z * sd));
}

function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Handedness distribution roughly matching college baseball.
function drawBats(rng) {
  const r = rng();
  if (r < 0.62) return 'R';
  if (r < 0.92) return 'L';
  return 'S';
}

function drawThrows(rng, bats) {
  // Left handed hitters throw left far more often than the population rate.
  if (bats === 'L') return rng() < 0.62 ? 'L' : 'R';
  if (bats === 'S') return rng() < 0.30 ? 'L' : 'R';
  return rng() < 0.06 ? 'L' : 'R';
}

// Platoon skill: lefties have larger and more variable splits than righties.
// Small share of the distribution goes negative, producing real reverse splits.
function drawPlatoonSkill(rng, bats) {
  if (bats === 'S') return Math.max(0, 0.015 + gauss(rng) * 0.01);
  const mean = bats === 'L' ? 0.090 : 0.045;
  const sd = bats === 'L' ? 0.050 : 0.030;
  return mean + gauss(rng) * sd;
}

// Keep names unique across the whole league so two Rourkes never share a field.
const usedNames = new Set();
export function resetNames() { usedNames.clear(); }
function uniqueName(rng) {
  for (let i = 0; i < 200; i++) {
    const n = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`;
    if (!usedNames.has(n)) { usedNames.add(n); return n; }
  }
  const n = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]} ${usedNames.size}`;
  usedNames.add(n);
  return n;
}

export function makeHitter(rng, quality = 50, opts = {}) {
  const bats = opts.bats ?? drawBats(rng);
  const throws = opts.throws ?? drawThrows(rng, bats);
  return {
    type: 'hitter',
    name: uniqueName(rng),
    pos: opts.pos ?? POSITIONS[Math.floor(rng() * POSITIONS.length)],
    classYear: CLASSES[Math.floor(rng() * CLASSES.length)],
    bats,
    throws,
    platoonSkill: drawPlatoonSkill(rng, bats),
    contact: normal(rng, quality, 12),
    power: normal(rng, quality, 14),
    eye: normal(rng, quality, 12),
    speed: normal(rng, quality, 15),
    fielding: normal(rng, quality, 13),
    arm: normal(rng, quality, 13),
  };
}

export function makePitcher(rng, quality = 50, opts = {}) {
  const throws = opts.throws ?? (rng() < 0.28 ? 'L' : 'R');
  const role = opts.role ?? 'SP';
  const sidearm = throws === 'R' && rng() < 0.08 && role === 'RP';
  return {
    type: 'pitcher',
    name: uniqueName(rng),
    pos: 'P',
    role,
    classYear: CLASSES[Math.floor(rng() * CLASSES.length)],
    bats: throws,
    throws,
    sidearm,
    // Sidearm righties are brutal on righties and vulnerable to lefties.
    // A negative value here means the pitcher amplifies the platoon effect.
    platoonSkill: sidearm ? 0.10 : Math.max(0, gauss(rng) * 0.02),
    stuff: normal(rng, quality + (role === 'RP' ? 4 : 0), 13),
    movement: normal(rng, quality, 12),
    control: normal(rng, quality + (role === 'SP' ? 3 : -2), 13),
    stamina: role === 'SP' ? normal(rng, 68, 12) : normal(rng, 32, 12),
    groundBall: normal(rng, 50, 15),
    holdRunners: normal(rng, quality, 14),
    velocity: Math.round(normal(rng, 89, 3.2, 79, 100)),
    fielding: normal(rng, 48, 12),
    arm: normal(rng, 55, 10),
  };
}

export function makeTeam(rng, name, quality = 50) {
  const lineup = [];
  for (const pos of ['C','1B','2B','3B','SS','LF','CF','RF','DH']) {
    lineup.push(makeHitter(rng, quality + gauss(rng) * 4, { pos }));
  }
  const rotation = [0, 1, 2, 3].map(() => makePitcher(rng, quality + 3, { role: 'SP' }));
  const bullpen = [0, 1, 2, 3, 4, 5].map(() => makePitcher(rng, quality, { role: 'RP' }));
  const bench = [0, 1, 2, 3].map(() => makeHitter(rng, quality - 6));
  return { name, lineup, rotation, bullpen, bench, quality };
}
