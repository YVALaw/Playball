// One short explanation and one action per tip.
import { CONF_FIELD, CONF_ADVANCE, NATIONAL_BIDS, PROTECTED_BIDS, SERIES } from '../engine/postseason.js';
import { RECRUITING_WEEKS } from '../engine/recruiting.js';

export interface TutorialPage {
  title: string;
  body: string;
  action: string;
}

export const TUTORIALS: Record<string, readonly TutorialPage[]> = {
  "today": [
    {
      title: "Your next game",
      body: "Today shows tonight\u2019s game, anything that blocks it, and how the week is going.",
      action: "Settle anything marked Blocks tonight\u2019s game, then tap Play ball.",
    },
  ],
  "wire": [
    {
      title: "Around the country",
      body: "Results, standout players and news from other programs, with yours first.",
      action: "Tap a story to open that program.",
    },
  ],
  "roster": [
    {
      title: "Meet your team",
      body: "Each player’s rating is how good he is now, out of 100. His ceiling is how good he can become.",
      action: "Tap a player for ratings, health, and stats.",
    },
  ],
  "lineup": [
    {
      title: "Set your order",
      body: "Lineup changes save immediately. Delegated lineups remain your bench coach’s call.",
      action: "Tap two players to swap them. Hold for stats.",
    },
    {
      title: "Positions and pitchers",
      body: "Position buttons assign fielders. Rotation sets starters; bullpen holds relievers.",
      action: "Check player health and pitcher readiness.",
    },
  ],
  "stats": [
    {
      title: "Read the numbers",
      body: "Ratings show ability; stats show results. A few games can mislead.",
      action: "Compare batting, pitching, or fielding before changing roles.",
    },
  ],
  "season": [
    {
      title: "Follow the season",
      body: `The top ${CONF_FIELD} teams in each conference reach its tournament.`,
      action: "Tap a played game for its box score, or a game to come to see the opponent.",
    },
  ],
  "program": [
    {
      title: "The board’s goals",
      body: "At the end of the season the board checks these goals and decides your job’s future.",
      action: "Required goals are the job. Stretch goals are a bonus.",
    },
  ],
  "program-overview": [
    {
      title: "Your program",
      body: "Each row is one part of the program, with its state and its number.",
      action: "Open a row to see it in full.",
    },
  ],
  "budget": [
    {
      title: "Your budget",
      body: "Money pays for staff, buildings and scouting reports. Recruiting uses its own weekly points.",
      action: "Every price shows what you would have left after.",
    },
  ],
  "staff": [
    {
      title: "Your coaching staff",
      body: "Each coach has a focus that is always on, and one project at a time.",
      action: "Tap a coach to set the focus or assign a project.",
    },
  ],
  "facilities": [
    {
      title: "Your buildings",
      body: "Each building makes players better and unlocks one coach’s projects.",
      action: "Each card shows what the next level adds, and its price.",
    },
  ],
  "coach": [
    {
      title: "Your career",
      body: "Your record, skills and prestige follow you from school to school.",
      action: "Skills grow with points you earn each June.",
    },
  ],
  "network": [
    {
      title: "Recruiting pipelines",
      body: "A pipeline is a state where recruits already know you. Signings and your coordinator’s projects make it stronger.",
      action: "Tap a state to see what its strength does.",
    },
    {
      title: "Scouting reports",
      body: "A report shows an opponent’s habits for a few days, and your playbook counters them.",
      action: "Buy one from a college’s profile.",
    },
  ],
  "manage": [
    {
      title: "Your call",
      body: "Swing away and Pitch are the standard calls. A call you can\u2019t make right now says why.",
      action: "Choose a call, then read what happened.",
    },
    {
      title: "The dugout",
      body: "Dugout, at the bottom, has pinch hitters, the bullpen, mound visits and the bench coach.",
      action: "After the last out, tap Record the game.",
    },
  ],
  "postseason": [
    {
      title: "1. Conference tournament",
      body: `Top ${CONF_FIELD} qualify. Two losses end your conference run.`,
      action: `Finish in the top ${CONF_ADVANCE} to reach regionals.`,
    },
    {
      title: "2. Regional series",
      body: `Best of ${SERIES.regional}. The ${NATIONAL_BIDS - PROTECTED_BIDS} series winners reach the national tournament.`,
      action: "Win two games to advance.",
    },
    {
      title: "3. National tournament",
      body: `${NATIONAL_BIDS} teams, two double-elimination brackets. Each bracket sends one finalist.`,
      action: `Win the best-of-${SERIES.final} final to become champion.`,
    },
    {
      title: "Guaranteed a place",
      body: `The regular season’s top ${PROTECTED_BIDS} are guaranteed a place in the national tournament. The rest of the field is picked from the best teams still in it.`,
      action: "Check where you stand after each round.",
    },
  ],
  "awards": [
    {
      title: "Season awards",
      body: "The year’s standout players and coaches.",
      action: "Tap a winner to see their season.",
    },
  ],
  "review": [
    {
      title: "Your season review",
      body: "See your results, board goals, prestige changes, and job decision.",
      action: "Review the outcome, then continue.",
    },
  ],
  "coachpoints": [
    {
      title: "Improve your skills",
      body: "Unspent points carry forward. New allocations can be undone until you continue.",
      action: "Choose a skill or save your points.",
    },
  ],
  "draftphase": [
    {
      title: "Keep a drafted player?",
      body: "Retention pitches cost offseason points, even if they fail. Transfers use this fund too.",
      action: "Try to keep players before continuing; unresolved draftees leave.",
    },
  ],
  "portal": [
    {
      title: "Manage transfers",
      body: "Retention and signings share your remaining offseason points.",
      action: "Try to keep departing players before continuing; unresolved players leave.",
    },
  ],
  "recruiting": [
    {
      title: "Recruit for next season",
      body: `Recruiting lasts ${RECRUITING_WEEKS} weeks. Your points refresh every week, and points you leave unspent are lost.`,
      action: "Check Positions needed, then plan a week on the prospects you want.",
    },
    {
      title: "Make your pitch",
      body: "Pitch what a prospect cares about most, where your program backs it up. A promise becomes a duty if he signs.",
      action: "Compare the point costs, and only promise what you can keep.",
    },
  ],
  "signing": [
    {
      title: "Meet your new class",
      body: "Committed recruits join your roster for next season.",
      action: "Review the class, then continue.",
    },
  ],
};
