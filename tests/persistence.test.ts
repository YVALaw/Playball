// persistence.test.ts
// What actually reaches the disk.
//
// The bug this exists to prevent: `SaveExtras` accepted the field, `SaveFile`
// declared it, and the save still dropped it — because the record is assembled
// field by field, so anything not named in the literal is silently discarded no
// matter what the types promise. It compiled perfectly and lost the offseason on
// every reload, and only a real save-and-reload in the browser found it.
//
// `buildSaveFile` is tested rather than `saveDynasty` because the defect lives
// in building the record, not in writing it, and that part needs no IndexedDB.

import { describe, it, expect } from 'vitest';
import { buildSaveFile, SCHEMA_VERSION } from '../src/state/persistence.js';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';

const season = () => createSeason(makeRng(4242));

describe('the save record', () => {
  it('carries the offseason phase', () => {
    const file = buildSaveFile('s', 'Test', season(), 2027, 0, {
      phase: 'recruiting',
    }, 0);
    expect(file.phase).toBe('recruiting');
  });

  it('carries the board verdict and the season outcome', () => {
    const file = buildSaveFile('s', 'Test', season(), 2027, 0, {
      review: { verdict: 'met' },
      outcome: { wins: 20, losses: 13 },
    }, 0);
    expect((file.review as { verdict: string }).verdict).toBe('met');
    expect((file.outcome as { wins: number }).wins).toBe(20);
  });

  it('still carries everything it carried before', () => {
    const file = buildSaveFile('s', 'Test', season(), 2027, 3, {
      history: [{ year: 2026 }],
      coach: { name: 'Coach' },
      postseason: { champion: 1 },
    }, 0);
    expect(file.slot).toBe('s');
    expect(file.year).toBe(2027);
    expect(file.userTeam).toBe(3);
    expect(file.schemaVersion).toBe(SCHEMA_VERSION);
    expect(file.history).toHaveLength(1);
    expect((file.coach as { name: string }).name).toBe('Coach');
    expect(file.postseason).toBeDefined();
  });

  it("carries the winter's report, and writes nothing when there is none", () => {
    // The Draft board tab and a departed man's card read it; it lived only in
    // the store, so a career reopened mid-offseason came back without it.
    const report = {
      graduated: [], drafted: [], recruits: 0, signed: [], walkOns: [],
      developmentNet: 0, improved: 0, declined: 0, badges: [], holes: [{ pos: 'C', count: 1 }],
    };
    const file = buildSaveFile('s', 'Test', season(), 2027, 0, { lastOffseason: report }, 0);
    expect(file.lastOffseason).toEqual(report);
    const none = buildSaveFile('s', 'Test', season(), 2027, 0, { lastOffseason: null }, 0);
    expect('lastOffseason' in none).toBe(false);
  });

  it('omits an absent phase rather than writing undefined', () => {
    // In season there is no phase, and a key holding undefined is not the same
    // as no key — structured clone keeps it, and the load path reads it back as
    // a phase that exists and is nothing.
    const file = buildSaveFile('s', 'Test', season(), 2027, 0, {}, 0);
    expect('phase' in file).toBe(false);
  });

  it("writes the staff's replacement rule only when it is off", () => {
    // Absent is on, which is what every save from before the staff list says,
    // so only the coach's "no" has to reach the disk (2026-09-28).
    const off = buildSaveFile('s', 'Test', season(), 2027, 0, { replaceLost: false }, 0);
    expect(off.replaceLost).toBe(false);
    const on = buildSaveFile('s', 'Test', season(), 2027, 0, { replaceLost: true }, 0);
    expect('replaceLost' in on).toBe(false);
    const absent = buildSaveFile('s', 'Test', season(), 2027, 0, {}, 0);
    expect('replaceLost' in absent).toBe(false);
  });

  it('writes the Season plan\'s year only when there is one', () => {
    // Absent is "owed one", which is also what every save from before the
    // sheet says (2026-09-29).
    const file = buildSaveFile('s', 'Test', season(), 2027, 0, { seasonPlanYear: 2027 }, 0);
    expect(file.seasonPlanYear).toBe(2027);
    const owed = buildSaveFile('s', 'Test', season(), 2027, 0, { seasonPlanYear: null }, 0);
    expect('seasonPlanYear' in owed).toBe(false);
    const absent = buildSaveFile('s', 'Test', season(), 2027, 0, {}, 0);
    expect('seasonPlanYear' in absent).toBe(false);
  });

  it('keeps the season the engine can rebuild from', () => {
    const file = buildSaveFile('s', 'Test', season(), 2027, 0, {}, 0);
    expect(Number.isFinite(file.rngState)).toBe(true);
    expect(file.season.teams.length).toBeGreaterThan(0);
    expect(Number.isFinite(file.season.scheduleRotation)).toBe(true);
  });
});
