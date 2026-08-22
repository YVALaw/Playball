// Rankings.tsx
// The country, in order.
//
// The season review says you finished #5 and, until now, that was the end of
// the sentence — there was nowhere to go and see who the four above you were.
// A rank with nothing behind it is a decoration.
//
// RPI, not record, which is the same order the selection committee uses in this
// game: it is the number that decides whether 38-18 in a hard league beats
// 44-12 against nobody, and a player who never sees the table never learns that.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { rpiOrder, regularRecord } from '../../engine/season.js';
import { teamColour } from '../Avatar.js';
import { pct } from '../format.js';

export function Rankings() {
  const season = useDynasty((s) => s.season);
  const team = useUserTeam();
  const go = useDynasty((s) => s.go);
  const closeOverlay = useDynasty((s) => s.closeOverlay);
  if (!season || !team) return null;

  const order = rpiOrder(season);

  return (
    <div style={{ padding: '12px 14px 16px' }}>
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
        <div className="label">NATIONAL RANKINGS · RPI</div>
        <div style={{
          font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
        }}>The country</div>
      </div>

      <div style={{
        marginTop: 12, border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Row head cells={['', 'TEAM', 'CONF', 'W-L', 'PCT', 'RPI']} />
        {order.map((r, i) => {
          const t = r.team;
          const rec = regularRecord(t);
          const mine = t.index === team.index;
          return (
            <button
              key={t.def.abbr}
              onClick={() => {
                // Your own row goes to your schedule, which is the one table
                // where those wins are individual games you can open.
                if (!mine) return;
                closeOverlay();
                go('season', 'sched');
              }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: 0,
                background: mine ? 'rgba(168,68,42,.10)' : 'transparent',
                border: 'none',
              }}
            >
              <Row
                highlight={mine}
                tint={teamColour(t.def.abbr)}
                cells={[
                  String(i + 1),
                  t.def.abbr,
                  t.conference.slice(0, 4).toUpperCase(),
                  `${rec.w}-${rec.l}`,
                  // From the same games as the record beside it. winPct counts
                  // tournament games, so a team could show 26-7 and .818.
                  pct(rec.w + rec.l > 0 ? rec.w / (rec.w + rec.l) : 0),
                  r.rpi.toFixed(3).replace(/^0/, ''),
                ]}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Row(
  { cells, head, highlight, tint }:
  { cells: string[]; head?: boolean; highlight?: boolean; tint?: string },
) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '26px 46px 1fr 54px 46px 44px',
      gap: 6, alignItems: 'center',
      padding: '7px 10px',
      borderBottom: '1px solid var(--hairline)',
      background: head ? 'var(--field)' : 'transparent',
    }}>
      {cells.map((c, i) => (
        <span
          key={i}
          style={{
            font: head
              ? "600 8.5px var(--mono)"
              : `${highlight ? 700 : 500} 11px var(--mono)`,
            letterSpacing: head ? '.12em' : '0',
            color: head
              ? 'var(--dim)'
              : i === 1 && tint ? tint : 'var(--ink)',
            textAlign: i >= 3 ? 'right' : 'left',
          }}
        >{c}</span>
      ))}
    </div>
  );
}
