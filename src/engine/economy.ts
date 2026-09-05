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
  pitching: 'Develops your arms over the winter, and carries their innings through the spring.',
  hitting: 'Develops your bats over the winter, and sharpens their at-bats a touch.',
  recruiting: 'Every hour on a recruit counts for more, and your reports run tighter.',
};

export interface Assistant {
  /** Stable across saves and the key every derivation hashes. */
  id: string;
  name: string;
  age: number;
  /** 25–88. What he is worth in total, across both halves of his craft. */
  rating: number;
  /**
   * How his craft is split, 0 to 1: how much of him is the WINTER.
   *
   * 1 is a pure developer — everything he knows goes into what your men
   * become between seasons. 0 is a pure game-night man, worth his rating
   * once the season starts and nothing at all to a freshman in February.
   * Most sit between, and two men of equal rating on opposite sides of it
   * are the whole reason this screen is a decision now.
   */
  winter: number;
  /** $k a year, owed every roll he is still on the staff. */
  wage: number;
  seat: StaffSeat;
  /** First year on this coach's staff. Sparse on older saves. */
  joinedYear?: number;
  /** A recruiting coordinator's strongest geographic relationship. */
  pipelineState?: string;
}

/** What he builds between seasons: rating spent on the winter half. */
export const winterCraft = (a: Assistant): number => Math.round(a.rating * a.winter);
/** What he is worth once the games start. */
export const nightCraft = (a: Assistant): number => Math.round(a.rating * (1 - a.winter));

/** How the screen names a man's shape, in his own words. */
export function shapeOf(a: Assistant): string {
  if (a.winter >= 0.68) return 'A TEACHER';
  if (a.winter <= 0.32) return 'A GAME-NIGHT MAN';
  return 'BOTH HALVES';
}

/** The same stable string hash the rivals and the classroom use. */
function hash(s: string): number {
  let h = 7919;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * What a man of this quality costs a year. Rounded to 5 so it reads as a wage.
 *
 * The curve is the point. It was linear, which made the best man the best
 * VALUE as well as the best man — 7.66 skill points per $100k against 5.00
 * at the bottom — so no hire ever cost anything to prefer. Quality is bought
 * at a worsening rate now: the last twenty points of a coordinator cost more
 * than the first fifty, which is what a scarce good does.
 */
export function wageFor(rating: number): number {
  const t = Math.max(0, Math.min(1, (rating - 25) / 63));
  return Math.round((70 + 430 * t * t) / 5) * 5;
}

/**
 * One derived assistant. The id carries everything that makes him: the world,
 * the year he came on the market, the seat and his slot in it.
 */
const PIPELINE_STATES = [
  'AL','AZ','CA','CO','CT','FL','GA','IA','ID','IL','IN','KS','LA','MA','ME','MI','MO','MS',
  'NC','NE','NH','NJ','NM','NV','NY','OH','OK','OR','PA','RI','SC','TN','TX','UT','VA','VT','WA','WI','WV','WY',
] as const;

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
  /*
    And his shape, spread across the whole range so a market of three
    reliably offers a choice rather than three of the same man. Hashed like
    everything else here: no draw, and the same market every time a career
    is replayed.
  */
  const winter = 0.18 + (hash(id + ':w') % 65) / 100;
  return {
    id,
    name: `${first} ${last}`,
    age: 31 + (hash(id + ':a') % 26),
    rating,
    winter,
    wage: wageFor(rating),
    seat,
    joinedYear: year,
    ...(seat === 'recruiting'
      ? { pipelineState: PIPELINE_STATES[hash(id + ':state') % PIPELINE_STATES.length] }
      : {}),
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
 * One winter of staff growth. Assistants improve slowly and deterministically,
 * so keeping a good teacher can create value instead of every offseason being
 * a fresh auction. Strong winter coaches learn a little faster; nobody grows
 * forever, and wages drift toward market value rather than jumping in one year.
 */
export function developAssistant(a: Assistant, year: number): Assistant {
  const roll = hash(`${a.id}:develop:${year}`) % 100;
  const ceiling = 84;
  const chance = Math.round(30 + a.winter * 35 + Math.max(0, 70 - a.rating) * 0.35);
  let gain = 0;
  if (a.rating < ceiling && roll < chance) gain = 1;
  if (a.rating < 72 && roll < Math.max(8, chance / 4)) gain = 2;
  const rating = Math.min(ceiling, a.rating + gain);
  const market = wageFor(rating);
  const wage = Math.round((a.wage * 0.78 + market * 0.22) / 5) * 5;
  return { ...a, age: a.age + 1, rating, wage };
}

/**
 * What the staff adds to the coach's own skills.
 *
 * Small on purpose, and through the exact channels the skills already use —
 * an assistant is a bonus on a calibrated number, not a new number. A 60
 * coordinator is worth 15 points of recruiting skill, which `weeklyPoints`
 * prices at about four percent more interest a week.
 */
/**
 * What an assistant adds where the coach is already this good.
 *
 * A brilliant hitting coach on top of a Hitting Guru is worth less than the
 * same man covering a weak side — the second voice in a room saying what the
 * first one already said. Full value at the starting twenty, and about half
 * of it by the time the coach is elite himself, so the right hire depends on
 * who YOU are. That is the creation interview reaching forward into the rest
 * of the career, which is what it was for.
 */
export function fitFactor(ownSkill: number): number {
  const over = Math.max(0, Math.min(70, ownSkill - 20));
  return 1 - 0.5 * (over / 70);
}

export function staffBonus(
  staff: Partial<Record<StaffSeat, Assistant>>,
  own?: CoachSkills,
): CoachSkills {
  const b = { offense: 0, defense: 0, training: 0, recruiting: 0 };
  const hitting = staff.hitting;
  const pitching = staff.pitching;
  const recruiting = staff.recruiting;
  // The NIGHT half. What he builds over the winter is paid in devBonus,
  // which is the other side of the same man.
  if (hitting) {
    b.offense = Math.round(nightCraft(hitting) / 5 * fitFactor(own?.offense ?? 20));
  }
  if (pitching) {
    b.defense = Math.round(nightCraft(pitching) / 5 * fitFactor(own?.defense ?? 20));
  }
  if (recruiting) {
    b.recruiting = Math.round(nightCraft(recruiting) / 4 * fitFactor(own?.recruiting ?? 20));
  }
  return b;
}

/** The coach's skills with his staff on top, capped where skills cap. */
export function withStaff(
  skills: CoachSkills, staff: Partial<Record<StaffSeat, Assistant>>,
): CoachSkills {
  // The coach's own skills decide how much a second voice is worth.
  const b = staffBonus(staff, skills);
  return {
    offense: Math.min(99, skills.offense + b.offense),
    defense: Math.min(99, skills.defense + b.defense),
    training: Math.min(99, skills.training + b.training),
    recruiting: Math.min(99, skills.recruiting + b.recruiting),
  };
}

/**
 * The development bonus each game-side coach brings, in points of the
 * TRAINING scale, split by the side he works. An elite man is worth a
 * shade more than the top facility rung — the wage now buys something a
 * roster can feel year over year.
 */
export function devBonus(
  staff: Partial<Record<StaffSeat, Assistant>>,
): { bat: number; arm: number } {
  // The winter half, so a teacher is worth more here than the game-night
  // man of the same quality — and worth less on the night. One man, two
  // numbers, and the screen shows both.
  return {
    bat: staff.hitting ? Math.round(winterCraft(staff.hitting) / 4) : 0,
    arm: staff.pitching ? Math.round(winterCraft(staff.pitching) / 4) : 0,
  };
}

/**
 * How the pitching coach carries his arms' season: workload accrues at
 * this rate, so a staff under a good man wears its innings better. An
 * elite coach is worth about a fifth of the mileage.
 */
export function armCareFor(staff: Partial<Record<StaffSeat, Assistant>>): number {
  const r = staff.pitching?.rating ?? 0;
  return Math.max(0.78, 1 - r / 400);
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
// Career networks
// ---------------------------------------------------------------------------

/** A former assistant who left this coach's staff for the head-coach market. */
export interface CoachingTreeEntry {
  id: string;
  name: string;
  seat: StaffSeat;
  joinedYear: number;
  leftYear: number;
  yearsWithYou: number;
  /** Last known head-coaching line, kept even after he leaves the carousel. */
  lastSchool?: string;
  careerWins?: number;
  careerLosses?: number;
  titles?: number;
  active?: boolean;
}

/** A recruiting relationship the coach/staff have built in one state. */
export interface PipelineEntry {
  state: string;
  /** 0-100. Stronger means a better local pitch; 60+ also extends reach. */
  strength: number;
  signings: number;
  lastSignedYear: number;
}

/** The label the UI uses. */
export function pipelineLabel(strength: number): string {
  if (strength >= 80) return 'STRONG';
  if (strength >= 60) return 'ESTABLISHED';
  if (strength >= 35) return 'EMERGING';
  return 'COLD';
}

/**
 * The effective network in one state. Home territory always has a floor and a
 * recruiting coordinator can bring one additional market with him.
 */
export function pipelineStrength(
  eco: Economy, state: string, homeState: string,
): number {
  const stored = eco.pipelines?.[state]?.strength ?? 0;
  // Preserve the original home-state reach advantage: 60+ is the threshold
  // that lets a network stretch one prestige tier beyond normal reach.
  const home = state === homeState ? 60 : 0;
  const coordinator = eco.staff.recruiting?.pipelineState === state
    ? Math.max(60, Math.round((eco.staff.recruiting?.rating ?? 0) * 0.82))
    : 0;
  return Math.max(stored, home, coordinator);
}

/** A signed player strengthens the relationship that produced him. */
export function addPipelineSigning(
  eco: Economy, state: string, year: number, stars = 3,
): Economy {
  const pipelines = { ...(eco.pipelines ?? {}) };
  const current = pipelines[state] ?? { state, strength: 0, signings: 0, lastSignedYear: year };
  const gain = 8 + Math.max(0, stars - 1) * 3;
  pipelines[state] = {
    state,
    strength: Math.min(100, current.strength + gain),
    signings: current.signings + 1,
    lastSignedYear: year,
  };
  return { ...eco, pipelines };
}

/** Relationships cool when a staff stops signing from them. */
export function agePipelines(eco: Economy, year: number): Economy {
  const entries = Object.values(eco.pipelines ?? {});
  if (entries.length === 0) return eco;
  const pipelines: Record<string, PipelineEntry> = {};
  for (const e of entries) {
    const idle = Math.max(0, year - e.lastSignedYear);
    const strength = Math.max(0, e.strength - (idle > 0 ? 4 : 0));
    if (strength > 8 || e.signings > 0) pipelines[e.state] = { ...e, strength };
  }
  return { ...eco, pipelines };
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
  /**
   * Multiplier on the injury roll's strain — a body kept in a real
   * facility pulls fewer muscles. One at the bottom rung.
   */
  injuryGuard: number;
}

/**
 * Four rungs. The costs sit at roughly a season of wages apiece, so a program
 * cannot staff up and build in the same year — which is the decision.
 */
export const FACILITIES: readonly FacilityLevel[] = [
  { cost: 0, label: 'What the school gave you', trainBump: 0, devPitch: 0, injuryGuard: 1 },
  { cost: 620, label: 'One building up', trainBump: 3, devPitch: 0.06, injuryGuard: 0.96 },
  { cost: 1280, label: 'Two of the three', trainBump: 6, devPitch: 0.13, injuryGuard: 0.93 },
  { cost: 1860, label: 'The whole plant', trainBump: 9, devPitch: 0.2, injuryGuard: 0.86 },
];

export const MAX_FACILITY = FACILITIES.length - 1;

/** The three things a programme can put up, and what each is for. */
export type Building = 'cage' | 'pen' | 'clubhouse';

export interface BuildingSpec {
  key: Building;
  label: string;
  /** One line: what it buys, in the terms the screen already speaks. */
  blurb: string;
  cost: number;
  /** Extra winter development, on top of the rung the count buys. */
  bat: number;
  arm: number;
  /** Multiplier on the strain roll — the pen is where arms are kept whole. */
  guard: number;
  /** Added to the recruiting pitch's development read. */
  pitch: number;
}

/**
 * Priced so a mid-table programme puts up ONE and lives with the choice for
 * a while. Deliberately close together in cost: the decision is meant to be
 * about what your side needs, not about which one is affordable.
 */
export const BUILDINGS: readonly BuildingSpec[] = [
  {
    key: 'cage',
    label: 'The hitting barn',
    blurb: 'Bats come back from the winter further along.',
    cost: 620, bat: 4, arm: 0, guard: 1, pitch: 0.04,
  },
  {
    key: 'pen',
    label: 'The pitching lab',
    blurb: 'Arms develop, and they break down less.',
    cost: 660, bat: 0, arm: 4, guard: 0.9, pitch: 0.04,
  },
  {
    key: 'clubhouse',
    label: 'The clubhouse',
    blurb: 'Recruits notice, and the room holds together.',
    cost: 580, bat: 1, arm: 1, guard: 0.97, pitch: 0.12,
  },
];

export const buildingSpec = (k: Building): BuildingSpec =>
  BUILDINGS.find((b) => b.key === k) ?? BUILDINGS[0]!;


export const FACILITY_MAX_LEVEL = 3;
const LEVEL_MULT = [0, 1, 1.75, 2.6] as const;

export function facilityLevel(eco: Economy, which: Building): number {
  const saved = eco.facilityLevels?.[which];
  if (typeof saved === 'number') return Math.max(0, Math.min(FACILITY_MAX_LEVEL, Math.round(saved)));
  return (eco.built ?? []).includes(which) ? 1 : 0;
}

/** Cost of the next specialized upgrade. Level one uses the building's base cost. */
export function facilityUpgradeCost(which: Building, nextLevel: number): number {
  const base = buildingSpec(which).cost;
  if (nextLevel <= 1) return base;
  return Math.round((base * (nextLevel === 2 ? 0.72 : 0.96)) / 10) * 10;
}

export function facilityEffectAt(which: Building, level: number): {
  bat: number; arm: number; guard: number; pitch: number;
} {
  const b = buildingSpec(which);
  const safe = Math.max(0, Math.min(FACILITY_MAX_LEVEL, Math.round(level)));
  const mult = LEVEL_MULT[safe] ?? 0;
  return {
    bat: b.bat * mult,
    arm: b.arm * mult,
    guard: Math.max(0.72, 1 - (1 - b.guard) * mult),
    pitch: b.pitch * mult,
  };
}

export function facilityEffects(eco: Economy): {
  bat: number; arm: number; guard: number; pitch: number;
} {
  const out = { bat: 0, arm: 0, guard: 1, pitch: 0 };
  for (const b of BUILDINGS) {
    const level = facilityLevel(eco, b.key);
    if (level <= 0) continue;
    const mult = LEVEL_MULT[level] ?? LEVEL_MULT[LEVEL_MULT.length - 1] ?? 1;
    out.bat += b.bat * mult;
    out.arm += b.arm * mult;
    // Guard is a multiplier, so scale the distance from 1 rather than multiplying
    // the raw number three times.
    out.guard *= Math.max(0.72, 1 - (1 - b.guard) * mult);
    out.pitch += b.pitch * mult;
  }
  return out;
}

/**
 * What a programme's buildings are worth together.
 *
 * Reads the list when there is one and falls back to the old rung count, so
 * a career saved before the branch keeps exactly the facilities it paid for.
 */
export function builtBonus(built: readonly Building[] | undefined): {
  bat: number; arm: number; guard: number; pitch: number;
} {
  const out = { bat: 0, arm: 0, guard: 1, pitch: 0 };
  for (const k of built ?? []) {
    const b = buildingSpec(k);
    out.bat += b.bat;
    out.arm += b.arm;
    out.guard *= b.guard;
    out.pitch += b.pitch;
  }
  return out;
}

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
  /**
   * Facilities rung, 0–3 — the COUNT of what has been built.
   *
   * Kept as a number so every reader of FACILITIES[level] still works and a
   * save written before the buildings branched loads without migration.
   * `built` says WHICH, and each one adds its own thing on top.
   */
  facilities: number;
  /** Which buildings are up. Absent on a save from before the branch. */
  built?: Building[];
  /** Specialized level of each building, 1-3. Old saves infer level one from `built`. */
  facilityLevels?: Partial<Record<Building, number>>;
  /** Who sits in each seat. Absent means vacant. */
  staff: Partial<Record<StaffSeat, Assistant>>;
  /** Former assistants who left this coach for head-coaching opportunities. */
  tree?: CoachingTreeEntry[];
  /** Recruiting relationships that this staff has deliberately built. */
  pipelines?: Record<string, PipelineEntry>;
  /** $k spent this year on everything but wages (wages are counted live). */
  spent: number;
  /** Opponent team index → last dayIndex the book on them is good for. */
  scouted: Record<number, number>;
}

export const freshEconomy = (): Economy => ({
  facilities: 0,
  built: [],
  facilityLevels: {},
  staff: {},
  tree: [],
  pipelines: {},
  spent: 0,
  scouted: {},
});

/** What is left to spend right now. */
export function remaining(eco: Economy, prestige: number): number {
  return annualBudget(prestige) - wageBill(eco.staff) - eco.spent;
}
