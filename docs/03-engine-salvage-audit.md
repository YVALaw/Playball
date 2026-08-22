# Engine Salvage Audit

**Last updated:** August 19, 2026
**Purpose:** the sim engine exists in two forked copies. This is the line-by-line
account of what each one has, what each one is missing, and what the unified
engine keeps from which side.

**Companion docs:** `01-roadmap.md` for the product, `02-sim-engine-spec.md` for engine internals.

> **Caveat on verification.** Node is not installed on the development machine, so
> nothing in this audit has been confirmed by running it. Every claim below comes
> from reading the source. The calibration numbers in `02-sim-engine-spec.md` are
> **unverified** — no one has run `node sim.js calibrate` here. Treat "the engine
> is calibrated" as an assumption, not a fact, until that command runs.

---

## The two copies

| | Copy A | Copy B |
|---|---|---|
| Location | `src/*.js` + `sim.js` | `Dynasty Mobile.dc.html`, lines 510–1428 |
| Form | 6 ES modules, ~970 lines | one `Component` class, ~918 lines |
| Tracked in git | yes | no |
| Runs where | Node CLI | Claude Design canvas runtime |
| Built for | statistical fidelity | playable UI |

Copy B was made by copying Copy A's constants and math into a class, then editing.
Shared ancestry is unmistakable: identical `LEAGUE` table, identical `SPREAD = 0.62`,
identical `BAT_SENS`/`PIT_SENS` tables, identical `platoon()` and `fatigue()` bodies,
identical xorshift RNG.

They have since diverged in both directions. **Neither is a superset of the other.**

---

## Keep from Copy A (the engine)

### 1. `pitchModel.js` — the whole file, non-negotiable

Copy B has no pitch model at all. This file is the "drama layer" that
`02-sim-engine-spec.md` builds its whole architecture around, and it is the single
largest asset Copy B lacks:

- 12-count × 6-outcome matrix, the structure the spec calls for
- `ZONE` table calibrated so first-pitch-strike lands near 58.4% and **3-0 strike
  rate near 58.3%** — the spec's "single most distinctive number in the college game"
- `SWING` rates split by in-zone and chase, per count
- `SWING_RESULT` splitting miss/foul/in-play, honoring the spec's finding that foul
  rate stays 33–40% at every count
- `control` rating drives the zone rate, so a high-control arm approaching 80% at 3-0
  emerges as an elite prospect — exactly the design goal in the spec

### 2. Engine B (`enginePitch`) and the two-engine structure

Copy B has one engine. Copy A has two behind a common interface (`ENGINES`), which
is what makes `node sim.js compare` possible. Keeping both is what lets a tuning
change be checked against an independent model instead of against intuition.

`resolveBallInPlay`'s batted-ball → hit-probability table (`BIP`) is real work:
line drives at .735, popups at .020, HR share concentrated in fly balls. Copy B has
no equivalent — it goes straight from log5 event to result.

### 3. `constrainedSequence` — real pitch sequences

Builds a plausible count path that lands on a known outcome, with foul balls piling
up only at two strikes. This is what produces `[2-2 7p]` in the play log. Copy B
fakes it (see below).

### 4. `game.js` details Copy B dropped

- **Errors generated from team fielding** — `rng() < 0.055 * mult(fld.defense, -0.55)`
- **The `blame` map** — tracks which pitcher let each runner on, so earned vs
  unearned runs are correct when a reliever inherits traffic
- **`timesThrough` tracking** feeding `CONTEXT.timesThroughOrder` — the spec's
  third-time-through penalty, which is what makes the bullpen decision a real decision
- **`defenseMult`** from team fielding average, applied to ball-in-play outcomes
- **Fielder's choice** as a distinct outcome from the double play
- **Run rule** — 7 innings, 10-run lead, per the spec's college rules section
- **Extra innings to 18**, not 13
- **`describeCount`** — renders the count and pitch total for the play log

### 5. `ratings.js` as a standalone file

The "tune here and nowhere else" discipline is worth more than the code. Copy B
scattered the same constants into class fields on a component that also renders UI.

### 6. The calibration harness (`sim.js`)

`calibrate`, `compare`, `platoon`, `parity` with real D1 targets. Copy B has no
harness. Per the roadmap's own instruction — "build the test harness before you
build the UI, non negotiable" — this is the piece that keeps the project honest.

---

## Keep from Copy B (the prototype)

### 1. The entire season layer

Copy A sims one game between two hardcoded teams and stops. Copy B has:

- **`buildSchedule()`** — 91-day calendar from Feb 12, 2027, with a proper
  round-robin (`roundPairs()` rotates 11 opponents around a fixed team 0)
- **Conference series (3 games) vs midweek vs off days**, with flavor text for rest days
- **12 named teams** with school/nickname/abbreviation/quality
- **`simDay()`** — sims a whole slate, with the user's game optionally played live

### 2. Season-long stat accumulation

Copy A's stats live in per-game `Map`s and vanish when the game ends. Copy B puts
`st` (hitting) and `pst` (pitching) directly on the player object and accumulates
across the season. Everything the Stats, Roster, and Player screens display depends
on this. **This is the single most important thing to port up.**

### 3. Standings and season state

`w`, `l`, `cw`, `cl`, `streak`, `rs`, `ra`, `gp` on every team; sorted standings with
conference win percentage; `rpi()` approximation; run differential.

### 4. Coach tactics — a genuinely good design

Copy A has steal only. Copy B has hit-and-run, play-for-contact, pitch-for-ground-ball,
pitch-around, sacrifice bunt, intentional walk, and infield-in. The implementation is
the part worth keeping: tactics pass a `mods` object that **bends the log5 event
vector** before the roll, rather than special-casing outcomes.

```js
if(t==='hitrun'){ mods={ single:1.06, homerun:0.85, walk:0.85 }; aggro=0.9; gidp=0.05; }
```

That composes cleanly with the unified engine and should survive the merge intact.

### 5. In-game substitutions

`pinchHit()` swaps a bench player into the batting order and sends the outgoing
player to the bench; `changePitcher()` pulls from the bullpen and advances the pen
index. Copy A only changes pitchers automatically.

### 6. Player fields Copy A lacks

`id`, `num`, `town`, `ht`, `wt`, **`overall`**, **`potential`**. Overall and potential
are computed as weighted rating blends and are what the Player and Roster screens
render. Copy A has no concept of either, and Phase 2 progression needs both.

### 7. Presentation logic

`writeFeed()` generates news items with a star-of-the-game pick; `fmtDate`, `ord`,
`avg`, `obpSlg`, `era`, `ipStr` are the display formatters every screen uses.

### 8. Recruiting board

`buildRecruits()` — 8 recruits with stars, interest, national rank, hometown, and
scouting notes. Phase 3 groundwork, already shaped.

### 9. All 12 screens and the visual system

Covered in the UI section below.

---

## Do NOT carry Copy B's regressions forward

These are the edits that happened when the engine was inlined for the prototype.
Each one trades fidelity for expedience, and the spec argues against every one.

| # | Regression | Evidence | Why it matters |
|---|---|---|---|
| 1 | **Strikeout fudge factor** | `if(this.rng()<kp*1.75)` | Copy A derives K share of outs as `kProb / LEAGUE.out`. Copy B multiplies by a hand-picked 1.75. This is tuning by eye — precisely what the harness exists to prevent |
| 2 | **Fake pitch counts** | `def.pc += this.rng()<0.5?4:3` | Averages 3.5 pitches per PA against a D1 target of 3.75, and no count is ever shown. Fixed by adopting `pitchModel.js` |
| 3 | **Errors never happen** | 0 matches for `error` in the whole file | College baseball's defining offensive feature. The spec: "errors are a real source of runs" |
| 4 | **Box score errors hardcoded** | `mkRow(A,…,0)`, `mkRow(H,…,1)` | The line score literally prints away=0, home=1 errors every game |
| 5 | **All runs earned** | `pst.er++` at all 4 scoring sites | No unearned-run concept, so ERA is systematically inflated |
| 6 | **No times-through-order penalty** | 0 matches for `timesThrough` | The bullpen decision loses its main justification |
| 7 | **No stretch penalty** | 0 matches for `runnersOn` | Spec cites +36 points of AVG with runners on |
| 8 | **Extra innings capped at 13** | `if(c.inn>13)` | Copy A goes to 18 |
| 9 | **No run rule** | absent | Spec lists it under college rules |
| 10 | **Handedness drift** | `throws` draw dropped the switch-hitter branch and moved RHB-throws-left from 0.06 to 0.08 | Small, but it means the two copies generate different players from the same seed |
| 11 | **No save/load** | 0 matches for `localStorage`/`IndexedDB` | Every refresh is a new dynasty |

---

## What the prototype specifies for the UI

`Dynasty Mobile.dc.html` is not a mockup. It is a working app with 12 screens, driven
by real simulated data.

**Screens:** Today (hub), Live (in-game with coach decisions), Box (line score + play
log + box), Schedule, Standings, Stats (leaderboards), Roster (hitter/pitcher toggle),
Player (detail with rating bars), Lineup (tap-to-swap order), Rotation (FRI/SAT/SUN/MID),
Strategy (5 policy groups), Recruiting board (with a points budget). Plus a modal for
substitutions and a placeholder group for portal/draft/awards/history/records.

**Visual system — this is the app's design.** The mockup governs palette, typography,
layout, and interaction. Port it as-is.

| Token | Value |
|---|---|
| Clay (accent) | `#a8442a` |
| Ink (text) | `#1c2430` |
| Paper (surface) | `#fbf7ee` |
| Field (background) | `#f2ece0` |
| Win / Loss | `#3f6b46` / `#a8442a` |
| Display face | Big Shoulders Display 500–800 |
| Mono face | IBM Plex Mono 400–600 |
| Body face | Source Sans 3 |

**Structural note.** The canvas runtime (`support.js`, generated — do not hand-edit)
provides `x-dc` templates with `sc-if` / `sc-for` / `{{ }}` binding. That runtime is a
design-preview tool. It has no router, no storage, and no build target, so it cannot
be the shipping app. The prototype's role is as an executable spec: the screens, the
bindings each screen needs, and the interaction model are all settled and should be
ported rather than redesigned.

---

## Merge direction

**Copy A is the base. Copy B's season layer ports up onto it.**

Rationale: Copy A's advantages (pitch model, two engines, calibration harness, correct
earned runs, errors) are load-bearing and hard to rebuild. Copy B's advantages (season
loop, stat accumulation, tactics, UI) are additive and port cleanly onto a better
foundation. Merging the other direction means deliberately importing all 11 regressions
above and rebuilding the pitch model from scratch.

Target layout is the one `01-roadmap.md` v3 specifies. Copy B's season logic lands in
`season.ts`; its tactics and substitutions fold into the existing engine files:

```
src/engine/          pure TS. No React, no Three, no DOM
  types.ts           domain model, branded IDs, exhaustive unions   [v3, new]
  ratings.ts         unchanged from Copy A — the one tuning file
  players.ts         Copy A + Copy B's id/num/town/ht/wt/overall/potential
  pitchModel.ts      unchanged from Copy A
  engines.ts         Copy A, plus Copy B's tactic `mods` hook on the event vector
  game.ts            Copy A, plus Copy B's substitutions and season-stat
                     accumulation, and emitting `PlayEvent`
  season.ts          Copy B's buildSchedule + roundPairs + standings + rpi + feed
  rng.ts             the seeded xorshift, extracted from players.js
```

v3's hard rule: nothing in `/engine` may import from `/ui`, `/state`, or `/field`,
enforced by an ESLint boundary rule. That is the same constraint the original roadmap
stated, now made mechanical.

---

## Relationship to roadmap v3

### 1. The mockup owns the design

`01-roadmap.md`'s **Design direction** section — the scorekeeper's-page palette built on
ballpoint blue — was never updated for v3 and was never adopted. It is marked stale in
that document. **The mockup's palette and typography are the app's design**, and the port
carries them over unchanged.

One idea from the stale section is still worth taking: the live scorebook cell that fills
in beside the field as an at bat resolves. The mockup has no equivalent. It is a candidate
addition, not a reason to redesign anything.

### 2. Everything in the mockup ports over

The 12 screens, the data each binds to, the palette, the type scale, and the interaction
model — tap-to-swap lineup, FRI/SAT/SUN/MID rotation slots, the five strategy policy
groups, the coach-decision buttons during a live at bat. That is the expensive design
work and all of it holds.

What changes is only the runtime: `x-dc` templates and `sc-if` / `sc-for` become React
components, `{{ }}` bindings become props and Zustand selectors, and the inline engine
copy is replaced by imports from `src/engine`. Same screens, same pixels, different
plumbing.

### 3. The prototype has no place in v3's tree

v3's layout has no home for `Dynasty Mobile.dc.html` and its two support files. They are
kept in `/design` at repo root, outside `/src`, since they are a reference artifact rather
than shipping code. All three must stay in the same directory — the `.dc.html` loads
`./support.js` and `./android-frame.jsx` by relative path.

---

## The calibration problem

v3 states Phase 0 is done and "calibrated against real NCAA Division I numbers," and sets
Phase 0.5's exit criterion as "calibration **still** hits the D1 targets."

There is no baseline for "still." Node is not installed, so `node sim.js calibrate` has
never run on this machine. If the TypeScript port lands and calibration then comes back
off-target, there is no way to tell whether the port broke it or whether it was never
right — and that ambiguity is expensive to resolve after a five-file rewrite.

**Run the harness before the TypeScript conversion, and commit the output.** That output
is what Phase 0.5 is diffed against. It is a ten-minute job now and a multi-day
bisect later.

---

## Open items

1. **Install Node.** No longer optional — v3's entire stack is npm-based (Vite, React,
   Vitest, Capacitor). Nothing in Phase 0.5 can start without it.
2. **Capture the calibration baseline** before converting. See above.
3. **Team count** — Copy B uses 12 teams / 52 games; v3's performance budget references a
   56-game season. Reconcile.
4. **Season length** — Copy B's 91-day calendar ends at the regular season. Conference
   tournament, regionals, and Omaha are unbuilt in both copies. Phase 1 work.
5. **Data extraction** — v3 wants `src/data/{schools,conferences,names}.json`. Both copies
   hardcode name pools, towns, and school definitions as inline arrays.
6. **`PlayEvent` has no producer yet.** v3 defines the type as the engine↔3D boundary, but
   neither copy emits it. It needs adding to `game.ts` in Phase 0.5 while the file is
   already being rewritten.
