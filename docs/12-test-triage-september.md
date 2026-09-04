# 12 · September test report, triaged

**September 3 2026, evening.** The reporter's third phone pass, taken as a
planning exercise — "not coding yet … plan further and sort between stages
or create stages." Every ambiguous claim was checked against source before
it was sorted; the engine answers he asked for are recorded here so the
stages that need them start informed.

## Engine answers, before the sorting

- **Captains are real, one channel.** A captain damps the whole room's
  mood swings: `morale.ts:142` moves every man 60% of the raw swing
  instead of 100% when the room is captained. That is the entire effect —
  meaningful across a season, invisible in any single moment. The stage
  below decides whether he earns a second channel or just gets his one
  channel taught and surfaced.
- **Strategy is real and wired.** `game.ts` reads the standing strategy
  live: infield alignment feeds `alignmentAgainst` on every ball in play,
  the running setting feeds every advance on a hit, and the rest of the
  five controls ride the same path. The playbook stage is building on a
  live system, not resuscitating a dead one.
- **The budget "conversion."** There is none — it is one pool in two
  denominations. Draft and portal print the whole window
  (`windowBudget(stars)` ≈ 200 at three stars); recruiting prints what is
  LEFT after both, divided by the three weeks
  (`weeklyBudget = (window − draft − portal) / 3` ≈ 56). Same money, one
  screen showing the tank and the next showing the weekly pour. Fix is
  labelling, not plumbing: every budget figure carries the same two-part
  form — the pool, and this screen's slice of it.
- **The grand slam is a counting bug.** `Manage.tsx:151` fires GRAND SLAM
  at `scoredRunners.length >= 3`, but `scoredRunners` includes the batter
  crossing — two aboard plus the batter is three crossings. The bar is
  four. One-character fix, splash comment already says the right rule.
- **The two-way double-duty is genuinely undefined.** No code in
  `liveGame`/`depthChart`/`positions` reconciles a man who is in the nine
  at LF *and* the night's starter. What the sim does on his rotation
  night needs a trace before the design call. His profile also hides the
  arm half: no role line beside "TWO WAY · LF", no pitching table.
- **The inbox dots** — reproduced and root-caused in the build session:
  the dot was rendered on EVERY row and merely recoloured grey once read,
  so every letter wore an unread-looking dot for ever. The design intent
  ("the dot survives the visit that clears it") never had its mechanism —
  the unread set is now snapshotted once at mount, before `readInbox`
  clears it; rows in the snapshot wear the dot and NEW for that visit,
  everything else wears nothing.
- **The replay-on-mound-visit root cause**: the field's ball effect
  depended on the store `version`, which moves on every write — visits,
  pinch hitters, pitching changes included. The engine now counts plate
  appearances (`LiveGame.playSeq`) and the field animates only when that
  counter moves. Verified live: a play bumps it, a visit does not.

## Batch P — the polish pass (bugs and small moves, next build session)

Small, verified, no design questions open. One session.

1. **Grand slam bar** → `scoredRunners.length >= 4`.
2. **Layout never moves** (the reporter's global rule: "no text should
   push content anywhere"):
   - Captain screen: the suggestion FieldNote that appears on selection
     is cut outright — the guided tutorial (stage 19) owns that teaching.
   - Lineup: the tap-a-player helper line gets reserved space or an
     overlay, never a reflow.
3. **Fielder/runner contrast**: tokens get a stroke that contrasts with
   the grass — pick white/black per team colour luminance. Applies to
   both defence and offence.
4. **No replay on non-plays**: mound visit, pinch hit, pitching change
   re-trigger the last-play animation; suppress unless a new play landed.
5. **Inbox read-state**: repro and fix (snapshot vs badge, above).
6. **Postseason waiting room**:
   - Next-game card holds `{us} vs TBD` instead of unmounting and
     returning when the opponent lands.
   - Finals copy reads the bracket wrong: losing game one of the final
     from the winners side prints "came through the losers bracket" and
     the two-wins arithmetic. The card must read the *route*, not the
     last result.
   - "This stage is settled" → the stage winner's banner.
7. **Budget labels**: one form everywhere — pool total plus this screen's
   slice ("56 a week · 168 left in the pool").
8. **Two-way tag off the recruit list rows** — it reads only inside the
   prospect card, so the tag stops being a beacon every user hunts.
9. **Lineup swap animation** — the promised swap-places motion (FLIP on
   the two rows) never landed; add it.
10. **Coach profile**: the standing-strategy section moves from its own
    block at the foot to a line in the info list above coach prestige.

## Stage 20 — the opener, reorganized (and the board across the table)

The season-opener modal did not land with the reporter: "everything is
thrown at you with no visible delineation."

- **Sectioned layout**: verdict · what moved · the new terms · the
  winter's stings, each with its own heading, not one list of lines.
- **Headline pool**: six or seven rotating openers in the game's own
  register ("Play ball", "Skipper —", …) drawn per year, so seasons open
  differently. "Delighted" retires from the title slot.
- **Plain prestige lines**: "the name up 10 to 57" fails the language
  audit's own bar. Form: "School prestige 47 → 57. Yours 31 → 34."
- **The button**: TAKE THE SEASON becomes/adds an action that opens the
  program board to read and accept the new terms.
- **20b, booked not built**: negotiating the terms — a gutted roster
  after a title year should be arguable back to sane milestones. Needs
  its own design (what leverage is, what asking costs).

**Built September 4, to the reporter's two answers** (forced board visit;
one card with sections): the modal is one card with four titled sections
— THE VERDICT (the board's words), WHAT MOVED (prestige as `47 → 57`
rows, coloured by direction), THE WINTER (poached stings, only when
any), THE NEW TERMS (the win number and the board's mood line) — under a
title drawn from a seven-entry pool rotated by year ("Play ball,
skipper", "The cage is warm", …). Its one door is READ THE BOARD'S
TERMS, which opens the program board; **TAKE THE SEASON lives on the
board itself now**, a green-edged strip above the checklist, and
accepting there is what clears the year's card. The card stands down
while the board is open and returns on any other screen until the terms
are taken — nobody starts a season without seeing the objectives.
Verified live end to end; acceptance saves immediately.

## Stage 21 — the two-way, whole

- Trace what the sim actually does on his rotation night while he holds
  an outfield spot; then the design call: does starting him on the mound
  vacate LF for the night (bench cover slides in, the card says so), or
  is the nine simply built without him on his pitching nights?
- Profile: role reads "MID SP · LF"; the stats view carries both halves
  (the leaderboard split already exists — carry it onto his card).
- Lineup screen says which nights he pitches, so the LF slot's status is
  legible before it surprises anybody.

## Stage 22 — playbooks: strategy, scouting, and the money

The reporter's design seed: "we have our main playbook that we use for
everyone and each time we scout a team we get a playbook for them that
can be added at any time."

- **Playbooks**: the standing strategy becomes the default playbook;
  scouting a team mints a per-opponent playbook (seeded from their
  tendency reads) that can be applied for that series. Strategy tab
  restructures around this — which finally gives scouting *leverage*, not
  just information.
- **Budget and hires**: surface what the staff seats and facility rungs
  actually do in the engine, and strengthen where they are thin — the
  audit of real effects is the first task of the stage, in the same
  measured style as the captain/strategy answers above.
- **Captain's second channel** (from the engine answer): decide here
  whether the C stays morale-damping only — and gets taught honestly in
  stage 19 — or gains a visible in-game effect.

## Stage 23 — the lineup gate

The coverage warning becomes a blocking modal, not a top-of-screen strip:

- Appears wherever you are on the lineup screen when a spot is open.
- Leaving the screen is refused while the diamond is short — the modal
  re-presents on any exit attempt.
- The one allowed excursion is a player card (the second-tap grammar),
  which returns in place.
- Sits beside stage 19's guided tutorial in spirit: the game stops you
  before the mistake, once, instead of narrating always.

## The reporter's calls — September 3, closing the loop

Read back and answered the same evening:

- **Captain**: no second engine channel for now. The guided tutorial
  (stage 19) teaches what the C does in simple words at the moment of
  choosing one — "he keeps a bad week from becoming a bad month" — and
  the Captain screen's pushed-in explanation dies in batch P.
- **Playbooks grow a counter-play layer** (stage 22): the per-team
  playbook is not just their tendencies read back — it recommends and
  applies counters. A club that bunts and runs → play the infield in,
  hold runners; a power club → space the defence out and pitch to
  contact. The scouting report becomes the *input*; the playbook is what
  you do about it.
- **Budget**: no explanation paragraphs. The recruiting board's big
  weekly number carries one small line beneath it — "168 / 3 weeks" —
  and that is the entire teaching. Batch P.
- **Two-way rotation nights**: candidate design is a **toggle** — the
  reporter's word — likely per-night: his card offers "bat tonight /
  rest the bat" (or LF vs mound priority) when duties collide. Settled
  properly at stage 21's door, after the engine trace says what happens
  today.

## The order — re-affirmed September 3

Stages 17–19 move to **dead last**, after stage 23 — the original plan
restored: store, phone and ship happen when the game is in near-final
condition. Execution order from here:

**Batch P → 20 → 21 → 22 → 23 → 17 (store) → 18 (phone) → 19 (ship).**

And the testing surface changes: **the reporter tests on an Android
emulator from now on**, not the iPhone — the game meets its intended
system early. Stage 18's emulator-answerable questions (IndexedDB across
a force-quit, safe-area insets, the hardware back button) stop waiting
for hardware and get answered as they come up in play.

## Stage 24 — the creation interview, punchier (booked September 4)

The reporter's call after the archetype-grid conversation: the interview
stays, the boredom goes. Design as discussed, to be talked through more
before the build: **three questions, not five** (the pool of 81 stays);
per-answer swings widened, not inflated — +5-style numbers with a real
minus so the net stays ~+2; **the consequence reveals after the tap**
(stat moves and the badge vote animate in, so each answer pays off
visibly); and a **result card** at the end — the coach you made, his
four skills, two badges, and who calls a man like him. A quick-start
"pick a background" fallback (preset answer sets through the same
settle()) stays on the table.

## Stage 21 — built September 4, corrected the same night

The trace confirmed the sim seated him at LF **while** he pitched — one
body, two stations. The first build put a NON-batting bench glove on his
grass; the reporter corrected it twice to the real rule, now final: **on
his pitching night the nine is C, 1B, 2B, 3B, SS, RF, CF, LF, P** — he
bats and pitches as the P slot (the box labels him `P` that night), the
**DH sits on the bench**, which grows a seat to hold him and keeps him
available (`TeamState.benchTonight`, read by every pinch-hit path), and
the man who takes his grass **comes off the bench batting** in the DH's
slot. Nobody ever fields without batting. A two-way RELIEVER taking the
ball mid-game sits the DH the same way (`coverPitcher`, on both the
sim's and the managed game's pitching changes). On non-pitching days
nothing changes: he plays his position and bats.

Two follow-ups the same night: **the box score carries both of his
games** — his batting row wears **PH** (pitcher-hitter, the DH's cousin,
the reporter's own label) while his arm's row sits in the pitching table
below it, and since PH stopped meaning pinch hitter, a man off the bench
is now **SUB**. And confirmed on ask: nothing is fixed to LF — the
engine covers whatever position his bat actually holds, wherever the
winters have moved him.

The card: the hero reads **TWO-WAY · SP · 1B**; a **Batting / Pitching
toggle** on the STATS and GAMES sheets switches the season-by-season
table, the June table and the game log between his two books (the
stacked "and on the mound" second table retired in its favour); the
overview's THIS SEASON shows both lines at a glance; and the lineup row
carries his arm's role so his pitching nights are legible. Three new
engine pins hold it: never in the field while he pitches, the bench
cover at his exact spot with the DH untouched, and the reliever cover.
