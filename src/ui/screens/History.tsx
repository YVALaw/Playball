// History.tsx
// The program archive: seasons, national records, and the men who went on.
//
// History is a reading surface, but it should still feel like the same app as
// Budget and the modern profiles. Seasons are yearbook cards rather than a raw
// table; The Book owns its own grouped record cards; Alumni surfaces the pro
// career system that used to exist only if you remembered to reopen a player.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { Metric, MetricStrip, ModuleIntro, Segmented } from '../components/Kit.js';
import { RecordBook } from './RecordBook.js';
import { FINISH_LABEL, type Finish } from '../../engine/postseason.js';
import type { SchoolSeason } from '../../engine/season.js';
import type { PlayerId } from '../../engine/types.js';
import { proCareer, type AlumnusNote } from '../../engine/legacy.js';
import { ChevronRightIcon } from '@radix-ui/react-icons';

const FINISH_COLOR: Record<Finish, string> = {
  missed: 'var(--dim)',
  regional: 'var(--ink)',
  national: 'var(--ink)',
  omaha: 'var(--clay)',
  'runner-up': 'var(--clay)',
  champion: 'var(--clay)',
};

type Sheet = 'seasons' | 'book' | 'alumni';

export function History() {
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const alumni = useDynasty((s) => s.alumni);
  const unseenRecords = useDynasty((s) => s.unseenRecords.length);
  const [sheet, setSheet] = useState<Sheet>('seasons');
  void version;

  if (!team) return null;

  const annals = team.annals ?? [];
  const wins = annals.reduce((a, s) => a + s.w, 0);
  const losses = annals.reduce((a, s) => a + s.l, 0);
  const programAlumni = Object.values(alumni).filter((a) => a.teamAbbr === team.def.abbr);

  const title = sheet === 'seasons'
    ? (annals.length > 0 ? `${wins}-${losses}` : 'History')
    : sheet === 'book' ? 'The Book'
      : programAlumni.length > 0 ? `${programAlumni.length} alumni` : 'Alumni';
  const text = sheet === 'seasons'
    ? `Every finished ${team.def.school} season.`
    : sheet === 'book'
      ? 'The marks this dynasty is chasing across all ninety-six programs.'
      : 'Drafted players and what happened after they left campus.';

  return (
    <main className="module-workspace history-workspace">
      <ModuleIntro kicker="PROGRAM ARCHIVE" title={title} text={text} />
      <Segmented<Sheet>
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

  const titles = annals.filter((s) => s.finish === 'champion').length;
  const omaha = annals.filter(
    (s) => s.finish === 'omaha' || s.finish === 'runner-up' || s.finish === 'champion',
  ).length;
  const rings = annals.filter((s) => s.wonConference).length;

  const awardsFor = (year: number) => history
    .find((r) => r.year === year && r.school === team.def.school)?.awards ?? [];

  const rows = [...annals].sort((a, b) => b.year - a.year);

  return (
    <section className="season-archive">
      <MetricStrip>
        <Metric label="TITLES" value={String(titles)} note="NATIONAL" />
        <Metric label="OMAHA" value={String(omaha)} note="TRIPS" />
        <Metric label="CONF TITLES" value={String(rings)} note="RINGS" />
      </MetricStrip>

      <div className="season-yearbook-head">
        <span><small>YEARBOOK</small><strong>{rows.length} completed season{rows.length === 1 ? '' : 's'}</strong></span>
        <em>NEWEST FIRST</em>
      </div>

      <div className="season-yearbook">
        {rows.map((s) => {
          const awards = awardsFor(s.year);
          const notYou = s.coach !== undefined && s.coach !== coachName;
          const deep = s.finish === 'omaha' || s.finish === 'runner-up' || s.finish === 'champion';
          return (
            <article className={`season-card${s.finish === 'champion' ? ' champion' : deep ? ' deep-run' : ''}`} key={s.year}>
              <header>
                <span><small>{s.wonConference ? '★ CONFERENCE CHAMPION' : 'SEASON'}</small><strong>{s.year}</strong></span>
                <b style={{ color: FINISH_COLOR[s.finish] }}>{FINISH_LABEL[s.finish]}</b>
              </header>
              <div className="season-card-score">
                <span><small>RECORD</small><strong>{s.w}-{s.l}</strong></span>
                <span><small>CONFERENCE</small><strong>{s.confPlace > 0 ? ordinal(s.confPlace) : '—'}</strong></span>
                <span><small>FINAL RANK</small><strong>{Number.isInteger(s.rank) && s.rank > 0 && s.rank <= 25 ? `#${s.rank}` : '—'}</strong></span>
              </div>
              {notYou && <p className="season-card-coach">COACH · {s.coach}</p>}
              {awards.length > 0 && (
                <div className="season-card-awards">
                  <small>HONORS</small>
                  {awards.map((a, i) => (
                    <button key={`${a.id}-${i}`} type="button" onClick={() => openPlayer(a.id)}>
                      <span><b>{a.title}</b><strong>{a.name}</strong></span><ChevronRightIcon />
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Alumni({ notes, teamAbbr }: { notes: Record<string, AlumnusNote>; teamAbbr: string }) {
  const year = useDynasty((s) => s.year);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const rows = Object.entries(notes)
    .filter(([, note]) => note.teamAbbr === teamAbbr)
    .map(([key, note]) => {
      const id = key as PlayerId;
      const pro = proCareer(id, note, year);
      const showYears = pro.filter((r) => r.level === 'THE SHOW');
      const highest = pro.some((r) => r.level === 'THE SHOW') ? 'THE SHOW'
        : pro.some((r) => r.level === 'TRIPLE-A') ? 'TRIPLE-A'
          : pro.some((r) => r.level === 'DOUBLE-A') ? 'DOUBLE-A'
            : pro.some((r) => r.level === 'SINGLE-A') ? 'SINGLE-A'
              : pro[pro.length - 1]?.level ?? (note.reason === 'drafted' ? 'SIGNED' : 'HOME');
      const last = pro[pro.length - 1];
      return { id, note, pro, showYears, highest, last };
    })
    .sort((a, b) => (b.showYears.length - a.showYears.length) || (b.note.year - a.note.year));

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

  return (
    <section className="alumni-archive">
      <MetricStrip>
        <Metric label="DRAFTED" value={String(drafted)} note="FROM HERE" />
        <Metric label="THE SHOW" value={String(reached)} note="REACHED" />
        <Metric label="ACTIVE" value={String(active)} note="PRO CAREERS" />
      </MetricStrip>
      <div className="alumni-grid">
        {rows.map(({ id, note, pro, showYears, highest, last }) => (
          <button
            className={`alumni-card tap${showYears.length > 0 ? ' reached-show' : ''}`}
            key={id}
            type="button"
            onClick={() => openPlayer(id)}
          >
            <header>
              <span><small>{note.reason === 'drafted' ? `DRAFTED · ROUND ${note.round ?? '?'}` : note.reason.toUpperCase()}</small><strong>{note.name}</strong></span>
              <b>{note.year}</b>
            </header>
            <div className="alumni-status-grid">
              <span><small>HIGHEST LEVEL</small><strong>{highest}</strong></span>
              <span><small>PRO YEARS</small><strong>{pro.length}</strong></span>
            </div>
            <p>{last?.line ?? (note.reason === 'drafted' ? 'His professional career begins next season.' : 'His playing career ended in June.')}</p>
            {showYears.length > 0 && <em>{showYears.length} season{showYears.length === 1 ? '' : 's'} in The Show</em>}
            <ChevronRightIcon />
          </button>
        ))}
      </div>
    </section>
  );
}

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? 'th');
};
