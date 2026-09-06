// god/TimeEditor.tsx — the calendar and the shape of the world.
//
// Opened from the header's bolt on the Home and Season tabs and from the
// bolt on the schedule.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { SectionHeading } from '../components/Kit.js';
import { seasonComplete } from '../../engine/season.js';
import { SureButton, Toast } from './controls.js';

export function TimeEditor() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const userTeam = useDynasty((s) => s.userTeam);
  const busy = useDynasty((s) => s.busy);
  const live = useDynasty((s) => s.live);
  const reshuffle = useDynasty((s) => s.godReshuffleSchedule);
  const preset = useDynasty((s) => s.godPreset);
  const playSeason = useDynasty((s) => s.playSeason);
  const closeGodAll = useDynasty((s) => s.closeGodAll);
  const [note, setNote] = useState<string | null>(null);
  void version;
  const me = season?.teams[userTeam];
  if (!season || !me) return null;
  const over = seasonComplete(season);

  return (
    <main className="module-workspace god-desk">
      <section className="god-card">
        <div className="god-actions">
          <button
            type="button"
            className="tap"
            disabled={season.results.length > 0}
            onClick={() => { if (reshuffle()) setNote('The schedule was redrawn.'); }}
          >RESHUFFLE THE SCHEDULE</button>
          <button
            type="button"
            className="tap"
            disabled={over || busy || !!live}
            onClick={() => { closeGodAll(); void playSeason(); }}
          >SIM THE SEASON</button>
        </div>
        <p className="god-note">
          {season.results.length > 0
            ? 'Games have been played on this schedule; the next season draws a fresh one.'
            : 'A different draw of the same fixtures, before the first pitch.'}
          {' '}Sim the season plays every date left to June; the offseason follows as it always does, one step at a time.
        </p>
      </section>

      <SectionHeading kicker="THE WORLD" title="Presets" />
      <section className="god-card">
        <div className="god-actions">
          <SureButton label="PARITY" onSure={() => { preset('parity'); setNote('Every program is a fifty.'); }} />
          <SureButton label="CHAOS" onSure={() => { preset('chaos'); setNote('Every program drew a new prestige.'); }} />
          <SureButton label="SUPERTEAM" onSure={() => { preset('superteam'); setNote(`${me.def.school}: everybody is a 99.`); }} />
        </div>
        <p className="god-note">Parity puts every program at fifty; chaos redraws every program's prestige; superteam makes every man on your roster a 99 with a 99 ceiling. Each asks twice.</p>
      </section>

      <Toast note={note} />
    </main>
  );
}
