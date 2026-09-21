// god/ProgramEditor.tsx — a program's name and prestige only.
//
// Its roster is its own editor and league membership lives under Leagues, so
// this page stays narrow and it is obvious what a change here does.

import { useDynasty } from '../../state/store.js';
import { prestigeStars } from '../../engine/program.js';
import { Card, List, ListRow, StatGroup, Stars } from '../components/ui/index.js';
import { conferenceName } from '../words.js';
import { Field, GodPage, Slider } from './controls.js';

export function ProgramEditor({ team }: { team: number }) {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const setPrestige = useDynasty((s) => s.godSetPrestige);
  const rename = useDynasty((s) => s.godRenameProgram);
  const openGod = useDynasty((s) => s.openGod);
  const record = season?.teams[team];
  if (!season || !record) return null;

  return (
    <GodPage
      eyebrow="God mode · Program"
      title={record.def.school}
      description={`${conferenceName(record.conference)} · crest ${record.def.abbr}${record.index === userTeam ? ' · your program' : ''}`}
    >
      <StatGroup
        size="sm"
        items={[
          { label: 'Prestige', value: Math.round(record.prestige), unit: '/100', note: <Stars value={prestigeStars(record.prestige)} label="Program prestige" /> },
        ]}
      />

      <Card title="Name and prestige">
        <Field label="School" value={record.def.school} onCommit={(v) => rename(record.index, v, record.def.nickname)} />
        <Field label="Nickname" value={record.def.nickname} onCommit={(v) => rename(record.index, record.def.school, v)} />
        <Slider label="Prestige" value={record.prestige} min={1} max={100} onCommit={(v) => setPrestige(record.index, v)} hint="How big the name is: who recruits listen to, and what the board expects." />
        <p className="pb-note">The crest keeps the letters {record.def.abbr}.</p>
      </Card>

      <List label="Related tools">
        <ListRow icon="person" title="Roster" subtitle="Add, browse and edit this program's players" onClick={() => openGod({ kind: 'roster', team: record.index })} />
        <ListRow icon="globe" title="Leagues" subtitle="Rename leagues or move programs between them" onClick={() => openGod({ kind: 'leagues' })} />
      </List>

      
    </GodPage>
  );
}
