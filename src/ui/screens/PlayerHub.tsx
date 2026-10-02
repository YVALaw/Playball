// PlayerHub.tsx
// The top of a player's card: who he is and his two numbers, four facts at a
// glance, what you owe him, and a door to each part of him one level deeper.
//
// From the UI clarity review (design/UI Clarity Review/Roster and Player.dc.html,
// variant "A · Glance + hub", 2026-09-25). The old card opened on an Overview
// tab that held all of this plus his season and his badges, with Ratings,
// Stats and Career on tabs beside it. The review keeps the top short and puts
// everything else behind five rows, each saying what is inside before it is
// opened. The pages behind the rows live in Player.tsx, as the tabs did.
//
// The words for his availability, his draft outlook and his mood are made
// here once and read by the roster too, so a row's chip and the card's tile
// never say two different things about the same man.

import type { ReactNode } from 'react';
import { useDynasty, type Phase } from '../../state/store.js';
import { BADGES, badgeCap, badgesOf } from '../../engine/badges.js';
import { potentialGrade } from '../../engine/scouting.js';
import { draftContextOf, draftEligible, draftStock } from '../../engine/draft.js';
import { draftChance } from '../../engine/progression.js';
import {
  armShare, expectationOf, explicitRecruitPromiseBroken, flightRisk, isArm, mood, promiseOf,
  promiseSpent, recruitPromiseProgress, squadRanks, TWO_WAY_BATTING_GAMES, TWO_WAY_PITCHING_GAMES,
} from '../../engine/morale.js';
import { STAR_LINE, type Portable } from '../../engine/portal.js';
import { available } from '../../engine/depthChart.js';
import { daysLeft, isHurt } from '../../engine/injury.js';
import { overallOf } from '../../engine/ratings.js';
import { secondaryPositions } from '../../engine/positions.js';
import { captainOf } from '../../engine/captains.js';
import { leagueName } from '../../engine/leagueNames.js';
import { seasonAwards } from '../../engine/postseason.js';
import {
  battingAverage, era, injuryClock, liveCareerYear, seasonComplete,
} from '../../engine/season.js';
import type { CareerYear, SeasonState } from '../../engine/season.js';
import { isTwoWay } from '../../engine/types.js';
import type {
  ClassYear, Hitter, Pitcher, PlayerId, Position, Player as AnyPlayer,
} from '../../engine/types.js';
import { pct } from '../format.js';
import {
  Face, Icon, List, ListRow, StatusBadge, cx, type IconName, type Tone,
} from '../components/ui/index.js';
import { CLASS_NAME, POSITION_NAME, capsWords, plural, sentence } from '../words.js';
import { BadgeEmblem } from '../BadgeEmblem.js';
import { Crest } from '../Crest.js';

/** The record for one program, as the season carries it. */
export type Owner = SeasonState['teams'][number];

/** The five places one level deeper into his card. */
export type Section = 'ratings' | 'season' | 'badges' | 'positions' | 'career';

/**
 * How a fact reads: fine, worth a look, a problem, or just a fact. One word
 * for the tile's tint, the tag's colour and the roster chip's colour.
 */
export type Tint = 'ok' | 'warn' | 'bad' | 'none';

export const TINT_TONE: Record<Tint, Tone> = {
  ok: 'positive', warn: 'warning', bad: 'negative', none: 'neutral',
};

export const posName = (pos: string): string => POSITION_NAME[pos as Position] ?? pos;
export const classWord = (cy: string): string => CLASS_NAME[cy as ClassYear] ?? cy;

/** "Bats right, throws right": the review's wording of the hands tag. */
function handsLine(bats: string, throws: string): string {
  const b = bats === 'S' ? 'Bats both ways' : bats === 'L' ? 'Bats left' : 'Bats right';
  return `${b}, ${throws === 'L' ? 'throws left' : 'throws right'}`;
}

/** "a", "a and b", "a, b and c". */
function andList(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

// ---------------------------------------------------------------------------
// The facts, in words
// ---------------------------------------------------------------------------

export interface Availability {
  tint: Tint;
  /** The tile's word: Ready, Injured, Academic hold, Resting, Redshirt. */
  value: string;
  /** The tile's line under the word. */
  note: string;
  /** The header's tag: "Available", "Injured · 6 days". */
  tag: string;
  /** The roster row's chip. Nothing for a man who is fit and ready. */
  chip: string | null;
}

/**
 * How long he is out, as a coach says it: days, weeks once there are four of
 * them, or nothing when it is the season. The engine's `prognosis` keeps
 * wider bands; the review asked for the count itself ("Out 6 days"), the one
 * number a lineup is planned around, and past a month the days stop helping.
 */
function outSpan(left: number): string | null {
  if (left >= 150) return null;
  if (left >= 28) return plural(Math.round(left / 7), 'week');
  return plural(Math.max(1, left), 'day');
}

/** Whether he can play, and if not, why and for how long. */
export function availabilityOf(p: AnyPlayer, day: number, winter: boolean): Availability {
  const u = p as AnyPlayer & { redshirt?: boolean; outUntil?: number; why?: string; hurt?: string };
  if (u.redshirt) {
    return { tint: 'none', value: 'Redshirt', note: 'Sits out this season', tag: 'Redshirt', chip: 'Redshirt' };
  }
  if (available(p, day)) {
    return {
      tint: 'ok', value: 'Ready', note: winter ? 'Nothing keeping him out' : 'Can play tonight',
      tag: 'Available', chip: null,
    };
  }
  if (isHurt(p, day)) {
    const left = daysLeft(p, day);
    const span = outSpan(left);
    const back = span === null ? 'out for the season' : left <= 1 ? 'back tomorrow' : `back in ${span}`;
    // "a tight hamstring", as the trainer wrote it; the tile says "Tight hamstring".
    const what = u.hurt ? sentence(u.hurt.replace(/^(a|an|the)\s+/i, '')) : null;
    return {
      tint: 'bad',
      value: 'Injured',
      note: what ? `${what} · ${back}` : sentence(back),
      tag: span === null ? 'Injured · for the season' : `Injured · ${span}`,
      chip: span === null ? 'Out for the season' : `Out ${span}`,
    };
  }
  // Not hurt and not free: an academic hold, or a rest the coach gave him.
  const back = Math.max(1, (u.outUntil ?? day + 1) - day);
  if (u.why === 'academic') {
    return {
      tint: 'warn', value: 'Academic hold',
      note: back > 1 ? `Ineligible for ${back} more days` : 'Ineligible today',
      tag: `Academic hold · ${plural(back, 'day')}`, chip: 'Academic hold',
    };
  }
  return {
    tint: 'none', value: 'Resting', note: back > 1 ? `Back in ${back} days` : 'Back tomorrow',
    tag: `Resting · ${plural(back, 'day')}`, chip: 'Resting',
  };
}

export interface DraftOutlook {
  tint: Tint;
  value: string;
  note: string;
  /** Likely or could leave: the roster's Draft risk flag. */
  risk: boolean;
}

/** The offseason's steps that come after this June's draft has been held (`PHASES`). */
const AFTER_THE_DRAFT: ReadonlySet<Phase> = new Set<Phase>(['portal', 'recruiting', 'signing']);

/**
 * Whether June's draft can take him. The Draft screen's rule, word for word:
 * eligibility is read against the June ahead, a year older than today, and
 * the odds are `draftChance` on his `draftStock`, his rating moved by his
 * season so far and a two-way man's better half (Draft.tsx, DraftOdds). Once
 * the winter is past its draft, a man still here is staying.
 */
export function draftOutlook(p: AnyPlayer, phase: Phase, season: SeasonState | null): DraftOutlook {
  if (p.classYear === 'SR') {
    return { tint: 'none', value: 'Graduating', note: 'His final college season', risk: false };
  }
  if (AFTER_THE_DRAFT.has(phase)) {
    return { tint: 'none', value: 'Staying', note: 'This June’s draft is done', risk: false };
  }
  // The draft step itself: a man the clubs took is past odds.
  const called = phase === 'draft' ? season?.draft?.men.find((m) => m.player.id === p.id) : undefined;
  if (called?.outcome === 'pending') {
    return { tint: 'warn', value: 'Drafted', note: `Round ${called.round} · waiting on you`, risk: true };
  }
  if (called?.outcome === 'stayed') {
    return { tint: 'ok', value: 'Staying', note: 'He turned the club down', risk: false };
  }
  if (!draftEligible({ classYear: p.classYear, age: p.age + 1 })) {
    return { tint: 'none', value: 'Not eligible', note: 'Too young for this June', risk: false };
  }
  const odds = draftChance(draftStock(p, season, season ? draftContextOf(season) : null));
  const note = 'Eligible for this June’s draft';
  if (odds >= 0.7) return { tint: 'warn', value: 'Likely to leave', note, risk: true };
  if (odds >= 0.35) return { tint: 'warn', value: 'Could leave', note, risk: true };
  if (odds >= 0.12) return { tint: 'none', value: 'Outside chance', note, risk: false };
  return { tint: 'ok', value: 'Should stay', note, risk: false };
}

export const MOOD_WORD: Record<ReturnType<typeof mood>, string> = {
  buzzing: 'Buzzing', fine: 'Content', restless: 'Restless', unhappy: 'Unhappy',
};

/** His mood as a roster chip: only when it is something to act on. */
export function moodFlag(p: AnyPlayer): { text: string; tint: 'warn' | 'bad' } | null {
  const m = mood(p);
  if (m === 'unhappy') return { text: MOOD_WORD.unhappy, tint: 'bad' };
  if (m === 'restless') return { text: MOOD_WORD.restless, tint: 'warn' };
  return null;
}

/**
 * His share of the games that count for him, measured the way June's
 * settling and the portal measure it (`settleTheMoods`, `openPortal`): a
 * hitter's starts over his team's games; an arm's outings over the busiest
 * arm doing his job, because nobody pitches forty-five times (`armShare`).
 */
function playingTime(
  p: AnyPlayer, owner: Owner, season: SeasonState,
): { count: number; games: number; share: number } {
  if (isArm(p)) {
    const staff = [...owner.team.rotation, ...owner.team.bullpen];
    const a = armShare(p, staff, (id) => season.pitching.get(id)?.g ?? 0);
    return { count: a.starts, games: a.games, share: a.starts / a.games };
  }
  const starts = (p as AnyPlayer & { starts?: number }).starts ?? 0;
  return { count: starts, games: owner.gp, share: owner.gp > 0 ? starts / owner.gp : 0 };
}

/** Fewer games than this and nobody's playing time says anything yet. */
const JUDGED_AFTER = 5;

/**
 * A promise he can already hold against you. The position and the redshirt
 * are facts about him today; the two-way chance is a season's count, so it is
 * only broken once the season is over.
 */
function promiseBroken(p: AnyPlayer, season: SeasonState, over: boolean): boolean {
  const promise = p.recruitPromise;
  if (!promise || promiseSpent(promise)) return false;
  if (promise.kind === 'twoWayOpportunity') {
    return over && explicitRecruitPromiseBroken(p, {
      battingGames: season.batting.get(p.id)?.g ?? 0,
      pitchingGames: season.pitching.get(p.id)?.g ?? 0,
    });
  }
  return explicitRecruitPromiseBroken(p);
}

/** How the rest of each "expects to..." sentence goes, kept and not kept. */
const AND_DOES: Record<string, [string, string]> = {
  'expects to start': [', and does', ', and is not'],
  'expects to play a good deal': [', and does', ', and does not'],
  'expects to be in the mix': [', and is', ', and is not'],
};

interface Fact { label: string; value: string; note: string; tint: Tint }

/** How he feels, and the expectation behind it, judged once there is a season to judge. */
function moodFact(p: AnyPlayer, owner: Owner, season: SeasonState): Fact {
  const feeling = mood(p);
  const rank = squadRanks(owner.team).get(p.id) ?? 20;
  const phrase = promiseOf(p, rank);
  // Only a hitter's starts can be judged against games played, and only once
  // there have been a few.
  const tail = AND_DOES[phrase];
  let note = sentence(phrase);
  if (tail && !isArm(p) && owner.gp >= JUDGED_AFTER) {
    const short = expectationOf(p, rank) - playingTime(p, owner, season).share >= 0.25;
    note += short ? tail[1] : tail[0];
  }
  return {
    label: 'Mood',
    value: MOOD_WORD[feeling],
    note,
    tint: feeling === 'unhappy' ? 'bad' : feeling === 'restless' ? 'warn' : 'ok',
  };
}

/**
 * Whether the portal is a worry, read off the same three things `entersPortal`
 * weighs and nothing else: his mood (`flightRisk`), how far short of what he
 * was told he is playing, and a promise you have broken. A senior graduates
 * and a man who has transferred once cannot again, so neither is at risk; a
 * star's minutes are not counted, because the portal does not count them.
 */
function transferFact(
  p: AnyPlayer, owner: Owner, season: SeasonState, over: boolean, portalReason?: string,
): Fact {
  const label = 'Transfer risk';
  const port = p as AnyPlayer & Portable;
  // Read off the open portal's own list, the one place that says who is in it.
  if (portalReason !== undefined) {
    return { label, value: 'In the portal', note: portalReason.replace(/\.$/, ''), tint: 'bad' };
  }
  if (p.classYear === 'SR') return { label, value: 'None', note: 'He graduates instead', tint: 'none' };
  if (port.transferred) return { label, value: 'None', note: 'He has already transferred once', tint: 'none' };
  const risk = flightRisk(p);
  const rank = squadRanks(owner.team).get(p.id) ?? 20;
  const buried = owner.gp >= JUDGED_AFTER && overallOf(p) < STAR_LINE
    ? Math.max(0, expectationOf(p, rank) - playingTime(p, owner, season).share) : 0;
  const broken = promiseBroken(p, season, over);
  if (broken || risk >= 0.4 || buried >= 0.4) {
    return {
      label, value: 'High', tint: 'bad',
      note: broken ? 'You broke a promise to him' : buried >= 0.25 ? 'Wants more playing time' : 'Unhappy enough to leave',
    };
  }
  if (risk > 0 || buried >= 0.25) {
    return {
      label, value: 'Worth watching', tint: 'warn',
      note: buried >= 0.25 ? 'Wants more playing time' : 'Starting to look around',
    };
  }
  return { label, value: 'Low', note: 'No warning signs', tint: 'ok' };
}

// ---------------------------------------------------------------------------
// The header
// ---------------------------------------------------------------------------

/**
 * Who he is: the face, the school, the name, what he plays, whether he can
 * play, and the two numbers the rest of the card is read against. Another
 * program's man keeps his potential to himself; the cell stays, locked, so
 * every card has the same shape.
 */
export function CardHeader(
  { p, owner, isOurs, own, homeRole, dhToday, covering }:
  {
    p: AnyPlayer; owner: Owner; isOurs: boolean; own: string; homeRole?: string;
    dhToday: boolean;
    /** The spot the chart has him standing at tonight, when it is not his own. */
    covering: string | null;
  },
) {
  const season = useDynasty((s) => s.season);
  const winter = useDynasty((s) => s.phase) !== null;
  const isPitcher = p.type === 'pitcher';
  const twoWay = isTwoWay(p);
  const status = availabilityOf(p, season ? injuryClock(season) : 0, winter);
  const role = twoWay
    ? `Two-way: ${posName(homeRole ?? (p as unknown as Pitcher).role).toLowerCase()} and ${posName(own).toLowerCase()}`
    : posName(own);
  const captain = captainOf(owner.team)?.id === p.id;
  const sidearm = (isPitcher || twoWay) && (p as unknown as Pitcher).sidearm;

  return (
    <>
      <header className="pb-pcard__head">
        <Face id={p.id} team={owner.def.abbr} size={80} />
        <span className="pb-pcard__who">
          {/* His school's logo: the card covers the header that carried it. */}
          <span className="pb-pcard__eyebrow">
            <Crest abbr={owner.def.abbr} size={18} />
            <span>{owner.def.school} · {leagueName(owner.conference)}</span>
          </span>
          <h1 className="pb-pcard__name">{p.name}</h1>
          <span className="pb-pcard__meta">{role} · {classWord(p.classYear)} · Age {p.age}</span>
        </span>
      </header>
      <div className="pb-pcard__tags">
        <StatusBadge tone={TINT_TONE[status.tint]} icon={false}>{status.tag}</StatusBadge>
        {captain && <StatusBadge tone="positive" icon={false}>Captain</StatusBadge>}
        <StatusBadge icon={false}>{handsLine(p.bats, p.throws)}</StatusBadge>
        {sidearm && <StatusBadge icon={false}>Sidearm</StatusBadge>}
        {dhToday && <StatusBadge icon={false}>Designated hitter tonight</StatusBadge>}
        {covering && (
          <StatusBadge icon={false}>
            {isPitcher
              ? `Filling in as a ${posName(covering).toLowerCase()}`
              : `Filling in at ${posName(covering).toLowerCase()}`}
          </StatusBadge>
        )}
      </div>
      <div className="pb-pcard__numbers">
        <span className="pb-pcard__number"><span>Rating</span><b>{overallOf(p)}</b></span>
        <span className="pb-pcard__number">
          <span>Potential</span>
          {isOurs
            ? <b>{potentialGrade(p.potential)}</b>
            : <b className="is-locked"><Icon name="lock" size={22} label="Kept by his program" /></b>}
        </span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// At a glance
// ---------------------------------------------------------------------------

function Tile({ f }: { f: Fact }) {
  return (
    <div className={cx('pb-pcard__tile', `is-${f.tint}`)}>
      <span className="pb-pcard__tile-label"><i aria-hidden />{f.label}</span>
      <b>{f.value}</b>
      <small>{f.note}</small>
    </div>
  );
}

/**
 * The four facts a coach checks before any number: can he play, how does he
 * feel, will the draft take him, will the portal. Coloured by what they say.
 * Another program's man shows the two a box score would tell you.
 */
export function Glance(
  { p, owner, isOurs, portalReason }:
  { p: AnyPlayer; owner: Owner; isOurs: boolean; portalReason?: string },
) {
  const season = useDynasty((s) => s.season);
  const phase = useDynasty((s) => s.phase);
  const winter = phase !== null;
  if (!season) return null;
  const status = availabilityOf(p, injuryClock(season), winter);
  const draft = draftOutlook(p, phase, season);
  const facts: Fact[] = [
    { label: 'Availability', value: status.value, note: status.note, tint: status.tint },
    ...(isOurs ? [moodFact(p, owner, season)] : []),
    { label: 'Draft', value: draft.value, note: draft.note, tint: draft.tint },
    ...(isOurs ? [transferFact(p, owner, season, winter, portalReason)] : []),
  ];
  return (
    <section className="pb-pcard__section" aria-label="At a glance">
      <span className="pb-pcard__kicker">At a glance</span>
      <div className="pb-pcard__glance">
        {facts.map((f) => <Tile key={f.label} f={f} />)}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// What you owe him
// ---------------------------------------------------------------------------

interface PromiseView {
  status: string;
  tone: 'positive' | 'warning' | 'negative' | 'muted';
  /** Progress and target, each nought to one, for the bar. */
  bar?: { at: number; target?: number };
  /** A second and third bar, for the two-way chance's two counts. */
  halves?: Array<{ label: string; count: number; of: number }>;
  line: string;
}

const pctOf = (v: number): number => Math.round(v * 100);

/** His games against what was promised, in the terms the promise was made in. */
function promiseView(p: AnyPlayer, owner: Owner, season: SeasonState, over: boolean): PromiseView | null {
  const promise = p.recruitPromise;
  if (!promise) return null;

  if (promise.kind === 'immediateRole') {
    const rank = squadRanks(owner.team).get(p.id) ?? 20;
    // The promise is 62%; a squad standing can raise what he expects above
    // it, and what he expects is what June measures (`expectationOf`).
    const target = expectationOf(p, rank);
    const aim = target > 0.625
      ? `You promised 62%; his standing makes it ${pctOf(target)}%.`
      : 'You promised at least 62% this season.';
    if (owner.gp === 0) {
      return { status: 'No games yet', tone: 'muted', bar: { at: 0, target }, line: aim };
    }
    const time = playingTime(p, owner, season);
    const onTrack = time.share >= target;
    const arm = isArm(p);
    const role = (p as AnyPlayer & { role?: string }).role === 'SP' ? 'starter' : 'reliever';
    // Once the season is over the share is final: the word was kept or not.
    return {
      status: over ? (onTrack ? 'Kept' : 'Broken') : (onTrack ? 'On track' : 'At risk'),
      tone: onTrack ? 'positive' : over ? 'negative' : 'warning',
      bar: { at: Math.min(1, time.share), target },
      line: arm
        ? `Pitched in ${plural(time.count, 'game')}, ${pctOf(time.share)}% as often as your busiest ${role}. ${aim}`
        : `Started ${time.count} of ${plural(time.games, 'game')} (${pctOf(time.share)}%). ${aim}`,
    };
  }

  if (promise.kind === 'noRedshirt') {
    const sitting = (p as AnyPlayer & { redshirt?: boolean }).redshirt === true;
    return sitting
      ? { status: 'Broken', tone: 'negative', line: 'Redshirted. You promised he would not be.' }
      : { status: over ? 'Kept' : 'On track', tone: 'positive', line: 'On the active roster. You promised no redshirt this season.' };
  }

  if (promise.kind === 'keepPosition') {
    // Judged from where he lives, as the judge reads it: his home, not the
    // spot he is covering tonight (`explicitRecruitPromiseBroken`).
    const home = (p as Hitter).homePos ?? p.pos;
    const promised = promise.promisedPos ?? home;
    const planned = (p as Hitter & { retrainTo?: Position }).retrainTo;
    const seasonNo = `Season ${Math.min(2, (promise.judged ?? 0) + 1)} of 2.`;
    if (home !== promised) {
      return {
        status: 'Broken', tone: 'negative',
        line: `Now at ${posName(home).toLowerCase()}. You promised ${posName(promised).toLowerCase()}.`,
      };
    }
    if (planned && planned !== promised) {
      return {
        status: 'At risk', tone: 'warning',
        line: `The planned move to ${posName(planned).toLowerCase()} breaks it. ${seasonNo}`,
      };
    }
    return { status: 'On track', tone: 'positive', line: `At ${posName(promised).toLowerCase()}, as promised. ${seasonNo}` };
  }

  // A chance to hit and to pitch: two counts, both due by the end of the season.
  const bat = season.batting.get(p.id)?.g ?? 0;
  const arm = season.pitching.get(p.id)?.g ?? 0;
  const met = bat >= TWO_WAY_BATTING_GAMES && arm >= TWO_WAY_PITCHING_GAMES;
  const halves = [
    { label: 'Batting', count: bat, of: TWO_WAY_BATTING_GAMES },
    { label: 'Pitching', count: arm, of: TWO_WAY_PITCHING_GAMES },
  ];
  const line = `Batting ${bat} of ${TWO_WAY_BATTING_GAMES}, pitching ${arm} of ${TWO_WAY_PITCHING_GAMES}. Both by the end of the season.`;
  if (met) return { status: 'Kept', tone: 'positive', halves, line };
  if (over) return { status: 'Broken', tone: 'negative', halves, line };
  // On pace: his counts against the share of the regular season played.
  const scheduled = season.schedule.reduce(
    (n, d) => n + d.games.filter((g) => g.home === owner.index || g.away === owner.index).length, 0,
  );
  if (owner.gp === 0 || scheduled === 0) return { status: 'No games yet', tone: 'muted', halves, line };
  const played = Math.min(1, owner.gp / scheduled);
  const onPace = bat >= Math.floor(TWO_WAY_BATTING_GAMES * played) && arm >= Math.floor(TWO_WAY_PITCHING_GAMES * played);
  return { status: onPace ? 'On track' : 'At risk', tone: onPace ? 'positive' : 'warning', halves, line };
}

function Bar({ at, target, tone }: { at: number; target?: number; tone: PromiseView['tone'] }) {
  return (
    <span className="pb-pcard__bar" aria-hidden>
      <i className={cx('pb-pcard__bar-fill', `is-${tone}`)} style={{ width: `${Math.round(at * 100)}%` }} />
      {target !== undefined && <i className="pb-pcard__bar-target" style={{ left: `${Math.round(target * 100)}%` }} />}
    </span>
  );
}

/**
 * The promise he signed on, while it still binds: how it stands, a bar to
 * the mark you promised, and one line of the numbers behind it.
 */
export function PromiseTracker({ p, owner }: { p: AnyPlayer; owner: Owner }) {
  const season = useDynasty((s) => s.season);
  const winter = useDynasty((s) => s.phase) !== null;
  if (!season || !p.recruitPromise || promiseSpent(p.recruitPromise)) return null;
  // Over once the offseason starts: June's games count toward every promise.
  const view = promiseView(p, owner, season, winter);
  // Only for the promise's name, the one every other screen calls it by.
  const words = recruitPromiseProgress(p, { starts: 0, games: 0 });
  if (!view || !words) return null;
  return (
    <section className="pb-pcard__section" aria-label="What you owe him">
      <span className="pb-pcard__kicker">What you owe him</span>
      <div className="pb-pcard__promise">
        <div className="pb-pcard__promise-head">
          <b>Promise · {words.title.toLowerCase()}</b>
          <span className={`pb-tone--${view.tone}`}>{view.status}</span>
        </div>
        {view.bar && <Bar at={view.bar.at} target={view.bar.target} tone={view.tone} />}
        {view.halves?.map((h) => (
          <span key={h.label} className="pb-pcard__half">
            <small>{h.label}</small>
            <Bar at={Math.min(1, h.count / h.of)} tone={h.count >= h.of ? 'positive' : view.tone} />
            <b>{h.count}/{h.of}</b>
          </span>
        ))}
        <p>{view.line}</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// More about him
// ---------------------------------------------------------------------------

/**
 * The years he has played, oldest first, with this one marked unfinished. The
 * archive is written in June, so until then the season in progress only lives
 * in the season's books, and it is computed by the same function the archive
 * will use.
 */
export function careerYears(
  season: SeasonState | null, ownerIndex: number, id: PlayerId, isOurs: boolean,
): { years: CareerYear[]; live: CareerYear | null } {
  const archived = season?.careers?.[id] ?? [];
  const live = isOurs && season ? liveCareerYear(season, ownerIndex, id) : null;
  return {
    years: live ? [...archived.filter((y) => y.year !== live.year), live] : archived,
    live,
  };
}

/**
 * Every award the book has his name on, newest first: the dynasty's archive,
 * and the season in progress read live once it is complete.
 */
export function useAwardsWon(id: PlayerId): { year: number; title: string }[] {
  const history = useDynasty((s) => s.history);
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  void version;

  const won: { year: number; title: string }[] = [];
  for (const rec of history) {
    for (const a of rec.awards ?? []) {
      if (a.id === id) won.push({ year: rec.year, title: a.title });
    }
  }
  if (season && seasonComplete(season)) {
    for (const a of seasonAwards(season)) {
      if (a.id === id && !won.some((w) => w.year === year && w.title === a.title)) {
        won.push({ year, title: a.title });
      }
    }
  }
  return won.sort((a, b) => b.year - a.year);
}

/** The short names a dugout uses for the spots a man also covers. */
const SPOT_WORD: Partial<Record<Position, string>> = {
  C: 'catcher', '1B': 'first', '2B': 'second', '3B': 'third', SS: 'short',
  LF: 'left', CF: 'center', RF: 'right',
};

const r = (v: number): number => Math.round(v);

// The three numbers and nothing after them. The review's tail (". fielding
// and splits") was cut to "field…" on every row at a phone's 375 points,
// which read as the card overflowing (2026-09-26).
function ratingsLine(p: AnyPlayer): string {
  if (p.type === 'pitcher') {
    return `Stuff ${r(p.stuff)} · Control ${r(p.control)} · Stamina ${r(p.stamina)}`;
  }
  const h = p as Hitter;
  return `Contact ${r(h.contact)} · Power ${r(h.power)} · Speed ${r(h.speed)}`;
}

function seasonLine(p: AnyPlayer, season: SeasonState | null): string {
  const bat = season?.batting.get(p.id);
  const pit = season?.pitching.get(p.id);
  const batted = !!bat && (bat.ab > 0 || bat.bb > 0 || bat.hbp > 0);
  const pitched = !!pit && pit.outs > 0;
  const avg = bat && bat.ab > 0 ? pct(battingAverage(bat)) : '—';
  if (isTwoWay(p)) {
    const parts = [
      ...(bat && batted ? [`${avg} AVG`, `${bat.hr} HR`] : []),
      ...(pit && pitched ? [`${era(pit).toFixed(2)} ERA`, `${pit.k} K`] : []),
    ];
    return parts.length > 0 ? parts.join(' · ') : 'No games yet';
  }
  if (p.type === 'pitcher') {
    return pit && pitched
      ? `${era(pit).toFixed(2)} ERA · ${pit.w}–${pit.l} · ${pit.k} K · ${plural(pit.g, 'game')}`
      : 'No games yet';
  }
  return bat && batted
    ? `${avg} AVG · ${bat.hr} HR · ${bat.rbi} RBI · ${plural(bat.g, 'game')}`
    : 'No games yet';
}

function badgesLine(p: AnyPlayer): string {
  const held = badgesOf(p);
  const cap = badgeCap(p.potential);
  if (held.length === 0) return `0 of ${cap} · none yet`;
  return `${held.length} of ${cap} · ${held.map((b) => capsWords(BADGES[b.id].label)).join(', ')}`;
}

function positionsLine(p: Hitter, own: string): string {
  // From his own spot, not tonight's label: a first baseman at DH tonight
  // read "First base, also covers right and first" off the label's guess.
  const man: Hitter = own === p.pos ? p : { ...p, pos: own as Position };
  const covers = secondaryPositions(man).slice(0, 3).map((s) => SPOT_WORD[s] ?? posName(s).toLowerCase());
  const planned = (p as Hitter & { retrainTo?: Position }).retrainTo;
  return [
    `${posName(own)}${covers.length ? `, also covers ${andList(covers)}` : ''}`,
    ...(isTwoWay(p) ? [posName(p.role).toLowerCase()] : []),
    ...(planned ? [`moving to ${posName(planned).toLowerCase()}`] : []),
  ].join(' · ');
}

/**
 * The drill-in rows: what each part of him holds, said in one line before it
 * is opened. Badges are known only about your own men, and a pitcher has no
 * positions to learn, so those rows are not offered where they would be empty.
 */
export function MoreAboutHim(
  { p, owner, isOurs, own, onOpen }:
  { p: AnyPlayer; owner: Owner; isOurs: boolean; own: string; onOpen: (s: Section) => void },
) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  const awards = useAwardsWon(p.id).length;
  const { years } = careerYears(season, owner.index, p.id, isOurs);
  const moments = new Set((season?.moments?.[p.id] ?? []).map((m) => m.kind)).size;
  const career = years.length === 0
    ? (isOurs ? 'No games yet' : 'Kept by his program')
    : [
      years.length === 1 && p.classYear === 'FR' ? 'First season' : `${plural(years.length, 'season')} on record`,
      ...(awards > 0 ? [plural(awards, 'honor')] : []),
      ...(moments > 0 ? [plural(moments, 'signature moment')] : []),
    ].join(' · ');

  // His badges as the art itself, on the card's face. The row said "2 of 2" in
  // type and the emblems waited a tap away, which read as badges not showing
  // (2026-09-26).
  const held = badgesOf(p);
  const emblems = held.length > 0 ? (
    <span className="pb-pcard__emblems" aria-hidden>
      {held.map((b) => <BadgeEmblem key={b.id} id={b.id} tier={b.tier} size={30} />)}
    </span>
  ) : undefined;

  const rows: Array<{ key: Section; icon: IconName; title: string; sub: string; extra?: ReactNode }> = [
    { key: 'ratings', icon: 'bar-chart', title: 'Ratings', sub: ratingsLine(p) },
    { key: 'season', icon: 'rows', title: 'This season', sub: seasonLine(p, season) },
    ...(isOurs ? [{ key: 'badges' as const, icon: 'star' as const, title: 'Badges', sub: badgesLine(p), extra: emblems }] : []),
    ...(p.type === 'hitter'
      ? [{ key: 'positions' as const, icon: 'shuffle' as const, title: 'Positions', sub: positionsLine(p, own) }] : []),
    { key: 'career', icon: 'reader', title: 'Career', sub: career },
  ];

  return (
    <section className="pb-pcard__section" aria-label="More about him">
      <span className="pb-pcard__kicker">More about him</span>
      <List label="More about him" className="pb-pcard__hub">
        {rows.map((row) => (
          <ListRow
            key={row.key}
            icon={row.icon}
            markTone="neutral"
            title={row.title}
            subtitle={row.sub}
            onClick={() => onOpen(row.key)}
          >{row.extra}</ListRow>
        ))}
      </List>
    </section>
  );
}
