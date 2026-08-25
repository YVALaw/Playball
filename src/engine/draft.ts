// draft.ts
// Professional baseball comes for your players, and what you can do about it.
//
// Three separate questions live here and they are deliberately kept apart,
// because each is answered by somebody different.
//
// **May a club take him?** The real rule, and the one the game now uses: a
// four-year college player is eligible after three years completed, or at age
// twenty one, whichever comes first. That is `draftEligible`, and it is the only
// thing in the engine that reads a player's age.
//
// **How highly?** By what the clubs can actually see — what he did last spring
// and what he can do now. Never by his ceiling. A scouting director does not
// have `potential` on his sheet; if he did, nobody would ever take a bust in the
// first round, and taking a bust in the first round is the most realistic thing
// a draft does.
//
// **Can you talk him out of it?** That is the recruiting pitch again, on a man
// you already have. He carries the same five priorities he was recruited on,
// `fit` multiplied a recruiting spend by them, and the same idea multiplies a
// retention offer here — so a coach who reads his player keeps him for a
// fraction of what a coach guessing pays. The money is recruiting budget,
// spent from the pool the board opens with in about ninety seconds' time.

import { overallOf } from './ratings.js';
import { prioritiesFor, starsFor, PRIORITIES } from './recruiting.js';
import { scoutNoise } from './scouting.js';
import {
  era, inningsPitched, onBase, slugging,
  type SeasonState,
} from './season.js';
import { CLASS_ORDER } from './types.js';
import type { ClassYear, Player, Priorities, Priority } from './types.js';

/** Clamp to 0..1, which almost everything below is expressed on. */
const unit = (v: number): number => Math.max(0, Math.min(1, v));

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/**
 * The age at which a college player comes into range whatever year he is in.
 *
 * The real rule is "twenty one within forty five days of the draft", which for
 * a game whose calendar is a season and an offseason is simply twenty one at
 * the moment the draft is held.
 */
export const DRAFT_AGE = 21;

/** Years behind him once the season just played is in the books. */
export const yearsCompleted = (cls: ClassYear): number => CLASS_ORDER[cls] + 1;

/**
 * Three years completed, or twenty one, whichever comes first.
 *
 * Read at the moment the draft is held — after the calendar has turned him a
 * year older, which is why `departAndDevelop` ages everybody before it asks.
 *
 * The shape this produces is the point of it. A man who arrived at eighteen is
 * safe as a freshman and a sophomore and comes into range after his junior
 * year, so the cliff arrives in year three and a coach can plan around it. A man
 * who arrived at nineteen or twenty does not get that grace: he is twenty one a
 * year or two early, and that is the whole exception. It used to be imitated
 * with a talent bar — a sophomore was drafted only above 70 overall — which had
 * the right feel and the wrong cause, and could not explain why one sophomore
 * was exposed and an identical one was not.
 */
export const draftEligible = (p: { classYear: ClassYear; age: number }): boolean =>
  yearsCompleted(p.classYear) >= 3 || p.age >= DRAFT_AGE;

/**
 * How much of his eligibility a man still holds when the draft finds him.
 *
 * Nought for a senior, one for a junior, and two or three for the underclassmen
 * the age clause exposes. It is the leverage he has in the room: a sophomore who
 * can go back to school for two more years is a man a club has to *pay*, so a
 * club only spends a pick on him when it means to. That is why an age-eligible
 * underclassman is drafted far less often than a junior of the same ability,
 * and it replaces the old flat 35% and 15% multipliers with the reason they
 * existed.
 */
export const yearsOfLeverage = (cls: ClassYear): number => 3 - CLASS_ORDER[cls];

// ---------------------------------------------------------------------------
// What the clubs can see
// ---------------------------------------------------------------------------

/**
 * The league's own production, so a season can be graded against the season it
 * was played in.
 *
 * Standardised rather than compared with fixed numbers, because the run
 * environment is a calibrated thing that may move again — and because a .900
 * OPS means something different in a league hitting .700 than in one hitting
 * .800. This is the same instinct the fielding line already follows, where
 * plays above average are measured against the fielder's own team rather than
 * against 50.
 */
export interface DraftContext {
  opsMean: number; opsSd: number;
  eraMean: number; eraSd: number;
  kMean: number; kSd: number;
}

/** Enough of a season to be worth grading. Below these a line says nothing. */
const RATED_AB = 60;
const RATED_IP = 20;

const spread = (xs: number[], fallbackMean: number): readonly [number, number] => {
  if (xs.length < 2) return [fallbackMean, 1];
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return [mean, sd > 0.001 ? sd : 1];
};

export function draftContext(season: SeasonState): DraftContext {
  const ops: number[] = [];
  const eras: number[] = [];
  const ks: number[] = [];
  for (const line of season.batting.values()) {
    if (line.ab >= RATED_AB) ops.push(onBase(line) + slugging(line));
  }
  for (const line of season.pitching.values()) {
    const ip = inningsPitched(line);
    if (ip >= RATED_IP) { eras.push(era(line)); ks.push((line.k * 9) / ip); }
  }
  const [opsMean, opsSd] = spread(ops, 0.75);
  const [eraMean, eraSd] = spread(eras, 5.2);
  const [kMean, kSd] = spread(ks, 7.0);
  return { opsMean, opsSd, eraMean, eraSd, kMean, kSd };
}

/**
 * What he did last spring, on the same 0 to 100 scale as a rating.
 *
 * Shrunk toward the league by how little of it there is: a man with sixty plate
 * appearances gets a third of the credit a regular gets for the same rate,
 * which is the honest version of "he did not play enough for us to know". A man
 * who did not play at all comes out at exactly average, so he is graded on his
 * ability alone rather than punished for sitting.
 *
 * Strikeouts are weighted above earned runs for an arm because that is what
 * clubs actually chase — a run average is a team's as much as a pitcher's, and
 * the men in the stands with radar guns are counting swings and misses.
 */
export function seasonForm(p: Player, season: SeasonState, ctx: DraftContext): number {
  if (p.type === 'hitter') {
    const line = season.batting.get(p.id);
    if (!line || line.ab === 0) return 50;
    const pa = line.ab + line.bb + line.hbp;
    const z = (onBase(line) + slugging(line) - ctx.opsMean) / ctx.opsSd;
    return 50 + 13 * z * (pa / (pa + 110));
  }
  const line = season.pitching.get(p.id);
  if (!line || line.outs === 0) return 50;
  const ip = inningsPitched(line);
  const zEra = -(era(line) - ctx.eraMean) / ctx.eraSd;
  const zK = ((line.k * 9) / ip - ctx.kMean) / ctx.kSd;
  return 50 + 13 * (0.45 * zEra + 0.55 * zK) * (ip / (ip + 32));
}

/** One club's private read on a player. Two clubs do not agree. */
const OPINION_SALT = 4409;

/**
 * What professional baseball thinks he is worth.
 *
 * Three visible things and nothing else. **What he can do now**, which is what
 * a scout watches. **What he did**, which is what the box scores say. **How
 * old he is**, because a club buys the years it gets and a twenty-year-old
 * junior is a longer bet than a twenty-three-year-old senior with the same
 * line. And then a hash of disagreement on top, because thirty organisations
 * looking at one player produce thirty different numbers.
 *
 * `potential` is deliberately, load-bearingly absent. It is the one thing
 * nobody outside the programme can know, and reading it here would make the
 * clubs omniscient — every first rounder would come good, no club would ever
 * be wrong, and the coach's private knowledge of who is going to grow would
 * stop being worth anything. A club taking a finished 78 over a raw 68 who will
 * be 85 in two years is not a bug; it is the whole reason the coach knows
 * something the draft does not.
 */
export function visibleValue(p: Player, season: SeasonState, ctx: DraftContext): number {
  const form = seasonForm(p, season, ctx);
  // Clubs pay for youth, and never more than three points of it either way.
  const youth = Math.max(-3, Math.min(3, -(p.age - DRAFT_AGE) * 1.2));
  const disagreement = (scoutNoise(p.id, OPINION_SALT) - 0.5) * 7;
  return 0.60 * overallOf(p) + 0.40 * form + youth + disagreement;
}

// ---------------------------------------------------------------------------
// Where he goes
// ---------------------------------------------------------------------------

export const DRAFT_ROUNDS = 20;
export const PICKS_PER_ROUND = 30;

/** Twenty rounds of thirty, which is the draft this one is modelled on. */
const BOARD_PICKS = DRAFT_ROUNDS * PICKS_PER_ROUND;

/**
 * Where the middle of a national board sits, and how quickly it thins.
 *
 * Fitted against what the league actually sends up once it has settled: the
 * median man the draft takes grades out around 60, the ninetieth percentile
 * around 70, and the best player in the country in a good year around 80.
 *
 * The logistic is doing real work rather than smoothing. Our ninety-six
 * programs are not the draft — the draft is fed by high schools, junior
 * colleges and about three hundred four-year programs, and ours are a slice of
 * one of those three. So a man's round is not his rank among our men, it is
 * where he would stand on somebody else's six hundred pick board, and that is
 * why our names come out **sparse across the whole draft** rather than stacked
 * at the top of it. Dividing our fifty best into thirty-two-name rounds was the
 * old arithmetic and it was the wrong arithmetic: it said the league's fortieth
 * best college senior was a second round pick.
 */
const BOARD_MID = 61;
const BOARD_SPREAD = 6;

/**
 * The round a man of this value would go in.
 *
 * Value in, share of the board above him out, and the round is which
 * thirty-pick block that share lands in. Round one therefore needs a value
 * around 79, which about one drafted man in a hundred reaches — two or three in
 * the country in a year, and some years nobody. That rarity is the point: a
 * first rounder should be a thing a program remembers, and under the old
 * arithmetic every program had two.
 */
export function draftRound(value: number): number {
  const share = 1 / (1 + Math.exp((value - BOARD_MID) / BOARD_SPREAD));
  return Math.max(1, Math.min(
    DRAFT_ROUNDS, Math.ceil((share * BOARD_PICKS) / PICKS_PER_ROUND),
  ));
}

// ---------------------------------------------------------------------------
// Talking him out of it
// ---------------------------------------------------------------------------

/** The four cases a coach can make to a man who has just been drafted. */
export type KeepPitch = 'stock' | 'role' | 'ring' | 'word';

export const KEEP_PITCHES: readonly KeepPitch[] = ['stock', 'role', 'ring', 'word'];

export const KEEP_LABEL: Record<KeepPitch, string> = {
  stock: 'DRAFT STOCK',
  role: 'A ROLE',
  ring: 'A RING',
  word: 'MY WORD',
};

/** What you are actually saying to him. */
export const KEEP_CASE: Record<KeepPitch, string> = {
  stock: 'Come back for a year and go higher than this.',
  role: 'The job is yours in the spring. No competition for it.',
  ring: 'Stay and we win something before you leave.',
  word: 'Stay for me, and for this place. You have my word.',
};

/**
 * What each case rests on, said plainly, because the coach can go and look.
 *
 * The information is all on screens he already has — his depth chart, his
 * prestige, his own standing — so naming the source is not giving anything
 * away. It is telling him where to check before he promises something he cannot
 * deliver.
 */
export const KEEP_RESTS_ON: Record<KeepPitch, string> = {
  stock: 'Rests on how much of him is still to come, and on your TRAINING.',
  role: 'Rests on your depth chart at his spot. He can read it too.',
  ring: 'Rests on the program’s standing and on who is coming back.',
  word: 'Rests on your own name and how long you have sat in this chair.',
};

/**
 * Which of his five priorities each case actually speaks to.
 *
 * One case per priority, and the two nobody else wanted going together, so no
 * two cases compete for the same man. That is what makes choosing one a read
 * rather than a shrug: a man who wants the ball is reachable through exactly
 * one of these four, and the other three are money thrown at a subject he is
 * not interested in.
 *
 * Each row sums to 1, the weights on the player sum to 1, so the product below
 * is a plain weighted average and lands between 0 and 1 the way `fit` does.
 */
const SPEAKS_TO: Record<KeepPitch, Partial<Record<Priority, number>>> = {
  stock: { development: 1 },
  role: { playingTime: 1 },
  ring: { winning: 1 },
  // The two left over, and they belong together. A coach's word is his own
  // name — which is the prestige of the place as much as the program's — and it
  // is the argument for staying where you already are.
  word: { prestige: 0.5, proximity: 0.5 },
};

/**
 * How much of what he cares about this case is about.
 *
 * Exactly `fit`'s arithmetic: the weights are his, the case is yours, and the
 * product is how much of him you are actually talking to.
 */
export function pitchAffinity(kind: KeepPitch, weights: Priorities): number {
  const row = SPEAKS_TO[kind];
  let sum = 0;
  for (const k of PRIORITIES) sum += weights[k] * (row[k] ?? 0);
  return sum;
}

/** What he weighs, whether anybody ever recruited him or not. */
export const prioritiesOf = (p: Player): Priorities =>
  p.priorities ?? prioritiesFor(p.id, starsFor(p));

/**
 * Everything a case can honestly be built on, read off the program as it
 * stands.
 *
 * Assembled by the caller from real state, in the same spirit as `Pitch` in
 * pitch.ts: there is nothing in here a coach could claim that is not true of
 * him. A number invented for this screen would turn the whole negotiation into
 * flavour text with a multiplier attached.
 */
export interface KeepScene {
  /** The program's prestige, 0 to 1. */
  prestige: number;
  /** How strong what is coming back is, 0 to 1. */
  returning: number;
  /** The coach's own reputation, on its 0 to 100 scale. */
  coachPrestige: number;
  /** Seasons in this chair. */
  tenure: number;
  /** The coach's TRAINING skill, 20 to 99. */
  training: number;
  /** The best man at his spot who is still on the roster. 0 if nobody is. */
  blockedBy: number;
  /**
   * Where he was taken, which is part of the scene rather than of the man.
   *
   * Only the draft-stock case reads it, and it reads it because "come back and
   * go higher" is a claim about the board and not only about the player: there
   * is a great deal of room above a fifteenth rounder and almost none above a
   * second.
   */
  round: number;
}

/**
 * Whether the case is one the data will actually support.
 *
 * Each is capable of being a lie, and a lie fails: promising a role over
 * somebody better, promising a higher pick to a finished player, promising June
 * from the bottom of the conference. The failure is not silent, but nor is it
 * warned about in advance — the depth chart is a screen away and reading it
 * before you promise something is the job.
 */
export function pitchCredibility(kind: KeepPitch, p: Player, scene: KeepScene): number {
  switch (kind) {
    case 'stock': {
      // Two honest ways a man's stock can go up, and a promise needs one of
      // them. Either there is genuinely more of him to come — and you are the
      // coach to get it out, which is what TRAINING is — or he went late enough
      // that an ordinary senior season moves him up the board on its own.
      //
      // Both have to be able to fail together, and that is the case this pitch
      // exists to punish: a finished player taken in the second round cannot be
      // told he will go higher, because there is nowhere for him to go and
      // nothing left to teach him.
      const growth = unit((p.potential - overallOf(p) - 1) / 8);
      const roomAbove = unit((scene.round - 3) / 9);
      const coaching = 0.45 + 0.55 * unit((scene.training - 20) / 79);
      return unit(0.55 * growth + 0.45 * roomAbove) * coaching;
    }
    case 'role': {
      // Zero at twelve points behind the man in front of him, which is the
      // promise the depth chart flatly contradicts.
      const edge = overallOf(p) - scene.blockedBy;
      return unit(0.5 + edge / 24);
    }
    case 'ring':
      return unit(0.60 * scene.prestige + 0.40 * scene.returning);
    case 'word':
      // A rookie's word is worth something, and not much. Fifteen years in one
      // chair is worth a great deal, which is the only place in the game where
      // simply having stayed pays.
      return unit(
        0.20
        + 0.50 * unit((scene.coachPrestige - 25) / 60)
        + 0.30 * Math.min(1, scene.tenure / 8),
      );
  }
}

/**
 * What it takes to keep a man taken in this round.
 *
 * A hundred and sixty five in the first round down to four in the twentieth,
 * each round worth 0.825 of the one above it. The gradient *is* the mechanic: a first
 * rounder is being offered life-changing money by a professional club and is
 * very nearly unkeepable — a coach who reads him perfectly and spends most of a
 * recruiting window on him can just about do it, and a coach who guesses cannot
 * do it at any price. A twentieth rounder is a courtesy pick he would probably
 * turn down anyway, and keeping him costs about what one week's attention on
 * one recruit costs.
 *
 * Shown on screen, unlike `commitPointsFor`, which it is otherwise the twin of.
 * The round is a public fact and so is what a round is worth; what stays hidden
 * is how far your money goes against it, because that is the part you are
 * supposed to have to read him for.
 */
const KEEP_BASE = 165;
const KEEP_DECAY = 0.825;
export const keepPoints = (round: number): number =>
  Math.round(KEEP_BASE * Math.pow(KEEP_DECAY, Math.max(1, round) - 1));

/**
 * How far one unit of recruiting budget goes on this man with this case.
 *
 * Deliberately the shape `weeklyPoints` uses: the match multiplies the spend
 * rather than being added to it, so money spent making an argument he does not
 * care about is close to wasted. Measured over fourteen simulated years the
 * best case available on a man is worth about 1.1 a unit and the worst about a
 * quarter of that, and it is that four-to-one the whole mechanic turns on —
 * the coach who reads his man keeps him for a fraction of what a coach guessing
 * pays, and the coach who guesses badly cannot keep him at all.
 */
const KEEP_RATE = 5.0;

export function offerWorth(
  kind: KeepPitch, p: Player, scene: KeepScene, offer: number,
): number {
  if (offer <= 0) return 0;
  const weights = prioritiesOf(p);
  return offer * pitchAffinity(kind, weights) * pitchCredibility(kind, p, scene) * KEEP_RATE;
}

/** The smallest offer that would keep him, whether you can afford it or not. */
export function keepPrice(kind: KeepPitch, p: Player, scene: KeepScene, round: number): number {
  const perUnit = offerWorth(kind, p, scene, 1);
  if (perUnit <= 0) return Infinity;
  return Math.ceil(keepPoints(round) / perUnit);
}

// ---------------------------------------------------------------------------
// What he says about it
// ---------------------------------------------------------------------------

/**
 * A line about what is pulling at him, and the priorities it stays honest for.
 *
 * The same contract the scouting lines in recruiting.ts carry, and for the same
 * reason: the pools overlap heavily, so a line narrows what he wants without
 * ever naming it. If each line belonged to exactly one priority the hint would
 * be the answer written out in words, and choosing a case would stop being a
 * decision.
 */
export interface PullLine {
  readonly text: string;
  readonly of: readonly Priority[];
}

export const PULL_LINES: readonly PullLine[] = [
  { text: 'He asked, twice, whether you thought he could go higher.', of: ['development'] },
  { text: 'He wants a coach who will not let him stay the same.', of: ['development'] },
  { text: 'He asked what you did with the last man who was where he is.', of: ['development', 'prestige'] },
  { text: 'He is asking who else you are bringing in at his position.', of: ['development', 'playingTime'] },
  { text: 'He wants the ball, and he has not been shy about saying so.', of: ['playingTime'] },
  { text: 'He asked what the depth chart looks like in April.', of: ['playingTime', 'winning'] },
  { text: 'He has sat behind somebody for three years and he is done with it.', of: ['playingTime'] },
  { text: 'He talked about June more than he talked about money.', of: ['winning'] },
  { text: 'He wants to leave here having won something.', of: ['winning', 'prestige'] },
  { text: 'He asked who else is coming back next spring.', of: ['winning', 'playingTime'] },
  { text: 'He keeps coming back to what this place would look like on a résumé.', of: ['prestige'] },
  { text: 'He wants to be somewhere people have heard of.', of: ['prestige', 'winning'] },
  { text: 'He is weighing the badge on the front of the shirt.', of: ['prestige', 'development'] },
  { text: 'His father drove four hours to sit in on the meeting.', of: ['proximity'] },
  { text: 'He has never lived more than an hour from that house.', of: ['proximity'] },
  { text: 'He mentioned his mother twice in ten minutes.', of: ['proximity', 'prestige'] },
  { text: 'He wants a reason to stay that is not money.', of: ['proximity', 'development'] },
];

const linesFor = (k: Priority): PullLine[] => PULL_LINES.filter((l) => l.of.includes(k));

const PULL_SALT = { first: 6101, second: 6113, order: 6127 } as const;

/**
 * The two things he lets slip, in an order that tells you nothing.
 *
 * One line off his strongest pull and one off his second, exactly as the
 * recruiting report gives two signals drawn on two different facts. They are
 * not labelled and they are not in strength order — a fixed order would make
 * the first line the answer — so the pair brackets him without settling
 * anything, and reading the pair is the skill the whole screen is about.
 *
 * Hashed out of his id, so the words do not change when React looks at the row
 * again. Wondering whether he means it is fine; wondering whether the screen is
 * broken is not.
 */
export function pullHints(p: Player): readonly [string, string] {
  const weights = prioritiesOf(p);
  const ranked = [...PRIORITIES].sort((a, b) => weights[b] - weights[a]);
  const top = ranked[0] as Priority;
  const second = ranked[1] as Priority;
  const pick = (pool: PullLine[], salt: number): string => {
    const i = Math.min(pool.length - 1, Math.floor(scoutNoise(p.id, salt) * pool.length));
    return (pool[i] as PullLine).text;
  };
  const a = pick(linesFor(top), PULL_SALT.first);
  const b = pick(linesFor(second), PULL_SALT.second);
  return scoutNoise(p.id, PULL_SALT.order) < 0.5 ? [a, b] : [b, a];
}

// ---------------------------------------------------------------------------
// The board the offseason carries
// ---------------------------------------------------------------------------

/**
 * One of your own men, drafted, with eligibility still on him.
 *
 * Held with the live player object because he is nowhere else: the offseason
 * has already taken him off the roster, and if he is talked round he goes back
 * on it. He is in exactly one of the two places at any moment, which is what
 * keeps a reload from producing two of him.
 */
export interface DraftedMan {
  player: Player;
  round: number;
  /** Which case you made, once you have made one. */
  pitch: KeepPitch | null;
  /** What you put on the table. Gone whether it worked or not. */
  offered: number;
  /** What the case was worth, against what the round needed. */
  made: number;
  needed: number;
  outcome: 'pending' | 'stayed' | 'gone';
}

/** Your draft, this offseason, and what it has cost so far. */
export interface DraftBoard {
  year: number;
  /** Recruiting budget already committed to keeping people. */
  spent: number;
  men: DraftedMan[];
}

/**
 * Make the case and live with it.
 *
 * The offer is spent either way, which is the entire weight of the decision:
 * this is a negotiation, not a purchase, and a coach who promises a role over
 * a better player has still spent the winter promising it. The recruiting board
 * works the same way — points put on a recruit you lose do not come back.
 *
 * Reports what was actually taken out of the budget — the offer is trimmed to
 * what is left, so the caller never has to check — and whether he stayed.
 */
export function makeTheCase(
  man: DraftedMan, kind: KeepPitch, offer: number, scene: KeepScene, budgetLeft: number,
): { spent: number; kept: boolean } {
  if (man.outcome !== 'pending') return { spent: 0, kept: false };
  const spend = Math.max(0, Math.min(Math.round(offer), Math.floor(budgetLeft)));
  const made = offerWorth(kind, man.player, scene, spend);
  const needed = keepPoints(man.round);
  man.pitch = kind;
  man.offered = spend;
  man.made = made;
  man.needed = needed;
  man.outcome = made >= needed ? 'stayed' : 'gone';
  return { spent: spend, kept: man.outcome === 'stayed' };
}

/** Let him go without spending anything. */
export function letHimGo(man: DraftedMan): void {
  if (man.outcome !== 'pending') return;
  man.pitch = null;
  man.offered = 0;
  man.made = 0;
  man.needed = keepPoints(man.round);
  man.outcome = 'gone';
}
