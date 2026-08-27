# The v1.0 Plan

**Written:** August 26, 2026 · **Revised:** August 26, 2026 (stage order)
**Companion docs:** `01-roadmap.md` for the order at a glance, `06-backlog.md`
for the decisions behind each item, `05-systems-reference.md` for what the
game does today.

---

## What was decided

| Question | Answer |
|---|---|
| Scope | **Everything.** Polish, the parked design passes, *and* the depth systems. |
| Platform | **Android first**, iOS when the means exist. |
| Money | **Free, with the S+ player as an in-app purchase.** |
| Date | **None.** Ship when it is right. |
| The phone | **No Android device yet**, so the device work waits until late. |

## Two errands that cost nothing and should happen now

Neither is a stage and neither needs a phone.

**Create the Play Console app record and the merchant account.** This is a web
console and a form. It needs no build and no device, and it starts two clocks
that are otherwise sitting at the end of the project: a merchant account can
take days to verify, and in-app products cannot be tested until an app record
exists with something uploaded to a testing track. Doing it now costs an
afternoon and removes the only genuinely unpredictable wait in the whole plan.

**Take a throttled performance profile in the browser.** The one question the
deferred phone work leaves open is whether the 3D field holds a frame rate on
mid-range Android hardware. A Chrome profile with 4× CPU throttling and a
mobile viewport is not the same measurement, but it is close enough to catch a
disaster — and a disaster here is the sort that changes the design rather than
the code, which is exactly what you do not want to discover after the dugout
has been rebuilt around a bigger field.

**The risk of deferring the device work, stated plainly.** If the field turns
out not to hold a frame rate on real hardware, the fix may be architectural —
the 2D diamond becoming the default and 3D becoming the setting, rather than
the other way round. Stage 2 rebuilds the dugout around a *larger* 3D field.
The throttled profile above is the cheap hedge against building on sand, and
it is why it belongs at the top of this document rather than in stage 11.

---

## Stage 1 · Stop the game lying

**Size:** small · **Value:** high per hour

- **A13** — the elimination card that tells a conference finalist his season is
  over when second place sends him to a regional. Branch on `placings`, and put
  the stake on screen *before* the final rather than leaving "the reset" to
  explain itself.
- **Tournament win/lose cards** — they carry the biggest emotional moments in
  the game and are currently a title and two lines in a box.
- **A thirty-season soak** — the new postseason machinery has never run more
  than a few years. Watch for drift, orphaned state, growth in save size, and
  any June that fails to seat twenty unique national teams.

**Exit:** nothing the game says about what happened is false.

## Stage 2 · The dugout

**Size:** large · **Value:** highest of any feature left

The screen a player spends the most time on. Backlog section C carries the
full brief: a much larger field, fielders labelled by position, a base-state
banner, batter and pitcher as cards with their season lines, count and outs as
indicators, calls as wide buttons with their reason underneath, and the two
controls that do not exist — **LINE SCORE** and **REPLAY**.

Constraints: the play log keeps real room, the 3D chunk stays lazy, the 2D
diamond stays the fallback, and the house identity wins wherever it disagrees
with the reference.

**Exit:** the dugout matches the reference in substance, in our own clothes.

## Stage 3 · The coach

**Size:** medium–large · **New stage**

The one part of the game that is still a form. Everything else has a system
behind it; the man you play as is four sliders and a name.

- **Creation as an interview, not a form.** Instead of setting skills
  directly, you answer baseball questions with real positions and real
  tradeoffs — what you do with a man on second and nobody out, what you say to
  a junior leaning pro, whether you would rather have the best bat in the
  league or the deepest staff. The answers derive your skills, your philosophy
  and your starting experience. Nobody picks "recruiting 40"; everybody has an
  opinion about the bunt.
- **Coach personality badges**, drawn from those answers and worn for the whole
  career the way a player's badges are. PLAYERS' COACH, OLD SCHOOL, CLOSER,
  DEVELOPER, PROGRAM BUILDER. Each names one channel the way player badges do —
  they must not be a second, vaguer copy of the four skills.
- **The JOBS tab** — promised in `Program.tsx`'s own comment and never built. An
  established coach browses openings, applies, and interviews, rather than
  waiting for a phone to ring. The hiring ladder and `jobOffers` already exist;
  what is missing is the door and the application flow.
- **The coach title ladder (B21)** — a named list of achievements per rung,
  because seventy-one of ninety-six coaches read "Journeyman" at year thirty.
  The small per-title gameplay boost is designed *after* the ladder is.

**Exit:** two coaches with the same record are visibly different men.

**Decisions needed at the door:** how many questions, and whether they are the
same every time or drawn from a pool; whether badges are visible to the player
or inferred from behaviour; whether an interview can be failed.

## Stage 4 · The roster becomes a roster

**Size:** large · **Unblocks:** stages 5, 6 and part of 7

- **Depth chart with position eligibility** — a competence per position, not a
  boolean
- **Real DH handling** — `naturalPos` derives what a generated "DH" actually
  is; this is the other half, the coach assigning the slot
- **Redshirts** — no concept exists anywhere; interacts with ages, eligibility
  and the draft
- **Position changes and position-change training**

**Exit:** you manage a roster rather than reading a list.

**Decisions:** how position competence is modelled; whether a redshirt is a
coach's call or a rule; whether position changes are permanent.

## Stage 5 · Players as people

**Size:** large · **Needs:** stage 4

- **Injuries** — the system that needs a depth chart most
- **Season-long fatigue and workload** — nothing accumulates across a year
  today, so a staff can be ridden all season for free
- **Playing-time expectations** — a recruit promised a job who sits
- **Morale** — what the three above move, and the reason the portal has teeth

**Exit:** a season has attrition, and a bench that notices.

**Decisions:** how punishing injuries are; whether they are visible to
recruiting and the draft; whether morale is a number or only behaviour.

## Stage 6 · The transfer portal

**Size:** medium · **Needs:** stages 4 and 5

Both directions or it is not a portal: men leave because they sit, and men
arrive because they sat somewhere else.

**Exit:** a roster can change between Junes without a draft or a signing day.

**Decisions:** window or always open; whether you can lose a man mid-season;
how it interacts with the scholarship count.

## Stage 7 · The economy

**Size:** medium–large

- **Recruiting budget rebalance** — fitted when the budget did one job; it now
  signs a class and keeps a drafted player, and facilities make it three
- **Player swaying** — the draft KEEP pitch is one offer number today
- **Facilities and budget upgrades** — facilities exist as a recruiting pitch
  attribute and nothing else

**Exit:** every dollar has at least two things it could have been.

**Decisions:** whether facilities money is the recruiting currency or a
separate program budget; what facilities actually buy.

## Stage 8 · Identity

**Size:** medium · **Independent — can move earlier**

- **School emblems or crests** on the team card, the directory, the wire and
  the bracket. Asset strategy undecided.
- **Awards night** — flip cards, one reveal at a time, and a three.js
  celebration when the winner is one of yours. The 3D chunk stays lazy.
- **Settings sheet** — saves migrate in from the portrait menu.

**Exit:** ninety-six programs look like ninety-six places.

## Stage 9 · The simulation's last mile

**Size:** medium

- **An AI that reads a run-expectancy matrix** rather than a heuristic
- **Recruits drafted out of high school** who never arrive
- **Park effects as geometry** — a short porch you can see
- The rest of the 3D track: camera easing, instanced markers, a real 2D/3D
  toggle
- Measurement debt: the walk deficit's last point (§18.8), `sim.ts parity`
  (T1), single-sample calibration figures

**Exit:** the engine has no known lies and the field has no known gaps.

## Stage 10 · The store

**Size:** medium–large · **Needs:** the Console record from the errands above

- **The S+ player himself** — 82 overall on arrival, 99 potential, ten badges,
  exempt from the badge cap. The gate reserving the grade is already built.
- **Play Billing** — purchase, restore, receipt validation, and the offline
  case.

**Exit:** money can change hands and the game is honest about what it bought.

**Decisions, and these are the important ones:** what the purchase grants — one
player per dynasty, one per save, a recruit who appears in your class, or a
create-a-player; consumable or permanent; and what happens to a dynasty already
in progress when it is bought. This wants its own design pass before any
billing code.

## Stage 11 · The phone

**Size:** small–medium · **Deferred here because there is no device yet**

- Capacitor project, Android platform, `dist` wired to the shell
- A debug APK on a **real device**
- **Measure:** frame rate during ball flight, cold start, on-device bundle size
- **Verify:** IndexedDB survives force-quit, safe-area insets on a notched
  device, WebView version
- Hardware back button

Everything here except the frame-rate measurement can be answered on an
emulator, so if the wait for hardware runs long, the emulator pass can be
pulled forward on its own and only the measurement left behind.

**Exit:** an APK on a real phone that plays a season, with a measured frame
rate written into `05-systems-reference.md`.

## Stage 12 · Ship

**Size:** medium

- **Onboarding** for the first ten minutes
- **Accessibility** — focus states, text scaling. Every size is in pixels
  today; reduced motion is done.
- **Remove the test aids** — SIM SEASON, the loaded Pascagoula Tech roster and
  its guaranteed offer
- **Keystore generated and backed up somewhere permanent**
- Signed AAB, listing, screenshots, privacy policy, content rating
- **Closed beta**, then open

**Exit:** v1.0 on the Play Store.

---

## The order, and why

Stages 4 → 5 → 6 are a chain and cannot be reordered: a depth chart makes
injuries possible, injuries and playing time make morale mean something, and
morale is what gives the portal its teeth.

Everything else has slack. Stages 7 and 8 are independent and can move earlier
for a change of pace. Stage 3 sits where it does because the coach is the
thing the player *is*, and it is cheap next to the roster systems.

The phone moved from first to eleventh on the user's call, with no device to
hand and no date to hit. The two errands at the top of this document are what
keeps that safe.

## How this document stays true

A stage moves out of this file when it ships, and what it did moves into
`05-systems-reference.md` on the same commit. A stage that changes shape while
it is being built gets changed here first.
