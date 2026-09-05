// RosterMoves.tsx
// Everything a coach does to one of his own men, behind one button.
//
// The proposal's player-actions FAB: a round trigger in the bottom corner of
// the card, and a dark panel that opens out of it with four tabs — the room,
// the classroom, where else he plays, and his season. It replaces a stack of
// panels that lived inline under the OVERVIEW tab and were only reachable by
// scrolling past his ratings to get to them.
//
// The rule that made this a separate file has not changed and is easier to hold
// in one place: **these are only ever offered for your own men**, and only when
// they are actually possible. A control that is visible and refuses is worse
// than one that is not there — so a tab whose actions are all impossible says
// why, rather than showing three dead buttons.
//
// Every action here writes to the store the engine reads. The proposal's
// version logs a sentence into a decision ledger and changes nothing; this one
// rests a man for three days, spends one of a season's four conversations, moves
// a shortstop to second base for good, or burns a redshirt.

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarIcon, CheckIcon, Cross1Icon, EnvelopeClosedIcon, DotsHorizontalIcon,
  ReloadIcon, StopwatchIcon,
} from '@radix-ui/react-icons';
import { useDynasty } from '../../state/store.js';
import { handles } from '../../state/depth.js';
import { standing, WORDS_A_SEASON } from '../../engine/eligibility.js';
import { canRedshirt, MAX_REDSHIRTS, redshirtCount } from '../../engine/redshirt.js';
import { secondaryPositions } from '../../engine/positions.js';
import { injuryClock } from '../../engine/season.js';
import { isHurt, prognosis } from '../../engine/injury.js';
import { legWeariness } from '../../engine/workload.js';
import { mood, promiseOf, squadRanks } from '../../engine/morale.js';
import { FieldNote } from '../components/Kit.js';
import type { Hitter, Player as AnyPlayer, Position } from '../../engine/types.js';

const SCHOOL_WORDS: Record<'fine' | 'watch' | 'trouble', { label: string; line: string }> = {
  fine: { label: 'IN GOOD STANDING', line: 'Nothing to do here.' },
  watch: {
    label: 'ON THE WATCH LIST',
    line: 'He is close to the line. A week could go either way.',
  },
  trouble: {
    label: 'FAILING',
    line: 'He is short of eligible and will start missing weeks.',
  },
};

/** One thing a coach can do, as the proposal draws it. */
function ActionCard(
  { icon, eyebrow, title, detail, meta, onClick, selected = false, disabled = false, glow = false }:
  {
    icon: ReactNode; eyebrow: string; title: string; detail: string; meta?: string;
    onClick?: () => void; selected?: boolean; disabled?: boolean;
    /** Lit as the final step of a guided errand. */
    glow?: boolean;
  },
) {
  return (
    <button
      className={`command-action-card${selected ? ' selected' : ''}${glow ? ' guide-glow' : ''}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="command-action-icon">{icon}</span>
      <span className="command-action-copy">
        <small>{eyebrow}</small>
        <strong>{title}</strong>
        <p>{detail}</p>
        {meta && <em>{meta}</em>}
      </span>
      {selected ? <CheckIcon /> : <span className="command-action-state" />}
    </button>
  );
}

export function RosterMoves({ p, isOurs }: { p: AnyPlayer; isOurs: boolean }) {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const wordsUsed = useDynasty((s) => s.wordsUsed);
  const wordWith = useDynasty((s) => s.wordWith);
  const setRedshirt = useDynasty((s) => s.setRedshirt);
  const restMan = useDynasty((s) => s.restMan);
  const changePosition = useDynasty((s) => s.changePosition);
  // The offseason rail is non-null exactly while the winter is open, which
  // is when a position change is allowed — the door made it a ritual: "he
  // retrains over winter and opens next season at the new spot."
  const winter = useDynasty((s) => s.phase) !== null;
  const version = useDynasty((s) => s.version);
  // A career that asked its staff to decide who sits does not get the button.
  const mine = useDynasty((s) => handles(s.depth, 'redshirts'));
  /*
    The guided errand, lighting one control at a time. Designed by the
    reporter for the failing-man card: the action button glows until it is
    opened, SCHOOL glows until it is chosen, HAVE A WORD glows until it is
    pressed — and the press stamps 'guide:word' so the path never lights
    twice. Each light is derived from the state the previous tap produced,
    which is what makes the sequence a sequence.
  */
  const guide = useDynasty((s) => s.guide);
  const clearGuide = useDynasty((s) => s.clearGuide);
  const markTutorialSeen = useDynasty((s) => s.markTutorialSeen);
  const guiding = guide === 'word';
  // Three states, matching the college FAB: closing is a motion, and the
  // scrim below stands the menu down from anywhere. See the note there.
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const open = phase === 'open';
  const requestClose = (): void => {
    setPhase('closing');
    window.setTimeout(() => {
      setPhase((p) => (p === 'closing' ? 'closed' : p));
    }, 200);
  };
  const [target, setTarget] = useState<Position | null>(null);
  void version;

  // Everything below is a thing a coach does to his own player. A leaderboard
  // is full of men you do not employ.
  if (!isOurs || !season) return null;
  const team = season.teams[userTeam]?.team;
  if (!team) return null;

  const school = standing(p);
  const sitting = (p as AnyPlayer & { redshirt?: boolean }).redshirt === true;
  const outUntil = (p as AnyPlayer & { outUntil?: number }).outUntil;
  const clock = injuryClock(season);
  const suspended = typeof outUntil === 'number' && clock < outUntil;
  const wordsLeft = WORDS_A_SEASON - wordsUsed;
  // The real rule: one appearance burns the season, so this is only a decision
  // before the first pitch of the year.
  const preseason = season.dayIndex === 0;
  const canSit = preseason && mine && canRedshirt(p) && redshirtCount(team) < MAX_REDSHIRTS;

  const hurtNow = isHurt(p, clock);
  const tired = legWeariness(p);
  const resting = !hurtNow && suspended;
  const ranks = squadRanks(team);
  const rank = ranks.get(p.id) ?? 0;
  const feeling = mood(p);

  /*
    The hardest three, not all of them.

    A shortstop can genuinely stand anywhere except behind the plate, so the
    honest list for him is six positions -- which in a panel is a wall, and the
    three easiest of them tell you nothing you had not guessed.
    `secondaryPositions` already sorts hardest first, so the top of that list is
    the half worth printing: what he can do that is *not* obvious.
  */
  const alsoPlays = (p.type === 'hitter' ? secondaryPositions(p as Hitter) : []).slice(0, 3);

  /** The word under the trigger, so the button says something before it opens. */
  const statusLabel = hurtNow ? 'HURT'
    : sitting ? 'REDSHIRT'
      : suspended ? 'OUT'
        : school !== 'fine' ? 'ACADEMIC'
          : 'ACTIVE';

  /*
    Rendered into the overlay's frame rather than in place.

    In place it sat inside .overlay-scroll, and on iOS an absolutely-positioned
    element whose containing block is outside its momentum scroller repaints a
    beat behind the scroll — reported as the button 'moving along when
    scrolling' and the stale white ghost it left behind. Outside the scroller
    there is nothing to lag.
  */
  const host = document.querySelector('.full-overlay') ?? document.querySelector('.app-frame');
  if (!host) return null;

  return createPortal(
    <>
      {open && (
        <button
          className="popover-scrim"
          type="button"
          aria-label="Close player actions"
          onClick={requestClose}
        />
      )}
    <aside className={`profile-actions-shell player-profile-actions${open ? ' open' : ''}${phase === 'closing' ? ' closing' : ''}`}>
      <div className="profile-command-sheet" aria-hidden={!open}>
        <div className="command-sheet-handle" />
        <header className="profile-command-header">
          <small>PLAYER DECISIONS</small>
          <strong>{p.name}</strong>
          <p>{hurtNow ? prognosis(p, clock) : sitting ? 'Redshirted for this season.' : `${feeling.toUpperCase()} · he ${promiseOf(p, rank)}.`}</p>
        </header>

        <section className="command-status-grid">
          <span><small>MOOD</small><strong>{feeling.toUpperCase()}</strong><em>{promiseOf(p, rank)}</em></span>
          <span className={tired > 0.35 ? 'is-alert' : ''}><small>WORKLOAD</small><strong>{hurtNow ? 'HURT' : `${Math.round(tired * 100)}%`}</strong><em>{hurtNow ? prognosis(p, clock) : tired > 0.35 ? 'Could use a breather' : 'Fresh enough'}</em></span>
          <span className={school !== 'fine' ? 'is-alert' : ''}><small>ACADEMICS</small><strong>{SCHOOL_WORDS[school].label.replace('IN ', '')}</strong><em>{suspended ? 'Missing this week' : SCHOOL_WORDS[school].line}</em></span>
          <span><small>ELIGIBILITY</small><strong>{sitting ? 'REDSHIRT' : p.classYear}</strong><em>{preseason ? `${redshirtCount(team)}/${MAX_REDSHIRTS} redshirts used` : 'Season is active'}</em></span>
        </section>

        <section className="command-section">
          <header><small>RIGHT NOW</small><h2>Manage the week</h2></header>
          <div className="command-action-grid">
            <ActionCard
              icon={<StopwatchIcon />}
              eyebrow="RECOVERY"
              title={resting ? 'Already resting' : 'Rest three days'}
              detail={hurtNow ? 'Injury recovery is controlled by the trainer.' : tired > 0.35 ? 'Sit him now to take wear out of his legs.' : 'His workload is healthy; there is little to gain from sitting him.'}
              meta={resting ? 'Currently unavailable' : tired > 0.35 ? `Workload ${Math.round(tired * 100)}%` : 'No action needed'}
              selected={resting}
              disabled={hurtNow || resting || tired <= 0.35 || !mine}
              onClick={() => restMan(p.id, 3)}
            />
            <ActionCard
              icon={<EnvelopeClosedIcon />}
              eyebrow="ACADEMICS"
              title={school === 'fine' ? 'Nothing to address' : wordsLeft > 0 ? 'Have a word' : 'No conversations left'}
              detail={school === 'fine' ? 'He is in good standing.' : SCHOOL_WORDS[school].line}
              meta={`${wordsLeft} of ${WORDS_A_SEASON} conversations left`}
              disabled={school === 'fine' || wordsLeft <= 0}
              glow={guiding && school !== 'fine' && wordsLeft > 0}
              onClick={() => {
                wordWith(p.id);
                if (guiding) {
                  markTutorialSeen('guide:word');
                  clearGuide();
                }
              }}
            />
          </div>
          {hurtNow && <FieldNote title="Trainer decision" text="Rest does not shorten an injury timetable." />}
          {!mine && !hurtNow && <FieldNote title="Staff controlled" text="Rest and redshirt decisions are delegated in your current control settings." />}
        </section>

        <section className="command-section">
          <header><small>ROSTER PLANNING</small><h2>Shape next season</h2></header>
          <div className="command-action-grid">
            {p.type === 'hitter' && (
              <div className="command-action-stack">
                <ActionCard
                  icon={<ReloadIcon />}
                  eyebrow="POSITION"
                  title={target ? `${p.pos} → ${target}` : 'Retrain position'}
                  detail={!winter ? 'Position changes happen over the offseason.' : alsoPlays.length === 0 ? 'There is no realistic secondary spot to train.' : target ? `This permanently changes his listed position to ${target}.` : 'Choose a realistic secondary position below.'}
                  meta={winter ? 'Permanent move · adjustment period next year' : 'Offseason only'}
                  selected={target !== null}
                  disabled={!winter || target === null}
                  onClick={() => { changePosition(p.id, target as Position); setTarget(null); }}
                />
                {winter && alsoPlays.length > 0 && (
                  <div className="position-picker command-position-picker">
                    <small>NEW POSITION</small>
                    {alsoPlays.map((spot) => (
                      <button className={target === spot ? 'active' : ''} key={spot} type="button" onClick={() => setTarget(target === spot ? null : spot as Position)}>{spot}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <ActionCard
              icon={<CalendarIcon />}
              eyebrow="ELIGIBILITY"
              title={sitting ? 'Return to active roster' : 'Redshirt season'}
              detail={sitting ? 'Undo the preseason decision and make him available.' : preseason ? 'Preserve this year of eligibility before he appears.' : 'The season has already been used.'}
              meta={preseason ? `${redshirtCount(team)} of ${MAX_REDSHIRTS} used` : 'Preseason decision'}
              selected={sitting}
              disabled={!canSit && !sitting}
              onClick={() => setRedshirt(p.id, !sitting)}
            />
          </div>
        </section>
      </div>

      <button
        className={`profile-actions-launcher${guiding && !open ? ' guide-glow' : ''}`}
        type="button"
        aria-label={open ? 'Close player management' : 'Manage player'}
        aria-expanded={open}
        onClick={() => (open ? requestClose() : setPhase('open'))}
      >
        {open ? <Cross1Icon /> : <DotsHorizontalIcon />}
        <span>{open ? 'Close' : 'Manage'}</span>
      </button>
      {!open && <span className="profile-actions-status" aria-hidden="true">{statusLabel}</span>}
    </aside>
    </>,
    host,
  );
}
