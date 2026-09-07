// god/LeaguesEditor.tsx — league identity and membership are related, but not
// the same operation. Tabs make that distinction explicit.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { Segmented } from '../components/Kit.js';
import { CONFERENCES } from '../../data/schools.js';
import { conferenceWindow } from '../../engine/godMode.js';
import { leagueLabel, leagueName } from '../../engine/leagueNames.js';
import { Field, Toast } from './controls.js';

type Panel = 'names' | 'membership';
const PANELS = [{ value: 'names', label: 'NAMES' }, { value: 'membership', label: 'MOVES' }] as const;

export function LeaguesEditor() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const leagueNames = useDynasty((s) => s.leagueNames);
  const setLeagueName = useDynasty((s) => s.godSetLeagueName);
  const swap = useDynasty((s) => s.godSwapConferences);
  const [panel, setPanel] = useState<Panel>('names');
  const [nameIndex, setNameIndex] = useState(0);
  const [a, setA] = useState(-1);
  const [b, setB] = useState(-1);
  const [note, setNote] = useState<string | null>(null);
  void version; void leagueNames;
  if (!season) return null;
  const window = conferenceWindow(season);
  const teamA = a >= 0 ? season.teams[a] ?? null : null;
  const teamB = b >= 0 ? season.teams[b] ?? null : null;
  const can = teamA && teamB && teamA.conference !== teamB.conference && window !== 'closed';
  const namedLeague = CONFERENCES[nameIndex] ?? CONFERENCES[0];

  return (
    <main className="module-workspace god-desk">
      <section className="god-summary-card league-summary">
        <div><small>LEAGUES</small><strong>{CONFERENCES.length}</strong><span>in the world</span></div>
        <div><small>MOVES</small><strong className="god-summary-text">{window === 'closed' ? 'LOCKED' : window === 'now' ? 'LIVE' : 'NEXT SPRING'}</strong><span>{window === 'closed' ? 'season in progress' : 'alignment editable'}</span></div>
      </section>
      <div className="god-subnav"><Segmented value={panel} options={PANELS} onChange={setPanel} label="League editor section" /></div>

      {panel === 'names' && <section className="god-card">
        <p className="god-panel-lead">Choose one league, then rename it without changing membership.</p>
        <label className="god-field"><small>LEAGUE</small><select value={nameIndex} onChange={(e) => setNameIndex(Number(e.target.value))}>{CONFERENCES.map((c, i) => <option key={c.id} value={i}>{leagueName(c.id)}</option>)}</select></label>
        {namedLeague && <Field key={namedLeague.id} label="CUSTOM NAME" value={leagueLabel(namedLeague.id) === namedLeague.id ? '' : leagueLabel(namedLeague.id)} placeholder={namedLeague.name} onCommit={(v) => setLeagueName(namedLeague.id, v)} />}
        <p className="god-note">Clear the custom name to restore that league's default name everywhere.</p>
      </section>}

      {panel === 'membership' && <section className="god-card">
        <p className="god-panel-lead">Move membership by swapping two programs from different leagues. No roster is changed.</p>
        {[['FIRST PROGRAM', a, setA], ['SECOND PROGRAM', b, setB]].map(([label, value, set]) => (
          <label key={label as string} className="god-field"><small>{label as string}</small><select value={value as number} disabled={window === 'closed'} onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}>
            <option value={-1}>Choose a program</option>
            {CONFERENCES.map((c) => <optgroup key={c.id} label={leagueName(c.id)}>{season.teams.filter((t) => t.conference === c.id).map((t) => <option key={t.index} value={t.index}>{t.def.school}</option>)}</optgroup>)}
          </select></label>
        ))}
        <div className="god-actions"><button type="button" className="tap" disabled={!can} onClick={() => { if (!teamA || !teamB) return; if (swap(teamA.index, teamB.index)) { setNote(`${teamA.def.school} and ${teamB.def.school} traded leagues.`); setA(-1); setB(-1); } }}>SWAP LEAGUES</button></div>
        <p className="god-note">{window === 'now' ? 'Before the first pitch, the schedule is rebuilt immediately.' : window === 'next-spring' ? 'The season is over, so the move takes effect next spring.' : 'Games have been played in these leagues. Membership changes reopen after the season.'}</p>
      </section>}
      <Toast note={note} />
    </main>
  );
}
