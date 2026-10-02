// Start.tsx
// The front door: carry on with the last career, start a new one, open
// another, or change the settings.
//
// The app opens here rather than inside the last career. Resuming the
// autosave the instant it booted left a player no moment to choose, and made a
// career impossible to leave except by deleting it — which did nothing, because
// the next tap wrote the autosave straight back. A career now has a place to be
// let go of: the door closes behind it and nothing is left running.
//
// One primary action: Resume when there is a career to resume, New career when
// there is not.

import { useEffect, useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { Button, Callout, Card, List, ListRow } from '../components/ui/index.js';
import { plural } from '../words.js';

/** How long ago, in the fewest words that are still true. */
function when(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${plural(hrs, 'hour')} ago`;
  const days = Math.round(hrs / 24);
  return `${plural(days, 'day')} ago`;
}

/** The game's mark: the cap on the plate, the same art as the launcher icon. */
const LOGO = new URL('../brand/logo.webp', import.meta.url).href;

function Mark() {
  return <img className="pb-start__mark" src={LOGO} alt="" draggable={false} decoding="async" />;
}

export function Start(
  { onNew, onLoad, onSettings }:
  { onNew: () => void; onLoad: () => void; onSettings: () => void },
) {
  const saves = useDynasty((s) => s.saves);
  const savesState = useDynasty((s) => s.savesState);
  const savesError = useDynasty((s) => s.savesError);
  const refreshSaves = useDynasty((s) => s.refreshSaves);
  const loadSlot = useDynasty((s) => s.loadSlot);
  const leaveStart = useDynasty((s) => s.leaveStart);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void refreshSaves(); }, [refreshSaves]);

  // The one to come back to: the most recently written, whatever it is called.
  const latest = saves.length === 0
    ? null
    : [...saves].sort((a, b) => b.savedAt - a.savedAt)[0]!;

  const resume = (): void => {
    if (!latest || busy) return;
    setBusy(true);
    void loadSlot(latest.slot)
      .then((ok) => { if (!ok) setBusy(false); })
      .catch(() => setBusy(false));
  };
  const blocked = busy || savesState === 'error';
  const startNew = (): void => { leaveStart(); onNew(); };

  return (
    <div className="pb-start">
      <div className="pb-start__inner">
        <header className="pb-start__brand">
          <Mark />
          <span className="pb-eyebrow">College baseball dynasty</span>
          <h1 className="pb-start__title">Playball</h1>
          <p className="pb-start__lede">Build a program, shape the season, and take a dugout all the way to Omaha.</p>
        </header>

        {/*
          A save store that will not open says so here, beside the door that
          starts a new career: an empty start screen would otherwise read as
          "you have no careers" when the device only refused to answer.
        */}
        {savesState === 'error' && (
          <Callout
            tone="negative"
            role="alert"
            title="Your careers could not be read"
            action={{ label: 'Try again', onClick: () => void refreshSaves() }}
          >
            {savesError ?? 'The device refused the save store.'} Nothing is lost.
          </Callout>
        )}

        {latest && (
          /*
            A career ended here is not "where you left off" -- nothing was left
            off. It is a finished thing you can open, and the card says whose
            and how it went rather than a school's season at nought.
          */
          latest.retired ? (
            <Card eyebrow={`A finished career · retired ${latest.retired.year}`} title={latest.retired.coach}>
              <p className="pb-text-muted">
                {latest.retired.record} · last at {latest.school} · saved {when(latest.savedAt)}
              </p>
              <Button variant="secondary" block iconAfter="arrow-right" disabled={busy} onClick={resume}>
                {busy ? 'Opening…' : 'Open the career'}
              </Button>
            </Card>
          ) : (
            <Card eyebrow="Continue where you left off" title={latest.school}>
              <p className="pb-text-muted">
                {latest.name && latest.name !== latest.school ? `${latest.name} · ` : ''}
                {latest.year} season · record {latest.record} · saved {when(latest.savedAt)}
              </p>
              <Button variant="primary" block iconAfter="arrow-right" disabled={busy} onClick={resume}>
                {busy ? 'Opening…' : 'Resume'}
              </Button>
            </Card>
          )
        )}

        {!latest && (
          <Button variant="primary" block iconAfter="arrow-right" disabled={blocked} onClick={startNew}>
            Start a new career
          </Button>
        )}

        <List label="More">
          {latest && (
            <ListRow
              icon="plus-circled"
              title="New career"
              subtitle="Pick a school and take the job."
              onClick={blocked ? undefined : startNew}
              disabled={blocked}
            />
          )}
          {saves.length > 0 && (
            <ListRow
              icon="archive"
              title="Load a career"
              subtitle={`${plural(saves.length, 'career')} saved on this device`}
              onClick={onLoad}
            />
          )}
          <ListRow
            icon="gear"
            title="Settings"
            subtitle="Text size, sound, and how much the game asks you."
            onClick={onSettings}
          />
        </List>
      </div>
    </div>
  );
}
