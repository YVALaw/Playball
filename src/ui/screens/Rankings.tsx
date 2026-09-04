// Rankings.tsx
// The whole country, in one table.
//
// The proposal's rankings screen: an intro, a poll switch, and the table as
// rows. Its poll switch offers Media and Coaches; this world has one poll and it
// is arithmetic — RPI — so the switch does the job it can actually do here and
// chooses between the country and the twenty five deep enough to be a Top 25.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { rpiOrder, regularRecord } from '../../engine/season.js';
import { rosterStrength } from '../../engine/program.js';
import { useOpenTeam } from './TeamCard.js';
import { pct } from '../format.js';
import { FieldNote, ModuleIntro, Segmented } from '../components/Kit.js';
import { ChevronRightIcon } from '@radix-ui/react-icons';

type Depth = 'top25' | 'all';

export function Rankings() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const openTeam = useOpenTeam();
  const [depth, setDepth] = useState<Depth>('top25');
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

  const rows = preseason
    ? season.teams
      .map((t, i) => ({
        index: i,
        abbr: t.def.abbr,
        school: t.def.school,
        conference: t.conference,
        record: `${t.w}-${t.l}`,
        value: (rosterStrength(t.team) * 0.75 + t.prestige * 0.25).toFixed(1),
        detail: `roster ${rosterStrength(t.team)}`,
      }))
      .sort((a, b) => Number(b.value) - Number(a.value) || a.abbr.localeCompare(b.abbr))
    : rpiOrder(season).map((r) => {
      const rec = regularRecord(r.team);
      return {
        index: r.team.index,
        abbr: r.team.def.abbr,
        school: r.team.def.school,
        conference: r.team.conference,
        record: `${rec.w}-${rec.l}`,
        // From the same games as the record beside it. winPct counts
        // tournament games, so a team could show 26-7 and .818.
        value: r.rpi.toFixed(3).replace(/^0/, ''),
        detail: pct(rec.w + rec.l > 0 ? rec.w / (rec.w + rec.l) : 0),
      };
    });

  const shown = depth === 'top25' ? rows.slice(0, 25) : rows;
  const mineAt = rows.findIndex((r) => r.index === team.index);

  return (
    <main className="module-workspace">
      <ModuleIntro
        kicker={preseason ? 'PRESEASON · PROJECTED' : 'NATIONAL · RPI'}
        title={depth === 'top25' ? 'Top 25' : 'The country'}
        text="Who is beating whom, weighted by whom they beat."
      />

      <Segmented
        label="Ranking depth"
        value={depth}
        onChange={setDepth}
        options={[
          { value: 'top25', label: 'Top 25' },
          { value: 'all', label: `All ${rows.length}` },
        ]}
      />

      <section className="standings-table">
        <div className="table-head">
          <span>PROGRAM</span>
          <span>W-L</span>
          <span>{preseason ? 'PWR' : 'RPI'}</span>
        </div>
        {shown.map((r, i) => (
          <button
            className={r.index === team.index ? 'is-yours' : ''}
            key={r.abbr}
            type="button"
            /*
              Every row opens that program's page, your own included.

              Your row used to be the only one that did anything, and what it did
              was jump to your schedule. That made the one row you look for first
              behave unlike the ninety five around it — and the page it now opens
              carries your results anyway, on its own tab.
            */
            onClick={() => openTeam(r.index)}
          >
            <b>{i + 1}</b>
            <strong>{r.school}<em>{r.conference} · {r.detail}</em></strong>
            <span>{r.record}</span>
            <span>{r.value}</span>
            <ChevronRightIcon />
          </button>
        ))}
      </section>

      {(preseason || (depth === 'top25' && mineAt >= 25)) && (
        <FieldNote
          title={preseason ? 'The preseason poll' : `You are ranked #${mineAt + 1}`}
          text={preseason
            ? 'Three parts roster, one part reputation. After the opening games the RPI takes over.'
            : 'Outside the twenty five. Switch to the full table to see the company you are keeping.'}
        />
      )}
    </main>
  );
}
