// staffRecruiting.ts
// The coach decides who; his staff works them.
//
// Asked for 2026-09-28: a coach who hands weekly recruiting to his staff should
// still choose *who* the staff chases. He stars up to eight recruits, in order,
// and each week the coordinator works that list first — the effort, the
// pitches, the big moves, and asking for the commitment once the lead is safe.
// A starred man who signs elsewhere is replaced with a similar one (unless the
// coach says not to). Nobody else: since 2026-09-30 an open slot stays open
// until the coach fills it, and the staff chases no man he did not choose.
//
// Three rules hold the rest of the game still:
//
// **The staff's week is on the board.** It is planned at the week's open and
// written into the same ledger the coach's own week uses (`spent`,
// `weekActions`), so the points band shows what the staff is spending and the
// week's close banks exactly that, once. It used to be planned at the close and
// never written anywhere, which left the band empty all season.
//
// **It never draws on the world's generator.** Every plan runs on
// `staffWeekRng`, derived from the world, the year, the week and the program,
// so a replan with the same inputs is the same plan, a reload cannot re-roll
// it, and the ninety five draw exactly what they would in a hands-on career.
//
// **The handicap stays in the size of the week.** The budget is
// `delegateEffort` of the coach's own, as it always was (recruitingPlan.ts);
// nothing here makes the staff read a man worse than the coach would.

import {
  askBlocked, askForCommitment, byRank, decisionStyle,
  lostCause, planAiRecruitActions, pursuable, stableHash, totalWeekSpend, weeklyBudget, winScore,
  ASK_COST, COMMIT_MARGIN, MAX_PER_RECRUIT, RECRUITING_WEEKS, SCHOLARSHIPS,
  type Pitch, type Prospect, type RecruitClass,
} from './recruiting.js';
import { makeRng } from './rng.js';
import { isTwoWay, type Pitcher, type PlayerId, type Rng } from './types.js';

/** How many recruits a coach can star for his staff: one per scholarship. */
export const STAFF_LIST_MAX = SCHOLARSHIPS;

/**
 * The share of the staff's raw week each starred slot gets, first to eighth.
 * Sums to one, and leans to the front, so the order the coach chose is the
 * order the points go in.
 *
 * Leans, rather than piles. The first cut ran 0.22 down to 0.04, and on a
 * small program's eight-point week that left the seventh and eighth men with
 * nothing at all — starred and "Not worked this week" — while the top two took
 * a quarter each. Measured over fourteen worlds with a one-star board working
 * the suggested list against the same staff picking alone, the steep table
 * signed 73 to 72 and this one 70 to 72: no difference a class can feel, and
 * this one works every man the coach starred. The steep one also came up
 * short in world 909 (two signed against peers averaging 5.4), which the
 * test that holds a list to its peers catches.
 */
export const STAFF_ORDER_SHARE: readonly number[] = [0.16, 0.15, 0.14, 0.13, 0.12, 0.11, 0.10, 0.09];

/**
 * The share of the week spent as raw effort; the rest pays for pitches and
 * moves. The same reserve `aiTargets` keeps for the ninety five.
 */
export const STAFF_RAW_SHARE = 0.82;

/**
 * The staff's generator for one week of one program's board.
 *
 * Never `season.rng`: a draw taken from the world's stream by the coached
 * program's staff would move every rival's draw after it, so a delegated
 * career and a hands-on one would run different countries. Derived instead,
 * so a replan of the same week is the same plan and a reload cannot re-roll it.
 */
export function staffWeekRng(seed: number, year: number, week: number, team: number): Rng {
  return makeRng(stableHash(`${seed}:${year}:${week}:${team}:staff`) || 1);
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

/** Every slot a man can fill; a two-way man answers to both of his. */
const slotsOf = (p: Prospect): string[] =>
  isTwoWay(p.player) ? [p.player.pos, p.player.role]
    : p.player.type === 'pitcher' ? [(p.player as Pitcher).role]
      : [p.player.pos];

/** The group a slot belongs to, for a replacement when nobody plays his exact spot. DH is an infield bat. */
const GROUP: Record<string, string> = {
  C: 'C', '1B': 'IF', '2B': 'IF', '3B': 'IF', SS: 'IF', DH: 'IF',
  LF: 'OF', CF: 'OF', RF: 'OF', SP: 'P', RP: 'P',
};

/** Whether he fills a need at this position. `BENCH` is any bat. */
export function fillsNeed(p: Prospect, pos: string): boolean {
  if (pos === 'BENCH') return p.player.type === 'hitter';
  return slotsOf(p).includes(pos);
}

/** The two share a slot. */
export function samePosition(a: Prospect, b: Prospect): boolean {
  const theirs = slotsOf(b);
  return slotsOf(a).some((s) => theirs.includes(s));
}

/** The two share a group: catcher, infield, outfield or the mound. */
export function sameGroup(a: Prospect, b: Prospect): boolean {
  const theirs = slotsOf(b).map((s) => GROUP[s] ?? s);
  return slotsOf(a).some((s) => theirs.includes(GROUP[s] ?? s));
}

// ---------------------------------------------------------------------------
// The week
// ---------------------------------------------------------------------------

/**
 * Take the staff's week off the board, keeping the moves already answered.
 *
 * A sway and an ask are rolled the moment they are made and cannot be taken
 * back (the store refuses the coach the same), so they stay whole and keep
 * their cost. A promise made this week is withdrawable, as `recruitMajor`
 * allows a coach; anything else simply goes.
 */
export function clearStaffWeek(prospects: readonly Prospect[], team: number): void {
  for (const p of prospects) {
    delete p.spent[team];
    const action = p.weekActions?.[team];
    if (!action) continue;
    const kind = action.major?.kind;
    if (kind === 'sway' || kind === 'ask') continue;
    if (kind === 'promise') delete p.promiseBy?.[team];
    delete p.weekActions![team];
  }
}

/**
 * Whether the staff should ask him to commit this week.
 *
 * "Safe" is the lead `closeWeek` itself calls settled, so the staff only asks
 * where it would be a waste to wait: never where the close signs him anyway.
 */
export function staffAskDue(p: Prospect, team: number, week: number, classFull: boolean): boolean {
  // The last close signs the leader anyway.
  if (week >= RECRUITING_WEEKS) return false;
  // A relationship, his price banked, the lead, the cooldown, room in the class.
  if (askBlocked(p, team, week, classFull) !== null) return false;
  // Settles at once at this close.
  if (decisionStyle(p) === 'early') return false;
  // His readiness is already certain.
  if (p.settledSince !== undefined && week - p.settledSince >= 2) return false;
  const mine = p.points[team] ?? 0;
  const second = Math.max(0, ...Object.entries(p.points)
    .filter(([t]) => Number(t) !== team).map(([, v]) => v));
  return mine > 0 && (mine - second) / mine > COMMIT_MARGIN;
}

/** What the staff is working with this week. */
export interface StaffWeek {
  team: number;
  /** The program's own pitch, pipelines and all. */
  pitch: Pitch;
  /** The coach's list, in order. */
  list: readonly PlayerId[];
  week: number;
  year: number;
  /** `delegateEffort`: the share of the coach's week the staff gets through. */
  effort: number;
  coachPrestige: number;
  recruitingSkill: number;
  /** Men already committed to this program. */
  signed: number;
  /** Unused since the staff stopped building its own board (2026-09-30). */
  need?: number;
  /** Unused since the staff stopped building its own board (2026-09-30). */
  league?: readonly number[];
  rng: Rng;
}

export interface StaffWeekResult {
  /** Raw effort, in the order the staff works the men. */
  spends: { prospect: Prospect; actions: number }[];
  /** Asks made this plan, and the answers. */
  asked: { id: PlayerId; success: boolean }[];
}

/**
 * Plan the staff's week and write it on the board.
 *
 * The only writer of the staff's week. It clears first and then assigns, and
 * never adds: points move only at the close, from what this leaves in the
 * ledger, so a plan made twice banks once.
 */
export function planStaffWeek(recruits: RecruitClass, w: StaffWeek): StaffWeekResult {
  const { team, pitch, week } = w;
  const prospects = recruits.prospects;
  clearStaffWeek(prospects, team);
  const out: StaffWeekResult = { spends: [], asked: [] };
  if (week < 1 || week > RECRUITING_WEEKS || w.signed >= SCHOLARSHIPS) return out;

  // The budget: the same week the delegated staff has always had.
  const full = weeklyBudget(pitch.stars);
  const cap = Math.max(1, Math.round(full * w.effort));
  const raw = Math.max(1, Math.floor(full * STAFF_RAW_SHARE * w.effort));
  let kept = totalWeekSpend(prospects, team);

  const byId = new Map(prospects.map((p) => [p.id as string, p]));
  const isOpen = (p: Prospect): boolean => p.signedBy === null && pursuable(p, pitch);

  // Asks. At most a week's cap of them, less any already answered.
  const keptAsks = prospects.filter((p) => p.weekActions?.[team]?.major?.kind === 'ask');
  const yesIds = new Set<string>(keptAsks
    .filter((p) => { const m = p.weekActions![team]!.major; return m?.kind === 'ask' && m.success; })
    .map((p) => p.id));
  const askCap = Math.max(1, Math.floor(cap / 12)) - keptAsks.length;
  const listedOpenIds = w.list
    .map((id) => byId.get(id))
    .filter((p): p is Prospect => !!p && isOpen(p))
    .map((p) => p.id as string);
  // Only the coach's men are asked (2026-09-30): an unstarred man the staff
  // happened to lead is not the staff's to sign.
  const candidates = listedOpenIds.map((id) => byId.get(id)!);
  let asks = 0;
  for (const p of candidates) {
    if (asks >= askCap || kept + ASK_COST > cap) break;
    if (p.weekActions?.[team]) continue;
    if (!staffAskDue(p, team, week, w.signed + yesIds.size >= SCHOLARSHIPS)) continue;
    const answer = askForCommitment(p, team, pitch, w.year, week);
    (p.askedBy ??= {})[team] = { week, ...answer };
    (p.weekActions ??= {})[team] = { major: { kind: 'ask', ...answer } };
    kept += ASK_COST;
    asks += 1;
    out.asked.push({ id: p.id, success: answer.success });
    if (answer.success) yesIds.add(p.id);
  }

  // The raw pool, after whatever the asks and the kept moves cost.
  const rawLeft = Math.max(0, Math.min(raw, cap - kept));
  let left = rawLeft;
  const alloc = new Map<string, number>();
  const order: Prospect[] = [];
  const give = (p: Prospect, a: number): void => {
    if (!alloc.has(p.id)) order.push(p);
    alloc.set(p.id, (alloc.get(p.id) ?? 0) + a);
    left -= a;
  };

  // The starred men, in the coach's order. A man well lost (interest banked
  // and somebody else clear by the cut every board lets go at) is kept in
  // touch on a single point, and his share goes to the next man down.
  const listedOpen = listedOpenIds.filter((id) => !yesIds.has(id)).map((id) => byId.get(id)!);
  const givenUp = (p: Prospect): boolean =>
    (p.points[team] ?? 0) > 0 && lostCause(p, team, pitch.stars, week);
  const worked: Prospect[] = [];
  const shareOf = new Map<string, number>();
  let carry = 0;
  listedOpen.forEach((p, i) => {
    const share = STAFF_ORDER_SHARE[i] ?? 0;
    if (givenUp(p)) {
      carry += share;
      if (left >= 1) give(p, 1);
      return;
    }
    worked.push(p);
    shareOf.set(p.id, share);
    if (left > 0) {
      const a = Math.max(1, Math.min(MAX_PER_RECRUIT, Math.round(rawLeft * (share + carry)), left));
      carry = 0;
      give(p, a);
    }
  });

  /*
    Only the coach's men (2026-09-30: "the plan was for the player to create
    its own list and if the recruiting coach was not able to make them commit
    to us then look for a similar player"). An open slot is the coach's to
    fill, not the staff's: whatever the list's shares leave goes back to the
    starred men by those same shares, and an empty list spends nothing. By
    share, not in order: a short list's leftover all went to its first man,
    7 points to 1 on a two-man list in the browser.
  */
  const leftover = left;
  const weight = worked.reduce((a, p) => a + shareOf.get(p.id)!, 0);
  if (weight > 0) {
    for (const p of worked) {
      const add = Math.min(MAX_PER_RECRUIT - (alloc.get(p.id) ?? 0), left,
        Math.round(leftover * shareOf.get(p.id)! / weight));
      if (add > 0) give(p, add);
    }
  }
  // What rounding and the one-man cap leave, in order.
  for (const p of worked) {
    if (left <= 0) break;
    const add = Math.min(MAX_PER_RECRUIT - (alloc.get(p.id) ?? 0), left);
    if (add > 0) give(p, add);
  }

  for (const p of order) {
    const a = alloc.get(p.id) ?? 0;
    if (a > 0) {
      p.spent[team] = a;
      out.spends.push({ prospect: p, actions: a });
    }
  }

  // Pitches and moves, starred men first. A man already asked, or holding a
  // kept sway, has his week's move.
  const workable = out.spends.filter((s) => !s.prospect.weekActions?.[team]);
  const workableRaw = workable.reduce((a, s) => a + s.actions, 0);
  const actionCap = cap - (totalWeekSpend(prospects, team) - workableRaw);
  planAiRecruitActions(team, pitch, workable, actionCap, week, w.coachPrestige, w.recruitingSkill, w.rng);
  return out;
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

/**
 * Who takes a lost man's slot: the most winnable open man who plays his spot
 * at his star, then a star below, then a star above; then the same three in
 * his group; then further down the stars, his spot before his group. And if
 * every one of those is a lost cause by the rivals' cut, the closest race at
 * his spot, then in his group. Nobody only when nobody open plays there.
 *
 * The last steps came 2026-09-29. By the fourth week a small program is
 * "lost" on nearly the whole class by `lostCause` (69 of 70 open men at one
 * spot, measured), which is right for a board choosing where to spend and
 * wrong for a coach who asked for a replacement: his slot stood empty.
 */
export function staffReplacement(
  lost: Prospect, prospects: readonly Prospect[], team: number, pitch: Pitch, week: number,
  exclude: ReadonlySet<string>,
  /**
   * A man still in play, merely being lost: only a stand-in within a star of
   * him will do, winnable or the closest race at that level, or the staff
   * keeps working him. Trading a five-star race for a one-star certainty took
   * a delegated five-star staff's class from 3.6 stars a man to 2.5.
   */
  nearOnly = false,
): Prospect | null {
  const pool = prospects.filter((c) =>
    c.signedBy === null && !exclude.has(c.id) && pursuable(c, pitch)
    && !lostCause(c, team, pitch.stars, week));
  const tiers: ((c: Prospect) => boolean)[] = [];
  for (const same of [samePosition, sameGroup]) {
    for (const d of [0, -1, 1]) tiers.push((c) => same(c, lost) && c.stars === lost.stars + d);
  }
  if (!nearOnly) {
    for (const d of [-2, -3, -4]) {
      for (const same of [samePosition, sameGroup]) tiers.push((c) => same(c, lost) && c.stars === lost.stars + d);
    }
  }
  for (const tier of tiers) {
    const hits = pool.filter(tier);
    if (hits.length === 0) continue;
    const score = new Map(hits.map((c) => [c.id as string, winScore(c, team, pitch)]));
    return hits.sort((a, b) => (score.get(b.id)! - score.get(a.id)!) || byRank(a, b))[0]!;
  }
  // Nothing the rivals' cut leaves: the closest race still open at his spot,
  // then in his group, within a star of him before any star. Closest by the
  // points the staff is short of the leader, not `winScore`, which reads every
  // man a rival has started on and this staff has not as worth nothing: once
  // the staff worked only the coach's list (2026-09-30) that was the whole
  // class by week 7, and his slot stood empty.
  const open = prospects.filter((c) => c.signedBy === null && !exclude.has(c.id) && pursuable(c, pitch));
  const short = (c: Prospect): number =>
    Math.max(0, ...Object.values(c.points)) - (c.points[team] ?? 0);
  for (const same of [samePosition, sameGroup]) {
    const hits = open.filter((c) => same(c, lost));
    const near = hits.filter((c) => Math.abs(c.stars - lost.stars) <= 1);
    // A man still in play is only swapped for a race at his own level.
    const best = (near.length > 0 || nearOnly ? near : hits)
      .sort((a, b) => short(a) - short(b) || byRank(a, b))[0];
    if (best) return best;
  }
  return null;
}

/**
 * Keep the list honest: drop men who are gone or committed here, and put a
 * similar man in the slot of one who signed elsewhere (when `replace`).
 *
 * The list is assigned a new array whenever it changes, never edited in place,
 * so a screen holding the old one sees the change.
 */
/** The highest program tier whose staff swaps a man it is clearly losing. */
const LOSING_SWAP_MAX_STARS = 2;

export function tendStaffList(
  recruits: RecruitClass, team: number, pitch: Pitch, replace: boolean,
): { replaced: { lost: PlayerId; by: PlayerId }[]; dropped: PlayerId[] } {
  const list = recruits.staffList ?? [];
  const byId = new Map(recruits.prospects.map((p) => [p.id as string, p]));
  const exclude = new Set<string>(list);
  const standIns: Record<string, PlayerId> = { ...(recruits.staffStandIns ?? {}) };
  const next: PlayerId[] = [];
  const replaced: { lost: PlayerId; by: PlayerId }[] = [];
  const dropped: PlayerId[] = [];
  for (const id of list) {
    const p = byId.get(id);
    if (!p || p.signedBy === team || next.length >= STAFF_LIST_MAX || next.includes(id)) {
      dropped.push(id);
      continue;
    }
    /*
      Lost: signed somewhere else, or clearly being lost (interest banked and
      somebody well clear by the cut every board lets go at). The second used
      to hold its slot on a single point until he signed elsewhere, often too
      late in the window to find anybody; with full programs off the board
      the bottom of the class is a real race, and a slot held for a lost man
      was a scholarship gone (audit 17, H6 follow-up).
    */
    // Only at the bottom of the country (two stars and under). A top staff
    // that swapped a lost five-star for the next contested race churned
    // through them and ended on last-week leftovers: measured, a five-star
    // class fell from 3.6 stars a man to 2.9 with the rule and held without it.
    const losing = p.signedBy !== null
      || (replace && pitch.stars <= LOSING_SWAP_MAX_STARS
        && (p.points[team] ?? 0) > 0 && lostCause(p, team, pitch.stars, recruits.week));
    if (losing) {
      const by = replace
        ? staffReplacement(p, recruits.prospects, team, pitch, recruits.week, exclude, p.signedBy === null)
        : null;
      // A man still in play with no stand-in near his level stays on the list.
      if (!by && p.signedBy === null) { next.push(id); continue; }
      if (by) {
        next.push(by.id);
        exclude.add(by.id);
        standIns[by.id] = id;
        replaced.push({ lost: id, by: by.id });
      } else {
        dropped.push(id);
      }
      continue;
    }
    next.push(id);
  }
  for (const key of Object.keys(standIns)) {
    if (!next.includes(key as PlayerId)) delete standIns[key];
  }
  const changed = next.length !== list.length || next.some((id, i) => id !== list[i]);
  if (changed) recruits.staffList = next;
  const keys = Object.keys(standIns);
  const before = recruits.staffStandIns ?? {};
  const sameStandIns = keys.length === Object.keys(before).length && keys.every((k) => before[k] === standIns[k]);
  if (keys.length === 0) delete recruits.staffStandIns;
  else if (!sameStandIns) recruits.staffStandIns = standIns;
  return { replaced, dropped };
}

/**
 * The star bands a suggested list is drawn from, by the program's own stars:
 * the shape the ninety five point their boards at (`aiTargets`' plan), so a
 * five-star program is pointed at five and four stars, not at whoever nobody
 * else wants.
 */
export function suggestionBands(tier: number): { stars: number; share: number }[] {
  const bands = tier >= 5 ? [
    { stars: 5, share: 0.50 }, { stars: 4, share: 0.38 }, { stars: 3, share: 0.12 },
  ] : tier === 4 ? [
    { stars: 5, share: 0.35 }, { stars: 4, share: 0.48 }, { stars: 3, share: 0.17 },
  ] : [
    { stars: tier + 2, share: 0.08 }, { stars: tier + 1, share: 0.28 }, { stars: tier, share: 0.38 },
    { stars: tier - 1, share: 0.20 }, { stars: tier - 2, share: 0.10 },
  ];
  return bands.filter((b) => b.stars >= 1 && b.stars <= 5);
}

/** Whole slots per band out of `size`, by the largest remainder, highest band first on a tie. */
function bandQuotas(bands: readonly { stars: number; share: number }[], size: number): Map<number, number> {
  const total = bands.reduce((a, b) => a + b.share, 0) || 1;
  const raw = bands.map((b) => ({ stars: b.stars, exact: (b.share / total) * size }));
  const out = new Map(raw.map((r) => [r.stars, Math.floor(r.exact)]));
  let left = size - [...out.values()].reduce((a, b) => a + b, 0);
  for (const r of [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1) || b.stars - a.stars)) {
    if (left <= 0) break;
    out.set(r.stars, (out.get(r.stars) ?? 0) + 1);
    left -= 1;
  }
  return out;
}

/**
 * The list the staff would star.
 *
 * Drawn from the program's own star bands (`suggestionBands`), in the shares
 * the rivals use: every need first, each with the most winnable man in a band
 * that still has room, then each band filled with its most winnable men, then
 * any slot still open from anyone in reach. Returned best band first, most
 * winnable first within it — the order the staff works them.
 *
 * Reported 2026-09-29 of a five-star program: "the suggested ones are all 2
 * star". Ranked on winnability alone, a list slid to the men nobody else was
 * on, and at the top of the country that is the bottom of the class.
 */
export function suggestStaffList(
  prospects: readonly Prospect[], team: number, pitch: Pitch,
  needs: readonly { pos: string; count: number }[], week: number, size = STAFF_LIST_MAX,
): PlayerId[] {
  // Lost only once this board has something in him, as `givenUp` reads it. A
  // delegated board starts with nothing anywhere, so applying the cut to every
  // man somebody else had touched left it the uncontested one- and two-stars,
  // and the program collapsed (audit 17, C1).
  const pool = prospects.filter((p) =>
    p.signedBy === null && pursuable(p, pitch)
    && !((p.points[team] ?? 0) > 0 && lostCause(p, team, pitch.stars, week)));
  const score = new Map(pool.map((p) => [p.id as string, winScore(p, team, pitch)]));
  const byScore = (a: Prospect, b: Prospect): number =>
    (score.get(b.id)! - score.get(a.id)!) || byRank(a, b);
  const ranked = [...pool].sort(byScore);
  const bands = suggestionBands(pitch.stars);
  const quota = bandQuotas(bands, size);
  const inBands = new Set(bands.map((b) => b.stars));
  const picked: Prospect[] = [];
  const taken = new Set<string>();
  const take = (p: Prospect): void => {
    picked.push(p);
    taken.add(p.id);
    if (quota.has(p.stars)) quota.set(p.stars, Math.max(0, quota.get(p.stars)! - 1));
  };
  const room = (p: Prospect): boolean => (quota.get(p.stars) ?? 0) > 0;
  // Needs, from the bands with room, the higher band first.
  for (const need of needs) {
    for (let k = 0; k < need.count && picked.length < size; k++) {
      const p = [...ranked]
        .filter((c) => !taken.has(c.id) && room(c) && fillsNeed(c, need.pos))
        .sort((a, b) => b.stars - a.stars || byScore(a, b))[0];
      if (p) take(p);
    }
  }
  // Each band's own share.
  for (const band of bands) {
    for (const p of ranked) {
      if (picked.length >= size || (quota.get(band.stars) ?? 0) <= 0) break;
      if (!taken.has(p.id) && p.stars === band.stars) take(p);
    }
  }
  // A band that ran dry lends its slots to the others in the plan, then to anyone.
  for (const inPlan of [true, false]) {
    for (const p of ranked) {
      if (picked.length >= size) break;
      if (!taken.has(p.id) && inBands.has(p.stars) === inPlan) take(p);
    }
  }
  return picked
    .sort((a, b) => b.stars - a.stars || byScore(a, b))
    .map((p) => p.id);
}
