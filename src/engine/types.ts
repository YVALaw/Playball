// types.ts
// The domain model. Everything in the engine is typed against this file.
//
// One deliberate deviation from the sketch in 01-roadmap.md: ratings stay FLAT
// on the player rather than nested under `ratings` / `pitching`. The rating
// sensitivity tables in ratings.ts look attributes up by name, which types
// cleanly against a flat shape and awkwardly against a nested one. Nesting is a
// separate refactor, not something to smuggle into a port whose whole job is to
// change nothing.

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

// Branded so a TeamId cannot be passed where a PlayerId belongs, even though
// both are strings at runtime.
type Brand<T, B> = T & { readonly __brand: B };
export type PlayerId = Brand<string, 'PlayerId'>;
export type TeamId = Brand<string, 'TeamId'>;

export const playerId = (s: string): PlayerId => s as PlayerId;
export const teamId = (s: string): TeamId => s as TeamId;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type Hand = 'R' | 'L';
export type Bats = Hand | 'S';
export type ClassYear = 'FR' | 'SO' | 'JR' | 'SR';
export type Position = 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH' | 'P';
export type PitcherRole = 'SP' | 'RP';

/** The seven outcomes the log5 model partitions a plate appearance into. */
export type PAEvent = 'single' | 'double' | 'triple' | 'homerun' | 'walk' | 'hbp' | 'out';

/** The six things a single pitch can resolve to. */
export type PitchResult = 'ball' | 'called' | 'swinging' | 'foul' | 'inplay' | 'hbp';

export type BattedBall = 'ground' | 'line' | 'fly' | 'popup';

/** How a plate appearance actually finished, one level below PAEvent. */
export type PAKind = 'strikeout' | 'walk' | 'hbp' | BattedBall;

export type EngineName = 'log5' | 'pitch';

/** Every offensive event. `out` is excluded because it absorbs the remainder. */
export type OffensiveEvent = Exclude<PAEvent, 'out'>;

/** A probability across all seven events, summing to 1. */
export type EventVector = Record<PAEvent, number>;

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

/**
 * Defence, split into the three things it is actually made of.
 *
 * A single `fielding` number was the same kind of vague that `stuff` was before
 * it got explained: it bundled "gets to the ball" and "does not drop it", which
 * are different skills that fail in different ways and are worth different
 * amounts at different positions. A shortstop lives on range; a first baseman
 * mostly needs hands. One number could not say that.
 *
 * All three are 0-100 and higher is better, like every other rating here. The
 * plan sketched range on an inverted Strat-O-Matic scale; a single inverted
 * rating among a dozen normal ones is a sign error waiting to happen, and the
 * consistency is worth more than the homage.
 */
export interface FieldingRatings {
  /** Ground covered. Turns balls that would fall in into outs. */
  range: number;
  /** Cleanliness. Low hands is how a routine play becomes an error. */
  hands: number;
  /** Throwing strength. Holds runners, and for a catcher, throws them out. */
  arm: number;
}

export interface HitterRatings extends FieldingRatings {
  contact: number;
  power: number;
  eye: number;
  speed: number;
}

export interface PitcherRatings extends FieldingRatings {
  stuff: number;
  movement: number;
  control: number;
  stamina: number;
  groundBall: number;
  holdRunners: number;
  /** Tracked in mph, not 0 to 100. It is the number recruits get talked about with. */
  velocity: number;
}

interface PlayerCore {
  /**
   * Unique within a league. Derived from the name, which the generator already
   * guarantees is unique — deliberately not a module level counter, which is the
   * shared mutable state that caused B8.
   */
  readonly id: PlayerId;
  name: string;
  pos: Position;
  classYear: ClassYear;
  bats: Bats;
  throws: Hand;
  /** Hidden. Full platoon split size as a share of production. Never shown. */
  platoonSkill: number;
  /**
   * Ceiling. What this player becomes if he develops well, on the same 0 to 100
   * scale as overall. The gap between the two is the whole point of recruiting a
   * raw freshman over a finished senior.
   */
  potential: number;
}

export interface Hitter extends PlayerCore, HitterRatings {
  type: 'hitter';
}

export interface Pitcher extends PlayerCore, PitcherRatings {
  type: 'pitcher';
  pos: 'P';
  role: PitcherRole;
  /** Sidearm righties are brutal on righties and vulnerable to lefties. */
  sidearm: boolean;
}

export type Player = Hitter | Pitcher;

export interface Team {
  name: string;
  lineup: Hitter[];
  rotation: Pitcher[];
  bullpen: Pitcher[];
  bench: Hitter[];
  quality: number;
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

/**
 * Seeded. Same seed plus same inputs reproduces a season exactly.
 *
 * `state` reads the generator's current position so a save can resume mid-stream.
 * Optional because a plain function is still a valid Rng — the platoon harness
 * and tests pass bare closures.
 */
export type Rng = (() => number) & { state?: () => number };

/**
 * A managerial call for one plate appearance.
 *
 * Offence and defence each get their own set. Most of these bend the outcome
 * distribution rather than forcing a result — asking for a ground ball makes one
 * likelier, it does not summon one — which is the honest way to model a manager:
 * he influences, he does not decide.
 */
export type Tactic =
  // offence
  | 'swing'      // let him hit
  | 'hitrun'     // runner goes with the pitch
  | 'bunt'       // trade an out to move him up
  | 'contact'    // put it in the air, get the run home
  | 'steal'      // send him
  // defence
  | 'pitch'      // let him work
  | 'groundball' // sink it, try for two
  | 'around'     // nothing good to hit
  | 'infieldIn'  // cut the run off at the plate
  | 'ibb';       // first base is open

/** Multipliers applied to the outcome distribution before the roll. */
export interface TacticMods {
  events?: Partial<Record<PAEvent, number>>;
  /** Pushes the batted ball toward the ground. */
  groundBall?: number;
  /** Chance a fly ball with a runner on third gets him home. */
  sacFly?: number;
  /** Chance a ground ball with a runner on first turns two. */
  doublePlay?: number;
  /** Chance a routine ground out lets the runner on third score. */
  scoreFromThird?: number;
}

/** Situational context handed to an engine for one plate appearance. */
export interface PAContext {
  isHome?: boolean;
  runnersOn?: boolean;
  timesThrough?: number;
  fatigueMult?: number;
  defenseMult?: number;
  /**
   * The batting side's coach-skill nudge, a hair above or below 1. Kept apart
   * from defenseMult because it lifts every offensive event, not just balls in
   * play — a good hitting coach's at-bats end in more walks too.
   */
  offenseMult?: number;
  /**
   * Defensive alignment as a multiplier on a ground ball becoming a hit. A shift
   * is a bet on the hitter at the plate, so this varies batter to batter rather
   * than being a flat team rating.
   */
  alignment?: number;
  /** Engine B only: bends the zone rate instead of the outcome table. */
  zoneBias?: number;
  /** The manager's call, if anyone made one. */
  mods?: TacticMods;
}

export interface PAResult {
  event: PAEvent;
  kind: PAKind;
  pitches: PitchResult[];
  engine: EngineName;
}

export type EngineFn = (
  batter: Hitter,
  pitcher: Pitcher,
  ctx: PAContext,
  rng: Rng,
) => PAResult;

// ---------------------------------------------------------------------------
// Stat lines
// ---------------------------------------------------------------------------

export interface HitLine {
  ab: number; r: number; h: number; d: number; t: number; hr: number;
  rbi: number; bb: number; k: number; hbp: number; sb: number; cs: number;
}

export interface PitchLine {
  outs: number; h: number; r: number; er: number; bb: number;
  k: number; hr: number; pitches: number; bf: number;
}

// ---------------------------------------------------------------------------
// The engine to 3D boundary
// ---------------------------------------------------------------------------

/**
 * What the sim emits for the presentation layer to animate. The engine never
 * learns about Three.js; it describes geometry and lets the field layer decide
 * what that looks like. See 01-roadmap.md.
 */
export interface PlayEvent {
  kind: 'pitch' | 'contact' | 'advance' | 'out' | 'score';
  /** Set on 'pitch'. What the pitch resolved to. */
  pitch?: PitchResult;
  /** Set on 'contact'. */
  battedBall?: BattedBall;
  /**
   * Normalized field coordinates. Geometry, never visuals.
   *
   * `x` runs -1 at the left field line to +1 at the right field line; `y` runs 0
   * at home plate to 1 at the outfield wall, and past it on a home run. Derived
   * from the man who actually fielded the ball, so it is a report of what the
   * simulation did rather than a decoration invented for the screen.
   *
   * Absent on strikeouts, walks and hit batsmen, where nothing was hit anywhere.
   */
  landing?: { x: number; y: number };
  /**
   * Base numbers, not array indices. 0 is the batter at the plate, 1 through 3
   * are the bases, 4 is home. Only runners who actually moved are listed.
   */
  runners?: Array<{ id: PlayerId; from: 0 | 1 | 2 | 3; to: 0 | 1 | 2 | 3 | 4 }>;
  /** Set on 'out'. How many outs the play recorded. */
  outs?: number;
  /** Set on 'score'. How many runs crossed. */
  runs?: number;
}

// ---------------------------------------------------------------------------

/** Exhaustiveness guard. The compiler flags the missing case when a union grows. */
export function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}
