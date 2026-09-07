// god/TimeEditor.tsx — calendar actions and global presets in separate panels.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { Segmented } from '../components/Kit.js';
import { seasonComplete } from '../../engine/season.js';
import { SureButton, Toast } from './controls.js';

type Panel = 'calendar' | 'presets';
const PANELS = [{ value: 'calendar', label: 'CALENDAR' }, { value: 'presets', label: 'PRESETS' }] as const;

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
  const [panel, setPanel] = useState<Panel>('calendar');
  const [note, setNote] = useState<string | null>(null);
  void version;
  const me = season?.teams[userTeam];
  if (!season || !me) return null;
  const over = seasonComplete(season);

  return (
    <main className="module-workspace god-desk">
      <section className="god-summary-card world-summary">
        <div><small>DAY</small><strong>{season.dayIndex + 1}</strong><span>season calendar</span></div>
        <div><small>PLAYED</small><strong>{season.results.length}</strong><span>games recorded</span></div>
        <div><small>STATE</small><strong className="god-summary-text">{over ? 'COMPLETE' : 'ACTIVE'}</strong><span>{over ? 'offseason next' : 'season in progress'}</span></div>
      </section>
      <div className="god-subnav"><Segmented value={panel} options={PANELS} onChange={setPanel} label="World editor section" /></div>

      {panel === 'calendar' && <section className="god-card">
        <div className="god-actions">
          <button type="button" className="tap" disabled={season.results.length > 0} onClick={() => { if (reshuffle()) setNote('The schedule was redrawn.'); }}>RESHUFFLE SCHEDULE</button>
          <button type="button" className="tap" disabled={over || busy || !!live} onClick={() => { closeGodAll(); void playSeason(); }}>SIM THE SEASON</button>
        </div>
        <p className="god-note">{season.results.length > 0 ? 'The current schedule is locked because games have already been played.' : 'Reshuffle redraws the same fixture structure before the first pitch.'} Sim Season plays every remaining date to June, then returns to the normal offseason flow.</p>
      </section>}

      {panel === 'presets' && <section className="god-card">
        <p className="god-panel-lead">Global presets can rewrite many programs or players at once, so each requires a second press.</p>
        <div className="god-preset-grid">
          <div><strong>PARITY</strong><p>Every program becomes 50 prestige.</p><SureButton label="APPLY PARITY" onSure={() => { preset('parity'); setNote('Every program is a fifty.'); }} /></div>
          <div><strong>CHAOS</strong><p>Every program draws a fresh prestige.</p><SureButton label="APPLY CHAOS" onSure={() => { preset('chaos'); setNote('Every program drew a new prestige.'); }} /></div>
          <div><strong>SUPERTEAM</strong><p>Your roster becomes 99 OVR with a 99 ceiling.</p><SureButton label="MAKE SUPERTEAM" onSure={() => { preset('superteam'); setNote(`${me.def.school}: everybody is a 99.`); }} /></div>
        </div>
      </section>}
      <Toast note={note} />
    </main>
  );
}
