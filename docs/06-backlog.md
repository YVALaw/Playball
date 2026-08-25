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

### The postseason, expanded

The format changes shape. Today only conference champions advance, so a
forty-win team that loses one series in May is finished — harsher than the real
sport, and it makes the regular season worth less than it should be.

| Stage | Field |
|---|---|
| Direct to nationals | the **top four in the country**, who skip two rounds |
| Conference tournaments | 8 champions |
| Runners-up tournament | 8 at-large |
| Regionals | those 16, as four regions of four → 4 champions |
| Nationals | 4 auto-qualifiers + 4 regional champions = **8**: quarterfinal, semifinal, final |

Twenty of ninety-six programs reach the postseason, about a fifth, which is the
share the real tournament takes. Finishing top four nationally is worth two
rounds and a rested staff, so the national table means something on its own
rather than only deciding seeding.

The arithmetic is the reason nationals had to grow. Four automatic bids into a
four-team national field would *be* the whole field, and every conference
tournament and regional beneath it would be decoration.

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

## B. Agreed and designed, not yet built

Ordered by dependency. Records come first because badges, the hall of fame and
half the achievements are all reading from the same book.

- **B1 · The records book** — SHIPPED. League-wide, thirty-eight rows, holders
  only. Single game and feats are taken inside `recordResult`; single season,
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

  Two ladders, and the higher wins. Prestige carries the climb because prestige is
  already the number that moves on overachievement and decays when nothing
  happens, which is what a reputation should do. Trophies act as **floors** on top
  of it, one rung per thing there is to win: a bid is Respected, a league is
  Established, a region is Renowned, the country is Legendary. So a national
  champion is never introduced as a journeyman however the last two seasons went,
  and twenty quiet years does not make anybody renowned — a test pins exactly
  that. See §5.
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
- **B17 · Surface platoon splits** — SHIPPED. THE SPLIT panel on the ratings tab,
  two columns, VS RHP and VS LHP: contact and power as effective ratings and the
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

- **The two required boxes the checklist cannot supply.** What is left of the
  clear-rate gap after the split, and it is the player's board so it was not
  touched. `objectivesFor` requires a national tournament bid of every `contend`
  and `championship` program. There are **eight bids for ninety six programs**
  and fifteen to nineteen carry the requirement, so about thirteen fail it every
  year by arithmetic. `notLast` costs another seven, because somebody finishes
  last in each of eight conferences and most of those programs are on `develop`.
  Together that is a fifth of the league in breach of a required box before a
  ball is thrown, and it is the whole distance between the measured 55% clear
  rate and the 62% `expectationFor` claims.

  `objectivesFor`'s own docstring already states the rule these break: "Only four
  of eight teams can finish in the top half, so requiring it of more than half
  the league guarantees mass failure no matter how well anyone plays… A board
  that asks for the arithmetically impossible is not a hard board, it is a broken
  one." Placement objectives were spent carefully and the two most zero-sum asks
  in the game were not.

  Fixing it is a change to the player's board and should be taken deliberately,
  with the clear rate re-measured on both sides. Estimated: clear rate to roughly
  62% and rival turnover from 11.7 to about ten. Candidates — make the bid a
  bonus rather than a requirement for `contend` and keep it required only for
  `championship`; or make the required box "reach the conference tournament
  final", which the same eight conferences can supply sixteen of.
- Recruiting offers should be able to promise what a recruit actually wants — a
  starting job, playing time — rather than only spending hours on him.
- `highSchoolLine` derives its numbers from true ratings with a fixed noise
  term, so the formula can be reverse-engineered to pin present ability to about
  ±6 regardless of scouting skill. One line to widen.
- No mandate requires a conference title, though `objectivesFor`'s own docstring
  says otherwise.
- `FIELD_SIZE` and `runPostseason`'s `size` parameter are vestigial.
- `Expectation.expectsTournament` and `expectsConference` are computed and never
  read.
- Stale comments listed in appendix A of the systems reference. The postseason
  note that described four-team double-elimination regionals is gone; what is
  left there is `FIELD_SIZE`, the five UI files above, and four smaller ones.

## G. From the original roadmap, never built

`01-roadmap.md` carries sixty-two unticked boxes, most of them stale — the work
shipped and nobody went back to tick them. What follows is what is genuinely
still missing, verified against the source rather than read off the list. The
roadmap should be reconciled against this section and then trusted again, or
retired in favour of this file.

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

### G3 · The 3D track — audited

Done: lazy loaded and code split, every material unlit so there is no lighting
cost, DPR capped at 1.6, and ball flight driven off the engine's landing
coordinate with a profile per batted-ball type.

Missing, and the first one is the surprise:

- **There are no fielders in the scene.** Only the runners and the ball. Nine
  men are simulated in detail and none of them is drawn.
- Runners are individual meshes rather than instanced.
- **One fixed camera that never moves.** No easing, no three positions.
- **`frameloop` is the default `always`**, so the canvas renders continuously
  between pitches. The only item here with a real battery cost, and the one to
  fix first.
- No 2D/3D toggle. The 2D diamond survives only as the Suspense fallback while
  the chunk loads, which is not a setting.
- Thirty frames a second has never been measured, because the game has never
  run on a phone.

Park geometry (see G4) belongs to this track.

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

- **Source files that say the world has 64 programs.** Mostly done: the engine,
  the state layer, the data file, `Rankings.tsx`, `Today.tsx` and `Wire.tsx` are
  swept, along with the `PostseasonProgress` comment below. Five UI files were
  outside that pass and still carry one — `Avatar.tsx`, `Player.tsx`,
  `Program.tsx`, `Standings.tsx`, `TeamCard.tsx` — and they are listed in
  appendix A of the systems reference. **One correction to an earlier draft of
  this line, which claimed none of it reached the screen: one did.**
  `SeasonReview.tsx` told a coach who made Omaha he was one of "four teams out
  of sixty four", and that was copy the player reads. It is fixed. The rest is
  comments, and debt rather than a bug.
- **T1** in `04-implementation-plan.md` still stands: `sim.ts parity` hardcodes
  a 68-against-38 matchup and prints a verdict it fails by its own criterion.
  Correction to an earlier draft: **B5 is closed**, not open. The implementation
  plan reversed its own conclusion in a later calibration pass — 18% was too
  high rather than too low, `LEAGUE_K_RATE` is the sourced 0.164, and
  `CONTEXT.normalizer` closed B6 in the same move.
- `package.json` says **0.6.2** while the last release commit is v0.7.4, and the
  README still describes a 33-game season and "no save slots" when the season is
  45 games and named slots shipped.
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
