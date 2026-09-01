// depthChart.ts
// Who plays where, and who plays there when he cannot.
//
// Stage 8. Before this a lineup was nine men in an array and a bench was four
// more, and the question the whole stage exists to answer -- "he is out, now
// what?" -- had no answer at all, because nothing recorded who was next.
//
// ---------------------------------------------------------------------------
// Two questions, not one
// ---------------------------------------------------------------------------
//
// A depth chart is a ranking per position: who is the second baseman, and who
// is the second baseman when he is not. A lineup card is today's nine and the
// order they hit in. They are different facts and the game needs both, which is
// what was asked for -- so the chart owns *who plays where* and `team.lineup`
// keeps owning *what order they hit in*.
//
// ---------------------------------------------------------------------------
// Enforced, and derived when absent
// ---------------------------------------------------------------------------
//
// The chart is what the game uses; it is not advice a bench coach may ignore.
// But it is also never *required* -- a team that has never opened the screen,
// and all ninety-five programs nobody manages, get a chart derived from who is
// actually best at each spot. That keeps the feature free for anybody not using
// it, and it means an empty chart and a sensible one behave identically.
//
// The ranking uses `fieldingAt`, so a man is ranked at each position by what he
// would actually be *there* rather than by what he is at his own. A shortstop
// is the best second baseman on most rosters and this says so without anybody
// having to write it down.

import type { Hitter, Player, PlayerId, Position, Team } from './types.js';
import { overallOf } from './ratings.js';
import { fieldingAt, positionPenalty } from './positions.js';

/** The nine spots a lineup card has to fill, in scorebook order. */
export const SPOTS: readonly Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

/** Ranked ids per position, best first. Sparse: an absent spot is derived. */
export type DepthChart = Partial<Record<Position, PlayerId[]>>;

/** Everybody who could take a spot on the grass today. */
export const squad = (team: Team): Hitter[] => [...team.lineup, ...team.bench];

/**
 * Why a man is not available. Sparse and optional, so a save written before
 * stage 8 has nobody out rather than everybody.
 */
export interface Unavailable {
  /** Sitting out the year entirely, and not burning a season of eligibility. */
  redshirt?: boolean;
  /** Suspended until this day index. Academic today; injury in stage 9. */
  outUntil?: number;
  why?: 'academic' | 'injury';
}

/** Whether he can be picked at all today. */
export function available(p: Player, day: number): boolean {
  const u = p as Player & Unavailable;
  if (u.redshirt) return false;
  if (typeof u.outUntil === 'number' && day < u.outUntil) return false;
  return true;
}

/**
 * The chart a team is actually playing off: what it has written down, with
 * every spot it has not written down filled in by merit.
 *
 * Derived rather than stored for the same reason secondary positions are
 * derived -- ninety-five programs nobody manages should not each be carrying
 * nine arrays of ids through every autosave to say what their roster already
 * says.
 */
export function chartFor(team: Team): Required<Pick<DepthChart, never>> & DepthChart {
  const stored = (team as Team & { depth?: DepthChart }).depth ?? {};
  const out: DepthChart = {};
  const men = squad(team);
  for (const spot of SPOTS) {
    const written = (stored[spot] ?? []).filter((id) => men.some((m) => m.id === id));
    /*
      What he is *there*, not what he is.

      The whole reason the ranking runs through `fieldingAt`: a shortstop is
      usually the best second baseman on the roster, and ranking by plain
      overall would put the actual second baseman ahead of him and then be
      surprised. The DH is ranked on the bat alone, which is what a DH is.
    */
    const byMerit = [...men]
      .sort((a, b) => overallOf(fieldingAt(b, spot)) - overallOf(fieldingAt(a, spot)))
      .map((m) => m.id);

    /*
      The man already standing there leads his own spot, and that is a
      calibration decision rather than a courtesy.

      Ranked on merit alone the chart re-picked ninety-four of ninety-six
      lineups on day one -- correctly, in baseball terms, because a good bench
      middle infielder really is a better left fielder than a weak corner
      outfielder. But the lineup is what the simulation plays, so "correctly"
      there means re-picking the whole league and moving every number in the
      game for a feature that is supposed to be inert until it is used.

      So the incumbent is first, merit ranks everybody behind him, and the
      chart's answer on day one is the card the generator already wrote. It
      only ever *differs* when somebody cannot play, which is the entire job.
      A coach who has written his own order still overrules both.
    */
    const incumbent = team.lineup.find((p) => p.pos === spot)?.id;
    const seed = incumbent !== undefined && !written.includes(incumbent)
      ? [...written, incumbent]
      : written;
    out[spot] = [...seed, ...byMerit.filter((id) => !seed.includes(id))];
  }
  return out;
}

/** One position's order, ready to print. */
export function depthAt(team: Team, spot: Position): Hitter[] {
  const order = chartFor(team)[spot] ?? [];
  const men = squad(team);
  return order
    .map((id) => men.find((m) => m.id === id))
    .filter((m): m is Hitter => m !== undefined);
}

/** What the screen shows against a name: his own spot, or what it costs him. */
export function fitAt(p: Hitter, spot: Position): 'his own' | 'covers' | 'stretch' {
  const cost = positionPenalty(p, spot);
  if (cost === 0) return p.pos === spot ? 'his own' : 'covers';
  return 'stretch';
}

/**
 * Today's nine, off the chart, with anybody unavailable stepped over.
 *
 * The one rule that matters: **a man may only appear once**. The naive version
 * walks the nine spots taking each one's best available man and puts the
 * shortstop at short, at second and at third, because he tops all three lists.
 * So a man taken is a man spent.
 *
 * Spots are filled hardest-first rather than in scorebook order, which is the
 * difference between a sensible card and a silly one: fill first base first and
 * it takes your shortstop, and then nobody can play short.
 */
export function startersFrom(team: Team, day: number): Record<Position, Hitter | null> {
  const chart = chartFor(team);
  const men = squad(team);
  const taken = new Set<PlayerId>();
  const out = {} as Record<Position, Hitter | null>;

  // Hardest first. The DH is last of all: it is a bat in a slot rather than a
  // place on the field, so it should get whoever is left rather than take a
  // glove somebody needed.
  const order: Position[] = ['C', 'SS', '2B', 'CF', '3B', 'RF', 'LF', '1B', 'DH'];

  for (const spot of order) {
    const ranked = chart[spot] ?? [];
    let picked: Hitter | null = null;
    for (const id of ranked) {
      if (taken.has(id)) continue;
      const man = men.find((m) => m.id === id);
      if (!man || !available(man, day)) continue;
      picked = man;
      taken.add(id);
      break;
    }
    out[spot] = picked;
  }
  return out;
}

/**
 * Who came in for whom, so the game can say so rather than quietly changing
 * the card.
 *
 * Returns only the spots where the man the chart leads with is not the man who
 * got it, which is the definition of a promotion worth telling somebody about.
 */
export function promotions(
  team: Team, day: number,
): { spot: Position; out: Hitter; inFor: Hitter }[] {
  const chart = chartFor(team);
  const men = squad(team);
  const starters = startersFrom(team, day);
  const news: { spot: Position; out: Hitter; inFor: Hitter }[] = [];
  for (const spot of SPOTS) {
    const first = (chart[spot] ?? [])[0];
    const man = first ? men.find((m) => m.id === first) : undefined;
    const got = starters[spot];
    if (!man || !got || got.id === man.id) continue;
    if (available(man, day)) continue;   // he was passed over, not unavailable
    news.push({ spot, out: man, inFor: got });
  }
  return news;
}

/** Move a man up or down one rung at a position, and write the chart down. */
export function reorder(team: Team, spot: Position, id: PlayerId, delta: number): void {
  const t = team as Team & { depth?: DepthChart };
  const order = [...(chartFor(team)[spot] ?? [])];
  const at = order.indexOf(id);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= order.length) return;
  const a = order[at];
  const b = order[to];
  if (a === undefined || b === undefined) return;
  order[at] = b;
  order[to] = a;
  t.depth = { ...(t.depth ?? {}), [spot]: order };
}

/**
 * The nine that actually take the field, given who cannot.
 *
 * Deliberately a *post-process* over a lineup somebody else already chose,
 * rather than a lineup builder of its own. `playGame` picks its card through
 * `restedLineup`, which takes random draws; rebuilding the card here would
 * either duplicate those draws or replace them, and both move every number in
 * the game.
 *
 * So this returns the **same array** when everybody in it can play, which is
 * every game in the league except the ones where a program the player is
 * running has somebody in the classroom or sitting out the year. It costs one
 * pass over nine men to find that out, and it is the difference between a
 * feature that is inert until used and one that re-picks the country.
 *
 * Batting order is preserved: a man who comes in bats where the man he came in
 * for was batting, because a substitution is not a reason to rewrite the card.
 */
export function coverFor(
  team: Team, base: readonly Hitter[], day: number,
): readonly Hitter[] {
  if (base.every((p) => available(p, day))) return base;

  const chart = chartFor(team);
  const men = squad(team);
  const used = new Set<PlayerId>(base.filter((p) => available(p, day)).map((p) => p.id));
  const out: Hitter[] = [];

  for (const man of base) {
    if (available(man, day)) { out.push(man); continue; }
    // His own spot's order first, then anybody at all -- a program with four
    // men out still has to field nine, and a worse fit is better than a hole.
    const ranked = [...(chart[man.pos] ?? []), ...men.map((m) => m.id)];
    let cover: Hitter | undefined;
    for (const id of ranked) {
      if (used.has(id)) continue;
      const candidate = men.find((m) => m.id === id);
      if (!candidate || !available(candidate, day)) continue;
      cover = candidate;
      break;
    }
    /*
      He plays hurt, because there is nobody left.

      The first version dropped him and handed back a short card, which the
      engine has never had to consider and which surfaced the moment injuries
      went league-wide: "Dubuque River Riverboats has an empty lineup slot."

      Fielding eight is not a thing that happens in baseball. A program with
      five men down runs somebody out there who should not be out there, and
      that is both the truthful answer and the one the rest of the engine can
      actually play. The cost lands where it should -- on the coach who has run
      out of players.
    */
    if (cover) { used.add(cover.id); out.push(cover); }
    else { used.add(man.id); out.push(man); }
  }
  return out;
}

/**
 * Tonight's nine, with nobody in it who cannot play.
 *
 * Reported: "the auto button doesn't move hurt players out." `autoBattingOrder`
 * is a pure reorder by contract — it never sees a bench or a day, so it cannot
 * bench anybody — and nothing sat above it. This is that layer: every
 * unavailable starter is replaced by the best available man on the bench who
 * can cover his spot, preferring somebody whose own position it is. A man
 * nobody can cover for stays, because fielding eight is not a thing that
 * happens in baseball.
 *
 * Returns copies of the arrays; the caller writes them back.
 */
export function fitTheNine(
  team: Team, day: number,
): { lineup: Hitter[]; bench: Hitter[]; moved: { out: Hitter; in: Hitter }[] } {
  const lineup = [...team.lineup];
  const bench = [...team.bench];
  const moved: { out: Hitter; in: Hitter }[] = [];
  if (lineup.every((p) => available(p, day))) return { lineup, bench, moved };

  for (let i = 0; i < lineup.length; i++) {
    const out = lineup[i];
    if (!out || available(out, day)) continue;
    // His own position first, then anybody fit — the order coverFor uses.
    let pick = bench.findIndex((b) => available(b, day) && b.pos === out.pos);
    if (pick < 0) pick = bench.findIndex((b) => available(b, day));
    if (pick < 0) continue;
    const inMan = bench[pick]!;
    lineup[i] = inMan;
    bench[pick] = out;
    moved.push({ out, in: inMan });
  }
  return { lineup, bench, moved };
}
