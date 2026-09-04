// The two-way man's pitching night, as the card must print it.
//
// Reported from the APK: "I had him set as the ace… I went to the dugout but
// the starting pitcher's name was someone else's, then when the game ended it
// registered as if he pitched." The engine had him right all along — he
// pitched and he batted — but every label came off the ROSTER instead of off
// the night, so the box showed him in left field, showed the bench bat
// covering him as a second centre fielder, and showed nobody in left at all.
//
// The rule this holds is the reporter's own: on his pitching night the nine
// reads the eight field spots plus HIM, and no spot is worn twice.

import { describe, it, expect } from 'vitest';
import { makeTwoWay, makeTeam, resetNames } from '../src/engine/players.js';
import { makeRng } from '../src/engine/rng.js';
import { simGame } from '../src/engine/game.js';

describe('the two-way man as the ace', () => {
  const played = () => {
    resetNames();
    const rng = makeRng(9001);
    const mine = makeTeam(rng, 'MIN', 55);
    const them = makeTeam(rng, 'THM', 55);
    const man = makeTwoWay(makeRng(4242), 62);
    man.pos = 'LF';
    mine.lineup = [...mine.lineup.slice(0, 5), man, ...mine.lineup.slice(6)];
    mine.rotation = [man, ...mine.rotation.slice(1)];
    const r = simGame(mine, them, makeRng(77), { playEvents: true });
    const side = r.home.team === mine ? r.home : r.away;
    return { man, side };
  };

  it('hands him the ball and keeps his bat in the order', () => {
    const { man, side } = played();
    expect(side.starter?.id).toBe(man.id);
    const arm = [...side.pitching.values()].find((l) => l.player.id === man.id);
    const bat = [...side.batting.values()].find((l) => l.player.id === man.id);
    expect(arm?.outs ?? 0).toBeGreaterThan(0);
    expect(bat?.ab ?? 0).toBeGreaterThan(0);
  });

  it('prints him as the pitcher, not as the outfielder he is on other days', () => {
    const { man, side } = played();
    expect(side.playedAt.get(String(man.id))).toBe('PH');
  });

  it('gives his grass to the cover, and lets nobody wear a spot twice', () => {
    const { side } = played();
    const worn = side.starters.map(
      (p) => side.playedAt.get(String(p.id)) ?? p.pos,
    );
    // Eight field spots and the pitcher: nine men, nine distinct labels.
    expect(new Set(worn).size).toBe(worn.length);
    expect(worn).toContain('PH');
    for (const spot of ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']) {
      expect(worn, `${spot} must be manned`).toContain(spot);
    }
  });
});
