// god/MoneyEditor.tsx — the budget and the assistants.
//
// Opened from the bolt on the money sheet and from the header's bolt on
// the Program tab.

import { useDynasty, boardBudget } from '../../state/store.js';
import { SectionHeading } from '../components/Kit.js';
import { SEATS, SEAT_LABEL, dollars, remaining } from '../../engine/economy.js';
import { Field, Slider } from './controls.js';

export function MoneyEditor() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const userTeam = useDynasty((s) => s.userTeam);
  const economy = useDynasty((s) => s.economy);
  const grant = useDynasty((s) => s.godGrant);
  const setStaff = useDynasty((s) => s.godSetStaff);
  void version;
  const me = season?.teams[userTeam];
  if (!season || !me) return null;

  return (
    <main className="module-workspace god-desk">
      <section className="god-card">
        <div className="god-actions">
          <span><small>REMAINING</small><strong>{dollars(remaining(economy, me.prestige))}</strong></span>
          <button type="button" className="tap" onClick={() => grant('money', 25)}>+{dollars(25)}</button>
          <button type="button" className="tap" onClick={() => grant('money', 100)}>+{dollars(100)}</button>
        </div>
        <div className="god-actions">
          <span><small>RECRUITING · EVERY WEEK</small><strong>{boardBudget(season, userTeam, economy.recruitingGrant)}</strong></span>
          <button type="button" className="tap" onClick={() => grant('recruiting', 5)}>+5</button>
          <button type="button" className="tap" onClick={() => grant('recruiting', 10)}>+10</button>
        </div>
        <p className="god-note">Money sits on top of the annual budget; recruiting points sit on top of every week's board budget.</p>
      </section>

      <SectionHeading kicker="YOUR STAFF" title="The assistants" />
      <section className="god-card">
        {SEATS.map((seat) => {
          const staffer = economy.staff[seat];
          return staffer ? (
            <div key={seat} className="god-staff">
              <Field label={SEAT_LABEL[seat]} value={staffer.name} onCommit={(v) => setStaff(seat, { name: v })} />
              <Slider label="RATING" value={staffer.rating} onCommit={(v) => setStaff(seat, { rating: v })} />
            </div>
          ) : (
            <p key={seat} className="god-note">{SEAT_LABEL[seat]}: the seat is empty. Hire from the market first.</p>
          );
        })}
      </section>
    </main>
  );
}
