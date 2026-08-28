// program.ts
// Prestige, the board, and your job.
//
// Until now a dynasty had no stakes outside the standings: you were Ridgemont
// State permanently and nothing followed from a bad year. This is the layer that
// makes a season *cost* something.
//
// Three quantities, deliberately separate, because conflating them is what makes
// career modes feel arbitrary:
//
//   PROGRAM PRESTIGE  what the school is, built over years. Slow to move.
//   COACH PRESTIGE    what *you* are, and it follows you between jobs.
//   JOB SECURITY      how the board feels right now. Fast to move, and the only
//                     one that gets you fired.
//
// A great coach at a poor program should be able to overachieve, gain personal
// standing, and leave for a better job while the program stays roughly what it
// was. That only works if the three are tracked apart.

import {
  LIFER_SEASONS, restoreAchievements, type AchievementLog,
} from './achievements.js';
import { overallOf } from './ratings.js';
import { FIRST, LAST } from '../data/names.js';
import { ALL_STATES } from '../data/schools.js';
import { DEFAULT_PHILOSOPHY, isPhilosophyId, type PhilosophyId } from './strategy.js';
import { cultureOf, type CultureEdge } from '../data/cultures.js';
import type { CoachHabits } from './habits.js';
import type { TeamRecord } from './season.js';
import type { Rng, Team } from './types.js';

// ---------------------------------------------------------------------------
// Prestige
// ---------------------------------------------------------------------------

/**
 * Program prestige, 0 to 100, seeded from the school's standing in the world.
 * It starts equal to team quality and diverges from there: quality is the roster
 * you have this year, prestige is the reputation the school carries.
 */
export const initialPrestige = (schoolPrestige: number): number =>
  Math.max(5, Math.min(95, Math.round(schoolPrestige)));

/** Five stars, for display. Nobody reads prestige as "62". */
export const prestigeStars = (prestige: number): number => {
  if (prestige >= 72) return 5;
  if (prestige >= 60) return 4;
  if (prestige >= 48) return 3;
  if (prestige >= 38) return 2;
  return 1;
};

// ---------------------------------------------------------------------------
// Who will hire you
// ---------------------------------------------------------------------------

/**
 * What a program is actually asking for in a coach, on the prestige scale.
 *
 * Normally it is simply what the school is. The exception is the interesting
 * one: **a proud program with a gutted roster discounts itself.** Nobody
 * established wants to inherit a rebuild at a place where the fanbase still
 * expects June, so those jobs go looking further down the ladder than their
 * name suggests. That is how a nobody gets a big job, and it is a trap as often
 * as it is an opportunity — the expectations do not come down with the bar.
 */
export function hiringBar(programPrestige: number, rosterQuality: number): number {
  if (rosterQuality >= programPrestige) return programPrestige;
  return Math.round((programPrestige + rosterQuality) / 2);
}

/**
 * Coach prestige a job requires, by the star tier of its hiring bar.
 *
 * The point of the ladder is that it is a ladder. A contender does not hand its
 * program to someone who has never run one, so the top of the board is closed at
 * the start of a career and opens as you earn it — which is the only way "I have
 * come a long way" is a thing the game can actually say. Indexed by stars, so
 * index 0 is unused.
 */
const HIRE_REQUIREMENT: readonly number[] = [0, 0, 20, 38, 52, 68];

export const requiredCoachPrestige = (
  programPrestige: number,
  rosterQuality: number,
): number => HIRE_REQUIREMENT[prestigeStars(hiringBar(programPrestige, rosterQuality))] ?? 0;

export const canBeHired = (
  coachPrestige: number,
  programPrestige: number,
  rosterQuality: number,
): boolean => coachPrestige >= requiredCoachPrestige(programPrestige, rosterQuality);

/** What to tell a coach who is not there yet. */
export function hireGateNote(
  coachPrestige: number,
  programPrestige: number,
  rosterQuality: number,
): string | null {
  const need = requiredCoachPrestige(programPrestige, rosterQuality);
  if (coachPrestige >= need) return null;
  const short = need - coachPrestige;
  return short > 25
    ? 'Out of reach. They hire proven names, and nobody knows yours yet.'
    : short > 12
      ? 'They want a coach with a record. Win somewhere smaller first.'
      : 'Close. One good season somewhere and they would take the call.';
}

export interface SeasonOutcome {
  wins: number;
  losses: number;
  /** Where they finished in their conference, 1 based. */
  conferenceRank: number;
  conferenceSize: number;
  wonConference: boolean;
  madeTournament: boolean;
  /**
   * Won the regional round: beat the champion of the conference next door.
   *
   * In today's format that is the same event as reaching Omaha, because the
   * four regional winners *are* the national field. It is read off the regional
   * result rather than off the finish string all the same, so the day the
   * postseason grows a round the two stop agreeing on their own instead of
   * needing to be pulled apart by hand.
   */
  wonRegional: boolean;
  reachedOmaha: boolean;
  wonTitle: boolean;
}

export const winPct = (o: SeasonOutcome): number =>
  (o.wins + o.losses === 0 ? 0 : o.wins / (o.wins + o.losses));

/**
 * How good a season was, on the prestige scale, so the two can be compared
 * directly. A .500 season at a middling program is worth about what that program
 * already is; a title is worth near the top of the scale whoever wins it.
 */
export function seasonScore(o: SeasonOutcome): number {
  let score = winPct(o) * 100;
  if (o.madeTournament) score += 6;
  if (o.wonConference) score += 8;
  // The regional is deliberately not priced here. Winning it is what puts a
  // program in Omaha, so the twelve below already pays for it — adding a second
  // line would quietly reprice every deep run the day the counter was added,
  // which is a balance change wearing a bookkeeping change's clothes.
  if (o.reachedOmaha) score += 12;
  if (o.wonTitle) score += 15;
  return Math.max(0, Math.min(100, score));
}

/**
 * Prestige drifts toward what you have actually been doing, slowly. The lag is
 * the point — a blue blood survives one bad year, and one good year does not
 * turn a cellar program into a contender.
 */
export function nextPrestige(current: number, o: SeasonOutcome): number {
  const drift = (seasonScore(o) - current) * 0.18;
  return Math.max(5, Math.min(95, Math.round(current + drift)));
}

// ---------------------------------------------------------------------------
// What the board wants
// ---------------------------------------------------------------------------

/**
 * What the board is actually asking for. A mandate, not just a win total —
 * "develop these kids" and "win it all" are different jobs even at the same
 * record.
 */
export type Mandate = 'develop' | 'build' | 'compete' | 'contend' | 'championship';

/**
 * One thing the board is asking for, stated so it can be ticked off.
 *
 * A mandate as a single sentence reads as atmosphere — you nod at it and move
 * on, and at the end of the year you have no idea whether you did the job. A
 * list you can check against is a contract: these are the boxes, here is how
 * many you filled, that is why you were kept or let go.
 */
export type ObjectiveKey =
  | 'wins' | 'stretchWins' | 'winningSeason' | 'notLast'
  | 'topHalf' | 'topThree' | 'conferenceTitle' | 'regionalTitle'
  | 'tournament' | 'omaha' | 'title';

export interface Objective {
  key: ObjectiveKey;
  /** The board's words, on one line. */
  label: string;
  /** Required objectives are the job. Bonuses are what "exceeded" is made of. */
  required: boolean;
  /** Present when the objective is a number, so the UI can show progress. */
  target?: number;
}

export interface Expectation {
  mandate: Mandate;
  /** Wins the board considers an acceptable season. */
  targetWins: number;
  /** The headline, in the board's words. */
  summary: string;
  /** What they actually want to see, beyond the record. */
  detail: string;
  /**
   * The actual checklist. `judge` reads this and nothing else.
   *
   * Two summary flags used to sit beside it — `expectsTournament` and
   * `expectsConference` — computed off the mandate and read by nothing, ever.
   * They were a second opinion about what the board wants, next to the checklist
   * that is the first one, and the day the checklist stopped requiring a bid of
   * contenders they became a second opinion that was also wrong. Deleted rather
   * than corrected, because the whole argument for `judge` reading this field and
   * nothing else is that there is one source of truth about the ask.
   */
  objectives: Objective[];
}

/**
 * The board's asks, per mandate.
 *
 * Note what is *required* versus a bonus, because that is where the mandates
 * genuinely differ rather than just sounding different. Winning the conference
 * is a bonus for a contender and a requirement for a championship program — the
 * same achievement, read two completely different ways depending on whose chair
 * you are sitting in. That asymmetry is the whole point of having mandates.
 *
 * **Zero-sum objectives are rationed by what the format hands out.** Only six of
 * a twelve team conference can finish in the top half, so requiring it of more
 * than half the league guarantees mass failure no matter how well anyone plays.
 * The first draft of this list demanded a top-half finish from rebuilding
 * programs — teams that are weak *by definition*, since that is what earns the
 * mandate — and 73% of them failed their review. A board that asks for the
 * arithmetically impossible is not a hard board, it is a broken one.
 *
 * The rule was written for placement and then broken by a postseason box, which
 * is the same mistake wearing different clothes. **A national bid used to be
 * required of every `contend` and `championship` program.** There are
 * `NATIONAL_BIDS` of them — eight, one per conference champion — and fifteen to
 * twenty programs a year carried the requirement, so seven to twelve of them
 * failed a box the country had no seat for. Measured over twenty seasons of the
 * full world it cost **12.8 clear reviews a year**, which was the whole of the
 * distance between the 55% the boards were clearing and the 62% the win target
 * is tuned to. The bid is a bonus now, at every mandate.
 *
 * So the ask climbs with the mandate, and every rung is a thing the format can
 * actually supply to the number of programs standing on it — seats per season
 * against programs asked per season, measured over thirty five seasons of the
 * eight conferences of twelve:
 *
 *   stay out of the cellar   88 seats   ~60 asked   develop and build
 *   finish above .500        unrationed ~15 asked   compete
 *   top three                24 seats   ~19 asked   contend and championship
 *   win the regional         16 seats   ~5–9 asked  championship alone
 *
 * The top rungs are close to full and are meant to be, so a change that makes
 * either mandate commoner breaks the arithmetic, and that is what the tests
 * are watching. The championship rung moved when the postseason expanded:
 * requiring the *conference* title (8 seats) broke the moment a settled league
 * carried nine championship boards in one year — the long-dynasty capacity
 * test caught exactly that — and the regional banner is the same kind of
 * trophy with twice the seats, now that sixteen of them hang a June.
 *
 * Each rung is also asked of programs the format selects *for* rather than
 * against, which is the second half of the rule and the reason "not last" is
 * safe where "top half" was not: the cellar is one slot in twelve and a rebuild
 * has eleven ways out of it, whereas a rebuild cannot be above the median of a
 * league it is defining the bottom of.
 *
 * The expanded format seats `NATIONAL_BIDS` of twenty, so a bid is no longer
 * the same event as a conference title — it can be earned by a regional
 * banner, protection or an at-large. It stays a bonus at every mandate: a
 * required bid would ask the selection committee rather than the team.
 */
export function objectivesFor(mandate: Mandate, targetWins: number): Objective[] {
  const wins: Objective = {
    key: 'wins', label: `Win ${targetWins} games`, required: true, target: targetWins,
  };
  const stretch: Objective = {
    key: 'stretchWins', label: `Win ${targetWins + 4}, ahead of schedule`,
    required: false, target: targetWins + 4,
  };
  const bid = (required: boolean): Objective =>
    ({ key: 'tournament', label: 'Reach the national tournament', required });
  const omaha = (required: boolean): Objective =>
    ({ key: 'omaha', label: 'Reach the national showdown', required });
  const confTitle = (required: boolean): Objective =>
    ({ key: 'conferenceTitle', label: 'Win the conference', required });
  const regTitle = (required: boolean): Objective =>
    ({ key: 'regionalTitle', label: 'Win your regional', required });

  switch (mandate) {
    case 'develop':
      return [
        wins,
        { key: 'notLast', label: 'Finish out of the conference cellar', required: true },
        { key: 'topHalf', label: 'Finish in the top half of the conference', required: false },
        bid(false), stretch,
      ];
    case 'build':
      return [
        wins,
        { key: 'notLast', label: 'Stay out of the conference cellar', required: true },
        { key: 'topHalf', label: 'Finish in the top half of the conference', required: false },
        bid(false), stretch,
      ];
    case 'compete':
      return [
        wins,
        { key: 'winningSeason', label: 'Finish above .500', required: true },
        { key: 'topHalf', label: 'Finish in the top half of the conference', required: false },
        bid(false), stretch,
      ];
    case 'contend':
      // Top three rather than top half. A contender clears the top half of its
      // conference 98% of the time — a required box that never fails is
      // decoration, and it was there because the bid beside it was carrying the
      // difficulty. With the bid a bonus, the placement rung has to be the real
      // ask, and three of twelve is one a league of sixteen contenders can fill.
      return [
        wins,
        { key: 'topThree', label: 'Finish top three in the conference', required: true },
        bid(false), confTitle(false), omaha(false),
      ];
    case 'championship':
      return [
        wins,
        /*
          The placement box moves down a rung, and the regional title carries
          the difficulty.

          `topThree` has twenty-four seats a year -- three in each of eight
          conferences -- and both this tier and `contend` were required to fill
          one. That put the askers at roughly the number of seats, which is a
          box that fails somebody every time the distribution breathes: two
          unrelated engine changes have now pushed the worst year to 25 and then
          26, each time by moving the world rather than by touching mandates.

          This is the same fix the trophy on this tier already got, for the same
          stated reason -- a required box needs more seats than askers. A
          championship program's hard ask is the regional banner below, sixteen
          of which hang every June; asking it *also* to finish top three was
          asking twice for one thing and starving the tier below of seats.
        */
        { key: 'topHalf', label: 'Finish in the top half of the conference', required: true },
        // The asymmetry the mandates exist for: the trophy a contender is
        // praised for is the job here. The *regional* banner rather than the
        // conference one, because sixteen of those hang a June against eight
        // conference titles, and a settled league can carry nine championship
        // boards in a bad year — a required box needs more seats than askers.
        // The conference title stays on the list as the bonus it is for
        // everybody else one rung down.
        regTitle(true),
        confTitle(false), bid(false), omaha(false),
        { key: 'title', label: 'Win the national title', required: false },
      ];
  }
}

/**
 * Whether a finished season cleared one box.
 *
 * A `conferenceRank` of 0 means "not known", which is what the UI holds during a
 * season in progress. Placement objectives read as unmet rather than met in that
 * case — an unfinished season should never show a box already ticked.
 */
export function objectiveMet(objective: Objective, o: SeasonOutcome): boolean {
  const ranked = o.conferenceRank > 0;
  const half = Math.ceil(o.conferenceSize / 2);
  switch (objective.key) {
    case 'wins':
    case 'stretchWins': return o.wins >= (objective.target ?? 0);
    case 'winningSeason': return o.wins > o.losses;
    case 'notLast': return ranked && o.conferenceRank < o.conferenceSize;
    case 'topHalf': return ranked && o.conferenceRank <= half;
    case 'topThree': return ranked && o.conferenceRank <= 3;
    case 'conferenceTitle': return o.wonConference;
    case 'regionalTitle': return o.wonRegional;
    case 'tournament': return o.madeTournament;
    case 'omaha': return o.reachedOmaha;
    case 'title': return o.wonTitle;
  }
}

/** The checklist with each box resolved. What the board screen renders. */
export function gradeObjectives(
  e: Expectation,
  o: SeasonOutcome,
): { objective: Objective; met: boolean }[] {
  return e.objectives.map((objective) => ({ objective, met: objectiveMet(objective, o) }));
}

/**
 * How good this roster is right now, on the same 0-100 scale as everything else.
 * Weighted toward the people who play every day: nine bats and the weekend
 * rotation decide a college season, not the twenty-third man.
 */
export function rosterStrength(team: Team): number {
  const bats = team.lineup.map(overallOf);
  const arms = team.rotation.slice(0, 3).map(overallOf);
  const all = [...bats, ...arms];
  if (all.length === 0) return 50;
  return Math.round(all.reduce((a, b) => a + b, 0) / all.length);
}

/**
 * What the board wants, from what the school is *and* what it has.
 *
 * Prestige alone is not enough. A proud program with a gutted roster is asking
 * for something different from the same program at full strength, and a modest
 * school that happens to have a loaded senior class knows this is its year. The
 * two together give four honest situations:
 *
 *   low prestige,  thin roster  →  DEVELOP.  Bring players on. Wins come later.
 *   low prestige,  good roster  →  COMPETE.  Rare chance. Do not waste it.
 *   high prestige, thin roster  →  BUILD.    Stay respectable while you reload.
 *   high prestige, good roster  →  CHAMPIONSHIP. Omaha or a failed year.
 *
 * The roster carries slightly more weight than the reputation, because the board
 * ultimately watches the games.
 */
export function expectationFor(prestige: number, roster: number, games: number): Expectation {
  const standing = prestige * 0.45 + roster * 0.55;

  // The slope matters more than the intercept. A shallower curve had the whole
  // world asked for 15 to 19 wins, so a cellar job and a national contender were
  // separated by four games and the mandate did all the work. Real programs at
  // these strengths finish anywhere from .300 to .650, and the board's number
  // should span most of that.

  const proud = prestige >= 50;
  const talented = roster >= 55;

  // Weak *relative to the name*, not on an absolute scale. An absolute cutoff
  // meant a 71 prestige school with a 51 roster read as merely average, so the
  // screen called it a sleeping giant while the board asked it to compete — the
  // two halves of the same job disagreeing in front of the player. A roster ten
  // points under what the school is known for is a rebuild at any altitude.
  const weak = roster < prestige - 10;

  const mandate: Mandate =
    standing >= 68 ? 'championship'
    : talented && standing >= 55 ? 'contend'
    : proud && weak ? 'build'
    : standing >= 48 ? 'compete'
    : 'develop';

  // The win target is priced off the roster and nothing else, from a line fitted
  // to 512 simulated team-seasons:
  //
  //     winPct = 0.01284 * roster - 0.128        R^2 = 0.679, residual 2.9 wins
  //
  // Two things were wrong with setting it from `standing`, which is 45% prestige.
  // It ran high for weak teams and low for strong ones — develop programs hit
  // their number 27% of the time while championship programs hit theirs 100% —
  // so the same word meant "nearly impossible" at one job and "a formality" at
  // another. And it asked proud programs with gutted rosters for wins the roster
  // could not produce, which is what drove 93% of rebuild seasons to a negative
  // review. Prestige decides what *kind* of job this is; it has no business
  // deciding how many games these particular players should win.
  //
  // The bar sits about a game and a half *below* the median outcome, not on it.
  // Sitting it exactly on the median is the arithmetically neutral choice and the
  // wrong one: it means half of all programs fail to meet expectations every
  // single year by construction, and a board that reacts badly to a perfectly
  // normal season is not demanding, it is incoherent. The offset buys roughly a
  // 62% clear rate — a typical year is accepted, and "missed" keeps its meaning
  // for seasons that actually went wrong.
  const targetPct = Math.max(0.20, Math.min(0.85, 0.01284 * roster - 0.173));

  // A compete board asks for a winning season *and* a win total. On a thin
  // compete roster the fitted total came out at 16 of 33 — below .500 — so the
  // two required boxes contradicted each other and the mandate was unclearable
  // by construction. If the board is going to say "a winning season", the number
  // it prints has to be one.
  const floor = mandate === 'compete' ? Math.floor(games / 2) + 1 : 0;
  const targetWins = Math.max(floor, Math.round(targetPct * games));

  // The headline has to say the same thing the checklist does. It used to
  // promise a contender the tournament, which is a box the board no longer
  // requires and never had the seats for — two sources of truth in front of the
  // player, which is the failure `judge` was rewritten to end.
  const summary = {
    championship: `Win the conference and go deep. ${targetWins} wins on the way there.`,
    contend: `Top three, and push on into June. ${targetWins} wins is the floor.`,
    compete: `A winning season, and push for a bid. The board wants ${targetWins}.`,
    build: `Stay respectable while you reload. ${targetWins} wins keeps the room calm.`,
    develop: `Bring players on. ${targetWins} wins would be real progress.`,
  }[mandate];

  const detail = {
    championship: 'Anything short of a deep run will be read as a wasted year.',
    contend: 'They expect to be playing in June, not watching.',
    compete: 'Nobody is demanding a title. They do want to stop being an easy game.',
    build: 'They understand the roster. Their patience is not unlimited.',
    develop: 'Freshmen improving matters more here than the final record.',
  }[mandate];

  return {
    mandate, targetWins, summary, detail,
    objectives: objectivesFor(mandate, targetWins),
  };
}

// ---------------------------------------------------------------------------
// The seam: your board, and the other ninety five
// ---------------------------------------------------------------------------

/*
  There are two boards in this file and they are two on purpose. This is the
  seam, and everything that differs is in the block below rather than scattered
  through `engine/rivals.ts`, so that nobody can change one without seeing the
  other. `Board` is the whole of the difference: two fields, and if a third ever
  appears it appears here.

  Everything else is shared and must stay shared — `objectivesFor`, `judge`,
  `SECURITY_DELTA`, `badRunPenalty`, `nextCoachPrestige`, `contractFor`, the
  sacking bar. One `reviewSeason` grades ninety six careers.

  --- WHAT DIFFERS, AND WHY (1): the league the checklist is read against ---

  `expectationFor` above is **the player's**, and every number in it — the
  standing cutoffs, the fitted win line, the offset that buys a 62% clear rate —
  was calibrated against the world as `createSeason` hands it over. Its inputs
  do not stay there. Measured over thirty five seasons of the full ninety six
  program world:

      mean program prestige   40.9  →  51.4   (`nextPrestige` drifts toward
                                               `seasonScore`, mean 51; the school
                                               table seeds at mean 41)
      mean roster strength    44.7  →  55.2   (nothing to do with coaches: the
                                               progression and recruiting
                                               pipeline settles ten points above
                                               what the generator seeds)

  Both feed `standing = prestige × 0.45 + roster × 0.55`, so a board written for
  a league centred at 43 ends up reading one centred at 53. The damage is mostly
  not the mandate mix; it is the win target, because **wins are zero-sum and the
  target is not**. The fitted line asks for more games as the roster number
  rises, but forty five games against each other cannot produce more than 22.5
  wins a program however good everybody gets. At the seeded distribution the
  league is asked for 18.1 and wins 22.5; at the settled one it is asked for 23.6
  and still wins 22.5. `wins` is a required box under every mandate, and it is
  missed by 53 of 96 programs a year.

  `objectivesFor` already refuses to require a top-half finish of more than half
  the league, on the grounds that a board asking for the arithmetically
  impossible is not a hard board but a broken one. This is the same rule applied
  to a zero-sum quantity that got away with it. A second one got away with it
  inside the checklist itself and has since been caught — the national bid, which
  was required of twice as many programs as the country awards. Three instances
  of one mistake is what turned a per-objective judgement into the capacity rule
  now stated over `objectivesFor` and enforced by a test.

  So a rival board reads the identical checklist, and reads it against **this
  year's league** rather than against a snapshot from 2027. What the checklist
  itself asks for is the player's board and is shared — see the note in
  `engine/rivals.ts` and §16.10.

  --- WHAT DIFFERS, AND WHY (2): the second bar ---

  With the arithmetic corrected the boards clear 55% of the league, against the
  62% `expectationFor` was tuned to, and they still sack 7.5 coaches of 96 a
  year where the real sport sacks four or five. (The seven points were the
  second half of the same error and are closed now — see the capacity rule in
  `objectivesFor` — but they were still open when the bar below was argued, and
  closing them did not touch it: the boards clear 63% and sack 4.4.) That
  residue is not an error; it is what the player's board *is*, seen ninety five
  times over at once. The
  same hazard that reads as "you will be sacked about once in thirteen seasons"
  in one career reads as a cull when it is applied to a whole country.

  The part of it that does not survive the multiplication is the **second bar**.
  The player's board has two: `SACK_BAR`, where they stop the car, and
  `PLAYER_RENEW_BAR`, twenty five points higher, where a contract running out is
  simply not renewed. The band between them is a good device for one career — the
  deal ticking down while you try to convince them is a story, and the game
  should keep telling it. Across ninety five programs it is a scheduled cull:
  the median coach's security is a near-driftless walk that spends a third of its
  life in that band, so every three to five years it fires him regardless of
  whether anybody thought he should go.

  A rival board has one bar. It sacks a man it has seen enough of, and re-signs
  everybody else — which is both simpler than the player's rule and closer to
  what athletic directors do, since a board that would not pay to remove a coach
  does not usually decline to re-sign him either.

  Nothing else about patience is touched. The security deltas, the sacking bar,
  the first-year grace and the escalating bad-run penalty are all the player's,
  which is why a rival who fails three seasons running still loses his job on
  exactly the arithmetic that would lose the player his.
*/

/** Where a league sits, this year, on the two scales `expectationFor` reads. */
export interface LeagueShape {
  /** Mean program prestige across every chair. */
  prestige: number;
  /** Mean `rosterStrength` across every chair. */
  roster: number;
}

/**
 * The league `expectationFor`'s numbers were written against.
 *
 * `prestige` is what `initialPrestige` produces over the school table — 40.85,
 * and a test pins it. `roster` is not measured at all: it is the roster the
 * fitted line inside `expectationFor` says goes .500, `(0.5 + 0.128) / 0.01284`,
 * which is the only honest reference for a zero-sum quantity. Whatever the
 * league's mean roster is, that roster wins half its games by definition, so
 * translating the mean onto this number is what makes the target answerable.
 */
export const CALIBRATED_LEAGUE: LeagueShape = { prestige: 41, roster: 49 };

/** What the country looks like right now, for a board that bothers to look. */
export function leagueShape(teams: readonly TeamRecord[]): LeagueShape {
  if (teams.length === 0) return CALIBRATED_LEAGUE;
  const sum = (f: (t: TeamRecord) => number): number =>
    teams.reduce((a, t) => a + f(t), 0) / teams.length;
  return {
    prestige: sum((t) => t.prestige),
    roster: sum((t) => rosterStrength(t.team)),
  };
}

/**
 * What a rival's board wants: `expectationFor`, with the league moved back under
 * it.
 *
 * A translation and nothing else — the mandate cutoffs, the checklist, the
 * fitted slope and the offset are all the player's, untouched. Only where the
 * middle of the country sits is corrected, and it is corrected on both axes
 * because both of them moved.
 *
 * It is deliberately a shift rather than a rescale. A shift cannot reorder the
 * league or change what one roster point is worth; it only answers "compared to
 * whom", which is the only question that went stale.
 */
export function rivalExpectation(
  prestige: number,
  roster: number,
  league: LeagueShape,
  games: number,
): Expectation {
  return expectationFor(
    prestige - league.prestige + CALIBRATED_LEAGUE.prestige,
    roster - league.roster + CALIBRATED_LEAGUE.roster,
    games,
  );
}

/** Security below which a board stops the car mid-contract. Shared. */
export const SACK_BAR = 20;

/** And the second bar, which is the player's alone. See the seam note above. */
export const PLAYER_RENEW_BAR = 45;

/**
 * Who is judging, and the only two things that depend on the answer.
 *
 * A parameter to `reviewSeason` rather than a branch inside it, so the two
 * boards are constructed by name at the call site and a reader of either call
 * can see immediately which one is sitting.
 */
export interface Board {
  /** The checklist. `judge` reads this and nothing else. */
  expectation: Expectation;
  /** Security below which a deal that has run out is not offered again. */
  renewAt: number;
}

/** Yours. Every number in it is the one it has always been. */
export const playerBoard = (
  prestige: number, roster: number, games: number,
): Board => ({
  expectation: expectationFor(prestige, roster, games),
  renewAt: PLAYER_RENEW_BAR,
});

/** One of the other ninety five. Two differences, both argued at the seam. */
export const rivalBoard = (
  prestige: number, roster: number, league: LeagueShape, games: number,
): Board => ({
  expectation: rivalExpectation(prestige, roster, league, games),
  renewAt: SACK_BAR,
});

export type Verdict = 'exceeded' | 'met' | 'missed' | 'failed';

/**
 * The verdict, read off the same checklist the player was shown in preseason.
 *
 * This deliberately has no independent opinion. An earlier version judged on win
 * margin while the screen displayed a mandate, which meant the board could tell
 * you it wanted a conference title and then fire you over a win total you were
 * never shown — two sources of truth disagreeing in front of the player. There
 * is one source now: the boxes, and how many you filled.
 */
export function judge(o: SeasonOutcome, e: Expectation): Verdict {
  // A national title ends the conversation regardless of the rest of the list.
  if (o.wonTitle) return 'exceeded';

  const graded = gradeObjectives(e, o);
  const missed = graded.filter((g) => g.objective.required && !g.met).length;
  const bonuses = graded.filter((g) => !g.objective.required && g.met).length;

  // Two bonuses, not one. Every mandate carries three, and one of them is
  // ordinary enough that a single hit is just a good season inside the mandate —
  // treating it as overachievement made "met" almost extinct (8.9% of reviews)
  // and left the board with no way to say "you did the job" without praise.
  if (missed === 0) return bonuses >= 2 ? 'exceeded' : 'met';
  if (missed === 1) return 'missed';
  return 'failed';
}

// ---------------------------------------------------------------------------
// The coach
// ---------------------------------------------------------------------------

/**
 * What a coach is good at.
 *
 * Four numbers, 0 to 100, each wired to something the engine already does — a
 * skill tree whose branches do not change the simulation is a menu, not a
 * decision. Offence and defence tilt how a game is played, training decides how
 * much a player grows between seasons, and recruiting is how hard your pitch
 * lands on a target.
 */
export interface CoachSkills {
  offense: number;
  defense: number;
  training: number;
  recruiting: number;
}

export const SKILLS: readonly (keyof CoachSkills)[] =
  ['offense', 'defense', 'training', 'recruiting'];

export const SKILL_LABEL: Record<keyof CoachSkills, string> = {
  offense: 'OFFENSE',
  defense: 'DEFENSE',
  training: 'TRAINING',
  recruiting: 'RECRUITING',
};

export const SKILL_BLURB: Record<keyof CoachSkills, string> = {
  offense: 'Your hitters take slightly better at-bats, every game.',
  defense: 'Balls in play against you become outs a little more often.',
  training: 'Your returning players develop further between seasons.',
  // Two effects now, and the second one is the reason to spend here early: the
  // hours matter, but a coach who cannot read a recruit is guessing at which
  // hours to spend. Saying only the first half was true and misleading at once.
  recruiting: 'Every hour on a recruit counts for more, and your scouting reports run tighter.',
};

/**
 * Points earned for a season, spent on the four skills.
 *
 * Scaled to the year rather than flat, so a coach who wins improves faster —
 * which is the compounding a dynasty is made of — without a bad year leaving him
 * with nothing to spend and no reason to open the screen.
 */
export function skillPoints(outcome: SeasonOutcome): number {
  let points = 3;
  if (outcome.madeTournament) points += 1;
  if (outcome.wonConference) points += 1;
  if (outcome.reachedOmaha) points += 2;
  if (outcome.wonTitle) points += 2;
  return points;
}

/**
 * What he looks like, as four small integers.
 *
 * Indices into the palettes the portrait component owns, rather than colours or
 * names. A save that stores "#c68a5e" freezes today's palette into every career
 * ever started; a save that stores `2` follows the drawing when it is redrawn.
 * They are also the cheapest possible thing to write to disk and to validate on
 * the way back — see `normalizeLook`.
 */
export interface CoachLook {
  skin: number;
  hair: number;
  /** Hair style, including bald. */
  cut: number;
  /** Facial hair, including none. */
  beard: number;
}

/**
 * How many choices each of those four has.
 *
 * The counts, not the colours: the palettes live in the portrait component,
 * which is where anybody changing them will be. They have to agree with these
 * numbers, and the portrait indexes modulo its own list length so a disagreement
 * shows up as the wrong shade rather than as a face that fails to draw.
 */
export const LOOK_CHOICES: Readonly<Record<keyof CoachLook, number>> = {
  skin: 6, hair: 6, cut: 5, beard: 4,
};

export const DEFAULT_LOOK: CoachLook = { skin: 1, hair: 1, cut: 1, beard: 0 };

/** One saved index, brought back inside the range the portrait can draw. */
const clampChoice = (value: unknown, of: number): number =>
  (typeof value === 'number' && Number.isFinite(value)
    ? Math.abs(Math.round(value)) % of
    : 0);

/**
 * A look off the disk or out of a form. Anything missing or nonsensical becomes
 * the default rather than a hole, for the same reason `restoreCoach` exists: a
 * career that predates the portrait must load as a coach with a face, not as a
 * blank square or a crash.
 */
export function normalizeLook(saved: unknown): CoachLook {
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_LOOK };
  const l = saved as Partial<CoachLook>;
  return {
    skin: clampChoice(l.skin, LOOK_CHOICES.skin),
    hair: clampChoice(l.hair, LOOK_CHOICES.hair),
    cut: clampChoice(l.cut, LOOK_CHOICES.cut),
    beard: clampChoice(l.beard, LOOK_CHOICES.beard),
  };
}

/**
 * Who the coach is, as distinct from what he can do.
 *
 * A career mode is allowed to ask for a name and a hometown purely so the thing
 * you build has somebody's name on it — what it is not allowed to do is imply
 * the answers are worth points. Name, age, home state and the portrait are all
 * that: they never reach the simulation, and they are kept apart from
 * `CoachSkills` so that stays visible.
 *
 * The philosophy is the one exception on this list and it is not flavour at all.
 * It is a real starting Strategy, applied to whatever program hires him, and it
 * lives here because it is part of who the coach is rather than something the
 * job came with — see engine/strategy.ts.
 *
 * `look` and `philosophy` are optional at the door because this is the shape the
 * creation screen, an old save and a test all come through, and two of those
 * three predate both fields. `newCoach` fills them in, so `CoachState` below has
 * them for certain.
 */
export interface CoachProfile {
  name: string;
  /** Years old. Follows the calendar; no screen reads it for anything else. */
  age: number;
  /**
   * The two letter code he is from, drawn from the same list programs and
   * recruits use. A shared vocabulary matters more than the freedom of a text
   * box: "MS" reads as a place in this world, "the Wirral" does not.
   */
  homeState: string;
  look?: CoachLook;
  philosophy?: PhilosophyId;
}

/**
 * The believable range for a head coach.
 *
 * Bounded rather than free entry because the number sits next to a career that
 * can run for twenty years — a 19 year old with a decade of tenure is the kind
 * of detail that makes everything around it look unserious.
 */
export const MIN_COACH_AGE = 28;
export const MAX_COACH_AGE = 68;

/**
 * Who you are if nobody says otherwise — a fresh career that skipped the form,
 * and a save written before the profile existed. The alternative for an old save
 * is a screen with holes in it, which reads as a bug rather than as a career
 * that predates the feature.
 */
export const DEFAULT_PROFILE: CoachProfile = {
  name: 'Coach', age: 41, homeState: 'TX',
  look: DEFAULT_LOOK, philosophy: DEFAULT_PHILOSOPHY,
};

export const clampAge = (age: number): number =>
  (Number.isFinite(age)
    ? Math.max(MIN_COACH_AGE, Math.min(MAX_COACH_AGE, Math.round(age)))
    : DEFAULT_PROFILE.age);

/**
 * A plausible coach, drawn from the pools the players come out of.
 *
 * The creation screen opens with one of these already in the fields, so anybody
 * who does not care about any of it presses continue once and still ends up with
 * a career belonging to a named person. Takes the generator rather than reaching
 * for `Math.random` so the same career seed always produces the same suggestion
 * — a name that changes under you on every re-render is not a suggestion.
 */
export function randomProfile(rng: Rng): CoachProfile {
  const first = FIRST[Math.floor(rng() * FIRST.length)] ?? DEFAULT_PROFILE.name;
  const last = LAST[Math.floor(rng() * LAST.length)] ?? '';
  const choice = (of: number): number => Math.floor(rng() * of);
  return {
    name: `${first} ${last}`.trim(),
    // Late thirties to early fifties. Head jobs mostly go to people who spent a
    // decade somewhere else first, so the suggestion sits well inside the range
    // rather than at either end of it.
    age: clampAge(38 + Math.floor(rng() * 15)),
    homeState: ALL_STATES[Math.floor(rng() * ALL_STATES.length)] ?? DEFAULT_PROFILE.homeState,
    look: {
      skin: choice(LOOK_CHOICES.skin),
      hair: choice(LOOK_CHOICES.hair),
      cut: choice(LOOK_CHOICES.cut),
      beard: choice(LOOK_CHOICES.beard),
    },
    // The face is drawn at random and the philosophy is not. A suggestion that
    // quietly picked how the team plays would be the one prefilled answer that
    // costs games, and the whole point of the prefill is that skipping it is
    // free.
    philosophy: DEFAULT_PHILOSOPHY,
  };
}

export interface CoachState extends CoachProfile {
  /** His face. Always present once a coach exists, however he was created. */
  look: CoachLook;
  /**
   * How his teams play. A trait he carries between programs, not a property of
   * the job: it is applied to whoever hires him, and it is the starting point
   * for the strategy screen rather than a lock on it.
   */
  philosophy: PhilosophyId;
  /** What he is good at. See CoachSkills. */
  skills: CoachSkills;
  /**
   * What he is known for. Ids from `data/badges.ts`.
   *
   * Two arrive from the interview; the rest are earned by how a career is
   * actually played. Permanent once earned, five at most. Optional because a
   * save written before badges existed has none, and a coach with none is a
   * coach nobody has worked out yet rather than a broken record.
   */
  badges?: string[];
  /**
   * What kind of programme he suits, from what he said at creation.
   *
   * Kept for the life of the career rather than spent at creation: the job
   * market reads it every time a chair opens, not only the first time.
   */
  leans?: Partial<Record<CultureEdge, number>>;
  /** Unspent skill points, waiting on the offseason screen. */
  skillPoints: number;
  /** Your reputation. Travels with you and decides which jobs will have you. */
  prestige: number;
  /** How safe you are right now. Under 20 and the board moves. */
  security: number;
  /** Seasons at the current job. */
  tenure: number;
  /**
   * Years left on the deal. A contract is the promise the board actually made,
   * and it is why a rebuild is possible at all — without one, every bad season
   * is potentially your last and the long game has no protection.
   *
   * Running it out is not the same as being sacked. Reaching zero with the board
   * unconvinced means they simply do not renew.
   */
  contractYears: number;
  contractLength: number;
  /** Career totals, across every program. */
  careerWins: number;
  careerLosses: number;
  titles: number;
  conferenceTitles: number;
  /** Regionals won. Counted nowhere at all before B6, and it is a real thing. */
  regionalTitles: number;
  tournaments: number;
  /**
   * Consecutive seasons the board graded `missed` or `failed`.
   *
   * The whole of B5 lives in this one integer. Security already remembers a bad
   * season in the sense that the number is lower afterwards, but nothing could
   * tell the difference between a coach on his first poor year and a coach on
   * his fourth — so the second one cost exactly what the first did, and a run
   * of them was priced as a series of unrelated accidents.
   *
   * Cleared when he takes a chair — see `takeChair`, and the same clause for a
   * rival in `runCarousel`. A run is a *board's* patience running out, and a
   * board that has just hired him is by definition unconvinced by the last
   * one's read. What follows him between jobs is the prestige the run already
   * cost him, which is the part that is genuinely the country's opinion.
   */
  badRun: number;
  /**
   * What the program was worth on the day he walked in.
   *
   * The only reason it is stored rather than derived is the Builder
   * achievement, which asks a question about the *distance travelled* at one
   * school — and a prestige number that has already moved cannot be asked where
   * it started from. Reset with tenure whenever he takes a chair.
   */
  arrivedPrestige: number;
  /**
   * How many chairs he has sat in, this one included.
   *
   * Nothing recorded this, which is why the old ladder could not tell a
   * drifter from a beginner: "Journeyman" meant *has coached a game*, so
   * seventy-one of ninety-six coaches wore it at year thirty. A journeyman is
   * a man who has been six places, and now the game knows how many.
   *
   * Optional because every save predating it has one chair and no history to
   * reconstruct; absent reads as one.
   */
  stints?: number;
  /**
   * How many of those chairs were genuinely bad jobs.
   *
   * Counted on arrival rather than on departure, because taking a wreck is the
   * decision -- what happens after it is the career.
   */
  rebuilds?: number;
  /** The most prestige a programme gained while he sat in it. */
  bestBuild?: number;
  /**
   * Whether he was caught approaching somebody else this season.
   *
   * Cleared at the year roll. The board reads it at the review, where it is
   * the difference between a bad year and a last one.
   */
  caughtLooking?: boolean;
  /**
   * What he has actually done, across the whole career.
   *
   * Hidden from every screen and read only by the badge check -- see
   * `engine/habits.ts` for why the thresholds are seeded and why nobody is
   * told how far along they are.
   */
  habits?: CoachHabits;
  /**
   * One-time and permanent, and his rather than the program's. See
   * `engine/achievements.ts` — a sparse map, so an absent key means unearned.
   */
  achievements: AchievementLog;
}

/**
 * How long a board commits for. Weaker programs offer more time because they are
 * asking for a rebuild and know it; the good jobs pay in prestige and expect
 * results sooner.
 */
export const contractFor = (prestige: number): number =>
  (prestige >= 65 ? 3 : prestige >= 48 ? 4 : 5);

/**
 * Where every career starts. Low enough that the top of the board is closed and
 * you can see it is closed, which is the whole point of having a ladder.
 */
export const ROOKIE_PRESTIGE = 25;

// ---------------------------------------------------------------------------
// What they call you
// ---------------------------------------------------------------------------

/**
 * The word beside HEAD COACH, earned rather than served.
 *
 * The line used to read "seasons completed", which is a fact the two counters
 * either side of the portrait already state. What a coach wants from that line
 * is what the sport thinks of him, and the only honest source for that is what
 * he has actually done — so the ladder is climbed with titles and deep runs,
 * not with attendance. Twenty quiet years does not make anybody renowned.
 *
 * It used to be carried by prestige, on the reasoning that prestige is already
 * the number that moves on overachievement and decays when nothing happens.
 * That reasoning was wrong about what a title is. Reported: *"the coach title
 * keeps upgrading or changing every season, these titles are supposed to be
 * based in achievements"* — and measured over thirty seasons of ninety six
 * programs, **13.1% of the coach-seasons in which a man won nothing at all
 * changed what he was called**, in both directions. That is a rating wandering,
 * not a reputation.
 *
 * So the cabinet is the whole ladder now and prestige is not in it at any
 * weight. Not as a tiebreaker either: two coaches with the same cabinet get the
 * same word, because a tiebreaker that moves every November is the reported bug
 * with a smaller step size.
 */
export type CoachTitle =
  | 'Unproven' | 'Rookie' | 'Career man' | 'Journeyman' | 'Firefighter'
  | 'Lifer' | 'Builder' | 'Respected' | 'Nearly man' | 'Contender'
  | 'Champion' | 'Dynasty' | 'Legend';

/**
 * Fifteen years in one chair.
 *
 * Kept apart from the ladder rather than sitting on top of it, because it is
 * the one thing here earned by staying instead of winning, and a bad run should
 * not be able to take it away. It reads alongside the title — RENOWNED · LIFER —
 * so a long tenure survives a reputation that has slipped.
 *
 * The number itself belongs to the achievement of the same name and is defined
 * there. Re-exported because this is the module every caller of `coachStanding`
 * is already importing from, and because two fifteens is how a screen and a
 * cabinet come to disagree about whether a man is a lifer.
 */
export { LIFER_SEASONS };

/**
 * Ten seasons in one chair reads as a life spent somewhere.
 *
 * Deliberately below `LIFER_SEASONS`, which is the achievement and stays at
 * fifteen. The title is describing a career's shape rather than handing out a
 * medal, and the measured distribution has a median tenure of five and a
 * ninetieth percentile of fourteen -- so fifteen as a *title* threshold
 * described almost nobody.
 */
const LIFER_TITLE = 10;

export interface CoachStanding {
  title: CoachTitle;
  /** True once he has spent {@link LIFER_SEASONS} at the current job. */
  lifer: boolean;
}

/**
 * The part of a coach a standing is read off.
 *
 * Narrower than `CoachState` because the ninety five men in the other chairs
 * wear these titles too and a `RivalCoach` is not a `CoachState` — he has no
 * philosophy, no achievements and no home state, none of which a title has ever
 * asked about. Naming the fields is also the shortest honest statement of what
 * the ladder is allowed to look at.
 */
export type CoachRecord = Pick<
  CoachState,
  'careerWins' | 'careerLosses' | 'titles' | 'conferenceTitles'
  | 'regionalTitles' | 'tournaments' | 'tenure'
  | 'stints' | 'rebuilds' | 'bestBuild'
>;

/**
 * How much of each thing a rung asks for.
 *
 * The ladder is six rungs and there are only three things a coach can actually
 * win, so the upper rungs have to be reached by doing a smaller thing more than
 * once. Repetition is the right currency for it, and the format is the reason
 * the counts are what they are rather than one apiece.
 *
 * **A bid and a conference title are the same event today**: the eight
 * conference champions *are* the eight-team national field. And **half of that
 * field wins a region** — four regionals, one champion each — so a trip to the
 * last four is not the rarity its name suggests. Measured over thirty seasons
 * with one region worth RENOWNED, the band above Established was four times the
 * size of it: a ladder that got wider as it went up. Two regions is the honest
 * price, because at even odds per trip that is a coach who kept getting there.
 *
 * The two counters are kept apart anyway, because the expanded postseason
 * (twenty bids, at-larges) separates them and on the day it lands this table
 * already says the right thing — three at-large trips is Established, and a
 * league title is worth more than a trip.
 */
const RENOWNED_REGIONS = 2;
const RENOWNED_LEAGUES = 4;
const ESTABLISHED_LEAGUES = 2;
const ESTABLISHED_BIDS = 3;

/**
 * The ladder, read top down: the best thing on the shelf is the word.
 *
 * | Legendary   | a national title                                     |
 * | Renowned    | two regional titles, or four league titles           |
 * | Established | a regional title, two league titles, or three bids   |
 * | Respected   | a tournament bid                                     |
 * | Journeyman  | has coached a game                                   |
 * | Unproven    | has not                                              |
 *
 * Every rung is a day: the June you first qualified, the June you did it again,
 * the June you got out of your region, the June you won the country. Nothing
 * here can move on a season in which none of those happened, which is the whole
 * point of the rewrite — and nothing here can be taken away either, so a bad
 * decade costs a man his job long before it costs him his name.
 *
 * A first year national champion is LEGENDARY that afternoon. That is not too
 * fast: it is one of ninety six programs in one of thirty years, and a ladder
 * that made him wait would be measuring patience rather than achievement.
 */
export function coachStanding(coach: CoachRecord): CoachStanding {
  const games = coach.careerWins + coach.careerLosses;
  const stints = coach.stints ?? 1;
  const juneRuns = coach.tournaments + coach.regionalTitles;

  /*
    Twelve shapes a career can take, read top down.

    The old ladder measured *how much* a man had won and nothing else, on six
    rungs. It produced the fault that started this: "Journeyman" sat at the
    bottom meaning **has coached one game**, so seventy-one of ninety-six
    coaches wore it at year thirty and the word did no work at all.

    A journeyman is a man who has been six places. That is the whole idea here
    -- a title should describe the *shape* of a career rather than its size, so
    two men with identical records read differently if one of them never left
    town and the other has packed six times.

    Order is priority, and it puts achievement above shape deliberately: a man
    who has moved six times and won two national titles is a champion who
    happened to move, not a drifter who happened to win. Shape is what you get
    called when there is no trophy to call you after.
  */
  /*
    Every threshold below is measured rather than guessed, and the first pass
    was guessed. `npm run carousel` prints the distribution these come from.

    What the measurement said, over thirty-five years of ninety-six chairs:

      games              med  405   p90  810
      tournaments        med    0   p90    3
      regional titles    med    0   p90    3
      national titles    med    0   max    1
      stints             med    2   p90    3   max 4
      rebuilds           med    0   p90    1   max 2
      tenure             med    5   p90   14   max 23

    Two of those changed the design rather than a number. **Six programmes is
    unreachable** -- the carousel simply does not move a man that often inside a
    career, so a journeyman at six would have been a word nobody ever wore. It
    is four, which is the top decile. And a regional banner is *not* rare: June
    hangs sixteen of them a year, so "two" was the seventy-fifth percentile
    dressed up as an achievement, and it put twenty-one of ninety-six chairs in
    Contender.
  */
  const title: CoachTitle =
    games === 0 ? 'Unproven'
    // --- what he won -------------------------------------------------------
    // Nine hundred games is about twenty seasons. Five hundred was eleven,
    // which is not a career anybody has forgotten the start of.
    : coach.titles >= 3 && games >= 900 ? 'Legend'
    : coach.titles >= 3 ? 'Dynasty'
    : coach.titles > 0 ? 'Champion'
    : coach.regionalTitles >= 3 ? 'Contender'
    // Went a long way often and never finished it.
    : coach.regionalTitles >= 1 && juneRuns >= 4 ? 'Nearly man'
    // Kept turning up in June without winning it, which is a career most
    // coaches would take.
    : juneRuns >= 2 ? 'Respected'
    // --- what shape it was -------------------------------------------------
    // Firefighter before Journeyman on purpose: both describe a man who has
    // moved, and *why* he moved is the more specific fact. Taking wrecks is a
    // choice; having had four jobs is what happened.
    : (coach.rebuilds ?? 0) >= 2 ? 'Firefighter'
    : stints >= 4 ? 'Journeyman'
    : (coach.bestBuild ?? 0) >= 12 ? 'Builder'
    : coach.tenure >= LIFER_TITLE ? 'Lifer'
    : games < 60 ? 'Rookie'
    /*
      And the honest default.

      This was 'Journeyman', which reproduced the exact fault the rewrite
      existed to fix: sixty of ninety-six chairs wearing one word, and the wrong
      one, since none of those men had moved anywhere. Most coaches have a long
      career and win nothing decisive. That is worth a name of its own rather
      than being filed under somebody else's.
    */
    : 'Career man';

  return { title, lifer: coach.tenure >= LIFER_SEASONS };
}

/** One line saying what the word means, for the coach page. */
export const TITLE_BLURB: Record<CoachTitle, string> = {
  Unproven: 'Has not coached a game.',
  Rookie: 'Early. Nothing has been decided yet.',
  'Career man': 'A long time in the job, and nothing yet that settles it.',
  Journeyman: 'Four programmes and counting. Somebody always needs a coach.',
  Firefighter: 'Takes the jobs nobody else will, and has done it twice.',
  Lifer: 'Has been at one place long enough that the place is partly his.',
  Builder: 'Left a programme considerably better than he found it.',
  Respected: 'Keeps reaching June. Has never won it, and is thought of well anyway.',
  'Nearly man': 'Has been close enough to touch it more than once.',
  Contender: 'Three regional banners. The last game is the only one left.',
  Champion: 'Won the country.',
  Dynasty: 'Won it three times. People plan around him.',
  Legend: 'Three titles and a career long enough that nobody remembers the start.',
};

export function newCoach(
  profile: CoachProfile = DEFAULT_PROFILE,
  contractLength = 4,
): CoachState {
  return {
    // Trimmed and floored here rather than trusted from the screen, because this
    // is also the door a loaded save and a test come through.
    name: profile.name.trim() || DEFAULT_PROFILE.name,
    age: clampAge(profile.age),
    homeState: profile.homeState.trim() || DEFAULT_PROFILE.homeState,
    look: normalizeLook(profile.look),
    philosophy: isPhilosophyId(profile.philosophy) ? profile.philosophy : DEFAULT_PHILOSOPHY,
    // A new coach is competent at nothing in particular.
    skills: { offense: 20, defense: 20, training: 20, recruiting: 20 },
    skillPoints: 0,
    contractYears: contractLength,
    contractLength,
    // An unknown quantity. You have to earn a job at a real program.
    prestige: ROOKIE_PRESTIGE,
    // Boards start patient. A first year is rarely a firing year.
    security: 62,
    tenure: 0,
    careerWins: 0,
    careerLosses: 0,
    titles: 0,
    conferenceTitles: 0,
    regionalTitles: 0,
    tournaments: 0,
    badRun: 0,
    // Overwritten the moment he is actually put in a chair, by `takeChair`.
    // Fifty is the middle of the scale and the honest answer to "we do not know
    // yet"; nothing reads it before a program has been chosen.
    arrivedPrestige: 50,
    achievements: {},
  };
}

/**
 * A coach placed in a chair, whoever's it is and however he got there.
 *
 * A new career, a job offer taken, and a coach loaded off a disk into a program
 * all have to agree about what arriving means: the board is patient again, the
 * tenure clock restarts, the deal is the one this program offers, and — the
 * reason this exists rather than being spelled out at each site — the prestige
 * the program had on the day he walked in is written down, because Builder is a
 * question about distance travelled and a number that has already moved cannot
 * answer it.
 *
 * The run of bad seasons is cleared here too, and the same clause in
 * `runCarousel` clears a rival's. A board hiring a man is by definition
 * unconvinced by the last one's read of him, and leaving the run on meant a
 * coach who took a rebuild after being sacked paid the whole accumulated
 * penalty for his first year in the new building — fourteen points, measured,
 * for a season the board he now works for was expecting. His prestige already
 * carries the damage; the run was the *board's* patience running out, and this
 * is a different board.
 */
export function takeChair(coach: CoachState, programPrestige: number): CoachState {
  const length = contractFor(programPrestige);
  /*
    What he left behind, banked before the new job overwrites it.

    `arrivedPrestige` is where the *current* programme stood when he walked in,
    so it is the only record of the last one and it is about to be replaced.
    Reading it here is the one moment a stint's worth can be measured, and a
    builder is exactly a man who has done this and left the place better.
  */
  const built = Math.max(coach.bestBuild ?? 0, 0);
  const REBUILD = 40;
  return {
    ...coach,
    tenure: 0,
    security: 62,
    badRun: 0,
    contractYears: length,
    contractLength: length,
    arrivedPrestige: programPrestige,
    stints: (coach.stints ?? 0) + 1,
    rebuilds: (coach.rebuilds ?? 0) + (programPrestige < REBUILD ? 1 : 0),
    bestBuild: built,
  };
}

/**
 * What a man did for the programme he is leaving.
 *
 * Called at the moment a career moves, with where the old chair stands now.
 * Kept separate from `takeChair` because leaving and arriving are two events
 * and only one of them knows what the last job became.
 */
export function bankStint(coach: CoachState, prestigeNow: number): CoachState {
  const gain = prestigeNow - coach.arrivedPrestige;
  return gain > (coach.bestBuild ?? 0) ? { ...coach, bestBuild: gain } : coach;
}

/**
 * A coach off the disk, brought up to the current shape.
 *
 * Every save written before the profile existed carries a name and nothing
 * else, so `coach.age` on those is `undefined` and every screen that shows it
 * renders a hole. Filling the gaps in one place means there is a single answer
 * to what an old career's coach looks like, rather than a different fallback at
 * each display site.
 *
 * The age is *not* clamped on the way in. A coach who has run programs for
 * twenty years is legitimately past the hiring range, and pulling him back to 68
 * every load would quietly cap the length of a career in the one number that is
 * supposed to record it.
 *
 * The portrait and the philosophy arrived later still and are filled the same
 * way. A coach whose career predates them gets the default face and a balanced
 * bench — which is what he has been playing as all along, since balanced is what
 * the world hands a team nobody has given an opinion to.
 */
export function restoreCoach(saved: unknown): CoachState {
  if (!saved || typeof saved !== 'object') return newCoach();
  const c = saved as Partial<CoachState>;
  return {
    ...newCoach(),
    ...c,
    name: typeof c.name === 'string' && c.name.trim() !== ''
      ? c.name.trim() : DEFAULT_PROFILE.name,
    age: typeof c.age === 'number' && Number.isFinite(c.age)
      ? Math.round(c.age) : DEFAULT_PROFILE.age,
    homeState: typeof c.homeState === 'string' && c.homeState.trim() !== ''
      ? c.homeState.trim() : DEFAULT_PROFILE.homeState,
    look: normalizeLook(c.look),
    philosophy: isPhilosophyId(c.philosophy) ? c.philosophy : DEFAULT_PHILOSOPHY,
    // Same rule as the face: a career that predates the ledger comes back with
    // an empty one rather than with `undefined`, which every reader would then
    // have to guard. Nothing is backdated — a coach cannot be handed Cinderella
    // for a title he won before the achievement existed, because the season
    // that would prove it is not written down in enough detail to check.
    achievements: restoreAchievements(c.achievements),
  };
}

const SECURITY_DELTA: Record<Verdict, number> = {
  exceeded: 20,
  met: 9,
  missed: -14,
  failed: -28,
};

/** A season the board did not accept. Both halves of it count the same here. */
export const isBadSeason = (v: Verdict): boolean => v === 'missed' || v === 'failed';

/**
 * What a run of bad seasons costs a reputation, over and above the season.
 *
 * Nothing for the first, because one bad year is variance and the ordinary
 * arithmetic in `nextCoachPrestige` has already priced it. The second is where
 * the sport stops giving a man the benefit of the doubt, and every one after
 * that hurts more than the last.
 *
 * Sized against the hiring ladder, which has rungs about fifteen points apart:
 * two bad years costs a third of a rung and four in a row costs the best part
 * of a whole one. A coach can survive a rebuild going wrong; a coach who is
 * simply not good enough falls out of the band that the good jobs recruit from,
 * which is what "he has stopped being a name" should actually mean.
 *
 * Deliberately **not** a second hit to job security. Security already fell
 * fourteen or twenty eight points for each of those seasons on its own, and
 * doubling the sacking pressure would mean a coach essentially never reaches a
 * third bad year — which would make the escalation below unreachable and leave
 * B5 as a rule that fires once and is never seen again.
 */
export function badRunPenalty(badRun: number): number {
  if (badRun < 2) return 0;
  return 5 + (badRun - 2) * 3;
}

/**
 * Personal standing moves on what you did *relative to the job*. Winning 20 games
 * at a powerhouse is expected; winning 20 at a cellar program is the reason
 * somebody better calls you. Overachievement is the whole signal.
 *
 * `badRun` is the run *including* the season being graded, so a coach handing in
 * his second poor year in a row arrives here with 2.
 */
export function nextCoachPrestige(
  coach: { prestige: number },
  o: SeasonOutcome,
  programPrestige: number,
  badRun = 0,
): number {
  const over = seasonScore(o) - programPrestige;
  let gain = over * 0.22;
  if (o.wonConference) gain += 4;
  if (o.reachedOmaha) gain += 6;
  if (o.wonTitle) gain += 12;

  // Reputation decays toward the middle when nothing happens, so a coach cannot
  // coast on one good year for a decade.
  const inertia = (45 - coach.prestige) * 0.04;
  return Math.max(5, Math.min(99, Math.round(
    coach.prestige + gain + inertia - badRunPenalty(badRun),
  )));
}

/**
 * What the board reads off a man, whoever he is.
 *
 * `CoachState` satisfies it and so does `RivalCoach` in `engine/rivals.ts`,
 * which is the entire reason one `reviewSeason` can grade ninety six careers.
 * Widening the parameter was chosen over assembling a fake `CoachState` around
 * each rival: the fake would have carried a face, a home state and a philosophy
 * invented purely to satisfy a type, and every one of those is a lie the next
 * reader has to check before he can trust the rest of the object.
 */
export interface Reviewable {
  prestige: number;
  security: number;
  tenure: number;
  contractYears: number;
  contractLength: number;
  badRun: number;
  /** Whether he was caught looking elsewhere this season. */
  caughtLooking?: boolean;
}

export interface Review {
  verdict: Verdict;
  expectation: Expectation;
  outcome: SeasonOutcome;
  prestigeBefore: number;
  prestigeAfter: number;
  coachPrestigeBefore: number;
  coachPrestigeAfter: number;
  securityBefore: number;
  securityAfter: number;
  /** Years left after this season is accounted for. */
  contractYears: number;
  /** The board tore up the old deal and offered a longer one. */
  extended: boolean;
  fired: boolean;
  /** Ran out the deal without convincing anyone. Not the same as being sacked. */
  notRenewed: boolean;
  /** Bad seasons in a row, this one included. Zero after any acceptable year. */
  badRun: number;
  /** What the run cost his standing on top of the season. Zero on the first. */
  prestigePenalty: number;
  message: string;
}

/**
 * The end of season meeting.
 *
 * Takes the narrow shape the board actually reads rather than a whole
 * `CoachState`, which is what lets the other ninety five programs be graded by
 * this function instead of by a copy of it — see `engine/rivals.ts`. Nothing in
 * here has ever wanted his face, his home state or his cabinet.
 *
 * `board` says who is sitting, and it is a parameter rather than a branch so
 * that the difference is stated at the call site instead of hidden in here.
 * Omitted — which is every call for the player — it is `playerBoard`, exactly
 * what this function always used.
 */
export function reviewSeason(
  coach: Reviewable,
  programPrestige: number,
  roster: number,
  outcome: SeasonOutcome,
  games: number,
  board: Board = playerBoard(programPrestige, roster, games),
): Review {
  const { expectation } = board;
  const verdict = judge(outcome, expectation);

  // The run, before anything is priced off it. One acceptable season wipes it
  // out entirely rather than decrementing it: a coach who missed twice and then
  // met the mandate has answered the question, and carrying half a pattern
  // forward would have him serving a sentence for a year that went fine.
  const badRun = isBadSeason(verdict) ? coach.badRun + 1 : 0;
  const prestigePenalty = badRunPenalty(badRun);

  const securityBefore = coach.security;
  // A first year gets some grace: boards fire the coach they hired last spring
  // only for something genuinely disastrous.
  const raw = SECURITY_DELTA[verdict];
  const delta = coach.tenure === 0 && raw < 0 ? raw / 2 : raw;
  const securityAfter = Math.max(0, Math.min(100, securityBefore + delta));

  /*
    Caught looking, and what it is actually worth.

    Being found out costs security the moment it happens, which on its own would
    make it a bad year rather than a last one -- and a risk that only ever
    produces a bad year is not a risk. So the board also raises its own bar: a
    man they already had doubts about does not get the benefit of them.

    Deliberately not an automatic sacking. A coach who has just won the country
    and put a feeler out has done something the board dislikes and nothing they
    are prepared to lose him over, which is both true to the sport and the
    reason the gamble is worth taking at all.
  */
  const bar = coach.caughtLooking ? SACK_BAR + 14 : SACK_BAR;
  const sacked = securityAfter < bar && coach.tenure >= 1;

  // A good year buys years. Boards extend the people they want to keep rather
  // than letting a deal run down and inviting somebody else to make an offer.
  const extended = !sacked && verdict === 'exceeded' && coach.contractYears <= 2;
  const remaining = Math.max(0, coach.contractYears - 1);
  const contractYears = extended ? coach.contractLength : remaining;

  // Out of contract and out of favour: they thank you and move on. The bar is
  // the board's own — twenty five points above the sacking line for the player,
  // and the sacking line itself for a rival, which is why this never fires for
  // one. See the seam.
  const notRenewed = !sacked && !extended && remaining === 0
    && securityAfter < board.renewAt;
  const fired = sacked || notRenewed;

  // A run says something a single season cannot, so it gets said. It goes
  // *before* the ordinary lines rather than after them because "twice in a row"
  // is the headline the moment it is true — the seat being warm is the same
  // sentence it was last year and reads as though nothing has changed.
  const run = badRun >= 2
    ? ` ${badRun === 2 ? 'Twice in a row now' : `${badRun} years running`}, and it is being noticed outside this room.`
    : '';

  const message = sacked
    ? 'The board has seen enough. You are relieved of your duties.'
    : notRenewed
      ? 'Your contract expires and the board has chosen not to renew it.'
      : extended
        ? `The board is delighted and has torn up your deal — ${coach.contractLength} more years.`
        : verdict === 'exceeded'
          ? 'The board is delighted. Nobody expected this.'
          : verdict === 'met'
            ? 'The board is satisfied. Do it again.'
            : verdict === 'missed'
              ? `The board expected more. ${contractYears} year${contractYears === 1 ? '' : 's'} left to convince them.${run}`
              : `The board is not happy. Your seat is warm.${run}`;

  return {
    verdict,
    expectation,
    outcome,
    prestigeBefore: programPrestige,
    prestigeAfter: nextPrestige(programPrestige, outcome),
    coachPrestigeBefore: coach.prestige,
    coachPrestigeAfter: nextCoachPrestige(coach, outcome, programPrestige, badRun),
    securityBefore,
    securityAfter,
    contractYears,
    extended,
    fired,
    notRenewed,
    badRun,
    prestigePenalty,
    message,
  };
}

// ---------------------------------------------------------------------------
// The carousel
// ---------------------------------------------------------------------------

export interface JobOffer {
  team: number;
  school: string;
  conference: string;
  prestige: number;
  /** Why they are calling you. */
  pitch: string;
}

/**
 * Which programs would have you.
 *
 * A school will not hire a coach well below its own standing, and a coach with
 * real standing will not be offered the bottom of the world. The band between
 * those two is where a career actually moves.
 */
export function jobOffers(
  coach: CoachState,
  teams: readonly TeamRecord[],
  prestigeOf: (t: TeamRecord) => number,
  currentTeam: number,
  limit = 4,
  /**
   * Whether this program would take the call.
   *
   * Not "is the chair empty" — the carousel never leaves one empty, so that
   * version of the rule produces a market of nothing and a career that ends on a
   * screen saying nobody rang. It is empty *or* held by somebody the country
   * rates below you, which is the same question a board actually asks.
   *
   * Optional, and the default of "everybody is hiring" is what this did before
   * the other ninety five programs had coaches in them. The store passes the
   * real answer; a test that only cares about the ladder does not have to build
   * a staffed world to ask about it.
   */
  isOpen: (t: TeamRecord) => boolean = () => true,
): JobOffer[] {
  const candidates = teams
    .filter((t) => t.index !== currentTeam && isOpen(t))
    .map((t) => ({ t, prestige: prestigeOf(t) }))
    // Same ladder the opening board uses, so the two can never disagree about
    // who would hire you. The lower bound is not a rule about them, it is about
    // you: a job far beneath where you already are is not an offer worth showing.
    .filter(({ t, prestige }) =>
      canBeHired(coach.prestige, prestige, t.def.quality)
      && prestige >= coach.prestige - 22)
    .sort((a, b) => b.prestige - a.prestige)
    .slice(0, limit);

  return candidates.map(({ t, prestige }) => ({
    team: t.index,
    school: t.def.school,
    conference: t.conference,
    prestige,
    pitch: prestige > coach.prestige
      ? 'A step up. They think you are ready.'
      : prestige > coach.prestige - 8
        ? 'A job at your level, with a board that will be patient.'
        : 'A rebuild. They will give you time because nobody else wants it.',
  }));
}

/**
 * The offers on a brand new coach's desk.
 *
 * The old creation screen printed all ninety six programs and let the player
 * discover, school by school, which ones would take his call. This is the other
 * way round: only the chairs that would genuinely ring a coach at rookie
 * prestige, chosen the way a market chooses — the best jobs he can actually
 * get, spread across the country rather than six seats in one league.
 *
 * Pure and deterministic: sorted on facts of the world with abbreviation as the
 * final tiebreak, no rng touched, so the same seed always produces the same
 * desk. At most two offers per conference, at most `limit` overall, and never
 * none — if a world somehow priced every chair above a rookie, the single
 * cheapest seat still calls, because a game that cannot be started is a bug and
 * not a difficulty setting.
 */
export interface OfferTaste {
  /** What kind of programme this man said he was. */
  leans?: Partial<Record<CultureEdge, number>>;
  /** Positive wants a demanding board, negative wants a patient one. */
  ambition?: number;
  /**
   * The wobble.
   *
   * Without it the desk is a pure function of the world, so the same seed hands
   * every coach who answered the same way an identical five — which makes a
   * replay feel like a repeat. Seeded rather than random, so a *given* career is
   * still fixed: reloading creation does not reshuffle the offers.
   */
  rng?: Rng;
}

export function startingOffers(
  teams: readonly TeamRecord[],
  limit = 5,
  taste: OfferTaste = {},
): number[] {
  /*
    What a programme makes of him, on top of what the ladder says.

    The ladder is still the gate — a rookie is not handed a blueblood because he
    said the right thing about the bunt. What culture does is decide which of
    the jobs he *could* get actually ring, and it is allowed to work in both
    directions: a school whose edge he shares will reach a little below its
    usual standing for him, and one he plainly does not fit will pass and give
    the seat to somebody else.
  */
  const fit = (t: TeamRecord): number => {
    const c = cultureOf(t.def.abbr);
    if (!c) return 0;
    const shared = taste.leans?.[c.edge] ?? 0;
    /*
      Whether they want the same thing, centred on zero.

      Written first as `2 - |difference|`, which was a bias rather than a
      match: every school scored positively and the *least* ambitious scored
      highest, so a neutral coach was quietly steered toward the quietest
      programmes in the country and one of them turned up on every desk.
      Centred at one, a genuine agreement is worth a point and a real mismatch
      costs one.
    */
    const theirs = (c.ambition - 50) / 25;
    const his = Math.max(-1.5, Math.min(1.5, (taste.ambition ?? 0) / 4));
    const appetite = 1 - Math.abs(theirs - his);
    return shared * 0.8 + appetite;
  };

  const eligible = teams
    .map((t) => ({ t, roster: rosterStrength(t.team), fit: fit(t) }))
    // The gate, softened by fit rather than opened by it. A strong match is
    // worth about three points of coach prestige, which moves a seat or two at
    // the margin and never lifts a rookie into a job the ladder refuses.
    .filter(({ t, roster, fit: f }) =>
      canBeHired(ROOKIE_PRESTIGE + Math.max(0, Math.min(3, f)), t.prestige, roster))
    .map((row) => ({
      ...row,
      // A little noise, deterministic per seed. Small enough that the good jobs
      // stay good and large enough that two careers differ.
      wobble: taste.rng ? taste.rng() * 8 - 4 : 0,
    }));

  /*
    Two kinds of offer, because a market has two kinds.

    One weighted sort could only ever favour prestige *or* culture, and the
    band a rookie can reach is narrow and clustered -- around eight points of
    prestige separating twenty schools. Turn the dial up and every offer
    matched, so the desk read as a filter; turn it down and the same five best
    jobs rang for everybody, so five answers changed nothing.

    So the desk is built in two halves. Some programmes ring because you are
    the best they can get. The others ring because you are specifically what
    they want -- and those are the seats that make the interview visible.
  */
  const byStanding = [...eligible].sort((a, b) =>
    (b.t.prestige + b.wobble) - (a.t.prestige + a.wobble)
    || b.roster - a.roster
    || a.t.def.abbr.localeCompare(b.t.def.abbr));

  const byWanting = [...eligible].sort((a, b) =>
    (b.fit * 6 + b.t.prestige * 0.4 + b.wobble) - (a.fit * 6 + a.t.prestige * 0.4 + a.wobble)
    || b.t.prestige - a.t.prestige
    || a.t.def.abbr.localeCompare(b.t.def.abbr));

  // Rather more than half want you specifically. A desk that was mostly "the
  // best job available" is the desk this replaced.
  const wantedSlots = Math.max(1, Math.round(limit * 0.6));
  const hireable: typeof eligible = [];
  const seen = new Set<number>();
  const perConference = new Map<string, number>();
  const take = (row: typeof eligible[number]): boolean => {
    if (seen.has(row.t.index)) return false;
    const used = perConference.get(row.t.conference) ?? 0;
    if (used >= 2) return false;
    perConference.set(row.t.conference, used + 1);
    seen.add(row.t.index);
    hireable.push(row);
    return true;
  };
  for (const row of byWanting) {
    if (hireable.length >= wantedSlots) break;
    take(row);
  }
  for (const row of byStanding) {
    if (hireable.length >= limit) break;
    take(row);
  }

  const out: number[] = hireable.map(({ t }) => t.index);

  if (out.length === 0) {
    // Should be unreachable — one-star bars sit at zero — but a new coach must
    // always have somewhere to start.
    const cheapest = [...teams].sort((a, b) =>
      requiredCoachPrestige(a.prestige, rosterStrength(a.team))
      - requiredCoachPrestige(b.prestige, rosterStrength(b.team))
      || a.def.abbr.localeCompare(b.def.abbr))[0];
    if (cheapest) out.push(cheapest.index);
  }
  return out;
}


/**
 * Why this programme is on the desk.
 *
 * The old line described the *rung* — a step up, a job at your level, a
 * rebuild — which is true and says nothing about the place. This says what they
 * think they are getting, which is the only reason culture is worth having.
 */
export function offerPitch(
  t: TeamRecord,
  taste: OfferTaste = {},
): string {
  const c = cultureOf(t.def.abbr);
  if (!c) return 'They have a chair and they would like it filled.';

  const shared = (taste.leans?.[c.edge] ?? 0) > 0;
  if (shared) {
    const why: Record<CultureEdge, string> = {
      development: 'They think you will build what they have rather than replace it.',
      pitching: 'They heard what you said about arms and liked it.',
      defense: 'They want somebody who counts outs, and you sounded like one.',
      power: 'They are not interested in a two-one win and neither, they think, are you.',
      loyalty: 'They are looking for somebody who intends to stay.',
      recruiting: 'They want a closer, and they think that is what you are.',
      tradition: 'They want somebody who will treat the place the way it expects.',
      ambition: 'They are in a hurry, and so, apparently, are you.',
    };
    return why[c.edge];
  }
  if (c.patience >= 70) return 'They are not in a rush, and they will tell you so twice.';
  if (c.ambition >= 80) return 'They expect a great deal and are not embarrassed about it.';
  if (t.prestige < 35) return 'Nobody established will take this, which is your opening.';
  return 'They have a chair and they think you might do.';
}

// ---------------------------------------------------------------------------
// Shooting your shot
// ---------------------------------------------------------------------------

/** How many feelers a coach may put out in one season. */
export const APPROACHES_PER_SEASON = 3;

export type ApproachOutcome =
  /** Nothing came of it. The common case, and it costs you nothing. */
  | 'ignored'
  /** They would take the call. The chair appears on your desk at the carousel. */
  | 'interested'
  /** Word got back. This is the one that can end a career. */
  | 'caught';

/**
 * Putting a feeler out to a programme that has not asked for you.
 *
 * Offers used to arrive only when you were sacked, which made a career
 * something that happened *to* a coach: you took what was offered or you took
 * nothing. This is the other half — going and asking — and the reason it is
 * worth having is that it is genuinely dangerous.
 *
 * Three things decide it, and culture is one of them by design. A programme
 * that prizes tradition takes a dim view of being approached at all and is the
 * likeliest to mention it to somebody; a programme that wants exactly what you
 * are is the likeliest to listen. So the schools most worth approaching are
 * often the ones most likely to talk, which is the decision.
 *
 * Pure and seeded. The caller owns the generator, so an approach cannot be
 * re-rolled by reloading.
 */
export function approachSchool(
  coach: Pick<CoachState, 'prestige' | 'security' | 'leans'>,
  target: TeamRecord,
  rng: Rng,
): ApproachOutcome {
  const culture = cultureOf(target.def.abbr);
  const roster = rosterStrength(target.team);

  // Whether they could plausibly hire you at all. Approaching a blueblood as a
  // one-star coach is not a gamble, it is a letter nobody opens -- but it can
  // still be overheard, which is the point.
  const plausible = canBeHired(coach.prestige, target.prestige, roster);

  const shared = culture ? (coach.leans?.[culture.edge] ?? 0) : 0;
  // Tradition is the resented-approach axis. A place that has done things one
  // way for a century does not enjoy being written to by a man under contract
  // somewhere else.
  const proud = culture?.edge === 'tradition' ? 1 : 0;
  const patience = culture ? culture.patience / 100 : 0.5;

  /*
    Interest, and then the risk, in that order.

    Deliberately not a single roll with three outcomes: being heard and being
    listened to are different events, and a school can be both interested *and*
    indiscreet. Rolling them separately is what allows the worst case -- they
    want you, and they told somebody.
  */
  const interest = plausible
    ? Math.min(0.55, 0.12 + shared * 0.05 + (target.coach ? 0 : 0.15))
    : 0.02;

  // A proud programme is roughly twice as likely to mention it. A patient one
  // is a little less likely -- boards that do not panic do not gossip either.
  const risk = Math.min(0.5, 0.14 + proud * 0.14 - patience * 0.08);

  if (rng() < interest) return 'interested';
  return rng() < risk ? 'caught' : 'ignored';
}

/** What being found out costs, before the board has said anything. */
export const CAUGHT_SECURITY_COST = 22;
