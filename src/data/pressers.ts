// pressers.ts
// What you say afterwards, and what it costs you.
//
// The last piece of the coach, and the one deliberately written last. Sixty
// situations committed before knowing whether the voice landed would have been
// sixty situations of risk; the interview has now been played through two
// careers, so this is written to the voice that survived it.
//
// ---------------------------------------------------------------------------
// The voice, which is the interview's voice one room over
// ---------------------------------------------------------------------------
//
// Deadpan, and the reporter is not an idiot. He is doing his job, he has been
// doing it a while, and he asks the question everybody in the room is thinking
// rather than a hostile one. The comedy is in the situation and in the answer
// that is too pleased with itself -- never in a joke, because a joke read four
// times is worse than a line that was never trying.
//
// Setups are one line, for the same reason the interview's now are: measured at
// a median of 107 characters they read as furniture, and the question is the
// thing. Ninety is the ceiling here too, and a test holds it.
//
// ---------------------------------------------------------------------------
// What an answer does
// ---------------------------------------------------------------------------
//
//   `prestige`  what it does to your name. Recruiting reads coach prestige
//               directly (`recruiting.ts`), so this *is* "how recruits see
//               you" -- it is not a second, decorative number.
//
//   `security`  what the board makes of it. Small, and usually the price of
//               saying the honest thing rather than the safe one.
//
//   `badge`     the badge this answer belongs to. Wearing it makes the answer
//               land: the room has heard you say this sort of thing before and
//               it reads as a man being himself. Not wearing it costs a little,
//               because the same words out of a stranger's mouth are a pose.
//
// That last rule is the whole reason personality badges exist. Without them
// these answers are flavour; with them they are consistent with a man the
// player actually built, and the same sentence is worth different amounts to
// two different coaches.
//
// Morale is the third channel the plan named and it is not here, because there
// is no morale system yet -- it arrives with stage 8. Wiring an answer to a
// number that does not exist is how `Builder` shipped as a title nobody could
// earn, so these move the two things that are real.
//
// ---------------------------------------------------------------------------
// It cannot be failed
// ---------------------------------------------------------------------------
//
// Same rule as creation. No answer is wrong, none is rejected, and the spread
// between the best and worst reading of any one question is small enough that a
// season of them is a personality rather than a score. A coach who says the
// blunt thing every time should end up known for it, not behind.

/** When a presser fires. Each maps to something the season actually did. */
export type PressTrigger =
  | 'bigWin'        // beat a program well above you
  | 'badLoss'       // lost to one well below
  | 'losingStreak'
  | 'winningStreak'
  | 'knockedOut'    // your June ended
  | 'trophy'        // conference, regional or the whole thing
  | 'signingDay'
  | 'caughtLooking' // they found out you wrote to somebody
  | 'draftLoss';    // a man you tried to keep signed anyway

export interface PressAnswer {
  /** What the coach says. First person, no quotation marks. */
  readonly text: string;
  /** What it does to his name. Roughly -2 to +2. */
  readonly prestige: number;
  /** What the board makes of it. Roughly -2 to +2. */
  readonly security: number;
  /**
   * The badge this answer belongs to, if any.
   *
   * Wearing it is worth a little more; not wearing it a little less. The size
   * of that is in `settlePress` and is deliberately small -- it is a lean, not
   * a gate, and no answer is ever closed off.
   */
  readonly badge?: string;
}

export interface Presser {
  readonly id: string;
  readonly trigger: PressTrigger;
  /** One line. The room, and why it is asking. */
  readonly setup: string;
  /** The question. */
  readonly ask: string;
  readonly answers: readonly PressAnswer[];
}

export const PRESSERS: readonly Presser[] = [
  // -------------------------------------------------------------------------
  // After you beat somebody you had no business beating
  // -------------------------------------------------------------------------
  {
    id: 'bigwin-credit',
    trigger: 'bigWin',
    setup: 'You have just beaten a program that has never lost to you.',
    ask: 'Who wins that game for you?',
    answers: [
      { text: 'The kids. I wrote the card and then I watched it.', prestige: 1, security: 1, badge: 'players' },
      { text: 'Nobody in particular. That is what a team is.', prestige: 1, security: 0 },
      { text: 'The staff. We had them scouted three weeks ago.', prestige: 1, security: 1, badge: 'methodical' },
      { text: 'Me, mostly. You are welcome to write that down.', prestige: -1, security: -1, badge: 'gambler' },
    ],
  },
  {
    id: 'bigwin-fluke',
    trigger: 'bigWin',
    setup: 'Somebody has used the word upset four times in two minutes.',
    ask: 'Was it one?',
    answers: [
      { text: 'On paper. We do not play the paper.', prestige: 1, security: 0, badge: 'hardnosed' },
      { text: 'Yes. They are better than us and they will be in June.', prestige: 0, security: 1 },
      { text: 'Ask me in a month. One night proves very little.', prestige: 1, security: 1, badge: 'methodical' },
      { text: 'No. And I would like that quoted exactly.', prestige: -1, security: 0, badge: 'gambler' },
    ],
  },
  {
    id: 'bigwin-next',
    trigger: 'bigWin',
    setup: 'The room would like to know what it means for the rest of it.',
    ask: 'Does this change your season?',
    answers: [
      { text: 'It changes nothing. There are forty games left.', prestige: 1, security: 1, badge: 'grinder' },
      { text: 'It tells the freshmen what the ceiling looks like.', prestige: 1, security: 0, badge: 'youth' },
      { text: 'We are in every game on that schedule now.', prestige: 0, security: -1, badge: 'gambler' },
      { text: 'I will enjoy it until the bus leaves.', prestige: 1, security: 0 },
    ],
  },

  // -------------------------------------------------------------------------
  // After one you should not have lost
  // -------------------------------------------------------------------------
  {
    id: 'badloss-blame',
    trigger: 'badLoss',
    setup: 'You have lost to a team you were expected to beat comfortably.',
    ask: 'What happened out there?',
    answers: [
      { text: 'I had them ready for the wrong game. That is on me.', prestige: 1, security: -1, badge: 'players' },
      { text: 'We were beaten. It happens on a Tuesday in April.', prestige: 0, security: 1 },
      { text: 'We did not do the small things. We will tomorrow.', prestige: 1, security: 1, badge: 'smallball' },
      { text: 'You saw it. I am not going to narrate it for you.', prestige: -1, security: -1, badge: 'hardnosed' },
    ],
  },
  {
    id: 'badloss-name',
    trigger: 'badLoss',
    setup: 'He asks whether anybody in particular let you down.',
    ask: 'Anyone you want to name?',
    answers: [
      { text: 'No. I do not do that, and you know I do not.', prestige: 2, security: 0, badge: 'players' },
      { text: 'Twenty-three of them and me. Take your pick.', prestige: 1, security: 0 },
      { text: 'They know who they are. So do I.', prestige: -1, security: 1, badge: 'hardnosed' },
      { text: 'The schedule. We have played nine days running.', prestige: 0, security: 0, badge: 'ironman' },
    ],
  },
  {
    id: 'badloss-changes',
    trigger: 'badLoss',
    setup: 'The obvious follow-up, asked without any relish.',
    ask: 'Are you changing the lineup?',
    answers: [
      { text: 'No. I picked these men in February and I meant it.', prestige: 1, security: -1, badge: 'loyalist' },
      { text: 'Somebody will get a look who has not had one.', prestige: 0, security: 1, badge: 'youth' },
      { text: 'I change it when it is broken, not when it is loud.', prestige: 1, security: 0, badge: 'methodical' },
      { text: 'Everything is on the table tonight.', prestige: -1, security: 0, badge: 'gambler' },
    ],
  },

  // -------------------------------------------------------------------------
  // The bad run
  // -------------------------------------------------------------------------
  {
    id: 'streak-bad-mood',
    trigger: 'losingStreak',
    setup: 'Four in a row, and somebody asks how the room is holding up.',
    ask: 'How are they taking it?',
    answers: [
      { text: 'Badly, which is the correct way to take it.', prestige: 1, security: 0, badge: 'hardnosed' },
      { text: 'They are fine. I am the one who is not sleeping.', prestige: 1, security: -1, badge: 'players' },
      { text: 'We worked this morning like we had won four.', prestige: 1, security: 1, badge: 'grinder' },
      { text: 'I would rather not discuss my dressing room here.', prestige: 0, security: 0 },
    ],
  },
  {
    id: 'streak-bad-job',
    trigger: 'losingStreak',
    setup: 'The question everybody waited for somebody else to ask.',
    ask: 'Do you feel pressure on your position?',
    answers: [
      { text: 'I feel pressure to win Friday. That is the whole list.', prestige: 1, security: 1, badge: 'grinder' },
      { text: 'That is the board business, and they know where I sit.', prestige: 0, security: -1 },
      { text: 'Everybody here is one bad month from a rumour.', prestige: 1, security: 0 },
      { text: 'No. And I would take this job again on Monday.', prestige: 1, security: 1, badge: 'keeper' },
    ],
  },

  // -------------------------------------------------------------------------
  // The good run
  // -------------------------------------------------------------------------
  {
    id: 'streak-good-ceiling',
    trigger: 'winningStreak',
    setup: 'Six straight, and the room has started using large words.',
    ask: 'How good is this team?',
    answers: [
      { text: 'Good enough to have won six. That is all I know.', prestige: 1, security: 1, badge: 'methodical' },
      { text: 'Better than I told you in February. I was wrong then.', prestige: 1, security: 0 },
      { text: 'We can beat anybody on that schedule.', prestige: 0, security: -1, badge: 'gambler' },
      { text: 'Ask the men who have to play us.', prestige: 1, security: 0, badge: 'hardnosed' },
    ],
  },
  {
    id: 'streak-good-omaha',
    trigger: 'winningStreak',
    setup: 'Somebody says the word Omaha out loud and then waits.',
    ask: 'Is that where this is going?',
    answers: [
      { text: 'It is May. We have not qualified for anything.', prestige: 1, security: 1, badge: 'grinder' },
      { text: 'That is the point of doing this. I will not pretend.', prestige: 1, security: 0, badge: 'closer' },
      { text: 'I do not say that word until somebody hands me a bid.', prestige: 1, security: 1, badge: 'traditionalist' },
      { text: 'Book your room now and thank me later.', prestige: -1, security: -1, badge: 'gambler' },
    ],
  },

  // -------------------------------------------------------------------------
  // When it ends
  // -------------------------------------------------------------------------
  {
    id: 'out-seniors',
    trigger: 'knockedOut',
    setup: 'It ended an hour ago and the seniors are still in there.',
    ask: 'What did you say to them?',
    answers: [
      { text: 'That is theirs. It is not going in a paper.', prestige: 2, security: 0, badge: 'players' },
      { text: 'Thank you. Four years is a long time to give a place.', prestige: 1, security: 1, badge: 'loyalist' },
      { text: 'Not much. There is not much that helps tonight.', prestige: 1, security: 0 },
      { text: 'We talked about next year. It starts Monday.', prestige: 0, security: 1, badge: 'grinder' },
    ],
  },
  {
    id: 'out-verdict',
    trigger: 'knockedOut',
    setup: 'He asks you to sum up a season while you are in the tunnel.',
    ask: 'How do you look back on it?',
    answers: [
      { text: 'I do not, tonight. Ask me in a fortnight.', prestige: 1, security: 0 },
      { text: 'We were short. I know where, and I will fix it.', prestige: 1, security: 1, badge: 'developer' },
      { text: 'We got everything out of that group. Everything.', prestige: 1, security: 1, badge: 'overachiever' },
      { text: 'Not good enough, and I will not dress it up.', prestige: 1, security: -1, badge: 'hardnosed' },
    ],
  },

  // -------------------------------------------------------------------------
  // When you win one
  // -------------------------------------------------------------------------
  {
    id: 'trophy-who',
    trigger: 'trophy',
    setup: 'There is a trophy on the table and a lot of people in the room.',
    ask: 'Who do you think about first?',
    answers: [
      { text: 'The men who were here when it was not like this.', prestige: 2, security: 1, badge: 'loyalist' },
      { text: 'The seniors. They bought this with four years.', prestige: 1, security: 1, badge: 'players' },
      { text: 'The staff. Nobody photographs them.', prestige: 1, security: 1, badge: 'methodical' },
      { text: 'My predecessor, briefly, and then I stopped.', prestige: 0, security: 0 },
    ],
  },
  {
    id: 'trophy-next',
    trigger: 'trophy',
    setup: 'The second question, thirty seconds after the first.',
    ask: 'Can you do it again?',
    answers: [
      { text: 'I would like to enjoy this one for an evening.', prestige: 1, security: 0 },
      { text: 'That is the job. We start on it Monday.', prestige: 1, security: 1, badge: 'grinder' },
      { text: 'We are built to. That is what three years were for.', prestige: 1, security: 1, badge: 'developer' },
      { text: 'Yes. Write it down and hold me to it.', prestige: 0, security: -1, badge: 'gambler' },
    ],
  },

  // -------------------------------------------------------------------------
  // Signing day
  // -------------------------------------------------------------------------
  {
    id: 'signing-rank',
    trigger: 'signingDay',
    setup: 'Somebody has the national ranking of your class on a phone.',
    ask: 'Is that a fair number?',
    answers: [
      { text: 'It is a number. I have watched them play.', prestige: 1, security: 0, badge: 'developer' },
      { text: 'Nobody ranks what a kid looks like in three years.', prestige: 1, security: 1, badge: 'developer' },
      { text: 'We got the men we went after. That is my ranking.', prestige: 1, security: 1, badge: 'methodical' },
      { text: 'It is too low and everybody here knows it.', prestige: 0, security: -1, badge: 'gambler' },
    ],
  },
  {
    id: 'signing-miss',
    trigger: 'signingDay',
    setup: 'A recruit everybody expected here has signed somewhere else.',
    ask: 'What happened with him?',
    answers: [
      { text: 'He picked another place. That is allowed.', prestige: 1, security: 1 },
      { text: 'We were second. Second gets you nothing and I know it.', prestige: 1, security: 0, badge: 'hardnosed' },
      { text: 'I would rather talk about the ones who did sign.', prestige: 1, security: 1, badge: 'loyalist' },
      { text: 'He will be watching us in June. I leave it there.', prestige: -1, security: 0, badge: 'gambler' },
    ],
  },

  // -------------------------------------------------------------------------
  // The letter that got out
  // -------------------------------------------------------------------------
  {
    id: 'caught-letter',
    trigger: 'caughtLooking',
    setup: 'It is out that you wrote to another program. He has the letter.',
    ask: 'Are you leaving?',
    answers: [
      { text: 'I wrote to them. I am here Friday and here in October.', prestige: 1, security: 1 },
      { text: 'Every man in this job takes a call. Mine got printed.', prestige: 1, security: -1, badge: 'hardnosed' },
      { text: 'I am not discussing my correspondence with you.', prestige: -1, security: -1 },
      { text: 'No. The people who needed to hear that already have.', prestige: 1, security: 1, badge: 'keeper' },
    ],
  },
  {
    id: 'caught-players',
    trigger: 'caughtLooking',
    setup: 'The harder version of the same question, and a fair one.',
    ask: 'What do you tell your players?',
    answers: [
      { text: 'I told them this morning, before you printed it.', prestige: 2, security: 1, badge: 'players' },
      { text: 'That I am their coach until somebody says otherwise.', prestige: 1, security: 0 },
      { text: 'Nothing. They are nineteen and they play Friday.', prestige: -1, security: 0 },
      { text: 'That everybody here is looking at something.', prestige: 0, security: -1, badge: 'hardnosed' },
    ],
  },

  // -------------------------------------------------------------------------
  // A man you wanted back who went anyway
  // -------------------------------------------------------------------------
  {
    id: 'draft-gone',
    trigger: 'draftLoss',
    setup: 'A man you tried to keep has signed professionally.',
    ask: 'Did you push him to stay?',
    answers: [
      { text: 'I made the case and then I shook his hand.', prestige: 1, security: 1, badge: 'players' },
      { text: 'Hard. He is nineteen and there is no hurry.', prestige: 0, security: 0, badge: 'developer' },
      { text: 'No. You do not talk a man out of that money.', prestige: 1, security: 0, badge: 'keeper' },
      { text: 'He owed this place another year and he knows it.', prestige: -2, security: -1 },
    ],
  },
  {
    id: 'draft-replace',
    trigger: 'draftLoss',
    setup: 'He was your best player and the room knows what that costs.',
    ask: 'Who replaces him?',
    answers: [
      { text: 'Nobody. Somebody gets his innings, which is different.', prestige: 1, security: 1, badge: 'methodical' },
      { text: 'A freshman you have not heard of yet.', prestige: 1, security: 0, badge: 'youth' },
      { text: 'We recruited for this. It is why we recruit.', prestige: 1, security: 1, badge: 'developer' },
      { text: 'I will tell you when I have stopped being annoyed.', prestige: 0, security: 0 },
    ],
  },
];
