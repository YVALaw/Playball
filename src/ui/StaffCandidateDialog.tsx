// StaffCandidateDialog.tsx
// A coach on the market, and what hiring them would change.
//
// A sheet over the coach's seat: who they are, what they cost and what is
// left after, their two skills as one split bar, what they add to your program
// in numbers, and one button that says the price.

import {
  armCareFor, coordinatorFamiliarity, devBonus, dollars, nightCraft, SEAT_LABEL,
  shapeOf, winterCraft, withStaff, type Assistant,
} from '../engine/economy.js';
import type { CoachSkills } from '../engine/program.js';
import {
  Button, Callout, ConfirmButton, Meter, Monogram, Sheet, StatGroup, type StatTileProps,
} from './components/ui/index.js';
import { stateName } from './words.js';

/** The two skills that make a coach's rating, in the order the card draws them. */
export function staffSkills(coach: Assistant): Array<{ label: string; value: number }> {
  const labels = coach.seat === 'recruiting' ? ['Relationships', 'Recruiting']
    : coach.seat === 'pitching' ? ['Development', 'Pitching support']
      : ['Development', 'Game offense'];
  return [
    { label: labels[0]!, value: winterCraft(coach) },
    { label: labels[1]!, value: nightCraft(coach) },
  ];
}

/** The rating as its two halves: "46 + 12 = 58". */
export function StaffSkillsMeter({ coach }: { coach: Assistant }) {
  const skills = staffSkills(coach);
  return (
    <Meter
      label="Skills"
      valueText={`${skills[0]!.value} + ${skills[1]!.value} = ${coach.rating}`}
      segments={skills.map((s, i) => ({ value: s.value, label: s.label, tone: i === 0 ? 'accent' : 'ink' }))}
      max={100}
    />
  );
}

/** What this coach adds to your program, in the numbers the engine uses. */
export function staffImpactItems(coach: Assistant, skills: CoachSkills): StatTileProps[] {
  const staff = { [coach.seat]: coach };
  const developed = devBonus(staff);
  const combined = withStaff(skills, staff);
  const bonus = coach.seat === 'hitting' ? combined.offense - skills.offense
    : coach.seat === 'pitching' ? combined.defense - skills.defense
      : combined.recruiting - skills.recruiting;
  const items: StatTileProps[] = [{
    label: coach.seat === 'hitting' ? 'Your offense' : coach.seat === 'pitching' ? 'Your defense' : 'Your recruiting',
    value: `+${bonus}`,
    note: 'Added to your skill',
  }];
  if (coach.seat !== 'recruiting') {
    items.push({
      label: 'Offseason growth',
      value: `+${coach.seat === 'hitting' ? developed.bat : developed.arm}`,
      note: coach.seat === 'hitting' ? 'For every hitter' : 'For every pitcher',
    });
  }
  if (coach.seat === 'pitching') {
    items.push({ label: 'Pitcher workload', value: `−${Math.round((1 - armCareFor(staff)) * 100)}%`, note: 'Arms tire slower' });
  }
  if (coach.seat === 'recruiting' && coach.pipelineState) {
    items.push({ label: stateName(coach.pipelineState), value: coordinatorFamiliarity(coach), unit: '/100', note: 'Knows this state' });
  }
  return items;
}

export function StaffCandidateDialog({
  candidate, incumbent, budgetLeft, skills, canManage, fit, projectActive, onClose, onHire,
}: {
  candidate: Assistant;
  incumbent?: Assistant;
  budgetLeft: number;
  skills: CoachSkills;
  canManage: boolean;
  fit: string;
  projectActive: boolean;
  onClose: () => void;
  onHire: () => void;
}) {
  const after = budgetLeft + (incumbent?.wage ?? 0) - candidate.wage;
  const affordable = after >= 0;
  const verb = incumbent ? 'Replace' : 'Hire';
  const skillsNow = staffSkills(candidate);

  let footer;
  if (!canManage) {
    footer = <Button variant="primary" block disabled>Your athletic director hires the staff</Button>;
  } else if (!affordable) {
    footer = <Button variant="primary" block disabled meta={`${dollars(candidate.wage)}/yr`}>Need {dollars(-after)} more</Button>;
  } else if (incumbent) {
    footer = (
      <ConfirmButton
        block
        idle={`Replace ${incumbent.name.split(' ')[0]}`}
        meta={`${dollars(candidate.wage)}/yr`}
        armed="Tap again to replace"
        armedMeta={`${dollars(after)} left after`}
        onConfirm={onHire}
      />
    );
  } else {
    footer = (
      <Button variant="primary" block meta={`${dollars(candidate.wage)}/yr`} onClick={onHire}>
        {verb} {candidate.name.split(' ')[0]}
      </Button>
    );
  }

  return (
    <Sheet
      eyebrow={SEAT_LABEL[candidate.seat]}
      title={candidate.name}
      subtitle={`${shapeOf(candidate)} · Age ${candidate.age}`}
      lead={<Monogram name={candidate.name} size={44} />}
      onClose={onClose}
      guide={candidate.seat === 'hitting' && !incumbent && canManage ? 'hire-detail' : undefined}
      footer={footer}
    >
      <StatGroup
        size="sm"
        items={[
          { label: 'Rating', value: candidate.rating, note: `${skillsNow[0]!.value} + ${skillsNow[1]!.value}` },
          { label: 'Wage', value: dollars(candidate.wage), unit: '/yr' },
          affordable
            ? { label: 'Left after', value: dollars(after), note: 'this season' }
            : { label: 'Over budget', value: dollars(-after), noteTone: 'negative', note: 'more than you have' },
        ]}
      />
      <StaffSkillsMeter coach={candidate} />
      <section className="pb-stack">
        <h3 className="pb-sheet__section">What this coach adds</h3>
        <StatGroup size="sm" items={staffImpactItems(candidate, skills)} />
      </section>
      <Callout tone="neutral" icon="info" title="Fit with your program">
        {fit}{candidate.seat === 'recruiting' ? ' Stronger relationships you already have come first.' : ''}
      </Callout>
      {incumbent && (
        <Callout tone="warning" title={`Replaces ${incumbent.name}`}>
          Frees a {dollars(incumbent.wage)} wage.{projectActive ? ' The current project ends.' : ''}
        </Callout>
      )}
    </Sheet>
  );
}
