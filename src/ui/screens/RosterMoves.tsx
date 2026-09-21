// RosterMoves.tsx
// Decisions: what a coach can do about one of his own men, in plain sight.
//
// This used to be a floating Manage button that opened a dark panel. Now it is
// a section of the player card, one row per decision, and every row answers
// the same three questions: what it is about, how he stands on it right now,
// and what you can do (or why you can't). Only ever for your own men.
//
// Every action writes to the store the engine reads: a rest sits him for three
// days, a talk spends one of the season's four, a redshirt keeps a year of
// eligibility, and a position change is permanent. The last three are
// two-press buttons, because they spend something you cannot get back.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { handles } from '../../state/depth.js';
import { standing, WORDS_A_SEASON } from '../../engine/eligibility.js';
import { canRedshirt, MAX_REDSHIRTS, redshirtCount } from '../../engine/redshirt.js';
import { retrainablePositions, secondaryPositions } from '../../engine/positions.js';
import { injuryClock } from '../../engine/season.js';
import { isHurt, prognosis } from '../../engine/injury.js';
import { legWeariness } from '../../engine/workload.js';
import { promiseSpent } from '../../engine/morale.js';
import { naturalPos } from '../../engine/ratings.js';
import { RetrainSheet } from '../RetrainModal.js';
import { whyOut } from '../Needs.js';
import type { Hitter, Player as AnyPlayer, Position } from '../../engine/types.js';
import {
  Button, ConfirmButton, List, ListRow, SectionHeader, StatusBadge,
} from '../components/ui/index.js';
import { POSITION_NAME, plural, sentence } from '../words.js';

const posName = (pos: string): string => POSITION_NAME[pos as Position] ?? pos;

const GRADES: Record<'fine' | 'watch' | 'trouble', { tone: 'positive' | 'warning' | 'negative'; label: string; line: string }> = {
  fine: { tone: 'positive', label: 'Good standing', line: 'Nothing to address.' },
  watch: { tone: 'warning', label: 'On the watch list', line: 'Close to the line: one bad week from missing games.' },
  trouble: { tone: 'negative', label: 'Failing', line: 'Short of eligible. He will start missing weeks.' },
};

export function RosterMoves({ p, isOurs }: { p: AnyPlayer; isOurs: boolean }) {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const wordsUsed = useDynasty((s) => s.wordsUsed);
  const wordWith = useDynasty((s) => s.wordWith);
  const setRedshirt = useDynasty((s) => s.setRedshirt);
  const restMan = useDynasty((s) => s.restMan);
  const winter = useDynasty((s) => s.phase) !== null;
  const version = useDynasty((s) => s.version);
  // A career that asked its staff to decide who sits does not get these buttons.
  const mine = useDynasty((s) => handles(s.depth, 'redshirts'));
  // The first-season errand for a failing man: the tour lights Have a word,
  // and the press itself stamps the lesson as learned.
  const guiding = useDynasty((s) => s.guide === 'word');
  const clearGuide = useDynasty((s) => s.clearGuide);
  const markTutorialSeen = useDynasty((s) => s.markTutorialSeen);
  const [retrainOpen, setRetrainOpen] = useState(false);
  void version;

  if (!isOurs || !season) return null;
  const team = season.teams[userTeam]?.team;
  if (!team) return null;

  const clock = injuryClock(season);
  const school = standing(p);
  const promise = !promiseSpent(p.recruitPromise) ? p.recruitPromise : undefined;
  const redshirtConflict = promise?.kind === 'noRedshirt';
  const sitting = (p as AnyPlayer & { redshirt?: boolean }).redshirt === true;
  const outUntil = (p as AnyPlayer & { outUntil?: number }).outUntil;
  const why = (p as AnyPlayer & { why?: string }).why;
  const suspended = typeof outUntil === 'number' && clock < outUntil;
  const wordsLeft = WORDS_A_SEASON - wordsUsed;
  // One appearance burns the season, so this is only a decision before the
  // first pitch of the year.
  const preseason = season.dayIndex === 0;
  const used = redshirtCount(team);
  const canSit = preseason && mine && canRedshirt(p) && used < MAX_REDSHIRTS;

  const hurtNow = isHurt(p, clock);
  const tired = legWeariness(p);
  const workload = Math.round(tired * 100);
  const academicHold = !hurtNow && suspended && why === 'academic';
  const resting = !hurtNow && suspended && why !== 'academic';
  const needsRest = tired > 0.35;

  const isHitter = p.type === 'hitter';
  const alsoPlays = isHitter ? retrainablePositions(p as Hitter) : [];
  const home = isHitter ? ((p as Hitter & { homePos?: Position }).homePos ?? naturalPos(p as Hitter)) : null;
  const covers = isHitter ? secondaryPositions(p as Hitter).slice(0, 2) : [];
  const planned = (p as Hitter & { retrainTo?: Position }).retrainTo;

  /* ------------------------------------------------------------ workload */
  const restBadge = hurtNow
    ? <StatusBadge tone="negative">Injured · {prognosis(p, clock)}</StatusBadge>
    : academicHold
      ? <StatusBadge tone="warning" icon="reader">Academic hold</StatusBadge>
      : resting
        ? <StatusBadge tone="info" icon="clock">{sentence(whyOut(p, clock))}</StatusBadge>
        : needsRest
          ? <StatusBadge tone="warning">Tired legs</StatusBadge>
          : <StatusBadge tone="positive">Fresh</StatusBadge>;
  const restLine = hurtNow
    ? 'Rest does not shorten an injury. The trainer decides when he is back.'
    : academicHold
      ? `He is ${whyOut(p, clock)}.`
      : resting
        ? 'He is already sitting.'
        : !mine
          ? 'Your staff decides who rests.'
          : needsRest
            ? 'Three days off takes the wear out of his legs.'
            : 'Nothing to gain from sitting him.';

  /* ------------------------------------------------------------- redshirt */
  const redshirtBadge = sitting
    ? <StatusBadge tone="neutral" icon="pause">Redshirted this season</StatusBadge>
    : !mine
      ? <StatusBadge tone="neutral" icon="lock">Your staff decides</StatusBadge>
      : !preseason
        ? <StatusBadge tone="neutral" icon="lock">Only before the first game</StatusBadge>
        : used >= MAX_REDSHIRTS
          ? <StatusBadge tone="neutral" icon="lock">All {MAX_REDSHIRTS} used</StatusBadge>
          : !canRedshirt(p)
            ? <StatusBadge tone="neutral" icon="lock">Not eligible</StatusBadge>
            : null;

  return (
    <section className="pb-decisions" aria-label="Decisions">
      <SectionHeader title="Decisions" />
      <List label="Decisions">
        {/* An arm's rest is the rotation's business, and his legs never tire,
            so the row only appears for a pitcher when something has him out. */}
        {(p.type !== 'pitcher' || hurtNow || suspended) && (
          <ListRow
            icon="stopwatch"
            title="Workload"
            subtitle={p.type === 'pitcher' ? restLine : `${workload} of 100 · ${restLine}`}
            status={restBadge}
          >
            {mine && !hurtNow && !suspended && needsRest && (
              <Button size="sm" variant="secondary" icon="pause" onClick={() => restMan(p.id, 3)}>Rest him 3 days</Button>
            )}
          </ListRow>
        )}

        <ListRow
          icon="reader"
          title="Grades"
          subtitle={`${GRADES[school].line}${academicHold ? ' He is missing games right now.' : ''} ${wordsLeft} of ${WORDS_A_SEASON} talks left this season.`}
          status={(
            <>
              <StatusBadge tone={GRADES[school].tone}>{GRADES[school].label}</StatusBadge>
              {school !== 'fine' && wordsLeft <= 0 && <StatusBadge tone="neutral" icon="lock">No talks left</StatusBadge>}
            </>
          )}
        >
          {school !== 'fine' && wordsLeft > 0 && (
            <ConfirmButton
              size="sm"
              variant="secondary"
              icon="chat"
              guide="have-a-word"
              idle="Have a word"
              armed="Tap again to talk to him"
              armedMeta={`${wordsLeft - 1} of ${WORDS_A_SEASON} left after`}
              done="You talked to him"
              onConfirm={() => {
                const ok = wordWith(p.id);
                if (ok && guiding) {
                  markTutorialSeen('guide:word');
                  clearGuide();
                }
                return ok;
              }}
            />
          )}
        </ListRow>

        {isHitter && home && (
          <ListRow
            icon="swap"
            title="Position"
            subtitle={alsoPlays.length === 0
              ? `${posName(home)} · there is no realistic spot to train him for.`
              : `${posName(home)}${covers.length ? `, also covers ${covers.map((c) => posName(c).toLowerCase()).join(' and ')}` : ''} · ${plural(alsoPlays.length, 'spot')} he could learn, with the odds.`}
            status={planned
              ? <StatusBadge tone="info" icon="calendar">Moving to {posName(planned).toLowerCase()} {winter ? 'now' : 'after the season'}</StatusBadge>
              : undefined}
            onClick={alsoPlays.length > 0 ? () => setRetrainOpen(true) : undefined}
          />
        )}

        <ListRow
          icon="pause"
          title="Redshirt"
          subtitle={sitting
            ? 'He sits out the season and keeps the year of eligibility.'
            : `Sit him out the season to keep a year of eligibility · ${used} of ${MAX_REDSHIRTS} used.${redshirtConflict ? ' You promised him no redshirt: breaking it hurts his mood and raises the chance he transfers.' : ''}`}
          status={redshirtBadge ?? undefined}
        >
          {sitting && (preseason ? (
            <Button size="sm" variant="secondary" icon="reset" onClick={() => setRedshirt(p.id, false)}>
              Put him back on the active roster
            </Button>
          ) : (
            <ConfirmButton
              size="sm"
              variant="secondary"
              icon="reset"
              idle="Put him back on the active roster"
              armed="Tap again to bring him back"
              armedMeta="He can play, and uses this year"
              onConfirm={() => setRedshirt(p.id, false)}
            />
          ))}
          {!sitting && canSit && (
            <ConfirmButton
              size="sm"
              variant={redshirtConflict ? 'danger' : 'secondary'}
              idle="Redshirt him this season"
              armed="Tap again to redshirt him"
              armedMeta={redshirtConflict ? 'Breaks your promise' : `${used + 1} of ${MAX_REDSHIRTS} used after`}
              onConfirm={() => setRedshirt(p.id, true)}
            />
          )}
        </ListRow>
      </List>
      {retrainOpen && isHitter && (
        <RetrainSheet p={p as Hitter} canMove onClose={() => setRetrainOpen(false)} />
      )}
    </section>
  );
}
