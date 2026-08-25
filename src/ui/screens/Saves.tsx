// Saves.tsx
// Every dynasty on this device, and the four things you can do with one.
//
// The save layer has been complete since v0.5 and nothing has ever called most
// of it: `listSaves` and `deleteSave` had no caller anywhere in the app, so a
// career meant the autosave and the autosave meant your one and only career.
// Starting a second dynasty quietly wrote over the first, which is a thing you
// only find out afterwards.
//
// So: a list, a load, a copy under a name of your own, and a delete that makes
// you say it twice. The copy is the one that matters most in practice — it is
// how you keep the state of a program the week before a decision you are not
// sure about, which is as true of somebody testing the game as of somebody
// playing it.

import { useEffect, useState } from 'react';
import { AUTOSAVE_SLOT, useDynasty, useUserTeam } from '../../state/store.js';
import type { SaveSummary } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { Modal } from '../Modal.js';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * When a save was written, in the terms somebody actually thinks in.
 *
 * A timestamp answers a question nobody asked. What the player is doing on this
 * screen is telling two dynasties apart, and "2 hours ago" separates them where
 * "14:32" needs him to remember what time he sat down. Elapsed time up to a day,
 * calendar days after that — the day boundary is what makes "yesterday" mean
 * yesterday rather than "some time in the last 24 hours" — and a plain date once
 * it is old enough that the number of days has stopped being informative.
 *
 * Exported for the tests, and because a clock that is subtly wrong about "just
 * now" is the sort of thing nobody notices until a save looks newer than it is.
 */
export function agoLabel(then: number, now = Date.now()): string {
  const seconds = Math.round((now - then) / 1000);
  // A clock that has been put back, or a save from a machine whose clock is
  // ahead. Neither is worth a special message; both are "you just did this".
  if (seconds < 45) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  // Past a day, count midnights rather than 24 hour blocks. Twenty five hours
  // is "yesterday" if it started yesterday morning and "2 days ago" if it
  // started the night before last, and the difference is which midnights it
  // crossed rather than how many hours it ran to.
  const days = midnightsBetween(then, now);
  if (days <= 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 28) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }

  const d = new Date(then);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  const stamp = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return sameYear ? `on ${stamp}` : `on ${stamp} ${d.getFullYear()}`;
}

function midnightsBetween(then: number, now: number): number {
  const a = new Date(then);
  const b = new Date(now);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** What the player has been asked to confirm, if anything. */
type Ask =
  | { kind: 'delete'; save: SaveSummary }
  | { kind: 'new' };

export function Saves() {
  const saves = useDynasty((s) => s.saves);
  const savesState = useDynasty((s) => s.savesState);
  const savesError = useDynasty((s) => s.savesError);
  const refreshSaves = useDynasty((s) => s.refreshSaves);
  const saveAs = useDynasty((s) => s.saveAs);
  const deleteSlot = useDynasty((s) => s.deleteSlot);
  const loadSlot = useDynasty((s) => s.loadSlot);
  const newDynasty = useDynasty((s) => s.newDynasty);
  const saveState = useDynasty((s) => s.saveState);
  const lastSaveError = useDynasty((s) => s.lastSaveError);
  const loadError = useDynasty((s) => s.loadError);
  const year = useDynasty((s) => s.year);
  const team = useUserTeam();

  const [name, setName] = useState('');
  /**
   * Delete is behind a mode rather than beside LOAD.
   *
   * Two buttons on a row, one of which loses a dynasty for ever, is a mis-tap
   * waiting to happen on a phone — and the mis-tap is not recoverable. While
   * this is off there is no delete control anywhere on the screen to hit by
   * accident; while it is on, the row offers delete *instead of* load, so the
   * two are never targets at the same time. The confirmation below is the
   * second gate, not the first.
   */
  const [removing, setRemoving] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);
  /**
   * Re-read on a timer so "just now" does not still say "just now" an hour
   * later. Cheap, and the alternative is a screen that quietly lies about how
   * old a save is for as long as it is left open.
   */
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { void refreshSaves(); }, [refreshSaves]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const blocked = savesState === 'error';

  const confirmDelete = (save: SaveSummary): void => {
    setAsk(null);
    setRemoving(false);
    void deleteSlot(save.slot);
  };

  return (
    <FixedHeader header={
      <div style={{ padding: '12px 14px 10px' }}>
        <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
          <div className="label">
            {blocked
              ? 'STORAGE UNAVAILABLE'
              : `${saves.length} DYNAST${saves.length === 1 ? 'Y' : 'IES'} ON THIS DEVICE`}
          </div>
          <div style={{
            font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
          }}>Saves</div>
        </div>
      </div>
    }>
      <div style={{ padding: '12px 14px 24px' }}>

        {/*
          Three different things can be wrong here and they have three different
          answers, so they are three different panels rather than one apologetic
          sentence: the browser will not give us storage at all, the last write
          failed, or a particular save refused to open.
        */}
        {blocked && (
          <Notice
            title="This browser will not let the game store anything"
            detail={savesError}
            action={{ label: 'TRY AGAIN', onClick: () => { void refreshSaves(); } }}
          >
            Usually that means another tab has Playball open, or site data is
            blocked for this address. The season on screen is real and you can
            keep playing it — but nothing can be saved or loaded until this
            clears, and closing the page will lose it.
          </Notice>
        )}

        {saveState === 'error' && (
          <Notice
            title="The last save did not go through"
            detail={lastSaveError}
            action={team ? {
              label: 'TRY AGAIN',
              onClick: () => { void useDynasty.getState().saveNow(); },
            } : undefined}
          >
            Everything you have done since is still here, on screen. It is not on
            disk.
          </Notice>
        )}

        {loadError && (
          <Notice title="A save would not open" detail={loadError}>
            Most often that is a dynasty written by a newer build of the game
            than this one, which cannot be read backwards. It is still on the
            list, and it will open again in the build that wrote it.
          </Notice>
        )}

        {/* ------------------------------------------------------------------
            Take a copy. First, because it is the thing you came here to do
            before a decision rather than after one.
        */}
        {team && !blocked && (
          <div style={{
            border: '1px solid var(--faint)', background: 'var(--paper)',
            padding: '11px 12px 12px', marginBottom: 16,
          }}>
            <div className="label">SAVE A COPY</div>
            <div style={{
              marginTop: 5, font: "400 11.5px/1.5 var(--body)", color: 'var(--dim)',
            }}>
              {team.def.school} as they stand right now — {year}, {team.w}-{team.l} —
              filed under a name of your own and left alone from then on. Take one
              before anything you might want to come back from.
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${team.def.school} ${year}`}
              maxLength={32}
              style={{
                width: '100%', marginTop: 9, padding: '11px 10px',
                background: 'var(--field)',
                border: '1px solid rgba(28,36,48,.28)', borderRadius: 0,
                color: 'var(--ink)', font: "400 14px var(--body)",
              }}
            />
            <button
              onClick={() => {
                void saveAs(name || `${team.def.school} ${year}`);
                setName('');
              }}
              disabled={saveState === 'saving'}
              className="tap"
              style={{
                width: '100%', marginTop: 8, padding: '12px 10px',
                background: 'var(--clay)', border: '1px solid var(--clay)',
                color: 'var(--cream)', font: "700 11px var(--mono)", letterSpacing: '.12em',
                opacity: saveState === 'saving' ? 0.6 : 1,
              }}
            >{saveState === 'saving' ? 'SAVING…' : 'SAVE A COPY'}</button>
          </div>
        )}

        {/* ------------------------------------------------------------------
            The list.
        */}
        {!blocked && (
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            borderBottom: '1px solid var(--faint)', paddingBottom: 5, marginBottom: 10,
          }}>
            <span className="label">ON THIS DEVICE</span>
            {saves.length > 0 && (
              <button
                onClick={() => setRemoving(!removing)}
                className="tap"
                style={{
                  // Quiet, but not so quiet it is fiddly to hit on purpose.
                  padding: '7px 11px', background: 'transparent',
                  border: `1px solid ${removing ? 'var(--clay)' : 'var(--faint)'}`,
                  color: removing ? 'var(--clay)' : 'var(--dim)',
                  font: "700 8.5px var(--mono)", letterSpacing: '.12em',
                }}
              >{removing ? 'DONE' : 'DELETE…'}</button>
            )}
          </div>
        )}

        {!blocked && saves.length === 0 && savesState !== 'loading' && (
          <div style={{ padding: '18px 4px 6px', textAlign: 'center' }}>
            <div className="label">NOTHING SAVED YET</div>
            <div style={{
              maxWidth: 270, margin: '8px auto 0',
              font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
            }}>
              The game writes your career down on its own as you play, so this
              list fills itself. Copies you take by hand appear here too.
            </div>
          </div>
        )}

        {savesState === 'loading' && saves.length === 0 && (
          <div style={{ padding: '18px 4px', textAlign: 'center' }}>
            <span className="label">READING…</span>
          </div>
        )}

        {saves.map((s) => (
          <SaveRow
            key={s.slot}
            save={s}
            now={now}
            removing={removing}
            onLoad={() => { void loadSlot(s.slot); }}
            onDelete={() => setAsk({ kind: 'delete', save: s })}
          />
        ))}

        {/* ------------------------------------------------------------------
            And the way out of all of them. Down here, outlined rather than
            filled, and behind a confirmation: it is the only control on the
            screen that ends the career you are in the middle of.
        */}
        <div style={{
          marginTop: 22, paddingTop: 14, borderTop: '2px solid var(--ink)',
        }}>
          <div className="label">START AGAIN</div>
          <div style={{
            marginTop: 5, font: "400 11.5px/1.5 var(--body)", color: 'var(--dim)',
          }}>
            A new world, a new job and a coach of your own. The career you are in
            now keeps its place on the list above only if you have saved a copy of
            it — the autosave belongs to whichever dynasty is being played.
          </div>
          <button
            onClick={() => setAsk({ kind: 'new' })}
            className="tap"
            style={{
              width: '100%', marginTop: 10, padding: '13px 10px',
              background: 'transparent', border: '1px solid var(--ink)',
              color: 'var(--ink)', font: "700 11px var(--mono)", letterSpacing: '.12em',
            }}
          >NEW DYNASTY</button>
        </div>
      </div>

      {ask?.kind === 'delete' && (
        <Modal
          kicker={ask.save.slot === AUTOSAVE_SLOT ? 'THIS IS THE AUTOSAVE' : 'DELETE FOR GOOD'}
          title={ask.save.name}
          tone="clay"
          lines={[
            `${ask.save.school} · ${ask.save.year} · ${ask.save.record} · saved ${agoLabel(ask.save.savedAt, now)}.`,
            ask.save.slot === AUTOSAVE_SLOT
              // Deleting the autosave is legitimate — you may be clearing a
              // device — but it is almost never what somebody in the middle of a
              // season means to do, and the reason it is nearly useless there is
              // worth saying rather than leaving them to discover.
              ? 'This is the slot the game writes to on its own. If a career is being played, the next thing that happens in it writes a new one straight back — so deleting this only helps if you are about to load something else or start again.'
              : 'There is no second copy of this dynasty and no way back to it once it is gone.',
          ]}
          cancel={{ label: 'KEEP IT', onClick: () => setAsk(null) }}
          action="DELETE IT"
          onClose={() => confirmDelete(ask.save)}
        />
      )}

      {ask?.kind === 'new' && (
        <Modal
          kicker="START AGAIN"
          title="New dynasty"
          tone="clay"
          lines={[
            'A new world is built from scratch and takes over the autosave.',
            team
              ? `${team.def.school}, ${year}, ${team.w}-${team.l} — if you have not saved a copy of this career, it goes when the new one starts.`
              : 'Anything not saved to a slot of its own goes when the new one starts.',
          ]}
          cancel={{ label: 'NOT YET', onClick: () => setAsk(null) }}
          action="BUILD A NEW WORLD"
          onClose={() => { setAsk(null); newDynasty(); }}
        />
      )}
    </FixedHeader>
  );
}

/**
 * One dynasty on the list.
 *
 * The autosave wears its name on the row rather than being sorted somewhere
 * special: it is the same kind of object as the others and behaves like one, and
 * the only thing worth saying about it is which one it is.
 */
function SaveRow(
  { save, now, removing, onLoad, onDelete }:
  {
    save: SaveSummary;
    now: number;
    removing: boolean;
    onLoad: () => void;
    onDelete: () => void;
  },
) {
  const auto = save.slot === AUTOSAVE_SLOT;
  // The autosave is filed under the school, so printing both would print the
  // same words twice.
  const meta = save.name.trim().toUpperCase() === save.school.toUpperCase()
    ? `${save.year} · ${save.record}`
    : `${save.school} · ${save.year} · ${save.record}`;

  return (
    <div
      className="card-in"
      style={{
        border: '1px solid var(--faint)',
        borderLeft: removing ? '3px solid var(--clay)' : '1px solid var(--faint)',
        background: 'var(--paper)', marginBottom: 8,
      }}
    >
      <div style={{ padding: '10px 12px 9px' }}>
        {auto && (
          <div className="label" style={{ color: 'var(--clay)' }}>
            AUTOSAVE · THE CAREER IN PROGRESS
          </div>
        )}
        <div style={{
          font: "700 19px/1.05 var(--display)", marginTop: auto ? 3 : 0,
          textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{save.name}</div>
        <div style={{
          marginTop: 3, font: "400 10px var(--mono)", letterSpacing: '.06em',
          color: 'var(--dim)',
        }}>{meta}</div>
        <div style={{
          marginTop: 2, font: "400 11px var(--body)", color: 'var(--dim)',
        }}>saved {agoLabel(save.savedAt, now)}</div>
      </div>

      {removing ? (
        <button
          onClick={onDelete}
          className="tap"
          style={{
            width: '100%', padding: '11px 10px',
            background: 'transparent', borderTop: '1px solid var(--hairline)',
            color: 'var(--clay)', font: "700 10.5px var(--mono)", letterSpacing: '.14em',
          }}
        >DELETE…</button>
      ) : (
        <button
          onClick={onLoad}
          className="tap"
          style={{
            width: '100%', padding: '11px 10px',
            background: 'transparent', borderTop: '1px solid var(--hairline)',
            color: 'var(--ink)', font: "700 10.5px var(--mono)", letterSpacing: '.14em',
          }}
        >LOAD</button>
      )}
    </div>
  );
}

/** Something went wrong, said plainly, with whatever can be done about it. */
function Notice(
  { title, detail, action, children }:
  {
    title: string;
    detail?: string | null;
    action?: { label: string; onClick: () => void };
    children: React.ReactNode;
  },
) {
  return (
    <div style={{
      background: 'var(--paper)', borderLeft: '3px solid var(--clay)',
      padding: '10px 12px', marginBottom: 14,
    }}>
      <div style={{ font: "700 13px/1.3 var(--body)" }}>{title}</div>
      <div style={{
        marginTop: 5, font: "400 11.5px/1.55 var(--body)", color: 'var(--dim)',
      }}>{children}</div>
      {detail && (
        <div style={{
          marginTop: 6, font: "400 9.5px/1.5 var(--mono)", color: 'var(--dim)',
          overflowWrap: 'anywhere',
        }}>{detail}</div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="tap"
          style={{
            marginTop: 9, padding: '8px 14px',
            background: 'transparent', border: '1px solid var(--clay)',
            color: 'var(--clay)', font: "700 9.5px var(--mono)", letterSpacing: '.12em',
          }}
        >{action.label}</button>
      )}
    </div>
  );
}
