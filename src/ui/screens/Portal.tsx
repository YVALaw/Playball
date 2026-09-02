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
import { Confirmable, FieldNote, ModuleIntro, Segmented } from '../components/Kit.js';
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
            <strong>{view === 'leaving' ? 'Nobody has put his name in' : runsPortal ? 'Nobody worth having' : 'Your staff worked it for you'}</strong>
            <p>
              {view === 'leaving'
                ? 'That is what keeping your word looks like.'
                : runsPortal
                  ? 'The pool is thin this winter. Your points go to the class instead.'
                  : 'Your staff worked the board and signed whoever was worth having. '
                    + 'Settings, then What you handle, brings it back to your desk.'}
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
                    <Confirmable
                      key={p.id}
                      disabled={!can}
                      idle={can
                        ? (view === 'leaving' ? `Talk him round · ${cost}` : `Sign him · ${cost}`)
                        : 'Not enough left'}
                      armed={`Confirm — spend ${cost}`}
                      /*
                        No settled label, and this is worth knowing rather than
                        guessing at: on success the man leaves this board. A kept
                        man comes off `leaving` and a signed man comes off
                        `available`, both in the store, so a row that reported
                        "✓ HE IS IN" would be a row that unmounts on the same
                        tick. The old hand-rolled version passed one anyway and
                        it was dead the whole time — checked by signing a man and
                        watching the list, not by reading it.

                        What confirms the success is the board itself: he is off
                        it, the points meter drops, and the inbox says so.

                        The failure is the state that needed a label, and only on
                        the retention half — `keepFromPortal` leaves a man you
                        lost sitting right where he was. That is the one action
                        in the game that can cost everything and say nothing.
                        Signing is guarded by `disabled` instead, so its only
                        false path is an affordability race, and "He went anyway"
                        would be the wrong sentence for it.
                      */
                      failed={view === 'leaving' ? 'He went anyway' : undefined}
                      onConfirm={() => {
                        const ok = view === 'leaving'
                          ? keepFromPortal(p.id, cost)
                          : takeFromPortal(p.id);
                        if (ok) { sfx('clap', { gain: 0.4 }); buzz(20); }
                        else buzz([30, 40, 30]);
                        return ok;
                      }}
                    />
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
