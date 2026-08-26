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
import { FixedHeader } from '../Sticky.js';
import { RecordBook } from './RecordBook.js';
import { FINISH_LABEL, type Finish } from '../../engine/postseason.js';
import type { SchoolSeason } from '../../engine/season.js';

/** Deep runs earn colour. Everything else stays quiet. */
const FINISH_COLOR: Record<Finish, string> = {
  missed: 'var(--dim)',
  regional: 'var(--ink)',
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
  const [sheet, setSheet] = useState<Sheet>('seasons');
  void version;

  if (!team) return null;

  const annals = team.annals ?? [];
  const wins = annals.reduce((a, s) => a + s.w, 0);
  const losses = annals.reduce((a, s) => a + s.l, 0);

  return (
    <FixedHeader
      header={
        <>
          <div style={{ padding: '12px 14px 0' }}>
            <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
              <div className="label">
                {sheet === 'seasons'
                  ? `${team.def.school.toUpperCase()} · ${annals.length} SEASON${annals.length === 1 ? '' : 'S'} ON RECORD`
                  : 'ALL-TIME · NINETY-SIX PROGRAMS'}
              </div>
              <div style={{
                font: "800 21px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
              }}>{sheet === 'seasons' ? (annals.length > 0 ? `${wins}-${losses}` : 'History') : 'The Book'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '10px 14px' }}>
            {(['seasons', 'book'] as Sheet[]).map((s) => (
              <button
                key={s}
                onClick={() => setSheet(s)}
                style={{
                  flex: 1, padding: '8px 0', minHeight: 36,
                  background: s === sheet ? 'var(--ink)' : 'var(--field)',
                  border: s === sheet ? '1px solid var(--ink)' : '1px solid var(--faint)',
                  color: s === sheet ? 'var(--cream)' : 'var(--dim)',
                  font: "700 8.5px var(--mono)", letterSpacing: '.08em',
                }}
              >{SHEET_LABEL[s]}</button>
            ))}
          </div>
        </>
      }
    >
      {sheet === 'book' ? <RecordBook /> : <Seasons annals={annals} />}
    </FixedHeader>
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
          marginTop: 8, font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
          maxWidth: 270, margin: '8px auto 0',
        }}>
          The school writes a season into its book every June. Careers begun
          before the book existed start it with their next finished year.
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
      <div style={{
        display: 'flex',
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="TITLES" v={titles} />
        <Tile k="OMAHA" v={omaha} />
        <Tile k="CONF TITLES" v={rings} last />
      </div>

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
              background: s.finish === 'champion' ? 'rgba(168,68,42,.08)' : 'transparent',
            }}>
              <span style={{ font: "700 13px var(--display)" }}>{s.year}</span>
              <span style={{ font: "400 11px var(--mono)" }}>{s.w}-{s.l}</span>
              <span style={{
                font: "400 11px var(--mono)", color: 'var(--dim)',
              }}>{s.confPlace > 0 ? ordinal(s.confPlace) : '—'}</span>
              <span style={{
                font: `${s.finish === 'champion' ? 600 : 400} 11px var(--body)`,
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
                font: "500 9px var(--mono)", letterSpacing: '.08em', color: 'var(--dim)',
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
                background: s.finish === 'champion' ? 'rgba(168,68,42,.08)' : 'transparent',
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
                      font: "600 9px var(--mono)", letterSpacing: '.08em',
                      color: 'var(--clay)',
                    }}>{a.title.toUpperCase()}</span>
                    <span style={{
                      marginLeft: 6, font: "400 11px var(--body)",
                      borderBottom: '1px dotted rgba(28,36,48,.35)',
                    }}>{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, font: "400 11px/1.5 var(--body)", color: 'var(--dim)' }}>
        ★ marks a conference tournament title, which carries an automatic bid to the
        national field however the regular season went. This is the school's book.
        Your own career, wherever it was coached, is on your coach profile.
      </div>
    </div>
  );
}

function Tile({ k, v, last }: { k: string; v: number; last?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '9px 8px',
      borderRight: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <div className="label">{k}</div>
      <div style={{
        font: "700 24px/1 var(--display)", marginTop: 2,
        color: v > 0 ? 'var(--clay)' : 'var(--ink)',
      }}>{v}</div>
    </div>
  );
}

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? 'th');
};
