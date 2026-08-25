// hall-probe.ts
// The two numbers B12 and B13 are judged on, and they can only be seen over a
// career: how often the hall of fame admits somebody, and what league-wide career
// records cost on disk and in time.
//
//   npx tsx tests/hall-probe.ts [seasons]
//
// Not a Vitest file, for the reason `block-probe.ts` gives: it plays whole
// seasons of ninety six programs and its output is a judgment call rather than an
// assertion. What it decides is `HALL_BAR`, and the assertions that pin the
// result of that decision live in tests/hall.test.ts.
//
// Three programs are watched rather than one — a blue blood, the median, and a
// cellar — because an absolute bar is supposed to produce different rates at
// different programs. If it does not, the bar is measuring the league instead of
// the men.

import {
  createSeason, simSeason, nextSeason, archiveSeason, recordSeasonMarks,
  recordCareerMarks, DEFAULT_SEASON, type CareerYear, type SeasonState,
} from '../src/engine/season.js';
import { runPostseason, seasonAwards, allConference } from '../src/engine/postseason.js';
import { departAndDevelop, fillRosters, holesFor } from '../src/engine/progression.js';
import { seatCoaches, syncCoachMods } from '../src/engine/rivals.js';
import {
  RECRUITING_WEEKS, aiTargets, closeWeek, leadersAtWeekStart, resetWeeklySpend,
  weeklyPoints,
} from '../src/engine/recruiting.js';
import { pitchFor, developmentScore } from '../src/engine/pitch.js';
import { buildCase, inductees, MIN_SEASONS, type Inductee } from '../src/engine/hall.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES, type Region } from '../src/data/schools.js';
import { recordsIn } from '../src/engine/records.js';
import type { PlayerId } from '../src/engine/types.js';

const YEARS = Number(process.argv[2] ?? 24);
const START = 2027;

/** The recruiting window with every chair on the AI, exactly as rivals.test.ts runs it. */
function recruitWindow(season: SeasonState): void {
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
        need, season.rng, atWeekStart, season.draft?.rivalSpend[record.index] ?? 0,
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
}

/** One watched program: its own archive, its own honours, its own hall. */
interface Watched {
  index: number;
  label: string;
  careers: Record<PlayerId, CareerYear[]>;
  honours: Map<string, string[]>;
  hall: Inductee[];
  /**
   * Every finished career's score, whether it went in or not — once each.
   *
   * The `seen` set is load bearing. A finished career is still finished next
   * June, so scoring everything on the board every year counts the same man once
   * per season since he left, which weights the distribution towards whoever
   * graduated first and makes every bar look busier than it is.
   */
  scores: number[];
  seen: Set<string>;
}

function activeIds(season: SeasonState): Set<string> {
  const ids = new Set<string>();
  for (const t of season.teams) {
    for (const p of [
      ...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen,
    ]) ids.add(p.id);
  }
  return ids;
}

function main(): void {
  let season = createSeason(makeRng(4242), DEFAULT_SEASON, [...CONFERENCES]);
  season.year = START;
  seatCoaches(season, -1, START);
  syncCoachMods(season, -1, null);

  // Picked off the seeded prestige rather than named, so the three really are the
  // top, the middle and the bottom of the world this seed produced.
  const byPrestige = [...season.teams].sort((a, b) => b.prestige - a.prestige);
  const watched: Watched[] = [
    { index: byPrestige[0]!.index, label: 'blue blood' },
    { index: byPrestige[Math.floor(byPrestige.length / 2)]!.index, label: 'median' },
    { index: byPrestige[byPrestige.length - 1]!.index, label: 'cellar' },
  ].map((w) => ({
    ...w,
    careers: {},
    honours: new Map<string, string[]>(),
    hall: [],
    scores: [],
    seen: new Set<string>(),
  }));
  for (const w of watched) {
    console.log(`${w.label.padEnd(11)} ${season.teams[w.index]!.def.school} `
      + `(prestige ${season.teams[w.index]!.prestige})`);
  }

  /** The alternative B13 was deferred for: every program's seasons, kept for ever. */
  const everyCareer: Record<PlayerId, CareerYear[]> = {};

  let careerScanMs = 0;
  let fullArchiveMs = 0;
  const inductionsByYear: number[] = [];

  for (let y = 0; y < YEARS; y++) {
    const year = START + y;
    simSeason(season);
    runPostseason(season);

    // What the country voted, filed under the watched programs only — the same
    // rule the store's season record follows.
    const awards = [
      ...seasonAwards(season),
      ...allConference(season).map((a) => ({ ...a, title: `All-conference ${a.position}` })),
    ];
    for (const w of watched) {
      const abbr = season.teams[w.index]!.def.abbr;
      for (const a of awards) {
        if (a.team !== abbr) continue;
        const list = w.honours.get(a.id) ?? [];
        if (!list.includes(a.title)) list.push(a.title);
        w.honours.set(a.id, list);
      }
    }

    // The three archives, each as if that program were the user's.
    const real = season.careers;
    for (const w of watched) {
      season.careers = w.careers;
      archiveSeason(season, w.index, year);
    }
    // And the expensive alternative, timed against the cheap one below.
    const t0 = performance.now();
    season.careers = everyCareer;
    for (const t of season.teams) archiveSeason(season, t.index, year);
    fullArchiveMs += performance.now() - t0;
    season.careers = real;

    recordSeasonMarks(season, year);
    const t1 = performance.now();
    recordCareerMarks(season, year);
    careerScanMs += performance.now() - t1;

    departAndDevelop(season, season.rng, { userTeam: -1 });

    // Induction is decided here, after the departures, which is where the store
    // decides it: it is the first moment a graduating senior's career is over.
    const active = activeIds(season);
    let classSize = 0;
    for (const w of watched) {
      const already = new Set(w.hall.map((i) => i.id as string));
      for (const [key, rows] of Object.entries(w.careers)) {
        if (w.seen.has(key) || active.has(key)) continue;
        w.seen.add(key);
        const c = buildCase(key as PlayerId, rows, w.honours.get(key) ?? []);
        if (c.seasons >= MIN_SEASONS) w.scores.push(c.score);
      }
      const going = inductees({
        careers: w.careers, active, inducted: already, honours: w.honours, year,
      });
      w.hall.push(...going);
      classSize += going.length;
    }
    inductionsByYear.push(classSize);

    recruitWindow(season);
    fillRosters(season, season.rng, { userTeam: -1 });
    season = nextSeason(season);
  }

  // -------------------------------------------------------------------------
  console.log(`\n=== the hall, over ${YEARS} seasons ===`);
  for (const w of watched) {
    const sorted = [...w.scores].sort((a, b) => a - b);
    const at = (q: number): number => sorted[Math.floor(sorted.length * q)] ?? 0;
    console.log(
      `\n${w.label} — ${season.teams[w.index]!.def.school}`
      + `\n  finished careers of ${MIN_SEASONS}+ seasons: ${sorted.length}`
      + `\n  score  median ${at(0.5).toFixed(0)}  p90 ${at(0.9).toFixed(0)}`
      + `  p97 ${at(0.97).toFixed(0)}  max ${(sorted[sorted.length - 1] ?? 0).toFixed(0)}`
      + `\n  inducted ${w.hall.length} — one every ${(YEARS / Math.max(1, w.hall.length)).toFixed(1)} seasons`,
    );
    for (const m of w.hall.slice(0, 6)) {
      console.log(`    ${String(m.score).padStart(4)}  ${m.name} · ${m.line}`);
    }
  }

  // What a different bar would have produced, so the choice is visible. The
  // gradient across the three columns is the thing to read: an absolute bar is
  // supposed to induct often at a great program and rarely at a poor one.
  console.log(`\n=== what each bar admits in ${YEARS} seasons, by program ===`);
  console.log(`  bar   ${watched.map((w) => w.label.padStart(11)).join('')}`);
  for (const bar of [80, 90, 100, 110, 120, 130, 140, 150, 170]) {
    const cells = watched.map((w) => {
      const n = w.scores.filter((s) => s >= bar).length;
      return `${String(n).padStart(4)} (${(YEARS / Math.max(1, n)).toFixed(0).padStart(2)}y)`;
    });
    console.log(`  ${String(bar).padStart(3)}   ${cells.join('  ')}`);
  }
  const empty = inductionsByYear.filter((n) => n === 0).length;
  console.log(`  years in which none of the three inducted anybody: ${empty}/${YEARS}`);

  // -------------------------------------------------------------------------
  console.log('\n=== what career records cost ===');
  const totals = season.careerTotals ?? new Map();
  const totalsBytes = JSON.stringify([...totals]).length;
  const archiveBytes = JSON.stringify(everyCareer).length;
  const rows = Object.values(everyCareer).reduce((a, r) => a + r.length, 0);
  console.log(`  running totals: ${totals.size} rows, ${(totalsBytes / 1024).toFixed(0)} KB`);
  console.log(`  full archive:   ${Object.keys(everyCareer).length} men, ${rows} rows, `
    + `${(archiveBytes / 1024).toFixed(0)} KB after ${YEARS} seasons`);
  console.log(`  ratio: the archive is ${(archiveBytes / totalsBytes).toFixed(1)}x the totals, `
    + `and grows every year while the totals do not`);
  console.log(`  time: career scan ${(careerScanMs / YEARS).toFixed(1)} ms/season, `
    + `full archive of 96 programs ${(fullArchiveMs / YEARS).toFixed(1)} ms/season`);

  console.log('\n=== the career section of the book ===');
  for (const k of recordsIn('career')) {
    const m = season.records?.[k];
    console.log(`  ${k.padEnd(14)} ${m ? `${String(m.value).slice(0, 6).padStart(6)}  ${m.holder} · ${m.team} · ${m.year} · ${m.detail ?? ''}` : 'unset'}`);
  }
}

main();
