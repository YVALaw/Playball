// god/GodSheet.tsx — God Mode's control center and focused editors.
//
// The old God Mode desk was still effectively a long list. This version uses
// a small top-level control center, then opens one responsibility at a time.
// Editors can have their own compact sub-tabs without turning the whole feature
// into a settings dump.

import { useMemo, useState } from 'react';
import { ChevronRightIcon, LightningBoltIcon } from '@radix-ui/react-icons';
import { useDynasty, type Tab } from '../../state/store.js';
import { findPlayer } from '../../engine/godMode.js';
import { Overlay } from '../Overlay.js';
import { Segmented } from '../components/Kit.js';
import { godTitle, type GodTarget } from './target.js';
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
    <Overlay eyebrow={eyebrow} title={contextTitle ?? title} onClose={closeGod} className="god-sheet">
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

const AREA_OPTIONS = [
  { value: 'team', label: 'TEAM' },
  { value: 'program', label: 'PROGRAM' },
  { value: 'recruiting', label: 'RECRUIT' },
  { value: 'leagues', label: 'LEAGUES' },
  { value: 'world', label: 'WORLD' },
] as const;

const START_AREA: Record<Tab, Area> = {
  home: 'world',
  team: 'team',
  season: 'leagues',
  program: 'program',
};

interface Door { target: GodTarget; kicker: string; title: string; blurb: string; metric?: string }

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
      { target: { kind: 'roster', team: userTeam }, kicker: 'ROSTER', title: 'Players & roster', blurb: 'Add players, find anyone on the roster, then open his own editor.', metric: me ? `${new Set([...me.team.lineup, ...me.team.bench, ...me.team.rotation, ...me.team.bullpen].map((p) => p.id)).size} PLAYERS` : undefined },
    ],
    program: [
      { target: { kind: 'program', team: userTeam }, kicker: 'PROGRAM', title: 'School & prestige', blurb: 'Rename the program and change its prestige. League movement lives under Leagues.', metric: me ? `${Math.round(me.prestige)} PRESTIGE` : undefined },
      { target: { kind: 'coach' }, kicker: 'COACH', title: 'Coach profile', blurb: 'Identity, skills, contract, record, badges and hidden counters.', metric: `${Math.round(coach.prestige)} PRESTIGE` },
      { target: { kind: 'money' }, kicker: 'OPERATIONS', title: 'Budget & staff', blurb: 'Grant money or recruiting points and edit the assistant staff.' },
    ],
    recruiting: [
      { target: { kind: 'recruits' }, kicker: 'RECRUITING', title: 'Recruiting class', blurb: 'Add prospects, pick a recruit, edit stars and priorities.', metric: season ? `${season.recruiting.prospects.filter((p) => p.signedBy === null).length} UNSIGNED` : undefined },
      ...(portal ? [{ target: { kind: 'portal' } as GodTarget, kicker: 'TRANSFER PORTAL', title: 'Portal', blurb: 'Sign an available transfer instantly at no cost.', metric: `${portal.available.length} AVAILABLE` }] : []),
    ],
    leagues: [
      { target: { kind: 'leagues' }, kicker: 'LEAGUE CONTROL', title: 'Names & membership', blurb: 'Rename leagues or move programs between them. These controls are separate from rosters.' },
    ],
    world: [
      { target: { kind: 'time' }, kicker: 'WORLD CONTROL', title: 'Calendar & presets', blurb: 'Reshuffle before play, simulate forward, or apply parity, chaos and superteam presets.' },
    ],
  }), [coach.prestige, me, portal, season, userTeam]);

  const areaCopy: Record<Area, { kicker: string; title: string; blurb: string }> = {
    team: { kicker: 'TEAM CONTROL', title: 'Build the roster.', blurb: 'Roster management and individual player edits live here—nothing about league alignment is mixed into it.' },
    program: { kicker: 'PROGRAM CONTROL', title: 'Run the program.', blurb: 'School identity, your coach, money and staff are grouped together without burying them in one long form.' },
    recruiting: { kicker: 'TALENT CONTROL', title: 'Control incoming talent.', blurb: 'Recruiting and the transfer portal are close enough to find together, but each opens as its own tool.' },
    leagues: { kicker: 'LEAGUE CONTROL', title: 'Rewrite the map.', blurb: 'League names and conference membership belong here—not inside a roster or program profile.' },
    world: { kicker: 'WORLD CONTROL', title: 'Move the season.', blurb: 'Calendar actions and global presets are isolated because they can change the whole save at once.' },
  };
  const copy = areaCopy[area];

  return (
    <main className="module-workspace god-desk god-control-center">
      <section className="god-command-hero compact">
        <span><LightningBoltIcon /></span>
        <div>
          <small>{copy.kicker}</small>
          <strong>{copy.title}</strong>
          <p>{copy.blurb}</p>
        </div>
      </section>

      <div className="god-area-tabs">
        <Segmented value={area} options={AREA_OPTIONS} onChange={setArea} label="God Mode category" />
      </div>

      <div className="god-doors god-control-doors">
        {doors[area].map((d) => (
          <button key={`${d.kicker}:${d.title}`} type="button" className="god-door tap" onClick={() => openGod(d.target)}>
            <span>
              <small>{d.kicker}</small>
              <strong>{d.title}</strong>
              {d.metric && <b>{d.metric}</b>}
            </span>
            <p>{d.blurb}</p>
            <ChevronRightIcon />
          </button>
        ))}
      </div>
    </main>
  );
}
