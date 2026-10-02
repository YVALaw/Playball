// StaffList.tsx
// The recruits the coach has starred for his staff, in the order they work
// them (2026-09-28). The board's Staff list view and the Season plan both
// render this, so it takes everything as props and reads no store.
//
// Eight slots always, filled or not: a starred man takes the next one and an
// open one stays open, because the staff works nobody the coach did not pick
// (2026-09-30). Tapping it opens the picker (StaffPicker, 2026-09-29).
// Nothing here changes height when a man is starred, moved or let go, so the
// suggestion and the switch under the list never move under a thumb.

import type { Prospect } from '../../engine/recruiting.js';
import { STAFF_LIST_MAX } from '../../engine/staffRecruiting.js';
import type { PlayerId } from '../../engine/types.js';
import { Button, IconButton, List, ListRow, Switch } from '../components/ui/index.js';
import { shortName } from '../format.js';
import { StarRow } from './RecruitRow.js';
import { slotCode, staffLine, standing } from './recruitRace.js';

export interface StaffListProps {
  /** The starred men, in order, resolved to prospects. */
  list: readonly Prospect[];
  /** Stand-in id to the lost man's id: the men the staff starred in someone's place. */
  standIns: Readonly<Record<string, string>>;
  byId: (id: string) => Prospect | undefined;
  userTeam: number;
  programStars: number;
  week: number;
  reachable: (p: Prospect) => boolean;
  schoolOf: (i: number) => string;
  /** The staff's own suggested list, most winnable first. */
  suggestion: readonly PlayerId[];
  /** False outside the window; the suggestion's button stays, disabled. */
  canSuggest?: boolean;
  onUseSuggestion: () => void;
  onMove: (id: PlayerId, by: -1 | 1) => void;
  onUnstar: (id: PlayerId) => void;
  replaceLost: boolean;
  onReplaceLost: (on: boolean) => void;
  /** An open slot's tap: the coach picks his own men (StaffPicker). */
  onPickSlot?: () => void;
}

export function StaffList({
  list, standIns, byId, userTeam, programStars, week, reachable, schoolOf,
  suggestion, canSuggest = true, onUseSuggestion, onMove, onUnstar, replaceLost, onReplaceLost, onPickSlot,
}: StaffListProps) {
  const n = list.length;
  const inUse = suggestion.length > 0 && suggestion.length === n
    && suggestion.every((id, i) => list[i]?.id === id);
  const suggested = suggestion
    .map((id) => byId(id))
    .filter((p): p is Prospect => !!p)
    .map(slotCode);

  return (
    <section className="pb-rc-staff" aria-label="Staff list">
      <div className="pb-rc-listhead">
        <div>
          <h2>Staff list<span>{n}/{STAFF_LIST_MAX}</span></h2>
        </div>
        <small>{n === 0 ? 'Staff works only your picks' : 'Worked in this order'}</small>
      </div>

      <List label="Staff list" className="pb-rc-slots">
        {Array.from({ length: STAFF_LIST_MAX }, (_, i) => {
          const p = list[i];
          if (!p) {
            return (
              <ListRow
                key={`open-${i}`}
                className="pb-rc-slot is-open"
                lead={<span className="pb-rc-order is-open" aria-hidden>{i + 1}</span>}
                title="Open"
                subtitle={onPickSlot ? 'Tap to pick a recruit' : undefined}
                onClick={onPickSlot}
              />
            );
          }
          const name = p.player.name;
          const lostId = standIns[p.id];
          const lost = lostId ? byId(lostId) : undefined;
          return (
            <ListRow
              key={p.id}
              className="pb-rc-slot"
              lead={<span className="pb-rc-order">{i + 1}</span>}
              title={(
                <span className="pb-rc-slot__title">
                  <span className="pb-rc-slot__name" title={name}>{shortName(name)}</span>
                  <StarRow n={p.stars} size={11} />
                </span>
              )}
              // The text column is 145px on a 375 phone, so the short words:
              // the board row's chip word, and "for" as a box score says it.
              subtitle={lost
                ? `${slotCode(p)} · for ${shortName(lost.player.name)}`
                : `${slotCode(p)} · ${standing(p, userTeam, schoolOf, reachable(p)).short}`}
              status={<span className="pb-rc-staffrow__line">{staffLine(p, userTeam, week, programStars)}</span>}
              value={(
                <span className="pb-rc-staffctl">
                  <IconButton tone="quiet" icon="arrow-up" size={18} label={`Move ${name} up`} disabled={i === 0} onClick={() => onMove(p.id, -1)} />
                  <IconButton tone="quiet" icon="arrow-down" size={18} label={`Move ${name} down`} disabled={i === n - 1} onClick={() => onMove(p.id, 1)} />
                  <IconButton tone="quiet" icon="cross" size={18} label={`Unstar ${name}`} onClick={() => onUnstar(p.id)} />
                </span>
              )}
            />
          );
        })}
      </List>

      <List label="Suggested list">
        <ListRow
          icon="star"
          className="pb-rc-suggestrow"
          title="Suggested"
          subtitle={suggested.length > 0 ? suggested.join(' · ') : 'None in reach'}
          value={(
            <Button
              size="sm"
              variant="tonal"
              className="pb-rc-suggest"
              disabled={inUse || !canSuggest || suggestion.length === 0}
              onClick={onUseSuggestion}
            >{inUse ? 'In use' : 'Use these'}</Button>
          )}
        />
        <Switch label="Replace lost recruits" checked={replaceLost} onChange={onReplaceLost} />
      </List>
    </section>
  );
}
