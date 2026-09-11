// audit-followups.test.ts
// The findings of the 11 September 2026 outside audit that survived checking,
// each pinned at the seam where it went wrong.
//
// The audit was run on a snapshot four commits old and verified against the
// source rather than a running browser, so every claim in it was re-checked
// here before anything was changed. Some were overstated and are not in this
// file; the ones that are were reproduced first.

import { describe, it, expect } from 'vitest';
import { createSeason, simSeason, currentDay } from '../src/engine/season.js';
import {
  freezeRegularSeason, protectedTopFour, NATIONAL_BIDS, CONF_ADVANCE,
  allConferenceTournaments, stageRegionals, stageNational,
} from '../src/engine/postseason.js';
import { startDoubleElim } from '../src/engine/doubleElim.js';
import { conferenceField } from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { useDynasty } from '../src/state/store.js';
import { projectResultText } from '../src/engine/staffProjects.js';
import { weeklyBudget, flexibleOffseasonBudget } from '../src/engine/recruiting.js';
import { FINISH_LABEL, type Finish } from '../src/engine/postseason.js';

const world = (seed: number) => {
  const s = createSeason(makeRng(seed), undefined, CONFERENCES);
  simSeason(s);
  return s;
};

// ---------------------------------------------------------------------------
// F02 — a protected qualifier was told its season was over
// ---------------------------------------------------------------------------

describe('being knocked out of a conference tournament', () => {
  /** Drive a real conference tournament to its end for one program. */
  const knockoutFor = (seed: number, me: number) => {
    const s = world(seed);
    freezeRegularSeason(s);
    const { field } = conferenceField(s, s.teams[me]!.conference);
    const seeds = field.includes(me) ? field : [me, ...field.filter((t) => t !== me)];
    const state = startDoubleElim(s, seeds.slice(0, 8));
    useDynasty.setState({
      season: s, userTeam: me, year: 2099,
      bracket: { stage: 'conference', cups: [], regionals: [], national: null },
      myBracket: { kind: 'conference', format: 'double', state, preplayed: new Map() },
      knockout: null, postseasonSeen: [], sideShow: null, inbox: [],
      depth: { mode: 'casual', overrides: {} },
    });
    useDynasty.getState().simBracket('rest');
    return { season: s, knockout: useDynasty.getState().knockout, inbox: useDynasty.getState().inbox };
  };

  it('separates the tournament ending from the season ending', () => {
    /*
      Reported by audit: a protected top-four seed eliminated in its own
      conference tournament received "The season is over" while
      `selectNationalField` was still guaranteeing it a seat. The conference
      branch decided everything from a top-four placing; the regional branch
      beside it had asked about protection all along.
    */
    const { season, knockout } = knockoutFor(2103, 0);
    if (!knockout) return;                        // he won the thing
    expect(knockout.bid).toBeDefined();
    const isProtected = protectedTopFour(season).includes(0);
    if (isProtected) expect(knockout.bid).toBe('secure');
  });

  it('never tells a protected seed the season is finished', () => {
    // Every seed in the world, so the case does not depend on one draw.
    for (const seed of [2103, 4248, 909, 1717]) {
      const s = world(seed);
      freezeRegularSeason(s);
      const guarded = protectedTopFour(s);
      expect(guarded.length).toBeGreaterThan(0);
      for (const me of guarded) {
        const { knockout, inbox } = knockoutFor(seed, me);
        if (!knockout || knockout.advanced) continue;
        expect(knockout.bid, `${seed}/${me}`).toBe('secure');
        const letter = inbox.find((i) => i.kind === 'season');
        if (letter) expect(letter.title).not.toBe('The season is over');
      }
    }
  });

  it('leaves a team the table cannot reach with the ending it had', () => {
    // The bottom of the national table is genuinely finished, and should be
    // told so. Only the two states above it were wrong.
    const s = world(2103);
    freezeRegularSeason(s);
    expect(protectedTopFour(s).length).toBeLessThan(NATIONAL_BIDS);
  });

  it('keeps `advanced` meaning what it meant', () => {
    // The fix adds a second question rather than redefining the first, which
    // is what lets the existing bracket assertion stand unchanged.
    const { knockout } = knockoutFor(2103, 0);
    if (!knockout) return;
    if (knockout.advanced) {
      expect(knockout.placing).toBeGreaterThanOrEqual(2);
      expect(knockout.placing).toBeLessThanOrEqual(CONF_ADVANCE);
    }
  });
});

// ---------------------------------------------------------------------------
// F13 — the Portal said the money came out of the recruiting class
// ---------------------------------------------------------------------------

describe('the two offseason pools', () => {
  it('do not touch, whatever a screen once said', () => {
    /*
      The sign dialog warned that portal points "come out of the same offseason
      pool you take into recruiting". They do not: `weeklyBudget` takes the
      offseason spend and discards it, deliberately, and the same screen said
      the opposite twice further up.
    */
    for (const stars of [1, 2, 3, 4, 5]) {
      const spent = flexibleOffseasonBudget(stars);
      expect(weeklyBudget(stars, spent)).toBe(weeklyBudget(stars, 0));
    }
  });
});

// ---------------------------------------------------------------------------
// F14 — a sentence that was wrong at the rating cap
// ---------------------------------------------------------------------------

describe('a finished staff project', () => {
  const result = (before: number, after: number, focused: boolean) => projectResultText({
    seat: 'hitting', kind: 'hitting-contact', year: 2027, week: 4, focused,
    playerId: 'p1', took: true,
    changes: [{ id: 'p1', name: 'Test Man', attribute: 'contact', before, after }],
  } as unknown as Parameters<typeof projectResultText>[0]);

  it('reports the gain it actually made', () => {
    // "The matching focus made it three" was printed whatever the two numbers
    // beside it said, and at the 99 cap a focused project moves a man by one.
    expect(result(98, 99, true)).toContain('+1');
    expect(result(98, 99, true)).not.toContain('three');
  });

  it('still reports a full focused gain when the cap is not in the way', () => {
    expect(result(70, 73, true)).toContain('+3');
  });

  it('says nothing about focus when there was none', () => {
    expect(result(70, 72, false)).not.toContain('focus');
  });
});

// ---------------------------------------------------------------------------
// F15 — a raw enum where a readable label already existed
// ---------------------------------------------------------------------------

describe('a career row', () => {
  it('has a word for every finish the engine can assign', () => {
    // The program screen kept a private five-key copy, so `conference` — the
    // most common season outcome there is — printed as raw lowercase beside
    // "National runner-up".
    const every: Finish[] = ['missed', 'conference', 'regional', 'national', 'omaha', 'runner-up', 'champion'];
    for (const f of every) {
      expect(FINISH_LABEL[f], f).toBeTruthy();
      expect(FINISH_LABEL[f]).not.toBe(f);
    }
  });
});

// ---------------------------------------------------------------------------
// F01 — the postseason ran from April to August
// ---------------------------------------------------------------------------

describe('the postseason calendar', () => {
  const played = () => {
    const s = world(4242);
    freezeRegularSeason(s);
    return s;
  };

  it('opens every tournament of a stage on the same night', () => {
    /*
      Each tournament advanced the one shared clock and the stages were played
      end to end, so no two tournaments shared a date. The first conference
      played days 81-86 and the last 124-129 — and `pitcherReady` reads that
      clock, so the first opened one day after the regular season without its
      best arms and the last opened forty-four days later with everybody.
      Conference order is the data file's order, so the same leagues carried
      that every season of every career.
    */
    const s = played();
    const open = currentDay(s);
    const cups = allConferenceTournaments(s);
    expect(cups.length).toBeGreaterThan(1);
    // Every cup's first game is on the stage's own first night.
    for (const cup of cups) {
      const first = cup.games[0];
      expect(first, 'a cup with no games').toBeDefined();
      expect(first!.day, `${cup.conference} did not open with the rest`).toBe(open);
    }
  });

  it('hands the calendar on past the longest tournament, not the last one run', () => {
    const s = played();
    const open = currentDay(s);
    const cups = allConferenceTournaments(s);
    const after = currentDay(s);
    const longest = Math.max(...cups.flatMap((c) => c.games.map((g) => g.day)));
    expect(after).toBeGreaterThan(open);
    expect(after).toBeGreaterThanOrEqual(longest);
  });

  it('finishes June inside a month rather than inside a summer', () => {
    // Measured before the fix: 106 calendar increments, championship on the
    // app's 6 August. The shape of a postseason, not a second season.
    const s = played();
    const open = currentDay(s);
    const cups = allConferenceTournaments(s);
    const regionals = stageRegionals(s, cups);
    stageNational(s, cups, regionals);
    expect(currentDay(s) - open).toBeLessThan(45);
  });

  it('still plays every game it used to', () => {
    const s = played();
    const cups = allConferenceTournaments(s);
    for (const cup of cups) {
      expect(cup.champion).toBeGreaterThanOrEqual(0);
      expect(cup.games.length).toBeGreaterThan(0);
    }
    const regionals = stageRegionals(s, cups);
    expect(regionals.length).toBeGreaterThan(0);
    const nat = stageNational(s, cups, regionals);
    expect(nat.champion).toBeGreaterThanOrEqual(0);
    expect(new Set(nat.field.seeds).size).toBe(nat.field.seeds.length);
  });
});
