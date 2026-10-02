// StaffWorkPanel.tsx
// What an assistant coach is working on, and how to give him the next thing.
//
// Two layers, as the coach sheet draws them: the focus, which is always on,
// and one assignment a season (2026-09-28). A coach's assignment is built in
// two numbered steps — what to work on, then who, up to three men with what
// each stands to gain — and the start button is pinned in the sheet's footer
// under a line that says what is about to start and whether it matches the
// focus. So the panel returns its body and its footer separately for the
// sheet to place (the Season plan sheet places them too).
//
// Everything that appears as the coach chooses lives in space kept for it —
// the "Matches focus" badge on every tile, the footer's summary line, a row
// greyed rather than removed at three picked — so a tap never moves the list
// under the thumb.

import { useState, type ReactNode } from 'react';
import { ALL_STATES } from '../data/schools.js';
import {
  BUILDINGS, DIRECTIVE_LABEL, PROJECT_LABEL, PIPELINE_MIN, dollars, facilityLevel,
  facilityUpgradeCost, pipelineStrength, projectFacility, staffPlan,
  type Economy, type StaffDirective, type StaffProjectKind, type StaffSeat, type Building,
} from '../engine/economy.js';
import { RECRUITING_WEEKS } from '../engine/recruiting.js';
import type { SeasonState } from '../engine/season.js';
import { isTwoWay, type Player } from '../engine/types.js';
import {
  FOCUS_SHARE, pipelineProjectGain, pipelineSeasonPreview, projectCandidates, projectOdds, PROJECT_ATTRIBUTE,
  PROJECT_FOCUS, PROJECT_FOCUS_GAIN, PROJECT_GAIN, SEASON_GROUP_MAX, SEAT_KINDS, seasonEach, seasonFocus,
  seasonGainFull, seasonGainOn, suggestedTargets,
} from '../engine/staffProjects.js';
import { handles } from '../state/depth.js';
import { useDynasty } from '../state/store.js';
import {
  Button, Callout, ConfirmButton, Face, FocusChips, KindTiles, List, Meter, Monogram, PickList, PlayerRow,
  ProjectProgress, SubHead, cx, type ProjectFact,
} from './components/ui/index.js';
import { CLASS_NAME, FACILITY_NAME, POSITION_NAME, firstName, lastName, plural, stateName } from './words.js';

type Owner = SeasonState['teams'][number];

const FOCUSES: Record<StaffSeat, StaffDirective[]> = {
  hitting: ['balanced', 'contact', 'power', 'discipline'],
  pitching: ['balanced', 'command', 'velocity', 'armCare'],
  recruiting: ['balanced', 'pipeline', 'stars', 'sleepers', 'needs'],
};

/**
 * What each focus does, in one line under the chips.
 *
 * Only what the engine does. A hitting or pitching focus does exactly one
 * thing: the matching season work earns +1 a man (`projectAligned`). The
 * recruiting focuses are real multipliers on recruiting points
 * (`recruitingDirectiveMultiplier`).
 */
const FOCUS_HINT: Record<StaffDirective, string> = {
  balanced: 'No focus bonus.',
  contact: 'Contact work gains +1.',
  power: 'Power work gains +1.',
  discipline: 'Approach work gains +1.',
  command: 'Command work gains +1.',
  velocity: 'Velocity work gains +1.',
  armCare: 'Arm-care work gains +1.',
  pipeline: 'Pipeline work gains more. Points go 4% further.',
  stars: 'Points go 10% further with 4 and 5 star recruits.',
  sleepers: 'Points go 10% further with 1 to 3 star recruits.',
  needs: 'Points go 10% further at positions you need.',
};

/** A coach's kinds of work, in tile order. */
const TRAINING: Record<'hitting' | 'pitching', readonly StaffProjectKind[]> = {
  hitting: SEAT_KINDS.hitting,
  pitching: SEAT_KINDS.pitching,
};

/** How many of a legacy project's weeks have to be on the matching focus. */
export const focusWeeksNeeded = (weeks: number): number => Math.ceil(weeks * FOCUS_SHARE);

/** The recruiting weeks still to come this season: the clock all season work runs on. */
export const recruitingWeeksLeft = (week: number): number =>
  (week >= 1 ? Math.max(0, RECRUITING_WEEKS - week + 1) : 0);

/** A man's place in a work line: a pitcher by his role, anybody else by his position. */
function placeOf(p: Player, seat: StaffSeat): string {
  if (p.type === 'pitcher') return POSITION_NAME[p.role];
  if (seat === 'pitching' && isTwoWay(p)) return POSITION_NAME[p.role];
  return POSITION_NAME[p.pos];
}

export type WorkState = 'locked' | 'ready' | 'active' | 'paused' | 'waiting';

/**
 * Whether the calendar still lets this seat start season work: the store's
 * own gate. A coach needs a point's worth of weeks, so never the last one.
 */
export function seasonWorkOpens(seat: StaffSeat, level: number, weeksAvailable: number): boolean {
  return weeksAvailable > 0 && (seat === 'recruiting' || seasonGainFull(Math.max(1, level), true, weeksAvailable) >= 1);
}

/**
 * The same status on the staff card and in the coach's sheet.
 *
 * `label` and `detail` are the legacy words, still read by the needs list and
 * the tour; `state` is the design system's. A coach's season work opens only
 * while enough of the season is left to be worth a point.
 */
export function staffWorkStatus(economy: Economy, seat: StaffSeat, weeksAvailable: number) {
  const project = staffPlan(economy, seat).project;
  const facility = BUILDINGS.find((b) => b.key === projectFacility(seat))!;
  const level = facilityLevel(economy, facility.key);
  if (!project) {
    const open = seasonWorkOpens(seat, level, weeksAvailable);
    const state: WorkState = level < 1 ? 'locked' : !open ? 'waiting' : 'ready';
    return {
      state,
      label: level < 1 ? 'Season work locked' : !open ? 'Opens next season' : 'No season work',
      detail: level < 1 ? FACILITY_NAME[facility.key] : !open ? 'Calendar closed' : 'Ready to assign',
      progress: 0,
      facility: facility.key,
      level,
    };
  }
  const paused = level < 1 || (!project.season && weeksAvailable === 0);
  return {
    state: (paused ? 'paused' : 'active') as WorkState,
    label: paused ? 'Paused' : 'In progress',
    detail: project.season
      ? `${PROJECT_LABEL[project.kind]} · lands at season's end`
      : `${PROJECT_LABEL[project.kind]} · ${plural(project.weeksLeft, 'week')} left`,
    progress: Math.max(0, Math.min(100, Math.round((1 - project.weeksLeft / Math.max(1, project.weeksTotal)) * 100))),
    facility: facility.key,
    level,
  };
}

/**
 * Whether this coach could start season work right now: a man, a building,
 * a free hand and enough of the season left. The staff room's "has no season
 * work" line reads this, so it never asks for the impossible.
 */
export function canAssignProject(economy: Economy, seat: StaffSeat, weeksAvailable: number): boolean {
  return !!economy.staff[seat] && staffWorkStatus(economy, seat, weeksAvailable).state === 'ready';
}

/** A running assignment, read the way both the seat card and the sheet print it. */
export interface ProjectOutlook {
  kind: StaffProjectKind;
  /** Season work (2026-09-28); false for a legacy project from an older save. */
  season: boolean;
  /** What the work is about: a man (legacy), a state, a group of players, or nothing. */
  type: 'player' | 'state' | 'group' | 'none';
  subject: string;
  player?: Player;
  /** Pipeline work: the state's strength now. */
  strength?: number;
  /** Season pipeline work: the strength it has added so far. */
  added?: number;
  /** Season coach work: each man's points if it runs to week 12 with the focus as it stands. */
  each?: number;
  /** Season coach work: the men it names, each with what he can still take. */
  men?: Array<{ id: string; player?: Player; gain: number }>;
  done: number;
  total: number;
  /** "+3", or a legacy "+2 to +3". */
  gain: string | null;
  attribute: string;
  /** Legacy: percent, fixed when the work started. */
  odds: number | null;
  focus: { text: string; tone: 'positive' | 'warning' };
  /** Why the weeks are not moving, when they are not. */
  paused: 'facility' | 'calendar' | null;
}

/**
 * The seat's running work, or null.
 *
 * Season work reads the engine's own focus rule (`seasonFocus`): the bonus is
 * earned once enough of the weeks run are on the matching focus, lost once
 * the weeks left cannot reach it, and on track in between only while the
 * focus matches. A legacy project keeps its old reading.
 */
export function projectOutlook(economy: Economy, team: Owner, seat: StaffSeat, weeksAvailable: number): ProjectOutlook | null {
  const plan = staffPlan(economy, seat);
  const project = plan.project;
  if (!project) return null;
  const want = PROJECT_FOCUS[project.kind];
  const level = facilityLevel(economy, projectFacility(seat));

  if (project.season) {
    const f = seasonFocus(project, plan.directive).state;
    const focus = f === 'earned' ? { text: 'Focus bonus earned', tone: 'positive' as const }
      : f === 'on-track' ? { text: 'Focus bonus on track', tone: 'positive' as const }
        : f === 'needs' ? { text: `Needs ${DIRECTIVE_LABEL[want]} focus`, tone: 'warning' as const }
          : { text: 'Focus bonus lost', tone: 'warning' as const };
    const base = {
      kind: project.kind, season: true, done: project.weeksTotal - project.weeksLeft, total: project.weeksTotal,
      focus, paused: level < 1 ? 'facility' as const : null,
    };
    if (seat === 'recruiting') {
      if (!project.state) {
        return { ...base, type: 'none', subject: 'No state chosen', gain: null, attribute: PROJECT_ATTRIBUTE[project.kind], odds: null };
      }
      const strength = pipelineStrength(economy, project.state, team.def.state);
      const added = Math.max(0, strength - (project.from ?? strength));
      return {
        ...base, type: 'state', subject: stateName(project.state), strength, added,
        gain: `+${added}`, attribute: 'Strength', odds: null,
      };
    }
    const each = seasonEach(economy, seat, project, plan.directive);
    const pool = new Map(projectCandidates(team.team, seat, project.kind).map((p) => [String(p.id), p]));
    const men = (project.targetIds ?? []).map((id) => {
      const player = pool.get(id);
      return { id, player, gain: player ? seasonGainOn(player, project.kind, each) : 0 };
    });
    return {
      ...base, type: 'group',
      subject: men.map((m) => (m.player ? lastName(m.player.name) : 'Left')).join(', '),
      men, each, gain: `+${each}`, attribute: PROJECT_ATTRIBUTE[project.kind], odds: null,
    };
  }

  // A legacy project from a save before 2026-09-28, read the old way.
  const done = project.weeksTotal - project.weeksLeft;
  const needed = focusWeeksNeeded(project.weeksTotal);
  const aligned = project.alignedWeeks ?? (want === plan.directive ? done : 0);
  const earned = aligned >= needed;
  const reachable = aligned + project.weeksLeft >= needed;
  const focus = earned ? { text: 'Focus bonus earned', tone: 'positive' as const }
    : !reachable ? { text: 'Focus bonus lost', tone: 'warning' as const }
      : plan.directive === want ? { text: 'Focus bonus on track', tone: 'positive' as const }
        : { text: `Needs ${DIRECTIVE_LABEL[want]} focus`, tone: 'warning' as const };
  const range = (lo: number, hi: number): string => {
    if (earned) return `+${hi}`;
    if (!reachable || lo === hi) return `+${lo}`;
    return `+${lo} to +${hi}`;
  };
  const paused = level < 1 ? 'facility' as const : weeksAvailable === 0 ? 'calendar' as const : null;
  const base = { kind: project.kind, season: false, done, total: project.weeksTotal, focus, paused };

  if (project.state) {
    const strength = pipelineStrength(economy, project.state, team.def.state);
    return {
      ...base,
      type: 'state',
      subject: stateName(project.state),
      strength,
      gain: range(
        pipelineProjectGain(economy, project.kind, strength, false),
        pipelineProjectGain(economy, project.kind, strength, true),
      ),
      attribute: 'Strength',
      odds: null,
    };
  }
  // A stateless recruiting project from an old save earns nothing, so it promises nothing.
  if (seat === 'recruiting') {
    return { ...base, type: 'none', subject: 'No state chosen', gain: null, attribute: PROJECT_ATTRIBUTE[project.kind], odds: null };
  }
  if (project.playerId) {
    const player = projectCandidates(team.team, seat, project.kind).find((p) => String(p.id) === project.playerId);
    const odds = player ? project.odds ?? projectOdds(economy, seat, player, project.kind) : null;
    return {
      ...base,
      type: 'player',
      subject: player?.name ?? 'Player left the roster',
      player,
      gain: player ? range(PROJECT_GAIN, PROJECT_FOCUS_GAIN) : null,
      attribute: PROJECT_ATTRIBUTE[project.kind],
      odds: odds === null ? null : Math.round(odds * 100),
    };
  }
  // A group project from a save before 2026-09-10: a point a man, two with the focus.
  const count = project.targetIds?.length ?? project.targetCount ?? 0;
  return {
    ...base,
    type: 'group',
    subject: plural(count, 'player'),
    gain: range(1, 2),
    attribute: PROJECT_ATTRIBUTE[project.kind],
    odds: null,
  };
}

export interface StaffWork { body: ReactNode; footer: ReactNode }

/**
 * The coach's work, as a body and a footer for the sheet that holds it.
 * A hook rather than a component so the sheet can pin the footer.
 */
export function useStaffWork({ team, seat, initialState, onFacility }: {
  team: Owner;
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
  const home = team.def.state;
  const plan = staffPlan(economy, seat);
  const [state, setState] = useState(initialState ?? home);
  // The first tile is the one the focus already favours, so the default earns the bonus.
  const [selectedKind, setSelectedKind] = useState<StaffProjectKind | null>(() => (
    seat === 'recruiting' ? null : TRAINING[seat].find((k) => PROJECT_FOCUS[k] === plan.directive) ?? null
  ));
  // The coach's own picks; null is the staff's suggestion, which follows the kind.
  const [picked, setPicked] = useState<string[] | null>(null);
  const [error, setError] = useState('');

  const man = economy.staff[seat];
  const facility = projectFacility(seat);
  const facilityName = FACILITY_NAME[facility];
  const level = facilityLevel(economy, facility);
  const weeksAvailable = recruitingWeeksLeft(week);
  const status = staffWorkStatus(economy, seat, weeksAvailable);
  const strength = pipelineStrength(economy, state, home);
  const kinds: readonly StaffProjectKind[] = seat === 'recruiting'
    ? strength >= PIPELINE_MIN ? ['pipeline-deepen', 'pipeline-maintain'] : ['pipeline-build']
    : TRAINING[seat];
  const kind = selectedKind && kinds.includes(selectedKind) ? selectedKind : kinds[0]!;
  const matched = plan.directive === PROJECT_FOCUS[kind];
  const project = plan.project;
  const who = man ? firstName(man.name) : 'your coach';
  const calendarWeek = Math.max(1, Math.min(RECRUITING_WEEKS, week));

  /* ------------------------------------------------------------- focus */
  const focusSection = (
    <section className="pb-work">
      <SubHead title="Focus" muted="always on" aside={canManage ? 'Change any time' : undefined} />
      <FocusChips
        label="Coaching focus"
        value={plan.directive}
        options={FOCUSES[seat].map((f) => ({ value: f, label: DIRECTIVE_LABEL[f] }))}
        disabled={!canManage}
        guide={seat === 'hitting' && canManage ? 'directive' : undefined}
        onChange={(f) => setFocus(seat, f)}
      />
      <p className={cx('pb-work__hint', seat === 'recruiting' && 'is-two')}>{FOCUS_HINT[plan.directive]}</p>
    </section>
  );

  /* -------------------------------------------------------- season work */
  let workBody: ReactNode;
  let footer: ReactNode = null;

  if (project?.season) {
    const o = projectOutlook(economy, team, seat, weeksAvailable)!;
    const weekFact: ProjectFact = {
      label: 'Week', value: `${calendarWeek} of ${RECRUITING_WEEKS}`, note: o.focus.text, noteTone: o.focus.tone,
    };
    const paused = o.paused === 'facility' ? `Paused · needs the ${facilityName}` : undefined;
    const build = level < 1 && (
      <Button variant="tonal" block onClick={() => onFacility(facility)} iconAfter="chevron-right">
        Build the {facilityName}
      </Button>
    );
    if (o.type === 'group') {
      const men = o.men ?? [];
      workBody = (
        <>
          <ProjectProgress
            lead={<Monogram icon="person" tone="info" size={44} />}
            name={PROJECT_LABEL[o.kind]}
            sub={`${plural(men.length, 'player')} · Lands at season's end`}
            done={o.done}
            total={o.total}
            facts={[{ label: 'Each gains', value: `+${o.each ?? 0}`, note: o.attribute }, weekFact]}
            paused={paused}
          >
            {build}
          </ProjectProgress>
          <List label="Players">
            {men.map((m) => (m.player ? (
              <PlayerRow
                key={m.id}
                name={m.player.name}
                avatar={<Face id={m.id} team={team.def.abbr} size={36} />}
                meta={`${placeOf(m.player, seat)} · ${CLASS_NAME[m.player.classYear]}`}
                value={`+${m.gain}`}
              />
            ) : (
              <PlayerRow key={m.id} name="Left the roster" avatar={<Monogram vacant size={36} />} value="—" />
            )))}
          </List>
        </>
      );
    } else {
      workBody = (
        <ProjectProgress
          lead={<Monogram icon="globe" tone="info" size={44} />}
          name={o.subject}
          sub={`${PROJECT_LABEL[o.kind]} · Adds every week`}
          done={o.done}
          total={o.total}
          facts={o.type === 'state' ? [
            { label: 'Added', value: `+${o.added ?? 0}`, note: 'So far' },
            { label: 'Strength', value: o.strength ?? 0, note: 'Now' },
            weekFact,
          ] : [weekFact]}
          paused={paused}
        >
          {build}
        </ProjectProgress>
      );
    }
    if (canManage) {
      // In a coach's last week nothing new can start, so the button says stop, not change.
      const change = seasonWorkOpens(seat, level, weeksAvailable);
      footer = (
        <ConfirmButton
          variant="secondary"
          block
          idle={change ? 'Change assignment' : 'Stop season work'}
          armed={change ? 'Tap again to change' : 'Tap again to stop'}
          armedMeta={!change ? 'Nothing new can start this season'
            : seat === 'recruiting' ? 'Strength added stays' : 'The work so far is lost'}
          onConfirm={() => { setPicked(null); setError(''); cancel(seat); }}
        />
      );
    }
  } else if (project) {
    // A legacy project from an older save, shown and cancelled the old way.
    const o = projectOutlook(economy, team, seat, weeksAvailable)!;
    const weekFact: ProjectFact = {
      label: 'Week',
      value: `${Math.min(o.total, o.done + 1)} of ${o.total}`,
      note: o.focus.text,
      noteTone: o.focus.tone,
    };
    const facts: ProjectFact[] = o.type === 'state'
      ? [
        { label: 'Adds', value: o.gain ?? '—', note: 'Strength' },
        { label: 'Strength', value: o.strength ?? 0, note: 'Now' },
        weekFact,
      ]
      : o.type === 'player'
        ? [
          { label: 'If it works', value: o.gain ?? '—', note: o.attribute },
          { label: 'Chance', value: o.odds === null ? '—' : `${o.odds}%`, note: 'Set at the start' },
          weekFact,
        ]
        : o.type === 'group'
          ? [{ label: 'Adds', value: o.gain ?? '—', note: `${o.attribute} each` }, weekFact]
          : [weekFact];
    const sub = o.player
      ? `${PROJECT_LABEL[o.kind]} · ${placeOf(o.player, seat)} · ${CLASS_NAME[o.player.classYear]}`
      : o.type === 'state' ? `${PROJECT_LABEL[o.kind]} · Recruiting territory`
        : o.type === 'group' ? `${PROJECT_LABEL[o.kind]} · Group project`
          : PROJECT_LABEL[o.kind];
    workBody = (
      <ProjectProgress
        lead={o.player && project.playerId
          ? <Face id={project.playerId} team={team.def.abbr} size={44} />
          : <Monogram icon={o.type === 'group' ? 'person' : 'globe'} tone="info" size={44} />}
        name={o.subject}
        sub={sub}
        done={o.done}
        total={o.total}
        facts={facts}
        paused={o.paused === 'facility' ? `Paused · needs the ${facilityName}`
          : o.paused === 'calendar' ? 'Paused · resumes next season' : undefined}
      >
        {level < 1 && (
          <Button variant="tonal" block onClick={() => onFacility(facility)} iconAfter="chevron-right">
            Build the {facilityName}
          </Button>
        )}
      </ProjectProgress>
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
    workBody = (
      <Callout
        tone="neutral"
        icon="lock"
        title="Season work locked"
        action={{
          label: `See the ${facilityName}`,
          meta: dollars(facilityUpgradeCost(facility, 1)),
          variant: 'tonal',
          onClick: () => onFacility(facility),
        }}
      >
        Build the {facilityName} to give {who} season work.
      </Callout>
    );
  } else if (status.state === 'waiting') {
    workBody = <Callout tone="neutral" icon="clock" title="Opens next season" />;
  } else if (!canManage) {
    // The athletic director's staff picks its own at the next week's close.
    workBody = <Callout tone="neutral" icon="clock" title="Picks its own work next week" />;
  } else if (seat === 'recruiting') {
    const total = pipelineSeasonPreview(economy, kind, strength, weeksAvailable, matched);
    workBody = (
      <>
        <span className="pb-work__step">1 · Which state</span>
        <label className="pb-field">
          <span className="pb-sr">State</span>
          <select
            className="pb-field__input pb-select"
            value={state}
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
        <span className="pb-work__step">2 · What to work on</span>
        <KindTiles
          label="What to work on"
          value={kind}
          options={kinds.map((k) => ({
            value: k,
            label: PROJECT_LABEL[k],
            meta: `+${pipelineSeasonPreview(economy, k, strength, weeksAvailable, PROJECT_FOCUS[k] === plan.directive)} strength`,
            match: PROJECT_FOCUS[k] === plan.directive,
          }))}
          onChange={(k) => { setSelectedKind(k); setError(''); }}
        />
      </>
    );
    const summary = error ? { text: error, tone: 'negative' as const } : { text: `${PROJECT_LABEL[kind]} · ${stateName(state)}` };
    const match = error ? null
      : matched ? { text: `Matches focus: +${total}`, tone: 'positive' } : { text: `No focus bonus: +${total}`, tone: 'warning' };
    footer = (
      <>
        <div className="pb-work__sum">
          <span className={summary.tone ? `is-${summary.tone}` : undefined}>{summary.text}</span>
          {match && <span className={`is-${match.tone}`}>{match.text}</span>}
        </div>
        <Button
          variant="primary"
          block
          onClick={() => {
            if (!start(seat, kind, state, undefined)) setError('Could not start. Check the players and the week.');
            else setError('');
          }}
        >Start season work</Button>
      </>
    );
  } else {
    // A coach: what to work on, then up to three of his men.
    const each = seasonGainFull(level, matched, weeksAvailable);
    const focusedFull = seasonGainFull(level, true, weeksAvailable);
    const pool = projectCandidates(team.team, seat, kind);
    const suggestion = suggestedTargets(economy, team.team, seat, kind, weeksAvailable);
    const inPool = new Set(pool.map((p) => String(p.id)));
    const ids = (picked ?? suggestion).filter((id) => inPool.has(id));
    // The suggestion first, in its order, then the rest weakest first: it
    // depends on the kind only, so a focus tap never reorders the list.
    const rows = [
      ...suggestion.map((id) => pool.find((p) => String(p.id) === id)!).filter(Boolean),
      ...pool.filter((p) => !suggestion.includes(String(p.id))),
    ];
    workBody = (
      <>
        <span className="pb-work__step">1 · What to work on</span>
        <KindTiles
          label="What to work on"
          value={kind}
          options={kinds.map((k) => ({
            value: k,
            // Named for the focus they match, so the match reads straight across from the chips.
            label: DIRECTIVE_LABEL[PROJECT_FOCUS[k]],
            meta: `+${seasonGainFull(level, PROJECT_FOCUS[k] === plan.directive, weeksAvailable)} each`,
            match: PROJECT_FOCUS[k] === plan.directive,
          }))}
          onChange={(k) => { setSelectedKind(k); setPicked(null); setError(''); }}
        />
        <span className="pb-work__step">2 · Who · {ids.length} of {SEASON_GROUP_MAX}</span>
        {pool.length === 0 ? (
          <Callout tone="neutral">No eligible players on the roster.</Callout>
        ) : (
          <PickList
            label="Who"
            head={['Player', 'Gain']}
            max={SEASON_GROUP_MAX}
            values={ids}
            items={rows.map((p) => {
              const room = seasonGainOn(p, kind, focusedFull) > 0;
              return {
                id: String(p.id),
                name: p.name,
                sub: `${placeOf(p, seat)} · ${CLASS_NAME[p.classYear]}`,
                value: room ? `+${seasonGainOn(p, kind, each)}` : <small>At ceiling</small>,
                disabled: !room,
              };
            })}
            onToggle={(id) => {
              setPicked(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(0, SEASON_GROUP_MAX));
              setError('');
            }}
          />
        )}
      </>
    );
    const summary = error ? { text: error, tone: 'negative' as const }
      : ids.length === 0 ? { text: 'Pick up to 3 players' }
        : { text: `${PROJECT_LABEL[kind]} · ${plural(ids.length, 'player')}` };
    const match = error || ids.length === 0 ? null
      : matched ? { text: `Matches focus: +${each} each`, tone: 'positive' } : { text: `No focus bonus: +${each} each`, tone: 'warning' };
    footer = (
      <>
        <div className="pb-work__sum">
          <span className={summary.tone ? `is-${summary.tone}` : undefined}>{summary.text}</span>
          {match && <span className={`is-${match.tone}`}>{match.text}</span>}
        </div>
        <Button
          variant="primary"
          block
          disabled={ids.length === 0}
          onClick={() => {
            if (!start(seat, kind, undefined, ids)) setError('Could not start. Check the players and the week.');
            else { setError(''); setPicked(null); }
          }}
        >{ids.length === 0 ? 'Choose players' : 'Start season work'}</Button>
      </>
    );
  }

  const body = (
    <>
      {!canManage && <Callout tone="info" title="Managed by your athletic director" />}
      {focusSection}
      <section className="pb-work">
        <SubHead
          title="Season assignment"
          // Once, not twice: the waiting callout below already says it.
          aside={weeksAvailable > 0 ? `Week ${calendarWeek} of ${RECRUITING_WEEKS}`
            : status.state === 'waiting' ? undefined : 'Opens next season'}
        />
        {workBody}
      </section>
    </>
  );
  return { body, footer };
}
