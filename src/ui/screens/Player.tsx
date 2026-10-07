// Player.tsx
// One player's card.
//
// The top of it is the hub (PlayerHub.tsx): who he is with his Rating and,
// for your own men, his Potential; four facts at a glance; what you owe him;
// and five rows into the rest of him — Ratings, This season, Badges,
// Positions and Career. A row opens its page one level deeper inside the
// card, and the bar's way back then names him and returns to the top (the UI
// clarity review, 2026-09-25, variant "A · Glance + hub"). Those pages are
// this file, and each holds what one of the old card's tabs held. Your own
// men keep their Decisions at the bottom of the top: every decision in plain
// sight, with what it costs.
//
// Another program's player shows what a box score and a scouting report would
// tell you, and says what it withholds: his potential, mood and promises stay
// with his program.
//
// A man who has left (graduated, drafted, a walk-on whose year was up) opens
// as an alumnus card: how he left, what he did here, and what came after.

import { useLayoutEffect, useRef, useState } from 'react';
import { RosterMoves } from './RosterMoves.js';
import {
  CardHeader, Glance, MoreAboutHim, PromiseTracker, careerYears, classWord, posName, useAwardsWon,
  type Owner, type Section,
} from './PlayerHub.js';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { BADGES, TIER_NAME, badgeCap, badgesOf } from '../../engine/badges.js';
import { PITCHES, repertoireOf, speedOf } from '../../engine/pitches.js';
import {
  HITTER_TENDENCIES, PITCHER_TENDENCIES, TENDENCIES, isKnown, tendenciesOf,
  tendencyLabel, watchProgress, type TendencyId,
} from '../../engine/tendencies.js';
import { promiseSpent } from '../../engine/morale.js';
import { overallOf, platoonSplit, naturalPos } from '../../engine/ratings.js';
import { coverTier, fieldingAt, retrainOdds, retrainablePositions } from '../../engine/positions.js';
import { BadgeEmblem } from '../BadgeEmblem.js';
import { SCOUTING } from '../../state/features.js';
import { AwardEmblem } from '../Honours.js';
import { PROJECT_ATTRIBUTE, seasonEach, seasonGainOn } from '../../engine/staffProjects.js';
import { PROJECT_LABEL, staffPlan } from '../../engine/economy.js';
import { handles } from '../../state/depth.js';
import { proCareer, COACHING_LEVEL, type AlumnusNote, type Moment } from '../../engine/legacy.js';
import { collegeSummary, marksHeldBy } from '../ProgramBits.js';
import {
  battingAverage, onBase, slugging, era, whip, inningsPitched, careerName,
} from '../../engine/season.js';
import type { BoxScore, CareerYear, SeasonState } from '../../engine/season.js';
import type { Departure } from '../../engine/progression.js';
import { pct, ipText, shortDate } from '../format.js';
import { isTwoWay } from '../../engine/types.js';
import type {
  Hitter, Pitcher, PlayerId, Position, Player as AnyPlayer,
} from '../../engine/types.js';
import {
  Button, Callout, Card, Chip, Chips, ConfirmButton, DescriptionList, EmptyState, Face, GameRow, List,
  ListRow, Meter, ProfileHeader, RatingRow, SegmentedControl, Sheet, StatGroup, StatusBadge, Table, Tag,
  type DescriptionItem, type StatTileProps, type TableColumn,
} from '../components/ui/index.js';
import { useOverlayBack } from '../Overlay.js';
import { useBackLayer } from '../useBackLayer.js';
import {
  capsWords, plural, proLevelName, schoolNamesIn, sentence,
} from '../words.js';

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

/**
 * What every rating card says about the numbers on it: the review's caption.
 * Measured before it was written (seed 4242, 2026-09-25): contact, power,
 * eye, speed, stuff, movement and control all average 48 to 50 across a new
 * league, so the hairline at 50 on every bar is the league's middle.
 */
const SCALE = 'Of 100 · league average 50';

/*
  The ratings that grow. A winter moves every one of these by the same step
  toward his potential (`develop` in development.ts); a pitcher's ground-ball
  lean and his pickoff move never move, so they are drawn with no room.
*/
const GROWS: ReadonlySet<string> = new Set([
  'contact', 'power', 'eye', 'speed', 'steal', 'bunt', 'range', 'hands', 'arm', 'armAccuracy',
  'blocking', 'stuff', 'movement', 'control', 'stamina',
]);

/** A production change, signed, so a reverse split reads as one. */
const pctSigned = (v: number): string => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`;

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

// ---------------------------------------------------------------------------

type PortalState = ReturnType<typeof useDynasty.getState>['portal'];
type PortalEntry = NonNullable<PortalState>['leaving'][number];

/**
 * Look across the whole world, not just this roster: a leaderboard is full of
 * players you do not employ and would still like to read about. A portal
 * entrant is between rosters in the offseason; his card stays attached to the
 * program he is leaving.
 */
function findHim(
  season: SeasonState, team: Owner, selected: PlayerId, portal: PortalState,
): { p: AnyPlayer; owner: Owner; portalEntry?: PortalEntry } | null {
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
  if (!p && portalEntry) {
    p = portalEntry.player;
    owner = season.teams[portalEntry.from] ?? team;
  }
  // A drafted man still waiting on your answer is off the roster and on the
  // board, and yours until he signs: his own card, not the alumnus page of a
  // man who has gone (2026-09-26, the draft's cards open him).
  if (!p) {
    const waiting = season.draft?.men.find((m) => m.player.id === selected && m.outcome === 'pending');
    if (waiting) { p = waiting.player; owner = team; }
  }
  return p ? { p, owner, portalEntry } : null;
}

/**
 * The screen the card was opened over, by the name on its tab ("Roster"), for
 * the bar's way back — when the card sits straight on that screen. Anything
 * laid in between (a school's page, a room, the inbox, a sheet) is where Back
 * goes instead, so the bar keeps its plain "Back" for those. Read once, as the
 * card opens: nothing under a card changes while it is up.
 */
function screenUnderneath(): string | null {
  if (typeof document === 'undefined') return null;
  const frame = document.querySelector('.app-frame');
  if (!frame) return null;
  if (frame.querySelector('.pb-fulloverlay:not(.is-player), .pb-tableoverlay, .pb-sheet-host')) return null;
  const word = frame.querySelector<HTMLElement>('.pb-toptabs button.is-active')?.textContent?.trim();
  return word ? word : null;
}

export function Player() {
  const season = useDynasty((s) => s.season);
  const selected = useDynasty((s) => s.selectedPlayer);
  const playerCardSection = useDynasty((s) => s.playerCardSection);
  const report = useDynasty((s) => s.lastOffseason);
  const portal = useDynasty((s) => s.portal);
  const alumni = useDynasty((s) => s.alumni);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  // The card always opens at its top: the whole profile. The lineup's hold
  // asks for his stats as well, and gets them at the top of that profile
  // rather than a stats page on its own (reported 2026-10-07: "it only shows
  // a bit of the player's card"). Back from the top closes the card, so the
  // hold is one back from the lineup, as it was.
  const [section, setSection] = useState<Section | null>(null);
  const [withStats] = useState(playerCardSection === 'stats');
  const [half, setHalf] = useState<'bat' | 'arm'>('bat');
  const [returnsTo] = useState(screenUnderneath);
  const pageRef = useRef<HTMLElement | null>(null);
  const hubTop = useRef(0);
  void version;

  const found = season && team && selected ? findHim(season, team, selected, portal) : null;
  // You only scout your own program in full.
  const isOurs = found !== null && team !== null && found.owner.index === team.index;
  // A page is only ever one this man has: badges are known about your own
  // men alone, and a pitcher has no positions to learn.
  const deeper: Section | null = found && section
    && (section !== 'badges' || isOurs)
    && (section !== 'positions' || found.p.type === 'hitter')
    ? section : null;

  // One level down from his card's top, the bar names him and goes back up to
  // it; at the top it closes the card,
  // named for the screen it returns to when known.
  const fromTop = deeper !== null;
  useOverlayBack(found && fromTop
    ? { label: found.p.name, onBack: () => setSection(null) }
    : returnsTo ? { label: returnsTo } : null);
  // The back gesture takes the same step: a page first, then the card.
  useBackLayer(fromTop, () => setSection(null));
  // A page opens at its top; the card's top comes back where it was left.
  useLayoutEffect(() => {
    const scroller = pageRef.current?.closest<HTMLElement>('.pb-fulloverlay__scroll');
    if (scroller) scroller.scrollTop = deeper === null ? hubTop.current : 0;
  }, [deeper]);
  const open = (s: Section): void => {
    hubTop.current = pageRef.current?.closest<HTMLElement>('.pb-fulloverlay__scroll')?.scrollTop ?? 0;
    setSection(s);
  };

  if (!season || !team || !selected) return <Nobody />;

  // Nobody's roster, and a real player rather than a bad id: a draftee, a
  // graduate, an award winner from years ago. What is left of him is how he
  // left and the record book.
  if (!found) {
    const gone = [...(report?.graduated ?? []), ...(report?.drafted ?? [])]
      .find((d) => d.id === selected);
    const career = season.careers?.[selected] ?? [];
    const note = alumni[selected];
    if (!gone && career.length === 0 && !note) return <Nobody />;
    return <Alumnus id={selected} gone={gone} note={note} career={career} />;
  }

  const { p, owner, portalEntry } = found;
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

  return (
    <main ref={pageRef} className="pb-page pb-playercard pb-pcard">
      <CardHeader
        p={p}
        owner={owner}
        isOurs={isOurs}
        own={own}
        homeRole={homeRole}
        dhToday={dhToday}
        covering={covering}
      />

      {deeper === null ? (
        <>
          {portalEntry && (
            <Callout tone="info" icon="enter" title={`In the transfer portal, from ${portalEntry.fromName}`}>
              {portalEntry.reason}
            </Callout>
          )}
          {withStats && (
            <>
              {twoWay && (
                <Chips label="Which half of his game">
                  <Chip selected={half === 'bat'} onClick={() => setHalf('bat')}>Batting</Chip>
                  <Chip selected={half === 'arm'} onClick={() => setHalf('arm')}>Pitching</Chip>
                </Chips>
              )}
              <ThisSeason p={p} half={half} />
            </>
          )}
          <Glance p={p} owner={owner} isOurs={isOurs} portalReason={isOurs ? portalEntry?.reason : undefined} />
          {!isOurs && (
            <Callout tone="neutral" icon="lock">His potential, mood and promises stay with his program.</Callout>
          )}
          {isOurs && <PromiseTracker p={p} owner={owner} />}
          <MoreAboutHim p={p} owner={owner} isOurs={isOurs} own={own} onOpen={open} />
          <RosterMoves p={p} isOurs={isOurs} />
        </>
      ) : (
        <>
          {twoWay && (deeper === 'season' || deeper === 'career') && (
            <Chips label="Which half of his game">
              <Chip selected={half === 'bat'} onClick={() => setHalf('bat')}>Batting</Chip>
              <Chip selected={half === 'arm'} onClick={() => setHalf('arm')}>Pitching</Chip>
            </Chips>
          )}
          {deeper === 'ratings' && <Ratings p={p} isOurs={isOurs} ownerIndex={owner.index} />}
          {deeper === 'season' && (
            <>
              <ThisSeason p={p} half={half} />
              <Games id={p.id} owner={owner} isOurs={isOurs} half={twoWay ? half : undefined} />
            </>
          )}
          {deeper === 'badges' && <BadgesCard p={p} />}
          {deeper === 'positions' && <Positions p={p as Hitter} isOurs={isOurs} own={own} />}
          {deeper === 'career' && <Career p={p} owner={owner} isOurs={isOurs} half={half} />}
        </>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// The top of the card, for your own men
// ---------------------------------------------------------------------------

/** The staff's work on this man: running, or the last result. */
export function ProjectNote({ p, economy }: { p: AnyPlayer; economy: ReturnType<typeof useDynasty.getState>['economy'] }) {
  const id = String(p.id);
  const seats = ['hitting', 'pitching'] as const;
  const live = seats
    .map((seat) => ({ seat, plan: staffPlan(economy, seat) }))
    .find(({ plan: { project } }) => (project?.season ? !!project.targetIds?.includes(id) : project?.playerId === id));
  const running = live?.plan.project;
  if (live && running?.season) {
    // Season work (2026-09-28): what he stands to take at season's end, as the focus stands.
    const coach = economy.staff[live.seat]?.name ?? 'The staff';
    const g = seasonGainOn(p, running.kind, seasonEach(economy, live.seat, running, live.plan.directive));
    return (
      <Callout tone="info" icon="timer" title={`Season work: ${PROJECT_ATTRIBUTE[running.kind].toLowerCase()}`}>
        {coach} has him · +{g} at season&rsquo;s end.
      </Callout>
    );
  }
  if (live && running) {
    const coach = economy.staff[live.seat]?.name ?? 'The staff';
    const chance = Math.round((running.odds ?? 0) * 100);
    return (
      <Callout tone="info" icon="timer" title={`Coach's project: ${PROJECT_ATTRIBUTE[running.kind].toLowerCase()}`}>
        {coach} has him for {plural(running.weeksLeft, 'more week')} · {chance}% chance it takes.
      </Callout>
    );
  }
  const last = (economy.projectHistory ?? []).find((r) => r.changes.some((c) => c.id === id));
  const c = last?.changes.find((x) => x.id === id);
  if (!last || !c) return null;
  const coach = (typeof last.coach === 'string' ? last.coach : undefined) ?? economy.staff[last.seat]?.name ?? 'the staff';
  if (last.season === true) {
    const b = Math.round(c.before);
    const a = Math.round(c.after);
    const title = `Season work: ${c.attribute.toLowerCase()}`;
    if (a - b > 0) {
      return (
        <Callout tone="positive" title={title}>
          {c.attribute} {b} → {a} under {coach} in {last.year}.
        </Callout>
      );
    }
    // A zero is his ceiling only when the work paid something: a late start can round to nothing.
    const paid = typeof last.gain !== 'number' || last.gain > 0;
    return (
      <Callout tone="neutral" icon="info" title={title}>
        {paid ? `At his ceiling in ${last.year}.` : `Too few weeks in ${last.year}.`} Nothing added.
      </Callout>
    );
  }
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
              lead={<BadgeEmblem id={b.id} tier={b.tier} size={36} />}
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
 * Where he plays and where a winter could take him: his own spot, then every
 * spot he could learn with the two numbers a coach weighs — how he would rate
 * there today, and the chance the move sticks. The list the Position decision
 * opens as a sheet (RetrainModal.tsx), laid on the page, and on your own man
 * the moves are made from here too, with the same two presses and the same
 * store action: the move is permanent. In the winter it is made at once;
 * during the season it is written down for the roll and can be taken back
 * until then.
 */
function Positions({ p, isOurs, own }: { p: Hitter; isOurs: boolean; own: string }) {
  const changePosition = useDynasty((s) => s.changePosition);
  const winter = useDynasty((s) => s.phase) !== null;
  // A plan written on the man re-renders the page through the version.
  const version = useDynasty((s) => s.version);
  void version;
  const planned = (p as Hitter & { retrainTo?: Position }).retrainTo;
  const promise = !promiseSpent(p.recruitPromise) ? p.recruitPromise : undefined;
  const promisedPos = promise?.kind === 'keepPosition' ? promise.promisedPos : undefined;
  // Measured from his own spot, which for a bat-first man is where his glove
  // says he is: the DH is a lineup slot, and the header names him the same
  // way. Never from tonight's label, which a cover or the DH has overwritten.
  const home = own as Position;
  const man: Hitter = home === p.pos ? p : { ...p, pos: home };
  const spots = retrainablePositions(man);

  const how = !isOurs
    ? 'What a winter could make of him, if he were yours to move.'
    : winter
      ? 'A move is permanent. He learns the new spot over the winter and opens next season there, a step behind until it takes.'
      : planned
        ? `Planned: he finishes the season at ${posName(home).toLowerCase()} and moves to ${posName(planned).toLowerCase()} when it ends. You can cancel or change the plan until then.`
        : 'A move is permanent. Choose now and it happens when the season ends: he learns the new spot over the winter.';

  return (
    <Card title="Positions" flush>
      <List className="pb-list--inset" label="Positions he could play">
        <ListRow
          icon="check-circled"
          title={posName(home)}
          subtitle={`His own spot · rating there ${overallOf(man)}`}
          status={<Tag>Current</Tag>}
        />
        {spots.map((spot) => {
          const odds = Math.round(retrainOdds(man, spot) * 100);
          const tier = coverTier(man, spot);
          const plays = overallOf(fieldingAt(man, spot));
          const breaks = promisedPos !== undefined && spot !== promisedPos;
          const isPlan = planned === spot;
          return (
            <ListRow
              key={spot}
              icon="swap"
              markTone={tier >= 2 ? 'warning' : undefined}
              title={posName(spot)}
              subtitle={`Rating there today: ${plays} · Chance it sticks: ${odds}%`}
              status={(
                <>
                  <Tag tone={tier >= 2 ? 'warning' : undefined}>{tier === 1 ? 'Natural cover' : 'A stretch'}</Tag>
                  {isPlan && <StatusBadge tone="info" icon="calendar">Planned for the offseason</StatusBadge>}
                  {breaks && <StatusBadge tone="warning">Breaks your position promise</StatusBadge>}
                </>
              )}
            >
              {isOurs && (winter ? (
                <ConfirmButton
                  size="sm"
                  variant={breaks ? 'danger' : 'secondary'}
                  idle={`Move to ${posName(spot).toLowerCase()}`}
                  armed="Tap again to move him"
                  armedMeta="Permanent"
                  onConfirm={() => changePosition(p.id, spot)}
                />
              ) : isPlan ? (
                <Button size="sm" variant="quiet" icon="cross" onClick={() => changePosition(p.id, spot)}>
                  Cancel the plan
                </Button>
              ) : (
                <ConfirmButton
                  size="sm"
                  variant={breaks ? 'danger' : 'secondary'}
                  idle="Move at season's end"
                  armed="Tap again to plan the move"
                  armedMeta={planned ? `Replaces ${posName(planned).toLowerCase()}` : 'Permanent'}
                  onConfirm={() => changePosition(p.id, spot)}
                />
              ))}
            </ListRow>
          );
        })}
        {isTwoWay(p) && (
          <ListRow icon="target" title={posName(p.role)} subtitle="His role on the mound" status={<Tag>Two-way</Tag>} />
        )}
      </List>
      {spots.length === 0 && (
        <p className="pb-note">There is no realistic spot for him to learn.</p>
      )}
      <p className="pb-note">{how}</p>
    </Card>
  );
}

/**
 * This year's line, named. A walk is an appearance: gating on at-bats alone
 * told a pinch hitter with two walks that he had not played.
 *
 * A two-way man's card shows one half at a time, the half the chips above
 * picked, the way his game log and his career do (2026-09-26: "instead of
 * keeping it separated with the sub tabs buttons it keeps it all in one
 * singular list"). And the whole line, doubles and triples each on their own:
 * the scorer counts them apart, and a gap hitter and a man who legs out
 * triples are not the same player.
 */
function ThisSeason({ p, half }: { p: AnyPlayer; half: 'bat' | 'arm' }) {
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  void version;
  const twoWay = isTwoWay(p);
  const asPitcher = twoWay ? half === 'arm' : p.type === 'pitcher';
  const bat = season?.batting.get(p.id);
  const pit = season?.pitching.get(p.id);
  const batted = !!bat && (bat.ab > 0 || bat.bb > 0 || bat.hbp > 0);
  const pitched = !!pit && pit.outs > 0;

  if (asPitcher ? !pitched : !batted) {
    return (
      <Card title="This season" eyebrow={String(year)}>
        <p className="pb-text-muted">
          {twoWay
            ? (asPitcher ? 'No innings yet this season.' : 'No at-bats yet this season.')
            : 'No games yet. His line starts with his first appearance.'}
        </p>
      </Card>
    );
  }

  const rows: StatTileProps[][] = !asPitcher && bat ? [[
    { label: 'Batting average', value: bat.ab > 0 ? pct(battingAverage(bat)) : '—', note: `${bat.h} for ${bat.ab}` },
    { label: 'On-base', value: pct(onBase(bat)), note: plural(bat.bb, 'walk') },
    { label: 'Slugging', value: bat.ab > 0 ? pct(slugging(bat)) : '—', note: bat.ab > 0 ? `${pct(onBase(bat) + slugging(bat))} OPS` : undefined },
  ], [
    { label: 'Doubles', value: bat.d },
    { label: 'Triples', value: bat.t },
    { label: 'Home runs', value: bat.hr },
  ], [
    { label: 'Runs', value: bat.r },
    { label: 'Runs batted in', value: bat.rbi },
    { label: 'Stolen bases', value: bat.sb, note: `in ${plural(bat.sb + bat.cs, 'try', 'tries')}` },
  ], [
    { label: 'Walks', value: bat.bb },
    { label: 'Strikeouts', value: bat.k },
    { label: 'Games', value: bat.g },
  ]] : asPitcher && pit ? [[
    { label: 'Earned run average', value: era(pit).toFixed(2), note: `${pit.w}–${pit.l} record` },
    { label: 'Innings', value: ipText(inningsPitched(pit)), note: pit.gs > 0 ? plural(pit.gs, 'start') : plural(pit.sv, 'save') },
    { label: 'Strikeouts', value: pit.k, note: plural(pit.bb, 'walk') },
  ], [
    { label: 'Walks and hits per inning', value: whip(pit).toFixed(2) },
    { label: 'Hits allowed', value: pit.h },
    { label: 'Home runs allowed', value: pit.hr },
  ], [
    { label: 'Games', value: pit.g },
    { label: 'Saves', value: pit.sv },
    { label: 'Strikeouts per 9', value: pit.outs > 0 ? ((pit.k * 27) / pit.outs).toFixed(1) : '—' },
  ]] : [];

  return (
    <Card title="This season" eyebrow={String(year)}>
      {rows.map((items, i) => <StatGroup key={i} size="sm" items={items} />)}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

/**
 * One rating on its bar, the review's way: the fill is where he is, a striped
 * run past it is the room his potential leaves, a hairline at 50 marks the
 * league's middle, and the room is printed in green beside the number. The
 * design system's RatingRow ghosts a potential too, but writes it as an arrow
 * to a second number and has no mark for the middle.
 */
function RoomRow({ label, value, room }: { label: string; value: number; room: number }) {
  const v = Math.max(0, Math.min(100, value));
  const up = Math.max(0, Math.min(99, v + room) - v);
  return (
    <span className="pb-pcard__room">
      <span className="pb-pcard__room-label">{label}</span>
      <span
        className="pb-pcard__room-bar"
        role="img"
        aria-label={`${label} ${v} of 100${up > 0 ? `, room to reach ${v + up}` : ''}`}
      >
        <i className="pb-pcard__room-fill" style={{ width: `${v}%` }} />
        {up > 0 && <i className="pb-pcard__room-ghost" style={{ left: `${v}%`, width: `${up}%` }} />}
        <i className="pb-pcard__room-avg" />
      </span>
      <span className="pb-pcard__room-value" aria-hidden>
        <b>{v}</b>{up > 0 && <small>+{up}</small>}
      </span>
    </span>
  );
}

/**
 * What he can do, in one scroll of titled cards: his ratings at the plate or
 * on the mound with the room each has left, his glove, what he throws, how he
 * does against each hand, and the habits you have read. The staff's project
 * on him leads, because it is about one of these numbers.
 */
function Ratings(
  { p, isOurs, ownerIndex }: { p: AnyPlayer; isOurs: boolean; ownerIndex: number },
) {
  const economy = useDynasty((s) => s.economy);
  const isPitcher = p.type === 'pitcher';
  const twoWay = isTwoWay(p);
  /*
    The room each rating has left, drawn as the striped run past it. The
    engine keeps no ceiling per rating: potential is one number for the whole
    man, and a winter moves every rating that grows by the same step toward it
    (`develop`), so at his potential each has come up by about his potential
    less his rating today — capped at 99, where every rating stops. Another
    program keeps his potential to itself, so his bars stop at what he is.
  */
  const room = isOurs ? Math.max(0, Math.round(p.potential) - overallOf(p)) : 0;
  const bars = (rows: Array<[string, string, number]>) => rows.map(([key, label, value]) => (
    <RoomRow key={key} label={label} value={Math.round(value)} room={GROWS.has(key) ? room : 0} />
  ));
  const hitting = HITTING.map(([k, l]): [string, string, number] => [k, l, (p as Hitter)[k]]);
  const pitching = PITCHING.map(([k, l]): [string, string, number] => [k, l, (p as unknown as Pitcher)[k]]);
  const glove: Array<[string, string, number]> = isPitcher
    ? PITCHER_GLOVE.map(([k, l]) => [k, l, (p as Pitcher)[k]])
    : [
      ...HITTER_GLOVE.map(([k, l]) => [k, l, (p as Hitter)[k]] as [string, string, number]),
      ...(p.pos === 'C' ? [[CATCHER_BAR[0], CATCHER_BAR[1], (p as Hitter).blocking] as [string, string, number]] : []),
    ];
  const scale = <span className="pb-pcard__scale">{SCALE}</span>;

  return (
    <>
      {isOurs && <ProjectNote p={p} economy={economy} />}
      <Card title={isPitcher ? 'Pitching' : 'Hitting'} trailing={scale}>
        {bars(isPitcher ? pitching : hitting)}
        {room > 0 && <p className="pb-note">Striped: where his potential says he could get to.</p>}
      </Card>
      {twoWay && <Card title="Pitching" trailing={scale}>{bars(pitching)}</Card>}
      {(isPitcher || twoWay) && <Repertoire p={p as unknown as Pitcher} />}
      <Card
        title="Fielding"
        eyebrow={isPitcher ? 'Off the mound' : `At ${posName(naturalPos(p as Hitter)).toLowerCase()}`}
        trailing={scale}
      >
        {bars(glove)}
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
    return { label: SLOT_WORD[slot], value: 'No report', icon: 'lock', note: SCOUTING ? 'Scout his program to read him' : undefined };
  });

  return (
    <Card
      title="Tendencies"
      eyebrow={seen === slots.length ? 'What he does without being told' : `${seen} of ${slots.length} read so far`}
      flush
    >
      <DescriptionList items={items} columns={1} />
      {!isOurs && SCOUTING && (
        <p className="pb-note">
          {scouted ? 'Your scouting report is active.' : 'Scout his program to see his tendencies.'}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Seasons and games
// ---------------------------------------------------------------------------

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
    { label: 'AVG', title: 'Batting average', width: '50px', align: 'right', strong: true },
    // Doubles and triples in their own columns: asked for 2026-09-26.
    { label: '2B', title: 'Doubles', width: '30px', align: 'right' },
    { label: '3B', title: 'Triples', width: '30px', align: 'right' },
    { label: 'HR', title: 'Home runs', width: '32px', align: 'right' },
    { label: 'RBI', title: 'Runs batted in', width: '38px', align: 'right' },
  ];

  const rows = [...years].reverse().map((y) => {
    const inProgress = y.year === live?.year;
    const who = (
      <span className="pb-teamcell pb-seasoncell">
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
      : [who, y.ab ? pct((y.h ?? 0) / y.ab) : '—', y.d ?? 0, y.t ?? 0, y.hr ?? 0, y.rbi ?? 0];
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

function AwardCase({ id }: { id: PlayerId }) {
  const won = useAwardsWon(id);
  if (won.length === 0) return null;
  return (
    <Card title="Honors" eyebrow={plural(won.length, 'award')} flush>
      <List className="pb-list--inset" label="Honors">
        {won.map((w) => (
          <ListRow key={`${w.year}-${w.title}`} lead={<AwardEmblem title={w.title} size={44} />} title={w.title} subtitle={String(w.year)} />
        ))}
      </List>
    </Card>
  );
}

/**
 * The marks a career is remembered by — his best year and his totals — then
 * every season in the book, his Junes, his nights and his honors. The old
 * card split these between a Stats tab and a Career tab; this year's line and
 * game log are This season's now, and everything across years is here.
 */
function Career(
  { p, owner, isOurs, half }:
  { p: AnyPlayer; owner: Owner; isOurs: boolean; half: 'bat' | 'arm' },
) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  const isPitcher = isTwoWay(p) ? half === 'arm' : p.type === 'pitcher';
  const { years, live } = careerYears(season, owner.index, p.id, isOurs);

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
      <SeasonTable title="Season by season" years={years} live={live} isPitcher={isPitcher} homeAbbr={owner.def.abbr} />
      <JuneByYear p={p} owner={owner} isOurs={isOurs} half={half} />
      <SignatureMoments id={p.id} />
      <AwardCase id={p.id} />
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
  { id, gone, note, career }:
  {
    id: PlayerId;
    gone: Departure | undefined;
    note: AlumnusNote | undefined;
    career: CareerYear[];
  },
) {
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const [active, setActive] = useState<'overview' | 'career'>('overview');
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

  // His totals, three to a row. A two-way man's six numbers shared one row
  // and ran into each other on a phone (2026-09-26, a Hall of Famer's page),
  // so each half gets its own row under its own name.
  const batting: StatTileProps[] = summary.hitting ? [
    { label: 'Batting average', value: summary.average },
    { label: 'Home runs', value: summary.hr },
    { label: 'Runs batted in', value: summary.rbi },
  ] : [];
  const pitching: StatTileProps[] = summary.pitching ? [
    { label: 'Earned run average', value: summary.era },
    { label: 'Strikeouts', value: summary.k },
    { label: 'Innings', value: summary.innings },
  ] : [];

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
      {(batting.length > 0 || pitching.length > 0) && (
        <Card title={school ? `At ${school}` : 'In college'} eyebrow="His totals">
          {batting.length > 0 && pitching.length > 0 ? (
            <>
              <div className="pb-alum-half">
                <span className="pb-pcard__kicker">Batting</span>
                <StatGroup size="sm" label="Batting" items={batting} />
              </div>
              <div className="pb-alum-half">
                <span className="pb-pcard__kicker">Pitching</span>
                <StatGroup size="sm" label="Pitching" items={pitching} />
              </div>
            </>
          ) : <StatGroup size="sm" items={batting.length > 0 ? batting : pitching} />}
        </Card>
      )}
      <SegmentedControl<'overview' | 'career'>
        label="Alumnus card"
        value={active}
        onChange={setActive}
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
              // The school he left from goes unsaid, as his own card does it:
              // "Sophomore · Rawlins" on every row was cut off at 2B and 3B.
              homeAbbr={abbr || undefined}
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
