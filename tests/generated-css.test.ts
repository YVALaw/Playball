// generated-css.test.ts
// src/ui/prototype.css is generated from the design source and must stay so.
//
// Two passes wrote into it by hand — a board room, a tab, a drag handle — and
// the next regeneration would have wiped all of it without a word. Those
// rules live in prototype-frame.css now, and this is the check that keeps
// the next hand out of the generated file.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('the generated stylesheet', () => {
  it('matches what its source generates', () => {
    const out = execFileSync(
      process.execPath, ['scripts/adapt-prototype-css.mjs', '--check'], { encoding: 'utf8' },
    );
    expect(out).toContain('matches its source');
  });
});
