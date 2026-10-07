# Fix plan for the 1.0.0 pre-release audit

Companion to `docs/17-pre-release-audit.md`. IDs (B1, C4, H2, M43 …) refer to that report.

The 332 findings collapse into far fewer root causes. This plan fixes by **root cause, not by finding**,
in an order where each phase makes the next one safer: first get the build green and put a safety
net of tests under the dynasty, then close the corruption bugs, then performance, then UX/copy.

Each phase ends with `npm run check` green and a debug APK on a phone.

---

## Phase 0 — Green build and a safety net (1–2 days)

| Task | Findings |
|---|---|
| Delete `tests/interview.test.ts`, `src/engine/interviewResult.ts`, `src/data/interview.ts` | B1 |
| Make `scripts/apk.cjs` run `cap add android` when `android/` is missing; write `screenOrientation` into the generated manifest the same way it writes versionCode | M4, M5 |
| Delete the other 7 unreferenced files (Kit, Sticky, PlayerName, LineScore, ProgramVisuals, programStatus, program-redesign.css) and the dead `storageBlocked` flag | code quality |
| **New invariant suites** (they should pass today; they guard every later phase): save → load equality at every phase/stage; schedule invariants for 34/45/56; bracket integrity across seeds; roster/ID invariants over 10 seasons | Appendix B (1)(3) |
| **Known-bug tests** written as `it.fails(...)` for C1–C4, H1–H3, H7 — each flips to `it` in the commit that fixes it | Appendix B (2)(4)(5) |

## Phase 1 — Stop dynasty corruption (1 week)

> **Status: done**, apart from the partial items listed here. Regression tests are in `tests/audit-known-bugs.test.ts`
> (C2, C3, C4, H2, H3, H7) and `tests/phase1-fixes.test.ts` (M41, M55/M37, M93, M74, M71, M105).
> Partial: M102 only *hides* Retire between jobs and after retirement. "Retire now" from the job
> market still needs an `endCareer` variant that does not roll the year. M53 unblocks New career on the Start
> screen when the save store will not answer (a new career takes its own slot, so it can overwrite nothing)
> rather than adding a separate "play without saving" mode.

Root cause A — **actions not gated by game phase.** Add one guard helper in the store
(`canMutateWorld(state)` / `phaseAllows(action)`) and use it in every mutating action and every
button that calls one, with a reason shown on the disabled control.

| Task | Findings |
|---|---|
| `acceptOffer`: refuse (or defer to `rollYear`) while live / pendingGame / busy / bracket / phase ≠ null; `endManagedGame`, `keepPlayer`, portal act on the owning program, not `get().userTeam` | C4 (+ merged), M101–M104 |
| God Mode: validate edits against roster invariants; remove moved/cut men from the portal pool; "next spring" swaps queue until `rollYear`; no schedule/league edits during a live game or June | C2, C3, H3, M68 |
| Edits during the worker's "Sim the season" are refused (or merged), not dropped | M71 |

Root cause B — **the live-game resume anchor is overwritten or voided.**

| Task | Findings |
|---|---|
| Keep the journal valid when stepping out of the dugout; autosave must not overwrite the anchor; scope the interrupted game to its career + slot; stamp build/engine version | H2, M25, M54, M59, M78, M95 |
| Re-check the lineup gate on resume after a kill | M105 |

Root cause C — **offseason steps can be re-entered.**

| Task | Findings |
|---|---|
| A closed portal is read-only on the rail and never rebuilt on load once `furthestPhase` passed it; one source for portal spend | H7, M73 |
| Awards/review rebuilt from archived data so revisiting shows the same winners; Board-room "Continue" can't delete next season's terms | M93, M74 |

Root cause D — **saves.**

| Task | Findings |
|---|---|
| "Save and leave" / "End here" only leave on a successful write | M52 |
| IndexedDB-blocked Start screen gets a working "play without saving" | M53 |
| Keep `auto-prev`; offer it when `auto` fails to load | M41 |
| Autosave keeps the slot's chosen name | M55, M37 |

## Phase 2 — Delegation and the systems that do nothing (1 week)

> **Status: done.** Tests are in `tests/phase2-fixes.test.ts`. They include a check that every live Settings
> row is read somewhere outside its own Settings render, so a new row with no reader fails the build.
> Notes:
> - **C1:** only the suggested list was changed. The stand-in for a lost recruit still skips lost causes, by design.
> - **H8:** the hold asks only a coach who writes his own card and keeps injury replacements. Otherwise the
>   cover is fielded the way `coverFor` fields one.
> - **M34:** the dugout keeps the pen and visit settings the game started with, and a flip applies next game.
> - **M40:** while `SCOUTING` is off, `handles(…, 'scouting')` is false for every career.
> - **L30 and coach badges:** every coach badge now has an effect (`src/engine/coachEdges.ts`, `tests/coach-badges.test.ts`).
>   The exception is READS THE ROOM, which has nothing to act on while scouting is held back. In-game edges were measured
>   over 4,000–10,000 games and sized to about a point of win rate each. The noise floor of that measurement is ±1–2
>   points. A badge's `prized` culture now widens that kind of school's reach in the job market.
> - **M33, revisited:** the flat 55% wage cap was replaced by a build reserve. The athletic director hires only while a
>   year's budget, less wages, still covers the next building. 15 of 18 measured program-years built something.
> - **C1, revisited:** measured with recruiting delegated. A 5★ staff signs 8 men at 3.6★, against its peers' 8 at
>   4.0–4.2★. The alternative replacement rule traded a man a class for quality with the same total stars, so the
>   rule was kept.

Root cause E — **a depth switch that nothing reads.** Add a test that, for every `SYSTEMS` row,
flipping it changes behaviour; then fix each row.

| Task | Findings |
|---|---|
| Delegated recruiting: `suggestStaffList` → `lostCause` needs the `mine > 0` guard; seed a delegated board like rivals' | C1 |
| Delegated portal still closes the national market for the other 95 | H1 |
| Injury replacements with Lineups delegated must not freeze the calendar | H8 |
| Coaching points, Draft conversations, Captains, Rotation-and-bullpen switches: implement or remove | M72, M35, M77, M34 |
| GYM RAT, Hitting guru, coach badges: wire their effect or remove the promise | M28, (LOW) |
| SCOUTING off: treat scouting as delegated for everyone; remove the dead "Scout a program" copy | M40 |
| AD budget leaves room to build | M33 |

## Phase 3 — Recruiting, June, game sim correctness (1 week)

> **Status: done.** Tests are in `tests/phase3-fixes.test.ts`. Measured results:
> - **H6:** unsigned prospects per year fell from 77–80 to 12–15. Programs ending with an open scholarship fell from
>   42–51 to 21–24.
> - **H5/M76:** June played through the store went from 109–110 nights to 29–31.
> Notes:
> - **H6 follow-up:** with full programs off the board, the bottom of the class became a real race. A delegated staff
>   at two stars or under now also swaps a starred man it is clearly losing, but only for a race within a star of him.
>   The weakest program's staff signs 7–8 against its peers' 6.3–6.9, and a 5★ staff's class holds at 3.5★.
> - **M60:** the coach's career total now counts June, as his season rows do. The school's annals keep the regular
>   season, and the load-time repair of the annals relies on that split.
> - **M22:** changes the pinned calibration seed slightly (errors 0.954 → 0.976 a game). The golden values were
>   re-recorded with a note.
> - **M21:** rest is judged on the game's own date. Injury availability still reads the day index after it advances,
>   which the audit did not flag. It may be worth a look.

| Task | Findings |
|---|---|
| Full-class programs stop counting as the lead; last-scholarship "yes" commits; nag clears | H6, M88, M91 |
| Promises: judge NO REDSHIRT before clearing the flag; staff never redshirts a promised man; pitcher position promise priced fairly | M61, M62, M64, M30 |
| June uses the calendar day for starters, AUTO, injuries, rest; same-night stages on one calendar with breaks | H5, M57, M58, M75, M76 |
| Conference order frozen after the last game is recorded | M67 |
| One W-L definition everywhere (regular vs. with June); Omaha/bid counters match their lists; carousel yearbook credit | M60, M98, M10 |
| Game sim: W/L after a tie, rest judged on the real day, out-of-position fielding | M20, M21, M22 |
| Managed-game Replay fixed or hidden | H10 |
| Economy: pro-rata assistant refunds; no silent negative budget | M8, M9 |

## Phase 4 — Performance (1 week)

> **Status: done.** Tests are in `tests/phase4-fixes.test.ts`, `tests/save-index.test.ts` and
> `tests/sim-client.test.ts`.
> - **H4/M46/M83/M84:** chunked per frame rather than moved to the worker. A per-week worker call would clone the
>   2.6 MB season both ways and replace every object the screens hold. SIM WEEK plays a day per frame under `busy`.
>   June's round, mine and rest buttons play a night per frame (`simBracket(mode, true)`). The year roll yields
>   before its two heavy builds. The longest block under a tap is now one day (180–300 ms on desktop), down from a
>   whole week (500–720 ms) or a whole June. SIM GAME, a second SIM WEEK and June's buttons are refused while one
>   runs. Today and June hold their press lock until the run finishes, and hiding the screen no longer cancels it.
> - **M43:** autosaves coalesce into one write a second after the last change. The write is built in the timer,
>   not under the tap. It is flushed when the app hides, a career starts or another loads. The chip reads
>   "saving" while a write is owed. Awaited saves still write at once.
> - **M51:** the saves menu reads one index record. The index heals around files it never saw and drops rows whose
>   file is gone.
> - **M48–M50:** the RPI table is cached per state of the records and shared by the screens and the engine. The
>   board computes each prospect's fit key once. `Screen` is memoised; Rooms, Saves and Inbox subscribe for
>   themselves.
> - **M47:** each worker call has its own failure hook, removed when it settles. The worker releases the progress
>   proxy.
> - **M42:** the name pool is rebuilt from the season before next year's class is drawn. Rolling the year in a
>   running app and after a reload now draws the same class and the same RNG position. The test fails without the
>   fix.
> - **Bundle:** three.js is fetched when a game is asked for (Play ball, Play this game, Pick it up), not 3 s after
>   launch, and never on the 2D field. 3,067 dead rules went from the legacy stylesheets, and the built CSS fell
>   from 678 kB to 362 kB (54 kB gzipped). A rule counted as dead only when every selector named a class that no
>   source file can produce. Computed styles of every element were compared before and after in Chromium: 18 tab
>   screens, 9 overlays, the new-career flow and a live game, light and dark. There were no differences.
>   `prototype.css` is generated and was left alone; its 946 dead rules need a filter in
>   `scripts/adapt-prototype-css.mjs`.
> - **Not done:** the `store.ts` split, and the unreferenced-file and token-layer clean-up (L48), are code health
>   rather than performance. They are left for later.

| Task | Findings |
|---|---|
| SIM WEEK / SIM GAME / June stages / year roll through the existing worker (or chunked per frame), with a busy state that blocks re-entry | H4, M46, M83, M84 |
| Coalesce autosaves (debounce ~1 s + write on `visibilitychange`), clone off the tap path | M43 |
| Memoise Today's RPI and the recruiting sort; stop kept-alive screens re-rendering on `version`; list saves from summaries, not full loads | M48–M51 |
| Fix the `simClient` retention leak; persist the name pool so reload doesn't change the future | M47, M42 |
| Defer three.js until the first live game (and never on 2D); drop dead CSS (~55%) | performance LOWs |

## Phase 5 — Android and Play Store (3–4 days, then device pass)

> **Status: code done; the device pass is still owed.** Tests are in `tests/phase5-shell.test.ts`,
> `tests/phase5-sound.test.ts` and `tests/billing.test.ts`. This container has no Android SDK, so nothing here has
> run on a phone or an emulator. The manifest patch was checked against Capacitor's own Android template.
> - **M5:** portrait was done in Phase 0. **M23:** under 560 px of height, Home scrolls and its action row sticks to
>   the bottom, and the live park shrinks. In Chromium at 420 px, the three buttons were under the tab bar before
>   the fix and are tappable after it.
> - **M1:** the system bars follow the in-app theme (Capacitor SystemBars: Dark, Light, or Default for "system").
> - **M24:** `apk.cjs` declares VIBRATE. A silent ringer still mutes WebView haptics; `@capacitor/haptics` would
>   avoid that and was not added.
> - **M2:** the three families ship in the bundle (`src/ui/fonts/`, Latin and Latin Extended, OFL). The Google
>   Fonts links are gone, and a page load makes no external request.
> - **M39/L61:** in the background the audio context suspends and the bench coach waits. The Sound switch stops
>   and restarts the crowd mid-game.
> - **M3:** no WebGL2 means the 2D diamond, and three.js is never fetched. A renderer that fails to start also
>   falls back to 2D.
> - **L59:** the WebView's text zoom is off. The phone's font size seeds the in-app Text size once, through a small
>   `Device` plugin (`native/android`).
> - **L4:** backup is kept on but scoped to the WebView's storage (`native/res/xml`). The privacy policy and the
>   listing now say what backup does. **Review the new privacy wording before it is published.**
> - **L2/L3/L37:**
>   - A cancelled purchase says nothing.
>   - "Already owned" restores the purchase.
>   - Other failures read in plain words, and a pending payment shows a note.
>   - A refund takes god mode back after Google Play reports "not owned" on two launches in a row. Test builds are
>     exempt, and existing sandbox careers stay.
>   - Settings says why god mode cannot be bought.
> - **L36:** in the APK, storage errors no longer mention browsers and tabs. Saves reads load errors the way the
>   start screen does.
> - **M27:** Settings → Privacy and about shows the policy text offline, links the full policy, and shows the
>   version and build.
> - **M26:** the eight screenshots were regenerated from the app at 1080×1920 by `scripts/store-shots.cjs`, and
>   the listing doc's checklist now includes regenerating them.
> - **L6:** the docs name `npm run aab` as the store build. A `.debug` application-ID suffix was not added: it
>   would make the next sideloaded test build a separate app without the tester's careers.
> - **Seen while doing this, not fixed:** after the national final, an injury "Set the lineup" prompt appears
>   over the big-moment card. It is queued as its own task.

| Task | Findings |
|---|---|
| Portrait lock (Phase 0) **or** make Home/live game scroll in landscape/split-screen | M5, M23 |
| Status/nav bar style follows the in-app theme (Capacitor SystemBars) | M1 |
| VIBRATE permission or drop the Haptics setting | M24 |
| Self-host the three fonts; drop the Google preconnect | M2 |
| Pause bench coach + suspend audio on `visibilitychange` | M39 |
| WebGL2 missing → fall back to the 2D diamond | M3 |
| In-app privacy link; refreshed store screenshots; revoke refunded God Mode; billing error copy; backup rules | M27, M26, android LOWs |
| **Device pass** on a low-end Android 10–12 and an Android 15/16: back gesture, background/kill mid-game, IAP purchase/restore/refund, system font size | report §Limitations |

## Phase 6 — Onboarding, UX and accessibility (1 week)

> **2026-10-07, ahead of the phase:** the guided first-season tour is removed. It was the reporter's call: "simply
> keep the screen cards so we don't make a super overwhelming tutorial". That retires H9, M79 and M80, and the tour
> half of M44. Removed with it: the spotlight, the "Have a word" errand, the tour's CSS, and the `guide` / `data-guide`
> hooks it used to find controls. Each screen now has one short card in its own words (`src/ui/tutorials.ts`, held
> to length by `tests/tips.test.ts`). The board card now says "Bonus" goals, as the board does, not "Stretch". A
> lineup the staff sets gets its own card. The tips still opted out of the back layer then; that half of M44 is
> fixed below. Also done the same day: holding a man on the Lineup opens his whole profile with his season on top,
> and back returns to the lineup. The pitching side now shows the hold line too.
>
> **Status: done.** Tests are in `tests/phase6-fixes.test.ts`, `tests/inert-under.test.ts` and the navigation suites
> (`nav-trail`, `nav-levels`, `backNav`, `nav-integration`, `kept-alive`). Checked in Chromium at 360 px with Normal
> and Larger text.
> - **M44:** a screen card is a back layer like any other. Back closes the card, never the screen under it.
> - **M45:** back now follows the Android standard (the reporter's choice):
>   - A bottom tab resets the trail to Home, and back from Home exits.
>   - Inside an area, back walks the sub-tabs you opened.
>   - Returning to a screen already in the trail jumps back to it, so no loop builds up.
>   - The trail is capped at 20 stops, and a live game adds none.
> - **M18:** while a sheet, dialog, picker or table overlay is up, everything beside it is `inert`
>   (`src/ui/inertUnder.ts`), so it cannot take focus, taps or a screen reader. Table overlays are now dialogs:
>   they take focus and close on Escape and back. A sweep of 18 screens and the live game found nothing left inert
>   by mistake.
> - **M19:** larger text and tap targets.
>   - All 372 fixed line heights scale with the text size. A computed-style diff shows Normal is unchanged.
>   - Home's action labels wrap to two centred lines instead of clipping.
>   - At Larger, the game card's crest shrinks and school names stop breaking mid-word.
>   - Chips, segments, recruiting views and filters, to-do buttons, Home labels, the wheel rail and the men on the
>     park have a 48 px hit area.
>   - The phone's font size is no longer applied on top, since L59 in Phase 5 turned the WebView zoom off.
>   - Left as is: two recruiting rows sit 40 px apart, so a tap near the edge between them lands on the
>     neighbouring row.
> - **M81:** the offer screen builds its world from the chosen season length, so the board ask, the roster and the
>   goal shown are the ones the job gives. Tested for the short, standard and long seasons.
> - **M82/M103:** the offer's stat strip is two by two. Money in the comparison stays one figure, and its columns
>   grow with the text size.
> - **M106:** the gap modal's button is now "Cover the positions". The man you sent in takes the open spot, and
>   the batting order stays as you set it.
> - **M107:** the pick bar shows who is picked on one line and what the next tap does below it, with short names.
> - **M108:** the Fielding table is Player, Pct and Plays. Position, chances and errors sit under the name.
> - **M89:** "Sway him" presses the want that raises your fit the most, says which one and by how much, and is off
>   when no want would help.
> - **M90:** "Use these" asks before it replaces a list that has people on it. "Fill the open slots" adds the
>   suggestions after them.
> - **M97:** before the regionals are played, Games to watch and the Bracket show every pairing as "Set", your region
>   first. A national half not yet started lists its seeds. The "still filling" note is gone.

| Task | Findings |
|---|---|
| ~~Tour layer above design-system sheets; the two lineup lessons completable~~ (tour removed) | H9, M79, M80 |
| Back gesture sees the tips; bounded route trail | M44, M45 |
| Overlays make content beneath inert; Larger text clipping on 360 dp; 48 dp tap targets | M18, M19 |
| Job offers previewed on the career's real season length; offer sheet layout at 360/320 | M81, M82, M103 |
| Remaining MEDIUM UX items (gate modal discarding the order, pick bar, fielding table, sway default, "Use these" without undo, empty June bracket) | M106–M108, M89, M90, M97 |

## Phase 7 — Copy and polish (3–4 days)

- Terminology unification first (Ceiling/Potential, job security, goal types, finish names), then
  plural/article/ordinal helpers for generated text, then the 360 line edits in Appendix A.
- The 35 POLISH findings and remaining LOWs, batched by screen.

## Phase 8 — Release

Re-run the audit's harnesses (25-season soak with save round-trips, postseason invariants,
phone-viewport screen sweep) against the fixed build, bump to 1.0.1, closed test, then production.

---

**Rough total:** about 6–7 weeks for one developer; Phases 0–1 alone (about 1.5 weeks) remove
every BLOCKER and CRITICAL except C1, which lands early in Phase 2.
