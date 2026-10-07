// The card each screen shows the first time it opens: what the screen is,
// how it works, and what to do on it. One card per screen, in the screen's
// own words: every label named below is one the screen shows.
//
// Rewritten 2026-10-07 after a playtest: the one-line cards read as cut off
// mid-thought, and some taught the screen wrong (the Lineup card never said
// the field at the top changes positions). Each card now says it whole, in
// full sentences, and stays short enough to read in one go.
import { CONF_ADVANCE, CONF_FIELD, NATIONAL_BIDS } from '../engine/postseason.js';
import { RECRUITING_WEEKS, SCHOLARSHIPS } from '../engine/recruiting.js';

export interface TutorialPage {
  title: string;
  /** What the screen is for, in a sentence or two. */
  body: string;
  /** How it works: the few things a first visit needs, one sentence each. */
  points?: readonly string[];
  /** The thing to do here now. */
  action: string;
}

export const TUTORIALS: Record<string, TutorialPage> = {
  today: {
    title: 'Today',
    body: 'Your home base for the season. The wheel at the top is your schedule, and To do lists what needs you before the next game.',
    points: [
      'Turn the wheel to look ahead or back. Tap the game in front to see the other team, or the box score once it is played.',
      'Some To do items have to be settled first. Until they are, Play ball is locked and says Settle the list.',
      'Play ball lets you coach the game live. Sim game plays it for you, and Sim week plays the rest of the week.',
    ],
    action: 'Clear your To do list, then choose Play ball, Sim game or Sim week.',
  },
  wire: {
    title: 'News',
    body: 'Results and stories from around the country. Stories about your program come up higher.',
    points: [
      'The chips at the top narrow the news to your program or your conference.',
    ],
    action: 'Tap a story to open that program.',
  },
  roster: {
    title: 'Roster',
    body: 'Everyone on your team, grouped by position.',
    points: [
      'The big number is Now: how good a player is today, out of 100.',
      'The letter is Pot.: how good he can become, from D up to S+.',
      'Injured, Draft risk and Unhappy at the top show only those players. Tap one again to see everyone.',
    ],
    action: 'Tap a player to open his card.',
  },
  // The batting side, when the lineup is yours.
  lineup: {
    title: 'Lineup',
    body: 'Tonight’s batting order and who plays where. Every change saves as you make it.',
    points: [
      'To change the order, tap a batter, then the batter you want him to swap with.',
      'To change positions, use the field at the top: tap a name on it and choose who plays there. Or tap a batter, then a spot on the field.',
      'To bring in someone from the Bench, tap him, then the batter he replaces.',
      'Every position has to be covered before a game. Cover the positions fixes a gap, and Auto lineup sets the whole card for you.',
    ],
    action: 'Tap a player, then a batter, a spot on the field or the bench. Hold a player to open his card.',
  },
  // The batting side, when the bench coach writes the card.
  'lineup-staff': {
    title: 'Lineup',
    body: 'Your bench coach writes the batting order and picks the positions for every game.',
    points: [
      'To set them yourself, turn on Lineups in Settings, under What you handle.',
    ],
    action: 'Tap a player to open his card.',
  },
  // The Pitching tab, when the rotation and bullpen are yours.
  'lineup-pitching': {
    title: 'Pitching',
    body: 'Who starts each game of the series, and who comes out of the bullpen.',
    points: [
      'Tap two starters to swap their days.',
      'Tap a starter and a reliever to trade their jobs: the reliever takes the day.',
      'Tap two relievers to swap them. Once you set the bullpen order, the arm at the top is your closer.',
    ],
    action: 'Tap a pitcher, then a day or a reliever.',
  },
  // The Pitching tab, when the pitching coach runs the pen.
  'lineup-pitching-staff': {
    title: 'Pitching',
    body: 'Your pitching coach picks the starters and runs the bullpen.',
    points: [
      'To run them yourself, turn on Rotation and bullpen in Settings, under What you handle.',
    ],
    action: 'Tap a pitcher to open his card.',
  },
  stats: {
    title: 'Stats',
    body: 'The season’s leaderboards: the top five in each category.',
    points: [
      'Your team ranks your own players. National ranks everyone, and marks yours.',
      'Fielding shows who makes the most plays above average. Postseason appears once June games are played.',
      'Early in the season, a few games can move these a lot.',
    ],
    action: 'Tap a player to open his card.',
  },
  season: {
    title: 'Schedule',
    body: 'Every game of your season: what is coming up, and your results series by series.',
    points: [
      'Tap a result for its box score and a replay of the game.',
      'Tap a game still to come to see the other team.',
      `In June, the top ${CONF_FIELD} teams in each conference play its tournament.`,
    ],
    action: 'Tap any game to open it.',
  },
  program: {
    title: 'Board',
    body: 'What your board expects this season, and how safe your job is.',
    points: [
      'Security, out of 100, is your job safety. Under 35 you are under review, and falling much lower can cost you the job.',
      'At the end of the season the board checks This year’s goals. Missing a Required goal costs a lot of security.',
      'Bonus goals are extra. Meeting them on top of the Required ones earns more security, and can earn a longer contract.',
      'When your contract runs out, the board renews it only if your security is high enough.',
    ],
    action: 'Meet every Required goal first, then go after the Bonus ones.',
  },
  'program-overview': {
    title: 'Program',
    body: 'Your school’s history: its trophies, its greatest players and everyone who played for it.',
    points: [
      'The Trophy case opens every season’s finish.',
      'The Hall of Fame holds the program’s best players. Alumni follows everyone who has left, including those drafted by pro teams.',
      'After two seasons, Record by season shows how each year went.',
    ],
    action: 'Tap the Trophy case, the Hall of Fame or the alumni to open them.',
  },
  budget: {
    title: 'Budget',
    body: 'This season’s money. It pays your coaches’ wages and your buildings, and a new budget arrives each February.',
    points: [
      'Recruiting does not cost money. It runs on its own weekly points.',
      'What the rest can buy lists the hires and buildings left within reach, cheapest first.',
    ],
    action: 'Tap a row to hire that coach or work on that building.',
  },
  staff: {
    title: 'Coaching staff',
    body: 'Three coaches: pitching, hitting and a recruiting coordinator. Each one makes your program better in his own area.',
    points: [
      'Each coach has a Focus that works all year. You can change it any time.',
      'Season work is extra. Your pitching or hitting coach works with up to 3 players, and your coordinator builds up one state.',
      'Season work needs that coach’s building, and it starts during the recruiting weeks. Work on players that matches the coach’s focus adds +1 for each one.',
    ],
    action: 'Tap a coach to set his focus and season work, or tap an open seat to hire one.',
  },
  facilities: {
    title: 'Facilities',
    body: 'Three buildings, each up to level 3. Building and upgrading them comes out of this season’s budget.',
    points: [
      'The Hitting Barn grows your hitters. The Pitching Lab grows your pitchers and protects their arms.',
      'The Clubhouse makes your program more appealing to recruits.',
      'Each building also opens up season work for its coach.',
    ],
    action: 'Open a building to see what the next level adds and what it costs.',
  },
  coach: {
    title: 'Your profile',
    body: 'You, the coach. Your record, your skills and your prestige go with you from school to school.',
    points: [
      'Skills shows your four coaching skills, out of 99. They make your teams play and recruit better.',
      'You earn coach points after every season, more for a good June, and spend them on skills in the offseason.',
      'Career lists every school you have coached, and the coaches who came from your staff.',
    ],
    action: 'Look through Overview, Skills, Career and Trophies.',
  },
  network: {
    title: 'Recruiting network',
    body: 'How strong your recruiting is in each state, out of 100. Your home state starts strong.',
    points: [
      'At 35 a state becomes a pipeline, and its recruits fit your program better.',
      'At 60 you can reach recruits there one star above your usual level.',
      'Signing players from a state makes it stronger. A state you leave alone fades a little each year.',
    ],
    action: 'Tap a state to see its strength and plan work there.',
  },
  manage: {
    title: 'Coaching live',
    body: 'You make a call before every pitch. A call that does not fit the moment is greyed out and says why.',
    points: [
      'At bat, choose how he swings, bunts or runs. In the field, choose how to pitch to him and where your infield plays.',
      'Dugout holds your moves, like a pinch hitter, and lets you sim the rest of the game.',
      'Tap Bench coach to let him make the calls. Take over gives them back to you.',
    ],
    action: 'Pick a call to play the next pitch.',
  },
  postseason: {
    title: 'June',
    body: 'The postseason, in three stages: the conference tournament, the regionals and the national tournament.',
    points: [
      `The top ${CONF_FIELD} in each conference play a double-elimination tournament: two losses and you are out. The top ${CONF_ADVANCE} go on.`,
      'The regionals are best-of-three series against teams from the conference next door.',
      `The national tournament has ${NATIONAL_BIDS} teams in two double-elimination brackets. The two winners play a best-of-three final.`,
      'If you are knocked out, Games to watch follows the rest of June.',
    ],
    action: 'Play or sim your next game. Bracket and Find my team show the whole field.',
  },
  awards: {
    title: 'Awards',
    body: 'The season’s honors: the national awards, the All-Conference first team and Coach of the Year.',
    points: [
      'Your own winners are marked as yours.',
    ],
    action: 'Tap each card to turn it over, or tap Turn them all.',
  },
  review: {
    title: 'Season review',
    body: 'The board’s verdict on your year comes first, then how the season ended.',
    points: [
      'The board’s goals show which ones you met. Required goals count the most toward your security.',
      'Your security moves with the verdict, and it decides whether your contract is renewed.',
    ],
    action: 'Read it through, then tap the button at the bottom to move on.',
  },
  coachpoints: {
    title: 'Coach points',
    body: 'Points from this season to spend on your four skills: Offense, Defense, Training and Recruiting.',
    points: [
      'Every season earns 3, and more for a conference title, a place in the national tournament or a national title.',
      'Unspent points carry over to next year.',
      'Tap − to take back a point you added, until you continue.',
    ],
    action: 'Tap + on a skill to spend a point.',
  },
  draftphase: {
    title: 'Draft',
    body: 'Pro teams have drafted college players. A drafted junior can be talked into staying; drafted seniors leave.',
    points: [
      'Let him sign is free and lets him go. Make your pitch tries to keep him.',
      'A pitch costs offseason points, spent whether he stays or not. The same points pay for the transfer portal next.',
      'Anyone you have not decided on signs with his club when you move on.',
    ],
    action: 'Decide on each player under Waiting on you.',
  },
  portal: {
    title: 'Transfer portal',
    body: 'Leaving you lists your players who want to transfer. Available lists players looking for a new school.',
    points: [
      'Paying the points shown keeps a player for sure, or signs a new one. It comes out of the offseason points the draft left you.',
      'When you move on, anyone still under Leaving you is gone.',
    ],
    action: 'Keep who you want, sign who you can afford, then continue.',
  },
  recruiting: {
    title: 'Recruiting',
    body: `${RECRUITING_WEEKS} weeks to sign next year’s class, with ${SCHOLARSHIPS} scholarships to fill. Each week brings points to spend, and points you do not spend that week are lost.`,
    points: [
      'A week ends as your games are played. The interest you build in a recruit stays from week to week.',
      'Open a prospect to spend on him: steady Effort, a pitch about your program, and one big move a week, like a visit or a promise.',
      'Only promise what you can keep. A broken promise hurts him once he is on your team.',
      'Your targets, Committed and Positions needed are at the top, and Filter narrows the list.',
    ],
    action: 'Open a prospect and spend this week’s points.',
  },
  // The same board while the staff runs recruiting (2026-09-28): the coach
  // chooses who, the staff spends the points.
  'recruiting-staff': {
    title: 'Recruiting',
    body: 'Your staff runs recruiting. Each week they work the recruits you star, up to 8.',
    points: [
      'They work the list in order, so the recruit at the top gets the most effort.',
      'Staff list shows your list. Use these fills it with your staff’s suggestions.',
      'With nobody starred, your staff does nothing.',
    ],
    action: 'Tap the star beside a recruit to add him to the list.',
  },
  signing: {
    title: 'Signing day',
    body: 'Your new class joins the roster, and their real ratings are in.',
    points: [
      'Walk-ons fill any spots the class did not.',
      'Class rankings shows how your class compares with everyone else’s.',
    ],
    action: 'Look over your class, then tap Start next season.',
  },
};
