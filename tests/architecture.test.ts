// architecture.test.ts
// The one architectural rule, enforced so it cannot rot.
//
// Nothing in src/engine may import from src/ui, src/state, or src/field, and it
// may not touch the DOM. That separation is what keeps the engine testable
// headless, lets ten thousand games sim from the command line, and lets the
// front end be replaced without touching the simulation. It is easy to violate
// by accident and expensive to unpick later.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ENGINE_DIR = join(import.meta.dirname, '..', 'src', 'engine');

const FORBIDDEN_IMPORTS = [
  { pattern: /from\s+['"][^'"]*\/(ui|state|field)\//, what: 'a UI, state, or field module' },
  { pattern: /from\s+['"](react|three|@react-three|zustand|idb)['"]/, what: 'a front end package' },
];

const FORBIDDEN_GLOBALS = [
  { pattern: /\bdocument\./, what: 'the DOM' },
  { pattern: /\bwindow\./, what: 'the window object' },
  { pattern: /\blocalStorage\b/, what: 'localStorage' },
];

/**
 * Strip comments and string literals before looking for forbidden globals.
 *
 * The guard is about what the engine *does*, not what it says. Checking raw
 * source failed a file whose prose happened to end a sentence with the word
 * "window." — a real false positive, and the kind that trains people to edit
 * their comments to appease a test rather than trusting it.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')     // block comments, JSDoc included
    .replace(/\/\/[^\n]*/g, ' ')           // line comments
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''") // single quoted strings
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""') // double quoted strings
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');  // template literals
}

function engineFiles(): string[] {
  return readdirSync(ENGINE_DIR).filter((f) => f.endsWith('.ts'));
}

describe('engine isolation', () => {
  it('has engine files to check', () => {
    expect(engineFiles().length).toBeGreaterThan(0);
  });

  for (const file of engineFiles()) {
    const source = readFileSync(join(ENGINE_DIR, file), 'utf8');

    it(`${file} imports nothing from the front end`, () => {
      for (const { pattern, what } of FORBIDDEN_IMPORTS) {
        expect(
          pattern.test(source),
          `src/engine/${file} imports ${what}. The engine must stay pure.`,
        ).toBe(false);
      }
    });

    it(`${file} does not touch browser globals`, () => {
      const body = code(source);
      for (const { pattern, what } of FORBIDDEN_GLOBALS) {
        expect(
          pattern.test(body),
          `src/engine/${file} references ${what}. The engine must run headless.`,
        ).toBe(false);
      }
    });
  }
});

describe('determinism hygiene', () => {
  // A seeded engine that reaches for Math.random or the clock is not seeded.
  // Saves store the seed and replay from it; one stray call breaks that.
  for (const file of engineFiles()) {
    const source = readFileSync(join(ENGINE_DIR, file), 'utf8');

    it(`${file} uses no unseeded randomness or wall clock`, () => {
      expect(
        /Math\.random\s*\(/.test(source),
        `src/engine/${file} calls Math.random. Use the seeded Rng instead.`,
      ).toBe(false);
      expect(
        /\bDate\.now\s*\(|new Date\s*\(/.test(source),
        `src/engine/${file} reads the clock. That breaks seeded replay.`,
      ).toBe(false);
    });
  }
});
