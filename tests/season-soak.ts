// season-soak.ts
// Thirty years of a league, checked every June.
//
// The expanded postseason has never run more than a few seasons in a row. Every
// other probe in this directory measures a *rate* — how often the better seed
// wins, how many chairs turn over — and none of them asks the question this one
// asks, which is whether the thing is still structurally sound in year thirty.
//
// A dynasty game's worst failure is not a wrong number, it is a slow one: a
// duplicate creeping into a field, a save growing without bound, a conference
// quietly losing a team. Those never show up in a two-season test and they are
// exactly what somebody playing a fifteen-year career hits.
//
//   npm run soak                    30 seasons of the usual world
//   npm run soak -- 60              more of them
//   npm run soak -- 30 11111        a different world, same thirty years
//
// The seed argument exists because a single world cannot tell signal from
// noise, and one measurement here was briefly mistaken for a regression until
// four more worlds said otherwise.

import { createSeason, simSeason, nextSeason } from '../src/engine/season.js';
import type { SeasonState } from '../src/engine/season.js';
import {
  freezeRegularSeason, allConferenceTournaments, stageRegionals, stageNational,
  summarize, conferenceIds, recordSchoolAnnals,
  CONF_FIELD, CONF_ADVANCE, NATIONAL_BIDS, PROTECTED_BIDS, REGIONS,
} from '../src/engine/postseason.js';
import { makeRng } from '../src/engine/rng.js';
import { resetNames } from '../src/engine/players.js';
import { departAndDevelop, fillRosters } from '../src/engine/progression.js';

/** One complaint about one season. */
interface Fault { year: number; what: string; }

const faults: Fault[] = [];
const fail = (year: number, what: string): void => { faults.push({ year, what }); };

/** Every check that must hold in every June, forever. */
function auditJune(season: SeasonState, year: number): void {
  const cups = allConferenceTournaments(season);
  const conferences = conferenceIds(season);

  // --- the conference tier -------------------------------------------------
  if (cups.length !== conferences.length) {
    fail(year, `${cups.length} conference tournaments for ${conferences.length} conferences`);
  }
  for (const cup of cups) {
    if (cup.seeds.length !== CONF_FIELD) {
      fail(year, `${cup.conference} seeded ${cup.seeds.length}, expected ${CONF_FIELD}`);
    }
    if (new Set(cup.seeds).size !== cup.seeds.length) {
      fail(year, `${cup.conference} seeded a team twice`);
    }
    const placings = cup.placings ?? [];
    if (placings.length !== CONF_ADVANCE) {
      fail(year, `${cup.conference} advanced ${placings.length}, expected ${CONF_ADVANCE}`);
    }
    if (new Set(placings).size !== placings.length) {
      fail(year, `${cup.conference} advanced a team twice`);
    }
    if (placings[0] !== cup.champion) {
      fail(year, `${cup.conference} champion is not its own first placing`);
    }
    for (const t of placings) {
      if (!cup.seeds.includes(t)) fail(year, `${cup.conference} advanced a team that was not in it`);
      if (season.teams[t]?.conference !== cup.conference) {
        fail(year, `${cup.conference} advanced a team from another league`);
      }
    }
    // Everybody who went out went out on two losses, which is the whole
    // promise of the format. Counted off the slots rather than a stored
    // tally, so the structure has to agree with itself.
    if (cup.de) {
      const losses = new Map<number, number>();
      const all = [...cup.de.winners.flat(), ...cup.de.losers.flat(), ...cup.de.final];
      for (const s of all) {
        if (s.winner === null || s.a === null || s.b === null) continue;
        const loser = s.winner === s.a ? s.b : s.a;
        losses.set(loser, (losses.get(loser) ?? 0) + 1);
      }
      for (const [team, n] of losses) {
        if (n > 2) fail(year, `${cup.conference} let a team lose ${n} times`);
        if (n === 1 && team !== cup.champion && !placings.includes(team)) {
          fail(year, `${cup.conference} sent a one-loss team home`);
        }
      }
    }
  }

  // --- the regional tier ---------------------------------------------------
  const regionals = stageRegionals(season, cups);
  const expectedSeries = REGIONS.length * CONF_ADVANCE;
  if (regionals.length !== expectedSeries) {
    fail(year, `${regionals.length} regional series, expected ${expectedSeries}`);
  }
  const regionalChampions = regionals.map((r) => r.champion);
  if (new Set(regionalChampions).size !== regionalChampions.length) {
    fail(year, 'a program won two regional banners in one June');
  }
  const advancers = new Set(cups.flatMap((c) => c.placings ?? []));
  for (const r of regionals) {
    for (const t of r.seeds) {
      if (!advancers.has(t)) fail(year, 'a regional contained a team that did not advance');
    }
    if (r.seeds.length !== 2) fail(year, `a regional series had ${r.seeds.length} teams`);
  }

  // --- the national tier ---------------------------------------------------
  const national = stageNational(season, cups, regionals);
  const field = national.field.seeds;
  if (field.length !== NATIONAL_BIDS) {
    fail(year, `national field of ${field.length}, expected ${NATIONAL_BIDS}`);
  }
  if (new Set(field).size !== field.length) {
    fail(year, 'the national field contains a duplicate');
  }
  for (const t of regionalChampions) {
    if (!field.includes(t)) fail(year, 'a regional champion missed the national field');
  }
  if (national.field.protectedTeams.length !== PROTECTED_BIDS) {
    fail(year, `${national.field.protectedTeams.length} protected teams, expected ${PROTECTED_BIDS}`);
  }
  for (const t of national.field.protectedTeams) {
    if (!field.includes(t)) fail(year, 'a protected team missed the national field');
  }

  /*
    The play-in, which used to be an opening round.

    The audit that stood here checked that four best-of-three series trimmed
    twenty teams to sixteen. There is no such round now — the bottom four of
    each half play their way in *inside* the winners bracket — so what is
    checked is the promise that survived it: a protected team never has to.
  */
  const playIn = field.slice(12);
  if (playIn.length !== 8) fail(year, `${playIn.length} teams below the bye line, expected 8`);
  for (const t of playIn) {
    if (national.field.protectedTeams.includes(t)) {
      fail(year, 'a protected team was left to play its way in');
    }
  }

  const inBrackets = [...national.bracketA.seeds, ...national.bracketB.seeds];
  if (new Set(inBrackets).size !== 20) fail(year, 'the two showdown brackets overlap');
  if (national.bracketA.seeds.length !== 10 || national.bracketB.seeds.length !== 10) {
    fail(year, 'the showdown did not split into two halves of ten');
  }
  for (const t of inBrackets) {
    if (!field.includes(t)) fail(year, 'a bracket contains a team not in the field');
  }
  if (![national.bracketA.champion, national.bracketB.champion].includes(national.champion)) {
    fail(year, 'the champion did not win either bracket');
  }

  // --- the summary a dynasty actually keeps --------------------------------
  const summary = summarize(cups, regionals, national);
  titles.push(season.teams[national.champion]?.def.abbr ?? '???');
  const champs = Object.values(summary.finish).filter((f) => f === 'champion');
  const runners = Object.values(summary.finish).filter((f) => f === 'runner-up');
  if (champs.length !== 1) fail(year, `${champs.length} national champions`);
  if (runners.length !== 1) fail(year, `${runners.length} runners up`);
  if (summary.regionChampions.length !== expectedSeries) {
    fail(year, 'the summary lost a regional banner');
  }

  // --- the world itself ----------------------------------------------------
  for (const id of conferences) {
    const n = season.teams.filter((t) => t.conference === id).length;
    if (n !== 12) fail(year, `${id} holds ${n} programs, expected 12`);
  }
  if (season.teams.length !== 96) fail(year, `${season.teams.length} programs in the world`);

  // Rosters have to stay playable: nine in a lineup and arms to throw.
  for (const t of season.teams) {
    if (t.team.lineup.length !== 9) {
      fail(year, `${t.def.abbr} takes the field with ${t.team.lineup.length}`);
    }
    if (t.team.rotation.length < 3) {
      fail(year, `${t.def.abbr} has ${t.team.rotation.length} starters`);
    }
  }

  // And the annals keep one row per program per year, never two.
  recordSchoolAnnals(season, year, summary, 0, 'Soak');
  for (const t of season.teams) {
    const years = (t.annals ?? []).map((a) => a.year);
    if (new Set(years).size !== years.length) {
      fail(year, `${t.def.abbr} wrote a year into its book twice`);
    }
  }
}

/** Who won it, so thirty years can be asked whether one program owns the country. */
const titles: string[] = [];

/** A rough count of what a save of this season would weigh. */
function weigh(season: SeasonState): number {
  let n = 0;
  n += JSON.stringify(season.careers ?? {}).length;
  n += JSON.stringify(season.records ?? {}).length;
  n += JSON.stringify(season.hall ?? []).length;
  n += season.teams.reduce((a, t) => a + JSON.stringify(t.annals ?? []).length, 0);
  n += season.careerTotals ? season.careerTotals.size * 120 : 0;
  return n;
}

function soak(years: number, worldSeed = 20260827): void {
  resetNames();
  let season = createSeason(makeRng(worldSeed));
  const weights: number[] = [];
  const start = Date.now();

  for (let i = 0; i < years; i++) {
    const year = 2027 + i;
    season.year = year;
    simSeason(season);
    freezeRegularSeason(season);
    auditJune(season, year);
    weights.push(weigh(season));

    // The roll, exactly as the store does it: the class leaves, the roster
    // refills, and next February arrives. Both halves run on the season's own
    // generator, so a soak is one continuous deterministic world rather than
    // thirty unrelated ones.
    departAndDevelop(season, season.rng);
    fillRosters(season, season.rng);
    season = nextSeason(season);
  }

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  const first = weights[0] ?? 0;
  const last = weights[weights.length - 1] ?? 0;
  const perYear = years > 1 ? (last - first) / (years - 1) : 0;

  console.log(`\n=== ${years} seasons in ${seconds}s ===`);
  console.log(`save-ish payload: ${(first / 1024).toFixed(0)} KB -> ${(last / 1024).toFixed(0)} KB`);
  console.log(`growth: ${(perYear / 1024).toFixed(1)} KB a year`);

  /*
    Whether the country is still a country.

    A league that settles into one dynasty owning every June has not crashed,
    it has died — and no structural check above would notice. Distinct winners
    is the cheapest measure of that, and the repeat count is the interesting
    half: some repetition is right, a program winning half of them is not.
  */
  const byTeam = new Map<string, number>();
  for (const t of titles) byTeam.set(t, (byTeam.get(t) ?? 0) + 1);
  const most = [...byTeam.entries()].sort((a, b) => b[1] - a[1])[0];
  console.log(
    `${byTeam.size} different champions in ${years}`
    + `, most by one program ${most?.[1] ?? 0} (${most?.[0] ?? '—'})`,
  );
  /*
    The threshold, and why it is not where it was.

    It was `years / 3` — ten in thirty — which was the number the very first
    soak happened to print. An alarm set at the observed value fires on noise,
    and it duly did: measured across five different worlds the format produces
    9, 10, 9, 10, 9 distinct champions in thirty years, so half of all worlds
    tripped it while nothing was wrong.

    Nine or ten is still high concentration — the real tournament produces
    closer to sixteen — and that remains an open balance question in
    `06-backlog.md` §F rather than something this probe should decide. What the
    probe is for is catching a *collapse*: a change that suddenly makes the same
    three programs win everything. Six in thirty is comfortably below anything
    measured and far above the runaway case, so it catches the regression
    without crying about the weather.
  */
  if (byTeam.size < years / 5) {
    fail(0, `only ${byTeam.size} programs won anything in ${years} years`);
  }

  if (faults.length === 0) {
    console.log('\nthirty Junes, nothing broken.');
    return;
  }
  console.log(`\n${faults.length} FAULTS`);
  const seen = new Map<string, number[]>();
  for (const f of faults) {
    seen.set(f.what, [...(seen.get(f.what) ?? []), f.year]);
  }
  for (const [what, yrs] of seen) {
    const when = yrs.length > 6 ? `${yrs.length} years` : yrs.join(', ');
    console.log(`  ${what}  (${when})`);
  }
  process.exitCode = 1;
}

soak(Number(process.argv[2] ?? 30), Number(process.argv[3] ?? 20260827));
