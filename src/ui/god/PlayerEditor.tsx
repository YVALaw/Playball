// god/PlayerEditor.tsx — one player, split into focused editing panels.

import { useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { Segmented } from '../components/Kit.js';
import {
  BADGE_IDS, RATING_LABEL, S_PLUS_POTENTIAL, findPlayer, isIronMan, isRedshirt, moodValue, ratingsOf,
} from '../../engine/godMode.js';
import { leagueLabel } from '../../engine/leagueNames.js';
import { BADGES as PLAYER_BADGES, TIER_NAME } from '../../engine/badges.js';
import { daysLeft, isHurt } from '../../engine/injury.js';
import { overallOf } from '../../engine/ratings.js';
import { potentialGrade } from '../../engine/scouting.js';
import {
  isTwoWay,
  type BadgeId, type BadgeTier, type Bats, type ClassYear, type Hand, type Hitter, type Pitcher,
  type PitcherRole, type PlayerId, type Position,
} from '../../engine/types.js';
import { Field, Slider, SureButton, Toast, Toggle } from './controls.js';

const POSITIONS: readonly Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
const CLASSES: readonly ClassYear[] = ['FR', 'SO', 'JR', 'SR'];
type Panel = 'profile' | 'ratings' | 'status' | 'badges' | 'move';
const PANELS = [
  { value: 'profile', label: 'PROFILE' },
  { value: 'ratings', label: 'RATINGS' },
  { value: 'status', label: 'STATUS' },
  { value: 'badges', label: 'BADGES' },
  { value: 'move', label: 'MOVE' },
] as const;

export function PlayerEditor({ id }: { id: PlayerId }) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const editPlayer = useDynasty((s) => s.godEditPlayer);
  const heal = useDynasty((s) => s.godHeal);
  const ironMan = useDynasty((s) => s.godIronMan);
  const movePlayer = useDynasty((s) => s.godMovePlayer);
  const cutPlayer = useDynasty((s) => s.godCutPlayer);
  const setMood = useDynasty((s) => s.godSetMood);
  const setRedshirt = useDynasty((s) => s.godSetRedshirt);
  const setAge = useDynasty((s) => s.godSetAge);
  const grantBadge = useDynasty((s) => s.godGrantBadge);
  const revokeBadge = useDynasty((s) => s.godRevokeBadge);
  const twoWay = useDynasty((s) => s.godTwoWay);
  const closeGod = useDynasty((s) => s.closeGod);
  const [panel, setPanel] = useState<Panel>('profile');
  const [moveTo, setMoveTo] = useState(-1);
  const [note, setNote] = useState<string | null>(null);
  void version;

  if (!season) return null;
  const found = findPlayer(season, id);
  if (!found) return <p className="god-note">He is no longer in the world.</p>;
  const man = found.player;
  const record = found.team;
  const day = season.dayIndex;
  const hurtNow = isHurt(man, day);
  const moveTarget = moveTo >= 0 && moveTo !== record.index ? season.teams[moveTo] ?? null : null;

  return (
    <main className="module-workspace god-desk">
      <section className="god-summary-card player-summary">
        <div><small>OVR</small><strong>{overallOf(man)}</strong><span>overall</span></div>
        <div><small>POTENTIAL</small><strong>{potentialGrade(man.potential)}</strong><span>{Math.round(man.potential)} ceiling</span></div>
        <div><small>PROGRAM</small><strong className="god-summary-text">{record.def.school}</strong><span>{leagueLabel(record.conference)}</span></div>
      </section>

      <div className="god-subnav"><Segmented value={panel} options={PANELS} onChange={setPanel} label="Player editor section" /></div>

      {panel === 'profile' && (
        <section className="god-card">
          <Field label="NAME" value={man.name} onCommit={(v) => editPlayer(man.id, { name: v })} />
          <div className="god-selects">
            <label><small>CLASS</small><select value={man.classYear} onChange={(e) => editPlayer(man.id, { classYear: e.target.value as ClassYear })}>{CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            {man.type !== 'pitcher' ? (
              <label><small>POSITION</small><select value={(man as Hitter).pos} onChange={(e) => editPlayer(man.id, { pos: e.target.value as Position })}>{POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
            ) : (
              <label><small>ROLE</small><select value={(man as Pitcher).role} onChange={(e) => editPlayer(man.id, { role: e.target.value as PitcherRole })}><option value="SP">SP</option><option value="RP">RP</option></select></label>
            )}
            <label><small>BATS</small><select value={man.bats} onChange={(e) => editPlayer(man.id, { bats: e.target.value as Bats })}><option value="L">L</option><option value="R">R</option><option value="S">S</option></select></label>
            <label><small>THROWS</small><select value={man.throws} onChange={(e) => editPlayer(man.id, { throws: e.target.value as Hand })}><option value="L">L</option><option value="R">R</option></select></label>
          </div>
          <Slider label={`POTENTIAL · ${potentialGrade(man.potential)}`} value={man.potential} onCommit={(v) => editPlayer(man.id, { potential: v })} />
          <div className="god-actions">
            <button type="button" className="tap" onClick={() => editPlayer(man.id, { potential: S_PLUS_POTENTIAL })}>MAKE S+</button>
            <button type="button" className="tap" onClick={() => editPlayer(man.id, { ratings: Object.fromEntries(ratingsOf(man).map((k) => [k, 99])) })}>EVERYTHING 99</button>
          </div>
        </section>
      )}

      {panel === 'ratings' && (
        <section className="god-card">
          <p className="god-panel-lead">Edit only the ratings that apply to this player.</p>
          <div className="god-ratings">{ratingsOf(man).map((k) => <Slider key={k} label={RATING_LABEL[k]} value={(man as unknown as Record<string, number>)[k] ?? 1} onCommit={(v) => editPlayer(man.id, { ratings: { [k]: v } })} />)}</div>
        </section>
      )}

      {panel === 'status' && (
        <section className="god-card">
          <div className="god-actions god-status-line">
            <span><small>HEALTH TODAY</small><strong>{hurtNow ? `Out ${daysLeft(man, day)} more days` : 'Fit'}</strong></span>
            <button type="button" className="tap" disabled={!hurtNow} onClick={() => { heal(man.id); setNote(`${man.name} is healed.`); }}>HEAL</button>
          </div>
          <Toggle label="IRON MAN" on={isIronMan(man)} onChange={(on) => ironMan(man.id, on)} note="He never gets hurt." />
          <Slider label="AGE" value={man.age} min={17} max={40} onCommit={(v) => setAge(man.id, v)} />
          <Slider label="MOOD" value={moodValue(man)} min={0} max={100} onCommit={(v) => setMood(man.id, v)} />
          <Toggle label="REDSHIRT" on={isRedshirt(man)} onChange={(on) => setRedshirt(man.id, on)} note="A year kept; the class does not move." />
          {man.type !== 'pitcher' && <Toggle label="TWO-WAY" on={isTwoWay(man)} onChange={(on) => { if (twoWay(man.id, on)) setNote(on ? `${man.name} has an arm now.` : `${man.name} is a bat again.`); }} note="A bat given an arm and a seat in the pen." />}
        </section>
      )}

      {panel === 'badges' && (
        <section className="god-card">
          <div className="god-badges">{BADGE_IDS.map((bid: BadgeId) => {
            const held = man.badges?.find((b) => b.id === bid);
            const spec = PLAYER_BADGES[bid];
            return (
              <label key={bid} className={held ? 'active' : ''}>
                <small>{spec.label}</small>
                <select value={held?.tier ?? 0} aria-label={spec.label} onChange={(e) => { const tier = Number(e.target.value); if (tier === 0) revokeBadge(man.id, bid); else grantBadge(man.id, bid, tier as BadgeTier); }}>
                  <option value={0}>—</option>{([1, 2, 3] as const).map((t) => <option key={t} value={t}>{TIER_NAME[t]}</option>)}
                </select>
              </label>
            );
          })}</div>
        </section>
      )}

      {panel === 'move' && (
        <section className="god-card">
          <label className="god-field"><small>MOVE TO</small><select value={moveTo} onChange={(e) => setMoveTo(Number(e.target.value))}>
            <option value={-1}>Choose a program</option>
            {season.teams.filter((t) => t.index !== record.index).map((t) => <option key={t.index} value={t.index}>{t.def.school} · {leagueLabel(t.conference)}</option>)}
          </select></label>
          <div className="god-actions">
            {/* A move or a cut is refused when nobody can take his spot; the
                editor says so rather than doing nothing (05 §62.4). */}
            <button type="button" className="tap" disabled={!moveTarget} onClick={() => { if (!moveTarget) return; if (movePlayer(man.id, moveTarget.index)) { setNote(`${man.name} is at ${moveTarget.def.school} now.`); setMoveTo(-1); } else setNote(`Nobody to take ${man.name}'s place. Add a bat or an arm first.`); }}>MOVE PLAYER</button>
            <SureButton label="CUT PLAYER" onSure={() => { if (cutPlayer(man.id)) closeGod(); else setNote(`Nobody to take ${man.name}'s place. Add a bat or an arm first.`); }} />
          </div>
          <p className="god-note">Moved, he lands on the bench or in the pen there; a starter's spot is filled from the bench behind him. A move changes his program, not league alignment — that is the Leagues tool. Cut, he is gone from the world.</p>
        </section>
      )}

      <Toast note={note} />
    </main>
  );
}
