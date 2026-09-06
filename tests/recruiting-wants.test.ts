// recruiting-wants.test.ts
// Two rankings per recruit: his, and ours graded on what the program has.
//
// Reported from the emulator, September 6 2026: the recruiting file printed
// our grade beside each of his wants, so his wants read as a copy of ours.
// He has a grade of his own now — what he weighs he expects more of, a
// bigger name expects more of everything — and a pitch is judged against
// it: a card above his want earns a premium, a band under earns half, two
// under is hollow and costs interest. Playing time is a ladder of the men
// ahead of him at his position, and the mound has five and seven jobs.

import { describe, expect, it } from 'vitest';
import {
  RECRUITING_FACTORS, actionInterest, generateClass, pitchVerdict, planAiRecruitActions,
  wantedScore, factorScore, type Pitch, type Prospect,
} from '../src/engine/recruiting.js';
import { pitchFor } from '../src/engine/pitch.js';
import { createSeason } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES } from '../src/data/schools.js';
import type { Hitter, Pitcher, PlayerId } from '../src/engine/types.js';

const pitch = (overrides: Partial<Pitch> = {}): Pitch => ({
  prestige: 0.45, stars: 2, playingTime: () => 0.75, winning: 0.55, region: 'Gulf', state: 'LA',
  development: 0.65, coachReputation: 0.62, conferencePrestige: 0.58, facilities: 0.7, proPipeline: 0.5,
  ...overrides,
});

const cls = generateClass(2027, 8, makeRng(91));

describe('what he wants', () => {
  it('is a grade of his own, higher where he cares more and for a bigger name', () => {
    for (const p of cls.prospects.slice(0, 40)) {
      const ranked = [...RECRUITING_FACTORS].map((f) => wantedScore(p, f));
      for (const v of ranked) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      const top = [...RECRUITING_FACTORS].sort((a, b) => wantedScore(p, b) - wantedScore(p, a))[0]!;
      const least = [...RECRUITING_FACTORS].sort((a, b) => wantedScore(p, a) - wantedScore(p, b))[0]!;
      expect(wantedScore(p, top)).toBeGreaterThan(wantedScore(p, least));
      const bigger: Prospect = { ...p, stars: Math.min(5, p.stars + 2) };
      expect(wantedScore(bigger, top)).toBeGreaterThanOrEqual(wantedScore(p, top));
    }
  });

  it('is not our grade: the two disagree on most factors for most men', () => {
    const our = pitch();
    let same = 0; let all = 0;
    for (const p of cls.prospects.slice(0, 40)) {
      for (const f of RECRUITING_FACTORS) {
        all++;
        if (Math.abs(wantedScore(p, f) - factorScore(p, our, f)) < 0.035) same++;
      }
    }
    expect(same / all).toBeLessThan(0.35);
  });
});

describe('a pitch against what he wants', () => {
  const p = cls.prospects.find((x) => x.stars >= 3)!;

  it('is hollow when the program is two bands under, and costs interest', () => {
    const poor = pitch({ facilities: 0.05 });
    expect(pitchVerdict(p, poor, 'facilities')).toBe('hollow');
    (p.weekActions ??= {})[0] = { pitch: 'facilities' };
    expect(actionInterest(p, poor, 0)).toBeLessThan(0);
  });

  it('earns a premium when the program has more than he wants', () => {
    const rich = pitch({ facilities: 1 });
    const fair = pitch({ facilities: Math.min(1, wantedScore(p, 'facilities')) });
    expect(pitchVerdict(p, rich, 'facilities')).toBe('strong');
    (p.weekActions ??= {})[0] = { pitch: 'facilities' };
    expect(actionInterest(p, rich, 0)).toBeGreaterThan(actionInterest(p, fair, 0));
    expect(actionInterest(p, fair, 0)).toBeGreaterThan(0);
  });

  it('is never pitched by the staff when it is hollow', () => {
    const poor = pitch({ facilities: 0.02, proPipeline: 0.02, winning: 0.02, coachReputation: 0.02 });
    const spends = cls.prospects.slice(0, 30).map((prospect) => ({ prospect, actions: 0 }));
    for (const s of spends) delete s.prospect.weekActions;
    planAiRecruitActions(3, poor, spends, 500, 1, 50, 50, makeRng(4));
    let pitched = 0;
    for (const { prospect } of spends) {
      const f = prospect.weekActions?.[3]?.pitch;
      if (!f) continue;
      pitched++;
      expect(pitchVerdict(prospect, poor, f), `${prospect.player.name} pitched ${f}`).not.toBe('hollow');
    }
    expect(pitched).toBeGreaterThan(0);
  });
});

describe('playing time is the men ahead of him', () => {
  const season = createSeason(makeRng(5), undefined, CONFERENCES);
  const record = season.teams[4]!;
  const grade = (p: Prospect): number => pitchFor(season, record, 'Gulf').playingTime(p);
  const clone = <T extends Hitter | Pitcher>(x: T, n: number): T =>
    ({ ...x, id: `clone-${n}` as PlayerId, classYear: 'FR' });

  it('climbs down a band per man at a fielding spot', () => {
    const hitter = cls.prospects.find((x) => x.player.type === 'hitter')!;
    const h = hitter.player as Hitter;
    record.team.lineup = record.team.lineup.filter((r) => r.pos !== h.pos);
    record.team.bench = record.team.bench.filter((r) => r.pos !== h.pos);
    expect(grade(hitter)).toBe(1);
    const steps: number[] = [];
    for (let n = 1; n <= 5; n++) {
      record.team.bench.push(clone(h, n));
      steps.push(grade(hitter));
    }
    expect(steps[0]).toBeCloseTo(0.75, 2);
    expect(steps[1]).toBeCloseTo(0.61, 2);
    expect(steps[4]).toBeCloseTo(0.19, 2);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1]!);
  });

  it('a senior ahead of him barely counts', () => {
    const hitter = cls.prospects.find((x) => x.player.type === 'hitter')!;
    const h = hitter.player as Hitter;
    record.team.lineup = record.team.lineup.filter((r) => r.pos !== h.pos);
    record.team.bench = record.team.bench.filter((r) => r.pos !== h.pos);
    record.team.bench.push({ ...clone(h, 9), classYear: 'SR' });
    expect(grade(hitter)).toBeGreaterThan(0.85);
  });

  it('the mound is a gentler ladder that floors at B-minus', () => {
    // A rotation has four or five nights and a bullpen seven jobs: there is
    // always a night for another arm, so depth there never reads as a wall.
    const arm = cls.prospects.find((x) => x.player.type === 'pitcher' && (x.player as Pitcher).role === 'SP')!;
    const a = arm.player as Pitcher;
    record.team.rotation = [];
    expect(grade(arm)).toBe(1);
    record.team.rotation.push(clone(a, 1));
    expect(grade(arm)).toBeCloseTo(0.89, 2);
    for (let n = 2; n <= 4; n++) record.team.rotation.push(clone(a, n));
    expect(grade(arm)).toBeCloseTo(0.68, 2);
    for (let n = 5; n <= 9; n++) record.team.rotation.push(clone(a, n));
    expect(grade(arm)).toBeCloseTo(0.58, 2);
  });
});
