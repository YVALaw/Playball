// The card each screen shows the first time it opens: what the screen is,
// in one line, and the one thing to do on it. One card per screen, in the
// screen's own words — every name below is a label the screen shows.
import { CONF_FIELD } from '../engine/postseason.js';
import { RECRUITING_WEEKS } from '../engine/recruiting.js';

export interface TutorialPage {
  title: string;
  body: string;
  action: string;
}

export const TUTORIALS: Record<string, TutorialPage> = {
  today: {
    title: 'Today',
    body: 'Your schedule on the wheel, and what needs you this week below it.',
    action: 'Settle anything highlighted, then tap Play ball or Sim game.',
  },
  wire: {
    title: 'News',
    body: 'Results and stories from around the country, yours first.',
    action: 'Tap a story to open that program.',
  },
  roster: {
    title: 'Roster',
    body: 'Now is how good a player is today, out of 100. Pot. is how good he can get.',
    action: 'Tap a player to open his card.',
  },
  lineup: {
    title: 'Lineup',
    body: 'The batting order, the positions and the pitching staff. Changes save as you make them.',
    action: 'Tap two players to swap them. Hold one to open his card.',
  },
  // A career whose staff sets the lineup: nothing here is the coach's to move.
  'lineup-staff': {
    title: 'Lineup',
    body: 'Your staff sets the order, the positions and the pitching.',
    action: 'Tap a player to open his card.',
  },
  stats: {
    title: 'Stats',
    body: 'What every player has done this season. Early on, a few games can mislead.',
    action: 'Switch between Your team, National and Fielding.',
  },
  season: {
    title: 'Schedule',
    body: `Every game this season. The top ${CONF_FIELD} in each conference play its tournament.`,
    action: 'Tap a result for the box score.',
  },
  program: {
    title: 'Board',
    body: 'At the end of the season the board checks these goals and decides your future.',
    action: 'Required goals keep the job. Bonus goals earn extra credit.',
  },
  'program-overview': {
    title: 'Program',
    body: 'The trophy case, the hall of fame and the players who went on.',
    action: 'Tap any of them to see it in full.',
  },
  budget: {
    title: 'Budget',
    body: 'Money pays for staff and buildings. Recruiting runs on its own weekly points.',
    action: 'Every price shows what you would have left.',
  },
  staff: {
    title: 'Coaching staff',
    body: 'Each coach has a focus that is always on, and season work on up to three players.',
    action: 'Tap a coach to set both.',
  },
  facilities: {
    title: 'Facilities',
    body: 'Buildings develop your players and open up your coaches’ season work.',
    action: 'Open a building to see what the next level adds and costs.',
  },
  coach: {
    title: 'Your career',
    body: 'Your record, skills and prestige go with you from school to school.',
    action: 'You earn coach points to spend on skills every June.',
  },
  network: {
    title: 'Recruiting network',
    body: 'In a pipeline state, recruits already know your program. Signings make it stronger.',
    action: 'Tap a state to see what its pipeline does.',
  },
  manage: {
    title: 'Your call',
    body: 'Pick a call for every batter. A call you cannot make says why.',
    action: 'Dugout has subs and the bullpen. Bench coach calls it for you.',
  },
  postseason: {
    title: 'June',
    body: 'Three stages: the conference tournament, the regionals and the national tournament.',
    action: 'Play or sim your next game. Bracket shows the whole field.',
  },
  awards: {
    title: 'Awards',
    body: 'The season’s best players and coaches.',
    action: 'Turn the cards one by one, or tap Turn them all.',
  },
  review: {
    title: 'Season review',
    body: 'How the year ended: your record, the board’s goals and what it means for your job.',
    action: 'Read it, then continue.',
  },
  coachpoints: {
    title: 'Coach points',
    body: 'Spend points on your skills. Points you keep carry over to next year.',
    action: 'You can take a point back until you continue.',
  },
  draftphase: {
    title: 'Draft',
    body: 'Pro teams took some of your players. Anyone you do not keep leaves.',
    action: 'Choose a pitch and make the offer. It costs offseason points, win or lose.',
  },
  portal: {
    title: 'Transfer portal',
    body: 'Players leaving you, and players looking for a school. Both draw on your offseason points.',
    action: 'Settle who you can before you continue. The rest go.',
  },
  recruiting: {
    title: 'Recruiting',
    body: `${RECRUITING_WEEKS} weeks to sign next year’s class. Your points reset each week, and unspent points are lost.`,
    action: 'Open a prospect to spend points on him. Only promise what you can keep.',
  },
  // The same board while the staff runs recruiting (2026-09-28): the coach
  // chooses who, the staff spends the points.
  'recruiting-staff': {
    title: 'Recruiting',
    body: 'Your staff works only the recruits you star, up to 8.',
    action: 'Tap a recruit’s star to add him to the list.',
  },
  signing: {
    title: 'Signing day',
    body: 'Everyone who committed joins your roster next season.',
    action: 'Look over the class, then continue.',
  },
};
