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

import { overallOf } from './ratings.js';
import { FIRST, LAST } from '../data/names.js';
import { ALL_STATES } from '../data/schools.js';
import { DEFAULT_PHILOSOPHY, isPhilosophyId, type PhilosophyId } from './strategy.js';
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
  | 'topHalf' | 'topThree' | 'conferenceTitle'
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
  /** The actual checklist. `judge` reads this and nothing else. */
  objectives: Objective[];
  expectsTournament: boolean;
  expectsConference: boolean;
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
 * **Placement objectives are zero-sum and have to be spent carefully.** Only
 * four of eight teams can finish in the top half, so requiring it of more than
 * half the league guarantees mass failure no matter how well anyone plays. The
 * first draft of this list demanded a top-half finish from rebuilding programs —
 * teams that are weak *by definition*, since that is what earns the mandate —
 * and 73% of them failed their review. A board that asks for the arithmetically
 * impossible is not a hard board, it is a broken one.
 *
 * So placement is required only where the roster justifies it, and the ask
 * climbs with the mandate: stay out of the cellar, then finish above .500, then
 * top half, then top three.
 */
export function objectivesFor(mandate: Mandate, targetWins: number): Objective[] {
  const wins: Objective = {
    key: 'wins', label: `Win ${targetWins} games`, required: true, target: targetWins,
  };
  const stretch: Objective = {
    key: 'stretchWins', label: `Win ${targetWins + 4} — ahead of schedule`,
    required: false, target: targetWins + 4,
  };
  const bid = (required: boolean): Objective =>
    ({ key: 'tournament', label: 'Reach the national tournament', required });
  const omaha = (required: boolean): Objective =>
    ({ key: 'omaha', label: 'Reach Omaha', required });
  const confTitle = (required: boolean): Objective =>
    ({ key: 'conferenceTitle', label: 'Win the conference', required });

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
      return [
        wins,
        { key: 'topHalf', label: 'Finish in the top half of the conference', required: true },
        bid(true), confTitle(false), omaha(false),
      ];
    case 'championship':
      return [
        wins,
        { key: 'topThree', label: 'Finish top three in the conference', required: true },
        bid(true),
        confTitle(false), omaha(false),
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

  const expectsTournament = mandate === 'championship' || mandate === 'contend';
  const expectsConference = mandate === 'championship';

  const summary = {
    championship: 'Omaha. This roster is good enough and the board knows it.',
    contend: `Win the conference and reach the tournament. ${targetWins} wins is the floor.`,
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
    expectsTournament, expectsConference,
  };
}

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
  tournaments: number;
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
 * Prestige carries most of it because prestige is already the number that moves
 * on overachievement and decays when nothing happens, which is exactly the
 * behaviour a reputation should have. The trophies act as floors on top of it:
 * a national champion is never introduced as a journeyman, however the last two
 * seasons went.
 */
export type CoachTitle =
  | 'Unproven' | 'Journeyman' | 'Respected' | 'Established' | 'Renowned' | 'Legendary';

/**
 * Fifteen years in one chair.
 *
 * Kept apart from the ladder rather than sitting on top of it, because it is
 * the one thing here earned by staying instead of winning, and a bad run should
 * not be able to take it away. It reads alongside the title — RENOWNED · LIFER —
 * so a long tenure survives a reputation that has slipped.
 */
export const LIFER_SEASONS = 15;

export interface CoachStanding {
  title: CoachTitle;
  /** True once he has spent {@link LIFER_SEASONS} at the current job. */
  lifer: boolean;
}

export function coachStanding(coach: CoachState): CoachStanding {
  const games = coach.careerWins + coach.careerLosses;
  const winPct = games === 0 ? 0 : coach.careerWins / games;

  // A trophy is a floor, not a bonus. Whatever prestige says this month, the
  // man who won it does not drop below the rung it bought.
  let floor: CoachTitle = 'Unproven';
  if (coach.titles > 0) floor = 'Legendary';
  else if (coach.conferenceTitles > 0 || coach.tournaments >= 3) floor = 'Established';
  else if (coach.tournaments > 0) floor = 'Respected';
  else if (games > 0) floor = 'Journeyman';

  // And the ladder itself, which can lift him above that floor but never below.
  const earned: CoachTitle =
    coach.prestige >= 80 && coach.titles > 0 ? 'Legendary'
    : coach.prestige >= 68 ? 'Renowned'
    : coach.prestige >= 55 ? 'Established'
    : coach.prestige >= 42 || winPct > 0.55 ? 'Respected'
    : games > 0 ? 'Journeyman'
    : 'Unproven';

  const ORDER: CoachTitle[] =
    ['Unproven', 'Journeyman', 'Respected', 'Established', 'Renowned', 'Legendary'];
  const title = ORDER.indexOf(earned) >= ORDER.indexOf(floor) ? earned : floor;

  return { title, lifer: coach.tenure >= LIFER_SEASONS };
}

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
    tournaments: 0,
  };
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
  };
}

const SECURITY_DELTA: Record<Verdict, number> = {
  exceeded: 20,
  met: 9,
  missed: -14,
  failed: -28,
};

/**
 * Personal standing moves on what you did *relative to the job*. Winning 20 games
 * at a powerhouse is expected; winning 20 at a cellar program is the reason
 * somebody better calls you. Overachievement is the whole signal.
 */
export function nextCoachPrestige(
  coach: CoachState,
  o: SeasonOutcome,
  programPrestige: number,
): number {
  const over = seasonScore(o) - programPrestige;
  let gain = over * 0.22;
  if (o.wonConference) gain += 4;
  if (o.reachedOmaha) gain += 6;
  if (o.wonTitle) gain += 12;

  // Reputation decays toward the middle when nothing happens, so a coach cannot
  // coast on one good year for a decade.
  const inertia = (45 - coach.prestige) * 0.04;
  return Math.max(5, Math.min(99, Math.round(coach.prestige + gain + inertia)));
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
  message: string;
}

/** The end of season meeting. */
export function reviewSeason(
  coach: CoachState,
  programPrestige: number,
  roster: number,
  outcome: SeasonOutcome,
  games: number,
): Review {
  const expectation = expectationFor(programPrestige, roster, games);
  const verdict = judge(outcome, expectation);

  const securityBefore = coach.security;
  // A first year gets some grace: boards fire the coach they hired last spring
  // only for something genuinely disastrous.
  const raw = SECURITY_DELTA[verdict];
  const delta = coach.tenure === 0 && raw < 0 ? raw / 2 : raw;
  const securityAfter = Math.max(0, Math.min(100, securityBefore + delta));

  const sacked = securityAfter < 20 && coach.tenure >= 1;

  // A good year buys years. Boards extend the people they want to keep rather
  // than letting a deal run down and inviting somebody else to make an offer.
  const extended = !sacked && verdict === 'exceeded' && coach.contractYears <= 2;
  const remaining = Math.max(0, coach.contractYears - 1);
  const contractYears = extended ? coach.contractLength : remaining;

  // Out of contract and out of favour: they thank you and move on.
  const notRenewed = !sacked && !extended && remaining === 0 && securityAfter < 45;
  const fired = sacked || notRenewed;

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
              ? `The board expected more. ${contractYears} year${contractYears === 1 ? '' : 's'} left to convince them.`
              : 'The board is not happy. Your seat is warm.';

  return {
    verdict,
    expectation,
    outcome,
    prestigeBefore: programPrestige,
    prestigeAfter: nextPrestige(programPrestige, outcome),
    coachPrestigeBefore: coach.prestige,
    coachPrestigeAfter: nextCoachPrestige(coach, outcome, programPrestige),
    securityBefore,
    securityAfter,
    contractYears,
    extended,
    fired,
    notRenewed,
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
): JobOffer[] {
  const candidates = teams
    .filter((t) => t.index !== currentTeam)
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
