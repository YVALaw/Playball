// LegacySheets.tsx
// What is behind every number on the legacy screen.
//
// Reported 2026-09-20: "the end of the career should also be pressable and
// show related stats, for example nationals, if I tap on it it shows the
// related information. I would even add the rosters that won that tournament."
//
// Every sheet here reads only what outlives a career: the Legend's own season
// rows, the career book (`season.careers`, your program's men, year by year),
// the ninety six schools' annals, and the alumni notes. None of it needs the
// coach who retired to still be in the store, so a finished career reopened
// from the saves list months later opens exactly as it did the day it ended.
//
// What is genuinely gone — scores, brackets, who you beat in which round —
// is not invented. The one thing about a final that survives is the other
// school's own annals row reading "runner-up", and that is used.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import type { Legend, LegendYear } from '../../engine/retirement.js';
import { FINISH_LABEL } from '../../engine/postseason.js';
import { careerName, type CareerYear, type SchoolSeason } from '../../engine/season.js';
import { cx } from '../components/ui/core.js';
import {
  proCareer, levelWords, onTheLadder, playedIn, type Moment,
} from '../../engine/legacy.js';
import type { PlayerId } from '../../engine/types.js';
import { programAlumni } from '../programAlumni.js';
import {
  Card, Chip, Chips, EmptyState, List, ListRow, SectionHeader, Sheet, StatGroup, StatusBadge, Tag,
} from '../components/ui/index.js';
import { AwardEmblem, Trophy } from '../Honours.js';
import { plural, recordText, sentence } from '../words.js';
import { pct } from '../format.js';
import { CoachesList } from './CoachesList.js';

/** Which sheet is open. A stack, so a season opened from a list closes back to it. */
export type LegacySheet =
  | { kind: 'years'; title: string; filter: YearFilter }
  | { kind: 'season'; year: number }
  | { kind: 'school'; index: number }
  | { kind: 'pros' }
  | { kind: 'alltime' };

export type YearFilter = 'titles' | 'omaha' | 'conference' | 'bids' | 'all';

const KEEPS: Record<YearFilter, (y: LegendYear) => boolean> = {
  titles: (y) => y.finish === 'champion',
  omaha: (y) => y.finish === 'omaha' || y.finish === 'runner-up' || y.finish === 'champion',
  conference: (y) => y.wonConference,
  bids: (y) => y.finish !== 'missed' && y.finish !== 'conference',
  all: () => true,
};

/** A finish, in the words a season's page leads with. */
function finishWords(y: LegendYear): string {
  return y.finish === 'champion' ? 'National champions' : sentence(FINISH_LABEL[y.finish] ?? y.finish);
}

/** The letters a school files its players under, from whatever this row knows. */
function useAbbrOf(): (school: string, abbr?: string) => string {
  const season = useDynasty((s) => s.season);
  return (school, abbr) => abbr || (season?.teams.find((t) => t.def.school === school)?.def.abbr ?? '');
}

/** One line of a season, for a man's row: what he did, in the fewest words. */
function lineOf(y: CareerYear): string {
  const outs = y.outs ?? 0;
  if (outs > (y.ab ?? 0)) {
    const ip = `${Math.floor(outs / 3)}.${outs % 3}`;
    const era = outs > 0 ? ((((y.er ?? 0) * 27) / outs)).toFixed(2) : '—';
    return `${y.w ?? 0}–${y.l ?? 0} · ${era} ERA · ${ip} IP · ${y.k ?? 0} K`;
  }
  const ab = y.ab ?? 0;
  return `${ab > 0 ? pct((y.h ?? 0) / ab) : '—'} · ${y.hr ?? 0} HR · ${y.rbi ?? 0} RBI`;
}

// ------------------------------------------------------------------ the list

/** A list of seasons — the titles, the trips to Omaha, the league crowns. */
export function YearsSheet(
  { legend, title, filter, onOpen, onClose }:
  { legend: Legend; title: string; filter: YearFilter; onOpen: (year: number) => void; onClose: () => void },
) {
  const rows = (legend.years ?? []).filter(KEEPS[filter]).sort((a, b) => b.year - a.year);
  return (
    <Sheet eyebrow={legend.name} title={title} onClose={onClose}>
      {rows.length === 0 ? (
        <EmptyState
          icon="reader"
          title={legend.years ? 'None' : 'Not kept'}
          text={legend.years ? 'Not in this career.' : 'This career was written down before its seasons were kept.'}
        />
      ) : (
        <List label={title}>
          {rows.map((y) => (
            <ListRow
              key={y.year}
              title={String(y.year)}
              subtitle={`${y.school} · ${finishWords(y)}`}
              status={y.finish === 'champion' ? <Trophy kind="national" size={28} label="National champions" /> : undefined}
              value={recordText(y.w, y.l)}
              onClick={() => onOpen(y.year)}
            />
          ))}
        </List>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------- one season

/**
 * One season, as far as the world still remembers it: the finish, the team
 * that played it man by man, what they won, the nights worth keeping, and who
 * lost the final when there was one.
 */
export function SeasonSheet(
  { legend, year, onClose }: { legend: Legend; year: number; onClose: () => void },
) {
  const season = useDynasty((s) => s.season);
  const history = useDynasty((s) => s.history);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const abbrOf = useAbbrOf();
  const y = legend.years?.find((r) => r.year === year);
  if (!season || !y) return null;
  const abbr = abbrOf(y.school, y.abbr);

  // The men who played for you that year, from the career book.
  const men = Object.entries(season.careers ?? {}).flatMap(([id, rows]) => {
    const row = rows.find((r) => r.team === abbr && r.year === year);
    return row ? [{ id: id as PlayerId, row, name: row.name ?? careerName(id as PlayerId, rows) }] : [];
  });
  const arms = men.filter((m) => (m.row.outs ?? 0) > (m.row.ab ?? 0))
    .sort((a, b) => (b.row.outs ?? 0) - (a.row.outs ?? 0));
  const bats = men.filter((m) => !arms.includes(m))
    .sort((a, b) => (b.row.ab ?? 0) - (a.row.ab ?? 0));
  const played = men.filter((m) => m.row.june).length;

  // What they won that year. The legend carries its own copy, because the
  // history it was taken from goes the moment a successor is made; the fall
  // back is for a career written before the copy was kept.
  const awards = y.awards ?? history.find((h) => h.year === year)?.awards ?? [];

  // The nights worth keeping, June's first.
  const nights = men.flatMap((m) => (season.moments?.[m.id] ?? [])
    .filter((n: Moment) => n.year === year)
    .map((n: Moment) => ({ ...n, who: m.name })))
    .sort((a, b) => Number(b.postseason ?? false) - Number(a.postseason ?? false) || b.day - a.day)
    .slice(0, 6);

  // The one fact about the final that survives: the other school's own book.
  const runnerUp = y.finish === 'champion'
    ? season.teams.find((t) => t.def.abbr !== abbr
      && (t.annals ?? []).some((a) => a.year === year && a.finish === 'runner-up'))?.def.school
    : undefined;

  const row = (m: typeof men[number]) => (
    <ListRow
      key={m.id}
      title={m.name}
      subtitle={`${m.row.classYear ?? ''}${m.row.classYear ? ' · ' : ''}${lineOf(m.row)}`}
      status={m.row.june ? <Tag tone="positive">June</Tag> : undefined}
      onClick={() => openPlayer(m.id)}
    />
  );

  return (
    <Sheet eyebrow={`${y.school} · ${year}`} title={finishWords(y)} subtitle={recordText(y.w, y.l)} onClose={onClose} tall>
      {runnerUp && (
        <Card>
          <StatGroup
            size="sm"
            items={[
              { label: 'Record', value: recordText(y.w, y.l) },
              { label: 'The final', value: 'Won', note: `over ${runnerUp}`, noteTone: 'positive' },
            ]}
          />
        </Card>
      )}

      {men.length === 0 ? (
        <EmptyState icon="person" title="No roster kept" text="Nobody's line from this season was written into the book." />
      ) : (
        <>
          <SectionHeader
            title="The team"
            count={plural(men.length, 'man', 'men')}
            description={played > 0 ? `${played} played in June` : undefined}
          />
          {bats.length > 0 && (
            <Card title="At the plate" flush>
              <List label="Hitters" className="pb-list--inset">{bats.map(row)}</List>
            </Card>
          )}
          {arms.length > 0 && (
            <Card title="On the mound" flush>
              <List label="Pitchers" className="pb-list--inset">{arms.map(row)}</List>
            </Card>
          )}
        </>
      )}

      {awards.length > 0 && (
        <Card title="What they won" flush>
          <List label="Awards" className="pb-list--inset">
            {awards.map((a) => (
              <ListRow
                key={`${a.title}-${a.id}`}
                lead={<AwardEmblem title={a.title} size={40} />}
                title={a.name}
                subtitle={a.title}
                onClick={() => openPlayer(a.id as PlayerId)}
              />
            ))}
          </List>
        </Card>
      )}

      {nights.length > 0 && (
        <Card title="Nights worth keeping" flush>
          <List label="Moments" className="pb-list--inset">
            {nights.map((n, i) => (
              <ListRow
                key={`${n.who}-${n.day}-${i}`}
                title={n.who}
                subtitle={n.line}
                status={n.postseason ? <Tag tone="positive">June</Tag> : undefined}
              />
            ))}
          </List>
        </Card>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------- one school

/** A stop on the career: the years, the record, and the program before and after. */
export function SchoolSheet(
  { legend, index, onOpen, onClose }:
  { legend: Legend; index: number; onOpen: (year: number) => void; onClose: () => void },
) {
  const season = useDynasty((s) => s.season);
  const abbrOf = useAbbrOf();
  const stint = legend.stints[index];
  if (!season || !stint) return null;
  const abbr = abbrOf(stint.school, stint.abbr);
  const team = season.teams.find((t) => t.def.abbr === abbr);
  // A year the school's own book never recorded is a gap, not a nought: an
  // empty bar in the run would read as a season they lost every game of.
  const annals = (team?.annals ?? [])
    .filter((a) => a.year >= stint.from && a.year <= stint.to && a.w + a.l > 0)
    .sort((a, b) => a.year - b.year);
  const before = team?.annals?.find((a) => a.year === stint.from - 1);
  const after = team?.annals?.find((a) => a.year === stint.to + 1);
  const years = (legend.years ?? []).filter((y) => y.school === stint.school).sort((a, b) => b.year - a.year);
  const seasons = stint.to - stint.from + 1;
  const games = stint.w + stint.l;

  return (
    <Sheet
      eyebrow={legend.name}
      title={stint.school}
      subtitle={stint.from === stint.to ? String(stint.from) : `${stint.from}–${stint.to}`}
      onClose={onClose}
      tall
    >
      <StatGroup
        size="sm"
        items={[
          { label: 'Seasons', value: seasons },
          { label: 'Record', value: games > 0 ? recordText(stint.w, stint.l) : '—', note: games > 0 ? `${pct(stint.w / games)} won` : undefined },
          { label: 'Titles', value: stint.titles, noteTone: stint.titles > 0 ? 'positive' : undefined },
        ]}
      />

      {(before || after) && (
        <StatGroup
          size="sm"
          label="Before and after"
          items={[
            { label: 'The year before you', value: before ? `#${before.rank}` : '—', note: before ? recordText(before.w, before.l) : 'Your first year here' },
            { label: after ? 'The year after you' : 'Your last year', value: `#${(after ?? annals[annals.length - 1])?.rank ?? '—'}`, note: after ? recordText(after.w, after.l) : undefined },
          ]}
        />
      )}

      {annals.length > 1 && <Run annals={annals} school={stint.school} />}

      {years.length > 0 && (
        <Card title="Every season" flush>
          <List label="Seasons" className="pb-list--inset">
            {years.map((y) => (
              <ListRow
                key={y.year}
                title={String(y.year)}
                subtitle={finishWords(y)}
                status={y.finish === 'champion' ? <Trophy kind="national" size={28} label="National champions" /> : undefined}
                value={recordText(y.w, y.l)}
                onClick={() => onOpen(y.year)}
              />
            ))}
          </List>
        </Card>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------------ the pros

/** The men who came through your teams and went on, with how far they got. */
/** The affiliated ladder, highest first. Everywhere else is not a ladder. */
const LADDER = ['THE SHOW', 'TRIPLE-A', 'DOUBLE-A', 'SINGLE-A', 'ROOKIE BALL'] as const;

export function ProsSheet({ legend, onClose }: { legend: Legend; onClose: () => void }) {
  const rows = useLegendPros(legend);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const [level, setLevel] = useState<string | null>(null);

  /*
    Every place they actually went, chipped.

    Reported 2026-09-20: "on the pros it is not registering the ones that went
    other leagues like Venezuela, Dominican Republic, Japan, Korea etc." They
    were in the list and unlabelled, because the filter only knew the five
    affiliated rungs — and `engine/legacy.ts` sends men to thirteen other
    places. The chips are built from where this coach's men actually ended up,
    so a career that never sent anybody to Taiwan never says the word.

    Counted on "played there at all" rather than "peaked there": a summer in
    Japan is not a rung below Triple-A, it is a different thing that happened.
  */
  const count = (l: string): number => rows.filter((r) => r.levels.includes(l)).length;
  const elsewhere = [...new Set(rows.flatMap((r) => r.levels))]
    .filter((l) => !onTheLadder(l))
    .sort((a, b) => count(b) - count(a) || levelWords(a).localeCompare(levelWords(b)));
  const chips = [...LADDER.filter((l) => count(l) > 0), ...elsewhere];
  const shown = level ? rows.filter((r) => r.levels.includes(level)) : rows;

  return (
    <Sheet
      eyebrow={legend.name}
      title="The men you sent up"
      subtitle={plural(rows.length, 'man', 'men')}
      onClose={onClose}
      tall
    >
      {rows.length === 0 ? (
        <EmptyState icon="person" title="Nobody yet" text="None of your players went on to professional ball." />
      ) : (
        <>
          <Chips label="How far they got">
            <Chip selected={level === null} onClick={() => setLevel(null)}>{`All ${rows.length}`}</Chip>
            {chips.map((l) => (
              <Chip key={l} selected={level === l} onClick={() => setLevel(l)}>
                {`${levelWords(l)} ${count(l)}`}
              </Chip>
            ))}
          </Chips>
          <List label="Former players">
            {shown.map((r) => (
              <ListRow
                key={r.id}
                title={r.name}
                subtitle={`${r.school} · left ${r.year}${r.round ? ` · round ${r.round}` : ''}`}
                status={(
                  <>
                    {r.highest === 'THE SHOW'
                      ? <StatusBadge tone="positive" icon="star">{r.showYears > 1 ? `The Show · ${r.showYears} yrs` : 'The Show'}</StatusBadge>
                      : r.highest ? <StatusBadge tone="neutral" icon={false}>{levelWords(r.highest)}</StatusBadge> : undefined}
                    {/* And the summers that were not on the ladder at all. */}
                    {r.levels.filter((l) => !onTheLadder(l)).map((l) => (
                      <Tag key={l}>{levelWords(l)}</Tag>
                    ))}
                  </>
                )}
                onClick={() => openPlayer(r.id)}
              />
            ))}
          </List>
        </>
      )}
    </Sheet>
  );
}

/** Every man who left one of this career's programs, in its years, for the pros. */
export function useLegendPros(legend: Legend) {
  const season = useDynasty((s) => s.season);
  const alumni = useDynasty((s) => s.alumni);
  const portal = useDynasty((s) => s.portal);
  const year = useDynasty((s) => s.year);
  const abbrOf = useAbbrOf();
  const out: Array<{
    id: PlayerId; name: string; school: string; year: number; round?: number;
    /** His best affiliated rung, where he was on that ladder at all. */
    highest?: string;
    showYears: number;
    /** Everywhere he played, the ladder and the rest, oldest first. */
    levels: string[];
  }> = [];
  for (const st of legend.stints) {
    const abbr = abbrOf(st.school, st.abbr);
    if (!abbr) continue;
    for (const a of programAlumni({ season, alumni, portal }, abbr)) {
      if (!a.note || a.year < st.from || a.year > st.to) continue;
      const pro = proCareer(a.id, a.note, year);
      // Summers actually played: a man who went home in June and finished his
      // degree has a row too, and counting it called him a professional.
      const played = pro.filter((r) => playedIn(r.level));
      if (played.length === 0) continue;
      const showYears = played.filter((r) => r.level === 'THE SHOW').length;
      const highest = LADDER.find((l) => played.some((r) => r.level === l));
      out.push({
        id: a.id, name: a.name, school: st.school, year: a.year,
        round: a.note.round, highest, showYears,
        levels: [...new Set(played.map((r) => r.level))],
      });
    }
  }
  return out.sort((a, b) => b.showYears - a.showYears || b.year - a.year);
}

// ------------------------------------------------------------------ all-time

/** Where the career stands among every one the world has finished. */
export function AllTimeSheet({ onClose }: { onClose: () => void }) {
  const legends = useDynasty((s) => s.season?.legends ?? []);
  return (
    <Sheet eyebrow="The coaches' wall" title="All-time" onClose={onClose} tall>
      <CoachesList legends={legends} title="Every finished career" open />
    </Sheet>
  );
}

/**
 * Twenty years of a program, in one strip.
 *
 * `Trend` is built for a few bars with their numbers on top; a tenure can run
 * to twenty-one of them, and at that width the numbers collided, the stars
 * that marked the titles replaced the only number a bar had, and the whole row
 * ran off the side of the card. Reported with a picture of exactly that.
 *
 * So: no numbers. The shape is the point — where the bad years were, where it
 * turned, how it ended — and the titles are named underneath in words rather
 * than hidden in a glyph. Every season is still listed in full below this.
 */
function Run({ annals, school }: { annals: readonly SchoolSeason[]; school: string }) {
  const titles = annals.filter((a) => a.finish === 'champion').map((a) => a.year);
  const first = annals[0]?.year;
  const last = annals[annals.length - 1]?.year;
  return (
    <Card title="How it went" flush>
      <div className="pb-run">
        <div
          className="pb-run__bars"
          role="img"
          aria-label={`${school}, win rate season by season, ${first} to ${last}`}
        >
          {annals.map((a) => {
            const games = a.w + a.l;
            const rate = games > 0 ? a.w / games : 0;
            return (
              <span
                key={a.year}
                className={cx('pb-run__bar', a.finish === 'champion' && 'is-title', rate < 0.5 && 'is-down')}
                title={`${a.year} · ${a.w}–${a.l}`}
              >
                <i style={{ height: `${Math.max(6, Math.round(rate * 100))}%` }} />
              </span>
            );
          })}
        </div>
        <div className="pb-run__axis">
          <span>{first}</span>
          <span>{last}</span>
        </div>
        {titles.length > 0 && (
          <p className="pb-run__note">
            {`Titles in ${titles.join(', ')}`}
          </p>
        )}
      </div>
    </Card>
  );
}
