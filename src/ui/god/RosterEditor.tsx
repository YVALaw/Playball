// god/RosterEditor.tsx — roster management only.
//
// League movement deliberately does not live here. This editor is about the
// people on one roster: add a player, filter the list, and open a player editor.

import { useMemo, useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { Segmented } from '../components/Kit.js';
import { isHurt } from '../../engine/injury.js';
import { overallOf } from '../../engine/ratings.js';
import { potentialGrade } from '../../engine/scouting.js';
import { isTwoWay, type Hitter, type Pitcher, type Player, type PlayerId } from '../../engine/types.js';

const slotOf = (p: Player): string => p.type === 'pitcher' ? (p as Pitcher).role : (p as Hitter).pos;
type Filter = 'all' | 'bats' | 'arms';
const FILTERS = [
  { value: 'all', label: 'ALL' },
  { value: 'bats', label: 'BATS' },
  { value: 'arms', label: 'ARMS' },
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

  return (
    <main className="module-workspace god-desk">
      <section className="god-summary-card">
        <div><small>ROSTER</small><strong>{men.length}</strong><span>players</span></div>
        <div><small>BATS</small><strong>{men.filter((p) => p.type !== 'pitcher').length}</strong><span>position players</span></div>
        <div><small>ARMS</small><strong>{men.filter((p) => p.type === 'pitcher').length}</strong><span>pitchers</span></div>
      </section>

      <section className="god-card god-quick-actions">
        <div className="god-actions">
          <button type="button" className="tap" onClick={() => { const id = addPlayer(record.index, 'hitter'); if (id) openGod({ kind: 'player', id }); }}>ADD A BAT</button>
          <button type="button" className="tap" onClick={() => { const id = addPlayer(record.index, 'pitcher'); if (id) openGod({ kind: 'player', id }); }}>ADD AN ARM</button>
        </div>
        <p className="god-note">New players arrive on the bench or in the pen. Open them immediately to rewrite ratings, status or destination.</p>
      </section>

      <div className="god-subnav"><Segmented value={filter} options={FILTERS} onChange={setFilter} label="Roster filter" /></div>

      <section className="god-card god-roster-card">
        <div className="god-roster">
          {shown.map((p) => (
            <button key={p.id} type="button" className="tap" onClick={() => openGod({ kind: 'player', id: p.id })}>
              <strong>{p.name}</strong>
              <small>
                {slotOf(p)} · {p.classYear} · {overallOf(p)} OVR · {potentialGrade(p.potential)}
                {isHurt(p, season.dayIndex) ? ' · HURT' : ''}{isTwoWay(p) ? ' · 2-WAY' : ''}
              </small>
            </button>
          ))}
        </div>
        {shown.length === 0 && <p className="god-note">No players in this filter.</p>}
      </section>
    </main>
  );
}
