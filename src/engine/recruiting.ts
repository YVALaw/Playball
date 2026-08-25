// recruiting.ts
// Where next year's team comes from.
//
// Modelled on Campus Dynasty, which is the game this one is chasing: three
// rounds of point-based recruiting, hometown advantages, and — the part that
// makes it a game rather than a lookup table — persistent recruitment can pull a
// player away from a program much bigger than yours.
//
// Three ideas carry the whole system.
//
// **Recruits have priorities.** Every prospect weighs five things differently,
// and a program's pitch is only as good as the match. A five star who wants to
// play immediately is a live target for a program that would otherwise have no
// business in the conversation. That match — not a raw prestige gap — is what
// decides where players go.
//
// **Points accumulate.** Each week of the window every school chasing a recruit
// banks points from how well it fits him, plus whatever its coaches spend
// pitching him. Interest is a running total, not a die roll.
//
// **The most points wins.** Deliberately not a lottery. Under a lottery you can
// out-work a blue blood all winter and still lose the roll, which quietly makes
// effort decorative; under a running total, persistence is the mechanism by
// which a small program actually takes somebody. That is the moment the mode
// exists to produce.

import { ageFor, makeHitter, makePitcher } from './players.js';
import { overallOf } from './ratings.js';
import {
  GRADE_LADDER, TOP_GENERATED_GRADE, potentialGrade, scoutNoise, type PotentialGrade,
} from './scouting.js';
import type {
  Player, PlayerId, Position, Priorities, Priority, Rng,
} from './types.js';
import { STATES_BY_REGION, type Region } from '../data/schools.js';

/** Positions a class is built to cover, in rough proportion to roster need. */
const CLASS_SHAPE: readonly (Position | 'SP' | 'RP')[] = [
  'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF',
  'SP', 'SP', 'SP', 'RP', 'RP',
];

/**
 * The five things a recruit can care about.
 *
 * Each is a real quantity the program already has, not a number invented for
 * this screen — which is what stops the pitch system from being flavour text.
 *
 * The two type names moved to `types.ts` when a player started carrying his own
 * set into the draft. They are re-exported here because this is still where the
 * system lives and where every caller already looks for them.
 */
export type { Priority, Priorities } from './types.js';

export const PRIORITIES: readonly Priority[] =
  ['prestige', 'playingTime', 'winning', 'proximity', 'development'];

export const PRIORITY_LABEL: Record<Priority, string> = {
  prestige: 'THE NAME',
  playingTime: 'PLAYING TIME',
  winning: 'WINNING NOW',
  proximity: 'CLOSE TO HOME',
  development: 'DEVELOPMENT',
};

export const PRIORITY_BLURB: Record<Priority, string> = {
  prestige: 'wants to sign somewhere that means something',
  playingTime: 'wants to be in the lineup as a freshman',
  winning: 'wants to play in June, right away',
  proximity: 'wants to stay near home',
  development: 'wants a coach who will make him a draft pick',
};

export interface Prospect {
  readonly id: PlayerId;
  player: Player;
  /** 1 to 5. What the recruiting services think, which is what the UI shows. */
  stars: number;
  /** Where he is from. Matched against a program's region for the pipeline. */
  hometown: Region;
  /** The state he is actually from. A shared one is the pipeline. */
  state: string;
  /**
   * Where the services rank him nationally, 1 being the best in the country.
   *
   * A star rating puts a hundred and twenty players in the same bucket, which is
   * no help at all when you are choosing between two of them. The rank is what
   * makes "the 38th best player in the country" a different proposition from
   * "another four star", and it is what the board actually sorts on.
   */
  rank: number;
  /** What he is looking for. */
  priorities: Priorities;
  /**
   * The lowest program tier, in stars, that will get a hearing from him.
   *
   * A hard gate rather than a steep discount. A soft gate — where a one star
   * program may chase a five star and simply gain almost nothing — reads to the
   * player as a bug: the actions are spent, the button works, and nothing ever
   * comes of it. Refusing outright says what is true, which is that he is not
   * going to take the call.
   *
   * How far he will come down depends on what he wants. A recruit who cares
   * about playing time or staying near home will listen to a much smaller
   * program than one who wants the biggest name in the country — which is what
   * keeps a path open for a program recruiting against its weight, without
   * opening it for everybody at once.
   */
  minProgram: number;
  /**
   * Points banked by each program chasing him, by team index.
   *
   * A plain object rather than a Map so the class survives structured clone into
   * IndexedDB and across the worker boundary without a codec entry.
   */
  points: Record<number, number>;
  /** Actions each program has spent on him this week, by team index. */
  spent: Record<number, number>;
  /** Team index once he has committed. */
  signedBy: number | null;
  /** Which week of the window he committed in. */
  committedWeek: number | null;
}

export interface RecruitClass {
  year: number;
  /** 0 before the window opens, then 1 to 3, then closed. */
  week: number;
  prospects: Prospect[];
}

/** How many weeks the recruiting window runs. Campus Dynasty uses three. */
export const RECRUITING_WEEKS = 3;

/**
 * How many recruits a class may hold.
 *
 * A cap on *signings*, not on who you may talk to. Chasing eleven players with
 * eight scholarships is a legitimate way to work — you will lose some — and
 * capping the board instead would forbid the ordinary act of having more irons
 * in the fire than you can finish.
 */
export const SCHOLARSHIPS = 8;

/**
 * Recruiting budget per week.
 *
 * Thirty, spread across as many recruits as you like. The number matters less
 * than the ratio: it buys a decisive push on two or three players, or a thin one
 * on eight, and that trade is the whole screen.
 */
export const RECRUITING_BUDGET = 40;

/**
 * A week's budget, which a good program has more of.
 *
 * Prestige buys attention: facilities to show, a name that returns calls, a
 * staff big enough to be in three states at once. Forty is what a nobody gets;
 * a blue blood works with half again as much.
 *
 * This is the lever that makes the top of the board a real decision. A five
 * star costs more banked points than anybody can reach in one week, so landing
 * one means spending most of a window on him — and every scholarship you needed
 * elsewhere is still open when he signs. A big budget does not remove that
 * trade, it just moves where it bites.
 */
export function budgetFor(stars: number): number {
  return RECRUITING_BUDGET + Math.max(0, Math.round((stars - 1) * 5));
}

/**
 * The whole offseason's budget, which is now spent in two places.
 *
 * The draft phase runs immediately before the board opens and keeping a drafted
 * player is paid for out of this same pool — which is the entire reason the two
 * steps are next to each other. Keep the ace or sign the class.
 *
 * Whatever the draft took comes off every week evenly rather than emptying week
 * one. A coach who spent forty in June should find the window a third thinner
 * for three weeks, not shut for one and normal afterwards: the second version
 * would let him keep an ace and lose nothing he could not have recovered by
 * waiting.
 */
export const windowBudget = (stars: number): number =>
  budgetFor(stars) * RECRUITING_WEEKS;

export const weeklyBudget = (stars: number, spentOnTheDraft: number): number =>
  Math.max(0, Math.floor(
    (windowBudget(stars) - Math.max(0, spentOnTheDraft)) / RECRUITING_WEEKS,
  ));

/** The most that can go on one recruit in one week. Nobody signs on money alone. */
export const MAX_PER_RECRUIT = 12;

/** @deprecated Kept until the board screen stops naming it. */
export const BOARD_SLOTS = SCHOLARSHIPS;

/**
 * @deprecated The flat week every program outside the user's office worked with.
 *
 * It stopped being a harmless simplification the moment the draft gave the user
 * a second place to spend. His week comes off `budgetFor(stars)` and has money
 * taken out of it in June; the other ninety five had a flat forty that no
 * prestige raised and no draft could touch, so handing them a retention
 * mechanic would have been handing them free money. `aiTargets` reads
 * `weeklyBudget` now, exactly as his board does. Nothing else uses this.
 */
export const ACTIONS_PER_WEEK = RECRUITING_BUDGET;

/**
 * Star rating: what the services think, not what is true.
 *
 * This distinction is the whole reason recruiting is interesting. Ranking on the
 * *real* ceiling means stars and potential are the same fact wearing two hats —
 * a high ceiling can never hide, every sleeper is already a five star, and the
 * only surprises available are bad ones. Measured on the old formula: 46 of 145
 * highly graded recruits turned out to be busts, and the entire class contained
 * **one** player worth more than his grade. You could be fooled but you could
 * never find anybody.
 *
 * So the services see current ability clearly and project badly. A raw kid whose
 * ceiling nobody spotted comes out a two star, and finding him is the reward the
 * whole screen is built around.
 */
/**
 * The number the services actually rank on, before it is cut into stars.
 *
 * One function rather than a formula written twice, because the star rating and
 * the national rank are supposed to be two readings of the same opinion. They
 * were not. The rank was computed straight off `overallOf` and the **true**
 * ceiling with no error at all, which made `#rank` the most informative thing on
 * the board by a distance: a printed, perfectly ordered index of the truth,
 * sitting on every row above an estimate that was deliberately vague. Sorting by
 * it beat scouting, so scouting was decoration.
 *
 * Now the rank carries the same projection error the stars do, which is the
 * thing the comment underneath the sort already claimed and the code did not do.
 * A sharp player can still read something out of it — a recruit ranked well
 * above where his reported ability would put him is being carried by a ceiling
 * somebody believes in — and that inference is exactly the kind the board is
 * meant to reward.
 */
export function serviceScore(p: Player): number {
  // Stable per player, so the same recruit is rated the same by everyone.
  let h = 7919;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) | 0;
  const v = Math.sin(h * 0.0001) * 43758.5453;
  const miss = (v - Math.floor(v) - 0.5) * 26;

  // Weighted toward what he already does, because that is what a scout can
  // actually watch. The projection half carries the error.
  return overallOf(p) * 0.74 + (p.potential + miss) * 0.26;
}

export function starsFor(p: Player): number {
  const score = serviceScore(p);
  if (score >= 68) return 5;
  if (score >= 60) return 4;
  if (score >= 52) return 3;
  if (score >= 44) return 2;
  return 1;
}

/**
 * What this particular recruit is looking for.
 *
 * Biased by how good he is, and then deliberately scrambled. A five star usually
 * wants the name and a winner — he has those offers — while a two star mostly
 * wants to play and to stay near home. **Usually.** The outliers are the point:
 * a five star who wants the ball in his hands as a freshman is the one a small
 * program can actually take, and a system without him is a system where the
 * board is just the prestige table sorted twice.
 */
function drawPriorities(stars: number, rng: Rng): Priorities {
  return priorityWeights(stars, rng);
}

/**
 * The same five weights for a man nobody ever recruited.
 *
 * A rival program's roster is generated whole on the first day of the world and
 * a walk-on is manufactured in June, so neither ever sat on a recruiting board
 * and neither has weights of his own. The draft still has to ask what is
 * pulling him, and answering "the league average" would make every one of them
 * the same negotiation.
 *
 * Hashed out of the id rather than drawn, for the reason `arrivalAge` is: the
 * generator's sequence in players.ts is load bearing and this is worth no draws
 * at all. Stable, so the man reads the same way every time you open him.
 */
const PRIORITY_SALT = 4157;
export function prioritiesFor(id: string, stars: number): Priorities {
  let step = 0;
  return priorityWeights(stars, () => scoutNoise(id, PRIORITY_SALT + step++ * 13));
}

/**
 * One draw of the weights, from whatever source of numbers the caller has.
 *
 * Split so the recruiting board and the draft cannot drift apart: a man who
 * came through a class carries the weights the generator gave him, a man who
 * did not gets a hashed set from here, and both are the same distribution
 * rather than two that resemble each other.
 */
function priorityWeights(stars: number, roll: () => number): Priorities {
  const tilt = (stars - 3) / 2;                 // -1 for a one star, +1 for a five

  // Base leanings, before the dice.
  const base: Priorities = {
    prestige: 1.0 + tilt * 0.85,
    winning: 0.9 + tilt * 0.55,
    playingTime: 1.1 - tilt * 0.75,
    proximity: 1.0 - tilt * 0.45,
    development: 0.85 - tilt * 0.15,
  };

  // Every recruit gets a real personality on top, which is what produces the
  // outliers. The exponent makes the draw lumpy rather than uniform, so most
  // recruits have one or two things they clearly care about.
  const raw: Priorities = { ...base };
  let total = 0;
  for (const k of PRIORITIES) {
    const lump = Math.pow(roll(), 1.7) * 2.1;
    raw[k] = Math.max(0.04, base[k] * (0.45 + lump));
    total += raw[k];
  }
  for (const k of PRIORITIES) raw[k] /= total;
  return raw;
}

/**
 * Where each grade of recruit starts, and what it takes to bring him lower.
 *
 * `floor` is the smallest program he will hear out before his own priorities are
 * consulted; every threshold in `steps` his flexibility clears takes him down one
 * more tier. Written as a ladder rather than as arithmetic on his star rating
 * because the honest answer is different at each rung, and a single formula has
 * to be bent out of shape to say so.
 *
 * Nobody starts above four. A class the three programs at the top of the country
 * are the only ones allowed to call is a class nobody else can compete for, and
 * the point of the gate is a ladder, not a wall.
 *
 * The numbers are read off the flexibility distribution the priority draw
 * actually produces at each grade, which is why they are not a tidy sequence —
 * a two star is a far more flexible animal than a five star, so the same
 * threshold would mean something completely different to each of them.
 */
const REACH_LADDER: Record<number, { floor: number; steps: readonly number[] }> = {
  // A five star always hears out a four star program; only the ones who want
  // the ball, or want home, come further than that — about one in twenty-five.
  // Unchanged: this rung was already doing its job.
  5: { floor: 4, steps: [0.3333] },
  // This is the rung the complaint was about. Two in five four stars will look
  // at a three star program now, where it used to be every last one of them,
  // and about one in a hundred at a two star.
  4: { floor: 4, steps: [0.32, 0.58] },
  // Below the blue chips the ladder is about the bottom of the country rather
  // than the top: a three star is a *good* player at a small school, and a one
  // star program getting nine in ten of them is what made the bottom two tiers
  // of the prestige table interchangeable.
  3: { floor: 3, steps: [0.36, 0.485] },
  2: { floor: 2, steps: [0.42] },
  1: { floor: 1, steps: [] },
};

/**
 * How far down the ladder this recruit will listen.
 *
 * The tolerance is his own: a kid who wants the ball as a freshman, or to stay
 * near his family, will hear out a program a tier or two below him, while one
 * chasing the biggest name in the country will not come down at all. That is
 * where the upsets live, and they are a property of the recruit rather than a
 * global percentage — so the four star a small program can actually take is a
 * specific, identifiable player rather than a lottery ticket.
 *
 * Reported from testing: "I as a three star college have access to the very top
 * players." He did. A three star program could pursue **every four star in the
 * country** and just under half the national top fifty, because the old formula
 * only ever tightened the gate for five stars — and the top fifty is barely half
 * five stars. That made prestige a budget modifier with a cosmetic gate attached
 * rather than a ladder you climb, which is the one thing a dynasty is for. Only
 * a four or five star program sees the whole board now; below that the ceiling
 * comes down a rung at a time.
 */
function reachOf(stars: number, priorities: Priorities): number {
  // Wanting to play, or to play near home, is what brings a recruit down;
  // wanting the name does not.
  const flexible = priorities.playingTime + priorities.proximity;
  const rung = REACH_LADDER[Math.max(1, Math.min(5, stars))] as
    { floor: number; steps: readonly number[] };

  let min = rung.floor;
  for (const step of rung.steps) if (flexible > step) min -= 1;
  return Math.max(1, Math.min(4, min));
}

/** Whether a program of this tier may recruit him at all. */
export function canPursue(prospect: Prospect, programStars: number): boolean {
  return programStars >= prospect.minProgram;
}

/**
 * The order any list of recruits reads in: national ranking, best first.
 *
 * One comparator rather than a sort written out at each call site, because the
 * board and the signing day report are showing the same players with the same
 * `#rank` printed beside their names — and a class that reads 4, 2, 9, 1 on one
 * screen and 1, 2, 4, 9 on the next makes one of them look broken. Sorting on
 * stars instead, which is what the class review did, puts a hundred and twenty
 * players in one bucket and then leaves their order to whatever the array
 * happened to be.
 *
 * Ranks are unique inside a class, so the tie-breaks are insurance rather than
 * routine: an unranked recruit (a save written before ranks existed carries a
 * zero) sorts last instead of first, and stars then name keep the order stable
 * across renders rather than letting an unstable sort reshuffle equal keys.
 */
export const byRank = (a: Prospect, b: Prospect): number =>
  (a.rank || Number.MAX_SAFE_INTEGER) - (b.rank || Number.MAX_SAFE_INTEGER)
  || b.stars - a.stars
  || a.player.name.localeCompare(b.player.name);

/** The regions a recruit can be from, in rough proportion to where talent is. */
const HOME_REGIONS: readonly Region[] = [
  'Gulf', 'Gulf', 'Gulf',
  'Atlantic', 'Atlantic', 'Atlantic',
  'Pacific', 'Pacific',
  'Desert',
  'Heartland',
  'Great Lakes',
  'Mountain',
  'Northeast',
];

/**
 * Build a national class.
 *
 * Sized well above what the league will sign so there is genuine competition at
 * the top and leftovers at the bottom. The quality distribution is deliberately
 * bottom heavy — five star recruits are rare, which is what makes landing one
 * matter.
 */
export function generateClass(year: number, teams: number, rng: Rng): RecruitClass {
  const size = Math.round(teams * 7.5);
  const prospects: Prospect[] = [];

  for (let i = 0; i < size; i++) {
    const roll = rng();
    const quality =
      roll > 0.97 ? 66 + rng() * 10
      : roll > 0.88 ? 58 + rng() * 8
      : roll > 0.65 ? 50 + rng() * 8
      : roll > 0.30 ? 42 + rng() * 8
      : 34 + rng() * 8;

    const slot = CLASS_SHAPE[i % CLASS_SHAPE.length] as Position | 'SP' | 'RP';
    const player: Player = slot === 'SP' || slot === 'RP'
      ? makePitcher(rng, quality, { role: slot })
      : makeHitter(rng, quality, { pos: slot });
    player.classYear = 'FR';
    // He was generated at whatever class year the draw handed him, so his age
    // has to come back into step with the freshman he is about to be.
    player.age = ageFor(player.id, 'FR');

    const stars = starsFor(player);
    const home = HOME_REGIONS[Math.floor(rng() * HOME_REGIONS.length)] as Region;
    const priorities = drawPriorities(stars, rng);
    // Written onto the man himself as well as onto the prospect wrapper. The
    // wrapper is thrown away on signing day and the player is not, and three
    // years later the draft wants to know the same thing about him that the
    // recruiting board did.
    player.priorities = priorities;
    prospects.push({
      id: player.id,
      player,
      stars,
      hometown: home,
      state: STATES_BY_REGION[home][Math.floor(rng() * STATES_BY_REGION[home].length)] as string,
      priorities,
      minProgram: reachOf(stars, priorities),
      rank: 0,
      points: {},
      spent: {},
      signedBy: null,
      committedWeek: null,
    });
  }

  // Ranked once, nationally, on what the services think — the same score the
  // stars are cut from, error and all. See `serviceScore` for why it has to be
  // that score and not the truth.
  //
  // The rank matters because a star rating puts a hundred and twenty players in
  // one bucket, which is no help when you are choosing between two of them. "The
  // 38th best player in the country" is a different proposition from "another
  // four star". Assigned here rather than derived on screen so every program is
  // looking at the same board.
  prospects.sort((a, b) => serviceScore(b.player) - serviceScore(a.player));
  prospects.forEach((p, i) => { p.rank = i + 1; });

  return { year, week: 0, prospects };
}

// ---------------------------------------------------------------------------
// What you think he is
// ---------------------------------------------------------------------------

/*
  The board used to print a recruit's overall as one number and his ceiling as
  one letter. Both were near enough the truth, free, and identical for every
  coach in the country — so there was nothing to scout, no way to be wrong, and
  signing day could never surprise anybody. A screen that hands you the answer
  is a screen with no decision on it.

  What replaces it is an estimate, and reading the estimate is the skill.

  **The window is as wide as you are bad at this.** Nothing else moves it — not
  the recruit's star rating, not his rank, not how long you have been on him.
  Recruiting happens in three weeks at the end of a season, so there is no room
  for a scouting economy where you buy looks at individual players; the only
  lever is what the coach himself knows, which is `coach.skills.recruiting`. It
  runs 20 on your first day to 99, and the width runs 30 rating points down to
  6 across that span. That is the entire payoff for the points you spend here,
  so it has to be visible at a glance, and it is: a rookie's report says a kid
  is somewhere between 40 and 70, which is most of the class, and a veteran's
  says 61 to 67.

  **The truth is inside the window but hardly ever in the middle.** A band the
  answer sits at the centre of is an exact number with extra steps — you read
  the midpoint and carry on. So the truth is placed by a draw that *avoids* the
  centre: fewer than one recruit in ten lands within the middle fifth of his own
  band. You cannot average your way out of it either, because every number on
  the sheet — overall and each individual tool — is shifted by the same amount
  in the same direction. A scout who is high on a player is high on all of him.

  **Two vague signals, drawn on two different facts.** One line about how high
  people think he can go, one about how much of him is still to come. Neither
  settles anything alone; together they are evidence. A ceiling line that says
  people are talking about the draft, next to a development line that says
  everything is still in front of him, describes a very different bet from the
  same first line beside "there is not much left to teach him".

  **A hint is never false.** Every line carries the span of true grades it stays
  honest for, and the spans overlap heavily. That overlap is load bearing: if
  each line belonged to exactly one grade, a player who had seen it twice would
  know the grade, the line would be the letter spelled out in words, and the
  window would be decoration. So the pool a recruit draws from widens as his
  ceiling rises but keeps the modest lines at the bottom of it — which is how an
  S can honestly draw an understated line, and how a gem hides in plain sight.
  Nothing said about him was untrue; it was only quiet.
*/

/** The lowest and the highest a report will commit to. */
export interface ReportRange {
  low: number;
  high: number;
}

/** A ceiling written as a span of letters, because one letter would be a lie. */
export interface GradeBand {
  low: PotentialGrade;
  high: PotentialGrade;
}

/** Where a coach sits between his first day on the job and the best in it. */
const skillReach = (recruitingSkill: number): number =>
  Math.max(0, Math.min(1, (recruitingSkill - 20) / 79));

/**
 * How many rating points a report spans, bottom to top.
 *
 * Thirty at the start of a career and six at the end of one, straight down the
 * line between them. Linear because a coach point costs the same whichever one
 * he is buying, and a curve would quietly make the middle of the track a worse
 * deal than the ends without ever saying so on screen.
 */
export function reportWidth(recruitingSkill: number): number {
  return 30 - 24 * skillReach(recruitingSkill);
}

/**
 * How many grades of daylight a ceiling is written across, beyond the first.
 *
 * Never zero. A single letter is an exact answer, and the ceiling is the one
 * thing on this screen nobody is ever allowed to be certain of — so the best
 * recruiter alive still writes "A – S" and lives with it. Three steps at the
 * bottom of the ladder is four letters of a six letter scale, which is close
 * enough to useless to be worth fixing.
 */
export function reportGradeSteps(recruitingSkill: number): number {
  return Math.max(1, Math.round(3 - 2 * skillReach(recruitingSkill)));
}

/**
 * One salt per thing a report says, so the draws do not move together.
 *
 * `bias` is deliberately shared by the overall and every individual tool. Six
 * independently placed bands would let a player average their midpoints and
 * recover the truth to a third of the width the coach was supposed to be stuck
 * with — the estimate defeated with arithmetic, which is exactly what this
 * replaced. One bias for the whole sheet means averaging returns the bias.
 */
const SALT = {
  bias: 3301,
  ceiling: 3307,
  ceilingHint: 3313,
  developmentHint: 3319,
} as const;

/**
 * Where the truth sits inside a window, as a fraction up from the bottom.
 *
 * Bowed away from the middle rather than uniform, so the midpoint is the least
 * likely place for him to be instead of the most likely. Reading the centre of
 * the band is still unbiased over a whole class — the draw is symmetric — but it
 * is wrong on almost every individual recruit, which is the point. Held off the
 * very edges too: a truth that were always the top or the bottom number would be
 * just as readable as one that were always the middle.
 */
function truthPosition(id: string, salt: number): number {
  const u = scoutNoise(id, salt);
  const side = u < 0.5 ? -1 : 1;
  const outward = Math.abs(u * 2 - 1);
  return 0.5 + side * 0.44 * Math.pow(outward, 0.62);
}

/**
 * A window of the coach's width with the truth somewhere inside it.
 *
 * The width is held exactly, even up against the ends of the rating scale: a
 * band that got narrower near 99 would say "he is one of the best in the class"
 * out of the side of its mouth. So it slides instead of shrinking, and the
 * width goes on meaning only one thing, which is how good you are at this.
 */
function windowAround(truth: number, id: string, recruitingSkill: number): ReportRange {
  const width = reportWidth(recruitingSkill);
  const span = Math.round(width);
  let low = Math.round(truth - truthPosition(id, SALT.bias) * width);
  // Whatever the rounding did, he is inside his own band.
  low = Math.max(truth - span, Math.min(truth, low));
  low = Math.max(1, Math.min(99 - span, low));
  return { low, high: low + span };
}

/** What a coach of this standard would put on the recruit's present ability. */
export function reportedOverall(prospect: Prospect, recruitingSkill: number): ReportRange {
  return windowAround(overallOf(prospect.player), prospect.id, recruitingSkill);
}

/** The same, for one individual tool. Shifted the same way — see `SALT`. */
export function reportedTool(
  prospect: Prospect, rating: number, recruitingSkill: number,
): ReportRange {
  return windowAround(rating, prospect.id, recruitingSkill);
}

/**
 * What a coach of this standard would put on the ceiling.
 *
 * Graded on the true potential rather than on a blend of present and future,
 * because the uncertainty now lives in the width of the band instead of in a
 * fudge inside the number. The band is on the same letter scale a player you
 * already own is graded against, so "we scouted him C to S and he came out A"
 * is a sentence the class review can actually say.
 */
export function reportedPotential(
  prospect: Prospect, recruitingSkill: number,
): GradeBand {
  const steps = reportGradeSteps(recruitingSkill);
  const truth = GRADE_LADDER.indexOf(potentialGrade(prospect.player.potential));
  const below = Math.min(
    steps, Math.floor(truthPosition(prospect.id, SALT.ceiling) * (steps + 1)),
  );
  // Slid back onto the ladder at either end, never trimmed, for the same reason
  // the numeric window slides.
  //
  // The top of the ladder is the best grade the world can actually produce, not
  // the last entry in the array. S+ sits above it and belongs to a store player,
  // so a band that reached for it would be a report promising a ceiling nobody
  // in the country is allowed to have — and the promise would be unfalsifiable,
  // since no recruit could ever turn out to have deserved it.
  const top = GRADE_LADDER.indexOf(TOP_GENERATED_GRADE);
  const low = Math.max(0, Math.min(top - steps, truth - below));
  return {
    low: GRADE_LADDER[low] as PotentialGrade,
    high: GRADE_LADDER[low + steps] as PotentialGrade,
  };
}

/**
 * A line a scout will say out loud, and the grades it stays honest for.
 *
 * `to` is not "the highest grade this describes well". It is the highest grade
 * at which the line is still **true** — the point past which it stops being an
 * understatement and starts being a lie. "He is close to the player he is going
 * to be" is quiet praise for a C and simply false about an S, so it stops at C.
 * "He plays hard, and that travels" is true of everybody, so it never stops, and
 * a player who has watched two of those turn into All-Americans will start
 * wondering about the third. That wondering is the whole game.
 */
export interface CeilingLine {
  readonly text: string;
  readonly from: PotentialGrade;
  readonly to: PotentialGrade;
}

/**
 * Everything the area men come back saying.
 *
 * Ordered from the most guarded to the loudest, which is also roughly the order
 * of their floors — so the pool a recruit draws from is close to a prefix of
 * this list extended upward, and a better ceiling means more to choose from
 * without ever losing the quiet lines underneath.
 */
export const CEILING_LINES: readonly CeilingLine[] = [
  { text: 'He is close to the player he is going to be.', from: 'D', to: 'C' },
  { text: 'Polished for his age. Whether there is any more is the question.', from: 'D', to: 'B' },
  { text: 'Nobody came back from seeing him with a story to tell.', from: 'D', to: 'B' },
  { text: 'Our area man likes him more than the rankings do.', from: 'D', to: 'B' },
  { text: 'There is no one loud thing about him. He just plays.', from: 'D', to: 'B' },
  { text: 'He is going to have to earn every inch of it.', from: 'D', to: 'S+' },
  { text: 'He would have to develop, but the frame is there.', from: 'D', to: 'S+' },
  { text: 'He plays hard, and that travels.', from: 'D', to: 'S+' },
  { text: 'Two years of good coaching and we would know a lot more.', from: 'D', to: 'S+' },
  { text: 'The body is going to change. What happens after that, nobody can say.', from: 'D', to: 'S+' },
  { text: 'Nobody has watched him enough to be confident either way.', from: 'D', to: 'S+' },
  { text: 'Coaches in the area think he can play at this level.', from: 'C', to: 'A' },
  { text: 'Late to the sport. Nobody is sure where his line goes.', from: 'C', to: 'S+' },
  { text: 'The raw material is better than the results so far.', from: 'C', to: 'S+' },
  { text: 'There is more here than the numbers say.', from: 'C', to: 'S+' },
  { text: 'He has a tool you could build something around.', from: 'C', to: 'S+' },
  { text: 'Every list has him somewhere. No two of them agree where.', from: 'C', to: 'S+' },
  { text: 'He would not be the first out of that county to surprise people.', from: 'C', to: 'S+' },
  { text: "Our man wrote 'interesting' and underlined it twice.", from: 'C', to: 'S+' },
  { text: 'He is a better athlete than he is a baseball player, for now.', from: 'C', to: 'S+' },
  { text: 'Scouts keep finding reasons to go back and see him again.', from: 'B', to: 'S+' },
  { text: 'He has been the best player on every field he has been on.', from: 'B', to: 'S+' },
  { text: 'Two programs offered him after one look.', from: 'B', to: 'S+' },
  { text: 'The staff argued about him for an hour and got nowhere.', from: 'B', to: 'S+' },
  { text: 'He does not look like a high school player out there.', from: 'B', to: 'S+' },
  { text: 'If it ever comes together we will be glad we were early.', from: 'B', to: 'S+' },
  { text: 'The upside is the reason he is on this list at all.', from: 'B', to: 'S+' },
  { text: 'Our cross-checker moved a trip to go and see him.', from: 'B', to: 'S+' },
  { text: 'People who saw him in the summer have not stopped talking about it.', from: 'B', to: 'S+' },
  { text: 'There are people who believe he is the best in the state.', from: 'A', to: 'S+' },
  { text: 'There is talk he will be drafted out of high school.', from: 'A', to: 'S+' },
  { text: 'Every program in the country has been through his gym.', from: 'A', to: 'S+' },
  { text: 'The area men have run out of comparisons.', from: 'A', to: 'S+' },
  { text: 'Nobody on this staff wants to be the one who passed.', from: 'A', to: 'S+' },
  { text: 'People stop what they are doing to watch him.', from: 'A', to: 'S+' },
  { text: 'He has a chance to be something, and the room knows it.', from: 'A', to: 'S+' },
  { text: 'Three head coaches have already been to his house.', from: 'A', to: 'S+' },
];

/**
 * How much of him is still to come — the second signal, on a different fact.
 *
 * Drawn on the distance between what he can do now and what he will ever do,
 * which is very nearly independent of how high that ceiling is: measured over a
 * full class, every grade from D to A has finished players and projects in it.
 * That independence is what makes the pair worth having. One line narrows the
 * ceiling; the other says how much of the overall band is growth still owed
 * rather than ability already on the field, and the two together bracket a
 * recruit far better than either does alone.
 */
export type Rawness = 'finished' | 'close' | 'raw' | 'project';

const RAWNESS_LADDER: readonly Rawness[] = ['finished', 'close', 'raw', 'project'];

/**
 * Which of those four he is.
 *
 * Cut at the quartiles of what a class actually produces rather than at round
 * numbers: the median recruit has five points of growth left in him, so a cut
 * at "twenty points is raw" would put the whole country in one band and say
 * nothing about anybody.
 */
export function rawnessOf(p: Player): Rawness {
  const left = p.potential - overallOf(p);
  return left <= 3 ? 'finished' : left <= 8 ? 'close' : left <= 15 ? 'raw' : 'project';
}

export interface DevelopmentLine {
  readonly text: string;
  readonly from: Rawness;
  readonly to: Rawness;
}

/** Spanning at least two bands each, for the same reason the ceiling lines do. */
export const DEVELOPMENT_LINES: readonly DevelopmentLine[] = [
  { text: 'There is not much left to teach him.', from: 'finished', to: 'close' },
  { text: 'He is as far along as anybody in this class.', from: 'finished', to: 'close' },
  { text: 'Physically he is already where he needs to be.', from: 'finished', to: 'close' },
  { text: 'What he does, he does properly.', from: 'finished', to: 'close' },
  { text: 'He is closer to ready than most of the names around him.', from: 'finished', to: 'close' },
  { text: 'He has things to clean up, the way they all do at that age.', from: 'finished', to: 'raw' },
  { text: 'The mechanics are ordinary. Nothing about them is broken.', from: 'finished', to: 'raw' },
  { text: 'There is honest work left in him, and a year to do it.', from: 'close', to: 'raw' },
  { text: 'A winter in a weight room would tell you a lot.', from: 'close', to: 'project' },
  { text: 'The best of him only shows up in flashes.', from: 'close', to: 'project' },
  { text: 'The distance between his good days and his bad ones is the story.', from: 'close', to: 'project' },
  { text: 'He is some way from the finished article.', from: 'raw', to: 'project' },
  { text: 'Everything about him is still in front of him.', from: 'raw', to: 'project' },
  { text: 'Right now he is an athlete playing baseball.', from: 'raw', to: 'project' },
  { text: 'Whoever takes him is taking a project.', from: 'raw', to: 'project' },
  { text: 'He would need time before he helped anybody.', from: 'raw', to: 'project' },
];

/** The lines that stay honest about a recruit of this grade. */
export const ceilingLinesFor = (grade: PotentialGrade): CeilingLine[] => {
  const g = GRADE_LADDER.indexOf(grade);
  return CEILING_LINES.filter(
    (l) => GRADE_LADDER.indexOf(l.from) <= g && g <= GRADE_LADDER.indexOf(l.to),
  );
};

/** The same, for how much of him is left to come. */
export const developmentLinesFor = (band: Rawness): DevelopmentLine[] => {
  const b = RAWNESS_LADDER.indexOf(band);
  return DEVELOPMENT_LINES.filter(
    (l) => RAWNESS_LADDER.indexOf(l.from) <= b && b <= RAWNESS_LADDER.indexOf(l.to),
  );
};

export interface ScoutingHints {
  ceiling: CeilingLine;
  development: DevelopmentLine;
}

/**
 * The two things anybody will say about him, fixed for the life of the recruit.
 *
 * Hashed out of his id, so they are the same on every render, after a reload,
 * and in week three as in week one. Drawing them at render time instead would
 * reshuffle the prose every time React looked at the row, which reads as the
 * screen being broken rather than as uncertainty.
 *
 * They do not depend on the coach's skill either. Skill buys a narrower band,
 * not different gossip, and a report whose *words* changed when you spent a
 * coach point would make the two levers impossible to tell apart.
 */
export function hintsFor(prospect: Prospect): ScoutingHints {
  const ceilings = ceilingLinesFor(potentialGrade(prospect.player.potential));
  const developments = developmentLinesFor(rawnessOf(prospect.player));
  return {
    ceiling: pickLine(ceilings, prospect.id, SALT.ceilingHint),
    development: pickLine(developments, prospect.id, SALT.developmentHint),
  };
}

function pickLine<T>(pool: readonly T[], id: string, salt: number): T {
  const i = Math.min(pool.length - 1, Math.floor(scoutNoise(id, salt) * pool.length));
  return pool[i] as T;
}

// ---------------------------------------------------------------------------
// What a program is selling
// ---------------------------------------------------------------------------

/**
 * A program, reduced to the five things recruits actually weigh.
 *
 * Every field is on a 0 to 1 scale so the fit calculation is a plain weighted
 * sum. Assembled by the caller from real season state — there is nothing here a
 * program could claim that is not true of it.
 */
export interface Pitch {
  prestige: number;
  /**
   * The program's tier, on the same 1 to 5 scale recruits are rated on.
   *
   * Carried rather than derived, because it must be the *same* number the gate
   * uses on the player. `aiTargets` originally worked it out from prestige with
   * its own rounding, which disagreed with `prestigeStars` — so the computer
   * programs were gated at one tier and the human at another, and the AI could
   * chase recruits an identical human program was refused.
   */
  stars: number;
  /** The program's home state. A shared one is the pipeline. */
  state: string;
  /** How open the depth chart is at this recruit's position. Per recruit. */
  playingTime: (p: Prospect) => number;
  winning: number;
  region: Region;
  development: number;
}

/**
 * How well a program matches one recruit, from 0 to 1.
 *
 * A weighted sum, and that is the entire design: the weights are his, the scores
 * are yours, and neither alone decides anything. A blue blood scores near 1 with
 * a recruit who wants the name and barely half that with one who wants to play.
 */
export function fit(prospect: Prospect, pitch: Pitch): number {
  const w = prospect.priorities;
  // Three steps, not two. Home state is the pipeline and the real prize; the
  // same corner of the country still counts for something; anywhere else is a
  // plane ride. Collapsing the first two into one "region" made a Louisiana kid
  // treat a school in his own town exactly like one four states away.
  const proximity =
    pitch.state === prospect.state ? 1
    : pitch.region === prospect.hometown ? 0.55
    : 0.15;
  return (
    w.prestige * pitch.prestige
    + w.playingTime * pitch.playingTime(prospect)
    + w.winning * pitch.winning
    + w.proximity * proximity
    + w.development * pitch.development
  );
}

/**
 * Points a program banks on a recruit in one week.
 *
 * Two parts, matching the genre: a passive share that accrues simply for being a
 * good match and pursuing him, and whatever the staff spent pitching. Fit
 * multiplies the spent actions rather than being added to them, so effort at a
 * program the recruit has no interest in is close to wasted — which is what
 * makes a board of reaches a real mistake instead of a lottery ticket.
 */
export function weeklyPoints(
  prospect: Prospect, pitch: Pitch, actions: number, coachPrestige: number,
  recruitingSkill = 20,
): number {
  if (actions <= 0) return 0;
  const f = fit(prospect, pitch);
  // A coach with a name of his own drags recruits above his program's weight.
  const coach = 1 + Math.max(-0.2, Math.min(0.45, (coachPrestige - 45) / 110));
  // And one who has trained at the phones gets more out of each hour spent.
  // Neutral at the starting skill of 20, worth about twenty percent at 99 —
  // roughly half the prestige lever above, on the effort half only, so the
  // skill rewards working the board rather than replacing it.
  const skill = 1 + (recruitingSkill - 20) / 400;
  const passive = f * 2.2;
  const pitched = actions * f * coach * skill * 2.6;
  return passive + pitched;
}

// ---------------------------------------------------------------------------
// The other ninety five programs
// ---------------------------------------------------------------------------

/**
 * What the AI chases, and how hard.
 *
 * The board is built in **tiers relative to the program's own standing** — a
 * reach or two, a core at its level, and safe targets below it. That structure
 * is what stops the league from functioning as one enormous queue.
 *
 * The first version ranked the whole class by rating times fit and took the top
 * eight. Every program's list came out looking like every other program's, so
 * all ninety six chased the same players: **only 79 recruits out of 480 were
 * pursued by anybody at all**, the average team signed 1.2 players against a
 * need of seven, and the rest of every roster arrived as walk-ons. Recruiting
 * existed and decided nothing.
 *
 * Targets somebody else has clearly locked up are dropped — programs do not keep
 * spending on a recruit who has stopped listening.
 *
 * That check reads a **snapshot** taken at the start of the week, never the live
 * totals. Reading live totals made the result depend on the order teams were
 * looped in: every program banked points as it went, so each later program saw
 * the earlier ones' spending and judged those recruits already gone. The four
 * highest prestige programs in the league ran last and signed **nobody at all**,
 * every year, while everyone ahead of them signed a full class.
 */
export function aiTargets(
  team: number, pitch: Pitch, coachPrestige: number,
  prospects: readonly Prospect[], need: number, rng: Rng,
  atWeekStart: Record<string, number> = {},
  spentOnTheDraft = 0,
): { prospect: Prospect; actions: number }[] {
  void coachPrestige;

  const tier = pitch.stars;

  const available = prospects.filter((p) => {
    if (p.signedBy !== null) return false;
    if (!canPursue(p, tier)) return false;
    const best = atWeekStart[p.id] ?? 0;
    if (best <= 0) return true;
    const mine = p.points[team] ?? 0;
    // Somebody else was well clear coming into this week. Spend elsewhere.
    //
    // Cutting at 40% rather than 60% matters more than it looks: a program that
    // keeps throwing actions at a recruit it is losing signs nobody at all with
    // them. Letting go earlier is what stopped classes ranging from one player
    // to twelve.
    return mine >= best || (best - mine) / best < 0.4;
  });

  // Always work a full board. A program short of targets is a program handing
  // roster spots to walk-ons.
  const wants = Math.max(4, Math.min(BOARD_SLOTS, Math.max(need, BOARD_SLOTS)));

  // A reach, a core, and some certainty.
  // Weighted up the board rather than down it.
  //
  // Reported from testing: "many of the recruits end up with nobody on him when
  // they are even high ranking". With only fifteen percent of every board
  // pointed at the tier above, the best players a program could legally chase
  // went unchased while everybody piled onto the safe ones — so the player
  // walked into an uncontested run at the top of the class.
  //
  // The top of the ladder gets its own plans. A five star program has no tier
  // above it, so the generic ladder pointed two of its slots at an empty band
  // — and with fourteen elite programs against fifty-odd five star prospects,
  // the class's best players still opened the window with nobody on them. The
  // programs that can chase the top of the class are the only coverage it has,
  // so their boards lean into it.
  //
  // Four star recruits are the band that needs this most, and it is a direct
  // consequence of the reach gate: two thirds of them will not hear from a three
  // star program at all, so the fourteen elite programs are the entire market
  // for them. With the old split those programs pointed more slots at five stars
  // than the country produces and the four stars underneath went unsigned, which
  // is the same "nobody is on him" failure one tier down.
  const plan: { stars: number; share: number }[] =
    tier >= 5 ? [
      { stars: 5, share: 0.50 },
      { stars: 4, share: 0.38 },
      { stars: 3, share: 0.12 },
    ] : tier === 4 ? [
      { stars: 5, share: 0.35 },
      { stars: 4, share: 0.48 },
      { stars: 3, share: 0.17 },
    ] : [
      { stars: tier + 1, share: 0.30 },
      { stars: tier, share: 0.40 },
      { stars: tier - 1, share: 0.20 },
      { stars: tier - 2, share: 0.10 },
    ];

  const picks: Prospect[] = [];
  const taken = new Set<PlayerId>();

  for (const band of plan) {
    const room = Math.max(1, Math.round(wants * band.share));
    const pool = available
      .filter((p) => p.stars === band.stars && !taken.has(p.id))
      // Within a band, chase the ones who actually want what this program has —
      // and notice the ones nobody else has called.
      //
      // Without the second half every staff in the country ranked the band the
      // same way and piled onto the same names, which left blue chips sitting
      // with no offers at all. A recruiting staff that misses an uncontested
      // five star is not a staff.
      .map((p) => {
        const suitors = Object.values(p.points).filter((v) => v > 0).length;
        // Scaled by what he is: an unchased five star is a scandal a staff
        // drops everything for, an unchased one star is Tuesday. The flat
        // bonus pulled boards toward uncovered depth players as hard as
        // uncovered blue chips, which is backwards.
        const uncontested = suitors === 0 ? 1 + 0.18 * p.stars : 1;
        return { p, score: fit(p, pitch) * uncontested * (0.85 + rng() * 0.3) };
      })
      .sort((a, b) => b.score - a.score);

    for (const { p } of pool.slice(0, room)) { picks.push(p); taken.add(p.id); }
  }

  // Backfill from anywhere if the bands came up short, so a program never walks
  // away from a class it needs.
  if (picks.length < wants) {
    const rest = available
      .filter((p) => !taken.has(p.id))
      .map((p) => ({ p, score: p.stars * fit(p, pitch) }))
      .sort((a, b) => b.score - a.score);
    for (const { p } of rest.slice(0, wants - picks.length)) { picks.push(p); taken.add(p.id); }
  }

  if (picks.length === 0) return [];
  picks.length = Math.min(picks.length, wants);

  // Allocate the week's actions where they convert, not evenly down the board.
  //
  // Spreading twelve actions across eight targets by board position gave every
  // recruit about one and a half, which is too thin to build a lead anywhere: no
  // program separated from the pack, commitments landed late and effectively at
  // random, and class sizes ranged from one player to fourteen. Weighting by fit
  // — and by whether the program is already ahead — makes a program concentrate
  // on the recruits it is actually going to sign.
  const weights = picks.map((p) => {
    const points = Object.values(p.points);
    const best = points.length > 0 ? Math.max(...points) : 0;
    const mine = p.points[team] ?? 0;
    const ahead = best > 0 && mine >= best ? 1.35 : 1;
    return Math.max(0.05, fit(p, pitch)) * ahead;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // The same week the user gets, read off the same two numbers: what the
  // program's own prestige is worth, less whatever June already took out of it.
  //
  // This used to be a flat forty for all ninety five of them, which was
  // survivable only while the draft did not exist. Once keeping a player cost
  // recruiting money, a budget the draft could not touch was a budget the AI
  // could spend twice — so the retention mechanic could not be given to them
  // until the money it comes out of was real. It is the same call `boardBudget`
  // makes for the user, deliberately, because two formulas for one week is how
  // an asymmetry gets back in.
  const week = weeklyBudget(pitch.stars, spentOnTheDraft);

  const out: { prospect: Prospect; actions: number }[] = [];
  let left = week;
  picks.forEach((prospect, i) => {
    if (left <= 0) return;
    const want = Math.round((weights[i] as number) / totalWeight * week);
    const actions = Math.max(1, Math.min(MAX_PER_RECRUIT, Math.min(want, left)));
    left -= actions;
    out.push({ prospect, actions });
  });
  return out;
}

/**
 * Points banked before a recruit will commit before the deadline.
 *
 * Tied to the scale `weeklyPoints` actually produces, which the first value was
 * not: it was set at 26 when a week of genuine pursuit banks about six, so no
 * recruit could ever commit early and the window had no clock at all. A focused
 * push reaches this inside two weeks; a board spread thin does not.
 */
const COMMIT_POINTS = 7;

/**
 * What a recruit of this grade wants banked before he will commit.
 *
 * Flat across the board meant a five star cost exactly what a two star cost,
 * so a program that could legally chase the top of the class simply took it —
 * reported from testing: "I got the #1 recruit three times in a row plus other
 * high rankings without breaking a sweat." A five star now wants roughly three
 * times the courtship.
 *
 * That is still reachable inside one week by a program with a good pitch that
 * points everything at him, which is the intent: he is affordable, and the cost
 * is the four holes you did not fill while paying it. Measured over five
 * classes with everyone spending their whole budget greedily, a five star
 * program lands about six of the top twenty and a three star lands half of one.
 */
export const commitPointsFor = (stars: number): number =>
  COMMIT_POINTS * (1 + Math.max(0, stars - 2) * 0.55);

/** How far clear the leader must be before a recruit stops listening. */
const COMMIT_MARGIN = 0.35;

export interface Commitment {
  prospect: Prospect;
  team: number;
  /** Everyone who was chasing him, so the wire can say who got beaten. */
  contested: number[];
  /** How far clear the winner finished, as a share of the leader's points. */
  margin: number;
}

/**
 * Close out a week: some recruits make up their minds.
 *
 * Not all of them, and not at random. A recruit commits once somebody is clearly
 * ahead — the further clear the leader is, the likelier he stops listening — and
 * the last week forces everyone still undecided to sign with whoever leads.
 *
 * This is what makes the window a real clock. Chasing a five star into week
 * three costs you the honest targets who came off the board in week one, and
 * that trade is the whole decision the screen exists to present.
 */
export function closeWeek(
  recruits: RecruitClass, rng: Rng, finalWeek = false,
): Commitment[] {
  const commits: Commitment[] = [];

  // How full each class already is. A program with its scholarships spent stops
  // signing, and the recruit goes to whoever is next in line rather than to a
  // school with no room — which is what stops one blue blood hoovering up the
  // top thirty players in the country.
  const taken = new Map<number, number>();
  for (const p of recruits.prospects) {
    if (p.signedBy !== null) taken.set(p.signedBy, (taken.get(p.signedBy) ?? 0) + 1);
  }

  for (const prospect of recruits.prospects) {
    if (prospect.signedBy !== null) continue;

    const entries = Object.entries(prospect.points)
      .map(([team, points]) => ({ team: Number(team), points }))
      .filter((e) => e.points > 0)
      .sort((a, b) => b.points - a.points);

    // The best suitor who still has a scholarship to give.
    const inTheRunning = entries.filter(
      (e) => (taken.get(e.team) ?? 0) < SCHOLARSHIPS,
    );
    const leader = inTheRunning[0];
    if (!leader) continue;

    const second = inTheRunning[1]?.points ?? 0;
    const margin = (leader.points - second) / leader.points;

    // Early weeks: only a recruit who has genuinely made up his mind. A clear
    // leader and enough attention banked to mean something.
    if (!finalWeek) {
      // What it takes scales with what he is. A five star wants to be courted;
      // a two star wants to be wanted.
      const settled = margin > COMMIT_MARGIN
        && leader.points > commitPointsFor(prospect.stars);
      if (!settled || rng() > 0.45) continue;
    }

    // On the last week a recruit still signs with whoever leads — but a top
    // recruit nobody has really worked simply goes elsewhere rather than
    // falling into the lap of whoever put a token point on him.
    if (finalWeek && leader.points < commitPointsFor(prospect.stars) * 0.6) {
      continue;
    }

    prospect.signedBy = leader.team;
    prospect.committedWeek = recruits.week;
    taken.set(leader.team, (taken.get(leader.team) ?? 0) + 1);
    commits.push({
      prospect, team: leader.team, margin,
      contested: entries.map((e) => e.team),
    });
  }

  return commits;
}

/**
 * Who led each recruit coming into this week.
 *
 * Taken once, before any program spends, so every program judges the same board.
 * See the note on `aiTargets` for what reading the live totals instead cost.
 */
export function leadersAtWeekStart(recruits: RecruitClass): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of recruits.prospects) {
    const points = Object.values(p.points);
    out[p.id] = points.length > 0 ? Math.max(...points) : 0;
  }
  return out;
}

/** Clear the per-week action spend. Points banked already are permanent. */
export function resetWeeklySpend(recruits: RecruitClass): void {
  for (const p of recruits.prospects) p.spent = {};
}
