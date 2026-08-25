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

---

## A. Bugs and data integrity

Ahead of features, because every one of these corrupts something that already
exists.

- **A1 · Player ID collision** — `DECIDED`. `usedNames` in `players.ts` is a
  module-global set that is never serialised and never rebuilt on load, and
  `playerId(name)` makes the id *be* the name. After a cold reload a new recruit
  can be generated holding an existing player's name, and since statistics,
  careers, awards and box scores are all keyed by id, the two men merge. The fix
  is opaque ids plus rebuilding the uniqueness index from every loaded roster
  and career.
  **Complication:** the Hall of Fame can name players who left four years ago
  *because* the id is the name — departure notices survive only one offseason.
  Opaque ids therefore require a name on `CareerYear` and a migration.
- **A2 · Fifteenth-inning failure** — `DECIDED`. A game reaching the fifteenth
  went undefined. Not yet reproduced; a seeded search for long games will find
  it.
- **A3 · World reconstruction** — `DECIDED`. The save omits the schedule and
  rebuilds it from the *current* conference and program definitions, so
  reordering the world silently alters an old career. Fix: persist a compact
  world snapshot, or adopt permanent string program ids, or refuse to load a
  save whose world version differs.
- **A4 · Seeding tiebreakers** — `DECIDED`. Ties currently resolve by whatever
  order the array happened to be in.

## B. Agreed and designed, not yet built

Ordered by dependency. Records come first because badges, the hall of fame and
half the achievements are all reading from the same book.

- **B1 · The records book** — `DECIDED`. League-wide, not just your program.
  Single game, single season, career, team, fielding, coach. The cheap insight:
  only the *holders* need storing, roughly sixty rows, checked as each result
  passes through `recordResult`. Storing every player's line across ninety-six
  programs is what would be expensive, and it is not necessary.
- **B2 · Seed the book with real NCAA marks** — `DECIDED`. See section D.
- **B3 · Achievements** — `DECIDED`. One-time and permanent, as against records,
  which are there to be broken: Perfect Conference, Cinderella, Dynasty, Lifer,
  Kingmaker, Recruiter, Builder, Iron Will, Streak, Grand Slam.
- **B4 · Coach titles** — `DECIDED`. An earned title replaces "seasons
  completed" beside the coach's name, including **Lifer** at fifteen seasons in
  one chair.
- **B5 · Prestige penalty for two bad seasons running** — `DECIDED`.
- **B6 · Conference and regional titles as real achievements** — `DECIDED`.
  Regional titles have no counter at all today.
- **B7 · AI coach development** — `DECIDED`. You are currently the only coach in
  a ninety-six program world who improves, which is a snowball with no brake.
- **B8 · Walk-ons** — `DECIDED`. One season only, visibly marked as walk-ons,
  and shown in the class review. Positional filling already works; they are
  simply not flagged and they currently stay four years.
- **B9 · Draft declaration** — `DECIDED`. Players say they are leaving and you
  get to talk to them. Prerequisite for the hall of fame, since four years on a
  roster is what makes a career.
- **B10 · Badges** — `DECIDED`, spec agreed. Four families (situational,
  physical, technical, makeup), three tiers, position-aware, playful names.
  Effects sized against the engine's own reference points: home-field advantage
  is a 1.020 multiplier worth about +4.9 points of win probability, so a gold
  badge on a channel that fires a quarter of the time lands near +1.75% across a
  season. At most two at signing; five or six developed; caps by potential grade
  (S+ 7 / S 6 / A+ 6 / A 5 / B 4 / C 3 / D 2). Some innate and visible, some
  earned, some coached. No decay — these are young men and there are no injuries.
  Not visible on other programs' players.
- **B11 · Tendencies** — `DECIDED`. What a player *does*, as against how well he
  does it, so they add identity without power creep. Double-edged by
  construction: a free swinger walks less and ambushes more. Visible on
  opponents, unlike badges, because a scouting report saying their leadoff man
  runs is exactly what a defensive setting is for.
- **B12 · Hall of Fame induction** — `DECIDED`. Replaces the career-leaders
  placeholder now on the program page. Inducts on merit — four years of
  competence is not a career worth honouring. Depends on B1 and B9.
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
pipeline map with contested territory · MLB Decision Day, where juniors weigh
draft stock against role, loyalty and development.

## D. The record marks

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
- Stale comments listed in appendix A of the systems reference, including the
  postseason note still describing four-team double-elimination regionals.

## F. Research outstanding

- **Simulation gap analysis** — how OOTP, Diamond Mind, Strat-O-Matic and the
  sabermetric literature resolve a plate appearance, against what we do. Two
  questions matter most: whether our log5 implementation is standard, and
  whether the evidence on clutch talent — which is that it barely exists —
  argues for keeping situational badges small and honest.
- **The remaining record marks**, from a source that can actually be fetched.
