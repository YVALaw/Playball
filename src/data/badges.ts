// badges.ts
// What kind of coach a man turns out to be.
//
// A coach already has four skills — offense, defense, training, recruiting —
// and badges are deliberately *not* a vaguer copy of them. A skill is how good
// you are at something. A badge is a thing you are known for, and each one names
// exactly one channel rather than gesturing at a general quality.
//
// ---------------------------------------------------------------------------
// Named and visible, effect unstated
// ---------------------------------------------------------------------------
//
// The badge and its line are printed on the coach card. The number behind it is
// not. That was a deliberate decision: a player should know he is a players'
// coach and what that means in words, without being handed a spreadsheet to
// optimise against. `effect` below is written for the person maintaining this
// file, not for the screen.
//
// ---------------------------------------------------------------------------
// Two roads in
// ---------------------------------------------------------------------------
//
// `interview` badges come out of the five creation questions — two of them, from
// what the answers had in common. `earned` badges come from how a career is
// actually played, on counters the save keeps and thresholds that are seeded per
// save, so nobody can be told how many mound visits is enough and nobody can
// farm one in an afternoon.
//
// Five carried at most, and permanent once earned.
//
// ---------------------------------------------------------------------------
// Why none of them do anything yet
// ---------------------------------------------------------------------------
//
// Every effect here is a modifier on a calibrated engine, and stage 6 was the
// expensive lesson in what happens when new modifiers arrive alongside a new
// system: a five percent league-wide inflation that took two measured sweeps to
// attribute. So badges are defined and awarded now, and their effects land in
// one measured pass with the rest of the engine-touching work. A badge that
// silently did nothing forever would be theatre; a badge whose effect is
// scheduled and written down is a promise with a date on it.

import type { CultureEdge } from './cultures.js';

export type BadgeSource = 'interview' | 'earned';

export interface Badge {
  readonly id: string;
  /** What the card says. Two or three words. */
  readonly name: string;
  /** The line under it. What he is known for, in his players' words. */
  readonly line: string;
  readonly source: BadgeSource;
  /**
   * The one channel this moves. Not printed anywhere — see the note above.
   * Unwired until the measured pass; see `07-v1-plan.md` piece 7.
   */
  readonly effect: string;
  /**
   * The culture that values this most, if any.
   *
   * A developer is worth more at a school that develops. It is what makes a
   * badge part of the job market rather than only part of the coach.
   */
  readonly prized?: CultureEdge;
}

export const BADGES: readonly Badge[] = [
  // --- Out of the interview -------------------------------------------------
  {
    id: 'players', name: 'Players’ coach', source: 'interview',
    line: 'They would run through a wall, and occasionally do.',
    effect: 'Morale swings damp faster.', prized: 'loyalty',
  },
  {
    id: 'hardnosed', name: 'Hard-nosed', source: 'interview',
    line: 'Nobody has ever described a practice here as pleasant.',
    effect: 'Teams hold up better in the late innings.', prized: 'defense',
  },
  {
    id: 'developer', name: 'Developer', source: 'interview',
    line: 'He would rather build one than buy one.',
    effect: 'Returning players develop further.', prized: 'development',
  },
  {
    id: 'closer', name: 'The closer', source: 'interview',
    line: 'He gets the kid who was going somewhere else.',
    effect: 'Hours on a recruit count for more.', prized: 'recruiting',
  },
  {
    id: 'gambler', name: 'Gambler', source: 'interview',
    line: 'He sends the runner. He has always sent the runner.',
    effect: 'Aggressive calls land more often.', prized: 'ambition',
  },
  {
    id: 'grinder', name: 'Grinder', source: 'interview',
    line: 'His teams are never comfortable and never finished.',
    effect: 'Better in one-run games.', prized: 'defense',
  },
  {
    id: 'keeper', name: 'The keeper', source: 'interview',
    line: 'Men who sign for him tend to graduate for him.',
    effect: 'Fewer men leave early.', prized: 'loyalty',
  },
  {
    id: 'traditionalist', name: 'Traditionalist', source: 'interview',
    line: 'He knows what the programme did in 1974 and why it mattered.',
    effect: 'Prestige builds faster where history is prized.', prized: 'tradition',
  },
  {
    id: 'armsman', name: 'Arms man', source: 'interview',
    line: 'He will take the pitcher every time, and has.',
    effect: 'Pitchers develop further.', prized: 'pitching',
  },
  {
    id: 'methodical', name: 'By the book', source: 'interview',
    line: 'He has a number for everything and does not move off it.',
    effect: 'Arms are worked closer to their limit without going past it.', prized: 'pitching',
  },
  {
    id: 'slugger', name: 'Swing away', source: 'interview',
    line: 'He has never asked a man to shorten up in his life.',
    effect: 'More power out of the same bats.', prized: 'power',
  },

  // --- Earned by playing ----------------------------------------------------
  {
    id: 'ironman', name: 'Never a night off', source: 'earned',
    line: 'He has managed every game he was allowed to manage.',
    effect: 'Small edge in games taken personally.',
  },
  {
    id: 'penhand', name: 'The pen', source: 'earned',
    line: 'He is out of that dugout before the second walk.',
    effect: 'Relievers settle faster.', prized: 'pitching',
  },
  {
    id: 'smallball', name: 'Small ball', source: 'earned',
    line: 'Bunt, run, take the extra base, go home.',
    effect: 'Steals and bunts land more often.',
  },
  {
    id: 'youth', name: 'Plays the kids', source: 'earned',
    line: 'Freshmen get innings here, and everybody knows it.',
    effect: 'Younger players develop further.', prized: 'development',
  },
  {
    id: 'loyalist', name: 'Four-year man', source: 'earned',
    line: 'Almost nobody leaves early, and it is not an accident.',
    effect: 'Fewer men enter the draft.', prized: 'loyalty',
  },
  {
    id: 'newsman', name: 'Reads the room', source: 'earned',
    line: 'He knows what every programme in the country is doing.',
    effect: 'Rival tendencies come easier.', prized: 'recruiting',
  },
  {
    id: 'comeback', name: 'Never dead', source: 'earned',
    line: 'His teams have won too many games they had no business in.',
    effect: 'Better when trailing late.',
  },
  {
    id: 'roadman', name: 'Travels well', source: 'earned',
    line: 'The bus does not bother him and it does not bother them.',
    effect: 'Smaller road penalty.',
  },
  {
    id: 'overachiever', name: 'More than he had', source: 'earned',
    line: 'Every roster he has been given finished above where it started.',
    effect: 'Prestige rises faster on a good year.', prized: 'development',
  },
  {
    id: 'talker', name: 'The persuader', source: 'earned',
    line: 'Men who were leaving have a coffee with him and stay.',
    effect: 'Better odds of talking a man out of the draft.', prized: 'loyalty',
  },
];

/** The most a coach can wear. Five is legible; ten is a spreadsheet. */
export const MAX_BADGES = 5;

export const badgeOf = (id: string): Badge | undefined =>
  BADGES.find((b) => b.id === id);

export const INTERVIEW_BADGES: readonly Badge[] =
  BADGES.filter((b) => b.source === 'interview');
