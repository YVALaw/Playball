// RetrainModal.tsx
// Where a man could play, and the odds a winter makes him a natural there.
//
// One sheet, two doors: the Positions row on another program's card, and the
// Position decision on your own. Every row says the two numbers a coach weighs
// — how he would rate there today, and the chance the move sticks — with their
// names on them. The move is permanent, so it takes two presses: in the winter
// it is made at once, and during the season it is written down for the roll
// and can be taken back until then.

import { useDynasty } from '../state/store.js';
import { coverTier, fieldingAt, naturalPos, retrainOdds, retrainablePositions } from '../engine/positions.js';
import { overallOf } from '../engine/ratings.js';
import { promiseSpent } from '../engine/morale.js';
import type { Hitter, Position } from '../engine/types.js';
import {
  Button, ConfirmButton, EmptyState, List, ListRow, Sheet, StatusBadge, Tag,
} from './components/ui/index.js';
import { POSITION_NAME } from './words.js';

const posName = (pos: string): string => POSITION_NAME[pos as Position] ?? pos;

/**
 * The man as he stands at his own spot, which is where every position line
 * reads him from: `homePos` while a cover or the DH has relabelled him, and
 * for a bat-first man the spot his glove says he is, the way his card's header
 * names him. Never tonight's label. A first baseman who was the DH tonight
 * read "First base, also covers right and first": the covers, and the moves
 * this sheet offered, were those of the outfield spot the DH label guessed.
 */
export function ownSpot(p: Hitter): Hitter {
  const home = naturalPos(p.homePos ? { ...p, pos: p.homePos } : p);
  return home === p.pos ? p : { ...p, pos: home };
}

export function RetrainSheet(
  { p, canMove, onClose }: { p: Hitter; canMove: boolean; onClose: () => void },
) {
  const changePosition = useDynasty((s) => s.changePosition);
  const winter = useDynasty((s) => s.phase) !== null;
  // A plan written on the man re-renders the sheet through the version.
  const version = useDynasty((s) => s.version);
  void version;
  const planned = (p as Hitter & { retrainTo?: Position }).retrainTo;
  const promise = !promiseSpent(p.recruitPromise) ? p.recruitPromise : undefined;
  const promisedPos = promise?.kind === 'keepPosition' ? promise.promisedPos : undefined;
  // From his own spot, the list included. See `ownSpot`.
  const own = ownSpot(p);
  const home = own.pos;
  const spots = retrainablePositions(own);

  const how = !canMove
    ? 'What a winter could make of him, if he were yours to move.'
    : winter
      ? 'A move is permanent. He learns the new spot over the winter and opens next season there, a step behind until it takes.'
      : planned
        ? `Planned: he finishes the season at ${posName(home).toLowerCase()} and moves to ${posName(planned).toLowerCase()} when it ends. You can cancel or change the plan until then.`
        : 'A move is permanent. Choose now and it happens when the season ends: he learns the new spot over the winter.';

  return (
    <Sheet eyebrow={p.name} title="Positions" subtitle={how} onClose={onClose} tall>
      <List label="Positions he could play">
        <ListRow
          icon="check-circled"
          title={posName(home)}
          subtitle={`His own spot · rating there ${overallOf(own)}`}
          status={<Tag>Current</Tag>}
        />
        {spots.map((spot) => {
          const odds = Math.round(retrainOdds(own, spot) * 100);
          const tier = coverTier(own, spot);
          const plays = overallOf(fieldingAt(own, spot));
          const breaks = promisedPos !== undefined && spot !== promisedPos;
          const isPlan = planned === spot;
          return (
            <ListRow
              key={spot}
              icon="swap"
              markTone={tier >= 2 ? 'warning' : undefined}
              title={posName(spot)}
              subtitle={`Rating there today: ${plays} · Chance it sticks: ${odds}%`}
              status={(
                <>
                  <Tag tone={tier >= 2 ? 'warning' : undefined}>{tier === 1 ? 'Natural cover' : 'A stretch'}</Tag>
                  {isPlan && <StatusBadge tone="info" icon="calendar">Planned for the offseason</StatusBadge>}
                  {breaks && <StatusBadge tone="warning">Breaks your position promise</StatusBadge>}
                </>
              )}
            >
              {canMove && (winter ? (
                <ConfirmButton
                  size="sm"
                  variant={breaks ? 'danger' : 'secondary'}
                  idle={`Move to ${posName(spot).toLowerCase()}`}
                  armed="Tap again to move him"
                  armedMeta="Permanent"
                  onConfirm={() => {
                    const ok = changePosition(p.id, spot);
                    if (ok) onClose();
                    return ok;
                  }}
                />
              ) : isPlan ? (
                <Button size="sm" variant="quiet" icon="cross" onClick={() => changePosition(p.id, spot)}>
                  Cancel the plan
                </Button>
              ) : (
                <ConfirmButton
                  size="sm"
                  variant={breaks ? 'danger' : 'secondary'}
                  idle="Move at season's end"
                  armed="Tap again to plan the move"
                  armedMeta={planned ? `Replaces ${posName(planned).toLowerCase()}` : 'Permanent'}
                  onConfirm={() => changePosition(p.id, spot)}
                />
              ))}
            </ListRow>
          );
        })}
      </List>
      {spots.length === 0 && (
        <EmptyState icon="info" title="Nowhere else to train him" text="There is no realistic spot for him to learn." />
      )}
    </Sheet>
  );
}

/** The old name, for the doors that still use it. */
export const RetrainModal = RetrainSheet;
