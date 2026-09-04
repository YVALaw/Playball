import { describe, it, expect } from 'vitest';
import { makeTeam, resetNames } from '../src/engine/players.js';
import { makeRng } from '../src/engine/rng.js';
import { createLiveGame } from '../src/engine/liveGame.js';

describe('the bottom of the ninth is never played with the home side ahead', () => {
  it('holds across forty managed games, home and away', () => {
    for (let seed = 1; seed <= 40; seed++) {
      resetNames();
      const rng = makeRng(seed * 101);
      const a = makeTeam(rng, 'AAA', 55);
      const b = makeTeam(rng, 'BBB', 52);
      const live = createLiveGame(a, b, rng, {
        managing: seed % 2 === 0 ? 'home' : 'away',
        autoPitching: seed % 3 === 0,
      });
      let guard = 0;
      while (!live.over && guard++ < 700) {
        const p = live.pending;
        if (!p) { live.finish(); break; }
        if (p.half === 'bottom' && p.inning >= 9 && p.homeRuns > p.awayRuns) {
          throw new Error(
            `seed ${seed}: bottom ${p.inning} offered with home up ${p.homeRuns}-${p.awayRuns}`,
          );
        }
        const live_opts = p.options.filter((o) => o.available);
        const pick = live_opts[seed % Math.max(1, live_opts.length)] ?? live_opts[0]!;
        live.submit(pick.tactic);
      }
      expect(live.over).toBe(true);
    }
  });
});
