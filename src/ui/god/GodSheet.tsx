// god/GodSheet.tsx — god mode's control center and focused editors.
//
// A small control center first, grouped by area, then one tool at a time, each
// on its own page. An editor can have its own panels without turning the whole
// feature into one long settings form.

import { useMemo, useState } from 'react';
import { useDynasty, type Tab } from '../../state/store.js';
import { findPlayer } from '../../engine/godMode.js';
import { Overlay } from '../Overlay.js';
import { Chip, Chips, List, ListRow, type IconName } from '../components/ui/index.js';
import { godTitle, type GodTarget } from './target.js';
import { GodPage, words } from './controls.js';
import { PlayerEditor } from './PlayerEditor.js';
import { ProgramEditor } from './ProgramEditor.js';
import { RosterEditor } from './RosterEditor.js';
import { CoachEditor } from './CoachEditor.js';
import { MoneyEditor } from './MoneyEditor.js';
import { LeaguesEditor } from './LeaguesEditor.js';
import { RecruitEditor, RecruitsEditor } from './RecruitEditor.js';
import { PortalEditor } from './PortalEditor.js';
import { TimeEditor } from './TimeEditor.js';

export function GodOverlay() {
  const stack = useDynasty((s) => s.godStack);
  const closeGod = useDynasty((s) => s.closeGod);
  const season = useDynasty((s) => s.season);
  const coach = useDynasty((s) => s.coach);
  const top = stack[stack.length - 1];
  if (!top) return null;
  const { eyebrow, title } = godTitle(top);
  const contextTitle = top.kind === 'player' && season ? findPlayer(season, top.id)?.player.name
    : top.kind === 'program' || top.kind === 'roster' ? season?.teams[top.team]?.def.school
    : top.kind === 'coach' ? coach.name
    : top.kind === 'recruit' ? season?.recruiting.prospects.find((p) => p.id === top.id)?.player.name
    : null;
  return (
    <Overlay eyebrow={words(eyebrow)} title={contextTitle ?? title} onClose={closeGod} className="god-sheet">
      <Editor key={`${stack.length}:${keyOf(top)}`} target={top} />
    </Overlay>
  );
}

const keyOf = (t: GodTarget): string =>
  'id' in t ? `${t.kind}:${t.id}` : 'team' in t ? `${t.kind}:${t.team}` : 'tab' in t ? `${t.kind}:${t.tab}` : t.kind;

function Editor({ target }: { target: GodTarget }) {
  switch (target.kind) {
    case 'tab': return <ControlCenter sourceTab={target.tab} />;
    case 'player': return <PlayerEditor id={target.id} />;
    case 'program': return <ProgramEditor team={target.team} />;
    case 'roster': return <RosterEditor team={target.team} />;
    case 'coach': return <CoachEditor />;
    case 'money': return <MoneyEditor />;
    case 'leagues': return <LeaguesEditor />;
    case 'recruits': return <RecruitsEditor />;
    case 'recruit': return <RecruitEditor id={target.id} />;
    case 'portal': return <PortalEditor />;
    case 'time': return <TimeEditor />;
  }
}

type Area = 'team' | 'program' | 'recruiting' | 'leagues' | 'world';

const AREAS: ReadonlyArray<{ value: Area; label: string; blurb: string }> = [
  { value: 'team', label: 'Team', blurb: 'Your roster and every player on it.' },
  { value: 'program', label: 'Program', blurb: 'The school, your coach, the money and the staff.' },
  { value: 'recruiting', label: 'Recruiting', blurb: 'The recruiting class and the transfer portal.' },
  { value: 'leagues', label: 'Leagues', blurb: 'League names, and which programs play in which league.' },
  { value: 'world', label: 'World', blurb: 'The calendar, and presets that change the whole world at once.' },
];

const START_AREA: Record<Tab, Area> = {
  home: 'world',
  team: 'team',
  season: 'leagues',
  program: 'program',
};

interface Door { target: GodTarget; icon: IconName; title: string; blurb: string; metric?: { value: number; unit: string } }

function ControlCenter({ sourceTab }: { sourceTab: Tab }) {
  const userTeam = useDynasty((s) => s.userTeam);
  const season = useDynasty((s) => s.season);
  const coach = useDynasty((s) => s.coach);
  const portal = useDynasty((s) => s.portal);
  const openGod = useDynasty((s) => s.openGod);
  const [area, setArea] = useState<Area>(START_AREA[sourceTab]);
  const me = season?.teams[userTeam];

  const doors = useMemo<Record<Area, Door[]>>(() => ({
    team: [
      {
        target: { kind: 'roster', team: userTeam }, icon: 'person', title: 'Players and roster',
        blurb: 'Add players, then open anyone to edit him.',
        metric: me ? { value: new Set([...me.team.lineup, ...me.team.bench, ...me.team.rotation, ...me.team.bullpen].map((p) => p.id)).size, unit: ' players' } : undefined,
      },
    ],
    program: [
      { target: { kind: 'program', team: userTeam }, icon: 'home', title: 'School and prestige', blurb: 'Rename the program and change its prestige.', metric: me ? { value: Math.round(me.prestige), unit: '/100' } : undefined },
      { target: { kind: 'coach' }, icon: 'id-card', title: 'Your coach', blurb: 'Profile, skills, contract, record, badges and hidden counters.', metric: { value: Math.round(coach.prestige), unit: '/100' } },
      { target: { kind: 'money' }, icon: 'bar-chart', title: 'Budget and staff', blurb: 'Add money or recruiting points, and edit your assistants.' },
    ],
    recruiting: [
      {
        target: { kind: 'recruits' }, icon: 'search', title: 'Recruiting class', blurb: 'Add prospects, or change a prospect’s stars and priorities.',
        metric: season ? { value: season.recruiting.prospects.filter((p) => p.signedBy === null).length, unit: ' unsigned' } : undefined,
      },
      ...(portal ? [{ target: { kind: 'portal' } as GodTarget, icon: 'swap' as IconName, title: 'Transfer portal', blurb: 'Sign anyone in the portal at once, at no cost.', metric: { value: portal.available.length, unit: ' available' } }] : []),
    ],
    leagues: [
      { target: { kind: 'leagues' }, icon: 'globe', title: 'Names and membership', blurb: 'Rename leagues or move programs between them.' },
    ],
    world: [
      { target: { kind: 'time' }, icon: 'calendar', title: 'Calendar and presets', blurb: 'Redraw the schedule, sim ahead, or apply parity, chaos or a superteam.' },
    ],
  }), [coach.prestige, me, portal, season, userTeam]);

  const current = AREAS.find((a) => a.value === area)!;

  return (
    <GodPage eyebrow="God mode" title="Control center">
      <Chips label="God mode area">
        {AREAS.map((a) => (
          <Chip key={a.value} selected={a.value === area} onClick={() => setArea(a.value)}>{a.label}</Chip>
        ))}
      </Chips>
      <section>
        <p className="pb-text-muted pb-godblurb">{current.blurb}</p>
        <List label={`${current.label} tools`}>
          {doors[area].map((d) => (
            <ListRow
              key={d.title}
              icon={d.icon}
              title={d.title}
              subtitle={d.blurb}
              value={d.metric?.value}
              unit={d.metric?.unit}
              onClick={() => openGod(d.target)}
            />
          ))}
        </List>
      </section>
    </GodPage>
  );
}
