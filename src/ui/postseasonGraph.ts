// postseasonGraph.ts
// The postseason as one directed graph, and a layered layout for it.
//
// Eight conference brackets on the left, the sixteen bids as a seam in the
// middle, one national tree, and a single champion node with nothing after it.
// Left to right is always chronological, so the shape of June is the shape of
// the drawing.
//
// **Every slot exists from the first press.** That is the whole reason the
// format changed: a knockout tree of series is determined by its seeding, so the
// bracket can be drawn whole on day one with TBD where the names have not
// arrived yet. Double elimination could not do that — the losers' bracket
// pairings do not exist until somebody has lost.
//
// **Bids are real nodes.** An automatic bid and an at-large selection are
// different events — one is caused by winning your conference, the other by a
// committee looking at your RPI — and running a lost conference game straight
// into the national bracket would draw a defeat as if it were advancement.
//
// Pure: no React, no store. It takes the postseason state and returns geometry,
// which is what lets the layout be tested without a renderer.

import {
  conferenceField, conferenceIds, startSeriesBracket, roundName,
  conferenceLengths, REGIONAL_LENGTHS, NATIONAL_LENGTHS, clincher,
  REGIONS, regionOf,
} from '../engine/postseason.js';
import type {
  ConferenceTournament, RegionalResult, Series, SeriesBracket, TournamentResult,
} from '../engine/postseason.js';
import type { SeasonState } from '../engine/season.js';

export type Section = 'conf' | 'regional' | 'national';

export interface SeriesNode {
  kind: 'series';
  id: string;
  bracket: string;
  section: Section;
  col: number;
  roundLabel: string;
  a: number | null;
  b: number | null;
  aSeed: number;
  bSeed: number;
  /** Games won by each side so far. */
  aWins: number;
  bWins: number;
  /** How many wins take it. */
  need: number;
  bestOf: number;
  winner: number | null;
  /** Every game played in this series, in order. */
  games: { home: number; away: number; homeRuns: number; awayRuns: number }[];
}

export interface ChampNode {
  kind: 'champ';
  id: 'champ';
  section: 'national';
  col: number;
  team: number | null;
}

export type GraphNode = SeriesNode | ChampNode;

export interface GraphEdge {
  from: string;
  to: string;
  team: number;
  /** Advancing inside a bracket, or crossing a stage boundary. */
  kind: 'advance' | 'qualifies';
}

export interface BracketBox {
  key: string;
  label: string;
  section: Section;
  seeds: number[];
  mine: boolean;
  nodes: string[];
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  brackets: BracketBox[];
  cols: Record<Section, number>;
}

/** What the screen knows about the postseason right now. */
export interface GraphInput {
  season: SeasonState;
  userTeam: number;
  cups: readonly ConferenceTournament[];
  regionals: readonly RegionalResult[];
  national: TournamentResult | null;
  /** Your own bracket, mid-flight, if one is open. */
  live: { kind: 'conference' | 'regional' | 'national'; state: SeriesBracket } | null;
}

/** A tree of the right shape with nobody in it, for a bracket not yet seeded. */
function emptyTree(size: number): Series[][] {
  const rounds: Series[][] = [];
  for (let r = 0; r < Math.log2(size); r++) {
    const count = size / 2 ** (r + 1);
    const list: Series[] = [];
    for (let slot = 0; slot < count; slot++) {
      list.push({
        round: r, slot, a: null, b: null, aSeed: 0, bSeed: 0,
        games: [], winner: null,
      });
    }
    rounds.push(list);
  }
  return rounds;
}

export function buildGraph(input: GraphInput): Graph {
  const { season, userTeam } = input;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const brackets: BracketBox[] = [];
  const cols: Record<Section, number> = { conf: 1, regional: 1, national: 1 };

  const nodeOfSlot = new Map<string, string>();

  const addTree = (
    key: string, label: string, seeds: readonly number[],
    rounds: readonly Series[][], lengths: readonly number[],
    sectionFor: (round: number) => Section,
  ): void => {
    const owned: string[] = [];
    const mine = seeds.includes(userTeam);

    rounds.forEach((round, r) => {
      const section = sectionFor(r);
      const bestOf = lengths[r] ?? 3;
      round.forEach((s) => {
        const aWins = s.games.filter((g) => g.winner === s.a).length;
        const bWins = s.games.filter((g) => g.winner === s.b).length;
        const node: SeriesNode = {
          kind: 'series', id: `${key}-r${r}s${s.slot}`, bracket: key, section,
          col: r + 1, roundLabel: roundName(rounds.length, r),
          a: s.a, b: s.b, aSeed: s.aSeed, bSeed: s.bSeed,
          aWins, bWins, need: clincher(bestOf), bestOf, winner: s.winner,
          games: s.games.map((g) => ({
            home: g.home, away: g.away, homeRuns: g.homeRuns, awayRuns: g.awayRuns,
          })),
        };
        nodes.push(node);
        owned.push(node.id);
        nodeOfSlot.set(`${key}:${r}:${s.slot}`, node.id);

        // The tree's own shape is the edge list: this slot feeds the one above.
        if (r > 0) {
          for (const child of [s.slot * 2, s.slot * 2 + 1]) {
            const from = nodeOfSlot.get(`${key}:${r - 1}:${child}`);
            if (!from) continue;
            const prev = rounds[r - 1]?.[child];
            edges.push({
              from, to: node.id,
              team: prev?.winner ?? -1,
              kind: 'advance',
            });
          }
        }
      });
      cols[section] = Math.max(cols[section], r + 1);
    });

    brackets.push({ key, label, section: sectionFor(0), seeds: [...seeds], mine, nodes: owned });
  };

  // --- the conferences -----------------------------------------------------
  const myConference = season.teams[userTeam]?.conference ?? '';
  for (const id of conferenceIds(season)) {
    const cup = input.cups.find((c) => c.conference === id);
    const isMine = id === myConference;
    const liveHere = isMine && input.live?.kind === 'conference' ? input.live.state : null;
    const seeds = cup ? cup.seeds : liveHere ? liveHere.seeds : conferenceField(season, id).field;
    const rounds = cup?.rounds ?? liveHere?.rounds
      // Nothing played and not yours: build the tree anyway, so every conference
      // is on the map from the start rather than appearing when it finishes.
      ?? startSeriesBracket(season, seeds, conferenceLengths()).rounds;
    addTree(`c-${id}`, id.toUpperCase(), seeds, rounds, conferenceLengths(), () => 'conf');
  }

  // --- the regionals: two conference champions each -----------------------
  const championOf = new Map(input.cups.map((c) => [c.conference, c.champion]));
  const myRegion = regionOf(myConference);
  for (const region of REGIONS) {
    const played = input.regionals.find((r) => r.region === region.id);
    const liveHere = region.id === myRegion && input.live?.kind === 'regional'
      ? input.live.state : null;
    const seeds = played ? played.seeds
      : liveHere ? liveHere.seeds
      : region.conferences
        .map((c) => championOf.get(c))
        .filter((t): t is number => t !== undefined);
    const rounds = played?.rounds ?? liveHere?.rounds
      ?? (seeds.length > 1
        ? startSeriesBracket(season, seeds, REGIONAL_LENGTHS).rounds
        : emptyTree(2));
    addTree(
      `reg-${region.id}`, `${region.name.toUpperCase()} REGIONAL`,
      seeds, rounds, REGIONAL_LENGTHS, () => 'regional',
    );

    // A conference final feeds its regional: winning the league is how you got
    // here, and drawing that line is what makes the pyramid a pyramid.
    for (const conf of region.conferences) {
      const from = nodes.find(
        (n) => n.kind === 'series' && n.bracket === `c-${conf}`
          && n.col === conferenceLengths().length,
      );
      const into = nodes.find(
        (n) => n.kind === 'series' && n.bracket === `reg-${region.id}` && n.col === 1,
      );
      if (from && into) {
        edges.push({
          from: from.id, to: into.id,
          team: championOf.get(conf) ?? -1, kind: 'qualifies',
        });
      }
    }
  }

  // --- the last four -------------------------------------------------------
  const liveNat = input.live?.kind === 'national' ? input.live.state : null;
  const natSeeds = input.national ? input.national.seeds
    : liveNat ? liveNat.seeds
    : input.regionals.map((r) => r.champion);
  {
    const rounds = input.national?.rounds ?? liveNat?.rounds
      ?? (natSeeds.length > 1
        ? startSeriesBracket(season, natSeeds, NATIONAL_LENGTHS).rounds
        : emptyTree(4));
    addTree('nat', 'NATIONAL', natSeeds, rounds, NATIONAL_LENGTHS, () => 'national');

    // Each regional final feeds the national bracket.
    for (const region of REGIONS) {
      const from = nodes.find(
        (n) => n.kind === 'series' && n.bracket === `reg-${region.id}`
          && n.col === REGIONAL_LENGTHS.length,
      );
      const into = nodes.find(
        (n) => n.kind === 'series' && n.bracket === 'nat' && n.col === 1,
      );
      if (from && into) {
        const champ = input.regionals.find((r) => r.region === region.id)?.champion;
        edges.push({ from: from.id, to: into.id, team: champ ?? -1, kind: 'qualifies' });
      }
    }
  }

  // --- the terminus --------------------------------------------------------
  const champTeam = input.national ? input.national.champion : null;
  nodes.push({
    kind: 'champ', id: 'champ', section: 'national', col: 0, team: champTeam,
  });
  const finalNode = nodes.find(
    (n) => n.kind === 'series' && n.bracket === 'nat' && n.col === NATIONAL_LENGTHS.length,
  );
  if (finalNode) {
    edges.push({
      from: finalNode.id, to: 'champ', team: champTeam ?? -1, kind: 'advance',
    });
  }

  return { nodes, edges, brackets, cols };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const CARD_W = 180;
export const CARD_H = 78;
export const COL_W = 196;
export const GAP_Y = 24;
export const SECTION_GAP = 190;
export const BID_W = 128;
export const BID_H = 44;
export const CHAMP_W = 228;
export const CHAMP_H = 118;

export interface Box { x: number; y: number; w: number; h: number }

export interface Layout {
  pos: Map<string, Box>;
  bracketBox: Map<string, Box>;
  sectionSpan: Record<Section, Box>;
  colX: Map<string, number>;
  cols: Record<Section, number>;
  totalW: number;
  totalH: number;
}

const sizeOf = (n: GraphNode): { w: number; h: number } =>
  n.kind === 'champ' ? { w: CHAMP_W, h: CHAMP_H } : { w: CARD_W, h: CARD_H };

/**
 * A layered graph layout.
 *
 * Columns come from progression, so left to right is always chronological. Rows
 * come from the edges: a node is pulled to the vertical midpoint of what feeds
 * it and of what it feeds, alternating direction, with a separation pass after
 * each sweep so cards never overlap. Conference brackets therefore drift until
 * they sit beside the part of the national tree they qualify into — nothing is
 * stacked in a fixed order, and the crossings fall out on their own.
 */
export function layoutGraph(g: Graph): Layout {
  const colX = new Map<string, number>();
  let x = 0;

  for (let c = 1; c <= g.cols.conf; c++) colX.set(`conf:${c}`, (c - 1) * COL_W);
  x = g.cols.conf * COL_W - (COL_W - CARD_W);

  const regX = x + SECTION_GAP;
  for (let c = 1; c <= g.cols.regional; c++) colX.set(`regional:${c}`, regX + (c - 1) * COL_W);
  x = regX + g.cols.regional * COL_W - (COL_W - CARD_W);

  const natX = x + SECTION_GAP;
  for (let c = 1; c <= g.cols.national; c++) colX.set(`national:${c}`, natX + (c - 1) * COL_W);
  x = natX + g.cols.national * COL_W - (COL_W - CARD_W);

  const champX = x + SECTION_GAP;
  colX.set('champ:0', champX);
  const totalW = champX + CHAMP_W;

  const keyOf = (n: GraphNode): string =>
    n.kind === 'champ' ? 'champ:0' : `${n.section}:${n.col}`;

  const xOf = new Map<string, number>();
  for (const n of g.nodes) xOf.set(n.id, colX.get(keyOf(n)) ?? 0);

  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const feeders = new Map<string, string[]>();
  const consumers = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, key: string, value: string): void => {
    const list = m.get(key);
    if (list) list.push(value);
    else m.set(key, [value]);
  };
  for (const e of g.edges) {
    push(feeders, e.to, e.from);
    push(consumers, e.from, e.to);
  }

  const layers = new Map<number, GraphNode[]>();
  for (const n of g.nodes) {
    const lx = xOf.get(n.id) as number;
    const list = layers.get(lx) ?? [];
    list.push(n);
    layers.set(lx, list);
  }
  const xs = [...layers.keys()].sort((a, b) => a - b);

  const y = new Map<string, number>();
  for (const lx of xs) {
    let cy = 0;
    for (const n of layers.get(lx) as GraphNode[]) {
      y.set(n.id, cy);
      cy += sizeOf(n).h + GAP_Y;
    }
  }
  const mid = (id: string): number =>
    (y.get(id) as number) + sizeOf(byId.get(id) as GraphNode).h / 2;
  const mean = (ids: string[]): number =>
    ids.reduce((a, id) => a + mid(id), 0) / ids.length;

  /** Push a layer apart without letting it drift off its own centre of mass. */
  const separate = (list: GraphNode[]): void => {
    const before = list.reduce((a, n) => a + mid(n.id), 0) / list.length;
    list.sort((a, b) => mid(a.id) - mid(b.id));
    let floor = -Infinity;
    for (const n of list) {
      const top = Math.max(y.get(n.id) as number, floor);
      y.set(n.id, top);
      floor = top + sizeOf(n).h + GAP_Y;
    }
    const after = list.reduce((a, n) => a + mid(n.id), 0) / list.length;
    const shift = before - after;
    for (const n of list) y.set(n.id, (y.get(n.id) as number) + shift);
  };

  for (let pass = 0; pass < 14; pass++) {
    const forward = pass % 2 === 0;
    const order = forward ? xs : [...xs].reverse();
    for (const lx of order) {
      const list = layers.get(lx) as GraphNode[];
      for (const n of list) {
        const nb = forward ? feeders.get(n.id) : consumers.get(n.id);
        if (nb && nb.length) y.set(n.id, mean(nb) - sizeOf(n).h / 2);
      }
      separate(list);
    }
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of g.nodes) {
    minY = Math.min(minY, y.get(n.id) as number);
    maxY = Math.max(maxY, (y.get(n.id) as number) + sizeOf(n).h);
  }

  const pos = new Map<string, Box>();
  for (const n of g.nodes) {
    const sz = sizeOf(n);
    pos.set(n.id, {
      x: xOf.get(n.id) as number, y: (y.get(n.id) as number) - minY, w: sz.w, h: sz.h,
    });
  }

  const bracketBox = new Map<string, Box>();
  for (const b of g.brackets) {
    let top = Infinity;
    let bot = -Infinity;
    let left = Infinity;
    for (const id of b.nodes) {
      const p = pos.get(id);
      if (!p) continue;
      top = Math.min(top, p.y);
      bot = Math.max(bot, p.y + p.h);
      left = Math.min(left, p.x);
    }
    if (top === Infinity) continue;
    bracketBox.set(b.key, { x: left, y: top, w: CARD_W, h: bot - top });
  }

  const sectionSpan = {} as Record<Section, Box>;
  for (const st of ['conf', 'regional', 'national'] as Section[]) {
    let lo = Infinity;
    let hi = -Infinity;
    let top = Infinity;
    let bot = -Infinity;
    for (const n of g.nodes) {
      if (n.section !== st) continue;
      const p = pos.get(n.id) as Box;
      lo = Math.min(lo, p.x);
      hi = Math.max(hi, p.x + p.w);
      top = Math.min(top, p.y);
      bot = Math.max(bot, p.y + p.h);
    }
    sectionSpan[st] = lo === Infinity
      ? { x: 0, y: 0, w: 0, h: 0 }
      : { x: lo, y: top, w: hi - lo, h: bot - top };
  }

  return {
    pos, bracketBox, sectionSpan, colX, cols: g.cols,
    totalW, totalH: maxY - minY,
  };
}
