# Playball

A college baseball dynasty game. You are the head coach: recruit high schoolers,
develop them, survive the MLB draft stealing your best arms every June, and chase a
national title in Omaha. Games resolve at bat by at bat with text play by play.
Mobile first, shipping to Android.

## Status

**v0.6.2.** Phases 0 through 6 are done: the engine, the season, the app shell,
roster management, recruiting, the 3D field and the dynasty layer. The whole loop
runs — pick a job, play or simulate a 33 game season, go through the postseason a
game at a time, hand out awards, spend coaching points, recruit a class over three
weeks, lose players to the draft, and start again the following February.

Phase 7 — shipping — has not started. No Capacitor build, no Android package, no
onboarding, no save slots.

The engine is calibrated multi-seed against sourced NCAA D1 rates and is within
about 3 percent on every target. 235 tests, including determinism goldens and
calibration as a regression test.

| Not built yet | |
|---|---|
| Capacitor / Android | hardware back button, safe area insets, signed build |
| Injuries and fatigue across a season | |
| Redshirts and eligibility | |
| Multiple save slots | one autosave today |
| Onboarding | |

## Docs

| Doc | What it covers |
|-----|----------------|
| [01-roadmap.md](docs/01-roadmap.md) | The product, the stack, the build phases |
| [02-sim-engine-spec.md](docs/02-sim-engine-spec.md) | Engine internals, the baseball research behind them |
| [03-engine-salvage-audit.md](docs/03-engine-salvage-audit.md) | The two forked engine copies and what to keep from each |
| [04-implementation-plan.md](docs/04-implementation-plan.md) | Defect register and the phase-by-phase plan |

## Run it

Requires Node.

```
npm install
npm run dev          the game, at localhost:5173
npm run check        typecheck, then the full test suite
npm test             tests only
```

The headless CLI is still there, and is still how the engine gets measured:

```
npm run sim -- game                     one game with text play by play
npm run sim -- game --engine pitch      same, using engine B
npm run calibrate                       league totals vs real D1 targets
npm run sim -- compare --n 1000         both engines side by side
npm run sim -- platoon --n 40000        prove the handedness model works
npm run sim -- parity --n 800           does the better team win too often
npm run goldens                         re-record the determinism goldens
```

## Layout

```
src/engine/   the sim. No UI imports, ever — enforced by a test
src/state/    Zustand store, IndexedDB persistence, sim worker
src/ui/       screens and components
src/field/    the R3F scene, lazy loaded
src/data/     schools, conferences, name pools
tests/        Vitest, including calibration as a regression test
design/       the mobile prototype, as a reference artifact
docs/         see above
sim.ts        the headless CLI, kept forever
```

| Engine file | What it holds |
|------|---------------|
| `src/engine/ratings.ts` | Every baseball number in the game. League rates, rating to rate conversion, platoon math, fatigue. **Tune here and nowhere else.** |
| `src/engine/players.ts` | Player and team generation, the defensive spectrum, handedness, potential |
| `src/engine/pitchModel.ts` | One pitch at a time. Zone rates and swing rates by count |
| `src/engine/engines.ts` | Both plate appearance engines |
| `src/engine/game.ts` | Nine innings, baserunning, steals, errors, fielders, box score |
| `src/engine/season.ts` | Schedule, standings, RPI, season statistics |
| `src/engine/postseason.ts` | Conference tournaments, selection, regionals, Omaha |
| `src/engine/recruiting.ts` | The three week window, pitches, priorities, commitments |
| `src/engine/progression.ts` | Offseason development, the draft, roster turnover |
| `src/engine/program.ts` | Prestige, coach attributes, job offers, getting fired |
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

## The prototype in `design/`

`design/Dynasty Mobile.dc.html` is a Claude Design canvas holding a working
12-screen mobile prototype, with its own forked copy of the sim engine inside it.

**It is the app's design** — palette, typography, layout, and interaction all port over
as-is. The roadmap's "Design direction" section is stale and was never adopted; where the
two disagree, the mockup wins. The three files in `design/` must stay together, since the
HTML loads the other two by relative path.
