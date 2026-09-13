// History.tsx
// The program archive: seasons, national records, and the men who went on.
//
// History is a reading surface, but it should still feel like the same app as
// Budget and the modern profiles. Seasons are yearbook cards rather than a raw
// table; The Book owns its own grouped record cards; Alumni surfaces the pro
// career system that used to exist only if you remembered to reopen a player.
//
// 2026-09-13, from the program pass: the shelf at the top is the answer to
// "what has this program done" — titles, the all-time record, the winningest
// year and six seasons of shape — so the yearbook below it can be scanned
// rather than read. A season card carries its record and its chips; the
// conference line, the coach and the honors fold away. Alumni gained a search,
// a three-way filter and the college career each man actually had here, which
// is the half of an alumnus the archive never showed.

import { useMemo, useState } from 'react';
import { useDynasty, useUserTeam, type ArchiveSheet } from '../../state/store.js';
import { Metric, MetricStrip, ModuleIntro, Segmented } from '../components/Kit.js';
import { RecordBook } from './RecordBook.js';
import { FINISH_LABEL, type Finish } from '../../engine/postseason.js';
import type { SchoolSeason } from '../../engine/season.js';
import type { PlayerId } from '../../engine/types.js';
import { proCareer, COACHING_LEVEL, type AlumnusNote } from '../../engine/legacy.js';
import { ChevronRightIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { Avatar } from '../Avatar.js';
import { collegeSummary } from '../ProgramBits.js';

const FINISH_COLOR: Record<Finish, string> = {
  missed: 'var(--dim)',
  conference: 'var(--ink)',
  regional: 'var(--ink)',
  national: 'var(--ink)',
  omaha: 'var(--clay)',
  'runner-up': 'var(--clay)',
  champion: 'var(--clay)',
};

/**
 * Six seasons of win percentage, as bars. The only thing in the archive that
 * shows a direction rather than a state.
 *
 * The scale is a true 0–100, not a min/max fit: college seasons cluster in the
 * .400–.750 band and a truncated axis would turn one extra win into a cliff.
 */
export function SeasonTrend({ seasons }: { seasons: readonly SchoolSeason[] }) {
  const years = [...seasons].sort((a, b) => a.year - b.year).slice(-6);
  if (years.length < 2) return null;
  return (
    <section className="program-trend" aria-label="Win percentage by season">
      <div className="program-trend-head"><small>PROGRAM TRAJECTORY</small><em>REG SEASON WIN %</em></div>
      <div className="program-trend-bars">
        {years.map((s) => {
          const value = s.w + s.l > 0 ? Math.round(s.w / (s.w + s.l) * 100) : 0;
          return (
            <div key={s.year} className={s.finish === 'champion' ? 'champion' : ''}>
              <strong>{value}</strong>
              <span><i style={{ height: `${value}%` }} /></span>
              <small>{s.year}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function History() {
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const alumni = useDynasty((s) => s.alumni);
  const unseenRecords = useDynasty((s) => s.unseenRecords.length);
  // The landing page is whatever the hub's legacy doors asked for, and the
  // strip writes it back, so returning to HISTORY resumes where you left it.
  const sheet = useDynasty((s) => s.historySheet);
  const setSheet = useDynasty((s) => s.setHistorySheet);
  const teamAbbr = team?.def.abbr ?? '';
  // Alumni can grow into the hundreds over a long dynasty. The default History
  // landing page is Seasons, so do not scan the entire alumni archive merely to
  // render a title the player is not looking at. This used to happen on every
  // HISTORY mount and compounded the context-nav snapshot cost on older saves.
  const programAlumniCount = useMemo(() => {
    if (sheet !== 'alumni' || !teamAbbr) return 0;
    let count = 0;
    for (const note of Object.values(alumni)) if (note.teamAbbr === teamAbbr) count += 1;
    return count;
  }, [sheet, alumni, teamAbbr, version]);

  if (!team) return null;

  const annals = team.annals ?? [];

  const title = sheet === 'seasons'
    ? (annals.length > 0 ? `${annals.length} season${annals.length === 1 ? '' : 's'}` : 'History')
    : sheet === 'book' ? 'The Book'
      : programAlumniCount > 0 ? `${programAlumniCount} alumni` : 'Alumni';

  return (
    <main className="module-workspace history-workspace">
      <ModuleIntro kicker="PROGRAM ARCHIVE" title={title} />
      <Segmented<ArchiveSheet>
        label="History view"
        value={sheet}
        onChange={setSheet}
        options={[
          { value: 'seasons', label: 'Seasons' },
          { value: 'book', label: 'The Book', alert: unseenRecords > 0 },
          { value: 'alumni', label: 'Alumni' },
        ]}
      />
      {sheet === 'seasons' && <Seasons annals={annals} />}
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
  // Above the empty state: the hook count must not depend on whether the
  // archive has rows yet, because the first June turns 0 into 1 in place.
  const [filter, setFilter] = useState<'all' | 'highlights'>('all');

  if (!team) return null;

  if (annals.length === 0) {
    return (
      <section className="history-empty">
        <small>NO SEASONS ON RECORD</small>
        <strong>The archive starts in June.</strong>
        <p>Finish the first season and this page becomes the program's yearbook.</p>
      </section>
    );
  }

  const wins = annals.reduce((a, s) => a + s.w, 0);
  const losses = annals.reduce((a, s) => a + s.l, 0);
  const titles = annals.filter((s) => s.finish === 'champion').length;
  const omaha = annals.filter(
    (s) => s.finish === 'omaha' || s.finish === 'runner-up' || s.finish === 'champion',
  ).length;
  const rings = annals.filter((s) => s.wonConference).length;
  // Most wins, then fewest losses, then the most recent of a tie.
  const best = [...annals].sort((a, b) => b.w - a.w || a.l - b.l || b.year - a.year)[0]!;

  const awardsFor = (year: number) => history
    .find((r) => r.year === year && r.school === team.def.school)?.awards ?? [];

  const sorted = [...annals].sort((a, b) => b.year - a.year);
  const memorable = (s: SchoolSeason) => s.wonConference
    || s.finish === 'omaha' || s.finish === 'runner-up' || s.finish === 'champion'
    || s.year === best.year;
  /*
    Era boundaries are computed on the FULL list, never on the filtered one. A
    predecessor's run does not end because you hid the seasons in the middle of
    it, and reading `previous` off the filtered array fabricates a divider every
    time Highlights skips a year. An unknown coach — old rows carry none — is
    one contiguous run, not a divider per season.
  */
  const eraStart = new Set<number>();
  sorted.forEach((s, i) => {
    const previous = sorted[i - 1];
    if (s.coach && (!previous || previous.coach !== s.coach)) eraStart.add(s.year);
  });
  const rows = sorted.filter((s) => filter === 'all' || memorable(s));

  return (
    <section className="season-archive">
      <MetricStrip>
        <Metric label="TITLES" value={String(titles)} note="NATIONAL" />
        <Metric label="OMAHA" value={String(omaha)} note="TRIPS" />
        <Metric label="CONF TITLES" value={String(rings)} note="RINGS" />
      </MetricStrip>

      {/* One shelf, not three stacked panels. The label is honest: a season
          row carries the REGULAR-season record, so June is not in this number. */}
      <section className="program-shelf">
        <div className="program-record-line">
          <span>ALL-TIME REGULAR SEASON</span><strong>{wins}–{losses}</strong>
        </div>
        <div className="program-best-season">
          <span><small>MOST WINS · {best.year}</small><strong>{best.w}–{best.l}</strong></span>
          <span><b>{FINISH_LABEL[best.finish]}</b><small>{best.coach ?? team.def.school}</small></span>
        </div>
      </section>

      <SeasonTrend seasons={annals} />

      <div className="season-yearbook-head">
        <span><small>YEARBOOK</small><strong>{rows.length === sorted.length
          ? `${sorted.length} completed season${sorted.length === 1 ? '' : 's'}`
          : `${rows.length} of ${sorted.length} seasons`}</strong></span>
        <em>NEWEST FIRST</em>
      </div>
      {annals.length > 4 && (
        <Segmented<'all' | 'highlights'>
          label="Season filter"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'All seasons' }, { value: 'highlights', label: 'Highlights' }]}
        />
      )}

      <div className="season-yearbook">
        {rows.map((s) => {
          const awards = awardsFor(s.year);
          const notYou = s.coach !== undefined && s.coach !== coachName;
          const deep = s.finish === 'omaha' || s.finish === 'runner-up' || s.finish === 'champion';
          const conference = Number.isFinite(s.cw) && Number.isFinite(s.cl) && s.cw + s.cl > 0
            ? `${s.cw}–${s.cl}` : '—';
          return (
            <div key={s.year}>
              {eraStart.has(s.year) && (
                <div className="season-era">{notYou ? `${s.coach} era` : `Your era · ${s.coach}`}</div>
              )}
              <article className={`season-card${s.finish === 'champion' ? ' champion' : deep ? ' deep-run' : ''}`}>
                <header>
                  <span><small>SEASON</small><strong>{s.year}</strong></span>
                  <b style={{ color: FINISH_COLOR[s.finish] }}>{FINISH_LABEL[s.finish]}</b>
                </header>
                <div className="season-card-score">
                  <span><small>REG SEASON</small><strong>{s.w}-{s.l}</strong></span>
                  <span><small>CONFERENCE</small><strong>{s.confPlace > 0 ? ordinal(s.confPlace) : '—'}</strong></span>
                  <span><small>FINAL RANK</small><strong>{Number.isInteger(s.rank) && s.rank > 0 && s.rank <= 25 ? `#${s.rank}` : '—'}</strong></span>
                </div>
                <span className="season-card-chips">
                  {s.wonConference && <i>Conference champions</i>}
                  {s.year === best.year && <i>Most wins</i>}
                  {notYou && <i className="quiet">Inherited</i>}
                </span>
                <details className="season-card-detail">
                  <summary>SEASON DETAIL{awards.length > 0 ? ` · ${awards.length} HONOR${awards.length === 1 ? '' : 'S'}` : ''}</summary>
                  <div className="program-record-line"><span>CONFERENCE RECORD</span><strong>{conference}</strong></div>
                  {s.coach && <div className="program-record-line"><span>HEAD COACH</span><strong>{s.coach}</strong></div>}
                  {awards.length > 0 && (
                    <div className="season-card-awards">
                      {awards.map((a, i) => (
                        <button key={`${a.id}-${i}`} type="button" onClick={() => openPlayer(a.id)}>
                          <span><b>{a.title}</b><strong>{a.name}</strong></span><ChevronRightIcon />
                        </button>
                      ))}
                    </div>
                  )}
                </details>
              </article>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Alumni({ notes, teamAbbr }: { notes: Record<string, AlumnusNote>; teamAbbr: string }) {
  const year = useDynasty((s) => s.year);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const careers = useDynasty((s) => s.season?.careers);
  const hall = useDynasty((s) => s.season?.hall);
  const records = useDynasty((s) => s.season?.records);
  const history = useDynasty((s) => s.history);
  /*
    Every hook above the empty state. This component renders once with an empty
    archive and then again, in place, the first June a man leaves campus — and
    a `useState` below the early return changes the hook count between those two
    renders, which React answers by throwing the whole screen away.
  */
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'drafted' | 'honored'>('all');
  const [opened, setOpened] = useState<Record<number, boolean>>({});

  // proCareer is deterministic and not free; once per book and year, not per
  // render. The honors, hall and record sets are read from narrow slices so a
  // sim tick does not re-run the whole scan while the sheet is open.
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
                // The fallback is the last row he PLAYED. Coaching is a row on
                // the same timeline and not a rung on the ladder, so a man who
                // never got out of Rookie ball and then took his old high school
                // would otherwise have read HIGHEST LEVEL: COACHING.
                : [...pro].reverse().find((r) => r.level !== COACHING_LEVEL)?.level
                  ?? (note.reason === 'drafted' ? 'SIGNED' : 'HOME');
        const last = pro[pro.length - 1];
        // What he did HERE — the half of an alumnus the archive used to keep
        // and never print. School rows only: a transfer's other college is his
        // record, not this program's.
        const college = collegeSummary((careers?.[id] ?? []).filter((y) => y.team === teamAbbr));
        return {
          id, note, pro, showYears, highest, last, college,
          legend: legends.has(id), honors: honors.get(id) ?? 0, record: held.has(id),
        };
      })
      .sort((a, b) => (b.showYears.length - a.showYears.length) || (b.note.year - a.note.year));
  }, [notes, teamAbbr, year, careers, hall, records, history]);

  if (rows.length === 0) {
    return (
      <section className="history-empty alumni-empty">
        <small>NO ALUMNI YET</small>
        <strong>The next chapter starts after the draft.</strong>
        <p>When one of your players leaves campus, his professional path will live here.</p>
      </section>
    );
  }

  const drafted = rows.filter((r) => r.note.reason === 'drafted').length;
  const reached = rows.filter((r) => r.showYears.length > 0).length;
  const active = rows.filter((r) => r.last && !r.last.final).length;

  const needle = query.trim().toLowerCase();
  const visible = rows.filter((r) => r.note.name.toLowerCase().includes(needle)
    && (filter === 'all'
      || (filter === 'drafted' ? r.note.reason === 'drafted' : r.legend || r.honors > 0 || r.record)));
  const searching = needle !== '' || filter !== 'all';

  /*
    Folded by the June they left, newest first, the latest year open. Asked
    for on 2026-09-10: "right now it just shows all drafted alumni, it would
    be better if we fold them per year and expand when we tap on it." The
    order inside a year is the archive's own — The Show first.

    While a search or a filter is running, a class that contains a match opens
    itself; the toggles stay live, because the moment the result set is largest
    is the worst moment to take the player's control away.
  */
  const years = [...new Set(visible.map((r) => r.note.year))].sort((a, b) => b - a);

  return (
    <section className="alumni-archive">
      <MetricStrip>
        <Metric label="DRAFTED" value={String(drafted)} note="FROM HERE" />
        <Metric label="THE SHOW" value={String(reached)} note="REACHED" />
        <Metric label="ACTIVE" value={String(active)} note="PRO CAREERS" />
      </MetricStrip>

      <label className="search-row">
        <MagnifyingGlassIcon aria-hidden="true" />
        <input
          type="search" value={query} aria-label="Search alumni"
          placeholder="Find a former player"
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      </label>
      <Segmented<'all' | 'drafted' | 'honored'>
        label="Alumni filter"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Everyone' },
          { value: 'drafted', label: 'Drafted' },
          { value: 'honored', label: 'Honored' },
        ]}
      />
      <div className="directory-status" role="status">
        <span>{visible.length} {visible.length === 1 ? 'man' : 'men'}</span>
        <b>{filter === 'honored' ? 'HALL, RECORDS & AWARDS' : 'BY DEPARTURE YEAR'}</b>
      </div>

      {visible.length === 0 ? (
        <section className="history-empty alumni-empty">
          <small>NO MATCH</small>
          <strong>{needle ? 'Nobody here by that name.'
            : filter === 'drafted' ? 'Nobody has been drafted out of here yet.'
              : 'Nobody has been honoured yet.'}</strong>
          <button className="secondary-command tap" type="button" onClick={() => { setQuery(''); setFilter('all'); }}>Show everyone</button>
        </section>
      ) : (
        <div className="alumni-years">
          {years.map((left, i) => {
            const list = visible.filter((r) => r.note.year === left);
            const on = opened[left] ?? (searching || i === 0);
            const draftedThen = list.filter((r) => r.note.reason === 'drafted').length;
            const showThen = list.filter((r) => r.showYears.length > 0).length;
            return (
              <section className={`alumni-year${on ? ' is-open' : ''}`} key={left}>
                <button
                  type="button" className="alumni-year-head tap" aria-expanded={on}
                  onClick={() => setOpened({ ...opened, [left]: !on })}
                >
                  <span>
                    <small>LEFT IN {left}</small>
                    <strong>{list.length} {list.length === 1 ? 'man' : 'men'}</strong>
                  </span>
                  <em>{draftedThen} drafted{showThen > 0 ? ` · ${showThen} reached The Show` : ''}</em>
                  <b aria-hidden="true">{on ? '−' : '+'}</b>
                </button>
                {on && (
                  <div className="alumni-grid">
                    {list.map(({ id, note, pro, showYears, highest, last, college, legend, honors, record }) => (
                      <button
                        className={`alumni-card tap${legend ? ' is-legend' : showYears.length > 0 ? ' reached-show' : ''}`}
                        key={id}
                        type="button"
                        onClick={() => openPlayer(id)}
                      >
                        <header>
                          <Avatar id={id} team={teamAbbr} size={40} />
                          <span>
                            <small>{college.hitting && college.pitching ? 'TWO-WAY'
                              : college.pitching ? 'PITCHER' : college.hitting ? 'HITTER' : note.reason.toUpperCase()}</small>
                            <strong>{note.name}</strong>
                            <em>{college.first ? `${college.first}–${college.last}` : `Class of ${note.classYear}`}</em>
                          </span>
                          <b>{note.classYear}</b>
                        </header>
                        <span className="alumni-chips">
                          {legend ? <i>Hall of Fame</i>
                            : record ? <i>National record</i>
                              : honors > 0 ? <i>{honors} {honors === 1 ? 'honor' : 'honors'}</i> : null}
                          {note.reason === 'drafted' && <i className="quiet">Drafted{note.round ? ` · Round ${note.round}` : ''}</i>}
                        </span>
                        <div className="alumni-status-grid">
                          <span><small>HIGHEST LEVEL</small><strong>{highest}</strong></span>
                          <span><small>PRO YEARS</small><strong>{pro.length}</strong></span>
                          <span><small>HERE</small><strong>{college.pitching && !college.hitting
                            ? `${college.k} K` : college.hitting ? `${college.h} H` : '—'}</strong></span>
                        </div>
                        {/* The legacy engine's own sentence about his last
                            summer. The status word beside it is a second
                            reading, not a replacement for it. */}
                        <p>{last?.line ?? (note.reason === 'drafted'
                          ? 'His professional career begins next season.'
                          : 'His playing career ended in June.')}</p>
                        <em>{last?.level === COACHING_LEVEL ? 'Now coaching'
                          : last?.final ? 'Career complete'
                            : showYears.length > 0 ? `${showYears.length} season${showYears.length === 1 ? '' : 's'} in The Show`
                              : last?.level ?? (note.reason === 'drafted' ? 'Signed' : 'Home')}</em>
                        <ChevronRightIcon />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

// 11th, 12th and 13th are the rule, not an accident of a negative index.
const ordinal = (n: number): string => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th'
  : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
