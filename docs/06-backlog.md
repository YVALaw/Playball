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
| National showdown | all **20**, in two **10-team double eliminations**, top two seeds on opposite sides |
| The play-in | the bottom four of each half play into the winners bracket; **losing drops you to the losers side, not out** |
| Championship | best-of-three between the two bracket champions |

**Revised again, August 27:** the opening round is gone. It was a best-of-three
that cut twenty to sixteen, and the problem was never the extra games — it was a
single-elimination gate standing in front of a double elimination tournament, so
a team could win its conference, win its regional, lose one series and be
finished. The same eight teams now play their way in *inside* the winners
bracket, where a loss costs a drop rather than a season. §I1 and
`05-systems-reference.md` §23.1.

Protection buys the field and the bye past the play-in, never a banner and never
a seed lock:
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

### Two ways to play, and three rules that keep it one game — **SHIPPED**

**SHIPPED, August 2026** as stage 2; `05-systems-reference.md` §22 is the
behaviour. Coach creation asks whether this is a full roleplay
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

Built as stage 2, deliberately early: every feature after it needs a documented
answer for what it does in casual mode, and retrofitting that answer is far more
expensive than writing it as you go. The catalogue in `state/depth.ts` carries
one per system, unbuilt ones included, so the answer is written before the
system is.

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

### H1 · Assistant coaches — **moved to the economy stage**

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

### H6 · Press conferences — **SHIPPED, stage 7 piece 8**

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

### H13 · Pitch-by-pitch calling — **DROPPED from v1.0, see §J**

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

## I. From playing the rebuilt postseason — August 27, 2026 — **ALL SHIPPED**

The expanded postseason shipped, and then it got played. What came back is
worth separating carefully: **the format is not the complaint.** Double
elimination, the regionals and the showdown brackets all did what they were
designed to do. The complaint is that the screen does not tell you what the
format is doing, and that several recent additions have quietly eaten the
screen. All of it is **SHIPPED**, as stages 3 and 4 of `07-v1-plan.md`, the
same day it was reported. What each one turned into is in
`05-systems-reference.md` §23 and §24.

One rule generated more than half of this list and is now standing policy:

> **A card is a visual telling of where you are and what you achieved, in
> simple wording. A card does not explain.** Whatever needs explaining belongs
> in a tutorial, a tooltip or nowhere.

### I1 · The opening round comes out — **SHIPPED**

Reported: it *"is confusing as heck and I think it is not really needed."*

Both halves are right, and the second is the important one. The opening round
exists for one arithmetical reason — the national field is twenty and the
showdown brackets seat sixteen, so four games have to happen first — and that
reason is invisible from the screen. A player arrives in a round he did not
know existed, against an opponent he cannot place, for a prize that is only "be
in the next round". It is the one stage of June with no story.

**What it became: a play-in inside the winners bracket.** The bottom four of
each half play one game; the winners join the main bracket and *the losers drop
to the losers side*, still alive. Six per half are byed. That was chosen over a
sixteen-team field and over byes-only because it is the shape that fixes the
actual sin — the old round was single elimination standing in front of a double
elimination tournament — rather than merely removing a round.

Two halves of ten, eighteen games each and nineteen with the reset, which is
arithmetic rather than a number anybody picked: every game is one loss, nine
teams go out at two apiece, the champion leaves with none or one.

**What it touches**, and this is why it is designed and not improvised:
`openingPairs`, the protection swap, `stageOpening` and `splitShowdown` in
`engine/postseason.ts`; `NationalProgress` and the `usableSideShow` /
`portableSideShow` save guards in the store; the national-field tests; and the
soak's audit of "protection never drawn into the opening round", which becomes
an assertion about something else or stops existing. Also worth knowing before
choosing: **protection and the best-of-threes are already suspected of damping
upsets** (§F, the champion-concentration finding), so whatever replaces the
opening round should be checked against the soak rather than assumed neutral.

### I2 · A title game deserves a modal — **SHIPPED**

Every competition's championship — conference, regional, national — should open
a modal with the information in it, rather than living only as a slot in the
bracket that the player has to know to look at. The biggest game of a stage
should come to you.

### I3 · A champion is not a stripe — **SHIPPED**

Today the winner appears as a thin stripe at the foot of the page, and the
national champion sits so far down that it was missed completely: *"I didn't
even know it was down there."* That is the single loudest event in a season
rendered quieter than a box score. It wants a card, and the national title
wants the loudest one in the game.

Related and deliberately staged later: the full big-moment treatment (H16,
stage 13) is the *presentation* layer — leverage styling, sound, a full-screen
celebration. I3 is the *information* fix and should not wait for it.

### I4 · A bracket game you can tap — **SHIPPED**

Asked for more than once and still not built. A bracket where every game is a
frozen score is a table with corners on it. Tapping one should open what
happened: the line score, the pitchers, the swing of it. The box scores already
exist and are already reopenable in September — this is routing, not new data.

### I5 · Postseason statistics — **SHIPPED**

There is no way to see them at all. June is the half of a season people
remember, and who hit in it is currently unknowable once the bracket is gone.
Open question worth settling early: how far back this reaches on a save that
predates it.

### I6 · Say so when a season is actually over — **SHIPPED**

The other half of A13. Stage 1 stopped the game announcing funerals for teams
that were still alive; the reverse case is a team that missed the conference
final and whose record will not reach the national field, left with no
statement at all and a bracket it can still open. If a team is out, the game
should say it is out, plainly and once.

### I7 · The out-of-the-showdown card, and every card after it — **SHIPPED**

The card itself is liked. It is simply still over-written. See the rule at the
top of this section — it applies to this card, to the cards tidied in stage 1,
and to every card added from here.

### I8 · The screen is being eaten — **SHIPPED**

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

---

## J. The career, opened up — planning pass, August 27 2026

Raised while planning stages 5 to 7. The theme is one the plan had not stated:
**a coaching career is currently something that happens to you.** Offers arrive,
you take one or you do not. Everything below is about making it something you
act on, and most of it is cheap because the machinery already exists — the
hiring ladder prices every move, the carousel runs ninety-five rival careers,
and the wire already reports what happens to them. None of it is wired to a
screen the player can use.

All `DECIDED` unless noted, and staged in `07-v1-plan.md`.

### J1 · The offers you get depend on who you said you were — **stage 7**

`startingOffers` produces the same handful of schools every career. That makes
coach creation decorative: you answer questions about how you see the game and
then the same six programs ring regardless. The desk becomes a function of
**the interview answers, the derived skills, and coach prestige** together.

The interview still cannot be failed. Shaping the offers is not the same as
rejecting the coach, and the difference matters: every set of answers produces
a valid man with a career in front of him, and what changes is which chairs
find him interesting.

### J2 · A job board that is not always open — **stage 7**

The JOBS tab has been promised in `Program.tsx`'s own comment for a long time,
and the obvious version of it — a permanent directory of ninety-six programs —
is the wrong one, for the same reason the recruiting directory was replaced by
a desk of real offers. A chair should appear because *something happened*: the
wire says a school is looking, or that a coach three bad years in is under
pressure. The tab shows what is genuinely open, says which would have you and
which would not and why, and lets you apply.

This is the carousel becoming visible. It has been running rival careers for a
long time with nothing but a wire story to show for it.

### J3 · Look for a job while under contract — **stage 7**

Today a move happens only when somebody calls. Going looking is the other half
of a career, and it is what finally makes the years left on a contract mean
something: leaving early should cost, staying should be a choice rather than
the absence of one.

### J4 · A proven winner recruits better — **stage 7**

Banners behind you should be worth something on the board. Coach prestige
currently decides which jobs will have you and nothing else; this puts it where
a player feels it every week.

### J5 · An international call — **`PROPOSED`, after v1.0**

Flagged explicitly as later: a national team ringing a college coach — the WBC,
or an equivalent — as a career event that is not another school. Recorded here
so it is not lost, deliberately unscheduled, and it wants its own design pass
rather than a corner of the jobs board.

### J6 · Pitcher confidence, beside fatigue — **stage 6**

Asked for as the MLB The Show arrangement, where fatigue and confidence are
both taken into account. **Fatigue is already real and always has been** — a
stamina-derived pitch budget, a multiplier degrading to a floor of 0.55, fed
into every plate appearance, with times-through-the-order beside it. Confidence
is the genuinely new channel: a hidden per-outing state that drifts on what
just happened and gives a mound visit something to be for.

It is a new input to the plate appearance, so it gets the treatment the pace
channel and the situational layer got: isolate it, measure it against the
calibration sweep, dial it. A channel added by eye is how a tuned engine stops
being tuned.

### Considered and dropped: pitch-by-pitch calling

Not deferred. **Dropped from v1.0**, and the reason is worth keeping because it
is not obvious. The shipping engine resolves a plate appearance with log5 and
*then* sequences pitches backwards to land on that outcome — so a pitch the
player called could not change anything that had not already been decided.

Three ways out existed and all were worse than the cut. Making the call a real
input before log5 resolves is honest, but it is a new calibrated channel built
for a full-depth-only feature. Running the free pitch model for managed games
only breaks the rule that managing must not change the odds, which would make
every ranking and record in the game slightly dishonest. Leaving it as theatre
is the one thing this game does not do.

The eleven pitch types and per-pitcher repertoires stay exactly what they are:
what colours the play-by-play, and what tendencies and scouting reports are
made of. Its row comes off the settings sheet — a greyed row promising
something that is not coming is worse than no row.

## §K · Raised while playing stage 5

**K1 · The ballpark's look, as opposed to its geometry.** Asked for directly
after the dugout rebuild landed: *"maybe later we will work a bit more in the
park visual and do some tweaks to the design."* The field is now the right
size and the play reads correctly on it — this is the other half, the one with
no simulation in it: crowd, stands, lighting, the texture of the place.

**Superseded: it is its own stage now — stage 15, The ballpark.** The original
reasoning put it with broadcast, on the grounds that a park redrawn before the
sound and the celebration would be redrawn again after. That was right about
*not doing it twice* and wrong about where it belongs: once the camera work,
the 2D/3D toggle, REPLAY, park effects and fielder animation are counted, the
park is far too much work to ride along inside a stage about audio. Collected
into one stage instead, which is the same argument reaching a different answer.

**K2 · REPLAY.** Named in the stage 5 brief and not built. The play events and
landing coordinates that would drive it are already stored and already take
zero random draws, so this is a player over an existing stream rather than new
state. **Moved into stage 15**, with the camera work that would make it worth
watching — a replay of the current fixed-seat view is a replay of a diagram.


**K4 · Cards in three dimensions.** Raised while planning stage 7: the cards
should have depth, motion and effects rather than being flat panels. Filed into
**stage 14, broadcast**, which already owns big-moment presentation, sound and
the full-screen celebration — the same job, which is making the game feel like
the sport. Building it for one card first and spreading it later is the mistake
this project has already made twice.

**K5 · Habit tracking, and what it costs.** Stage 7's badges are earned by how a
coach actually plays, which needs counters the save does not yet carry: games
managed, mound visits, steals and bunts called, freshmen played, walk-ons kept,
wire stories opened, men talked out of the draft. Roughly a dozen integers per
coach — trivial per season, and worth watching against the 12.3 KB a year the
save already grows, because it is the first thing to be recorded for all
ninety-six coaches rather than only for you.

**Thresholds are seeded and hidden.** Nobody is told how many of anything earns
a badge, and the number differs per save. It solves farming and adds replay
variety with one decision.

**K3 · The mound visit conversation.** Stage 6 shipped the visit as a single
confirm. The design asked for, and agreed as deferred:

A sheet showing the pitcher, his confidence and what the last three batters did,
then three things you can *say* — **settle him** (low risk, small gain),
**challenge him** (bigger gain if he is the type, a real loss if he is fragile),
**take it off him** (protects a young arm; a veteran may find it patronising).

Three things make it a game rather than a menu. Each pitcher has a
**temperament** you learn across his career — hidden in a freshman, known in a
senior you have coached three years. **Repetition costs**: a second visit to the
same man does less, a third may irritate him. And the **count is real**.

**Moved again, to stage 15 — the ballpark.** It is a sheet in the dugout rather
than a coach system, and stage 15 now owns the dugout's presentation entirely.
The badges it wants will exist by then either way. Original reasoning below,
which still holds for *why it waited*:

The half that makes it a decision is
*which register works*, and that should read the coach's personality badges as
much as the pitcher's temperament — a players' coach lands "that's on me", a
hard-nosed one lands "you're better than this". Badges arrive in stage 7.
Building it before them means building the interesting half twice. The upgrade
costs exactly one sheet: the button, the count and the confidence plumbing are
identical either way.

**K6 · An aura per postseason tournament.** Raised while planning stage 7's
school cultures: if a programme can believe something, so can a tournament. The
conference tournament, the regionals and the national showdown would each carry
their own character — how they are described, how the wire covers them, what
winning one is worth to a reputation. Unscheduled; it belongs wherever the
postseason is next opened up, and it is small enough to ride along.

## K. From two seasons of stage 7 — August 28, 2026

Sixteen items reported after playing the interview, the cultures and the
approach system through two full careers. Eleven shipped, five open.

### Shipped

| # | Reported | Cause | Where |
|---|---|---|---|
| 1 | A mound visit or bullpen change "simulates one at bat — the animation of the ball flying runs" | The flight effect depended on `version`, bumped by every store write, so any decision that was not a pitch replayed the last ball | `Manage.tsx` |
| 2 | The opposing bench changed pitchers once all game with its reliever "depleted and being hit around" | Both hook tests were written for a starter: `budget` is 30 + stamina, so a 35-stamina reliever was allowed ~60 pitches, +12 flat and +18 for a patient hook put the change near 90. Six earned runs is not "hit around" | `game.ts` |
| 3 | "It told me I reached the nationals — I lost in the regionals and was 22nd" | A `finish` of `'regional'` is written for everyone who *plays* a regional and overwritten on winning one, so the banner read it as the opposite of what it means. 32 play regionals; 20 reach the national field | `SeasonReview.tsx` |
| 4 | A home run "looks like it is still falling inside the park" | `sin(travel · π)` returns to zero exactly at the wall, so the last quarter of the flight slid the ball along the grass. Now peaks at ⁴⁄₅ and crosses at 92% height | `Diamond3D.tsx` |
| 5 | Confidence "regained far too rapidly — restored after an inning when he had lost it all" | Not a balance fault. The card follows the ball, so the arm on the mound while you bat is *theirs*; a fresh opponent under a kicker reading only PITCHING looks like your man healing. A clean inning returns ~0.07 | `Manage.tsx` |
| 6 | The program page "stopped showing the college overview and showed coach information instead"; only a wipe fixed it | `programSheet` is store state. An inbox card deep-links to the coach sheet and the overlay's back bar closes the *overlay*, leaving the sheet set — and the PROGRAM tab has no bar and that branch renders no tabs. A one-way door | `Program.tsx` |
| 7 | A man brought back from the draft was inducted to the hall | `activeIds` reads rosters, which is one `reinstate` away from true on the very step the ballot runs. An outcome of `'stayed'` is read from the board directly now | `store.ts` |
| 8 | An inbox offer "just opens the school overview and nothing happens" | It linked to a read-only page while every offer is a live button under WHO IS CALLING | `store.ts` |
| 9 | "Made the regionals without winning it and got no prestige"; −3 after a title year | `madeTournament` is a seat in the 20-team field, so the 32 who lose a regional scored what a program that stayed home scored. Priced at 2, with the slow fall confined to programs already at 70 | `program.ts` |
| 10 | "Red cards still read as a loss" | `--clay` is documented both as the accent for active states *and* as the colour trophy cards must avoid because it reads as a loss. The collision painted your own bracket row in it | `tokens.css`, `Postseason.tsx` |
| 11 | "Wrote to one school and nothing happened" | Nothing was owed — it was ignored and said so — but nearly every chair is occupied, so the vacancy bonus rarely applied and a plain letter was a 12% shot. Now 18%, taking a season's three from 32% to 45% | `program.ts` |

### Open

- ~~**The five creation questions are too long.**~~ Shipped. Measuring found the
  questions were never the long part — the asks have a median of 19 characters.
  The *setups* had a median of 107 and a maximum of 163: three lines of scene
  before a one-line question, five screens running. All eighty rewritten to a
  single line, median 63, and pinned at 90 in `interview.test.ts`.
- ~~**The winners→losers transition is "quite wild".**~~ Shipped, and the cause
  was better than "needs polish": the comment above `mySide` had claimed *"the
  map fades in under it"* since it was written, and the only transition in the
  file was a button background. There was no fade. There is now, keyed on stage
  and side so it does not replay every time a score arrives underneath it.
- ~~**Press conferences.**~~ Shipped August 28, closing stage 7. Twenty
  questions, nine triggers, eight a season behind a four-game cooldown. See
  `05-systems-reference.md` §29.8, including the bug the first version had —
  the badge lean applied to both channels, which rounds a neutral one to a whole
  one in each direction and turns a nudge into a verdict.
- **A man talked out of the draft "is no longer in my roster".** Not reproduced.
  `reinstate` and the roster cap both hold across twelve worlds
  (`tests/keepplayer.test.ts`); the hall half of the same report is fixed
  regardless of cause. Likely a save written before some of this existed.
- **`mine`-is-clay elsewhere.** The wire, the board, signing day and the dugout
  share the pairing fixed in the postseason. Repainting the app's accent should
  be a deliberate decision, not the tail of a bug fix.

### Calibration after this batch

Measured, not assumed. Prestige mean 54.1 → 56.5, sd 17.7 → 16.7, bottom star
bucket preserved (an earlier attempt at +5 with a league-wide slow fall gave
61.1/14.6 and emptied it). Goldens re-recorded after the hook change: 5.325 runs
a game against a 5.300 target, worst deviation 4%, all ten NCAA tolerance tests
passing. Suite 849 green.

## L. Stage 8, the roster — shipped August 28, 2026

Position competence, the depth chart, real DH handling, redshirts, position
changes and academic eligibility. Two-way players split out by decision. Full
write-up in `05-systems-reference.md` §30.

### Decisions taken

| Question the plan left open | Answer |
|---|---|
| How position competence is modelled | A penalty on the defensive spectrum, not a rating per position. Secondary spots **derived** from the ladder, so generation is untouched and no golden moved. |
| Whether a redshirt is a coach's call or a rule | A call, and by the real baseball rule — no four-game grace, one appearance burns the season. FR/SO, once a career, three a season, 0.85 growth. |
| How academic risk is surfaced | A visible, manageable rating on the player's card, for **your program only**. Managed with "a word with him", four a season. |
| Whether two-way is generated or made | Generated, rare — but **not in this stage**. |

### The three faults, and the shapes they are

- **A state nobody can be in.** The grade distribution floored at 34 while
  `FAILING` is 28, so 'trouble' was unreachable. Third occurrence of this shape
  after `Builder` and the unpriced regional. Caught the same way each time: a
  test that asks for a man in the state.
- **Correct and ruinous.** Ranking the chart on merit re-picked 94 of 96 lineups
  on day one — right in baseball terms, and it would have moved every number in
  the game. The incumbent now leads his own spot.
- **Right arithmetically, wrong about the sport.** The spectrum said a catcher
  could cover shortstop for free. Found by *looking at the screen*; no test
  would have caught it, because the arithmetic was correct.

### Also worth recording

The classroom shipped running in the wrong place — off the store's news hook,
which fires once after a whole season is simulated. SIM SEASON checked a single
week after every game had been played, and the worker path could never have
called back into the store. It lives in `simNextDay` now, gated on
`captureBoxFor`.

### Open

- **Two-way players.** Their own stage. They arrive two-way, they are rare, and
  pitching does not suppress the bat.
- **Morale.** Stage 9. The press room wants it and stage 8's "a word with him"
  is the mechanism it should extend rather than duplicate.
- **The 260ms bracket tween** from the stage-7 batch is still unverified — the
  preview browser never composites frames, so `requestAnimationFrame` does not
  run there.

## M. Stage 9, players as people — shipped August 28, 2026

Injuries, workload, morale, playing-time expectations and the captain. Full
write-up in `05-systems-reference.md` §31.

### Decisions taken

| Question | Answer |
|---|---|
| Who gets injuries | **League-wide** — the opposite call to grades, and for the opposite reason: a rival losing his ace is visible and changes the team you play. |
| Visible risk or pure chance | **Pure chance, for now.** No durability rating — which makes the roll derived-not-drawn, so a reload cannot re-roll it. |
| Season-ending injuries | Exist, rare — about one per program per three seasons. The case the depth chart exists for. |
| What morale does | **Performance and transfer risk.** Not development: compounding it would be a death spiral rather than a mood. |
| Stated or inferred expectation | **Stated**, so breaking a promise is a thing you did. |
| Captains | **One, appointed**, gated on the `makeup` badge family. |

### Two bugs a single game could not have shown

- **Fielding eight.** `coverFor` returned a short card when a roster ran thin.
  Unreachable until injuries went league-wide. He plays hurt now.
- **A man hurt on the same day every year.** The roll hashed the day index —
  which restarts each spring — against a seed that never changes.

### A method note, against myself

The second was found while chasing a drop in champion diversity, a figure that
read 14, 16 and 13 distinct winners in thirty-five years across one session. It
is noise and diagnosed nothing. The bug was real on its own terms. Recorded
because the finding was right and the reasoning was not — and the next person
reading a one-sample distribution shift should discount it the way I did not.

### Open

- **`flightRisk` is written and read by nothing.** It is stage 10's. Written now
  because the mood driving it is modelled now.
- **Durability ratings**, deferred with "for now" attached — the honest upgrade
  path if pure chance reads as arbitrary in play.
- **Two-way players** and **declining the DH**, both still stage-8 spillover.

## N. Stage 10, the transfer portal — shipped August 28, 2026

Both directions. Full write-up in `05-systems-reference.md` §32.

### Decisions taken

| Question | Answer |
|---|---|
| Where it sits | Between the draft and recruiting. Both steps before it are men leaving; recruiting comes after because you cannot shop for holes you have not found yet. |
| Windows | One. |
| Who enters | `flightRisk` off morale, plus being buried — so a departure is a promise somebody broke. |
| Talking him round | Yes, out of the same budget, and dearer the unhappier he is. |
| Currency | The recruiting budget, **widened 40 → 56** because it now pays for three things where it was fitted for two. |
| How good | Better than average, not better than the top of the board. |
| Rivals | Both directions, all ninety-five. |
| Eligibility | Immediate. One move a career. |

### What it cost, measured

Clear rate 65.6% → 64.8%, prestige 56.2 → 56.3, turnover 8.2 → 8.4 chairs a
year over thirty-five seasons. Noise — recruiting is close to zero-sum, so a
league-wide budget rise mostly moves everybody together.

### Two bugs

- **Men evaporated.** The first version had rivals losing players and signing
  none, so everybody who entered went off one roster and onto nobody's. Fixed by
  having the other ninety-five shop it, which is what "both directions" meant.
- **The portal could not be left.** No pinned action on the screen, so the
  offseason stopped there. No test caught it — every test drives `nextPhase`
  directly and never has to find a button. Two minutes of actually playing did.

### An ordering constraint worth knowing

Departures run on the way into the draft, the portal one step later, and
`fillRosters` at the year roll. **Anything that removes players must sit between
those two halves.** A probe written against `advanceOffseason` (both halves at
once) refilled before emptying and the next season opened short — the engine
threw `has an empty lineup slot`. The game's own order is correct; the hazard is
for anything new that touches rosters.

## O. How long the climb takes — **RETRACTED, then re-opened** August 28, 2026

> **The numbers below are wrong and the conclusion drawn from them was wrong.**
> `aiTargets` and `closeWeek` are called only from `state/store.ts`; there is no
> engine-level recruiting driver. So a headless harness that walks the engine's
> own offseason **never signs anybody** — every roster in the country is refilled
> with walk-ons every year. That is what produced "nobody won in six hundred and
> sixty seasons", a prestige line frozen at 19, and a plateau at 34 that looked
> exactly like an unreachable bottom rung.
>
> Three separate readings were taken off that harness and all three were
> artefacts. The tell was there and I missed it twice: raising `PIPELINE_EDGE`
> from 0.25 to 0.45 changed **not one digit** of the output, which is only
> possible if recruiting is not running at all.
>
> The balance question is genuine and unanswered — a low-star school should be
> able to climb progressively, not shoot for five-star recruits. Answering it
> needs the harness to drive the **store**, which `tests/store.test.ts` already
> proves is possible. Until then there is no measurement here, only a lesson:
> a probe that reproduces part of a pipeline measures that part, and the way to
> catch it is to change an input and check the output moves.

### The original entry, kept for the record

`tests/climb-probe.ts`. Asked directly: take a low-star school and report how
long it takes to win the nationals. Answered headless over many worlds rather
than by playing one career, because one career that won in year three says
almost nothing and one that never won says less.

**What it measures:** the weakest program at a given star level, run by the same
automatic staff every other program gets, with stages 8, 9 and 10 live. It is
the **floor**, not the ceiling — a real coach recruits deliberately, works the
portal, keeps his players happy and grows his own skills, none of which this has.

| Start | Reached Omaha | Won it | Never made a regional |
|---|---|---|---|
| 1 star, 12 careers × 30 seasons | **0/12** | 0/12 | 2/12 |
| 2 star, 10 careers × 30 seasons | **5/10**, median year 13 | **0/10** | 0/10 |

### The finding, and it is a balance question rather than a bug

**Nobody won.** Twenty-two simulated careers, six hundred and sixty seasons, no
national title. Half of the two-star careers reached Omaha and none of them won
it; the one-star careers never got there at all.

Some of that gap is real and wanted — the floor *should* be hard, and the
coaching layers are supposed to be worth something. But a floor this hard is
worth a decision rather than an assumption, because three things now push the
same way:

- **Prestige was deliberately made stickier** in stage 7 (§29), so a program
  that climbs holds its gains — and so does everybody above it.
- **The recruiting budget scales with prestige**, so the rich recruit better.
- **Stage 10's portal cost scales with quality**, and a two-star budget buys
  less of it.

Worth checking before v1: whether a *played* career clears the bar the automatic
one cannot, and by how much. If the coaching layers are worth ten years of
climb, the design is right and the floor is just honest. If they are worth two,
the ladder needs a rung.


## P. The low-star climb — measured properly, August 29, 2026

`tests/climb-store-probe.ts`. Drives the **store**, so the recruiting weeks
actually run, and prints how many men the coached programme signs each year so
the measurement voids itself if they ever stop. That guard exists because the
previous harness (§O) silently signed nobody and produced three false findings.

### The baseline

A one-star programme, recruited each week by the same `aiTargets` the other
ninety-five use — so "run competently", not "run by a player who never opens
the screen". Six careers, twenty-four seasons, 676 recruits signed.

| | |
|---|---|
| Prestige | 19 → ~26 by year ten → **~22 by year twenty-four** |
| Wins | 10–12 of 45, flat, for a quarter of a century |
| Reached Omaha | **0 of 6** |

**It is a stable low equilibrium**, and the arithmetic is exact: 11 wins in 45
is a .244 percentage, `seasonScore` returns ~24, prestige converges to 24 and
stays. Two stars begins at 38. The bottom rung of the ladder is fourteen points
above where a one-star programme can reach.

### Two fixes tried and measured, both rejected

**An overachievement ratchet** — prestige moving on wins above the board's ask
rather than on raw record. Made it *worse* (prestige y24 fell to 15–22), and the
reason is the useful part: a one-star programme is not overachieving. Its board
asks for about fifteen and it wins eleven, so it is **missing** its target. You
cannot reward a climb that is not happening.

**Doubling the in-state pipeline** (`PIPELINE_EDGE` 0.25 → 0.55). Moved wins
10→11 and prestige y24 to 19–29; one world of six climbed to 33 and 14 wins.
Directionally right, far too weak to matter, and not worth shipping on its own.

Both reverted.

### Why they failed, and what would not

The loop is roster → wins → prestige → recruits → roster, and both levers acted
on the *last* link only. Five slightly better freshmen a year cannot move a
45-game record when the other eighteen men are replacement level and the class
graduates away. Anything that fixes this has to act on the size of the gap
rather than on the margin:

- **Reach, not fit.** `PIPELINE_REACH_BONUS` is one star. Two would let a
  one-star programme chase four-star men *in its own state only* — still no
  leapfrogging out of state, which is the stated constraint.
- **Class weight.** A signed class is a handful of freshmen against a roster of
  23. Fewer, better recruits per class would let one good year matter.
- **Talent compression.** Narrow the spread between the best and worst rosters
  so that eleven wins becomes fifteen.

Each is league-wide and wants its own measured pass. Logged rather than guessed
at, because three levers have now been tried and two of them were noise.

### The change that shipped — August 29, 2026, and it did NOT close this

None of the three levers above. The user supplied a fourth, and it is better
than all of them because it acts on the *first* link in the loop rather than the
last:

> *"the prestige thing should be more considerate with low star colleges. What
> if we make it that they only lose a bit of prestige if they don't make the
> post season 3 years in a row? Also make them earn a bit more prestige than
> 3–5 star colleges — for example, if 4 star gets 3 points of prestige for
> making it to the post season, 1 and 2 star schools get 5. That ramps them up
> to the point where they can get better and descend if they do a bad job."*

Two mechanisms, both in `nextPrestige`:

- **`climbLift(current)`** — 1.7× at prestige 5, sliding to 1.0 at
  `CLIMBING_UNDER` (45). It scales the *achievement* terms only, never the
  win percentage, so a small programme is paid more for a regional and not for
  merely existing. Applied through a new `programTarget`, kept deliberately
  separate from `seasonScore`: `seasonScore` answers "how good was this season"
  in the absolute, and the coach's own reputation is measured *against* the
  programme with it. Folding the school's size into that number would pay a
  coach twice for the same regional and quietly make the small jobs the best
  jobs in the country.
- **`DROUGHT_GRACE`** — a climbing programme that misses May takes a quarter of
  the fall while its drought is under three years, and the whole of it after.
  `TeamRecord.drought` is sparse and counted for all ninety-six, so a rival
  climbing out of the cellar climbs by the same rule the player does.

**Why this works where the other three did not.** The measured problem was never
that the climb was slow — it was that the fixed point was 24 and the next rung
was 38, so there was *nothing to climb to*. Reach, class weight and compression
all try to win more games at a fixed reward. This changes what a season is worth,
which moves the fixed point itself: a one-star programme that plays a regional
now targets ~35 rather than ~26. It still cannot leapfrog — the lift pays only
for things you actually won, and it is gone entirely by two stars, which is the
stated constraint (*"1 star schools should not be able to shoot for 5 star but at
least be able to progressively climb"*) expressed as a curve.

**Found while wiring it, and not reported:** `rivalOutcome` set
`madeRegionals: finish !== 'missed'`. `Finish` has a `'missed'` case in the type
and `runPostseason` never writes it — a programme that stayed home is simply
absent from `finish`. So the test was `undefined !== 'missed'`, which is `true`,
and every one of the ninety-five rival programmes has been credited with a
regional it did not play since the flag was added. Ninety-five free points of
season score a year. The user's own outcome has always asked
`post.finish[me.index] !== undefined`, which is the right question; the two were
written on different days.

**League effect, measured** (`carousel-probe 35 4242`, before → after):

| | main | after |
|---|---|---|
| prestige mean | 56.3 | 55.2 |
| prestige sd | 17.0 | 17.9 |
| turnover / year | 8.4 | 8.7 |
| clear rate | 64.8% | 65.5% |
| distinct champions in 35 | 13 | 17 |
| top five / bottom five | 93.8 / 33.6 | 95.0 / 33.6 |

The league did not inflate — it deflated slightly, which is the `madeRegionals`
fix removing a free +2 from ninety-five programmes and paying it back only to
schools that earned it. Distinct champions is one seed and should not be read as
more than directional; the numbers that matter are the mean and the turnover,
and both held.


### Measured after shipping it, and it did not move — August 29, 2026

`climb-store-probe`, six careers, twenty-four seasons, same seeds as the
baseline:

| | baseline | after `climbLift` | after the bank as well |
|---|---|---|---|
| prestige y24 | 22 22 19 27 26 22 | 22 19 19 27 26 22 | 20 20 22 23 20 22 |
| avg wins | 10–13 | 10–13 | 8–11 |
| Omaha | 0 of 6 | 0 of 6 | 0 of 6 |

**Unchanged. The mechanism is correct and it never fires.**

The reason is exactly the sentence already in this entry, three paragraphs
above, and it should have been read before writing the fix rather than after
measuring it: *"you cannot reward a climb that is not happening."* Both new
mechanisms pay for **achievements**. A programme winning ten of forty five has
none. `programTarget` therefore returns `winPct * 100` — the lift multiplies
nothing and `climbBonus` adds nothing — and the drought shelter never engages
either, because the programme is not falling. It is held level, at 24, which is
precisely what it was before.

Arithmetic, checked directly rather than inferred:

| | target | next |
|---|---|---|
| 11–34, nothing to show for it, at 22 | 24.4 | **22** |
| 27–18 with a regional and a bid, at 22 | 71.2 | **33** (was 30) |

So the change is worth keeping and is not the fix. It makes the ladder climbable
*once a programme is on it* — a first regional is now worth eleven points of
standing instead of eight, which is the difference between a good June being
noticed and a good June being noise — and it corrected the `rivalOutcome` bug on
the way. It does nothing about the first rung.

**What actually blocks it, stated plainly.** A regional berth needs roughly
twenty-seven wins of forty-five; the thirty-second best programme in the country
is around there. The measured baseline wins ten. That gap is roster quality, and
no prestige rule can close it, because prestige is downstream of wins. The loop
is roster → wins → prestige → recruits → roster, and every lever tried so far —
the overachievement ratchet, `PIPELINE_EDGE`, and now the prestige reward — has
acted on a link **after** wins.

The three unexplored levers all act before it, and they are the same three this
entry already listed. Two of them are one lever wearing two hats:

- **Reach** (`PIPELINE_REACH_BONUS` 1 → 2, in-state only) and **class weight**
  (fewer, better signings) both change *who a small programme can sign*.
- **Talent compression** changes *how much the roster gap is worth in wins*, and
  it is the only one that acts on the 45-game record directly. It is also the
  only one that touches every programme in the country, so it is the one that
  needs the soak and the goldens, not just the carousel.

**A method note, and it is the second time in two days.** The rule this project
already wrote down after §O is *change an input and confirm the output moves*. I
shipped `climbLift`, then measured, then found it moved nothing, then added the
bank, then measured again, then found *that* moved nothing either. The order was
wrong both times. The five-minute version of this check exists — compute
`programTarget` for the measured baseline outcome and see whether it differs from
`seasonScore` — and it would have said "these are identical, the programme
achieves nothing" before either mechanism was written.

## Q. Deferred from the August 29 play batch

Four items the reporter explicitly held rather than asked for.

- **The pool of recruits.** *"we also need to do something with the pool of
  recruits, we have to work on that later."* No detail given yet and none
  invented here. Likely relates to §P — class weight is one of the three
  unexplored levers, and it is the same pool.
- **The bracket.** *"about the bracket, we will rework that later."* The 260 ms
  transition to the user's own game shipped and has never been seen by anybody:
  the preview browser does not composite frames, so `requestAnimationFrame`
  never runs there and it cannot be verified from this side.
- **The park's geometry** — fielder positions and the second baseman taking
  balls that belong to the pitcher. Deferred by the reporter to stage 15, which
  is where the write-up now lives.
- **The player card and the portal's readability** — stage 10.5.

---

## R. What is still open, September 1 2026

The file's own rule is that an item leaves when it ships. Sections A through Q
were written before stages 11–14 and the September 1 session; rather than
rewrite them, this section is the current ledger. **If something is not listed
here, it either shipped or was decided against.**

### DECIDED — waiting on a build slot

- **Stage 15.5 · the voice.** A pass over every user-facing string. Reported as
  *"there are many things explained in a way that only an AI would
  understand"*, which is fair and specific: the game names systems where a
  person would name a thing. Four rules and the inventory are in
  `07-v1-plan.md`. **The inbox noise pass folds in here** — half of what it
  posts does not need a card, and cutting is a writing job.
- **The recruiting report, reworked.** One line pool per potential *letter*
  rather than lines that span a range of grades, so an attentive player can
  learn the code and read a class properly. Protection is volume: seven grades
  at fifteen to twenty lines, roughly a hundred and twenty lines of prose. The
  stable per-man hash stays (if the words moved there would be nothing to
  learn) and the development lines keep their fuzzy bands (making both axes
  decodable would leave nothing to scout).
- **Remove the test aids.** The loaded Pascagoula Tech roster, and Hans Hood —
  a 20-overall, 99-potential third baseman injected into every recruiting class
  and pinned to the foot of the board. Both are marked `TESTING ONLY` in code
  and must leave together. PSC was measured winning back-to-back national
  titles in a save the player never touched.
- **Freesound licence verification** before any store release. See
  `public/sfx/CREDITS.md`: CC-BY needs the credit shipped, NC cannot ride with
  paid IAP.

### OPEN — needs an answer before it can be built

- **Prestige runs away.** Over thirty seasons a handful of programmes climb to
  the mid-90s while the median sits in the forties. Measured with the September
  1 quality drift switched **off** and it is unchanged, so it is a property of
  `nextPrestige` and not of that pass. The question is whether a 94-prestige
  tier should be that reachable.
- **Realignment ignores geography.** A 2028 run sent Piedmont State to the
  *Pacific*. With "the conference **is** the region" as a core fiction,
  `realignmentFor` should prefer adjacent regions.
- **The depth chart's future.** The reporter is considering folding it into the
  lineup tab entirely, now that the lineup does the real work. Do not invest in
  the chart screen until that is settled.
- **Position changes from the player profile** — agreed in principle, no design.

### PROPOSED — designed, not agreed

- **The Room.** A locker-room system: derived ties between men, trust that
  moves on decisions already being made, and four shapes of recurring decision
  surfacing through NEEDS YOU. Written up in full as an artifact on September 1
  in answer to *"I played many seasons and I just pressed the same buttons"*.
  **Deferred by the reporter the same day**, along with the cheaper alternative
  (a storyline engine over the wire's existing threads). NIL was ruled out
  explicitly. The proposal stands if either is revived.

### The standing errand

- **The Play Console record.** Registration and verification are done; the
  listing is not. Nothing is blocked on it until stage 17.
