// SigningDay.tsx
// Where the whole class went, and what they actually were.
//
// Three views: your class, how every school's class ranks, and the top
// signings in the country with where each went. This is also where the
// guessing stops: all winter the board showed ranges, and here the real rating
// and potential are printed beside the report you were working from. A player
// who came in at the top of your report, or the bottom, says so in words.
//
// Walk-ons are kept apart from the class: they are what a program gets where
// it did not recruit. Starting next season is a two-press button, because it
// rolls the year.

import { useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { withStaff } from '../../engine/economy.js';
import {
  RECRUITING_FACTORS, RECRUITING_FACTOR_LABEL, recruitingPrioritiesOf, byRank, reportedOverall, reportedPotential,
  type Prospect, type RecruitingFactor,
} from '../../engine/recruiting.js';
import { highSchoolLine, potentialGrade, GRADE_LADDER } from '../../engine/scouting.js';
import { walkOnClass, walkOnSeed } from '../../engine/progression.js';
import { overallOf, naturalPos } from '../../engine/ratings.js';
import { isTwoWay } from '../../engine/types.js';
import type { Hitter, Pitcher, Player, Position } from '../../engine/types.js';
import { FirstVisit } from '../Tutorial.js';
import {
  Callout, Card, ConfirmButton, DescriptionList, EmptyState, Face, List, Marquee, PlayerRow,
  SectionHeader, SegmentedControl, Sheet, Stars, StatGroup, StatusBadge, Table, Tag, TeamCell,
} from '../components/ui/index.js';
import { CLASS_NAME, HIGH_SCHOOL_WORD, POSITION_NAME, capsWords, handsText, plural, stateName } from '../words.js';
import { ContinueBar, StepScreen } from './OffseasonStep.js';

type View = 'mine' | 'rankings' | 'all';

/** Whichever player's card is open: a recruit, or a walk-on who turned up. */
type Open = { kind: 'recruit'; id: string } | { kind: 'walkOn'; id: string } | null;

/** Class score: stars squared and added up, so quality beats quantity. */
const classPoints = (list: readonly Prospect[]): number =>
  list.reduce((a, p) => a + p.stars * p.stars, 0);

function slotTag(p: Player): { text: string; title: string } {
  if (isTwoWay(p)) return { text: 'Two-way', title: 'Two-way player' };
  const code = p.type === 'pitcher' ? (p as Pitcher).role : naturalPos(p as Hitter);
  return { text: code, title: POSITION_NAME[code as Position] ?? code };
}

/** What he wanted most, in the recruiting board's words. */
const topPriority = (p: Prospect): RecruitingFactor => {
  const w = recruitingPrioritiesOf(p);
  return [...RECRUITING_FACTORS].sort((a, b) => w[b] - w[a])[0] as RecruitingFactor;
};


/**
 * Where the truth landed inside the report you worked from. The range always
 * contained him, so the question is only where: the top is the steal, the
 * bottom the one you paid over the odds for. Silent in the middle, so the two
 * that mattered stand out.
 */
function verdict(prospect: Prospect, recruitingSkill: number): { text: string; tone: 'positive' | 'warning' } | null {
  const truth = GRADE_LADDER.indexOf(potentialGrade(prospect.player.potential));
  const band = reportedPotential(prospect, recruitingSkill);
  if (band.low === band.high) return null;
  if (truth === GRADE_LADDER.indexOf(band.high)) return { text: 'Top of your scouting report', tone: 'positive' };
  if (truth === GRADE_LADDER.indexOf(band.low)) return { text: 'Bottom of your scouting report', tone: 'warning' };
  return null;
}

export function SigningDay() {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const coach = useDynasty((s) => s.coach);
  const next = useDynasty((s) => s.nextPhase);
  const team = useUserTeam();
  // The skill the winter's reports were cut with, coordinator included.
  const economy = useDynasty((s) => s.economy);
  const recruitingSkill = withStaff(coach.skills, economy.staff).recruiting;

  const [view, setView] = useState<View>('mine');
  const [openId, setOpenId] = useState<Open>(null);

  const { rankings, mine, signed, myRank, walkOns } = useMemo(() => {
    const prospects = season?.recruiting.prospects ?? [];
    const byTeam = new Map<number, Prospect[]>();
    for (const p of prospects) {
      if (p.signedBy === null) continue;
      const list = byTeam.get(p.signedBy) ?? [];
      list.push(p);
      byTeam.set(p.signedBy, list);
    }
    /*
      The walk-ons who report because the class did not cover a spot: drawn on
      the same seed the year roll uses, so the players on this screen are the
      players who arrive. Read in board order, the order the engine takes the
      class in.
    */
    const me = season?.teams[userTeam]?.team;
    const roster: Player[] = me ? [...me.lineup, ...me.bench, ...me.rotation, ...me.bullpen] : [];
    const classPlayers = prospects.filter((p) => p.signedBy === userTeam).map((p) => p.player);
    const table = [...byTeam.entries()]
      .map(([t, list]) => ({ team: t, list, points: classPoints(list) }))
      .sort((a, b) => b.points - a.points);
    // Both lists read in national ranking order, the number beside every name.
    return {
      rankings: table,
      mine: (byTeam.get(userTeam) ?? []).slice().sort(byRank),
      signed: prospects.filter((p) => p.signedBy !== null).sort(byRank),
      myRank: table.findIndex((r) => r.team === userTeam) + 1,
      walkOns: me && season
        ? walkOnClass(roster, classPlayers, me.quality, walkOnSeed(season.recruiting.year, userTeam))
        : [],
    };
  }, [season, userTeam]);

  if (!season || !team) return null;

  const openRecruit = openId?.kind === 'recruit'
    ? season.recruiting.prospects.find((p) => p.id === openId.id) ?? null : null;
  const openWalkOn = openId?.kind === 'walkOn' ? walkOns.find((p) => p.id === openId.id) ?? null : null;
  const schoolAbbr = (i: number | null): string | undefined => (i === null ? undefined : season.teams[i]?.def.abbr);
  const schoolName = (i: number | null): string => (i === null ? 'Nobody' : season.teams[i]?.def.school ?? '?');

  const recruitRow = (p: Prospect, showSchool: boolean) => {
    const call = verdict(p, recruitingSkill);
    return (
      <PlayerRow
        key={p.id}
        name={p.player.name}
        avatar={<Face id={p.id} team={schoolAbbr(p.signedBy)} size={40} />}
        mark={p.signedBy === userTeam && showSchool ? <Tag tone="you">Yours</Tag> : undefined}
        tags={[slotTag(p.player), `#${p.rank}`]}
        meta={showSchool ? `Signed with ${schoolName(p.signedBy)}` : `${stateName(p.state)}${p.committedWeek !== null ? ` · committed week ${p.committedWeek}` : ''}`}
        flags={(
          <>
            <Stars value={p.stars} label="Recruit rating" />
            {call && <StatusBadge tone={call.tone} icon={false}>{call.text}</StatusBadge>}
          </>
        )}
        stats={[
          { label: 'Rating now', value: overallOf(p.player) },
          { label: 'Potential', value: potentialGrade(p.player.potential) },
        ]}
        onClick={() => setOpenId({ kind: 'recruit', id: p.id })}
      />
    );
  };

  return (
    <StepScreen
      bar={(
        <ContinueBar from="signing" note={walkOns.length > 0 ? `${plural(walkOns.length, 'walk-on')} will fill the spots your class did not.` : 'Your class fills every roster spot.'}>
          <ConfirmButton
            variant="primary"
            icon="calendar"
            idle="Start next season"
            armed="Tap again to start the new year"
            armedMeta="The year rolls over"
            onConfirm={() => { void next('signing'); }}
          />
        </ContinueBar>
      )}
    >
      <main className="pb-page">
        <FirstVisit id="signing" />
        <Marquee
          eyebrow="Signing day · The class is in"
          title="Your incoming class"
          numbers={[
            { label: 'Signed', value: mine.length, note: `${mine.filter((m) => m.stars >= 4).length} at four stars or more` },
            { label: 'Class rank', value: myRank > 0 ? `#${myRank}` : '—', note: `of ${rankings.length} schools` },
            { label: 'Class score', value: classPoints(mine), note: 'Stars, squared' },
          ]}
        />
        <SegmentedControl<View>
          label="Signing day"
          value={view}
          onChange={setView}
          options={[
            { value: 'mine', label: 'Your class' },
            { value: 'rankings', label: 'Class rankings' },
            { value: 'all', label: 'Top signings' },
          ]}
        />

        {view === 'mine' && (
          <>
            {mine.length === 0 ? (
              <EmptyState icon="person" title="Nobody signed" text="Every open spot gets a walk-on, well below the recruits you were chasing." />
            ) : (
              <List label="Your class">{mine.map((p) => recruitRow(p, false))}</List>
            )}
            <section className="pb-stack">
              <SectionHeader
                title="Walk-ons joining"
                count={walkOns.length || undefined}
              />
              {walkOns.length === 0 ? (
                <p className="pb-text-muted">None needed: your class covered every opening.</p>
              ) : (
                <List label="Walk-ons">
                  {walkOns.map((p) => (
                    <PlayerRow
                      key={p.id}
                      name={p.name}
                      avatar={<Face id={p.id} team={team.def.abbr} size={40} />}
                      tags={[slotTag(p), `Age ${p.age}`]}
                      flags={<StatusBadge tone="neutral" icon={false}>Walk-on · one year</StatusBadge>}
                      stats={[
                        { label: 'Rating now', value: overallOf(p) },
                        { label: 'Potential', value: potentialGrade(p.potential) },
                      ]}
                      onClick={() => setOpenId({ kind: 'walkOn', id: p.id })}
                    />
                  ))}
                </List>
              )}
            </section>
          </>
        )}

        {view === 'rankings' && (
          <Card flush>
            <Table
              label="Class rankings"
              columns={[
                { label: '#', width: '28px', align: 'right' },
                { label: 'School', grow: true },
                { label: 'Signed', width: '52px', align: 'right' },
                { label: 'Score', title: 'Stars, squared and added up', width: '52px', align: 'right', strong: true },
              ]}
              rows={[
                ...rankings.slice(0, 25).map((row, i) => ({
                  key: row.team,
                  you: row.team === userTeam,
                  cells: [
                    <b key="r" className="pb-rank">{i + 1}</b>,
                    <TeamCell key="t" abbr={season.teams[row.team]?.def.abbr ?? ''} name={schoolName(row.team)} you={row.team === userTeam} />,
                    row.list.length,
                    row.points,
                  ],
                })),
                ...(myRank > 25 ? [{
                  key: 'you', you: true, divider: true,
                  cells: [
                    <b key="r" className="pb-rank">{myRank}</b>,
                    <TeamCell key="t" abbr={team.def.abbr} name={team.def.school} you />,
                    mine.length,
                    classPoints(mine),
                  ],
                }] : []),
              ]}
              caption="Score is each signing's stars, squared and added up, so one five-star counts more than four two-stars."
            />
          </Card>
        )}

        {view === 'all' && (
          <List label="Top signings">{signed.slice(0, 60).map((p) => recruitRow(p, true))}</List>
        )}
      </main>

      {openRecruit && (
        <RecruitSheet
          prospect={openRecruit}
          userTeam={userTeam}
          recruitingSkill={recruitingSkill}
          onClose={() => setOpenId(null)}
        />
      )}
      {openWalkOn && (
        <WalkOnSheet man={openWalkOn} school={team.def.school} abbr={team.def.abbr} onClose={() => setOpenId(null)} />
      )}
    </StepScreen>
  );
}

/** Last spring's high-school line, in words. */
function SchoolLine({ player }: { player: Player }) {
  return (
    <Card eyebrow="Last spring" title="In high school">
      <DescriptionList items={highSchoolLine(player).map((row) => ({ label: HIGH_SCHOOL_WORD[row.label] ?? row.label, value: row.value }))} />
    </Card>
  );
}

function RecruitSheet(
  { prospect, userTeam, recruitingSkill, onClose }:
  { prospect: Prospect; userTeam: number; recruitingSkill: number; onClose: () => void },
) {
  const season = useDynasty((s) => s.season);
  const p = prospect.player;
  const to = prospect.signedBy === null ? undefined : season?.teams[prospect.signedBy];
  const mine = prospect.signedBy === userTeam;
  const chased = Object.entries(prospect.points)
    .map(([t, pts]) => ({ team: Number(t), pts }))
    .filter((r) => r.pts > 0)
    .sort((a, b) => b.pts - a.pts);
  const band = reportedOverall(prospect, recruitingSkill);
  const ceiling = reportedPotential(prospect, recruitingSkill);
  const call = verdict(prospect, recruitingSkill);

  return (
    <Sheet
      eyebrow={`#${prospect.rank} in the country · ${stateName(prospect.state)}`}
      title={p.name}
      subtitle={`${slotTag(p).title} · Age ${p.age} · ${handsText(p.bats, p.throws)}`}
      lead={<Face id={p.id} team={to?.def.abbr} size={48} />}
      onClose={onClose}
      tall
    >
      <Callout tone={mine ? 'positive' : 'neutral'} icon={mine ? 'check-circled' : 'info'} title={`Signed with ${to?.def.school ?? 'nobody'}${mine ? ': you' : ''}`}>
        {prospect.committedWeek !== null ? `He committed in week ${prospect.committedWeek}.` : 'He signed on signing day.'}
      </Callout>
      <StatGroup
        size="sm"
        items={[
          { label: 'Rating now', value: overallOf(p) },
          { label: 'Potential', value: potentialGrade(p.potential) },
          { label: 'Wanted most', value: <span className="pb-stat__phrase">{capsWords(RECRUITING_FACTOR_LABEL[topPriority(prospect)])}</span> },
        ]}
      />
      <Card
        eyebrow="Your scouting report had him at"
        title={`Rating ${band.low}–${band.high} · potential ${ceiling.low}–${ceiling.high}`}
        trailing={call ? <StatusBadge tone={call.tone} icon={false}>{call.text}</StatusBadge> : undefined}
      >
        <p className="pb-text-muted">Better recruiting skill narrows the range.</p>
      </Card>
      <SchoolLine player={p} />
      {chased.length > 1 && (
        <Card eyebrow="Recruiting points spent on him" title="Who was in on him" flush>
          <Table
            dense
            label="Who was in on him"
            columns={[
              { label: 'School', grow: true },
              { label: 'Points', width: '64px', align: 'right', strong: true },
            ]}
            rows={chased.map((r) => ({
              key: r.team,
              you: r.team === userTeam,
              cells: [
                <TeamCell
                  key="t"
                  abbr={season?.teams[r.team]?.def.abbr ?? ''}
                  name={season?.teams[r.team]?.def.school ?? '?'}
                  sub={r.team === prospect.signedBy ? 'Signed him' : undefined}
                  you={r.team === userTeam}
                />,
                Math.round(r.pts),
              ],
            }))}
          />
        </Card>
      )}
    </Sheet>
  );
}

/**
 * A walk-on's card: a recruit's card with the recruiting taken out. No
 * report, because you never had him at anything; no list of who was in on
 * him, because nobody was.
 */
function WalkOnSheet(
  { man, school, abbr, onClose }:
  { man: Player; school: string; abbr: string; onClose: () => void },
) {
  return (
    <Sheet
      eyebrow="Walk-on · one year"
      title={man.name}
      subtitle={`${slotTag(man).title} · Age ${man.age} · ${handsText(man.bats, man.throws)}`}
      lead={<Face id={man.id} team={abbr} size={48} />}
      onClose={onClose}
      tall
    >
      <Callout tone="neutral" title={`Turned up at ${school}`}>
        Unrecruited. He fills a spot for one year.
      </Callout>
      <StatGroup
        size="sm"
        items={[
          { label: 'Rating now', value: overallOf(man) },
          { label: 'Potential', value: potentialGrade(man.potential) },
          { label: 'Class', value: CLASS_NAME[man.classYear] },
        ]}
      />
      <SchoolLine player={man} />
    </Sheet>
  );
}
