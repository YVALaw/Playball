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
import { TrashIcon } from '@radix-ui/react-icons';
import { AUTOSAVE_SLOT, useDynasty, useUserTeam } from '../../state/store.js';
import type { SaveSummary } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { ModuleIntro } from '../components/Kit.js';
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
type Ask = { kind: 'delete'; save: SaveSummary };

export function Saves() {
  const saves = useDynasty((s) => s.saves);
  const savesState = useDynasty((s) => s.savesState);
  const savesError = useDynasty((s) => s.savesError);
  const refreshSaves = useDynasty((s) => s.refreshSaves);
  const saveAs = useDynasty((s) => s.saveAs);
  const deleteSlot = useDynasty((s) => s.deleteSlot);
  const loadSlot = useDynasty((s) => s.loadSlot);
  const saveState = useDynasty((s) => s.saveState);
  const lastSaveError = useDynasty((s) => s.lastSaveError);
  const loadError = useDynasty((s) => s.loadError);
  const year = useDynasty((s) => s.year);
  const team = useUserTeam();

  const [name, setName] = useState('');
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
    void deleteSlot(save.slot);
  };

  return (
    <FixedHeader header={
      <ModuleIntro kicker={blocked
              ? 'STORAGE UNAVAILABLE'
              : `${saves.length} DYNAST${saves.length === 1 ? 'Y' : 'IES'} ON THIS DEVICE`} title="Saves" />
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
            Another tab may have Playball open, or site data is blocked here.
            You can keep playing, but nothing saves until this clears.
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
            Everything since is still on screen — just not on disk.
          </Notice>
        )}

        {loadError && (
          <Notice title="A save would not open" detail={loadError}>
            Usually a save from a newer build of the game. It will open again
            in the build that wrote it.
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
              marginTop: 5, font: "400 calc(11.5px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
            }}>
              {team.def.school}, {year}, {team.w}-{team.l} — under a name of your own.
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${team.def.school} ${year}`}
              maxLength={32}
              style={{
                width: '100%', marginTop: 9, padding: '11px 10px',
                background: 'var(--field)',
                border: '1px solid rgba(var(--ink-rgb), .28)', borderRadius: 0,
                // 16px floor: anything smaller makes a phone browser zoom in on
                // focus and stay zoomed. Same fix as the coach name input.
                color: 'var(--ink)', font: "400 calc(16px * var(--ts)) var(--body)",
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
                color: 'var(--cream)', font: "700 calc(11px * var(--ts)) var(--mono)", letterSpacing: '.12em',
                opacity: saveState === 'saving' ? 0.6 : 1,
              }}
            >{saveState === 'saving' ? 'SAVING…' : 'SAVE A COPY'}</button>
          </div>
        )}

        {/* ------------------------------------------------------------------
            The list.
        */}
        {!blocked && (
          <div className="save-list-heading">
            <span className="label">ON THIS DEVICE</span>
            <small>Tap the trash on one career to remove only that save.</small>
          </div>
        )}

        {!blocked && saves.length === 0 && savesState !== 'loading' && (
          <div style={{ padding: '18px 4px 6px', textAlign: 'center' }}>
            <div className="label">NOTHING SAVED YET</div>
            <div style={{
              maxWidth: 270, margin: '8px auto 0',
              font: "400 calc(12px * var(--ts))/1.6 var(--body)", color: 'var(--dim)',
            }}>
              The game saves on its own. Copies land here too.
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
            onLoad={() => { void loadSlot(s.slot); }}
            onDelete={() => setAsk({ kind: 'delete', save: s })}
          />
        ))}

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
              ? 'This is the career you are playing. Deleting it closes the career and stands you back at the front door.'
              : 'There is no second copy of this dynasty and no way back to it once it is gone.',
          ]}
          cancel={{ label: 'KEEP IT', onClick: () => setAsk(null) }}
          action="DELETE IT"
          onClose={() => confirmDelete(ask.save)}
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
  { save, now, onLoad, onDelete }:
  {
    save: SaveSummary;
    now: number;
    onLoad: () => void;
    onDelete: () => void;
  },
) {
  const auto = save.slot === AUTOSAVE_SLOT;
  const meta = save.name.trim().toUpperCase() === save.school.toUpperCase()
    ? `${save.year} · ${save.record}`
    : `${save.school} · ${save.year} · ${save.record}`;

  return (
    <article className="save-file-card card-in">
      <button className="save-file-open tap" type="button" onClick={onLoad}>
        <span className="save-file-mark">{auto ? 'AUTO' : 'SAVE'}</span>
        <span className="save-file-copy">
          {auto && <small>AUTOSAVE · CAREER IN PROGRESS</small>}
          <strong>{save.name}</strong>
          <em>{meta}</em>
          <span>Saved {agoLabel(save.savedAt, now)}</span>
        </span>
        <b>LOAD</b>
      </button>
      <button
        className="save-file-trash tap"
        type="button"
        aria-label={`Delete ${save.name}`}
        title={`Delete ${save.name}`}
        onClick={onDelete}
      ><TrashIcon /></button>
    </article>
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
      <div style={{ font: "700 calc(13px * var(--ts))/1.3 var(--body)" }}>{title}</div>
      <div style={{
        marginTop: 5, font: "400 calc(11.5px * var(--ts))/1.55 var(--body)", color: 'var(--dim)',
      }}>{children}</div>
      {detail && (
        <div style={{
          marginTop: 6, font: "400 calc(9.5px * var(--ts))/1.5 var(--mono)", color: 'var(--dim)',
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
            color: 'var(--clay)', font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.12em',
          }}
        >{action.label}</button>
      )}
    </div>
  );
}
