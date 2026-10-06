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

| Task | Findings |
|---|---|
| SIM WEEK / SIM GAME / June stages / year roll through the existing worker (or chunked per frame), with a busy state that blocks re-entry | H4, M46, M83, M84 |
| Coalesce autosaves (debounce ~1 s + write on `visibilitychange`), clone off the tap path | M43 |
| Memoise Today's RPI and the recruiting sort; stop kept-alive screens re-rendering on `version`; list saves from summaries, not full loads | M48–M51 |
| Fix the `simClient` retention leak; persist the name pool so reload doesn't change the future | M47, M42 |
| Defer three.js until the first live game (and never on 2D); drop dead CSS (~55%) | performance LOWs |

## Phase 5 — Android and Play Store (3–4 days, then device pass)

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

| Task | Findings |
|---|---|
| Tour layer above design-system sheets; the two lineup lessons completable | H9, M79, M80 |
| Back gesture sees the tour/tips; bounded route trail | M44, M45 |
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
