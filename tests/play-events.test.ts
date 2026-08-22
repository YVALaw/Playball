// play-events.test.ts
// The engine to presentation boundary.
//
// The field layer will animate from this stream and nothing else, so it has to
// agree with the box score exactly. If runs in the event stream ever diverge
// from runs on the scoreboard, the 3D view starts lying to the player.

import { describe, it, expect } from 'vitest';
import { newTeams } from '../src/engine/calibration.js';
import { simGame } from '../src/engine/game.js';
import type { PlayEvent } from '../src/engine/types.js';

const sum = (events: readonly PlayEvent[], kind: PlayEvent['kind'], field: 'runs' | 'outs'): number =>
  events.filter((e) => e.kind === kind).reduce((acc, e) => acc + (e[field] ?? 0), 0);

describe('play events', () => {
  it('emits nothing unless asked', () => {
    const { rng, a, b } = newTeams(11);
    const r = simGame(a, b, rng, {});
    expect(r.playEvents).toEqual([]);
  });

  it('agrees with the scoreboard on runs', () => {
    for (const seed of [11, 202, 3003]) {
      const { rng, a, b } = newTeams(seed);
      const r = simGame(a, b, rng, { playEvents: true });
      expect(sum(r.playEvents, 'score', 'runs')).toBe(r.home.runs + r.away.runs);
    }
  });

  it('records three outs for every half inning played', () => {
    for (const seed of [11, 202, 3003]) {
      const { rng, a, b } = newTeams(seed);
      const r = simGame(a, b, rng, { playEvents: true });
      const outs = sum(r.playEvents, 'out', 'outs');
      // A half inning ends at three outs, except a walk-off, which stops early.
      const halves = r.home.lineScore.length + r.away.lineScore.length;
      expect(outs).toBeLessThanOrEqual(halves * 3);
      expect(outs).toBeGreaterThanOrEqual(halves * 3 - 3);
    }
  });

  it('emits one pitch event per pitch thrown', () => {
    const { rng, a, b } = newTeams(11);
    const r = simGame(a, b, rng, { playEvents: true });
    const thrown = [...r.home.pitching.values(), ...r.away.pitching.values()]
      .reduce((acc, line) => acc + line.pitches, 0);
    expect(r.playEvents.filter((e) => e.kind === 'pitch')).toHaveLength(thrown);
  });

  it('describes only legal base movement', () => {
    const { rng, a, b } = newTeams(11);
    const r = simGame(a, b, rng, { playEvents: true });
    let moves = 0;
    for (const e of r.playEvents) {
      if (e.kind !== 'advance') continue;
      for (const m of e.runners ?? []) {
        moves++;
        expect(m.to).toBeGreaterThan(m.from);        // nobody runs backwards
        expect(m.from).toBeGreaterThanOrEqual(0);
        expect(m.to).toBeLessThanOrEqual(4);
        expect(m.id).toBeTruthy();
      }
    }
    expect(moves).toBeGreaterThan(0);
  });

  it('names a batted ball type on every contact event', () => {
    const { rng, a, b } = newTeams(11);
    const r = simGame(a, b, rng, { playEvents: true });
    const contacts = r.playEvents.filter((e) => e.kind === 'contact');
    expect(contacts.length).toBeGreaterThan(0);
    for (const e of contacts) {
      expect(['ground', 'line', 'fly', 'popup']).toContain(e.battedBall);
    }
  });

  it('costs nothing when switched off', () => {
    // Same seed, same game, with and without the stream. The events must be a
    // pure observation: turning them on cannot change what happened.
    const withOff = newTeams(4242);
    const off = simGame(withOff.a, withOff.b, withOff.rng, {});
    const withOn = newTeams(4242);
    const on = simGame(withOn.a, withOn.b, withOn.rng, { playEvents: true });

    expect(on.home.runs).toBe(off.home.runs);
    expect(on.away.runs).toBe(off.away.runs);
    expect(on.innings).toBe(off.innings);
  });
});

describe('landing coordinates', () => {
  it('reports where the ball went, inside the fair field', () => {
    const landed: PlayEvent[] = [];
    for (const seed of [11, 202, 3003, 44, 555]) {
      const { rng, a, b } = newTeams(seed);
      for (let i = 0; i < 8; i++) {
        const r = simGame(a, b, rng, { playEvents: true });
        landed.push(...r.playEvents.filter((e) => e.kind === 'contact' && e.landing));
      }
    }
    expect(landed.length).toBeGreaterThan(200);

    for (const e of landed) {
      const { x, y } = e.landing as { x: number; y: number };
      expect(Math.abs(x)).toBeLessThanOrEqual(1);      // inside the foul lines
      expect(y).toBeGreaterThanOrEqual(0);             // never behind the plate
      expect(y).toBeLessThanOrEqual(1.1);              // only a homer clears the wall
    }

    // Sprayed around the field rather than all landing on one spot.
    const left = landed.filter((e) => (e.landing as { x: number }).x < -0.2).length;
    const right = landed.filter((e) => (e.landing as { x: number }).x > 0.2).length;
    expect(left).toBeGreaterThan(10);
    expect(right).toBeGreaterThan(10);
  });

  it('is reproducible, because it takes no draws of its own', () => {
    // The rule the whole event stream rests on: asking to watch a game must not
    // change the game. A landing scattered with rng() broke exactly this — the
    // same seed played out differently depending on whether anybody was looking.
    const play = (withEvents: boolean) => {
      let runs = 0;
      for (const seed of [11, 202, 3003]) {
        const { rng, a, b } = newTeams(seed);
        for (let i = 0; i < 6; i++) {
          const r = simGame(a, b, rng, withEvents ? { playEvents: true } : {});
          runs += r.home.runs + r.away.runs;
        }
      }
      return runs;
    };
    expect(play(true)).toBe(play(false));
  });
});

describe('where the ball lands', () => {
  it('is always in fair territory', () => {
    // Fair territory is the wedge |x| <= y: the lines meet at home and reach
    // ±1 at the wall. The corner infielders used to stand at ±0.40 with the
    // bags at 0.26, so every ground ball to first or third was drawn outside
    // the chalk — reported from testing as "the ball goes over the lines, it
    // makes it look foul even when it is a hit".
    let seen = 0;
    for (const seed of [11, 202, 3003, 40404, 5]) {
      const { rng, a, b } = newTeams(seed);
      const r = simGame(a, b, rng, { playEvents: true });
      for (const e of r.playEvents) {
        if (e.kind !== 'contact' || !e.landing) continue;
        seen += 1;
        const { x, y } = e.landing;
        expect(Math.abs(x)).toBeLessThanOrEqual(y + 1e-9);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1.1);
      }
    }
    // Five games of batted balls, or the assertion above proved nothing.
    expect(seen).toBeGreaterThan(100);
  });

  it('puts a ball fielded at the corners near the line, not past it', () => {
    // A grounder to third should hug the chalk. If the clamp were doing its job
    // by flattening everything to the middle of the field the test above would
    // still pass and the picture would be wrong.
    let nearLine = 0;
    for (const seed of [11, 202, 3003, 40404, 5]) {
      const { rng, a, b } = newTeams(seed);
      const r = simGame(a, b, rng, { playEvents: true });
      for (const e of r.playEvents) {
        if (e.kind !== 'contact' || !e.landing) continue;
        const { x, y } = e.landing;
        if (y > 0.5) continue;                       // infield only
        if (Math.abs(x) > 0.6 * y) nearLine += 1;
      }
    }
    expect(nearLine).toBeGreaterThan(0);
  });
});
