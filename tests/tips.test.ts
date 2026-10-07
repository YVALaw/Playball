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

  // Short enough to read in one go, but whole: the one-line cards read as cut
  // off mid-thought (2026-10-07 playtest), so a card may take a few points.
  it('are brief, but say it whole', () => {
    for (const [id, card] of Object.entries(TUTORIALS)) {
      const points = card.points ?? [];
      expect(words(card.title), id).toBeLessThanOrEqual(3);
      expect(words(card.body), id).toBeLessThanOrEqual(30);
      expect(points.length, id).toBeLessThanOrEqual(4);
      for (const line of points) expect(words(line), `${id}: ${line}`).toBeLessThanOrEqual(30);
      expect(words(card.action), id).toBeLessThanOrEqual(22);
      const total = words(card.body) + points.reduce((n, line) => n + words(line), 0) + words(card.action);
      expect(total, id).toBeLessThanOrEqual(120);
    }
  });

  it('are made of full sentences, none cut off', () => {
    for (const [id, card] of Object.entries(TUTORIALS)) {
      for (const line of [card.body, ...(card.points ?? []), card.action]) {
        expect(line, id).toMatch(/^[A-Z0-9’'“]/);
        expect(line, id).toMatch(/[.!?]$/);
        expect(line, id).not.toMatch(/…|\.\.\./);
      }
    }
  });

  // Every control a card names is one a screen shows, so a card can never
  // teach a label the app does not have.
  const LABELS = [
    'To do', 'Play ball', 'Sim game', 'Sim week', 'Settle the list', 'Injured', 'Draft risk', 'Unhappy',
    'Bench', 'Cover the positions', 'Auto lineup', 'What you handle', 'Lineups', 'Rotation and bullpen',
    'Your team', 'National', 'Fielding', 'Postseason', 'Required', 'Bonus', 'Trophy case', 'Hall of Fame',
    'Record by season', 'What the rest can buy', 'Hitting Barn', 'Pitching Lab', 'Clubhouse', 'Focus',
    'Season work', 'Overview', 'Skills', 'Career', 'Trophies', 'Dugout', 'Bench coach', 'Take over',
    'Games to watch', 'Bracket', 'Find my team', 'Turn them all', 'Let him sign', 'Make your pitch',
    'Waiting on you', 'Leaving you', 'Available', 'Effort', 'Your targets', 'Committed', 'Positions needed',
    'Filter', 'Staff list', 'Use these', 'Class rankings', 'Start next season',
  ];
  it('name only labels the screens show', () => {
    const screens = sources('src/ui').filter((f) => !f.endsWith('tutorials.ts'))
      .map((f) => readFileSync(f, 'utf8')).join('\n').replace(/[’']/g, "'");
    const cards = Object.values(TUTORIALS)
      .map((c) => [c.body, ...(c.points ?? []), c.action].join(' ')).join(' ');
    for (const label of LABELS) {
      expect(screens, label).toContain(label);
      expect(cards, `${label} is in no card`).toContain(label);
    }
  });

  it('the Lineup card teaches the field at the top, and Pitching has a card of its own', () => {
    expect(TUTORIALS['lineup']!.points!.join(' ')).toMatch(/field at the top/);
    expect(TUTORIALS['lineup-pitching']!.points!.join(' ')).toMatch(/starter and a reliever/);
    const lineup = readFileSync('src/ui/screens/Lineup.tsx', 'utf8');
    expect(lineup).toContain("const onPitching = view === 'pitch';");
    expect(lineup).toMatch(/onPitching \? \(arms \? 'lineup-pitching' : 'lineup-pitching-staff'\)/);
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
