# Handoff

**For whoever picks this up next — human or agent.**

This file is the running answer to two questions: *what was just done* and
*what happens next*. It is rewritten at the end of every working session, so
the top of it is always current. Everything older lives in git.

**Last session:** August 30–31, 2026 · **Branch:** `play-batch-2` · pushed
per stage (the reporter authorized pushing on August 31).

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
| `07-v1-plan.md` | **The route.** Seventeen staged steps to v1.0. Stages 1–4 are done; stage 5 is next. |
| `06-backlog.md` | The decisions and the argument behind each. §H is the agreed feature set, §I the pass that produced stages 3 and 4; *Decisions locked* holds the rules that bind every feature. |
| `05-systems-reference.md` | What the game does **today**, including the hidden-mechanics index. A feature that shipped moves in here on the same commit. |
| `01-roadmap.md` | Two-minute view. Its ordered list is now a pointer at `07`. |
| `artifacts/playball-v1.html` | **The published plan.** Same content as `07`, as a page. See the rule below — it is not optional. |

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

Both flagged in the code and listed in `06-backlog.md` §G5:

- **SIM SEASON** on the dashboard (`Today.tsx`).
- **The loaded Pascagoula Tech roster** — five men at 99 plus a guaranteed
  rookie offer (`store.start` and `NewGame.tsx`). Gated out of vitest.

## How to work here

```bash
npm run check      # typecheck + the whole suite (799 tests)
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
with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.
PowerShell here-strings break on apostrophes — use `git commit -F <file>` or a
bash heredoc.
