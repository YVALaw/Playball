// Stats.tsx
// Leaderboards. National by default, because a 64 team world is the point of
// having one — but your own program is what you actually care about, so it can
// be filtered down.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { leaders, leagueFieldingRate, type LeaderRow } from '../../engine/season.js';
import { pct } from '../format.js';
import type { PlayerId } from '../../engine/types.js';

type Scope = 'national' | 'team';

/** A signed rate, so a fielder's line and the league's read in the same units. */
const fmtRate = (v: number): string => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;

export function Stats() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const openPlayer = useDynasty((s) => s.openPlayer);
  const [scope, setScope] = useState<Scope>('national');
  void version;

  if (!season || !team) return null;

  const played = season.results.length > 0;

  // Filter to the roster BEFORE ranking, and drop the qualifier: a nine man
  // lineup cannot fill a top five against a national minimum, and on your own
  // team you want to see everybody including the bench.
  const boards = scope === 'team'
    // The bat and arm qualifiers go to 1 on your own roster so the bench shows
    // up. The glove keeps a real bar even here: it is ranked on a rate, and a
    // rate off two chances is not a season. Low enough that a catcher and a
    // platoon corner outfielder both make it.
    ? leaders(season, { limit: 5, minPA: 1, minIP: 1, minChances: 20, team: team.def.abbr })
    : leaders(season);

  const mine = (rows: LeaderRow[]): LeaderRow[] => rows;

  if (!played) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center' }}>
        <div className="label">NO GAMES PLAYED</div>
        <div style={{
          marginTop: 8, font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
        }}>Leaderboards fill in once the season starts.</div>
      </div>
    );
  }

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">LEADERS</div>
            <div style={{
              font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
            }}>{scope === 'national' ? 'National' : team.def.school}</div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <Chip on={scope === 'national'} onClick={() => setScope('national')}>NATIONAL</Chip>
            <Chip on={scope === 'team'} onClick={() => setScope('team')}>MY TEAM</Chip>
          </div>
        </div>
      }
    >
      <div style={{ padding: '2px 14px 16px' }}>
        <Board title="BATTING AVERAGE" rows={mine(boards.average)} fmt={pct} mark={team.def.abbr} onPick={openPlayer} />
        <Board title="HOME RUNS" rows={mine(boards.homeRuns)} fmt={String} mark={team.def.abbr} onPick={openPlayer} />
        <Board title="RUNS BATTED IN" rows={mine(boards.rbi)} fmt={String} mark={team.def.abbr} onPick={openPlayer} />
        <Board title="EARNED RUN AVERAGE" rows={mine(boards.era)} fmt={(v) => v.toFixed(2)} mark={team.def.abbr} onPick={openPlayer} />
        <Board title="STRIKEOUTS" rows={mine(boards.strikeouts)} fmt={String} mark={team.def.abbr} onPick={openPlayer} />
        {/*
          The defensive board ranks on plays made above what an average glove
          would have made of the same chances, not on errors — fewest errors in
          the country belongs to whoever nobody hits it to. Per hundred chances
          rather than as a total, because a centre fielder sees six times what a
          catcher does and the raw count reads that as talent. The detail line
          carries the volume, the raw plays and the percentage so nothing is
          hidden behind the rate.
        */}
        <Board
          title="PLAYS ABOVE AVERAGE / 100 CH"
          rows={mine(boards.fielding)}
          fmt={fmtRate}
          detail
          mark={team.def.abbr}
          onPick={openPlayer}
        />
        <div style={{
          marginTop: 8, font: "400 11px/1.5 var(--body)", color: 'var(--dim)',
        }}>
          Outs he made that an average glove would not have, per hundred balls hit
          at him, once enough has been hit at him to mean something. Zero is not
          average here: an error is a play nobody made, so the league itself sits
          at <strong>{fmtRate(leagueFieldingRate(season))}</strong>. Anything above
          that line is a fielder helping his pitcher.
        </div>
      </div>
    </FixedHeader>
  );
}

function Chip(
  { on, onClick, children }: { on: boolean; onClick: () => void; children: string },
) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        background: on ? 'var(--clay)' : 'transparent',
        border: `1px solid ${on ? 'var(--clay)' : 'rgba(28,36,48,.25)'}`,
        color: on ? 'var(--cream)' : 'rgba(28,36,48,.6)',
        font: "600 10px var(--mono)", letterSpacing: '.14em',
      }}
    >{children}</button>
  );
}

function Board(
  { title, rows, fmt, mark, onPick, detail }:
  {
    title: string; rows: LeaderRow[]; fmt: (v: number) => string;
    mark: string; onPick: (id: PlayerId) => void;
    /**
     * Show the row's own second line. Off everywhere else because "3 HR" under a
     * home run leader is noise, and on for the fielding board because a count of
     * plays above average means nothing without knowing how many balls he saw.
     */
    detail?: boolean;
  },
) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="label" style={{ marginBottom: 5 }}>{title}</div>
      <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
        {rows.length === 0 && (
          <div style={{
            padding: '9px 10px', font: "400 11px var(--body)", color: 'var(--dim)',
          }}>Nobody qualified yet.</div>
        )}
        {rows.map((r, i) => {
          const ours = r.team === mark;
          return (
            // A national leaderboard is a list of strangers with, if you are
            // lucky, one of yours somewhere in it. Finding him should not take
            // reading the team column of thirty rows.
            <button key={r.id} onClick={() => onPick(r.id)} style={{
              width: '100%', textAlign: 'left',
              display: 'grid', gridTemplateColumns: '16px 1fr 30px 52px',
              gap: 6, alignItems: 'center',
              padding: '7px 10px', borderBottom: '1px solid var(--hairline)',
              borderLeft: ours ? '3px solid var(--clay)' : '3px solid transparent',
              background: ours ? 'rgba(168,68,42,.15)' : 'transparent',
            }}>
              <span style={{ font: "400 10px var(--mono)", color: 'var(--dim)' }}>{i + 1}</span>
              <span style={{
                font: `${ours ? 600 : 400} 12px var(--body)`,
                color: ours ? 'var(--clay)' : 'var(--ink)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{r.name}</span>
              <span style={{
                font: `${ours ? 700 : 400} 10px var(--mono)`,
                color: ours ? 'var(--clay)' : 'var(--dim)', textAlign: 'right',
              }}>{r.team}</span>
              <span style={{
                font: "600 12px var(--mono)", textAlign: 'right',
              }}>{fmt(r.value)}</span>
              {detail && (
                <span style={{
                  gridColumn: '2 / -1', marginTop: 1,
                  font: "400 9.5px var(--mono)", color: 'var(--dim)',
                }}>{r.detail}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
