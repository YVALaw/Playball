// audit-known-bugs.test.ts
// Reproductions of the release-blocking defects in docs/17-pre-release-audit.md,
// written as the behaviour the game SHOULD have.
//
// Each is `it.fails` while the bug stands: vitest passes a test marked `fails`
// only when its assertions fail. The commit that fixes a bug flips its test to
// `it`, so the fix and its regression test land together (docs/18-fix-plan.md).

import { describe, it, expect, vi } from 'vitest';

const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_s: string, v: { slot: string }) => { disk.set(v.slot, structuredClone(v)); },
    get: async (_s: string, k: string) => { const f = disk.get(k); return f === undefined ? undefined : structuredClone(f); },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_s: string, k: string) => { disk.delete(k); },
  }),
}));

import { isTwoWay } from '../src/engine/types.js';
import {
  S, startCareer, fullYear, simRegular, playJune, flush, rosterOf, duplicatePlayers, saveAndReload,
} from './support/drive.js';

process.on('unhandledRejection', () => {});
const KNOWN = process.env['AUDIT_BUGS_STRICT'] === '1' ? it : it.fails;

describe('known release blockers (audit 17)', () => {
  KNOWN('C4: a job taken while a managed game waits does not record that game twice', async () => {
    disk.clear();
    startCareer(4242, 5);
    await flush();
    const s0 = S().season!;
    const weak = [...s0.teams].filter((t) => t.index !== S().userTeam).sort((a, b) => a.prestige - b.prestige);
    for (const t of weak.slice(0, 3)) S().approach(t.index);
    for (const t of weak.slice(3, 9)) S().toggleJobWatch(t.def.abbr);
    await fullYear();
    const offer = S().offers[0];
    expect(offer, 'the setup needs a standing offer').toBeDefined();
    await S().startManagedGame();
    const meta = S().liveMeta!;
    S().leaveGame();
    await S().acceptOffer(offer!.team);
    await S().startManagedGame();
    S().autoFinish();
    await S().endManagedGame();
    const fixture = S().season!.results.filter((r) => r.day === meta.day && r.home === meta.home && r.away === meta.away);
    expect(fixture.length).toBe(1);
  }, 240_000);

  KNOWN('C3: god mode cannot leave a team with no starting pitcher', async () => {
    disk.clear();
    startCareer(555, 21, { god: true });
    await flush();
    for (let i = 0; i < 3; i++) S().advanceDay();
    const victim = (21 + 30) % S().season!.teams.length;
    const rec = () => S().season!.teams[victim]!;
    const bencher = rec().team.bench.find((h) => !isTwoWay(h))!;
    S().godTwoWay(bencher.id, true);
    const pure = () => [...rec().team.rotation, ...rec().team.bullpen].filter((a) => a.type === 'pitcher');
    for (let g = 0; g < 40 && pure().length > 0; g++) if (!S().godCutPlayer(pure()[0]!.id)) break;
    S().godTwoWay(bencher.id, false);
    expect(rec().team.rotation.length).toBeGreaterThan(0);
    expect(() => S().advanceDay()).not.toThrow();
    expect(await saveAndReload()).toBe(true);
  }, 120_000);

  KNOWN('C2: a player god-cut from the transfer portal is not signed by another program', async () => {
    disk.clear();
    startCareer(2024, 40, { god: true });
    await flush();
    await simRegular();
    await playJune();
    for (let i = 0; i < 12 && S().phase !== 'portal'; i++) await S().nextPhase(S().phase!);
    expect(S().phase, 'the setup needs the portal step').toBe('portal');
    const pool = S().portal?.available ?? [];
    const cut = pool.slice(0, 3).map((m) => m.player.id);
    for (const id of cut) S().godCutPlayer(id);
    await S().nextPhase('portal');
    await flush();
    const onRosters = S().season!.teams.flatMap((t) => rosterOf(t).map((p) => String(p.id)));
    for (const id of cut) expect(onRosters).not.toContain(String(id));
    expect(duplicatePlayers()).toEqual([]);
  }, 240_000);

  KNOWN('H7: walking back to a closed portal and reloading does not open a second window', async () => {
    disk.clear();
    startCareer(4242, 5);
    await flush();
    await simRegular();
    await playJune();
    for (let i = 0; i < 12 && S().phase !== 'signing'; i++) await S().nextPhase(S().phase!);
    expect(S().phase, 'the setup needs signing day').toBe('signing');
    S().goPhase('portal');
    await saveAndReload();
    expect(S().portal).toBeNull();
  }, 240_000);
});
