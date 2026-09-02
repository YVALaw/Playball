// RecordBook.tsx
// The all-time book, and the only screen in the game about somebody else's
// program.
//
// It lives as the second sheet of HISTORY rather than as a nav entry of its own,
// for the reason Program.tsx already gives about not having a season-by-season
// tab: two record books one tap apart are two record books that eventually
// disagree. These two belong together and are the same kind of object seen at
// two scales — your seasons, and the country's marks — so the tab strip is
// exactly the right control to put between them.
//
// The seeded NCAA marks are what makes the screen worth opening on day one. A
// record book that starts empty is a page of dashes; a record book that opens
// with Incaviglia in it is a list of things to go and do.

import { useMemo } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import {
  RECORDS, recordsIn, type RecordGroup, type RecordKey, type RecordMark,
} from '../../engine/records.js';
import { pct } from '../format.js';
import { Legend } from '../components/Kit.js';
import type { PlayerId } from '../../engine/types.js';

/** The order the book reads in, and what each section is for. */
const SECTIONS: Array<{ group: RecordGroup; title: string; note: string }> = [
  // One line apiece, where the first draft ran to paragraphs — "same thing in
  // the book, waaay too much text." What each line lost lives on in the code
  // that enforces it (records.ts owns the qualifying minimums and the
  // no-seeding rule for careers); a screen does not have to recite its rules.
  { group: 'game', title: 'SINGLE GAME', note: '' },
  {
    group: 'feat', title: 'FEATS',
    note: 'Counts, not records — the name is the last man to do it.',
  },
  {
    group: 'season', title: 'SINGLE SEASON',
    note: 'Rate marks need the leaderboard minimums.',
  },
  {
    group: 'career', title: 'CAREER',
    note: 'Four years at most. Rate marks need two qualifying seasons.',
  },
  { group: 'team', title: 'TEAM', note: 'Programs, not players.' },
  {
    group: 'coach', title: 'COACHING',
    note: 'Every head coach in the country, yours among them.',
  },
];

export function RecordBook() {
  const season = useDynasty((s) => s.season);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();

  /*
    Whose card can actually be opened.

    A mark carries the id of the man who set it, and he may have graduated three
    Junes ago from a program that is not yours — in which case nothing in the
    save remembers him and the card would open on an apology. So the tap is
    offered only where there is something behind it: a current roster anywhere in
    the country, or your own career book, which is the one archive that outlives
    a roster.
  */
  const known = useMemo(() => {
    const ids = new Set<string>();
    if (!season) return ids;
    for (const t of season.teams) {
      for (const p of [
        ...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen,
      ]) ids.add(p.id);
    }
    for (const id of Object.keys(season.careers ?? {})) ids.add(id);
    return ids;
  }, [season, version]);

  if (!season || !team) return null;
  const book = season.records ?? {};
  // No padding of its own: this renders inside a workspace that already has
  // the gutter, and two of them is a column half the width of the screen.
  return (
    <>
      {/* The five-line introduction and the three-paragraph footer both
          collapsed into this key — "waaay too much text." Everything a reader
          needs to decode a row, nothing they need to be told twice. */}
      <Legend items={[
        { mark: <Tag />, means: 'a real mark, corrected for this league' },
        {
          mark: <i style={{
            display: 'inline-block', width: 10, height: 10, verticalAlign: 'baseline',
            borderLeft: '3px solid var(--clay)',
            background: 'rgba(var(--clay-rgb), .25)',
          }} aria-hidden />,
          means: 'held by your program',
        },
        { mark: '—', means: 'not set — whoever does it first takes it' },
        { mark: '=', means: 'equalling a mark leaves it standing' },
      ]} />

      {SECTIONS.map((s) => (
        <Section
          key={s.group}
          title={s.title}
          note={s.note}
          keys={recordsIn(s.group)}
          book={book}
          mine={team.def.abbr}
          known={known}
          onPick={openPlayer}
        />
      ))}

    </>
  );
}

function Section(
  { title, note, keys, book, mine, known, onPick }:
  {
    title: string; note: string; keys: RecordKey[];
    book: Partial<Record<RecordKey, RecordMark>>;
    mine: string; known: Set<string>; onPick: (id: PlayerId) => void;
  },
) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="label" style={{ marginBottom: 4 }}>{title}</div>
      <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
        {keys.map((k) => (
          <Row key={k} rkey={k} mark={book[k]} mine={mine} known={known} onPick={onPick} />
        ))}
      </div>
      {note !== '' && (
        <div style={{
          marginTop: 5, font: "400 calc(10.5px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
        }}>{note}</div>
      )}
    </div>
  );
}

function Row(
  { rkey, mark, mine, known, onPick }:
  {
    rkey: RecordKey; mark: RecordMark | undefined;
    mine: string; known: Set<string>; onPick: (id: PlayerId) => void;
  },
) {
  const spec = RECORDS[rkey];
  const ours = mark !== undefined && !mark.ncaa && mark.team === mine;
  const tappable = mark?.id !== undefined && known.has(mark.id);

  const body = (
    <>
      <span className="label" style={{ gridColumn: 1, alignSelf: 'center' }}>
        {spec.label}
      </span>
      <span style={{
        gridColumn: 2, gridRow: '1 / span 2', alignSelf: 'center', textAlign: 'right',
        font: `${ours ? 800 : 700} calc(15px * var(--ts)) var(--mono)`,
        // The dash on an unset row was drawn in --faint, which is the border
        // token: a fifth of the ink, and on paper that is not quiet, it is gone.
        // --dim is the token for text that should recede, and it is already what
        // the sentence beside it uses.
        color: mark ? (ours ? 'var(--clay)' : 'var(--ink)') : 'var(--dim)',
      }}>{mark ? format(mark.value, rkey) : '—'}</span>

      <span style={{
        gridColumn: 1, marginTop: 2,
        font: `${ours ? 600 : 400} calc(11.5px * var(--ts))/1.35 var(--body)`,
        color: mark ? (ours ? 'var(--clay)' : 'var(--ink)') : 'var(--dim)',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {mark
          ? (
            <>
              {mark.holder}
              <span style={{ color: 'var(--dim)', font: "400 calc(10px * var(--ts)) var(--mono)" }}>
                {' '}· {mark.team} · {mark.year}
              </span>
              {mark.ncaa && <Tag />}
              {mark.detail && (
                <span style={{
                  display: 'block', font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)',
                }}>{mark.detail}</span>
              )}
              {spec.frozen && (
                <span style={{
                  display: 'block', marginTop: 2,
                  font: "italic 400 calc(10.5px * var(--ts))/1.4 var(--body)", color: 'var(--dim)',
                }}>{spec.frozen}</span>
              )}
            </>
          )
          : 'Not set. Whoever does it first takes it.'}
      </span>
    </>
  );

  const style = {
    width: '100%', textAlign: 'left' as const,
    display: 'grid', gridTemplateColumns: '1fr 66px', gap: 6,
    padding: '8px 10px',
    borderBottom: '1px solid var(--hairline)',
    borderLeft: ours ? '3px solid var(--clay)' : '3px solid transparent',
    background: ours ? 'rgba(var(--clay-rgb), .12)' : 'transparent',
  };

  // A tap that opens nothing is worse than no tap at all, so the row is only a
  // button when there is a card behind it.
  return tappable
    ? <button onClick={() => onPick(mark.id as PlayerId)} style={style}>{body}</button>
    : <div style={style}>{body}</div>;
}

/** The badge that says a mark was set in the real world and not in this one. */
function Tag() {
  return (
    <span style={{
      marginLeft: 5, padding: '1px 4px',
      border: '1px solid var(--clay)', color: 'var(--clay)',
      font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.1em', whiteSpace: 'nowrap',
    }}>NCAA</span>
  );
}

/**
 * A value in the units its category is read in.
 *
 * Innings get the scorer's notation rather than a decimal: 96.1 is ninety six
 * and a third, and printing 96.3 for the same quantity would be a different
 * number to anybody who has read a box score.
 */
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
