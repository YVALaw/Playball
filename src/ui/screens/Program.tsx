import { projectCandidates, projectOdds, PROJECT_ATTRIBUTE, PROJECT_FOCUS, PROJECT_GAIN, PROJECT_FOCUS_GAIN, pipelineProjectGain } from '../../engine/staffProjects.js';
import { RECRUITING_WEEKS } from '../../engine/recruiting.js';
// Program.tsx
// The program hub.
//
// Overview is intentionally a dashboard rather than another tab strip: Board,
// Budget, Watchlist, and Hall are destinations, not four more pieces of chrome
// to learn. The coach profile remains a focused subpage, while season-by-season
// history stays in the adjacent History screen so there is only one record book.
import { leagueLabel } from '../../engine/leagueNames.js';
import { useEffect, useState, type ReactNode } from 'react';
import { ACHIEVEMENTS, ACHIEVEMENT_IDS } from '../../engine/achievements.js';
import {
  useDynasty, useUserTeam, useConferenceTable, type SeasonRecord,
} from '../../state/store.js';
import {
  expectationFor, prestigeStars, rosterStrength, objectiveMet, coachStanding,
  SKILLS, SKILL_LABEL, type Objective, type CoachState,
} from '../../engine/program.js';
import {
  careerName, seasonLength, regularRecord, seasonComplete,
  type CareerYear, type SeasonState,
} from '../../engine/season.js';
import { honoursByPlayer, type Inductee } from '../../engine/hall.js';
import { RECORDS, type RecordKey } from '../../engine/records.js';
import { philosophyOf } from '../../engine/strategy.js';
import { REGION_OF_STATE, CONFERENCES, ALL_STATES } from '../../data/schools.js';
import { playerId, type PlayerId } from '../../engine/types.js';
import { CoachPortrait } from '../CoachPortrait.js';
import { useOpenTeam } from './TeamCard.js';
import { teamColour } from '../Avatar.js';
import { Crest } from '../Crest.js';
import { ArrowLeftIcon, ChevronRightIcon, StarIcon } from '@radix-ui/react-icons';
import { GodBolt } from '../god/GodBolt.js';
import { ModuleIntro, SectionHeading, Segmented, Confirmable } from '../components/Kit.js';
import {
  annualBudget, dollars, marketFor, remaining, wageBill,
  SCOUT_COST, SCOUT_DAYS, SEATS, SEAT_LABEL,
  BUILDINGS, shapeOf, facilityLevel, facilityUpgradeCost, facilityEffectAt,
  FACILITY_MAX_LEVEL, staffProjectWeeks, PIPELINE_MIN, pipelineStrength, pipelineLabel, staffPlan, projectFacility,
  DIRECTIVE_LABEL, PROJECT_LABEL, type Assistant, type StaffSeat, type Building,
  type StaffDirective, type StaffProjectKind,
} from '../../engine/economy.js';
import { handles } from '../../state/depth.js';
import { FirstVisit } from '../Tutorial.js';
import { Modal } from '../Modal.js';
import { StaffCandidateDialog, StaffRatings } from '../StaffCandidateDialog.js';
import { pct } from '../format.js';

/** The record for one program, as the season carries it. */
type Owner = SeasonState['teams'][number];

type Sheet = 'overview' | 'board' | 'money' | 'watchlist' | 'coach' | 'hall';

const PROGRAM_LABEL: Record<Exclude<Sheet, 'coach' | 'overview'>, string> = {
  board: 'Board',
  money: 'Budget',
  watchlist: 'Watchlist',
  hall: 'Hall of Fame',
};

export function Program() {
  const season = useDynasty((s) => s.season);
  const review = useDynasty((s) => s.lastReview);
  const offers = useDynasty((s) => s.offers);
  const year = useDynasty((s) => s.year);
  const team = useUserTeam();
  const sheet = useDynasty((s) => s.programSheet);
  const clearUnseenTrophies = useDynasty((s) => s.clearUnseenTrophies);
  const unseenTrophies = useDynasty((s) => s.unseenTrophies.length);
  const watch = useDynasty((s) => s.watch);
  const setSheet = useDynasty((s) => s.setProgramSheet);
  const economy = useDynasty((s) => s.economy);
  const coach = useDynasty((s) => s.coach);
  const boardAsk = useDynasty((s) => s.boardAsk);
  useEffect(() => {
    if (sheet === 'coach') clearUnseenTrophies();
  }, [sheet, clearUnseenTrophies]);

  if (!season || !team) return null;

  if (sheet === 'coach') {
    return (
      <main className="module-workspace">
        <CoachSheet team={team} />
      </main>
    );
  }

  const waiting = review !== null || offers.length > 0;
  const budgetLeft = Math.max(0, remaining(economy, team.prestige));
  const staffCount = SEATS.filter((seat) => economy.staff[seat]).length;
  const facilities = economy.built?.length ?? economy.facilities;
  // Live books only, the same count the Network room prints — the card used
  // to count every report ever bought and disagreed with its own subpage.
  const books = Object.values(economy.scouted).filter((until) => until >= season.dayIndex).length;
  const hallCount = season.hall?.length ?? 0;
  const fallbackAsk = expectationFor(
    team.prestige,
    rosterStrength(team.team),
    seasonLength(season.config),
  );
  const ask = boardAsk ?? fallbackAsk;
  const security = coach.security >= 75 ? 'Very secure'
    : coach.security >= 55 ? 'Secure'
      : coach.security >= 35 ? 'Under review' : 'In danger';

  if (sheet !== 'overview') {
    return (
      <main className="module-workspace">
        <button
          className="program-subpage-back tap"
          type="button"
          onClick={() => setSheet('overview')}
        >
          <ArrowLeftIcon /> Program overview
        </button>
        <ModuleIntro
          kicker={`${team.def.abbr} · ${year}`}
          title={PROGRAM_LABEL[sheet]}
        />
        {sheet === 'board' && <BoardSheet team={team} />}
        {sheet === 'money' && <MoneySheet team={team} />}
        {sheet === 'watchlist' && <WatchlistSheet />}
        {sheet === 'hall' && <HallSheet />}
      </main>
    );
  }

  return (
    <main className="module-workspace">
      <ModuleIntro
        kicker={`${leagueLabel(team.conference)} · ${year}`}
        title={team.def.school}
        text="Your job at a glance. Open a card when something needs a closer look."
      />

      {unseenTrophies > 0 && (
        <button className="program-new-alert tap" type="button" onClick={() => setSheet('coach')}>
          <span><small>NEW IN YOUR CAREER</small><strong>{unseenTrophies === 1 ? 'Coach achievement unlocked' : `${unseenTrophies} coach achievements unlocked`}</strong></span>
          <em>Open your coach profile</em>
          <ChevronRightIcon />
        </button>
      )}

      <FirstVisit id="program-overview" />
      <section className="program-score">
        <div>
          <small>PRESTIGE</small>
          <strong>{team.prestige}</strong>
          <span>{'★'.repeat(prestigeStars(team.prestige))} PROGRAM</span>
        </div>
        <div>
          <small>THIS YEAR</small>
          <strong>{team.w}-{team.l}</strong>
          <span>{team.cw}-{team.cl} IN CONFERENCE</span>
        </div>
      </section>

      <section className="program-dashboard-grid" aria-label="Program overview">
        <button className={`program-dashboard-card tap${waiting ? ' is-live' : ''}`} type="button" onClick={() => setSheet('board')}>
          <span><small>BOARD</small><strong>{waiting ? 'Something is waiting' : security}</strong></span>
          <p>{ask.summary}</p>
          <em>{coach.contractYears}y contract · {coach.security} security</em>
          <ChevronRightIcon />
        </button>

        <button className="program-dashboard-card tap" type="button" data-guide="budget" onClick={() => setSheet('money')}>
          <span><small>BUDGET</small><strong>{dollars(budgetLeft)} left</strong></span>
          <p>{staffCount}/3 staff · {facilities} facilities · {books} scouting {books === 1 ? 'report' : 'reports'}</p>
          <em>{dollars(annualBudget(team.prestige))} annual budget</em>
          <ChevronRightIcon />
        </button>

        <button className="program-dashboard-card tap" type="button" onClick={() => setSheet('watchlist')}>
          <span><small>WATCHLIST</small><strong>{watch.programs.length === 0 ? 'Nothing tracked' : `${watch.programs.length} tracked`}</strong></span>
          <p>{watch.programs.length === 0 ? 'Follow programs you care about from their profiles.' : 'Programs you want close to your career.'}</p>
          <em>{watch.jobs.length} job {watch.jobs.length === 1 ? 'path' : 'paths'} tracked</em>
          <ChevronRightIcon />
        </button>

        <button className="program-dashboard-card tap" type="button" onClick={() => setSheet('hall')}>
          <span><small>HALL</small><strong>{hallCount === 0 ? 'No inductees yet' : `${hallCount} inducted`}</strong></span>
          <p>The players who became part of the program's history.</p>
          <em>Career leaders live here too</em>
          <ChevronRightIcon />
        </button>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// The money — stage 11
// ---------------------------------------------------------------------------

/**
 * One annual budget and three claims on it: wages, facilities, the scouting
 * desk. The design sentence the whole stage answers to — every dollar should
 * have at least two things it could have been — is why all three live on one
 * sheet: the argument between them IS the feature.
 */
/**
 * The fact about YOUR side that makes this man worth more or less here.
 *
 * The reporter's call when the market was redesigned: "show the fit, not the
 * answer." So this names something true about the roster or the coach and
 * stops — it never says which of the three to take, because a desk that
 * recommends re-creates the ranked list it replaced with an extra step.
 */
function fitLine(
  seat: StaffSeat, m: Assistant, own: number, youngSide: number,
): string {
  const teacher = m.winter >= 0.5;
  if (seat === 'recruiting') {
    return own >= 55
      ? 'Your recruiting skill is already strong, so this coach adds a smaller bonus.'
      : 'This coach can help improve your recruiting skill.';
  }
  const what = seat === 'hitting' ? 'bats' : 'arms';
  if (teacher) {
    return youngSide >= 5
      ? `${youngSide} of your ${what} are underclassmen.`
      : `Your ${what} are mostly upperclassmen.`;
  }
  return own >= 55
    ? `Your game coaching is already strong, so this coach adds a smaller bonus.`
    : `Your own ${seat === 'hitting' ? 'OFFENSE' : 'DEFENSE'} is ${own}.`;
}

function staffMarketKey(m: Assistant, year: number, seat: StaffSeat): number {
  // The market is not a ranking. A deterministic shuffle keeps every reload
  // stable without teaching the player that card #1 is automatically best.
  const text = `${m.id}:${year}:${seat}`;
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function directiveEffectLine(seat: StaffSeat, directive: StaffDirective): string {
  if (directive === 'balanced') return 'Balanced has no specialist bonus. A matching focus earns a project bonus when used for at least 60% of its weeks.';
  if (seat === 'recruiting') {
    if (directive === 'pipeline') return 'Pipeline First increases recruiting interest gains by 4%. Use it for at least 60% of a pipeline project to earn its focus bonus.';
    if (directive === 'stars') return 'Chase Stars makes RP about 10% more effective on 4★ and 5★ prospects.';
    if (directive === 'sleepers') return 'Find Sleepers makes RP about 10% more effective on prospects rated 3★ or lower.';
    return 'Roster Needs makes RP about 10% more effective on prospects at positions missing from your current roster.';
  }
  return `Use the matching ${seat === 'hitting' ? 'hitting' : 'pitching'} focus for at least 60% of the project’s weeks to train one extra player and increase the gain from +1 to +2.`;
}

function facilityImpactLine(which: Building, level: number): string {
  const fx = facilityEffectAt(which, level);
  const parts: string[] = [];
  if (fx.bat >= 1) parts.push(`+${Math.round(fx.bat)} bat development`);
  if (fx.arm >= 1) parts.push(`+${Math.round(fx.arm)} arm development`);
  if (fx.guard < 0.995) parts.push(`${Math.round((1 - fx.guard) * 100)}% less arm strain`);
  if (fx.pitch >= 0.01) parts.push(`+${Math.round(fx.pitch * 100)}% development pitch`);
  return parts.join(' · ');
}

function MoneySheet({ team }: { team: Owner }) {
  const economy = useDynasty((s) => s.economy);
  const coachSkills = useDynasty((s) => s.coach.skills);
  const year = useDynasty((s) => s.year);
  const season = useDynasty((s) => s.season);
  const hireAssistant = useDynasty((s) => s.hireAssistant);
  const fireAssistant = useDynasty((s) => s.fireAssistant);
  const setStaffDirective = useDynasty((s) => s.setStaffDirective);
  const startStaffProject = useDynasty((s) => s.startStaffProject);
  const cancelStaffProject = useDynasty((s) => s.cancelStaffProject);
  const build = useDynasty((s) => s.build);
  const upgradeFacility = useDynasty((s) => s.upgradeFacility);
  const runsStaff = useDynasty((s) => handles(s.depth, 'assistants'));
  const runsFacilities = useDynasty((s) => handles(s.depth, 'facilities'));
  const [view, setView] = useState<'plan' | 'staff' | 'facilities' | 'network'>('plan');
  const phase = useDynasty((s) => s.phase);
  const renewAssistant = useDynasty((s) => s.renewAssistant);
  const [staffSeat, setStaffSeat] = useState<StaffSeat>('hitting');
  const [showReplacements, setShowReplacements] = useState(false);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [facilityFocus, setFacilityFocus] = useState<Building>('cage');
  const [showAllPipelines, setShowAllPipelines] = useState(false);
  const [pipelineState, setPipelineState] = useState('');
  const [projectState, setProjectState] = useState(team.def.state);
  const [projectPlayer, setProjectPlayer] = useState<string>('');
  useEffect(() => { setShowReplacements(false); setCandidateId(null); }, [staffSeat]);
  useEffect(() => setCandidateId(null), [view, year]);

  const budget = annualBudget(team.prestige);
  const wages = wageBill(economy.staff);
  const left = remaining(economy, team.prestige);
  const committed = wages + economy.spent;
  const staffCount = SEATS.filter((seat) => economy.staff[seat]).length;
  const facilityCount = BUILDINGS.filter((b) => facilityLevel(economy, b.key) > 0).length;
  const youngBats = team.team.lineup.concat(team.team.bench)
    .filter((q) => q.classYear === 'FR' || q.classYear === 'SO').length;
  const youngArms = team.team.rotation.concat(team.team.bullpen)
    .filter((q) => q.classYear === 'FR' || q.classYear === 'SO').length;
  const day = season?.dayIndex ?? 0;
  const books = Object.values(economy.scouted).filter((until) => until >= day).length;
  const worldKey = String(season?.seed ?? 0);
  const weeksAvailable = Math.max(0, RECRUITING_WEEKS - (season?.recruiting.week ?? RECRUITING_WEEKS + 1) + 1);
  const pipelineStates = new Set<string>([
    team.def.state,
    ...(economy.staff.recruiting?.pipelineState ? [economy.staff.recruiting.pipelineState] : []),
    ...Object.keys(economy.pipelines ?? {}),
  ]);
  const pipelines = [...pipelineStates]
    .map((state) => ({
      state,
      strength: pipelineStrength(economy, state, team.def.state),
      signings: economy.pipelines?.[state]?.signings ?? 0,
      source: [state === team.def.state ? 'Home' : '', state === economy.staff.recruiting?.pipelineState ? 'Coordinator' : '', economy.pipelines?.[state] ? 'Earned' : ''].filter(Boolean).join(' · '),
      lastWorked: Math.max(economy.pipelines?.[state]?.lastSignedYear ?? 0, economy.pipelines?.[state]?.lastWorkedYear ?? 0),
    }))
    .sort((a, b) => b.strength - a.strength || a.state.localeCompare(b.state));
  const matchingPipelines = pipelines.filter((p) => !pipelineState || p.state === pipelineState);
  const visiblePipelines = showAllPipelines || pipelineState ? matchingPipelines : matchingPipelines.slice(0, 8);
  const nextFacility = BUILDINGS
    .map((b) => {
      const level = facilityLevel(economy, b.key);
      const next = Math.min(FACILITY_MAX_LEVEL, level + 1);
      return { ...b, level, next, cost: facilityUpgradeCost(b.key, next) };
    })
    .filter((b) => b.level < FACILITY_MAX_LEVEL)
    .sort((a, b) => a.cost - b.cost)[0] ?? null;

  return (
    <>
      <FirstVisit key={view} id={view === 'plan' ? 'budget' : view} />
      <section className="money-command-center">
        <div className="money-available">
          <GodBolt target={{ kind: 'money' }} label="Edit the budget and staff in god mode" className="hero-god" />
          <small>AVAILABLE BUDGET</small>
          <strong>{dollars(Math.max(0, left))}</strong>
          <p>{dollars(committed)} committed of {dollars(budget)} this year.</p>
        </div>
        <div className="money-ledger-track" aria-label={`${dollars(committed)} committed of ${dollars(budget)}`}>
          <i><b style={{ width: `${Math.round(Math.min(1, committed / Math.max(1, budget)) * 100)}%` }} /></i>
          <span><small>COMMITTED</small><b>{Math.round(Math.min(1, committed / Math.max(1, budget)) * 100)}%</b></span>
        </div>
        <div className="money-allocation-strip">
          <span><small>STAFF</small><strong>{dollars(wages)}</strong></span>
          <span><small>FACILITIES + SCOUTING</small><strong>{dollars(economy.spent)}</strong></span>
          <span><small>ROOM</small><strong>{dollars(Math.max(0, left))}</strong></span>
        </div>
      </section>

      <Segmented<'plan' | 'staff' | 'facilities' | 'network'>
        label="Budget workspace"
        value={view}
        onChange={setView}
        options={[
          { value: 'plan', label: 'Plan' },
          { value: 'staff', label: 'Staff' },
          { value: 'facilities', label: 'Facilities' },
          { value: 'network', label: 'Network' },
        ]}
      />

      {view === 'plan' && (
        <section className="money-plan-grid">
          <button className="money-plan-card tap" type="button" data-guide="money-staff" onClick={() => setView('staff')}>
            <span><small>STAFF</small><strong>{staffCount}/3 seats filled</strong></span>
            <p>{dollars(wages)} in annual wages. {staffCount < 3 ? `${3 - staffCount} seat${3 - staffCount === 1 ? '' : 's'} still open.` : 'The room is staffed.'}</p>
            <ChevronRightIcon />
          </button>

          <button className="money-plan-card tap" type="button" data-guide="money-facilities" onClick={() => setView('facilities')}>
            <span><small>FACILITIES</small><strong>{facilityCount}/3 specialties built</strong></span>
            <p>{nextFacility ? `${nextFacility.label} can move to level ${nextFacility.next} for ${dollars(nextFacility.cost)}.` : 'Every facility is fully developed.'}</p>
            {nextFacility && left < nextFacility.cost && <em>{dollars(nextFacility.cost - left)} short of the next project.</em>}
            <ChevronRightIcon />
          </button>

          <button className="money-plan-card tap" type="button" onClick={() => setView('network')}>
            <span><small>NETWORK</small><strong>{pipelines.length} market{pipelines.length === 1 ? '' : 's'} · {books} live report{books === 1 ? '' : 's'}</strong></span>
            <p>{pipelines[0] ? `${pipelines[0].state} is your strongest relationship at ${pipelines[0].strength}/100.` : 'Your recruiting map is still open ground.'}</p>
            <ChevronRightIcon />
          </button>
        </section>
      )}

      {view === 'staff' && (
        <>
          {!runsStaff && (
            <div className="delegation-banner" role="status" data-guide="staff-delegated">
              <span><small>DELEGATED</small><strong>Athletic director controls staffing</strong></span>
              <p>You can view coaches and their costs.</p>
            </div>
          )}

          <nav className="staff-seat-switcher" aria-label="Coaching staff seats">
            {SEATS.map((seat) => {
              const man = economy.staff[seat];
              return (
                <button
                  className={`tap${staffSeat === seat ? ' active' : ''}`}
                  type="button"
                  key={seat}
                  data-guide={seat === 'hitting' ? 'seat-hitting' : undefined}
                  aria-current={staffSeat === seat ? 'page' : undefined}
                  onClick={() => setStaffSeat(seat)}
                >
                  <small>{SEAT_LABEL[seat].toUpperCase()}</small>
                  <strong>{man?.name ?? 'Open seat'}</strong>
                  <span>{man ? dollars(man.wage) : 'VACANT'}</span>
                </button>
              );
            })}
          </nav>

          {(() => {
            const man = economy.staff[staffSeat];
            const rawMarket = marketFor(worldKey, year, staffSeat);
            const market = rawMarket.filter((candidate) => candidate.id !== man?.id).sort((a, b) => staffMarketKey(a, year, staffSeat) - staffMarketKey(b, year, staffSeat));
            return (
              <>
                <article className={`staff-focus-card${man ? ' is-filled' : ' is-open'}`}>
                  <header>
                    <span>
                      <small>{SEAT_LABEL[staffSeat].toUpperCase()}</small>
                      <strong>{man ? man.name : 'This seat is open'}</strong>
                    </span>
                    <b>{man ? dollars(man.wage) : 'NO WAGE'}</b>
                  </header>
                  {man ? (
                    <>
                      <StaffRatings coach={man} />
                      <p className="staff-tenure">
                        <span>{man.rating} OVR</span>
                        <span>YEAR {Math.max(1, year - (man.joinedYear ?? year) + 1)}</span>
                        <span>THROUGH {man.until ?? year + 1}</span>
                        {man.until !== undefined && man.until <= year && <b className="up">CONTRACT UP</b>}
                        {staffSeat === 'recruiting' && man.pipelineState && <span>{man.pipelineState} NETWORK</span>}
                      </p>
                      {runsStaff && (
                        <div className="staff-focus-actions">
                          <button className="staff-market-open tap" type="button" onClick={() => setShowReplacements((open) => !open)}>
                            {showReplacements ? 'Hide replacement market' : 'Explore replacements'}
                          </button>
                          {/*
                            Asked twice, like every other irreversible act in
                            the app: this was the one that fired a man on a
                            single tap (05 §62.6).
                          */}
                          {phase !== null && man.until !== undefined && man.until <= year && (
                            <button className="staff-market-open tap" type="button" onClick={() => renewAssistant(staffSeat)}>
                              Renew through {year + 2}
                            </button>
                          )}
                          <Confirmable
                            className="staff-release tap"
                            idle="Let him go"
                            armed={`Confirm — release ${man.name}`}
                            onConfirm={() => { setShowReplacements(false); fireAssistant(staffSeat); }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="staff-vacancy-copy">
                      <strong>{market.length} candidates this cycle.</strong>
                    </div>
                  )}
                </article>

                {man && (() => {
                  const plan = staffPlan(economy, staffSeat);
                  const facility = projectFacility(staffSeat);
                  const level = facilityLevel(economy, facility);
                  const directives: StaffDirective[] = staffSeat === 'hitting'
                    ? ['balanced','contact','power','discipline']
                    : staffSeat === 'pitching'
                      ? ['balanced','command','velocity','armCare']
                      : ['balanced','pipeline','stars','sleepers','needs'];
                  const selectedPipeline = pipelineStrength(economy, projectState, team.def.state);
                  const projects: StaffProjectKind[] = staffSeat === 'hitting'
                    ? ['hitting-contact','hitting-power','hitting-discipline']
                    : staffSeat === 'pitching'
                      ? ['pitching-command','pitching-velocity','pitching-arm-care']
                      : selectedPipeline >= PIPELINE_MIN
                        ? ['pipeline-deepen','pipeline-maintain']
                        : ['pipeline-build'];
                  return (
                    <section className="staff-management-panel">
                      <div className="staff-management-head">
                        <span><small>YOUR DIRECTION</small><strong>Set the coach’s focus</strong></span>
                        <em>{level > 0 ? `${BUILDINGS.find((b) => b.key === facility)?.label ?? 'Facility'} · L${level} · ${weeksAvailable} WKS LEFT` : 'FACILITY REQUIRED'}</em>
                      </div>
                      <div className="staff-directive-grid" data-guide={staffSeat === 'hitting' && runsStaff ? 'directive' : undefined} aria-label={`${SEAT_LABEL[staffSeat]} standing directive`}>
                        {directives.map((directive) => (
                          <button key={directive} type="button" className={`tap${plan.directive === directive ? ' active' : ''}`}
                            disabled={!runsStaff} onClick={() => setStaffDirective(staffSeat, directive)}>
                            {DIRECTIVE_LABEL[directive]}
                          </button>
                        ))}
                      </div>
                      <p className="staff-directive-effect">{directiveEffectLine(staffSeat, plan.directive)}</p>
                      <div className="staff-project-card">
                        {plan.project ? (
                          <>
                            <span><small>{level < 1 || weeksAvailable === 0 ? 'PAUSED PROJECT' : 'ACTIVE PROJECT'}</small><strong>{PROJECT_LABEL[plan.project.kind]}{plan.project.state ? ` · ${plan.project.state}` : ''}</strong></span>
                            <div className="staff-project-progress"><i><b style={{ width: `${Math.round((1 - plan.project.weeksLeft / Math.max(1, plan.project.weeksTotal)) * 100)}%` }} /></i><em>{plan.project.weeksLeft} week{plan.project.weeksLeft === 1 ? '' : 's'} left</em></div>
                            <p className="staff-project-detail">{level < 1 ? 'Build the required facility to resume.' : weeksAvailable === 0 ? 'Resumes when next season’s recruiting calendar opens.' : `Progress advances when a recruiting week ends. ${plan.project.alignedWeeks ?? 0}/${Math.ceil(plan.project.weeksTotal * 0.6)} matching-focus weeks earned.`}</p>
                            {plan.project.playerId && <p className="staff-project-detail">
                              His project: <b>{projectCandidates(team.team, staffSeat, plan.project.kind).find((p) => String(p.id) === plan.project!.playerId)?.name ?? 'a man no longer on the roster'}</b>
                              {' '}· {Math.round((plan.project.odds ?? 0) * 100)}% it takes.
                            </p>}
                            {!plan.project.playerId && plan.project.targetIds && plan.project.targetIds.length > 0 && <p className="staff-project-detail">
                              Training group: {plan.project.targetIds.map((id) => projectCandidates(team.team, staffSeat, plan.project!.kind).find((p) => p.id === id)?.name ?? 'Player no longer on roster').join(', ')}.
                            </p>}
                            {runsStaff && <button type="button" className="staff-project-cancel tap" onClick={() => cancelStaffProject(staffSeat)}>Cancel project</button>}
                          </>
                        ) : level <= 0 ? (
                          <>{/* The gate is a door, not a sentence. Reported 2026-09-10 on a
                              fresh pitching hire: "I don't see the option to assign a
                              project, it's the same screen." Projects run out of the
                              building, and the way there is one tap. */}
                          <button type="button" className="staff-project-gate tap" onClick={() => { setFacilityFocus(facility); setView('facilities'); }}>
                            <small>FACILITY REQUIRED</small>
                            <strong>Build {BUILDINGS.find((b) => b.key === facility)?.label} · {dollars(facilityUpgradeCost(facility, 1))}</strong>
                            <em>His projects run out of the building. Tap to go there.</em>
                          </button></>
                        ) : (
                          <>
                            {staffSeat === 'recruiting' && (
                              <label className="pipeline-state-picker"><small>PIPELINE STATE · {selectedPipeline}/100</small>
                                <select value={projectState} onChange={(e) => setProjectState(e.currentTarget.value)}>
                                  {ALL_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                                </select>
                              </label>
                            )}
                            {staffSeat !== 'recruiting' && (() => {
                              const pool = projectCandidates(team.team, staffSeat, projects[0]!);
                              const chosen = pool.find((p) => String(p.id) === (projectPlayer || String(projectCandidates(team.team, staffSeat, projects[0]!)[0]?.id ?? ""))) ?? pool[0];
                              // Chips, not a select: on a phone a select reads as a name
                              // already chosen. Reported 2026-09-10: "it picks it
                              // automatically." The chosen man is lit; the rest are taps.
                              return pool.length > 0 ? (
                                <div className="project-man-picker" role="radiogroup" aria-label="His project">
                                  <small>HIS PROJECT · PICK ONE MAN</small>
                                  <div>
                                    {pool.map((p) => {
                                      const on = String(p.id) === String(chosen?.id);
                                      return (
                                        <button
                                          key={String(p.id)} type="button" role="radio" aria-checked={on}
                                          className={`tap${on ? ' active' : ''}`}
                                          onClick={() => setProjectPlayer(String(p.id))}
                                        >
                                          <strong>{p.name}</strong>
                                          <small>{(p as { role?: string }).role ?? p.pos} · {p.classYear}</small>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null;
                            })()}
                            <div className="staff-project-options">
                              {projects.map((kind) => {
                                const weeks = staffProjectWeeks(economy, staffSeat, kind);
                                const pool = projectCandidates(team.team, staffSeat, kind);
                                const chosen = pool.find((p) => String(p.id) === (projectPlayer || String(projectCandidates(team.team, staffSeat, projects[0]!)[0]?.id ?? ""))) ?? pool[0];
                                const odds = chosen ? projectOdds(economy, staffSeat, chosen, kind) : 0;
                                const gain = pipelineProjectGain(economy, kind, selectedPipeline, false);
                                const enoughTime = weeks <= weeksAvailable;
                                return (
                                  <div className="staff-project-option" key={kind}>
                                    <strong>{PROJECT_LABEL[kind]}</strong>
                                    <p>{staffSeat === 'recruiting'
                                      ? `${selectedPipeline} → ${selectedPipeline + gain} strength. ${kind === 'pipeline-maintain' ? 'Short upkeep project with a smaller gain.' : 'Longer investment in recruiting reach.'}`
                                      : chosen
                                        ? `+${PROJECT_GAIN} ${PROJECT_ATTRIBUTE[kind]} for ${chosen.name} · ${Math.round(odds * 100)}% it takes`
                                        : 'Nobody on the roster for this seat.'}</p>
                                    <details><summary>The bonus</summary><p>
                                      {staffSeat === 'recruiting' ? `${projectState}. Matching focus adds up to 4 strength (maximum 100).`
                                        : `+${PROJECT_FOCUS_GAIN} instead of +${PROJECT_GAIN} with the matching focus.`}
                                      {' '}Use {DIRECTIVE_LABEL[PROJECT_FOCUS[kind]]} for at least {Math.ceil(weeks * 0.6)} of {weeks} weeks to earn it.
                                    </p></details>
                                    <button type="button" className="tap" disabled={!runsStaff || !enoughTime || (staffSeat !== 'recruiting' && !chosen)}
                                      onClick={() => startStaffProject(staffSeat, kind, staffSeat === 'recruiting' ? projectState : undefined, staffSeat === 'recruiting' ? undefined : String(chosen?.id ?? ''))}>
                                      {!runsStaff ? 'Staff management delegated' : !enoughTime ? `Needs ${weeks} weeks · ${weeksAvailable} left` : `Start · ${weeks} weeks`}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </section>
                  );
                })()}

                {(economy.projectHistory ?? []).filter((r) => r.seat === staffSeat).slice(0, 3).map((result, i) => (
                  <section className="staff-result-card" key={`${result.year}:${result.week}:${i}`}>
                    <small>COMPLETED · {result.year} · WEEK {result.week}</small>
                    <strong>{PROJECT_LABEL[result.kind]}{result.state ? ` · ${result.state}` : ''}</strong>
                    <p>{result.took === false ? 'He did not take to it.' : result.focused ? 'Focus bonus earned.' : 'Project completed.'}</p>
                    {result.changes.map((c, j) => <div key={j}><span>{c.name} · {c.attribute}</span><b>{c.before} → {c.after}</b></div>)}
                    {!result.changes.length && <p>The man it was about is no longer on the roster.</p>}
                  </section>
                ))}
                {(!man || showReplacements) && (
                  <>
                    <div className="staff-market-heading">
                      <h3>{man ? 'Available replacements' : 'Available coaches'}</h3>
                    </div>
                    {runsStaff && !man && market.every((candidate) => candidate.wage > left) &&
                      <p className="staff-market-notice" data-guide={staffSeat === 'hitting' ? 'hire-blocked' : undefined}>No candidates fit your budget. Free up funds or return later.</p>}
                    <section className="staff-candidate-grid" data-guide={staffSeat === 'hitting' && !man && runsStaff ? 'hire-options' : undefined} aria-label={`${SEAT_LABEL[staffSeat]} candidates`}>
                      {market.map((candidate) => {
                        const affordable = left + (man?.wage ?? 0) >= candidate.wage;
                        return (
                          <button className="staff-candidate-tile tap" key={candidate.id} type="button" aria-haspopup="dialog"
                            onClick={() => setCandidateId(candidate.id)}>
                            <span className="staff-candidate-top"><span className="staff-candidate-initials" aria-hidden="true">{candidate.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</span><b>{candidate.rating}<small>OVR</small></b></span>
                            <strong>{candidate.name}</strong>
                            <small className="staff-candidate-specialty">{shapeOf(candidate)}</small>
                            <StaffRatings coach={candidate} />
                            {candidate.pipelineState && <small className="staff-candidate-state">{candidate.pipelineState} network</small>}
                            <span className="staff-candidate-price"><b>{dollars(candidate.wage)}<small>/year</small></b><small>{affordable ? 'View details ›' : 'Over budget · View ›'}</small></span>
                          </button>
                        );
                      })}
                    </section>
                  </>
                )}
                {(() => {
                  const candidate = market.find((m) => m.id === candidateId);
                  if (!candidate) return null;
                  return <StaffCandidateDialog candidate={candidate} incumbent={man} budgetLeft={left}
                    skills={coachSkills} canManage={runsStaff}
                    projectActive={!!staffPlan(economy, staffSeat).project}
                    fit={fitLine(staffSeat, candidate,
                      staffSeat === 'hitting' ? coachSkills.offense : staffSeat === 'pitching' ? coachSkills.defense : coachSkills.recruiting,
                      staffSeat === 'pitching' ? youngArms : youngBats)}
                    onClose={() => setCandidateId(null)}
                    onHire={() => {
                      const slot = rawMarket.findIndex((m) => m.id === candidate.id);
                      if (slot < 0 || !runsStaff) return;
                      hireAssistant(staffSeat, slot);
                      if (useDynasty.getState().economy.staff[staffSeat]?.id === candidate.id) {
                        setCandidateId(null); setShowReplacements(false);
                      }
                    }} />;
                })()}
              </>
            );
          })()}
        </>
      )}

      {view === 'facilities' && (
        <>
          {!runsFacilities && (
            <div className="delegation-banner" role="status" data-guide="facility-delegated">
              <span><small>DELEGATED</small><strong>Athletic director controls projects</strong></span>
              <p>You can still inspect every specialty, upgrade effect, and budget consequence.</p>
            </div>
          )}

          <nav className="facility-specialty-switcher" aria-label="Facility specialties">
            {BUILDINGS.map((b) => {
              const level = facilityLevel(economy, b.key);
              const active = facilityFocus === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  data-guide={b.key === 'cage' && !active ? 'facility-cage' : undefined}
                  className={`facility-specialty-tile tap${active ? ' active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setFacilityFocus(b.key)}
                >
                  <span className="facility-specialty-mark" aria-hidden>{b.key === 'cage' ? 'BAT' : b.key === 'pen' ? 'ARM' : 'CLUB'}</span>
                  <strong>{b.label}</strong>
                  <small>{level > 0 ? `LEVEL ${level}` : 'NOT BUILT'}</small>
                  <i>{Array.from({ length: FACILITY_MAX_LEVEL }, (_, i) => <em key={i} className={i < level ? 'on' : ''} />)}</i>
                </button>
              );
            })}
          </nav>

          {(() => {
            const b = BUILDINGS.find((item) => item.key === facilityFocus) ?? BUILDINGS[0]!;
            const level = facilityLevel(economy, b.key);
            const nextLevel = Math.min(FACILITY_MAX_LEVEL, level + 1);
            const maxed = level >= FACILITY_MAX_LEVEL;
            const cost = maxed ? 0 : facilityUpgradeCost(b.key, nextLevel);
            const affordable = maxed || left >= cost;
            return (
              <section className="facility-blueprint">
                <header>
                  <span><small>{level > 0 ? `LEVEL ${level} OF ${FACILITY_MAX_LEVEL}` : 'NEW PROJECT'}</small><strong>{b.label}</strong><p>{b.blurb}</p></span>
                  <b>{maxed ? 'MAX' : dollars(cost)}</b>
                </header>

                <div className="facility-staff-unlock">
                  <small>STAFF CAPABILITY</small>
                  <strong>{b.key === 'cage' ? 'Hitting development programs' : b.key === 'pen' ? 'Pitching development + arm-care programs' : 'Recruiting coordinator pipeline projects'}</strong>
                  <p>{(() => {
                    const seat = b.key === 'cage' ? 'hitting' : b.key === 'pen' ? 'pitching' : 'recruiting';
                    const upgraded = { ...economy, facilityLevels: { ...economy.facilityLevels, [b.key]: nextLevel } };
                    return `${economy.staff[seat]?.name ?? `No ${SEAT_LABEL[seat].toLowerCase()} yet`} · ${maxed ? `${staffProjectWeeks(economy, seat)}-week projects` : level > 0 ? `${staffProjectWeeks(economy, seat)} → ${staffProjectWeeks(upgraded, seat)}-week projects` : `${staffProjectWeeks(upgraded, seat)}-week projects`}`;
                  })()}</p>
                </div>

                <div className="facility-blueprint-levels" aria-label={`${b.label} progression`}>
                  {Array.from({ length: FACILITY_MAX_LEVEL }, (_, i) => {
                    const step = i + 1;
                    const reached = step <= level;
                    const next = step === nextLevel && !maxed;
                    return (
                      <article key={step} className={`${reached ? ' reached' : ''}${next ? ' next' : ''}`}>
                        <span><small>LEVEL {step}</small><strong>{reached ? 'ACTIVE' : next ? 'NEXT' : 'LOCKED'}</strong></span>
                        <p>{facilityImpactLine(b.key, step)}</p>
                      </article>
                    );
                  })}
                </div>

                <div className="facility-budget-decision">
                  <span>
                    <small>{maxed ? 'STATUS' : 'AFTER PROJECT'}</small>
                    <strong>{maxed ? 'Fully developed' : affordable ? `${dollars(left - cost)} left` : `${dollars(cost - left)} short`}</strong>
                    {maxed && <em>This specialty has reached its ceiling.</em>}
                  </span>
                  {runsFacilities && !maxed && (
                    <button
                      className="facility-invest-cta tap"
                      type="button"
                      data-guide={b.key === 'cage' ? (affordable ? 'facility-cta' : 'facility-blocked') : undefined}
                      disabled={!affordable}
                      onClick={() => level === 0 ? build(b.key) : upgradeFacility(b.key)}
                    >
                      {affordable ? (level === 0 ? `Build ${b.label}` : `Upgrade to level ${nextLevel}`) : 'Not enough room'}
                      <small>{dollars(cost)}</small>
                    </button>
                  )}
                </div>
              </section>
            );
          })()}
        </>
      )}

      {view === 'network' && (
        <>
          <section className="network-command-grid">
            <article className="network-panel">
              <header><span><small>RECRUITING NETWORK</small><strong>{pipelines.length === 0 ? 'No established markets' : `${pipelines.filter((p) => p.strength >= PIPELINE_MIN).length} pipelines · ${pipelines.length} known markets`}</strong></span></header>
              {economy.staff.recruiting && (() => {
                const rp = staffPlan(economy, 'recruiting');
                const clubhouse = facilityLevel(economy, 'clubhouse');
                return (
                  <div className="network-assignment">
                    <span><small>COORDINATOR ASSIGNMENT</small><strong>{rp.project ? `${PROJECT_LABEL[rp.project.kind]} · ${rp.project.state ?? ''}` : 'Choose a market to work'}</strong></span>
                    {!rp.project && clubhouse > 0 && (
                      <div><select aria-label="Assignment state" disabled={!runsStaff} value={projectState} onChange={(e) => setProjectState(e.currentTarget.value)}>{ALL_STATES.map((st) => <option key={st} value={st}>{st}</option>)}</select>
                        <button className="tap" type="button" disabled={!runsStaff || staffProjectWeeks(economy, 'recruiting') > weeksAvailable} onClick={() => startStaffProject('recruiting', pipelineStrength(economy, projectState, team.def.state) >= PIPELINE_MIN ? 'pipeline-deepen' : 'pipeline-build', projectState)}>
                          {pipelineStrength(economy, projectState, team.def.state) >= PIPELINE_MIN ? 'Deepen pipeline' : 'Build pipeline'}
                        </button>
                        {pipelineStrength(economy, projectState, team.def.state) >= PIPELINE_MIN && <button className="tap" type="button"
                          disabled={!runsStaff || staffProjectWeeks(economy, 'recruiting', 'pipeline-maintain') > weeksAvailable}
                          onClick={() => startStaffProject('recruiting', 'pipeline-maintain', projectState)}>Maintain · {staffProjectWeeks(economy, 'recruiting', 'pipeline-maintain')} weeks</button>}
                      </div>
                    )}
                    {!runsStaff && <p>Delegated to the athletic director.</p>}
                    {!rp.project && clubhouse > 0 && <p>{weeksAvailable} weeks left · build or deepen {staffProjectWeeks(economy, 'recruiting')} wks · maintain {staffProjectWeeks(economy, 'recruiting', 'pipeline-maintain')} wks</p>}
                    {!rp.project && clubhouse <= 0 && <p>Build the Clubhouse to unlock pipeline assignments.</p>}
                    {rp.project && <p>{clubhouse < 1 ? 'Paused: build the Clubhouse to resume.' : weeksAvailable === 0 ? 'Paused until next season’s recruiting calendar opens.' : `${rp.project.weeksLeft} weeks left. Progress advances at the end of a recruiting week.`}</p>}
                  </div>
                );
              })()}

              <label className="network-state-filter">Show state
                <select value={pipelineState} onChange={(e) => setPipelineState(e.currentTarget.value)}>
                  <option value="">All known states</option>
                  {[...pipelineStates].sort().map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
              </label>
              <div className="network-legend" aria-label="How strength reads"><span>35 · PIPELINE</span><span>60 · REACH</span><span>−4 A YEAR IDLE</span></div>
              {pipelines.length === 0 ? (
                <p>No relationships yet. Sign from a state, or put the coordinator on one.</p>
              ) : (
                <div className="pipeline-card-grid">
                  {visiblePipelines.map((pipe) => (
                    <article className="pipeline-card" key={pipe.state}>
                      <span><small>{pipe.source}</small><strong>{pipe.state}</strong></span>
                      <b>{pipelineLabel(pipe.strength)}</b>
                      <i><em style={{ width: `${pipe.strength}%` }} /></i>
                      <small>{pipe.strength}/100{pipe.signings > 0 ? ` · ${pipe.signings} signed` : ''}</small>
                      <small>{pipe.strength >= PIPELINE_MIN ? 'Pipeline active' : 'Familiarity only · build to 35'}</small>
                      {pipe.lastWorked > 0 && <small>Last signing or project: {pipe.lastWorked}</small>}
                    </article>
                  ))}
                </div>
              )}
              {matchingPipelines.length === 0 && <p>No relationship recorded for this state.</p>}
              {!pipelineState && pipelines.length > 8 && <button className="secondary-command tap" type="button" onClick={() => setShowAllPipelines((v) => !v)}>{showAllPipelines ? 'Show first 8 markets' : `Show all ${pipelines.length} markets`}</button>}
            </article>

            <article className="network-panel scouting-desk-panel">
              <header><span><small>SCOUTING DESK</small><strong>{books === 0 ? 'No live reports' : `${books} live report${books === 1 ? '' : 's'}`}</strong></span><b>{dollars(SCOUT_COST)} each</b></header>
              <div className="scouting-value-grid">
                <span><small>1</small><strong>Buy the report</strong><em>From a program profile.</em></span>
                <span><small>2</small><strong>Read the matchup</strong><em>Habits and tendencies · {SCOUT_DAYS} days.</em></span>
                <span><small>3</small><strong>Build counters</strong><em>The playbook applies automatically.</em></span>
              </div>
            </article>
          </section>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// The watchlist
// ---------------------------------------------------------------------------

/**
 * The programs you follow, put somewhere. TRACK PROGRAM on a college profile
 * files the school here — the mockup's watchlist view, wired to the saved
 * list rather than a session's memory.
 */
function WatchlistSheet() {
  const season = useDynasty((s) => s.season);
  const watch = useDynasty((s) => s.watch);
  const openTeam = useOpenTeam();
  if (!season) return null;

  const rows = watch.programs
    .map((abbr) => season.teams.find((t) => t.def.abbr === abbr))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .sort((a, b) => b.prestige - a.prestige);

  return (
    <>
      {rows.length > 0 && (
        <section className="watchlist-summary">
          <small>CAREER WATCHLIST</small>
          <strong>{rows.length === 1 ? '1 program tracked' : `${rows.length} programs tracked`}</strong>
          <p>The Wire gives these programs extra weight.</p>
        </section>
      )}
      {rows.length === 0 ? (
        <section className="watchlist-empty">
          <StarIcon />
          <strong>Nothing tracked yet</strong>
          <p>Track a program from its profile to follow its biggest stories.</p>
        </section>
      ) : (
        <section className="retention-list">
          {rows.map((t) => (
            <button className="tap" type="button" key={t.def.abbr} onClick={() => openTeam(t.index)}>
              <span className="team-mark small"><Crest abbr={t.def.abbr} size={30} /></span>
              <span>
                <strong>{t.def.school}</strong>
                <small>{leagueLabel(t.conference)} · {t.w}-{t.l} · {'★'.repeat(prestigeStars(t.prestige))}</small>
              </span>
              <b>{t.prestige}</b>
              <ChevronRightIcon />
            </button>
          ))}
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

function BoardSheet({ team }: { team: Owner }) {
  const season = useDynasty((s) => s.season);
  const openOverlay = useDynasty((s) => s.openOverlay);
  const coach = useDynasty((s) => s.coach);
  const review = useDynasty((s) => s.lastReview);
  const offers = useDynasty((s) => s.offers);
  const clearReview = useDynasty((s) => s.clearReview);
  const post = useDynasty((s) => s.lastPostseason);
  const table = useConferenceTable();
  // Above the early return, where hooks live.
  const storedAsk = useDynasty((s) => s.boardAsk);
  const opener = useDynasty((s) => s.seasonOpener);
  const takeSeason = useDynasty((s) => s.dismissSeasonOpener);
  const stampAsk = useDynasty((s) => s.stampBoardAsk);
  const argueTerms = useDynasty((s) => s.argueTerms);
  const arguedTerms = useDynasty((s) => s.arguedTerms);
  // What the board said when it was asked to think again: the wins it came
  // down by, or 0 for a case it did not accept.
  const [argued, setArgued] = useState<number | null>(null);
  /*
    A board with no stamp gets one, once, instead of recomputing from the
    live roster on every render — which is how the number used to creep as
    men developed. Whatever it says first is what it says all season.
  */
  useEffect(() => { if (!storedAsk) stampAsk(); }, [storedAsk, stampAsk]);

  if (!season) return null;

  const roster = rosterStrength(team.team);
  /*
    The stamped ask, not a live recompute — the second half of a fix that came
    in two reports. The first: scaling by games played crept the target up all
    year. The second, a season later: computing from the live roster did the
    same thing more slowly — "it was asking me for 18 wins, now it is saying
    19" — because men develop. The number is set the day the season opens and
    read from the store ever after; the fallback only fires for a save from
    before the stamp existed, and the load path freezes even those.
  */
  const expectation = storedAsk
    ?? expectationFor(team.prestige, roster, seasonLength(season.config));
  const stars = prestigeStars(team.prestige);

  // What the board can see right now. Placement is only real once the games are
  // played, so mid-season the checklist shows those boxes as still open rather
  // than pretending to know.
  const done = seasonComplete(season);
  const played = regularRecord(team);
  const rank = table.findIndex((t: { index: number }) => t.index === team.index) + 1;
  const finish = post?.finish[team.index];
  const live = {
    wins: played.w, losses: played.l,
    conferenceRank: done ? rank : 0,
    conferenceSize: table.length,
    wonConference: post?.conferenceChampions.includes(team.index) ?? false,
    // The twenty-team national field, when the summary carries it; the finish
    // ladder covers a summary written before the format grew.
    madeTournament: post?.nationalField
      ? post.nationalField.includes(team.index)
      : ['national', 'omaha', 'runner-up', 'champion'].includes(finish ?? ''),
    wonRegional: post?.regionChampions.includes(team.index) ?? false,
    reachedOmaha: ['omaha', 'runner-up', 'champion'].includes(finish ?? ''),
    wonTitle: post?.champion === team.index,
  };

  /**
   * Whether an objective has actually been decided.
   *
   * Reported from testing: "the board marks things with an x when the season
   * hasn't even been finished — I have not started the postseason and it shows
   * that I failed to reach the national tournament". `seasonComplete` means the
   * *schedule* is exhausted, which is the moment the postseason becomes
   * possible, not the moment it is over. A tournament objective is open until
   * the bracket has actually been played.
   *
   * `title` belongs on that list for exactly the same reason and was missing
   * from it: a championship mandate showed "✕ Win the national title" from the
   * moment the regular season ended, which is to say from the moment winning it
   * became possible.
   */
  const settledFor = (key: string): boolean =>
    key === 'tournament' || key === 'omaha' || key === 'conferenceTitle'
      || key === 'regionalTitle' || key === 'title'
      ? post !== null
      : done;

  return (
    <>
      {/* Stage 20: the season is taken HERE, on the checklist it binds you
          to — the opener modal's one door leads to this strip. */}
      {opener && (
        <section className="opener-accept">
          <small>{opener.year} · THE BOARD&rsquo;S TERMS</small>
          <strong>{opener.askSummary}</strong>
          <span>The boxes below are the whole list.</span>
          <button className="primary-command tap" type="button" onClick={takeSeason}>
            TAKE THE SEASON
          </button>
          {/*
            Reported: "didn't see the button to refuse what they are asking
            for, only button was take the season." You can put a case now —
            once — and the board answers it. It concedes when the winter
            genuinely took the side apart, which is the reporter's own
            example, and declines when it did not.
          */}
          {!arguedTerms && (
            <button
              className="secondary-command tap"
              type="button"
              onClick={() => setArgued(argueTerms())}
            >ASK THEM TO RECONSIDER</button>
          )}
        </section>
      )}
      {argued !== null && (
        <Modal
          kicker="THE BOARD"
          title={argued > 0 ? 'They will take less' : 'They will not move'}
          lines={[
            argued > 0
              ? `You put the winter to them and they heard it. The ask comes down ${argued} win${argued === 1 ? '' : 's'}.`
              : 'They looked at the same roster you did and saw no case in it. The number stands.',
          ]}
          action="UNDERSTOOD"
          onClose={() => setArgued(null)}
        />
      )}
      {/* The board meeting takes precedence over everything else on this tab. */}
      {review && (
        <section className={`board-review-card${review.fired ? ' is-fired' : ''}`}>
          <header>
            <span><small>{review.fired ? 'BOARD DECISION' : 'END-OF-YEAR REVIEW'}</small><strong>{review.fired ? 'DISMISSED' : verdictWord(review.verdict)}</strong></span>
            <b>{review.fired ? 'OUT' : review.securityAfter}</b>
          </header>
          <p>{review.message}</p>
          <div className="board-review-deltas">
            <Delta k="PROGRAM PRESTIGE" from={review.prestigeBefore} to={review.prestigeAfter} />
            <Delta k="COACH PRESTIGE" from={review.coachPrestigeBefore} to={review.coachPrestigeAfter} />
            <Delta k="SECURITY" from={review.securityBefore} to={review.securityAfter} />
          </div>
          {!review.fired && (
            <div className="board-review-contract">
              <small>CONTRACT</small>
              <strong>{review.renewed
                ? `Renewed · ${review.contractYears} year${review.contractYears === 1 ? '' : 's'}`
                : review.extended
                  ? `Extended · ${review.contractYears} year${review.contractYears === 1 ? '' : 's'} remain`
                  : `${review.contractYears} year${review.contractYears === 1 ? '' : 's'} remaining`}</strong>
            </div>
          )}
          {!review.fired && (
            <button className="primary-command tap" type="button" onClick={clearReview}>CONTINUE</button>
          )}
        </section>
      )}

      {/* One card, not the list. The offers live on the job market screen
          now, where signing is a two-press act — a row here whose tap WAS the
          acceptance cost somebody a job once. */}
      {offers.length > 0 && (
        <section className="decision-stack" style={{ marginBottom: 14 }}>
          <button type="button" onClick={() => openOverlay('jobs')}>
            <span className="decision-mark">{String(offers.length).padStart(2, '0')}</span>
            <span>
              <strong>
                {offers.length === 1
                  ? 'A program wants to talk'
                  : `${offers.length} programs want to talk`}
              </strong>
              <small>Nothing is signed without you.</small>
            </span>
            <ChevronRightIcon />
          </button>
        </section>
      )}

      <section className="board-room-hero">
        <header>
          <span><small>PROGRAM · BOARD ROOM</small><strong>{expectation.mandate.toUpperCase()} YEAR</strong></span>
          <b>{coach.security}</b>
        </header>
        <div className="board-room-security">
          <div>
            <small>BOARD CONFIDENCE</small>
            <strong>{coach.security >= 70 ? 'SECURE' : coach.security >= 45 ? 'STABLE' : coach.security >= 25 ? 'UNDER PRESSURE' : 'HOT SEAT'}</strong>
            <p>{coach.security >= 70 ? 'They believe the program is moving in the right direction.'
              : coach.security >= 45 ? 'The room is with you, but the mandate still matters.'
                : coach.security >= 25 ? 'Results are being watched closely.'
                  : 'The next review may decide the job.'}</p>
          </div>
          <i><em style={{ width: `${Math.max(2, coach.security)}%` }} /></i>
        </div>
        <div className="board-room-command-strip">
          <article><small>PROGRAM</small><strong>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</strong><span>{team.prestige} PRESTIGE</span></article>
          <article><small>WIN TARGET</small><strong>{expectation.targetWins}</strong><span>{played.w} WON</span></article>
          <article><small>CONTRACT</small><strong>{coach.contractYears}Y</strong><span>{coach.contractLength}-YEAR DEAL</span></article>
        </div>
      </section>

      <section className="board-mandate-card">
        <header>
          <span><small>THIS YEAR'S MANDATE</small><strong>{expectation.summary}</strong></span>
          <b>{expectation.objectives.filter((o) => objectiveMet(o, live)).length}/{expectation.objectives.length}</b>
        </header>
        <p>{expectation.detail}</p>
        <div className="board-objective-grid">
          {expectation.objectives.map((o) => (
            <Box key={o.key} objective={o} met={objectiveMet(o, live)}
              settled={settledFor(o.key)} wins={played.w} />
          ))}
        </div>
        <footer>
          <span>Year {coach.tenure + 1} at {team.def.school}</span>
          <strong>{coach.contractYears > 0
            ? `${coach.contractYears} season${coach.contractYears === 1 ? '' : 's'} left`
            : 'Contract decision due'}</strong>
        </footer>
      </section>
      <FirstVisit id="program" />
    </>
  );
}

// ---------------------------------------------------------------------------
// The coach
// ---------------------------------------------------------------------------

/**
 * The man, not the job.
 *
 * The portrait sits in the panel rather than in the pinned header on purpose: it
 * is the thing you look at once on arrival and never again, so it should be the
 * first thing to scroll away. What stays pinned is the school and the tabs,
 * which is what you actually navigate by.
 */
/** The four rooms of the profile. The hero above them never changes. */
type CoachView = 'overview' | 'skills' | 'career' | 'trophies';

/** What each skill buys, in the same words the coach step uses. */
const SKILL_NOTE: Record<string, string> = {
  offense: 'Your hitters take slightly better at-bats, every game.',
  defense: 'Balls in play against you become outs a little more often.',
  training: 'Your returning players develop further between seasons.',
  recruiting: 'Every hour on a recruit counts for more, and your scouting reports run tighter.',
};

function CoachSheet({ team }: { team: Owner }) {
  const coach = useDynasty((s) => s.coach);
  const history = useDynasty((s) => s.history);
  const tree = useDynasty((s) => s.economy.tree ?? []);
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const [view, setView] = useState<CoachView>('overview');
  void version;

  const philosophy = philosophyOf(coach.philosophy);
  const standing = coachStanding(coach);
  const region = REGION_OF_STATE[coach.homeState];
  const games = coach.careerWins + coach.careerLosses;

  /*
    Two clocks that tick a moment apart. The coach's own counters move at the
    board review; the record book is written at the roll into next year. In the
    offseason between them a raw `history.length` can read as fewer seasons than
    the coach has spent at this one job, which is nonsense on its face — so the
    career figure is never allowed below tenure.
  */
  const careerSeasons = Math.max(history.length, coach.tenure);

  /*
    Deep runs used to have no counter on the coach, so this was derived from the
    history array — which was the honest thing to do with the fields that
    existed and disagreed with the record book by construction, since the book
    had no regional row to disagree *with*.

    `regionalTitles` is that counter (B6). Winning your region and reaching
    Omaha are the same event in this format, so one number answers both and the
    coach page, the record book and the season review are now reading the same
    field rather than three arithmetics that happen to agree today.
  */
  const omaha = coach.regionalTitles;
  const cabinet = ACHIEVEMENT_IDS.filter((id) => coach.achievements[id]);

  return (
    <>
      {/*
        The coach's own hero, on the player card's anatomy.

        Reported: "the coach profile still has the old view." It was a portrait
        between two flanking numbers with a centred name under it — the shape the
        player card wore before the port, and the last place in the app still
        wearing it. It is the same hero every man in the game gets now: the face
        on the dark ground, the name across the bottom, and the two numbers that
        are true on every tab boxed in the corner.
      */}
      <section className="coach-profile-hero">
        <GodBolt target={{ kind: 'coach' }} label="Edit your coach in god mode" className="hero-god" />
        <div className="coach-profile-portrait"><CoachPortrait look={coach.look} size={148} /></div>
        <div className="coach-profile-copy">
          <small>{team.def.school.toUpperCase()} · {leagueLabel(team.conference)}</small>
          <h2>{coach.name}</h2>
          <p>HEAD COACH · {standing.title.toUpperCase()}{standing.lifer ? ' · LIFER' : ''}</p>
        </div>
        <div className="coach-profile-metrics">
          <article><small>CAREER</small><strong>{careerSeasons}</strong><span>SEASONS</span></article>
          <article><small>HERE</small><strong>{coach.tenure}</strong><span>SEASONS</span></article>
        </div>
      </section>

      {/* The profile's rooms. The hero above never changes; these decide what
          is under it. Four small rooms beat one long corridor on a phone.

          A fifth room — JOBS, where an established coach browses openings,
          applies and interviews — is deliberately absent until that system is
          real. When it lands, it plugs in here: add 'jobs' to CoachView, an
          option below, and a JobsView beside CareerView reading `jobOffers`
          (engine/program.ts) with an application flow on top. An empty tab
          promising interviews that do not exist would be worse than no tab. */}
      <Segmented<CoachView>
        label="Coach profile section"
        value={view}
        onChange={setView}
        options={(['overview', 'skills', 'career', 'trophies'] as const).map((v) => ({
          value: v,
          label: v.charAt(0).toUpperCase() + v.slice(1),
        }))}
      />

      {view === 'overview' && (
        <div className="coach-profile-section">
          <section className="coach-profile-facts">
            <article><small>AGE / HOME</small><strong>{coach.age}</strong><span>{region ? `${coach.homeState} · ${region}` : coach.homeState}</span></article>
            <article><small>PHILOSOPHY</small><strong>{philosophy.name}</strong><span>{standing.title}</span></article>
            <article><small>CONTRACT</small><strong>{coach.contractYears > 0 ? `${coach.contractYears} left` : 'Final year'}</strong><span>{coach.contractLength}-year deal</span></article>
            <article className="coach-prestige-fact"><small>COACH PRESTIGE</small><strong>{coach.prestige}</strong><span>National reputation</span><i><em style={{ width: `${Math.min(100, coach.prestige)}%` }} /></i></article>
          </section>

          <section className="coach-record-command">
            <header><small>THE RECORD</small><strong>{coach.careerWins}-{coach.careerLosses}</strong><span>{games > 0 ? pct(coach.careerWins / games) : '—'} WIN PCT</span></header>
            <div className="coach-record-grid">
              <article><small>THIS YEAR</small><strong>{team.w}-{team.l}</strong></article>
              <article><small>BIDS</small><strong>{coach.tournaments}</strong></article>
              <article><small>CONF TITLES</small><strong>{coach.conferenceTitles}</strong></article>
              <article><small>REGIONALS</small><strong>{coach.regionalTitles}</strong></article>
              <article><small>OMAHA</small><strong>{omaha}</strong></article>
              <article className={coach.titles > 0 ? 'earned' : ''}><small>NATIONAL</small><strong>{coach.titles}</strong></article>
            </div>
          </section>
        </div>
      )}

      {view === 'skills' && (
        <div className="coach-profile-section">
          <section className="coach-skills-head">
            <span><small>COACHING PROFILE</small><strong>Four skills</strong></span>
            <b>{coach.skillPoints > 0 ? `${coach.skillPoints} UNSPENT` : 'SET'}</b>
          </section>
          <div className="coach-skill-grid">
            {SKILLS.map((k) => (
              <article className="coach-skill-card" key={k}>
                <header><small>{SKILL_LABEL[k]}</small><strong>{coach.skills[k]}</strong></header>
                <i><em style={{ width: `${Math.min(100, coach.skills[k])}%` }} /></i>
                <p>{SKILL_NOTE[k]}</p>
              </article>
            ))}
          </div>
          <p className="coach-profile-note">
            {coach.skillPoints > 0
              ? 'Unspent points can be assigned during the coach step of the offseason.'
              : 'Three points arrive each June, with additional growth for major accomplishments.'}
          </p>
        </div>
      )}

      {view === 'career' && (
        <>
          <CareerView history={history} coach={coach} />
          {tree.length > 0 && (
            <>
              <Head>COACHING TREE</Head>
              <section className="coach-tree-list coach-tree-career">
                {tree.map((branch) => {
                  const chair = season?.teams.find((t) => t.coach?.name === branch.name);
                  const c = chair?.coach;
                  return (
                    <article className="coach-tree-row" key={branch.id}>
                      <span>
                        <strong>{branch.name}</strong>
                        <small>{SEAT_LABEL[branch.seat]} · {branch.yearsWithYou} {branch.yearsWithYou === 1 ? 'year' : 'years'} on your staff</small>
                      </span>
                      <span>
                        <b>{chair ? chair.def.school : branch.lastSchool ?? 'Not currently coaching'}</b>
                        <small>{c
                          ? `${c.careerWins}-${c.careerLosses}${c.titles ? ` · ${c.titles} title${c.titles === 1 ? '' : 's'}` : ''}`
                          : branch.careerWins !== undefined
                            ? `${branch.careerWins}-${branch.careerLosses ?? 0}${branch.titles ? ` · ${branch.titles} title${branch.titles === 1 ? '' : 's'}` : ''} · inactive`
                            : `left ${branch.leftYear}`}</small>
                      </span>
                    </article>
                  );
                })}
              </section>
            </>
          )}
        </>
      )}

      {view === 'trophies' && (
        <div className="coach-profile-section">
          {(() => {
            const titles = history.filter((r) => r.finish === 'champion');
            const omahaYears = history.filter((r) =>
              r.finish === 'omaha' || r.finish === 'runner-up' || r.finish === 'champion');
            const confYears = history.filter((r) => r.wonConference);
            const shelves = [
              { k: 'NATIONAL TITLES', n: coach.titles, years: titles, tone: 'national' },
              { k: 'TRIPS TO OMAHA', n: omaha, years: omahaYears, tone: 'omaha' },
              { k: 'CONFERENCE TITLES', n: coach.conferenceTitles, years: confYears, tone: 'conference' },
            ];
            return (
              <section className="coach-trophy-case">
                <header><small>CAREER CABINET</small><strong>Trophy case</strong></header>
                <div className="coach-trophy-grid">
                  {shelves.map((shelf) => (
                    <article className={`coach-trophy-card tone-${shelf.tone}`} key={shelf.k}>
                      <small>{shelf.k}</small>
                      <strong>{shelf.n}</strong>
                      <span>{shelf.years.slice(0, 3).map((r) => r.year).join(' · ') || '—'}{shelf.years.length > 3 ? ' …' : ''}</span>
                    </article>
                  ))}
                </div>
              </section>
            );
          })()}

          {cabinet.length > 0 && (
            <section className="coach-achievement-case">
              <header><small>CAREER MILESTONES</small><strong>Achievements</strong></header>
              <div className="coach-achievement-grid">
                {cabinet.map((id) => {
                  const row = coach.achievements[id];
                  return (
                    <article key={id}>
                      <span><strong>{ACHIEVEMENTS[id].name}</strong><small>{row?.team} {row?.year}</small></span>
                      <p>{row?.detail ?? ACHIEVEMENTS[id].note}</p>
                    </article>
                  );
                })}
              </div>
              <p className="coach-profile-note">Earned once and kept wherever the career goes next.</p>
            </section>
          )}
        </div>
      )}
      <FirstVisit id="coach" />
    </>
  );
}

/**
 * The coach's own year-by-year, which is not the school's.
 *
 * His 2029 and his school's 2029 agree only while he was in that chair — the
 * school's version lives on the HISTORY screen and keeps running when he
 * leaves. This one follows the man: every season he has coached, grouped by
 * where he coached it.
 */
function CareerView({ history, coach }: { history: SeasonRecord[]; coach: CoachState }) {
  if (history.length === 0) {
    return (
      <section className="coach-career-empty">
        <small>YEAR BY YEAR</small>
        <strong>The book starts in June</strong>
        <p>Your first completed season is written at the board meeting.</p>
      </section>
    );
  }

  const spans: Array<{ school: string; rows: SeasonRecord[] }> = [];
  for (const row of history) {
    const last = spans[spans.length - 1];
    const school = row.school ?? 'Previous program';
    if (last && last.school === school) last.rows.push(row);
    else spans.push({ school, rows: [row] });
  }

  return (
    <div className="coach-career-view">
      <header className="coach-career-head">
        <span><small>YEAR BY YEAR</small><strong>Career path</strong></span>
        <b>{coach.careerWins}-{coach.careerLosses}</b>
      </header>
      <div className="coach-career-spans">
        {spans.map((span, si) => (
          <section className="coach-career-school" key={`${span.school}-${si}`}>
            <header style={{ borderTopColor: teamColour(abbrOfSchool(span.school)) }}>
              <span><small>PROGRAM</small><strong>{span.school}</strong></span>
              <b>{seasonWord(span.rows.length)}</b>
            </header>
            <div className="coach-career-years">
              {span.rows.map((row) => (
                <article className={row.finish === 'champion' ? 'champion' : ''} key={row.year}>
                  <strong>{row.year}</strong>
                  <b>{row.w}-{row.l}</b>
                  <span>{FINISH_WORD[row.finish] ?? row.finish}{row.wonConference ? ' · conference champions' : ''}</span>
                  <em>{row.finish === 'champion' ? 'TITLE' : ''}</em>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const FINISH_WORD: Record<string, string> = {
  missed: 'Missed the tournament',
  regional: 'Regional',
  omaha: 'Omaha',
  'runner-up': 'National runner-up',
  champion: 'NATIONAL CHAMPION',
};

/** Best-effort colour lookup for a school named in an old career row. */
function abbrOfSchool(school: string): string {
  for (const c of CONFERENCES) {
    const hit = c.schools.find((s) => s.school === school);
    if (hit) return hit.abbr;
  }
  return '';
}

const seasonWord = (n: number): string => `${n} season${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------------------
// The hall
// ---------------------------------------------------------------------------

/** One man's whole college career, as the record book has it. */
interface HallRow {
  id: PlayerId;
  name: string;
  first: number;
  last: number;
  /** Every program he played for under you, in the order he played for them. */
  teams: string[];
  pitcher: boolean;
  ab: number; h: number; hr: number; rbi: number;
  w: number; l: number; outs: number; er: number; k: number;
  /** What he won while he was here, without repeats. */
  honours: string[];
}

const sum = (years: CareerYear[], key: keyof CareerYear): number =>
  years.reduce((a, y) => a + ((y[key] as number | undefined) ?? 0), 0);

/**
 * The record book, folded into one row per man.
 *
 * This is the only place a list of men who left four years ago can be printed
 * from: rosters are rewritten every June and the departure notices are kept for
 * one offseason, so nothing else in the save still remembers them. Which is why
 * a career row carries the player's name — see `CareerYear` in engine/season.ts.
 *
 * Rows written before it did are filed under an id that *was* his name, and for
 * those the key is still the answer.
 */
function hallRows(
  careers: Record<PlayerId, CareerYear[]>,
  honours: Map<string, string[]>,
): HallRow[] {
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
      // Same test the player card uses to decide which career table to draw, so
      // a two-way man lands in the same half of the book on both screens.
      pitcher: years.some((y) => (y.outs ?? 0) > 0) || !years.some((y) => (y.ab ?? 0) > 0),
      ab: sum(years, 'ab'), h: sum(years, 'h'), hr: sum(years, 'hr'), rbi: sum(years, 'rbi'),
      w: sum(years, 'w'), l: sum(years, 'l'), outs: sum(years, 'outs'),
      er: sum(years, 'er'), k: sum(years, 'k'),
      honours: honours.get(id) ?? [],
    };
  });
}

/**
 * The men you put in, and the men who piled up the most. In that order.
 *
 * This tab used to be the second thing alone: two leaderboards of career hits and
 * career strikeouts, computed live and honest about being a leaderboard. B12 is
 * the first thing, and the difference between them is the whole point. A
 * leaderboard is a fact about who is currently top of a column and it changes
 * when somebody passes him. An induction is a verdict, it happens on a date, it
 * is announced, and nothing later takes it away — see `engine/hall.ts` for what
 * it takes and why a plaque is frozen at the moment it is written.
 *
 * The leaderboards stay, underneath, because they answer a different question.
 * Who accumulated the most is worth knowing about a program and it is not the
 * same as who was great: a four year regular will out-hit a two year star every
 * time, and only one of them has a plaque.
 */
function HallSheet() {
  const season = useDynasty((s) => s.season);
  const history = useDynasty((s) => s.history);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const version = useDynasty((s) => s.version);
  void version;
  const [leaders, setLeaders] = useState<'bats' | 'arms'>('bats');
  const [openYears, setOpenYears] = useState<Record<number, boolean>>({});

  if (!season) return null;

  const honours = honoursByPlayer(history);
  const rows = hallRows(season.careers ?? {}, honours);
  const inducted = [...(season.hall ?? [])].sort((a, b) => b.year - a.year || b.score - a.score);
  /*
    Folded by the June they went in, newest open — the same fold the alumni
    archive wears. Reported 2026-09-10: "the hall of fame tab is a mess once
    it starts filling." A plaque a class, not a wall of them.
  */
  const byYear = new Map<number, Inductee[]>();
  for (const m of inducted) byYear.set(m.year, [...(byYear.get(m.year) ?? []), m]);
  const classes = [...byYear.entries()];

  // Ten is what fits before a leaderboard stops being a leaderboard. The rest
  // are still reachable — every one of these men has a card of his own.
  const bats = rows.filter((r) => !r.pitcher).sort((a, b) => b.h - a.h).slice(0, 10);
  const arms = rows.filter((r) => r.pitcher).sort((a, b) => b.k - a.k).slice(0, 10);

  return (
    <>
      <section className="hall-summary">
        <span><small>THE HALL</small><strong>{inducted.length}</strong><em>inducted</em></span>
        <span><small>CLASSES</small><strong>{classes.length}</strong><em>{classes.length === 1 ? 'year' : 'years'}</em></span>
        <span><small>CAREERS</small><strong>{rows.length}</strong><em>on file</em></span>
      </section>

      {inducted.length === 0 ? (
        <section className="hall-empty">
          <small>NOBODY IN IT YET</small>
          <strong>The ballot meets in June.</strong>
          <p>A career, not a season. Your best men go in when their playing days here are done.</p>
        </section>
      ) : (
        <div className="hall-classes">
          {classes.map(([year, men], i) => {
            const on = openYears[year] ?? i === 0;
            return (
              <section className={`hall-class${on ? ' is-open' : ''}`} key={year}>
                <button
                  type="button" className="hall-class-head tap" aria-expanded={on}
                  onClick={() => setOpenYears({ ...openYears, [year]: !on })}
                >
                  <span><small>CLASS OF {year}</small><strong>{men.length} {men.length === 1 ? 'man' : 'men'}</strong></span>
                  <b aria-hidden="true">{on ? '−' : '+'}</b>
                </button>
                {on && men.map((m) => (
                  <Plaque
                    key={m.id}
                    man={m}
                    honours={honours.get(m.id) ?? []}
                    marks={marksHeldBy(season, m.id)}
                    onOpen={() => openPlayer(m.id)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}

      {/*
        Named apart from the plaques, because the two were once read as one
        list: after one season the plaques are empty and these tables hold two
        dozen ordinary freshmen, under a tab called HALL OF FAME. One table at
        a time, with a switch, and a kicker that says whose rosters these are.
      */}
      <SectionHeading kicker="CAREER LEADERS · YOUR ROSTERS" title="Record men" />
      <Segmented<'bats' | 'arms'>
        label="Career leaders"
        value={leaders}
        onChange={setLeaders}
        options={[{ value: 'bats', label: 'Batting · hits' }, { value: 'arms', label: 'Pitching · strikeouts' }]}
      />
      {leaders === 'bats' ? (
        <Table cols={BAT_COLS} head={['', 'PLAYER', 'H', 'AVG', 'HR']}>
          {bats.length === 0
            ? <Empty>No hitter has finished a season for you yet.</Empty>
            : bats.map((r, i) => (
              <HallRowView
                key={r.id}
                rank={i + 1}
                row={r}
                cols={BAT_COLS}
                values={[String(r.h), r.ab > 0 ? pct(r.h / r.ab) : '—', String(r.hr)]}
                onClick={() => openPlayer(r.id)}
              />
            ))}
        </Table>
      ) : (
        <Table cols={ARM_COLS} head={['', 'PLAYER', 'K', 'W-L', 'ERA']}>
          {arms.length === 0
            ? <Empty>No pitcher has finished a season for you yet.</Empty>
            : arms.map((r, i) => (
              <HallRowView
                key={r.id}
                rank={i + 1}
                row={r}
                cols={ARM_COLS}
                values={[String(r.k), `${r.w}-${r.l}`, r.outs > 0 ? (r.er * 27 / r.outs).toFixed(2) : '—']}
                onClick={() => openPlayer(r.id)}
              />
            ))}
        </Table>
      )}
    </>
  );
}

/**
 * Every record in the country this man still holds, as the plaque names them.
 *
 * Printed and never scored, and that separation is the point of B12 rather than
 * an implementation detail. The brief was that a man who holds one enormous
 * single-game record and was otherwise ordinary must not get in, so the ballot in
 * `engine/hall.ts` cannot see the book at all. What a hall of famer holds is
 * still worth reading, so it is here — on the plaque, after the fact.
 *
 * Team and coaching rows are skipped: they are not his.
 */
function marksHeldBy(season: SeasonState, id: PlayerId): string[] {
  const out: string[] = [];
  for (const [key, mark] of Object.entries(season.records ?? {})) {
    if (mark.id !== id) continue;
    const spec = RECORDS[key as RecordKey];
    const prefix = spec.group === 'game' ? 'GAME'
      : spec.group === 'season' ? 'SEASON'
      : spec.group === 'career' ? 'CAREER'
      : null;
    if (prefix === null) continue;
    out.push(`${prefix} ${spec.label}`);
  }
  return out;
}

/** One man, in: a seal, his name, his years, his line, and what he still holds. */
function Plaque(
  { man, honours, marks, onOpen }:
  { man: Inductee; honours: string[]; marks: string[]; onOpen: () => void },
) {
  const span = man.first === man.last ? `${man.first}` : `${man.first}–${man.last}`;
  return (
    <button className="hall-plaque tap" type="button" onClick={onOpen}>
      <span className="hall-plaque-seal" aria-hidden="true">{man.pitcher ? 'P' : 'H'}</span>
      <span className="hall-plaque-body">
        <strong>{man.name}</strong>
        <small>{span} · {man.teams.join(' · ')}</small>
        <em>{man.line}</em>
        {honours.length > 0 && (
          <span className="hall-chips">
            {honours.slice(0, 4).map((t) => <i key={t}>{t.toUpperCase()}</i>)}
            {honours.length > 4 && <i className="more">+{honours.length - 4}</i>}
          </span>
        )}
        {marks.length > 0 && <span className="hall-marks">STILL HOLDS · {marks.join(' · ')}</span>}
      </span>
    </button>
  );
}

const BAT_COLS = '22px 1fr 30px 38px 26px';
const ARM_COLS = '22px 1fr 30px 40px 40px';

function Table(
  { cols, head, children }: { cols: string; head: string[]; children: ReactNode },
) {
  return (
    <div className="hall-table">
      <div className="hall-table-head" style={{ gridTemplateColumns: cols }}>
        {head.map((c, i) => <span key={`${c}-${i}`} className="label">{c}</span>)}
      </div>
      {children}
    </div>
  );
}

function HallRowView(
  { rank, row, cols, values, onClick }:
  { rank: number; row: HallRow; cols: string; values: string[]; onClick: () => void },
) {
  const span = row.first === row.last ? `${row.first}` : `${row.first}–${row.last}`;
  return (
    <button
      className={`hall-row tap${row.honours.length > 0 ? ' has-honours' : ''}`}
      type="button"
      style={{ gridTemplateColumns: cols }}
      onClick={onClick}
    >
      <span className="rank">{rank}</span>
      <span className="name">{row.name}</span>
      {values.map((v, i) => <span key={i} className="val">{v}</span>)}
      <span className="meta">{span} · {row.teams.join(' · ')}</span>
      {row.honours.length > 0 && (
        <span className="hall-chips">
          {row.honours.slice(0, 3).map((t) => <i key={t}>{t.toUpperCase()}</i>)}
          {row.honours.length > 3 && <i className="more">+{row.honours.length - 3}</i>}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const verdictWord = (v: string): string =>
  v === 'exceeded' ? 'Above expectations'
  : v === 'met' ? 'Expectations met'
  : v === 'missed' ? 'Below expectations'
  : 'A bad year';

/**
 * One line of the board's checklist.
 *
 * Three states, not two. A box that has not been decided yet is drawn as open
 * rather than as failed — mid-season a placement objective is genuinely unknown,
 * and showing it with a cross would read as "you have already blown this".
 */
function Box({
  objective, met, settled, wins,
}: { objective: Objective; met: boolean; settled: boolean; wins: number }) {
  const mark = met ? '✓' : settled ? '✕' : '○';
  const tone = met ? 'var(--win)' : settled ? 'var(--clay)' : 'rgba(var(--ink-rgb), .34)';

  // Only the counting objectives can show progress; the rest are yes or no.
  const counts = objective.key === 'wins' || objective.key === 'stretchWins';
  const progress = counts && !met ? `${wins} / ${objective.target}` : null;

  return (
    <article className={`board-objective${met ? ' is-met' : settled ? ' is-missed' : ' is-open'}`}>
      <span className="board-objective-mark" style={{ color: tone }}>{mark}</span>
      <span className="board-objective-copy">
        <small>{objective.required ? 'REQUIRED' : 'BONUS'}</small>
        <strong>{objective.label}</strong>
      </span>
      {progress && <b>{progress}</b>}
    </article>
  );
}

function Delta({ k, from, to }: { k: string; from: number; to: number }) {
  const up = to > from;
  const flat = to === from;
  return (
    <div>
      <div className="label">{k}</div>
      <div style={{ font: "600 calc(13px * var(--ts)) var(--mono)", marginTop: 2 }}>
        {from} <span style={{
          color: flat ? 'var(--dim)' : up ? 'var(--win)' : 'var(--clay)',
        }}>{flat ? '→' : up ? '↑' : '↓'} {to}</span>
      </div>
    </div>
  );
}

function Head({ children }: { children: ReactNode }) {
  return (
    <div className="flow-section-title"><span className="label">{children}</span></div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <div className="program-note">{children}</div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="program-empty">{children}</div>;
}
