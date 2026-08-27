# Handoff

**For whoever picks this up next — human or agent.**

This file is the running answer to two questions: *what was just done* and
*what happens next*. It is rewritten at the end of every working session, so
the top of it is always current. Everything older lives in git.

**Last session:** August 27, 2026 · **Branch:** `blocks-batch`
**Nothing is pushed.** `origin` holds the pre-overhaul backup deliberately.

---

## Read these first, in this order

| File | What it is |
|---|---|
| `07-v1-plan.md` | **The route.** Fifteen staged steps to v1.0. This is the north star. |
| `06-backlog.md` | The decisions and the argument behind each. §H is the agreed feature set; *Decisions locked* holds the depth-mode rules that bind every feature. |
| `05-systems-reference.md` | What the game does **today**, including the hidden-mechanics index. A feature that shipped moves in here on the same commit. |
| `01-roadmap.md` | Two-minute view. Its ordered list is now a pointer at `07`. |

**The house rules that are not negotiable**, all of them earned the hard way:

- **The engine imports nothing** — no React, no Three, no DOM, no store.
  `tests/architecture.test.ts` enforces it.
- **Reporting never changes what happens.** The wire, the play-event stream and
  the landing coordinates all take zero random draws. Tests pin it.
- **Determinism is the product.** The seed and the generator position ride the
  save. Adding or removing an `rng()` call moves every number downstream.
- **The depth mode never reaches into the engine** (see below).

---

## What was just done — stage 1, complete

Stage 1 was *"stop the game lying, and stop it losing things."* All four items
shipped, all verified in a browser, 768 tests green.

### 1. A thirty-season soak — `npm run soak`

New probe, `tests/season-soak.ts`, following the existing probe convention
(`block-probe`, `carousel-probe`). Runs N seasons — default 30 — and audits
every June: conference fields and placings, one-loss survival, sixteen regional
series with distinct champions, a twenty-team national field with no
duplicates, protection never drawn into the opening round, the sixteen split
cleanly into two brackets, exactly one champion and one runner-up, twelve
programs per conference, nine men in every lineup, and one annals row per
program per year.

**Result: thirty Junes, nothing broken.** Two findings worth carrying forward:

- **Save payload grows ~12 KB a year** (15 KB → 371 KB at year 30). Fine, but
  it is the number to watch when H2 (alumni in the pros) and H9 (signature
  moments) add per-player history.
- **Title concentration is high.** Ten different champions in thirty years,
  and one program (Bayou State) won eight of them. Real college baseball
  produces roughly sixteen in thirty. The cause is almost certainly the new
  format: double elimination, top-four protection and best-of-threes all
  reduce upsets relative to the knockout it replaced. **This is a balance
  item, not a bug** — logged in the "open questions" section below. The soak
  fails if distinct champions drop below `years / 3`, so it is a live canary.

### 2. A13 — the elimination card that buried living teams

The reported bug: losing a conference final told the coach his season was over
when second place sends him to a regional. **The fix turned out to be bigger
than reported** — a *protected* top-four team losing its regional was told the
same lie, and is also still alive.

- `Knockout` gained `advanced: boolean` and `placing?: number`, computed in
  `noteKnockout` **at the moment of elimination**, because that is the only
  moment the structure still knows where the team fell. A double elimination
  writes the finish in the slot you take your second loss in: championship is
  2nd, losers final 3rd, losers semifinal 4th.
- Regional eliminations read `protectedTopFour(season)` — pure arithmetic over
  the finished season, so available immediately.
- `howFar` in `Postseason.tsx` branches on it: "Runners up / Third in the
  league / Fourth in the league" with a *win* tone and an ON TO THE REGIONAL
  button, versus a real ending for fifth and below. Same for "Protected".
- **The stake now appears before the final, not after it.** `YourNext` says
  "win one and it is yours" or "you must win this AND the next one". The
  original confusion was a player having no way to know he needed two.
- Pinned by two new tests in `tests/bracket.test.ts` that assert the card's
  verdict agrees with the bracket's own `placings`, whichever way June went.

### 3. Tournament cards, tidied

Per direction — *simple but appealing, explanatory text removed*. Win cards are
a kicker, a headline and one line. The qualification card lost its two-sentence
format lecture. The full big-moment treatment (leverage styling, sound,
full-screen celebration) is **stage 11**, deliberately not done twice.

### 4. Resume an interrupted game — the big one

**Both regular season and postseason.** A `LiveGame` is a coroutine carrying
closures and cannot be serialised, so it is **replayed, not restored**.

- **`src/state/liveJournal.ts`** (new). An anchor and a list: the season
  generator's position at the first pitch, the two teams, the starters, and
  every call since as a small enum.
- **It lives in `localStorage`, and that is the design.** An IndexedDB write is
  async, and the moment this exists to survive is an OS kill — where a pending
  async write is a lost write. `setItem` returns when the bytes are down.
- **`startManagedGame` and `manageBracketGame` are now `async`** and `await`
  the save before creating the game, so the save on disk holds the pre-game
  generator position. This is load-bearing: the replay is only exact if the
  restored season stands where it stood at the first pitch.
- Every call is journalled **before** the engine is stepped, so a crash inside
  the engine replays to the same crash rather than skipping a call.
- On load, `pendingFromJournal` validates slot + year + rng state and offers
  the game. **Accept** replays and hands back the clipboard; **decline**
  replays and calls `finish()` — the day still happens, it just happens without
  you (your call, and the right one).
- **A stale restriction was deleted, not worked around.** `endManagedGame`
  refused to save mid-bracket because "the live sub-bracket is not
  serialisable". That stopped being true when `portableMyBracket` landed in the
  overhaul; `sideShow` joined it in the national redesign. The comment was
  guarding a hazard that no longer existed, and it was the only thing blocking
  postseason resume.
- `tests/resume.test.ts` pins the property everything rests on: a replayed game
  is log-line-for-log-line the same game. The journal tests supply a real
  `localStorage` shim rather than weakening the module with a memory fallback —
  a journal held in memory dies with the tab, which is the event it exists to
  survive.

**Verified in the browser, not just in tests:** played a game, made calls,
hard-reloaded the page, took the offer, and confirmed the log lines, inning and
count were identical. Then the decline path. Then the same for a postseason
bracket game, which initially had no prompt because June renders its own frame
— the offer now appears on the bracket screen too.

---

## What is next — stage 2, "How you want to play"

`07-v1-plan.md` has the full brief. In short:

1. **The depth choice at coach creation** — full roleplay career or casual —
   framed as how you like to play, not a difficulty menu.
2. **Per-system toggles** behind the preset, changeable mid-career.
3. **The settings sheet** (H18): sound, haptics, field 2D/3D, text size,
   reduced motion, tutorial reset, and saves migrating in from the portrait
   menu. **Stored per device, not in the save** — preferences follow the phone,
   not the dynasty.

**Three rules bind everything built from here.** They are in `06-backlog.md`
under *Decisions locked* and the first is load-bearing:

1. **The engine always models everything.** The mode changes what the player is
   *asked about*, never what the simulation does. Casual does not turn injuries
   off; it answers the injury question for you. A mode that reached into the
   engine would put the ninety-five rival programs in a different world from
   yours and make every ranking, record and award a lie.
2. **Anything touching the league is on for everybody or off for everybody.**
3. **The preset is a preset, not a cage.**

**Exit condition:** every system built after stage 2 has a documented answer for
what it does in casual mode.

**Open decisions at stage 2's door:** two modes or three; what casual actually
turns off; whether the mode is visible anywhere after creation.

---

## Open questions carried forward

- **Title concentration** (found by the soak, above). Ten champions in thirty
  years against a real-world sixteen. Worth a deliberate decision: accept it as
  the price of a format that rewards the best team, or add variance. Do not
  touch it casually — it interacts with the carousel's turnover targets and the
  board's clear rate, both of which are tuned and pinned.
- **Is there an Android device yet?** Stage 14 (the phone) is deferred for want
  of one. Everything in it except the frame-rate measurement can be done on an
  emulator, so the emulator pass can be pulled forward at any time.
- **Two errands that need no phone and should happen whenever convenient:** the
  Play Console record and merchant account (merchant verification takes days
  and it is the only unpredictable wait in the plan), and a throttled browser
  performance profile as a cheap hedge on the frame-rate question — stage 3
  rebuilds the dugout around a *larger* 3D field.

## Test aids currently in the build — remove before v1.0

Both are flagged in the code that carries them and both are listed in
`06-backlog.md` §G5:

- **SIM SEASON** on the dashboard (`Today.tsx`).
- **The loaded Pascagoula Tech roster** — five men at 99 plus a guaranteed
  rookie offer (`store.start` and `NewGame.tsx`). Gated out of vitest so the
  suite tests the game rather than the hack.

## How to work here

```bash
npm run check      # typecheck + the whole suite (768 tests)
npm run soak       # thirty seasons of structural audit
npm run build      # also serves the frozen build on :5173 for phone testing
npm run balance    # calibration probe
npm run carousel   # coach turnover probe
```

Dev server runs on **:5199**; a frozen build for phone testing is served from
`dist/` on **:5173**. Verify UI work by driving the DOM — under Vite dev, a
dynamic `import()` of the store often returns a *different* module instance
than the app's, so store handles read stale.

**Commit style:** narrative first line, prose body explaining the *why*, ending
with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer. Do
not push without being asked.
