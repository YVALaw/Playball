// keepplayer.test.ts
// That a man you paid to keep is a man you actually have.
//
// Reported from play: "even though the player accepted to come back, he is no
// longer in my roster, so he was not brought back at all -- but he did accept."
//
// `reinstate` puts him back on the roster, and then `fillRosters` runs at the
// next offseason step and rebuilds every roster to exactly nine, four, four and
// six. Anyone past the cap is dropped without a word. The signed class already
// carries a guard against exactly this -- "if he signed, he is on the roster" --
// and the man whose return you spent recruiting budget on had none.

import { describe, it, expect } from 'vitest';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { departAndDevelop, fillRosters, reinstate } from '../src/engine/progression.js';
import { CONFERENCES } from '../src/data/schools.js';

const roster = (t: { lineup: unknown[]; bench: unknown[]; rotation: unknown[]; bullpen: unknown[] }) =>
  [...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen] as { id: string; name: string }[];

describe('a man talked out of the draft', () => {
  it('is still on the roster after the recruiting class arrives', () => {
    const dropped: string[] = [];
    let kept = 0;

    // A handful of worlds, each filled exactly once -- `fillRosters` refills
    // all ninety six programs and reserves every name it draws, so calling it
    // twice on one season is not a stronger test, it is a different game.
    for (const seed of [4242, 7, 88, 1301, 55, 909, 12, 640, 77, 2024, 313, 46]) {
      const rng = makeRng(seed);
      const season = createSeason(rng, undefined, CONFERENCES);
      const userTeam = (seed * 13) % 96;
      departAndDevelop(season, rng, { userTeam });

      const rec = season.teams[userTeam]!;
      const mine = (season.draft?.men ?? []).filter((m) => m.player.classYear !== 'SR');
      for (const m of mine) reinstate(rec.team, m.player, rng, 1);

      const afterKeep = roster(rec.team).map((p) => p.id);
      for (const m of mine) {
        expect(afterKeep, `${m.player.name} was never put back`).toContain(m.player.id);
      }

      fillRosters(season, rng, { userTeam });

      const afterFill = roster(rec.team).map((p) => p.id);
      for (const m of mine) {
        kept++;
        if (!afterFill.includes(m.player.id)) {
          dropped.push(`seed ${seed}: ${m.player.name} (${m.player.classYear} ${m.player.type}) was cut`);
        }
      }
    }

    // Only this program's men land on a board with a decision attached, and
    // most Junes it takes one or two of them -- so a dozen worlds is a handful
    // of men, not a distribution. The bar is that the case occurred at all.
    expect(kept, 'no draft board had anybody on it').toBeGreaterThanOrEqual(3);
    expect(dropped, 'men you paid to keep were cut by the roster cap').toEqual([]);
  });
});
