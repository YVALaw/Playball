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
import { healUp, isHurt } from './injury.js';
import { BADGE_IDS, type BadgeId, type BadgeTier } from './badges.js';
import {
  HOME_REGIONS, RECRUITING_FACTORS, commitPointsFor, drawPriorities, reachFloor,
  recruitingPrioritiesOf, starsFor,
  type Prospect, type RecruitClass, type RecruitingFactor, type RecruitingPriorities,
} from './recruiting.js';
import { STATES_BY_REGION } from '../data/schools.js';
import { ageFor } from './players.js';
import { isTwoWay, type Team, type TwoWay } from './types.js';
import { releaseFrom, signFromPortal, type PortalMan } from './portal.js';
import { adoptSpot } from './depthChart.js';

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

// ---------------------------------------------------------------------------
// The rest of the sandbox — September 6 2026, later (05 §61.4).
// ---------------------------------------------------------------------------


// --- Health -----------------------------------------------------------------

/** Off the shelf, whatever put him there. */
export function healPlayer(p: Player): void {
  healUp(p);
  const i = p as Player & { outUntil?: number; why?: string; hurt?: string };
  delete i.outUntil;
  delete i.why;
  delete i.hurt;
}

/** He never rolls for an injury. `hurtsToday` reads it. */
export function setIronMan(p: Player, on: boolean): void {
  const x = p as Player & { ironMan?: boolean };
  if (on) x.ironMan = true; else delete x.ironMan;
}
export const isIronMan = (p: Player): boolean =>
  (p as Player & { ironMan?: boolean }).ironMan === true;
export { isHurt };

// --- Roster moves -----------------------------------------------------------

/**
 * A starter leaving the nine: the bench man at his own spot steps in, failing
 * one any bench man does, adopting the spot. Fielding eight is not a thing
 * that happens in baseball — the hole used to stand, and every game from then
 * on threw on an empty lineup slot, with nothing on any screen able to repair
 * it (05 §62.3). Returns false when there is nobody at all, so the cut or the
 * move can refuse instead.
 */
function fillHole(team: Team, spot: Position): boolean {
  const at = team.bench.find((b) => b.pos === spot) ?? team.bench[0];
  if (!at) return false;
  team.bench = team.bench.filter((b) => b.id !== at.id);
  if (at.pos !== spot) adoptSpot(at, spot);
  team.lineup.push(at);
  return true;
}

/** Whether a starter can leave without the nine going short. */
function canLeave(team: Team, id: PlayerId): boolean {
  const starter = team.lineup.some((h) => h.id === id);
  return !starter || team.bench.length > 0;
}

/**
 * Whether an arm can leave without the rotation going empty. A team with no
 * starting pitcher throws inside the game, and a throw inside a day lost the
 * rest of the day's games in the whole country (05 §62.6). The last starter
 * may go only if the pen has a man to step into the rotation.
 */
function canLeaveArm(team: Team, id: PlayerId): boolean {
  const inRotation = team.rotation.some((a) => a.id === id);
  if (!inRotation) return true;
  return team.rotation.length > 1 || team.bullpen.some((a) => a.id !== id);
}

/** The rotation must never be empty: the first man in the pen steps up. */
function fillRotation(team: Team): void {
  if (team.rotation.length > 0) return;
  const up = team.bullpen.shift();
  if (up) team.rotation.push(up);
}

function place(team: Team, p: Player): void {
  if (p.type === 'pitcher') { team.bullpen.push(p as Pitcher); return; }
  team.bench.push(p as Hitter);
  if (isTwoWay(p)) team.bullpen.push(p as TwoWay);
}

/** Any man to any program, onto the bench or into the pen there. */
export function movePlayer(season: SeasonState, id: PlayerId, toTeam: number): boolean {
  const found = findPlayer(season, id);
  const to = season.teams[toTeam];
  if (!found || !to || found.team.index === toTeam) return false;
  const from = found.team.team;
  if (found.player.type !== 'pitcher' && !canLeave(from, id)) return false;
  if (found.player.type === 'pitcher' && !canLeaveArm(from, id)) return false;
  const wasStarter = from.lineup.some((h) => h.id === id);
  const spot = (found.player as Hitter).pos;
  releaseFrom(from, id);
  if (wasStarter && found.player.type !== 'pitcher') fillHole(from, spot);
  fillRotation(from);
  place(to.team, found.player);
  return true;
}

/** Gone from the world. */
export function cutPlayer(season: SeasonState, id: PlayerId): boolean {
  const found = findPlayer(season, id);
  if (!found) return false;
  const from = found.team.team;
  if (found.player.type !== 'pitcher' && !canLeave(from, id)) return false;
  if (found.player.type === 'pitcher' && !canLeaveArm(from, id)) return false;
  const wasStarter = from.lineup.some((h) => h.id === id);
  const spot = (found.player as Hitter).pos;
  releaseFrom(from, id);
  if (wasStarter && found.player.type !== 'pitcher') fillHole(from, spot);
  fillRotation(from);
  return true;
}

/** Straight off the portal onto your roster, for nothing. */
export function signPortalMan(
  season: SeasonState, available: readonly PortalMan[], userTeam: number, id: PlayerId,
): PortalMan | null {
  const man = available.find((m) => m.player.id === id);
  const rec = season.teams[userTeam];
  if (!man || !rec) return null;
  const from = season.teams[man.from];
  if (from) releaseFrom(from.team, id);
  signFromPortal(rec.team, man);
  return man;
}

// --- The facts around a man ------------------------------------------------

export function setMood(p: Player, mood: number): void {
  (p as Player & { mood?: number }).mood = Math.max(0, Math.min(100, Math.round(mood)));
}
export const moodValue = (p: Player): number => (p as Player & { mood?: number }).mood ?? 62;

export function setRedshirt(p: Player, on: boolean): void {
  const x = p as Player & { redshirt?: boolean };
  if (on) x.redshirt = true; else delete x.redshirt;
}
export const isRedshirt = (p: Player): boolean => (p as Player & { redshirt?: boolean }).redshirt === true;

export function setAge(p: Player, age: number): void {
  p.age = Math.max(17, Math.min(40, Math.round(age)));
}

export { BADGE_IDS };
export type { BadgeId, BadgeTier };

export function grantBadge(p: Player, id: BadgeId, tier: BadgeTier): void {
  p.badges = [...(p.badges ?? []).filter((b) => b.id !== id), { id, tier }];
}
export function revokeBadge(p: Player, id: BadgeId): void {
  const left = (p.badges ?? []).filter((b) => b.id !== id);
  if (left.length > 0) p.badges = left; else delete p.badges;
}

const ARM_RATINGS = ['stuff', 'movement', 'control', 'stamina', 'groundBall', 'holdRunners', 'velocity'] as const;

/**
 * A bat given an arm: the generator's own draw for the pitching half, and a
 * seat in the pen beside his seat in the order. One body, two stations.
 */
export function makeTwoWayOf(record: TeamRecord, p: Player, rng: Rng, quality = 60): boolean {
  if (p.type === 'pitcher' || isTwoWay(p)) return false;
  const arm = makePitcher(rng, Math.max(20, Math.min(99, Math.round(quality))));
  const m = p as unknown as TwoWay;
  m.twoWay = true;
  m.role = 'RP';
  m.homeRole = 'RP';
  m.sidearm = false;
  m.armPlatoon = 0;
  for (const k of ARM_RATINGS) (m as unknown as Record<string, number>)[k] = arm[k];
  if (!record.team.bullpen.some((a) => a.id === p.id)) record.team.bullpen.push(m);
  return true;
}

/** The arm taken back. */
export function unmakeTwoWay(record: TeamRecord, p: Player): boolean {
  if (!isTwoWay(p)) return false;
  record.team.rotation = record.team.rotation.filter((a) => a.id !== p.id);
  record.team.bullpen = record.team.bullpen.filter((a) => a.id !== p.id);
  const m = p as unknown as Record<string, unknown>;
  for (const k of ['twoWay', 'role', 'homeRole', 'sidearm', 'armPlatoon', ...ARM_RATINGS]) delete m[k];
  return true;
}

// --- Recruiting -------------------------------------------------------------

/** A recruit made to order, into this year's class, unsigned and unranked. */
export function authorProspect(
  season: SeasonState, kind: 'hitter' | 'pitcher', quality: number,
  opts: { pos?: Position; role?: PitcherRole; stars?: number } = {},
): Prospect | null {
  const cls = season.recruiting;
  if (!cls) return null;
  const rng = season.rng;
  const q = Math.max(20, Math.min(99, Math.round(quality)));
  const player: Player = kind === 'pitcher'
    ? makePitcher(rng, q, { role: opts.role ?? 'SP', classYear: 'FR' })
    : makeHitter(rng, q, { pos: opts.pos ?? 'SS', classYear: 'FR' });
  player.classYear = 'FR';
  player.age = ageFor(player.id, 'FR');
  const stars = Math.max(1, Math.min(5, Math.round(opts.stars ?? starsFor(player))));
  const home = HOME_REGIONS[Math.floor(rng() * HOME_REGIONS.length)]!;
  const states = STATES_BY_REGION[home];
  const priorities = drawPriorities(stars, rng);
  player.priorities = priorities;
  const prospect: Prospect = {
    id: player.id,
    player,
    stars,
    hometown: home,
    state: states[Math.floor(rng() * states.length)] as string,
    priorities,
    minProgram: reachFloor(stars),
    rank: cls.prospects.length + 1,
    points: {},
    spent: {},
    weekActions: {},
    promiseBy: {},
    signedBy: null,
    committedWeek: null,
  };
  cls.prospects.push(prospect);
  return prospect;
}

export function setRecruitStars(p: Prospect, stars: number): void {
  p.stars = Math.max(1, Math.min(5, Math.round(stars)));
  p.minProgram = reachFloor(p.stars);
}

/** His nine weights rewritten, and normalised to one; what he cares about is the sway's field. */
export function setRecruitWants(p: Prospect, weights: Partial<RecruitingPriorities>): void {
  const next: RecruitingPriorities = { ...recruitingPrioritiesOf(p) };
  for (const f of RECRUITING_FACTORS) {
    const v = weights[f];
    if (typeof v === 'number' && Number.isFinite(v)) next[f] = Math.max(0, v);
  }
  let total = 0;
  for (const f of RECRUITING_FACTORS) total += next[f];
  if (total <= 0) return;
  for (const f of RECRUITING_FACTORS) next[f] = next[f] / total;
  p.recruitingPriorities = next;
}

/** Signed, on the spot, with the points a commitment would have taken. */
export function commitRecruit(cls: RecruitClass, p: Prospect, team: number): void {
  p.signedBy = team;
  p.committedWeek = cls.week;
  p.points[team] = Math.max(p.points[team] ?? 0, commitPointsFor(p.stars));
}

export const RECRUIT_FACTOR_KEYS: readonly RecruitingFactor[] = RECRUITING_FACTORS;

// --- Presets ----------------------------------------------------------------

/** Every program at fifty. */
export function presetParity(season: SeasonState): void {
  for (const t of season.teams) t.prestige = 50;
}

/** Every program's prestige drawn again, from the seed, so a save agrees with itself. */
export function presetChaos(season: SeasonState, seed: number): void {
  for (const t of season.teams) {
    let h = (seed ^ (t.index * 2654435761)) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
    t.prestige = 20 + ((h >>> 0) % 76);
  }
}

/** Everybody on the roster at ninety-nine, ceiling included. */
export function presetSuperteam(record: TeamRecord): void {
  const men: Player[] = [
    ...record.team.lineup, ...record.team.bench, ...record.team.rotation, ...record.team.bullpen,
  ];
  for (const p of men) {
    const rec = p as unknown as Record<string, unknown>;
    for (const k of ratingsOf(p)) if (typeof rec[k] === 'number') rec[k] = 99;
    p.potential = 99;
  }
}
