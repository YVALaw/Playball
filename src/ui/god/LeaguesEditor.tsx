// god/LeaguesEditor.tsx — what the leagues are called, and who plays in which.
//
// Opened from the bolt on the conference table and from the header's bolt
// on the Season tab. A trade is between any two programs; the program
// editor offers the same trade from one program's side.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { SectionHeading } from '../components/Kit.js';
import { CONFERENCES } from '../../data/schools.js';
import { conferenceWindow } from '../../engine/godMode.js';
import { leagueLabel, leagueName } from '../../engine/leagueNames.js';
import { Field, Toast } from './controls.js';

export function LeaguesEditor() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const leagueNames = useDynasty((s) => s.leagueNames);
  const setLeagueName = useDynasty((s) => s.godSetLeagueName);
  const swap = useDynasty((s) => s.godSwapConferences);
  const [a, setA] = useState(-1);
  const [b, setB] = useState(-1);
  const [note, setNote] = useState<string | null>(null);
  void version; void leagueNames;
  if (!season) return null;
  const window = conferenceWindow(season);
  const teamA = a >= 0 ? season.teams[a] ?? null : null;
  const teamB = b >= 0 ? season.teams[b] ?? null : null;
  const can = teamA && teamB && teamA.conference !== teamB.conference && window !== 'closed';

  return (
    <main className="module-workspace god-desk">
      <section className="god-card">
        {CONFERENCES.map((c) => (
          <Field
            key={c.id}
            label={c.id}
            value={leagueLabel(c.id) === c.id ? '' : leagueLabel(c.id)}
            placeholder={c.name}
            onCommit={(v) => setLeagueName(c.id, v)}
          />
        ))}
        <p className="god-note">A name here is printed everywhere the league is: the desk, the standings, the bracket, the wire. Clear it and the league goes back to its own.</p>
      </section>

      <SectionHeading kicker="THE MAP" title="Trade two programs' leagues" />
      <section className="god-card">
        {[['FIRST PROGRAM', a, setA], ['SECOND PROGRAM', b, setB]].map(([label, value, set]) => (
          <label key={label as string} className="god-field">
            <small>{label as string}</small>
            <select value={value as number} disabled={window === 'closed'} onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}>
              <option value={-1}>Choose a program</option>
              {CONFERENCES.map((c) => (
                <optgroup key={c.id} label={leagueName(c.id)}>
                  {season.teams.filter((t) => t.conference === c.id).map((t) => (
                    <option key={t.index} value={t.index}>{t.def.school}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ))}
        <div className="god-actions">
          <button
            type="button"
            className="tap"
            disabled={!can}
            onClick={() => {
              if (!teamA || !teamB) return;
              if (swap(teamA.index, teamB.index)) { setNote(`${teamA.def.school} and ${teamB.def.school} traded leagues.`); setA(-1); setB(-1); }
            }}
          >TRADE</button>
        </div>
        <p className="god-note">
          {window === 'now'
            ? 'Before the first pitch: the schedule is rebuilt on the spot.'
            : window === 'next-spring'
              ? 'The season is over: the trade takes effect next spring.'
              : 'Games have been played in these leagues. Trades open again after the season.'}
          {' '}Two programs in the same league have nothing to trade.
        </p>
      </section>

      <Toast note={note} />
    </main>
  );
}
