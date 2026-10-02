// StaffPicker.tsx
// The coach's own picks for his staff's list (2026-09-29): "it wont let me do
// my own list". An open slot on the list opens this, on the Season plan and on
// the board's Staff list alike.
//
// The class in reach, best first, filtered by position. A tap stars or unstars
// a man; the row keeps its place and only its star changes, so nothing moves
// under the thumb. The list itself keeps the order he was starred in.

import { useState } from 'react';
import { byRank, type Prospect } from '../../engine/recruiting.js';
import { STAFF_LIST_MAX } from '../../engine/staffRecruiting.js';
import type { PlayerId } from '../../engine/types.js';
import { Button, Icon, List, ListRow, SegmentedControl, Sheet } from '../components/ui/index.js';
import { shortName } from '../format.js';
import { StarRow } from './RecruitRow.js';
import { slotCode, standing } from './recruitRace.js';

type Group = 'all' | 'C' | 'IF' | 'OF' | 'SP' | 'RP';

const GROUPS: { key: Group; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'C', label: 'C' },
  // Codes, as the rows print positions, so the six fit a 375 phone.
  { key: 'IF', label: 'IF' },
  { key: 'OF', label: 'OF' },
  { key: 'SP', label: 'SP' },
  { key: 'RP', label: 'RP' },
];

const GROUP_OF: Record<string, Group> = {
  C: 'C', '1B': 'IF', '2B': 'IF', '3B': 'IF', SS: 'IF', DH: 'IF',
  LF: 'OF', CF: 'OF', RF: 'OF', SP: 'SP', RP: 'RP',
};

/** His spots, a two-way man's both of them. */
function spotsOf(p: Prospect): string[] {
  const pl = p.player as { pos?: string; role?: string; twoWay?: boolean; type: string };
  if (pl.twoWay) return [pl.pos ?? '', pl.role ?? ''];
  return [pl.type === 'pitcher' ? pl.role ?? '' : pl.pos ?? ''];
}

const PAGE = 30;

export function StaffPicker({
  prospects, list, userTeam, reachable, schoolOf, onToggle, onClose, covered = false,
}: {
  prospects: readonly Prospect[];
  /** The starred men, in order. */
  list: readonly PlayerId[];
  userTeam: number;
  reachable: (p: Prospect) => boolean;
  schoolOf: (i: number) => string;
  onToggle: (id: PlayerId) => void;
  onClose: () => void;
  /** Laid under a room (the Season plan's), kept but hidden. */
  covered?: boolean;
}) {
  const [group, setGroup] = useState<Group>('all');
  const [shown, setShown] = useState(PAGE);
  const starred = new Set<string>(list);
  const full = list.length >= STAFF_LIST_MAX;
  // Open men in reach, the best of the class first. A man already starred
  // stays listed wherever he ranks, so he can be let go from here too.
  const rows = prospects
    .filter((p) => p.signedBy === null && (reachable(p) || starred.has(p.id)))
    .filter((p) => group === 'all' || spotsOf(p).some((s) => GROUP_OF[s] === group))
    .sort((a, b) => b.stars - a.stars || byRank(a, b));

  return (
    <Sheet
      eyebrow={`Staff list · ${list.length}/${STAFF_LIST_MAX}`}
      title="Pick recruits"
      tall
      className="pb-rc-picker"
      covered={covered}
      onClose={onClose}
      footer={<Button variant="primary" block onClick={onClose}>Done</Button>}
    >
      {/* A segmented control, not chips: a chip grows a check when picked and
          slid its neighbours 20px under the thumb. */}
      <SegmentedControl<Group>
        label="Position"
        className="pb-rc-picker__groups"
        value={group}
        options={GROUPS.map((g) => ({ value: g.key, label: g.label }))}
        onChange={(g) => { setGroup(g); setShown(PAGE); }}
      />
      {/* One line always, so the eighth star does not push the rows down. */}
      <p className={full ? 'pb-rc-picker__note is-full' : 'pb-rc-picker__note'}>
        {full ? 'The list is full. Unstar someone to swap.' : 'Tap to star. Worked in the order starred.'}
      </p>
      <List label="Recruits">
        {rows.slice(0, shown).map((p) => {
          const on = starred.has(p.id);
          return (
            <ListRow
              key={p.id}
              className={on ? 'pb-rc-pick is-on' : 'pb-rc-pick'}
              title={(
                <span className="pb-rc-slot__title">
                  <span className="pb-rc-slot__name" title={p.player.name}>{shortName(p.player.name)}</span>
                  <StarRow n={p.stars} size={11} />
                </span>
              )}
              subtitle={`${slotCode(p)} · ${p.state} · ${standing(p, userTeam, schoolOf, reachable(p)).short}`}
              value={(
                <span className="pb-rc-pick__star" aria-hidden>
                  <Icon name={on ? 'star-filled' : 'star'} size={20} />
                </span>
              )}
              chevron={false}
              disabled={!on && full}
              selected={on}
              onClick={() => onToggle(p.id)}
            />
          );
        })}
      </List>
      {rows.length === 0 && <p className="pb-text-muted">Nobody in reach at this position.</p>}
      {rows.length > shown && (
        <Button variant="secondary" block onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, rows.length - shown)} more
        </Button>
      )}
    </Sheet>
  );
}
