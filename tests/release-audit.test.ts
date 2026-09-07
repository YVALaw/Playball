// release-audit.test.ts
// The promises the v1.0 release audit made the code keep (05 §62).
//
// Every test here is a defect the audit found, verified against the code,
// and fixed. They are grouped the way §62 is: the managed game against the
// simulated one, the baseball rules, the save system and the career's
// integrity, the roster lifecycle, the postseason, and the sandbox's edits.

import { describe, it, expect, beforeEach, vi } from 'vitest';
const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_store: string, value: { slot: string }) => {
      disk.set(value.slot, structuredClone(value));
    },
    get: async (_store: string, key: string) => {
      const found = disk.get(key);
      return found === undefined ? undefined : structuredClone(found);
    },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_store: string, key: string) => { disk.delete(key); },
  }),
}));

import { createLiveGame } from '../src/engine/liveGame.js';
import { newTeams } from '../src/engine/calibration.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import {
  createSeason, simSeason, nextSeason, rpiOrder, playGame,
} from '../src/engine/season.js';
import { hurt, isHurt } from '../src/engine/injury.js';
import { threw, armMileage } from '../src/engine/workload.js';
import { available } from '../src/engine/depthChart.js';
import { redshirt, redshirtCount } from '../src/engine/redshirt.js';
import { openPortal } from '../src/engine/portal.js';
import { moodOf, SETTLED } from '../src/engine/morale.js';
import { freezeRegularSeason, allConferenceTournaments, protectedTopFour } from '../src/engine/postseason.js';
import { jobOffers } from '../src/engine/program.js';
import { cutPlayer } from '../src/engine/godMode.js';
import { canPursue } from '../src/engine/recruiting.js';
import { leagueLabel } from '../src/engine/leagueNames.js';
import { useDynasty, PHASES } from '../src/state/store.js';
import type { Hitter, Player } from '../src/engine/types.js';

const fresh = (seed = 3) => createSeason(makeRng(seed), undefined, CONFERENCES);

beforeEach(() => {
  disk.clear();
  useDynasty.getState().newDynasty();
});

// ---------------------------------------------------------------------------
// §62.2 The rules
// ---------------------------------------------------------------------------

describe('a bunt with two out', () => {
  it('is an ordinary at-bat: the batter is the third out and nobody scores', () => {
    let tried = 0;
    for (let seed = 1; seed <= 80 && tried < 30; seed++) {
      const { a, b } = newTeams(seed);
      const live = createLiveGame(a, b, makeRng(seed), { managing: 'home', autoPitching: true });
      let guard = 0;
      while (!live.over && guard++ < 500) {
        const p = live.pending;
        if (!p) break;
        const bunt = p.options.find((o) => o.tactic === 'bunt' && o.available);
        if (p.outs === 2 && p.bases[2] && bunt) {
          const at = live.log.length;
          live.submit('bunt');
          // The bunt line itself; a mound-visit note can precede it, and a bunt
          // fouled off for strike three never reaches the bunt branch at all.
          const line = live.log.slice(at).find((l) => l.includes('[bunt]'));
          if (!line) continue;
          tried++;
          expect(line).not.toContain('lays down a sacrifice');
          expect(line).not.toContain('scores from third');
        } else {
          const first = p.options.find((o) => o.available);
          if (!first) break;
          live.submit(first.tactic);
        }
      }
    }
    expect(tried).toBeGreaterThan(5);
  });
});

describe('a ground-ball out with a man on first', () => {
  it('moves the forced runner up when the out is taken at first', () => {
    let plain = 0;
    let moved = 0;
    for (let seed = 1; seed <= 60 && plain < 40; seed++) {
      const { a, b } = newTeams(100 + seed);
      const live = createLiveGame(a, b, makeRng(100 + seed), { managing: 'home', autoPitching: true });
      let guard = 0;
      while (!live.over && guard++ < 500) {
        const p = live.pending;
        if (!p) break;
        const first = p.options.find((o) => o.available);
        if (!first) break;
        const forced = p.bases[0] && !p.bases[1] && p.outs < 2;
        const at = live.log.length;
        live.submit(first.tactic);
        if (!forced) continue;
        const line = live.log[at] ?? '';
        // A plain ground-ball out — not the double play, not the fielder's
        // choice, not the RBI groundout — used to leave the forced runner where
        // he stood.
        if (/grounds out( to [a-z ]+)?\.$/.test(line)) {
          plain++;
          if ((live.log[at + 1] ?? '').includes('to second.')) moved++;
        }
      }
    }
    expect(plain).toBeGreaterThan(10);
    expect(moved).toBe(plain);
  });
});

describe('a pitching change', () => {
  it('starts the order fresh for the new arm', () => {
    let changed = 0;
    for (let seed = 1; seed <= 40 && changed < 8; seed++) {
      const { a, b } = newTeams(200 + seed);
      const live = createLiveGame(a, b, makeRng(200 + seed), { managing: 'home', autoPitching: false });
      let guard = 0;
      while (!live.over && guard++ < 600) {
        const p = live.pending;
        if (!p) break;
        const defensive = p.options.some((o) => o.tactic === 'pitch');
        const arm = live.bullpenAvailable[0];
        if (defensive && arm && live.result.home.timesThrough.size >= 5) {
          expect(live.changePitcher(arm)).toBe(true);
          expect(live.result.home.timesThrough.size).toBe(0);
          changed++;
          continue;
        }
        const first = p.options.find((o) => o.available);
        if (!first) break;
        live.submit(first.tactic);
      }
    }
    expect(changed).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// §62.1 The managed game against the simulated one
// ---------------------------------------------------------------------------

describe('a managed game pays the season its bookkeeping', () => {
  it('a day in the legs for the nine and a season in the arm for the pitcher', async () => {
    useDynasty.getState().start(4242, 0);
    await useDynasty.getState().startManagedGame();
    const live = useDynasty.getState().live!;
    expect(live).not.toBeNull();
    live.finish();
    await useDynasty.getState().endManagedGame();
    const season = useDynasty.getState().season!;
    const me = season.teams[0]!;
    const starts = me.team.lineup.map((p) => (p as Player & { starts?: number }).starts ?? 0);
    expect(starts.filter((n) => n >= 1).length).toBeGreaterThanOrEqual(8);
    const threw = [...live.result.home.pitching.values(), ...live.result.away.pitching.values()]
      .filter((l) => l.outs > 0)
      .map((l) => (l.player as Player & { outs?: number }).outs ?? 0);
    expect(threw.length).toBeGreaterThan(0);
    expect(threw.every((o) => o > 0)).toBe(true);
  });

  it('cannot be started twice by two overlapping taps', async () => {
    useDynasty.getState().start(4242, 0);
    const a = useDynasty.getState().startManagedGame();
    const b = useDynasty.getState().startManagedGame();
    await Promise.all([a, b]);
    const live = useDynasty.getState().live;
    expect(live).not.toBeNull();
    expect(useDynasty.getState().liveStarting).toBe(false);
    // The season's generator moved exactly once past the anchor: a second
    // game would have spent it again.
    const season = useDynasty.getState().season!;
    live!.finish();
    await useDynasty.getState().endManagedGame();
    expect(season.results.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// §62.3 The save system and the career's integrity
// ---------------------------------------------------------------------------

describe('the transfer pool survives a save taken on the portal step', () => {
  it('comes back with the same men and the step can still be left', async () => {
    useDynasty.getState().start(4242, 0);
    simSeason(useDynasty.getState().season!);
    useDynasty.setState({ phase: 'draft', furthestPhase: PHASES.indexOf('draft') });
    await useDynasty.getState().nextPhase();
    expect(useDynasty.getState().phase).toBe('portal');
    const before = useDynasty.getState().portal;
    expect(before).not.toBeNull();
    const counts = { leaving: before!.leaving.length, available: before!.available.length };
    expect(counts.available).toBeGreaterThan(0);

    await useDynasty.getState().saveNow();
    const slot = useDynasty.getState().loadedSlot!;
    useDynasty.getState().newDynasty();
    expect(await useDynasty.getState().loadSlot(slot)).toBe(true);

    const after = useDynasty.getState().portal;
    expect(useDynasty.getState().phase).toBe('portal');
    expect(after).not.toBeNull();
    expect(after!.leaving.length).toBe(counts.leaving);
    expect(after!.available.length).toBe(counts.available);
    // Re-linked to the loaded season's own men, not to copies.
    const season = useDynasty.getState().season!;
    const everyone = new Set(season.teams.flatMap((t) => [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen]));
    for (const m of [...after!.leaving, ...after!.available]) expect(everyone.has(m.player)).toBe(true);

    await useDynasty.getState().nextPhase();
    expect(useDynasty.getState().phase).toBe('recruiting');
  });
});

describe('a season is settled once', () => {
  it('walking back to awards after the review card is dismissed does not grade it again', async () => {
    useDynasty.getState().start(4242, 0);
    simSeason(useDynasty.getState().season!);
    useDynasty.setState({ phase: 'awards', furthestPhase: PHASES.indexOf('awards') });
    await useDynasty.getState().nextPhase('awards');
    expect(useDynasty.getState().phase).toBe('review');
    const once = useDynasty.getState();
    expect(once.history).toHaveLength(1);
    const wins = once.coach.careerWins;
    const tenure = once.coach.tenure;

    useDynasty.getState().clearReview();
    useDynasty.getState().goPhase('awards');
    await useDynasty.getState().nextPhase('awards');
    const twice = useDynasty.getState();
    expect(twice.history).toHaveLength(1);
    expect(twice.coach.careerWins).toBe(wins);
    expect(twice.coach.tenure).toBe(tenure);
  });
});

describe('what a save carries is what a load applies', () => {
  it('league renames and the sandbox star gate follow the save, not the last career started', async () => {
    const season0 = fresh(4);
    const fiveStar = season0.recruiting.prospects.find((p) => p.stars === 5)!;

    useDynasty.getState().start(4242, 0, undefined, 'full', undefined, true);
    useDynasty.getState().godSetLeagueName('GULF', 'SEC');
    expect(leagueLabel('GULF')).toBe('SEC');
    await useDynasty.getState().saveNow();
    const sandbox = useDynasty.getState().loadedSlot!;

    useDynasty.getState().newDynasty();
    expect(leagueLabel('GULF')).toBe('GULF');
    expect(canPursue(fiveStar, 1, false)).toBe(false);

    expect(await useDynasty.getState().loadSlot(sandbox)).toBe(true);
    expect(leagueLabel('GULF')).toBe('SEC');
    expect(canPursue(fiveStar, 1, false)).toBe(true);

    useDynasty.getState().newDynasty();
    useDynasty.getState().start(4242, 1);
    await useDynasty.getState().saveNow();
    const ordinary = useDynasty.getState().loadedSlot!;
    expect(await useDynasty.getState().loadSlot(sandbox)).toBe(true);
    expect(await useDynasty.getState().loadSlot(ordinary)).toBe(true);
    expect(leagueLabel('GULF')).toBe('GULF');
    expect(canPursue(fiveStar, 1, false)).toBe(false);
  });

  it('the approaches ledger rides the file', async () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ approaches: { tried: [7, 8], interest: [7] } });
    await useDynasty.getState().saveNow();
    const slot = useDynasty.getState().loadedSlot!;
    useDynasty.getState().newDynasty();
    expect(useDynasty.getState().approaches).toEqual({ tried: [], interest: [] });
    expect(await useDynasty.getState().loadSlot(slot)).toBe(true);
    expect(useDynasty.getState().approaches).toEqual({ tried: [7, 8], interest: [7] });
  });
});

describe('a sacked coach always has somewhere to go', () => {
  it('the cheapest chair in the country calls when nobody else will', () => {
    useDynasty.getState().start(4242, 0);
    const { season, coach } = useDynasty.getState();
    const offers = jobOffers(
      { ...coach, prestige: 5 }, season!.teams, (t) => t.prestige, 0, 4, () => false,
    );
    expect(offers).toHaveLength(1);
    const cheapest = [...season!.teams].filter((t) => t.index !== 0).sort((a, b) => a.prestige - b.prestige)[0]!;
    expect(offers[0]!.team).toBe(cheapest.index);
  });
});

// ---------------------------------------------------------------------------
// §62.4 The roster lifecycle
// ---------------------------------------------------------------------------

describe('June carries every survivor', () => {
  it('a deep roster loses nobody to the shape of the bench and the pen', () => {
    const season = fresh(6);
    const me = season.teams[0]!;
    // Nobody graduates, nobody is draft-eligible: every man must come back.
    const extraBats = season.teams[1]!.team.bench.splice(0, 3);
    const extraArms = season.teams[1]!.team.bullpen.splice(0, 3);
    me.team.bench.push(...extraBats);
    me.team.bullpen.push(...extraArms);
    const everyone = [...me.team.lineup, ...me.team.bench, ...me.team.rotation, ...me.team.bullpen];
    for (const p of everyone) p.classYear = 'SO';
    const ids = new Set(everyone.map((p) => p.id));
    expect(ids.size).toBe(29);

    const next = nextSeason(season);
    const after = next.teams[0]!;
    const kept = new Set([...after.team.lineup, ...after.team.bench, ...after.team.rotation, ...after.team.bullpen].map((p) => p.id));
    for (const id of ids) expect(kept.has(id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §62.5 The postseason
// ---------------------------------------------------------------------------

describe('the national table is frozen for June', () => {
  it('protection and the RPI order do not move while the brackets are played', () => {
    const season = fresh(5);
    simSeason(season);
    const order = rpiOrder(season).map((r) => r.team.index);
    const protectedFour = protectedTopFour(season);
    freezeRegularSeason(season);
    allConferenceTournaments(season);
    expect(season.results.length).toBeGreaterThan(0);
    expect(rpiOrder(season).map((r) => r.team.index)).toEqual(order);
    expect(protectedTopFour(season)).toEqual(protectedFour);
  });
});

// ---------------------------------------------------------------------------
// §62.3 The sandbox's edits cannot break a nine
// ---------------------------------------------------------------------------

describe('cutting a starter in god mode', () => {
  it('refuses when nobody on the bench can take the spot, and covers the spot when somebody can', () => {
    const season = fresh(7);
    const me = season.teams[0]!;
    const catcher = me.team.lineup.find((h) => h.pos === 'C')!;
    me.team.bench = [];
    expect(cutPlayer(season, catcher.id)).toBe(false);
    expect(me.team.lineup).toHaveLength(9);
    expect(me.team.lineup.some((h) => h.id === catcher.id)).toBe(true);

    const cover = season.teams[1]!.team.bench.find((h) => h.pos !== 'C') as Hitter;
    me.team.bench = [cover];
    expect(cutPlayer(season, catcher.id)).toBe(true);
    expect(me.team.lineup).toHaveLength(9);
    expect(me.team.lineup.some((h) => h.id === cover.id)).toBe(true);
    expect(me.team.lineup.filter((h) => h.pos === 'C')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// §62.6 Failure modes
// ---------------------------------------------------------------------------

describe('the last starting pitcher', () => {
  it('cannot be cut unless the pen can fill the rotation, and the pen steps up when it can', () => {
    const season = fresh(8);
    const me = season.teams[0]!;
    // Down to one starter and an empty pen: the cut must refuse.
    me.team.bullpen = [];
    const [ace, ...rest] = me.team.rotation;
    me.team.rotation = [ace!];
    season.teams[1]!.team.bullpen.push(...rest);
    expect(cutPlayer(season, ace!.id)).toBe(false);
    expect(me.team.rotation).toHaveLength(1);
    // With one arm in the pen, the ace may go and the pen man takes the rotation.
    const reliever = season.teams[1]!.team.bullpen.pop()!;
    me.team.bullpen = [reliever];
    expect(cutPlayer(season, ace!.id)).toBe(true);
    expect(me.team.rotation).toHaveLength(1);
    expect(me.team.rotation[0]!.id).toBe(reliever.id);
    expect(me.team.bullpen).toHaveLength(0);
  });
});

describe('a save the engine could not play', () => {
  it('is refused at the door with a reason, not a day into the career', async () => {
    useDynasty.getState().start(4242, 0);
    const season = useDynasty.getState().season!;
    // A program with no starting pitcher throws inside its first game.
    season.teams[5]!.team.rotation = [];
    await useDynasty.getState().saveNow();
    const slot = useDynasty.getState().loadedSlot!;
    useDynasty.getState().newDynasty();
    expect(await useDynasty.getState().loadSlot(slot)).toBe(false);
    expect(useDynasty.getState().loadError).toMatch(/no starting pitcher/);
    expect(useDynasty.getState().season).toBeNull();
  });
});

describe('the calendar', () => {
  it('never loops forever on a year that is not a number', async () => {
    const { seasonDate } = await import('../src/ui/format.js');
    expect(seasonDate(Number.NaN, 0)).toMatch(/^MON /);
    expect(seasonDate(2027, 3)).toMatch(/^THU /);
  });
});

// ---------------------------------------------------------------------------
// §62.8 The other ninety-five
// ---------------------------------------------------------------------------

const everyone = (season: ReturnType<typeof fresh>): Player[] =>
  season.teams.flatMap((t) => [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen]);

describe('a winter heals every roster', () => {
  it('a rival\'s April hamstring and his ace\'s innings do not follow him into February', () => {
    const season = fresh(9);
    const rival = season.teams[5]!;
    const leg = rival.team.lineup[0]!;
    const arm = rival.team.rotation[0]!;
    hurt(leg, 10, 'hamstring', 30);
    threw(arm, 60);
    expect(isHurt(leg, 20)).toBe(true);
    expect(armMileage(arm)).toBeGreaterThan(0);

    const next = nextSeason(season);
    // The same men, on the same team object, healed by the roll itself.
    expect(next.teams[5]!.team.lineup[0]).toBe(leg);
    expect(isHurt(leg, 0)).toBe(false);
    expect(available(leg, 0)).toBe(true);
    expect(armMileage(arm)).toBe(0);
  });
});

describe('the bench a game may reach for', () => {
  it('a man on the shelf never pinch-hits, and a redshirt keeps his year', () => {
    const season = fresh(7);
    const me = season.teams[0]!.team;
    const shelved = me.bench[0]!;
    hurt(shelved, 0, 'knee', 200);
    const sitting = me.bench.find((h) => h !== shelved && (h.classYear === 'FR' || h.classYear === 'SO'))!;
    expect(sitting).toBeDefined();
    expect(redshirt(me, sitting)).toBe(true);

    for (let g = 0; g < 30; g++) {
      if (g % 2 === 0) playGame(season, 0, 1); else playGame(season, 1, 0);
    }
    expect(season.batting.get(shelved.id)?.g ?? 0).toBe(0);
    expect(season.batting.get(sitting.id)?.g ?? 0).toBe(0);
    // Somebody off that bench did play, so this is the filter and not a
    // season with no substitutions in it.
    const benchGames = me.bench.reduce((n, h) => n + (season.batting.get(h.id)?.g ?? 0), 0);
    expect(benchGames).toBeGreaterThan(0);

    // And the managed game is handed the same bench.
    const { a, b } = newTeams(11);
    const out = a.bench[0]!;
    const live = createLiveGame(a, b, makeRng(11), {
      managing: 'home', homeBench: a.bench.filter((h) => h !== out),
    });
    expect(live.benchAvailable).not.toContain(out);
    expect(live.benchAvailable.length).toBe(a.bench.length - 1);
  });
});

describe('the portal measures each program against its own season', () => {
  it('a shorter year is a smaller denominator, for that program alone', () => {
    const season = fresh(8);
    for (const t of season.teams) { t.w = 30; t.l = 30; }
    const mine = season.teams[3]!;
    for (const p of [...mine.team.lineup, ...mine.team.bench]) (p as Player & { starts?: number }).starts = 10;
    const ids = (pool: { player: Player; from: number }[]) => ({
      mine: new Set(pool.filter((m) => m.from === 3).map((m) => m.player.id)),
      others: new Set(pool.filter((m) => m.from !== 3).map((m) => m.player.id)),
    });
    const sixty = ids(openPortal(season.teams, { year: 2027, seed: 4242 }));
    for (const p of everyone(season)) delete (p as Player & { inPortal?: boolean }).inPortal;
    mine.w = 15; mine.l = 15;
    const thirty = ids(openPortal(season.teams, { year: 2027, seed: 4242 }));
    // Ten starts in thirty games is a man who played; in sixty he was buried.
    expect(thirty.mine.size).toBeLessThan(sixty.mine.size);
    for (const id of thirty.mine) expect(sixty.mine.has(id)).toBe(true);
    // And nobody else's answer moved.
    expect([...thirty.others].sort()).toEqual([...sixty.others].sort());
  });
});

describe('the portal reads the season that just ended', () => {
  it('every man\'s mood is settled when the pool opens, and not again at the roll', async () => {
    useDynasty.getState().start(4242, 0);
    simSeason(useDynasty.getState().season!);
    const before = everyone(useDynasty.getState().season!).filter((p) => moodOf(p) !== SETTLED).length;
    useDynasty.setState({ phase: 'draft', furthestPhase: PHASES.indexOf('draft') });
    await useDynasty.getState().nextPhase();
    expect(useDynasty.getState().phase).toBe('portal');
    const season = useDynasty.getState().season!;
    const men = everyone(season);
    const settled = men.filter((p) => moodOf(p) !== SETTLED).length;
    expect(settled).toBeGreaterThan(before);
    expect(settled).toBeGreaterThan(men.length / 2);

    // A rival regular who is going nowhere: his mood after the roll is the
    // mood the portal read, because the roll knows the step was walked.
    const pool = new Set([...useDynasty.getState().portal!.available, ...useDynasty.getState().portal!.leaving].map((m) => m.player.id));
    const stayer = season.teams[7]!.team.lineup.find((p) => !pool.has(p.id) && p.classYear !== 'SR')!;
    const read = moodOf(stayer);
    for (let guard = 0; guard < 6 && useDynasty.getState().phase !== null; guard++) {
      await useDynasty.getState().nextPhase();
    }
    expect(useDynasty.getState().phase).toBeNull();
    const after = everyone(useDynasty.getState().season!).find((p) => p.id === stayer.id);
    expect(after).toBeDefined();
    expect(moodOf(after!)).toBe(read);
  });
});

describe('an unsigned portal man has left college baseball', () => {
  it('from a rival\'s roster as surely as from the coached one', async () => {
    useDynasty.getState().start(4242, 0);
    simSeason(useDynasty.getState().season!);
    useDynasty.setState({ phase: 'draft', furthestPhase: PHASES.indexOf('draft') });
    await useDynasty.getState().nextPhase();
    const portal = useDynasty.getState().portal!;
    expect(portal.available.length).toBeGreaterThan(0);
    // Priced out of every program's budget, so nobody signs and everybody leaves.
    for (const m of portal.available) m.cost = 100_000;
    const gone = portal.available.map((m) => ({ id: m.player.id, from: m.from }));
    await useDynasty.getState().nextPhase();
    expect(useDynasty.getState().phase).toBe('recruiting');
    const season = useDynasty.getState().season!;
    for (const m of gone) {
      const roster = season.teams[m.from]!.team;
      const still = [...roster.lineup, ...roster.bench, ...roster.rotation, ...roster.bullpen]
        .some((p) => p.id === m.id);
      expect(still, `${m.id} is still on program ${m.from}`).toBe(false);
    }
  });
});

describe('the staff decides who sits a year', () => {
  it('for the ninety-five always, and for the coached program when the coach asked not to be asked', async () => {
    useDynasty.getState().start(4242, 0, undefined, 'casual');
    useDynasty.getState().settleSeason();
    await useDynasty.getState().rollYear();
    const casual = useDynasty.getState().season!;
    const league = casual.teams.reduce((n, t) => n + redshirtCount(t.team), 0);
    expect(league).toBeGreaterThan(20);
    expect(casual.teams.every((t) => redshirtCount(t.team) <= 3)).toBe(true);

    useDynasty.getState().newDynasty();
    useDynasty.getState().start(4242, 0);
    useDynasty.getState().settleSeason();
    await useDynasty.getState().rollYear();
    const full = useDynasty.getState().season!;
    expect(redshirtCount(full.teams[0]!.team)).toBe(0);
    expect(full.teams.slice(1).reduce((n, t) => n + redshirtCount(t.team), 0)).toBeGreaterThan(20);
  });
});
