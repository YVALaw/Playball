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
import { rosterStrength } from '../../engine/program.js';
import { teamColour } from '../Avatar.js';
import { FixedHeader } from '../Sticky.js';
import { useOpenTeam } from './TeamCard.js';
import { pct } from '../format.js';

export function Rankings() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const openTeam = useOpenTeam();
  void version;
  if (!season || !team) return null;

  /*
    Opening week gets a projection, the way the polls do it.

    RPI is arithmetic over games, and over no games it is a coin sorted by the
    tiebreak — the table used to open the season in an order nothing could
    explain. Until the average program has around four games behind it, the
    country is ranked on what the rosters are worth (with a thumb of prestige,
    which is the benefit of the doubt a name brand actually gets in a poll).
    The moment there are enough results to mean something, the real table takes
    over and the projection is never seen again.
  */
  const preseason = season.results.length < season.teams.length * 2;
  const projected = preseason
    ? season.teams
      .map((t, i) => ({
        team: t, index: i,
        power: rosterStrength(t.team) * 0.75 + t.prestige * 0.25,
      }))
      .sort((a, b) => b.power - a.power || a.team.def.abbr.localeCompare(b.team.def.abbr))
    : [];
  const order = preseason ? [] : rpiOrder(season);

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">
              {preseason ? 'PRESEASON POWER RANKING · PROJECTED' : 'NATIONAL RANKINGS · RPI'}
            </div>
            <div style={{
              font: "800 calc(21px * var(--ts))/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
            }}>The country</div>
          </div>
        </div>
      }
    >
      <div style={{ padding: '2px 14px 16px' }}>
        <div style={{
          border: '1px solid var(--faint)', background: 'var(--paper)',
        }}>
          {preseason ? (
            <>
              <Row head cells={['', 'TEAM', 'CONF', 'W-L', 'ROSTER', 'PWR']} />
              {projected.map((r, i) => {
                const t = r.team;
                const mine = r.index === team.index;
                return (
                  <button
                    key={t.def.abbr}
                    onClick={() => openTeam(r.index)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: 0,
                      background: mine ? 'rgba(var(--clay-rgb), .10)' : 'transparent',
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
                        `${t.w}-${t.l}`,
                        String(rosterStrength(t.team)),
                        r.power.toFixed(1),
                      ]}
                    />
                  </button>
                );
              })}
            </>
          ) : (
            <>
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
                      for first behave unlike the ninety five around it — and the
                      page it now opens carries your results anyway, on its own tab.
                    */
                    onClick={() => openTeam(t.index)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: 0,
                      background: mine ? 'rgba(var(--clay-rgb), .10)' : 'transparent',
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
            </>
          )}
        </div>

        <div style={{
          marginTop: 10, font: "400 calc(11px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
        }}>
          {preseason
            ? 'A projection off the rosters, nothing more. Once the games start counting, the real table takes over and nobody remembers the poll.'
            : 'Tap a program for its roster, its season and how you have done against it.'}
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
      // Pinned, so ninety six rows never leave you guessing which column the
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
