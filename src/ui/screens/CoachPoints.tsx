// CoachPoints.tsx
// What you got better at this year.
//
// Called "Coach" and not "Your staff": there is no staff in this game, there is
// you, and naming a screen after people who do not exist is the sort of thing
// that makes a player go looking for them.
//
// Four attributes, and every one of them is wired to something the engine
// already does — a skill tree whose branches do not change the simulation is a
// menu, not a decision. The screen says what each point actually buys, in the
// same terms the rest of the game uses, so the choice can be made on evidence
// rather than on which word sounds strongest.

import { useDynasty } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import { ModuleIntro } from '../components/Kit.js';
import { FirstVisit } from '../Tutorial.js';
import { SKILLS, SKILL_LABEL, SKILL_BLURB } from '../../engine/program.js';

export function CoachPoints() {
  const coach = useDynasty((s) => s.coach);
  const spend = useDynasty((s) => s.spendSkill);
  const refund = useDynasty((s) => s.refundSkill);
  const spentThisStep = useDynasty((s) => s.spentThisStep);
  const next = useDynasty((s) => s.nextPhase);
  const version = useDynasty((s) => s.version);
  void version;

  const left = coach.skillPoints;
  const back = SKILLS.reduce((n, k) => n + (spentThisStep[k] ?? 0), 0);

  return (
    <FixedHeader
      header={<ModuleIntro kicker={`${coach.name} · YEAR ${coach.tenure}`} title="Coach development" />}
      action={<FloatingAction
        label={left > 0 ? `CONTINUE · ${left} UNSPENT` : 'TO THE DRAFT'}
        onClick={() => void next('coach')}
      />}
    >
      <FirstVisit id="coachpoints" />
      <main className="module-workspace coach-development-workspace offseason-coach">
        <section className={`coach-points-command${left > 0 ? ' has-points' : ''}`}>
          <div>
            <small>AVAILABLE</small>
            <strong>{left}</strong>
            <span>{left === 1 ? 'point' : 'points'}</span>
          </div>
          <p>{left > 0
            ? 'Invest in the part of coaching you want to become known for. Unspent points carry forward.'
            : 'This year’s growth is allocated. Review the shape of your coaching profile before moving on.'}</p>
          <div className="coach-points-session">
            <small>THIS SESSION</small>
            <strong>{back > 0 ? `+${back} allocated` : 'No changes yet'}</strong>
            <span>{back > 0 ? 'You can undo these until you continue.' : 'Nothing is locked until you move on.'}</span>
          </div>
        </section>

        <section className="coach-skill-grid" aria-label="Coach skills">
          {SKILLS.map((k) => {
            const value = coach.skills[k];
            const added = spentThisStep[k] ?? 0;
            const maxed = value >= 99;
            return (
              <article className={`coach-skill-card${added > 0 ? ' invested' : ''}${maxed ? ' maxed' : ''}`} key={k}>
                <header>
                  <span><small>{SKILL_LABEL[k]}</small><strong>{value}</strong></span>
                  <em>{maxed ? 'MAX' : added > 0 ? `+${added} THIS YEAR` : `NEXT ${Math.min(99, value + 1)}`}</em>
                </header>
                <div className="coach-skill-meter" aria-label={`${SKILL_LABEL[k]} ${value} of 99`}>
                  <i style={{ width: `${value}%` }} />
                </div>
                <p>{SKILL_BLURB[k]}</p>
                <footer>
                  <button
                    className="tap"
                    type="button"
                    disabled={added === 0}
                    onClick={() => refund(k)}
                  >Undo −1</button>
                  <button
                    className="tap primary"
                    type="button"
                    disabled={left <= 0 || maxed}
                    onClick={() => spend(k)}
                  >{maxed ? 'Maxed' : 'Invest +1'}</button>
                </footer>
              </article>
            );
          })}
        </section>
      </main>
    </FixedHeader>
  );
}
