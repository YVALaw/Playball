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

  it('omits an absent phase rather than writing undefined', () => {
    // In season there is no phase, and a key holding undefined is not the same
    // as no key — structured clone keeps it, and the load path reads it back as
    // a phase that exists and is nothing.
    const file = buildSaveFile('s', 'Test', season(), 2027, 0, {}, 0);
    expect('phase' in file).toBe(false);
  });

  it('keeps the season the engine can rebuild from', () => {
    const file = buildSaveFile('s', 'Test', season(), 2027, 0, {}, 0);
    expect(Number.isFinite(file.rngState)).toBe(true);
    expect(file.season.teams.length).toBeGreaterThan(0);
    expect(Number.isFinite(file.season.scheduleRotation)).toBe(true);
  });
});
