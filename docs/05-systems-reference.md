# Systems Reference: what the game does, and what it does not say

**Last updated:** August 26, 2026
**Companion docs:** `01-roadmap.md` for the product and stack, `06-backlog.md` for
what is agreed and not yet built, `02-sim-engine-spec.md` for engine internals,
`03-engine-salvage-audit.md` for the forked engine copies,
`04-implementation-plan.md` for the phase plan and defect register.

---

## What this document is for

Two jobs, and the second one is the reason it exists.

**One.** It is the single explanation of every system in the game, accurate enough
to be the source material for anything player-facing — a manual, an in-game help
screen, a wiki. Every number in here was read out of the code, and the file or
function it came from is named beside it.

**Two, and this is the important half.** It is the register of **hidden and
hinted mechanics** — the things a player experiences and cannot see. A scouting
band that is deliberately not centred on the truth, a pipeline that quietly
means one state rather than one region, a coach skill worth 79 ten-thousandths of a
plate appearance. These are the parts of the design that are invisible by
intent, and invisible-by-intent is one bad week away from
forgotten-by-accident. Once nobody can say what a mechanic does, it stops being
a design and becomes folklore, and the next person to touch it either
reimplements it or breaks it.

The **[Hidden Mechanics Index](#hidden-mechanics-index)** below is that register.
It is meant to be complete for what exists today. The systems that were planned
when it was written — badges especially — have since landed and taken their
rows; whatever is built next gets one on the day it does.

## How to keep it current

- **A change to a number is a change to this document.** If you retune
  `reportWidth`, `reachFloor`, `SECURITY_DELTA` or any other constant named
  here, update the row. A reference that is 90% right is worse than none,
  because it will be trusted.
- **Cite functions and constants, never line numbers.** Lines drift within a
  week; `truthPosition` and `COMMIT_POINTS` do not.
- **Anything hidden from the player gets a row in the index.** That is the rule
  the whole document is built around. If a player can feel it but cannot read it
  off a screen, it belongs in the table.
- **Never let a planned system read as though it exists.** Use the status
  markers. `PLANNED` sections say plainly that nothing is built.
- **If the code does not settle it, say so.** Appendix B collects everything
  currently undetermined. Adding to that list is a contribution; guessing is not.

## Status legend

| Marker | Meaning |
|---|---|
| **SHIPPED** | Implemented, wired to the simulation, and covered by tests in `tests/`. |
| **IN FLIGHT** | Being written right now. Present in the working tree, behaviour may still move. |
| **PLANNED** | Designed and agreed. **Nothing is built.** No code implements it. |

> **A note on the working tree.** An earlier draft of this document was written
> against a tree with a dozen engine files uncommitted, and several sections
> carried **IN FLIGHT** for work that was finished but unlanded — the defensive
> layer of §10 most of all. Nothing is in that state now: every system described
> here is committed, wired to the simulation and covered by tests, and no
> section carries the marker. If one ever does again, it means exactly what the
> legend says and it is a promise to come back and change it.

---

## Hidden mechanics index

Everything the player experiences and cannot directly see. Sorted by system.

| # | Hidden thing | What the player sees instead | Where it lives | Status |
|---|---|---|---|---|
| 1 | **True overall and true ceiling of a recruit.** Never shown at any point before signing day. | A band, e.g. `52–70`, and a letter span, e.g. `C – S`. | `reportedOverall`, `reportedPotential` — `engine/recruiting.ts` | SHIPPED |
| 2 | **Band width is set only by `coach.skills.recruiting`.** Not by stars, rank, weeks spent, or money. | The width itself, stated on the report tab. | `reportWidth`, `skillReach` — `engine/recruiting.ts` | SHIPPED |
| 3 | **The truth is deliberately *not* centred in its band.** A bowed draw pushes it away from the midpoint; about 9% of recruits land in the middle fifth. | Nothing. The band looks symmetric. | `truthPosition` — `engine/recruiting.ts` | SHIPPED |
| 4 | **One shared bias for the whole sheet.** Overall and every individual tool are displaced by the same fraction in the same direction, so averaging the midpoints recovers the bias, not the truth. | Six independent-looking bands. | `SALT.bias`, `windowAround` — `engine/recruiting.ts` | SHIPPED |
| 5 | **Scouting noise is hashed from the player id**, not rolled. Re-rendering, reloading, or reopening a card never re-rolls an opinion. | A report that never changes. | `scoutNoise` — `engine/scouting.ts` | SHIPPED |
| 6 | **Which prose lines a recruit can draw is decided by his true grade and true rawness**, and the pools overlap heavily so no line ever identifies a grade. | Two sentences. | `ceilingLinesFor`, `developmentLinesFor`, `hintsFor` — `engine/recruiting.ts` | SHIPPED |
| 7 | **Understatement is legal, falsehood is not.** A quiet line can belong to an S; no line can appear above the grade it stops being true at. | A line that may or may not be damning. | `CeilingLine.to` — `engine/recruiting.ts` | SHIPPED |
| 8 | **The development line is drawn on growth remaining, which is near-independent of ceiling height.** | A second sentence that reads like more of the first. | `rawnessOf`, `DEVELOPMENT_LINES` — `engine/recruiting.ts` | SHIPPED |
| 9 | **Star rating and national rank both carry projection error.** They are two readings of one noisy opinion, not of the truth. | `★★★★` and `#38`. | `serviceScore`, `starsFor` — `engine/recruiting.ts` | SHIPPED |
| 10 | ~~**The reach gate is a hidden per-recruit roll.**~~ **No longer hidden.** The floor is now one tier below the recruit's own grade, flat, and the prospect sheet prints it — so a coach can read the ladder off the screen instead of discovering it by tapping. The gate ignores the `minProgram` stored on an old save and reads his star rating, so one rule runs whatever the save remembers. | "He will not take the call. A ★★★★★ recruit hears out a ★★★★ program and up…" and a `Min. prestige: ★★★★` line. | `reachFloor`, `canPursue` — `engine/recruiting.ts`; §2.4 | SHIPPED |
| 10a | **The pipeline is worth exactly one star of reach, and it is the program's home *state* rather than its region.** The sheet says a home-state recruit comes a rung down; it does not say the rule is `state`, so a coach in the Gulf may reasonably expect four states' worth of blue chips and get one state's. About 63% of states hold a five star in a given year. | "He is in your pipeline." on the sheet, and `− 1 here` beside the minimum prestige. | `inPipeline`, `PIPELINE_REACH_BONUS` — `engine/recruiting.ts`; §2.4 | SHIPPED |
| 10b | **A program below four stars keeps one AI board slot two grades above itself**, which after the gate can only ever hold a home-state recruit. Without it the pipeline exception would exist for the human alone. | A small program with a blue chip on its board. | `aiTargets` — `engine/recruiting.ts`; §2.4 | SHIPPED |
| 10c | **A home-state recruit is worth up to a quarter more fit, and the size depends on how small the program is** — ×1.25 at one star, nothing at all at five. The sheet says he is in your pipeline; it does not say what that is worth in the courtship, or that a blue blood gets none of it. | Local recruits who stay when they used to leave. | `PIPELINE_EDGE`, `fit` — `engine/recruiting.ts`; §2.5a | SHIPPED |
| 11 | **A recruit's priority weights.** The five weights are drawn per player and sum to 1; the screen names them but never prints the weights. | Priority labels and blurbs, strongest first. | `drawPriorities`, `PRIORITY_LABEL` — `engine/recruiting.ts` | SHIPPED |
| 12 | **Fit multiplies effort rather than adding to it.** Hours spent on a recruit who does not want what you have are close to wasted. | A "+N pts a week" figure that is quietly small. | `weeklyPoints` — `engine/recruiting.ts` | SHIPPED |
| 13 | **A five-star costs about 2.65× a two-star in banked points.** | Nothing. | `commitPointsFor`, `COMMIT_POINTS` — `engine/recruiting.ts` | SHIPPED |
| 14 | **Early commitments are a coin-weighted draw**, not a threshold: margin > 0.35 *and* enough points, then a 45% roll. | Recruits committing on some weeks and not others. | `closeWeek`, `COMMIT_MARGIN` — `engine/recruiting.ts` | SHIPPED |
| 15 | **The rest of the league gets two free passes at the board before week 1 opens**, the second at half weight. | A board that is already contested on day one. | `seedRivalInterest` — `state/store.ts` | SHIPPED |
| 16 | **AI programs read a snapshot of the board taken before anyone spends**, so turn order cannot advantage anybody. | Nothing. | `leadersAtWeekStart`, `aiTargets` — `engine/recruiting.ts` | SHIPPED |
| 17 | **AI programs abandon a recruit they are more than 40% behind on.** | Suitors quietly dropping off a recruit's page. | `aiTargets` — `engine/recruiting.ts` | SHIPPED |
| 18 | **An uncontested recruit gets a scaled AI bonus, `1 + 0.18 × stars`.** | Blue chips rarely staying uncovered for long. | `aiTargets` — `engine/recruiting.ts` | SHIPPED |
| 19 | **Recruiting budget scales with your program's star tier**, 40 up to 60. | The budget number on the board header. | `budgetFor` — `engine/recruiting.ts` | SHIPPED |
| 20 | **A scholarship you do not spend becomes a walk-on 13 points below your program's level.** | A name on the roster with a bad rating. | `WALK_ON_PENALTY` — `engine/progression.ts`; §2.10 | SHIPPED |
| 20b | **A walk-on is drawn on a private seed — the class year and the program index — rather than out of the world generator.** That is what lets the class review show him by name before he exists, and what makes the man on that card the man who reports in June. It also means `fillRosters` spends no season draws at all, so nothing about a program's walk-ons depends on how many programs were rebuilt before it. | A face and a rating on signing day for a man nobody signed. | `walkOnClass`, `walkOnSeed` — `engine/progression.ts`; §2.10 | SHIPPED |
| 20a | **A walk-on is gone after one *season*, not after one class year.** He is manufactured as a freshman, and the question is asked before `departure` and independently of what the roster calls him — so a spot filled this way is a spot you are shopping for again next winter. Asking first also costs no `rng()` draw, so nothing about who else leaves depends on how many walk-ons a program is carrying. | A name that turns up for a year and is not there the next. | `Player.walkOn`, `departAndDevelop` — `engine/progression.ts`; §2.10 | SHIPPED |
| 21 | **7% of generated freshmen get a large extra headroom draw** on top of ordinary headroom. This is the only reason hidden gems exist. | Nothing at all. | `projectPotential` — `engine/players.ts` | SHIPPED |
| 21a | **No player the world makes may be given a ceiling above 94**, one below the S+ floor, and nothing on any screen says the grade is reserved. The gate is on the number rather than the letter, so development, the scouting bands and the draft all agree about it. | An S+ nobody ever scouts, and a top grade that reads as merely very rare. | `GENERATED_POTENTIAL_CAP`, `TOP_GENERATED_GRADE` — `engine/scouting.ts`; §1.6 | SHIPPED |
| 22 | ~~**Platoon skill is a hidden per-player number.**~~ **Surfaced, as B17.** The number itself is still not printed, but what it does to a man is: THE SPLIT panel on the player card (the STATS sheet, since §20) shows his contact and power against each hand and the production swing underneath, off the same arithmetic `platoonMultiplier` uses. The distribution can still go negative, so real reverse-split players exist and the card says so. | Two columns, VS RHP and VS LHP. | `drawPlatoonSkill` — `engine/players.ts`; `platoonSplit`, `platoonMultiplier` — `engine/ratings.ts`; §18.7 | SHIPPED |
| 23 | **The coach's OFFENSE skill is worth 1 basis point per point**, capping at ×1.0079 on the whole offensive vector. Home field is ×1.020. | A blurb: "slightly better at-bats". | `TeamState.coachOffMult` — `engine/game.ts` | SHIPPED |
| 24 | **DEFENSE likewise, ×0.9921 at the cap**, applied to singles, doubles and triples only. | A blurb. | `TeamState.coachDefMult`, `log5Outcome` — `engine/game.ts`, `engine/engines.ts` | SHIPPED |
| 25 | **TRAINING scales only the systematic pull toward potential, never the noise** — ×1.158 at 99. | Slightly better development years. | `develop`, `OffseasonOpts.training` — `engine/progression.ts` | SHIPPED |
| 26 | **Every program's coach skills reach the simulation, not only yours.** This was the reverse until B7: the other 95 played at raw ratings with a flat coach prestige of 45, recruiting 20 and training 20. Each chair now has a named man whose four skills feed the bench edge, his players' development, his recruiting pitch and what he can promise a drafted player. `AVERAGE_STAFF` is the fallback for a chair with nobody in it. | A rival program that recruits or develops better than its name suggests. | `syncCoachMods` — `engine/rivals.ts`; `advanceRecruitingWeek` — `state/store.ts`; `AVERAGE_STAFF` — `engine/draft.ts`; §16.7 | SHIPPED |
| 27 | **Your coach's age, name, home state and portrait never reach the simulation.** He does not retire and nothing reads where he is from. A *rival's* name and age do reach it — his retirement age is hashed off his name (row 71) — which is the one place the two kinds of coach genuinely differ. | A creation form that looks like it matters. | `CoachProfile` — `engine/program.ts`; `retireAge` — `engine/rivals.ts` | SHIPPED |
| 28 | **Trophy floors on the coach title.** A national champion can never be introduced below LEGENDARY however far prestige falls. | A word beside HEAD COACH. | `coachStanding` — `engine/program.ts` | SHIPPED |
| 29 | **A first-year coach's negative security hit is halved.** | Surviving a bad first season. | `reviewSeason` — `engine/program.ts` | SHIPPED |
| 30 | **The win target is priced off roster strength alone and sits ~1.5 wins below the median outcome**, buying about a 62% clear rate. | "The board wants 22." | `expectationFor` — `engine/program.ts` | SHIPPED |
| 30a | **A board may *require* only what the format can seat.** The checklist is on screen; the rule that shapes it is not. It is why a national bid is a bonus at every mandate rather than a requirement of contenders — there are eight bids and were fifteen to twenty programs asked for one — and why `contend` asks for a top-three finish instead of a top half. Two tests price the seats off `NATIONAL_BIDS`, `OMAHA_BERTHS` and the conference table rather than off the number eight, so the day the field grows they stop objecting on their own. | A board that asks for hard things and not for impossible ones. | `objectivesFor` — `engine/program.ts`; §6.3a | SHIPPED |
| 31 | **A proud program with a gutted roster discounts its own hiring bar** to the midpoint of prestige and roster. | A big job you can somehow get. | `hiringBar` — `engine/program.ts` | SHIPPED |
| 32 | **Coach prestige decays toward 45 every year**, at 4% of the distance. | Standing slipping in a quiet decade. | `nextCoachPrestige` — `engine/program.ts` | SHIPPED |
| 33 | **Coach of the Year is chosen by salience** — each category's winner divided by that category's league-wide standard deviation this season — not by a precedence list. | One award and one sentence. | `coachOfTheYear` — `engine/postseason.ts` | SHIPPED |
| 34 | **GIANT-KILLER carries a fixed salience of 4.0**, high enough to win whenever it fires. | Nothing. | `coachOfTheYear` — `engine/postseason.ts` | SHIPPED |
| 35 | **Every other program in the world has a fixed coaching personality derived from its team index.** | Opponents who bunt or run more than you do. | `strategyFor` — `engine/strategy.ts` | SHIPPED |
| 36 | **A blanket shift is a wash.** Measured at 4.72 → 4.71 runs allowed over 2,500 games. SITUATIONAL declines the bet against runners and non-pullers. | Three alignment options that look like three sizes of one thing. | `alignmentAgainst`, `SHIFT` — `engine/strategy.ts` | SHIPPED |
| 37 | **Calling for a steal does not improve its odds.** `forced` skips the attempt roll and nothing else. | A button that sometimes works. | `attemptSteal` — `engine/game.ts` | SHIPPED |
| 38 | **The automatic game only ever steals second.** A manager gets whichever bag is open; the AI does not. | Nothing. | `resolveSteal` — `engine/game.ts` | SHIPPED |
| 39 | **The catcher's arm suppresses attempts as well as converting them**, so a cannon shows up as empty basepaths rather than as a big caught-stealing total. | A quiet running game against certain teams. | `attemptSteal` — `engine/game.ts` | SHIPPED |
| 40 | **The catcher's arm is re-centred on 60, not 50**, because the position generates ten points above school quality. | Nothing. | `AVERAGE_CATCHER_ARM`, `catcherArm` — `engine/game.ts` | SHIPPED |
| 41 | **`bunt` and `steal` ratings are derived from the player's own profile**, not rolled free. | A slugger who cannot lay one down. | `makeHitter` — `engine/players.ts` | SHIPPED |
| 42 | **Range is measured against the fielder's own team average, not against 50**, so a good shortstop redistributes plays rather than adding defence to the league. That average is weighted by how often each position is actually thrown a ball, because an unweighted one sat below the man who fields it and turned the whole thing into a league-wide upgrade. | Plays above expected on a fielding line. | `RANGE_SWING`, `FIELDING_SHARE`, `TeamState.defense` — `engine/game.ts` | SHIPPED |
| 43 | **The out-to-hit direction is scaled by 0.178/0.4885** so good and bad gloves balance and league scoring does not move. | Nothing. | `OUT_TO_HIT_BALANCE` — `engine/game.ts` | SHIPPED |
| 44 | **Two separate error paths, glove and throw**, splitting one calibrated total rather than adding to it. | "reaches on an error" vs "throwing error". | `GLOVE_ERROR_BASE`, `THROW_ERROR_BASE` — `engine/game.ts` | SHIPPED |
| 44a | **Half the first baseman's ground balls are a feed to the pitcher covering the bag, and that play reads two men** — the fielder's accuracy and the pitcher's hands — while the error goes on the first baseman's line either way. A real scorer would split it; the engine resolved the play in one roll and does not pretend to know which end of it failed. | A throwing error charged to the first baseman. | `throwRisk`, `COVER_FIRST_SHARE` — `engine/game.ts`; §10.5 | SHIPPED |
| 45 | **A pitcher's `armAccuracy` is pulled toward his control**; his fielding ratings are centred below a position player's. | Comebackers thrown away. | `makePitcher` — `engine/players.ts` | SHIPPED |
| 45a | **The two fielding numbers on the card do not have the zero the player will assume.** `playsAboveExpected` counts an error as a play not made, so the league average is about minus one per team per game rather than nought; `fieldingPct` divides by chances rather than by putouts plus assists, so it lands near .960 against a real D1 .967. Both are for comparing defenders with each other. | Two figures on a fielding line. | `fieldingPct`, `playsAboveExpected` — `engine/season.ts`; §10.6 | SHIPPED |
| 46 | **A ceiling a player has already cleared is silently revised upward.** | Potential that moves. | `develop` — `engine/progression.ts` | SHIPPED |
| 47 | **Underclassmen are exposed by age, not by talent.** Three years completed *or* twenty one, whichever comes first — so the ~20% of freshmen who arrive at 19 or 20 come into range one or two Junes early. Eligibility itself is stated on the player card; what the card does not say is that a club then discounts him for the years of eligibility he could walk back to (×0.35 for a sophomore, ×0.15 for a freshman). | Losing a sophomore, rarely. | `draftEligible`, `yearsOfLeverage` — `engine/draft.ts`; `LEVERAGE_DISCOUNT`, `departure` — `engine/progression.ts`; §14.1 | SHIPPED |
| 47a | **Arrival age is hashed from the player id, not drawn**, so it costs the generator no rng call and cannot move a calibration figure. 80% at 18, 15% at 19, 5% at 20. | An age on the card. | `arrivalAge`, `ARRIVAL_SALT` — `engine/players.ts`; §14.1 | SHIPPED |
| 47b | **Professional clubs price a player on current ability, last season's production and his age — never on `potential`.** A club taking a finished player over a raw one who will be better is correct behaviour, and the coach's private knowledge of who will grow is the edge it buys him. | A round number. | `visibleValue`, `seasonForm` — `engine/draft.ts`; §14.2 | SHIPPED |
| 47c | **The round is a position on somebody else's 600-pick board**, via a logistic centred at value 61 with a scale of 6 — not a rank among our own men. This is why round one is one or two men in the country and the median man taken goes in the teens. | `RD 12`. | `draftRound`, `BOARD_MID`, `BOARD_SPREAD` — `engine/draft.ts`; §14.3 | SHIPPED |
| 47d | **What a retention offer is worth per unit is hidden; what the round demands is printed.** `keepPoints(round)` is on screen, `affinity × credibility × 5.0` is not — so the price is only knowable by reading the man. | "WHAT A ROUND 8 MAN WANTS · 43", and afterwards "it was worth 31 against the 43". | `keepPoints`, `offerWorth`, `KEEP_RATE` — `engine/draft.ts`; §14.4 | SHIPPED |
| 47e | **A player carries the five recruiting priorities he was signed on**, and a man nobody recruited gets a hashed set from the same distribution. Neither is ever printed; the draft screen gives two overlapping prose hints instead. | Two sentences about what is pulling him. | `Player.priorities`, `prioritiesFor` — `engine/recruiting.ts`; `pullHints`, `PULL_LINES` — `engine/draft.ts`; §14.5 | SHIPPED |
| 47f | **The other ninety five programs talk drafted men round too, and choose better than you do.** A rival reads its own player's priorities exactly and makes the cheapest case that is true, out of 40% of its recruiting window; what stops the league hoarding is that it only fights for a man in the top quarter of what is coming back. 18% of exposed men stay. | A rival roster that did not lose the junior you expected it to. | `bestCase`, `rivalKeeps`, `AI_KEEP_SHARE`, `AI_KEEP_EDGE` — `engine/draft.ts`; `keepBar` — `engine/progression.ts`; §14.7 | SHIPPED |
| 47g | **What a rival spent in June comes off its recruiting weeks, exactly as yours does.** `aiTargets` works off `weeklyBudget(stars, spentInJune)`, not the flat forty it used to — which is what made giving the AI a retention mechanic honest rather than free. | Nothing. | `aiTargets`, `weeklyBudget` — `engine/recruiting.ts`; `DraftBoard.rivalSpend` — `engine/draft.ts`; §14.7 | SHIPPED |
| 48 | **A signed recruit with nowhere to play still joins**, on the bench or in the pen. | A full class. | `refill` — `engine/progression.ts` | SHIPPED |
| 49 | **Roughly a third of days a regular sits**, and his replacement takes the spot of whoever plays his position. | Bench players with real statistics. | `restedLineup` — `engine/season.ts` | SHIPPED |
| 50 | **The bullpen is offered most-rested-first, ties broken by quality.** | The right arm turning up. | `restedFirst` — `engine/season.ts` | SHIPPED |
| 51 | **Each bracket round advances the calendar by one day**, and each side's rotation slot is its *own* appearance count mod 3. | Rested arms in June. | `advancePostseasonDay`, `playSeriesGame` — `engine/postseason.ts` | SHIPPED |
| 52 | **A global spread knob, `SPREAD = 0.62`, scales every rating sensitivity in the engine.** | How often the better team wins (measured 75.6% at a 13-point gap). | `SPREAD`, `mult` — `engine/ratings.ts` | SHIPPED |
| 53 | **A normalizer of 1.070 divides out the expected product of every context modifier**, so situational boosts redistribute offence without inflating the league. | Nothing. | `CONTEXT.normalizer` — `engine/ratings.ts` | SHIPPED |
| 54 | **A Jensen correction of 0.959 on the strikeout rate**, because `exp` is convex and a population with spread averages above the configured rate. | Nothing. | `JENSEN_K` — `engine/ratings.ts` | SHIPPED |
| 54a | **How far a rating goes differs by event, on purpose.** The best power hitter in the country homers at 3× the league rate; the best contact hitter singles at only 1.34×, because that is what real baseball does. | Stars who look like stars on the leaderboard. | `BAT_SENS`, `PIT_SENS` — `engine/ratings.ts`; §9.7 | SHIPPED |
| 54b | **Four per-event constants cancel the inflation that widening causes**, because `exp` is convex, the generator centres hitters near 44 rather than 50, and log5 renormalises a slugger's own denominator. Without them the league's home run and walk rates would have moved. | Nothing. | `BAT_NORM`, `PIT_NORM` — `engine/ratings.ts` | SHIPPED |
| 55 | **The event stream takes no random draws.** Watching a game play by play must not change what happens. | Identical results simmed or watched. | `landingFor` — `engine/game.ts` | SHIPPED |
| 56 | **Player generation draw order is load-bearing.** Adding or removing an `rng()` call shifts every downstream number in the simulation. | Nothing. | header comment, `engine/players.ts` | SHIPPED |
| 57 | **The report tab renames ratings.** A pitcher's `stuff` prints as `K/9`, `movement` as `H/9`, `control` as `BB/9`; a hitter's `eye` prints as `DISCIPLINE` and `range` as `REACTION`. | Different words from the ones the roster uses. | `Report` — `ui/screens/Board.tsx` | SHIPPED |
| 58 | **Signing day judges your report, not the recruit.** It says "TOP OF YOUR REPORT" or "BOTTOM OF YOUR REPORT" and is deliberately silent in the middle. | Two labels, occasionally. | `verdict` — `ui/screens/SigningDay.tsx` | SHIPPED |
| 58a | **A player's id is not his name.** It is his position in the generator's stream, put through a hash and written as `p` plus seven digits — which costs no draw, cannot collide, and is reproduced exactly by a resumed save. Statistics, box scores, awards and the record book are all keyed on it, so before this two men called Tyler Johnson were one man in every one of them. Saves written earlier keep their name-shaped ids rather than being migrated; the two spaces cannot collide, because a name has a space in it. | Nothing — but before this, one man's career quietly containing another's. | `nextPlayerId` — `engine/players.ts`; §11.5 | SHIPPED |
| 59 | **The pool of names already taken is rebuilt from the save on every load**, and cannot be complete — a rival's graduated player is in no roster and in no record book, so his name comes back into circulation. | Occasionally two men with one name, on different teams. | `rebuildNameIndex` — `engine/season.ts`; `usedNames` — `engine/players.ts` | SHIPPED |
| 59a | **The shape of the world is rebuilt from the teams the save holds, not from `data/schools.ts` as it stands today.** A team is an index in a schedule, so reordering that file or moving a program between conferences used to repoint every index in an existing career — the same dynasty came back in somebody else's league, playing fixtures from a world it had never been part of, and nothing threw. | Nothing. | `worldFromTeams` — `engine/season.ts`; `fromPortable` — `state/seasonCodec.ts`; §11.6 | SHIPPED |
| 60 | **A scoreless-innings streak is measured a whole appearance at a time.** Allowing a run in the seventh zeroes the streak rather than crediting the six scoreless innings before it, because the game line records outs and runs and not the order they came in. | A record that reads a little short. | `scorelessOuts`, `recordResult` — `engine/season.ts` | SHIPPED |
| 61 | **A record must be beaten, not equalled**, including the seeded NCAA ones. | Stated on the record book screen; the incumbent simply staying put. | `offer` — `engine/records.ts` | SHIPPED |
| 62 | **Two teams level on everything are separated by their abbreviations, ascending.** The four criteria above it are real; the fifth is a stated coin flip that always lands the same way. | A table that has an order, with nothing on screen saying why those two are that way round. | `seedTeams` — `engine/season.ts`; §8.7 | SHIPPED |
| 63 | **Head-to-head is counted within the tied group, and only over the regular season.** A June meeting between the same two teams does not count toward the tiebreaker that seeded them. | Nothing. | `headToHead`, `seedTeams` — `engine/season.ts` | SHIPPED |
| 64 | **Your season is written into your players' careers at the draft step, not at the year roll**, because the roster it reads is emptied in between. It also fixes what class year the row is filed under: `departAndDevelop` ages every survivor as it goes, so archiving afterwards recorded a junior's season as a senior's. | Nothing — but before this, a departing player's final season was simply absent from his card, and everybody else's was a year out. | `archiveSeason` — `engine/season.ts`; `nextPhase` — `state/store.ts`; §12.4 | SHIPPED |
| 65 | **A run of bad seasons is remembered as a run.** The second consecutive `missed` or `failed` costs 5 points of coach prestige and every one after it costs 3 more, on top of the season's own arithmetic. One acceptable year wipes the run out completely rather than decrementing it, and so does taking a new chair. | The board saying "twice in a row now", and a separate inbox card naming the points. | `badRunPenalty`, `CoachState.badRun`, `takeChair` — `engine/program.ts`; §6.5a | SHIPPED |
| 66 | **The run penalty is not a second hit to job security.** Security already fell 14 or 28 for each of those seasons; doubling the sacking pressure would mean nobody ever reaches a third bad year for the escalation to apply to. | Nothing. | `reviewSeason` — `engine/program.ts` | SHIPPED |
| 67 | **Winning a regional and reaching Omaha are the same event in this format**, so `regionalTitles` prints under both names on the coach page. It is read off `regionChampions` rather than the finish string, so the day the postseason grows a round the two stop agreeing on their own. | Two rows with the same number. | `SeasonOutcome.wonRegional` — `engine/program.ts`; `summarize` — `engine/postseason.ts`; §5 | SHIPPED |
| 68 | **A regional title is deliberately not priced into `seasonScore`.** Reaching Omaha already pays for it at +12; a second line would have repriced every deep run in the game the day the counter was added. | Nothing. | `seasonScore` — `engine/program.ts` | SHIPPED |
| 69 | **The two game-level achievements are detected inside `recordResult` and cached on the season.** A comeback is a fact about the scoreboard in the sixth and a streak is only correct at the instant a game ends; neither survives to a season-end scan. `largestDeficit` walks the line scores half inning by half inning, because a side that goes down seven in the top of the first and answers in the bottom was behind by seven. | Nothing. | `SeasonState.feats`, `largestDeficit` — `engine/achievements.ts`; §15.3 | SHIPPED |
| 70 | **Achievements are the user coach's alone.** Rival coaches have full careers and could earn them; nothing would read them, and the announcement would be noise. | Nothing. | `engine/achievements.ts` header; §15.4 | SHIPPED |
| 71 | **Rival coaches are hashed, never drawn.** Names come off the chair and the year, retirement age off the name, and every hiring decision is a fact about a program and a man — so a whole rival year costs the generator zero `rng()` calls and cannot move a calibration figure. | Nothing. | `rivalName`, `retireAge`, `runCarousel` — `engine/rivals.ts`; §16.3 | SHIPPED |
| 72 | **A rival spends his season's skill points badly on purpose** — half into one hashed favourite, the rest scattered. An optimiser would put twenty years of points into recruiting and out-recruit any player who spent his attention elsewhere. | A country whose average coach never becomes elite. | `spendPoints`, `RivalCoach.lean` — `engine/rivals.ts`; §16.4 | SHIPPED |
| 73 | **A sitting coach will not move for less than 26 prestige — two star tiers — and will not move at all after 10 years in the chair.** Without the first, one retirement cascades through three programs; without the second, every good coach is eventually pulled up the ladder and no rival is ever a fixture. The 26 was re-measured after §16.10: the old value of 10 was fitted while the boards were sacking a third of the country, which is a different question. | A rival who stays long enough to be somebody. | `POACH_GAP`, `SETTLED_TENURE` — `engine/rivals.ts`; §16.6 | SHIPPED |
| 74 | **A board that cannot get anybody who clears its bar hires the best available anyway**, a sacked coach nobody wanted that June leaves the profession, and **the chair that sacked him is the one chair he cannot have**. | Nothing. | `runCarousel`, `FreeAgent` — `engine/rivals.ts`; §16.6 | SHIPPED |
| 74a | **Your board and a rival's are two boards, and the difference is two fields on `Board`.** A rival's reads the same checklist against *this year's* league rather than against the distribution `expectationFor` was calibrated on, and has one firing bar where yours has two. Everything else — the mandates, the objectives, `judge`, the security deltas, the sacking bar, the first-year grace, the bad-run penalty — is shared, and a 4,500-review sweep pins that yours is unchanged to the digit. | Nothing. Your board is the board it always was. | `Board`, `playerBoard`, `rivalBoard`, `rivalExpectation`, `CALIBRATED_LEAGUE` — `engine/program.ts`; §16.10 | SHIPPED |
| 74b | **A rival's mandate and win target are priced off the league, because two of the game's scales do not sit still.** Mean prestige drifts 41→51 and mean roster strength 45→55 over thirty five seasons, and `expectationFor` is absolute in both. Wins are zero-sum — 22.5 a program, always — so an absolute target lifting with the roster number put the required `wins` box out of reach for 53 of 96 programs a year. | A rival board that does not get harder just because the whole country got better. | `rivalExpectation`, `leagueShape` — `engine/program.ts`; §16.10 | SHIPPED |
| 75 | **A job offer is now a chair somebody would be moved out of.** `jobOffers` takes a predicate: empty, *or* held by a coach the country rates below you. It is deliberately not "empty" alone — the carousel never leaves a chair open, so that rule produces a market of nothing and a sacked career that ends on a screen saying nobody rang. | Taking a job and being told they let their man go to hire you. | `jobOffers` — `engine/program.ts`; `rollYear`, `acceptOffer` — `state/store.ts`; §16.7 | SHIPPED |
| 75a | **The coaching carousel is filed at two different volumes.** Ninety five careers produce five to twenty moves a year, so a change in your own conference is named and everybody else is counted in one line — with the exception that a poach is named at both ends wherever it happens, because a rival being taken by a bigger school is the single event the carousel exists to produce and should never be a number in a total. | Two or three names you know, and a sentence saying the country is alive. | `postCarousel` — `state/store.ts`; §17.3 | SHIPPED |
| 75b | **Opening the inbox marks everything read on arrival, not on the way out**, because the app unmounts a screen on a tab change, a phase change and an overlay — so marking on unmount would clear the badge for somebody who tapped INBOX and immediately tapped away. There is no per-card tick: a card with a chore attached is a chore. | A count that goes away when you look at it. | `markAllRead`, `unreadCount` — `engine/inbox.ts`; §17.4 | SHIPPED |
| 76 | **A pitcher's repertoire and every player's tendencies are hashed off the id, never stored and never drawn.** Same argument as arrival age: one `rng()` call per pitcher would have moved every calibration figure in the project. A save carries neither, and a dynasty from before they existed gets them for free. | A repertoire that never changes across a reload. | `repertoireOf` — `engine/pitches.ts`; `tendenciesOf` — `engine/tendencies.ts`; §18.1 | SHIPPED |
| 77 | **The pitch-usage tendency is read off the finished usage shares, not hashed like the other eight.** POWER ARM is a fastball share at or above .655 and JUNKBALLER at or below .470, which are the twenty-first and seventy-ninth percentiles of four thousand generated arms — so the pole sizes match every other slot without a second draw deciding them. | A pitch mix on the card, and a label under it that agrees with it. | `MIX_JUNK`, `MIX_POWER`, `poleOf` — `engine/tendencies.ts`; §18.2 | SHIPPED |
| 78 | **Every tendency pair averages to exactly 1.0 over the 21/58/21 population split.** That is what stops a tendency being a rating, and it is asserted per channel in `tests/traits.test.ts` rather than hoped for. | Nothing. | `pairOf`, `POLE_SHARE` — `engine/tendencies.ts`; §18.3 | SHIPPED |
| 79 | **Clutch is priced rather than granted.** The +5.5% with a runner in scoring position is paid for exactly by −1.74% without one, weighted by how often each arrives, so a clutch hitter's season line is identical to an ordinary man's. | A player who is better in the spots that matter and no better overall. | `CLUTCH_LIFT`, `CLUTCH_DIP`, `RISP_SHARE` — `engine/tendencies.ts`; §18.3 | SHIPPED |
| 80 | **A neutral multiplier pair is not automatically a neutral season.** Pace is not an outcome — it decides when a starter is pulled and when he tires — and at its first sizes it cost the league 1.3% of its walks by keeping starters, who throw more strikes than relievers, on the mound longer. The pace pairs are 40% smaller than they were. | Nothing. | the `Pair` docstring — `engine/tendencies.ts`; §18.3, §18.8 | SHIPPED |
| 81 | **How much of a tendency has been discovered, and the units it is counted in.** Evidence accrues per man from every game your program plays and is counted in plate appearances, times on base or balls in play depending on what the reading is actually made of. The card shows the bar filling; it never shows the counters. | STILL WATCHING, and a bar under it. | `Watch`, `isKnown`, `watchProgress` — `engine/tendencies.ts`; `noteWatch` — `engine/season.ts`; §18.4 | SHIPPED |
| 82 | **Tendencies are hidden on your own men and visible on everybody else's; badges are the reverse.** A tendency is what you can see from the other dugout, a badge is what you only know because you have had the man in your building. | A rival's leadoff man labelled GREEN LIGHT while your own is still being watched. | `isKnown` — `engine/tendencies.ts`; `Badges` — `ui/screens/Player.tsx`; §18.4 | SHIPPED |
| 83 | **A badge's size band is chosen by how often its situation arrives**, not by how good it sounds. Always-available channels get 2.5/4.5/7.0%, spot situations 3.0/5.5/8.0%, and the two rare ones 4.0/7.0/10.0%. | Three tier names. | `STEADY`, `SPOT`, `RARE` — `engine/badges.ts`; §18.5 | SHIPPED |
| 84 | **Three badges exist partly to keep the league's rates where they were.** SWING AND MISS answers TOUGH OUT on the strikeout column, WORM BURNER suppresses home runs as well as raising ground balls so LIGHT TOWER is not unopposed, and CROWDS THE PLATE puts back some of what PAINTER takes off the walk column. | Three ordinary-looking badges. | `badgeMods` — `engine/badges.ts`; §18.5 | SHIPPED |
| 85 | **Badge development is rolled off a hash of the player's id and the year, not off the offseason's random stream.** Two thousand rolls a year inserted into that stream would move every departure and every development draw in the league. Earned at 42% for a man who did the thing; coached at 16% for one thing a winter; both scaled by TRAINING up to ×1.8. | A badge appearing in the inbox in June. | `developBadges`, `EARN_CHANCE`, `COACH_CHANCE`, `trainingMult` — `engine/badges.ts`; §18.5 | SHIPPED |
| 86 | **The earning bars are set against what this engine's 45-game season actually produces, not against real college numbers.** Six home runs is the 95th percentile here and 48 was Incaviglia's real mark; a bar written from the record book would have been unreachable by everybody. | Nothing. | `BADGES[*].earned` — `engine/badges.ts`; §18.5 | SHIPPED |
| 87 | **Only a catcher can earn CANNON**, because stolen bases and caught stealing are recorded on the catcher's fielding line and nowhere else. An outfielder holding it got it innately or from his staff. | Nothing. | `BADGES.cannon.earned` — `engine/badges.ts`; `attemptSteal` — `engine/game.ts`; §18.5 | SHIPPED |
| 88 | **The hall of fame ballot cannot see the record book.** Not one row of it, single game, single season or career. A record is one measurement and a hall is a verdict on a career, and the failure mode the whole feature was designed against is the first substituting for the second. What a hall of famer holds is printed on his plaque and is worth nothing on the ballot. | STILL HOLDS, under the plaque. | `inductees`, `buildCase` — `engine/hall.ts`; §19.1 | SHIPPED |
| 89 | **A career is scored in runs above replacement, and the peak window is two seasons.** Replacement is 72% of the league's .126 runs created per plate appearance for a bat, and a 6.63 earned run average for an arm. Neither number, nor the score itself, is ever printed — the plaque shows the line he actually put up. | `4 seasons · .383, 23 HR, 161 RBI`. | `seasonRuns`, `PEAK_SEASONS` — `engine/hall.ts`; §19.2 | SHIPPED |
| 90 | **The induction bar is absolute, not a quota**, so a great program inducts about every second year and a poor one may never induct anybody. Measured at 130: ten men in twenty seasons at the strongest program in the country, one at the median, none at the weakest. | An empty hall at a bad job. | `HALL_BAR` — `engine/hall.ts`; `tests/hall-probe.ts`; §19.4 | SHIPPED |
| 91 | **Induction is decided when the draft step closes, not when it opens.** A drafted junior is off the roster from the first line of the offseason and may still be talked back onto it, so "his career is over" is not a settled question until the board is empty. A career also has to be over *everywhere* — a coach who moves jobs leaves sophomores behind. | Nothing, except the class never containing a man who comes back. | `nextPhase`, the `recruiting` branch — `state/store.ts`; `BallotInput.active` — `engine/hall.ts`; §19.5 | SHIPPED |
| 92 | **Career records are kept as a running total per active player, pruned the year after he leaves**, rather than by archiving every program's seasons. The ledger is the size of the league — about 2,400 rows, 308 KB — instead of growing 375 KB a season for ever. Each row carries the year it was last folded in, because a running total is the one pass over a finished season that is not idempotent for free. | Nothing. | `CareerTotals`, `recordCareerMarks` — `engine/season.ts`; §13.6 | SHIPPED |
| 93 | **The title beside HEAD COACH cannot climb more than one rung a season.** The prestige ladder is capped at `floor(games / 45)` rungs, so a first year cannot be better than JOURNEYMAN however it went. Trophies are exempt: they are floors, won on a day, and a first year champion is LEGENDARY that June. | A title that moves once a year. | `coachStanding` — `engine/program.ts`; §5 | SHIPPED |
| 94 | **Coach of the Year compares each category against a normal year of its own kind**, not against the league's spread, because three of the four saliences are maxima over pools of different sizes and the largest of ninety six always beats the largest of eight. Without it two of the four categories never fired at all. | Four different citations over a career instead of one. | `TYPICAL_SALIENCE`, `coachAwardCandidates` — `engine/postseason.ts`; §7.2 | SHIPPED |
| 95 | **The in-season inbox writers are scans, not events, and every card carries a keyed id.** The season can arrive finished from a worker in one press, so nothing may be read off state that is only true at a moment: runs come off the game log rather than the streak counter, and the halfway card counts the halfway game rather than the current record. A card posts once per year however many times the scan runs. | The same cards whether the season was simmed or played out. | `seasonNews`, `regularGames` — `state/store.ts`; `newItem`, `push` — `engine/inbox.ts`; §17.3a | SHIPPED |
| 96 | **A skill point can be taken back until the offseason leaves the coach step**, and only the points this visit put on. The ledger is not saved, so a reload commits them. | A `−1` that appears on a skill you have just spent on, and is gone next time. | `spentThisStep`, `refundSkill` — `state/store.ts`; §4.1 | SHIPPED |
| 97 | **The season goes into the record books at the board meeting, not at the year roll.** An award is resolved through the rosters, and by the year roll the departing class is off them — so a graduating Player of the Year's award reached no list at all, on the history screen or at the hall of fame ballot two steps later. | A history entry that appears one step earlier than it used to, with the leavers' awards on it. | `settleSeason`, `rollYear` — `state/store.ts`; §19.8 | SHIPPED |
| 98 | **The wire's variety is a hash, not a roll.** Which template a story wears comes off `vary(seed, count)`, a stable hash of the story's own content, so the paper reads differently story to story and identically render to render — and reading it never consumes a random draw. | A paper whose stories do not all sound alike. | `vary`, `wire` — `engine/wire.ts`; §20.1 | SHIPPED |
| 99 | **An old save seeds only the current chair's annals, and a seeded year carries no national rank.** The coach's career rows name his school and back-fill its book; `rank: 0` on those rows, because the career row's `rpi` is a value and printing it as a rank shipped "#0.493…" once. The other ninety-five programs start their books with their next finished June. | A history page that works on a save older than the feature. | `loadSlot` — `state/store.ts`; `recordSchoolAnnals` — `engine/postseason.ts`; §20.2 | SHIPPED |
| 100 | **The rookie job market is at most two offers per conference, always at least one, and every offer would genuinely hire you.** Filtered through the same `canBeHired` ladder the mid-career market uses, deterministic per world. | Six schools on the desk instead of ninety-six in a browser. | `startingOffers` — `engine/program.ts`; §20.3 | SHIPPED |
| 101 | **The preseason national table is a projection: roster strength weighted three to one over prestige, shown until the league has about four games a team.** Never persisted, never fed back into anything — the screen labels it a projection but not the blend. | "PRESEASON POWER RANKING · PROJECTED", then one day the real RPI table. | `Rankings.tsx` (display only); `rosterStrength` — `engine/program.ts`; §20.7 | SHIPPED |
| 102 | **An extra-base hit lands deep whatever station its fielder keeps.** A double no shallower than 0.68 of the field, a triple 0.88, pushed along the handling fielder's side — because the man credited with the play is the man it went past, and placing the ball at his feet told the story backwards. Same stable hash, no dice. | A triple that visibly reaches the wall. | `landingFor` — `engine/game.ts`; §20.8 | SHIPPED |
| 103 | **The 0.8 seconds under SIM GAME and SIM WEEK computes nothing.** The sim runs after the ring, in milliseconds; the pause exists so a night of baseball does not resolve faster than a thumb can lift, and it doubles as those buttons' rapid-fire guard. | A spinner in the button. | `Today.tsx` (display only); §20.5 | SHIPPED |
| 104 | **An interrupted game is replayed, not restored.** A `LiveGame` cannot be serialised, so what is kept is the season generator's position at the first pitch plus every call since; taking the offer rebuilds the identical game off them. The save is written *before* the game is created so the anchor is real. | An offer to pick up the game you were in when the phone rang, on the same pitch. | `state/liveJournal.ts`; `pendingFromJournal`, `resumeGame` — `state/store.ts`; §21.1 | SHIPPED |
| 105 | **The journal is the one thing not kept in IndexedDB.** `localStorage`, because an IndexedDB write is async and the event it exists to survive is the OS killing a backgrounded tab, where a pending write is a lost write. No memory fallback — the tests supply a real `Storage` instead. | Nothing, until a tab dies mid-game and the game is still there. | `readJournal`, `writeJournal` — `state/liveJournal.ts`; §21.1 | SHIPPED |
| 106 | **Where you fell is recorded when you fall, not afterwards.** A double elimination only knows a team's finish at the moment of its second loss, so `noteKnockout` writes `placing` and `advanced` there — and a regional exit asks `protectedTopFour` instead, which is arithmetic over a finished season. Second, third and fourth in a conference are still alive, and so is a protected team that lost a regional. | "Runners up · ON TO THE REGIONAL" where it used to say the season was over. | `noteKnockout` — `state/store.ts`; `howFar` — `ui/screens/Postseason.tsx`; §21.2 | SHIPPED |
| 107 | **The depth mode never reaches the engine, and that is the whole design.** Casual does not turn the bullpen off — it hands it to a pitching coach, which is what the other ninety-five programs have always had. Same league, same records, same hall of fame either way. Anything touching the whole world (injuries, eligibility, realignment) is therefore not a preference and cannot appear in the catalogue; a test asserts it never does. | Nothing. That is the point — a casual save and a full save are the same world. | `depth.ts`; `autoPitching` — `engine/liveGame.ts`; §22.1 | SHIPPED |
| 108 | **Only disagreements with the preset are stored, never the whole set.** A casual career from an older build picks up the casual answer for systems added since instead of silently opting out of them — and changing preset forgets overrides the new preset agrees with, which is a deliberate trade against hidden state that makes CASUAL quietly not casual. | A preference that survives until a preset grants it, then stops being an opinion. | `setSystem`, `setMode` — `state/depth.ts`; §22.1 | SHIPPED |
| 109 | **Every font size in the app is `calc(<n>px * var(--ts))`** — all 582 of them — so the text-size setting moves one number. Applied before the first paint, so the small version never flashes past. Verified in a browser before the sweep was written, because the first attempt to test it ran against a page that was dropping the stylesheet and reported failure. | Text that actually changes size, and identical rendering at 1. | `--ts` — `ui/tokens.css`; `applyPrefs` — `state/devicePrefs.ts`; §22.3 | SHIPPED |
| 110 | **The play-in lives inside the winners bracket, so losing it costs a drop rather than a season.** The opening round it replaced was a single-elimination gate standing in front of a double elimination tournament. Ten teams a half, eighteen games, nineteen with the reset — which is arithmetic, since nine teams must go out at two losses each. | A first-round loss that puts you in the losers bracket, still playing. | `TEN` — `engine/doubleElim.ts`; `splitShowdown`, `seatProtected` — `engine/postseason.ts`; §23.1 | SHIPPED |
| 111 | **June is counted twice, not moved.** Season totals include tournament play, so the postseason split is a second set of books rather than a subtraction — and it is kept for all ninety-six programs, because box scores exist for one and a rival's June is otherwise gone the moment it ends. | A POSTSEASON board, and a career line that says what a man did when it mattered. | `postBatting`, `CareerTotals.post` — `engine/season.ts`; §23.3 | SHIPPED |
| 112 | **The action button is a row of the frame, not a sticky element inside the scroller.** Sticky pins only while its containing block reaches the edge being stuck to, so a short offseason step left the button 305px up the screen. Filling the body was tried first and fails on screens that pass several children. | One control that is in the same place on every tab, content or no content. | `FixedHeader`'s `action` — `ui/Sticky.tsx`; §24 | SHIPPED |

---

## 1. Recruiting: the scouting report — **SHIPPED**

`src/engine/recruiting.ts`, `src/engine/scouting.ts`, `src/ui/screens/Board.tsx`

This is the most deliberately hidden system in the game and the one a player
spends the most time inside, so it gets the most space here.

### 1.1 The problem it solves

The board used to print a recruit's overall as one number and his ceiling as one
letter, both near enough the truth, both free, and both identical for every coach
in the country. There was nothing to scout, no way to be wrong, and signing day
could never surprise anybody. What replaced it is an estimate, and reading the
estimate is the skill.

### 1.2 The band, and what sets its width

Nothing widens or narrows a report except `coach.skills.recruiting`. Not the
recruit's star rating, not his national rank, not how many weeks you have been on
him, not money. Recruiting happens in three weeks at the end of a season, so
there is no room for a scouting economy where you buy looks at individual
players; the only lever is what the coach himself knows.

```
skillReach(s)        = clamp((s - 20) / 79, 0, 1)
reportWidth(s)       = 30 - 24 × skillReach(s)
reportGradeSteps(s)  = max(1, round(3 - 2 × skillReach(s)))
```

The numeric band's printed span is `Math.round(reportWidth(s))`. The ceiling band
spans `reportGradeSteps(s) + 1` letters.

| `recruiting` | `reportWidth` | printed span | grade steps | letters in the ceiling band |
|---|---|---|---|---|
| 20 (career start) | 30.000 | 30 | 3 | 4 |
| 30 | 26.962 | 27 | 3 | 4 |
| 39 | 24.228 | 24 | 3 | 4 |
| 40 | 23.924 | 24 | 2 | 3 |
| 60 | 17.848 | 18 | 2 | 3 |
| 79 | 12.076 | 12 | 2 | 3 |
| 80 | 11.772 | 12 | 1 | 2 |
| 99 (cap) | 6.000 | 6 | 1 | 2 |

Linear, not curved, because a coach point costs the same whichever one he is
buying and a curve would quietly make the middle of the track a worse deal than
the ends without ever saying so on screen. The ceiling band never collapses to a
single letter: the best recruiter alive still writes "A – S" and lives with it.

The report tab states the width out loud — "Your reports run **N points wide** at
recruiting *s*" — so the coach point that bought it is credited.

### 1.3 The truth is inside the band and hardly ever in the middle

A band the answer sits at the centre of is an exact number with extra steps. So
the truth is placed by a draw that *avoids* the centre:

```
truthPosition(id, salt):
  u       = scoutNoise(id, salt)          // stable in [0,1)
  side    = u < 0.5 ? -1 : +1
  outward = |2u - 1|
  return 0.5 + side × 0.44 × outward^0.62
```

The position runs over `[0.06, 0.94]` — held off the very edges, because a truth
that were always the top or bottom number would be as readable as one that were
always the middle. Analytically, the chance of landing in the middle fifth
(`[0.4, 0.6]`) is about **9.2%**; measured over a generated class of 720 it runs
6.5% to 11.7% depending on skill, the difference being rounding and the band
sliding at the ends of the rating scale.

Reading the centre of the band is still unbiased *over a whole class* — the draw
is symmetric — and wrong on almost every individual recruit. That is the point.

`windowAround` holds the width exactly, even against the ends of the 1–99 scale:
the band slides rather than shrinking, so the width goes on meaning only one
thing. Verified over a full class: the truth is inside the band 720/720 at
recruiting 20, 60 and 99.

### 1.4 One bias for the whole sheet

Six independently placed bands would let a player average their midpoints and
recover the truth to about a third of the width the coach was supposed to be
stuck with — the estimate defeated with arithmetic. So the overall band and every
individual tool band are all displaced by the **same** `truthPosition` draw,
under the shared salt `SALT.bias = 3301`. A scout who is high on a player is high
on all of him. Averaging returns the bias.

The other salts are separate so those draws do not move together:

| Salt | Value | Governs |
|---|---|---|
| `bias` | 3301 | Position of the truth inside the overall band and every tool band |
| `ceiling` | 3307 | Position of the true grade inside the ceiling band |
| `ceilingHint` | 3313 | Which ceiling line he draws |
| `developmentHint` | 3319 | Which development line he draws |

### 1.5 Stable noise

`scoutNoise(seed, salt)` in `engine/scouting.ts` hashes a string id and an integer
salt into `[0,1)`. It is not a random draw: refreshing a screen does not re-roll a
scout's opinion, a reload does not either, and two coaches looking at the same
recruit see reports cut from the same noise (of different widths).

### 1.6 The ceiling band

`reportedPotential` grades on the **true** potential rather than on a blend of
present and future — the uncertainty lives in the width of the band instead of in
a fudge inside the number. The letter scale is the same one your own roster is
graded against, so "we scouted him C to S and he came out A" is a sentence the
class review can actually say.

`potentialGrade` (`engine/scouting.ts`), calibrated against the league: the
median college player projects to about 53 and the ninetieth percentile to 71.

| Grade | True potential | Per national class of 720 |
|---|---|---|
| S+ | ≥ 95 | **0 — see below** |
| S | ≥ 92 | 3.1 |
| A+ | ≥ 85 | 5.9 |
| A | ≥ 74 | 37.8 |
| B | ≥ 63 | 125.3 |
| C | ≥ 50 | 293.4 |
| D | below 50 | 254.6 |

Measured over forty seeded classes, 28,800 prospects.

**S+ is reserved and unreachable.** `GENERATED_POTENTIAL_CAP` (94, one below the
S+ floor) is applied in `projectPotential` — the single funnel every generated
player passes through, whether he arrives in a recruiting class, as a walk-on,
or in the roster a rival program starts the world with. The highest ceiling
generated anywhere across that sample was 94.

The gate is on the *number* rather than the letter, deliberately. Development
pulls a man toward his raw potential, the scouting bands are cut from it, and
the draft is decided by what he grew into — so capping only the grade would have
been a lie three separate systems could see through, and the first coach to
watch a supposed S outgrow every S in the country would have been right to call
it a bug. The cap is a named export precisely so the store player that will one
day hold the grade has to bypass it on purpose.

S formerly began at 85 and arrived about nine times per class, which made the
best grade in the game something you waited for rather than something you found.
A+ took over the band it vacated, so the population of visibly special players
is unchanged — only the name of its top sliver moved, and only that sliver got
rare.

`GRADE_LADDER` is `['D','C','B','A','A+','S','S+']`, and `TOP_GENERATED_GRADE`
is derived from the cap rather than written down, so it cannot drift away from
the number it describes. `'?'` exists in the `PotentialGrade` union as the
absence of a grade — a rival's ceiling renders as an em dash
(`ui/screens/Player.tsx`).

The band is slid back onto the ladder at either end rather than trimmed, so it
always holds exactly `steps + 1` letters — and it slides against
`TOP_GENERATED_GRADE`, not the end of the array. A band that reached for S+
would be a report promising a ceiling nobody in the country is allowed to have,
and an unfalsifiable one at that, since no recruit could ever turn out to have
deserved it. Verified across 28,800 bands at five scouting levels: none names
S+. With a two-letter band the possible spans are D–C, C–B, B–A, A–A+, A+–S.

### 1.7 The two lines — the hint tables

Two vague signals, drawn on two different facts. One line about how high people
think he can go, one about how much of him is still to come. Neither settles
anything alone; together they are evidence.

**The rules the tables obey.** A hint is never false. Every line carries the span
of true grades it stays honest for, and `to` is not "the highest grade this
describes well" — it is the highest grade at which the line is still **true**, the
point past which it stops being an understatement and starts being a lie. The
spans overlap heavily and that overlap is load-bearing: if each line belonged to
exactly one grade, a player who had seen it twice would know the grade, and the
band would be decoration. So the pool widens as the ceiling rises but keeps the
modest lines at the bottom of it — which is how an S can honestly draw an
understated line, and how a gem hides in plain sight.

The lines do **not** depend on the coach's recruiting skill. Skill buys a
narrower band, not different gossip. They are hashed from the recruit's id, so
they are the same on every render, after a reload, and in week three as in week
one.

#### `CEILING_LINES` — all 37, verbatim

Ordered from the most guarded to the loudest, which is roughly the order of their
floors.

| Line | Honest from | Honest to |
|---|---|---|
| He is close to the player he is going to be. | D | C |
| Polished for his age. Whether there is any more is the question. | D | B |
| Nobody came back from seeing him with a story to tell. | D | B |
| Our area man likes him more than the rankings do. | D | B |
| There is no one loud thing about him. He just plays. | D | B |
| He is going to have to earn every inch of it. | D | S+ |
| He would have to develop, but the frame is there. | D | S+ |
| He plays hard, and that travels. | D | S+ |
| Two years of good coaching and we would know a lot more. | D | S+ |
| The body is going to change. What happens after that, nobody can say. | D | S+ |
| Nobody has watched him enough to be confident either way. | D | S+ |
| Coaches in the area think he can play at this level. | C | A |
| Late to the sport. Nobody is sure where his line goes. | C | S+ |
| The raw material is better than the results so far. | C | S+ |
| There is more here than the numbers say. | C | S+ |
| He has a tool you could build something around. | C | S+ |
| Every list has him somewhere. No two of them agree where. | C | S+ |
| He would not be the first out of that county to surprise people. | C | S+ |
| Our man wrote 'interesting' and underlined it twice. | C | S+ |
| He is a better athlete than he is a baseball player, for now. | C | S+ |
| Scouts keep finding reasons to go back and see him again. | B | S+ |
| He has been the best player on every field he has been on. | B | S+ |
| Two programs offered him after one look. | B | S+ |
| The staff argued about him for an hour and got nowhere. | B | S+ |
| He does not look like a high school player out there. | B | S+ |
| If it ever comes together we will be glad we were early. | B | S+ |
| The upside is the reason he is on this list at all. | B | S+ |
| Our cross-checker moved a trip to go and see him. | B | S+ |
| People who saw him in the summer have not stopped talking about it. | B | S+ |
| There are people who believe he is the best in the state. | A | S+ |
| There is talk he will be drafted out of high school. | A | S+ |
| Every program in the country has been through his gym. | A | S+ |
| The area men have run out of comparisons. | A | S+ |
| Nobody on this staff wants to be the one who passed. | A | S+ |
| People stop what they are doing to watch him. | A | S+ |
| He has a chance to be something, and the room knows it. | A | S+ |
| Three head coaches have already been to his house. | A | S+ |

**Pool size by true grade** (from `ceilingLinesFor`, verified by running it):

| True grade | Lines available |
|---|---|
| D | 11 |
| C | 20 |
| B | 28 |
| A | 32 |
| A+ | 31 |
| S | 31 |
| S+ | 31 |

Note that A+, S and S+ have one fewer than A: the single C–A line
("Coaches in the area think he can play at this level.") drops out above A. The
three top rows are identical because no line has a floor above A — the pool
stops widening there, which is what keeps a loud line readable as enthusiasm
rather than as a grade spelled out in words.

Six lines in the table stop below S+ and therefore rule grades out. Five of them
run from D — "He is close to the player he is going to be." caps at C, and the
four after it cap at B — so each is a genuine upper bound and nothing more. The
C–A line is the only one bounded at **both** ends: drawing it means the recruit is
C, B or A, and he is neither a D nor an S. Every other line in the table runs to
S+ and rules out nothing above its floor, which is what keeps the loud lines
readable as enthusiasm rather than as a grade spelled out in words.

#### `DEVELOPMENT_LINES` — all 16, verbatim

Drawn on the distance between what he can do now and what he will ever do, which
is very nearly independent of how high that ceiling is. Every grade from D to A
contains both finished players and projects, and that independence is what makes
the pair worth having.

| Line | From | To |
|---|---|---|
| There is not much left to teach him. | finished | close |
| He is as far along as anybody in this class. | finished | close |
| Physically he is already where he needs to be. | finished | close |
| What he does, he does properly. | finished | close |
| He is closer to ready than most of the names around him. | finished | close |
| He has things to clean up, the way they all do at that age. | finished | raw |
| The mechanics are ordinary. Nothing about them is broken. | finished | raw |
| There is honest work left in him, and a year to do it. | close | raw |
| A winter in a weight room would tell you a lot. | close | project |
| The best of him only shows up in flashes. | close | project |
| The distance between his good days and his bad ones is the story. | close | project |
| He is some way from the finished article. | raw | project |
| Everything about him is still in front of him. | raw | project |
| Right now he is an athlete playing baseball. | raw | project |
| Whoever takes him is taking a project. | raw | project |
| He would need time before he helped anybody. | raw | project |

Pool sizes: finished 7, close 11, raw 11, project 8.

#### `rawnessOf` — the four bands

```
left = player.potential - overallOf(player)
```

| Band | Condition |
|---|---|
| `finished` | left ≤ 3 |
| `close` | left ≤ 8 |
| `raw` | left ≤ 15 |
| `project` | left > 15 |

Cut at the quartiles of what a class actually produces rather than at round
numbers. Measured over one generated class: the **median recruit has 5 points of
growth left**, which is why a cut at "twenty points is raw" would put the whole
country in one band and say nothing about anybody.

#### How a line is chosen

`pickLine` indexes the pool at `min(pool.length - 1, floor(scoutNoise(id, salt) × pool.length))`.
Uniform over the pool, stable for the life of the recruit.

### 1.8 What a report is made of, end to end

For a hitter the report tab shows the overall band, the ceiling band, the two
lines, and six tool bands. For a pitcher, four. The UI renames several ratings:

| Printed label | Underlying rating |
|---|---|
| CONTACT | `contact` |
| POWER | `power` |
| DISCIPLINE | `eye` |
| SPEED | `speed` |
| REACTION | `range` |
| ARM STRENGTH | `arm` |
| K/9 | `stuff` |
| H/9 | `movement` |
| BB/9 | `control` |
| STAMINA | `stamina` |

The **LAST SPRING** tab shows a high school stat line derived from the recruit's
real ratings against high school pitching (`highSchoolLine`, `engine/scouting.ts`).
The numbers are honest about the player and absurd by college standards on
purpose — a .500 hitter in high school is a normal recruit. Every figure is
hashed from the player id with its own salt, so it never moves.

### 1.9 Signing day: what is finally revealed

The true ceiling grade is printed (`potentialGrade` on the real potential). The
`verdict` helper adds a label only at the extremes of *your own* report:

- true grade equals the top of your band → **HIGH END** / "TOP OF YOUR REPORT"
- true grade equals the bottom → **LOW END** / "BOTTOM OF YOUR REPORT"
- anywhere in between → nothing at all

Silent in the middle on purpose: a verdict on every signing turns into wallpaper,
and then the two that mattered do not stand out. A one-letter band (impossible
today, since `reportGradeSteps` floors at 1) would also return nothing.

---

## 2. Recruiting: the market — **SHIPPED**

### 2.1 Stars and national rank

Both are cut from one number, and that number carries error.

```
serviceScore(p) = overallOf(p) × 0.74 + (p.potential + miss) × 0.26
```

where `miss` is a stable per-player value uniform on roughly **[−13, +13]**,
hashed from the id. The services see current ability clearly and project badly.
A raw kid whose ceiling nobody spotted comes out a two star, and finding him is
the reward the whole screen is built around.

| Stars | `serviceScore` |
|---|---|
| ★★★★★ | ≥ 68 |
| ★★★★ | ≥ 60 |
| ★★★ | ≥ 52 |
| ★★ | ≥ 44 |
| ★ | below 44 |

The **national rank** is assigned once, at class generation, by sorting on the
same `serviceScore` — error and all. Rank used to be computed off `overallOf` and
the *true* ceiling with no error, which made `#rank` a perfectly ordered index of
the truth sitting above a deliberately vague estimate. Sorting by it beat
scouting, so scouting was decoration. Now a sharp player can still read something
out of it: a recruit ranked well above where his reported ability would put him is
being carried by a ceiling somebody believes in.

### 2.2 The class

`generateClass(year, teams, rng)` builds `round(teams × 7.5)` prospects — **720**
for the shipped 96-program world. Positions cycle through `CLASS_SHAPE`
(C, 1B, 2B, 3B, SS, LF, CF, RF, SP, SP, SP, RP, RP). Every prospect is a freshman.

Quality is bottom-heavy:

| Roll | Quality drawn |
|---|---|
| > 0.97 | 66 + rng×10 |
| > 0.88 | 58 + rng×8 |
| > 0.65 | 50 + rng×8 |
| > 0.30 | 42 + rng×8 |
| otherwise | 34 + rng×8 |

Home region is drawn from a weighted list (`HOME_REGIONS`): Gulf ×3, Atlantic ×3,
Pacific ×2, and one each of Desert, Heartland, Great Lakes, Mountain, Northeast.
The state is then drawn uniformly within the region from `STATES_BY_REGION`.

Measured over forty classes, each generated after `resetNames()`: **221 one-stars,
210 two, 165 three, 83 four, 40 five** on average, with a class-to-class standard
deviation of about 13, 12, 10, 8 and 5 respectively.

**A single class is not a measurement of this.** Two things have to be said
before any figure taken from `generateClass` means anything, and neither was said
the first time round:

- **The spread is wide.** The five-star count of one class swings between about
  30 and 50. `generateClass(2027, 96, makeRng(4242))` currently returns 224 / 209
  / 164 / 78 / 45; that is one draw from the distribution above, not the
  distribution.
- **The name pool is an input.** `uniqueName` rejects a name already taken and
  draws again, which costs two extra random numbers and moves everything
  downstream. The identical call made four times in one process returns four
  different classes — measured at 143, 126, 134 and 123 four-and-five-stars. Any
  figure quoted from a class has to name the pool state it was taken with, and in
  practice that means `resetNames()` first.

This section previously recorded 223 / 213 / 182 / 64 / 38 from that call and a
later reading of 224 / 209 / 164 / 78 / 45, and the difference was carried as
evidence that something upstream had moved. It was not. Measured the same way
over the same forty seeds, the class at v0.6.8 — the release the reach ladder was
fitted against — reads 221 / 209 / 165 / 85 / 40, which differs from the figures
above by less than one standard error of the mean on every grade. See
**Appendix B item 10**, now answered.

### 2.3 Priorities

Five things a recruit can weigh, summing to 1.

| Key | Label | Blurb |
|---|---|---|
| `prestige` | THE NAME | wants to sign somewhere that means something |
| `playingTime` | PLAYING TIME | wants to be in the lineup as a freshman |
| `winning` | WINNING NOW | wants to play in June, right away |
| `proximity` | CLOSE TO HOME | wants to stay near home |
| `development` | DEVELOPMENT | wants a coach who will make him a draft pick |

`drawPriorities(stars, rng)` tilts by quality — `tilt = (stars − 3) / 2` — then
scrambles:

```
base.prestige    = 1.00 + tilt × 0.85
base.winning     = 0.90 + tilt × 0.55
base.playingTime = 1.10 − tilt × 0.75
base.proximity   = 1.00 − tilt × 0.45
base.development = 0.85 − tilt × 0.15

raw[k] = max(0.04, base[k] × (0.45 + rng()^1.7 × 2.1)), then normalised to sum 1
```

The exponent makes the draw lumpy rather than uniform, so most recruits have one
or two things they clearly care about. The outliers are the point: a five star who
wants the ball in his hands as a freshman is the one a small program can actually
take, and a system without him is a system where the board is just the prestige
table sorted twice.

### 2.4 Reach and prestige caps

The hard gate. A recruit hears out a program one grade above his own and no
lower — with one exception, below. This is a refusal, not a discount: a soft
gate where a one-star program may chase a five star and gain almost nothing
reads to the player as a bug, because the actions are spent, the button works,
and nothing comes of it.

Program tier comes from `prestigeStars` (`engine/program.ts`):

| Stars | Program prestige |
|---|---|
| ★★★★★ | ≥ 72 |
| ★★★★ | ≥ 60 |
| ★★★ | ≥ 48 |
| ★★ | ≥ 38 |
| ★ | below 38 |

**The rule, in the player's own words.** *"A 3 star school can only shoot for 4
stars and under, a 2 star can shoot for a 3 star and under and so on, 4 and 5
star schools can go for anyone they like. One thing I would add is if a school
for example is 3 star but there are 5 stars in their pipeline they can shoot for
them as well, but only if they are in the pipeline, and it only goes up one star
— a 2 star school can shoot for a pipeline 4 star, a 1 star school can shoot for
a 3 star pipeline player."*

`reachFloor(stars)` is `max(1, min(4, stars − 1))`: the floor under a recruit is
one tier below his own grade. Nothing is rated above five, so a four-star
program clears every floor there is and the top two tiers see the whole board
without a special case.

| Recruit | Floor | May be called by | …and in his own state |
|---|---|---|---|
| ★★★★★ | 4 | ★★★★, ★★★★★ | ★★★ and up |
| ★★★★ | 3 | ★★★ and up | ★★ and up |
| ★★★ | 2 | ★★ and up | ★ and up |
| ★★ | 1 | anybody | anybody |
| ★ | 1 | anybody | anybody |

**The pipeline is the program's own state**, which is the concept `fit` already
scores proximity on — not its region. A region is four states and an eighth of
the country, which would make the exception the rule; a state holds about **20.6
recruits**, and **63% of states hold at least one five star** in a given year,
mean 1.15. That is exactly the "there are 5 stars in their pipeline" the rule
describes: a narrow, nameable door, open about two years in three.

`canPursue(prospect, programStars, inPipeline)` is
`programStars + (inPipeline ? 1 : 0) >= reachFloor(prospect.stars)`. It reads
the recruit's **star rating**, not the `minProgram` field stored on him, so a
dynasty saved under the older per-recruit ladder is judged by the same rule as a
new one. `minProgram` is still written (it equals `reachFloor(stars)`) because
the prospect sheet prints it.

#### What it replaced, and why there is only one gate

Until this change the floor was drawn **per recruit** from his own priorities: a
kid who wanted playing time or home would hear out a program one or two tiers
below him, and a kid who wanted the biggest name in the country would not come
down at all. That ladder was measured against the priority draw — four hundred
thousand sets of weights per grade — and tuned to it.

It has been **replaced rather than layered under** the new rule. The two
disagreed in both directions: the ladder let a flexible five star hear out a
three-star program that the new rule refuses, and let a rigid four star refuse a
three-star program that the new rule admits. Two gates that disagree is a worse
thing than either alone, and asked which should decide, the answer has to be the
one a coach can read off the screen. A ladder you can see is a ladder you can
climb deliberately; a hidden per-recruit roll is one you can only find out about
by tapping.

What is lost with it is the identifiable outlier — the one four star in the class
who would have come down two tiers for playing time. The pipeline replaces him,
and is a better version of the same idea: still a specific, nameable set of
players a small program can reach above its weight, but one the coach knows
about before he spends a week on it.

**Reach is no longer all the pipeline buys.** A door that only lets you make the
call is worse than no door at all if you then lose every one of those recruits,
which is what measurement found. A home-state recruit is now worth a courtship
edge as well, sized so it belongs to the small programs: see §2.5a.

#### The invariant, measured

The old ladder existed to answer *"I as a three star college have access to the
very top players."* The new rule has to hold the same line, and it holds it
harder. Measured over 24 generated classes of 720 (96 programs), `makeRng(4242 +
i × 7919)`, names reset before each:

| | ★ | ★★ | ★★★ | ★★★★ | ★★★★★ |
|---|---|---|---|---|---|
| of the top 10 | 0 | 0 | **0** | 10 | 10 |
| of the top 25 | 0 | 0 | **0** | 25 | 25 |
| of the top 50 | 0 | 0 | **9.8** (sd 5.2) | 50 | 50 |
| whole board | 59.3% | 82.4% | 94.4% | 100% | 100% |

The top fifty is **80.3% five stars and 19.7% four stars**, so the 9.8 a
three-star program can call are the four stars in it and nothing else — not one
five star, in any of the twenty-four classes. Under the ladder this replaced the
same measurement read about twelve, and a handful of the top ten came through in
a good year.

With a pipeline in the best-case state for that class, a three-star program's
top-fifty count rises from 9.8 to **14.2**, and a two-star program's from 0 to
**1.0**. That is the door, and it is the size it was asked to be.

The whole-board row is the other side of the gate: a board that is mostly locked
rows is a screen that says no eight times and offers nothing, so even a one-star
program can call **three fifths of the country**.

When the gate refuses, the board prints: *"He will not take the call. A ★★★★★
recruit hears out a ★★★★ program and up — one more rung down if he is from your
own state, and he is not. Build the program up and players like him start
listening."* When it lets a pipeline man through it says so too, on the prospect
sheet.

#### The AI works the same gate

`aiTargets` asks `canPursue(p, tier, inPipeline(p, pitch.state))`, so the ninety
five programs get the pipeline as well — a door only the human could walk
through would not be a rule, it would be a cheat. A program below four stars
also carries a **one-slot band two grades above itself**, which after the gate
can only ever contain a home-state recruit; without it the exception would exist
for the player alone and a blue chip in a small program's back yard would sit
unchased.

### 2.5 The pitch, and fit

A program is reduced to five things, each on 0–1, all read off real season state
(`engine/pitch.ts`):

| Field | Source |
|---|---|
| `prestige` | `record.prestige / 100` |
| `winning` | `(lastWinPct − 0.35) / 0.4`, clamped — a .500 season is neutral |
| `playingTime` | per recruit: `0.5 + (his overall − the best man blocking him) / 40`, where the blocker is discounted by how soon he leaves (SR ×0.15, JR ×0.6, else ×1) |
| `development` | `(mean of overall/potential across non-freshmen − 0.62) / 0.3`, clamped |
| `state` / `region` | the school's own |

```
proximity = same state ? 1 : same region ? 0.55 : 0.15
fit       = Σ (his weight for k) × (your score for k)
            × (same state ? 1 + 0.25 × ((5 − yourStars) / 4)²  : 1)     // capped at 1
```

Three steps rather than two, because collapsing state and region made a Louisiana
kid treat a school in his own town exactly like one four states away.

#### 2.5a The pipeline edge

Reported: *"during recruitment, we have to give a bit of a boost to players in the
pipeline, I was just running through some seasons and it was rough to get a good
player."* The pipeline bought **reach** and nothing else — the right to call a
recruit a tier above you, with no help in keeping him — so a small program could
see the best player in its own back yard and still lose him to everybody else,
which is arguably worse than never having seen him.

The edge sits **outside the weighted sum** rather than inside `proximity`,
because it is not the thing the recruit was asked about. The five weights price
how much he wants to be near home; this prices the rest of it — the staff that
has watched him since he was fourteen, the family in the stands, the summer team
the pitching coach runs. A kid who does not care about distance still knows these
people.

| Program | Edge on a home-state recruit |
|---|---|
| ★ | ×1.250 |
| ★★ | ×1.141 |
| ★★★ | ×1.063 |
| ★★★★ | ×1.016 |
| ★★★★★ | ×1 — nothing |

**Squared rather than straight, and that is the part measurement decided.** A
linear ramp lifts every tier below the top at once, so the small program's
*relative* position — the only thing that decides a contested recruit — barely
moves. Measured over 12 seeded windows of 96 programs, a linear ×1.34-at-one-star
ramp took a four star recruit off a blue blood **63%** of the time in his own
state, while a four star *program* went from keeping 9.1% of its own local board
to 12.5%: general inflation rather than an edge for anybody.

Measured, before → after, same twelve windows. "Kept" is the share of the
home-state recruits the reach gate lets that tier call who signed there — a
cohort fixed by the rules, not by which of them the program chose to work, since
the boost moves that choice as well:

| Program | kept at home | when somebody else was on him too | mean stars signed | best signee |
|---|---|---|---|---|
| ★ | 22.6% → **29.5%** | 25.2% → **32.4%** | 1.74 → 1.75 | 2.65 → 2.72 |
| ★★ | 20.1% → **25.6%** | 21.1% → **29.6%** | 2.08 → 2.14 | 3.45 → 3.54 |
| ★★★ | 15.6% → 18.0% | 20.6% → 24.9% | 2.92 → 2.94 | 4.31 → 4.40 |
| ★★★★ | 9.1% → 9.6% | 12.1% → 11.8% | 4.01 → 4.04 | 4.92 → 4.91 |
| ★★★★★ | 6.7% → 6.8% | 8.8% → 8.3% | 4.32 → 4.29 | 5.00 → 5.00 |

And the head to head the size was chosen against — a recruit in a small school's
own state, worked by that school (★★ or below) and by a big one (★★★★ or above)
at the same time. The local school kept **25.3% → 39.9%** of them, and of the
four star recruits in that set — the pipeline reach case, a two star program
calling a man two grades up — **21.7% → 44.2%**. The bigger program still usually
wins, which is the line: an edge, not a guarantee.

The whole league signs about 1.4% fewer recruits than it did (657 → 648 of ~720),
which is the cost of boards concentrating harder on their own states.

### 2.6 Points

```
weeklyPoints(prospect, pitch, actions, coachPrestige, recruitingSkill = 20):
  if actions <= 0: 0
  f       = fit(prospect, pitch)
  coach   = 1 + clamp((coachPrestige - 45) / 110, -0.20, +0.45)
  skill   = 1 + (recruitingSkill - 20) / 400        // ×1.1975 at 99
  passive = f × 2.2
  pitched = actions × f × coach × skill × 2.6
  return passive + pitched
```

Fit **multiplies** the spent actions rather than being added to them, so effort at
a program the recruit has no interest in is close to wasted — which is what makes
a board of reaches a real mistake instead of a lottery ticket. The recruiting
skill's effort bonus lands on the pitched half only: it rewards working the board
rather than replacing it.

### 2.7 Budget, board and window

| Constant | Value | Notes |
|---|---|---|
| `RECRUITING_WEEKS` | 3 | The whole window |
| `SCHOLARSHIPS` | 8 | Cap on **signings**, not on who you may talk to |
| `RECRUITING_BUDGET` | 40 | Base weekly actions |
| `budgetFor(stars)` | `40 + max(0, round((stars − 1) × 5))` | 40 / 45 / 50 / 55 / 60 |
| `MAX_PER_RECRUIT` | 12 | The most that can go on one recruit in one week |

Prestige buys attention: facilities to show, a name that returns calls, a staff
big enough to be in three states at once. Forty is what a nobody gets; a blue
blood works with half again as much.

### 2.7a The board screen: five tabs, one filter, one pinned button

`ui/screens/Board.tsx`. Four views of the same class plus the roster it is meant
to fix, because those are five different questions and answering them on one
list means answering none of them well.

**The pinned button.** One `FloatingAction`, and `pinnedAction` is the only
place its label is decided. Filtering is a *mode* rather than a drawer — the
panel replaces the body, because the header is pinned and a drawer opened from
the bottom of a fourteen-hundred-pixel list is a control that appears to do
nothing — and while the mode is on, the button closes it and says how many
recruits are on the other side. Ending the week is the one irreversible act on
this screen and does not belong under the thumb while somebody is tuning a
filter.

> **The bug this fixed.** Reported: the advance-week button stuck reading `SHOW
> THE TOP 50 OF 518` where `END WEEK` belonged. The five view tabs live in the
> *pinned header* and stayed live in filter mode, so tapping ROSTER changed the
> tab underneath a panel that was still covering the body and still owned the
> button. The tabs leave the mode now, and the two ternary branches that each
> wrote their own label are one function with a test.

**The filter.** Rebuilt from a panel of controls that fought each other:

| Control | Notes |
|---|---|
| Position | Ten chips, one at a time |
| Stars | Five buttons, **more than one at a time** — a union inside the star filter, an intersection with everything else |
| Home state | A dropdown, thirty-five states, the program's own marked `· yours` |
| In my pipeline | Your own state. The switch says what it is worth: a star of reach on top of your tier |
| Nobody is on him | Recruits no program has banked a point on. A zero is not a suitor |
| Within my reach only | Hides the men who will not take the call, and the OUT OF REACH block with them |

Two sliders were removed rather than retuned. Overall and ceiling are shown as
**intervals** now, and a slider against a band cannot mean anything precise:
"at least sixty" against a report that says forty to seventy is a question with
no honest answer, and the old code answered it on the top of the band — which
quietly meant a rookie recruiter's filter excluded nobody at all. The star
rating is the one measure of quality on this screen that is a single value
rather than a window, so it is the one that can carry a filter.

`matchesFilters(prospect, filters, homeState, programStars)` is exported and
pure, and every clause of it is held to its own label by a test.

**The row cap.** `ROW_CAP = 50`, sorted by `stars × fit`. Fifty is the answer to
the question the tab is for and five hundred names is not a list anybody reads,
but the cap lifts: `SHOW ALL 600` sits under the last row, and `BACK TO THE TOP
50` under it once lifted. The number on the apply button is always what the
filter *matched*, never what was drawn — the capped count reads 50 whatever you
do, which is exactly the range where you need to be told whether the last tap
did anything.

**Colours.** Every recruit row carries a school: a three-pixel stripe in
`teamColour(abbr)` and the abbreviation beside the standing. That is the school
that signed him if the board has closed on him, and otherwise the one currently
leading. A recruit you chased and lost stays on your TARGETS tab in the colours
of the program that beat you, which is the whole point — losing somebody into a
void is a number going down. A recruit nobody has called carries no colour,
which pairs with the filter for exactly those men. The **jersey** on the avatar
is only ever a school he has actually signed for; a face wearing the colours of
a program still recruiting him would be the row telling a story the board has
not finished.

**NEEDS.** See §2.10 — the tab now reads `walkOnShortfall` off the roster in
front of it, which is the same call the class review makes.

### 2.8 Commitments

```
COMMIT_POINTS      = 7
commitPointsFor(s) = 7 × (1 + max(0, s − 2) × 0.55)
COMMIT_MARGIN      = 0.35
```

| Stars | Points needed to commit | Final-week floor (×0.6) |
|---|---|---|
| ★ | 7.00 | 4.20 |
| ★★ | 7.00 | 4.20 |
| ★★★ | 10.85 | 6.51 |
| ★★★★ | 14.70 | 8.82 |
| ★★★★★ | 18.55 | 11.13 |

**Early weeks.** A recruit commits when the leader's margin — `(leader − second) /
leader` — exceeds 0.35 **and** the leader has banked more than
`commitPointsFor(stars)`, and then only on a 45% roll. So waiting costs something,
and it costs it unpredictably.

**Final week.** Everyone still undecided signs with whoever leads, *except* that a
recruit whose leader has less than 60% of his commit price simply goes elsewhere —
he does not fall into the lap of whoever put a token point on him.

**Scholarships gate the market.** Only suitors with a scholarship left are "in the
running", which is what stops one blue blood hoovering up the top thirty players
in the country.

### 2.9 What the other 95 programs do

`aiTargets` builds a board in tiers relative to the program's own standing, so the
league does not function as one enormous queue.

| Program tier | Board plan (share of slots) |
|---|---|
| ★★★★★ | 5★ 0.50, 4★ 0.38, 3★ 0.12 |
| ★★★★ | 5★ 0.35, 4★ 0.48, 3★ 0.17 |
| ★★★ and below | tier+2 0.08, tier+1 0.28, tier 0.38, tier−1 0.20, tier−2 0.10 |

The top of the ladder gets its own plans because a five-star program has no tier
above it, and four stars need it most: two thirds of them will not hear from a
three-star program at all, so the elite programs are the entire market for them.

Within a band, targets are scored `fit × uncontested × (0.85 + rng × 0.3)`, where
`uncontested = 1 + 0.18 × stars` if nobody has banked a point on him and 1
otherwise. A recruit somebody else was more than 40% clear on at the start of the
week is dropped. Weekly actions are then allocated by
`max(0.05, fit) × (already-ahead ? 1.35 : 1)`, capped at `MAX_PER_RECRUIT` per
recruit and the program's own week in total — `weeklyBudget(stars, spentInJune)`,
which is 40 at a one-star program and 60 at a five-star, less whatever the draft
phase took, spread evenly across the three weeks. That is the same call the user's
board header prints; it used to be a flat `ACTIONS_PER_WEEK` (40) for all
ninety-five, which was survivable only while there was nowhere else to spend. See
§14.7.

**Every pitch carries the reputation and the recruiting skill of the man making
it**, and that used to be true of exactly one program in ninety six. A flat
prestige of 45 and a flat recruiting of 20 stood in for the other ninety five,
which meant the coach points the player spent on RECRUITING bought him an edge
nobody in the country could ever answer. Since B7 each chair has a named man and
`weeklyPoints` reads his two numbers (§16.7). The old flat pair survives as the
fallback for a chair with nobody in it — an unseated world, most of the test
suite, or a save written before B7 — because a program with no coach should
negotiate like nobody in particular rather than throw.

`seedRivalInterest` (`state/store.ts`) runs two passes over the whole league as the
window opens — the second at half weight, because coverage comes from target
selection rather than point size — so the player arrives at a board that is already
contested. The user's program is skipped; his head start is the one he chooses.

### 2.10 What an unspent scholarship becomes — **B8**

A class that comes up short does not leave the spot empty. `refill`
(`engine/progression.ts`) rebuilds every roster in the country to a fixed
twenty-three, and it fills each hole in the same three steps: somebody you
signed who actually plays there, else the best bat or arm you signed, else a
walk-on drawn at `team.quality − WALK_ON_PENALTY` (**13**) with a small residual.
That ordering is the whole point of the recruiting system — a program that
recruits well fills its holes with players it chose, and one that does not fills
them with whoever turned up. The penalty used to be 5 and applied to everybody,
which meant recruiting could not matter, because every program reloaded at its
own quality whatever it did in November.

**A walk-on is on a one-season lease.** `departAndDevelop` asks whether a man
walked on *before* it asks `departure`, and reads the flag rather than the class
year: the rule is one season, not one class year, so a walk-on who somehow
arrived as an upperclassman cannot be kept for three more years by a technicality.
Asking first also costs no `rng()` draw, so nothing about who else leaves depends
on how many walk-ons a program happens to be carrying. A spot filled this way is a
spot you are shopping for again next winter, which is the honest price of a short
class.

**The coach is told before it matters, not afterwards.** `walkOnShortfall` runs on
the class review, on signing day, when the shortfall is still something he could
feel bad about. It walks `refill`'s placement in the same order, and a test
asserts that it projects exactly the men who turn up in June: that is what makes
the review a fact rather than an estimate.

**And the board's NEEDS tab reads the same function.** It did not, and the two
disagreed — reported: *"NEEDS said every position was covered, and the class
review then brought walk-ons anyway."* Two causes, both on the tab:

1. It read `lastOffseason.holes`, which the save loader deliberately does **not**
   restore (`lastOffseason: null`). Any dynasty picked up mid-offseason therefore
   showed an empty NEEDS tab and the words *"every spot the draft opened up is
   covered"* over a roster four men short.
2. Even with the report in hand it counted a signed player against **his own
   position only**, where the rebuild spends him on the first hole it comes to
   and then fills the bench out of whoever is left. A class of one catcher and
   one starter against holes at C and SP read as fully covered while two bench
   bodies walked on.

The tab is now `walkOnShortfall(roster, class)` for what is still open, and
`coveredSince(walkOnShortfall(roster, []), still)` for what the class has bought
— two readings of one function, so they cannot drift. The count on the tab badge
is the projected walk-on total. A test asserts the two sum to the original
shortfall and that "nothing left" means the same thing on both screens.

**And it names them.** Reported from testing: *"they arrive as names on a list
with none of the information every other player has."* The review used to print
positions and counts — "C · one body" — because the men were not manufactured
until the year rolled and there was nothing honest to say about them.
`walkOnClass` fixes the cause rather than the symptom: a program's walk-ons come
off a **private rng seeded from the class year and the program index**
(`walkOnSeed`), so they are a pure function of who survived, who signed, the
program's quality and those two numbers — knowable on signing day, and knowable
identically at the year roll. `fillRosters` hands `refill` that same list rather
than drawing bodies of its own, so the catcher whose card you read on signing day
is the catcher on the roster in June, down to his face. He gets everything a
signed recruit gets: a portrait, the real overall, the real ceiling, last
spring's line, a card. What he does not get is a "your report had him" block or a
list of who else was in on him, because nobody scouted him and nobody was — and
that absence is what makes him read as a walk-on rather than as a class.

Two consequences worth writing down:

- **The name pool.** A name costs a variable number of draws because
  `uniqueName` rejects one already taken, so a man drawn twice against different
  pools is two different men. `walkOnClass` hands its names straight back
  (`releaseNames`) and `fillRosters` claims them per program as it goes — with
  **the reported program processed first**, so its men are drawn against exactly
  the pool the class review drew them against, reload or no reload.
- **The world's rng.** `fillRosters` no longer spends the season generator on
  bodies at all, which is a small correctness win — a program's walk-ons used to
  depend on how many programs had been through the loop before it — and it means
  every season after an offseason draws differently from before the change. No
  rate moved; one statistical bound in `rivals.test.ts` was one chair wide and
  has been widened, with the reason recorded there.

The draft screen used to carry a walk-on list of its own. It drew nothing for
anybody, every year — the real list is only known once `fillRosters` has run, by
which time every offseason screen has been left behind — and it was deleted
rather than wired up, with a comment in `Draft.tsx` recording why. That was A6.

---

## 3. Coach creation — **SHIPPED**

`ui/screens/NewGame.tsx`, `engine/program.ts`, `engine/strategy.ts`

Three steps: who you are, how your teams play, where you work.

### 3.1 Who you are

| Field | Rules | Reaches the simulation? |
|---|---|---|
| Name | Trimmed; empty falls back to `"Coach"` | No |
| Age | `MIN_COACH_AGE` 28 to `MAX_COACH_AGE` 68, stepper only | No — it increments each year and no screen reads it for anything else |
| Home state | Two-letter code from `ALL_STATES`, the same list programs and recruits use | No |
| Portrait | Four indices: `skin` 6, `hair` 6, `cut` 5, `beard` 4 | No |

The fields arrive pre-filled with a plausible man (`randomProfile`), drawn from the
same name pools the players come out of, aged 38–52, so anybody who does not care
presses continue once and still ends up with a career belonging to a named person.
The portrait is suggested at random and the **philosophy deliberately is not** — a
prefill that quietly picked how the team plays would be the one prefilled answer
that costs games.

Portraits store **indices**, not colours, so a save follows the drawing when it is
redrawn. `normalizeLook` brings any saved value back inside range with a modulo.

### 3.2 How your teams play — the philosophies

A philosophy owns no numbers of its own. It is a named point in the policy space
the engine already reads, which means picking one at creation is exactly
equivalent to opening the strategy screen and setting five controls by hand — and
you can change any of them afterwards, because there is nothing underneath to
disagree with. It travels with the coach between jobs (`applyPhilosophy`).

| Id | Name | Blurb | running | steals | bunt | hook | alignment |
|---|---|---|---|---|---|---|---|
| `smallball` | SMALL BALL | His teams run, bunt and take the extra base — and get thrown out doing it. | aggressive | constant | often | standard | straight |
| `power` | POWER | Nobody runs into an out. He waits for the three-run inning and wears the quiet nights. | patient | never | never | patient | straight |
| `pitching` | PITCHING AND DEFENSE | Fresh arms and a shifted infield. A one-run lead he expects to hold, on a tired bullpen. | patient | selective | rare | quick | shift |
| `balanced` | BALANCED | No strong lean. Takes what the game offers and decides the rest one night at a time. | balanced | selective | rare | standard | straight |

`DEFAULT_PHILOSOPHY` is `balanced`, and BALANCED is listed **last** on purpose: a
default presented at the top of four options is the one everybody takes without
reading the other three.

### 3.3 Where you work

Step three offers the jobs a rookie can take. Every career starts at
`ROOKIE_PRESTIGE = 25`, `security` 62, skills `{ offense: 20, defense: 20,
training: 20, recruiting: 20 }` and zero skill points. See §6.6 for the hiring
ladder that decides which programs are open.

---

## 4. Coach skills and points — **SHIPPED**

`engine/program.ts`, `ui/screens/CoachPoints.tsx`

Four numbers, 0–100, each wired to something the engine already does. These were
dead configuration until recently — a skill tree whose branches do not change the
simulation is a menu, not a decision — so the wiring is now real and the
magnitudes are deliberately small.

### 4.1 Earning and spending

```
skillPoints(outcome):
  3 base
  +1  made the national tournament
  +1  won the conference
  +2  reached Omaha
  +2  won the national title
```

Three to nine a season. Scaled to the year rather than flat, so a coach who wins
improves faster — the compounding a dynasty is made of — without a bad year
leaving him with nothing to spend and no reason to open the screen.

One point buys **+1 rating**, capped at 99 (`spendSkill`, `state/store.ts`). The
offseason step is `coach`, which runs **before** `draft` and `recruiting`, so a
point spent on recruiting narrows the bands you are about to read and a point spent
on training is applied to the development that happens on the way into the draft
screen.

Unspent points carry over in the data; the screen warns they "do not carry over
well", meaning a coach who does not improve falls behind, not that they are
deleted.

**A point can be taken back until the step closes.** Reported: three went into
one skill by mistake and there was no way out. `spendSkill` records what this
visit put on, per skill, in `spentThisStep`; `refundSkill` takes one off again
and only ever from that ledger, which is what keeps it an undo rather than a
respec — nothing earned in an earlier year can be moved. The ledger is cleared
whenever the offseason leaves the step, by `nextPhase` or by the rail, and it is
not saved, so a reload commits what is on the board. Leaving the screen is
exactly what makes a decision a decision. The `−1` sits on the skill's own card,
beside the spend, because that is where the mistake is made.

### 4.2 What each one actually does

| Skill | Label | On-screen blurb | Real effect | Magnitude at 99 |
|---|---|---|---|---|
| `offense` | OFFENSE | Your hitters take slightly better at-bats, every game. | `coachOffMult = 1 + (offense − 20) × 0.0001`, multiplied into every offensive event in the log5 vector before renormalisation (and into Engine B's zone bias) | **×1.0079** |
| `defense` | DEFENSE | Balls in play against you become outs a little more often. | `coachDefMult = 1 − (defense − 20) × 0.0001`, folded into `defenseMult`, which applies to singles, doubles and triples only — no defence has ever caught a home run or affected a walk | **×0.9921** |
| `training` | TRAINING | Your returning players develop further between seasons. | `growthMult = 1 + (training − 20) / 500`, scaling the systematic `gap × rate` pull toward potential and **not** the noise term | **×1.158** |
| `recruiting` | RECRUITING | Every hour on a recruit counts for more, and your scouting reports run tighter. | Two effects: `reportWidth` 30 → 6 and `reportGradeSteps` 3 → 1 (see §1.2); and `skill = 1 + (recruiting − 20) / 400` on the pitched half of `weeklyPoints` | **band 6 points wide; ×1.1975 on effort** |

All four are **neutral at 20**, the starting value, so a fresh career plays at raw
ratings.

For scale: the in-game edge from OFFENSE at the cap is roughly a third of home
field advantage, which is ×1.020 and itself worth about five points of win
probability. A trained coach is a light thumb on the scale, not a sixth infielder.
`tests/liveGame.test.ts` pins the multipliers at the plumbing level rather than as
a win rate, because proving the direction empirically would need tens of thousands
of games to clear sampling noise.

The two in-game skills reach the field via `TeamRecord.coachMods`. `syncCoachMods`
writes that field for **all ninety-six** programs — the user's off `CoachState`,
everybody else's off the man in the chair (§16.7) — and deletes it from any
program with nobody in it, so a job change or an old save can never leave the
edge behind on a team he no longer runs. It used to clear the field everywhere
and write exactly one row, which was the shape of the bug B7 fixed: the player's
coach points bought an edge no other program in the country could have.

TRAINING reaches development the same way. The user's is passed to
`departAndDevelop` as `OffseasonOpts.training` and applies to his program only;
every other program develops on `record.coach.skills.training`, where it used to
be a flat 20. RECRUITING is passed at the two call sites that spend a week —
`seedRivalInterest` and `advanceRecruitingWeek` — and read directly by the board
and signing-day screens.

---

## 5. Coach standing and titles — **SHIPPED**

`coachStanding` in `engine/program.ts`.

The word beside HEAD COACH is earned, not served. The line used to read "seasons
completed", which is a fact the two counters either side of the portrait already
state; twenty quiet years does not make anybody renowned.

**The cabinet is the whole ladder.** One table, read top down, first match wins.

| Title | Condition |
|---|---|
| Legendary | `titles >= 1` — a national championship |
| Renowned | `regionalTitles >= 2` **or** `conferenceTitles >= 4` |
| Established | `regionalTitles >= 1` **or** `conferenceTitles >= 2` **or** `tournaments >= 3` |
| Respected | `tournaments >= 1` **or** `conferenceTitles >= 1` — a bid |
| Journeyman | has coached a game |
| Unproven | has not |

Every rung is a day: the June you first qualified, the June you did it again, the
June you got out of your region, the June you won the country. Nothing here can
move on a season in which none of those happened, and nothing here can be taken
away — a bad decade costs a man his job long before it costs him his name.

**Prestige is not in it, at any weight.** It used to carry the climb, on the
reasoning that prestige is already the number that moves on overachievement and
decays when nothing happens. That was wrong about what a title is. Reported:
*"the coach title keeps upgrading or changing every season, these titles are
supposed to be based in achievements"* — and measured over thirty seasons of
ninety six programs, **13.1% of the coach-seasons in which a man won nothing at
all changed what he was called**, in both directions. It is not a tiebreaker
either: two coaches with the same cabinet get the same word, because a
tiebreaker that moves every November is the same bug with a smaller step.

**Why the counts are what they are.** A bid and a conference title are the same
event in today's format — the eight conference champions *are* the eight-team
national field — and **half of that field wins a region**, four regionals with
one champion each. So a trip to the last four is not the rarity its name
suggests. With one region worth RENOWNED the band above Established measured
four times the size of it: a ladder that got wider as it went up. Two regions is
the honest price, because at even odds per trip that is a coach who kept getting
there. `tournaments` and `conferenceTitles` are still counted apart because the
expanded postseason (twenty bids, at-larges) separates them, and on that day the
table already says the right thing: three at-large trips is ESTABLISHED, and a
league title is worth more than a trip.

A first year national champion is LEGENDARY that afternoon. That is one program
of ninety six in one year of thirty, and a ladder that made him wait would be
measuring patience rather than achievement.

**Measured across a league**, 30 seasons, seed 4242, all 96 chairs on the AI
(`npm run carousel -- 30 4242`):

| | unproven | journeyman | respected | established | renowned | legendary |
|---|---|---|---|---|---|---|
| year 10 | 0 | 68 | 7 | 10 | 5 | 6 |
| year 20 | 8 | 57 | 10 | 9 | 5 | 7 |
| year 30 | 4 | 71 | 7 | 7 | 2 | 5 |

It thins as it climbs, which is the shape a ladder is supposed to have, and the
same run reports **0.0%** of quiet coach-seasons changing a title. The one
remaining move that is not a trophy is a rookie's first completed season ending
UNPROVEN, which is a statement about having coached rather than about having won.
Three quarters of the league sitting at JOURNEYMAN is honest arithmetic: eight
league titles a year, concentrated in the programs that keep winning them.

**LIFER** is separate and additive: `tenure >= LIFER_SEASONS` (**15**) at the
*current* job. It is the one thing here earned by staying instead of winning, and a
bad run cannot take it away — it reads alongside the title, e.g. `RENOWNED · LIFER`.

`coachStanding` takes a `CoachRecord`, which is the handful of `CoachState`
fields a title may look at. Narrower than the whole coach because the ninety five
men in the other chairs wear these titles too and a `RivalCoach` is not a
`CoachState`.

---

## 6. The board: mandates, objectives, verdicts and your job — **SHIPPED**

`engine/program.ts`, `ui/screens/Board.tsx` (the *program* board, `ui/screens/Program.tsx`)

Three quantities, deliberately tracked apart, because conflating them is what makes
career modes feel arbitrary:

| Quantity | What it is | Speed |
|---|---|---|
| **Program prestige** | What the school is. Survives you. | Slow — drifts 18% of the gap per year |
| **Coach prestige** | What you are. Travels between jobs. | Medium |
| **Job security** | How the board feels right now. The only one that fires you. | Fast |

### 6.1 The mandate

```
standing = prestige × 0.45 + roster × 0.55
proud    = prestige >= 50
talented = roster   >= 55
weak     = roster < prestige − 10      // weak relative to the name, not absolutely
```

| Mandate | Condition (first match wins) | Summary line |
|---|---|---|
| `championship` | standing ≥ 68 | Omaha. This roster is good enough and the board knows it. |
| `contend` | talented and standing ≥ 55 | Win the conference and reach the tournament. *N* wins is the floor. |
| `build` | proud and weak | Stay respectable while you reload. *N* wins keeps the room calm. |
| `compete` | standing ≥ 48 | A winning season, and push for a bid. The board wants *N*. |
| `develop` | otherwise | Bring players on. *N* wins would be real progress. |

The roster carries slightly more weight than the reputation, because the board
ultimately watches the games.

### 6.2 The win target

Priced off **roster strength alone**, from a line fitted to 512 simulated
team-seasons (`winPct = 0.01284 × roster − 0.128`, R² 0.679, residual 2.9 wins):

```
targetPct  = clamp(0.01284 × roster − 0.173, 0.20, 0.85)
floor      = (mandate === 'compete') ? floor(games / 2) + 1 : 0
targetWins = max(floor, round(targetPct × games))
```

Two deliberate choices are hidden inside this. **Prestige has no say** — it decides
what *kind* of job this is and has no business deciding how many games these
particular players should win; setting the target off `standing` had develop
programs hitting their number 27% of the time while championship programs hit
theirs 100%. And the bar sits about **a game and a half below the median outcome**,
not on it: sitting it on the median means half of all programs fail every year by
construction, which is not a demanding board but an incoherent one. The offset buys
roughly a **62% clear rate**.

The compete floor exists because on a thin compete roster the fitted total came out
below .500, so the two required boxes contradicted each other.

### 6.3 The checklist

`judge` reads this and nothing else. An earlier version judged on win margin while
the screen displayed a mandate, which meant the board could tell you it wanted a
conference title and then fire you over a win total you were never shown.

| Mandate | Required | Bonus |
|---|---|---|
| `develop` | Win *N* games · Finish out of the conference cellar | Top half · Reach the national tournament · Win *N+4* |
| `build` | Win *N* games · Stay out of the conference cellar | Top half · Reach the national tournament · Win *N+4* |
| `compete` | Win *N* games · Finish above .500 | Top half · Reach the national tournament · Win *N+4* |
| `contend` | Win *N* games · Finish top three | Reach the national tournament · Win the conference · Reach Omaha |
| `championship` | Win *N* games · Finish top three · **Win the conference** | Reach the national tournament · Reach Omaha · Win the national title |

Where the mandates genuinely differ is in what is *required* rather than in what
sounds different, and **winning the conference is the difference between the top
two**: the same trophy a contender is praised for is the job at a championship
program. Every mandate carries exactly three bonus boxes, which is what makes
`judge`'s two-bonus bar for "exceeded" mean the same thing at every job.

### 6.3a The capacity rule, and the two times it was broken

A board may **require** only what the format can actually hand out. Stated
properly: for each required box, the number of programs asked for it must not
exceed the number of programs that can have it in one season.

| Rung | Seats in one season | Asked of, per year | Peak over 35 seasons |
|---|---|---|---|
| Stay out of the cellar | 88 — eleven of twelve, times eight | ~60 `develop` + `build` | — |
| Finish above .500 | not rationed by the format | ~15 `compete` | — |
| Top three | 24 — three, times eight | ~19 `contend` + `championship` | **22** |
| Win the conference | 8 — one per conference | ~5 `championship` | **7** |
| Reach the national tournament | `NATIONAL_BIDS`, 8 | required of nobody | — |

The rule has been broken twice and both times it read as the game being unfair
rather than as a bug.

1. The first draft required a **top-half finish of rebuilding programs** — teams
   that are weak *by definition*, since that is what earns the mandate — and 73%
   of them failed their review.
2. A **national tournament bid was required of every `contend` and `championship`
   program**. There are eight bids in this format, one per conference champion,
   and fifteen to twenty programs a year carried the box, so seven to twelve of
   them failed something the country had no seat for. Measured over twenty
   seasons of the full world it cost **12.8 clear reviews a year** — the whole of
   the distance between the 55% the boards were clearing and the 62%
   `expectationFor`'s win offset is tuned to. The bid is a bonus at every mandate
   now, and `contend` climbed from top half to top three to replace it, because a
   contender clears the top half 98% of the time and a required box that never
   fails is decoration.

The rule has a second half that the seat count alone does not capture: the
population asked must be one the format selects *for* rather than against. That
is why "not last" is safe where "top half" was not — the cellar is one slot in
twelve and a rebuild has eleven ways out of it, whereas a rebuild cannot be above
the median of a league it is defining the bottom of. It shows in the measurement:
`notLast` is missed by 6.5 programs a year but is the **sole** miss for only 0.5
of them, because the other six had already lost their win box. Reading a raw miss
column as the price of a box is how an objective gets blamed for a season the win
total had already lost, and it is what the earlier estimate of "notLast costs
seven" was doing.

Two tests hold this. `program.test.ts` prices the seats off `NATIONAL_BIDS`,
`OMAHA_BERTHS` and the conference table and sweeps a generated league at three
spreads; `rivals.test.ts` counts the real demand year by year across a played
league. Neither hardcodes eight, so **the expanded postseason cannot silently
reintroduce the breach** — and equally, the day the field seats twenty, requiring
a bid of contenders becomes honest and the tests will say so.

`objectiveMet` treats a `conferenceRank` of 0 as "not known", so a season in
progress never shows a placement box already ticked.

### 6.4 The verdict

```
if wonTitle                       -> exceeded     // ends the conversation
missed = required boxes not met
bonuses = bonus boxes met
if missed == 0  -> bonuses >= 2 ? exceeded : met
if missed == 1  -> missed
otherwise       -> failed
```

Two bonuses rather than one: every mandate carries three, and one of them is
ordinary enough that a single hit is just a good season inside the mandate.
Treating one as overachievement made "met" almost extinct — 8.9% of reviews — and
left the board with no way to say "you did the job" without praise.

### 6.5 Security, contracts and being let go

| Verdict | Security delta |
|---|---|
| exceeded | +20 |
| met | +9 |
| missed | −14 |
| failed | −28 |

Clamped to 0–100. A first-year coach (`tenure === 0`) takes **half** of any
negative: boards fire the coach they hired last spring only for something
genuinely disastrous.

| Outcome | Condition |
|---|---|
| **Sacked** | security after < 20 **and** tenure ≥ 1 |
| **Extended** | not sacked, verdict `exceeded`, and `contractYears <= 2` → deal torn up, reset to full `contractLength` |
| **Not renewed** | not sacked, not extended, contract ran to zero, and security < 45 |

Running out the deal is not the same as being sacked, and the message says so.
Contract length is set by the hiring program:

```
contractFor(prestige) = prestige >= 65 ? 3 : prestige >= 48 ? 4 : 5
```

Weaker programs offer more time because they are asking for a rebuild and know it;
the good jobs pay in prestige and expect results sooner. A new job resets tenure to
0, security to 62, and issues a fresh deal. That reset is `takeChair`, one
function, so a new career, a job accepted and a rival hired all agree about what
arriving means — including the one thing that is not obvious, `arrivedPrestige`,
which is what the Builder achievement measures a career against.

### 6.5a Two bad seasons in a row — **B5**

Security already remembered a bad season in the sense that the number was lower
afterwards. What nothing could see was the *shape*: a coach's first poor year and
his fourth cost exactly the same, so a run of them was priced as a series of
unrelated accidents. `CoachState.badRun` is the memory — bad seasons in a row,
`missed` and `failed` counting alike.

```
badRunPenalty(badRun) = 0                       for badRun < 2
                      = 5 + (badRun - 2) * 3    otherwise
```

Subtracted from `nextCoachPrestige`, on top of whatever the season itself did.
Sized against the hiring ladder, whose rungs are about fifteen points apart: two
bad years costs a third of a rung and four in a row costs most of one. A coach can
survive a rebuild going wrong; a coach who is simply not good enough falls out of
the band the good jobs recruit from, which is what "he has stopped being a name"
should mean in a number.

Three deliberate choices:

- **One acceptable season wipes the run out entirely**, rather than decrementing
  it. A coach who missed twice and then met the mandate has answered the
  question, and carrying half a pattern forward would have him serving a sentence
  for a year that went fine.
- **It is not a second hit to job security.** Security already fell fourteen or
  twenty eight for each of those seasons; doubling the sacking pressure would mean
  nobody ever reaches a third bad year, and the escalation above would be a rule
  that fires once and is never seen again.
- **It is cleared when he takes a chair**, his and a rival's alike, in
  `takeChair` and in the matching clause in `runCarousel`. A run is a *board's*
  patience running out, and a board that has just hired him is by definition
  unconvinced by the last one's read of him. What does follow him between jobs is
  the prestige the run already cost, which is the part that genuinely is the
  country's opinion. Measured before this rule went in: a coach sacked after four
  bad years, who then took a rebuild and missed in his first season there, paid
  fourteen points in a building he had been in for five minutes.

The board says it out loud: at two the message gains "Twice in a row now, and it
is being noticed outside this room", and the inbox files a separate card naming
the points. A silent penalty is a bug report.

### 6.6 The hiring ladder

```
hiringBar(programPrestige, rosterQuality)
  = programPrestige                                  if roster >= prestige
  = round((programPrestige + rosterQuality) / 2)     otherwise
```

**A proud program with a gutted roster discounts itself.** Nobody established
wants to inherit a rebuild at a place where the fanbase still expects June, so
those jobs go looking further down the ladder than their name suggests. That is
how a nobody gets a big job, and it is a trap as often as an opportunity — the
expectations do not come down with the bar.

Coach prestige required, by the star tier of that bar (`HIRE_REQUIREMENT`, indexed
by stars so index 0 is unused):

| Bar tier | Coach prestige needed |
|---|---|
| ★ | 0 |
| ★★ | 20 |
| ★★★ | 38 |
| ★★★★ | 52 |
| ★★★★★ | 68 |

`hireGateNote` says how far short you are: more than 25 → *"Out of reach. They hire
proven names, and nobody knows yours yet."*; more than 12 → *"They want a coach
with a record. Win somewhere smaller first."*; otherwise → *"Close. One good season
somewhere and they would take the call."*

`jobOffers` shows up to four programs, sorted by prestige, that both clear
`canBeHired` and sit at or above `coach.prestige − 22` — a job far beneath where
you already are is not an offer worth showing.

### 6.7 How the three numbers move

```
seasonScore(o)      = clamp(winPct × 100 + 6·bid + 8·conf + 12·omaha + 15·title, 0, 100)
nextPrestige(p, o)  = clamp(p + (seasonScore(o) − p) × 0.18, 5, 95)     // the school
nextCoachPrestige   = clamp(c + (seasonScore(o) − programPrestige) × 0.22
                              + 4·conf + 6·omaha + 12·title
                              + (45 − c) × 0.04,   5, 99)               // you
```

Personal standing moves on what you did **relative to the job**. Winning 20 games
at a powerhouse is expected; winning 20 at a cellar program is the reason somebody
better calls you. The inertia term pulls reputation back toward 45 by 4% of the
distance every year, so a coach cannot coast on one good season for a decade.

Program prestige belongs to the school and survives a coaching change — the store
writes `review.prestigeAfter` onto the team record, not onto the coach.

---

## 7. Awards — **SHIPPED**

`engine/postseason.ts`, `ui/screens/Awards.tsx`

### 7.1 Player awards

Qualification is scaled to games played (`gp` = the league's maximum):

| Award | Minimum | Chosen on |
|---|---|---|
| Player of the Year | PA ≥ `floor(gp × 2.0)`, non-pitchers only | OPS |
| Pitcher of the Year | IP ≥ `max(1, floor(gp × 1.0))` | `pitcherValue` |
| Freshman of the Year | as above, freshmen only | the better of the two, on a shared scale |
| All-Conference | PA ≥ `floor(gp × 1.5)`, IP ≥ `max(1, floor(gp × 0.8))` | best OPS at each of the nine lineup spots, plus the top three arms by `pitcherValue` |

```
pitcherValue(s) = ip × max(0, 5.0 − era(s)) / 9 + s.k / 45
```

Innings carried, discounted by the runs that came with them, so a reliever with a
shiny ERA over thirty innings does not beat an ace who carried a hundred.

Freshman of the Year compares a hitter's `(OPS − 0.700) × 12` against a pitcher's
`pitcherValue`; ties go to the hitter.

### 7.2 Coach of the Year — the salience rule

The first version had one measure and it was a good measure with a bad
consequence: the citation read the same every June, so five seasons in the award
was wallpaper. A fixed precedence list would not fix it, because some category
always fires — a plus-ten turnaround exists in practically every simulated season —
so precedence just swaps one repeated headline for another.

Instead **each category is scored by how loud it was *this* season**: the winner's
number divided by that number's spread across the league. Dividing by the
per-season standard deviation is what makes wins, win-jumps and run margins
comparable at all — each becomes "how far outside a normal season was this". The
loudest story wins.

**And then divided again, by what a normal winner of that category scores.** The
first version stopped at the paragraph above and the citation still read the same
every June: measured over twenty seasons of the full world, the giant-killer
fired **zero** times, wire-to-wire **once**, and overachievement took eleven. The
reason was not the thresholds. Three of the four saliences are maxima over
different sized pools — overachievement and the turnaround are the largest of
ninety six draws, wire-to-wire the largest of the eight programs that won a
league — and the largest of ninety six sits further from the mean than the
largest of eight, every time. The question being answered was "which statistic
has the fattest tail", and one statistic always won it.

`TYPICAL_SALIENCE` is each category's median raw score over those twenty seasons
— overachieved **2.6**, turnaround **2.5**, wireToWire **2.0** — so one is an
ordinary year for that story and the comparison is like for like. The
giant-killer is not measured and does not get one: it is binary and rare, and
keeps a raw score high enough to win outright whenever it fires.

Over the same twenty seasons the four now come out **7 / 8 / 5 / 0**
(overachieved, turnaround, wireToWire, giantKiller), against 11 / 8 / 1 / 0
before. `coachAwardCandidates` is exported so the test can see what reached the
ballot rather than only what won it — a category that cannot be *constructed* is
invisible to a count of winners.

The baseline is self-calibrating: fit wins against roster strength across all
programs by ordinary least squares, and overachievement is distance above the
line. Roster strength is the mean overall of the lineup plus the top three of the
rotation.

**A losing season wins nothing**, whatever the story. This holds for every
category.

| Reason | Fires when | Raw salience | Headline written |
|---|---|---|---|
| `overachieved` | always — some team is furthest above the line | `gap / sd(residuals)` | "*X.X* wins above what that roster was worth" |
| `giantKiller` | national champion at a program whose **prestige** ranks outside the country's top twelve, winning record | **fixed 4.0** | "national champions, and only the No. *N* name in the country" |
| `turnaround` | biggest positive one-year jump in wins; needs `lastW`, so silent in year one | `jump / sd(jumps)` | "from *W–L* to *W–L* in one year" |
| `wireToWire` | the best run margin per game **among conference champions** | `margin / sd(diffs)` | "outscored the country by *X.X* runs a game" / "won the league at *X.X* runs a game" |

Two of those gates were rewritten because the format cannot supply what the old
ones asked for — the same defect as a board objective with no seats behind it
(§6.3a).

**GIANT-KILLER used to read the champion's roster**, outside the country's top
ten. The national field *is* the eight conference champions, and a program does
not win a twelve team league without one of the best rosters in the country: over
twenty seasons the champion's roster ranked between first and ninth every single
time, and within the four in Omaha it was the strongest or second strongest every
single time. Prestige is a different axis and it is the one the phrase means — a
modest school with a loaded senior class is what the `compete` mandate exists
for. The champion's prestige ranked first in thirteen of those twenty seasons and
outside the top twelve in one, so the category now fires about one year in
twenty, which is what a fixed 4.0 is for.

**WIRE-TO-WIRE used to require the country's outright best margin** and then
check whether that team had won its league — two independent events rather than
one story, and the margin leader is usually a team that was knocked over in its
conference tournament. It fired once in twenty seasons. The candidate is now the
best margin among the programs that did win a league, which is the sentence read
in the order it is spoken. Both halves are still required: the margin alone is a
stat, the title alone is a bracket.

Award subtitles, from `ui/screens/Awards.tsx`:

| Reason | Subtitle |
|---|---|
| `overachieved` | Nobody got more out of less. The roster said no; the record said yes. |
| `giantKiller` | The trophy went home to a school that had no business holding it. |
| `turnaround` | The biggest one-year climb in the country, same school, same players. |
| `wireToWire` | Won the league and outscored everybody doing it, start to finish. |

---

## 8. The postseason — **SHIPPED, and expanded August 26, 2026**

`engine/postseason.ts`, `engine/doubleElim.ts`, `ui/screens/Postseason.tsx`,
`ui/DoubleElimMap.tsx`

> **The format below this box is the superseded one.** The prose of this
> section describes the three-tier knockout that shipped first — six-team
> conference knockouts of series, one regional series per region, a last
> four — and is kept for the reasoning that still applies (the calendar, the
> rotations, the box scores, the freeze). The format that plays today:
>
> - **Conference:** top **8** of each twelve into a **double elimination**
>   (`engine/doubleElim.ts`), single games, 14 or 15 with the reset. The top
>   **four finishers** advance, read off the bracket (`placings`).
> - **Regionals:** 32 teams, **sixteen best-of-three championship series**
>   crossing each region's two conferences (A1vB4, A2vB3, B1vA4, B2vA3), the
>   two champions kept apart. Sixteen regional banners a June.
> - **National field:** 16 regional champions + 4 protected/at-large = **20**
>   (`selectNationalField`). Protection is the regular season's final top
>   four, locked before a bracket game is played: it guarantees the field and
>   an opening-round bye, never a banner, never a seed. A protected regional
>   champion frees its slot to the best unqualified team on the table.
> - **Opening round:** seeds 13–20, best of three, outside in. The sixteen
>   split into two 8-team double eliminations (`splitShowdown`, top two seeds
>   apart), whose champions play a best-of-three for the country.
> - **Finish ladder:** missed · regional (32) · national (20) · omaha (the
>   16 of the showdown) · runner-up · champion. `OMAHA_BERTHS` is 16 and
>   `NATIONAL_BIDS` is 20; the championship mandate requires the *regional*
>   banner (§6.3a's capacity rule, 16 seats against at most ~9 askers).
>
> The screen: WINNERS | LOSERS toggles per stage (OPENING | WINNERS | LOSERS
> for the national), each view an ordinary column map with every card in the
> school's own colour, and the action button pinned to the frame.

### 8.1 The shape of the world

Eight conferences of twelve — **96 programs** (`data/schools.ts`). A regular season
is 45 games: eleven three-game conference series (33) plus twelve non-conference
midweek games. Eleven series against an eleven-team field is a full round robin.

### 8.2 The format

| Stage | Field | Structure | Series length |
|---|---|---|---|
| Conference tournament | top 6 of 12 by recorded regular-season order | knockout tree in an 8-slot bracket, so seeds 1 and 2 get byes; three rounds | best of **3** (`SERIES.conference`) |
| Regional | the 2 conference champions of each of 4 regions | one series | best of **5** (`SERIES.regional`) |
| National (Omaha) | the 4 regional champions | semifinal and final | best of **7** (`SERIES.national`) |

Six of twelve, so half the league is finished in May and qualifying is something
you earn over forty-five games. Six in an eight-slot bracket also byes the top two
seeds, which is the regular season's other reward: win your league and you need two
series for the title instead of three.

The four regions, each a pair of conferences (`REGIONS`):

| Region | Conferences |
|---|---|
| SOUTH | GULF, ATL |
| NORTH | NEC, GLK |
| WEST | PAC, MTN |
| CENTRAL | DES, HRT |

One rule the whole way up: **you advance by winning something.** There is no
at-large field. Regional and national seeding both read regular-season wins
(`regularRecord`), which is the last thing those forty-five games are still paying
for, and level teams are separated by §8.7 rather than by luck.

Two counts are derived from `REGIONS` rather than written down, because the board
has to respect them and a hardcoded eight would go stale the day the field grows:
**`NATIONAL_BIDS`** (8 — the programs that reach the national field at all, which
in this format is one champion per conference) and **`OMAHA_BERTHS`** (4 — one per
region). §6.3a is the rule they exist for: a mandate may require reaching a stage
of no more programs than the stage seats.

### 8.3 Why knockout and not double elimination

Double elimination is what college baseball actually plays, and losing and
surviving is the best drama the format has. It is also unreadable on a phone: the
losers' bracket pairings do not exist until somebody loses, so **there is no full
bracket to draw**. A knockout tree can be drawn whole on day one, every slot in it,
TBD where the names have not arrived. Series length carries the drama instead.

`startSeriesBracket` builds the whole tree up front, rounds up to a power of two,
and byes the best seeds into empty slots. `seedOrder` is the classic recursive
interleave — eight teams come out 1-8, 4-5, 2-7, 3-6.

Round names by total rounds (`ROUND_NAMES`): 1 → Final; 2 → Semifinal, Final; 3 →
Quarterfinal, Semifinal, Final; 4 → Round of 16, …; 5 → Round of 32, ….

### 8.4 Hosting, rotation and rest — the recently fixed parts

**Hosting alternates from the better seed.** `hostOfGame(series, gameIndex)` gives
the better seed the even-numbered games, so a best-of-seven gives him four of seven
and a best-of-three two of three. Home field is worth something real in this engine
(×1.020), and handing the higher seed every game of a seven-game series would make
seeding decide it before anybody played.

**Each side's rotation slot is its own.** `homeSlot = homeAppearances % 3` and
`awaySlot = awayAppearances % 3`, tracked per team on `SeriesBracket.appearances`.
A team arriving off a bye and a team that has just played three games in three days
are not both on their Friday starter, and running the whole bracket off the host's
count meant they always were.

**A round is a night.** `stepBracket` plays one game in every live series of the
current round, then calls `advancePostseasonDay`, which pushes the calendar forward
one day. That is what lets a bullpen recover between games instead of the same three
arms carrying a team through every round of June. `restedFirst` then offers the pen
longest-rested first, ties broken by overall.

`firstPostseasonDay` is three days after the last regular-season fixture.
`currentDay` reads the fixture list while there is one and the postseason clock
after that, so rest, box scores and result dates cannot disagree.

`clincher(bestOf) = floor(bestOf / 2) + 1` — 2 of 3, 3 of 5, 4 of 7.

### 8.5 Managing your own run

`MyBracket` holds the tournament you are inside. A game you play by hand is handed
back to the bracket as a `preplayed` result keyed by `pairKey(a, b)`, recorded
exactly like a simulated one — so a hand-played regional counts the same. The rest
of the world does not wait: everything at that stage not involving you is already
played, and your result is dropped into its correct `slot` so Omaha seeding is not
disturbed.

`freezeRegularSeason` snapshots `rw`/`rl` before a single bracket game moves a
record. Tournament games still accumulate statistics — NCAA season totals include
tournament play — but the board judges `regularRecord`.

### 8.5a The map camera: it moves only when it has to

`ui/PostseasonMap.tsx`. One tier is drawn at a time and the camera follows your
next unresolved series, re-pointing whenever a game is played. Reported: *"when
playing the post season if i hit simulate this game it keeps dragging the camera
instead of staying where I was at the moment."* Easing the move did not answer
it. The complaint is not that the travel is abrupt, it is that pressing SIMULATE
takes the board out from under you at all.

**The rule is now: do not move what the reader can already see.** Before
re-pointing, the follow effect asks whether the target card is whole on the
screen — its box, in the camera's current offset, inset by ten pixels so a
matchup half against the bezel does not count. If it is, the effect returns and
the camera is not touched at all; the transform on the canvas node comes out
byte-identical across the press. If it is not, the camera travels to it exactly
as before, which is what keeps a live series from hiding off screen with no hint.

Two exemptions, both structural rather than preference:

- **A tier change always moves.** Each tier is laid out from its own origin, so
  the point being left and the point being arrived at are numbers in two
  different coordinate spaces and "already visible" is not a question that can
  be asked across the cut. The first paint is a tier change, which is what still
  opens the map pointed at your own bracket.
- **Nothing of yours in the tier holds.** A coach who is out, or who never
  qualified, is watching somebody else's June, and re-centring the board under
  him on every press is the same complaint with nothing of his own on screen to
  justify it.

Everything else is unchanged: within a tier the move glides (170–460 ms, scaled
by distance), across tiers it cuts, a finger on the glass cancels a move in
flight, and `prefers-reduced-motion` makes every move a cut.

### 8.6 Finishes

`Finish` runs `missed` → `regional` → `omaha` → `runner-up` → `champion`. Only
teams that got out of their conference appear in the map. Labels:

| Finish | Label |
|---|---|
| `missed` | Missed the tournament |
| `regional` | Regional |
| `omaha` | Omaha |
| `runner-up` | National runner-up |
| `champion` | NATIONAL CHAMPION |

### 8.7 Ties, and how they are broken

One function, `seedTeams` (`engine/season.ts`), and everything that puts teams in
an order goes through it: the conference table, the national rankings, the
conference tournament field, and both bracket seedings. It takes the ranking being
seeded on — conference percentage, RPI, regular-season wins — and separates
everyone level on it with the same chain.

| # | Criterion | Notes |
|---|---|---|
| 1 | **Head to head** | A mini round robin *within the tied group*: wins over the others minus losses to them. Regular season only |
| 2 | Conference record | `confPct` |
| 3 | Overall record | `regularRecord`, so June cannot move it |
| 4 | Run differential | The one term still live during the postseason, which is why it sits fourth |
| 5 | **The school's abbreviation, ascending** | The stated, deterministic backstop |

**Head to head is group-relative on purpose.** A pairwise comparison is not
transitive: three teams in an a-beats-b-beats-c-beats-a cycle would sort into
whatever order the comparator happened to visit them in, which is the problem the
function exists to remove. A net figure is a number, and numbers sort.

**Every meeting counts, conference or midweek**, and that happens to be the
sport's own rule rather than a simplification of it. Inside a conference the season
is a full round robin, so every meeting between two members is a conference game;
two teams in different conferences can only ever have met in non-conference play.

**Postseason games are excluded.** A tiebreaker that moved while a bracket was
being played would reseed the rounds still to come from underneath them. The
schedule's last day is the boundary — `currentDay` gives every June game a date
past it.

**The last resort is arbitrary, and arbitrary in public.** The real sport draws
lots; a draw is exactly what cannot be allowed here. Before this, ties fell out of
`Array.sort` in `data/schools.ts` order — an invisible coin flip that would have
changed if anybody had ever reordered the file. An abbreviation is unique, it is
what the rest of the save already identifies a program by, and it does not move.
This was A4 in the backlog.

The ties are not the rarity that a float suggests. Before a ball is thrown every
program in the country has an RPI of exactly zero, and that is the table the
national rankings screen draws in February.

**`finalOrder` is frozen conference by conference.** It is the regular-season
snapshot `conferenceField` seeds a tournament off, and the only thing that ever
reads it filters it back down to one conference. Frozen as a single national table,
a tie broken against the rest of the country could order two league-mates
differently from their own table — and the tournament a program is seeded into has
to match the standings it has been reading all season.

---

## 9. Playing a game — **SHIPPED**

`engine/game.ts`, `engine/liveGame.ts`, `engine/engines.ts`, `engine/ratings.ts`, `engine/strategy.ts`

### 9.1 Two layers

Engine A (`log5`) is the shipping engine: pick the plate-appearance outcome from a
validated probability model, then generate a pitch sequence constrained to land on
it. Engine B (`pitch`) simulates pitches freely and lets the outcome emerge; it is
a comparison instrument, not the shipping engine. `DEFAULT_SEASON.engine` is
`'log5'`.

### 9.2 The standing policies

Every aggressive setting has to hurt somewhere. A screen where one column is
strictly better than another is not a decision.

| Policy | Values | Effect |
|---|---|---|
| `running` | patient / balanced / aggressive | attempt ×0.80/1.00/1.24, risk of being thrown out ×0.62/1.00/1.70 |
| `steals` | never / selective / constant | green-light multiplier on the attempt rate: 0 / 1.00 / 2.20. Success is unchanged |
| `bunt` | never / rare / often | AI bunt appetite: 0 / 0.14 / 0.46 |
| `hook` | quick / standard / patient | pitches added to a starter's leash: −15 / 0 / +18 |
| `alignment` | straight / situational / shift | ground-ball-to-hit multipliers: vs power 1.00/0.93/0.82, vs speed 1.00/1.06/1.21 |

**The shift is a bet, not an upgrade.** Measured: over 2,500 games a blanket shift
moved runs allowed from 4.72 to 4.71 — the sluggers it suppresses and the runners
it hands singles to cancel almost exactly. That is the reason real teams shift
against particular hitters.

```
pull   = clamp((batter.power − 45) / 30, 0, 1.4)
wheels = clamp((batter.speed − 45) / 30, 0, 1.4)

straight     -> 1
situational  -> 1 if pull < 0.5 or wheels > 0.7, else 1 + (0.82 − 1) × pull
shift        -> (1 + (0.82 − 1) × pull) × (1 + (1.21 − 1) × wheels)
```

Scaled from 45 over a 30-point range so an ordinary hitter still feels something;
anchored at the league average across the full scale, a power-70 slugger saw a 4%
effect and everyone else essentially none.

The alignment multiplier lands on **singles specifically** in Engine A. A shift
takes away the ground ball that sneaks through the right side; it does very little
about a double in the gap and nothing at all about a home run.

Every other program in the world gets a stable personality derived from its team
index — `table[(teamIndex × 7 + salt × 13) % table.length]` — so 96 programs feel
like different places rather than one program repeated, and a team does not change
character every time you look at it.

### 9.3 Tactics you call while managing

Every call is always listed, with the unavailable ones greyed and carrying the
reason. Hiding them made the panel resize on almost every pitch and left the
manager guessing at his own options.

**Offence** (`OFFENSE` in `engine/liveGame.ts`):

| Tactic | Label | Note | Available when | Unavailable text |
|---|---|---|---|---|
| `swing` | SWING AWAY | let him hit | always | — |
| `hitrun` | HIT AND RUN | runner goes with the pitch | runner on first, < 2 out | "nobody on first" / "two outs already" |
| `bunt` | SAC BUNT | trade an out to move him up | runner on first or second, < 2 out | "nobody to move up" / "two outs already" |
| `contact` | PLAY FOR CONTACT | situational — see below | any runner on | "nobody on to move" |
| `steal` | STEAL SECOND / STEAL THIRD | send the man on first / send the man on second | a bag ahead is open | "nobody on" / "only home is left, and nobody steals home" / "the next bag is taken" |

PLAY FOR CONTACT's note changes with the situation: *"a ball in the air brings him
home"* (man on third, < 2 out), *"shorten up; he scores on a base hit"* (third, 2
out), *"put it in play and get him to third"* (second), *"shorten up and move him
along"* otherwise.

A double steal is not modelled. With men on first and second only the lead runner
goes, and the label says THIRD.

**Defence** (`DEFENSE`):

| Tactic | Label | Note | Available when |
|---|---|---|---|
| `pitch` | PITCH | let him work | always |
| `groundball` | PITCH FOR GROUND | sink it, get two | always |
| `around` | PITCH AROUND | nothing over the plate | always |
| `infieldIn` | INFIELD IN | cut the run off at the plate | runner on third, < 2 out |
| `ibb` | WALK HIM | first base is open | first base empty, runner on second or third, < 2 out |

**What each call actually does** (`tacticMods`, `engine/game.ts`). These are tilts,
not commands: asking for a ground ball raises the chance of one; it does not
produce one.

| Tactic | Event multipliers | Other |
|---|---|---|
| `hitrun` | single ×1.06, homerun ×0.85, walk ×0.85 | doublePlay 0.05 |
| `contact` | homerun ×0.80, single ×1.04, walk ×0.90 | sacFly 0.58 |
| `groundball` | homerun ×0.78, walk ×1.10 | groundBall ×1.45, doublePlay 0.20 |
| `around` | walk ×2.0, homerun ×0.50, double ×0.78, single ×0.82 | — |
| `infieldIn` | single ×1.20 | scoreFromThird 0.12, doublePlay 0.24 |

INFIELD IN is the genuine trade: the infield plays shallow to cut the run down at
the plate, and in exchange every ground ball has more room to get through. Real
infields give up roughly a hundred points of average doing this.

The AI opponent currently calls **only the sacrifice** (`chooseTactic`): it needs a
runner on first with third empty, fewer than two out, the sixth inning or later, a
margin inside ±2, and then rolls `appetite × (weak batter ? 1.0 : 0.35)` where weak
is `(contact + power) / 2 < 48`.

### 9.4 Steals

```
attempt = clamp(0.11 × green
                × mult(runner.speed, 0.45) × mult(runner.steal, 0.65)
                × mult(pitcher.holdRunners, −0.35)
                × catcherArm(catcher, −0.30),
                0, 0.75)

success = clamp(base × mult(runner.speed, sp) × mult(runner.steal, jump)
                     × mult(pitcher.holdRunners, hold)
                     × catcherArm(catcher, arm),
                0.25, 0.90)
```

| Target | base | speed | jump | hold | arm |
|---|---|---|---|---|---|
| second | 0.70 | 0.12 | 0.22 | −0.15 | −0.34 |
| third | 0.64 | 0.10 | 0.24 | −0.10 | −0.40 |

Two factors ride on top of both lines and are left out of the boxes above
because they belong to §18 rather than to this model: the runner's GREEN LIGHT
or STATION TO STATION tendency multiplies the attempt, and BURGLAR on the runner
and CANNON on the catcher scale the success and the attempt respectively. They
multiply the dugout's policy rather than replacing it — a man turned loose on a
club that never runs still does not run, because the sign comes from the bench.

Third is the harder theft and the easier jump: the throw is shorter, so the
catcher's arm decides more of it, while a pitcher facing a runner on second is
mostly worrying about the hitter and holds him less. **Home is not modelled** — a
straight steal of the plate is a once-a-season play and putting a button on screen
for it would be putting a button on screen for something nobody should ever press.

Three people decide a steal. The pitcher controls the jump; the runner covers the
ninety feet; **the catcher has to make the throw**, and a strong arm behind the
plate is worth more than either. The catcher's arm appears in the *attempt* term as
well, because a cannon does not just throw people out — it stops them leaving.

Measured over every generated lineup bat against every school's starter and
catcher: a called steal of second is caught **30%** of the time and of third
**36%**, against a real D1 caught-stealing rate in the twenties to low thirties.

**Calling for a steal does not improve the odds.** `forced` skips the attempt roll
and nothing else: calling for it does not make it work, it only makes it happen.
The automatic game only ever takes second, because league SB and CS rates are
calibrated against that.

### 9.5 College rules in the engine

| Rule | Implementation |
|---|---|
| Walk-off | `RULES.skipBottom` — the home team does not bat in the ninth or later when already ahead; `RULES.decided` ends it the moment the home side goes ahead in the bottom |
| Run rule | `runRule` on by default: a 10-run gap after seven innings ends the game |
| Extra-innings tiebreaker | From the **tenth** (`EXTRA_INNINGS_TIEBREAK`), each half opens with a runner on second — the player who made the last out, as the rule specifies |
| Innings guard | The game stops at 30 innings |
| Substitution | Once out, out for good, both for pinch hitters and the bullpen. Availability is per game on `TeamState`; the season roster is never touched |
| Pinch hitting | From the seventh only, at most two a game; 14% when the margin is ≥ 7, 5% when a bench bat beats the man due by more than 4% in *this* matchup, otherwise never |
| Pitching change (AI) | `pitches > 30 + stamina × 0.85 + 12 + HOOK[policy]`, or 6 earned runs after 35 pitches |
| Passed balls / wild pitches | 3.0% base with a man on, scaled by `mult(catcher.blocking, −0.55) × mult(pitcher.control, −0.25)`, clamped to 0.25. Not an error by rule; the runs stay earned |

### 9.6 Calibration targets

`TARGETS` in `engine/calibration.ts`. Rate figures come from a Division I
play-by-play study (Robert Frey, "More About Counts in D1 Baseball"); per-game
counts are those rates over 41 plate appearances and are marked derived.

| Metric | Target | Provenance |
|---|---|---|
| Runs per team per game | 5.30 | derived, bracketed two ways |
| PA per team per game | 41.0 | estimate |
| Batting average | .270 | sourced |
| On base percentage | .347 | derived |
| Slugging | .374 | sourced |
| Home runs per team per game | 0.51 | derived |
| Strikeouts per team per game | 6.72 | derived — 16.4% of 41 PA |
| Walks per team per game | 3.73 | derived — 9.1% of 41 PA |
| Pitches per plate appearance | 3.75 | — |
| First pitch strike rate | .584 | sourced |
| Foul share of swings | .365 | sourced |

Since §18 there is a layer on top of all of this that is designed to leave every
row above unmoved: a tendency's two poles cancel across the population and a
badge is a small edge on one channel. §18.8 records what it actually cost, which
was one row.

Supporting constants in `engine/ratings.ts`: `LEAGUE` (the seven-event baseline,
summing to exactly 1), `LEAGUE_K_RATE` 0.164, `LEAGUE_BIP` (44% ground, 21% line,
27% fly, 8% popup), `CONTEXT.homeFieldOffense` 1.020 (measures 54.9% between evenly
matched teams), `CONTEXT.normalizer` 1.070, `CONTEXT.runnersOnOffenseBoost` 1.035,
`CONTEXT.timesThroughOrder` `[1.0, 1.0, 1.035, 1.075, 1.11]`, and `SPREAD` 0.62.

Calibration runs spread over 12 distinct team pairs (`CALIBRATION_PAIRS`), because
measuring one pair makes the result a property of twenty-three particular players
rather than of the engine.

### 9.7 How far a rating goes

`BAT_SENS` and `PIT_SENS` in `engine/ratings.ts`. Every rating is turned into a
rate by `mult(rating, sens) = exp(((r − 50) / 50) × sens × SPREAD)`, and the
sensitivity is per event: how much a rating of 95 buys depends entirely on which
event it is buying.

The figures below are the **best player in the generated world's** per-plate-
appearance rate as a multiple of the league mean, against an average opponent.
They are exact rather than simulated: `batterVector` measured against a
league-average arm *is* the hitter's own rate vector, because log5 with the
pitcher on the league baseline collapses to the batter's side.

| Event | Was | Now | Real | The reasoning |
|---|---|---|---|---|
| Single | 1.34× | 1.34× | ~1.3× | Already right. Left alone deliberately: singles are most of a batting average and most of what decides a game |
| Double | 1.39× | **1.70×** | ~1.6× | MLB's doubles leader runs 7.1% of plate appearances on a 4.4% league |
| Triple | 1.95× | **3.00×** | ~3.8× | The most skewed event in baseball — it takes the speed, the gap and the park together. Held short of the MLB figure because `speed` tops out at 90, not 95 |
| Home run | 1.79× | **3.00×** | 3.0× | The measurement this whole pass came from |
| Walk | 1.77× | **2.00×** | ~2.1× | A 19% walk rate on a 9% league |
| Hit by pitch | 1.07× | 1.07× | — | **Not widened.** Real leaders are miles above average, but that is a man who crowds the plate and no rating measures it; `eye` is the wrong one to charge for it |
| Batting average | 1.43× | **1.56×** | ~1.5× | Not tuned — it falls out of the four hit events above and is the check that keeps them honest |
| Slugging | 1.47× | **1.73×** | ~1.7× | Likewise derived |

And from the mound, as the fraction of the league rate the **best arm** allows:

| Event | Was | Now | Real |
|---|---|---|---|
| Single / double / triple allowed | 0.79× / 0.79× / 0.88× | unchanged | ~0.76× — balls in play barely spread in real baseball either |
| Home run allowed | 0.54× | **0.42×** | 0.42× |
| Walk allowed | 0.56× | **0.45×** | 0.41× |
| Strikeouts | 1.50× (as a multiple, best arm) | **1.70×** | ~1.7× |

Strikeouts are the cheapest widening in the engine and the most visible. Engine A
settles the event *before* it asks whether the out was a strikeout, so the
strikeout rate changes what an out looks like rather than whether one happened;
it reaches scoring only through the sacrifice fly and the runner moving up on a
ground ball. The batter's side widened with it — the best contact hitter now
strikes out at 0.51× the league rate, against 0.63× before.

**Widening had to be paid for.** `exp` is convex, so a wider sensitivity raises
the population *mean* of an event even though the curve still returns exactly 1.0
at a rating of 50; the generator centres hitters near 44 rather than 50, which
pushes the same way; and log5 divides a slugger's home run share by a denominator
his own home runs inflate. `BAT_NORM`, `PIT_NORM` and `JENSEN_K` are the constants
that put the league's realized rates back where they were, fitted empirically
against the calibration harness. Measured on the eight-seed sweep, before and
after: every calibration row is the same or closer to its target than it was, and
the worst deviation moved from 4.4% to 4.1%.

**Engine B was left alone.** `resolveBallInPlay` carries its own sensitivities on
its own hit-probability table, and they are calibrated against nothing — Engine B
is a comparison instrument reachable only from the command line. Widening them
would mean giving it a calibration pass of its own, which is not what this was.

**What it cost in competitive balance, which is the tension the knob exists to
manage.** Over six simulated seasons the standard deviation of team win totals
went from 7.85 to 8.73, the best record in a season stayed at 41-4, and the better
seed still wins 62% of bracket games against 64% before. At the widest rating gap
the shipped conference produces, 13 points, the better team wins 75.6%, inside the
75-to-85 target. Widening event by event rather than turning `SPREAD` up is what
bought that: `SPREAD` would have widened singles and balls in play too, and those
are the events that decide games.

---

## 10. Defence: attributes and per-player fielding statistics — **SHIPPED**

`engine/types.ts`, `engine/players.ts`, `engine/game.ts`, `engine/season.ts`,
`engine/progression.ts`, `state/seasonCodec.ts`, `tests/fielding.test.ts`

### 10.1 What is new versus what was already there

Already there before this work: `range`, `hands`, `arm` on every player; the
defensive spectrum; the range swing; team-level `defenseMult`; the glove-error
path; lane-based fielder assignment; `overallOf` weighting a hitter's glove at
7% range, 5% hands, 6% arm.

Arriving with it:

- `armAccuracy`, `blocking`, `bunt` and `steal` as first-class ratings
- `FieldLine` and per-player, per-season fielding statistics
- a **second** error path for the throw
- the catcher as a real participant — blocking, passed balls, and his arm in the steal model
- comebackers to the pitcher and pop-ups to the catcher, which never happened before
- weighted infield lanes, so the first baseman fields something
- pitchers' gloves developing between seasons

### 10.2 The rating set

`FieldingRatings` — all 0–100, higher is better. The plan sketched range on an
inverted Strat-O-Matic scale; a single inverted rating among a dozen normal ones is
a sign error waiting to happen.

| Rating | Meaning |
|---|---|
| `range` | Ground covered. Turns balls that would fall in into outs |
| `hands` | Cleanliness. Low hands is how a routine play becomes an error |
| `arm` | Throwing strength. Holds runners, and for a catcher throws them out |
| `armAccuracy` | Where the throw goes as opposed to how hard it gets there. The rating a throwing error comes off — the only error the engine has that moves runners rather than just putting one on |

Hitters additionally carry `blocking` (read only for the catcher), `bunt`, and
`steal` (the jump, as distinct from `speed`, which is the ninety feet).

### 10.3 Generation

The **defensive spectrum**, as offsets on a player's quality. Both columns sum to
exactly zero across the nine lineup spots and the module throws at import if they
do not: a spectrum redistributes talent across positions, it must not add any. The
first draft summed to +13 on arm, which handed every team a better throwing
outfield and dropped scoring 10.6% below target.

| Position | range | arm |
|---|---|---|
| C | −6 | +10 |
| SS | +10 | +4 |
| 2B | +7 | −3 |
| CF | +9 | 0 |
| 3B | −1 | +5 |
| RF | +1 | +6 |
| LF | −2 | −5 |
| 1B | −8 | −9 |
| DH | −10 | −8 |
| P | 0 | 0 |

`armAccuracy` and `blocking` carry **no** spectrum offset, deliberately: nobody is
moved to right field for having a straight throw, and since only the catcher's
blocking is ever read, a catcher bonus there would raise the league baseline rather
than distinguish catchers.

Derived ratings, clamped to 15–95:

```
bunt  = 50 + (contact − 50)×0.30 + (speed − 50)×0.25 − (power − 50)×0.30 + gauss×11
steal = 50 + (speed − 50)×0.40                                          + gauss×14
```

Both stay centred on 50 for a league-average player, so `mult` reads them as
neutral and neither moves the league's bunt or steal totals on its own. The
residual on `steal` is large on purpose — that residual is the difference between a
fast man and a base stealer.

Pitchers: `range` N(48, 12), `hands` N(52, 11), `arm` N(55, 10), and
`armAccuracy = clamp(46 + (control − 50) × 0.25 + gauss × 10, 15, 95)` — whatever
lets a man put a ball on the outside corner also lets him put one in the first
baseman's glove.

Both derived values and `velocity` take their `gauss` draw **in the position the
old independent roll occupied**, so the random stream is byte-for-byte unchanged
and no calibration figure moves.

### 10.4 Who fields the ball

Lane weights, then a position inside the lane.

| Batted ball | pull | middle | oppo |
|---|---|---|---|
| ground / popup | 0.45 | 0.28 | 0.27 |
| air (line / fly) | 0.36 | 0.36 | 0.28 |

The pull lane is weighted by `pullBias = 1 + clamp((power − 50) / 90, −0.25, 0.5)`.
Left-handed hitters mirror pull and oppo. A line drive is treated as an air ball
but goes to the infield 32% of the time, which is what a line out to short is.

| Lane | Infield split | Outfield |
|---|---|---|
| pull | 3B 0.53, SS 0.47 | LF |
| middle | SS 0.48, 2B 0.52 | CF |
| oppo | 2B 0.65, 1B 0.35 | RF |

The weights inside each lane are set from real assist counts: a shortstop records
around 400 in a season, a second baseman 380, a third baseman 280, a first baseman
110. Read as a fallback chain — which is what this table used to be — the pull lane
always went to the third baseman and **the first baseman fielded nothing at all,
ever**.

Two shares are taken before the lane draw so they come out of the whole diamond
rather than one third of it:

- `COMEBACKER_SHARE` **0.12** of ground balls go back to the pitcher
- `CATCHER_POPUP_SHARE` **0.24** of pop-ups go to the catcher

Ground balls only for the mound: a liner a pitcher does not catch is a hit off the
bat, and the engine cannot tell the two apart, so claiming the chance would mean
claiming plays he never had.

### 10.5 Range, then hands, then the throw

Range is measured against **the fielder's own team average**, not against 50, so
this only redistributes plays between the men on the field and the team-level
defensive environment stays where `defenseMult` already put it.

```
edge = fielder.range − team.defense
single, edge > 0  ->  out    with probability 0.18 × (edge / 50)
out,    edge < 0  ->  single with probability 0.18 × 0.3644 × (−edge / 50)
```

`OUT_TO_HIT_BALANCE = 0.178 / 0.4885 ≈ 0.3644`. Outs outnumber singles among balls
in play by roughly that ratio, so converting at equal rates in both directions
would turn far more outs into hits than hits into outs and quietly inflate scoring.

`TeamState.defense` is the **weighted** mean of the men who actually take the
field — weighted by `FIELDING_SHARE` (SS .15, 2B .13, 3B .10, 1B .09, C .02, LF
.16, CF .19, RF .16, P .05), excluding the DH and including the starting pitcher.
An unweighted mean sat below the range of the man who actually fields the ball, so
`edge` came out positive on average and turned a redistribution into a league-wide
defensive upgrade worth about 1% of scoring.

Two error rolls, in the real order of events:

```
glove:  0.0376 × (1/0.701) × KIND_ERROR_RISK[kind] × mult(hands, −0.55)
throw:  0.0408 × mult(armAccuracy, −0.55)                    // ground balls, infielders
        × 0.50 × mult(pitcher.hands, −0.35)                  // and again if he is the 1B
```

VACUUM and ON A LINE scale the two rolls respectively (§18.6); they are the only
badges that touch this.

`KIND_ERROR_RISK` is ground 1.00, line 0.55, fly 0.45, popup 0.30 — errors are
overwhelmingly a ground-ball event, and charging fly balls the same rate makes a
defence feel uniformly clumsy rather than clumsy where real defences are.
`ERROR_BY_KIND = 1 / 0.701` divides out the batted-ball-weighted mean of that table
so the redistribution does not change how many errors there are.

The two paths are a **split of one calibrated total, not an addition to it** — the
glove rate alone used to be 0.055. Real fielders throw the ball away roughly as
often as they drop it, and the throw is the more expensive mistake: a ball skipping
past first moves every runner rather than just putting one on. `throwRisk` charges
it only where the engine actually knows a throw was made: a ground ball an
infielder fielded. An outfielder catching a fly throws to nobody, and a runner
testing an outfield arm is already resolved by `advanceOnHit` without the ball
ever being described as on target or not.

**The first baseman is the exception, and he is half in.** He was exempt
entirely to begin with, on the grounds that he carries the ball to the bag
himself — but half of those balls are not that play, they are a feed to the
pitcher covering first, which is the one thing besides a comebacker a pitcher is
on the field to do and was the last ground ball in the engine with nobody
throwing on it. `COVER_FIRST_SHARE` is **0.50**, and that play reads two men:
the first baseman's `armAccuracy` and the covering pitcher's `hands`. The error
goes on the first baseman either way. A real scorer would split it — a wild feed
is his, a dropped one is the pitcher's — and the engine resolved the play in a
single roll, so it keeps one culprit rather than pretending to know which end of
it failed. Leaving it out left a first baseman's accuracy a rating nothing could
read, which is the dead menu item this whole pass exists to stop.

The E column is now **derived** from the men who booted the ball
(`TeamState.errors` sums the fielding lines), so the box score and the fielding
lines cannot disagree.

### 10.6 The fielding line

`FieldLine` is deliberately **not** a box score. A real fielding line is putouts and
assists, and three quarters of those are the first baseman taking a throw the
engine never decides to make; counting them would be fiction with the shape of a
statistic.

| Field | Meaning |
|---|---|
| `chances` | Balls in play hit at him. Home runs are nobody's chance |
| `plays` | Chances he retired the batter on |
| `expected` | What his own team's average fielder would have made of the same chances — the play log5 had already settled before his range was consulted |
| `errors` | Charged to him, both kinds. The E column's only source |
| `throwing` | Of those, the ones where the throw was the problem |
| `pb` | Catchers. Pitches that got past him with a man on |
| `sba` / `cs` | Catchers. Bases stolen on him, and runners he threw out |

Derived statistics (`engine/season.ts`):

- `fieldingPct = (chances − errors) / chances`. **Not** the scorer's number, which
  divides by putouts plus assists. League-wide it lands around .960 against a real
  D1 figure near .967.
- `playsAboveExpected = plays − expected`. Errors are inside it, because an error is
  a play not made — so the league average is not zero but about **minus one per team
  per game**, the league's error rate. Compare defenders to each other, not to zero.

`playsAboveExpected` is deliberately **kept out of the career record book**: it is
measured against the team a man happened to play for that year, so it does not mean
the same thing in two rows and cannot be summed down a career column.

### 10.7 Development

`develop` now bumps `range`, `hands`, `arm`, `armAccuracy`, `blocking`, `bunt` and
`steal` for hitters, and `range`, `hands`, `arm`, `armAccuracy` for pitchers. Every
fielding rating a pitcher had previously sat at its generated value for four years,
which nobody noticed because nothing in the engine read them.

`seasonCodec` defaults a missing `fielding` map to an empty one, so a save written
before fielding was kept loads and starts counting from the next pitch.

---

## 11. Saves — **SHIPPED**

`state/persistence.ts`, `state/seasonCodec.ts`, `ui/screens/Saves.tsx`

IndexedDB, database `playball`, object store `dynasties`, keyed on `slot`.
LocalStorage was not an option: a save is roughly a megabyte and localStorage caps
near five and stores strings. Saves go in via structured clone, which handles `Map`
natively — season statistics are keyed maps, and hand-converting them is exactly the
code that silently drops a field two schema versions later.

### 11.1 Slots

- **`'auto'`** is the one slot the game writes to on its own, and the only reserved
  key. It belongs to whichever dynasty is being played.
- Player-created slots are generated, never named: `newSlotId()` produces
  `dyn-<base36 timestamp>-<base36 random>`. The typed name goes in a separate
  `name` field that is only ever read. A dynasty called "auto" would otherwise be
  filed straight on top of the autosave.
- **No slot limit.** The Saves screen lists every save on the device, newest first,
  and offers load, copy-under-a-name, and a delete that asks twice.

### 11.2 Autosave

`saveNow(slot = 'auto')` is called from roughly twenty store actions — after
simulating a day or a season, on every recruiting spend and week advance, at each
offseason phase transition, on postseason stage changes, on job acceptance, on
year rollover. There is also an explicit save control in the app chrome.

### 11.3 What persists

`SCHEMA_VERSION` is **4**.

| Field | Notes |
|---|---|
| `season` | The whole world, through `toPortable` / `fromPortable` |
| `rngState` | Where the generator had got to. Without it a resumed season diverges |
| `year`, `userTeam`, `name`, `savedAt` | |
| `history` | Completed seasons. Optional — older saves come back with an empty book |
| `coach` | The full `CoachState`, the achievement cabinet included. Optional; `restoreCoach` fills every gap |
| `phase`, `review`, `outcome` | Where the offseason sequence had got to, and the verdict behind it |
| `postseason`, `bracket`, `myBracket`, `knockout`, `postseasonSeen` | June, at whatever stage it had reached, including a half-played tournament of your own |
| `jobSearch` | True while the coach has been dismissed and has not taken a new job |
| `inbox` | The notification centre, read flags and all. The one field in the file whose contents exist nowhere else — everything it reports has a permanent home, but *whether it has been read* does not |

The other ninety five careers are **not** in this table and do not need to be:
`TeamRecord.coach` rides inside `season`, so a rival's career survives the codec
and `nextSeason`'s spread without either of them knowing the field exists. That is
the whole reason it lives on the team record rather than in a parallel array.

The record is assembled **field by field** in `buildSaveFile`, so a value not named
there is dropped no matter what the types say. Widening the types and stopping there
compiled perfectly and lost the offseason on every reload.

### 11.4 Migration and failure

- Field migrations run on **read** (`migrateFile`), so a save written by an older
  build loads even if the browser never ran the upgrade path.
- Structural migrations run on database upgrade. **Version 4 drops the store**: the
  world went from 192 programs in sixteen conferences to the current shape, and a
  version-3 save stores team *indices* that now point at different schools. There is
  no honest migration for that.
- A save from a **newer** schema is refused with an error, checked before migration
  because `migrateFile` stamps the current version onto the record.
- Opening IndexedDB can hang forever — another tab holding the database at a
  different version fires `blocked` and then simply waits. `OPEN_TIMEOUT_MS` is
  **4000**; past that the game runs with `storageBlocked` set and saving off. A
  failed open is not cached, so closing the offending tab fixes it.

### 11.5 Player identity, and the name pool a save cannot carry

A `PlayerId` is **not** the display name. `nextPlayerId` (`engine/players.ts`)
reads the generator's current position — `rng.state()`, which `rngFromState`
restores exactly — puts it through Murmur3's finalizer and writes it as
`p` plus seven base-36 digits. It costs no draw, which is why adding it moved no
calibration golden; it is a bijection of the stream position, which is why two
men cannot share one; and it is reproduced by a resumed save, which is why a
seeded dynasty still replays.

It used to be the name. Statistics, the record book, awards and box scores are
all keyed on the id, so two men with one name were one man in all of them.

**Old saves are grandfathered, not migrated.** A dynasty written before this
carries name-shaped ids in its careers, its awards and its box scores, and keeps
them. An id has to be unique and stable, not pretty, and the two spaces cannot
collide — a name has a space in it and never starts lowercase.

**The name pool is rebuilt on load.** `usedNames` in `engine/players.ts` keeps
display names unique and has never been written into a save, so a cold reload
began with every name in the world available again. `fromPortable` now calls
`rebuildNameIndex`, which clears the pool and refills it from the three places a
save keeps a name: the ninety-six rosters, the record book, and the recruiting
board. Cleared rather than added to, so a dynasty opened second in a session
draws the world it would have drawn on its own.

It is deliberately not complete: a rival's shortstop who graduated three years
ago is in no roster and in no record book — the book is your program only — so
his name returns to circulation. Since identity no longer rides on the name that
is a repeated name on somebody's bench and nothing more.

### 11.6 The world a save is rebuilt into

A save does not carry its schedule. A schedule is a pure function of the config,
the shape of the world and the rotation, so `fromPortable` rebuilds it on arrival
— which is also the thread boundary, since the sim worker uses the same codec.

The shape of the world used to come from `data/schools.ts` **as it stands now**.
A team is an index in a schedule, so reordering that file, moving a program between
conferences or adding one repointed every index in an existing career: the same
dynasty came back with its team in somebody else's league, playing fixtures that
belonged to a world it had never been part of. Nothing threw. This was A3.

`worldFromTeams` takes the shape off the saved teams instead. Nothing new had to
be written down, because it already was: every `TeamRecord` carries its own
`index` and its own `conference`, and `createSeason` walks the conferences in
order, so grouping the saved teams by conference in order of first appearance
reproduces exactly the world the season was built from. Renaming a program does
not reach an old career either — the `SchoolDef` rides in the save.

Two alternatives were on the table and both were rejected. Refusing to load a save
whose world differs is the cheapest, and it throws away a working career to solve a
problem that has a correct answer. Permanent string program ids everywhere is the
same fix at ten times the size: within one season the indices are already
internally consistent, and the only thing that was ever wrong was where the world
came from.

It also covers a case that was never a save-version problem at all. The world grew
from 64 programs to 96 with no schema bump — legitimately, because a save carries
its own teams — and only the rebuilt schedule made that unsafe. A world the data
file cannot produce at all, such as the small ones the tests build, now round-trips
correctly for the same reason.

---

## 12. Planned systems — **ALL BUT ONE SHIPPED**

This section was written when nothing in it was built. Five of its six entries
have since shipped and now point at the sections that describe the behaviour:
badges and tendencies at §18, the records book at §13, the draft at §14 and
hall-of-fame induction at §19. What is left genuinely unbuilt is the **S+ store
player** (§12.3), and only the player — the gate that reserves the grade for him
is built and measured. The shipped entries are kept rather than deleted because
the gap between what was intended and what was built is the useful part of them.

### 12.1 Badges

**SHIPPED.** See §18.5, which replaced this entry: twenty-three badges in four
families at three tiers, position-aware, capped by ceiling, innate or earned or
coached, and measured at **0.31 points of win probability per gold badge** — a
roster carrying the ordinary complement the generator hands out wins 49.9%,
which is to say no measurable edge at all.

Two things in the plan this entry recorded did change on the way, and both are
worth keeping the provenance of. **The cap ladder is S+ 10, S 6, A+ 5, A 4, B 3,
C 2, D 2** rather than the S+ 7 / S 6 / A 5 / B 4 / C 3 / D 2 sketched here — the
backlog settled it after A+ was inserted into the grade scale, and the store
player's ten is what makes S+ exempt rather than merely top of the ladder. And
the hook this entry pointed at was real and got used: `attemptSteal` records
stolen bases and caught stealing on the catcher's fielding line "where a badge or
an award can find it later", and CANNON is what found it.

### 12.2 Tendencies

**SHIPPED.** See §18.3. Nine slots, five for a hitter and four for a pitcher,
each with two poles held by 21% of the league apiece and every pair averaging to
exactly 1.0 across the population — which is the principle this entry stated,
made into arithmetic a test can check.

The one addition to the principle is worth stating here because it is the line
between the two systems that shipped together: **a tendency redistributes and a
badge adds.** Both can fire on the same pitch. CLUTCH makes a hitter a different
player with a man on second and the same player over a season; GETS HIM IN simply
makes him better there.

### 12.3 S+ potential as a store-only grade

**The gate is SHIPPED. Only the store is planned.** See §1.6 for the mechanism
and the measured distribution; in short, `GENERATED_POTENTIAL_CAP` stops every
generated ceiling at 94 and nothing the world makes on its own can reach the
grade. What remains unbuilt is the player who is *supposed* to hold it: 82
overall on arrival, 99 potential, ten badges, faster progression, exempt from
the badge cap. Deferred to v1.0.

This section previously recorded the opposite — that 0.29% of ordinary
prospects came out S+ and no gate existed anywhere. That was true when it was
written and is the reason the gate now exists.

One question it raised has been answered: the `raw` projectable draw in
`projectPotential` — the 7% of freshmen who get a second large headroom roll,
and the only reason a three star can become a star — **survives the cap
untouched**. It was the thing most at risk, since squeezing the top of the
ladder is exactly how you would kill it by accident. Measured before and after:
about twenty hidden gems per class either way.

### 12.4 A records book

**What exists today (SHIPPED, for the avoidance of doubt):**

- `archiveSeason` writes one `CareerYear` row per player per season into
  `season.careers`. Hitters get AB/H/HR/RBI/BB/SB, pitchers W/L/outs/ER/K, fielders
  chances/plays/errors. A year is written once, so re-entering the offseason cannot
  duplicate it.
- **It runs on the way into the draft step, beside `recordSeasonMarks`** — not at
  the year roll, where it used to. It reads the four roster arrays, and
  `departAndDevelop` strips every graduating senior, drafted junior and walk-on off
  those arrays at the start of the draft step. Archiving afterwards therefore lost
  the entire departing class, every year, and always had: a man's final season,
  which is usually his best and the one a hall of fame really weighs, never reached
  his career at all. Running first also fixes what class year the row is filed
  under — `departAndDevelop` ages every survivor as it goes, so a junior's season
  was being recorded as a senior's. This was A5 in the backlog, and it is why B12
  could not have been built on top of it.
- Every row carries the player's **name**. The book is the last thing in a save
  that remembers a man — rosters are rewritten each June and a departure notice
  survives one offseason — and since §11.5 the id it is filed under is no longer
  the name. `careerName` reads the row and falls back to the id for rows written
  before the field existed, where the id *is* the name. Both the HALL tab and the
  alumnus card on the player screen go through it.
- A row also carries **doubles and triples** since B12. They are there so total
  bases can be computed exactly: the hall of fame prices a career in runs, and
  without them the only available approximation was hits plus home runs, which
  scores every gap hitter in the archive as a singles hitter.
- **The season in progress is a row too, and it is not archived.** The archive is
  written once, in June, so between February and the draft step the year the
  player is actually watching lives in `season.batting` and nowhere else — and a
  card that read the archive alone showed a sophomore his freshman row and
  nothing since. Reported as "after two seasons only one year shows, and the
  numbers do not update in real time", which is one defect seen from two angles.
  `liveCareerYear` (`engine/season.ts`) builds the row this season is going to
  become, from the same private function `archiveSeason` uses so the two cannot
  disagree; the card stacks it under the finished years, marks the year in clay
  and says underneath that it goes into the book in June. Nothing is written: the
  archive is still the only copy and is still written once.
- `HISTORY` (`ui/screens/History.tsx`) is the season-by-season book for the program.
- `PROGRAM → HALL` (`ui/screens/Program.tsx`) is now the men who have been
  **inducted** (§19), with the two career leaderboards kept underneath. They
  answer different questions and both are worth answering: a leaderboard says who
  accumulated the most, an induction says who was great.

**Shipped since:** the all-time book in the other sense — league-wide marks that
persist and can be broken, seeded with real NCAA records (§13), and the career
half of it (§13.6).

### 12.5 Draft declaration and persuasion

**SHIPPED.** See §14, which replaced this entry entirely: real ages, the real
eligibility rule, a twenty-round board, a valuation the clubs can honestly see,
and a screen where you get to talk him out of it.

### 12.6 Hall-of-fame induction

**SHIPPED.** See §19, which replaced this entry entirely: a class decided in June
once the draft has settled, announced in the inbox, and written down for good.

---

## 13. The all-time record book — **SHIPPED**

`src/engine/records.ts`, `recordSeasonMarks` in `src/engine/season.ts`,
`src/ui/screens/RecordBook.tsx`

League-wide across all ninety-six programs, permanent, and seeded with real NCAA
marks so there is something to chase in the first week of the first season.

### 13.1 Why it is cheap

A record book does not need the seasons, it needs the **holders**: fifty-two
rows, each a value, a name, a program and a year — 6 single-game, 3 feats, 19
single-season, 13 career, 6 team and 5 coaching. It opened at thirty-eight; the
career table (§13.6) added thirteen and B6 added REGIONAL TITLES.

Every finished game already
passes through `recordResult`, so a candidate is offered against the standing
mark as it happens and thrown away the instant it fails to beat it. Keeping every
player's line across ninety-six rosters is what would have been expensive, and
none of it is needed to answer "who hit the most home runs anybody ever hit here".

The book lives on `SeasonState.records`, which is what makes persistence free:
`toPortable` spreads the season, so it rides the save with everything else rather
than being a field somebody has to remember to name in `buildSaveFile`.

### 13.2 Where each family is detected, and why there

| Family | Where | Why there |
|---|---|---|
| Single game, player — HR, hits, RBI, runs, SB, pitcher K | `recordGameMarks`, from `recordResult` | The box score of a Tuesday in the Mountain conference is never written down. Both teams' per-player lines exist for about a microsecond, and this is the only moment they do |
| Feats — perfect game, no-hitter, complete-game shutout | same | Needs the opposing team's hit and run totals against one pitcher's out count, which is a per-game fact |
| Single season, player | `recordSeasonMarks`, on the way into the **draft** phase | `season.batting` / `pitching` are already league-wide — they are what the national leaderboards are computed from — so this is a scan of what is in hand, not a new store. A season leader is also not knowable until the season stops |
| Team, single game — runs, hits, margin | `recordGameMarks` | As above |
| Team, season — wins, run differential | `recordSeasonMarks` | Run differential is not monotonic, so a running check would record a mid-season peak |
| Team, longest winning streak | `recordResult` | `TeamRecord.streak` is a running number, correct only at the instant it is set. A season-end scan reads whatever the team happened to finish on |
| Coach career | `recordCoachMarks`, same place | Reads `CoachState`, which lives in the store and not in the engine, plus every `TeamRecord.coach` beside it |

**Why the draft phase and not the year roll.** `recordSeasonMarks` names a holder
by looking him up on a roster, and `departAndDevelop` — which runs on entry to the
draft step — strips every departure off all ninety-six of them. Settled at the
year roll instead, every graduating senior in the country would enter the book
with no name and no program against him, which is the best season most players
ever have and exactly the row a book exists for. So it runs in the last moment the
rosters that produced the numbers still exist. It is idempotent, because a mark
has to be beaten: walking back a step and forward again offers a book numbers it
already holds.

`archiveSeason` now runs in the same breath, immediately before it, and for
exactly the same reason — see §12.4. The archive goes first of the two. Nothing
either one writes is read by the other, so today the order is free; it is fixed
rather than left to chance because career records league-wide (B13) will have the
book read the archive, and that change should not also have to be a reordering.

Two things follow from this. The book is league-wide for free, because
`recordResult` sees every game every program plays. And a replayed or exhibition
game contributes nothing: the whole block is gated on `PlayOptions.record`, the
same flag that decides whether the game counts at all, so one no-hitter cannot be
tallied twice.

**Ties go to the incumbent.** A mark has to be beaten, not equalled. That is the
rule the seeded records need — matching Incaviglia is not passing him — and it is
the only rule whose answer does not depend on the order two identical
performances happened to be evaluated in, which across ninety-six programs
playing the same afternoon is not a fact anybody should have to reason about. The
screen says so at the bottom.

**Rates use the leaderboards' own qualifier.** `qualifiers()` was factored out of
`leaders()` so there is one house convention: two plate appearances per team game
to be batting, one inning per team game to be pitching, with floors of 40 and 15.
A rate that leads the country in June and a rate the book will not accept would
be two different definitions of a season.

**Counts are only offered when there is one to offer.** Without the guard, the
first name out of the map takes an unset category at zero, and "0 stolen bases,
held by a pitcher" is worse than an open row.

### 13.3 The seeded marks, and the two corrections they carry

Twelve, all flagged `ncaa: true` in the data and badged **NCAA** on screen. Each
one keeps its holder, his school and his year, and carries a value corrected for
the league it has to be chased in. The screen says as much, and the line under
each name is what the man actually did.

| Mark | Real | Was | Now | league best | one in |
|---|---|---|---|---|---|
| Batting average, Hagman 1980 | .551 | .551 | **.500** | .463 ± .023 | 15 |
| Home runs, Incaviglia 1985 | 48 in 75 g | 29 | **18** | 14.5 ± 2.4 | 15 |
| RBI, Incaviglia 1985 | 143 in 75 g | 86 | **93** | 80.8 ± 7.0 | 19 |
| Total bases, Incaviglia 1985 | 285 | 171 | **198** | 170.9 ± 15.9 | 17 |
| Slugging, Incaviglia 1985 | 1.140 | 1.140 | **.830** | .757 ± .044 | 16 |
| Triples, Hagman 1980 | 17 in 63 g | 12 | **10** | 8.1 ± 1.3 | 21 |
| Doubles, Hawpe 2000 | 36 | 22 | **30** | 27.1 ± 2.2 | 13 |
| Wins, Loynd 1986 | 20 | 12 | **16** | 14.3 ± 1.2 | 19 |
| Innings, Bannister 1976 | 186 | 112 | **158** | 136.2 ± 12.8 | 16 |
| Strikeouts per nine, Wagner 2003 | 16.8 | 16.8 | **13.5** | 12.0 ± 0.8 | 22 |
| Consecutive scoreless innings, Helton 1994 | 47 | 28 | **32** | 25.5 ± 4.0 | 17 |
| Consecutive games hitting, Ventura 1987 | 58 | 58 | **58** | — | never |

"League best" is the best season ninety six programs produce in a year, mean and
standard deviation over forty four seasons of two independent dynasties
(`tests/records-probe.ts`, `LEAGUE_BEST`). "One in" is how many years this league
needs to beat the seeded value, from a Gumbel fit — a league best is the maximum
of fifteen hundred seasons and the maximum of a large sample takes that shape
whatever the seasons look like, and the extreme-value curve is the one with the
honest upper tail. A normal fit reports every mark as harder than it is.

**Ventura's streak keeps its real number on purpose.** Forty five games cannot
hold fifty eight, so the row can never change hands. One untouchable mark that
exists to be admired is good and more than one turns a game system into a museum,
so it is the only row carrying `RecordSpec.frozen`, the screen prints the reason
instead of implying it is in reach, and nothing anywhere computes a candidate for
it — there is no arrangement of a 45-game season that would produce one. A test
asserts that exactly one row is frozen.

#### The history of this row, which is three revisions long

**One: the marks were seeded scaled by games played.** 45 against the 56-to-75
game seasons they were set in, rates left alone. The decision is in 06-backlog.md
("Records are scaled, not literal") and it was the obvious correction to make.

**Two: seven of the twelve turned out to be unreachable, and the first diagnosis
was half wrong.** The measured league bests were 9 HR, 56 RBI, 111 total bases,
.427, .678 slugging, 5 triples, 18 doubles, 11 wins, 96 innings, 10.9 K/9, and the
diagnosis was aluminium bats against an engine calibrated to modern Division I.
The run *environment* turned out to be right; the curve from a rating to an
outcome was too flat, so the best power hitter in the country earned 1.7× the
league home run rate where real leaders run about 3×. §9.7 fixed the curve without
moving the environment, and the best individual season went from 10 home runs to
12, .431 to .462, .644 slugging to .736. **ERA deliberately did not move**: a
pitcher's spread lives almost entirely in home runs, walks and strikeouts, his hit
suppression on balls in play barely spreads in real baseball either, and a 1.03
earned run average is already better than any Division I leader posts.

**Three: the measurement those numbers came from was of the wrong thing**, and
correcting it changed the answer in both directions.

- **It left out the postseason.** The book is settled on the way into the draft
  phase (§13.2), which is *after* the bracket, and a conference tournament game's
  line goes into `season.batting` like any other — §8.5 says so in one sentence
  and it is the sentence the seeding needed. The man who leads the country is
  by construction on a team that played into June, so he finishes with fifty-odd
  games and not forty five. Over the same forty leagues, counting the postseason
  moves the average league best in innings from 98 to 125 and in home runs from
  11.7 to 13.2. Dividing the real marks by 45 was never dividing by the right
  number.
- **It was taken on generated leagues rather than on a dynasty.** Ninety six
  rosters straight out of `makeTeam` are not the league a record is chased in:
  recruiting concentrates power where a generator spreads it, and a mature
  league's best hitter is a home run and thirty points of slugging past a
  generated one. Two twenty-two-year dynasties, run with every chair on the AI,
  are what the table above is measured on. Neither series trends over its
  twenty two years, so this is a settled league and not one still filling up.

Between them, the book was not what either revision thought. Five rows were
unreachable — home runs at one season in five thousand, slugging at one in a
hundred thousand — and three more were being beaten by somebody in the country in
all but a couple of the forty four seasons measured: doubles, innings and wins.
The innings row is the clearest of the three — the seeded 112 was not once the
best in the country across the twenty two years of the first series, whose
weakest league-leading total was 117.

#### What replaced the scaling, and why it is not one multiplier

Each mark is now set where a genuinely exceptional season lands: **about one year
in fifteen to twenty produces something that beats it**. That is a mark a great
player reaches for once in a career and a long dynasty watches fall two or three
times, and it is measurable, which "scaled by the run environment" was not — the
1985 environment is not a number this project has a source for, and inventing one
would have been a fudge factor with a story attached.

The implied deflators are all over the place, which is the evidence that a single
era ratio would have been wrong: .91 on batting average, .83 on doubles, .80 on
wins, .73 on slugging, .65 on RBI, .375 on home runs. There is structure in that
spread and it is worth keeping:

- **A rate deflates less than a count, because a rate has a floor under it.** A
  .551 average sits on top of a league that hits .270 (§9.6), so only the distance
  above the league is era-sensitive and the correction is small. A home run total
  has nothing under it — an average regular hits two or three — so the correction
  is brutal.
- **The engine's extra bases are not uniformly cold.** Its home run tail is well
  short of the aluminium era and its doubles tail is not: the league's best
  doubles hitter runs about half a double a game, which is what Hawpe's record
  season ran. Scaling that mark down by games played was never going to leave
  anything to chase.

**No row asks for more than the man did.** Every seeded value is at or below the
real one — 18 against 48, .500 against .551, 158 against 186 — which is the
property that keeps these honest as NCAA records with a correction on them rather
than as invented numbers with real names attached. A test enforces it, alongside
one that reads `LEAGUE_BEST` and fails any row whose fitted return period leaves
the ten-to-thirty-year band.

### 13.4 The one piece of extra state

`SeasonState.scorelessOuts`, one number per pitcher: how many outs he has gone
without allowing a run. A streak cannot be reconstructed from season totals — a
man with a 3.10 ERA may have thrown twenty eight straight scoreless in the middle
of it — so this is the only thing the book keeps beyond its holders. It resets
every June, because the record is a single-season one.

It is an approximation and understates: the game line records outs and runs but
not the order they came in, so a start where he is scored on in the seventh ends
the streak at zero rather than crediting the six scoreless innings before the run.

There is deliberately no equivalent for a hitting streak. The mark is 58 and can
never be beaten, so a map of fifteen hundred numbers would be maintained to answer
a question with a fixed answer.

### 13.5 Where it is, and what it does not have

`HISTORY` now has two sheets. **SEASONS** is the program book that was already
there; **THE BOOK** is this. One screen rather than two nav entries for the reason
`Program.tsx` gives in its own header — two record books one tap apart are two
record books that eventually disagree — and it also means the screen is worth
opening in March of year one, when the seasons half is still empty.

A mark set by the program you currently coach is drawn in clay with a rule down
its left edge, the same treatment a leaderboard gives one of yours. A row whose
holder can still be found — a current roster anywhere in the country, or your own
career archive — is a button that opens his card; one whose holder is gone is not,
because a tap that opens an apology is worse than no tap.

**The coaching section is now the whole country.** It was yours alone, and
honestly so at the time: the other ninety five programs had no coach object
behind them, so a rival bench was a strategy and a prestige number rather than a
man with a record. B7 (§16) made them men with records, and a section that still
ranked one career against nothing would have told the player he held every mark
in the country by default — which is the opposite of what a record book is for.
It costs ninety six calls a year of five comparisons each. There is a fifth row
in it now, **REGIONAL TITLES**, which is B6: the postseason has had a regional
round for as long as it has had this shape and nothing anywhere counted winning
one.

**Career records are in it now**, thirteen rows, league-wide. §13.6 is how, and
why it did not cost what B13 was deferred for. Fielding records are still absent:
the ranking statistic is plays above what an *average glove on his own team* would
have made, which does not mean the same thing in two different rows and cannot be
compared across seasons — the same reason `CareerYear` leaves it out.

Saves written before the book existed come up with the **seeded** marks rather
than an empty book. That is a different rule from the other backfills in
`fromPortable`, and deliberately: an empty fielding map is the truthful state for
a save that never recorded a chance, but an empty record book is not — the NCAA
seeds are not something a dynasty earned, they are where every dynasty starts.

### 13.6 Career records, and why they were not expensive after all — **B13**

`CareerTotals` and `recordCareerMarks` in `src/engine/season.ts`.

B13 was deferred for a year because of one sentence: career records need
archiving widened past the user's own program, and archiving the whole country is
the genuinely expensive piece. That sentence was true about the expensive reading
of the problem and false about the problem.

**The same observation the rest of the book rests on applies again.** §13.1 says a
record book does not need the seasons, it needs the holders. One level down, a
*career* record does not need a man's seasons either — it needs his total. So
what is kept is one running row per player on a roster anywhere in the country,
added to each June: at bats, hits, doubles, triples, home runs, runs, runs batted
in, steals; outs, wins, losses, earned runs, strikeouts. Fifteen numbers.

**The pruning is what makes it bounded, and it is free.** The map is rebuilt each
June from the ninety six rosters, so a man who graduated last year is simply not
in the new one — which is safe precisely because his total was final the moment he
left and had already been offered to the book. There is nothing left in the row to
lose. The ledger is therefore the size of the *league*, about twenty four hundred
rows, for ever, rather than twenty four hundred more every season.

**Measured, because the deferral was a cost claim and a cost claim has to be
answered with numbers.** `tests/hall-probe.ts` runs both against twenty seasons of
the full world:

| | after 20 seasons | growth | time per June |
|---|---|---|---|
| The running ledger | 2,530 rows, **308 KB** | none — it is the league's size | 1.4 ms |
| Archiving every program's seasons | 19,128 men, 49,519 rows, **7,526 KB** | ~375 KB a season, for ever | 1.7 ms |

The ledger is 10% of a save that is 2.7 MB with a whole world in it. The archive
would have been almost three times the rest of the save put together by year
twenty, and would still have been growing at graduation — on a phone, through a
structured clone, on every autosave. The time difference is noise; the size is
not, and the size was always the objection.

**One thing genuinely had to be added, and it is the only place a running total
differs from every other pass over a finished season.** The rest of the book is
idempotent for free because a mark has to be beaten rather than equalled, and the
offseason rail can be walked backwards and forwards. A running total is not: fold
2031 in twice and every career in the country gains a season. Each row carries
`last`, the year already counted, and a second pass re-offers the same totals and
changes nothing.

**Thirteen rows, and none of them is seeded.** Batting average, home runs, runs
batted in, hits, runs, steals, doubles, total bases, slugging; earned run average,
strikeouts, wins, innings. `docs/06-backlog.md` section D has the real career marks
and the arithmetic to scale them — Incaviglia's 100 home runs come out near 85 —
and every one was rejected. A career mark is four times a season mark, and §13.3
is the record of how badly a plausible-looking scaling can miss: the same two
corrections would have to be found for each of these against a distribution
nobody has measured, and the season rows took two revisions and forty four
measured seasons to get right. Guessing at thirteen more, in a book whose stated
rule is that exactly one row may be unreachable, was not worth the page of 1980s
names. They start open, and the first man in the country to finish a career takes
all thirteen.

**A career rate qualifies on two seasons' worth** — `CAREER_MIN_AB` = 180 at bats,
`CAREER_MIN_IP` = 90 innings, the single-season bars doubled. A career rate is more
fragile than a season rate rather than less, because a career can be two months
long, and without a floor the career batting record belongs for ever to a pinch
hitter who went nine for sixteen as a freshman. The bar is in *at bats* rather than
plate appearances, which is the one place it reads differently from the
single-season rule beside it: the ledger does not keep walks, because no career
record needs them.

A dynasty from before the ledger existed opens with an **empty** one, not a seeded
one — the opposite of the rule for the book itself, and for the reason the
scoreless streak follows: nobody's career was being counted, so counting honestly
starts now.

---

## 14. Ages, the draft, and talking him out of it — **SHIPPED**

Three things that arrived together because none of them works alone. A real age
is what makes the eligibility rule express itself instead of being faked with a
talent bar. The eligibility rule is what decides who the clubs may take. And
what the clubs pay for him — his round — is what decides whether you can afford
to talk him out of going.

Lives in `engine/draft.ts`, which is new; `engine/progression.ts` calls into it,
`state/store.ts` spends the money, and `ui/screens/Draft.tsx` is the screen.

### 14.1 Ages, and who the draft may take

Every player carries `age`. Freshmen arrive at **18 (80%), 19 (15%) or 20 (5%)**,
hashed out of the player's id by `arrivalAge` rather than drawn — every `rng()`
call in `players.ts` sits in a fixed sequence and spending one on a fact that
decides nothing on the field would move every calibration figure in the project.
`ageFor(id, classYear)` is arrival age plus `CLASS_ORDER`, and it is called again
anywhere a generated player's class year is overwritten (a recruit forced to FR,
a walk-on manufactured as one).

Age advances at the top of `departAndDevelop`, **before** anybody's departure is
decided, because the draft is held in June and eligibility is read at that
moment. Measured over a settled league the classes come out at FR 18/19/20 =
80/16/4%, SO 19/20/21, JR 20/21/22, SR 21/22/23 — so the typical senior is 21,
which is the real thing.

Nothing else in the engine reads it. Not development, not decline, not fatigue.
That is deliberate: the progression rework will want it and must not find
effects already wired in twice.

**The rule.** `draftEligible` is three years completed **or** age 21, whichever
comes first — the real NCAA/MLB rule, and the one chosen on the record in
`06-backlog.md`. So:

| | arrives 18 | arrives 19 | arrives 20 |
|---|---|---|---|
| after FR season | 19 — safe | 20 — safe | **21 — exposed** |
| after SO season | 20 — safe | **21 — exposed** | exposed |
| after JR season | 21 — exposed (and three years in) | exposed | exposed |

Seniors leave regardless; they have no eligibility left.

**Leverage.** Being eligible is not being taken. `draftChance(overall)` is
unchanged — `clamp((overall − 46) / 34, 0, 0.88)` — and it is multiplied by a
discount for the years of eligibility a man could walk back to: **SR ×0.6** (he
signs; whether a club called his name is flavour), **JR ×1**, **SO ×0.35**,
**FR ×0.15**. Those are the numbers the old `UNDERCLASS_BAR` produced, kept on
purpose: the *frequency* an underclassman left at was right, the *reason* was a
fiction. A sophomore with two years to go can cost a club a whole pick by going
back to school, so a club takes him only when it means to pay him.

Measured over nine settled years of the 96-program world: about **8 sophomores
and 1 freshman a year**, against roughly 160 juniors and 48 seniors — 4.2% of
the draft, and weighted about twelve to one toward the good ones, because
`draftChance` still does the sorting (0.71 at 70 overall against 0.06 at 48).

### 14.2 What the clubs can see

`visibleValue(player, season, ctx)` is

```
0.60 × overall  +  0.40 × seasonForm  +  youth  +  disagreement
```

- **`overall`** — what a scout can watch him do now.
- **`seasonForm`** — last spring, on the same 0–100 scale, standardised against
  the league that produced it (`draftContext` takes the mean and standard
  deviation of OPS over hitters with 60+ AB, and of ERA and K/9 over arms with
  20+ IP). Shrunk by playing time — `pa / (pa + 110)` for a bat, `ip / (ip + 32)`
  for an arm — so a huge rate in forty at bats is worth a fraction of the same
  rate in two hundred. A man who never played comes out at exactly 50, graded on
  ability alone rather than punished. Strikeouts are weighted above earned runs
  (0.55 / 0.45) because a run average belongs to a defence as much as to a
  pitcher.
- **`youth`** — `−1.2 × (age − 21)`, clamped to ±3. A club buys the years it gets.
- **`disagreement`** — ±3.5, hashed off the id. Thirty organisations do not agree.

**`potential` is deliberately absent, and that is the load-bearing part.** It is
the one thing nobody outside the program can know. A club that read it would
never take a bust, no first rounder would ever fail, and the coach's private
knowledge of who is going to grow — which is what the whole recruiting and
scouting system exists to sell him — would be worth nothing. A test pins it:
setting a player's potential to 99 or to 15 must not move his value by a single
point.

### 14.3 The round

Twenty rounds of thirty picks, six hundred in all. A man's round is **not** his
rank among our men; it is where he would stand on the national board, which is
fed by high schools, junior colleges and roughly three hundred four-year
programs of which ours are ninety-six.

```
share = 1 / (1 + exp((value − 61) / 6))
round = clamp(ceil(share × 600 / 30), 1, 20)
```

The old rule was `round = floor(i / 32) + 1` over the men the league sent up,
which put everybody in the first two rounds and made a first round pick a thing
every program had two of. Fitted against what a settled league actually
produces — median drafted value 60, ninetieth percentile 70, best in a good year
80 — the distribution comes out, per year, averaged over nine settled seasons of
the 96-program world:

| round | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| men | 1.2 | 3.1 | 6.1 | 6.6 | 7.1 | 6.7 | 8.3 | 9.3 | 12.7 | 12.3 |

| round | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|
| men | 14.8 | 13.4 | 18.1 | 19.1 | 17.9 | 19.1 | 17.9 | 15.4 | 9.2 | 1.1 |

Round one is **1.2 men in the country in a year** — some years four, some years
nobody. Fewer than one drafted man in nine goes inside five rounds. The mass
sits in the teens, which is the honest reading of a courtesy pick.

### 14.4 Talking him out of it

Your own drafted men **with eligibility left** land on `season.draft`, a board
carried on the season rather than in the store precisely because it holds live
player objects who are on nobody's roster while the decision is open. He is in
exactly one of the two places at any moment, so a reload cannot produce two of
him.

**Four cases, one per priority.** `stock` speaks to `development`, `role` to
`playingTime`, `ring` to `winning`, and `word` — the coach's own name and the
place — to `prestige` and `proximity` half each. One case per priority so no two
compete for the same man, which is what makes choosing one a read.

**The arithmetic is `weeklyPoints` again**, deliberately:

```
worth   = offer × affinity × credibility × 5.0
affinity = Σ (his weight on k) × (how much this case is about k)
he stays iff worth ≥ keepPoints(round)
keepPoints(round) = 165 × 0.825^(round − 1)
```

165 in the first round down to 4 in the twentieth. Credibility is read off real
state and every case can be a lie:

| case | credible when | zero when |
|---|---|---|
| `stock` | `0.55 × growth + 0.45 × roomAbove`, times `0.45 + 0.55 × TRAINING reach`. `growth` is headroom above 1, full at 9; `roomAbove` is the round above 3, full at 12. | a finished player taken early — nothing left to teach and nowhere to go |
| `role` | `0.5 + (his overall − best returning man at his spot) / 24` | somebody 12 points better is standing there |
| `ring` | `0.60 × prestige + 0.40 × returning strength` | never quite zero, but a bottom-half program with a gutted roster lands near 0.2 |
| `word` | `0.20 + 0.50 × coach prestige reach + 0.30 × min(1, tenure / 8)` | never — but a rookie's word is worth 0.20 and a fifteen-year lifer's near 0.9 |

**A worked example.** A junior shortstop, 74 overall, taken in round 8, at a
mid-table program with a mid-career coach. `keepPoints(8) = 43`.

- He weighs playing time at 0.42 and winning at 0.11.
- Nobody returning at short is within twelve points of him, so `role` credibility
  is 1.0. Worth per unit: `0.42 × 1.0 × 5.0 = 2.10`. **Price: 21.**
- `ring` credibility at this program is 0.55. Worth per unit:
  `0.11 × 0.55 × 5.0 = 0.30`. **Price: 143.**

Twenty-one against a hundred and forty three. The window is 120–180 depending on
prestige, so reading him costs an eighth of a class and guessing costs all of it
and probably fails anyway. Measured across fourteen simulated years: the best
case available on a man has a median price of **63**, the second best **129**,
and the worst is essentially always unaffordable.

**The money is the recruiting budget.** `windowBudget = budgetFor(stars) × 3`,
so 120 at a one-star program and 180 at a five-star. What the draft takes comes
off **every week** of the board evenly (`weeklyBudget`), not out of week one —
otherwise a coach could keep an ace and recover by waiting. **The offer is spent
whether it works or not**, which is what makes a promise the depth chart
contradicts cost something, and the screen says so before you press.

Anybody left undecided when the phase closes signs with the club that took him:
doing nothing is a decision and it has to mean the thing doing nothing means.

**A man who stays** goes through `reinstate`: class year advances, he takes the
development year he was skipped for on the way out (the user's TRAINING
included), and he is put back through the same `regroup` every other survivor
went through. So **a returning junior is a senior with no leverage next June** —
the bet the coach made on his behalf, and the screen says that too. His
departure notice stays on the board marked `returned`, because being taken in
the fourth round and turning it down is a thing that happened to him; every
count of what you lost skips him, and `report.holes` is recomputed so the hole
he no longer leaves closes while you watch.

### 14.5 What he tells you

Nothing numeric, consistent with how scouting already works. `pullHints` gives
**two prose lines**, one drawn off his strongest priority and one off his
second, hashed off his id so they are stable across renders, and in an order
decided by a third hash so the first line is not always the stronger pull. The
seventeen lines in `PULL_LINES` overlap across priorities on purpose — the same
contract `CEILING_LINES` carries — so a line narrows what he wants without ever
naming it.

A player who came through a recruiting class carries the weights the generator
drew for him (`Player.priorities`, written in `generateClass`). A man nobody
recruited — a rival roster the world started with, a walk-on — gets a set from
`prioritiesFor(id, stars)`, which is the same distribution driven by hashes
instead of the generator. Neither is ever printed.

### 14.6 The screen

`ui/screens/Draft.tsx`, four tabs.

- **KEEP** — the decision. Budget remaining across the header; one card per man
  with his round, the two hints, what a man of that round wants, the four cases,
  a stepper, and afterwards a line saying what the case was worth against what
  it needed. That retrospective is how the hidden multiplier gets learned over a
  few seasons without being printed in advance.
- **DEPARTING** — everything you lost, with the holes it leaves above it.
- **BOARD** — the national draft grouped by round, which is worth reading now
  that round one is one or two names.
- **UNDRAFTED** — seniors nobody called.

The odds fallback (no report yet) now lists everyone the June ahead exposes
rather than juniors and seniors, and it carries the continue button — without
one, a reload mid-offseason landed on a screen with no way forward.

### 14.7 The other ninety five programs

Everything above was, until this shipped, the user's alone. A rival's drafted men
left every June without anybody picking up a phone — an advantage in his favour
that nothing in the fiction supports, since a rival staff has the same phone and
the same reason to use it.

**The blocker was money, not machinery.** `aiTargets` allocated a flat
`ACTIONS_PER_WEEK` (40) a week regardless of what the program was, while the
user's week came off `budgetFor(stars)` (40–60) and had whatever he spent in June
taken out of it. Handing a retention mechanic to a program whose budget nothing
could touch would not have made it a rival; it would have made it a cheat. So the
budget was fixed first.

**One week, one formula.** `aiTargets` now reads
`weeklyBudget(pitch.stars, spentOnTheDraft)` — the same call `boardBudget` makes
for the user. A one-star program works with 40 a week and a blue blood with 60,
and what June took comes off all three weeks evenly rather than shutting week one.
`ACTIONS_PER_WEEK` is now used by nothing.

**A rival's June runs inside `departAndDevelop`**, immediately after `regroup`
closes the roster — because half of what a case rests on is who is coming back,
and a man cannot be told there is a job open on a depth chart that has not been
settled yet.

| | The user | A rival |
|---|---|---|
| Who chooses the case | he does, off two prose hints | `bestCase` — the cheapest of the four that is honestly true |
| Arithmetic | `makeTheCase` | `makeTheCase`, the same call |
| Money | `windowBudget(stars)`, all of it if he likes | `windowBudget(stars) × AI_KEEP_SHARE` (0.4) |
| Coach | his own prestige, tenure and TRAINING | `AVERAGE_STAFF` — 45, 4 seasons, 20: the league-average defaults the recruiting model already gives them |
| Bill comes off | every week of his board | every week of its board, identically |

**The AI reads its own player's priorities, and that is correct.** He has been in
the building for two years. The hint lines model what a *stranger* knows, and the
AI is not a player being asked to make a read — it has nothing to be denied. So a
rival is better than a guessing coach at *choosing* and no better at *paying*,
which puts the whole difference in the money, where both sides have exactly as
much.

**What stops the league hoarding is the bar, not the price.** A nineteenth-round
pick costs about four points — less than one week's attention on one recruit — so
affordability alone had every program keeping everybody it was allowed to, and the
*worst* programs hoarded hardest, which is backwards twice over. `keepBar`
(progression.ts) is the answer: a staff fights only for a man in the **top quarter
of what is coming back**, plus `AI_KEEP_EDGE` (4). The honest reading is that
keeping him spends a roster place as well as the money — `refill` rebuilds to a
fixed twenty three, so a man talked into staying is a recruit not signed.

Measured over eight settled years of the ninety six program world, with every
program on the AI and a full recruiting window each year:

| | |
|---|---|
| exposed to the draft with eligibility left | **1.74** per program per year |
| talked round | **0.32** per program per year — **18% stay, 82% go** |
| most any one program kept in a year | **3** |
| program-years with 2+ exposed that kept them all | **3.7%** |
| mean June spend | **7.8** of a 120–180 window |
| roster churn | **35.5%** a year, against **37.3%** with the mechanic off |

By tier the shape is the interesting part:

| Program | exposed/yr | kept/yr | keep % | June spend |
|---|---|---|---|---|
| ★ | 0.56 | 0.29 | 51% | 3.7 |
| ★★ | 1.51 | 0.47 | 32% | 11.9 |
| ★★★ | 2.51 | 0.36 | 14% | 13.6 |
| ★★★★ | 4.98 | 0.14 | 3% | 6.7 |
| ★★★★★ | 5.46 | 0.29 | 5% | 17.2 |

A small program loses one man every other year and hangs on to half of them,
because its men go late and cost nothing. A blue blood loses five and keeps one
every seven years — **the men it can afford are the ones it does not want, and the
one it wants it cannot afford**, which is the trade the mechanic exists to
produce. The draft remains the thing that levels the league.

**A kept rival goes back through `reinstate`**, exactly as one of yours does:
class year advances, he takes the development year he was skipped for, and
`regroup` puts him back in the roster arrays. His departure notice is marked
`returned`, so the national BOARD tab stops listing a man who is standing on a
college field this minute, and the offseason report's development totals include
the year he just bought.

**What it cost is carried on `DraftBoard.rivalSpend`**, by team index and sparse.
A rival's June is settled the moment the draft is run — it has no screen and no
decision waiting on it — but the bill is paid across the three recruiting weeks
that follow, and the user can close the app in between. It rides on the board
rather than on the team records for the reason the board itself does: it belongs
to this June, and a new season starts with nobody owing anything.

---

## 15. Achievements — **SHIPPED**

`engine/achievements.ts`, hung on `CoachState.achievements`, shown on the COACH
tab and announced through the inbox.

### 15.1 What separates one from a record

A record exists to be broken: it holds a value and a holder, and a better one
replaces it. An achievement has no value and cannot be beaten — you have either
won back to back national titles or you have not, and doing it a third time does
not upgrade anything. So where `records.ts` keeps a sparse map of *marks*, this
keeps a sparse map of *dates*: present means earned, and the entry says when,
where and in one line what it was. **First time wins and is never overwritten**,
which is the rule that makes them different; `offer` gives a tie to the incumbent
because a mark must be beaten, and here the second occurrence is not a candidate
at all.

They belong to the coach rather than to the program and travel with him. The book
next door is the league's; this is one man's.

### 15.2 The ten, and where each is detected

The awkward part is *when*. A comeback is a fact about the seventh inning of one
Tuesday, a streak is a running count only ever correct at the instant a game ends,
a draft pick is a fact about June and a title is a fact about its last day. A
single scan at the end of the year can see none of the first two. So there are
four doors.

| Achievement | Earned by | Detected at |
|---|---|---|
| **Perfect Conference** | undefeated in league play (`cw > 0` and `cl === 0`) | `awardSeason`, at the board meeting |
| **Cinderella** | the national title at a program of 2 stars or fewer | same, off `review.prestigeBefore` |
| **Dynasty** | the national title in consecutive seasons | same, off the last row of `history` |
| **Grand Slam** | conference, regional and national title in one year | same |
| **Lifer** | 15 seasons at one school | same, off tenure *including* this one |
| **Builder** | one star to five without leaving | same, `arrivedPrestige` against now |
| **Kingmaker** | one of your men taken first overall | the draft step, off the top row of the sorted national board |
| **Recruiter** | signing the number one recruit in the country | the week he commits, off `Prospect.rank` |
| **Iron Will** | winning after trailing by 6 or more | `recordResult`, into `season.feats` |
| **Streak** | 20 consecutive wins | same |

**Why Kingmaker is read at the draft step and not on the draft screen.**
`returned` is written the moment a coach talks somebody round, and a man who goes
back to school was still taken first overall. **Why Recruiter is read at the
commit and not at signing day.** `rank` is a fact about the class as published,
and the class is regenerated at the year roll — by signing day the man is on a
roster and the board he was ranked on is gone.

### 15.3 The evidence a season leaves

`SeasonState.feats` is two integers — the largest deficit come back from in a
win, and the longest winning streak — for the user's program only, reset with the
season. Exactly the same argument as `scorelessOuts` beside it: the numbers cannot
be reconstructed at the end of the year, because the box score of a Tuesday is
never written down and `TeamRecord.streak` reads whatever April left it on.

`largestDeficit` walks the two line scores **half inning by half inning**, not by
whole innings. A side that goes down seven in the top of the first and answers
with eight in the bottom was never behind on a whole-inning reading, and it
plainly was.

### 15.4 The user's coach only

Rival coaches have careers (§16) and could in principle earn these. Nothing would
ever read them: there is no screen for another man's cabinet, and an inbox
announcing that a coach in the Mountain conference had gone twenty straight is
noise rather than news. A list nobody reads is still a list written to disk ninety
five times a year.

### 15.5 On the screen

The COACH tab grows an ACHIEVEMENTS panel listing **only what has been earned** —
deliberately no greyed rows for the rest. Ten rows with eight crossed off is a
checklist, and a checklist on that page is a set of instructions about how to play
a game that is supposed to be about running a program. What is unearned is simply
absent, and the note under the panel says what the panel is: earned once, kept for
ever, wherever you coach next.

---

## 16. Rival coaches and the carousel — **SHIPPED**

`engine/rivals.ts`, hung on `TeamRecord.coach`, run once a year from
`settleSeason`.

### 16.1 The problem

You were the only coach in the country who ever got better. Your training skill
grew, your recruiting skill grew, your reputation opened doors — and the ninety
five programs you were competing against were run by nobody at all, permanently,
at a fixed standing no result could move. `nextPrestige` had existed since the
board did and **only your school was ever passed to it**, so the other ninety five
were frozen at whatever the world generator gave them.

That is a snowball with no brake. Worse, it is a snowball the game cannot
describe: a rival who beats you is a row in a table, and there is nothing there to
be poached, sacked or beaten twice.

### 16.2 What a rival carries, and why each field is there

Fifteen numbers and a name, times ninety five, is about four kilobytes in a
megabyte save — so size was never the constraint. What decided the list is
whether anything reads the field.

| Field | Read by |
|---|---|
| `name`, `careerWins/Losses`, `titles`, `conferenceTitles`, `regionalTitles`, `tournaments` | The inbox line and the record book. This is what makes "Hollis Ward, two conference titles, leaves the Mountain for a five star job" a sentence instead of an index |
| `prestige`, `security`, `tenure`, `contractYears`, `contractLength`, `badRun` | `reviewSeason` and `canBeHired`. The machinery |
| `skills` | The simulation: the bench edge in every game, how far his returning players develop, how hard his pitch lands on a recruit |
| `age` | The only thing that eventually empties a good chair whatever the coach does |
| `lean` | Which skill he over-invests in, fixed for life |

Three things are deliberately **absent**. No unspent points — he spends them the
moment he earns them, and a rival's unspent point has no reader. No philosophy —
`strategyFor` already gives every program a bench personality seeded off its
index, and layering a coach's preference over it would make a program's style
flicker every time it changed coaches for reasons the player can never see. No
achievements, for the reason in §15.4.

### 16.3 Everything is reused, and nothing is drawn

`reviewSeason` grades a rival exactly as it grades you, `judge` reads the same
checklist, `nextCoachPrestige` moves his standing on the same arithmetic including
the B5 penalty, `nextPrestige` moves his program, `canBeHired` decides who will
have him, and `skillPoints` pays him at the same rate. `reviewSeason` takes a
narrow `Reviewable` rather than a whole `CoachState`, which is what lets one
function grade ninety six careers; the alternative was a fake `CoachState` per
rival carrying a face, a home state and a philosophy invented to satisfy a type.

Two things and only two are different, and both live in `Board` — see §16.10.

**Nothing here draws from the generator.** The same decision the AI's draft
retention made and for a sharper reason: this runs once a year against ninety five
programs, and spending draws would move every recruiting class and every
development roll in the game by an amount that depends on how many coaches
happened to be sacked. Names are hashed off the chair and the year, retirement age
is hashed off the name, and every decision is a fact about a program and a man. A
test asserts `season.rng.state()` is unchanged across a whole rival year.

### 16.4 They are not superhuman

A rival earns the points a season pays you and **spends them worse**: half into
the one skill he happens to favour, the rest scattered over the other three. A
coach who allocated optimally for twenty years would end up better than a player
who did anything else with his attention. Measured over thirty five seasons of the
full world, the country's average rival recruiting skill plateaus near 30 and then
drifts *down* as churn resets careers — against a player who can reach 99 in one
skill by concentrating. That is the same rule the draft was built to: the AI is
allowed to be competent and is not allowed to be right.

### 16.5 The year

Run from `settleSeason`, at the same moment your own board sits down, because that
is when everything it needs is in hand: the postseason is settled, the regular
season records are frozen, and no roster has been touched. At the year roll
instead it would judge coaches against teams that had already graduated.

1. Each chair gets a `SeasonOutcome` from `rivalOutcome` — the *regular* season
   record, so a deep June does not raise the target it is measured against. Rank
   is taken off conference record and run differential rather than the full
   `seedTeams` chain: worth the work for one program, not for ninety five, and the
   only thing a board reads off it is which band the finish falls in.
2. `reviewSeason`, then the program's prestige moves and the coach's career,
   standing, seat, contract and skills all update.
3. **Retirement is checked before sacking and beats it.** A man let go at sixty
   eight has retired whatever the minutes say, and reporting it the other way
   round would leave the market carrying candidates who will never work again.
4. Sacked coaches go into a pool. `runCarousel` then fills every empty chair.

### 16.6 The carousel

Best chair first, so the top of the league picks before the bottom does. For each
vacancy the shortlist is the pool plus every sitting coach at a program at least
`POACH_GAP` below it, and the best available takes it; a poach empties the chair
he came from, which is offered on the next of three passes. A board that cannot
get anybody who clears its bar **hires the best available anyway** — the truthful
outcome, and the only one the rest of the engine can handle, since a program with
no coach recruits at nobody's skill for ever.

Two brakes, both measured:

- **`POACH_GAP` = 26**, two star tiers. Measured twice. The first sweep — six
  against ten, over twenty two seasons — was taken while the boards were sacking
  a third of the country, so nearly every chair on the market was one a board had
  just emptied and the gap was holding back a flood. With the flood gone the same
  sweep gives different answers: over thirty five seasons of the full world,
  chairs changing hands per year come out at **19.0 at a gap of 10, 14.8 at 16,
  12.1 at 22 and 11.8 at 26**. Twenty six buys the thing the mechanic is for — a
  poach is a promotion, a man leaves a two star program for a four star job rather
  than the three star next door. The curve is flat above twenty two; what is left
  is sackings and old age.
- **`SETTLED_TENURE` = 10.** After ten years in one chair he stops listening. It
  is true, and it is what allows a rival to become a fixture — without it every
  good coach is eventually pulled up the ladder and the league has no equivalent
  of the man who *is* the program.

`retireAge` is **64 to 72**, hashed off the name. It was 62 to 70, which was two
years early and only became visible once the boards stopped sacking everybody
first: against a hiring age averaging forty five it retired three and a half men
a year out of ninety six where the real sport loses about two to age and to
leaving the profession.

A coach's `badRun` is cleared when he changes chairs. His new board is by
definition unconvinced by the last one's read of him, and leaving it on would have
him sacked in two years for seasons somebody else's programme produced.

**A sacked coach who is not re-hired the same June leaves the profession.** The
pool is local to one call. It is a simplification and a deliberate one: a
persistent unemployed list is state that grows for ever to model men nobody will
ever see again.

**And the chair that sacked him is the one chair he cannot have.** The pool
carries `FreeAgent.from` for that single rule. It could always go wrong and it
never showed: while the boards were emptying fifteen chairs a year, a program's
own reject was never the best thing on the market. At five sackings the market is
thin enough that he is, and Bayou State was observed dismissing Calvin Boswell in
May and hiring him in June — a measurement bug and a fiction bug that turned out
to be the same bug.

### 16.7 Where a rival coach reaches the simulation

| Channel | Where |
|---|---|
| Bench edge in every game his team plays | `syncCoachMods` writes `TeamRecord.coachMods` for all ninety six. `applyCoachMods` used to clear the field and write one row |
| How far his returning players develop | `departAndDevelop` reads `record.coach.skills.training` where before every rival was a flat 20 |
| How hard his recruiting pitch lands | `seedRivalInterest` and `advanceRecruitingWeek` pass his prestige and recruiting skill to `aiTargets` and `weeklyPoints`, where both used to be hardcoded 45 and 20 |
| What he can promise a drafted player | `departAndDevelop` builds the `CoachRead` from him rather than from `AVERAGE_STAFF` |
| Which jobs you are offered | `jobOffers` takes an `isOpen` predicate; the store passes "empty, **or** held by a man the country rates below you". Not "empty" alone — the carousel never leaves a chair open, so that produces a market of nothing and a sacked career with no way forward. Taking one moves the incumbent on, and the inbox says so |

`AVERAGE_STAFF` survives for the honest gap: a world that has never been through
`seatCoaches` — most of the test suite, and any save written before B7. A program
with nobody in the chair negotiates like nobody in particular.

### 16.8 Seating, and your chair

`seatCoaches(season, userTeam, year)` is the one door: a new career, a load, and a
job accepted all go through it, so there is a single answer to who is running the
other programs. It is idempotent — a chair that already has a man keeps him —
which is what lets it run on every load without wiping a fifteen year carousel.
**Your chair is emptied** and the man displaced is handed back, because a board
sacking its coach to make room for you is news, and because leaving a rival
sitting in a chair the game ignores goes wrong the moment you are sacked out of
it.

They are seeded at what their programs are worth rather than all as unknowns. A
league of ninety six rookies would open the entire hiring ladder to whoever won a
game first, you included.

### 16.9 What it does to the league — measured

Thirty five seasons of the full ninety six program world, every chair on the AI,
seed 20260825. Reproduce with `npm run carousel -- 35 20260825`
(`tests/carousel-probe.ts`), which prints every row of this table and the
per-year breakdown behind it.

| | Seeded | Peak | Year 35 |
|---|---|---|---|
| Mean program prestige | 40.9 | — | **51.4**, flat from year 18 |
| Program prestige SD | 15.4 | 18.0 (yr 16) | **17.1** |
| Top five average prestige | 74.6 | — | **91.2** |
| Bottom five average | 20.4 | — | **27.8** |
| Star distribution 1–5 | 46/20/16/11/3 | — | 25/23/22/12/14 |

It converges. The spread widens by two and a half points as the boards start
biting, peaks around year sixteen and comes back down; the mean is flat for the
last eighteen seasons. **Talent spread narrows** the whole way, which is the
number that would show compounding first, because recruiting is zero-sum against a
fixed class and none of this work touched it. The bottom of the ladder comes *up*
by seven points and the top plateaus below its own clamp. Seventeen different
programs won the title on this seed, twelve on 4242.

**The carousel, per year out of ninety six**, at each of the three states it has
been in. "Split" is §16.10; "capacity" is the checklist fix in §6.3a. Two seeds,
thirty five seasons each.

| | One board | After the split | After the capacity fix | Real sport |
|---|---|---|---|---|
| Chairs changing hands | 30.4 | 11.5 / 11.9 | **9.2 / 9.3** | 8–12 |
| — sacked | 15.4 | 5.6 / 6.0 | **4.5 / 4.3** | ~5 |
| — poached | 11.4 | 2.8 / 2.8 | **1.7 / 1.9** | ~3.5 |
| — retired | 3.5 | 3.1 / 3.1 | **2.9 / 3.1** | ~2 |
| Mean tenure, seasons | 1.9 | 5.8 | **7.0** | 8–10 |
| League-wide clear rate | 27% | 55.6% | **63.2 / 63.8%** | — |

Poaching fell with the sackings and that is not a coincidence: a market nobody is
being tipped into is a thinner market, and a chair that is not empty cannot start
a cascade. The remaining gap to the real sport's tenure is age — this world's
coaches retire between 64 and 72 against a hiring age averaging 45.

Calming it cost the convergence almost nothing — the prestige spread peak moved
by two tenths of a point at the split, and the spread at year 35 is 16.5–16.8
after the capacity fix against 16.9–17.1 before it. The churn was never what was
holding the league together.

### 16.10 The seam: your board and the other ninety five

Everything above was graded by one board until it was measured across ninety five
programs at once and turned out to be sacking three times as many men as the real
sport. The split that followed is **two fields on `Board`**, both constructed at
the seam in `program.ts`, immediately under `expectationFor`. `reviewSeason` takes
a `Board` and defaults to `playerBoard`, so every call in `state/store.ts` is
unchanged and unchangeable by accident.

**Difference one: which league the checklist is read against.** Every number in
`expectationFor` was calibrated against the world `createSeason` hands over, and
neither of its two inputs stays there:

| | Seeded | Settled |
|---|---|---|
| Mean program prestige | 40.9 | 51.4 |
| Mean roster strength | 44.7 | 55.2 |

The prestige half is the arithmetic error the previous pass found — `nextPrestige`
drifts a program toward `seasonScore`, whose league mean is 51, while
`initialPrestige` seeds at 41. The roster half is larger and has nothing to do
with coaches: the progression and recruiting pipeline settles ten points above
what the generator seeds. Both feed `standing = prestige × 0.45 + roster × 0.55`.

The damage is mostly **not** the mandate mix; it is the win target, because wins
are zero-sum and the target is not. Forty five games between ninety six programs
produce 22.5 wins a program however good everybody gets, and the fitted line asks
for more as the roster number rises: at the seeded distribution the league is
asked for 18.1 and wins 22.5; at the settled one it is asked for **23.6** and
still wins 22.5. `wins` is a required box under every mandate and it was missed by
**53 of 96 programs a year**.

`rivalExpectation` translates the program back onto `CALIBRATED_LEAGUE` and calls
`expectationFor`. A shift, not a rescale — it cannot reorder the league or change
what a roster point is worth, only "compared to whom". The two references:
`prestige: 41` is what `initialPrestige` produces over the school table, pinned by
a test; `roster: 49` is not measured at all but derived, `(0.5 + 0.128) / 0.01284`
— the roster `expectationFor`'s own fitted line says goes .500, which is the only
honest reference for a zero-sum quantity. A test asserts that at
`CALIBRATED_LEAGUE` the two functions are indistinguishable over 225 programs.

**Difference two: the second bar.** With the arithmetic corrected the boards clear
56% and still sack 7.5 of 96 a year. (The missing seven points were the checklist,
not the league it was read against, and are closed in §6.3a; closing them did not
touch the argument below, and the boards clear 63% and sack 4.4 now.) That residue
is not an error; it is what the
player's board *is*, seen ninety five times at once. The part that does not
survive the multiplication is the second firing bar: `SACK_BAR` at 20, where they
stop the car, and `PLAYER_RENEW_BAR` at 45, where a deal running out is simply not
renewed. The band between them is a good device for one career — the contract
ticking down while you try to convince them is a story. Across ninety five
programs it is a scheduled cull, because the median coach's security is a
near-driftless walk that spends a third of its life in that band and gets fired by
the calendar every three to five years. **A rival board has one bar**: it sacks a
man it has seen enough of and re-signs everybody else, which is simpler than the
player's rule as well as closer to what athletic directors do.

Nothing else about patience differs. The security deltas, the sacking bar, the
first-year grace and the escalating bad-run penalty are all the player's, which is
why a rival who fails three seasons running loses his job on exactly the
arithmetic that would lose the player his.

**The player's board did not move at the split**, and this is pinned rather than
asserted: the same sweep of 4,500 reviews — 225 programs × 5 seasons × 4 seats —
was run against `program.ts` before and after and came out identical to the digit.
Those literals are the test, in `program.test.ts` under "your board, pinned".

**It moved once since, deliberately**, when §6.3a took the national bid off the
required list. The literals were re-recorded and what moved is worth stating,
because it is the evidence that the change was surgical rather than a retune:

| | Split | Capacity fix |
|---|---|---|
| exceeded / met | 1564 / 472 | **1636 / 400** |
| missed / failed | 724 / 1740 | **724 / 1740** |
| wins asked for | 107,620 | **107,620** |
| security moved | −15,971 | **−15,179** |
| sacked / not renewed | 1232 / 553 | **1232 / 535** |
| extended | 1173 | **1227** |

`missed`, `failed` and the wins asked for did not move at all, and neither did the
sackings. Every review that failed a required box before fails exactly one before
and after: a contender that used to miss the bid now misses the top three instead,
and a championship board's conference title is the same event as the bid it
replaced. What moved is 72 reviews from `met` to `exceeded`, because a contender
now carries three bonus boxes where it carried two, and the security and contract
totals that follow from those 72. **The win target was not touched**, which is the
whole point: a clear rate closed by lowering the number beside an impossible box
would have hidden the incoherence rather than removed it.

The sweep's fourth season was corrected on the same commit. It reached the
national field without winning its conference, which this format cannot produce —
the field *is* the eight conference champions — and the contradiction was free
until a board started requiring the title.

---

## 17. The inbox — **SHIPPED**

`engine/inbox.ts`, `ui/screens/Inbox.tsx`, HOME · INBOX.

### 17.1 Why

Everything worth telling a coach was already being told badly. A job offer sat on
the program page waiting to be noticed. A board verdict lived on one offseason
screen and was gone the moment the step advanced. Your men being drafted was a
screen you pressed through. Achievements did not exist. And the ninety five
careers §16 just started had nowhere to go at all, which would have made the whole
carousel invisible — ninety five men living lives the player never hears about is
the same as ninety five men not existing.

Two failure modes, opposite and both real: the modal that interrupts you to say
something you did not need at that moment, and the thing that never surfaces. An
inbox answers both. It accumulates, it is visible as a count from wherever you
are, and **nothing in the game waits on it being opened**.

### 17.2 It is not the wire, and it sits beside it

They answer the same question about different things with different lifetimes.
`wire()` is derived fresh from the live season on every render and thrown away: it
is the country's news, it is about nobody in particular, and a row of it stops
being true the moment another day is simulated. The inbox is written down once, is
about you, and survives fifteen years and a reload.

Folding one into the other would put a row that evaporates when you press "next
day" in the same scroll as a row from your first season, under one heading, with
two different rules for disappearing. Two screens on the same tab is the honest
shape: same question, next to each other, still distinguishable. HOME therefore
carries TODAY and WIRE; since the interface overhaul (§20) the inbox is the bell
on the top bar — reachable from every frame, offseason included — and the
scorebook is where PLAY BALL takes you, so neither needs a nav door of its own.

### 17.3 What files, and at what volume

| Kind | Posted by |
|---|---|
| `board` | The verdict, every year, plus a separate card whenever the B5 run penalty fires |
| `offer` | Each job on the market the year you are let go |
| `achievement` | Each newly earned one, with its own line |
| `draft` | How many of your men were taken, and Kingmaker if it fired |
| `carousel` | Coaching changes |
| `hall` | The induction class, once a June, and only in a June that has one |
| `record` | A mark in the all-time book with your program's name on it, set this year |
| `season` | A run of six wins or five defeats, and the RPI rungs — top 25, top 10, first |

`hall` is the one kind that is about somebody other than the coach, and it has its
own row rather than being folded in with `achievement` for exactly that reason: an
achievement is a thing he did, an induction is a thing a man who played for him
earns. It is the only card here that fires in most years and not all of them,
which is the point of it — see §19.

The carousel is the one that needed a volume rule, because ninety five careers
produce five to twenty moves a year and posting all of them would bury the four
items that are about you. Two rules:

- **Your conference gets named.** Eleven programs whose games decide your season;
  a change of coach at one of them is a change to your league.
- **Everybody else gets counted**, in one line. Honest summary of news you cannot
  act on, and enough to say the country is alive.

A poach in or out of your conference is named at both ends, because a rival being
taken by a bigger school is the single event the system exists to produce and
should never be a number in a total.

### 17.3a The season's own news — the four in-season writers

Reported: "the inbox stayed empty for a whole season." It was. Every writer in
the table above fires between the last game of one year and the first of the
next, so the notification centre with a badge on the nav had nothing to put in it
for the four months anybody was looking at it, and showed its empty state to a
coach thirty games into a season.

Four writers now run during the season, all in `seasonNews` in `state/store.ts`,
called from every action that moves the calendar — `advanceDay`, `playSeason`,
and the end of a managed game.

| Card | Fires |
|---|---|
| `record` | any mark in `season.records` carrying your abbr and this year. The coaching section is skipped: those marks are re-offered every June for as long as you hold them, so they would post the same card a year for fifteen years, and the cabinet says it better |
| `season`, a run | the longest run of wins reaches 6 or 10, or of defeats 5 or 9. Only the longer rung of the two is filed |
| `season`, the poll | the RPI reaches the top 25, the top 10, or first — best rung only, and not before twelve games |
| `board`, the halfway word | at the midpoint, the record at the turn against the number the board asked for in February. **The one card that fires every season**, and the reason one has to: a year in which the inbox says nothing until June teaches a player not to open it |

**Every one of them is a scan, not an event, and that is the load-bearing
property.** `playSeason` hands back a finished year from a worker, so nothing may
be read off state that is only correct at a moment — not `TeamRecord.streak`,
which says whatever the season happened to end on, and not the current record.
They read the game log instead, count the bracket games off the end with
`regularRecord`, and post through keyed ids (`newItem`), so a season simmed in
one press files the same cards as one walked through a game at a time and a scan
that runs fifty times files each card once. `tests/store.test.ts` pins both.

### 17.3b Where a card goes when you tap it

"A notification you cannot act on is pointless", and every card was one. A card
now carries an optional `InboxLink`, a small closed set rather than a route:
`player`, `team`, `program` (with a sheet), `book`, `schedule`. Cards with no
sensible destination — how many of your men were drafted is not a place — carry
no link, render as a flat card with no arrow, and do nothing. Which is which is
visible before it is tapped.

Every destination is an overlay or a card, because all three frames the app can
be in have to honour it. That is also why the **inbox itself is an overlay now**,
reached from a button in the top bar that carries the unread count: it was a HOME
sub-screen, and HOME does not exist during the offseason or the postseason — the
one stretch of the year when the verdict, the offers, the draft, the hall and
every coaching change in the country are landing in it. The program page and the
record book joined it as overlays for the same reason: they are where the cards
point. (The postseason frame carries no top bar of its own and is the one place
the button does not appear; it is four presses long and posts nothing.)

Links are validated on the way off the disk like the rest of the card — an
unknown target is dropped rather than reaching the screen as something that looks
tappable and is not.

### 17.4 Reading, and the badge

Opening the screen marks everything read, on arrival rather than on the way out —
the app unmounts a screen on a tab change, a phase change and an overlay, so
marking on unmount would clear the badge for a player who tapped INBOX and
immediately tapped away. There is no per-card tick: a card with a chore attached
is a chore, and reading is not supposed to be one.

Unread shows twice. The sub-nav prints the **count**, because "three things
happened" is worth crossing the screen for and "something happened" is not. The
bottom nav prints a **dot** on HOME, because that is the only mark that survives
being three screens away from where the player normally is.

### 17.5 Size, ids and the disk

Capped at `INBOX_LIMIT` = **80**, oldest dropped. A twenty year career posts
somewhere near two hundred items, which is a scroll nobody reaches the bottom of
and a chunk of a save spent on things read once. Eighty is roughly six seasons.
Nothing is *only* here: the history screen has every season, the record book every
mark, the coach page the cabinet.

Ids are a plain counter, not the clock. `tests/architecture.test.ts` forbids the
engine reading `Date.now` — a seeded replay has to produce the same world twice —
so `restoreInbox` winds the counter past whatever the save came back with instead.
Two cards with the same React key is a list that reorders itself.

The inbox is the one thing in the save that exists nowhere else. Everything it
reports has a permanent home, but **whether the player has read a given card** does
not, and dropping it would bring the badge back on every restart.

---

## 18. The situational layer: repertoires, tendencies and badges — **SHIPPED**

`src/engine/pitches.ts`, `src/engine/tendencies.ts`, `src/engine/badges.ts`,
`src/engine/traits.ts`, `src/engine/game.ts`, `src/engine/engines.ts`,
`src/engine/progression.ts`, `src/ui/screens/Player.tsx`,
`tests/traits.test.ts`

Three systems that sit on top of the ratings without being ratings. They shipped
together because they depend on each other in one direction: a pitch-usage
tendency needs a repertoire to be read off, and a badge has to be sized against
what a tendency already does in the same spot.

The dividing line runs through all three and is worth stating before anything
else. **A rating says how good a man is. A tendency says what he is like, and
redistributes. A badge says what he is good at in one named spot, and adds a
little.** CLUTCH makes a hitter a different player with a man on second and the
same player over a season; GETS HIM IN simply makes him better there. Both can
fire on the same pitch and they are doing different jobs.

### 18.1 What is stored, and what is not

Only badges. A repertoire and a tendency are pure functions of the player's id —
hashed exactly the way `arrivalAge` is (§14.1, index 47a) and for the same
reason: every `rng()` call in `players.ts` sits in a fixed sequence, and one draw
per pitcher per fact would have moved every calibration figure in the project.
Nothing about them is written to a save, nothing can drift on a reload, and a
dynasty carried forward from before they existed gets them for free.

Badges cannot work that way, because a badge has a history: some are innate,
some are earned from what a man actually did, some are coached, and none of them
decay. So `Player.badges` is the one new field in the save, it is optional, and a
player written before it simply holds none.

### 18.2 The pitch palette — B16

Eleven pitches, with real abbreviations because that is what a scouting report
uses:

| Family | Pitches |
|---|---|
| Fastballs | Four-seam `FF`, Sinker `SI`, Cutter `FC` |
| Breaking | Slider `SL`, Curveball `CU`, Slurve `SV`, Screwball `SC` |
| Offspeed | Changeup `CH`, Splitter `FS`, Vulcan change `VU`, Knuckleball `KN` |

**Every pitcher's repertoire is his own.** He carries two to five of them, never
all of them, with a usage share per pitch that sums to one and is printed on the
card. Measured over four thousand generated arms: 3,402 distinct repertoires out
of 4,000, and a carry rate that keeps the ordinary pitches ordinary and the
curiosities rare — slider 60%, changeup 63%, curve 53%, sinker 39%, slurve 19%,
cutter 17%, splitter 13%, vulcan 4%, screwball 4%, **knuckleball 1.2%**.
Repertoire length runs 2 (7%), 3 (51%), 4 (36%), 5 (5%).

Three rules shape a repertoire, and each exists because the naive version
produced something that was not a pitcher.

- **A knuckleballer gets his own branch.** Generated through the ordinary path he
  came out with a 12% knuckleball and a slider, which is not a knuckleballer. He
  throws it 70 to 84 percent of the time and keeps a fastball around to remind
  hitters it exists.
- **There is only one *kind* of slow pitch.** Offering changeup, splitter and
  vulcan off one weighted table and refilling from what was left put a vulcan on
  one arm in five. A pitcher has a change of pace and it has a flavour: 84%
  changeup, 10% splitter, 6% vulcan.
- **No secondary pitch is the pitch he throws most**, capped at 42%. The first
  weighting produced a man throwing 59% changeups, which is not a junkballer, it
  is an arithmetic accident. Slider-first relievers survive the cap, which is why
  it is 42% rather than "under the fastball".

`speedOf` derives each pitch's velocity off the man's own fastball, which the
generator already ties to `stuff` — so the change of pace on the card agrees with
the radar-gun number in the panel above it.

**Does it reach the simulation?** Yes, through exactly one door: the POWER ARM
and JUNKBALLER tendency below is read off the finished usage shares rather than
hashed. That is what makes the usage share real data rather than a caption — a
number something consumes.

### 18.3 Tendencies — B11

Nine slots, five for a hitter and four for a pitcher. Each hands its plus pole to
21% of the league, its minus pole to 21%, and nothing to the 58% in between.

| Slot | Plus pole | Minus pole | What moves |
|---|---|---|---|
| `approach` | FREE SWINGER | PATIENT | walks -22/+22%, doubles and home runs +5/-5%, strikeouts +5/-5%, pace |
| `firstPitch` | HUNTS STRIKE ONE | TAKES STRIKE ONE | singles +4/-4%, walks -8/+8%, pace |
| `running` | GREEN LIGHT | STATION TO STATION | steal attempts x1.70/x0.30, extra bases x1.20/x0.80, thrown out x1.30/x0.70 |
| `spray` | PULL-HAPPY | USES THE WHOLE FIELD | the pull lane x1.28/x0.75, and how a shift reads him |
| `clutch` | CLUTCH | TIGHTENS UP | every offensive event +5.5/-5.5% with a man in scoring position, -1.74/+1.74% without |
| `zone` | ATTACKER | NIBBLER | walks allowed -18/+18%, home runs +7/-7%, singles +2/-2%, pace |
| `pace` | QUICK WORKER | DELIBERATE | pitches per at-bat -5/+5%, and the third-time-through penalty +25/-25% |
| `mix` | POWER ARM | JUNKBALLER | strikeouts +9/-9%, home runs +8/-8%, ground balls -11/+11% |
| `poise` | BEARS DOWN | LOSES THE THREAD | the clutch channel, from the mound |

**Every pair averages to exactly 1.0 across the population**, which is the
property that stops a tendency being a rating, and `tests/traits.test.ts` asserts
it on every channel. Two consequences of taking that seriously:

- **Clutch is priced, not asserted.** A runner is in scoring position for about a
  quarter of plate appearances, so a +5.5% lift there costs -1.74% over the other
  three quarters and the season line does not move. `CLUTCH_DIP` is that
  arithmetic, not a chosen number.
- **The running pairs were wrong once and it mattered.** `risk` was 1.35 against
  0.75, which reads as a fair trade and is not one — the mean is 1.021, and the
  league quietly retired two percent more runners on the bases than it had before
  tendencies existed.

**Pace is the exception to "neutral means harmless", and it was cut back for
it.** Every other channel is a multiplier on an outcome, so a neutral pair leaves
the league where it was. Pace is not an outcome: it is how many pitches an at-bat
takes, and pitches decide when a starter is pulled and when he starts losing
effectiveness, neither of which is linear in the count. At the first sizes tried
the league's walk rate drifted about 1.3% low, because shorter at-bats keep
starters — who throw more strikes than relievers — on the mound longer. The pace
pairs are about 40% smaller than they were.

The spray tendency is the one that needed the fielding rework (§10). Before there
were real batted-ball lanes there was nowhere to put a spray chart.

### 18.4 Discovery: you learn a man by watching him

**A tendency on your own player is not visible on the day he signs.** This is the
user's decision and it is a mechanic rather than a display rule: what accrues is
*evidence*, in the unit the reading is actually made of, and a reading only
becomes something the card will say out loud once there is enough of it.

| Slot | Unit | Needs |
|---|---|---|
| `mix` | batters faced | 60 |
| `firstPitch` | plate appearances | 70 |
| `running` | times on base | 40 |
| `spray` | balls in play | 100 |
| `approach` | plate appearances | 120 |
| `pace` | batters faced | 120 |
| `zone` | batters faced | 200 |
| `clutch` | plate appearances | 300 |
| `poise` | batters faced | 450 |

A regular takes about 200 plate appearances a season and a Friday starter faces
about 330 batters, so the mix and the first-pitch read arrive inside a month, the
approach and the spray chart by midseason, the pace and the zone late in a first
year, and clutch and poise land somewhere in year two. A seventh reliever may
never be read at all, which is the correct answer about a seventh reliever. The
ordering is deliberate and it agrees with the evidence: clutch talent is the
smallest and least reliable signal in the sport, so it should take the longest to
see.

**It accrues from ordinary play, simulated games included.** `noteWatch` runs
inside `recordResult` — the one door every finished game comes through, whether
it was simmed by the hundred or managed pitch by pitch — and is gated on the same
`record` flag that stops a replay putting a second no-hitter in the book. The
card draws the accumulating evidence as a bar under STILL WATCHING, so the
mechanic is visible while it is happening rather than surprising the coach when
it finishes.

**Opponents are the exception, and it is deliberate.** A tendency on another
program's player is visible immediately, because a scouting report saying their
leadoff man runs is precisely what a defensive setting is for. Badges run the
opposite way: yours only. A tendency is what you can see from the other dugout; a
badge is what you only know because you have had the man in your building.

### 18.5 Badges — B10

Twenty-three of them, in four families, at three tiers. **One channel in one
situation, never a flat boost.**

| Family | Badge | Who | What it does |
|---|---|---|---|
| Situational | **GETS HIM IN** | hitters | better with a runner in scoring position |
| | **LATE AND CLOSE** | hitters | better from the seventh on inside two runs |
| | **TABLE SETTER** | hitters | better leading off an inning |
| | **HOUDINI** | pitchers | harder to hit with men on |
| | **THE DOOR** | relievers | harder to hit protecting a lead of three or fewer from the eighth |
| | **DEEP WATER** | starters | holds up the third time through an order |
| Physical | **WHEELS** | hitters | takes the extra base more often |
| | **BURGLAR** | hitters | steals a higher share of the bases he goes for |
| | **LIGHT TOWER** | hitters | more home runs |
| | **CANNON** | C, OF, 3B | runners test him less; behind the plate he throws them out |
| | **RUBBER ARM** | pitchers | loses less off his stuff past his pitch count |
| | **SWING AND MISS** | pitchers | strikes out more of them |
| Technical | **TOUGH OUT** | hitters | strikes out less often |
| | **VACUUM** | infielders, C | boots fewer of the balls he reaches |
| | **ON A LINE** | anyone | throws fewer of them away |
| | **PAINTER** | pitchers | walks fewer of them |
| | **WORM BURNER** | pitchers | keeps it on the ground, and out of the seats |
| | **STEALS STRIKES** | catchers | the staff walks fewer men with him behind the plate |
| Makeup | **GYM RAT** | anyone | develops faster between seasons |
| | **NO PANIC** | pitchers | harder to hit with two out and men on |
| | **SECOND LOOK** | hitters | better the third time he faces a pitcher |
| | **BIG STAGE** | anyone | better in a bracket game |
| | **CROWDS THE PLATE** | hitters | wears one, and gets pitched around rather than inside |

Three of those exist to keep the layer honest as much as to be badges. **SWING
AND MISS** is the counterweight to TOUGH OUT; **WORM BURNER** suppresses home
runs as well as raising ground balls, which is physically true and is what stops
LIGHT TOWER being the only badge in the game with an opinion about the home run
column; and **CROWDS THE PLATE** answers a gap §9.7 wrote down on purpose — hit
by pitch was left unwidened because a real leader is "a man who crowds the plate
and no rating measures it", and a badge is exactly the right home for a fact
about a man that is not a skill.

**Sizing.** Three bands, chosen by how often the situation arrives, because a
badge that can fire on any pitch needs a smaller number than one that waits for
the eighth inning of a one-run game:

| Band | Bronze | Silver | Gold | Used by |
|---|---|---|---|---|
| `STEADY` | 2.5% | 4.5% | 7.0% | always-available channels |
| `SPOT` | 3.0% | 5.5% | 8.0% | situations arriving a fifth to a third of the time |
| `RARE` | 4.0% | 7.0% | 10.0% | THE DOOR, BIG STAGE |

The engine's own reference points are what these are calibrated against.
Home-field advantage is a 1.020 offensive multiplier worth about +4.9 points of
win probability; a maxed coach skill is worth +0.87 points over twenty thousand
games. A gold GETS HIM IN is +8% on the 24% of plate appearances that come with a
man in scoring position — +1.9% of one hitter's offence, about a fifth of home
field spread over one ninth of a lineup.

**Measured twice, which is the check that matters.** A squad against an
identical squad with its badges taken off — same ids, same ratings, same
tendencies, the badge list the only difference in the world — over twelve
thousand games with home field alternating.

An **ordinary roster**, carrying the ten innate badges the generator gave it,
wins **49.9%**. That is not a small edge, it is no measurable edge at all: ten
badges, most of them bronze, several on channels that fire a handful of times a
week, cannot be seen in a win column over a season. Which is the correct answer
and the one the layer was designed for.

A roster carrying **two gold badges on every one of its twenty-three men** — a
configuration nothing in the game can produce, since the cap is two for three
quarters of the country and gold is 4% of badges held — wins **64.1%**. Divide it
out and a gold badge is worth **0.31 points of team win probability**: sixteen of
them are worth playing at home, and one of them is worth almost nothing. That is
the size the whole catalogue was designed to, and it is the number to re-measure
if any of the size bands ever move.

**Caps by ceiling**, as decided: S+ 10, S 6, A+ 5, A 4, B 3, C 2, D 2, with S+
exempt because the store player is supposed to carry ten and is the only thing in
the game that will ever grade S+. D and C share their two on purpose: three
quarters of the country lives in those two grades, a fine gradation matters least
there, and it produces the right reading — a low-ceiling recruit can arrive
already at his badge cap, which is what "he is close to the player he is going to
be" has been saying about him on the board all along.

**At most two at signing**, and most men have none. Measured across a generated
world: 0.57 badges per player, nobody above two, gold about 4% of badges held.

**Three routes in, and no decay.**

- *Innate*, hashed off the id at generation, capped at two and by his ceiling.
- *Earned*, in the offseason, from the season the man just played — read off the
  three season books rather than a parallel ledger, which is the same argument
  `records.ts` makes about the all-time book. Every bar is set near the 90th to
  95th percentile of what this engine's 45-game season actually produces: six
  home runs, a .430 on-base, a 9.5% strikeout rate, 9.8 K/9, 1.95 BB/9, and so
  on. A man who did the thing keeps it 42% of the time.
- *Coached*, one thing a winter, at 16% — because a staff picks something to work
  on with a man, it does not run him through the catalogue.

**TRAINING is the only lever anybody has over it**, and it is worth up to 80%
more badge development at the cap, on both routes. Measured over five simulated
years, the user's program at TRAINING 99 carried 1.25 badges per player against
1.03 at the starting 20. Across the league a freshman averages 0.61 and a senior
1.18, with the best men reaching four.

The rolls are hashed off the player's id and the year rather than drawn from the
offseason's random stream, for the same reason everything else here is: two
thousand rolls a year inserted into that stream would move every departure and
every development draw in the league.

**One honest limitation.** CANNON is eligible for outfielders and third basemen,
and only a catcher can *earn* it: the engine records stolen bases and caught
stealing on the catcher's fielding line and nowhere else, so there is no season
row an outfielder's arm could be read off. An outfielder gets it innately or from
his coaching staff.

### 18.6 Where it all reaches the simulation

`plateTraits` in `engine/traits.ts` multiplies the tendency contribution and the
badge contribution into one `TraitMods`, which rides on `PAContext` beside the
manager's tactic. `log5Outcome` reads `all` into the same product platoon and
context use, and the per-event factors onto the batter's side of the table;
`engineLog5` reads `strikeout` into the strikeout share of an out and
`groundBall` into the batted-ball mix; `constrainedSequence` reads `pace` as a
geometric tilt on the count weights. That last one takes the same single random
draw whatever the value, so nothing here changes how much randomness a plate
appearance consumes.

Outside the plate appearance: `runningMods` and WHEELS scale the extra-base
attempt inside `advanceOnHit`, per runner rather than per team; BURGLAR and the
catcher's CANNON scale the two halves of `attemptSteal`; `pullMultiplier` weights
the pull lane in `fielderFor` and `shiftBias` feeds `alignmentAgainst`; VACUUM
and ON A LINE scale the two error rolls; RUBBER ARM scales the fatigue slope; GYM
RAT scales development. `SimOptions.postseason` exists solely so BIG STAGE can
know it is a bracket game — inferring it from the calendar would have put a
schedule assumption three layers below where schedules live.

**Engine B is untouched**, as §9.7 already records for the spread work. It is a
comparison instrument reachable only from the command line, and giving it a
situational layer would mean giving it a calibration pass of its own.

### 18.7 The split, surfaced — B17

`platoonSkill` has been on every player since the engine was ported and had never
once been shown, on the grounds that it is hidden information. It is not: contact
and power against each hand is the first thing every other baseball game puts on
a player card, and a coach setting a lineup against a left hander is entitled to
know which of his men can hit one.

`platoonSplit` in `engine/ratings.ts` is the arithmetic, and it lives there rather
than in the screen so that what the card prints and what the simulation does are
the same function. The full split is spent half either way, exactly as
`platoonMultiplier` spends it, so the opposite hand is worth `+skill/2` and the
same hand `-skill/2`. A switch hitter turns around and therefore has the good
side of it against everybody, which is why both his columns read the same. A
pitcher's is printed as what he *allows*, which is the useful direction from a
dugout.

**Contact and power move by different amounts from one split, and that is the
model rather than a rounding artefact.** The multiplier lands on production, and
the same change in production is a large move on the contact curve and a small
one on the power curve, because `contact` buys singles at a sensitivity of 0.38
and `power` buys home runs at 1.87. Printing one delta against both would be
inventing a symmetry the engine does not have.

Index row 22 is therefore retired as a hidden mechanic: the number itself is
still not printed, but what it does to a man is.

**Where it lives moved in the overhaul (§20): the panel is on the STATS sheet
now, not RATINGS.** VS RHP and VS LHP are a production table, and the reader
looking for it is the one already reading his line. The arithmetic did not
move — it is still `platoonSplit`, still the same function the simulation
spends.

### 18.8 What it cost, measured

The eight-seed sweep and the bracket probe, before and after the whole block:

| | Before | After |
|---|---|---|
| Runs per team per game | +0.7% | +0.1% |
| PA per team per game | -2.5% | -2.6% |
| Batting average | +0.0% | +0.1% |
| On base percentage | -0.5% | -0.7% |
| Home runs per team per game | -0.6% | -1.2% |
| Strikeouts per team per game | -0.7% | -1.1% |
| Walks per team per game | -4.1% | -5.2% |
| Pitches per plate appearance | -3.3% | -3.5% |
| Slugging | +0.6% | +0.6% |
| **Worst deviation** | **4.1%** | **5.2%** |
| Better seed's share of bracket games | 65.7% | 65.5% |
| Standard deviation of team win totals | 9.02 | 8.87 |
| Best record in a season | 43-2 | 42-3 |

Walks are the one row that moved, and the honest statement is that about a
percentage point of it is unexplained. The per-plate-appearance arithmetic is
neutral — measured exactly, off the log5 table across 624 hitters and 480
pitchers with no simulation in the way, every tendency moves the league's walk
share by less than 0.35% and they sum to +0.3% — and the badge contribution is
about -0.5%, from PAINTER and STEALS STRIKES carrying more weight on that channel
than CROWDS THE PLATE puts back. The rest is a game-level effect of the kind pace
turned out to be, and it should be chased with the same method: isolate a
channel, measure it against the sweep, and dial it rather than guessing.

**Competitive balance did not move, which was the thing to watch.** The better
seed takes 65.5% of bracket games over eight simulated seasons against 65.7% for
the same build with the whole layer switched off — the same number. The win-total
spread and the best record in a season are unchanged too.

Read that figure with its error bars, though. The bracket probe is noisy season
to season, because a season's brackets are strongly correlated within themselves:
two adjacent six-season runs of the *same* build read 63.6% and 59.1%. Eight
seasons is 1,042 games and the standard error is about 1.5 points, so what the
measurement supports is "unchanged", not "improved by two tenths". The thing it
does rule out — badges pushing the favourite past the mid-sixties — it rules out
comfortably.

The harness for both numbers is `tests/block-probe.ts`, which is deliberately not
a Vitest file: it plays whole seasons of ninety six programs and its output is a
judgment call rather than an assertion.

---

## 19. The hall of fame — **SHIPPED**

`src/engine/hall.ts`, the induction step in `nextPhase` (`src/state/store.ts`),
`PROGRAM → HALL OF FAME` (`src/ui/screens/Program.tsx`). B12.

### 19.1 What it is against

The brief came with one failure mode stated outright, and it decided the whole
design: *a man who holds one enormous single-game record and was otherwise
ordinary must not get in.* Sustained excellence over a career, not a spike.

So **the ballot cannot see the record book at all.** Not the single-game rows, not
the season rows, not the career rows §13.6 just added. A record is one measurement;
a hall of fame is a verdict on a career, and the moment one can substitute for the
other the failure mode is back. `tests/hall.test.ts` pins this in its strongest
form: a man is given the best afternoon in the history of the country and his
score does not move by a point.

What a hall of famer holds is still printed — on the plaque, after the fact, under
STILL HOLDS. That is the honest place for it: worth reading, worth nothing.

### 19.2 Peak and longevity, because the draft made both ordinary

A four year career and a two year career are both normal outcomes since B9. A rule
that added seasons up would hand the hall to whoever nobody wanted; a rule that
took the best year alone would hand it to whoever had one.

So the score is what Jaffe's JAWS does for Cooperstown, at college scale:

```
score = career + peak + honours
```

- **`career`** is runs above replacement, summed over every season in the archive.
- **`peak`** is the mean of his best **two** seasons. Two rather than JAWS's seven
  because a college career is four and a junior who left has three — a seven year
  window on a four year career is just the career again, and the two year star's
  whole case *is* two seasons.
- **`honours`** is what the country voted him, priced in runs.

**Runs above replacement is the currency** because it is the only one that can
compare a shortstop's summer with a Friday starter's. A bat gets basic Runs
Created — `(H + BB) × TB / PA`, in the form James wrote it — against what a
replacement would have produced in the same trips, where replacement is 72% of the
league's .126 runs created per plate appearance. An arm gets runs prevented against
a replacement earned run average of 6.63, which is the calibrated 5.30 a game plus
a quarter. A two-way player gets both, which is right: he did both.

**Honours are priced small on purpose.** A national player or pitcher of the year
is worth 12 — about one and a half average seasons — freshman of the year 5, and a
place on the all-conference team 4. Four years of every honour the game can give a
hitter cannot get an ordinary career past the bar on its own, and a test says so.
They tip a borderline case, which is what a contemporaneous vote should do.

### 19.3 Two seasons, minimum, whatever the number says

`MIN_SEASONS` = 2, checked before the score is looked at. One season is a spike by
definition, and this is a hall built against spikes. It is also the cheapest
possible statement of the rule the file exists for: *sustained* means more than
once. The test for it hands a man the greatest season the engine can describe —
.550, 35 home runs, a score of 275 against a bar of 130 — and leaves him out.

The floor costs almost nothing in practice. Eligibility is three years completed or
age 21 (§14.1), so leaving after one season needs a freshman who arrived at 20 and
was immediately a first-round talent.

### 19.4 The bar, and the rate it produces

`HALL_BAR` = **130**, and it was measured rather than chosen. `tests/hall-probe.ts`
plays twenty seasons of the whole country and scores every finished career at three
programs — the strongest in the world that seed generates, the median, and the
weakest. What each candidate bar would have admitted over those twenty years:

| bar | blue blood | median | cellar |
|---|---|---|---|
| 100 | 30 | 7 | 0 |
| 110 | 19 | 3 | 0 |
| 120 | 14 | 2 | 0 |
| **130** | **10** | **1** | **0** |
| 140 | 8 | 0 | 0 |

The two failure modes were named in the brief: a hall that admits somebody every
year is a roster, one that admits nobody in twenty is a locked room. At 110 the
best program in the country inducts almost every season. At 140 nothing outside the
elite ever inducts anybody. **130 is the last row where a great program honours its
best man about every second year and the rest of the country is not shut out.**

Two things to read carefully with that table.

**The middle column is a floor, not the user's experience.** Every program in the
measurement is run by the machine, and a rival spends his skill points badly on
purpose — the country's recruiting skill plateaus near 30 against a player who can
reach 99 by concentrating (§16.4). A coach who recruits properly at an average
program produces careers somewhere between those two columns.

**The bar is absolute and deliberately not a quota.** A hall that admitted the best
two men of every decade would say nothing about the program the coach built. This
one says a great deal: at a bad program it stays nearly empty, and filling it is
the achievement. `tests/hall.test.ts` asserts the gradient rather than a number —
somebody at a strong program, not every year, and never more at a weak one than a
strong one.

### 19.5 When it happens, and why exactly there

**The class is decided when the draft step closes**, on the way into recruiting —
after the last man on the board is either talked round or let go.

This is the same argument that put Kingmaker at the draft step rather than on the
draft screen (§15.2): the honest moment is the one where the fact is finally true.
A junior taken in the fourth round is off the roster from the instant
`departAndDevelop` runs at the *start* of the draft step. Induct him there and a
coach who then talks him into coming back has a hall of famer on next year's lineup
card. A career is over when he is on no roster **anywhere in the country** — every
roster rather than yours, because a coach who changes jobs leaves men behind who
are still sophomores.

There is **no waiting period**. A coaching career is fifteen years if it goes well,
and a five year wait would leave a third of the men he coached pending when he
retires. He goes in the June after his last game or he does not go in at all — and
because the bar is absolute rather than a quota, a man who misses has missed for
good, which is why last year's near misses are not reconsidered.

**Idempotent**, because that branch is not behind `furthestPhase` and the rail can
be walked back to the draft step and forward again. The men already in are passed
in as `inducted` and never reconsidered; the announcement fires once.

### 19.6 It is a moment, and it is written down

Induction posts an **inbox card** (§17.3, kind `hall`) naming the man and his
career line. That is the difference between this and what the tab used to be: a
list that silently recomputes is a leaderboard with a threshold, and the point of
B12 is that somebody goes in, it is said out loud, and it stays true afterwards.

`season.hall` holds the class, beside `season.careers` rather than on the coach —
the archive spans every program he has run and has to outlive the roster that
produced it. **A plaque is frozen at the moment it is written**: the name, the
span, the programs, the career line and the score are all stored rather than
recomputed. If the scoring is ever changed, the men already in stay in with the
case that put them there. That is how every real hall works and the opposite of how
a leaderboard works, and it is the whole distinction the tab now draws.

### 19.7 Your own men only

`season.careers` is written by `archiveSeason` for the user's program alone, and
the ballot has no other source of men. A rival's monster is not excluded by a
filter — he is not in the book to be on the ballot in the first place.

One consequence worth stating: a man who played two years for you and two for
somebody else after you left is judged on the two he gave you. That is the honest
reading of "the men you coached", and it is what the archive holds.

The screen keeps the two career leaderboards under the plaques. They answer a
different question and it is worth answering: who accumulated the most is a fact
about a program, and a four year regular will out-hit a two year star every time
while only one of them has a plaque.

**They are now separated from the plaques by a rule and a heading that says what
they are not** — `CAREER LEADERS · NOT INDUCTIONS` — and the empty state says it
in words as well. Reported as "the hall of fame inducts after one season and
inducts nobody remarkable": after one season the plaques are empty and those two
tables hold two dozen ordinary freshmen, under a tab called HALL OF FAME. Nothing
was inducted, and nothing could have been — the ballot refuses a man with one
season, which `tests/store.test.ts` and `tests/hall.test.ts` both pin — but a
screen that reads as an induction list is the same complaint whatever the engine
did. (The dev save that prompted the report has three plaques with hand-made ids
`hof1`–`hof3`, four consecutive senior years, and scores of 44 to 88 against a
bar of 130: seeded fixture data, not a class the ballot produced. There is no
`hall` inbox card beside them, which an induction always writes.)

### 19.8 What the ballot could not see: a man's last June

The honours half of a case (§19.4) was read from `history`, and `history` was
written at the **year roll** — after the hall meets. So the ballot saw every
season the coach had ever finished except the one that had just ended, which is
the season a departing senior wins things in and the reason he is on the ballot
at all.

Underneath it was a second instance of the same mistake. `recordFor` resolves an
award through `rosterIndex`, and it was called after `departAndDevelop` had
emptied the rosters — so a graduating Player of the Year was not in the country
any more and his award went into **no season's award list at all**, on the
history screen as well as at the ballot. The men most likely to win something are
the men most likely to have just left, so the loss was systematic.

Both are fixed by writing the season into `history` at the **board meeting**
(`settleSeason`), where the rosters that produced it are still standing. The year
roll keeps a fallback for a career that was never graded — a reload landing past
the review step — and refuses to write a year the books already have.

---

## 20. The interface overhaul — **SHIPPED**

`src/engine/wire.ts`, `recordSchoolAnnals` — `src/engine/postseason.ts`,
`startingOffers` — `src/engine/program.ts`, `autoBattingOrder` —
`src/engine/strategy.ts`, `src/ui/Tutorial.tsx`, `src/ui/tutorials.ts`, and the
screens.

Two passes in late August 2026: the overhaul itself (offers instead of a
directory, the newspaper, the coach profile, per-school history, first-visit
teaching) and a feedback batch played against it (the full-screen game, the
defense, win cards, the portrait menu, the colleges directory, preseason
rankings, filters, and a general war on explainer text). Most of it is
presentation and is documented by the screens themselves; what belongs here is
the engine- and store-level machinery underneath, because every piece of it
obeys the same rule the event stream does — **reporting must never change what
happens** — and that constraint shaped all of them.

### 20.1 The wire

`wire()` in `engine/wire.ts` derives the country's news fresh from the live
season on every render and throws it away (§17.2 has the argument for why it is
not the inbox). Ten kinds — upset, streak, rout, ranking, milestone, race,
close, sweep, gem, power — deduplicated and interleaved so a page is never one
kind of story.

**It consumes no random draws.** Template variety comes from `vary(seed, count)`,
a stable hash of the story's own content, so the same season renders the same
paper forever and reading it moves nothing. The determinism is pinned by
`tests/overhaul.test.ts`, which renders the wire twice and asserts the rng
state did not move. The `an()` helper exists because "a 11-run margin" shipped
once and a newspaper that cannot manage its articles is not a newspaper.

### 20.2 Every school keeps a book

`TeamRecord.annals` is a `SchoolSeason[]` per program — year, record,
conference record and place, national rank, how June ended, and **the name of
the coach who sat the chair that year**, the user's or the rival's. Written for
all ninety-six programs by `recordSchoolAnnals` at the top of `rollYear`,
before anything resets; idempotent by year, so a reload mid-offseason cannot
write a season twice. It survives `nextSeason` because the team records
themselves do.

This is what makes HISTORY the *school's* book rather than the coach's: take a
new job and the page shows the years the school played while you were somewhere
else, each with the man who coached them. The coach's own career stays on his
profile, and mixing the two books is how both end up wrong.

**The migration is deliberately modest.** A pre-annals save seeds only the
current chair's book, from the coach `history` rows that name that school —
with `rank: 0`, because the career row's `rpi` is a value, not a rank, and a
seeded year printed as "#0.493…" is exactly what shipped for an afternoon
before the guard went in. Nothing is invented for the other ninety-five; their
books start with their next finished season.

### 20.3 A rookie gets offers, not a directory

`startingOffers(teams, limit = 6)` builds the new-coach job market: up to six
programs, every one of which would actually hire a rookie
(`canBeHired(ROOKIE_PRESTIGE, prestige, rosterStrength)`), at most two per
conference so the desk spans the country, at least one guaranteed so the game
can always start, and deterministic for a given world. The old step-three
region browser is gone: choosing from ninety-six schools you cannot have was a
directory pretending to be a decision.

### 20.4 Teaching that remembers

`<FirstVisit id="…" />` (`ui/Tutorial.tsx`) shows the copy in
`ui/tutorials.ts` once per id per career: dialog semantics, Escape and
backdrop dismiss, one to three short pages in a bench coach's voice.
`seenTutorials` rides the save and is **union-merged on load**, so loading an
older slot never re-teaches what the player has learned since; a reset button
on the saves screen wipes it on purpose. Fifteen ids cover the season screens
and every offseason step — the offseason ones replaced the paragraphs the
draft, board and signing screens used to open with.

### 20.5 The gears on the desk

`simWeek()` advances day by day until the schedule's week number changes, under
the same busy/live guards as `advanceDay`, and saves once at the end. SIM
SEASON survives on the dashboard **for testing only** and is scheduled to leave
before v1.0.

**The 0.8 seconds under SIM GAME and SIM WEEK is theater.** A day sims in
milliseconds and a result that appears the same frame the thumb lands reads as
though nothing was played, so the button shows a ring, waits 800ms, then runs
the sim — nothing computes during the pause, and it doubles as the rapid-fire
guard for those two controls.

### 20.6 AUTO deals a card

`autoBattingOrder(nine)` in `engine/strategy.ts`: classical order — best
hitter third, most power cleanup — as a pure reorder of the nine men handed to
it. It never reassigns a position and never touches the bench, it is
deterministic, and pressing it twice is pressing it once. The store's
`autoLineup` is the only caller.

### 20.7 The preseason poll

Until the league has about four games a team behind it
(`season.results.length < season.teams.length * 2`), the national table is a
**projected power ranking**: `rosterStrength × 0.75 + prestige × 0.25`,
computed in the screen, labelled as a projection, and never persisted — RPI
over no games is the tiebreak backstop wearing a table's clothes, and the poll
exists so opening week is not ordered by a coin. The moment the threshold
passes, the real RPI table takes over and the projection is never seen again.

### 20.8 The game on its own screen

A live game owns the viewport: no masthead, no portrait, no record, no nav —
the scoreboard clears the notch itself and BACK TO THE DESK returns to the
dashboard with the game kept (PLAY BALL reads BACK TO THE GAME until it is
finished). The matchup strip names both halves of every plate appearance, and
the call buttons carry a 500ms guard, because two taps a heartbeat apart used
to submit two plate appearances and the manager never saw the second
situation.

**The landing coordinate is honest about extra-base hits now.** `landingFor`
places a ball at the station of the fielder who handled it, which told a
triple's story backwards — the man it went *past* drew it dying at his feet. A
double lands no shallower than `y = 0.68` and a triple no shallower than
`0.88`, pushed along the fielder's side of the field, still derived from the
same stable hash and still costing the simulation no dice (index row 55's rule,
extended).

The defense on the 3D field is presentation over that coordinate: nine dots at
their stations, the nearest non-battery man runs the ball down (the pitcher
carries a distance handicap and the catcher never chases), and after the
outcome blink the ball is lobbed back to the mound while the fielder walks
home. The engine decided everything before the first frame drew.

### 20.9 June's cards

The postseason announces a trophy as loudly as an exit: winning the
conference, the regional or the title each raises a card once, keyed
`${year}:win:${stage}` in `postseasonSeen` exactly as the eliminations are
keyed, and the elimination copy is written per tier — losing the national
final reads *Runners up*, not *Knocked out*. The boxed RESULT section became a
settled banner, loud for a trophy and quiet for an ending, and the lineup card
is reachable from inside the bracket as a sheet laid over June, so the dugout
controls no longer require leaving the one frame the year was played for.

---

## 21. A game you can put down — **SHIPPED**

`src/state/liveJournal.ts`, `startManagedGame` / `manageBracketGame` /
`resumeGame` / `pendingFromJournal` — `src/state/store.ts`, `tests/resume.test.ts`,
`tests/season-soak.ts`.

The first stage of the v1.0 route (`07-v1-plan.md`), August 2026: stop the game
lying about a season that is still alive, and stop it losing a game to a phone
call. Two independent fixes and one new probe.

### 21.1 A live game is replayed, not restored

A `LiveGame` is a coroutine — it holds closures, a suspended generator and a
reference to the season's own rng — and none of that survives `JSON.stringify`.
So an interrupted game is not saved. **It is journalled and replayed.**

The journal is an anchor and a list. The anchor is the season generator's exact
position at the first pitch, plus the two teams, the starters and which dugout
is yours. The list is every call since, as a small enum: `{k:'tactic'}`,
`{k:'pinch'}`, `{k:'pen'}`. Replay rebuilds the game off `rngFromState(anchor)`
and re-submits the calls in order, which lands on the identical game because
the engine is deterministic and the calls were the only inputs.

Three details carry the whole thing:

- **It lives in `localStorage`, deliberately.** Everything else the game owns is
  in IndexedDB, and this one thing is not, because an IndexedDB write is async
  and the event this exists to survive is the OS killing a backgrounded tab —
  where a pending async write is a lost write. `setItem` returns when the bytes
  are down. The module has no memory fallback, and `tests/resume.test.ts`
  supplies a real `Storage` shim rather than asking for one: a journal held in
  memory dies with the tab, which is precisely the moment it was written for.
- **`startManagedGame` and `manageBracketGame` are `async` and await the save
  before creating the game.** The replay is only exact if the season on disk
  stands where it stood at the first pitch, so the anchor is written first and
  the game is built second.
- **A call is journalled before the engine is stepped**, so a crash inside the
  engine replays into the same crash rather than quietly skipping the call that
  caused it.

`pendingFromJournal` validates slot, year and rng state together — another
dynasty, another season or a generator that has moved on are all the same
answer, because replaying into any of them would invent a game rather than
recover one. Taking the offer replays and hands back the clipboard; declining
replays and calls `finish()`, so the day still happens, it just happens without
you. Both prompts exist, on the dashboard and inside the bracket, because June
renders its own frame and would otherwise have swallowed the offer.

**This also removed a restriction that had gone stale.** `endManagedGame`
refused to save mid-bracket, on the grounds that a live sub-bracket could not be
serialised. That stopped being true when `portableMyBracket` landed in the
overhaul, and `sideShow` joined it in the national redesign; the guard was
protecting against a hazard that no longer existed, and it was the only thing
standing between the postseason and this feature.

### 21.2 The card that buried living teams — A13

Losing a conference final told the coach his season was over. It is not: the top
four in a conference all reach a regional, and so does a protected top-four
program that just lost one.

`Knockout` gained `advanced` and `placing`, both computed in `noteKnockout` **at
the moment of elimination**, because that is the only moment the structure still
knows where a team fell — a double elimination writes the finish in the slot the
second loss came in (championship 2nd, losers final 3rd, losers semifinal 4th).
Regional exits ask `protectedTopFour(season)` instead, which is arithmetic over
a finished season and needs no bracket at all. The card then reads *Runners up*
or *Third in the league* with a winning tone and a button that says ON TO THE
REGIONAL, or a real ending for fifth and below.

**The stake now appears before the game rather than after it.** A bracket-reset
final says *you must win this AND the next one*, because the original confusion
was a manager having no way to know he needed two.

### 21.3 The soak — `npm run soak`

`tests/season-soak.ts` runs thirty seasons headless and audits every June:
conference fields and placings, one-loss survival, sixteen regional series with
distinct champions, a twenty-team national field with no duplicates, protection
never drawn into the opening round, a clean split into two brackets, exactly one
champion and one runner-up, twelve programs a conference, nine men in a lineup,
one annals row per program per year. Thirty Junes, no structural faults.

It measures two things besides: the save grows about 12 KB a year (15 KB → 371
KB at year thirty), and the format produces **ten distinct champions in thirty
years against a real-world sixteen**. The second is a balance question, not a
bug, and it is open — `06-backlog.md` §F carries the argument. The soak fails
below `years / 3` champions, so the number is watched from here.

---

## 22. Two ways to play — **SHIPPED**

`src/state/depth.ts`, `src/state/devicePrefs.ts`, `src/ui/screens/Settings.tsx`,
the depth step in `NewGame.tsx`, `autoPitching` in `engine/liveGame.ts`,
`tests/depth.test.ts`.

Stage 2 of the v1.0 route, August 2026. Coach creation asks, second and before
the bench and the job, how much of the game you want to be asked about.

### 22.1 The rule the whole thing rests on

**The engine always models everything. The mode changes what the player is
asked, never what the simulation does.** Casual does not turn the bullpen off;
it has a pitching coach run it — which is what has always happened for the other
ninety-five programs. A casual career and a full career in the same world
therefore produce the same league, the same rankings, the same records and the
same hall of fame. The moment a mode reached into the engine, your .312 would
stop meaning what a rival's .312 meant and there would be no honest way to rank
ninety-six programs against each other.

Two rules follow, and both are load-bearing:

- **Anything that touches the whole league is not a preference.** Injuries,
  academic eligibility, conference realignment are properties of the world, on
  for everybody or off for everybody, and are deliberately absent from the
  catalogue however natural they look on a settings screen. A test asserts they
  never appear.
- **A preset is a preset, not a cage.** Every system has an override, and
  *only disagreements are stored* — never the full set. That is what lets a
  casual career from an older build pick up the casual answer for systems added
  since, rather than silently opting out of them. Changing preset drops
  overrides the new preset agrees with, which is a real trade documented in the
  test: losing a preference you can see and re-set in two taps beats hidden
  state that makes CASUAL quietly not casual months later.

### 22.2 What casual actually does, today

Lineups and the pen. The engine side is one boolean: `createLiveGame` already
knew how to run either dugout automatically — that is how the computer opponent
gets a bullpen — so `autoPitching` points that machinery at your own defensive
halves. The engine is never told *why*; it takes a flag, and what the flag means
about how somebody likes to play is entirely the state layer's business.

**The journal records it too** (§21.1). A player who switched modes between
backgrounding a game and resuming it would otherwise replay into a different
game and be handed it as the one he left.

Casual is **silent**: it handles the routine and says nothing. The card is right
there on the LINEUP screen whenever you go and look.

### 22.3 Two kinds of preference, kept apart

**How you play is a property of a career** and rides the save. **Text size, the
field, sound and motion describe a person and a screen** and ride the device, in
`localStorage`. Loading a five-year-old dynasty must not shrink your text, and
starting a new one must not turn the sound back on.

Every font size in the app is written `calc(<n>px * var(--ts))` — 582 of them,
swept in one pass — so the text-size setting is real rather than promised. It is
applied before the first paint, so the small version never flashes past. Motion
can override the OS in **both** directions, which needs its own rules rather
than a wider media query.

Unbuilt rows (sound, haptics, mound visits, press conferences, the portal) are
present and disabled. The shape of the game is visible from the first day and no
row is ever a surprise later.

---

## 23. June, made legible — **SHIPPED**

Stage 3, August 2026. The postseason was rebuilt in §20–21 and then *played*,
and the verdict was that the format works and the screen does not.

### 23.1 The opening round is gone

A twenty-team field was cut to sixteen by four best-of-three series. Reported as
confusing and unnecessary, and the second half is the important one: **the
round's real sin was that it was a single-elimination gate in front of a double
elimination tournament.** A team could win its conference, win its regional,
lose one series and be finished, in an event whose whole promise is that one bad
night does not end you.

Those eight teams now play their way in **inside the winners bracket**, where
losing costs a drop to the losers side and nothing else. Six per half are byed.
`seatProtected` keeps the top four above the line, which is the half of the old
round's promise worth keeping.

`doubleElim.ts` expresses both shapes as **routing tables** rather than a chain
of ifs. The eight-team table is a transcription of the code it replaced, and the
existing tests are the proof of the transcription — game count, finish order,
step-equals-run, and every conference tournament in the soak read the table and
did not move. Round names are baked into slots at construction, because the same
`(side, round)` means different things at different sizes.

**Ten teams: eighteen games, nineteen with the reset.** That is arithmetic, not
a magic number — every game is one loss, nine teams leave with two apiece, the
champion leaves with none or one. A test asserts the identity.

`Finish` value `'national'` is history: it meant "made the field but went out in
the opening round" and there is no such state. It stays in the union because old
saves carry it.

### 23.2 What the screen says now

- **A champion is a card at the top**, at three intensities from a conference
  banner to the country. One component, because the escalation is itself
  information. A rival's title gets the same card in navy and no takeover.
- **Bracket games open** into the schedule's own box-score sheet. Honest about
  its limit: boxes are kept only for the user's program.
- **A title game announces itself before it is played**, with what winning
  actually takes — one win unbeaten, two from the losers side.
- **An elimination leaves a letter as well as a card.** The card is the moment;
  the letter is the record, and a card tapped past at 1am is gone.
- **The bottom nav is back in June**, with JUNE in the home slot, away only
  while a game is being managed.
- **Postseason statistics exist** (§23.3) on a POSTSEASON board whose qualifiers
  come down hard: the national bar is built for fifty games and a tournament is
  a fortnight.

### 23.3 June's own book

Season totals include tournament play — the NCAA convention, and two
accumulation paths would drift — so June cannot be recovered by subtraction. It
is counted **a second time** in `postBatting` / `postPitching` rather than moved,
and folded into `CareerTotals.post` by the pass that already runs once a year
over every roster, where the idempotence problem was already solved.

Kept for **all ninety-six programs**, because this is the half that cannot be
recovered later: box scores exist for one program, so a rival's June is gone the
moment it ends.

The bug worth remembering: the three bracket paths that record an
already-played game were not passing the `postseason` flag. Those are exactly
the games the user managed himself, so the only postseason statistics missing
from the entire league would have been his own.

---

## 24. Giving the screen back — **SHIPPED**

Stage 4, August 2026. Five reports, one complaint: a phone screen is the
scarcest resource the game has, and several recent additions were spending it
on things worth less than the room they took.

- **The roster's filters went behind an icon.** They were the *second* attempt —
  nineteen wrapping chips came first — and the lesson both times is that
  filtering is occasional and reading the list is constant. The button carries a
  dot when a filter is on, because a filtered roster and a short roster look
  identical.
- **"He is in your pipeline" became a mark.** Three sentences explaining the
  home-state rule sat on every in-state recruit's card for ever, long after the
  player had learned it. The advantage is already visible where it acts.
- **The prospect sheet went 72% → 86%**, deliberately not full height: the strip
  of board behind it is what says *sheet over a list* rather than *screen you
  navigated to*, and it is the thing you tap to get out.
- **The record came out of the small print.** It rode the identity line at 9px
  beside two things that never change. Overall only; the header is meant to be
  getting lighter.
- **The action button stopped moving**, and this one took two attempts.

### 24.1 Why sticky could not hold the action button

It was `position: sticky; bottom: 0` inside the scrolling body. Sticky pins an
element only while **its containing block reaches the edge being stuck to** — so
on an offseason step with less content the body stopped halfway down the screen
and took the button with it. Measured on the draft step: 305px above the frame.

**Filling the body was tried first and is not enough.** A screen that passes
several children puts the button inside a later one, and a column flex container
with `overflow` under-reports its own `scrollHeight`, so the fix worked on some
steps and not others — which is worse than not working at all.

`FixedHeader` takes an `action` now and renders it as a **row of the frame**,
outside the scroller. That is the arrangement the postseason screen already used
and the reason it used it. Measured across all six offseason tabs, content
fitting or not: two pixels from the bottom, every time.

---

## 25. The dugout — **SHIPPED**

Stage 5. The half of the old stage 5 with no engine in it: everything here is
presentation over a stream the engine already emits, and nothing in this
section can change a result.

### 25.1 The screen

A top bar carrying the inning with a direction caret, outs as diamond pips, and
**the linescore, permanently**, with R/H/E. It was briefly folded behind a LINE
SCORE button and came straight back out on report — it is the one thing on this
screen that answers *where are we* without being asked, and a scoreboard you
have to press is not a scoreboard.

The field is about twice its old size. Below it, the matchup as **two cards**:
the batter with `AVG / HR / RBI`, the pitcher with `IP / K / PC` and an **ARM
gauge** drawing the pitch budget fatigue has always used — stamina 80 is roughly
98 pitches, and past it the multiplier degrades to a floor of 0.55. The gauge is
the first time that budget has ever been visible. The card whose side you are on
wears a clay top edge, so it swaps every half-inning.

**Where everybody is now reads as the first line of the play log**, sticky at
its top. It was a dark banner over the foot of the field for one session and was
reported twice — once for covering both cards (an earlier edit had nested them
*inside* the field block, so `bottom: 0` resolved below them), and once for
existing at all. The second note is the better one: the diamond already shows
the runners, so a caption over it is the same fact twice, and the place a reader
looks for words about the situation is the log.

### 25.2 The bench coach

Two doors beside SIM THE REST, which was all or nothing — a manager up nine in
the sixth chose between forty more taps and giving up the rest of the game
unseen.

- **WATCH** — he calls it with a beat between calls, so the field animates and
  the log fills and you simply watch.
- **AUTO** — the same without the beat, stopping the instant something worth
  managing arrives.

"Worth managing" is deliberately three things and no more: a man in scoring
position, seventh inning or later within two runs, or an arm past its budget. A
handover that fires every half-inning is a handover nobody uses.

**Neither changes an outcome.** He submits the same default call the screen
already highlights, which is exactly what SIM THE REST has always done. One call
per tick, guarded by the same flag that greys the buttons while a ball is in the
air, so he waits out an animation like a person would.

> **A bug the types allowed, worth keeping.** Scoring position was first written
> as a null check over `bases`, which is `[boolean, boolean, boolean]` — and
> `false !== null` is true, so every empty diamond counted as a man on second
> and the handover fired on the first pitch and handed straight back. TypeScript
> does not flag a comparison that is always true. Caught only by playing it.

### 25.3 What June gained in the same pass

- **The stage rail is navigation.** A finished tournament can be reopened; the
  action button then says BACK TO THE REGIONALS rather than advancing a stage
  you are not looking at.
- **The view follows the side you are playing on**, fading between halves. Only
  on a real change of side, so somebody who deliberately went to look at the
  other half is left there.
- **SIM TO MY NEXT GAME is the primary action**, with the named round beside it.
  Round by round is the honest unit and is kept, but it is not what anybody
  wants when four of the next five rounds contain none of their games. It stops
  *before* your game, so the game is still yours to take.
- **Trophy colours per tournament** — bronze, silver, gold. Every championship
  card was one muted green, which read as a loss and could not tell three
  tournaments apart.
- **Advancing is not winning.** Finishing runners up showed the green a
  championship wears, congratulating a team on losing its final. Three states,
  three colours: green for a trophy, clay for a season that is over, neutral for
  *you lost and you are still alive*.

### 25.4 Deliberately not built

- **REPLAY.** Named in the brief. The play events and landing coordinates that
  would drive it are already stored and already take zero random draws, so it is
  a player over an existing stream rather than new state. It can land any time.
- **The ballpark's look** — crowd, stands, lighting — as opposed to its
  geometry, which is done. Deferred to broadcast by request, because it is the
  same job as sound and celebration and a park redrawn before them would be
  redrawn again after. Backlog §K1.

---

## 26. The dugout's depth — **SHIPPED**

Stage 6, and the first stage since the overhaul to touch a calibrated engine.
Two channels where there was one, and a limited thing you can do about the new
one.

### 26.1 Confidence, beside fatigue

They are a pair and the design keeps them apart on purpose:

| | Fatigue (`ARM`) | Confidence (`HEAD`) |
|---|---|---|
| What it is | a budget | a state |
| Moves | one way, down | both ways |
| Driven by | pitches thrown | what just happened to him |
| Restored by | nothing | a mound visit |
| Authority at the extreme | ×0.55 | ×0.94 |

`CONFIDENCE.start` is 0.5 and `confidenceMultiplier(0.5)` is exactly **1**.
That is the property that let a new channel go into a calibrated engine: at the
midpoint nothing changes, so every figure measured before this still describes
the same game, and only a pitcher who has genuinely wobbled or genuinely
settled moves off it. A reliever enters at 0.58 — the closest this model comes
to saying a man who warmed up for an inning knows what his job is.

`confidenceShift` is deliberately small per event: a home run costs 0.10, a walk
0.05, a strikeout returns 0.045, an ordinary out 0.02, and each run allowed
0.02. It is the accumulation across a bad inning that shows, which is what makes
a visit worth spending *after* one rather than after a single pitch. It takes no
random draws — arithmetic over what already happened — and is applied at the one
point where the whole plate appearance is settled, not at the dozen places an
event is decided.

Both arrive at the plate appearance multiplied together, so neither cancels the
other: **a settled man who is out of pitches is still out of pitches.**

### 26.2 The mound visit

One per pitcher per outing, resetting on a pitching change because a new man has
his own. It restores `CONFIDENCE.visit` (0.22) and touches fatigue not at all —
talk is not rest, and letting it be would collapse two channels into one.

`moundVisit()` is exported and both dugouts call it. The AI goes late and only
with somebody on, at confidence below 0.3: a staff that spent its visit on the
first walk of the second inning would be spending the thing that is supposed to
be scarce. **This symmetry is not a nicety** — a settling mechanic available
only to the human would put the other ninety-five programs in a measurably
different world, which is the rule the depth mode already lives under.

Journalled as `{ k: 'visit' }` and replayed like every other call. It carries no
payload because there is nothing to carry, but it must be in the journal: it
changes confidence, and confidence changes the game.

### 26.3 What it cost, measured

Two sweeps, because the first was taken before the AI visits existed and was
therefore a measurement of half the change.

Final: every component moved **under one percent**, every D1 target still
passes, worst deviation 6.2% on walks — which is the pre-existing walk deficit
already logged as measurement debt, not something this added.

**Title concentration was the number to watch**, since a system that steadies
good pitchers could plausibly reduce upsets. Measured across five worlds:
**8, 11, 10, 8, 10 — mean 9.4**, against **9.4** before confidence existed.
Unchanged. Worth recording that the single-seed reading swung 8 to 12 across
these changes, which is why the open question in §F is only ever answered with
a sweep.

### 26.4 Three tests that were asking the wrong question

All three failed because the world moved under a pinned seed, and all three now
ask what they were actually about.

- **The batting champion** was a ceiling against one season. A tail statistic is
  the one thing a single sample cannot settle: the pinned seed threw .544 while
  nine others averaged .464. It judges the distribution across six worlds now.
  Widening the bound would have hidden a real regression later; picking a kinder
  seed is the same thing with extra steps.
- **Walk-ons** and **awards** need a world in which the comparison is *possible*
  — a roster carrying both a walk-on and a signed freshman, a program whose men
  won something. Both walk seeds until they find one, and both still fail loudly
  if no world in range can answer.

### 26.5 Moved and cut

- **Scouting reports** moved to the economy stage, where the money that should
  pay for them lives. Its settings row says so.
- **Pitch calling** was cut from v1.0 rather than deferred, and its row now
  reads *a later game* rather than naming a stage that will never build it.
- **The mound visit conversation** — three registers, a pitcher's temperament,
  and repetition that costs — is designed and deferred to stage 7, where it can
  read the coach's personality badges as well as the pitcher's. The half that
  makes it a decision is *which register works*, and that half needs both men.
  Upgrading costs one sheet: the button, the count and the confidence plumbing
  are identical either way. Backlog §K3.

---

## 27. Stage six, revised on contact — **SHIPPED**

Everything in §26 stands except the shape of the confidence curve, which was
wrong on the screen before it was wrong in the model and was reported as both.

### 27.1 The bars start full

A bar that begins empty and fills as a man tires reads as something being
**earned**. Both of these are things a pitcher arrives with and spends, so both
now draw what is *left*:

- `ARM` is `1 - pitches / budget` rather than its inverse.
- `CONF` starts at `CONFIDENCE.start` = **1** and only comes down, with small
  credit back for getting people out.

A starter deep into a game having given up nothing has simply never lost any —
the behaviour asked for, falling out of the shape rather than needing a rule of
its own. `HEAD` was renamed `CONF`, which is what it means.

Confidence gained a weight it did not have: **traffic**, charged per runner left
on at the end of a plate appearance. One baserunner is barely anything; a loaded
bag is a real cost, which is also the moment a mound visit starts to look worth
spending.

### 27.2 The tuning that nearly went out wrong

Centring the multiplier on **full** — the obvious reading of "starts full" —
taxed every arm in the country for the crime of having pitched. At league rates
a plate appearance costs about 0.012, so a starter who faces twenty-five men
ends near 0.70 and averages roughly 0.85. That is a **1.2% average penalty**,
which run scoring being the nonlinear thing it is arrived as **+4.9% runs** and
put the league above its target for the first time in this project.

Neutral belongs where pitchers actually live, not where they start. Walked down
against the sweep: `0.85 → +1.8%`, `0.80 → +1.0%`, **`0.76 → runs exactly on
target**. It sits a shade below the average outing on purpose, which is what
pays for a cruising pitcher being genuinely worth about a percent — something
the old centred-on-full shape could never say.

**`CONFIDENCE.neutral` is downstream of `confidenceShift` and cannot be reasoned
about separately. Retune one, re-measure the other with `npm run goldens`.**

### 27.3 The ball that blinked red in the outfield

The outcome colour ran from the moment the ball landed until the throw. Fine for
a routine grounder; wrong for anything into a gap, because the chase is timed
from contact at `FIELDER_SPEED` 3.9 units a second — so a ball twenty units from
its nearest fielder left a red light flashing in the grass for **four seconds**.
Longer than the 1.5–1.9s window the dugout greys its buttons for, so the next
call became available while the last play was still being drawn.

Two bounds, because there were two faults:

- `BLINK_DUR` 0.75s — the outcome is a *signal*, not a state. It lasts about as
  long as it takes to read, then the ball is a ball again.
- `MAX_CHASE` 1.15s — this is a summary of a play, not a simulation of one.

### 27.4 A chronic mandate fault, finally fixed

`topThree` has **24 seats** a year — three in each of eight conferences — and
both the `contend` and `championship` tiers were required to fill one. That put
askers at roughly the number of seats, which is a box that fails somebody every
time the distribution breathes: **two unrelated engine changes** pushed the worst
year to 25 and then 26, each by moving the world rather than touching mandates.

The championship tier's placement box moved to `topHalf`, which is the same fix
its *trophy* already got and for the reason stated there: **a required box needs
more seats than askers.** Its hard ask is the regional banner, sixteen of which
hang every June; asking it *also* to finish top three was asking twice for one
thing while starving the tier below of seats. Four grid rows move from missed to
failed and nothing else does.

### 27.5 Smaller things

- **AUTO removed.** Two buttons were doing one thing — watching already hands
  the dugout back when something worth managing arrives, which was the intent.
- **Tutorials have an off switch**, in Display beside the reset. A *device*
  preference: somebody who has played before should not be taught the recruiting
  board again because they started a second dynasty. Absent means on, so no
  existing career quietly stops explaining itself.

---

## 28. School culture — **SHIPPED**

Stage 7, piece 1. The first half of making a coaching career feel like one.

### 28.1 What was missing

A `SchoolDef` was `abbr`, `school`, `nickname`, `quality`, `prestige`, `color`,
`rival`, `state`. Two of those are numbers and **both are about strength**, so
ninety-six programmes read as one programme at ninety-six volumes. Taking a job
was picking the highest number that would have you, and `startingOffers` — pure,
deterministic, sorted on prestige and roster — made that literally true.

### 28.2 What a culture is

`src/data/cultures.ts`, keyed by abbreviation:

- **`name`** — two or three words. What a player reads first.
- **`creed`** — one line, in the school's own voice.
- **`edge`** — the one thing they are known for. Eight of them: development,
  pitching, defence, power, loyalty, recruiting, tradition, ambition.
- **`patience`** — 0 to 100. How long before the board starts counting.
- **`ambition`** — 0 to 100. What clearing the bar means here.

Two dials rather than five. Everything a third and fourth dial would have said is
already said better by `edge`, and a school page with five unnumbered bars on it
is a school page nobody reads.

### 28.3 Hand-written, and why that mattered

Deriving culture from prestige, region and tier was the cheap option. It would
also have been **prestige wearing a hat**: every blueblood impatient and
demanding, every doormat patient and modest, one axis pretending to be two.

`tests/cultures.test.ts` asks directly whether ambition is just prestige
restated — and **the first hand-written pass failed it.** Mean gap 1.5, four
outliers, every one in the same direction. The derived version had been written
by hand without noticing.

Twenty-two programmes now disagree with their own standing by fifteen or more,
in both directions, and the test holds it there:

- **Mobile Bay**, prestige 71, ambition 52 — a proud old school that would rather
  tell you about 1974 than reach Omaha.
- **Newport Bay**, prestige 53, ambition 34 — *"They have waited forty years and
  are prepared to wait longer."*
- **Savannah River**, prestige 45, ambition 68 — a modest name with a loaded
  roster that expects to win now.
- **Pascagoula Tech**, prestige 47, ambition 66 — the forge, and it believes.

Every culture is tied to the name the school already had: the Anvils forge, the
Sodbusters broke the ground, the Silkmen are the bottom rung and cheerful about
it.

### 28.4 What the tests hold

- Exactly ninety-six, no orphans either way.
- No creed or culture name used twice.
- All eight edges present, none over a third of the country.
- Ambition genuinely independent of prestige, both directions.
- Strong patient schools and weak impatient ones both exist — the cliché is
  allowed to be true without being a rule.

### 28.5 What it does not do yet

**Nothing touches the simulation.** The slight effects — a development school
getting a little more out of its returning players — are held to the last piece
of the stage and measured alone, because stage 6 taught that a new selection
system and ninety-six new engine modifiers must not land in the same pass.

---

## 29. The coach — **SHIPPED, all eight pieces**

Stage 7. Eight pieces; seven are in. Piece 8, the press conference pool, waits
until the interview has been played with — writing sixty situations before
knowing whether the voice lands is sixty situations of risk.

### 29.1 What shipped

| Piece | What it does |
|---|---|
| 1 · School culture | Ninety-six hand-written identities: a name, a creed, an edge, and two dials |
| 2 · The interview | Eighty questions, five asked, at creation |
| 3 · Offers | The desk reads what you said |
| 4 · Titles | Thirteen shapes a career can take |
| 5 · The cold approach | Writing to a programme that has not asked for you |
| 6 · Earned badges | Ten hidden counters with seeded thresholds |
| 7 · Culture in the engine | Development, and cultures that drift |

### 29.2 The interview

Creation is five steps now, the questions third. **Eighty in the pool and five
asked**, so two careers share about one question — that ratio *is* the reason
the writing was worth doing, and it is a test rather than an intention.

An answer moves the four skills by **net +2, negatives allowed**. That single
rule is what keeps it a character question: if one answer were worth +3 there
would be a correct answer, and the whole thing would collapse into picking it. A
trade-off is fine and is what makes an answer feel like it cost something.

**Badges are a vote, not an award.** Each answer nominates one; the two most
nominated are worn. Five answers leaning the same way produce a coach who is
obviously one thing, and five that scatter produce one who is harder to
summarise — which is also true of people.

The effect of an answer is shown; the badge it votes for is not. The skills are
what a player watches most closely, so an unreadable consequence is a guess
rather than a choice — but who he turns out to be is better found than picked.

**Casual gets two questions rather than none.** Zero would put the best-written
thing in the game out of reach of the players most likely to bounce off a slow
start.

### 29.3 The desk, and why it is built in two halves

Weighting culture into one sort *hard* made every offer match, which reads as a
search result rather than a country. Weighting it *lightly* rang the same five
best jobs for everybody. The band a rookie can reach is only about eight points
of prestige across twenty schools, so one dial can favour standing or fit and
never both.

**Three seats go to programmes that specifically want him; two to the best jobs
he could get regardless.** Measured: eleven of twenty offers match the coach's
strongest leaning, two opposite coaches share at most two of five, and a
recruiting school at prestige 32 will outbid better programmes for a man who
said he was a closer.

Two data faults surfaced only under measurement. Development had reached
twenty-nine of ninety-six schools — "they develop players" is the easiest thing
to write about a small programme, and writing ninety-six of anything in batches
is how a default creeps in. And the ambition match was written as
`2 - |difference|`, which is a bias rather than a match: every school scored
positively, the *least* ambitious scored highest, and one of them appeared on
every desk.

### 29.4 Titles: thirteen shapes, twice measured

The old ladder measured how much a man had won on six rungs, and "Journeyman"
meant **has coached one game** — so seventy-one of ninety-six wore it at year
thirty.

Both measured passes are worth keeping:

- **Six programmes is unreachable.** The carousel does not move a man that often
  inside a career; the observed maximum over thirty-five years is *four*. A
  journeyman at six would have been a word nobody ever wore.
- **A regional banner is not rare.** June hangs sixteen a year, so "two" was the
  seventy-fifth percentile wearing a contender's name.
- **The first pass reproduced the fault it was fixing.** The fallback was still
  `'Journeyman'`, so sixty of ninety-six wore it — and now none of those men had
  moved anywhere. Most coaches have a long career and win nothing decisive, and
  that deserves a name: *Career man*.

`npm run carousel` prints the career distribution the thresholds were set
against. Eleven of thirteen rungs are occupied in any year; the largest is
Career man at thirty-seven percent.

### 29.5 Earned badges

Ten counters, hidden, with **thresholds seeded per save**. One decision, two
jobs: nobody farms a target they cannot see, and the same style earns its badges
at different moments in two careers.

Two habits reward *engaging* with the game rather than optimising it — reading
the wire, and talking a man out of the draft — and neither can be reached by
somebody who never opens the screen.

`tests/habits.test.ts` **greps the source for a write to each habit**, which is
crude on purpose. It exists because `Builder` shipped one piece earlier as a
title nobody could wear: the number behind it was recorded for the player and
for none of the ninety-five rivals. It typechecked, had a sensible threshold,
and was decoration.

### 29.6 Culture in the engine, and two things that were too strong

**Development only, and two edges.** It is the one place a school's identity
plausibly changes an outcome without changing a *game*.

The calibration sweep did not move at all — the effect lives between seasons
rather than inside one, which is structural rather than lucky. The multi-year
measurement is where both faults were:

- **Six percent compounds.** Paired on the same seeds, champion diversity fell
  from a mean of 9.5 to 8.25, three of four down. Better players, better
  results, more prestige, better recruits, for thirty years. Halved, the same
  seeds give 9.75 against 9.5 — indistinguishable.
- **Drift was a ratchet.** Missing the postseason dropped patience by two
  against a homing pull of one, and four in five schools miss every year, so
  the whole country slid toward twitchiness and turnover rose 9.0 → 9.5. A
  board becomes less patient when it has just *sacked* somebody — about nine
  schools a year. Turnover is back to 8.9.

Patience reaches the board's sacking bar, **centred on the country's mean of 63
rather than fifty**, so an average school gets the bar it always had. Drift pulls
one point a year toward the hand-written baseline and is bounded at eighteen:
enough for a patient school to become a twitchy one, not enough for any school
to become a different school. Over thirty years, seventy-five of ninety-six have
moved, in both directions, with a country-wide mean shift of **+0.42**.

### 29.7 The rule this stage kept proving

Every fault above typechecked, passed the suite, and would have shipped. Five of
them were found by measuring a distribution rather than reading the code — and
three were cases of the majority outcome being treated as an exception.

### 29.8 Piece 8: the press room

Twenty questions across nine triggers (`data/pressers.ts`), selected and priced
in `engine/press.ts`, raised on the same beat the wire is written.

**Every trigger is a fact the season already produced** — a streak it counts, a
result it recorded, a bracket it settled. Nothing is measured specially to feed
this, which is what keeps a press conference a consequence rather than a
scheduled event. `SEASON_CAP` is 8 and `COOLDOWN_GAMES` is 4: the triggers are
lumpy, and a bad fortnight without a cooldown is a fortnight of talking instead
of a fortnight of baseball. An elimination passes the cooldown and nothing
passes the cap.

**The badge lean is the whole reason H7 was built.** An answer names a badge;
wearing it makes the answer land, not wearing it costs a little. Without the
badges these answers are flavour — with them the same sentence is worth
different amounts to two coaches. `tests/press.test.ts` holds it from both
sides, because the offers desk shipped each failure once: weighted hard the
badges decide the answer, weighted lightly they are decoration.

**The lean lands on prestige only, and that was a bug first.** Applied to both
channels it stopped being a lean: half a point rounds a neutral channel to a
whole one in *each* direction, so an answer worth one and nothing swung by three
depending on a badge. Two channels turned a nudge into a verdict. It is also the
truer reading — whether a man sounded like himself is a question about his
reputation, while the board is judging what he actually said.

**Morale is deliberately absent.** The plan named prestige, morale and how
recruits see you. There is no morale system until stage 8, and wiring an answer
to a number that does not exist is how `Builder` shipped as a title nobody could
wear. Prestige is read directly by `recruiting.ts`, so "how recruits see you" is
not a decorative second number.

Seeded off the world, the year, how many have been faced and the coach's own
name — so a reload cannot re-roll a question, two dynasties are not asked the
same things in the same order, and reading which question is pending takes no
draw from the season generator.

### 29.9 What two seasons of play found, August 28 2026

Sixteen reports; eleven fixed. The full table is in backlog §K. Four are worth
recording here because they are about the *shape* of a mistake rather than one
line of it.

**A state flag with no way back is a wiped save.** `programSheet` moved into the
store so an inbox card could address the program page (§29 passim). The coach
sheet renders its own frame with no tabs, and the overlay's back bar belongs to
the overlay — so closing the overlay left the flag set and the PROGRAM *tab*
then had no exit at all. The lesson is not "add a back button": it is that any
state which survives the screen that set it needs an exit on every screen that
reads it.

**Two definitions of the same word, twelve lines apart.** `--clay` is commented
as "the accent: active states, rules, alerts" and, in the block added for the
trophy colours, as the colour those cards had to be kept away from *because it
reads as a loss*. Both were written deliberately and neither is wrong; the
collision was invisible until it painted a bracket. Identity now has `--you`.

**A flag read one step before it becomes true.** The hall ballot excludes
`activeIds(season.teams)`, which is the right definition read at the one moment
it is stale: `reinstate` puts a man back during the draft step and the ballot
runs on leaving it. Fixed by reading the statement rather than its consequence —
a draft outcome of `'stayed'` *is* "still in the league".

**A number calibrated for one role, applied to another.** The bullpen hook's
`budget` is `30 + stamina`, fitted to a Friday starter. Applied to a reliever it
allowed sixty pitches before the flat twelve and the hook policy were added on
top, so a patient bench left a 35-stamina arm out for ninety. The hook change
moved the whole draw sequence, so the goldens were re-recorded: 5.325 runs a
game against a 5.300 target, worst deviation 4%, all ten NCAA tolerance tests
still passing.

Prestige was the one balance change here and it was measured rather than
argued. The first attempt — regionals worth 5, the slow fall applied to every
program — took the league mean from 54.1 to 61.1, dropped the spread from 17.7
to 14.6 and emptied the bottom star bucket entirely. Regionals at 2 with the
slow fall confined to programs already above 70 lands at 56.5/16.7 with the
bottom tier intact.


---

## 30. The roster — **STAGE 8, SHIPPED**

Five things, four engine modules and two screens. The whole stage rests on one
decision repeated four times: **everything new is derived or sparse**, so a save
written before it has nobody failing, nobody sitting, nobody settling and no
depth chart — rather than everybody.

### 30.1 Position competence is a penalty on a ladder

`positions.ts`. The defensive spectrum, which baseball has had for fifty years:

    DH — 1B — LF — RF — 3B — CF — 2B — SS — C

Downhill is free, uphill costs `PER_RUNG`, and catcher carries `CATCHER_TAX` on
top. Secondary positions are **derived** from the ladder rather than generated
onto a player, for the reason every derived thing in this codebase exists: a new
field at generation moves every random draw after it and breaks every golden.

**Catching is off the ladder in both directions**, and that was a fix rather
than a design. Read as a single ladder, a spectrum that puts catching at the
hard end says every other spot is downhill from it — so the chart offered a
catcher as free cover at shortstop. Catching is at that end because it is the
hardest position to *fill*, not because catchers are the best athletes; they are
usually the slowest men in the building. `OUT_RANK` gives catching a low rank on
the way out, so a catcher goes to first and to left — where catchers actually go
— and is out of his depth at short.

Found on the screen, not by a test. The arithmetic was right and the model was
wrong, which is the failure mode a test suite is worst at catching.

### 30.2 The chart, and why the incumbent leads

`depthChart.ts`. A ranking per position and a lineup card are different facts;
the chart owns *who plays where* and `team.lineup` keeps owning *what order they
hit in*.

Three bugs, all caught by its own tests. A man taken must be a man **spent**, or
the naive pass puts the shortstop at short, second and third at once. Spots fill
**hardest first**, because filling first base first takes your shortstop and then
nobody can play short. And the third was the one that mattered:

> Ranked purely on merit the chart re-picked **94 of 96** lineups on day one.

Correct in baseball terms — a good bench middle infielder really is a better left
fielder than a weak corner outfielder — and catastrophic in practice, because the
lineup is what the simulation plays. The incumbent now leads his own spot, so the
chart's day-one answer *is* the card the generator wrote, and it differs only
when somebody cannot play. Which is the entire job.

### 30.3 How availability reaches the field

`coverFor` is a **post-process** over the card `restedLineup` already chose, not
a lineup builder. Rebuilding the card would duplicate or replace random draws.
It returns the *same array* when everybody in it can play — every game in the
country except the ones where the coached program has somebody out. The goldens
reproducing exactly is the proof.

### 30.4 The classroom

`eligibility.ts`. The user's program only: ninety-five other rosters losing
shortstops to a classroom is a slower roll and a bigger save to model something
nobody can see or act on.

Visible and manageable rather than a hidden roll, because a number you could
have seen and did not act on is a decision you got wrong, while a hidden roll
that takes your shortstop out of a regional is a punishment.

**It shipped with 'trouble' unreachable.** The distribution floored at 34 while
`FAILING` is 28, so no man in the country could be in the state the feature
exists for — the same mistake as a title nobody could wear, caught the same way,
by a test that asks for a man in it. Reshaped to span the scale with the skew
doing the work: **15.7% at risk, 5.3% failing.**

**And it ran in the wrong place.** The check lived in the store's news hook,
which fires *once* after `simSeason` returns — so SIM SEASON checked a single
week, the last one, after every game had been played, and the worker path could
not have called back into the store at all. It now runs inside `simNextDay`,
gated on `captureBoxFor`, and writes a log the store reads for its cards.

Managed by **"a word with him"** — four a season, on the player's card, the same
shape as the three letters and the draft's keep budget. Deliberately not money:
the economy is stage 11.

### 30.5 Redshirts and moves

`redshirt.ts`. The real baseball rule, which is stricter than football's: no
four-game grace, one appearance burns the season, so it is all or nothing.
Freshmen and sophomores, once in a career, three a season, `REDSHIRT_GROWTH` of
0.85 — a redshirt who came back better than the man who played would make
sitting everybody correct.

Moves are instant on the card with a settling penalty that decays over two
seasons, and uphill moves settle harder. Not position *training*: a man is here
two to four years, and spending one teaching him second base spends most of what
you have.

### 30.6 What is deliberately not here

**Two-way players**, split out on the same reasoning stage 5 was split: one man
in two rating systems with fatigue crossing both, a lineup card and a rotation
both claiming him, and every leaderboard deciding which half it ranks. Not a
small feature in a big hat.

**Morale**, which stage 9 brings. The press room wants it and does not have it,
and wiring an answer to a number that does not exist is how `Builder` shipped.

**Declining the DH.** Assigning the slot ships — the chart's DH row is a ranking
like any other and the coach decides who fills it. Letting the *pitcher* hit
instead does not, and the reason is the same one that split two-way out: the
batting order is `Hitter[]` and a pitcher has no hitting ratings at all, so it
needs one man modelled in two rating systems at once.

A toggle was built, wired to the store and put on the screen before that was
noticed. It was then removed rather than left in, because a control that changes
nothing is the exact fault this project spent the previous stage deleting —
"a control that is visible and refuses is worse than one that is not there."

## 31. Players as people — **STAGE 9, SHIPPED**

Injuries, workload, morale, the promise and the captain. Same discipline as the
two stages before it: everything derived or sparse, so a save from before it has
nobody hurt, tired, unhappy or leading.

### 31.1 Injuries are league-wide, which grades are not

The opposite call to the classroom, and for the opposite reason. Nobody can see
another program's grades; a rival losing his ace is visible, it changes the team
you are about to play, and a league where only the coached program breaks down
is lying to you.

Asked for as **pure chance** with no durability rating. That makes *where the
roll comes from* matter more rather than less — a hidden roll a reload could
re-roll is a slot machine — so it is derived from the man, the day, the year and
the world, and takes no draw.

Rates are pinned as a measured season rather than as a constant: about one man
per program per year, mostly a weekend, season-enders roughly once every three
springs.

### 31.2 The two bugs a single game could not have shown

**Fielding eight.** `coverFor` returned a short card when a roster ran thin —
unreachable until injuries went league-wide, then reported as "Dubuque River
Riverboats has an empty lineup slot". A program with five men down runs somebody
out there who should not be out there. He plays hurt, and the cost lands on the
coach who ran out of players.

**A man hurt on the same day every year.** `hurtsToday` hashed the player, the
day index and the world seed. The day index restarts every spring and the seed
never changes, so a man hurt on day twelve in 2027 was hurt on day twelve in
2028 and every season after. Chronic injuries, the same men, for ever.

Worth recording how that one was found, because the method was wrong even though
the finding was right: it was noticed while chasing a drop in champion
diversity, which across the session read 14, then 16, then 13 distinct winners
in thirty five years. That figure is noise and diagnosed nothing. The bug is
real on its own terms and would have been just as real if every measurement had
come back clean.

### 31.3 Why the goldens did not move

They drive `simGame` rather than the season's day loop, so they measure how a
game is *played* — which an injury does not change. What it changes is who is
standing in it. The multipliers are identity at baseline too: a player with no
accumulated workload and no moved mood multiplies by one, so the systems are
inert until used.

### 31.4 Workload: slight on the bat, not slight on the odds

Asked for in those words — "very slight, we don't want the roster dead after a
few games". Three percent off the bat at the floor; two and a half times the
injury risk. That asymmetry is the design: the cost of running a man into the
ground is that he gets hurt, not that he forgets how to hit. The arm carries a
separate season-long mileage that multiplies with in-game fatigue.

### 31.5 Morale, and a promise you can break

Performance and transfer risk. **Not development** — a man who is unhappy does
not get worse at baseball, and compounding it into development would be a death
spiral rather than a mood.

The expectation is **stated** rather than inferred, which is what makes it a
promise: recruiting a man on the offer of a job and then sitting him is a thing
you did. A broken promise costs about twice what a kept one pays, deliberately —
a man given more than promised is pleased, a man given far less is aggrieved,
and it is the second that eventually walks out of the door.

`flightRisk` is written and read by nothing. It is stage 10's, and it exists now
because the mood that drives it is being modelled now; a number added in a hurry
against a shipped system is the more expensive order.

### 31.6 The captain is the trait gate

One, appointed, and he must hold a `makeup` badge — `gymRat`, `noPanic` or
`bigStage`. Without that gate naming a captain is a free buff applied to your
best player and the answer is the same man every year; with it the question is
who in this room is actually like that, and sometimes the answer is nowhere near
your best. On the roster this was verified against, one man of twenty-three
qualified.

He **damps swings in both directions and makes nobody happy**. That distinction
is the whole design: a captain is not a morale bonus, he is the reason a bad
April does not become a bad year.

## 32. The transfer portal — **STAGE 10, SHIPPED**

The plan was one sentence — *both directions or it is not a portal* — and it was
the whole specification.

### 32.1 It is the bill for stage 9

Nothing here invents a reason to leave. `flightRisk` has been computed off
morale since stage 9 and read by nobody, waiting for this, and morale is driven
by playing time against what a man was *told*. So a man in the portal is a
promise somebody broke.

The corollary is the part worth defending: **a coach who keeps his word mostly
does not lose people**. There is a test for exactly that — a roster of men who
are settled and playing loses nobody at all. If the portal ever reads as a
lottery, the fault is in morale rather than here.

The second door is being buried: a man well below what he was told goes
sometimes whatever his mood says, which is the case college coaches actually
lose people to.

### 32.2 Rivals shop it, and leaving that out was a real bug

The first version had the other ninety-five losing men and signing none, so
everybody who entered simply evaporated — off the roster he left, onto nobody's,
out of the league. Wrong twice: the pool you sign from should be other programs'
broken promises, and a man still playing college baseball somewhere must not
turn up eligible for a hall of fame two steps later.

Cheapest-first, at most two apiece, so one rich program cannot hoover the board.
Whoever is left after ninety-five staffs have shopped has genuinely left college
baseball, which is a real thing that happens to transfers.

### 32.3 Where it sits, and what moved to make room

Between the draft and recruiting. Both of the steps before it are men *leaving* —
the draft takes the ones a club wanted, the portal the ones you gave a reason to
go — and recruiting comes after because a coach who has not found out who walked
out cannot know what he is shopping for.

Inserting a phase moved two things that had been riding on the draft→recruiting
boundary: the draft board's own settling, and the hall of fame ballot. Both were
moved back to the draft's boundary rather than left where they landed. A man
sitting 'pending' on the board while the coach works the portal is a decision
the game is pretending is still open, and the hall's own comment says "when the
draft settles".

### 32.4 The budget, widened as asked

`RECRUITING_BUDGET` goes 40 → 56. This pool has always paid for the class and
for keeping a man the draft took; the portal makes a third claim on it in both
directions, and a third claim on money fitted for two is not a harder decision,
it is a thinner one. Reported in those terms: too little for too much.

Measured league-wide over thirty-five years: clear rate 65.6% → 64.8%, prestige
56.2 → 56.3, turnover 8.2 → 8.4 chairs a year. Noise, because recruiting is
close to zero-sum — everybody got more and the prospect pool did not grow.

### 32.5 The bug only playing it could find

**The portal screen had no way out.** Every other offseason step supplies its own
pinned action; this one shipped without one, so the rail reached the portal and
stopped — the offseason could not be finished at all.

No test caught it and no test would have: every test in this repo drives
`nextPhase` directly and never has to find a button. It surfaced within two
minutes of actually playing a season. That is the argument for playing a stage
before calling it done, and it is the third time this project has been paid for
doing so.

## 33. NEEDS YOU, and the end of the interruption — **SHIPPED, August 29 2026**

`src/ui/Needs.tsx`. A panel at the foot of the home screen listing what is
waiting on the coach, in place of the conference scoreboard that used to sit
there.

**Why it replaced what it replaced.** Asked for directly — *"I'm thinking on
removing the last games thingy in the home screen and change it for something
like NEEDS YOU"* — and it is the better use of the space. The scoreboard was
eight results the coach could do nothing about, sitting directly under the one
button that moves his season. Meanwhile the things he *could* act on had nowhere
to be, with the consequence that the press room got itself a screen by
interrupting and an injury got itself nothing at all. Conference results have not
been deleted; SCHEDULE has every one and CONFERENCE has the table.

**The press room stops being an ambush.** It was returned from `App` ahead of
every other branch, with a comment defending the choice: *put it in a tab and it
becomes a thing you can walk away from, which is the one shape it must not have.*
That argument was wrong, and it is worth keeping the note. It bought attention by
taking the screen away from somebody in the middle of doing something else, and
it was the only thing in the game that did — everything else here happens, gets
written down, and waits to be looked at. It is an overlay now, opened from the
panel, and what keeps it from being ignored is that it sits at the top of the
home screen in red.

*It also, being the one screen returned without an `.app-frame` wrapper, escaped
the 430-pixel phone frame entirely: `FixedHeader` is `position: absolute; inset:
0`, and with no frame around it the nearest positioned ancestor was the window.
Reported as the press room "expanding the screen out of its regular mobile size".*

**Two severities, and the line between them is not importance.** `must` — drawn
in `--clay`, with a count in the header — is a thing the game *cannot do for
you*: a question only you can answer, a job only you can fill. Everything else
resolves itself if ignored.

| Need | `must` | Why |
|---|---|---|
| A press conference waiting | yes | Only you can answer it, and it goes stale. |
| A man in your nine who cannot play | yes, in a full career | The card is not finished. |
| Nobody wearing the C | no | A vacancy, not a problem. |
| A man failing his classes | no | He is already sitting out; the registrar decided, not you. |

The hurt-starter row appears **only in a full career**, and that is the depth
mode rule stated exactly: in a casual career the bench coach writes the card, so
the same fact is not a decision and is not raised. Either way the man is hurt and
either way somebody covers him — the mode changes what the player is asked, never
what the simulation does.

**It renders nothing when there is nothing waiting.** An empty NEEDS YOU reading
"nothing needs you" is a piece of furniture that teaches the eye to skip the
place where urgent things appear.

## 34. The low-star climb — **SHIPPED, August 29 2026**

Backlog §P carries the measurement and the three rejected levers. What is in the
engine:

| Symbol | Where | What |
|---|---|---|
| `CLIMBING_UNDER` | `program.ts` | 45. Above it none of this does anything. |
| `climbLift(current)` | `program.ts` | 1.7× at 5, 1.0 at 45. Scales achievement terms only. |
| `programTarget(current, o)` | `program.ts` | `seasonScore` seen from where the programme stands. |
| `DROUGHT_GRACE` | `program.ts` | 3. Under it a climbing programme falls at a quarter rate. |
| `TeamRecord.drought` | `season.ts` | Sparse; counted for all ninety-six. |

**The one thing to understand before touching it:** `programTarget` is
deliberately *not* a prestige argument added to `seasonScore`. `seasonScore`
answers "how good was this season" in the absolute, and three other systems read
it that way — most importantly `nextCoachPrestige`, which measures a coach as
`seasonScore(o) - programPrestige`, i.e. overachievement. Fold the school's size
into the score and a coach at a one-star programme is paid twice for the same
regional, which would make the smallest jobs the most rewarding in the country.
Two questions, two functions.

## 35. What the classroom actually costs — **RETUNED, August 29 2026**

`failsThisWeek` ran at 3.27 suspensions a season and was reported as happening
"way too often". It was.

The cause is a number nobody set and everybody assumed. The check runs on
`season.dayIndex % 7`, and a regular season here is about forty-five days — so it
is asked **six times a year**, not the fifteen-odd a real spring would have. The
old 7%-to-23% band was a sane per-week rate for a long season; against six checks
it meant somebody was in the classroom better than every other week.

Now `0.008 + depth * 0.09`, measured at **1.07 a season** by
`tests/elig-rate.ts` — which is a new probe and exists precisely because this
number is the product of three others (the at-risk share, the number of weeks,
the per-week chance) that were each set independently and never multiplied
together.

`failsThisWeek` also never fires twice running: it asks the same pure function
about last week and refuses if it said yes. A man who sat out has had the
conversation and the fright, and taking him again immediately is the game
repeating itself. Done by re-asking rather than by remembering, so it still costs
no field on the save and no draw from any generator.

## 36. When the field says a play is over — **FIXED, August 29 2026**

`Diamond3D.playPlan` grew `outcomeAt`, and the colour flash hangs off it rather
than off the ball landing.

Reported: *"when a hit is out, it still goes out of the player's dot into the
green area and then blinks red, it makes it look like it was actually a hit."*
Exactly right, and the reason is that the landing and the decision are the same
event for only two of the three cases:

| | Decided at |
|---|---|
| Caught | arrival — the catch *is* the out |
| A base hit | arrival — it landed and nobody was there |
| Fielded on the ground | when a man actually has it |

The third was being drawn as the second. A grounder flashed red the instant it
touched grass, several yards past the nearest dot and a second before anybody
reached it — which is precisely the picture a single makes, so the field was
announcing an out using the image of a base hit. The red now goes off in the
fielder's hand and rides a little way into the throw.

The expanding ground ring went with it, and for the same reason: a red ring
opening in the outfield is the single most hit-looking thing this scene can draw.
It is hits only now. A grounder is told by the fielder having it and the throw
going across, which is how it is told on a television.

*This is the second fix to this animation and the first one was also correct.
The earlier bug was the blink lasting the entire chase — up to four seconds of
red light in the gap. Shortening it was right and did not touch the timing,
because the timing did not look wrong until the duration stopped hiding it.*

## 37. The design of record — **STAGE 10.5, SHIPPED August 30–31 2026**

The port that stopped the app being two designs. A full mockup — the *Roster
Tabletop* proposal, vendored at `design/Roster Tabletop/` — became the design
of record, and every screen was moved onto it.

**The stylesheet is generated, not written.** `scripts/adapt-prototype-css.mjs`
reads the mockup's CSS and emits `src/ui/prototype.css`: token renames, every
fixed pixel size rewritten as `calc(Npx * var(--ts))` so the text-scale setting
reaches everything, and literal colours mapped onto surface tokens (`#fff` →
`--paper`, the wash family → `--wash`, selected tints → `--soft`, strokes →
`--line`, greyed ink → `--mute`, chrome bars → `--field`). **Edit the script's
transforms, never the generated file.** `src/ui/prototype-frame.css` holds the
hand-written joins and loads after.

**Everything that covers the screen goes through one door.** `InFrame`
(`src/ui/Overlay.tsx`) portals sheets, scrims, the action button and tutorial
cards into `.app-frame` at z-60. Absolutely-positioned layers inside iOS
momentum scrollers produced five separately-reported faults with one cause; this
is that cause, fixed once.

**The app wears your school's colours.** `src/ui/accent.ts` fills an
`--accent*` family that the theme blocks read through hooks — never by
overwriting `--clay` directly, because an inline custom property beats *both*
theme blocks and would hand dark mode the light theme's accent. Hue is kept and
lightness is clamped per theme, because school colours are jersey colours: some
are a navy that swallows white text, some a yellow it dies on. The alarm keeps
`--alert` and its own places.

**Theme rules that bind everything since.** Light and dark are both stated in
`tokens.css`, twice each — once under `[data-theme]` and once under
`prefers-color-scheme` — because the default "system" setting stamps no
attribute at all. A colour whose only definition sits inside one theme's block
is the classic unreadable-screen bug. `--scrim-rgb` exists because a scrim built
from `--ink-rgb` flips light in dark mode and goes milky.

---

## 38. The economy, and the staff it pays for — **STAGE 11, SHIPPED August 31 2026**

`src/engine/economy.ts`. A budget, three assistants, four rungs of facilities
and a scouting desk. Everything derived from stable hashes; no draw is taken
from the season generator, so a reload cannot reroll a market.

**The money.** `annualBudget(prestige) = 750 + 13 × prestige`, in $k. A
one-star programme gets about $1M a year and a blue blood about $2M. `wageFor`
rounds to the nearest $5k.

**The staff.** Three seats — hitting, pitching, recruiting — each with three
candidates a year from `marketFor(worldKey, year, seat)`, banded so the seats
differ in what they cost and what they offer. Each candidate's name, age and
rating are hashed *separately* (`hash(id + ':f')`, `':l'`, `':r'`, `':a'`); one
hash shifted three ways produced three brothers sharing a surname.

`staffBonus` is deliberately small: hitting adds `rating / 5` to the coach's
offense, pitching the same to defense, recruiting `rating / 4`. Training belongs
to facilities, not to a man. `withStaff` caps the total at 99.

**What it is worth, measured rather than asserted.** `tests/staff-probe.ts`
isolates each channel at its extremes: offense 20 → 99 is **+2.02% runs**,
defense 20 → 99 is **−1.73% runs allowed**. Small by design, and the reporter
confirmed that is the intent — *"they have to be small, not to give a super
advantage."* The probe also documents the noise floor: an effect of 0.4% needs
roughly 500,000 games to see, and an early run that showed better defense
allowing *more* runs was noise, proven so by the extreme-isolation sign test
rather than by hope.

**Facilities.** Four rungs at 0 / 500 / 900 / 1400, paid once, worth
`trainBump` 0 / 3 / 6 / 9 to development and `devPitch` 0 / .06 / .13 / .2.

**The scouting desk.** `SCOUT_COST = 35`, `SCOUT_DAYS = 10`. Buying the book on
an opponent is what opens their tendencies: `isKnown(slot, watch, isOurs,
opponentScouted)` gates every opponent read on it, and an unbought book prints
*"No book"* rather than a number.

**Winter.** `poached(assistant, year)` takes 25 / 12 / 4 percent of men rated
≥70 / ≥55 / below — being good costs you your coordinator. An athletic director
runs the staff and the buildings for a career that asked for it (`handles(depth,
'assistants')`, `'facilities'`), and only builds with a season of headroom left.

---

## 39. The world: the rivalry and the map — **STAGE 12, SHIPPED August 31 2026**

`src/engine/world.ts`.

**The rivalry.** `rival` sat in the school data doing almost nothing. There is
now a career ledger against that school, banked at the year roll from
`headToHead(season, a, b)` and **reset when you take a new chair** — a rivalry
belongs to the job, not to the man. The Today card prints it in alarm ink the
week the fixture comes round, and `seriesStake(gamesPlayed, yourWins)` says what
tonight settles: *A win takes the series* / *The decider* / *The sweep is on the
table* / *The salvage game* — and nothing at all when nothing is settled. Every
rivalry game in the country makes the wire under its own chip, weighted above
everything but a ranked upset.

**Realignment.** `realignmentFor(worldKey, year, teams, userTeam)` fires when
`hash(worldKey:realign:year) % 100 < 34` — about one winter in three. It is a
**trade**: the riser is the programme furthest above its own conference's
average (gap ≥ 15), the faller is the weakest team (never yours) in a stronger
conference that has slid ≥ 12. One-for-one, because equal-sized leagues are the
scheduler's invariant. `applyRealignment` writes `t.conference`, which is what
the next schedule is built from, so the leagues simply *are* different in the
spring. Your chair can be invited up and is never the one relegated.

*Open, recorded September 1:* the swap ignores geography — a 2028 run sent
Piedmont State to the Pacific. With "the conference **is** the region" as a core
fiction, adjacency should be preferred.

---

## 40. The dynasty remembers — **STAGE 13, SHIPPED August 31 2026**

`src/engine/legacy.ts`.

**Signature moments.** Caught at `recordResult` in `season.ts` — the one funnel
every user game passes through — so a moment cannot be missed by the route the
game was played on. Eight kinds: five hits, four hits, three homers, a big day,
a walk-off, a no-hitter, a shutout, a strikeout show. Capped at
`MOMENT_CAP = 12` per man, and the cap drops the **least** of him rather than
the oldest, by a rank table (no-hitter 7 … strikeouts 2). June nights are
marked.

*The walk-off needed the engine to learn a name.* Nobody was writing down who
ended a game, so `TeamState.walkOffBy` is stamped at the three engine sites that
say *"win it."* — the walk, the bunt and the hit.

*And it needed the keys fixed.* `noteMoments` takes **arrays** carrying their
own `id`, because the engine's per-game line maps were keyed by name at the
time; the first version wrote the book under `"Percy Bedford"` while the card
looked it up under `p1dk5k94`, and every card came back empty. (The maps
themselves were re-keyed to the id on September 1 — see §42.)

**Alumni.** One durable note per departed man (`AlumnusNote`) and everything
else *derived*: `proCareer(id, note, throughYear)` replays the same life every
time it is asked. Start level by round (≤2 → Double-A, ≤5 → Single-A, else
Rookie Ball), `talent = overall − 55 + (3 − min(3, round)) × 4`, a wash-out
chance that climbs with age and falls with talent and level, a move-up chance of
`min(72, 34 + talent)`, and a 9% All-Star summer at the top. Undrafted men get
one honest line; 18% sign somewhere independent for a summer.

*Careers end* (added September 1): after eight professional seasons the odds of
a last one climb by 11 points a year and nobody plays a twentieth. Measured mean
career **8.8 years**, longest 20. Before that, washing out was the only exit and
it floors at 4% at the top of the pyramid, which is how the reporter ended up
with a twenty-two-year All-Star.

---

## 41. Broadcast — **STAGE 14, SHIPPED August 31 2026**

**Sound.** `src/ui/sound.ts`: one WebAudio context, unlocked by the first touch,
samples cached by *name* so a better recording is a file swap. A crowd bed loops
under the live game with a floor that follows the leverage
(`0.08 + level × 0.2`) and swells with what just happened. `buzz()` mirrors it
in haptics. Both default **on**, with a `bcast` marker in `devicePrefs` so that
values stored while the toggles were disabled placeholders are not mistaken for
choices.

*The clips are the reporter's own freesound downloads, processed by
`scripts/prep-sfx.mjs`* — a hand-written WAV **and AIFF** parser (no ffmpeg on
the machine, and browsers cannot decode AIFF), downmix, resample to 22 kHz,
trim, fade, normalize, 16-bit out. 7.3 MB became 740 KB. `public/sfx/CREDITS.md`
lists every id and author; **the licences must be verified before store
release** — CC-BY needs the credit shipped and NC cannot ride with paid IAP.

*The dugout reads its own log.* The broadcast classifies the lines the play just
appended against the engine's full `OUT_TEXT` vocabulary — the first version
read only the last line, and the engine writes several per play, so fielder's
choices, errors and bunts were silent. The catch is timed to the flight the
screen draws (ground ~600 ms with the throw at ~1350, air ~1750), and every
scheduled sound is cancelled when the next play starts, or a fly ball's glove
lands during the following swing.

**Crests.** `src/ui/Crest.tsx` draws all ninety-six procedurally: silhouette,
field division and device hashed from the abbreviation, field in the school's
colour, monogram on top. No image assets, and the same school wears the same
shield forever. **Do not add drawn randomness here.**

**Takeover cards.** `BigMoment` in the store, offered through `offerBigMoment`
and ranked so that a walk-off which clinches something bigger loses the screen
to the clinch. Seven kinds, and the two loss tones are deliberate: being walked
off, and losing a final, get a colour-drained room and silence.

**The scoreboard's tones.** From the sixth inning of a no-hitter the linescore
takes a gold edge and a flag reading DON'T SAY IT; late and within two runs it
takes the accent edge and the inning marker breathes.

**Awards night** is a ceremony *once*: face-down cards, a real 3D flip per tap,
the tallies withheld until the last card so they cannot spoil the envelopes,
paper thrown when a winner is yours, and a skip for people who want the list.
Every later visit is the plain list — `phase !== null` is the whole test.

**The wire, upgraded.** Realignment and the poached assistant are stamped onto
the *new* season at the roll (`newsRealign`, `newsStaff`) and fade as results
accumulate; `recordChase` reports a run at a season record **before** it falls,
quoting the mark it will have to beat, one chase at a time.

---

## 42. What a thirty-season save found — **SHIPPED September 1 2026**

A single long play session produced more defects than any deliberate audit has.
Recorded here in full because several were invisible from inside the code.

### The bugs

**Stats were keyed by name.** `TeamState.batting`, `pitching`, `fielding` and
the times-through counter were `Map<name>`, so two men sharing a name on one
roster **shared one line** — at-bats and innings added together, one of them
printed twice in the box. Keyed by `PlayerId` now. Season-level maps were always
id-keyed; this was the per-game layer alone.

**AUTO could not bench anybody, by construction.** `autoBattingOrder` is a pure
reorder by contract — it never sees a bench or a day — and nothing sat above it.
`fitTheNine` (`depthChart.ts`) is that layer: every unavailable starter is
swapped for the best available cover, his own position preferred. The staff's
automatic card gets it too; a casual career was the one place nobody was told
and nobody moved.

**Hurt arms still took the ball.** Availability was never asked on *any* pitcher
path. The schedule names a rotation **slot**, not a man, so `startableSlot`
walks forward to the first arm who can pitch, and the relief queue filters.

**`regroup` built position-blind nines** — nine hitters off the top of the
survivors in arrival order, which routinely made two catchers and no shortstop
between the draft step and signing day.

**Three quarters of every recruiting class carried the wrong growth curve.**
`projectPotential` reserves its projectable-freshman clause for FR, and
`generateClass` stamped `classYear = 'FR'` *after* each man was built — so a
recruit drew a random class year, got that class's curve for life, and the
hidden-gem clause fired at a quarter of its written rate. The class is passed in
now. Mean headroom **6.0 → 12.7**, real sleepers **1.75% → 8.6%**.

**The player's board was never corrected for league drift.** Every rival board
is handed `leagueShape` and moved back onto the calibrated middle, because the
country's mean roster climbs about ten points over thirty seasons. The player's
was not, so the entire drift landed on him. Fixed.

**`Team.quality` was welded down.** Prestige has moved for all ninety-six since
B7, but the number every walk-on is drawn against was written once at world
creation — a forty-point gap frozen in place, and most of why the pecking order
could not move.

### The tuning that followed

| Change | Measured effect |
|---|---|
| Service noise ±13 → ±26 on the projection half | Star bands still mean something (5★ ceilings median 82, 1★ 48) but the tails now overlap — busts and steals exist |
| A winning record scores at `develop` and `build` | 44 seasons in the pinned sweep move met → exceeded; missed and failed do not move at all |
| `PLAYER_RENEW_BAR` 45 → 38 | 90 fewer coaches lose the job. Tried at 34 first: it caught nobody, and a rule that never fires is worse than a harsh one |
| `driftQuality` at 12% of the gap a year | Top-twelve turnover over 30 seasons went 4 → 6 programmes; mean movement 14.9 places of 96 |
| Retention credibility floored (`ring`) | The same round-five junior no longer costs a one-star programme ~2.5× what it costs a blue blood |

*Recorded and not fixed:* prestige runs away to the mid-90s for a handful of
programmes over thirty seasons. Measured with `driftQuality` switched **off**
and it is unchanged — it is a property of `nextPrestige`, not of this pass.

### Position fit reaches the simulation

The engine had no opinion about where a man stood. `TeamState` took *the first
man at each spot* and let the rest not exist, so a covered nine with two
catchers and nobody in left defended exactly like a sound one, and
`positionPenalty` / `fieldingAt` existed purely to colour the depth chart.

The nine are assigned to nine distinct spots now — `FIELD_ORDER`, hardest first,
DH last, the same ranking `startersFrom` uses — and each is passed through
`fieldingAt`, which drops range, hands and arm by what the move costs him. **The
bat is untouched.** Defence, the outfield arm and the catcher are all read off
the men as they actually stand.

| | penalty off | penalty on |
|---|---|---|
| sound nine | 7.293 runs allowed | **7.293** |
| covered nine | 7.100 | **7.188** |

That first row is the design property and the reason this landed with **no
re-calibration**: for a sound nine every man's own position is his cheapest, so
the assignment is the identity. Protect it — `tests/posfit-probe.ts` checks it
directly, and the two false starts are kept in that file because they are the
finding (shuffling a batting order measures nothing; swapping in a man from
another club measures the body, not the position).

A free win falls out: given two catchers and no shortstop the assignment does
not put a catcher at short, it slides a real infielder across and hides the
catcher at first.

### The screen

**Dark mode was measured, not eyeballed.** Contrast between surface pairs ran
**1.04 to 1.24** — `wash` against `field` at 1.04 is no edge at all — and
`--mute` failed body text everywhere it was used (2.2–2.7 against the 4.5 a
reader needs). The dark theme has a real ladder now: backdrop, field, wash,
paper and band step apart, `--line` went 1.24 → 1.62 against paper, `--mute` to
4.75. The alpha borders are restated stronger **in the dark blocks alone**,
because the same percentage of a light ink on a dark ground reads far weaker
than a dark ink on paper; the light theme measures fine and is untouched.

**The college profile was never ported.** `TeamCard.tsx` carried its *own*
`Head`, `Panel`, `Note`, `Tile`, `Stat` and `Meter` — the same names as the
ported leaves in `Program.tsx`, but the pre-port originals with fifty-three
inline style objects. One screen's copies were updated at the port and the
other's were not, which is why three separate restyling attempts could not reach
it. The six leaves live in `components/Kit.tsx` now.

**Injuries follow one rule: nobody is moved for you.** The old must-need scanned
`startersFrom`'s nine — which *filters* the unavailable — so it could never fire
and the chart auto-covered in silence. It scans `team.lineup` now, the array the
engine actually fields; a hurt man in it holds the day until he is swapped out by
hand on the **lineup**, which grew a bench section for exactly that. A recovery
card announces the man walking back in.

**The player profile** grew the season-by-season book on its STATS tab (it
existed, one tab away, behind a label that reads as biography) and an awards
cabinet on HISTORY, scanned out of the season records the dynasty already keeps.


---

## Appendix A: stale comments and vestigial code found while writing this

These are places where a comment or a symbol no longer describes what the code
does. None of them changes behaviour; all of them will mislead the next reader.

| Where | The problem |
|---|---|
| ~~`engine/postseason.ts`, `FIELD_SIZE`~~ | Deleted, along with the `size` parameter on `runPostseason` that was its only use and that the function body never read. `ui/postseasonGraph.ts` carried a private copy of the same constant, also unread, so the two could not have been found by deleting either one; both are gone. |
| `ui/Avatar.tsx`, `ui/screens/Player.tsx`, `ui/screens/Standings.tsx`, `ui/screens/TeamCard.tsx` | Comments still say "sixty four programs" / "the other sixty three". The world is 96. The engine, the state layer and the data file have been swept; these four were outside that pass, and all of it is comments. `Program.tsx`'s was screen copy on the HALL tab and went with B12; `Player.tsx`'s *career* comment went with B13, but the one above `gameLogFor` — "two Tyler Johnsons in a sixty four school world" — was not in that pass and is still there. The one occurrence that reached the screen, the Omaha note in `SeasonReview.tsx`, was fixed earlier. `CoachPortrait.tsx` and `Draft.tsx` also say "sixty-four", about a coordinate box and a draft round respectively, and are correct. |
| ~~`engine/recruiting.ts`, `RECRUITING_BUDGET` docstring~~ | Fixed. It opened "Thirty, spread across as many recruits as you like" over a constant of 40. |
| `engine/scouting.ts`, `PotentialGrade` | `'?'` is documented as what a screen prints where a ceiling is none of your business. No screen uses it; `ui/screens/Player.tsx` prints an em dash instead. |
| `engine/recruiting.ts`, `BOARD_SLOTS` | Marked `@deprecated`, still used by `aiTargets` to size a board. `ACTIONS_PER_WEEK` beside it is now genuinely unused — `aiTargets` reads `weeklyBudget` (§14.7) — and is kept only as the record of what the flat week was. |
| ~~`engine/program.ts`, `objectivesFor` docstring~~ | Fixed by making the code true rather than the comment weaker. It claimed winning the conference was "a bonus for a contender and a requirement for a championship program" while passing `confTitle(false)` in both places. §6.3a. |
| ~~`engine/program.ts`, `Expectation.expectsTournament` / `expectsConference`~~ | Deleted. Computed in `expectationFor` and read by nothing; they became a second opinion about the ask that was also *wrong* the day contenders stopped needing a bid, which is exactly what `judge` reading the checklist and nothing else exists to prevent. |
| ~~`program.test.ts`, the pinned sweep's fourth season~~ | Fixed. It reached the national field without winning its conference, which cannot happen in a format whose field is the eight conference champions. |

## Appendix B: undetermined

Things this document could not settle from the code, and must not guess at.

1. ~~**Tendencies.**~~ Answered, and built. Nine slots, the poles and channels of
   each, the population split that keeps them power-neutral, and a discovery
   mechanic for how they surface on your own men. §18.3 and §18.4.
2. ~~**The scope of the planned records book.**~~ Answered, and built: league-wide
   single game, single season, career and team marks, plus every coaching career
   in the country, seeded with real NCAA records where a real mark could be
   verified. Career records were the last piece and were deferred on a cost claim
   that turned out to be about the wrong implementation; §13.6 has the
   measurement. See §13.
3. ~~**Badge channels and situations.**~~ Answered, and built: twenty-three
   badges, each naming one channel and one situation, with the situation defined
   as a field on `Situation` that `game.ts` fills in once per plate appearance.
   §18.5 and §18.6. One question it raised is still open and is recorded there:
   about a percentage point of the league's walk deficit is unexplained by the
   per-plate-appearance arithmetic, and wants the same isolate-and-measure
   treatment that found the pace channel. §18.8.
4. ~~**Whether the `raw` projectable draw survives the S+ gate.**~~ Answered: it
   does, untouched, at about twenty hidden gems per class before and after. §12.3.
5. ~~**`ACTIONS_PER_WEEK` for the AI versus `budgetFor` for the player.**~~
   Answered, and it was not intentional. `aiTargets` reads
   `weeklyBudget(pitch.stars, spentOnTheDraft)` now — the same call the user's
   board makes — so an AI program's week is its own prestige tier's, less what it
   spent in June. Fixing it was the precondition for letting the other ninety
   five keep drafted players at all: a budget nothing could reduce would have
   made that money free. §14.7.
6. **How the offseason `coach` phase interacts with unspent points across years.**
   The screen says points "do not carry over well"; the data carries them over
   fully. Whether the copy is loose or the intended decay is unbuilt is not
   determinable from the code.
7. **The real-world frequency of each Coach of the Year category.** The salience
   rule makes this an emergent property of a season's spread; nothing measures it.
8. **The league's caught-stealing rate since §18.** The 30% at second and 36% at
   third in §9.4 were measured before the situational layer existed, and both
   halves of `attemptSteal` now carry a tendency and a badge that were not in
   that population — GREEN LIGHT and STATION TO STATION on the attempt, BURGLAR
   and CANNON on the outcome. The pairs are population-neutral and the badges
   are small, so the figure should be close; nobody has re-run the probe to say
   how close.
9. **The league's error total and fielding percentage since §18.** §10.6 puts
   `fieldingPct` around .960 and `playsAboveExpected` at about minus one per
   team per game, both measured during the fielding work. VACUUM and ON A LINE
   scale the two error rolls and, unlike a tendency, a badge only ever
   subtracts — so the true figures are now a shade above those. The
   eight-seed sweep in §18.8 does not carry an error row, so the size of the
   drift is not known. Adding one is the cheap way to find out.
10. ~~**What moved the star distribution of a generated class.**~~ Answered:
    nothing did. The question was built on two readings of one class, and a
    class is far too small a sample to carry either figure.

    The star counts of `generateClass(2027, 96, makeRng(4242))` were checked at
    every commit from v0.6.0 to the head of the block batch. All ten commits of
    the batch return an identical class to the branch point, so the batch is not
    involved at all. The population distribution — forty classes, `resetNames()`
    before each — has not moved either: 221 / 209 / 165 / 85 / 40 at v0.6.8
    against 221 / 210 / 165 / 83 / 40 now, inside one standard error of the mean
    on every grade, against a class-to-class standard deviation of 5 to 13.

    Two things made a stationary number look like a moving one. A class of 720
    holds about forty five stars, so its top two grades swing by ten percent of
    themselves from seed to seed. And `generateClass` is not a function of its
    arguments: `uniqueName` rejects a name already in the module-level pool and
    draws again, at two random numbers a rejection, so the same call repeated in
    one process returns a different class each time — 143, 126, 134 and 123
    four-and-five-stars on four consecutive calls. Neither recorded figure was
    reproducible from the call named beside it. 223 / 213 / 182 / 64 / 38 in
    particular holds 102 four-and-five-stars, and 250 fresh-process seeds at the
    commit it was written on produced no class below 103 — so it was taken in a
    process that already had a name pool.

    The reach gate went the same way and was answered with it — see §2.4. Its
    rates were then measured against the priority draw, where four hundred
    thousand samples per grade cost less than one class does. The gate has since
    been replaced by a flat one-star-up rule with a pipeline exception, which is
    a property of the star rating rather than of a draw and therefore has no
    rate to measure at all; what is still measured, over twenty four classes, is
    what the rule leaves open at the top of the board.
