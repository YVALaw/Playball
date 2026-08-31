// Colleges.tsx
// The directory. Ninety six programs, and a search box over them.
//
// Every other route to a rival's page runs through a table that happens to
// mention them — the standings, the rankings, a wire story. This screen is the
// front door: any program, any time, one tap to its full card.
//
// The proposal's directory, with its search row and its region filter. This
// world has eight conferences rather than four regions, so the filter carries
// conferences — and the alphabetised list the proposal implies is replaced by
// prestige order, because nobody thinks of a college baseball team by its
// initial and the strongest programme in a conference is the one you were
// looking for.

import { useState } from 'react';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { Avatar } from '../Avatar.js';
import { prestigeStars } from '../../engine/program.js';
import { useOpenTeam } from './TeamCard.js';
import { CONFERENCES } from '../../data/schools.js';
import { DataTable, ModuleIntro, Segmented, type Row } from '../components/Kit.js';

export function Colleges() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const openTeam = useOpenTeam();
  const [conf, setConf] = useState<string>('all');
  const [query, setQuery] = useState('');
  void version;

  if (!season || !team) return null;

  // Matched on `id`, not `name`. A team record carries `conf.id` — 'GULF' —
  // and the first version of this screen filtered on 'Gulf Coast Conference',
  // which matched nothing and rendered a directory of no schools at all.
  const present = CONFERENCES.filter((c) => season.teams.some((t) => t.conference === c.id));

  const needle = query.trim().toLowerCase();
  const rows: Row[] = season.teams
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => (conf === 'all' || t.conference === conf))
    .filter(({ t }) => needle === ''
      || t.def.school.toLowerCase().includes(needle)
      || t.def.nickname.toLowerCase().includes(needle)
      || t.def.abbr.toLowerCase().includes(needle))
    .sort((a, b) => b.t.prestige - a.t.prestige)
    .map(({ t, i }) => ({
      key: String(i),
      title: t.def.school,
      detail: `${t.def.nickname} · ${t.conference} · ${t.w}-${t.l} · ${'★'.repeat(prestigeStars(t.prestige))}`,
      value: t.def.abbr,
      // The program's own colour, worn by a shirt rather than printed as a
      // hex — ninety six names in one typeface are ninety six strings.
      face: <Avatar id={`school-${t.def.abbr}`} team={t.def.abbr} size={34} />,
    }));

  return (
    <main className="module-workspace">
      <ModuleIntro
        kicker="NATIONAL DIRECTORY"
        title="College programs"
        text="Search any program in the country and open its complete card — roster, season, and how you have done against it."
      />

      <label className="search-row">
        <MagnifyingGlassIcon />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search programs"
          aria-label="Search programs"
        />
      </label>

      <Segmented
        label="Conference"
        value={conf}
        onChange={setConf}
        options={[
          { value: 'all', label: 'All' },
          ...present.map((c) => ({ value: c.id, label: c.id })),
        ]}
      />

      <div className="directory-status">
        <span>{rows.length} {rows.length === 1 ? 'program' : 'programs'}</span>
        <b>{present.length} CONFERENCES</b>
      </div>

      {rows.length > 0 ? (
        <DataTable rows={rows} onOpen={(k) => openTeam(Number(k))} />
      ) : (
        <section className="watchlist-empty">
          <MagnifyingGlassIcon />
          <strong>No program found</strong>
          <p>Try another name, or clear the conference filter.</p>
        </section>
      )}
    </main>
  );
}
