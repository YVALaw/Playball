// god/MoneyEditor.tsx — the budget and the staff, in two panels.

import { useState } from 'react';
import { useDynasty, boardBudget } from '../../state/store.js';
import { SEATS, SEAT_LABEL, dollars, remaining } from '../../engine/economy.js';
import { Button, Callout, Card, SegmentedControl, StatGroup } from '../components/ui/index.js';
import { Field, GodPage, Slider } from './controls.js';

type Panel = 'budget' | 'staff';
const PANELS = [{ value: 'budget', label: 'Budget' }, { value: 'staff', label: 'Staff' }] as const;

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
  const money = dollars(remaining(economy, me.prestige));
  const points = boardBudget(season, userTeam, economy.recruitingGrant);

  return (
    <GodPage eyebrow="God mode · Program" title="Budget and staff" description={me.def.school}>
      <StatGroup
        size="sm"
        items={[
          { label: 'Money left', value: money, note: 'This year' },
          { label: 'Recruiting', value: points, note: 'Points a week' },
        ]}
      />
      <SegmentedControl<Panel> label="Budget and staff section" value={panel} onChange={setPanel} options={PANELS} />

      {panel === 'budget' && (
        <>
          <Card title="Money" eyebrow={`${money} left this year`}>
            <div className="pb-buttons-2">
              <Button variant="secondary" icon="plus" onClick={() => grant('money', 25)}>Add {dollars(25)}</Button>
              <Button variant="secondary" icon="plus" onClick={() => grant('money', 100)}>Add {dollars(100)}</Button>
            </div>
            <p className="pb-note">Added on top of this year&rsquo;s budget.</p>
          </Card>
          <Card title="Recruiting points" eyebrow={`${points} a week`}>
            <div className="pb-buttons-2">
              <Button variant="secondary" icon="plus" onClick={() => grant('recruiting', 5)}>Add 5 a week</Button>
              <Button variant="secondary" icon="plus" onClick={() => grant('recruiting', 10)}>Add 10 a week</Button>
            </div>
            <p className="pb-note">Added to every week&rsquo;s recruiting points.</p>
          </Card>
        </>
      )}

      {panel === 'staff' && SEATS.map((seat) => {
        const staffer = economy.staff[seat];
        return staffer ? (
          <Card key={seat} title={SEAT_LABEL[seat]}>
            <Field label="Name" value={staffer.name} onCommit={(v) => setStaff(seat, { name: v })} />
            <Slider label="Rating" value={staffer.rating} onCommit={(v) => setStaff(seat, { rating: v })} />
          </Card>
        ) : (
          <Callout key={seat} tone="neutral" title={SEAT_LABEL[seat]}>The job is empty. Hire someone from the staff market first.</Callout>
        );
      })}
    </GodPage>
  );
}
