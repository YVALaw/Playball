// Player.tsx
// One player's card.
//
// A header that says who he is, with the two numbers that are true on every
// tab: his Rating today and, for your own men, his Potential. Under it four
// views of him — Overview, Ratings, Stats and Career — and, for your own
// players, a Decisions section on the Overview that replaces the old floating
// Manage button: every decision in plain sight, with what it costs.
//
// Another program's player shows what a box score and a scouting report would
// tell you, and says what it withholds: his potential, mood and promises stay
// with his program.
//
// A man who has left (graduated, drafted, a walk-on whose year was up) opens
// as an alumnus card: how he left, what he did here, and what came after.

import { useState } from 'react';
import { RosterMoves } from './RosterMoves.js';
import { seasonAwards } from '../../engine/postseason.js';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { BADGES, TIER_NAME, badgeCap, badgesOf } from '../../engine/badges.js';
import { PITCHES, repertoireOf, speedOf } from '../../engine/pitches.js';
import { potentialGrade } from '../../engine/scouting.js';
import {
  HITTER_TENDENCIES, PITCHER_TENDENCIES, TENDENCIES, isKnown, tendenciesOf,
  tendencyLabel, watchProgress, type TendencyId,
} from '../../engine/tendencies.js';
import { draftEligible } from '../../engine/draft.js';
import { draftChance } from '../../engine/progression.js';
import {
  expectationOf, flightRisk, mood, promiseOf, squadRanks, recruitPromiseProgress,
} from '../../engine/morale.js';
import { available } from '../../engine/depthChart.js';
import { isHurt, prognosis } from '../../engine/injury.js';
import { overallOf, platoonSplit, naturalPos } from '../../engine/ratings.js';
import { secondaryPositions } from '../../engine/positions.js';
import { RetrainSheet } from '../RetrainModal.js';
import { PROJECT_ATTRIBUTE } from '../../engine/staffProjects.js';
import { PROJECT_LABEL } from '../../engine/economy.js';
import { captainOf } from '../../engine/captains.js';
import { handles } from '../../state/depth.js';
import { proCareer, COACHING_LEVEL, type AlumnusNote, type Moment } from '../../engine/legacy.js';
import { collegeSummary, marksHeldBy } from '../ProgramBits.js';
import {
  battingAverage, onBase, slugging, era, whip, inningsPitched,
  careerName, liveCareerYear, seasonComplete, injuryClock,
} from '../../engine/season.js';
import type { BoxScore, CareerYear, SeasonState } from '../../engine/season.js';
import type { Departure } from '../../engine/progression.js';
import { pct, ipText, shortDate } from '../format.js';
import { whyOut } from '../Needs.js';
import { isTwoWay } from '../../engine/types.js';
import type {
  ClassYear, Hitter, Pitcher, PlayerId, Position, Player as AnyPlayer,
} from '../../engine/types.js';
import {
  Button, Callout, Card, Chip, Chips, DescriptionList, EmptyState, Face, GameRow, List, ListRow,
  Medal, Meter, ProfileHeader, RatingRow, SegmentedControl, Sheet, StatGroup, StatusBadge, Table, Tag,
  type DescriptionItem, type IconName, type StatTileProps, type TableColumn, type Tone,
} from '../components/ui/index.js';
import {
  CLASS_NAME, POSITION_NAME, boxLineWords, boxSlotWords, capsWords, conferenceName, handsText,
  plural, proLevelName, schoolNamesIn, sentence,
} from '../words.js';

/** The record for one program, as the season carries it. */
type Owner = SeasonState['teams'][number];

/**
 * The keys of a player that hold a rating. A key that drifts in the engine is
 * a compile error here rather than a bar that quietly draws zero.
 */
type RatingKey<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T] & string;

/*
  The ratings, in words. The engine keeps its own field names (range, hands,
  stuff); nobody reading the card should have to learn them, and nobody should
  have to decode K/9 to know what a pitcher's first rating is about.
*/
const HITTING: Array<[RatingKey<Hitter>, string]> = [
  ['contact', 'Contact'],
  ['power', 'Power'],
  ['eye', 'Plate discipline'],
  ['speed', 'Speed'],
  ['steal', 'Base stealing'],
  ['bunt', 'Bunting'],
];

const HITTER_GLOVE: Array<[RatingKey<Hitter>, string]> = [
  ['range', 'Range in the field'],
  ['hands', 'Sure hands'],
  ['arm', 'Arm strength'],
  ['armAccuracy', 'Throwing accuracy'],
];

/**
 * Blocking, only behind the plate: every position player carries the rating
 * but the simulation reads it for catchers alone, so it only appears where it
 * is real.
 */
const CATCHER_BAR: [RatingKey<Hitter>, string] = ['blocking', 'Blocking pitches'];

const PITCHING: Array<[RatingKey<Pitcher>, string]> = [
  ['stuff', 'Strikeout stuff'],
  ['movement', 'Keeps hits down'],
  ['control', 'Control'],
  ['stamina', 'Stamina'],
  ['groundBall', 'Ground-ball pitcher'],
  ['holdRunners', 'Pickoff move'],
];

const PITCHER_GLOVE: Array<[RatingKey<Pitcher>, string]> = [
  ['range', 'Range in the field'],
  ['hands', 'Sure hands'],
  ['arm', 'Arm strength'],
  ['armAccuracy', 'Throwing accuracy'],
];

/** What every rating card says about the numbers on it. */
const SCALE = 'Out of 100 · 60 is solid, 75 is a strength';

type View = 'overview' | 'ratings' | 'stats' | 'career';
const VIEWS: readonly View[] = ['overview', 'ratings', 'stats', 'career'];

const posName = (pos: string): string => POSITION_NAME[pos as Position] ?? pos;
const classWord = (cy: string): string => CLASS_NAME[cy as ClassYear] ?? cy;

/** A production change, signed, so a reverse split reads as one. */
const pctSigned = (v: number): string => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`;

const MOOD_WORD: Record<ReturnType<typeof mood>, string> = {
  buzzing: 'Buzzing', fine: 'Content', restless: 'Restless', unhappy: 'Unhappy',
};

// ---------------------------------------------------------------------------

/** One appearance, pulled out of a box score. */
export interface GameLogRow {
  day: number;
  /** The other program's abbreviation. */
  opponent: string;
  home: boolean;
  won: boolean;
  us: number;
  them: number;
  /** Lineup spot or pitching role, as the box score recorded it. */
  slot: string;
  /** "2-4, HR, 3 RBI". Display text the game layer already wrote. */
  line: string;
}

/**
 * Every game this man appeared in, oldest first.
 *
 * Matched on the player id rather than the name, because two men with one name
 * is a matter of time and a game log that silently merges them is worse than
 * none. Only ever finds anything for the user's program and the current year:
 * box scores are kept for his team alone and wiped at the roll.
 */
export function gameLogFor(
  season: {
    boxScores?: Record<number, BoxScore>;
    teams: ReadonlyArray<{ def: { abbr: string } }>;
  },
  id: PlayerId,
  teamIndex: number,
  /** A two-way man's card asks for one half; everybody else takes both. */
  half?: 'bat' | 'arm',
): GameLogRow[] {
  const rows: GameLogRow[] = [];
  for (const box of Object.values(season.boxScores ?? {})) {
    const home = box.home === teamIndex;
    if (!home && box.away !== teamIndex) continue;

    const batting = home ? box.homeBatting : box.awayBatting;
    const pitching = home ? box.homePitching : box.awayPitching;
    const pool = half === 'arm' ? pitching : half === 'bat' ? batting
      : [...batting, ...pitching];
    const line = pool.find((l) => l.id === id);
    if (!line) continue;

    const us = home ? box.homeRuns : box.awayRuns;
    const them = home ? box.awayRuns : box.homeRuns;
    rows.push({
      day: box.day,
      opponent: season.teams[home ? box.away : box.home]?.def.abbr ?? '—',
      home,
      won: us > them,
      us,
      them,
      slot: line.slot,
      line: line.line,
    });
  }
  // Keyed by day in the save, and object key order is not a promise worth
  // relying on for something the reader expects in calendar order.
  return rows.sort((a, b) => a.day - b.day);
}

/** Whether he can play, said as a word, an icon and a colour. */
function availability(p: AnyPlayer, day: number): {
  tone: Tone; icon: IconName; label: string; badge: string; note: string;
} {
  if ((p as AnyPlayer & { redshirt?: boolean }).redshirt) {
    return {
      tone: 'neutral', icon: 'pause', label: 'Redshirt', badge: 'Redshirt · sits out this season',
      note: 'Sits out the season and keeps the year of eligibility',
    };
  }
  if (available(p, day)) {
    return { tone: 'positive', icon: 'check', label: 'Ready to play', badge: 'Ready to play', note: 'Nothing keeping him out' };
  }
  if (isHurt(p, day)) {
    const n = prognosis(p, day);
    return { tone: 'negative', icon: 'cross-circled', label: 'Injured', badge: `Injured · ${n}`, note: sentence(n) };
  }
  const w = whyOut(p, day);
  if ((p as AnyPlayer & { why?: string }).why === 'academic') {
    return { tone: 'warning', icon: 'reader', label: 'Academic hold', badge: `Academic hold · ${w}`, note: sentence(w) };
  }
  return { tone: 'neutral', icon: 'clock', label: 'Resting', badge: sentence(w), note: sentence(w) };
}

const toneOf = (t: Tone): DescriptionItem['tone'] =>
  (t === 'positive' || t === 'warning' || t === 'negative' || t === 'info' ? t : undefined);

// ---------------------------------------------------------------------------

export function Player() {
  const season = useDynasty((s) => s.season);
  const selected = useDynasty((s) => s.selectedPlayer);
  const playerCardSection = useDynasty((s) => s.playerCardSection);
  const report = useDynasty((s) => s.lastOffseason);
  const portal = useDynasty((s) => s.portal);
  const alumni = useDynasty((s) => s.alumni);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const [view, setView] = useState<View>(playerCardSection);
  const [half, setHalf] = useState<'bat' | 'arm'>('bat');
  void version;

  if (!season || !team || !selected) return <Nobody />;

  // Look across the whole world, not just this roster: a leaderboard is full
  // of players you do not employ and would still like to read about.
  const rosterOf = (t: Owner): AnyPlayer[] =>
    [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen];

  const portalEntry = portal
    ? [...portal.leaving, ...portal.available].find((m) => m.player.id === selected)
    : undefined;

  let p: AnyPlayer | undefined = rosterOf(team).find((x) => x.id === selected);
  let owner = team;
  if (!p) {
    for (const t of season.teams) {
      const found = rosterOf(t).find((x) => x.id === selected);
      if (found) { p = found; owner = t; break; }
    }
  }

  // A portal entrant is between rosters in the offseason; his card stays
  // attached to the program he is leaving.
  if (!p && portalEntry) {
    p = portalEntry.player;
    owner = season.teams[portalEntry.from] ?? team;
  }

  // Nobody's roster, and a real player rather than a bad id: a draftee, a
  // graduate, an award winner from years ago. What is left of him is how he
  // left and the record book.
  if (!p) {
    const gone = [...(report?.graduated ?? []), ...(report?.drafted ?? [])]
      .find((d) => d.id === selected);
    const career = season.careers?.[selected] ?? [];
    const note = alumni[selected];
    if (!gone && career.length === 0 && !note) return <Nobody />;
    return <Alumnus id={selected} gone={gone} note={note} career={career} view={view} onView={setView} />;
  }

  // You only scout your own program in full. Everyone else's card shows what
  // a box score would tell you, and withholds potential.
  const isOurs = owner.index === team.index;
  const isPitcher = p.type === 'pitcher';
  const twoWay = isTwoWay(p);
  // A DH is named by the position he actually plays, and a man the chart has
  // standing somewhere else tonight keeps his own position, with the cover
  // said beside it. The same for an arm filling another role.
  const homePos = !isPitcher ? (p as Hitter & { homePos?: Position }).homePos : undefined;
  const homeRole = isPitcher || twoWay
    ? (p as Pitcher & { homeRole?: Pitcher['role'] }).homeRole : undefined;
  const own: string = isPitcher
    ? (homeRole ?? (p as Pitcher).role)
    : naturalPos(homePos ? { ...(p as Hitter), pos: homePos } : (p as Hitter));
  const dhToday = !isPitcher && p.pos === 'DH';
  const covering = isPitcher
    ? ((p as Pitcher).role !== own ? (p as Pitcher).role : null)
    : (p.pos !== 'DH' && p.pos !== own ? p.pos : null);

  // A view that is not on offer is never the one on screen.
  const active: View = VIEWS.includes(view) ? view : 'overview';

  return (
    <main className="pb-page pb-playercard">
      <PlayerHeader
        p={p}
        owner={owner}
        isOurs={isOurs}
        own={own}
        homeRole={homeRole}
        dhToday={dhToday}
        covering={covering}
      />
      {portalEntry && (
        <Callout tone="info" icon="enter" title={`In the transfer portal, from ${portalEntry.fromName}`}>
          {portalEntry.reason}
        </Callout>
      )}
      <SegmentedControl<View>
        label="Player card"
        value={active}
        onChange={setView}
        options={[
          // The first-season errand for a failing player points here when the
          // card is on another view: Decisions live on the Overview.
          { value: 'overview', label: 'Overview', guide: 'player-actions' },
          { value: 'ratings', label: 'Ratings' },
          { value: 'stats', label: 'Stats' },
          { value: 'career', label: 'Career' },
        ]}
      />
      {twoWay && (active === 'stats' || active === 'career') && (
        <Chips label="Which half of his game">
          <Chip selected={half === 'bat'} onClick={() => setHalf('bat')}>Batting</Chip>
          <Chip selected={half === 'arm'} onClick={() => setHalf('arm')}>Pitching</Chip>
        </Chips>
      )}

      {active === 'overview' && (
        <>
          <Overview p={p} owner={owner} isOurs={isOurs} own={own} onStats={() => setView('stats')} />
          <RosterMoves p={p} isOurs={isOurs} />
        </>
      )}
      {active === 'ratings' && <Ratings p={p} isOurs={isOurs} ownerIndex={owner.index} />}
      {active === 'stats' && (
        <>
          <SeasonsUnder p={p} owner={owner} isOurs={isOurs} half={half} />
          <JuneByYear p={p} owner={owner} isOurs={isOurs} half={half} />
          <Games id={p.id} owner={owner} isOurs={isOurs} half={twoWay ? half : undefined} />
        </>
      )}
      {active === 'career' && (
        <Career id={p.id} owner={owner} isPitcher={twoWay ? half === 'arm' : isPitcher} isOurs={isOurs} />
      )}
    </main>
  );
}

/**
 * Who he is: the face, the school, the name, what he plays and how, whether he
 * can play tonight, and the two numbers the rest of the card is read against.
 */
function PlayerHeader(
  { p, owner, isOurs, own, homeRole, dhToday, covering }:
  {
    p: AnyPlayer; owner: Owner; isOurs: boolean; own: string; homeRole?: string;
    dhToday: boolean;
    /** The spot the chart has him standing at tonight, when it is not his own. */
    covering: string | null;
  },
) {
  const season = useDynasty((s) => s.season);
  const isPitcher = p.type === 'pitcher';
  const twoWay = isTwoWay(p);
  const status = availability(p, season ? injuryClock(season) : 0);
  const role = twoWay
    ? `Two-way: ${posName(homeRole ?? (p as unknown as Pitcher).role).toLowerCase()} and ${posName(own).toLowerCase()}`
    : posName(own);
  const captain = captainOf(owner.team)?.id === p.id;
  const sidearm = (isPitcher || twoWay) && (p as unknown as Pitcher).sidearm;

  return (
    <ProfileHeader
      media={<Face id={p.id} team={owner.def.abbr} size={80} />}
      eyebrow={`${owner.def.school} · ${conferenceName(owner.conference)}`}
      name={p.name}
      meta={`${role} · ${CLASS_NAME[p.classYear]} · Age ${p.age}`}
      tags={(
        <>
          <StatusBadge tone={status.tone} icon={status.icon}>{status.badge}</StatusBadge>
          {captain && <Tag tone="positive">Captain</Tag>}
          <Tag>{handsText(p.bats, p.throws)}</Tag>
          {sidearm && <Tag>Sidearm</Tag>}
          {dhToday && <Tag>Designated hitter tonight</Tag>}
          {covering && (
            <Tag>
              {isPitcher
                ? `Filling in as a ${posName(covering).toLowerCase()}`
                : `Filling in at ${posName(covering).toLowerCase()}`}
            </Tag>
          )}
        </>
      )}
      stats={[
        { label: 'Rating', value: overallOf(p) },
        ...(isOurs ? [{ label: 'Potential', value: potentialGrade(p.potential) }] : []),
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

/**
 * The facts a coach checks before any number: can he play, how does he feel,
 * will the draft or the portal take him. Each one with a note that finishes
 * the sentence. Then his season so far, and his badges.
 */
function Overview(
  { p, owner, isOurs, own, onStats }:
  { p: AnyPlayer; owner: Owner; isOurs: boolean; own: string; onStats: () => void },
) {
  const [retrainOpen, setRetrainOpen] = useState(false);
  const season = useDynasty((s) => s.season);
  const economy = useDynasty((s) => s.economy);
  const isPitcher = p.type === 'pitcher';

  const inJune = { classYear: p.classYear, age: p.age + 1 };
  const eligible = p.classYear !== 'SR' && draftEligible(inJune);
  const odds = eligible ? draftChance(overallOf(p)) : null;
  const draft: DescriptionItem = p.classYear === 'SR'
    ? { label: 'Draft', value: 'Graduating', note: 'His final college season' }
    : odds === null
      ? { label: 'Draft', value: 'Not eligible', note: 'Too young for this June’s draft' }
      : {
        label: 'Draft',
        value: odds >= 0.7 ? 'Likely to leave' : odds >= 0.35 ? 'Could leave' : odds >= 0.12 ? 'Outside chance' : 'Should stay',
        tone: odds >= 0.35 ? 'warning' : undefined,
        note: 'Eligible for this June’s draft',
      };

  const secondaries = !isPitcher ? secondaryPositions(p as Hitter).slice(0, 3) : [];

  if (!isOurs) {
    return (
      <>
        <Callout tone="neutral" icon="lock">His potential, mood and promises stay with his program.</Callout>
        <DescriptionList
          items={[
            draft,
            ...(isPitcher ? [{ label: 'Fastball', value: `${(p as Pitcher).velocity} mph`, note: 'Top speed' }] : []),
          ]}
        />
        <ThisSeason p={p} onStats={onStats} />
        {!isPitcher && (
          <List label="Positions">
            <ListRow
              icon="swap"
              title="Positions"
              subtitle={`${posName(own)}${secondaries.length ? `, also covers ${secondaries.map((s) => posName(s).toLowerCase()).join(', ')}` : ''} · where a winter could take him`}
              onClick={() => setRetrainOpen(true)}
            />
          </List>
        )}
        {retrainOpen && !isPitcher && (
          <RetrainSheet p={p as Hitter} canMove={false} onClose={() => setRetrainOpen(false)} />
        )}
      </>
    );
  }

  const status = availability(p, season ? injuryClock(season) : 0);
  const rank = squadRanks(owner.team).get(p.id) ?? 20;
  const feeling = mood(p);
  const role = promiseOf(p, rank);
  const starts = (p as AnyPlayer & { starts?: number }).starts ?? 0;
  const expectedShare = expectationOf(p, rank);
  const actualShare = owner.gp > 0 ? starts / owner.gp : 0;
  const buried = Math.max(0, expectedShare - actualShare);
  const moodRisk = flightRisk(p);
  // Only a hitter's starts can be judged against games played, and only once
  // there have been a few.
  const judged = !isPitcher && role.startsWith('expects') && owner.gp >= 5;

  const transfer: DescriptionItem = p.classYear === 'SR'
    ? { label: 'Transfer risk', value: 'None', note: 'He graduates instead' }
    : moodRisk >= 0.4 || buried >= 0.4
      ? { label: 'Transfer risk', value: 'High', tone: 'negative', note: buried >= 0.25 ? 'Wants more playing time' : 'Unhappy enough to leave' }
      : moodRisk > 0 || buried >= 0.25
        ? { label: 'Transfer risk', value: 'Worth watching', tone: 'warning', note: buried >= 0.25 ? 'Wants more playing time' : 'Starting to look around' }
        : { label: 'Transfer risk', value: 'Low', note: 'No warning signs' };

  const promise = recruitPromiseProgress(p, {
    starts,
    games: owner.gp,
    battingGames: season?.batting.get(p.id)?.g ?? 0,
    pitchingGames: season?.pitching.get(p.id)?.g ?? 0,
  });

  return (
    <>
      <DescriptionList
        items={[
          {
            label: 'Availability', value: status.label, tone: toneOf(status.tone),
            icon: status.tone === 'neutral' ? undefined : status.icon, note: status.note,
          },
          {
            label: 'Mood',
            value: MOOD_WORD[feeling],
            tone: feeling === 'unhappy' ? 'negative' : feeling === 'restless' ? 'warning' : undefined,
            note: `${sentence(role)}${judged ? (buried >= 0.25 ? ', and is not getting it' : ', and does') : ''}`,
          },
          draft,
          transfer,
        ]}
      />

      {promise && (
        <Callout tone="info" icon="bookmark" title={`Recruiting promise: ${promise.title.toLowerCase()}`}>
          {promise.detail} {promise.term}.
        </Callout>
      )}

      <ProjectNote p={p} economy={economy} />

      <ThisSeason p={p} onStats={onStats} />
      <BadgesCard p={p} />
    </>
  );
}

/** The staff project on this man: running, or the last one's result. */
function ProjectNote({ p, economy }: { p: AnyPlayer; economy: ReturnType<typeof useDynasty.getState>['economy'] }) {
  const id = String(p.id);
  const seats = ['hitting', 'pitching'] as const;
  const live = seats
    .map((seat) => ({ seat, project: economy.staffPlans?.[seat]?.project }))
    .find((x) => x.project?.playerId === id);
  if (live?.project) {
    const coach = economy.staff[live.seat]?.name ?? 'The staff';
    const chance = Math.round((live.project.odds ?? 0) * 100);
    return (
      <Callout tone="info" icon="timer" title={`Coach's project: ${PROJECT_ATTRIBUTE[live.project.kind].toLowerCase()}`}>
        {coach} has him for {plural(live.project.weeksLeft, 'more week')} · {chance}% chance it takes.
      </Callout>
    );
  }
  const last = (economy.projectHistory ?? []).find((r) => r.playerId === id);
  const c = last?.changes[0];
  if (!last || !c) return null;
  const coach = economy.staff[last.seat]?.name ?? 'the staff';
  return last.took === false ? (
    <Callout tone="neutral" icon="info" title={`Last project: ${c.attribute.toLowerCase()}`}>
      He did not take to {coach}&rsquo;s {PROJECT_LABEL[last.kind].toLowerCase()} in {last.year}.
    </Callout>
  ) : (
    <Callout tone="positive" title={`Last project: ${c.attribute.toLowerCase()}`}>
      {c.attribute} went from {Math.round(c.before)} to {Math.round(c.after)} under {coach} in {last.year}.
    </Callout>
  );
}

/**
 * His badges. Your own program only: a tendency can be seen from the other
 * dugout, a badge is something you only know about a man you have had in the
 * building. The ceiling is printed beside the count because it is set by his
 * potential.
 */
function BadgesCard({ p }: { p: AnyPlayer }) {
  const held = badgesOf(p);
  const cap = badgeCap(p.potential);
  return (
    <Card
      title="Badges"
      eyebrow={`${held.length} of ${cap} · his potential sets how many he can hold`}
      flush={held.length > 0}
    >
      {held.length === 0 ? (
        <p className="pb-text-muted">None yet. He earns them with what he does on the field.</p>
      ) : (
        <List className="pb-list--inset" label="Badges">
          {held.map((b) => (
            <ListRow
              key={b.id}
              lead={<Medal metal={b.tier === 3 ? 'gold' : b.tier === 2 ? 'silver' : 'bronze'} size={32} />}
              title={capsWords(BADGES[b.id].label)}
              subtitle={`${capsWords(TIER_NAME[b.tier])} · ${BADGES[b.id].note}`}
            />
          ))}
        </List>
      )}
    </Card>
  );
}

/**
 * This year's line, named. A walk is an appearance: gating on at-bats alone
 * told a pinch hitter with two walks that he had not played.
 */
function ThisSeason({ p, onStats }: { p: AnyPlayer; onStats?: () => void }) {
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  void version;
  const isPitcher = p.type === 'pitcher';
  const bat = season?.batting.get(p.id);
  const pit = season?.pitching.get(p.id);
  const batted = !!bat && (bat.ab > 0 || bat.bb > 0 || bat.hbp > 0);
  const pitched = !!pit && pit.outs > 0;
  const trailing = onStats
    ? <Button size="sm" variant="quiet" iconAfter="chevron-right" onClick={onStats}>All stats</Button>
    : undefined;

  if (isTwoWay(p) ? !batted && !pitched : isPitcher ? !pitched : !batted) {
    return (
      <Card title="This season" eyebrow={String(year)}>
        <p className="pb-text-muted">No games yet. His line starts with his first appearance.</p>
      </Card>
    );
  }

  const batting: StatTileProps[][] = bat && batted && !isPitcher ? [[
    { label: 'Batting average', value: bat.ab > 0 ? pct(battingAverage(bat)) : '—', note: `${bat.h} for ${bat.ab}` },
    { label: 'On-base', value: pct(onBase(bat)), note: plural(bat.bb, 'walk') },
    { label: 'Slugging', value: bat.ab > 0 ? pct(slugging(bat)) : '—', note: plural(bat.d + bat.t + bat.hr, 'extra-base hit') },
  ], [
    { label: 'Home runs', value: bat.hr },
    { label: 'Runs batted in', value: bat.rbi },
    { label: 'Stolen bases', value: bat.sb, note: `in ${plural(bat.sb + bat.cs, 'try', 'tries')}` },
  ]] : [];
  const pitching: StatTileProps[][] = pit && pitched ? [[
    { label: 'Earned run average', value: era(pit).toFixed(2), note: `${pit.w}–${pit.l} record` },
    { label: 'Innings', value: ipText(inningsPitched(pit)), note: pit.gs > 0 ? plural(pit.gs, 'start') : plural(pit.sv, 'save') },
    { label: 'Strikeouts', value: pit.k, note: plural(pit.bb, 'walk') },
  ], [
    { label: 'Walks and hits per inning', value: whip(pit).toFixed(2) },
    { label: 'Games', value: pit.g },
    { label: 'Saves', value: pit.sv },
  ]] : [];

  return (
    <Card title="This season" eyebrow={String(year)} trailing={trailing}>
      {isTwoWay(p) && batting.length > 0 && <span className="pb-eyebrow">At the plate</span>}
      {batting.map((items, i) => <StatGroup key={`b${i}`} size="sm" items={items} />)}
      {isTwoWay(p) && pitching.length > 0 && <span className="pb-eyebrow">On the mound</span>}
      {pitching.map((items, i) => <StatGroup key={`p${i}`} size="sm" items={items} />)}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

/**
 * What he can do, in one scroll of titled cards: what he throws, his ratings
 * at the plate or on the mound, his glove, how he does against each hand, and
 * the habits you have read.
 */
function Ratings(
  { p, isOurs, ownerIndex }: { p: AnyPlayer; isOurs: boolean; ownerIndex: number },
) {
  const isPitcher = p.type === 'pitcher';
  const twoWay = isTwoWay(p);
  const glove: Array<[string, string, number]> = isPitcher
    ? PITCHER_GLOVE.map(([k, l]) => [k, l, (p as Pitcher)[k]])
    : [
      ...HITTER_GLOVE.map(([k, l]) => [k, l, (p as Hitter)[k]] as [string, string, number]),
      ...(p.pos === 'C' ? [[CATCHER_BAR[0], CATCHER_BAR[1], (p as Hitter).blocking] as [string, string, number]] : []),
    ];

  return (
    <>
      {isPitcher && <Repertoire p={p as Pitcher} />}
      <Card title={isPitcher ? 'Pitching' : 'Hitting'} eyebrow={SCALE}>
        {isPitcher
          ? PITCHING.map(([key, label]) => <RatingRow key={key} label={label} value={Math.round((p as Pitcher)[key])} />)
          : HITTING.map(([key, label]) => <RatingRow key={key} label={label} value={Math.round((p as Hitter)[key])} />)}
      </Card>
      {twoWay && (
        <>
          <Repertoire p={p as unknown as Pitcher} />
          <Card title="Pitching" eyebrow={SCALE}>
            {PITCHING.map(([key, label]) => (
              <RatingRow key={key} label={label} value={Math.round((p as unknown as Pitcher)[key])} />
            ))}
          </Card>
        </>
      )}
      <Card
        title="Fielding"
        eyebrow={isPitcher ? 'Off the mound' : `At ${posName(naturalPos(p as Hitter)).toLowerCase()}`}
      >
        {glove.map(([key, label, value]) => <RatingRow key={key} label={label} value={Math.round(value)} />)}
      </Card>
      <Platoon p={p} />
      <Tendencies p={p} isOurs={isOurs} ownerIndex={ownerIndex} />
    </>
  );
}

/**
 * What he throws and how often. The bar is the share of his pitches, and the
 * row says so, with the speed beside it: the old card printed the speed and
 * drew the share, and a 99 mph fastball with a half-empty bar read as a bug.
 */
function Repertoire({ p }: { p: Pitcher }) {
  const rep = repertoireOf(p);
  return (
    <Card title="Pitches" eyebrow={`${p.velocity} mph fastball · each bar is how often he throws it`}>
      {rep.map((o) => {
        const share = Math.round(o.usage * 100);
        return (
          <Meter
            key={o.id}
            size="sm"
            label={PITCHES[o.id].name}
            valueText={`${share}% · ${speedOf(p, o.id)} mph`}
            value={share}
            max={100}
            tone={PITCHES[o.id].family === 'fastball' ? 'accent' : 'ink'}
            ariaValueText={`${share} percent of his pitches`}
          />
        );
      })}
    </Card>
  );
}

/**
 * The platoon split. A hitter's is what he produces against each hand of
 * pitcher; a pitcher's is what he allows to each hand of batter, which is the
 * useful direction from a dugout. The arithmetic is the simulation's own.
 */
function Platoon({ p }: { p: AnyPlayer }) {
  const split = platoonSplit(p);
  const hitter = p.type === 'hitter';
  const switchHitter = hitter && p.bats === 'S';
  const r = split.vsRHP - 1;
  const l = split.vsLHP - 1;
  const flat = Math.abs(r) < 0.0005 && Math.abs(l) < 0.0005;
  const note = (v: number): string => (Math.abs(v) < 0.0005 ? 'No difference'
    : hitter ? (v > 0 ? 'Better than his usual' : 'Worse than his usual')
      : (v > 0 ? 'Allows more than usual' : 'Allows less than usual'));

  return (
    <Card
      title="Against each hand"
      eyebrow={hitter ? 'His production against right- and left-handed pitchers' : 'What he allows to right- and left-handed batters'}
    >
      <StatGroup
        size="sm"
        items={[
          { label: hitter ? 'Right-handed pitchers' : 'Right-handed batters', value: pctSigned(r), note: note(r) },
          { label: hitter ? 'Left-handed pitchers' : 'Left-handed batters', value: pctSigned(l), note: note(l) },
        ]}
      />
      {hitter && split.contact && split.power && (
        <>
          <span className="pb-eyebrow">Against right-handed pitchers</span>
          <RatingRow label="Contact" value={split.contact.vsRHP} />
          <RatingRow label="Power" value={split.power.vsRHP} />
          <span className="pb-eyebrow">Against left-handed pitchers</span>
          <RatingRow label="Contact" value={split.contact.vsLHP} />
          <RatingRow label="Power" value={split.power.vsLHP} />
        </>
      )}
      {switchHitter && <p className="pb-note">Switch hitter: always bats from the better side.</p>}
      {hitter && !switchHitter && p.platoonSkill < 0 && (
        <p className="pb-note">Reverse split: better against his own hand.</p>
      )}
      {!hitter && flat && <p className="pb-note">He pitches to both sides the same.</p>}
    </Card>
  );
}

/** What each tendency is a reading about. */
const SLOT_WORD: Record<TendencyId, string> = {
  approach: 'At the plate',
  firstPitch: 'First pitch',
  running: 'On the bases',
  spray: 'Where he hits it',
  clutch: 'With men on',
  zone: 'In the zone',
  pace: 'Pace',
  mix: 'Pitch mix',
  poise: 'With men on',
};

/**
 * What he does without being told. A tendency can be seen from the other
 * dugout, so unlike badges it is readable on a rival — once you have watched
 * him long enough, or bought the scouting report on his program.
 */
function Tendencies(
  { p, isOurs, ownerIndex }: { p: AnyPlayer; isOurs: boolean; ownerIndex: number },
) {
  const season = useDynasty((s) => s.season);
  const economy = useDynasty((s) => s.economy);
  const scoutsHimself = useDynasty((s) => handles(s.depth, 'scouting'));
  const watch = isOurs ? season?.watch?.get(p.id) : undefined;
  const slots = p.type === 'hitter' ? HITTER_TENDENCIES : PITCHER_TENDENCIES;
  // A casual career's staff brings every report with the wage bill; a full
  // career pays the desk per opponent.
  const scouted = !scoutsHimself
    || (economy.scouted[ownerIndex] ?? -1) >= (season?.dayIndex ?? 0);
  const seen = slots.filter((slot) => isKnown(slot, watch, isOurs, scouted)).length;

  const items: DescriptionItem[] = slots.map((slot) => {
    const spec = TENDENCIES[slot];
    const known = isKnown(slot, watch, isOurs, scouted);
    const label = known ? tendencyLabel(p, slot) : null;
    if (known && label) {
      const text = (tendenciesOf(p)[slot] ?? 0) > 0 ? spec.plusNote : spec.minusNote;
      return { label: SLOT_WORD[slot], value: capsWords(label), note: `${text}.` };
    }
    if (known) return { label: SLOT_WORD[slot], value: 'Nothing unusual', note: 'He does the ordinary thing.' };
    if (isOurs) {
      return {
        label: SLOT_WORD[slot], value: 'Still watching', icon: 'clock',
        note: `${Math.round(watchProgress(slot, watch) * 100)}% of the way to a read`,
      };
    }
    return { label: SLOT_WORD[slot], value: 'No report', icon: 'lock', note: 'Scout his program to read him' };
  });

  return (
    <Card
      title="Tendencies"
      eyebrow={seen === slots.length ? 'What he does without being told' : `${seen} of ${slots.length} read so far`}
      flush
    >
      <DescriptionList items={items} columns={1} />
      {!isOurs && (
        <p className="pb-note">
          {scouted ? 'Your scouting report is active.' : 'Scout his program to see his tendencies.'}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * The years he has played, newest last, with this one marked unfinished. The
 * archive is written in June, so until then the season in progress only lives
 * in the season's books, and it is computed by the same function the archive
 * will use.
 */
function careerYears(
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
 * Years as a table: newest first, three numbers a row, and every column named
 * in the caption. A tap opens the whole line for that year.
 */
function SeasonTable(
  { title, eyebrow, years, live, isPitcher, june = false, note, homeAbbr }:
  {
    title: string; eyebrow?: string; years: CareerYear[]; live: CareerYear | null; isPitcher: boolean;
    /** His program now: a year played there does not repeat the school's name. */
    homeAbbr?: string;
    /** June rows: no glove, which the tournament split never kept. */
    june?: boolean;
    note?: string;
  },
) {
  const season = useDynasty((s) => s.season);
  const [openYear, setOpenYear] = useState<number | null>(null);
  const schoolOf = (abbr: string): string => season?.teams.find((t) => t.def.abbr === abbr)?.def.school ?? abbr;

  const columns: TableColumn[] = isPitcher ? [
    { label: 'Season', grow: true },
    { label: 'W–L', title: 'Wins and losses', width: '48px', align: 'right' },
    { label: 'ERA', title: 'Earned runs allowed per 9 innings', width: '48px', align: 'right', strong: true },
    { label: 'K', title: 'Strikeouts', width: '36px', align: 'right' },
  ] : [
    { label: 'Season', grow: true },
    { label: 'AVG', title: 'Batting average', width: '52px', align: 'right', strong: true },
    { label: 'HR', title: 'Home runs', width: '36px', align: 'right' },
    { label: 'RBI', title: 'Runs batted in', width: '40px', align: 'right' },
  ];

  const rows = [...years].reverse().map((y) => {
    const inProgress = y.year === live?.year;
    const who = (
      <span className="pb-teamcell">
        <span className="pb-teamcell__text">
          <span className="pb-teamcell__name">{y.year}</span>
          <span className="pb-teamcell__sub">
            {classWord(y.classYear)}{y.team !== homeAbbr ? ` · ${schoolOf(y.team)}` : ''}{inProgress ? ' · so far' : ''}
          </span>
        </span>
      </span>
    );
    const cells = isPitcher
      ? [who, `${y.w ?? 0}–${y.l ?? 0}`, y.outs ? ((y.er ?? 0) * 27 / y.outs).toFixed(2) : '—', y.k ?? 0]
      : [who, y.ab ? pct((y.h ?? 0) / y.ab) : '—', y.hr ?? 0, y.rbi ?? 0];
    return { key: y.year, cells, onClick: () => setOpenYear(y.year) };
  });

  const open = years.find((y) => y.year === openYear) ?? null;

  return (
    <Card title={title} eyebrow={eyebrow} flush>
      <Table
        label={title}
        columns={columns}
        rows={rows}
        caption={note}
      />
      {open && (
        <SeasonSheet
          y={open}
          school={schoolOf(open.team)}
          inProgress={open.year === live?.year}
          isPitcher={isPitcher}
          june={june}
          onClose={() => setOpenYear(null)}
        />
      )}
    </Card>
  );
}

/**
 * One year, all of it, in words. Every rate is computed from the counts the
 * record book keeps; the ones it cannot honestly rebuild are not shown.
 */
function SeasonSheet(
  { y, school, inProgress, isPitcher, june, onClose }:
  { y: CareerYear; school: string; inProgress: boolean; isPitcher: boolean; june: boolean; onClose: () => void },
) {
  const ab = y.ab ?? 0; const h = y.h ?? 0; const bb = y.bb ?? 0;
  const d = y.d ?? 0; const t = y.t ?? 0; const hr = y.hr ?? 0;
  const tb = (h - d - t - hr) + 2 * d + 3 * t + 4 * hr;
  const obp = ab + bb > 0 ? (h + bb) / (ab + bb) : 0;
  const slg = ab > 0 ? tb / ab : 0;
  const outs = y.outs ?? 0; const er = y.er ?? 0; const k = y.k ?? 0;
  const ip = `${Math.floor(outs / 3)}.${outs % 3}`;

  const items: DescriptionItem[] = isPitcher ? [
    { label: 'Record', value: `${y.w ?? 0}–${y.l ?? 0}`, note: 'Wins and losses' },
    { label: 'Earned run average', value: outs > 0 ? ((er * 27) / outs).toFixed(2) : '—', note: 'Per 9 innings' },
    { label: 'Innings pitched', value: outs > 0 ? ip : '—' },
    { label: 'Strikeouts', value: String(k) },
    { label: 'Strikeouts per 9 innings', value: outs > 0 ? ((k * 27) / outs).toFixed(1) : '—' },
    ...(june ? [] : [{ label: 'Errors', value: String(y.errors ?? 0) }]),
  ] : [
    { label: 'Batting average', value: ab > 0 ? pct(h / ab) : '—', note: `${h} for ${ab}` },
    { label: 'On-base percentage', value: ab + bb > 0 ? pct(obp) : '—', note: plural(bb, 'walk') },
    { label: 'Slugging percentage', value: ab > 0 ? pct(slg) : '—', note: 'Total bases per at-bat' },
    { label: 'On-base plus slugging', value: ab > 0 ? pct(obp + slg) : '—', note: 'OPS' },
    { label: 'Home runs', value: String(hr) },
    { label: 'Runs batted in', value: String(y.rbi ?? 0) },
    // Kept apart, because they are: the scorer has always counted them
    // separately and a gap hitter and a man who legs out threes are not the
    // same player.
    { label: 'Doubles', value: String(d) },
    { label: 'Triples', value: String(t) },
    { label: 'Stolen bases', value: String(y.sb ?? 0) },
    ...(june ? [] : [
      { label: 'Chances in the field', value: String(y.chances ?? 0) },
      { label: 'Outs made in the field', value: String(y.plays ?? 0) },
      { label: 'Errors', value: String(y.errors ?? 0) },
    ]),
  ];

  return (
    <Sheet
      eyebrow={`${classWord(y.classYear)} · ${school}`}
      title={june ? `${y.year} postseason` : `${y.year} season`}
      subtitle={inProgress ? 'In progress' : undefined}
      onClose={onClose}
    >
      <DescriptionList items={items} />
      {!isPitcher && (
        <p className="pb-note">
          On-base here leaves out sacrifices.
        </p>
      )}
    </Sheet>
  );
}

/** The season-by-season book, at the top of the Stats view. */
function SeasonsUnder(
  { p, owner, isOurs, half }:
  { p: AnyPlayer; owner: Owner; isOurs: boolean; half?: 'bat' | 'arm' },
) {
  const asPitcher = isTwoWay(p) ? half === 'arm' : p.type === 'pitcher';
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  const { years, live } = careerYears(season ?? null, owner.index, p.id, isOurs);
  if (years.length === 0) {
    return (
      <EmptyState
        icon="bar-chart"
        title={isOurs ? 'No seasons yet' : 'Kept for your own players'}
        text={isOurs
          ? 'His first appearance starts the book. Until then, this season lives on the Overview.'
          : 'The season-by-season book is kept for your own program. His numbers this season are on the Overview.'}
      />
    );
  }
  return <SeasonTable title="Season by season" years={years} live={live} isPitcher={asPitcher} homeAbbr={owner.def.abbr} />;
}

/**
 * His Junes, year by year. Season totals include tournament games, so June is
 * counted a second time in its own books and written onto each year's row.
 * Rows from before that split existed have no June of their own; those
 * tournaments live only in one aggregate line, printed underneath when it
 * knows more than the rows do.
 */
function JuneByYear(
  { p, owner, isOurs, half }:
  { p: AnyPlayer; owner: Owner; isOurs: boolean; half?: 'bat' | 'arm' },
) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  const isPitcher = isTwoWay(p) ? half === 'arm' : p.type === 'pitcher';

  const { years, live } = careerYears(season ?? null, owner.index, p.id, isOurs);
  const toRow = (y: CareerYear): CareerYear => ({
    year: y.year, classYear: y.classYear, team: y.team, name: y.name, ...y.june,
  });
  const rows = years.filter((y) => y.june).map(toRow);
  const liveRow = live?.june ? toRow(live) : null;
  const post = season?.careerTotals?.get(p.id)?.post;
  const unrowed = (post?.y ?? 0) - rows.filter((r) => r.year !== liveRow?.year).length;

  if (rows.length === 0 && (post?.y ?? 0) === 0) return null;

  const aggregate = post && unrowed > 0
    ? `${unrowed === 1 ? 'One earlier postseason' : `${unrowed} earlier postseasons`} in one line: ${isPitcher
      ? `${post.w}–${post.l}${post.outs > 0 ? `, ${((post.er * 27) / post.outs).toFixed(2)} ERA` : ''} and ${plural(post.k, 'strikeout')}`
      : `${post.ab > 0 ? pct(post.h / post.ab) : '—'} average with ${plural(post.hr, 'home run')}`}.`
    : undefined;

  if (rows.length === 0) {
    return (
      <Card title="Postseason">
        <p className="pb-text">{aggregate}</p>
      </Card>
    );
  }
  return (
    <SeasonTable
      title="Postseason"
      years={rows}
      homeAbbr={owner.def.abbr}
      live={liveRow}
      isPitcher={isPitcher}
      june
      note={aggregate}
    />
  );
}

/**
 * Every game he has appeared in this year, newest first. Box scores are kept
 * for your own program only and cleared when the season rolls, so a rival has
 * no log and yours covers the year in progress.
 */
function Games(
  { id, owner, isOurs, half }:
  { id: PlayerId; owner: Owner; isOurs: boolean; half?: 'bat' | 'arm' },
) {
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  const [all, setAll] = useState(false);
  void version;

  if (!season || !isOurs) return null;
  const rows = gameLogFor(season, id, owner.index, half).reverse();
  const schoolOf = (abbr: string): string => season.teams.find((t) => t.def.abbr === abbr)?.def.school ?? abbr;

  if (rows.length === 0) {
    return (
      <Card title="Game log" eyebrow={String(year)}>
        <p className="pb-text-muted">No appearances yet.</p>
      </Card>
    );
  }

  const shown = all ? rows : rows.slice(0, 10);
  return (
    <Card
      title="Game log"
      eyebrow={plural(rows.length, 'game')}
      flush
      footer={(
        <>
          {rows.length > shown.length && (
            <Button size="sm" variant="secondary" block onClick={() => setAll(true)}>
              Show all {rows.length} games
            </Button>
          )}
        </>
      )}
    >
      <List className="pb-list--inset" label="Game log">
        {shown.map((r) => {
          const when = shortDate(year, r.day);
          return (
            <GameRow
              key={r.day}
              day={when.weekday}
              date={when.date}
              opponent={schoolOf(r.opponent)}
              abbr={r.opponent}
              home={r.home}
              kind={`${r.slot === 'SUB' ? 'Bench' : r.slot === 'PH' ? 'Two-way' : r.slot} · ${r.line}`}
              result={{ win: r.won, score: `${r.us}–${r.them}` }}
            />
          );
        })}
      </List>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Career
// ---------------------------------------------------------------------------

/**
 * The nights he is remembered by: one per kind of night, the best of it —
 * the biggest number, then a June night over a regular one, then the later.
 */
function SignatureMoments({ id }: { id: string }) {
  const season = useDynasty((s) => s.season);
  const moments = season?.moments?.[id] ?? [];
  if (moments.length === 0) return null;

  const magnitude = (m: Moment): number => Number(m.line.match(/\d+/)?.[0] ?? 0);
  const best = new Map<Moment['kind'], Moment>();
  for (const m of moments) {
    const cur = best.get(m.kind);
    if (!cur) { best.set(m.kind, m); continue; }
    const keep =
      magnitude(m) !== magnitude(cur) ? magnitude(m) > magnitude(cur)
      : (m.postseason ?? false) !== (cur.postseason ?? false) ? (m.postseason ?? false)
      : m.year !== cur.year ? m.year > cur.year
      : m.day > cur.day;
    if (keep) best.set(m.kind, m);
  }
  const shown = [...best.values()].sort((a, b) => b.year - a.year || b.day - a.day);

  return (
    <Card title="Signature moments" eyebrow={shown.length === 1 ? 'His best night' : `His ${shown.length} best nights`} flush>
      <List className="pb-list--inset" label="Signature moments">
        {shown.map((m, i) => (
          <ListRow
            key={`${m.year}-${m.day}-${i}`}
            icon={m.postseason ? 'star-filled' : 'star'}
            title={schoolNamesIn(m.line, season?.teams ?? [])}
            subtitle={m.postseason ? `${m.year} · Postseason` : String(m.year)}
          />
        ))}
      </List>
    </Card>
  );
}

/**
 * Every award the book has his name on, newest first: the dynasty's archive,
 * and the season in progress read live once it is complete.
 */
function useAwardsWon(id: PlayerId): { year: number; title: string }[] {
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

function AwardCase({ id }: { id: PlayerId }) {
  const won = useAwardsWon(id);
  if (won.length === 0) return null;
  return (
    <Card title="Honors" eyebrow={plural(won.length, 'award')} flush>
      <List className="pb-list--inset" label="Honors">
        {won.map((w) => (
          <ListRow key={`${w.year}-${w.title}`} lead={<Medal metal="gold" size={32} />} title={w.title} subtitle={String(w.year)} />
        ))}
      </List>
    </Card>
  );
}

/**
 * The marks a career is remembered by — his best year and his totals, over the
 * same rows the Stats view prints — then his nights and his honors.
 */
function Career(
  { id, owner, isPitcher, isOurs }:
  { id: PlayerId; owner: Owner; isPitcher: boolean; isOurs: boolean },
) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  const { years } = careerYears(season, owner.index, id, isOurs);

  if (years.length === 0) {
    return (
      <EmptyState
        icon="archive"
        title={isOurs ? 'Nothing yet' : 'Kept for your own players'}
        text={isOurs
          ? 'He has not played a game. His career record starts with his first one.'
          : 'The career record is kept for your own program only.'}
      />
    );
  }

  const best = years.reduce((a, y) => {
    const score = isPitcher
      ? (y.outs ? -((y.er ?? 0) * 27) / y.outs : -99)
      : (y.ab ? (y.h ?? 0) / y.ab : 0);
    return score > a.score ? { y, score } : a;
  }, { y: years[0]!, score: -999 }).y;

  const totals = years.reduce((a, y) => ({
    h: a.h + (y.h ?? 0), ab: a.ab + (y.ab ?? 0), hr: a.hr + (y.hr ?? 0),
    k: a.k + (y.k ?? 0), er: a.er + (y.er ?? 0), outs: a.outs + (y.outs ?? 0),
    w: a.w + (y.w ?? 0), l: a.l + (y.l ?? 0),
  }), { h: 0, ab: 0, hr: 0, k: 0, er: 0, outs: 0, w: 0, l: 0 });

  return (
    <>
      <Card title="Career" eyebrow={`${plural(years.length, 'season')} on record`}>
        <StatGroup
          size="sm"
          items={isPitcher ? [
            { label: 'Best ERA', value: best.outs ? ((best.er ?? 0) * 27 / best.outs).toFixed(2) : '—', note: String(best.year) },
            { label: 'Career ERA', value: totals.outs ? (totals.er * 27 / totals.outs).toFixed(2) : '—', note: `${totals.w}–${totals.l} record` },
            { label: 'Strikeouts', value: totals.k, note: 'In his career' },
          ] : [
            { label: 'Best average', value: best.ab ? pct((best.h ?? 0) / best.ab) : '—', note: String(best.year) },
            { label: 'Career average', value: totals.ab ? pct(totals.h / totals.ab) : '—', note: `${totals.h} for ${totals.ab}` },
            { label: 'Home runs', value: totals.hr, note: 'In his career' },
          ]}
        />
      </Card>
      <SignatureMoments id={id} />
      <AwardCase id={id} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Alumnus
// ---------------------------------------------------------------------------

/** "SEASON HOME RUNS" from the record book, as "Season record: home runs". */
function markWords(mark: string): string {
  const [prefix = '', ...rest] = mark.split(' ');
  const kind = prefix === 'GAME' ? 'Single-game' : sentence(prefix.toLowerCase());
  return `${kind} record: ${rest.join(' ').toLowerCase()}`;
}

/**
 * A player who has left. The ratings and this season's line went with his
 * roster spot; what is left is how he left, what he did here, and what came
 * after, which is still being written for a man in the pros.
 */
function Alumnus(
  { id, gone, note, career, view, onView }:
  {
    id: PlayerId;
    gone: Departure | undefined;
    note: AlumnusNote | undefined;
    career: CareerYear[];
    view: View;
    onView: (v: View) => void;
  },
) {
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const last = career[career.length - 1];
  // A departure notice survives one offseason; the book writes his name on
  // every row since ids stopped being names. Newest mechanism first.
  const name = gone?.name ?? note?.name ?? (career.length > 0 ? careerName(id, career) : 'Former player');
  const abbr = gone?.teamAbbr ?? note?.teamAbbr ?? last?.team ?? '';
  const classYear = gone?.classYear ?? note?.classYear ?? last?.classYear ?? '—';
  const reason = gone?.reason ?? note?.reason;
  const drafted = reason === 'drafted';
  const round = gone?.round ?? note?.round;
  const overall = gone?.overall ?? note?.overall;
  // A walk-on did not graduate and was not drafted: his one season was up.
  const walkedOn = reason === 'walk-on';
  const school = season?.teams.find((t) => t.def.abbr === abbr)?.def.school ?? abbr;

  const wasPitcher = career.some((y) => (y.outs ?? 0) > 0) || !career.some((y) => (y.ab ?? 0) > 0);
  const active: View = view === 'career' ? 'career' : 'overview';

  // What he did here, totalled. School rows only: a transfer's other college
  // is his record, not ours.
  const schoolYears = abbr ? career.filter((y) => y.team === abbr) : career;
  const summary = collegeSummary(schoolYears);
  const role = summary.hitting && summary.pitching ? 'Two-way player'
    : summary.pitching ? 'Pitcher' : summary.hitting ? 'Hitter' : '';
  const span = summary.first ? `${summary.first}–${summary.last}` : '';

  const hall = season?.hall?.find((m) => String(m.id) === id);
  const marks = season ? marksHeldBy(season, id) : [];
  const pro = note ? proCareer(id, note, year) : [];
  const showYears = pro.filter((r) => r.level === 'THE SHOW').length;
  const current = pro[pro.length - 1];
  const [half, setHalf] = useState<'bat' | 'arm'>(wasPitcher ? 'arm' : 'bat');
  const twoWay = summary.hitting && summary.pitching;

  // The cabinet, grouped: three All-Conference selections are one tag with a
  // count, not three tags saying the same thing.
  const honours: { title: string; count: number; year: number }[] = [];
  for (const w of useAwardsWon(id)) {
    const h = honours.find((x) => x.title === w.title);
    if (h) { h.count += 1; h.year = Math.max(h.year, w.year); }
    else honours.push({ title: w.title, count: 1, year: w.year });
  }

  const left = (gone || note)
    ? (drafted ? `Drafted${round !== undefined ? ` in round ${round}` : ''}`
      : walkedOn ? 'Walk-on, his year was up' : 'Graduated')
    : 'Left the program';

  const headline = showYears > 0 ? `${plural(showYears, 'season')} in The Show`
    : current?.level === COACHING_LEVEL ? 'Coaching now'
      : current ? `Now: ${proLevelName(current.level)}`
        : drafted ? 'His professional career starts next season' : 'His playing career ended in June';
  const over = pro.some((r) => r.final);

  const totals: StatTileProps[] = [
    ...(summary.hitting ? [
      { label: 'Batting average', value: summary.average },
      { label: 'Home runs', value: summary.hr },
      { label: 'Runs batted in', value: summary.rbi },
    ] : []),
    ...(summary.pitching ? [
      { label: 'Earned run average', value: summary.era },
      { label: 'Strikeouts', value: summary.k },
      { label: 'Innings', value: summary.innings },
    ] : []),
  ];

  return (
    <main className="pb-page pb-playercard">
      <ProfileHeader
        media={<Face id={id} team={abbr || undefined} size={80} />}
        eyebrow={school ? `${school} · Alumnus` : 'Alumnus'}
        name={name}
        meta={[role, span].filter(Boolean).join(' · ') || 'College career archive'}
        tags={(
          <>
            <StatusBadge tone={drafted ? 'positive' : 'neutral'} icon={false}>{left}</StatusBadge>
            {hall && <Tag tone="positive">Hall of Fame · {hall.year}</Tag>}
            {marks.map((mark) => <Tag key={mark} tone="positive">{markWords(mark)}</Tag>)}
            {honours.map((h) => (
              <Tag key={h.title}>{h.count > 1 ? `${h.title} ×${h.count}` : `${h.title} · ${h.year}`}</Tag>
            ))}
          </>
        )}
      />
      {totals.length > 0 && (
        <Card title="Here" eyebrow={school ? `His totals at ${school}` : 'His college totals'}>
          <StatGroup size="sm" items={totals} />
        </Card>
      )}
      <SegmentedControl<'overview' | 'career'>
        label="Alumnus card"
        value={active === 'career' ? 'career' : 'overview'}
        onChange={(v) => onView(v)}
        options={[
          { value: 'overview', label: 'After college' },
          { value: 'career', label: 'College seasons' },
        ]}
      />

      {active === 'overview' && (
        <>
          {!summary.hitting && !summary.pitching && (
            <p className="pb-text-muted">The record book was not keeping statistics while he was here.</p>
          )}
          {pro.length > 0 && note ? (
            <Card
              title={headline}
              eyebrow={note.reason === 'drafted' ? `Life after college · drafted in round ${note.round ?? '?'}, ${note.year}` : 'Life after college'}
              flush
              footer={!over && note.reason === 'drafted'
                ? <span className="pb-note">Still playing. A new line is added every June.</span>
                : undefined}
            >
              <List className="pb-list--inset" label="Professional career">
                {pro.map((r) => (
                  <ListRow key={r.year} title={proLevelName(r.level)} subtitle={`${r.year} · ${r.line}`} />
                ))}
              </List>
            </Card>
          ) : (
            <Card title={headline} eyebrow="Life after college" />
          )}
          <Card title="Background">
            <DescriptionList
              items={[
                { label: 'Last class', value: classWord(classYear) },
                ...(overall !== undefined ? [{ label: 'Rating when he left', value: String(overall) }] : []),
                // The book keeps no age, so this is only known while the
                // departure notice survives: one offseason.
                ...(gone?.age !== undefined ? [{ label: 'Age when he left', value: String(gone.age) }] : []),
              ]}
            />
          </Card>
        </>
      )}

      {active === 'career' && (
        <>
          {twoWay && (
            <Chips label="Career half">
              <Chip selected={half === 'bat'} onClick={() => setHalf('bat')}>Batting</Chip>
              <Chip selected={half === 'arm'} onClick={() => setHalf('arm')}>Pitching</Chip>
            </Chips>
          )}
          <SignatureMoments id={id} />
          {career.length === 0 ? (
            <EmptyState
              icon="archive"
              title="No seasons on record"
              text="He left before the book was keeping years, or he never played one."
            />
          ) : (
            <SeasonTable
              title="College seasons"
              years={career}
              live={null}
              isPitcher={twoWay ? half === 'arm' : wasPitcher}
            />
          )}
        </>
      )}
    </main>
  );
}

function Nobody() {
  return (
    <main className="pb-page">
      <EmptyState icon="person" title="No player selected" text="Tap a name on the roster." />
    </main>
  );
}
