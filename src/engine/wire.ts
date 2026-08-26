// wire.ts
// The league talking about itself.
//
// Ninety six programs play every week and you see one of them. Without a feed,
// the other ninety five are a standings table that changes overnight for reasons
// you never witness — which is the difference between a league and a spreadsheet.
//
// Everything here is derived from what actually happened. Nothing is invented:
// if the wire says a team has won nine straight, it has won nine straight.

import { standings, rpiOrder, type SeasonState } from './season.js';
import type { Hitter } from './types.js';

export type WireKind = 'upset' | 'streak' | 'rout' | 'ranking' | 'milestone' | 'race';

export interface WireItem {
  kind: WireKind;
  /** Headline. Short enough to read at a glance in a list. */
  text: string;
  /** Team this concerns, so the user's own program can be highlighted. */
  team: number;
  /**
   * The other team in the story, where there is one.
   *
   * Needed for de-duplication rather than display: three different clubs beating
   * the same ranked team is three separate headlines about three separate
   * winners, and a feed that only checks the winner prints all of them in a row.
   */
  against?: number;
  /** Higher sorts first. */
  weight: number;
}

/** How far apart two teams have to be before a win counts as an upset. */
const UPSET_GAP = 12;

/**
 * Build the feed.
 *
 * Ordered by how much a reader would care rather than by when it happened: a
 * top ten upset outranks the fourth blowout of the week. The feed is rebuilt
 * from season state each time rather than accumulated, so it cannot drift out of
 * step with the standings it describes.
 */
export function wire(season: SeasonState, limit = 24): WireItem[] {
  const items: WireItem[] = [];
  const rpi = rpiOrder(season);
  const top25 = new Set(rpi.slice(0, 25).map((r) => r.team.index));
  const rpiRank = new Map<number, number>();
  rpi.forEach((r, i) => rpiRank.set(r.team.index, i + 1));

  const name = (i: number): string => season.teams[i]?.def.school ?? '?';
  const abbr = (i: number): string => season.teams[i]?.def.abbr ?? '?';

  // Recent games first — the wire is about now, not about February.
  const recent = season.results.slice(-140);

  for (const g of recent) {
    const home = season.teams[g.home];
    const away = season.teams[g.away];
    if (!home || !away) continue;

    const homeWon = g.homeRuns > g.awayRuns;
    const winner = homeWon ? g.home : g.away;
    const loser = homeWon ? g.away : g.home;
    const margin = Math.abs(g.homeRuns - g.awayRuns);

    // An upset is measured on reputation, which is what makes it read as one.
    const gap = (season.teams[loser]?.prestige ?? 50) - (season.teams[winner]?.prestige ?? 50);
    if (gap >= UPSET_GAP) {
      const ranked = top25.has(loser);
      items.push({
        kind: 'upset',
        team: winner,
        against: loser,
        weight: 60 + gap + (ranked ? 25 : 0),
        text: ranked
          ? `${abbr(winner)} stuns #${rpiRank.get(loser)} ${name(loser)}, ${Math.max(g.homeRuns, g.awayRuns)}-${Math.min(g.homeRuns, g.awayRuns)}`
          : `${name(winner)} takes down ${name(loser)}, ${Math.max(g.homeRuns, g.awayRuns)}-${Math.min(g.homeRuns, g.awayRuns)}`,
      });
    } else if (margin >= 11) {
      items.push({
        kind: 'rout',
        team: winner,
        against: loser,
        weight: 20 + margin,
        // Both sides by name. The loser used to be an abbreviation in the same
        // sentence that spelled the winner out — "Atchafalaya State runs UTC
        // out of the yard" reads like two different papers filed one line.
        text: `${name(winner)} runs ${name(loser)} out of the yard, ${Math.max(g.homeRuns, g.awayRuns)}-${Math.min(g.homeRuns, g.awayRuns)}`,
      });
    }
  }

  // Streaks, hot and cold.
  for (const t of season.teams) {
    if (t.streak >= 7) {
      items.push({
        kind: 'streak', team: t.index, weight: 45 + t.streak * 2,
        text: `${name(t.index)} has won ${t.streak} straight`,
      });
    } else if (t.streak <= -7) {
      items.push({
        kind: 'streak', team: t.index, weight: 30 - t.streak,
        text: `${name(t.index)} has dropped ${-t.streak} in a row`,
      });
    }
  }

  // The national picture, once there is enough season to have one.
  if (rpi.length > 0 && season.results.length > 80) {
    const one = rpi[0];
    if (one) {
      items.push({
        kind: 'ranking', team: one.team.index, weight: 70,
        text: `${name(one.team.index)} holds the top RPI at ${one.team.w}-${one.team.l}`,
      });
    }
  }

  // Conference races that are actually close.
  const seen = new Set<string>();
  for (const t of season.teams) {
    if (seen.has(t.conference)) continue;
    seen.add(t.conference);
    const conf = standings(season, t.conference);
    const first = conf[0], second = conf[1];
    if (!first || !second) continue;
    const lead = (first.cw - first.cl) - (second.cw - second.cl);
    if (lead <= 1 && first.cw + first.cl >= 6) {
      items.push({
        kind: 'race', team: first.index, weight: 40,
        text: `${t.conference} is a coin flip: ${abbr(first.index)} and ${abbr(second.index)} are level`,
      });
    }
  }

  // A bat nobody can get out.
  const hot = bestBat(season);
  if (hot) items.push(hot);

  items.sort((a, b) => b.weight - a.weight);

  // Trimming the feed is most of what makes it readable.
  //
  // Three constraints, each of which was a visible defect first. A team appears
  // once, whether as the subject *or* the opponent — without the second half,
  // three different clubs beating the same ranked team printed as three
  // consecutive headlines about that team losing. And no single kind may take
  // more than a third of the feed, because upsets carry the highest weights and
  // a straight sort produced eleven of them before anything else appeared.
  const seenTeams = new Set<number>();
  const perKind = new Map<WireKind, number>();
  const kindCap = Math.max(3, Math.ceil(limit / 3));
  const out: WireItem[] = [];

  for (const item of items) {
    if (seenTeams.has(item.team)) continue;
    if (item.against !== undefined && seenTeams.has(item.against)) continue;

    const used = perKind.get(item.kind) ?? 0;
    if (used >= kindCap) continue;

    seenTeams.add(item.team);
    if (item.against !== undefined) seenTeams.add(item.against);
    perKind.set(item.kind, used + 1);
    out.push(item);
    if (out.length >= limit) break;
  }

  return interleave(out);
}

/**
 * Deal the feed out by kind, round robin, best first within each.
 *
 * A straight weight sort is correct and reads terribly: upsets carry the biggest
 * numbers, so the first eight items were all upsets and everything else appeared
 * below the fold. Capping each kind fixed the proportions without fixing the
 * order — the cap's worth of upsets simply ran first instead.
 *
 * Rotating between kinds keeps the strongest story at the top while making the
 * next three lines about three different things, which is what a wire looks like.
 */
function interleave(items: readonly WireItem[]): WireItem[] {
  const buckets = new Map<WireKind, WireItem[]>();
  for (const item of items) {
    const list = buckets.get(item.kind) ?? [];
    list.push(item);
    buckets.set(item.kind, list);
  }

  // Kinds ordered by their strongest item, so the lead story still leads.
  const order = [...buckets.entries()]
    .sort((a, b) => (b[1][0]?.weight ?? 0) - (a[1][0]?.weight ?? 0))
    .map(([kind]) => kind);

  const out: WireItem[] = [];
  let placed = true;
  while (placed) {
    placed = false;
    for (const kind of order) {
      const next = buckets.get(kind)?.shift();
      if (next) { out.push(next); placed = true; }
    }
  }
  return out;
}

/**
 * The best qualified average in the country, if anyone has enough at-bats.
 *
 * Walks the rosters rather than the stat map, because season lines are keyed by
 * player id and carry no back reference to the player — so the map alone can
 * tell you somebody is hitting .400 but not who he is or where he plays.
 */
function bestBat(season: SeasonState): WireItem | null {
  let best: { avg: number; name: string; team: number } | null = null;

  for (const record of season.teams) {
    const bats: Hitter[] = [...record.team.lineup, ...record.team.bench];
    for (const p of bats) {
      const line = season.batting.get(p.id);
      if (!line || line.ab < 40) continue;
      const avg = line.h / line.ab;
      if (!best || avg > best.avg) best = { avg, name: p.name, team: record.index };
    }
  }

  if (!best) return null;
  return {
    kind: 'milestone', team: best.team, weight: 50,
    text: `${best.name} is hitting ${best.avg.toFixed(3).replace(/^0/, '')}`
      + ` for ${season.teams[best.team]?.def.abbr ?? '?'}`,
  };
}
