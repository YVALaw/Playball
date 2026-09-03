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
  coachStanding, gradeObjectives, leagueShape, prestigeStars, rivalExpectation, rosterStrength,
  type CoachTitle, type Mandate, type Verdict,
} from '../src/engine/program.js';
import { runRivalYear, seatCoaches, syncCoachMods } from '../src/engine/rivals.js';
import {
  RECRUITING_WEEKS, aiTargets, closeWeek, leadersAtWeekStart, resetWeeklySpend, weeklyPoints,
} from '../src/engine/recruiting.js';
import { pitchFor, developmentScore } from '../src/engine/pitch.js';
import { openPortal, type Portable } from '../src/engine/portal.js';
import { overallOf } from '../src/engine/ratings.js';
import type { Player } from '../src/engine/types.js';
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
// A box missed alongside two others costs nothing extra — the season was already
// a failure. What a required box actually *costs* the clear rate is the number of
// programs it was the only thing standing between and a satisfied board, so that
// is counted separately. Reading the raw miss column as the price of a box is how
// an objective gets blamed for a season the win total had already lost.
const soleTotals: Record<string, number> = {};
const byMandate: Record<Mandate, { n: number; cleared: number }> = {
  develop: { n: 0, cleared: 0 }, build: { n: 0, cleared: 0 },
  compete: { n: 0, cleared: 0 }, contend: { n: 0, cleared: 0 },
  championship: { n: 0, cleared: 0 },
};
let askedTotal = 0;
let wonTotal = 0;
/**
 * What the league is called, and how often the name moves for no reason.
 *
 * Reported: *"the coach title keeps upgrading or changing every season, these
 * titles are supposed to be based in achievements"*. Two numbers answer that and
 * neither can be read off one season. DRIFT is the share of coach-seasons in
 * which a man who won nothing at all — no bid, no league, no region, no country
 * — is introduced differently in November than he was in May. TITLES is the
 * spread across the ninety six chairs, which is the other half of the question:
 * a ladder nobody climbs and a ladder everybody finishes are both broken.
 */
const TITLE_LADDER: readonly CoachTitle[] = [
  'Unproven', 'Rookie', 'Career man', 'Journeyman', 'Firefighter',
  'Lifer', 'Builder', 'Respected', 'Nearly man', 'Contender',
  'Champion', 'Dynasty', 'Legend',
];
const drift = { quiet: 0, moved: 0, debut: 0 };
/**
 * Dynasties. Stage 16's prestige target is stated in reigns — "a great
 * program holds 90+ for roughly a decade of sustained titles; thirty seasons
 * should show two or three reigns" — and a reign is a run of consecutive
 * seasons at 90+ by one program, measured after the year's reviews. Titles
 * are counted per program alongside, because the door's sentence is about
 * whether the crown tracks the trophies.
 */
const reignRun = new Map<number, number>();
/**
 * The portal's shelf, measured rather than guessed. Stage 16's balance pass
 * is stated as a rate — "a star in the portal roughly once every five or six
 * seasons" — and the only place that rate exists is a full league playing
 * full seasons. Measure-only: the flags openPortal stamps are wiped after
 * the tally so the probe's league is not carrying a portal it never runs.
 */
const portalYears: { size: number; over85: number; over90: number; top: number }[] = [];
/**
 * And the star population itself, because the knob's arithmetic needs it: a
 * seeded league holds nobody above 82 — stars are grown, not dealt — so the
 * rate "one star in the portal per five or six winters" can only be priced
 * against how many stars a developed league actually carries.
 */
const starCensus: { at85: number; at88: number; at90: number }[] = [];
const reigns: { team: number; len: number; ended: number }[] = [];
const titlesBy = new Map<number, number>();
const titleSnapshots: { year: number; spread: Record<CoachTitle, number> }[] = [];
const spreadNow = (): Record<CoachTitle, number> => {
  const out = Object.fromEntries(
    TITLE_LADDER.map((t) => [t, 0]),
  ) as Record<CoachTitle, number>;
  for (const t of season.teams) if (t.coach) out[coachStanding(t.coach).title] += 1;
  return out;
};

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
    const gone = gradeObjectives(e, o)
      .filter((g) => g.objective.required && !g.met)
      .map((g) => g.objective.key);
    for (const key of gone) {
      missedBox[key] = (missedBox[key] ?? 0) + 1;
      boxTotals[key] = (boxTotals[key] ?? 0) + 1;
    }
    if (gone.length === 1) {
      const only = gone[0] as string;
      soleTotals[only] = (soleTotals[only] ?? 0) + 1;
    }
    byMandate[e.mandate].n += 1;
    if (gone.length === 0) byMandate[e.mandate].cleared += 1;
  }
  askedTotal += asked / season.teams.length;
  wonTotal += won / season.teams.length;
  const prestige = season.teams.map((t) => t.prestige);
  const roster = season.teams.map((t) => rosterStrength(t.team));

  // Who was called what going into the review, and whether he had anything to
  // show for the year. Keyed on the coach object rather than on the chair,
  // because a chair that changes hands is a different man and not a drift.
  const before = new Map<object, { title: CoachTitle; won: boolean }>();
  for (const t of season.teams) {
    if (!t.coach) continue;
    before.set(t.coach, {
      title: coachStanding(t.coach).title,
      won: post.finish[t.index] !== undefined
        || post.conferenceChampions.includes(t.index)
        || post.regionChampions.includes(t.index)
        || post.champion === t.index,
    });
  }

  const { moves, verdicts } = runRivalYear(season, post, {
    year: season.year ?? 0, userTeam: -1, games: 45,
  });
  syncCoachMods(season, -1, null);
  titlesBy.set(post.champion, (titlesBy.get(post.champion) ?? 0) + 1);
  {
    const pool = openPortal(season.teams, {
      year: season.year ?? 0, seed: season.seed ?? 0, games: 45,
    });
    const ovrs = pool.map((m) => overallOf(m.player));
    portalYears.push({
      size: pool.length,
      over85: ovrs.filter((o) => o >= 85).length,
      over90: ovrs.filter((o) => o >= 90).length,
      top: Math.max(0, ...ovrs),
    });
    for (const m of pool) delete (m.player as Player & Portable).inPortal;
    const ovrAll: number[] = [];
    for (const rec of season.teams) {
      for (const man of [
        ...rec.team.lineup, ...rec.team.bench, ...rec.team.rotation, ...rec.team.bullpen,
      ]) ovrAll.push(overallOf(man));
    }
    starCensus.push({
      at85: ovrAll.filter((o) => o >= 85).length,
      at88: ovrAll.filter((o) => o >= 88).length,
      at90: ovrAll.filter((o) => o >= 90).length,
    });
  }
  for (const t of season.teams) {
    if (t.prestige >= 90) reignRun.set(t.index, (reignRun.get(t.index) ?? 0) + 1);
    else if (reignRun.has(t.index)) {
      reigns.push({ team: t.index, len: reignRun.get(t.index)!, ended: season.year ?? 0 });
      reignRun.delete(t.index);
    }
  }

  for (const t of season.teams) {
    const was = t.coach ? before.get(t.coach) : undefined;
    if (!was || was.won) continue;
    drift.quiet += 1;
    const now = coachStanding(t.coach as NonNullable<typeof t.coach>).title;
    if (now === was.title) continue;
    drift.moved += 1;
    // A rookie finishing his first season stops being unproven, which is the
    // one move on the ladder that is about having coached rather than about
    // having won. Counted apart so it cannot be read as the reported drift.
    if (was.title === 'Unproven') drift.debut += 1;
  }
  if ((y + 1) % 10 === 0 || y === YEARS - 1) {
    titleSnapshots.push({ year: season.year ?? 0, spread: spreadNow() });
  }

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
console.log('required boxes missed, per year, out of %d programs (sole = what it cost):', N);
for (const [k, v] of Object.entries(boxTotals).sort((a, b) => b[1] - a[1])) {
  console.log('  %s %s   sole %s',
    k.padEnd(16), (v / YEARS).toFixed(1).padStart(5), ((soleTotals[k] ?? 0) / YEARS).toFixed(1));
}
console.log('title drift   %s%% of quiet coach-seasons changed the man\'s title (%d of %d)',
  (100 * drift.moved / Math.max(1, drift.quiet)).toFixed(1), drift.moved, drift.quiet);
console.log('  of which    %d were a first season ending UNPROVEN; %s%% is the rest',
  drift.debut,
  (100 * (drift.moved - drift.debut) / Math.max(1, drift.quiet)).toFixed(1));
console.log('coach titles  %s, of %d chairs:', TITLE_LADDER.map((t) => t.slice(0, 4).toLowerCase()).join('/'), N);
for (const snap of titleSnapshots) {
  console.log('  %s  %s', String(snap.year).padStart(4),
    TITLE_LADDER.map((t) => String(snap.spread[t]).padStart(3)).join('/'));
}
/*
  What a career actually accumulates.

  The title thresholds were first written as though a regional banner were rare.
  June hands out sixteen of them and twenty bids every single year across
  ninety-six programmes, so "two regional titles" turned out to be a median
  career rather than a contender -- sixty of ninety-six chairs ended up sharing
  one word, which is the exact fault the rewrite existed to fix.

  This prints the distribution so a threshold can be set against what a career
  really looks like instead of against an intuition about scarcity.
*/
const careers = season.teams.map((t) => t.coach).filter(Boolean) as NonNullable<typeof season.teams[0]['coach']>[];
const at = (xs: number[], p: number): number =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] ?? 0;
console.log('career counters, %d coaches at year %d:', careers.length, YEARS);
for (const [label, get] of [
  ['games', (c: typeof careers[0]) => c.careerWins + c.careerLosses],
  ['tournaments', (c: typeof careers[0]) => c.tournaments],
  ['regional titles', (c: typeof careers[0]) => c.regionalTitles],
  ['conference titles', (c: typeof careers[0]) => c.conferenceTitles],
  ['national titles', (c: typeof careers[0]) => c.titles],
  ['stints', (c: typeof careers[0]) => c.stints ?? 1],
  ['rebuilds', (c: typeof careers[0]) => c.rebuilds ?? 0],
  ['tenure', (c: typeof careers[0]) => c.tenure],
] as [string, (c: typeof careers[0]) => number][]) {
  const xs = careers.map(get);
  console.log('  %s med %s  p75 %s  p90 %s  max %s',
    label.padEnd(18), String(at(xs, 0.5)).padStart(4), String(at(xs, 0.75)).padStart(4),
    String(at(xs, 0.9)).padStart(4), String(Math.max(...xs)).padStart(4));
}

for (const [team, len] of reignRun) reigns.push({ team, len, ended: season.year ?? 0 });
{
  const real = reigns.filter((r) => r.len >= 3);
  console.log('reigns at 90+  %d of length 3+  (runs: %s)',
    real.length, reigns.map((r) => r.len).sort((a, b) => b - a).join(',') || 'none');
  console.log('  seasons spent at 90+, league-wide: %d', reigns.reduce((a, r) => a + r.len, 0));
  for (const r of real) {
    const t = season.teams[r.team];
    console.log('  %s  %d seasons, ended year %d, %d titles for the program, prestige now %d',
      (t?.def.abbr ?? String(r.team)).padEnd(5), r.len, r.ended, titlesBy.get(r.team) ?? 0, t?.prestige ?? 0);
  }
}

{
  const tot = (k: 'size' | 'over85' | 'over90') => portalYears.reduce((a, y) => a + y[k], 0);
  console.log('portal shelf   %s men/yr   85+ %s/yr   90+ %s in %d yrs   best-of-year med %d  max %d',
    (tot('size') / YEARS).toFixed(1), (tot('over85') / YEARS).toFixed(2),
    tot('over90'), YEARS,
    [...portalYears.map((y) => y.top)].sort((a, b) => a - b)[Math.floor(YEARS / 2)] ?? 0,
    Math.max(...portalYears.map((y) => y.top)));
}

{
  const late = starCensus.slice(-15);
  const avg = (k: 'at85' | 'at88' | 'at90') =>
    (late.reduce((a, y) => a + y[k], 0) / (late.length || 1)).toFixed(1);
  console.log('star census    85+ %s  88+ %s  90+ %s   (league-wide, mean of final 15 yrs)',
    avg('at85'), avg('at88'), avg('at90'));
}

console.log('clear rate by mandate:');
for (const m of Object.keys(byMandate) as Mandate[]) {
  const { n, cleared } = byMandate[m];
  console.log('  %s %s/yr  %s%%', m.padEnd(13),
    (n / YEARS).toFixed(1).padStart(5),
    n === 0 ? '  -' : (100 * cleared / n).toFixed(0).padStart(3));
}
