// Roster.tsx
// Your players: who they are, how good they are today, how good they can get,
// and whether they can play.
//
// The two numbers are defined once, at the top, in words. Every row then says
// the same things in the same places: the face, the name, the position, the
// class year, the potential, a status badge when there is something to say,
// and the rating big at the right. Search and chips narrow the list; class
// year, position and status filters sit behind the filter button.

import { useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { GodBolt } from '../god/GodBolt.js';
import { handles } from '../../state/depth.js';
import { FirstVisit } from '../Tutorial.js';
import { overallOf, naturalPos } from '../../engine/ratings.js';
import { captainOf } from '../../engine/captains.js';
import { potentialGrade } from '../../engine/scouting.js';
import { battingAverage, era, inningsPitched, injuryClock } from '../../engine/season.js';
import { isHurt } from '../../engine/injury.js';
import { mood } from '../../engine/morale.js';
import { draftEligible } from '../../engine/draft.js';
import { available } from '../../engine/depthChart.js';
import { uniquePlayers } from '../../engine/types.js';
import type { Hitter, Pitcher, Player } from '../../engine/types.js';
import { whyOut } from '../Needs.js';
import { ipText, pct } from '../format.js';
import {
  Button, Chip, Chips, EmptyState, Face, IconButton, List, Marquee, Monogram, NamePlate, PlayerRow,
  SearchField, SectionHeader, StatusBadge, Tag,
} from '../components/ui/index.js';
import { CLASS_NAME, POSITION_NAME } from '../words.js';

type Mode = 'all' | 'bat' | 'arm' | 'hurt';

/** The order a lineup card thinks in; pitcher roles ride at the end. */
const SLOT_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'SP', 'RP'];

// A DH reads as the position he actually plays: the DH is a lineup slot, not a
// player. See `naturalPos`.
const slotOf = (p: Player): string =>
  p.type === 'pitcher' ? (p as Pitcher).role : naturalPos(p as Hitter);

const sentence = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Why a player is not playing, as a badge that says which reason: the
 * trainer's, the registrar's, a season you chose to redshirt, or a rest.
 * Nothing for a player who is fit, which is nearly everybody nearly always.
 */
function statusBadge(p: Player, day: number) {
  if ((p as Player & { redshirt?: boolean }).redshirt) {
    return <StatusBadge tone="neutral" icon="pause">Redshirt · sits out this season</StatusBadge>;
  }
  if (available(p, day)) return null;
  if (isHurt(p, day)) return <StatusBadge tone="negative" icon="cross-circled">Injured · {whyOut(p, day)}</StatusBadge>;
  if ((p as Player & { why?: string }).why === 'academic') {
    return <StatusBadge tone="warning" icon="reader">Academic hold · {whyOut(p, day)}</StatusBadge>;
  }
  return <StatusBadge tone="neutral" icon="clock">{sentence(whyOut(p, day))}</StatusBadge>;
}

export function Roster() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const openOverlay = useDynasty((st) => st.openOverlay);
  // The captaincy has its own switch; this door reads that one.
  const namesCaptain = useDynasty((st) => handles(st.depth, 'captains'));
  const openPlayer = useDynasty((s) => s.openPlayer);
  const [mode, setMode] = useState<Mode>('all');
  const [query, setQuery] = useState('');
  const [yearF, setYearF] = useState<string | null>(null);
  const [posF, setPosF] = useState<string | null>(null);
  const [statusF, setStatusF] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  void version;

  const day = season ? injuryClock(season) : 0;
  const all = useMemo(() => (team ? uniquePlayers([
    ...team.team.lineup, ...team.team.bench, ...team.team.rotation, ...team.team.bullpen,
  ]) : []), [team, version]);

  if (!season || !team) return null;

  const hittersAll = uniquePlayers([...team.team.lineup, ...team.team.bench]);
  const armsAll = uniquePlayers([...team.team.rotation, ...team.team.bullpen]);
  const captain = captainOf(team.team);
  const hurtCount = all.filter((p) => isHurt(p, day)).length;

  const keep = (p: Player): boolean => {
    const feeling = mood(p);
    const statusOk = statusF === null
      || (statusF === 'unhappy' && (feeling === 'unhappy' || feeling === 'restless'))
      || (statusF === 'draft' && (p.classYear === 'SR' || draftEligible({ classYear: p.classYear, age: p.age + 1 })))
      || (statusF === 'redshirt' && Boolean((p as Player & { redshirt?: boolean }).redshirt));
    const q = query.trim().toLowerCase();
    return (yearF === null || p.classYear === yearF)
      && (posF === null || slotOf(p) === posF)
      && (q === '' || p.name.toLowerCase().includes(q))
      && statusOk;
  };

  const base = mode === 'bat' ? hittersAll : mode === 'arm' ? armsAll : mode === 'hurt' ? all.filter((p) => isHurt(p, day)) : all;
  const rows = base.filter(keep).sort((a, b) => overallOf(b) - overallOf(a));
  const slots = [...new Set(all.map(slotOf))].sort((a, b) => {
    const ai = SLOT_ORDER.indexOf(a); const bi = SLOT_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });
  const filtered = yearF !== null || posF !== null || statusF !== null;
  const clearFilters = (): void => { setYearF(null); setPosF(null); setStatusF(null); };

  const statsFor = (p: Player): Array<{ label: string; value: string; title?: string }> | undefined => {
    if (mode === 'bat' && p.type !== 'pitcher') {
      const line = season.batting.get(p.id);
      return [
        { label: 'AVG', title: 'Batting average', value: line && line.ab > 0 ? pct(battingAverage(line)) : '—' },
        { label: 'HR', title: 'Home runs', value: line ? String(line.hr) : '—' },
      ];
    }
    if (mode === 'arm' && p.type === 'pitcher') {
      const line = season.pitching.get(p.id);
      return [
        { label: 'ERA', title: 'Earned runs per 9 innings', value: line && line.outs > 0 ? era(line).toFixed(2) : '—' },
        { label: 'IP', title: 'Innings pitched', value: line && line.outs > 0 ? ipText(inningsPitched(line)) : '—' },
      ];
    }
    return undefined;
  };

  const title = mode === 'bat' ? 'Hitters' : mode === 'arm' ? 'Pitchers' : mode === 'hurt' ? 'Injured' : 'All players';

  return (
    <main className="pb-page">
      <FirstVisit id="roster" />
      <Marquee
        eyebrow={`${team.def.school} · ${all.length} on the card`}
        title="Roster"
        trailing={<GodBolt target={{ kind: 'roster', team: team.index }} label="Edit the roster in god mode" />}
        numbers={[
          { label: 'Hitters', value: hittersAll.length },
          { label: 'Pitchers', value: armsAll.length },
          { label: 'Freshmen', value: all.filter((p) => p.classYear === 'FR').length },
          {
            label: 'Injured',
            value: hurtCount,
            tone: hurtCount > 0 ? 'negative' : undefined,
          },
        ]}
      />

      <div className="pb-stack">
        <SearchField
          label="Search your roster"
          placeholder={`Search ${all.length} players`}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          trailing={(
            <IconButton
              icon="filter"
              label={filtered ? 'More filters, some on' : 'More filters'}
              tone="quiet"
              badge={filtered ? '•' : undefined}
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((v) => !v)}
            />
          )}
        />
        <Chips label="Show">
          <Chip selected={mode === 'all'} count={all.length} onClick={() => setMode('all')}>All</Chip>
          <Chip selected={mode === 'bat'} count={hittersAll.length} onClick={() => setMode('bat')}>Hitters</Chip>
          <Chip selected={mode === 'arm'} count={armsAll.length} onClick={() => setMode('arm')}>Pitchers</Chip>
          {hurtCount > 0 && <Chip selected={mode === 'hurt'} count={hurtCount} onClick={() => setMode('hurt')}>Injured</Chip>}
        </Chips>
        {filterOpen && (
          <div className="pb-filters">
            <Chips label="Class year">
              {(['FR', 'SO', 'JR', 'SR'] as const).map((y) => (
                <Chip key={y} selected={yearF === y} onClick={() => setYearF(yearF === y ? null : y)}>{CLASS_NAME[y]}</Chip>
              ))}
            </Chips>
            <Chips label="Position">
              {slots.map((s) => (
                <Chip key={s} selected={posF === s} onClick={() => setPosF(posF === s ? null : s)}>
                  {POSITION_NAME[s as keyof typeof POSITION_NAME] ?? s}
                </Chip>
              ))}
            </Chips>
            <Chips label="Status">
              {[['unhappy', 'Unhappy'], ['draft', 'Draft eligible'], ['redshirt', 'Redshirt']].map(([k, label]) => (
                <Chip key={k} selected={statusF === k} onClick={() => setStatusF(statusF === k ? null : k!)}>{label}</Chip>
              ))}
            </Chips>
            {filtered && <Button variant="quiet" size="sm" icon="cross" onClick={clearFilters}>Clear filters</Button>}
          </div>
        )}
      </div>

      <section>
        <SectionHeader
          title={title}
          count={rows.length === base.length ? rows.length : `${rows.length} of ${base.length}`}
        />
        {rows.length === 0 ? (
          <EmptyState
            icon="search"
            title="Nobody matches"
            text="Try a different search or clear the filters."
            action={filtered || query ? { label: 'Clear search and filters', onClick: () => { clearFilters(); setQuery(''); } } : undefined}
          />
        ) : (
          <List label="Players">
            {rows.map((p) => {
              const slot = slotOf(p);
              return (
                <PlayerRow
                  key={p.id}
                  name={p.name}
                  avatar={<Face id={p.id} team={team.def.abbr} size={40} />}
                  mark={captain?.id === p.id ? <Tag tone="positive" title="Team captain">Captain</Tag> : undefined}
                  tags={[
                    { text: slot, title: POSITION_NAME[slot as keyof typeof POSITION_NAME] ?? slot },
                    CLASS_NAME[p.classYear],
                  ]}
                  meta={`Potential ${potentialGrade(p.potential)}`}
                  flags={statusBadge(p, day) ?? undefined}
                  stats={statsFor(p)}
                  value={overallOf(p)}
                  valueLabel="Rating"
                  onClick={() => openPlayer(p.id as Parameters<typeof openPlayer>[0])}
                />
              );
            })}
          </List>
        )}
      </section>

      {namesCaptain && (
        <section>
          <SectionHeader title="Team roles" />
          <NamePlate
            mark={captain
              ? <Face id={captain.id} team={team.def.abbr} size={36} />
              : <Monogram vacant size={36} />}
            role="Captain"
            name={captain ? captain.name : 'Nobody yet'}
            value={captain ? overallOf(captain) : undefined}
            vacant={!captain}
            onClick={() => openOverlay('captain')}
          />
        </section>
      )}
    </main>
  );
}
