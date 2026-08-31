// Stats.tsx
// The numbers, all of them in one destination. Leaderboards — national by
// default, because a ninety six team world is the point of having one, and
// filterable down to your own program — plus your roster's glove work, which
// used to be a separate GLOVES tab on the roster and is a statistic like any
// other: batting, pitching and fielding live behind one set of chips now.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { FirstVisit } from '../Tutorial.js';
import { Avatar } from '../Avatar.js';
import {
  leaders, leagueFieldingRate, fieldingPct, paePer100, rankableChances,
  type LeaderRow, type FieldingSeason,
} from '../../engine/season.js';
import { pct } from '../format.js';
import type { Player, PlayerId } from '../../engine/types.js';

type Scope = 'national' | 'team' | 'june' | 'fielding';

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
  /*
    June, on its own.

    The qualifiers have to come down and they have to come down hard: the
    national bar is built for fifty games and a tournament is at most a
    fortnight, so leaving it in place produces an empty screen rather than a
    leaderboard. One at-bat and one out are the honest floor for a sample this
    short, and the row's own detail says how few.
  */
  const juneBoards = leaders(season, { limit: 5, minPA: 1, minIP: 1, minChances: 1, june: true });
  const anyJune = (season.postBatting?.size ?? 0) > 0 || (season.postPitching?.size ?? 0) > 0;

  const boards = scope === 'june' ? juneBoards : scope === 'team'
    // The bat and arm qualifiers go to 1 on your own roster so the bench shows
    // up. The glove keeps a real bar even here: it is ranked on a rate, and a
    // rate off two chances is not a season. Low enough that a catcher and a
    // platoon corner outfielder both make it.
    ? leaders(season, { limit: 5, minPA: 1, minIP: 1, minChances: 20, team: team.def.abbr })
    : leaders(season);

  // The roster's glove work, exactly as the old GLOVES tab kept it: every man
  // with a chance recorded, best rate first among the qualified, the rest by
  // volume with a dash where the rate would be shouting noise.
  const bar = rankableChances(season);
  const gloveRows = [
    ...team.team.lineup, ...team.team.bench, ...team.team.rotation, ...team.team.bullpen,
  ]
    .map((p) => ({ p: p as Player, line: season.fielding?.get(p.id) }))
    .filter((r): r is { p: Player; line: FieldingSeason } =>
      r.line !== undefined && r.line.chances > 0)
    .sort((a, b) => {
      const qa = a.line.chances >= bar ? 1 : 0;
      const qb = b.line.chances >= bar ? 1 : 0;
      if (qa !== qb) return qb - qa;
      if (qa === 0) return b.line.chances - a.line.chances;
      return paePer100(b.line) - paePer100(a.line)
        || b.line.chances - a.line.chances;
    });

  if (!played) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center' }}>
        <div className="label">NO GAMES PLAYED</div>
        <div style={{
          marginTop: 8, font: "400 calc(12px * var(--ts))/1.6 var(--body)", color: 'var(--dim)',
        }}>Leaderboards fill in once the season starts.</div>
      </div>
    );
  }

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">{
              scope === 'fielding' ? 'IN THE FIELD'
                : scope === 'june' ? 'WHEN IT MATTERED' : 'LEADERS'
            }</div>
            <div style={{
              font: "800 calc(21px * var(--ts))/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
            }}>{
              scope === 'national' ? 'National'
                : scope === 'june' ? 'The postseason' : team.def.school
            }</div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <Chip on={scope === 'national'} onClick={() => setScope('national')}>NATIONAL</Chip>
            <Chip on={scope === 'team'} onClick={() => setScope('team')}>MY TEAM</Chip>
            {/* Only once there is a June to look at. A tab that is always there
                and always empty for nine months of every year teaches a player
                to stop pressing it. */}
            {anyJune && (
              <Chip on={scope === 'june'} onClick={() => setScope('june')}>POSTSEASON</Chip>
            )}
            {/* Everybody who takes the field, pitchers included — a comebacker
                is a chance and the mound has a glove. The roster's third tab
                until fielding moved in with the other numbers. */}
            <Chip on={scope === 'fielding'} onClick={() => setScope('fielding')}>FIELDING</Chip>
          </div>
        </div>
      }
    >
      {scope === 'fielding' ? (
        <div style={{ padding: '10px 14px 16px' }}>
          <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
            <div style={{
              position: 'sticky', top: 0, zIndex: 1, background: 'var(--paper)',
              display: 'grid', gridTemplateColumns: GLOVE_GRID, gap: 4,
              padding: '7px 10px', borderBottom: '1px solid var(--hairline)',
            }}>
              {['', 'PLAYER', 'POS', 'CH', 'PO', 'E', 'PCT', '+/100'].map((c, i) => (
                <span key={i} className="label" style={{ textAlign: i > 1 ? 'right' : 'left' }}>{c}</span>
              ))}
            </div>
            {gloveRows.length === 0 && (
              <div style={{
                padding: '12px 10px', font: "400 calc(12px * var(--ts)) var(--body)", color: 'var(--dim)',
              }}>Nothing has been hit at anybody yet.</div>
            )}
            {gloveRows.map(({ p, line }) => (
              <button
                key={p.id}
                onClick={() => openPlayer(p.id)}
                style={{
                  width: '100%', textAlign: 'left',
                  display: 'grid', gridTemplateColumns: GLOVE_GRID, gap: 4,
                  alignItems: 'center', padding: '7px 10px',
                  borderBottom: '1px solid var(--hairline)',
                  background: (p.type === 'hitter'
                    ? team.team.lineup.includes(p)
                    : team.team.rotation.includes(p))
                    ? 'rgba(var(--clay-rgb), .05)' : 'transparent',
                }}
              >
                <Avatar id={p.id} team={team.def.abbr} size={26} />
                <span style={{
                  font: "400 calc(12px * var(--ts)) var(--body)",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.name}</span>
                <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)", textAlign: 'right' }}>
                  {p.type === 'pitcher' ? 'P' : p.pos}
                </span>
                <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)", textAlign: 'right' }}>{line.chances}</span>
                <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)", textAlign: 'right' }}>{line.plays}</span>
                <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)", textAlign: 'right' }}>{line.errors}</span>
                <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)", textAlign: 'right' }}>
                  {pct(fieldingPct(line))}
                </span>
                <span style={{ font: "600 calc(11px * var(--ts)) var(--mono)", textAlign: 'right' }}>
                  {line.chances >= bar ? fmtRate(paePer100(line)) : '—'}
                </span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10, font: "400 calc(11px * var(--ts))/1.5 var(--body)", color: 'var(--dim)' }}>
            <strong>CH</strong> is balls hit at him; <strong>+/100</strong> the outs he made that
            an average glove would not have, per hundred of them, errors already deducted. Zero is
            not average. An error is a play nobody made, so the whole league sits at{' '}
            <strong>{fmtRate(leagueFieldingRate(season))}</strong>. Above that line is a man
            helping his pitcher.
          </div>
          <FirstVisit id="stats" />
        </div>
      ) : (
      <div style={{ padding: '2px 14px 16px' }}>
        <FirstVisit id="stats" />
        <Board title="BATTING AVERAGE" rows={boards.average} fmt={pct} mark={team.def.abbr} onPick={openPlayer} />
        <Board title="HOME RUNS" rows={boards.homeRuns} fmt={String} mark={team.def.abbr} onPick={openPlayer} />
        <Board title="RUNS BATTED IN" rows={boards.rbi} fmt={String} mark={team.def.abbr} onPick={openPlayer} />
        <Board title="EARNED RUN AVERAGE" rows={boards.era} fmt={(v) => v.toFixed(2)} mark={team.def.abbr} onPick={openPlayer} />
        <Board title="STRIKEOUTS" rows={boards.strikeouts} fmt={String} mark={team.def.abbr} onPick={openPlayer} />
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
          rows={boards.fielding}
          fmt={fmtRate}
          detail
          mark={team.def.abbr}
          onPick={openPlayer}
        />
        <div style={{
          marginTop: 8, font: "400 calc(11px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
        }}>
          Outs he made that an average glove would not have, per hundred balls hit
          at him, once enough has been hit at him to mean something. Zero is not
          average here: an error is a play nobody made, so the league itself sits
          at <strong>{fmtRate(leagueFieldingRate(season))}</strong>. Anything above
          that line is a fielder helping his pitcher.
        </div>
      </div>
      )}
    </FixedHeader>
  );
}

/** Avatar, name, position, then the five glove columns. */
const GLOVE_GRID = '30px 1fr 26px 30px 30px 22px 42px 38px';

function Chip(
  { on, onClick, children }: { on: boolean; onClick: () => void; children: string },
) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        background: on ? 'var(--clay)' : 'transparent',
        border: `1px solid ${on ? 'var(--clay)' : 'rgba(var(--ink-rgb), .25)'}`,
        color: on ? 'var(--cream)' : 'rgba(var(--ink-rgb), .6)',
        font: "600 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.14em',
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
            padding: '9px 10px', font: "400 calc(11px * var(--ts)) var(--body)", color: 'var(--dim)',
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
              background: ours ? 'rgba(var(--clay-rgb), .15)' : 'transparent',
            }}>
              <span style={{ font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>{i + 1}</span>
              <span style={{
                font: `${ours ? 600 : 400} calc(12px * var(--ts)) var(--body)`,
                color: ours ? 'var(--clay)' : 'var(--ink)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{r.name}</span>
              <span style={{
                font: `${ours ? 700 : 400} calc(10px * var(--ts)) var(--mono)`,
                color: ours ? 'var(--clay)' : 'var(--dim)', textAlign: 'right',
              }}>{r.team}</span>
              <span style={{
                font: "600 calc(12px * var(--ts)) var(--mono)", textAlign: 'right',
              }}>{fmt(r.value)}</span>
              {detail && (
                <span style={{
                  gridColumn: '2 / -1', marginTop: 1,
                  font: "400 calc(9.5px * var(--ts)) var(--mono)", color: 'var(--dim)',
                }}>{r.detail}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
