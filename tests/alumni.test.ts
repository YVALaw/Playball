// alumni.test.ts
// The alumni book holds men who left. A man talked into returning did not.
//
// Reported 2026-09-10: "there are 2 players I talked into returning and when
// the season started I went to alumni and they were there but also in my
// roster." The book is written on the way into the draft step, one note per
// man the clubs took, before the coach has had his say — and keeping a man
// left his note standing.

import { describe, it, expect, vi } from 'vitest';
import { KEEP_PITCHES, type DraftBoard } from '../src/engine/draft.js';
import { useDynasty, PHASES } from '../src/state/store.js';
import { simSeason } from '../src/engine/season.js';
import type { AlumnusNote } from '../src/engine/legacy.js';

// IndexedDB is not in node; the same Map-backed stand-in the saves suite uses.
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

const rosterIds = (): Set<string> => {
  const s = useDynasty.getState();
  const t = s.season!.teams[s.userTeam]!.team;
  return new Set([...t.lineup, ...t.bench, ...t.rotation, ...t.bullpen].map((p) => String(p.id)));
};

describe('the alumni book', () => {
  it('tears up the note of a man talked into returning', async () => {
    /*
      A programme with a man the clubs took late enough to argue with. This
      used to be team 0 and always found one; once the generator aged its
      seniors into their class (05 §83) every man drafted off that 66-quality
      roster went inside the first rounds, where no case can keep him, and
      the weakest programme in the world had nobody drafted at all. So the
      precondition is found rather than assumed — not a hunt for a lucky
      seed, the shape the test needs stated and then located — and the
      property is asserted on whichever programme has it.
    */
    let board: DraftBoard | null = null;
    let kept: string | null = null;
    for (const team of [0, 12, 24, 36, 48, 60, 72, 84]) {
      useDynasty.getState().start(4242, team);
      // A played season, then one step from the coach's sheet into the draft,
      // which is the step that runs the departures and writes the book.
      simSeason(useDynasty.getState().season!);
      useDynasty.setState({ phase: 'coach', furthestPhase: PHASES.indexOf('coach') });
      await useDynasty.getState().nextPhase();
      expect(useDynasty.getState().phase).toBe('draft');
      board = useDynasty.getState().season!.draft!;
      const pending = board.men.filter((m) => m.outcome === 'pending');
      if (pending.length === 0) continue;

      // Every man the clubs took is in the book the moment the step opens.
      for (const m of pending) expect(useDynasty.getState().alumni[String(m.player.id)]).toBeDefined();

      // Make a case to each, latest round first. One case per man, a bounded
      // offer so a refusal does not drain the till for the next, and a
      // different pitch each time, because what a man can be talked round
      // with is his own business — a ring means little at a programme that
      // has never won one.
      let i = 0;
      for (const m of [...pending].sort((a, b) => b.round - a.round)) {
        useDynasty.getState().keepPlayer(m.player.id, KEEP_PITCHES[i++ % KEEP_PITCHES.length]!, 120);
        if (m.outcome === 'stayed') { kept = String(m.player.id); break; }
      }
      if (kept) break;
    }
    expect(kept, 'no programme in eight had a man who could be talked round').not.toBeNull();
    expect(board).not.toBeNull();

    // He is on the roster and out of the book; the men who went stay in it.
    expect(rosterIds().has(kept!)).toBe(true);
    expect(useDynasty.getState().alumni[kept!]).toBeUndefined();
    for (const m of board!.men) {
      if (m.outcome === 'gone') expect(useDynasty.getState().alumni[String(m.player.id)]).toBeDefined();
    }
  });

  it('opens a save without the men who are standing on the roster', async () => {
    useDynasty.getState().start(4242, 0);
    const s = useDynasty.getState();
    const team = s.season!.teams[s.userTeam]!.team;
    const man = team.lineup[0]!;
    const abbr = s.season!.teams[s.userTeam]!.def.abbr;
    const note = (name: string): AlumnusNote => ({
      name, teamAbbr: abbr, year: s.year, reason: 'drafted', round: 3, overall: 60, classYear: 'JR',
    });
    // The state a save from before the fix is in: a kept man still in the book,
    // beside a genuine alumnus.
    useDynasty.setState({ alumni: { [String(man.id)]: note(man.name), ghost: note('Somebody Gone') } });
    await useDynasty.getState().saveNow('alumni-heal');

    useDynasty.setState({ alumni: {} });
    expect(await useDynasty.getState().loadSlot('alumni-heal')).toBe(true);
    const book = useDynasty.getState().alumni;
    expect(book[String(man.id)]).toBeUndefined();
    expect(book.ghost).toBeDefined();
  });
});
