// own-spot.test.ts
// A man's positions are read from his own spot, never from tonight's label.
//
// Reported 2026-09-25: the Position decision on a player card read "First
// base, also covers right and first" for a first baseman who was the DH that
// night. The DH label hides his spot, `naturalPos` guessed left field off his
// range, and the covers were left field's. The retrain sheet read its list off
// the label the same way, so a man covering left was offered his own spot and
// not the one he was standing in. `ownSpot` is the one reading both use, the
// way the card's header names him; the store makes a move from the same place.

import { describe, it, expect } from 'vitest';
import { ownSpot } from '../src/ui/RetrainModal.js';
import { useDynasty } from '../src/state/store.js';
import { adoptSpot, restoreHome } from '../src/engine/depthChart.js';
import { naturalPos, retrainablePositions, secondaryPositions } from '../src/engine/positions.js';
import { makeTeam } from '../src/engine/roster.js';
import { overallOf } from '../src/engine/ratings.js';
import { makeRng } from '../src/engine/rng.js';
import type { Hitter, Position } from '../src/engine/types.js';

type Marked = Hitter & { homePos?: Position; movedFrom?: Position; settling?: number; retrainTo?: Position };

/** A hitter from a generated club, put at `pos` as his own spot. */
function aMan(pos: Position, tweak: Partial<Hitter> = {}): Marked {
  const team = makeTeam(makeRng(4242), 'Test Club', 50);
  const man = { ...[...team.lineup, ...team.bench][0]!, ...tweak } as Marked;
  delete man.homePos;
  man.pos = pos;
  return man;
}

describe('his own spot', () => {
  it('is first base for a first baseman who is the DH tonight', () => {
    // Range enough that the DH label alone would be read as a left fielder.
    const man = aMan('1B', { range: 60, arm: 40 });
    adoptSpot(man, 'DH');
    expect(man.pos).toBe('DH');
    expect(naturalPos(man)).toBe('LF');
    // The label's reading was the bug: left field's covers, "right and first".
    expect(secondaryPositions(man)).toEqual(['RF', '1B']);

    const own = ownSpot(man);
    expect(own.pos).toBe('1B');
    // A first baseman covers nothing, and first base is not a move for him.
    expect(secondaryPositions(own)).toEqual([]);
    expect(retrainablePositions(own)).not.toContain('1B');
    expect(retrainablePositions(own).length).toBeGreaterThan(0);
    // Read, not moved: the card still has him at DH.
    expect(man.pos).toBe('DH');
  });

  it('is centre field for a centre fielder covering left, whose list offers left', () => {
    const man = aMan('CF');
    adoptSpot(man, 'LF');
    const own = ownSpot(man);
    expect(own.pos).toBe('CF');
    expect(retrainablePositions(own)).toContain('LF');
    expect(retrainablePositions(own)).not.toContain('CF');
    // The label's list offered his own spot back to him.
    expect(retrainablePositions(man)).toContain('CF');
  });

  it("is the glove's spot for a bat-first man, as his card's header names him", () => {
    const man = aMan('DH', { range: 60, arm: 40 });
    expect(ownSpot(man).pos).toBe(naturalPos(man));
    // A man at his own spot is read as himself, not a copy.
    const shortstop = aMan('SS');
    expect(ownSpot(shortstop)).toBe(shortstop);
  });
});

describe('a move into the spot he is covering', () => {
  /** One of your own men, at home, then covering his first natural cover tonight. */
  const covering = (): { man: Marked; home: Position; cover: Position } => {
    const team = useDynasty.getState().season!.teams[useDynasty.getState().userTeam]!.team;
    const candidates = [...team.lineup, ...team.bench]
      .map((h) => h as Marked)
      .filter((h) => h.classYear !== 'SR')
      .filter((h) => { restoreHome(h); return secondaryPositions(h).length > 0; })
      // The weakest, so the refill at the roll does not take him for the DH.
      .sort((a, b) => overallOf(a) - overallOf(b));
    expect(candidates.length, 'no man on the card has a natural cover').toBeGreaterThan(0);
    const man = candidates[0]!;
    const home = man.pos;
    const cover = secondaryPositions(man)[0]!;
    adoptSpot(man, cover);
    expect(man.homePos).toBe(home);
    return { man, home, cover };
  };

  it('is made in the winter, from his own spot', () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ phase: 'draft' });
    const { man, home, cover } = covering();

    // His own spot is still no move, and refusing it changes nothing.
    expect(useDynasty.getState().changePosition(man.id, home)).toBe(false);
    expect(man.pos).toBe(cover);
    expect(man.homePos).toBe(home);

    // Off the label this read as "already there" and the button did nothing.
    expect(useDynasty.getState().changePosition(man.id, cover)).toBe(true);
    expect(man.pos).toBe(cover);
    expect(man.homePos ?? man.pos).toBe(cover);
    expect(man.movedFrom).toBe(home);
    expect(man.settling ?? 0).toBeGreaterThan(0);
  });

  it('is made at the roll when it was planned in the season', async () => {
    useDynasty.getState().start(4242, 0);
    useDynasty.setState({ phase: null });
    const { man, cover } = covering();

    expect(useDynasty.getState().changePosition(man.id, cover)).toBe(true);
    expect(man.retrainTo).toBe(cover);
    useDynasty.getState().settleSeason();
    await useDynasty.getState().rollYear();

    const s = useDynasty.getState();
    const team = s.season!.teams[s.userTeam]!.team;
    const after = [...team.lineup, ...team.bench].find((h) => h.id === man.id) as Marked | undefined;
    expect(after, 'he left the roster').toBeDefined();
    expect(after!.retrainTo).toBeUndefined();
    // Where he lives now, whatever tonight's card has him covering.
    expect(after!.homePos ?? after!.pos).toBe(cover);
  });
});
