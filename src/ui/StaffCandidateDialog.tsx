import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  armCareFor, coordinatorFamiliarity, devBonus, dollars, nightCraft, SEAT_LABEL,
  shapeOf, winterCraft, withStaff, type Assistant,
} from '../engine/economy.js';
import type { CoachSkills } from '../engine/program.js';
import { Confirmable } from './components/Kit.js';
import { useDialogFocus } from './dialogFocus.js';

/** The two skills used by each role, displayed on the same 0–100 scale. */
export function StaffRatings({ coach }: { coach: Assistant }) {
  const labels = coach.seat === 'recruiting' ? ['Relationships', 'Recruiting']
    : coach.seat === 'pitching' ? ['Pitcher development', 'Pitching support']
      : ['Batter development', 'Game offense'];
  return <span className="staff-ratings">
    {[winterCraft(coach), nightCraft(coach)].map((value, i) => <span key={labels[i]}>
      <span><small>{labels[i]}</small><b>{value}</b></span>
      <i aria-hidden="true"><em style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></i>
    </span>)}
  </span>;
}

export function StaffCandidateDialog({ candidate, incumbent, budgetLeft, skills, canManage, fit, projectActive, onClose, onHire }: {
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
  const card = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const frame = typeof document === 'undefined' ? null : document.querySelector('.app-frame');
  useDialogFocus(card, onClose, { initial: closeButton, active: !!frame });
  if (!frame) return null;
  const after = budgetLeft + (incumbent?.wage ?? 0) - candidate.wage;
  const affordable = after >= 0;
  const staff = { [candidate.seat]: candidate };
  const developed = devBonus(staff);
  const combined = withStaff(skills, staff);
  const bonus = candidate.seat === 'hitting' ? combined.offense - skills.offense
    : candidate.seat === 'pitching' ? combined.defense - skills.defense
      : combined.recruiting - skills.recruiting;
  const hireLabel = `${incumbent ? 'Replace' : 'Hire'} · ${dollars(candidate.wage)}/year`;

  return createPortal(<div className="modal-scrim staff-candidate-scrim fade-in" onClick={onClose}>
    <section className="staff-candidate-dialog rise-in" ref={card} role="dialog" aria-modal="true"
      aria-labelledby={titleId} data-guide={candidate.seat === 'hitting' && !incumbent && canManage ? 'hire-detail' : undefined}
      onClick={(event) => event.stopPropagation()}>
      <header>
        <small>{SEAT_LABEL[candidate.seat]}</small>
        <button type="button" className="tap" ref={closeButton} onClick={onClose}>Close</button>
      </header>
      <h2 id={titleId}>{candidate.name}</h2>
      <p className="staff-candidate-meta">{shapeOf(candidate)} · Age {candidate.age} · {candidate.rating} OVR</p>
      <StaffRatings coach={candidate} />
      <section className="staff-candidate-effects" aria-label="Effect on your program">
        <h3>What they add</h3>
        {candidate.seat !== 'recruiting' && <p><b>+{candidate.seat === 'hitting' ? developed.bat : developed.arm}</b> {candidate.seat === 'hitting' ? 'batter' : 'pitcher'} training in the offseason</p>}
        <p><b>+{bonus}</b> {candidate.seat === 'hitting' ? 'offense' : candidate.seat === 'pitching' ? 'defense' : 'recruiting'} coaching skill with your current abilities</p>
        {candidate.seat === 'pitching' && <p><b>{Math.round((1 - armCareFor(staff)) * 100)}% less</b> pitcher workload buildup</p>}
        {candidate.seat === 'recruiting' && candidate.pipelineState && <p><b>{candidate.pipelineState} · {coordinatorFamiliarity(candidate)}/100</b> state familiarity; stronger existing relationships take priority</p>}
        <p className="staff-candidate-fit">{fit}</p>
      </section>
      <div className="staff-candidate-budget">
        <span>Annual wage<strong>{dollars(candidate.wage)}</strong></span>
        <span>{affordable ? 'Left after hire' : 'Over budget'}<strong>{dollars(Math.abs(after))}</strong></span>
      </div>
      {incumbent && <p className="staff-replacement-note">Replaces {incumbent.name} and frees their {dollars(incumbent.wage)} wage.{projectActive ? ' Their active project will end.' : ''}</p>}
      <footer>
        {!canManage || !affordable ? <button className="primary-command" type="button" disabled>
          {!canManage ? 'Staff management delegated' : `Need ${dollars(-after)} more`}
        </button> : incumbent ? <Confirmable className="primary-command tap" idle={hireLabel}
          armed={`Confirm replacement · ${dollars(candidate.wage)}/year`} onConfirm={onHire} />
          : <button className="primary-command tap" type="button" onClick={onHire}>{hireLabel}</button>}
      </footer>
    </section>
  </div>, frame);
}
