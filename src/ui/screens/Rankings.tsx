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
import { FixedHeader } from '../Sticky.js';
import { useOpenTeam } from './TeamCard.js';
import { pct } from '../format.js';

export function Rankings() {
  const season = useDynasty((s) => s.season);
  const team = useUserTeam();
  const openTeam = useOpenTeam();
  if (!season || !team) return null;

  const order = rpiOrder(season);

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">NATIONAL RANKINGS · RPI</div>
            <div style={{
              font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
            }}>The country</div>
          </div>
        </div>
      }
    >
      <div style={{ padding: '2px 14px 16px' }}>
        <div style={{
          border: '1px solid var(--faint)', background: 'var(--paper)',
        }}>
          <Row head cells={['', 'TEAM', 'CONF', 'W-L', 'PCT', 'RPI']} />
          {order.map((r, i) => {
            const t = r.team;
            const rec = regularRecord(t);
            const mine = t.index === team.index;
            return (
              <button
                key={t.def.abbr}
                /*
                  Every row opens that program's page, your own included.

                  Your row used to be the only one that did anything, and what it
                  did was jump to your schedule. That made the one row you look
                  for first behave unlike the sixty three around it — and the
                  page it now opens carries your results anyway, on its own tab.
                */
                onClick={() => openTeam(t.index)}
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

        <div style={{
          marginTop: 10, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
        }}>
          Tap a program for its roster, its season and how you have done against it.
        </div>
      </div>
    </FixedHeader>
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
      // Pinned, so sixty four rows never leave you guessing which column the
      // last number is. Opaque for the same reason the conference table's is.
      ...(head
        ? {
            position: 'sticky' as const, top: 0, zIndex: 1,
            background: 'var(--field)',
          }
        : { background: 'transparent' }),
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
