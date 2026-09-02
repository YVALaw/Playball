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

/**
 * How many years a man has behind him when he is standing in each class year.
 *
 * Written down because two separate rules count in it — how old he is, which is
 * his arrival age plus this, and whether the draft may take him, which is this
 * plus one against three — and a class year compared with a string literal in
 * two files is how those two quietly stop agreeing.
 */
export const CLASS_ORDER: Record<ClassYear, number> = { FR: 0, SO: 1, JR: 2, SR: 3 };

export type Position = 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH' | 'P';
export type PitcherRole = 'SP' | 'RP';

/**
 * The badges, named here rather than in `badges.ts`.
 *
 * A held badge is the one piece of the situational layer a save has to write
 * down — a repertoire and a tendency are both hashed out of the player's id and
 * cost nothing, but a badge can be earned or coached and therefore has a
 * history. That makes it part of the domain model, and the domain model lives
 * in this file. What each one *does* stays in `badges.ts`, which imports these.
 */
export type BadgeId =
  | 'getsHimIn' | 'lateAndClose' | 'tableSetter' | 'houdini' | 'theDoor' | 'deepWater'
  | 'wheels' | 'burglar' | 'lightTower' | 'cannon' | 'rubberArm' | 'swingAndMiss'
  | 'toughOut' | 'vacuum' | 'onALine' | 'painter' | 'wormBurner' | 'stealsStrikes'
  | 'gymRat' | 'noPanic' | 'secondLook' | 'bigStage' | 'crowdsThePlate';

/** Bronze, silver, gold. */
export type BadgeTier = 1 | 2 | 3;

export interface HeldBadge {
  id: BadgeId;
  tier: BadgeTier;
}

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

/**
 * The five things a young man weighs when he decides where to play.
 *
 * Declared here rather than in recruiting.ts, where the rest of the vocabulary
 * still lives, because a player carries his own set now: the draft asks the
 * same question recruiting asked him, and it has to be able to read the same
 * answer. `recruiting.ts` re-exports both names so nothing had to move.
 */
export type Priority = 'prestige' | 'playingTime' | 'winning' | 'proximity' | 'development';

/** How much he weighs each of them. Sums to 1. */
export type Priorities = Record<Priority, number>;

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
  /**
   * Where the throw goes, as opposed to how hard it gets there.
   *
   * Strength decides whether the ball beats the runner; accuracy decides whether
   * the first baseman has to leave the bag for it. They are separate skills and
   * they fail differently — the cannon who airmails one into the dugout is a
   * type of player, and with one `arm` rating he could not exist. This is the
   * rating a throwing error comes off, which is the only error the engine has
   * that moves runners rather than just putting one on.
   */
  armAccuracy: number;
}

export interface HitterRatings extends FieldingRatings {
  contact: number;
  power: number;
  eye: number;
  speed: number;
  /**
   * Keeping the ball in front of you. Carried by every position player and read
   * only for the man behind the plate, in the same spirit as `range` on a DH:
   * the rating is absolute, and the position decides whether it is ever asked
   * about. Without it a catcher is graded exactly like a left fielder, which is
   * why the hardest position on the field had no identity of its own.
   */
  blocking: number;
  /**
   * Laying one down. There has been a team-level bunt policy since coaching
   * strategy landed, and no notion of who can actually execute it — so a
   * clean-up hitter dropped a sacrifice as reliably as a nine-hole slap hitter.
   */
  bunt: number;
  /**
   * The jump, not the wheels. Reading a pitcher's first move and leaving on it
   * is a skill of its own: speed is what covers the ninety feet once you have
   * gone, and plenty of fast men never learn to go. Split out of `speed` so the
   * base stealer and the merely quick are different players.
   */
  steal: number;
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
   * Unique within a dynasty, and deliberately not the name.
   *
   * It was the name once. Everything that keeps a record keys on this — season
   * statistics, the record book, awards, box scores — so two men called the same
   * thing were one man in all of them, and the only guard was a set in
   * players.ts that no save wrote down. A cold reload emptied it and handed the
   * whole name pool back. `nextPlayerId` reads the generator's own position
   * instead: unique, restored exactly by a resumed save, and costing no draw.
   *
   * Saves written before that carry name-shaped ids and keep them. An id has to
   * be unique and stable, not pretty, and rewriting every key in a dynasty is
   * the kind of migration that loses a career.
   */
  readonly id: PlayerId;
  name: string;
  pos: Position;
  classYear: ClassYear;
  /**
   * How old he is, which is not a restatement of his class year.
   *
   * Most freshmen arrive at eighteen and a real minority at nineteen or twenty
   * — a gap year, a late start, two seasons of junior college — and that
   * minority is the whole reason the number exists. Draft eligibility is three
   * years completed *or* age twenty one, whichever comes first, so the man who
   * turned up old comes into range while the rest of his class is still safe.
   * Without a real age that clause can only be imitated with a talent bar,
   * which is exactly what it used to be.
   *
   * Deliberately descriptive otherwise. Nothing in the simulation reads it —
   * not development, not decline, not fatigue, not fielding — because the
   * progression rework is going to want it and must not find it already wired
   * in somewhere else.
   */
  age: number;
  /**
   * What he is looking for, carried from the winter somebody recruited him.
   *
   * The same five weights `fit` multiplies a recruiting spend by, on the same
   * man, so talking him out of professional ball is the recruiting pitch again
   * rather than a second system built to resemble one. A coach who read his
   * player in December still knows him in June.
   *
   * Optional because only men who came through a recruiting class have a set
   * that was actually drawn for them — nobody recruited the rosters the world
   * starts with, and nobody recruited a walk-on. `prioritiesFor` hashes one out
   * of the id for those, which is stable and costs the generator nothing.
   */
  priorities?: Priorities;
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
  /**
   * Nobody recruited him. He is here because a hole had to be filled.
   *
   * Without a mark on him a walk-on is an ordinary freshman the moment he lands,
   * indistinguishable from a man you spent a scholarship on — which is both the
   * wrong reading on the roster and the reason he used to stay four years and
   * develop like a recruit. He gets one season and no more; see
   * `departAndDevelop`.
   *
   * Optional so that every save written before this loads unchanged. A player
   * with no flag was recruited, which is the truth for everybody who already
   * exists.
   */
  walkOn?: boolean;
  /**
   * The small, specific edges he carries. See `engine/badges.ts`.
   *
   * Stored, unlike his repertoire and his tendencies, because this is the one
   * part of the situational layer with a history: some are innate, some are
   * earned from what he actually did, some are coached, and none of them decay.
   * A derived-from-the-id badge could not be any of those things.
   *
   * Optional so that a save written before badges existed loads unchanged. A
   * player with no field simply holds none, which is the truth about him.
   */
  badges?: HeldBadge[];
}

export interface Hitter extends PlayerCore, HitterRatings {
  type: 'hitter';
  /**
   * His own position, remembered while he wears somebody else's.
   *
   * Set the first time a cover or an appointment relabels him, cleared the
   * moment he returns to the bench — "if you take them back to the bench,
   * they keep the position instead of returning to their main position" was
   * the report, and this is the memory that report was assuming existed.
   * Sparse and optional, so every save from before it simply has nobody
   * displaced.
   */
  homePos?: Position;
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

/**
 * What the two men's tendencies and badges do to one plate appearance.
 *
 * Declared here rather than beside the code that builds it, for the same reason
 * `TacticMods` is: it crosses the boundary into an engine, and the engines are
 * typed against this file. `engine/traits.ts` is what fills it in and
 * `engine/tendencies.ts` and `engine/badges.ts` are what decide the numbers.
 *
 * Named fields rather than a keyed record because this is read once per plate
 * appearance in the hot loop. `all` multiplies every offensive event at once;
 * the rest are per event, except `pace`, which scales the length of the pitch
 * sequence and is the only one that reaches something other than the outcome.
 */
export interface TraitMods {
  all: number;
  walk: number;
  hbp: number;
  single: number;
  double: number;
  homerun: number;
  /** On the strikeout share of an out. */
  strikeout: number;
  /** On the ground ball share of a ball in play. */
  groundBall: number;
  /** On how many pitches the at-bat takes. */
  pace: number;
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
  /**
   * What the two men are like, as opposed to how good they are. Absent when
   * neither carries a tendency or a badge that fires here, which is the fast
   * path an engine harness with hand-built players takes.
   */
  traits?: TraitMods;
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

/**
 * A fielder's day, in the terms the simulation can honestly speak.
 *
 * Deliberately NOT a box score. A real fielding line is putouts and assists, and
 * three quarters of those are the first baseman taking a throw — a throw this
 * engine never decides to make, because it resolves a ground ball as an out
 * without ever asking who covered the bag. Counting them would be fiction with
 * the shape of a statistic.
 *
 * What the engine really produces is a ball hit at a named man and a result, so
 * that is what this counts: how many came his way, how many he turned into outs,
 * and how many an average glove on his own team would have turned into outs.
 * `plays - expected` is therefore plays above average, measured against the
 * exact baseline the range model uses — which is what makes it a real number
 * rather than a compliment.
 */
export interface FieldLine {
  /** Balls in play hit at him. Home runs are nobody's chance. */
  chances: number;
  /** Chances he retired the batter on. */
  plays: number;
  /**
   * What his own team's average fielder would have made of the same chances —
   * the play the log5 model had already settled before his range was consulted.
   */
  expected: number;
  /** Charged to him, both kinds together. This is the E column's only source. */
  errors: number;
  /** Of those, the ones where the throw was the problem rather than the glove. */
  throwing: number;
  /** Catchers. Pitches that got past him with a man on. Not an error, by rule. */
  pb: number;
  /** Catchers. Bases stolen on him, and runners he threw out. */
  sba: number;
  cs: number;
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
