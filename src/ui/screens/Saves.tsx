// Saves.tsx
// Every career on this device, and what you can do with one: open it, keep a
// copy under a name of your own, or delete it.
//
// The copy matters most in practice. It is how you keep a program as it stands
// the week before a decision you are not sure about, which is as true of
// somebody testing the game as of somebody playing it. Deleting asks twice,
// and says plainly when the save is the career you are playing.

import { isNativeShell } from '../backNav.js';
import { useEffect, useState } from 'react';
import { AUTOSAVE_SLOT, useDynasty, useUserTeam } from '../../state/store.js';
import type { SaveSummary } from '../../state/store.js';
import { Modal } from '../Modal.js';
import {
  Button, Callout, Card, EmptyState, IconButton, List, ListRow, Marquee, SectionHeader, StatusBadge,
  TextField,
} from '../components/ui/index.js';
import { plural } from '../words.js';

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
  // The engine mutates in place; with Screen memoised this is what redraws it (M50).
  useDynasty((s) => s.version);
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
  const backupFor = useDynasty((s) => s.backupFor);
  const loadedSlot = useDynasty((s) => s.loadedSlot);
  const year = useDynasty((s) => s.year);
  const team = useUserTeam();

  const [name, setName] = useState('');
  const [ask, setAsk] = useState<Ask | null>(null);
  // Re-read on a timer so "just now" does not still say "just now" an hour
  // later.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { void refreshSaves(); }, [refreshSaves]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const blocked = savesState === 'error';
  const saving = saveState === 'saving';
  const fallbackName = team ? `${team.def.school} ${year}` : '';

  // The store's own rule for a delete that closes the career: the autosave, or
  // the file this career was opened from.
  const closesCareer = (save: SaveSummary): boolean =>
    !!team && (save.slot === AUTOSAVE_SLOT || save.slot === loadedSlot);

  const confirmDelete = (save: SaveSummary): void => {
    setAsk(null);
    void deleteSlot(save.slot);
  };

  return (
    <main className="pb-page">
      <Marquee
        eyebrow={blocked ? 'Storage unavailable' : `${plural(saves.length, 'career')} on this device`}
        title="Saved careers"
      />

      {/*
        Three different things can be wrong here, with three different answers:
        the browser will not store anything at all, the last write failed, or
        one save refused to open.
      */}
      {blocked && (
        <Callout
          tone="negative"
          role="alert"
          title={isNativeShell() ? 'The game cannot reach its storage on this device' : 'This browser will not let the game store anything'}
          action={{ label: 'Try again', onClick: () => { void refreshSaves(); } }}
        >
          {isNativeShell() ? 'Nothing saves until this clears.' : 'Another tab may have Playball open. Nothing saves until this clears.'}
          {savesError && <span className="pb-errdetail">{savesError}</span>}
        </Callout>
      )}

      {saveState === 'error' && (
        <Callout
          tone="warning"
          role="alert"
          title="The last save did not go through"
          action={team ? { label: 'Try again', onClick: () => { void useDynasty.getState().saveNow(); } } : undefined}
        >
          Everything since is still on screen, just not stored.
          {lastSaveError && <span className="pb-errdetail">{lastSaveError}</span>}
        </Callout>
      )}

      {loadError && (
        <Callout
          tone="warning"
          title="A save would not open"
          {...(backupFor ? { action: {
            label: `Open the copy from ${new Date(backupFor.savedAt).toLocaleString()}`,
            onClick: () => { void useDynasty.getState().loadBackup(backupFor.slot); },
          } } : {})}
        >
          {/* The same reading of the error the start screen gives (audit 17, L36). */}
          {backupFor ? 'An earlier copy of it is kept.'
            : /newer version|schema/i.test(loadError) ? 'It was saved by a newer version.' : 'The file could not be read.'} Nothing was deleted.
          <span className="pb-errdetail">{loadError}</span>
        </Callout>
      )}

      {/* First, because it is what you come here to do before a decision. */}
      {team && !blocked && (
        <Card eyebrow="Keep a copy" title="Save a copy of this career">
          <p className="pb-text-muted">
            {team.def.school}, {year} season, {team.w}–{team.l}.
          </p>
          <TextField
            label="Name for the copy"
            value={name}
            placeholder={fallbackName}
            maxLength={32}
            hint={name ? `${32 - name.length} characters left` : `Left empty, it is called “${fallbackName}”.`}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            variant="primary"
            block
            icon="download"
            disabled={saving}
            onClick={() => {
              void saveAs(name.trim() || fallbackName);
              setName('');
            }}
          >{saving ? 'Saving…' : 'Save a copy'}</Button>
        </Card>
      )}

      {!blocked && (
        <section>
          <SectionHeader title="On this device" count={saves.length || undefined} />
          {savesState === 'loading' && saves.length === 0 ? (
            <EmptyState icon="clock" title="Reading your saves…" />
          ) : saves.length === 0 ? (
            <EmptyState icon="archive" title="Nothing saved yet" text="The game saves on its own as you play. Copies land here too." />
          ) : (
            <List label="Saved careers">
              {saves.map((s) => (
                <SaveRow
                  key={s.slot}
                  save={s}
                  now={now}
                  playing={!!team && s.slot === (loadedSlot ?? AUTOSAVE_SLOT)}
                  onLoad={() => { void loadSlot(s.slot); }}
                  onDelete={() => setAsk({ kind: 'delete', save: s })}
                />
              ))}
            </List>
          )}
        </section>
      )}

      {ask?.kind === 'delete' && (
        <Modal
          kicker={closesCareer(ask.save) ? 'This closes your career' : 'Delete for good'}
          title={`Delete “${ask.save.name}”?`}
          tone="clay"
          lines={[
            `${ask.save.school} · ${ask.save.year} season · ${ask.save.record} · saved ${agoLabel(ask.save.savedAt, now)}.`,
            closesCareer(ask.save)
              // Legitimate (you may be clearing a device), but almost never what
              // somebody in the middle of a season means, so it says why.
              ? 'This is the save the career you are playing writes to. Deleting it closes the career and takes you back to the start screen.'
              : 'There is no other copy of this career, and no way back to it once it is gone.',
          ]}
          cancel={{ label: 'Keep it', onClick: () => setAsk(null) }}
          action="Delete it"
          onClose={() => confirmDelete(ask.save)}
        />
      )}
    </main>
  );
}

/**
 * One career on the list: its name, where and when it stands, and a delete
 * that sits apart from the row's own tap.
 */
function SaveRow(
  { save, now, playing, onLoad, onDelete }:
  {
    save: SaveSummary;
    now: number;
    /** The save the open career writes to. */
    playing: boolean;
    onLoad: () => void;
    onDelete: () => void;
  },
) {
  const auto = save.slot === AUTOSAVE_SLOT;
  // A finished career reads as the man and his record, not the school's next
  // season at nought.
  const where = save.retired
    ? `${save.retired.coach} · ${save.retired.record} · retired ${save.retired.year}`
    : save.name.trim().toUpperCase() === save.school.toUpperCase()
      ? `${save.year} season · ${save.record}`
      : `${save.school} · ${save.year} season · ${save.record}`;
  return (
    <div className="pb-saverow">
      <ListRow
        icon={auto ? 'reset' : 'archive'}
        title={save.name}
        subtitle={`${where} · saved ${agoLabel(save.savedAt, now)}`}
        status={save.retired
          ? <StatusBadge tone="neutral" icon="star">Finished</StatusBadge>
          : playing
            ? <StatusBadge tone="positive">Playing now</StatusBadge>
            : save.sandbox ? <StatusBadge tone="neutral" icon={false}>Sandbox</StatusBadge>
              : auto ? <StatusBadge tone="neutral" icon={false}>Autosave</StatusBadge> : undefined}
        onClick={onLoad}
      />
      <IconButton icon="trash" label={`Delete ${save.name}`} tone="quiet" className="pb-saverow__delete" onClick={onDelete} />
    </div>
  );
}
