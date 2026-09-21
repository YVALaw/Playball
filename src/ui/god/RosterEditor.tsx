// god/RosterEditor.tsx — the people on one roster: add a player, filter the
// list, and open anyone in his own editor. League movement deliberately does
// not live here.

import { useMemo, useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { isHurt } from '../../engine/injury.js';
import { overallOf } from '../../engine/ratings.js';
import { potentialGrade } from '../../engine/scouting.js';
import { isTwoWay, type Hitter, type Pitcher, type Player, type PlayerId } from '../../engine/types.js';
import {
  Button, Card, EmptyState, Face, List, PlayerRow, SegmentedControl, StatGroup,
} from '../components/ui/index.js';
import { CLASS_NAME, POSITION_NAME } from '../words.js';
import { GodPage } from './controls.js';

const slotOf = (p: Player): string => p.type === 'pitcher' ? (p as Pitcher).role : (p as Hitter).pos;
type Filter = 'all' | 'bats' | 'arms';
const FILTERS = [
  { value: 'all', label: 'Everyone' },
  { value: 'bats', label: 'Hitters' },
  { value: 'arms', label: 'Pitchers' },
] as const;

export function RosterEditor({ team }: { team: number }) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const addPlayer = useDynasty((s) => s.godAddPlayer);
  const openGod = useDynasty((s) => s.openGod);
  const [filter, setFilter] = useState<Filter>('all');
  void version;

  const record = season?.teams[team];
  const men = useMemo(() => {
    if (!record) return [] as Player[];
    return [...new Map<PlayerId, Player>([
      ...record.team.lineup, ...record.team.bench, ...record.team.rotation, ...record.team.bullpen,
    ].map((p) => [p.id, p])).values()];
  }, [record, version]);
  if (!season || !record) return null;

  const shown = men.filter((p) => filter === 'all' || (filter === 'arms' ? p.type === 'pitcher' : p.type !== 'pitcher'));
  const add = (kind: 'hitter' | 'pitcher'): void => {
    const id = addPlayer(record.index, kind);
    if (id) openGod({ kind: 'player', id });
  };

  return (
    <GodPage eyebrow="God mode · Roster" title={record.def.school}>
      <StatGroup
        size="sm"
        items={[
          { label: 'Players', value: men.length },
          { label: 'Hitters', value: men.filter((p) => p.type !== 'pitcher').length },
          { label: 'Pitchers', value: men.filter((p) => p.type === 'pitcher').length },
        ]}
      />

      <Card title="Add a player">
        <div className="pb-buttons-2">
          <Button variant="secondary" icon="plus" onClick={() => add('hitter')}>Add a hitter</Button>
          <Button variant="secondary" icon="plus" onClick={() => add('pitcher')}>Add a pitcher</Button>
        </div>
        
      </Card>

      <SegmentedControl<Filter> label="Roster filter" value={filter} onChange={setFilter} options={FILTERS} />

      {shown.length === 0 ? (
        <EmptyState icon="person" title="Nobody here" />
      ) : (
        <List label="Roster">
          {shown.map((p) => {
            const code = slotOf(p);
            return (
              <PlayerRow
                key={p.id}
                name={p.name}
                avatar={<Face id={p.id} team={record.def.abbr} size={36} />}
                tags={[
                  { text: code, title: POSITION_NAME[code as keyof typeof POSITION_NAME] ?? code },
                  CLASS_NAME[p.classYear],
                  ...(isTwoWay(p) ? ['Two-way'] : []),
                ]}
                meta={`Ceiling ${potentialGrade(p.potential)}`}
                warning={isHurt(p, season.dayIndex) ? 'Hurt' : undefined}
                value={overallOf(p)}
                valueLabel="of 100"
                onClick={() => openGod({ kind: 'player', id: p.id })}
              />
            );
          })}
        </List>
      )}
    </GodPage>
  );
}
