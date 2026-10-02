// quiet-season.test.ts
// The season is quiet (2026-09-28). Closing a recruiting week posts no letter:
// the board's "Week N is over" callout is the week's news, and a finished staff
// project lands on its report (the coach's Recent results, the man's card).
// Home's to-do carries no staff or building rows; those live in the Office.
// And a recruiting-linked letter an old save still holds keeps its link.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_s: string, v: { slot: string }) => { disk.set(v.slot, structuredClone(v)); },
    get: async (_s: string, k: string) => {
      const found = disk.get(k);
      return found === undefined ? undefined : structuredClone(found);
    },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_s: string, k: string) => { disk.delete(k); },
  }),
}));

import { useDynasty } from '../src/state/store.js';
import { handles } from '../src/state/depth.js';
import { marketFor, staffPlan, type Economy } from '../src/engine/economy.js';
import { projectCandidates } from '../src/engine/staffProjects.js';
import { newItem, restoreInbox, type InboxLink } from '../src/engine/inbox.js';
import { uniquePlayers, type Hitter } from '../src/engine/types.js';

const s = () => useDynasty.getState();

beforeEach(() => { disk.clear(); s().newDynasty(); });

describe('a quiet season', () => {
  it('closes a hands-on week without a letter and keeps the board recap', () => {
    s().start(4242, 0);
    expect(handles(s().depth, 'recruiting')).toBe(true);
    const season = s().season!;
    season.recruiting.week = 1;
    // A target and a whole unspent week: the old recap always wrote about this.
    const target = season.recruiting.prospects.find((p) => p.signedBy === null)!;
    target.points[s().userTeam] = 5;
    useDynasty.setState({ inbox: [] });

    s().advanceRecruitingWeek();

    expect(s().inbox).toEqual([]);
    expect(s().lastWeek?.closed).toBe(1);
    expect(s().season!.recruiting.week).toBe(2);
  });

  it('finishes a legacy project with a report and no letter', () => {
    s().start(4242, 0);
    const team = s().season!.teams[s().userTeam]!.team;
    const playerId = String(projectCandidates(team, 'hitting', 'hitting-contact')[0]!.id);
    const man = (): Hitter => uniquePlayers([...team.lineup, ...team.bench])
      .find((p) => String(p.id) === playerId) as Hitter;
    const before = man().contact;

    const eco = s().economy;
    const economy: Economy = {
      ...eco,
      staff: { ...eco.staff, hitting: marketFor('probe', 2027, 'hitting')[0]! },
      built: ['cage', 'pen', 'clubhouse'],
      facilities: 3,
      facilityLevels: { cage: 1, pen: 1, clubhouse: 1 },
      // Built by hand, so the test does not lean on how startStaffProject makes one.
      staffPlans: {
        ...(eco.staffPlans ?? {}),
        hitting: {
          directive: 'balanced',
          project: {
            kind: 'hitting-contact', weeksTotal: 5, weeksLeft: 1, startedWeek: 1,
            playerId, targetIds: [playerId], targetCount: 1, odds: 1,
          },
        },
      },
    };
    useDynasty.setState({ economy, inbox: [] });
    s().season!.recruiting.week = 1;

    s().advanceRecruitingWeek();

    const report = s().economy.projectHistory![0]!;
    expect(report.kind).toBe('hitting-contact');
    expect(report.took).toBe(true);
    expect(man().contact).toBeGreaterThan(before);
    expect(staffPlan(s().economy, 'hitting').project).toBeUndefined();
    expect(s().inbox).toEqual([]);
  });

  it('keeps every inbox destination through a reload', () => {
    const links: InboxLink[] = [
      { to: 'player', id: 'p-1' },
      { to: 'team', index: 3 },
      { to: 'program', sheet: 'board' },
      { to: 'program', sheet: 'coach' },
      { to: 'program', sheet: 'hall' },
      { to: 'book' },
      { to: 'schedule' },
      { to: 'standings' },
      { to: 'rankings' },
      { to: 'recruiting' },
    ];
    const items = links.map((link, i) => newItem({
      year: 2026, kind: 'season', key: `link-${i}`, title: `Letter ${i}`, body: '', link,
    }));
    const restored = restoreInbox(JSON.parse(JSON.stringify(items)));
    expect(restored.map((i) => i.link)).toEqual(links);
  });

  it('keeps staff and building rows off Home', () => {
    const today = readFileSync('src/ui/screens/Today.tsx', 'utf8');
    for (const gone of [
      '`hire-${', '`locked-${', '`ready-${', '`plan-${', '`facility-${',
      'openStaffDesk', 'openFacilityRoom', 'staffWorkStatus',
    ]) {
      expect(today, gone).not.toContain(gone);
    }
  });
});
