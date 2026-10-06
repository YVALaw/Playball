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
import { useDynasty } from '../src/state/store.js';
import {
  S, startCareer, fullYear, simRegular, playJune, walkOffseason, flush, rosterOf, duplicatePlayers, saveAndReload,
} from './support/drive.js';

process.on('unhandledRejection', () => {});
const KNOWN = process.env['AUDIT_BUGS_STRICT'] === '1' ? it : it.fails;

describe('known release blockers (audit 17)', () => {
  it('C4: a job taken while a managed game waits does not record that game twice', async () => {
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
    const chair = S().userTeam;
    await S().acceptOffer(offer!.team);
    expect(S().userTeam, 'the offer is refused while the game waits').toBe(chair);
    await S().startManagedGame();
    S().autoFinish();
    await S().endManagedGame();
    const fixture = S().season!.results.filter((r) => r.day === meta.day && r.home === meta.home && r.away === meta.away);
    expect(fixture.length).toBe(1);
  }, 240_000);

  it('C3: god mode cannot leave a team with no starting pitcher', async () => {
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

  it('C2: a player god-cut from the transfer portal is not signed by another program', async () => {
    disk.clear();
    startCareer(2024, 40, { god: true });
    await flush();
    await simRegular();
    await playJune();
    for (let i = 0; i < 12 && S().phase !== 'portal'; i++) await S().nextPhase(S().phase!);
    expect(S().phase, 'the setup needs the portal step').toBe('portal');
    const pool = S().portal?.available ?? [];
    const cut = pool.slice(0, 3).map((m) => m.player.id);
    const gone = cut.filter((id) => S().godCutPlayer(id));
    expect(gone.length, 'the setup needs at least one accepted cut').toBeGreaterThan(0);
    await S().nextPhase('portal');
    await flush();
    const onRosters = S().season!.teams.flatMap((t) => rosterOf(t).map((p) => String(p.id)));
    for (const id of gone) expect(onRosters).not.toContain(String(id));
    expect(duplicatePlayers()).toEqual([]);
  }, 240_000);

  it('H3: a league trade made after the regular season waits for next spring', async () => {
    disk.clear();
    startCareer(9001, 30, { god: true, rules: { realignment: false } });
    await flush();
    await simRegular();
    const T = () => S().season!.teams;
    const a = 30;
    const b = T().find((t) => t.conference !== T()[a]!.conference)!.index;
    const [ca, cb] = [T()[a]!.conference, T()[b]!.conference];
    expect(S().godSwapConferences(a, b)).toBe(true);
    expect(T()[a]!.conference, 'this June keeps the leagues it was played in').toBe(ca);
    expect(T()[b]!.conference).toBe(cb);
    await playJune();
    await walkOffseason();
    expect(T()[a]!.conference, 'the trade lands next spring').toBe(cb);
    expect(T()[b]!.conference).toBe(ca);
  }, 240_000);

  it('H2: stepping out of the dugout and being killed still offers the game back', async () => {
    disk.clear();
    const mem = new Map<string, string>();
    (globalThis as { window?: unknown }).window = { localStorage: {
      get length() { return mem.size; }, key: (i: number) => [...mem.keys()][i] ?? null,
      getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, String(v)); },
      removeItem: (k: string) => { mem.delete(k); }, clear: () => { mem.clear(); },
    } };
    try {
      useDynasty.setState({ live: null, liveMeta: null, pendingGame: null });
      startCareer(4242, 0);
      S().autoLineup();
      await S().startManagedGame();
      expect(S().live).not.toBeNull();
      for (let i = 0; i < 6; i++) {
        const pick = S().live?.pending?.options.find((o) => o.available);
        if (pick) S().submitTactic(pick.tactic);
      }
      S().leaveGame();
      await S().saveNow();
      const slot = S().loadedSlot!;
      S().backToStart();
      expect(await S().loadSlot(slot)).toBe(true);
      expect(S().pendingGame, 'the interrupted game is offered back').not.toBeNull();
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  }, 120_000);

  it('H7: walking back to a closed portal and reloading does not open a second window', async () => {
    disk.clear();
    startCareer(4242, 5);
    await flush();
    await simRegular();
    await playJune();
    for (let i = 0; i < 12 && S().phase !== 'signing'; i++) await S().nextPhase(S().phase!);
    expect(S().phase, 'the setup needs signing day').toBe('signing');
    S().goPhase('portal');
    expect(S().phase, 'the closed portal cannot be walked back onto').toBe('signing');
    expect(S().stepBack()).not.toBe('none');
    expect(S().phase, 'back skips the closed portal').not.toBe('portal');
    await saveAndReload();
    expect(S().portal).toBeNull();
  }, 240_000);
});
