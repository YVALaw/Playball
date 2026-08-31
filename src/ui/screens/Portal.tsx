// Portal.tsx
// Both directions, on one screen, kept apart.
//
// Stage 10. The two halves are two different decisions with two different
// verbs -- you talk one lot round and you sign the other -- and the first
// version put them in one list, which read as a jumble of names with no way to
// tell whose they were. So: who is leaving you, then who is available.
//
// The leaving half comes first because it is the one with a deadline attached
// and the one you can still do something about. It is also the bill for stage
// 9: every man on it is a promise somebody broke, and the card says which.

import { useState } from 'react';

import { useDynasty } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import { IdCardIcon, ReloadIcon, StarIcon } from '@radix-ui/react-icons';
import { Avatar } from '../Avatar.js';
import { FieldNote, ModuleIntro, Segmented } from '../components/Kit.js';
import { overallOf } from '../../engine/ratings.js';
import { prestigeStars } from '../../engine/program.js';
import { windowBudget } from '../../engine/recruiting.js';
import { mood } from '../../engine/morale.js';
import type { PortalMan } from '../../engine/portal.js';

export function Portal() {
  /** Which half of the window you are looking at. */
  const [view, setView] = useState<'leaving' | 'available'>('leaving');
  const portal = useDynasty((s) => s.portal);
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const keepFromPortal = useDynasty((s) => s.keepFromPortal);
  const takeFromPortal = useDynasty((s) => s.takeFromPortal);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const nextPhase = useDynasty((s) => s.nextPhase);
  const version = useDynasty((s) => s.version);
  void version;

  const rec = season?.teams[userTeam];
  if (!portal || !rec) return null;

  const budget = windowBudget(prestigeStars(rec.prestige));
  const left = budget - portal.spent;

  return (
    <FixedHeader
      header={
        <ModuleIntro kicker={`THE PORTAL · ${left} OF ${budget} LEFT`} title="Both directions" />
      }
      /*
        The way out, which this screen shipped without.

        Every other offseason step supplies its own pinned action and this one
        did not, so the rail reached the portal and stopped -- the offseason
        could not be finished at all. Found by playing a season rather than by
        any test, because every test drives `nextPhase` directly and never has
        to find a button.

        The note is load-bearing too: leaving is what releases anybody still in
        the portal, and that has to be said before it happens rather than
        reported afterwards.
      */
      action={(
        <FloatingAction
          label="TO RECRUITING"
          note={portal.leaving.length > 0
            ? `${portal.leaving.length} ${portal.leaving.length === 1 ? 'man is' : 'men are'} still in it. Leaving now lets ${portal.leaving.length === 1 ? 'him' : 'them'} go.`
            : undefined}
          onClick={() => void nextPhase('portal')}
        />
      )}
    >
      <main className="module-workspace">
        {/*
          The command centre: what the window is, what it costs, and what is
          left. The proposal opens the portal with it and it is the right
          opening — the pool is shared with recruiting, and a coach who does not
          know that spends it all here and wonders why the class is thin.
        */}
        <section className="portal-command-center">
          <div className="portal-command-top">
            <div>
              <small>TRANSFER PORTAL · {portal.leaving.length + portal.available.length} NAMES</small>
              <h1>Transfer room</h1>
              <p>
                Keep the promises that matter. The same points sign a class, so
                whatever is left here goes into recruiting with you.
              </p>
            </div>
            <div className="portal-command-mark">
              <ReloadIcon />
              <strong>{portal.leaving.length}</strong>
              <span>LEAVING YOU</span>
            </div>
          </div>
          <div className="portal-budget-card">
            <div>
              <small>POINTS LEFT</small>
              <strong>{left}</strong>
              <span>of {budget} for the whole window</span>
            </div>
            <div className="portal-budget-meter">
              <i style={{ width: `${Math.round((left / Math.max(1, budget)) * 100)}%` }} />
            </div>
            <small>
              Keeping a man costs half again what taking one does. That is the
              price of a promise you did not keep.
            </small>
          </div>
        </section>

        <Segmented
          label="Portal mode"
          value={view}
          onChange={setView}
          options={[
            { value: 'leaving', label: `Leaving you ${portal.leaving.length || ''}`.trim() },
            { value: 'available', label: `Available ${portal.available.length || ''}`.trim() },
          ]}
        />

        <div className="portal-mode-heading">
          <div>
            <small>{view === 'leaving' ? 'RETENTION BOARD' : 'INCOMING BOARD'}</small>
            <h2>{view === 'leaving' ? 'Men with a foot out' : 'Men you could have'}</h2>
          </div>
          <span>{left} PTS</span>
        </div>

        {(view === 'leaving' ? portal.leaving : portal.available.slice(0, 25)).length === 0 ? (
          <section className="portal-empty">
            <StarIcon />
            <strong>{view === 'leaving' ? 'Nobody has put his name in' : 'Nobody worth having'}</strong>
            <p>
              {view === 'leaving'
                ? 'That is what keeping your word looks like.'
                : 'The pool is thin this winter. Your points go to the class instead.'}
            </p>
          </section>
        ) : (
          <section className="portal-board">
            {(view === 'leaving' ? portal.leaving : portal.available.slice(0, 25)).map((m) => {
              const p = m.player;
              const cost = view === 'leaving' ? Math.round(m.cost * 1.5) : m.cost;
              const can = left >= cost;
              return (
                <article className={`portal-candidate ${view === 'leaving' ? 'leaving' : 'incoming'}`} key={p.id}>
                  <div className="portal-candidate-head">
                    <button className="portal-player tap" type="button" onClick={() => openPlayer(p.id)}>
                      <span className="portal-avatar">
                        <Avatar id={p.id} team={view === 'leaving' ? rec.def.abbr : undefined} size={34} />
                      </span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          {p.type === 'pitcher' ? (p as { role: string }).role : p.pos}
                          {' · '}{p.classYear}
                          {view === 'leaving' ? ` · ${mood(p)}` : ` · from ${m.fromName}`}
                        </small>
                      </span>
                    </button>
                    <div className="portal-candidate-grade">
                      <strong>{overallOf(p)}</strong>
                      <small>OVERALL</small>
                    </div>
                  </div>

                  <div className="portal-candidate-story">
                    <small>{view === 'leaving' ? 'WHY HE IS GOING' : 'WHY HE IS HERE'}</small>
                    <p>
                      {view === 'leaving'
                        ? m.reason
                        : `${m.reason} Eligible immediately.`}
                    </p>
                  </div>

                  <div className="portal-candidate-meta">
                    <span>
                      <small>COST</small>
                      <b>{cost} pts</b>
                    </span>
                    <span>
                      <small>LEAVES YOU</small>
                      <b>{Math.max(0, left - cost)}</b>
                    </span>
                    <span />
                  </div>

                  <div className="portal-candidate-actions">
                    <button type="button" onClick={() => openPlayer(p.id)}>
                      <IdCardIcon />Card
                    </button>
                    <button
                      type="button"
                      disabled={!can}
                      onClick={() => (view === 'leaving'
                        ? keepFromPortal(p.id, cost)
                        : takeFromPortal(p.id))}
                    >
                      {can
                        ? (view === 'leaving' ? `Talk him round · ${cost}` : `Sign him · ${cost}`)
                        : 'Not enough left'}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <FieldNote
          title="The pool is shared"
          text="Every point spent here is a point the class does not get. Whatever
            survives the window goes into recruiting with you."
        />
      </main>
    </FixedHeader>
  );
}
