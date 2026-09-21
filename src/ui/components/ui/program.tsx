// program.tsx
// The Program tab's own parts: the staff card, a project's progress, the
// facility card and the budget summary. Each answers the four questions every
// card in the Program tab answers: what is it, what state is it in, what would
// change, and what do I do and what does it cost.

import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon.js';
import {
  Button, ConfirmButton, LevelPips, Meter, Monogram, StatusBadge, cx,
  type ButtonProps, type FillTone, type Tone,
} from './core.js';
import { Callout } from './layout.js';
import { CompareTable, showValue, type CompareRow } from './data.js';
import { FacilityArt } from '../../ProgramBits.js';
import { dollars, type Building } from '../../../engine/economy.js';

/* --------------------------------------------------------------- StaffCard */

export type WorkState = 'locked' | 'ready' | 'active' | 'paused' | 'waiting';

const WORK: Record<WorkState, { tone: Tone; icon: IconName; label: string }> = {
  locked: { tone: 'neutral', icon: 'lock', label: 'Projects locked' },
  ready: { tone: 'neutral', icon: 'dot', label: 'No project' },
  active: { tone: 'info', icon: 'timer', label: 'In progress' },
  paused: { tone: 'warning', icon: 'pause', label: 'Paused' },
  waiting: { tone: 'neutral', icon: 'clock', label: 'Opens next season' },
};

export interface StaffCardProps {
  roleLabel: string;
  name?: string;
  specialty?: string;
  rating?: number;
  /** The two skills that add up to the rating: development, then game support. */
  skills?: Array<{ label: string; value: number }>;
  focus?: string;
  work?: {
    state: WorkState;
    badge?: string;
    /** Right of the badge: "Week 3 of 5". */
    when?: string;
    title?: ReactNode;
    text?: ReactNode;
    done?: number;
    total?: number;
    action?: { label: string; meta?: ReactNode; variant?: ButtonProps['variant']; disabled?: boolean; onClick?: () => void };
  };
  contract?: { wage?: string; through?: number | string; ending?: boolean; endingText?: string };
  vacant?: boolean;
  /** For an open seat: what the role does for you, in one sentence. */
  pitch?: string;
  hireLabel?: string;
  onHire?: () => void;
  onOpen?: () => void;
  className?: string;
  guide?: string;
}

export function StaffCard({
  roleLabel, name, specialty, rating, skills = [], focus, work, contract = {}, vacant, pitch, hireLabel,
  onHire, onOpen, className, guide,
}: StaffCardProps) {
  if (vacant) {
    return (
      <article className={cx('pb-staff', 'is-vacant', className)} aria-label={`${roleLabel}, open seat`}>
        <div className="pb-staff__head">
          <Monogram vacant size={44} />
          <span className="pb-staff__who">
            <span className="pb-staff__name">Open seat</span>
            <span className="pb-staff__role">{roleLabel}</span>
          </span>
        </div>
        {pitch && <p className="pb-staff__pitch">{pitch}</p>}
        <div className="pb-staff__cta">
          <Button variant="primary" block iconAfter="chevron-right" onClick={onHire} data-guide={guide}>
            {hireLabel ?? 'See candidates'}
          </Button>
        </div>
      </article>
    );
  }

  const w = work ? WORK[work.state] : null;
  const headInner = (
    <>
      <Monogram name={name} size={44} />
      <span className="pb-staff__who">
        <span className="pb-staff__name">{name}</span>
        <span className="pb-staff__role">{roleLabel}{specialty ? ` · ${specialty}` : ''}</span>
      </span>
      {rating != null && <span className="pb-staff__rating"><b>{rating}</b><small>Rating</small></span>}
      {onOpen && <Icon name="chevron-right" size={20} className="pb-staff__chevron" />}
    </>
  );

  return (
    <article className={cx('pb-staff', className)} aria-label={`${roleLabel}, ${name}`}>
      {onOpen
        ? <button type="button" className="pb-staff__head" onClick={onOpen} data-guide={guide} aria-haspopup="dialog">{headInner}</button>
        : <div className="pb-staff__head">{headInner}</div>}

      {skills.length > 0 && (
        <div className="pb-staff__skills">
          <Meter
            label="Skills"
            valueText={skills.map((s) => String(s.value)).join(' + ') + (rating != null ? ` = ${rating}` : '')}
            segments={skills.map((s, i) => ({ value: s.value, label: s.label, tone: (i === 0 ? 'accent' : 'ink') as FillTone }))}
            max={100}
          />
        </div>
      )}

      {w && work && (
        <div className={cx('pb-staff__work', `is-${work.state}`)}>
          <span className="pb-staff__work-top">
            <StatusBadge tone={w.tone} icon={w.icon}>{work.badge ?? w.label}</StatusBadge>
            {work.when && <span className="pb-staff__when">{work.when}</span>}
          </span>
          {work.title && <span className="pb-staff__work-title">{work.title}</span>}
          {work.text && <span className="pb-staff__work-text">{work.text}</span>}
          {work.state === 'active' && work.total ? (
            <Meter
              size="sm"
              tone="info"
              value={work.done ?? 0}
              max={work.total}
              ariaLabel="Project progress"
              ariaValueText={`Week ${Math.min(work.total, (work.done ?? 0) + 1)} of ${work.total}`}
            />
          ) : null}
          {work.action && (
            <Button
              size="sm"
              variant={work.action.variant ?? 'tonal'}
              block
              meta={work.action.meta}
              onClick={work.action.onClick}
              disabled={work.action.disabled}
            >{work.action.label}</Button>
          )}
        </div>
      )}

      <footer className="pb-staff__foot">
        {focus ? <span>Focus <b>{focus}</b></span> : <span />}
        {contract.ending
          ? <StatusBadge tone="warning" icon="clock">{contract.endingText ?? 'Contract ends this season'}</StatusBadge>
          : <span><b>{contract.wage ?? ''}</b>{contract.through ? ` · through ${contract.through}` : ''}</span>}
      </footer>
    </article>
  );
}

/* --------------------------------------------------------- ProjectProgress */

export interface ProjectProgressProps {
  subject: { name: ReactNode; meta?: ReactNode; icon?: IconName; lead?: ReactNode };
  kind: ReactNode;
  done: number;
  total: number;
  status?: { tone: Tone; icon?: IconName; label: string };
  gain?: { lo: number; hi?: number; attribute: ReactNode };
  chance?: number | null;
  chanceNote?: ReactNode;
  focus?: { label: string; matched: number; needed: number; reachable?: boolean };
  note?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** A running project: who it is about, how far along, and what it can still earn. */
export function ProjectProgress({
  subject, kind, done, total, status, gain, chance, chanceNote, focus, note, children, className,
}: ProjectProgressProps) {
  const t = Math.max(1, total);
  const d = Math.max(0, Math.min(t, done));
  const left = t - d;
  const st = status ?? { tone: 'info' as Tone, icon: 'timer' as IconName, label: `Week ${Math.min(t, d + 1)} of ${t}` };
  return (
    <section className={cx('pb-project', className)} aria-label="Current project">
      <header className="pb-project__head">
        {subject.lead ?? <Monogram name={typeof subject.name === 'string' ? subject.name : undefined} icon={subject.icon} size={44} tone={subject.icon ? 'info' : undefined} />}
        <span className="pb-project__who">
          <span className="pb-project__subject">{subject.name}</span>
          <span className="pb-project__kind">{kind}{subject.meta ? <> {'·'} {subject.meta}</> : null}</span>
        </span>
        <StatusBadge tone={st.tone} icon={st.icon}>{st.label}</StatusBadge>
      </header>
      <Meter
        tone={st.tone === 'warning' ? 'warning' : 'info'}
        value={d}
        max={t}
        label="Progress"
        valueText={left === 0 ? 'Finishing' : `${left} ${left === 1 ? 'week' : 'weeks'} left`}
        ariaValueText={`${d} of ${t} weeks done`}
      />
      <div className="pb-project__facts">
        {gain && (
          <span className="pb-project__fact">
            <small>If it works</small>
            <b>{gain.hi == null || gain.lo === gain.hi ? `+${gain.lo}` : `+${gain.lo} to +${gain.hi}`}</b>
            <em>{gain.attribute}</em>
          </span>
        )}
        {chance != null && (
          <span className="pb-project__fact">
            <small>Chance</small>
            <b>{chance}%</b>
            {chanceNote && <em>{chanceNote}</em>}
          </span>
        )}
        {focus && (
          <span className={cx('pb-project__fact', focus.reachable === false ? 'is-risk' : focus.matched >= focus.needed ? 'is-good' : null)}>
            <small>Focus bonus</small>
            <b>{focus.matched} of {focus.needed}</b>
            <em>{focus.reachable === false ? 'Out of reach' : focus.matched >= focus.needed ? 'Earned' : `weeks on ${focus.label}`}</em>
          </span>
        )}
      </div>
      {focus && focus.reachable === false && (
        <Callout tone="warning" title="The focus bonus is out of reach">
          Only {left} {left === 1 ? 'week remains' : 'weeks remain'}, so this project can earn the base gain at most.
        </Callout>
      )}
      {note && <p className="pb-project__note">{note}</p>}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------ FacilityCard */

export interface FacilityCardProps {
  kind: Building;
  name: string;
  blurb?: ReactNode;
  level: number;
  max?: number;
  /** The now-versus-next rows; at the top level, `now` only. */
  benefits?: CompareRow[];
  /** Cost of the next level, $k. */
  cost?: number;
  /** Budget left this season, $k. */
  budgetLeft?: number;
  delegated?: boolean;
  onUpgrade?: () => boolean | void;
  className?: string;
  /** The guided tour's names: the card, its build button, its blocked button. */
  guide?: { card?: string; cta?: string; blocked?: string };
}

export function FacilityCard({
  kind, name, blurb, level, max = 3, benefits, cost, budgetLeft, delegated, onUpgrade, className, guide = {},
}: FacilityCardProps) {
  const maxed = level >= max;
  const next = Math.min(max, level + 1);
  const canAfford = maxed || cost == null || budgetLeft == null || budgetLeft >= cost;
  const verb = level === 0 ? `Build the ${name}` : `Upgrade to Level ${next}`;
  const sectionTitle = maxed ? 'At full build' : level === 0 ? 'What building it adds' : `What Level ${next} adds`;

  let action: ReactNode = null;
  if (!maxed && delegated) {
    action = (
      <Callout tone="info" title="Managed by your athletic director">
        You can see every level and its cost; the athletic director decides when to build.
      </Callout>
    );
  } else if (!maxed && !canAfford && cost != null && budgetLeft != null) {
    action = (
      <Button variant="primary" block disabled meta={dollars(cost)} data-guide={guide.blocked}>
        Need {dollars(cost - budgetLeft)} more
      </Button>
    );
  } else if (!maxed && cost != null) {
    action = (
      <ConfirmButton
        block
        guide={guide.cta}
        idle={verb}
        meta={dollars(cost)}
        armed="Tap again to confirm"
        armedMeta={budgetLeft != null ? `${dollars(budgetLeft - cost)} left after` : undefined}
        done={level === 0 ? 'Built' : 'Upgraded'}
        failed="Not approved"
        onConfirm={() => onUpgrade?.()}
      />
    );
  }

  return (
    <article
      className={cx('pb-facility', level === 0 && 'is-unbuilt', maxed && 'is-maxed', className)}
      aria-label={name}
      data-guide={guide.card}
    >
      <div className="pb-facility__art"><FacilityArt kind={kind} className="pb-facility-art" /></div>
      <div className="pb-facility__head">
        <div className="pb-facility__titlerow">
          <h3 className="pb-facility__name">{name}</h3>
          {maxed
            ? <StatusBadge tone="positive">Fully built</StatusBadge>
            : <LevelPips level={level} max={max} size="lg" label={name} />}
        </div>
        {blurb && <p className="pb-facility__blurb">{blurb}</p>}
      </div>
      {benefits && benefits.length > 0 && (
        <div className="pb-facility__section">
          <h4 className="pb-facility__subtitle">{sectionTitle}</h4>
          {maxed ? (
            <ul className="pb-facility__list">
              {benefits.map((b, i) => <li key={i}><span>{b.label}</span><b>{showValue(b.nowText ?? b.now, b)}</b></li>)}
            </ul>
          ) : (
            <CompareTable rows={benefits} from={level === 0 ? 'Now' : `Level ${level}`} to={`Level ${next}`} label={sectionTitle} />
          )}
        </div>
      )}
      {action && (
        <div className="pb-facility__foot">
          {!maxed && canAfford && cost != null && budgetLeft != null && !delegated && (
            <span className="pb-facility__money">
              <span>Available <b>{dollars(budgetLeft)}</b></span>
              <span>After <b>{dollars(budgetLeft - cost)}</b></span>
            </span>
          )}
          {action}
        </div>
      )}
    </article>
  );
}

/* ----------------------------------------------------------- BudgetSummary */

export function BudgetSummary({
  total, parts, available, title = 'Available this season', totalLabel = 'this year', label = 'Budget', children, className,
}: {
  /** The year's budget, $k. */
  total: number;
  /** What is committed, in order. */
  parts: Array<{ label: string; value: number; tone?: FillTone }>;
  available?: number;
  title?: string;
  totalLabel?: string;
  label?: string;
  children?: ReactNode;
  className?: string;
}) {
  const used = parts.reduce((n, p) => n + (p.value || 0), 0);
  const avail = available ?? Math.max(0, total - used);
  const toneOf = (p: { tone?: FillTone }, i: number): FillTone => p.tone ?? (i === 0 ? 'accent' : 'ink');
  return (
    <section className={cx('pb-budget', className)} aria-label={label}>
      <div className="pb-budget__head">
        <span className="pb-budget__label">{title}</span>
        <span className={cx('pb-budget__value', avail <= 0 && 'pb-tone--negative')}>{dollars(Math.max(0, avail))}</span>
        <span className="pb-budget__of">of {dollars(total)} {totalLabel}</span>
      </div>
      <Meter
        size="lg"
        max={Math.max(1, total)}
        legend={false}
        ariaLabel={`${dollars(used)} committed of ${dollars(total)}`}
        segments={parts.map((p, i) => ({ value: p.value, label: p.label, tone: toneOf(p, i) }))}
      />
      <ul className="pb-budget__legend">
        {parts.map((p, i) => (
          <li key={i}><i className={cx('pb-swatch', `pb-fill--${toneOf(p, i)}`)} /><span>{p.label}</span><b>{dollars(p.value)}</b></li>
        ))}
        <li><i className="pb-swatch pb-swatch--track" /><span>Available</span><b>{dollars(Math.max(0, avail))}</b></li>
      </ul>
      {children}
    </section>
  );
}
