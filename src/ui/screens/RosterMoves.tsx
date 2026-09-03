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
  CalendarIcon, CheckIcon, Cross1Icon, EnvelopeClosedIcon, MixerHorizontalIcon,
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
import { Segmented } from '../components/Kit.js';
import type { Hitter, Player as AnyPlayer, Position } from '../../engine/types.js';

type Area = 'room' | 'school' | 'field' | 'season';

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
  { icon, title, detail, onClick, selected = false, disabled = false, glow = false }:
  {
    icon: ReactNode; title: string; detail: string;
    onClick?: () => void; selected?: boolean; disabled?: boolean;
    /** Lit as the final step of a guided errand. */
    glow?: boolean;
  },
) {
  return (
    <button
      className={`action-card${selected ? ' selected' : ''}${glow ? ' guide-glow' : ''}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="action-card-icon">{icon}</span>
      <span><strong>{title}</strong><small>{detail}</small></span>
      {selected ? <CheckIcon /> : <span />}
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
  const [area, setArea] = useState<Area>('room');
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
    <aside className={`player-actions-fab${open ? ' open' : ''}${phase === 'closing' ? ' closing' : ''}`}>
      <div className="player-actions-popover" aria-hidden={!open}>
        <div className="player-actions-popover-heading">
          <small>PLAYER ACTIONS</small>
          <strong>{p.name}</strong>
          <span>
            {hurtNow ? prognosis(p, clock)
              : sitting ? 'Redshirted. This season does not count against him.'
                : `${feeling.toUpperCase()} · he ${promiseOf(p, rank)}.`}
          </span>
        </div>

        <Segmented
          label="Player action area"
          value={area}
          glow={guiding && open && area !== 'school' ? 'school' : undefined}
          onChange={setArea}
          options={[
            { value: 'room', label: 'Room' },
            { value: 'school', label: 'School' },
            ...(p.type === 'hitter' ? [{ value: 'field' as const, label: 'Field' }] : []),
            { value: 'season', label: 'Season' },
          ]}
        />

        {area === 'room' && (
          <div className="action-popover-group">
            <small>THE CLUBHOUSE</small>
            <div className="action-list">
              <ActionCard
                icon={<StopwatchIcon />}
                title={resting ? 'He is already sitting' : 'Give him three days'}
                detail={hurtNow
                  ? prognosis(p, clock)
                  : tired > 0.35
                    ? 'He has played a great many days in a row. Take the miles out of his legs.'
                    : 'Rest is for a man who needs it. His legs are fine.'}
                selected={resting}
                disabled={hurtNow || resting || tired <= 0.35 || !mine}
                onClick={() => restMan(p.id, 3)}
              />
            </div>
            {/*
              Why there is nothing to press. Reported: 'opened the action
              button in the room, but it didn't give me an option to rest the
              player' -- he was hurt, and a hurt man cannot be rested into
              health. The card above was also unreadable at the time, so the
              reason was invisible; now it is readable AND said outright.
            */}
            {hurtNow && (
              <FieldNote
                title="The trainer owns this one"
                text={`${prognosis(p, clock)} Rest will not speed it up —
                  the depth chart decides who covers him while he heals.`}
              />
            )}
            {!mine && !hurtNow && (
              <FieldNote
                title="Your staff handles this"
                text="You asked for a desk that does not decide who sits. Rest and redshirts are theirs; the lineup is still yours."
              />
            )}
          </div>
        )}

        {area === 'school' && (
          <div className="action-popover-group">
            <small>THE CLASSROOM</small>
            <div className="action-list">
              <ActionCard
                icon={<EnvelopeClosedIcon />}
                title={wordsLeft > 0 ? 'Have a word' : 'No words left this season'}
                detail={school === 'fine'
                  ? SCHOOL_WORDS.fine.line
                  : `${SCHOOL_WORDS[school].line} ${wordsLeft} of ${WORDS_A_SEASON} conversations left.`}
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
            <FieldNote
              title={SCHOOL_WORDS[school].label}
              text={suspended
                ? 'He is sitting out this week.'
                : SCHOOL_WORDS[school].line}
            />
          </div>
        )}

        {area === 'field' && p.type === 'hitter' && (
          <div className="action-popover-group">
            <small>WHERE ELSE HE PLAYS</small>
            <div className="action-list">
              <ActionCard
                icon={<ReloadIcon />}
                title={target ? `List him at ${target}` : 'Change his position'}
                detail={alsoPlays.length === 0
                  ? 'There is nowhere else he can stand.'
                  : target
                    ? `Move him from ${p.pos} to ${target} for good. He will learn the new spot over time.`
                    : 'Pick a spot below. This is permanent, not a lineup change.'}
                selected={target !== null}
                disabled={target === null}
                onClick={() => { changePosition(p.id, target as Position); setTarget(null); }}
              />
              {alsoPlays.length > 0 && (
                <div className="position-picker">
                  <small>LIST HIM AT</small>
                  {alsoPlays.map((spot) => (
                    <button
                      className={target === spot ? 'active' : ''}
                      key={spot}
                      type="button"
                      onClick={() => setTarget(target === spot ? null : spot as Position)}
                    >{spot}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {area === 'season' && (
          <div className="action-popover-group">
            <small>ELIGIBILITY</small>
            <div className="action-list">
              <ActionCard
                icon={<CalendarIcon />}
                title={sitting ? 'Play him after all' : 'Redshirt him'}
                detail={sitting
                  ? 'Undo the preseason eligibility decision.'
                  : preseason
                    ? `Preseason only. One appearance burns the season. ${redshirtCount(team)} of ${MAX_REDSHIRTS} used.`
                    : 'Redshirts are set before the first pitch of the season, and it has been thrown.'}
                selected={sitting}
                disabled={!canSit && !sitting}
                onClick={() => setRedshirt(p.id, !sitting)}
              />
            </div>
            {!preseason && !sitting && (
              <FieldNote
                title="February only"
                text="A redshirt is a decision made before the first pitch of the year. After that the season is spent whether he plays again or not."
              />
            )}
          </div>
        )}
      </div>

      <button
        className={`player-actions-trigger${guiding && !open ? ' guide-glow' : ''}`}
        type="button"
        aria-label={open ? 'Close player actions' : 'Player actions'}
        aria-expanded={open}
        onClick={() => (open ? requestClose() : setPhase('open'))}
      >
        {open ? <Cross1Icon /> : <MixerHorizontalIcon />}
      </button>
      <span className="player-actions-status" aria-hidden="true">{statusLabel}</span>
    </aside>
    </>,
    host,
  );
}
