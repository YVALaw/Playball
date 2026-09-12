// pro-career.test.ts
// What happens to a man after June, and how often it is remarkable.
//
// Reported: *"the alumni, I've noticed that many of them end up becoming all
// stars in the majors, we have to adjust and expand what they are actually up
// to in the majors cause not that many people end up being all stars."*
//
// Both halves were true and the cause was one line. `proCareer` reads four
// independent per-year answers out of four byte ranges of a single hash, and
// the hash was `h = h * 31 + c` — a polynomial hash whose high bits barely move
// when ":pro:2031" becomes ":pro:2032". Measured over 300 men and 20 seasons,
// distinct values a man saw in his whole career, out of twenty:
//
//   washPct   h % 100        20.0     nobody frozen
//   movePct   (h >> 8) % 100  1.2     226 of 300 frozen for life
//   allStar   (h >> 16) % 100 1.0     300 of 300 frozen for life
//   retire    (h >> 24) % 100 1.0     300 of 300 frozen for life
//
// So three of the four rolls were not rolls. A man was stamped once: an
// All-Star every single summer or never one — 39 men in 400 were All-Stars in
// all twenty seasons and the other 361 in none — and promoted every year he was
// eligible or never. Nobody spent three years at Double-A and then got the call.
//
// Fixed with FNV-1a and an avalanche finalizer, masked to thirty-one bits
// because the callers read it with a signed shift. Then the All-Star chance was
// made to read `talent`, which every other roll in the career already did, and
// the promotion rate re-tuned because its old value had been set against a
// ladder whose rungs were not being climbed.

import { describe, it, expect } from 'vitest';
import { createSeason, simSeason, seasonComplete } from '../src/engine/season.js';
import {
  draftContext, visibleValue, draftRound, draftEligible, DRAFT_ROUNDS, PICKS_PER_ROUND,
} from '../src/engine/draft.js';
import { proCareer, type AlumnusNote } from '../src/engine/legacy.js';
import { overallOf, armValue } from '../src/engine/ratings.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import type { Player, Arm } from '../src/engine/types.js';

const ratingOf = (p: Player): number =>
  (p.type === 'hitter' ? overallOf(p) : armValue(p as unknown as Arm));
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** The engine's own draft class, not a synthetic one — the talent it really deals. */
const season = createSeason(makeRng(4242), undefined, CONFERENCES);
season.year = 2027;
while (!seasonComplete(season)) simSeason(season);
const ctx = draftContext(season);
const pool: { p: Player; value: number }[] = [];
for (const t of season.teams) {
  for (const p of [
    ...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen,
  ] as Player[]) {
    if (draftEligible(p)) pool.push({ p, value: visibleValue(p, season, ctx) });
  }
}
pool.sort((a, b) => b.value - a.value);

const THROUGH = 2027 + 32;
interface Life { round: number; show: number; stars: number; lines: string[] }
const lives: Life[] = pool.slice(0, DRAFT_ROUNDS * PICKS_PER_ROUND).map(({ p, value }) => {
  const round = draftRound(value);
  const note = {
    year: 2027, reason: 'drafted', round, overall: ratingOf(p),
    classYear: p.classYear ?? 'SR', name: p.name, teamAbbr: 'AAA',
  } as AlumnusNote;
  const rows = proCareer(String(p.id), note, THROUGH);
  return {
    round,
    show: rows.filter((r) => r.level === 'THE SHOW').length,
    stars: rows.filter((r) => r.line.includes('All-Star')).length,
    lines: rows.map((r) => r.line),
  };
});
const reached = lives.filter((l) => l.show > 0);
const starred = lives.filter((l) => l.stars > 0);

describe('a drafted man', () => {
  it('reaches the top level about as often as one really does', () => {
    // 16.3% measured, against a real-world sixteen or so. It was 39% while the
    // promotion roll was frozen.
    const share = reached.length / lives.length;
    expect(share, `${(100 * share).toFixed(1)}% reached the show`).toBeGreaterThan(0.10);
    expect(share, `${(100 * share).toFixed(1)}% reached the show`).toBeLessThan(0.24);
  });

  it('is rarely an All-Star, and never one for his whole career', () => {
    /*
      The report, in two assertions. The first is the rate: about one man in
      nine who reaches the top level makes an All-Star team, which is roughly
      what the real game does.

      The second is the one that actually caused the complaint. A frozen roll
      gave the men who had any 4.9 All-Star summers out of 6.9 seasons — 71% of
      a career. It is 1.18 now, so an All-Star summer is a year somebody had
      rather than a label somebody wears.
    */
    const rate = starred.length / Math.max(1, reached.length);
    expect(rate, `${(100 * rate).toFixed(1)}% of big-leaguers were All-Stars`).toBeLessThan(0.20);
    expect(rate).toBeGreaterThan(0.03);
    expect(mean(starred.map((l) => l.stars))).toBeLessThan(2.2);
    for (const l of starred) {
      expect(l.stars / l.show, 'an entire career of All-Star summers').toBeLessThan(0.85);
    }
  });

  it('is likelier to be one the earlier he went', () => {
    // It read nothing about the man before. Now it reads `talent`, like every
    // other roll in the career does.
    const rateFor = (lo: number, hi: number) => {
      const set = reached.filter((l) => l.round >= lo && l.round <= hi);
      return set.length < 5 ? null : set.filter((l) => l.stars > 0).length / set.length;
    };
    const early = rateFor(1, 5);
    const late = rateFor(11, 20);
    expect(early).not.toBeNull();
    expect(late).not.toBeNull();
    expect(early!, `early ${early} vs late ${late}`).toBeGreaterThan(late!);
  });

  it('has a summer described for what it was', () => {
    /*
      "A full season in the big leagues" said the same thing about a
      first-division regular and a man carried as a twenty-sixth arm. The
      vocabulary now separates the everyday player, the part-timer, the man
      hanging on, the season lost to injury, and the two awards worth framing.
    */
    const all = lives.flatMap((l) => l.lines);
    const distinct = new Set(all).size;
    expect(distinct, 'the professional career has too few things to say').toBeGreaterThan(20);
    for (const phrase of [
      'everyday player', 'part-time role', 'training room', 'Repeated',
    ]) {
      expect(all.some((l) => l.includes(phrase)), `nobody ever: ${phrase}`).toBe(true);
    }
  });

  it('does not spend every minor-league year being promoted', () => {
    // 226 of 300 men had a frozen promotion roll, so a career was a straight
    // climb or a straight stall. Somebody has to repeat a level.
    const repeats = lives.filter((l) => l.lines.some((x) => x.startsWith('Repeated'))).length;
    expect(repeats / lives.length).toBeGreaterThan(0.10);
  });

  it('stays deterministic — the same man always lives the same life', () => {
    const { p, value } = pool[0]!;
    const note = {
      year: 2027, reason: 'drafted', round: draftRound(value), overall: ratingOf(p),
      classYear: p.classYear ?? 'SR', name: p.name, teamAbbr: 'AAA',
    } as AlumnusNote;
    const a = proCareer(String(p.id), note, THROUGH).map((r) => r.line).join('|');
    const b = proCareer(String(p.id), note, THROUGH).map((r) => r.line).join('|');
    expect(a).toBe(b);
  });
});
