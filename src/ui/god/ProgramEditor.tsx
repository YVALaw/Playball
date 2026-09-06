// god/ProgramEditor.tsx — a program's name, standing, league and roster.
//
// Opened from the bolt on any college profile, and for your own program from
// the header's bolt on the Program and Team tabs. The roster is a list of
// doors: a man opens his own editor on top of this one.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { SectionHeading } from '../components/Kit.js';
import { conferenceWindow } from '../../engine/godMode.js';
import { leagueName } from '../../engine/leagueNames.js';
import { isHurt } from '../../engine/injury.js';
import { overallOf } from '../../engine/ratings.js';
import { potentialGrade } from '../../engine/scouting.js';
import { prestigeStars } from '../../engine/program.js';
import { isTwoWay, type Hitter, type Pitcher, type Player, type PlayerId } from '../../engine/types.js';
import { Field, Slider, Toast } from './controls.js';

const slotOf = (p: Player): string =>
  p.type === 'pitcher' ? (p as Pitcher).role : (p as Hitter).pos;

export function ProgramEditor({ team, roster = true }: { team: number; roster?: boolean }) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const userTeam = useDynasty((s) => s.userTeam);
  const setPrestige = useDynasty((s) => s.godSetPrestige);
  const rename = useDynasty((s) => s.godRenameProgram);
  const swap = useDynasty((s) => s.godSwapConferences);
  const addPlayer = useDynasty((s) => s.godAddPlayer);
  const openGod = useDynasty((s) => s.openGod);
  const [swapWith, setSwapWith] = useState(-1);
  const [note, setNote] = useState<string | null>(null);
  void version;

  const record = season?.teams[team];
  if (!season || !record) return null;
  const window = conferenceWindow(season);
  const others = season.teams.filter((t) => t.conference !== record.conference);
  const swapTarget = swapWith >= 0 ? season.teams[swapWith] ?? null : null;
  // A two-way man sits in the order and in the pen; the list shows him once.
  const men: Player[] = [...new Map<PlayerId, Player>([
    ...record.team.lineup, ...record.team.bench, ...record.team.rotation, ...record.team.bullpen,
  ].map((p) => [p.id, p])).values()];

  return (
    <main className="module-workspace god-desk">
      <section className="god-card">
        <Field label="SCHOOL" value={record.def.school} onCommit={(v) => rename(record.index, v, record.def.nickname)} />
        <Field label="NICKNAME" value={record.def.nickname} onCommit={(v) => rename(record.index, record.def.school, v)} />
        <Slider label="PRESTIGE" value={record.prestige} min={1} max={100} onCommit={(v) => setPrestige(record.index, v)} />
        <p className="god-note">
          {'★'.repeat(prestigeStars(record.prestige))} · {leagueName(record.conference)} · the crest keeps the abbreviation, {record.def.abbr}.
          {record.index === userTeam ? ' This is your program.' : ''}
        </p>
      </section>

      <SectionHeading kicker="THE LEAGUE" title="Trade leagues" />
      <section className="god-card">
        <div className="god-field">
          <small>TRADE LEAGUES WITH</small>
          <select value={swapWith} disabled={window === 'closed'} onChange={(e) => setSwapWith(Number(e.target.value))}>
            <option value={-1}>Choose a program in another league</option>
            {others.map((t) => (
              <option key={t.index} value={t.index}>{t.def.school} · {leagueName(t.conference)}</option>
            ))}
          </select>
          <button
            type="button"
            className="tap"
            disabled={window === 'closed' || !swapTarget}
            onClick={() => {
              if (!swapTarget) return;
              if (swap(record.index, swapTarget.index)) {
                setNote(`${record.def.school} and ${swapTarget.def.school} traded leagues.`);
                setSwapWith(-1);
              }
            }}
          >TRADE</button>
          <p className="god-note">
            {window === 'now'
              ? 'Before the first pitch: the schedule is rebuilt on the spot.'
              : window === 'next-spring'
                ? 'The season is over: the trade takes effect next spring.'
                : 'Games have been played in these leagues. Trades open again after the season.'}
          </p>
        </div>
      </section>

      {roster && (
        <>
          <SectionHeading kicker="THE ROSTER" title={`${men.length} men`} />
          <section className="god-card">
            <div className="god-actions">
              <button type="button" className="tap" onClick={() => { const id = addPlayer(record.index, 'hitter'); if (id) openGod({ kind: 'player', id }); }}>ADD A BAT</button>
              <button type="button" className="tap" onClick={() => { const id = addPlayer(record.index, 'pitcher'); if (id) openGod({ kind: 'player', id }); }}>ADD AN ARM</button>
            </div>
            <div className="god-roster">
              {men.map((p) => (
                <button key={p.id} type="button" className="tap" onClick={() => openGod({ kind: 'player', id: p.id })}>
                  <strong>{p.name}</strong>
                  <small>
                    {slotOf(p)} · {p.classYear} · {overallOf(p)} OVR · {potentialGrade(p.potential)}
                    {isHurt(p, season.dayIndex) ? ' · HURT' : ''}{isTwoWay(p) ? ' · 2-WAY' : ''}
                  </small>
                </button>
              ))}
            </div>
            <p className="god-note">Tap a man to edit him. A new man arrives on the bench or in the pen, ready to be rewritten.</p>
          </section>
        </>
      )}

      <Toast note={note} />
    </main>
  );
}
