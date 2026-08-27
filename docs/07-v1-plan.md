# The v1.0 Plan

**Written:** August 26, 2026
**Companion docs:** `01-roadmap.md` for the order at a glance, `06-backlog.md`
for the decisions behind each item, `05-systems-reference.md` for what the
game does today.

---

## What was decided

Four answers shape everything below.

| Question | Answer |
|---|---|
| Scope | **Everything.** Polish, the parked design passes, *and* the depth systems. |
| Platform | **Android first**, iOS when the means exist. |
| Money | **Free, with the S+ player as an in-app purchase.** |
| Date | **None.** Ship when it is right. |

Two of those change the plan's shape rather than just its length.

**The depth systems are in**, which means this is not a polish-and-ship
release, it is another year of game on top of a finished one. They also have a
dependency order that is not negotiable — injuries need somebody to replace the
injured man, and a transfer portal needs a reason to leave — so they cannot be
picked off in whatever order looks fun.

**There is real money in it.** In-app billing is the one part of this plan that
cannot be tested by writing more code: it needs a Play Console app record, a
merchant account, a signed upload, and a closed testing track before a single
purchase can be exercised. That has a lead time measured in days of waiting,
not hours of work, and it is the reason the shipping track no longer goes last.

## The one change I would argue for

The old roadmap said shipping goes last and blocks nothing. **That was true
when the game was free and it is not true now.**

Three unknowns are currently sitting at the end of the plan where they can do
the most damage: whether the 3D field holds a frame rate on a real
mid-range Android, whether IndexedDB survives an app restart inside a WebView,
and whether Play Billing behaves. Each is cheap to answer now and expensive to
discover in six months with everything built on top of it.

So **Stage 1 is a spike, not a feature**: get the game you already have running
as an APK on a real phone, measure it, and create the Play Console record so
the billing clock starts. Then build the rest knowing the ground is solid.

---

## Stage 1 · Prove it runs on a phone

**Size:** small–medium · **Value:** de-risks everything after it

The whole point of the project is a phone game that has never run on a phone.

- Capacitor project, Android platform, `dist` wired to the shell
- A debug APK installed on a real device
- **Measure**: frames per second during ball flight on the 3D field, cold start
  time, bundle size on device
- **Verify**: IndexedDB survives force-quit and restart (the save system's whole
  contract), safe-area insets are right on a notched device, the WebView is
  recent enough for what the app uses
- Hardware back button wired — trivial once Capacitor is in, and the single
  most jarring omission on Android
- Create the Play Console app record and an internal testing track. Nothing is
  published; this exists so billing can be tested later without a wait.

**Exit:** an APK on your phone that plays a season, with a measured frame rate
written into `05-systems-reference.md`.

**If there is no Android device to hand yet:** an emulator answers the
IndexedDB, back button and inset questions but proves nothing about frame rate.
That one measurement waits for hardware, and it is the only thing here that
does.

## Stage 2 · Stop the game lying

**Size:** small · **Value:** high per hour

Three things where the screen contradicts what actually happened.

- **A13** — the elimination card that tells a conference finalist his season is
  over when second place sends him to a regional. Branch on `placings`, and put
  the stake on screen *before* the final rather than leaving "the reset" to
  explain itself.
- **Tournament win/lose cards** — reported as looking too simple. They carry
  the biggest emotional moments in the game and are currently a title and two
  lines in a box.
- **A thirty-season soak** — the new postseason machinery has never run more
  than a few years. Sim thirty, watch for drift, orphaned state, growth in save
  size, and any year that fails to produce twenty unique national teams.

**Exit:** nothing the game says about what happened is false.

## Stage 3 · The dugout

**Size:** large · **Value:** highest of any feature left

The screen a player spends the most time on, and the one furthest from where
it should be. Backlog section C carries the full brief.

- A **much larger field** — it is 118px of a 178px strip today, on the screen
  whose entire reason to exist is the park
- Fielders **labelled by position** instead of anonymous dots
- A **base-state banner** across the field's foot
- Batter and pitcher as **cards with their season line** rather than one text
  row each
- Count and outs as **B/S/OUT indicators** in the top bar
- Calls as **wide buttons with their reason underneath**
- **LINE SCORE** — folded into the scoreboard strip today, cannot be opened
- **REPLAY** — re-run the last play; `playPlan` is already deterministic off
  `BallHit`, so this is nearly free

Constraints: the play log keeps real room, the 3D chunk stays lazy, the 2D
diamond stays the fallback, and the house identity wins wherever it disagrees
with the reference.

**Exit:** the dugout matches the reference in substance, in our own clothes.

## Stage 4 · The roster becomes a roster

**Size:** large · **Unblocks:** stages 5, 6 and part of 7

Everything after this needs to know who can play where.

- **Depth chart with position eligibility.** A lineup editor exists; whether a
  man can credibly play a position does not. This wants a rating or a derived
  competence per position, not a boolean.
- **Real DH handling on top of it.** `naturalPos` already derives what a
  generated "DH" actually is; this is the other half — the coach assigns the
  DH slot to whoever he likes, and it stops being a species of player.
- **Redshirts.** No concept exists anywhere. Interacts with ages, eligibility
  and the draft, so it lands with the eligibility work rather than after it.
- **Position changes and position-change training.** A shortstop who has lost a
  step becomes a second baseman, and a coach can push it.

**Exit:** you manage a roster rather than reading a list.

**Decisions needed at the door:** how position competence is modelled (rated
per position, or derived from tools plus a familiarity term); whether a
redshirt is a coach's call or a rule; whether position changes are permanent.

## Stage 5 · Players as people

**Size:** large · **Needs:** stage 4

- **Injuries.** The most requested missing system and the one that needs a
  depth chart most — an injured shortstop is a question about who plays
  shortstop.
- **Season-long fatigue and workload.** In-game fatigue and bullpen rest are
  modelled; nothing accumulates across a year, so a staff can be ridden all
  season for free.
- **Playing-time expectations.** A recruit who was promised a job and sits.
- **Morale.** The state the three above move, and the reason the portal has
  teeth.

**Exit:** a season has attrition, and a bench that notices.

**Decisions needed at the door:** how punishing injuries are (day-to-day only,
or season-ending); whether injuries are visible to recruiting and the draft;
whether morale is surfaced as a number or only as behaviour.

## Stage 6 · The transfer portal

**Size:** medium · **Needs:** stages 4 and 5

Both directions or it is not a portal: men leave because they sit, and men
arrive because they sat somewhere else. This is where morale, playing time and
the depth chart pay off, which is exactly why it is not earlier.

**Exit:** a roster can change between Junes without a draft or a signing day.

**Decisions needed at the door:** whether the portal is a window or always
open; whether you can lose a man mid-season; how it interacts with the
scholarship count.

## Stage 7 · The economy

**Size:** medium–large

One currency doing three jobs, honestly.

- **Recruiting budget rebalance** — the numbers were fitted when the budget did
  one job. It now signs a class and keeps a drafted player, and facilities are
  about to make it three.
- **Player swaying** — the draft KEEP pitch is one offer number today. It
  should be a negotiation with more than one lever.
- **Facilities and budget upgrades** — facilities exist as a recruiting pitch
  attribute and nothing else. There is nothing to spend on and nothing to
  improve.

**Exit:** every dollar has at least two things it could have been.

**Decisions needed at the door:** whether facilities money is the same currency
as recruiting money or a separate program budget; what facilities actually buy
(recruiting pull, development rate, injury resistance).

## Stage 8 · Identity

**Size:** medium

The game looking like itself, on the four passes already agreed.

- **Coach title ladder (B21)** — a named list of achievements per rung, because
  seventy-one of ninety-six coaches read "Journeyman" at year thirty. Plus the
  small per-title gameplay boost, which is designed *after* the ladder is.
- **School emblems or crests** — worn on the team card, the colleges directory,
  the wire and the bracket. Asset strategy still undecided.
- **Awards night** — flip cards, one reveal at a time, and a three.js
  celebration when the winner is one of yours. The 3D chunk stays lazy.
- **Settings sheet** — saves migrate into it from the portrait menu, along with
  the tutorial reset, sound, and whatever preferences exist by then.

**Exit:** ninety-six programs look like ninety-six places.

## Stage 9 · The simulation's last mile

**Size:** medium

Everything the engine and the field still owe.

- **An AI that reads a run-expectancy matrix.** `chooseTactic` is heuristic —
  the difference between a manager who bunts by rule and one who bunts when the
  base-out state says to.
- **Recruits drafted out of high school who never arrive.** Cheap, and it
  stings in the right way.
- **Park effects as geometry** — agreed long ago as something you can see
  rather than a modifier you read about.
- **The rest of the 3D track** — camera easing between positions, instanced
  markers, and a real 2D/3D toggle rather than a fallback pretending to be a
  setting.
- **The measurement debt** — the walk deficit's last percentage point (§18.8),
  `sim.ts parity` (T1), and any calibration figure quoted off a single sample.

**Exit:** the engine has no known lies and the field has no known gaps.

## Stage 10 · The store

**Size:** medium–large · **Needs:** stage 1's Play Console record

- **The S+ player himself.** 82 overall on arrival, 99 potential, ten badges,
  faster progression, exempt from the badge cap. The generated-potential cap
  that reserves the grade for him is already built and measured.
- **Play Billing** — purchase, restore, receipt validation, and the offline
  case, because a phone game gets opened on aeroplanes.
- The **purchase design itself**, which is a game-design question and not a
  billing one.

**Exit:** money can change hands and the game is honest about what it bought.

**Decisions needed at the door, and these are the important ones:** what the
purchase actually grants — one player per dynasty, one per save, a recruit who
appears in your class, or a create-a-player; whether it is consumable or
permanent; and what happens to an existing dynasty when it is bought. This
wants its own design pass before any billing code is written.

## Stage 11 · Ship

**Size:** medium

- **Onboarding** for the first ten minutes. Much of it now exists as the
  first-visit tutorials; what is missing is the very first run.
- **Accessibility** — focus states, and text scaling. Every size in the app is
  in pixels today. Reduced motion is done.
- **Remove the test aids** — SIM SEASON, the loaded Pascagoula Tech roster and
  its guaranteed offer. Both are flagged in the code that carries them.
- **Keystore generated and backed up somewhere permanent.** Losing it means
  never updating the app under the same listing again.
- Signed AAB, store listing, screenshots, description, privacy policy, content
  rating.
- **Closed beta**, then open.

**Exit:** v1.0 on the Play Store.

## After v1.0

iOS, when the means exist. Capacitor can do it; it needs a Mac and a paid
developer account. Nothing in this plan should be shaped around it, but nothing
should make it harder either — which mostly means not writing Android-only
code where a Capacitor plugin would do.

The remaining depth systems that did not make this list — opponent scouting
reports, rivalry dossiers, expanded awards, the dynasty documentary timeline,
the geographic recruiting map — stay in backlog section C. They are good ideas
and none of them is a reason to delay a release.

---

## The order, and why

Stage 1 is first because it answers questions that get more expensive every
week they stay open. Stage 2 is second because it is cheap and the game is
currently misinforming the player. Stage 3 is third because it is the best
hour-for-hour improvement left in the product.

Stages 4 through 6 are a chain and cannot be reordered: a depth chart makes
injuries possible, injuries and playing time make morale mean something, and
morale is what gives the portal its teeth.

Stages 7 and 8 are independent of everything above and could move earlier if
you want a change of pace between the big systems.

Stages 9 through 11 are the finish, and 10 depends on a Play Console record
that Stage 1 will already have created.

## How this document stays true

Same rule as the rest of `docs/`: a stage moves out of this file when it ships,
and what it did moves into `05-systems-reference.md` on the same commit. A
stage that changes shape while it is being built gets changed here first.
