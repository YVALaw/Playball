// SeasonPlan.tsx
// One sheet, once a season at each chair (2026-09-29): each assistant's
// season work, who runs recruiting, and the staff's recruit list.
//
// It opens right after the terms are signed, or on day one of a first season
// or a new job (neither has terms), because `seasonPlanShowing` follows from
// state. Everything on it takes effect when it is tapped. Closing it, by
// either button, the X, the scrim, a pull or the back gesture, is "Decide
// later": the staff's own picks start on every idle seat (`closeSeasonPlan`),
// and the sheet does not come back this season. The store never waits on it.
//
// The list is the board's own component (StaffList.tsx), eight slots always,
// so nothing moves when a man is starred, moved or let go.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  planPick, seasonPlanCovered, seasonPlanShowing, staffListOf, suggestedStaffList, useDynasty, useUserTeam,
} from '../../state/store.js';
import { handles } from '../../state/depth.js';
import {
  PROJECT_LABEL, SEAT_LABEL, SEATS, facilityLevel, pipelineStrength, projectFacility, staffPlan,
  type Economy, type StaffProject, type StaffProjectKind, type StaffSeat,
} from '../../engine/economy.js';
import { PROJECT_FOCUS, projectCandidates, seasonGainFull } from '../../engine/staffProjects.js';
import { RECRUITING_WEEKS, canPursue, type Prospect } from '../../engine/recruiting.js';
import { delegateEffort } from '../../engine/recruitingPlan.js';
import { prestigeStars } from '../../engine/program.js';
import type { SeasonState } from '../../engine/season.js';
import {
  Button, List, ListRow, Monogram, SegmentedControl, Sheet, SubHead, cx,
} from '../components/ui/index.js';
import { projectOutlook, recruitingWeeksLeft, useStaffWork } from '../StaffWorkPanel.js';
import { openFacilityRoom, openStaffDesk } from './ProgramRooms.js';
import { StaffList } from './StaffList.js';
import { StaffPicker } from './StaffPicker.js';
import { FACILITY_NAME, lastName, plural, stateName } from '../words.js';

type Owner = SeasonState['teams'][number];

/** The plan, while it is owed and nothing else owns the frame. */
export function SeasonPlan() {
  const showing = useDynasty(seasonPlanShowing);
  const covered = useDynasty(seasonPlanCovered);
  const year = useDynasty((s) => s.year);
  const userTeam = useDynasty((s) => s.userTeam);
  // Once up, it stays mounted under a room it opened (hidden, `covered`), so
  // its history entry is not spent while the room pushes its own.
  const [up, setUp] = useState(false);
  const mounted = showing || (up && covered);
  useEffect(() => { setUp(mounted); }, [mounted]);
  if (!mounted) return null;
  // Keyed on the season and the chair, so a new one opens fresh.
  return <PlanSheet key={`${year}:${userTeam}`} covered={!showing} />;
}

/**
 * One seat's lines on the plan: what the work is, then whom or where it is
 * for. Each is one short line that fits a 375 phone (the lines run under the
 * "+3 each", office.css), and every row keeps both, so the rows are one
 * height whatever they say.
 */
interface SeatLine {
  subtitle: string;
  /** The men by surname, the state, or the weeks left; '' when there is none. */
  who: string;
  /** Each man's points, for work on players; null otherwise. */
  each: number | null;
  /**
   * What a tap does: the season-work builder, the hiring desk for an empty
   * seat, the building a locked seat is waiting on, or (for a staff the AD
   * runs) the Staff room. Every row does something (2026-09-29: "it wont let
   * me click any of them to try and hire them").
   */
  tap: 'build' | 'hire' | 'facility' | 'desk';
}

/** The men a pick names, by surname, the way the Staff room prints them. */
function surnames(team: Owner, seat: StaffSeat, kind: StaffProjectKind, ids: readonly string[]): string {
  const pool = new Map(projectCandidates(team.team, seat, kind).map((p) => [String(p.id), p]));
  return ids.map((id) => {
    const p = pool.get(id);
    return p ? lastName(p.name) : 'Left';
  }).join(', ');
}

/**
 * What a seat is doing this season, in two short lines, and whether the coach
 * can change it here. Numbers are the Staff room's: `seasonEach` for work that
 * is running, the same season gain for the staff's pick.
 */
function seatLine(economy: Economy, team: Owner, seat: StaffSeat, week: number, runsStaff: boolean): SeatLine {
  // A staff the athletic director runs is read in the Staff room, whatever
  // the row says; a coach who runs his own hires, builds and assigns from here.
  const own = (tap: SeatLine['tap']): SeatLine['tap'] => (runsStaff ? tap : 'desk');
  if (!economy.staff[seat]) {
    return { subtitle: 'No one hired', who: runsStaff ? 'Hire one' : 'Your AD hires', each: null, tap: own('hire') };
  }
  const facility = projectFacility(seat);
  const level = facilityLevel(economy, facility);
  if (level < 1) {
    return { subtitle: `Needs the ${FACILITY_NAME[facility]}`, who: 'Build it', each: null, tap: 'facility' };
  }
  const project: StaffProject | undefined = staffPlan(economy, seat).project;
  if (project && !project.season) {
    // A legacy run finishes the old way; nothing is picked over it.
    return {
      subtitle: `Finishing ${PROJECT_LABEL[project.kind]}`,
      who: project.weeksLeft > 0 ? `${plural(project.weeksLeft, 'week')} left` : '',
      each: null,
      tap: 'desk',
    };
  }
  if (project) {
    const o = projectOutlook(economy, team, seat, recruitingWeeksLeft(week));
    return {
      subtitle: PROJECT_LABEL[project.kind],
      who: o?.subject ?? '',
      each: o?.type === 'group' ? o.each ?? 0 : null,
      tap: own('build'),
    };
  }
  const pick = planPick(economy, team, seat, week, { alignFocus: !runsStaff });
  if (!pick) return { subtitle: 'Not set', who: '', each: null, tap: own('build') };
  return {
    subtitle: `Staff’s pick: ${PROJECT_LABEL[pick.kind]}`,
    who: pick.state ? stateName(pick.state) : surnames(team, seat, pick.kind, pick.targetIds ?? []),
    each: seat === 'recruiting' ? null
      : seasonGainFull(level, PROJECT_FOCUS[pick.kind] === pick.directive, RECRUITING_WEEKS - week + 1),
    tap: own('build'),
  };
}

function PlanSheet({ covered }: { covered: boolean }) {
  const season = useDynasty((s) => s.season);
  const team = useUserTeam();
  const year = useDynasty((s) => s.year);
  const userTeam = useDynasty((s) => s.userTeam);
  const coach = useDynasty((s) => s.coach);
  const economy = useDynasty((s) => s.economy);
  const phase = useDynasty((s) => s.phase);
  // The season mutates in place; this is what moves when it does.
  const version = useDynasty((s) => s.version);
  const runsStaff = useDynasty((s) => handles(s.depth, 'assistants'));
  const worksBoard = useDynasty((s) => handles(s.depth, 'recruiting'));
  const staffList = useDynasty(staffListOf);
  const replaceLost = useDynasty((s) => s.replaceLostRecruits);
  const setReplaceLost = useDynasty((s) => s.setReplaceLostRecruits);
  const starRecruit = useDynasty((s) => s.starRecruit);
  const moveStaffRecruit = useDynasty((s) => s.moveStaffRecruit);
  const setStaffList = useDynasty((s) => s.setStaffList);
  const setDepthSystem = useDynasty((s) => s.setDepthSystem);
  const close = useDynasty((s) => s.closeSeasonPlan);
  const [seat, setSeat] = useState<StaffSeat | null>(null);
  const [picking, setPicking] = useState(false);
  // Whether the staff list has been on this sheet (see its render below).
  const [listSeen, setListSeen] = useState(!worksBoard);
  useEffect(() => { if (!worksBoard) setListSeen(true); }, [worksBoard]);

  // What the staff would star, for the list's "Use these".
  const suggestion = useMemo(
    () => suggestedStaffList(season, userTeam, coach, economy, phase),
    [season, userTeam, coach, economy, phase, version],
  );

  if (!season || !team) return null;
  const week = season.recruiting.week;
  const myStars = prestigeStars(team.prestige);
  const home = team.def.state;
  const byId = (id: string): Prospect | undefined => season.recruiting.prospects.find((p) => p.id === id);
  const schoolOf = (i: number): string => season.teams[i]?.def.school ?? 'another program';
  const live = week >= 1 && week <= RECRUITING_WEEKS;

  return (
    <>
      <Sheet
        eyebrow={String(year)}
        title="Season plan"
        tall
        className="pb-plan"
        covered={covered}
        onClose={close}
        closeLabel="Decide later"
        footer={(
          <div className="pb-buttons-2">
            <Button variant="secondary" block onClick={close}>Decide later</Button>
            <Button variant="primary" block onClick={close}>Done</Button>
          </div>
        )}
      >
        <section className="pb-plan__part">
          <SubHead title="Staff work" muted="all season" aside={`Week ${week} of ${RECRUITING_WEEKS}`} />
          <List label="Staff work">
            {SEATS.map((s) => {
              const man = economy.staff[s];
              const line = seatLine(economy, team, s, week, runsStaff);
              return (
                <ListRow
                  key={s}
                  className="pb-plan__seat"
                  lead={man ? <Monogram name={man.name} /> : <Monogram vacant />}
                  title={SEAT_LABEL[s]}
                  subtitle={line.subtitle}
                  status={line.who || ' '}
                  value={line.each !== null ? `+${line.each}` : undefined}
                  unit={line.each !== null ? ' each' : undefined}
                  // A room opens over the plan, which steps aside while it is
                  // up and comes back when it closes (`seasonPlanShowing`).
                  onClick={line.tap === 'build' ? () => setSeat(s)
                    : line.tap === 'facility' ? () => openFacilityRoom(projectFacility(s), { layer: true })
                      : () => openStaffDesk(s, { layer: true })}
                />
              );
            })}
          </List>
        </section>

        <section className="pb-plan__part">
          <SubHead title="Recruiting" />
          <SegmentedControl<'me' | 'staff'>
            kind="radio"
            label="Who runs recruiting"
            value={worksBoard ? 'me' : 'staff'}
            options={[{ value: 'me', label: 'I run it' }, { value: 'staff', label: 'Staff runs it' }]}
            onChange={(v) => { if ((v === 'me') !== worksBoard) setDepthSystem('recruiting', v === 'me'); }}
          />
          <p className="pb-plan__note">
            {worksBoard
              ? 'You work the board each week.'
              : `Staff works the list with ${Math.round(delegateEffort(economy) * 100)}% of your points.`}
          </p>
        </section>

        {/* Not for a coach who opened the plan working the board himself: he
            has no use for eight open slots. Once shown, it stays
            while the sheet is up, faded and out of reach under "I run it":
            taking 700px out of a scrolled sheet dropped the rule 350px under
            the thumb that tapped it (2026-09-29 review). */}
        {listSeen && <div className={cx('pb-plan__list', worksBoard && 'is-idle')} inert={worksBoard || undefined}><StaffList
          list={staffList.map(byId).filter((p): p is Prospect => !!p)}
          standIns={season.recruiting.staffStandIns ?? {}}
          byId={byId}
          userTeam={userTeam}
          programStars={myStars}
          week={week}
          reachable={(p) => canPursue(p, myStars, pipelineStrength(economy, p.state, home))}
          schoolOf={schoolOf}
          suggestion={suggestion}
          canSuggest={live}
          onUseSuggestion={() => setStaffList(suggestion)}
          onMove={moveStaffRecruit}
          onUnstar={(id) => { starRecruit(id); }}
          replaceLost={replaceLost}
          onReplaceLost={setReplaceLost}
          onPickSlot={live ? () => setPicking(true) : undefined}
        /></div>}
      </Sheet>
      {seat !== null && (
        <SeatWorkSheet key={seat} team={team} seat={seat} covered={covered} onClose={() => setSeat(null)} />
      )}
      {picking && (
        <StaffPicker
          prospects={season.recruiting.prospects}
          list={staffList}
          userTeam={userTeam}
          reachable={(p) => canPursue(p, myStars, pipelineStrength(economy, p.state, home))}
          schoolOf={schoolOf}
          onToggle={(id) => { starRecruit(id); }}
          covered={covered}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

/** A seat's season work, as a string: what the builder watches to know it has committed. */
function workSignature(project: StaffProject | undefined): string {
  if (!project?.season) return '';
  return `${project.kind}|${(project.targetIds ?? []).join(',')}|${project.state ?? ''}|${project.startedWeek}`;
}

/**
 * The Staff room's builder, over the plan. It closes itself once season work
 * commits: a new, non-empty signature. "Change assignment" cancels first, and
 * the empty signature in between must not close it (C4).
 */
function SeatWorkSheet({ team, seat, covered, onClose }: { team: Owner; seat: StaffSeat; covered: boolean; onClose: () => void }) {
  const closePlan = useDynasty((s) => s.closeSeasonPlan);
  const name = useDynasty((s) => s.economy.staff[seat]?.name ?? '');
  const work = useStaffWork({
    team,
    seat,
    onFacility: (b) => { closePlan(); openFacilityRoom(b); },
  });
  const sig = useDynasty((s) => workSignature(staffPlan(s.economy, seat).project));
  const atMount = useRef(sig);
  const cleared = useRef(false);
  useEffect(() => {
    if (sig === '') { if (atMount.current !== '') cleared.current = true; return; }
    // The same work started again after a change is still a commit.
    if (sig !== atMount.current || cleared.current) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return (
    <Sheet
      eyebrow="Season plan"
      title={SEAT_LABEL[seat]}
      subtitle={name || undefined}
      tall
      className="pb-coachsheet"
      covered={covered}
      footer={work.footer}
      onClose={onClose}
    >
      {work.body}
    </Sheet>
  );
}
