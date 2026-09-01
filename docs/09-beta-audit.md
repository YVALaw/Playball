# Playball beta audit — findings ledger

Run started September 1, 2026. Dynasty at Passaic Falls (PSA, prestige 19,
quality 24 — the lowest chair in the country), Full depth, everything played
by hand through the store's own actions.

## Confirmed, must fix before v1.0

- **F1 · The PSC godsquad hack.** `store.ts start()` gives Pascagoula Tech
  five 99-rated men in every non-vitest dynasty, marked "TESTING ONLY —
  remove before v1.0, together with the guaranteed PSC offer in NewGame.tsx".
  Left in place for now (the reporter's phone testing leans on it); it must
  go in stage 16.

## Fixed during this audit

- **A1 · Program overlay could not scroll** — no sheet on the tab had a
  scroller; the coach profile was the first tall enough to prove it. Fixed
  (screen-scroll wrapper in App.tsx).
- **A2 · The injury must-need was dead code** — it scanned startersFrom's
  nine, which filters the hurt, so the chart auto-covered and nothing gated.
  Rebuilt per the reporter's rule: manual cover required, recovery cards,
  bench/starting tags on the chart.
- **A3 · Broadcast misses** — fielder's choice, errors, bunts and "is
  retired" made no sound; catch sound on a flat 700ms timer. Rebuilt the
  classifier on the engine's full OUT_TEXT vocabulary with flight-matched
  catch timing; umpire pack (CC0) wired for strike three / safe / out.

## Open questions / to verify during the run

(added as the run progresses)

- **F1 upgraded — empirically confirmed.** In the audit world (seed 4141,
  user at Passaic Falls), the 2027 national champion is Pascagoula Tech —
  the godsquad wins titles in every dynasty whether or not the user is
  anywhere near them, warping awards, records, the wire and the draft for
  the whole save. Not just a ship-blocker: it distorts current playtesting
  anywhere but PSC itself.

## Passed during the run (worth recording)

- P1 · playSeason() on a complete season is a safe no-op (busy-guarded).
- P2 · Schedule math exact: 2160 results = 96 teams × 45 games ÷ 2.
- P3 · walkoff-against takeover fired organically in game 1 (PSA 5–6 SEL).
- P4 · The new manual-cover rule fired organically (day 40, CF hurt, cover
  promoted through moveDepth) — no auto-cover, no wedge.
- P5 · A 24-quality roster goes 9–36: the floor feels like the floor.

## The run itself (what was played)

Two full seasons + a third begun, all through the store's own actions:
creation with a real interview (recruiting/teaching answers), captain named,
two assistants hired ($255k of $997k), the rival scouted ($35, book opened
day 14), ~10 games managed by hand (pen change, pinch hitter, mound visit
all used), the rest simmed week by week with every red need resolved through
actions, one grades talk, June watched from the couch twice, awards
ceremony sat once and skipped once, 3 skill points spent (with one refund
exercised), portal (1 taken, 1 keep refused honestly), two full recruiting
windows, two year rolls, redshirt set/unset, strategy set, a job feeler
(ignored — as a 9-36 coach should be).

## Findings beyond the fixes

- **F2 (fixed)** · Draft results said "YOU LOST 6 — DRAFTED" over six pure
  graduations. The note now splits the doors: "0 DRAFTED · 6 GRADUATED".
- **F3 (fixed)** · setStrategy accepted junk keys from untyped callers and
  wrote them into the save. Now refused at runtime.
- **B1 (balance, reported)** · Year-1 board mandate at prestige 19 required
  BOTH "win 9" and "finish out of the cellar". We won exactly 9 — target
  met to the game — and still "missed" on the cellar clause. At the floor,
  where the roster is the worst in the country by construction, a required
  not-last is close to unpassable. Suggest: bottom-quartile develop mandates
  make notLast a bonus, not a requirement.
- **B2 (design, reported)** · Realignment ignores geography: 2028 sent
  PIEDMONT State to the PACIFIC and MOJAVE State to the ATLANTIC. With
  "the conference IS the region" as a core fiction, cross-country swaps
  read absurd. Suggest realignmentFor prefer adjacent regions.
- **B3 (soft UX)** · Two recruiting windows, two empty classes — one spread
  thin, one concentrated on the three most contested men on the board. The
  system is honest (134 of 648 signings went to sub-30-prestige schools),
  but the board never says "you are being outbid into oblivion". The
  leaders-at-week-start data exists; a losing bid could read as losing.
- **Ops note** · The long-lived vite dev server served a stale store.ts
  (fresh Needs.tsx beside it) — recovery cards looked broken until a server
  restart proved them fine. Windows file-watcher exhaustion; worth
  remembering before diagnosing "bugs" on the seed tab.

## Verified working end-to-end in authentic play

Creation/interview/made-coach · economy (budget math, hires, scouting gate)
· manual injury covers + recovery card · captain · press · grades talk ·
managed games incl. all three dugout tools · walkoff-against takeover with
loss tone · realignment twice, persisted, wire-led · alumni ledger ·
awards ceremony + skip + revisit-as-list · review verdicts · skill points ·
portal take/keep · draft step · two recruiting windows + signing day ·
walk-on backfill · redshirt · strategy · approach · year rolls with staff
kept, ledger reset, journal clean.

---

# The thirty-season report — September 1, 2026

The reporter played 25-30 seasons in one sitting and lost their notes. What
follows is what they remembered, what it turned out to be, and what is left.

## Bugs found behind the complaints

- **Stats keyed by name.** TeamState.batting/pitching/fielding were
  Map<name>; two men sharing a name on one roster shared one line. Fixed to
  player id. ("Repeated names in a team causes the stats going crazy.")
- **AUTO could not bench anybody** — autoBattingOrder is a pure reorder by
  contract and nothing sat above it. New layer: fitTheNine.
- **Hurt arms still pitched.** Availability was never asked on ANY pitcher
  path; a suspended Friday starter started Friday.
- **regroup built position-blind nines** (two catchers, no shortstop) between
  the draft step and signing day.
- **Three quarters of every recruiting class carried the wrong growth curve.**
  The class year was stamped after the man was built, so projectPotential saw
  a random class and the gem clause fired at a quarter of its written rate.
  Mean headroom 6.0 → 12.7; sleepers 1.75% → 8.6%.
- **The player board was never corrected for league drift** — every rival
  board is, and the league mean roster climbs ~10 points over 30 seasons.
- **Team.quality was welded down.** Prestige has moved since B7, but the
  number every walk-on is drawn against was written once at world creation.
- **Professional careers never ended** (the 22-year All-Star).

## Measured, in the repo

- `tests/balance-probe.ts` — class headroom, star bands, quality drift,
  career lengths.
- `tests/churn-probe.ts` — 30 real seasons with the rival year running.
  Top-twelve turnover 4 → 6 programmes; mean movement 14.9 places of 96.

## Open, and deliberately not fixed yet

- **Prestige runs away to the mid-90s** for a handful of programmes over 30
  seasons. Measured with the quality drift switched OFF and it is unchanged,
  so it is a property of nextPrestige, not of the September 1 pass. Worth a
  decision: is a 94-prestige tier too easy to reach?
- **The sim ignores position fit entirely.** positionPenalty is computed for
  the depth chart UI and never read by game.ts, so a catcher at short costs
  nothing. This is the real depth behind "players playing the same position"
  and it needs its own measured pass — it will move calibration.
- **The other tabs.** The reporter played many seasons "just pressing the
  same buttons". The loop is Today → play → Today. Wire, Program, Season and
  the record book are all reference; none of them ever ASKS for anything.
- **The inbox** carries too much that does not matter (reporter deferred it).
- **University overview styling** still reads as the pre-port design.
- **Position changes from the player profile** — agreed, not built.
- The PSC godsquad and Hans Hood both ship out before v1.0.