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
import type { PlayerId } from '../../engine/types.js';

/** The order the book reads in, and what each section is for. */
const SECTIONS: Array<{ group: RecordGroup; title: string; note: string }> = [
  {
    group: 'game', title: 'SINGLE GAME',
    note: 'One afternoon, anywhere in the country.',
  },
  {
    group: 'feat', title: 'FEATS',
    note: 'Not records — one no-hitter is not more than another. The number is '
      + 'how many the country has seen, and the name is the last man to do it.',
  },
  {
    group: 'season', title: 'SINGLE SEASON',
    note: 'Rate marks need the same qualifying minimum the national leaderboards '
      + 'use: two plate appearances a game to be batting, one inning a game to be '
      + 'pitching.',
  },
  {
    group: 'career', title: 'CAREER',
    note: 'Four years at most, and the men who left after two are in here with '
      + 'the men who stayed. Rate marks need two qualifying seasons behind them. '
      + 'Nothing is seeded: the real career records are four times a single-season '
      + 'mark and would never be beaten, so every row here was set in this world.',
  },
  { group: 'team', title: 'TEAM', note: 'Programs, not players.' },
  {
    group: 'coach', title: 'COACHING',
    note: 'Every head coach in the country, yours among them. They are hired, '
      + 'judged and moved on the same terms you are.',
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

  return (
    <div style={{ padding: '12px 14px 20px' }}>
      <div style={{ font: "400 12px/1.55 var(--body)", color: 'var(--dim)' }}>
        Every program in the country, for as long as this dynasty has run. Marks
        tagged <Tag /> are the real ones, corrected for the league you are chasing
        them in — most were set with aluminium bats — and each sits where a great
        season here beats it about once in a generation. What the man actually did
        is printed under his name, and no row asks for more than that.
      </div>

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

      <div style={{
        marginTop: 18, paddingTop: 10, borderTop: '1px solid var(--faint)',
        font: "400 11px/1.55 var(--body)", color: 'var(--dim)',
      }}>
        A mark has to be <strong>beaten</strong>. Equalling one leaves it where it
        is.
        <br /><br />
        Career marks are taken across the whole country, the same as the rest of
        the book. What is kept for them is a running total per man rather than
        every season of every roster — a career record wants the total, and the
        total is final the day he leaves.
        <br /><br />
        There are no career fielding records, for the reason there are no season
        ones: the ranking statistic is plays above what an average glove{' '}
        <em>on his own team</em> would have made, which does not mean the same
        thing in two different rows.
      </div>
    </div>
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
      <div style={{
        marginTop: 5, font: "400 10.5px/1.5 var(--body)", color: 'var(--dim)',
      }}>{note}</div>
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
        font: `${ours ? 800 : 700} 15px var(--mono)`,
        // The dash on an unset row was drawn in --faint, which is the border
        // token: a fifth of the ink, and on paper that is not quiet, it is gone.
        // --dim is the token for text that should recede, and it is already what
        // the sentence beside it uses.
        color: mark ? (ours ? 'var(--clay)' : 'var(--ink)') : 'var(--dim)',
      }}>{mark ? format(mark.value, rkey) : '—'}</span>

      <span style={{
        gridColumn: 1, marginTop: 2,
        font: `${ours ? 600 : 400} 11.5px/1.35 var(--body)`,
        color: mark ? (ours ? 'var(--clay)' : 'var(--ink)') : 'var(--dim)',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {mark
          ? (
            <>
              {mark.holder}
              <span style={{ color: 'var(--dim)', font: "400 10px var(--mono)" }}>
                {' '}· {mark.team} · {mark.year}
              </span>
              {mark.ncaa && <Tag />}
              {mark.detail && (
                <span style={{
                  display: 'block', font: "400 10px var(--mono)", color: 'var(--dim)',
                }}>{mark.detail}</span>
              )}
              {spec.frozen && (
                <span style={{
                  display: 'block', marginTop: 2,
                  font: "italic 400 10.5px/1.4 var(--body)", color: 'var(--dim)',
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
    background: ours ? 'rgba(168,68,42,.12)' : 'transparent',
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
      font: "600 8px var(--mono)", letterSpacing: '.1em', whiteSpace: 'nowrap',
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
