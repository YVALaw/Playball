// god/CoachEditor.tsx — your coach: what he can do, who he is, what he has done.
//
// Opened from the bolt on the coach profile and from the header's bolt on
// the Program tab.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { SectionHeading } from '../components/Kit.js';
import { BADGES as COACH_BADGES } from '../../data/badges.js';
import { SKILLS, SKILL_LABEL } from '../../engine/program.js';
import { PHILOSOPHIES, type PhilosophyId } from '../../engine/strategy.js';
import type { HabitKey } from '../../engine/habits.js';
import { Field, Slider, Toast } from './controls.js';

const HABITS: readonly { key: HabitKey; label: string }[] = [
  { key: 'managed', label: 'GAMES MANAGED' },
  { key: 'pen', label: 'TRIPS TO THE MOUND' },
  { key: 'aggressive', label: 'AGGRESSIVE CALLS' },
  { key: 'wire', label: 'WIRE STORIES READ' },
  { key: 'talkedDown', label: 'TALKED OUT OF THE DRAFT' },
  { key: 'freshmen', label: 'FRESHMEN PLAYED' },
  { key: 'walkOns', label: 'WALK-ONS KEPT' },
  { key: 'comebacks', label: 'COMEBACKS' },
  { key: 'roadUpsets', label: 'ROAD UPSETS' },
  { key: 'overachieved', label: 'SEASONS OVERACHIEVED' },
];

const RECORD = [
  ['CAREER WINS', 'careerWins'], ['CAREER LOSSES', 'careerLosses'],
  ['NATIONAL TITLES', 'titles'], ['CONFERENCE TITLES', 'conferenceTitles'],
  ['REGIONALS WON', 'regionalTitles'], ['TOURNAMENTS', 'tournaments'],
] as const;

export function CoachEditor() {
  const coach = useDynasty((s) => s.coach);
  const setCoach = useDynasty((s) => s.godSetCoach);
  const setCoachMore = useDynasty((s) => s.godSetCoachMore);
  const [note, setNote] = useState<string | null>(null);
  const coachBadges = coach.badges ?? [];
  const philosophyOf = (id: PhilosophyId): string => PHILOSOPHIES.find((p) => p.id === id)?.name ?? id;

  return (
    <main className="module-workspace god-desk">
      <section className="god-card">
        <Field label="NAME" value={coach.name} onCommit={(v) => setCoachMore({ name: v })} />
        <Slider label="AGE" value={coach.age} min={22} max={80} onCommit={(v) => setCoachMore({ age: v })} />
        <Slider label="COACH PRESTIGE" value={coach.prestige} min={1} max={100} onCommit={(v) => setCoach({ prestige: v })} />
      </section>

      <SectionHeading kicker="YOUR CHAIR" title="Skills" />
      <section className="god-card">
        {SKILLS.map((k) => (
          <Slider key={k} label={SKILL_LABEL[k]} value={coach.skills[k]} onCommit={(v) => setCoach({ skills: { [k]: v } })} />
        ))}
        <div className="god-actions">
          <span><small>SKILL POINTS</small><strong>{coach.skillPoints}</strong></span>
          <button type="button" className="tap" onClick={() => setCoach({ skillPoints: coach.skillPoints + 1 })}>+1</button>
          <button type="button" className="tap" onClick={() => setCoach({ skillPoints: coach.skillPoints + 5 })}>+5</button>
        </div>
      </section>

      <SectionHeading kicker="YOUR CHAIR" title="The job" />
      <section className="god-card">
        <label className="god-field">
          <small>PHILOSOPHY</small>
          <select value={coach.philosophy} onChange={(e) => { setCoachMore({ philosophy: e.target.value as PhilosophyId }); setNote(`${philosophyOf(e.target.value as PhilosophyId)}: the standing strategy was reset to it.`); }}>
            {PHILOSOPHIES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <Slider label="SECURITY" value={coach.security} min={0} max={100} onCommit={(v) => setCoachMore({ security: v })} />
        <Slider label="YEARS LEFT" value={coach.contractYears} min={0} max={10} onCommit={(v) => setCoachMore({ contractYears: v })} />
        <Slider label="CONTRACT LENGTH" value={coach.contractLength} min={1} max={10} onCommit={(v) => setCoachMore({ contractLength: v })} />
        <Slider label="SEASONS HERE" value={coach.tenure} min={0} max={40} onCommit={(v) => setCoachMore({ tenure: v })} />
      </section>

      <SectionHeading kicker="YOUR CHAIR" title="The record" />
      <section className="god-card">
        <div className="god-selects">
          {RECORD.map(([label, key]) => (
            <Field
              key={key}
              label={label}
              numeric
              value={String(coach[key])}
              onCommit={(v) => { const n = Number(v); if (Number.isFinite(n)) setCoachMore({ [key]: n }); }}
            />
          ))}
        </div>
        <p className="god-note">The line the coach profile and the job market read.</p>
      </section>

      <SectionHeading kicker="YOUR CHAIR" title="What you are known for" />
      <section className="god-card">
        <div className="god-badges">
          {COACH_BADGES.map((b) => {
            const held = coachBadges.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                className={`tap${held ? ' active' : ''}`}
                aria-pressed={held}
                onClick={() => setCoachMore({ badges: held ? coachBadges.filter((x) => x !== b.id) : [...coachBadges, b.id] })}
              >{b.name}</button>
            );
          })}
        </div>
        <p className="god-note">The game hands out five at most; a sandbox may hold them all.</p>
      </section>

      <SectionHeading kicker="YOUR CHAIR" title="The hidden counters" />
      <section className="god-card">
        {HABITS.map((h) => (
          <Slider
            key={h.key}
            label={h.label}
            value={coach.habits?.[h.key] ?? 0}
            min={0}
            max={300}
            onCommit={(v) => setCoachMore({ habits: { [h.key]: v } })}
          />
        ))}
        <p className="god-note">What the earned badges read. Move one past its bar and the badge arrives at the season's close.</p>
      </section>

      <Toast note={note} />
    </main>
  );
}
