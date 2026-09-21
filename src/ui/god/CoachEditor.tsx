// god/CoachEditor.tsx — you, the head coach, in focused panels.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { BADGES as COACH_BADGES } from '../../data/badges.js';
import { SKILLS, SKILL_LABEL } from '../../engine/program.js';
import { PHILOSOPHIES, type PhilosophyId } from '../../engine/strategy.js';
import type { HabitKey } from '../../engine/habits.js';
import { Button, Card, Chip, Chips, SegmentedControl, StatGroup } from '../components/ui/index.js';
import { capsWords, plural } from '../words.js';
import { Choose, Field, GodPage, Slider, Toast } from './controls.js';

const HABITS: readonly { key: HabitKey; label: string }[] = [
  { key: 'managed', label: 'Games managed' }, { key: 'pen', label: 'Trips to the mound' },
  { key: 'aggressive', label: 'Aggressive calls' }, { key: 'wire', label: 'Wire stories read' },
  { key: 'talkedDown', label: 'Players talked out of the draft' }, { key: 'freshmen', label: 'Freshmen played' },
  { key: 'walkOns', label: 'Walk-ons kept' }, { key: 'comebacks', label: 'Comebacks' },
  { key: 'roadUpsets', label: 'Road upsets' }, { key: 'overachieved', label: 'Seasons beating expectations' },
];
const RECORD = [
  ['Career wins', 'careerWins'], ['Career losses', 'careerLosses'], ['National titles', 'titles'],
  ['Conference titles', 'conferenceTitles'], ['Regionals won', 'regionalTitles'], ['Tournaments', 'tournaments'],
] as const;
type Panel = 'profile' | 'skills' | 'record' | 'badges' | 'hidden';
const PANELS = [
  { value: 'profile', label: 'Profile' }, { value: 'skills', label: 'Skills' }, { value: 'record', label: 'Record' },
  { value: 'badges', label: 'Badges' }, { value: 'hidden', label: 'Counters' },
] as const;

export function CoachEditor() {
  const coach = useDynasty((s) => s.coach);
  const setCoach = useDynasty((s) => s.godSetCoach);
  const setCoachMore = useDynasty((s) => s.godSetCoachMore);
  const [panel, setPanel] = useState<Panel>('profile');
  const [note, setNote] = useState<string | null>(null);
  const coachBadges = coach.badges ?? [];
  const philosophyName = (id: PhilosophyId): string => capsWords(PHILOSOPHIES.find((p) => p.id === id)?.name ?? id);

  return (
    <GodPage eyebrow="God mode · Coach" title={coach.name}>
      <StatGroup
        size="sm"
        items={[
          { label: 'Coach prestige', value: Math.round(coach.prestige), unit: '/100' },
          { label: 'Job security', value: Math.round(coach.security), unit: '/100' },
          { label: 'Contract', value: plural(coach.contractYears, 'year'), note: 'Left to run' },
        ]}
      />
      <SegmentedControl<Panel> label="Coach editor section" value={panel} onChange={setPanel} options={PANELS} />

      {panel === 'profile' && (
        <Card title="Profile">
          <Field label="Name" value={coach.name} onCommit={(v) => setCoachMore({ name: v })} />
          <Slider label="Age" value={coach.age} min={22} max={80} onCommit={(v) => setCoachMore({ age: v })} />
          <Slider label="Coach prestige" value={coach.prestige} min={1} max={100} onCommit={(v) => setCoach({ prestige: v })} hint="Decides which jobs call you." />
          <Choose<PhilosophyId>
            label="Approach"
            value={coach.philosophy}
            options={PHILOSOPHIES.map((p) => ({ value: p.id, label: capsWords(p.name) }))}
            onChange={(v) => { setCoachMore({ philosophy: v }); setNote(`${philosophyName(v)}: your standing strategy was reset to it.`); }}
          />
          <Slider label="Job security" value={coach.security} min={0} max={100} onCommit={(v) => setCoachMore({ security: v })} hint="How safe the board thinks your job is." />
          <Slider label="Contract years left" value={coach.contractYears} min={0} max={10} onCommit={(v) => setCoachMore({ contractYears: v })} />
          <Slider label="Contract length" value={coach.contractLength} min={1} max={10} onCommit={(v) => setCoachMore({ contractLength: v })} />
          <Slider label="Seasons at this program" value={coach.tenure} min={0} max={40} onCommit={(v) => setCoachMore({ tenure: v })} />
        </Card>
      )}

      {panel === 'skills' && (
        <Card title="Coaching skills">
          {SKILLS.map((k) => <Slider key={k} label={SKILL_LABEL[k]} value={coach.skills[k]} onCommit={(v) => setCoach({ skills: { [k]: v } })} />)}
          <div className="pb-godrow">
            <span><b>{plural(coach.skillPoints, 'point')}</b> to spend</span>
            <Button size="sm" variant="secondary" onClick={() => setCoach({ skillPoints: coach.skillPoints + 1 })}>Add 1</Button>
            <Button size="sm" variant="secondary" onClick={() => setCoach({ skillPoints: coach.skillPoints + 5 })}>Add 5</Button>
          </div>
        </Card>
      )}

      {panel === 'record' && (
        <Card title="Career record" eyebrow="Shown on your profile and read by the job market">
          <div className="pb-fieldgrid">
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
        </Card>
      )}

      {panel === 'badges' && (
        <Card title="Badges" eyebrow={`${coachBadges.length} held`}>
          <Chips label="Coach badges" className="pb-chips--wrap">
            {COACH_BADGES.map((b) => {
              const held = coachBadges.includes(b.id);
              return (
                <Chip
                  key={b.id}
                  selected={held}
                  onClick={() => setCoachMore({ badges: held ? coachBadges.filter((x) => x !== b.id) : [...coachBadges, b.id] })}
                >{b.name}</Chip>
              );
            })}
          </Chips>
          <p className="pb-note">A normal career holds five at most.</p>
        </Card>
      )}

      {panel === 'hidden' && (
        <Card title="Hidden counters" eyebrow="What earned badges are awarded from">
          <p className="pb-text-muted">A normal career never shows these.</p>
          {HABITS.map((h) => (
            <Slider key={h.key} label={h.label} value={coach.habits?.[h.key] ?? 0} min={0} max={300} onCommit={(v) => setCoachMore({ habits: { [h.key]: v } })} />
          ))}
        </Card>
      )}
      <Toast note={note} />
    </GodPage>
  );
}
