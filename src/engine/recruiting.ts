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

import { makeHitter, makePitcher } from './players.js';
import { overallOf } from './ratings.js';
import type { Player, PlayerId, Position, Rng } from './types.js';
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
 */
export type Priority = 'prestige' | 'playingTime' | 'winning' | 'proximity' | 'development';

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

/** How much a recruit weighs each factor. Sums to 1. */
export type Priorities = Record<Priority, number>;

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
export const RECRUITING_BUDGET = 30;

/** The most that can go on one recruit in one week. Nobody signs on money alone. */
export const MAX_PER_RECRUIT = 12;

/** @deprecated Kept until the board screen stops naming it. */
export const BOARD_SLOTS = SCHOLARSHIPS;
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
export function starsFor(p: Player): number {
  // Stable per player, so the same recruit is rated the same by everyone.
  let h = 7919;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) | 0;
  const v = Math.sin(h * 0.0001) * 43758.5453;
  const miss = (v - Math.floor(v) - 0.5) * 26;

  // Weighted toward what he already does, because that is what a scout can
  // actually watch. The projection half carries the error.
  const score = overallOf(p) * 0.74 + (p.potential + miss) * 0.26;
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
    const roll = Math.pow(rng(), 1.7) * 2.1;
    raw[k] = Math.max(0.04, base[k] * (0.45 + roll));
    total += raw[k];
  }
  for (const k of PRIORITIES) raw[k] /= total;
  return raw;
}

/**
 * How far down the ladder this recruit will listen.
 *
 * The tolerance is his own: a kid who wants the ball as a freshman, or to stay
 * near his family, will hear out a program two or three tiers below him, while
 * one chasing the biggest name in the country will not come down at all. That is
 * where the upsets live, and they are a property of the recruit rather than a
 * global percentage — so the five star a small program can actually take is a
 * specific, identifiable player rather than a lottery ticket.
 */
function reachOf(stars: number, priorities: Priorities): number {
  const flexible = priorities.playingTime + priorities.proximity;
  // How far below his own tier a recruit will look. Wanting to play, or to
  // play near home, is what brings him down; wanting the name does not.
  let tolerance = 0.6 + flexible * 3.2;

  // The very best are the exception, and they have to be.
  //
  // Reported from testing: "I got the #1 recruit three times in a row without
  // breaking a sweat" — from a three star program. A blue chip who will
  // seriously consider anybody is not a blue chip, he is a free agent, and the
  // whole prestige ladder collapses if the top of the board is open at the
  // bottom of it. He still comes down for playing time, just not that far.
  if (stars >= 5) tolerance *= 0.90;
  else if (stars >= 4) tolerance *= 0.60;

  return Math.max(1, Math.min(5, Math.round(stars - tolerance)));
}

/** Whether a program of this tier may recruit him at all. */
export function canPursue(prospect: Prospect, programStars: number): boolean {
  return programStars >= prospect.minProgram;
}

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

    const stars = starsFor(player);
    const home = HOME_REGIONS[Math.floor(rng() * HOME_REGIONS.length)] as Region;
    const priorities = drawPriorities(stars, rng);
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

  // Ranked once, nationally, on what the services think — a blend of what he is
  // and what he might become, which is the same thing the stars are cut from.
  //
  // The rank matters because a star rating puts a hundred and twenty players in
  // one bucket, which is no help when you are choosing between two of them. "The
  // 38th best player in the country" is a different proposition from "another
  // four star". Assigned here rather than derived on screen so every program is
  // looking at the same board.
  prospects.sort((a, b) =>
    (overallOf(b.player) * 0.45 + b.player.potential * 0.55)
    - (overallOf(a.player) * 0.45 + a.player.potential * 0.55));
  prospects.forEach((p, i) => { p.rank = i + 1; });

  return { year, week: 0, prospects };
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
): number {
  if (actions <= 0) return 0;
  const f = fit(prospect, pitch);
  // A coach with a name of his own drags recruits above his program's weight.
  const coach = 1 + Math.max(-0.2, Math.min(0.45, (coachPrestige - 45) / 110));
  const passive = f * 2.2;
  const pitched = actions * f * coach * 2.6;
  return passive + pitched;
}

// ---------------------------------------------------------------------------
// The other sixty three programs
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
 * all sixty four chased the same players: **only 79 recruits out of 480 were
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
  const plan: { stars: number; share: number }[] = [
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
        const uncontested = suitors === 0 ? 1.45 : 1;
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

  const out: { prospect: Prospect; actions: number }[] = [];
  let left = ACTIONS_PER_WEEK;
  picks.forEach((prospect, i) => {
    if (left <= 0) return;
    const want = Math.round((weights[i] as number) / totalWeight * ACTIONS_PER_WEEK);
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
      const settled = margin > COMMIT_MARGIN && leader.points > COMMIT_POINTS;
      if (!settled || rng() > 0.45) continue;
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
