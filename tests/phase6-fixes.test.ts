// phase6-fixes.test.ts
// Regression tests for docs/18-fix-plan.md Phase 6 (IDs refer to
// docs/17-pre-release-audit.md).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createSeason, configForRules, seasonLength, DEFAULT_RULES, type SeasonRules,
} from '../src/engine/season.js';
import { playerBoard, rosterStrength, leagueShape } from '../src/engine/program.js';
import { CONFERENCES } from '../src/data/schools.js';
import { makeRng } from '../src/engine/rng.js';
import { useDynasty } from '../src/state/store.js';

const S = () => useDynasty.getState();

describe('job offers are previewed on the career they open (M81)', () => {
  for (const length of ['short', 'standard', 'long'] as const) {
    it(`the ${length} season: the same rosters and the same board ask`, () => {
      const rules: SeasonRules = { ...DEFAULT_RULES, length };
      const seed = 9311;
      // What the offer screen builds (NewGame.tsx).
      const world = createSeason(makeRng(seed), configForRules(rules), CONFERENCES);
      const team = 17;
      const me = world.teams[team]!;
      const previewed = playerBoard(
        me.prestige, rosterStrength(me.team), seasonLength(world.config),
        me.culture?.patience, leagueShape(world.teams),
      ).expectation;
      // What taking the job gives.
      S().start(seed, team, undefined, 'full', undefined, false, rules);
      const real = S().season!;
      expect(real.teams.map((t) => rosterStrength(t.team))).toEqual(world.teams.map((t) => rosterStrength(t.team)));
      expect(S().boardAsk!.targetWins).toBe(previewed.targetWins);
      expect(S().boardAsk!.mandate).toBe(previewed.mandate);
    });
  }

  it('the screen builds that world from the chosen rules', () => {
    const src = readFileSync('src/ui/screens/NewGame.tsx', 'utf8');
    expect(src).toContain('createSeason(makeRng(seed), configForRules(rules), CONFERENCES)');
  });
});

describe('the job offer and the comparison fit a phone (M82, M103)', () => {
  it('the offer strip is two by two', () => {
    expect(readFileSync('src/ui/screens/NewGame.tsx', 'utf8')).toContain('className="pb-stats--grid2"');
    const css = readFileSync('src/ui/design/components.css', 'utf8');
    expect(css).toContain('.pb-stats--grid2 { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, 1fr)); }');
  });

  it('money is a figure, not words, and its columns grow with the text size', () => {
    const data = readFileSync('src/ui/components/ui/data.tsx', 'utf8');
    expect(data).toContain("const wordy = (v: unknown): boolean => /\\s/.test(String(v ?? '').trim());");
    expect(data).not.toContain('.length > 4 &&');
    const css = readFileSync('src/ui/design/components.css', 'utf8');
    expect(css).toContain('calc(54px * var(--pb-ts, 1)) calc(60px * var(--pb-ts, 1)) 64px');
  });
});

describe('covering a hole keeps the substitution and the order (M106)', () => {
  it('the man sent in takes the open spot; nobody moves in the order', async () => {
    const { cardGaps } = await import('../src/engine/depthChart.js');
    const { startCareer } = await import('./support/drive.js');
    startCareer(4242, 3);
    const team = S().season!.teams[S().userTeam]!.team;
    // A bench man from somewhere else on the field, in for the shortstop.
    const at = team.lineup.findIndex((p) => p.pos === 'SS');
    const sub = team.bench.find((p) => p.type === 'hitter' && p.pos !== 'SS' && p.pos !== 'DH')!;
    expect(sub).toBeDefined();
    S().swapStarter(at, sub.id);
    expect(cardGaps(team.lineup).missing).toContain('SS');
    const order = team.lineup.map((p) => p.id);
    S().coverPositions(sub.id);
    expect(cardGaps(team.lineup)).toEqual({ missing: [], doubled: [] });
    expect(team.lineup.map((p) => p.id), 'the order and the nine stand').toEqual(order);
    expect(team.lineup.find((p) => p.id === sub.id)!.pos, 'the newcomer covers the hole').toBe('SS');
  });

  it('the warning offers the cover, not a re-deal', () => {
    const src = readFileSync('src/ui/screens/Lineup.tsx', 'utf8');
    expect(src).toContain("action={{ label: 'Cover the positions', variant: 'secondary', onClick: cover }}");
    expect(src).toContain('action="Cover the positions"');
    expect(src).not.toContain('action="Let auto fix it"');
    expect(src).not.toContain("label: 'Let auto fix it'");
  });
});

describe('a sway presses where it helps (M89)', () => {
  it('the chosen want raises the fit, and no other want would raise it more', async () => {
    const rec = await import('../src/engine/recruiting.js');
    const { startCareer } = await import('./support/drive.js');
    startCareer(4242, 3);
    const store = S();
    const season = store.season!;
    // The board's pitch, as the sheet builds it.
    const { programRecruitingPitch } = await import('../src/engine/recruitingPlan.js');
    const me = season.teams[store.userTeam]!;
    const conf = CONFERENCES.find((c) => c.id === me.conference);
    const pitch = programRecruitingPitch(season, me, conf?.region ?? 'Gulf', store.coach.prestige, store.economy);
    let worseOnTop = 0;
    for (const p of season.recruiting.prospects.slice(0, 60)) {
      const best = rec.bestSwayFactor(p, pitch);
      for (const f of rec.RECRUITING_FACTORS) expect(rec.swayFitGain(p, pitch, f)).toBeLessThanOrEqual(best.gain + 1e-9);
      const prio = rec.recruitingPrioritiesOf(p);
      const top = [...rec.RECRUITING_FACTORS].sort((a, b) => prio[b] - prio[a])[0]!;
      if (rec.swayFitGain(p, pitch, top) < 0) worseOnTop++;
    }
    // The old default really did backfire for some of them.
    expect(worseOnTop).toBeGreaterThan(0);
  });
});

describe('the suggested staff list never wipes a hand-built one in one tap (M90)', () => {
  it('asks before replacing, and offers to fill the open slots instead', () => {
    const src = readFileSync('src/ui/screens/StaffList.tsx', 'utf8');
    expect(src).toContain('armed={`Replace your ${n}?`}');
    expect(src).toContain('title="Fill the open slots"');
    expect(src).toContain('onUseSuggestion([...list.map((p) => p.id), ...extra], true)');
  });

  it('a fill keeps who is on the list, in order, and adds after them', async () => {
    const { startCareer } = await import('./support/drive.js');
    startCareer(4242, 3, { mode: 'casual' });
    const { suggestedStaffList } = await import('../src/state/store.js');
    const st = S();
    const recruits = st.season!.recruiting;
    const open = suggestedStaffList(st.season!, st.userTeam, st.coach, st.economy, st.phase);
    expect(open.length).toBeGreaterThan(4);
    S().setStaffList(open.slice(0, 2));
    const mine = [...(recruits.staffList ?? [])];
    expect(mine.length).toBeGreaterThan(0);
    S().setStaffList([...mine, ...open.slice(2, 5)], true);
    expect(recruits.staffList!.slice(0, mine.length)).toEqual(mine);
    expect(recruits.staffList!.length).toBeGreaterThan(mine.length);
  });
});

describe('a coach who is out still sees what June has set (M97)', () => {
  // Eight conferences of four finishers each, numbered so a team says where it came from.
  const CONFS = ['GULF', 'ATL', 'NEC', 'GLK', 'PAC', 'MTN', 'DES', 'HRT'];
  const cups = CONFS.map((conference, c) => ({
    conference, placings: [0, 1, 2, 3].map((p) => c * 10 + p),
  })) as unknown as Parameters<typeof import('../src/ui/screens/Postseason.js').regionalPreview>[0];

  it('every regional pairing is known before a game is played, your region first', async () => {
    const { regionalPreview } = await import('../src/ui/screens/Postseason.js');
    const pairs = regionalPreview(cups, 'WEST');
    expect(pairs).toHaveLength(16);
    expect(pairs.slice(0, 4).every((p) => p.id === 'WEST')).toBe(true);
    expect(pairs.slice(4).some((p) => p.id === 'WEST')).toBe(false);
    // Each finisher plays once, a champion never meets the other champion.
    expect(new Set(pairs.flatMap((p) => [p.a, p.b])).size).toBe(32);
    expect(pairs[0]).toMatchObject({ a: 40, b: 53, aLabel: 'PAC #1', bLabel: 'MTN #4' });
  });

  it('each national half lists its seeds before it starts', async () => {
    const { nationalHalfField } = await import('../src/ui/screens/Postseason.js');
    const seeds = Array.from({ length: 20 }, (_, i) => 100 + i);
    const A = nationalHalfField(seeds, 'A');
    const B = nationalHalfField(seeds, 'B');
    expect(A).toHaveLength(10);
    expect(B).toHaveLength(10);
    expect([...A, ...B].sort((x, y) => x - y)).toEqual(seeds);
    expect(A.slice(0, 2)).toEqual([100, 103]);
    expect(B.slice(0, 2)).toEqual([101, 102]);
  });

  it('the screen draws those, and no longer says the field is filling', () => {
    const src = readFileSync('src/ui/screens/Postseason.tsx', 'utf8');
    expect(src).toMatch(/pending=\{bracket\.regionals\.length === 0 \? regionalPreview\(/);
    expect(src).toMatch(/status="Set"/);
    expect(src).toMatch(/Seeded · not started/);
    expect(src).not.toMatch(/still filling|field is filling/i);
  });
});
