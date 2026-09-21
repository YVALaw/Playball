// Program.tsx
// The Program tab's Overview: the hub, and the rooms it opens.
//
// The hub answers "how is my program, and what needs me?" in one screen: the
// marquee carries the three numbers, then at most one Needs you callout, then
// the rooms as tiles you press — a board of places, not a column of rows. A
// room opens as a page with a back link to Program; people and decisions open
// as sheets over it. The rooms that spend money live in ProgramRooms.tsx.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ACHIEVEMENTS, ACHIEVEMENT_IDS } from '../../engine/achievements.js';
import {
  useDynasty, useUserTeam, useConferenceTable,
  type SeasonRecord, type ArchiveSheet,
} from '../../state/store.js';
import {
  expectationFor, prestigeStars, rosterStrength, objectiveMet, coachStanding,
  SKILLS, type CoachState,
} from '../../engine/program.js';
import { retirementStatus } from '../../engine/retirement.js';
import {
  careerName, seasonLength, regularRecord, seasonComplete,
  type CareerYear, type SeasonState,
} from '../../engine/season.js';
import { FINISH_LABEL, type Finish } from '../../engine/postseason.js';
import { honoursByPlayer, type Inductee } from '../../engine/hall.js';
import { philosophyOf } from '../../engine/strategy.js';
import { CONFERENCES } from '../../data/schools.js';
import { playerId, type PlayerId } from '../../engine/types.js';
import {
  BUILDINGS, dollars, facilityLevel, facilityUpgradeCost, FACILITY_MAX_LEVEL, PIPELINE_MIN,
  pipelineStrength, remaining, SEATS, SEAT_LABEL, staffPlan,
} from '../../engine/economy.js';
import { CoachPortrait } from '../CoachPortrait.js';
import { Crest } from '../Crest.js';
import { useOpenTeam } from './TeamCard.js';
import { GodBolt } from '../god/GodBolt.js';
import { FirstVisit } from '../Tutorial.js';
import { pct } from '../format.js';
import { marksHeldBy } from '../ProgramBits.js';
import {
  Button, Callout, Card, CompareTable, ConfirmButton, DescriptionList, EmptyState, LevelPips, List, ListRow, Marquee,
  Medal, Meter, Plaque, ProfileHeader, RoomTile, ScreenHeader, SectionHeader, SegmentedControl,
  StatusBadge, Stars, Table, Tag, TeamCell, TileGrid, Trend, type Tone,
} from '../components/ui/index.js';
import { BudgetRoom, FacilitiesRoom, NetworkRoom, StaffRoom, useRoomBack } from './ProgramRooms.js';
import { GoalGrid } from './BoardGoals.js';
import { CoachesList } from './CoachesList.js';
import { FACILITY_NAME, conferenceName, ordinal, plural, recordText, stateName } from '../words.js';

/** The record for one program, as the season carries it. */
type Owner = SeasonState['teams'][number];

/** Job security in a word, with its tone. The board's own thresholds. */
function securityWord(security: number): { word: string; tone: 'positive' | 'warning' | 'negative' } {
  if (security >= 75) return { word: 'Very secure', tone: 'positive' };
  if (security >= 55) return { word: 'Secure', tone: 'positive' };
  if (security >= 35) return { word: 'Under review', tone: 'warning' };
  return { word: 'In danger', tone: 'negative' };
}

export function Program() {
  const season = useDynasty((s) => s.season);
  const team = useUserTeam();
  const sheet = useDynasty((s) => s.programSheet);
  const clearUnseenTrophies = useDynasty((s) => s.clearUnseenTrophies);
  useEffect(() => {
    if (sheet === 'coach') clearUnseenTrophies();
  }, [sheet, clearUnseenTrophies]);

  if (!season || !team) return null;

  switch (sheet) {
    case 'coach': return <CoachProfile team={team} />;
    case 'money': return <BudgetRoom team={team} />;
    case 'staff': return <StaffRoom team={team} />;
    case 'facilities': return <FacilitiesRoom team={team} />;
    case 'network': return <NetworkRoom team={team} />;
    case 'board': return <BoardRoom team={team} />;
    case 'watchlist': return <WatchlistRoom />;
    case 'hall': return <HallRoom />;
    default: return <ProgramHub team={team} />;
  }
}

/* --------------------------------------------------------------------- hub */

function ProgramHub({ team }: { team: Owner }) {
  const season = useDynasty((s) => s.season)!;
  const review = useDynasty((s) => s.lastReview);
  const offers = useDynasty((s) => s.offers);
  const year = useDynasty((s) => s.year);
  const unseenTrophies = useDynasty((s) => s.unseenTrophies.length);
  const watch = useDynasty((s) => s.watch);
  const setSheet = useDynasty((s) => s.setProgramSheet);
  const economy = useDynasty((s) => s.economy);
  const coach = useDynasty((s) => s.coach);
  const alumni = useDynasty((s) => s.alumni);
  const phase = useDynasty((s) => s.phase);
  const setScreen = useDynasty((s) => s.setScreen);
  const setHistorySheet = useDynasty((s) => s.setHistorySheet);
  const table = useConferenceTable();
  // Alumni can grow into the hundreds, and the hub is the tab's most-visited
  // screen, so the count is memoised rather than scanned on every render.
  const alumniCount = useMemo(() => {
    const abbr = team.def.abbr;
    let n = 0;
    for (const note of Object.values(alumni)) if (note.teamAbbr === abbr) n += 1;
    return n;
  }, [alumni, team.def.abbr]);

  // History is a section beside Overview, not a room inside it.
  const openArchive = (page: ArchiveSheet): void => { setHistorySheet(page); setScreen('history'); };

  const waiting = review !== null || offers.length > 0;
  const left = Math.max(0, remaining(economy, team.prestige));
  const staffCount = SEATS.filter((seat) => economy.staff[seat]).length;
  const built = BUILDINGS.filter((b) => facilityLevel(economy, b.key) > 0).length;
  const running = SEATS.filter((seat) => staffPlan(economy, seat).project).length;
  const affordable = BUILDINGS.filter((b) => {
    const level = facilityLevel(economy, b.key);
    return level < FACILITY_MAX_LEVEL && facilityUpgradeCost(b.key, level + 1) <= left;
  }).length;
  const allBuilt = BUILDINGS.every((b) => facilityLevel(economy, b.key) >= FACILITY_MAX_LEVEL);
  const networkStates = new Set([team.def.state, ...Object.keys(economy.pipelines ?? {}),
    ...(economy.staff.recruiting?.pipelineState ? [economy.staff.recruiting.pipelineState] : [])]);
  const pipelines = [...networkStates]
    .map((state) => ({ state, strength: pipelineStrength(economy, state, team.def.state) }))
    .filter((p) => p.strength >= PIPELINE_MIN)
    .sort((a, b) => b.strength - a.strength);
  const hallCount = season.hall?.length ?? 0;
  const annals = team.annals ?? [];
  const titles = annals.filter((s) => s.finish === 'champion').length;
  const record = regularRecord(team);
  // A table sorted on zero results is not a standing.
  const rank = team.gp === 0 ? 0 : table.findIndex((t) => t.index === team.index) + 1;
  const security = securityWord(coach.security);
  /*
    Only in the offseason. A contract is stamped `until = year + 2` and dropped
    at the roll, so `until <= year` holds for the whole of its final season,
    while Renew is only offered in the offseason: flagging it all spring would
    point at a room where nothing can be done about it yet.
  */
  const expiring = phase !== null ? SEATS.filter((seat) => {
    const man = economy.staff[seat];
    return man?.until !== undefined && man.until <= year;
  }).length : 0;

  /* The one thing that needs you most, in order: the board, then contracts,
     then an achievement you have not opened. Never more than one. */
  let needs: ReactNode = null;
  if (review !== null) {
    needs = (
      <Callout tone="warning" eyebrow="Needs you" title="The board has reviewed your season" onClick={() => setSheet('board')} />
    );
  } else if (offers.length > 0) {
    needs = (
      <Callout tone="info" eyebrow="Needs you" title={offers.length === 1 ? 'A program wants to talk' : `${offers.length} programs want to talk`} onClick={() => setSheet('board')} />
    );
  } else if (expiring > 0) {
    needs = (
      <Callout tone="warning" eyebrow="Needs you" title={`${plural(expiring, 'staff contract')} ${expiring === 1 ? 'ends' : 'end'} this season`} onClick={() => setSheet('staff')} />
    );
  } else if (unseenTrophies > 0) {
    needs = (
      <Callout tone="positive" icon="star" eyebrow="New" title={unseenTrophies === 1 ? 'Coach achievement unlocked' : `${unseenTrophies} coach achievements unlocked`} onClick={() => setSheet('coach')} />
    );
  }

  const staffLine = [
    running > 0 ? `${plural(running, 'project')} running` : '',
    staffCount < 3 ? `${plural(3 - staffCount, 'seat')} open` : '',
  ].filter(Boolean).join(' · ') || 'No projects running';

  return (
    <main className="pb-page">
      <Marquee
        mark={<Crest abbr={team.def.abbr} size={44} />}
        eyebrow={`${team.def.school} · ${year}`}
        title="Program"
        numbers={[
          { label: 'Record', value: recordText(record.w, record.l), note: rank > 0 ? `${ordinal(rank)} in ${conferenceName(team.conference)}` : 'Regular season' },
          { label: 'Prestige', value: team.prestige, unit: '/100', note: 'Sets your budget' },
          { label: 'Security', value: coach.security, unit: '/100', note: security.word, tone: security.tone },
        ]}
      />
      {needs}
      <FirstVisit id="program-overview" />

      <section>
        <SectionHeader title="Run the program" />
        <TileGrid label="Run the program">
          <RoomTile
            icon="person"
            name="Staff"
            value={staffCount}
            unit="/3"
            status={staffLine}
            badge={expiring > 0 ? <StatusBadge tone="warning" icon="clock">{expiring}</StatusBadge> : undefined}
            flagged={expiring > 0}
            onClick={() => setSheet('staff')}
          />
          <RoomTile
            icon="bar-chart"
            name="Budget"
            value={dollars(left)}
            status="Left to spend this season"
            guide="budget"
            onClick={() => setSheet('money')}
          />
          <RoomTile
            icon="home"
            name="Facilities"
            value={built}
            unit="/3"
            status={allBuilt ? 'Fully built'
              : affordable > 0 ? `${plural(affordable, 'upgrade')} within budget` : 'Next upgrade is over budget'}
            guide="hub-facilities"
            onClick={() => setSheet('facilities')}
            footer={(
              <span className="pb-pips-row">
                {BUILDINGS.map((b) => (
                  <LevelPips
                    key={b.key}
                    level={facilityLevel(economy, b.key)}
                    label={FACILITY_NAME[b.key]}
                    showText={false}
                  />
                ))}
              </span>
            )}
          />
          <RoomTile
            icon="globe"
            name="Network"
            value={pipelines.length}
            status={pipelines.length === 0 ? 'No pipelines yet'
              : `${plural(pipelines.length, 'pipeline')} · ${stateName(pipelines[0]!.state)} strongest`}
            onClick={() => setSheet('network')}
          />
        </TileGrid>
      </section>

      <section>
        <SectionHeader title="Legacy" />
        <TileGrid cols={3} label="Legacy">
          <Plaque
            icon="reader"
            label="History"
            value={annals.length}
            note={titles > 0 ? plural(titles, 'title') : annals.length === 1 ? 'season' : 'seasons'}
            tone={titles > 0 ? 'positive' : undefined}
            onClick={() => openArchive('seasons')}
          />
          <Plaque
            icon="backpack"
            label="Alumni"
            value={alumniCount}
            note={alumniCount === 1 ? 'former player' : 'former players'}
            onClick={() => openArchive('alumni')}
          />
          <Plaque
            icon="star"
            label="Hall"
            value={hallCount}
            note={hallCount === 1 ? 'inductee' : 'inductees'}
            onClick={() => setSheet('hall')}
          />
        </TileGrid>
      </section>
      <RecordTrend seasons={annals} />

      <section>
        <SectionHeader title="Your career" />
        <TileGrid label="Your career">
          <RoomTile
            icon="target"
            name="Board"
            value={coach.security}
            unit="/100"
            status={`${security.word} · ${plural(coach.contractYears, 'yr')} left`}
            statusTone={security.tone}
            badge={waiting ? <StatusBadge tone="warning" icon="alert">{review !== null ? 'Review' : 'Offer'}</StatusBadge> : undefined}
            flagged={waiting}
            onClick={() => setSheet('board')}
          />
          <RoomTile
            icon="eye"
            name="Watchlist"
            value={watch.programs.length + watch.jobs.length}
            status={`${plural(watch.programs.length, 'program')} · ${plural(watch.jobs.length, 'job')}`}
            onClick={() => setSheet('watchlist')}
          />
        </TileGrid>
      </section>
    </main>
  );
}

/** The last six regular seasons as bars of win percentage. */
export function RecordTrend({ seasons }: { seasons: readonly { year: number; w: number; l: number; finish?: string }[] }) {
  const years = [...seasons].sort((a, b) => a.year - b.year).slice(-6);
  if (years.length < 2) return null;
  return (
    <Card title="Record by season" trailing={<span className="pb-card__hint">Regular season win %</span>}>
      <Trend
        label={`Win percentage over the last ${years.length} seasons`}
        bars={years.map((s) => ({
          key: s.year,
          label: s.year,
          top: recordText(s.w, s.l),
          value: s.w + s.l > 0 ? Math.round((s.w / (s.w + s.l)) * 100) : 0,
          highlight: s.finish === 'champion',
        }))}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------- board */

const verdictWord = (v: string): string => (
  v === 'exceeded' ? 'Above expectations'
    : v === 'met' ? 'Expectations met'
      : v === 'missed' ? 'Below expectations'
        : 'A bad year'
);

function BoardRoom({ team }: { team: Owner }) {
  const season = useDynasty((s) => s.season);
  const openOverlay = useDynasty((s) => s.openOverlay);
  const coach = useDynasty((s) => s.coach);
  const review = useDynasty((s) => s.lastReview);
  const offers = useDynasty((s) => s.offers);
  const clearReview = useDynasty((s) => s.clearReview);
  const post = useDynasty((s) => s.lastPostseason);
  const table = useConferenceTable();
  const storedAsk = useDynasty((s) => s.boardAsk);
  const opener = useDynasty((s) => s.seasonOpener);
  const takeSeason = useDynasty((s) => s.dismissSeasonOpener);
  const stampAsk = useDynasty((s) => s.stampBoardAsk);
  const argueTerms = useDynasty((s) => s.argueTerms);
  const arguedTerms = useDynasty((s) => s.arguedTerms);
  const back = useRoomBack();
  // What the board said when asked to think again: the wins it came down by,
  // or 0 for a case it did not accept.
  const [argued, setArgued] = useState<number | null>(null);
  // A board with no stamp gets one, once, rather than recomputing from the
  // live roster every render, which crept the number up as players developed.
  useEffect(() => { if (!storedAsk) stampAsk(); }, [storedAsk, stampAsk]);

  if (!season) return null;

  const roster = rosterStrength(team.team);
  const expectation = storedAsk ?? expectationFor(team.prestige, roster, seasonLength(season.config));
  const done = seasonComplete(season);
  const played = regularRecord(team);
  const rank = table.findIndex((t: { index: number }) => t.index === team.index) + 1;
  const finish = post?.finish[team.index];
  const live = {
    wins: played.w, losses: played.l,
    conferenceRank: done ? rank : 0,
    conferenceSize: table.length,
    wonConference: post?.conferenceChampions.includes(team.index) ?? false,
    madeTournament: post?.nationalField
      ? post.nationalField.includes(team.index)
      : ['national', 'omaha', 'runner-up', 'champion'].includes(finish ?? ''),
    wonRegional: post?.regionChampions.includes(team.index) ?? false,
    reachedOmaha: ['omaha', 'runner-up', 'champion'].includes(finish ?? ''),
    wonTitle: post?.champion === team.index,
  };
  /*
    Whether an objective has been decided yet. The schedule running out is the
    moment the postseason becomes possible, not the moment it is over, so a
    tournament goal stays open until the bracket has actually been played.
  */
  const settledFor = (key: string): boolean => (
    key === 'tournament' || key === 'omaha' || key === 'conferenceTitle' || key === 'regionalTitle' || key === 'title'
      ? post !== null
      : done
  );
  const met = expectation.objectives.filter((o) => objectiveMet(o, live)).length;
  const security = securityWord(coach.security);
  const stars = prestigeStars(team.prestige);

  return (
    <main className="pb-page">
      <Marquee
        back={back}
        eyebrow={`${team.def.school} · Year ${coach.tenure + 1}`}
        title="Board"
        numbers={[
          { label: 'Security', value: coach.security, unit: '/100', note: security.word, tone: security.tone },
          { label: 'Win target', value: expectation.targetWins, note: `${plural(played.w, 'win')} so far` },
          { label: 'Contract', value: coach.contractYears, unit: coach.contractYears === 1 ? ' yr' : ' yrs', note: `${coach.contractLength}-year deal` },
        ]}
      />
      <FirstVisit id="program" />

      {opener && (
        <Card eyebrow={`${opener.year} · The board’s terms`} title={opener.askSummary}>
          <p className="pb-text">Accept them to start the season.</p>
          <Button variant="primary" block onClick={takeSeason}>Accept the terms</Button>
          {!arguedTerms && (
            <Button variant="secondary" block onClick={() => setArgued(argueTerms())}>Ask them to reconsider</Button>
          )}
        </Card>
      )}
      {argued !== null && (
        <Callout tone={argued > 0 ? 'positive' : 'neutral'} title={argued > 0 ? 'They will take less' : 'They will not move'}>
          {argued > 0 ? `The ask comes down ${plural(argued, 'win')}.` : 'The number stands.'}
        </Callout>
      )}

      {review && (
        <Card
          eyebrow={review.fired ? 'Board decision' : 'End-of-year review'}
          title={review.fired ? 'The board has let you go' : verdictWord(review.verdict)}
          footer={!review.fired ? <Button variant="primary" block onClick={clearReview}>Continue</Button> : undefined}
        >
          {review.fired
            ? <Callout tone="negative" title="You are out of a job">{review.message}</Callout>
            : <p className="pb-text">{review.message}</p>}
          <CompareTable
            label="What moved"
            labelHeader="Measure"
            from="Before"
            to="After"
            rows={[
              { label: 'Program prestige', now: review.prestigeBefore, next: review.prestigeAfter },
              { label: 'Your prestige', now: review.coachPrestigeBefore, next: review.coachPrestigeAfter },
              { label: 'Job security', now: review.securityBefore, next: review.securityAfter },
            ]}
          />
          {!review.fired && (
            <DescriptionList
              columns={1}
              items={[{
                label: 'Contract',
                value: review.renewed
                  ? `Renewed: ${plural(review.contractYears, 'year')}`
                  : review.extended
                    ? `Extended: ${plural(review.contractYears, 'year')} left`
                    : `${plural(review.contractYears, 'year')} left`,
                tone: review.renewed || review.extended ? 'positive' : undefined,
              }]}
            />
          )}
        </Card>
      )}

      {offers.length > 0 && (
        <Callout
          tone="info"
          icon="envelope"
          title={offers.length === 1 ? 'A program wants to talk' : `${offers.length} programs want to talk`}
          onClick={() => openOverlay('jobs')} />
      )}

      <Card title="Board confidence" trailing={<StatusBadge tone={security.tone}>{security.word}</StatusBadge>}>
        <Meter
          value={coach.security}
          max={100}
          tone={security.tone === 'negative' ? 'negative' : security.tone === 'warning' ? 'warning' : 'positive'}
          ariaLabel="Board confidence"
          markers={[{ at: 35, label: 'Review' }, { at: 55, label: 'Secure' }]}
        />
        <span className="pb-cluster"><Stars value={stars} label="Program prestige" /><span className="pb-text-muted">{team.prestige} prestige</span></span>
      </Card>

      <section>
        <SectionHeader title="This year's goals" count={`${met} of ${expectation.objectives.length} met`} />
        <GoalGrid
          label="This year's goals"
          objectives={expectation.objectives}
          state={(o) => (objectiveMet(o, live) ? 'met' : settledFor(o.key) ? 'missed' : 'open')}
          progress={(o) => ((o.key === 'wins' || o.key === 'stretchWins') && !objectiveMet(o, live) && o.target
            ? `${played.w}/${o.target}` : undefined)}
        />
      </section>
    </main>
  );
}

/* --------------------------------------------------------------- watchlist */

function WatchlistRoom() {
  const season = useDynasty((s) => s.season);
  const watch = useDynasty((s) => s.watch);
  const openTeam = useOpenTeam();
  const back = useRoomBack();
  if (!season) return null;
  const rows = watch.programs
    .map((abbr) => season.teams.find((t) => t.def.abbr === abbr))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .sort((a, b) => b.prestige - a.prestige);

  return (
    <main className="pb-page">
      <Marquee
        back={back}
        eyebrow="Programs you follow"
        title="Watchlist"
        numbers={rows.length > 0 ? [
          { label: 'Following', value: rows.length },
          { label: 'Jobs watched', value: watch.jobs.length },
        ] : undefined}
      />
      {rows.length === 0 ? (
        <EmptyState icon="eye" title="Nothing on your watchlist" text="Follow a program from its profile to keep up with its biggest stories." />
      ) : (
        <section>
          <SectionHeader title="Following" count={rows.length} />
          <List label="Programs you follow">
            {rows.map((t) => (
              <ListRow
                key={t.def.abbr}
                lead={<TeamCell abbr={t.def.abbr} name={t.def.school} sub={`${conferenceName(t.conference)} · ${recordText(t.w, t.l)}`} size={30} />}
                title=""
                value={t.prestige}
                unit="/100"
                onClick={() => openTeam(t.index)}
              />
            ))}
          </List>
        </section>
      )}
    </main>
  );
}

/* -------------------------------------------------------------------- hall */

/** One player's whole college career, as the record book has it. */
interface HallRow {
  id: PlayerId;
  name: string;
  first: number;
  last: number;
  teams: string[];
  pitcher: boolean;
  ab: number; h: number; hr: number; rbi: number;
  w: number; l: number; outs: number; er: number; k: number;
  honours: string[];
}

const sum = (years: CareerYear[], key: keyof CareerYear): number =>
  years.reduce((a, y) => a + ((y[key] as number | undefined) ?? 0), 0);

/**
 * The record book, folded into one row per player. Rosters are rewritten every
 * June, so this is the only place a player who left years ago can be listed.
 */
function hallRows(careers: Record<PlayerId, CareerYear[]>, honours: Map<string, string[]>): HallRow[] {
  return Object.entries(careers).map(([id, rawYears]) => {
    const years = [...rawYears].sort((a, b) => a.year - b.year);
    const teams: string[] = [];
    for (const y of years) if (!teams.includes(y.team)) teams.push(y.team);
    return {
      id: playerId(id),
      name: careerName(playerId(id), years),
      first: years[0]?.year ?? 0,
      last: years[years.length - 1]?.year ?? 0,
      teams,
      // The same test the player card uses, so a two-way player lands in the
      // same half of the book on both screens.
      pitcher: years.some((y) => (y.outs ?? 0) > 0) || !years.some((y) => (y.ab ?? 0) > 0),
      ab: sum(years, 'ab'), h: sum(years, 'h'), hr: sum(years, 'hr'), rbi: sum(years, 'rbi'),
      w: sum(years, 'w'), l: sum(years, 'l'), outs: sum(years, 'outs'),
      er: sum(years, 'er'), k: sum(years, 'k'),
      honours: honours.get(id) ?? [],
    };
  });
}

/**
 * The players you put in, and the ones who piled up the most. An induction is
 * a verdict made on a date; a leaderboard is who is top of a column today.
 */
function HallRoom() {
  const season = useDynasty((s) => s.season);
  const history = useDynasty((s) => s.history);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const version = useDynasty((s) => s.version);
  void version;
  const back = useRoomBack();
  const [leaders, setLeaders] = useState<'bats' | 'arms'>('bats');
  const [openYears, setOpenYears] = useState<Record<number, boolean>>({});
  if (!season) return null;

  const honours = honoursByPlayer(history);
  const rows = hallRows(season.careers ?? {}, honours);
  const inducted = [...(season.hall ?? [])].sort((a, b) => b.year - a.year || b.score - a.score);
  const byYear = new Map<number, Inductee[]>();
  for (const m of inducted) byYear.set(m.year, [...(byYear.get(m.year) ?? []), m]);
  const classes = [...byYear.entries()];
  const bats = rows.filter((r) => !r.pitcher).sort((a, b) => b.h - a.h).slice(0, 10);
  const arms = rows.filter((r) => r.pitcher).sort((a, b) => b.k - a.k).slice(0, 10);
  const span = (a: number, b: number): string => (a === b ? `${a}` : `${a}–${b}`);

  return (
    <main className="pb-page">
      <Marquee
        back={back}
        eyebrow="The record book"
        title="Hall of Fame"
        numbers={[
          { label: 'Inducted', value: inducted.length },
          { label: 'Classes', value: classes.length },
          { label: 'Careers', value: rows.length, note: 'On file' },
        ]}
      />
      {inducted.length === 0 ? (
        <EmptyState icon="star" title="Nobody is in yet" text="The ballot meets in June. A career, not a season: your best players go in when their playing days are done." />
      ) : (
        <section className="pb-stack">
          <SectionHeader title="Inductees" count={inducted.length} />
          {classes.map(([year, men], i) => {
            const on = openYears[year] ?? i === 0;
            return (
              <Card
                key={year}
                title={`Class of ${year}`}
                trailing={(
                  <Button size="sm" variant="quiet" iconAfter={on ? 'chevron-down' : 'chevron-right'} onClick={() => setOpenYears({ ...openYears, [year]: !on })} aria-expanded={on}>
                    {plural(men.length, 'player')}
                  </Button>
                )}
                flush
              >
                {on && (
                  <List label={`Class of ${year}`} className="pb-list--inset">
                    {men.map((m) => {
                      const honoursOf = honours.get(m.id) ?? [];
                      const marks = marksHeldBy(season, m.id);
                      return (
                        <ListRow
                          key={m.id}
                          lead={<Medal metal="gold" size={40} />}
                          title={m.name}
                          subtitle={`${span(m.first, m.last)} · ${m.teams.join(', ')} · ${m.line}`}
                          status={honoursOf.length || marks.length ? (
                            <>
                              {honoursOf.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}
                              {honoursOf.length > 3 && <Tag>+{honoursOf.length - 3}</Tag>}
                              {marks.length > 0 && <Tag tone="positive" title={marks.join(', ')}>{plural(marks.length, 'record')} held</Tag>}
                            </>
                          ) : undefined}
                          onClick={() => openPlayer(m.id)}
                        />
                      );
                    })}
                  </List>
                )}
              </Card>
            );
          })}
        </section>
      )}

      <CoachesList legends={season.legends ?? []} />

      <section className="pb-stack">
        <SectionHeader title="Career leaders" />
        <SegmentedControl<'bats' | 'arms'>
          label="Career leaders"
          value={leaders}
          onChange={setLeaders}
          options={[{ value: 'bats', label: 'Hitters: hits' }, { value: 'arms', label: 'Pitchers: strikeouts' }]}
        />
        <Card flush>
          {leaders === 'bats' ? (
            <Table
              label="Career hits leaders"
              columns={[
                { label: '#', width: '28px', align: 'right' },
                { label: 'Player', grow: true },
                { label: 'Hits', width: '44px', align: 'right', strong: true },
                { label: 'Avg', title: 'Batting average', width: '52px', align: 'right' },
                { label: 'HR', title: 'Home runs', width: '36px', align: 'right' },
              ]}
              empty="No hitter has finished a season for you yet."
              rows={bats.map((r, i) => ({
                key: r.id,
                onClick: () => openPlayer(r.id),
                cells: [i + 1, <PlayerCell key="p" name={r.name} sub={`${span(r.first, r.last)} · ${r.teams.join(', ')}`} />,
                  r.h, r.ab > 0 ? pct(r.h / r.ab) : '—', r.hr],
              }))}
            />
          ) : (
            <Table
              label="Career strikeout leaders"
              columns={[
                { label: '#', width: '28px', align: 'right' },
                { label: 'Player', grow: true },
                { label: 'K', title: 'Strikeouts', width: '40px', align: 'right', strong: true },
                { label: 'W–L', title: 'Wins and losses', width: '52px', align: 'right' },
                { label: 'ERA', title: 'Earned runs per nine innings', width: '48px', align: 'right' },
              ]}
              empty="No pitcher has finished a season for you yet."
              rows={arms.map((r, i) => ({
                key: r.id,
                onClick: () => openPlayer(r.id),
                cells: [i + 1, <PlayerCell key="p" name={r.name} sub={`${span(r.first, r.last)} · ${r.teams.join(', ')}`} />,
                  r.k, recordText(r.w, r.l), r.outs > 0 ? (r.er * 27 / r.outs).toFixed(2) : '—'],
              }))}
            />
          )}
        </Card>
      </section>
    </main>
  );
}

function PlayerCell({ name, sub }: { name: string; sub: string }) {
  return (
    <span className="pb-cell-stack">
      <span className="pb-ellipsis">{name}</span>
      <small className="pb-ellipsis">{sub}</small>
    </span>
  );
}

/* ------------------------------------------------------------ coach profile */

type CoachView = 'overview' | 'skills' | 'career' | 'trophies';

/** What each skill buys, in the same words the coach points step uses. */
const SKILL_NOTE: Record<string, string> = {
  offense: 'Your hitters take slightly better at-bats, every game.',
  defense: 'Balls in play against you become outs a little more often.',
  training: 'Your returning players develop further between seasons.',
  recruiting: 'Every hour on a recruit counts for more, and your scouting reports run tighter.',
};
const SKILL_NAME: Record<string, string> = {
  offense: 'Offense', defense: 'Defense', training: 'Training', recruiting: 'Recruiting',
};

/** You, the head coach: the career that follows you from school to school. */
function CoachProfile({ team }: { team: Owner }) {
  /*
    The dot led here. Captured before the hub's effect clears it, so the new
    ones wear New and the page opens on the first of them.
  */
  const unseenNow = useDynasty((s) => s.unseenTrophies);
  const [freshTrophies] = useState(() => new Set(unseenNow));
  const [view, setView] = useState<CoachView>(() => (unseenNow.length > 0 ? 'trophies' : 'overview'));
  const firstNew = useRef<HTMLElement | null>(null);
  useEffect(() => { firstNew.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [view]);
  const coach = useDynasty((s) => s.coach);
  const history = useDynasty((s) => s.history);
  const tree = useDynasty((s) => s.economy.tree ?? []);
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  const setSheet = useDynasty((s) => s.setProgramSheet);
  const overlay = useDynasty((s) => s.overlay);

  const philosophy = philosophyOf(coach.philosophy);
  const philosophyName = philosophy.name.charAt(0) + philosophy.name.slice(1).toLowerCase();
  const standing = coachStanding(coach);
  const games = coach.careerWins + coach.careerLosses;
  // Never fewer career seasons than seasons at this job: the two counters
  // tick a moment apart in the offseason.
  const careerSeasons = Math.max(history.length, coach.tenure);
  const cabinet = ACHIEVEMENT_IDS.filter((id) => coach.achievements[id]);

  return (
    <main className="pb-page">
      <ScreenHeader
        back={overlay === 'program' ? undefined : { label: 'Program', onClick: () => setSheet('overview') }}
        title="Your profile"
        trailing={<GodBolt target={{ kind: 'coach' }} label="Edit your coach in god mode" />}
      />
      <ProfileHeader
        media={<span className="pb-portrait"><CoachPortrait look={coach.look} size={88} /></span>}
        eyebrow={`Head coach · ${team.def.school}`}
        name={coach.name}
        meta={`${standing.title}${standing.lifer ? ' · Lifer' : ''} · ${philosophyName}`}
        stats={[
          { label: careerSeasons === 1 ? 'Season' : 'Seasons', value: careerSeasons },
          { label: 'Here', value: coach.tenure },
        ]}
      />
      <SegmentedControl<CoachView>
        label="Profile section"
        value={view}
        onChange={setView}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'skills', label: 'Skills', badge: coach.skillPoints > 0 ? coach.skillPoints : undefined },
          { value: 'career', label: 'Career' },
          { value: 'trophies', label: 'Trophies', badge: freshTrophies.size > 0 ? true : undefined },
        ]}
      />

      {view === 'overview' && (
        <>
          <DescriptionList
            items={[
              { label: 'Age', value: String(coach.age), note: `From ${stateName(coach.homeState)}` },
              { label: 'Philosophy', value: philosophyName, note: standing.title },
              { label: 'Contract', value: coach.contractYears > 0 ? plural(coach.contractYears, 'year') + ' left' : 'Final year', note: `${coach.contractLength}-year deal` },
              { label: 'Your prestige', value: `${coach.prestige} / 100`, note: 'National reputation' },
            ]}
          />
          <section>
            <SectionHeader title="Career record" count={recordText(coach.careerWins, coach.careerLosses)} description={games > 0 ? `${pct(coach.careerWins / games)} won` : undefined} />
            <DescriptionList
              items={[
                { label: 'This year', value: recordText(team.w, team.l) },
                { label: 'Tournament bids', value: String(coach.tournaments) },
                { label: 'Conference titles', value: String(coach.conferenceTitles) },
                { label: 'Regional titles', value: String(coach.regionalTitles), note: 'Each one is a trip to Omaha' },
                { label: 'National titles', value: String(coach.titles), tone: coach.titles > 0 ? 'positive' : undefined, icon: coach.titles > 0 ? 'star-filled' : undefined },
              ]}
            />
          </section>
          <Retire coach={coach} seasons={careerSeasons} />
        </>
      )}

      {view === 'skills' && (
        <section className="pb-stack">
          <SectionHeader
            title="Coaching skills"
            count={coach.skillPoints > 0 ? `${coach.skillPoints} unspent` : undefined}
            description={coach.skillPoints > 0 ? 'Spend them in the offseason' : '3 more each June'}
          />
          <TileGrid label="Coaching skills">
            {SKILLS.map((k) => (
              <Card key={k}>
                <Meter label={SKILL_NAME[k]} valueText={`${coach.skills[k]} / 99`} value={coach.skills[k]} max={99} />
                <p className="pb-text-muted">{SKILL_NOTE[k]}</p>
              </Card>
            ))}
          </TileGrid>
        </section>
      )}

      {view === 'career' && (
        <>
          <CareerPath history={history} coach={coach} />
          {tree.length > 0 && (
            <section>
              <SectionHeader title="Coaching tree" description="Former assistants now head coaches" />
              <List label="Coaching tree">
                {tree.map((branch) => {
                  const chair = season?.teams.find((t) => t.coach?.name === branch.name);
                  const c = chair?.coach;
                  const line = c
                    ? `${recordText(c.careerWins, c.careerLosses)}${c.titles ? ` · ${plural(c.titles, 'title')}` : ''}`
                    : branch.careerWins !== undefined
                      ? `${recordText(branch.careerWins, branch.careerLosses ?? 0)}${branch.titles ? ` · ${plural(branch.titles, 'title')}` : ''} · not coaching`
                      : `Left in ${branch.leftYear}`;
                  return (
                    <ListRow
                      key={branch.id}
                      title={branch.name}
                      subtitle={`${SEAT_LABEL[branch.seat]} · ${plural(branch.yearsWithYou, 'year')} on your staff`}
                      status={<span className="pb-text-muted">{chair ? chair.def.school : branch.lastSchool ?? 'Not coaching'} {'·'} {line}</span>}
                    />
                  );
                })}
              </List>
            </section>
          )}
        </>
      )}

      {view === 'trophies' && (
        <>
          <section>
            <SectionHeader title="Trophy case" />
            <List label="Trophy case">
              {([
                { name: 'National titles', n: coach.titles, years: history.filter((r) => r.finish === 'champion'), metal: 'gold' as const },
                { name: 'Trips to Omaha', n: coach.regionalTitles, years: history.filter((r) => r.finish === 'omaha' || r.finish === 'runner-up' || r.finish === 'champion'), metal: 'silver' as const },
                { name: 'Conference titles', n: coach.conferenceTitles, years: history.filter((r) => r.wonConference), metal: 'bronze' as const },
              ]).map((shelf) => (
                <ListRow
                  key={shelf.name}
                  lead={<Medal metal={shelf.metal} size={40} />}
                  title={shelf.name}
                  subtitle={shelf.years.length ? `${shelf.years.slice(0, 4).map((r) => r.year).join(', ')}${shelf.years.length > 4 ? ' and more' : ''}` : 'None yet'}
                  value={shelf.n}
                />
              ))}
            </List>
          </section>
          <section>
            <SectionHeader
              title="Achievements"
              count={freshTrophies.size > 0 ? `${freshTrophies.size} new` : cabinet.length || undefined}
            />
            {cabinet.length === 0 ? (
              <EmptyState icon="star" title="None yet" text="Milestones in your career show up here." />
            ) : (
              <List label="Achievements">
                {cabinet.map((id) => {
                  const row = coach.achievements[id];
                  const fresh = freshTrophies.has(id);
                  return (
                    <span
                      key={id}
                      className="pb-contents"
                      ref={fresh && firstNew.current === null ? (el) => { if (el && firstNew.current === null) firstNew.current = el; } : undefined}
                    >
                      <ListRow
                        icon="star"
                        title={ACHIEVEMENTS[id].name}
                        subtitle={row?.detail ?? ACHIEVEMENTS[id].note}
                        status={(
                          <>
                            {fresh && <StatusBadge tone="positive" icon="star-filled">New</StatusBadge>}
                            <span className="pb-text-muted">{row?.team} {row?.year}</span>
                          </>
                        )}
                        selected={fresh}
                      />
                    </span>
                  );
                })}
              </List>
            )}
          </section>
        </>
      )}
      <FirstVisit id="coach" />
    </main>
  );
}


/**
 * The one control that ends a career.
 *
 * On the coach's own page rather than in settings, because it is a decision
 * about the man and not about the app, and two presses like every other
 * irreversible control in here. Pressed in the spring it is an announcement
 * and the season plays out; pressed once the season is graded there is nothing
 * left to play. The store decides which of those it is — see
 * `announceRetirement`.
 */
function Retire({ coach, seasons }: { coach: CoachState; seasons: number }) {
  const phase = useDynasty((s) => s.phase);
  const announce = useDynasty((s) => s.announceRetirement);
  const years = retirementStatus({ age: coach.age, seasons });
  // "0 seasons" is a man who has not finished one yet, which is worth saying
  // in words rather than in a zero.
  const behind = seasons === 0 ? 'first season' : plural(seasons, 'season');

  if (coach.farewellYear !== undefined) {
    return (
      <Callout tone="info" icon="bookmark" eyebrow={`Age ${coach.age} · ${behind}`} title="Your last season">
        The board meeting in June closes the career.
      </Callout>
    );
  }

  return (
    <section>
      <SectionHeader
        title="Retirement"
        count={years === 'early' ? undefined : 'The years are asking'}
      />
      <Card>
        <ConfirmButton
          block
          variant="secondary"
          icon="exit"
          idle={phase === null ? 'Retire after this season' : 'Retire'}
          armed="Tap again. There is no undo."
          meta={`Age ${coach.age} · ${behind}`}
          onConfirm={() => { announce(); }}
        />
        <p className="pb-note">
          {phase === null
            ? 'The season plays out as a farewell.'
            : 'Your career closes here.'}
        </p>
      </Card>
    </section>
  );
}

/**
 * The coach's own year by year, which is not the school's: it follows the
 * coach, grouped by where each season was coached.
 */
function CareerPath({ history, coach }: { history: SeasonRecord[]; coach: CoachState }) {
  if (history.length === 0) {
    return <EmptyState icon="reader" title="The book starts in June" text="Your first finished season is written down at the board meeting." />;
  }
  const spans: Array<{ school: string; rows: SeasonRecord[] }> = [];
  for (const row of history) {
    const last = spans[spans.length - 1];
    const school = row.school ?? 'Previous program';
    if (last && last.school === school) last.rows.push(row);
    else spans.push({ school, rows: [row] });
  }
  return (
    <section className="pb-stack">
      <SectionHeader title="Career path" count={recordText(coach.careerWins, coach.careerLosses)} />
      {spans.map((span, si) => {
        const abbr = abbrOfSchool(span.school);
        return (
          <Card
            key={`${span.school}-${si}`}
            title={abbr ? <TeamCell abbr={abbr} name={span.school} sub={plural(span.rows.length, 'season')} /> : span.school}
            flush
          >
            <List label={span.school} className="pb-list--inset">
              {span.rows.map((row) => (
                <ListRow
                  key={row.year}
                  title={String(row.year)}
                  subtitle={`${FINISH_LABEL[row.finish as Finish] ?? row.finish}${row.wonConference ? ' · Conference champions' : ''}`}
                  status={row.finish === 'champion' ? <StatusBadge tone="positive" icon="star-filled">National champions</StatusBadge> : undefined}
                  value={recordText(row.w, row.l)}
                />
              ))}
            </List>
          </Card>
        );
      })}
    </section>
  );
}

/** Best-effort crest for a school named in an old career row. */
function abbrOfSchool(school: string): string {
  for (const c of CONFERENCES) {
    const hit = c.schools.find((s) => s.school === school);
    if (hit) return hit.abbr;
  }
  return '';
}
