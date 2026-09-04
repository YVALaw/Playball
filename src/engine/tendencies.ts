// tendencies.ts
// What a player *does*, as against how well he does it.
//
// A rating says how good a man is. A tendency says what he is like, and the
// difference is the whole design constraint: **a tendency must not make anybody
// better.** Every one of them here is double-edged by construction — a free
// swinger walks less and ambushes more, a nibbler gives up fewer hits and more
// walks, a green light steals more bases and runs into more outs — and the two
// poles of each pair are sized so that the league total does not move when
// twenty percent of the country has one and twenty percent has the other.
//
// That balance is not a hope, it is arithmetic. Each slot hands its plus pole to
// 21% of players, its minus pole to 21%, and nothing to the 58% in between, and
// every multiplier pair averages to exactly 1.0 across those three groups. A
// change to one side of a pair without the other is a change to the run
// environment, and calibration will say so.
//
// **Nothing here spends a random draw**, for the same reason `arrivalAge` does
// not: every rng() call in `players.ts` sits in a fixed sequence and one draw per
// player per slot would move every calibration figure in the project. A tendency
// is hashed off the man's id, which makes it free, stable across a reload, and
// something no save has to carry.
//
// The one exception proves the rule. POWER ARM and JUNKBALLER are not hashed —
// they are read off the pitcher's finished repertoire in `pitches.ts`, because
// the brief asked for pitch usage to be real data with something consuming it
// rather than a caption. The usage shares decide the tendency; the tendency
// decides what happens on the mound.

import { fastballShare, repertoireOf } from './pitches.js';
import { scoutNoise } from './scouting.js';
import { isTwoWay } from './types.js';
import type { Arm, Hitter, Pitcher, Player, Team } from './types.js';

/**
 * The nine slots. A player has one reading in each slot that applies to him:
 * five for a hitter, four for a pitcher.
 *
 * `clutch` and `poise` are the same idea on the two sides of the ball and are
 * separate ids on purpose — they read differently, they are learned at
 * different speeds, and one label that changed meaning depending on who was
 * holding it would be the kind of thing a screen gets wrong once.
 */
export type TendencyId =
  | 'approach' | 'firstPitch' | 'running' | 'spray' | 'clutch'
  | 'zone' | 'pace' | 'mix' | 'poise';

/** Which pole a man sits on. Zero is the ordinary player, and most men are. */
export type Pole = -1 | 0 | 1;

/** What evidence a coach has to accumulate before he can say it out loud. */
export type WatchUnit = 'pa' | 'on' | 'bip';

export interface TendencySpec {
  id: TendencyId;
  side: 'hitter' | 'pitcher';
  /** Name of the +1 pole and of the -1 pole. */
  plus: string;
  minus: string;
  /** One line each, in the register the ratings bars use. */
  plusNote: string;
  minusNote: string;
  /** What has to be watched, and how much of it. See "discovery" below. */
  unit: WatchUnit;
  need: number;
}

/**
 * Discovery, and why the numbers are the size they are.
 *
 * A tendency on your own player is **not visible on the day he signs**. It is
 * learned by watching him play, and "watching" has to mean something in a game
 * where most of the season is simulated — a flag flipped after one appearance
 * would be a loading screen, not a mechanic. So each slot names the *evidence*
 * it needs and the unit that evidence is counted in, and the count accrues out
 * of real box scores, whether you managed the game or pressed SIM.
 *
 * The units are the honest ones. A spray chart comes from balls in play, so it
 * is counted in balls in play; you can only learn whether a man runs from the
 * times he is standing on a base. And the thresholds run from "you can see it in
 * a fortnight" to "you will not be sure until his second year", which sorts the
 * tendencies exactly the way real baseball knowledge sorts: a repertoire is the
 * first thing you know about a pitcher and whether he is clutch is the last
 * thing anybody knows about anyone. That ordering is the point, and it is also
 * what the research says — clutch talent is the smallest and least reliable
 * signal in the sport, so it should take the longest to see.
 *
 * A regular takes about 200 plate appearances a season and a Friday starter
 * faces about 330 batters, so: the mix and the first-pitch read arrive inside a
 * month, the approach and the spray chart by midseason, the pace and the zone
 * late in a first year, and clutch and poise land somewhere in year two. A
 * seventh reliever may never be read at all, which is the correct answer about a
 * seventh reliever.
 */
export const TENDENCIES: Record<TendencyId, TendencySpec> = {
  approach: {
    id: 'approach', side: 'hitter', unit: 'pa', need: 120,
    plus: 'FREE SWINGER',
    minus: 'PATIENT',
    plusNote: 'Ambushes anything near the zone. Fewer walks, more damage when he connects',
    minusNote: 'Makes him throw it. More walks, and he gives up something on contact',
  },
  firstPitch: {
    id: 'firstPitch', side: 'hitter', unit: 'pa', need: 70,
    plus: 'HUNTS STRIKE ONE',
    minus: 'TAKES STRIKE ONE',
    plusNote: 'Swings at the first good one. Short at-bats, and a starter he lets off the hook',
    minusNote: 'Never offers at the first pitch. Long at-bats that run a pitch count up',
  },
  running: {
    id: 'running', side: 'hitter', unit: 'on', need: 40,
    plus: 'GREEN LIGHT',
    minus: 'STATION TO STATION',
    plusNote: 'Goes on his own. More bases taken and more outs on the paths',
    minusNote: 'Takes the base he is given and no more. Never runs into a throw',
  },
  spray: {
    id: 'spray', side: 'hitter', unit: 'bip', need: 100,
    plus: 'PULL-HAPPY',
    minus: 'USES THE WHOLE FIELD',
    plusNote: 'Everything to his side of the diamond. A shift is aimed at him',
    minusNote: 'Hits it where it is pitched. A shift against him is a gift',
  },
  clutch: {
    id: 'clutch', side: 'hitter', unit: 'pa', need: 300,
    plus: 'CLUTCH',
    minus: 'TIGHTENS UP',
    plusNote: 'A different hitter with a man in scoring position, and an ordinary one otherwise',
    minusNote: 'Presses when it matters. His numbers come with the bases empty',
  },
  zone: {
    id: 'zone', side: 'pitcher', unit: 'pa', need: 200,
    plus: 'ATTACKER',
    minus: 'NIBBLER',
    plusNote: 'Comes right at them. Few walks, and the ball leaves the yard sometimes',
    minusNote: 'Lives off the plate. Hard to square up, and he walks the park',
  },
  pace: {
    id: 'pace', side: 'pitcher', unit: 'pa', need: 120,
    plus: 'QUICK WORKER',
    minus: 'DELIBERATE',
    plusNote: 'Gets the ball and throws it. Goes deep, and shows a lineup the same look sooner',
    minusNote: 'Takes his time. Burns through a pitch count, and wears better the third time round',
  },
  mix: {
    id: 'mix', side: 'pitcher', unit: 'pa', need: 60,
    plus: 'POWER ARM',
    minus: 'JUNKBALLER',
    plusNote: 'Fastball first, second and third. Strikeouts, and the odd one a long way',
    minusNote: 'Spins and slows it. Ground balls and soft contact, and fewer swings and misses',
  },
  poise: {
    id: 'poise', side: 'pitcher', unit: 'pa', need: 450,
    plus: 'BEARS DOWN',
    minus: 'LOSES THE THREAD',
    plusNote: 'Finds another gear with men in scoring position, and coasts when nobody is on',
    minusNote: 'Unravels once they are on. His good innings are the quiet ones',
  },
};

export const HITTER_TENDENCIES: readonly TendencyId[] =
  ['approach', 'firstPitch', 'running', 'spray', 'clutch'];
export const PITCHER_TENDENCIES: readonly TendencyId[] =
  ['mix', 'zone', 'pace', 'poise'];

/**
 * How much of the country sits on each pole.
 *
 * Symmetric on purpose: the plus pole and the minus pole are the same size, so
 * every multiplier pair below averages to exactly one across the population and
 * the league's run environment does not know tendencies exist.
 */
const POLE_SHARE = 0.21;

/** Salts, one per slot, in a band nothing else uses. See pitches.ts. */
const SALT: Record<TendencyId, number> = {
  approach: 7301, firstPitch: 7307, running: 7313, spray: 7321, clutch: 7333,
  zone: 7349, pace: 7351, mix: 0, poise: 7369,
};

/**
 * Where the pitch mix has to sit to be worth a name.
 *
 * Measured off four thousand generated arms: the twenty-first percentile of
 * fastball share is .470 and the seventy-ninth is .655, so these thresholds
 * hand each pole the same 21% every other slot hands it — without a hash, and
 * off the usage numbers the card is already printing. Re-measure if the
 * repertoire weights in `pitches.ts` change.
 */
const MIX_JUNK = 0.470;
const MIX_POWER = 0.655;

function poleOf(p: Player, slot: TendencyId): Pole {
  if (slot === 'mix') {
    if (p.type !== 'pitcher' && !isTwoWay(p)) return 0;
    const share = fastballShare(repertoireOf(p as Arm));
    return share >= MIX_POWER ? 1 : share <= MIX_JUNK ? -1 : 0;
  }
  const u = scoutNoise(p.id, SALT[slot]);
  return u < POLE_SHARE ? -1 : u > 1 - POLE_SHARE ? 1 : 0;
}

/** Every slot that applies to this man, with the pole he sits on. */
export type TendencySet = Partial<Record<TendencyId, Pole>>;

const CACHE = new Map<string, TendencySet>();

export function tendenciesOf(p: Player): TendencySet {
  const hit = CACHE.get(p.id);
  if (hit) return hit;
  // A two-way man is read on both sides of the ball, which is the honest
  // version of him: FREE SWINGER at the plate and NIBBLER on the mound can
  // be the same young man having two different arguments with the zone.
  const slots = isTwoWay(p)
    ? [...HITTER_TENDENCIES, ...PITCHER_TENDENCIES]
    : p.type === 'hitter' ? HITTER_TENDENCIES : PITCHER_TENDENCIES;
  const set: TendencySet = {};
  for (const slot of slots) set[slot] = poleOf(p, slot);
  CACHE.set(p.id, set);
  return set;
}

/** What this man's reading in one slot is called, or null where he is ordinary. */
export function tendencyLabel(p: Player, slot: TendencyId): string | null {
  const pole = tendenciesOf(p)[slot] ?? 0;
  if (pole === 0) return null;
  return pole > 0 ? TENDENCIES[slot].plus : TENDENCIES[slot].minus;
}

// ---------------------------------------------------------------------------
// The scout's book: what a TEAM is like
// ---------------------------------------------------------------------------

/**
 * One read on a rival club, in the scout's own voice: what they do, and what
 * to do about it.
 */
export interface TeamRead {
  slot: TendencyId;
  title: string;
  text: string;
}

/**
 * The book's lines, one pair per slot. {n} is how many men carry the habit
 * and {of} how many were counted — the scout says the number out loud
 * because "four of the nine" is a plan and "some of them" is a shrug. Every
 * text names the counter-move, because a read you cannot act on is trivia.
 */
const READS: Record<TendencyId, { plus: [string, string]; minus: [string, string] }> = {
  approach: {
    plus: ['They chase',
      '{n} of the {of} in that lineup are free swingers. Spin it off the plate early — nobody up there came to walk.'],
    minus: ['They make you throw it',
      '{n} of {of} are patient bats. A nibbler walks the yard against this club; attack the zone and let the defence work.'],
  },
  firstPitch: {
    plus: ['Ambush hitters',
      '{n} of {of} hunt strike one. Start soft and away, and save the fastball for when you are ahead.'],
    minus: ['They give you strike one',
      '{n} of {of} watch the first pitch go by. Take the free strike every at-bat and work from ahead.'],
  },
  running: {
    plus: ['They run',
      '{n} of {of} have the green light. A quick delivery and an early throw over cools them; a slow arm feeds them bases.'],
    minus: ['Station to station',
      '{n} of {of} never take the extra base. Play the outfield honest and take every double play they offer.'],
  },
  spray: {
    plus: ['Shift them',
      '{n} of {of} pull everything. The shift was invented for this lineup — lean the defence and let them hit into it.'],
    minus: ['They use the whole field',
      '{n} of {of} hit it where it is pitched. Play everyone straight up; a shift against this club is a gift to them.'],
  },
  clutch: {
    plus: ['Dangerous with men on',
      '{n} of {of} turn into somebody else in scoring position. Keep the bases clean — the walk that sets them up is the mistake.'],
    minus: ['They tighten up',
      '{n} of {of} press when it matters. Put a runner on and make them feel it; their numbers come with the bases empty.'],
  },
  zone: {
    plus: ['Their arms come at you',
      '{n} of their {of} arms attack the zone. Sit on something early — the first strike is coming, and it is hittable.'],
    minus: ['A staff of nibblers',
      '{n} of {of} arms live off the plate. Take until they prove it; the walks are sitting there.'],
  },
  pace: {
    plus: ['Quick workers',
      '{n} of {of} arms get the ball and throw it, and they go deep for it. Long at-bats are the only road into that bullpen.'],
    minus: ['They burn their own counts',
      '{n} of {of} arms take their time and pay for it in pitches. Be patient and the starter is gone by the sixth.'],
  },
  mix: {
    plus: ['Power arms',
      '{n} of their {of} arms throw the fastball first, second and third. Sit dead red and swing like you mean it.'],
    minus: ['Junkballers',
      '{n} of {of} arms spin it and slow it. Stay back, take it the other way, and do not chase the changeup in the dirt.'],
  },
  poise: {
    plus: ['They bear down in trouble',
      '{n} of {of} arms find another gear with runners on. Traffic does not rattle this staff — score with damage, not patience.'],
    minus: ['They unravel with men on',
      '{n} of {of} arms lose the thread once somebody is standing behind them. Crowd the bases; one single starts the avalanche.'],
  },
};

/**
 * The team card — stage 16's tendencies screen, decided at the door: "team
 * card, 3–5 reads," on the rival's college profile, filled in once the
 * desk has scouted them (the caller holds the gate; this is pure).
 *
 * Aggregated from the same per-man poles the sim actually plays, counted
 * over the men who take the field — the nine in the lineup for the bat
 * slots, the whole staff for the arm slots — and a read only makes the book
 * when the count clears the league's base rate by a whole man, because
 * "about as many free swingers as anybody" is not a read. Strongest skews
 * first, at most five; when a club genuinely has fewer than three habits
 * worth planning around, the book says that too, which is itself a read.
 */
export function teamReads(team: Team): TeamRead[] {
  const bats = team.lineup;
  const arms = [...team.rotation, ...team.bullpen];
  const found: { read: TeamRead; strength: number }[] = [];
  for (const slot of [...HITTER_TENDENCIES, ...PITCHER_TENDENCIES]) {
    const men: Player[] = TENDENCIES[slot].side === 'hitter' ? bats : arms;
    if (men.length === 0) continue;
    let plus = 0;
    let minus = 0;
    for (const m of men) {
      const pole = tendenciesOf(m)[slot] ?? 0;
      if (pole > 0) plus += 1;
      else if (pole < 0) minus += 1;
    }
    const expected = men.length * POLE_SHARE;
    for (const [side, n] of [['plus', plus], ['minus', minus]] as const) {
      // Two men sharing a habit is the least a scout will put his name to;
      // anything below that is one player's card, not a team read.
      if (n < 2) continue;
      const [title, text] = READS[slot][side];
      found.push({
        read: {
          slot, title,
          text: text.replace('{n}', String(n)).replace('{of}', String(men.length)),
        },
        strength: n - expected,
      });
    }
  }
  /*
    Strongest skews first. Everything a whole man above the league's base
    rate makes the book on its own; when a club is too ordinary to fill
    three lines that way, the strongest leans fill in behind them — still
    real counts, just milder — and a club with nothing at all gets told so,
    which is itself the read.
  */
  found.sort((a, b) => b.strength - a.strength);
  const strong = found.filter((f) => f.strength >= 1);
  const leans = found.filter((f) => f.strength < 1);
  const book = strong.slice(0, 5).map((f) => f.read);
  while (book.length < 3 && leans.length > 0) {
    book.push((leans.shift() as { read: TeamRead }).read);
  }
  if (book.length < 3) {
    book.push({
      slot: 'approach', title: 'No habits worth planning around',
      text: 'Blank on purpose. Play them straight and beat them on talent.',
    });
  }
  return book;
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * What has been seen of one man, in the three units a tendency is read in.
 *
 * Three integers per player, accrued in `recordResult` from the box score of
 * every game his program plays — simulated or managed, it arrives through the
 * same door. It survives the season roll and the save, because a thing you spent
 * a year learning about a sophomore should still be true when he is a junior.
 */
export interface Watch {
  /** Plate appearances for a hitter; batters faced for a pitcher. */
  pa: number;
  /** Times he reached base, which is the only look a baserunning read gets. */
  on: number;
  /** Balls he put in play, which is where a spray chart comes from. */
  bip: number;
}

export const blankWatch = (): Watch => ({ pa: 0, on: 0, bip: 0 });

const seen = (w: Watch | undefined, unit: WatchUnit): number =>
  w === undefined ? 0 : unit === 'pa' ? w.pa : unit === 'on' ? w.on : w.bip;

/**
 * Is this tendency known yet?
 *
 * Your own men you learn by watching, which is the mechanic. An opponent's
 * book is **bought**: a scouting report saying their leadoff man runs is
 * precisely what a defensive setting is for, and through stage 10 it was
 * simply free — every rival card opened fully read. Stage 11 makes it the
 * scouting desk's product. `opponentScouted` is whether the money was spent
 * (or the staff spent it for you, in a casual career); it defaults open so
 * the engine's own callers and the tests keep their meaning.
 */
export function isKnown(
  slot: TendencyId, watch: Watch | undefined, isOurs: boolean,
  opponentScouted = true,
): boolean {
  if (!isOurs) return opponentScouted;
  return seen(watch, TENDENCIES[slot].unit) >= TENDENCIES[slot].need;
}

/** How far along the reading is, 0 to 1. What the card draws while it waits. */
export function watchProgress(slot: TendencyId, watch: Watch | undefined): number {
  const spec = TENDENCIES[slot];
  return Math.min(1, seen(watch, spec.unit) / spec.need);
}

// ---------------------------------------------------------------------------
// What each one actually does
// ---------------------------------------------------------------------------

/**
 * A pair of multipliers, plus pole first. Every pair here averages to exactly
 * 1.0 over the 21/58/21 population split, which is what keeps the league still.
 *
 * **The pace pairs are the exception to "neutral means harmless", and they were
 * cut back once for it.** Every other channel is a multiplier on an outcome, so
 * a pair that averages to one leaves the league exactly where it was. Pace is
 * not an outcome — it is how many pitches an at-bat takes, and pitches decide
 * when a starter is pulled and when he starts losing effectiveness. Neither of
 * those is linear in the pitch count, so a pair that is neutral on the
 * multiplier is not neutral on the season: at the first sizes tried, the
 * league's walk rate drifted 1.3% low, because shorter at-bats kept starters —
 * who throw more strikes than relievers — on the mound longer. They are about
 * forty percent smaller than they were, which keeps the flavour that a lineup of
 * ambushers lets a starter finish the seventh while costing the run environment
 * a fraction of what it did.
 */
type Pair = readonly [plus: number, minus: number];

const pairOf = (pole: Pole, [plus, minus]: Pair): number =>
  pole === 1 ? plus : pole === -1 ? minus : 1;

/**
 * The clutch split, and why the two halves are not the same size.
 *
 * A clutch hitter is not a better hitter, he is a hitter who has kept something
 * back. So the lift with a runner in scoring position is paid for exactly by the
 * dip with the bases empty, weighted by how often each situation arrives —
 * scoring position is about a quarter of plate appearances, so a +5.5% there
 * costs -1.7% in the other three quarters and his season line does not move.
 *
 * This is also the line between a tendency and a badge, which matters because
 * both of them can fire in the same spot. A tendency **redistributes**; a badge
 * **adds**. GETS HIM IN makes a man better with a man on second. CLUTCH makes
 * him a different man with a man on second, and the same man overall.
 */
const RISP_SHARE = 0.24;
const CLUTCH_LIFT = 0.055;
const CLUTCH_DIP = (CLUTCH_LIFT * RISP_SHARE) / (1 - RISP_SHARE);

/**
 * The plate appearance as the situational layer sees it.
 *
 * Declared here rather than in `badges.ts` because tendencies are the lower of
 * the two modules and both read the same shape: one description of "where in the
 * game are we", so a badge and a tendency cannot end up disagreeing about
 * whether a runner is in scoring position.
 */
export interface Situation {
  /** A runner on second or third. */
  risp: boolean;
  runnersOn: boolean;
  /** How many times this batter has seen this pitcher today. 1 is the first. */
  timesThrough: number;
  outs: number;
  inning: number;
  /** The batting side's runs minus the fielding side's, right now. */
  margin: number;
  /** Bases empty and nobody out: the top of an inning's work. */
  leadingOff: boolean;
  /** A bracket game. Set by the postseason, false everywhere else. */
  postseason: boolean;
}

/**
 * Everything a batter's and a pitcher's tendencies do to one plate appearance.
 *
 * Returned as multipliers on the batter's side of the log5 table, plus the two
 * knobs that sit outside it: the strikeout share of an out, and the ground ball
 * share of a ball in play. `pace` multiplies the length of the pitch sequence,
 * which is how a quick worker goes deeper into a game and a hitter who takes
 * strike one gets him out of it.
 */
export interface TendencyMods {
  walk: number;
  single: number;
  double: number;
  homerun: number;
  /** Applies to every offensive event at once — the clutch channel. */
  all: number;
  strikeout: number;
  groundBall: number;
  pace: number;
}

const NEUTRAL: TendencyMods = {
  walk: 1, single: 1, double: 1, homerun: 1, all: 1,
  strikeout: 1, groundBall: 1, pace: 1,
};

export function tendencyMods(
  batter: Hitter, pitcher: Arm, sit: Situation,
): TendencyMods {
  const b = tendenciesOf(batter);
  const p = tendenciesOf(pitcher);
  const m: TendencyMods = { ...NEUTRAL };

  // FREE SWINGER / PATIENT. He is not better or worse, he is earlier: the walks
  // he does not take are turned into swings, and a swing at a pitch he was
  // ahead on does more damage than one he was behind on.
  const approach = b.approach ?? 0;
  m.walk *= pairOf(approach, [0.78, 1.22]);
  m.double *= pairOf(approach, [1.05, 0.95]);
  m.homerun *= pairOf(approach, [1.05, 0.95]);
  m.strikeout *= pairOf(approach, [1.05, 0.95]);
  m.pace *= pairOf(approach, [0.96, 1.04]);

  // HUNTS / TAKES STRIKE ONE. This one is mostly about somebody else: a lineup
  // that swings at the first pitch is a lineup the opposing starter gets through
  // on ninety pitches, and a lineup that takes it is why he is gone in the
  // fifth. The hitter's own trade is a few more balls in play against a few
  // fewer walks.
  const first = b.firstPitch ?? 0;
  m.pace *= pairOf(first, [0.92, 1.08]);
  m.single *= pairOf(first, [1.04, 0.96]);
  m.walk *= pairOf(first, [0.92, 1.08]);

  // CLUTCH / TIGHTENS UP, and its mirror on the mound.
  const clutch = b.clutch ?? 0;
  if (clutch !== 0) {
    m.all *= sit.risp
      ? pairOf(clutch, [1 + CLUTCH_LIFT, 1 - CLUTCH_LIFT])
      : pairOf(clutch, [1 - CLUTCH_DIP, 1 + CLUTCH_DIP]);
  }
  const poise = p.poise ?? 0;
  if (poise !== 0) {
    // Reversed, because this is the pitcher's tendency acting on the batter's
    // events: an arm that bears down suppresses them.
    m.all *= sit.risp
      ? pairOf(poise, [1 - CLUTCH_LIFT, 1 + CLUTCH_LIFT])
      : pairOf(poise, [1 + CLUTCH_DIP, 1 - CLUTCH_DIP]);
  }

  // ATTACKER / NIBBLER. The oldest trade in pitching: the strike zone is where
  // the walks are not and where the home runs live.
  const zone = p.zone ?? 0;
  m.walk *= pairOf(zone, [0.82, 1.18]);
  m.homerun *= pairOf(zone, [1.07, 0.93]);
  m.single *= pairOf(zone, [1.02, 0.98]);
  m.pace *= pairOf(zone, [0.94, 1.06]);

  // QUICK WORKER / DELIBERATE. He saves pitches and pays for them the third
  // time through, because a man who works fast shows a lineup the same look
  // sooner. `timesThrough` is 1 the first time, so the penalty is on the excess.
  const paceP = p.pace ?? 0;
  m.pace *= pairOf(paceP, [0.95, 1.05]);
  if (paceP !== 0 && sit.timesThrough > 2) {
    const excess = pairOf(paceP, [1.25, 0.75]);
    m.all *= 1 + (excess - 1) * 0.06;
  }

  // POWER ARM / JUNKBALLER, read off the repertoire. Velocity misses bats and
  // leaves the park; spin and speed changes produce ground balls and soft
  // contact and rather fewer swings through it.
  const mix = p.mix ?? 0;
  m.strikeout *= pairOf(mix, [1.09, 0.91]);
  m.homerun *= pairOf(mix, [1.08, 0.92]);
  m.groundBall *= pairOf(mix, [0.89, 1.11]);

  return m;
}

/** GREEN LIGHT / STATION TO STATION, which act outside the plate appearance. */
export interface RunningMods {
  /** Scales how often he tries to steal, on top of the team's green light. */
  steal: number;
  /** Scales how often he tries for the extra base on a hit. */
  attempt: number;
  /** And how often trying gets him thrown out. */
  risk: number;
}

export function runningMods(h: Hitter): RunningMods {
  const pole = tendenciesOf(h).running ?? 0;
  // All three average to exactly one over the population, `risk` included. An
  // earlier draft had it at 1.35 against 0.75, which reads as a fair trade and
  // is not one: the two poles are the same size, so the pair's mean was 1.021
  // and the league quietly retired two percent more runners on the bases than
  // it had before tendencies existed. A pair that does not average to one is a
  // change to the run environment wearing a costume.
  return {
    steal: pairOf(pole, [1.70, 0.30]),
    attempt: pairOf(pole, [1.20, 0.80]),
    risk: pairOf(pole, [1.30, 0.70]),
  };
}

/**
 * PULL-HAPPY / USES THE WHOLE FIELD, as a weight on the pull lane.
 *
 * This is the tendency the fielding rework made possible: before there were real
 * batted-ball lanes there was nowhere to put it. It moves who fields the ball
 * rather than whether it is caught, and it is what makes a defensive alignment a
 * bet on a particular hitter instead of a coin flip.
 */
export function pullMultiplier(h: Hitter): number {
  return pairOf(tendenciesOf(h).spray ?? 0, [1.28, 0.75]);
}

/** How much more or less pull-prone the shift should read him as. */
export function shiftBias(h: Hitter): number {
  return pairOf(tendenciesOf(h).spray ?? 0, [1.25, 0.75]);
}
