// interview.ts
// Five questions, and the eighty they come from.
//
// Nobody picks "recruiting 40". Everybody has an opinion about the bunt — so the
// coach you play is built out of opinions rather than sliders, and the four
// skills fall out of what you said rather than being dialled in.
//
// ---------------------------------------------------------------------------
// The voice
// ---------------------------------------------------------------------------
//
// Deadpan, with a straight man. The humour lives in the situation and in the one
// answer that is too clever by half — never in a joke being told, because a joke
// read four times is worse than a line that was never trying to be funny. Nobody
// winks. The man asking is not amused and not unkind.
//
// ---------------------------------------------------------------------------
// What an answer does
// ---------------------------------------------------------------------------
//
// Three things, and it is the second that makes this stage matter:
//
//   `skills`  moves the four coach skills. Sums to +2, and it may contain a
//             negative — a coach who spent four years learning to recruit spent
//             them not learning something else, and an answer where every option
//             is a gift is an answer with no decision in it.
//
//   `leans`   what kind of programme likes this. Matched against school culture
//             when the offers are drawn, which is how "what you said" becomes
//             "who called".
//
//   `grant`   rarely, something that is not a skill: a little starting prestige,
//             a longer first contract, a recruiting pipeline into your home
//             state.
//
// Plus `badge`, which is a vote rather than an award: the two badges a coach
// leaves creation with are the two most voted for across his five answers.
//
// ---------------------------------------------------------------------------
// It cannot be failed
// ---------------------------------------------------------------------------
//
// No answer is wrong and no answer is rejected. Every one changes *which*
// programmes want you, never whether any of them do. That is what lets the
// questions be about character instead of about being correct.

import type { CoachSkills } from '../engine/program.js';
import type { CultureEdge } from './cultures.js';

/** Something an answer can hand you that is not a skill point. */
export type Grant = 'prestige' | 'contract' | 'pipeline';

export interface InterviewAnswer {
  /** What the coach says. First person, no quotation marks. */
  readonly text: string;
  /** Net +2 across the four, negatives allowed. */
  readonly skills: Partial<CoachSkills>;
  /** Which kinds of programme warm to this, and by how much. */
  readonly leans?: Partial<Record<CultureEdge, number>>;
  /** Toward a patient board (negative) or a demanding one (positive). */
  readonly ambition?: number;
  /** A vote for a badge. Two most-voted are worn. */
  readonly badge?: string;
  readonly grant?: Grant;
}

export interface InterviewQuestion {
  readonly id: string;
  /** The situation, in two or three lines. The straight man sets it up. */
  readonly setup: string;
  /** The question itself. */
  readonly ask: string;
  readonly answers: readonly InterviewAnswer[];
  /**
   * When this may be asked.
   *
   * Most are `any`. The rest exist so the five a player gets have some sense of
   * being addressed to *him*: an old coach is asked different things than a
   * young one, and a man from the deep south is asked about the heat.
   */
  readonly when?: 'any' | 'young' | 'old' | 'warm' | 'cold';
}

/*
  The pool.

  Eighty is the target and the reason is replay: five drawn from eighty means
  two careers share about one question, so repetition stops being noticeable
  well past a fourth dynasty. What is here is the first tranche, written to
  settle the voice and the shape before the rest is committed to it.
*/
export const INTERVIEW: readonly InterviewQuestion[] = [
  {
    id: 'bunt-down-one',
    setup: 'Down one in the ninth. Man on first, nobody out.\nYour best hitter is up. Your fastest man is on the bench.',
    ask: 'What happens?',
    answers: [
      {
        text: 'Bunt him over. A run is a run.',
        skills: { defense: 2 },
        leans: { defense: 2, tradition: 1 },
        ambition: -1, badge: 'grinder',
      },
      {
        text: 'He swings. He is my best hitter for a reason.',
        skills: { offense: 2 },
        leans: { power: 2, ambition: 1 },
        ambition: 1, badge: 'slugger',
      },
      {
        text: 'Pinch run first. Worry about the bat after.',
        skills: { offense: 1, defense: 1 },
        leans: { ambition: 2 },
        badge: 'gambler',
      },
      {
        text: 'I would have used the fast man in the eighth.',
        skills: { training: 2, offense: -1, recruiting: 1 },
        leans: { development: 2, defense: 1 },
        badge: 'grinder',
      },
    ],
  },
  {
    id: 'build-or-buy',
    setup: 'Two men are available in the same week.\nOne is ready now and will be gone in two years.\nThe other is nineteen months from being anything at all.',
    ask: 'Which one do you sign?',
    answers: [
      {
        text: 'The one who is ready. I am judged on Junes, not on projects.',
        skills: { recruiting: 2 },
        leans: { recruiting: 2, ambition: 1 },
        ambition: 2, badge: 'closer',
      },
      {
        text: 'The project. I would rather build one than buy one.',
        skills: { training: 2 },
        leans: { development: 3 },
        ambition: -1, badge: 'developer',
      },
      {
        text: 'Whichever one wants to be here in four years.',
        skills: { training: 1, recruiting: 1 },
        leans: { loyalty: 3 },
        badge: 'keeper',
      },
      {
        text: 'I sign both and let them work it out on the field.',
        skills: { recruiting: 3, training: -1 },
        leans: { recruiting: 2, ambition: 1 },
        ambition: 1, badge: 'closer',
      },
    ],
  },
  {
    id: 'the-veteran',
    setup: 'A senior who has started three years is now the fourth best\noption at his position. He knows it. He has not said anything.',
    ask: 'What do you do?',
    answers: [
      {
        text: 'He starts. You do not take that off a man in his last year.',
        skills: { training: 1, defense: 1 },
        leans: { loyalty: 3, tradition: 1 },
        ambition: -1, badge: 'players',
      },
      {
        text: 'He sits, and I tell him myself before he hears it.',
        skills: { offense: 1, training: 1 },
        leans: { development: 2, ambition: 1 },
        badge: 'players',
      },
      {
        text: 'He sits. The lineup is not a reward for service.',
        skills: { offense: 2 },
        leans: { ambition: 3 },
        ambition: 2, badge: 'hardnosed',
      },
      {
        text: 'He plays the position he can still play, not the one he had.',
        skills: { defense: 2 },
        leans: { development: 2, defense: 1 },
        badge: 'developer',
      },
    ],
  },
  {
    id: 'the-arm',
    setup: 'Eighty-nine pitches, one-run lead, seventh inning.\nHe has retired six in a row and his velocity is down two.',
    ask: 'Is he out?',
    answers: [
      {
        text: 'He is out. The number is the number.',
        skills: { defense: 2 },
        leans: { pitching: 2, development: 1 },
        badge: 'methodical',
      },
      {
        text: 'He finishes the inning. He has earned that much.',
        skills: { offense: 1, training: 1 },
        leans: { loyalty: 2, tradition: 1 },
        badge: 'players',
      },
      {
        text: 'I go and ask him, and I believe what his face says.',
        skills: { training: 2 },
        leans: { development: 2, pitching: 1 },
        badge: 'armsman',
      },
      {
        text: 'He is out, and he was out at eighty.',
        skills: { defense: 1, training: 1 },
        leans: { pitching: 3 },
        badge: 'armsman',
      },
    ],
  },
  {
    id: 'the-budget',
    setup: 'You have enough for one thing this year.\nThe hitting facility is twenty years old. The bullpen has\nno indoor mound. The scouting budget has not moved since 2019.',
    ask: 'Where does it go?',
    answers: [
      {
        text: 'The cages. Every man on the roster uses them every day.',
        skills: { offense: 1, training: 1 },
        leans: { development: 2, power: 1 },
        badge: 'developer',
      },
      {
        text: 'The mound. Arms are the only thing I cannot manufacture.',
        skills: { defense: 1, training: 1 },
        leans: { pitching: 3 },
        badge: 'armsman',
      },
      {
        text: 'Scouting. I would rather see them early than fix them late.',
        skills: { recruiting: 2 },
        leans: { recruiting: 3 },
        badge: 'closer',
      },
      {
        text: 'None of it. I put it toward the men who are already here.',
        skills: { training: 2, recruiting: -1, offense: 1 },
        leans: { loyalty: 2, development: 1 },
        badge: 'keeper',
      },
    ],
  },
  {
    id: 'the-loss',
    setup: 'You have lost four in a row. The dugout is quiet in a way\nyou do not like. Somebody has to say something.',
    ask: 'What is it?',
    answers: [
      {
        text: 'That it is on me, and that I will fix it.',
        skills: { training: 2 },
        leans: { loyalty: 2, development: 1 },
        badge: 'players',
      },
      {
        text: 'Nothing. They are grown men and they know.',
        skills: { defense: 1, offense: 1 },
        leans: { tradition: 2 },
        badge: 'hardnosed',
      },
      {
        text: 'That we are going to run until somebody remembers how.',
        skills: { defense: 2, offense: -1, training: 1 },
        leans: { defense: 2, ambition: 1 },
        ambition: 1, badge: 'hardnosed',
      },
      {
        text: 'One thing each, quietly, to four different men.',
        skills: { training: 1, recruiting: 1 },
        leans: { development: 2, loyalty: 1 },
        badge: 'players',
      },
    ],
  },
  {
    id: 'the-transfer',
    setup: 'Your best returning bat has been called by a bigger school.\nHe has not asked to leave. He has also not said no.',
    ask: 'How does that conversation go?',
    answers: [
      {
        text: 'I tell him what he is worth here and let him decide.',
        skills: { recruiting: 1, training: 1 },
        leans: { loyalty: 2, development: 1 },
        badge: 'keeper',
      },
      {
        text: 'I tell him to go, and I mean it.',
        skills: { training: 2 },
        leans: { development: 2, tradition: 1 },
        ambition: -1, badge: 'players',
      },
      {
        text: 'I have already called the man who would replace him.',
        skills: { recruiting: 3, training: -1 },
        leans: { recruiting: 3 },
        ambition: 1, badge: 'closer',
      },
      {
        text: 'I ask him what the other school promised, and I beat it.',
        skills: { recruiting: 2 },
        leans: { recruiting: 2, ambition: 1 },
        ambition: 1, badge: 'closer',
      },
    ],
  },
  {
    id: 'the-record',
    setup: 'Your predecessor went 31-24 and was sacked.\nThe man before him went 22-33 and was given a fourth year.',
    ask: 'What does that tell you about this job?',
    answers: [
      {
        text: 'That the record is not the thing they are counting.',
        skills: { recruiting: 1, training: 1 },
        leans: { tradition: 2, loyalty: 1 },
        badge: 'traditionalist',
      },
      {
        text: 'That somebody upstairs liked one of them.',
        skills: { recruiting: 2 },
        leans: { recruiting: 1, ambition: 1 },
        badge: 'closer',
      },
      {
        text: 'Nothing I can use. I will be judged on my own.',
        skills: { offense: 1, defense: 1 },
        leans: { ambition: 2 },
        ambition: 2, badge: 'hardnosed',
      },
      {
        text: 'That I should ask what the fourth year was for.',
        skills: { training: 2 },
        leans: { development: 2, tradition: 1 },
        badge: 'developer',
      },
    ],
  },
];
