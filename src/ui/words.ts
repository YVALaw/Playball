// words.ts
// The app's words for things, in one place.
//
// The design system's first principle is "say it in words, not codes": a
// screen prints "Pitching Lab", "Sophomore", "Strikeout stuff" and "Pacific",
// never PEN, SO, K/9 or PAC. Every rebuilt screen reads its names from here so
// the same thing is called the same thing everywhere.

import type { Building } from '../engine/economy.js';
import type { ClassYear, Position } from '../engine/types.js';
import { leagueName } from '../engine/leagueNames.js';

/** The three buildings, by their proper names. */
export const FACILITY_NAME: Record<Building, string> = {
  cage: 'Hitting Barn',
  pen: 'Pitching Lab',
  clubhouse: 'Clubhouse',
};

/** A conference by its name, without the word "Conference": "Pacific", "Gulf Coast". */
export function conferenceName(id: string): string {
  return leagueName(id).replace(/\s+Conference$/i, '');
}

export const CLASS_NAME: Record<ClassYear, string> = {
  FR: 'Freshman', SO: 'Sophomore', JR: 'Junior', SR: 'Senior',
};

export const POSITION_NAME: Record<Position | 'SP' | 'RP', string> = {
  C: 'Catcher', '1B': 'First base', '2B': 'Second base', '3B': 'Third base', SS: 'Shortstop',
  LF: 'Left field', CF: 'Center field', RF: 'Right field', DH: 'Designated hitter', P: 'Pitcher',
  SP: 'Starting pitcher', RP: 'Relief pitcher',
};

/** Ratings, as the player card and the staff room both name them. */
export const RATING_NAME: Record<string, string> = {
  contact: 'Contact', power: 'Power', eye: 'Plate discipline', speed: 'Speed',
  fielding: 'Fielding', arm: 'Arm',
  stuff: 'Strikeout stuff', movement: 'Keeps hits down', control: 'Control', stamina: 'Stamina',
};

/** "1 week", "3 weeks". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** 1st, 2nd, 3rd, 11th, 22nd. */
export function ordinal(n: number): string {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  return `${n}${n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`;
}

/** The first name, for a sentence about a person: "Build the Pitching Lab to give Rory projects." */
export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

/** A record with a real dash: 14–2. */
export function recordText(w: number, l: number): string {
  return `${w}–${l}`;
}

const STATE_NAME: Record<string, string> = {
  AL: 'Alabama', AZ: 'Arizona', CA: 'California', CO: 'Colorado', CT: 'Connecticut', FL: 'Florida',
  GA: 'Georgia', IA: 'Iowa', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', KS: 'Kansas', LA: 'Louisiana',
  MA: 'Massachusetts', MI: 'Michigan', MO: 'Missouri', MS: 'Mississippi', MT: 'Montana',
  NC: 'North Carolina', NE: 'Nebraska', NJ: 'New Jersey', NM: 'New Mexico', NV: 'Nevada', NY: 'New York',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', SC: 'South Carolina', TX: 'Texas',
  UT: 'Utah', VA: 'Virginia', WA: 'Washington', WI: 'Wisconsin', WY: 'Wyoming',
};

/** A state by its name: "Texas", not TX. Unknown codes print as themselves. */
export function stateName(code: string): string {
  return STATE_NAME[code] ?? code;
}

/** The first letter up: "expects to start" to "Expects to start". */
export function sentence(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** An engine label set in capitals, in sentence case: "FREE SWINGER" to "Free swinger". */
export function capsWords(s: string): string {
  return sentence(s.toLowerCase());
}

const BOX_WORD: Record<string, [string, string]> = {
  '2B': ['double', 'doubles'], '3B': ['triple', 'triples'], HR: ['home run', 'home runs'],
  RBI: ['RBI', 'RBI'], BB: ['walk', 'walks'], K: ['strikeout', 'strikeouts'], SB: ['steal', 'steals'],
  SF: ['sacrifice fly', 'sacrifice flies'], SH: ['sacrifice bunt', 'sacrifice bunts'],
  H: ['hit', 'hits'], R: ['run', 'runs'], ER: ['earned run', 'earned runs'], WP: ['wild pitch', 'wild pitches'],
  HBP: ['hit by pitch', 'hit by pitches'],
};

/**
 * A box score line in words: "2-4, 1 HR, 3 RBI" reads "2 for 4, 1 home run,
 * 3 RBI"; "6.0 IP, 5 H, 2 ER, 7 K" reads "6.0 innings, 5 hits, 2 earned runs,
 * 7 strikeouts". Anything it does not recognise is left as written.
 */
export function boxLineWords(line: string): string {
  return line.split(', ').map((part) => {
    const hits = part.match(/^(\d+)-(\d+)$/);
    if (hits) return `${hits[1]} for ${hits[2]}`;
    const m = part.match(/^([\d.]+) ([A-Z0-9]+)$/);
    if (!m) return part;
    const [, n, code] = m as unknown as [string, string, string];
    if (code === 'IP') return `${n} innings`;
    const w = BOX_WORD[code];
    if (!w) return part;
    return `${n} ${Number(n) === 1 ? w[0] : w[1]}`;
  }).join(', ');
}

/** Where a man stood in a box score: a position, a pitching role, or how he got in. */
export function boxSlotWords(slot: string): string {
  if (slot === 'SUB') return 'Off the bench';
  if (slot === 'PH') return 'Two-way';
  return POSITION_NAME[slot as keyof typeof POSITION_NAME] ?? slot;
}

/** A professional level in words: "THE SHOW" to "The Show", "SINGLE-A" to "Single-A". */
export function proLevelName(level: string): string {
  if (level === 'THE SHOW') return 'The Show';
  if (level === 'THE DOMINICAN') return 'The Dominican Republic';
  return level.split(' ')
    .map((w, i) => (i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(' ')
    .replace(/-a$/, '-A')
    .replace(/\b(korea|japan|taiwan|italy|mexico|venezuela|colombia|australia|netherlands|rico)\b/g, (x) => x.charAt(0).toUpperCase() + x.slice(1));
}

/** "Bats right · Throws right"; a switch hitter bats both ways. */
export function handsText(bats: string, throws: string): string {
  const b = bats === 'S' ? 'Bats both ways' : bats === 'L' ? 'Bats left' : 'Bats right';
  return `${b} · ${throws === 'L' ? 'Throws left' : 'Throws right'}`;
}

/**
 * Every school code in a sentence the engine wrote, spelled out: "against PAH"
 * reads "against Pahrump Valley". Only codes that belong to a school change.
 */
export function schoolNamesIn(
  text: string,
  teams: ReadonlyArray<{ def: { abbr: string; school: string } }>,
): string {
  const by = new Map(teams.map((t) => [t.def.abbr, t.def.school]));
  return text.replace(/\b[A-Z]{2,4}\b/g, (code) => by.get(code) ?? code);
}

/**
 * A bracket round, in the one set of words the postseason uses: the losers
 * bracket is the elimination side, and the reset is the deciding game.
 */
export function roundWords(name: string): string {
  if (name === 'Elimination round') return 'Elimination round 1';
  if (name === 'Losers bracket') return 'Elimination side';
  if (name === 'Winners bracket') return 'Winners side';
  if (name === 'Championship · the reset') return 'Championship: deciding game';
  return name
    .replace(/^Losers round (\d+)$/, 'Elimination round $1')
    .replace(/^Losers semifinal$/, 'Elimination semifinal')
    .replace(/^Losers final$/, 'Elimination final');
}

/**
 * An award's stat line in words: ".412 / 18 HR / 64 RBI" reads ".412 average ·
 * 18 home runs · 64 RBI"; "10-2 / 2.13 ERA / 112 K" reads "10–2 record · 2.13
 * ERA · 112 strikeouts".
 */
export function statLineWords(line: string): string {
  return line.split(' / ').map((part) => {
    const p = part.trim();
    if (/^\d?\.\d{3}$/.test(p)) return `${p} average`;
    const rec = p.match(/^(\d+)-(\d+)$/);
    if (rec) return `${rec[1]}–${rec[2]} record`;
    const m = p.match(/^([\d.]+) ([A-Z]+)$/);
    if (!m) return p;
    const [, n, code] = m as unknown as [string, string, string];
    const one = Number(n) === 1;
    switch (code) {
      case 'HR': return `${n} home run${one ? '' : 's'}`;
      case 'K': return `${n} strikeout${one ? '' : 's'}`;
      case 'SV': return `${n} save${one ? '' : 's'}`;
      case 'IP': return `${n} innings`;
      default: return p;
    }
  }).join(' · ');
}

/** A high-school stat line's labels, in words. */
export const HIGH_SCHOOL_WORD: Record<string, string> = {
  ERA: 'ERA', 'W-L': 'Record', IP: 'Innings', K: 'Strikeouts', BB: 'Walks', WHIP: 'Walks and hits per inning',
  AVG: 'Batting average', AB: 'At-bats', H: 'Hits', HR: 'Home runs', RBI: 'Runs batted in', SB: 'Stolen bases',
};
