// RecruitRow.tsx
// One prospect on the board, as a race row: his national rank, his face, who
// he is and how good the scouts think he is, and the race for him — your share
// of his interest, what this week's plan adds, and where the leading school
// stands.
//
// A row, not a card. The board used to stack a card per prospect with a
// captioned meter, a wants line and a button under each head, and thirty of
// them were a scroll ("we have to scroll way too much"). Everything a card said
// is on his sheet, one tap away.

import type { ReactNode } from 'react';
import type { Prospect } from '../../engine/recruiting.js';
import { cx, Face, Icon } from '../components/ui/index.js';
import { plural } from '../words.js';
import { shortName } from '../format.js';
import type { Race, Standing } from './recruitRace.js';

/** A star rating as the stars themselves, filled ones only. */
export function StarRow({ n, size = 12, className }: { n: number; size?: number; className?: string }) {
  return (
    <span className={cx('pb-rc-stars', className)} role="img" aria-label={plural(n, 'star')}>
      {Array.from({ length: Math.max(0, n) }, (_, i) => <Icon key={i} name="star-filled" size={size} />)}
    </span>
  );
}

/** A left edge for the leader's tick that keeps the whole tick on the bar. */
const tickAt = (share: number): string =>
  `clamp(0px, calc(${Math.max(0, Math.min(100, share))}% - 1px), calc(100% - 2px))`;

/**
 * The race as one bar: your share solid, what this week's plan adds striped
 * after it, and a tick where the leading school stands.
 */
export function RaceBar({ race, size = 'sm' }: { race: Race; size?: 'sm' | 'lg' }) {
  const gain = Math.max(0, race.projected - race.you);
  return (
    <span
      className={cx('pb-rc-racebar', size === 'lg' && 'pb-rc-racebar--lg')}
      role="img"
      aria-label={`You ${race.you}%${gain > 0 ? `, ${race.projected}% after this week` : ''}${race.rivalTeam !== null ? `, leading school ${race.rival}%` : ''}`}
    >
      <i className="pb-rc-racebar__you" style={{ width: `${race.you}%` }} />
      <i className="pb-rc-racebar__gain" style={{ width: `${gain}%` }} />
      {race.rivalTeam !== null && <i className="pb-rc-racebar__lead" style={{ left: tickAt(race.rival) }} />}
    </span>
  );
}

export interface RecruitRowProps {
  prospect: Prospect;
  /** "SS FL · Now 52–58 · Ceiling A". */
  facts: ReactNode;
  status: Standing;
  /** The race and its line; without one the row carries `note` instead. */
  race?: Race;
  raceText?: string;
  note?: string;
  /** Points this week's plan puts on him. */
  planned: number;
  /** The program he signed with, for his face's colours. */
  team?: string;
  onOpen: () => void;
  /** The staff-list star, while the staff runs recruiting. Omitted, the row is as it always was. */
  star?: RowStar;
}

/** A row's staff-list star: on when he is starred; `available` false reserves the column empty. */
export interface RowStar {
  on: boolean;
  available: boolean;
  disabled: boolean;
  label: string;
  onToggle: () => void;
}

/**
 * The status chip ends the name line and the planned tag ends the race line,
 * where the review's mockup gave them a column of their own. A fourth column
 * left the facts line about a hundred pixels on a 360-wide phone, and the
 * facts are the line a coach reads the board by.
 */
export function RecruitRow({
  prospect, facts, status, race, raceText, note, planned, team, onOpen, star,
}: RecruitRowProps) {
  const p = prospect.player;
  const row = (
    <button
      type="button"
      className={cx('pb-rc-row', planned > 0 && 'is-planned')}
      onClick={onOpen}
    >
      <b className="pb-rc-row__rank">{prospect.rank || '–'}</b>
      <Face id={p.id} team={team} size={36} />
      <span className="pb-rc-row__main">
        <span className="pb-rc-row__top">
          <span className="pb-rc-row__name" title={p.name}>{shortName(p.name)}</span>
          <StarRow n={prospect.stars} size={12} />
          <span className={cx('pb-rc-status', `pb-rc-status--${status.tone}`)}>
            {status.icon && <Icon name={status.icon} size={12} />}
            {status.short}
          </span>
        </span>
        <span className="pb-rc-row__facts">{facts}</span>
        {race ? (
          <span className="pb-rc-row__race">
            <RaceBar race={race} />
            <span className="pb-rc-row__racetext">{raceText}</span>
            {/* Beside the staff's star column the line is 42px shorter, and
                "planned" is what the highlighted row already says. */}
            {planned > 0 && <span className="pb-rc-planned">{`${planned} ${planned === 1 ? 'pt' : 'pts'}${star ? '' : ' planned'}`}</span>}
          </span>
        ) : (
          <span className="pb-rc-row__note">{note}</span>
        )}
      </span>
    </button>
  );
  if (!star) return row;
  // The star sits beside the row rather than inside it (a button in a button
  // is not a button), in a column every row keeps whether or not it has one,
  // so nothing shifts from row to row.
  return (
    <div className="pb-rc-rowwrap">
      {row}
      {star.available ? (
        <button
          type="button"
          className={cx('pb-rc-star', star.on && 'is-on')}
          aria-pressed={star.on}
          aria-label={star.label}
          disabled={star.disabled}
          onClick={star.onToggle}
        >
          <Icon name={star.on ? 'star-filled' : 'star'} size={20} />
        </button>
      ) : <span className="pb-rc-star" aria-hidden />}
    </div>
  );
}

/** What the bar's two marks mean, once, under the list. */
export function RaceLegend() {
  return (
    <p className="pb-rc-legend">
      <span className="pb-rc-legend__you" aria-hidden />Your share of his interest
      <span className="pb-rc-legend__lead" aria-hidden />Leading school
    </p>
  );
}
