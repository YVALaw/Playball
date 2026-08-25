// progression.ts
// The year turns over. Seniors graduate, the draft takes the best juniors,
// everyone who stays gets better or worse, and a freshman class arrives.
//
// This runs for all 96 programs, not just yours. Roughly a quarter of the
// world's four thousand players leave every June and are replaced, which is what
// stops a dynasty from being the same names forever — and it is the mechanism
// behind the roadmap's central promise: you never keep your best players.

import {
  draftContext, draftEligible, draftRound, visibleValue, yearsOfLeverage,
  type DraftBoard, type DraftedMan,
} from './draft.js';
import { ageFor, makeHitter, makePitcher } from './players.js';
import { overallOf, clamp } from './ratings.js';
import type { Prospect } from './recruiting.js';
import { gauss } from './rng.js';
import type { SeasonState } from './season.js';
import type {
  ClassYear, Hitter, Pitcher, Player, PlayerId, Position, Rng, Team,
} from './types.js';

/** Roughly how many bodies a program has to replace. Sizes the AI's board. */
function countHoles(team: Team): number {
  const roster: Player[] = [
    ...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen,
  ];
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
 * A year of development, applied after the class year advances.
 *
 * Players move toward their potential, fastest early: the jump from freshman to
 * sophomore is the biggest a college player ever makes. The noise term is what
 * makes recruiting a gamble rather than arithmetic — a 60 potential freshman can
 * stall, and a 48 can outgrow his projection.
 */
function develop(p: Player, rng: Rng, growthMult = 1): number {
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
  collect?: Player[],
): number {
  const hitters = byOverall(survivors.filter((p): p is Hitter => p.type === 'hitter'));
  const arms = byOverall(survivors.filter((p): p is Pitcher => p.type === 'pitcher'));
  let recruits = 0;

  // The signed class, best first, waiting to be placed.
  const signedHitters = byOverall(signed.filter((p): p is Hitter => p.type === 'hitter'));
  const signedArms = byOverall(signed.filter((p): p is Pitcher => p.type === 'pitcher'));

  const freshHitter = (pos: Position): Hitter => {
    recruits += 1;
    // Somebody you actually recruited who plays here, else the best bat signed,
    // else a walk-on.
    const exact = signedHitters.findIndex((h) => h.pos === pos);
    if (exact >= 0) return signedHitters.splice(exact, 1)[0] as Hitter;
    const any = signedHitters.shift();
    if (any) { any.pos = pos; return any; }
    const p = makeHitter(rng, team.quality - WALK_ON_PENALTY + gauss(rng) * 3, { pos });
    p.classYear = 'FR';
    // Generated at whatever class year the draw handed him, so his age has to
    // come back into step with the freshman the roster is about to call him.
    p.age = ageFor(p.id, 'FR');
    p.walkOn = true;
    collect?.push(p);
    return p;
  };
  const freshArm = (role: 'SP' | 'RP'): Pitcher => {
    recruits += 1;
    const exact = signedArms.findIndex((a) => a.role === role);
    if (exact >= 0) return signedArms.splice(exact, 1)[0] as Pitcher;
    const any = signedArms.shift();
    if (any) { any.role = role; return any; }
    const p = makePitcher(rng, team.quality - WALK_ON_PENALTY + gauss(rng) * 3, { role });
    p.classYear = 'FR';
    p.age = ageFor(p.id, 'FR');
    p.walkOn = true;
    collect?.push(p);
    return p;
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

  const rotation: Pitcher[] = starters.splice(0, ROTATION_SIZE);
  while (rotation.length < ROTATION_SIZE) rotation.push(freshArm('SP'));

  // Starters who did not make the rotation slide to the bullpen, exactly as they
  // would in a real program.
  const bullpen: Pitcher[] = [...relievers, ...starters].slice(0, BULLPEN_SIZE);
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
  for (const extra of signedHitters) { recruits += 1; bench.push(extra); }
  for (const extra of signedArms) { recruits += 1; bullpen.push(extra); }

  team.lineup = lineup;
  team.bench = bench;
  team.rotation = rotation;
  team.bullpen = bullpen;
  return recruits;
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
  const hitters = byOverall(survivors.filter((p): p is Hitter => p.type === 'hitter'));
  const arms = byOverall(survivors.filter((p): p is Pitcher => p.type === 'pitcher'));
  const signedHitters = byOverall(signed.filter((p): p is Hitter => p.type === 'hitter'));
  const signedArms = byOverall(signed.filter((p): p is Pitcher => p.type === 'pitcher'));

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
  developmentNet: 0, improved: 0, declined: 0, holes: [],
});

/**
 * What the structure needs that the survivors cannot supply.
 *
 * Counted against the shape a roster is rebuilt to — nine in the lineup, four
 * on the bench, four starters, six in the pen — so it says "you are two arms
 * and a catcher short" rather than "you lost six players".
 */
export function holesFor(survivors: readonly Player[]): { pos: string; count: number }[] {
  const hitters = survivors.filter((p): p is Hitter => p.type === 'hitter');
  const arms = survivors.filter((p): p is Pitcher => p.type === 'pitcher');
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
  const board: DraftBoard = { year: season.year ?? 0, spent: 0, men: [] };

  for (const record of season.teams) {
    const team = record.team;
    // The coach-skill nudge: only the user's program trains above the norm.
    const growthMult = record.index === opts.userTeam
      ? 1 + ((opts.training ?? 20) - 20) / 500
      : 1;
    const roster: Player[] = [
      ...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen,
    ];

    const survivors: Player[] = [];
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
          // Your own men with eligibility still on them are the only ones there
          // is a conversation to be had with. A senior has nothing left to go
          // back to, and a rival program's junior is not yours to talk to.
          if (record.index === mine && p.classYear !== 'SR') {
            board.men.push({
              player: p, round: row.round,
              pitch: null, offered: 0, made: 0, needed: 0, outcome: 'pending',
            });
          }
        } else report.graduated.push(row);
        continue;
      }

      const next = NEXT_CLASS[p.classYear];
      if (next === null) continue;        // unreachable: seniors always depart
      p.classYear = next;
      const gained = develop(p, rng, growthMult);
      report.developmentNet += gained;
      if (gained > 0) report.improved += 1; else report.declined += 1;
      survivors.push(p);
    }

    if (record.index === mine) report.holes = holesFor(survivors);

    regroup(team, survivors);
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
  const hitters = survivors.filter((p): p is Hitter => p.type === 'hitter');
  const arms = survivors.filter((p): p is Pitcher => p.type === 'pitcher');
  const starters = arms.filter((p) => p.role === 'SP');
  team.lineup = hitters.slice(0, LINEUP_SPOTS.length);
  team.bench = hitters.slice(LINEUP_SPOTS.length);
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
export function fillRosters(
  season: SeasonState, rng: Rng, opts: OffseasonOpts = {},
): { recruits: number; signed: Prospect[]; walkOns: OffseasonReport['walkOns'] } {
  const classFor = new Map<number, Player[]>();
  const signed: Prospect[] = [];
  for (const prospect of season.recruiting.prospects) {
    if (prospect.signedBy === null) continue;
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
  for (const record of season.teams) {
    const team = record.team;
    const survivors: Player[] = [
      ...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen,
    ];
    const collected: Player[] = [];
    recruits += refill(
      team, survivors, rng, classFor.get(record.index) ?? [],
      record.index === reportFor ? collected : undefined,
    );
    for (const p of collected) {
      walkOns.push({
        id: p.id, name: p.name,
        pos: p.type === 'pitcher' ? (p as Pitcher).role : p.pos,
        overall: overallOf(p),
      });
    }
  }
  return { recruits, signed, walkOns };
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
