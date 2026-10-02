// RecruitFilters.tsx
// Narrowing the board: the filter pill and the removable pills under the view
// chips, and the sheet the filters are set in.
//
// The same six filters `matchesFilters` has always kept — position, stars,
// home state, pipeline, untouched, in reach — laid out the way the UI clarity
// review drew them: a grid of position codes, five star tiles, a state
// picker, and three switches that each say in one line what they hide.

import type { ReactNode } from 'react';
import { ALL_STATES } from '../../data/schools.js';
import { Button, cx, Icon, List, Sheet, Switch } from '../components/ui/index.js';
import { plural, stateName } from '../words.js';
import type { Filters } from './Board.js';
import { StarRow } from './RecruitRow.js';
import { posName } from './recruitRace.js';

/** The position grid, five across: the infield, then the outfield and the arms. */
const POSITIONS: readonly string[] = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'SP', 'RP'];

/** Every filter that is on, as a pill: its words, and what turning it off sets. */
export function filterPills(f: Filters): { key: string; label: string; star?: boolean; off: Partial<Filters> }[] {
  return [
    ...(f.pos ? [{ key: 'pos', label: posName(f.pos), off: { pos: null } }] : []),
    ...(f.stars.length > 0 ? [{ key: 'stars', label: f.stars.join(', '), star: true, off: { stars: [] } }] : []),
    ...(f.state ? [{ key: 'state', label: stateName(f.state), off: { state: null } }] : []),
    ...(f.pipelineOnly ? [{ key: 'pipeline', label: 'Pipeline states', off: { pipelineOnly: false } }] : []),
    ...(f.untouchedOnly ? [{ key: 'untouched', label: 'Nobody on him yet', off: { untouchedOnly: false } }] : []),
    ...(f.reachOnly ? [{ key: 'reach', label: 'In reach', off: { reachOnly: false } }] : []),
  ];
}

/**
 * The filter pill and a pill for every filter that is on.
 *
 * One line that scrolls sideways rather than wrapping: the bar is pinned over
 * the list, and a second line of pills would push every row down the moment
 * a filter went on.
 */
export function FilterBar({
  filters, onOpen, onChange, onClear,
}: {
  filters: Filters; onOpen: () => void; onChange: (f: Filters) => void; onClear: () => void;
}) {
  const pills = filterPills(filters);
  const on = pills.length;
  return (
    <div className="pb-rc-filters" role="group" aria-label="Filters">
      <button type="button" className={cx('pb-rc-fbtn', on > 0 && 'is-on')} onClick={onOpen}>
        <Icon name="filter" size={15} />
        {on > 0 ? 'Filters on' : 'Filter'}
        {on > 0 && <span className="pb-rc-fbtn__n">{on}</span>}
      </button>
      {pills.map((p) => (
        <button
          key={p.key}
          type="button"
          className="pb-rc-pill"
          aria-label={`Remove ${p.star ? `${p.label} stars` : p.label}`}
          onClick={() => onChange({ ...filters, ...p.off })}
        >
          {p.label}
          {p.star && <Icon name="star-filled" size={11} className="pb-rc-pill__star" />}
          <span className="pb-rc-pill__x" aria-hidden><Icon name="cross" size={11} /></span>
        </button>
      ))}
      {on > 0 && <button type="button" className="pb-rc-clear" onClick={onClear}>Clear all</button>}
    </div>
  );
}

/** A section of the sheet: its small label, and what may be picked in it. */
function Section({ label, pick, children }: { label: string; pick?: string; children: ReactNode }) {
  return (
    <section className="pb-rc-fsec">
      <div className="pb-rc-fsec__head">
        <span className="pb-rc-label">{label}</span>
        {pick && <small>{pick}</small>}
      </div>
      {children}
    </section>
  );
}

export function FilterSheet({
  filters, onChange, onClear, onClose, label, none, homeState,
}: {
  filters: Filters; onChange: (f: Filters) => void; onClear: () => void; onClose: () => void;
  /** What the board shows once the sheet closes: "Show 42 prospects". */
  label: string;
  /** Nothing matches: the button still closes the sheet, and looks it. */
  none: boolean;
  homeState: string;
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const toggleStar = (n: number) => set('stars', filters.stars.includes(n)
    ? filters.stars.filter((s) => s !== n)
    : [...filters.stars, n].sort((a, b) => b - a));
  const active = filterPills(filters).length;
  const states = [...ALL_STATES].sort((a, b) => stateName(a).localeCompare(stateName(b)));

  return (
    <Sheet
      eyebrow={active > 0 ? <span className="pb-rc-on">{plural(active, 'filter')} on</span> : undefined}
      title="Filter prospects"
      onClose={onClose}
      className="pb-rc-fsheet"
      footer={(
        <div className="pb-recruit-filterfoot">
          <Button variant="secondary" disabled={active === 0} onClick={onClear}>Clear all</Button>
          <Button variant="primary" className={cx(none && 'pb-rc-none')} onClick={onClose}>{label}</Button>
        </div>
      )}
    >
      <Section label="Position" pick="Pick one">
        <div className="pb-rc-posgrid" role="group" aria-label="Position">
          {POSITIONS.map((pos) => {
            const on = filters.pos === pos;
            return (
              <button
                key={pos}
                type="button"
                title={posName(pos)}
                aria-label={posName(pos)}
                aria-pressed={on}
                className={cx('pb-rc-opt', on && 'is-on')}
                onClick={() => set('pos', on ? null : pos)}
              >{pos}</button>
            );
          })}
        </div>
      </Section>
      <Section label="Stars" pick="Pick any">
        <div className="pb-rc-stargrid" role="group" aria-label="Stars">
          {[5, 4, 3, 2, 1].map((n) => {
            const on = filters.stars.includes(n);
            return (
              <button
                key={n}
                type="button"
                aria-label={plural(n, 'star')}
                aria-pressed={on}
                className={cx('pb-rc-opt', 'pb-rc-opt--stars', on && 'is-on')}
                onClick={() => toggleStar(n)}
              >
                <b>{n}</b>
                <StarRow n={n} size={9} />
              </button>
            );
          })}
        </div>
      </Section>
      <Section label="Home state">
        <label className={cx('pb-rc-select', filters.state && 'is-on')}>
          <select
            aria-label="Home state"
            value={filters.state ?? ''}
            onChange={(e) => set('state', e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Anywhere</option>
            {states.map((st) => (
              <option key={st} value={st}>{stateName(st)}{st === homeState ? ' (yours)' : ''}</option>
            ))}
          </select>
          <Icon name="chevron-down" size={16} />
        </label>
      </Section>
      <Section label="More filters">
        <List label="More filters" className="pb-rc-switches">
          <Switch
            label="Pipeline states only"
            description="Home, staff or earned pipelines"
            checked={filters.pipelineOnly}
            onChange={() => set('pipelineOnly', !filters.pipelineOnly)}
          />
          <Switch
            label="Nobody recruiting him yet"
            description="No program has put a point on him"
            checked={filters.untouchedOnly}
            onChange={() => set('untouchedOnly', !filters.untouchedOnly)}
          />
          <Switch
            label="In reach only"
            description="Hide the men who will not take your call"
            checked={filters.reachOnly}
            onChange={() => set('reachOnly', !filters.reachOnly)}
          />
        </List>
      </Section>
    </Sheet>
  );
}
