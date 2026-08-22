// replay.test.ts
// The replay aligns two independently produced streams — the text log and the
// PlayEvent list — by assuming plate appearances line up between them. That
// assumption is exactly the kind that holds until it silently does not, so it
// gets checked against the game the engine actually played.

import { describe, it, expect } from 'vitest';
import { makeRng } from '../src/engine/rng.js';
import { makeTeam, resetNames } from '../src/engine/players.js';
import { simGame } from '../src/engine/game.js';
import { buildFrames } from '../src/ui/replay.js';

function watched(seed: number) {
  resetNames();
  const rng = makeRng(seed);
  const home = makeTeam(rng, 'Home', 52);
  const away = makeTeam(rng, 'Away', 50);
  return simGame(home, away, rng, { verbose: true, playEvents: true });
}

describe('game replay', () => {
  const seeds = [11, 404, 2027, 90210];

  it('produces frames for every logged line', () => {
    for (const seed of seeds) {
      const result = watched(seed);
      expect(buildFrames(result)).toHaveLength(result.log.length);
    }
  });

  it('finishes on the real final score', () => {
    for (const seed of seeds) {
      const result = watched(seed);
      const frames = buildFrames(result);
      const last = frames[frames.length - 1];
      expect(last).toBeDefined();
      // The replay must not invent or lose a run along the way.
      expect(last?.homeRuns).toBe(result.home.runs);
      expect(last?.awayRuns).toBe(result.away.runs);
    }
  });

  it('never shows a fourth out or a negative score', () => {
    for (const seed of seeds) {
      for (const f of buildFrames(watched(seed))) {
        expect(f.outs).toBeGreaterThanOrEqual(0);
        expect(f.outs).toBeLessThanOrEqual(3);
        expect(f.homeRuns).toBeGreaterThanOrEqual(0);
        expect(f.awayRuns).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never runs the score backwards', () => {
    for (const seed of seeds) {
      const frames = buildFrames(watched(seed));
      for (let i = 1; i < frames.length; i++) {
        expect(frames[i]!.homeRuns).toBeGreaterThanOrEqual(frames[i - 1]!.homeRuns);
        expect(frames[i]!.awayRuns).toBeGreaterThanOrEqual(frames[i - 1]!.awayRuns);
      }
    }
  });

  it('clears the bases at every half inning', () => {
    for (const seed of seeds) {
      const frames = buildFrames(watched(seed));
      for (const f of frames) {
        if (f.kind !== 'inning') continue;
        expect(f.bases).toEqual([false, false, false]);
        expect(f.outs).toBe(0);
      }
    }
  });

  it('flags the frames where runs actually crossed', () => {
    for (const seed of seeds) {
      const frames = buildFrames(watched(seed));
      const scoring = frames.filter((f) => f.scored);
      const total = frames[frames.length - 1];
      // Somebody scored in this game, and it was marked when it happened.
      if ((total?.homeRuns ?? 0) + (total?.awayRuns ?? 0) > 0) {
        expect(scoring.length).toBeGreaterThan(0);
      }
      for (const f of scoring) expect(f.kind).toBe('play');
    }
  });
});
