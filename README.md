# College Baseball Dynasty: Phase 0

A headless, pure JavaScript baseball simulation engine. No UI, no dependencies.
Everything here is browser portable, so the mobile front end can import it later
without changes.

## Run it

```
node sim.js game                     one game with text play by play
node sim.js game --engine pitch      same, using engine B
node sim.js calibrate --n 1000       league totals vs real D1 targets
node sim.js compare --n 1000         both engines side by side
node sim.js platoon --n 40000        prove the handedness model works
node sim.js parity --n 800           does the better team win too often
```

## Files

| File | What it holds |
|------|---------------|
| `src/ratings.js` | Every baseball number in the game. League rates, rating to rate conversion, platoon math, fatigue. **Tune here and nowhere else.** |
| `src/players.js` | Player and team generation, handedness distribution, platoon skill draws |
| `src/pitchModel.js` | One pitch at a time. Zone rates and swing rates by count |
| `src/engines.js` | Both plate appearance engines |
| `src/game.js` | Nine innings, baserunning, steals, errors, pitching changes, box score |
| `sim.js` | CLI and the calibration harness |

## The two engines

**Engine A, `log5`.** Generalized log5 picks the plate appearance outcome from
batter rates, pitcher rates, and league rates, normalized across seven events.
The pitch sequence is then constructed to land on that outcome. Season stats are
correct by construction.

**Engine B, `pitch`.** Pitches are simulated freely and the outcome emerges. More
elegant in principle. In practice it took two full tuning passes to get within
10 percent of the targets, and strikeouts are still running high.

## The most important knob

`SPREAD` in `src/ratings.js`. It scales every rating sensitivity at once.

Turn it up and stars separate more, but the better team starts winning too often
and the dynasty mode feels rigged. Turn it down and everyone plays the same.
Currently 0.62, which puts a 58 rated team beating a 46 rated team about 74
percent of the time. That is roughly right for college baseball.

Any time you change `SPREAD`, rerun `calibrate` and `parity` together.

## What is not built yet

Seasons, schedules, standings, rosters, recruiting, the draft, anything past a
single game. That is Phase 1 onward in the roadmap. This is the foundation those
sit on, and it is the part that has to be right.
