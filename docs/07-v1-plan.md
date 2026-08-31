# The v1.0 Plan

**Written:** August 26, 2026 · **Revised:** August 27, 2026 (stages 1–4 closed;
3 and 4 were added the same day, out of playing what stage 1 shipped, and
everything after them renumbered)
**Companion docs:** `08-handoff.md` for where the last session stopped and what
the next one picks up, `01-roadmap.md` for the order at a glance, `06-backlog.md`
§H for the feature set and §I for the August 27 pass, `05-systems-reference.md`
for what the game does today.

**Where the work stands: stages 1 through 4 are done. Stage 5, the dugout, is next.**

**Nineteen stages now.** The old stage 5 was split: the dugout is presentation
over a stream the engine already emits, and the systems that reach *into* the
simulation are their own stage behind it.

---

## What was decided

| Question | Answer |
|---|---|
| Scope | **Everything.** Polish, the parked design passes, the depth systems, and the August feature set. |
| Platform | **Android first**, iOS when the means exist. |
| Money | **Free, with the S+ player as an in-app purchase.** |
| Date | **None.** Ship when it is right. |
| The phone | **No Android device yet**, so the device work waits until late. |
| Depth | **Two ways to play**, chosen at creation and changeable after. See below. |

## The decision that shapes everything else

**A player chooses how deep a game he wants, and the game respects it.**

Coach creation asks whether this is a full roleplay career or a casual one, and
that answer sets a preset. Everything the feature set adds — press conferences,
academic eligibility, captains, pitch calling, mound visits, scouting reports —
sits behind it.

Three rules keep that from becoming two games in one codebase, and they are not
negotiable:

**One. The engine always models everything.** The mode never changes what the
simulation does; it changes what the player is *asked about*. Casual does not
turn injuries off, it answers the injury question for you. The moment the mode
reaches into the engine, the ninety-five rival programs are living in a
different world from yours and every comparison in the game is a lie.

**Two. Anything that touches the world is on for everybody or off for
everybody.** Conference realignment, academic eligibility, injuries — these are
properties of the league, not preferences. A casual player and a full-depth
player in the same save must see the same league.

**Three. The preset is a preset, not a cage.** Individual toggles sit behind it,
so "casual, but I want to call pitches" is a thing a person can have, and the
mode can be changed mid-career without starting over.

## Two errands that cost nothing and need no phone

**Create the Play Console record and merchant account.** A web form that starts
two clocks otherwise sitting at the end of the project: merchant verification
takes days, and in-app products cannot be tested until an app record exists.

**Take a throttled performance profile in the browser.** The question the
deferred phone work leaves open is whether the 3D field holds a frame rate on
mid-range hardware. A Chrome profile at 4× CPU throttle is not the same
measurement, but it catches a disaster — and a disaster here changes the design
rather than the code, which matters because stage 5 rebuilds the dugout around
a *larger* field.

---

## Stage 1 · Stop the game lying, and stop it losing things — **DONE, August 2026**

**Size:** small–medium · **Value:** high per hour

- **A13** — the elimination card that tells a conference finalist his season is
  over when second place sends him to a regional. *Done, and it was wider than
  reported: a protected team losing its regional got the same funeral.*
- **Tournament win/lose cards** — they carry the biggest moments in the game
  and are a title and two lines in a box. *Tidied to a headline and one line;
  the full big-moment treatment is stage 13 and was deliberately not done twice.*
- **A thirty-season soak** — the new postseason machinery has never run more
  than a few years. *`npm run soak`. Thirty Junes, no structural faults; it
  found a balance question instead, in `06-backlog.md` §F.*
- **Resume an interrupted game (R1).** Phones interrupt. A backgrounded live
  game is lost today, because `LiveGame` is a running coroutine with closures
  on it. The fix is not to serialise the coroutine: persist the **day-start
  snapshot and the list of decisions made**, and replay them on load. The
  engine is deterministic and every decision is a small enum, so a replay lands
  on exactly the same sixth inning. This is the most player-hostile behaviour
  the game currently has on the platform it is shipping to. *Done, in the
  regular season and the postseason both.*

**Exit:** nothing the game says is false, and nothing a phone call can destroy.
**Met.** The detail is in `05-systems-reference.md` §21; what to pick up next is
in `08-handoff.md`.

## Stage 2 · How you want to play — **DONE, August 2026**

**Size:** medium · **Foundational — everything after it reads this**

- **The depth choice** at coach creation: full roleplay career or casual.
  Presented as a question about how you like to play, not a difficulty menu.
- **Per-system toggles** behind the preset, and a way to change the mode
  mid-career.
- **The settings sheet (R4)** — sound, haptics, field 2D/3D, text size,
  reduced motion, tutorials reset, and saves migrating in from the portrait
  menu. Stored per device rather than in the save: preferences follow the
  phone, not the dynasty.

**Exit:** every system built after this has a documented answer for what it
does in casual mode. **Met** — the catalogue in `state/depth.ts` carries one
per system, including the unbuilt ones.

**Decided:** two modes. Casual auto-answers rather than hiding, and does it
silently. It handles lineups and the bullpen today. The question is coach
creation's second screen. The full toggle list ships with unbuilt rows greyed.
Settings lives in the portrait menu with saves folded in. Text size is real.
Switching is free, any time. Detail in `05-systems-reference.md` §22.

## Stage 3 · June, made legible — **DONE, August 2026**

**Size:** medium–large · **New stage, August 27 2026** · **Value:** high

The postseason was rebuilt this month and then played, and the verdict from
playing it is that the *format* works and the *screen* does not. Everything
here comes from that pass. One item is structural; the rest is a bracket that
does not tell you what happened.

- **Cut the opening round.** Reported plainly: it "is confusing as heck and I
  think it is not really needed." It exists to trim twenty teams to sixteen,
  and it is the one stage a player meets with no idea why he is in it. Fold
  those teams into the winners bracket and let the bracket itself decide where
  everyone goes. This is engine work — `openingPairs`, the protection swap and
  `stageOpening` all come out or change shape — and it touches the soak, the
  field-selection tests and the saved-bracket guards, so it is designed before
  it is cut.
- **The championship of every competition opens a modal**, not a slot you have
  to find. Conference, regional, national: when the title game is live or
  finished, the information comes to you.
- **A card for who won, and one for the national champion.** Today the result
  is a thin stripe at the foot of the page and the national title sits so far
  down that it was missed entirely — *"I didn't even know it was down there."*
  A champion is the loudest thing that happens in a season and it currently
  reads like a footnote.
- **Tap a bracket game to see it.** Asked for more than once and still not
  built. Line score, the pitchers, the swing of it — a bracket where every game
  is a dead score is a table with corners.
- **Postseason statistics.** There is no way to see them at all. Who hit in
  June is half of what a June is remembered for.
- **Say so when a season is actually over.** If a team missed the conference
  final and its record will not reach the national field, tell it. Stage 1
  stopped the game announcing false funerals; this is the other half — a team
  that really is finished should not be left refreshing a bracket.
- **Less text on the June cards.** The out-of-the-showdown card is liked and
  still over-written. The standing rule, and it applies to every card added
  after this: *these are visual tellings of where you are and what you
  achieved, in simple wording — they do not explain.*

**Exit:** a player can read his own June at a glance, and knows the moment it
ends. **Met.** Detail in `05-systems-reference.md` §23.

**Decisions:** what replaces the opening round exactly — a bye structure, a
larger winners bracket, or a smaller field; whether the modal is the same
component as the win card or a different one; how far back postseason stats go
on an old save.

## Stage 4 · Give the screen back — **DONE, August 2026**

**Size:** small · **Value:** high per hour

A phone screen is the scarcest resource in the game and several recent
additions spend it badly. Individually trivial, collectively the difference
between a screen that breathes and one that does not.

- **The two roster filters are far too big**, eating the space the roster pass
  was trying to win back.
- **Delete "he is in your pipeline"** from the recruit rows. It is a sentence
  where a mark would do.
- **The prospect sheet opens too small** — bigger, so more of it is readable at
  once, but deliberately not full screen.
- **The action button moves between offseason tabs.** Reported before and not
  yet fixed: a tab with less content lets the button ride up, so the one
  control that is always in the same place stops being in the same place. It
  gets pinned.
- **The season record is too easy to lose** beside the inbox badge. Bigger — or
  better, and this is the preferred answer, moved up next to the date in the
  header where the eye already goes.

**Exit:** nothing on screen is bigger than its importance. **Met.** Detail in
`05-systems-reference.md` §24 — including why the action button needed two
attempts.

## Stage 5 · The dugout

**Size:** large · **Value:** highest of any feature left · **No engine risk**

Split out of the old stage 5 deliberately. Everything here is presentation over
a stream the engine already emits, so the best screen in the game can land
without putting a calibrated simulation at risk in the same pass. What reaches
*into* the engine is stage 6.

- **The presentation rebuild** — a much larger field, fielders labelled by
  position, a base-state banner, batter and pitcher as cards with their season
  lines, count and outs as indicators, calls as wide buttons with their reason
  underneath, and the two missing controls: **LINE SCORE** and **REPLAY**.
- **Let the bench coach take it (R6)** — a third button beside SIM THE REST, in
  two behaviours: *watch* (the game plays itself with the field animating, so
  you can just see it) and *to the next moment* (default calls until something
  worth managing arrives — men in scoring position, late and close, a pitcher
  on fumes). SIM THE REST is all-or-nothing today, so a player up nine runs
  faces forty taps or total surrender.

**Delivered, and what changed on contact with a phone.** The linescore was
briefly folded behind a LINE SCORE button and came straight back out: it is the
one thing on the screen that answers "where are we" without being asked, and a
scoreboard you have to press is not a scoreboard. It sits on the bar with
R/H/E. REPLAY is not built.

**Deferred out of this stage, by request: the park itself.** The field is
bigger and reads correctly, and the ballpark's *visual* — crowd, stands,
lighting, the look of the place rather than the geometry of the play — is its
own piece of work with no simulation in it. It waits for the broadcast stage,
where sound and celebration land, so the park gets treated once and properly
rather than twice by halves. Logged in `06-backlog.md` §K1.

**Exit:** the dugout is the best screen in the game.

**Do first, and it needs no phone:** the throttled browser performance profile.
This stage rebuilds the dugout around a *larger* 3D field, and a frame-rate
disaster there changes the design rather than the code.

## Stage 6 · The dugout's depth — **DONE, August 2026**

**Size:** medium–large · **Touches the simulation — calibration applied**

**Shipped.** Confidence sits beside fatigue as `HEAD` beside `ARM`, centred so
level confidence changes nothing and a calibrated engine could take it. The
mound visit restores confidence only, once per pitcher per outing, and all
ninety-six programs use theirs. Measured twice: components moved under one
percent, and title concentration held at a mean of 9.4 across five worlds
against 9.4 before. Scouting moved to the economy. The visit *conversation* —
three registers read against a pitcher's temperament — is designed and deferred
to stage 7, where it can read the coach's badges too. Full write-up in
`05-systems-reference.md` §26.

The half of the old stage 5 that reaches into the engine. Both items are
depth-mode gated and both need the measured treatment fatigue got: isolate the
channel, measure it against the calibration sweep, dial it.

- **Pitcher confidence, alongside fatigue.** Fatigue is already real and always
  has been — a stamina-derived pitch budget (stamina 80 is roughly 98 pitches),
  then a multiplier degrading to a floor of 0.55, feeding every plate
  appearance, with times-through-the-order beside it. Confidence is the *new*
  channel: a hidden per-outing state that drifts on what just happened — a
  walk, a home run, a long inning — and feeds the plate appearance the way
  fatigue does. Both are taken into account, which is the arrangement asked
  for.
- **Mound visits.** A limited resource that steadies a wobbling arm, which is
  what gives confidence something to be for.
- **Opponent scouting reports.** Spend prep before a series to learn the other
  side's tendencies. The tendencies already exist and are already hidden until
  watched; this is the second route to them and the one that costs something.

**Exit:** a pitcher's outing has a shape, and you can do something about it.

**Cut from v1.0: pitch-by-pitch calling.** Not deferred — dropped, and the
reason is worth keeping. The shipping engine resolves a plate appearance with
log5 and *then* sequences pitches backwards to land on that outcome, so a pitch
you called could not change anything. The three ways out were: make the call a
real input the way a bunt is (honest, but a new calibrated channel for a
full-depth-only feature), run a different engine for managed games (breaks the
rule that managing must not change the odds, and makes every record slightly
dishonest), or leave it as theatre. Dropping it is the fourth. The eleven pitch
types and per-pitcher repertoires stay exactly what they already are: what
colours the play-by-play, and what tendencies and scouting are made of.


## Stage 7 · The coach

**Size:** very large · **SHIPPED — all eight pieces** · **Mostly writing, and the writing is the point**

Full write-up in `05-systems-reference.md` §29, including the five faults that
only a measured distribution could have found, and §29.8 for what two seasons
of actually playing it turned up.

**Played August 28, 2026.** Sixteen reports, eleven fixed the same day; the
table is in backlog §K. Three things the stage still owes:

- ~~**Piece 8, the press-conference pool.**~~ Shipped August 28. Twenty
  questions over nine triggers, eight a season with a four-game cooldown, and
  every trigger a fact the season already produced rather than a counter
  invented to feed it. The badge payoff is the point: an answer belongs to a
  badge, wearing it makes the answer land, and the screen says SOUNDS LIKE YOU
  rather than printing a number.
- ~~**The five creation questions are too long.**~~ Done. The questions were
  never the long part: the asks median 19 characters, the setups median 107 and
  ran to 163. All eighty setups are one line now, median 63, held there by a
  test — this is the kind of thing that grows back a clause at a time.
- **The cold letter now bites often enough to be a gamble** (12% → 18%, so a
  season's three letters reply 45% of the time rather than 32%), but nothing
  else in the game acknowledges having written one. It reads as a control with
  no consequences until the carousel.

The last part of the game that is still a form, and the stage where a coaching
career stops being something that merely happens to you. Planned in depth
August 28, 2026; every decision below is settled.

**The rule this stage is built on:** it has to feel different every time. A
system that is identical on a fifth dynasty is a system people stop opening, so
the pools are large, the thresholds are seeded, and the places in it want
different things.

### The voice

**Deadpan, with a straight man.** The humour is in the situation and in the one
answer that is too clever by half — never in a joke being told, because a joke
read four times is worse than a line that was never trying.

### Piece 1 · School culture — **SHIPPED**

Every one of the ninety-six believes something: a name, a creed in its own
voice, the one thing it is known for, and two dials — **patience** (how long
before the board starts counting) and **ambition** (what clearing the bar means
here). Ambition is deliberately *not* prestige.

**Hand-written, all ninety-six.** Deriving it from prestige and region would
have produced prestige wearing a hat, and the test in `tests/cultures.test.ts`
exists to catch exactly that — it failed on the first pass, which is how the
hand-written version came to have twenty-two programmes that disagree with their
own standing.

Visible on every school page under WHAT THEY BELIEVE. Nothing here touches the
simulation.

### Piece 2 · The creation questions — **SHIPPED**

Creation becomes **five steps**: your coach → how you want to play → **the
questions** → set your plan → take a job.

- **Eighty in the pool, five asked.**
- **Filtered by context** — who might want you, and what kind of place it is.
- **The effect of an answer is shown**, because a character question you cannot
  read the consequence of is a guess rather than a choice.
- **No going back**, and no topic filtering — the same subject may come up twice.
- Each answer grants **+2 across the four skills**, and **may cost something**:
  `+3 recruiting, −1 training` is a real answer.
- An answer may also grant **something other than skills** — starting prestige, a
  contract year, a state pipeline.
- **Two badges** come out of the five.
- **It cannot be failed.** Answers change which programmes want you, never
  whether somebody does.

**Casual gets a two-question version** rather than skipping it. Five questions is
a slow start; zero means the best-written thing in the game is invisible to the
people most likely to bounce off.

### Piece 3 · Offers that read culture — **SHIPPED**

- **Five offers.** Culture can **remove** a school that prestige alone would have
  offered, and can make one reach below its usual standing for you.
- **The pitch line says why they called** — "they think you will develop what
  they have" rather than "a step up".
- **A seeded wobble**, so the same seed and the same answers still produce a
  slightly different desk on a replay.

### Piece 4 · Titles — **SHIPPED**

**Twelve rungs describing a career's shape**, not a points total. *Journeyman*
means **six schools**, not a beginner — which is the actual fix for 71 of 96
coaches wearing it at year thirty. *Respected* is a man who never won it all but
kept reaching June, or kept **overachieving against the mandate**, which is
already modelled and tuned.

You wear one, chosen by priority. **Rivals wear them too**, on their own pages.

*This replaces the existing `coachStanding` ladder rather than sitting beside
it.* New state required: nothing currently records which schools a coach has
worked at.

### Piece 5 · The cold approach — **SHIPPED**

- **On the school's own page in Colleges**, under the overview, beside what they
  believe — which is where somebody actually goes looking.
- **No odds shown.**
- **Three attempts a season**, never the same school twice.
- **Culture decides whether the approach is welcome.** A tradition-heavy
  programme resents being approached at all.
- **Being caught can end you** — sometimes, and worst at a school already unhappy
  with you.

### Piece 6 · Badges earned by playing — **SHIPPED**

Two from the questions; the rest from how you actually play. **Five carried at
most**, and they are permanent. The game watches how you manage a game, how you
build a roster, how you handle people, what your teams do — and, deliberately,
**whether you read the wire** and **whether you talk men out of the draft**,
which rewards engaging with the game rather than optimising it.

**Counters hidden, thresholds seeded.** Nobody is told how many of anything is
enough, and the number differs per save: one decision that kills farming and adds
replay variety at the same time. A badge arrives as a congratulation card.

**Badges interact with culture** — a developer is worth more at a school that
develops.

### Piece 7 · Culture reaches the simulation — **SHIPPED**

Held until last on purpose, and measured alone. The slight effects: a
development school gets a little more out of its returning players, a pitching
school a little more from its arms. **Slight** is the word that was used and the
word that governs — this is ninety-six new modifiers going into a calibrated
engine, so it gets the treatment confidence got: isolate, measure against the
sweep, dial.

**Culture also drifts.** A school that keeps failing grows impatient; a new
athletic director arrives with different ideas.

### Piece 8 · Press conferences — **SHIPPED**

Five to eight a season, only after something real, each reading your badges and
moving prestige, morale and how recruits see you. **The pool waits** until the
creation questions have been played with, because writing sixty situations
before knowing whether the voice lands is the risk.

**Exit:** two coaches with the same record are visibly different men, the job
market is somewhere you can act rather than only be acted upon, and a second
dynasty does not ask you the same questions as the first.

**Moved out:** the mound visit conversation to stage 15; 3D cards to stage 14.

**Open:** whether each postseason tournament gets its own aura, raised while
planning this — logged in `06-backlog.md` §K6.


## Stage 8 · The roster becomes a roster

**Size:** large · **SHIPPED August 28 2026** (two-way split out) · **Unblocks:** 9 and the portal

Full write-up in `05-systems-reference.md` §30, including the three faults it
produced: a chart that re-picked 94 of 96 lineups, a failing grade nobody could
have, and a catcher offered as free cover at shortstop.

- **Depth chart with position eligibility** — a competence per position, not a
  boolean
- ~~**Real DH handling**~~ — the coach assigns the slot, which ships. Declining
  the DH so the pitcher hits does **not**: the batting order is `Hitter[]` and a
  pitcher has no hitting ratings, so it needs the same two-systems-one-man model
  that split two-way out. It ships with them.
- **Redshirts**
- **Position changes and position-change training**
- **Academic eligibility** — a man fails a class and sits. Uniquely college,
  and it makes recruiting a kid with questions a real decision.
- **Two-way players** — deferred for years and the decision has aged badly.
  Modern college baseball is full of them, and it is the most distinctive thing
  in the sport right now. Genuinely hard: one man in two rating systems with
  fatigue crossing both.

**Exit:** you manage a roster rather than reading a list.

### Decisions — settled August 28 2026

**Position competence is a penalty, not a matrix.** One primary position and a
cost for playing away from it, rather than nine ratings a man. Nine ratings is
2,200 numbers a season that mostly say "he cannot play there", and a penalty can
be made zero-sum by construction where a matrix cannot.

**The defensive spectrum is the model.** `DH - 1B - LF - RF - 3B - CF - 2B - SS
- C`. Downhill is free, uphill costs per rung, and catcher carries a surcharge
on top because it is a separate trade rather than a harder version of the same
one — asked for in those terms: in The Show, an outfielder behind the plate
watches his overall drop.

**Secondary positions are derived, never stored.** Generating a field onto a
player would move every random draw after it and break every golden. Derived
from his primary and the ladder, the way `playedPosition` already derives a
DH's real position. The consequence is that the whole model is *inert* until a
depth chart lets a coach move somebody: rosters are built to fit positions, so
every penalty in the league is currently zero and no calibration figure moved.

**No position training.** A man is here two to four years; a system that spends
one of them teaching him second base spends most of what you have.

**The depth chart is both** a lineup card and a per-position ranking. And there
is no BENCH as a category: a man not starting is simply *benched*, which is what
the word means. Enforced rather than advisory. Casual promotes automatically;
full career asks.

**The DH is the modern two-way rule** — a pitcher may hit for himself and stay
in as DH after being pulled — and the coach may decline the DH entirely.

**Redshirts** (decided here rather than asked): declared before the season, for
freshmen and sophomores, and he plays *no* games that year, which is the real
baseball rule and a real cost on a 23-man roster. His class year does not
advance, he develops slightly slower without live pitching, and he is yours a
fifth year. Three a season, or a whole class gets redshirted. Casual does it for
you.

**Academic eligibility is your program's alone** — grades are not simulated for
the other ninety-five, which makes it a fraction of the feature it looked like.
A visible, manageable rating rather than a hidden roll. One week out. It should
sometimes land on your ace in June, but not often.

**Managing it is "a word with him"** — three or four conversations a season, on
the player's card, scarce and non-cumulative, the same shape as the three
letters and the draft's keep budget. Deliberately *not* money: the economy is
stage 11, and building against a system that does not exist is how `Builder`
shipped as a title nobody could wear. It reads the coach's badges and his
training skill. When morale arrives in stage 9 it is the same mechanism with
more uses, and when the economy lands it can buy more of them — an upgrade
rather than a rewrite.

**Position changes are proposed, not ordered**, with a penalty that decays, and
the game suggests them.

**Two-way players split out of this stage.** One man in two rating systems with
fatigue crossing both, a lineup card and a rotation both claiming him, and every
leaderboard deciding which half it ranks — that is not a small feature in a big
hat, and stage 8 is already large. They arrive two-way rather than being made,
they are rare the way they are in life, and pitching does not suppress the bat.

**Order within the stage:** depth chart, competence and the DH first, because
eligibility and redshirts both need somewhere to send a man. Academic
eligibility ships last and stays in the stage.

### What shipped

All of it except two-way players, which were split out by decision. The stage
rests on one choice repeated four times — **everything new is derived or
sparse** — so a save from before it has nobody failing, nobody sitting, nobody
settling and no chart, rather than everybody. Save growth is unchanged at
12.3 KB a year over a thirty-season soak.

The three faults are worth carrying forward, because two of them are shapes
this project keeps producing:

- **A state nobody can be in.** The grade distribution floored above the failing
  threshold, so the state the whole feature exists for was unreachable. Third
  time: `Builder`, then the regional that paid nothing, now this.
- **A feature that is correct and ruinous.** Ranking the chart on merit re-picked
  94 of 96 lineups — right in baseball terms, and it would have moved every
  number in the game.
- **A model that is right arithmetically and wrong about the sport.** The
  spectrum said a catcher could cover short. Found by looking at the screen,
  which no test would have done.

## Stage 9 · Players as people

**Size:** large · **SHIPPED August 28 2026** · **Needs:** stage 7

Full write-up in `05-systems-reference.md` §31. Decisions taken: injuries are
**league-wide** (the opposite of the classroom, and for the opposite reason —
a rival losing his ace is visible); **pure chance**, with no durability rating,
which makes the roll derived-not-drawn so a reload cannot re-roll it; morale
moves **performance and transfer risk, not development**; the promise is
**stated**, so breaking it is a thing you did; and there is **one** captain,
gated on the `makeup` badge family, because without the gate naming one is a
free buff on your best player.

- **Injuries** — the system that needs a depth chart most
- **Season-long fatigue and workload**
- **Playing-time expectations**
- **Morale**
- **Team captains and leadership** — a vote or your appointment; captains damp
  morale swings and mentor freshmen, which gives veterans a role beyond their
  stat line

**Exit:** a season has attrition, and a clubhouse that notices.

## Stage 10 · The transfer portal — **SHIPPED August 28 2026**

**Size:** medium · **Needs:** stages 7 and 8

Both directions or it is not a portal. That one sentence was the whole
specification and it held: a portal you can only sign from is a shop, a portal
you can only lose to is a tax.

Full write-up in `05-systems-reference.md` §32. Decisions: one window, between
the draft and recruiting; men enter off `flightRisk` and being buried, so a
departure is a promise somebody broke; you can talk a man round out of the same
budget; one move a career and immediately eligible; rivals shop it too; the
recruiting budget goes 40 to 56 because it now pays for three things where it
was fitted for two.

## Stage 10.5 · The screen

**Size:** large · **Inserted August 29 2026 · SHIPPED August 30–31 2026**

**How it actually shipped: as a design of record, not a rule set.** The Roster
Tabletop mockup was adopted 1:1 — its stylesheet generated into the app by
script (`scripts/adapt-prototype-css.mjs`) so the two stay diffable — and every
screen rebuilt on one shared kit (FixedHeader/FloatingAction, Overlay, the Kit
components, one sheet-into-the-frame portal). Five rounds of phone testing then
drove: dark mode; the app dressed in the school's own colours (accent family
derived per theme from one hue, `src/ui/accent.ts`); the desk holding until red
needs are dealt with; the captain's C; the job market; program actions on every
college profile. The player card and the portal — the two named worst — were
rebuilt outright. The one piece deliberately left: the tournament view, moved
to stage 15 by request, where it rides with the rest of the park's presentation.

Not a new system. A pass over what is already built, because a play report that
was two thirds interface is the game telling you where it actually is.

> *"we need to completely change the ui tho, things are waay too mashed together
> or not very clear, confusing etc."*

Ten stages of systems have shipped in a month and each one added controls to
screens that were laid out before those controls existed. Nothing here is
broken; the whole of it is too dense, and density is the failure mode you cannot
see from inside the change that caused it — every individual addition was small.

**Why it is a stage and not a tidy-up.** The instinct with an interface
complaint is to fix the three worst screens, and that is what produced the
problem: the roster filters were fixed twice, the offer desk's badge weighting
twice, the ball's outcome colour twice. A screen fixed alone gets fixed against
its own history rather than against the rest of the game. This is one pass with
one set of rules, applied everywhere, and the rules get written down first.

**The named worst, in the order they were named.**

1. **The player card.** *"the players card is one that needs the most work."*
   Named specifically: the PEP TALK button and the rest of the controls are
   "just a basic button" — five actions of quite different weight (a
   conversation, a rest, a redshirt, a relisting, a captaincy) all rendered as
   the same grey rectangle, stacked. A card that is a wall of identical buttons
   is a card that has no idea what it is for.
   - Injury has to read at a glance, on the card and in every list that mentions
     him. *Partly done August 29 — the roster rows now carry HURT / ACAD / R-S /
     REST — but the card itself is untouched.*
   - The actions need weight, grouping and a shape that says what kind of thing
     each one is.
2. **The portal.** *"liked the portal, but it needs some work, looks super plain
   and hard to read."* Two lists of names in one typeface. It is the newest
   screen in the game and the least designed.
3. **Everything else, against one rule set.** Spacing, hierarchy, what a label
   is for, when a thing is a button and when it is a row.

**Already done, out of the same report** — kept here because they are the
evidence for the stage rather than a substitute for it: the press room's frame
bug and its promotion out of an ambush into NEEDS YOU on the home screen; the
captain picker; MOVE HIM FOR GOOD; the roster's injury tags.

**Exit:** a screen the reporter stops describing as mashed together. Which is
not a measurable exit, and that is honest — this is the one stage whose test is
somebody using it.

**Decisions:** whether NEEDS YOU grows to own more of the home screen; whether
the card's actions become a sheet rather than a stack; whether the type scale
gets a proper ramp or stays `calc(px * var(--ts))` everywhere.

## Stage 11 · The economy, and the staff it pays for

**Size:** large

Recruiting budget rebalance · player swaying as real negotiation · facilities
and budget upgrades.

- **Assistant coaches.** A pitching coach, a hitting coach, a recruiting
  coordinator, each with ratings that stack on yours. They get poached, and a
  good one leaves to become a head coach — which plugs into the carousel that
  already runs ninety-five rival careers.

  They live here rather than in the coach stage because of what they cost:
  **the program's money**, decided deliberately over prestige or the recruiting
  pool. That makes hiring a hitting coach a real argument with the facilities
  and the board, which is the whole point of an economy — and it is why they
  should not ship first on a budget invented for them alone.

**Exit:** money is a decision with more than one sensible answer.

**Decisions:** whether an assistant's salary is annual or a signing cost;
whether you can be outbid for one mid-career; what a poached coordinator does
to next year's class.

## Stage 12 · The world

**Size:** medium · **New stage**

- **Conference realignment** — every few years programs move leagues on
  prestige and market. A twenty-year dynasty where the conferences never change
  is a spreadsheet; one where your rival defects to a bigger league is college
  sports.
- **Rivalry recognition** — `rival` is already in the school data and does
  almost nothing. Not a trophy: a series record that persists, a wire story
  every time it is played, a line in both schools' annals, and the rivalry
  named on the Today card when it comes round.
- **Series stakes (R8)** — the Today card grows a line of what tonight is
  worth. Half of this shipped with the overhaul (game number and series lead);
  what is missing is the rivalry line and the clinching line.

**Exit:** ninety-six programs behave like a country rather than a table.

**Decisions:** how often realignment fires and whether the user's program can
be moved against his will.

## Stage 13 · The dynasty remembers

**Size:** medium · **New stage**

- **Alumni in the pros** — every departure is already recorded with a reason.
  Show what happened next: a former recruit in Double-A, one who made an
  All-Star team, one who washed out. Nothing motivates a long dynasty more,
  and the data is already in the save.
- **Signature moments** — a player's card remembers his walk-off, his
  no-hitter, the day he went five for five. Box scores and feats are already
  captured; this is the layer that turns them into a life.

**Exit:** a fifteen-year save is a history rather than a number.

## Stage 14 · Broadcast

**Size:** medium–large · **New stage**

- **Big-moment presentation (R5)** — the peaks currently render like a Tuesday
  groundout. Leverage styling in the managed game, a scoreboard that changes
  tone during a no-hitter, and one full-screen card for a walk-off, a clincher
  or a title.
- **Sound and haptics (R3)** — the game is completely silent. A dozen short
  samples (bat crack, glove pop, the umpire's third strike, a crowd swell that
  scales with leverage, a walk-off roar) and haptics on contact and on outs.
  The cheapest personality multiplier the game has not spent.
- **The wire, upgraded** — more kinds, better prose, and the stories the new
  systems create: a realignment, a coach poached, a man three hits from a
  record before he gets there rather than after.
- **School emblems or crests** on the team card, the directory, the wire and
  the bracket.
- **Every card, in three dimensions.** Asked for while planning stage 7: depth,
  motion and effects on the cards themselves rather than flat panels. It lands
  here rather than beside the badge that prompted it, because a treatment built
  for one card and then rebuilt for the rest is the mistake this project has
  already made twice — the action button and the park both. One pass, every
  card, with the sound and the celebration that belong beside them.
- **Awards night** — flip cards, one reveal at a time, and a celebration when
  the winner is one of yours.

**Exit:** the game sounds and looks like the sport it is about.

## Stage 15 · The ballpark

**Size:** large · **New — everything about the 3D park, in one place**

**Carries the tournament view, by request (August 31):** *"I don't really know
where I'm at most of the time — let's defer this for later."* The bracket is
the last screen still wearing pre-port styling, and its real fault is that it
answers every question except *where am I and what happens next*. One
presentation pass with the park it is played in.

The dugout screen is finished; the *park* it draws is not. This is the stage
that stops treating the field as a diagram of where the ball went and makes it
somewhere games are played. Everything already queued that touches the 3D park
was collected here rather than left scattered across three stages, because they
are one piece of work and doing them separately means redrawing the same park
three times.

**The place itself.**

- **Stands, crowd and the shape of a ground.** Ninety-six programs currently
  play in one anonymous bowl. A park should say whose it is.
- **Lighting and time of day** — a midweek afternoon and a June night are not
  the same game.
- **School colours in the park**, not only on the cards around it.
- **Depth and scale.** The field got bigger in stage 5; it has not yet got
  *deeper*.

**Where the nine actually stand.** *Reported August 29 2026, and deferred here
by the reporter: "fielding players are out of positions, first and second are
one next to the other, same thing with SS and 3B. One other thing, there are
times when the second baseman goes all the way to the pitcher to catch a ball,
this one should be caught by the pitcher itself."*

Both are the same root. `STATIONS` in `Diamond3D.tsx` is nine hand-placed
coordinates that were fitted to look right in a diagram, and the middle infield
sits far too narrow — 1B at x 2.32 and 2B at x 1.68 are two thirds of a unit
apart when they should be most of the right side of the infield between them.
And `playPlan` picks whoever is nearest to where the ball stops, with a flat
penalty of 6 on the pitcher to keep him home; a ball dying in front of the mound
is still closest to a second baseman who is standing too close to it.

The fix is not to nudge the numbers. It is that the defense should stand where a
defense stands and each man should own a *region*, which is the same geometry
work the rest of this stage is doing anyway — which is exactly why it was
deferred to here rather than patched twice.

**The play, drawn better.**

- **Camera work** — easing, and a camera that follows the play rather than
  watching from one fixed seat. Carried over from the old stage 15.
- **Instanced markers** and the render cost that comes with a busier park.
  Carried over.
- **A real 2D/3D toggle.** The setting exists and the diamond is the fallback;
  they are not yet two equal ways to watch. Carried over.
- **REPLAY** — named in the stage 5 brief and never built. The play events and
  landing coordinates are already stored and already take zero random draws, so
  it is a player over an existing stream. It belongs here, with the camera that
  would make it worth watching. (§K2)
- **Fielder animation** beyond running to a point: the throw, the tag, the
  turn. What is there now is a summary, and the chase had to be capped at 1.15
  seconds to stop it outstaying the play.

**Park effects as geometry.** Carried over from the old stage 15, and the one
item here with a simulation in it: a short porch should be a short porch in the
model as well as in the picture. Calibration applies, so it lands last.

**Exit:** the ballpark is somewhere you would look at even when nothing is
happening.

**Do first:** the throttled performance profile, which has been an outstanding
errand since stage 5 and is now genuinely blocking — this stage adds geometry,
lights and crowd to a scene whose frame rate on mid-range hardware has never
been measured.

**Decisions at the door:** whether parks differ by program or by conference;
whether the crowd is modelled or painted; and how much of this survives on a
four-year-old Android, which is the question the profile exists to answer.

## Stage 16 · The simulation's last mile

**Size:** medium

Run-expectancy AI · recruits drafted out of high school · the measurement debt
(the walk deficit, `sim.ts parity`, single-sample calibration figures).

*Park effects, camera easing, instanced markers and the 2D/3D toggle moved out
of here into stage 15, where the rest of the park work lives.*

## Stage 17 · The store

**Size:** medium–large · **Needs:** the Console record

The S+ player himself, and Play Billing with purchase, restore, receipt
validation and the offline case.

**Decisions, and these are the important ones:** what the purchase grants — one
player per dynasty, one per save, a recruit who appears in your class, or a
create-a-player; consumable or permanent; and what happens to a dynasty already
in progress. Its own design pass before any billing code.

## Stage 18 · The phone

**Size:** small–medium · **Deferred — no device yet**

Capacitor, an APK on real hardware, the frame-rate measurement, IndexedDB
across a force-quit, safe-area insets, the hardware back button. Everything
except the frame rate can be answered on an emulator, so the emulator pass can
be pulled forward alone if the wait runs long.

## Stage 19 · Ship

**Size:** medium

Onboarding for the first ten minutes · accessibility (focus states; text
scaling now has a home in stage 2's settings sheet) · **remove the test aids**
(SIM SEASON, the loaded Pascagoula Tech roster) · keystore generated and backed
up permanently · signed AAB, listing, screenshots, privacy policy, content
rating · closed beta, then open.

---

## The order, and why

**Stage 2 is foundational.** Every feature after it needs a documented answer
for what it does in casual mode, and retrofitting that answer is far more
expensive than writing it as you go.

**Stages 7 → 8 → 9 are a chain** and cannot be reordered: a depth chart makes
injuries possible, injuries and playing time make morale mean something, and
morale is what gives the portal its teeth.

**Stages 11, 12 and 13 are independent** of everything above and of each other.
They are the ones to move earlier when the big systems get heavy — and stage 13
in particular will feel like a bigger jump in quality than its size suggests,
because silence is the loudest thing about the game right now.

Stage 6's assistant coaches touch stage 10's money if they are paid for, which
is the argument for paying them in prestige instead. Decide that at stage 6's
door, not stage 10's.

## What did not make the list

From the feature pass: a human poll alongside RPI, weather and park conditions,
fan support and attendance, live bracketology, mentorship pairs, defensive
positioning. From the earlier report: exhibition games, classic-finish
scenarios, share cards. All stay in `06-backlog.md`; none of them is a reason
to delay a release.

## How this document stays true

A stage moves out of this file when it ships, and what it did moves into
`05-systems-reference.md` on the same commit.
