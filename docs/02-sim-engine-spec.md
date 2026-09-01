# Sim Engine Spec: College Baseball Dynasty

**Last updated:** August 17, 2026
**Replaces:** the "Sim engine design" section of the main roadmap

---

## Architecture: two layers, not one

The mistake most amateur baseball sims make is picking one layer and forcing everything through it. Pure pitch level sims drift statistically because small per pitch errors compound. Pure plate appearance sims cannot show you a 3-2 count with the bases loaded, which is the whole point of a text play by play game.

Do both. Two layers, talking to each other.

**Layer 1: Plate appearance outcome (the truth layer)**
Decide what the plate appearance is going to produce using a proven probability model. This is what keeps your season stats believable.

**Layer 2: Pitch sequence (the drama layer)**
Walk the count forward pitch by pitch, constrained so the sequence lands on the Layer 1 outcome. The player sees pitches, fouls, 3-2 counts, and 11 pitch at bats. The stats stay honest.

You can also run these in the other order (simulate pitches freely and let the outcome emerge), which is more elegant but much harder to calibrate. Start with constrained sequencing, revisit later if you want.

---

## Layer 1: The plate appearance model

### The formula

Use the generalized log5 method. Standard log5 only handles two outcomes (hit or no hit). The generalized version, published in the SABR Baseball Research Journal, partitions the plate appearance into seven events and normalizes across all of them.

**Seven events:** single, double, triple, home run, walk, hit by pitch, out.

For each event i, compute a base probability from the batter rate, the pitcher rate, and the league rate. Then normalize so the seven probabilities sum to one.

```
base_i = (batter_i * pitcher_i) / league_i
P(event_i) = base_i / sum(base_1 ... base_7)
```

Notes on why this works:
- If an average batter faces an average pitcher, you get league average rates back. Self checking.
- The result is symmetric. Batter vs pitcher equals pitcher vs batter.
- It was validated against a full season of Retrosheet play by play data and the predicted distribution held.

Exclude intentional walks and catcher's interference from the model. Those are situational decisions, not matchup outcomes. Handle intentional walks separately in the AI layer.

### Feeding it from ratings

Your players have 0 to 100 ratings, not rate stats. So each rating maps to a rate stat, and the rate stats feed the formula.

```
contact  -> strikeout rate (inverse), single rate
power    -> HR rate, double rate, ISO
eye      -> walk rate
speed    -> triple rate, infield hit bump on the out bucket
```

Pitchers mirror this. Borrow the OOTP category structure since it is battle tested:

| Rating | Drives | Notes |
|--------|--------|-------|
| Stuff | Strikeout rate | Built from individual pitch quality plus velocity. Relievers get a bonus because hitters get fewer looks |
| Movement | Hits and home runs allowed | Effectively a combined HR/9 and BABIP against rating |
| Control | Walk rate | |
| Stamina | Pitch count before decline | |
| Ground ball % | Batted ball type distribution | Drives double plays too |
| Hold runners | Steal attempts and success against | |
| Velocity | Feeds Stuff, and is a scouting hook | Track in mph, not 0 to 100. It is the number recruits get talked about with |

Build a `ratingToRate(rating, statType, leagueContext)` function and keep every conversion in one file. When you tune, you tune in one place.

---

## Handedness and platoon splits

This is the part you flagged, and it is the single biggest thing separating a toy sim from a real one.

### The core rule

Opposite hand matchups favor the batter. Same hand matchups favor the pitcher.

Store on every player:
```
bats: R | L | S
throws: R | L
```

### How big the effect is

Research findings worth building against:

- Average platoon effect for right handed hitters sits around 30 points of wOBA, and the spread of true platoon talent across players is only about half that.
- Left handed hitters show meaningfully larger and more variable splits than righties. The standard practice is to regress a lefty's observed split toward 1,000 plate appearances of league average and a righty's toward 2,200.
- Average split magnitude runs roughly 8.6% for lefties and 6.1% for righties as a share of wOBA.
- Righties face same handed pitching constantly, so they adapt. Lefties rarely see lefties, which is part of why their splits are worse.

### How to implement it

Give every player a hidden `platoonSkill` value drawn from a normal distribution:
- RHB: mean 6%, standard deviation about 3%
- LHB: mean 9%, standard deviation about 5%
- Switch hitters: near zero split, but pay for it with slightly lower peak contact and power, which is the real world tradeoff

Apply the modifier to the batter's rate vector before it enters the log5 formula. Boost walk rate, contact, and power in the favorable matchup, cut them in the unfavorable one.

**Reverse split players.** Let a small percentage of the distribution go negative. A righty who hits righties better is a real and fun thing for a player to discover. Since you are simulating from hidden true talent, this emerges naturally.

**Never let the player see the true number.** Show observed splits in the stats screen. The coach has to guess whether a 3 for 22 against lefties is a real problem or 22 at bats of noise. That uncertainty is a feature.

### Pitcher side handedness detail

- Left handed relievers who specialize against lefties are a real archetype. Let your recruit generator produce them.
- Pitch type matters for splits. Sliders are especially effective against same handed hitters. Cutters play evenly against both. So a righty with a great slider is a matchup weapon but vulnerable to lefties, while a righty with a good cutter is a rotation piece.
- Arm slot is a bonus lever. Sidearm and submarine righties should get a big same handed bonus and a big opposite handed penalty. This gives you a clear specialist archetype for the bullpen.

### Third time through the order

Starters lose effectiveness each time through a lineup. Apply a stacked penalty on the second and third pass. This is what makes the bullpen decision actually a decision, and in college it matters even more because starters are less refined.

---

## Layer 2: The pitch level model

### Pitch outcomes

Every pitch resolves to one of six things:

1. Called ball
2. Called strike
3. Swinging strike
4. Foul ball
5. Ball in play
6. Hit by pitch

That is a 12 count by 6 outcome matrix, 72 cells. This is exactly how the classic SABR count study structured it, and it feeds a clean Markov process.

### Key findings to build against

- **Foul rate is roughly constant.** Between 33% and 40% of all swings get fouled off at every count, with the highest rate at 0-1. Batters do not meaningfully improve at protecting the plate with two strikes, which is counterintuitive and worth honoring.
- **Called third strikes are common.** More than a quarter of strikeouts in the study sample were looking. Do not make every punchout a swinging one.
- **Miss rate on swings is under 20%.** Roughly 45% of swings produce a ball in play, about 36% are fouls, and fewer than one in five is a whiff. At the college level, whiff rates should run somewhat higher.
- **Taken pitches are balls about 71% of the time.** Hitters have a decent eye. Your `eye` rating should shift this.
- **Runners on base changes everything.** Pitching from the stretch, batting average went up 36 points and strikeout rate went down in the study sample. Model a stretch penalty.
- **Pitches per plate appearance** ran about 3.7 with bases empty and 3.5 with runners on.

### College specific count data

Use these to shift your matrix away from MLB baselines:

| Metric | D1 | MLB |
|--------|-----|-----|
| Overall first pitch strike rate | 58.4% | 57% |
| Strikeouts starting with first pitch strike | 66.8% | 68% |
| Walks starting with first pitch ball | 74.3% | 70% |
| **3-0 strike rate** | **58.3%** | **80%** |

That last row is the whole story. College pitchers cannot reliably throw a strike 3-0. It is the single most distinctive number in the college game and it should be a direct output of your `control` rating. A high control college arm approaching 80% at 3-0 is an elite draft prospect, and the game should say so.

### The sequencing algorithm

```
resolvePlateAppearance(batter, pitcher, gameState):
  outcome = log5Outcome(batter, pitcher, context)   # Layer 1
  sequence = generateSequence(outcome, batter, pitcher, context)  # Layer 2
  return { outcome, sequence, pitchCount }

generateSequence(targetOutcome, batter, pitcher, context):
  count = [0, 0]
  pitches = []
  loop:
    pitchResult = samplePitch(count, batter, pitcher, targetOutcome)
    pitches.push(pitchResult)
    update count
    if terminal state reached that matches targetOutcome: return pitches
    if count would terminate on the wrong outcome: resample with bias
```

The bias step is the trick. As the count approaches a terminal state that contradicts the target, reweight toward fouls and non terminal outcomes. Cap the sequence length so you do not generate 30 pitch at bats. A hard ceiling around 14 with a forced resolution is fine.

Where this pays off: the player watches a 2-2 count, sees three straight fouls, and then the double lands. Nothing about the box score is fake.

---

## Ball in play resolution

Do not go straight from "ball in play" to "single". Two steps.

### Step 1: Batted ball type

Roll for type using the pitcher's ground ball rate, the batter's tendency, and the count:
- Ground ball
- Line drive
- Fly ball
- Popup

Line drives are the highest value outcome by a wide margin. Popups are nearly automatic outs. Count matters: hitters ahead in the count elevate more.

### Step 2: Fielding check

**Who is standing there — added September 1 2026.** Before a fielder can be
held responsible for anything, the nine have to be *at* nine distinct
positions, and until this date they were not. `TeamState` took the first man
claiming each spot and let the rest not exist, so a covered lineup with two
catchers and nobody in left fielded with a hole and a spare, and the man out of
position paid nothing for it.

The nine are now assigned before the first pitch, hardest spot first —
`FIELD_ORDER = C, SS, 2B, CF, 3B, RF, LF, 1B, DH`, the same ranking the depth
chart's `startersFrom` uses, and the DH last because it is a bat in a slot
rather than a place on the grass. Each man is then passed through
`fieldingAt(p, spot)`, which drops range, hands, arm and blocking by
`positionPenalty` — a rung tax up the defensive spectrum, plus a surcharge for
anyone catching who is not a catcher. **The bat is untouched:** moving a man
does not stop him hitting.

Two properties are worth stating because a future change could break either:

1. **A sound nine is the identity assignment.** Every man's own position is his
   cheapest, so a well-built card is arranged exactly as it was handed in and
   its numbers do not move. This is why the change landed with no
   re-calibration; `tests/posfit-probe.ts` asserts it directly.
2. **The assignment optimises.** Given two catchers and no shortstop it does
   not put a catcher at short — it slides a real infielder across and hides the
   catcher at first. A scrambled-but-complete nine therefore heals itself.

Measured cost of a genuine cover: **+0.088 runs a game**, about four a season.

Assign the responsible fielder by type and a spray direction roll (pull, center, opposite, influenced by handedness and count). Then check against that fielder's ratings.

Use the Strat-O-Matic separation of concerns, which is clean and has held up for decades:
- **Range rating**: does he get to it
- **Error rating**: does he convert it once he gets there
- Ratings run on a small scale where lower is better, 1 being a defensive star

This matters more in college than in the pros. Fielding is dramatically worse at the college level, and errors are a real source of runs. Make defense a legitimate lineup tradeoff so the slick fielding shortstop who cannot hit still has a case.

### Step 3: Baserunning

- Forced advances resolve automatically
- Discretionary advances (first to third on a single, scoring from second) check runner speed against the outfielder's arm rating and the location of the ball
- Tag ups on fly balls
- Double play checks on ground balls with a runner on first, weighted by the batter's speed and the middle infielders' ratings

Give each runner a stealing rating expressed as a success probability, split by whether he gets a good jump. Factor in the pitcher's hold runners rating and the catcher's arm. College steals a lot more than MLB does, so tune upward.

---

## College rules to model

These are what make it feel like college and not a reskinned MLB sim.

- **BBCOR bats.** Non wood bats must meet the BBCOR standard. The 2011 switch cut home runs roughly in half and dropped scoring by about a run a game. That is your power baseline. Batting average fell to around .279 and ERA to around 4.62 in the first BBCOR season.
- **Optional DH, including P/DH.** College teams are not required to use a DH, and a two way star can pitch and DH in the same game. This is a real roster mechanic and a genuinely fun lever. Build it in.
- **Pitch clock.** 20 second action clock. If the pitcher violates it, a ball is added to the count. If the offense violates it, a strike is added. Only one defensive timeout reset per batter. This is a great low frequency drama event and a place for a "composure" rating to bite.
- **Mound visit limits.** Second visit to the same pitcher in an inning forces removal. Constrains your coaching interventions, which is good design.
- **Extra innings.** By conference rule or mutual agreement, extras can start with a runner on second.
- **Run rule.** Games can end after seven innings on a 10 run lead by conference rule.
- **Nine innings, 60 feet 6 inches, 90 foot bases.** Standard.
- **Re entry rules need verification.** Sources disagree on whether and how a removed starter can return. Pull the current NCAA rulebook before implementing, since it changes and it affects your substitution logic.

---

## The AI decision layer

Once the engine works, the AI opponent needs to make calls. Build it on a run expectancy matrix: 24 base out states, each with an expected runs value and a win probability given the score and inning.

Every strategy decision becomes a comparison:
- **Steal**: does success probability times gain exceed failure probability times loss
- **Bunt**: almost always negative in expected runs, sometimes positive in win probability late in a tie game. Model both and let the AI weigh by leverage
- **Pitching change**: current pitcher's degraded effectiveness plus the platoon matchup versus the reliever's rested effectiveness plus warmup cost
- **Pinch hit**: platoon gain versus losing the bench and the defensive downgrade
- **Intentional walk**: base out state driven, not matchup driven

Give AI coaches personality weights. An aggressive coach steals more and pulls starters late. A conservative one bunts and plays for one run. That variety is what makes the conference feel populated.

---

## Calibration and tuning

Build the test harness before you build the UI. Non negotiable.

```
node sim.js --games 10000 --report league
```

Output league totals and compare against real D1 targets:

| Metric | Target |
|--------|--------|
| Runs per team per game | ~6.8 |
| Plate appearances per team per game | ~41 |
| Batting average | ~.290 |
| First pitch strike rate | ~58% |
| 3-0 strike rate | ~58% |
| Foul balls as share of swings | 33% to 40% |
| Pitches per PA, bases empty | ~3.7 |
| Pitches per PA, runners on | ~3.5 |

Second harness: sim a full season and print the stat leaders. If your batting champ is hitting .480 or your ERA leader is at 0.40, your distributions are too wide. Real college leaders land high but not absurd.

Third harness: sim the same two teams 1,000 times. The better team should win a clear majority but nowhere near all of them. Baseball is the least predictable major sport game to game, and if your favorite wins 85% of the time, your engine has too little variance and the dynasty mode will feel rigged.

---

## What to steal from other sims

| Game | Idea worth taking |
|------|-------------------|
| OOTP | The ratings taxonomy (stuff, movement, control, stamina, ground ball %, hold runners), potential ratings paired with current ratings, and scouting inaccuracy as a designed feature |
| Strat-O-Matic | Split responsibility between the batter card and the pitcher card on a coin flip. Elegant, and it naturally produces the right amount of randomness. Also the separate range and error fielding ratings, and the good jump vs bad jump steal split |
| Diamond Mind | Deep park effects and rigorous statistical validation as a design priority |
| Football Manager | The text play by play as the emotional core, plus scouting reports written in prose instead of numbers |

The Strat-O-Matic coin flip idea deserves a serious look as an alternative to log5. Instead of blending batter and pitcher rates, you randomly pick whose distribution governs the plate appearance. It is simpler to reason about and it produces good results, but log5 gives you finer control. Worth prototyping both and comparing outputs against the calibration table.

---

## Open questions for you

1. **Do you want an at bat by at bat replay speed control?** Reading every pitch of a 56 game season is a lot. Most players will want to sim weekdays and watch weekends.
2. **How visible should ratings be?** Fully hidden with scouting reports is more immersive but harder to build and harder for new players. Hybrid, where your own players are visible and recruits are fuzzy, is the usual compromise.
3. **Two way players.** College has real ones. Do you want a full two way system with fatigue crossing between hitting and pitching, or keep it simple for v1?
4. **Do you want defensive positioning and shifts as a coach decision?** Adds depth but also adds a lot of UI on a phone screen.
5. **Park effects at v1 or later?** College parks vary wildly, and altitude and wind are real. It is a nice flavor layer but not needed for the engine to work.
