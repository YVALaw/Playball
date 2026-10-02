// RecruitSheet.tsx
// One prospect: who he is, the race for him, and this week's plan on one page
// — effort, one pitch, one big move — with what it all costs pinned under it.
// His scouting report and the other programs chasing him are a tab away.
//
// Nothing on a prospect is a fact. His rating is a scouted range and his
// ceiling a span of grades, as wide as your recruiting skill is poor. A
// prospect out of your program's reach says so rather than quietly taking
// points for nothing.

import { useEffect, useRef, useState } from 'react';
import { PROMISE_DETAIL } from '../../engine/morale.js';
import { recruitingPlan } from '../../engine/recruitingPlan.js';
import {
  actionInterest, askBlocked, availableRecruitPromises, decisionStyle, factorGrade, factorScore, fit,
  hasRecruitingRelationship, hintsFor, majorActionCost, pitchVerdict, recruitingPrioritiesOf,
  reportedOverall, reportedPotential, reportedTool, wantedScore, weekActionCost,
  ASK_COOLDOWN, ASK_COST, HARD_SELL_COST, MAX_PER_RECRUIT, PITCH_COST, PROMISE_COST, PROMISE_LABEL,
  RECRUITING_FACTORS, RECRUITING_FACTOR_BLURB, SWAY_COST, VISIT_COST,
  type Pitch, type Prospect, type RecruitMajorAction, type RecruitMajorInput, type RecruitingFactor,
} from '../../engine/recruiting.js';
import { GRADE_LADDER, TOP_GENERATED_GRADE, highSchoolLine } from '../../engine/scouting.js';
import { pipelineLabel } from '../../engine/economy.js';
import type { Hitter, Pitcher } from '../../engine/types.js';
import { useDynasty } from '../../state/store.js';
import { handles } from '../../state/depth.js';
import { GodBolt } from '../god/GodBolt.js';
import { armedLock } from '../components/ui/armed.js';
import {
  Button, Callout, cx, EmptyState, Face, Icon, OptionCard, OptionGroup, SegmentedControl, Sheet,
  StatusBadge, Stepper, Tag,
} from '../components/ui/index.js';
import { capsWords, plural, stateName } from '../words.js';
import { RaceBar, StarRow } from './RecruitRow.js';
import {
  decides, FACTOR_SHORT, MAJOR_WORDS, posName, raceOf, slotOf, staffLine, standing, VERDICT,
  type Race, type Standing,
} from './recruitRace.js';

type SheetView = 'week' | 'report' | 'schools';

/** "Bats right, throws right": the hands as the sheet's subtitle says them. */
const hands = (bats: string, throws: string): string =>
  `${bats === 'S' ? 'Bats both ways' : bats === 'L' ? 'Bats left' : 'Bats right'}, ${throws === 'L' ? 'throws left' : 'throws right'}`;

export interface ProspectSheetProps {
  prospect: Prospect;
  userTeam: number;
  coachPrestige: number;
  /** The same effective skill the week's close will spend. */
  recruitingSkill: number;
  pitch: Pitch;
  reachable: boolean;
  pipeline: boolean;
  pipelineStrength: number;
  live: boolean;
  full: boolean;
  /** Points still free this week, across the whole board. */
  left: number;
  weekly: number;
  week: number;
  schoolOf: (i: number) => string;
  onSet: (n: number) => void;
  onPitch: (factor: RecruitingFactor | null) => boolean;
  onMajor: (action: RecruitMajorInput | null) => boolean;
  onClose: () => void;
  /**
   * His place on the staff list, while the staff runs recruiting: his number
   * (null when he is not starred), whether the list is full, and the toggle.
   */
  staff?: { position: number | null; full: boolean; onToggle: () => void };
}

export function ProspectSheet({
  prospect, userTeam, coachPrestige, recruitingSkill, pitch, reachable, pipeline, pipelineStrength,
  live, full, left, weekly, week, schoolOf, onSet, onPitch, onMajor, onClose, staff,
}: ProspectSheetProps) {
  const [tab, setTab] = useState<SheetView>('week');
  const worksBoard = useDynasty((s) => handles(s.depth, 'recruiting'));
  const economy = useDynasty((s) => s.economy);
  const roster = useDynasty((s) => s.season?.teams[userTeam]?.team);
  const p = prospect.player;
  const spent = prospect.spent[userTeam] ?? 0;
  const status = standing(prospect, userTeam, schoolOf, reachable);
  const when = decides(decisionStyle(prospect), week, live);
  const canWork = reachable && live && !full && worksBoard && prospect.signedBy === null;
  const plan = recruitingPlan(prospect, pitch, {
    team: userTeam, actions: spent, prestige: coachPrestige, skill: recruitingSkill, economy,
    roster: roster ? [...roster.lineup, ...roster.bench, ...roster.rotation, ...roster.bullpen] : [],
  });
  const race = raceOf(prospect, userTeam, prospect.signedBy === null ? plan.gain : 0);

  const action = prospect.weekActions?.[userTeam];
  const major = action?.major;
  // A sway or an ask is rolled the moment it is made and cannot be taken back.
  const rolled = major?.kind === 'sway' || major?.kind === 'ask';
  const total = spent + weekActionCost(prospect, userTeam);
  const clearable = spent > 0 || !!action?.pitch || (!!major && !rolled);
  const clear = (): void => {
    if (major && !rolled) onMajor(null);
    if (action?.pitch) onPitch(null);
    if (spent > 0) onSet(0);
  };

  return (
    <Sheet
      eyebrow={`#${prospect.rank} nationally · ${stateName(prospect.state)}`}
      title={p.name}
      subtitle={`${posName(slotOf(prospect))} · ${hands(p.bats, p.throws)}`}
      lead={<Face id={p.id} size={48} />}
      onClose={onClose}
      tall
      className="pb-rc-sheet"
      footer={tab === 'week' && canWork ? (
        <PlanFooter
          effort={spent}
          pitch={action?.pitch ?? null}
          major={major}
          total={total}
          left={left}
          weekly={weekly}
          clearable={clearable}
          onClear={clear}
          onDone={onClose}
        />
      ) : undefined}
    >
      <div className="pb-cluster">
        <StarRow n={prospect.stars} size={14} />
        <StatusBadge tone={status.tone} icon={status.icon ?? (status.tone === 'positive' ? undefined : false)}>
          {status.label}
        </StatusBadge>
        <Tag>{when.tag}</Tag>
        {reachable && pipeline && <Tag tone="positive">{`Pipeline: ${pipelineLabel(pipelineStrength).toLowerCase()}`}</Tag>}
        <GodBolt target={{ kind: 'recruit', id: p.id }} label={`Edit ${p.name} in god mode`} />
      </div>

      <RaceCard
        race={race}
        note={when.note}
        say={raceSay(prospect, userTeam, race, status, schoolOf, reachable)}
        leader={race.rivalTeam !== null ? schoolOf(race.rivalTeam) : 'Leader'}
      />

      <SegmentedControl<SheetView>
        label="Prospect"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'week', label: 'This week' },
          { value: 'report', label: 'Scouting' },
          { value: 'schools', label: 'Other programs' },
        ]}
      />
      {tab === 'week' && (
        <WeekPlan
          prospect={prospect} pitch={pitch} reachable={reachable} live={live} full={full}
          spent={spent} left={left} week={week} userTeam={userTeam} multiplier={plan.multiplier}
          canWork={canWork} worksBoard={worksBoard} staff={staff}
          onSet={onSet} onPitch={onPitch} onMajor={onMajor}
        />
      )}
      {tab === 'report' && <Report prospect={prospect} recruitingSkill={recruitingSkill} />}
      {tab === 'schools' && <Schools prospect={prospect} userTeam={userTeam} schoolOf={schoolOf} />}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The race for him
// ---------------------------------------------------------------------------

/** The race in one sentence: where you are, and what this week's plan does about it. */
function raceSay(
  p: Prospect, userTeam: number, race: Race, status: Standing,
  schoolOf: (i: number) => string, reachable: boolean,
): string {
  if (p.signedBy === userTeam) return 'He committed to you.';
  if (p.signedBy !== null) return `He signed with ${schoolOf(p.signedBy)}.`;
  const leader = race.rivalTeam !== null ? schoolOf(race.rivalTeam) : 'the leader';
  if (!race.any) {
    return reachable ? 'Nobody is recruiting him yet. Any effort puts you in front.' : 'Nobody is recruiting him yet.';
  }
  if (race.mine <= 0) return `You are not on him yet. ${leader} holds ${race.rival}% of his interest.`;
  const lead = race.mine >= race.best;
  // A pitch he sees through takes interest away; the week says so rather than
  // reading as a week with nothing in it.
  if (race.gain < 0) return `${lead ? 'You lead' : status.label}. This week's plan costs you interest.`;
  if (lead) {
    return race.gain > 0
      ? `You lead. This week's plan takes you to ${race.projected}%.`
      : 'You lead. Keep effort on him or the others catch up.';
  }
  if (race.gain > 0 && race.mine + race.gain >= race.best) return `${status.label}. This week's plan puts you in front.`;
  if (race.gain > 0) return `${status.label}. This plan closes part of the gap to ${leader}.`;
  return `${status.label}, ${plural(Math.max(1, Math.round(race.best - race.mine)), 'point')} of interest back. Nothing planned yet.`;
}

function RaceCard(
  { race, note, say, leader }: { race: Race; note: string; say: string; leader: string },
) {
  const moved = race.gain !== 0 && race.projected !== race.you;
  return (
    <section className="pb-rc-race" aria-label="The race for him">
      <div className="pb-rc-race__head">
        <span className="pb-rc-label">The race for him</span>
        <span className="pb-rc-race__note">{note}</span>
      </div>
      <RaceBar race={race} size="lg" />
      <div className="pb-rc-race__cols">
        <div className="pb-rc-race__col">
          <span className="pb-rc-race__k"><i className="pb-rc-race__dot is-you" aria-hidden />You</span>
          <span className="pb-rc-race__v">
            <b>{race.you}%</b>
            {moved && (
              <span className={race.projected > race.you ? 'pb-tone--positive' : 'pb-tone--negative'}>→ {race.projected}%</span>
            )}
          </span>
        </div>
        <div className="pb-rc-race__col">
          <span className="pb-rc-race__k"><i className="pb-rc-race__dot is-lead" aria-hidden /><span className="pb-rc-race__name">{leader}</span></span>
          <span className="pb-rc-race__v"><b>{race.rival}%</b></span>
        </div>
        <div className="pb-rc-race__col">
          <span className="pb-rc-race__k"><i className="pb-rc-race__dot is-others" aria-hidden />{plural(race.others, 'other')}</span>
          <span className="pb-rc-race__v"><b>{race.othersShare}%</b></span>
        </div>
      </div>
      <p className="pb-rc-race__say">{say}</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// This week: the one-page plan
// ---------------------------------------------------------------------------

/**
 * Everything he cares about, most first, as a row of tiles that scrolls
 * sideways: your program's grade, the grade he wants, and whether a pitch on
 * it would land. The picker when you are working him, and a read-only row
 * when you are not.
 */
function PitchRow(
  { prospect, pitch, ranked, selected, disabled, onPick }:
  {
    prospect: Prospect; pitch: Pitch; ranked: readonly RecruitingFactor[];
    selected?: RecruitingFactor | null;
    /** No points left for a pitch: the tiles still read, but cannot be picked. */
    disabled?: boolean;
    /** Omitted, the row only reads. */
    onPick?: (factor: RecruitingFactor | null) => void;
  },
) {
  return (
    <div className="pb-rc-pitches" role={onPick ? 'radiogroup' : 'list'} aria-label="What he cares about, most first">
      {ranked.map((f, i) => {
        const v = VERDICT[pitchVerdict(prospect, pitch, f)];
        const on = selected === f;
        const inner = (
          <>
            {i < 3 && <span className="pb-pitch__rank" aria-label={`His number ${i + 1}`}>{i + 1}</span>}
            <span className="pb-pitch__name">{FACTOR_SHORT[f]}</span>
            <span className="pb-pitch__grades">
              <b>{factorGrade(factorScore(prospect, pitch, f))}</b>
              <small>wants {factorGrade(wantedScore(prospect, f))}</small>
            </span>
            <span className={`pb-pitch__verdict pb-tone--${v.tone}`}><Icon name={v.icon} size={14} />{v.word}</span>
          </>
        );
        return onPick ? (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled && !on}
            title={RECRUITING_FACTOR_BLURB[f]}
            className={cx('pb-pitch', on && 'is-selected')}
            onClick={() => onPick(on ? null : f)}
          >{inner}</button>
        ) : (
          <div key={f} role="listitem" className="pb-pitch" title={RECRUITING_FACTOR_BLURB[f]}>{inner}</div>
        );
      })}
    </div>
  );
}

/**
 * A block's head: its number, which turns green once it is set, its title with
 * what was picked at the right, and one line under it.
 *
 * The pick shares the title's line, never the hint's: a pick arriving beside
 * a hint re-wrapped the hint and pushed every tile under it down a line.
 */
function BlockHead(
  { n, title, cost, pick, hint }: { n: number; title: string; cost?: string; pick?: string; hint: string },
) {
  return (
    <div className="pb-rc-block__head">
      <span className="pb-rc-block__num" aria-hidden>{n}</span>
      <span className="pb-rc-block__titles">
        <span className="pb-rc-block__line">
          <span className="pb-rc-block__title">{title}{cost && <span className="pb-rc-block__cost"> · {cost}</span>}</span>
          {pick && <span className="pb-rc-block__pick">{pick}</span>}
        </span>
        <span className="pb-rc-block__hint">{hint}</span>
      </span>
    </div>
  );
}

/** What a move note says once the move is made. */
function noteFor(
  major: RecruitMajorAction, fits: boolean, week: number,
): { tone: 'info' | 'warning' | 'neutral'; title: string; text: string } {
  switch (major.kind) {
    case 'hardSell':
      return { tone: 'info', title: 'Hard sell this week', text: `You press ${FACTOR_SHORT[major.factor].toLowerCase()} with everything you have. Lands when the week ends.` };
    case 'visit':
      return {
        tone: 'info', title: 'He visits campus',
        text: fits ? 'He already likes what you offer, so the visit lands big.' : 'He is not sold on your program yet, so the visit lands small.',
      };
    case 'promise':
      return { tone: 'info', title: 'Promise made', text: PROMISE_DETAIL[major.promise] };
    case 'sway':
      return major.success
        ? { tone: 'info', title: 'The sway is done', text: `He cares more about ${FACTOR_SHORT[major.factor].toLowerCase()} now.` }
        : { tone: 'neutral', title: 'The sway missed', text: 'What he cares about did not move.' };
    case 'ask':
      return major.success
        ? { tone: 'info', title: 'He said yes', text: 'He commits when the week ends.' }
        : {
          tone: 'warning', title: 'He said no',
          text: `He doubts your ${major.doubt ? FACTOR_SHORT[major.doubt].toLowerCase() : 'case'}. Ask again in week ${week + ASK_COOLDOWN}.`,
        };
  }
}

/** "Worth ~7 interest", with a real minus when a move would cost him. */
const worthLine = (lo: number, hi = lo): string => {
  const n = (v: number): string => (v < 0 ? `−${-v}` : String(v));
  return lo === hi ? `Worth ~${n(lo)} interest` : `Worth ~${n(lo)}–${n(hi)} interest`;
};

function WeekPlan({
  prospect, pitch, reachable, live, full, spent, left, week, userTeam, multiplier, canWork, worksBoard, staff,
  onSet, onPitch, onMajor,
}: {
  prospect: Prospect; pitch: Pitch;
  reachable: boolean; live: boolean; full: boolean; spent: number; left: number; week: number; userTeam: number;
  /** The coordinator's directive, as the week's close will apply it. */
  multiplier: number;
  canWork: boolean; worksBoard: boolean;
  staff?: ProspectSheetProps['staff'];
  onSet: (n: number) => void;
  onPitch: (factor: RecruitingFactor | null) => boolean;
  onMajor: (action: RecruitMajorInput | null) => boolean;
}) {
  const coordinator = useDynasty((s) => s.economy?.staff?.recruiting);
  const [promiseOpen, setPromiseOpen] = useState(false);
  const priorities = recruitingPrioritiesOf(prospect);
  const ranked = [...RECRUITING_FACTORS].sort((a, b) => priorities[b] - priorities[a]);

  if (prospect.signedBy !== null || !canWork) {
    return (
      <>
        {prospect.signedBy !== null ? null : !reachable ? (
          <Callout tone="neutral" icon="lock" title="Out of reach for now">Build the program up and he starts listening.</Callout>
        ) : full ? (
          <Callout tone="neutral" title="Your class is full" />
        ) : !live ? (
          <Callout tone="neutral" title="The class is closed" />
        ) : !worksBoard ? (
          // The staff works the men he stars: whether this one is, and the one
          // button that changes it. The line under it is what the staff is
          // doing with him this week.
          staff && staff.position !== null ? (
            <Callout
              tone="info" icon="star-filled" title={`No. ${staff.position} on your staff list`}
              action={{ label: 'Unstar', variant: 'secondary', onClick: staff.onToggle }}
            >{staffLine(prospect, userTeam, week, pitch.stars)}</Callout>
          ) : staff && staff.full ? (
            <Callout tone="neutral" icon="star" title="Your staff list is full">Unstar someone to add him.</Callout>
          ) : staff ? (
            // The starred title's mirror, one line at any name: with the
            // coordinator's name in it a long one wrapped to two lines, and
            // every Star him / Unstar tap moved the sheet under the thumb.
            <Callout
              tone="neutral" icon="star" title="Not on your staff list"
              action={{ label: 'Star him', variant: 'tonal', onClick: staff.onToggle }}
            >{staffLine(prospect, userTeam, week, pitch.stars)}</Callout>
          ) : (
            <Callout tone="info" title={coordinator ? `${coordinator.name} works this board` : 'Your staff works this board'} />
          )
        ) : null}
        <section className="pb-rc-block pb-rc-block--scroll">
          <div className="pb-rc-block__head">
            <span className="pb-rc-block__titles">
              <span className="pb-rc-block__title">What he cares about</span>
              <span className="pb-rc-block__hint">His top 3 wants come first</span>
            </span>
          </div>
          <PitchRow prospect={prospect} pitch={pitch} ranked={ranked} />
        </section>
      </>
    );
  }

  const action = prospect.weekActions?.[userTeam];
  const major = action?.major;
  const pick = action?.pitch ?? null;
  // What a sway or a hard sell presses on: the pitch, or his top want.
  const focus = pick ?? ranked[0]!;
  const bound = prospect.promiseBy?.[userTeam];
  const promiseLocked = !!bound && major?.kind !== 'promise';
  // Big moves are relationship moves: from week 2, on a man with interest banked.
  const movesOpen = hasRecruitingRelationship(prospect, userTeam) && week >= 2;
  const swayRolled = major?.kind === 'sway';
  const swayUsed = Boolean(prospect.swayedBy?.[userTeam]);
  const askRolled = major?.kind === 'ask';
  const askReason = askRolled ? null : askBlocked(prospect, userTeam, week, full);
  const rolled = swayRolled || askRolled;

  // What the week can still pay for: the free points, plus whatever the thing
  // being replaced already costs.
  const room = Math.max(0, left);
  const effortMax = Math.min(MAX_PER_RECRUIT, spent + room);
  const moveRoom = room + majorActionCost(major);
  const canPitch = !!pick || room >= PITCH_COST;

  /*
    What a move is worth, in the interest the week's close will bank: the
    engine's own sum for this week with the move, against the same week
    without it, through the coordinator's directive. A move behind a pitch is
    worth more than the move alone — the concentration bonus in
    `actionInterest` — and this counts that too.
  */
  const trial = (m?: RecruitMajorAction): Prospect => ({
    ...prospect,
    weekActions: {
      ...(prospect.weekActions ?? {}),
      [userTeam]: { ...(pick ? { pitch: pick } : {}), ...(m ? { major: m } : {}) },
    },
  });
  const bare = actionInterest(trial(), pitch, userTeam);
  const worth = (m: RecruitMajorAction): number =>
    Math.round((actionInterest(trial(m), pitch, userTeam) - bare) * multiplier);

  const sellFactor = major?.kind === 'hardSell' ? major.factor : focus;
  // A visit sells the whole place, so it lands on the whole fit.
  const fits = fit(prospect, pitch) >= 0.5;
  const promises = availableRecruitPromises(prospect.player);
  const promiseCosts = promises.map((k) => PROMISE_COST[k]);
  const promiseWorths = promises.map((k) => worth({ kind: 'promise', promise: k }));
  const cheapest = Math.min(...promiseCosts);
  const promised = major?.kind === 'promise' ? major.promise : null;
  const note = major
    ? noteFor(major, fits, week)
    : promiseLocked && bound
      ? { tone: 'info' as const, title: 'Promise made', text: PROMISE_DETAIL[bound] }
      : null;

  return (
    <div className="pb-rc-plan">
      <section className={cx('pb-rc-block', spent > 0 && 'is-set')}>
        <div className="pb-rc-block__head">
          <span className="pb-rc-block__num" aria-hidden>1</span>
          <Stepper
            className="pb-rc-effort"
            label="Effort"
            hint={`Steady interest every week · up to ${MAX_PER_RECRUIT} pts`}
            value={spent}
            min={0}
            max={effortMax}
            onChange={onSet}
          />
        </div>
        <div className="pb-rc-quick" role="group" aria-label="Effort">
          {[0, 4, 8, MAX_PER_RECRUIT].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={spent === n}
              disabled={n > effortMax}
              className={cx(spent === n && 'is-on')}
              onClick={() => onSet(n)}
            >{n === 0 ? 'None' : n === MAX_PER_RECRUIT ? `Max ${MAX_PER_RECRUIT}` : String(n)}</button>
          ))}
        </div>
      </section>

      <section className={cx('pb-rc-block', 'pb-rc-block--scroll', pick && 'is-set')}>
        <BlockHead
          n={2}
          title="Pitch one thing"
          cost={`${PITCH_COST} pts`}
          pick={pick ? FACTOR_SHORT[pick] : undefined}
          hint="Optional · his top 3 wants come first"
        />
        <PitchRow
          prospect={prospect} pitch={pitch} ranked={ranked}
          selected={pick} disabled={!canPitch} onPick={(f) => onPitch(f)}
        />
      </section>

      <section className={cx('pb-rc-block', major && 'is-set')}>
        <BlockHead
          n={3}
          title="One big move"
          pick={major ? MAJOR_WORDS[major.kind] : undefined}
          hint={movesOpen ? 'Optional · pick at most one a week' : 'Bank a week of interest first'}
        />
        <div className="pb-rc-moves" role="group" aria-label="Big move">
          <MoveTile
            title="Hard sell"
            cost={String(HARD_SELL_COST)}
            sub={`Presses ${FACTOR_SHORT[sellFactor].toLowerCase()}`}
            effect={worthLine(worth({ kind: 'hardSell', factor: sellFactor }))}
            selected={major?.kind === 'hardSell'}
            disabled={!movesOpen || rolled || (major?.kind !== 'hardSell' && HARD_SELL_COST > moveRoom)}
            onSelect={() => onMajor(major?.kind === 'hardSell' ? null : { kind: 'hardSell', factor: focus })}
          />
          <MoveTile
            title="Program visit"
            cost={String(VISIT_COST)}
            sub={fits ? 'He fits here: big boost' : 'Weak fit: small boost'}
            effect={worthLine(worth({ kind: 'visit' }))}
            selected={major?.kind === 'visit'}
            disabled={!movesOpen || rolled || (major?.kind !== 'visit' && VISIT_COST > moveRoom)}
            onSelect={() => onMajor(major?.kind === 'visit' ? null : { kind: 'visit' })}
          />
          <MoveTile
            title="Promise"
            cost={promised ? String(PROMISE_COST[promised]) : `${cheapest}–${Math.max(...promiseCosts)}`}
            sub={promised ? capsWords(PROMISE_LABEL[promised])
              : promiseLocked && bound ? `Promised: ${capsWords(PROMISE_LABEL[bound]).toLowerCase()}`
                : 'Binding if he signs'}
            effect={promised
              ? worthLine(worth({ kind: 'promise', promise: promised }))
              : worthLine(Math.min(...promiseWorths), Math.max(...promiseWorths))}
            selected={!!promised}
            open={promiseOpen}
            disabled={!movesOpen || rolled || promiseLocked || (!promised && cheapest > moveRoom)}
            onSelect={() => setPromiseOpen((o) => !o)}
          />
          <MoveTile
            bolt
            confirm
            title="Sway him"
            cost={String(SWAY_COST)}
            sub={swayUsed ? 'Used this season' : `Makes him care about ${FACTOR_SHORT[focus].toLowerCase()}`}
            effect="Once a season · happens now"
            selected={swayRolled}
            disabled={swayUsed || rolled || !movesOpen || SWAY_COST > moveRoom}
            onSelect={() => onMajor({ kind: 'sway', factor: focus })}
          />
          <MoveTile
            bolt
            confirm
            title="Ask to commit"
            cost={String(ASK_COST)}
            sub={major?.kind === 'ask' ? (major.success ? 'He said yes' : 'He said no') : askReason ?? 'He answers now'}
            effect="He answers the moment you ask"
            selected={askRolled}
            disabled={rolled || askReason !== null || ASK_COST > moveRoom}
            onSelect={() => onMajor({ kind: 'ask' })}
          />
        </div>

        {promiseOpen && !rolled && !promiseLocked && movesOpen && (
          <div className="pb-rc-promises">
            <span className="pb-rc-promises__head">Pick the promise · it binds you if he signs</span>
            <OptionGroup label="Promise">
              {promises.map((k) => {
                const on = promised === k;
                return (
                  <OptionCard
                    key={k}
                    title={capsWords(PROMISE_LABEL[k])}
                    hint={PROMISE_DETAIL[k]}
                    meta={String(PROMISE_COST[k])}
                    selected={on}
                    disabled={!on && PROMISE_COST[k] > moveRoom}
                    onSelect={() => {
                      onMajor(on ? null : { kind: 'promise', promise: k });
                      setPromiseOpen(false);
                    }}
                  />
                );
              })}
            </OptionGroup>
          </div>
        )}

        {note && <Callout tone={note.tone} title={note.title}>{note.text}</Callout>}
      </section>
    </div>
  );
}

/**
 * One big move, as a tile the same size as its neighbours: its name and price,
 * what it does, and what it is worth.
 *
 * Sway and ask are marked out (a bolt and a warmer tint) and take two taps,
 * because each happens the moment it is made and cannot be taken back. The
 * first tap arms the tile and it says so; touching anything else stands it
 * down, and only one control in the app is armed at a time (armed.ts).
 */
function MoveTile(
  { title, cost, sub, effect, selected, disabled, open, bolt, confirm, onSelect }:
  {
    title: string; cost: string; sub: string; effect: string;
    selected?: boolean; disabled?: boolean;
    /** Its picker is open under the grid (the promise). */
    open?: boolean;
    bolt?: boolean; confirm?: boolean;
    onSelect: () => void;
  },
) {
  const [armed, setArmed] = useState(false);
  const me = useRef<HTMLButtonElement | null>(null);
  const id = useRef(Symbol('move'));

  useEffect(() => {
    const mine = id.current;
    return () => { if (armedLock.current?.id === mine) armedLock.current = null; };
  }, []);
  useEffect(() => { if (disabled) setArmed(false); }, [disabled]);
  useEffect(() => {
    if (!armed) return undefined;
    const stand = (e: PointerEvent): void => {
      if (me.current && e.target instanceof Node && me.current.contains(e.target)) return;
      if (armedLock.current?.id === id.current) armedLock.current = null;
      setArmed(false);
    };
    document.addEventListener('pointerdown', stand, true);
    return () => document.removeEventListener('pointerdown', stand, true);
  }, [armed]);

  const press = (): void => {
    if (!confirm) { onSelect(); return; }
    if (armed) {
      armedLock.current = null;
      setArmed(false);
      onSelect();
      return;
    }
    armedLock.current?.disarm();
    armedLock.current = { id: id.current, disarm: () => setArmed(false) };
    setArmed(true);
  };

  return (
    <button
      ref={me}
      type="button"
      aria-pressed={!!selected}
      aria-expanded={open}
      aria-live={armed ? 'polite' : undefined}
      disabled={disabled}
      className={cx('pb-rc-move', selected && 'is-selected', bolt && 'is-bolt', armed && 'is-armed', open && 'is-open')}
      onClick={press}
    >
      <span className="pb-rc-move__top">
        <span className="pb-rc-move__title">{bolt && <Icon name="lightning" size={14} />}{title}</span>
        <span className="pb-rc-move__cost">{cost}</span>
      </span>
      <span className="pb-rc-move__sub">{armed ? 'Tap again to do it now' : sub}</span>
      <span className="pb-rc-move__effect">{effect}</span>
    </button>
  );
}

/**
 * The receipt pinned under the plan: each part and its price, the week's
 * total on him, and what the board has left.
 *
 * The chips sit on one line that scrolls rather than wraps, so a long pitch
 * name never lifts the footer over the plan.
 */
function PlanFooter(
  { effort, pitch, major, total, left, weekly, clearable, onClear, onDone }:
  {
    effort: number; pitch: RecruitingFactor | null; major?: RecruitMajorAction;
    total: number; left: number; weekly: number; clearable: boolean;
    onClear: () => void; onDone: () => void;
  },
) {
  const chips = [
    { key: 'effort', label: 'Effort', pts: effort, on: effort > 0 },
    { key: 'pitch', label: pitch ? `Pitch: ${FACTOR_SHORT[pitch]}` : 'Pitch', pts: pitch ? PITCH_COST : 0, on: !!pitch },
    { key: 'move', label: major ? MAJOR_WORDS[major.kind] : 'Big move', pts: majorActionCost(major), on: !!major },
  ];
  return (
    <>
      <div className="pb-rc-receipt" aria-label="This week on him">
        {chips.map((c) => (
          <span key={c.key} className={cx('pb-rc-chip', c.on && 'is-on')}>{c.label}<b>{c.pts}</b></span>
        ))}
      </div>
      <div className="pb-rc-total">
        <span className="pb-rc-total__text">
          <b>{plural(total, 'point')} on him</b>
          <small className={left < 0 ? 'pb-tone--negative' : undefined}>
            {left < 0 ? `${-left} over this week's budget` : `${left} of ${weekly} left this week`}
          </small>
        </span>
        <span className="pb-rc-total__btns">
          <Button variant="quiet" size="sm" disabled={!clearable} onClick={onClear}>Clear</Button>
          <Button variant="primary" size="sm" onClick={onDone}>Done</Button>
        </span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Scouting, and the other programs
// ---------------------------------------------------------------------------

/** The four numbers of last spring's line the row has room for. */
const LINE_KEYS = { hitter: ['AVG', 'HR', 'RBI', 'SB'], pitcher: ['ERA', 'K', 'BB', 'IP'] } as const;

/** The scouting report: the two ranges, two impressions, the tools, last spring's line. */
function Report({ prospect, recruitingSkill }: { prospect: Prospect; recruitingSkill: number }) {
  const p = prospect.player;
  const tools: [string, number][] = p.type === 'pitcher'
    ? [['Strikeout stuff', (p as Pitcher).stuff], ['Keeps hits down', (p as Pitcher).movement],
       ['Control', (p as Pitcher).control], ['Stamina', (p as Pitcher).stamina]]
    : [['Contact', (p as Hitter).contact], ['Power', (p as Hitter).power],
       ['Plate discipline', (p as Hitter).eye], ['Speed', (p as Hitter).speed],
       ['Range in the field', (p as Hitter).range], ['Arm strength', (p as Hitter).arm]];
  const hints = hintsFor(prospect);
  const now = reportedOverall(prospect, recruitingSkill);
  const ceiling = reportedPotential(prospect, recruitingSkill);
  // The grades a recruit can come out at: S+ belongs to nobody the world makes.
  const ladder = GRADE_LADDER.slice(0, GRADE_LADDER.indexOf(TOP_GENERATED_GRADE) + 1);
  const lo = ladder.indexOf(ceiling.low);
  const hi = ladder.indexOf(ceiling.high);
  const keys: readonly string[] = LINE_KEYS[p.type === 'pitcher' ? 'pitcher' : 'hitter'];
  const spring = highSchoolLine(p);
  const line = keys
    .map((k) => spring.find((row) => row.label === k))
    .filter((row): row is NonNullable<typeof row> => !!row);
  return (
    <>
      <div className="pb-rc-tiles">
        <div className="pb-rc-tile">
          <span className="pb-rc-label">Rating now</span>
          <span className="pb-rc-tile__v"><b>{now.low === now.high ? now.low : `${now.low}–${now.high}`}</b><i>/100</i></span>
          <span className="pb-rc-tile__note">A range: your scouts are not sure</span>
        </div>
        <div className="pb-rc-tile">
          <span className="pb-rc-label">Ceiling</span>
          <span className="pb-rc-tile__v"><b>{ceiling.low === ceiling.high ? ceiling.low : `${ceiling.low}–${ceiling.high}`}</b><i>grade</i></span>
          <span className="pb-rc-scale" role="img" aria-label={`Ceiling ${ceiling.low} to ${ceiling.high}`}>
            {ladder.map((g, i) => <span key={g} className={cx(i >= lo && i <= hi && 'is-on')}>{g}</span>)}
          </span>
        </div>
      </div>
      <div className="pb-rc-quotes">
        {([['Ceiling', hints.ceiling.text], ['Development', hints.development.text]] as const).map(([k, t]) => (
          <div key={k} className="pb-rc-quote">
            <Icon name="chat" size={15} />
            <span><small>{k}</small><span>&ldquo;{t}&rdquo;</span></span>
          </div>
        ))}
      </div>
      <section className="pb-rc-card">
        <header className="pb-rc-card__head"><span>Tools</span><small>Scouted range, of 100</small></header>
        {tools.map(([label, value]) => {
          const r = reportedTool(prospect, value, recruitingSkill);
          return (
            <div key={label} className="pb-rc-tool">
              <span>{label}</span>
              <span className="pb-rc-tool__bar" role="img" aria-label={`${label} ${r.low} to ${r.high} of 100`}>
                <i style={{ width: `${r.low}%` }} />
                <i className="pb-rc-tool__span" style={{ left: `${r.low}%`, width: `${r.high - r.low}%` }} />
              </span>
              <b>{r.low === r.high ? r.low : `${r.low}–${r.high}`}</b>
            </div>
          );
        })}
      </section>
      {line.length > 0 && (
        <section className="pb-rc-card">
          <header className="pb-rc-card__head"><span>Last spring</span><small>High school</small></header>
          <div className="pb-rc-line">
            {line.map((row) => <div key={row.label}><small>{row.label}</small><b>{row.value}</b></div>)}
          </div>
        </section>
      )}
    </>
  );
}

function Schools({ prospect, userTeam, schoolOf }: { prospect: Prospect; userTeam: number; schoolOf: (i: number) => string }) {
  const rivals = Object.entries(prospect.points)
    .map(([t, pts]) => ({ team: Number(t), pts }))
    .filter((r) => r.pts > 0)
    .sort((a, b) => b.pts - a.pts);
  const total = rivals.reduce((a, r) => a + r.pts, 0);
  if (rivals.length === 0) {
    return <EmptyState icon="search" title="Nobody is recruiting him yet" />;
  }
  return (
    <section className="pb-rc-card pb-rc-card--flush" aria-label="Who is recruiting him">
      <header className="pb-rc-card__head"><span>Who is recruiting him</span><small>His interest</small></header>
      {rivals.map((r) => {
        const pct = Math.round((r.pts / total) * 100);
        const you = r.team === userTeam;
        return (
          <div key={r.team} className={cx('pb-rc-school', you && 'is-you')}>
            <span className="pb-rc-school__name">{you ? `${schoolOf(r.team)} (you)` : schoolOf(r.team)}</span>
            <span className="pb-rc-school__bar" aria-hidden><i style={{ width: `${pct}%` }} /></span>
            <b>{pct}%</b>
          </div>
        );
      })}
    </section>
  );
}
