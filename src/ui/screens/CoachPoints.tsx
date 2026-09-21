// CoachPoints.tsx
// What you got better at this year.
//
// Four skills on a board, each with the number set large and two keys under
// it. A point can be taken back until the step is left, by any route; unspent
// points carry over. What your assistant coaches add shows on the skill they
// add to, as the number the engine will actually use in games.
//
// The tiles do not explain what a point does. The place to read that is the
// coach profile; here the number, the room left on the bar and the staff line
// are the whole story.

import { useDynasty } from '../../state/store.js';
import { FirstVisit } from '../Tutorial.js';
import { SKILLS } from '../../engine/program.js';
import { staffBonus } from '../../engine/economy.js';
import type { CoachSkills } from '../../engine/program.js';
import { Marquee, SpendTile, TileGrid } from '../components/ui/index.js';
import { plural } from '../words.js';
import { ContinueBar, StepScreen } from './OffseasonStep.js';

const SKILL_NAME: Record<keyof CoachSkills, string> = {
  offense: 'Offense',
  defense: 'Defense',
  training: 'Training',
  recruiting: 'Recruiting',
};

/** Which assistant adds to which skill. */
const STAFF_SEAT: Partial<Record<keyof CoachSkills, string>> = {
  offense: 'Hitting',
  defense: 'Pitching',
  recruiting: 'Recruiting',
};

export function CoachPoints() {
  const coach = useDynasty((s) => s.coach);
  const economy = useDynasty((s) => s.economy);
  const spend = useDynasty((s) => s.spendSkill);
  const refund = useDynasty((s) => s.refundSkill);
  const spentThisStep = useDynasty((s) => s.spentThisStep);
  const version = useDynasty((s) => s.version);
  void version;

  const left = coach.skillPoints;
  const added = SKILLS.reduce((n, k) => n + (spentThisStep[k] ?? 0), 0);
  const bonus = staffBonus(economy.staff, coach.skills);

  return (
    <StepScreen
      bar={(
        <ContinueBar
          from="coach"
          note={added > 0
            ? 'Leaving this step, by any route, locks in the points you added.'
            : left > 0 ? `${plural(left, 'point')} unspent: they carry over to next year.` : undefined}
        />
      )}
    >
      <main className="pb-page">
        <FirstVisit id="coachpoints" />
        <Marquee
          eyebrow={`${coach.name} · Year ${coach.tenure}`}
          title="Coach points"
          numbers={[
            { label: 'To spend', value: left },
            {
              label: 'Added',
              value: added,
              note: added > 0 ? 'Undo until you continue' : 'Nothing locked yet',
            },
          ]}
        />
        <TileGrid label="Coaching skills">
          {SKILLS.map((k) => (
            <SpendTile
              key={k}
              name={SKILL_NAME[k]}
              value={coach.skills[k]}
              max={99}
              added={spentThisStep[k] ?? 0}
              bonus={bonus[k]}
              bonusLabel={STAFF_SEAT[k]}
              canAdd={left > 0}
              onAdd={() => spend(k)}
              onUndo={() => refund(k)}
            />
          ))}
        </TileGrid>
      </main>
    </StepScreen>
  );
}
