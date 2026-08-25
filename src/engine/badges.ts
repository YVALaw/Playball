// badges.ts
// Twenty-one small, specific edges, and the arithmetic that keeps them small.
//
// A badge is **one channel in one situation**, never a flat boost. That is the
// whole distinction between a badge and a rating, and it is the reason a player
// can carry six of them without becoming a different player: LIGHT TOWER moves
// home runs and nothing else, HOUDINI moves what he gives up with men on and
// nothing else, and a man with both is still exactly as good at everything a
// badge does not name.
//
// **How big is big enough, and how it was decided.** The engine has two
// reference points of its own. Home-field advantage is a 1.020 offensive
// multiplier and measures out at +4.9 points of win probability. A maxed coach
// skill is worth +0.87 points over twenty thousand games. Against those, a gold
// badge on a channel that fires a quarter of the time should land near +1.75%
// across a season — so bronze is 2 to 3%, silver 4 to 5%, gold 6 to 8% **on its
// own channel**, and the rarer the situation the larger the number is allowed to
// be. A gold GETS HIM IN is +8% on the 24% of plate appearances that come with a
// man in scoring position, which is +1.9% of one hitter's offence, which is
// about a fifth of home field spread over one ninth of a lineup. That is the
// size a badge is supposed to be.
//
// **It has to be a nudge on top of a spread that is already realistic.** The
// per-event sensitivities were widened in August 2026 precisely so that badges
// would be sized against a believable baseline — the best power hitter in the
// country now earns 3.0x the league home run rate rather than 1.7x. A badge sits
// on top of that. It is not a second rating and it must never be able to
// substitute for one.
//
// **A tendency redistributes; a badge adds.** Both can fire in the same spot and
// the two do different jobs: CLUTCH makes a man a different hitter with a runner
// on second and the same hitter overall, while GETS HIM IN simply makes him
// better there. See the note on `CLUTCH_LIFT` in tendencies.ts.
//
// No decay, as decided — these are young men and this game has no injuries. Not
// visible on other programs' players, which is the opposite of the rule for
// tendencies and for the same reason: a badge is something you learn by owning a
// man, a tendency is something you learn by playing against him.

import { potentialGrade, scoutNoise } from './scouting.js';
import type { Situation } from './tendencies.js';
import type {
  BadgeId, BadgeTier, HeldBadge, Hitter, Pitcher, Player, Position,
} from './types.js';

export type { BadgeId, BadgeTier, HeldBadge };

export type BadgeFamily = 'situational' | 'physical' | 'technical' | 'makeup';

export const TIER_NAME: Record<BadgeTier, string> = {
  1: 'BRONZE', 2: 'SILVER', 3: 'GOLD',
};

/**
 * The three size bands, and what puts a badge in one.
 *
 * A badge that can fire on any pitch of any game needs a smaller number than one
 * that waits for the eighth inning of a one-run game — that is the brief's rule
 * and it is also the only way the two can be worth the same amount over a
 * season. `SPOT` covers the situations that arrive between a fifth and a third
 * of the time; `RARE` is for the ones you see a handful of times a week.
 */
const STEADY: readonly [number, number, number] = [0.025, 0.045, 0.070];
const SPOT: readonly [number, number, number] = [0.030, 0.055, 0.080];
const RARE: readonly [number, number, number] = [0.040, 0.070, 0.100];

/** Who a badge can be hung on. */
type Eligible = (p: Player) => boolean;

const anyone: Eligible = () => true;
const hitters: Eligible = (p) => p.type === 'hitter';
const pitchers: Eligible = (p) => p.type === 'pitcher';
const starters: Eligible = (p) => p.type === 'pitcher' && p.role === 'SP';
const relievers: Eligible = (p) => p.type === 'pitcher' && p.role === 'RP';
const at = (...spots: Position[]): Eligible => (p) => p.type === 'hitter' && spots.includes(p.pos);

const INFIELD: Position[] = ['C', '1B', '2B', '3B', 'SS'];
const THROWERS: Position[] = ['C', 'LF', 'CF', 'RF', '3B'];

/**
 * What a season has to have in it for a badge to be earned by the thing it
 * names. Every field is one row out of the season books, which is the point —
 * an earned badge reads the record the game already keeps rather than a parallel
 * ledger built to feed it. See `records.ts` for the same argument made about
 * the all-time book.
 */
export interface BadgeEvidence {
  /** Hitting. Absent for a man who never batted. */
  bat?: {
    g: number; ab: number; h: number; d: number; t: number; hr: number;
    bb: number; k: number; sb: number; cs: number; rbi: number; r: number; hbp: number;
  };
  /** Pitching. */
  pit?: {
    g: number; gs: number; outs: number; h: number; er: number;
    bb: number; k: number; hr: number; pitches: number; bf: number; w: number; sv: number;
  };
  /** The glove. */
  fld?: {
    g: number; chances: number; plays: number; expected: number;
    errors: number; throwing: number; sba: number; cs: number;
  };
}

export interface BadgeSpec {
  id: BadgeId;
  family: BadgeFamily;
  /** What it is called. Kept short enough to sit in a chip on a 360px phone. */
  label: string;
  /** One line, in the register the ratings bars use: what it does and where. */
  note: string;
  eligible: Eligible;
  size: readonly [number, number, number];
  /**
   * Whether a man can turn up already holding it, and how likely that is
   * relative to the others. A coached-only badge has zero here.
   */
  innate: number;
  /**
   * Did this season earn it? Null where nothing in the books could honestly
   * say — those are the coached ones, and TRAINING is the only route to them.
   */
  earned: ((e: BadgeEvidence) => boolean) | null;
}

/** Innings, as the pitching book counts them. */
const ip = (outs: number): number => outs / 3;

/**
 * The catalogue.
 *
 * Order is the order a card lists them: the situational ones first, because
 * those are the ones a coach makes a decision about, then the body, then the
 * craft, then the head.
 */
export const BADGES: Record<BadgeId, BadgeSpec> = {
  // -------------------------------------------------------------- situational
  getsHimIn: {
    id: 'getsHimIn', family: 'situational', label: 'GETS HIM IN',
    note: 'Better with a runner in scoring position',
    eligible: hitters, size: SPOT, innate: 1.0,
    // Runs driven in well past what his own hits would ordinarily produce, over
    // a real season's worth of them. Both halves matter: the raw total is most
    // of the way to being a compliment to the men batting in front of him.
    earned: (e) => !!e.bat && e.bat.ab >= 110 && e.bat.rbi >= e.bat.h * 0.68 && e.bat.rbi >= 36,
  },
  lateAndClose: {
    id: 'lateAndClose', family: 'situational', label: 'LATE AND CLOSE',
    note: 'Better from the seventh on with the game inside two runs',
    eligible: hitters, size: SPOT, innate: 0.9,
    earned: null,
  },
  tableSetter: {
    id: 'tableSetter', family: 'situational', label: 'TABLE SETTER',
    note: 'Better leading off an inning',
    eligible: hitters, size: SPOT, innate: 0.8,
    // He got on. That is the whole job, and on-base is how it is measured.
    earned: (e) => {
      if (!e.bat || e.bat.ab < 110) return false;
      const pa = e.bat.ab + e.bat.bb + e.bat.hbp;
      return (e.bat.h + e.bat.bb + e.bat.hbp) / pa >= 0.430;
    },
  },
  houdini: {
    id: 'houdini', family: 'situational', label: 'HOUDINI',
    note: 'Harder to hit with men on base',
    eligible: pitchers, size: SPOT, innate: 0.9,
    // A stranding season: plenty of traffic and hardly any of it scored.
    earned: (e) => !!e.pit && e.pit.outs >= 120
      && (e.pit.h + e.pit.bb) / ip(e.pit.outs) >= 1.45
      && e.pit.er / ip(e.pit.outs) * 9 <= 3.20,
  },
  theDoor: {
    id: 'theDoor', family: 'situational', label: 'THE DOOR',
    note: 'Harder to hit protecting a lead of three or fewer from the eighth',
    eligible: relievers, size: RARE, innate: 0.7,
    earned: (e) => !!e.pit && e.pit.sv >= 3,
  },
  deepWater: {
    id: 'deepWater', family: 'situational', label: 'DEEP WATER',
    note: 'Holds up the third time through an order',
    eligible: starters, size: SPOT, innate: 0.8,
    // He kept going out there and it kept working.
    earned: (e) => !!e.pit && e.pit.gs >= 8 && e.pit.outs / Math.max(1, e.pit.gs) >= 21,
  },

  // ----------------------------------------------------------------- physical
  wheels: {
    id: 'wheels', family: 'physical', label: 'WHEELS',
    note: 'Takes the extra base on a hit more often',
    eligible: hitters, size: STEADY, innate: 1.0,
    earned: (e) => !!e.bat && e.bat.ab >= 110 && e.bat.t * 2 + e.bat.sb >= 15,
  },
  burglar: {
    id: 'burglar', family: 'physical', label: 'BURGLAR',
    note: 'Steals a higher share of the bases he goes for',
    eligible: hitters, size: STEADY, innate: 0.9,
    earned: (e) => !!e.bat && e.bat.sb >= 10 && e.bat.sb / Math.max(1, e.bat.sb + e.bat.cs) >= 0.80,
  },
  lightTower: {
    id: 'lightTower', family: 'physical', label: 'LIGHT TOWER',
    note: 'Hits more home runs',
    eligible: hitters, size: STEADY, innate: 1.0,
    earned: (e) => !!e.bat && e.bat.hr >= 6,
  },
  cannon: {
    id: 'cannon', family: 'physical', label: 'CANNON',
    note: 'Runners take fewer chances on him, and behind the plate he throws them out',
    eligible: at(...THROWERS), size: STEADY, innate: 0.8,
    earned: (e) => !!e.fld && e.fld.sba + e.fld.cs >= 20 && e.fld.cs / (e.fld.sba + e.fld.cs) >= 0.42,
  },
  rubberArm: {
    id: 'rubberArm', family: 'physical', label: 'RUBBER ARM',
    note: 'Loses less off his stuff past his pitch count',
    eligible: pitchers, size: STEADY, innate: 0.9,
    earned: (e) => !!e.pit && e.pit.outs >= 180 && e.pit.pitches / Math.max(1, e.pit.g) >= 110,
  },
  swingAndMiss: {
    id: 'swingAndMiss', family: 'physical', label: 'SWING AND MISS',
    note: 'Strikes out more of them',
    eligible: pitchers, size: STEADY, innate: 1.0,
    earned: (e) => !!e.pit && e.pit.outs >= 120 && e.pit.k / ip(e.pit.outs) * 9 >= 9.8,
  },

  // ---------------------------------------------------------------- technical
  toughOut: {
    id: 'toughOut', family: 'technical', label: 'TOUGH OUT',
    note: 'Strikes out less often',
    eligible: hitters, size: STEADY, innate: 1.0,
    earned: (e) => {
      if (!e.bat || e.bat.ab < 110) return false;
      const pa = e.bat.ab + e.bat.bb + e.bat.hbp;
      return e.bat.k / pa <= 0.095;
    },
  },
  vacuum: {
    id: 'vacuum', family: 'technical', label: 'VACUUM',
    note: 'Boots fewer of the balls he gets to',
    eligible: at(...INFIELD), size: STEADY, innate: 0.9,
    earned: (e) => !!e.fld && e.fld.chances >= 120 && e.fld.errors - e.fld.throwing <= 1,
  },
  onALine: {
    id: 'onALine', family: 'technical', label: 'ON A LINE',
    note: 'Throws fewer of them away',
    eligible: anyone, size: STEADY, innate: 0.8,
    earned: (e) => !!e.fld && e.fld.chances >= 150 && e.fld.throwing === 0,
  },
  painter: {
    id: 'painter', family: 'technical', label: 'PAINTER',
    note: 'Walks fewer of them',
    eligible: pitchers, size: STEADY, innate: 1.0,
    earned: (e) => !!e.pit && e.pit.outs >= 120 && e.pit.bb / ip(e.pit.outs) * 9 <= 1.95,
  },
  wormBurner: {
    id: 'wormBurner', family: 'technical', label: 'WORM BURNER',
    note: 'Keeps more of it on the ground, and out of the seats',
    eligible: pitchers, size: STEADY, innate: 0.9,
    earned: (e) => !!e.pit && e.pit.outs >= 120 && e.pit.hr / ip(e.pit.outs) * 9 <= 0.16,
  },
  stealsStrikes: {
    id: 'stealsStrikes', family: 'technical', label: 'STEALS STRIKES',
    note: 'The staff walks fewer men with him behind the plate',
    eligible: at('C'), size: STEADY, innate: 0.7,
    earned: null,
  },

  // ------------------------------------------------------------------- makeup
  gymRat: {
    id: 'gymRat', family: 'makeup', label: 'GYM RAT',
    note: 'Develops faster between seasons',
    eligible: anyone, size: STEADY, innate: 0.9,
    earned: null,
  },
  noPanic: {
    id: 'noPanic', family: 'makeup', label: 'NO PANIC',
    note: 'Harder to hit with two out and men on',
    eligible: pitchers, size: SPOT, innate: 0.8,
    earned: null,
  },
  secondLook: {
    id: 'secondLook', family: 'makeup', label: 'SECOND LOOK',
    note: 'Better the third time he faces a pitcher in a game',
    eligible: hitters, size: SPOT, innate: 0.8,
    earned: null,
  },
  bigStage: {
    id: 'bigStage', family: 'makeup', label: 'BIG STAGE',
    note: 'Better in a bracket game',
    eligible: anyone, size: RARE, innate: 0.7,
    earned: null,
  },
  /**
   * The one badge that exists because a rating deliberately does not.
   *
   * §9.7 of the systems reference records that hit by pitch was left unwidened
   * when every other event was, on the grounds that a real leader is "a man who
   * crowds the plate and no rating measures it" — `eye` being the wrong thing to
   * charge for it. A badge is exactly the right home for a fact about a man that
   * is not a skill: he stands on top of the plate, he wears one, and pitchers
   * who will not come inside walk him instead.
   *
   * The multiplier on hit by pitch is far above the badge's nominal size because
   * the event is 1.5% of plate appearances — a third of the size of a walk's
   * effect in absolute terms even at four times the rate.
   */
  crowdsThePlate: {
    id: 'crowdsThePlate', family: 'makeup', label: 'CROWDS THE PLATE',
    note: 'Wears one, and gets pitched around rather than pitched inside',
    eligible: hitters, size: STEADY, innate: 0.9,
    earned: (e) => !!e.bat && e.bat.hbp >= 6,
  },
};

export const BADGE_IDS = Object.keys(BADGES) as BadgeId[];

export const FAMILY_LABEL: Record<BadgeFamily, string> = {
  situational: 'SITUATIONAL',
  physical: 'PHYSICAL',
  technical: 'TECHNICAL',
  makeup: 'MAKEUP',
};

// ---------------------------------------------------------------------------
// The ceiling
// ---------------------------------------------------------------------------

/**
 * How many a man may ever hold, by the ceiling he was scouted at.
 *
 * As decided: S 6 · A+ 5 · A 4 · B 3 · C 2 · D 2, with S+ exempt because the
 * store player is supposed to carry ten and is the only thing in the game that
 * will ever grade S+.
 *
 * D and C share their two on purpose. Three quarters of the country lives in
 * those two grades, so a fine gradation matters least there — and it produces
 * exactly the right reading, which is that a low-ceiling recruit can arrive
 * already at his badge cap. "He is close to the player he is going to be" is
 * what the recruiting board has been saying about him all along.
 */
export function badgeCap(potential: number): number {
  switch (potentialGrade(potential)) {
    case 'S+': return 10;
    case 'S': return 6;
    case 'A+': return 5;
    case 'A': return 4;
    case 'B': return 3;
    default: return 2;
  }
}

/** At most two on the day he signs, whatever his ceiling says he may reach. */
export const SIGNING_CAP = 2;

// ---------------------------------------------------------------------------
// Reading a player's badges
// ---------------------------------------------------------------------------

export const badgesOf = (p: Player): readonly HeldBadge[] => p.badges ?? [];

export function tierOf(p: Player, id: BadgeId): BadgeTier | 0 {
  for (const b of badgesOf(p)) if (b.id === id) return b.tier;
  return 0;
}

/**
 * The size of one badge's effect on this player, or zero if he does not have it.
 * Every consumer in the engine goes through here, so there is one place a badge
 * turns into a number.
 */
export function badgeSize(p: Player, id: BadgeId): number {
  const tier = tierOf(p, id);
  return tier === 0 ? 0 : (BADGES[id].size[tier - 1] as number);
}

/** A lift on the batter's side: 1 + size. */
const up = (p: Player, id: BadgeId): number => 1 + badgeSize(p, id);
/** A suppression from the mound: 1 − size, applied to the batter's events. */
const down = (p: Player, id: BadgeId): number => 1 - badgeSize(p, id);

// ---------------------------------------------------------------------------
// What they do to a plate appearance
// ---------------------------------------------------------------------------

export interface BadgeMods {
  /** Every offensive event at once. */
  all: number;
  homerun: number;
  /** Multiplier on the strikeout share of an out. */
  strikeout: number;
  walk: number;
  hbp: number;
  groundBall: number;
}

const NEUTRAL: BadgeMods =
  { all: 1, homerun: 1, strikeout: 1, walk: 1, hbp: 1, groundBall: 1 };

/**
 * One plate appearance, with everybody's badges in it.
 *
 * The catcher is here because STEALS STRIKES is the one badge a player holds
 * that acts on somebody else's line — framing is a catcher's skill and a
 * pitcher's walk rate, and modelling it any other way would have meant giving
 * the pitcher a rating for who was catching him.
 */
export function badgeMods(
  batter: Hitter, pitcher: Pitcher, catcher: Hitter | null, sit: Situation,
): BadgeMods {
  const m: BadgeMods = { ...NEUTRAL };

  // --- the batter's side
  if (sit.risp) m.all *= up(batter, 'getsHimIn');
  if (sit.inning >= 7 && Math.abs(sit.margin) <= 2) m.all *= up(batter, 'lateAndClose');
  if (sit.leadingOff) m.all *= up(batter, 'tableSetter');
  if (sit.timesThrough >= 3) m.all *= up(batter, 'secondLook');
  if (sit.postseason) m.all *= up(batter, 'bigStage');
  m.homerun *= up(batter, 'lightTower');
  m.strikeout *= 1 - badgeSize(batter, 'toughOut');
  // The badge that pays for an event no rating is allowed to buy. See its entry.
  m.hbp *= 1 + badgeSize(batter, 'crowdsThePlate') * 4.0;
  m.walk *= 1 + badgeSize(batter, 'crowdsThePlate') * 3.0;

  // --- the arm's
  if (sit.runnersOn) m.all *= down(pitcher, 'houdini');
  if (sit.runnersOn && sit.outs === 2) m.all *= down(pitcher, 'noPanic');
  if (sit.timesThrough >= 3) m.all *= down(pitcher, 'deepWater');
  if (sit.inning >= 8 && sit.margin < 0 && sit.margin >= -3) m.all *= down(pitcher, 'theDoor');
  if (sit.postseason) m.all *= down(pitcher, 'bigStage');
  m.walk *= down(pitcher, 'painter');
  m.strikeout *= up(pitcher, 'swingAndMiss');
  m.groundBall *= up(pitcher, 'wormBurner');
  // A ground ball never leaves the yard, so the badge that produces them takes
  // home runs with it. Which is also what keeps LIGHT TOWER from being the only
  // badge in the game with an opinion about the home run column.
  m.homerun *= down(pitcher, 'wormBurner');

  // --- and the man catching him
  if (catcher) m.walk *= down(catcher, 'stealsStrikes');

  return m;
}

/** BURGLAR. A multiplier on the chance a steal attempt succeeds. */
export const stealBonus = (h: Hitter): number => up(h, 'burglar');

/** WHEELS. A multiplier on how often he tries for the extra base. */
export const extraBaseBonus = (h: Hitter): number => 1 + badgeSize(h, 'wheels') * 2.2;

/**
 * CANNON, from the defensive side: how much less often a runner tries him.
 *
 * Doubled against the badge's nominal size because the channel is an attempt
 * rate rather than an outcome — a throwing arm's whole value in real baseball is
 * the runs it prevents by never being tested, and a 7% shave on attempts is
 * worth about what a 7% shave on an outcome would be.
 */
export const holdBonus = (p: Player): number => 1 - badgeSize(p, 'cannon') * 2.0;

/** VACUUM. A multiplier on his chance of booting one. */
export const gloveBonus = (p: Player): number => 1 - badgeSize(p, 'vacuum') * 2.2;

/** ON A LINE. A multiplier on his chance of throwing one away. */
export const throwBonus = (p: Player): number => 1 - badgeSize(p, 'onALine') * 2.2;

/** RUBBER ARM. A multiplier on how fast he tires past his budget. */
export const fatigueBonus = (p: Pitcher): number => 1 - badgeSize(p, 'rubberArm') * 2.2;

/** GYM RAT. A multiplier on the systematic pull toward his ceiling. */
export const growthBonus = (p: Player): number => 1 + badgeSize(p, 'gymRat') * 2.2;

// ---------------------------------------------------------------------------
// Getting one
// ---------------------------------------------------------------------------

/**
 * Which badges this man could possibly hold, in catalogue order.
 *
 * Position awareness lives here and nowhere else: a first baseman is not offered
 * CANNON, a starter is not offered THE DOOR, and a hitter is never offered
 * PAINTER. A badge nobody can use is worse than no badge — it is a slot in a cap
 * spent on nothing.
 */
export function eligibleBadges(p: Player): BadgeId[] {
  return BADGE_IDS.filter((id) => BADGES[id].eligible(p));
}

/**
 * Add a badge, or move one up a tier, respecting the ceiling.
 *
 * Returns what happened so the caller can put it in an inbox. A badge he already
 * holds at gold is a no-op rather than an error — the cap is on how many he
 * holds, and nothing in this game takes one away.
 */
export function grantBadge(p: Player, id: BadgeId): 'new' | 'upgraded' | null {
  const held = badgesOf(p);
  const existing = held.find((b) => b.id === id);
  if (existing) {
    if (existing.tier >= 3) return null;
    existing.tier = (existing.tier + 1) as BadgeTier;
    return 'upgraded';
  }
  if (held.length >= badgeCap(p.potential)) return null;
  if (!BADGES[id].eligible(p)) return null;
  p.badges = [...held, { id, tier: 1 }];
  return 'new';
}

/**
 * What a man turns up already holding.
 *
 * Hashed off his id rather than drawn, for the reason `arrivalAge` gives: every
 * rng() call in `players.ts` sits in a fixed sequence and taking three of them
 * per player here would move every calibration figure in the project. The id
 * comes off a bijection on 32 bits, so a hash is as uniform as a draw would have
 * been and it costs the generator nothing.
 *
 * **At most two**, as decided, and then no more than his ceiling allows — which
 * is how a D-grade recruit can arrive already finished in this respect too. Most
 * men have none: a badge on nine players in twenty would stop meaning anything.
 * Gold at signing is genuinely rare, because a gold badge on an eighteen year
 * old is supposed to be a thing you notice on the board.
 */
const SALT = { count: 7601, pick: 7607, tier: 7639 } as const;

/**
 * A year of it: what he earned by doing the thing, and what his staff coached
 * into him.
 *
 * **Rolled off a hash of his id and the year rather than off the offseason's
 * random stream.** The stream is shared by every departure and every
 * development draw in the league, and inserting two thousand rolls into it
 * would move every one of them — the same argument `arrivalAge` makes, one
 * layer up. Salting with the year is what stops a man rolling the same number
 * against the same badge for four seasons running.
 *
 * `training` is the coach's TRAINING skill, 20 to 99, and it is the only lever
 * anybody has over this: at the cap it is worth eighty percent more badge
 * development than an untrained staff, on both routes. That is deliberately a
 * bigger relative edge than TRAINING buys in ordinary development, because
 * ordinary development is a gradient a program is always climbing and a badge
 * is a discrete thing that either happens or does not.
 */
const EARN_CHANCE = 0.42;
const COACH_CHANCE = 0.16;
const SALT_YEAR = 7717;

const trainingMult = (training: number): number =>
  1 + Math.max(0, Math.min(79, training - 20)) / 79 * 0.8;

export function developBadges(
  p: Player, ev: BadgeEvidence, year: number, training: number,
): BadgeId[] {
  const gained: BadgeId[] = [];
  const boost = trainingMult(training);
  const roll = (n: number): number => scoutNoise(p.id, SALT_YEAR + year * 101 + n);

  // Earned. He did the thing the badge is named after; the only question is
  // whether it stuck.
  let n = 0;
  for (const id of BADGE_IDS) {
    const spec = BADGES[id];
    n += 1;
    if (!spec.earned || !spec.eligible(p)) continue;
    if (tierOf(p, id) === 3) continue;
    if (!spec.earned(ev)) continue;
    if (roll(n) >= EARN_CHANCE * boost) continue;
    if (grantBadge(p, id)) gained.push(id);
  }

  // Coached. One thing a year, because that is how coaching works — a staff
  // picks something to work on with a man over a winter, it does not run him
  // through the whole catalogue.
  const pool = eligibleBadges(p).filter((id) => tierOf(p, id) < 3);
  if (pool.length > 0 && roll(200) < COACH_CHANCE * boost) {
    const target = pool[Math.floor(roll(211) * pool.length)] as BadgeId;
    if (grantBadge(p, target)) gained.push(target);
  }
  return gained;
}

export function innateBadges(p: Player): HeldBadge[] {
  const uCount = scoutNoise(p.id, SALT.count);
  const want = Math.min(
    uCount < 0.55 ? 0 : uCount < 0.88 ? 1 : 2,
    SIGNING_CAP,
    badgeCap(p.potential),
  );
  if (want === 0) return [];

  const pool = eligibleBadges(p).filter((id) => BADGES[id].innate > 0);
  const out: HeldBadge[] = [];
  for (let n = 0; n < want && pool.length > 0; n++) {
    let total = 0;
    for (const id of pool) total += BADGES[id].innate;
    let r = scoutNoise(p.id, SALT.pick + n * 17) * total;
    let chosen = pool[pool.length - 1] as BadgeId;
    for (const id of pool) {
      r -= BADGES[id].innate;
      if (r < 0) { chosen = id; break; }
    }
    pool.splice(pool.indexOf(chosen), 1);
    const uTier = scoutNoise(p.id, SALT.tier + n * 23);
    out.push({ id: chosen, tier: uTier < 0.74 ? 1 : uTier < 0.96 ? 2 : 3 });
  }
  return out;
}
