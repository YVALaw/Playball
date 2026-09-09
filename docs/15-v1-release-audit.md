# The v1.0 release audit — September 7 2026

The complete release-readiness audit of Playball, run against `main` on
September 7 2026, the day after god mode shipped. Eighteen read-only domain
audits with executable probes, then every blocking finding verified against
the code before anything moved, then eight waves of fixes, each with a
regression test, then the docs reconciled. The systems account of what
changed is `05-systems-reference.md` §62; this file is the verdict, what
was fixed, what remains, and the screen-by-screen matrix.

Severity, as the audit used it: **P0** — crash, corruption, save loss, a
season that cannot finish, a rule that is not baseball; **P1** — a system
that does not do what the game says it does, or does it for one program and
not the other ninety-five; **P2** — visible, wrong, and survivable; **P3** —
polish, comments, dead code.

> **Scope note, added the same afternoon.** This report describes the tree
> at commit `f6ad07f`. The reporter's outside pass — god mode as a control
> center, navigation history, the hybrid staff system, season-long
> recruiting and the rest (`05` §63) — was merged after it, three-way, with
> the audit's fixes carried through every conflict and the suite green
> again. None of §63 was inside this audit's scope; the verdict below
> stands for the audited systems and does not vouch for the merged ones.

## A. Release verdict

**READY** — for the release process. Nothing in the code stands between
this tree and the store build.

Every P0 and P1 defect the audit found is fixed and pinned by a test, and
so are the eight P2 items that touched the player's hands (§C). The suite
is green at 66 files and 1,242 tests; the type check is clean; the store
build carries no test aids, no free UNLOCK and no source maps; the test
APK builds and installs with its version pinned from `package.json`.
Nothing that remains open corrupts a save, breaks a rule of baseball, or
stops a season; what remains is polish (§D), balance decisions written
down for the reporter (§E), and the release process itself (§K): the
keystore, the signed bundle, Play Billing in place of the Settings
stand-in, onboarding, and the listing. None of those is a code risk; all
of them are work.

## B. Fixes completed

Eight waves, grouped by the shared cause that made each wave a wave. Each
bullet is a defect that was verified against the code, fixed, and given a
regression test in `tests/release-audit.test.ts` (or `tests/national-poll.test.ts`,
`tests/saves.test.ts`, `tests/contrast.test.ts` where named).

**Wave 1 — the managed game against the simulated one (§62.1).**
- A game the coach sat in cost its men nothing: no starts, no legs, no arm
  mileage. `dayInTheLegs` and `seasonInTheArm` are shared now.
- The managed game fielded the raw lineup with hurt and ineligible men in
  it; it takes `coverFor`'s card like the sim.
- A managed bracket game handed the away dugout the host's rotation slot.
- A resumed game did not count in the conference race (`conference` on the
  journal).
- BIG STAGE never fired in the one bracket game a coach manages (June is
  stamped on the live game).
- PLAY BALL could start two games from two overlapping taps (`liveStarting`).

**Wave 2 — the rules (§62.2).**
- A two-out sacrifice bunt scored a runner: it is an at-bat and the third out.
- A reliever inherited the starter's times-through-the-order count.
- A forced runner stayed on first through a plain ground-ball out.
- PITCH FOR GROUND had no double-play lift (`doublePlay: 0.55`).
- The league re-fit at normalizer 1.045 on the eight-seed sweep; goldens
  re-recorded (`npm run goldens`).

**Wave 3 — the save system and the career's integrity (§62.3).**
- The transfer pool and the approaches ledger did not ride the save; a
  save on the portal step came back without a portal (rebuilt for old saves).
- Every career wrote into one autosave slot; a career has a file of its own.
- The league-name registry and the sandbox star gate followed the last
  career started, not the one loaded.
- A season could be settled twice by walking the rail back to awards.
- A sacked coach could be offered no chair at all.
- A blocked store (IndexedDB refused) left the front door blank; it reports.
- A structurally broken season (no rotation) crashed a day in; it is
  refused at load with a reason.
- `rollYear` and the no-worker `playSeason` had no error boundary; both set
  `simError` instead of leaving `busy` true forever.
- A year that was not a number looped the calendar forever.

**Wave 4 — the roster lifecycle (§62.4).**
- June dropped survivors when a deep roster's bench and pen were rebuilt.
- Rivals' starts were never cleared and their mood never settled, so a
  third of the country carried more starts than games and no rival could
  break a promise.
- A promised position was not kept through the roster rebuild.
- The `pressers` depth row survived the press room's removal.

**Wave 5 — the postseason and the schedule (§62.5).**
- RPI kept moving while the brackets it seeded were being played; it is
  frozen on the regular season (`regularOpponents`, `rw`/`rl`).
- The regional card on the Postseason screen was not the real selection.
- The host balance traded three midweeks for a home series and its
  tiebreak handed the first-listed (best) program of every league a
  permanent extra home series or two; series and midweeks balance apart
  and the tie alternates with the rotation.

**Wave 6 — the interface (§62.6).**
- `Overlay` was not a dialog: no role, no focus trap, no Escape.
- Hidden command sheets were still in the tab order.
- The 3D field had no error boundary, no frame-delta clamp, and its 2D
  setting had no reader; AUTO never handed the dugout back at a decision
  worth managing.
- The dark theme's primary commands sat on `--clay` (unreadable); they sit
  on `--command`. Trophy metals had no dark cut.
- The app had no top-level boundary: a render throw was a white page with
  the autosave pointing back at it. `Boundary.tsx` around the app and the
  field chunk.
- The desk's national rank read as RPI on day one; it says PROJ until two
  games a team have been played (`pollIsProjected`, `nationalOrder`).

**Wave 7 — the store build.**
- The test aids, the free UNLOCK and the source maps shipped in a store
  build; `TEST_SHORTCUTS` from a Vite define, `npm run apk:test` for the
  emulator, `npm run apk` for the store.
- The APK's `versionCode`/`versionName` were hardcoded 1 / "1.0" in a
  generated file; `scripts/apk.cjs` writes them from `package.json`.

**Wave 8 — the other ninety-five (§62.8).**
- A winter healed only the coached roster; two hundred rival men a year
  stood permanently on the shelf. Healing lives in `nextSeason`.
- A man on the shelf pinch-hit and a redshirt batted, burning his year;
  the bench is filtered through `available` like the nine.
- The portal measured the whole country against the coached program's
  game count; each program reads its own.
- The portal read a mood a season stale (none in the first winter); the
  settle runs when the pool opens, once.
- A rival's unsigned portal man stayed on the roster he was leaving, and a
  `break` stopped the shopping queue behind the first program with
  nothing to take.
- `staffRedshirts` had no caller; the staff sits a freshman for every
  program, and for the coached one in casual.
- Coach of the year's category weights were two engine revisions old and
  gave wire-to-wire a fifteen percent bonus; re-measured.

## C. Remaining P0 / P1

**No P0 remains open. No P1 defect remains open.**

Three findings the auditors filed as P1 are design decisions the audit
recorded rather than made (§62.7, §62.8), because each reshapes a
distribution the goldens and the soak pin:

- Every pitcher enters the portal through the "buried" door, because arms
  have no expectation of their own (§62.8).
- The user's recruiting board is never seeded with rival interest, so the
  coached program starts every class uncontested (§62.7).
- The pitch bypasses the anti-spread ramp (§62.7).

The eight P2 items a player meets with his thumb were fixed in a ninth
wave rather than left as the verdict's condition:

1. **"Let him go" fired an assistant on one tap** with no confirm and no
   undo (`Program.tsx`). It is a `Confirmable` now, like the portal's.
2. **A browser back press escaped the app over a god sheet** — `layerNow`
   in `App.tsx` forgot `godOpen`. (The wider point — the gesture does not
   know about locally held sheets — stays in §D; it needs a store-level
   sheet counter.)
3. **One malformed save blanked the whole save list**; `listSaves` emits
   one unreadable row for it (tested).
4. **The live journal was cleared before the post-game save was written**
   in both `endManagedGame` branches; a kill in that window lost the game
   with no resume offer. The save comes first now, and a bracket game
   saves too (the comment that forbade it described a codec that has since
   learned to carry the tournament).
5. **Two dialogs skipped the focus contract**: the box-score sheet and the
   big-moment card carry `role="dialog"` and `useDialogFocus`.
6. **Roster rows read HURT off the frozen schedule index** through June;
   they read the trainer's clock.
7. **NEEDS YOU held the day on a decision whose answer was not rendered**
   for a chart-only coach; the return hold belongs to the coach who writes
   the card.
8. **A program that missed its conference tournament saw a live "YOUR NEXT
   GAME" card during the national stage**; spectator mode is
   stage-independent for a program with no tournament of its own.

With them, the recruiting filter button has an accessible name, `--you`
has a dark cut (7.4:1, pinned in the contrast test), `color-scheme` is
declared for both themes, the desk's SIM timer is cleared on unmount, and
the God mode settings row no longer stretches UNLOCK/REMOVE across the
card with its caption crushed to a word a line (found in the browser on
the final pass; a generic full-width rule from the generated stylesheet).

## D. P2 polish

Everything else the audit filed at P2, grouped. Each is real and verified;
none blocks the release.

**The back gesture.** It does not know about locally held sheets (the
profile command sheet, the box score, the portal signing sheet), so a
press can close a sheet and navigate at once; the fix is a store-level
sheet counter each sheet holds while mounted, fed into `hasLayerToClose`.

**The dugout.**
- The HOME RUN splash is never dismissed if the next play starts inside
  2.6 s; the call buttons unlock before the field finishes drawing the play
  (derive the gate from `playPlan.done`); the tactic explanations live only
  in a `title` tooltip no phone shows; the play-by-play has no live region
  and the canvas no name; the manager popover animates under reduced motion.
- Muting the game does not stop the 820 KB sample pack downloading
  (`preloadSfx` ignores the pref); PLAY BALL fires again on every re-entry.
- Player markers cost six meshes each (119–193 in the scene); the painted
  crowd texture is never disposed; the 2D fallback field drops the ball.

**Lineups, roster, needs.**
- The Lineup screen leaves every control live for a coach whose card the
  staff writes, and reverts the edits silently; the lineup gate is walked
  around by the sub-nav (`setScreen` lacks the `cardGaps` check).
- The player-management FAB portals into the first `.full-overlay`, not
  the top one, so it is unreachable from a card opened off a team card.
- Roster's capacity strip always reads full (each group's cap is its own
  count).

**Recruiting.**
- Pitch and major-move buttons stay enabled with no budget left and do
  nothing; NOBODY IS ON HIM finds one recruit in 720 (a zero threshold);
  nothing detects two promises that cannot both be kept; `MAX_PER_RECRUIT`
  caps raw effort only (real weekly ceiling 27, not 12); the four pitch
  verdicts collapse to two because the calibration ran on the top sixty
  recruits.

**The season and June.**
- SIM SEASON never lets the staff set the card (ADVANCE DAY and SIM WEEK
  do); the computer opponent never rests a regular in a game you manage;
  `finish()` does not hand over the half-inning in progress.
- Two or three rounds of every double elimination are played on one
  calendar night; the national championship series is played entirely at
  bracket A's champion's park; a June box score is overwritten when the
  coached program plays twice in a day.
- PLAY FOR CONTACT lowers the sacrifice-fly rate (0.58 against a 0.62
  default); a walk-off is not clamped on the bunt path; the computer never
  sacrifices while the human is on defence; a run scoring on the play that
  records the third out is charged unearned.
- Innings pitched prints in decimal thirds (`12.7 IP`) on cards,
  leaderboards and awards, against the box score's notation.

**Saves.**
- The loader does not validate its scalars (a bad `history` escapes the
  try/catch); six store fields die on reload and leak between careers
  (`unseenTrophies`, `unseenRecords`, `portalArrivals`, `arguedTerms`, …);
  the once-a-season argument with the board is lost by any reload; a
  god-mode conference swap in the next-spring window does not survive the
  codec.

**Theme, type, a11y.**
- `--yellow` is used as ink on light surfaces at 1.35–1.83:1; three meters
  and the settings switches read inverted in the dark theme; a met and a
  missed board objective are drawn in the same colour; eight font sizes
  bypass `--ts`; three controls strip their focus outline with no
  substitute; no `color-scheme` is declared; a disabled primary command
  sits at 2.05:1; `--you` has no dark cut (1.93:1 in the bracket); the
  smallest type is 5 px; the recruiting filter button has no accessible
  name; Settings' radio pickers are announced as tabs; five god-mode
  selects and the save-rename field have no label.

**Code health.**
- `rpiOrder` and `leaders` recompute in render (4 ms and 7 ms a call on a
  full season) with no memo; `accentPalette` and `applyTeamAccent`
  duplicate six derivations; four copies of `slotOf` disagree about two-way
  players; 38.8% of the generated `prototype.css` is rules no source uses;
  fifteen exports are referenced nowhere; engine B ships in two chunks the
  app never calls; a zustand selector returns a fresh array literal; ERA
  is open-coded in twelve places; three near-identical `createLiveGame`
  option blocks in the store; dead press-room fields on the save contract;
  the TEST BUILD strip's CSS ships; the build toolchain is three majors
  behind and there is no linter; `src/field/` is an empty directory.

**P3** — comments, casing, dead props, one-line tidies — is listed in the
audit's working notes and in §62's Appendix A; none of it reaches a player.

## E. Post-1.0 backlog

**Booked as stages** (`07` stages 27–30): the rules of the world (injuries,
portal, realignment, poaching on/off; season length and series format at
creation), free; the creator kit (school and conference packs, logos,
careers as files), the second purchase; called to the majors, the
expansion; and — added by the reporter on September 7 — an account and a
record book every player is in, free, which is the project's first server
and rewrites the privacy policy and the Data Safety form when it ships. **Cut outright**: pitch-by-pitch calling — the engine settles a
plate appearance and sequences pitches to land on it. **What did not make
the list**: a human poll beside RPI, weather and park conditions, fan
support and attendance, live bracketology, mentorship pairs, exhibition
games, classic-finish scenarios, share cards. **God mode's own deferrals**
(`05` §61.3): several seasons at a tap, a hand-set year.

**Balance decisions set down for the reporter**, each measured (`05` §62.7,
§62.8): a batting order nobody deals (the catcher leads off for
ninety-five programs, worth 0.06 runs a game); the .497–.523 batting
leader; the unseeded user board (signs 1.9 a year unseeded against 8.0
seeded); the pitch that bypasses the ramp; the sequential June (111 days,
nine times the injuries in the first cup); the roster cap (rosters settle
near thirty against §3's twenty-three); the pitcher's portal door; no
closer (the best arm throws 15.9% of relief outs against a flat 16.7%);
the computer's portal shopping (cheapest-first, two apiece, no retention);
the computer's nine (fifty-three programs field less than their best at
their own labels; the order itself is worth −0.2%); a transfer's career
rows (archived for the coached program only).

## F. Simulation report

All figures from this session's probes on the shipping engine (log5),
normalizer 1.045.

**Calibration** (`npm run calibrate`, 2,000 games; targets are D1 averages):

| metric | sim | target | diff |
|---|---|---|---|
| Runs per team per game | 6.92 | 6.73 | +3% |
| PA per team per game | 42.00 | 41.70 | +1% |
| Batting average | .282 | .280 | +1% |
| On-base percentage | .385 | .384 | 0% |
| Home runs per team per game | 1.03 | 1.03 | 0% |
| Strikeouts per team per game | 7.96 | 8.01 | −1% |
| Walks per team per game | 4.73 | 4.70 | +1% |
| Pitches per plate appearance | 3.70 | 3.75 | −1% |
| Slugging | .441 | .438 | +1% |
| Errors per team per game | 1.09 | — | |
| Stolen-base percentage | .717 | — | |

**Pitch level** (200,000 plate appearances): first-pitch strike .586
(target .584), foul share of swings .366 (.365), miss share .217 (.215),
pitches per PA 3.69 (3.75); the 3-0 strike rate runs .632 against .583
(+8%), the one pitch-level figure off its target, unchanged by the audit.

**Parity** (4,000 games a pair, home and away split): a 30-point quality
gap wins 97.2%, 18 wins 85.5%, 12–13 wins 75–77%, 7 wins 63.0%, 2 wins
49.7% (home 54.9%, away 44.6%). The shipped conference spans 44–57, so 13
is the widest gap it produces; 75–85% there was the target.

**Goldens** (`tests/calibration.test.ts`): re-recorded after the rules
fixes at normalizer 1.045; the eight-seed sweep sits within the bands.

**Soak** (`npm run soak`, thirty seasons, on the healed league): thirty
Junes, nothing broken; eleven different champions in thirty, most by one
program seven (ten and nine before the ninety-five were healed); the
save-ish payload grows 12.4 KB a year (15 KB → 374 KB). School annals add
about 22.5 KB a season on top, unpruned (P3).

**The postseason auditor**: 300 Junes, 0 structural faults (every bracket
resolves, one champion, every regional participant placed, no team twice
on a night within a bracket).

**The draft and the portal** (ten offseasons, seed 4242, store-faithful
loop): 0 integrity faults every season — no drafted man on any roster
afterwards, no id in more than two units, every lineup nine men at nine
positions with a catcher. Exposure 2.3–2.6 eligible underclassmen per
program per year; rival keeps 12–27%; the portal pool 68–129 men a winter
(0.7–1.35 a program), 88–117 absorbed, stars reaching it once in ten years.

**Coach of the year** (eight worlds, eight seasons each, the test's own
loop): before the audit wire-to-wire took 36 of 64, after the rules fixes
45 of 64 (over the test's 70% bound), after the healed league 32 of 64,
and after the re-measured weights 26 of 64 — overachieved 19, turnaround
16, giant-killer 3 — four stories told at 41 / 30 / 25 / 5 percent.

**Managed against simulated** (one season, seed 4242, driven through the
real store both ways): before wave 1 the managed path recorded 0 starts, 0
leg days and 0 arm outs against the sim's 405 / 252 / 1,088; after it the
two paths keep the same books.

## G. UI/UX report

**Journeys run in the browser, light and dark**: new career (both depth
modes, god mode on and off); a managed game with a save mid-game and a
resume; SIM WEEK and SIM SEASON; the postseason as a participant and as a
spectator; every offseason step including a portal signing and the
pre-fix portal-step save rebuilt; the desk's PROJ chip on day one; every
god editor from its bolt; the boundary fallback (a thrown render) and the
2D field setting. Both themes were checked on every screen visited; the
audit's contrast probe (`tests/contrast.test.ts`) now pins the command
ground and the metals in both palettes.

**What the audit changed for the hands**: PLAY BALL cannot double-fire;
AUTO hands the dugout back at a decision worth managing; the overlay is a
dialog with Escape and a focus trap; hidden sheets are inert to the tab
order; the dark theme's commands are readable; a render throw shows a
card with TRY AGAIN and BACK TO START instead of a white page; the field
survives a lost WebGL context and a slow chunk; the front door says when
the store is blocked.

**What remains for the hands** is §C's list and the a11y block of §D: the
dugout is inaudible to assistive tech; two dialogs and the big-moment card
lack the contract; the tactic notes never appear on a phone; the smallest
type is 5 px; several controls lack a name or a focus ring.

**Discoverability**: every god-mode editor is reachable from a bolt beside
the thing it edits (eleven sites) and from the header bolt's short list;
twenty-six god actions are guarded behind the career flag. Onboarding for
the first ten minutes remains stage 19's work.

## H. Technical health

- **Type check**: clean (`tsc --noEmit`).
- **Tests**: 66 files, 1,242 tests, green; ~216 s. Twenty-three of them
  are the audit's own (`tests/release-audit.test.ts`), plus four for the
  national poll, a rewritten `saves.test.ts`, and the contrast pairs.
- **Build**: `index` 1,011 kB (326 kB gzip), `Diamond3D` chunk 913 kB
  (247 kB gzip), CSS 341 kB (51 kB gzip), worker 100 kB; source maps only
  under `VITE_SOURCEMAP=1` or `serve`. The two chunks over 500 kB are the
  engine and three.js; the field is lazy.
- **APK**: `npm run apk:test` builds the emulator APK (5.5 MB) with the
  aids in; `npm run apk` is the store build with them out; version pinned
  from `package.json` (`versionCode = major·10000 + minor·100 + patch`).
- **Dependencies**: every runtime dependency current; the toolchain is
  three majors behind (vite 5 → 8, vitest 2 → 5, typescript 5.9 → 7);
  no linter — two `eslint-disable` comments expect one.
- **Dead code**: fifteen unreferenced exports, engine B bundled but
  unreachable, 38.8% of the generated stylesheet unused, `src/field/`
  empty. None of it runs.
- **Markers**: no TODO / FIXME / HACK / WIP in tracked source; the four
  `TEST BUILD` markers are all inside `TEST_SHORTCUTS` branches.

## I. Documentation reconciliation

Corrected in this audit: `README.md` (status, counts, god-mode row, the
test-aid paragraph); `01-roadmap.md` (Capacitor, redshirts, the back
button, the camera, injuries, the S+ row, counts); `05-systems-reference.md`
(new §62 in eight parts; §11.3's schema note; §14.7's re-measured figures;
Appendix A and B strikes); `06-backlog.md` (S+ superseded, G1, H6, the test
aids as code); `07-v1-plan.md` (the preamble's count, the two errands,
REPLAY, stage 7's heading, stage 19's release commit block, the
did-not-make-list); `08-handoff.md` (September 7 block, counts); `09`,
`14` (closed items); `TESTING_SHORTCUTS.md` (rewritten for the build
flag); `VISUAL_POLISH_PASS.md` (a read-this-first banner);
`devicePrefs.ts`'s sound comment.

Still stale, filed P3: §11.3's full field table (a dozen fields added
since schema 4; version line says 4, code says 5); two season.ts comments
disagree about the midweek weekday; `foldSide`'s docstring describes rules
it no longer implements; "All-Conference First Team" is a national team.

## J. Screen audit matrix

Status: **PASS** — checked in both themes, no finding; **FIXED** — a
finding fixed in this audit; **P2** / **P3** — an open finding at that
severity (the fix is in §C or §D).

| Screen | Checked | Status | Notes |
|---|---|---|---|
| Start | new career, load, blocked store, boundary | FIXED | reports a refused store; New career disabled on error |
| New game (coach, school, how you play) | both modes, god toggle, PSC aid | FIXED | test aid gated behind `TEST_SHORTCUTS` |
| Saves | list, rename, load, delete | FIXED · P3 | a malformed record is one unreadable row; rename field unlabelled (P3) |
| Settings | theme, text size, sound, field, god mode | FIXED · P3 | UNLOCK gated; field 2D/3D reads; the God mode row's button no longer crushes its caption; radios announced as tabs; dead `onBack` |
| Today (desk) | day, week, season sims; PLAY BALL; PROJ chip | FIXED · P3 | double-tap closed; PROJ/RPI honest; off-day held reason missing; sim timer not cleared on unmount |
| Manage (the dugout) | managed game, resume, AUTO, boundary, 2D | FIXED · P2 | AUTO handover; frame clamp; boundary; splash/unlock timing; tooltip-only notes; no live region |
| Lineup | order, bench, AUTO, gate | P2 | controls live when the staff writes; gate walked around by sub-nav |
| Roster | list, filters, capacity, cards | FIXED · P3 | HURT reads the trainer's clock; capacity always full (P3) |
| Roster moves (FAB) | redshirt, position, release | P2 | portals into the wrong overlay from a team card |
| Schedule | list, box score sheet | FIXED | the sheet is a dialog |
| Standings | conference tables | PASS | |
| Rankings | RPI / poll | FIXED | projected order until two games a team |
| Stats | leaderboards | P2 | IP in decimal thirds; leaders recomputed in render; caps headings (P3) |
| Player card | four tabs, hold to open | P3 | tab casing; ERA open-coded; JUNE marker dead rule; hold is pointer-only |
| Team card | overview, roster, schedule | P2 | `rpiOrder` in render |
| Colleges | search, profiles | P2 | search input strips its focus ring |
| Program (bar, board, staff, money) | objectives, staff, argue, god bolts | FIXED · P2 | "Let him go" asks twice; met/missed same colour; fresh-array selector (P3) |
| Strategy | eight controls, playbooks | P3 | `playbookFocus` never cleared; wiring audit's findings in §L |
| Recruiting board | filters, pitch, promises, budget | P2 | dead taps with no budget; NOBODY ON HIM threshold; conflicting promises; filters survive a career (P3); filter button named |
| Signing day | class review | PASS | |
| Draft | keep sheet, board | P2 | `slotOf` disagrees with three other copies about two-way men |
| Portal | leaving, available, keep, sign | FIXED · P3 | pool rides the save; retention "failed" state unreachable |
| Postseason | brackets, regional card, spectator | FIXED · P2 | real selection; probables via `startableSlot`; spectator mode at every stage; host rule for the final (P2) |
| Season review | grades, leaders | P2 | leaders recomputed in render |
| Awards | coach of the year, teams | FIXED · P3 | weights re-measured; "All-Conference" is national |
| History | seasons, settle-once | FIXED | a season settles once |
| Record book | season, career, coach marks | PASS | |
| Wire / Inbox | feed, letters | PASS | |
| Job market / Job search | offers, floor | FIXED | the cheapest chair always calls |
| Captain | give / take the C | PASS | both modals confirm |
| Coach points | spend, take back | PASS | |
| Needs you | musts, returns | FIXED | the return hold belongs to the coach who writes the card |
| Big moment | takeover card | FIXED | a dialog: focus on its button, Escape dismisses |
| Overlay (tables) | every table | FIXED | dialog contract |
| God editors (eight) | every bolt, every action | FIXED · P3 | eleven bolts; five selects unlabelled; next-spring swap vs codec |
| Back gesture | every layer | FIXED · P2 | `layerNow` knows `godOpen`; locally held sheets still unknown to it (P2) |

## K. v1.0 checklist

Code and content, from this audit:

- [x] Every P0 and P1 fixed and tested (§B).
- [x] Suite green (66 files, 1,241 tests); type check clean.
- [x] Store build carries no test aids, no free UNLOCK, no source maps
      (`npm run apk`, never `apk:test`).
- [x] APK version pinned from `package.json`.
- [x] Save compatibility preserved: every fix reads old files (portal
      rebuilt, registries synced, `approaches` defaulted, old-build moods
      settled at the rebuilt portal step).
- [x] Docs reconciled (§I); the balance decisions written down (§62.7,
      §62.8) rather than made.
- [x] §C's eight minor fixes.
- [ ] The a11y block of §D, or the subset stage 19 chooses.

The release process, stage 19 (`07`):

- [ ] Bump `package.json` to 1.0.0 (the release commit).
- [x] Play Billing replaces the Settings UNLOCK stand-in
      (`DevicePrefs.godMode` set by purchase and restore only) — code and
      tests in, September 7; the Play Console product and a licence tester
      are the reporter's.
- [x] Keystore generated and backed up (the reporter's, September 7 night);
      `npm run aab` builds the signed bundle from
      `android/keystore.properties`.
- [x] Listing, screenshots, privacy policy, content rating — in the Console
      September 8, the store listing "ready to send for review"; the app is
      **"Playball Baseball Dynasty"** there, not this file's working title.
      Every App-content declaration complete September 9, the Advertising
      ID last.
- [x] Onboarding for the first ten minutes (the guided first stretch) —
      September 9, `05` §64.
- [ ] The Freesound credits for the seven samples without a stated licence.
- [ ] The payments profile ("there is a problem with your payments profile"
      on the one-time products page) and the `god_mode` product itself —
      neither exists yet; parked September 9 by the reporter.
- [ ] The closed test the account type requires: a personal developer
      account may only request production after **12 testers have opted in
      and the test has run 14 days**. Not started; the only bundle in the
      Console is 704 / 0.7.4, on no track.
- [ ] Closed beta, then open.

## L. The strategy wiring audit

The eighteenth domain asked one question: does every control on the
Strategy screen reach the simulation and do what its label says? The
auditor's process was cut off by the session's rate limit before it wrote
its report; its completed probes (paired games, one side carrying the
lever, 2,500 to 15,000 games a row) were re-read and its last probe re-run
for this section.

**Every control is wired, and each moves the thing it names.** Steals
`never` takes stolen-base attempts to zero and `constant` to 1.83 a game
(caught 0.76); bunt `never` to zero and `often` to 0.24 a game; hook
`quick` makes 2.30 pitching changes a game against 1.79 standard and 1.43
`patient`; infield, outfield, alignment, shift and running each move
singles, hits and runs allowed in the direction the screen describes.

**The defaults are not the zero-sum point stage 22 said they were** —
filed P2, a balance decision for the reporter rather than an audit fix,
because the levers are honest and only the equilibrium is off:

- Against an ordinary lineup, infield `back` saves 0.245 runs a game and
  `in` costs 0.316; outfield `deep` saves 0.151; `situational` alignment
  saves 0.248. Nothing in the shipped neutral defaults pays for those.
  Against a pull lineup a shift or situational alignment saves 0.98 a game
  and the wrong shift costs 0.68.
- AUTO's counter-plan calls INFIELD IN against 51 of 96 opponents and BACK
  against 5 — the one positioning call that costs runs against every
  lineup shape measured.
- On offence, `never` stealing scores 0.155 runs a game more than the
  default selective policy (caught 30% of the time); `constant` costs
  0.067; bunting `often` costs 0.026; `aggressive` running is worth
  +0.038.

Rival programs play a standing plan assigned at creation
(`strategyFor`), never the counter, so the user's AUTO is the only place
the counter's calls reach the field. The speed-lineup rows and the
larger-sample re-run the auditor had queued did not complete.
