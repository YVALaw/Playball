// Rankings.tsx
// The whole country, in one table.
//
// One ranking, and it says what it measures every visit: RPI weighs wins by
// the strength of who you beat. In the opening weeks, before there are enough
// games for that to mean anything, the country is ranked on a preseason
// projection instead, and the header says so. Your own row is tinted; when it
// is outside the view, a row at the bottom says where you are and shows you.

import { leagueName } from '../../engine/leagueNames.js';
import { useState, type ReactNode } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { rpiOrder, regularRecord, nationalOrder, pollIsProjected } from '../../engine/season.js';
import { rosterStrength } from '../../engine/program.js';
import { useOpenTeam } from './TeamCard.js';
import { pct } from '../format.js';
import {
  Button, Card, Marquee, SegmentedControl, Table, TeamCell,
} from '../components/ui/index.js';
import { Crest } from '../Crest.js';
import { ordinal, recordText } from '../words.js';

type Depth = 'top25' | 'all';

export function Rankings({ head }: { head?: ReactNode } = {}) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const openTeam = useOpenTeam();
  const [depth, setDepth] = useState<Depth>('top25');
  void version;
  if (!season || !team) return null;

  // Until the average program has a few games behind it, RPI is a coin toss
  // sorted by the tiebreak, so the country is ranked on what the rosters are
  // worth (with a little reputation). The order lives in the engine so the
  // rank on Today and this table can never disagree.
  const preseason = pollIsProjected(season);

  const rows = preseason
    ? nationalOrder(season).map(({ team: t, value }) => ({
      index: t.index,
      abbr: t.def.abbr,
      school: t.def.school,
      conference: t.conference,
      record: recordText(t.w, t.l),
      value: value.toFixed(1),
      detail: `Roster ${rosterStrength(t.team)}`,
    }))
    : rpiOrder(season).map((r) => {
      const rec = regularRecord(r.team);
      return {
        index: r.team.index,
        abbr: r.team.def.abbr,
        school: r.team.def.school,
        conference: r.team.conference,
        record: recordText(rec.w, rec.l),
        // From the same games as the record beside it.
        value: r.rpi.toFixed(3).replace(/^0/, ''),
        detail: `${pct(rec.w + rec.l > 0 ? rec.w / (rec.w + rec.l) : 0)} win rate`,
      };
    });

  const shown = depth === 'top25' ? rows.slice(0, 25) : rows;
  const mineAt = rows.findIndex((r) => r.index === team.index);
  const outside = depth === 'top25' && mineAt >= 25;

  return (
    <main className="pb-page">
      {head}
      <Marquee
        mark={<Crest abbr={team.def.abbr} size={44} />}
        eyebrow={`The country · ${rows.length} programs`}
        title={preseason ? 'Preseason ranking' : 'National ranking'}
        numbers={[
          { label: 'You sit', value: mineAt >= 0 ? ordinal(mineAt + 1) : '—' },
          {
            label: preseason ? 'Power' : 'RPI',
            value: mineAt >= 0 ? rows[mineAt]!.value : '—',
            note: mineAt >= 0 ? rows[mineAt]!.detail : undefined,
          },
          { label: 'Record', value: mineAt >= 0 ? rows[mineAt]!.record : '—' },
        ]}
      />

      <SegmentedControl<Depth>
        label="How many teams"
        value={depth}
        onChange={setDepth}
        options={[
          { value: 'top25', label: 'Top 25' },
          { value: 'all', label: `All ${rows.length}` },
        ]}
      />

      <Card flush>
        <Table
          label={preseason ? 'Preseason ranking' : 'National ranking'}
          columns={[
            { label: '#', width: '28px', align: 'right' },
            { label: 'Team', grow: true },
            { label: 'W–L', title: 'Regular-season record', width: '48px', align: 'right' },
            {
              label: preseason ? 'Power' : 'RPI',
              title: preseason ? 'Preseason power: roster and reputation' : 'Rating percentage index',
              width: '52px',
              align: 'right',
              strong: true,
            },
          ]}
          rows={[
            ...shown.map((r, i) => ({
              key: r.abbr,
              you: r.index === team.index,
              onClick: () => openTeam(r.index),
              cells: [
                <b key="r" className="pb-rank">{i + 1}</b>,
                <TeamCell
                  key="t"
                  abbr={r.abbr}
                  name={r.school}
                  you={r.index === team.index}
                  sub={`${leagueName(r.conference).replace(/\s+Conference$/i, '')} · ${r.detail}`}
                />,
                r.record,
                r.value,
              ],
            })),
            // You, when the top 25 leaves you out: your row, under a line.
            ...(outside && mineAt >= 0 ? [{
              key: 'you',
              you: true,
              divider: true,
              onClick: () => openTeam(team.index),
              cells: [
                <b key="r" className="pb-rank">{mineAt + 1}</b>,
                <TeamCell
                  key="t"
                  abbr={rows[mineAt]!.abbr}
                  name={rows[mineAt]!.school}
                  you
                  sub={`${leagueName(rows[mineAt]!.conference).replace(/\s+Conference$/i, '')} · ${rows[mineAt]!.detail}`}
                />,
                rows[mineAt]!.record,
                rows[mineAt]!.value,
              ],
            }] : []),
          ]}
          caption={preseason
            ? 'W–L is the regular-season record. Power is the preseason projection: roster strength with a little reputation.'
            : 'W–L is the regular-season record. RPI is the rating percentage index: your winning rate, your opponents’, and theirs.'}
        />
      </Card>

      {outside && (
        <Button variant="secondary" block onClick={() => setDepth('all')}>
          You are #{mineAt + 1}. Show all {rows.length} teams
        </Button>
      )}
    </main>
  );
}
