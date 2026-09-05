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

---

## Added September 4, later — the front door and the save files

39. **The save files screen is messy and does not work as intended.** The
    reporter's headline case: **"hitting delete a save doesn't really delete
    it."** Root cause found and fixed the same session — `saveNow` defaults
    to the autosave slot and a large part of the app calls it, so deleting
    the file the live career was writing to was undone by the very next tap.
    The file was genuinely gone; the career put it straight back. **The rest
    of the screen — its layout, its wordiness, and the three long
    machine-voiced paragraphs the language audit already flagged — is still
    owed.**

40. **A starting screen.** "Like new game, load game etc." **Built**: the app
    now opens at its own front door instead of resuming the last career
    automatically — CONTINUE (the most recent save, with school, year,
    record and how long ago), NEW CAREER, LOAD A CAREER, SETTINGS. Nothing
    is read off disk until a door is chosen.

    The two are one piece of work: a career needs somewhere to be let go
    **of**. Deleting the live slot now closes the career and stands the
    player back at the door, with the sim generation bumped and the worker
    disposed so nothing in flight can write it back. Walked live — deleted,
    poked the app the way a tap would, and the row stayed gone.

---

## Coverage audit — September 4, at the reporter's insistence

He asked me to re-read his own list against this triage, twice, and both
times it found something. This is the verified state, checked against the
CODE rather than against memory.

**41. The recruiting budget tile contradicted itself** — and this one had
been written down in `13-phone-report-pending.md` §1 and then **never made
it into the numbered list here**, which is exactly how an item gets lost.
Cause: the big number was what is left of THIS WEEK (29) while the note
printed the whole window (159), and the slash read as a division giving 53.
Both true, of different things. The note names its own number now.

**Item 5 (the postseason box score) is closed.** Not a lookup fix: a June
game now carries its lines on its own summary, which is what the bracket
slot stores, so a rival's game is as readable as yours. Measured cost —
2,195 bytes a box, about 640 KB across a full June — and it never
accumulates, because the bracket is cleared when June ends. The day-keyed
store is untouched, so the regular season and older saves are unchanged.
Four pins, written at the engine seam **after the first version of them
silently skipped**: it reached for `season.bracket`, which does not exist
(the bracket lives on the store), so the guard returned early and the test
passed without asserting anything.

### Verified present in code

Tonight card crests at 52 · text default 1.3 · hold-to-open on the lineup ·
AUTO, and the bail-out that made it "a few plays" is gone · `playedAt` on
TeamState · rims with `depthWrite={false}` · FLIP measuring `offsetTop` ·
the start screen · a bracket slot's own box.

### Verified ABSENT, and still owed

The sac-bunt animation · the three-outs changeover · a confirmation on the
captain screen · a way to refuse the board (the only "refuse" in App.tsx is
three unrelated comments) · sim-week stopping on an injury · records
leaving the inbox for a trail of dots · no letter about a man already
spoken to · Hood Hans's certainty · the draft's dead space · the
recruiting and class density · the Ratings hero clip · the postseason
card's record and bracket wording (37) · the dugout sheet's grouping was
done, its ORDER question (38) settled · the budget screen redesign · the
offer card · the prestige balance · the saves screen itself.

---

## The last of the list — September 4, late

**35. Prestige stopped punishing a met mandate, and it was measured both
ways before and after.** The complaint was exactly right and the mechanism
was not what the code's own comments implied: the shelter required a May
appearance or a winning record ON TOP of the cleared board, and a
develop-mandate board is routinely cleared at 20-25. Measured, a cleared
board and an uncleared one landed on the SAME number at every standing —
54 → 52 either way. Clearing the checklist bought nothing.

A cleared board now HOLDS the standing below 70. It does not build: the
gentler rate is still the shown season's alone, so nothing drifts a quiet
programme upward. The cap at 70 came out of measurement rather than taste
— run to the summit it moved the league mean +1.2 and nearly doubled the
90+ bucket (1.1 to 2.1 of ninety six), and the top of the table growing
was never what the complaint was about. Capped, the carousel reads mean
55.9 against a 55.4 baseline with 85+ at 10.1 against 11.5. Four pins hold
both halves: the complaint fixed, and the league not inflated by fixing it.

**39. The saves screen is a saves screen.** The delete bug was fixed
earlier; this is the mess. It had grown two sections that belong elsewhere
and now said so twice — HELP, the tutorial reset Settings already owns and
the language audit flagged, and START AGAIN, which is the front door's NEW
CAREER now that the front door exists. Both gone, with the dead modal and
state behind them. The autosave's delete warning was also lying: it still
said a played career "writes a new one straight back", which was true
until the delete was fixed and is not now.

**34. The offer card, rebuilt rather than trimmed.** The fault was
organisation, not sentences: three rows carried three different grammars
for a heading, the nickname changed number halfway down, and THE MANDATE —
the row that decides whether you take the job — carried no number while a
rivalry fact sat filed under it. One grammar now, in the order a coach
asks: THE JOB, THE PLACE, THE ASK · N WINS, with the rivalry as an aside.
The ask is stated in the same terms the program page will later hold you
to.

**Still owed:** the budget screen redesign (32), which is a design
conversation rather than a fix — "there is no real dilemma of whom to hire,
we would always go for the one on top of every list."

---

## The list is closed — September 5

Item 32, the budget screen, was the last of the thirty-eight. Measured
before it was touched and the reporter's read was righter than he knew:
the top candidate was not merely better but better VALUE (7.66 skill
points per $100k at rating 88 against 5.00 at 27), so the list was
correctly sorted with a dominant top — and three of them cost 49% of a
mid-table budget, so nothing was given up either. A man is a shape now
(the WINTER he builds against THE NIGHT he is worth), wages curve so the
value column reverses, an assistant is worth less where the coach is
already strong, and the plant branches into three buildings bought once
apiece. The screen shows the fit and not the answer, which was his call.

**Everything from the APK report is done or booked as its own stage.**
What remains is in `07-v1-plan.md`: the tail (17 store, 19 ship), the two
booked design doors (20b arguing the terms, 24 the creation interview),
the new art stage (25), and the screen queue.

**Later the same day — the interface pass** (`05` §50) rebuilt the budget
screen again on top of item 32's decision: the shapes and the curved wages
stayed, the plant grew three levels per building, and the whole thing moved
into a Plan · Staff · Facilities · Network workspace. The reporter's verdict
on the visual side (stage 26) is still owed. The same pass closed both
screen-queue items and stage 24's question count. Its review list is
`06` §X.
