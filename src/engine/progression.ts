// progression.ts
// The year turns over. Seniors graduate, the draft takes the best juniors,
// everyone who stays gets better or worse, and a freshman class arrives.
//
// This runs for all 64 programs, not just yours. Roughly a quarter of the
// world's four thousand players leave every June and are replaced, which is what
// stops a dynasty from being the same names forever — and it is the mechanism
// behind the roadmap's central promise: you never keep your best players.

import { makeHitter, makePitcher } from './players.js';
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



export type DepartureReason = 'graduated' | 'drafted';

export interface Departure {
  id: PlayerId;
  name: string;
  team: number;
  teamAbbr: string;
  classYear: ClassYear;
  overall: number;
  reason: DepartureReason;
  /**
   * Which round he went in, for the men who were drafted.
   *
   * The draft is a national event and a player wants to know where he stood in
   * it — "drafted" is a fact, "went in the first round" is the story. Assigned
   * across the whole league at once, so the rounds mean the same thing for every
   * program.
   */
  round?: number;
}

export interface OffseasonReport {
  graduated: Departure[];
  drafted: Departure[];
  recruits: number;
  /** The user's signed class, so the screen can show who was actually landed. */
  signed: Prospect[];
  /** Sum of overall gained across everyone who stayed. */
  developmentNet: number;
  improved: number;
  declined: number;
}

/**
 * Draft odds for a junior.
 *
 * College players are draft eligible after their junior year, and this is the
 * roadmap's core tension: a star is on a three year clock whether you like it or
 * not. A 70 overall junior is gone almost every time; a 45 almost never hears his
 * name. Seniors leave regardless, so the draft only really *costs* you juniors.
 */
export function draftChance(overall: number): number {
  return clamp((overall - 46) / 34, 0, 0.88);
}

/** Does this player leave the program this offseason? */
function departure(p: Player, rng: Rng): DepartureReason | null {
  const overall = overallOf(p);
  if (p.classYear === 'SR') {
    // Seniors are gone either way. Whether they were drafted is flavour, but it
    // is the flavour that tells you how good your program's exits were.
    return rng() < draftChance(overall) * 0.6 ? 'drafted' : 'graduated';
  }
  if (p.classYear === 'JR') {
    return rng() < draftChance(overall) ? 'drafted' : null;
  }
  return null;
}

/**
 * A year of development, applied after the class year advances.
 *
 * Players move toward their potential, fastest early: the jump from freshman to
 * sophomore is the biggest a college player ever makes. The noise term is what
 * makes recruiting a gamble rather than arithmetic — a 60 potential freshman can
 * stall, and a 48 can outgrow his projection.
 */
function develop(p: Player, rng: Rng): number {
  const before = overallOf(p);
  const gap = p.potential - before;
  const rate = p.classYear === 'SO' ? 0.45 : p.classYear === 'JR' ? 0.35 : 0.25;
  const delta = gap * rate + gauss(rng) * 2.2;

  const bump = (v: number): number => clamp(v + delta + gauss(rng) * 1.2, 15, 99);

  if (p.type === 'hitter') {
    p.contact = bump(p.contact);
    p.power = bump(p.power);
    p.eye = bump(p.eye);
    p.speed = bump(p.speed);
    p.range = bump(p.range);
    p.hands = bump(p.hands);
    p.arm = bump(p.arm);
  } else {
    p.stuff = bump(p.stuff);
    p.movement = bump(p.movement);
    p.control = bump(p.control);
    p.stamina = bump(p.stamina);
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
function refill(team: Team, survivors: Player[], rng: Rng, signed: Player[] = []): number {
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
  /** The user's own reputation, which drags recruits above the program's weight. */
  coachPrestige?: number;
}

export function advanceOffseason(
  season: SeasonState, rng: Rng, opts: OffseasonOpts = {},
): OffseasonReport {
  const report: OffseasonReport = {
    graduated: [], drafted: [], recruits: 0, signed: [],
    developmentNet: 0, improved: 0, declined: 0,
  };

  // Recruiting already happened, in its own window before the year turned over.
  // All that is left is to put the signed class on the roster.
  const classFor = new Map<number, Player[]>();
  for (const prospect of season.recruiting.prospects) {
    if (prospect.signedBy === null) continue;
    const list = classFor.get(prospect.signedBy) ?? [];
    list.push(prospect.player);
    classFor.set(prospect.signedBy, list);
    if (prospect.signedBy === opts.userTeam) report.signed.push(prospect);
  }

  for (const record of season.teams) {
    const team = record.team;
    const roster: Player[] = [
      ...team.lineup, ...team.bench, ...team.rotation, ...team.bullpen,
    ];

    const survivors: Player[] = [];
    for (const p of roster) {
      const reason = departure(p, rng);
      if (reason) {
        const row: Departure = {
          id: p.id,
          name: p.name,
          team: record.index,
          teamAbbr: record.def.abbr,
          classYear: p.classYear,
          overall: overallOf(p),
          reason,
        };
        if (reason === 'drafted') report.drafted.push(row);
        else report.graduated.push(row);
        continue;
      }

      const next = NEXT_CLASS[p.classYear];
      if (next === null) continue;        // unreachable: seniors always depart
      p.classYear = next;
      const gained = develop(p, rng);
      report.developmentNet += gained;
      if (gained > 0) report.improved += 1; else report.declined += 1;
      survivors.push(p);
    }

    report.recruits += refill(team, survivors, rng, classFor.get(record.index) ?? []);
  }

  // Order the draft nationally once every program has been through.
  //
  // Rounds are assigned across the league rather than per team, because a round
  // is only meaningful as a national ordering — thirty two names deep, then the
  // next thirty two, exactly as a real draft board reads.
  report.drafted.sort((a, b) => b.overall - a.overall);
  report.drafted.forEach((d, i) => { d.round = Math.floor(i / 32) + 1; });

  return report;
}
