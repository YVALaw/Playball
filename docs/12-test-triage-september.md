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
- **The inbox dots** are deliberately snapshotted for the visit that
  clears them (`Inbox.tsx:228`) — the reported "still unread" needs a
  repro to tell a snapshot gone stale from the nav badge lagging.

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

## Standing bookings, unchanged

Stage 17 (the store design door), stage 18 (phone/Capacitor), stage 19
(guided tutorial, keeping the title card). Batch P slots before or
between them at the reporter's call; 20–23 are new bookings in the order
above, which is the order of how loudly the phone complained.
