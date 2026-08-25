# Roadmap

**Last updated:** August 25, 2026
**Supersedes:** v3, which by the end was wrong about most of what it claimed
**Companion docs:** `05-systems-reference.md` for what the game does today,
`06-backlog.md` for what it is going to do and why, `02-sim-engine-spec.md` for
engine internals, `04-implementation-plan.md` for the build log and the defect
register.

---

## What this file is for

The two-minute view: what is built, what is next and in what order, and what was
decided against. Nothing here is a specification, and no number lives here.

The division of labour is worth stating, because ignoring it is what let this
document rot. **`05-systems-reference.md` describes the game as it is** and is
where a constant belongs. **`06-backlog.md` holds the decisions** — what is
agreed, what is still a question, and the argument behind each. This file holds
neither. It holds the order, and it points at the other two.

**How to keep it current.** A box gets ticked on the commit that earns it. A
ticked box is only worth having if it can be trusted, so the rule is the strict
one: tick nothing that has not been opened and looked at. Where the thing exists
but is not what the line describes, it gets `[~]` and a sentence saying what is
actually there. The previous version of this file carried sixty-two unticked
boxes, most of them describing work that had shipped months earlier, and the one
question anybody opens a roadmap to answer is "what is left".

## The pitch

You are the head coach of a college baseball program. Recruit high schoolers,
develop them, survive the MLB draft stealing your best arms every June, and chase
a national title. Games resolve at bat by at bat with text play by play over a 3D
diamond. Ninety-six programs in eight conferences of twelve, a forty-five game
regular season, and a career an athletic director can end. Ships to Android.

## Where it stands

**v0.7.3, and the loop is closed.** Take a job, play or simulate a season, manage
a postseason run a game at a time, hand out awards, spend coaching points, read a
recruiting board that is honest about being vague, lose players to the draft, and
start again in February. Twenty-one test files cover it, calibration among them,
so the engine cannot drift without something failing.

**What is missing is the phone.** There is no Capacitor project, no Android
build, no keystore, no store listing. The whole point of the project is a phone
game and the only thing it has ever run in is a desktop browser. That is the
largest single gap in the plan, and it is deliberately last — nothing else waits
on it, and doing it early means carrying a second build for a year.

## The stack

| Layer | Tech |
|-------|------|
| Language | TypeScript 5.7, `strict` and `noUncheckedIndexedAccess` from the first file |
| Build | Vite 5 |
| UI | React 19 |
| 3D | Three.js via React Three Fiber. No drei — the scene is primitives and flat colours and never needed the helpers |
| State | Zustand |
| Storage | IndexedDB via idb |
| Heavy sim | Web Worker over Comlink |
| Styling | One token sheet plus inline styles. CSS Modules were planned and never wanted |
| Testing | Vitest |
| Mobile | Capacitor, Android only. **Not set up** |

Three rules underneath it that have not moved and should not.

**The engine imports nothing.** No React, no Three, no DOM, no store. That
separation is why ten thousand games can be simmed from a command line and why
the front end could be replaced without touching the simulation. The plan called
for an ESLint boundary rule; `tests/architecture.test.ts` does it instead, which
was cheaper to write and fails louder.

**Determinism is protected.** The seed and the generator's position both ride the
save, so a resumed dynasty replays rather than diverging, and a bug report is
reproducible. Adding or removing a random draw in player generation moves every
downstream number in the game; the goldens exist to catch exactly that.

**The mockup is the design.** `design/Dynasty Mobile.dc.html`. Where anything
disagrees with it, it wins. The scorebook palette this document used to argue for
was never adopted and the argument has been deleted rather than left to mislead.

---

## Done

Ticked means opened and checked, August 2026. Detail on any line is in
`05-systems-reference.md`, cited by section.

**The engine** — §9

- [x] Generalized log5 plate appearance model, with pitch sequencing constrained
      to land on the outcome; the free pitch model survives as a comparison
      instrument and is not what ships
- [x] Calibrated against sourced Division I rates, over twelve independently
      generated roster pairs rather than one, so a result is a property of the
      engine and not of twenty-three particular players
- [x] Walk-offs, the run rule, the tenth-inning tiebreaker, no re-entry
- [x] Baserunning, steals with a real catcher behind them, double plays,
      sacrifice flies, passed balls
- [x] Individual fielders — range, hands, arm and throwing accuracy, with two
      error paths splitting one calibrated total, and a per-player fielding
      line — §10
- [x] Fatigue, times through the order, and the AI's hook
- [x] `PlayEvent`, so the 3D layer reads geometry and never asks the engine what
      to draw. The event stream takes no random draws: watching a game must not
      change it

**The season and the world** — §8

- [x] Ninety-six programs, eight conferences of twelve, forty-five games
- [x] Schedule generator, day-by-day loop, standings, leaderboards, RPI
- [x] Conference tournaments, regionals, a national final, and awards decided by
      how loud the story was rather than by a precedence list — §7
- [x] `npm run sim -- season` prints a full year headless

**The app**

- [x] Zustand store, IndexedDB persistence with schema versioning, and a load
      that fails honestly rather than half-working — §11
- [x] Season simming in a Worker with progress, so a phone does not freeze
- [x] Bottom navigation, four tabs, thirteen screens, and an offseason that walks
      through its phases in order
- [x] Design tokens, safe-area insets, reduced motion
- [x] Named save slots on top of the autosave, with no limit
- [x] The 2D diamond (`src/ui/Diamond.tsx` — never `Field2D.tsx`), the play log,
      and box scores that can be reopened in September

**The career** — §5, §6

- [x] Program prestige, coach prestige and job security tracked apart, because
      conflating them is what makes career modes feel arbitrary
- [x] Mandates, a checklist the board actually judges on, verdicts, contracts,
      and being sacked
- [x] Four coach skills wired to things the engine already does, at deliberately
      small magnitudes
- [x] Job offers and a hiring ladder that discounts a proud program with a gutted
      roster
- [x] Program history, a league-wide record book seeded with real NCAA marks, and
      a hall tab — §13

**Recruiting** — §1, §2

- [x] A national class by state and region, with stars and rank that both carry
      projection error
- [x] Scouting reports as bands rather than numbers, one shared bias per sheet so
      the estimate cannot be averaged away, and two prose lines that are vague but
      never false
- [x] Five priorities per recruit, a reach gate that will refuse your call, fit
      that multiplies effort instead of adding to it, a weekly budget, and
      ninety-five rival programs working a board of their own
- [x] Signing day, and a verdict that judges your report rather than the recruit

**Progression and the draft** — §12.5

- [x] Development and decline between seasons, walk-ons filling unspent
      scholarships, graduation
- [x] The MLB draft takes players every June, underclassmen included above hard
      bars

---

## Half-built

Each of these exists. None is the thing the old plan claimed. This section is the
one that keeps the rest of the file honest.

### The 3D field

`src/ui/Diamond3D.tsx`. It is lazy loaded and code split, the park is primitives
and flat colours with no lights at all, device pixel ratio is capped at 1.6, and
the ball flies along the engine's own landing coordinate with a separate profile
per batted-ball type so a grounder and a fly are told apart at a glance. What the
plan listed and never got:

- [ ] **Fielders.** There are none in the scene. Runners and the ball, and
      nothing else stands on the field
- [ ] **Instanced markers.** Every runner is his own mesh. Harmless at three of
      them, and not what was planned for nine
- [ ] **Camera easing between three fixed positions.** There is one camera behind
      the plate and it never moves
- [ ] **`frameloop="demand"`.** The canvas renders continuously, including
      between pitches when nothing has moved. This is the item with a real
      battery cost on the target device
- [ ] **A 2D/3D toggle.** The 2D diamond survives only as the fallback shown
      while the 3D chunk loads. That is not a setting and not a choice
- [ ] **Thirty frames a second on a mid-range Android, measured.** Never measured
      on any phone, because the game has never run on one

Park effects land here too: they were agreed as geometry rather than as a
modifier, so a short porch is something you can see. That makes them the reason
to invest in this track again, and nothing else on it is urgent.

### Everything else that is part-done

- [~] **The MLB draft.** Departures are automatic and the coach has no say. The
      persuasion half — reading what a man wants and paying for him out of the
      recruiting budget — is agreed and unbuilt (backlog B9, and it needs ages
      first)
- [~] **The coaching carousel.** You move between jobs; nobody else does. Rival
      coaches never improve, are never judged and are never poached, so you are
      the only coach in ninety-six programs who gets better (B7)
- [~] **Eligibility.** Graduation and draft eligibility are real; redshirts do
      not exist anywhere in the codebase
- [~] **Android.** Safe-area insets are done and were done early, correctly. The
      hardware back button is not wired, because there is nothing to wire it to
      yet
- [~] **Accessibility.** Reduced motion is honoured throughout. Focus states and
      text scaling are not: every size in the app is in pixels

---

## What is next, in order

The ordering principle is that a system should not be built on top of data that
is known to be wrong, and that the things a player touches come before the things
that surround them.

1. **The data-integrity bugs.** Backlog section A, and A5 first: a departing
   player's last season never reaches the record book, so every graduating
   senior's best year has always been lost. A hall of fame reading that book
   would honour the wrong men, which is why this comes before the hall of fame
   and not after it.

2. **Ages, then a draft you can argue with.** B15 then B9. Ages are small and
   they are what makes the eligibility rule express itself honestly instead of as
   a special case; the persuasion mechanic is the first place the recruiting
   budget has to do two jobs at once, and that tension is the point.

3. **Badges and tendencies.** B10, B11, B16, B17. The largest addition to the
   hidden layer, and the one that gives two players with the same ratings
   different identities. Every badge that ships gets a row in the hidden
   mechanics index on the day it lands — that rule is not negotiable, because an
   invisible system nobody wrote down stops being a design and becomes folklore.

4. **The rest of the career.** Achievements, coach titles, conference and
   regional honours, rival coaches with careers of their own, hall-of-fame
   induction, league-wide career records. B3 through B7, B12, B13.

5. **The postseason, rebuilt.** Top four in the country straight into an
   eight-team national tournament, sixteen more into four regionals of four. The
   shape and the reasoning are in the backlog. It comes after the player-facing
   systems on purpose: today's format works, and a bracket rewrite pays off less
   per week than anything above it.

6. **The depth systems, one design pass each.** Backlog section C — the transfer
   portal, injuries, morale, scouting reports, a progression rework and the rest.
   Listing them is not designing them, and none may be built before it has been
   specified on its own.

7. **Shipping.** Capacitor, a first APK on a real device, the back button, a
   keystore generated and backed up somewhere permanent, a signed AAB, a store
   listing, onboarding for the first ten minutes, and the accessibility work.
   Last, and blocking nothing. Onboarding is sized against the game as it will be
   by then, which by that point includes scouting bands, philosophies, badges and
   a record book to explain.

## Missing and unscheduled

Real gaps with no slot yet. Each is small enough to fold into a stage above when
somebody wants it.

- **A depth chart with position eligibility.** There is a lineup editor; who can
  credibly play where is not modelled
- **Facilities to spend on.** Facilities exist as something a recruit weighs and
  nothing else — there is no upgrade and no budget for one
- **Recruits drafted out of high school who never arrive.** Signed, then gone
  before they play a game. Cheap to build, and it stings in the right way
- **An AI that reads a run-expectancy matrix.** The opponent calls only the
  sacrifice, on a heuristic. This is the difference between a manager who bunts
  by rule and one who bunts when the base-out state says to
- **Injuries and season-long fatigue.** Bullpen rest and in-game fatigue are
  modelled; nothing accumulates across a year

## Deferred, and why

| Decision | Why |
|---|---|
| **NIL and revenue sharing — skipped** | The recruiting budget is the only currency and it already does two jobs, signing a class and keeping a drafted player. One currency the player understands beats two he has to learn |
| **iOS — not now** | Capacitor could do both. iOS needs a Mac and a paid developer account, and neither is worth carrying before the game is finished |
| **Two-way players** | Still out. Nothing has changed the argument |
| **The S+ store player** | Deferred to v1.0. The cap that reserves the grade for him is built and tested; he is not |
| **The live scorebook cell** | The one idea worth keeping from the old design section, and never built. It is a nice thing rather than a needed thing, and the mockup does not have it |

Backward compatibility is explicitly **not** a constraint. Testing runs from
fresh saves, so a change may require a new dynasty rather than a migration. That
is not licence to corrupt a save quietly — a load must still fail honestly.

## Still open

Three questions, and the old file's three are not among them: NIL, park effects
and iOS are all settled above.

- **Whether the seeded NCAA marks should be re-pitched.** Seven of the twelve are
  out of reach of the engine's run environment — they were set with aluminium
  bats and the calibration targets are modern Division I. Scaling by games played
  does not close that. The gap is written down with numbers so it can be argued
  about rather than rediscovered (§13.3)
- **Which channels a badge may attach to**, and how a situation is defined in
  engine terms. Tiers, caps and earning routes are agreed; this is not
- **Whether the recruiting asymmetry is intentional** — AI programs allocate
  against a flat weekly budget while the user's scales with prestige

## Debt

- Source comments across the engine, the store, the world builder and two screens
  still describe a **sixty-four program** world. It has ninety-six. One of them
  is player-facing prose on the wire screen
- `sim.ts parity` still prints a verdict off a thirty-point rating gap the shipped
  world never produces, and the verdict is wrong. The curve it should be read
  against is in `tests/parity-sweep.ts` (T1 in the implementation plan)
- The stale comments and vestigial exports catalogued in appendix A of the systems
  reference
- `package.json` says v0.6.2 and the README still describes a thirty-three game
  season and a single autosave. Both are behind the code

## The budgets

Held so far, and worth guarding — a performance regression found six months later
is a rewrite.

| Operation | Budget | Measured |
|---|---|---|
| Single game, headless | under 5 ms | ~0.4 ms |
| Full league season | under 3 s in a Worker | comfortably inside it |
| Screen transition | under 100 ms | not measured |
| Initial bundle, 3D excluded | under 250 KB gzipped | not measured |
| 3D field on a mid-range Android | 30 fps during ball flight | never run on a phone |
