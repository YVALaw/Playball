// positions.test.ts
// That the defensive spectrum reads the way the sport does, and that adding it
// moved nothing.
//
// The second half is the one that matters. This is the first stage-8 file and
// it lands inside a calibrated engine: the defensive spectrum in `players.ts`
// is zero-sum on purpose, because a first draft that summed to +13 on arm gave
// every program in the league a better outfield and dropped scoring 10.6% below
// the D1 target. Anything touching defence has to prove it did not do that
// again.

import { describe, it, expect } from 'vitest';
import {
  positionPenalty, secondaryPositions, fieldingAt, penaltyLabel,
} from '../src/engine/positions.js';
import { overallOf } from '../src/engine/ratings.js';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import type { Hitter, Position } from '../src/engine/types.js';

const world = createSeason(makeRng(4242), undefined, CONFERENCES);
const everyone: Hitter[] = world.teams.flatMap((t) => [...t.team.lineup, ...t.team.bench]);
const at = (pos: Position): Hitter => everyone.find((p) => p.pos === pos)!;

describe('the spectrum', () => {
  it('costs a man nothing at his own position', () => {
    for (const p of everyone) expect(positionPenalty(p, p.pos)).toBe(0);
  });

  it('is free downhill and dear uphill', () => {
    // The rule the whole model rests on: a shortstop plays second tomorrow, a
    // first baseman never plays short.
    const ss = at('SS');
    const first = at('1B');
    expect(positionPenalty(ss, '1B'), 'a shortstop was charged to stand at first').toBe(0);
    expect(positionPenalty(ss, '2B'), 'a shortstop was charged to play second').toBe(0);
    expect(positionPenalty(first, 'SS'), 'a first baseman played short for free')
      .toBeGreaterThan(20);
  });

  it('treats catching as a trade rather than a hard position', () => {
    /*
      Reported as the feel to aim for, by way of a game that already does it:
      put an outfielder behind the plate in The Show and watch his overall
      drop. It should end the conversation, not price it.
    */
    const lf = at('LF');
    const ss = at('SS');
    expect(positionPenalty(lf, 'C')).toBeGreaterThan(positionPenalty(lf, 'SS'));
    // Even the best athlete on the field is not a catcher.
    expect(positionPenalty(ss, 'C')).toBeGreaterThan(20);
    expect(penaltyLabel(lf, 'C')).toBe('out of his depth');
  });

  it('sends a catcher to the corners and not to short', () => {
    /*
      Caught on screen rather than by this file: the chart offered a catcher as
      free cover at shortstop, because a single ladder that puts catching at
      the hard end says every other spot is downhill from it.

      The arithmetic was right and the model was wrong. Catching is at that end
      because it is the hardest position to *fill*, not because catchers are
      the best athletes on the field -- they are usually the slowest men in the
      building, and where they actually go when their knees give up is first
      base and left field.
    */
    const c = at('C');
    expect(positionPenalty(c, '1B'), 'a catcher could not play first').toBe(0);
    expect(positionPenalty(c, 'LF')).toBeLessThan(4.5);
    expect(positionPenalty(c, 'SS'), 'a catcher was free cover at short')
      .toBeGreaterThan(20);
    expect(positionPenalty(c, '2B')).toBeGreaterThan(15);
    expect(secondaryPositions(c), 'a catcher was offered the middle infield')
      .not.toContain('SS');
  });

  it('never pays a man for standing somewhere easier', () => {
    for (const p of everyone.slice(0, 200)) {
      for (const pos of ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as Position[]) {
        expect(positionPenalty(p, pos), `${p.pos} to ${pos} was a bonus`)
          .toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('secondary positions', () => {
  it('gives everybody somewhere else to stand, and nobody everywhere', () => {
    for (const p of everyone.slice(0, 300)) {
      const also = secondaryPositions(p);
      expect(also, `${p.pos} can play nowhere else`).not.toHaveLength(0);
      expect(also, `${p.pos} can play everywhere`).not.toContain('DH');
      expect(also.includes(p.pos), 'listed his own position as a secondary').toBe(false);
    }
  });

  it('does not list catcher for anybody who is not one', () => {
    for (const p of everyone.slice(0, 300)) {
      if (p.pos === 'C') continue;
      expect(secondaryPositions(p), `${p.pos} was offered the plate`).not.toContain('C');
    }
  });

  it('reads hardest first, so a card leads with the flattering truth', () => {
    // A shortstop's list should open with the hardest thing on it.
    const ss = secondaryPositions(at('SS'));
    expect(ss[0]).toBe('2B');

    // And a first baseman gets exactly one rung up, which is left field and
    // nothing beyond it. That is the model being honest rather than generous:
    // the whole point of the ladder is that most men have one spare position,
    // not a menu.
    expect(secondaryPositions(at('1B'))).toEqual(['LF']);
  });
});

describe('playing him out of position', () => {
  it('drops his glove and leaves his bat alone', () => {
    const lf = at('LF');
    const asCatcher = fieldingAt(lf, 'C');
    expect(asCatcher.range).toBeLessThan(lf.range);
    expect(asCatcher.arm).toBeLessThan(lf.arm);
    // The half that must not move: moving a man does not stop him hitting.
    expect(asCatcher.contact).toBe(lf.contact);
    expect(asCatcher.power).toBe(lf.power);
    expect(asCatcher.eye).toBe(lf.eye);
  });

  it('shows up as a lower overall, which is the reported feel', () => {
    const lf = at('LF');
    expect(overallOf(fieldingAt(lf, 'C'))).toBeLessThan(overallOf(lf));
  });

  it('leaves him himself the moment he moves back', () => {
    // The reason this returns a copy rather than mutating: he is not worse, he
    // is worse *there*, and that is a fact about the lineup card.
    const ss = at('SS');
    const before = overallOf(ss);
    fieldingAt(ss, 'C');
    expect(overallOf(ss)).toBe(before);
  });

  it('never drops a rating below one', () => {
    for (const p of everyone.slice(0, 200)) {
      const wrecked = fieldingAt(p, 'C');
      expect(wrecked.range).toBeGreaterThanOrEqual(1);
      expect(wrecked.arm).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('what it did to the league', () => {
  it('changes nothing at all while everybody is where he belongs', () => {
    /*
      The calibration guard, and the reason this file can land inside a tuned
      engine without re-recording a single golden.

      Rosters are built to fit positions, so every man in the country is at his
      own spot and every penalty is zero. The model is inert until a depth chart
      lets a coach move somebody, at which point it costs *him* and nobody else.
    */
    let moved = 0;
    for (const t of world.teams) {
      for (const p of t.team.lineup) {
        if (positionPenalty(p, p.pos) !== 0) moved++;
      }
    }
    expect(moved, 'somebody in the league is already out of position').toBe(0);
  });

  it('is a pure function of the pair, so it cannot drift', () => {
    const p = at('CF');
    expect(positionPenalty(p, 'SS')).toBe(positionPenalty(p, 'SS'));
    expect(secondaryPositions(p)).toEqual(secondaryPositions(p));
  });
});
