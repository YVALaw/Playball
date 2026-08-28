// interviewResult.ts
// Turning five answers into a coach.
//
// Pure, deterministic, and knows nothing about screens. Given a seed and a set
// of answers it produces the same coach every time, which is what lets the
// creation screen be a thin thing that draws the result rather than a place
// where the rules quietly live.
//
// Two jobs:
//
//   `drawQuestions`  picks the five, seeded, so a replay of the same dynasty
//                    asks the same things and a new one almost never does.
//
//   `settle`         adds the answers up: the four skills, the leanings that
//                    decide who calls, the two badges, and anything granted.

import { INTERVIEW, type InterviewAnswer, type InterviewQuestion } from '../data/interview.js';
import type { CultureEdge } from '../data/cultures.js';
import type { CoachSkills } from './program.js';
import type { Rng } from './types.js';

/** How many a coach is asked. */
export const ASKED = 5;
/** And in casual, where five questions is a slow start for somebody who
    chose the shorter game. Two is enough to leave with an identity. */
export const ASKED_CASUAL = 2;

export interface InterviewOutcome {
  /** Added to the coach's starting skills. Never below zero once applied. */
  skills: CoachSkills;
  /** What kind of programme warms to this man. Feeds the offer draw. */
  leans: Partial<Record<CultureEdge, number>>;
  /** Positive wants a demanding board, negative wants a patient one. */
  ambition: number;
  /** The two he wears out of creation. */
  badges: string[];
  /** Anything that was not a skill. */
  grants: string[];
}

/**
 * Which questions a man is asked.
 *
 * Seeded rather than random so the draw is part of the world: reloading a save
 * does not reroll the interview, and two dynasties on the same seed with the
 * same coach are genuinely the same career. `context` narrows the pool before
 * the draw, which is what makes the five feel addressed to him rather than
 * dealt off the top.
 */
export function drawQuestions(
  rng: Rng,
  count = ASKED,
  context: { age?: number; warm?: boolean } = {},
): InterviewQuestion[] {
  const fits = (q: InterviewQuestion): boolean => {
    const when = q.when ?? 'any';
    if (when === 'any') return true;
    if (when === 'young') return (context.age ?? 40) < 38;
    if (when === 'old') return (context.age ?? 40) >= 52;
    if (when === 'warm') return context.warm === true;
    if (when === 'cold') return context.warm === false;
    return true;
  };

  // Fisher–Yates over the eligible pool, taking the first `count`. Drawing
  // without replacement matters: being asked the same question twice in one
  // interview would read as a bug rather than as chance.
  const pool = INTERVIEW.filter(fits);
  const order = pool.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order.slice(0, Math.min(count, pool.length)).map((i) => pool[i]!);
}

/**
 * What five answers add up to.
 *
 * The badges are the interesting part: an answer casts a *vote* rather than
 * awarding anything, and the two most-voted are worn. That is what makes the
 * interview describe a man rather than list his purchases — five answers that
 * all lean the same way produce a coach who is obviously one thing, and five
 * that scatter produce one who is harder to summarise, which is also true of
 * people.
 *
 * Ties break on the order the badge was first voted for, so the result is
 * deterministic without needing the generator.
 */
export function settle(
  answers: readonly InterviewAnswer[],
  base: CoachSkills,
): InterviewOutcome {
  const skills: CoachSkills = { ...base };
  const leans: Partial<Record<CultureEdge, number>> = {};
  const votes = new Map<string, { n: number; first: number }>();
  const grants: string[] = [];
  let ambition = 0;

  answers.forEach((a, i) => {
    for (const k of Object.keys(a.skills) as (keyof CoachSkills)[]) {
      skills[k] += a.skills[k] ?? 0;
    }
    for (const [edge, n] of Object.entries(a.leans ?? {}) as [CultureEdge, number][]) {
      leans[edge] = (leans[edge] ?? 0) + n;
    }
    ambition += a.ambition ?? 0;
    if (a.grant) grants.push(a.grant);
    if (a.badge) {
      const v = votes.get(a.badge);
      if (v) v.n += 1;
      else votes.set(a.badge, { n: 1, first: i });
    }
  });

  // An answer may cost a skill, so a run of them could in principle take one
  // under zero. A negative coach skill is not a thing the rest of the game
  // knows how to read.
  for (const k of Object.keys(skills) as (keyof CoachSkills)[]) {
    skills[k] = Math.max(0, skills[k]);
  }

  const badges = [...votes.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first)
    .slice(0, 2)
    .map(([id]) => id);

  return { skills, leans, ambition, badges, grants };
}

/**
 * How much a programme likes the look of him.
 *
 * Positive means they want him more than his record alone says; negative means
 * they would rather somebody else. Small numbers on purpose — culture decides
 * *which* of the jobs he could get actually ring, and it is not allowed to hand
 * a rookie a blueblood.
 */
export function cultureFit(
  leans: Partial<Record<CultureEdge, number>>,
  edge: CultureEdge,
  schoolAmbition: number,
  coachAmbition: number,
): number {
  const shared = leans[edge] ?? 0;
  // Wanting Omaha at a place that wants Omaha is worth something; wanting it at
  // a place that would rather have a good crowd and a winning season is not.
  const appetite = 1 - Math.abs((schoolAmbition - 50) / 50 - coachAmbition / 6);
  return shared + appetite;
}
