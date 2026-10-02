// recruitRace.ts
// The recruiting board's shared figures and words: a prospect's slot, where
// you stand with him, and his interest split between the programs chasing him.
//
// The board's race rows and the prospect sheet's race card both read from
// here, so the row a coach taps and the sheet it opens can never disagree
// about who leads or by how much.

import {
  LATE_DECIDER_WEEK, RECRUITING_WEEKS, lostCause, weekActionCost,
  type DecisionStyle, type PitchVerdict, type Prospect, type RecruitMajorInput, type RecruitingFactor,
} from '../../engine/recruiting.js';
import { isTwoWay } from '../../engine/types.js';
import type { Pitcher, Position } from '../../engine/types.js';
import type { IconName, Tone } from '../components/ui/index.js';
import { POSITION_NAME } from '../words.js';

/** A prospect's position code; a two-way man answers to both of his. */
export const slotOf = (p: Prospect): string =>
  isTwoWay(p.player) ? 'TWO-WAY'
    : p.player.type === 'pitcher' ? (p.player as Pitcher).role : p.player.pos;

export const posName = (code: string): string =>
  code === 'TWO-WAY' ? 'Two-way'
    : code === 'BENCH' ? 'Bench'
      : POSITION_NAME[code as Position | 'SP' | 'RP'] ?? code;

/** The code a row prints: the position, or the word for a man who is two. */
export const slotCode = (p: Prospect): string => {
  const slot = slotOf(p);
  return slot === 'TWO-WAY' ? 'Two-way' : slot;
};

/** The factor as a pitch tile has room to say it. */
export const FACTOR_SHORT: Record<RecruitingFactor, string> = {
  tradition: 'Tradition',
  coach: 'Coach',
  conference: 'Conference',
  playingTime: 'Playing time',
  winning: 'Winning now',
  development: 'Development',
  facilities: 'Facilities',
  proximity: 'Close to home',
  proPipeline: 'Path to pros',
};

/** Your grade against his want, as the engine weighs a pitch on it. */
export const VERDICT: Record<PitchVerdict, { word: string; tone: 'positive' | 'muted' | 'warning' | 'negative'; icon: IconName }> = {
  strong: { word: 'Strong', tone: 'positive', icon: 'check-circled' },
  fair: { word: 'Fair', tone: 'muted', icon: 'minus-circled' },
  thin: { word: 'Thin', tone: 'warning', icon: 'alert' },
  hollow: { word: 'Backfires', tone: 'negative', icon: 'cross-circled' },
};

export const MAJOR_WORDS: Record<RecruitMajorInput['kind'], string> = {
  hardSell: 'Hard sell',
  visit: 'Program visit',
  sway: 'Sway',
  promise: 'Promise',
  ask: 'Asked to commit',
};

/**
 * How he makes up his mind, in the tag's word and the race card's caption.
 * A steady man has no clock of his own, so his caption is the window's.
 */
export function decides(style: DecisionStyle, week: number, live: boolean): { tag: string; note: string } {
  if (style === 'early') return { tag: 'Early decider', note: 'Decides early · watch the clock' };
  if (style === 'late') return { tag: 'Late decider', note: `Decides late · after week ${LATE_DECIDER_WEEK}` };
  return { tag: 'Steady', note: live ? `Week ${week} of ${RECRUITING_WEEKS}` : 'The window is closed' };
}

/**
 * His interest, split three ways: you, the best of the rest, and everybody
 * else. Shares are of all the interest anybody has banked in him.
 *
 * The leader here is the best *other* program, even when you lead: the tick
 * on a race bar marks the school you are racing, and a tick drawn on your own
 * share would say nothing.
 */
export interface Race {
  /** Anybody at all has a point on him. */
  any: boolean;
  /** Your share, and the best rival's, of all his interest (0–100). */
  you: number;
  rival: number;
  /** The best rival, or null when nobody else is on him. */
  rivalTeam: number | null;
  /** How many programs besides you and the best rival, and their share. */
  others: number;
  othersShare: number;
  /** Raw interest banked: yours, and the best rival's. */
  mine: number;
  best: number;
  /** What this week's plan adds to you, in interest (0 without a plan). */
  gain: number;
  /** Your share once the plan lands, with the others where they are now. */
  projected: number;
}

export function raceOf(p: Prospect, team: number, gain = 0): Race {
  const entries = Object.entries(p.points)
    .map(([t, v]) => ({ t: Number(t), v }))
    .filter((e) => e.v > 0);
  const total = entries.reduce((a, e) => a + e.v, 0);
  const mine = Math.max(0, p.points[team] ?? 0);
  const rivals = entries.filter((e) => e.t !== team).sort((a, b) => b.v - a.v);
  const top = rivals[0];
  const share = (v: number): number => (total > 0 ? Math.round((v / total) * 100) : 0);
  const you = share(mine);
  const rival = top ? share(top.v) : 0;
  const after = total + gain;
  const projected = gain !== 0 && after > 0
    ? Math.round((Math.max(0, mine + gain) / after) * 100)
    : you;
  return {
    any: total > 0,
    you,
    rival,
    rivalTeam: top?.t ?? null,
    others: Math.max(0, rivals.length - 1),
    othersShare: total > 0 ? Math.max(0, 100 - you - rival) : 0,
    mine,
    best: top?.v ?? 0,
    gain,
    projected,
  };
}

/**
 * Where you stand with him: the chase, or how it ended. `label` is the
 * sheet's word, `short` the row chip's.
 */
export interface Standing { tone: Tone; label: string; short: string; icon?: IconName }

export function standing(
  p: Prospect, userTeam: number, schoolOf: (i: number) => string, reachable: boolean,
): Standing {
  if (p.signedBy === userTeam) return { tone: 'positive', label: 'Committed to you', short: 'Committed' };
  if (p.signedBy !== null) return { tone: 'negative', label: `Signed with ${schoolOf(p.signedBy)}`, short: 'Signed elsewhere' };
  if (!reachable) return { tone: 'neutral', icon: 'lock', label: 'Out of reach', short: 'Out of reach' };
  const points = Object.values(p.points).filter((v) => v > 0);
  const best = points.length ? Math.max(...points) : 0;
  const mine = p.points[userTeam] ?? 0;
  if (best <= 0) return { tone: 'neutral', label: 'Nobody on him yet', short: 'Untouched' };
  if (mine <= 0) return { tone: 'neutral', label: 'Others are on him', short: 'Not started' };
  if (mine >= best) return { tone: 'positive', label: 'You lead', short: 'You lead' };
  const behind = (best - mine) / best;
  if (behind < 0.2) return { tone: 'info', label: 'Close behind', short: 'Close behind' };
  if (behind < 0.5) return { tone: 'warning', label: 'Behind', short: 'Behind' };
  return { tone: 'negative', label: 'Far behind', short: 'Far behind' };
}

/**
 * What the staff is doing with him this week, in one line: the ask and its
 * answer, the points on him, or that he is only being kept in touch with.
 *
 * One line in the staff list's slot, which is 145px wide on a 375 phone beside
 * the order badge and the three controls: "Asked to commit · he said yes" ran
 * to 169px there and the ellipsis ate the answer, the only news on the line.
 */
export function staffLine(p: Prospect, team: number, week: number, programStars: number): string {
  const major = p.weekActions?.[team]?.major;
  if (major?.kind === 'ask') return major.success ? 'Asked · he said yes' : 'Asked · he said no';
  const planned = (p.spent[team] ?? 0) + weekActionCost(p, team);
  if (planned <= 0) return 'Not worked this week';
  if ((p.points[team] ?? 0) > 0 && lostCause(p, team, programStars, week)) return 'Keeping in touch';
  return `${planned} ${planned === 1 ? 'pt' : 'pts'} this week`;
}

/** A school's first word, which is unique across the league: "Gulf 44%". */
export const firstWord = (school: string): string => school.split(' ')[0] ?? school;

/** The row's line beside its race bar. */
export function raceText(race: Race, schoolOf: (i: number) => string): string {
  if (race.gain !== 0 && race.projected !== race.you) return `${race.you}% → ${race.projected}%`;
  if (!race.any) return 'No interest yet';
  if (race.mine <= 0 && race.rivalTeam !== null) return `${firstWord(schoolOf(race.rivalTeam))} ${race.rival}%`;
  return `${race.you}%`;
}
