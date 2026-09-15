// roster.ts
// How a roster is assembled: from a signed class in June, and from four of
// them on the day a world is made.
//
// Lifted out of progression.ts on 2026-09-15 so that the generator can call
// `refill`. Until then `makeTeam` (players.ts) built a roster nobody ever
// has -- nine, four, four and six, one man a spot, drawn at the programme's
// quality with no walk-on and no junior the clubs had taken -- while every
// June from the first rebuilt the ninety-six to a different shape: a signed
// class of about seven placed by `refill`, the extras carried on the bench
// and in the pen, a walk-on wherever the class left a hole. Measured over ten
// seasons on four seeds (tests/class-census.ts, 05 s85), the recruited
// roster is twenty-eight men to the generated twenty-three, its nine two
// points better and its four four points better because they are the best
// of a deeper pool, and its pen and bench worse because the walk-ons play.
// That step, about three percent in runs, was the whole of the "drift" the
// stationarity pass left: the world was flat from year two, it was year one
// that stood somewhere no season ever returns to.
//
// So a generated roster is now four signed classes run through the same
// `refill` June runs, with the same walk-on rule, and the harness in
// calibration.ts stands on the same men. players.ts cannot import this file
// (this file imports it), which is why `makeTeam` moved here with the code
// it needed rather than the other way round.

import { ageFor, makeHitter, makePitcher, releaseNames } from './players.js';
import { develop } from './development.js';
import { adoptSpot, setTheCard } from './depthChart.js';
import { armValue, overallOf, clamp } from './ratings.js';
import { gauss } from './rng.js';
import { isTwoWay, uniquePlayers } from './types.js';
import type { Arm, Hitter, Pitcher, Player, Position, Rng, Team } from './types.js';

/**
 * Positions a class is built to cover, in proportion to what a roster turns
 * over — and the proportion was wrong for years, in a way nothing measured.
 *
 * It was eight bats to five arms, 38% arms, for a roster that is thirteen
 * bats and ten arms, 43%. A census of the country (tests/class-census.ts,
 * 2026-09-15) found what that costs: 141 to 180 of the nation's ~1,070
 * pitchers every season were walk-ons at overall 32 — one arm in six —
 * against 46 to 63 of ~1,500 bats. A walk-on is released after his one
 * season, so the hole he filled reopens every winter, and the country's
 * pitching sat three points under the world it was generated as while its
 * hitting rose two. That five-point swing toward the bats is most of the two
 * runs a game the league gained between its first season and its fifth
 * (05 §71, §83) — not the ladder, not the engine.
 *
 * Seven arms in fifteen now, 47%: 3.5 arms a programme a year against a
 * staff that turns over about that many, and four bats against a lineup
 * and bench that turn over about four. Four starters to three relievers
 * because a pitcher is recruited as a starter and becomes a reliever, not
 * the other way round.
 */
export const CLASS_SHAPE: readonly (Position | 'SP' | 'RP')[] = [
  'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF',
  'SP', 'SP', 'SP', 'SP', 'RP', 'RP', 'RP',
];

export const LINEUP_SPOTS: readonly Position[] = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];

/**
 * The default staff, and the number every world but one is rebuilt to.
 *
 * A fifty-six game schedule carries five starters — see `rotationSizeFor` — so
 * the rebuild has to be told, or the fifth man is quietly dropped at the first
 * winter and the world spends its second season handing the midweek back to the
 * Friday ace.
 */
export const ROTATION_SIZE = 4;
export const BULLPEN_SIZE = 6;
export const BENCH_SIZE = 4;

/**
 * How far below a program's own level an unrecruited body is.
 *
 * This is the entire cost of a bad recruiting class, so it has to bite. At the
 * old value of 5 — applied to every incoming player, recruited or not — a
 * program reloaded at its own quality no matter what it did, and four years of
 * recruiting changed nothing about the roster.
 */
export const WALK_ON_PENALTY = 13;

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
export const LEVERAGE_DISCOUNT: Record<number, number> = { 0: 0.6, 1: 1, 2: 0.35, 3: 0.15 };

/** Best first. */
export const byOverall = <T extends Player>(xs: T[]): T[] =>
  [...xs].sort((a, b) => overallOf(b) - overallOf(a));

/** Anybody with an arm job, ranked by the arm. */
export const isArm = (p: Player): p is Arm => p.type === 'pitcher' || isTwoWay(p);
export const byArm = <T extends Arm>(xs: T[]): T[] =>
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
export function refill(
  team: Team, survivors: Player[], rng: Rng, signed: Player[] = [],
  collect?: Player[], walkOns: readonly Player[] = [],
  rotationSize = ROTATION_SIZE,
  /** The coached programme: his surviving nine keep the order he had them in. */
  keepOrder = false,
): number {
  const hadOrder = new Map(team.lineup.map((h, i) => [String(h.id), i]));
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
    // else a walk-on. A man promised his position is never the "best bat
    // signed" for somebody else's hole: the refill moved him on the day he
    // arrived and the promise read as broken before the coach had made a
    // single decision (05 §62.4). He waits for his own spot or the bench.
    const exact = signedHitters.findIndex((h) => h.pos === pos);
    if (exact >= 0) return counted(signedHitters.splice(exact, 1)[0] as Hitter);
    const free = signedHitters.findIndex((h) => h.recruitPromise?.kind !== 'keepPosition');
    const any = free >= 0 ? signedHitters.splice(free, 1)[0] : undefined;
    // Through `adoptSpot`, so he stays the shortstop he was signed as and
    // the card remembers it: the spot is his to play, not his to be. It
    // used to overwrite the label, which made a signed infielder an
    // outfielder for life -- holding the infield badge he was signed with,
    // and never considered for short again when short opened.
    if (any) { adoptSpot(any, pos); return counted(any); }
    const p = (spare.get(pos)?.shift() as Hitter | undefined)
      ?? (walkOnHitter(rng, team.quality, pos));
    collect?.push(p);
    return counted(p);
  };
  const freshArm = (role: 'SP' | 'RP'): Arm => {
    const exact = signedArms.findIndex((a) => a.role === role);
    if (exact >= 0) return counted(signedArms.splice(exact, 1)[0] as Arm);
    // He keeps the role he was signed as. This used to relabel him, and the
    // relabel was for life: a signed starter parked in the pen because the
    // rotation was full became an RP, and next June's rotation is picked from
    // SP labels (`starters` below), so the country's rotations were drawn
    // from a pool a man smaller every year -- 6.3 SP-labelled arms a roster
    // by year five against the 7.5 the class shape signs, and a rotation a
    // point and a half under the best four starters actually on the roster
    // (tests/class-census.ts, 05 s85). A starter in the pen is a starter in
    // the pen, which is what the note under `bullpen` already says of the
    // survivors; a reliever pressed into the rotation is a stopgap the next
    // June sees through.
    const any = signedArms.shift();
    if (any) return counted(any);
    const p = (spare.get(role)?.shift() as Pitcher | undefined)
      ?? (walkOnArm(rng, team.quality, role));
    collect?.push(p);
    return counted(p);
  };

  // The lineup wants a body at every spot on the diamond. Take the best
  // returning player who plays there; sign one if nobody does. The DH slot
  // is the exception because a DH is not a species — it takes the best bat
  // left whatever his position, and never manufactures a "DH". Reported:
  // "there should not be a need for DH; we just select someone to be there."
  const lineup: Hitter[] = [];
  for (const spot of LINEUP_SPOTS) {
    if (spot === 'DH') {
      /*
        The slot adopts him rather than him becoming a "DH": position
        memory keeps his real spot on the card, the engine keeps its one
        man per label, and a returning starter moved here is NOT a recruit
        — only a signed bat consumed for the slot counts.
      */
      const returning = hitters.shift();
      // A signed bat takes the slot only if his position was not promised him.
      const freeIndex = signedHitters.findIndex((h) => h.recruitPromise?.kind !== 'keepPosition');
      const best = returning ?? (freeIndex >= 0 ? signedHitters.splice(freeIndex, 1)[0] : undefined);
      if (best) {
        if (!returning) counted(best);
        adoptSpot(best, 'DH');
        lineup.push(best);
      } else {
        const made = freshHitter('1B');
        adoptSpot(made, 'DH');
        lineup.push(made);
      }
      continue;
    }
    const i = hitters.findIndex((h) => h.pos === spot);
    if (i >= 0) lineup.push(hitters.splice(i, 1)[0] as Hitter);
    else lineup.push(freshHitter(spot));
  }

  /*
    Every returning bat past the nine stays. The bench was cut to four here
    and the rest of the survivors — men who were on the roster in May, not
    drafted, not graduated, not in the portal — silently ceased to exist,
    forty to seventy of them a June once the classes were signed, the coached
    program's included (05 §62.4). A roster is allowed to be deep; it is not
    allowed to lose a man to nothing.
  */
  const bench: Hitter[] = hitters.splice(0, hitters.length);
  while (bench.length < BENCH_SIZE) {
    bench.push(freshHitter(LINEUP_SPOTS[bench.length % LINEUP_SPOTS.length] as Position));
  }

  const starters = arms.filter((p) => p.role === 'SP');
  const relievers = arms.filter((p) => p.role === 'RP');

  const rotation: Arm[] = starters.splice(0, rotationSize);
  while (rotation.length < rotationSize) rotation.push(freshArm('SP'));

  // Starters who did not make the rotation slide to the bullpen, exactly as they
  // would in a real program.
  const bullpen: Arm[] = [...relievers, ...starters];
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

  // Same rule as `regroup`, for the same man: the June refill gathers the
  // nine in spot order to fill holes, and for the coached programme that
  // was quietly a re-deal of his batting order. His survivors keep their
  // places; the men who arrived take the places the departed left.
  if (keepOrder) {
    const kept = lineup.filter((h) => hadOrder.has(String(h.id)))
      .sort((a, b) => (hadOrder.get(String(a.id)) ?? 0) - (hadOrder.get(String(b.id)) ?? 0));
    const added = lineup.filter((h) => !hadOrder.has(String(h.id)));
    lineup.splice(0, lineup.length, ...kept, ...added);
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
export function walkOnHitter(rng: Rng, quality: number, pos: Position): Hitter {
  // Built as the freshman he is. He used to be drawn at whatever class the
  // generator handed him and relabelled afterwards, which was harmless while
  // a class was only a label; now that the generator ages a man into his
  // class, a relabelled junior would arrive with two winters he never had.
  const p = makeHitter(rng, quality - WALK_ON_PENALTY + gauss(rng) * 3, { pos, classYear: 'FR' });
  p.walkOn = true;
  return p;
}

export function walkOnArm(rng: Rng, quality: number, role: 'SP' | 'RP'): Pitcher {
  const p = makePitcher(rng, quality - WALK_ON_PENALTY + gauss(rng) * 3, { role, classYear: 'FR' });
  p.walkOn = true;
  return p;
}

/**
 * How many men a programme's board lands in a winter.
 *
 * The country signs 640 to 670 of a class of 720 every year, 6.7 to 7.0 a
 * programme, and it does not sign them evenly: measured over four winters
 * (tests/class-census.ts, seed 4242, 96 boards each), 52% of boards land
 * all eight scholarships, 11% seven, 13% six, 10% five, 5% four and 7% three
 * or fewer. The table below is that distribution in twenty-five seats, mean
 * 6.7; one draw picks a seat.
 *
 * The variance is the point, not the mean. June's walk-ons come from thin
 * rosters -- the class a staff lost most of, landing on whatever the draft
 * and the portal left -- and a stack of four even classes has no thin
 * rosters, so `refill` made about one walk-on a roster where a June leaves
 * two and a half, on rosters where he then actually plays. Four classes
 * drawn from this table leave the thin ones a June does.
 */
const LANDED_A_CLASS: readonly number[] = [
  8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
  7, 7, 7, 6, 6, 6, 5, 5, 5, 4, 3, 2,
];

/**
 * How far above a programme's quality the men its recruiting leaves stand.
 *
 * The class ladder (recruiting.ts, `generateClass`) is one national
 * distribution and the country's quality table is another, and they do not
 * sit on the same number: the ninety-six programmes average 42.5 and the
 * freshmen they sign average about 45. Then recruiting selects -- a board
 * takes the men with the ceilings the services believe in, and a signed
 * class outgrows a drawn one by a point and a half between its first
 * spring and its third -- and it selects differently on the two sides,
 * because a reliever's profile reads better to the services than a
 * starter's and grows less. What reaches the field, measured PA-weighted
 * and outs-weighted with the walk-ons taken out (tests/class-census.ts,
 * ten seasons, four seeds, 05 s85): bats about three above the table and
 * arms at it, once the roster is stacked the way June stacks it -- the
 * rotation is the best four of a pool the shape already over-supplies, and
 * a point of lift on the arms read as two on the four. A roster built at
 * the table's number was therefore three points of bat under the roster
 * its own recruiting would leave, and a career's first two seasons were
 * played in a league weaker than every season after them.
 *
 * Two and minus one since the ladder's bottom came down (05 s87): the men a
 * June leaves on the field read a point under the day-one roster on both
 * sides once a one-star is a 29 and a two-star a 40, and the arms a point
 * under the table itself. The sign on the arms is a fact about recruiting,
 * not about the table: the class shape over-supplies starters, the boards
 * sign fewer arms than it offers, and the services read a reliever's
 * profile better than a starter's, so what reaches a rotation stands a
 * little under what the school is.
 *
 * Applied to the signed classes and not to the walk-ons, who come at the
 * walk-on penalty under the programme's own quality in June and here alike.
 * The ladder was left where the reporter tuned it (05 s77) rather than
 * moved down to meet the table, because the ladder is the surface a coach
 * reads every winter and a day-one roster is not. What the ladder does to
 * the SHAPE of the country -- a sixty-six signs at fifty-seven and a
 * twenty-seven at forty, the table's spread of eleven narrowing to eight
 * inside a decade -- is not a level and is not corrected here; it is the
 * open question at 06 sAI.
 */
export const RECRUITED_LIFT = { bat: 2, arm: -1 } as const;

/**
 * The share of drafted juniors a staff talks back.
 *
 * Every rival programme settles its drafted underclassmen out of its own
 * window (`rivalKeeps`, progression.ts), and it keeps 26 to 33 percent of
 * them a June -- 199 to 209 juniors taken a year, 52 to 65 back, the ones
 * who go averaging 65 overall. A generated senior class that had lost
 * every junior the clubs called for stood four points under a recruited
 * one (48.7 against 52.6 for bats); this is the discount that makes it the
 * class June leaves.
 */
export const DRAFTED_JUNIORS_KEPT = 0.29;


/**
 * The roster a programme actually has.
 *
 * Four signed classes, each as many men as a board lands (`LANDED_A_CLASS`)
 * drawn from `CLASS_SHAPE` at the level the programme's recruiting leaves
 * (`RECRUITED_LIFT` over its quality, by side) and built as the freshmen
 * they were (see HitterOpts): a
 * generated senior is a freshman plus three real winters, which is what a
 * recruited senior is. The seniors are the men the clubs passed on or the
 * staff talked back -- each is built to his junior year, offered to the
 * June draft at the same `draftChance` the offseason uses less the share
 * `DRAFTED_JUNIORS_KEPT`, and only then given his last winter -- so a
 * day-one senior class is as thin as a fifth-year one, which is the thing
 * a stacked class would otherwise get wrong.
 *
 * Then `refill`, exactly as June runs it on a class and no survivors: the
 * best arms make the rotation, the best bats the nine, a man who plays a
 * spot nobody signed for is relabelled to it as a recruit would be, and a
 * count the class does not reach is made up with walk-ons at the walk-on
 * penalty, which on the thin rosters a landed class leaves is what June
 * leaves too. Extras carry on the bench and in the pen. Then the card is
 * dealt, so the harness plays the batting order a programme would.
 *
 * Three of the numbers above are measured off the world's own Junes rather
 * than derived (the landing table, the lift, the keep); tests/class-census.ts
 * is the instrument that fitted them and tests/calibration-seasons.test.ts
 * the guard that fails when June stops leaving what they say it leaves.
 *
 * `starters` defaults to four, and the default is load bearing: only the
 * fifty-six game schedule passes anything else (see `rotationSizeFor`), and
 * every arm is a draw.
 */
export function makeTeam(rng: Rng, name: string, quality = 50, starters = ROTATION_SIZE): Team {
  const team: Team = { name, lineup: [], rotation: [], bullpen: [], bench: [], quality };
  const signed: Player[] = [];
  // Oldest class first: the men who arrived first come off the stream first.
  for (const cls of ['SR', 'JR', 'SO', 'FR'] as const) {
    const landed = LANDED_A_CLASS[Math.floor(rng() * LANDED_A_CLASS.length)]!;
    for (let i = 0; i < landed; i++) {
      const slot = CLASS_SHAPE[Math.floor(rng() * CLASS_SHAPE.length)]!;
      // A senior is built to his junior year first; his last winter is below.
      const built = cls === 'SR' ? 'JR' : cls;
      const p: Player = slot === 'SP' || slot === 'RP'
        ? makePitcher(rng, quality + RECRUITED_LIFT.arm, { role: slot, classYear: built })
        : makeHitter(rng, quality + RECRUITED_LIFT.bat, { pos: slot, classYear: built });
      if (cls === 'SR') {
        // The June the clubs had first. A junior holds one year of leverage,
        // which is the discount `departure` applies to him, and his staff
        // talked back the share it talks back.
        const called = draftChance(overallOf(p)) * (LEVERAGE_DISCOUNT[1] ?? 1);
        if (rng() < called * (1 - DRAFTED_JUNIORS_KEPT)) {
          // He was never here, so his name goes back too. Left reserved it
          // stayed in this process's pool and in no save's, and a career
          // resumed from disk grew a different class from the one the
          // running app would have -- the exact fault identity.test.ts
          // watches for.
          releaseNames([p.name]);
          continue;
        }
        p.classYear = 'SR';
        p.age = ageFor(p.id, 'SR');
        develop(p, rng);
      }
      signed.push(p);
    }
  }
  refill(team, [], rng, signed, undefined, [], starters);
  setTheCard(team, 0);
  return team;
}
