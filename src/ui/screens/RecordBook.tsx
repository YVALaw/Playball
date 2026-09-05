// RecordBook.tsx
// The national record book, grouped like an archive rather than a settings list.

import { useEffect, useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import {
  RECORDS, recordsIn, type RecordGroup, type RecordKey, type RecordMark,
} from '../../engine/records.js';
import { pct } from '../format.js';
import type { PlayerId } from '../../engine/types.js';
import { ChevronRightIcon } from '@radix-ui/react-icons';

const SECTIONS: Array<{ group: RecordGroup; title: string; note: string }> = [
  { group: 'game', title: 'Single game', note: 'One-night marks.' },
  { group: 'feat', title: 'Feats', note: 'Counts, not records — the name is the last man to do it.' },
  { group: 'season', title: 'Single season', note: 'Rate marks use leaderboard minimums.' },
  { group: 'career', title: 'Career', note: 'Rate marks require two qualifying seasons.' },
  { group: 'team', title: 'Team', note: 'Programs, not players.' },
  { group: 'coach', title: 'Coaching', note: 'Every head coach in the country.' },
];

export function RecordBook() {
  const season = useDynasty((s) => s.season);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const unseenRecords = useDynasty((s) => s.unseenRecords);
  const clearUnseenRecords = useDynasty((s) => s.clearUnseenRecords);
  const [fresh] = useState(() => new Set(unseenRecords));
  const [room, setRoom] = useState<RecordGroup>('game');
  useEffect(() => { clearUnseenRecords(); }, [clearUnseenRecords]);

  const known = useMemo(() => {
    const ids = new Set<string>();
    if (!season) return ids;
    for (const t of season.teams) {
      for (const p of [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen]) ids.add(p.id);
    }
    for (const id of Object.keys(season.careers ?? {})) ids.add(id);
    return ids;
  }, [season, version]);

  if (!season || !team) return null;
  const book = season.records ?? {};
  const ours = Object.values(book).filter((mark) => mark && !mark.ncaa && mark.team === team.def.abbr).length;
  const set = Object.values(book).filter(Boolean).length;

  return (
    <section className="record-book-modern">
      <div className="record-book-summary">
        <span><small>YOUR PROGRAM HOLDS</small><strong>{ours}</strong><em>all-time mark{ours === 1 ? '' : 's'}</em></span>
        <span><small>BOOK FILLED</small><strong>{set}</strong><em>records currently set</em></span>
      </div>
      <div className="record-book-key" aria-label="Record book legend">
        <span><i className="record-key-mine" /> YOUR PROGRAM</span>
        <span><Tag /> NCAA SEED</span>
        <span><b>NEW</b> SINCE LAST VISIT</span>
      </div>

      <nav className="record-room-selector" aria-label="Record book rooms">
        {SECTIONS.map((section) => {
          const active = room === section.group;
          const marks = recordsIn(section.group).filter((key) => book[key]).length;
          return (
            <button
              key={section.group}
              type="button"
              className={active ? 'active' : ''}
              onClick={() => setRoom(section.group)}
            >
              <small>{section.group === 'game' ? 'ONE NIGHT' : section.group === 'feat' ? 'RARE' : section.group.toUpperCase()}</small>
              <strong>{section.title}</strong>
              <span>{marks} set</span>
            </button>
          );
        })}
      </nav>

      {SECTIONS.filter((section) => section.group === room).map((section) => (
        <Section
          key={section.group}
          title={section.title}
          note={section.note}
          keys={recordsIn(section.group)}
          book={book}
          mine={team.def.abbr}
          known={known}
          fresh={fresh}
          onPick={openPlayer}
        />
      ))}
    </section>
  );
}

function Section({ title, note, keys, book, mine, known, fresh, onPick }: {
  title: string; note: string; keys: RecordKey[];
  book: Partial<Record<RecordKey, RecordMark>>; mine: string;
  known: Set<string>; fresh: Set<string>; onPick: (id: PlayerId) => void;
}) {
  return (
    <section className="record-group-card">
      <header><span><small>ALL-TIME RECORDS</small><strong>{title}</strong></span><p>{note}</p></header>
      <div className="record-group-rows">
        {keys.map((key) => <Row key={key} rkey={key} mark={book[key]} mine={mine} known={known} fresh={fresh} onPick={onPick} />)}
      </div>
    </section>
  );
}

function Row({ rkey, mark, mine, known, fresh, onPick }: {
  rkey: RecordKey; mark: RecordMark | undefined; mine: string;
  known: Set<string>; fresh: Set<string>; onPick: (id: PlayerId) => void;
}) {
  const spec = RECORDS[rkey];
  const ours = mark !== undefined && !mark.ncaa && mark.team === mine;
  const isNew = fresh.has(rkey);
  const tappable = mark?.id !== undefined && known.has(mark.id);
  const className = `record-modern-row${ours ? ' ours' : ''}${isNew ? ' is-new' : ''}${tappable ? ' tappable' : ''}`;
  const body = (
    <>
      <span className="record-modern-copy">
        <small>{isNew && <b>NEW</b>}{spec.label}</small>
        <strong>{mark?.holder ?? 'Not set'}</strong>
        {mark && <em>{mark.team} · {mark.year}{mark.ncaa ? ' · NCAA' : ''}</em>}
        {mark?.detail && <p>{mark.detail}</p>}
        {spec.frozen && <p>{spec.frozen}</p>}
      </span>
      <span className="record-modern-value">
        <strong>{mark ? format(mark.value, rkey) : '—'}</strong>
        {mark?.ncaa && <Tag />}
      </span>
      {tappable && <ChevronRightIcon />}
    </>
  );
  return tappable
    ? <button className={className} type="button" onClick={() => onPick(mark!.id as PlayerId)}>{body}</button>
    : <div className={className}>{body}</div>;
}

function Tag() { return <span className="ncaa-tag">NCAA</span>; }

function format(v: number, key: RecordKey): string {
  switch (RECORDS[key].shape) {
    case 'avg': return pct(v);
    case 'era': return v.toFixed(2);
    case 'tenth': return v.toFixed(1);
    case 'innings': {
      const outs = Math.round(v * 3);
      return `${Math.floor(outs / 3)}.${outs % 3}`;
    }
    default: return String(v);
  }
}
