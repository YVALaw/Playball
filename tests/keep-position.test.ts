// keep-position.test.ts
// A man covering second base for an afternoon has not been moved off shortstop.
//
// `explicitRecruitPromiseBroken` judged a keep-position promise off `p.pos`,
// which is the lineup-card label rather than where the man lives. `adoptSpot`
// (`depthChart.ts:483`) overwrites that label whenever somebody covers a spot
// that is not his and stashes the real one in `homePos` for `restoreHome` to put
// back — and `bestNine` relabels the whole country's nine every time a card is
// dealt, for all ninety-six programs at world creation and for the ninety-five
// rivals at every offseason.
//
// Measured before the fix, seed 4242: **180 of 1248 hitters — 14.4% — are
// wearing a cover label at any moment, and all 180 are pure relabels with
// `homePos` intact.** Nobody had been moved anywhere.
//
// The backlog line for this (`06` §AC.2, "A position change the man agreed to")
// described the consent half — a move the coach asked about and the man agreed
// to. That half is still owed. This file is the defect underneath it, which is
// larger and was not in the line: the promise was being broken by the lineup
// card.

import { describe, it, expect } from 'vitest';
import { explicitRecruitPromiseBroken, recruitPromiseProgress } from '../src/engine/morale.js';
import { adoptSpot, restoreHome } from '../src/engine/depthChart.js';
import { movePosition } from '../src/engine/positions.js';
import { makeTeam } from '../src/engine/players.js';
import { makeRng } from '../src/engine/rng.js';
import type { Hitter, Player, Position } from '../src/engine/types.js';

/** A shortstop who was promised he could stay there. */
const shortstop = (): Hitter => {
  const team = makeTeam(makeRng(4242), 'Test Club', 50);
  const man = [...team.lineup, ...team.bench].find((p) => p.pos === 'SS')
    ?? team.lineup[0]!;
  man.pos = 'SS';
  (man as Player).recruitPromise = {
    kind: 'keepPosition', madeYear: 2027, promisedPos: 'SS',
  };
  return man;
};

describe('a keep-position promise', () => {
  it('is not broken by a night covering somewhere else', () => {
    const man = shortstop();
    expect(explicitRecruitPromiseBroken(man as Player)).toBe(false);
    adoptSpot(man, '2B');
    // The card says 2B and the man still lives at short.
    expect(man.pos).toBe('2B');
    expect((man as Hitter & { homePos?: Position }).homePos).toBe('SS');
    expect(explicitRecruitPromiseBroken(man as Player), 'a cover broke his promise').toBe(false);
  });

  it('is still intact once the bench gives him back', () => {
    const man = shortstop();
    adoptSpot(man, 'LF');
    restoreHome(man);
    expect(man.pos).toBe('SS');
    expect(explicitRecruitPromiseBroken(man as Player)).toBe(false);
  });

  it('survives a whole chain of covers without ever breaking', () => {
    const man = shortstop();
    for (const spot of ['2B', '3B', 'LF', 'CF', '1B'] as Position[]) {
      adoptSpot(man, spot);
      expect(explicitRecruitPromiseBroken(man as Player), `covering ${spot}`).toBe(false);
    }
    restoreHome(man);
    expect(explicitRecruitPromiseBroken(man as Player)).toBe(false);
  });

  it('IS broken by a move the coach actually made', () => {
    // The other half, and the reason the judge could not simply stop reading
    // `pos`: a real retrain has to count, and it counts because `movePosition`
    // makes the new spot his home.
    const man = shortstop();
    expect(movePosition(man, '3B')).toBe(true);
    expect((man as Hitter & { homePos?: Position }).homePos).toBe('3B');
    expect(explicitRecruitPromiseBroken(man as Player)).toBe(true);
  });

  it('stays broken after a retrained man covers his old spot for a night', () => {
    /*
      The nastiest ordering, and the one that makes edit five load bearing. Move
      him to third, then let AUTO borrow him back at short for an afternoon. If
      `movePosition` had not written home, the borrowed label would now read as
      the promised position and the broken promise would silently heal.
    */
    const man = shortstop();
    movePosition(man, '3B');
    adoptSpot(man, 'SS');
    expect(man.pos).toBe('SS');
    expect(explicitRecruitPromiseBroken(man as Player), 'a cover healed a broken promise').toBe(true);
  });

  it("reports the spot he lives at, not the one on tonight's card", () => {
    const man = shortstop();
    adoptSpot(man, '2B');
    const sheet = recruitPromiseProgress(man as Player, { starts: 10, games: 20 });
    expect(sheet?.detail).toContain('Promised position: SS');
    expect(sheet?.detail).toContain('Current position: SS');
    expect(sheet?.detail).not.toContain('2B');
  });
});
