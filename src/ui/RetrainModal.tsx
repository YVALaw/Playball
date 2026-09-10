// RetrainModal.tsx
// Where a man could play, and the odds a winter makes him a natural there.
//
// One sheet, two doors: the POSITIONS row on the profile, always there, and
// the retrain card in the moves panel. Asked for 2026-09-10: "leave it there
// but open, so we can tap on it and it opens a modal showing us more
// information about the positions the player can play at." The move itself
// is the coach's, in the winter, on his own man; everybody else reads.

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
          : 'Moves happen over the offseason. This is what a winter could make of him.')
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
                    type="button" className="tap" disabled={!winter}
                    onClick={() => { changePosition(p.id, spot); onClose(); }}
                  >{breaks ? 'MOVE · BREAKS PROMISE' : 'MOVE'}</button>
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
