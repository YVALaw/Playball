# Roadmap

**Last updated:** August 27, 2026 · stages 1–5 shipped
**Supersedes:** v3, which by the end was wrong about most of what it claimed
**Companion docs:** `05-systems-reference.md` for what the game does today,
`06-backlog.md` for what it is going to do and why, `02-sim-engine-spec.md` for
engine internals, `04-implementation-plan.md` for the build log and the defect
register, **`07-v1-plan.md` for the staged route to v1.0** — which supersedes
the ordered list below now that the scope, the platform and the money are
settled — and **`08-handoff.md` for where the last session stopped and what the
next one picks up**, which is the file to open first.

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

**v0.7.4 plus five feature blocks, an audit pass, and an interface overhaul —
the loop is closed and the screens have been through a war.** Take a job from a
desk of genuine offers, play or simulate a season, manage a postseason run a
game at a time on a full-screen field with a defense on it, hand out awards,
spend coaching points, read a recruiting board that is honest about being
vague, argue the draft out of taking your junior, and start again in February —
against ninety-five rival programs run by men with careers of their own.
Twenty-eight test files cover it, calibration among them, so the engine cannot
drift without something failing.

The August 2026 interface overhaul and its feedback pass are described in §20
of the systems reference: first-visit tutorials that persist, the wire as a
newspaper, per-school annals, a standalone coach profile behind a portrait
menu, a colleges directory, preseason power rankings, roster filters, win cards
in June, a draft conversation in a sheet, and honest ball flight with fielders
who chase it.

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
- [x] First-visit tutorials that ride the save and merge on load, with a reset
      on the saves screen — §20.4
- [x] The wire as a newspaper: ten story kinds, hash-varied templates, zero
      random draws consumed — §20.1
- [x] Per-school annals written for all ninety-six programs every June, with
      the sitting coach's name on each year — §20.2
- [x] A rookie job market of real offers instead of a school browser — §20.3
- [x] SIM WEEK, SIM GAME with its 0.8s ring, tappable results, a preseason
      power ranking until RPI means something, roster filters, a colleges
      directory, and the coach profile standalone behind the portrait menu —
      §20.5–§20.9

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

**Progression and the draft**

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
per batted-ball type so a grounder and a fly are told apart at a glance. The
August passes closed the two items that mattered most; what is left:

- [x] **Fielders.** Nine dots in the other uniform: they hold their stations,
      the nearest man runs a ball in play down, and the throw comes back to the
      mound — §20.8. Presentation only, over the engine's own coordinate
- [x] **`frameloop="demand"`.** The canvas renders in a window after each play
      and holds its last frame between pitches — the battery item, closed in
      the audit pass
- [x] **An honest landing.** A double carries to the gap and a triple to the
      wall, whatever station the handling fielder keeps — §20.8. The park also
      gained foul poles, a capped wall, batter's boxes, on-deck circles and a
      scoreboard
- [ ] **Instanced markers.** Every runner and fielder is his own mesh. Twelve
      small spheres, so still harmless, and still not what was planned
- [ ] **Camera easing between three fixed positions.** There is one camera
      behind the plate and it never moves
- [ ] **A 2D/3D toggle.** The 2D diamond survives only as the fallback shown
      while the 3D chunk loads, or when WebGL fails. That is not a setting
- [ ] **Thirty frames a second on a mid-range Android, measured.** Never measured
      on any phone, because the game has never run on one

Park effects land here too: they were agreed as geometry rather than as a
modifier, so a short porch is something you can see. That makes them the reason
to invest in this track again, and nothing else on it is urgent.

### Everything else that is part-done

Two entries that used to sit here are done and gone: the draft's persuasion half
shipped as B9 (§14 — ages, eligibility, the four pitches, and since the
overhaul the whole conversation lives in a sheet the KEEP row opens), and the
coaching carousel shipped as B7/B7a (§16 — rival coaches improve, get judged,
get sacked and get poached). What genuinely remains part-done:

- [~] **Coach titles.** The ladder is honest (A11) and lopsided: seventy-one of
      ninety-six coaches read Journeyman at year thirty, because the counters
      run out below a conference title. B21 is the design brief — a named list
      of achievements per rung — and the feedback pass added that titles should
      eventually carry a small gameplay boost, explicitly not before the ladder
      itself is designed
- [~] **Eligibility.** Graduation and draft eligibility are real; redshirts do
      not exist anywhere in the codebase
- [~] **Android.** Safe-area insets are done and were done early, correctly. The
      hardware back button is not wired, because there is nothing to wire it to
      yet
- [~] **Accessibility.** Reduced motion is honoured throughout, and the overhaul
      added dialog semantics, Escape handling and focus restoration to the
      modals and sheets. Focus states elsewhere and text scaling are not:
      every size in the app is in pixels
- [~] **SIM SEASON.** On the dashboard for testing, scheduled to leave before
      v1.0

---

## What is next, in order

**This list is now a pointer.** The scope, the platform, the money and the
depth question were all settled in August 2026, and the route from here is
eighteen staged steps in **`07-v1-plan.md`** — which supersedes the ordering
that used to live in this section. What follows is the two-minute version.

The one decision that shapes all of it: **a player chooses how deep a game he
wants**, at coach creation and changeable after. The engine always models
everything; the mode decides what he is *asked* about, and anything that
touches the league is on for everybody or off for everybody. See *Decisions
locked* in `06-backlog.md`.

1. ✅ **Stop the game lying, and stop it losing things** — A13's elimination card,
   the tournament cards, a thirty-season soak, and resuming a game a phone call
   interrupted (H14).
2. ✅ **How you want to play** — the depth preset, per-system toggles, and the
   settings sheet that has never existed (H18).
3. ✅ **June, made legible** — cut the opening round, a modal for every title
   game, a real card for a champion instead of a stripe, tappable bracket
   games, postseason statistics, and telling a team when it is actually out
   (§I).
4. ✅ **Give the screen back** — the oversized roster filters, the recruit
   pipeline line, the prospect sheet, the offseason action button that moves,
   and the season record nobody can find (§I).
5. ✅ **The dugout** — the presentation rebuild and the bench coach taking
   over, in two modes: *watch*, and *auto* until something worth managing
   arrives (H15). Presentation only; no engine risk, and none taken. The
   ballpark's *look* — crowd, stands, lighting, as opposed to its geometry —
   was deferred to broadcast by request, and REPLAY is unbuilt (§K).
6. **The dugout's depth** — pitcher confidence beside the fatigue that already
   exists, mound visits, opponent scouting (H11, H12, §J6). Touches the
   simulation, so calibration applies. *Pitch calling is dropped — see §J.*
7. **The coach** — creation as an interview, offers that depend on your
   answers, personality badges, press conferences, a jobs board that opens only
   when the world says so, looking for work under contract, a proven winner's
   recruiting edge, the title ladder (H6, H7, §J1–J4).
8. **The roster becomes a roster** — depth chart, real DH, redshirts, position
   changes, academic eligibility, two-way players (H5, H10).
9. **Players as people** — injuries, season fatigue, playing time, morale,
   captains (H8).
10. **The transfer portal.**
11. **The economy, and the staff it pays for** — budget rebalance, swaying,
    facilities, and assistant coaches, who live with the money that buys them
    (H1).
12. **The world** — conference realignment, rivalry recognition, series stakes
    (H3, H4, H19).
13. **The dynasty remembers** — alumni in the professional game, signature
    moments (H2, H9).
14. **Broadcast** — big-moment presentation, sound and haptics, the wire
    upgraded, emblems, awards night (H16, H17, H20).
15. **The simulation's last mile** — run-expectancy AI, park geometry, the rest
    of the 3D track, the measurement debt.
16. **The store** — the S+ player and Play Billing.
17. **The phone** — Capacitor and an APK on real hardware. Deferred to here
    because there is no Android device yet; the two errands at the top of the
    plan are what keeps that safe.
18. **Ship.**

Stages 8 → 9 → 10 are a chain and cannot be reordered. Stage 2 is foundational.
Stages 12, 13 and 14 are independent and are the ones to move earlier when the
big systems get heavy. Stages 3 and 4 both came out of playing the game in
August 2026 and are cheap relative to what they fix; 5 and 6 are the old stage
5, split so the screen can land without the engine's tuning riding on it.

## Missing and unscheduled

Now scheduled: the small gameplay gaps that used to sit here — the depth chart,
facilities, recruits drafted out of high school, the run-expectancy AI — are
stage 7 above and catalogued in backlog G2. What remains genuinely unslotted:

- **Injuries and season-long fatigue.** Bullpen rest and in-game fatigue are
  modelled; nothing accumulates across a year. A section C design pass when it
  comes

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

One question, and the old file's three are not among them: NIL, park effects
and iOS are all settled above.

Answered since: **whether the seeded NCAA marks should be re-pitched.** They have
been. Each keeps its holder, his school and his year and carries a value set
where this league produces a season that beats it about once in fifteen to
twenty years — measured, not multiplied by a guess at the 1985 run environment.
Ventura's streak is still the one row nobody can touch. §13.3 has the table, the
method and the two measurement mistakes that hid the size of the problem.

Answered since, too: **which channels a badge may attach to** — twenty-three of
them, each naming one channel and one situation, §18.5 — and **whether the
recruiting asymmetry was intentional**. It was not. Every program's week now
comes off `weeklyBudget(stars, spentInJune)`, the same call the user's board
header makes, which was the precondition for letting the other ninety-five keep
drafted players at all.

- **The last percentage point of the walk deficit.** The eight-seed sweep reads
  walks 5.2% under target and only about half of that is accounted for. It is a
  game-level effect of the kind the pace channel turned out to be, and it wants
  the same treatment: isolate a channel, measure it against the sweep, dial it.
  §18.8

## Debt

- Four UI files — `Avatar.tsx`, `Player.tsx`, `Standings.tsx`, `TeamCard.tsx` —
  still carry a comment describing a **sixty-four program** world. It has
  ninety-six. The engine, the store, the world builder and the school data were
  swept; all that is left is comments, none of it reaches the player, which
  makes it cheap to fix and easy to keep forgetting
- `sim.ts parity` still prints a verdict off a thirty-point rating gap the shipped
  world never produces, and the verdict is wrong. The curve it should be read
  against is in `tests/parity-sweep.ts` (T1 in the implementation plan)
- The stale comments and vestigial exports catalogued in appendix A of the systems
  reference
- ~~`package.json` says v0.6.2 and the README still describes a thirty-three game
  season and a single autosave.~~ Both fixed

## The budgets

Held so far, and worth guarding — a performance regression found six months later
is a rewrite.

| Operation | Budget | Where it stood when last timed |
|---|---|---|
| Single game, headless | under 5 ms | ~0.4 ms |
| Full league season | under 3 s in a Worker | inside it by a wide margin |
| Screen transition | under 100 ms | never measured |
| Initial bundle, 3D excluded | under 250 KB gzipped | 203 KB gzipped (2026-08-26 build; 3D chunk 243 KB gzipped, loaded lazily) |
| 3D field on a mid-range Android | 30 fps during ball flight | never run on a phone |

The two engine figures are from the August calibration pass and have not been
re-timed since the fielding rework added a per-ball-in-play fielder lookup, which
is the first change in a while that could plausibly cost something.
