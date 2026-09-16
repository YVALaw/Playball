// nine-more.test.ts
//
// Nine reports on 2026-09-16, the engine's halves (05 §91): the pen by hand
// and its closer, a rotation by hand and what short rest costs, the back
// gesture's registry of screen-held layers, an All-Star nobody releases, the
// name pools, and the seasons a man actually played for money.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSeason, simNextDay, currentDay, injuryClock, restedFirst, closerFrom, startableSlot, shortRest,
} from '../src/engine/season.js';
import { armValue } from '../src/engine/ratings.js';
import { makeRng } from '../src/engine/rng.js';
import { proCareer, proSeasons, type AlumnusNote } from '../src/engine/legacy.js';
import { FIRST, LAST } from '../src/data/names.js';
import {
  registerBackLayer, releaseBackLayer, peelBackLayer, topBackLayer, backLayerCount,
  stampLayer, unstampLayer, newestStoreLayer, resetBackLayers,
} from '../src/state/backLayers.js';

// ---------------------------------------------------------------------------
// The pen, by hand
// ---------------------------------------------------------------------------

describe('a pen set by hand', () => {
  const world = () => {
    const season = createSeason(makeRng(31));
    for (let i = 0; i < 6; i++) simNextDay(season);
    return season;
  };

  it('keeps the coach\'s order among the rested, and the top man closes', () => {
    const season = world();
    const rec = season.teams[0]!;
    const team = rec.team;
    // Rested and ready, every one of them, so the order is the only question.
    season.pitcherWorkload?.clear();
    const byRest = restedFirst(season, rec).map((p) => p.id);
    // Rest's order is by quality with nothing else to go on; the coach's is
    // the array's, whatever the quality.
    team.bullpen.reverse();
    team.penByHand = true;
    const byHand = restedFirst(season, rec).map((p) => p.id);
    expect(byHand).toEqual(team.bullpen.map((p) => p.id));
    expect(closerFrom(restedFirst(season, rec), true)?.id).toBe(team.bullpen[0]!.id);
    // And without the flag, the best arm closes whatever the order.
    delete team.penByHand;
    const best = [...team.bullpen].sort((a, b) => armValue(b) - armValue(a))[0]!;
    expect(closerFrom(restedFirst(season, rec))?.id).toBe(best.id);
    expect(byRest.length).toBe(byHand.length);
  });

  it('still leaves out the man who cannot pitch tonight', () => {
    const season = world();
    const rec = season.teams[0]!;
    const team = rec.team;
    season.pitcherWorkload?.clear();
    team.penByHand = true;
    const tired = team.bullpen[0]!;
    (season.pitcherWorkload ??= new Map()).set(tired.id, { day: currentDay(season) - 1, pitches: 60, outs: 9 });
    const pen = restedFirst(season, rec).map((p) => p.id);
    expect(pen).not.toContain(tired.id);
    expect(pen[0]).toBe(team.bullpen[1]!.id);
  });
});

// ---------------------------------------------------------------------------
// A rotation by hand, and what short rest costs
// ---------------------------------------------------------------------------

describe('a rotation set by hand', () => {
  it('starts the slot\'s man on short rest, and never on no rest or hurt', () => {
    const season = createSeason(makeRng(31));
    for (let i = 0; i < 8; i++) simNextDay(season);
    const team = season.teams[0]!.team;
    const day = currentDay(season);
    const clock = injuryClock(season);
    const ace = team.rotation[0]!;
    // Three days after a hundred pitches: the walk skips him, the coach's hand does not.
    (season.pitcherWorkload ??= new Map()).set(ace.id, { day: day - 3, pitches: 100, outs: 21 });
    for (const arm of team.rotation.slice(1)) season.pitcherWorkload.delete(arm.id);
    expect(startableSlot(season, team, 0, day, clock)).not.toBe(0);
    team.rotationByHand = true;
    expect(startableSlot(season, team, 0, day, clock)).toBe(0);
    expect(shortRest(season, ace, day)).toBe(true);
    // Last night: even by hand, two nights is the floor.
    season.pitcherWorkload.set(ace.id, { day: day - 1, pitches: 100, outs: 21 });
    expect(startableSlot(season, team, 0, day, clock)).not.toBe(0);
    // Hurt: never.
    season.pitcherWorkload.set(ace.id, { day: day - 3, pitches: 100, outs: 21 });
    (ace as { outUntil?: number }).outUntil = clock + 10;
    expect(startableSlot(season, team, 0, day, clock)).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The back gesture's registry
// ---------------------------------------------------------------------------

describe('screen-held layers and the back gesture', () => {
  beforeEach(resetBackLayers);

  it('peels the newest layer first, whoever holds it', () => {
    stampLayer('player');
    let closed = 0;
    const id = registerBackLayer(() => { closed++; });
    // The sheet opened after the card, so it goes first.
    expect(topBackLayer()).toBeGreaterThan(newestStoreLayer());
    expect(backLayerCount()).toBe(1);
    expect(peelBackLayer()).toBe(true);
    expect(closed).toBe(1);
    // Peeled: its entry was the pop's, and the release spends nothing more.
    expect(backLayerCount()).toBe(0);
    releaseBackLayer(id);
    expect(peelBackLayer()).toBe(false);
  });

  it('lets a card opened over a sheet go first', () => {
    registerBackLayer(() => undefined);
    stampLayer('player');
    expect(topBackLayer()).toBeLessThan(newestStoreLayer());
    unstampLayer('player');
    expect(topBackLayer()).toBeGreaterThan(newestStoreLayer());
  });
});

// ---------------------------------------------------------------------------
// An All-Star nobody releases; the seasons a man actually played
// ---------------------------------------------------------------------------

const note = (over: Partial<AlumnusNote> = {}): AlumnusNote => ({
  name: 'T. Cole', teamAbbr: 'PSC', year: 2030, reason: 'drafted', round: 1,
  overall: 80, classYear: 'JR', ...over,
});

describe('the year after an All-Star summer', () => {
  it('is never a release', () => {
    // "An alumni became an all star the previous year and released on the next."
    let stars = 0;
    for (let i = 0; i < 1200; i++) {
      const rows = proCareer(`s-${i}`, note({ overall: 70 + (i % 20), round: 1 + (i % 3) }), 2060);
      for (let k = 0; k + 1 < rows.length; k++) {
        const a = rows[k]!;
        const b = rows[k + 1]!;
        if (!/All-Star|MVP|Gold Glove/.test(a.line)) continue;
        stars++;
        expect(b.line, `${a.line} then ${b.line}`).not.toMatch(/^Released/);
      }
    }
    expect(stars).toBeGreaterThan(20);
  });

  it('counts only the seasons he played for money', () => {
    const home = proCareer('h-1', note({ reason: 'graduated', round: undefined, overall: 40 }), 2040);
    // A man who went home has rows -- the degree, maybe a coaching job -- and no professional season.
    if (home.every((r) => r.level === 'HOME' || r.level === 'COACHING')) expect(proSeasons(home)).toBe(0);
    const drafted = proCareer('d-1', note(), 2040);
    expect(proSeasons(drafted)).toBe(drafted.filter((r) => r.level !== 'HOME' && r.level !== 'COACHING').length);
    expect(proSeasons(drafted)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The name pools
// ---------------------------------------------------------------------------

describe('the name pools', () => {
  it('grew, and grew Hispanic', () => {
    expect(FIRST.length).toBeGreaterThan(480);
    expect(LAST.length).toBeGreaterThan(900);
    for (const n of ['Alejandro', 'Guillermo', 'Rodrigo', 'Yadier']) expect(FIRST).toContain(n);
    for (const n of ['Rodriguez', 'Hernandez', 'Gutierrez', 'Villanueva']) expect(LAST).toContain(n);
    // Appended only: the first names of each pool are where they were.
    expect(FIRST[0]).toBe('Jake');
    expect(LAST[0]).toBe('Whitfield');
    expect(new Set(FIRST).size).toBe(FIRST.length);
    expect(new Set(LAST).size).toBe(LAST.length);
  });
});
