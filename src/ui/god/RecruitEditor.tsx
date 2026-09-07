// god/RecruitEditor.tsx — recruiting controls split into profile and priorities.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { Segmented } from '../components/Kit.js';
import { RECRUIT_FACTOR_KEYS } from '../../engine/godMode.js';
import { RECRUITING_FACTOR_LABEL, recruitingPrioritiesOf, type Prospect } from '../../engine/recruiting.js';
import type { Hitter, Pitcher, PlayerId } from '../../engine/types.js';
import { Slider } from './controls.js';

const recruitSlot = (p: Prospect): string => p.player.type === 'pitcher' ? (p.player as Pitcher).role : (p.player as Hitter).pos;
type Panel = 'profile' | 'priorities';
const PANELS = [{ value: 'profile', label: 'PROFILE' }, { value: 'priorities', label: 'PRIORITIES' }] as const;

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
  if (!season || !recruit || !me) return <p className="god-note">He is not in this year's class.</p>;
  const wants = recruitingPrioritiesOf(recruit);
  const signed = recruit.signedBy !== null;

  return (
    <main className="module-workspace god-desk">
      <section className="god-summary-card recruit-summary">
        <div><small>RANK</small><strong>#{recruit.rank}</strong><span>nationally</span></div>
        <div><small>STARS</small><strong>{recruit.stars}</strong><span>{'★'.repeat(recruit.stars)}</span></div>
        <div><small>PROFILE</small><strong className="god-summary-text">{recruitSlot(recruit)}</strong><span>{recruit.state}</span></div>
      </section>
      <div className="god-subnav"><Segmented value={panel} options={PANELS} onChange={setPanel} label="Recruit editor section" /></div>

      {panel === 'profile' && <section className="god-card">
        <Slider label="STARS" value={recruit.stars} min={1} max={5} onCommit={(v) => setRecruitStars(recruit.id, v)} />
        <div className="god-actions"><button type="button" className="tap" disabled={signed} onClick={() => { commitRecruit(recruit.id); closeGod(); }}>{signed ? (recruit.signedBy === userTeam ? 'COMMITTED TO YOU' : 'SIGNED ELSEWHERE') : `COMMIT TO ${me.def.school.toUpperCase()}`}</button></div>
        <p className="god-note">A sandbox ignores the normal star gate. Once he arrives in the fall, use his player editor for ratings, health, badges and roster movement.</p>
      </section>}

      {panel === 'priorities' && <section className="god-card">
        <p className="god-panel-lead">These shares total roughly one hundred. Raising one priority pushes the others down.</p>
        {RECRUIT_FACTOR_KEYS.map((f) => <Slider key={f} label={RECRUITING_FACTOR_LABEL[f]} value={Math.round(wants[f] * 100)} min={0} max={100} onCommit={(v) => setRecruitWants(recruit.id, { [f]: v / 100 })} />)}
      </section>}
    </main>
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

  return (
    <main className="module-workspace god-desk">
      <section className="god-summary-card recruiting-summary">
        <div><small>UNSIGNED</small><strong>{unsigned.length}</strong><span>prospects</span></div>
        <div><small>CLASS</small><strong>{season.recruiting.prospects.length}</strong><span>total prospects</span></div>
      </section>
      <section className="god-card">
        <div className="god-actions"><button type="button" className="tap" onClick={() => { const rid = addRecruit('hitter'); if (rid) openGod({ kind: 'recruit', id: rid }); }}>ADD A BAT</button><button type="button" className="tap" onClick={() => { const rid = addRecruit('pitcher'); if (rid) openGod({ kind: 'recruit', id: rid }); }}>ADD AN ARM</button></div>
        <label className="god-field"><small>OPEN A RECRUIT</small><select value="" onChange={(e) => { if (e.target.value) openGod({ kind: 'recruit', id: e.target.value as PlayerId }); }}><option value="">Choose a recruit to edit</option>{unsigned.map((p) => <option key={p.id} value={p.id}>#{p.rank} {p.player.name} · {recruitSlot(p)} · {'★'.repeat(p.stars)} · {p.state}</option>)}</select></label>
        <p className="god-note">Create or select a prospect here. The recruit then opens in its own focused editor.</p>
      </section>
    </main>
  );
}
