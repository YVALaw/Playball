// replay.ts
// Turning a finished game into something you can watch.
//
// The engine plays a game to completion in about a millisecond, which is right —
// making it pause for a human would mean rewriting the loop as a generator and
// threading that through the season, the worker and the bracket. So a game is
// simulated whole and then replayed, which is what every text sim of this kind
// actually does. Nothing is invented on the way out: every frame below comes
// from the log and the PlayEvent stream the engine already emitted.
//
// Two streams have to be aligned. `log` is human readable and carries the
// inning and the running score; `playEvents` carries outs and base runners but
// no text. They are matched on plate appearances, which are identifiable in the
// log because the engine prefixes those lines with the count — "[2-1 4p]".
//
// No screen renders these frames yet — the managed game shows the raw log, and
// there is no post-hoc replay view. This module is kept, with its tests, as the
// working alignment layer that screen will need; the tests are what stop the
// log format and the event stream drifting apart in the meantime. Deliberate,
// not forgotten.

import type { GameResult } from '../engine/game.js';
import type { PlayEvent, PlayerId } from '../engine/types.js';

export interface Frame {
  kind: 'inning' | 'play' | 'note';
  text: string;
  inning: number;
  half: 'top' | 'bottom';
  outs: number;
  /** First, second, third. */
  bases: [boolean, boolean, boolean];
  awayRuns: number;
  homeRuns: number;
  /** True on the frame where a run actually crossed, for a flash of red. */
  scored: boolean;
}

const HEADER = /--- (Top|Bottom) (\d+)\w+ --- \((\d+)-(\d+)\)/;

/** A plate appearance line starts with its count, e.g. "[1-2 5p] ...". */
const isPlay = (line: string): boolean => line.startsWith('[');

/**
 * Split the event stream into one group per plate appearance. A group is a run
 * of pitches followed by whatever those pitches produced, so a new group begins
 * at the first pitch after a non-pitch event.
 */
function groupByPlateAppearance(events: readonly PlayEvent[]): PlayEvent[][] {
  const groups: PlayEvent[][] = [];
  let current: PlayEvent[] = [];
  let sawOutcome = false;

  for (const e of events) {
    if (e.kind === 'pitch' && sawOutcome) {
      groups.push(current);
      current = [];
      sawOutcome = false;
    }
    if (e.kind !== 'pitch') sawOutcome = true;
    current.push(e);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * Where each runner is standing. Scoped to one replay — deliberately a local,
 * not a module level map, so two games replayed in the same session cannot
 * bleed into each other.
 */
type Diamond = Map<PlayerId, 1 | 2 | 3>;

function applyAdvances(diamond: Diamond, events: readonly PlayEvent[]): void {
  for (const e of events) {
    if (e.kind !== 'advance') continue;
    for (const m of e.runners ?? []) {
      if (m.to === 4) diamond.delete(m.id);      // scored, off the bases
      else diamond.set(m.id, m.to as 1 | 2 | 3);
    }
  }
}

function occupancy(diamond: Diamond): [boolean, boolean, boolean] {
  const bases: [boolean, boolean, boolean] = [false, false, false];
  for (const bag of diamond.values()) bases[bag - 1] = true;
  return bases;
}

export function buildFrames(result: GameResult): Frame[] {
  const groups = groupByPlateAppearance(result.playEvents);
  const frames: Frame[] = [];
  const diamond: Diamond = new Map();

  let inning = 1;
  let half: 'top' | 'bottom' = 'top';
  let awayRuns = 0;
  let homeRuns = 0;
  let outs = 0;
  let group = 0;

  for (const raw of result.log) {
    const line = raw.replace(/^\n/, '');
    const header = HEADER.exec(line);

    if (header) {
      half = header[1] === 'Top' ? 'top' : 'bottom';
      inning = Number(header[2]);
      awayRuns = Number(header[3]);
      homeRuns = Number(header[4]);
      outs = 0;                  // a new half inning starts clean
      diamond.clear();
      frames.push({
        kind: 'inning',
        text: `${half === 'top' ? '▲' : '▼'} ${inning}`,
        inning, half, outs, bases: [false, false, false],
        awayRuns, homeRuns, scored: false,
      });
      continue;
    }

    if (!isPlay(line)) {
      // A steal, a pitching change, a walk-off. No plate appearance consumed,
      // though a steal does move a runner — which the advance events cover.
      frames.push({
        kind: 'note',
        text: line.trim(),
        inning, half, outs, bases: occupancy(diamond),
        awayRuns, homeRuns, scored: false,
      });
      continue;
    }

    const events = groups[group++] ?? [];
    let scored = 0;
    for (const e of events) {
      if (e.kind === 'out') outs += e.outs ?? 0;
      if (e.kind === 'score') scored += e.runs ?? 0;
    }
    applyAdvances(diamond, events);

    if (half === 'top') awayRuns += scored; else homeRuns += scored;

    frames.push({
      kind: 'play',
      text: line,
      inning, half, outs, bases: occupancy(diamond),
      awayRuns, homeRuns, scored: scored > 0,
    });
  }

  return frames;
}
