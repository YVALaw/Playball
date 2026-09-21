// god/RecruitEditor.tsx — one recruit's profile and priorities, and the class
// as a whole.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { RECRUIT_FACTOR_KEYS } from '../../engine/godMode.js';
import { RECRUITING_FACTOR_LABEL, recruitingPrioritiesOf, type Prospect } from '../../engine/recruiting.js';
import type { Hitter, Pitcher, PlayerId } from '../../engine/types.js';
import {
  Button, Card, EmptyState, SegmentedControl, StatGroup, Stars, StatusBadge,
} from '../components/ui/index.js';
import { POSITION_NAME, stateName } from '../words.js';
import { Choose, GodPage, Slider } from './controls.js';

const recruitSlot = (p: Prospect): string => p.player.type === 'pitcher' ? (p.player as Pitcher).role : (p.player as Hitter).pos;
const slotName = (p: Prospect): string => POSITION_NAME[recruitSlot(p) as keyof typeof POSITION_NAME] ?? recruitSlot(p);
type Panel = 'profile' | 'priorities';
const PANELS = [{ value: 'profile', label: 'Profile' }, { value: 'priorities', label: 'Priorities' }] as const;

export function RecruitEditor({ id }: { id: PlayerId }) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const userTeam = useDynasty((s) => s.userTeam);
  const setRecruitStars = useDynasty((s) => s.godSetRecruitStars);
  const setRecruitWants = useDynasty((s) => s.godSetRecruitWants);
  const commitRecruit = useDynasty((s) => s.godCommitRecruit);
  const closeGod = useDynasty((s) => s.closeGod);
  const [panel, setPanel] = useState<Panel>('profile');
  void version;
  const recruit = season?.recruiting.prospects.find((p) => p.id === id);
  const me = season?.teams[userTeam];
  if (!season || !recruit || !me) {
    return (
      <main className="pb-page">
        <EmptyState icon="person" title="He is not in this year's class" />
      </main>
    );
  }
  const wants = recruitingPrioritiesOf(recruit);
  const signed = recruit.signedBy !== null;

  return (
    <GodPage
      eyebrow="God mode · Recruit"
      title={recruit.player.name}
      description={`${slotName(recruit)} · ${stateName(recruit.state)}`}
    >
      <StatGroup
        size="sm"
        items={[
          { label: 'National rank', value: `#${recruit.rank}` },
          { label: 'Stars', value: <Stars value={recruit.stars} label="Recruit rating" /> },
        ]}
      />
      <SegmentedControl<Panel> label="Recruit editor section" value={panel} onChange={setPanel} options={PANELS} />

      {panel === 'profile' && (
        <Card
          title="Profile"
          trailing={signed
            ? <StatusBadge tone={recruit.signedBy === userTeam ? 'positive' : 'neutral'}>{recruit.signedBy === userTeam ? 'Committed to you' : 'Signed elsewhere'}</StatusBadge>
            : undefined}
        >
          <Slider label="Stars" value={recruit.stars} min={1} max={5} onCommit={(v) => setRecruitStars(recruit.id, v)} />
          <Button
            variant="primary"
            block
            disabled={signed}
            onClick={() => { commitRecruit(recruit.id); closeGod(); }}
          >{signed ? 'His recruitment is over' : `Commit him to ${me.def.school}`}</Button>
          <p className="pb-note">Ignores who would normally take your call.</p>
        </Card>
      )}

      {panel === 'priorities' && (
        <Card title="What he cares about" eyebrow="Shares of about 100 in total">
          <p className="pb-text-muted">Raising one pushes the others down.</p>
          {RECRUIT_FACTOR_KEYS.map((f) => (
            <Slider
              key={f}
              label={RECRUITING_FACTOR_LABEL[f]}
              value={Math.round(wants[f] * 100)}
              min={0}
              max={100}
              onCommit={(v) => setRecruitWants(recruit.id, { [f]: v / 100 })}
            />
          ))}
        </Card>
      )}
    </GodPage>
  );
}

export function RecruitsEditor() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const addRecruit = useDynasty((s) => s.godAddRecruit);
  const openGod = useDynasty((s) => s.openGod);
  void version;
  if (!season) return null;
  const unsigned = season.recruiting.prospects.filter((p) => p.signedBy === null).sort((a, b) => a.rank - b.rank);
  const add = (kind: 'hitter' | 'pitcher'): void => {
    const rid = addRecruit(kind);
    if (rid) openGod({ kind: 'recruit', id: rid });
  };

  return (
    <GodPage eyebrow="God mode · Recruiting" title="Recruiting class">
      <StatGroup
        size="sm"
        items={[
          { label: 'Unsigned', value: unsigned.length },
          { label: 'Whole class', value: season.recruiting.prospects.length },
        ]}
      />
      <Card title="Add a prospect">
        <div className="pb-buttons-2">
          <Button variant="secondary" icon="plus" onClick={() => add('hitter')}>Add a hitter</Button>
          <Button variant="secondary" icon="plus" onClick={() => add('pitcher')}>Add a pitcher</Button>
        </div>
      </Card>
      <Card title="Edit a prospect">
        <Choose<string>
          label="Prospect"
          value=""
          options={[
            { value: '', label: 'Choose a prospect' },
            ...unsigned.map((p) => ({ value: String(p.id), label: `#${p.rank} ${p.player.name} · ${slotName(p)} · ${p.stars} stars · ${stateName(p.state)}` })),
          ]}
          onChange={(v) => { if (v) openGod({ kind: 'recruit', id: v as PlayerId }); }}
        />
      </Card>
    </GodPage>
  );
}
