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
      body: "Today brings together games, messages, and team decisions.",
      action: "Clear required items, then tap PLAY BALL.",
    },
  ],
  "wire": [
    {
      title: "Around the league",
      body: "Results, standout players, and news from other programs.",
      action: "Tap a story to read more.",
    },
  ],
  "roster": [
    {
      title: "Meet your team",
      body: "OVR is current ability. POT is potential for growth.",
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
      action: "Tap a game for details or check the standings.",
    },
  ],
  "program": [
    {
      title: "Board goals",
      body: "Your season review checks these goals and decides your job’s future.",
      action: "Check required goals and their progress.",
    },
  ],
  "program-overview": [
    {
      title: "Run your program",
      body: "Manage your budget, staff, facilities, and board goals here.",
      action: "Choose a section to get started.",
    },
  ],
  "budget": [
    {
      title: "Program funds",
      body: "Cash pays for staff, facilities, and scouting. Recruiting uses separate points.",
      action: "Check the cost and cash left before buying.",
    },
  ],
  "staff": [
    {
      title: "Your coaching staff",
      body: "Each coach has an ongoing focus and one project at a time.",
      action: "Open a role to hire, assign work, or review the contract.",
    },
  ],
  "facilities": [
    {
      title: "Upgrade your facilities",
      body: "Each facility supports a staff role and unlocks its projects.",
      action: "Compare the benefit, price, and cash left.",
    },
  ],
  "coach": [
    {
      title: "Your career",
      body: "Your record, skills, and coach prestige follow you between schools.",
      action: "Check your skills and contract.",
    },
  ],
  "network": [
    {
      title: "Recruiting pipelines",
      body: "Pipelines are state relationships that improve recruiting. Signings and coordinator projects strengthen them.",
      action: "Choose a state to view your network.",
    },
    {
      title: "Opponent scouting",
      body: "Reports reveal opponent tendencies and expire after the shown period.",
      action: "Open a program profile to buy a report.",
    },
  ],
  "manage": [
    {
      title: "Your call",
      body: "SWING AWAY and PITCH are standard plays. Other choices depend on the situation.",
      action: "Choose a call, then read the result.",
    },
    {
      title: "Dugout tools",
      body: "The round dugout button opens substitutions, pitching changes, and simulation.",
      action: "After the game, tap RECORD THE GAME to advance.",
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
      body: `Best of ${SERIES.regional}. The ${NATIONAL_BIDS - PROTECTED_BIDS} series winners reach nationals.`,
      action: "Win two games to advance.",
    },
    {
      title: "3. National tournament",
      body: `${NATIONAL_BIDS} teams, two double-elimination brackets. Each bracket sends one finalist.`,
      action: `Win the best-of-${SERIES.final} final to become champion.`,
    },
    {
      title: "Protected national places",
      body: `The regular season’s top ${PROTECTED_BIDS} are guaranteed entry. Remaining places go to the best eligible teams.`,
      action: "Check your qualification status after each round.",
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
      body: `Recruiting lasts ${RECRUITING_WEEKS} weeks. Weekly recruiting points (RP) expire when the week advances.`,
      action: "Check Needs, then choose your targets.",
    },
    {
      title: "Make your pitch",
      body: "Recruit priorities shape each pitch. Promises become obligations if they sign.",
      action: "Compare actions and RP costs. Promise only what you can deliver.",
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
