// StaffCandidateDialog.tsx
// A coach on the market, and what hiring them would change.
//
// A sheet over the coach's seat: who they are, what they cost and what is
// left after, what each half of their craft adds to your program — the same
// "What he adds" bars the coach's own sheet draws (UI clarity review,
// 2026-09-25) — and one button that says the price.

import {
  armCareFor, coordinatorFamiliarity, devBonus, dollars, nightCraft, SEAT_LABEL,
  shapeOf, winterCraft, withStaff, type Assistant,
} from '../engine/economy.js';
import type { CoachSkills } from '../engine/program.js';
import {
  Button, Callout, ConfirmButton, Monogram, Sheet, SkillBars, StatGroup,
} from './components/ui/index.js';
import { stateName } from './words.js';

/**
 * The two skills that make a coach's rating, in the order the card draws
 * them: the winter half (what he builds between seasons) and the game half.
 * For a coordinator the halves are his relationships and his recruiting.
 */
export function staffSkills(coach: Assistant): Array<{ label: string; value: number }> {
  const labels = coach.seat === 'recruiting' ? ['State relationships', 'Recruiting']
    : coach.seat === 'pitching' ? ['Pitcher development', 'Game-day pitching']
      : ['Hitter development', 'Game-day offense'];
  return [
    { label: labels[0]!, value: winterCraft(coach) },
    { label: labels[1]!, value: nightCraft(coach) },
  ];
}

/**
 * Each skill with what it does for YOUR program, in the engine's own numbers:
 * the winter half is offseason growth (`devBonus`; for a coordinator, the
 * head start he brings in his state), the game half is what he adds to your
 * own skill — less where you are already strong (`fitFactor`, via
 * `withStaff`). A pitching coach's whole rating also slows how fast arms
 * tire (`armCareFor`), so his game line carries that too.
 */
export function staffAdds(coach: Assistant, own: CoachSkills): Array<{ label: string; hint?: string; value: number }> {
  const staff = { [coach.seat]: coach };
  const [dev, game] = staffSkills(coach) as [{ label: string; value: number }, { label: string; value: number }];
  const combined = withStaff(own, staff);
  const growth = devBonus(staff);
  if (coach.seat === 'recruiting') {
    return [
      {
        ...dev,
        hint: coach.pipelineState
          ? `${coordinatorFamiliarity(coach)} strength in ${stateName(coach.pipelineState)}`
          : undefined,
      },
      { ...game, hint: `+${combined.recruiting - own.recruiting} to your recruiting` },
    ];
  }
  if (coach.seat === 'pitching') {
    return [
      { ...dev, hint: `+${growth.arm} offseason growth` },
      {
        ...game,
        hint: `+${combined.defense - own.defense} to your defense · arms tire ${Math.round((1 - armCareFor(staff)) * 100)}% slower`,
      },
    ];
  }
  return [
    { ...dev, hint: `+${growth.bat} offseason growth` },
    { ...game, hint: `+${combined.offense - own.offense} to your offense` },
  ];
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
  const split = staffSkills(candidate);

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
      footer={footer}
    >
      <StatGroup
        size="sm"
        items={[
          { label: 'Rating', value: candidate.rating, note: `${split[0]!.value} + ${split[1]!.value}` },
          { label: 'Wage', value: dollars(candidate.wage), unit: '/yr' },
          affordable
            ? { label: 'Left after', value: dollars(after), note: 'this season' }
            : { label: 'Over budget', value: dollars(-after), noteTone: 'negative', note: 'more than you have' },
        ]}
      />
      <SkillBars title="What he adds" rows={staffAdds(candidate, skills)} />
      <Callout tone="neutral" icon="info" title="Fit with your program">
        {fit}{candidate.seat === 'recruiting' ? ' Stronger relationships you already have come first.' : ''}
      </Callout>
      {incumbent && (
        <Callout tone="warning" title={`Replaces ${incumbent.name}`}>
          Frees a {dollars(incumbent.wage)} wage.{projectActive ? ' The season work ends.' : ''}
        </Callout>
      )}
    </Sheet>
  );
}
