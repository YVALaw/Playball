# The v1.0 Plan

**Written:** August 26, 2026 · **Revised:** August 26, 2026 (feature pass)
**Companion docs:** `01-roadmap.md` for the order at a glance, `06-backlog.md`
§H for the feature set and the argument behind each, `05-systems-reference.md`
for what the game does today.

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
rather than the code, which matters because stage 3 rebuilds the dugout around
a *larger* field.

---

## Stage 1 · Stop the game lying, and stop it losing things

**Size:** small–medium · **Value:** high per hour

- **A13** — the elimination card that tells a conference finalist his season is
  over when second place sends him to a regional.
- **Tournament win/lose cards** — they carry the biggest moments in the game
  and are a title and two lines in a box.
- **A thirty-season soak** — the new postseason machinery has never run more
  than a few years.
- **Resume an interrupted game (R1).** Phones interrupt. A backgrounded live
  game is lost today, because `LiveGame` is a running coroutine with closures
  on it. The fix is not to serialise the coroutine: persist the **day-start
  snapshot and the list of decisions made**, and replay them on load. The
  engine is deterministic and every decision is a small enum, so a replay lands
  on exactly the same sixth inning. This is the most player-hostile behaviour
  the game currently has on the platform it is shipping to.

**Exit:** nothing the game says is false, and nothing a phone call can destroy.

## Stage 2 · How you want to play

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
does in casual mode.

**Decisions:** whether there are two modes or three; what the casual preset
actually turns off; whether the mode is visible anywhere after creation.

## Stage 3 · The dugout

**Size:** large · **Value:** highest of any feature left

The redesign, plus four things that belong on the same screen.

- **The presentation rebuild** — a much larger field, fielders labelled by
  position, a base-state banner, batter and pitcher as cards with their season
  lines, count and outs as indicators, calls as wide buttons with their reason
  underneath, and the two missing controls: **LINE SCORE** and **REPLAY**.
- **Mound visits and pitcher confidence** — a limited resource that settles a
  wobbling arm.
- **Let the bench coach take it (R6)** — a third button beside SIM THE REST.
  Two behaviours worth having: *watch* (the game plays itself with the field
  animating, so you can just see it) and *to the next moment* (default calls
  until something worth managing arrives — men in scoring position, late and
  close, a pitcher on fumes). SIM THE REST is all-or-nothing today, so a
  player up nine runs faces forty taps or total surrender.
- **Opponent scouting reports** — spend prep before a series to learn the other
  side's tendencies. The tendencies already exist and are already hidden until
  watched; this is the other way to learn them.
- **Pitch-by-pitch calling** — full-depth mode only. Eleven pitch types and
  per-pitcher repertoires already exist in the engine; this is the UI that
  spends them.

**Exit:** the dugout is the best screen in the game.

## Stage 4 · The coach

**Size:** large

The last part of the game that is still a form.

- **Creation as an interview.** Answer baseball questions with real positions
  and real tradeoffs; the answers derive your skills, philosophy and starting
  experience. Nobody picks "recruiting 40"; everybody has an opinion about the
  bunt.
- **Coach personality badges** drawn from those answers and worn for a career,
  the way a player's are. Each names one channel — not a vaguer copy of the
  four skills.
- **Assistant coaches.** A pitching coach, a hitting coach, a recruiting
  coordinator, each with ratings that stack on yours. They get poached, and a
  good one leaves to become a head coach — which plugs into the carousel that
  already runs ninety-five rival careers. The single biggest personality
  addition available.
- **Press conferences.** Two or three questions after a big win or a bad loss;
  the answers move prestige, morale and how recruits see you. Reads the
  personality badges above.
- **The JOBS tab** — promised in `Program.tsx`'s own comment and never built.
  Browse openings, apply, interview.
- **The coach title ladder (B21)** — a named list of achievements per rung.

**Exit:** two coaches with the same record are visibly different men.

**Decisions:** what an assistant costs, and in what currency — prestige and
reputation keep them independent of stage 8's money, which is probably the
cleaner answer; whether an interview can be failed; whether press conferences
are skippable in casual.

## Stage 5 · The roster becomes a roster

**Size:** large · **Unblocks:** 6, 7 and part of 8

- **Depth chart with position eligibility** — a competence per position, not a
  boolean
- **Real DH handling** — the coach assigns the slot
- **Redshirts**
- **Position changes and position-change training**
- **Academic eligibility** — a man fails a class and sits. Uniquely college,
  and it makes recruiting a kid with questions a real decision.
- **Two-way players** — deferred for years and the decision has aged badly.
  Modern college baseball is full of them, and it is the most distinctive thing
  in the sport right now. Genuinely hard: one man in two rating systems with
  fatigue crossing both.

**Exit:** you manage a roster rather than reading a list.

**Decisions:** how position competence is modelled; whether a redshirt is a
coach's call or a rule; how academic risk is surfaced during recruiting;
whether a two-way player is a generated type or something a coach makes.

## Stage 6 · Players as people

**Size:** large · **Needs:** stage 5

- **Injuries** — the system that needs a depth chart most
- **Season-long fatigue and workload**
- **Playing-time expectations**
- **Morale**
- **Team captains and leadership** — a vote or your appointment; captains damp
  morale swings and mentor freshmen, which gives veterans a role beyond their
  stat line

**Exit:** a season has attrition, and a clubhouse that notices.

## Stage 7 · The transfer portal

**Size:** medium · **Needs:** stages 5 and 6

Both directions or it is not a portal.

## Stage 8 · The economy

**Size:** medium–large

Recruiting budget rebalance · player swaying as real negotiation · facilities
and budget upgrades.

## Stage 9 · The world

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

## Stage 10 · The dynasty remembers

**Size:** medium · **New stage**

- **Alumni in the pros** — every departure is already recorded with a reason.
  Show what happened next: a former recruit in Double-A, one who made an
  All-Star team, one who washed out. Nothing motivates a long dynasty more,
  and the data is already in the save.
- **Signature moments** — a player's card remembers his walk-off, his
  no-hitter, the day he went five for five. Box scores and feats are already
  captured; this is the layer that turns them into a life.

**Exit:** a fifteen-year save is a history rather than a number.

## Stage 11 · Broadcast

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
- **Awards night** — flip cards, one reveal at a time, and a celebration when
  the winner is one of yours.

**Exit:** the game sounds and looks like the sport it is about.

## Stage 12 · The simulation's last mile

**Size:** medium

Run-expectancy AI · recruits drafted out of high school · park effects as
geometry · camera easing, instanced markers, a real 2D/3D toggle · the
measurement debt (the walk deficit, `sim.ts parity`, single-sample calibration
figures).

## Stage 13 · The store

**Size:** medium–large · **Needs:** the Console record

The S+ player himself, and Play Billing with purchase, restore, receipt
validation and the offline case.

**Decisions, and these are the important ones:** what the purchase grants — one
player per dynasty, one per save, a recruit who appears in your class, or a
create-a-player; consumable or permanent; and what happens to a dynasty already
in progress. Its own design pass before any billing code.

## Stage 14 · The phone

**Size:** small–medium · **Deferred — no device yet**

Capacitor, an APK on real hardware, the frame-rate measurement, IndexedDB
across a force-quit, safe-area insets, the hardware back button. Everything
except the frame rate can be answered on an emulator, so the emulator pass can
be pulled forward alone if the wait runs long.

## Stage 15 · Ship

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

**Stages 5 → 6 → 7 are a chain** and cannot be reordered: a depth chart makes
injuries possible, injuries and playing time make morale mean something, and
morale is what gives the portal its teeth.

**Stages 9, 10 and 11 are independent** of everything above and of each other.
They are the ones to move earlier when the big systems get heavy — and stage 11
in particular will feel like a bigger jump in quality than its size suggests,
because silence is the loudest thing about the game right now.

Stage 4's assistant coaches touch stage 8's money if they are paid for, which
is the argument for paying them in prestige instead. Decide that at stage 4's
door, not stage 8's.

## What did not make the list

From the feature pass: a human poll alongside RPI, weather and park conditions,
fan support and attendance, live bracketology, mentorship pairs, defensive
positioning. From the earlier report: exhibition games, classic-finish
scenarios, share cards. All stay in `06-backlog.md`; none of them is a reason
to delay a release.

## How this document stays true

A stage moves out of this file when it ships, and what it did moves into
`05-systems-reference.md` on the same commit.
