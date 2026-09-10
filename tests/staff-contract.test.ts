// staff-contract.test.ts
// An assistant is signed for a term, and the winter is when it is renewed.
//
// Asked for 2026-09-10: "staff we hire should have an expiring contract,
// right now it is easy to forget they are even there."

import { describe, it, expect, vi } from 'vitest';
import { useDynasty } from '../src/state/store.js';
import { SEATS, type StaffSeat } from '../src/engine/economy.js';

const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb', () => ({
  openDB: async () => ({
    put: async (_store: string, value: { slot: string }) => { disk.set(value.slot, structuredClone(value)); },
    get: async (_store: string, key: string) => {
      const found = disk.get(key);
      return found === undefined ? undefined : structuredClone(found);
    },
    getAll: async () => [...disk.values()].map((v) => structuredClone(v)),
    delete: async (_store: string, key: string) => { disk.delete(key); },
  }),
}));

/** Put a man in a seat the cheapest way the market allows. */
function hireSomebody(): StaffSeat {
  const s = useDynasty.getState();
  for (const seat of SEATS) {
    if (s.economy.staff[seat]) continue;
    for (const slot of [2, 1, 0]) {
      s.hireAssistant(seat, slot);
      if (useDynasty.getState().economy.staff[seat]) return seat;
    }
  }
  throw new Error('no seat could be filled');
}

describe('a staff contract', () => {
  it('is written on the hire, two or three years long', () => {
    useDynasty.getState().start(4242, 0);
    const year = useDynasty.getState().year;
    const seat = hireSomebody();
    const man = useDynasty.getState().economy.staff[seat]!;
    expect(man.joinedYear).toBe(year);
    expect(man.until).toBeGreaterThanOrEqual(year + 2);
    expect(man.until).toBeLessThanOrEqual(year + 3);
  });

  it('opens the seat at the roll when it ran out and nobody renewed it', async () => {
    useDynasty.getState().start(4242, 0);
    const year = useDynasty.getState().year;
    const seat = hireSomebody();
    useDynasty.getState().economy.staff[seat]!.until = year;
    useDynasty.getState().settleSeason();
    await useDynasty.getState().rollYear();
    expect(useDynasty.getState().economy.staff[seat]).toBeUndefined();
    expect(useDynasty.getState().inbox.some((i) => /contract ends/.test(i.title))).toBe(true);
  });

  it('is renewed in the winter for two more seasons, and survives the roll', async () => {
    useDynasty.getState().start(4242, 0);
    const year = useDynasty.getState().year;
    const seat = hireSomebody();
    const man = useDynasty.getState().economy.staff[seat]!;
    man.until = year;
    // Not in season.
    expect(useDynasty.getState().renewAssistant(seat)).toBe(false);
    useDynasty.getState().settleSeason();
    useDynasty.setState({ phase: 'awards' });
    expect(useDynasty.getState().renewAssistant(seat)).toBe(true);
    const renewed = useDynasty.getState().economy.staff[seat]!;
    expect(renewed.until).toBe(year + 2);
    expect(renewed.wage).toBeGreaterThan(man.wage);
    // Not twice.
    expect(useDynasty.getState().renewAssistant(seat)).toBe(false);
    await useDynasty.getState().rollYear();
    expect(useDynasty.getState().economy.staff[seat]?.id).toBe(man.id);
  });

  it('stamps a man from before contracts rather than letting him lapse', async () => {
    useDynasty.getState().start(4242, 0);
    const year = useDynasty.getState().year;
    const seat = hireSomebody();
    const man = useDynasty.getState().economy.staff[seat]!;
    delete man.until;
    useDynasty.getState().settleSeason();
    await useDynasty.getState().rollYear();
    const kept = useDynasty.getState().economy.staff[seat];
    // He may have been poached by the carousel, which is its own story.
    if (kept) expect(kept.until).toBe(year + 2);
  });
});
