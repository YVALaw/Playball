// History.tsx
// The record books. Without this a dynasty is just a series of unrelated
// seasons — you roll the year, the rosters are rewritten, and the one before is
// gone. This is the screen that makes five years mean something.
//
// Two sheets, because there are two books and they are the same object at two
// scales. SEASONS is yours: what your program did, year by year, and who won
// what while doing it. THE BOOK is the country's: the all-time marks across all
// ninety-six programs, seeded with the real NCAA ones so there is history to
// chase from the first game of the first season.
//
// They are one screen rather than two nav entries on purpose, and Program.tsx
// gives the reason in its own header: two record books one tap apart are two
// record books that eventually disagree. It also means the screen is worth
// opening in March of year one, when the seasons half is still empty.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { RecordBook } from './RecordBook.js';
import { FINISH_LABEL, type Finish } from '../../engine/postseason.js';

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
  const history = useDynasty((s) => s.history);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const [sheet, setSheet] = useState<Sheet>('seasons');
  void version;

  if (!team) return null;

  const wins = history.reduce((a, s) => a + s.w, 0);
  const losses = history.reduce((a, s) => a + s.l, 0);

  return (
    <FixedHeader
      header={
        <>
          <div style={{ padding: '12px 14px 0' }}>
            <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
              <div className="label">
                {sheet === 'seasons'
                  ? `PROGRAM RECORD · ${history.length} SEASON${history.length === 1 ? '' : 'S'}`
                  : 'ALL-TIME · NINETY-SIX PROGRAMS'}
              </div>
              <div style={{
                font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
              }}>{sheet === 'seasons' ? `${wins}-${losses}` : 'The Book'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '10px 14px' }}>
            {(['seasons', 'book'] as Sheet[]).map((s) => (
              <button
                key={s}
                onClick={() => setSheet(s)}
                style={{
                  flex: 1, padding: '8px 0',
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
      {sheet === 'book' ? <RecordBook /> : <Seasons />}
    </FixedHeader>
  );
}

function Seasons() {
  const history = useDynasty((s) => s.history);
  const openPlayer = useDynasty((s) => s.openPlayer);

  if (history.length === 0) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center' }}>
        <div className="label">NO SEASONS ON RECORD</div>
        <div style={{
          marginTop: 8, font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
          maxWidth: 260, margin: '8px auto 0',
        }}>
          Finish a season and roll the year over. Everything you do from here is
          written down.
        </div>
      </div>
    );
  }

  const titles = history.filter((s) => s.finish === 'champion').length;
  const omaha = history.filter(
    (s) => s.finish === 'omaha' || s.finish === 'runner-up' || s.finish === 'champion',
  ).length;
  const rings = history.filter((s) => s.wonConference).length;

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

        {[...history].reverse().map((s) => (
          <div key={s.year}>
            <div style={{
              display: 'grid', gridTemplateColumns: '40px 52px 30px 1fr',
              gap: 6, alignItems: 'center',
              padding: '9px 10px',
              borderBottom: (s.awards ?? []).length > 0
                ? 'none' : '1px solid var(--hairline)',
              background: s.finish === 'champion' ? 'rgba(168,68,42,.08)' : 'transparent',
            }}>
              <span style={{ font: "700 13px var(--display)" }}>{s.year}</span>
              <span style={{ font: "400 11px var(--mono)" }}>{s.w}-{s.l}</span>
              <span style={{
                font: "400 11px var(--mono)", color: 'var(--dim)',
              }}>{ordinal(s.confPlace)}</span>
              <span style={{
                font: `${s.finish === 'champion' ? 600 : 400} 11px var(--body)`,
                color: FINISH_COLOR[s.finish],
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.wonConference ? '★ ' : ''}{FINISH_LABEL[s.finish]}
              </span>
            </div>

            {/*
              What your own players won that year, under the year they won it.

              The awards screen used to list the whole country's winners, which
              is a list of other people's achievements filed under your program's
              history. These are yours, and they are the reason a year is
              remembered as more than a record.
            */}
            {(s.awards ?? []).length > 0 && (
              <div style={{
                padding: '0 10px 9px 46px', borderBottom: '1px solid var(--hairline)',
                background: s.finish === 'champion' ? 'rgba(168,68,42,.08)' : 'transparent',
              }}>
                {(s.awards ?? []).map((a, i) => (
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
        ))}
      </div>

      <div style={{ marginTop: 10, font: "400 11px/1.5 var(--body)", color: 'var(--dim)' }}>
        ★ marks a conference tournament title, which carries an automatic bid to the
        national field however the regular season went.
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
