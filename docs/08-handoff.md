# Handoff

**For whoever picks this up next — human or agent.**

This file is the running answer to two questions: *what was just done* and
*what happens next*. It is rewritten at the end of every working session, so
the top of it is always current. Everything older lives in git.

**Last session:** September 5, 2026 · **Branch:** `main` · **pushed
through the interface pass (`8d97eb9`) and the docs commit after it.**

> **September 5 — the interface pass, merged and read.**
>
> The reporter had the whole interface rebuilt outside the repo, against a
> copy of the tree with no npm packages, and handed the folder over. It is
> sixty-seven files and eight thousand lines: every screen onto one written
> interaction language (`docs/INTERACTION_DESIGN.md` — data surfaces stay
> dense, a decision shows state → context → tradeoff → consequence → verb, a
> story leads with the result), Program as a dashboard with four doors,
> Budget as a Plan · Staff · Facilities · Network workspace, History as
> three rooms, the player card as four sheets, Decisions sheets in place of
> every sliders icon, hold feedback on the lineup, a postseason frame, and
> the offseason's seven circles replaced by a roadmap. On the engine side,
> four systems nobody had booked — assistants who develop, a coaching tree
> that rides a job move, recruiting pipelines as 0–100 program assets, three
> levels per building — and replay, captured off the real event stream.
> `05` §50 is the account, checked against the code rather than the pass's
> own notes.
>
> **It had never been compiled where it was written.** Five type errors
> came out of the merge: Today's "This week" tiles called a `setScreen` hook
> the rewrite had removed (a ReferenceError on tap), and History's Alumni
> grid handed string keys to `openPlayer`. Fixed with the idioms the new
> code already used, then: type check clean, build clean, 1,133 tests across
> 54 files, and a career walked from the front door to Today, Schedule,
> Standings, Program and Roster with no runtime errors. **The rule for any
> future outside pass: it is done when `npm run check` says so here, and
> not before.** The APK was not rebuilt.
>
> **Then it was read twice, file by file, and `06` §X is the batch.** The
> five to take first: the Staff room's `Replace` button cannot fire because
> `hireAssistant` still refuses a filled seat; the rotation "heal" rewrites
> any honest spare starter as a reliever for life, because progression has
> always parked surplus SPs in the bullpen with no `homeRole`; the winter's
> staff development and AD hires never re-sync the coach mods, so the games
> play a whole season on last year's staff; the AD's auto-build stores a
> stale rung; and the portal's REVIEW SIGNING sheet has no layout at all.
> Two to **measure before deciding**: replay now stores every pitch of every
> user game on the box, on every save, against a 12.3 KB-a-year budget
> nobody re-measured; and the user's home state now pays 15% more recruiting
> fit than any AI program's, undocumented. Then the seams — three bottom
> sheets that declare `role="dialog"` and trap nothing, a hold haptic that
> ignores the setting, a rail scroll that ignores `wantsMotion()`, the
> coaching-tree list with no CSS, a screen's worth of dead CSS including the
> "command card" the pass's notes describe and never built.
>
> **Then the bugs were fixed, the same evening** (`06` §X, "Fixed the same
> evening"): Replace fires, the rung reads the updated list, the heal is
> withdrawn and its test inverted, the winter's staff is priced onto the
> new benches before the set, the portal sheet has a floor, and the small
> ones — the haptic, the rail's motion gate, the book count, the cap, the
> takeover's slide, the surface's reduced-motion pair. Three store tests
> pin the three that no screen walk could reach. The reporter also settled
> two stages: **20b was already built** (`argueTerms`) and **25 is closed**.
> What is left of §X: the two measurements, the accessibility trio, the
> dead CSS and the cleanups.
>
> **Two things the pass decided on its own, now recorded as decisions:**
> the plant has three levels per building (the morning's item 32 had
> settled on once apiece — superseded, and accepted), and the five-question
> situational interview is gone from the UI in favour of a background
> picker, which leaves `interviewResult.ts` with no caller and stage 24's
> reveal to decide which pool it builds on.
>
> **Where the work stands.** Stages 1–16, 18, 20 (with 20b), 21–23 and 25
> shipped; the APK list closed the morning of September 5. Left: the rest
> of §X → the rest of 24 (the reveal and the result card) → 26's verdict
> from the reporter → 17 → 19. **The test aids are back on purpose**
> (`docs/TESTING_SHORTCUTS.md`) and leave together in 19.

> **September 4 — the September run, then the app itself.**
>
> Stages 20 through 23 shipped in order: the season opener reorganised into
> one sectioned card whose only door is the board (where TAKE THE SEASON now
> lives); the two-way made whole and then *corrected to the rulebook* — on his
> pitching night the nine is the eight field spots plus him, the DH sits on a
> bench that grows a seat to hold him, and nobody ever fields without batting;
> playbooks, where scouting finally became leverage (eight controls at three
> options each, all computed, and the 3D stations move with the applied book);
> and the lineup gate, where a short nine holds the door.
>
> Then the game became an app. A web manifest and a launcher icon drawn in
> code (there is no image library in the tree), Capacitor, and an APK — built
> against a toolchain assembled by hand, because the winget Android Studio
> package installs the IDE and not the SDK, and the SDK's own wizard cannot be
> driven headlessly. Nothing is installed system-wide: `npm run apk` supplies
> JAVA_HOME and ANDROID_HOME itself. The hardware back gesture learned to peel
> one layer per press, written against the History API so one handler serves
> the APK, the browser and the home-screen icon alike.
>
> **Two things went wrong that the next session should know about.**
>
> First, **the suite was reported green when it was not.** Runs were piped
> into `tail`, so the exit code being read was tail's — always zero — and two
> progression tests failed unnoticed from stage 21 onward. Both turned out to
> be assertions that could not hold: a boom GENERATED at the potential cap has
> no room to rise, and "no program anywhere lost nobody" contradicted its own
> comment about quiet Junes. **Always capture vitest's own exit code.**
>
> Second, **stage 21 shipped a real bug twice.** The engine was right — the
> two-way pitched and batted — but every label came off the roster instead of
> the night, so the box put him in left field and his cover at a second centre
> field. `TeamState.playedAt` now records where each man actually stood, off
> the field map the simulation itself reads.
>
> **Where the work stands.** The APK report (`14-apk-report-triage.md`) is
> thirty-six items in five batches. Batch R — the regressions — is half done:
> the two-way box, the inbox layout, and the lineup gesture are fixed and
> pinned. **Still open in R:** the swap/AUTO animation flicker, the fielder
> rims blinking when two men are close, the postseason box score not opening,
> the mandate reading 17 on the opener and 23 on the board, and the dossier
> not scrolling. Batches S (density), T (deletions — every red line in
> `13-phone-report-pending.md` is a CUT, not a rewrite), U (behaviour) and V
> (the dugout's missing motion) are untouched.
>
> **The gesture rule, decided and applied:** tap selects, tap again puts down,
> **hold** reads the man. Never double-tap — allowing it taxes every tap,
> because none can act until the window for a second has passed.

> **September 2, late night — the sorting session and the batch it opened.**
> Every open decision was answered in one sitting (`06` §U), four fresh test
> findings were fixed on the spot (the guided glow, the desktop frame fix,
> the walk clip, the dugout FAB's close), and then the whole next batch
> shipped before the night ended: June's two rooms (the pregame show and the
> one-map bracket with the drop marked, `05` §45), the depth chart removed
> with secondary positions joining the player card, realignment held to the
> region or next door, and the healed-return hold. Two-way players finally
> got a home (stage 16, now large). 1,054 tests.

> **September 2, the evening batch.** The reporter played the morning's build
> and filed nine items with screenshots; everything shipped the same evening
> (`05` §44, `06` §T). The headline is a reversal worth remembering: the
> morning's adopt-on-every-route position rule lasted one afternoon of play —
> manual moves now relabel nobody, the automation adopts and remembers
> (`homePos`), the bench sends a man home, and a broken card warns instead
> of self-correcting. Also: the bracket holds on a hurt starter (FIX THE
> LINEUP), the tournament modal pile thinned to one card per beat, the
> college profile out from under the bar and off the duplicate panels, the
> player card's stats split into the two books (with the new
> `CareerYear.june` engine split), the sliding indicator on all three tab
> strips, legends for the history and the Book, and the first two
> secret-leaking captions scrubbed. Staged: June injury rolls (goldens) and
> the star-portal rarity knob into 16, the assistant's wire-watch mail into
> 15.5.

> **September 2, in one paragraph.** The reporter played against the iOS
> competitor and filed twenty-seven items; the session before it produced the
> field study (`10-field-study.md`) and a batch of adopted craft items. What
> shipped: the board's ask frozen at February (`boardAsk`), the press room
> removed whole, positions made a true set with slot adoption and rail
> appointments, AUTO reworking the rotation, screen transitions that hold the
> outgoing screen (the black flash was `--backdrop` through a crossfade dip),
> the tonight card to the reporter's sketch, the confirm grammar
> (`Confirmable`/`DidButton`), the intro that retires, and a dozen smaller
> fixes — all in `05` §43 and `06` §S. **The plan artifact was found one
> session stale and republished** — the Sept 1 repo edit had never been
> pushed to the URL; check the live copy after every scope change, not the
> file. Parked with arguments in `06` §S: scouting tendencies, inbox rework,
> portal balance, hidden-secrets scrub, development arcs (2K-style bands,
> expressed through play), the recruit board density pass, and the
> postseason redesign the reporter is still sketching.

> **Read this first if you are picking up after the port.** Stage 10.5 shipped,
> and it shipped differently than planned: instead of a written rule set, a
> full mockup (the Roster Tabletop proposal, vendored at `design/Roster
> Tabletop/`) became the design of record. Its stylesheet is **generated** into
> `src/ui/prototype.css` by `scripts/adapt-prototype-css.mjs` — edit the
> script's transforms, never the generated file — and `src/ui/prototype-frame.css`
> holds the hand-written joins. Five rounds of phone testing then drove: dark
> mode (tokens only — never give a colour its sole definition in one theme's
> block), the team-colour accent (`src/ui/accent.ts` fills hooks the tokens
> read), every sheet/dialog portalled into the app frame (`InFrame` in
> Overlay.tsx — absolutely-positioned layers inside iOS momentum scrollers are
> a bug factory; five separately-reported faults were this one cause), the
> desk that holds until red needs are resolved, the captain's C, the job
> market, and program actions with save-backed watchlists.
>
> Lessons that bind future work: a FieldNote-class component must state its
> own ink (it inherited white inside dark panels); `.settings-list button`
> taught that a container styling every descendant button will eventually eat
> a Segmented; and the live journal / pendingGame must be cleared at the year
> roll or last season's interrupted game haunts opening day.

---

## Read these first, in this order

| File | What it is |
|---|---|
| `07-v1-plan.md` | **The route.** Twenty-six stages to v1.0. Twenty-one are done; the §X review batch, then 24, 25, 20b, 17 and 19 remain. |
| `INTERACTION_DESIGN.md` | **The interface rulebook**, since September 5. Three kinds of screen and what a decision must show before it offers a verb. Read before adding any screen. |
| `06-backlog.md` | The decisions and the argument behind each. §H is the agreed feature set, §I the pass that produced stages 3 and 4; *Decisions locked* holds the rules that bind every feature. |
| `05-systems-reference.md` | What the game does **today**, including the hidden-mechanics index. A feature that shipped moves in here on the same commit. |
| `01-roadmap.md` | Two-minute view. Its ordered list is now a pointer at `07`. |
| `artifacts/playball-v1.html` | **The published plan.** Same content as `07`, as a page, at <https://claude.ai/code/artifact/072559a8-d9a1-445b-851e-bb15364f49ab> — republished September 5 with stages 15–26 and the interface pass. See the rule below — it is not optional. |
| `10-field-study.md` | **The shelf we are joining.** Who else ships a college dynasty for a phone, how it is built, what its reviewers complain about, and the Android numbers the port has to hit. Read before starting stage 16. Published at <https://claude.ai/code/artifact/7a0673b7-a52a-4f1f-bb7d-c495437e5658> from `artifacts/playball-field-study.html`. |

### The artifact is part of "done"

The v1.0 plan is published as an artifact and **that is the copy actually being
read**. It has drifted from the repo once already, showing fifteen stages with
stage 1 unstarted while the code had moved well past both.

So: **when a stage closes, or when scope is added or dropped, the artifact is
updated in the same pass as the markdown.** Its source is
`docs/artifacts/playball-v1.html` — edit that and republish to the same URL,
which keeps the link stable. Publishing a new file path would create a second
artifact and split the record in two.

**The house rules that are not negotiable**, all of them earned the hard way:

- **The engine imports nothing** — no React, no Three, no DOM, no store.
  `tests/architecture.test.ts` enforces it.
- **Reporting never changes what happens.** The wire, the play-event stream and
  the landing coordinates all take zero random draws. Tests pin it.
- **Determinism is the product.** The seed and the generator position ride the
  save. Adding or removing an `rng()` call moves every number downstream.
- **The depth mode never reaches into the engine.** See below — this one is now
  load-bearing for everything still to be built.
- **A card is a visual telling of where you are and what you achieved, in
  simple wording. A card does not explain.**

---

## What was just done — stages 1 to 4

**799 tests, thirty Junes with nothing broken, all four exit conditions met.**
Full detail is in the systems reference: §21 (stage 1), §22 (stage 2), §23
(stage 3), §24 (stage 4). The short version and the parts worth carrying:

### Stage 1 — the game stopped lying and stopped losing things

A thirty-season soak (`npm run soak`), the A13 elimination card, tidied
tournament cards, and **resume-by-replay** for an interrupted game in both the
regular season and the postseason. A `LiveGame` is a coroutine and cannot be
serialised, so it is journalled and replayed: the generator's position at the
first pitch plus every call since. The journal lives in `localStorage` because
the event it survives is an OS kill, where a pending async write is a lost
write.

### Stage 2 — two ways to play

Coach creation asks, second, how much of the game you want to be asked about.
**The rule the whole feature rests on: the engine always models everything; the
mode changes what the player is asked, never what the simulation does.** Casual
does not turn the bullpen off — it hands it to a pitching coach, which is what
the other ninety-five programs have always had. A casual save and a full save
are the same world.

Two rules follow and both bind future work: anything touching the whole league
is not a preference, and only *disagreements* with a preset are stored so a
career picks up the preset's answer for systems added later.

Casual handles lineups and the pen today, silently. The engine side is one
boolean — the half-inning already knew how to run either dugout automatically.

Settings live behind the portrait with saves folded in, split between what
rides the save (how you play) and what rides the device (text size, field,
motion, sound). **Text size is real**: all 582 font sizes now go through
`calc(<n>px * var(--ts))`.

### Stage 3 — June, made legible

**The opening round is gone.** It cut twenty teams to sixteen with
best-of-threes, and its real sin was being a single-elimination gate in front of
a double elimination tournament — win your conference, win your regional, lose
one series, done. Those eight teams now play their way in *inside* the winners
bracket, where losing drops you to the losers side. Two ten-team halves,
eighteen games each and nineteen with the reset, which is arithmetic rather than
a chosen number.

`doubleElim.ts` now expresses both shapes as **routing tables**; the eight-team
table is a transcription and the existing tests are the proof of it.

The screen: a champion card at the top at three intensities, tappable bracket
games, a title-game announcement that says what winning takes, an elimination
letter beside the card, the bottom nav back in June, and **postseason statistics
for all ninety-six programs** with career totals that survive the year roll.

### Stage 4 — giving the screen back

Roster filters behind an icon, the pipeline paragraph reduced to a mark, a
bigger prospect sheet, the record out of the small print, and the offseason
action button pinned. That last one took two attempts and the second is the
honest fix — see §24.1 before touching `Sticky.tsx`.

---

## What is next — after the port

**Stages 11–14 shipped August 31 (see 07-v1-plan for each shipped account).**
**Stage 15, the ballpark, is the next unbuilt stage** — the 3D park's deep
work plus the presentation debt it inherited: REPLAY and the tournament view
(both deferred there by the reporter). **The throttled browser performance
profile is genuinely blocking it** — stage 15 redesigns around a larger 3D
field, and a frame-rate disaster changes the design, not the code. The Play
Console record errand stands (registration done long ago, per the reporter).

**The September 1 beta audit** (two hands-on seasons at Passaic Falls, the
lowest chair, everything through real actions): the systems hold. Fixed on
the spot: the draft metric that called graduations "DRAFTED", a setStrategy
runtime guard, the Program tab scroller, the injury manual-cover rule (the
old must-need was dead code), and the broadcast classifier (whole contact
classes were silent; catches now land with the flight). Reported, not
fixed: **the PSC godsquad hack won back-to-back national titles in a world
the user never touched — it must come out in stage 16**; year-1 floor
mandates require not-last and are near-unpassable at prestige 19 (make it
a bonus in the bottom quartile); realignment ignores geography (Piedmont
to the PACIFIC) and should prefer adjacent regions; the recruiting board
never tells you a bid is losing. Full ledger in the session scratchpad
(audit-findings.md) and summarized in the commit.

Stage 14 notes that bind future work: `sound.ts` is name-keyed — a better
recording is a file swap; `prep-sfx.mjs` re-processes the raw downloads from
`C:/Users/cronu/Downloads` if they are ever replaced; **the freesound
licenses must be verified before store release** (`public/sfx/CREDITS.md`,
CC-BY needs shipped credit, NC cannot ride with paid IAP). The reporter owns
the phone taste pass on volumes and haptics. `Crest.tsx` is pure hash — do
not add drawn randomness or crests will restyle between sessions. The
takeover funnel is `offerBigMoment` (ranked; never set directly), fed by
`endManagedGame` and `closeMyBracket`. The awards ceremony lives only on the
offseason step (`phase !== null`); every later visit is the plain list.

**Agreed with the reporter, queued (September 1):** position changes get
real depth ON THE PLAYER PROFILE (the chart-vs-lineup question is open —
the reporter is considering folding the depth chart into the lineup tab
entirely; do not invest in the chart screen until that lands). The inbox
gets a noise pass later (it now wipes at every year roll). Two more
TESTING fixtures now exist and must ship out together: the PSC godsquad
and **Hans Hood** (recruiting.ts generateClass — a 20-overall/99-potential
3B in every class, for progression testing of the planned wonder-guy
archetype).

**September 1, second half.** Position fit now reaches the simulation (see
the shipped account in 07 and tests/posfit-probe.ts): the nine are assigned
to nine distinct spots and each pays fieldingAt for where he stands. It
landed with NO re-calibration because a sound nine assigns to itself — that
identity property is the thing to protect if anyone touches the assignment.
The college profile was ported (its private copies of the six programme
leaves are in the Kit now). The dark theme was measured and re-laddered.

**Deferred by the reporter, September 1:** The Room and the storyline engine
(the artifact proposal stands if either is revived). **Added instead:**
stage 15.5, the voice — a copy pass over every user-facing string plus the
recruiting-report rework (one line pool per potential letter, ~120 lines to
write, so the report becomes learnable). The inbox noise pass folds into it.

**Still open and unowned:** prestige runs away to the mid-90s for a handful
of programmes over 30 seasons (measured; predates the Sept 1 balance pass —
do not blame quality drift for it). Position changes from the player profile.
The lineup/depth-chart merge the reporter has not decided on.

**Loose ends deliberately left:** the tournament/bracket view (stage 15, with
the park — school crests join the bracket there); the Saves screen's deeper
restyle; `SigningDay`'s sheet framing (interiors are ported, the panels still
carry ~50 token-based style objects); REPLAY (stage 15); two-way players
(with the DH-decline case); freesound license verification before the store.

## What was next as of August 27 — stages 5, 6 and 7 (kept for history)

**The old stage 5 was split, so there are eighteen stages now.** The reason is
worth keeping: the dugout rebuild is presentation over a stream the engine
already emits, while mound visits, confidence and scouting all reach *into* a
calibrated simulation. Putting them in one stage meant a tuning problem in the
last item could hold up a screen that was already finished.

**Stage 5 — the dugout.** The presentation rebuild plus the bench coach taking
over (*watch*, and *to the next moment*). No engine risk at all. **Take the
throttled browser profile first**: this rebuilds the dugout around a *larger* 3D
field, and a frame-rate disaster there changes the design rather than the code.

**Stage 6 — the dugout's depth.** Pitcher confidence beside the fatigue that
already exists, mound visits that give it something to be for, and opponent
scouting. Both new channels get the treatment the pace channel got: isolate,
measure against the calibration sweep, dial. `moundVisits` and `scouting`
already have greyed rows waiting in `state/depth.ts`.

**Stage 7 — the coach**, and it is bigger than the old brief. Beyond the
interview, the badges and the title ladder, it is where the job market stops
being something that happens to you: offers that depend on your interview
answers rather than the same six schools every career, a JOBS tab that opens
only when the wire says a chair is genuinely going, looking for work while
under contract, and a proven winner recruiting better. `06-backlog.md` §J has
the argument for each.

**Two things decided in that planning pass that bind later work:**

- **Pitch-by-pitch calling is dropped from v1.0** — not deferred. The engine
  resolves a plate appearance with log5 and *then* sequences pitches backwards
  to match, so a called pitch could not change anything already decided. §J
  records the three rejected ways out. Its greyed row comes off the settings
  sheet.
- **Assistant coaches moved to the economy stage**, because they are paid from
  the program's money and should not ship first on a budget invented for them.

There is still no Android device, so the phone stage stays deferred; the
emulator pass can be pulled forward at any time.

---

## Open questions carried forward

- **Title concentration.** Nine or ten distinct champions in thirty years,
  against a real-world sixteen. Measured across five worlds (9, 10, 9, 10, 9),
  so it is the format rather than noise, and cutting the opening round did not
  move it. It is a deliberate decision waiting to be made, not a bug —
  `06-backlog.md` §F. **The soak's canary was mis-set at exactly the observed
  value and fired on noise; it is `years / 5` now**, which catches a collapse
  instead of the weather. `npm run soak -- 30 <seed>` runs another world.
- **Save growth: 12.3 KB a year**, unchanged by the postseason stat split.
- **The Play Console record and merchant account.** Still the only unpredictable
  wait in the plan and it needs no phone.

## Test aids currently in the build — remove before v1.0

Three, all marked `TESTING ONLY` in code, all listed in
`docs/TESTING_SHORTCUTS.md`, removed September 4 and put back September 5
so the new interface could be played a season at a time:

- **SIM THE SEASON** on Today (`Today.tsx`, the TEST BUILD strip).
- **The guaranteed Pascagoula Tech offer** (`NewGame.tsx`).
- **PSC's five 99s** (`store.start`). Gated out of vitest.

Hans Hood, the fourth, is gone for good — `ensureHoodHans` no longer
exists. Stage 19 removes the three together.

## How to work here

```bash
npm run check      # typecheck + the whole suite (1,133 tests, 54 files)
npm run soak       # thirty seasons of structural audit
npm run dev        # dev server, hot-reloading, on :5174
npm run build      # typecheck + build into dist/ — builds only, serves nothing
npm run preview    # serves the frozen dist/ build on :5173
npm run balance    # calibration probe
npm run carousel   # coach turnover probe
```

**The two ports are not interchangeable, and swapping them loses careers.**
Dev is **:5174**, the frozen build is **:5173**, both bound to every interface
so a phone on the same wifi can reach them. Saves live in IndexedDB, which is
scoped to an origin — and the origin includes the port — so a dynasty played at
`:5173` is simply not present at any other port. The app there works perfectly
and shows an empty new-dynasty screen, which reads exactly like a broken build.
`vite.config.ts` carries the full argument.

Verify UI work by driving the DOM — under Vite dev, a dynamic `import()` of the
store often returns a *different* module instance than the app's, so store
handles read stale. Measuring beats eyeballing: stage 4's button bug was found
and confirmed fixed by reading `getBoundingClientRect()` against the frame, not
by looking at it.

**Commit style:** narrative first line, prose body explaining the *why*, ending
with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer.

**Verifying in the Browser pane:** if the pane is hidden, animation frames
do not run and the store's crossfade commits one event late — every
navigation reads as the *previous* one. That is the pane, not the app;
front the tab or read `getBoundingClientRect()` rather than chasing it.
PowerShell here-strings break on apostrophes — use `git commit -F <file>` or a
bash heredoc.
