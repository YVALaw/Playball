// game.ts
// Nine innings. Baserunning, errors, steals, pitching changes, box score,
// and readable text play by play.

import {
  badgeSize, extraBaseBonus, fatigueBonus, gloveBonus, holdBonus, stealBonus, throwBonus,
} from './badges.js';
import { ENGINES } from './engines.js';
import { armMultiplier, legMultiplier } from './workload.js';
import { moodMultiplier } from './morale.js';
import {
  fatigueMultiplier, confidenceMultiplier, confidenceShift, CONFIDENCE,
  mult, clamp, platoonMultiplier, BASERUNNING,
} from './ratings.js';
import {
  RUNNING, STEALS, BUNT, HOOK, alignmentAgainst,
  DEFAULT_STRATEGY, type Strategy,
} from './strategy.js';
import { pullMultiplier, runningMods, shiftBias } from './tendencies.js';
import { plateTraits } from './traits.js';
import type {
  BattedBall, EngineFn, EngineName, FieldLine, HitLine, Hitter, PAKind, Pitcher,
  PitchLine, PitchResult, Player, PlayEvent, Position, Rng, Tactic, TacticMods, Team,
} from './types.js';

/**
 * What each managerial call does to the outcome distribution.
 *
 * These are tilts, not commands. Asking for a ground ball raises the chance of
 * one and doubles the double play risk; it does not produce a ground ball. The
 * shapes come from the original prototype, which had them tuned by feel — worth
 * revisiting against real situational splits once the interactive mode has been
 * played enough to know which calls feel weak.
 */
export function tacticMods(tactic?: Tactic): TacticMods | undefined {
  switch (tactic) {
    case 'hitrun':
      // Runner moving means holes open, but a swing you have to take.
      return { events: { single: 1.06, homerun: 0.85, walk: 0.85 }, doublePlay: 0.05 };
    case 'contact':
      // Shorten up: give away power to put it in play and get the run home.
      return { events: { homerun: 0.80, single: 1.04, walk: 0.90 }, sacFly: 0.58 };
    case 'groundball':
      return { events: { homerun: 0.78, walk: 1.10 }, groundBall: 1.45, doublePlay: 0.20 };
    case 'around':
      // Nothing over the plate. He may take his base, and that is fine.
      return { events: { walk: 2.0, homerun: 0.50, double: 0.78, single: 0.82 } };
    case 'infieldIn':
      // The genuine trade: the infield plays shallow to cut the run down at the
      // plate, and in exchange every ground ball has more room to get through.
      // Real infields give up roughly a hundred points of average doing this.
      return { events: { single: 1.20 }, scoreFromThird: 0.12, doublePlay: 0.24 };
    default:
      return undefined;
  }
}

/**
 * Extras start with a runner on second from this inning, per the NCAA rule the
 * spec cites. Set it above the guard to switch the tiebreaker off.
 */
const EXTRA_INNINGS_TIEBREAK = 10;

/**
 * Chance a pitch gets past an average catcher with a man on base.
 *
 * Passed balls and wild pitches together, because from the runner's side they
 * are the same play and the engine has no pitch location to tell them apart.
 * Rolled once per batter with somebody on, which measures at 0.63 a team a game.
 *
 * Deliberately short of the real figure, and worth being plain about why. The
 * majors run about 0.45 of these a team a game and Division I runs well over
 * one, because college pitchers miss by more and college catchers are twenty
 * years old. Ours sits between the two. Every one of them is a base the offence
 * did not earn, the run environment is calibrated to within a few percent of a
 * sourced target, and the college rate would spend that whole margin on one
 * play. Raise it only alongside a recalibration, never on its own.
 */
const PASSED_BALL_RATE = 0.030;

const ORD = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th','13th','14th','15th'];

const blankHit = (): HitLine =>
  ({ ab: 0, r: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, bb: 0, k: 0, hbp: 0, sb: 0, cs: 0 });
const blankPit = (): PitchLine =>
  ({ outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, pitches: 0, bf: 0 });
const blankFld = (): FieldLine =>
  ({ chances: 0, plays: 0, expected: 0, errors: 0, throwing: 0, pb: 0, sba: 0, cs: 0 });

export type BattingLine = HitLine & { player: Hitter };
export type PitchingLine = PitchLine & { player: Pitcher };
/** The pitcher is on here too: he fields comebackers like anybody else. */
export type FieldingLine = FieldLine & { player: Player };

/** First, second, third. A tuple so index access stays checked. */
export type Bases = [Hitter | null, Hitter | null, Hitter | null];

export interface SimOptions {
  engine?: EngineName;
  verbose?: boolean;
  /** Seven innings, ten run lead. Defaults on; pass false to play it out. */
  runRule?: boolean;
  /**
   * Collect the PlayEvent stream for the presentation layer. Off by default:
   * a calibration run sims millions of plate appearances and has no use for it.
   */
  playEvents?: boolean;
  /**
   * Which rotation slot starts, by index. A weekend series runs 0, 1, 2 across
   * its three games; the midweek arm is 3. Defaults to the Friday starter.
   */
  homeStarter?: number;
  awayStarter?: number;
  /**
   * The order to bring relievers in, most rested first. Without it every game
   * reaches for bullpen[0], who then throws ninety innings while five team-mates
   * throw none. The season decides the order; the game just follows it.
   */
  homeBullpen?: readonly Pitcher[];
  awayBullpen?: readonly Pitcher[];
  /**
   * The batting order for this game only. Lets the season rest a regular
   * without mutating the roster, which is how a bench player gets a start.
   */
  homeLineup?: readonly Hitter[];
  awayLineup?: readonly Hitter[];
  /** Each coach's policy. Defaults to a neutral one on both sides. */
  homeStrategy?: Strategy;
  awayStrategy?: Strategy;
  /**
   * The user coach's offense and defense skills, on whichever side he runs.
   * Deliberately tiny — at 99 each is worth well under half of home field —
   * because a skill tree that decides games replaces the roster as the thing
   * that matters. Absent for every computer program.
   */
  homeCoachMods?: { offense: number; defense: number };
  awayCoachMods?: { offense: number; defense: number };
  /**
   * A bracket game rather than a Tuesday in April.
   *
   * The only thing in the engine that reads it is the BIG STAGE badge, which is
   * the whole reason it exists: a badge that fires in the postseason cannot be
   * built without the engine being told which games those are, and the
   * alternative — inferring it from the day number — would have put a schedule
   * assumption three layers below where schedules live.
   */
  postseason?: boolean;
}

export interface GameResult {
  home: TeamState;
  away: TeamState;
  innings: number;
  log: string[];
  /** Empty unless SimOptions.playEvents was set. */
  playEvents: PlayEvent[];
  /**
   * The pitcher of record for each side, by the real rule rather than "whoever
   * started": the win belongs to whoever was on the mound for the winning team
   * when it took the lead it never gave back, and the loss to the pitcher who
   * surrendered that lead.
   *
   * Crediting the starter instead produced visible nonsense — a reliever with 85
   * innings and no decisions at all, winning Pitcher of the Year at 0-0.
   */
  winningPitcher: Pitcher | null;
  losingPitcher: Pitcher | null;
}

type Say = (s: string) => void;

export class TeamState {
  readonly team: Team;
  readonly isHome: boolean;
  readonly order: Hitter[];
  /** The starting nine, frozen before any substitution touches `order`. */
  readonly starters: readonly Hitter[];
  spot = 0;
  runs = 0;
  hits = 0;
  readonly lineScore: number[] = [];
  pitcher: Pitcher;
  penIndex = 0;
  pitcherPitches = 0;
  /**
   * How the man on the mound is carrying himself, 0 to 1, half being level.
   *
   * Beside `pitcherPitches` because they are the pair: one is what he has
   * spent and cannot get back, the other is how he is holding up and can. Reset
   * together on a pitching change, for the same reason.
   */
  pitcherConfidence: number = CONFIDENCE.start;
  /** Whether the one mound visit this man is allowed has been used. */
  visitUsed = false;
  readonly batting = new Map<string, BattingLine>();
  readonly pitching = new Map<string, PitchingLine>();
  readonly fielding = new Map<string, FieldingLine>();
  readonly timesThrough = new Map<string, number>();
  readonly defense: number;
  /** Average outfield arm, for runners testing it. */
  readonly arm: number;
  /**
   * The man behind the plate. Steals were resolved off runner speed and the
   * pitcher's hold rating alone — the throw was never made by anybody. In real
   * baseball the catcher's arm is the single biggest factor in whether a runner
   * is out, and until now it did not exist.
   *
   * Falls back to the weakest defensive spot on the field if a lineup somehow
   * has no catcher, so a malformed roster costs runs rather than throwing.
   */
  readonly catcher: Hitter;
  /**
   * The nine men on the field, by where they stand. This is what lets a batted
   * ball be fielded by a *person* — so range, hands and the play log can stop
   * treating the defence as one averaged blob.
   */
  readonly byPosition = new Map<Position, Hitter>();

  /** The arm that took the ball, kept so the season layer can credit the decision. */
  readonly starter: Pitcher;
  /** Relief order for this game, most rested first. */
  readonly relief: readonly Pitcher[];
  /** Bench bats already used. Once a man is out he cannot return — NCAA rule. */
  readonly usedBench: Hitter[] = [];
  /**
   * Arms already brought in. The managed game picks from anywhere in the pen,
   * so "who is left" cannot be a watermark index — choosing the third-listed
   * arm must not discard the two ahead of him, and a man taken out must never
   * be offered again.
   */
  readonly usedPen: Pitcher[] = [];
  /** How this coach plays. See engine/strategy.ts. */
  readonly strategy: Strategy;
  /**
   * The coach-skill nudge, as multipliers ready for the plate appearance
   * context. Both sit at 1 for the default skill of 20 and move a basis point
   * per point of skill — 1.0079 at the cap, against a home field edge of 1.020.
   * A trained coach is a light thumb on the scale, not a sixth infielder.
   */
  readonly coachOffMult: number;
  readonly coachDefMult: number;
  /**
   * How much less often a runner tests this outfield, from CANNON.
   *
   * Computed once here rather than per play because it is a property of who is
   * standing out there, and folded across the three of them by the share of
   * balls each sees: one gold arm in left is a third of the outfield, not all of
   * it. One for an outfield nobody has hung a badge on, which is nearly all of
   * them.
   */
  readonly holdEdge: number;
  /**
   * A bracket game. Set by `simGame` from its options; false for a friendly,
   * a replay and every regular season night. Only BIG STAGE reads it.
   */
  postseason = false;

  constructor(
    team: Team,
    isHome: boolean,
    starterIndex = 0,
    relief: readonly Pitcher[] = team.bullpen,
    lineup: readonly Hitter[] = team.lineup,
    strategy: Strategy = DEFAULT_STRATEGY,
    coachMods?: { offense: number; defense: number },
  ) {
    this.strategy = strategy;
    this.coachOffMult = 1 + ((coachMods?.offense ?? 20) - 20) * 0.0001;
    this.coachDefMult = 1 - ((coachMods?.defense ?? 20) - 20) * 0.0001;
    this.team = team;
    this.isHome = isHome;
    this.order = lineup.slice(0, 9);
    // The nine who took the field for the first pitch. `order` is mutated by
    // every pinch hit, so by the last out it says who *finished* the game —
    // the box score needs who started it, both to label substitutes and to
    // print a starter who was lifted before he ever batted.
    this.starters = this.order.slice();
    const starter = team.rotation[starterIndex] ?? team.rotation[0];
    if (!starter) throw new Error(`${team.name} has no starting pitcher`);
    this.pitcher = starter;
    this.starter = starter;
    this.relief = relief.length > 0 ? relief : team.bullpen;
    // Averaged over the men who actually take the field, and weighted by how
    // often each of them gets a ball.
    //
    // Two corrections, both of which otherwise biased the baseline downward and
    // so made the average fielder look above average. The DH is generated ten
    // points light on range precisely because he does not field, and including
    // him is simply wrong. And balls are not hit evenly around the diamond: the
    // shortstop, second baseman and centre fielder see far more of them than the
    // corners, and those are exactly the positions the defensive spectrum gives
    // a range premium to. An unweighted mean therefore sits below the range of
    // the man who actually fields the ball, and `edge` came out positive on
    // average — turning what should be a redistribution between fielders into a
    // league-wide defensive upgrade worth about 1% of scoring.
    const gloves: Player[] = this.order.filter((p) => p.pos !== 'DH');
    // The man on the mound belongs in this average now that comebackers reach
    // him. Leaving him out would put a 48-range fielder on roughly a twentieth of
    // the balls in play while the baseline `edge` is measured against pretended
    // he was not there — which is the same silent league-wide offense change the
    // DH correction above was written to stop, in the other direction. The
    // starter stands in for whoever is pitching at the time; a reliever moves
    // this by a fraction of a rating point.
    gloves.push(starter);
    let weighted = 0, weight = 0;
    for (const p of gloves) {
      const w = FIELDING_SHARE[p.pos] ?? 0.11;
      weighted += p.range * w;
      weight += w;
    }
    this.defense = weight > 0
      ? weighted / weight
      : team.lineup.reduce((a, p) => a + p.range, 0) / team.lineup.length;
    // Actually the outfield's arm, as the field above always claimed. Averaging
    // all nine let a strong-armed catcher and third baseman cover for corner
    // outfielders who cannot throw, which is exactly backwards: it is the man in
    // left field a runner is testing.
    const outfield = this.order.filter((p) => p.pos === 'LF' || p.pos === 'CF' || p.pos === 'RF');
    this.arm = outfield.length > 0
      ? outfield.reduce((a, p) => a + p.arm, 0) / outfield.length
      : team.lineup.reduce((a, p) => a + p.arm, 0) / team.lineup.length;
    // A badge is not a rating, so this does not raise anyone's arm — it lowers
    // how often a runner takes the chance, which is what an arm is actually
    // worth. Divided by three because a runner tests the outfielder the ball was
    // hit to and not the other two.
    let hold = 1;
    for (const p of outfield) hold *= 1 - (1 - holdBonus(p)) / 3;
    this.holdEdge = hold;
    const backstop = this.order.find((p) => p.pos === 'C') ?? team.lineup.find((p) => p.pos === 'C');
    this.catcher = backstop ?? (this.order[0] as Hitter);
    // First man at each spot wins; a lineup with two shortstops is a lineup bug,
    // not something to resolve here.
    for (const p of this.order) if (!this.byPosition.has(p.pos)) this.byPosition.set(p.pos, p);
  }

  /**
   * The E column, summed from the men who actually booted the ball rather than
   * counted alongside them.
   *
   * An error used to land on a team counter and nowhere else, which is why no
   * defensive play in this game had ever been attributed to a player. Deriving
   * the total instead of tracking it in parallel means the box score and the
   * fielding lines cannot disagree — there is one place an error is recorded and
   * this reads it.
   */
  get errors(): number {
    let n = 0;
    for (const f of this.fielding.values()) n += f.errors;
    return n;
  }

  hitLine(p: Hitter): BattingLine {
    let line = this.batting.get(p.name);
    if (!line) { line = { player: p, ...blankHit() }; this.batting.set(p.name, line); }
    return line;
  }

  pitchLine(p: Pitcher): PitchingLine {
    let line = this.pitching.get(p.name);
    if (!line) { line = { player: p, ...blankPit() }; this.pitching.set(p.name, line); }
    return line;
  }

  fieldLine(p: Player): FieldingLine {
    let line = this.fielding.get(p.name);
    if (!line) { line = { player: p, ...blankFld() }; this.fielding.set(p.name, line); }
    return line;
  }

  /** Send a bench bat up in place of whoever is due. */
  pinchHit(spot: number, sub: Hitter): Hitter | null {
    const out = this.order[spot];
    if (!out) return null;
    this.order[spot] = sub;
    this.usedBench.push(sub);
    return out;
  }

  nextBatter(): Hitter {
    const b = this.order[this.spot];
    if (!b) throw new Error(`${this.team.name} has an empty lineup slot`);
    this.spot = (this.spot + 1) % 9;
    return b;
  }
}

/**
 * The rules that end a half inning or a game, in one place so the fast
 * simulation and the interactive manager cannot disagree about them.
 */
export const RULES = {
  /** The home team does not bat in the ninth or later when it is already ahead. */
  skipBottom: (inning: number, home: TeamState, away: TeamState): boolean =>
    inning >= 9 && home.runs > away.runs,

  /** After a half inning: is the game decided? */
  decided: (
    half: 'top' | 'bottom', inning: number,
    home: TeamState, away: TeamState, runRule: boolean,
  ): boolean => {
    if (half === 'top' && inning >= 9 && home.runs > away.runs) return true;
    if (half === 'bottom' && inning >= 9 && home.runs !== away.runs) return true;
    if (runRule && inning >= 7 && Math.abs(home.runs - away.runs) >= 10) return true;
    return false;
  },
};

export function simGame(
  homeTeam: Team,
  awayTeam: Team,
  rng: Rng,
  opts: SimOptions = {},
): GameResult {
  const engine: EngineFn = ENGINES[opts.engine ?? 'log5'];
  const verbose = opts.verbose ?? false;
  const log: string[] = [];
  const say: Say = (s) => { if (verbose) log.push(s); };

  const home = new TeamState(
    homeTeam, true, opts.homeStarter ?? 0, opts.homeBullpen, opts.homeLineup, opts.homeStrategy,
    opts.homeCoachMods,
  );
  const away = new TeamState(
    awayTeam, false, opts.awayStarter ?? 0, opts.awayBullpen, opts.awayLineup, opts.awayStrategy,
    opts.awayCoachMods,
  );
  if (opts.postseason) { home.postseason = true; away.postseason = true; }
  const playEvents: PlayEvent[] | null = opts.playEvents ? [] : null;

  // Updated every time the lead changes hands. Whatever is here when the game
  // ends is the decision.
  let leadHolder: TeamState | null = null;
  let creditTo: Pitcher | null = null;
  let blameTo: Pitcher | null = null;
  const onScore = (bat: TeamState, fld: TeamState): void => {
    if (bat.runs <= fld.runs) return;          // scored but did not take the lead
    if (leadHolder === bat) return;            // already ahead; not a lead change
    leadHolder = bat;
    creditTo = bat.pitcher;                    // his team went ahead while he was in
    blameTo = fld.pitcher;                     // he gave it up
  };

  let inning = 1;
  let over = false;

  while (!over) {
    for (const half of ['top', 'bottom'] as const) {
      if (half === 'bottom' && RULES.skipBottom(inning, home, away)) { over = true; break; }
      const bat = half === 'top' ? away : home;
      const fld = half === 'top' ? home : away;

      say(`\n--- ${half === 'top' ? 'Top' : 'Bottom'} ${ORD[inning - 1]} --- (${away.runs}-${home.runs})`);
      const before = bat.runs;
      playHalfInning(
        bat, fld, inning, engine, rng, say,
        half === 'bottom' && inning >= 9, playEvents, onScore,
      );
      bat.lineScore.push(bat.runs - before);

      if (RULES.decided(half, inning, home, away, opts.runRule !== false)) { over = true; break; }
    }
    inning++;
    // Generous now that the tiebreaker resolves games: this is a runaway guard,
    // not a rule. A game reaching it tied means something is broken.
    if (inning > 30) over = true;
  }

  const homeWon = home.runs > away.runs;
  const winnerIs = homeWon ? home : away;
  return {
    home,
    away,
    innings: inning - 1,
    log,
    playEvents: playEvents ?? [],
    // leadHolder is the side that led last, which is the side that won.
    winningPitcher: leadHolder === winnerIs ? creditTo : null,
    losingPitcher: leadHolder === winnerIs ? blameTo : null,
  };
}

/**
 * A half inning you can advance one plate appearance at a time.
 *
 * The fast simulation drives this in a tight loop; the interactive manager
 * drives it one call per decision. Both go through the same `step`, so a
 * managed game and a simulated one cannot diverge — there is one implementation
 * of what a plate appearance does, not two.
 *
 * canWalkOff is true only for the home half of the 9th or later. When it is set,
 * the inning ends the moment the batting team goes ahead.
 */
export interface HalfInning {
  readonly outs: number;
  readonly bases: Readonly<Bases>;
  readonly done: boolean;
  /** Resolve one plate appearance. Returns true when the half inning is over. */
  step: (tactic?: Tactic) => boolean;
}

export function createHalfInning(
  bat: TeamState,
  fld: TeamState,
  inning: number,
  engine: EngineFn,
  rng: Rng,
  say: Say,
  canWalkOff = false,
  events: PlayEvent[] | null = null,
  onScore?: (bat: TeamState, fld: TeamState) => void,
  /**
   * True when a human is managing that side, so the engine keeps its hands off
   * its calls. Split per side because a managed game has one human dugout and
   * one computer dugout: the computer's runners still steal and its bullpen
   * still turns over, while the human's do nothing he did not ask for.
   */
  manualOffense = false,
  manualDefense = false,
): HalfInning {
  let outs = 0;
  const bases: Bases = [null, null, null];
  const blame = new Map<Hitter, Pitcher>();   // runner -> pitcher who allowed him on

  // The college tiebreaker: from the tenth, each half starts with a runner on
  // second — the player who made the last out, as the rule specifies. Without it
  // tied games grind on until the inning guard trips and the engine returns a
  // tie, which is not a thing that happens in baseball. It surfaced the moment
  // the league was recalibrated to a lower scoring environment.
  if (inning >= EXTRA_INNINGS_TIEBREAK) {
    const placed = bat.order[(bat.spot + 8) % 9];
    if (placed) bases[1] = placed;
  }

  const addOuts = (n: number): void => { outs += n; fld.pitchLine(fld.pitcher).outs += n; };

  /**
   * Runs cross the plate in three separate places in here — the walk that forces
   * one in, the bunt, and the plate appearance proper — and each has to charge
   * the runner, the pitcher who put him on, and the earned split the same way.
   * They did not: the intentional walk threw its list of scorers away unread, so
   * a bases-loaded free pass erased the man on third instead of scoring him.
   */
  const bringHome = (runners: readonly Hitter[], pitcher: Pitcher, earned: boolean): void => {
    for (const runner of runners) {
      bat.hitLine(runner).r++;
      const guilty = blame.get(runner) ?? pitcher;
      const gl = fld.pitchLine(guilty);
      gl.r++;
      if (earned) gl.er++;
    }
    bat.runs += runners.length;
  };

  let finished = false;

  // A steal, wherever it came from, is an event of its own: the runner moves or
  // he is an out, and a caught runner is an out like any other — for years of
  // prototypes he simply vanished from first with the outs counter untouched,
  // which handed the batting team a free erased baserunner. Returns true when
  // the out it recorded was the third, which ends the half with the batter's
  // turn still to come: he leads off the next inning, which is how the rule works.
  const resolveSteal = (forced: boolean): boolean => {
    // The automatic game takes second and only second. League stolen base and
    // caught stealing rates are calibrated against that, and a computer dugout
    // that also started taking third would move both without anyone having
    // decided to. A manager who calls for it gets whichever bag is open.
    const target = forced ? stealTarget(bases) : 2;
    if (target === null) return false;
    const stole = attemptSteal(bases, bat, fld, rng, say, forced, events, target);
    if (stole !== 'caught') return false;
    addOuts(1);
    if (events) events.push({ kind: 'out', outs: 1 });
    return outs >= 3;
  };

  /**
   * A pitch gets past the catcher.
   *
   * Rolled only with somebody on, and not because it never happens otherwise —
   * a ball to the backstop with the bases empty is simply a ball, and rolling
   * for it would spend a random draw to produce no baseball at all.
   *
   * Not an out and not a plate appearance: everybody moves up and the same man
   * is still standing at the plate, so it resolves out here beside the steal
   * rather than inside the at-bat. It is also not an error, by rule — a passed
   * ball is its own line in the book and the runs it lets in stay earned, which
   * is why nothing here touches the fielding line's error column.
   *
   * Returns true when the run it let in ended the game.
   */
  const resolvePassedBall = (): boolean => {
    if (!bases[0] && !bases[1] && !bases[2]) return false;
    const catcher = fld.catcher;
    // The catcher's job first and the pitcher's second. A ball in the dirt is
    // half the pitcher's doing, which is the one other place `control` earns
    // its keep beyond the walk column.
    const chance = clamp(
      PASSED_BALL_RATE * mult(catcher.blocking, -0.55) * mult(fld.pitcher.control, -0.25),
      0, 0.25,
    );
    if (rng() >= chance) return false;

    const before: Bases = [bases[0], bases[1], bases[2]];
    const home: Hitter[] = [];
    // Lead runner first, so nobody is written on top of anybody — the same rule
    // `advanceOnHit` spends thirty lines protecting.
    if (bases[2]) { home.push(bases[2]); bases[2] = null; }
    if (bases[1]) { bases[2] = bases[1]; bases[1] = null; }
    if (bases[0]) { bases[1] = bases[0]; bases[0] = null; }

    fld.fieldLine(catcher).pb++;
    say(`   The pitch gets by ${catcher.name}.`);
    for (const r of home) say(`   ${r.name} scores from third.`);
    bringHome(home, fld.pitcher, true);
    if (events) {
      const moves = runnerMoves(before, bases, home);
      if (moves.length > 0) events.push({ kind: 'advance', runners: moves });
      if (home.length > 0) events.push({ kind: 'score', runs: home.length });
    }
    if (home.length > 0) onScore?.(bat, fld);
    return canWalkOff && bat.runs > fld.runs;
  };

  const step = (calledFor?: Tactic): boolean => {
    // A computer-run side makes its own calls. Under manual management the coach
    // has already made his, and the engine must not second-guess him.
    const tactic = calledFor ?? (manualOffense ? undefined : chooseTactic(bat, fld, inning, outs, bases, rng));
    if (finished) return true;
    const called = tacticMods(tactic);

    // A called steal happens before the pitch and does not consume the batter:
    // it resolves on its own and control goes back to the manager with the same
    // man still due at the plate. Only a manager ever calls it — the fast path
    // takes its steals through the automatic check below.
    if (tactic === 'steal') {
      if (resolveSteal(true)) { finished = true; return true; }
      return false;
    }

    // The automatic game. Under manual management each of these is the coach's
    // call, and having the engine quietly make it too would steal with his
    // runners and burn his bench and bullpen out from under him.
    if (!manualDefense) maybeChangePitcher(fld, say);
    // The visit goes before the hook on purpose: a bench that has a settled man
    // available should try talking to him before it burns a reliever.
    if (!manualDefense) maybeMoundVisit(fld, bases.some(Boolean), say);
    if (!manualOffense) maybePinchHit(bat, fld, inning, rng, say);
    if (!manualOffense && resolveSteal(false)) { finished = true; return true; }

    // Nobody calls for this one. It runs in a managed game exactly as it does in
    // a simulated one, because a ball off the catcher's shin guard is not a
    // decision anybody made.
    if (resolvePassedBall()) {
      say(`   ${bat.team.name} win it.`);
      finished = true;
      return true;
    }

    const pitcher = fld.pitcher;
    const batter = bat.nextBatter();
    const bLine = bat.hitLine(batter);
    const pLine = fld.pitchLine(pitcher);

    // Snapshot after the steal check so the event stream describes the plate
    // appearance itself; the steal emitted its own advance and out above.
    const basesBefore: Bases = [bases[0], bases[1], bases[2]];
    const outsBefore = outs;

    // Buffered so the batter's line comes first. The runner detail has to be
    // worked out before the headline can be printed — the headline counts the
    // runs — but "Torres scores from second" printed above "Ramirez singles"
    // reads as a different inning.
    const notes: string[] = [];
    const note: Say = (line) => { notes.push(line); };

    // Two calls are not outcomes to be nudged — they are decisions that settle
    // the plate appearance on their own.
    if (tactic === 'ibb') {
      bLine.bb++; pLine.bb++; pLine.bf++;
      const forced: Hitter[] = [];
      forceAdvance(bases, batter, forced, blame, pitcher);
      say(`[intentional] ${batter.name} is walked on purpose.`);
      // With the bases loaded the free pass is not free: the man on third walks
      // in. He used to be dropped on the floor instead — no run, no out, and one
      // fewer runner than the inning started with.
      for (const runner of forced) say(`   ${runner.name} is forced home.`);
      bringHome(forced, pitcher, true);
      bLine.rbi += forced.length;
      if (events) {
        const moves = runnerMoves(basesBefore, bases, forced);
        if (moves.length > 0) events.push({ kind: 'advance', runners: moves });
        if (forced.length > 0) events.push({ kind: 'score', runs: forced.length });
      }
      if (forced.length > 0) onScore?.(bat, fld);
      if (canWalkOff && bat.runs > fld.runs) {
        say(`   ${bat.team.name} win it.`);
        finished = true; return true;
      }
      if (outs >= 3) { finished = true; return true; }
      return false;
    }

    if (tactic === 'bunt') {
      const buntBases: Bases = [bases[0], bases[1], bases[2]];
      const buntOuts = outs;
      const res = sacrifice(bases, batter, outs, rng, bLine, pLine, blame, pitcher, note);
      addOuts(res.outs);
      // A beaten-out bunt is a hit everywhere a hit is counted. The batting and
      // pitching lines already took it inside `sacrifice`; the team counter —
      // the H column of the line score — did not, so the box score's team hits
      // ran one short of its own player lines every time a bunt got down.
      if (res.hit) bat.hits++;
      pLine.bf++;
      // The pitch he bunted. It was thrown, the event stream has always said so,
      // and the pitching line did not count it — so a game with a bunt in it
      // emitted one more pitch event than the box score claimed had been thrown.
      // Only ever visible on a seed that happened to produce one, which is how
      // it survived: `tests/play-events.test.ts` measures exactly this equality
      // and its fixed seed had never bunted.
      pLine.pitches++;
      fld.pitcherPitches++;
      say(`[bunt] ${batter.name} ${res.text}`);
      for (const line of notes) say(line);

      // A bunt has to emit events like any other plate appearance. It resolves
      // without going through the pitch engine, so it produced a log line and no
      // events at all — which left the replay one group short for the rest of
      // the game and put a phantom fourth out in an inning. The play log and the
      // event stream have to stay one to one.
      if (events) {
        events.push({ kind: 'pitch', pitch: 'inplay' });
        events.push({ kind: 'contact', battedBall: 'ground' });
        const moves = runnerMoves(buntBases, bases, res.scored);
        if (moves.length > 0) events.push({ kind: 'advance', runners: moves });
        if (outs > buntOuts) events.push({ kind: 'out', outs: outs - buntOuts });
        if (res.scored.length > 0) events.push({ kind: 'score', runs: res.scored.length });
      }
      bringHome(res.scored, pitcher, true);
      bLine.rbi += res.scored.length;
      if (res.scored.length > 0) onScore?.(bat, fld);
      if (canWalkOff && bat.runs > fld.runs) {
        say(`   ${bat.team.name} win it.`);
        finished = true; return true;
      }
      if (outs >= 3) { finished = true; return true; }
      return false;
    }

    /*
      What the arm is carrying, as one number.

      Fatigue and confidence are separate states and are shown separately, but
      they arrive at the plate appearance the same way -- as a multiplier on the
      pitcher. Multiplied rather than added so neither can cancel the other out:
      a settled man who is out of pitches is still out of pitches.
    */
    const fatigueMult = fatigueMultiplier(pitcher, fld.pitcherPitches, fatigueBonus(pitcher))
      * confidenceMultiplier(fld.pitcherConfidence)
      /*
        And the season in his arm, which is a different tiredness from the one
        he is spending inside this outing. A hundred and ten innings into a
        college spring is a real thing and the two multiply: a tired arm having
        a long night is both.
      */
      * armMultiplier(pitcher);
    const tto = (fld.timesThrough.get(batter.name) ?? 0) + 1;
    fld.timesThrough.set(batter.name, tto);

    // Where in the game we are, described once and handed to both the tendency
    // layer and the badge layer, so the two cannot end up disagreeing about
    // whether a runner is in scoring position.
    const traits = plateTraits(batter, pitcher, fld.catcher, {
      risp: bases[1] !== null || bases[2] !== null,
      runnersOn: bases.some(Boolean),
      timesThrough: tto,
      outs,
      inning,
      margin: bat.runs - fld.runs,
      leadingOff: outs === 0 && !bases[0] && !bases[1] && !bases[2],
      postseason: bat.postseason,
    });

    const pa = engine(batter, pitcher, {
      isHome: bat.isHome,
      runnersOn: bases.some(Boolean),
      timesThrough: tto,
      fatigueMult,
      // The fielding coach's skill rides on the same lever team defence uses.
      defenseMult: mult(fld.defense, -0.12) * fld.coachDefMult,
      /*
        The hitting coach's, on the batting side's whole event distribution --
        and with it the two things stage 9 added to the man himself: what a
        season in the legs has done to him, and what he thinks of the place.

        Both are deliberately tiny, three percent each at the very floor. A
        mood is not a rating and a tired man has not forgotten how to hit; the
        weight of both systems sits in the injury roll and the portal, not
        here. Multiplied so a tired *and* unhappy man is both, which is worse
        than either and still under six percent.
      */
      offenseMult: bat.coachOffMult * legMultiplier(batter) * moodMultiplier(batter),
      // A shift is a bet on this hitter, not a flat upgrade — and a hitter who
      // pulls everything is a better bet than his power rating alone says.
      alignment: alignmentAgainst(fld.strategy.alignment, batter, shiftBias(batter)),
      traits,
      ...(called ? { mods: called } : {}),
    }, rng);

    fld.pitcherPitches += pa.pitches.length;
    pLine.pitches += pa.pitches.length;
    pLine.bf++;

    const hand = `${batter.bats} vs ${pitcher.throws}HP`;
    const cnt = describeCount(pa.pitches);
    const scored: Hitter[] = [];

    let event: string = pa.event;
    let errored = false;

    // Whoever the ball was hit at. Null on a strikeout, walk or hit by pitch,
    // where nobody fields anything.
    const fielder = pa.kind === 'strikeout' || pa.kind === 'walk' || pa.kind === 'hbp'
      ? null
      : fielderFor(fld, pa.kind, batter, rng);

    // What an average glove on this team would have done with it, taken before
    // the man actually standing there gets a say. That is the baseline his
    // fielding line is measured against, and it is the same baseline the range
    // swing below works from — so "plays above expected" is the range model's
    // own arithmetic read back out, rather than a second opinion about it.
    const expectedOut = event === 'out' && pa.kind !== 'strikeout';

    // Range first: does he get to it at all? Then hands: having got there, does
    // he handle it? That is the real order of events on a ground ball, and
    // keeping them separate is the whole reason the two ratings exist.
    //
    // Measured against his own team's average rather than against 50, so the
    // team-level defensive environment stays where `defenseMult` already put it
    // and this only redistributes plays between the men on the field. The
    // expected edge is zero by construction, which is what keeps league offense
    // from moving when a good shortstop is nothing more than a good shortstop.
    if (fielder && pa.kind !== 'strikeout') {
      const edge = fielder.range - fld.defense;
      if (event === 'single' && edge > 0) {
        if (rng() < RANGE_SWING * (edge / 50)) event = 'out';
      } else if (event === 'out' && edge < 0) {
        if (rng() < RANGE_SWING * OUT_TO_HIT_BALANCE * (-edge / 50)) event = 'single';
      }
    }

    if (event === 'out' && pa.kind !== 'strikeout' && fielder) {
      // His hands, not the team's average — and a scorched grounder is a much
      // better chance to boot one than a lazy fly.
      const chance = GLOVE_ERROR_BASE * ERROR_BY_KIND * (KIND_ERROR_RISK[pa.kind] ?? 1)
        * mult(fielder.hands, -0.55) * gloveBonus(fielder);
      if (rng() < chance) { event = 'error'; errored = true; }
      // Having fielded it cleanly, he still has to get it across the diamond.
      // Second roll rather than one combined chance because the two failures do
      // different things to the inning: a booted ball is a runner on first, a
      // throw into the camera well is a runner on first and everybody else up a
      // base. Only a ground ball involves a throw at all.
      else if (pa.kind === 'ground') {
        const risk = throwRisk(fielder, fld.pitcher);
        if (risk > 0 && rng() < risk) { event = 'throwing'; errored = true; }
      }
    }

    // His day, one line per man, whoever he is. Home runs are excluded because
    // nobody had a chance at one; everything else hit into his zone was a play
    // that could have been made.
    if (fielder && event !== 'homerun') {
      const fLine = fld.fieldLine(fielder);
      fLine.chances++;
      if (expectedOut) fLine.expected++;
      if (event === 'out') fLine.plays++;
    }

    switch (event) {
      case 'walk':
        bLine.bb++; pLine.bb++;
        forceAdvance(bases, batter, scored, blame, pitcher);
        say(`${cnt} ${batter.name} walks. (${hand})`);
        // The only run in the game nobody swung at. With the bases loaded the
        // scoreboard moved and the log never said whose run it was.
        for (const r of scored) note(`   ${r.name} is forced home.`);
        break;
      case 'hbp':
        bLine.hbp++;
        forceAdvance(bases, batter, scored, blame, pitcher);
        say(`${cnt} ${batter.name} is hit by the pitch.`);
        for (const r of scored) note(`   ${r.name} is forced home.`);
        break;
      case 'error':
        bLine.ab++;
        if (fielder) fld.fieldLine(fielder).errors++;
        addOuts(advanceOnHit(bases, batter, 1, rng, scored, blame, pitcher, RUNNING[bat.strategy.running], fld.arm, note, 0, fld.holdEdge));
        say(`${cnt} ${batter.name} reaches on an error by ${fielder?.name ?? 'the defense'}.`);
        break;
      case 'throwing':
        bLine.ab++;
        if (fielder) {
          const fl = fld.fieldLine(fielder);
          fl.errors++; fl.throwing++;
        }
        // The extra base is the entire difference between this and a booted
        // ball. Nobody is thrown out on it either — the ball is loose and there
        // is no throw left to make, which is why `advanceOnHit` skips its own
        // risk check when the bonus is on.
        addOuts(advanceOnHit(bases, batter, 1, rng, scored, blame, pitcher, RUNNING[bat.strategy.running], fld.arm, note, 1, fld.holdEdge));
        say(`${cnt} ${batter.name} reaches on a throwing error by ${fielder?.name ?? 'the defense'}; the ball gets away.`);
        break;
      case 'single':
        bLine.ab++; bLine.h++; bat.hits++; pLine.h++;
        addOuts(advanceOnHit(bases, batter, 1, rng, scored, blame, pitcher, RUNNING[bat.strategy.running], fld.arm, note, 0, fld.holdEdge));
        say(`${cnt} ${batter.name} singles${scored.length ? `, ${scored.length} in` : ''}. (${hand})`);
        break;
      case 'double':
        bLine.ab++; bLine.h++; bLine.d++; bat.hits++; pLine.h++;
        addOuts(advanceOnHit(bases, batter, 2, rng, scored, blame, pitcher, RUNNING[bat.strategy.running], fld.arm, note, 0, fld.holdEdge));
        say(`${cnt} ${batter.name} doubles${scored.length ? `, ${scored.length} in` : ''}. (${hand})`);
        break;
      case 'triple':
        bLine.ab++; bLine.h++; bLine.t++; bat.hits++; pLine.h++;
        addOuts(advanceOnHit(bases, batter, 3, rng, scored, blame, pitcher, RUNNING[bat.strategy.running], fld.arm, note, 0, fld.holdEdge));
        say(`${cnt} ${batter.name} triples into the gap${scored.length ? `, ${scored.length} in` : ''}.`);
        break;
      case 'homerun':
        bLine.ab++; bLine.h++; bLine.hr++; bat.hits++; pLine.h++; pLine.hr++;
        addOuts(advanceOnHit(bases, batter, 4, rng, scored, blame, pitcher, RUNNING[bat.strategy.running], fld.arm, note, 0, fld.holdEdge));
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
          const res = resolveOut(bases, batter, pa.kind, outs, rng, scored, blame, pitcher, called, fielder, note);
          addOuts(res.outs);
          say(`${cnt} ${batter.name} ${res.text}`);
        }
      }
    }

    for (const line of notes) say(line);

    // On a walk-off the game ends the instant the winning run touches the plate,
    // so trailing runners never score. A home run is the exception: the ball is
    // dead and every run counts.
    let counted = scored.length;
    if (canWalkOff && event !== 'homerun') {
      const needed = fld.runs - bat.runs + 1;
      if (counted >= needed) counted = needed;
    }

    // Credit runs to the runners who scored and to the pitchers responsible.
    // `scored` is ordered lead runner first, which is the order they cross.
    bringHome(scored.slice(0, counted), pitcher, !errored);
    bLine.rbi += errored ? 0 : counted;
    if (counted > 0) onScore?.(bat, fld);

    if (events) {
      for (const p of pa.pitches) events.push({ kind: 'pitch', pitch: p });
      if (BATTED_KINDS.has(pa.kind)) {
        const landing = landingFor(fielder, pa.kind, event, pa.pitches.length);
        events.push({
          kind: 'contact',
          battedBall: pa.kind as BattedBall,
          ...(landing ? { landing } : {}),
        });
      }
      const moves = runnerMoves(basesBefore, bases, scored.slice(0, counted));
      if (moves.length > 0) events.push({ kind: 'advance', runners: moves });
      if (outs > outsBefore) events.push({ kind: 'out', outs: outs - outsBefore });
      if (counted > 0) events.push({ kind: 'score', runs: counted });
    }

    /*
      And what that did to him.

      Applied here rather than at any of the dozen places an event is decided,
      because this is the one point where the whole plate appearance is settled
      -- the event, the errors, and how many actually crossed. Deciding it
      earlier would have meant deciding it several times.

      Takes no random draws: it is arithmetic over what already happened, which
      is the rule every reporting and state-keeping layer in here keeps.
    */
    fld.pitcherConfidence = clamp(
      fld.pitcherConfidence + confidenceShift({
        homeRun: event === 'homer',
        walk: event === 'walk' || event === 'hbp',
        strikeout: pa.kind === 'strikeout',
        hit: event === 'single' || event === 'double' || event === 'triple',
        out: event === 'out',
        runsAllowed: counted,
        runnersOn: bases.filter(Boolean).length,
      }),
      CONFIDENCE.floor,
      CONFIDENCE.ceiling,
    );

    if (canWalkOff && bat.runs > fld.runs) {
      say(`   ${bat.team.name} win it.`);
      finished = true;
      return true;
    }

    if (outs >= 3) { finished = true; return true; }
    return false;
  };

  return {
    get outs() { return outs; },
    get bases() { return bases; },
    get done() { return finished; },
    step,
  };
}

/** The old signature, kept for the fast path: play the half inning straight through. */
function playHalfInning(
  bat: TeamState,
  fld: TeamState,
  inning: number,
  engine: EngineFn,
  rng: Rng,
  say: Say,
  canWalkOff = false,
  events: PlayEvent[] | null = null,
  onScore?: (bat: TeamState, fld: TeamState) => void,
): void {
  const half = createHalfInning(bat, fld, inning, engine, rng, say, canWalkOff, events, onScore);
  while (!half.step()) { /* one plate appearance at a time */ }
}

const BATTED_KINDS: ReadonlySet<PAKind> = new Set<PAKind>(['ground', 'line', 'fly', 'popup']);

/**
 * Which runners moved, in base numbers rather than array indices: 0 is the
 * batter at the plate, 1 through 3 are the bases, 4 is home. Runners who stayed
 * put are omitted, and so are runners erased on a force — the out event carries
 * that, and per-runner outs are Phase 5 detail the field layer does not need yet.
 */
function runnerMoves(
  before: Bases,
  after: Bases,
  scored: readonly Hitter[],
): NonNullable<PlayEvent['runners']> {
  const moves: NonNullable<PlayEvent['runners']> = [];
  const fromOf = (p: Hitter): 0 | 1 | 2 | 3 => {
    const i = before.indexOf(p);
    return i < 0 ? 0 : ((i + 1) as 1 | 2 | 3);
  };
  for (const r of scored) moves.push({ id: r.id, from: fromOf(r), to: 4 });
  for (let i = 0; i < 3; i++) {
    const p = after[i];
    if (!p) continue;
    const to = (i + 1) as 1 | 2 | 3;
    const from = fromOf(p);
    if (from !== to) moves.push({ id: p.id, from, to });
  }
  return moves;
}

function describeCount(pitches: readonly PitchResult[]): string {
  let b = 0;
  let s = 0;
  for (const p of pitches.slice(0, -1)) {
    if (p === 'ball') b++;
    else if (p === 'foul') { if (s < 2) s++; }
    else if (p === 'called' || p === 'swinging') s++;
  }
  return `[${b}-${s} ${pitches.length}p]`;
}

function forceAdvance(
  bases: Bases, batter: Hitter, scored: Hitter[],
  blame: Map<Hitter, Pitcher>, pitcher: Pitcher,
): void {
  if (bases[0] && bases[1] && bases[2]) { scored.push(bases[2]); bases[2] = null; }
  if (bases[0] && bases[1]) { bases[2] = bases[1]; bases[1] = null; }
  if (bases[0]) { bases[1] = bases[0]; bases[0] = null; }
  bases[0] = batter;
  blame.set(batter, pitcher);
}

/**
 * Runners on a hit.
 *
 * Taking an extra base can now end with the runner on the bench. Before this
 * there was no way to fail at it, which made an aggressive baserunning policy
 * pure upside and the setting meaningless. A throw beats a man home roughly four
 * percent of the time he tries; speed helps, the defence's arms hurt, and how
 * hard the coach is sending them scales both the attempt and the risk.
 *
 * Returns the number of runners retired on the bases.
 */
/** How a base is named in the play log. */
const BASE_WORD: readonly string[] = ['first', 'second', 'third'];

export function advanceOnHit(
  bases: Bases, batter: Hitter, numBases: number, rng: Rng,
  scored: Hitter[], blame: Map<Hitter, Pitcher>, pitcher: Pitcher,
  run: { attempt: number; risk: number } = RUNNING.balanced,
  defenceArm = 50,
  say?: Say,
  /**
   * Bases every runner takes on top of whatever the play gave him, and the
   * batter does not. This exists for the wild throw: the batter reaches first
   * like any other error, and the men already on advance further because the
   * ball is rolling loose behind the play. Nobody is thrown out while it is set,
   * for the same reason — there is no throw left to make.
   */
  runnerBonus = 0,
  /**
   * How much less often a runner tests this outfield, from CANNON. One when
   * nobody out there has the badge, which is nearly every outfield.
   */
  holdFactor = 1,
): number {
  let retired = 0;

  // Where the nearest runner ahead ended up, or 3 if he scored and is no longer
  // in the way. The loop runs lead runner first precisely so this is known by
  // the time the man behind him is moved.
  //
  // Without it, runners could be written on top of each other: with men on first
  // and second on a single, the runner from second holds at third and then the
  // runner from first is also sent to third, and `bases[2] = runner` silently
  // overwrites him. No out, no message, one runner simply gone from the inning.
  // Baseball's actual rule is the simple one — runners may not pass each other
  // or share a base — and this is it.
  //
  // -1 means nobody ahead is still on the bases. It cannot be 3, because `dest`
  // of 3 means the runner scored: home plate holds any number of men and is
  // never blocked. Using 3 as the empty value capped a runner trying to score
  // back onto third, on top of the batter arriving there on a triple — trading
  // one lost-runner bug for another.
  let blocked = -1;

  for (let i = 2; i >= 0; i--) {
    const runner = bases[i];
    if (!runner) continue;
    let adv = numBases;
    let tried = false;
    /**
     * The team's policy, then this particular man's.
     *
     * A running policy is the coach's instruction to everybody, and it was the
     * only thing here: a leadoff man with wheels and a catcher with none went
     * first to third at the same rate. GREEN LIGHT and STATION TO STATION are
     * the man's own answer to the sign, and WHEELS is a badge on top of it —
     * one channel, how often he tries for the extra base, and nothing else.
     */
    const own = runningMods(runner);
    const attemptRate = run.attempt * own.attempt * extraBaseBonus(runner) * holdFactor;
    const riskRate = run.risk * own.risk;
    // The bounds differ per situation and always did: a runner on second scores
    // on a single at least a fifth of the time however slow he is, while first
    // to third tops out at three quarters however fast. Collapsing all three into
    // one shared clamp quietly cost the league five percent of its scoring —
    // mostly slow runners no longer scoring from second.
    // Both outcomes differ per situation. Failing to score from first on a double
    // still leaves the runner on third — an earlier version of this helper
    // returned a flat 1 on failure and quietly sent him back to second, costing
    // the league four percent of its runs.
    const go = (
      base: number, extra: number, lo: number, hi: number,
      onMake: number, onHold: number,
    ): number => {
      tried = true;
      return rng() < clamp(base * attemptRate * mult(runner.speed, extra), lo, hi)
        ? onMake : onHold;
    };
    if (numBases === 1 && i === 1) {
      adv = go(BASERUNNING.scoreFromSecondOnSingle, 0.35, 0.20, 0.94, 2, 1);
    } else if (numBases === 1 && i === 0) {
      adv = go(BASERUNNING.firstToThirdOnSingle, 0.45, 0.06, 0.75, 2, 1);
    } else if (numBases === 2 && i === 0) {
      adv = go(BASERUNNING.scoreFromFirstOnDouble, 0.35, 0.18, 0.92, 3, 2);
    }
    adv += runnerBonus;

    bases[i] = null;

    // Traffic is resolved before anything else, because a runner who was held up
    // by the man in front of him did not take the extra base and must not be
    // exposed to being thrown out for it.
    let dest = i + adv;
    if (blocked >= 0 && dest >= blocked) dest = blocked - 1;
    const gained = dest - i;

    // Only a runner who actually took the extra base is exposed. The earlier
    // condition also caught the man who wisely held at third on a double, which
    // is the opposite of what a risk setting should punish.
    // At most one runner is retired per batted ball. The throw can only go to
    // one place, and without the cap two men could be gunned down on the same
    // single — which put a fourth out in the inning and was caught by the replay
    // test rather than by anything in the engine.
    const pushed = numBases === 2 ? gained === 3 : gained === 2;
    if (tried && pushed && retired === 0 && runnerBonus === 0) {
      const thrownOut = clamp(
        BASERUNNING.thrownOutAdvancing * riskRate
          * mult(runner.speed, -0.45) * mult(defenceArm, 0.40),
        0.004, 0.30,
      );
      if (rng() < thrownOut) {
        retired += 1;
        say?.(`   ${runner.name} is thrown out trying for an extra base.`);
        continue;
      }
    }

    // Say what happened to him.
    //
    // Reported from testing: "there was someone on second, the batter lined one
    // to short, and the man on second basically disappeared". He had scored —
    // the log said "singles, 1 in" and never named him, so from the screen a
    // runner simply stopped existing. A run is the only thing in this game that
    // matters and it was the one thing nobody was told about.
    if (dest >= 3) say?.(`   ${runner.name} scores from ${BASE_WORD[i] ?? 'third'}.`);
    else if (dest > i) say?.(`   ${runner.name} to ${BASE_WORD[dest] ?? 'third'}.`);

    if (dest >= 3) scored.push(runner);
    else { bases[dest] = runner; blocked = dest; }
  }
  if (numBases >= 4) { scored.push(batter); blame.set(batter, pitcher); }
  else { bases[numBases - 1] = batter; blame.set(batter, pitcher); }
  return retired;
}

// ---------------------------------------------------------------------------
// Where the ball goes
// ---------------------------------------------------------------------------

/**
 * Who fields a batted ball, by type and direction.
 *
 * Three slots per type — pull, centre, opposite — because handedness decides
 * which actual position each of those is. A right handed hitter pulls to the
 * left side, so his pull slot is the shortstop and third baseman; a lefty's pull
 * side is second and first. Storing it by side rather than by position is what
 * lets one table serve both.
 *
 * Shares are the real thing, roughly: about 12% of ground balls are fielded by
 * the pitcher, the middle infielders see more than the corners, and centre field
 * takes the largest share of fly balls.
 */
type Lane = 'pull' | 'middle' | 'oppo';

const GROUND_LANES: readonly (readonly [Lane, number])[] =
  [['pull', 0.45], ['middle', 0.28], ['oppo', 0.27]];
const AIR_LANES: readonly (readonly [Lane, number])[] =
  [['pull', 0.36], ['middle', 0.36], ['oppo', 0.28]];

/**
 * Infield positions by lane, for a right handed hitter. Mirrored for lefties.
 *
 * The middle lane used to list the pitcher first and never once produced him:
 * these are resolved through `byPosition`, which is built from the batting
 * order, and the batting order does not contain a pitcher. Every comebacker in
 * the history of this engine was quietly fielded by the shortstop. The mound is
 * handled explicitly below instead — as a share of ground balls rather than the
 * whole middle lane, which is what listing him here would have meant if it had
 * ever worked.
 *
 * The lane also has to be split between the two men standing in it, rather than
 * handed to whichever is named first. Read as a fallback chain — which is what
 * this was — the pull lane always went to the third baseman, the middle lane
 * always to the shortstop and the opposite lane always to the second baseman,
 * so the third baseman saw more ground balls than the shortstop and **the first
 * baseman fielded nothing at all, ever**. His range and hands were ratings the
 * simulation could not read, which is invisible until a fielding line asks him
 * how many chances he had and he says none.
 *
 * The weights inside each lane are set from real assist counts, which is the
 * closest published thing to "fielded a ground ball himself": across a season a
 * shortstop records around 400, a second baseman 380, a third baseman 280 and a
 * first baseman 110 — the corner is low because the second baseman cuts off most
 * of the right side, and because a first baseman's putouts are overwhelmingly
 * throws he received rather than balls he fielded.
 */
const INFIELD: Record<Lane, readonly (readonly [Position, number])[]> = {
  pull: [['3B', 0.53], ['SS', 0.47]],
  middle: [['SS', 0.48], ['2B', 0.52]],
  oppo: [['2B', 0.65], ['1B', 0.35]],
};

/**
 * Share of ground balls the pitcher fields himself.
 *
 * Roughly what the real number is, and the figure the lane table's own comment
 * has claimed all along. It is drawn before the lane so the pitcher takes his
 * cut out of the whole diamond rather than out of one third of it.
 */
const COMEBACKER_SHARE = 0.12;

/**
 * Share of pop-ups the catcher takes.
 *
 * Same hole as the comebacker, one position over: the defensive baseline has
 * always assumed the catcher handles about two percent of balls in play, and the
 * lane tables never once sent him one. A quarter of the pop-ups is what that two
 * percent works out to, and a pop-up straight up off the plate is the ball he
 * really does catch.
 */
const CATCHER_POPUP_SHARE = 0.24;

const OUTFIELD: Record<Lane, readonly Position[]> = {
  pull: ['LF'],
  middle: ['CF'],
  oppo: ['RF'],
};

/** Left handed hitters pull the other way. Swap the two sides of the diamond. */
const MIRROR: Record<Lane, Lane> = { pull: 'oppo', middle: 'middle', oppo: 'pull' };

/**
 * How strongly this hitter pulls the ball. Power hitters pull; slap hitters use
 * the whole field. Returns a weight applied to the pull lane.
 */
const pullBias = (batter: Hitter): number =>
  (1 + Math.max(-0.25, Math.min(0.5, (batter.power - 50) / 90)))
  // And whether he is the kind of hitter who pulls, which is not the same
  // question as how hard he hits it. This is the tendency the fielding rework
  // made buildable: before there were real batted-ball lanes there was nowhere
  // to put a spray chart.
  * pullMultiplier(batter);

/**
 * Pick the man who fields it.
 *
 * This is the spray model. It is deliberately coarse — a lane and a position,
 * not coordinates — because what the rest of the engine needs from it is a
 * *player*, so that range, hands and the play log can stop talking about "the
 * defense" as if it were one person.
 */
function fielderFor(fld: TeamState, kind: PAKind, batter: Hitter, rng: Rng): Player {
  const grounded = kind === 'ground';
  const infield = grounded || kind === 'popup';

  // Back through the box. Ground balls only: a pitcher does occasionally spear a
  // line drive, but a liner he does not catch is a hit off the bat and the
  // engine has no way to tell the two apart, so claiming the chance would mean
  // claiming plays he never had.
  if (grounded && rng() < COMEBACKER_SHARE) return fld.pitcher;
  if (kind === 'popup' && rng() < CATCHER_POPUP_SHARE) {
    const backstop = fld.byPosition.get('C');
    if (backstop) return backstop;
  }

  const table = infield ? GROUND_LANES : AIR_LANES;
  const bias = pullBias(batter);

  let total = 0;
  const weights = table.map(([lane, share]) => {
    const w = share * (lane === 'pull' ? bias : 1);
    total += w;
    return w;
  });

  let r = rng() * total;
  let lane: Lane = 'middle';
  for (let i = 0; i < table.length; i++) {
    r -= weights[i] as number;
    if (r < 0) { lane = (table[i] as readonly [Lane, number])[0]; break; }
  }

  // A line drive can be caught anywhere; treat it as an air ball but let the
  // infield take a share of them, which is what a line out to short is.
  const useInfield = infield || (kind === 'line' && rng() < 0.32);
  const side = batter.bats === 'L' ? MIRROR[lane] : lane;

  // Which of the two men in the lane gets it. The outfield lanes hold one man
  // each and take no draw; the infield splits, and the man who loses the split
  // is still the fallback if his neighbour is missing from the lineup.
  const options: readonly Position[] = useInfield
    ? weighted(INFIELD[side], rng)
    : OUTFIELD[side];

  for (const pos of options) {
    const man = fld.byPosition.get(pos);
    if (man) return man;
  }
  // A lineup missing that position: fall back to anyone rather than throwing.
  return fld.order[0] as Hitter;
}

/**
 * The lane's two positions, best candidate first, chosen on the weights.
 *
 * Returns both rather than one so the caller keeps its fallback: a lineup with
 * no first baseman is a lineup bug, and the ball should go to the second baseman
 * rather than to the top of the order.
 */
function weighted(
  table: readonly (readonly [Position, number])[], rng: Rng,
): readonly Position[] {
  let r = rng();
  for (const [pos, share] of table) {
    r -= share;
    if (r < 0) return [pos, ...table.map(([p]) => p).filter((p) => p !== pos)];
  }
  return table.map(([p]) => p);
}

/**
 * Where each position stands, in normalized field coordinates.
 *
 * x runs -1 at the left field line to +1 at the right field line; y runs 0 at
 * home plate to 1 at the outfield wall. Deliberately geometry and nothing else —
 * the renderer decides what a coordinate looks like, and a headless test can
 * assert on it without knowing there is a renderer at all.
 *
 * The lines meet at home and reach ±1 at the wall, so fair territory is
 * |x| <= y. The corners used to stand at ±0.40 with the bags at 0.26, which is
 * well outside that wedge — every ground ball to first or third was drawn in
 * foul ground, and a base hit that lands past the chalk reads as a foul ball
 * whatever the log says.
 */
const POSITION_SPOT: Record<Position, { x: number; y: number }> = {
  C:    { x: 0.00, y: 0.02 },
  P:    { x: 0.00, y: 0.19 },
  '1B': { x: 0.29, y: 0.32 },
  '2B': { x: 0.21, y: 0.34 },
  SS:   { x: -0.21, y: 0.34 },
  '3B': { x: -0.29, y: 0.32 },
  LF:   { x: -0.54, y: 0.72 },
  CF:   { x: 0.00, y: 0.86 },
  RF:   { x: 0.54, y: 0.72 },
  DH:   { x: 0.00, y: 0.30 },
};

/**
 * Where the ball actually finished, from who fielded it and what kind it was.
 *
 * The fielder's spot is the anchor; the batted ball type moves it in or out,
 * because a liner to left lands in front of the man and a fly ball carries him
 * back. A home run is placed past the wall, which is the one case where nobody
 * fielded anything.
 *
 * **Takes no random draws.** The first version scattered the landing with
 * `rng()`, which meant asking for the event stream consumed dice the simulation
 * otherwise would not — so a game watched play by play diverged from the same
 * game simulated silently. The play-events test caught it immediately, and it is
 * the rule the whole event stream rests on: reporting what happened must never
 * change what happens. The scatter is derived from the fielder and the count
 * instead, which is stable, free, and varies exactly as much as it needs to.
 */
function landingFor(
  fielder: Player | null, kind: PAKind, event: string, salt: number,
): { x: number; y: number } | undefined {
  if (!fielder || !BATTED_KINDS.has(kind)) return undefined;

  const spot = POSITION_SPOT[fielder.pos] ?? POSITION_SPOT.CF;

  // A cheap stable hash of the man and the count. Two balls hit at the same
  // fielder on different counts land slightly differently; the same play
  // replayed lands in exactly the same place.
  let h = salt * 2654435761;
  for (let i = 0; i < fielder.id.length; i++) h = (h * 31 + fielder.id.charCodeAt(i)) | 0;
  let n = 0;
  const jitter = (): number => {
    n += 1;
    const v = Math.sin(h * 0.0001 + n * 12.9898) * 43758.5453;
    return (v - Math.floor(v) - 0.5) * 0.10;
  };

  if (event === 'homerun') {
    // Out of the park, on the line the ball was actually hit down.
    const dir = spot.x === 0 ? jitter() * 2 : spot.x;
    return { x: clamp(dir * 1.15, -0.95, 0.95), y: 1.08 };
  }

  /*
    An extra-base hit went PAST the man, and the landing has to say so.

    The fielder charged with the play is the man who eventually ran it down,
    and placing the ball at his station told the story backwards: a triple
    "fielded by the first baseman" (it went down the line past him) drew a
    ball that died at first base while the log read triple. Reported from
    testing, in exactly those words. A double carries to the gap and a triple
    to the wall, pushed along the fielder's side of the field — still derived
    from the same stable hash, still no dice.
  */
  if (event === 'double' || event === 'triple') {
    const deep = event === 'double' ? 0.68 : 0.88;
    const y = clamp(Math.max(spot.y + 0.06, deep) + jitter() * 0.3, 0, 1.0);
    const dir = spot.x === 0 ? jitter() * 4 : spot.x * 1.35;
    const limit = y * 0.94;
    return { x: clamp(dir + jitter(), -limit, limit), y };
  }

  /*
    A single found grass, and the coordinate has to say where.

    Reported from testing: "a ball was caught by the first base but the guy who
    hit it got on base and two runs scored." The simulation was right — a
    single with men on second and third scores two — and the *picture* was
    wrong, because the ball was drawn dying at the station of the man credited
    with fielding it, which is what a catch looks like. A single off an
    outfielder drops in front of him; one off an infielder is a ball through
    the hole, past his station rather than in his glove.
  */
  const outfield = fielder.pos === 'LF' || fielder.pos === 'CF' || fielder.pos === 'RF';
  if (event === 'single') {
    const y = outfield
      ? clamp(spot.y - 0.12 + jitter() * 0.4, 0.30, 1.0)   // in front of him
      : clamp(spot.y + 0.14 + jitter() * 0.4, 0.10, 1.0);  // through the hole
    // Pushed off his station rather than onto it: a hit is a ball nobody was
    // standing on.
    const away = spot.x === 0 ? jitter() * 3 : spot.x * 1.18;
    const limit = y * 0.94;
    return { x: clamp(away + jitter(), -limit, limit), y };
  }

  const depth =
    kind === 'fly' ? 0.10
    : kind === 'line' ? 0.03
    : kind === 'popup' ? -0.04
    : -0.02;                       // ground balls die in front of the fielder

  const y = clamp(spot.y + depth + jitter() * 0.5, 0, 1.02);
  // Fair territory is the wedge |x| <= y. Held to a little inside it so a ball
  // never lands *on* the chalk either, which is just as ambiguous to look at.
  const limit = y * 0.94;
  return { x: clamp(spot.x + jitter(), -limit, limit), y };
}

/** Shorthand the play log uses: "grounds out to short". */
const POSITION_WORD: Record<Position, string> = {
  P: 'the pitcher', C: 'the catcher', '1B': 'first', '2B': 'second',
  '3B': 'third', SS: 'short', LF: 'left', CF: 'center', RF: 'right', DH: 'the bench',
};

/**
 * How likely each kind of batted ball is to be booted, relative to a grounder.
 *
 * Errors are overwhelmingly a ground ball event. Charging fly balls the same
 * rate as grounders is what makes a simulated defence feel uniformly clumsy
 * rather than clumsy in the places real defences are.
 */
/**
 * How much a fielder's range moves a marginal ball in play, per 50 rating points
 * of difference from his own team's average.
 */
const RANGE_SWING = 0.18;

/**
 * Roughly what share of batted balls each position handles, from the lane tables
 * below combined with the league's batted ball mix. Used only to centre the
 * defensive baseline, so it needs to be proportionally right rather than exact.
 */
const FIELDING_SHARE: Partial<Record<Position, number>> = {
  SS: 0.15, '2B': 0.13, '3B': 0.10, '1B': 0.09, C: 0.02,
  LF: 0.16, CF: 0.19, RF: 0.16,
  // Comebackers: `COMEBACKER_SHARE` of the ground balls, which are 44% of balls
  // in play. Small, and it has to be here or the pitcher's glove would be a
  // free discount on the defensive baseline.
  P: 0.05,
};

/**
 * Outs outnumber singles among balls in play by roughly 0.49 to 0.18 of all
 * plate appearances, so converting at equal rates in both directions would turn
 * far more outs into hits than hits into outs and quietly inflate scoring. This
 * scales the out-to-hit direction by that ratio so the two flows balance and a
 * league of average fielders scores exactly what it did before.
 */
const OUT_TO_HIT_BALANCE = 0.178 / 0.4885;

export const KIND_ERROR_RISK: Partial<Record<PAKind, number>> = {
  ground: 1.00, line: 0.55, fly: 0.45, popup: 0.30,
};

/**
 * The two ways a defence gives a batter first base, and how the league's error
 * total is split between them.
 *
 * There was only ever one: a ball hit at a man and not handled. Real fielders
 * throw the ball away roughly as often as they drop it — a little over a third
 * of all errors are throwing errors — and the throw is the more expensive
 * mistake, because a ball skipping past first base moves every runner rather
 * than just putting one on. That difference is the whole reason to model it
 * separately instead of raising the muffed-ball rate.
 *
 * These two are a **split of the old rate, not an addition to it.** The league
 * error total is a calibrated quantity sitting near one a game, which is where
 * a .965 fielding percentage puts it; adding a second error path on top of the
 * first would have put it near one and a half. GLOVE was 0.055 and carried
 * everything.
 */
const GLOVE_ERROR_BASE = 0.0376;

/**
 * Charged only where the engine actually knows a throw was made: a ground ball
 * an infielder fielded, which is a throw across the diamond. An outfielder
 * catching a fly ball throws to nobody, and a runner testing an outfield arm is
 * already resolved by `advanceOnHit` without the ball ever being described as
 * on target or not — so claiming a wild throw there would be inventing a play
 * the simulation never ran.
 *
 * Higher per chance than the glove rate because it applies to under half as
 * many balls.
 */
const THROW_ERROR_BASE = 0.0408;

/**
 * Share of ground balls to the first baseman that become a throw at all.
 *
 * The rest he carries to the bag himself, which is the reason his arm was
 * exempt from the throw entirely to begin with. But half of them are not that
 * play — they are a feed to the pitcher covering first, which is the one thing
 * besides a comebacker a pitcher is on the field to do, and it was the last
 * ground ball in the engine with nobody throwing on it. Leaving it out left the
 * first baseman's accuracy a rating the simulation could not read, which is the
 * dead menu item this whole pass exists to stop.
 */
const COVER_FIRST_SHARE = 0.50;

/**
 * The chance a ground ball, once it is cleanly in the glove, is thrown away.
 *
 * Zero for anyone standing in the outfield, which on a ground ball is nobody —
 * the lane tables only ever send a grounder to an infielder — so that arm is a
 * guard on the one fallback path in `fielderFor`, where a lineup missing a
 * position hands the ball to the top of the order.
 *
 * The play at first is two men and reads both of them: the first baseman puts
 * the ball where the pitcher can catch it, and the pitcher has to catch it on
 * the run and find the bag. It is charged to the first baseman either way. A
 * real scorer would split it — a wild feed is the fielder's error and a dropped
 * one is the pitcher's — and the engine keeps a single culprit rather than
 * pretending to know which end of a play it resolved in one roll failed.
 */
export function throwRisk(fielder: Player, covering: Pitcher): number {
  const pos = fielder.pos;
  if (pos === 'LF' || pos === 'CF' || pos === 'RF' || pos === 'DH') return 0;
  // ON A LINE, which is the badge that names exactly this roll and nothing else.
  const badge = throwBonus(fielder);
  if (pos === '1B') {
    return COVER_FIRST_SHARE * THROW_ERROR_BASE * badge
      * mult(fielder.armAccuracy, -0.55) * mult(covering.hands, -0.35);
  }
  return THROW_ERROR_BASE * badge * mult(fielder.armAccuracy, -0.55);
}

/**
 * Divisor holding the league error total where it was once the risks above are
 * applied. Weighted by the batted ball mix in LEAGUE_BIP — .44 ground, .21 line,
 * .27 fly, .08 popup — the table averages 0.701, so dividing by it redistributes
 * errors toward grounders without changing how many there are.
 */
const ERROR_BY_KIND = 1 / 0.701;

const OUT_TEXT: Partial<Record<PAKind, string>> = {
  ground: 'grounds out.',
  fly: 'flies out.',
  line: 'lines out.',
  popup: 'pops out.',
};

function resolveOut(
  bases: Bases, batter: Hitter, kind: PAKind, outs: number, rng: Rng,
  scored: Hitter[], blame: Map<Hitter, Pitcher>, pitcher: Pitcher,
  called?: TacticMods,
  fielder?: Player | null,
  note?: Say,
): { outs: number; text: string } {
  // A call can raise the double play risk or make a sacrifice fly likelier.
  const dpRate = BASERUNNING.doublePlayRate * ((called?.doublePlay ?? BASERUNNING.doublePlayRate) / BASERUNNING.doublePlayRate);
  const sacFly = called?.sacFly ?? BASERUNNING.sacFlyOnFly;
  const fromThird = called?.scoreFromThird ?? BASERUNNING.scoreFromThirdOnGroundOut;
  if (kind === 'ground' && bases[0] && outs < 2) {
    if (rng() < clamp(dpRate * mult(batter.speed, -0.40), 0.08, 0.62)) {
      if (bases[2] && rng() < BASERUNNING.scoreFromThirdOnDoublePlay) {
        note?.(`   ${bases[2].name} scores from third.`);
        scored.push(bases[2]); bases[2] = null;
      }
      note?.(`   ${bases[0].name} is forced at second.`);
      bases[0] = null;
      if (bases[1] && !bases[2]) { bases[2] = bases[1]; bases[1] = null; }
      return { outs: 2, text: 'grounds into a double play.' };
    }
    if (rng() < BASERUNNING.fieldersChoiceRate) {
      note?.(`   ${bases[0].name} is forced at second.`);
      bases[0] = batter;
      blame.set(batter, pitcher);
      return { outs: 1, text: "reaches on a fielder's choice." };
    }
  }
  if ((kind === 'fly' || kind === 'line') && bases[2] && outs < 2) {
    if (rng() < (kind === 'fly' ? sacFly : BASERUNNING.sacFlyOnLine)) {
      note?.(`   ${bases[2].name} tags and scores.`);
      scored.push(bases[2]); bases[2] = null;
      return { outs: 1, text: 'lifts a sacrifice fly, run scores.' };
    }
  }
  // The RBI groundout. Infield plays back, takes the out at first, concedes the
  // run. Without this a runner on third could only score on a hit or a fly ball.
  if (kind === 'ground' && bases[2] && outs < 2) {
    if (rng() < fromThird) {
      note?.(`   ${bases[2].name} scores from third.`);
      scored.push(bases[2]); bases[2] = null;
      if (bases[1] && !bases[0]) {
        note?.(`   ${bases[1].name} to third.`);
        bases[2] = bases[1]; bases[1] = null;
      }
      return { outs: 1, text: 'grounds out, the run scores.' };
    }
  }
  // Third has to be empty for him to take it. Without that check the runner on
  // second was written straight on top of the man on third, who left the inning
  // with no run and no out against him — a runner deleted mid-play, and the
  // exact thing a viewer sees as "he just disappeared".
  if (kind === 'ground' && bases[1] && !bases[0] && !bases[2]
      && rng() < BASERUNNING.secondToThirdOnGroundOut) {
    note?.(`   ${bases[1].name} to third.`);
    bases[2] = bases[1]; bases[1] = null;
    return { outs: 1, text: 'grounds out to the right side, runner moves up.' };
  }
  // "grounds out to short" rather than "grounds out". The spray model already
  // decided who fielded it, so the log may as well say so.
  const base = OUT_TEXT[kind];
  if (!base) return { outs: 1, text: 'is retired.' };
  const where = fielder ? POSITION_WORD[fielder.pos] : null;
  return {
    outs: 1,
    text: where ? `${base.replace(/.$/, '')} to ${where}.` : base,
  };
}

/**
 * A sacrifice bunt. You are buying a base with an out, and it usually works —
 * but a bunt is a skill, so a slow-handed hitter pops it up or the lead runner
 * gets forced. Speed helps him beat it out now and then, which is the small
 * upside that keeps the call from being purely defensive.
 */
function sacrifice(
  bases: Bases, batter: Hitter, outs: number, rng: Rng,
  bLine: BattingLine, pLine: PitchingLine,
  blame: Map<Hitter, Pitcher>, pitcher: Pitcher,
  note?: Say,
): { outs: number; text: string; scored: Hitter[]; hit?: boolean } {
  const scored: Hitter[] = [];
  const leadIndex = bases[2] ? 2 : bases[1] ? 1 : bases[0] ? 0 : -1;
  if (leadIndex < 0) {
    // Nobody to move. It is just an out.
    bLine.ab++; pLine.outs++;
    return { outs: 1, text: 'bunts into an out.', scored };
  }

  // Beating it out: rare, mostly a speed thing, and partly a matter of putting
  // the ball where nobody can get to it in time. A team-level bunt policy has
  // existed since coaching strategy landed; who could execute it did not, so a
  // slugger dropped one as well as a leadoff man.
  if (rng() < clamp(0.09 * mult(batter.speed, 0.9) * mult(batter.bunt, 0.50), 0.02, 0.28)) {
    bLine.ab++; bLine.h++; pLine.h++;
    // The runners it retires count. Thrown away, a man gunned down going first
    // to third on a bunt single left the bases without the out ever being
    // recorded, which is a free erased baserunner in the batting team's favour.
    const retired = advanceOnHit(
      bases, batter, 1, rng, scored, blame, pitcher, RUNNING.balanced, 50, note,
    );
    // Flagged so the caller can credit the *team* hit column too — the batting
    // and pitching lines above are per-man books and do not reach it.
    return { outs: retired, text: 'beats out a bunt single!', scored, hit: true };
  }

  // Botched: the lead runner is forced, which is the disaster case.
  //
  // Only the unbroken chain from first can be forced — a man on second with
  // first base empty is under no obligation to run, so there is nothing to
  // force and the play is an ordinary sacrifice instead. The old version took
  // the lead runner whether he was forced or not, erased him, and then wrote the
  // batter over the top of whoever stood on first: two runners off the field for
  // one out.
  let forcedAt = -1;
  for (let i = 0; i < 3 && bases[i]; i++) forcedAt = i;
  if (forcedAt >= 0
      && rng() < clamp(0.12 * mult(batter.speed, -0.4) * mult(batter.bunt, -0.60), 0.04, 0.30)) {
    const caught = bases[forcedAt as 0 | 1 | 2];
    note?.(`   ${caught?.name ?? 'The lead runner'} is forced at ${BASE_WORD[forcedAt + 1] ?? 'home'}.`);
    bases[forcedAt as 0 | 1 | 2] = null;
    // Everyone behind him still moves up; the batter has first.
    for (let i = forcedAt - 1; i >= 0; i--) { bases[i + 1] = bases[i] ?? null; bases[i] = null; }
    bases[0] = batter;
    blame.set(batter, pitcher);
    bLine.ab++;
    return { outs: 1, text: 'bunts the lead runner into a force out.', scored };
  }

  // The routine sacrifice: everyone up one, batter retired, no time at bat.
  for (let i = 2; i >= 0; i--) {
    const runner = bases[i];
    if (!runner) continue;
    bases[i] = null;
    if (i === 2) { note?.(`   ${runner.name} scores from third.`); scored.push(runner); }
    else { note?.(`   ${runner.name} to ${BASE_WORD[i + 1] ?? 'third'}.`); bases[i + 1] = runner; }
  }
  return { outs: 1, text: 'lays down a sacrifice.', scored };
}

/**
 * A steal of second. `forced` is a manager sending the runner regardless of
 * whether the automatic logic would have tried it — the success odds are the
 * same either way, which is the point: calling for it does not make it work,
 * it only makes it happen.
 *
 * Reports what happened rather than settling it: the caller owns the outs
 * counter, because a caught runner charges the out to the pitcher on the mound
 * and can end the half, and only the half inning knows how to do either.
 */
/**
 * The league's ordinary catcher arm — 50, plus the spectrum's catcher bonus.
 *
 * `mult` measures every rating against a flat 50, which is right for ratings
 * drawn around 50 and wrong for one deliberately drawn above it. Catchers are
 * generated ten points above their school's quality on arm, so an unshifted
 * `mult(catcher.arm, …)` reads a perfectly ordinary catcher as exceptional and
 * suppresses stealing at every school at once. It did: scoring fell to 11.3%
 * below the D1 target, outside calibration tolerance.
 *
 * Re-centring makes an average catcher exactly neutral, so only his distance
 * from average moves anything — which is what the rating was supposed to mean.
 */
const AVERAGE_CATCHER_ARM = 60;

const catcherArm = (c: Hitter, sensitivity: number): number =>
  mult(50 + (c.arm - AVERAGE_CATCHER_ARM), sensitivity);

/**
 * The two bags a runner can take on his own, and what each one costs him.
 *
 * Third is the harder theft and the easier jump. The throw is shorter, so the
 * catcher's arm decides more of it and the base constant sits lower; against
 * that, a pitcher facing a runner on second is mostly worrying about the hitter
 * and holds him less, so his hold matters less too. Home is not here on purpose:
 * a straight steal of the plate is a once-a-season play and modelling it would
 * put a button on the screen for something nobody should ever press.
 *
 * Measured over every generated lineup bat against every school's starter and
 * catcher: a called steal of second is caught 30% of the time and of third 36%,
 * against a real D1 caught-stealing rate in the twenties to low thirties.
 *
 * `speed` and `jump` split what used to be one number. The steal has two halves
 * and they belong to different skills: reading the first move and leaving on it
 * is instinct, and covering the ninety feet once you have gone is wheels. The
 * jump is the larger share, which is why the base stealers in real baseball are
 * not simply the fastest men in the league. The two weights together are close
 * to the single one they replaced, so the league's caught-stealing rate stays
 * where it was calibrated.
 */
const STEAL_OF: Record<
  2 | 3,
  { base: number; speed: number; jump: number; hold: number; arm: number }
> = {
  2: { base: 0.70, speed: 0.12, jump: 0.22, hold: -0.15, arm: -0.34 },
  3: { base: 0.64, speed: 0.10, jump: 0.24, hold: -0.10, arm: -0.40 },
};

/** Where a runner would go if one were sent. Null when every bag ahead is taken. */
export function stealTarget(bases: Bases): 2 | 3 | null {
  if (bases[0] && !bases[1]) return 2;
  if (bases[1] && !bases[2]) return 3;
  return null;
}

function attemptSteal(
  bases: Bases, bat: TeamState, fld: TeamState, rng: Rng, say: Say, forced: boolean,
  events: PlayEvent[] | null = null,
  target: 2 | 3 = 2,
): 'stolen' | 'caught' | null {
  const from = (target - 1) as 1 | 2;
  const runner = bases[from - 1];
  if (!runner || bases[target - 1]) return null;
  const green = STEALS[bat.strategy.steals];
  if (green === 0 && !forced) return null;
  const profile = STEAL_OF[target];
  // Runners pick their spots. A cannon behind the plate does not just throw
  // people out, it stops them leaving — which is why the arm has to appear here
  // as well as in the throw, or elite catchers would post huge caught-stealing
  // totals instead of the empty basepaths they actually produce.
  // Who goes is mostly a question of who thinks he can, which is instinct
  // rather than raw speed — the fast man who never runs is a real player and
  // was not expressible while one rating decided both halves of this.
  // GREEN LIGHT and STATION TO STATION multiply the team's policy rather than
  // replacing it: a runner turned loose on a club that never runs still does not
  // run, because the sign comes from the dugout. And a CANNON behind the plate
  // stops men leaving, which is most of what a catcher's arm is worth.
  const own = runningMods(runner);
  const attempt = clamp(
    0.11 * green * own.steal * mult(runner.speed, 0.45) * mult(runner.steal, 0.65)
         * mult(fld.pitcher.holdRunners, -0.35)
         * catcherArm(fld.catcher, -0.30)
         * (1 - badgeSize(fld.catcher, 'cannon') * 1.2),
    0, 0.75,
  );
  if (!forced && rng() >= attempt) return null;
  // Three people decide a steal, and until now only two of them were in the
  // equation. The pitcher controls how big a jump the runner gets; the runner
  // controls how fast he covers ninety feet; **the catcher has to make the
  // throw**, and a strong arm behind the plate is worth more than either.
  //
  // The ceiling used to be 0.94, which measured out as decoration: the best
  // pairing the generator can produce — a 95 speed runner against a 41 arm — only
  // reaches 0.90, so the clamp described a model nobody could reach. It now sits
  // where the model actually tops out, and the floor low enough that a plodder
  // against a cannon is genuinely a bad idea rather than a coin flip.
  const success = clamp(
    profile.base * mult(runner.speed, profile.speed) * mult(runner.steal, profile.jump)
      * mult(fld.pitcher.holdRunners, profile.hold)
      * catcherArm(fld.catcher, profile.arm)
      * stealBonus(runner) * (1 - badgeSize(fld.catcher, 'cannon')),
    0.25, 0.90,
  );
  const line = bat.hitLine(runner);
  // The steal is the one defensive play the catcher was already making and
  // getting no credit for. It goes on his fielding line, where a badge or an
  // award can find it later.
  const backstop = fld.fieldLine(fld.catcher);
  const word = target === 2 ? 'second' : 'third';
  if (rng() < success) {
    bases[from - 1] = null; bases[target - 1] = runner; line.sb++; backstop.sba++;
    say(`   ${runner.name} steals ${word}.`);
    if (events) events.push({ kind: 'advance', runners: [{ id: runner.id, from, to: target }] });
    return 'stolen';
  }
  bases[from - 1] = null; line.cs++; backstop.cs++;
  say(`   ${runner.name} is caught stealing ${word}.`);
  return 'caught';
}

/**
 * Pinch hitting, at something like the rate real baseball does it.
 *
 * This is deliberately NOT the pitching change. A bullpen turns over in every
 * game; a batting order mostly does not. Nine men take their cuts all afternoon
 * and the bench is used late, for a reason: a platoon edge in a spot that
 * matters, or a game already decided where the starters may as well sit.
 *
 * Two per game at the outside. Burning the whole bench by the seventh is not
 * something a coach does, and it would leave nobody for extras.
 */
/**
 * What the other dugout calls.
 *
 * Only the sacrifice for now, and deliberately so: it is the one call with a
 * genuine cost, and the cost is the point. Giving up an out to move a runner
 * loses expected runs in nearly every situation — it earns its keep late in a
 * tight game where a single run wins it and nothing else does. A coach set to
 * "often" will bunt in spots that hurt him, which is exactly what the setting
 * should mean.
 */
function chooseTactic(
  bat: TeamState,
  fld: TeamState,
  inning: number,
  outs: number,
  bases: Bases,
  rng: Rng,
): Tactic | undefined {
  const appetite = BUNT[bat.strategy.bunt];
  if (appetite === 0) return undefined;

  // A runner to move, an out to spare, and a batter you do not mind losing.
  const runnerOn = bases[0] !== null && bases[2] === null;
  if (!runnerOn || outs >= 2) return undefined;
  if (inning < 6) return undefined;

  // One run has to actually matter. Down four, a bunt is just an out.
  const margin = bat.runs - fld.runs;
  if (margin < -2 || margin > 2) return undefined;

  const due = bat.order[bat.spot];
  if (!due) return undefined;
  // Good hitters swing. This is a call you make for the bottom of the order.
  const weak = (due.contact + due.power) / 2 < 48;

  const chance = appetite * (weak ? 1.0 : 0.35);
  return rng() < chance ? 'bunt' : undefined;
}

function maybePinchHit(
  bat: TeamState,
  fld: TeamState,
  inning: number,
  rng: Rng,
  say: Say,
): void {
  if (inning < 7) return;                       // the bench is a late inning tool
  if (bat.usedBench.length >= 2) return;

  const spot = bat.spot;
  const due = bat.order[spot];
  if (!due) return;

  const available = bat.team.bench.filter((h) => !bat.usedBench.includes(h));
  if (available.length === 0) return;

  const margin = bat.runs - fld.runs;
  const decided = Math.abs(margin) >= 7;

  // Who is the best bat available for this matchup, platoon included?
  let best: Hitter | null = null;
  let bestValue = -Infinity;
  for (const h of available) {
    const value = platoonMultiplier(h, fld.pitcher) * (h.contact + h.power);
    if (value > bestValue) { bestValue = value; best = h; }
  }
  if (!best) return;

  const dueValue = platoonMultiplier(due, fld.pitcher) * (due.contact + due.power);

  // The bar is a net improvement in *this matchup*, not a better player.
  // Reserves are generated below the regulars they back up, so asking a bench
  // bat to be outright better than a starter meant this never fired once in
  // five hundred games. What actually sends a man to the plate is handedness:
  // a lefty bat against a righty who has the platoon edge on the man due up.
  const worthIt = bestValue > dueValue * 1.04;

  // These are per plate appearance, and the check runs for every batter from the
  // seventh on — roughly ten looks a game. A 20% chance at each compounded to a
  // pinch hitter in 97% of games, which is not baseball. Kept low so the bench
  // stays what it is: an occasional lever, not part of the everyday lineup.
  const chance = decided ? 0.14 : worthIt ? 0.05 : 0;
  if (chance === 0 || rng() >= chance) return;

  const out = bat.pinchHit(spot, best);
  if (out) say(`   ${best.name} bats for ${out.name}.`);
}

/**
 * A mound visit, wherever it comes from.
 *
 * The manager's version and the bench coach's both land here, which is the
 * point: every one of the ninety-six programs settles a wobbling arm the same
 * way, so nothing about this is an advantage a human has and the league does
 * not. One per pitcher per outing; a pitching change resets it because a new
 * man has his own.
 *
 * Confidence only, never fatigue. A conversation does not put pitches back in
 * an arm, and letting it would collapse the two channels into one.
 */
export function moundVisit(fld: TeamState, say?: Say): boolean {
  if (fld.visitUsed) return false;
  fld.visitUsed = true;
  fld.pitcherConfidence = clamp(
    fld.pitcherConfidence + CONFIDENCE.visit, CONFIDENCE.floor, CONFIDENCE.ceiling,
  );
  say?.(`   The catcher goes out to talk to ${fld.pitcher.name}.`);
  return true;
}

/**
 * When the other ninety-five dugouts go out there.
 *
 * Deliberately late and deliberately cheap: only when he has actually come
 * apart, and only with somebody on, which is when a real bench sends the
 * catcher out. A staff that spent its visit on the first walk of the second
 * inning would be spending the thing that is supposed to be scarce.
 */
function maybeMoundVisit(fld: TeamState, runnersOn: boolean, say: Say): void {
  if (fld.visitUsed || !runnersOn) return;
  // Half gone. On the old centred scale this read 0.3; confidence starts full
  // now, so the same "he has come apart" moment sits here instead.
  if (fld.pitcherConfidence > 0.5) return;
  moundVisit(fld, say);
}

function maybeChangePitcher(fld: TeamState, say: Say): void {
  const p = fld.pitcher;
  const budget = 30 + p.stamina * 0.85;
  const line = fld.pitchLine(p);
  /*
    Three ways a bench goes and gets him, where there used to be two slow ones.

    Reported: "the opposing team only switched its pitcher once, even with the
    second pitcher's arm depleted and being hit around." Both old tests were
    written with a Friday starter in mind and neither fits the man who follows
    him. `budget` is 30 + stamina, so a thirty five stamina reliever was
    already given sixty pitches, and the flat twelve plus a patient hook pushed
    that near ninety -- a number a college reliever does not reach in a season,
    let alone an outing. Six earned runs, likewise, is not "hit around", it is a
    disaster already complete.

    So: the flat allowance drops to four, which puts the hook just past where the
    ARM gauge empties rather than a fifth of an outing later; damage is read at
    four runs; and a man who has plainly come apart can be pulled on that alone,
    which is the case the report was actually describing and the one the
    confidence channel exists to see.
  */
  const gassed = fld.pitcherPitches > budget + 4 + HOOK[fld.strategy.hook];
  const shelled = line.er >= 4 && fld.pitcherPitches > 30;
  const broken = fld.pitcherConfidence <= 0.28 && fld.pitcherPitches > 20;
  if (!gassed && !shelled && !broken) return;
  // Walk past anyone the manager already spent. In a fully automatic game the
  // pen is used strictly in order and this never skips; in a game handed to the
  // computer late, an arm the manager burned must not come back out.
  let next: Pitcher | undefined;
  while (fld.penIndex < fld.relief.length && !next) {
    const cand = fld.relief[fld.penIndex++];
    if (cand && cand !== fld.pitcher && !fld.usedPen.includes(cand)) next = cand;
  }
  if (!next) return;
  fld.usedPen.push(next);
  fld.pitcher = next;
  fld.pitcherPitches = 0;
  // A new man is a new outing in every sense: his own budget, his own
  // confidence, and his own visit still to spend.
  fld.pitcherConfidence = CONFIDENCE.relief;
  fld.visitUsed = false;
  say(`   Pitching change: ${next.name} (${next.throws}HP) enters.`);
}

export function boxScore(result: GameResult): string {
  const { home, away } = result;
  const out: string[] = [];
  const pad = (s: string | number, n: number): string => String(s).padEnd(n);
  const num = (s: string | number, n: number): string => String(s).padStart(n);

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
