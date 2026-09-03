// portal.ts
// Both directions, or it is not a portal.
//
// Stage 10, and the plan for it was one sentence long -- that one. It is the
// whole specification: a portal you can only sign from is a shop, and a portal
// you can only lose to is a tax.
//
// ---------------------------------------------------------------------------
// It is the bill for stage 9
// ---------------------------------------------------------------------------
//
// Nothing here invents a reason for a man to leave. `flightRisk` has been
// computed off morale since stage 9 and read by nobody, waiting for this -- and
// morale is driven by playing time against what he was *told*. So a man in the
// portal is a promise somebody broke, which is the only thing that makes losing
// him feel like a consequence rather than like weather.
//
// The corollary is the part worth defending: a coach who keeps his word mostly
// does not lose people. The portal should be quiet at a well-run program and
// loud at a badly-run one, and if it ever reads as a lottery the fault is in
// morale rather than here.
//
// ---------------------------------------------------------------------------
// One transfer, which is also the real rule
// ---------------------------------------------------------------------------
//
// A man you sign out of the portal cannot enter it again. That was decided
// rather than derived, and it happens to match the NCAA's one-time rule closely
// enough to be worth saying out loud: a second move needs a waiver in life, and
// needs nothing at all in a game that allowed it, which would turn every roster
// into a departure lounge.
//
// Immediately eligible, for the same reason: sitting a year is true of some
// cases and makes the whole feature slow and dull.

import type { Player, PlayerId, Team } from './types.js';
import type { TeamRecord } from './season.js';
import { overallOf } from './ratings.js';

/**
 * A star's base itch to move, per winter. See `entersPortal`: multiplied by
 * the market and summed over however many STAR_LINE men the developed league
 * carries, it is what makes the answer come out at about one star in the
 * portal per five or six seasons.
 */
const STAR_WANDER = 0.012;
import { flightRisk, moodOf, expectationOf, squadRanks, UNHAPPY } from './morale.js';

/** What the portal writes on a man. Sparse, so an older save has none. */
export interface Portable {
  /** He has already moved once. The rule is one. */
  transferred?: boolean;
  /** He is in the portal this offseason, and can be talked to. */
  inPortal?: boolean;
}

/** A man in the portal, with where he came from attached. */
export interface PortalMan {
  player: Player;
  /** The program he is leaving. */
  from: number;
  fromName: string;
  /** What it costs to land him, in recruiting points. */
  cost: number;
  /** Why he went, for the card. */
  reason: string;
}

/**
 * What a portal man costs, in the same currency as a recruit.
 *
 * Deliberately dear. He is proven and he is older, so the alternative -- a
 * freshman who might be more in three years -- has to stay a real choice
 * rather than an obviously worse one. A good portal bat should cost most of a
 * week.
 */
export function portalCost(p: Player): number {
  const ovr = overallOf(p);
  /*
    Priced against the class -- the stage 16 balance pass.

    The complaint was value, in as many words: "the portal reads as a better
    deal than the recruiting board it shares a budget with." It did. The most
    a courtship can put on one recruit is MAX_PER_RECRUIT a week for the
    window -- thirty-six points for a lottery ticket -- while the old line
    priced a proven ninety at seventy-one, well under half a window. So the
    linear rule keeps pricing the ordinary shelf, and a premium squares away
    from seventy-five: a proven eighty-five now costs most of a week's
    budget more than the best recruit can absorb, and a true star prices at
    a whole window -- roughly the class he would be replacing.
  */
  const premium = Math.max(0, ovr - 75) ** 2 * 0.22;
  return Math.max(8, Math.round((ovr - 28) * 1.15 + premium));
}

/**
 * The line above which a man is the wire's business. One constant shared
 * with the inbox rumour so the mail and the model cannot drift apart --
 * "align rumour threshold" was written into the same door decision as the
 * rarity knob below.
 */
export const STAR_LINE = 85;

/**
 * How the winter's market runs, derived from the year alone.
 *
 * "Noisier outcomes": the same league should hand you a rich window one
 * winter and a bare one the next, because a shelf you can plan around is a
 * shop. Multiplies every man's chance, so it moves the whole pool between
 * roughly sixty and a hundred and forty percent of its base -- and it is a
 * hash, not a draw, for the same reason everything since stage 7 is.
 */
export function portalMarket(year: number, seed: number): number {
  let h = ((year * 2246822519) ^ (seed * 3266489917)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2654435761) >>> 0;
  return 0.6 + 0.8 * (((h >>> 8) % 1000) / 1000);
}

/**
 * Whether a man goes into the portal.
 *
 * Two doors, and both of them are things the coach did. The first is mood,
 * which stage 9 drives off the promise. The second is being buried: a man well
 * below what he was told he would be, whatever his mood says, because a player
 * who is not playing does not need to be miserable to look around.
 *
 * Derived rather than drawn, like everything since stage 7 -- so a reload
 * cannot re-roll who left, and reading the screen costs no draw.
 */
export function entersPortal(
  p: Player, opts: { squadRank: number; starts: number; games: number; year: number; seed: number },
): boolean {
  const port = p as Player & Portable;
  // One move a career, and a senior is graduating rather than transferring.
  if (port.transferred) return false;
  if (p.classYear === 'SR') return false;

  const risk = flightRisk(p);
  const expected = expectationOf(p, opts.squadRank);
  const got = opts.games > 0 ? opts.starts / opts.games : 0;
  const buried = Math.max(0, expected - got);
  const market = portalMarket(opts.year, opts.seed);

  /*
    Two contributions, and neither on its own should empty a roster.

    A merely restless man stays; a miserable one usually goes; a man who is
    fine but has not played all year sometimes goes anyway, which is the case
    every college coach actually loses people to.

    A star walks through a different door. Above STAR_LINE the buried channel
    is replaced, not scaled, because what it measured up there was never
    true: an ace read squadRank twenty -- the promise ranks hitters -- so
    "he was told he would play" was putting the best arm in the country in
    the portal as bookkeeping, which is exactly the ninety-seven the report
    complained about. What remains for a star is mood, which stays at full
    strength (a genuinely miserable star leaves, and stage 9's promises keep
    their teeth), and the wander -- the itch that makes a star's winter the
    wire's story roughly once every five or six years league-wide. The knob
    is priced against the developed league's census in the carousel probe,
    not the seeded one: a fresh league holds nobody above eighty-two.
  */
  const chance = overallOf(p) >= STAR_LINE
    ? Math.min(0.85, Math.max(risk * 0.55, STAR_WANDER) * market)
    : Math.min(0.85, (risk * 0.55 + buried * 0.4) * market);
  if (chance <= 0) return false;

  let h = ((opts.year * 2654435761) ^ (opts.seed * 40503)) >>> 0;
  const s = String(p.id);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return (h % 10000) / 10000 < chance;
}

/** Why he went, in his own terms rather than in the model's. */
export function reasonFor(
  p: Player, opts: { squadRank: number; starts: number; games: number },
): string {
  const expected = expectationOf(p, opts.squadRank);
  const got = opts.games > 0 ? opts.starts / opts.games : 0;
  if (expected - got > 0.25) return 'He was told he would play.';
  if (moodOf(p) < UNHAPPY) return 'He was not happy here.';
  return 'He wants a fresh start.';
}

/**
 * Everybody leaving, across the whole country.
 *
 * League-wide because the plan said both directions and because a portal only
 * the player uses is a shop. It also means the pool a coach signs from is other
 * programs' broken promises, which is the right shape: your gain is somebody
 * else's mismanagement, and next year it is the other way round.
 */
export function openPortal(
  teams: readonly TeamRecord[], opts: { year: number; seed: number; games: number },
): PortalMan[] {
  const out: PortalMan[] = [];
  for (const rec of teams) {
    const ranks = squadRanks(rec.team);
    const men: Player[] = [
      ...rec.team.lineup, ...rec.team.bench, ...rec.team.rotation, ...rec.team.bullpen,
    ];
    for (const p of men) {
      const starts = (p as Player & { starts?: number }).starts ?? 0;
      const squadRank = ranks.get(p.id) ?? 20;
      const at = { squadRank, starts, games: opts.games };
      if (!entersPortal(p, { ...at, year: opts.year, seed: opts.seed })) continue;
      (p as Player & Portable).inPortal = true;
      out.push({
        player: p,
        from: rec.index,
        fromName: rec.def.school,
        cost: portalCost(p),
        reason: reasonFor(p, at),
      });
    }
  }
  return out;
}

/**
 * Talking a man out of it.
 *
 * The same shape as the draft's case, deliberately: the screen pattern works,
 * and this is the moment morale stops being a report and becomes a decision.
 * What it costs comes out of the same pool everything else does.
 *
 * He is harder to keep the unhappier he is, which is the point -- a man you
 * ignored all season is not talked round in an afternoon.
 */
export function makeTheCase(
  man: PortalMan, offer: number, budgetLeft: number,
): { spent: number; stayed: boolean } {
  const spend = Math.max(0, Math.min(Math.round(offer), Math.floor(budgetLeft)));
  const needed = Math.round(man.cost * (1 + flightRisk(man.player)));
  const stayed = spend >= needed;
  if (stayed) {
    const p = man.player as Player & Portable;
    delete p.inPortal;
  }
  return { spent: spend, stayed };
}

/** He is gone. Take him off the roster he is leaving. */
export function releaseFrom(team: Team, id: PlayerId): void {
  team.lineup = team.lineup.filter((p) => p.id !== id);
  team.bench = team.bench.filter((p) => p.id !== id);
  team.rotation = team.rotation.filter((p) => p.id !== id);
  team.bullpen = team.bullpen.filter((p) => p.id !== id);
}

/**
 * He signs with you.
 *
 * The one-move rule is stamped here rather than checked here: a man who has
 * arrived through the portal carries `transferred` for the rest of his career,
 * and `entersPortal` refuses him ever after.
 */
export function signFromPortal(team: Team, man: PortalMan): void {
  const p = man.player as Player & Portable;
  delete p.inPortal;
  p.transferred = true;
  if (p.type === 'pitcher') {
    const arm = p as typeof p & { role: 'SP' | 'RP' };
    if (arm.role === 'SP') team.rotation.push(arm); else team.bullpen.push(arm);
  } else {
    team.bench.push(p as never);
  }
}

/**
 * What a staff does with the portal for a coach who asked not to be asked.
 *
 * Signs the best men it can afford who improve the roster, cheapest first so
 * the budget goes furthest. Deliberately not clever: the point of casual is
 * that the decision is made competently and out of sight, not optimally.
 */
export function staffWorksPortal(
  team: Team, pool: readonly PortalMan[], budget: number,
): PortalMan[] {
  const weakest = [...team.lineup, ...team.bench]
    .sort((a, b) => overallOf(a) - overallOf(b))[0];
  const floor = weakest ? overallOf(weakest) : 0;
  const took: PortalMan[] = [];
  let left = budget;
  for (const man of [...pool].sort((a, b) => a.cost - b.cost)) {
    if (man.cost > left) continue;
    if (overallOf(man.player) <= floor) continue;
    signFromPortal(team, man);
    took.push(man);
    left -= man.cost;
    if (took.length >= 2) break;
  }
  return took;
}
