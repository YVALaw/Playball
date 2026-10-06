// coachEdges.ts
// What a coach's badges do, as numbers.
//
// The badges themselves (names, lines, how they are earned) live in
// data/badges.ts. They were defined and awarded for a long time with nothing
// behind them, on purpose: data/badges.ts explains that every effect is a
// modifier on a calibrated engine and they were to land together in one
// measured pass. This is that pass (audit 17, Phase 2 follow-up).
//
// Every edge is small, a percent or three, and situational where the badge's
// line is situational. Only the coached program carries them; the other
// ninety-five benches are priced by their head coach's skills alone, so no
// edge here can inflate the league.

/** The in-game half: read by `TeamState` at each plate appearance and play. */
export interface CoachEdges {
  /** HARD-NOSED. Both halves, from the seventh inning on. */
  late?: number;
  /** GRINDER. Both halves, in a one-run game from the seventh on. */
  close?: number;
  /** NEVER DEAD. At the plate while behind from the seventh on. */
  trailing?: number;
  /** TRAVELS WELL. Both halves, away from home: a smaller road penalty. */
  road?: number;
  /** NEVER A NIGHT OFF. Both halves, in a game he manages himself. */
  managed?: number;
  /** SMALL BALL. On a steal's chance of success. */
  steal?: number;
  /** GAMBLER. At the plate when an aggressive call is on. */
  calls?: number;
  /** THE PEN. Added to a reliever's confidence as he comes in. */
  pen?: number;
  /** BY THE BOOK. Off the slope a tired arm loses at. */
  workload?: number;
}

/** What the coached program's bench carries into a game. */
export interface CoachMods {
  offense: number;
  defense: number;
  edges?: CoachEdges;
}

/** The off-field half: read by the store and the winter. */
export interface CoachLevers {
  /** Training points on the bat side (SWING AWAY) and the arm side (ARMS MAN), and both (DEVELOPER). */
  trainBat: number;
  trainArm: number;
  /** PLAYS THE KIDS. A multiplier on a freshman's or sophomore's growth. */
  youngGrowth: number;
  /** THE CLOSER. A multiplier on the recruiting points a week carries. */
  recruitPoints: number;
  /** THE KEEPER. A multiplier on the chance a man enters the portal. */
  portalExit: number;
  /** FOUR-YEAR MAN. A multiplier on the chance a man is drafted away. */
  draftExit: number;
  /** THE PERSUADER. A multiplier on what a case made in the draft room is worth. */
  caseWorth: number;
  /** PLAYERS' COACH. A multiplier on how far a man's mood swings in a season. */
  moodSwing: number;
  /** MORE THAN HE HAD. A multiplier on a good year's prestige gain. */
  goodYearPrestige: number;
  /** TRADITIONALIST. A multiplier on prestige gained where history is prized. */
  traditionPrestige: number;
}

/*
  Sized by measurement, not by feel. The first pass (late 0.02, close 0.025,
  trailing 0.03, road 0.015, steal 0.06, pen 0.06, workload 0.15) was played
  out over 6,000 games between even sides: one badge moved the win rate by
  2-5 points and all seven together by 7, against a coaching skill that is
  worth under one percent at 99. The badges promise a small edge, so every
  value here is two fifths of that pass.
*/
const EDGE: Readonly<Record<string, CoachEdges>> = {
  hardnosed: { late: 0.008 },
  grinder: { close: 0.01 },
  comeback: { trailing: 0.012 },
  roadman: { road: 0.006 },
  ironman: { managed: 0.005 },
  smallball: { steal: 0.025 },
  gambler: { calls: 0.016 },
  penhand: { pen: 0.025 },
  methodical: { workload: 0.06 },
};

/** The in-game edges a set of badges adds up to, or undefined for none. */
export function edgesFor(badges: readonly string[] | undefined): CoachEdges | undefined {
  const out: CoachEdges = {};
  let any = false;
  for (const id of badges ?? []) {
    const e = EDGE[id];
    if (!e) continue;
    for (const [k, v] of Object.entries(e) as [keyof CoachEdges, number][]) {
      out[k] = (out[k] ?? 0) + v;
      any = true;
    }
  }
  return any ? out : undefined;
}

/** The off-field levers a set of badges adds up to. Neutral for none. */
export function leversFor(badges: readonly string[] | undefined): CoachLevers {
  const has = (id: string): boolean => (badges ?? []).includes(id);
  return {
    trainBat: (has('slugger') ? 5 : 0) + (has('developer') ? 3 : 0),
    trainArm: (has('armsman') ? 5 : 0) + (has('developer') ? 3 : 0),
    youngGrowth: has('youth') ? 1.1 : 1,
    recruitPoints: has('closer') ? 1.05 : 1,
    portalExit: has('keeper') ? 0.85 : 1,
    draftExit: has('loyalist') ? 0.85 : 1,
    caseWorth: has('talker') ? 1.12 : 1,
    moodSwing: has('players') ? 0.8 : 1,
    goodYearPrestige: has('overachiever') ? 1.15 : 1,
    traditionPrestige: has('traditionalist') ? 1.15 : 1,
  };
}

/**
 * Every badge id this file gives an effect to. `newsman` (rival tendencies
 * come easier) has nothing to act on while scouting is held back from the
 * build: tendencies are already free to every career (features.ts).
 */
export const BADGES_WITH_EFFECT: readonly string[] = [
  ...Object.keys(EDGE),
  'slugger', 'developer', 'armsman', 'youth', 'closer', 'keeper', 'loyalist',
  'talker', 'players', 'overachiever', 'traditionalist',
];
