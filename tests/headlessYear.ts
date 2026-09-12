// headlessYear.ts
// One offseason, the way the store runs it, minus the screens.
//
// Extracted from `climb-probe.ts`, which had it first and paid for every line
// of it — the comments below are its scars and they are kept verbatim, because
// each one records a way this is easy to get wrong.
//
// IT ARRIVED WITH ONE MORE SCAR THAN IT LOOKED LIKE, and the story is worth the
// space because the mistake is so easy to make twice.
//
// `climb-probe.ts` carries a block headed **"KNOWN WRONG — do not read numbers
// off this file yet"**, which begins on the line after the function this file
// was cut from. Its point: the engine has no recruiting driver. `aiTargets` and
// `closeWeek` live in `state/store.ts` and nothing in `src/engine` calls them,
// so a harness assembled out of engine parts signs **nobody**. Every hole then
// falls through `fillRosters` to `walkOnHitter`/`walkOnArm` at quality minus
// thirteen, walk-ons are released after a season, and by year five not one man
// in the country has ever been through `develop()`. The probe's own numbers —
// fourteen wins a year for ever, a prestige line converging to 34, nobody
// reaching Omaha — were all that bug and none of them were facts about the game.
//
// The first version of this file inherited exactly that, silently, and a
// calibration guard was built on it the same day. So the recruiting window is
// here now, driven the way `tests/carousel-probe.ts` and `tests/hall.test.ts`
// already drive it, and `headlessYear` returns how many men signed so a caller
// can refuse to believe a season where nobody did.
//
// **The check worth stealing, which `climb-probe` also wrote down: change an
// input and confirm the output moves.** Raising `PIPELINE_EDGE` by eighty
// percent changed not one digit of the old harness, which is only possible if
// the thing you think you are measuring is not running.
//
// It lives here rather than in `src/engine` on purpose. The offseason belongs
// to the store: it is seven screens, a rail a coach can walk backwards along,
// and a dozen decisions the engine deliberately does not make for him. This is
// the *measurement* version — every decision handed to the same automatic staff
// the other ninety-five programs get — and shipping it beside the real one
// would be inviting somebody to call it instead.
//
// Anything that measures a world older than one season should call this rather
// than write its own, which is the whole reason it moved out of the probe.

import { nextSeason, seasonLength, type SeasonState } from '../src/engine/season.js';
import { departAndDevelop, fillRosters, holesFor } from '../src/engine/progression.js';
import { prestigeStars } from '../src/engine/program.js';
import { openPortal, staffWorksPortal, releaseFrom } from '../src/engine/portal.js';
import { runRivalYear } from '../src/engine/rivals.js';
import type { PostseasonSummary } from '../src/engine/postseason.js';
import {
  windowBudget, RECRUITING_WEEKS, aiTargets, closeWeek, leadersAtWeekStart,
  resetWeeklySpend, weeklyPoints,
} from '../src/engine/recruiting.js';
import { pitchFor, developmentScore } from '../src/engine/pitch.js';
import { CONFERENCES, type Region } from '../src/data/schools.js';
import { setMood, settleMood, squadRanks } from '../src/engine/morale.js';
import { healUp } from '../src/engine/injury.js';
import { resetWorkload } from '../src/engine/workload.js';
import type { Player } from '../src/engine/types.js';

/**
 * The recruiting window, as the store runs it, with every chair on the AI.
 *
 * Copied in shape from `tests/carousel-probe.ts` and `tests/hall.test.ts`,
 * which drive it the same way and have done since before this file existed.
 * Without it nothing in the country signs and the whole league turns walk-on
 * inside four years — see this file's header.
 *
 * Every program recruits on the automatic driver, the user's included. That is
 * the honest default for a measurement: it asks what the WORLD does, not what a
 * particular coach's board would have done.
 */
function recruitWindow(season: SeasonState): number {
  const regionOf = (i: number): Region =>
    CONFERENCES.find((c) => c.id === season.teams[i]?.conference)?.region ?? 'Gulf';
  for (let w = 1; w <= RECRUITING_WEEKS; w++) {
    season.recruiting.week = w;
    const atWeekStart = leadersAtWeekStart(season.recruiting);
    for (const record of season.teams) {
      const pitch = pitchFor(season, record, regionOf(record.index), developmentScore(record));
      const staff = record.coach;
      const need = holesFor([
        ...record.team.lineup, ...record.team.bench,
        ...record.team.rotation, ...record.team.bullpen,
      ]).reduce((a, h) => a + h.count, 0);
      for (const { prospect, actions } of aiTargets(
        record.index, pitch, staff?.prestige ?? 45, season.recruiting.prospects,
        need, season.rng, atWeekStart,
        season.draft?.rivalSpend[record.index] ?? 0,
      )) {
        prospect.points[record.index] = (prospect.points[record.index] ?? 0)
          + weeklyPoints(
            prospect, pitch, actions, staff?.prestige ?? 45, staff?.skills.recruiting ?? 20,
          );
      }
    }
    closeWeek(season.recruiting, season.rng, w >= RECRUITING_WEEKS);
    resetWeeklySpend(season.recruiting);
  }
  return season.recruiting.prospects.filter((p) => p.signedBy !== null).length;
}

/**
 * How many men the country signed in the most recent `headlessYear`.
 *
 * Exported so a measurement can refuse to believe itself. A season where this
 * is nought is not a quiet season, it is a broken harness — and that is not
 * hypothetical, it is what the first version of this file did.
 */
export let lastSigned = 0;

/** One offseason, the way the store runs it, minus the screens. */
export function headlessYear(
  season: SeasonState, me: number, post: PostseasonSummary | null,
): SeasonState {
  /*
    Prestige moves here, and leaving it out invalidated the first two runs.

    `nextPrestige` is only ever called from `reviewSeason`, which the store runs
    for the coached programme, and from `runRivalYear`, which it runs for the
    other ninety-five. This probe called neither -- so every programme in the
    country sat on its opening prestige for thirty seasons and *no* climb was
    possible for anybody, which is not a finding about the game at all.

    It read as one: a one-star programme showed prestige 19 in year one and 19
    in year thirty, ten worlds out of ten. That is exactly what a broken ladder
    would look like, which is why it needed checking rather than believing.
  */
  runRivalYear(season, post, {
    year: season.year ?? 0,
    userTeam: -1,                 // -1 so the coached programme is graded too
    games: seasonLength(season.config),
  });
  const rec = season.teams[me]!;
  const games = rec.w + rec.l;
  const ranks = squadRanks(rec.team);

  // Mood settles against the promise, exactly as the store does it in June.
  for (const p of [...rec.team.lineup, ...rec.team.bench]) {
    setMood(p, settleMood(p, {
      starts: (p as Player & { starts?: number }).starts ?? 0,
      games,
      squadRank: ranks.get(p.id) ?? 20,
      winPct: games > 0 ? rec.w / games : 0.5,
    }));
  }

  /*
    The order matters, and getting it wrong crashes the game.

    The store runs departures on the way into the draft, the portal one step
    later, and `fillRosters` at the year roll -- so the portal empties rosters
    and the refill puts them back. This probe originally called
    `advanceOffseason`, which is both halves at once, and so refilled *before*
    emptying: the next season opened with short rosters and the engine threw
    "Newport Bay Whalers has an empty lineup slot".

    That was the probe's bug rather than the game's, but it is worth the note --
    the two halves are separable for exactly this reason and anything that
    removes players has to sit between them.
  */
  departAndDevelop(season, season.rng, { userTeam: me });

  // The portal, both directions, with every staff shopping it.
  const pool = openPortal(season.teams, {
    year: season.year ?? 0, seed: season.seed ?? 0, games,
  });
  const taken = new Set<string>();
  for (const other of season.teams) {
    const going = pool.filter((m) => !taken.has(String(m.player.id)) && m.from !== other.index);
    if (going.length === 0) break;
    for (const m of staffWorksPortal(other.team, going, windowBudget(prestigeStars(other.prestige)))) {
      taken.add(String(m.player.id));
      const from = season.teams[m.from];
      if (from) releaseFrom(from.team, m.player.id);
    }
  }
  // Anybody unsigned has left college baseball.
  for (const m of pool) {
    if (taken.has(String(m.player.id))) continue;
    const from = season.teams[m.from];
    if (from) releaseFrom(from.team, m.player.id);
  }

  /*
    Recruiting, which the store runs across its own window of weeks and which
    the engine has no driver for. It has to sit HERE — after the draft and the
    portal have taken men, and before `fillRosters`, which is the call that
    enrols the signed class and falls back to walk-ons for whatever is still
    missing. Run it later and the holes are already filled with replacements.
  */
  lastSigned = recruitWindow(season);

  // And now the refill, which repairs every hole the portal just made — and
  // enrols the class `recruitWindow` just signed.
  fillRosters(season, season.rng, { userTeam: me });

  const rolled = nextSeason(season);
  const mine = rolled.teams[me];
  if (mine) {
    for (const p of [...mine.team.lineup, ...mine.team.bench, ...mine.team.rotation, ...mine.team.bullpen]) {
      healUp(p);
      resetWorkload(p);
      delete (p as Player & { outUntil?: number }).outUntil;
      delete (p as Player & { starts?: number }).starts;
    }
  }
  rolled.captureBoxFor = me;
  return rolled;
}
