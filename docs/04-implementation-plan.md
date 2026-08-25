# Implementation Plan

**Last updated:** August 19, 2026
**Companion docs:** `01-roadmap.md` for the product and stack, `02-sim-engine-spec.md`
for engine internals, `03-engine-salvage-audit.md` for the two forked engine copies.

---

## Correction to the roadmap

`01-roadmap.md` v3 marks **Phase 0 as done** and describes the engine as "calibrated
against real NCAA Division I numbers." Neither claim holds:

- The engine has two confirmed bugs and four gaps against its own spec (below).
- No one has run the calibration harness on the current machine. Node is not installed.

This plan inserts **Phase 0.4 (stabilize)** and **Phase 0.6 (depth)** around v3's
Phase 0.5, and treats Phase 0 as substantially but not entirely complete.

---

## Measured baseline — August 19, 2026

The harness has now been run. Full output in `tests/fixtures/calibration-baseline.txt`,
reproducible from fixed seeds.

**Engine A (log5) is in good shape.** 2,000 games:

| Metric | Sim | Target | Diff |
|---|---|---|---|
| Runs per team per game | 6.84 | 6.79 | +1% |
| Home runs per team per game | 0.903 | 0.900 | 0% |
| Pitches per plate appearance | 3.75 | 3.75 | 0% |
| Batting average | .297 | .290 | +3% |
| On base percentage | .384 | .372 | +3% |
| Strikeouts per team per game | 8.15 | 8.50 | −4% |
| **PA per team per game** | **43.04** | **41.00** | **+5%** |
| **Walks per team per game** | **4.60** | **4.30** | **+7%** |

Everything lands within 7%, and the headline number — runs per team per game — is within
1%. The roadmap's claim that the engine is calibrated was **unverified but essentially
correct**. Walks and plate appearances are the drift worth chasing, and they are related:
extra walks lengthen innings, which inflates PA.

**Engine B (free pitch)** runs 6% light on scoring and 3% heavy on strikeouts, confirming
the README's standing note. It is a comparison instrument, not the shipping engine.

**The platoon model works.** 40,000 PA per matchup: lefty hitters show a 28-point AVG gap
between opposite and same handed pitching, righties 18 points. Both positive, lefty
clearly larger — exactly the shape `02-sim-engine-spec.md` argues for.

**Performance is a non-issue.** 2,000 full games in 0.8 seconds, roughly 2,500 games per
second. The roadmap budgets 200 ms for a 32-game season; the engine does that in about
13 ms.

---

## Sourced reference figures

NCAA aggregates are not obtainable — the NCAA's statistics site serves navigation pages
rather than league totals, and Baseball-Reference refuses automated requests. **MLB is
therefore the only sourced anchor available.**

**Use these as a base to adjust from, never as targets.** Adopting MLB's numbers wholesale
would make this a different game: 4.39 runs per team per game instead of 6.79, a .243
batting average instead of .290. `02-sim-engine-spec.md` is emphatic that the output should
look like college baseball and not a reskinned MLB sim, and the gap below is exactly why.

| MLB figure | Value | Season | Source |
|---|---|---|---|
| Runs per team per game | 4.39 | 2024 | [StatMuse](https://www.statmuse.com/mlb/ask/average-runs-per-game-by-baseball-team-2024) |
| Strikeouts per team per game | 8.47 | 2024 | [Sportscasting](https://www.sportscasting.com/news/mlb-trends-2024-batting-average-hits-lowest-mark-since-1968/) |
| Strikeout rate (K%) | 22.7% | 2024 | [FanGraphs](https://library.fangraphs.com/offense/rate-stats/) |
| Walk rate (BB%) | 8.6% | 2024 | [FanGraphs](https://library.fangraphs.com/offense/rate-stats/) |
| Batting average | .243 | 2024 | [Sportscasting](https://www.sportscasting.com/news/mlb-trends-2024-batting-average-hits-lowest-mark-since-1968/) |
| Doubles per game | 1.54 | 2024 | [Sportscasting](https://www.sportscasting.com/news/mlb-trends-2024-batting-average-hits-lowest-mark-since-1968/) |
| First to third on a single | 28% (70% hold) | 2012 | [The Hardball Times](https://tht.fangraphs.com/a-brief-history-of-running-first-to-third/) |
| XBT% (extra base taken) | 40–41% | 2011, 2015 | [Baseball-Reference](https://www.baseball-reference.com/blog/archives/10867.html) |
| Home winning percentage | .534 (2020s), .522 (2024) | — | see `CONTEXT.homeFieldOffense` |

Two of these are already load-bearing. `firstToThirdOnSingle` is anchored to the 28%
figure and marked up for college. XBT% at 40–41% is the composite of all three
discretionary advance rates in `BASERUNNING` and is the number to sanity-check them
against — if the college rates imply an XBT% far above 41%, they are too aggressive.

---

## Engine defect register

Bugs B1, B2 and gaps G1–G4 were found by reading the source. B3 and T1 were found by
running it.

### Bugs

**B1 — Walk-offs do not end the game.** `game.js`, `playHalfInning` — **FIXED 2026-08-19**
The half-inning loop exits only on three outs. The outer loop correctly *skips* the
bottom of the 9th when the home team already leads, but once the half-inning begins it
runs to completion regardless of the score. A walk-off with nobody out keeps playing and
the extra runs score.

*Impact:* inflates home-team run totals in every game decided in the bottom half, and adds
plate appearances that should never have happened. A contributor to the +5% PA drift,
though not the whole of it — walks are 7% high independently.

*Fixed:* `playHalfInning` takes a `canWalkOff` flag, set for the home half of the 9th and
later, and breaks the moment the batting team goes ahead. Correct walk-off scoring came
with it: on anything other than a home run the game ends when the winning run touches the
plate, so trailing runners never score and the margin is exactly one. A home run is the
exception — the ball is dead and every run counts.

*Verified:* `tests/walkoff-check.mjs`, 20,000 games. 1,854 walk-off wins, 90.4% by exactly
one run, remainder distributed across 2, 3, and 4 — the multi-run homers. Nothing above a
grand slam margin.

*Measured effect on calibration:*

| Metric | Pre-fix | Post-fix | Target |
|---|---|---|---|
| Runs per team per game | 6.84 (+1%) | 6.63 (−2%) | 6.79 |
| PA per team per game | 43.04 (+5%) | 42.65 (+4%) | 41.00 |
| Batting average | .297 (+3%) | .294 (+1%) | .290 |
| On base percentage | .384 (+3%) | .380 (+2%) | .372 |
| Home runs per team per game | 0.903 (0%) | 0.879 (−2%) | 0.900 |
| Walks per team per game | 4.60 (+7%) | 4.57 (+6%) | 4.30 |

Batting average, OBP, and PA all moved toward target; runs and home runs overshot slightly
low. That shape makes sense — the bug only continued innings in which the home team had
just scored, so it was over-sampling rallies specifically.

**Do not retune for the −2% yet.** B3 adds home field advantage, which puts offense back
on. One calibration pass after B2 and B3 land, not three.

**B2 — `LEAGUE_PITCH` is dead configuration.** `ratings.js:26`
Seven constants — `firstPitchStrike`, `strike30`, `foulShareOfSwings`,
`missShareOfSwings`, `zoneRate`, `chaseRate`, `zSwingRate` — are exported and imported
nowhere. `pitchModel.js` hardcodes independent `ZONE`, `SWING`, and `SWING_RESULT`
tables.

*Impact:* the D1 rates the spec calls "the single most distinctive number in the college
game" are documentation, not behavior. Two sources of truth for the same numbers, already
drifting. Violates the `ratings.js` "tune here and nowhere else" rule.

*Fixed:* `pitchModel.js` now rescales all three tables at load from the base they were
measured against to whatever `LEAGUE_PITCH` currently says. The readable D1 numbers stay
in the file as the *shape* of each count curve; their *level* comes from `ratings.js`.
Reproduces the old tables to within 0.3%, the rounding in the shape multipliers.

*Caveat found while fixing it:* `pitchModel.js` is imported only by `enginePitch`.
**`engineLog5`, the shipping engine, never touches it** — it builds sequences with
`constrainedSequence` instead. So this fix only governs Engine B. Engine A's pitch texture
turned out to be badly off, which is B4.

**B4 — Engine A's swing composition was wrong.** `engines.js`, `constrainedSequence` —
**FIXED 2026-08-19**
Measured over 200,000 plate appearances, the shipping engine produced 33.8% swinging
strikes against a 21.5% target, and 32.1% fouls against 36.5%. `02-sim-engine-spec.md`
states the miss rate on swings is "under 20%" — the engine was at nearly double.

*Cause:* `constrainedSequence` hardcoded its foul/called/swinging mix as bare literals.
Of non-terminal strikes it made 30% fouls, then split the rest 42% called / 58% swinging.
That last split was the whole problem.

*Fixed:* the literals moved into `SEQUENCE` in `ratings.js`, then were tuned by sweep.
Foul share was right at 0.30 all along; the called-vs-swinging split should be **0.78**,
not 0.42. Nothing else changed.

| Engine A | Before | After | Target |
|---|---|---|---|
| Foul share of swings | 0.321 (−12%) | 0.367 (+1%) | 0.365 |
| Miss share of swings | 0.338 (+57%) | 0.216 (0%) | 0.215 |
| First pitch strike rate | 0.578 | 0.579 | 0.584 |
| Pitches per PA | 3.785 | 3.740 | 3.750 |

Season stats are unaffected — Engine A fixes outcomes before it builds the sequence. This
is purely the texture of the play by play, which is the point of having a pitch layer.

*Verified:* `tests/pitch-level-check.mjs`.

**B3 — There is no home field advantage.** Found by measurement — **FIXED 2026-08-19**
Sweeping six rating matchups with home and away split evenly, the better team wins at the
same rate in both parks. At a 12-point gap: 76.5% at home, 76.0% on the road. At a
2-point gap: 56.0% and 56.9%. The difference is noise in every row.

*Impact:* real NCAA Division I home teams win roughly 57–58% of the time. The engine
gives home teams nothing but the last at bat. Standings, RPI, and the felt difference
between a home series and a road trip all flatten out — and "protect home field" is
supposed to be a season-long motivation.

*Fixed:* `CONTEXT.homeFieldOffense`, applied in `contextMultiplier` as a lift for the home
side and the **reciprocal penalty for the visitor**. Applying it one-sided reached 57% only
by inflating home scoring 6.8% with nothing given back, which pushed league runs off
target. Symmetric, it buys the same win rate at roughly neutral league scoring.

Tuned by sweep with the same two teams alternating home and away, so nothing but the home
effect is being measured. At 1.000 the sweep returns 50.2%, the independent confirmation
that the engine previously had no home edge at all. **Shipped at 1.020 → 55.1%.**

*Evidence for the target.* An earlier pass used 57.2% on a half-remembered "D1 runs 57–58%"
figure. Checked against sources:

| League | Home win % |
|---|---|
| MLB, historical | ~54% |
| MLB, 2020s decade | .534 — lowest of the Live Ball era |
| MLB, 2024 | .522 |
| **D1 conference games, 2015–19** | **55–60%** |
| NCAA RPI model's assumption | 70% — valid for basketball, wrong for baseball |

The D1 figure is from a Samford Center for Sports Analytics study of every Power Five and
SOCON conference game, restricted to conference play specifically to strip out the
non-conference scheduling bias where large programs buy home games against weak opponents.

We sit at the **conservative end** of that range deliberately. The sim measures the
cleanest possible case — identical roster quality, alternating home and away — so it
should not claim the top of a range still carrying real-world noise. Baseball's home edge
is also trending down.

Do not use the NCAA's "hosting a Regional gives ~70% odds of advancing" figure as a
target. Hosts are seeded teams; that number is mostly team quality.

Worth knowing: home teams still score *fewer* runs per game than visitors at every setting,
because they skip the bottom of the 9th when leading and stop mid-inning on a walk-off.
That is correct baseball, and it is why the multiplier has to be as large as it is.

**B5 — `LEAGUE_K_RATE` contradicts the harness's strikeout target.** Open, and reframed —
see "The 8.5 problem" below.
`ratings.js` sets `LEAGUE_K_RATE = 0.180` — the share of plate appearances ending in a
strikeout. `sim.js` targets 8.5 strikeouts per team per game across 41 plate appearances,
which is a rate of **0.207**. Two numbers for the same quantity, 15% apart, in two files.

The engine currently measures 8.01 (−6%), sitting between them. Real D1 runs near 0.20,
so the harness target is closer to right and `LEAGUE_K_RATE` is low.

This is the same disease as B2: a constant that is supposed to be authoritative living
next to a second, disagreeing copy of itself.

#### The 8.5 problem

**MLB struck out 8.47 times per team per game in 2024.** The harness targets 8.5. Those
being within 0.03 of each other is not a coincidence worth ignoring.

The two are not equivalent, because the leagues do not have the same number of plate
appearances:

| | K per team per game | PA per team per game | K rate |
|---|---|---|---|
| MLB 2024 | 8.47 | ~38 | **22.3%** |
| `sim.js` target | 8.50 | 41 | **20.7%** |
| `LEAGUE_K_RATE` | — | — | **18.0%** |
| Playball now | 8.07 | 42.31 | 19.1% |

An absolute strikeout count imported from MLB and dropped into a league that bats three
more times per game silently becomes a *lower* rate — but still a much higher one than the
18% `ratings.js` claims.

**Which is right depends on a D1 number nobody has.** The direction of the college
adjustment is not even obvious: metal bats and a contact approach push college strikeout
rates below MLB, while the velocity in modern D1 pushes them up. `LEAGUE_K_RATE = 0.180`
is a defensible D1 figure. So is 20%.

*Recommendation:* treat the engine's current 19.1% as acceptable and **stop calling the
−5% a defect** until the target is sourced. Do not tune toward 8.5 — it is probably an MLB
number wearing a college jersey, and chasing it would drag the whole engine toward MLB's
strikeout environment, which is the one thing `02-sim-engine-spec.md` is most insistent
about avoiding.

**B6 — Context modifiers inflate league offense.** Open.
`contextMultiplier` multiplies every non-out event by the runners-on boost, the
times-through-the-order penalty, and the inverse fatigue multiplier. Each is individually
justified, but their product averages meaningfully above 1.0, so the *average* plate
appearance is boosted rather than just the situational ones. Offense drifts above the
league baseline that `LEAGUE` is supposed to define.

Symptom: walks measure +7% and PA +4%, while `LEAGUE.walk = 0.105` exactly matches the
harness's implied target of 0.1049. The baseline constant is right; the context layer is
inflating past it.

*Fix built, not yet switched on.* `CONTEXT.normalizer` divides the context product in
`contextMultiplier`. It ships at **1.000**, which is inert and reproduces current behavior
exactly. It is not turned up yet, because doing so exposes B7:

| normalizer | runs | PA | AVG | OBP | BB | baserunners/g | **% scoring** |
|---|---|---|---|---|---|---|---|
| 1.000 (shipped) | 6.59 | 42.42 | .295 | .381 | 4.53 | 16.16 | 40.8% |
| 1.015 | 6.33 | 42.16 | .289 | .374 | 4.44 | 15.77 | 40.1% |
| 1.030 | 6.24 | 42.09 | .286 | .371 | 4.38 | 15.62 | 40.0% |
| **target** | **6.79** | **41.00** | **.290** | **.372** | **4.30** | **15.25** | **44.5%** |

At 1.030 the on-base side lands almost exactly on target — OBP .371 against .372,
baserunners 15.62 against 15.25 — and runs get *worse*, falling to −8%. Normalizing does
its job; it just reveals that the run total was being propped up by surplus baserunners.

Turn the normalizer up to ~1.030 once B7 is fixed, not before.

**B7 — The engine strands too many runners.** Open. Found by fixing B6.
Real D1 scores 6.79 runs from about 15.25 baserunners per team per game, so **44.5% of
baserunners score**. This engine converts **40%** — a 10% relative shortfall that holds
steady at every normalizer setting, so it is a property of run conversion, not of the
rate model.

*Why it stayed hidden:* the B6 context inflation was manufacturing roughly one extra
baserunner per game, and that surplus was papering over the conversion gap. Runs looked
close to target because two errors were cancelling. Fixing either one alone makes the
totals look worse, which is why the normalizer ships inert.

*Where to look,* in rough order of likely yield:

1. `advanceOnHit` — discretionary advance rates may be too conservative. First to third on
   a single is 31% base; scoring from second on a single is 63% base
2. `resolveOut` — the double play rate (36% base on a ground ball with a man on first) and
   the sacrifice fly rate (62% on a fly ball with a runner on third)
3. `maybeSteal` — attempts are rare and only ever first to second, so the running game
   contributes almost nothing to run creation
4. Whether the log5 model's extra-base-hit mix is too flat. Slugging measures .445, which
   looks reasonable, so this is the least likely of the four

*Do not* fix this by inflating rates elsewhere to compensate. Two cancelling errors is the
state we are trying to leave.

**Partially fixed 2026-08-19.** Two real defects found and closed:

1. **The RBI groundout did not exist.** `resolveOut` had branches for double plays, sac
   flies, and a runner moving second to third — but no path for a runner on third scoring
   on a routine ground out with the infield back. A runner on third could only score on a
   hit or a fly ball. Adding it was worth 0.13 runs per team per game.
2. **Baserunning constants were hardcoded** through `game.js`. They now live in
   `BASERUNNING` in `ratings.js`, alongside the double play, fielder's choice, and sac fly
   rates.

**The double play theory was wrong.** Measured, the engine turns 0.59 double plays per team
per game against a real D1 figure near 0.70 — *below* target, not above. Rally-killing was
not the problem. Sacrifice flies at 0.20 against ~0.35 are genuinely low, but that is
mostly downstream of having too few runners reach third.

### Caution on the 44.5% figure

**That target is my own derivation and should not be trusted.** It came from
`OBP × PA = baserunners`, which excludes reached-on-error — and D1 averages about one error
per team per game, so the real denominator is larger and the real conversion rate lower.
It is the same mistake as the first home field number: a plausible figure computed rather
than sourced.

Evidence it is wrong: reaching 44.5% requires a **91% chance of scoring from second on a
single**, against a real-world rate near 60%. Sweeping the discretionary rates to 1.45×
their MLB baselines still only reached 43.1%. When a target demands physically implausible
inputs, suspect the target.

The shipped values sit at a college markup — 0.72 / 0.355 / 0.63 against MLB's
0.59 / 0.28 / 0.45.

**Cross-checked against XBT%.** Weighting the three rates by roughly how often each
situation arises (runner on first with a single ~55% of chances, runner on second with a
single ~25%, runner on first with a double ~20%):

| Rate set | Implied XBT% |
|---|---|
| MLB (0.28 / 0.59 / 0.45) | **39%** — matches the sourced 40–41% league average |
| Playball college (0.355 / 0.72 / 0.63) | **50%** |

The first row is the useful result: two of those three MLB values were inferred rather than
sourced, and they reproduce the one composite figure that *is* sourced. That is good
evidence the MLB baseline is sound.

The second row is the open question. A 50% XBT% is a 25% relative markup over MLB. College
defense is genuinely worse, but that is a large jump, and it was reached by calibration
pressure rather than evidence. **If it needs to come down, runs come down with it** — the
sweep showed roughly −0.3 runs per team per game for every 0.15 of scale. That is the
trade, stated plainly, for whoever decides it.

*Before tuning this further, get real D1 aggregates.* More knob-turning against a
self-derived target is how the two-cancelling-errors state got created in the first place.

### Test defects

**T1 — The parity harness tests a matchup the game never produces.**
`sim.js parity` hardcodes a 68-rated team against a 38-rated team, a 30-point gap, and
prints "if you see 95 percent plus, your rating spread is too wide." It returns 95.8%, so
by its own criterion it fails.

That verdict is wrong, and the sweep in `tests/parity-sweep.mjs` shows why:

| Gap | Better team wins |
|---|---|
| 30 (68 v 38) | 95.6% |
| 18 (62 v 44) | 86.0% |
| 13 (57 v 44) | 78.5% |
| 12 (58 v 46) | 76.3% |
| 7 (55 v 48) | 67.0% |
| 2 (52 v 50) | 56.4% |

The conference the game actually ships with spans quality 44 to 57 — a **13-point** spread
at its widest. There, the better team wins 78.5%, squarely inside the harness's own
75–85% target. `SPREAD = 0.62` is correctly tuned for the range the game uses. A 30-point
gap is an SEC powerhouse against a bottom-tier program, and 95% is not obviously wrong for
that matchup anyway.

It also confirms the README's claim: 58 versus 46 was said to be "about 74 percent," and it
measures 76.3%.

*Fix:* re-point the parity harness at a realistic gap, or have it print the whole sweep so
the shape is visible instead of one number out of context. The engine needs no change.

### Gaps against `02-sim-engine-spec.md`

**G1 — No individual fielders.** The spec's ball-in-play section wants batted-ball type →
responsible fielder by spray direction → range check → error check, with Strat-O-Matic's
separate range and error ratings. Current behavior: one team-average `fielding` number
drives a flat 5.5% error roll. There is **no catcher in the engine at all**, so
`maybeSteal` ignores catcher arm — a regression against the prototype, which uses it.

**G2 — No pitch types.** `01-roadmap.md`'s data model lists `pitches[]`. The spec ties
pitch type to platoon splits: sliders punish same-handed hitters, cutters play evenly,
arm slot amplifies both. Nothing exists.

**G3 — No AI decision layer.** The spec's run-expectancy matrix over 24 base-out states,
with steal / bunt / pitching change / pinch hit / IBB decided by expected-runs comparison
and weighted by coach personality, is entirely absent. `maybeSteal` is a flat probability
and no other decision exists.

**G4 — `ratingToRate()` never written.** The spec asks for one conversion function with a
league-context parameter. The engine uses `mult()` plus per-event sensitivity tables —
functionally similar, but with no league context and no single entry point.

### Smaller items

| | Item | Where |
|---|---|---|
| S1 | Bench generated, never used — no pinch hitting | `players.js:136`, `game.js` |
| S2 | Steals only first-to-second; no third, no double steal | `game.js`, `maybeSteal` |
| S3 | Engine B strikeouts run high (acknowledged in README) | `engines.js` |
| S4 | No DH / two-way P-DH option; DH hardcoded in the lineup | `players.js` |
| S5 | No pitch clock or mound-visit limits | spec's college-rules section |
| S6 | Extra-innings runner-on-second option absent | `game.js` |

---

## Phases

### Phase 0.4 — Stabilize the JavaScript engine

Goal: a trustworthy, measured baseline before anything is rewritten.

- [x] Install Node LTS — 24.19.0
- [x] Run all four harnesses and save the pre-fix output to
      `tests/fixtures/calibration-baseline.txt`
- [x] Sweep win rate across rating gaps (`tests/parity-sweep.mjs`) to check `SPREAD`
- [x] Fix **B1** (walk-off) and **B2** (`LEAGUE_PITCH` wiring)
- [x] Fix **B4** (Engine A's swing composition), found while fixing B2
- [x] Add **B3** (home field advantage) — 57.2% home win rate, league-scoring neutral
- [x] **B6** — normalizer live at 1.015
- [~] **B7** — RBI groundout added, baserunning constants extracted and marked up for
      college. Remainder blocked on sourcing real D1 data, not on more tuning
- [x] Re-run everything and save `tests/fixtures/calibration-postfix.txt`
- [ ] Resolve **B5** (`LEAGUE_K_RATE` unverified) — needs a sourced D1 strikeout rate
- [ ] Re-point **T1** (the parity harness's unrealistic matchup)

### Where the numbers landed

| Metric | Pre-fix | Post-fix | Target |
|---|---|---|---|
| Runs per team per game | 6.84 (+1%) | 6.62 (−3%) | 6.79 |
| Batting average | .297 (+3%) | **.289 (−0%)** | .290 |
| On base percentage | .384 (+3%) | **.375 (+1%)** | .372 |
| Walks per team per game | 4.60 (+7%) | **4.43 (+3%)** | 4.30 |
| PA per team per game | 43.04 (+5%) | 42.31 (+3%) | 41.00 |
| Home runs per team per game | 0.903 (0%) | 0.892 (−1%) | 0.900 |
| Strikeouts per team per game | 8.15 (−4%) | 8.07 (−5%) | 8.50 |
| Pitches per PA | 3.75 (0%) | 3.71 (−1%) | 3.75 |

Runs read *worse* than the baseline and the engine is *more* correct than it was. The
old +1% was two errors cancelling — surplus baserunners from the context inflation
covering for missing run-conversion paths. Every component rate is now closer to target
than it was, and the residual is honest.

Strikeouts are the one metric that did not improve. That is B5, and it stays open until
someone sources a real D1 rate.

**Done when:** the four harnesses run clean, walks and PA are inside 3%, home teams win
near 57%, and both baselines are on disk. The pre-fix file is what the TypeScript port
gets diffed against; the post-fix file is what the engine should look like going forward.

`SPREAD` needs no change — the sweep shows 0.62 is correct for the 44–57 quality range the
game actually ships with.

**Why first:** B1 means the current numbers are wrong in a known direction. Porting first
would carry the bug into TypeScript and make the post-port calibration ambiguous — was it
the port or the bug?

---

### Phase 0.5 — TypeScript conversion

Mechanical, and deliberately done while the codebase is still ~970 lines.

1. `npm init`, Vite + TypeScript + Vitest, `tsconfig.json` with `strict: true` and
   `noUncheckedIndexedAccess: true`
2. `src/engine/types.ts` — domain model, branded `PlayerId`/`TeamId`, exhaustive unions
   for `PAEvent` / `PitchResult` / `BattedBall`, `assertNever` helper
3. Port the five engine files in dependency order: `ratings` → `players` → `pitchModel` →
   `engines` → `game`. Extract the xorshift RNG to `rng.ts`
4. Port `sim.js` → `sim.ts`, run under `tsx`
5. Move the calibration harness into Vitest as a regression test asserting against the
   Phase 0.4 baseline
6. Add the `PlayEvent` type and emit it from `game.ts` — cheap now while the file is
   already open, and it is the engine↔3D boundary v3 depends on
7. ESLint boundary rule: nothing in `/engine` may import `/ui`, `/state`, or `/field`

**Done when:** `npm test` passes, the engine compiles clean under strict, and calibration
output matches the Phase 0.4 baseline within sampling noise.

**Scope discipline:** no behavior changes in this phase. Any bug found gets written into
the register and fixed in 0.6, so that a calibration difference can only mean the port
broke something.

### Completed 2026-08-19

**The port reproduces the JavaScript engine exactly.** Not "within sampling noise" —
identical to every digit the harness prints, on the same seed. That is the whole reason
Phase 0.4 captured a baseline first.

| | JS baseline | TS port |
|---|---|---|
| Runs per team per game | 6.62 | 6.62 |
| Batting average | .289 | .289 |
| On base percentage | .375 | .375 |
| Home runs per team per game | 0.892 | 0.892 |
| Strikeouts per team per game | 8.07 | 8.07 |
| Slugging | .437 | .437 |

Delivered:

- `tsconfig.json` — `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`. Compiles clean.
- `src/engine/types.ts` — domain model, branded `PlayerId`/`TeamId`, exhaustive unions,
  `assertNever`, and the `PlayEvent` boundary type
- Seven engine modules ported: `rng`, `ratings`, `players`, `pitchModel`, `engines`,
  `game`, plus a new `calibration`
- `sim.ts` on tsx, same six commands
- **49 tests** across two files, all passing

**One deviation from the roadmap's sketch:** ratings stay flat on the player rather than
nested under `ratings` / `pitching`. The sensitivity tables look attributes up by name,
which types cleanly against a flat shape and awkwardly against a nested one. Nesting is a
separate refactor, not something to smuggle into a port whose job is to change nothing.

### B8 — Shared mutable state broke reproducibility

Found by the test suite immediately, which is the argument for having one.

`players.ts` keeps the unique-name pool in a module level `Set`. A second calibration run
in the same process skips names it already used, which consumes different random draws,
which generates different players, which produces **different league rates from the same
seed**. Two runs in one process silently disagreed.

Invisible from the CLI, where every run is a fresh process. Not invisible in a Vitest file,
and it would have been actively dangerous in Phase 2, where the roadmap puts season
simulation in a long-lived Web Worker.

*Fixed:* `newTeams` calls `resetNames()` before generating. Golden values unaffected —
they were recorded from a clean process, which is what the reset restores.

### Guardrails added

- **`tests/calibration.test.ts`** — splits determinism from calibration deliberately.
  Determinism pins the exact league rates to ten decimal places; calibration checks them
  against the D1 targets at the harness's own 10% bar. When determinism fails and
  calibration passes, engine behavior changed: decide whether that was intended, then move
  the golden values in the same commit.
- **`tests/architecture.test.ts`** — enforces the roadmap's one architectural rule by
  scanning `src/engine` for imports from `ui`/`state`/`field`, front end packages, DOM
  globals, `Math.random`, and clock reads. Chosen over an ESLint plugin because it runs in
  `npm test` and needs no new tooling.

### PlayEvent emission — done

`game.ts` now emits the stream the field layer will animate from, behind
`SimOptions.playEvents`. **Off by default**: a calibration run sims millions of plate
appearances and has no use for it.

Emitted per plate appearance: one `pitch` event per pitch, a `contact` event carrying the
batted ball type, an `advance` event listing every runner who moved, and `out` / `score`
events with their counts.

Runner movement is expressed in **base numbers, not array indices** — 0 is the batter at
the plate, 1 through 3 are the bases, 4 is home. Runners who stayed put are omitted.

A prerequisite came with it: `PlayEvent.runners` needs `PlayerId`, and nothing generated
ids. They now derive from the player's name, which the generator already guarantees is
unique. Deliberately not a module level counter — that is precisely the shared mutable
state that caused B8, and repeating it one file later would be indefensible.

**Not emitted, honestly rather than faked:**

- `landing` coordinates. Spray direction arrives with individual fielders in Phase 0.6.
  Until the engine actually decides where a ball goes, a coordinate here would be inventing
  data the simulation never produced.
- Steals and pitching changes. The snapshot is taken after the steal check, so the stream
  describes the plate appearance itself. Phase 5 work.
- Per-runner outs. The `out` event carries the count; which runner was retired is Phase 5
  detail.

*Verified* by `tests/play-events.test.ts`: runs in the stream equal runs on the scoreboard,
pitch events equal pitches thrown, outs reconcile against half innings played, no runner
moves backwards, and — the load bearing one — **switching the stream on does not change the
game.** It is a pure observation, not a participant.

Calibration output after all of this is byte-identical to before it. Adding ids and event
emission consumed no random draws.

---

### Phase 0.6 — Engine depth

Now safe to make real changes: strict types catch the breaks, the calibration test catches
the drift.

1. **G1 — fielders.** Add `range` and `errorRate` ratings, a defensive position map, a
   real catcher. Spray-direction roll influenced by handedness. Wire catcher arm into
   steals. The rating fields land in `types.ts` back in 0.5 so the model is right from
   the start; the behavior that consumes them is built here.
2. **S1, S2 — bench and baserunning.** Pinch hitting; steals of third; double steals
3. **G3 — AI decision layer.** Run-expectancy matrix over the 24 base-out states, then
   steal / bunt / IBB / pitching change as expected-value comparisons. Coach personality
   weights last
4. **Port the prototype's tactics.** Hit-and-run, play-for-contact, pitch-for-ground-ball,
   pitch-around, infield-in — as `mods` bending the event vector, which is how the
   prototype does it and it composes cleanly
5. **S3 — Engine B strikeout calibration**
6. **G4 — `ratingToRate()`** as the single conversion entry point
**Not in this phase:** pitch arsenals (G2) and two-way players, both deferred past v1.

**Done when:** calibration still hits the D1 targets, and defense is a real lineup
tradeoff — a slick-fielding, weak-hitting shortstop should have a defensible case.

---

### Phase 1 — The season

Still headless. Most of this ports up from the prototype (see `03-engine-salvage-audit.md`).

1. `season.ts` — schedule generator from the prototype's `buildSchedule` + `roundPairs`.
   **12 teams, 32 games**, with team count as a parameter so the world can grow later
2. Day-by-day season loop; season-long stat accumulation on the player record
3. Standings, streaks, run differential, RPI approximation, stat leaders
4. Conference tournament bracket; NCAA regionals, supers, Omaha; season awards
5. Extract hardcoded arrays to `src/data/{schools,conferences,names}.json`
6. `sim.ts season` prints a full year

**Done when:** the stat leaders from a simmed season look like real college baseball.

### Progress 2026-08-19

Done: `src/engine/season.ts`, `src/data/schools.ts`, `npm run sim -- season`, and
`tests/season.test.ts` (19 tests). A full 192-game season sims in about a second.

**No `Date` anywhere.** A day is an integer offset from opening day. Calendar dates are a
presentation concern, and keeping them out is what lets a season replay exactly from its
seed — the architecture test now enforces it.

**Season length settled at 33: eleven three-game series, a clean single round robin.**
Every team plays every other team exactly three times.

The alternatives considered were 32 (10 series plus 2 midweek — unbalanced, each team
misses an opponent) and 44 (11 series plus 11 midweek — balanced in both directions and
the only length that makes the fourth rotation slot real). 44 lost on the grounds that
matter most for a game: a season has to be finishable before it is realistic.

**The cost of 33: rotation slot 3, the midweek arm, never starts.** With no midweek games
the weekend *is* the schedule, so the rotation is effectively Friday, Saturday, Sunday.
The fourth starter is still generated and still on the roster, deliberately — removing him
would shift the player generation draw order and move every calibration fixture, and real
programs carry a fourth arm regardless. He becomes load bearing when injuries arrive in
Phase 3. Raising `midweekGames` brings him back into the rotation at any time.

**A second consequence:** with no non-conference games, conference record and overall
record are now identical, and RPI has much less to distinguish teams by. Both become
interesting again when the world grows past one conference.

**The schedule bug worth remembering.** Home and away were assigned by a formula keyed on
the round and the pairing position. The circle method pins team 0 and rotates everyone
around it, so any such formula correlates with the rotation: the first attempt gave one
team 31 home games and another 1. Formula-based venue assignment does not work here.

Replaced with an explicit two-pass assignment — greedy in date order, then a repair sweep
that flips any venue where flipping moves both teams closer to an even split, scored on
squared deviation. This mattered more than it looks: **home field advantage is now real**,
so a lopsided home schedule silently distorts the standings.

At 33 games every team hosts either five or six of its eleven series, which is 15 or 18
home dates. That spread is not slack in the algorithm — a series is three games at one
venue, so home dates only move in threes, and eleven series cannot split in half. One
series between the most and least hosted is the floor. The test asserts exactly that
rather than a tolerance.

**The NCAA innings qualifier.** The ERA leaderboard first surfaced a reliever with 20.7
innings above an ace with 97. The NCAA's own qualifiers are 2.0 plate appearances per
team game for a batting title and 1.0 inning per team game for an ERA title; both now
apply.

Sample output reads right — batting champ .410, not the .480 the spec warns about; ERA
leader 2.74; 10 home runs in a 32-game season.

### Known weak spots in the season layer

**S8 — Win and loss attribution is naive.** The starter always takes the decision. A real
scorer hangs the win on whoever was pitching when the lead changed for good, which needs a
leverage trail `game.ts` does not keep. The cost is visible in output: one starter finished
8-2 with an 8.56 ERA, which is a good team's record, not a good pitcher's. Saves are closer
to right — reliever, finished a win, margin of three or fewer.

**S2 confirmed at season scale.** The stolen base leader finished with 9. Real D1 leaders
steal 30 to 40 across a full season, so roughly 20 across 32 games. `maybeSteal` only ever
sends a runner from first to second, and only when second is empty. The running game barely
exists.

### Postseason and awards — done

`src/engine/postseason.ts`, plus `tests/postseason.test.ts` (18 tests).

**Generic bracket machinery**, so the same code runs a national bracket later:
`doubleElimination` over any field size with byes for odd fields, and `bestOf` for
series. The better seed hosts every game, which is now worth something.

**Conference tournament:** top eight by regular season finish, double elimination — the
format almost every real conference uses. Tournament games count toward overall records
and season statistics (as NCAA totals do) but never toward the conference race that seeded
the bracket.

It produces real narratives. The first run had the top seed lose in the winners' round,
run the entire elimination bracket, then beat the undefeated finalist twice to take it.

**Awards:** Player of the Year (hitters only), Pitcher of the Year, Freshman of the Year,
and an All-Conference first team — best bat at each of the nine spots plus three arms.
Pitching value is innings carried discounted by runs allowed, so a reliever with a shiny
ERA over thirty innings cannot beat an ace who carried a hundred.

**Name pools** moved to `src/data/names.ts`. A pure move — calibration fixtures unchanged.

### B9 — Standings were not stable across the postseason

`standings()` breaks ties on overall record and run differential, and tournament games move
both. Asking for the table again after the bracket returned a *different regular season*
than the one actually played, so seeding disagreed with itself. Caught by a seeding test.

*Fixed:* `SeasonState.finalOrder` records the regular season order the moment the schedule
runs out, and `conferenceTournament` seeds from that snapshot rather than recomputing.
Derived state that feeds a decision has to be frozen when the decision is made.

## The world, and the year-over-year cycle — 2026-08-19

### 192 programs in 16 conferences

`src/data/schools.ts` now holds sixteen conferences of twelve across six regions,
tiered 1 to 3 with quality means of 55 / 49 / 44. Generated once from a fixed seed and
frozen — saves refer to schools by abbreviation, so regenerating the world would orphan
every save ever made.

**Non-conference play is the load-bearing part.** Sixteen conferences that only played
themselves would be sixteen sealed islands: identical aggregate records, nothing for RPI
to compare, and no honest basis for an at-large field. The season is now eight conference
series (24 games) plus nine non-conference midweek games. That costs a full round robin —
each team misses three conference rivals — and buys a national structure. It also means
rotation slot 3, the midweek arm, finally starts nine games a year.

### The full postseason

Sixteen conference tournaments produce sixteen automatic bids; 48 at-large places are
chosen on RPI. The 64-team field runs sixteen four-team regionals (double elimination),
eight best-of-three super regionals, then eight teams in Omaha across two brackets feeding
a best-of-three final. 3,168 regular season games plus the entire postseason runs in about
three seconds.

### The dynasty cycle

`src/engine/progression.ts`. Every June, across all 192 programs: seniors graduate, the
draft takes juniors in proportion to how good they are, everyone who stays advances a class
and develops toward their potential, and a freshman class fills every hole.

Measured over five seasons: **~1,250 players leave and ~1,250 arrive each year**, rosters
hold at exactly 23, every lineup fields a complete diamond, and **9,006 distinct players
appeared with zero repeated names**. A roster turns over completely in four years, which is
the roadmap's central promise made mechanical — you never keep your best players.

`potential` is now a real rating, and `nextSeason()` carries rosters forward while
resetting records, statistics and schedule.

**Name pools expanded** from 70 × 90 (6,300 combinations, exhausted in under two seasons)
to 356 × 738 — **262,728 combinations, about 238 years of turnover.** This was a
prerequisite, not polish: without it the generator starts handing out "Jake Whitfield 4417"
in year two.

### B10 — The calibration harness measured one roster pair, not the engine

The most important finding of this phase, and it was hiding in plain sight.

`runSeason` built two teams and played every game with them. That makes the league rates a
property of twenty-three particular players rather than of the simulation. Adding
`potential` — two extra random draws per player, changing nothing about how baseball is
played — moved runs per game from 6.62 to 7.35 and strikeouts from 8.07 to 6.81. A harness
that cannot tell *the engine changed* from *the dice changed* is not a harness.

*Fixed:* calibration now spreads across twelve independently generated team pairs.

**What that revealed:** the engine is further from target than it appeared. Walks run
**+13%** and strikeouts **−9%** when averaged over twelve rosters, against the +3% and −5%
the single pair reported. The engine did not get worse; the measurement stopped flattering
it. Those are B5 and B6, still open, and now honestly sized.

They are recorded in `KNOWN_OFF` in the calibration test rather than tolerated by a loosened
bar — the test still fails if either deviation grows.

## The calibration pass — 2026-08-19

### Sourced targets at last

A Division I play-by-play study by Robert Frey ("More About Counts in D1 Baseball",
Medium) gives, from a 0-0 count — which is every plate appearance — **.270 batting
average, .374 slugging, 16.4% strikeouts, 9.1% walks.** ABCA / D1 Baseball 2020 data
corroborates the pitch level: 57% first-pitch strikes, 66% of strikeouts starting 0-1,
74% of walks starting 1-0, matching `02-sim-engine-spec.md` almost exactly. The NCAA's
own trends report puts K/9 between 6.48 (2014) and 7.54 (2017).

**This reversed the standing conclusion on B5.** `LEAGUE_K_RATE` was not too low at 18%;
it was too *high* against a real 16.4%. And the harness's 8.5 strikeouts per team per game
implies 20.7% — it was MLB's number, and aiming at it was pulling the engine toward the
professional game.

Slugging had never had a target at all, and was 19% off.

### What changed

`LEAGUE` was **solved** rather than adjusted. A .270 average and .374 slugging, with 9.1%
walks and 1.5% hit by pitch, fix at-bats at 89.4% of plate appearances and total bases at
.3346 per plate appearance; only one hit mix satisfies both. `LEAGUE_K_RATE` went to the
sourced 0.164. `CONTEXT.normalizer` went to 1.100, finally closing B6 — the uniform +9%
that sat on batting average, on base, slugging, walks and home runs alike was one
multiplicative inflation, and it came out in one move.

| Metric | Before | After | Target |
|---|---|---|---|
| Runs per team per game | 7.01 | **5.21** | 5.30 |
| Batting average | .298 | **.269** | .270 |
| On base percentage | .388 | **.346** | .347 |
| Slugging | .447 | **.375** | .374 |
| Walks per team per game | 4.84 | **3.70** | 3.73 |
| Strikeouts per team per game | 7.72 | **7.07** | 6.72 |
| Home runs per team per game | 0.89 | **0.51** | 0.51 |

Everything inside 5%, against sourced numbers, for the first time. `KNOWN_OFF` is empty.

**The home run target moved from 0.90 to 0.51, and that deserves stating plainly.** A .270
average with .374 slugging is an isolated power of .104, which is roughly half a home run
per team per game — a BBCOR profile, and consistent with the 0.47 the NCAA recorded in
2011. The old 0.90 came from a different era than the .374 slugging figure and the two
cannot both hold. If the modern livelier college game is wanted, raise the slugging target
first and re-solve `LEAGUE`; adding home runs alone would break the agreement between
average and slugging.

### B12 — Games could end in a tie

Exposed immediately by the recalibration. `simGame` capped extra innings at 18 and returned
whatever the score was, so in a lower-scoring league some tied games simply ended tied.
Caught by a season test asserting no result is 4-4.

*Fixed* with the rule the spec already called for: from the tenth, each half starts with a
runner on second. Measured over 12,000 games — **zero ties, 8.5% reach extras, longest game
14 innings.** The inning guard moved to 30 and is now a runaway backstop rather than a rule.

Parity re-checked after all of it: at the 13 point gap the shipped conference actually
produces, the better team wins 73.6%, a shade under the 75–85 band and therefore on the
safe side of the roadmap's warning about the favourite winning too often.

### Not built: the national tournament

Regionals, super regionals and Omaha are deliberately absent. The real format is a 64 team
field — sixteen four-team double elimination regionals, eight best-of-three supers, then
eight teams in Omaha. **With a twelve team world the national bracket would be the same
clubs that just played the conference tournament**, which is not a postseason, it is a
rerun.

The machinery it needs already exists: `doubleElimination` handles a four-team regional,
`bestOf` handles a super regional, and Omaha is two four-team double eliminations feeding a
best-of-three final. It is a day's work once the world is big enough to deserve one, which
makes it a natural companion to expanding past one conference.

---

### Phase 2 — started 2026-08-19

The app runs. Vite 5, React, Zustand, design tokens taken from the mockup, a working
Today hub and Standings screen, and the full five-tab navigation with its sub-nav.
`npm run dev` serves it; `npm run build` produces 83 KB gzipped.

Verified in the browser rather than asserted: a **full 192-team season simulates in
771 ms**, the hub updates to 19-14 with a national RPI rank, and the conference table
renders with your program highlighted. All 119 engine tests still pass.

**Two facts that shape the rest of Phase 2:**

- **771 ms is a frozen main thread.** That is on a desktop; a mid-range phone will be
  several times worse. The roadmap's Web Worker is not optional polish — sim work has to
  move off the main thread before there is a sim button a player can press.
- **The engine mutates in place.** A season accumulates into the same objects and the
  offseason rewrites rosters on the players themselves. Correct for a simulation, wrong
  for React, which re-renders on reference change. The store bumps a `version` counter on
  every mutation rather than cloning a 192-team world per simulated day — cloning would
  cost more than the simulation it exists to display.

**Deviation from the roadmap:** React 19, not 18. It is what npm installs today and the
API surface used here is identical. Vite stays pinned to 5 as specified — the current
React plugin wants Vite 8, which would drag Vitest along with it, so the plugin is pinned
to v4 instead.

Two display bugs caught by looking at the thing rather than by a test: a midweek game
rendering as "SAT" (the schedule counts from an implicit Monday, so the calendar has to
anchor to one), and an RPI of #1 shown before a single game had been played.

### Persistence

`src/state/persistence.ts`. IndexedDB rather than localStorage: a save is about a
megabyte — 4,400 players across 192 programs plus a season of statistics — and
localStorage caps near five and stores strings, so every write would mean stringifying
the world.

Saves go in through **structured clone, which handles `Map` natively**. Season statistics
are keyed Maps, and hand-converting them to arrays and back is precisely the code that
silently drops a field two schema versions later. Verified by reading the stored record
back: `batting instanceof Map` is true, with 1,728 entries intact.

Two things had to change in the engine to make a save meaningful:

- **The RNG now exposes its state.** Storing the seed alone is not enough once thousands
  of draws have been consumed, and replaying a multi-year dynasty from the seed on every
  load would take seconds. `makeRng` attaches `state()`, `rngFromState` resumes. Verified:
  5,000 draws in, capture the state, and a resumed generator produces the identical next
  five numbers.
- **`scheduleRotation`.** The schedule is a pure function of config and world shape, which
  meant every season produced *the same fixtures* — Ridgemont opened against Kettering in
  perpetuity. Caught by playing a year in the browser and rolling over, not by a test. The
  season now carries a rotation that advances each year: five seasons, five different
  opening opponents.

The schedule is rebuilt on load rather than stored, from the config and the saved rotation.
It cannot then drift out of step with the teams it belongs to.

**Verified end to end in the browser:** sim a season, reload the page, and the dynasty
comes back at 19-14 with RPI #28 and the same streak. Roll the year over (8 ms for all 192
programs), reload, and 2028 is waiting at 0-0.

### The simulation worker

`simWorker.ts` and `simClient.ts`, over Comlink. The world crosses to a worker, gets
played, and comes back.

**Measured, not assumed.** Watching animation frames on the main thread while a full
192-team season simulates: **worst frame gap 19 ms, zero frames over 100 ms**, 200 frames
observed. Before the worker the same operation blocked for 771 ms — one frozen second with
no scroll, no tap response, and no spinner, because a spinner needs frames too.

Progress is reported per simulated day rather than per game: 3,168 messages would cost
more than the simulation, and a day is the unit a player actually thinks in. The Today
screen shows a bar and a day count.

The crossing costs a structured clone of about a megabyte each way. That is the trade —
tens of milliseconds of copying against a second of dead interface. If the world grows
enough that copying starts to hurt, the answer is to keep it in the worker permanently and
send the main thread only what the screens display; the codec boundary is already in the
right place for that.

There is a synchronous fallback when `Worker` is undefined. It freezes the screen, which
is worse, but a dead button would be worse still.

**`seasonCodec.ts` came out of this.** Saving and thread-crossing need the identical
"season to something clonable" transform, and two copies of it would drift the way two
engines drifted in B2. Persistence now uses the codec rather than its own version.

**One thing worth knowing about Vite workers:** the worker URL is `./simWorker.ts`, not
the `.js` used in every other import here. Those are module specifiers that TypeScript
rewrites; this is a runtime URL the bundler resolves literally against the filesystem, and
there is no `simWorker.js` on disk. The build fails outright if you get it wrong, which is
the good outcome.

### The app is a phone, wherever it is being looked at

Reported from use, not caught by a test: in a browser window smaller than full screen the
layout came apart.

Measured, the content was never actually lost — `main` scrolls, so everything was
reachable. The problem was the frame. The layout stretched to whatever the window was: a
412px design spread across 1100px, with a 34px navigation bar marooned at the bottom of a
wide grey field, and in a short window the content squeezed into a scrolling sliver
between fixed chrome.

*Fixed* the way the mockup already solved it — a phone-sized frame, capped at 430 × 940,
centred on a dark backdrop, lifted with a shadow only when there is actually a backdrop to
lift it off. On a handset the viewport is smaller than both caps, so the frame simply
fills the screen and none of this costs anything where it matters.

Verified across the range:

| Viewport | Frame | Result |
|---|---|---|
| 1280 × 800 | 430 × 800 | centred, 425px either side, nothing scrolls |
| 1100 × 340 | 430 × 340 | centred, nav sits on the frame's bottom edge, content scrolls inside |
| 320 × 480 | 320 × 480 | fills the screen, no horizontal overflow |

The standings table was the thing most likely to break at 320px — six columns of fixed
widths — and it holds without overflowing.

### Roster, Schedule, Stats

Three more screens, chosen because they are the ones that make the dynasty legible.

**Roster** is the important one. Class years and the gap between overall and potential are
what turn the offseason from a number in a report into something you can see coming:
seniors carry the accent colour because they leave in June whatever you do, and a freshman
at 54 with a ceiling of 71 is visibly worth waiting on.

**Schedule** groups the weekend series the way a season is actually experienced, with
results as they land. **Stats** shows national leaderboards across all 192 programs, with a
filter down to your own roster — the team view needs a much looser qualifier, since nine
regulars cannot fill a top five against a national minimum.

### B13 — A schema migration I failed to write

Reported from use again: every conference series on the schedule was against the same
opponent, and every non-conference opponent was blank.

The engine was fine — checked directly, it produced LUD, BRK, MBT and real midweek
opponents. The fault was in what the browser had loaded. The autosave predated
`scheduleRotation`, so on load the field was `undefined`; `nextSeason` computes
`prev.scheduleRotation + 1`, `undefined + 1` is **NaN**, and `roundPairs(NaN, 12)` returns
`[0, 11]` every single round because `rest.slice(NaN)` is `rest.slice(0)`. Non-conference
indices became `undefined` for the same reason.

Nothing threw. It just quietly stopped being a schedule — which is the worst way for this
kind of bug to behave, and exactly why the roadmap says to write migrations before there
are users.

*Fixed* three ways, deliberately overlapping:

- `SCHEMA_VERSION` to 2, with `migrateFile` coercing a missing rotation to 0 **on read**
  rather than on database upgrade, so a save written by an older build loads even in a
  browser that never ran the upgrade path.
- `nextSeason` coerces rather than trusts, so no future path can reintroduce NaN.
- The "save from a newer version" check now runs *before* migration. It was after, and
  since `migrateFile` stamps the current version onto the record, the check could never
  have fired.

### Lineup and Awards

**Lineup** is the first screen where you are coaching rather than reading. Both halves are
real: the engine reads `team.lineup` for the batting order and `team.rotation` for who
takes the ball, so a change here changes what happens on the field. Verified by swapping
the one and five spots, reloading the page, and finding the swap still there — the full
loop of interact, mutate, autosave, restore.

**Awards** shows the season honours and the All-Conference first team.

### S8 closed — the pitcher of record

Awards surfaced it immediately, which is the argument for building screens: **Pitcher of
the Year went to a man who was 0-0 with 85 innings pitched.** Two of the three
All-Conference arms were also 0-0.

The cause was the naive rule flagged back in Phase 1 — every decision went to the starter,
so a reliever could throw ninety innings and never once appear in a win column. It looked
survivable in a CLI table. It looks absurd on an awards card.

*Fixed* with the actual rule. `simGame` now tracks the lead as it changes hands and records
who was pitching for each side at the moment the winning team went ahead for good; the win
belongs to that pitcher and the loss to whoever surrendered it. A save now also requires
that the finisher is not the winning pitcher, which is the real condition.

Verified across a full season: **3,168 wins equal 3,168 losses equal 3,168 games**, no
pitcher with forty or more innings has zero decisions, and 308 relievers earned one. The
awards card now reads 4-2, 2.46 ERA.

One thing this exposed and did not fix: **the bullpen does not rotate.** `penIndex` resets
every game, so `bullpen[0]` enters first in all 33 of them and ends up around ninety
innings. Real relief corps share the load and rest. That is a genuine engine gap, now
visible because the decisions are attributed correctly enough to notice it.

### Watching a game

The roadmap calls text play by play the emotional core, and until now you could sim a
whole season without seeing a single pitch.

**A game is simulated whole, then replayed.** Making the engine pause for a human would
mean rewriting the game loop as a generator and threading that through the season, the
worker and every bracket. Simulating to completion and replaying is what text sims of this
kind actually do, and it costs about a millisecond. Nothing is invented on the way out:
every frame comes from the log and the `PlayEvent` stream the engine already emitted.

`ui/replay.ts` aligns the two streams. The log is human readable and carries the inning and
the running score; the events carry outs and baserunners but no text. They are matched on
plate appearances, which are identifiable in the log because the engine prefixes those
lines with the count — `[2-1 4p]`. Steals, pitching changes and walk-off notes are not
plate appearances and consume no event group, which is why they are detected separately
rather than assumed away.

`Live.tsx` shows the scoreboard, a CSS diamond, and the play log at four speeds. Deliberately
the 2D diamond, not the 3D scene: the roadmap builds 2D first and treats Three.js as an
enhancement layer, so if that turns into a swamp this is still the game.

`tests/replay.test.ts` guards the alignment — frame count matches the log, the last frame
carries the real final score, no fourth out, the score never runs backwards, and the bases
clear every half inning. That assumption about plate appearances lining up is exactly the
kind that holds until it silently does not.

### Three more bugs found by looking

1. **`--night` was never a token.** The scoreboard asked for a colour that did not exist, so
   cream text rendered on a transparent background — invisible. The real token is `--navy`.
   Fixed by using it rather than defining a second name for the same colour.
2. **The replay had module level mutable state.** The first draft tracked base occupancy in
   a map outside the function, so two games replayed in one session would corrupt each
   other. This is the third appearance of that exact bug (B8, then the schedule, now this).
   Caught while re-reading rather than by a test, which is luck, not process.
3. **The Live screen grew its pane instead of filling it**, pushing the transport controls
   off the bottom of the screen where they could not be reached. An explicit `height: 100%`
   fixes it. Verified at 520px tall, since a short window is exactly where this breaks.

### The postseason was unreachable

Found by wiring up History: `rollYear` went straight from the last regular season game to
the offseason. **The sixteen conference tournaments and the entire 64 team national
bracket — all of it built and tested in Phase 1 — were never run by the app.** A dynasty
could go a decade without a postseason existing.

`runPostseason` now packages the whole thing and reduces it to what a dynasty needs to
remember: who won each league, who made the field, and how far each of them got. It sits on
the Today screen as an explicit step between the last game and the roll over, so the year
ends with a result rather than a shrug.

### History

Every completed season is written into the record books before the offseason overwrites
the rosters that produced it — year, record, conference finish, RPI, whether the conference
tournament was won, how far the national run went, and who took the title.

The save format grew to carry it, and `SCHEMA_VERSION` went to 3. Both new fields are
optional so saves written before the record books existed still load; they simply come back
with an empty history rather than failing.

Verified end to end: sim a season, play the postseason, roll the year, and the season
appears in History — then reload the page and it is still there.

### Player detail

Roster and Lineup listed players you could not tap. Now you can.

Ratings are drawn as bars against the full 0 to 99 scale rather than printed as numbers.
What matters about a player is his *shape* — where he is strong and where the hole is — and
a row of two digit numbers hides that. Anything at 60 or above takes the accent; the rest
stays muted, so a weakness is visible without reading a single figure. The gap between
overall and potential is stated in words rather than implied, and hedged, because a ceiling
is a projection and the offseason does not honour projections.

### Ten screens done, two deliberately not

Built: Today, Standings, Roster, Schedule, Stats, Lineup, Awards, Live, History, Player.

**Wire** and **Strategy** are still nav entries with nothing behind them, and Strategy is
the one worth being explicit about. The mockup gives it five policy groups — base running,
steals, bunts, the pitching hook, defensive alignment. **The engine has no per-team tactics
at all.** Those constants live in `BASERUNNING` and `maybeChangePitcher` as globals that
apply identically to all 192 programs.

Building the screen now would produce five controls that visibly do nothing, which is worse
than an honest gap. Making them real means threading a per-team strategy record through
`simGame` — a genuine engine change, and the natural companion to the AI decision layer in
G3 rather than something to fake ahead of it.

### Quick manage

The whole game, one plate appearance at a time — the Out of the Park style text manage
mode MLB The Show offers, not a scripted-moments mode. You call every trip to the plate on
both sides of the ball across nine innings.

**The engine's game loop is now resumable.** `createHalfInning` returns a stepper: the fast
simulation drives it in a tight loop, the interactive manager drives it one call per
decision. Crucially there is still exactly **one implementation of what a plate appearance
does** — the body was moved, not copied, so a managed game and a simulated one cannot
diverge. The inning-ending rules moved into a shared `RULES` object for the same reason.

Verified after every step of the refactor: the calibration goldens are unchanged.

**Nine calls.** On offence: swing away, hit and run, sacrifice, play for contact, steal. In
the field: pitch, pitch for ground, pitch around, walk him. Plus pinch hitting and the
bullpen. Options are filtered by situation — no sacrifice with two outs, no intentional
walk with first occupied — so the buttons never offer something that makes no sense.

Most calls **tilt the outcome distribution rather than forcing a result**, which is the
honest way to model a manager: asking for a ground ball raises the chance of one and
doubles the double play risk, it does not summon one. Three are different in kind and are
resolved directly rather than as modifiers — the intentional walk, the sacrifice bunt
(which can be beaten out, or botched into a force at the lead base), and the steal, which
happens before the pitch and does not consume the batter.

**The day does not advance until the game ends.** The other 95 games are simulated at the
moment your result is recorded, not before it, so reloading mid-game loses the game rather
than orphaning it inside a half-played day. Your game is then written down through
`recordResult` — the same path a simulated game takes, so a hand-managed win counts
identically.

### Bugs fixed alongside it

**Leaderboard qualifier.** It scaled as `games × 2`, so six games in it admitted anyone
with **12 plate appearances** and put a 10-for-17 hitter on top at .588. Over a full season
the engine was already healthy — leader .438, four of 1,728 hitters over .400, none over
.600 — so this was purely a qualifier problem. Floors of 40 PA and 15 IP added.

**My Team leaderboards were empty.** `leaders()` cut to the national top five and *then*
filtered to your roster, so unless a Ridgemont player ranked nationally you saw nothing.
The pool is now filtered before ranking.

**Five of six relievers never pitched.** `penIndex` reset every game, so `bullpen[0]`
entered first in all 33 and everyone behind him sat. The season now records the day each
arm last threw and hands relief work longest-rested first. League-wide idle relievers went
from **83% to 0 of 1,152**.

### Investigated and deliberately not changed

The ERA leader reads 0.35. I suspected lost runs and audited it: **all four independent
accumulators agree at 31,420** — runs scored in games, runs charged to pitchers, team runs
scored, team runs allowed, and runs credited to batters. League ERA 4.79, median qualified
4.39, earned share 93.8% against a real ~92%.

It is genuine tail noise. With 767 qualified pitchers at ~50 innings each, the minimum sits
far out; real D1 leaders sit near 1.30 because they throw 90+ innings. **That is a
consequence of the 33 game season, not of the engine** — season length is the lever, not
tuning.

**Still to do in Phase 2:** Android back button and safe area insets, and the first
Capacitor build.

### The bench plays now

Measured before: **all four reserves on every team finished a season with 0 at-bats in 0
games.** The bullpen fix had already spread relief work properly, but position players never
moved.

Two mechanisms, because they are different things and real baseball treats them differently:

**Rest starts**, in `season.ts`. A regular sits on 55% of days, two on some. This is where a
reserve's numbers actually come from — a backup catcher starting eight games, not a
handful of pinch hit appearances. The replacement takes the spot of whoever plays his
position, so the lineup stays coherent. It uses a per-game lineup passed into `simGame`
rather than mutating the roster.

**Pinch hitting**, in `game.ts`. Seventh inning or later, two per game at the outside, and
gone for good once used — the NCAA re-entry rule we settled earlier.

Result: **every one of the 768 reserves in the world now has at-bats**, averaging 23.4 each,
which is **7.9% of team at-bats**. Pinch hitters run 0.45 per team per game and appear in
59% of games. Pitching changes stay at 1.28 per team per game — near universal, as they
should be. That asymmetry was the explicit requirement and it now holds.

**Three attempts to get the rate right**, all worth recording:

1. The first trigger asked a bench bat to be outright better than the man due up. Reserves
   are generated *below* the regulars they back up, so it fired **zero times in 500 games** —
   and the give-away was that calibration did not move at all, because no random draws were
   ever consumed.
2. Fixing the comparison to a matchup improvement produced **1.30 per game in 97% of games**.
   The check runs for every batter from the seventh on, so a 20% chance compounds across ten
   looks. Not baseball.
3. Cutting the per-appearance chance to 5% lands at 0.45 and 59%.

There was also a plain bug in between: the function existed and was never called. My edit to
add the call site had not matched, because the half-inning loop changed when tactics were
added. It typechecked clean and did nothing — a reminder that "compiles" and "runs" are
different claims.

The manager opts out. A human running the game makes these calls himself, and an engine
quietly burning his bench underneath him would be worse than useless.

*Calibration re-checked and goldens re-recorded.* Everything still lands inside 4% of the
sourced D1 targets; home runs improved from +4% to +1%. This is the case the two suites are
built to separate — determinism failed, calibration passed, so behaviour changed on purpose.

### Any player's card, not just yours

Leaderboard rows are now tappable and open the same card, for any of the 4,416 players in
the world. Potential is withheld for players you do not employ: it is the one number a rival
coach genuinely cannot know, and the card says so rather than showing a blank and leaving
you to wonder whether it is missing or hidden.

### The dynasty layer

`engine/program.ts`. Until now a season had no stakes outside the standings — you were
Ridgemont State permanently and nothing followed from a bad year.

**Three quantities, tracked apart on purpose:**

| | What it is | How fast it moves |
|---|---|---|
| Program prestige | What the school is, built over years | Slow. 18% drift toward the season just played |
| Coach prestige | What *you* are. Follows you between jobs | Moves on overachievement relative to the job |
| Job security | How the board feels right now | Fast. The only one that gets you fired |

Conflating them is what makes career modes feel arbitrary. Keeping them separate makes the
interesting case work: a good coach at a poor program overachieves, gains personal standing,
and gets called by somebody better, while the program stays roughly what it was.

**The board scales its demand to what the school believes it is.** A prestige 80 program
treats missing the tournament as a failed year; a prestige 30 program would take a winning
record gratefully. Winning the conference satisfies any board regardless of record — which
is right, and stops the target being a pure win count.

**First year grace.** A negative verdict counts half in year one. Boards do not fire the
coach they hired last spring except for something genuinely disastrous, and without this a
rebuild is unplayable.

Verified end to end: taking the worst job in the CVC, a 10-23 season returned *"A bad year —
the board is not happy. Your seat is warm."* with program prestige 44↓42, personal standing
25↓23, and security 62↓48 (the halved first-year penalty). A modelled coach who keeps losing
at a prestige 57 job is fired in year four; one who wins 23 games a year at a prestige 38 job
lifts himself 25→51 and the program 38→59 across four seasons.

**Team selection.** A new dynasty now opens on a job board rather than assigning you a team:
16 conferences, 192 programs, each showing its star rating and — before you commit — exactly
what that board will expect of you. That last part matters. Choosing a program is a real
trade, not a difficulty slider: a five star job hands you a roster that can win now and a
board that will fire you for finishing third.

**Saves.** The coach is persisted as an optional field, so saves made before this layer
existed still load rather than being rejected; they simply start a fresh career.

### Strategy became real

`engine/strategy.ts`. Five policies, every one wired into the simulation, and the design
rule underneath all of them: **an aggressive setting has to hurt somewhere.** A screen where
one column is strictly better is a stat boost with extra steps — the player works it out in
ten minutes and never touches it again.

| Setting | What it gives | What it costs |
|---|---|---|
| Base running | More bases taken | Roughly twice as many runners retired |
| Steals | 0.98 → 2.13 SB per game | 0.41 → 0.85 caught |
| Bunt | Moves runners late | Runs. Bunting is negative expected value and the engine says so |
| Hook | Fresher arms — 4.85 → 4.72 runs allowed | Bullpen worked 2.23 → 3.04 changes a game |
| Alignment | See below | See below |

**Baserunning had no risk at all.** A runner either took the extra base or did not; he could
never be thrown out. Aggression was free upside, so the setting would have been meaningless.
Added, capped at one runner retired per batted ball — the throw can only go to one place.

**The shift is the interesting one.** Measured first as a blanket policy, it did nothing:
2,500 games moved runs allowed 4.72 → 4.71, because the sluggers it suppresses and the
runners it hands singles to cancel out. That is not a modelling failure, it is the reason
real clubs shift against particular hitters rather than standing in one alignment all night.
Rebuilt around that:

| | vs a pull heavy lineup | vs a lineup that runs |
|---|---|---|
| Straight up | 4.92 | 4.70 |
| Situational | **4.02** | 4.70 |
| Full shift | **4.02** | **5.85** |

Situational picks its spots and stands down otherwise. The full shift wins as big and loses
bigger — a bet on the opponent rather than an upgrade.

**Every one of the 192 programs carries a philosophy**, derived from its index so it is
stable across a save and varied across the league. The spec asks for exactly this: an
aggressive coach steals and pulls starters early, a conservative one bunts and plays for a
run, and that variety is what stops 192 programs feeling like one program repeated.

### Four bugs found while tuning it

All four were caught by measurement rather than by reading, which is the argument for
checking numbers rather than trusting a diff:

1. **Flattened clamps.** Refactoring the advance helper collapsed three different bounds
   into one shared pair. The floor for scoring from second fell from 0.20 to 0.05, so slow
   runners stopped scoring on singles.
2. **Wrong hold destination.** The same helper returned a flat `1` on failure, which sent a
   runner who failed to score from first on a double back to *second* instead of leaving him
   on third. Worth four percent of league scoring.
3. **Punishing caution.** The exposure check also caught the runner who wisely held at
   third — the opposite of what a risk setting should do.
4. **Bunts emitted no events.** A bunt resolves without going through the pitch engine, so
   it produced a play log line and no `PlayEvent` group. Once the computer started bunting
   that put the replay permanently one group out of step and produced a phantom fourth out
   in an inning. Caught by `replay.test.ts`, not by anything in the engine.

### `npm run goldens`

Re-baselining is a normal part of changing the engine deliberately, and this session did it
by hand three times with one-off scripts — transcribing sixteen digit floats, and twice
getting the path wrong. It is a command now. It prints the measurement against the sourced
targets first and **refuses to record anything more than 10% off**, so a bad baseline cannot
be quietly enshrined.

### Expectations read the roster, not just the banner

Reported as: choosing a team feels flat, and the board's demand should reflect the
*current squad* as well as the school's history. Both correct, and the second is the
substantive one.

`expectationFor` now takes prestige **and** roster strength, weighted 45/55 toward the
roster — the board ultimately watches the games. That produces four honest situations
rather than one sliding scale:

| | thin roster | good roster |
|---|---|---|
| **low prestige** | DEVELOP — bring players on, wins come later | COMPETE — a rare chance, do not waste it |
| **high prestige** | REBUILD — stay respectable while you reload | WIN IT ALL — Omaha or a failed year |

A proud school with a gutted roster is genuinely asking for something different from the
same school at full strength, and the old model could not say so.

**The win target was also far too flat** — the entire world was asked for 15 to 19 wins, so
a cellar job and a national contender sat four games apart and the mandate did all the work.
Real programs at these strengths finish anywhere from .300 to .650. Slope widened; the
spread is now 15 to 21.

### Contracts

There was no stated term at all, which made a rebuild a strange thing to attempt — every
bad season was potentially the last. A board now commits for a fixed number of years, and
**weaker programs offer more of them**, because they are asking for a rebuild and know it:

| Prestige | Contract |
|---|---|
| 5★ / 4★ | 3 years |
| 3★ | 4 years |
| 2★ / 1★ | 5 years |

Exceeding the mandate on a short deal gets it torn up and extended. Running the term out
without convincing anyone is **not renewed** — which is deliberately a different outcome
from being sacked, and reads differently in the review.

### The job board

Every program now shows its mandate next to its stars, so the list distinguishes two
three-star jobs that are nothing alike. Selecting one opens a full offer: reputation,
current roster rating, contract length, the board's demand in their own words, and what that
class of job is actually like. The point is that choosing a program is a real trade, and the
screen should let you make it with open eyes rather than inferring everything from a star
count.

### The offer is a sheet, not a footer

Reported as: easy to get lost. Correct — the offer rendered *below* a list of twelve
programs, so taking a job meant scrolling past the list to find it, then scrolling back up
to try another. With sixteen conferences that is a lot of hunting for something that should
be immediate.

It is a bottom sheet now, the same pattern the pinch hit and bullpen pickers already use.
Tap a program anywhere in the list and the offer covers the screen; dismiss it and **the
list is exactly where you left it** — verified, scroll position preserved.

The frame needed `position: relative` for that: sheets position against the phone frame
rather than the browser window, or on a desktop the overlay would dim the whole page around
the app.

### Old saves survive

Teams stored before this layer have no strategy and no prestige, which crashed the app on
load. `fromPortable` now backfills both with what a fresh world would have produced. A save
file must never load into a crash.

### The manage screen stopped moving

Reported from the phone: the screen reshaped on almost every pitch. The cause was the call
panel — the legal calls change constantly as outs and baserunners change, so the grid went
from one row to three and everything above it jumped.

Fixed by showing **every call, always**, greying the unavailable ones and putting the reason
where the description goes: "two outs already", "nobody on first", "first base is taken".
The panel is now a fixed three by two grid at a fixed height, and the play log never
resizes underneath it. Measured across 45 consecutive decisions spanning both sides of the
ball: log 347px and panel 236px, unchanged every time.

This is better than hiding them for a second reason. A sacrifice that silently vanishes
teaches nothing; "two outs already" teaches the rule.

**INFIELD IN added** — partly because defence had four calls against offence's five and
left a hole in the grid, but mostly because it is the call that was missing. It is a real
trade: the infield plays shallow to cut the run down at the plate, and every ground ball
has more room to get through. Measured at +16% hits allowed in exchange for dropping the
chance a routine grounder scores the runner from third from 45% to 12%.

Every call was then measured against a no-call baseline to confirm it does what its own
description claims:

| Call | walks | home runs | ground balls | hits |
|---|---|---|---|---|
| Hit and run | −19% | −8% | 0% | +5% |
| Play for contact | −14% | −12% | +1% | +3% |
| Pitch for ground | +9% | −20% | **+22%** | 0% |
| Pitch around | **+98%** | −44% | −9% | −17% |
| Infield in | −4% | — | +2% | **+16%** |

### Velocity was decorative, and in the wrong place

Two problems, one cause. The pitcher card showed velocity where the hitter card shows class
year, so a pitcher's eligibility — the thing that decides whether he is on the roster next
season — was missing. And **velocity drives nothing**: no outcome anywhere reads it. It was
drawn independently of stuff, which produced 79 mph arms with elite stuff.

Class year is now shown for both. Velocity moved into the scouting block as a labelled
readout, and is now derived from the pitcher's actual stuff rather than rolled on its own,
so the card agrees with itself. It still drives nothing — `02-sim-engine-spec.md` wants it
feeding stuff, which is a real change for later — but it is now an honest expression of the
arm instead of a contradiction of it.

The draw happens in the same position it always did and consumes the same two random
numbers, so the calibration figures did not move.

### The field, in two dimensions first

The roadmap builds 2D before 3D and treats Three.js as an enhancement layer. This is the
argument for that order: almost all of the life comes from **movement**, not geometry. A
runner who slides from first to third reads as baseball; two lamps blinking off and on does
not, however well they are rendered.

`ui/Diamond.tsx` draws the base paths, lights an occupied bag, flashes the plate when a run
crosses, and carries the outs. The runners are the point: each is keyed by player id, so
when a man advances React reuses his node and a CSS transform transition carries him
between bags. That single detail is most of the difference between a live field and a
static one, and it costs a line of CSS rather than a rendering pipeline.

The prerequisite was that **the manager emitted no events at all** — `createHalfInning` was
handed `null` for its event stream, so nothing downstream could know a runner had moved. It
now emits, and the decision carries a runner list with identity alongside the booleans: the
booleans say a base is occupied, the list says *which man* is on it.

Whether this needs Three.js on top is now a judgement that can be made by looking at it
rather than in the abstract — which is what building the cheap version first buys.

### The calls moved to a column

Pinning the call panel to a fixed height stopped the screen jumping, but it took that
height straight out of the play log — which is the thing you are actually reading. Five
lines of play by play under a large panel of buttons is the wrong trade.

The calls now run **down the right hand side** instead of across the bottom. The log takes
the rest, and because the column has a fixed set of entries it still never reshapes.
Measured: log height went from 347px to **543px**, a 56% gain, constant across twenty
consecutive decisions. Thirty lines of play by play visible instead of five.

Pinch hit, bullpen and sim-the-rest are pushed to the bottom of the same column, so the
destructive-ish actions are away from the calls you make every pitch.

### Tested on a real iPhone

Two problems the desktop pane never showed, both reported from the device:

**The calls column overflowed.** At 390px the last button sat below the fold, and scrolling
to reach it pushed the scoreboard off the top — so you could see the call or the score, never
both. Fixed by starting the column directly under the scoreboard and running it the full
height, rather than only beside the log, and trimming the situation panel from 116px to
96px. Measured at 390×664: all five calls, both secondary buttons and the scoreboard are on
screen at once, and the page does not scroll at all.

**The buttons read as disabled.** They were paper on a paper panel with a hairline border,
which is indistinguishable from static text. The panel now drops to the recessed page tone
so the buttons sit *on* it — paper fill, a border at 42% ink, a 1px bottom shadow.
Unavailable calls recede instead of merely dimming: dashed border, no fill, no shadow.

Tap targets measure 41px tall, marginally under Apple's 44pt guidance. Flagged rather than
silently adjusted, because whether it actually feels fiddly is a thumb question.

### Where the outs belong

Three attempts, which is worth recording because the first two each looked reasonable:

1. **Inside the diamond box, at the bottom.** They landed exactly on home plate — same few
   pixels — and read as a pile of dots.
2. **In a row beneath the field.** Now clear of the plate, but floating outside the panel
   with nothing to anchor them to.
3. **On the scoreboard, beside the inning.** Which is where a real scoreboard puts them.

The diamond draws the field and the runners; the scoreboard counts the outs. Trying to make
one component do both was the mistake underneath both earlier attempts.

### The outs were drawn on top of home plate

Reported from the phone as "three dots covered by home base". Exactly that: the outs row
was absolutely positioned at the bottom edge of the diamond box, and home plate sits at the
bottom of the diamond, so they occupied the same few pixels.

Outs now live in their own row beneath the field, and the plate was lifted slightly off the
container edge so the diamond reads as a diamond rather than something clipped by its own
box.

### Two hours lost to a stale bundle

Worth writing down. After `Live.tsx` was deleted, Vite's HMR kept failing to reload it and
the page silently continued running an **old bundle**. Every measurement taken against the
browser during that window was measuring code that no longer existed — the runner dots were
absent because the page had never loaded the component that draws them.

The console said so plainly: `[hmr] Failed to reload /src/ui/screens/Live.tsx`. It went
unread for several rounds of investigation while the same wrong result was re-measured.
**Check the console before disbelieving your own code.** A dev server restart fixed it in
one step.

A second self-inflicted one: measuring the DOM immediately after a programmatic `.click()`
reads the page *before* React has re-rendered, so before-and-after samples are identical and
nothing ever looks like it moved. Separate tool calls flush; a loop inside one does not.

### Every rating says what it does

"Stuff 72" is not information. Each rating now carries a line describing what the engine
actually does with it — *"misses bats, this is the strikeout rating"*, *"suppresses hits and
home runs"*, *"keeps it on the ground, sets up double plays"* — taken from what the code
genuinely consumes, not invented for flavour.

### Phase 2 and beyond

Per `01-roadmap.md` v3, unchanged: app shell, roster management, recruiting, the 3D field,
the dynasty layer, ship. Two notes carried from the salvage audit:

- **`design/Dynasty Mobile.dc.html` is the design.** All 12 screens port over with their
  palette, type scale, and interactions intact. Only the runtime changes: `x-dc` templates
  become React components, `{{ }}` bindings become props and store selectors.
- The prototype's season and UI logic should be ported from that file, not rewritten from
  scratch. See `03-engine-salvage-audit.md` for what is worth taking.
- `01-roadmap.md`'s Design direction section is stale and marked as such. Do not build
  from it.

---

## Decisions made

Settled August 19, 2026. Also recorded in `01-roadmap.md`'s locked-decisions table.

| Decision | Choice |
|---|---|
| Node | Install. Done in Phase 0.4 |
| Individual fielders | **In v1.** Range and error ratings per player, spray direction, a real catcher. Lands in `types.ts` |
| Pitch arsenals | Deferred past v1 |
| Two way players | Deferred past v1 |
| World size | 12 teams, one conference. Schedule generator takes team count as a parameter so the world can grow |
| Season length | 32 games |
| Defensive shifts | Coach decision, per the mockup's Strategy screen: Straight / Situational / Full shift |
| Phase order | TypeScript conversion **before** engine deepening |
| Version control | Local only for now. No commits, no pushes |
| Re-entry rule | **Once a player is substituted out, he cannot return.** Applies to hitters and pitchers alike |
| The prototype | Convert it to the new stack. The layout and interaction model carry over **exactly** — it is the app's design, not a suggestion |

The fielder decision is the load-bearing one. `Ratings` gains `range` and `errorRate`
on the Strat-O-Matic scale where lower is better, every position player gets a real
defensive assignment, and the catcher finally exists — which lets steals check catcher
arm the way the spec asks and the prototype already does.

## Still open

| # | Question | Blocks | Note |
|---|---|---|---|
| 1 | NIL and revenue sharing | Phase 6 | From `01-roadmap.md` |
| 2 | Park effects | Phase 5 | From `01-roadmap.md` |
| 3 | iOS, or Android only | Phase 7 | From `01-roadmap.md` |

### The design is the mockup

`design/Dynasty Mobile.dc.html` is the source of truth for the app's design — palette,
typography, layout, and interaction alike. Port it as-is.

`01-roadmap.md`'s **Design direction** section is stale. It was not updated for v3, and
its scorekeeper's-page palette (`--paper #F2F0EB`, ballpoint blue actions, red reserved
for runs) was never adopted. It is marked accordingly in that document and should not be
built from. The live palette is the mockup's:

| Token | Value | Use |
|---|---|---|
| Field | `#f2ece0` | Screen background |
| Paper | `#fbf7ee` | Cards, panels, table surfaces |
| Ink | `#1c2430` | Primary text, headers, nav bar |
| Clay | `#a8442a` | Accent — active states, occupied bases, section rules, losses |
| Win | `#3f6b46` | Positive results |
| Dim | `rgba(28,36,48,.55)` | Secondary text |

Type: Big Shoulders Display 500–800 for display and numerals, IBM Plex Mono 400–600 for
labels and tabular data, Source Sans 3 for body.

One idea worth keeping from the stale section: the **live scorebook cell** that fills in
beside the field as an at bat resolves. The mockup does not have it. Treat it as a
candidate addition, not a redesign.

### The design canvas is alive

`design/` is not frozen. It may be hand-edited and converted to the new stack. If the
canvas changes in Claude Design, new exports get dropped into `design/` and the port
follows them.

---

## Phase 2.7 — a world you can recognise

Reported as: *"we should shrink the team pools and divide them by regions so people
recognize them"* and *"no contending team should be looking for a new inexperienced
coach."*

### 192 programs was a phone book

The old world was sixteen conferences of twelve. Nobody could name a single program in
it, and that was arithmetic rather than a failure of the names. A 33 game season against
a twelve team league meant **eight series out of eleven possible opponents** — three
teams in your own conference went unplayed every year. You could not build a history
with a league you only partly met, and the other 180 schools were rows you scrolled past.

**Eight conferences of eight** fixes both ends:

```
7 conference opponents x 3 game series = 21
+ 12 non-conference midweek games      = 33
```

A full round robin. Verified against the built schedule: every team plays exactly 7
conference opponents, 3 games each, and **12 distinct** non-conference opponents — no
repeats. 1056 games, home dates 16 to 18 per team.

### Region is the conference

The old data had sixteen conference names sitting inside six regions, so you had to
memorise two layers — that the Highland League is in the West. The layers are collapsed:
the conference *is* the region. Gulf, Atlantic, Pacific, Heartland, Desert, Great Lakes,
Mountain, Northeast.

Power follows climate, the way it does in the real sport, where the best programs sit in
the warm south and west and practise outdoors in January. The Gulf, Atlantic and Pacific
are the power leagues; the Great Lakes, Mountains and Northeast are not. That gives the
map a meaning readable at a glance and gives a career a direction: **climbing usually
means moving south.**

Also added per school, all for recognition rather than mechanics: a primary colour shown
as a stripe on every row, and a named in-conference **rival** played three times a year,
every year. Rivalries are symmetric and validated.

### Two numbers, not one

Prestige used to be derived from roster quality, which meant every program was exactly as
good as its reputation. That quietly made the interesting job impossible — no sleeping
giants, no overachievers, nothing to discover — while the job screen advertised exactly
that gap. The screen was describing something the data could not produce.

They are separate now. `prestige` is what the school **is**; `quality` is what this
year's roster can **do**. Every conference carries the same cast in different costumes:
blueblood, sleeping giant, contender, upstart, fading power, doormat. In a sample season
Verdugo (44 prestige, 59 roster) finished third in the Pacific while Bracken State (69
prestige, 53 roster) finished fifth — the reputations inverted, as intended.

### The ladder

A contender does not hand its program to someone who has never run one. Jobs now require
coach prestige by star tier:

| Program | Needs |
|---|---|
| 1★ | anyone |
| 2★ | 20 |
| 3★ | 38 |
| 4★ | 52 |
| 5★ | 68 |

A career starts at 25, which opens **36 of 64 jobs**. The three bluebloods need 68.

The one exception is the interesting one: **a proud program with a gutted roster
discounts itself**, because nobody established wants to inherit a rebuild where the
fanbase still expects June. Exactly two 3★ jobs are reachable on day one (Silverton,
Newport Bay), and both are traps — the hiring bar comes down, the expectations do not.

Locked jobs stay **visible** with their requirement shown. A ladder you cannot see is not
a ladder, it is a short list that quietly gets longer.

The mid-career carousel was rewired onto the same `canBeHired` function, so the opening
board and the offers that arrive later can never disagree about who would hire you.

### Two defects this surfaced

**The mandate contradicted the label.** Newport Bay rendered as a SLEEPING GIANT beside a
board mandate reading "nobody expects wins yet" — the two halves of one job disagreeing
on screen. Cause: `weak` was an absolute cutoff (`roster < 46`), so a 71 prestige school
with a 51 roster read as merely average. It is relative now — `roster < prestige - 10` —
and `proud` came down from 58 to 50. Swept all 64: zero contradictions remain.

**The archetype label misfired at the top.** A flat 12 point gap tagged Bayou State
(78/66) a SLEEPING GIANT when its roster was the second best in the Gulf. A high prestige
school sits far enough up the scale that a good roster still trails its name. Gated on
`prestige >= 50` alongside the gap.

### Postseason rescaled

A 64 team national field out of 64 programs would be everyone. The real tournament takes
64 of roughly 300 Division I schools — about a fifth — so the honest analogue here is a
**16 team field**: 8 automatic bids and 8 at-large, four four-team double elimination
regionals, and the four winners to Omaha for one more double elimination.

The super regional is the round that goes, because its job — halving the field — is
already done by the regionals at this size. Conference tournaments went from 8 of 12 to
6 of 8, the same proportion.

### Verified

- 141 tests pass; typecheck clean.
- Calibration unmoved by the new talent spread: BA .267 (target .270), SLG .373 (.374),
  HR +2%, K +3%, BB -5%. Runs still 5% under, the pre-existing derived-target gap.
- Full cycle in the browser: signed at Newport Bay, 19-14, board review **expectations
  met**, standing 25 → 26, security 62 → 71, roster rebuilt 38 → 42, rolled to 2028.

### Old saves are discarded, not migrated

A save records team *indices* into a 192 program world. Those indices now point at
different schools, 128 of which no longer exist. There is no honest migration, because
the schools the dynasty was about are gone.

So `SCHEMA_VERSION` went to 4 and the upgrade drops the object store. The failure this
prevents is the quiet one: without it a stale save loads successfully and puts you at a
program that is silently somebody else, which during testing reads as an engine bug
rather than a stale save. Refusing to load is the truthful outcome.

Both paths exercised in the browser against a planted record:

- **3 → 4** — old save dropped, no error raised.
- **0 → 4** — fresh browser still gets a created, writable store.


## The board asks for a list

The mandate was one sentence. A sentence is atmosphere — you read it, nod, and have no
way of knowing in August whether you did the job. It is now a checklist of required and
bonus objectives, shown on the offer before you sign and on the program screen all season
with live ticks.

`judge` reads that same list and nothing else. It used to judge on win margin while the
screen displayed a mandate, which meant the board could demand a conference title and then
fire you over a win total you were never shown.

### Calibrating it took four passes, and every wrong version looked fine in the code

| pass | league-wide negative reviews | what was wrong |
|---|---|---|
| placement by mandate | 62% | zero-sum objectives assigned absolutely |
| rebuild reweighted | 61% | `build` still 88% negative |
| target refitted to roster | 54% | bar sat exactly on the median |
| bar below median | **39%** | — |

**Placement objectives are zero-sum.** Only four of eight teams can finish top half. The
first draft required it of rebuilding programs — teams that are weak *by definition*,
since that is what earns the mandate — and 73% of them failed their review. A board asking
for the arithmetically impossible is not a hard board, it is a broken one.

**Prestige must not price the season.** `targetPct` ran off a 45%-prestige blend, which
is right for classifying a job and wrong for pricing it: develop programs hit their number
27% of the time and championship programs hit theirs 100%. The same word meant "nearly
impossible" at one job and "a formality" at another. It is now fitted to the roster alone,
from 512 simulated team-seasons:

    winPct = 0.01284 * roster - 0.173      R^2 = 0.679, residual 2.9 wins

**The bar sits below the median on purpose.** Sitting it exactly on the median is the
arithmetically neutral choice and the wrong one — it means half of all programs fail to
meet expectations every year by construction.

Final spread: exceeded 18%, met 44%, missed 22%, failed 16%, with every mandate landing
58-89% positive and win targets cleared 63-83% of the time.

### Three bugs found while measuring

- **A deep run raised your target retroactively.** `w`/`l` keep counting through the
  postseason and were being passed as the season length, so going 4-2 in regionals raised
  the win target by about three — nearly cancelling the reward. `TeamRecord` now freezes
  `rw`/`rl` when bracket play starts.
- **The live target crept upward all year.** The program screen passed *games played* as
  the season length, so the board's ask grew game by game and was only correct in
  September. It now uses `seasonLength(config)`.
- **A compete board asked for 16 wins and a winning season.** In 33 games those contradict,
  so the mandate was unclearable by construction. Caught by a test, not by eye.

### The offer now matches the job

The selection screen estimated a roster from the school's quality rating. That estimate ran
1.7 points light on average and 7 in the tail — enough to move a program across a mandate
boundary. Pascagoula Tech was advertised as COMPETE / 61 / 20 wins and became CONTEND / 65
/ 22 the moment you signed.

Generation is deterministic from `WORLD_SEED` and costs 2ms, so the screen builds the real
world and reads the real rosters. Verified end to end in the browser: offer and program
screen both read CONTEND / 65 / 22.

### ROSTER NOW is ROSTER OVR

"Now" was answering a question nobody asked. "OVR" is the word every sports game uses for
this number.


## Phase 0.6 — individual fielders, stage one

The locked v1 decision. Two stages are in: the ratings exist and are generated to fit the
position, and the catcher is a real person. Range deciding balls in play, hands producing
errors, and spray direction choosing who fields the ball are still ahead.

### `fielding` became `range` and `hands`

One number bundled "gets to the ball" and "does not drop it" — different skills, different
failure modes, worth different amounts at different positions. A shortstop lives on range;
a first baseman mostly needs hands. It was the same vagueness `stuff` had before it got
explained.

Both are 0-100, higher better, like everything else here. The plan sketched range on an
inverted Strat-O-Matic scale; one inverted rating among a dozen normal ones is a sign error
waiting to happen. The placeholder `range?`/`errorRate?` fields the port left on
`PlayerCore` are gone — they were explicitly marked "until Phase 0.6", which is now.

### The defensive spectrum, and why it must sum to zero

Teams put athletes up the middle and hide bats in the corners. `SPECTRUM` is that as data:
shortstops draw +10 range, first basemen -8, catchers -6 range and +10 arm.

The first version summed to **+13 on arm**, which quietly handed every team in the league a
better throwing outfield than it had the day before. Runners stopped taking the extra base
and scoring fell 10.6% below target. A spectrum redistributes talent across positions; it
must not add any. There is now a load-time assertion that both columns sum to zero.

`TeamState.arm` also now averages **the outfielders**, as its comment always claimed.
Averaging all nine let a strong-armed catcher cover for corner outfielders who cannot throw,
which is backwards — it is the man in left a runner is testing.

### The catcher exists

Steals were settled by runner speed and the pitcher's hold rating. Nobody threw the ball.
The catcher's arm now appears twice, deliberately: in the **success** of a throw, and in the
**attempt** rate. Only the first, and elite catchers would post huge caught-stealing totals
instead of the empty basepaths they actually produce.

`mult` measures against a flat 50, which is wrong for a rating deliberately drawn above it —
catchers are generated ten points high, so an unshifted `mult` read every ordinary catcher
as exceptional and suppressed stealing everywhere at once. `AVERAGE_CATCHER_ARM` re-centres
it so only distance from an average catcher moves anything.

## The calibration harness was measuring one seed

This is the finding worth keeping from the whole pass.

The twelve-pair harness averages over the roster lottery *within* a seed. It never averaged
across seeds — and the seed-to-seed spread turns out to be comparable to the tolerance being
tested: runs per game ranged **4.60 to 5.06** over eight seeds against a 10% bar. At that
spread a single-seed assertion cannot tell a regression from a lucky draw. It will pass a
broken engine on a friendly seed and fail a correct one on a hostile seed, silently both
times. Calibration now asserts against an eight-seed mean; determinism keeps one seed,
because "same seed, same answer" is a one-seed question by definition.

That immediately exposed two real defects that had been sitting inside the noise.

### `CONTEXT.normalizer` was tuned on one seed

It existed to hold the situational modifiers to a mean of 1.0. At 1.100 it held league
scoring **8.0% under** target and dragged every component down with it — average, on base,
slugging, home runs and walks all low together, which is the signature of one global
suppressor rather than five separate problems. **1.070** puts runs within 2.1% and every
component inside 3%, better than the previous best of "within 2% on one seed, runs 5% under".

### `strikeoutProbability` realized 17.4% against a configured 16.4%

`mult` is `exp`, and `exp` is convex. Both terms are exactly 1 for an average player, so the
formula looks like it lands on `LEAGUE_K_RATE` by construction — but over a population with
real spread, E[exp(x)] > exp(E[x]), so both average above 1. `JENSEN_K` corrects it.

### One investigation that found nothing, recorded so it is not repeated

The log5 combination step normalizes by a `denom` summed across all seven events. Because
each offensive event is a term in its own denominator, E[X/D] < E[X]/E[D] — so it *looks*
like it must bias offense downward, and a diagnostic appeared to confirm a 10% shortfall.

It was the diagnostic that was wrong. It passed `ctx = {}`, and `contextMultiplier` divides
by `CONTEXT.normalizer` unconditionally — so every plate appearance in that harness took a
0.909 multiplier. That was the entire "10%". Measured properly the log5 math lands within
1.5% of `LEAGUE`, and the change made on the bad evidence was reverted.

**Any harness that bypasses `PAContext` is measuring a different engine.** The normalizer is
not optional decoration on the context; it is part of the baseline.

### Verified

- 152 tests pass, no `KNOWN_OFF` entries — every sourced target met without exceptions.
- Goldens re-recorded; worst single-seed deviation 6%.
- A test pins that a cannon behind the plate both deters attempts and retires more of the
  runners who go anyway.
- Player card reads RANGE / HANDS / ARM with plain descriptions.


## A runner was disappearing

Reported from a managed game: a man was on base, the next batter reached on an error, and
the runner already aboard vanished — no out, no line in the play log.

`advanceOnHit` wrote each runner to his destination without checking whether the man ahead
was standing on it. With runners on first and second on a single or an error, the runner
from second holds at third, then the runner from first is *also* sent to third and
`bases[2] = runner` overwrites him. Baseball's rule is the simple one — runners may not
pass each other or share a base — and the engine did not have it.

**It hid from every other check.** The game stayed internally consistent: outs still reached
27, the linescore still added up, no accounting identity broke. It just quietly scored fewer
runs than it should. Fixing it raised league scoring from 5.008 to 5.131 per team per game,
about 2.5%, which is a measure of how often it was happening.

### The first fix introduced a second bug, and the first test did not catch either

The fix tracks where the nearest runner ahead stopped and caps the man behind him. Using
`3` as the "nobody ahead" sentinel was wrong, because `dest` of 3 means the runner scored:
home plate holds any number of men and is never blocked. That capped a runner trying to
score back onto third, on top of a batter arriving there on a triple — one lost-runner bug
traded for another. The sentinel is `-1`.

More usefully: **the first regression test passed against the unfixed engine.** It swept
seeds through a hand-rolled Lehmer generator, and for small seeds that generator's first
output is near zero — so the lead runner always succeeded, always scored, and never left
anybody standing on third for the trailing runner to be written on top of. The collision the
test existed to find was never once constructed.

The bug needs one specific pair of dice rolls, so the test now supplies them through a
scripted generator rather than hoping a seed produces them. Both tests were verified by
re-introducing the bug and confirming they fail — which is the only thing that distinguishes
a regression test from a test that happens to pass.


## Phase 0.6 complete — the ball goes somewhere and somebody fields it

### Spray

`fielderFor` picks the man who gets the ball, from the batted ball type and a lane —
pull, middle, opposite. Lanes are stored by *side* rather than by position, because
handedness decides which position each side is: a right hander's pull lane is short and
third, a left hander's is second and first. Power hitters pull more, so the pull lane is
weighted by `pullBias`.

It is deliberately coarse — a lane and a position, not coordinates. What the rest of the
engine needs from it is a **player**, so that range, hands and the play log can stop
treating the defence as one averaged blob.

### Range, then hands

That is the real order on a ground ball: first whether he gets there, then whether he keeps
it. Keeping them separate is the entire reason the two ratings exist.

Range is measured against the fielder's **own team's weighted average**, so it redistributes
plays between the men on the field rather than moving the league's offensive level — the
team-wide effect is `defenseMult`'s job. Two corrections were needed to make that baseline
actually centred: the DH was in it (he is generated ten points light on range precisely
because he does not field), and it was unweighted, when balls go disproportionately to the
shortstop, second baseman and centre fielder — exactly the positions the spectrum gives a
range premium. Both biased it low, so `edge` came out positive on average and a
redistribution behaved like a league-wide defensive upgrade worth about 1% of scoring.

Errors now come off the individual's `hands` and are weighted by what was hit at him:
grounders boot far more often than fly balls, with a divisor holding the league total put.
And the play log says who:

    Deacon Congdon grounds out to second.
    Brandon Mullen lines out to center.
    Maxwell Cuellar reaches on an error by Donovan Lucero.

Measured across 1500 games with everything but the gloves held fixed:

| defence | BA against | runs/g | errors/g |
|---|---|---|---|
| statues (range 25) | .307 | 6.79 | 0.97 |
| average (range 50) | .300 | 6.43 | 0.98 |
| acrobats (range 75) | .293 | 6.37 | 0.96 |
| stone hands (15) | .301 | 6.71 | 1.27 |
| sure hands (85) | .305 | 6.54 | 0.82 |

### `defenseMult` was dead in the engine we ship

Found by the fielding test, which reported a team of statues and a team of acrobats allowing
**bit-identical** batting averages.

`defenseMult` is computed in game.ts for every plate appearance and was read only by Engine
B. Engine A — the log5 model that actually runs the league — never looked at it. Team
defence therefore did nothing whatsoever to hit rates. Same failure as B2 and just as
invisible: the value was correct, it was passed correctly, and nothing consumed it. It now
applies to balls in play, and to nothing else, because no defence has ever caught a home run
or affected a walk.

### The fielding test was wrong twice before it was right

Worth recording, because both versions looked fine and reported confident nonsense.

- **It measured the wrong team.** `simGame` takes `(home, away)`, so passing
  `simGame(offense, defense)` makes the manipulated defence the *away* side. Reading
  `res.away.batting` measured that team batting against an untouched defence — a test of
  nothing, which nonetheless passed.
- **It was underpowered.** 300 games put the error comparison at about 1.5 standard errors,
  and it duly reported that the *worse* hands committed *fewer* errors. 1200 games.

### Calibration after all of it

Multi-seed, eight seeds: runs -2.6%, average -0.5%, on base -1.1%, slugging -0.1%, home runs
-0.6%, strikeouts -0.2%, walks -3.9%. No `KNOWN_OFF` entries. 158 tests pass.

### Checked: defence is already about right, and walks are not worth chasing

Both were flagged as possible tuning targets. Measured, neither is.

**Team defence** across 256 team-seasons of the shipped world: mean 50.2, sd 11.0, 5th
percentile 32.3, 95th 68.9, extremes 24.3 and 78.9. At the current `defenseMult`
sensitivity of -0.12 that spread moves in-play hit rates 5.6% between a 5th and 95th
percentile defence, and 8.5% between the league's worst and best. Real MLB team BABIP
allowed runs roughly .280 to .310 between best and worst — about 10%, and that figure also
carries pitching staff differences, so the honest defensive share is a little under it.

In runs: worst-to-best defence is worth about 0.46 runs per game here, against a real
best-to-worst defensive spread of roughly 0.6. Slightly light, not badly so. Raising
sensitivity to -0.18 would put worst-to-best at 13%, which overshoots real baseball.

The earlier concern that defence felt weak came from a diagnostic that set *every* position
to range 25 against every position at 75 — a 50 point gap at all nine spots, which no real
roster approaches. The actual 5th-to-95th percentile gap is 36 points and the whole league
fits inside 55. The test exaggerated how extreme the artificial case was, not how weak the
effect is.

**Walks** sit 3.9% under target, which is 0.14 walks per game. Inside tolerance, invisible
in play, and only fixable by adding another tuning constant for someone to maintain. The
multi-seed harness will catch it if it drifts further. Left alone.

## Phase 2.8 — the empty nav entries are gone

Four screens were nav entries with nothing behind them. Two needed a feature built
first, not a screen.

### Recruiting is the mechanism prestige acts through

Before this, a program that lost nine seniors had nine new players appear, generated at
its own quality minus five. Nobody chose them, nobody competed for them, and prestige —
the number the whole dynasty layer is built around — had no effect on who arrived. A blue
blood and a cellar program reloaded identically.

`appeal(prospectStars, programStars)` is the load-bearing function. Interest collapses
steeply when a recruit is out of a program's league, and keeps rising above his level so a
blue blood is a favourite over a good program for the same player rather than a coin flip.
Effort *multiplies* interest rather than creating it, so chasing someone who is not
listening spends the slot and signs nobody.

Measured over a full national class, 480 prospects across 64 programs:

| recruit | avg stars of the program that landed him |
|---|---|
| 5 star | 4.90 |
| 4 star | 4.17 |
| 3 star | 3.44 |
| 2 star | 2.25 |
| 1 star | 1.46 |

**Two defects on the way there.** The first `appeal` was flat at or above a recruit's level,
so every qualifying program was identical and effort alone decided — the tiers mapped
exactly, 4 star recruits to 3.00 star programs and 3 to 2.00, with no overlap at all. And
`aiBoard` sorted the plausible pool by stars and took the top, so every program chased the
best it was allowed to want, lost, and signed nobody: **seven of twelve four star programs
came away from a full class empty handed.** A board is a spread now — a couple of reaches,
a core at the program's level, a couple of certainties.

`WALK_ON_PENALTY` is what makes any of it matter. Filling holes at quality minus five meant
a program reloaded at its own level regardless; unrecruited bodies now arrive 13 under, so a
bad class is felt.

### The board screen needed two sort orders, not one clever one

Ranking by raw stars opens a two star program on a wall of players marked NOT REALISTIC.
Ranking by interest opens it on a wall of players not worth a slot. Every attempt to blend
them into one number failed the same way — interest falls off steeply enough between tiers
that whichever term carries more weight wins outright. BEST FIT and TOP RATED say the quiet
part out loud instead.

One subtle bug worth recording: interest is capped at 1 for ranking. `appeal` keeps *rising*
when a program outranks a recruit, which is correct for the signing lottery and exactly
wrong for sorting — BEST FIT opened on the one star players the program most overqualified
for.

### The portal moves real players

Everyone in it is a real man off a real roster, and signing him takes him from the program
he was sitting behind somebody at. That subtraction is the whole difference between a portal
and a second recruiting class with older players in it. The budget is deliberately smaller
than the recruiting board's — a portal worked as hard as high school recruiting would make
development pointless.

**A player vanished from the world.** `refill` builds a roster to exactly 23 and silently
dropped anything beyond the holes, which is harmless for a generated recruit and fatal for a
transfer: struck off his old roster, never placed on his new one, gone. Bench buffers only
delayed it — once the buffer filled, the bug returned. The fix is an ordering guarantee:
transfers are placed unconditionally and generated recruits absorb every shortfall, because
an unplaced recruit never existed. League population is exactly conserved.

### The wire

Every item is derived from what happened; nothing is invented. Two passes were needed to
make it readable rather than accurate:

- **De-duplicate on both teams.** Three different clubs beating the same ranked team is
  three headlines about three different winners, and a feed that only checks the winner
  printed all three in a row.
- **Interleave by kind.** Upsets carry the highest weights, so a straight sort put eleven of
  them above everything else. Capping each kind fixed the proportions and not the order —
  the cap's worth simply ran first. The feed is dealt round robin now, strongest kind first.

### The 3D diamond

three.js, lazy loaded, with the 2D diamond as the Suspense fallback — which is the roadmap's
"enhancement layer" taken literally. The fallback is a complete working field rather than a
spinner, so a device without WebGL gets the game.

The chunk is **894 kB (241 kB gzipped) and entirely separate**; the main bundle stays at 118
kB gzipped and never pays for a renderer it will not use.

Three bugs, each invisible in code review:

- **A blank canvas.** `onCreated` is the obvious place for `camera.lookAt` and does not
  work: R3F owns the camera and re-applies its transform on mount and resize, silently
  undoing it. The canvas was present, sized, error free and rendering nothing. Set from
  inside the tree, it sticks.
- **A mirrored diamond.** A camera looking along +z sees +x on the *left*, so building the
  field along +z put first base on the third base side. It is the one error in a baseball
  graphic every viewer catches instantly.
- **A mound that looked like a runner.** Drawn in the same clay as a baserunner, it read as
  a man standing on second — the single thing on the field a viewer must never misread.

The panel also had to grow from 96×76 to the column's full width. A 3D field cannot be read
at 96×76; it rendered as a wedge of dirt with home plate cropped off the bottom.

### Guards

`tests/architecture.test.ts` failed a file whose prose ended a sentence with the word
"window." — a real false positive, and the kind that teaches people to edit comments to
appease a test. It strips comments and string literals now, and was verified by planting an
actual `window.location` reference and confirming it still fails.

175 tests pass.

## The field became a ballpark, and the ball goes somewhere

### Inverted, as reported

The outfield wedge had its missing quarter pointing at centre field instead of at
the backstop, so the park had a notch cut out of the outfield and a solid green apron
behind the plate. That flips the depth cue and the diamond reads as opening toward the
viewer — home looks like second.

With `rotation.x = -PI/2` a circle vertex at angle `t` lands at world `(cos t, -sin t)`, so
a gap centred on `t = PI/2` points at **negative** z, straight out to the outfield. One
`thetaStart` and it reads correctly.

### What actually makes it look like a park

None of it is detail, which is the point at 150 by 118 pixels:

- **An outfield wall.** Gives the field an edge instead of trailing off into nothing.
- **A warning track.** Separates grass from wall and reads as maintenance.
- **Dirt basepaths around a grass infield** — a dirt diamond with the grass inset inside
  it, so what shows is the paths. This is the shape everybody recognises.
- **Light towers.** Something above the horizon, so it is a stadium and not a lawn.
- **Mown stripes**, at almost no contrast. At real contrast they became a sunburst
  radiating from a point that is not home plate — the sort of detail that draws the eye
  precisely because it is wrong.

Still primitives and flat colours: a few hundred triangles.

### The ball

`PlayEvent.landing` was declared long ago and carried a comment saying it was deliberately
not emitted, because faking a coordinate before the engine decided where balls went would
be inventing data. The spray model decides that now, so it is real: the fielder's position
is the anchor, the batted ball type moves it in or out, and a home run is placed past the
wall.

One flight serves both cases, because they are the same flight with a different ending — an
ordinary ball stops where the fielder got to it and the spot pulses once; a home run carries
higher and keeps going after it crosses the wall. Arc height scales with distance, so a
bloop and a drive to the gap differ without either being a special case.

### The landing takes no random draws, and a test insisted

The first version scattered it with `rng()`. That meant **asking for the event stream
consumed dice the simulation otherwise would not** — so a game watched play by play diverged
from the same game simulated silently, from the same seed. `play-events.test.ts` caught it
on the first run.

It is the rule the entire event stream rests on: reporting what happened must never change
what happens. The scatter is derived from the fielder's id and the pitch count instead —
stable, free, and varying exactly as much as it needs to. Two tests pin it now: landings sit
inside the foul lines and spread across the field, and a game plays out identically with
events on and off.

177 tests pass.

### Two corrections after seeing it on screen

**The foul lines ran the wrong way.** After the `-PI/2` tilt that lays a plane flat, its
length axis points along world -Z, so a further +45 degrees about Z swung each line ninety
degrees off — they crossed the field from deep centre to a point beside home instead of
bounding it from the plate out to the corners. Negating the rotation fixed it.

**The park floated in the panel.** Aiming the camera at the infield centre left a band of
empty background above the outfield wall, because the wall is the tallest thing in the scene
and the camera was pointed under it. Looking deeper and moving in tips the whole park up
into the frame and drops home plate toward the bottom edge — which is also the angle a
television camera actually uses.

The framing constants are module level and in the effect's dependency list, so editing them
re-runs on hot reload. Left inline they were captured at mount, every adjustment appeared to
do nothing, and each tweak cost a full reload plus replaying into a game — on the one value
in the file that can only be found by tweaking.

### Every batted ball flew the same way

Reported after watching it: ground balls looked like fly outs. They did — one parabola
served every kind, so a routine grounder to short sailed through the air on the same gentle
arc as a fly to the warning track. Those are the two plays a viewer is most often watching
to tell apart, and the animation made them identical.

The engine already reports `battedBall` on the contact event; the flight simply was not
using it. Each kind now has a profile — peak height as a fraction of distance, time as a
fixed cost plus time per unit travelled, and a hop count:

| kind | peak at the shortstop | peak on the track | hang time |
|---|---|---|---|
| ground | 0.33 | 0.55 | 0.68s / 1.02s |
| line | 0.52 | 1.00 | 0.39s / 0.56s |
| fly | 1.30 | 2.79 | 0.75s / 1.13s |
| popup | 3.30 | — | 1.06s |
| home run | — | 3.51 | 1.50s |

A grounder skips, each hop lower than the last, and is rolling by the time it reaches the
fielder. A liner is flat and fast — it arrives in half the time a fly ball takes. A popup is
the one ball whose height beats its length.

**Line drives and grounders first came out peaking within 0.01 of each other**, which fixed
the reported bug and left a new one: a ball hit hard in the air looked like a ball skipping
on dirt. The line arc doubled.

### The trajectory is a pure function now, and tested

`flightHeight` and `flightSeconds` came out of the `useFrame` closure. Inside it they could
only be checked by trying to photograph a moving object at the right millisecond, which is
exactly how the original defect survived being "verified" — the field rendered, a ball
appeared, and nobody could see that the curve was wrong.

Ten tests cover it, and **five of them fail against the old single-parabola version** —
confirmed by reinstating it. That is the difference between a regression test and a test
that happens to pass.

187 tests pass.

## Recruiting, rebuilt on the Campus Dynasty model

The first version was built without asking, and it was the wrong shape. It is worth being
precise about what was wrong, because two of the three faults were structural rather than
matters of taste.

### What the research established

Campus Dynasty runs **three rounds of point-based recruiting** over a pool of ~800, with
hometown advantages, and persistent recruitment can pull a player away from a bigger school.
The genre mechanics are documented in more detail for Football Coach: College Dynasty, which
shares the model: each recruit has **priorities**, schools have attributes, and a school
earns **automatic weekly points based on how well the recruit's priorities match it**, plus
bonus points from a weekly allowance of recruiting actions. **The school with the most
points wins.** Proximity to home is an important priority for many recruits, so pipelines
fall out of geography rather than being a separate system. Recruits commit at staggered
times — some early, some holding out.

### The three faults

**A weighted lottery instead of a running total.** The worst of them. Under a lottery you
can out-work a blue blood all winter and still lose the roll, which makes effort decorative;
under a running total, persistence is the actual mechanism by which a small program takes
somebody. That moment is what the mode exists to produce and the old model could not
reliably produce it.

**One flat number instead of priorities.** Interest was the star gap and nothing else, so
the board was the prestige table sorted twice. Now every recruit weighs five things — the
name, playing time, winning now, staying close to home, development — drawn with a bias
toward his own rating and then deliberately scrambled. A five star who wants to play
immediately is a live target for a program with a hole at his position, and that is the
whole game.

**Recruiting all season instead of a window.** Now three weeks after the postseason, with
twelve actions a week. Recruits commit as the weeks pass, so chasing a five star into week
three costs the honest targets who signed in week one.

The transfer portal was removed entirely — engine, screen and nav entry — as a complication
a casual game does not need.

### Every pitch is a real quantity

In `pitch.ts`, and this is what stops the system being flavour text: prestige is the
program's actual prestige, winning is last season's actual record, proximity is the
conference's region against the recruit's hometown, development is how close the current
roster sits to its own ceilings, and **playing time is read off the real depth chart** —
compare the recruit to whoever plays there now, discounted by how soon that man graduates.
If playing time were a flat number per program it would just be prestige wearing a
different label.

### Three defects found by measuring, not by reading

**Everybody chased the same eighty players.** Ranking the whole class by rating times fit
gave all sixty four programs near-identical boards: **79 recruits out of 480 were pursued by
anybody at all**, the average team signed 1.2 against a need of seven, and every other spot
went to a walk-on. Boards are built in tiers relative to the program's own standing now — a
reach, a core, and some certainty.

**The four best programs in the league signed nobody.** The "somebody else is clearly ahead"
check read the live point totals, so the result depended on the order teams were looped in:
each program banked points as it went, and every later program saw those recruits as already
gone. The top four ran last and were shut out every single year. It reads a snapshot taken
before anyone spends now, so every program judges the same board.

**No recruit could ever commit early.** The threshold was set at 26 points when a week of
genuine pursuit banks about six — so the window had a clock that never ran, and every
commitment landed on the final day. Tied to the real scale it produces.

### Where it settles

Measured over four full dynasty years against real rosters: **360 to 385 of 480 sign**,
median class 5 to 6 per program, and the gradient holds — five stars land at programs
averaging 3.9 stars, ones at 2.0. League roster strength stays flat at 48 to 52, so the
walk-on penalty is not quietly draining the world.

195 tests pass.

Sources: [gmgames Campus Dynasty review](https://gmgames.org/campus-dynasty/review/),
[Football Coach: College Dynasty recruiting discussion](https://steamcommunity.com/app/2151290/discussions/0/3490879839983784439/)

### The gate is hard now, not steep

Reported: low prestige schools should be **blocked** from high ranked players, which is how
Campus Dynasty does it. The model had a soft gate — a one star program could chase a five
star and simply gain almost nothing — and that reads to a player as a bug rather than a
rule. The actions are spent, the button works, and nothing ever comes of it.

Every recruit carries a `minProgram`: the lowest tier that will give him a hearing. **How
far he comes down is his own**, derived from what he wants — a recruit who cares about
playing time or staying near home will hear out a program two or three tiers below him,
while one chasing the biggest name in the country will not come down at all.

That keeps the door the review describes open without opening it for everyone:

| program | recruits available | five stars reachable |
|---|---|---|
| 1★ | 371 of 480 | 0 of 34 |
| 2★ | 424 | 0 |
| 3★ | 452 | **6** |
| 4★ | 480 | 34 |
| 5★ | 480 | 34 |

Landing a big prospect from below is rare and specific — six identifiable players, not a
percentage — and no program is ever left without a class to sign.

**It also fixed the gradient.** Before the gate, the tier a five star signed with drifted
year over year and converged with the four stars (3.9 → 3.6 → 3.4 → 3.3). Over five years
with it: **4.5, 4.5, 4.5, 4.5, 4.6**, against 3.5 for fours, 2.9 for threes, 2.5 for twos
and 1.8 for ones. A stable, legible ladder.

### Two bugs the gate surfaced

**The AI was gated on a different scale than the player.** `aiTargets` worked its own tier
out as `1 + round(prestige × 4)` while the gate applied to the human used `prestigeStars`.
Those disagree — at prestige 38 one says tier 3 and the other says 2 — so the computer
programs could chase recruits an identical human program was refused. The tier is carried on
the `Pitch` now, computed once, so there is a single scale.

**The out of reach list showed nothing.** Sorting locked recruits to the bottom of one list
looked correct and displayed none of them: a one star program can reach 371 of 480, so fifty
rows of reachable players filled the screen. They have their own short section now, which is
the entire reason to show them.

200 tests pass.

### Runners teleported, and the easing had never once run

Reported from testing: baserunners appear and disappear instead of moving.

The cause is a one-line trap. `<mesh position={BAG[base]}>` puts the position in the
**props**, and R3F re-applies props on every render — so the moment the engine moved a man
to the next base, React re-rendered and the mesh was snapped to the new bag before the
easing could show a single frame. The `lerp` sitting underneath had been running all along
and had never been visible. Position is owned by the frame loop now and never passed in.

Fixing that exposed a second problem it had been hiding: easing straight at the destination
sends a man going first to third **diagonally across the pitcher's mound**. He follows the
bags now — `basePath` builds the route from the bases he actually has to touch.

And a man who scores no longer blinks out on third. The engine takes him off the bases the
instant he crosses, so the screen never saw the run; the play events report the advance to
base 4, and he finishes the trip home and fades.

`basePath` is a pure exported function with four tests, for the same reason `flightHeight`
is: inside a `useFrame` closure the only way to check it is to photograph a moving object at
the right millisecond, which is precisely how the original defect survived being looked at.

### Sheets rise instead of appearing

Every sheet in the app — the job offer, the recruit card, the pinch hit and bullpen pickers
— arrived fully formed on the frame it was opened, which reads as a glitch rather than a
panel: nothing connects the tap to the thing that appeared.

One pair of keyframes in `tokens.css`, applied to all three screens that use the pattern.
Measured on the offer sheet: the panel travels 320 → 86 → 19 → 2 → 0 pixels over about
180ms while the scrim fades 0.26 → 1.00. `prefers-reduced-motion` turns it off.

204 tests pass.

## Phase 3 — the offseason became a sequence

Recruiting was a nav entry, which meant it was reachable in March and meaningless in June: a
screen whose entire point is a three week deadline, available at all times and urgent at
none. The RECRUIT tab is gone. The offseason is six full screens in a fixed order, and the
game does not go forward until each one has been dealt with.

    season ends → AWARDS → SEASON REVIEW → COACH POINTS
      → RECRUITING (3 weeks) → SIGNING DAY → THE DRAFT → next season

The nav is hidden throughout and the header counts the steps, because during the offseason
there is nothing else to be doing.

### Settling the season moved earlier

`reviewSeason` used to run inside `rollYear`, at the very end. That is too late now:
**everything after the review is priced on its result.** Skill points are spent before
recruiting, and recruiting is pitched on the prestige the review just produced — computing
it last would have the whole offseason spending itself against last year's numbers.
`settleSeason` runs when the review screen opens; `rollYear` now only does progression.

### The season review

Record, national RPI rank, place in the region, the team MVP judged on production rather
than rating, and prestige shown as arithmetic — **was 47, the season +7, now 54.** That
number is the currency the rest of the dynasty is priced in, so a player who only ever sees
the final figure never learns what moves it.

### Coach skills

Four attributes, and each is wired to something the engine already does, because a skill
tree whose branches do not change the simulation is a menu rather than a decision. Offence
and defence tilt how a game is played, training decides how far a player develops between
seasons, and recruiting is how hard a pitch lands. Points scale with the year — three for
turning up, more for a tournament, a conference title, Omaha, a ring — so winning compounds
without a bad year leaving nothing to spend.

### Signing day

What the class came to, its national rank by weighted stars rather than a headcount, and
**who took the players you missed**. That second list matters more than it looks: losing a
recruit to a program you can name is a rivalry, losing him into a void is a number going
down.

### Verified end to end

Walked the whole loop in the browser: postseason → step 1 of 6 → review (23-10, national #4,
Gulf #3, prestige 47 → 54) → five skill points spent → three recruiting weeks → signing day
→ draft → next season opens on Feb 8, game 1 of 33, with the nav back.

206 tests pass.

### Still to build from the spec

The recruiting screen itself is the old one running inside the new sequence. Outstanding:
scholarships and a per-recruit budget in place of weekly actions, the filter row (position,
minimum overall, minimum potential, home state, affordable), the recruit profile's four tabs
(overview with the offer, **estimated** ratings rather than true ones, high school
statistics, and which other schools are in on him), and the Targets / Commits / Roster tabs.
Hometowns are regions today and need to become states for the pipeline filter to mean
anything.

## Phase 4 — the recruiting stage, built to the spec

### States, because a region is not a hometown

Every program has a home state and so does every recruit. Proximity is three steps, not two:
**same state is the pipeline**, same region counts for something, anywhere else is a plane
ride. The single region check treated a school in a recruit's own town exactly like one four
states away, which is the whole idea of a pipeline thrown out.

Thirty-six states across the eight regions, unevenly — the warm-weather regions carry more,
which is the distribution rather than a bug.

### Scholarships and a budget, not slots and actions

- **Scholarships (8)** cap what a class may *hold*. Not who you may talk to: chasing eleven
  players with eight scholarships is a legitimate way to work, and capping the board would
  forbid the ordinary act of having more irons in the fire than you can finish.
- **Budget (30 a week)** is the only limit on chasing. It buys a decisive push on two or
  three players or a thin one on eight, and that trade is the screen.

The cap binds where it should. Over four simulated years in the real 64-team world, class
sizes went from **min 1 / median 6 / max 14** to **min 1 / median 6 / max 8** — no more
fourteen-man hauls — with the star gradient and league roster strength unchanged.

### Four views, because they are four questions

RECRUITS, TARGETS, COMMITS, ROSTER. Answering them on one list means answering none of them
well; the roster tab in particular is there so the class can be judged against the holes it
is meant to fix.

### The filter

Position, home state, minimum overall, minimum potential, and within-my-reach-only. The two
minimums filter on the **reported** numbers, not the true ones — filtering on truth would
quietly leak the ratings the screen is deliberately hiding.

### Ratings are scouting reports

`scouting.ts`. A board showing true ratings makes recruiting arithmetic: sort by the number,
spend on the top, done. It is a decision because you are buying a **guess**.

The error is wider the further down the board you look — nobody drove out to see the two
star from Wyoming — and it is **stable per player**, so refreshing does not re-roll a
scout's opinion. Below four stars the numbers round to the nearest five, because precision
that is not there is itself a lie. Ratings show as a band rather than a figure.

High school lines come from the same machinery: derived from real ratings, so a slugger has
a slugger's numbers, but against high school pitching. A .521 average is a normal recruit.

### The offer, and who else is in

The overview names the two things this recruit actually wants and shows what a week's spend
would bank. The schools tab shows every program chasing him as a bar against the leader —
losing a recruit is information only if you can see who took him.

211 tests pass. Main bundle 124 kB gzipped; the 3D field stays a separate 243 kB chunk.

## The offseason survives a reload

The phase was not persisted, so a reload between steps dropped the player on the dashboard
mid-sequence with a week's recruiting budget already spent and nowhere to spend the rest.

`phase`, the board review and the season outcome now go into the save, and every step of the
sequence writes one — including each recruiting spend, because that is the state a player
would most resent losing. Verified in the browser: spent 10 in week one, reloaded, and came
back to **step 4 of 6, week 1 of 3, 20 budget left**.

### The types said it was saved. It was not.

Widening `SaveExtras` and `SaveFile` compiled perfectly and changed nothing, because
`saveDynasty` assembles the record **field by field** — anything not named in the object
literal is dropped no matter what the types accept. The save looked correct in TypeScript
and lost the offseason on every reload; only an actual save-and-reload in the browser
found it.

`buildSaveFile` is now a pure function, tested without IndexedDB, since the defect lives in
building the record rather than writing it. Five tests, including one that a phase-less save
omits the key entirely rather than storing `undefined` — a key holding undefined survives
structured clone and reads back as a phase that exists and is nothing.

## Signing day became the recruiting review

Three views, because the report answers three questions:

- **YOUR CLASS** — who you signed, with the week each committed.
- **RANKINGS** — the national class table, scored on stars squared so quality beats
  quantity. Four two-stars is not a better class than one five-star, and a headcount says
  it is.
- **EVERY RECRUIT** — the whole signed class with where each one went, clickable.

Opening a recruit shows where he signed and when, his scouted overall and ceiling, what he
wanted, his high school line, and **every program that was in on him with its point total**.
That last panel is what makes recruiting read as a competition: losing a player to a school
you can name and click on is a rivalry, losing him into a void is a number going down.

Measured in a real run: signed 5, 91 class points, **6th nationally** behind four programs
that filled all eight scholarships.

216 tests pass.

## Four things reported from testing

### The modal changed size on every tab

The recruit sheet was `maxHeight`, so it sized to its contents — two priorities against six
rating bands against eight rival schools. Switching tabs made the panel jump under the
thumb, which is the same "the app keeps changing shape" complaint the manage screen drew.

Both sheets are fixed panels now with the body scrolling inside. Measured across five tab
switches: **430×488 at top 190, unchanged every time.**

### Players were not clickable outside two screens

Only the roster and the stats leaders opened a card. Clicking an award winner did nothing at
all — and worse, it could not have worked: `openPlayer` routes to the team tab, and during
the offseason the phase screens own the entire frame, so the navigation would have landed
somewhere invisible.

A card now opens **over** whatever is underneath it and returns there on close, in or out of
the sequence. `playerFrom` remembers where it was opened from, so back goes back rather than
dumping the player on the roster.

### Recruits had no national ranking

The reference screenshots show a rank beside every name and I had only stars. A star rating
puts a hundred and twenty players in one bucket, which is no help when choosing between two
of them — **"the 2nd best player in the country" is a different proposition from "another
five star"**. Ranked once at generation on the same projection the stars are cut from, so
every program reads the same board.

### The draft screen showed predictions, not results

It listed who *might* go, because `advanceOffseason` ran at the year roll — after the draft
step. The one screen whose entire job is reporting an outcome could only ever show odds.

Progression now runs on the way *into* the draft step. The screen has the four views the
reference shows — **Round 1, Round 2, Undrafted, Departing** — with rounds assigned across
the whole league at once, thirty two deep, because a round only means something as a
national ordering. Undrafted seniors are marked CAREER OVER, which is what it is.

Measured in a run: 102 players drafted league wide, 8 lost from the user's program, 6 of
them drafted — two in the first round.

216 tests pass.

**Superseded.** "Two in the first round" out of six is the number that gave this away:
thirty-two-deep rounds over the men one league sends up meant every program had a first
rounder. The draft is twenty rounds of thirty now, placed by what the clubs think a man is
worth on a national six-hundred-pick board, and the screen's four views are KEEP,
DEPARTING, BOARD and UNDRAFTED. See `05-systems-reference.md` §14.

## A slider, and a face for every player

### The offer is a slider

The budget is a continuous quantity and now reads as one. Discrete step buttons made you
compute the difference between 8 and 10 yourself; dragging shows the cost against the
remaining pool as it moves. The caption underneath carries what the reference screenshots
carry — **budget left, and the minimum prestige he will listen to.**

### Avatars

Four thousand players and no artist, so every portrait is drawn from the player's own id:
the same man gets the same face on the recruiting board, on his card, and in the draft
results four years later. That consistency is the entire point — a face that reshuffles on
every render is worse than no face, because it stops being *his*.

Flat vector shapes rather than anything rendered or downloaded: skin tone, hair colour and
cut, occasional beard, a jersey in the **program's own colour**, and a shirt number. A few
dozen SVG nodes, no assets, and nothing added to the bundle — the app is still 124 kB
gzipped.

Faces are on the recruiting rows and profile, the roster, signing day, the draft results,
and the player card. Verified in the browser: 55 avatars on one board, and eight sampled
faces all distinct.

216 tests pass.

## Round of fixes from device testing

### Signed recruits were being thrown away

The worst bug the game can have from the player's side: three weeks and eight scholarships
spent on men who then did not exist. `refill` only placed a recruit when there was a **hole
at his position**, so a class signed into a roster that returns its starters was silently
discarded. Measured before the fix: **5 of 6 signings arrived, the pitcher vanished.** Now
every signing joins the program — the bench and bullpen carry the extras — verified at 8 of
8 and pinned by a test.

### The player card is an overlay, not a route

One change closing a whole class of complaint. Navigating to a card unmounted the screen it
was opened from, so the roster forgot you were on the pitchers tab, a long list forgot where
you had scrolled, and "back" returned you to the top of something else. Nothing underneath
unmounts now. The back control lives on the overlay's own header, so it is larger and stays
pinned instead of scrolling away with the content.

### Ratings under the names baseball uses

The engine fields keep their internal names; nobody outside the file has to learn them.
`stuff` reads as **K/9**, `movement` as **H/9**, `control` as **BB/9**, `holdRunners` as
**PICKOFF**, `range` as **REACTION**, `hands` as **FIELDING**, `eye` as **DISCIPLINE**. A
rating you have to be taught is a rating that does not get read.

### The board was uncontested on day one

Every recruit read NOBODY ON HIM when the window opened, so week one was a free run at the
country and a single point of effort led the field. Every other program now works its board
once before the window opens, so the player arrives at a contest already under way.

### Targets vanished mid-window

The list filtered on *this week's* spend, so a board worked for two weeks came back empty
when the week turned. Targets persist until resolved and say which way it went — LOST HIM
when somebody else signs him.

### Potential is a grade, and it is often wrong

Reported as: we should not know the ceiling, or we would always pick the best players.
Correct, and it went deeper than the label.

**Stars were computed from true potential**, so a high ceiling could never hide — every
sleeper was already a five star and the only surprises available were bad ones. Measured on
the old model: 46 of 145 highly graded recruits were busts, and the entire 480-man class
held **one** player worth more than his grade.

Three changes, each needed:

1. **The generator makes raw players.** 7% of freshmen get a projectable ceiling far above
   what they can do now. Without them a gem cannot exist, because headroom was always a
   band around current ability.
2. **The services rate what they can watch** — mostly present ability, projection weighted
   light and carrying the error.
3. **Potential shows as a grade** — ELITE, HIGH, SOLID, FRINGE, UNKNOWN — never a number,
   graded on visible ability so a raw player hides in plain sight.

Measured after: **6 gems** the board undersells, including a four star at 47 overall with a
true ceiling of 94 graded merely SOLID, alongside **21 busts** among 103 highly graded
recruits. Both directions, which is what makes scouting worth doing.

Calibration re-checked: worst deviation 3%. 217 tests pass.

## The smaller reports from testing

### Back returns you where you were

`openPlayer` navigated to a route, which unmounted the screen it was opened from — so the
roster forgot the pitchers tab, lists forgot their scroll, and back landed at the top of
something else. It sets the selection and nothing more now; the card is an overlay above
whatever is on screen. Verified: open a pitcher's card from the PITCHERS tab, tap back,
still on PITCHERS.

The back control lives on the overlay's own header, so it is larger and pinned rather than
scrolling away with the content.

### Faces and colours

The roster's first column was a bullet marking a starter; it is a portrait now, with the
starter marker folded into the row highlight. A roster of names reads as a spreadsheet, and
the point of a face is that a player becomes somebody you recognise across four years.

`teamColour` is exported, so a school's name carries its program's colour in the standings
and on a rival's card. Sixty four names in one typeface are sixty four strings; in their own
colours they start to be places.

### Buttons that do not scroll away

`Sticky.tsx`. Every offseason step ends in one decision and it should not be behind however
much content that step happens to have — three signings and thirty put CONTINUE in the same
place. The advance button floats above the content on the review, coach, awards, signing day
and draft steps.

### The review is a way in, not a summary

Every number on it is a door now: the record opens the schedule, the national and conference
ranks open the standings, and the team MVP opens his card. A verdict screen that only states
its conclusions is one you read once.

217 tests pass.

## Box scores, and headers that stay put

### A played game opens its box score

`GameSummary` held only the score, so a box score was not recoverable after the fact — the
per-player lines existed for the length of one `simGame` call and were then folded into
season totals and dropped.

They are captured now in `recordResult`, which every finished game passes through whether it
was simulated or managed pitch by pitch. **Only the user's games**: a season is a thousand
games across the league, and keeping every line would put tens of thousands of rows in a
save to serve a screen nobody opens. You want to look back at your own games, not at a
Tuesday in the Mountain conference.

`captureBoxFor` is set when a job is taken and when one is accepted mid-career, because a
season is built before anybody has chosen a program.

The sheet shows both sides, batting and pitching, with every name tappable through to the
player. A schedule that carries only a final score answers "did we win" and nothing else —
the reason to look back at a game in March is to find out who did it.

### Fixed headers

`FixedHeader` in `Sticky.tsx`. On the roster and on team selection the title, the tabs and
the region chips now stay on screen while only the list scrolls. Both were long lists whose
controls scrolled away exactly when they were wanted: the region chips are how you move
between regions, and scrolling them off means scrolling back up every time you want to look
somewhere else.

Verified at phone height: scrolled the program list 201px with the ATLANTIC chip fixed at
top 254, and the roster 76px with the PITCHERS tab fixed at top 72.

217 tests pass.
