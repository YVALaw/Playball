// drive.ts
// Store-driven career helpers for tests that play whole years.
//
// Everything goes through the same store actions the screens call — the
// Today buttons, the Postseason screen's sim buttons, CONTINUE on each
// offseason step — so a test that passes here is a test of what a player
// actually does, not of engine shortcuts (audit 17, Appendix B).
//
// Saving touches IndexedDB. A test file that imports this must mock `idb`
// the way saves.test.ts does if it wants saves to land; otherwise the store
// records the failed save in `saveState` and carries on.

import { useDynasty } from '../../src/state/store.js';
import { seasonComplete, DEFAULT_RULES, type SeasonRules } from '../../src/engine/season.js';
import type { DepthMode } from '../../src/state/depth.js';

export const S = () => useDynasty.getState();
export const flush = async (n = 6): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

export function startCareer(
  seed: number, team: number,
  opts: { mode?: DepthMode; rules?: Partial<SeasonRules>; god?: boolean } = {},
): void {
  S().start(seed, team, undefined, opts.mode ?? 'full', undefined, opts.god ?? false,
    { ...DEFAULT_RULES, ...(opts.rules ?? {}) });
  if (S().seasonOpener) S().dismissSeasonOpener();
  S().closeSeasonPlan();
}

/** Clear a lineup hold the way a coach would: AUTO, then keep every cover. */
export function resolveHolds(): void {
  const s = S();
  const team = s.season?.teams[s.userTeam]?.team;
  if (!team) return;
  s.autoLineup();
  for (const p of [...team.bench, ...team.bullpen]) s.keepCover(p.id);
}

/** The regular season to its end through Play season (inline in node). */
export async function simRegular(): Promise<void> {
  for (let i = 0; i < 50 && !seasonComplete(S().season!); i++) {
    const gate = S().lineupGate;
    await S().playSeason();
    await flush();
    if (S().lineupGate !== gate) resolveHolds();
  }
  if (!seasonComplete(S().season!)) throw new Error('season did not complete');
}

/** June through the bracket actions the Postseason screen calls. */
export async function playJune(): Promise<void> {
  await S().playPostseason();
  for (let i = 0; i < 500 && S().phase === null; i++) {
    const gate = S().lineupGate;
    if (S().myBracket) S().simBracket('rest'); else S().advanceBracket();
    if (S().lineupGate !== gate) resolveHolds();
    await flush(1);
  }
  if (S().phase !== 'awards') throw new Error(`June did not end on awards: ${S().phase}`);
}

/** The offseason, one CONTINUE per step. `at` runs before each press. */
export async function walkOffseason(at?: (phase: string) => void | Promise<void>): Promise<void> {
  for (let i = 0; i < 20 && S().phase !== null; i++) {
    const phase = S().phase!;
    if (at) await at(phase);
    if (S().phase !== phase) continue;
    await S().nextPhase(phase);
    await flush();
    if (S().phase === phase) throw new Error(`nextPhase refused to move from ${phase}`);
  }
}

export async function fullYear(at?: (phase: string) => void | Promise<void>): Promise<void> {
  await simRegular();
  await playJune();
  await walkOffseason(at);
  if (S().seasonOpener) S().dismissSeasonOpener();
  S().closeSeasonPlan();
  await flush();
}

type Rec = { team: { lineup: unknown[]; bench: unknown[]; rotation: unknown[]; bullpen: unknown[] } };
export const rosterOf = (t: Rec): Array<{ id: string; type?: string }> =>
  [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen] as Array<{ id: string; type?: string }>;

/** Player ids that sit on more than one roster, as `id:A+B`. */
export function duplicatePlayers(): string[] {
  const seen = new Map<string, Set<number>>();
  for (const [i, t] of S().season!.teams.entries()) {
    for (const p of new Set(rosterOf(t).map((x) => String(x.id)))) {
      const at = seen.get(p) ?? new Set<number>();
      at.add(i);
      seen.set(p, at);
    }
  }
  return [...seen].filter(([, at]) => at.size > 1).map(([id, at]) => `${id}:${[...at].join('+')}`);
}

export async function saveAndReload(): Promise<boolean> {
  await S().saveNow();
  await flush();
  const ok = await S().loadSlot(S().loadedSlot ?? 'auto');
  await flush();
  return ok;
}
