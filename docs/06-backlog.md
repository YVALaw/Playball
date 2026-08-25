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

### Records are scaled, not literal

Real marks come from 56-to-75-game seasons; ours is 45 (eleven three-game
conference series plus twelve non-conference). Counting records are scaled by
games played so they can actually be chased; rate records are taken as they
stand, because a .400 average means the same thing in any season length.

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
- **B2 · Seed the book with real NCAA marks** — SHIPPED. Twelve seeds, counting
  marks scaled by games played and rates left alone, flagged in the data and
  badged **NCAA** on the screen. See §13.3, which recorded that seven of the
  twelve were out of reach and blamed the run environment. Half of that was
  wrong, and A7 above is the correction: the environment was right and the
  rating curve was flat. With it fixed the best simulated season is 12 home runs
  and .462 rather than 9 and .427, so the marks are a long way closer without
  being cheap. What is left of the gap really is the aluminium bat.
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

  One number is hotter than the real sport and is left alone deliberately: about
  **twenty seven chair changes a year out of ninety five**, mean tenure near three
  and a half seasons. It falls straight out of `expectationFor`'s designed 62%
  clear rate applied to ninety five boards instead of one, and tuning it would
  mean giving rival boards more patience than yours — a two-tier system, which is
  the thing this was built not to be. See §16, and the E list below.
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
- **B16 · Detailed pitch types** — `DECIDED`. A real repertoire per pitcher.
  Also the prerequisite for pitch-usage tendencies, so it and the usage half of
  B11 are one job.
- **B17 · Surface platoon splits** — `DECIDED`. `platoonSkill` already exists and
  is deliberately hidden; contact and power against left and right handers is
  what every other baseball game shows. Nearly free.
- **B10 · Badges** — `DECIDED`, spec agreed. Four families (situational,
  physical, technical, makeup), three tiers, position-aware, playful names.
  Effects sized against the engine's own reference points: home-field advantage
  is a 1.020 multiplier worth about +4.9 points of win probability, so a gold
  badge on a channel that fires a quarter of the time lands near +1.75% across a
  season. At most two at signing, and a ceiling that climbs with the grade:
  **S 6 · A+ 5 · A 4 · B 3 · C 2 · D 2**, with S+ exempt because the store
  player carries ten. One rung per step at the rare end, so inserting A+ into
  the ladder buys something rather than merely renaming S — an earlier draft
  gave A+ and S the same six and the new grade meant nothing here.
  D and C share their two on purpose: three quarters of the country lives in
  those two grades, so a fine gradation matters least there, and it produces
  the right reading — a low ceiling recruit can arrive already at his badge
  cap, which is what "he is close to the player he is going to be" has been
  telling you on the board all along. Some innate and visible, some
  earned, some coached. No decay — these are young men and there are no injuries.
  Not visible on other programs' players.
- **B11 · Tendencies** — `DECIDED`, and **all of them**, with pitch usage and
  clutch as the priority pair. What a player *does*, as against how well he does
  it, so they add identity without power creep. Double-edged by construction: a
  free swinger walks less and ambushes more. Visible on opponents, unlike
  badges, because a scouting report saying their leadoff man runs is exactly
  what a defensive setting is for.
  Buildable on today's engine: free swinger / patient, first-pitch hunter, green
  light (per-player baserunning aggression — we have a team policy only),
  nibbler / attacker, quick worker, and pull-happy / spray, which works because
  the fielding rework gave us real batted-ball lanes to bias. Pitch usage needs
  B16 first.
- **B12 · Hall of Fame induction** — `DECIDED`. **Your own players only** — you
  see the men you coached, not a national ballot. On merit, and the failure mode
  to design against is explicit: *a man who holds one single-game record and was
  otherwise ordinary must not get in*. Sustained excellence over a career, not a
  spike. Replaces the career-leaders placeholder on the program page. Depends on
  B1 and B9. The third dependency, A5, is cleared: a hall of fame reading an
  archive that lost every player's final season would have honoured the wrong
  men, and the archive no longer loses it.
- **B13 · Career records league-wide** — `DECIDED`. Requires widening archiving
  beyond your own program, which is the one genuinely expensive piece; single
  game and single season records have no such problem.
- **B14 · The S+ store player** — deferred to v1.0. 82 overall on arrival, 99
  potential, ten badges, faster progression, exempt from the cap.

## C. Depth systems — each needs its own design pass

Agreed in principle, and explicitly **not** to be built until each has been
specified and agreed on its own. Listing them is not designing them.

Transfer portal · injuries · fatigue and season workload · position changes ·
playing-time expectations · morale · a progression and decline rework ·
opponent scouting reports · rivalry histories and a dossier that remembers
upsets, streaks and postseason meetings · expanded awards · position-change
training · detailed pitch repertoires · broadcast presentation, with adaptive
treatment for no-hitters, elimination games and championships · a dynasty
documentary timeline built from real career events · a geographic recruiting
pipeline map with contested territory.

~~MLB Decision Day, where juniors weigh draft stock against role, loyalty and
development.~~ Shipped as part of B9, and it is the draft screen: he hints at
what is pulling him and you make one of four cases. It never needed a day of its
own.

## D. The record marks

**Shipped as section D stands** — the twelve verified single-season marks are
seeded in `engine/records.ts` with the arithmetic in a comment, and the career
table below is not, because career records are B13. This section stays because
it is the provenance: it is where the numbers came from and what is still
missing, and the seeds should not be edited without it.

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
- **Two prestige scales that do not share a mean, and the churn it causes.**
  Found while measuring B7, and it is one item rather than two because the
  second is entirely caused by the first.

  `nextPrestige` pulls a program toward `seasonScore`, whose league mean is about
  **52** — win percentage averages 50 and the fixed pot of postseason bonuses
  adds a couple of points spread over ninety six. `initialPrestige` seeds the
  world with a mean nearer **43**. The two numbers are nominally the same 0–100
  scale and are not the same distribution.

  It never mattered while one program in ninety six was passed through
  `nextPrestige`. With all of them going through it the whole league lifts nine
  points and settles there, which is stable — but `expectationFor`'s
  `standing = prestige × 0.45 + roster × 0.55` rises with it, so programs cross
  into `contend` and `championship`, where reaching the national tournament is a
  **required** box that eight of ninety six can fill. Measured: the league-wide
  clear rate is about **a third**, against the 62% `expectationFor` was tuned to.
  That 62% was never a property of the function alone; it was a property of it at
  the seeded distribution.

  Downstream of it: about **twenty seven chair changes a year out of ninety
  five**, mean coaching tenure near three and a half seasons, roughly three times
  the real sport's rate.

  Three candidate fixes, none taken yet because all three touch the player's
  board and none should be done quietly: centre `initialPrestige` on
  `seasonScore`'s mean; take the free postseason bonuses out of `seasonScore` and
  price the whole thing on win percentage; or move the mandate thresholds off
  absolute standing and onto the program's *rank* in the league, which is
  immune to the whole class of problem. Giving rival boards their own patience is
  explicitly **not** on the list — that is a two-tier system, which is the thing
  B7 was built not to be.
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
- `05-systems-reference.md` Appendix B says no tendency specification exists;
  B11 in this file names six buildable ones. This file is newer.

## F. Research outstanding

- **Simulation gap analysis** — how OOTP, Diamond Mind, Strat-O-Matic and the
  sabermetric literature resolve a plate appearance, against what we do. Two
  questions matter most: whether our log5 implementation is standard, and
  whether the evidence on clutch talent — which is that it barely exists —
  argues for keeping situational badges small and honest.
- **The remaining record marks**, from a source that can actually be fetched.
