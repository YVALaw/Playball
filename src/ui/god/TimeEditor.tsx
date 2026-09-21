// god/TimeEditor.tsx — the calendar, and presets that rewrite the whole world.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { seasonComplete } from '../../engine/season.js';
import { Button, Card, SegmentedControl, StatGroup } from '../components/ui/index.js';
import { GodPage, SureButton, Toast } from './controls.js';

type Panel = 'calendar' | 'presets';
const PANELS = [{ value: 'calendar', label: 'Calendar' }, { value: 'presets', label: 'Presets' }] as const;

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
  const played = season.results.length > 0;

  return (
    <GodPage eyebrow="God mode · World" title="Calendar and presets">
      <StatGroup
        size="sm"
        items={[
          { label: 'Day', value: season.dayIndex + 1, note: 'Of the season' },
          { label: 'Games played', value: season.results.length, note: 'Across the country' },
          { label: 'Season', value: over ? 'Over' : 'Under way' },
        ]}
      />
      <SegmentedControl<Panel> label="World editor section" value={panel} onChange={setPanel} options={PANELS} />

      {panel === 'calendar' && (
        <>
          <Card title="Redraw the schedule">
            <p className="pb-text-muted">
              {played ? 'Locked: games have been played.' : 'Before the first pitch only.'}
            </p>
            <Button variant="secondary" block icon="shuffle" disabled={played} onClick={() => { if (reshuffle()) setNote('The schedule was redrawn.'); }}>Redraw the schedule</Button>
          </Card>
          <Card title="Sim the rest of the season">
            <p className="pb-text-muted">Plays every game left through June.</p>
            <Button variant="primary" block icon="play" disabled={over || busy || !!live} onClick={() => { closeGodAll(); void playSeason(); }}>Sim the season</Button>
          </Card>
        </>
      )}

      {panel === 'presets' && (
        <>
          
          <Card title="Parity" eyebrow="Every program">
            <p className="pb-text-muted">Every program&rsquo;s prestige becomes 50.</p>
            <SureButton label="Apply parity" armed="Tap again: every program becomes a 50" onSure={() => { preset('parity'); setNote('Every program is a 50 now.'); }} />
          </Card>
          <Card title="Chaos" eyebrow="Every program">
            <p className="pb-text-muted">Every program draws a new prestige at random.</p>
            <SureButton label="Apply chaos" armed="Tap again: every prestige is redrawn" onSure={() => { preset('chaos'); setNote('Every program drew a new prestige.'); }} />
          </Card>
          <Card title="Superteam" eyebrow={me.def.school}>
            <p className="pb-text-muted">Everyone on your roster becomes a 99 with a 99 ceiling.</p>
            <SureButton label="Make a superteam" armed="Tap again: your whole roster becomes 99" onSure={() => { preset('superteam'); setNote(`${me.def.school}: everybody is a 99.`); }} />
          </Card>
        </>
      )}
      <Toast note={note} />
    </GodPage>
  );
}
