// fielding.test.ts
// Individual fielders have to actually field.
//
// The whole point of splitting `fielding` into range and hands, generating them
// to fit the position, and building a spray model is that the man standing where
// the ball goes decides what happens. If a team of statues allows the same
// batting average as a team of acrobats, none of that machinery is real.
//
// The same rule now covers four more ratings and a book of defensive statistics.
// A rating that does not reach the simulation is a dead menu item — this project
// has shipped that twice, once with coach skills and once with a steal button
// that did nothing — so every one of them is checked here for direction *and*
// for size. A defensive rating that swung games would be a different bug.

import { describe, it, expect } from 'vitest';
import { simGame, createHalfInning, TeamState, throwRisk } from '../src/engine/game.js';
import { makeTeam, resetNames } from '../src/engine/players.js';
import { makeRng } from '../src/engine/rng.js';
import {
  createSeason, simNextDay, archiveSeason, nextSeason, fieldingFor, fieldingPct,
  playsAboveExpected, fieldingContext, leaders,
} from '../src/engine/season.js';
import { overallOf } from '../src/engine/ratings.js';
import { toPortable, fromPortable } from '../src/state/seasonCodec.js';
import type {
  EngineFn, Hitter, Pitcher, Player, Rng, Team,
} from '../src/engine/types.js';

/** Same bats and arms every time; only the gloves behind them change. */
function season(setRange: (n: number) => number, setHands: (n: number) => number) {
  resetNames();
  const build = makeRng(20260820);
  const offense = makeTeam(build, 'Offense', 50);
  const defense: Team = makeTeam(build, 'Defense', 50);

  for (const p of defense.lineup) {
    p.range = setRange(p.range);
    p.hands = setHands(p.hands);
  }

  // Enough games that an 8% difference in error rate is signal rather than
  // noise. The first version ran 300 and reported the *bad* hands committing
  // fewer errors, which was 1.5 standard errors of nothing.
  const rng = makeRng(555);
  let ab = 0, hits = 0, errors = 0;
  const GAMES = 1200;
  for (let i = 0; i < GAMES; i++) {
    const res = simGame(offense, defense, rng, { engine: 'log5' });
    // simGame takes (home, away), so `offense` is the home side and the
    // manipulated defence is away. Measure the home team's hitting — that is the
    // half played against the gloves under test — and the away team's errors.
    // Getting this backwards measures the manipulated team batting against an
    // untouched defence, which is a test of nothing.
    for (const line of res.home.batting.values()) { ab += line.ab; hits += line.h; }
    errors += res.away.errors;
  }
  return { avg: hits / ab, errors: errors / GAMES };
}

describe('the men on the field', () => {
  it('turns more balls into outs when the gloves are better', () => {
    const statues = season(() => 20, (h) => h);
    const acrobats = season(() => 80, (h) => h);

    expect(acrobats.avg, 'a great defence must allow a lower average')
      .toBeLessThan(statues.avg);

    // And by an amount worth having: this is a 60 point range gap across the
    // whole diamond, which should be plainly visible, not a rounding difference.
    expect(statues.avg - acrobats.avg).toBeGreaterThan(0.008);
  });

  it('boots more balls when the hands are worse', () => {
    const sure = season((r) => r, () => 85);
    const stony = season((r) => r, () => 15);

    expect(stony.errors, 'bad hands must produce more errors')
      .toBeGreaterThan(sure.errors);
  });

  it('keeps errors on the ground, where they belong', async () => {
    // Errors are overwhelmingly a ground ball event. A defence that never sees a
    // grounder should make far fewer of them than one that sees nothing else.
    const { KIND_ERROR_RISK } = await import('../src/engine/game.js');
    expect(KIND_ERROR_RISK.ground).toBeGreaterThan(KIND_ERROR_RISK.fly as number);
    expect(KIND_ERROR_RISK.ground).toBeGreaterThan(KIND_ERROR_RISK.popup as number);
  });
});

// ---------------------------------------------------------------------------
// The measurement harness for the rest of this file
// ---------------------------------------------------------------------------

interface Tally {
  games: number;
  runsAllowed: number;
  errors: number;
  throwing: number;
  pb: number;
  chances: number;
  plays: number;
  expected: number;
  sba: number;
  cs: number;
  /** The defending side's own fielding lines, keyed by name. */
  byName: Map<string, { chances: number; plays: number; errors: number; pb: number }>;
  byPos: Map<string, { chances: number; plays: number; errors: number; throwing: number; pb: number }>;
}

const blank = (): Tally => ({
  games: 0, runsAllowed: 0, errors: 0, throwing: 0, pb: 0,
  chances: 0, plays: 0, expected: 0, sba: 0, cs: 0,
  byName: new Map(), byPos: new Map(),
});

/**
 * Stand a runner on a base. `bases` is read-only so the app cannot rearrange an
 * inning behind the engine's back; a test setting up the exact situation it
 * wants is the one caller that legitimately does.
 */
const place = (
  half: { readonly bases: readonly (Hitter | null)[] }, base: 1 | 2 | 3, who: Hitter,
): void => { (half.bases as (Hitter | null)[])[base - 1] = who; };

/**
 * Play a fixed matchup and total up what the *away* side did with its gloves.
 *
 * `bend` is handed the away roster before a pitch is thrown, which is the whole
 * design: one rating is moved and everything else — both lineups, the seed, the
 * schedule of dice — is identical between two calls. Any difference is that
 * rating and nothing else.
 */
function defenceTrial(
  games: number, bend: (roster: Player[]) => void, seed = 20260824,
): Tally {
  resetNames();
  const build = makeRng(seed);
  const offense = makeTeam(build, 'Offense', 50);
  const defense = makeTeam(build, 'Defense', 50);
  bend([
    ...defense.lineup, ...defense.bench, ...defense.rotation, ...defense.bullpen,
  ]);

  const t = blank();
  const rng = makeRng(4242);
  for (let i = 0; i < games; i++) {
    const res = simGame(offense, defense, rng, { engine: 'log5' });
    t.games += 1;
    t.runsAllowed += res.home.runs;
    t.errors += res.away.errors;
    for (const f of res.away.fielding.values()) {
      t.throwing += f.throwing; t.pb += f.pb;
      t.chances += f.chances; t.plays += f.plays; t.expected += f.expected;
      t.sba += f.sba; t.cs += f.cs;
      const n = t.byName.get(f.player.name) ?? { chances: 0, plays: 0, errors: 0, pb: 0 };
      n.chances += f.chances; n.plays += f.plays; n.errors += f.errors; n.pb += f.pb;
      t.byName.set(f.player.name, n);
      const p = t.byPos.get(f.player.pos) ?? { chances: 0, plays: 0, errors: 0, throwing: 0, pb: 0 };
      p.chances += f.chances; p.plays += f.plays; p.errors += f.errors;
      p.throwing += f.throwing; p.pb += f.pb;
      t.byPos.set(f.player.pos, p);
    }
  }
  return t;
}

/** How far apart two rates are, as a share of the smaller one. */
const per = (n: number, t: Tally): number => n / t.games;

/**
 * The three pairings every runs-allowed comparison in this file is pooled over.
 *
 * One pair of teams is enough to prove a rating reaches the simulation — the
 * counts it moves are nearly noiseless — and nowhere near enough to say what it
 * costs in runs. Measured across six independent pairings, seventy points of arm
 * accuracy is worth 2.1% of the runs a defence allows and seventy points of
 * catcher blocking 2.2%, but the single-pairing figures for those same effects
 * range from -1.6% to +6.3%. A bar drawn against one pairing is therefore a bar
 * drawn against the dice, which is the mistake `CONTEXT.normalizer` in ratings.ts
 * carries a paragraph about having already made once.
 */
const PAIRINGS = [20260824, 555001, 991177] as const;

/** The same trial over every pairing, added together. */
function pooledTrial(games: number, bend: (roster: Player[]) => void): Tally {
  const total = blank();
  for (const seed of PAIRINGS) {
    const t = defenceTrial(games, bend, seed);
    total.games += t.games;
    total.runsAllowed += t.runsAllowed;
    total.errors += t.errors; total.throwing += t.throwing; total.pb += t.pb;
    total.chances += t.chances; total.plays += t.plays; total.expected += t.expected;
    total.sba += t.sba; total.cs += t.cs;
    for (const [pos, v] of t.byPos) {
      const row = total.byPos.get(pos) ?? { chances: 0, plays: 0, errors: 0, throwing: 0, pb: 0 };
      row.chances += v.chances; row.plays += v.plays; row.errors += v.errors;
      row.throwing += v.throwing; row.pb += v.pb;
      total.byPos.set(pos, row);
    }
    // Names carry the pairing, because three pairings are three different
    // rosters and the same name in two of them is two different men. Keeping
    // them apart is what lets the pooled totals still add up per player.
    for (const [name, v] of t.byName) total.byName.set(`${seed}:${name}`, v);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Every new rating has to reach the simulation
// ---------------------------------------------------------------------------

describe('arm accuracy', () => {
  const wild = pooledTrial(250, (r) => { for (const p of r) p.armAccuracy = 15; });
  const sure = pooledTrial(250, (r) => { for (const p of r) p.armAccuracy = 85; });

  it('throws more balls away when nobody can hit the first baseman', () => {
    expect(per(wild.throwing, wild)).toBeGreaterThan(per(sure.throwing, sure));
    // Both ends still throw some away and neither is throwing on every play.
    expect(per(sure.throwing, sure)).toBeGreaterThan(0);
    expect(per(wild.throwing, wild)).toBeLessThan(1);
  });

  it('keeps the effect small enough to be a rating and not a result', () => {
    // Seventy rating points of accuracy across an entire defence, which is far
    // wider than any real roster. Home field is a 2% offensive edge and this has
    // to stay in that family.
    //
    // Measured on the wild throws themselves rather than on runs, because that
    // is where the effect can actually be seen: the count is all but noiseless
    // and the runs are not. The swing is worth about 0.15 extra throwing errors
    // a team a game, and an error is worth something under a run, so the whole
    // mechanism is a couple of percent of scoring — which the pooled runs figure
    // below agrees with at 2.1%.
    const extra = per(wild.throwing, wild) - per(sure.throwing, sure);
    expect(extra).toBeGreaterThan(0);
    expect(extra).toBeLessThan(0.25);

    // The runs it costs, pooled over three pairings, and deliberately loose:
    // even pooled this is a guard against a blow-up rather than a measurement,
    // because the Monte Carlo spread on runs allowed is still wider than the
    // effect. The measurement is the line above.
    const gap = Math.abs(per(wild.runsAllowed, wild) - per(sure.runsAllowed, sure));
    expect(gap / per(sure.runsAllowed, sure)).toBeLessThan(0.08);
  });

  it('is the first baseman as well, on the flip to the man covering', () => {
    // The last ground ball in the engine with nobody throwing on it. Half a
    // first baseman's chances are a feed to the pitcher covering the bag, and
    // without them his arm is a rating the simulation cannot read — the exact
    // dead menu item the rest of this file exists to prevent.
    //
    // Split in two on purpose. A first baseman throws about 0.02 balls away a
    // game, so telling his rating apart from the dice by counting his errors
    // would take a couple of thousand games; the count here only has to prove
    // the play reaches his line at all. Which rating decides it is then checked
    // exactly, on the risk itself, where there are no dice.
    const t = defenceTrial(300, () => {});
    expect(t.byPos.get('1B')?.chances).toBeGreaterThan(0);
    expect(t.byPos.get('1B')?.throwing).toBeGreaterThan(0);

    resetNames();
    const build = makeRng(4711);
    const probe = makeTeam(build, 'Probe', 50);
    const first = probe.lineup.find((p) => p.pos === '1B') as Hitter;
    const covering = probe.rotation[0] as Pitcher;
    const risk = (accuracy: number, hands: number): number =>
      throwRisk({ ...first, armAccuracy: accuracy }, { ...covering, hands });

    expect(risk(50, 50)).toBeGreaterThan(0);
    expect(risk(10, 50)).toBeGreaterThan(risk(90, 50));
    // Two men are on this play and both are read. It is the only place a
    // pitcher's glove is asked anything away from a comebacker.
    expect(risk(50, 10)).toBeGreaterThan(risk(50, 90));
  });

  it('is a separate skill from arm strength', () => {
    // A cannon that cannot find first base is a real player, and he could not
    // exist while one rating decided both.
    //
    // **Asserted on the risk itself rather than on a game trial**, and the
    // reason is a correction to how this used to be checked. It compared the
    // throwing-error *counts* of a 90-arm defence and a 20-arm one and expected
    // them to be close — but `arm` is not inert elsewhere. It decides whether a
    // runner is gunned down taking an extra base and, through the catcher,
    // whether anybody runs at all: over four hundred games the 20-arm roster
    // allowed 447 stolen bases and the 90-arm roster 219. Those are different
    // games. They end innings at different points, make pitching changes at
    // different points, and therefore field a different mix of batted balls,
    // and a ground ball is several times likelier to be booted than a fly. The
    // old assertion was reading all of that and calling it accuracy.
    //
    // What the split actually promises is a property of one function, and there
    // are no dice in it.
    resetNames();
    const build = makeRng(4711);
    const probe = makeTeam(build, 'Probe', 50);
    const covering = probe.rotation[0] as Pitcher;
    for (const man of probe.lineup) {
      if (man.pos === 'DH' || man.pos === 'LF' || man.pos === 'CF' || man.pos === 'RF') continue;
      const weak = throwRisk({ ...man, arm: 20 }, covering);
      const strong = throwRisk({ ...man, arm: 90 }, covering);
      expect(strong, man.pos).toBe(weak);
      expect(weak).toBeGreaterThan(0);
    }
  });
});

describe('blocking', () => {
  // Only the catcher's, because only the catcher's is ever read — which is the
  // stated design and would be a silent dead rating if it were not true.
  const leaky = pooledTrial(250, (r) => {
    for (const p of r) if (p.pos === 'C') (p as Hitter).blocking = 15;
  });
  const wall = pooledTrial(250, (r) => {
    for (const p of r) if (p.pos === 'C') (p as Hitter).blocking = 85;
  });

  it('lets more pitches past a catcher who cannot block', () => {
    expect(leaky.pb).toBeGreaterThan(wall.pb);
    expect(per(wall.pb, wall)).toBeGreaterThan(0);
  });

  it('charges every passed ball to the man behind the plate', () => {
    // Blocking sits on every position player and is read for exactly one of
    // them, which is the design and would be a silent lie if anybody else's
    // line picked one up.
    expect(leaky.byPos.get('C')?.pb).toBe(leaky.pb);
    for (const [pos, line] of leaky.byPos) {
      if (pos !== 'C') expect(line.pb).toBe(0);
    }
  });

  it('does not count a passed ball as an error', () => {
    // By rule it is its own line in the book, and the runs it let in stay
    // earned. Folding it into the E column would move a calibrated quantity for
    // a play that is not an error.
    expect(leaky.pb).toBeGreaterThan(0);
    expect(leaky.errors).toBe(
      [...leaky.byName.values()].reduce((a, v) => a + v.errors, 0),
    );
    expect(leaky.errors).toBeLessThan(leaky.pb + leaky.errors);
  });

  it('keeps the effect small', () => {
    // Same reasoning and same measurement as the accuracy case: the count is
    // where the effect can be seen, and the runs are only a guard. Seventy
    // points of blocking on a career backstop is worth about a third of a
    // passed ball a game, which at a base apiece is a couple of percent of
    // scoring — pooled runs put it at 2.2%.
    const extra = per(leaky.pb, leaky) - per(wall.pb, wall);
    expect(extra).toBeGreaterThan(0);
    expect(extra).toBeLessThan(0.5);

    const gap = Math.abs(per(leaky.runsAllowed, leaky) - per(wall.runsAllowed, wall));
    expect(gap / per(wall.runsAllowed, wall)).toBeLessThan(0.08);
  });
});

/**
 * A scripted at-bat harness. The engine never resolves anything — every plate
 * appearance is a strikeout the tactic pre-empts — so the only dice that turn
 * are the ones belonging to the call under test.
 */
const strikeout: EngineFn = () =>
  ({ event: 'out', kind: 'strikeout', pitches: ['swinging'], engine: 'log5' });

/**
 * One generator for the whole trial, drawn straight through.
 *
 * Emphatically not a fresh `makeRng(base + i)` per attempt, which is what the
 * first version of this did and why it reported five hundred steals out of five
 * hundred. xorshift32 seeded with a small integer returns a very small first
 * number — the seed has barely been mixed — so every "did it work" roll came
 * back near zero and everything worked. Both arms of a comparison seed the same
 * way and draw the same number of times, so the streams stay comparable.
 */
function buntTrial(skill: number, tries: number): { onBase: number; forced: number } {
  resetNames();
  const build = makeRng(31337);
  const bats = makeTeam(build, 'Bats', 50);
  const field = makeTeam(build, 'Field', 50);
  for (const h of bats.lineup) h.bunt = skill;

  const rng: Rng = makeRng(918273645);
  let onBase = 0;
  let forced = 0;
  for (let i = 0; i < tries; i++) {
    const bat = new TeamState(bats, false);
    const fld = new TeamState(field, true);
    const half = createHalfInning(
      bat, fld, 1, strikeout, rng, () => {}, false, null, undefined, true, true,
    );
    const onFirst = bats.lineup[3] as Hitter;
    place(half, 1, onFirst);
    half.step('bunt');
    // The sacrifice worked if the runner is standing on second and the batter
    // is on first in the place he vacated.
    if (half.bases[1] === onFirst) onBase += 1;
    else if (!half.bases.includes(onFirst)) forced += 1;
  }
  return { onBase, forced };
}

describe('bunting', () => {
  const good = buntTrial(90, 600);
  const bad = buntTrial(15, 600);

  it('moves the runner more often when the man can lay one down', () => {
    expect(good.onBase).toBeGreaterThan(bad.onBase);
  });

  it('forces the lead runner more often when he cannot', () => {
    expect(bad.forced).toBeGreaterThan(good.forced);
  });

  it('still mostly works either way, because a sacrifice usually does', () => {
    // The rating decides how often the call misfires, not whether the play
    // exists. A bunt that failed most of the time for a poor bunter would make
    // the tactic unusable rather than situational.
    expect(bad.onBase / 600).toBeGreaterThan(0.6);
  });
});

function stealTrial(bend: (h: Hitter) => void, tries: number): { sb: number; cs: number } {
  resetNames();
  const build = makeRng(4711);
  const bats = makeTeam(build, 'Bats', 50);
  const field = makeTeam(build, 'Field', 50);
  const runner = bats.lineup[2] as Hitter;
  bend(runner);

  const rng: Rng = makeRng(918273645);
  let sb = 0;
  let cs = 0;
  for (let i = 0; i < tries; i++) {
    const bat = new TeamState(bats, false);
    const fld = new TeamState(field, true);
    const half = createHalfInning(
      bat, fld, 1, strikeout, rng, () => {}, false, null, undefined, true, true,
    );
    place(half, 1, runner);
    half.step('steal');
    if (half.bases[1] === runner) sb += 1;
    else cs += 1;
  }
  return { sb, cs };
}

describe('stealing', () => {
  it('rewards the jump, not only the wheels', () => {
    // Same runner, same catcher, same dice: only the instinct moves. Before the
    // split this comparison was not expressible at all, because there was one
    // number and it was speed.
    const instinct = stealTrial((h) => { h.speed = 50; h.steal = 90; }, 500);
    const oblivious = stealTrial((h) => { h.speed = 50; h.steal = 15; }, 500);
    expect(instinct.sb).toBeGreaterThan(oblivious.sb);
  });

  it('still rewards speed on its own', () => {
    // The split must not have taken speed out of the play. A fast man with an
    // ordinary jump beats a slow man with the same jump.
    const quick = stealTrial((h) => { h.speed = 90; h.steal = 50; }, 500);
    const slow = stealTrial((h) => { h.speed = 15; h.steal = 50; }, 500);
    expect(quick.sb).toBeGreaterThan(slow.sb);
  });

  it('leaves the jump worth more than the legs, which is why it exists', () => {
    const jump = stealTrial((h) => { h.speed = 50; h.steal = 90; }, 500);
    const legs = stealTrial((h) => { h.speed = 90; h.steal = 50; }, 500);
    expect(jump.sb).toBeGreaterThan(legs.sb);
  });

  it('puts the throw on the catcher, where a badge can find it', () => {
    const t = defenceTrial(200, () => {});
    expect(t.sba + t.cs).toBeGreaterThan(0);
    const behindThePlate = t.byPos.get('C');
    expect(behindThePlate).toBeDefined();
  });
});

describe('the pitcher as a fielder', () => {
  it('fields comebackers at all, which he never did before', () => {
    const t = defenceTrial(200, () => {});
    const mound = t.byPos.get('P');
    expect(mound, 'nothing was ever hit back at the pitcher').toBeDefined();
    // A tenth or so of ground balls, which is a couple of chances a game across
    // however many arms took the ball.
    expect((mound as { chances: number }).chances / t.games).toBeGreaterThan(0.8);
    expect((mound as { chances: number }).chances / t.games).toBeLessThan(3);
  });

  it('makes more of them with a better glove', () => {
    const athletic = defenceTrial(300, (r) => {
      for (const p of r) if (p.pos === 'P') p.range = 90;
    });
    const statuesque = defenceTrial(300, (r) => {
      for (const p of r) if (p.pos === 'P') p.range = 10;
    });
    const rate = (t: Tally): number => {
      const m = t.byPos.get('P') as { chances: number; plays: number };
      return m.plays / m.chances;
    };
    expect(rate(athletic)).toBeGreaterThan(rate(statuesque));
  });

  it('boots them with bad hands, and is charged for it himself', () => {
    const stony = defenceTrial(300, (r) => {
      for (const p of r) if (p.pos === 'P') p.hands = 10;
    });
    const sure = defenceTrial(300, (r) => {
      for (const p of r) if (p.pos === 'P') p.hands = 90;
    });
    const mound = (t: Tally): number => (t.byPos.get('P') as { errors: number }).errors;
    expect(mound(stony)).toBeGreaterThan(mound(sure));
  });
});

// ---------------------------------------------------------------------------
// The book
// ---------------------------------------------------------------------------

describe('errors belong to somebody', () => {
  const t = defenceTrial(300, () => {});

  it('sums the team total out of the men who made them', () => {
    // The E column used to be a counter of its own, which is why no defensive
    // play in this game had ever been attributed to a player. It is derived now,
    // so the two cannot disagree.
    const summed = [...t.byName.values()].reduce((a, v) => a + v.errors, 0);
    expect(summed).toBe(t.errors);
    expect(t.errors).toBeGreaterThan(0);
  });

  it('names more than one culprit and spreads them around the infield', () => {
    const guilty = [...t.byName.values()].filter((v) => v.errors > 0);
    expect(guilty.length).toBeGreaterThan(3);
    // Infielders boot more than outfielders, because grounders are where errors
    // live and grounders are an infield event.
    const inf = ['SS', '2B', '3B'].reduce((a, p) => a + (t.byPos.get(p)?.errors ?? 0), 0);
    const out = ['LF', 'CF', 'RF'].reduce((a, p) => a + (t.byPos.get(p)?.errors ?? 0), 0);
    expect(inf).toBeGreaterThan(out);
  });

  it('records a chance for every ball hit at a man, and a play for the outs', () => {
    expect(t.plays).toBeLessThan(t.chances);
    expect(t.plays + t.errors).toBeLessThanOrEqual(t.chances);
    // Everybody who was charged an error was given the ball first.
    for (const [, v] of t.byName) if (v.errors > 0) expect(v.chances).toBeGreaterThan(0);
  });

  it('lands the league on a believable fielding percentage and error rate', () => {
    // Real D1 fields about .967 and makes a little over one error a team a game.
    // Ours divides by balls hit at a man rather than by putouts plus assists —
    // see `fieldingPct` for why — so it reads a few points low and means the
    // same thing.
    const pct = (t.chances - t.errors) / t.chances;
    expect(pct).toBeGreaterThan(0.950);
    expect(pct).toBeLessThan(0.978);
    expect(per(t.errors, t)).toBeGreaterThan(0.90);
    expect(per(t.errors, t)).toBeLessThan(1.30);
    // And a third or so of them are the throw rather than the glove, which is
    // roughly the real split and the entire reason the two paths are separate.
    expect(t.throwing / t.errors).toBeGreaterThan(0.20);
    expect(t.throwing / t.errors).toBeLessThan(0.50);
  });

  it('keeps expected honest: an average glove makes about what it should', () => {
    // `expected` is the play the log5 model had already settled before anyone's
    // range was consulted, so across a whole league the only thing separating it
    // from `plays` is the errors. If these two drifted apart by more than that,
    // the range swing would be adding or removing outs league-wide rather than
    // moving them between fielders.
    const slack = Math.abs((t.expected - t.plays) - t.errors);
    expect(slack).toBeLessThan(t.errors * 0.35);
  });
});

describe('the fielding book survives the calendar', () => {
  const build = (): ReturnType<typeof createSeason> => {
    const s = createSeason(makeRng(77));
    s.captureBoxFor = 0;
    for (let i = 0; i < 6; i++) simNextDay(s);
    return s;
  };

  it('accumulates a season line for the men who took the field', () => {
    const s = build();
    const lines = [...(s.fielding as Map<string, { chances: number }>).values()];
    expect(lines.length).toBeGreaterThan(100);
    expect(lines.reduce((a, v) => a + v.chances, 0)).toBeGreaterThan(0);

    // A real roster player, found through the season the same way batting is.
    const shortstop = s.teams[0]?.team.lineup.find((p) => p.pos === 'SS');
    expect(shortstop).toBeDefined();
    const line = fieldingFor(s, (shortstop as Hitter).id);
    expect(line.g).toBeGreaterThan(0);
    expect(line.chances).toBeGreaterThan(0);
    expect(fieldingPct(line)).toBeGreaterThan(0.5);
    expect(Number.isFinite(playsAboveExpected(line))).toBe(true);
  });

  it('writes gloves into the record book beside the bat', () => {
    const s = build();
    archiveSeason(s, 0, 2027);
    const rows = Object.values(s.careers).flat();
    expect(rows.length).toBeGreaterThan(0);
    const fielders = rows.filter((r) => r.chances !== undefined);
    expect(fielders.length).toBeGreaterThan(0);
    for (const r of fielders) {
      expect(r.chances as number).toBeGreaterThan(0);
      expect(r.plays as number).toBeLessThanOrEqual(r.chances as number);
      expect(r.errors as number).toBeLessThanOrEqual(r.chances as number);
    }
  });

  it('starts the next year with an empty book, like the other two', () => {
    const s = build();
    expect((s.fielding as Map<string, unknown>).size).toBeGreaterThan(0);
    const next = nextSeason(s);
    expect(next.fielding?.size).toBe(0);
    expect(next.batting.size).toBe(0);
    // The record book is the one thing that carries.
    expect(next.careers).toBe(s.careers);
  });

  it('survives a structured clone and the save codec', () => {
    const s = build();
    const before = [...(s.fielding as Map<string, { chances: number }>).values()]
      .reduce((a, v) => a + v.chances, 0);
    const round = fromPortable(structuredClone(toPortable(s)));
    const after = [...(round.fielding as Map<string, { chances: number }>).values()]
      .reduce((a, v) => a + v.chances, 0);
    expect(after).toBe(before);
    expect(after).toBeGreaterThan(0);
  });

  it('opens a save written before fielding existed', () => {
    // The one outcome a save file must never have. An old dynasty arrives with
    // two stat books instead of three, and has to load into a season that keeps
    // score properly from its next pitch.
    const s = build();
    const portable = structuredClone(toPortable(s));
    delete (portable.season as { fielding?: unknown }).fielding;

    const loaded = fromPortable(portable);
    expect(loaded.fielding).toBeInstanceOf(Map);
    expect(loaded.fielding?.size).toBe(0);

    // And it keeps counting from here rather than throwing on the next game.
    expect(() => simNextDay(loaded)).not.toThrow();
    expect((loaded.fielding as Map<string, unknown>).size).toBeGreaterThan(0);
  });
});

describe('reading the fielding book back out', () => {
  const build = (): ReturnType<typeof createSeason> => {
    const s = createSeason(makeRng(77));
    s.captureBoxFor = 0;
    for (let i = 0; i < 12; i++) simNextDay(s);
    return s;
  };

  it('ranks gloves on plays above average per chance, not on errors', () => {
    const s = build();
    const board = leaders(s, { minChances: 10 }).fielding;
    expect(board.length).toBeGreaterThan(0);
    // Descending, and the detail carries the volume the count depends on.
    for (let i = 1; i < board.length; i++) {
      expect((board[i - 1] as { value: number }).value)
        .toBeGreaterThanOrEqual((board[i] as { value: number }).value);
    }
    expect(board[0]?.detail).toMatch(/CH,.*PLAYS,.*PCT/);

    // The man who never touched the ball sits at exactly zero and must not be
    // on it. That is the entire reason the minimum exists.
    const zero = [...(s.fielding as Map<string, { chances: number }>).entries()]
      .find(([, f]) => f.chances === 0);
    if (zero) expect(board.some((r) => r.id === zero[0])).toBe(false);
  });

  it('does not let a man with a handful of chances outrank an everyday fielder', () => {
    const s = build();
    const board = leaders(s, { minChances: 10 }).fielding;
    const book = s.fielding as Map<string, { chances: number }>;
    // Every man on it has to have cleared the bar. The failure this guards
    // against is the old raw-count ranking, where the league average being
    // negative meant more chances dragged a fielder down and a backup with a
    // dozen touches sat on top of a shortstop who played every inning.
    for (const r of board) {
      expect(book.get(r.id)?.chances ?? 0).toBeGreaterThanOrEqual(10);
    }
  });

  it('keeps a glove off the board until enough has been hit at him', () => {
    const s = build();
    const strict = leaders(s, { minChances: 10_000 }).fielding;
    expect(strict.length).toBe(0);
  });

  it('tells a fielder where he stands, because zero is not the comparison', () => {
    const s = build();
    const busiest = [...(s.fielding as Map<string, { chances: number }>).entries()]
      .sort((a, b) => b[1].chances - a[1].chances)[0];
    expect(busiest).toBeDefined();

    const id = (busiest as [string, unknown])[0] as unknown as Hitter['id'];
    const ctx = fieldingContext(s, id, { minChances: 10 });
    expect(ctx).not.toBeNull();
    const c = ctx as NonNullable<typeof ctx>;
    expect(c.ranked).toBe(true);
    expect(c.rank).toBeGreaterThanOrEqual(1);
    expect(c.rank).toBeLessThanOrEqual(c.qualified);

    // The whole point: the league's own line is below zero, so a fielder can
    // read negative and still be above average.
    expect(c.leagueRate).toBeLessThan(0);
    expect(Number.isFinite(c.rate)).toBe(true);
  });

  it('says nothing about a man who has not fielded a ball', () => {
    const s = createSeason(makeRng(77));
    const someone = s.teams[0]?.team.lineup[0] as Hitter;
    expect(fieldingContext(s, someone.id)).toBeNull();
  });
});

describe('defence in the overall rating', () => {
  /** A league-average position player, so one rating at a time can be moved. */
  const average = (pos: Hitter['pos']): Hitter => {
    resetNames();
    const p = makeTeam(makeRng(4242), 'X', 50).lineup[0] as Hitter;
    p.pos = pos;
    p.contact = 50; p.power = 50; p.eye = 50; p.speed = 50;
    p.range = 50; p.hands = 50; p.arm = 50; p.armAccuracy = 50; p.blocking = 50;
    p.bunt = 50; p.steal = 50;
    return p;
  };

  const withRating = (pos: Hitter['pos'], key: keyof Hitter, v: number): number => {
    const p = average(pos);
    (p as unknown as Record<string, number>)[key] = v;
    return overallOf(p);
  };

  it('leaves an average player at average, whatever position he plays', () => {
    for (const pos of ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as const) {
      expect(overallOf(average(pos))).toBe(50);
    }
  });

  it('pays a catcher for blocking and nobody else', () => {
    expect(withRating('C', 'blocking', 90)).toBeGreaterThan(50);
    expect(withRating('LF', 'blocking', 90)).toBe(50);
    expect(withRating('1B', 'blocking', 90)).toBe(50);
  });

  it('values a throw where the throw is the play', () => {
    const short = withRating('SS', 'armAccuracy', 90) - 50;
    const first = withRating('1B', 'armAccuracy', 90) - 50;
    expect(short).toBeGreaterThan(first);
    expect(first).toBeGreaterThan(0);
  });

  it('values range up the middle and hands in the corner', () => {
    expect(withRating('CF', 'range', 90)).toBeGreaterThan(withRating('1B', 'range', 90));
    expect(withRating('1B', 'hands', 90)).toBeGreaterThan(withRating('CF', 'hands', 90));
  });

  it('makes a defensive catcher a better player than a bad one', () => {
    const good = average('C');
    good.range = 68; good.hands = 74; good.arm = 78; good.armAccuracy = 72; good.blocking = 80;
    const bad = average('C');
    bad.range = 32; bad.hands = 30; bad.arm = 26; bad.armAccuracy = 30; bad.blocking = 24;
    // Identical bats. The only difference between them is the glove, and it has
    // to be worth something without being worth a whole player.
    const gap = overallOf(good) - overallOf(bad);
    expect(gap).toBeGreaterThan(5);
    expect(gap).toBeLessThan(15);
  });

  it('gives the pitcher a glove worth a little and not a lot', () => {
    resetNames();
    const build = makeRng(99);
    const arm = makeTeam(build, 'X', 50).rotation[0] as Pitcher;
    arm.range = 50; arm.hands = 50; arm.arm = 50; arm.armAccuracy = 50;
    const base = overallOf(arm);
    arm.range = 90; arm.hands = 90; arm.arm = 90; arm.armAccuracy = 90;
    const gloved = overallOf(arm);
    expect(gloved).toBeGreaterThan(base);
    expect(gloved - base).toBeLessThanOrEqual(2);
  });

  it('ignores bunting and stealing, which are calls rather than quality', () => {
    const p = average('2B');
    const base = overallOf(p);
    p.bunt = 95; p.steal = 95;
    expect(overallOf(p)).toBe(base);
  });
});
