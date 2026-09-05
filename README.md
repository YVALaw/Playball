# Playball

A college baseball dynasty game. You are the head coach: recruit high schoolers,
develop them, survive the MLB draft stealing your best arms every June, and chase a
national title in Omaha. Games resolve at bat by at bat with text play by play.
Mobile first, shipping to Android.

## Status

**Twenty-one of twenty-six stages shipped, through September 5 2026, and
the interface rebuilt whole the same day.** Ninety-six
programs in eight conferences of twelve, a forty-five game regular season, and
the whole loop runs: pick a job through an interview that shapes who rings you,
play or simulate a season, manage games at bat by at bat, go through the
postseason a game at a time, sit awards night, spend coaching points, work the
transfer portal and a recruiting board that is honest about being vague, argue
the MLB draft out of taking your junior, and start again the following February.

On top of that loop: **a budget** with three assistants, four rungs of
facilities and a scouting desk that gates what you can see of an opponent; **a
world that moves** — a career rivalry ledger, and realignment that trades one
programme for another about one winter in three; **a dynasty that remembers** —
signature moments on a man's card, and alumni whose professional careers play
out and end; and **a broadcast** — sound, haptics, ninety-six procedural
crests, full-screen cards for walk-offs and titles, and a scoreboard that
changes tone during a no-hitter.

Rival programs are run by ninety-five named men with careers of their own, and
the pecking order genuinely moves: measured over thirty seasons, six of the top
twelve programmes turn over.

**The interface, since September 5**, follows one written rulebook
(`docs/INTERACTION_DESIGN.md`): lists stay dense where the job is scanning;
a decision shows what is true, why it is being asked, what it trades, what
is left after, and then a verb; a story leads with the result. Program is a
dashboard with four doors, Budget a planning workspace, the player card four
sheets, and every action launcher a Decisions sheet that opens on state
before offering anything. With it came assistants who develop over winters,
a coaching tree, recruiting pipelines as program assets, three levels per
building, and replay off the real event stream. `docs/05-systems-reference.md`
§50 is the account.

What is missing is **the tail**: the store, the keystore and listing, the
guided tutorial, and the test aids coming out. Arguing the board's terms
and the art are in. Testing runs on an Android emulator against
`npm run apk`.

The engine is calibrated multi-seed against sourced NCAA D1 rates. **1133 tests
across 54 files**, including determinism goldens, calibration as a regression
test, and a concurrency suite pinning the store's double-press guards.

**It installs.** `npm run apk` builds a real Android package — Capacitor over
the same bundle the browser runs, no server, offline. The toolchain lives
outside the repo and outside PATH; the script supplies it. `npm run apk --
release` builds the unsigned release, and the keystore is stage 19's job and
the one thing that must never be lost.

| Not built yet | |
|---|---|
| Onboarding | the guided tutorial — a titled card, then a glow path through doing it (stage 19) |
| The store | the S+ player and Play Billing (stage 17, dead last with 19) |
| The interview's payoff | the answer's consequence revealing after the tap, and a result card (the rest of stage 24) |
| The budget's verdict | the reporter's read on the rebuilt Budget screen (stage 26) |
| The rest of the review | `docs/06-backlog.md` §X after its bugs: focus in the new sheets, the dead CSS, and two measurements (replay's save cost, the home-state recruiting edge) |

Shipped since: the two-way whole and corrected to the rulebook, playbooks,
the lineup gate, the season opener, the Android shell — package, launcher
icon, and a back gesture that peels one layer per press — the APK report's
thirty-eight items, and then the interface pass: the three-question
interview, Program as a dashboard, the Budget workspace, Decisions sheets,
the offseason roadmap, the postseason frame, hold feedback on the lineup,
and REPLAY, which the table above used to promise.

**The gesture rule, for anyone touching a list:** tap selects, tap again puts
down, **hold** reads the man. Never double-tap — allowing it taxes every tap,
because none can act until the window for a second has passed.

**Test aids in the build, and they must leave together before a store build**
(`docs/TESTING_SHORTCUTS.md`): SIM THE SEASON on Today, the guaranteed
Pascagoula Tech offer, and its five 99-rated starters. They were taken out in
the September 4 audit pass and put back on September 5 for rapid UI testing.
Hans Hood, the 99-potential third baseman injected into every class, is gone
for good — `ensureHoodHans` no longer exists.

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
