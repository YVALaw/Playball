# Playball

A college baseball dynasty game. You are the head coach: recruit high schoolers,
develop them, survive the MLB draft stealing your best arms every June, and chase a
national title in Omaha. Games resolve at bat by at bat with text play by play.
Mobile first, shipping to Android.

## Status

**Version 0.8.0, through September 12 2026** (`docs/05-systems-reference.md`
§66–§75). Twenty-six stages have shipped or closed — 1–18, 18b and 20–27, with
27 in ahead of its turn; only 19, the ship, stands before a release, and what
is left of it is the listing and the keystore. Ninety-six programs in eight
conferences of twelve, a forty-five game regular season, and the whole loop
runs: pick a job
through a background that shapes who rings you, play or simulate a season,
manage games at bat by at bat, go through the postseason a game at a time, sit
awards night, spend coaching points, work the transfer portal and a recruiting
board that is honest about being vague, argue the MLB draft out of taking your
junior, and start again the following February.

On top of that loop: **a budget** with three assistants, four rungs of
facilities and a scouting desk that gates what you can see of an opponent; **a
world that moves** — a career rivalry ledger, and realignment that trades one
programme for another about one winter in three; **a dynasty that remembers** —
signature moments on a man's card, and alumni whose professional careers play
out and end; and **a broadcast** — sound, haptics, ninety-six procedural crests,
and a scoreboard that changes tone during a no-hitter. Rival programs are run by
ninety-five named men with careers of their own, and the pecking order genuinely
moves: measured over thirty seasons, six of the top twelve programmes turn over.

**The interface follows one written rulebook** (`docs/INTERACTION_DESIGN.md`): a
decision shows what is true, why it is being asked, what it trades, what is left
after, and then a verb (§50), and the first season teaches itself — a card that
titles the errand, then a glow path through doing it (§64). Under that, from
earlier this month: the scorer's rules corrected (§51), prestige floors so a
small programme climbs (§52), recruiting 1.0 (§54), god mode, and the hybrid
staff system (§63).

**The rules of the world** (§70). Five switches set at NEW CAREER and fixed for
the life of the career: injuries (full, half or none), the transfer portal,
realignment, poaching, and a season of forty-five games or thirty-four. They
live on `season.rules` in the engine and not in the depth catalogue, because
they change the simulation for all ninety-six programs at once — `depth.ts`'s
own header names them as the counter-example to everything in it. Folded at the
foot of the how-you-play step, because the defaults are the game: a standard
world is object-identically the world that was always there. The short season is
two-game weekends, which keeps the full conference round robin and every
crossover game and costs the fourth starter his slot. A two-game weekend plus a
midweek is a three man rotation.

**June lasts a month again** (§69). Every tournament of a postseason stage now
opens on the same night. They had been played end to end, so no two shared a
date: the first conference played days 81 to 86 and the last days 124 to 129, in
the data file's fixed order, every season of every career. The join between the
stages was worse — the regionals opened the day after the last conference game
with not one of the thirty-two teams in the field holding its number one or
number two starter. Five days of `STAGE_BREAK` later all sixty-four rotations
are ready, and June spans thirty-one days against a hundred and six. From the
same audit: all ninety-six school colours fell below 4.5:1 as text on the dark
theme's paper and eighty-seven below 3:1, the deep navies not dim but gone, so
`teamInk` walks the lightness and keeps the hue.

**Two switches that reached nothing** (§72). MOUND VISITS promises that your
pitching coach decides when to go out. He never did: the engine gated the
automatic visit on the bullpen key, and the mound-visit key's only reader was a
button, which it hid. Measured over sixty live games with the pen kept and the
conversations delegated: 0.00 visits to the coached mound against 1.07 to the
opponent's. It ran the other way too, the engine holding conversations behind the
back of a coach who had delegated only his pen. The other switch was a
keep-position promise judged off `p.pos`, the card label AUTO overwrites when a
man covers a spot: 14.4% of hitters wear one at any moment, so a shortstop
filling in at second for an afternoon read as broken.

**Development means something** (§73, §75). Reported after fifteen seasons: an A
potential grew 3 ovr just like a C potential each year. Headroom had been drawn
from class year and nothing about the player, so a ceiling was current ability
plus a constant and 72.6% of a class sat in two adjacent bands. Headroom is a
roll now, its width set by how raw a man already is and its mean held exactly by
construction, so league talent cannot move. Then two more asks: five-stars who
are already finished go 2.2% to 10.6%, and the S grade is rare, 12.4 a class down
to 5.5. The generation cap had been a wall — 9.9 men a class came out at exactly
94, three quarters of every S, because truncation is what makes a top dense — and
a landing strip replaced it. S mostly belongs to projects now: the lowest overall
carrying one is 30, and a one-star holds one about once in twenty classes.

**Alumni in the majors** (§74). Three of the four per-year rolls in `proCareer`
were not rolls — the hash's high bits barely moved when the year did, so a man
was stamped once for life: an All-Star every summer or never one, thirty-nine
men of four hundred in all twenty seasons and the other three hundred and
sixty-one in none. Reaching the majors went 39% to 16.3%, where the real world is
about sixteen; the All-Star coin reads talent now, so 11.2% of big-leaguers ever
make a team, at 1.18 summers apiece; and a summer says what it was, from MVP
voting down to a roster spot hung on to and a level repeated in the minors.

The engine is calibrated multi-seed to the modern NCAA D1 environment — .280 /
.384 / .438, a home run a game, 6.73 runs — and **1,477 tests across 86 files**,
from 1,369 across 77 at the 0.8.0 line, guard it: determinism goldens,
calibration as a regression test, a baseball-correctness suite for the scorer's
rules, and a concurrency suite pinning the store's double-press guards.

**And one thing is measured and not fixed** (§71). Nothing had ever measured
year five. The league gains two runs a game over its first four seasons and then
holds there — 6.9–7.1 in year one, 8.6–9.1 from year five, batting average .280
to .310 and slugging .441 to .513 — because `makeTeam` never ages the roster it
generates, so a generated senior is no better than a freshman and the engine is
calibrated against a population that exists on day one of a career and never
again. Guarded by `tests/calibration-seasons.test.ts` and filed at `06` §AC.1b
rather than fixed: it would move every golden and wants its own pass. The first
version of that guard measured a league of walk-ons, because its harness was cut
from the lines directly above a block headed "KNOWN WRONG — do not read numbers
off this file yet"; a harness measuring nothing looks exactly like a harness
measuring something reassuring.

**It installs.** `npm run apk` builds a real Android package — Capacitor over
the same bundle the browser runs, no server, offline. The toolchain lives
outside the repo and outside PATH; the script supplies it. `npm run aab` builds
the signed bundle the store wants, from the keys named in
`android/keystore.properties`, which is the one thing that must never be lost.
Testing runs on an Android 16 emulator.

| Not built yet | |
|---|---|
| The listing | the keystore backed up, screenshots, privacy policy, content rating, a closed beta and then an open one (stage 19) |
| The creator kit | name, logo and roster packs a player builds and imports locally, careers as files — the second purchase (stage 28) |
| The majors | the expansion, after v1.0 (stage 29) |

**The gesture rule, for anyone touching a list:** tap selects, tap again puts
down, **hold** reads the man. Never double-tap — allowing it taxes every tap,
because none can act until the window for a second has passed.

**One test aid is left, behind a build flag** (`docs/TESTING_SHORTCUTS.md`): the
Settings UNLOCK button that stands in for the god mode purchase. It is in on
`npm run dev` and `npm run apk:test`, dead code in `npm run build` and `npm run
apk`, and Vitest never sees it. SIM THE SEASON, the guaranteed Pascagoula Tech
offer and its five 99-rated starters went on September 8; Hans Hood is gone for
good.

## Docs

| Doc | What it covers |
|-----|----------------|
| [01-roadmap.md](docs/01-roadmap.md) | The product, the stack, what is left and in what order |
| [02-sim-engine-spec.md](docs/02-sim-engine-spec.md) | Engine internals, the baseball research behind them |
| [03-engine-salvage-audit.md](docs/03-engine-salvage-audit.md) | The two forked engine copies and what to keep from each |
| [04-implementation-plan.md](docs/04-implementation-plan.md) | Defect register and the phase-by-phase plan |
| [05-systems-reference.md](docs/05-systems-reference.md) | **Every system in the game, with its numbers — and the register of what the game hides from the player.** Start here |
| [06-backlog.md](docs/06-backlog.md) | What is agreed, what is still a question, and the argument behind each |
| [07-v1-plan.md](docs/07-v1-plan.md) | **The staged route to v1.0.** Which stage shipped when, and what each one actually did |
| [08-handoff.md](docs/08-handoff.md) | Where the last session stopped and what the next one picks up. **Open this first** |
| [09-beta-audit.md](docs/09-beta-audit.md) | Findings from playing the game rather than reading it |
| [10-field-study.md](docs/10-field-study.md) | The other mobile college sims, and the platform standards the port has to meet |
| [11-language-triage.md](docs/11-language-triage.md) | The full-app copy audit from stage 15.5 |
| [12-test-triage-september.md](docs/12-test-triage-september.md) | The September phone report, sorted into batch P and stages 20–24 |
| [13-phone-report-pending.md](docs/13-phone-report-pending.md), [14-apk-report-triage.md](docs/14-apk-report-triage.md) | The APK report: the screenshots with their marks, and the thirty-eight items, all closed |
| [INTERACTION_DESIGN.md](docs/INTERACTION_DESIGN.md) | **The interface rulebook.** Three kinds of screen, and what a decision must show before it offers a verb. Read before adding any screen |
| [TESTING_SHORTCUTS.md](docs/TESTING_SHORTCUTS.md) | The three test aids in the build, and the rule that they leave together |
| [AUDIT_IMPLEMENTATION.md](AUDIT_IMPLEMENTATION.md), [VISUAL_POLISH_PASS.md](docs/VISUAL_POLISH_PASS.md), [REFINEMENT_PASS_2026-09-05.md](docs/REFINEMENT_PASS_2026-09-05.md), [SEASON_FLOW_REDESIGN_2026-09-05.md](docs/SEASON_FLOW_REDESIGN_2026-09-05.md), [PORTAL_CREATION_RECRUITING_FIX_PASS.md](docs/PORTAL_CREATION_RECRUITING_FIX_PASS.md) | The interface pass's own notes, in the order they were written. `05` §50 is what actually reached the code |

## Run it

Requires Node.

```
npm install
npm run dev          the game, at localhost:5174
npm run check        typecheck, then the full test suite
npm test             tests only
```

To play a build that does not move under you — no hot reload, no reload when a
file is saved — run `npm run build`, then `npm run preview`. It serves on 5173,
and on your phone at `http://<this machine's LAN IP>:5173`. That port is not
arbitrary: saves live in IndexedDB, which is scoped per origin including the
port, so a dynasty is only visible on the port it was played on. 5173 is the
one to keep pointed at the phone.

The headless CLI is still there, and is still how the engine gets measured:

```
npm run sim -- game                     one game with text play by play
npm run sim -- game --engine pitch      same, using engine B
npm run sim -- season                   a full league season
npm run calibrate                       league totals vs real D1 targets
npm run sim -- compare --n 1000         both engines side by side
npm run sim -- platoon --n 40000        prove the handedness model works
npm run sim -- parity --n 800           does the better team win too often
npm run goldens                         re-record the determinism goldens
```

Three probes are heavier than a test and print a judgment rather than a pass,
so they live outside Vitest and are run by hand:

```
npm run balance                         what badges and tendencies cost the league
npm run carousel -- 35 20260825         thirty-five seasons of the coaching carousel
npm run parity-sweep                    the better-team-wins curve across rating gaps
```

And five more, run with `npx tsx`, each written the day the thing it measures
was built:

```
tests/staff-probe.ts        what an assistant is actually worth (+2.02% runs at the extreme)
tests/balance-probe.ts      class headroom, star bands, quality drift, career lengths
tests/churn-probe.ts        thirty real seasons: does the pecking order move
tests/posfit-probe.ts       out-of-position play, and the identity property that protects the goldens
tests/climb-probe.ts        can a one-star programme climb
```

Read `posfit-probe.ts` before touching the fielding assignment: it records two
false starts that each measured the wrong thing, and the property whose failure
would put every golden in the suite at risk.

## Layout

```
src/engine/   the sim. No UI imports, ever — enforced by a test
src/state/    Zustand store, IndexedDB persistence, sim worker
src/ui/       screens and components
src/field/    the R3F scene, lazy loaded
src/data/     schools, conferences, name pools
tests/        Vitest, including calibration as a regression test
design/       the mockup that became the design of record — see stage 10.5
public/sfx/   the broadcast's clips, and their licences
docs/         see above
sim.ts        the headless CLI, kept forever
```

| Engine file | What it holds |
|------|---------------|
| `src/engine/ratings.ts` | Every baseball number in the game. League rates, rating to rate conversion, platoon math, fatigue. **Tune here and nowhere else.** |
| `src/engine/players.ts` | Player and team generation, the defensive spectrum, handedness, ages, potential |
| `src/engine/pitchModel.ts` | One pitch at a time. Zone rates and swing rates by count |
| `src/engine/engines.ts` | Both plate appearance engines |
| `src/engine/game.ts` | Nine innings, baserunning, steals, errors, fielders, box score |
| `src/engine/season.ts` | Schedule, standings, RPI, season statistics, tiebreakers, the career ledger |
| `src/engine/postseason.ts` | Conference tournaments, selection, regionals, Omaha, awards |
| `src/engine/recruiting.ts` | The three week window, scouting reports, priorities, commitments |
| `src/engine/progression.ts` | Offseason development, departures, walk-ons, roster turnover |
| `src/engine/draft.ts` | Eligibility, what the clubs can see, the round, talking him out of it |
| `src/engine/program.ts` | Prestige, coach skills, the board, job offers, getting fired |
| `src/engine/rivals.ts` | The other ninety-five coaches and the carousel |
| `src/engine/economy.ts` | The budget, the three assistant seats, facilities, the scouting desk |
| `src/engine/world.ts` | The rivalry ledger, and realignment |
| `src/engine/legacy.ts` | Signature moments, and what happens to a man after he leaves |
| `src/engine/positions.ts` | What a move costs a glove. Read by the fielding assignment in `game.ts` |
| `src/engine/pitches.ts`, `tendencies.ts`, `badges.ts`, `traits.ts` | What a man throws, what he is like, and what he is good at |
| `src/engine/records.ts`, `hall.ts`, `achievements.ts` | The all-time book, induction, and the cabinet |
| `sim.ts` | CLI and the calibration harness |

## The two engines

**Engine A, `log5`.** Generalized log5 picks the plate appearance outcome from
batter rates, pitcher rates, and league rates, normalized across seven events.
The pitch sequence is then constructed to land on that outcome. Season stats are
correct by construction. This is the one the game uses.

**Engine B, `pitch`.** Pitches are simulated freely and the outcome emerges. More
elegant in principle. In practice it took two full tuning passes to get within
10 percent of the targets, and strikeouts still run high.

## Two rules worth knowing before changing anything

**Calibrate across seeds, never one.** A single-seed harness cannot tell a
regression from luck; `CONTEXT.normalizer` was mistuned for a week because of it.
Anything that measures the engine runs eight base seeds.

**Reporting must never change what happens.** The play event stream is what the
3D field animates from, and asking for it must not consume a random draw — a game
watched pitch by pitch has to be the same game simulated silently. `landingFor`
derives its scatter from a hash for exactly this reason, and a test pins it.

## The most important knob

`SPREAD` in `src/engine/ratings.ts`. It scales every rating sensitivity at once.

Turn it up and stars separate more, but the better team starts winning too often
and the dynasty mode feels rigged. Turn it down and everyone plays the same.

Any time you change `SPREAD`, rerun `calibrate` and `parity` together.

Most of the time it is the wrong knob. How far a rating goes differs **per
event** — `BAT_SENS` and `PIT_SENS` beside it — and that is where the last
widening pass happened, because `SPREAD` also stretches singles and balls in
play, whose spread was already right and which are what decide games. Widening
an event costs a matching entry in `BAT_NORM` or `PIT_NORM` to hold the league's
realized rate where it was. See §9.7 of the systems reference.

## The prototype in `design/`

`design/Dynasty Mobile.dc.html` is a Claude Design canvas holding a working
12-screen mobile prototype, with its own forked copy of the sim engine inside it.

**It is the app's design** — palette, typography, layout, and interaction all port over
as-is. The roadmap's "Design direction" section is stale and was never adopted; where the
two disagree, the mockup wins. The three files in `design/` must stay together, since the
HTML loads the other two by relative path.
