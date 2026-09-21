// ProgramRooms.tsx
// The rooms that run the program: Budget, Staff, Facilities and the
// Recruiting network. Each opens from the Program hub as a page with a back
// link, and each spends from the same budget, so the money travels with you
// in the room's marquee rather than a strip under it.
//
// A room is meant to feel like a place you walked into. Each one opens with
// its marquee and the numbers that matter, then a row of plaques — the three
// desks in the staff room, the three buildings on the campus, the states you
// recruit — and the one you pick opens underneath. The plaques carry each
// thing's state, so nothing is hidden by the choice; what has gone is the
// column of rows and the paragraph explaining what a room is for.

import { useEffect, useState, type ReactNode } from 'react';
import { useDynasty } from '../../state/store.js';
import { handles } from '../../state/depth.js';
import {
  annualBudget, BUILDINGS, buildingSpec, dollars, facilityEffectAt, facilityLevel, facilityUpgradeCost,
  FACILITY_MAX_LEVEL, marketFor, PIPELINE_MIN, pipelineStrength, PROJECT_LABEL, remaining,
  SCOUT_COST, SCOUT_DAYS, SEAT_LABEL, SEAT_NOTE, SEATS, shapeOf, staffPlan, staffProjectWeeks, wageBill,
  DIRECTIVE_LABEL, type Assistant, type Building, type StaffSeat,
} from '../../engine/economy.js';
import { RECRUITING_WEEKS } from '../../engine/recruiting.js';
import { projectCandidates } from '../../engine/staffProjects.js';
import type { SeasonState } from '../../engine/season.js';
import { REGION_OF_STATE, STATES_BY_REGION } from '../../data/schools.js';
import {
  BudgetSummary, Button, Callout, ConfirmButton, DescriptionList, FacilityCard, List, ListRow,
  Marquee, Meter, Monogram, Plaque, SectionHeader, SegmentedControl, Sheet, StaffCard, StatGroup,
  StatusBadge, TileGrid, type CompareRow, type Tone,
} from '../components/ui/index.js';
import { GodBolt } from '../god/GodBolt.js';
import { FirstVisit } from '../Tutorial.js';
import { FacilityArt } from '../ProgramBits.js';
import { staffWorkStatus, useStaffWork } from '../StaffWorkPanel.js';
import {
  StaffCandidateDialog, StaffSkillsMeter, staffImpactItems, staffSkills,
} from '../StaffCandidateDialog.js';
import { FACILITY_NAME, firstName, plural, stateName } from '../words.js';

type Owner = SeasonState['teams'][number];

/** The seat's name on its plaque: one word, because the plaque is small. */
const SEAT_SHORT: Record<StaffSeat, string> = {
  pitching: 'Pitching',
  hitting: 'Hitting',
  recruiting: 'Recruiting',
};

/** A building's name on its plaque, short enough for a third of the row. */
const FACILITY_SHORT: Record<Building, string> = {
  cage: 'Hitting barn',
  pen: 'Pitching lab',
  clubhouse: 'Clubhouse',
};

/** The back link every room shares. */
export function useRoomBack(): { label: string; onClick: () => void; guide: string } | undefined {
  const setSheet = useDynasty((s) => s.setProgramSheet);
  const closeCoach = useDynasty((s) => s.closeCoach);
  // A room opened straight into an overlay (the board from the season opener,
  // a letter's link) already has the overlay's Back; a second back control
  // that goes somewhere else would only confuse.
  const direct = useDynasty((s) => s.overlay === 'program' && s.overlayEntrySheet === s.programSheet);
  if (direct) return undefined;
  return { label: 'Program', guide: 'room-back', onClick: () => { closeCoach(); setSheet('overview'); } };
}

/** What is left to spend this season, on every room that spends it. */
export function BudgetChip({ team }: { team: Owner }) {
  const economy = useDynasty((s) => s.economy);
  const left = Math.max(0, remaining(economy, team.prestige));
  return <StatusBadge tone="neutral" size="lg" icon={false}>{dollars(left)} left</StatusBadge>;
}

/** The facility a coach's sheet asked to see, opened when the room opens. */
let pendingFacility: Building | null = null;

function useGoToFacility(): (b: Building) => void {
  const setSheet = useDynasty((s) => s.setProgramSheet);
  const closeCoach = useDynasty((s) => s.closeCoach);
  return (b) => { pendingFacility = b; closeCoach(); setSheet('facilities'); };
}

/* ------------------------------------------------------------------ Budget */

export function BudgetRoom({ team }: { team: Owner }) {
  const economy = useDynasty((s) => s.economy);
  const season = useDynasty((s) => s.season);
  const setSheet = useDynasty((s) => s.setProgramSheet);
  const back = useRoomBack();
  const budget = annualBudget(team.prestige);
  const wages = wageBill(economy.staff);
  const left = remaining(economy, team.prestige);
  const staffCount = SEATS.filter((seat) => economy.staff[seat]).length;
  const day = season?.dayIndex ?? 0;
  const books = Object.values(economy.scouted).filter((until) => until >= day).length;
  const next = BUILDINGS
    .map((b) => {
      const level = facilityLevel(economy, b.key);
      const to = Math.min(FACILITY_MAX_LEVEL, level + 1);
      return { key: b.key, level, to, cost: facilityUpgradeCost(b.key, to) };
    })
    .filter((b) => b.level < FACILITY_MAX_LEVEL)
    .sort((a, b) => a.cost - b.cost)[0] ?? null;

  return (
    <main className="pb-page">
      <Marquee
        back={back}
        eyebrow={`${team.def.school} · Prestige ${team.prestige}`}
        title="Budget"
        trailing={<GodBolt target={{ kind: 'money' }} label="Edit the budget and staff in god mode" />}
      />
      <FirstVisit id="budget" />
      <BudgetSummary
        total={budget}
        available={Math.max(0, left)}
        parts={[
          { label: 'Staff wages', value: wages },
          { label: 'Facilities and scouting', value: economy.spent },
        ]}
      />
      {next && left < next.cost && (
        <Callout tone="neutral" title={`${dollars(next.cost - Math.max(0, left))} short of the next building`}>
          A new budget arrives next season.
        </Callout>
      )}
      <section>
        <SectionHeader title="Where it goes" />
        <TileGrid cols={3} label="Where the budget goes">
          <Plaque
            icon="person"
            label="Staff"
            value={dollars(wages)}
            note={`${staffCount} of 3 seats`}
            guide="money-staff"
            onClick={() => setSheet('staff')}
          />
          <Plaque
            icon="home"
            label="Facilities"
            value={next ? dollars(next.cost) : dollars(economy.spent)}
            note={next ? `${FACILITY_SHORT[next.key]} L${next.to}` : 'Fully built'}
            guide="money-facilities"
            onClick={() => setSheet('facilities')}
          />
          <Plaque
            icon="globe"
            label="Reports"
            value={books}
            note={`${dollars(SCOUT_COST)} · ${SCOUT_DAYS} days`}
            onClick={() => setSheet('network')}
          />
        </TileGrid>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------- Staff */

/** What an empty seat would do for you, in a clause rather than a sentence. */
const SEAT_PITCH = (seat: StaffSeat, home: string): string => (
  seat === 'hitting' ? 'Develops hitters · runs hitting projects'
    : seat === 'pitching' ? 'Develops pitchers · runs pitching projects'
      : `Builds pipelines beyond ${stateName(home)}`
);

export function StaffRoom({ team }: { team: Owner }) {
  const economy = useDynasty((s) => s.economy);
  const year = useDynasty((s) => s.year);
  const season = useDynasty((s) => s.season);
  const runsStaff = useDynasty((s) => handles(s.depth, 'assistants'));
  const coachSeat = useDynasty((s) => s.coachSeat);
  const openCoach = useDynasty((s) => s.openCoach);
  const back = useRoomBack();
  const goToFacility = useGoToFacility();
  const wages = wageBill(economy.staff);
  const staffCount = SEATS.filter((seat) => economy.staff[seat]).length;
  const week = season?.recruiting.week ?? 0;
  const weeksAvailable = week >= 1 ? Math.max(0, RECRUITING_WEEKS - week + 1) : 0;
  const running = SEATS.filter((seat) => staffPlan(economy, seat).project).length;

  // The desk you are standing at. An open seat is the one that wants you, so
  // the room opens on the first of them.
  const [desk, setDesk] = useState<StaffSeat>(() => SEATS.find((seat) => !economy.staff[seat]) ?? SEATS[0]!);
  const man = economy.staff[desk];

  const plan = man ? staffPlan(economy, desk) : null;
  const status = staffWorkStatus(economy, desk, weeksAvailable);
  const facilityName = FACILITY_NAME[status.facility];
  const project = plan?.project;
  const target = project?.playerId
    ? projectCandidates(team.team, desk, project.kind)
      .find((p) => String(p.id) === project.playerId)?.name ?? 'Player left the roster'
    : project?.state ? stateName(project.state) : undefined;
  const ending = !!man && man.until !== undefined && man.until <= year;
  const weeks = project ? project.weeksTotal : 0;
  const done = project ? project.weeksTotal - project.weeksLeft : 0;

  const work = status.state === 'locked' ? {
    state: status.state,
    text: `The ${facilityName} unlocks projects here.`,
    action: {
      label: `Build the ${facilityName}`,
      meta: dollars(facilityUpgradeCost(status.facility, 1)),
      onClick: () => goToFacility(status.facility),
    },
  } : status.state === 'ready' ? {
    state: status.state,
    text: `${plural(staffProjectWeeks(economy, desk), 'week')} a project · ${plural(weeksAvailable, 'week')} left`,
    action: { label: 'Assign a project', onClick: () => openCoach(desk) },
  } : status.state === 'waiting' ? {
    state: status.state,
    text: 'Opens with the recruiting season.',
  } : {
    state: status.state,
    when: status.state === 'active' ? `Week ${Math.min(weeks, done + 1)} of ${weeks}` : undefined,
    title: project ? `${PROJECT_LABEL[project.kind]}${target ? ` · ${target}` : ''}` : undefined,
    text: status.state === 'paused'
      ? (status.level < 1 ? `Needs the ${facilityName}.` : 'Resumes next recruiting season.')
      : undefined,
    done,
    total: weeks,
    action: status.state === 'paused' && status.level < 1
      ? { label: `Build the ${facilityName}`, meta: dollars(facilityUpgradeCost(status.facility, 1)), onClick: () => goToFacility(status.facility) }
      : undefined,
  };

  return (
    <main className="pb-page">
      <Marquee
        back={back}
        eyebrow={`${team.def.school} · Staff room`}
        title="Coaching staff"
        trailing={<BudgetChip team={team} />}
        numbers={[
          { label: 'Seats', value: staffCount, unit: '/3' },
          { label: 'Wages', value: dollars(wages), note: 'a year' },
          {
            label: 'Projects',
            value: running,
            note: weeksAvailable > 0 ? `${plural(weeksAvailable, 'week')} left` : 'Out of season',
          },
        ]}
      />
      <FirstVisit id="staff" />
      {!runsStaff && (
        <Callout tone="info" title="Your athletic director runs the staff" guide="staff-delegated" />
      )}

      <TileGrid cols={3} label="The three desks">
        {SEATS.map((seat) => {
          const sitting = economy.staff[seat];
          const seatStatus = staffWorkStatus(economy, seat, weeksAvailable);
          const seatEnding = !!sitting && sitting.until !== undefined && sitting.until <= year;
          return (
            <Plaque
              key={seat}
              art={<Monogram name={sitting?.name} vacant={!sitting} size={30} />}
              label={SEAT_SHORT[seat]}
              value={sitting ? sitting.rating : '—'}
              note={sitting ? (seatEnding ? 'Contract ends' : seatStatus.label) : 'Open seat'}
              tone={seatEnding ? 'warning' : seatStatus.state === 'active' ? 'info' : undefined}
              selected={seat === desk}
              guide={seat === 'hitting' ? 'seat-hitting' : undefined}
              onClick={() => setDesk(seat)}
            />
          );
        })}
      </TileGrid>

      <section className="pb-stack">
        {!man ? (
          <StaffCard
            vacant
            roleLabel={SEAT_LABEL[desk]}
            pitch={SEAT_PITCH(desk, team.def.state)}
            onHire={() => openCoach(desk)}
          />
        ) : (
          <StaffCard
            roleLabel={SEAT_LABEL[desk]}
            name={man.name}
            specialty={shapeOf(man)}
            rating={man.rating}
            skills={staffSkills(man)}
            focus={plan ? DIRECTIVE_LABEL[plan.directive] : undefined}
            work={work}
            contract={{ wage: `${dollars(man.wage)}/yr`, through: man.until ?? year + 1, ending }}
            onOpen={() => openCoach(desk)}
          />
        )}
      </section>

      {coachSeat !== null && (
        <CoachSeatSheet
          key={`${coachSeat}:${economy.staff[coachSeat]?.id ?? 'open'}`}
          team={team}
          seat={coachSeat}
          onFacility={goToFacility}
        />
      )}
    </main>
  );
}

/**
 * The fact about YOUR side that makes this coach worth more or less here.
 * It names something true about the roster or the head coach and stops: it
 * never says which candidate to take.
 */
function fitLine(seat: StaffSeat, m: Assistant, own: number, youngSide: number): string {
  if (seat === 'recruiting') {
    return own >= 55
      ? 'Your recruiting skill is already strong, so this coach adds a smaller bonus.'
      : 'This coach would raise your recruiting skill.';
  }
  const what = seat === 'hitting' ? 'hitters' : 'pitchers';
  if (m.winter >= 0.5) {
    return youngSide >= 5
      ? `${youngSide} of your ${what} are freshmen or sophomores, who grow the most.`
      : `Your ${what} are mostly juniors and seniors.`;
  }
  return own >= 55
    ? 'Your game coaching is already strong, so this coach adds a smaller bonus.'
    : `Your own ${seat === 'hitting' ? 'offense' : 'defense'} skill is ${own}.`;
}

/** The market is not a ranking: a stable shuffle, so card one is not "the best". */
function staffMarketKey(m: Assistant, year: number, seat: StaffSeat): number {
  const text = `${m.id}:${year}:${seat}`;
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A coach's seat: the person, their work, their contract, or the candidates for an open seat. */
function CoachSeatSheet({ team, seat, onFacility }: { team: Owner; seat: StaffSeat; onFacility: (b: Building) => void }) {
  const economy = useDynasty((s) => s.economy);
  const coachSkills = useDynasty((s) => s.coach.skills);
  const year = useDynasty((s) => s.year);
  const season = useDynasty((s) => s.season);
  const phase = useDynasty((s) => s.phase);
  const runsStaff = useDynasty((s) => handles(s.depth, 'assistants'));
  const hireAssistant = useDynasty((s) => s.hireAssistant);
  const fireAssistant = useDynasty((s) => s.fireAssistant);
  const renewAssistant = useDynasty((s) => s.renewAssistant);
  const closeCoach = useDynasty((s) => s.closeCoach);
  const [view, setView] = useState<'work' | 'contract'>('work');
  const [showReplacements, setShowReplacements] = useState(false);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const man = economy.staff[seat];
  const work = useStaffWork({ team, seat, initialState: pendingNetworkState ?? undefined, onFacility });
  useEffect(() => { pendingNetworkState = null; }, []);

  const left = remaining(economy, team.prestige);
  const worldKey = String(season?.seed ?? 0);
  const rawMarket = marketFor(worldKey, year, seat);
  const market = rawMarket
    .filter((c) => c.id !== man?.id)
    .sort((a, b) => staffMarketKey(a, year, seat) - staffMarketKey(b, year, seat));
  const youngBats = team.team.lineup.concat(team.team.bench).filter((q) => q.classYear === 'FR' || q.classYear === 'SO').length;
  const youngArms = team.team.rotation.concat(team.team.bullpen).filter((q) => q.classYear === 'FR' || q.classYear === 'SO').length;
  const ending = !!man && man.until !== undefined && man.until <= year;
  const history = (economy.projectHistory ?? []).filter((r) => r.seat === seat).slice(0, 3);

  const candidates = (
    <section className="pb-stack">
      <SectionHeader title={man ? 'Available replacements' : 'Available coaches'} count={market.length} />
      {runsStaff && !man && market.every((c) => c.wage > left) && (
        <Callout tone="warning" title="No coach fits your budget" guide={seat === 'hitting' ? 'hire-blocked' : undefined}>
          {dollars(Math.max(0, left))} left this season.
        </Callout>
      )}
      <List label={`${SEAT_LABEL[seat]} candidates`} guide={seat === 'hitting' && !man && runsStaff ? 'hire-options' : undefined}>
          {market.map((c) => {
            const affordable = left + (man?.wage ?? 0) >= c.wage;
            const split = staffSkills(c);
            return (
              <ListRow
                key={c.id}
                lead={<Monogram name={c.name} />}
                title={c.name}
                subtitle={`${shapeOf(c)} · ${dollars(c.wage)} a year${c.pipelineState ? ` · knows ${stateName(c.pipelineState)}` : ''}`}
                status={affordable ? undefined : <StatusBadge tone="warning">Over budget</StatusBadge>}
                value={c.rating}
                unit="/100"
                onClick={() => setCandidateId(c.id)}
              >
                <span className="pb-sr">{`${split[0]!.label} ${split[0]!.value}, ${split[1]!.label} ${split[1]!.value}`}</span>
              </ListRow>
            );
          })}
      </List>
    </section>
  );

  const candidate = market.find((m) => m.id === candidateId);
  const candidateSheet = candidate ? (
    <StaffCandidateDialog
      candidate={candidate}
      incumbent={man}
      budgetLeft={left}
      skills={coachSkills}
      canManage={runsStaff}
      projectActive={!!staffPlan(economy, seat).project}
      fit={fitLine(seat, candidate,
        seat === 'hitting' ? coachSkills.offense : seat === 'pitching' ? coachSkills.defense : coachSkills.recruiting,
        seat === 'pitching' ? youngArms : youngBats)}
      onClose={() => setCandidateId(null)}
      onHire={() => {
        const slot = rawMarket.findIndex((m) => m.id === candidate.id);
        if (slot < 0 || !runsStaff) return false;
        hireAssistant(seat, slot);
        if (useDynasty.getState().economy.staff[seat]?.id === candidate.id) {
          setCandidateId(null); setShowReplacements(false); setView('work');
          return true;
        }
        return false;
      }}
    />
  ) : null;

  if (!man) {
    return (
      <>
        <Sheet
          eyebrow={SEAT_LABEL[seat]}
          title="Open seat"
          subtitle="Choose a coach for this role"
          lead={<Monogram vacant size={44} />}
          onClose={closeCoach}
          closeGuide="overlay-back"
          layer={false}
          tall
        >
          <Callout tone="info" icon="person" title={`What a ${SEAT_LABEL[seat].toLowerCase()} does`}>
            {SEAT_NOTE[seat]}
          </Callout>
          {candidates}
        </Sheet>
        {candidateSheet}
      </>
    );
  }

  const skills = staffSkills(man);
  return (
    <>
      <Sheet
        eyebrow={SEAT_LABEL[seat]}
        title={man.name}
        subtitle={`${shapeOf(man)} · Age ${man.age} · Season ${Math.max(1, year - (man.joinedYear ?? year) + 1)} here`}
        lead={<Monogram name={man.name} size={44} />}
        onClose={closeCoach}
        closeGuide="overlay-back"
        layer={false}
        tall
        footer={view === 'work' ? work.footer : null}
      >
        <StatGroup
          size="sm"
          items={[
            { label: 'Rating', value: man.rating, note: `${skills[0]!.value} + ${skills[1]!.value}` },
            { label: 'Wage', value: dollars(man.wage), unit: '/yr' },
            ending
              ? { label: 'Signed to', value: man.until ?? year, note: 'Ends this season', noteTone: 'warning' }
              : { label: 'Signed to', value: man.until ?? year + 1 },
          ]}
        />
        <SegmentedControl<'work' | 'contract'>
          label="Coach"
          value={view}
          onChange={(next) => { setView(next); setShowReplacements(false); }}
          options={[{ value: 'work', label: 'Work' }, { value: 'contract', label: 'Skills and contract' }]}
        />
        {view === 'work' && (
          <>
            {work.body}
            {history.length > 0 && (
              <section className="pb-stack">
                <SectionHeader level={3} title="Recent results" />
                <List label="Recent project results">
                  {history.map((r, i) => (
                    <ListRow
                      key={`${r.year}:${r.week}:${i}`}
                      title={`${PROJECT_LABEL[r.kind]}${r.state ? ` · ${stateName(r.state)}` : ''}`}
                      subtitle={r.changes.length
                        ? r.changes.map((c) => `${c.name}: ${c.attribute} ${Math.round(c.before)} → ${Math.round(c.after)}`).join(' · ')
                        : r.took === false ? 'No gain this time' : 'No eligible player remained'}
                      status={(
                        <StatusBadge tone={r.took === false ? 'neutral' : 'positive'} icon={r.took === false ? 'dot' : 'check'}>
                          {r.took === false ? 'Did not take' : r.focused ? 'Focus bonus earned' : 'Completed'}
                        </StatusBadge>
                      )}
                      value={<small className="pb-row__when">{r.year}, week {r.week}</small>}
                    />
                  ))}
                </List>
              </section>
            )}
          </>
        )}
        {view === 'contract' && (
          <>
            <StaffSkillsMeter coach={man} />
            <section className="pb-stack">
              <SectionHeader level={3} title="What this coach adds" />
              <StatGroup size="sm" items={staffImpactItems(man, coachSkills)} />
            </section>
            <section className="pb-stack">
              <SectionHeader level={3} title="Contract" />
              <DescriptionList
                items={[
                  { label: 'Wage', value: `${dollars(man.wage)} a year` },
                  ending
                    ? { label: 'Signed through', value: String(man.until ?? year), tone: 'warning', icon: 'clock', note: phase !== null ? 'Renew it now or let it end' : 'Renew it in the offseason' }
                    : { label: 'Signed through', value: String(man.until ?? year + 1) },
                ]}
              />
              {runsStaff && (
                <div className="pb-stack">
                  {phase !== null && ending && (
                    <Button variant="primary" block onClick={() => renewAssistant(seat)}>Renew through {year + 2}</Button>
                  )}
                  <Button variant="secondary" block onClick={() => setShowReplacements((open) => !open)}>
                    {showReplacements ? 'Hide the candidates' : 'Find a replacement'}
                  </Button>
                  <ConfirmButton
                    variant="danger"
                    block
                    idle="Release coach"
                    armed={`Tap again to release ${firstName(man.name)}`}
                    armedMeta={`Frees ${dollars(man.wage)}`}
                    onConfirm={() => { setShowReplacements(false); fireAssistant(seat); }}
                  />
                </div>
              )}
            </section>
            {showReplacements && candidates}
          </>
        )}
      </Sheet>
      {candidateSheet}
    </>
  );
}

/* -------------------------------------------------------------- Facilities */

const weeksAt = (level: number): number => (level >= 3 ? 3 : level >= 2 ? 4 : 5);

/** A building's rows for the comparison, read off the engine's own numbers. */
function facilityRows(kind: Building, level: number): CompareRow[] {
  const spec = buildingSpec(kind);
  const next = Math.min(FACILITY_MAX_LEVEL, level + 1);
  const now = facilityEffectAt(kind, level);
  const nxt = facilityEffectAt(kind, next);
  const unbuilt = level === 0;
  const rows: CompareRow[] = [];
  const num = (label: string, hint: string | undefined, a: number, b: number, extra: Partial<CompareRow>): void => {
    rows.push({ label, hint, now: a, next: b, nowText: unbuilt ? '—' : undefined, ...extra });
  };
  if (spec.bat > 0 && spec.arm > 0) {
    num('Hitter and pitcher training', 'Extra growth each offseason', Math.round(now.bat), Math.round(nxt.bat), { signed: true });
  } else {
    if (spec.bat > 0) num('Hitter training', 'Extra growth each offseason', Math.round(now.bat), Math.round(nxt.bat), { signed: true });
    if (spec.arm > 0) num('Pitcher training', 'Extra growth each offseason', Math.round(now.arm), Math.round(nxt.arm), { signed: true });
  }
  if (spec.guard < 1) {
    num('Arm injury risk', undefined, -Math.round((1 - now.guard) * 100), -Math.round((1 - nxt.guard) * 100), { unit: '%', better: 'down' });
  }
  if (spec.pitch > 0) {
    num('Appeal to recruits', undefined, Math.round(now.pitch * 100), Math.round(nxt.pitch * 100), { unit: '%', signed: true });
  }
  const seat: StaffSeat = kind === 'cage' ? 'hitting' : kind === 'pen' ? 'pitching' : 'recruiting';
  const label = `${SEAT_LABEL[seat]} projects`;
  if (unbuilt) rows.push({ label, nowText: 'Locked', nextText: '5 wk', changeText: 'Unlocks' });
  else if (level >= FACILITY_MAX_LEVEL) rows.push({ label, nowText: `${weeksAt(level)} wk` });
  else rows.push({ label, now: weeksAt(level), next: weeksAt(next), unit: ' wk', better: 'down' });
  return rows;
}

export function FacilitiesRoom({ team }: { team: Owner }) {
  const economy = useDynasty((s) => s.economy);
  const runsFacilities = useDynasty((s) => handles(s.depth, 'facilities'));
  const build = useDynasty((s) => s.build);
  const upgradeFacility = useDynasty((s) => s.upgradeFacility);
  const back = useRoomBack();
  const left = remaining(economy, team.prestige);
  const built = BUILDINGS.filter((b) => facilityLevel(economy, b.key) > 0).length;
  const levels = BUILDINGS.reduce((n, b) => n + facilityLevel(economy, b.key), 0);

  // Arriving from a coach's "Build the Pitching Lab" opens that building; so
  // does landing here with nothing asked for, on the cheapest thing you could
  // do next.
  const [shown, setShown] = useState<Building>(() => {
    const want = pendingFacility;
    pendingFacility = null;
    if (want) return want;
    const cheapest = BUILDINGS
      .map((b) => ({ key: b.key, level: facilityLevel(economy, b.key) }))
      .filter((b) => b.level < FACILITY_MAX_LEVEL)
      .sort((a, b) => facilityUpgradeCost(a.key, a.level + 1) - facilityUpgradeCost(b.key, b.level + 1))[0];
    return cheapest?.key ?? BUILDINGS[0]!.key;
  });

  const spec = BUILDINGS.find((b) => b.key === shown) ?? BUILDINGS[0]!;
  const level = facilityLevel(economy, spec.key);
  const maxed = level >= FACILITY_MAX_LEVEL;
  const cost = maxed ? undefined : facilityUpgradeCost(spec.key, level + 1);

  return (
    <main className="pb-page">
      <Marquee
        back={back}
        eyebrow={`${team.def.school} · Campus`}
        title="Facilities"
        trailing={<BudgetChip team={team} />}
        numbers={[
          { label: 'Built', value: built, unit: '/3' },
          { label: 'Levels', value: levels, unit: '/9' },
          {
            label: 'Next',
            value: cost != null ? dollars(cost) : '—',
            note: cost != null ? (cost <= Math.max(0, left) ? 'Within budget' : 'Over budget') : 'Fully built',
            tone: cost != null ? (cost <= Math.max(0, left) ? 'positive' : 'warning') : undefined,
          },
        ]}
      />
      <FirstVisit id="facilities" />
      {!runsFacilities && (
        <Callout tone="info" title="Your athletic director runs the building projects" guide="facility-delegated" />
      )}

      <TileGrid cols={3} label="Your buildings">
        {BUILDINGS.map((b) => {
          const lv = facilityLevel(economy, b.key);
          const full = lv >= FACILITY_MAX_LEVEL;
          const price = full ? undefined : facilityUpgradeCost(b.key, lv + 1);
          return (
            <Plaque
              key={b.key}
              art={<FacilityArt kind={b.key} className="pb-facility-art" />}
              label={FACILITY_SHORT[b.key]}
              value={full ? 'Max' : `L${lv}`}
              note={full ? 'Fully built' : price != null ? dollars(price) : undefined}
              tone={full ? 'positive' : price != null && price > Math.max(0, left) ? 'warning' : undefined}
              selected={b.key === shown}
              guide={b.key === 'cage' ? 'facility-cage' : undefined}
              onClick={() => setShown(b.key)}
            />
          );
        })}
      </TileGrid>

      <div data-facility={spec.key} className="pb-anchor">
        <FacilityCard
          key={spec.key}
          kind={spec.key}
          name={FACILITY_NAME[spec.key]}
          blurb={spec.blurb}
          level={level}
          max={FACILITY_MAX_LEVEL}
          benefits={facilityRows(spec.key, level)}
          cost={cost}
          budgetLeft={Math.max(0, left)}
          delegated={!runsFacilities}
          onUpgrade={() => (level === 0 ? build(spec.key) : upgradeFacility(spec.key))}
          guide={spec.key === 'cage' ? { cta: 'facility-cta', blocked: 'facility-blocked' } : undefined}
        />
      </div>
    </main>
  );
}

/* ----------------------------------------------------------------- Network */

/** The state a room asked the coordinator's sheet to open on. */
let pendingNetworkState: string | null = null;

const TIER: Array<{ at: number; label: string; tone: Tone }> = [
  { at: 80, label: 'Strong', tone: 'positive' },
  { at: 60, label: 'Established', tone: 'positive' },
  { at: PIPELINE_MIN, label: 'Emerging', tone: 'info' },
  { at: 0, label: 'Cold', tone: 'neutral' },
];
const tierOf = (strength: number) => TIER.find((t) => strength >= t.at) ?? TIER[TIER.length - 1]!;

/** A tier's colour, for the plaque's note. */
const NOTE_TONE: Record<string, 'positive' | 'info' | undefined> = {
  Strong: 'positive', Established: 'positive', Emerging: 'info', Cold: undefined,
};

export function NetworkRoom({ team }: { team: Owner }) {
  const economy = useDynasty((s) => s.economy);
  const season = useDynasty((s) => s.season);
  const setSheet = useDynasty((s) => s.setProgramSheet);
  const openCoach = useDynasty((s) => s.openCoach);
  const back = useRoomBack();
  const [explore, setExplore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const home = team.def.state;
  const coordinator = economy.staff.recruiting;
  const week = season?.recruiting.week ?? 0;
  const weeksAvailable = week >= 1 ? Math.max(0, RECRUITING_WEEKS - week + 1) : 0;
  const status = staffWorkStatus(economy, 'recruiting', weeksAvailable);
  const project = staffPlan(economy, 'recruiting').project;
  const day = season?.dayIndex ?? 0;
  const books = Object.values(economy.scouted).filter((until) => until >= day).length;

  const known = new Set<string>([home, ...(coordinator?.pipelineState ? [coordinator.pipelineState] : []), ...Object.keys(economy.pipelines ?? {})]);
  const rowOf = (state: string) => ({
    state,
    strength: pipelineStrength(economy, state, home),
    signings: economy.pipelines?.[state]?.signings ?? 0,
    lastWorked: Math.max(economy.pipelines?.[state]?.lastSignedYear ?? 0, economy.pipelines?.[state]?.lastWorkedYear ?? 0),
    sources: [
      state === home ? 'Home' : '',
      state === coordinator?.pipelineState ? 'Coordinator' : '',
      economy.pipelines?.[state] ? 'Earned' : '',
    ].filter(Boolean),
  });
  const mine = [...known].map(rowOf).sort((a, b) => b.strength - a.strength || a.state.localeCompare(b.state));
  const live = mine.filter((p) => p.strength >= PIPELINE_MIN).length;
  const signed = Object.values(economy.pipelines ?? {}).reduce((n, p) => n + (p.signings ?? 0), 0);

  /** One state on the wall: its code large, its tier and its bar. */
  const statePlaque = (r: ReturnType<typeof rowOf>): ReactNode => {
    const tier = tierOf(r.strength);
    return (
      <Plaque
        key={r.state}
        label={stateName(r.state)}
        value={r.strength}
        unit="/100"
        note={r.sources.length > 0 ? `${tier.label} · ${r.sources[0]}` : tier.label}
        tone={NOTE_TONE[tier.label]}
        meta={(
          <Meter
            size="sm"
            value={r.strength}
            max={100}
            ariaLabel={`${stateName(r.state)} strength`}
            markers={[{ at: PIPELINE_MIN }, { at: 60 }]}
          />
        )}
        onClick={() => setOpen(r.state)}
      />
    );
  };

  const openRow = open ? rowOf(open) : null;
  const planWork = (state: string): void => {
    setOpen(null);
    pendingNetworkState = state;
    setSheet('staff');
    openCoach('recruiting');
  };

  return (
    <main className="pb-page">
      <Marquee
        back={back}
        eyebrow={`${team.def.school} · ${stateName(home)}`}
        title="Recruiting network"
        trailing={<BudgetChip team={team} />}
        numbers={[
          { label: 'Pipelines', value: live, note: `${PIPELINE_MIN} or more` },
          { label: 'States known', value: mine.length },
          { label: 'Signed there', value: signed, note: 'All time' },
        ]}
      />
      <FirstVisit id="network" />

      <section>
        <SectionHeader
          title={explore ? 'Every region' : 'Your states'}
          action={{ label: explore ? 'Your states' : 'Explore regions', onClick: () => setExplore((v) => !v) }}
        />
        {!explore ? (
          <TileGrid cols="auto" label="Your states">{mine.map(statePlaque)}</TileGrid>
        ) : (
          <div className="pb-stack">
            {Object.entries(STATES_BY_REGION).map(([region, states]) => (
              <section key={region} className="pb-stack">
                <SectionHeader level={3} title={region} />
                <TileGrid cols="auto" label={region}>{states.map((st) => statePlaque(rowOf(st)))}</TileGrid>
              </section>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Recruiting coordinator" />
        <TileGrid label="Recruiting coordinator">
          {coordinator ? (
            <Plaque
              art={<Monogram name={coordinator.name} size={30} />}
              label={coordinator.name}
              value={coordinator.rating}
              unit="/100"
              note={project
                ? `${PROJECT_LABEL[project.kind]}${project.state ? ` · ${stateName(project.state)}` : ''}`
                : status.label}
              tone={status.state === 'active' ? 'info' : status.state === 'paused' ? 'warning' : undefined}
              onClick={() => { setSheet('staff'); openCoach('recruiting'); }}
            />
          ) : (
            <Plaque
              art={<Monogram vacant size={30} />}
              label="Open seat"
              value="—"
              note="Builds pipelines beyond home"
              onClick={() => { setSheet('staff'); openCoach('recruiting'); }}
            />
          )}
          <Plaque
            icon="globe"
            label="Scouting reports"
            value={books}
            note={`${dollars(SCOUT_COST)} · ${SCOUT_DAYS} days each`}
            tone={books > 0 ? 'info' : undefined}
          />
        </TileGrid>
      </section>

      {openRow && (
        <Sheet
          eyebrow={[REGION_OF_STATE[openRow.state], ...openRow.sources].filter(Boolean).join(' · ') || 'Unexplored'}
          title={stateName(openRow.state)}
          subtitle={`${tierOf(openRow.strength).label} relationship`}
          lead={<Monogram icon="globe" tone="info" size={44} />}
          onClose={() => setOpen(null)}
          footer={(
            <Button variant="primary" block onClick={() => planWork(openRow.state)}>
              {!coordinator ? 'Hire a recruiting coordinator'
                : project ? 'See the coordinator’s work' : `Plan work in ${stateName(openRow.state)}`}
            </Button>
          )}
        >
          <Meter
            label="Strength"
            valueText={`${openRow.strength} / 100`}
            value={openRow.strength}
            max={100}
            markers={[{ at: PIPELINE_MIN, label: 'Pipeline' }, { at: 60, label: 'Star reach' }]}
          />
          <DescriptionList
            items={[
              { label: 'Signed from here', value: String(openRow.signings) },
              { label: 'Last signing or project', value: openRow.lastWorked ? String(openRow.lastWorked) : 'Never' },
            ]}
          />
        </Sheet>
      )}
    </main>
  );
}
