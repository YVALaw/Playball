import { useState } from 'react';
import { CheckIcon, ChevronRightIcon, LockClosedIcon } from '@radix-ui/react-icons';
import { ALL_STATES } from '../data/schools.js';
import {
  BUILDINGS, DIRECTIVE_LABEL, PROJECT_LABEL, PIPELINE_MIN, dollars, facilityLevel,
  facilityUpgradeCost, pipelineStrength, projectFacility, staffPlan, staffProjectWeeks,
  type Building, type Economy, type StaffDirective, type StaffProjectKind, type StaffSeat,
} from '../engine/economy.js';
import { RECRUITING_WEEKS } from '../engine/recruiting.js';
import type { SeasonState } from '../engine/season.js';
import {
  pipelineProjectGain, projectCandidates, projectOdds, PROJECT_ATTRIBUTE, PROJECT_FOCUS,
  PROJECT_FOCUS_GAIN, PROJECT_GAIN,
} from '../engine/staffProjects.js';
import { handles } from '../state/depth.js';
import { useDynasty } from '../state/store.js';
import { Confirmable } from './components/Kit.js';

const FOCUSES: Record<StaffSeat, StaffDirective[]> = {
  hitting: ['balanced', 'contact', 'power', 'discipline'],
  pitching: ['balanced', 'command', 'velocity', 'armCare'],
  recruiting: ['balanced', 'pipeline', 'stars', 'sleepers', 'needs'],
};
const FOCUS_HINT: Record<StaffDirective, string> = {
  balanced: 'General support', contact: 'Contact projects', power: 'Power projects',
  discipline: 'Discipline projects', command: 'Control projects', velocity: 'Stuff projects',
  armCare: 'Stamina projects', pipeline: '+4% recruiting interest', stars: '4–5★ prospects',
  sleepers: '1–3★ prospects', needs: 'Missing positions',
};
const TRAINING: Record<'hitting' | 'pitching', StaffProjectKind[]> = {
  hitting: ['hitting-contact', 'hitting-power', 'hitting-discipline'],
  pitching: ['pitching-command', 'pitching-velocity', 'pitching-arm-care'],
};

/** The same status on the roster and in the profile, including paused saves. */
export function staffWorkStatus(economy: Economy, seat: StaffSeat, weeksAvailable: number) {
  const project = staffPlan(economy, seat).project;
  const facility = BUILDINGS.find((b) => b.key === projectFacility(seat))!;
  const level = facilityLevel(economy, facility.key);
  if (!project) return {
    label: level < 1 ? 'PROJECTS LOCKED' : weeksAvailable === 0 ? 'NEXT SEASON' : 'NO PROJECT',
    detail: level < 1 ? facility.label : weeksAvailable === 0 ? 'Calendar closed' : 'Ready to assign',
    progress: 0,
  };
  return {
    label: level < 1 || weeksAvailable === 0 ? 'PAUSED' : 'IN PROGRESS',
    detail: `${PROJECT_LABEL[project.kind]} · ${project.weeksLeft}w left`,
    progress: Math.max(0, Math.min(100, Math.round((1 - project.weeksLeft / Math.max(1, project.weeksTotal)) * 100))),
  };
}

export function StaffWorkPanel({ team, seat, initialState, onFacility }: {
  team: SeasonState['teams'][number];
  seat: StaffSeat;
  initialState?: string;
  onFacility: (facility: Building) => void;
}) {
  const economy = useDynasty((s) => s.economy);
  const week = useDynasty((s) => s.season?.recruiting.week ?? 0);
  const canManage = useDynasty((s) => handles(s.depth, 'assistants'));
  const setFocus = useDynasty((s) => s.setStaffDirective);
  const start = useDynasty((s) => s.startStaffProject);
  const cancel = useDynasty((s) => s.cancelStaffProject);
  const [state, setState] = useState(initialState ?? team.def.state);
  const [selectedKind, setSelectedKind] = useState<StaffProjectKind | null>(null);
  const [playerId, setPlayerId] = useState('');
  const [pickingPlayer, setPickingPlayer] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const plan = staffPlan(economy, seat);
  const facility = BUILDINGS.find((b) => b.key === projectFacility(seat))!;
  const level = facilityLevel(economy, facility.key);
  const weeksAvailable = week >= 1 ? Math.max(0, RECRUITING_WEEKS - week + 1) : 0;
  const status = staffWorkStatus(economy, seat, weeksAvailable);
  const strength = pipelineStrength(economy, state, team.def.state);
  const projects: StaffProjectKind[] = seat === 'recruiting'
    ? strength >= PIPELINE_MIN ? ['pipeline-deepen', 'pipeline-maintain'] : ['pipeline-build']
    : TRAINING[seat];
  const kind = selectedKind && projects.includes(selectedKind) ? selectedKind : projects[0]!;
  const pool = projectCandidates(team.team, seat, kind);
  // No implicit player selection: the coach must choose a named target.
  const chosen = pool.find((p) => String(p.id) === playerId);
  const visiblePlayers = pool.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const weeks = staffProjectWeeks(economy, seat, kind);
  const enoughTime = weeks <= weeksAvailable;
  const matched = plan.directive === PROJECT_FOCUS[kind];
  const odds = chosen ? Math.round(projectOdds(economy, seat, chosen, kind) * 100) : null;
  const gain = seat === 'recruiting' ? pipelineProjectGain(economy, kind, strength, false) : PROJECT_GAIN;
  const focusedGain = seat === 'recruiting' ? pipelineProjectGain(economy, kind, strength, true) : PROJECT_FOCUS_GAIN;
  const project = plan.project;
  const activeTarget = project?.playerId
    ? projectCandidates(team.team, seat, project.kind).find((p) => String(p.id) === project.playerId) : undefined;
  const activeOdds = project ? project.odds ?? (activeTarget ? projectOdds(economy, seat, activeTarget, project.kind) : null) : null;
  const alignedWeeks = project ? project.alignedWeeks ?? (PROJECT_FOCUS[project.kind] === plan.directive ? project.weeksTotal - project.weeksLeft : 0) : 0;

  return <div className="staff-workspace">
    {!canManage && <p className="staff-work-note" role="status">Managed by your athletic director.</p>}
    <section className="staff-work-section">
      <header className="staff-section-title"><span><small>ONGOING</small><h3>Coaching focus</h3></span><span className="staff-status-tag">{DIRECTIVE_LABEL[plan.directive]}</span></header>
      <div className="staff-focus-picker" data-guide={seat === 'hitting' && canManage ? 'directive' : undefined} aria-label="Coaching focus">
        {FOCUSES[seat].map((focus) => <button key={focus} className={`tap${plan.directive === focus ? ' selected' : ''}`} type="button"
          aria-pressed={plan.directive === focus} disabled={!canManage} onClick={() => setFocus(seat, focus)}>
          <span><strong>{DIRECTIVE_LABEL[focus]}</strong><small>{FOCUS_HINT[focus]}</small></span>
          {plan.directive === focus && <CheckIcon aria-hidden="true" />}
        </button>)}
      </div>
      {seat === 'recruiting' && ['stars', 'sleepers', 'needs'].includes(plan.directive) && <p className="staff-work-note">About +10% RP effectiveness on matching prospects.</p>}
    </section>

    <section className="staff-work-section">
      <header className="staff-section-title"><span><small>TIME-LIMITED</small><h3>{project ? 'Current project' : 'Assign a project'}</h3></span><span className="staff-status-tag">{project ? status.label : `${weeksAvailable}w available`}</span></header>
      {project ? <>
        <div className="staff-active-project" role="status">
          <strong>{PROJECT_LABEL[project.kind]}</strong>
          <span>{project.state ?? (project.playerId
            ? activeTarget?.name ?? 'Player left the roster'
            : `${project.targetIds?.length ?? project.targetCount ?? 0} players · Group project`)}</span>
          <div className="staff-live-progress"><div role="progressbar" aria-label="Project progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.progress}><i style={{ width: `${status.progress}%` }} /></div><b>{project.weeksLeft}w left</b></div>
          <div className="staff-project-facts">
            <span><small>FOCUS WEEKS</small><b>{alignedWeeks} / {Math.ceil(project.weeksTotal * .6)}</b></span>
            {project.playerId && <span><small>SUCCESS CHANCE</small><b>{activeOdds === null ? '—' : `${Math.round(activeOdds * 100)}%`}</b></span>}
          </div>
          <p className="staff-work-note">{level < 1 ? `${facility.label} required to resume.` : weeksAvailable === 0 ? 'Resumes next recruiting season.' : 'Advances after each recruiting week.'}</p>
          <p className="staff-work-note">Bonus focus: {DIRECTIVE_LABEL[PROJECT_FOCUS[project.kind]]}.</p>
        </div>
        {level < 1 && <button type="button" className="secondary-command tap" onClick={() => onFacility(facility.key)}>Open {facility.label}</button>}
        {canManage && <Confirmable className="staff-cancel-project tap" idle="Cancel project" armed="Confirm cancel · progress will be lost" onConfirm={() => cancel(seat)} />}
      </> : level < 1 ? <button type="button" className="staff-facility-door tap" onClick={() => onFacility(facility.key)}>
        <LockClosedIcon aria-hidden="true" /><span><small>UNLOCK PROJECTS</small><strong>Build {facility.label}</strong><small>{dollars(facilityUpgradeCost(facility.key, 1))}</small></span><ChevronRightIcon aria-hidden="true" />
      </button> : <>
        {seat === 'recruiting' && <label className="staff-state-select"><span><b>1. Choose a state</b><small>{strength}/100 strength</small></span>
          <select value={state} disabled={!canManage} onChange={(e) => { setState(e.currentTarget.value); setError(''); }}>
            {ALL_STATES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>}
        <h4 className="staff-step-title">{seat === 'recruiting' ? '2. Choose the project' : '1. Choose a skill'}</h4>
        <div className="staff-project-picker" aria-label="Project goal">
          {projects.map((option) => <button type="button" key={option} disabled={!canManage} aria-pressed={kind === option}
            className={`tap${kind === option ? ' selected' : ''}`} onClick={() => { setSelectedKind(option); setError(''); }}>
            <strong>{seat === 'recruiting' ? PROJECT_LABEL[option] : PROJECT_ATTRIBUTE[option]}</strong>
            <small>{staffProjectWeeks(economy, seat, option)} weeks</small>{kind === option && <CheckIcon aria-hidden="true" />}
          </button>)}
        </div>

        {seat !== 'recruiting' && <>
          <h4 className="staff-step-title">2. Choose a player</h4>
          <button type="button" className="staff-player-select tap" disabled={!canManage || pool.length === 0} aria-expanded={pickingPlayer}
            onClick={() => { setPickingPlayer((open) => !open); setQuery(''); }}>
            <span><strong>{chosen?.name ?? (pool.length ? 'Select a player' : 'No eligible players')}</strong><small>{chosen ? `${chosen.pos} · ${chosen.classYear}` : 'One player per project'}</small></span><span>{chosen ? 'Change' : 'Choose'} <ChevronRightIcon aria-hidden="true" /></span>
          </button>
          {pickingPlayer && <div className="staff-player-picker">
            <input type="search" aria-label="Search eligible players" placeholder="Search players" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
            <div className="staff-player-options" aria-label="Eligible players">
              {visiblePlayers.map((p) => <button type="button" className="tap" key={String(p.id)} aria-pressed={String(p.id) === playerId}
                onClick={() => { setPlayerId(String(p.id)); setPickingPlayer(false); setError(''); }}>
                <span><strong>{p.name}</strong><small>{p.pos} · {p.classYear}</small></span><b>{Math.round(projectOdds(economy, seat, p, kind) * 100)}%<small>chance</small></b>
              </button>)}
              {visiblePlayers.length === 0 && <p className="staff-work-note">No players match that name.</p>}
            </div>
          </div>}
        </>}

        <div className="staff-assignment-preview" aria-label="Project preview" aria-live="polite">
          <div className="staff-project-facts">
            <span><small>{seat === 'recruiting' ? 'STRENGTH' : PROJECT_ATTRIBUTE[kind].toUpperCase()}</small><b>{seat === 'recruiting' ? `${strength} → ${strength + gain}` : `+${gain}`}<em>{seat === 'recruiting' ? `up to ${strength + focusedGain} with focus` : `up to +${focusedGain} with focus`}</em></b></span>
            <span><small>{seat === 'recruiting' ? 'DURATION' : 'SUCCESS CHANCE'}</small><b>{seat === 'recruiting' ? `${weeks}w` : odds === null ? '—' : `${odds}%`}</b></span>
          </div>
          <p className={`staff-bonus-note${matched ? ' matched' : ''}`}>{matched && <CheckIcon aria-hidden="true" />} {DIRECTIVE_LABEL[PROJECT_FOCUS[kind]]} focus for {Math.ceil(weeks * .6)}/{weeks} weeks earns the bonus.</p>
          {seat !== 'recruiting' && <small className="staff-work-note">Gains apply on success, up to 99.</small>}
        </div>
        {!enoughTime && <p className="staff-work-note" role="status">{weeksAvailable === 0 ? 'Projects reopen next recruiting season.' : `Needs ${weeks} weeks; ${weeksAvailable} remain this season.`}</p>}
        {error && <p className="staff-work-error" role="alert">{error}</p>}
        <button type="button" className="primary-command staff-start-project tap" disabled={!canManage || !enoughTime || (seat !== 'recruiting' && !chosen)}
          onClick={() => {
            if (!start(seat, kind, seat === 'recruiting' ? state : undefined, seat === 'recruiting' ? undefined : playerId)) {
              setError('Could not start. Check the player, facility, and time remaining.');
            } else setError('');
          }}>
          {!canManage ? 'Managed by athletic director' : seat !== 'recruiting' && !chosen ? 'Choose a player to continue' : !enoughTime ? 'Not enough weeks' : `Start project · ${weeks} weeks`}
        </button>
      </>}
    </section>
  </div>;
}
