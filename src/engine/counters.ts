// counters.ts
// The scouting desk's opinion of how to play one opponent.
//
// Reported from the emulator, September 6 2026: "purchase a scout playbook
// against a team, go to set up the strategy against that team and hit auto,
// it doesn't really set anything — nothing moves." It was true. AUTO set
// four positioning rows from absolute thresholds a typical lineup never
// crossed (a power average of 54, a speed average of 53, three more righties
// than lefties), and left the four offensive rows alone on principle. Against
// an ordinary club it moved one row: alignment, to situational.
//
// A plan against a team is how you play THEM, not who you are; the standing
// plan keeps the identity. So the desk now builds the whole plan from what
// the report legitimately bought — the roster in front of everybody and the
// habits the book covers — and every threshold is a distance from the
// league, measured on the season in front of it, so the rows that move are
// the ones this opponent is actually unusual in:
//
//   with the bat     steals against the catcher's arm and the staff's hold;
//                    the extra base against the outfield's arms; the bunt
//                    against the quality of the staff
//   on the mound     the hook against the lineup's power
//   without the ball alignment and a called side from the pull hitters and
//                    the handedness split; outfield depth from power and
//                    speed; infield depth from runners, bunters and speed
//
// Where the opponent is ordinary, the row keeps the standing plan's value.
// `tests/auto-probe.ts` measures the distributions the thresholds sit on.

import type { SeasonState, TeamRecord } from './season.js';
import type { Strategy, ShiftSide } from './strategy.js';
import type { Hitter } from './types.js';
import { tendenciesOf } from './tendencies.js';

/** The seven numbers a plan is built from, for one club. */
export interface TeamMeasures {
  power: number;
  speed: number;
  catcherArm: number;
  outfieldArm: number;
  staff: number;
  hold: number;
  /** Hitters who pull everything, and hitters who use the whole field. */
  pull: number;
  whole: number;
  /** Hitters with the green light. */
  runners: number;
  /** Right-handed bats minus left-handed bats. */
  split: number;
  /** Which way the pull hitters would be shifted, if there are enough of them. */
  pullSide: ShiftSide;
}

interface Stat { mean: number; sd: number }
export type Baselines = Record<'power' | 'speed' | 'catcherArm' | 'outfieldArm' | 'staff' | 'hold', Stat>;

const avg = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

export function teamMeasures(t: TeamRecord): TeamMeasures {
  const bats: readonly Hitter[] = t.team.lineup;
  const arms = [...t.team.rotation, ...t.team.bullpen];
  const catcher = bats.find((h) => h.pos === 'C');
  const outfield = bats.filter((h) => h.pos === 'LF' || h.pos === 'CF' || h.pos === 'RF');
  const pullers = bats.filter((h) => (tendenciesOf(h).spray ?? 0) > 0);
  const pullRight = pullers.filter((h) => h.bats === 'R').length;
  const pullLeft = pullers.filter((h) => h.bats === 'L').length;
  const righties = bats.filter((h) => h.bats === 'R').length;
  const lefties = bats.filter((h) => h.bats === 'L').length;
  // A called side beats the situational read only when one hand owns the
  // pull: the wrong side costs ten percent on every other hitter.
  const pullSide: ShiftSide = pullRight >= 3 && pullLeft === 0 ? 'left'
    : pullLeft >= 3 && pullRight === 0 ? 'right'
      : righties - lefties >= 6 ? 'left'
        : lefties - righties >= 6 ? 'right'
          : 'none';
  return {
    power: avg(bats.map((h) => h.power)),
    speed: avg(bats.map((h) => h.speed)),
    catcherArm: catcher?.arm ?? avg(bats.map((h) => h.arm)),
    outfieldArm: avg(outfield.map((h) => h.arm)),
    staff: avg(arms.map((p) => (p.stuff + p.movement + p.control) / 3)),
    hold: avg(arms.map((p) => p.holdRunners)),
    pull: pullers.length,
    whole: bats.filter((h) => (tendenciesOf(h).spray ?? 0) < 0).length,
    runners: bats.filter((h) => (tendenciesOf(h).running ?? 0) > 0).length,
    split: righties - lefties,
    pullSide,
  };
}

/** Where the league sits on each number this season, so a threshold is a distance. */
export function leagueBaselines(season: SeasonState): Baselines {
  const all = season.teams.map(teamMeasures);
  const stat = (k: keyof Baselines): Stat => {
    const xs = all.map((m) => m[k]);
    const mean = avg(xs);
    const sd = Math.sqrt(avg(xs.map((x) => (x - mean) ** 2))) || 1;
    return { mean, sd };
  };
  return {
    power: stat('power'), speed: stat('speed'), catcherArm: stat('catcherArm'),
    outfieldArm: stat('outfieldArm'), staff: stat('staff'), hold: stat('hold'),
  };
}

/**
 * How far from the league a club has to be, in standard deviations, before a
 * row moves. Half a deviation: each side of each measure catches about three
 * clubs in ten, so an ordinary club still reads as ordinary and nearly every
 * other one moves several rows. 0.6 left one club in twenty untouched.
 */
const FAR = 0.5;

/**
 * The plan against this opponent, from the standing plan and the report.
 * Pure and deterministic: the same season and the same club give the same
 * plan, and no draw is spent.
 */
export function opponentPlan(
  season: SeasonState, opp: TeamRecord, base: Strategy,
  baselines: Baselines = leagueBaselines(season),
): Strategy {
  const m = teamMeasures(opp);
  const z = (k: keyof Baselines): number => (m[k] - baselines[k].mean) / baselines[k].sd;
  // Runners are held by the catcher's arm and the staff's hold together.
  const holdZ = (z('catcherArm') + z('hold')) / 2;

  const steals = holdZ <= -FAR ? 'constant' : holdZ >= FAR ? 'never' : base.steals;
  const running = z('outfieldArm') <= -FAR ? 'aggressive'
    : z('outfieldArm') >= FAR ? 'patient' : base.running;
  // Against a staff you will not out-slug, manufacture; against one you
  // will, swing away.
  const bunt = z('staff') >= FAR ? 'often' : z('staff') <= -FAR ? 'never' : base.bunt;
  const hook = z('power') >= FAR ? 'quick' : z('power') <= -FAR ? 'patient' : base.hook;

  const alignment = m.pull >= 4 || Math.abs(m.split) >= 5 ? 'shift'
    : m.whole >= 3 && m.pull <= 1 ? 'straight'
      : 'situational';
  const shift = alignment === 'shift' ? m.pullSide : 'none';
  const outfield = z('power') >= FAR ? 'deep'
    : z('power') <= -FAR && z('speed') >= 0 ? 'shallow' : 'normal';
  const bunts = opp.strategy.bunt === 'often';
  const runs = m.runners >= 3 || opp.strategy.steals === 'constant' || opp.strategy.running === 'aggressive';
  const infield = bunts || (runs && z('speed') >= 0) ? 'in'
    : z('power') >= FAR ? 'back' : 'normal';

  return { ...base, steals, running, bunt, hook, alignment, shift, outfield, infield };
}
