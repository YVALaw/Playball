// History.tsx
// The record books. Without this a dynasty is just a series of unrelated
// seasons — you roll the year, the rosters are rewritten, and the one before is
// gone. This is the screen that makes five years mean something.
//
// Two sheets, because there are two books and they are the same object at two
// scales. SEASONS is the school's: what THIS PROGRAM did, year by year,
// whoever was coaching it — take a new job and this page shows you the years
// the school played while you were somewhere else. THE BOOK is the country's:
// the all-time marks across all ninety-six programs, seeded with the real NCAA
// ones so there is history to chase from the first game of the first season.
//
// The coach's own career is deliberately not here. His years follow him, on
// the coach profile's CAREER tab; a school's years stay with the school, and
// mixing the two books is how both end up wrong.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { Legend, Metric, MetricStrip, ModuleIntro, Segmented } from '../components/Kit.js';
import { RecordBook } from './RecordBook.js';
import { FINISH_LABEL, type Finish } from '../../engine/postseason.js';
import type { SchoolSeason } from '../../engine/season.js';

/** Deep runs earn colour. Everything else stays quiet. */
const FINISH_COLOR: Record<Finish, string> = {
  missed: 'var(--dim)',
  regional: 'var(--ink)',
  national: 'var(--ink)',
  omaha: 'var(--clay)',
  'runner-up': 'var(--clay)',
  champion: 'var(--clay)',
};

type Sheet = 'seasons' | 'book';

const SHEET_LABEL: Record<Sheet, string> = {
  seasons: 'SEASONS',
  book: 'THE BOOK',
};

export function History() {
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const [sheet, setSheet] = useState<Sheet>("seasons");
  void version;

  if (!team) return null;

  const annals = team.annals ?? [];
  const wins = annals.reduce((a, s) => a + s.w, 0);
  const losses = annals.reduce((a, s) => a + s.l, 0);

  return (
    <main className="module-workspace">
      <ModuleIntro
        kicker="PROGRAM ARCHIVE"
        title={sheet === "seasons"
          ? (annals.length > 0 ? `${wins}-${losses}` : "History")
          : "The Book"}
        // One line each — reported: "we have to remove all the text at the
        // top, it is waaay too long." The seasons line lost its second
        // sentence about other jobs; the book's lost the provenance essay,
        // which the records themselves demonstrate.
        text={sheet === "seasons"
          ? `Every season ${team.def.school} has finished, whoever was coaching.`
          : "The all-time marks, all ninety-six programs."}
      />
      <Segmented
        label="History view"
        value={sheet}
        onChange={setSheet}
        options={[
          { value: "seasons", label: "Seasons" },
          { value: "book", label: "The Book" },
        ]}
      />
      {sheet === "book" ? <RecordBook /> : <Seasons annals={annals} />}
    </main>
  );
}

/**
 * The school's own book, one row per finished season.
 *
 * Written for every program in the country each June by `recordSchoolAnnals`,
 * so the page works the same whether you have been here ten years or ten
 * minutes. The awards under a year are the one borrowing from the coach's
 * record: they name this school's own players, so they belong under this
 * school's season — but only for the years the save actually captured them.
 */
function Seasons({ annals }: { annals: SchoolSeason[] }) {
  const history = useDynasty((s) => s.history);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const coachName = useDynasty((s) => s.coach.name);
  const team = useUserTeam();

  if (!team) return null;

  if (annals.length === 0) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center' }}>
        <div className="label">NO SEASONS ON RECORD</div>
        <div style={{
          marginTop: 8, font: "400 calc(12px * var(--ts))/1.6 var(--body)", color: 'var(--dim)',
          maxWidth: 270, margin: '8px auto 0',
        }}>
          Every June writes a line. The first one lands when a season finishes.
        </div>
      </div>
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
    <div style={{ padding: '10px 14px 16px' }}>
      <MetricStrip>
        <Metric label="TITLES" value={String(titles)} note="NATIONAL" />
        <Metric label="OMAHA" value={String(omaha)} note="TRIPS" />
        <Metric label="CONF TITLES" value={String(rings)} note="RINGS" />
      </MetricStrip>

      <div style={{
        marginTop: 14, border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {/* Sticky rather than part of the fixed header, because the table starts
            halfway down the screen — under the three career tiles — and a
            column name pinned to the frame would sit above a block that is not
            the table it names. */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 1, background: 'var(--paper)',
          display: 'grid', gridTemplateColumns: '40px 52px 30px 1fr',
          gap: 6, padding: '7px 10px', borderBottom: '1px solid var(--hairline)',
        }}>
          {['YEAR', 'RECORD', 'CONF', 'FINISH'].map((c) => (
            <span key={c} className="label">{c}</span>
          ))}
        </div>

        {rows.map((s) => {
          const awards = awardsFor(s.year);
          const notYou = s.coach !== undefined && s.coach !== coachName;
          return (
          <div key={s.year}>
            <div style={{
              display: 'grid', gridTemplateColumns: '40px 52px 30px 1fr',
              gap: 6, alignItems: 'center',
              padding: '9px 10px',
              borderBottom: awards.length > 0 || notYou
                ? 'none' : '1px solid var(--hairline)',
              background: s.finish === 'champion' ? 'rgba(var(--clay-rgb), .08)' : 'transparent',
            }}>
              <span style={{ font: "700 calc(13px * var(--ts)) var(--display)" }}>{s.year}</span>
              <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)" }}>{s.w}-{s.l}</span>
              <span style={{
                font: "400 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)',
              }}>{s.confPlace > 0 ? ordinal(s.confPlace) : '—'}</span>
              <span style={{
                font: `${s.finish === 'champion' ? 600 : 400} calc(11px * var(--ts)) var(--body)`,
                color: FINISH_COLOR[s.finish],
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.wonConference ? '★ ' : ''}{FINISH_LABEL[s.finish]}
                {Number.isInteger(s.rank) && s.rank > 0 && s.rank <= 25 ? ` · #${s.rank}` : ''}
              </span>
            </div>

            {/* Whose bench it was, when it was not yours. Your own years say
                nothing — a book that repeated your name forty times would. */}
            {notYou && (
              <div style={{
                padding: '0 10px 8px 46px',
                borderBottom: awards.length > 0 ? 'none' : '1px solid var(--hairline)',
                font: "500 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.08em', color: 'var(--dim)',
              }}>COACH {s.coach?.toUpperCase()}</div>
            )}

            {/*
              What this school's own players won that year, under the year they
              won it. Only the years you coached carry them — the save only
              keeps award detail for your own seasons.
            */}
            {awards.length > 0 && (
              <div style={{
                padding: '0 10px 9px 46px', borderBottom: '1px solid var(--hairline)',
                background: s.finish === 'champion' ? 'rgba(var(--clay-rgb), .08)' : 'transparent',
              }}>
                {awards.map((a, i) => (
                  <button
                    key={`${a.id}-${i}`}
                    onClick={() => openPlayer(a.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '2px 0', background: 'transparent',
                    }}
                  >
                    <span style={{
                      font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.08em',
                      color: 'var(--clay)',
                    }}>{a.title.toUpperCase()}</span>
                    <span style={{
                      marginLeft: 6, font: "400 calc(11px * var(--ts)) var(--body)",
                      borderBottom: '1px dotted rgba(var(--ink-rgb), .35)',
                    }}>{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* The paragraph this replaces was three sentences of prose — "delete
          all that text... instead simply add a legend." The key decodes the
          marks; the guidance about the coach profile went with the essay. */}
      <Legend items={[
        { mark: '★', means: 'conference tournament title — automatic national bid' },
        { mark: '#25', means: 'final national rank, when ranked' },
        {
          mark: <i style={{
            display: 'inline-block', width: 10, height: 10, verticalAlign: 'baseline',
            background: 'rgba(var(--clay-rgb), .25)',
          }} aria-hidden />,
          means: 'national title year',
        },
      ]} />
    </div>
  );
}


const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? 'th');
};
