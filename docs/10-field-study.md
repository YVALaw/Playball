# Field study: the mobile college sim, and what a phone expects

**Written September 2 2026, before the port.** Playball is fourteen stages in
with the whole loop running and no Capacitor project. That is the right moment
to look up: at the games we are about to sit next to on a store shelf, and at
what a 2026 Android phone considers table stakes.

This document is research, not a plan. Where it produces work, that work belongs
in `07-v1-plan.md` and `06-backlog.md` like everything else. What is here is the
evidence: who else is in this genre on a phone, how they are built, what their
players say in public, and the specific engineering standards that separate an
app that feels bought from one that feels ported.

Store listings were read on September 2 2026. Ratings and prices move.

---

## 1. The field

There is a real and surprisingly crowded genre here, and almost none of it is
baseball.

### 1.1 The direct competitor

**College Baseball Simulator** (Mani Foroughi, iOS only). Free, **4.8 from 112
ratings**, 50.7 MB, iOS 18+. Head coach of a college baseball programme:
recruiting with a budget, a transfer portal, pitch-by-pitch play with a live
win-probability read, depth charts, development, and a pro draft called the ABL
Draft. Monetised with a **$3.99 "God Mode"** and **checkpoint saves at
$0.99–$3.99**. No subscription.

This is the closest thing to Playball that exists on a phone, and it is one
developer's third app in a year — the same person ships **CFB Simulator** (4.8
from 702 ratings, 46.9 MB) and **CBB Simulator** off a shared shell. That matters
two ways. It means the bar for "a college sport dynasty on a phone" is now a
well-reviewed native iOS app that ships a fix every few days. It also means that
shell is thin: 47–51 MB, English only, iOS 18+, and its whole differentiation is
the sport in the title.

Playball's answer to it is not more features. It is depth in the places that app
is thin — the engine, the world, and the writing — and reliability, which is the
genre's open wound (§2.3).

**Nobody has shipped a serious college baseball dynasty on Android.** The
nearest thing, *College Baseball: Dynasty Builder*, is Windows-only on Steam
(96% positive of 32 reviews) and its pitch is the same as ours: honest recruiting
where the AI plays by the player's rules, a prestige system tied to school
attributes, conference tournaments into regionals into supers into a College
World Series, and a sim fast enough to run a 56-game season for 300 teams in
under a minute.

### 1.2 The rest of the field, by archetype

Three shapes, and each one is a different bet.

**The native list app.** CFB / CBB / College Baseball Simulator, *Dynasty:
College Basketball* (3.8/23, 105.7 MB, 365 teams, 31 conferences, NIL
negotiation, custom leagues by JSON import), *Hardwood Empire* (365 teams, 23
conferences), *College BBALL Coach 2* (**3.7 from 818 ratings**, 137.5 MB, 20+
ratings per player, men's or women's, IAP from $0.99 editors to $6.99
unlock-all), *Blue Bloods Basketball*, *College Football: Dynasty Sim* (4.0/590,
98 MB, 120+ teams, **and it charges $0.99 for dark mode**).

These look like Settings. System font, grouped inset lists, a bottom tab bar,
sheets. They are cheap to build, they read instantly to anyone with an iPhone,
and they are completely interchangeable. Their reviews are about *systems* —
prestige curves, recruiting fairness, whether the sim is honest — because there
is nothing else to talk about.

**The game-styled app.** *Astonishing Baseball Manager* (**4.7 from 2,700
ratings**, 238 MB). Landscape. Dark navy panels, painted card art, letter-graded
attributes (A+, A, C) as coloured badges, star ratings, morale and energy meters,
a "Season · Day 10" header over tabs for standings, scoreboard and stats, and
player cards that arrive as sheets over the list. Free, with training packs from
$1.39 to $11.99 and an AB+ subscription. Its sibling, *Astonishing College
Basketball*, is 4.7 from 271 ratings with 40+ random narrative events.

This is the only one in the genre that looks like a *game*, and it has an order
of magnitude more ratings than the list apps. Its top review line is *"IT IS NOT
PAY TO PLAY"* — the audience is suspicious, and the ones who stay say so out
loud.

**The arcade hybrid.** *Retro Bowl College*, *Hoop League Tactics*, *Full Court
Rivals* (4.2/23, "no microtransactions and no gimmicks", 10,000+ editable
players, 5 jersey styles × 25 colours). These strip the sim down and put a
playable moment in the middle. Retro Bowl's whole thesis is that tap-to-pass,
swipe-to-juke plus light management beats depth on a phone, and it is the most
played football game on mobile by a wide margin.

**The PC port.** *OOTP Baseball 27 Go!* (4.3 from 46 ratings) and *Football
Manager 26 Touch*. Both are the deepest things on the platform and both are
punished for it in reviews (§3.5).

### 1.3 Adjacent, and worth stealing from

- **WrestleVerse** — pitches itself as "the depth of TEW, the accessibility of
  MyGM, mobile-first", and its headline feature is an **Auto Booker** that fills
  in a complete show in seconds. A fast path *through* the depth, not instead of
  it. This is the single best idea in the adjacent market.
- **Football Chairman Pro** — seven divisions from nothing, tiny, and the
  longest-lived mobile management game there is.
- **Basketball Dynasty Manager** — sells on "no ads and no in-app purchases" as
  the feature.
- **Pocket GM 3 Football** — 8.8 user average on GMGames, and the developer runs
  development in public on Reddit.

---

## 2. Architecture

### 2.1 The closest sibling is not a phone game

**ZenGM** (Basketball GM, Football GM et al., Jeremy Scheff) is a single-player
sports management game written entirely in client-side JavaScript, and its
architecture is the one Playball has arrived at independently:

- The **UI runs on the main thread; the game runs in a Worker** (a SharedWorker
  where available). `src/ui` and `src/worker` talk through `toUI` and `toWorker`.
- Data lives in **IndexedDB**, with **an in-memory cache on top of it** holding
  everything commonly accessed. IndexedDB is only touched for the uncommon case
  — old seasons, historical stats.
- The reason for the worker is not tidiness. It is that a browser throttles
  JavaScript in a background tab, so a simulation on the main thread stops when
  the player looks away.

Playball already matches the shape: `src/state/simWorker.ts` behind Comlink,
`src/state/persistence.ts` over `idb`, and the house rule that **the engine
imports nothing** — no React, no Three, no DOM, no store — enforced by
`tests/architecture.test.ts`. That rule is the reason the engine can be moved
onto a worker at all, and it is worth more on a phone than it ever was in a
browser tab.

The one idea from ZenGM that Playball has not obviously taken is the explicit
**cache tier**. Today the store is the cache and it is large. On a phone the
question that matters is not how big the state is in memory — it is how much of
it is structured-cloned across the worker boundary and serialised to IndexedDB
per save, and how often that happens while something is animating.

### 2.2 What the competition is built on

- **CFB / CBB / College Baseball Simulator** — 47–51 MB, iOS 18+, iPad-first,
  visionOS-compatible. Native SwiftUI, near-certainly.
- **College Football: Dynasty Sim** — 98 MB, and its last significant changelog
  entry is a **Unity version upgrade**. That is what a Unity build of a text sim
  costs you: double the download for a game that is a list of names.
- **Astonishing Baseball Manager** — 238 MB, landscape, custom-drawn.
- **College BBALL Coach 2** — 137.5 MB.

Playball's dist is a web bundle plus 96 procedural crests and a Three.js
ballpark. Staying under ~50 MB is achievable and worth defending, because in this
genre size correlates with nothing except how long the install takes.

### 2.3 The genre's actual failure mode is reliability

Read enough reviews and the same words recur across every app in the field,
regardless of engine, price or platform:

| App | The complaint |
|---|---|
| OOTP 27 Go | crashes in the inaugural draft; "crashed 3 times in less than 3 hours"; an action button broken on the lineup screen **for three years** |
| College Baseball Simulator | "game has frozen every time I've played it. Just gets stuck with the loading bar" — *unplayable* |
| CFB Simulator | interface bugs causing freezes that need an app restart; a run of releases fixing save corruption and playoff progression |
| College BBALL Coach 2 | **saves corrupt after about eight seasons**; missing UI elements block progression |
| Dynasty: College Basketball | freezing and crashing, losing progress |

And then the tell: **two of these apps sell "checkpoint tokens" as an in-app
purchase.** CFB Simulator charges $0.99 for one and $2.99 for five. College
Baseball Simulator charges up to $3.99. Players are paying real money for the
right to not lose a dynasty.

This is the finding of the whole study. Playball has **1,061 tests across 45
files**, determinism goldens, calibration as a regression test, and a concurrency
suite pinning the store's double-press guards. In this market that is not
diligence, it is the product. The one thing every player in the genre wants and
cannot buy is a game that does not eat the save.

Which sets a hard requirement for the port: **IndexedDB writes must survive the
process being killed.** Android will kill a backgrounded WebView. A save that is
half-written when that happens is exactly the corruption those reviews describe.

---

## 3. UI and UX: the patterns, from the screens

I pulled the store screenshots of the direct competitor and read them.

### 3.1 Gameday — College Baseball Simulator

Top to bottom on one phone screen:

1. Back chevron, and a **Stats** pill top-right. Nothing else in the bar.
2. **A sticky two-row scoreboard** — crest, team name, score chip each — over a
   strip of state chips: half and inning, outs, count.
3. **"Last Play"**, a card containing one sentence of plain English:
   *"Strikeout. Eugene Hwang (LAR) can't handle a sharp slider."*
4. A **diamond** with fielders placed, bases lit for runners.
5. **"Your call on the mound"** — a 2×3 grid of six icon-and-label tiles (Power,
   Ground Ball, Finesse, Pitch Around, IBB, Bullpen), the current one wearing a
   *Selected* badge.
6. A full-width primary **Sim Half**, with a quieter **Sim Game** beside it.

Read that as a design brief and it says: the state is pinned, the last thing that
happened is a sentence rather than a diff, the decision is a fixed grid of tiles
that never moves between pitches, and the escape hatch out of the whole screen is
the biggest button on it and sits under the thumb.

CFB Simulator's gameday is the same skeleton: scoreboard, "Last Play" text, a
field diagram, **"Suggested: Run"** as a full-width green primary — the game
telling a lapsed player what a competent coach would do — then Simulate /
Timeout / Stats as pills, then four bottom tabs.

### 3.2 Recruiting — the weekly action budget

The competitor's recruit screen is two list groups and a player header:

- **Weekly Actions** — Maintain Contact (showing a done state), Call Recruits,
  Attend Game, each with its cost.
- **One-Time Actions** — Offer Scholarship.
- Then the prospect: name, star rating, position chip, **national rank (#248)**,
  and **Interest Level 34%** on a coloured bar.
- Then Player Information as a plain key/value list — position, **"Fully
  Scouted"** in green, height and weight, Overall, Potential, Velocity, Control.

Three ideas worth naming. **Actions are a budget, not a menu** — recurring and
one-time are visually separated because they are different kinds of decision.
**Interest is a single number with a bar**, so the whole board is scannable at a
glance. And **scouting state is a label on the card**, so the player always knows
whether he is looking at a fact or a guess. Playball's recruiting board is
already "honest about being vague"; this is the interface vocabulary for saying
so.

### 3.3 Offseason — a stepped timeline

Both competitors do the same thing: a coloured hero card ("Offseason 2026"), an
**"Offseason Timeline · Stage 1 of 4"** progress bar, the current step and the
next one as cards, and one primary CTA. The offseason is the part of every
dynasty game where players get lost, and the answer everyone has landed on is to
make it a wizard with a visible position. Playball has `StepRail.tsx`; this is
the same instinct.

### 3.4 The chrome

Four to five bottom tabs, everywhere, without exception. A scrolling context nav
under the header when a section has sub-pages. Sheets for detail. Playball's
`Chrome.tsx` already ships exactly this — and `PrimaryNav`, with a live number
under each label, is a genuinely better idea than anything in the competition,
because the nav reports instead of only labelling.

### 3.5 What players say is broken

- **Depth spread thin reads as depth removed.** FM26 Touch reorganised dense
  screens across more screens; veterans call it exasperating and say vital
  screens got harder to find. Fewer taps beats fewer things per screen.
- **Accidental swipe-dismiss.** A CFB Simulator reviewer: the ability to swipe
  away from screens "makes it tough when you accidentally swipe." An interactive
  dismiss on a screen holding unsaved decisions is a bug with a gesture.
- **Small type.** Full Court Rivals' most common complaint is font size.
- **No pause.** Same app: you cannot stop a game once it is running.
- **Comparison requires navigation.** OOTP Go's player search has no filtering
  depth, so comparing two players means opening two profiles. In a game that is
  entirely about comparing players, that is the whole game made slow.
- **Settings that do not stick.** OOTP Go resets user lineups and depth charts
  after every game.

Playball's own beta audit found the same class of fault from the other side —
absolutely-positioned layers inside iOS momentum scrollers producing five
separately-reported bugs from one cause. The lesson generalises: **on a phone,
the container is the bug.**

---

## 4. What actually keeps people playing

### 4.1 The loop is recruiting, and everyone knows it

A Football Coach: College Dynasty player describes the game as deciding, week by
week, whom to pitch, whom to chase hard, whom to give up on, and whom to make a
late run at — *"essentially everything you do besides watching or coaching
games."* That game is 95% positive across 1,481 Steam reviews.

Recruiting works as the engine because it is the only system where a decision
made now pays off in two years and the payoff is a person you named. Everything
else — the season, the budget, the facilities — is scaffolding around it.

### 4.2 Emergent narrative is the retention mechanic

Football Manager has no cutscenes; its text is generated by a web of triggers
that respond to context, and its players describe years-long saves where youth
graduates become club legends and then retire. The attachment is the product.

Playball already has more of this machinery than any mobile competitor:
signature moments on a man's card, alumni whose pro careers play out and end, a
career rivalry ledger, ninety-five named rival coaches with careers of their own,
and a pecking order that genuinely moves — six of the top twelve programmes turn
over across thirty seasons. **The competition has none of this.** CFB Simulator's
answer is a social media feed reacting to wins and losses. Astonishing's is 40+
random events.

The risk is that a system nobody sees is a system that does not exist. Every one
of those mechanisms needs a surface — a card, a line in an inbox, a page in the
record book — or it is engineering the player never gets paid for.

### 4.3 The session shape

The best line in the research is a player describing Astonishing Baseball
Manager: *casual enough to pick up and put down at will, yet deep enough to play
for hours.* That is one requirement, not two: **every screen must be safe to
leave.** State persisted, position restored, no modal that punishes a phone call.

The corresponding failure is the PC port. OOTP Go and FM Touch are deeper than
anything else on the platform and their reviews are about friction, because a
game designed for a session at a desk is being played in four-minute pieces on a
bus.

### 4.4 The arc has to be legible, and the punishment has to be fair

The two most-repeated complaints about the direct competitor are about
*progression*, not features:

- Prestige moves too slowly. Five winning seasons and multiple draft picks, and
  the programme barely climbs.
- *"Lost my entire team after one down year despite consistent success."*

And from College BBALL Coach 2: coaches get fired after one year regardless of
improvement, which makes a rebuild — the fantasy the entire genre sells —
impossible to play.

Both are the same failure. The player is told to build something over a decade
and then judged on a one-season window. Playball's budget, facilities and
prestige systems are where this will show up, and the register in
`05-systems-reference.md` of what the game hides from the player is the right
place to check that the arc is *visible* as well as fair.

### 4.5 Trust is a feature you can say out loud

Three separate apps in this field market on it: *"no ads and no in-app
purchases"*, *"no microtransactions and no gimmicks"*, *"offline, no ads, no
account"*. And the top review of the genre's most successful app is a player
shouting that it is not pay-to-play.

This audience has been burned. Playball is planning an S+ player and Play
Billing; whatever that turns out to be, the store listing should be able to say
plainly what the money does and does not buy, and the game should be complete
without it.

### 4.6 Developers who answer reviews get five stars

Every review thread on the direct competitor has a developer reply under it,
including on the one-star freeze report ("what device and screen?"). Its rating
is 4.8. OOTP Go's reviewers say *"if there's issues you just ask them to fix it
and they do."* College BBALL Coach 2, whose eight-season save corruption has sat
there long enough for multiple reviewers to find it, is at 3.7.

### 4.7 The numbers to hold ourselves to

Cross-genre 2026 mobile benchmarks: median **D1 ≈ 26%**; a good profile is
**D1/D7/D30 = 35/15/5**; top quartile clears **40/20/10**. Simulation as a genre
runs high on the tail — reported **45–60% D1 and 20–30% D30** — because the
people who install a sim are self-selected and the arc is long. A single-player
premium game reads differently from an ad-funded one, but D30 is the number that
says whether the dynasty is holding, and it is the one to watch.

---

## 5. What a 2026 phone expects

This is the second half of the brief: what makes an app feel bought rather than
ported. Most of it is measurable.

### 5.1 The frame budget

- 60 Hz gives you **16.7 ms** per frame. 120 Hz gives you **8.3 ms**. Miss it and
  the frame is dropped; that is what jank is.
- A **stable 60 beats an unstable 90–120.** Dropping from 120 to 110 is perceived
  as stutter. Consistency beats peak.
- `requestAnimationFrame` in a WebView is commonly still capped at 60, so do not
  plan the ballpark or the scoreboard around 120.
- Animate **`transform` and `opacity` only.** Anything else means layout or paint
  on the main thread, every frame.
- `will-change` is a promise you pay for — apply it to the element that is about
  to move and remove it after. `tokens.css` already does this correctly on
  `.sheet`.
- Enable hardware acceleration in `AndroidManifest.xml`.

### 5.2 Response, not animation

The RAIL numbers have not moved and are still the ones that matter:

| Budget | Number |
|---|---|
| Process an input event | **≤ 50 ms** |
| Visible response to a tap | **≤ 100 ms** — anything faster reads as instant |
| One animation frame | **≤ 16.7 ms** at 60 Hz |
| Cold start, p50 | **< 1.2 s** on the target device class |
| Cold start, p95 | **< 2 s**; first-session retention falls off past 2.5 s |
| Cold start Play flags as excessive | **≥ 5 s** |

Every tap in Playball must paint *something* within 100 ms even when the work
behind it takes a second — which for a game that simulates a season on a button
press means the button's own state change is the deliverable, not the result.

### 5.3 Motion that reads as physical

Android's Material 3 Expressive replaced duration-based animation with a
**spring** model — stiffness and damping ratio instead of milliseconds and a
curve. The reason is not fashion: a spring can be **retargeted mid-flight** and
the physics solves a new path, which is exactly what a gesture-driven UI needs
when the user changes their mind halfway through a drag. Duration-based curves
cannot do this; they snap.

Playball's motion today is duration-and-cubic-bezier, and it is well chosen — the
220 ms sheet rise on `cubic-bezier(0.22, 0.85, 0.28, 1)`, the 260 ms directional
bracket swaps, the reduced-motion block that turns all of it off in one place.
That is correct for everything that is not gesture-driven. **The moment anything
becomes draggable** — a swipe-to-dismiss sheet, a drag-to-reorder lineup — **it
needs a spring**, or letting go mid-gesture will look wrong in a way nobody can
name.

Elsewhere: iOS 26's Liquid Glass is the biggest change to Apple's design language
since iOS 7 — floating translucent controls, an inset capsule tab bar, hierarchy
that adapts to content. Playball ships to Android first and has its own visual
world, so this is context rather than instruction. Do not chase it.

### 5.4 Transitions between screens

The **View Transition API** is supported in Chrome/Edge 111+, Samsung Internet
23+, Safari 18+, Firefox 144+, **and in modern Android WebView**. Same-document
transitions — the SPA case, which is all of Playball — have been there since
Chrome 111.

This is the single highest-leverage polish item available. `.screen-in` currently
gives every screen a 260 ms rise on arrival, which is good and is also a fade in
disguise: the outgoing screen is simply gone. A view transition can carry a
player's row into his card, or a crest from a schedule row into a scoreboard, and
that is the difference between navigating and moving.

### 5.5 Touch, scroll and gesture

- **Touch targets ≥ 44–48 px.** Roughly 75% of phone touches are made with a
  thumb, and about half of all phone use is one-handed.
- The **thumb zone** is the bottom third; the top corners require a grip change.
  Primary actions belong at the bottom — which is where the competition puts
  *Sim Half* and where Playball puts its nav.
- **Bottom tabs cap at five**; past that they collapse into More.
- `overscroll-behavior: contain` on scrollers, or a pull inside a sheet drags the
  page behind it.
- Set `-webkit-tap-highlight-color: transparent` and provide a real pressed
  state, or every tap flashes a grey rectangle that says "web page".
- `touch-action` on anything that handles its own gestures.
- **Never put an absolutely-positioned layer inside a momentum scroller.** Already
  learned here the hard way; five bugs, one cause. `InFrame` in `Overlay.tsx` is
  the fix and it should stay the only way sheets are drawn.

### 5.6 Long lists

96 programmes, 45-game schedules, four thousand players, a recruiting board, a
record book. The standard advice is to **virtualise any list past ~100 items**,
and `content-visibility: auto` on off-screen rows is the cheap version that costs
one declaration.

For filtering and sorting the recruiting board, React 19's `useTransition` and
`useDeferredValue` are the right tools: they mark the list re-render as
low-priority so the input keeps taking keystrokes while the results lag a beat.
On a phone that is the difference between a filter that works and one that feels
broken.

### 5.7 Haptics and sound

Playball already has both. The discipline is what matters:

- **Restraint.** Haptics on layered or meaningful interactions, not on every tap.
  Overuse numbs and then annoys.
- **Immediacy.** A haptic that lands late reads as a malfunction.
- **Consistency.** The same event always feels the same, so the pattern becomes
  vocabulary — the walk-off should not share a tap with the back button.
- **Assume muted.** Most mobile play is silent. Sound may never be the only
  channel for a state change; anything audible needs a visual or tactile twin.
- Volume control, mute, and remembered preference. `Settings.tsx` and
  `devicePrefs.ts` are already the home for this.

### 5.8 The Android platform work, specifically

This is the part the roadmap calls "the phone", and it has hard edges:

- **Target API 36.** Google Play's deadline for app updates to target Android 16
  landed at the end of **August 2026** — it is behind us. Confirm the current
  requirement at build time, but plan for 36.
- **Edge-to-edge is mandatory and no longer opt-out.** Android 15 enforced it for
  apps targeting SDK 35+; Android 16 removed `windowOptOutEdgeToEdgeEnforcement`
  entirely. The WebView renders behind the status and navigation bars. Playball's
  safe-area insets are already done, which was the right call to make early — but
  note that **Android WebView below version 140 returns wrong values for
  `env(safe-area-inset-*)`**, and Capacitor 8.3.2+ exposes the inset information
  needed to work around it.
- **The hardware back button** must map to the app's own history, and on Android
  13+ that means **predictive back** —
  `android:enableOnBackInvokedCallback="true"` and a handler that can show the
  destination during the swipe. A back gesture that exits the app from the middle
  of a recruiting session is the worst bug available on this platform.
- **Save on the way out.** Backgrounded WebViews get killed. Persist on
  `visibilitychange`, not on a timer.

### 5.9 Perceived speed

- **Skeletons over spinners** where the layout is known: a skeleton gives the
  brain the shape that is coming, a spinner gives it nothing.
- **Optimistic UI** for anything the game already knows the answer to. Setting a
  lineup, watchlisting a recruit, spending a coaching point — show the result,
  reconcile after. It decouples the feel of the app from the cost of the write.
- The genre's own worst case is instructive: *"gets stuck with the loading bar."*
  A long operation with no visible progress is indistinguishable from a crash,
  and players report it as one.

### 5.10 Onboarding

Playball has scouting bands, badges, a record book, an economy and a coaching
point system to explain, and no onboarding. The consensus practice:

- **Teach by doing**, inside the real game, not in a slideshow.
- **One mechanic at a time**, and get to the first win fast.
- **Visuals over text.**
- **Milestones with visible progress**, and a skip that works.

The genre's own evidence is blunt: an Astonishing reviewer spent money on
training without understanding what it did, and said so in the review. A system
the player cannot see the shape of is a system they will resent paying for.

---

## 6. Playball against this, honestly

**Already ahead of the field.**

| | |
|---|---|
| Reliability | 1,061 tests, determinism goldens, calibration as regression, concurrency suite. Nothing in the genre is close, and reliability is the genre's defining failure. |
| The world | 95 named rival coaches with careers, realignment, a rivalry ledger, alumni pro careers, a moving pecking order. The competition has a social feed. |
| Motion | Sheets, screens, directional swaps and a single reduced-motion switch — already better than every native list app in the field. |
| Voice | Stage 15.5 exists at all. The competition's play-by-play is one sentence per event; ours is meant to be a code worth learning. |
| Chrome | `PrimaryNav` reporting a live number under each tab is the best nav idea in this study, and it is ours. |
| Safe areas | Done before the port, which is the right order. |

**Gaps this study surfaced.**

1. **No view transitions.** Screens arrive; nothing travels. Cheapest large win.
2. **Duration-based motion only.** Fine today. Wrong the moment anything is
   draggable.
3. **No list virtualisation or `content-visibility`** for the long lists, and
   they are only going to get longer.
4. **Save durability under process death is unproven.** The genre's signature
   bug, and the one place our test suite does not yet reach.
5. **No onboarding**, against a growing surface of systems.
6. **Predictive back is unhandled**, because there is no Android project yet.
7. **The dynasty's memory has thin surfaces.** Alumni careers, rivalry ledgers
   and signature moments exist in the engine; how often does a player *meet*
   them?
8. **No fast path through the depth.** WrestleVerse's Auto Booker, CFB
   Simulator's "Suggested: Run", the competitor's "Sim Half" — every successful
   app in this field gives the player a competent default and a way to skip. A
   four-minute bus session has to be able to advance the dynasty.

---

## 7. What I would do about it, in order

1. **Prove the save survives a kill.** Persist on `visibilitychange`; write a
   test that interrupts a write and reopens. This is the moat; verify it.
2. **A fast path.** A coach's recommendation on every decision screen and a
   one-tap advance that respects it. Depth is not diminished by a default; it is
   made reachable.
3. **View transitions** for row → detail and crest → scoreboard.
4. **Virtualise the long lists**, or at minimum `content-visibility: auto`, and
   put the recruiting board's filter behind `useTransition`.
5. **Onboarding as a first season**, not a tutorial — one mechanic per week of
   the opening schedule, skippable.
6. **Springs for anything draggable**, when that arrives.
7. **The Android platform pass**: target 36, predictive back, edge-to-edge
   against WebView < 140, cold start measured at p50 and p95.
8. **Surface the memory.** Every system in §6 that the player does not meet
   regularly is engineering we have not been paid for yet.

---

## Sources

- App Store: [College Baseball Simulator](https://apps.apple.com/us/app/college-baseball-simulator/id6769100129) ·
  [CFB Simulator](https://apps.apple.com/us/app/cfb-simulator/id6752640167) ·
  [CBB Simulator](https://apps.apple.com/mx/app/cbb-simulator/id6757019544) ·
  [Astonishing Baseball Manager](https://apps.apple.com/us/app/astonishing-baseball-manager/id1611390483) ·
  [Astonishing College Basketball](https://apps.apple.com/app/id6742508267) ·
  [College BBALL Coach 2](https://apps.apple.com/us/app/id1454167983) ·
  [College Football: Dynasty Sim](https://apps.apple.com/us/app/college-football-dynasty-sim/id1501771663) ·
  [Dynasty: College Basketball](https://apps.apple.com/us/app/dynasty-college-basketball/id6760744632) ·
  [Full Court Rivals](https://apps.apple.com/app/id6748927847) ·
  [OOTP Baseball 27 Go!](https://apps.apple.com/us/app/ootp-baseball-27-go/id6758360195)
- [GMGames iPhone index](https://gmgames.org/section/iphone/) ·
  [Android index](https://gmgames.org/section/android/) ·
  [Football Coach: College Dynasty user reviews](https://gmgames.org/football-coach-college-dynasty/user-reviews/)
- Steam: [Football Coach: College Dynasty](https://store.steampowered.com/app/2151290/Football_Coach_College_Dynasty/) ·
  [College Baseball: Dynasty Builder](https://store.steampowered.com/app/3897330/College_Baseball_Dynasty_Builder/)
- [ZenGM architecture](https://deepwiki.com/zengm-games/zengm) ·
  [Basketball GM 4.0 technical details](https://zengm.com/blog/2017/04/basketball-gm-4-0-technical-details/)
- [RAIL model](https://web.dev/articles/rail) ·
  [Android app startup time](https://developer.android.com/topic/performance/vitals/launch-time) ·
  [High refresh rate rendering on Android](https://android-developers.googleblog.com/2020/04/high-refresh-rate-rendering-on-android.html)
- [M3 Expressive motion physics](https://m3.material.io/blog/m3-expressive-motion-theming) ·
  [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) ·
  [Android haptics design principles](https://developer.android.com/develop/ui/views/haptics/haptics-principles) ·
  [Predictive back design](https://developer.android.com/design/ui/mobile/guides/patterns/predictive-back)
- [Capacitor edge-to-edge & safe areas](https://capawesome.io/blog/capacitor-edge-to-edge-and-safe-areas-guide/) ·
  [Animation performance in Capacitor apps](https://capgo.app/blog/ultimate-guide-to-animation-performance-in-capacitor-apps/)
- [Mobile game retention benchmarks 2026](https://blog.playio.co/d1-d7-d30-retention-benchmarks-2026) ·
  [FTUE in mobile games](https://www.blog.udonis.co/mobile-marketing/mobile-games/first-time-user-experience) ·
  [FM26's reimagined UI](https://www.footballmanager.com/fm26/features/fm26s-reimagined-user-interface)
