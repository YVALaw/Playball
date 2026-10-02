// season-plan-fixes.test.ts
// The Season plan's first week in the user's hands (2026-09-29):
//   "there are two positions empty and it wont let me click any of them to try
//   and hire them, same thing if i try to select the picks for the staff ...
//   the suggested one are all 2 star when the school is already 5 stars"
//   "I also selected to run the scouting myself but i can not select or spend
//   points, i can only star them for the recruiting coach"
// Each answer is pinned here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { programRecruitingPitch } from '../src/engine/recruitingPlan.js';
import { winScore, type Prospect } from '../src/engine/recruiting.js';
import {
  STAFF_LIST_MAX, staffReplacement, suggestStaffList, suggestionBands,
} from '../src/engine/staffRecruiting.js';
import { freshEconomy, SEATS } from '../src/engine/economy.js';
import { prestigeStars } from '../src/engine/program.js';
import { createSeason, type SeasonState } from '../src/engine/season.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES, type Region } from '../src/data/schools.js';
import { handles } from '../src/state/depth.js';

const regionOf = (season: SeasonState, i: number): Region =>
  CONFERENCES.find((c) => c.id === season.teams[i]?.conference)?.region ?? 'Gulf';

/** The class and the program's pitch, for the strongest program in the world. */
const topBoard = (seed: number) => {
  const season = createSeason(makeRng(seed), undefined, CONFERENCES);
  const rec = [...season.teams].sort((a, b) => b.prestige - a.prestige)[0]!;
  const pitch = programRecruitingPitch(season, rec, regionOf(season, rec.index), 45, freshEconomy());
  return { season, rec, pitch, prospects: season.recruiting.prospects };
};

describe('the suggested list fits the program', () => {
  it('points a five-star program at five and four stars', () => {
    for (const seed of [31, 4242, 909]) {
      const { rec, pitch, prospects } = topBoard(seed);
      expect(prestigeStars(rec.prestige), `seed ${seed}`).toBe(5);
      const byId = new Map(prospects.map((p) => [p.id as string, p]));
      const list = suggestStaffList(prospects, rec.index, pitch, [], 1).map((id) => byId.get(id)!);
      expect(list).toHaveLength(STAFF_LIST_MAX);
      const stars = list.map((p) => p.stars);
      expect(stars.filter((s) => s === 5).length, `seed ${seed}: ${stars.join('')}`).toBeGreaterThanOrEqual(4);
      expect(stars.filter((s) => s >= 4).length, `seed ${seed}: ${stars.join('')}`).toBeGreaterThanOrEqual(7);
      // Best band first: the order the staff works them.
      for (let i = 1; i < stars.length; i++) expect(stars[i]!).toBeLessThanOrEqual(stars[i - 1]!);
    }
  });

  it('keeps a small program to the bands it can reach', () => {
    expect(suggestionBands(1).map((b) => b.stars)).toEqual([3, 2, 1]);
    expect(suggestionBands(5).map((b) => b.stars)).toEqual([5, 4, 3]);
    for (let tier = 1; tier <= 5; tier++) {
      for (const b of suggestionBands(tier)) {
        expect(b.stars).toBeGreaterThanOrEqual(1);
        expect(b.stars).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe('a lost starred man is replaced', () => {
  it('by the closest race at his spot when the rivals have the rest', () => {
    const { rec, pitch, prospects } = topBoard(31);
    const me = rec.index;
    const lost = prospects.find((p) => p.player.type === 'hitter' && p.stars === 4)!;
    lost.signedBy = (me + 1) % 96;
    // Every other open man is somebody else's by a mile...
    for (const p of prospects) {
      if (p === lost) continue;
      p.points = { [(me + 2) % 96]: 100 };
    }
    // ...except one, at his spot, whom we lead.
    const spot = (p: Prospect): string | undefined => (p.player as { pos?: string }).pos;
    const ours = prospects.find((p) => p !== lost && p.player.type === 'hitter' && spot(p) === spot(lost) && p.signedBy === null)!;
    ours.points = { [me]: 60, [(me + 2) % 96]: 20 };
    const by = staffReplacement(lost, prospects, me, pitch, 8, new Set());
    expect(by?.id).toBe(ours.id);
    expect(winScore(ours, me, pitch)).toBeGreaterThan(0);

    // With the whole class a rival's, still a man at his spot within a star of
    // him (2026-09-30: the staff has started on nobody off the list, so this is
    // the usual case, and "look for a similar player" was the ask). The one
    // the staff is least short on.
    ours.points = { [(me + 2) % 96]: 100 };
    const closest = prospects.find((p) => p !== lost && p !== ours && p.player.type === 'hitter'
      && spot(p) === spot(lost) && p.signedBy === null && Math.abs(p.stars - lost.stars) <= 1)!;
    closest.points = { [(me + 2) % 96]: 30 };
    const near = staffReplacement(lost, prospects, me, pitch, 8, new Set());
    expect(near?.id).toBe(closest.id);
    expect(winScore(closest, me, pitch)).toBe(0);

    // Nobody only when nobody open plays his spot or his group.
    for (const p of prospects) if (p !== lost && p.player.type === 'hitter') p.signedBy = (me + 3) % 96;
    expect(staffReplacement(lost, prospects, me, pitch, 8, new Set())).toBeNull();
  });
});

describe('the athletic director hires on day one', () => {
  const g = async () => (await import('../src/state/store.js')).useDynasty;

  it('fills a casual career\'s seats at the start, within the budget', async () => {
    const useDynasty = await g();
    useDynasty.getState().start(918, 0, undefined, 'casual');
    const s = useDynasty.getState();
    expect(handles(s.depth, 'assistants')).toBe(false);
    for (const seat of SEATS) expect(s.economy.staff[seat], seat).toBeDefined();
    const { remaining } = await import('../src/engine/economy.js');
    expect(remaining(s.economy, s.season!.teams[s.userTeam]!.prestige)).toBeGreaterThanOrEqual(0);
  });

  it('leaves a full career\'s seats for the coach', async () => {
    const useDynasty = await g();
    useDynasty.getState().start(918, 0, undefined, 'full');
    const s = useDynasty.getState();
    for (const seat of SEATS) expect(s.economy.staff[seat], seat).toBeUndefined();
    // A casual coach who hires his own keeps that job too.
    useDynasty.getState().start(918, 0, undefined, 'casual', undefined, false, undefined, { assistants: true });
    for (const seat of SEATS) expect(useDynasty.getState().economy.staff[seat], seat).toBeUndefined();
  });

  it('fills the holes when the staff is handed to him mid-career', async () => {
    const useDynasty = await g();
    useDynasty.getState().start(918, 0, undefined, 'full');
    expect(Object.keys(useDynasty.getState().economy.staff)).toHaveLength(0);
    useDynasty.getState().setDepthSystem('assistants', false);
    const s = useDynasty.getState();
    for (const seat of SEATS) expect(s.economy.staff[seat], seat).toBeDefined();
  });
});

describe('the plan and the board answer every tap', () => {
  const src = (f: string): string => readFileSync(f, 'utf8');

  it('opens a room for every seat row, laid over the plan', () => {
    const plan = src('src/ui/screens/SeasonPlan.tsx');
    expect(plan).toContain("openStaffDesk(s, { layer: true })");
    expect(plan).toContain("openFacilityRoom(projectFacility(s), { layer: true })");
    // The plan stays mounted under the room, so its history entry is kept.
    expect(plan).toContain('seasonPlanCovered');
    expect(src('src/ui/components/ui/layout.tsx')).toContain('covered');
  });

  it('lets an open slot pick the coach\'s own men, on the plan and on the board', () => {
    expect(src('src/ui/screens/SeasonPlan.tsx')).toContain('onPickSlot={live ? () => setPicking(true) : undefined}');
    expect(src('src/ui/screens/Board.tsx')).toContain('onPickSlot={live ? () => setPicking(true) : undefined}');
    // A full list reads full: its other men are disabled, and say why.
    const picker = src('src/ui/screens/StaffPicker.tsx');
    expect(picker).toContain('disabled={!on && full}');
    expect(picker).toContain('The list is full');
  });

  it('does not offer a switch for scouting, which this version does not have', () => {
    expect(src('src/ui/screens/Settings.tsx')).toContain("SYSTEMS.filter((sys) => SCOUTING || sys.key !== 'scouting')");
  });
});
