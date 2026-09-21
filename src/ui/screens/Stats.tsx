// Stats.tsx
// The numbers: leaderboards for your team, the country and June, and your
// players' glove work.
//
// One card per leaderboard. Its heading says what the stat is in words and
// who qualifies, so a column labelled ERA never has to be decoded; the value
// column is labelled once, and your own players carry a You tag on the
// national boards.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FirstVisit } from '../Tutorial.js';
import {
  leaders, leagueFieldingRate, fieldingPct, paePer100, rankableChances, qualifiers,
  type LeaderRow, type FieldingSeason,
} from '../../engine/season.js';
import { pct } from '../format.js';
import { uniquePlayers } from '../../engine/types.js';
import type { Player, PlayerId } from '../../engine/types.js';
import {
  Card, EmptyState, Face, Marquee, SegmentedControl, StatGroup, Table, Tag, type TableColumn,
} from '../components/ui/index.js';
import { POSITION_NAME } from '../words.js';

type Scope = 'team' | 'national' | 'june' | 'fielding';

/** A signed rate, so a fielder's line and the league's read in the same units. */
const fmtRate = (v: number): string => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;

/** The engine's row detail, in words. */
function detailWords(detail: string): string {
  return detail
    .replace(/(\d+)-for-(\d+)/, '$1 for $2')
    .replace(/([\d.]+) IP/, (_, ip: string) => `${ip} innings`)
    .replace(/(\d+) CH, ([+-]?\d+) PLAYS, (\.\d+) PCT/, (_, ch: string, pae: string, fp: string) =>
      `${ch} chances · ${pae} plays · ${fp} fielding`);
}

export function Stats() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const year = useDynasty((s) => s.year);
  const team = useUserTeam();
  const openPlayer = useDynasty((s) => s.openPlayer);
  const [scope, setScope] = useState<Scope>('team');
  void version;

  if (!season || !team) return null;

  const played = season.results.length > 0;
  const anyJune = (season.postBatting?.size ?? 0) > 0 || (season.postPitching?.size ?? 0) > 0;
  const bars = qualifiers(season);
  /*
    June's qualifiers come down hard: the national bar is built for fifty games
    and a tournament is a fortnight, so leaving it in place draws an empty page.
    Your own roster's bat and arm bars go to one so the bench shows up; the glove
    keeps a real bar, because it is ranked on a rate.
  */
  const boards = scope === 'june'
    ? leaders(season, { limit: 5, minPA: 1, minIP: 1, minChances: 1, june: true })
    : scope === 'team'
      ? leaders(season, { limit: 5, minPA: 1, minIP: 1, minChances: 20, team: team.def.abbr })
      : leaders(season);

  // The roster's glove work: everyone with a chance, the qualified by rate first.
  const bar = rankableChances(season);
  const gloveRows = uniquePlayers([
    ...team.team.lineup, ...team.team.bench, ...team.team.rotation, ...team.team.bullpen,
  ])
    .map((p) => ({ p: p as Player, line: season.fielding?.get(p.id) }))
    .filter((r): r is { p: Player; line: FieldingSeason } => r.line !== undefined && r.line.chances > 0)
    .sort((a, b) => {
      const qa = a.line.chances >= bar ? 1 : 0;
      const qb = b.line.chances >= bar ? 1 : 0;
      if (qa !== qb) return qb - qa;
      if (qa === 0) return b.line.chances - a.line.chances;
      return paePer100(b.line) - paePer100(a.line) || b.line.chances - a.line.chances;
    });

  const schoolOf = (abbr: string): string => season.teams.find((t) => t.def.abbr === abbr)?.def.school ?? abbr;
  const qualifiesBat = scope === 'national' ? `at least ${bars.minPA} plate appearances`
    : scope === 'june' ? 'anyone with a postseason at-bat' : 'every player with an at-bat';
  const qualifiesArm = scope === 'national' ? `at least ${bars.minIP} innings`
    : scope === 'june' ? 'anyone with a postseason out' : 'every pitcher with an out';

  return (
    <main className="pb-page">
      <FirstVisit id="stats" />
      <Marquee eyebrow={`${year} season · Leaderboards`} title="Stats" />
      <SegmentedControl<Scope>
        label="Whose stats"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'team', label: 'Your team' },
          { value: 'national', label: 'National' },
          ...(anyJune ? [{ value: 'june' as const, label: 'Postseason' }] : []),
          { value: 'fielding', label: 'Fielding' },
        ]}
      />

      {!played ? (
        <EmptyState icon="bar-chart" title="No games played yet" text="The leaderboards fill in once the season starts." />
      ) : scope === 'fielding' ? (
        <>
          <StatGroup
            size="sm"
            items={[
              { label: 'Ranked', value: gloveRows.filter((g) => g.line.chances >= bar).length, note: `${bar}+ chances` },
              { label: 'League rate', value: fmtRate(leagueFieldingRate(season)), note: 'per 100 chances' },
              { label: 'Your fielders', value: gloveRows.length, note: 'with a chance' },
            ]}
          />
          <Card
            title="Plays made above average"
            eyebrow="Per 100 chances, errors taken off"
            flush
          >
            <Table
              dense
              label="Your fielders"
              columns={[
                { label: 'Player', grow: true },
                { label: 'Ch', title: 'Chances', width: '36px', align: 'right' },
                { label: 'E', title: 'Errors', width: '28px', align: 'right' },
                { label: 'Pct', title: 'Fielding percentage', width: '48px', align: 'right' },
                { label: 'Plays', title: 'Plays above average per 100 chances', width: '52px', align: 'right', strong: true },
              ]}
              empty="Nothing has been hit at anybody yet."
              rows={gloveRows.map(({ p, line }) => ({
                key: p.id,
                onClick: () => openPlayer(p.id as PlayerId),
                cells: [
                  <PlayerCell key="p" id={p.id} team={team.def.abbr} name={p.name} sub={p.type === 'pitcher' ? 'Pitcher' : POSITION_NAME[p.pos] ?? p.pos} />,
                  line.chances, line.errors, pct(fieldingPct(line)),
                  line.chances >= bar ? fmtRate(paePer100(line)) : '—',
                ],
              }))}
              caption={`The league sits at ${fmtRate(leagueFieldingRate(season))}, not zero: an error is a play nobody made. A dash means fewer than ${bar} chances.`}
            />
          </Card>
        </>
      ) : (
        <>
          <p className="pb-note">Qualifying: {qualifiesBat} at the plate, {qualifiesArm} on the mound.</p>
          <Board title="Batting average" about="Hits per at-bat" unit="AVG" rows={boards.average} fmt={pct} mine={team.def.abbr} scope={scope} schoolOf={schoolOf} onOpen={openPlayer} />
          <Board title="Home runs" about="Most home runs" unit="HR" rows={boards.homeRuns} fmt={String} mine={team.def.abbr} scope={scope} schoolOf={schoolOf} onOpen={openPlayer} />
          <Board title="Runs batted in" about="Runs driven in" unit="RBI" rows={boards.rbi} fmt={String} mine={team.def.abbr} scope={scope} schoolOf={schoolOf} onOpen={openPlayer} />
          <Board title="Earned run average" about="Earned runs per 9 innings · lower is better" unit="ERA" rows={boards.era} fmt={(v) => v.toFixed(2)} mine={team.def.abbr} scope={scope} schoolOf={schoolOf} onOpen={openPlayer} />
          <Board title="Strikeouts" about="Batters struck out" unit="K" rows={boards.strikeouts} fmt={String} mine={team.def.abbr} scope={scope} schoolOf={schoolOf} onOpen={openPlayer} />
          <Board
            title="Plays above average"
            about={`Per 100 chances · the league sits at ${fmtRate(leagueFieldingRate(season))}`}
            unit="Plays"
            rows={boards.fielding}
            fmt={fmtRate}
            mine={team.def.abbr}
            scope={scope}
            schoolOf={schoolOf}
            onOpen={openPlayer}
          />
        </>
      )}
    </main>
  );
}

function PlayerCell({ id, team, name, sub, you }: { id: string; team: string; name: string; sub: string; you?: boolean }) {
  return (
    <span className="pb-teamcell">
      <Face id={id} team={team} size={32} />
      <span className="pb-teamcell__text">
        <span className="pb-teamcell__name"><span className="pb-ellipsis">{name}</span>{you && <Tag tone="you">You</Tag>}</span>
        <span className="pb-teamcell__sub">{sub}</span>
      </span>
    </span>
  );
}

function Board(
  { title, about, unit, rows, fmt, mine, scope, schoolOf, onOpen }:
  {
    title: string; about: string; unit: string; rows: LeaderRow[]; fmt: (v: number) => string;
    mine: string; scope: Scope; schoolOf: (abbr: string) => string; onOpen: (id: PlayerId) => void;
  },
) {
  const columns: TableColumn[] = [
    { label: '#', width: '22px', align: 'right' },
    { label: 'Player', grow: true },
    { label: unit, title, width: '56px', align: 'right', strong: true },
  ];
  return (
    <Card title={title} eyebrow={about} flush>
      <Table
        label={title}
        columns={columns}
        empty="Nobody has qualified yet."
        rows={rows.map((r, i) => ({
          key: r.id,
          onClick: () => onOpen(r.id),
          you: scope !== 'team' && r.team === mine,
          cells: [
            <b key="n" className="pb-rank">{i + 1}</b>,
            <PlayerCell key="p" id={r.id} team={r.team} name={r.name} sub={`${scope === 'team' ? '' : `${schoolOf(r.team)} · `}${detailWords(r.detail)}`} you={scope !== 'team' && r.team === mine} />,
            <b key="v" className="pb-rank-value">{fmt(r.value)}</b>,
          ],
        }))}
      />
    </Card>
  );
}
