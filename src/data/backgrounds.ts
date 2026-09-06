// backgrounds.ts
// The four careers a coach can have had before the dugout.
//
// Step three of creation is a background, not a personality quiz: the
// five-question situational interview was cut on September 6 2026 by the
// reporter ("it felt long and unnecessary"), and these four cards are what
// replaced it. Each is fiction and mechanics at once — a kicker, a line, and
// the four year-one numbers, the culture leans and the badge it grants —
// and the four sum to the same total, so none of them is the correct pick.
// Data, not screen, so the shape can be tested and so god mode (stage 17)
// can reach it.

import type { CoachSkills } from '../engine/program.js';
import type { CultureEdge } from './cultures.js';

export type BackgroundId = 'player' | 'recruiter' | 'hitting' | 'pitching';

export interface CoachBackground {
  id: BackgroundId;
  title: string;
  kicker: string;
  blurb: string;
  skills: CoachSkills;
  leans: Partial<Record<CultureEdge, number>>;
  ambition: number;
  badges: string[];
}

/**
 * Step three is a background, not a personality quiz.
 *
 * The old interview asked three situations and then translated the answers into
 * the same four numbers shown below. That was a lot of reading before the first
 * pitch for a result the player could not predict. A background is both fiction
 * and mechanics at once: choose the career the coach had before the dugout and
 * see exactly which tools he brings into year one.
 */
export const BACKGROUNDS: readonly CoachBackground[] = [
  {
    id: 'player', title: 'Former player', kicker: 'CLUBHOUSE',
    blurb: 'Played the game, reads people quickly, and starts with a balanced feel for both sides of the ball.',
    skills: { offense: 23, defense: 23, training: 24, recruiting: 20 },
    leans: { loyalty: 2, tradition: 1, development: 1 }, ambition: 0,
    badges: ['players'],
  },
  {
    id: 'recruiter', title: 'Recruiter', kicker: 'THE ROAD',
    blurb: 'Built his name in living rooms and summer parks. The opening class is where he has the clearest edge.',
    skills: { offense: 20, defense: 20, training: 22, recruiting: 28 },
    leans: { recruiting: 3, ambition: 1 }, ambition: 1,
    badges: ['closer'],
  },
  {
    id: 'hitting', title: 'Hitting guru', kicker: 'THE CAGES',
    blurb: 'An offensive teacher first. Bats develop faster under his eye, but the mound is not where he made his name.',
    skills: { offense: 28, defense: 19, training: 23, recruiting: 20 },
    leans: { power: 3, development: 1 }, ambition: 1,
    badges: ['slugger'],
  },
  {
    id: 'pitching', title: 'Pitching guru', kicker: 'THE MOUND',
    blurb: 'Built staffs before he built lineups. Arms and run prevention are his strongest tools from day one.',
    skills: { offense: 19, defense: 28, training: 23, recruiting: 20 },
    leans: { pitching: 3, development: 1 }, ambition: 0,
    badges: ['armsman'],
  },
];
