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

import { ageFor, makeHitter, makeTwoWay, makePitcher } from './players.js';
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
   * Written down here for the screen to print; the gate itself reads
   * `reachFloor(stars)` rather than this field, so a save made under the old
   * per-recruit ladder is judged by the same rule as a new one. See `canPursue`.
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
 * Recruiting budget per week, at a program with no prestige at all.
 *
 * Forty, spread across as many recruits as you like. The number matters less
 * than the ratio: it buys a decisive push on two or three players, or a thin one
 * on eight, and that trade is the whole screen.
 *
 * The floor rather than the rule. What a program actually works with is
 * `budgetFor(stars)`, and every one of the ninety six reads it — see
 * `weeklyBudget`, which both the board header and `aiTargets` go through.
 */
/*
  Forty became fifty-six when the portal arrived.

  This pool has always paid for two things -- the class, and keeping a man the
  draft took -- and stage 10 gave it a third: the portal, in both directions,
  since talking a man out of leaving costs from here too. Three claims on a
  budget fitted for two is not a harder decision, it is a thinner one, and it
  was reported in exactly those terms: too little for too much.

  Forty percent, which is roughly what the third claim is worth. It is a
  league-wide change so it moves what everybody signs, and the carousel watches
  the two numbers that would show it: how often a board's ask is cleared, and
  where prestige settles.
*/
export const RECRUITING_BUDGET = 56;

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
  /*
    How wrong the services are allowed to be.

    Reported after thirty seasons: "recruits are not really dynamic — a five
    star is always good and a low star never is." They were, because this
    error was worth ±13 on the projection half only, which is ±3.4 on a score
    whose star bands are eight points wide: the rating was a readout of
    current ability with a rounding error on it. At ±26 a genuine ceiling can
    hide two bands below where it belongs and a polished eighteen-year-old
    with nothing left can be sold a band above — which is what a bust and a
    steal actually are. The error is per-man and stable, so every program in
    the country is fooled by the same recruit in the same direction.
  */
  const miss = (v - Math.floor(v) - 0.5) * 52;

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
 * One star up, and no further.
 *
 * His words, and the whole rule: *"a 3 star school can only shoot for 4 stars
 * and under, a 2 star can shoot for a 3 star and under and so on, 4 and 5 star
 * schools can go for anyone they like."* So the floor under a recruit is one
 * below his own grade, and since nothing is rated above five, a four star
 * program clears every floor there is and the top two tiers see the whole
 * board without a special case.
 *
 * This **replaces** the per-recruit reach ladder rather than sitting on top of
 * it. That one gave every prospect a floor of his own, drawn off how badly he
 * wanted to play or to stay near home, and it was measured and tuned against
 * four hundred thousand draws — but two gates that disagree is a worse thing
 * than either of them alone, and they did disagree in both directions: the
 * ladder let a flexible five star hear out a three star program that this rule
 * refuses, and it let a rigid four star refuse a three star program that this
 * rule admits. Asked which of the two should decide, the answer has to be the
 * one a coach can read off the screen. A ladder you can see is a ladder you
 * can climb deliberately; a hidden per-recruit roll is one you can only find
 * out about by tapping.
 *
 * What is lost with it is the identifiable outlier — the one four star in the
 * class who would have come down two tiers for playing time. What replaces him
 * is the pipeline, below, which is a better version of the same idea: still a
 * specific, nameable set of players a small program can reach above its
 * weight, but one the coach knows about before he spends a week on it.
 */
export const reachFloor = (stars: number): number =>
  Math.max(1, Math.min(4, stars - 1));

/**
 * What a shared home state is worth: one more star of reach.
 *
 * *"if a school for example is 3 star but there are 5 stars in their pipeline
 * they can shoot for them as well, but only if they are in the pipeline, and it
 * only goes up one star."* The pipeline is the concept `fit` already scores
 * proximity on — a program's own state, not its region. A region is four states
 * and an eighth of the country, which would make the exception the rule; a
 * state is twenty recruits and one or two blue chips in a good year, which is
 * exactly the "there are 5 stars in their pipeline" he described.
 */
export const PIPELINE_REACH_BONUS = 1;

/**
 * Whether a program of this tier may recruit him at all.
 *
 * Reads `reachFloor(stars)` rather than the prospect's own `minProgram`, and
 * that is deliberate: a dynasty saved under the old ladder carries floors drawn
 * from a rule that no longer exists, and a gate that honoured them would run
 * two different games depending on when the save was made.
 */
export function canPursue(
  prospect: Prospect, programStars: number, inPipeline = false,
): boolean {
  const reach = programStars + (inPipeline ? PIPELINE_REACH_BONUS : 0);
  return reach >= reachFloor(prospect.stars);
}

/** Whether this recruit is in that program's pipeline: the same home state. */
export const inPipeline = (prospect: Prospect, programState: string): boolean =>
  prospect.state === programState;

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

  /*
    The two-way men — stage 16, quota straight from the door: "at most three
    per recruit list a year." Converted off SP slots at a rate that averages
    a couple per national class and never exceeds three, so most years the
    country has one or two of them and some years none at all — rare the way
    they are in life. They arrive two-way rather than being made.
  */
  let twoWayLeft = 3;

  for (let i = 0; i < size; i++) {
    const roll = rng();
    const quality =
      roll > 0.97 ? 66 + rng() * 10
      : roll > 0.88 ? 58 + rng() * 8
      : roll > 0.65 ? 50 + rng() * 8
      : roll > 0.30 ? 42 + rng() * 8
      : 34 + rng() * 8;

    const slot = CLASS_SHAPE[i % CLASS_SHAPE.length] as Position | 'SP' | 'RP';
    const goesBothWays = slot === 'SP' && twoWayLeft > 0 && rng() < 0.015;
    if (goesBothWays) twoWayLeft -= 1;
    // Built AS a freshman, so his ceiling is a freshman's. See HitterOpts.
    const player: Player = goesBothWays
      ? makeTwoWay(rng, quality)
      : slot === 'SP' || slot === 'RP'
        ? makePitcher(rng, quality, { role: slot, classYear: 'FR' })
        : makeHitter(rng, quality, { pos: slot, classYear: 'FR' });
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
      minProgram: reachFloor(stars),
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

  ensureWonderGuy({ year, week: 0, prospects });
  ensureHoodHans({ year, week: 0, prospects });

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
 * A line a scout will say out loud — and, since the sorting session, the ONE
 * letter it is ever said about.
 *
 * This is a deliberate reversal, decided by the reporter and worth recording
 * because the old design argued the opposite in this very spot. Lines used to
 * span a RANGE of grades so the words could never be decoded, only weighed —
 * deliberate fog. The reporter wants the opposite, and the reasoning is good:
 * one pool per potential letter means a player who pays attention CAN learn
 * the code and read a class properly. That is a real skill the game did not
 * have anywhere, and it is the reward for paying attention. The protection is
 * volume — fifteen or more lines a grade, so learning the code takes seasons
 * rather than an afternoon — and register: adjacent pools shade into each
 * other in tone, so a line you have not learned tells you roughly where you
 * are without telling you exactly.
 *
 * The development lines below keep their fuzzy bands, also by decision: how
 * raw a man is is the second axis, and making both axes decodable would leave
 * nothing to scout.
 */
export interface CeilingLine {
  readonly text: string;
  /** The one letter this line is ever said about. */
  readonly grade: PotentialGrade;
}

const POOL = (grade: PotentialGrade, texts: readonly string[]): CeilingLine[] =>
  texts.map((text) => ({ text, grade }));

/**
 * Everything the area men come back saying, one pool per letter, quietest
 * grade first. S+ exists for the store's man alone — no recruit generates
 * there — and reads accordingly.
 */
export const CEILING_LINES: readonly CeilingLine[] = [
  ...POOL('D', [
  "He is close to the player he is going to be.",
  "Nobody came back from seeing him with a story to tell.",
  "What you see in the first inning is what you get in the ninth.",
  "The second look told us what the first one did.",
  "Steady is the word every report on him ends with.",
  "He knows his own game better than most seniors know theirs.",
  "Four honest years in him, whoever takes them.",
  "The rankings and the tape agree on him, which is rare enough.",
  "He plays within himself. Always has.",
  "You know exactly what you are getting, and so does he.",
  "His coach calls him dependable and means it as high praise.",
  "No surprises in him, good or bad.",
  "He makes the plays he is supposed to make.",
  "The kind of kid who makes a bus trip shorter.",
  "Somebody will be glad to have him around the place.",
  "He was the same player in April as in June.",
  "The clipboard already suits him.",
  ]),
  ...POOL('C', [
  "He will play, somewhere, for somebody, most weekends.",
  "Our area man likes him more than the rankings do.",
  "There is no one loud thing about him. He just plays.",
  "He does one thing well enough to build an argument on.",
  "He would help most rosters and headline none of them.",
  "Polished for his age. Whether there is any more is the question.",
  "You can find a spot for him without squinting.",
  "The staff liked him fine, and nobody fought about it.",
  "He wins the drills. Games are closer.",
  "A good camp got him on this list. A good spring keeps him there.",
  "He has been coached hard, and it shows in the right ways.",
  "Every league needs fifty of him.",
  "The word is useful, and it is not an insult.",
  "He gets more from his tools than the tools deserve.",
  "Nobody doubts he plays. The argument is where.",
  "His floor is what sells him.",
  "A program guy, the way scouts mean it kindly.",
  ]),
  ...POOL('B', [
  "Scouts keep finding reasons to go back and see him again.",
  "Two programs offered him after one look.",
  "The staff argued about him for an hour and got nowhere.",
  "He does not look like a high school player out there.",
  "The upside is the reason he is on this list at all.",
  "Our cross-checker moved a trip to go and see him.",
  "He has been the best player on every field he has been on.",
  "People who saw him in the summer have not stopped talking about it.",
  "If it ever comes together we will be glad we were early.",
  "He would have to develop, but the frame is there.",
  "One tool plays right now. The rest are on their way.",
  "You leave his games having underlined something.",
  "The area man used the word starter and did not hedge it.",
  "Twice this spring he did something you could not teach.",
  "His bad days still look like somebody's good ones.",
  "A name other coaches ask about, carefully.",
  "He passes the eye test getting off the bus.",
  ]),
  ...POOL('A', [
  "There are people who believe he is the best in the state.",
  "Every program in the country has been through his gym.",
  "Nobody on this staff wants to be the one who passed.",
  "People stop what they are doing to watch him.",
  "Three head coaches have already been to his house.",
  "The area men have run out of comparisons.",
  "He has a chance to be something, and the room knows it.",
  "A rival staffer called him the one that got away. In May.",
  "The park goes quiet when it is his turn.",
  "You write the report in the first inning and spend the rest checking it.",
  "Grown men rearrange their weekends to watch a seventeen-year-old.",
  "The question is not whether he plays. It is how soon.",
  "His name came up in three other recruits' interviews.",
  "The tape undersells him, and the tape is good.",
  "Somebody is going to build a class around him.",
  "He is circled on every board we have seen.",
  "The state tournament felt like his audition, and he knew it.",
  ]),
  ...POOL('A+', [
  "There is talk he will be drafted out of high school.",
  "The pro men outnumber the college men at his games now.",
  "His coach has stopped returning calls about him.",
  "The argument is not the state anymore. It is the country.",
  "An agent has already been polite to his mother.",
  "We stopped writing reports and started writing contingencies.",
  "Every board in the country has him. The argument is the round.",
  "You plan your visit around everyone else who will be there.",
  "He made a jaded room lean forward.",
  "Losing him to the draft is the risk everybody prices in.",
  "His games get moved to bigger parks.",
  "The fence behind the plate is all radar guns and clipboards.",
  "He is the reason the showcase sold out.",
  "Nobody wants to be second into his living room.",
  "The last one this loud out of that league is on television now.",
  ]),
  ...POOL('S', [
  "The word generational got used, and nobody laughed.",
  "He is the best player anybody in that room has scouted.",
  "Whole staffs fly out to see him. Not scouts. Staffs.",
  "His name is shorthand now. You say it and the room nods.",
  "The plan is not to develop him. The plan is to deserve him.",
  "A network truck found his high school in March.",
  "The country knows him. The question is who gets him.",
  "You do not compare anybody to him. It goes the other way.",
  "His junior year broke a record that had a statue attached.",
  "Somebody offered his little brother, just to be near it.",
  "He changes what a program is allowed to want.",
  "The first time you see him, you check the age twice.",
  "Every program has a plan for him. Most of them are prayers.",
  "The line for his autograph outlasted the game.",
  "His hat decision will have its own press conference.",
  "You will tell people you saw him at seventeen.",
  ]),
  ...POOL('S+', [
  "There is no report. Reports are for players like other players.",
  "The oldest scout in the room said once a lifetime, and left.",
  "Nobody argues about him. There is nothing to argue.",
  "The tape looks sped up. It is not.",
  "His high school games have a waiting list.",
  "You measure the others against him and apologise.",
  "The word is not prospect. Nobody has found the word yet.",
  "Somebody asked what he cannot do, and the room went quiet.",
  "The rankings have him first, and it reads like an understatement.",
  "Whatever the ceiling is, nobody has seen him touch it.",
  ]),
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

/** His letter's own pool — the whole of what may be said about him. */
export const ceilingLinesFor = (grade: PotentialGrade): CeilingLine[] =>
  CEILING_LINES.filter((l) => l.grade === grade);

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
 * What the home town is worth beyond what the recruit says it is worth.
 *
 * Reported: *"during recruitment, we have to give a bit of a boost to players in
 * the pipeline, I was just running through some seasons and it was rough to get
 * a good player"*. The pipeline bought reach and nothing else — the right to
 * *call* a recruit a tier above the program, with no help at all in keeping him
 * — so a small program could now see the best player in its own back yard and
 * still lose him to everybody else, which is arguably worse than never having
 * seen him.
 *
 * It is deliberately outside the weighted sum rather than a bigger `proximity`
 * score, because it is not the thing the recruit was asked about. The five
 * weights price how much he wants to be near home; this prices the rest of it —
 * the staff that has watched him since he was fourteen, the family in the
 * stands, the summer team the pitching coach runs. A kid who does not care about
 * distance still knows these people.
 *
 * **Scaled by how small the program is**, and that is the load-bearing half. A
 * blue blood recruits its own state on the strength of being a blue blood and
 * measured, wins those recruits at the same rate with or without this; handing
 * it a local bonus as well would just move the whole board up and change
 * nothing. What a one star program has to sell *is* the neighbourhood, so it
 * gets the whole of it and the five star gets none.
 *
 * **Squared rather than straight**, which is the part measurement decided. A
 * linear ramp lifted every tier below the top at once, so the small program's
 * *relative* position — the only thing that decides a contested recruit — barely
 * moved: it took a four star kid off a blue blood 63% of the time in his own
 * state, while a four star *program* went from keeping 9.1% of its local board
 * to 12.5%, which is a general inflation rather than an edge for anybody. The
 * square hands the same lift to the bottom of the ladder (22.6% → 29.5%) and
 * almost none to the top of it (9.1% → 9.6%).
 */
export const PIPELINE_EDGE = 0.25;
const pipelineEdge = (stars: number): number =>
  PIPELINE_EDGE * Math.max(0, Math.min(1, (5 - stars) / 4)) ** 2;

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
  const base =
    w.prestige * pitch.prestige
    + w.playingTime * pitch.playingTime(prospect)
    + w.winning * pitch.winning
    + w.proximity * proximity
    + w.development * pitch.development;
  if (pitch.state !== prospect.state) return base;
  // Capped at 1 because that is what a fit is, and because the programs whose
  // scores are already up against the ceiling are the ones this is not for.
  return Math.min(1, base * (1 + pipelineEdge(pitch.stars)));
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
  // NaN in a saved career must read as an unknown quantity, not spread.
  const cp = Number.isFinite(coachPrestige) ? coachPrestige : 40;
  const coach = 1 + Math.max(-0.2, Math.min(0.45, (cp - 45) / 110));
  // And one who has trained at the phones gets more out of each hour spent.
  // Neutral at the starting skill of 20, worth about twenty percent at 99 —
  // roughly half the prestige lever above, on the effort half only, so the
  // skill rewards working the board rather than replacing it.
  const skill = 1 + (recruitingSkill - 20) / 400;
  /*
    The passive half, earned rather than granted.

    This paid `f * 2.2` the moment a single point touched a recruit, and
    nothing capped how many recruits you could touch. Measured in audit: a
    56-point week spread one-per-man across 56 recruits returned roughly
    269f of interest against 148f for one concentrated push — so the
    dominant strategy was to bid the minimum on everybody, and the board
    even shipped a NOBODY IS ON HIM filter to find them. Ramped over the
    first three points, the spread costs what it should and a real push
    still wins.
  */
  const passive = f * 2.2 * Math.min(1, actions / 3);
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
    // The pipeline is the AI's too. A gate the ninety five could not use would
    // hand the user a private exception, and the one thing this gate has to be
    // is the same rule on both sides of the board.
    if (!canPursue(p, tier, inPipeline(p, pitch.state))) return false;
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
  // Four star recruits are the band that needs this most. Under the reach gate
  // they were nearly the elite programs' private market and went unsigned when
  // those boards pointed more slots at five stars than the country produces —
  // the same "nobody is on him" failure one tier down. The one-star-up rule has
  // since opened them to every three star program in the league, so the band is
  // no longer starved; the split stays because the failure it fixed was about
  // where an elite board points, and that has not changed.
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
      // Two grades up is the pipeline band and nothing else — `available` has
      // already thrown out everybody this program has no business calling, so
      // whoever is left in here is a home state kid the gate let through. One
      // slot, because that is how many of them a small program tends to have,
      // and it comes out of the safe end of the board rather than the middle.
      { stars: tier + 2, share: 0.08 },
      { stars: tier + 1, share: 0.28 },
      { stars: tier, share: 0.38 },
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

/*
  TESTING ONLY — remove with the PSC godsquad before v1.0.

  Hans Hood, the wonder guy: a 20-overall third baseman with an S ceiling,
  in every class, every year, as a one-star nobody any program can chase.
  Asked for by the reporter to test progression — the plan is a class of
  hidden greats who start at one or two stars and grow into the picture.
  Attributes are ASSIGNED onto a cloned prospect, so no draw is consumed.
  Exported and also called on save-load, because the reporter went looking
  for him in a class that had been generated before he existed.
*/
/**
 * TESTING ONLY — the two-way fixture, asked for by name: "add one two-way
 * to each class that I would recognize for testing, as Hood Hans." The
 * wonder guy's mirror image in every sense: Hans Hood is nothing now with
 * everything to come; Hood Hans is the finished article twice over — a real
 * bat AND a real arm, ready the day he steps on campus — so every piece of
 * the two-way machinery (both jobs on signing, the P/DH card, the crossing
 * fatigue, the split leaderboards, the TWO-WAY tag) can be tested on demand
 * instead of waiting for the honest quota to deal one. One star and no
 * reach floor so any program can sign him; additive, outside the class's
 * own at-most-three; gated out of the test runner exactly as Hans is.
 */
export function ensureHoodHans(cls: RecruitClass): void {
  if (typeof process !== "undefined" && process.env?.["VITEST"]) return;
  const prospects = cls.prospects;
  const id = ("p1hood" + cls.year) as unknown as PlayerId;
  if (prospects.some((p) => p.id === id)) return;
  const donor = prospects.find((p) => p.player.type === "hitter");
  if (!donor) return;
  const copy = JSON.parse(JSON.stringify(donor)) as Prospect;
  const h = copy.player as unknown as Record<string, unknown>;
  h.id = id;
  h.name = "Hood Hans";
  h.pos = "DH";
  h.classYear = "FR";
  h.age = 18;
  // The bat.
  h.contact = 74; h.power = 76; h.eye = 70; h.speed = 62;
  h.range = 48; h.hands = 55; h.arm = 72; h.armAccuracy = 60;
  h.blocking = 30; h.bunt = 45; h.steal = 40;
  // The arm, flattened on exactly as makeTwoWay lays it down.
  h.twoWay = true;
  h.role = "SP";
  h.sidearm = false;
  h.armPlatoon = 0.03;
  h.stuff = 72; h.movement = 68; h.control = 70; h.stamina = 64;
  h.groundBall = 52; h.holdRunners = 60;
  h.velocity = 94;
  h.potential = 84;
  prospects.push({
    ...copy,
    id,
    stars: 1,
    minProgram: reachFloor(1),
    rank: prospects.length + 1,
    points: {}, spent: {}, signedBy: null, committedWeek: null,
  });
}

export function ensureWonderGuy(cls: RecruitClass): void {
  if (typeof process !== "undefined" && process.env?.["VITEST"]) return;
  const prospects = cls.prospects;
  const id = ("p1hans" + cls.year) as unknown as PlayerId;
  if (prospects.some((p) => p.id === id)) return;
  const donor = prospects.find((p) => p.player.type === "hitter");
  if (!donor) return;
  const copy = JSON.parse(JSON.stringify(donor)) as Prospect;
  const h = copy.player as unknown as Record<string, unknown>;
  h.id = id;
  h.name = "Hans Hood";
  h.pos = "3B";
  h.classYear = "FR";
  h.age = 18;
  for (const k of ["contact", "power", "eye", "speed", "range", "hands", "arm", "armAccuracy"]) {
    if (typeof h[k] === "number") h[k] = 20;
  }
  h.potential = 99;
  prospects.push({
    ...copy,
    id,
    stars: 1,
    minProgram: reachFloor(1),
    rank: prospects.length + 1,
    points: {}, spent: {}, signedBy: null, committedWeek: null,
  });
}
