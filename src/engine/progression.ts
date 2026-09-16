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
import { releaseNames, reserveNames } from './players.js';
import {
  LINEUP_SPOTS, ROTATION_SIZE, BULLPEN_SIZE, BENCH_SIZE,
  draftChance, LEVERAGE_DISCOUNT, byOverall, byArm, isArm, refill, walkOnHitter, walkOnArm,
} from './roster.js';
// The draft's odds moved to roster.ts with `refill` (the generator reads
// them too); the screens that always asked here still can.
export { draftChance } from './roster.js';
import { develop } from './development.js';
export { arcOf, arcReach } from './development.js';
export type { Arc } from './development.js';
import { adoptSpot, setTheCard } from './depthChart.js';
import { coverTier } from './positions.js';
import { prestigeStars } from './program.js';
import { GENERATED_POTENTIAL_CAP } from './scouting.js';
import { armValue, overallOf, clamp, respectCeiling } from './ratings.js';
import { flexibleOffseasonBudget, windowBudget } from './recruiting.js';
import type { Prospect } from './recruiting.js';
import { makeRng } from './rng.js';
import { cultureFor } from '../data/cultures.js';
import { bankRedshirt } from './redshirt.js';
// Value import, and safe: `season.ts` imports nothing from this file, so
// there is no loop to close. The rotation rule belongs beside the schedule
// that sets it rather than being restated here.
import { rotationSizeFor } from './season.js';
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
 * The odds this man is gone in June, before the draw that decides it.
 *
 * `departure` spends an `rng()` on exactly this number, so a March board
 * cannot know WHO goes — but it can know who is likely to, and it is the same
 * arithmetic rather than a second opinion about it. Reported 2026-09-12: "the
 * needs in recruitment should also take into account the sr year who are about
 * to graduate so we get ready and cover those positions as well the players
 * likely to get drafted."
 *
 * A senior is certain whatever this returns — he graduates if nobody calls —
 * so callers handle him separately and this speaks only about the men who have
 * a choice. Draws nothing, so a screen may call it as often as it likes.
 */
export function departureOdds(p: Player): number {
  if (!draftEligible(p)) return 0;
  const leverage = yearsOfLeverage(p.classYear);
  return draftChance(overallOf(p)) * (LEVERAGE_DISCOUNT[leverage] ?? 1);
}

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
  rotationSize = ROTATION_SIZE,
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
    if (spot === 'DH') {
      // The same three-step choice refill's DH branch makes: best returning
      // bat, else best signed bat, else the manufactured man is an ordinary
      // corner bat rather than a "DH".
      const best = hitters.shift() ?? signedHitters.shift();
      if (!best) short.push('1B');
      continue;
    }
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
  let rotation = starters.splice(0, rotationSize).length;
  while (rotation < rotationSize) { takeArm('SP'); rotation += 1; }

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
  /** Stage 22: the hitting coach's development channel, bats only. */
  trainingBat?: number;
  /** And the pitching coach's, arms only. A two-way man reads the mean. */
  trainingArm?: number;
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
export function holesFor(
  survivors: readonly Player[], rotationSize = ROTATION_SIZE,
): { pos: string; count: number }[] {
  const one = uniquePlayers(survivors);
  const hitters = one.filter((p): p is Hitter => p.type === 'hitter');
  const arms = one.filter(isArm);
  const out: { pos: string; count: number }[] = [];

  for (const spot of LINEUP_SPOTS) {
    // A DH is a slot, not a species: any bat fills it, so it can never be
    // a hole with a name. The shortfall it could cause is a body count,
    // rolled into BENCH below.
    if (spot === 'DH') continue;
    if (!hitters.some((h) => h.pos === spot)) out.push({ pos: spot, count: 1 });
  }
  const fieldHoles = out.length;
  // Nine in the lineup and the bench behind them, less the bodies here and
  // the ones the named holes will bring in.
  const benchShort = LINEUP_SPOTS.length + BENCH_SIZE
    - hitters.length - fieldHoles;
  if (benchShort > 0) out.push({ pos: 'BENCH', count: benchShort });

  const sp = arms.filter((p) => p.role === 'SP').length;
  const rp = arms.filter((p) => p.role === 'RP').length;
  if (sp < rotationSize) out.push({ pos: 'SP', count: rotationSize - sp });
  if (rp < BULLPEN_SIZE) out.push({ pos: 'RP', count: BULLPEN_SIZE - rp });
  return out;
}

/**
 * Where the roster is one injury from a stretch.
 *
 * `walkOnShortfall` and `holesFor` say which spots nobody can start at. This
 * is the second tier of need, asked for on 2026-09-10: "the needs should still
 * count the positions that don't have a backup as needs." A spot is thin when
 * exactly one man on the roster and the signed class can play it as his own
 * or as a natural cover (`coverTier` of one or less) — a starter and nobody
 * behind him. A spot nobody can play at all is an open hole and belongs to
 * the other list, so it is not repeated here. The rotation is thin without a
 * fifth starter to lean on.
 *
 * Counted on the same men the walk-on projection reads, survivors plus the
 * signed class, so the tab and June agree.
 */
export function depthShortfall(
  survivors: readonly Player[], signed: readonly Player[],
): { pos: string; count: number }[] {
  const men = uniquePlayers([...survivors, ...signed]);
  const hitters = men.filter((p): p is Hitter => p.type === 'hitter');
  const out: { pos: string; count: number }[] = [];
  for (const spot of LINEUP_SPOTS) {
    if (spot === 'DH') continue;
    const able = hitters.filter((h) => coverTier(h, spot) <= 1).length;
    if (able === 1) out.push({ pos: spot, count: 1 });
  }
  const starters = men.filter(isArm).filter((p) => p.role === 'SP').length;
  if (starters === ROTATION_SIZE) out.push({ pos: 'SP', count: 1 });
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
    /*
      Stage 22: the game-side coaches develop their own side. The split
      only exists on the user's record — a rival's whole staff is already
      priced into his head coach — and a two-way man, one body under both
      coaches, reads the mean of the two rooms.
    */
    const coached = record.index === mine;
    const batMult = coached && opts.trainingBat !== undefined
      ? 1 + (opts.trainingBat - 20) / 500 : growthMult;
    const armMult = coached && opts.trainingArm !== undefined
      ? 1 + (opts.trainingArm - 20) / 500 : growthMult;
    const growthFor = (p: Player): number =>
      (p as { twoWay?: true }).twoWay === true ? (batMult + armMult) / 2
        : p.type === 'pitcher' ? armMult : batMult;
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
          // His better half, for a two-way man: the side he was drafted for.
          overall: isTwoWay(p) ? Math.max(overallOf(p), armValue(p)) : overallOf(p),
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
        ? growthFor(p) * bankRedshirt(p)
        : growthFor(p) + growthFromCulture(p);
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

    regroup(team, survivors, record.index === mine);

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
      // The share stays on the WINDOW, capped at the flexible fund. Recruiting
      // 1.0 applied it to the fund itself, which taxed the AI twice: the fund
      // is already the cap on what June may spend, and the share was the AI's
      // own restraint within the window. Measured on the climb probe, September
      // 6: two-star programs went from reaching Omaha five times in ten (median
      // year six) to twice (median year twenty-eight), and restoring this one
      // line brought back five and six exactly. The reserve still holds — the
      // share is under the fund at every star — so the freshman class is as
      // protected as the split says, and the country's AI keeps the men it did.
      const allowance = Math.min(
        flexibleOffseasonBudget(stars),
        Math.floor(windowBudget(stars) * AI_KEEP_SHARE),
      );
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

    // A recruit can now ask whether this program actually sends players on.
    // Keep only a five-year rolling proof trail and overwrite the same year on
    // an idempotent offseason revisit.
    const draftedThisYear = report.drafted.filter((r) => r.team === record.index);
    const proRow = {
      year: board.year,
      drafted: draftedThisYear.length,
      early: draftedThisYear.filter((r) => (r.round ?? 99) <= 3).length,
    };
    record.proPipeline = [
      ...(record.proPipeline ?? []).filter((r) => r.year !== board.year),
      proRow,
    ].sort((a, b) => a.year - b.year).slice(-5);
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
function regroup(team: Team, survivors: readonly Player[], keepOrder = false): void {
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
    let i = spot === 'DH'
      // The DH slot takes the best bat standing, whatever he plays; men
      // already adopted as DH count as themselves through homePos.
      ? (pool.length > 0
        ? pool.reduce((b, h, idx, xs) => (overallOf(h) > overallOf(xs[b]!) ? idx : b), 0)
        : -1)
      : pool.findIndex((h) => h.pos === spot);
    if (i < 0) i = pool.length > 0 ? 0 : -1;
    if (i >= 0) {
      const man = pool.splice(i, 1)[0] as Hitter;
      if (spot === 'DH') adoptSpot(man, 'DH');
      lineup.push(man);
    }
  }
  /*
    The coached programme's card is his. The nine above are gathered in spot
    order, which for the other ninety-five is a scratch card `fillRosters`
    re-deals in June anyway — but for him it was quietly a re-deal too: his
    batting order came out of the draft step as C, 1B, 2B and so on, however he
    had written it in May. The men who survive the June keep the order he had
    them in, and the fill-ins take the places the departed left. Caught by
    `tests/doc-sweep.test.ts` on 2026-09-15, which had claimed this property
    for months and only held by the luck of which men happened to graduate.
  */
  if (keepOrder) {
    const was = new Map(team.lineup.map((h, i) => [String(h.id), i]));
    const kept = lineup.filter((h) => was.has(String(h.id)))
      .sort((a, b) => (was.get(String(a.id)) ?? 0) - (was.get(String(b.id)) ?? 0));
    const added = lineup.filter((h) => !was.has(String(h.id)));
    lineup.splice(0, lineup.length, ...kept, ...added);
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
  // Only the coached programme talks a man back, so the card is always his.
  regroup(team, survivors, true);
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
): {
  recruits: number; signed: Prospect[]; walkOns: OffseasonReport['walkOns'];
} {
  const classFor = new Map<number, Player[]>();
  const signed: Prospect[] = [];
  // Every signed kid enrols. A July high-school draft used to take one to
  // three high-ceiling signings a year off the country's classes here — a
  // two-star with a hidden A ceiling went that way and was reported as a
  // rules bug. It went on 2026-09-10, on the rule the roster draft already
  // keeps (`draftEligible`: three years completed or twenty one), so nobody
  // is drafted before he has played a college game.
  for (const prospect of season.recruiting.prospects) {
    if (prospect.signedBy === null) continue;
    const promise = prospect.promiseBy?.[prospect.signedBy];
    if (promise) {
      prospect.player.recruitPromise = {
        kind: promise,
        madeYear: season.recruiting.year,
        ...(promise === 'keepPosition' ? { promisedPos: prospect.player.pos } : {}),
      };
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
      // Read off the schedule, so a fifty-six game world keeps the fifth
      // starter it was built with instead of losing him at its first winter.
      rotationSizeFor(season.config),
      record.index === opts.userTeam,
    );
    for (const p of collected) {
      walkOns.push({
        id: p.id, name: p.name,
        pos: p.type === 'pitcher' ? (p as Pitcher).role : p.pos,
        overall: isTwoWay(p) ? Math.max(overallOf(p), armValue(p)) : overallOf(p),
      });
    }
  }
  /*
    And then every program picks its nine again.

    A roll graduates a quarter of the country and lands a class on top of it,
    so a card written last February is the one thing on the roster that is
    certainly out of date. The coached program is left alone: his card is his,
    and the lineup screen — or his staff, if he has delegated it — writes it
    before the next day is played.
  */
  for (const record of season.teams) {
    if (record.index === opts.userTeam) continue;
    setTheCard(record.team, season.dayIndex);
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
