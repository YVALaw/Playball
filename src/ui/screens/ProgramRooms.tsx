// ProgramRooms.tsx
// The rooms that run the program: Budget, Staff, Facilities and the
// Recruiting network. Each is a screen of the Office tab (or its own layer
// when the season is over), and each spends from the same budget, so what is
// left travels with you in the room's header.
//
// Since the UI clarity review (design/UI Clarity Review/Staff and
// Facilities.dc.html, 2026-09-25) a room is one column of the things in it,
// each carrying its own state, instead of a row of plaques to pick from with
// one card open underneath: a card for every seat on the staff, a row for
// every building that opens where it stands, and a budget that ends on what
// the money left could still buy. The words are the review's, in its plainer
// language ("Idle · assign one", "Tap again to spend it"); every number is
// the engine's.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDynasty } from '../../state/store.js';
import { handles } from '../../state/depth.js';
import { readPrefs } from '../../state/devicePrefs.js';
import { SCOUTING } from '../../state/features.js';
import {
  annualBudget, BUILDINGS, buildingSpec, dollars, facilityEffectAt, facilityLevel, facilityUpgradeCost,
  FACILITY_MAX_LEVEL, marketFor, PIPELINE_MIN, pipelineStrength, PROJECT_LABEL, remaining,
  SCOUT_COST, SCOUT_DAYS, SEAT_LABEL, SEAT_NOTE, SEATS, shapeOf, staffPlan, wageBill,
  DIRECTIVE_LABEL, type Assistant, type Building, type StaffSeat,
} from '../../engine/economy.js';
import type { SeasonState } from '../../engine/season.js';
import { RECRUITING_WEEKS } from '../../engine/recruiting.js';
import { PIPELINE_WEEKLY, SEASON_GAIN } from '../../engine/staffProjects.js';
import { REGION_OF_STATE, STATES_BY_REGION } from '../../data/schools.js';
import {
  BudgetLedger, BudgetSummary, Button, BuyList, Callout, CandidateList, ConfirmButton, DescriptionList,
  FacilityCard, HowCoachHelps, List, ListRow, Marquee, Meter, Monogram, NeedsList, Plaque, SectionHeader,
  SegmentedControl, Sheet, SkillBars, StaffCard, StatGroup, StatusBadge, SubHead, TileGrid,
  type BuyItem, type CompareRow, type NeedItem, type StaffCardProps, type Tone,
} from '../components/ui/index.js';
import { GodBolt } from '../god/GodBolt.js';
import { FirstVisit } from '../Tutorial.js';
import {
  canAssignProject, projectOutlook, recruitingWeeksLeft, staffWorkStatus, useStaffWork,
} from '../StaffWorkPanel.js';
import { StaffCandidateDialog, staffAdds, staffSkills } from '../StaffCandidateDialog.js';
import { FACILITY_NAME, plural, stateName } from '../words.js';
import { useScreenOwner } from '../screenOwner.js';

type Owner = SeasonState['teams'][number];

/** What is left to spend this season, on every room that spends it. */
export function BudgetChip({ team }: { team: Owner }) {
  const economy = useDynasty((s) => s.economy);
  const left = remaining(economy, team.prestige);
  // A deficit is said, not shown as nothing left (audit 17, M9).
  return left < 0
    ? <StatusBadge tone="negative" size="lg" icon={false} className="pb-money-pill">{dollars(-left)} over</StatusBadge>
    : <StatusBadge tone="neutral" size="lg" icon={false} className="pb-money-pill">{dollars(left)} left</StatusBadge>;
}

/** The facility a coach's sheet asked to see, opened when the room opens. */
let pendingFacility: Building | null = null;

/** From anywhere: the desk a room row asked for; its coach's sheet opens on arrival. */
let pendingDesk: StaffSeat | null = null;

/** Staff rooms on screen now: a room already up does not mount again to read `pendingDesk`. */
let staffRoomsUp = 0;

/**
 * How a room is opened. `layer` lays it over whatever is up, the way the
 * Season plan needs (2026-09-29): the plan steps aside for a layer and comes
 * back when it is peeled, where a room reached as a screen would have opened
 * under the plan and looked like a tap that did nothing.
 */
interface RoomOpen { layer?: boolean }

/** From anywhere: the facilities room, open on one building. */
export function openFacilityRoom(b: Building, how: RoomOpen = {}): void {
  pendingFacility = b;
  const s = useDynasty.getState();
  if (how.layer) s.openOverlay('facilities'); else s.openRoom('facilities');
}

/** From anywhere: the staff room, with this seat's coach sheet open. */
export function openStaffDesk(seat: StaffSeat, how: RoomOpen = {}): void {
  const s = useDynasty.getState();
  // Standing in the staff room already, it will not mount again to read the
  // seat, so the sheet is opened here and now.
  if (!how.layer && staffRoomsUp > 0 && s.overlay === null && s.screen === 'staff') {
    s.openCoach(seat);
    return;
  }
  pendingDesk = seat;
  if (how.layer) s.openOverlay('staff'); else s.openRoom('staff');
}

/** What each building mostly does for you, on its row. */
const FACILITY_HELPS: Record<Building, string> = {
  cage: 'Hitter growth · hitting season work',
  pen: 'Pitcher growth · arm injuries · pitching season work',
  clubhouse: 'Recruit appeal · pipeline work',
};

/** The name a building's coach's season work goes by in its table. */
const WORK_ROW: Record<Building, string> = {
  cage: 'Hitting season work',
  pen: 'Pitching season work',
  clubhouse: 'Pipeline work',
};

/** What a level of the building sizes: a coach's points a man, or pipeline strength a week. */
const workAt = (kind: Building, level: number): number =>
  (kind === 'clubhouse' ? PIPELINE_WEEKLY['pipeline-deepen'][level] ?? 0 : SEASON_GAIN[level] ?? 0);

/* ------------------------------------------------------------------ Budget */

export function BudgetRoom({ team }: { team: Owner }) {
  const economy = useDynasty((s) => s.economy);
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const openRoom = useDynasty((s) => s.openRoom);
  const runsStaff = useDynasty((s) => handles(s.depth, 'assistants'));
  const runsFacilities = useDynasty((s) => handles(s.depth, 'facilities'));
  // God mode's grant is money on top of the year's, so it is part of the whole.
  const total = annualBudget(team.prestige) + (economy.grant ?? 0);
  const wages = wageBill(economy.staff);
  const left = remaining(economy, team.prestige);
  const staffCount = SEATS.filter((seat) => economy.staff[seat]).length;

  /*
    What the rest can buy: only what this program can buy from this room's
    doors. An open seat at its cheapest candidate's wage (the market the hire
    reads), the next level of each building, cheapest first. Nothing the
    athletic director decides for you, and no scouting while the reports are
    held back (state/features.ts).
  */
  const buys: BuyItem[] = [];
  if (runsStaff && season) {
    for (const seat of SEATS) {
      if (economy.staff[seat]) continue;
      const cheapest = Math.min(...marketFor(String(season.seed ?? 0), year, seat).map((c) => c.wage));
      if (!Number.isFinite(cheapest)) continue;
      buys.push({
        key: `hire-${seat}`,
        icon: 'person',
        title: `Hire a ${SEAT_LABEL[seat].toLowerCase()}`,
        sub: 'Cheapest candidate · a year’s wage',
        cost: cheapest,
        onClick: () => openStaffDesk(seat),
      });
    }
  }
  if (runsFacilities) {
    for (const b of BUILDINGS) {
      const level = facilityLevel(economy, b.key);
      if (level >= FACILITY_MAX_LEVEL) continue;
      buys.push({
        key: `build-${b.key}`,
        icon: 'home',
        title: level === 0 ? `Build the ${FACILITY_NAME[b.key]}` : `${FACILITY_NAME[b.key]} to level ${level + 1}`,
        sub: FACILITY_HELPS[b.key],
        cost: facilityUpgradeCost(b.key, level + 1),
        onClick: () => openFacilityRoom(b.key),
      });
    }
  }
  buys.sort((a, b) => a.cost - b.cost || a.title.localeCompare(b.title));

  return (
    <main className="pb-page">
      <Marquee
        eyebrow={`${team.def.school} · Prestige ${team.prestige}`}
        title="Budget"
        trailing={<GodBolt target={{ kind: 'money' }} label="Edit the budget and staff in god mode" />}
      />
      <FirstVisit id="budget" />
      {/*
        The two claims on the money are also the doors to the rooms that
        spend it. The year roll clears the ledger before each season opens in
        February.
      */}
      <BudgetLedger
        total={total}
        left={left}
        note="New budget each February"
        rows={[
          {
            key: 'wages',
            label: 'Staff wages',
            sub: `${plural(staffCount, 'coach', 'coaches')} · paid every year`,
            value: wages,
            tone: 'ink',
            onClick: () => openRoom('staff'),
          },
          {
            key: 'spent',
            label: SCOUTING ? 'Buildings and scouting' : 'Buildings',
            sub: 'Spent this season',
            value: economy.spent,
            tone: 'info',
            onClick: () => openRoom('facilities'),
          },
          left < 0
            ? { key: 'left', label: 'Over budget', sub: 'Wages above what the budget pays. A new budget arrives next season', value: -left, tone: 'track' }
            : { key: 'left', label: 'Left', sub: 'A new budget arrives next season', value: left, tone: 'track' },
        ]}
      />
      {buys.length > 0 && (
        <section className="pb-stack pb-buyrail">
          <SubHead size="md" title="What the rest can buy" aside="Cheapest first" />
          <BuyList label="What the rest can buy" items={buys} left={left} />
        </section>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------- Staff */

/** What an empty seat would do for you, in one sentence. */
const SEAT_PITCH = (seat: StaffSeat, home: string): string => (
  seat === 'hitting' ? 'Develops hitters and adds to your offense skill.'
    : seat === 'pitching' ? 'Develops pitchers and adds to your defense skill.'
      : `Builds pipelines beyond ${stateName(home)} and adds to your recruiting skill.`
);

/** A contract that runs out at this year's roll unless it is renewed first. */
const contractEnds = (man: Assistant, year: number): boolean => man.until !== undefined && man.until <= year;

/** "Player developer · Age 58 · Season 4 here". */
const specOf = (man: Assistant, year: number): string =>
  `${shapeOf(man)} · Age ${man.age} · Season ${Math.max(1, year - (man.joinedYear ?? year) + 1)} here`;

export type CoachView = 'work' | 'contract';

/*
  The tab a tap asked the coach's sheet to open on: the contract for "Review".
  It carries the asking room's owner. A staff room under the top overlay stays
  mounted and renders the same sheet first, and took the tab from the one on
  show (back plan S5 fixes, 2026-09-30).
*/
let pendingView: { owner: string; view: CoachView } | null = null;

/** Ask the coach's sheet in `owner`'s staff room to open on `view`. */
export function askCoachView(owner: string, view: CoachView): void {
  pendingView = { owner, view };
}

/** The tab the sheet in `owner`'s room opens on. Only the room that asked takes it. */
export function takeCoachView(owner: string): CoachView {
  if (pendingView === null || pendingView.owner !== owner) return 'work';
  const { view } = pendingView;
  pendingView = null;
  return view;
}

export function StaffRoom({ team }: { team: Owner }) {
  const economy = useDynasty((s) => s.economy);
  const year = useDynasty((s) => s.year);
  const week = useDynasty((s) => s.season?.recruiting.week ?? 0);
  const runsStaff = useDynasty((s) => handles(s.depth, 'assistants'));
  const coachSeat = useDynasty((s) => s.coachSeat);
  const openCoach = useDynasty((s) => s.openCoach);
  const openRoom = useDynasty((s) => s.openRoom);
  const owner = useScreenOwner();
  const weeksAvailable = recruitingWeeksLeft(week);
  const home = team.def.state;

  useEffect(() => {
    staffRoomsUp += 1;
    const want = pendingDesk;
    pendingDesk = null;
    if (want) openCoach(want);
    return () => { staffRoomsUp -= 1; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openSeat = (seat: StaffSeat, view: CoachView = 'work'): void => {
    askCoachView(owner, view);
    openCoach(seat);
  };

  /*
    What is waiting on you, in the review's order: a coach with nothing to do
    (only when season work could actually start today), a contract about to run
    out, an empty seat. Each line opens the place it is fixed. When the
    athletic director runs the staff there is nothing for you to do here.
  */
  const needs: NeedItem[] = [];
  if (runsStaff) {
    for (const seat of SEATS) {
      const man = economy.staff[seat];
      if (man && canAssignProject(economy, seat, weeksAvailable)) {
        needs.push({
          key: `idle-${seat}`, tone: 'warning', icon: 'alert',
          text: `${man.name} has no season work`, cta: 'Assign', onClick: () => openSeat(seat, 'work'),
        });
      }
    }
    for (const seat of SEATS) {
      const man = economy.staff[seat];
      if (man && contractEnds(man, year)) {
        needs.push({
          key: `contract-${seat}`, tone: 'warning', icon: 'clock',
          text: `${man.name}’s contract ends this season`, cta: 'Review', onClick: () => openSeat(seat, 'contract'),
        });
      }
    }
    for (const seat of SEATS) {
      if (economy.staff[seat]) continue;
      needs.push({
        key: `open-${seat}`, tone: 'info', icon: 'person',
        text: `${SEAT_LABEL[seat]} seat is open`, cta: 'Hire', onClick: () => openSeat(seat),
      });
    }
  }

  const seatCard = (seat: StaffSeat): ReactNode => {
    const man = economy.staff[seat];
    if (!man) {
      return (
        <StaffCard
          key={seat}
          vacant
          roleLabel={SEAT_LABEL[seat]}
          pitch={SEAT_PITCH(seat, home)}
          onOpen={() => openSeat(seat)}
        />
      );
    }
    const plan = staffPlan(economy, seat);
    const outlook = projectOutlook(economy, team, seat, weeksAvailable);
    const status = staffWorkStatus(economy, seat, weeksAvailable);
    const free = canAssignProject(economy, seat, weeksAvailable);
    const project: StaffCardProps['project'] = outlook ? { text: PROJECT_LABEL[outlook.kind] }
      : status.state === 'locked' ? { text: `Needs the ${FACILITY_NAME[status.facility]}`, tone: 'muted' }
        : free && runsStaff ? { text: 'Idle · assign one', tone: 'warning' }
          : free ? { text: 'Idle', tone: 'muted' }
            : { text: 'Opens next season', tone: 'muted' };
    return (
      <StaffCard
        key={seat}
        roleLabel={SEAT_LABEL[seat]}
        name={man.name}
        spec={specOf(man, year)}
        rating={man.rating}
        focus={DIRECTIVE_LABEL[plan.directive]}
        project={project}
        progress={outlook ? {
          who: outlook.season && outlook.type === 'state'
            ? `${outlook.subject} · +${outlook.added ?? 0} so far`
            : outlook.gain ? `${outlook.subject} · ${outlook.gain} ${outlook.attribute.toLowerCase()}` : outlook.subject,
          // Season work reads the season's week, as the coach's sheet does.
          when: outlook.paused ? 'Paused'
            : outlook.season ? `Week ${Math.max(1, Math.min(RECRUITING_WEEKS, week))} of ${RECRUITING_WEEKS}`
              : `Week ${Math.min(outlook.total, outlook.done + 1)} of ${outlook.total}`,
          done: outlook.done,
          total: outlook.total,
          paused: outlook.paused !== null,
        } : undefined}
        wage={dollars(man.wage)}
        contract={contractEnds(man, year)
          ? { text: 'Contract ends this season', ending: true }
          : { text: `Signed through ${man.until ?? year + 1}` }}
        onOpen={() => openSeat(seat)}
      />
    );
  };

  // The network's door. It lived on the budget room's old plaques; it sits
  // here now, under the coordinator who builds it.
  const coordinator = economy.staff.recruiting;
  const known = new Set<string>([
    home, ...(coordinator?.pipelineState ? [coordinator.pipelineState] : []), ...Object.keys(economy.pipelines ?? {}),
  ]);
  const pipelines = [...known].filter((st) => pipelineStrength(economy, st, home) >= PIPELINE_MIN).length;

  return (
    <main className="pb-page">
      <Marquee
        eyebrow={`${team.def.school} · Staff room`}
        title="Coaching staff"
        trailing={<BudgetChip team={team} />}
      />
      <FirstVisit id="staff" />
      {!runsStaff && (
        <Callout tone="info" title="Your athletic director runs the staff" />
      )}
      <HowCoachHelps />
      <NeedsList items={needs} />
      {SEATS.map(seatCard)}
      <List label="Recruiting network">
        <ListRow
          icon="globe"
          markTone="info"
          title="Recruiting network"
          subtitle={`${plural(pipelines, 'pipeline')} · ${plural(known.size, 'state')} known`}
          onClick={() => openRoom('network')}
        />
      </List>

      {coachSeat !== null && (
        <CoachSeatSheet
          key={`${coachSeat}:${economy.staff[coachSeat]?.id ?? 'open'}`}
          team={team}
          seat={coachSeat}
          onFacility={openFacilityRoom}
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

/**
 * A coach's seat: the man, his work, his skills and contract — or, for an
 * open seat, the candidates. Filled, it is a strip of rating, wage and
 * contract over two tabs, Work and Skills and contract; each tab pins its
 * own actions in the footer.
 *
 * The Season plan opens it on its own, straight over the plan: a row's "Hire
 * one" is a hire, not a visit to the Staff room, and pulling the sheet down
 * went back to a room the coach never asked for (2026-10-07).
 */
export function CoachSeatSheet({ team, seat, onFacility }: { team: Owner; seat: StaffSeat; onFacility: (b: Building) => void }) {
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
  const owner = useScreenOwner();
  const [view, setView] = useState<CoachView>(() => takeCoachView(owner));
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
  const ending = !!man && contractEnds(man, year);
  const history = (economy.projectHistory ?? []).filter((r) => r.seat === seat).slice(0, 3);

  const candidates = (
    <section className="pb-stack">
      {man && <SubHead title="Available replacements" />}
      {runsStaff && !man && market.every((c) => c.wage > left) && (
        <Callout tone="warning" title="No coach fits your budget">
          {left < 0 ? `${dollars(-left)} over budget this season.` : `${dollars(left)} left this season.`}
        </Callout>
      )}
      <CandidateList
        label={`${SEAT_LABEL[seat]} candidates`}
        head={seat === 'recruiting' ? 'Candidate · wage · state he knows' : 'Candidate · wage'}
        items={market.map((c) => ({
          id: c.id,
          name: c.name,
          sub: [shapeOf(c), dollars(c.wage), c.pipelineState ? `knows ${stateName(c.pipelineState)}` : '']
            .filter(Boolean).join(' · '),
          rating: c.rating,
          over: left + (man?.wage ?? 0) < c.wage,
          onClick: () => setCandidateId(c.id),
        }))}
      />
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
          layer={false}
          tall
          className="pb-coachsheet"
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
  const until = man.until ?? year + 1;
  const contractFooter = runsStaff ? (
    <>
      {phase !== null && ending && (
        <Button variant="primary" block onClick={() => renewAssistant(seat)}>Renew through {year + 2}</Button>
      )}
      <div className="pb-buttons-2">
        <Button variant="secondary" block onClick={() => setShowReplacements((open) => !open)}>
          {showReplacements ? 'Hide the candidates' : 'Find a replacement'}
        </Button>
        <ConfirmButton
          variant="danger"
          block
          idle="Release coach"
          armed="Tap again to release"
          onConfirm={() => { setShowReplacements(false); fireAssistant(seat); }}
        />
      </div>
    </>
  ) : null;

  return (
    <>
      <Sheet
        eyebrow={SEAT_LABEL[seat]}
        title={man.name}
        subtitle={specOf(man, year)}
        lead={<Monogram name={man.name} size={44} />}
        onClose={closeCoach}
        layer={false}
        tall
        className="pb-coachsheet"
        footer={view === 'work' ? work.footer : contractFooter}
      >
        <StatGroup
          size="sm"
          items={[
            { label: 'Rating', value: man.rating, note: `${skills[0]!.value} + ${skills[1]!.value}` },
            { label: 'Wage', value: dollars(man.wage), unit: '/yr' },
            ending
              ? { label: 'Signed to', value: man.until ?? year, note: 'Ends this season', noteTone: 'warning' }
              : { label: 'Signed to', value: until },
          ]}
        />
        <SegmentedControl<CoachView>
          label="Coach"
          value={view}
          onChange={(next) => { setView(next); setShowReplacements(false); }}
          options={[
            { value: 'work', label: 'Work' },
            { value: 'contract', label: 'Skills and contract', badge: ending ? true : undefined },
          ]}
        />
        {view === 'work' && (
          <>
            {work.body}
            {history.length > 0 && (
              <section className="pb-stack">
                <SectionHeader level={3} title="Recent results" />
                <List label="Recent results">
                  {history.map((r, i) => {
                    // Season work (2026-09-28) always lands; a legacy project could fail to take.
                    const season = r.season === true;
                    return (
                      <ListRow
                        key={`${r.year}:${r.week}:${i}`}
                        title={`${PROJECT_LABEL[r.kind]}${r.state ? ` · ${stateName(r.state)}` : ''}`}
                        subtitle={r.changes.length
                          ? r.changes.map((c) => `${c.name}: ${c.attribute} ${Math.round(c.before)} → ${Math.round(c.after)}`).join(' · ')
                          : !season && r.took === false ? 'No gain this time' : 'No eligible player remained'}
                        status={season ? (
                          <StatusBadge tone="positive" icon="check">{r.focused ? 'Focus bonus earned' : 'Landed'}</StatusBadge>
                        ) : (
                          <StatusBadge tone={r.took === false ? 'neutral' : 'positive'} icon={r.took === false ? 'dot' : 'check'}>
                            {r.took === false ? 'Did not take' : r.focused ? 'Focus bonus earned' : 'Completed'}
                          </StatusBadge>
                        )}
                        value={<small className="pb-row__when">{season ? String(r.year) : `${r.year}, week ${r.week}`}</small>}
                      />
                    );
                  })}
                </List>
              </section>
            )}
          </>
        )}
        {view === 'contract' && (
          <>
            {/* A renewal is an offseason act (`renewAssistant`): two more seasons from this one. */}
            <Callout
              tone={ending ? 'warning' : 'neutral'}
              icon="clock"
              title={ending ? 'His contract ends this season' : `Signed through ${until}`}
            >
              {ending
                ? `Renew it ${phase !== null ? 'now' : 'in the offseason'}, or he leaves. A renewal runs through ${year + 2}.`
                : 'Nothing to decide right now.'}
            </Callout>
            <SkillBars title="What he adds" rows={staffAdds(man, coachSkills)} />
            {showReplacements && candidates}
          </>
        )}
      </Sheet>
      {candidateSheet}
    </>
  );
}

/* -------------------------------------------------------------- Facilities */

/**
 * A building's rows for the now-versus-next table, read off the engine's own
 * numbers. Its main effect leads: the clubhouse is about recruits, the others
 * about growth. The coach's season work closes every table.
 */
function facilityRows(kind: Building, level: number): CompareRow[] {
  const spec = buildingSpec(kind);
  const next = Math.min(FACILITY_MAX_LEVEL, level + 1);
  const now = facilityEffectAt(kind, level);
  const nxt = facilityEffectAt(kind, next);
  const unbuilt = level === 0;
  const num = (label: string, hint: string | undefined, a: number, b: number, extra: Partial<CompareRow>): CompareRow => (
    { label, hint, now: a, next: b, nowText: unbuilt ? '—' : undefined, ...extra }
  );
  const training: CompareRow[] = [];
  if (spec.bat > 0 && spec.arm > 0) {
    training.push(num('Hitter and pitcher training', 'Extra growth each offseason', Math.round(now.bat), Math.round(nxt.bat), { signed: true }));
  } else {
    if (spec.bat > 0) training.push(num('Hitter training', 'Extra growth each offseason', Math.round(now.bat), Math.round(nxt.bat), { signed: true }));
    if (spec.arm > 0) training.push(num('Pitcher training', 'Extra growth each offseason', Math.round(now.arm), Math.round(nxt.arm), { signed: true }));
  }
  const injury: CompareRow[] = spec.guard < 1
    ? [num('Arm injury risk', undefined, -Math.round((1 - now.guard) * 100), -Math.round((1 - nxt.guard) * 100), { unit: '%', better: 'down' })]
    : [];
  const appeal: CompareRow[] = spec.pitch > 0
    ? [num('Appeal to recruits', undefined, Math.round(now.pitch * 100), Math.round(nxt.pitch * 100), { unit: '%', signed: true })]
    : [];
  const label = WORK_ROW[kind];
  // The unit is the hint, as on the training rows, so the cells stay short at every text size.
  const hint = kind === 'clubhouse' ? 'Strength a week' : 'Points a player';
  const work: CompareRow = unbuilt ? { label, hint, nowText: 'Locked', nextText: `+${workAt(kind, 1)}` }
    : level >= FACILITY_MAX_LEVEL ? { label, hint, nowText: `+${workAt(kind, level)}` }
      : { label, hint, now: workAt(kind, level), next: workAt(kind, next), signed: true, better: 'up' };
  const effects = spec.pitch >= 0.1 ? [...appeal, ...training, ...injury] : [...training, ...injury, ...appeal];
  return [...effects, work];
}

export function FacilitiesRoom({ team }: { team: Owner }) {
  const economy = useDynasty((s) => s.economy);
  const runsFacilities = useDynasty((s) => handles(s.depth, 'facilities'));
  const build = useDynasty((s) => s.build);
  const upgradeFacility = useDynasty((s) => s.upgradeFacility);
  const left = remaining(economy, team.prestige);
  const total = annualBudget(team.prestige) + (economy.grant ?? 0);
  const wages = wageBill(economy.staff);
  const page = useRef<HTMLElement | null>(null);

  // Arriving from a coach's "Build the Pitching Lab" opens that building;
  // landing here with nothing asked for opens the cheapest thing you could
  // do next.
  const [arrival] = useState<Building | null>(() => {
    const want = pendingFacility;
    pendingFacility = null;
    return want;
  });
  const [open, setOpen] = useState<ReadonlySet<Building>>(() => {
    if (arrival) return new Set([arrival]);
    const cheapest = BUILDINGS
      .map((b) => ({ key: b.key, level: facilityLevel(economy, b.key) }))
      .filter((b) => b.level < FACILITY_MAX_LEVEL)
      .sort((a, b) => facilityUpgradeCost(a.key, a.level + 1) - facilityUpgradeCost(b.key, b.level + 1))[0];
    return new Set<Building>(cheapest ? [cheapest.key] : []);
  });
  /*
    Rows open and close on their own, never one closing another: closing a
    row above the one you tapped would pull the tapped row up under your
    finger. Only an arrival scrolls, once, so the building you came for is
    in view; showing the room again (the kept-alive screen) moves nothing.
  */
  const toggle = (b: Building): void => setOpen((was) => {
    const next = new Set(was);
    if (next.has(b)) next.delete(b); else next.add(b);
    return next;
  });
  const arrived = useRef(false);
  useEffect(() => {
    if (!arrival || arrived.current) return;
    arrived.current = true;
    page.current?.querySelector<HTMLElement>(`[data-facility="${arrival}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [arrival]);

  return (
    <main className="pb-page" ref={page}>
      <Marquee
        eyebrow={`${team.def.school} · Campus`}
        title="Facilities"
        trailing={<BudgetChip team={team} />}
      />
      <FirstVisit id="facilities" />
      {!runsFacilities && (
        <Callout tone="info" title="Your athletic director runs the building projects" />
      )}
      <BudgetSummary
        total={total}
        left={left}
        parts={[
          { label: 'Staff wages', value: wages, tone: 'ink' },
          { label: SCOUTING ? 'Buildings and scouting' : 'Buildings', value: economy.spent, tone: 'info' },
        ]}
      />
      {BUILDINGS.map((b) => {
        const level = facilityLevel(economy, b.key);
        const maxed = level >= FACILITY_MAX_LEVEL;
        return (
          <FacilityCard
            key={b.key}
            kind={b.key}
            name={FACILITY_NAME[b.key]}
            helps={FACILITY_HELPS[b.key]}
            level={level}
            max={FACILITY_MAX_LEVEL}
            cost={maxed ? undefined : facilityUpgradeCost(b.key, level + 1)}
            budgetLeft={left}
            rows={facilityRows(b.key, level)}
            open={open.has(b.key)}
            onToggle={() => toggle(b.key)}
            delegated={!runsFacilities}
            onUpgrade={() => (level === 0 ? build(b.key) : upgradeFacility(b.key))}
          />
        );
      })}
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
  const [explore, setExplore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const home = team.def.state;
  const coordinator = economy.staff.recruiting;
  const weeksAvailable = recruitingWeeksLeft(season?.recruiting.week ?? 0);
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
    openStaffDesk('recruiting');
  };

  return (
    <main className="pb-page">
      <Marquee
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
        {/* The coordinator's plaque runs the full width while the scouting
            plaque beside it is held back (features.ts). */}
        <TileGrid label="Recruiting coordinator" className={SCOUTING ? undefined : 'pb-tiles--one'}>
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
              onClick={() => openStaffDesk('recruiting')}
            />
          ) : (
            <Plaque
              art={<Monogram vacant size={30} />}
              label="Open seat"
              value="—"
              note="Builds pipelines beyond home"
              onClick={() => openStaffDesk('recruiting')}
            />
          )}
          {/* Held back with the feature (state/features.ts): a plaque must
              not price a report nobody can buy. */}
          {SCOUTING && (
            <Plaque
              icon="globe"
              label="Scouting reports"
              value={books}
              note={`${dollars(SCOUT_COST)} · ${SCOUT_DAYS} days each`}
              tone={books > 0 ? 'info' : undefined}
            />
          )}
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
