// Stats.tsx
// The numbers, all of them in one destination. Leaderboards — national by
// default, because a ninety six team world is the point of having one, and
// filterable down to your own program — plus your roster's glove work, which
// used to be a separate GLOVES tab on the roster and is a statistic like any
// other: batting, pitching and fielding live behind one set of tabs now.
//
// The proposal's stats screen: an intro, a scope switch, a three-up metric
// strip, and the boards as `.data-table`. Its four scopes are ours already —
// National, My team, Postseason, Fielding — which is one more sign the designer
// read the app before drawing it.
//
// The eight column glove grid went the way the roster's did. CH, PO, E, PCT and
// +/100 are all still here; four of them read as the row's detail line and the
// rate, which is the one the board is ranked on, is the number on the right.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FirstVisit } from '../Tutorial.js';
import { Avatar } from '../Avatar.js';
import {
  leaders, leagueFieldingRate, fieldingPct, paePer100, rankableChances,
  type LeaderRow, type FieldingSeason,
} from '../../engine/season.js';
import { pct } from '../format.js';
import {
  DataTable, FieldNote, Metric, MetricStrip, ModuleIntro, SectionHeading, Segmented,
  type Row,
} from '../components/Kit.js';
import { uniquePlayers } from '../../engine/types.js';
import type { Player, PlayerId } from '../../engine/types.js';

type Scope = 'national' | 'team' | 'june' | 'fielding';

/** A signed rate, so a fielder's line and the league's read in the same units. */
const fmtRate = (v: number): string => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;

export function Stats() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const year = useDynasty((s) => s.year);
  const team = useUserTeam();
  const openPlayer = useDynasty((s) => s.openPlayer);
  const [scope, setScope] = useState<Scope>('national');
  void version;

  if (!season || !team) return null;

  const played = season.results.length > 0;

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
    // rate off two chances is not a season.
    ? leaders(season, { limit: 5, minPA: 1, minIP: 1, minChances: 20, team: team.def.abbr })
    : leaders(season);

  // The roster's glove work, exactly as the old GLOVES tab kept it: every man
  // with a chance recorded, best rate first among the qualified, the rest by
  // volume with a dash where the rate would be shouting noise.
  const bar = rankableChances(season);
  const gloveRows = uniquePlayers([
    ...team.team.lineup, ...team.team.bench, ...team.team.rotation, ...team.team.bullpen,
  ])
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
      <main className="module-workspace">
        <section className="empty-state">
          <h2>No games played</h2>
          <p>Leaderboards fill in once the season starts.</p>
        </section>
      </main>
    );
  }

  /** A leaderboard row, with your own men marked by having a face at all. */
  const boardRows = (rows: LeaderRow[], fmt: (v: number) => string): Row[] =>
    rows.map((r) => ({
      key: r.id,
      title: r.name,
      detail: `${r.team}${r.detail ? ` · ${r.detail}` : ''}`,
      value: fmt(r.value),
      face: <Avatar id={r.id} team={r.team} size={34} />,
    }));

  const scopeLabel = scope === 'national' ? 'The country'
    : scope === 'june' ? 'The postseason'
      : scope === 'fielding' ? 'In the field' : team.def.school;

  return (
    <main className="module-workspace">
      <FirstVisit id="stats" />

      <ModuleIntro
        kicker={`${year} NUMBERS`}
        title={scopeLabel}
        text="League leaders, your own club, postseason lines, and the glove work behind them."
      />

      <Segmented
        label="Statistics scope"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'national', label: 'National' },
          { value: 'team', label: 'My team' },
          ...(anyJune ? [{ value: 'june' as const, label: 'Postseason' }] : []),
          { value: 'fielding', label: 'Fielding' },
        ]}
      />

      {scope === 'fielding' ? (
        <>
          <MetricStrip>
            <Metric label="GLOVES RANKED" value={String(gloveRows.filter((g) => g.line.chances >= bar).length)} note="QUALIFIED" />
            <Metric label="LEAGUE RATE" value={fmtRate(leagueFieldingRate(season))} note="PER 100 CH" />
            <Metric label="THE BAR" value={String(bar)} note="CHANCES" />
          </MetricStrip>
          <DataTable
            rows={gloveRows.map(({ p, line }) => ({
              key: p.id,
              title: p.name,
              detail: `${p.type === 'pitcher' ? 'P' : p.pos} · ${line.chances} CH · ${line.plays} PO · ${line.errors} E · ${pct(fieldingPct(line))}`,
              value: line.chances >= bar ? fmtRate(paePer100(line)) : '—',
              face: <Avatar id={p.id} team={team.def.abbr} size={34} />,
            }))}
            onOpen={(id) => openPlayer(id as PlayerId)}
            empty="Nothing has been hit at anybody yet."
          />
          <FieldNote
            title="Zero is not average"
            text={`+/100 is the outs he made that an average glove would not have, per hundred balls hit at him, errors already deducted. An error is a play nobody made, so the whole league sits at ${fmtRate(leagueFieldingRate(season))}. Above that line is a man helping his pitcher.`}
          />
        </>
      ) : (
        <>
          <Board title="BATTING AVERAGE" kicker="AT THE PLATE" rows={boardRows(boards.average, pct)} onOpen={openPlayer} />
          <Board title="HOME RUNS" kicker="POWER" rows={boardRows(boards.homeRuns, String)} onOpen={openPlayer} />
          <Board title="RUNS BATTED IN" kicker="DRIVEN IN" rows={boardRows(boards.rbi, String)} onOpen={openPlayer} />
          <Board title="EARNED RUN AVERAGE" kicker="ON THE MOUND" rows={boardRows(boards.era, (v) => v.toFixed(2))} onOpen={openPlayer} />
          <Board title="STRIKEOUTS" kicker="SWING AND MISS" rows={boardRows(boards.strikeouts, String)} onOpen={openPlayer} />
          {/*
            The defensive board ranks on plays made above what an average glove
            would have made of the same chances, not on errors — fewest errors
            in the country belongs to whoever nobody hits it to. Per hundred
            chances rather than as a total, because a centre fielder sees six
            times what a catcher does and the raw count reads that as talent.
          */}
          <Board
            title="PLAYS ABOVE AVERAGE"
            kicker="PER 100 CHANCES"
            rows={boardRows(boards.fielding, fmtRate)}
            onOpen={openPlayer}
          />
          <FieldNote
            title="Zero is not average"
            text={`An error is a play nobody made, so the league itself sits at ${fmtRate(leagueFieldingRate(season))}. Anything above that line is a fielder helping his pitcher.`}
          />
        </>
      )}
    </main>
  );
}

function Board(
  { title, kicker, rows, onOpen }:
  { title: string; kicker: string; rows: Row[]; onOpen: (id: PlayerId) => void },
) {
  return (
    <>
      <SectionHeading kicker={kicker} title={title} />
      <DataTable
        rows={rows}
        onOpen={(id) => onOpen(id as PlayerId)}
        empty="Nobody has qualified yet."
      />
    </>
  );
}
