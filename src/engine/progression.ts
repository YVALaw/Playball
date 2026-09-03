// progression.ts
// The year turns over. Seniors graduate, the draft takes the best juniors,
// everyone who stays gets better or worse, and a freshman class arrives.
//
// This runs for all 96 programs, not just yours. Roughly a quarter of the
// world's four thousand players leave every June and are replaced, which is what
// stops a dynasty from being the same names forever — and it is the mechanism
// behind the roadmap's central promise: you never keep your best players.

import { developBadges, type BadgeEvidence, type BadgeId } from './badges.js';
import {
  AI_KEEP_SHARE, AVERAGE_STAFF,
  draftContext, draftEligible, draftRound, makeTheCase, rivalKeeps, sceneFrom,
  visibleValue, yearsOfLeverage,
  type DraftBoard, type DraftedMan,
} from './draft.js';
import { ageFor, makeHitter, makePitcher, releaseNames, reserveNames } from './players.js';
import { prestigeStars } from './program.js';
import { GENERATED_POTENTIAL_CAP } from './scouting.js';
import { armValue, overallOf, clamp } from './ratings.js';
import { windowBudget } from './recruiting.js';
import type { Prospect } from './recruiting.js';
import { gauss, makeRng } from './rng.js';
import { cultureFor } from '../data/cultures.js';
import { bankRedshirt } from './redshirt.js';
import type { SeasonState } from './season.js';
import { isTwoWay, uniquePlayers } from './types.js';
import type {
  Arm, ClassYear, Hitter, Pitcher, Player, PlayerId, Position, Rng, Team,
} from './types.js';

/** Roughly how many bodies a program has to replace. Sizes the AI's board. */
function countHoles(team: Team): number {
  const roster: Player[] = uniquePlayers([
    ...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen,
  ]);
  return roster.filter((p) => p.classYear === 'SR' || p.classYear === 'JR').length;
}

const NEXT_CLASS: Record<ClassYear, ClassYear | null> = {
  FR: 'SO', SO: 'JR', JR: 'SR', SR: null,
};

const LINEUP_SPOTS: readonly Position[] = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];
const ROTATION_SIZE = 4;
const BULLPEN_SIZE = 6;
const BENCH_SIZE = 4;



/**
 * Why a man is no longer on the roster.
 *
 * 'walk-on' is not a third kind of exit so much as the absence of one: nobody
 * recruited him, so nothing was holding him for a second year. He is reported
 * with the graduating class because from the program's side the consequence is
 * identical — the spot is open again — and a departure the report does not carry
 * is a player who vanishes between two screens.
 */
export type DepartureReason = 'graduated' | 'drafted' | 'walk-on';

export interface Departure {
  id: PlayerId;
  name: string;
  team: number;
  teamAbbr: string;
  classYear: ClassYear;
  /** How old he was in the June he left. */
  age: number;
  overall: number;
  reason: DepartureReason;
  /**
   * Which round he went in, for the men who were drafted.
   *
   * The draft is a national event and a player wants to know where he stood in
   * it — "drafted" is a fact, "went in the third round" is the story. It comes
   * off what the clubs think he is worth rather than off his position in a
   * queue, which is what lets a strong year put three men in the first round
   * and a weak one put nobody there. See `draftRound`.
   */
  round?: number;
  /**
   * He was drafted and he came back to school anyway.
   *
   * Kept on the notice rather than deleted from the list, because being taken
   * in the fourth round and turning it down is a thing that happened to him and
   * a thing the program should be able to point at. Every count of what you
   * lost skips him.
   */
  returned?: boolean;
}

export interface OffseasonReport {
  graduated: Departure[];
  drafted: Departure[];
  recruits: number;
  /** The user's signed class, so the screen can show who was actually landed. */
  signed: Prospect[];
  /**
   * The bodies that filled the holes your class did not.
   *
   * A scholarship you never used does not leave the spot empty — somebody walks
   * on and plays there, thirteen points worse than the program's own level.
   * Reported from testing: "we should show the walk-ons that will be added to
   * the team", and he is right that it is the honest accounting of a class that
   * came up short. They are also on a one year lease — see `Player.walkOn` — so
   * a program that fills a spot this way is shopping for it again next winter.
   *
   * No screen reads this. The list is only known once `fillRosters` has run,
   * which is the year roll, and by then every offseason screen has been left
   * behind — a draft screen that tried to show it drew nothing for anybody,
   * every year, and has been deleted. What the coach sees instead is
   * `walkOnShortfall` on the class review, which projects the same men *before*
   * signing day, where the number is still something he can do something about.
   * What this field is for now is holding that projection honest: the test in
   * `tests/progression.test.ts` checks the two against each other, which is what
   * makes the review a fact rather than an estimate.
   */
  walkOns: { id: PlayerId; name: string; pos: string; overall: number }[];
  /** Sum of overall gained across everyone who stayed. */
  developmentNet: number;
  improved: number;
  declined: number;
  /**
   * Badges your men picked up over the winter, earned or coached.
   *
   * Your program only, because a badge is not visible on anybody else's players
   * and a list of a rival's would be the report telling you something the card
   * refuses to. It is what the offseason has to show for a TRAINING skill: the
   * development number moves a point or two and a badge is a thing with a name.
   */
  badges: { id: PlayerId; name: string; badge: BadgeId; tier: 1 | 2 | 3 }[];
  /**
   * What your roster is now short of, by position.
   *
   * The draft runs before recruiting opens, so these are the holes you go
   * shopping for — which is the whole reason the two steps are in this order.
   * A hole is a spot the structure requires and the survivors cannot fill.
   */
  holes: { pos: string; count: number }[];
}

/**
 * How likely a club is to spend a pick on a man of this ability.
 *
 * The roadmap's core tension expressed as a number: a star is on a three year
 * clock whether you like it or not. A 70 overall is gone almost every time; a 45
 * almost never hears his name. Seniors leave regardless, so the draft only
 * really *costs* you men with eligibility left.
 */
export function draftChance(overall: number): number {
  return clamp((overall - 46) / 34, 0, 0.88);
}

/**
 * How much a club discounts a man who can walk away from it.
 *
 * Nought years of eligibility left is a senior, who has no leverage and signs.
 * One is a junior, who can go back for a victory lap and mostly does not. Two
 * or three is an underclassman the age clause has exposed, and he can cost a
 * club a whole pick by simply going back to school — so clubs take him only
 * when they mean to pay him, which is what keeps the age exception occasional
 * rather than a second graduating class every June.
 *
 * These are the numbers the old talent bars produced, kept deliberately: the
 * frequency an underclassman leaves at was right, it was the *reason* that was
 * a fiction.
 */
const LEVERAGE_DISCOUNT: Record<number, number> = { 0: 0.6, 1: 1, 2: 0.35, 3: 0.15 };

/** Does this player leave the program this offseason? */
function departure(p: Player, rng: Rng): DepartureReason | null {
  const leverage = yearsOfLeverage(p.classYear);
  const chance = draftChance(overallOf(p)) * (LEVERAGE_DISCOUNT[leverage] ?? 1);

  if (p.classYear === 'SR') {
    // A senior is gone either way. Whether a club called his name is flavour,
    // but it is the flavour that tells you how good your program's exits were.
    return rng() < chance ? 'drafted' : 'graduated';
  }
  // Everyone else: the door has to be open before anybody can walk through it.
  // Ordinarily that is the end of his third year, which is why a freshman and a
  // sophomore are safe and the cliff arrives on schedule. The exception is the
  // man who arrived at nineteen or twenty and is already twenty one.
  if (!draftEligible(p)) return null;
  return rng() < chance ? 'drafted' : null;
}

/**
 * The arc a man was always on — stage 16, the 2K question answered.
 *
 * NBA 2K's model was investigated and its community's verdict kept: potential
 * bands with boom/bust are a good idea poorly expressed, because booming
 * there is a coin flip at the roll rather than anything you watch happen. So
 * here the arc is fixed from the day the man exists — a hash of his id, no
 * draw, no reload re-rolling who blooms — and it expresses through the same
 * play-scaled development pull as everything else: each June the scout's
 * number moves a step toward where the arc was always taking him, and the
 * year's growth then chases the revised number at whatever rate his minutes,
 * redshirt and culture set. A bust does not fall off a cliff: the pull only
 * chases a lowered ceiling at the ordinary rate — a point or so a winter —
 * and the revise-upward rule under `develop` keeps the printed number honest
 * against what he still actually does.
 *
 * HIDDEN, per the register: the word never prints anywhere. What the player
 * sees is the letter itself drifting — asked for in exactly those terms:
 * "not only getting worse but also getting better... a player that came in
 * as a C player but he starts getting better and we see the potential go
 * up." Steady is most of everybody, and the two tails are equal.
 */
export type Arc = 'bust' | 'steady' | 'boom';

const arcHash = (p: Player): number => {
  let h = 2166136261;
  const id = String(p.id);
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return h;
};

export function arcOf(p: Player): Arc {
  const r = arcHash(p) % 100;
  if (r < 15) return 'boom';
  if (r < 30) return 'bust';
  return 'steady';
}

/** How far the arc bends the ceiling, jittered per man so no two read alike. */
export function arcReach(p: Player): number {
  const arc = arcOf(p);
  if (arc === 'steady') return 0;
  const jitter = (arcHash(p) >>> 8) % 5;
  return arc === 'boom' ? 8 + jitter : -(9 + jitter);
}

/**
 * A year of development, applied after the class year advances.
 *
 * Players move toward their potential, fastest early: the jump from freshman to
 * sophomore is the biggest a college player ever makes. The noise term is what
 * makes recruiting a gamble rather than arithmetic — a 60 potential freshman can
 * stall, and a 48 can outgrow his projection.
 */
function develop(p: Player, rng: Rng, growthMult = 1): number {
  /*
    The June reveal, before the pull, so this year's growth already chases
    the revised number. The goal is stamped at the man's first offseason
    (sparse -- an older save's men are put on their arcs from wherever their
    ceiling stands today) and the reveal takes no draw, so every rng pin
    below survives it. Three points a year: a full boom is watched across
    three winters rather than granted at one.
  */
  const man = p as Player & { arcGoal?: number };
  const reach = arcReach(p);
  if (reach !== 0) {
    man.arcGoal ??= clamp(Math.round(p.potential + reach), 25, GENERATED_POTENTIAL_CAP);
    const left = man.arcGoal - p.potential;
    if (left !== 0) p.potential += Math.sign(left) * Math.min(3, Math.abs(left));
  }

  const before = overallOf(p);
  const gap = p.potential - before;
  const rate = p.classYear === 'SO' ? 0.45 : p.classYear === 'JR' ? 0.35 : 0.25;
  // The training skill scales the systematic pull toward potential and nothing
  // else — the noise stays untouched, so a trained program raises the floor of
  // a class without making development any less of a gamble. It also keeps the
  // rng draw order identical whatever the multiplier, which is what lets a
  // test compare skill levels on the same stream.
  const delta = gap * rate * growthMult + gauss(rng) * 2.2;

  const bump = (v: number): number => clamp(v + delta + gauss(rng) * 1.2, 15, 99);

  if (p.type === 'hitter') {
    p.contact = bump(p.contact);
    p.power = bump(p.power);
    p.eye = bump(p.eye);
    p.speed = bump(p.speed);
    p.range = bump(p.range);
    p.hands = bump(p.hands);
    p.arm = bump(p.arm);
    p.armAccuracy = bump(p.armAccuracy);
    p.blocking = bump(p.blocking);
    p.bunt = bump(p.bunt);
    p.steal = bump(p.steal);
    if (isTwoWay(p)) {
      // Both halves of him grow off the one ceiling: the same winter that
      // adds bat adds arm, at the same pull, with its own noise per field.
      p.stuff = bump(p.stuff);
      p.movement = bump(p.movement);
      p.control = bump(p.control);
      p.stamina = bump(p.stamina);
      p.velocity = Math.round(clamp(p.velocity + delta * 0.08, 79, 103));
    }
  } else {
    p.stuff = bump(p.stuff);
    p.movement = bump(p.movement);
    p.control = bump(p.control);
    p.stamina = bump(p.stamina);
    // A pitcher's glove develops now, and did not before — every fielding
    // rating he had sat at its generated value for four years, which nobody
    // noticed because nothing in the engine ever read them. Comebackers reach
    // him now, so a senior who has been fielding his position since he was
    // eighteen should be better at it than he was as a freshman.
    p.range = bump(p.range);
    p.hands = bump(p.hands);
    p.arm = bump(p.arm);
    p.armAccuracy = bump(p.armAccuracy);
    // Velocity is mph, not a 0 to 100 rating, so it cannot take the same delta.
    // Roughly a mile an hour for every twelve points of development.
    p.velocity = Math.round(clamp(p.velocity + delta * 0.08, 79, 103));
  }

  // A ceiling a player has already cleared is not a ceiling. Scouts revise a
  // projection upward when someone outgrows it, and without this the number
  // quietly turns into nonsense — a senior reading "overall 52, potential 46".
  const after = overallOf(p);
  if (after > p.potential) p.potential = after;

  return after - before;
}

/** Best first. */
const byOverall = <T extends Player>(xs: T[]): T[] =>
  [...xs].sort((a, b) => overallOf(b) - overallOf(a));

/** Anybody with an arm job, ranked by the arm. */
const isArm = (p: Player): p is Arm => p.type === 'pitcher' || isTwoWay(p);
const byArm = <T extends Arm>(xs: T[]): T[] =>
  [...xs].sort((a, b) => armValue(b) - armValue(a));

/**
 * Rebuild a roster to its structural shape, filling every hole with a freshman.
 *
 * Recruit quality tracks program quality, which is what makes prestige worth
 * something: a 57 program signs better classes than a 44 program, year after
 * year, and that compounds.
 */
/**
 * Rebuild a roster from who is left, who was signed, and who can be found.
 *
 * The order matters and is the point of the whole recruiting system: **signed
 * recruits are used before walk-ons.** A program that recruits well fills its
 * holes with players it chose; one that does not fills them with whoever turned
 * up, and `WALK_ON_PENALTY` is how much that costs.
 *
 * That penalty used to be 5, applied to everybody, which meant recruiting could
 * not matter because every program reloaded at its own quality regardless. It is
 * steeper now, and it only applies to the players nobody recruited.
 */
function refill(
  team: Team, survivors: Player[], rng: Rng, signed: Player[] = [],
  collect?: Player[], walkOns: readonly Player[] = [],
): number {
  const bodies = uniquePlayers(survivors);
  const hitters = byOverall(bodies.filter((p): p is Hitter => p.type === 'hitter'));
  // A two-way man is in BOTH pools — his lineup spot and his rotation slot
  // are the same body, which is the entire feature.
  const arms = byArm(bodies.filter(isArm));
  let recruits = 0;

  // The signed class, best first, waiting to be placed.
  const signedHitters = byOverall(signed.filter((p): p is Hitter => p.type === 'hitter'));
  const signedArms = byArm(signed.filter(isArm));

  // The men who walk on, drawn in advance and queued by the spot they were
  // drawn for. `walkOnClass` walks this same placement order, so the queue holds
  // exactly what the loops below are about to ask for — and the class review
  // three taps back has already shown the coach these very men. The fallback
  // draw is a safety net for a caller that supplied nothing.
  const spare = new Map<string, Player[]>();
  for (const p of walkOns) {
    const key = p.type === 'pitcher' ? (p as Pitcher).role : p.pos;
    const queue = spare.get(key);
    if (queue) queue.push(p); else spare.set(key, [p]);
  }

  // One body, one count — a two-way signing placed at a lineup spot AND a
  // rotation slot is still one recruit. Every path that hands out a man
  // reports him through this.
  const countedIds = new Set<string>();
  const counted = <T extends Player>(man: T): T => {
    if (!countedIds.has(String(man.id))) { countedIds.add(String(man.id)); recruits += 1; }
    return man;
  };

  const freshHitter = (pos: Position): Hitter => {
    // Somebody you actually recruited who plays here, else the best bat signed,
    // else a walk-on.
    const exact = signedHitters.findIndex((h) => h.pos === pos);
    if (exact >= 0) return counted(signedHitters.splice(exact, 1)[0] as Hitter);
    const any = signedHitters.shift();
    if (any) { any.pos = pos; return counted(any); }
    const p = (spare.get(pos)?.shift() as Hitter | undefined)
      ?? (walkOnHitter(rng, team.quality, pos));
    collect?.push(p);
    return counted(p);
  };
  const freshArm = (role: 'SP' | 'RP'): Arm => {
    const exact = signedArms.findIndex((a) => a.role === role);
    if (exact >= 0) return counted(signedArms.splice(exact, 1)[0] as Arm);
    const any = signedArms.shift();
    if (any) { any.role = role; return counted(any); }
    const p = (spare.get(role)?.shift() as Pitcher | undefined)
      ?? (walkOnArm(rng, team.quality, role));
    collect?.push(p);
    return counted(p);
  };

  // The lineup wants a body at every spot on the diamond. Take the best
  // returning player who plays there; sign one if nobody does.
  const lineup: Hitter[] = [];
  for (const spot of LINEUP_SPOTS) {
    const i = hitters.findIndex((h) => h.pos === spot);
    if (i >= 0) lineup.push(hitters.splice(i, 1)[0] as Hitter);
    else lineup.push(freshHitter(spot));
  }

  const bench: Hitter[] = hitters.splice(0, BENCH_SIZE);
  while (bench.length < BENCH_SIZE) {
    bench.push(freshHitter(LINEUP_SPOTS[bench.length % LINEUP_SPOTS.length] as Position));
  }

  const starters = arms.filter((p) => p.role === 'SP');
  const relievers = arms.filter((p) => p.role === 'RP');

  const rotation: Arm[] = starters.splice(0, ROTATION_SIZE);
  while (rotation.length < ROTATION_SIZE) rotation.push(freshArm('SP'));

  // Starters who did not make the rotation slide to the bullpen, exactly as they
  // would in a real program.
  const bullpen: Arm[] = [...relievers, ...starters].slice(0, BULLPEN_SIZE);
  while (bullpen.length < BULLPEN_SIZE) bullpen.push(freshArm('RP'));

  // A signed recruit who does not fit anywhere simply does not arrive. He was
  // generated during the window and never played a game, so dropping him costs
  // nothing and keeps the league's player count exactly conserved.

  // Anybody signed who has not found a spot yet still joins the program.
  //
  // A roster built to exactly nine, four, four and six only places a recruit
  // when there is a *hole* at his position — so a class signed into a roster
  // that returns most of its starters had nowhere to put the extras and quietly
  // threw them away. From the player's side that is the worst bug the game can
  // have: you spent three weeks and eight scholarships on men who then did not
  // exist. If he signed, he is on the roster; the bench and bullpen carry him.
  /*
    A two-way signing is one recruit, not two: his bat may already have been
    placed while his arm still waits here (or the other way round), and both
    placements are the same young man. The id sets keep the count and the
    arrays honest — pushed into the second unit if genuinely unplaced there,
    counted once ever.
  */
  const batIds = new Set([...lineup, ...bench].map((m) => String(m.id)));
  const armIds = new Set([...rotation, ...bullpen].map((m) => String(m.id)));
  for (const extra of signedHitters) {
    if (batIds.has(String(extra.id))) continue;
    counted(extra);
    bench.push(extra); batIds.add(String(extra.id));
  }
  for (const extra of signedArms) {
    if (armIds.has(String(extra.id))) continue;
    counted(extra);
    bullpen.push(extra); armIds.add(String(extra.id));
  }

  team.lineup = lineup;
  team.bench = bench;
  team.rotation = rotation;
  team.bullpen = bullpen;
  return recruits;
}

/**
 * One walk-on, at the level a program that missed on him ends up with.
 *
 * Split out so the man the class review shows and the man the year roll puts on
 * the roster come off one piece of code rather than two that resemble each
 * other. Everything about him except the draws is fixed here: a freshman, aged
 * back into step with that, and marked — `Player.walkOn` is what puts him on a
 * one year lease and what the departure notice reads next June.
 */
function walkOnHitter(rng: Rng, quality: number, pos: Position): Hitter {
  const p = makeHitter(rng, quality - WALK_ON_PENALTY + gauss(rng) * 3, { pos });
  p.classYear = 'FR';
  // Generated at whatever class year the draw handed him, so his age has to
  // come back into step with the freshman the roster is about to call him.
  p.age = ageFor(p.id, 'FR');
  p.walkOn = true;
  return p;
}

function walkOnArm(rng: Rng, quality: number, role: 'SP' | 'RP'): Pitcher {
  const p = makePitcher(rng, quality - WALK_ON_PENALTY + gauss(rng) * 3, { role });
  p.classYear = 'FR';
  p.age = ageFor(p.id, 'FR');
  p.walkOn = true;
  return p;
}

/**
 * The stream a program's walk-ons come out of.
 *
 * Its own, rather than the season's. Walk-ons used to be drawn from the world
 * generator in the middle of a loop over ninety six programs, which made a
 * given program's men a function of every draw every program before it had
 * spent — unknowable from outside the loop, and therefore impossible to show
 * anybody before the loop ran. Off a seed of their own they are a function of
 * the year and the program and nothing else, which is what lets the class
 * review print the men who are actually coming.
 */
export const walkOnSeed = (year: number, team: number): number =>
  (((year + 1) * 2654435761) ^ ((team + 1) * 40503)) >>> 0 || 1;

/**
 * The men who will walk on, by name, before anybody has walked on.
 *
 * The class review runs on signing day and the roster is not rebuilt until the
 * year turns over, so these men do not exist yet at the moment the screen draws
 * them — and the screen shows them anyway, with faces and ratings and a card,
 * because "four bodies at C, 1B, SP, RP" is not information a coach can feel
 * anything about. What makes that honest rather than a mock-up is that these
 * *are* the men: `refill` takes its walk-ons from this same call, so the
 * catcher whose card you read on signing day is the catcher on the roster in
 * June, down to his face.
 *
 * Names go straight back to the pool — see `releaseNames` — because the pool is
 * the one thing that would make the second call differ from the first.
 */
export function walkOnClass(
  survivors: readonly Player[], signed: readonly Player[],
  quality: number, seed: number,
): Player[] {
  const rng = makeRng(seed);
  const made: Player[] = [];
  for (const row of walkOnShortfall(survivors, signed)) {
    for (let i = 0; i < row.count; i++) {
      made.push(row.pos === 'SP' || row.pos === 'RP'
        ? walkOnArm(rng, quality, row.pos)
        : walkOnHitter(rng, quality, row.pos as Position));
    }
  }
  releaseNames(made.map((p) => p.name));
  return made;
}

/**
 * Which spots this class is going to leave to walk-ons, worked out in advance.
 *
 * The class review happens on signing day and the walk-ons are not manufactured
 * until the year rolls over, so at the moment the screen renders those men do
 * not exist. The choice is between showing nothing until they do — a season too
 * late, and not where the shortfall is a decision you could still feel bad about
 * — and answering the question that *is* knowable now: which spots the survivors
 * and the signed class between them fail to cover. That is a fact about the
 * roster, not a guess, so this deliberately reports positions and counts and
 * invents no names, ratings or ids. Nothing here is fabricated that could later
 * disagree with the men who actually turn up.
 *
 * It walks `refill`'s placement in the same order, and the two must agree
 * exactly — "projects on signing day exactly the men who turn up in June" in
 * the tests is what holds them together, and it is not optional. It cannot
 * simply *be* `refill`: that one draws from the generator to build bodies, and
 * a screen may not spend the season's rng to render itself.
 */
export function walkOnShortfall(
  survivors: readonly Player[], signed: readonly Player[],
): { pos: string; count: number }[] {
  const roster = uniquePlayers(survivors);
  const classIn = uniquePlayers(signed);
  const hitters = byOverall(roster.filter((p): p is Hitter => p.type === 'hitter'));
  const arms = byArm(roster.filter(isArm));
  const signedHitters = byOverall(classIn.filter((p): p is Hitter => p.type === 'hitter'));
  const signedArms = byArm(classIn.filter(isArm));

  const short: string[] = [];
  // The same three-step choice `freshHitter` and `freshArm` make: somebody
  // signed who plays here, else the best bat or arm signed, else nobody.
  const takeHitter = (pos: Position): void => {
    const exact = signedHitters.findIndex((h) => h.pos === pos);
    if (exact >= 0) { signedHitters.splice(exact, 1); return; }
    const any = signedHitters.shift();
    if (any) return;
    short.push(pos);
  };
  const takeArm = (role: 'SP' | 'RP'): void => {
    const exact = signedArms.findIndex((a) => a.role === role);
    if (exact >= 0) { signedArms.splice(exact, 1); return; }
    const any = signedArms.shift();
    if (any) return;
    short.push(role);
  };

  for (const spot of LINEUP_SPOTS) {
    const i = hitters.findIndex((h) => h.pos === spot);
    if (i >= 0) hitters.splice(i, 1);
    else takeHitter(spot);
  }

  let bench = hitters.splice(0, BENCH_SIZE).length;
  while (bench < BENCH_SIZE) {
    takeHitter(LINEUP_SPOTS[bench % LINEUP_SPOTS.length] as Position);
    bench += 1;
  }

  const starters = arms.filter((p) => p.role === 'SP');
  const relievers = arms.filter((p) => p.role === 'RP');
  let rotation = starters.splice(0, ROTATION_SIZE).length;
  while (rotation < ROTATION_SIZE) { takeArm('SP'); rotation += 1; }

  let bullpen = Math.min(BULLPEN_SIZE, relievers.length + starters.length);
  while (bullpen < BULLPEN_SIZE) { takeArm('RP'); bullpen += 1; }

  // Grouped in the order the roster asked for them, which is the order the
  // diamond reads in rather than alphabetical or by size.
  const out: { pos: string; count: number }[] = [];
  for (const pos of short) {
    const row = out.find((r) => r.pos === pos);
    if (row) row.count += 1;
    else out.push({ pos, count: 1 });
  }
  return out;
}

/**
 * Turn the year over for the whole world.
 *
 * Mutates the rosters in `season.teams`, which become next season's rosters. The
 * season's statistics are not carried across — those belong to the year that
 * produced them, and a new season starts a fresh book.
 */
/**
 * How far below a program's own level an unrecruited body is.
 *
 * This is the entire cost of a bad recruiting class, so it has to bite. At the
 * old value of 5 — applied to every incoming player, recruited or not — a
 * program reloaded at its own quality no matter what it did, and four years of
 * recruiting changed nothing about the roster.
 */
const WALK_ON_PENALTY = 13;

export interface OffseasonOpts {
  /** The program the player coaches, so its board is not overwritten by the AI. */
  userTeam?: number;
  /**
   * The user coach's training skill, applied to his own program's development
   * and nobody else's. Neutral at the starting value of 20; at 99 it is worth
   * about sixteen percent more systematic growth — a real edge over four years
   * of a class, invisible in any single offseason.
   */
  training?: number;
}

const emptyReport = (): OffseasonReport => ({
  graduated: [], drafted: [], recruits: 0, signed: [], walkOns: [],
  developmentNet: 0, improved: 0, declined: 0, badges: [], holes: [],
});

/**
 * One man's season, in the terms a badge can be earned from.
 *
 * Read straight off the three season books rather than out of a ledger built
 * for the purpose — the same argument `records.ts` makes about the all-time
 * book. Every field a badge could ask about is already being kept for the
 * statistics screens, and a parallel accumulator would be a second thing to
 * keep in step with the first.
 */
function evidenceFor(season: SeasonState, id: PlayerId): BadgeEvidence {
  const bat = season.batting.get(id);
  const pit = season.pitching.get(id);
  const fld = season.fielding?.get(id);
  const ev: BadgeEvidence = {};
  if (bat) ev.bat = bat;
  if (pit) ev.pit = pit;
  if (fld) ev.fld = fld;
  return ev;
}

/**
 * What the structure needs that the survivors cannot supply.
 *
 * Counted against the shape a roster is rebuilt to — nine in the lineup, four
 * on the bench, four starters, six in the pen — so it says "you are two arms
 * and a catcher short" rather than "you lost six players".
 */
export function holesFor(survivors: readonly Player[]): { pos: string; count: number }[] {
  const one = uniquePlayers(survivors);
  const hitters = one.filter((p): p is Hitter => p.type === 'hitter');
  const arms = one.filter(isArm);
  const out: { pos: string; count: number }[] = [];

  for (const spot of LINEUP_SPOTS) {
    if (!hitters.some((h) => h.pos === spot)) out.push({ pos: spot, count: 1 });
  }
  const benchShort = BENCH_SIZE - Math.max(0, hitters.length - LINEUP_SPOTS.length);
  if (benchShort > 0) out.push({ pos: 'BENCH', count: benchShort });

  const sp = arms.filter((p) => p.role === 'SP').length;
  const rp = arms.filter((p) => p.role === 'RP').length;
  if (sp < ROTATION_SIZE) out.push({ pos: 'SP', count: ROTATION_SIZE - sp });
  if (rp < BULLPEN_SIZE) out.push({ pos: 'RP', count: BULLPEN_SIZE - rp });
  return out;
}

/**
 * How good a man has to be for his own staff to fight the draft over him.
 *
 * The top quarter of what is coming back, which is the honest reading of
 * "would he be one of the best players on next year's team". An empty roster —
 * a program the draft and graduation between them stripped — has no bar to
 * clear, and the number it falls back to is the level a walk-on arrives at.
 */
const KEEP_BAR_QUANTILE = 0.75;
function keepBar(survivors: readonly Player[]): number {
  if (survivors.length === 0) return 44;
  const sorted = survivors.map(overallOf).sort((a, b) => a - b);
  const at = Math.min(sorted.length - 1, Math.floor(KEEP_BAR_QUANTILE * sorted.length));
  return sorted[at] as number;
}

/**
 * Step one of the offseason: who leaves, and who gets better.
 *
 * Split out of `advanceOffseason` so the draft can be shown *before* recruiting
 * opens. The order matters to the player rather than to the simulation: the
 * holes the draft leaves are the holes the recruiting board should be about, and
 * a draft screen that arrives after signing day can only ever be a receipt.
 *
 * The rosters are left short on purpose. Nothing plays a game between here and
 * signing day, and a lineup with a gap in it is the truthful picture of a
 * program that has just lost its catcher.
 */
export function departAndDevelop(
  season: SeasonState, rng: Rng, opts: OffseasonOpts = {},
): OffseasonReport {
  const report = emptyReport();
  // What the clubs see, taken once against the season everybody just played,
  // so a .900 OPS is graded against the league that produced it.
  const ctx = draftContext(season);
  const mine = opts.userTeam ?? season.captureBoxFor;
  const board: DraftBoard = {
    year: season.year ?? 0, spent: 0, men: [], rivalSpend: {},
  };

  for (const record of season.teams) {
    const team = record.team;
    // The coach-skill nudge, and it is no longer the user's alone. Every chair
    // has a man in it who has been spending points for as long as he has held
    // it, so a program with a developer in charge brings its freshmen on faster
    // than one without — which is the same edge the player buys with TRAINING
    // and the same one he loses when a rival buys it too. A world that has never
    // been through `seatCoaches` has no rival coaches and falls back to the flat
    // twenty this was before, so nothing that does not want this pays for it.
    const trainer = record.index === opts.userTeam
      ? (opts.training ?? 20)
      : (record.coach?.skills.training ?? 20);
    /*
      And what the programme itself is for.

      Culture reaches the simulation here and almost nowhere else, deliberately.
      Development is the one channel where a school's identity plausibly changes
      an outcome without changing a *game* -- a place built on turning modest
      talent into contributors should do that measurably better, and it should
      not also make its hitters swing harder on a Tuesday.

      "Slight" is the word that was asked for and the word that governs. Six
      percent on the systematic pull, against the ten a fully trained coach
      buys: enough that a development school is a real reason to take a job,
      too little to be a strategy on its own.

      Only two edges act here. A pitching school gets more from its arms and
      nothing from its bats, which is the whole point of it being a pitching
      school. The other six are identities the *job market* reads rather than
      the simulation -- and a culture that quietly moved every number would be a
      culture nobody could reason about.
    */
    const edge = cultureFor(record)?.edge;
    const growthFromCulture = (p: Player): number =>
      edge === 'development' ? 0.03
      : edge === 'pitching' && p.type === 'pitcher' ? 0.04
      : 0;

    const growthMult = 1 + (trainer - 20) / 500;
    const roster: Player[] = uniquePlayers([
      ...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen,
    ]);

    const survivors: Player[] = [];
    // A rival's drafted underclassmen, held until the roster loop is done: his
    // staff has to see who is coming back before it can tell anybody there is a
    // job here, and half of what a case rests on is exactly that.
    const exposed: { man: DraftedMan; row: Departure }[] = [];
    for (const p of roster) {
      /**
       * A birthday, before anything else is decided.
       *
       * The draft is held in June and eligibility is read at that moment, so
       * the man who arrived at nineteen has to be twenty one *here*, at the end
       * of his sophomore season, and not a step later. Ticking after the
       * departure check would put the age clause a full year behind the rule it
       * is supposed to express.
       *
       * Everybody ages, including the men about to leave, because a drafted
       * junior really is twenty one on the day a club calls his name and the
       * departure notice should say so.
       */
      p.age += 1;
      /**
       * A walk-on gets the season he was found for, and that is all.
       *
       * Deliberately asked before `departure` and independently of his class
       * year. He is manufactured as a freshman today, but the rule is one
       * *season*, not one class year, and reading it off the class year would
       * quietly keep a walk-on who happened to arrive as an upperclassman for
       * three more. Asking first also costs no rng draw, so nothing about who
       * else leaves depends on how many walk-ons a program is carrying.
       */
      const reason = p.walkOn ? 'walk-on' as const : departure(p, rng);
      if (reason) {
        const row: Departure = {
          id: p.id,
          name: p.name,
          team: record.index,
          teamAbbr: record.def.abbr,
          classYear: p.classYear,
          age: p.age,
          overall: overallOf(p),
          reason,
        };
        if (reason === 'drafted') {
          row.round = draftRound(visibleValue(p, season, ctx));
          report.drafted.push(row);
          // Men with eligibility still on them are the only ones there is a
          // conversation to be had with anywhere; a senior has nothing left to
          // go back to. Yours land on the board and wait for you. A rival's are
          // settled below, by his own staff, out of his own money.
          if (p.classYear !== 'SR') {
            const man: DraftedMan = {
              player: p, round: row.round,
              pitch: null, offered: 0, made: 0, needed: 0, outcome: 'pending',
            };
            if (record.index === mine) board.men.push(man);
            else exposed.push({ man, row });
          }
        } else report.graduated.push(row);
        continue;
      }

      /*
        The year that does not count, which is the whole of a redshirt.

        He is a year older and a year better and he is still a freshman, which
        is exactly the trade: a body off a twenty-three man roster for a season
        in exchange for having him a fifth year. `bankRedshirt` also spends
        his one, so nobody sits twice.

        Deliberately inside this loop rather than beside it, so a redshirt goes
        through the same development, the same badge pass and the same report
        as everybody else. A man who sat out is not a man the offseason forgot.
      */
      const sat = (p as Player & { redshirt?: boolean }).redshirt === true;
      const next = NEXT_CLASS[p.classYear];
      if (next === null) continue;        // unreachable: seniors always depart
      if (!sat) p.classYear = next;
      const growth = sat
        ? growthMult * bankRedshirt(p)
        : growthMult + growthFromCulture(p);
      const gained = develop(p, rng, growth);
      report.developmentNet += gained;
      if (gained > 0) report.improved += 1; else report.declined += 1;
      // A winter's worth of badges: what the season he just played earned him,
      // and what his staff worked on with him. Deliberately after `develop`,
      // because the cap is read off his potential and `develop` can raise a
      // ceiling a man has already cleared.
      for (const id of developBadges(p, evidenceFor(season, p.id), board.year, trainer)) {
        if (record.index === mine) {
          report.badges.push({
            id: p.id, name: p.name, badge: id,
            tier: (p.badges?.find((b) => b.id === id)?.tier ?? 1) as 1 | 2 | 3,
          });
        }
      }
      survivors.push(p);
    }

    if (record.index === mine) report.holes = holesFor(survivors);

    regroup(team, survivors);

    // And now the other ninety five make the call the user is about to be
    // shown a screen for.
    //
    // After `regroup`, deliberately: `reinstate` puts a kept man back through
    // the same door, and running it against a roster that had not been closed
    // yet would have him rejoining a team that did not exist for another line.
    if (record.index !== mine && exposed.length > 0) {
      const stars = prestigeStars(record.prestige);
      // The bar a man has to clear to be worth fighting for: the top quarter of
      // what is coming back.
      //
      // A quantile rather than the mean, and the difference is the whole
      // behaviour. Measured against the mean, half a roster is below the bar by
      // construction and a drafted man is above it by selection — so every
      // program fought for everybody, and the ones that hoarded hardest were
      // the worst ones, whose late round picks cost four points each. Against
      // the top quarter the bar moves with the program: a good roster is hard
      // to be one of the best men on and a bad one is not much easier, because
      // a bad program's drafted man is a worse player.
      const level = keepBar(survivors);
      // What this program is prepared to put behind keeping people, out of the
      // same window its recruiting board is about to be paid from. `aiTargets`
      // reads what is left of it, three weeks running, exactly as the user's
      // header does.
      const allowance = Math.floor(windowBudget(stars) * AI_KEEP_SHARE);
      // The man in the chair, where there is one. Two of the four cases a staff
      // can make are about *him* — the development a coach can promise and the
      // word he can give — so a program run by somebody with a name and eleven
      // years in the building keeps a man a caretaker would lose. That is the
      // point of B7 reaching this screen at all rather than stopping at the
      // standings. A world without seated coaches falls back to the average
      // staff, which is what every program was before there was anybody in it.
      const staff = record.coach
        ? {
          prestige: record.coach.prestige,
          tenure: record.coach.tenure,
          training: record.coach.skills.training,
        }
        : AVERAGE_STAFF;
      const kept = rivalKeeps(
        exposed.map((e) => e.man),
        (m) => sceneFrom(record.prestige, survivors, staff, m.player, m.round),
        allowance,
        level,
      );
      let bill = 0;
      for (const { man, kind, price, scene } of kept) {
        // Through `makeTheCase` rather than around it. The AI is playing the
        // user's mechanic, not a parallel one that happens to agree with it
        // today — if the arithmetic of a pitch ever changes, it changes for
        // ninety six programs on the same line. And the offer is spent whether
        // it works or not for them too.
        const { spent, kept: stayed } = makeTheCase(
          man, kind, price, scene, allowance - bill,
        );
        bill += spent;
        if (!stayed) continue;
        // He goes back exactly the way one of yours does — class year, the
        // development year he was skipped for, and the same `regroup`, which
        // has already put him back in the roster arrays by the time this
        // returns. `survivors` is kept in step with it so the name does not
        // start lying to whatever gets written under it next.
        const grew = reinstate(team, man.player, rng);
        report.developmentNet += grew;
        if (grew > 0) report.improved += 1; else report.declined += 1;
        survivors.push(man.player);
      }
      if (bill > 0) board.rivalSpend[record.index] = bill;
      // The national board tells the truth about him: he was taken, and he did
      // not go. Every count of what a program lost already skips a `returned`
      // man, so this is the one line that keeps the BOARD tab from listing a
      // man who is on a college roster this minute.
      for (const { man, row } of exposed) {
        if (man.outcome === 'stayed') row.returned = true;
      }
    }
  }

  // Best first inside each round, so the national board reads like one.
  report.drafted.sort((a, b) => (a.round ?? 99) - (b.round ?? 99) || b.overall - a.overall);
  board.men.sort((a, b) => a.round - b.round || overallOf(b.player) - overallOf(a.player));
  season.draft = board;

  return report;
}

/**
 * Put the survivors back in the roster arrays, structure and all.
 *
 * `fillRosters` rebuilds the real shape once the class is known, so all this
 * has to do is keep the four arrays a legal home for everybody left. Written
 * once because a man talked out of the draft is put back through the same
 * door he came out of, and two versions of "where does he go" would eventually
 * disagree about a fourth starter.
 */
function regroup(team: Team, survivors: readonly Player[]): void {
  const bodies = uniquePlayers(survivors);
  const hitters = bodies.filter((p): p is Hitter => p.type === 'hitter');
  const arms = bodies.filter(isArm);
  const starters = arms.filter((p) => p.role === 'SP');
  /*
    One man per spot, the way `refill` does it.

    This used to take nine hitters off the top of the survivors in whatever
    order they arrived in, which routinely produced two catchers and nobody at
    short — reported as "there are times when it has players playing the same
    position". Between the draft step and signing day that broken nine is what
    every screen reads, and swapStarter inherits it. A spot with nobody left
    for it takes whoever is next, because the engine cannot field eight.
  */
  const pool = [...hitters];
  const lineup: Hitter[] = [];
  for (const spot of LINEUP_SPOTS) {
    let i = pool.findIndex((h) => h.pos === spot);
    if (i < 0) i = pool.length > 0 ? 0 : -1;
    if (i >= 0) lineup.push(pool.splice(i, 1)[0] as Hitter);
  }
  team.lineup = lineup;
  team.bench = pool;
  team.rotation = starters.slice(0, ROTATION_SIZE);
  team.bullpen = arms.filter(
    (p) => p.role === 'RP' || starters.indexOf(p) >= ROTATION_SIZE,
  );
}

/**
 * A man who was drafted and came back to school anyway.
 *
 * He missed the class-year bump and the development pass on the way out, so he
 * takes both now — which is the whole reason a returning junior is a senior
 * with no leverage next June, and why the year he bought you is a real year of
 * growth rather than a pause. He is put back through `regroup` for the same
 * reason everybody else went through it.
 *
 * Returns what the year did to him, so the offseason report's development
 * totals stay the sum of everybody who actually stayed.
 */
export function reinstate(
  team: Team, p: Player, rng: Rng, growthMult = 1,
): number {
  const next = NEXT_CLASS[p.classYear];
  if (next === null) return 0;
  p.classYear = next;
  const gained = develop(p, rng, growthMult);
  const survivors: Player[] = [
    ...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen, p,
  ];
  regroup(team, survivors);
  return gained;
}

/**
 * Step two: put the class on the roster, and walk-ons in whatever is left.
 *
 * Runs after signing day, so a scholarship you spent is a player who arrives and
 * a scholarship you did not is a body thirteen points below your own level.
 */
/**
 * The pros get to him first — stage 16's "recruits drafted out of high
 * school who never arrive. Signed, then gone before they play a game.
 * Cheap, and it stings in the right way."
 *
 * Derived off the man and the year, no draw — a reload cannot un-draft him
 * and the roll moves no stream. Weighted by the ceiling, because that is
 * what a July draft room buys: a signed 78 is safe almost always, a signed
 * 92 is a real risk every single time. Across a whole country's class this
 * takes one to three kids a year, so losing one is an event with a name on
 * it rather than a tax.
 */
export function takenByPros(p: Player, year: number): boolean {
  if (p.potential < 78) return false;
  let h = ((year * 2654435761) ^ 977) >>> 0;
  const id = String(p.id);
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return h % 1000 < (p.potential - 76) * 6;
}

/**
 * The half of a signed class that actually enrols.
 *
 * One function because four surfaces have to agree on it exactly: the year
 * roll that puts the class on the roster, the class review's walk-on
 * projection, the signing-day screen, and the tests that hold the
 * projection to "exactly the men who turn up in June." The July pro draft
 * runs before signing day, so a review that knows is honest, not psychic.
 */
export function enrolling(players: Player[], year: number): Player[] {
  return players.filter((p) => !takenByPros(p, year));
}

export function fillRosters(
  season: SeasonState, rng: Rng, opts: OffseasonOpts = {},
): {
  recruits: number; signed: Prospect[]; walkOns: OffseasonReport['walkOns'];
  poached: { id: string; name: string; pos: string; stars?: number }[];
} {
  const classFor = new Map<number, Player[]>();
  const signed: Prospect[] = [];
  const poached: { id: string; name: string; pos: string; stars?: number }[] = [];
  for (const prospect of season.recruiting.prospects) {
    if (prospect.signedBy === null) continue;
    if (takenByPros(prospect.player, season.recruiting.year)) {
      // He never enrols. The walk-on arithmetic below never sees him, so the
      // hole he leaves is filled the way any unspent scholarship is.
      if (prospect.signedBy === opts.userTeam) {
        const man = prospect.player;
        poached.push({
          id: String(man.id), name: man.name,
          pos: man.type === 'pitcher' ? (man as Pitcher).role : man.pos,
        });
      }
      continue;
    }
    const list = classFor.get(prospect.signedBy) ?? [];
    list.push(prospect.player);
    classFor.set(prospect.signedBy, list);
    if (prospect.signedBy === opts.userTeam) signed.push(prospect);
  }

  let recruits = 0;
  const walkOns: OffseasonReport['walkOns'] = [];
  // Whose walk-ons get written down, read the same way `departAndDevelop` reads
  // whose holes get written down. The app sets both to the same program, so this
  // only ever differs for a caller that names one and not the other — and a
  // report with the user's holes and nobody's walk-ons is the half-answer that
  // made this worth aligning.
  const reportFor = opts.userTeam ?? season.captureBoxFor;

  /*
    The reported program goes first, and that ordering is load bearing.

    A walk-on's name is drawn against the pool of names already in the world,
    which grows as this loop runs — so a program's men depend on how many
    programs went before it. That is fine for ninety five of them and fatal for
    the one whose men the class review has already printed, because the review
    ran with no walk-ons anywhere in the pool. Putting him first is what makes
    his June identical to the June he was shown. Everybody else reserves as they
    go, which is what keeps two walk-ons in one country from sharing a name.
  */
  const order = [...season.teams].sort(
    (a, b) => Number(b.index === reportFor) - Number(a.index === reportFor),
  );

  for (const record of order) {
    const team = record.team;
    const survivors: Player[] = [
      ...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen,
    ];
    const collected: Player[] = [];
    const signedHere = classFor.get(record.index) ?? [];
    // Drawn off the program and the year rather than out of the middle of this
    // loop, so the men are the ones the class review already named.
    const bodies = walkOnClass(
      survivors, signedHere, team.quality,
      walkOnSeed(season.recruiting.year, record.index),
    );
    reserveNames(bodies.map((p) => p.name));
    recruits += refill(
      team, survivors, rng, signedHere,
      record.index === reportFor ? collected : undefined,
      bodies,
    );
    for (const p of collected) {
      walkOns.push({
        id: p.id, name: p.name,
        pos: p.type === 'pitcher' ? (p as Pitcher).role : p.pos,
        overall: overallOf(p),
      });
    }
  }
  return { recruits, signed, walkOns, poached };
}

/**
 * Both halves at once, which is what a simulated year and every test wants.
 */
export function advanceOffseason(
  season: SeasonState, rng: Rng, opts: OffseasonOpts = {},
): OffseasonReport {
  const report = departAndDevelop(season, rng, opts);
  const filled = fillRosters(season, rng, opts);
  report.recruits = filled.recruits;
  report.signed = filled.signed;
  report.walkOns = filled.walkOns;
  return report;
}
