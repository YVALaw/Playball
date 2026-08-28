// roster.test.ts
// Eligibility, redshirts and position moves — the three things stage 8 adds to
// a man rather than to a lineup card.
//
// All three share one property that matters more than any of their own: they
// are derived or sparse, so a save written before stage 8 has nobody failing,
// nobody sitting and nobody settling, rather than everybody.

import { describe, it, expect } from 'vitest';
import {
  AT_RISK, FAILING, WEEK, WORDS_A_SEASON,
  gradesOf, atRisk, standing, failsThisWeek, suspend, haveAWord, driftGrades,
} from '../src/engine/eligibility.js';
import {
  MAX_REDSHIRTS, REDSHIRT_GROWTH, canRedshirt, redshirt, unRedshirt, redshirtCount, bankRedshirt,
} from '../src/engine/redshirt.js';
import {
  movePosition, settleIn, positionPenalty, SETTLING_COST, secondaryPositions,
} from '../src/engine/positions.js';
import { available, squad } from '../src/engine/depthChart.js';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import { overallOf } from '../src/engine/ratings.js';
import type { Hitter, Player, Team } from '../src/engine/types.js';

const world = () => createSeason(makeRng(4242), undefined, CONFERENCES);
const aTeam = (): Team => world().teams[11]!.team;
const everyone = (): Hitter[] => world().teams.flatMap((t) => squad(t.team));

describe('grades', () => {
  it('gives every man a standing without anybody writing one', () => {
    for (const p of everyone().slice(0, 300)) {
      const g = gradesOf(p);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(100);
    }
  });

  it('is the same every time it is asked, and takes no draw', () => {
    const rng = makeRng(9);
    const before = rng.state?.();
    const men = everyone().slice(0, 50);
    const first = men.map(gradesOf);
    for (const p of men) { failsThisWeek(p, 2027, 3); standing(p); }
    expect(men.map(gradesOf)).toEqual(first);
    expect(rng.state?.()).toBe(before);
  });

  it('puts a minority on the watch list, not a third of the roster', () => {
    /*
      The number that decides whether the colour on a card means anything. A
      distribution centred at the middle of the scale would flag a third of
      every roster and the flag becomes wallpaper.
    */
    const men = everyone();
    const flagged = men.filter(atRisk).length / men.length;
    expect(flagged, 'nobody is ever in trouble').toBeGreaterThan(0.03);
    expect(flagged, 'half the country is failing').toBeLessThan(0.25);
  });

  it('reads as three states a card can print', () => {
    const men = everyone();
    expect(new Set(men.map(standing)).size).toBeGreaterThan(1);
    for (const p of men.slice(0, 200)) {
      const s = standing(p);
      if (s === 'trouble') expect(gradesOf(p)).toBeLessThan(FAILING);
      if (s === 'fine') expect(gradesOf(p)).toBeGreaterThanOrEqual(AT_RISK);
    }
  });

  it('never fails a man who is doing fine', () => {
    for (const p of everyone().slice(0, 300)) {
      if (gradesOf(p) < AT_RISK) continue;
      for (let week = 1; week <= 15; week++) {
        expect(failsThisWeek(p, 2027, week), 'a good student was suspended').toBe(false);
      }
    }
  });

  it('catches up with a man in trouble sometimes, not every week', () => {
    // A man who sat every week would be a roster spot removed rather than a
    // risk taken.
    const bad = everyone().find((p) => gradesOf(p) < FAILING);
    expect(bad, 'nobody in the country is failing').toBeDefined();
    let hits = 0;
    for (let week = 1; week <= 100; week++) if (failsThisWeek(bad!, 2027, week)) hits++;
    expect(hits, 'he never missed a week').toBeGreaterThan(2);
    expect(hits, 'he missed most of the season').toBeLessThan(45);
  });

  it('sits him for exactly a week', () => {
    const p = everyone()[0]!;
    suspend(p, 40);
    expect(available(p, 40)).toBe(false);
    expect(available(p, 40 + WEEK - 1)).toBe(false);
    expect(available(p, 40 + WEEK)).toBe(true);
  });
});

describe('a word with him', () => {
  it('lifts him, and a coach who trains lifts him further', () => {
    /*
      Measured on a man who has room to be lifted.

      The first version of this took the first man on the roster, who was
      already in the nineties, so both conversations hit the ceiling and
      returned the same number -- the test was measuring the cap rather than
      the coach. A man in trouble is the case this feature is for anyway.
    */
    const struggling = everyone().find((p) => standing(p) === 'trouble')!;
    const copy = { ...struggling };
    const plain = haveAWord(struggling, 20);
    const trained = haveAWord(copy as Player, 80);
    expect(plain).toBeGreaterThan(0);
    expect(trained).toBeGreaterThan(plain);
  });

  it('is capped, so it cannot be spent on one man all year', () => {
    // The cap is the caller's to enforce; what this holds is that the number
    // exists and is small enough to be a decision.
    expect(WORDS_A_SEASON).toBeGreaterThan(2);
    expect(WORDS_A_SEASON).toBeLessThan(7);
  });

  it('cannot push a man past the top of the scale', () => {
    const p = everyone()[7]!;
    for (let i = 0; i < 20; i++) haveAWord(p, 99);
    expect(gradesOf(p)).toBeLessThanOrEqual(100);
  });

  it('drifts home over a career, so talking is not a one-off purchase', () => {
    /*
      Over a career rather than over one year, which is what the drift claims.

      A single roll carries a nudge of up to six either way and the pull toward
      the middle is twelve percent, so one year can legitimately go *up* -- the
      first version of this asserted otherwise and was measuring noise. Four
      years is a career, and a man talked to the ceiling must not still be
      sitting there at the end of it.
    */
    const p = everyone().find((x) => standing(x) === 'trouble')!;
    for (let i = 0; i < 6; i++) haveAWord(p, 99);
    const high = gradesOf(p);
    expect(high).toBeGreaterThan(70);
    for (let y = 0; y < 4; y++) driftGrades(p, 2028 + y);
    expect(gradesOf(p), 'one conversation lasted a whole career').toBeLessThan(high);
  });

  it('clears the season count at the roll', () => {
    const p = everyone()[11]!;
    haveAWord(p, 40);
    expect((p as { talkedTo?: number }).talkedTo).toBe(1);
    driftGrades(p, 2028);
    expect((p as { talkedTo?: number }).talkedTo).toBe(0);
  });
});

describe('redshirts', () => {
  it('is for freshmen and sophomores only', () => {
    const men = everyone();
    const fr = men.find((p) => p.classYear === 'FR')!;
    const sr = men.find((p) => p.classYear === 'SR')!;
    const jr = men.find((p) => p.classYear === 'JR')!;
    expect(canRedshirt(fr)).toBe(true);
    expect(canRedshirt(sr)).toBe(false);
    expect(canRedshirt(jr)).toBe(false);
  });

  it('is once in a career', () => {
    const p = everyone().find((x) => x.classYear === 'FR')!;
    expect(redshirt(aTeam(), p)).toBe(true);
    bankRedshirt(p);
    expect(canRedshirt(p), 'he sat twice').toBe(false);
  });

  it('caps a class, so a whole intake cannot sit', () => {
    const team = aTeam();
    const men = [...squad(team), ...team.rotation, ...team.bullpen]
      .filter((p) => p.classYear === 'FR' || p.classYear === 'SO');
    let sat = 0;
    for (const p of men) if (redshirt(team, p)) sat++;
    expect(sat).toBe(Math.min(MAX_REDSHIRTS, men.length));
    expect(redshirtCount(team)).toBe(sat);
  });

  it('takes him out of every lineup for the whole year', () => {
    const team = aTeam();
    const p = squad(team).find((x) => canRedshirt(x))!;
    redshirt(team, p);
    expect(available(p, 0)).toBe(false);
    expect(available(p, 300)).toBe(false);
  });

  it('can be undone before the season starts', () => {
    const team = aTeam();
    const p = squad(team).find((x) => canRedshirt(x))!;
    redshirt(team, p);
    unRedshirt(p);
    expect(available(p, 0)).toBe(true);
    expect(redshirtCount(team)).toBe(0);
  });

  it('develops him a little slower than a year of playing', () => {
    // A redshirt who came back better than the man who played would make
    // sitting everybody the correct move.
    expect(REDSHIRT_GROWTH).toBeLessThan(1);
    expect(REDSHIRT_GROWTH).toBeGreaterThan(0.6);
  });
});

describe('moving a man', () => {
  it('changes his card and charges him for a while', () => {
    const p = everyone().find((x) => x.pos === 'SS')!;
    const before = overallOf(p);
    expect(movePosition(p, '3B')).toBe(true);
    expect(p.pos).toBe('3B');
    expect((p as { movedFrom?: string }).movedFrom).toBe('SS');
    // He is a third baseman who is not a natural one yet.
    expect(positionPenalty(p, '3B')).toBeGreaterThan(0);
    expect(overallOf(p)).toBeLessThanOrEqual(before);
  });

  it('charges an uphill move harder than a downhill one', () => {
    const easy = everyone().find((x) => x.pos === 'SS')!;
    const hard = everyone().find((x) => x.pos === 'LF')!;
    movePosition(easy, '3B');
    movePosition(hard, 'SS');
    expect((hard as { settling?: number }).settling!)
      .toBeGreaterThan((easy as { settling?: number }).settling!);
  });

  it('settles out over two seasons and leaves nothing behind', () => {
    const p = everyone().find((x) => x.pos === 'SS')!;
    movePosition(p, '3B');
    expect((p as { settling?: number }).settling).toBe(SETTLING_COST);
    settleIn(p);
    settleIn(p);
    expect((p as { settling?: number }).settling, 'he never settled').toBeUndefined();
    expect((p as { movedFrom?: string }).movedFrom).toBeUndefined();
    expect(positionPenalty(p, '3B'), 'he is still paying for it').toBe(0);
  });

  it('refuses to move a man where he already is', () => {
    const p = everyone()[0]!;
    expect(movePosition(p, p.pos)).toBe(false);
    expect((p as { settling?: number }).settling).toBeUndefined();
  });

  it('offers him only spots he could actually cover', () => {
    for (const p of everyone().slice(0, 100)) {
      for (const spot of secondaryPositions(p)) {
        expect(positionPenalty(p, spot), `${p.pos} was offered ${spot}`).toBeLessThanOrEqual(4.5);
      }
    }
  });
});

describe('what a save from before this reads as', () => {
  it('has nobody failing, sitting or settling', () => {
    for (const p of everyone().slice(0, 200)) {
      expect(available(p, 0), 'somebody was out before the feature existed').toBe(true);
      expect((p as { settling?: number }).settling).toBeUndefined();
      expect((p as { redshirt?: boolean }).redshirt).toBeUndefined();
    }
  });
});
