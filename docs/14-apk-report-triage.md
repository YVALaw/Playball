# 14 · The APK report, triaged

**September 4 2026.** The first list written while playing Playball as an
installed Android app rather than a browser tab — which is why so much of
it is about space: the URL bar is gone and the game has room it never had.
Every item from the reporter's list is here, in his order, sorted into
batches. The screenshots that came with it are in `13-phone-report-pending.md`;
**every red line in those is a deletion**, not a rewrite.

Two things run through the whole list and are worth saying once:

- **Nothing explains what the screen already shows.** The struck-out
  FieldNotes, the button sub-descriptions, the player bio paragraph — one
  rule, applied about a dozen times.
- **Several are regressions from the last two sessions, mine.** They are
  marked ⚠ and they go first.

---

## ⚠ Batch R — regressions, before anything else

**Seven of eight closed, September 4.** Item 1 (the two-way box), 2 (the
inbox), 6 (the bullpen gesture), 3 (the swap flicker), 4 (the fielder
rims) and 7 (the mandate) are fixed and pinned. Item 8 (the dossier
scroll) the reporter judged a one-off and it is dropped. **Item 5, the
postseason box score, is the one left** — and it did not reproduce:
`captureBoxFor` is stamped correctly (measured 0 for userTeam 0) and
`nextSeason` carries it forward, so the engine files a box for every game
the user plays. Tapping an OPPONENT-only game is silent by design — the
box is kept for your program alone — so the open question is whether the
game tapped was one of ours.

1. **The two-way ace pitched only on paper.** Set as the Friday starter,
   the dugout named somebody else as the starting pitcher, and when the
   game ended his card had a pitching line for it. Stage 21 seats him in
   the order and swaps the DH out — the rotation side of that is clearly
   not agreeing with the box. Highest priority on the list: it is the
   feature that was just rebuilt twice.
2. **The inbox letters render as one word per line**, preview text
   reduced to a stray `C` and `—`. Every new letter does it. From the
   inbox rework.
3. **The lineup swap animation flickers and blinks as it ends**, and
   again on AUTO. From batch P's FLIP work.
4. **Fielder and runner rims blink, and vanish when two men are close.**
   From batch P's contrast strokes.
5. **The postseason box score no longer opens** when a game is tapped.
6. **The bullpen no longer promotes.** Tapping an arm opens his card.
   Cause found: promotion must be *armed* from the rotation slot first
   (`pickedArm`), and nothing on the bullpen says so — so the fixed
   feature is unreachable by the obvious gesture.
7. **The mandate still moves.** The season-opening card asked for 17
   wins; the board then said 23. The stamped ask was supposed to end
   this — it is not being read in both places.
8. **The dossier tab does not scroll.**

## Batch S — space, size and density (the new room)

The app has the URL bar's height back, and the reporter wants it spent:

9. **The tonight card grows** so the two crests read properly.
10. **Larger text becomes the default.**
11. **Draft results: close the dead space** — marked twice in the
    screenshot, above the header and below the tab row. Also the clipped
    `0 DRAFTED · 7 GRADU…` tile.
12. **The recruiting board tightens**: smaller board title, smaller
    scholarship/budget/prestige tiles, a smaller filter button, less air
    between the sub-tabs and the first recruit. **The class screen too.**
13. **The manager sheet overflows the screen** — "Make the next move" is
    cut off at the right edge.
14. **The Ratings tab clips the hero**, cutting the OVR tile.

## Batch T — the deletions (every red line)

15. Player card › Overview: the whole bio paragraph. *Keep draft
    eligibility somewhere — it is the one fact the tiles below do not
    carry.*
16. Player card › Ratings › Arsenal: "The bar is how often, not how good…"
17. Player card › Ratings › Splits: "No split to speak of…"
18. Season › National: "Nobody remembers the poll…"
19. Program › Hall: "It meets in June…", and the "· NOT INDUCTIONS" half
    of the CAREER LEADERS kicker.
20. Dugout action sheet: **every sub-description under every button.**
    The titles carry it. (Judgement call flagged: "6 arms available" is a
    live number, not a restatement — it can survive as a count on the
    row.)
21. Today: one of the two red strips. Both say the day is held.

## Batch U — behaviour the reporter wants changed

22. **"Watch it play" becomes AUTO**, and it runs until the coach takes
    the game back — not a few plays and a handover.
23. **Sim week stops on an injury** and asks for a new lineup, instead of
    running to the end of the week and reporting it afterwards.
24. **The tonight card opens the opponent from anywhere on it** — the top
    of the card currently does nothing.
25. **Records and all-time marks leave the inbox.** Replaced by a trail
    of dots: the PROGRAM tab, then HISTORY, then the book, then the
    record itself. The reporter's reasoning: a new career would otherwise
    bury him in letters about first-ever anythings.
26. **No letter for a player you have already had a word with.**
27. **The captain screen needs a confirmation**, and looks empty as it
    stands.
28. **The season opener needs a way to refuse** — only TAKE THE SEASON
    exists. This is the front half of 20b (arguing the terms), so the
    button and the negotiation are one piece of work.
29. **Hood Hans must not sign pro every single time.** The event is
    liked; its certainty is not. He is a fixture, so his poach roll is
    presumably landing the same way every career.

## Batch V — the dugout's missing motion

30. **Three outs need a change-over animation.** The fielders currently
    teleport, and on one occasion the shirt colours swapped to the other
    club *mid-animation*.
31. **The sacrifice bunt has no animation at all** — the runner simply
    appears on the next base, with nothing from the batter or the ball.

## Stage work — bigger than a batch

32. **The program budget screen is a redesign, not a fix.** "There is no
    real dilemma of whom to hire — we would always go for the one on top
    of every list." That is the honest verdict on the hiring market: three
    candidates ranked by rating, and the best one is simply best. The
    money half of stage 22 shipped the *effects*; this is the *decision*,
    and it needs one. → folds into stage 22's remaining work.
33. **The school overview page redesign — already booked, and here is
    where.** `06-backlog.md` carries it twice: "The college profile, the
    rest of the pass" (the roster, results and dossier sheets get the
    treatment the overview and crest already got) and "The college action
    button rework". Both sit in the screen queue in `07-v1-plan.md`,
    waiting on a batch. The dossier scroll bug above belongs to the same
    screen, so the queue item and the bug should be done together.
34. **The offer card is a rebuild** — see `13-phone-report-pending.md` §11.
35. **Prestige still punishes a met mandate.** Three mandates met, three
    bonuses missed, prestige down. Raised more than once now. The
    cleared-board shelter exists in `nextPrestige`, so either the shelter
    is not firing for a partly-bonused season or the drag outweighs it.
    Needs measurement, not another tweak.
36. **Guided tutorial, the reporter's picture of it**: everything behind a
    blackish transparent scrim except the one control he should tap. That
    is the spotlight grammar, and it belongs to stage 19 with the titled
    card already booked there.

## The gesture question — answered separately

The reporter asked directly. See the reply in conversation and the
decision recorded in stage notes once taken.

---

## Items missed on the first sort — added September 4

Caught by the reporter asking me to re-read his own list against my
triage, which is exactly why he asked. Both were real omissions.

37. **The postseason next-game card says nothing about where you stand.**
    His words: "when we are in the next game there is no visual indication
    of record — I lost and it just gave me the TBD card and then came with
    the one-loss thing. We should add the record there very well visible,
    and add simple wording like winners bracket or losers bracket." So the
    card carries two things it does not today: **your bracket record**, big
    enough to read at a glance, and **which side of the draw you are on**
    in plain words. Related to the route-reading fix in batch P — that
    stopped the card lying about how you got there; this makes it say so
    out loud, and on the waiting card too, not only after a result.

38. **The dugout action sheet needs its buttons ORGANISED, not just
    stripped.** Item 20 captured only half the sentence: "we have to
    organise the buttons inside the action button, *also* remove the short
    explanation." The order and grouping are their own job — the sheet
    currently runs Watch it play · Sim the rest · Back to the desk · Go to
    the bullpen · Visit the mound, which mixes *leaving the game* with
    *managing the game* in one flat list.

**And one correction to item 5.** The postseason box score is not "silent
by design for a rival's game" — the reporter is explicit that the previous
design opened a box for ANY match tapped: "in the previous design we had
it so that we could tap any of the matches and it would show us the box
score but now it doesn't." That is a bigger job than a lookup fix, because
only the user's games are captured (`captureBoxFor`) and `boxScores` is
keyed by day while a June day holds many games. It needs a decision about
where a bracket game's box is stored and what that costs a save.
