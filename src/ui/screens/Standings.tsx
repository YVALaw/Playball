// Standings.tsx
// Your conference table. Monospace columns because alignment is the whole
// readability of a standings block.
//
// It is called CONFERENCE everywhere the player can see, and that is the whole
// of the rename: "standings" is true of this table and equally true of the
// national rankings, so the two screens sitting side by side in the same nav
// were distinguished only by the fact that one of them said STANDINGS. The
// route key stays `stand` — nothing outside this file reads it as a word.

import { useConferenceTable, useDynasty, useUserTeam } from '../../state/store.js';
import { teamColour } from '../Avatar.js';
import { FixedHeader } from '../Sticky.js';
import { useOpenTeam } from './TeamCard.js';
import { regularRecord } from '../../engine/season.js';
import { pct } from '../format.js';

export function Standings() {
  const table = useConferenceTable();
  const team = useUserTeam();
  const season = useDynasty((s) => s.season);
  const openTeam = useOpenTeam();
  if (!team || !season) return null;

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">CONFERENCE TABLE</div>
            <div style={{
              font: "800 21px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
            }}>{team.conference}</div>
          </div>
        </div>
      }
    >
      <div style={{ padding: '2px 14px 16px' }}>
        <div style={{
          border: '1px solid var(--faint)', background: 'var(--paper)',
        }}>
          <Row head cells={['', 'TEAM', 'CONF', 'OVR', 'PCT', 'DIFF']} />
          {table.map((t, i) => (
            <button
              key={t.def.abbr}
              onClick={() => openTeam(t.index)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: 0,
                background: 'transparent', border: 'none',
              }}
            >
              <Row
                highlight={t.index === team.index}
                tint={teamColour(t.def.abbr)}
                cells={[
                  String(i + 1),
                  t.def.abbr,
                  `${t.cw}-${t.cl}`,
                  `${regularRecord(t).w}-${regularRecord(t).l}`,
                  // Regular season only, and the percentage from the same games.
                  // Once the bracket has been played, folding tournament results
                  // into a conference table shows a standing nobody finished in.
                  pct(regularRecord(t).w + regularRecord(t).l > 0
                    ? regularRecord(t).w / (regularRecord(t).w + regularRecord(t).l)
                    : 0),
                  `${t.rs - t.ra > 0 ? '+' : ''}${t.rs - t.ra}`,
                ]}
              />
            </button>
          ))}
        </div>

        <div style={{
          marginTop: 10, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
        }}>
          {season.teams.length} programs across {new Set(season.teams.map((t) => t.conference)).size} conferences.
          The top six here make the conference tournament. Tap a program to read its page.
        </div>
      </div>
    </FixedHeader>
  );
}

function Row(
  { cells, head, highlight, tint }:
  { cells: string[]; head?: boolean; highlight?: boolean; tint?: string },
) {
  // Rank, team, conf, overall, pct, diff — fixed widths so the numbers line up
  // down the column rather than drifting with the content.
  const widths = ['24px', '1fr', '52px', '52px', '46px', '44px'];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: widths.join(' '),
      alignItems: 'center',
      padding: '7px 10px',
      borderBottom: '1px solid var(--hairline)',
      // The column names stay with the columns. They are the top of the
      // scroller rather than the bottom of the fixed header so the panel keeps
      // its own border, and opaque because a sticky row over moving text is
      // otherwise two rows of numbers on top of each other.
      ...(head
        ? { position: 'sticky' as const, top: 0, zIndex: 1, background: 'var(--paper)' }
        : { background: highlight ? 'rgba(168,68,42,.08)' : 'transparent' }),
    }}>
      {cells.map((c, i) => (
        <span
          key={i}
          style={{
            font: head
              ? "500 8.5px var(--mono)"
              : `${highlight ? 600 : 400} 11px var(--mono)`,
            letterSpacing: head ? '.14em' : 0,
            // The team column carries the program's own colour. Ninety six names
            // in one typeface are ninety six strings; in their own colours they
            // become places you start to recognise on sight.
            color: head ? 'rgba(28,36,48,.5)'
              : i === 1 && tint ? tint
              : highlight ? 'var(--clay)' : 'var(--ink)',
            fontWeight: i === 1 && !head ? 700 : undefined,
            textAlign: i === 1 ? 'left' : (i === 0 ? 'left' : 'right'),
            paddingRight: i === 1 ? 8 : 0,
          }}
        >{c}</span>
      ))}
    </div>
  );
}
