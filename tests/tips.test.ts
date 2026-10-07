// tips.test.ts
// The first-visit cards (src/ui/tutorials.ts): one per screen, short, and
// every screen that asks for one has one. The guided tour is gone (2026-10-07);
// these cards are all the teaching the app does.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { TUTORIALS } from '../src/ui/tutorials.js';

const sources = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? sources(p) : /\.tsx?$/.test(f) ? [p] : [];
});
const asked = new Set<string>();
for (const file of sources('src/ui')) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/<FirstVisit id="([^"]+)"/g)) asked.add(m[1]!);
  for (const m of text.matchAll(/<FirstVisit id=\{[^}]*\}/g)) {
    for (const q of m[0].matchAll(/'([^']+)'/g)) asked.add(q[1]!);
  }
}
const words = (s: string): number => s.trim().split(/\s+/).length;

describe('the first-visit cards', () => {
  it('cover every screen that shows one, and nothing else', () => {
    expect(asked.size).toBeGreaterThan(20);
    for (const id of asked) expect(TUTORIALS[id], id).toBeDefined();
    for (const id of Object.keys(TUTORIALS)) expect(asked.has(id), `${id} is never shown`).toBe(true);
  });

  it('are brief: a short line and one action', () => {
    for (const [id, card] of Object.entries(TUTORIALS)) {
      expect(words(card.title), id).toBeLessThanOrEqual(3);
      expect(words(card.body), id).toBeLessThanOrEqual(18);
      expect(words(card.action), id).toBeLessThanOrEqual(14);
    }
  });

  it('never mention the tour', () => {
    for (const card of Object.values(TUTORIALS)) {
      expect(`${card.title} ${card.body} ${card.action}`).not.toMatch(/\btour\b/i);
    }
  });

  it('the tour itself is gone', () => {
    expect(existsSync('src/ui/GuidedStretch.tsx')).toBe(false);
    expect(existsSync('src/ui/guide.ts')).toBe(false);
  });
});
