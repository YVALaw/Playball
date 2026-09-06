// godMode.ts
// The sandbox: what a coach who bought god mode may rewrite, and how.
//
// Stage 17, decided by the reporter on September 6 2026. Not a store player
// but an editor over the world the generator produced: "a sandbox where
// they can do whatever they want" — players, the coach, the staff, a
// program's name and prestige, its conference, the money, the schedule.
// Records are not fenced off; it is god mode. The engine does not defend
// itself against an authored 99 either. The one distinction is the flag on
// the save, set at creation on the How-you-play step and never cleared, and
// every edit here is a plain, deterministic change to the season in front
// of it, so the store's actions stay thin and the rules test without a
// screen.

import type { SeasonState, TeamRecord } from './season.js';
import { buildSchedule, worldFromTeams, seasonComplete } from './season.js';
import type {
  Player, Hitter, Pitcher, Position, PitcherRole, Bats, Hand, ClassYear, PlayerId,
} from './types.js';
import type { Economy, StaffSeat } from './economy.js';
import { makeHitter, makePitcher } from './players.js';
import type { Rng } from './types.js';
import { applyRealignment } from './world.js';

/** The rating scale, and the one clamp every number here goes through. */
export const clampRating = (v: number): number =>
  Math.max(1, Math.min(99, Math.round(Number.isFinite(v) ? v : 1)));

/** The numbers a bat carries, in the order the editor shows them. */
export const HITTER_RATINGS = [
  'contact', 'power', 'eye', 'speed', 'bunt', 'steal', 'blocking', 'range', 'hands', 'arm',
] as const;
/** The numbers an arm carries. */
export const PITCHER_RATINGS = [
  'stuff', 'movement', 'control', 'stamina', 'groundBall', 'holdRunners', 'velocity',
  'range', 'hands', 'arm',
] as const;
export type RatingKey = typeof HITTER_RATINGS[number] | typeof PITCHER_RATINGS[number];

export const RATING_LABEL: Record<RatingKey, string> = {
  contact: 'CONTACT', power: 'POWER', eye: 'EYE', speed: 'SPEED', bunt: 'BUNT', steal: 'STEAL',
  blocking: 'BLOCKING', range: 'RANGE', hands: 'HANDS', arm: 'ARM',
  stuff: 'STUFF', movement: 'MOVEMENT', control: 'CONTROL', stamina: 'STAMINA',
  groundBall: 'GROUND BALL', holdRunners: 'HOLD RUNNERS', velocity: 'VELOCITY',
};

/** The potential that reads S+: the grade play can never reach, only authoring. */
export const S_PLUS_POTENTIAL = 95;

/** Which numbers this man carries: a two-way man carries both sets. */
export function ratingsOf(p: Player): RatingKey[] {
  const rec = p as unknown as Record<string, unknown>;
  const keys: RatingKey[] = [];
  for (const k of p.type === 'pitcher' ? PITCHER_RATINGS : HITTER_RATINGS) keys.push(k);
  if (p.type !== 'pitcher') {
    for (const k of PITCHER_RATINGS) if (typeof rec[k] === 'number' && !keys.includes(k)) keys.push(k);
  }
  return keys;
}

export interface PlayerPatch {
  name?: string;
  classYear?: ClassYear;
  bats?: Bats;
  throws?: Hand;
  /** A bat's new home position. No retraining penalty: it is god mode. */
  pos?: Position;
  /** An arm's job: starter or reliever. */
  role?: PitcherRole;
  /** 1–99. Ninety-five and up is S+. */
  potential?: number;
  ratings?: Partial<Record<RatingKey, number>>;
}

/** Rewrite a man in place. Only what the patch names moves; everything is clamped. */
export function editPlayer(p: Player, patch: PlayerPatch): void {
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 40);
    if (name.length > 0) p.name = name;
  }
  if (patch.classYear) p.classYear = patch.classYear;
  if (patch.bats) p.bats = patch.bats;
  if (patch.throws) p.throws = patch.throws;
  if (patch.pos && p.type !== 'pitcher') {
    const h = p as Hitter;
    h.pos = patch.pos;
    // Home too, or the position memory reads the move as a coach's stretch.
    h.homePos = patch.pos;
  }
  if (patch.role && p.type === 'pitcher') {
    const a = p as Pitcher;
    a.role = patch.role;
    a.homeRole = patch.role;
  }
  if (patch.potential !== undefined) p.potential = clampRating(patch.potential);
  if (patch.ratings) {
    const rec = p as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch.ratings)) {
      if (v === undefined || typeof rec[k] !== 'number') continue;
      rec[k] = clampRating(v);
    }
  }
}

/**
 * A man made to order: the generator's own draw at the quality asked for,
 * ready to be rewritten. Spends the season's generator, so a save that
 * authored a man and a save that did not have moved on by the same draws
 * only if the same man was authored — which is the nature of the thing.
 */
export function authorPlayer(
  rng: Rng, kind: 'hitter' | 'pitcher', quality: number,
  opts: { classYear?: ClassYear; pos?: Position; role?: PitcherRole } = {},
): Player {
  const q = Math.max(20, Math.min(99, Math.round(quality)));
  if (kind === 'hitter') {
    return makeHitter(rng, q, {
      ...(opts.pos ? { pos: opts.pos } : {}),
      ...(opts.classYear ? { classYear: opts.classYear } : {}),
    });
  }
  return makePitcher(rng, q, {
    ...(opts.role ? { role: opts.role } : {}),
    ...(opts.classYear ? { classYear: opts.classYear } : {}),
  });
}

/** Onto the bench or into the pen; the depth chart sorts him from there. */
export function addToTeam(record: TeamRecord, p: Player): void {
  if (p.type === 'pitcher') record.team.bullpen.push(p as Pitcher);
  else record.team.bench.push(p as Hitter);
}

/** Every man in the world, by id. */
export function findPlayer(
  season: SeasonState, id: PlayerId,
): { player: Player; team: TeamRecord } | null {
  for (const t of season.teams) {
    for (const p of [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen]) {
      if (p.id === id) return { player: p, team: t };
    }
  }
  return null;
}

export function setPrestige(record: TeamRecord, prestige: number): void {
  record.prestige = Math.max(1, Math.min(100, Math.round(prestige)));
}

/**
 * A new name for a program. The abbreviation stays: it is the key the
 * standings, the box scores, the playbooks and the crest all hang from.
 */
export function renameProgram(record: TeamRecord, school: string, nickname: string): void {
  const s = school.trim().slice(0, 40);
  const n = nickname.trim().slice(0, 30);
  record.def = {
    ...record.def,
    school: s.length > 0 ? s : record.def.school,
    nickname: n.length > 0 ? n : record.def.nickname,
  };
  if (s.length > 0) record.team.name = s;
}

/**
 * When a conference can change hands. Before the first pitch the schedule
 * is rebuilt on the spot; once the year is over, the next spring is built
 * from the records anyway; in between, the games already played belong to
 * the leagues they were played in.
 */
export type ConferenceWindow = 'now' | 'next-spring' | 'closed';
export function conferenceWindow(season: SeasonState): ConferenceWindow {
  if (season.results.length === 0) return 'now';
  if (seasonComplete(season)) return 'next-spring';
  return 'closed';
}

/**
 * Two programs trade leagues. A trade rather than a move, because the
 * scheduler wants every league the size it was — the same one-for-one the
 * world's own realignment makes.
 */
export function swapConferences(season: SeasonState, a: number, b: number): boolean {
  const ta = season.teams[a];
  const tb = season.teams[b];
  if (!ta || !tb || a === b || ta.conference === tb.conference) return false;
  const when = conferenceWindow(season);
  if (when === 'closed') return false;
  applyRealignment(season.teams, { up: a, upTo: tb.conference, down: b, downTo: ta.conference });
  if (when === 'now') {
    season.schedule = buildSchedule(season.config, worldFromTeams(season.teams), season.scheduleRotation);
  }
  return true;
}

/** A different draw of the same fixtures. Only before the first pitch. */
export function reshuffleSchedule(season: SeasonState): boolean {
  if (season.results.length > 0) return false;
  season.scheduleRotation = (Number.isFinite(season.scheduleRotation) ? season.scheduleRotation : 0) + 1;
  season.schedule = buildSchedule(season.config, worldFromTeams(season.teams), season.scheduleRotation);
  return true;
}

/** Money on top of the annual budget. `remaining` reads it. */
export function grantMoney(eco: Economy, amount: number): void {
  eco.grant = Math.max(0, (eco.grant ?? 0) + Math.round(amount));
}

/** Recruiting points on top of every week's board budget. */
export function grantRecruiting(eco: Economy, perWeek: number): void {
  eco.recruitingGrant = Math.max(0, (eco.recruitingGrant ?? 0) + Math.round(perWeek));
}

export function setStaff(
  eco: Economy, seat: StaffSeat, patch: { rating?: number; name?: string },
): boolean {
  const man = eco.staff[seat];
  if (!man) return false;
  const name = patch.name?.trim().slice(0, 40);
  eco.staff[seat] = {
    ...man,
    ...(patch.rating !== undefined ? { rating: clampRating(patch.rating) } : {}),
    ...(name ? { name } : {}),
  };
  return true;
}
