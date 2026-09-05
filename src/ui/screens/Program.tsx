// Program.tsx
// The program hub.
//
// Overview is intentionally a dashboard rather than another tab strip: Board,
// Budget, Watchlist, and Hall are destinations, not four more pieces of chrome
// to learn. The coach profile remains a focused subpage, while season-by-season
// history stays in the adjacent History screen so there is only one record book.
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
import { REGION_OF_STATE, CONFERENCES } from '../../data/schools.js';
import { playerId, type PlayerId } from '../../engine/types.js';
import { CoachPortrait } from '../CoachPortrait.js';
import { useOpenTeam } from './TeamCard.js';
import { teamColour } from '../Avatar.js';
import { Crest } from '../Crest.js';
import { ArrowLeftIcon, ChevronRightIcon, StarIcon } from '@radix-ui/react-icons';
import {
  BudgetBar, FieldNote, Metric, MetricStrip, ModuleIntro, SectionHeading, Segmented,
} from '../components/Kit.js';
import {
  annualBudget, dollars, marketFor, remaining, wageBill,
  FACILITIES, MAX_FACILITY, SCOUT_COST, SCOUT_DAYS, SEATS, SEAT_LABEL, SEAT_NOTE,
  BUILDINGS, winterCraft, nightCraft, shapeOf, fitFactor, facilityLevel, facilityUpgradeCost, facilityEffectAt,
  FACILITY_MAX_LEVEL, pipelineStrength, pipelineLabel, type Assistant, type StaffSeat, type Building,
} from '../../engine/economy.js';
import { handles } from '../../state/depth.js';
import { FirstVisit } from '../Tutorial.js';
import { Modal } from '../Modal.js';
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
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const sheet = useDynasty((s) => s.programSheet);
  const clearUnseenTrophies = useDynasty((s) => s.clearUnseenTrophies);
  const unseenTrophies = useDynasty((s) => s.unseenTrophies.length);
  const watch = useDynasty((s) => s.watch);
  const setSheet = useDynasty((s) => s.setProgramSheet);
  const economy = useDynasty((s) => s.economy);
  const coach = useDynasty((s) => s.coach);
  const boardAsk = useDynasty((s) => s.boardAsk);
  void version;

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
  const books = Object.values(economy.scouted).length;
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
        kicker={`${team.conference} · ${year}`}
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

        <button className="program-dashboard-card tap" type="button" onClick={() => setSheet('money')}>
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
      ? 'You recruit well yourself, so a second voice here says less.'
      : 'Recruiting is not your strong side.';
  }
  const what = seat === 'hitting' ? 'bats' : 'arms';
  if (teacher) {
    return youngSide >= 5
      ? `${youngSide} of your ${what} are underclassmen.`
      : `Your ${what} are mostly finished articles.`;
  }
  return own >= 55
    ? `You already coach ${what} well on the night.`
    : `Your own ${seat === 'hitting' ? 'OFFENSE' : 'DEFENSE'} is ${own}.`;
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
  const build = useDynasty((s) => s.build);
  const upgradeFacility = useDynasty((s) => s.upgradeFacility);
  const runsStaff = useDynasty((s) => handles(s.depth, 'assistants'));
  const runsFacilities = useDynasty((s) => handles(s.depth, 'facilities'));
  const [view, setView] = useState<'plan' | 'staff' | 'facilities' | 'network'>('plan');
  const [staffSeat, setStaffSeat] = useState<StaffSeat>('hitting');
  const [facilityFocus, setFacilityFocus] = useState<Building>('cage');

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
  const pipelineStates = new Set<string>([
    team.def.state,
    ...Object.keys(economy.pipelines ?? {}),
    ...(economy.staff.recruiting?.pipelineState ? [economy.staff.recruiting.pipelineState] : []),
  ]);
  const pipelines = [...pipelineStates]
    .map((state) => ({
      state,
      strength: pipelineStrength(economy, state, team.def.state),
      signings: economy.pipelines?.[state]?.signings ?? 0,
      source: economy.staff.recruiting?.pipelineState === state ? 'COORDINATOR' : state === team.def.state ? 'HOME' : 'BUILT',
    }))
    .filter((pipe) => pipe.strength >= 20)
    .sort((a, b) => b.strength - a.strength || a.state.localeCompare(b.state));
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
      <section className="money-command-center">
        <div className="money-available">
          <small>AVAILABLE TO DEPLOY</small>
          <strong>{dollars(Math.max(0, left))}</strong>
          <p>{dollars(committed)} committed of {dollars(budget)} this year.</p>
        </div>
        <div className="money-ledger-track" aria-label={`${dollars(committed)} committed of ${dollars(budget)}`}>
          <i><b style={{ width: `${Math.round(Math.min(1, committed / Math.max(1, budget)) * 100)}%` }} /></i>
          <span><small>COMMITTED</small><b>{Math.round(Math.min(1, committed / Math.max(1, budget)) * 100)}%</b></span>
        </div>
        <div className="money-allocation-strip">
          <span><small>STAFF</small><strong>{dollars(wages)}</strong></span>
          <span><small>PROJECTS + SCOUTING</small><strong>{dollars(economy.spent)}</strong></span>
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
          <button className="money-plan-card tap" type="button" onClick={() => setView('staff')}>
            <span><small>STAFF</small><strong>{staffCount}/3 seats filled</strong></span>
            <p>{dollars(wages)} in annual wages. {staffCount < 3 ? `${3 - staffCount} seat${3 - staffCount === 1 ? '' : 's'} still open.` : 'The room is staffed.'}</p>
            <em>{staffCount < 3 ? 'Hiring changes the fixed cost of every decision after it.' : 'Review strengths, networks, and replacements.'}</em>
            <ChevronRightIcon />
          </button>

          <button className="money-plan-card tap" type="button" onClick={() => setView('facilities')}>
            <span><small>FACILITIES</small><strong>{facilityCount}/3 specialties built</strong></span>
            <p>{nextFacility ? `${nextFacility.label} can move to level ${nextFacility.next} for ${dollars(nextFacility.cost)}.` : 'Every facility is fully developed.'}</p>
            <em>{nextFacility && left < nextFacility.cost ? `${dollars(nextFacility.cost - left)} short of the cheapest next project.` : 'Development and recruiting live here.'}</em>
            <ChevronRightIcon />
          </button>

          <button className="money-plan-card tap" type="button" onClick={() => setView('network')}>
            <span><small>NETWORK</small><strong>{pipelines.length} market{pipelines.length === 1 ? '' : 's'} · {books} live report{books === 1 ? '' : 's'}</strong></span>
            <p>{pipelines[0] ? `${pipelines[0].state} is your strongest relationship at ${pipelines[0].strength}/100.` : 'Your recruiting map is still open ground.'}</p>
            <em>Scouting reports cost {dollars(SCOUT_COST)} and turn opponent information into playbooks.</em>
            <ChevronRightIcon />
          </button>
        </section>
      )}

      {view === 'staff' && (
        <>
          <section className="money-section-lead compact">
            <small>FIXED COST</small>
            <h2>Build the room one seat at a time</h2>
            <p>Choose a seat, read the fit, then swipe candidates. You should never have to compare three jobs and nine people in one vertical wall.</p>
          </section>
          {!runsStaff && (
            <div className="delegation-banner" role="status">
              <span><small>DELEGATED</small><strong>Athletic director controls staffing</strong></span>
              <p>You can still inspect every seat, candidate, cost, and network effect.</p>
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
            const market = marketFor(worldKey, year, staffSeat);
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
                      <div className="staff-focus-stats">
                        <span><small>DEVELOPMENT</small><strong>{winterCraft(man)}</strong></span>
                        <span><small>GAME</small><strong>{nightCraft(man)}</strong></span>
                        <span><small>YEAR</small><strong>{Math.max(1, year - (man.joinedYear ?? year) + 1)}</strong></span>
                      </div>
                      <p>{SEAT_NOTE[staffSeat]}</p>
                      {staffSeat === 'recruiting' && man.pipelineState && (
                        <em>Network carried with him: <b>{man.pipelineState}</b></em>
                      )}
                      {runsStaff && (
                        <button className="staff-release tap" type="button" onClick={() => fireAssistant(staffSeat)}>
                          Let him go
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="staff-vacancy-copy">
                      <p>{SEAT_NOTE[staffSeat]}</p>
                      <strong>{market.length} candidates are available this cycle.</strong>
                    </div>
                  )}
                </article>

                <div className="decision-deck-head">
                  <span><small>MARKET</small><strong>{man ? 'Compare replacements' : 'Choose who gets the seat'}</strong></span>
                  <em>SWIPE →</em>
                </div>
                <section className="candidate-swipe-deck" aria-label={`${SEAT_LABEL[staffSeat]} candidates`}>
                  {market.map((m, slot) => {
                    const w = winterCraft(m);
                    const n = nightCraft(m);
                    const top = Math.max(w, n, 1);
                    const affordable = left >= m.wage;
                    return (
                      <article className="hire-card candidate-swipe-card" key={m.id}>
                        <header>
                          <span>
                            <strong>{m.name}</strong>
                            <small>{shapeOf(m)} · age {m.age}{m.pipelineState ? ` · ${m.pipelineState} network` : ''}</small>
                          </span>
                          <b>{dollars(m.wage)}</b>
                        </header>
                        <div className="hire-split">
                          <span><small>DEVELOPMENT</small><i style={{ width: `${Math.round((w / top) * 100)}%` }} /><b>{w}</b></span>
                          <span><small>GAME MANAGEMENT</small><i style={{ width: `${Math.round((n / top) * 100)}%` }} /><b>{n}</b></span>
                        </div>
                        <p className="hire-fit">{fitLine(
                          staffSeat, m,
                          staffSeat === 'hitting' ? coachSkills.offense : staffSeat === 'pitching' ? coachSkills.defense : coachSkills.recruiting,
                          staffSeat === 'pitching' ? youngArms : youngBats,
                        )}</p>
                        <div className="candidate-cost-preview">
                          <span><small>AFTER HIRE</small><strong>{affordable ? dollars(left - m.wage) : 'OVER BUDGET'}</strong></span>
                          {m.pipelineState && <span><small>NETWORK</small><strong>{m.pipelineState}</strong></span>}
                        </div>
                        <button className="candidate-hire-cta tap" type="button" disabled={!runsStaff || !affordable} onClick={() => hireAssistant(staffSeat, slot)}>
                          {!runsStaff ? 'AD controls this seat' : !affordable ? `Need ${dollars(m.wage - left)} more` : man ? `Replace · ${dollars(m.wage)}` : `Hire · ${dollars(m.wage)}`}
                        </button>
                      </article>
                    );
                  })}
                </section>
              </>
            );
          })()}
        </>
      )}

      {view === 'facilities' && (
        <>
          <section className="money-section-lead compact">
            <small>PROGRAM IDENTITY</small>
            <h2>Choose the edge you are building</h2>
            <p>One specialty gets the room. Pick it above, then decide whether the next level is worth what it takes away from the rest of the budget.</p>
          </section>
          {!runsFacilities && (
            <div className="delegation-banner" role="status">
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
                    <em>{maxed ? 'This specialty has reached its ceiling.' : 'Staff, scouting, and other projects all draw from the same annual room.'}</em>
                  </span>
                  {runsFacilities && !maxed && (
                    <button
                      className="facility-invest-cta tap"
                      type="button"
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
          <section className="money-section-lead">
            <small>INFORMATION + ACCESS</small>
            <h2>Own markets. Know opponents.</h2>
            <p>Your recruiting network compounds over years; scouting is a short-term spend that turns information into a matchup plan.</p>
          </section>
          <section className="network-command-grid">
            <article className="network-panel">
              <header><span><small>RECRUITING NETWORK</small><strong>{pipelines.length === 0 ? 'No established markets' : `${pipelines.length} active market${pipelines.length === 1 ? '' : 's'}`}</strong></span></header>
              {pipelines.length === 0 ? (
                <p>Repeated signings strengthen a state. Established pipelines improve the local pitch and can extend your recruiting reach.</p>
              ) : (
                <div className="pipeline-card-grid">
                  {pipelines.slice(0, 8).map((pipe) => (
                    <article className="pipeline-card" key={pipe.state}>
                      <span><small>{pipe.source}</small><strong>{pipe.state}</strong></span>
                      <b>{pipelineLabel(pipe.strength)}</b>
                      <i><em style={{ width: `${pipe.strength}%` }} /></i>
                      <small>{pipe.strength}/100{pipe.signings > 0 ? ` · ${pipe.signings} signed` : ''}</small>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article className="network-panel scouting-desk-panel">
              <header><span><small>SCOUTING DESK</small><strong>{books === 0 ? 'No live reports' : `${books} live report${books === 1 ? '' : 's'}`}</strong></span><b>{dollars(SCOUT_COST)} each</b></header>
              <p>A report reveals team habits and individual tendencies for {SCOUT_DAYS} days, then unlocks an opponent-specific playbook.</p>
              <div className="scouting-value-grid">
                <span><small>1</small><strong>Buy the report</strong><em>From a program profile.</em></span>
                <span><small>2</small><strong>Read the matchup</strong><em>Team habits + player tendencies.</em></span>
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
                <small>{t.conference} · {t.w}-{t.l} · {'★'.repeat(prestigeStars(t.prestige))}</small>
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
        <div style={{
          marginBottom: 16,
          border: `1px solid ${review.fired ? 'var(--clay)' : 'var(--faint)'}`,
          background: 'var(--paper)',
        }}>
          <div style={{
            padding: '6px 10px',
            background: review.fired ? 'var(--clay)' : 'var(--ink)',
          }}>
            <span style={{
              font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
            }}>{review.fired ? 'DISMISSED' : 'BOARD REVIEW'}</span>
          </div>
          <div style={{ padding: '12px' }}>
            <div style={{
              font: "800 calc(22px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
              color: review.fired ? 'var(--clay)' : 'var(--ink)',
            }}>{verdictWord(review.verdict)}</div>
            <div style={{
              marginTop: 7, font: "400 calc(12px * var(--ts))/1.55 var(--body)",
            }}>{review.message}</div>
            <div style={{
              marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap',
            }}>
              <Delta k="PROGRAM PRESTIGE" from={review.prestigeBefore} to={review.prestigeAfter} />
              <Delta k="COACH PRESTIGE" from={review.coachPrestigeBefore} to={review.coachPrestigeAfter} />
              <Delta k="SECURITY" from={review.securityBefore} to={review.securityAfter} />
            </div>
            {!review.fired && (
              <div style={{
                marginTop: 9, font: "400 calc(11.5px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
              }}>
                {review.extended
                  ? `Extended — ${review.contractYears} year${review.contractYears === 1 ? '' : 's'} on the new deal.`
                  : `${review.contractYears} year${review.contractYears === 1 ? '' : 's'} left on your contract.`}
              </div>
            )}
            {!review.fired && (
              <button
                onClick={clearReview}
                style={{
                  marginTop: 12, padding: '8px 14px', background: 'var(--field)',
                  border: '1px solid rgba(var(--ink-rgb), .42)',
                  font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.1em',
                }}
              >GOT IT</button>
            )}
          </div>
        </div>
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

      <div className="program-tiles">
        <Tile k="PROGRAM PRESTIGE" v={'★'.repeat(stars) + '☆'.repeat(5 - stars)} accent />
        <Tile k="ROSTER OVR" v={String(roster)} />
        <Tile k="CONTRACT" v={`${coach.contractYears}y`} accent={coach.contractYears <= 1} last />
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="label" style={{ marginBottom: 5 }}>
          THE MANDATE · {expectation.mandate.toUpperCase()}
        </div>
        <div style={{
          padding: '11px 12px', border: '1px solid var(--faint)', background: 'var(--paper)',
        }}>
          <div style={{ font: "400 calc(13px * var(--ts))/1.5 var(--body)" }}>{expectation.summary}</div>

          {/*
            The list, not a sentence. A mandate you can only read is atmosphere —
            you nod at it and forget it. A list you can check against tells you at
            any point in the season exactly which boxes are still open, and at the
            end it is the same list the board grades you on.
          */}
          <div style={{ marginTop: 10 }}>
            {expectation.objectives.map((o) => (
              <Box key={o.key} objective={o} met={objectiveMet(o, live)}
                settled={settledFor(o.key)} wins={played.w} />
            ))}
          </div>

          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--hairline)',
            font: "400 calc(11.5px * var(--ts))/1.45 var(--body)", color: 'var(--dim)',
          }}>
            Year {coach.tenure + 1} at the job.{' '}
            {coach.contractYears > 0
              ? `${coach.contractYears} season${coach.contractYears === 1 ? '' : 's'} left on your deal.`
              : 'You are coaching out the final year of your contract.'}
          </div>
          <Seat security={coach.security} />
        </div>
      </div>
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
        <div className="coach-profile-portrait"><CoachPortrait look={coach.look} size={148} /></div>
        <div className="coach-profile-copy">
          <small>{team.def.school.toUpperCase()} · {team.conference}</small>
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

  if (!season) return null;

  const honours = honoursByPlayer(history);
  const rows = hallRows(season.careers ?? {}, honours);
  const inducted = [...(season.hall ?? [])].sort((a, b) => b.year - a.year || b.score - a.score);

  // Twelve is what fits before a leaderboard stops being a leaderboard. The rest
  // are still reachable — every one of these men has a card of his own.
  const bats = rows.filter((r) => !r.pitcher).sort((a, b) => b.h - a.h).slice(0, 12);
  const arms = rows.filter((r) => r.pitcher).sort((a, b) => b.k - a.k).slice(0, 12);

  return (
    <>
      <SectionHeading
        kicker="THE HALL"
        title={inducted.length === 0
          ? 'Nobody in it yet'
          : `${inducted.length} inducted`}
      />
      {/*
        Reported: "the hall in program still has a shit ton of text that eats
        the whole screen." It did — eight lines of rules where a heading should
        have been. The rules have not changed and they are still worth knowing,
        so they are a field note rather than a paragraph: three lines that say
        what the hall wants and when it meets, and the reason the tables under
        it are not the hall.
      */}
      {inducted.length === 0
        ? null
        : inducted.map((m) => (
          <Plaque
            key={m.id}
            man={m}
            honours={honours.get(m.id) ?? []}
            marks={marksHeldBy(season, m.id)}
            onOpen={() => openPlayer(m.id)}
          />
        ))}

      {/*
        Named apart from the plaques above, and now separated from them, because
        the two were read as one list. Reported as "the hall of fame inducts
        after one season and inducts nobody remarkable": after one season the
        plaques are empty and these two tables hold two dozen ordinary freshmen,
        under a tab called HALL OF FAME. Nobody was inducted — the ballot is
        right and refuses anybody with one season — but the screen was saying
        otherwise, which comes to the same thing.

        So the section gets a rule of its own and a heading that says what it is
        not. Two different questions, one screen, and the screen has to say which
        is which loudly enough to survive being skimmed.
      */}
      <SectionHeading kicker="CAREER LEADERS" title="Your record men" />
      <Head>BATTING · BY CAREER HITS</Head>
      <Table cols={BAT_COLS} head={['PLAYER', 'H', 'AVG', 'HR']}>
        {bats.length === 0
          ? <Empty>No hitter has finished a season for you yet.</Empty>
          : bats.map((r) => (
            <HallRowView
              key={r.id}
              row={r}
              cols={BAT_COLS}
              values={[
                String(r.h),
                r.ab > 0 ? pct(r.h / r.ab) : '—',
                String(r.hr),
              ]}
              onClick={() => openPlayer(r.id)}
            />
          ))}
      </Table>

      <div style={{ marginTop: 14 }}>
        <Head>PITCHING · BY STRIKEOUTS</Head>
        <Table cols={ARM_COLS} head={['PLAYER', 'K', 'W-L', 'ERA']}>
          {arms.length === 0
            ? <Empty>No pitcher has finished a season for you yet.</Empty>
            : arms.map((r) => (
              <HallRowView
                key={r.id}
                row={r}
                cols={ARM_COLS}
                values={[
                  String(r.k),
                  `${r.w}-${r.l}`,
                  r.outs > 0 ? (r.er * 27 / r.outs).toFixed(2) : '—',
                ]}
                onClick={() => openPlayer(r.id)}
              />
            ))}
        </Table>
      </div>

      <Note>Your own rosters only. The country's records live in the record book.</Note>
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

/**
 * One man, in.
 *
 * Drawn in the same clothes the record book gives a mark of yours — a clay rule
 * down the left edge and a warm ground — because it is the same statement in a
 * different place: this one is ours.
 */
function Plaque(
  { man, honours, marks, onOpen }:
  { man: Inductee; honours: string[]; marks: string[]; onOpen: () => void },
) {
  const span = man.first === man.last ? `${man.first}` : `${man.first}–${man.last}`;
  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%', textAlign: 'left', display: 'block',
        marginTop: 8, padding: '10px 12px',
        background: 'rgba(var(--clay-rgb), .07)',
        border: '1px solid var(--faint)', borderLeft: '3px solid var(--clay)',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', gap: 8,
      }}>
        <span className="label" style={{ color: 'var(--clay)' }}>
          INDUCTED {man.year}
        </span>
        <span style={{ font: "400 calc(9px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
          {span} · {man.teams.join(' · ')}
        </span>
      </div>
      <div style={{
        font: "800 calc(19px * var(--ts))/1.05 var(--display)", textTransform: 'uppercase', marginTop: 3,
      }}>{man.name}</div>
      <div style={{ marginTop: 3, font: "500 calc(11px * var(--ts)) var(--mono)", color: 'var(--ink)' }}>
        {man.line}
      </div>
      {honours.length > 0 && (
        <div style={{
          marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: '2px 8px',
        }}>
          {honours.map((t) => (
            <span key={t} style={{
              font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.08em', color: 'var(--clay)',
            }}>{t.toUpperCase()}</span>
          ))}
        </div>
      )}
      {marks.length > 0 && (
        <div style={{
          marginTop: 5, paddingTop: 5, borderTop: '1px solid var(--hairline)',
          font: "400 calc(9.5px * var(--ts))/1.5 var(--mono)", color: 'var(--dim)',
        }}>
          STILL HOLDS · {marks.join(' · ')}
        </div>
      )}
    </button>
  );
}

const BAT_COLS = '1fr 30px 38px 26px';
const ARM_COLS = '1fr 30px 40px 40px';

function Table(
  { cols, head, children }: { cols: string; head: string[]; children: ReactNode },
) {
  return (
    <div style={{
      marginTop: 8, border: '1px solid var(--faint)', background: 'var(--paper)',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: cols, gap: 6,
        padding: '6px 10px', borderBottom: '1px solid var(--hairline)',
      }}>
        {head.map((c, i) => (
          <span key={c} className="label" style={{ textAlign: i === 0 ? 'left' : 'right' }}>
            {c}
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}

function HallRowView(
  { row, cols, values, onClick }:
  { row: HallRow; cols: string; values: string[]; onClick: () => void },
) {
  const span = row.first === row.last ? `${row.first}` : `${row.first}–${row.last}`;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        display: 'grid', gridTemplateColumns: cols, gap: 6, alignItems: 'baseline',
        padding: '8px 10px', borderBottom: '1px solid var(--hairline)',
        background: row.honours.length > 0 ? 'rgba(var(--clay-rgb), .05)' : 'transparent',
      }}
    >
      <span style={{
        font: "400 calc(12px * var(--ts)) var(--body)",
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        borderBottom: '1px dotted rgba(var(--ink-rgb), .35)',
      }}>{row.name}</span>
      {values.map((v, i) => (
        <span key={i} style={{ font: "500 calc(11px * var(--ts)) var(--mono)", textAlign: 'right' }}>{v}</span>
      ))}
      <span style={{
        gridColumn: '1 / -1', marginTop: 2,
        font: "400 calc(9px * var(--ts)) var(--mono)", color: 'var(--dim)',
      }}>{span} · {row.teams.join(' · ')}</span>
      {row.honours.length > 0 && (
        <span style={{
          gridColumn: '1 / -1', marginTop: 2,
          display: 'flex', flexWrap: 'wrap', gap: '2px 8px',
        }}>
          {row.honours.slice(0, 3).map((t) => (
            <span key={t} style={{
              font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.08em', color: 'var(--clay)',
            }}>{t.toUpperCase()}</span>
          ))}
          {row.honours.length > 3 && (
            <span style={{
              font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.08em', color: 'var(--dim)',
            }}>+{row.honours.length - 3}</span>
          )}
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
  const open = !settled && !met;
  const mark = met ? '✓' : settled ? '✕' : '○';
  const tone = met ? 'var(--win)' : settled ? 'var(--clay)' : 'rgba(var(--ink-rgb), .34)';

  // Only the counting objectives can show progress; the rest are yes or no.
  const counts = objective.key === 'wins' || objective.key === 'stretchWins';
  const progress = counts && !met ? `${wins} / ${objective.target}` : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0',
    }}>
      <span style={{ font: "700 calc(11px * var(--ts)) var(--mono)", color: tone, width: 12 }}>{mark}</span>
      <span style={{
        flex: 1, font: `${met ? 600 : 400} calc(12px * var(--ts))/1.4 var(--body)`,
        color: open ? 'var(--ink)' : met ? 'var(--ink)' : 'var(--dim)',
      }}>
        {objective.label}
        {!objective.required && (
          <span style={{
            marginLeft: 6, font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.1em',
            color: 'var(--dim)',
          }}>BONUS</span>
        )}
      </span>
      {progress && (
        <span style={{ font: "600 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>{progress}</span>
      )}
    </div>
  );
}

function Seat({ security }: { security: number }) {
  const label = security >= 70 ? 'SECURE'
    : security >= 45 ? 'STABLE'
    : security >= 25 ? 'WARM'
    : 'HOT SEAT';
  const tone = security >= 45 ? 'var(--ink)' : 'var(--clay)';
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: 4,
      }}>
        <span className="label">YOUR SEAT</span>
        <span style={{
          font: "700 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.1em', color: tone,
        }}>{label}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(var(--ink-rgb), .09)' }}>
        <div style={{
          width: `${Math.max(2, security)}%`, height: '100%', background: tone,
          transition: 'width 400ms ease',
        }} />
      </div>
    </div>
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

function Tile({ k, v, accent, last }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  void last;
  return (
    <div className={`program-tile${accent ? ' accent' : ''}`}>
      <div className="label">{k}</div>
      <strong>{v}</strong>
    </div>
  );
}

/** One of the two counters either side of the face. */
function Flank({ k, v, align }: { k: string; v: string; align: 'left' | 'right' }) {
  return (
    <div style={{ minWidth: 56, textAlign: align }}>
      <div className="label">{k}</div>
      <div style={{
        marginTop: 1, font: "800 calc(20px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
      }}>{v}</div>
    </div>
  );
}

function Head({ children }: { children: ReactNode }) {
  return (
    <div className="flow-section-title"><span className="label">{children}</span></div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="program-panel">{children}</div>;
}

function Note({ children }: { children: ReactNode }) {
  return <div className="program-note">{children}</div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="program-empty">{children}</div>;
}

function Stat({ k, v, last }: { k: string; v: string; last?: boolean }) {
  void last;
  return (
    <div className="program-stat">
      <span className="label">{k}</span>
      <b>{v}</b>
    </div>
  );
}

/** A `Stat` that also has to show where the number sits on its scale. */
function Meter(
  { k, v, value, note, last }:
  { k: string; v: string; value: number; note?: string; last?: boolean },
) {
  return (
    <div style={{
      padding: '8px 12px 11px',
      borderBottom: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10,
      }}>
        <span className="label">{k}</span>
        <span style={{ font: "600 calc(14px * var(--ts)) var(--mono)" }}>{v}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(var(--ink-rgb), .09)', marginTop: 6 }}>
        <div style={{
          width: `${Math.max(2, Math.min(100, value))}%`, height: '100%',
          background: 'var(--clay)', transition: 'width 400ms ease',
        }} />
      </div>
      {note && (
        <div style={{
          marginTop: 6, font: "400 calc(10.5px * var(--ts))/1.4 var(--body)", color: 'var(--dim)',
        }}>{note}</div>
      )}
    </div>
  );
}

/** A coach rating, drawn against the full scale the skill screen uses. */
function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: 4,
      }}>
        <span className="label">{label}</span>
        <span style={{ font: "600 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>{value}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(var(--ink-rgb), .09)' }}>
        <div style={{
          width: `${Math.max(0, Math.min(100, value))}%`, height: '100%',
          background: value >= 60 ? 'var(--clay)' : 'var(--ink)',
          opacity: value >= 60 ? 1 : 0.55,
        }} />
      </div>
    </div>
  );
}
