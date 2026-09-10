// needs-depth.test.ts
// The second tier of need: a starter with nobody who naturally covers him.
//
// Asked for on 2026-09-10: "the needs should still count the positions that
// don't have a backup as needs." `walkOnShortfall` says where nobody can
// start; `depthShortfall` says where the roster is one injury from a stretch,
// read off the cover matrix in positions.ts.

import { describe, it, expect } from 'vitest';
import { depthShortfall, walkOnShortfall } from '../src/engine/progression.js';
import { coverTier } from '../src/engine/positions.js';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import type { Player, Position, Team } from '../src/engine/types.js';

const fresh = (): Team => createSeason(makeRng(4242), undefined, CONFERENCES).teams[11]!.team;
const everybody = (t: Team): Player[] => [...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen];

describe('the second tier of need', () => {
  it('names a spot with exactly one man who can play it', () => {
    const t = fresh();
    for (const row of depthShortfall(everybody(t), [])) {
      if (row.pos === 'SP') continue;
      const able = [...t.lineup, ...t.bench]
        .filter((h) => coverTier(h, row.pos as Position) <= 1);
      expect(able, `${row.pos} was called thin with ${able.length} able`).toHaveLength(1);
    }
  });

  it('leaves a spot nobody can play to the open list', () => {
    const t = fresh();
    // No catcher anywhere: the plate is an open hole, not a thin one.
    t.bench.splice(0, t.bench.length);
    const at = t.lineup.findIndex((p) => p.pos === 'C');
    t.lineup.splice(at, 1);
    const men = everybody(t);
    expect(walkOnShortfall(men, []).some((r) => r.pos === 'C')).toBe(true);
    expect(depthShortfall(men, []).some((r) => r.pos === 'C')).toBe(false);
  });

  it('calls the plate thin with one catcher, and clears it when a second signs', () => {
    const t = fresh();
    t.bench.splice(0, t.bench.length);
    const men = everybody(t);
    // Nobody but a catcher covers the plate, so a lone catcher is always thin.
    expect(depthShortfall(men, []).some((r) => r.pos === 'C')).toBe(true);
    const c = t.lineup.find((p) => p.pos === 'C')!;
    const backup = { ...c, id: 'backup-c' } as Player;
    expect(depthShortfall(men, [backup]).some((r) => r.pos === 'C')).toBe(false);
  });

  it('calls the rotation thin without a fifth starter', () => {
    const t = fresh();
    const starters = everybody(t).filter((p) => (p as { role?: string }).role === 'SP').length;
    const thin = depthShortfall(everybody(t), []).some((r) => r.pos === 'SP');
    expect(thin).toBe(starters === 4);
  });
});
