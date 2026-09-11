// headlessYear.ts
// One offseason, the way the store runs it, minus the screens.
//
// Extracted from `climb-probe.ts`, which had it first and paid for every line
// of it — the comments below are its scars and they are kept verbatim, because
// each one records a way this is easy to get wrong.
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
import { departAndDevelop, fillRosters } from '../src/engine/progression.js';
import { prestigeStars } from '../src/engine/program.js';
import { openPortal, staffWorksPortal, releaseFrom } from '../src/engine/portal.js';
import { runRivalYear } from '../src/engine/rivals.js';
import type { PostseasonSummary } from '../src/engine/postseason.js';
import { windowBudget } from '../src/engine/recruiting.js';
import { setMood, settleMood, squadRanks } from '../src/engine/morale.js';
import { healUp } from '../src/engine/injury.js';
import { resetWorkload } from '../src/engine/workload.js';
import type { Player } from '../src/engine/types.js';

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

  // And now the refill, which repairs every hole the portal just made.
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
