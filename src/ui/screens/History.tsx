// History.tsx
// The program archive: its seasons, the record book, and the players who went on.
//
// Seasons: the titles with plain names, the all-time record, the win rate by
// season as labelled bars, and one card per season with its finish, record,
// conference place and final rank; seasons before you are marked. Alumni: a
// search, three filters, and every former player grouped by the year he left,
// with how far he went in words.

import { useMemo, useState } from 'react';
import { useDynasty, useUserTeam, type ArchiveSheet } from '../../state/store.js';
import { RecordBook } from './RecordBook.js';
import type { Finish } from '../../engine/postseason.js';
import type { SchoolSeason } from '../../engine/season.js';
import type { PlayerId } from '../../engine/types.js';
import { proCareer, proSeasons, COACHING_LEVEL, type AlumnusNote } from '../../engine/legacy.js';
import { collegeSummary } from '../ProgramBits.js';
import {
  Button, Card, Chip, Chips, DescriptionList, EmptyState, Face, List, ListRow, Marquee, Medal, PlayerRow,
  RatingRow, SearchField, SegmentedControl, StatGroup, StatusBadge, Tag,
} from '../components/ui/index.js';
import { ordinal, plural, proLevelName, recordText } from '../words.js';

/** How a season ended, in the postseason's words. */
const FINISH_WORDS: Record<Finish, string> = {
  missed: 'Missed the postseason',
  conference: 'Conference tournament',
  regional: 'Regionals',
  national: 'National tournament',
  omaha: 'National tournament',
  'runner-up': 'National runners-up',
  champion: 'National champions',
};

/** The win rate over the last seasons, as labelled bars. Exported for the Program hub. */
export function SeasonTrend({ seasons }: { seasons: readonly SchoolSeason[] }) {
  const years = [...seasons].sort((a, b) => a.year - b.year).slice(-8);
  if (years.length < 2) return null;
  return (
    <Card title="Win rate by season" eyebrow="Regular season, out of 100">
      {years.map((s) => (
        <RatingRow
          key={s.year}
          label={`${s.year} · ${recordText(s.w, s.l)}`}
          value={s.w + s.l > 0 ? Math.round((s.w / (s.w + s.l)) * 100) : 0}
        />
      ))}
    </Card>
  );
}

export function History() {
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const alumni = useDynasty((s) => s.alumni);
  const unseenRecords = useDynasty((s) => s.unseenRecords.length);
  // The page the hub's doors asked for, written back so a return resumes it.
  const sheet = useDynasty((s) => s.historySheet);
  const setSheet = useDynasty((s) => s.setHistorySheet);
  void version;
  if (!team) return null;

  return (
    <main className="pb-page">
      <Marquee
        eyebrow={`${team.def.school} · The yearbook`}
        title="History"
        numbers={(team.annals ?? []).length > 0 ? [
          {
            label: 'Seasons',
            value: (team.annals ?? []).length,
            note: recordText(
              (team.annals ?? []).reduce((a, s) => a + s.w, 0),
              (team.annals ?? []).reduce((a, s) => a + s.l, 0),
            ),
          },
          {
            label: 'Titles',
            value: (team.annals ?? []).filter((s) => s.finish === 'champion').length,
            note: 'National',
            tone: (team.annals ?? []).some((s) => s.finish === 'champion') ? 'positive' : undefined,
          },
          {
            label: 'Alumni',
            value: Object.values(alumni).filter((n) => n.teamAbbr === team.def.abbr).length,
            note: 'On file',
          },
        ] : undefined}
      />
      <SegmentedControl<ArchiveSheet>
        label="History"
        value={sheet}
        onChange={setSheet}
        options={[
          { value: 'seasons', label: 'Seasons' },
          { value: 'book', label: 'Record book', badge: unseenRecords > 0 ? true : undefined },
          { value: 'alumni', label: 'Alumni' },
        ]}
      />
      {sheet === 'seasons' && <Seasons annals={team.annals ?? []} />}
      {sheet === 'book' && <RecordBook />}
      {sheet === 'alumni' && <Alumni notes={alumni} teamAbbr={team.def.abbr} />}
    </main>
  );
}

function Seasons({ annals }: { annals: SchoolSeason[] }) {
  const history = useDynasty((s) => s.history);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const coachName = useDynasty((s) => s.coach.name);
  const team = useUserTeam();
  // Hooks above the empty state: the first June turns 0 rows into 1 in place.
  const [filter, setFilter] = useState<'all' | 'highlights'>('all');
  const [open, setOpen] = useState<Record<number, boolean>>({});

  if (!team) return null;
  if (annals.length === 0) {
    return <EmptyState icon="archive" title="No seasons yet" text="Finish your first season and this becomes the program's yearbook." />;
  }

  const wins = annals.reduce((a, s) => a + s.w, 0);
  const losses = annals.reduce((a, s) => a + s.l, 0);
  const titles = annals.filter((s) => s.finish === 'champion').length;
  const nationals = annals.filter((s) => s.finish === 'omaha' || s.finish === 'runner-up' || s.finish === 'champion').length;
  const conferenceTitles = annals.filter((s) => s.wonConference).length;
  const best = [...annals].sort((a, b) => b.w - a.w || a.l - b.l || b.year - a.year)[0]!;
  const awardsFor = (year: number) => history.find((r) => r.year === year && r.school === team.def.school)?.awards ?? [];
  const sorted = [...annals].sort((a, b) => b.year - a.year);
  const memorable = (s: SchoolSeason) => s.wonConference
    || s.finish === 'omaha' || s.finish === 'runner-up' || s.finish === 'champion' || s.year === best.year;
  const rows = sorted.filter((s) => filter === 'all' || memorable(s));

  return (
    <>
      <StatGroup
        size="sm"
        items={[
          { label: 'National titles', value: titles },
          { label: 'National tournaments', value: nationals, note: 'Trips' },
          { label: 'Conference titles', value: conferenceTitles },
        ]}
      />
      <DescriptionList
        items={[
          { label: 'All-time regular season', value: recordText(wins, losses) },
          { label: `Most wins · ${best.year}`, value: recordText(best.w, best.l), note: FINISH_WORDS[best.finish] },
        ]}
      />
      <SeasonTrend seasons={annals} />

      {annals.length > 4 && (
        <Chips label="Which seasons">
          <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>All seasons</Chip>
          <Chip selected={filter === 'highlights'} onClick={() => setFilter('highlights')}>Highlights</Chip>
        </Chips>
      )}

      {rows.map((s) => {
        const awards = awardsFor(s.year);
        const before = s.coach !== undefined && s.coach !== coachName;
        const medal = s.finish === 'champion' ? 'gold' : s.finish === 'runner-up' ? 'silver' : s.wonConference ? 'bronze' : null;
        const on = open[s.year] ?? false;
        return (
          <Card
            key={s.year}
            eyebrow={String(s.year)}
            title={FINISH_WORDS[s.finish]}
            trailing={(
              <>
                {before && <Tag>Before you</Tag>}
                {medal && <Medal metal={medal} size={36} label={medal === 'bronze' ? 'Conference champions' : FINISH_WORDS[s.finish]} />}
              </>
            )}
          >
            <StatGroup
              size="sm"
              items={[
                { label: 'Record', value: recordText(s.w, s.l), note: 'Regular season' },
                { label: 'Conference', value: s.confPlace > 0 ? ordinal(s.confPlace) : '—', note: s.wonConference ? 'Tournament champions' : undefined, noteTone: s.wonConference ? 'positive' : undefined },
                { label: 'Final rank', value: Number.isInteger(s.rank) && s.rank > 0 && s.rank <= 25 ? `#${s.rank}` : '—', note: s.rank > 25 ? 'Outside the top 25' : undefined },
              ]}
            />
            <Button variant="quiet" size="sm" iconAfter={on ? 'chevron-down' : 'chevron-right'} aria-expanded={on} onClick={() => setOpen({ ...open, [s.year]: !on })}>
              Season details{awards.length ? ` · ${plural(awards.length, 'award')}` : ''}
            </Button>
            {on && (
              <>
                <DescriptionList
                  items={[
                    { label: 'Conference record', value: Number.isFinite(s.cw) && Number.isFinite(s.cl) && s.cw + s.cl > 0 ? recordText(s.cw, s.cl) : '—' },
                    { label: 'Head coach', value: s.coach ?? '—' },
                  ]}
                />
                {awards.length > 0 && (
                  <List label={`${s.year} awards`}>
                    {awards.map((a, i) => (
                      <ListRow key={`${a.id}-${i}`} lead={<Medal metal="gold" size={28} />} title={a.name} subtitle={a.title} onClick={() => openPlayer(a.id)} />
                    ))}
                  </List>
                )}
              </>
            )}
          </Card>
        );
      })}
    </>
  );
}

/** How far a former player went, in words. */
function levelWords(level: string): string {
  if (level === 'THE SHOW') return 'Reached the majors';
  if (level === 'SIGNED') return 'Signed a pro contract';
  if (level === 'HOME') return 'Went home';
  return proLevelName(level);
}

function Alumni({ notes, teamAbbr }: { notes: Record<string, AlumnusNote>; teamAbbr: string }) {
  const year = useDynasty((s) => s.year);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const careers = useDynasty((s) => s.season?.careers);
  const hall = useDynasty((s) => s.season?.hall);
  const records = useDynasty((s) => s.season?.records);
  const history = useDynasty((s) => s.history);
  // Every hook above the empty state: the archive can gain its first row in place.
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'drafted' | 'honored'>('all');
  const [opened, setOpened] = useState<Record<number, boolean>>({});

  const rows = useMemo(() => {
    const honors = new Map<string, number>();
    for (const r of history) for (const a of r.awards ?? []) honors.set(a.id, (honors.get(a.id) ?? 0) + 1);
    const legends = new Set((hall ?? []).map((m) => String(m.id)));
    const held = new Set(Object.values(records ?? {}).map((m) => String(m.id)));
    return Object.entries(notes)
      .filter(([, note]) => note.teamAbbr === teamAbbr)
      .map(([key, note]) => {
        const id = key as PlayerId;
        const pro = proCareer(id, note, year);
        const showYears = pro.filter((r) => r.level === 'THE SHOW');
        const highest = pro.some((r) => r.level === 'THE SHOW') ? 'THE SHOW'
          : pro.some((r) => r.level === 'TRIPLE-A') ? 'TRIPLE-A'
            : pro.some((r) => r.level === 'DOUBLE-A') ? 'DOUBLE-A'
              : pro.some((r) => r.level === 'SINGLE-A') ? 'SINGLE-A'
                // The last level he played; coaching is on the same timeline
                // but is not a rung on the ladder.
                : [...pro].reverse().find((r) => r.level !== COACHING_LEVEL)?.level
                  ?? (note.reason === 'drafted' ? 'SIGNED' : 'HOME');
        const last = pro[pro.length - 1];
        // What he did here; a transfer's other college is his record, not ours.
        const college = collegeSummary((careers?.[id] ?? []).filter((y) => y.team === teamAbbr));
        return { id, note, pro, showYears, highest, last, college, legend: legends.has(id), honors: honors.get(id) ?? 0, record: held.has(id) };
      })
      .sort((a, b) => (b.showYears.length - a.showYears.length) || (b.note.year - a.note.year));
  }, [notes, teamAbbr, year, careers, hall, records, history]);

  if (rows.length === 0) {
    return <EmptyState icon="person" title="No alumni yet" text="When one of your players leaves, his path after college lives here." />;
  }

  const drafted = rows.filter((r) => r.note.reason === 'drafted').length;
  const reached = rows.filter((r) => r.showYears.length > 0).length;
  const active = rows.filter((r) => r.last && !r.last.final).length;
  const needle = query.trim().toLowerCase();
  const visible = rows.filter((r) => r.note.name.toLowerCase().includes(needle)
    && (filter === 'all' || (filter === 'drafted' ? r.note.reason === 'drafted' : r.legend || r.honors > 0 || r.record)));
  const searching = needle !== '' || filter !== 'all';
  const years = [...new Set(visible.map((r) => r.note.year))].sort((a, b) => b - a);

  return (
    <>
      <StatGroup
        size="sm"
        items={[
          { label: 'Drafted', value: drafted, note: 'From here' },
          { label: 'Reached the majors', value: reached },
          { label: 'Still playing', value: active, note: 'Pro careers' },
        ]}
      />
      <SearchField label="Search alumni" placeholder="Find a former player" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      <Chips label="Alumni filter">
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>Everyone</Chip>
        <Chip selected={filter === 'drafted'} onClick={() => setFilter('drafted')}>Drafted</Chip>
        <Chip selected={filter === 'honored'} onClick={() => setFilter('honored')}>Honored</Chip>
      </Chips>

      {visible.length === 0 ? (
        <EmptyState
          icon="search"
          title={needle ? 'Nobody by that name' : filter === 'drafted' ? 'Nobody drafted from here yet' : 'Nobody honored yet'}
          action={{ label: 'Show everyone', onClick: () => { setQuery(''); setFilter('all'); } }}
        />
      ) : years.map((left, i) => {
        const list = visible.filter((r) => r.note.year === left);
        const on = opened[left] ?? (searching || i === 0);
        const draftedThen = list.filter((r) => r.note.reason === 'drafted').length;
        return (
          <Card
            key={left}
            eyebrow={`${plural(list.length, 'player')} · ${draftedThen} drafted`}
            title={`Left in ${left}`}
            trailing={(
              <Button variant="quiet" size="sm" iconAfter={on ? 'chevron-down' : 'chevron-right'} aria-expanded={on} onClick={() => setOpened({ ...opened, [left]: !on })}>
                {on ? 'Hide' : 'Show'}
              </Button>
            )}
            flush={on}
          >
            {on ? (
              <List className="pb-list--inset" label={`Left in ${left}`}>
                {list.map(({ id, note, pro, showYears, highest, last, college, legend, honors, record }) => (
                  <PlayerRow
                    key={id}
                    name={note.name}
                    avatar={<Face id={id} team={teamAbbr} size={40} />}
                    tags={[college.hitting && college.pitching ? 'Two-way' : college.pitching ? 'Pitcher' : college.hitting ? 'Hitter' : note.reason === 'drafted' ? 'Drafted' : 'Graduated']}
                    meta={college.first ? (college.first === college.last ? `Here in ${college.first}` : `Here ${college.first}–${college.last}`) : `Left in ${note.year}`}
                    flags={(
                      <>
                        <StatusBadge tone={showYears.length > 0 ? 'positive' : 'neutral'} icon={false}>
                          {last?.level === COACHING_LEVEL ? 'Coaching now' : levelWords(highest)}
                          {proSeasons(pro) > 0 ? ` · ${plural(proSeasons(pro), 'pro season')}` : ''}
                        </StatusBadge>
                        {legend ? <Tag tone="positive">Hall of Fame</Tag>
                          : record ? <Tag tone="positive">Holds a national record</Tag>
                            : honors > 0 ? <Tag>{plural(honors, 'award')}</Tag> : null}
                        {note.reason === 'drafted' && <Tag>Drafted{note.round ? ` · round ${note.round}` : ''}</Tag>}
                      </>
                    )}
                    onClick={() => openPlayer(id)}
                  />
                ))}
              </List>
            ) : null}
          </Card>
        );
      })}
    </>
  );
}
