// Standings.tsx
// Your conference table. Monospace columns because alignment is the whole
// readability of a standings block.

import { useConferenceTable, useDynasty, useUserTeam } from '../../state/store.js';
import { teamColour } from '../Avatar.js';
import { regularRecord } from '../../engine/season.js';
import { pct } from '../format.js';

export function Standings() {
  const table = useConferenceTable();
  const team = useUserTeam();
  const season = useDynasty((s) => s.season);
  if (!team || !season) return null;

  return (
    <div style={{ padding: '12px 14px 16px' }}>
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
        <div className="label">CONFERENCE STANDINGS</div>
        <div style={{
          font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
        }}>{team.conference}</div>
      </div>

      <div style={{
        marginTop: 12, border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Row head cells={['', 'TEAM', 'CONF', 'OVR', 'PCT', 'DIFF']} />
        {table.map((t, i) => (
          <Row
            key={t.def.abbr}
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
        ))}
      </div>

      <div style={{
        marginTop: 10, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
      }}>
        {season.teams.length} programs across {new Set(season.teams.map((t) => t.conference)).size} conferences.
        The top eight here make the conference tournament.
      </div>
    </div>
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
      background: highlight ? 'rgba(168,68,42,.08)' : 'transparent',
    }}>
      {cells.map((c, i) => (
        <span
          key={i}
          style={{
            font: head
              ? "500 8.5px var(--mono)"
              : `${highlight ? 600 : 400} 11px var(--mono)`,
            letterSpacing: head ? '.14em' : 0,
            // The team column carries the program's own colour. Sixty four names
            // in one typeface are sixty four strings; in their own colours they
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
