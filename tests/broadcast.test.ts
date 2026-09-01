// broadcast.test.ts
// Stage 14: the wire's new stories and the takeover moments.
//
// The presentation itself (sound, confetti, the flip) is a phone's job to
// judge; what a test can hold is the facts underneath — that the paper prints
// the winter while it is news and retires it when it is not, that a record
// chase quotes the book it will have to beat, and that two moments offered in
// the same beat resolve to the bigger one.

import { describe, it, expect } from 'vitest';
import { createSeason, simNextDay, simSeason } from '../src/engine/season.js';
import { wire } from '../src/engine/wire.js';
import { makeRng } from '../src/engine/rng.js';
import { useDynasty } from '../src/state/store.js';

describe('the winter opens the spring paper', () => {
  it('prints realignment and the poached assistant while the feed is young', () => {
    const season = createSeason(makeRng(3131));
    // Real schools, and two different ones: the feed's one-team-per-issue law
    // means a rise and a poaching at the SAME school print as one story.
    const riser = season.teams[7]!.def;
    season.newsRealign = {
      school: riser.school, abbr: riser.abbr, from: 'MOUNTAINS', to: 'GULF',
      downSchool: 'Bayou State', downAbbr: 'BAY',
    };
    season.newsStaff = {
      name: 'Dale Whitworth', seat: 'Hitting coach', school: season.teams[0]!.def.school,
    };

    const feed = wire(season);
    const kinds = feed.map((i) => i.kind);
    expect(kinds).toContain('realign');
    expect(kinds).toContain('moves');

    const realign = feed.find((i) => i.kind === 'realign')!;
    expect(realign.text).toContain(riser.school);
    expect(realign.text).toContain('GULF');
    expect(realign.detail).toContain('Bayou State');

    const moves = feed.find((i) => i.kind === 'moves')!;
    expect(moves.text).toContain('hitting coach');
    expect(moves.detail).toContain('Dale Whitworth');
  });

  it('retires the winter once the season has piled up on it', () => {
    const season = createSeason(makeRng(3131));
    season.newsRealign = {
      school: 'Gulf Coast Tech', abbr: 'GCT', from: 'MOUNTAINS', to: 'GULF',
      downSchool: 'Bayou State', downAbbr: 'BAY',
    };
    simSeason(season);
    const kinds = wire(season).map((i) => i.kind);
    expect(kinds).not.toContain('realign');
    expect(kinds).not.toContain('moves');
  });
});

describe('the record chase runs before the record falls', () => {
  it('quotes the book against the country leader when the pace clears it', () => {
    const season = createSeason(makeRng(4242));
    // Enough season to trust a pace, not enough to be over.
    for (let i = 0; i < 24; i++) simNextDay(season);

    // Find the country's home run leader the same way the wire does.
    let leader = { hr: 0, gp: 0 };
    for (const record of season.teams) {
      const gp = record.w + record.l;
      for (const p of [...record.team.lineup, ...record.team.bench]) {
        const line = season.batting.get(p.id);
        if (line && line.hr > leader.hr) leader = { hr: line.hr, gp };
      }
    }
    expect(leader.hr).toBeGreaterThanOrEqual(2);
    expect(leader.gp).toBeGreaterThanOrEqual(15);

    // A book whose mark sits one ahead of him: chaseable, on pace, unbroken.
    season.records = {
      seasonHR: {
        value: leader.hr + 1, holder: 'Pete Incaviglia',
        team: 'Oklahoma State', year: 1985, ncaa: true,
      },
    };

    const chase = wire(season).find((i) => i.kind === 'chase');
    expect(chase).toBeDefined();
    expect(chase!.text).toContain('chasing the book');
    expect(chase!.detail).toContain('Pete Incaviglia');
    expect(chase!.detail).toContain(String(leader.hr + 1));
  });

  it('stays silent when nobody is close', () => {
    const season = createSeason(makeRng(4242));
    for (let i = 0; i < 24; i++) simNextDay(season);
    season.records = {
      seasonHR: {
        value: 99, holder: 'Nobody Real', team: 'Nowhere', year: 1900, ncaa: true,
      },
    };
    expect(wire(season).find((i) => i.kind === 'chase')).toBeUndefined();
  });
});

describe('two moments in one beat resolve to the bigger', () => {
  it('ranks the title over the walk-off, and never downgrades', () => {
    const store = useDynasty.getState();
    store.clearBigMoment();

    store.offerBigMoment({
      kind: 'walkoff', team: 0, name: 'A Hero', line: 'X 2 — 3 Y', year: 2030,
    });
    expect(useDynasty.getState().bigMoment?.kind).toBe('walkoff');

    // The clinch that landed in the same breath takes the screen.
    store.offerBigMoment({
      kind: 'title', team: 0, line: 'National champions', year: 2030,
    });
    expect(useDynasty.getState().bigMoment?.kind).toBe('title');

    // A smaller moment offered on top of a bigger one changes nothing.
    store.offerBigMoment({
      kind: 'cup', team: 0, line: 'GULF tournament champions', year: 2030,
    });
    expect(useDynasty.getState().bigMoment?.kind).toBe('title');

    store.clearBigMoment();
    expect(useDynasty.getState().bigMoment).toBeNull();
  });
});
