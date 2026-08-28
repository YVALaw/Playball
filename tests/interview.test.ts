// interview.test.ts
// That the questions describe a man, and that none of them can ruin him.
//
// The interview's whole promise is that it cannot be failed: every answer
// changes *which* programmes want you, never whether any of them do. These
// tests are what stop a well-meant balance tweak from quietly making one answer
// the correct one.

import { describe, it, expect } from 'vitest';
import { INTERVIEW } from '../src/data/interview.js';
import { BADGES, MAX_BADGES } from '../src/data/badges.js';
import { drawQuestions, settle, ASKED, ASKED_CASUAL } from '../src/engine/interviewResult.js';
import { makeRng } from '../src/engine/rng.js';
import type { CoachSkills } from '../src/engine/program.js';

const BASE: CoachSkills = { offense: 40, defense: 40, training: 40, recruiting: 40 };
const SKILLS = ['offense', 'defense', 'training', 'recruiting'] as const;

describe('the pool', () => {
  it('is big enough that two careers rarely overlap', () => {
    /*
      The number that decides whether a fifth dynasty feels fresh.

      Five drawn from eighty means two careers share about one question. Drop
      the pool to forty and they share two of five, which is noticeable by a
      third dynasty — so this is not a stylistic preference, it is the reason
      the writing was worth doing, and it is worth failing a build over.
    */
    expect(INTERVIEW.length).toBeGreaterThanOrEqual(80);
  });

  it('never repeats a setup or an answer across the whole pool', () => {
    // Eighty questions written in batches is exactly the condition under which
    // the same good line gets used twice without anybody noticing.
    const setups = INTERVIEW.map((q) => q.setup);
    expect(new Set(setups).size, 'two questions share a setup').toBe(setups.length);
    const asks = INTERVIEW.flatMap((q) => q.answers.map((a) => a.text));
    const dupes = asks.filter((t, i) => asks.indexOf(t) !== i);
    expect([...new Set(dupes)], 'an answer is used twice').toEqual([]);
  });

  it('gives every question four answers and a question mark', () => {
    for (const q of INTERVIEW) {
      expect(q.answers.length, `${q.id} answer count`).toBe(4);
      expect(q.ask.trim().endsWith('?'), `${q.id} does not ask anything`).toBe(true);
      expect(q.setup.length, `${q.id} setup`).toBeGreaterThan(30);
    }
  });

  it('uses an id once', () => {
    const ids = INTERVIEW.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never writes the same answer twice inside one question', () => {
    for (const q of INTERVIEW) {
      const texts = q.answers.map((a) => a.text);
      expect(new Set(texts).size, `${q.id} repeats itself`).toBe(texts.length);
    }
  });

  it('moves every answer by the same amount', () => {
    /*
      Net +2, negatives allowed.

      This is the rule that keeps the interview a character question rather than
      an optimisation. If one answer were worth +3 and another +1, there would
      be a correct answer, and the whole thing would collapse into picking it.
      A trade-off is fine — +3 recruiting and −1 training is still +2 — and it
      is what makes an answer feel like it cost something.
    */
    for (const q of INTERVIEW) {
      for (const a of q.answers) {
        const net = SKILLS.reduce((sum, k) => sum + (a.skills[k] ?? 0), 0);
        expect(net, `${q.id}: "${a.text.slice(0, 30)}…"`).toBe(2);
      }
    }
  });

  it('votes only for badges that exist, and only interview ones', () => {
    const ids = new Set(BADGES.filter((b) => b.source === 'interview').map((b) => b.id));
    for (const q of INTERVIEW) {
      for (const a of q.answers) {
        if (!a.badge) continue;
        expect(ids.has(a.badge), `${q.id} votes for unknown badge ${a.badge}`).toBe(true);
      }
    }
  });

  it('offers a real choice on every question', () => {
    // Four answers that all lean the same way is a question with one answer.
    for (const q of INTERVIEW) {
      const shapes = q.answers.map((a) => JSON.stringify(a.skills));
      expect(new Set(shapes).size, `${q.id} has interchangeable answers`)
        .toBeGreaterThan(1);
    }
  });
});

describe('the draw', () => {
  it('draws widely across the pool rather than favouring the front', () => {
    // A shuffle bug that only ever reached the first dozen would pass every
    // other test in this file and quietly halve the variety.
    const seen = new Set<string>();
    for (let s = 0; s < 200; s++) {
      for (const q of drawQuestions(makeRng(s))) seen.add(q.id);
    }
    expect(seen.size, 'the draw never reaches part of the pool')
      .toBeGreaterThan(INTERVIEW.length * 0.8);
  });

  it('asks five, without asking one twice', () => {
    const q = drawQuestions(makeRng(11), ASKED);
    expect(q.length).toBe(Math.min(ASKED, INTERVIEW.length));
    expect(new Set(q.map((x) => x.id)).size).toBe(q.length);
  });

  it('asks two in casual', () => {
    const q = drawQuestions(makeRng(11), ASKED_CASUAL);
    expect(q.length).toBe(ASKED_CASUAL);
  });

  it('is the same interview on the same seed, and a different one otherwise', () => {
    const a = drawQuestions(makeRng(4242)).map((q) => q.id);
    const b = drawQuestions(makeRng(4242)).map((q) => q.id);
    expect(a).toEqual(b);

    // Not a guarantee for any single pair, so this asks across many seeds that
    // the draw is actually moving rather than that two specific worlds differ.
    const seen = new Set<string>();
    for (let s = 0; s < 40; s++) seen.add(drawQuestions(makeRng(s)).map((q) => q.id).join());
    expect(seen.size, 'the draw barely moves').toBeGreaterThan(10);
  });
});

describe('what five answers add up to', () => {
  it('cannot be failed: every path leaves a coach standing', () => {
    /*
      The promise, tested exhaustively rather than by sampling.

      Every combination of one answer from each of the first five questions —
      four to the fifth, so over a thousand coaches — and none of them may end
      with a negative skill, no badges, or a skill total that differs from
      anybody else's.
    */
    const qs = INTERVIEW.slice(0, 5);
    let checked = 0;
    const walk = (i: number, picked: typeof qs[number]['answers'][number][]): void => {
      if (i === qs.length) {
        const out = settle(picked, BASE);
        for (const k of SKILLS) {
          expect(out.skills[k], 'a coach came out negative').toBeGreaterThanOrEqual(0);
        }
        const total = SKILLS.reduce((s, k) => s + out.skills[k], 0);
        const baseTotal = SKILLS.reduce((s, k) => s + BASE[k], 0);
        expect(total, 'one path is worth more than another')
          .toBe(baseTotal + 2 * qs.length);
        expect(out.badges.length, 'a coach left with no identity').toBeGreaterThan(0);
        expect(out.badges.length).toBeLessThanOrEqual(2);
        checked++;
        return;
      }
      for (const a of qs[i]!.answers) walk(i + 1, [...picked, a]);
    };
    walk(0, []);
    expect(checked).toBe(4 ** qs.length);
  });

  it('wears at most two, and never more than the card holds', () => {
    const qs = INTERVIEW.slice(0, 5);
    const out = settle(qs.map((q) => q.answers[0]!), BASE);
    expect(out.badges.length).toBeLessThanOrEqual(2);
    expect(out.badges.length).toBeLessThanOrEqual(MAX_BADGES);
  });

  it('describes a man who answered consistently', () => {
    // Five answers that all lean the same way should produce somebody obviously
    // one thing — that is the whole point of a vote rather than an award.
    const developer = INTERVIEW
      .flatMap((q) => q.answers)
      .filter((a) => a.badge === 'developer')
      .slice(0, 3);
    expect(developer.length).toBeGreaterThan(1);
    const out = settle(developer, BASE);
    expect(out.badges[0]).toBe('developer');
    expect(out.leans.development ?? 0).toBeGreaterThan(0);
  });

  it('adds the leanings up rather than replacing them', () => {
    const picked = INTERVIEW.slice(0, 3).map((q) => q.answers[1]!);
    const out = settle(picked, BASE);
    const total = Object.values(out.leans).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
  });
});
