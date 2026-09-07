# Roster Tabletop

The design of record from v0.7.4 onward, and what `src/ui/tokens.css` means when
it says "the Roster Tabletop proposal (Option 2)". It replaces
`design/Dynasty Mobile.dc.html`, which is kept in the folder beside this one
because it is the design every comment in the app written before this point was
arguing with.

Three files, lifted out of the proposal prototype unchanged:

**Twenty-five of twenty-six stages shipped, through September 6 2026, the
interface rebuilt whole on September 5, and the build through its release
audit on September 7** (`docs/05-systems-reference.md` §62,
`docs/15-v1-release-audit.md`). Stages 1–17, 18, 18b and 20–26; 19 (ship)
is what is left. Ninety-six
programs in eight conferences of twelve, a forty-five game regular season, and
the whole loop runs: pick a job through a background that shapes who rings you,
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

**The engine and the ladder both moved on September 5**, in two more
outside passes merged the same night. The engine pass corrected the
scorer's rules — the force chain, earned runs reconstructed through
virtual outs, wild pitch split from passed ball, the win and the save by
the book, team mound visits, recovery by pitches thrown — and recalibrated
the league to the modern game (§51). The prestige pass gave the ladder
floors, so a small program that does its job actually climbs: a cleared
board is worth a point, a conference tournament berth is a milestone that
gets remembered, coach reputation is judged against the mandate he
accepted, and contracts run seven years at one star (§52).

What is missing is **the tail**: ship (the keystore, the listing, the
guided tutorial, the test aids coming out). **Android 16 is done** (stage
18b, September 6): the emulator showed the back gesture leaving the app
from any depth, because nothing native ever handed it to the page; a
twenty-five-line plugin the page arms only while it has a layer to close
fixed it, with the predictive exit preview kept at HOME. Arguing the
board's terms and the art are in. **Recruiting 1.0** landed the same day
(§54): nine things a recruit weighs, a pitch and a major move a week,
binding promises that follow him onto the roster, and one offseason
economy with a protected reserve for the freshman class. Testing runs on
an Android 16 emulator against `npm run apk`.

The engine is calibrated multi-seed to the modern NCAA D1 environment —
.280 / .384 / .438, a home run a game, 6.73 runs — since the September 5
engine pass (`docs/05-systems-reference.md` §51) and re-fitted after the
release audit's rules fixes (§62.2). **1,244 tests across 66 files**, including
determinism goldens, calibration as a regression test, a
baseball-correctness suite for the scorer's rules, and a concurrency suite
pinning the store's double-press guards.

**It installs.** `npm run apk` builds a real Android package — Capacitor over
the same bundle the browser runs, no server, offline. The toolchain lives
outside the repo and outside PATH; the script supplies it. `npm run apk --
release` builds the unsigned release, and the keystore is stage 19's job and
the one thing that must never be lost.

| Not built yet | |
|---|---|
| Onboarding | the guided tutorial — a titled card, then a glow path through doing it (stage 19) |
| The rules of the world | injuries, the portal, realignment, poaching and season length as free switches on How you play (stage 27) |
| The creator kit | name, logo and roster packs a player builds and imports locally, careers as files — the second purchase (stage 28) |
| The majors | the expansion, after v1.0 (stage 29) |

**Merged September 7, afternoon** (`docs/05-systems-reference.md` §63):
the reporter's outside pass — god mode as a control center, back as a real
navigation history, the hybrid staff system (directives, multi-week
projects, facilities that power them, pipelines built by projects), and
recruiting moved to twelve regular-season weeks off the offseason rail.

Shipped since: god mode (September 6 — a per-career sandbox reached by a
bolt beside whatever it edits: players, programs, the leagues' names,
recruits, the coach, the staff, the money, the schedule and the season, with
any career forkable into it), the two-way whole and corrected to the rulebook, playbooks,
the lineup gate, the season opener, the Android shell — package, launcher
icon, and a back gesture that peels one layer per press — the APK report's
thirty-eight items, and then the interface pass: the background
picker that replaced the interview, Program as a dashboard, the Budget workspace, Decisions sheets,
the offseason roadmap, the postseason frame, hold feedback on the lineup,
and REPLAY, which the table above used to promise.

The prototype shipped inside a simulated phone — a bezel, a status bar, a
software keyboard, a device picker, an iPhone/Pixel toggle. None of that is
design; it is the harness the proposal was previewed in, and the proposal's own
guide marks it protected for exactly that reason. It is not in this folder and
it is not being ported.

**Test aids are behind a build flag** (`docs/TESTING_SHORTCUTS.md`):
`npm run dev` and `npm run apk:test` carry SIM THE SEASON on Today, the
guaranteed Pascagoula Tech offer and its five 99-rated starters; `npm run
build` and `npm run apk` drop them as dead code, and Vitest never sees them.
Hans Hood, the 99-potential third baseman injected into every class, is gone
for good — `ensureHoodHans` no longer exists.

The information architecture, entirely. Four regular-season tabs with the same
names and the same sub-screens as `TABS` in `state/store.ts`, the same seven
offseason steps as `PHASES`, and the same set of things that are overlays rather
than destinations. Nothing in the port moves a screen; the store was never
touched.

## What it is wrong about, and where we went our own way

The prototype is a prototype. It has no save state, no text-size setting, no
tutorials and no failure surfaces, because it never needed them — so its silence
on those is not a decision to remove them.

| It shows | We kept | Why |
|---|---|---|
| Drag handles and a tap-through on lineup rows | Tap-one-then-tap-another, no tap-through | Both came from playtest reports. See the comment at the top of `screens/Lineup.tsx` |
| A flat 2D ballpark | `Diamond3D.tsx` | Recoloured rather than replaced |
| A static photograph, reused for every player | `Avatar.tsx` | A face generated from the player's own id, stable across his whole career |
| Playoffs as step 1 of an eight-step rail | The bracket as its own frame, with the bottom nav | Taking the nav away from June was reported once already |
| Labels at 7–8px | A 9px floor, still on `calc(Npx * var(--ts))` | A default nobody can read is not a default |
| No mono anywhere | `--mono` for box scores and play-by-play | Column alignment is the entire readability of a box score |
