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
import { handles } from '../../state/depth.js';
import { flightRisk } from '../../engine/morale.js';
import { sfx, buzz } from '../sound.js';

import { useDynasty } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import { IdCardIcon, ReloadIcon, StarIcon } from '@radix-ui/react-icons';
import { Avatar } from '../Avatar.js';
import { InFrame } from '../Overlay.js';
import { Confirmable, FieldNote, Segmented } from '../components/Kit.js';
import { overallOf } from '../../engine/ratings.js';
import { prestigeStars } from '../../engine/program.js';
import { windowBudget } from '../../engine/recruiting.js';
import { mood } from '../../engine/morale.js';
import type { PortalMan } from '../../engine/portal.js';

/**
 * What it actually takes to talk a man out of the portal.
 *
 * The same arithmetic `makeTheCase` runs (`engine/portal.ts`): his cost
 * again, plus however far out of the door he already is. A man who is
 * content costs his number; a man who has had enough costs twice it.
 */
function keepCost(m: PortalMan): number {
  return Math.round(m.cost * (1 + flightRisk(m.player)));
}

export function Portal() {
  /** Which half of the window you are looking at. */
  const [view, setView] = useState<'leaving' | 'available'>('leaving');
  const [signing, setSigning] = useState<string | null>(null);
  /*
    Two-press signing. Reported: "when clicking sign him there is no visual
    indication or confirmation, nothing." First press arms the button on that
    one man; the second spends the points, and the armed state names the cost
    again because that is the fact being agreed to.

    The three pieces of state that used to run it — armed, landed, lost — live
    in `Confirmable` now. This screen invented that pattern and the job market
    had grown its own copy; both speak it off one component, so a press means
    the same thing wherever it is made. See Kit.tsx.
  */
  /*
    Whether you shop the portal yourself. A delegated career gets an empty
    board on purpose (the store clears it), and the screen used to blame a
    thin winter for a list the staff had already worked.
  */
  const runsPortal = useDynasty((s) => handles(s.depth, 'portal'));
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

  // The same pool the draft already drew from and the recruiting weeks
  // draw from next — the screen shows what is genuinely left of it.
  const budget = windowBudget(prestigeStars(rec.prestige))
    - (season?.draft?.spent ?? 0);
  const left = budget - portal.spent;

  return (
    <FixedHeader
      header={null}
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
      <main className="module-workspace offseason-portal">
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
                Keep the promises that matter — whatever is left here goes into
                recruiting with you.
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
              Keeping a man costs more than taking one. That is the price of a
              promise you did not keep.
            </small>
          </div>
        </section>

        <Segmented<'leaving' | 'available'>
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
        </div>

        {(view === 'leaving' ? portal.leaving : portal.available.slice(0, 25)).length === 0 ? (
          <section className="portal-empty">
            <StarIcon />
            <strong>{view === 'leaving' ? 'Nobody has put his name in' : runsPortal ? 'Nobody worth having' : 'Your staff worked it for you'}</strong>
            <p>
              {view === 'leaving'
                ? 'That is what keeping your word looks like.'
                : runsPortal
                  ? 'The pool is thin this winter. Your points go to the class instead.'
                  : 'Your staff is handling the incoming board in this career.'}
            </p>
          </section>
        ) : (
          <section className="portal-board">
            {(view === 'leaving' ? portal.leaving : portal.available.slice(0, 25)).map((m) => {
              const p = m.player;
              /*
                The price the ENGINE asks, not a flat markup.

                This read `cost * 1.5` while `makeTheCase` requires
                `cost * (1 + flightRisk)` — anywhere from 1.0x for a content
                man to 2.0x for one already halfway out the door. So a happy
                man was overcharged by half, and an unhappy one was offered a
                number that could not possibly keep him: the case failed, the
                points were spent anyway, and nothing on the screen said so.
                Found in audit.
              */
              const cost = view === 'leaving' ? keepCost(m) : m.cost;
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
                    {/*
                      The arm-then-confirm this screen invented is now Kit's
                      `Confirmable`, and the job market speaks the same grammar
                      off the same component. What is kept here is everything
                      that is actually about the portal: the words, the cost,
                      and the sound and the buzz that mark the two outcomes.

                      Keyed on the man. Without it, React reuses one button
                      element down the list and a settled state would follow the
                      position rather than the player — sign the top man, filter
                      the list, and somebody else is wearing his answer.
                    */}
                    {view === 'leaving' ? (
                      <Confirmable
                        key={p.id}
                        disabled={!can}
                        idle={can ? `Talk him round · ${cost}` : 'Not enough left'}
                        armed={`Confirm — spend ${cost}`}
                        failed="He went anyway"
                        onConfirm={() => {
                          const ok = keepFromPortal(p.id, cost);
                          if (ok) { sfx('clap', { gain: 0.4 }); buzz(20); }
                          else buzz([30, 40, 30]);
                          return ok;
                        }}
                      />
                    ) : (
                      <button
                        className="portal-sign-command tap"
                        type="button"
                        disabled={!can}
                        onClick={() => setSigning(p.id)}
                      >{can ? `REVIEW SIGNING · ${cost}` : 'NOT ENOUGH LEFT'}</button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

      </main>
      {signing && (() => {
        const man = portal.available.find((m) => m.player.id === signing);
        return man ? (
          <PortalSignSheet
            man={man}
            left={left}
            onClose={() => setSigning(null)}
            onSign={() => {
              const ok = takeFromPortal(man.player.id);
              if (ok) { sfx('clap', { gain: 0.4 }); buzz(20); setSigning(null); }
              else buzz([30, 40, 30]);
              return ok;
            }}
            onPlayer={() => openPlayer(man.player.id)}
          />
        ) : null;
      })()}
    </FixedHeader>
  );
}

function PortalSignSheet(
  { man, left, onClose, onSign, onPlayer }:
  { man: PortalMan; left: number; onClose: () => void; onSign: () => boolean; onPlayer: () => void },
) {
  const p = man.player;
  const cost = man.cost;
  return (
    <InFrame>
      <div className="portal-sign-scrim sheet-scrim fade-in" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Sign ${p.name}`}>
        <section className="portal-sign-sheet rise-in" onClick={(e) => e.stopPropagation()}>
          <header>
            <small>TRANSFER DECISION</small>
            <strong>Bring him in?</strong>
            <button type="button" className="tap" onClick={onClose}>CLOSE</button>
          </header>
          <button className="portal-sign-player tap" type="button" onClick={onPlayer}>
            <Avatar id={p.id} size={48} />
            <span><small>{p.type === 'pitcher' ? (p as { role: string }).role : p.pos} · {p.classYear}</small><strong>{p.name}</strong><em>From {man.fromName}</em></span>
            <b>{overallOf(p)}</b>
          </button>
          <section className="portal-sign-story">
            <small>WHY HE IS AVAILABLE</small>
            <p>{man.reason} Eligible immediately.</p>
          </section>
          <section className="portal-sign-money">
            <span><small>COST</small><strong>{cost}</strong><em>points</em></span>
            <span><small>YOU HAVE</small><strong>{left}</strong><em>points</em></span>
            <span><small>AFTER SIGNING</small><strong>{Math.max(0, left - cost)}</strong><em>points</em></span>
          </section>
          <p className="portal-sign-warning">Those points come out of the same offseason pool you take into recruiting.</p>
          <button className="primary-command tap" type="button" disabled={left < cost} onClick={onSign}>SIGN {p.name.toUpperCase()}</button>
          <button className="secondary-command tap" type="button" onClick={onClose}>KEEP LOOKING</button>
        </section>
      </div>
    </InFrame>
  );
}
