# Backlog

What is agreed, what is decided, and what is still a question. The systems
reference (`05-systems-reference.md`) describes the game as it *is*; this file
describes what it is going to be.

**How to keep it current.** An item moves out of this file when it ships, and it
moves into `05-systems-reference.md` on the same commit — a feature that shipped
without being written down is a hidden mechanic nobody meant to hide. A decision
recorded here is binding until it is explicitly revisited; if the shape of a
thing changes while it is being built, change it here first.

**Status.** `DECIDED` — settled, waiting on a build slot. `OPEN` — needs an
answer before anything can be built. `PROPOSED` — a design exists and has not
been agreed.

---

## Decisions locked

### The postseason, expanded — **SHIPPED, in a revised shape (August 2026)**

The principle held — a forty-win team must not be finished by one bad series
in May, and the national table has to mean something on its own — but the
shape that shipped is the one the August feedback pass specified, richer than
the sketch this entry used to carry:

| Stage | Field |
|---|---|
| Conference tournaments | top **8** of each twelve, **double elimination**, single games; the top **4 finishers** advance, read off the bracket |
| Regionals | 32 teams, **16 best-of-three championship series** crossing neighbouring conferences (A1vB4, A2vB3, B1vA4, B2vA3) → 16 regional banners |
| National field | 16 regional champions + **4 protected/at-large** = **20**, protection locked to the regular season's final top four |
| Opening round | seeds 13–20, best of three; the top 12 (protected always among them) bye through |
| National showdown | the 16 in two **8-team double eliminations**, top two seeds on opposite sides |
| Championship | best-of-three between the two bracket champions |

Protection buys the field and the bye, never a banner and never a seed lock:
a protected team that flames out of its conference and its regional still
travels, humbler. The bid question this entry flagged was taken deliberately —
`NATIONAL_BIDS` is 20, a bid stays a **bonus** at every mandate (a required
bid would grade the selection committee rather than the team), and the
`championship` mandate's required trophy moved from the conference title
(8 seats, breached at 9 askers in a settled league) to the **regional
banner** (16 seats). The winners/losers toggle, the per-school-coloured
bracket cards, and the frame-pinned action button are the UI half;
`engine/doubleElim.ts` and the staging in `engine/postseason.ts` are the
engine half, pinned by the double-elimination and national-field suites in
`tests/bracket.test.ts` and the whole-postseason suite in
`tests/postseason.test.ts`.

### Two ways to play, and three rules that keep it one game

**`DECIDED`, August 2026.** Coach creation asks whether this is a full roleplay
career or a casual one, and that answer presets everything the feature set adds
— press conferences, academic eligibility, captains, pitch calling, mound
visits, scouting reports. A player chooses how deep a game he wants.

The risk is obvious: two modes is how a codebase becomes two games and a
simulation becomes two simulations. Three rules prevent it, and they bind
every feature built from here.

**One. The engine always models everything.** The mode never changes what the
simulation does, only what the player is *asked about*. Casual does not turn
injuries off; it answers the injury question for you. The moment a mode reaches
into the engine, the ninety-five rival programs are living in a different world
from yours and every comparison in the game — the rankings, the record book,
coach of the year — is a lie.

**Two. Anything that touches the world is on for everybody or off for
everybody.** Realignment, academic eligibility, injuries: these are properties
of the league, not preferences. Two coaches in the same save see the same
league.

**Three. The preset is a preset, not a cage.** Per-system toggles sit behind
it, so "casual, but I want to call pitches" is available, and the mode can
change mid-career without starting over.

Staged as stage 2 of `07-v1-plan.md`, deliberately early: every feature after
it needs a documented answer for what it does in casual mode, and retrofitting
that answer is far more expensive than writing it as you go.

### Records are scaled, not literal — **revisited, and the method changed**

The principle stands: a seeded mark is corrected so it can actually be chased,
and it keeps the man, the school and the year it was set in. The *method* was
scaling by games played — 45 against the 56-to-75 game seasons they were set in,
rates left alone — and that has been replaced, because measurement showed it
getting the answer wrong in both directions. Five rows were unreachable and four
were beaten by somebody in the country every single year.

Each mark is now set where the measured distribution of best-in-league seasons
puts a once-in-fifteen-to-twenty-years year, and no seeded value exceeds the real
one. §13.3 of the systems reference has the arithmetic, the two measurement
mistakes that hid the problem, and why one era multiplier could not have worked.

### S+ belongs to the store

Already built: generated potential is capped at 94, so no recruiting class,
walk-on or rival roster can reach the grade. The store player that will hold it
is deferred to v1.0 and is explicitly exempt from the badge cap.

### Backward compatibility is not a constraint

Testing runs from fresh saves. A change that would need a migration may simply
require a new dynasty instead. This is not licence to corrupt a save silently —
a load must still fail honestly rather than half-work — but no feature should be
shaped around preserving a save written last week.

### The draft is the MLB draft, and the price is your recruiting budget

**SHIPPED**, as B9 below records; the decision is left here in the words it was
made in, because that is the provenance and the reference (§14) is the
behaviour. What follows is what was agreed, and all of it was built.

A player of yours is *drafted by a professional club*, and you get to talk him
into coming back to school. Not a transfer, not a generic "leaving" roll.

Eligibility is the real rule, confirmed: a four-year college player is eligible
after **three years completed, or at age 21, whichever comes first**. So
freshmen and sophomores are ordinarily safe, and the cliff arrives in year
three — which is a rhythm worth having rather than a limitation. The age
exception is how a phenomenal underclassman still gets exposed: a minority of
recruits arrive at 19 or 20, and those men come into range early. (MLB has
proposed moving eligibility to after the sophomore year from 2028, if we ever
want the wider net.)

**The pitch is the skill; the budget is the cost.** He hints at what is pulling
him and you choose which case to make — draft stock, a role, a ring, your word —
each credible only where the data supports it. Matching what he actually cares
about multiplies what your money buys, exactly as `fit` multiplies a recruiting
spend today, so a coach who reads his player keeps him for a fraction of what a
coach guessing pays. A promise the depth chart contradicts should fail *and*
still cost.

What you spend is **recruiting budget**, and the sequencing is what makes it
bite: the draft phase runs immediately before recruiting, so it is the same pool
you are about to open the board with. Keep the ace or sign the class. Cost
scales with where he was taken — a first rounder may be unkeepable at any price,
a twentieth rounder is nearly free — and that gradient is the mechanic.

A junior who returns comes back as a senior with no leverage, so talking him
into staying is a bet made on his behalf.

### Players have ages

**SHIPPED**, as B15 below records. Left here for the same reason as the decision
above it.

Real ages rather than class year alone. Freshmen arrive mostly at 18 with a
genuine minority at 19 or 20 — gap years, late starters, junior college — and
age ticks with the calendar. This is what makes the draft rule above express
itself honestly instead of as a special case, and it is the foundation the
progression and decline rework will want. Descriptive for now: nothing reads it
except eligibility and the screens, so effects are not wired twice.

---

## A. Bugs and data integrity

Ahead of features, because every one of these corrupts something that already
exists.

- **A1 · Player ID collision** — SHIPPED. Ids come off the generator's stream
  position instead of the name, old saves keep the name-shaped ids they were
  written with, `CareerYear` carries the name so the hall of fame can still
  print one, and a load rebuilds the name pool from the save. See
  `05-systems-reference.md` §11.5 and §12.4.
- **A2 · Fifteenth-inning failure** — `DECIDED`. A game reaching the fifteenth
  went undefined. Not yet reproduced; a seeded search for long games will find
  it.
- **A3 · World reconstruction** — SHIPPED. The schedule is rebuilt from the
  teams the save holds rather than from `data/schools.ts` as it stands today.
  Nothing new had to be persisted: a `TeamRecord` already carries its own index
  and its own conference, so `worldFromTeams` reproduces the world the season
  was built from. The two alternatives were rejected on the record — refusing
  the load throws away a working career to avoid a problem that has a correct
  answer, and permanent string ids are the same fix at ten times the size. See
  `05-systems-reference.md` §11.6.
- **A4 · Seeding tiebreakers** — SHIPPED. One chain, in `seedTeams`, used by the
  conference table, the national rankings, the tournament field and both bracket
  seedings: head to head as a mini round robin within the tied group, then
  conference record, overall record, run differential, and finally the school's
  abbreviation — deterministic, stated, and unmoved by reordering the data file.
  `finalOrder` is now frozen conference by conference so a tournament seed cannot
  disagree with the table on screen. See §8.7.
- **A5 · A departing player's last season never reaches the record book** —
  SHIPPED. `archiveSeason` runs on the way into the draft step, beside
  `recordSeasonMarks`, which is the last moment the rosters exist. Archiving
  before the draft was chosen over archiving the departed by id: it keeps one
  notion of "the roster that played this season" instead of two that can drift,
  and it puts both scans of a finished season in one place. It also fixed a
  second thing nobody had noticed — the class year on the row, which
  `departAndDevelop` had already advanced. See §12.4 and §13.2.
- **A7 · A rating of 95 bought almost nothing** — SHIPPED. The ratings spread was
  fine and the league rates were fine; the curve between them was flat. The best
  power hitter the generator can make earned **1.7×** the league home run rate,
  against about 3× for a real home run leader, and the same compression sat on
  walks, triples and strikeouts. It reached the player: the leaderboard, the
  awards and the record book were all describing a league where nobody is much
  better than anybody. Fixed event by event rather than by turning `SPREAD` up,
  because `SPREAD` also widens singles and balls in play — whose spread was
  already correct, and which are what decide games. Home runs and triples now
  measure 3.0×, walks 2.0×, doubles 1.7×, the best arm's strikeout rate 1.7×,
  and singles are untouched at 1.34×. The league did not move: on the eight-seed
  calibration sweep every row is the same or closer to its target than before,
  worst deviation 4.4% → 4.1%. Competitive balance held — team win standard
  deviation 7.85 → 8.73, best record still 41-4, the better seed still wins 62%
  of bracket games. See `05-systems-reference.md` §9.7, and §13.3 for what it did
  to the record book.
- **A6 · The draft screen's walk-on list is dead UI** — SHIPPED, by deletion.
  Wiring it to something real would have meant computing the class shortfall
  twice, and the class review already carries it *before* signing day, where it
  is something the coach can still act on rather than a receipt. A comment in
  `Draft.tsx` records why the block is gone.
- **A8 · The advance-week button stuck on the filter's label** — SHIPPED.
  Reported: *"SHOW THE TOP 50 OF 518"* where `END WEEK` belonged. Filtering is a
  mode that swaps the pinned action, and the five view tabs live in the pinned
  header and stayed live while the panel was up — so tapping ROSTER moved the
  tab underneath a panel that was still covering the body and still owned the
  button. The tabs leave the mode now, and the label comes off one exported
  `pinnedAction` rather than off two branches of a ternary that each wrote their
  own. See `05-systems-reference.md` §2.7a.
- **A9 · NEEDS and the class review disagreed about the same shortfall** —
  SHIPPED. Reported: *"NEEDS said every position was covered, and the class
  review then brought walk-ons anyway."* NEEDS was the one lying, twice over. It
  read `lastOffseason.holes`, which the save loader deliberately does not
  restore, so any dynasty picked up mid-offseason showed an empty tab over a
  roster four men short; and with the report in hand it counted a signed player
  against his own position only, where the rebuild spends him on the first hole
  it comes to and fills the bench out of whoever is left. Both screens read
  `walkOnShortfall` off the live roster now. See §2.10.
- **A10 · The postseason camera moved on every press** — SHIPPED. Reported:
  *"when playing the post season if i hit simulate this game it keeps dragging
  the camera instead of staying where I was at the moment."* An earlier pass
  made the move *glide* rather than cut, which was the wrong half of the
  problem: he is not objecting to the easing, he is objecting to the board
  moving at all under a press he made while watching his own series.

  The follow effect now asks whether the target card is already whole on the
  screen and returns without touching the camera if it is — verified in the
  browser, the canvas transform is byte-identical across a SIMULATE THIS GAME
  press. A card that is off screen still gets travelled to, because a live
  series hiding off the edge with no hint is the failure the follow exists to
  prevent. Tier changes and "nothing of yours in this tier" are exempt and have
  to be. See `05-systems-reference.md` §8.5a.
- **A11 · The coach title drifted on results rather than on achievements** —
  SHIPPED. Reported: *"the coach tittle keeps upgrading or changing every
  season, these tittles are supposed to be based in achievements."* The ladder
  was carried by coach prestige, which moves on overachievement and decays when
  nothing happens; capping the climb at one rung a season slowed the drift
  without removing it. Measured over thirty seasons of ninety six programs,
  **13.1%** of the coach-seasons in which a man won nothing at all changed what
  he was called.

  The cabinet is the whole ladder now — bids, league titles, regions, the
  country — and prestige is not in it at any weight, not even as a tiebreaker.
  The same measurement reports **0.0%**, the only remaining quiet move being a
  rookie's first completed season ending UNPROVEN. Two regions rather than one
  for RENOWNED, because half the tournament field wins a region in this format
  and the band above Established measured four times the size of it. LIFER is
  untouched and still separate. See `05-systems-reference.md` §5, and B4 below
  for what it replaced.
- **A12 · The pipeline bought reach and nothing else** — SHIPPED. Reported:
  *"during recruitment, we have to give a bit of a boost to players in the
  pipeline, I was just running through some seasons and it was rough to get a
  good player."* A small program could see the best player in its own back yard,
  legally call him, and lose him to everybody else — a door that only lets you
  make the call, which is arguably worse than no door.

  A home-state recruit now carries a courtship edge in `fit`, scaled by how
  small the program is and squared so it belongs to the bottom of the ladder:
  ×1.25 at one star, nothing at five. Measured over twelve seeded windows, a
  small school working a local recruit against a big one kept **25.3% → 39.9%**
  of them, and the bigger program still usually wins. See
  `05-systems-reference.md` §2.5a.

- **A13 · The elimination card says the season is over when it is not** —
  **SHIPPED**, and wider than reported. Reported: *"sadly our team went to losers and when
  we got to the finals we won the first and lost the second and got knocked
  out."* The bracket behaved correctly — a losers-bracket survivor has to beat
  an unbeaten winners-bracket champion twice, which is what the reset final is
  — but the screen then told him the wrong thing twice over.

  **The bug.** `noteKnockout` fires on elimination from *this tournament*, and
  the conference branch of `howFar` in `Postseason.tsx` still reads "Out in
  May… winter is for getting them loud again". Under the expanded format the
  top **four** finishers advance, so a team losing the conference final has
  finished second and is on its way to a regional championship series. The
  game announces a funeral to a team that is still alive.

  **The fix, two parts.** The card has to branch on whether the conference
  tournament's `placings` put you in the top `CONF_ADVANCE` — "Out of the
  conference tournament, and on to the regionals" against a real "season
  over" for fifth and below. And the stake should be on screen *before* the
  final rather than inferred after it: the championship slot knows which side
  arrived unbeaten, so `YourNext` can say "win two to take this" to the team
  that needs two and "win one" to the team that needs one. "Championship ·
  the reset" is bracket jargon and should not be the first time a player
  learns the rule.

  **What shipped, August 2026.** Both parts, plus a third case the report did
  not reach: a *protected* top-four program losing its regional was told the
  same lie and is also still alive. `Knockout` carries `advanced` and `placing`,
  written at the moment of elimination because that is the only moment the
  bracket still knows where a team fell. See `05-systems-reference.md` §21.2.

## B. Agreed and designed, not yet built

Ordered by dependency. Records come first because badges, the hall of fame and
half the achievements are all reading from the same book.

- **B1 · The records book** — SHIPPED. League-wide, thirty-eight rows, holders
  only — fifty-two now, once B13's career table and B6's regional row went in. Single game and feats are taken inside `recordResult`; single season,
  team season and coaching come off a scan on the way into the draft phase,
  which is the last moment the rosters that produced the numbers still exist.
  Ties go to the incumbent. Career records are explicitly not in it — that is
  B13. See `05-systems-reference.md` §13.
- **B2 · Seed the book with real NCAA marks** — SHIPPED, and re-pitched twice
  since. Twelve seeds flagged in the data and badged **NCAA** on the screen. They
  were scaled by games played, then §13.3 recorded that seven were out of reach
  and blamed the run environment; A7 above is half of that correction (the
  environment was right, the rating curve was flat). The rest is in §13.3: the
  measurement behind both diagnoses left out the postseason, which the book
  counts, and was taken on generated leagues rather than on a dynasty. Measured
  properly, five rows were unreachable and four were beaten every single year.
  Each mark is now set off the measured distribution of best-in-league seasons at
  about one year in fifteen to twenty, keeps its holder, school and year, and
  asks for no more than the man actually did.
- **B3 · Achievements** — SHIPPED, all ten. One-time and permanent, as against
  records, which are there to be broken — so where the book keeps a sparse map of
  *marks*, this keeps a sparse map of *dates*, and the first time is never
  overwritten. They hang on the coach and travel with him.

  The interesting part was *when*, and the answer is four doors rather than one
  scan. A comeback is a fact about the sixth inning and a streak is only correct
  at the instant a game ends, so both are detected inside `recordResult` and
  cached on `season.feats` — the same trick `scorelessOuts` already plays. Six are
  read at the board meeting. Kingmaker is read at the **draft step** and not on
  the draft screen, because `returned` is written the moment a coach talks
  somebody round and a man who goes back to school was still taken first overall.
  Recruiter is read **when he commits** and not at signing day, because `rank` is
  a fact about the class as published and the class is regenerated at the year
  roll.

  The cabinet shows only what has been earned. Ten rows with eight crossed off is
  a checklist, and a checklist is a set of instructions about how to play.
  See `05-systems-reference.md` §15.
- **B4 · Coach titles** — SHIPPED. Unproven · Journeyman · Respected ·
  Established · Renowned · Legendary, with **Lifer** kept deliberately apart at
  fifteen seasons in one chair — the one thing on the page earned by staying
  rather than winning, so a bad run cannot take it away, and it reads alongside
  the title rather than instead of it (`RENOWNED · LIFER`).

  It shipped as **two ladders with the higher winning** — trophies as floors under
  a climb carried by coach prestige — and that half has since been taken out
  again. Prestige moving on overachievement and decaying when nothing happens is
  the right behaviour for a *reputation* and the wrong behaviour for a *title*,
  which is what A11 above is: measured, one quiet coach-season in eight changed
  the word beside HEAD COACH. The cabinet is the whole ladder now, and the two
  properties this entry was written for still hold and are still pinned by tests
  — a national champion is never introduced as a journeyman, and twenty quiet
  years does not make anybody renowned. See §5.
- **B21 · Give every title its own list of achievements** — `DECIDED`, not yet
  built. The ladder is honest now and it is also lopsided: measured at year
  thirty, **seventy one of ninety six coaches are Journeyman**, four are
  Unproven, and the top four rungs share the remaining twenty one. That is one
  word doing almost all the work, and it is a word that means "has coached a
  game" — so most of the league wears a title that says nothing about them.

  The cause is that the counters run out below a conference title. `CoachState`
  knows about bids, conference titles, regional titles and national titles, and
  nothing else, so there is nothing to spend on the bottom half of the ladder:
  a coach can take a cellar program to four straight winning seasons and stay
  exactly where a man who has coached one game sits.

  What this wants is **a named list of achievements per rung**, not a threshold
  on a single counter — the same shape as the ten one-time achievements already
  in the game, and probably drawing on them. Things the bottom of the ladder
  could honestly be made of: a winning season, a run of them, a conference
  tournament appearance (the top six of twelve — reaching June at all), a
  finish above where the program was picked, surviving a rebuild, taking a
  program up a star tier. Any of those would let an ordinary good coach at an
  ordinary program earn a word that fits him.

  Two things to settle when it is designed. Several of those need a counter
  that neither `CoachState` nor `RivalCoach` carries, and rival coaches wear
  these titles too, so anything added has to be cheap enough to hold for
  ninety-five of them and has to survive a save. And the distribution is the
  test: no rung should hold most of the league, and the top should stay rare —
  five Legendary in ninety-six at thirty years is right, and should not move.
- **B5 · Prestige penalty for two bad seasons running** — SHIPPED.
  `CoachState.badRun` counts consecutive `missed`/`failed` verdicts;
  `badRunPenalty` is `5 + (badRun − 2) × 3` off coach prestige from the second
  onward, sized against a hiring ladder whose rungs are fifteen points apart.

  Three things worth recording. **One acceptable season wipes the run out
  entirely** rather than decrementing it — a coach who answered the question is
  not still serving a sentence. **It is deliberately not a second security hit**:
  security already fell fourteen or twenty eight for each of those years, and
  doubling the sacking pressure would mean nobody ever reaches a third bad season
  for the escalation to apply to. And **it is cleared when he takes a chair**,
  his and a rival's alike — a run is a board's patience running out, and a board
  that has just hired him is by definition unconvinced by the last one's read. An
  earlier version carried it across, and a coach sacked after four bad years who
  then took a rebuild paid fourteen points for his first season in a building he
  had been in for five minutes. What does travel is the prestige the run already
  cost. See §6.5a.
- **B6 · Conference and regional titles as real achievements** — SHIPPED.
  `SeasonOutcome.wonRegional` and `CoachState.regionalTitles`, surfaced on the
  coach page, in the record book as `coachRegionals`, and as a rung on the title
  ladder.

  Two decisions on the record. It is read off `regionChampions` rather than off
  the finish string even though the two say the same thing in today's format, so
  the day the postseason grows a round they stop agreeing on their own instead of
  needing to be pulled apart by hand. And it is **not** priced into `seasonScore`:
  reaching Omaha already pays +12 for exactly this event, and a second line would
  have repriced every deep run in the game the day a bookkeeping gap was closed.

  It also retired a derived number. The coach page computed TRIPS TO OMAHA by
  filtering `history`, which was the honest thing to do with the fields that
  existed and could not agree with a record book that had no regional row to
  disagree with. Both now read the counter.
- **B7 · AI coaches get a career** — SHIPPED, and the deep version. Ninety five
  named men who accumulate skill, are judged by their boards, are sacked, are
  poached, and get old and stop. `engine/rivals.ts`, hung on `TeamRecord.coach`,
  run once a year from `settleSeason`.

  **The bug underneath it was worse than "they do not improve".** `nextPrestige`
  had existed since the board did and only the user's school was ever passed to
  it — so ninety five programs were frozen at whatever the world generator gave
  them, permanently, whatever they did on the field.

  Everything is reused: `reviewSeason` grades a rival exactly as it grades you
  (widened to a narrow `Reviewable` so one function can grade ninety six careers),
  `judge` reads the same checklist, `nextCoachPrestige` applies the same B5
  penalty, `canBeHired` decides who will have him, `skillPoints` pays him at the
  same rate. **Nothing draws from the generator** — names hash off the chair and
  the year, retirement off the name — for the same reason the draft's AI retention
  does not: a whole rival year must not move a calibration figure, and a test pins
  `rng.state()` across one.

  **They are not superhuman.** A rival spends his points badly on purpose, half
  into one hashed favourite; the country's average recruiting skill plateaus near
  30 against a player who can reach 99 by concentrating.

  **Measured over thirty five seasons of the full world**: mean prestige 42.7 →
  51.4 and flat from year fifteen; spread 15.8 → peak 17.8 → 16.2; roster strength
  spread 10.3 → 6.8; bottom five up eight points, top five plateauing below their
  own clamp; thirteen different champions. It converges rather than compounding,
  and talent — which is zero-sum against a fixed recruiting class and would show
  compounding first — actively narrows.

  One number came out hotter than the real sport and was left alone at the time:
  about **twenty seven chair changes a year out of ninety five**, mean tenure near
  three and a half seasons.
- **B7a · The other ninety five boards** — SHIPPED. What B7 left alone, measured
  properly and then fixed. Turnover was **30.4 chairs a year out of ninety six**
  against the real sport's eight to twelve; it is **11.5–11.9** now, of which
  5.6–6.0 sackings, 2.8 poachings and 3.1 retirements, and mean tenure is 5.8
  seasons rather than 1.9.

  B7's own explanation was half of it. The prestige mismatch is real and was
  tried on its own first: recentring `nextPrestige` and changing nothing else
  bought 30.4 → 24.8 and widened the prestige spread from 17.1 to 19.2, so it was
  not taken. **Mean roster strength drifts 44.7 → 55.2 over the same run** and has
  nothing to do with coaches, and because wins are zero-sum while
  `expectationFor`'s win target is absolute, the league ended up asked for 23.6
  wins a program in a season that can only produce 22.5. `wins` is required under
  every mandate; 53 of 96 programs were in breach of it every year.

  So the boards split, in **two fields on `Board`** and nowhere else: a rival's
  reads the same checklist against this year's league, and has one firing bar
  where the player's has two. The second one is the interesting half — the band
  between "sack him" and "do not renew him" is a good device for one career and a
  scheduled cull across ninety five, because the median coach's security is a
  near-driftless walk that spends a third of its life in it. **The player's board
  is unchanged to the digit**, pinned by a 4,500-review sweep run against
  `program.ts` before and after.

  Two things fell out on the way. `POACH_GAP` was re-measured — its old value was
  fitted while the boards were sacking a third of the country, which is a
  different question — and went from 10 to 26, two star tiers. And a board was
  observed sacking its coach in May and hiring him back in June, which had always
  been possible and had never shown because the market was never thin enough for a
  program's own reject to be the best thing on it.

  Convergence survived it: the prestige spread peak moved by two tenths of a
  point. The churn was never what was holding the league together. See §16.9 and
  §16.10, and `npm run carousel` to reproduce any of it.
- **B18 · The inbox** — SHIPPED. A notification centre, asked for directly: "a
  notification or inbox center for this type of things". Board verdicts, job
  offers, achievements, the draft and the coaching carousel accumulate there and
  are read when convenient. Unread shows as a count on the sub-nav and a dot on
  the HOME tab, and nothing in the game waits on it being opened.

  **It sits beside the wire rather than inside it**, as a fourth screen on HOME.
  They answer the same question about different things with different lifetimes:
  `wire()` is derived fresh from the live season every render and thrown away,
  and this is written down once and survives a reload. Folding them together
  would put a row that evaporates when you press "next day" in the same scroll as
  a row from your first season, with two different rules for disappearing.

  Capped at eighty items, oldest dropped, because nothing is *only* there — the
  history screen, the record book and the cabinet are the permanent copies. The
  carousel is summarised rather than listed: your own conference is named, the
  rest of the country is counted. See §17.
- **B8 · Walk-ons** — SHIPPED. Marked, gone after exactly one season whatever
  class year they arrived at, and projected into the class review by position
  before they exist — a fact rather than an estimate, held to the real thing by
  a test. See `05-systems-reference.md`.
- **B9 · Draft declaration** — SHIPPED, and the whole of it: eligibility, the
  round, who the clubs value, and the conversation. See
  `05-systems-reference.md` §14.

  Four things are worth recording here because each replaced something that was
  wrong rather than merely missing. **Eligibility is the real rule** — three
  years or twenty one — and it replaced a pair of talent bars that produced the
  right frequency for the wrong reason and could not say why one sophomore was
  exposed and an identical one was not. **The round is a position on a national
  six-hundred-pick board**, `1 / (1 + exp((value − 61) / 6))` scaled to twenty
  rounds of thirty, not a rank among our own men: round one is now **1.2 men in
  the country in a year** where `floor(i / 32) + 1` used to put the whole league
  in the first two rounds. **The clubs price a man on current ability, last
  season's production and his age, and never on `potential`**, so a club taking
  a finished player over a raw one is correct behaviour and a bust in the first
  round is a thing that happens. And **the persuasion is `weeklyPoints` again** —
  `offer × affinity × credibility × 5.0` against `165 × 0.825^(round−1)` — so it
  is the recruiting model applied to a man you already have rather than a second
  system that resembles one. Measured over fourteen years, the best case
  available on a man costs a median of 63 out of a 120–180 window and the second
  best costs 129.

  The one thing that was left open when the mechanic shipped is now closed:
  **the other ninety five programs talk men round too.** It needed the AI to have
  a budget it could actually run out of, and it did not have one — `aiTargets`
  allocated a flat `ACTIONS_PER_WEEK` (40) a week that no June could touch, so
  retention would have been free money rather than a decision. That is fixed
  first: an AI week is `weeklyBudget(pitch.stars, spentInJune)`, the same call
  the user's board header makes, and appendix B item 5 of the systems reference
  is answered along with it.

  A rival then runs the same `makeTheCase` against the same `keepPoints`, out of
  `windowBudget(stars) × 0.4`, choosing its case with `bestCase` — the cheapest
  of the four that is honestly true, read off the player's own priorities,
  which a staff is entitled to know about a man who has been in its building for
  two years. Kept men go back through `reinstate` exactly as the user's do.

  What stopped the league hoarding was not the price but the bar. A nineteenth
  round pick costs four points, so affordability alone had every program keeping
  everybody — and the *worst* programs hoarded hardest, which is backwards twice
  over. A staff now fights only for a man in the top quarter of what is coming
  back. Measured over eight settled years: 1.74 men exposed per program per year
  and 0.32 kept, so **18% stay and 82% go**; nobody has ever kept more than three
  in a year; rosters still turn over 35.5% a year against 37.3% with the whole
  thing switched off. See `05-systems-reference.md` §14.7.

  It also unblocks B12: a career is what makes a man worth honouring, and a
  career now has an ending with a number on it.
- **B15 · Player ages** — SHIPPED. 80% of freshmen arrive at 18, 15% at 19, 5%
  at 20, and age ticks at the top of the offseason before anybody's departure is
  decided — because the draft is held in June and eligibility is read at that
  moment. The arrival age is **hashed off the player's id rather than drawn**:
  every `rng()` call in `players.ts` sits in a fixed sequence and spending one
  on a fact that decides nothing on the field would have moved every calibration
  figure in the project, which is the same reason `nextPlayerId` reads the
  stream's position without turning it.

  Descriptive, as agreed. `draftEligible` and the screens are the only readers;
  the progression and decline rework will find nothing already wired in. It is
  on the player card, on the departure notice, on the signing-day recruit line
  and on the draft screen, and it is **not** on the roster table, where the class
  column is four characters wide and there is genuinely no room.
  See `05-systems-reference.md` §14.1.
- **B16 · Detailed pitch types** — SHIPPED. Eleven pitches — four-seam, sinker,
  cutter, slider, curve, slurve, screwball, changeup, splitter, vulcan change and
  knuckleball — and every pitcher carries two to five of them with a usage share
  that sums to one. Measured over four thousand arms: 3,402 distinct repertoires
  out of 4,000, a knuckleballer once in eighty, a vulcan once in twenty-five.
  Three rules had to be added because the naive generator produced things that
  were not pitchers: the knuckleballer gets his own branch and throws it 70 to
  84 percent of the time, there is only one *kind* of slow pitch per man, and no
  secondary offering may be the pitch he throws most.

  **The usage share is real data, not flavour.** It reaches the simulation
  through exactly one door: the POWER ARM / JUNKBALLER tendency is read off the
  finished fastball share rather than hashed like the other eight, at the
  twenty-first and seventy-ninth percentiles of the generated distribution — so
  the pole sizes match every other slot and the label under the bar cannot
  disagree with the bar. Nothing about a repertoire is stored: it is hashed off
  the player's id, exactly as arrival age is, so it costs the generator no draw.
  See `05-systems-reference.md` §18.2.
- **B17 · Surface platoon splits** — SHIPPED. THE SPLIT panel on the player
  card — the STATS sheet since the overhaul, because vs-RHP and vs-LHP is a
  production table and its reader is already reading his line — two columns,
  VS RHP and VS LHP: contact and power as effective ratings and the
  production swing underneath. The arithmetic is `platoonSplit` in
  `engine/ratings.ts` rather than in the screen, so what the card prints and what
  `platoonMultiplier` does are the same function.

  One thing it turned up that is worth recording: contact and power move by
  *different amounts* from one split, because the multiplier lands on production
  and the same change in production is a large move on the contact curve and a
  small one on the power curve. Printing one delta against both would have been
  inventing a symmetry the engine does not have. A switch hitter reads the same
  from both sides, and reverse-split players are real and the card says so.
  See §18.7.
- **B10 · Badges** — SHIPPED. Twenty-three, in the four agreed families, three
  tiers, position-aware, with the names delegated and taken:

  *Situational* — GETS HIM IN, LATE AND CLOSE, TABLE SETTER, HOUDINI, THE DOOR,
  DEEP WATER. *Physical* — WHEELS, BURGLAR, LIGHT TOWER, CANNON, RUBBER ARM,
  SWING AND MISS. *Technical* — TOUGH OUT, VACUUM, ON A LINE, PAINTER, WORM
  BURNER, STEALS STRIKES. *Makeup* — GYM RAT, NO PANIC, SECOND LOOK, BIG STAGE,
  CROWDS THE PLATE.

  Sized in three bands by how often the situation arrives — 2.5/4.5/7.0% for an
  always-available channel, 3.0/5.5/8.0% for one that fires a fifth to a third of
  the time, 4.0/7.0/10.0% for THE DOOR and BIG STAGE. The cap ladder is as
  decided (**S+ 10 · S 6 · A+ 5 · A 4 · B 3 · C 2 · D 2**), at most two at
  signing, no decay, not visible on other programs' players. Innate badges are
  hashed off the id; earned ones are read off the three season books at bars set
  near the 90th to 95th percentile of what a 45-game season here actually
  produces; coached ones are one thing a winter, and TRAINING is worth up to 80%
  more of both.

  **Measured, which is the part with teeth.** A squad against an identical squad
  with its badges stripped — same men, same ratings, same tendencies. An ordinary
  roster carrying its ten innate badges wins **49.9%**: no measurable edge at
  all, which is the right answer. A roster carrying two gold badges on every one
  of its twenty-three men — a thing the game cannot produce — wins **64.1%**,
  which works out at **0.31 points of win probability per gold badge** against
  home field's 4.9. Across the league a freshman carries 0.61 badges and a senior
  1.18.

  Three of the twenty-three exist partly as counterweights, and that is written
  down rather than hidden: SWING AND MISS answers TOUGH OUT, WORM BURNER
  suppresses home runs so LIGHT TOWER is not unopposed, and CROWDS THE PLATE puts
  back some of what PAINTER takes off the walk column. CROWDS THE PLATE also
  closes a gap §9.7 left open on purpose — hit by pitch was never widened because
  "no rating measures a man who crowds the plate", and a badge is the right home
  for a fact about a man that is not a skill. See §18.5.
- **B11 · Tendencies** — SHIPPED, and **all of them**. Nine slots: free swinger /
  patient, hunts / takes strike one, green light / station to station,
  pull-happy / uses the whole field, and clutch / tightens up for a hitter;
  attacker / nibbler, quick worker / deliberate, power arm / junkballer, and
  bears down / loses the thread for an arm. Each pole is held by 21% of the
  league and **every pair averages to exactly 1.0 across the population**, which
  is the double-edged principle turned into arithmetic a test can check.

  Clutch is *priced* rather than granted: the +5.5% with a man in scoring
  position is paid for exactly by −1.74% without one, so a clutch hitter's season
  line is an ordinary man's. That is also the line between this system and
  badges, which is worth stating because both fire in the same spot — **a
  tendency redistributes and a badge adds.**

  **Discovery, as decided, is a real mechanic and not a flag.** A tendency on
  your own player is invisible until you have watched enough of him, and what
  accrues is evidence in the unit the reading is made of — plate appearances,
  times on base, or balls in play. It accrues from *every* game your program
  plays, simulated ones included, out of `recordResult`, which is the single door
  every finished game comes through. The thresholds sort the way real baseball
  knowledge sorts: a pitcher's mix inside a month, a spray chart by midseason,
  whether a man is clutch somewhere in his second year. Opponents stay visible
  immediately, as agreed. See §18.4.

  One thing had to be dialled back and it is worth the warning: **a
  population-neutral multiplier is not automatically a season-neutral one.** The
  pace channel is not an outcome — it decides when a starter is pulled and when
  he tires — and at its first sizes it cost the league 1.3% of its walks by
  keeping starters, who throw more strikes than relievers, on the mound longer.
- **B12 · Hall of Fame induction** — SHIPPED. Your own men, a class decided each
  June once the draft has settled, announced in the inbox, and written down for
  good. See `05-systems-reference.md` §19.

  **The stated failure mode is designed against structurally rather than
  numerically.** *A man who holds one single-game record and was otherwise
  ordinary must not get in* — so the ballot cannot see the record book at all, not
  one row of it. A record is one measurement and a hall of fame is a verdict on a
  career; the moment the first can substitute for the second the failure mode is
  back, whatever weight it is given. The test hands a man the best afternoon in the
  history of the country and asserts his score does not move by a point. What he
  holds is printed on the plaque, after the fact, and is worth nothing on the
  ballot.

  **The early departure is handled by scoring the career and the peak together**,
  which is JAWS at college scale: runs above replacement summed over every season,
  plus the mean of his best two. Two rather than JAWS's seven because a college
  career is four and the two year star's whole case *is* two seasons. Awards are
  priced in the same units and small — a national award is worth about one and a
  half average seasons — so four years of honours cannot carry an ordinary career.
  Two seasons is a hard floor whatever the number says: one season is a spike by
  definition, and the test for it leaves out a man with a .550, 35 home run year.

  **The bar was measured, not chosen.** `tests/hall-probe.ts` scores every finished
  career at the strongest, median and weakest program of a twenty season world. At
  110 the best program in the country inducts almost every year, which is the
  "roster" the brief warned about; at 140 nothing outside the elite ever inducts
  anybody, which is the "locked room". **130** is the last bar where a great
  program honours its best man about every second year — ten in twenty — and the
  median is not shut out. Read the middle column as a floor: every program in that
  measurement is run by the machine, whose recruiting plateaus near 30 against a
  player who can reach 99.

  The bar is absolute rather than a quota, on purpose. At a bad program the hall
  stays nearly empty, and filling it is the achievement.
- **B13 · Career records league-wide** — SHIPPED, thirteen rows. See
  `05-systems-reference.md` §13.6.

  **The deferral was a cost claim about the wrong implementation.** Archiving every
  program's seasons is expensive; a career record does not want the seasons, it
  wants the total — which is §13.1's own observation one level down. What is kept
  is one running row per man on a roster anywhere in the country, rebuilt each June
  from the ninety six rosters, so a graduate falls out of it the following year.
  That is safe precisely because his total was final the day he left and had
  already been offered to the book. The ledger is the size of the league, not the
  age of the dynasty.

  **Measured over twenty seasons of the full world**: the ledger is 2,530 rows and
  **308 KB**, flat, at 1.4 ms a June — 10% of a 2.7 MB save. The archive
  alternative is 49,519 rows and **7,526 KB** by year twenty, growing 375 KB a
  season for ever, and would have been almost three times the rest of the save put
  together. The time difference is noise; the size was always the objection.

  One thing genuinely had to be added: a running total is the only pass over a
  finished season that is not idempotent for free, and the rail can be walked back
  to the draft step. Each row carries the year last folded in.

  **Nothing is seeded**, and section D below is the provenance of that decision
  rather than a gap. A career mark is four times a season mark, and §13.3 is the
  record of how badly a plausible scaling of one can miss — the season rows took
  two revisions and forty four measured seasons to land. Thirteen more guesses, in
  a book whose rule is that exactly one row may be unreachable, was not worth it.
  The first man in the country to finish a career takes all thirteen, which is
  worth watching in a way that a page of 1980s names is not.
- **B14 · The S+ store player** — deferred to v1.0. 82 overall on arrival, 99
  potential, ten badges, faster progression, exempt from the cap.
- **B18 · The reach gate becomes a ladder you can read** — SHIPPED, and it
  **replaces** the per-recruit floor rather than sitting on top of it. A program
  may pursue recruits one star grade above itself, and one further inside its own
  state; four- and five-star programs clear every floor there is. The old ladder
  drew a floor per recruit from his priorities — measured and tuned against four
  hundred thousand draws — and the two disagreed in both directions, so keeping
  both would have been two gates arguing. Between a hidden roll and a rule
  printed on the prospect sheet, the readable one wins. Measured: a three-star
  program can call **none** of the national top 25 in any of 24 classes and 9.8
  of the top 50 on average, all of them four stars; with a pipeline that rises to
  14.2. See `05-systems-reference.md` §2.4.

  **Reach turned out not to be enough on its own**, which A12 above is: being
  allowed to call a man you then lose every time is a door onto a wall. The
  pipeline now also carries a courtship edge, and the two halves are deliberately
  different shapes — the reach is a flat one star for everybody, because it has
  to be readable off the screen, and the edge is scaled by program size, because
  a blue blood wins its own state without help. See §2.5a.
- **B19 · The recruiting filter, rebuilt** — SHIPPED. A dropdown for home state,
  multi-select stars, a pipeline switch, a "nobody is on him" switch, and a
  liftable fifty-row cap. The two sliders were removed rather than retuned:
  overall and ceiling are intervals now, and a slider against a band cannot mean
  anything precise. See §2.7a.
- **B20 · Walk-ons get the treatment every other player gets** — SHIPPED.
  Reported: *"they arrive as names on a list with none of the information every
  other player has."* They are drawn on a private seed from the class year and
  the program index, which is what lets the class review name them, show their
  faces and open their cards on signing day and still have those be the men who
  report in June. They still read as walk-ons: no scouting band, no list of
  rivals, a one-year lease said out loud. See §2.10.

## C. Depth systems — each needs its own design pass

Agreed in principle, and explicitly **not** to be built until each has been
specified and agreed on its own. Listing them is not designing them.

Transfer portal · injuries · fatigue and season workload · position changes ·
playing-time expectations · morale · a progression and decline rework ·
opponent scouting reports · rivalry histories and a dossier that remembers
upsets, streaks and postseason meetings · expanded awards · position-change
training · broadcast presentation, with adaptive
treatment for no-hitters, elimination games and championships · a dynasty
documentary timeline built from real career events · a geographic recruiting
pipeline map with contested territory.

~~MLB Decision Day, where juniors weigh draft stock against role, loyalty and
development.~~ Shipped as part of B9, and it is the draft screen: he hints at
what is pulling him and you make one of four cases. It never needed a day of its
own.

### From the overhaul feedback pass (August 2026) — plan before building

- **The minigame, presented properly.** `DECIDED`, and the largest piece of
  interface work still outstanding. The dugout screen works and does not yet
  *look* like the reference the user supplied. What that layout has and this
  one does not: a **much larger field** (it is 118px of a 178px strip today,
  and the park is the reason anybody is on this screen), fielders **labelled
  by position** rather than anonymous dots, a **base-state banner** across
  the field's foot ("RUNNERS ON FIRST AND SECOND"), the batter and the
  pitcher as **cards with their season line under them** (AVG/HR/RBI and
  IP/K/PC) rather than one text row each, the count and outs in the top bar
  as **B/S/OUT indicators**, and the calls as **wide buttons with a reason
  underneath** ("SWING — let him hit", "STEAL — Okafor, 82 speed"). Plus two
  controls that do not exist: **LINE SCORE** (the linescore is folded into
  the scoreboard strip today and cannot be opened on its own) and **REPLAY**
  (re-run the last play's animation, which the ball and the fielders can
  already do — `playPlan` is deterministic off `BallHit`).
  Constraints: it is a phone screen and the play log has to keep real room;
  the 3D chunk stays lazy and the 2D diamond stays the fallback; and the
  reference is a reference, not a skin — the house identity (cream, navy,
  clay, the condensed display face) wins wherever the two disagree.
- **Coach title ladder.** This is **B21 above**, which already carries the
  design brief and the measured lopsidedness — do not design it twice. What
  the feedback pass adds to B21: the user wants each title to eventually carry
  a small in-game boost, and the boost is explicitly **not** to be coded until
  the ladder itself is designed and agreed.
- **Recruiting budget balancing and player swaying.** The retention pitch
  (draft KEEP) and the weekly board should feed one economy the player can
  bend: swaying a player has to be a deeper negotiation than one offer number.
  Needs its own design pass before any code.
- **School visual identities.** Emblems or crests per program, worn on the
  team card, the colleges directory, the wire and the postseason map. Asset
  strategy undecided (generated vs drawn); do not bolt on ad hoc.
- **Awards night presentation.** The awards screen could deal each award as a
  flip card, one reveal at a time, the way a broadcast does it — and the
  feedback pass added a three.js celebration (fireworks or similar) when a
  winner is one of the user's own players. Presentation only; the engine
  already picks the winners, and the 3D chunk should stay lazy.
- **Saves behind a settings sheet.** The portrait menu now carries SAVES; the
  eventual home is a proper settings sheet (saves, tutorial reset, sound,
  eventually preferences) opened from the same menu, and the SAVES sub-nav tab
  retires when that lands.

## D. The record marks

**Shipped as section D stands** — the twelve verified single-season marks are
seeded in `engine/records.ts` with the arithmetic in a comment. **The career table
below is deliberately not seeded**, and that is now a decision rather than a
pending item: B13 shipped the career rows open. A career mark is four times a
season mark, the same two corrections would have to be found for each against a
distribution nobody has measured, and the book's stated rule is that exactly one
row may be unreachable by construction. This section stays because it is the
provenance: it is where the numbers came from and what is still missing, and the
seeds should not be edited without it.

**The "scaled to 45 games" column is history rather than instruction.** It is
what the first seeding did and what the marks in the book were until the era
correction; the values now in `engine/records.ts` are set off a measured
distribution instead, and §13.3 has both the numbers and why the games-played
scaling was getting the answer wrong in both directions. The **Real** column is
the part of this table that is still load bearing.

Gathered so far, from sources that could actually be read. The official NCAA
records book is a two-hundred-page PDF that will not fetch; NCAA.com renders
through JavaScript and returns an empty document to anything that is not a
browser. What follows came from Wikipedia and The Hardball Times.

**One claim refuted.** Several summaries assert a single-season batting average
record of .588 by Tony Sanchez of Boston College. It could not be confirmed
anywhere, and The Hardball Times gives the record as **.551, Keith Hagman, New
Mexico, 1980** (125 for 227). The .588 figure is not to be used.

**One conflict unresolved.** Incaviglia's 1985 home run total is given as 48 by
Wikipedia and 45 by The Hardball Times. Needs a third source.

### Career

| Record | Holder | Real | Scaled to 45 games |
|---|---|---|---|
| Home runs | Pete Incaviglia, Oklahoma State, 1983-85 | 100 in 213 g | ~85 |
| Runs | Phil Stephenson, Wichita State, 1979-82 | 420 | needs his games played |
| Hits | Phil Stephenson | 418 | needs his games played |
| Total bases | Phil Stephenson | 730 | needs his games played |
| Stolen bases | Phil Stephenson | 206 | needs his games played |
| RBI | Jeff Ledbetter, Florida State, 1979-82 | 346 in 262 g | ~238 |
| Doubles | Khalil Greene, Clemson, 1999-2002 | 95 | needs his games played |
| Batting average | Rickie Weeks, Southern, 2001-03 | **.465** | unscaled |
| Slugging | Rickie Weeks | **.927** | unscaled |
| Wins | Don Heinkel, Wichita State, 1979-82 | 51 | scale by starts |
| Complete games | John Hoover, Fresno State | 42 | scale by starts |
| Shutouts | Greg Swindell | 14 | scale by starts |

### Single season

| Record | Holder | Real | Scaled to 45 games |
|---|---|---|---|
| Batting average | Keith Hagman, New Mexico, 1980 | **.551** | unscaled |
| Home runs | Pete Incaviglia, 1985 | 48 or 45 in 75 g | ~29 |
| RBI | Pete Incaviglia, 1985 | 143 in 75 g | ~86 |
| Total bases | Pete Incaviglia, 1985 | 285 | ~171 |
| Slugging | Pete Incaviglia, 1985 | **1.140** | unscaled |
| RBI per game | Lance Berkman, Rice, 1997 | **2.12** | unscaled |
| Triples | Keith Hagman, 1980 | 17 in 63 g | ~12 |
| Doubles | Brad Hawpe, LSU, 2000 | 36 | ~26 |
| Consecutive games hitting | Robin Ventura, Oklahoma State, 1987 | **58** | unscaled, and unreachable — a 45-game season cannot hold it |
| Wins | Mike Loynd, Florida State, 1986; Derek Tatsuno, Hawaii, 1979 | 20 | ~14 |
| Innings | Floyd Bannister, Arizona State, 1976 | 186 | ~112 |
| Strikeouts per nine | Ryan Wagner, Houston, 2003 | **16.8** | unscaled |
| Consecutive scoreless innings | Todd Helton, Tennessee, 1994 | 47 | ~28 |

**Still missing:** every single-game record, career strikeouts, and season hits
and steals. Ventura's streak is worth keeping at its real value as a mark that
exists to be admired rather than beaten — but it should be the only one of
those, or the book stops being a game system and becomes a museum.

## E. Small cleanups

Fold in opportunistically rather than as a work item of their own.

- Scholarship allocation controls are tiny touch targets.
- **~~The recruiting class drifted and the reach gate loosened with it.~~** Both
  answered, and neither happened. The star counts of
  `generateClass(2027, 96, makeRng(4242))` were bisected across every commit from
  v0.6.0 to the head of the block batch; the population distribution has not
  moved since the gate was fitted, and every commit of the batch returns an
  identical class to its branch point. The two "measurements" in disagreement
  were single classes, and a class is far too small to carry either figure — its
  five-star count swings by a fifth of itself from seed to seed, and
  `generateClass` is not even a function of its arguments, because `uniqueName`
  spends a variable number of draws against a module-level name pool. The rung
  rates were then measured against the priority draw and pinned by
  `recruiting.test.ts`; a draw-count canary in `identity.test.ts` catches the
  stray `rng()` this was mistaken for. See `05-systems-reference.md` §2.2, §2.4
  and appendix B item 10. **The rungs themselves are gone since B18** — the gate
  is a property of the star rating now and has no rate to drift — but the
  method is the point and it outlives them.
- **Other calibration figures in the systems reference taken from one sample.**
  The reach gate was the one somebody happened to re-read; it will not be the
  only one. Any figure quoted off a single class, a single season or a single
  sweep carries the sampling noise of that sample and nothing says how wide it
  is. Worth a pass that either widens each measurement or writes down its spread,
  starting with anything a rung, a threshold or a docstring was fitted against.
- **~~Two prestige scales that do not share a mean, and the churn it causes.~~**
  SHIPPED, and the diagnosis was half right. See §16.10.

  The prestige mismatch is real — `nextPrestige` drifts toward `seasonScore`
  (league mean 51) while `initialPrestige` seeds at 41 — and it was tried on its
  own first, because a split that papers over an arithmetic error is worse than
  the error. Recentring the drift and changing nothing else took turnover from
  **30.4 chairs a year to 24.8** and the clear rate from 27% to 33%, and widened
  the prestige spread from 17.1 to 19.2, which is a regression on the one
  property the carousel was built to protect. It is less than half the story and
  it is not the expensive half.

  The bigger half is that **mean roster strength drifts 44.7 → 55.2** over the
  same run and has nothing to do with coaches: the progression and recruiting
  pipeline simply settles ten points above what the generator seeds. And the
  damage is not mainly the mandate mix, it is the **win target**, because wins
  are zero-sum and the target is not. The league is asked for 18.1 wins at the
  seeded distribution and 23.6 at the settled one, and wins 22.5 either way;
  `wins` is a required box under every mandate and was missed by 53 of 96
  programs a year.

  What shipped is the split the user asked for, kept to two fields on `Board`
  and argued at the seam in `program.ts`, plus a re-measured `POACH_GAP` and a
  bug the old churn was hiding — a board sacking a coach in May and hiring him
  back in June. Turnover is **11.5–11.9 chairs a year** across two seeds, of
  which 5.6–6.0 sackings, 2.8 poachings and 3.1 retirements.

- **~~The two required boxes the checklist cannot supply.~~** SHIPPED, and one of
  the two was not a breach at all. See §6.3a of the systems reference.

  The bid was, exactly as diagnosed: `objectivesFor` required a national
  tournament bid of every `contend` and `championship` program, fifteen to twenty
  a year, against eight bids. It is a bonus at every mandate now, `contend`
  climbed from top half to top three to replace it (a contender clears the top
  half 98% of the time, so the box it lost was carrying all the difficulty and
  the box beside it none), and `championship` requires the **conference title** —
  the same event as the bid in today's format, but the honest one to name, and it
  makes `objectivesFor`'s own docstring true for the first time.

  Clear rate **55.6% → 63.2% and 63.8%** on two seeds over thirty five seasons,
  against the 62% the win offset is tuned to. Turnover **11.5 / 11.9 → 9.2 / 9.3**
  chairs a year, still inside the real sport's 8–12. **The win target was not
  touched** — a clear rate closed by lowering the number beside an impossible box
  would have hidden the incoherence instead of removing it — and the pinned sweep
  shows it: `missed`, `failed`, the wins asked for and the sackings are identical
  to the digit, and the only movement is 72 of 4,500 reviews going from `met` to
  `exceeded` because a contender now carries three bonus boxes where it had two.

  **`notLast` was misdiagnosed here, and the estimate of "another seven" was
  double-counting.** It is missed by 6.5 programs a year and is the *sole* miss
  for 0.5 of them: the other six had already lost their win box, so the box cost
  the clear rate almost nothing. It also does not breach the capacity rule —
  eighty eight of ninety six programs can stay out of a cellar and about sixty
  are asked to. Left exactly as it was.

  What did not survive is the estimate's *method*. A required box's price is the
  number of programs it was the only thing standing between and a satisfied
  board, not the number of times it was ticked off. `npm run carousel` prints both
  columns now for exactly this reason.
- Recruiting offers should be able to promise what a recruit actually wants — a
  starting job, playing time — rather than only spending hours on him.
- `highSchoolLine` derives its numbers from true ratings with a fixed noise
  term, so the formula can be reverse-engineered to pin present ability to about
  ±6 regardless of scouting skill. One line to widen.
- ~~No mandate requires a conference title, though `objectivesFor`'s own docstring
  says otherwise.~~ Fixed with the item above: `championship` requires it.
- ~~`FIELD_SIZE` and `runPostseason`'s `size` parameter are vestigial.~~ Both
  deleted. `ui/postseasonGraph.ts` held a second, private `FIELD_SIZE = 16` that
  nothing in that file read either, so removing the exported one would not have
  found it — the pair is the argument for deleting a dead constant when it is
  spotted rather than annotating it.
- ~~`Expectation.expectsTournament` and `expectsConference` are computed and never
  read.~~ Deleted with the item above. They became a second, *wrong* opinion about
  the ask the moment contenders stopped needing a bid.
- Stale comments listed in appendix A of the systems reference. The postseason
  note that described four-team double-elimination regionals is gone, and so are
  four more rows that were fixed rather than catalogued; what is left there is
  the four UI files below, the `'?'` grade docstring and `BOARD_SLOTS`.

## G. From the original roadmap, never built

The roadmap was reconciled against this section on August 26, 2026 — its stale
"what is next" list (five shipped items deep) was rewritten, its half-built
section purged of the draft and the carousel, and its 3D checklist re-ticked —
so it can be trusted again. What follows is what is genuinely still missing,
verified against the source rather than read off any list.

### G1 · Shipping. Nothing of this exists.

The whole point of the project is a phone game and **there is no mobile build at
all** — no Capacitor, no keystore, no store listing. This is the largest silent
gap in the plan and it is not a small job.

- Capacitor set up, a first APK running on a real device
- Android back button handling (safe-area insets are already done)
- Keystore generated **and backed up** — losing it means never updating the app
  under the same listing again
- Play Store listing and a signed AAB
- Onboarding for the first ten minutes. There is none, and the game now has
  scouting bands, philosophies, badges and a record book to explain.
- Accessibility: focus states, text scaling. Reduced motion is done.

### G2 · Gameplay the backlog missed

- **Redshirts.** No concept of one anywhere. Real eligibility management, and it
  interacts with ages and the draft.
- **Depth chart with position eligibility.** A lineup editor exists; who can
  credibly play where does not.
- **Facilities and budget upgrades.** Facilities exist as a recruiting pitch
  attribute only — there is nothing to spend on and nothing to improve.
- **Recruits drafted out of high school who never arrive.** Signed, then gone
  before they play a game. Cheap, and it stings in the right way.
- **An AI decision layer on a run expectancy matrix.** `chooseTactic` is
  heuristic. This is the difference between an opponent who bunts by rule and
  one who bunts when the base-out state says to.

### G3 · The 3D track — audited, then half of it closed

Done: lazy loaded and code split, every material unlit so there is no lighting
cost, DPR capped at 1.6, and ball flight driven off the engine's landing
coordinate with a profile per batted-ball type. The August passes closed the
two items that mattered:

- ~~**There are no fielders in the scene.**~~ SHIPPED in the feedback pass:
  nine dots at their stations, the nearest non-battery man chases a ball in
  play and the throw comes back to the mound. Presentation over the engine's
  own coordinate — see §20.8 of the systems reference, which also records the
  landing fix that made the chase worth watching (a triple used to die at the
  station of the man it went past).
- ~~**`frameloop` is the default `always`.**~~ SHIPPED in the audit pass:
  `frameloop="demand"` with an invalidation window after each play, so the
  park holds its last frame between pitches. The battery item, closed.
- The park gained foul poles, a capped wall, batter's boxes, on-deck circles
  and a scoreboard in the feedback pass. Park *effects* — geometry that
  changes play, the short porch you can see — remain G4's open item.

Still missing:

- Runners and fielders are individual meshes rather than instanced. Twelve
  small spheres, so still harmless.
- **One fixed camera that never moves.** No easing, no three positions.
- No 2D/3D toggle. The 2D diamond survives as the Suspense fallback and the
  WebGL-failure fallback, which is not a setting.
- Thirty frames a second has never been measured, because the game has never
  run on a phone.

### G4 · The roadmap's open questions, now closed

- **NIL and revenue sharing — SKIPPED, deliberately.** The recruiting budget is
  the only currency the game has and it now does two jobs, signing a class and
  keeping a drafted player. That is enough tension without a second economy, and
  one currency the player already understands beats two he has to learn.
- **Park effects — yes, and in 3D.** Not numeric only: the parks get geometry,
  so a short porch is something you can see rather than a modifier you read
  about. That makes them part of G3 rather than an engine-only change.
- **Android only for now.** Capacitor could do both; iOS needs a Mac and a paid
  developer account, and neither is worth carrying before the game is finished.
- **Shipping goes last.** Capacitor, the keystore and the store listing are the
  final work before launch, not something to carry from here. Everything in G1
  stays on the list; none of it blocks a system.

### G5 · Debt

- ~~**Source files that say the world has 64 programs.**~~ **Closed.** The
  four UI files this entry named — `Avatar.tsx`, `Player.tsx`,
  `Standings.tsx`, `TeamCard.tsx` — went with the overhaul's rewrites, and a
  repo-wide sweep on 2026-08-26 finds no stale world size left. The two
  surviving "sixty-four"s are both real: a sixty-four unit portrait box in
  `CoachPortrait.tsx` and the draft's sixty-four first-round picks in
  `Draft.tsx`. One of these did once reach the screen — `SeasonReview.tsx`
  told a coach who made Omaha he was one of "four teams out of sixty four" —
  which is the reason the entry was kept open long after it read as comments
  only.

- **New debt from the August feature work, to clear before v1.0.** Both are
  deliberate and both are flagged in the code that carries them: the
  **SIM SEASON** button on the dashboard (`Today.tsx`, a testing gear that a
  dynasty player should never see), and the **loaded Pascagoula Tech roster**
  — five men at 99 plus a guaranteed rookie offer, in `store.start` and
  `NewGame.tsx`, gated out of vitest so the suite still tests the game rather
  than the hack.
- **T1** in `04-implementation-plan.md` still stands: `sim.ts parity` hardcodes
  a 68-against-38 matchup and prints a verdict it fails by its own criterion.
  Correction to an earlier draft: **B5 is closed**, not open. The implementation
  plan reversed its own conclusion in a later calibration pass — 18% was too
  high rather than too low, `LEAGUE_K_RATE` is the sourced 0.164, and
  `CONTEXT.normalizer` closed B6 in the same move.
- ~~`package.json` says **0.6.2** while the last release commit is v0.7.4, and the
  README still describes a 33-game season and "no save slots".~~ Both fixed.
  `package.json` reads 0.7.4, and the README describes the forty-five game
  season, the named slots, and the five blocks that have landed since.
- ~~`state/store.ts`, above `PostseasonProgress`, claims the national bracket is
  one sixteen-team tree.~~ Fixed. It is three tournaments that are played, not
  four steps that are clicked through; `REGIONAL_LENGTHS` is one series and
  `NATIONAL_LENGTHS` is two rounds, and the systems reference was right.
- ~~`05-systems-reference.md` Appendix B says no tendency specification exists;
  B11 in this file names six buildable ones.~~ Both are out of date and both are
  fixed: nine tendencies shipped, Appendix B item 1 points at §18.3, and item 3
  now records the one question badges left open rather than the whole design.

## F. Research outstanding

- **Simulation gap analysis** — how OOTP, Diamond Mind, Strat-O-Matic and the
  sabermetric literature resolve a plate appearance, against what we do. Two
  questions matter most: whether our log5 implementation is standard, and
  whether the evidence on clutch talent — which is that it barely exists —
  argues for keeping situational badges small and honest.
- **The remaining record marks**, from a source that can actually be fetched.
- **The last percentage point of the walk deficit.** The eight-seed sweep reads
  walks 5.2% under target against 4.1% before the situational layer, and only
  about half of that gap is accounted for: the per-plate-appearance arithmetic is
  neutral when measured exactly off the log5 table, and badges explain roughly
  half a point. The rest is a game-level effect of the kind the pace channel
  turned out to be — something that changes who is on the mound rather than what
  the mound does. It wants the same treatment that found pace: isolate a channel,
  measure it against the sweep, dial it. See `05-systems-reference.md` §18.8.
- **How often the same program should win it all.** Thirty seasons under the new
  postseason (`npm run soak`) produced **ten different champions, one program
  taking eight of them**. Thirty years of the real tournament produce closer to
  sixteen. Nothing is broken — the format is doing exactly what it was designed
  to do, and double elimination, top-four protection and best-of-threes all cut
  the upsets a single-elimination bracket used to hand out. The open question is
  whether a dynasty game *wants* that much order at the top, and the answer has
  to be deliberate: the same knob interacts with the carousel's turnover targets
  and the board's clear rate, both of which are tuned and pinned. The soak fails
  below `years / 3` distinct champions, so the number is watched from here on.
  Adjacent measurement from the same sweep: the save grows about **12 KB a year**
  (15 KB at year one, 371 KB at year thirty), which is comfortable now and is the
  number to re-check when H2 and H9 start writing per-player history.

## H. The v1.0 feature set — agreed August 2026

Chosen from a slate of eighteen proposals plus the surviving items of the
casual-mobile report (`Playball Next`, R1–R10). All are `DECIDED` and staged in
`07-v1-plan.md`; this section holds the argument for each, which the plan
deliberately does not.

Everything here obeys the depth-mode rules in *Decisions locked* above: the
engine models it for all ninety-six programs, and the mode decides how much the
player is asked about it.

### H1 · Assistant coaches

A pitching coach, a hitting coach and a recruiting coordinator, each with
ratings that stack on the head coach's. They can be poached by rival programs,
and a good one leaves to become a head coach somewhere — which is not a new
system but a new *input* to the carousel that already runs ninety-five rival
careers, retires them, sacks them and promotes them.

The largest personality gain available for the work, because it turns the
coaching skills from four numbers a player spends points on into a staff he
assembles. **Open question at the door: what an assistant costs.** Paying them
out of stage 10's money couples two economies that are cleaner apart; paying in
prestige and reputation keeps them independent and reads truer — a good
assistant takes the job because the program is going somewhere.

### H2 · Alumni in the professional game

Every departure is already recorded with a reason, a round and a year
(`Departure`, `engine/progression.ts`), and career rows survive for as long as
the dynasty does. What is missing is the two lines that say what happened next:
a former recruit hitting .280 in Double-A, one who made an All-Star team, one
who washed out in a year.

Cheap relative to its payoff, because the data exists and the men are already
named. It is also the single strongest reason to keep a save alive for fifteen
years, which is exactly what a dynasty game wants.

### H3 · Conference realignment

Every few years programs move leagues on prestige and market. A twenty-year
save where the conferences never move is a spreadsheet; one where your rival
defects to a bigger league is the sport.

Touches more than it looks: the schedule generator, the regions
(`REGIONS` pairs conferences into regionals), the per-school annals, and the
record book's conference marks. **Open question: whether the user's program can
be moved against his will** — it is the most interesting version and the most
likely to feel arbitrary, so it wants a rule the player can read.

### H4 · Rivalry recognition — *not* a trophy

`rival` has been in `data/schools.ts` since the world was built and does almost
nothing. Deliberately **not** a trophy in a case: a persistent series record, a
wire story every time the game is played, a line in both schools' annals, and
the rivalry named on the Today card when it comes round. Recognition that lives
in the record rather than an object that lives in a cabinet.

### H5 · Academic eligibility

A man fails a class and sits. Uniquely college, unavailable to every other
baseball game, and it makes recruiting a kid with questions into a real
decision rather than a rating comparison. Reads naturally against the scouting
bands already in the game: academic risk is another thing a report can be vague
about.

### H6 · Press conferences

Two or three questions after a big win or a bad loss, answered in the coach's
own voice. Moves prestige, morale and how recruits see you. It is the payoff
for H7's personality badges — without them the answers are flavour, with them
they are consistent with a man the player built.

### H7 · Coach creation as an interview, and personality badges

Instead of setting four skills directly, answer baseball questions with real
positions and real tradeoffs — the bunt with a man on second and nobody out,
what you say to a junior leaning pro, the best bat in the league against the
deepest staff. The answers derive the skills, the philosophy and the starting
experience, and hang **personality badges** that are worn for the whole career
the way a player's are.

The rule player badges already follow applies here: each badge names one
channel and one situation. A personality badge that is a vaguer restatement of
`recruiting` or `training` is worse than no badge, because it makes the four
skills mean less rather than the coach mean more.

### H8 · Team captains and leadership

A vote or the coach's appointment. Captains damp morale swings and mentor
freshmen, which gives a veteran a role beyond his stat line and gives the
morale system (H-adjacent, stage 8) something a player can actually *do* about
it rather than only watch.

### H9 · Signature moments

A player's card remembers his walk-off, his no-hitter, the day he went five for
five. Box scores are captured for the user's program and feats already exist as
a counted, named thing (`noFeats`, `engine/achievements.ts`); this is the layer
that turns them from a tally into a life. Pairs with H2 — a man whose card
remembers his moments and then tells you he is in Triple-A is a person.

### H10 · Two-way players

Deferred for years, and the decision has aged badly: modern college baseball is
full of them and it is the most distinctive thing in the sport right now.

Genuinely hard, which is why it was deferred and why it is honest to say so:
one man in two rating systems, fatigue crossing both, a lineup card and a
rotation that both claim him, and every leaderboard needing to decide which
half of him it is ranking. Not a small feature wearing a big hat.

### H11 · Mound visits and pitcher confidence

A limited resource that settles a wobbling arm. Small, tactile and very
baseball, and it gives the managed game a decision between "leave him in" and
"go get him" that currently does not exist — today the only lever is the
bullpen.

### H12 · Opponent scouting reports

Spend preparation before a series to learn the other side's tendencies. The
tendencies are already modelled, already hidden until watched, and already
surfaced on a rival's player card — this is the second route to that knowledge
and the one that costs something.

### H13 · Pitch-by-pitch calling

Full-depth mode only. Eleven pitch types with per-pitcher repertoires and usage
shares already exist in the engine (§18.1); nothing in the UI spends them. The
expensive half is presentation, not simulation.

### H14 · Resume an interrupted game — R1 — **SHIPPED**

Phones interrupt, and a backgrounded live game is lost today because
`LiveGame` is a running coroutine carrying closures. The fix is not to
serialise the coroutine: persist the **day-start snapshot and the ordered list
of decisions**, and replay them on load. The engine is deterministic and every
decision is a small enum, so the replay lands on exactly the same sixth inning.

Marked *essential* by the mobile report and it is right: this is the most
player-hostile behaviour the game has on the platform it is shipping to.

**Built exactly that way, August 2026**, in the regular season and the
postseason both — the latter only after a save restriction that had gone stale
was deleted. `05-systems-reference.md` §21.1 has the three details that carry
it, the argument for `localStorage`, and the reason a call is journalled before
the engine is stepped.

### H15 · Let the bench coach take it — R6

A third button beside SIM THE REST, in two behaviours worth having: **watch**,
where the game plays itself with the field animating and the player just
looks; and **to the next moment**, where the bench coach makes the default call
until something worth managing arrives — men in scoring position, late and
close, a pitcher on fumes. Today a manager up nine runs faces forty taps or
total surrender, and nothing in between.

### H16 · Big-moment presentation — R5

The peaks render like a Tuesday groundout. Leverage styling in the managed
game, a scoreboard that changes tone during a no-hitter, and one full-screen
card for a walk-off, a clincher or a title.

### H17 · Sound and haptics — R3

The game is completely silent — no audio API is used anywhere. A dozen short
samples (bat crack, glove pop, the umpire's third strike, a crowd swell scaling
with leverage, a walk-off roar) and haptics on contact and on outs. The
cheapest personality multiplier the game has never spent, and on a phone,
silence reads as unfinished.

### H18 · The settings sheet — R4

There is no settings surface at all. Sound, haptics, field 2D/3D, text size,
reduced motion, the tutorial reset, and saves migrating in from the portrait
menu. **Stored per device rather than in the save**: preferences follow the
phone, not the dynasty. It is also where the depth-mode toggles live, which is
why it is staged early rather than with the other presentation work.

### H19 · Series stakes on the Today card — R8

Half shipped with the overhaul: the game number and the series lead are on the
card. What is missing is the rest of the sentence — the rivalry when it comes
round (H4), and what tonight would clinch.

### H20 · The wire, upgraded

More kinds, better prose, and the stories the new systems create: a
realignment, an assistant poached, a man three hits from a record *before* he
breaks it rather than after. The wire consumes no random draws and must
continue not to (index row 98).

### Considered and not taken

From the same slate, and kept here because a rejected idea with a reason is
worth more than a forgotten one: a **human poll alongside RPI** (a good story,
but a second ranking to explain), **weather and park conditions** (cheap and
good — a candidate to fold into stage 13 if it wants filling out),
**fan support and attendance**, **live bracketology**, **mentorship pairs**
(largely covered by H8), and **defensive positioning** (the strongest of the
rejected six; worth revisiting after the dugout rebuild). From the mobile
report: **exhibition games**, **classic-finish scenarios** and **share cards**.

---

## I. From playing the rebuilt postseason — August 27, 2026

The expanded postseason shipped, and then it got played. What came back is
worth separating carefully: **the format is not the complaint.** Double
elimination, the regionals and the showdown brackets all did what they were
designed to do. The complaint is that the screen does not tell you what the
format is doing, and that several recent additions have quietly eaten the
screen. All of it is `DECIDED`, staged as **stages 3 and 4** of
`07-v1-plan.md`.

One rule generated more than half of this list and is now standing policy:

> **A card is a visual telling of where you are and what you achieved, in
> simple wording. A card does not explain.** Whatever needs explaining belongs
> in a tutorial, a tooltip or nowhere.

### I1 · The opening round comes out

Reported: it *"is confusing as heck and I think it is not really needed."*

Both halves are right, and the second is the important one. The opening round
exists for one arithmetical reason — the national field is twenty and the
showdown brackets seat sixteen, so four games have to happen first — and that
reason is invisible from the screen. A player arrives in a round he did not
know existed, against an opponent he cannot place, for a prize that is only "be
in the next round". It is the one stage of June with no story.

**The direction: fold those teams into the winners bracket and let the bracket
decide where everyone goes.** That is a real design question rather than a
deletion, and the shape has to be chosen before anything is cut — a bye
structure for the protected four, a larger winners bracket, or a smaller field
are all live options with different consequences for how many games a champion
plays.

**What it touches**, and this is why it is designed and not improvised:
`openingPairs`, the protection swap, `stageOpening` and `splitShowdown` in
`engine/postseason.ts`; `NationalProgress` and the `usableSideShow` /
`portableSideShow` save guards in the store; the national-field tests; and the
soak's audit of "protection never drawn into the opening round", which becomes
an assertion about something else or stops existing. Also worth knowing before
choosing: **protection and the best-of-threes are already suspected of damping
upsets** (§F, the champion-concentration finding), so whatever replaces the
opening round should be checked against the soak rather than assumed neutral.

### I2 · A title game deserves a modal

Every competition's championship — conference, regional, national — should open
a modal with the information in it, rather than living only as a slot in the
bracket that the player has to know to look at. The biggest game of a stage
should come to you.

### I3 · A champion is not a stripe

Today the winner appears as a thin stripe at the foot of the page, and the
national champion sits so far down that it was missed completely: *"I didn't
even know it was down there."* That is the single loudest event in a season
rendered quieter than a box score. It wants a card, and the national title
wants the loudest one in the game.

Related and deliberately staged later: the full big-moment treatment (H16,
stage 13) is the *presentation* layer — leverage styling, sound, a full-screen
celebration. I3 is the *information* fix and should not wait for it.

### I4 · A bracket game you can tap

Asked for more than once and still not built. A bracket where every game is a
frozen score is a table with corners on it. Tapping one should open what
happened: the line score, the pitchers, the swing of it. The box scores already
exist and are already reopenable in September — this is routing, not new data.

### I5 · Postseason statistics

There is no way to see them at all. June is the half of a season people
remember, and who hit in it is currently unknowable once the bracket is gone.
Open question worth settling early: how far back this reaches on a save that
predates it.

### I6 · Say so when a season is actually over

The other half of A13. Stage 1 stopped the game announcing funerals for teams
that were still alive; the reverse case is a team that missed the conference
final and whose record will not reach the national field, left with no
statement at all and a bracket it can still open. If a team is out, the game
should say it is out, plainly and once.

### I7 · The out-of-the-showdown card, and every card after it

The card itself is liked. It is simply still over-written. See the rule at the
top of this section — it applies to this card, to the cards tidied in stage 1,
and to every card added from here.

### I8 · The screen is being eaten

Five separate reports, one complaint. A phone screen is the scarcest resource
in the game, and each of these spends it on something worth less than the space
it takes. Staged together because they are one skill and one afternoon, not
because they are related:

- **The two roster filters are far too big** — added to help the roster and
  currently costing more room than they save.
- **"He is in your pipeline" comes off the recruit rows.** A sentence where a
  mark would do.
- **The prospect sheet opens too small.** Bigger, so more of it reads at once —
  and deliberately *not* full screen, which was specified.
- **The offseason action button moves between tabs.** Reported earlier and not
  yet fixed: a tab with less content lets the button ride up, so the one
  control that is meant to be in the same place every time is not. Pin it.
- **The season record is too easy to lose** beside the inbox badge. Bigger, or
  — the preferred answer — moved up beside the date in the header, where the
  eye is already going.
