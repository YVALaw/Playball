// simWorker.ts
// The simulation, off the main thread.
//
// A full 64-team season takes a few hundred milliseconds on a desktop and will be several
// times that on a mid-range phone. Run on the main thread that is a frozen
// screen — no scroll, no tap response, no spinner, because a spinner needs
// frames too. So the world crosses to a worker, gets played, and comes back.
//
// The crossing costs a structured clone of roughly a megabyte each way. That is
// the trade: a few tens of milliseconds of copying to avoid a second of a dead
// interface. If the world grows enough that the copy starts to hurt, the answer
// is to keep the world here permanently and send the main thread only what the
// screens display — the codec boundary is already in the right place for that.

import * as Comlink from 'comlink';
import { simNextDay, seasonComplete } from '../engine/season.js';
import { advanceOffseason, type OffseasonReport, type OffseasonOpts } from '../engine/progression.js';
import { fromPortable, toPortable, type Portable } from './seasonCodec.js';

export interface SimProgress {
  day: number;
  totalDays: number;
}

export type ProgressFn = (p: SimProgress) => void;

const api = {
  /**
   * Play the rest of the regular season, reporting as it goes.
   *
   * Progress is posted per simulated day rather than per game: 3,168 messages
   * would cost more than the simulation. A day is also the unit the player
   * understands.
   */
  async simSeason(portable: Portable, onProgress?: ProgressFn): Promise<Portable> {
    const season = fromPortable(portable);
    const total = season.schedule.length;

    while (!seasonComplete(season)) {
      simNextDay(season);
      if (onProgress) await onProgress({ day: season.dayIndex, totalDays: total });
    }

    return toPortable(season);
  },

  simDay(portable: Portable): Portable {
    const season = fromPortable(portable);
    if (!seasonComplete(season)) simNextDay(season);
    return toPortable(season);
  },

  offseason(
    portable: Portable, opts: OffseasonOpts = {},
  ): { portable: Portable; report: OffseasonReport } {
    const season = fromPortable(portable);
    const report = advanceOffseason(season, season.rng, opts);
    return { portable: toPortable(season), report };
  },
};

export type SimApi = typeof api;

Comlink.expose(api);
