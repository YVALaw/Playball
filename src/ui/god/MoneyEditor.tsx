// god/MoneyEditor.tsx — budget and staff, separated into tabs.

import { useState } from 'react';
import { useDynasty, boardBudget } from '../../state/store.js';
import { Segmented } from '../components/Kit.js';
import { SEATS, SEAT_LABEL, dollars, remaining } from '../../engine/economy.js';
import { Field, Slider } from './controls.js';

type Panel = 'budget' | 'staff';
const PANELS = [{ value: 'budget', label: 'BUDGET' }, { value: 'staff', label: 'STAFF' }] as const;

export function MoneyEditor() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const userTeam = useDynasty((s) => s.userTeam);
  const economy = useDynasty((s) => s.economy);
  const grant = useDynasty((s) => s.godGrant);
  const setStaff = useDynasty((s) => s.godSetStaff);
  const [panel, setPanel] = useState<Panel>('budget');
  void version;
  const me = season?.teams[userTeam];
  if (!season || !me) return null;

  return (
    <main className="module-workspace god-desk">
      <section className="god-summary-card money-summary">
        <div><small>AVAILABLE</small><strong className="god-summary-text">{dollars(remaining(economy, me.prestige))}</strong><span>annual money</span></div>
        <div><small>RECRUITING</small><strong>{boardBudget(season, userTeam, economy.recruitingGrant)}</strong><span>points per week</span></div>
      </section>
      <div className="god-subnav"><Segmented value={panel} options={PANELS} onChange={setPanel} label="Budget and staff section" /></div>

      {panel === 'budget' && <section className="god-card">
        <div className="god-actions"><span><small>ANNUAL MONEY</small><strong>{dollars(remaining(economy, me.prestige))}</strong></span><button type="button" className="tap" onClick={() => grant('money', 25)}>+{dollars(25)}</button><button type="button" className="tap" onClick={() => grant('money', 100)}>+{dollars(100)}</button></div>
        <div className="god-actions"><span><small>RECRUITING · EVERY WEEK</small><strong>{boardBudget(season, userTeam, economy.recruitingGrant)}</strong></span><button type="button" className="tap" onClick={() => grant('recruiting', 5)}>+5</button><button type="button" className="tap" onClick={() => grant('recruiting', 10)}>+10</button></div>
        <p className="god-note">Money sits on top of the annual budget. Recruiting points sit on top of every week's board budget.</p>
      </section>}

      {panel === 'staff' && <section className="god-card">
        {SEATS.map((seat) => { const staffer = economy.staff[seat]; return staffer ? <div key={seat} className="god-staff"><Field label={SEAT_LABEL[seat]} value={staffer.name} onCommit={(v) => setStaff(seat, { name: v })} /><Slider label="RATING" value={staffer.rating} onCommit={(v) => setStaff(seat, { rating: v })} /></div> : <p key={seat} className="god-note">{SEAT_LABEL[seat]}: the seat is empty. Hire from the market first.</p>; })}
      </section>}
    </main>
  );
}
