// god/GodSheet.tsx — the sheet a bolt opens, over whatever is underneath.
//
// One overlay for every god-mode editor (05 §61.5). The store keeps a stack
// of targets; the sheet shows the top one and its back arrow pops it, so an
// editor reached from inside another — a man from his program's roster —
// steps back rather than out. A tab target is a short menu of doors rather
// than every editor at once: the one-screen desk was reported as "a list
// nobody could find anything in", and this is its replacement.

import { ChevronRightIcon } from '@radix-ui/react-icons';
import { useDynasty, type Tab } from '../../state/store.js';
import { Overlay } from '../Overlay.js';
import { godTitle, type GodTarget } from './target.js';
import { PlayerEditor } from './PlayerEditor.js';
import { ProgramEditor } from './ProgramEditor.js';
import { CoachEditor } from './CoachEditor.js';
import { MoneyEditor } from './MoneyEditor.js';
import { LeaguesEditor } from './LeaguesEditor.js';
import { RecruitEditor, RecruitsEditor } from './RecruitEditor.js';
import { PortalEditor } from './PortalEditor.js';
import { TimeEditor } from './TimeEditor.js';

export function GodOverlay() {
  const stack = useDynasty((s) => s.godStack);
  const closeGod = useDynasty((s) => s.closeGod);
  const top = stack[stack.length - 1];
  if (!top) return null;
  const { eyebrow, title } = godTitle(top);
  return (
    <Overlay eyebrow={eyebrow} title={title} onClose={closeGod} className="god-sheet">
      <Editor key={`${stack.length}:${keyOf(top)}`} target={top} />
    </Overlay>
  );
}

const keyOf = (t: GodTarget): string =>
  'id' in t ? `${t.kind}:${t.id}` : 'team' in t ? `${t.kind}:${t.team}` : 'tab' in t ? `${t.kind}:${t.tab}` : t.kind;

function Editor({ target }: { target: GodTarget }) {
  switch (target.kind) {
    case 'tab': return <TabDoors tab={target.tab} />;
    case 'player': return <PlayerEditor id={target.id} />;
    case 'program': return <ProgramEditor team={target.team} />;
    case 'coach': return <CoachEditor />;
    case 'money': return <MoneyEditor />;
    case 'leagues': return <LeaguesEditor />;
    case 'recruits': return <RecruitsEditor />;
    case 'recruit': return <RecruitEditor id={target.id} />;
    case 'portal': return <PortalEditor />;
    case 'time': return <TimeEditor />;
  }
}

/** A door: one tile, one editor. */
interface Door { target: GodTarget; kicker: string; title: string; blurb: string }

function TabDoors({ tab }: { tab: Tab }) {
  const userTeam = useDynasty((s) => s.userTeam);
  const portal = useDynasty((s) => s.portal);
  const openGod = useDynasty((s) => s.openGod);
  const program: Door = { target: { kind: 'program', team: userTeam }, kicker: 'YOUR PROGRAM', title: 'The program and the roster', blurb: 'Name, prestige, league; every man on the roster, or a new one.' };
  const coach: Door = { target: { kind: 'coach' }, kicker: 'YOUR CHAIR', title: 'Your coach', blurb: 'Skills, the record, the contract, badges, the hidden counters.' };
  const money: Door = { target: { kind: 'money' }, kicker: 'THE MONEY', title: 'Budget and staff', blurb: 'Money and recruiting points on top; the assistants renamed and rerated.' };
  const leagues: Door = { target: { kind: 'leagues' }, kicker: 'THE LEAGUES', title: 'The leagues', blurb: 'What each league is called, and which programs play in which.' };
  const time: Door = { target: { kind: 'time' }, kicker: 'THE CALENDAR', title: 'Time and the world', blurb: 'Reshuffle the schedule, sim the season, parity, chaos, a superteam.' };
  const recruits: Door = { target: { kind: 'recruits' }, kicker: 'RECRUITING', title: 'The class', blurb: 'Recruits added, rewritten, committed on the spot.' };
  const portalDoor: Door = { target: { kind: 'portal' }, kicker: 'THE PORTAL', title: 'Sign for nothing', blurb: 'Every man in the portal, yours at no cost.' };
  const doors: Door[] = tab === 'home' ? [time, program, recruits, ...(portal ? [portalDoor] : [])]
    : tab === 'team' ? [program, recruits, ...(portal ? [portalDoor] : []), coach]
    : tab === 'season' ? [leagues, time, program]
    : [program, coach, money, leagues];
  return (
    <main className="module-workspace god-desk">
      <p className="god-note god-lead">Anything here is yours to rewrite, and it saves as you go. Records still count; it is god mode. Every player card, program page, recruiting file and money sheet carries a bolt of its own.</p>
      <div className="god-doors">
        {doors.map((d) => (
          <button key={d.title} type="button" className="god-door tap" onClick={() => openGod(d.target)}>
            <span><small>{d.kicker}</small><strong>{d.title}</strong></span>
            <p>{d.blurb}</p>
            <ChevronRightIcon />
          </button>
        ))}
      </div>
    </main>
  );
}
