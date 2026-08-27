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
// of the world and the rotation, so it is rebuilt on arrival rather than carried.
//
// That last claim used to come with a caveat nobody had noticed: the shape of
// the world was read from `data/schools.ts` at the moment of arrival, so it was
// today's world and not the one the save was written in. It is now read off the
// saved teams themselves, which is what makes the sentence above actually true —
// a rebuilt schedule cannot arrive out of step with the teams it belongs to,
// because it is built from them.

import { noFeats } from '../engine/achievements.js';
import { ageFor } from '../engine/players.js';
import { rngFromState } from '../engine/rng.js';
import { buildSchedule, rebuildNameIndex, worldFromTeams } from '../engine/season.js';
import { strategyFor } from '../engine/strategy.js';
import { initialPrestige } from '../engine/program.js';
import { seededBook } from '../engine/records.js';
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

  // The same rule one level down: a save written before players had ages holds
  // men whose age is simply absent, and draft eligibility reads it. Backfilled
  // rather than made optional on the type, because "optional" would put a
  // fallback at every one of the dozen places that print it and one of them
  // would eventually get it wrong. `ageFor` reproduces exactly what the
  // generator would have given him, so a resumed dynasty and a fresh one agree.
  for (const team of p.season.teams) {
    for (const man of [
      ...team.team.lineup, ...team.team.bench,
      ...team.team.rotation, ...team.team.bullpen,
    ]) {
      if (typeof man.age !== 'number') man.age = ageFor(man.id, man.classYear);
    }
  }
  for (const prospect of p.season.recruiting?.prospects ?? []) {
    if (typeof prospect.player.age !== 'number') {
      prospect.player.age = ageFor(prospect.player.id, prospect.player.classYear);
    }
  }

  // Same rule one level up: a save written before fielding was kept has two stat
  // books instead of three. An empty one is the truthful state — nobody's
  // chances were ever recorded — and it means the season starts counting again
  // from the next pitch rather than every reader having to guard the map.
  p.season.fielding ??= new Map();

  // And exactly the same rule for June's own two books, which are newer still.
  // A save from before the postseason split simply has no record of who hit in
  // which tournament, and no amount of arithmetic can recover it — season
  // totals include June rather than excluding it, so there is nothing to
  // subtract. Empty is the truthful state, and the split starts counting from
  // this dynasty's next postseason.
  p.season.postBatting ??= new Map();
  p.season.postPitching ??= new Map();

  // And one that only exists for the width of an offseason: a save written
  // between the draft phase and signing day carries a board, and a board from
  // before the other ninety five programs could keep anybody has no ledger of
  // what they spent. An empty one is the truthful state — nobody spent
  // anything, because nobody could — and it keeps the recruiting week from
  // reading a field off undefined.
  if (p.season.draft) p.season.draft.rivalSpend ??= {};

  // And the record book, which is the same rule with one extra clause. An empty
  // book is *not* the truthful state for a save that predates it: the seeded
  // NCAA marks are not something the dynasty earned, they are the starting
  // position of every dynasty, and a career carried forward should arrive at the
  // same book a new one opens with rather than at a blank page that reads as a
  // bug. The streak counter alongside it is genuinely empty — nobody's scoreless
  // run was ever being counted — so it starts at nothing.
  p.season.records ??= seededBook();
  p.season.scorelessOuts ??= new Map();
  // The running career totals under the career section of that book, and this
  // one is genuinely empty rather than seeded. Nobody's career was being counted
  // in a save written before it existed, so counting honestly starts now — the
  // career records such a dynasty sets will be short by whatever was played
  // before the upgrade, which is a smaller lie than inventing the missing
  // seasons would be. The hall of fame beside it needs no clause at all: an empty
  // hall is the truth about a dynasty that never inducted anybody, and every man
  // in its archive is considered at the next year roll.
  p.season.careerTotals ??= new Map();
  // And the feats beside it, which are genuinely empty on an old save for the
  // same reason the scoreless counter is: nobody was watching for them, so the
  // honest state is that this season has produced none yet. A season resumed in
  // May will simply start counting from the next game.
  p.season.feats ??= noFeats();
  // And what you have watched of your own men, which is genuinely empty on a
  // save from before tendencies existed. That is the right answer rather than a
  // kindness: nobody had been watching, so nothing is known yet, and the coach
  // starts learning about the roster he already has from its next game. Badges
  // need no clause of their own — a player written before them simply has no
  // `badges` field, which is the truth about him.
  p.season.watch ??= new Map();

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
    // Rebuilt from the teams this save holds, not from `CONFERENCES`. See
    // `worldFromTeams`: the data file is what the world looks like today, and a
    // career is entitled to the world it was played in.
    schedule: buildSchedule(
      p.season.config,
      worldFromTeams(p.season.teams),
      p.season.scheduleRotation,
    ),
  };
}
