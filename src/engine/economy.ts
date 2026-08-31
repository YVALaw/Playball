// economy.ts
// The program's money, and the three people it pays for.
//
// Stage 11. The design brief was one sentence — *every dollar should have at
// least two things it could have been* — and the module is organised around
// making that true. One annual budget, in thousands of dollars, and three
// competing claims on it: the staff's wages, the facilities, and the scouting
// desk. A program that hires the best hitting coach in the market is a program
// that watches its rival's tendencies from the cheap seats.
//
// ---------------------------------------------------------------------------
// What is modelled, and for whom
// ---------------------------------------------------------------------------
//
// **The user's staff is explicit; a rival's staff is priced in.** This is the
// same fiction the depth modes have relied on since stage 2: casual hands the
// bullpen to "a pitching coach, which is what the other ninety-five programs
// have always had". A rival coach's skills are already nudged upward by what
// his program can attract (`freshCoach` in rivals.ts), so modelling ninety-five
// explicit staffs would be pricing the same thing twice — and it would put
// derived draws into a calibrated world for a difference nobody can see.
// The user's assistants therefore stack on the user's own skills and touch
// nothing else. The goldens never see them.
//
// **Everything here is derived, never drawn.** The market's candidates, a
// poaching, the wage of a man — all hashes of stable facts. Adding an `rng()`
// call would move every number after it in the season stream, and the economy
// runs at the year roll, which is upstream of everything.
//
// ---------------------------------------------------------------------------
// The numbers
// ---------------------------------------------------------------------------
//
// The budget runs 1,000–1,800 ($k) across the prestige scale. A good assistant
// costs about 200 a year and there are three seats, so a staffed-up program at
// low prestige is spending well over half its money on wages before a brick is
// laid — which is the argument the plan asked for. Facilities are one-time
// costs at roughly a season of wages per level. A scouting report is cheap on
// purpose: the decision it creates is *habitual* spending, thirty-odd series a
// year if you wanted every book, which no budget survives.

import { FIRST, LAST } from '../data/names.js';
import type { CoachSkills } from './program.js';

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** The year's money, in thousands. Prestige is the whole of a program's purse. */
export function annualBudget(prestige: number): number {
  return 750 + 13 * Math.max(0, Math.min(100, prestige));
}

/** Dollars for people: "$1.28M" above a thousand, "$430k" below. */
export function dollars(k: number): string {
  return k >= 1000 ? `$${(k / 1000).toFixed(2)}M` : `$${Math.round(k)}k`;
}

// ---------------------------------------------------------------------------
// The staff
// ---------------------------------------------------------------------------

export type StaffSeat = 'pitching' | 'hitting' | 'recruiting';

export const SEATS: readonly StaffSeat[] = ['pitching', 'hitting', 'recruiting'];

export const SEAT_LABEL: Record<StaffSeat, string> = {
  pitching: 'Pitching coach',
  hitting: 'Hitting coach',
  recruiting: 'Recruiting coordinator',
};

/** What each seat actually buys, in the words the screen prints. */
export const SEAT_NOTE: Record<StaffSeat, string> = {
  pitching: 'Stacks on your defense. Balls in play against you die a little more often.',
  hitting: 'Stacks on your offense. Your hitters take slightly better at-bats.',
  recruiting: 'Every hour on a recruit counts for more, and your reports run tighter.',
};

export interface Assistant {
  /** Stable across saves and the key every derivation hashes. */
  id: string;
  name: string;
  age: number;
  /** 25–88. What he is worth, and what everything else is derived from. */
  rating: number;
  /** $k a year, owed every roll he is still on the staff. */
  wage: number;
  seat: StaffSeat;
}

/** The same stable string hash the rivals and the classroom use. */
function hash(s: string): number {
  let h = 7919;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** What a man of this quality costs a year. Rounded to 5 so it reads as a wage. */
export function wageFor(rating: number): number {
  return Math.round((40 + rating * 2.2) / 5) * 5;
}

/**
 * One derived assistant. The id carries everything that makes him: the world,
 * the year he came on the market, the seat and his slot in it.
 */
function candidate(worldKey: string, year: number, seat: StaffSeat, slot: number): Assistant {
  const id = `${worldKey}:${year}:${seat}:${slot}`;
  const h = hash(id);
  // Hashed separately per field: a multiplicative hash's low bits move far
  // more than its high ones, and one hash shifted three ways handed a market
  // three brothers — Killian, Kieran and Kevin Sinclair, all for hire at once.
  const first = FIRST[hash(id + ':f') % FIRST.length] ?? 'Sam';
  const last = LAST[hash(id + ':l') % LAST.length] ?? 'Cole';
  /*
    The market's shape: one man worth chasing, one journeyman, one cheap.
    Ratings 25–88 with the slot deciding the band, so every offseason offers a
    real top and a real floor rather than three coin flips.
  */
  const band = slot === 0 ? [62, 26] : slot === 1 ? [44, 22] : [27, 18];
  const rating = (band[0] ?? 44) + hash(id + ':r') % (band[1] ?? 20);
  return {
    id,
    name: `${first} ${last}`,
    age: 31 + (hash(id + ':a') % 26),
    rating,
    wage: wageFor(rating),
    seat,
  };
}

/**
 * The hire market for one seat, one offseason. Three men, best first.
 *
 * Derived from the world and the year, so every save of the same career sees
 * the same market and a reload cannot reroll a better class of applicant.
 */
export function marketFor(worldKey: string, year: number, seat: StaffSeat): Assistant[] {
  return [0, 1, 2].map((slot) => candidate(worldKey, year, seat, slot));
}

/**
 * What the staff adds to the coach's own skills.
 *
 * Small on purpose, and through the exact channels the skills already use —
 * an assistant is a bonus on a calibrated number, not a new number. A 60
 * coordinator is worth 15 points of recruiting skill, which `weeklyPoints`
 * prices at about four percent more interest a week.
 */
export function staffBonus(staff: Partial<Record<StaffSeat, Assistant>>): CoachSkills {
  const b = { offense: 0, defense: 0, training: 0, recruiting: 0 };
  const hitting = staff.hitting;
  const pitching = staff.pitching;
  const recruiting = staff.recruiting;
  if (hitting) b.offense = Math.round(hitting.rating / 5);
  if (pitching) b.defense = Math.round(pitching.rating / 5);
  if (recruiting) b.recruiting = Math.round(recruiting.rating / 4);
  return b;
}

/** The coach's skills with his staff on top, capped where skills cap. */
export function withStaff(
  skills: CoachSkills, staff: Partial<Record<StaffSeat, Assistant>>,
): CoachSkills {
  const b = staffBonus(staff);
  return {
    offense: Math.min(99, skills.offense + b.offense),
    defense: Math.min(99, skills.defense + b.defense),
    training: Math.min(99, skills.training + b.training),
    recruiting: Math.min(99, skills.recruiting + b.recruiting),
  };
}

/** The wage bill a roll will collect. */
export function wageBill(staff: Partial<Record<StaffSeat, Assistant>>): number {
  return SEATS.reduce((a, s) => a + (staff[s]?.wage ?? 0), 0);
}

/**
 * Whether this man is poached this winter, and it is not a draw.
 *
 * Derived from the man and the year, so a reload cannot keep him. The chance
 * follows his quality, because being poached is what being good costs: a 75
 * coordinator is somebody's next head coach roughly one winter in four.
 */
export function poached(a: Assistant, year: number): boolean {
  const chance = a.rating >= 70 ? 25 : a.rating >= 55 ? 12 : 4;
  return hash(`${a.id}:poach:${year}`) % 100 < chance;
}

// ---------------------------------------------------------------------------
// Facilities
// ---------------------------------------------------------------------------

export interface FacilityLevel {
  /** One-time cost to reach this level from the one below, $k. */
  cost: number;
  /** What the tour says. */
  label: string;
  /** Added to the coach's training skill for development. */
  trainBump: number;
  /** Added to the recruiting pitch's development read (0–1 scale). */
  devPitch: number;
}

/**
 * Four rungs. The costs sit at roughly a season of wages apiece, so a program
 * cannot staff up and build in the same year — which is the decision.
 */
export const FACILITIES: readonly FacilityLevel[] = [
  { cost: 0, label: 'What the school gave you', trainBump: 0, devPitch: 0 },
  { cost: 500, label: 'A real weight room', trainBump: 3, devPitch: 0.06 },
  { cost: 900, label: 'An indoor practice facility', trainBump: 6, devPitch: 0.13 },
  { cost: 1400, label: 'A player development lab', trainBump: 9, devPitch: 0.2 },
];

export const MAX_FACILITY = FACILITIES.length - 1;

// ---------------------------------------------------------------------------
// The scouting desk
// ---------------------------------------------------------------------------

/** One report: one opponent, read for this long. */
export const SCOUT_COST = 35;
export const SCOUT_DAYS = 10;

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------

/**
 * The user program's whole economy, as the save carries it. Sparse by the
 * house rule: a career from before the stage has level-0 facilities, three
 * empty seats and a clean ledger — nothing, rather than everything.
 */
export interface Economy {
  /** Facilities rung, 0–3. */
  facilities: number;
  /** Who sits in each seat. Absent means vacant. */
  staff: Partial<Record<StaffSeat, Assistant>>;
  /** $k spent this year on everything but wages (wages are counted live). */
  spent: number;
  /** Opponent team index → last dayIndex the book on them is good for. */
  scouted: Record<number, number>;
}

export const freshEconomy = (): Economy => ({
  facilities: 0,
  staff: {},
  spent: 0,
  scouted: {},
});

/** What is left to spend right now. */
export function remaining(eco: Economy, prestige: number): number {
  return annualBudget(prestige) - wageBill(eco.staff) - eco.spent;
}
