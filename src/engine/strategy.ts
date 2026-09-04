// strategy.ts
// The five things a coach actually controls, and what each one costs.
//
// The design rule here is the whole point: **every aggressive setting has to
// hurt somewhere.** A screen where one column is strictly better than another is
// not a decision, it is a stat boost with extra steps — and the player works
// that out in about ten minutes and never touches it again.
//
// So: running harder takes more bases and runs into more outs. Stealing more
// steals more and gets caught more. Bunting more moves runners and spends outs
// doing it, which is usually a bad trade and occasionally the right one. A quick
// hook keeps fresh arms on the mound and burns through the bullpen. A shift
// takes hits away from sluggers and gives them back to anyone who can run.

import type { Hitter } from './types.js';

export type RunningPolicy = 'patient' | 'balanced' | 'aggressive';
export type StealPolicy = 'never' | 'selective' | 'constant';
export type BuntPolicy = 'never' | 'rare' | 'often';
export type HookPolicy = 'quick' | 'standard' | 'patient';
export type Alignment = 'straight' | 'situational' | 'shift';
export type InfieldDepth = 'in' | 'normal' | 'back';
export type OutfieldDepth = 'shallow' | 'normal' | 'deep';
export type ShiftSide = 'left' | 'none' | 'right';

export interface Strategy {
  running: RunningPolicy;
  steals: StealPolicy;
  bunt: BuntPolicy;
  hook: HookPolicy;
  alignment: Alignment;
  /*
    Stage 22: positioning, made real. Optional — absent means 'normal',
    which is exactly the game as it played before the controls existed,
    so a philosophy preset and a save from last week both read unchanged.
  */
  /** Corners and middle up on the grass, standard, or conceding depth. */
  infield?: InfieldDepth;
  /** The outfield's leash: singles in front vs doubles over their heads. */
  outfield?: OutfieldDepth;
  /**
   * A directional overshift, called side by side. 'none' leaves the
   * standing `alignment` policy in charge; a called side overrides it —
   * and calling the WRONG side against a hitter is a genuine gift.
   */
  shift?: ShiftSide;
}

export const DEFAULT_STRATEGY: Strategy = {
  running: 'balanced',
  steals: 'selective',
  bunt: 'rare',
  hook: 'standard',
  alignment: 'straight',
  infield: 'normal',
  outfield: 'normal',
  shift: 'none',
};

// ---------------------------------------------------------------------------
// What each setting does
// ---------------------------------------------------------------------------

/**
 * Baserunning. `attempt` scales how often a runner tries for the extra base;
 * `risk` scales how often trying gets him thrown out.
 *
 * Both move together, which is the trade. Sending everybody does gain bases —
 * it also runs your leadoff man into a throw with nobody out.
 */
export const RUNNING: Record<RunningPolicy, { attempt: number; risk: number }> = {
  patient: { attempt: 0.80, risk: 0.62 },
  balanced: { attempt: 1.00, risk: 1.00 },
  aggressive: { attempt: 1.24, risk: 1.70 },
};

/** Green light policy. Scales the steal attempt rate; success is unchanged. */
export const STEALS: Record<StealPolicy, number> = {
  never: 0,
  selective: 1.00,
  constant: 2.20,
};

/**
 * How willing you are to give up an out to move a runner.
 *
 * Worth stating plainly: **bunting is usually wrong.** It costs more in expected
 * runs than it gains in almost every situation, which is why the default is
 * "rare" rather than "often". It earns its place late in a tie game when one run
 * is the only run that matters, and the engine reflects that rather than
 * pretending the small ball is free.
 */
export const BUNT: Record<BuntPolicy, number> = {
  never: 0,
  rare: 0.14,
  often: 0.46,
};

// ---------------------------------------------------------------------------
// The run-expectancy board — stage 16's AI decision layer
// ---------------------------------------------------------------------------

/*
  The backlog's ask, verbatim: "`chooseTactic` is heuristic. This is the
  difference between an opponent who bunts by rule and one who bunts when
  the base-out state says to."

  Two tables, both the standard sabermetric furniture (Tango et al., the
  2010s major-league matrices), indexed [outs][base state] where the state
  is a bitmask: 1 = first occupied, 2 = second, 4 = third. RE is what an
  average inning yields from here to its end; SCORE_P is the chance at
  least one run scores, which is the number that matters when one run wins
  the game. RE is scaled to this league's measured run environment (5.30
  per team per nine, about 11% over the source era); SCORE_P is used raw,
  because the bunt call compares two entries of the same table and the
  level cancels.
*/
const RE_SCALE = 1.11;
const RE24: readonly (readonly number[])[] = [
  [0.481, 0.859, 1.100, 1.437, 1.350, 1.784, 1.964, 2.292],
  [0.254, 0.509, 0.664, 0.884, 0.950, 1.130, 1.376, 1.541],
  [0.098, 0.224, 0.319, 0.429, 0.353, 0.478, 0.580, 0.752],
];
const SCORE_P: readonly (readonly number[])[] = [
  [0.26, 0.42, 0.61, 0.61, 0.83, 0.84, 0.85, 0.85],
  [0.16, 0.27, 0.40, 0.41, 0.65, 0.64, 0.67, 0.65],
  [0.07, 0.13, 0.22, 0.23, 0.26, 0.27, 0.27, 0.32],
];

const stateOf = (first: boolean, second: boolean, third: boolean): number =>
  (first ? 1 : 0) | (second ? 2 : 0) | (third ? 4 : 0);

/**
 * What the board says a sacrifice is worth right now, or null when the
 * state has no bunt in it at all (nobody to move, two outs, a man already
 * on third — the squeeze stays out of the automatic coach's book).
 *
 * Positive means the state genuinely argues for it: late and close the
 * comparison runs on the chance of scoring at all, where moving the runner
 * with a weak bat up is a real play; early, it runs on expected runs,
 * where the answer is almost always no — which is the truth the old
 * heuristic hard-coded and this now derives. The batter folds in as an
 * adjustment: the out a bunt spends costs less when the man spending it
 * was likely an out anyway.
 */
export function buntEdge(
  first: boolean, second: boolean, third: boolean,
  outs: number, inning: number, margin: number, batterQuality: number,
): number | null {
  if (outs >= 2) return null;
  if (third) return null;
  if (!first && !second) return null;
  const now = stateOf(first, second, third);
  // A clean sacrifice: every runner up one base, one more out. The failure
  // modes (lead man forced, the pop-up) and the beaten-out single roughly
  // offset at the rates `sacrifice` actually produces, so the clean
  // advance is an honest expectation, not a best case.
  const after = stateOf(false, first, second);
  const oneRunBaseball = inning >= 7 && margin >= -1 && margin <= 1;
  const table = oneRunBaseball ? SCORE_P : RE24;
  const scale = oneRunBaseball ? 1 : RE_SCALE;
  const edge = ((table[outs + 1]?.[after] ?? 0) - (table[outs]?.[now] ?? 0)) * scale;
  // The out costs less when the man spending it was probably an out: a
  // 30-quality bat adds about seven hundredths, a 70 takes the same away.
  return edge + (48 - batterQuality) * 0.004;
}

/** Pitches added to or taken off a starter's leash before the bullpen stirs. */
export const HOOK: Record<HookPolicy, number> = {
  quick: -15,
  standard: 0,
  patient: 18,
};

/**
 * Defensive alignment, as a multiplier on a ground ball becoming a hit.
 *
 * A shift is a bet, not an upgrade. Sliding three infielders to one side takes
 * hits off a pull-heavy slugger and hands them to anyone who can put the ball
 * the other way or beat it out — which is why it is aimed at power and punished
 * by speed. Straight up is not the timid option, it is the option that has no
 * opinion about who is batting.
 */
export const SHIFT: Record<Alignment, { vsPower: number; vsSpeed: number }> = {
  straight: { vsPower: 1.00, vsSpeed: 1.00 },
  situational: { vsPower: 0.93, vsSpeed: 1.06 },
  shift: { vsPower: 0.82, vsSpeed: 1.21 },
};

/**
 * How much the alignment helps or hurts against this particular hitter.
 * Returns a multiplier on the chance a ball finds a hole.
 *
 * The measurement that shaped this: shifting against *every* hitter is a wash.
 * Over 2500 games a blanket shift moved runs allowed from 4.72 to 4.71 — the
 * sluggers it suppresses and the runners it hands singles to cancel almost
 * exactly. That is not a flaw in the model, it is the reason real teams shift
 * against particular hitters instead of standing in one alignment all night.
 *
 * So the three settings are genuinely different bets rather than three sizes of
 * the same one:
 *
 *   STRAIGHT      no opinion, no exposure.
 *   SITUATIONAL   shift only where it is clearly right — pull heavy, slow. The
 *                 percentage play: small edge, little downside.
 *   FULL SHIFT    every hitter, every time. Big against a pull heavy lineup,
 *                 actively bad against one that can run. A bet on the opponent.
 */
export function alignmentAgainst(
  alignment: Alignment,
  batter: Hitter,
  /**
   * How pull-prone his spray chart says he is, above or below what his power
   * alone would suggest. One when nothing is known about him.
   *
   * Power was the only proxy available before there were tendencies, and it is
   * a poor one — plenty of sluggers go the other way and plenty of slap hitters
   * roll everything to the right side. The caller supplies this rather than the
   * function reaching for it, so `strategy.ts` stays a file of policies with no
   * opinion about where a tendency comes from.
   */
  pullBias = 1,
): number {
  if (alignment === 'straight') return 1;

  // Scaled from 45 over a 30 point range so an ordinary hitter still feels
  // something. Anchored at the league average across the full scale, a power 70
  // slugger saw a 4% effect and everyone else essentially none — real in the
  // code, invisible in the box score.
  const pull = Math.max(0, Math.min(1.4, ((batter.power - 45) / 30) * pullBias));
  const wheels = Math.max(0, Math.min(1.4, (batter.speed - 45) / 30));

  if (alignment === 'situational') {
    // Pick the spots. Against anyone who can run, or who does not pull, stand
    // straight up and take nothing on.
    if (pull < 0.5 || wheels > 0.7) return 1;
    return 1 + (SHIFT.shift.vsPower - 1) * pull;
  }

  const s = SHIFT.shift;
  return (1 + (s.vsPower - 1) * pull) * (1 + (s.vsSpeed - 1) * wheels);
}

/**
 * Everything the defence's positioning does to one plate appearance,
 * computed in one place so the game loop asks a single question.
 *
 * Every number is a trade in the family of `SHIFT` above (full shift =
 * 0.82 on singles against a pure pull hitter), and every control's
 * 'normal' row is exactly 1.0 — the engine at defaults is the engine as
 * calibrated.
 */
export interface DefenseFactors {
  /** Multiplier on a ball in play becoming a single. */
  singles: number;
  /** Multiplier on the gaps — doubles and triples. */
  gaps: number;
  /** Multiplier on the RBI groundout with a man on third. */
  fromThird: number;
  /** Multiplier on a sacrifice fly getting the tag home. */
  sacFly: number;
  /** Multiplier on a bunt being beaten out against this infield. */
  buntBeat: number;
}

const INFIELD: Record<InfieldDepth, { singles: number; fromThird: number; buntBeat: number }> = {
  // Up on the grass: the run at the plate dies and so does the bunt, and
  // ground balls find the outfield for it.
  in: { singles: 1.07, fromThird: 0.35, buntBeat: 0.55 },
  normal: { singles: 1.00, fromThird: 1.00, buntBeat: 1.00 },
  // Conceding depth: outs everywhere, runs included.
  back: { singles: 0.96, fromThird: 1.30, buntBeat: 1.35 },
};

const OUTFIELD: Record<OutfieldDepth, { singles: number; gaps: number; sacFly: number }> = {
  // In on the grass: the ball in front of them dies, the one over their
  // heads runs for ever.
  shallow: { singles: 0.94, gaps: 1.14, sacFly: 0.80 },
  normal: { singles: 1.00, gaps: 1.00, sacFly: 1.00 },
  // Nothing lands behind them; everything lands in front.
  deep: { singles: 1.05, gaps: 0.86, sacFly: 1.15 },
};

/**
 * The called overshift against this hitter. The right side takes singles
 * away in the `SHIFT` family; the wrong side is a gift; a switch hitter
 * makes every call a coin toss barely worth making.
 */
function calledShift(side: ShiftSide, batter: Hitter, pullBias: number): number {
  if (side === 'none') return 1;
  const pullSide = batter.bats === 'L' ? 'right' : batter.bats === 'R' ? 'left' : null;
  if (!pullSide) return 1.03;
  const pull = Math.max(0, Math.min(1.4, ((batter.power - 45) / 30) * pullBias));
  return side === pullSide
    ? 1 - 0.16 * Math.min(1, 0.35 + pull * 0.6)
    : 1.10;
}

/** One call per plate appearance: what the defence's positioning is worth. */
export function defenseFactors(
  s: Strategy, batter: Hitter, pullBias = 1,
): DefenseFactors {
  const inf = INFIELD[s.infield ?? 'normal'];
  const of = OUTFIELD[s.outfield ?? 'normal'];
  const shift = s.shift ?? 'none';
  // A called side overrides the standing alignment policy; 'none' leaves
  // the policy in charge, exactly as it has been since strategy landed.
  const lateral = shift === 'none'
    ? alignmentAgainst(s.alignment, batter, pullBias)
    : calledShift(shift, batter, pullBias);
  return {
    singles: lateral * inf.singles * of.singles,
    gaps: of.gaps,
    fromThird: inf.fromThird,
    sacFly: of.sacFly,
    buntBeat: inf.buntBeat,
  };
}

// ---------------------------------------------------------------------------
// Philosophies
// ---------------------------------------------------------------------------

/**
 * A coaching philosophy is a **preset over the five policies above**, and
 * deliberately nothing more.
 *
 * A career mode wants to ask "what kind of coach are you?" on the way in, and
 * the tempting answer is a second system — schemes, styles, a name for each with
 * its own numbers. That system would then have to be wired to the simulation a
 * second time, and the version that never gets wired is the dead menu this
 * project has already paid for once with coach skills.
 *
 * So a philosophy owns no numbers of its own. It is a named point in the policy
 * space the engine already reads, which means picking one at creation is exactly
 * equivalent to opening the strategy screen and setting five controls by hand —
 * and the player can go and change any of them afterwards, because there is
 * nothing underneath to disagree with.
 *
 * Each one is a real bet with a real cost, for the reason stated at the top of
 * this file: if one of these were strictly better it would not be a philosophy,
 * it would be the correct answer with three decoys.
 */
export type PhilosophyId = 'smallball' | 'power' | 'pitching' | 'balanced';

export interface Philosophy {
  id: PhilosophyId;
  /** What it is called, wherever it is printed. */
  name: string;
  /**
   * One line about how his teams play, in plain baseball English — what it does
   * *and* what it spends, never only the first half.
   *
   * The words live here rather than in the screens because two screens print
   * them: the creation step where it is chosen and the coach's own page where it
   * sits for the rest of his career. Two copies of the same sentence is two
   * sentences that eventually disagree.
   */
  blurb: string;
  strategy: Strategy;
}

export const PHILOSOPHIES: readonly Philosophy[] = [
  {
    id: 'smallball',
    name: 'SMALL BALL',
    blurb: 'His teams run, bunt and take the extra base, and get thrown out doing it.',
    strategy: {
      running: 'aggressive', steals: 'constant', bunt: 'often',
      hook: 'standard', alignment: 'straight',
    },
  },
  {
    id: 'power',
    name: 'POWER',
    blurb: 'Nobody runs into an out. He waits for the three-run inning and wears the quiet nights.',
    strategy: {
      running: 'patient', steals: 'never', bunt: 'never',
      hook: 'patient', alignment: 'straight',
    },
  },
  {
    id: 'pitching',
    name: 'PITCHING AND DEFENSE',
    blurb: 'Fresh arms and a shifted infield. A one-run lead he expects to hold, on a tired bullpen.',
    strategy: {
      running: 'patient', steals: 'selective', bunt: 'rare',
      hook: 'quick', alignment: 'shift',
    },
  },
  {
    // Last on the list rather than first: a default presented at the top of four
    // options is the one everybody takes without reading the other three.
    id: 'balanced',
    name: 'BALANCED',
    blurb: 'No strong lean. Takes what the game offers and decides the rest one night at a time.',
    strategy: { ...DEFAULT_STRATEGY },
  },
];

/** What a coach plays like if nobody has said otherwise. */
export const DEFAULT_PHILOSOPHY: PhilosophyId = 'balanced';

export const isPhilosophyId = (value: unknown): value is PhilosophyId =>
  typeof value === 'string' && PHILOSOPHIES.some((p) => p.id === value);

export const philosophyOf = (id: PhilosophyId): Philosophy =>
  PHILOSOPHIES.find((p) => p.id === id) ?? (PHILOSOPHIES.at(-1) as Philosophy);

/**
 * The five policy values a philosophy stands for, as a fresh object.
 *
 * A copy rather than the table's own record, because what this returns is
 * assigned onto a team and lives there for a career — handing out the shared
 * constant would let one program's settings become every program's.
 */
export const strategyForPhilosophy = (id: PhilosophyId): Strategy =>
  ({ ...philosophyOf(id).strategy });

// ---------------------------------------------------------------------------
// The rest of the conference
// ---------------------------------------------------------------------------

const RUNNING_BY_TRAIT: RunningPolicy[] = ['patient', 'balanced', 'balanced', 'aggressive'];
const STEALS_BY_TRAIT: StealPolicy[] = ['never', 'selective', 'selective', 'constant'];
const BUNT_BY_TRAIT: BuntPolicy[] = ['never', 'rare', 'rare', 'often'];
const HOOK_BY_TRAIT: HookPolicy[] = ['quick', 'standard', 'standard', 'patient'];
const ALIGN_BY_TRAIT: Alignment[] = ['straight', 'straight', 'situational', 'shift'];

/**
 * Every other coach in the world gets a personality, derived from the team index
 * so it is stable across a save and varies across the league. The spec asks for
 * this directly: an aggressive coach steals and pulls starters early, a
 * conservative one bunts and plays for one run, and that variety is what makes
 * 96 programs feel like different places rather than one program repeated.
 *
 * Deliberately not random — a team that changed philosophy every time you looked
 * at it would be noise, not character.
 */
export function strategyFor(teamIndex: number): Strategy {
  const pick = <T,>(table: T[], salt: number): T =>
    table[(teamIndex * 7 + salt * 13) % table.length] as T;
  return {
    running: pick(RUNNING_BY_TRAIT, 1),
    steals: pick(STEALS_BY_TRAIT, 2),
    bunt: pick(BUNT_BY_TRAIT, 3),
    hook: pick(HOOK_BY_TRAIT, 4),
    alignment: pick(ALIGN_BY_TRAIT, 5),
  };
}

// ---------------------------------------------------------------------------
// The automatic lineup card
// ---------------------------------------------------------------------------

/**
 * A sound batting order for the nine men handed in.
 *
 * The classical construction, not an optimizer: the best pure hitter bats
 * third, the best power bat cleans up, the best table-setter who can also run
 * leads off, and the rest fall in by overall. It exists so a coach who does not
 * want to hand-build an order gets a defensible one in a tap — the same nine
 * men, every position intact, nobody duplicated and nobody dropped, which the
 * caller can rely on because this only ever *reorders* the array it was given.
 *
 * Deterministic, and it consumes nothing: ties break on name so the same nine
 * always produce the same card, and no rng is touched — pressing AUTO twice is
 * pressing it once.
 */
export function autoBattingOrder(nine: readonly Hitter[]): Hitter[] {
  const pool = [...nine];
  const byName = (a: Hitter, b: Hitter): number => a.name.localeCompare(b.name);
  const take = (score: (h: Hitter) => number): Hitter => {
    pool.sort((a, b) => score(b) - score(a) || byName(a, b));
    return pool.shift()!;
  };

  // Table-setting is contact and an eye; damage is power; the leadoff man
  // additionally wants wheels, because his job continues after the walk.
  const onBase = (h: Hitter): number => h.contact * 0.55 + h.eye * 0.45;
  const damage = (h: Hitter): number => h.power * 0.7 + h.contact * 0.3;
  const overall = (h: Hitter): number => h.contact + h.power + h.eye;

  const third = take(overall);                                  // best hitter
  const cleanup = take(damage);                                 // best power
  const leadoff = take((h) => onBase(h) + h.speed * 0.35);      // gets on, runs
  const second = take(onBase);                                  // moves him over
  const fifth = take(damage);                                   // protection
  const rest = [...pool].sort((a, b) => overall(b) - overall(a) || byName(a, b));

  return [leadoff, second, third, cleanup, fifth, ...rest];
}
