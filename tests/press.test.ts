// press.test.ts
// That the room asks a real question, at a sane rate, and that the answers are
// worth different amounts to different men.
//
// The last piece of stage 7, and the one with the most ways to be quietly
// wrong. Three of them are pinned here because the stage has already produced
// each of them once:
//
//   - a pool that reads well and cannot be reached (`Builder`, the title
//     nobody could wear)
//   - a number that is fixed for a save being derived from a draw, which moves
//     every number after it (the rule the wire and the play-by-play keep)
//   - a lean applied so hard it becomes a gate, or so lightly it is decoration
//     (both shipped once in the offers desk, one after the other)

import { describe, it, expect } from 'vitest';
import { PRESSERS, type PressTrigger } from '../src/data/pressers.js';
import { BADGES } from '../src/data/badges.js';
import {
  SEASON_CAP, COOLDOWN_GAMES, shouldAsk, pickPresser, settlePress, notePress, clearPress,
  type PressState,
} from '../src/engine/press.js';
import { makeRng } from '../src/engine/rng.js';

const TRIGGERS: PressTrigger[] = [
  'bigWin', 'badLoss', 'losingStreak', 'winningStreak',
  'knockedOut', 'trophy', 'signingDay', 'caughtLooking', 'draftLoss',
];

describe('the pool', () => {
  it('has a question for every trigger the season can raise', () => {
    // The Builder rule. A trigger the engine can fire with nothing to ask is a
    // press conference that opens on an empty room.
    for (const t of TRIGGERS) {
      const found = PRESSERS.filter((p) => p.trigger === t);
      expect(found.length, `nothing to ask after ${t}`).toBeGreaterThan(0);
    }
  });

  it('names only badges that exist', () => {
    const ids = new Set(BADGES.map((b) => b.id));
    for (const p of PRESSERS) {
      for (const a of p.answers) {
        if (a.badge === undefined) continue;
        expect(ids.has(a.badge), `${p.id} answers in the voice of a badge nobody can wear: ${a.badge}`)
          .toBe(true);
      }
    }
  });

  it('gives every question four answers, an ask, and a short setup', () => {
    for (const p of PRESSERS) {
      expect(p.answers.length, `${p.id} answer count`).toBe(4);
      expect(p.ask.trim().endsWith('?'), `${p.id} does not ask anything`).toBe(true);
      // The same ceiling the interview now holds, and for the same reason: the
      // setup is the room, the question is the thing.
      expect(p.setup.length, `${p.id} setup is long`).toBeLessThanOrEqual(90);
      expect(p.setup.includes(String.fromCharCode(10)), `${p.id} setup is more than one line`)
        .toBe(false);
    }
  });

  it('uses an id once', () => {
    const ids = PRESSERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never repeats an answer inside one question', () => {
    for (const p of PRESSERS) {
      const texts = p.answers.map((a) => a.text);
      expect(new Set(texts).size, `${p.id} says the same thing twice`).toBe(texts.length);
    }
  });

  it('cannot be failed, and cannot be aced', () => {
    /*
      The creation rule, one room over. Every question must offer something
      worth saying and something that costs -- a question where every answer is
      a gift has no decision in it, and one where every answer is a punishment
      is a question the player learns to dread rather than read.
    */
    for (const p of PRESSERS) {
      const totals = p.answers.map((a) => a.prestige + a.security);
      expect(Math.max(...totals), `${p.id} has nothing worth saying`).toBeGreaterThan(0);
      expect(Math.min(...totals), `${p.id} has no wrong answer at all`).toBeLessThan(
        Math.max(...totals),
      );
      // And no single answer is a landslide. A season is a personality, not a
      // score, so no one sentence may be worth more than a good week.
      for (const a of p.answers) {
        expect(Math.abs(a.prestige), `${p.id} prestige swing`).toBeLessThanOrEqual(2);
        expect(Math.abs(a.security), `${p.id} security swing`).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('when the room gets him', () => {
  it('stops at the cap', () => {
    const full: PressState = { faced: SEASON_CAP, lastAt: 0 };
    expect(shouldAsk(full, { trigger: 'bigWin', gamesPlayed: 99 })).toBe(false);
    // Including the elimination: the cap is the cap, or a bad season ends in a
    // press tour.
    expect(shouldAsk(full, { trigger: 'knockedOut', gamesPlayed: 99 })).toBe(false);
  });

  it('holds a cooldown, so one bad week is not three of these', () => {
    const just: PressState = { faced: 1, lastAt: 20 };
    expect(shouldAsk(just, { trigger: 'badLoss', gamesPlayed: 21 })).toBe(false);
    expect(shouldAsk(just, { trigger: 'badLoss', gamesPlayed: 20 + COOLDOWN_GAMES })).toBe(true);
  });

  it('lets the season ending through anyway', () => {
    // The one moment worth interrupting whatever else just happened.
    const just: PressState = { faced: 1, lastAt: 20 };
    expect(shouldAsk(just, { trigger: 'knockedOut', gamesPlayed: 21 })).toBe(true);
  });

  it('asks a first-timer', () => {
    expect(shouldAsk({}, { trigger: 'trophy', gamesPlayed: 0 })).toBe(true);
  });

  it('lands in the two or three the reporter asked for', () => {
    /*
      Measured rather than asserted from the constants, because the cap and the
      cooldown interact and only one of them is a number anybody reads.

      Retuned September 1 on the report "the press thing happens way too
      much, let us do 2 or 3 per year": cap three, cooldown twelve games. A
      plausible season with a trigger every fourth game should land two or
      three pressers, never four.
    */
    let state: PressState = clearPress();
    const rng = makeRng(7);
    let count = 0;
    for (let game = 1; game <= 45; game++) {
      if (rng() > 0.25) continue;
      const at = { trigger: 'badLoss' as PressTrigger, gamesPlayed: game };
      if (!shouldAsk(state, at)) continue;
      state = notePress(state, `x${count}`, game);
      count++;
    }
    expect(count, 'too few to be a feature').toBeGreaterThanOrEqual(2);
    expect(count, 'too many to be punctuation').toBeLessThanOrEqual(SEASON_CAP);
  });
});

describe('which question', () => {
  it('is the same for one save and different between saves', () => {
    const s: PressState = { faced: 0 };
    expect(pickPresser('bigWin', s, 4242, 2027)?.id)
      .toBe(pickPresser('bigWin', s, 4242, 2027)?.id);

    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      seen.add(pickPresser('bigWin', s, seed, 2027)?.id ?? '');
    }
    expect(seen.size, 'every world asks the same question').toBeGreaterThan(1);
  });

  it('takes no draw from any generator it is asked about', () => {
    // The rule the wire keeps. A screen that previewed the question must not
    // change every number downstream of it.
    const rng = makeRng(99);
    const before = rng.state?.();
    for (const t of TRIGGERS) pickPresser(t, { faced: 2 }, 99, 2027);
    expect(rng.state?.()).toBe(before);
  });

  it('does not ask the same one twice in a season while it has others', () => {
    let state: PressState = clearPress();
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const p = pickPresser('badLoss', state, 4242, 2027);
      expect(p).not.toBeNull();
      seen.push(p!.id);
      state = notePress(state, p!.id, i * 10);
    }
    expect(new Set(seen).size, 'repeated itself inside one season').toBe(seen.length);
  });

  it('still answers once the trigger is exhausted', () => {
    // Year three of nothing but bad losses. Repeating is better than silence.
    const all = PRESSERS.filter((p) => p.trigger === 'badLoss').map((p) => p.id);
    const spent: PressState = { faced: all.length, asked: all };
    expect(pickPresser('badLoss', spent, 4242, 2027)).not.toBeNull();
  });

  it('returns nothing for a trigger with no questions', () => {
    expect(pickPresser('nonsense' as PressTrigger, {}, 1, 2027)).toBeNull();
  });
});

describe('what the answer costs', () => {
  const withBadge = PRESSERS
    .flatMap((p) => p.answers)
    .find((a) => a.badge !== undefined && a.prestige > 0)!;

  it('pays a man for sounding like himself', () => {
    const inChar = settlePress(withBadge, [withBadge.badge!]);
    const outChar = settlePress(withBadge, []);
    expect(inChar.inCharacter).toBe(true);
    expect(outChar.inCharacter).toBe(false);
    expect(inChar.prestige).toBeGreaterThan(outChar.prestige);
  });

  it('is a lean and not a gate', () => {
    /*
      Both failures the offers desk shipped, held from either side. Weighted
      hard, the badges decide the answer and the player is reading a table
      rather than choosing what he would say. Weighted lightly, they are
      decoration and the interview bought nothing.
    */
    let bigger = 0;
    let same = 0;
    for (const p of PRESSERS) {
      for (const a of p.answers) {
        if (a.badge === undefined) continue;
        const on = settlePress(a, [a.badge]);
        const off = settlePress(a, []);
        const gap = (on.prestige + on.security) - (off.prestige + off.security);
        expect(gap, 'wearing the badge went backwards').toBeGreaterThanOrEqual(0);
        expect(gap, 'the badge decided the answer on its own').toBeLessThanOrEqual(2);
        if (gap > 0) bigger++; else same++;
      }
    }
    expect(bigger, 'the badges never changed anything').toBeGreaterThan(same);
  });

  it('leaves an answer that names no badge worth exactly what it says', () => {
    const plain = PRESSERS.flatMap((p) => p.answers).find((a) => a.badge === undefined)!;
    const r = settlePress(plain, ['players', 'gambler']);
    expect(r.prestige).toBe(plain.prestige);
    expect(r.security).toBe(plain.security);
    expect(r.inCharacter).toBe(false);
  });

  it('keeps a bad answer bad however in character it is', () => {
    // A man known for saying the unhelpful thing is still saying it. The lean
    // must not turn a cost into a reward, or the whole board becomes free.
    for (const p of PRESSERS) {
      for (const a of p.answers) {
        if (a.badge === undefined || a.prestige >= 0) continue;
        expect(settlePress(a, [a.badge]).prestige, `${p.id} made a bad answer free`)
          .toBeLessThan(0);
      }
    }
  });
});

describe('the season state', () => {
  it('counts up and remembers what was asked', () => {
    let s = clearPress();
    s = notePress(s, 'a', 10);
    s = notePress(s, 'b', 20);
    expect(s.faced).toBe(2);
    expect(s.lastAt).toBe(20);
    expect(s.asked).toEqual(['a', 'b']);
  });

  it('starts clean at the year roll', () => {
    expect(clearPress().faced).toBe(0);
    expect(clearPress().asked).toEqual([]);
  });

  it('works from a save that predates it', () => {
    // Sparse on purpose: an absent field is a coach who has never been asked,
    // not a crash on the first big win of a resumed dynasty.
    expect(shouldAsk({}, { trigger: 'bigWin', gamesPlayed: 3 })).toBe(true);
    expect(notePress({}, 'a', 1).faced).toBe(1);
  });
});
