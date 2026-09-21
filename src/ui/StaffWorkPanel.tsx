// StaffWorkPanel.tsx
// What an assistant coach is working on, and how to give him the next thing.
//
// Two layers, as the design system's coach sheet draws them: the coaching
// focus, which is always on, and one time-limited project. A project is set up
// in three numbered steps (the skill, the player, then the review) with the
// start button pinned in the sheet's footer, so the panel returns its body and
// its footer separately for the sheet to place.

import { useState, type ReactNode } from 'react';
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
import {
  Button, Callout, ConfirmButton, Face, List, ListRow, Meter, Monogram, OptionCard, OptionGroup,
  ProjectProgress, SearchField, SectionHeader, StatGroup, StatusBadge, Step,
} from './components/ui/index.js';
import { CLASS_NAME, FACILITY_NAME, POSITION_NAME, firstName, plural, stateName } from './words.js';

const FOCUSES: Record<StaffSeat, StaffDirective[]> = {
  hitting: ['balanced', 'contact', 'power', 'discipline'],
  pitching: ['balanced', 'command', 'velocity', 'armCare'],
  recruiting: ['balanced', 'pipeline', 'stars', 'sleepers', 'needs'],
};

/** What each focus buys, in a sentence the option card can carry. */
const FOCUS_HINT: Record<StaffDirective, string> = {
  balanced: 'General support, no project bonus',
  contact: 'Contact projects earn the bonus',
  power: 'Power projects earn the bonus',
  discipline: 'Discipline projects earn the bonus',
  command: 'Control projects earn the bonus',
  velocity: 'Strikeout stuff projects earn the bonus',
  armCare: 'Stamina projects earn the bonus',
  pipeline: 'Pipeline projects earn the bonus; recruiting points go 4% further',
  stars: 'Points go 10% further with 4 and 5 star recruits',
  sleepers: 'Points go 10% further with 1 to 3 star recruits',
  needs: 'Points go 10% further at positions you need',
};

const PIPELINE_HINT: Partial<Record<StaffProjectKind, string>> = {
  'pipeline-build': 'Start a relationship in a new state',
  'pipeline-deepen': 'Make a pipeline stronger',
  'pipeline-maintain': 'Keep a pipeline from cooling',
};

const TRAINING: Record<'hitting' | 'pitching', StaffProjectKind[]> = {
  hitting: ['hitting-contact', 'hitting-power', 'hitting-discipline'],
  pitching: ['pitching-command', 'pitching-velocity', 'pitching-arm-care'],
};

/** How many of a project's weeks have to be on the matching focus. */
export const focusWeeksNeeded = (weeks: number): number => Math.ceil(weeks * 0.6);

export type WorkState = 'locked' | 'ready' | 'active' | 'paused' | 'waiting';

/**
 * The same status on the staff card and in the coach's sheet.
 *
 * `label` and `detail` are the legacy words, still read by the needs list and
 * the tour; `state` is the design system's.
 */
export function staffWorkStatus(economy: Economy, seat: StaffSeat, weeksAvailable: number) {
  const project = staffPlan(economy, seat).project;
  const facility = BUILDINGS.find((b) => b.key === projectFacility(seat))!;
  const level = facilityLevel(economy, facility.key);
  if (!project) {
    const state: WorkState = level < 1 ? 'locked' : weeksAvailable === 0 ? 'waiting' : 'ready';
    return {
      state,
      label: level < 1 ? 'Projects locked' : weeksAvailable === 0 ? 'Opens next season' : 'No project',
      detail: level < 1 ? FACILITY_NAME[facility.key] : weeksAvailable === 0 ? 'Calendar closed' : 'Ready to assign',
      progress: 0,
      facility: facility.key,
      level,
    };
  }
  const paused = level < 1 || weeksAvailable === 0;
  return {
    state: (paused ? 'paused' : 'active') as WorkState,
    label: paused ? 'Paused' : 'In progress',
    detail: `${PROJECT_LABEL[project.kind]} · ${plural(project.weeksLeft, 'week')} left`,
    progress: Math.max(0, Math.min(100, Math.round((1 - project.weeksLeft / Math.max(1, project.weeksTotal)) * 100))),
    facility: facility.key,
    level,
  };
}

export interface StaffWork { body: ReactNode; footer: ReactNode }

/**
 * The coach's work, as a body and a footer for the sheet that holds it.
 * A hook rather than a component so the sheet can pin the footer.
 */
export function useStaffWork({ team, seat, initialState, onFacility }: {
  team: SeasonState['teams'][number];
  seat: StaffSeat;
  initialState?: string;
  onFacility: (facility: Building) => void;
}): StaffWork {
  const economy = useDynasty((s) => s.economy);
  const week = useDynasty((s) => s.season?.recruiting.week ?? 0);
  const canManage = useDynasty((s) => handles(s.depth, 'assistants'));
  const setFocus = useDynasty((s) => s.setStaffDirective);
  const start = useDynasty((s) => s.startStaffProject);
  const cancel = useDynasty((s) => s.cancelStaffProject);
  const [state, setState] = useState(initialState ?? team.def.state);
  const [selectedKind, setSelectedKind] = useState<StaffProjectKind | null>(null);
  const [playerId, setPlayerId] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const man = economy.staff[seat];
  const plan = staffPlan(economy, seat);
  const facility = BUILDINGS.find((b) => b.key === projectFacility(seat))!;
  const facilityName = FACILITY_NAME[facility.key];
  const level = facilityLevel(economy, facility.key);
  const weeksAvailable = week >= 1 ? Math.max(0, RECRUITING_WEEKS - week + 1) : 0;
  const strength = pipelineStrength(economy, state, team.def.state);
  const projects: StaffProjectKind[] = seat === 'recruiting'
    ? strength >= PIPELINE_MIN ? ['pipeline-deepen', 'pipeline-maintain'] : ['pipeline-build']
    : TRAINING[seat];
  const kind = selectedKind && projects.includes(selectedKind) ? selectedKind : projects[0]!;
  const pool = projectCandidates(team.team, seat, kind);
  // No implicit player selection: the coach chooses a named target.
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
  const alignedWeeks = project
    ? project.alignedWeeks ?? (PROJECT_FOCUS[project.kind] === plan.directive ? project.weeksTotal - project.weeksLeft : 0)
    : 0;
  const who = man ? firstName(man.name) : 'your coach';

  /* ------------------------------------------------------------- focus */
  const focusSection = (
    <section className="pb-stack">
      <SectionHeader
        level={3}
        title="Coaching focus"
        description="Matching projects gain more"
      />
      <OptionGroup label="Coaching focus" columns={2} guide={seat === 'hitting' && canManage ? 'directive' : undefined}>
        {FOCUSES[seat].map((focus) => (
          <OptionCard
            key={focus}
            title={DIRECTIVE_LABEL[focus]}
            hint={FOCUS_HINT[focus]}
            selected={plan.directive === focus}
            disabled={!canManage}
            onSelect={() => setFocus(seat, focus)}
          />
        ))}
      </OptionGroup>
    </section>
  );

  /* ------------------------------------------------------------ project */
  let projectSection: ReactNode;
  let footer: ReactNode = null;

  if (project) {
    const subjectName = project.state ? stateName(project.state)
      : project.playerId ? activeTarget?.name ?? 'Player left the roster'
        : plural(project.targetIds?.length ?? project.targetCount ?? 0, 'player');
    const kindLine = project.state ? `${PROJECT_LABEL[project.kind]} · Recruiting territory`
      : project.playerId ? PROJECT_LABEL[project.kind]
        : `${PROJECT_LABEL[project.kind]} · Group project`;
    const focusNeeded = focusWeeksNeeded(project.weeksTotal);
    /*
      Once the weeks left cannot carry the aligned weeks to the threshold, the
      focus bonus is arithmetically gone (the engine decides it with
      `alignedWeeks >= ceil(weeksTotal * 0.6)`), so the card stops promising it.
    */
    const focusReachable = alignedWeeks + project.weeksLeft >= focusNeeded;
    const liveStrength = project.state ? pipelineStrength(economy, project.state, team.def.state) : 0;
    const lo = seat === 'recruiting' ? pipelineProjectGain(economy, project.kind, liveStrength, false) : PROJECT_GAIN;
    const hi = seat === 'recruiting' ? pipelineProjectGain(economy, project.kind, liveStrength, true) : PROJECT_FOCUS_GAIN;
    // A stateless legacy recruiting project earns nothing, so it promises nothing.
    const showGain = seat !== 'recruiting' || !!project.state;
    const paused = level < 1 || weeksAvailable === 0;
    projectSection = (
      <section className="pb-stack">
        <SectionHeader level={3} title="Current project" />
        <ProjectProgress
          subject={{
            name: subjectName,
            meta: activeTarget ? `${POSITION_NAME[activeTarget.pos]} · ${CLASS_NAME[activeTarget.classYear]}` : undefined,
            lead: project.playerId
              ? <Face id={project.playerId} team={team.def.abbr} size={44} />
              : <Monogram icon="globe" tone="info" size={44} />,
          }}
          kind={kindLine}
          done={project.weeksTotal - project.weeksLeft}
          total={project.weeksTotal}
          status={paused ? { tone: 'warning', icon: 'pause', label: 'Paused' } : undefined}
          gain={showGain ? {
            lo, hi: focusReachable ? hi : lo,
            attribute: seat === 'recruiting' ? `Strength · ${liveStrength} now` : PROJECT_ATTRIBUTE[project.kind],
          } : undefined}
          chance={project.playerId && activeOdds !== null ? Math.round(activeOdds * 100) : undefined}
          chanceNote="Set at the start"
          focus={{
            label: DIRECTIVE_LABEL[PROJECT_FOCUS[project.kind]],
            matched: alignedWeeks,
            needed: focusNeeded,
            reachable: focusReachable,
          }}
          note={level < 1 ? `The ${facilityName} is needed to resume.`
            : weeksAvailable === 0 ? 'Resumes when the next recruiting season opens.'
              : 'Moves on after each recruiting week. Gains apply only if it works, up to 99.'}
        >
          {level < 1 && (
            <Button variant="tonal" block onClick={() => onFacility(facility.key)} iconAfter="chevron-right">
              Build the {facilityName}
            </Button>
          )}
        </ProjectProgress>
      </section>
    );
    if (canManage) {
      footer = (
        <ConfirmButton
          variant="secondary"
          block
          idle="Cancel project"
          armed="Tap again to cancel"
          armedMeta="Progress is lost"
          onConfirm={() => cancel(seat)}
        />
      );
    }
  } else if (level < 1) {
    projectSection = (
      <section className="pb-stack">
        <SectionHeader level={3} title="Projects" />
        <Callout
          tone="neutral"
          icon="lock"
          title="Projects locked"
          action={{
            label: `See the ${facilityName}`,
            meta: dollars(facilityUpgradeCost(facility.key, 1)),
            variant: 'tonal',
            onClick: () => onFacility(facility.key),
          }}
        >
          Build the {facilityName} to give {who} projects.
        </Callout>
      </section>
    );
  } else {
    const noTime = !enoughTime;
    const attr = PROJECT_ATTRIBUTE[kind];
    const steps = seat === 'recruiting' ? (
      <>
        <Step number={1} state="done" title="Choose a state" summary={stateName(state)}>
          <div className="pb-stack">
            <label className="pb-field">
              <span className="pb-field__label">State</span>
              <select
                className="pb-field__input pb-select"
                value={state}
                disabled={!canManage}
                onChange={(e) => { setState(e.currentTarget.value); setError(''); }}
              >
                {ALL_STATES.map((value) => <option key={value} value={value}>{stateName(value)}</option>)}
              </select>
            </label>
            <Meter
              size="sm"
              label="Strength now"
              valueText={`${strength} / 100`}
              value={strength}
              markers={[{ at: PIPELINE_MIN }, { at: 60 }]}
            />
          </div>
        </Step>
        <Step number={2} state="done" title="Choose the project" summary={PROJECT_LABEL[kind]}>
          <OptionGroup label="Project">
            {projects.map((option) => (
              <OptionCard
                key={option}
                title={PROJECT_LABEL[option]}
                hint={PIPELINE_HINT[option]}
                meta={plural(staffProjectWeeks(economy, seat, option), 'week')}
                badge={PROJECT_FOCUS[option] === plan.directive ? 'Matches focus' : undefined}
                selected={kind === option}
                disabled={!canManage}
                onSelect={() => { setSelectedKind(option); setError(''); }}
              />
            ))}
          </OptionGroup>
        </Step>
        <Step number={3} state="current" title="Review and start">
          <div className="pb-stack">
            <StatGroup
              size="sm"
              items={[
                { label: 'Strength', value: `${strength}→${Math.min(100, strength + gain)}`, note: `Up to ${Math.min(100, strength + focusedGain)} with the focus` },
                { label: 'Takes', value: weeks, unit: 'wk', note: `of ${weeksAvailable} left` },
              ]}
            />
            <FocusNote matched={matched} kind={kind} weeks={weeks} bonus={`${Math.min(100, strength + focusedGain)} strength`} />
          </div>
        </Step>
      </>
    ) : (
      <>
        <Step number={1} state="done" title="Choose a skill" summary={attr}>
          <OptionGroup label="Project skill" columns={3}>
            {projects.map((option) => (
              <OptionCard
                key={option}
                title={PROJECT_ATTRIBUTE[option]}
                meta={`${staffProjectWeeks(economy, seat, option)} wk`}
                badge={PROJECT_FOCUS[option] === plan.directive ? 'Matches focus' : undefined}
                selected={kind === option}
                disabled={!canManage}
                onSelect={() => { setSelectedKind(option); setError(''); }}
              />
            ))}
          </OptionGroup>
        </Step>
        <Step number={2} state={chosen ? 'done' : 'current'} title="Choose a player" summary={chosen?.name}>
          <div className="pb-stack">
            {pool.length > 8 && (
              <SearchField label="Search eligible players" placeholder="Search players" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
            )}
            {pool.length === 0 ? (
              <Callout tone="neutral">No player on the roster is eligible for this project.</Callout>
            ) : (
              <>
              <p className="pb-list-caption"><span>Player</span><span>Chance it works</span></p>
              <List label="Eligible players" role="radiogroup">
                {visiblePlayers.map((p) => {
                  const on = String(p.id) === playerId;
                  return (
                    <ListRow
                      key={String(p.id)}
                      lead={<Face id={String(p.id)} team={team.def.abbr} size={36} />}
                      title={p.name}
                      subtitle={`${POSITION_NAME[p.pos]} · ${CLASS_NAME[p.classYear]}`}
                      value={`${Math.round(projectOdds(economy, seat, p, kind) * 100)}%`}
                      selected={on}
                      chevron={false}
                      disabled={!canManage}
                      status={on ? <StatusBadge tone="accent" icon="check">Selected</StatusBadge> : undefined}
                      onClick={() => { setPlayerId(String(p.id)); setError(''); }}
                    />
                  );
                })}
                {visiblePlayers.length === 0 && <ListRow title="No players match that name" />}
              </List>
              </>
            )}
          </div>
        </Step>
        <Step number={3} state={chosen ? 'current' : 'upcoming'} title="Review and start">
          <div className="pb-stack">
            <StatGroup
              size="sm"
              items={[
                { label: 'If it works', value: `+${gain} to +${focusedGain}`, note: attr },
                { label: 'Chance', value: odds === null ? '—' : `${odds}%`, note: 'Set at the start' },
                { label: 'Takes', value: weeks, unit: 'wk', note: `of ${weeksAvailable} left` },
              ]}
            />
            <FocusNote matched={matched} kind={kind} weeks={weeks} bonus={`+${focusedGain} ${attr}`} />
          </div>
        </Step>
      </>
    );
    projectSection = (
      <section className="pb-stack">
        <SectionHeader level={3} title="Assign a project" description={`${plural(weeksAvailable, 'week')} left · one at a time`} />
        <div className="pb-steps">{steps}</div>
        {noTime && (
          <Callout tone="warning" title={weeksAvailable === 0 ? 'Projects open when recruiting starts' : 'Not enough weeks left'}>
            {weeksAvailable === 0 ? undefined : `It takes ${plural(weeks, 'week')}; ${weeksAvailable} left.`}
          </Callout>
        )}
        {error && <Callout tone="negative" role="alert">{error}</Callout>}
      </section>
    );
    const label = !canManage ? 'Managed by your athletic director'
      : seat !== 'recruiting' && !chosen ? 'Choose a player to continue'
        : noTime ? 'Not enough weeks left'
          : seat === 'recruiting' ? `Start: ${PROJECT_LABEL[kind].toLowerCase()}`
            : `Start ${attr.toLowerCase()} project`;
    footer = (
      <Button
        variant="primary"
        block
        meta={canManage && !noTime && (seat === 'recruiting' || chosen) ? plural(weeks, 'week') : undefined}
        disabled={!canManage || noTime || (seat !== 'recruiting' && !chosen)}
        onClick={() => {
          if (!start(seat, kind, seat === 'recruiting' ? state : undefined, seat === 'recruiting' ? undefined : playerId)) {
            setError('The project could not start. Check the player, the building and the weeks left.');
          } else setError('');
        }}
      >{label}</Button>
    );
  }

  const body = (
    <>
      {!canManage && (
        <Callout tone="info" title="Managed by your athletic director" />
      )}
      {focusSection}
      {projectSection}
    </>
  );
  return { body, footer };
}

/** Whether the project will earn the focus bonus, said before it starts. */
function FocusNote({ matched, kind, weeks, bonus }: { matched: boolean; kind: StaffProjectKind; weeks: number; bonus: string }) {
  const focus = DIRECTIVE_LABEL[PROJECT_FOCUS[kind]];
  const need = focusWeeksNeeded(weeks);
  return matched ? (
    <Callout tone="positive" icon="check-circled" title={`Matches the ${focus} focus`}>
      Keep the focus for {need} of the {weeks} weeks to earn {bonus}.
    </Callout>
  ) : (
    <Callout tone="neutral" title="No focus bonus yet">
      Set the focus to {focus} for {need} of the {weeks} weeks to earn {bonus}.
    </Callout>
  );
}
