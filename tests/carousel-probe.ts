// carousel-probe.ts
// What the coaching carousel actually does to a league, over a career.
//
//   npx tsx tests/carousel-probe.ts [years] [seed]
//
// Not a Vitest file, for the same reason `block-probe.ts` is not one: it plays
// thirty five seasons of ninety six programs including the recruiting window,
// which takes minutes rather than the seconds a suite is allowed.
//
// The numbers it exists to print are the ones the carousel is judged on and
// which no single season can show:
//
//   TURNOVER      chairs changing hands per year, broken down by cause. The
//                 real sport turns over eight to twelve of ninety six.
//   CLEAR RATE    the share of boards a coach satisfies. `expectationFor` was
//                 tuned to about 62% at the seeded prestige distribution, and
//                 the whole churn question is whether it stays there once every
//                 program's prestige is live.
//   CONVERGENCE   prestige mean and spread by year. A league that compounds
//                 shows here first.

import { createSeason, simSeason, nextSeason, DEFAULT_SEASON, type SeasonState } from '../src/engine/season.js';
import { runPostseason } from '../src/engine/postseason.js';
import { departAndDevelop, fillRosters, holesFor } from '../src/engine/progression.js';
import {
  gradeObjectives, leagueShape, prestigeStars, rivalExpectation, rosterStrength,
  type Mandate, type Verdict,
} from '../src/engine/program.js';
import { runRivalYear, seatCoaches, syncCoachMods } from '../src/engine/rivals.js';
import {
  RECRUITING_WEEKS, aiTargets, closeWeek, leadersAtWeekStart, resetWeeklySpend, weeklyPoints,
} from '../src/engine/recruiting.js';
import { pitchFor, developmentScore } from '../src/engine/pitch.js';
import { makeRng } from '../src/engine/rng.js';
import { CONFERENCES, type Region } from '../src/data/schools.js';

const YEARS = Number(process.argv[2] ?? 35);
const SEED = Number(process.argv[3] ?? 4242);

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sd = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

/** The recruiting window, as the store runs it, with every chair on the AI. */
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
}

let season = createSeason(makeRng(SEED), DEFAULT_SEASON, [...CONFERENCES]);
season.year = 2027;
seatCoaches(season, -1, 2027);
syncCoachMods(season, -1, null);

const N = season.teams.length;
const champions = new Set<number>();
const rows: string[] = [];
const totals = { sacked: 0, retired: 0, poached: 0, cleared: 0, graded: 0 };
const mix: Record<Verdict, number> = { exceeded: 0, met: 0, missed: 0, failed: 0 };
const tenures: number[] = [];
const boxTotals: Record<string, number> = {};
let askedTotal = 0;
let wonTotal = 0;

console.log(`\n${N} programs, ${YEARS} seasons, seed ${SEED}`);
console.log('seeded prestige: mean %s  sd %s',
  mean(season.teams.map((t) => t.prestige)).toFixed(1),
  sd(season.teams.map((t) => t.prestige)).toFixed(1));

console.log('\nyear  prest  sd   rost   ask/won | mand d/b/c/C/K | clear | sack poach retire | chg');
for (let y = 0; y < YEARS; y++) {
  simSeason(season);
  const post = runPostseason(season);
  champions.add(post.champion);

  const mandates: Record<Mandate, number> = {
    develop: 0, build: 0, compete: 0, contend: 0, championship: 0,
  };
  let asked = 0;
  let won = 0;
  const missedBox: Record<string, number> = {};
  const league = leagueShape(season.teams);
  for (const t of season.teams) {
    const e = rivalExpectation(t.prestige, rosterStrength(t.team), league, 45);
    mandates[e.mandate] += 1;
    asked += e.targetWins;
    won += t.rw ?? t.w;
    const o = {
      wins: t.rw ?? t.w, losses: t.rl ?? t.l,
      conferenceRank: 1 + season.teams.filter((x) => x.conference === t.conference
        && x.index !== t.index && x.cw > t.cw).length,
      conferenceSize: season.teams.filter((x) => x.conference === t.conference).length,
      wonConference: post.conferenceChampions.includes(t.index),
      madeTournament: post.finish[t.index] !== undefined,
      wonRegional: post.regionChampions.includes(t.index),
      reachedOmaha: ['omaha', 'runner-up', 'champion'].includes(post.finish[t.index] ?? ''),
      wonTitle: post.champion === t.index,
    };
    for (const g of gradeObjectives(e, o)) {
      if (g.objective.required && !g.met) {
        missedBox[g.objective.key] = (missedBox[g.objective.key] ?? 0) + 1;
        boxTotals[g.objective.key] = (boxTotals[g.objective.key] ?? 0) + 1;
      }
    }
  }
  askedTotal += asked / season.teams.length;
  wonTotal += won / season.teams.length;
  const prestige = season.teams.map((t) => t.prestige);
  const roster = season.teams.map((t) => rosterStrength(t.team));

  const { moves, verdicts } = runRivalYear(season, post, {
    year: season.year ?? 0, userTeam: -1, games: 45,
  });
  syncCoachMods(season, -1, null);

  const count = (k: string): number => moves.filter((m) => m.kind === k).length;
  const sacked = count('sacked');
  const poached = count('poached');
  const retired = count('retired');
  const changes = sacked + poached + retired;
  const graded = (Object.keys(verdicts) as Verdict[]).reduce((a, k) => a + verdicts[k], 0);
  const cleared = verdicts.exceeded + verdicts.met;
  totals.sacked += sacked; totals.poached += poached; totals.retired += retired;
  totals.graded += graded; totals.cleared += cleared;
  for (const k of Object.keys(mix) as Verdict[]) mix[k] += verdicts[k];
  for (const t of season.teams) if (t.coach) tenures.push(t.coach.tenure);

  rows.push([
    String(season.year ?? 0).padStart(4),
    mean(prestige).toFixed(1).padStart(6),
    sd(prestige).toFixed(1).padStart(4),
    mean(roster).toFixed(1).padStart(6),
    `${(asked / N).toFixed(1)}/${(won / N).toFixed(1)}`.padStart(9),
    ' |',
    `${mandates.develop}/${mandates.build}/${mandates.compete}/${mandates.contend}/${mandates.championship}`.padStart(15),
    ' |',
    `${(100 * cleared / graded).toFixed(0)}%`.padStart(5),
    ' |',
    String(sacked).padStart(4), String(poached).padStart(5), String(retired).padStart(6),
    ' |', String(changes).padStart(3),
  ].join(' '));
  console.log(rows[rows.length - 1]);

  departAndDevelop(season, season.rng, { userTeam: -1 });
  recruitWindow(season);
  fillRosters(season, season.rng, { userTeam: -1 });
  season = nextSeason(season);
}

const per = (n: number): string => (n / YEARS).toFixed(1);
console.log('\n=== over %d seasons of %d programs ===', YEARS, N);
console.log('turnover      %s chairs/year  (%s%% of the league)',
  per(totals.sacked + totals.poached + totals.retired),
  (100 * (totals.sacked + totals.poached + totals.retired) / YEARS / N).toFixed(1));
console.log('  sacked      %s/year', per(totals.sacked));
console.log('  poached     %s/year', per(totals.poached));
console.log('  retired     %s/year', per(totals.retired));
console.log('mean tenure   %s seasons', mean(tenures).toFixed(1));
console.log('clear rate    %s%%   (exceeded/met/missed/failed %s)',
  (100 * totals.cleared / totals.graded).toFixed(1),
  (Object.keys(mix) as Verdict[])
    .map((k) => `${(100 * mix[k] / totals.graded).toFixed(0)}%`).join('/'));
console.log('champions     %d distinct in %d years', champions.size, YEARS);
console.log('win target    league mean asked %s, actually won %s',
  (askedTotal / YEARS).toFixed(1), (wonTotal / YEARS).toFixed(1));
console.log('prestige      mean %s  sd %s',
  mean(season.teams.map((t) => t.prestige)).toFixed(1),
  sd(season.teams.map((t) => t.prestige)).toFixed(1));
const stars = [0, 0, 0, 0, 0, 0];
for (const t of season.teams) stars[prestigeStars(t.prestige)] = (stars[prestigeStars(t.prestige)] ?? 0) + 1;
console.log('star spread   %s   (seeded 46/20/16/11/3)', stars.slice(1).join('/'));
const ranked = season.teams.map((t) => t.prestige).sort((a, b) => b - a);
console.log('top five      %s      bottom five %s',
  mean(ranked.slice(0, 5)).toFixed(1), mean(ranked.slice(-5)).toFixed(1));
console.log('required boxes missed, per year, out of %d programs:', N);
for (const [k, v] of Object.entries(boxTotals).sort((a, b) => b[1] - a[1])) {
  console.log('  %s %s', k.padEnd(16), (v / YEARS).toFixed(1));
}
