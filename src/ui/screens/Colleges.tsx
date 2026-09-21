// Colleges.tsx
// The national directory: every program, one tap from its page.
//
// A search box, the conferences by their full names, and every school with
// its crest, nickname, record and prestige. Sorted by prestige, the stars,
// because the strongest program in a conference is usually the one you were
// looking for; the list says so.

import { useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { Crest } from '../Crest.js';
import { prestigeStars } from '../../engine/program.js';
import { regularRecord } from '../../engine/season.js';
import { useOpenTeam } from './TeamCard.js';
import { CONFERENCES } from '../../data/schools.js';
import {
  Chip, Chips, EmptyState, List, ListRow, Marquee, SearchField, SectionHeader, Stars, Tag,
} from '../components/ui/index.js';
import { conferenceName, recordText } from '../words.js';

export function Colleges() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const openTeam = useOpenTeam();
  const [conf, setConf] = useState<string>('all');
  const [query, setQuery] = useState('');
  void version;

  if (!season || !team) return null;

  // Matched on the conference id a team record carries, not its name.
  const present = CONFERENCES.filter((c) => season.teams.some((t) => t.conference === c.id));
  const needle = query.trim().toLowerCase();
  const rows = season.teams
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => conf === 'all' || t.conference === conf)
    .filter(({ t }) => needle === ''
      || t.def.school.toLowerCase().includes(needle)
      || t.def.nickname.toLowerCase().includes(needle)
      || t.def.abbr.toLowerCase().includes(needle))
    .sort((a, b) => b.t.prestige - a.t.prestige);

  return (
    <main className="pb-page">
      <Marquee
        eyebrow={`${season.teams.length} programs · ${present.length} conferences`}
        title="Colleges"
      />
      <SearchField
        label="Search programs"
        placeholder={`Search ${season.teams.length} programs`}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
      />
      <Chips label="Conference">
        <Chip selected={conf === 'all'} onClick={() => setConf('all')}>All</Chip>
        {present.map((c) => (
          <Chip key={c.id} selected={conf === c.id} onClick={() => setConf(conf === c.id ? 'all' : c.id)}>
            {conferenceName(c.id)}
          </Chip>
        ))}
      </Chips>
      <section>
        <SectionHeader title={conf === 'all' ? 'All programs' : `${conferenceName(conf)} programs`} count={rows.length} />
        {rows.length === 0 ? (
          <EmptyState icon="search" title="No program found" text="Try another name, or clear the conference filter." />
        ) : (
          <List label="Programs">
            {rows.map(({ t, i }) => {
              const rec = regularRecord(t);
              const you = i === team.index;
              return (
                <ListRow
                  key={t.def.abbr}
                  lead={<Crest abbr={t.def.abbr} size={36} />}
                  title={<>{t.def.school}{you && <> <Tag tone="you">You</Tag></>}</>}
                  subtitle={`${t.def.nickname} · ${conferenceName(t.conference)} · ${recordText(rec.w, rec.l)}${you ? ' · your program' : ''}`}
                  status={<Stars value={prestigeStars(t.prestige)} label="Prestige" />}
                  onClick={() => openTeam(i)}
                />
              );
            })}
          </List>
        )}
      </section>
    </main>
  );
}
