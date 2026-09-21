// god/LeaguesEditor.tsx — league names and league membership are related, but
// not the same operation, so they are two panels.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { CONFERENCES } from '../../data/schools.js';
import { conferenceWindow } from '../../engine/godMode.js';
import { leagueLabel, leagueName } from '../../engine/leagueNames.js';
import { Button, Callout, Card, SegmentedControl, StatGroup, StatusBadge } from '../components/ui/index.js';
import { Choose, Field, GodPage, Toast } from './controls.js';

type Panel = 'names' | 'membership';
const PANELS = [{ value: 'names', label: 'Names' }, { value: 'membership', label: 'Membership' }] as const;

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
  const programOptions = [
    { value: -1, label: 'Choose a program' },
    ...CONFERENCES.map((c) => ({
      group: leagueName(c.id),
      options: season.teams.filter((t) => t.conference === c.id).map((t) => ({ value: t.index, label: t.def.school })),
    })),
  ];

  return (
    <GodPage eyebrow="God mode · Leagues" title="Leagues">
      <StatGroup
        size="sm"
        items={[
          { label: 'Leagues', value: CONFERENCES.length },
          {
            label: 'Membership moves',
            value: window === 'closed' ? 'Locked' : window === 'now' ? 'Open' : 'Next spring',
            note: window === 'closed' ? 'Games are under way' : window === 'now' ? 'Before the first pitch' : 'After this season',
          },
        ]}
      />
      <SegmentedControl<Panel> label="League editor section" value={panel} onChange={setPanel} options={PANELS} />

      {panel === 'names' && (
        <Card title="Rename a league" eyebrow="Membership stays the same">
          <Choose<number>
            label="League"
            value={nameIndex}
            options={CONFERENCES.map((c, i) => ({ value: i, label: leagueName(c.id) }))}
            onChange={setNameIndex}
          />
          {namedLeague && (
            <Field
              key={namedLeague.id}
              label="New name"
              value={leagueLabel(namedLeague.id) === namedLeague.id ? '' : leagueLabel(namedLeague.id)}
              placeholder={namedLeague.name}
              onCommit={(v) => setLeagueName(namedLeague.id, v)}
            />
          )}
          <p className="pb-note">Clear it to bring back the original.</p>
        </Card>
      )}

      {panel === 'membership' && (
        <Card
          title="Swap two programs"
          eyebrow="Between two different leagues"
          trailing={window === 'closed' ? <StatusBadge tone="neutral" icon="lock">Locked</StatusBadge> : undefined}
        >
          <Choose<number> label="First program" value={a} disabled={window === 'closed'} options={programOptions} onChange={setA} />
          <Choose<number> label="Second program" value={b} disabled={window === 'closed'} options={programOptions} onChange={setB} />
          {teamA && teamB && teamA.conference === teamB.conference && (
            <Callout tone="warning">They are already in the same league. Pick programs from two different leagues.</Callout>
          )}
          <Button
            variant="primary"
            block
            icon="swap"
            disabled={!can}
            onClick={() => {
              if (!teamA || !teamB) return;
              if (swap(teamA.index, teamB.index)) { setNote(`${teamA.def.school} and ${teamB.def.school} traded leagues.`); setA(-1); setB(-1); }
            }}
          >Swap their leagues</Button>
          <p className="pb-note">
            {window === 'now' ? 'The schedule is rebuilt at once.' : window === 'next-spring' ? 'Takes effect next spring.' : 'Opens again after the season.'}
          </p>
        </Card>
      )}
      <Toast note={note} />
    </GodPage>
  );
}
