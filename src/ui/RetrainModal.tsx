// RetrainModal.tsx
// Where a man could play, and the odds a winter makes him a natural there.
//
// One sheet, two doors: the POSITIONS row on the profile, always there, and
// the retrain card in the moves panel. Asked for 2026-09-10: "leave it there
// but open, so we can tap on it and it opens a modal showing us more
// information about the positions the player can play at." The move itself
// is the coach's, on his own man, any day of the year -- made now in the
// winter, written down for the roll during the season (2026-09-16: "leave
// this button available all year round but the outcome of it happening is
// decided when the season ends"); everybody else reads.

import { Modal } from './Modal.js';
import { useDynasty } from '../state/store.js';
import { coverTier, fieldingAt, retrainOdds, retrainablePositions } from '../engine/positions.js';
import { overallOf } from '../engine/ratings.js';
import { promiseSpent } from '../engine/morale.js';
import type { Hitter } from '../engine/types.js';

export function RetrainModal(
  { p, canMove, onClose }: { p: Hitter; canMove: boolean; onClose: () => void },
) {
  const changePosition = useDynasty((s) => s.changePosition);
  const winter = useDynasty((s) => s.phase) !== null;
  // A plan written on the man re-renders the sheet through the version.
  const version = useDynasty((s) => s.version);
  void version;
  const planned = (p as Hitter & { retrainTo?: Hitter['pos'] }).retrainTo;
  const promise = !promiseSpent(p.recruitPromise) ? p.recruitPromise : undefined;
  const promisedPos = promise?.kind === 'keepPosition' ? promise.promisedPos : undefined;
  const spots = retrainablePositions(p);
  const home = (p as Hitter & { homePos?: Hitter['pos'] }).homePos ?? p.pos;
  const own = home === p.pos ? p : { ...p, pos: home };

  return (
    <Modal
      kicker="POSITIONS"
      title={`${p.name} · ${home}`}
      lines={[canMove
        ? (winter
          ? 'A move is permanent. He spends the winter learning the spot and opens next season there, a step behind until it takes.'
          : planned
            ? `Planned: he finishes the season at ${home} and moves to ${planned} when it ends. Tap the plan to cancel it, or another spot to change it.`
            : 'A move is permanent. Chosen now, it is made when the season ends: he spends the winter learning the spot and opens next season there, a step behind until it takes.')
        : 'What a winter could make of him, if he were yours to move.']}
      body={(
        <div className="retrain-list">
          <div className="retrain-row is-own">
            <span><b>{home}</b><small>his own spot · plays as {overallOf(own)}</small></span>
            <strong>—</strong>
            <i />
          </div>
          {spots.map((spot) => {
            const odds = retrainOdds(own, spot);
            const tier = coverTier(own, spot);
            const plays = overallOf(fieldingAt(own, spot));
            const breaks = promisedPos !== undefined && spot !== promisedPos;
            return (
              <div key={spot} className={`retrain-row${tier >= 2 ? ' is-stretch' : ''}`}>
                <span>
                  <b>{spot}</b>
                  <small>{tier === 1 ? 'natural cover' : 'a stretch'} · plays as {plays} today</small>
                </span>
                <strong>{Math.round(odds * 100)}%</strong>
                {canMove ? (
                  <button
                    type="button"
                    className={`tap${planned === spot ? ' is-planned' : ''}`}
                    // In the winter the move is made and the sheet closes; in
                    // season the plan is written and the sheet stays, showing
                    // it. It read IN THE WINTER, greyed, for eleven months.
                    onClick={() => { changePosition(p.id, spot); if (winter) onClose(); }}
                  >
                    {winter
                      ? (breaks ? 'MOVE · BREAKS PROMISE' : 'MOVE')
                      : planned === spot ? 'PLANNED · CANCEL'
                        : breaks ? 'AT SEASON\'S END · BREAKS PROMISE' : 'AT SEASON\'S END'}
                  </button>
                ) : <i />}
              </div>
            );
          })}
          {spots.length === 0 && <p>There is no realistic spot to train him for.</p>}
        </div>
      )}
      action="CLOSE"
      onClose={onClose}
    />
  );
}
