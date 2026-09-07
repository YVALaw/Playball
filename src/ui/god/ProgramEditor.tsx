// god/ProgramEditor.tsx — program identity and prestige only.
//
// Roster management is its own editor and league membership lives under the
// Leagues tool. Keeping this surface narrow makes it obvious what a change does.

import { useDynasty } from '../../state/store.js';
import { leagueName } from '../../engine/leagueNames.js';
import { prestigeStars } from '../../engine/program.js';
import { Field, Slider } from './controls.js';

export function ProgramEditor({ team }: { team: number }) {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const setPrestige = useDynasty((s) => s.godSetPrestige);
  const rename = useDynasty((s) => s.godRenameProgram);
  const openGod = useDynasty((s) => s.openGod);
  const record = season?.teams[team];
  if (!season || !record) return null;

  return (
    <main className="module-workspace god-desk">
      <section className="god-summary-card program-summary">
        <div><small>PRESTIGE</small><strong>{Math.round(record.prestige)}</strong><span>{'★'.repeat(prestigeStars(record.prestige))}</span></div>
        <div><small>LEAGUE</small><strong className="god-summary-text">{leagueName(record.conference)}</strong><span>membership edited elsewhere</span></div>
      </section>

      <section className="god-card">
        <Field label="SCHOOL" value={record.def.school} onCommit={(v) => rename(record.index, v, record.def.nickname)} />
        <Field label="NICKNAME" value={record.def.nickname} onCommit={(v) => rename(record.index, record.def.school, v)} />
        <Slider label="PRESTIGE" value={record.prestige} min={1} max={100} onCommit={(v) => setPrestige(record.index, v)} />
        <p className="god-note">The crest keeps the abbreviation {record.def.abbr}. League names and program movement are controlled from the Leagues menu.</p>
      </section>

      <section className="god-linked-actions">
        <button type="button" className="god-link-card tap" onClick={() => openGod({ kind: 'roster', team: record.index })}>
          <small>ROSTER</small><strong>Manage players</strong><span>Add, browse and edit this program's roster.</span>
        </button>
        <button type="button" className="god-link-card tap" onClick={() => openGod({ kind: 'leagues' })}>
          <small>LEAGUES</small><strong>League membership</strong><span>Rename leagues or move programs between them.</span>
        </button>
      </section>

      {record.index === userTeam && <p className="god-note god-context-note">This is your program. Coach, budget and staff are separate tools in the Program category of the Control Center.</p>}
    </main>
  );
}
