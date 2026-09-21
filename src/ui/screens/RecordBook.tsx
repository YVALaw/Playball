// RecordBook.tsx
// The national record book, in six rooms.
//
// Single game, feats, single season, career, team and coaching. Each record is
// a row: what it is, who holds it with their school and year, and the mark.
// Your program's records carry a Yours tag, marks carried over from real life
// carry a Real-life record tag, and one set since your last visit is New; the
// room holding a new mark opens first and wears a dot until it is looked at.

import { useEffect, useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { RECORDS, recordsIn, type RecordGroup, type RecordKey, type RecordMark } from '../../engine/records.js';
import { pct } from '../format.js';
import type { PlayerId } from '../../engine/types.js';
import { Card, Chip, Chips, List, ListRow, Sheet, StatGroup, Tag } from '../components/ui/index.js';
import { capsWords, schoolNamesIn } from '../words.js';

const SECTIONS: Array<{ group: RecordGroup; title: string; note: string }> = [
  { group: 'game', title: 'Single game', note: 'The best one-night marks.' },
  { group: 'feat', title: 'Feats', note: 'Counts rather than records: the name is the last player to do it.' },
  { group: 'season', title: 'Single season', note: 'Rate records need the leaderboard minimums.' },
  { group: 'career', title: 'Career', note: 'Rate records need two qualifying seasons.' },
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
  const [room, setRoom] = useState<RecordGroup>(() =>
    SECTIONS.find((s) => recordsIn(s.group).some((key) => fresh.has(key)))?.group ?? 'game');
  const [seenRooms, setSeenRooms] = useState<Set<RecordGroup>>(() => new Set([room]));
  // Reported 2026-09-20: "if i click on your program holds, it should show a
  // modal with the details of the records we hold". The number was the only
  // place the game said how many, and the only place it would not say which.
  const [holdings, setHoldings] = useState(false);
  // The sheet steps aside while a player's card is up — see `Legacy.tsx` for
  // why the two layers cannot simply be ordered.
  const playerOpen = useDynasty((s) => s.selectedPlayer !== null);
  useEffect(() => { clearUnseenRecords(); }, [clearUnseenRecords]);

  // Only a player the save still knows can be opened.
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
  const ours = Object.values(book).filter((m) => m && !m.ncaa && m.team === team.def.abbr).length;
  const set = Object.values(book).filter(Boolean).length;
  const section = SECTIONS.find((s) => s.group === room)!;
  const schoolOf = (abbr: string): string => season.teams.find((t) => t.def.abbr === abbr)?.def.school ?? abbr;
  const words = (text: string): string => schoolNamesIn(text, season.teams);

  return (
    <>
      <StatGroup
        size="sm"
        items={[
          {
            label: 'Your program holds',
            value: ours,
            note: ours === 1 ? 'record' : 'records',
            ...(ours > 0 ? { onClick: () => setHoldings(true) } : {}),
          },
          { label: 'Records set', value: set, note: 'across the book' },
        ]}
      />
      {holdings && !playerOpen && (
        <Sheet
          eyebrow={team.def.school}
          title={`${ours === 1 ? 'The record' : 'The records'} you hold`}
          onClose={() => setHoldings(false)}
        >
          <List label="Records your program holds">
            {(Object.keys(book) as RecordKey[])
              .filter((key) => { const m = book[key]; return m && !m.ncaa && m.team === team.def.abbr; })
              .sort((a, b) => (book[b]!.year - book[a]!.year) || a.localeCompare(b))
              .map((key) => (
                <RecordRow
                  key={key}
                  rkey={key}
                  mark={book[key]}
                  mine={team.def.abbr}
                  school={schoolOf}
                  words={words}
                  known={known}
                  isNew={fresh.has(key)}
                  onPick={openPlayer}
                />
              ))}
          </List>
        </Sheet>
      )}
      <Chips label="Record book rooms">
        {SECTIONS.map((s) => {
          const news = !seenRooms.has(s.group) && recordsIn(s.group).some((key) => fresh.has(key));
          return (
            <Chip
              key={s.group}
              selected={room === s.group}
              icon={news ? 'dot' : undefined}
              onClick={() => { setRoom(s.group); setSeenRooms((prev) => new Set([...prev, s.group])); }}
            >
              {s.title}{news ? ' · new' : ''}
            </Chip>
          );
        })}
      </Chips>
      <Card title={section.title} eyebrow={section.note} flush>
        <List className="pb-list--inset" label={section.title}>
          {recordsIn(section.group).map((key) => (
            <RecordRow
              key={key}
              rkey={key}
              mark={book[key]}
              mine={team.def.abbr}
              school={schoolOf}
              words={words}
              known={known}
              isNew={fresh.has(key)}
              onPick={openPlayer}
            />
          ))}
        </List>
      </Card>
    </>
  );
}

function RecordRow({ rkey, mark, mine, school, words, known, isNew, onPick }: {
  rkey: RecordKey; mark: RecordMark | undefined; mine: string; school: (abbr: string) => string; words: (text: string) => string;
  known: Set<string>; isNew: boolean; onPick: (id: PlayerId) => void;
}) {
  const spec = RECORDS[rkey];
  const ours = mark !== undefined && !mark.ncaa && mark.team === mine;
  const tappable = mark?.id !== undefined && known.has(mark.id);
  return (
    <ListRow
      title={capsWords(spec.label)}
      subtitle={mark
        ? `${mark.holder} · ${school(mark.team)} · ${mark.year}${mark.detail ? ` · ${words(mark.detail)}` : ''}${spec.frozen ? ` · ${spec.frozen}` : ''}`
        : spec.frozen ?? 'Not set yet'}
      value={mark ? format(mark.value, rkey) : '—'}
      status={ours || isNew || mark?.ncaa ? (
        <>
          {isNew && <Tag tone="warning">New</Tag>}
          {ours && <Tag tone="you">Yours</Tag>}
          {mark?.ncaa && <Tag>Real-life record</Tag>}
        </>
      ) : undefined}
      onClick={tappable ? () => onPick(mark!.id as PlayerId) : undefined}
    />
  );
}

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
