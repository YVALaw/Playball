// wire.ts
// The league talking about itself.
//
// Ninety six programs play every week and you see one of them. Without a feed,
// the other ninety five are a standings table that changes overnight for reasons
// you never witness — which is the difference between a league and a spreadsheet.
//
// Everything here is derived from what actually happened. Nothing is invented:
// if the wire says a team has won nine straight, it has won nine straight. That
// rule extends to the newspaper dressing — a detail line only prints numbers the
// season actually holds, and a headline template is chosen by hashing facts of
// the story rather than by rolling dice, so reading the paper can never change
// the season it reports on.

import {
  standings, rpiOrder, era, inningsPitched, type SeasonState,
} from './season.js';
import type { Arm, Hitter, Pitcher } from './types.js';

export type WireKind =
  | 'upset' | 'streak' | 'rout' | 'ranking' | 'milestone' | 'race'
  | 'close' | 'sweep' | 'gem' | 'power' | 'rivalry'
  | 'chase' | 'realign' | 'moves';

export interface WireItem {
  kind: WireKind;
  /** Headline. Short enough to read at a glance in a list. */
  text: string;
  /**
   * One further sentence for the paper's body — the deck under a lead story,
   * the run-in text of a brief. Built only from numbers the season holds.
   */
  detail?: string;
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
 * A stable scramble for picking one phrasing among several.
 *
 * Hashed from facts of the story — the day, the teams — never drawn from the
 * season's generator, because the play event rule applies to prose too: asking
 * for the paper must not consume a die. The same game always files under the
 * same headline, and neighbouring games file under different ones, which is all
 * the variety a wire needs.
 */
/** "an 11-run margin", "a 13-run margin" — numbers have articles too. */
function an(n: number): string {
  return /^(8|11|18)/.test(String(n)) ? 'an' : 'a';
}

function vary(seed: number, count: number): number {
  let h = (seed | 0) + 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return Math.abs(h ^ (h >>> 15)) % count;
}

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
  const recordOf = (i: number): string => {
    const t = season.teams[i];
    return t ? `${t.w}-${t.l}` : '?';
  };

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
    const hi = Math.max(g.homeRuns, g.awayRuns);
    const lo = Math.min(g.homeRuns, g.awayRuns);
    const v = vary(g.day * 97 + winner * 13 + loser, 3);

    /*
      The rivalry always makes the paper — stage 12. `rival` sat in the school
      data doing almost nothing; a rivalry game that ran as an ordinary result
      was the wire not knowing the one thing every reader in both towns knows.
      Weighted above everything but a ranked upset, whoever won.
    */
    const wDef = season.teams[winner]?.def;
    const lDef = season.teams[loser]?.def;
    if (wDef && lDef && wDef.rival === lDef.abbr) {
      items.push({
        kind: 'rivalry',
        team: winner,
        against: loser,
        weight: 78 + margin,
        text: [
          `The rivalry goes to ${name(winner)}, ${hi}-${lo}`,
          `${name(winner)} own the argument for a year: ${hi}-${lo} over ${abbr(loser)}`,
          `Bragging rights: ${name(winner)} take down ${name(loser)}, ${hi}-${lo}`,
        ][v]!,
        detail: `${wDef.school} and ${lDef.school} have played this game for `
          + 'longer than anybody can defend.',
      });
    }

    // An upset is measured on reputation, which is what makes it read as one.
    const gap = (season.teams[loser]?.prestige ?? 50) - (season.teams[winner]?.prestige ?? 50);
    if (gap >= UPSET_GAP) {
      const ranked = top25.has(loser);
      const line = ranked
        ? [
          `${abbr(winner)} stuns #${rpiRank.get(loser)} ${name(loser)}, ${hi}-${lo}`,
          `#${rpiRank.get(loser)} ${name(loser)} go down at the hands of ${abbr(winner)}, ${hi}-${lo}`,
          `${name(winner)} topple #${rpiRank.get(loser)} ${abbr(loser)}, ${hi}-${lo}`,
        ][v]!
        : [
          `${name(winner)} takes down ${name(loser)}, ${hi}-${lo}`,
          `${name(winner)} pull one off against ${name(loser)}, ${hi}-${lo}`,
          `${name(loser)} caught cold by ${name(winner)}, ${hi}-${lo}`,
        ][v]!;
      items.push({
        kind: 'upset',
        team: winner,
        against: loser,
        weight: 60 + gap + (ranked ? 25 : 0),
        text: line,
        detail: `${name(loser)} at ${recordOf(loser)} were the better side on `
          + 'paper. That is why they play the games.',
      });
    } else if (margin >= 11) {
      items.push({
        kind: 'rout',
        team: winner,
        against: loser,
        weight: 20 + margin,
        // Both sides by name — half a headline in abbreviations reads like two
        // different papers filed one line.
        text: [
          `${name(winner)} runs ${name(loser)} out of the yard, ${hi}-${lo}`,
          `${name(winner)} bury ${name(loser)} under ${hi} runs`,
          `No contest: ${name(winner)} ${hi}, ${name(loser)} ${lo}`,
        ][v]!,
        detail: 'Decided early, and the bullpen got the night off.',
      });
    } else if (margin === 1 && g.innings > 9) {
      // The long ones. A one-run game that needed extra innings is the story
      // a reader tells somebody else, whoever it happened to.
      items.push({
        kind: 'close',
        team: winner,
        against: loser,
        weight: 26 + (g.innings - 9) * 4,
        text: [
          `${name(winner)} outlast ${name(loser)} in ${g.innings}, ${hi}-${lo}`,
          `${g.innings} innings, one run: ${abbr(winner)} edge ${abbr(loser)} ${hi}-${lo}`,
          `${name(winner)} win the staring contest, ${hi}-${lo} in ${g.innings}`,
        ][v]!,
        detail: 'Neither side led by more than a run until the handshake line.',
      });
    }
  }

  // Weekend sweeps. Three games against the same opponent inside a week, all
  // won by the same side, is a fact the standings flatten — a series result is
  // the unit college baseball actually thinks in.
  const swept = new Set<string>();
  for (const g of recent) {
    if (!g.conference) continue;
    const key = [Math.min(g.home, g.away), Math.max(g.home, g.away)].join('-');
    if (swept.has(key)) continue;
    const series = recent.filter((x) =>
      Math.min(x.home, x.away) === Math.min(g.home, g.away)
      && Math.max(x.home, x.away) === Math.max(g.home, g.away)
      && Math.abs(x.day - g.day) <= 4);
    if (series.length < 3) continue;
    const winners = series.map((x) => (x.homeRuns > x.awayRuns ? x.home : x.away));
    const first = winners[0]!;
    if (!winners.every((w) => w === first)) continue;
    swept.add(key);
    const other = first === g.home ? g.away : g.home;
    const v = vary(g.day * 31 + first, 3);
    items.push({
      kind: 'sweep',
      team: first,
      against: other,
      weight: 42,
      text: [
        `${name(first)} sweep ${name(other)}`,
        `A clean weekend: ${name(first)} take all three from ${abbr(other)}`,
        `${name(other)} leave the ${name(first)} series empty-handed`,
      ][v]!,
      detail: 'Three wins in one weekend is how a résumé gets written.',
    });
  }

  // Streaks, hot and cold.
  for (const t of season.teams) {
    const v = vary(t.index * 7 + t.streak, 3);
    if (t.streak >= 7) {
      items.push({
        kind: 'streak', team: t.index, weight: 45 + t.streak * 2,
        text: [
          `${name(t.index)} has won ${t.streak} straight`,
          `Nobody has beaten ${name(t.index)} in ${t.streak} games`,
          `${name(t.index)} keep rolling: ${t.streak} in a row`,
        ][v]!,
        detail: `The run has carried them to ${recordOf(t.index)}`
          + `${rpiRank.get(t.index) ? `, and #${rpiRank.get(t.index)} in the country` : ''}.`,
      });
    } else if (t.streak <= -7) {
      items.push({
        kind: 'streak', team: t.index, weight: 30 - t.streak,
        text: [
          `${name(t.index)} has dropped ${-t.streak} in a row`,
          `The bottom keeps falling: ${-t.streak} straight losses for ${name(t.index)}`,
          `${name(t.index)} cannot find a win — ${-t.streak} and counting`,
        ][v]!,
        detail: `A ${recordOf(t.index)} season, and the schedule is not getting kinder.`,
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
        detail: `The country's best résumé by the numbers the committee reads.`,
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
        detail: 'Every series between them counts double from here.',
      });
    }
  }

  // The men behind the numbers: the bats and arms the whole country is talking
  // about, walked off the season books rather than invented.
  const hot = bestBat(season);
  if (hot) items.push(hot);
  items.push(...leagueLeaders(season));
  const gem = latestGem(season);
  if (gem) items.push(gem);

  // The winter's headlines open the spring, and a run at the book is reported
  // before it happens rather than after — stage 14, both.
  items.push(...offseasonNews(season));
  const chase = recordChase(season);
  if (chase) items.push(chase);

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
 * What the winter did to the map and to your staff, while the feed is young.
 *
 * Both facts are stamped onto the season by the year roll (see SeasonState);
 * the paper leads with them in February and lets them fade as actual baseball
 * accumulates, the way realignment stops being news by the third weekend of
 * games. Gone entirely by mid-season.
 */
function offseasonNews(season: SeasonState): WireItem[] {
  const items: WireItem[] = [];
  const played = season.results.length;
  // Ninety six teams play ~45 games a day, so mid-season is ~1100 results.
  if (played > 1100) return items;
  const fade = Math.floor(played / 24);

  const r = season.newsRealign;
  if (r) {
    const team = season.teams.findIndex((t) => t.def.abbr === r.abbr);
    items.push({
      kind: 'realign', team: Math.max(0, team), weight: 85 - fade,
      text: `${r.school} are a ${r.to} program now`,
      detail: `${r.downSchool} go the other way. Both leagues read differently `
        + 'for it.',
    });
  }

  const st = season.newsStaff;
  if (st) {
    const team = season.teams.findIndex((t) => t.def.school === st.school);
    items.push({
      kind: 'moves', team: Math.max(0, team), weight: 66 - fade,
      text: `${st.school} lose their ${st.seat.toLowerCase()} to a head job`,
      detail: `${st.name} ran his room too well to keep. The seat behind the `
        + 'seat is open.',
    });
  }
  return items;
}

/**
 * A run at the book, reported before it happens — stage 14.
 *
 * The record cards post the night a mark falls, which is the paper arriving
 * after the parade. The month before is the story: a man on pace to pass a
 * season record is news in every town he plays in. Read from the same
 * all-time book the record screen shows, so the number quoted here is the
 * number that will actually have to fall — and only one chase runs at a time,
 * the closest, because two "chasing history" briefs in one feed cheapen both.
 */
function recordChase(season: SeasonState): WireItem | null {
  const book = season.records;
  if (!book) return null;

  let best: { ratio: number; team: number; text: string; detail: string } | null = null;
  const consider = (
    mark: { value: number; holder: string; year: number } | undefined,
    value: number, gp: number, who: string, team: number, word: string,
  ): void => {
    // Enough season to trust the pace, not so much that it is over, and a
    // pace that actually clears the bar. Being at 55% of the mark filters the
    // hot April that a long summer always cools off.
    if (!mark || gp < 15 || gp >= 45 || value >= mark.value) return;
    const pace = (value / gp) * 45;
    if (pace <= mark.value || value < mark.value * 0.55) return;
    const ratio = value / mark.value;
    if (best && ratio <= best.ratio) return;
    best = {
      ratio, team,
      text: `${who} is chasing the book: ${value} ${word}, ${45 - gp} games left`,
      detail: `The book says ${mark.value} — ${mark.holder}, ${mark.year}. `
        + `His pace says ${Math.round(pace)}.`,
    };
  };

  for (const record of season.teams) {
    const gp = record.w + record.l;
    const bats: Hitter[] = [...record.team.lineup, ...record.team.bench];
    for (const p of bats) {
      const line = season.batting.get(p.id);
      if (!line) continue;
      consider(book.seasonHR, line.hr, gp, p.name, record.index, 'home runs');
      consider(book.seasonSB, line.sb, gp, p.name, record.index, 'stolen bases');
    }
    const arms: Arm[] = [...record.team.rotation, ...record.team.bullpen];
    for (const p of arms) {
      const line = season.pitching.get(p.id);
      if (!line) continue;
      consider(book.seasonK, line.k, gp, p.name, record.index, 'strikeouts');
    }
  }

  if (!best) return null;
  const b: { ratio: number; team: number; text: string; detail: string } = best;
  return { kind: 'chase', team: b.team, weight: 72, text: b.text, detail: b.detail };
}

/**
 * The best qualified average in the country, if anyone has enough at-bats.
 *
 * Walks the rosters rather than the stat map, because season lines are keyed by
 * player id and carry no back reference to the player — so the map alone can
 * tell you somebody is hitting .400 but not who he is or where he plays.
 */
function bestBat(season: SeasonState): WireItem | null {
  let best: { avg: number; name: string; team: number; hr: number; sb: number } | null = null;

  for (const record of season.teams) {
    const bats: Hitter[] = [...record.team.lineup, ...record.team.bench];
    for (const p of bats) {
      const line = season.batting.get(p.id);
      if (!line || line.ab < 40) continue;
      const avg = line.h / line.ab;
      if (!best || avg > best.avg) {
        best = { avg, name: p.name, team: record.index, hr: line.hr, sb: line.sb };
      }
    }
  }

  if (!best) return null;
  const printed = best.avg.toFixed(3).replace(/^0/, '');
  return {
    kind: 'milestone', team: best.team, weight: 50,
    text: `${best.name} is hitting ${printed}`
      + ` for ${season.teams[best.team]?.def.abbr ?? '?'}`,
    detail: `Nobody in the country is close`
      + `${best.hr > 0 ? `; ${best.hr} of the hits have left the park` : ''}`
      + `${best.sb > 0 ? `, with ${best.sb} bags stolen` : ''}.`,
  };
}

/**
 * The power and pitching lines the paper leads its briefs with — the country's
 * home run leader and its best qualified arm, straight off the season books.
 */
function leagueLeaders(season: SeasonState): WireItem[] {
  let hr: { n: number; name: string; team: number } | null = null;
  let arm: { era: number; name: string; team: number; k: number } | null = null;

  for (const record of season.teams) {
    const bats: Hitter[] = [...record.team.lineup, ...record.team.bench];
    for (const p of bats) {
      const line = season.batting.get(p.id);
      if (!line || line.hr === 0) continue;
      if (!hr || line.hr > hr.n) hr = { n: line.hr, name: p.name, team: record.index };
    }
    const arms: Arm[] = [...record.team.rotation, ...record.team.bullpen];
    for (const p of arms) {
      const line = season.pitching.get(p.id);
      if (!line || inningsPitched(line) < 15) continue;
      const e = era(line);
      if (!arm || e < arm.era) arm = { era: e, name: p.name, team: record.index, k: line.k };
    }
  }

  const items: WireItem[] = [];
  const abbr = (i: number): string => season.teams[i]?.def.abbr ?? '?';
  if (hr && hr.n >= 4) {
    items.push({
      kind: 'power', team: hr.team, weight: 44,
      text: `${hr.name} leads the country with ${hr.n} home runs`,
      detail: `The ${abbr(hr.team)} bat nobody wants to pitch to.`,
    });
  }
  if (arm) {
    items.push({
      kind: 'gem', team: arm.team, weight: 43,
      text: `${arm.name}'s ${arm.era.toFixed(2)} ERA is the best in the country`,
      detail: `${arm.k} strikeouts for ${abbr(arm.team)}, and hitters are running out of ideas.`,
    });
  }
  return items;
}

/**
 * A big strikeout night from the most recent box score on file.
 *
 * Box scores are kept for the user's games only, so this is the one story that
 * is local by construction — which suits a paper: the game you were at gets the
 * detailed write-up. The pitching line is parsed from the box's own printed
 * format ("6.0 IP, 4 H, 1 R, 1 ER, 2 BB, 11 K"), which this codebase controls.
 */
function latestGem(season: SeasonState): WireItem | null {
  const days = Object.keys(season.boxScores ?? {}).map(Number).sort((a, b) => b - a);
  const latest = days[0];
  if (latest === undefined) return null;
  const box = season.boxScores?.[latest];
  if (!box) return null;

  for (const [side, teamIndex] of [
    [box.homePitching, box.home], [box.awayPitching, box.away],
  ] as const) {
    for (const l of side ?? []) {
      const k = Number(/(\d+) K$/.exec(l.line)?.[1] ?? 0);
      if (k >= 10) {
        return {
          kind: 'gem', team: teamIndex, weight: 48,
          text: `${l.name} strikes out ${k}`,
          detail: `${l.line} — the kind of night a scout circles twice.`,
        };
      }
    }
  }
  return null;
}
