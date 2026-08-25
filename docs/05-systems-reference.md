# Systems Reference: what the game does, and what it does not say

**Last updated:** August 24, 2026
**Companion docs:** `01-roadmap.md` for the product and stack, `02-sim-engine-spec.md`
for engine internals, `03-engine-salvage-audit.md` for the forked engine copies,
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
band that is deliberately not centred on the truth, a reach gate that silently
removes half the recruiting board, a coach skill worth 79 ten-thousandths of a
plate appearance. These are the parts of the design that are invisible by
intent, and invisible-by-intent is one bad week away from
forgotten-by-accident. Once nobody can say what a mechanic does, it stops being
a design and becomes folklore, and the next person to touch it either
reimplements it or breaks it.

The **[Hidden Mechanics Index](#hidden-mechanics-index)** below is that register.
It is meant to be complete for what exists today. More hidden systems are
planned — badges especially — and every one of them gets a row in that table on
the day it lands.

## How to keep it current

- **A change to a number is a change to this document.** If you retune
  `reportWidth`, `REACH_LADDER`, `SECURITY_DELTA` or any other constant named
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

> **A note on the working tree.** As of this writing several engine files carry
> uncommitted changes — `types.ts`, `players.ts`, `game.ts`, `season.ts`,
> `progression.ts`, `recruiting.ts`, `scouting.ts`, `program.ts`, and
> `state/seasonCodec.ts` among them. Everything documented here is read from the
> working tree, i.e. from the game as it behaves today. The defensive-attribute
> and fielding-statistics work is marked **IN FLIGHT** throughout; the recruiting
> scouting-report system is marked **SHIPPED** because it is complete, wired, and
> carries close to 300 lines of dedicated tests in `tests/recruiting.test.ts`,
> even though the commit has not landed yet.

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
| 10 | **The reach gate.** A recruit's `minProgram` silently removes him from your board. His own priorities, not a global rule, decide how far he comes down. | "He will not take the call." and a `Min. prestige: ★★★★` line. | `REACH_LADDER`, `reachOf`, `canPursue` — `engine/recruiting.ts` | SHIPPED |
| 11 | **A recruit's priority weights.** The five weights are drawn per player and sum to 1; the screen names them but never prints the weights. | Priority labels and blurbs, strongest first. | `drawPriorities`, `PRIORITY_LABEL` — `engine/recruiting.ts` | SHIPPED |
| 12 | **Fit multiplies effort rather than adding to it.** Hours spent on a recruit who does not want what you have are close to wasted. | A "+N pts a week" figure that is quietly small. | `weeklyPoints` — `engine/recruiting.ts` | SHIPPED |
| 13 | **A five-star costs about 2.65× a two-star in banked points.** | Nothing. | `commitPointsFor`, `COMMIT_POINTS` — `engine/recruiting.ts` | SHIPPED |
| 14 | **Early commitments are a coin-weighted draw**, not a threshold: margin > 0.35 *and* enough points, then a 45% roll. | Recruits committing on some weeks and not others. | `closeWeek`, `COMMIT_MARGIN` — `engine/recruiting.ts` | SHIPPED |
| 15 | **The rest of the league gets two free passes at the board before week 1 opens**, the second at half weight. | A board that is already contested on day one. | `seedRivalInterest` — `state/store.ts` | SHIPPED |
| 16 | **AI programs read a snapshot of the board taken before anyone spends**, so turn order cannot advantage anybody. | Nothing. | `leadersAtWeekStart`, `aiTargets` — `engine/recruiting.ts` | SHIPPED |
| 17 | **AI programs abandon a recruit they are more than 40% behind on.** | Suitors quietly dropping off a recruit's page. | `aiTargets` — `engine/recruiting.ts` | SHIPPED |
| 18 | **An uncontested recruit gets a scaled AI bonus, `1 + 0.18 × stars`.** | Blue chips rarely staying uncovered for long. | `aiTargets` — `engine/recruiting.ts` | SHIPPED |
| 19 | **Recruiting budget scales with your program's star tier**, 40 up to 60. | The budget number on the board header. | `budgetFor` — `engine/recruiting.ts` | SHIPPED |
| 20 | **A scholarship you do not spend becomes a walk-on 13 points below your program's level.** | A name on the roster with a bad rating. | `WALK_ON_PENALTY` — `engine/progression.ts` | SHIPPED |
| 21 | **7% of generated freshmen get a large extra headroom draw** on top of ordinary headroom. This is the only reason hidden gems exist. | Nothing at all. | `projectPotential` — `engine/players.ts` | SHIPPED |
| 22 | **Platoon skill is a hidden per-player number**, drawn from a distribution that can go negative (real reverse-split players). | Observed splits in the stats screen, and noise. | `drawPlatoonSkill` — `engine/players.ts`; `platoonMultiplier` — `engine/ratings.ts` | SHIPPED |
| 23 | **The coach's OFFENSE skill is worth 1 basis point per point**, capping at ×1.0079 on the whole offensive vector. Home field is ×1.020. | A blurb: "slightly better at-bats". | `TeamState.coachOffMult` — `engine/game.ts` | SHIPPED |
| 24 | **DEFENSE likewise, ×0.9921 at the cap**, applied to singles, doubles and triples only. | A blurb. | `TeamState.coachDefMult`, `log5Outcome` — `engine/game.ts`, `engine/engines.ts` | SHIPPED |
| 25 | **TRAINING scales only the systematic pull toward potential, never the noise** — ×1.158 at 99. | Slightly better development years. | `develop`, `OffseasonOpts.training` — `engine/progression.ts` | SHIPPED |
| 26 | **Coach skills apply to the user's program only.** The other 95 play at raw ratings, with a flat coach prestige of 45 and recruiting 20. | Nothing. | `applyCoachMods`, `advanceRecruitingWeek` — `state/store.ts` | SHIPPED |
| 27 | **Coach age, name, home state and portrait never reach the simulation.** | A creation form that looks like it matters. | `CoachProfile` — `engine/program.ts` | SHIPPED |
| 28 | **Trophy floors on the coach title.** A national champion can never be introduced below LEGENDARY however far prestige falls. | A word beside HEAD COACH. | `coachStanding` — `engine/program.ts` | SHIPPED |
| 29 | **A first-year coach's negative security hit is halved.** | Surviving a bad first season. | `reviewSeason` — `engine/program.ts` | SHIPPED |
| 30 | **The win target is priced off roster strength alone and sits ~1.5 wins below the median outcome**, buying about a 62% clear rate. | "The board wants 22." | `expectationFor` — `engine/program.ts` | SHIPPED |
| 31 | **A proud program with a gutted roster discounts its own hiring bar** to the midpoint of prestige and roster. | A big job you can somehow get. | `hiringBar` — `engine/program.ts` | SHIPPED |
| 32 | **Coach prestige decays toward 45 every year**, at 4% of the distance. | Standing slipping in a quiet decade. | `nextCoachPrestige` — `engine/program.ts` | SHIPPED |
| 33 | **Coach of the Year is chosen by salience** — each category's winner divided by that category's league-wide standard deviation this season — not by a precedence list. | One award and one sentence. | `coachOfTheYear` — `engine/postseason.ts` | SHIPPED |
| 34 | **GIANT-KILLER carries a fixed salience of 4.0**, high enough to win whenever it fires. | Nothing. | `coachOfTheYear` — `engine/postseason.ts` | SHIPPED |
| 35 | **Every other program in the world has a fixed coaching personality derived from its team index.** | Opponents who bunt or run more than you do. | `strategyFor` — `engine/strategy.ts` | SHIPPED |
| 36 | **A blanket shift is a wash.** Measured at 4.72 → 4.71 runs allowed over 2,500 games. SITUATIONAL declines the bet against runners and non-pullers. | Three alignment options that look like three sizes of one thing. | `alignmentAgainst`, `SHIFT` — `engine/strategy.ts` | SHIPPED |
| 37 | **Calling for a steal does not improve its odds.** `forced` skips the attempt roll and nothing else. | A button that sometimes works. | `attemptSteal` — `engine/game.ts` | SHIPPED |
| 38 | **The automatic game only ever steals second.** A manager gets whichever bag is open; the AI does not. | Nothing. | `resolveSteal` — `engine/game.ts` | SHIPPED |
| 39 | **The catcher's arm suppresses attempts as well as converting them**, so a cannon shows up as empty basepaths rather than as a big caught-stealing total. | A quiet running game against certain teams. | `attemptSteal` — `engine/game.ts` | IN FLIGHT |
| 40 | **The catcher's arm is re-centred on 60, not 50**, because the position generates ten points above school quality. | Nothing. | `AVERAGE_CATCHER_ARM`, `catcherArm` — `engine/game.ts` | IN FLIGHT |
| 41 | **`bunt` and `steal` ratings are derived from the player's own profile**, not rolled free. | A slugger who cannot lay one down. | `makeHitter` — `engine/players.ts` | IN FLIGHT |
| 42 | **Range is measured against the fielder's own team average, not against 50**, so a good shortstop redistributes plays rather than adding defence to the league. | Plays above expected on a fielding line. | `createHalfInning` range swing, `TeamState.defense` — `engine/game.ts` | IN FLIGHT |
| 43 | **The out-to-hit direction is scaled by 0.178/0.4885** so good and bad gloves balance and league scoring does not move. | Nothing. | `OUT_TO_HIT_BALANCE` — `engine/game.ts` | IN FLIGHT |
| 44 | **Two separate error paths, glove and throw**, splitting one calibrated total rather than adding to it. | "reaches on an error" vs "throwing error". | `GLOVE_ERROR_BASE`, `THROW_ERROR_BASE` — `engine/game.ts` | IN FLIGHT |
| 45 | **A pitcher's `armAccuracy` is pulled toward his control**; his fielding ratings are centred below a position player's. | Comebackers thrown away. | `makePitcher` — `engine/players.ts` | IN FLIGHT |
| 46 | **A ceiling a player has already cleared is silently revised upward.** | Potential that moves. | `develop` — `engine/progression.ts` | SHIPPED |
| 47 | **Underclassmen can be drafted, above hard bars** — SO at 70 overall, FR at 78, at 35% and 15% of the normal chance. | Losing a sophomore star. | `UNDERCLASS_BAR`, `departure` — `engine/progression.ts` | SHIPPED |
| 48 | **A signed recruit with nowhere to play still joins**, on the bench or in the pen. | A full class. | `refill` — `engine/progression.ts` | SHIPPED |
| 49 | **Roughly a third of days a regular sits**, and his replacement takes the spot of whoever plays his position. | Bench players with real statistics. | `restedLineup` — `engine/season.ts` | SHIPPED |
| 50 | **The bullpen is offered most-rested-first, ties broken by quality.** | The right arm turning up. | `restedFirst` — `engine/season.ts` | SHIPPED |
| 51 | **Each bracket round advances the calendar by one day**, and each side's rotation slot is its *own* appearance count mod 3. | Rested arms in June. | `advancePostseasonDay`, `playSeriesGame` — `engine/postseason.ts` | SHIPPED |
| 52 | **A global spread knob, `SPREAD = 0.62`, scales every rating sensitivity in the engine.** | How often the better team wins (measured 78.5% at a 13-point gap). | `SPREAD`, `mult` — `engine/ratings.ts` | SHIPPED |
| 53 | **A normalizer of 1.070 divides out the expected product of every context modifier**, so situational boosts redistribute offence without inflating the league. | Nothing. | `CONTEXT.normalizer` — `engine/ratings.ts` | SHIPPED |
| 54 | **A Jensen correction of 0.965 on the strikeout rate**, because `exp` is convex and a population with spread averages above the configured rate. | Nothing. | `JENSEN_K` — `engine/ratings.ts` | SHIPPED |
| 55 | **The event stream takes no random draws.** Watching a game play by play must not change what happens. | Identical results simmed or watched. | `landingFor` — `engine/game.ts` | SHIPPED |
| 56 | **Player generation draw order is load-bearing.** Adding or removing an `rng()` call shifts every downstream number in the simulation. | Nothing. | header comment, `engine/players.ts` | SHIPPED |
| 57 | **The report tab renames ratings.** A pitcher's `stuff` prints as `K/9`, `movement` as `H/9`, `control` as `BB/9`; a hitter's `eye` prints as `DISCIPLINE` and `range` as `REACTION`. | Different words from the ones the roster uses. | `Report` — `ui/screens/Board.tsx` | SHIPPED |
| 58 | **Signing day judges your report, not the recruit.** It says "TOP OF YOUR REPORT" or "BOTTOM OF YOUR REPORT" and is deliberately silent in the middle. | Two labels, occasionally. | `verdict` — `ui/screens/SigningDay.tsx` | SHIPPED |
| 59 | **The pool of names already taken is rebuilt from the save on every load**, and cannot be complete — a rival's graduated player is in no roster and in no record book, so his name comes back into circulation. | Occasionally two men with one name, on different teams. | `rebuildNameIndex` — `engine/season.ts`; `usedNames` — `engine/players.ts` | SHIPPED |
| 60 | **A scoreless-innings streak is measured a whole appearance at a time.** Allowing a run in the seventh zeroes the streak rather than crediting the six scoreless innings before it, because the game line records outs and runs and not the order they came in. | A record that reads a little short. | `scorelessOuts`, `recordResult` — `engine/season.ts` | SHIPPED |
| 61 | **A record must be beaten, not equalled**, including the seeded NCAA ones. | Stated on the record book screen; the incumbent simply staying put. | `offer` — `engine/records.ts` | SHIPPED |

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
| S | 31 |
| S+ | 31 |

Note that S and S+ have one fewer than A: the single C–A line
("Coaches in the area think he can play at this level.") drops out above A.

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

Measured over one class (`generateClass(2027, 96, makeRng(4242))`): 223 one-stars,
213 two, 182 three, 64 four, 38 five.

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

The hard gate. A recruit's `minProgram` is the lowest program tier, in prestige
stars, that will get a hearing from him. This is a refusal, not a discount — a
soft gate where a one-star program may chase a five star and gain almost nothing
reads to the player as a bug, because the actions are spent, the button works, and
nothing comes of it.

Program tier comes from `prestigeStars` (`engine/program.ts`):

| Stars | Program prestige |
|---|---|
| ★★★★★ | ≥ 72 |
| ★★★★ | ≥ 60 |
| ★★★ | ≥ 48 |
| ★★ | ≥ 38 |
| ★ | below 38 |

`REACH_LADDER` — `floor` is where he starts, and every threshold in `steps` his
flexibility clears takes him down one more tier. Flexibility is
`priorities.playingTime + priorities.proximity`: wanting to play, or to play near
home, is what brings a recruit down; wanting the name does not.

| Recruit stars | Floor | Steps (flexibility thresholds) | Reachable tiers |
|---|---|---|---|
| ★★★★★ | 4 | 0.3333 | 4, or 3 |
| ★★★★ | 4 | 0.32, 0.58 | 4, 3, or 2 |
| ★★★ | 3 | 0.36, 0.485 | 3, 2, or 1 |
| ★★ | 2 | 0.42 | 2, or 1 |
| ★ | 1 | — | 1 |

The result is clamped to `[1, 4]`, so **nobody starts above four** — a class only
the three programs at the top of the country may call is a class nobody else can
compete for, and the point of the gate is a ladder, not a wall.

The numbers are read off the flexibility distribution the priority draw actually
produces at each grade, which is why they are not a tidy sequence: a two star is a
far more flexible animal than a five star, so the same threshold would mean
something completely different to each of them.

**Measured** over the same generated class:

| Recruit stars | minProgram 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| ★ | 223 | — | — | — |
| ★★ | 186 | 27 | — | — |
| ★★★ | 65 | 62 | 55 | — |
| ★★★★ | — | — | 28 | 36 |
| ★★★★★ | — | — | 2 | 36 |

So about 5% of five stars will hear out a three-star program, about 44% of four
stars will, and only a four- or five-star program sees the whole board.

`canPursue(prospect, programStars)` is simply `programStars >= prospect.minProgram`.
When it fails the board prints: *"He will not take the call. A program of his
calibre is not on his list at your level. Build the program up and players like
him start listening."*

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
```

Three steps rather than two, because collapsing state and region made a Louisiana
kid treat a school in his own town exactly like one four states away.

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
| ★★★ and below | tier+1 0.30, tier 0.40, tier−1 0.20, tier−2 0.10 |

The top of the ladder gets its own plans because a five-star program has no tier
above it, and four stars need it most: two thirds of them will not hear from a
three-star program at all, so the elite programs are the entire market for them.

Within a band, targets are scored `fit × uncontested × (0.85 + rng × 0.3)`, where
`uncontested = 1 + 0.18 × stars` if nobody has banked a point on him and 1
otherwise. A recruit somebody else was more than 40% clear on at the start of the
week is dropped. Weekly actions are then allocated by
`max(0.05, fit) × (already-ahead ? 1.35 : 1)`, capped at `MAX_PER_RECRUIT` per
recruit and `ACTIONS_PER_WEEK` (40) in total.

Every AI program pitches at a flat coach prestige of **45** and recruiting skill of
**20**. The user's own prestige and skill are the only ones that vary.

`seedRivalInterest` (`state/store.ts`) runs two passes over the whole league as the
window opens — the second at half weight, because coverage comes from target
selection rather than point size — so the player arrives at a board that is already
contested. The user's program is skipped; his head start is the one he chooses.

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

The two in-game skills reach the field via `TeamRecord.coachMods`, which the store
stamps onto the user's program and deletes from every other one — so a job change
or an old save can never leave the edge behind on a team he no longer runs.
TRAINING is passed to `departAndDevelop` as `OffseasonOpts.training` and applied to
the user's program only. RECRUITING is passed at the two call sites in
`advanceRecruitingWeek` and read directly by the board and signing-day screens.

---

## 5. Coach standing and titles — **SHIPPED**

`coachStanding` in `engine/program.ts`.

The word beside HEAD COACH is earned, not served. The line used to read "seasons
completed", which is a fact the two counters either side of the portrait already
state; twenty quiet years does not make anybody renowned.

Two things are computed and the better of them wins.

**The floor** — a trophy is a floor, not a bonus. Whatever prestige says this
month, the man who won it does not drop below the rung it bought.

| Floor | Condition |
|---|---|
| Legendary | `titles > 0` |
| Established | `conferenceTitles > 0` or `tournaments >= 3` |
| Respected | `tournaments > 0` |
| Journeyman | has coached a game |
| Unproven | otherwise |

**The ladder** — evaluated top down, first match wins.

| Title | Condition |
|---|---|
| Legendary | `prestige >= 80` **and** `titles > 0` |
| Renowned | `prestige >= 68` |
| Established | `prestige >= 55` |
| Respected | `prestige >= 42` **or** career win pct > 0.55 |
| Journeyman | has coached a game |
| Unproven | otherwise |

Final title = whichever of the two is higher on
`['Unproven','Journeyman','Respected','Established','Renowned','Legendary']`.

**LIFER** is separate and additive: `tenure >= LIFER_SEASONS` (**15**) at the
*current* job. It is the one thing here earned by staying instead of winning, and a
bad run cannot take it away — it reads alongside the title, e.g. `RENOWNED · LIFER`.

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
| `contend` | Win *N* games · Finish in the top half · Reach the national tournament | Win the conference · Reach Omaha |
| `championship` | Win *N* games · Finish top three · Reach the national tournament | Win the conference · Reach Omaha · Win the national title |

Where the mandates genuinely differ is in what is *required* rather than in what
sounds different. Note that **winning the conference is a bonus for everybody and
required by nobody**, including a championship program — `objectivesFor` passes
`confTitle(false)` in both places, and its own docstring says otherwise (Appendix A).
What actually climbs with the mandate is placement: stay out of the cellar, then
finish above .500, then top half, then top three.

Placement objectives are zero-sum and spent carefully: only half a conference can
finish in the top half, and
the first draft of this list demanded a top-half finish from rebuilding programs
(weak *by definition*, since that is what earns the mandate) and failed 73% of them.

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
0, security to 62, and issues a fresh deal.

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

The baseline is self-calibrating: fit wins against roster strength across all
programs by ordinary least squares, and overachievement is distance above the
line. Roster strength is the mean overall of the lineup plus the top three of the
rotation.

**A losing season wins nothing**, whatever the story. This holds for every
category.

| Reason | Fires when | Salience | Headline written |
|---|---|---|---|
| `overachieved` | always — some team is furthest above the line | `gap / sd(residuals)` | "*X.X* wins above what that roster was worth" |
| `giantKiller` | national champion whose roster ranked outside the top ten, winning record | **fixed 4.0** | "national champions with the No. *N* roster in the country" |
| `turnaround` | biggest positive one-year jump in wins; needs `lastW`, so silent in year one | `jump / sd(jumps)` | "from *W–L* to *W–L* in one year" |
| `wireToWire` | conference champion who also owned the best run margin per game | `bestDiff / sd(diffs)` | "outscored the country by *X.X* runs a game, wire to wire" |

The fixed 4.0 on GIANT-KILLER is high enough to win whenever it fires: a champion
nobody saw coming is the story of that season, full stop. Both halves of
WIRE-TO-WIRE are required — the margin alone is a stat, the title alone is a
bracket.

Award subtitles, from `ui/screens/Awards.tsx`:

| Reason | Subtitle |
|---|---|
| `overachieved` | Nobody got more out of less. The roster said no; the record said yes. |
| `giantKiller` | The trophy went home with a roster that had no business holding it. |
| `turnaround` | The biggest one-year climb in the country, same school, same players. |
| `wireToWire` | Won the league and outscored everybody doing it, start to finish. |

---

## 8. The postseason — **SHIPPED**

`engine/postseason.ts`, `ui/screens/Postseason.tsx`, `ui/PostseasonMap.tsx`

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
(`rw ?? w`), which is the last thing those forty-five games are still paying for.

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

Supporting constants in `engine/ratings.ts`: `LEAGUE` (the seven-event baseline,
summing to exactly 1), `LEAGUE_K_RATE` 0.164, `LEAGUE_BIP` (44% ground, 21% line,
27% fly, 8% popup), `CONTEXT.homeFieldOffense` 1.020 (measures 54.9% between evenly
matched teams), `CONTEXT.normalizer` 1.070, `CONTEXT.runnersOnOffenseBoost` 1.035,
`CONTEXT.timesThroughOrder` `[1.0, 1.0, 1.035, 1.075, 1.11]`, and `SPREAD` 0.62.

Calibration runs spread over 12 distinct team pairs (`CALIBRATION_PAIRS`), because
measuring one pair makes the result a property of twenty-three particular players
rather than of the engine.

---

## 10. Defence: attributes and per-player fielding statistics — **IN FLIGHT**

`engine/types.ts`, `engine/players.ts`, `engine/game.ts`, `engine/season.ts`,
`engine/progression.ts`, `state/seasonCodec.ts`, `tests/fielding.test.ts`

This is being written right now. The shape below is what is in the working tree
today; treat the numbers as live.

### 10.1 What is new versus what was already there

Already shipped before this work: `range`, `hands`, `arm` on every player; the
defensive spectrum; the range swing; team-level `defenseMult`; the glove-error
path; lane-based fielder assignment; `overallOf` weighting a hitter's glove at
7% range, 5% hands, 6% arm.

Arriving with the current work:

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
throw:  0.0408 × mult(armAccuracy, −0.55)      // ground balls, infielders who throw
```

`KIND_ERROR_RISK` is ground 1.00, line 0.55, fly 0.45, popup 0.30 — errors are
overwhelmingly a ground-ball event, and charging fly balls the same rate makes a
defence feel uniformly clumsy rather than clumsy where real defences are.
`ERROR_BY_KIND = 1 / 0.701` divides out the batted-ball-weighted mean of that table
so the redistribution does not change how many errors there are.

The two paths are a **split of one calibrated total, not an addition to it** — the
glove rate alone used to be 0.055. Real fielders throw the ball away roughly as
often as they drop it, and the throw is the more expensive mistake: a ball skipping
past first moves every runner rather than just putting one on. `makesThrow` charges
it only where the engine actually knows a throw was made — every infielder except
the first baseman, on a ground ball.

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
| `coach` | The full `CoachState`. Optional; `restoreCoach` fills every gap |
| `phase`, `review`, `outcome` | Where the offseason sequence had got to, and the verdict behind it |
| `postseason`, `bracket`, `myBracket`, `knockout`, `postseasonSeen` | June, at whatever stage it had reached, including a half-played tournament of your own |
| `jobSearch` | True while the coach has been dismissed and has not taken a new job |

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

---

## 12. Planned systems — **PLANNED**

Everything in this section is **design intent. Nothing is built.** No code
implements any of it; there are no types, no constants, and no tests. Do not read
any of these as behaviour the game has.

### 12.1 Badges

Situational boosts: a small, specific edge that applies in one situation on one
channel, rather than a general rating increase.

| Property | Intent |
|---|---|
| Tiers | Bronze / Silver / Gold |
| Magnitude | roughly +2–3% / +4–5% / +6–8% |
| Scope | **one** channel in **one** situation — never a flat boost |
| Cap by potential | S+ 7, S 6, A 5, B 4, C 3, D 2 |
| At signing | at most 2 |
| Developed ceiling | up to 5–6 over a career |
| How earned | three routes: innate at generation, earned in the record (a player who keeps doing the thing), coached via the TRAINING skill |
| Visibility | hidden from opposing teams |
| Decay | none — there are no injuries in this game |

Badges are the largest planned addition to the hidden layer, and every one of them
will need a row in the [index](#hidden-mechanics-index) on the day it ships: what
it boosts, by how much, in which situation, and how a player could infer it.

The engine already has one hook pointed at this. `attemptSteal` records stolen
bases and caught stealing on the **catcher's** fielding line, with the comment that
it goes there "where a badge or an award can find it later".

### 12.2 Tendencies

What a player **chooses to do**, as opposed to how well he does it. Deliberately
power-neutral and double-edged: a tendency should change the shape of a player's
season without making him better or worse, so it is a thing to manage rather than a
thing to acquire.

Nothing here is specified beyond that principle, and the code contains no notion of
a tendency. See Appendix B.

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
  `season.careers`, before the statistics are wiped. Hitters get AB/H/HR/RBI/BB/SB,
  pitchers W/L/outs/ER/K, fielders chances/plays/errors. A year is written once, so
  re-entering the offseason cannot duplicate it.
- Every row carries the player's **name**. The book is the last thing in a save
  that remembers a man — rosters are rewritten each June and a departure notice
  survives one offseason — and since §11.5 the id it is filed under is no longer
  the name. `careerName` reads the row and falls back to the id for rows written
  before the field existed, where the id *is* the name. Both the HALL tab and the
  alumnus card on the player screen go through it.
- `HISTORY` (`ui/screens/History.tsx`) is the season-by-season book for the program.
- `PROGRAM → HALL` (`ui/screens/Program.tsx`) ranks the best players you have
  coached, bats by career hits and arms by career strikeouts, twelve each. It is
  ordered on counting statistics the game already prints rather than on a career
  score of nobody's devising.

**Shipped since:** the all-time book in the other sense — league-wide marks that
persist and can be broken, seeded with real NCAA records. See §13. Career leaders
are still the missing half of it, and for the reason given there.

### 12.5 Draft declaration and persuasion

**Intent:** a player facing the draft declares or returns, and the coach can try to
persuade him to come back.

**Reality today:** the draft is entirely automatic and the coach has no say.
`draftChance(overall) = clamp((overall − 46) / 34, 0, 0.88)`; seniors leave
regardless and are labelled drafted at 60% of that chance; juniors leave at the full
chance; sophomores above 70 overall at 35% of it and freshmen above 78 at 15%.
Rounds are assigned nationally, 32 names deep per round. There is no declaration
step, no persuasion, and no screen for either.

### 12.6 Hall-of-fame induction

**Intent:** a ceremony, an inducted class, and a lasting honour.

**Reality today:** the HALL tab described in §12.4 is a leaderboard of the best
players you have coached, computed live from the record book. Nothing is inducted,
nothing is permanent, and nobody is honoured.

---

## 13. The all-time record book — **SHIPPED**

`src/engine/records.ts`, `recordSeasonMarks` in `src/engine/season.ts`,
`src/ui/screens/RecordBook.tsx`

League-wide across all ninety-six programs, permanent, and seeded with real NCAA
marks so there is something to chase in the first week of the first season.

### 13.1 Why it is cheap

A record book does not need the seasons, it needs the **holders**: thirty-eight
rows, each a value, a name, a program and a year. Every finished game already
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
| Coach career | `recordCoachMarks`, same place | Reads `CoachState`, which lives in the store and not in the engine |

**Why the draft phase and not the year roll.** `recordSeasonMarks` names a holder
by looking him up on a roster, and `departAndDevelop` — which runs on entry to the
draft step — strips every departure off all ninety-six of them. Settled at the
year roll instead, every graduating senior in the country would enter the book
with no name and no program against him, which is the best season most players
ever have and exactly the row a book exists for. So it runs in the last moment the
rosters that produced the numbers still exist. It is idempotent, because a mark
has to be beaten: walking back a step and forward again offers a book numbers it
already holds. (This is a near neighbour of A5 in the backlog, which is the same
ordering hazard in `archiveSeason` and is not fixed here.)

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

### 13.3 The seeded marks, and the honest problem with them

Twelve, all flagged `ncaa: true` in the data and badged **NCAA** on screen.
Counting marks are scaled by games played — 45 against the 56-to-75 game seasons
they were set in — and rates are taken exactly as they stand, because a .400
average means the same thing at any season length.

| Mark | Real | Games | In the book |
|---|---|---|---|
| Home runs, Incaviglia 1985 | 48 | 75 | 29 |
| RBI, Incaviglia 1985 | 143 | 75 | 86 |
| Total bases, Incaviglia 1985 | 285 | 75 | 171 |
| Triples, Hagman 1980 | 17 | 63 | 12 |
| Doubles, Hawpe 2000 | 36 | 75\* | 22 |
| Wins, Loynd 1986 | 20 | 75\* | 12 |
| Innings, Bannister 1976 | 186 | 75\* | 112 |
| Consecutive scoreless innings, Helton 1994 | 47 | 75\* | 28 |
| Batting average, Hagman 1980 | .551 | rate | .551 |
| Slugging, Incaviglia 1985 | 1.140 | rate | 1.140 |
| Strikeouts per nine, Wagner 2003 | 16.8 | rate | 16.8 |
| Consecutive games hitting, Ventura 1987 | 58 | — | **58** |

\* the source does not record a season length; `ERA_GAMES` = 75 stands in, which
is the top of the band and the length of both seasons that *are* recorded. Guessing
high scales a mark down, and a mark pitched too high is furniture.

**Ventura's streak keeps its real number on purpose.** Forty five games cannot
hold fifty eight, so the row can never change hands. One untouchable mark that
exists to be admired is good and more than one turns a game system into a museum,
so it is the only row carrying `RecordSpec.frozen`, the screen prints the reason
instead of implying it is in reach, and nothing anywhere computes a candidate for
it — there is no arrangement of a 45-game season that would produce one. A test
asserts that exactly one row is frozen.

**The thing to revisit.** One simulated season of the current engine produced
these league bests: 9 HR, 56 RBI, 111 total bases, .427, .678 slugging, 5 triples,
18 doubles, 11 wins, 96 innings, 10.9 K/9. So seven of the twelve seeds are out of
reach of the run environment as it stands, not because of season length but
because these were set with aluminium bats in the 1980s and the engine is
calibrated to modern Division I. Scaling by games played is the decision on record
(06-backlog.md, "Records are scaled, not literal") and the code follows it; the
gap is written down so it can be argued about with numbers rather than
rediscovered. Reachable today: innings, wins, doubles and the scoreless streak.

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

**There are no career records**, and the screen says so in as many words. They
need archiving widened past your own program, which is the one genuinely expensive
piece and is B13 in the backlog. Fielding records are also absent: the ranking
statistic is plays above what an *average glove on his own team* would have made,
which does not mean the same thing in two different rows and cannot be compared
across seasons — the same reason `CareerYear` leaves it out.

Saves written before the book existed come up with the **seeded** marks rather
than an empty book. That is a different rule from the other backfills in
`fromPortable`, and deliberately: an empty fielding map is the truthful state for
a save that never recorded a chance, but an empty record book is not — the NCAA
seeds are not something a dynasty earned, they are where every dynasty starts.

---

## Appendix A: stale comments and vestigial code found while writing this

These are places where a comment or a symbol no longer describes what the code
does. None of them changes behaviour; all of them will mislead the next reader.

| Where | The problem |
|---|---|
| `engine/postseason.ts`, closing note "On the shape of the national tournament" | Says "A regional is still four teams and double elimination". A regional is two conference champions playing one best-of-five series. |
| `engine/postseason.ts`, `FIELD_SIZE` | Documented as a 16-team field with eight automatic bids and eight at-large RPI selections. There are no at-large bids; the field is the eight conference champions. `FIELD_SIZE` is exported and its only use is a `size` parameter on `runPostseason` that the function body never reads. |
| `engine/postseason.ts`, `conferenceField` docstring | "Six of eight keeps the same proportion a twelve team league had at eight" — conferences hold twelve, and six of twelve is the actual cut, which `CONF_FIELD`'s own comment gets right. |
| `data/schools.ts`, header | The middle section argues for "Eight conferences of eight" and a 33-game season. The file actually defines eight conferences of twelve, and `DEFAULT_SEASON` is 45 games. The first line of the file ("Eight regions, twelve programs each, ninety six in all") is the correct one. |
| `state/world.ts`, `engine/program.ts`, `engine/recruiting.ts`, `state/store.ts` | Comments repeatedly say "sixty four programs" / "the other sixty three". The world is 96. |
| `engine/recruiting.ts`, `RECRUITING_BUDGET` docstring | Opens "Thirty, spread across as many recruits as you like." The constant is 40. |
| `engine/scouting.ts`, `PotentialGrade` | `'?'` is documented as what a screen prints where a ceiling is none of your business. No screen uses it; `ui/screens/Player.tsx` prints an em dash instead. |
| `engine/recruiting.ts`, `BOARD_SLOTS` / `ACTIONS_PER_WEEK` | Marked `@deprecated`, still imported and used by `aiTargets`. |
| `engine/program.ts`, `objectivesFor` docstring | Says winning the conference is "a bonus for a contender and a requirement for a championship program", and calls that asymmetry "the whole point of having mandates". The code passes `confTitle(false)` for both, so it is a bonus for everyone and no mandate requires it. |
| `engine/program.ts`, `Expectation.expectsTournament` / `expectsConference` | Computed in `expectationFor` and read by nothing, anywhere in `src/` or `tests/`. Vestigial since `judge` was rewritten to read the checklist and nothing else. |

## Appendix B: undetermined

Things this document could not settle from the code, and must not guess at.

1. **Tendencies.** No specification exists anywhere in the repository beyond the
   principle "power-neutral and double-edged". Which tendencies, what they attach
   to, and how they surface are all open.
2. ~~**The scope of the planned records book.**~~ Answered, and built: league-wide
   single game, single season and team marks, plus the user's coaching career,
   seeded with real NCAA records. Career leaders are the one part left out, and
   §13.5 gives the reason. See §13.
3. **Badge channels and situations.** The tiers, caps and earning routes are agreed
   (§12.1). Which channels can carry a badge, and how a situation is defined in
   engine terms, are not.
4. ~~**Whether the `raw` projectable draw survives the S+ gate.**~~ Answered: it
   does, untouched, at about twenty hidden gems per class before and after. §12.3.
5. **`ACTIONS_PER_WEEK` for the AI versus `budgetFor` for the player.** AI programs
   allocate against the flat `ACTIONS_PER_WEEK` (40) regardless of their own
   prestige tier, while the user's cap comes from `budgetFor(stars)` (40–60). It is
   not clear from the code whether the asymmetry is intentional.
6. **How the offseason `coach` phase interacts with unspent points across years.**
   The screen says points "do not carry over well"; the data carries them over
   fully. Whether the copy is loose or the intended decay is unbuilt is not
   determinable from the code.
7. **The real-world frequency of each Coach of the Year category.** The salience
   rule makes this an emergent property of a season's spread; nothing measures it.
