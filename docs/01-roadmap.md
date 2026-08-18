# College Baseball Dynasty: Project Roadmap

**Last updated:** August 16, 2026

## The pitch

You are the head coach of a college baseball program. Recruit high schoolers, develop them, survive the MLB draft stealing your best arms every June, work the transfer portal, and chase a national title in Omaha. Games play out at bat by at bat with text play by play. Mobile first.

---

## Core pillars

1. **The calendar is the game.** College baseball has a natural drama loop that pro sports do not: fall practice, a spring gauntlet, conference tournament, regionals, super regionals, College World Series, then a brutal June where the draft and the portal gut your roster.
2. **You never keep your best players.** Draft eligibility after junior year (or age 21) means a star is on a three year clock. Even your recruits can get poached out of high school by MLB teams.
3. **Weekend rotation matters more than anything.** Friday ace, Saturday guy, Sunday guy, plus a midweek arm. Managing that is the identity of a college program.
4. **Text is a feature, not a compromise.** At bat by at bat text lets you sim fast on a phone, read the drama, and jump in for key decisions.

---

## Data model (first draft)

### Player
```
id, firstName, lastName, position, classYear (FR/SO/JR/SR), redshirted
height, weight, bats, throws, hometown, stateCode
overall, potential
hitting: contact, power, eye, speed, fielding, arm
pitching: velocity, movement, command, stamina, pitches[]
development: rate, workEthic
status: healthy | injured | suspended
eligibility: yearsUsed, draftEligible
morale, playingTimeExpectation
```

### Team
```
id, school, nickname, conference, prestige (1 to 5)
colors, stadiumName, stadiumCapacity
roster[], depthChart, rotation, lineup
coach: recruiting, development, gameManagement
budget, facilities, academics
```

### Season
```
year, phase, schedule[], standings, stats, awards
polls (top 25), rpi
```

### Game
```
homeTeam, awayTeam, date, innings[], playLog[], boxScore
```

---

## Season phases

| Phase | What happens |
|-------|--------------|
| Fall practice | Player development, position battles, scrimmages, early recruiting contact |
| Preseason | Set rotation, lineup, captains. Rankings drop |
| Regular season | Roughly 56 games. Midweek games plus weekend series |
| Conference tournament | Win it or sweat the bubble |
| NCAA tournament | 64 team field, regionals, super regionals, Omaha |
| MLB draft | You lose juniors, seniors, and some signed recruits |
| Portal and signings | Fill the holes. Portal in, portal out |
| Summer | Summer leagues, development bumps, coaching carousel |

---

## Sim engine design

The heart of it. Everything else is UI wrapped around this.

**At bat resolution**
1. Compare pitcher attributes vs batter attributes, adjusted for fatigue, platoon split, count situation, park, and pressure.
2. Roll for outcome bucket: strikeout, walk, hit by pitch, ground out, fly out, line out, single, double, triple, home run.
3. If ball in play, roll fielding check against the responsible defender.
4. Resolve baserunning: forced advances, tag ups, extra base attempts based on speed vs outfielder arm.
5. Append a text line to the play log.

**Pitcher fatigue**
Stamina drains per pitch, faster with high leverage and high pitch counts. Effectiveness degrades before you get the bullpen warning. Overworking arms carries injury risk that compounds across the season.

**Coach decision points**
Pause the sim for: pitching change, pinch hit, steal attempt, bunt, intentional walk, defensive shift, mound visit. Everything else auto resolves. Add an "auto play" toggle so a full game can sim in seconds.

**Calibration target**
Your output stats should look like real college baseball, not MLB. Higher scoring, higher batting averages, more walks, more errors. Around .290 league average, roughly 6.5 runs per team per game, ERA near 5.00. Build a test harness that sims 1,000 seasons and prints league leaders so you can tune.

---

## Build phases

### Phase 0: The engine (start here)
Goal: sim one full nine inning game between two hardcoded rosters and print a readable play log plus a box score.

- [ ] Player and team data structures
- [ ] Random name and rating generator for filler players
- [ ] At bat resolution function
- [ ] Baserunning and scoring logic
- [ ] Inning and game loop
- [ ] Text play by play output
- [ ] Box score generation
- [ ] Stat tuning harness (sim 1,000 games, check the numbers)

**Done when:** you can hit a button and read a believable game.

### Phase 1: The season
- [ ] Schedule generator (conference series plus non conference)
- [ ] Sim a full season, day by day
- [ ] Standings, team stats, player stat leaders
- [ ] Rankings and RPI approximation
- [ ] Conference tournament bracket
- [ ] NCAA tournament: regionals, supers, Omaha
- [ ] Season awards

**Done when:** you can play one full season start to finish.

### Phase 2: Roster management
- [ ] Lineup and rotation editor
- [ ] Depth chart with position eligibility
- [ ] Injuries and fatigue tracking
- [ ] Player progression and regression at season end
- [ ] Eligibility, redshirts, and graduation
- [ ] MLB draft: who leaves, who returns

**Done when:** you can carry a roster into year two and it feels different.

### Phase 3: Recruiting
- [ ] Generate recruit classes by state and region
- [ ] Scouting: hidden true ratings, scouting reveals accuracy over time
- [ ] Interest and pitch system (playing time, development, winning, proximity, academics)
- [ ] Weekly recruiting point budget
- [ ] Rival schools competing for the same kids
- [ ] Signing day
- [ ] Recruits getting drafted out of high school and never showing up
- [ ] Transfer portal, both directions

**Done when:** losing a recruiting battle actually stings.

### Phase 4: Dynasty layer
- [ ] Program prestige that moves with results
- [ ] Coach attributes and skill tree
- [ ] Job offers and the coaching carousel
- [ ] Facilities and budget upgrades
- [ ] Booster and athletic director expectations, getting fired
- [ ] Records book and program history
- [ ] Conference realignment (optional, later)

**Done when:** year five feels like the payoff of years one through four.

### Phase 5: Polish
- [ ] Mobile UI pass: bottom nav, card components, one handed use
- [ ] Save and load, multiple dynasty files
- [ ] Presentation: scoreboard, ticker, news feed, headlines
- [ ] Sound optional
- [ ] Onboarding for the first 10 minutes

---

## Tech decisions to lock in

| Decision | Leaning | Notes |
|----------|---------|-------|
| Stack | HTML/CSS/JS first, same as Liga Endesa Manager | Fastest path to a playable thing, migrate to React Native + Expo later if it earns it |
| Storage | LocalStorage or IndexedDB | Dynasty saves get big fast, IndexedDB is safer past year three |
| Engine separation | Keep the sim engine in pure JS with zero UI imports | Lets you test it headless and swap the front end later |
| Data | JSON files for schools, conferences, name pools | Easy to expand and edit without touching code |
| Art | Text and typography driven, team colors as the visual identity | No art pipeline needed, plays to the strengths of a text sim |

---

## Open questions

- [ ] Real schools and conferences, or fictional ones? Fictional is safer and lets you ship
- [ ] How many teams in the world? Start with one conference, expand to a full D1 field later
- [ ] Do you want NIL and revenue sharing as a mechanic, or skip it?
- [ ] Single dynasty save or multiple?
- [ ] Any interest in a "play as an alumnus returning to your alma mater" opening hook?

---

## Next action

Build Phase 0. Nothing else matters until a single game sims and reads well. Get the at bat function right, sim a thousand games, and stare at the numbers until they look like college baseball.
