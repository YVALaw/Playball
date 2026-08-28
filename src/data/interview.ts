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
  {
    id: 'steal-down-three',
    setup: 'Down three in the eighth. Your fastest man is on first\nwith nobody out and the top of the order coming.',
    ask: 'Is he going?',
    answers: [
      { text: 'No. You do not make the first out at second down three.', skills: { defense: 2 }, leans: { defense: 2, tradition: 1 }, ambition: -1, badge: 'grinder' },
      { text: 'He is going. He is going most of the time.', skills: { offense: 2 }, leans: { ambition: 2 }, ambition: 1, badge: 'gambler' },
      { text: 'Only if the catcher has shown me something.', skills: { defense: 1, recruiting: 1 }, leans: { defense: 2, development: 1 }, badge: 'methodical' },
      { text: 'He decides. That is what I recruited him for.', skills: { training: 2 }, leans: { development: 2, loyalty: 1 }, badge: 'players' },
    ],
  },
  {
    id: 'the-walk-on',
    setup: 'A walk-on nobody has heard of has outplayed a signed\nfreshman for six weeks of fall ball. It is not close.',
    ask: 'Who opens the season at that position?',
    answers: [
      { text: 'The walk-on. The fall is what the fall is for.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'The freshman. He was signed for a reason and it is February.', skills: { recruiting: 2 }, leans: { recruiting: 2, tradition: 1 }, badge: 'closer' },
      { text: 'The walk-on, and I tell the freshman exactly why.', skills: { training: 1, offense: 1 }, leans: { development: 2, loyalty: 1 }, badge: 'players' },
      { text: 'Whoever is still ahead in April. Fall ball is not a season.', skills: { defense: 2 }, leans: { defense: 1, development: 1 }, badge: 'methodical' },
    ],
  },
  {
    id: 'the-curfew',
    setup: 'Two men broke curfew the night before a regional.\nOne of them is your closer.',
    ask: 'What happens to them?',
    answers: [
      { text: 'Both sit. It is not a rule if it bends for the closer.', skills: { defense: 2 }, leans: { tradition: 3 }, badge: 'hardnosed' },
      { text: 'Both play, and both run until they are sick on Monday.', skills: { offense: 1, training: 1 }, leans: { ambition: 2 }, ambition: 1, badge: 'hardnosed' },
      { text: 'They tell the room themselves. Then I decide.', skills: { training: 2 }, leans: { loyalty: 2, development: 1 }, badge: 'players' },
      { text: 'Nothing today. We are playing a regional today.', skills: { offense: 2 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
    ],
  },
  {
    id: 'the-grades',
    setup: 'Your best arm is one exam away from being ineligible.\nHe has known this for six weeks and told nobody.',
    ask: 'Where does the problem sit?',
    answers: [
      { text: 'With me. I should have known six weeks ago.', skills: { training: 2 }, leans: { development: 2, loyalty: 1 }, badge: 'players' },
      { text: 'With him. He is twenty and it is one exam.', skills: { defense: 2 }, leans: { tradition: 2 }, badge: 'hardnosed' },
      { text: 'With whoever recruited a man who hides things.', skills: { recruiting: 2 }, leans: { recruiting: 2, loyalty: 1 }, badge: 'closer' },
      { text: 'Nowhere yet. Somebody sits with him tonight and it gets fixed.', skills: { training: 1, defense: 1 }, leans: { development: 2, loyalty: 2 }, badge: 'keeper' },
    ],
  },
  {
    id: 'the-rival',
    setup: 'The rivalry is Friday. A regional seed is on the line Sunday.\nYour ace can start one of them properly.',
    ask: 'Which one?',
    answers: [
      { text: 'Friday. Ask anybody in this town which game matters.', skills: { recruiting: 2 }, leans: { tradition: 3 }, badge: 'traditionalist' },
      { text: 'Sunday. The seed is worth three of Friday.', skills: { defense: 1, offense: 1 }, leans: { ambition: 3 }, ambition: 2, badge: 'methodical' },
      { text: 'Friday, three innings, and Sunday on short rest.', skills: { offense: 2, training: -1, defense: 1 }, leans: { ambition: 2, pitching: -1 }, ambition: 1, badge: 'gambler' },
      { text: 'Neither. Somebody else is ready and this is how we find out.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
    ],
  },
  {
    id: 'the-crowd',
    setup: 'Your own crowd has started booing a freshman shortstop.\nHe has made two errors and it is April.',
    ask: 'What do you do about it?',
    answers: [
      { text: 'He stays out there. He comes off when I say, not when they do.', skills: { training: 2 }, leans: { development: 2, loyalty: 2 }, badge: 'players' },
      { text: 'I move him to second where the throw is shorter.', skills: { defense: 2 }, leans: { defense: 2, development: 1 }, badge: 'developer' },
      { text: 'I say something about it publicly. Once.', skills: { recruiting: 2 }, leans: { loyalty: 3 }, badge: 'players' },
      { text: 'Nothing. He will hear worse in a regional.', skills: { defense: 1, offense: 1 }, leans: { tradition: 2, ambition: 1 }, badge: 'hardnosed' },
    ],
  },
  {
    id: 'the-donor',
    setup: 'A man who paid for the outfield wall would like his nephew\nto be on the roster. The nephew is not a college player.',
    ask: 'How does that go?',
    answers: [
      { text: 'He can have a jacket and a seat on the bus. Not a spot.', skills: { defense: 2 }, leans: { tradition: 2, development: 1 }, badge: 'hardnosed' },
      { text: 'No, and I tell the donor myself rather than let it travel.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 2, tradition: 1 }, badge: 'traditionalist' },
      { text: 'He walks on like anybody else and the fall decides it.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'He is on the roster. The wall is still up next year.', skills: { recruiting: 3, training: -1 }, leans: { recruiting: 2 }, ambition: 1, badge: 'closer' },
    ],
  },
  {
    id: 'why-this-job',
    setup: 'The interview is nearly over. He closes the folder\nand asks the only question he actually wrote down.',
    ask: 'Why do you want this job?',
    answers: [
      { text: 'Because I can win here, and I do not think you know that yet.', skills: { offense: 1, recruiting: 1 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
      { text: 'Because I would like to be here in fifteen years.', skills: { training: 1, defense: 1 }, leans: { loyalty: 3, tradition: 1 }, ambition: -2, badge: 'keeper' },
      { text: 'Because somebody has to fix this and I would enjoy it.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'Because it is the best job that would have me. You knew that.', skills: { recruiting: 2 }, leans: { recruiting: 1, ambition: 1 }, badge: 'closer' },
    ],
  },
  {
    id: 'the-pitchout',
    setup: 'You are almost sure the steal is on. A pitchout costs you\na ball, and your man is already behind two and one.',
    ask: 'Do you call it?',
    answers: [
      { text: 'Yes. I would rather be wrong at three and one than beaten.', skills: { defense: 2 }, leans: { defense: 3 }, badge: 'methodical' },
      { text: 'No. Three and one is how you lose the inning without a steal.', skills: { offense: 1, defense: 1 }, leans: { pitching: 2 }, badge: 'armsman' },
      { text: 'No, but the catcher knows to expect it and that is enough.', skills: { training: 2 }, leans: { development: 2, defense: 1 }, badge: 'developer' },
      { text: 'Yes, and if I am wrong I will call it again next inning.', skills: { offense: 2 }, leans: { ambition: 2 }, ambition: 1, badge: 'gambler' },
    ],
  },
  {
    id: 'the-errors',
    setup: 'A shortstop has made three errors in two games.\nHe is the best defender you have when he is right.',
    ask: 'What is the fix?',
    answers: [
      { text: 'More ground balls. Two hundred a day until his hands remember.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'A day off. His hands are fine and his head is not.', skills: { training: 1, offense: 1 }, leans: { loyalty: 2, development: 1 }, badge: 'players' },
      { text: 'He plays through it. Nobody ever fixed this from a bench.', skills: { defense: 2 }, leans: { defense: 2, tradition: 1 }, badge: 'hardnosed' },
      { text: 'I look at where he is standing before I look at his hands.', skills: { defense: 1, training: 1 }, leans: { defense: 3 }, badge: 'methodical' },
    ],
  },
  {
    id: 'the-slump',
    setup: 'Your cleanup hitter is three for forty. He is still your\nbest hitter and everybody in the park knows both facts.',
    ask: 'Does he move in the order?',
    answers: [
      { text: 'No. He is the best hitter and the order is not a mood ring.', skills: { offense: 2 }, leans: { power: 2, tradition: 1 }, badge: 'slugger' },
      { text: 'He drops to sixth for a week and nobody makes a speech.', skills: { offense: 1, training: 1 }, leans: { development: 2 }, badge: 'players' },
      { text: 'He leads off. Get him four at-bats and stop thinking about it.', skills: { offense: 3, defense: -1 }, leans: { ambition: 2, power: 1 }, ambition: 1, badge: 'gambler' },
      { text: 'He sits two games and we look at video neither of us enjoys.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
    ],
  },
  {
    id: 'the-doubleheader',
    setup: 'A doubleheader tomorrow and one arm properly rested.\nThe second game is against the better team.',
    ask: 'Where does he pitch?',
    answers: [
      { text: 'Game one. Win the one you can and see what happens.', skills: { defense: 2 }, leans: { defense: 2, tradition: 1 }, badge: 'methodical' },
      { text: 'Game two. I am not conceding a game before it is played.', skills: { offense: 1, recruiting: 1 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
      { text: 'Neither. Three innings in each and the pen covers the rest.', skills: { training: 2 }, leans: { pitching: 2, development: 1 }, badge: 'armsman' },
      { text: 'Game one, and whoever is best in game two earns game one next week.', skills: { training: 1, defense: 1 }, leans: { development: 2, pitching: 1 }, badge: 'developer' },
    ],
  },
  {
    id: 'the-shift',
    setup: 'The spray chart says shift. Your shortstop has played\nthe position for eleven years and hates standing there.',
    ask: 'Who wins?',
    answers: [
      { text: 'The chart. He can hate it from the correct side of the bag.', skills: { defense: 2 }, leans: { defense: 3 }, badge: 'methodical' },
      { text: 'He does. A man who is uncomfortable does not make that play.', skills: { training: 2 }, leans: { loyalty: 2, development: 1 }, badge: 'players' },
      { text: 'The chart, after he has seen it and told me it is wrong.', skills: { defense: 1, training: 1 }, leans: { defense: 2, development: 1 }, badge: 'developer' },
      { text: 'Nobody. We shift for the two hitters it actually matters against.', skills: { defense: 1, recruiting: 1 }, leans: { defense: 2, pitching: 1 }, badge: 'methodical' },
    ],
  },
  {
    id: 'the-scholarship',
    setup: 'One scholarship left. A catcher who will start for four years,\nor a shortstop who might be a first-round pick in two.',
    ask: 'Who gets it?',
    answers: [
      { text: 'The catcher. Four years of a starter is four years.', skills: { training: 1, defense: 1 }, leans: { loyalty: 3, defense: 1 }, ambition: -1, badge: 'keeper' },
      { text: 'The shortstop. Two years of that changes the programme.', skills: { recruiting: 2 }, leans: { recruiting: 2, ambition: 2 }, ambition: 2, badge: 'closer' },
      { text: 'The catcher, and I find the shortstop money somewhere else.', skills: { recruiting: 3, training: -1 }, leans: { recruiting: 2, loyalty: 1 }, badge: 'closer' },
      { text: 'Whichever one I can still make better in eighteen months.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
    ],
  },
  {
    id: 'the-injury',
    setup: 'A man wants to play through something. The trainer says\nhe can, and that it will cost him three weeks later.',
    ask: 'Does he play?',
    answers: [
      { text: 'No. Three weeks in May is worth more than tonight.', skills: { training: 2 }, leans: { development: 2, loyalty: 1 }, badge: 'developer' },
      { text: 'Yes. He asked, he is an adult, and he knows the trade.', skills: { offense: 1, defense: 1 }, leans: { tradition: 2, ambition: 1 }, badge: 'hardnosed' },
      { text: 'Not tonight. We will talk again on Friday and mean it.', skills: { training: 1, defense: 1 }, leans: { development: 2, loyalty: 2 }, badge: 'keeper' },
      { text: 'Yes, and I hold him to five innings whatever he says after.', skills: { defense: 2 }, leans: { defense: 1, pitching: 2 }, badge: 'methodical' },
    ],
  },
  {
    id: 'the-reporter',
    setup: 'Four losses in a row. A reporter you have known for two years\nasks, on the record, whether you are worried about your job.',
    ask: 'What do you say?',
    answers: [
      { text: 'That anybody in this job who is not worried is not paying attention.', skills: { recruiting: 2 }, leans: { tradition: 2, loyalty: 1 }, badge: 'traditionalist' },
      { text: 'That I am worried about Friday, which is the honest answer.', skills: { defense: 1, training: 1 }, leans: { development: 2 }, badge: 'methodical' },
      { text: 'That he should ask the athletic director, and I mean it kindly.', skills: { offense: 1, recruiting: 1 }, leans: { ambition: 2 }, ambition: 1, badge: 'hardnosed' },
      { text: 'That the men in that room have not quit, so neither have I.', skills: { training: 2 }, leans: { loyalty: 3 }, badge: 'players' },
    ],
  },
  {
    id: 'the-assistant',
    setup: 'Your best assistant has been offered a head job somewhere\nsmall. He has not decided and he has asked what you think.',
    ask: 'What do you tell him?',
    answers: [
      { text: 'Take it. Nobody gets a second one of these.', skills: { training: 2 }, leans: { development: 2, loyalty: 1 }, badge: 'players' },
      { text: 'Stay a year. You will get a better one and I will help.', skills: { recruiting: 2 }, leans: { loyalty: 2, tradition: 1 }, badge: 'keeper' },
      { text: 'That I would rather he stayed, which is not advice.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 3 }, badge: 'keeper' },
      { text: 'Whatever he wants to hear. He has already decided.', skills: { recruiting: 1, defense: 1 }, leans: { ambition: 2 }, badge: 'methodical' },
    ],
  },
  {
    id: 'the-freshman',
    setup: 'Your best player in October is a freshman.\nThe room has noticed and is waiting to see what you do.',
    ask: 'Where does he hit?',
    answers: [
      { text: 'Third, from the first game. The room can watch him earn it.', skills: { offense: 2 }, leans: { ambition: 2, development: 1 }, ambition: 1, badge: 'gambler' },
      { text: 'Ninth, and he moves up when he stops being a freshman.', skills: { training: 1, defense: 1 }, leans: { tradition: 3 }, badge: 'traditionalist' },
      { text: 'Seventh. High enough to matter, low enough to breathe.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'Wherever the seniors say, once, and then wherever I say.', skills: { recruiting: 1, training: 1 }, leans: { loyalty: 2, tradition: 1 }, badge: 'players' },
    ],
  },
  {
    id: 'the-blowout',
    setup: 'Up eleven in the seventh. Their pitcher is a freshman\nhaving the worst afternoon of his life.',
    ask: 'What are you doing?',
    answers: [
      { text: 'Nothing different. We play until it is over.', skills: { offense: 2 }, leans: { ambition: 2, tradition: 1 }, badge: 'hardnosed' },
      { text: 'Bench empties. Everybody who travelled gets an at-bat.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'Nobody runs and nobody swings three-nothing. They will remember.', skills: { defense: 1, recruiting: 1 }, leans: { tradition: 3 }, badge: 'traditionalist' },
      { text: 'My pitcher gets his innings. He needs them more than I need mercy.', skills: { training: 1, defense: 1 }, leans: { pitching: 3 }, badge: 'armsman' },
    ],
  },
  {
    id: 'the-rain',
    setup: 'Rain is twenty minutes out. You are ahead in the fifth,\nwhich means it is official if it never resumes.',
    ask: 'How do you play the next ten minutes?',
    answers: [
      { text: 'Quickly. Everybody hacks and nobody steps out.', skills: { offense: 1, defense: 1 }, leans: { ambition: 2 }, ambition: 1, badge: 'gambler' },
      { text: 'Exactly as we would at nought-nought in the first.', skills: { defense: 2 }, leans: { tradition: 3 }, badge: 'traditionalist' },
      { text: 'Slowly, and I will hear about it, and it will be worth it.', skills: { offense: 2 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
      { text: 'I get my arm out before the delay rather than after.', skills: { training: 1, defense: 1 }, leans: { pitching: 3 }, badge: 'armsman' },
    ],
  },
  {
    id: 'the-portal',
    setup: 'Two men enter the portal in the same week. One never played.\nThe other started forty games and did not tell you first.',
    ask: 'Which one bothers you?',
    answers: [
      { text: 'The one who never played. That one is mine.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'The starter. Forty games buys a conversation.', skills: { recruiting: 1, training: 1 }, leans: { loyalty: 3 }, badge: 'keeper' },
      { text: 'Neither. Men leave. I have two names to call this afternoon.', skills: { recruiting: 2 }, leans: { recruiting: 3 }, badge: 'closer' },
      { text: 'Both, and I will say so to the room without naming them.', skills: { training: 1, defense: 1 }, leans: { loyalty: 2, tradition: 1 }, badge: 'players' },
    ],
  },
  {
    id: 'the-predecessor',
    setup: 'The man you replaced still lives in town.\nHe is at every home game, in the same seat, and people notice.',
    ask: 'What do you do with that?',
    answers: [
      { text: 'I ask him to lunch in the first week.', skills: { recruiting: 1, training: 1 }, leans: { tradition: 3 }, badge: 'traditionalist' },
      { text: 'Nothing. He bought a ticket like everybody else.', skills: { defense: 2 }, leans: { ambition: 2 }, ambition: 1, badge: 'hardnosed' },
      { text: 'I put him to work. He knows every family within a hundred miles.', skills: { recruiting: 2 }, leans: { recruiting: 2, tradition: 1 }, badge: 'closer' },
      { text: 'I leave his banner where it is and never mention it again.', skills: { training: 1, defense: 1 }, leans: { tradition: 2, loyalty: 1 }, badge: 'traditionalist' },
    ],
  },
  {
    id: 'the-leadoff',
    setup: 'Two men can hit leadoff. One is on base more.\nThe other is the fastest man in the conference.',
    ask: 'Who bats first?',
    answers: [
      { text: 'The one who gets on. You cannot steal first.', skills: { offense: 2 }, leans: { defense: 1, development: 1 }, badge: 'methodical' },
      { text: 'The fast one. He changes what their pitcher is thinking about.', skills: { offense: 1, defense: 1 }, leans: { ambition: 2, power: -1 }, ambition: 1, badge: 'gambler' },
      { text: 'The one who gets on, and the fast one hits behind him.', skills: { offense: 1, training: 1 }, leans: { development: 2, defense: 1 }, badge: 'developer' },
      { text: 'Whichever one takes the most pitches. I want their starter tired.', skills: { defense: 1, training: 1 }, leans: { pitching: 2, defense: 1 }, badge: 'methodical' },
    ],
  },
  {
    id: 'the-bus',
    setup: 'Eleven hours on a bus, and you arrive at four in the morning\nfor a noon game you are expected to win.',
    ask: 'What happens on that bus?',
    answers: [
      { text: 'Nothing. They sleep and I let them.', skills: { training: 2 }, leans: { loyalty: 2, development: 1 }, badge: 'players' },
      { text: 'Video. Eleven hours is a gift and we are wasting it.', skills: { defense: 2 }, leans: { defense: 2, development: 1 }, badge: 'methodical' },
      { text: 'I sit with three men I have not sat with this year.', skills: { recruiting: 1, training: 1 }, leans: { loyalty: 3 }, badge: 'keeper' },
      { text: 'Nothing, and nobody complains about the bus. Ever. To anyone.', skills: { defense: 1, offense: 1 }, leans: { tradition: 2, ambition: 1 }, badge: 'hardnosed' },
    ],
  },
  {
    id: 'the-catcher',
    setup: 'Your catcher cannot hit. He also runs the staff so well\nthat two of your arms are visibly worse without him.',
    ask: 'Does he play every day?',
    answers: [
      { text: 'Every day. What he does is not in the box score.', skills: { defense: 1, training: 1 }, leans: { pitching: 3 }, badge: 'armsman' },
      { text: 'Not against their best arm. I need nine hitters that night.', skills: { offense: 2 }, leans: { power: 2, ambition: 1 }, badge: 'slugger' },
      { text: 'Every day, and we fix the bat in the mornings all winter.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'Every day, and I stop pretending it is a problem.', skills: { defense: 2 }, leans: { defense: 2, tradition: 1 }, badge: 'methodical' },
    ],
  },
  {
    id: 'the-two-way',
    setup: 'A freshman is your third-best arm and your second-best bat.\nHe wants to do both. Everybody who has tried has broken.',
    ask: 'What does he do?',
    answers: [
      { text: 'Both, carefully, with a number on it that I do not move off.', skills: { training: 1, defense: 1 }, leans: { pitching: 2, development: 1 }, badge: 'methodical' },
      { text: 'Both, and we find out. That is what a freshman year is.', skills: { offense: 1, training: 1 }, leans: { development: 2, ambition: 1 }, ambition: 1, badge: 'gambler' },
      { text: 'He hits. Bats last longer than elbows.', skills: { offense: 2 }, leans: { power: 2, development: 1 }, badge: 'slugger' },
      { text: 'He pitches. I can find a bat and I cannot find that arm.', skills: { defense: 1, training: 1 }, leans: { pitching: 3 }, badge: 'armsman' },
    ],
  },
  {
    id: 'the-captain',
    setup: 'The room wants a captain. The obvious man is your worst\nplayer and the best one has never spoken in three years.',
    ask: 'Who wears it?',
    answers: [
      { text: 'The one they picked. That is what the vote was for.', skills: { training: 2 }, leans: { loyalty: 3 }, badge: 'players' },
      { text: 'Nobody. Twenty-three men and none of them need a letter.', skills: { defense: 2 }, leans: { tradition: 2, ambition: 1 }, badge: 'hardnosed' },
      { text: 'Both, and the quiet one learns something he needs.', skills: { training: 1, recruiting: 1 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'The best player. It is a baseball team.', skills: { offense: 1, defense: 1 }, leans: { ambition: 2 }, ambition: 1, badge: 'hardnosed' },
    ],
  },
  {
    id: 'the-elbow',
    setup: 'Your best arm has been told he needs surgery.\nHe would rather rest it, throw in May, and pitch a regional.',
    ask: 'What does he do?',
    answers: [
      { text: 'Surgery, this week. He has fifteen years of throwing left.', skills: { training: 2 }, leans: { development: 2, pitching: 1 }, badge: 'developer' },
      { text: 'Surgery, and I tell him it was my call so he can be angry at me.', skills: { training: 1, defense: 1 }, leans: { loyalty: 3 }, badge: 'players' },
      { text: 'He rests. It is his elbow and his May.', skills: { offense: 1, recruiting: 1 }, leans: { ambition: 2, loyalty: 1 }, badge: 'gambler' },
      { text: 'Two doctors first. I am not deciding this off one opinion.', skills: { defense: 1, training: 1 }, leans: { pitching: 2, defense: 1 }, badge: 'methodical' },
    ],
  },
  {
    id: 'the-visit',
    setup: 'A recruit is on campus with his mother. He has three other\nvisits booked and she has already asked about graduation rates.',
    ask: 'What does the day look like?',
    answers: [
      { text: 'She meets four seniors without me in the room.', skills: { recruiting: 2 }, leans: { loyalty: 2, recruiting: 1 }, badge: 'keeper' },
      { text: 'The facility, the plan for him, and a number on it.', skills: { recruiting: 1, training: 1 }, leans: { development: 2, recruiting: 1 }, badge: 'developer' },
      { text: 'Whatever the other three are not doing.', skills: { recruiting: 3, defense: -1 }, leans: { recruiting: 3 }, ambition: 1, badge: 'closer' },
      { text: 'Practice, unedited, and then I answer everything she asks.', skills: { recruiting: 1, defense: 1 }, leans: { tradition: 2, loyalty: 1 }, badge: 'traditionalist' },
    ],
  },
  {
    id: 'the-parent',
    setup: 'A father has emailed you four times about his son’s innings.\nThe son has said nothing and looks embarrassed in the dugout.',
    ask: 'Who do you talk to?',
    answers: [
      { text: 'The son, once, and never about the emails.', skills: { training: 2 }, leans: { development: 2, loyalty: 1 }, badge: 'players' },
      { text: 'The father, once, and it will be a short conversation.', skills: { defense: 2 }, leans: { tradition: 2, ambition: 1 }, badge: 'hardnosed' },
      { text: 'Both, together, so nobody can repeat it differently later.', skills: { recruiting: 1, training: 1 }, leans: { tradition: 2, development: 1 }, badge: 'traditionalist' },
      { text: 'Nobody. I answer with innings or I do not answer.', skills: { defense: 1, offense: 1 }, leans: { ambition: 2, defense: 1 }, badge: 'methodical' },
    ],
  },
  {
    id: 'the-hot-start',
    setup: 'You are 14-2 and clearly not a 14-2 team.\nThe crowd has started using the word Omaha out loud.',
    ask: 'What do you say about that?',
    answers: [
      { text: 'Nothing. Let them enjoy April.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 2, tradition: 1 }, badge: 'players' },
      { text: 'That we are 14-2 and that both those numbers are small.', skills: { defense: 2 }, leans: { defense: 2, development: 1 }, badge: 'methodical' },
      { text: 'That we are going, and I would rather be wrong loudly.', skills: { offense: 1, recruiting: 1 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
      { text: 'Nothing to them. Plenty to the four men who think it is done.', skills: { training: 1, defense: 1 }, leans: { development: 2, tradition: 1 }, badge: 'hardnosed' },
    ],
  },
  {
    id: 'the-field',
    setup: 'The infield is the worst in the conference and everybody\nknows it. There is money for the field or money for an assistant.',
    ask: 'Which one?',
    answers: [
      { text: 'The field. Bad hops cost games and confidence, in that order.', skills: { defense: 2 }, leans: { defense: 3 }, badge: 'methodical' },
      { text: 'The assistant. A man can fix more than a groundskeeper can.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'The field. It is the first thing a seventeen-year-old sees.', skills: { recruiting: 2 }, leans: { recruiting: 3 }, badge: 'closer' },
      { text: 'Neither. Both of those are next year and I need arms now.', skills: { recruiting: 1, defense: 1 }, leans: { pitching: 2, ambition: 1 }, ambition: 1, badge: 'armsman' },
    ],
  },
  {
    id: 'the-uniform',
    setup: 'Somebody has designed new uniforms. They are not what\nthe programme has worn since 1961, and the alumni have opinions.',
    ask: 'What do the team wear?',
    answers: [
      { text: 'The old ones. There is a reason people recognise them.', skills: { recruiting: 1, defense: 1 }, leans: { tradition: 3 }, badge: 'traditionalist' },
      { text: 'The new ones. Seventeen-year-olds are not alumni yet.', skills: { recruiting: 2 }, leans: { recruiting: 3 }, ambition: 1, badge: 'closer' },
      { text: 'The old ones at home, the new ones on the road.', skills: { recruiting: 1, training: 1 }, leans: { tradition: 2, recruiting: 1 }, badge: 'traditionalist' },
      { text: 'Whatever they vote for. It is on their backs.', skills: { training: 2 }, leans: { loyalty: 3 }, badge: 'players' },
    ],
  },
  {
    id: 'the-juco',
    setup: 'A junior-college transfer is available. Two years,\nready now, and a scout you trust says the swing will not hold up.',
    ask: 'Do you take him?',
    answers: [
      { text: 'Yes. Two years of ready is worth more than four of maybe.', skills: { recruiting: 2 }, leans: { recruiting: 2, ambition: 1 }, ambition: 1, badge: 'closer' },
      { text: 'Yes, and I will fix the swing myself.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'No. I trust the scout and I trust four years more.', skills: { recruiting: 1, training: 1 }, leans: { loyalty: 2, development: 1 }, badge: 'keeper' },
      { text: 'No. I would rather be wrong about somebody who will be here.', skills: { training: 1, defense: 1 }, leans: { loyalty: 3 }, ambition: -1, badge: 'keeper' },
    ],
  },
  {
    id: 'the-nine-run-inning',
    setup: 'You have just given up nine in an inning.\nThere are two innings left and the bus leaves at ten.',
    ask: 'Who pitches the eighth?',
    answers: [
      { text: 'A freshman who needs to stand out there once.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'Whoever throws strikes. I want this over.', skills: { defense: 2 }, leans: { defense: 2, pitching: 1 }, badge: 'methodical' },
      { text: 'A position player. Nobody warm is worth burning tonight.', skills: { training: 1, defense: 1 }, leans: { pitching: 3 }, badge: 'armsman' },
      { text: 'My best available. They are not going to enjoy the ninth.', skills: { offense: 1, defense: 1 }, leans: { ambition: 2, tradition: 1 }, ambition: 1, badge: 'hardnosed' },
    ],
  },
  {
    id: 'the-signing-rank',
    setup: 'Your class is ranked fortieth in the country.\nYou think it is the best class you have signed here.',
    ask: 'Does the ranking matter?',
    answers: [
      { text: 'Not to me. It matters to the seventeen-year-olds, so it matters.', skills: { recruiting: 2 }, leans: { recruiting: 3 }, badge: 'closer' },
      { text: 'No. Rankings measure who else wanted them.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'It matters to the board, and the board matters to me.', skills: { recruiting: 1, offense: 1 }, leans: { ambition: 2, recruiting: 1 }, ambition: 1, badge: 'closer' },
      { text: 'Ask me in four years and I will give you a real answer.', skills: { training: 1, defense: 1 }, leans: { development: 2, loyalty: 1 }, ambition: -1, badge: 'keeper' },
    ],
  },
  {
    id: 'the-quiet-room',
    setup: 'You have won six in a row and the room has gone quiet\nin a way that usually comes before losing four.',
    ask: 'Do you do anything?',
    answers: [
      { text: 'Yes. Something changes today while we are still winning.', skills: { training: 2 }, leans: { development: 2, ambition: 1 }, badge: 'hardnosed' },
      { text: 'No. You do not go looking for a problem at six in a row.', skills: { defense: 2 }, leans: { tradition: 2, defense: 1 }, badge: 'methodical' },
      { text: 'I ask two seniors what I am missing.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 3 }, badge: 'players' },
      { text: 'A day off. Nobody has had one since February.', skills: { training: 1, offense: 1 }, leans: { loyalty: 2, development: 1 }, badge: 'players' },
    ],
  },
  {
    id: 'the-ejection',
    setup: 'A call was wrong and everybody in the park knows it.\nYou have not been thrown out of a game in two years.',
    ask: 'What happens next?',
    answers: [
      { text: 'I go, and I make sure it is worth going for.', skills: { offense: 1, recruiting: 1 }, leans: { ambition: 2, loyalty: 1 }, ambition: 1, badge: 'gambler' },
      { text: 'Nothing. I am not spending a suspension on the fourth inning.', skills: { defense: 2 }, leans: { defense: 2, tradition: 1 }, badge: 'methodical' },
      { text: 'A word between innings that nobody in the stands can hear.', skills: { defense: 1, training: 1 }, leans: { tradition: 3 }, badge: 'traditionalist' },
      { text: 'I go if a man of mine is about to, and I go first.', skills: { training: 2 }, leans: { loyalty: 3 }, badge: 'players' },
    ],
  },
  {
    id: 'the-drafted-junior',
    setup: 'A junior has been drafted in a round that is real money.\nHe is asking what you think, and he means it.',
    ask: 'What do you tell him?',
    answers: [
      { text: 'Go. That money does not come round again.', skills: { training: 1, recruiting: 1 }, leans: { development: 2, loyalty: -1 }, badge: 'players' },
      { text: 'Stay a year and the money doubles. I have seen it twice.', skills: { training: 2 }, leans: { development: 2, loyalty: 2 }, badge: 'keeper' },
      { text: 'What I would tell my own son, and then I sit down.', skills: { training: 1, defense: 1 }, leans: { loyalty: 3 }, badge: 'players' },
      { text: 'That I want him here and that he should ignore me.', skills: { recruiting: 2 }, leans: { loyalty: 2, tradition: 1 }, badge: 'keeper' },
    ],
  },
  {
    id: 'the-scoreboard-watch',
    setup: 'Your seeding depends on a game three states away that\nfinishes an hour after yours. Somebody has it on a phone.',
    ask: 'Does the dugout know the score?',
    answers: [
      { text: 'No. Phones away. We are playing a game.', skills: { defense: 2 }, leans: { tradition: 2, defense: 1 }, badge: 'hardnosed' },
      { text: 'Yes. They can count and pretending otherwise is silly.', skills: { offense: 1, training: 1 }, leans: { ambition: 2 }, badge: 'methodical' },
      { text: 'I know. That is enough for it to change what I call.', skills: { offense: 1, defense: 1 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
      { text: 'Nobody knows, including me, and I mean that.', skills: { training: 2 }, leans: { tradition: 3 }, ambition: -1, badge: 'traditionalist' },
    ],
  },
  {
    id: 'the-old-assistant',
    setup: 'You have inherited an assistant who has been here nineteen years.\nHe was passed over for your job and has been nothing but helpful.',
    ask: 'What do you do with him?',
    answers: [
      { text: 'He keeps everything he had, and I ask him things in front of people.', skills: { recruiting: 1, training: 1 }, leans: { tradition: 3 }, badge: 'traditionalist' },
      { text: 'He runs the pitchers. Nineteen years of those arms is worth having.', skills: { training: 1, defense: 1 }, leans: { pitching: 3 }, badge: 'armsman' },
      { text: 'He recruits. He knows every coach in three states.', skills: { recruiting: 2 }, leans: { recruiting: 3 }, badge: 'closer' },
      { text: 'I bring my own man and I tell him that on day one.', skills: { defense: 1, offense: 1 }, leans: { ambition: 3 }, ambition: 2, badge: 'hardnosed' },
    ],
  },
  {
    id: 'the-fall-scrimmage',
    setup: 'Fall ball, last scrimmage. A senior and a freshman\nare tied for a job and neither has separated in six weeks.',
    ask: 'How do you settle it?',
    answers: [
      { text: 'The senior opens. Ties go to the man who has been here.', skills: { defense: 1, training: 1 }, leans: { loyalty: 2, tradition: 1 }, badge: 'keeper' },
      { text: 'The freshman opens. Ties go to the man with the upside.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'Neither. They platoon until one of them stops being tied.', skills: { defense: 2 }, leans: { defense: 2, development: 1 }, badge: 'methodical' },
      { text: 'Whoever handles being told he is not starting.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 2, development: 1 }, badge: 'players' },
    ],
  },
  {
    id: 'the-bad-contract',
    setup: 'You are three years into five. You are 62-73 here.\nThe board has not said anything, which is its own kind of message.',
    ask: 'What do you change?',
    answers: [
      { text: 'Nothing. Three years is not long enough to know.', skills: { training: 2 }, leans: { development: 2, loyalty: 1 }, ambition: -1, badge: 'developer' },
      { text: 'Everything on offence. We are losing the way we have always lost.', skills: { offense: 2 }, leans: { power: 2, ambition: 1 }, ambition: 1, badge: 'slugger' },
      { text: 'The recruiting. I have been signing the wrong men.', skills: { recruiting: 2 }, leans: { recruiting: 3 }, badge: 'closer' },
      { text: 'I go and ask the board directly what they are counting.', skills: { recruiting: 1, defense: 1 }, leans: { tradition: 2, ambition: 1 }, badge: 'traditionalist' },
    ],
  },
  {
    id: 'the-first-practice',
    setup: 'First practice of your first season here.\nTwenty-three men, none of whom you recruited, all watching.',
    ask: 'What is the first thing you do?',
    answers: [
      { text: 'Ground balls. We find out where everybody actually is.', skills: { defense: 2 }, leans: { defense: 3 }, badge: 'methodical' },
      { text: 'I learn twenty-three names and use every one before we start.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 3 }, badge: 'players' },
      { text: 'I tell them exactly what will get a man on this field.', skills: { training: 1, defense: 1 }, leans: { development: 2, tradition: 1 }, badge: 'hardnosed' },
      { text: 'We run. It is not subtle and it does not need to be.', skills: { offense: 1, defense: 1 }, leans: { tradition: 2, ambition: 1 }, badge: 'hardnosed' },
    ],
  },
  {
    id: 'the-tired-pen',
    setup: 'Your pen has thrown four days running.\nIt is a one-run game in the eighth and everybody down there is lying to you.',
    ask: 'Who goes?',
    answers: [
      { text: 'Nobody. The starter finishes what he started.', skills: { defense: 1, training: 1 }, leans: { pitching: 2, tradition: 1 }, badge: 'armsman' },
      { text: 'The one who is lying least convincingly.', skills: { training: 2 }, leans: { development: 2, pitching: 1 }, badge: 'players' },
      { text: 'The best one. Tomorrow is not my problem tonight.', skills: { offense: 1, defense: 1 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
      { text: 'The one who has thrown fewest pitches, and I look it up.', skills: { defense: 2 }, leans: { pitching: 2, defense: 1 }, badge: 'methodical' },
    ],
  },
  {
    id: 'the-empty-stands',
    setup: 'Four hundred people in a park that holds four thousand.\nIt is a Tuesday and you are winning.',
    ask: 'Whose problem is that?',
    answers: [
      { text: 'Mine. Win enough and they come.', skills: { offense: 1, recruiting: 1 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
      { text: 'Mine, but not on a Tuesday. Ask me again in May.', skills: { defense: 2 }, leans: { defense: 1, tradition: 2 }, badge: 'methodical' },
      { text: 'Nobody’s. Four hundred people came to watch baseball.', skills: { training: 2 }, leans: { tradition: 2, loyalty: 1 }, ambition: -1, badge: 'traditionalist' },
      { text: 'The programme’s, and I will go and speak to every school in the county.', skills: { recruiting: 2 }, leans: { recruiting: 3 }, badge: 'closer' },
    ],
  },
  {
    id: 'the-loyal-senior',
    setup: 'A senior has been here four years, played in eleven games,\nand has not missed a practice or complained once.',
    ask: 'What does he get?',
    answers: [
      { text: 'A start on senior day, and I do not make a speech about it.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 3, tradition: 1 }, badge: 'keeper' },
      { text: 'A job on my staff if he wants one.', skills: { training: 2 }, leans: { loyalty: 2, development: 1 }, badge: 'players' },
      { text: 'Exactly what he has earned, which is what he already had.', skills: { defense: 2 }, leans: { tradition: 2, ambition: 1 }, badge: 'hardnosed' },
      { text: 'Told, in front of the room, what four years of that is worth.', skills: { training: 1, defense: 1 }, leans: { loyalty: 3 }, badge: 'players' },
    ],
  },
  {
    id: 'the-analytics-man',
    setup: 'A graduate student has been sending you spray charts\nnobody asked for. Two of them have been right.',
    ask: 'What do you do with him?',
    answers: [
      { text: 'He gets a desk and a job title.', skills: { defense: 1, recruiting: 1 }, leans: { defense: 2, recruiting: 1 }, badge: 'methodical' },
      { text: 'He keeps sending them and I keep reading them. That is enough.', skills: { defense: 2 }, leans: { defense: 2, development: 1 }, badge: 'methodical' },
      { text: 'I ask him what he thinks about the two he got wrong.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'Nothing. I have three coaches and a bus to pay for.', skills: { recruiting: 1, training: 1 }, leans: { tradition: 3 }, badge: 'traditionalist' },
    ],
  },
  {
    id: 'the-young-coach',
    setup: 'You are the youngest man ever to sit in this chair.\nThree of the men you would be coaching are within four years of you.',
    ask: 'Does that come up?',
    when: 'young',
    answers: [
      { text: 'I raise it first, in the first meeting, and then never again.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 3 }, badge: 'players' },
      { text: 'No. It comes up the first time I make an unpopular decision.', skills: { defense: 2 }, leans: { tradition: 2, ambition: 1 }, badge: 'hardnosed' },
      { text: 'Constantly, and I will use it. They tell me things.', skills: { training: 2 }, leans: { development: 2, loyalty: 1 }, badge: 'players' },
      { text: 'It comes up with parents, not players. That is the real problem.', skills: { recruiting: 2 }, leans: { recruiting: 2, tradition: 1 }, badge: 'closer' },
    ],
  },
  {
    id: 'the-old-coach',
    setup: 'You have done this a long time. The last two men hired\nin this conference are half your age and have laptops.',
    ask: 'What have you got that they have not?',
    when: 'old',
    answers: [
      { text: 'I have been wrong more times and remember all of them.', skills: { training: 2 }, leans: { development: 2, tradition: 1 }, badge: 'developer' },
      { text: 'Every high school coach in this state takes my call.', skills: { recruiting: 2 }, leans: { recruiting: 3 }, badge: 'closer' },
      { text: 'Nothing they will not have in ten years. So I had better win now.', skills: { offense: 1, defense: 1 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
      { text: 'I know what a room sounds like before it goes wrong.', skills: { training: 1, defense: 1 }, leans: { loyalty: 2, tradition: 1 }, badge: 'players' },
    ],
  },
  {
    id: 'the-heat',
    setup: 'It is ninety-six degrees at first pitch and it will be\nninety-one at the last one. This is most of your season.',
    ask: 'How does that change anything?',
    when: 'warm',
    answers: [
      { text: 'It does not. They live here.', skills: { defense: 2 }, leans: { tradition: 2, ambition: 1 }, badge: 'hardnosed' },
      { text: 'Shorter practices, earlier, and nobody is a hero in July.', skills: { training: 2 }, leans: { development: 2, loyalty: 1 }, badge: 'players' },
      { text: 'My arms throw fewer pitches than anybody in the league.', skills: { defense: 1, training: 1 }, leans: { pitching: 3 }, badge: 'methodical' },
      { text: 'It is the best thing we have. Visitors wilt in the seventh.', skills: { offense: 1, defense: 1 }, leans: { ambition: 2, defense: 1 }, badge: 'grinder' },
    ],
  },
  {
    id: 'the-cold',
    setup: 'You will practise indoors until the second week of March\nand play your first eleven games somewhere else.',
    ask: 'How do you build a season out of that?',
    when: 'cold',
    answers: [
      { text: 'Arms. Six months indoors is the best pitching lab in the country.', skills: { training: 1, defense: 1 }, leans: { pitching: 3 }, badge: 'armsman' },
      { text: 'Defence. You can take a thousand ground balls on a gym floor.', skills: { defense: 2 }, leans: { defense: 3 }, badge: 'methodical' },
      { text: 'Recruiting. I sell eleven games in the sun to seventeen-year-olds.', skills: { recruiting: 2 }, leans: { recruiting: 3 }, badge: 'closer' },
      { text: 'Toughness, and I am aware of how that sounds.', skills: { offense: 1, training: 1 }, leans: { tradition: 2, loyalty: 1 }, badge: 'hardnosed' },
    ],
  },
  {
    id: 'the-intentional-walk',
    setup: 'First base open, two out, and their best hitter up\nwith a man on second in a one-run game.',
    ask: 'Do you put him on?',
    answers: [
      { text: 'Yes. I would rather face anybody else on earth.', skills: { defense: 2 }, leans: { defense: 2, pitching: 1 }, badge: 'methodical' },
      { text: 'No. My man gets him out or he learns something.', skills: { training: 2 }, leans: { development: 2, pitching: 1 }, badge: 'developer' },
      { text: 'No. Putting the winning run on is how you lose in the ninth.', skills: { defense: 1, offense: 1 }, leans: { tradition: 2, defense: 1 }, badge: 'traditionalist' },
      { text: 'Yes, and I would do it in the first inning too.', skills: { defense: 1, training: 1 }, leans: { pitching: 2, defense: 1 }, badge: 'methodical' },
    ],
  },
  {
    id: 'the-hit-and-run',
    setup: 'Man on first, one out, and a hitter who has struck out\ntwice already against a pitcher who is throwing strikes.',
    ask: 'Is anything on?',
    answers: [
      { text: 'Hit and run. Get him moving and take the double play away.', skills: { offense: 1, defense: 1 }, leans: { ambition: 2, defense: 1 }, badge: 'gambler' },
      { text: 'Nothing. Two strikeouts is a reason to let him hit.', skills: { offense: 2 }, leans: { power: 2, development: 1 }, badge: 'slugger' },
      { text: 'Nothing. Two strikeouts is a reason not to ask him to do more.', skills: { training: 2 }, leans: { development: 2, loyalty: 1 }, badge: 'developer' },
      { text: 'Straight steal. I trust the legs more than the bat tonight.', skills: { offense: 1, training: 1 }, leans: { ambition: 2 }, ambition: 1, badge: 'gambler' },
    ],
  },
  {
    id: 'the-redshirt',
    setup: 'A freshman is your fifth-best arm. He would throw thirty\ninnings this year, or none, and be your best arm as a senior.',
    ask: 'Which one?',
    answers: [
      { text: 'None. Four years of him is worth more than thirty innings.', skills: { training: 2 }, leans: { development: 3 }, ambition: -1, badge: 'developer' },
      { text: 'Thirty. He needs to stand out there and I need the innings.', skills: { defense: 1, offense: 1 }, leans: { ambition: 2, pitching: 1 }, ambition: 1, badge: 'armsman' },
      { text: 'He decides, once I have told him the truth about both.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 3 }, badge: 'players' },
      { text: 'None, and I say the word senior to him every week until it is.', skills: { training: 1, defense: 1 }, leans: { development: 2, loyalty: 1 }, badge: 'keeper' },
    ],
  },
  {
    id: 'the-position-change',
    setup: 'A shortstop who cannot stay at shortstop is the best\nathlete on your team. He does not think there is a problem.',
    ask: 'How does he end up in centre field?',
    answers: [
      { text: 'I show him the numbers and let him argue with them.', skills: { defense: 1, training: 1 }, leans: { defense: 2, development: 1 }, badge: 'methodical' },
      { text: 'He plays there in the fall and finds out he likes it.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'I tell him. It is my lineup and he is an outfielder.', skills: { defense: 2 }, leans: { defense: 2, ambition: 1 }, badge: 'hardnosed' },
      { text: 'A scout tells him. He will believe a scout.', skills: { recruiting: 2 }, leans: { recruiting: 2, development: 1 }, badge: 'closer' },
    ],
  },
  {
    id: 'the-slow-start',
    setup: 'You are 4-11. Nothing is obviously broken\nand you have looked at all of it twice.',
    ask: 'What do you do this week?',
    answers: [
      { text: 'Change the lineup entirely. Something has to move.', skills: { offense: 2 }, leans: { ambition: 2, power: 1 }, ambition: 1, badge: 'gambler' },
      { text: 'Nothing. Fifteen games is fifteen games.', skills: { defense: 2 }, leans: { defense: 1, tradition: 2 }, badge: 'methodical' },
      { text: 'Talk to eleven men individually and listen more than I talk.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 3 }, badge: 'players' },
      { text: 'Go back to the fundamentals we clearly did not finish in the fall.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
    ],
  },
  {
    id: 'the-star-attitude',
    setup: 'Your best player is your worst teammate.\nHe is not cruel, he is just not there for anybody.',
    ask: 'Does anything change?',
    answers: [
      { text: 'He sits a game. Once. Everybody understands the rest of the year.', skills: { defense: 1, training: 1 }, leans: { tradition: 2, loyalty: 1 }, badge: 'hardnosed' },
      { text: 'Nothing. He is twenty and he hits. Both of those pass.', skills: { offense: 2 }, leans: { power: 2, ambition: 1 }, badge: 'slugger' },
      { text: 'I give him something to be responsible for and see what happens.', skills: { training: 2 }, leans: { development: 2, loyalty: 1 }, badge: 'players' },
      { text: 'I ask the seniors to handle it before I have to.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 3, tradition: 1 }, badge: 'players' },
    ],
  },
  {
    id: 'the-conference-vote',
    setup: 'The league is voting on a rule you think is wrong.\nYours is the deciding vote and everybody will know how you used it.',
    ask: 'How do you vote?',
    answers: [
      { text: 'The way I think is right, and I will say why out loud.', skills: { recruiting: 1, defense: 1 }, leans: { tradition: 3 }, badge: 'traditionalist' },
      { text: 'The way that helps my programme. That is what I am paid for.', skills: { offense: 1, recruiting: 1 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
      { text: 'With the two coaches I will need something from in June.', skills: { recruiting: 2 }, leans: { recruiting: 2, ambition: 1 }, badge: 'closer' },
      { text: 'I abstain, and I am aware that is also a decision.', skills: { defense: 2 }, leans: { defense: 1, tradition: 1 }, badge: 'methodical' },
    ],
  },
  {
    id: 'the-first-round-arm',
    setup: 'A high school arm nobody in the country can get\nhas asked you, specifically, for a plan on paper.',
    ask: 'What is on the paper?',
    answers: [
      { text: 'Innings. Exactly how many, from week one, in writing.', skills: { defense: 1, training: 1 }, leans: { pitching: 2, development: 1 }, badge: 'methodical' },
      { text: 'What he throws in three years that he cannot throw now.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'The draft. What he is worth now and what he is worth after.', skills: { recruiting: 2 }, leans: { recruiting: 2, ambition: 1 }, ambition: 1, badge: 'closer' },
      { text: 'Nothing. I do not put promises on paper for anybody.', skills: { defense: 1, recruiting: 1 }, leans: { tradition: 3 }, badge: 'traditionalist' },
    ],
  },
  {
    id: 'the-bench-clearing',
    setup: 'Their pitcher has hit two of your men. The second one\nlooked deliberate and your dugout is on its feet.',
    ask: 'What happens?',
    answers: [
      { text: 'I get in front of them. Nobody on my team gets suspended for this.', skills: { defense: 1, training: 1 }, leans: { tradition: 2, defense: 1 }, badge: 'methodical' },
      { text: 'Nothing today. It gets remembered and it gets returned in May.', skills: { offense: 1, defense: 1 }, leans: { tradition: 3 }, badge: 'traditionalist' },
      { text: 'It gets returned in the bottom of this inning.', skills: { offense: 2 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
      { text: 'I am the first one out there and the loudest.', skills: { training: 2 }, leans: { loyalty: 3 }, badge: 'players' },
    ],
  },
  {
    id: 'the-quiet-freshman',
    setup: 'A freshman has not spoken to anybody in six weeks.\nHe is a thousand miles from home and playing badly.',
    ask: 'What do you do?',
    answers: [
      { text: 'I put him with a senior from his part of the country.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 3 }, badge: 'players' },
      { text: 'I play him. Nothing fixes homesick like being needed.', skills: { training: 1, offense: 1 }, leans: { development: 2, loyalty: 1 }, badge: 'developer' },
      { text: 'I sit with him. Not about baseball, and not once.', skills: { training: 2 }, leans: { loyalty: 2, development: 1 }, badge: 'players' },
      { text: 'I leave him alone. Some men need six weeks and not a speech.', skills: { defense: 2 }, leans: { tradition: 2, development: 1 }, badge: 'methodical' },
    ],
  },
  {
    id: 'the-money-question',
    setup: 'A rival programme has offered your best assistant\nnearly what you make. You cannot match it.',
    ask: 'What do you do?',
    answers: [
      { text: 'I tell the board to find it, and I mean it as an ultimatum.', skills: { recruiting: 1, offense: 1 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
      { text: 'I give him everything I can that is not money.', skills: { training: 2 }, leans: { loyalty: 3 }, badge: 'keeper' },
      { text: 'I help him go, and I have already got two names.', skills: { recruiting: 2 }, leans: { recruiting: 3 }, badge: 'closer' },
      { text: 'I offer him my job in five years, and I am not joking.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 2, tradition: 1 }, badge: 'players' },
    ],
  },
  {
    id: 'the-eleven-inning',
    setup: 'Eleventh inning, everybody has pitched, and the man\non the mound is a first baseman who threw in high school.',
    ask: 'How do you play the twelfth?',
    answers: [
      { text: 'We are trying to win it this inning, by any means available.', skills: { offense: 2 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
      { text: 'Exactly as we played the first. Nothing changes because it is late.', skills: { defense: 2 }, leans: { tradition: 2, defense: 1 }, badge: 'traditionalist' },
      { text: 'I protect the first baseman. He has a season after tonight.', skills: { training: 2 }, leans: { development: 2, pitching: 1 }, badge: 'developer' },
      { text: 'Every man left on the bench is in the game by the thirteenth.', skills: { training: 1, offense: 1 }, leans: { development: 2, ambition: 1 }, badge: 'players' },
    ],
  },
  {
    id: 'the-summer-league',
    setup: 'Your best hitter wants to play summer ball three states away\nfor a coach you do not know.',
    ask: 'What do you say?',
    answers: [
      { text: 'Go. Four hundred at-bats is four hundred at-bats.', skills: { training: 1, offense: 1 }, leans: { development: 2, power: 1 }, badge: 'developer' },
      { text: 'Not there. I will find him somewhere I can watch.', skills: { training: 2 }, leans: { development: 2, loyalty: 1 }, badge: 'methodical' },
      { text: 'Go, and I will call that coach on Sunday and every Sunday.', skills: { recruiting: 1, training: 1 }, leans: { recruiting: 2, development: 1 }, badge: 'closer' },
      { text: 'Stay. Three months here is worth more than four hundred at-bats.', skills: { training: 1, defense: 1 }, leans: { loyalty: 3 }, ambition: -1, badge: 'keeper' },
    ],
  },
  {
    id: 'the-nine-hole',
    setup: 'Somebody has to hit ninth. You have a light-hitting\nshortstop and a freshman who might be your best hitter by May.',
    ask: 'Who is it?',
    answers: [
      { text: 'The freshman. Ninth is the best place to learn to hit here.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'The shortstop. Ninth is where the worst hitter goes.', skills: { defense: 2 }, leans: { defense: 2, tradition: 1 }, badge: 'methodical' },
      { text: 'The shortstop, and he is a second leadoff man in front of the top.', skills: { offense: 1, defense: 1 }, leans: { defense: 2, ambition: 1 }, badge: 'grinder' },
      { text: 'Neither. Ninth is for whoever had the worst week.', skills: { offense: 1, training: 1 }, leans: { ambition: 2, development: 1 }, badge: 'hardnosed' },
    ],
  },
  {
    id: 'the-alumni',
    setup: 'The alumni association would like an hour of your week,\nevery week, for the rest of your time here.',
    ask: 'Do they get it?',
    answers: [
      { text: 'Yes. They were here before me and will be here after.', skills: { recruiting: 1, training: 1 }, leans: { tradition: 3 }, badge: 'traditionalist' },
      { text: 'Half of it, and I will spend the other half recruiting.', skills: { recruiting: 2 }, leans: { recruiting: 2, tradition: 1 }, badge: 'closer' },
      { text: 'No. They get four evenings a year and my full attention at them.', skills: { defense: 1, recruiting: 1 }, leans: { ambition: 2 }, badge: 'methodical' },
      { text: 'Yes, and I bring two players every time.', skills: { training: 1, recruiting: 1 }, leans: { tradition: 2, loyalty: 1 }, badge: 'players' },
    ],
  },
  {
    id: 'the-sign-stealing',
    setup: 'You are fairly sure the team in the other dugout\nhas your signs. You have been fairly sure for two innings.',
    ask: 'What do you do about it?',
    answers: [
      { text: 'Change them, say nothing, and give them one wrong one first.', skills: { defense: 1, offense: 1 }, leans: { ambition: 2, defense: 1 }, badge: 'gambler' },
      { text: 'Change them between innings and never mention it.', skills: { defense: 2 }, leans: { defense: 2, tradition: 1 }, badge: 'methodical' },
      { text: 'I walk down there and say so, in front of everybody.', skills: { recruiting: 1, offense: 1 }, leans: { tradition: 2, ambition: 1 }, badge: 'hardnosed' },
      { text: 'Nothing. If they have them they earned them.', skills: { training: 2 }, leans: { tradition: 3 }, badge: 'traditionalist' },
    ],
  },
  {
    id: 'the-third-catcher',
    setup: 'You are carrying three catchers because one is hurt,\nand it is costing you a bat on the bench every night.',
    ask: 'How long does that last?',
    answers: [
      { text: 'Until he is healthy. You never want to need a third catcher.', skills: { defense: 2 }, leans: { defense: 2, pitching: 1 }, badge: 'methodical' },
      { text: 'Not another week. Somebody learns to catch by Friday.', skills: { training: 2 }, leans: { development: 3 }, badge: 'developer' },
      { text: 'It ends tonight. I would rather risk it than lose the bat.', skills: { offense: 2 }, leans: { power: 2, ambition: 1 }, ambition: 1, badge: 'slugger' },
      { text: 'It lasts. The two healthy ones are worth more rested.', skills: { training: 1, defense: 1 }, leans: { loyalty: 2, development: 1 }, badge: 'players' },
    ],
  },
  {
    id: 'the-last-out',
    setup: 'Season over. Twenty-three men in a room that has\ngone very quiet, and you have one thing to say.',
    ask: 'What is it?',
    answers: [
      { text: 'Something about the four seniors, by name.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 3, tradition: 1 }, badge: 'keeper' },
      { text: 'Exactly what we are going to do differently, starting Monday.', skills: { training: 1, defense: 1 }, leans: { development: 2, ambition: 1 }, badge: 'hardnosed' },
      { text: 'Nothing worth remembering. This is not the day for a speech.', skills: { defense: 2 }, leans: { tradition: 2, loyalty: 1 }, badge: 'traditionalist' },
      { text: 'That it was mine, and that next year will not be.', skills: { training: 2 }, leans: { loyalty: 2, ambition: 1 }, badge: 'players' },
    ],
  },
  {
    id: 'the-fifth-year',
    setup: 'A senior can come back for a fifth year. He would start,\nand a freshman you signed to start would not.',
    ask: 'Do you take him back?',
    answers: [
      { text: 'Yes. He earned a fifth year and the freshman has four.', skills: { training: 1, defense: 1 }, leans: { loyalty: 3 }, ambition: -1, badge: 'keeper' },
      { text: 'No. I signed the freshman a promise and it was not a bench.', skills: { recruiting: 2 }, leans: { recruiting: 2, development: 1 }, badge: 'closer' },
      { text: 'Yes, and I tell the freshman exactly what the year looks like.', skills: { training: 1, recruiting: 1 }, leans: { loyalty: 2, development: 1 }, badge: 'players' },
      { text: 'Yes. Winning now is not a thing I apologise for.', skills: { offense: 1, defense: 1 }, leans: { ambition: 3 }, ambition: 2, badge: 'gambler' },
    ],
  },
  {
    id: 'the-worst-loss',
    setup: 'You have just lost in a way you will think about\nin the car, in the shower, and at three in the morning.',
    ask: 'Who hears about it?',
    answers: [
      { text: 'Nobody. It goes in the car with me and stays there.', skills: { defense: 2 }, leans: { tradition: 2, ambition: 1 }, badge: 'hardnosed' },
      { text: 'The room, tomorrow, once, and then we are done with it.', skills: { training: 1, defense: 1 }, leans: { development: 2, loyalty: 1 }, badge: 'methodical' },
      { text: 'The room, tonight, and I start with the part that was mine.', skills: { training: 2 }, leans: { loyalty: 3 }, badge: 'players' },
      { text: 'Whoever is still in the building at midnight looking at video.', skills: { training: 1, defense: 1 }, leans: { development: 3 }, badge: 'developer' },
    ],
  },
];
