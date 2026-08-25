// seasonCodec.ts
// Turning a live season into something that survives structured clone, and back.
//
// Two callers need this: IndexedDB saves, and the Web Worker, which has to send
// the world across a thread boundary. One copy, deliberately — two encoders that
// drift is the same failure as two engines that drift, and this project has
// already paid for that lesson once (B2).
//
// Only two things cannot make the trip. The RNG is a function, so its state
// travels as a number. The schedule is a pure function of the config, the shape
// of the world and the rotation, so it is rebuilt on arrival rather than carried
// — which also means it can never arrive out of step with the teams it belongs to.

import { rngFromState } from '../engine/rng.js';
import { buildSchedule, rebuildNameIndex, worldFromConferences } from '../engine/season.js';
import { strategyFor } from '../engine/strategy.js';
import { initialPrestige } from '../engine/program.js';
import { generateClass } from '../engine/recruiting.js';
import { CONFERENCES } from '../data/schools.js';
import type { SeasonState } from '../engine/season.js';

export type StoredSeason = Omit<SeasonState, 'rng' | 'schedule'>;

export interface Portable {
  season: StoredSeason;
  rngState: number;
}

export function toPortable(season: SeasonState): Portable {
  const { rng, schedule, ...rest } = season;
  void schedule;
  if (!rng.state) {
    throw new Error('this generator cannot be serialized: it has no state()');
  }
  return { season: rest, rngState: rng.state() };
}

export function fromPortable(p: Portable): SeasonState {
  // Backfill anything a save predates. A dynasty is meant to survive the engine
  // growing underneath it — refusing to load, or loading into a crash, is the
  // one outcome a save file must never have. Teams stored before coaching
  // strategy existed have no philosophy and no prestige; give them the same ones
  // a fresh world would have produced.
  for (const team of p.season.teams) {
    const t = team as Partial<typeof team>;
    if (!t.strategy) team.strategy = strategyFor(team.index);
    if (typeof t.prestige !== 'number') team.prestige = initialPrestige(team.def.prestige);
  }

  // Same rule one level up: a save written before fielding was kept has two stat
  // books instead of three. An empty one is the truthful state — nobody's
  // chances were ever recorded — and it means the season starts counting again
  // from the next pitch rather than every reader having to guard the map.
  p.season.fielding ??= new Map();

  // A third thing no save carries, and the only one that lives outside the save
  // entirely: the pool of names already spoken for is module state in
  // players.ts, so arriving here means the process may know nothing about the
  // world it is about to run. Rebuild it from the players this save holds. This
  // is the one door every arrival comes through — a load, and every message the
  // sim worker is handed — which is exactly why it belongs here and not at the
  // call sites.
  rebuildNameIndex(p.season);

  return {
    ...p.season,
    rng: rngFromState(p.rngState),
    schedule: buildSchedule(
      p.season.config,
      worldFromConferences(CONFERENCES),
      p.season.scheduleRotation,
    ),
  };
}
