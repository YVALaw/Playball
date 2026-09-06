// GodMode.tsx — the sandbox's desk (05 §61).
//
// One screen, on the Program tab, that only exists in a career which turned
// god mode on at creation or was forked into a sandbox from Settings.
// Everything on it writes straight into the world through the store's god
// actions and saves as it goes: a program's name, prestige and league; the
// leagues' own names; the coach, his contract and his staff; money and
// recruiting points; any man in the country, or a new one, his health, his
// badges, his mood and where he plays; the recruits and the portal; the
// schedule and the season itself. It does not explain itself much, because
// a sandbox is for people who know what they are doing.

import { useState } from 'react';
import { useDynasty, boardBudget } from '../../state/store.js';
import { ModuleIntro, SectionHeading } from '../components/Kit.js';
import { CONFERENCES } from '../../data/schools.js';
import { BADGES as COACH_BADGES } from '../../data/badges.js';
import {
  BADGE_IDS, RATING_LABEL, RECRUIT_FACTOR_KEYS, S_PLUS_POTENTIAL, conferenceWindow, isIronMan,
  isRedshirt, moodValue, ratingsOf,
} from '../../engine/godMode.js';
import { leagueLabel, leagueName } from '../../engine/leagueNames.js';
import { BADGES as PLAYER_BADGES, TIER_NAME } from '../../engine/badges.js';
import { daysLeft, isHurt } from '../../engine/injury.js';
import { overallOf } from '../../engine/ratings.js';
import { potentialGrade } from '../../engine/scouting.js';
import { seasonComplete } from '../../engine/season.js';
import { SEATS, SEAT_LABEL, dollars, remaining } from '../../engine/economy.js';
import { SKILLS, SKILL_LABEL, prestigeStars } from '../../engine/program.js';
import { PHILOSOPHIES, type PhilosophyId } from '../../engine/strategy.js';
import { RECRUITING_FACTOR_LABEL, recruitingPrioritiesOf, type Prospect } from '../../engine/recruiting.js';
import type { HabitKey } from '../../engine/habits.js';
import {
  isTwoWay,
  type BadgeId, type BadgeTier, type Bats, type ClassYear, type Hand, type Hitter, type Pitcher,
  type PitcherRole, type Player, type PlayerId, type Position,
} from '../../engine/types.js';

const POSITIONS: readonly Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
const CLASSES: readonly ClassYear[] = ['FR', 'SO', 'JR', 'SR'];

const HABITS: readonly { key: HabitKey; label: string }[] = [
  { key: 'managed', label: 'GAMES MANAGED' },
  { key: 'pen', label: 'TRIPS TO THE MOUND' },
  { key: 'aggressive', label: 'AGGRESSIVE CALLS' },
  { key: 'wire', label: 'WIRE STORIES READ' },
  { key: 'talkedDown', label: 'TALKED OUT OF THE DRAFT' },
  { key: 'freshmen', label: 'FRESHMEN PLAYED' },
  { key: 'walkOns', label: 'WALK-ONS KEPT' },
  { key: 'comebacks', label: 'COMEBACKS' },
  { key: 'roadUpsets', label: 'ROAD UPSETS' },
  { key: 'overachieved', label: 'SEASONS OVERACHIEVED' },
];

const slotOf = (p: Player): string =>
  p.type === 'pitcher' ? (p as Pitcher).role : (p as Hitter).pos;

const recruitSlot = (p: Prospect): string =>
  p.player.type === 'pitcher' ? (p.player as Pitcher).role : (p.player as Hitter).pos;

/** A number on a rail. Commits when the thumb lets go, not on every pixel. */
function Slider(
  { label, value, min = 1, max = 99, onCommit }:
  { label: string; value: number; min?: number; max?: number; onCommit: (v: number) => void },
) {
  const [live, setLive] = useState<number | null>(null);
  // Generated ratings can be fractional; the rail and its number are whole.
  const shown = Math.round(live ?? value);
  const commit = (): void => {
    if (live !== null && live !== Math.round(value)) onCommit(live);
    setLive(null);
  };
  return (
    <label className="god-slider">
      <span><small>{label}</small><strong>{shown}</strong></span>
      <input
        type="range"
        min={min}
        max={max}
        value={shown}
        onChange={(e) => setLive(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label={label}
      />
    </label>
  );
}

/** A line of text. Commits on Enter or when focus leaves. */
function Field(
  { label, value, onCommit, placeholder }:
  { label: string; value: string; onCommit: (v: string) => void; placeholder?: string },
) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (): void => {
    if (draft !== null && draft.trim() !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <label className="god-field">
      <small>{label}</small>
      <input
        type="text"
        value={draft ?? value}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        aria-label={label}
      />
    </label>
  );
}

/** On or off, said plainly. */
function Toggle(
  { label, on, onChange, note }:
  { label: string; on: boolean; onChange: (on: boolean) => void; note?: string },
) {
  return (
    <div className="god-actions">
      <span><small>{label}</small><strong>{on ? 'ON' : 'OFF'}</strong>{note && <em className="god-note">{note}</em>}</span>
      <button type="button" className={`tap${on ? ' active' : ''}`} aria-pressed={on} onClick={() => onChange(!on)}>
        {on ? 'TURN OFF' : 'TURN ON'}
      </button>
    </div>
  );
}

/** A button that wants a second press before it does anything it cannot undo. */
function SureButton({ label, onSure }: { label: string; onSure: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`tap${armed ? ' god-danger' : ''}`}
      onClick={() => { if (armed) { onSure(); setArmed(false); } else setArmed(true); }}
      onBlur={() => setArmed(false)}
    >{armed ? `${label} · SURE?` : label}</button>
  );
}

export function GodMode() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const userTeam = useDynasty((s) => s.userTeam);
  const godMode = useDynasty((s) => s.godMode);
  const coach = useDynasty((s) => s.coach);
  const economy = useDynasty((s) => s.economy);
  const portal = useDynasty((s) => s.portal);
  const busy = useDynasty((s) => s.busy);
  const live = useDynasty((s) => s.live);
  const editPlayer = useDynasty((s) => s.godEditPlayer);
  const addPlayer = useDynasty((s) => s.godAddPlayer);
  const setPrestige = useDynasty((s) => s.godSetPrestige);
  const rename = useDynasty((s) => s.godRenameProgram);
  const swap = useDynasty((s) => s.godSwapConferences);
  const setCoach = useDynasty((s) => s.godSetCoach);
  const setCoachMore = useDynasty((s) => s.godSetCoachMore);
  const setStaff = useDynasty((s) => s.godSetStaff);
  const grant = useDynasty((s) => s.godGrant);
  const reshuffle = useDynasty((s) => s.godReshuffleSchedule);
  const setLeagueName = useDynasty((s) => s.godSetLeagueName);
  const heal = useDynasty((s) => s.godHeal);
  const ironMan = useDynasty((s) => s.godIronMan);
  const movePlayer = useDynasty((s) => s.godMovePlayer);
  const cutPlayer = useDynasty((s) => s.godCutPlayer);
  const signPortal = useDynasty((s) => s.godSignPortal);
  const setMood = useDynasty((s) => s.godSetMood);
  const setRedshirt = useDynasty((s) => s.godSetRedshirt);
  const setAge = useDynasty((s) => s.godSetAge);
  const grantBadge = useDynasty((s) => s.godGrantBadge);
  const revokeBadge = useDynasty((s) => s.godRevokeBadge);
  const twoWay = useDynasty((s) => s.godTwoWay);
  const addRecruit = useDynasty((s) => s.godAddRecruit);
  const setRecruitStars = useDynasty((s) => s.godSetRecruitStars);
  const setRecruitWants = useDynasty((s) => s.godSetRecruitWants);
  const commitRecruit = useDynasty((s) => s.godCommitRecruit);
  const preset = useDynasty((s) => s.godPreset);
  const playSeason = useDynasty((s) => s.playSeason);
  const [teamIndex, setTeamIndex] = useState(userTeam);
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);
  const [swapWith, setSwapWith] = useState(-1);
  const [moveTo, setMoveTo] = useState(-1);
  const [recruitId, setRecruitId] = useState<PlayerId | null>(null);
  const [note, setNote] = useState<string | null>(null);
  void version;

  if (!season) return null;
  if (!godMode) {
    return (
      <main className="module-workspace">
        <ModuleIntro
          kicker="GOD MODE"
          title="Not on for this career"
          text="God mode is chosen when a career is created, on the How you want to play step, or a career is forked into a sandbox from Settings."
        />
      </main>
    );
  }

  const record = season.teams[teamIndex] ?? season.teams[userTeam]!;
  const mine = record.index === userTeam;
  const me = season.teams[userTeam]!;
  // A two-way man sits in the order and in the pen; the list shows him once.
  const roster: Player[] = [...new Map<PlayerId, Player>([
    ...record.team.lineup, ...record.team.bench, ...record.team.rotation, ...record.team.bullpen,
  ].map((p) => [p.id, p])).values()];
  const man = playerId ? roster.find((p) => p.id === playerId) ?? null : null;
  const window = conferenceWindow(season);
  const others = season.teams.filter((t) => t.conference !== record.conference);
  const swapTarget = swapWith >= 0 ? season.teams[swapWith] ?? null : null;
  const moveTarget = moveTo >= 0 && moveTo !== record.index ? season.teams[moveTo] ?? null : null;
  const pick = (index: number): void => { setTeamIndex(index); setPlayerId(null); setSwapWith(-1); setMoveTo(-1); };
  const day = season.dayIndex;
  const hurtNow = man ? isHurt(man, day) : false;
  const unsigned = season.recruiting.prospects
    .filter((p) => p.signedBy === null)
    .sort((a, b) => a.rank - b.rank);
  const recruit = recruitId ? unsigned.find((p) => p.id === recruitId) ?? null : null;
  const wants = recruit ? recruitingPrioritiesOf(recruit) : null;
  const over = seasonComplete(season);
  const coachBadges = coach.badges ?? [];
  const philosophyOf = (id: PhilosophyId): string => PHILOSOPHIES.find((p) => p.id === id)?.name ?? id;

  return (
    <main className="module-workspace god-desk">
      <ModuleIntro
        kicker="GOD MODE"
        title="The sandbox"
        text="Anything here is yours to rewrite, and it saves as you go. Records still count; it is god mode."
      />

      <SectionHeading kicker="THE LEAGUE" title="A program" />
      <section className="god-card">
        <label className="god-field">
          <small>PROGRAM</small>
          <select value={record.index} onChange={(e) => pick(Number(e.target.value))}>
            {CONFERENCES.map((c) => (
              <optgroup key={c.id} label={leagueName(c.id)}>
                {season.teams.filter((t) => t.conference === c.id).map((t) => (
                  <option key={t.index} value={t.index}>
                    {t.def.school}{t.index === userTeam ? ' · yours' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <Field label="SCHOOL" value={record.def.school} onCommit={(v) => rename(record.index, v, record.def.nickname)} />
        <Field label="NICKNAME" value={record.def.nickname} onCommit={(v) => rename(record.index, record.def.school, v)} />
        <Slider label="PRESTIGE" value={record.prestige} min={1} max={100} onCommit={(v) => setPrestige(record.index, v)} />
        <p className="god-note">
          {'★'.repeat(prestigeStars(record.prestige))} · {leagueName(record.conference)} · the crest keeps the abbreviation, {record.def.abbr}.
        </p>
        <div className="god-field">
          <small>TRADE LEAGUES WITH</small>
          <select
            value={swapWith}
            disabled={window === 'closed'}
            onChange={(e) => setSwapWith(Number(e.target.value))}
          >
            <option value={-1}>Choose a program in another league</option>
            {others.map((t) => (
              <option key={t.index} value={t.index}>{t.def.school} · {leagueName(t.conference)}</option>
            ))}
          </select>
          <button
            type="button"
            className="tap"
            disabled={window === 'closed' || !swapTarget}
            onClick={() => {
              if (!swapTarget) return;
              if (swap(record.index, swapTarget.index)) {
                setNote(`${record.def.school} and ${swapTarget.def.school} traded leagues.`);
                setSwapWith(-1);
              }
            }}
          >TRADE</button>
          <p className="god-note">
            {window === 'now'
              ? 'Before the first pitch: the schedule is rebuilt on the spot.'
              : window === 'next-spring'
                ? 'The season is over: the trade takes effect next spring.'
                : 'Games have been played in these leagues. Trades open again after the season.'}
          </p>
        </div>
      </section>

      <SectionHeading kicker="THE LEAGUE" title="What the leagues are called" />
      <section className="god-card">
        {CONFERENCES.map((c) => (
          <Field
            key={c.id}
            label={c.id}
            value={leagueLabel(c.id) === c.id ? '' : leagueLabel(c.id)}
            placeholder={c.name}
            onCommit={(v) => setLeagueName(c.id, v)}
          />
        ))}
        <p className="god-note">A name here is printed everywhere the league is: the desk, the standings, the bracket, the wire. Clear it and the league goes back to its own.</p>
      </section>

      {mine && (
        <>
          <SectionHeading kicker="YOUR CHAIR" title="The coach" />
          <section className="god-card">
            <Slider label="COACH PRESTIGE" value={coach.prestige} min={1} max={100} onCommit={(v) => setCoach({ prestige: v })} />
            {SKILLS.map((k) => (
              <Slider key={k} label={SKILL_LABEL[k]} value={coach.skills[k]} onCommit={(v) => setCoach({ skills: { [k]: v } })} />
            ))}
            <div className="god-actions">
              <span><small>SKILL POINTS</small><strong>{coach.skillPoints}</strong></span>
              <button type="button" className="tap" onClick={() => setCoach({ skillPoints: coach.skillPoints + 1 })}>+1</button>
              <button type="button" className="tap" onClick={() => setCoach({ skillPoints: coach.skillPoints + 5 })}>+5</button>
            </div>
            <label className="god-field">
              <small>PHILOSOPHY</small>
              <select value={coach.philosophy} onChange={(e) => setCoachMore({ philosophy: e.target.value as PhilosophyId })}>
                {PHILOSOPHIES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <p className="god-note">{philosophyOf(coach.philosophy)}: the standing strategy is reset to it, as creation would.</p>
            <Slider label="SECURITY" value={coach.security} min={0} max={100} onCommit={(v) => setCoachMore({ security: v })} />
            <Slider label="YEARS LEFT" value={coach.contractYears} min={0} max={10} onCommit={(v) => setCoachMore({ contractYears: v })} />
            <Slider label="CONTRACT LENGTH" value={coach.contractLength} min={1} max={10} onCommit={(v) => setCoachMore({ contractLength: v })} />
            <Slider label="SEASONS HERE" value={coach.tenure} min={0} max={40} onCommit={(v) => setCoachMore({ tenure: v })} />
          </section>

          <SectionHeading kicker="YOUR CHAIR" title="What you are known for" />
          <section className="god-card">
            <div className="god-badges">
              {COACH_BADGES.map((b) => {
                const held = coachBadges.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`tap${held ? ' active' : ''}`}
                    aria-pressed={held}
                    onClick={() => setCoachMore({
                      badges: held ? coachBadges.filter((x) => x !== b.id) : [...coachBadges, b.id],
                    })}
                  >{b.name}</button>
                );
              })}
            </div>
            <p className="god-note">The game hands out five at most; a sandbox may hold them all.</p>
            {HABITS.map((h) => (
              <Slider
                key={h.key}
                label={h.label}
                value={coach.habits?.[h.key] ?? 0}
                min={0}
                max={300}
                onCommit={(v) => setCoachMore({ habits: { [h.key]: v } })}
              />
            ))}
            <p className="god-note">The counters the earned badges read. Move one past its bar and the badge arrives at the next season's close.</p>
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

          <SectionHeading kicker="THE MONEY" title="Budget" />
          <section className="god-card">
            <div className="god-actions">
              <span><small>REMAINING</small><strong>{dollars(remaining(economy, record.prestige))}</strong></span>
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
        </>
      )}

      <SectionHeading kicker="THE ROSTER" title={record.def.school} />
      <section className="god-card">
        <div className="god-actions">
          <button type="button" className="tap" onClick={() => { const id = addPlayer(record.index, 'hitter'); if (id) setPlayerId(id); }}>ADD A BAT</button>
          <button type="button" className="tap" onClick={() => { const id = addPlayer(record.index, 'pitcher'); if (id) setPlayerId(id); }}>ADD AN ARM</button>
        </div>
        <div className="god-roster">
          {roster.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`tap${p.id === playerId ? ' active' : ''}`}
              onClick={() => { setPlayerId(p.id); setMoveTo(-1); }}
            >
              <strong>{p.name}</strong>
              <small>
                {slotOf(p)} · {p.classYear} · {overallOf(p)} OVR · {potentialGrade(p.potential)}
                {isHurt(p, day) ? ' · HURT' : ''}{isTwoWay(p) ? ' · 2-WAY' : ''}
              </small>
            </button>
          ))}
        </div>
      </section>

      {man && (
        <section className="god-card god-editor">
          <header>
            <small>EDITING</small>
            <strong>{man.name}</strong>
            <button type="button" className="tap" onClick={() => setPlayerId(null)}>DONE</button>
          </header>
          <Field label="NAME" value={man.name} onCommit={(v) => editPlayer(man.id, { name: v })} />
          <div className="god-selects">
            <label>
              <small>CLASS</small>
              <select value={man.classYear} onChange={(e) => editPlayer(man.id, { classYear: e.target.value as ClassYear })}>
                {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {man.type !== 'pitcher' ? (
              <label>
                <small>POSITION</small>
                <select value={(man as Hitter).pos} onChange={(e) => editPlayer(man.id, { pos: e.target.value as Position })}>
                  {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            ) : (
              <label>
                <small>ROLE</small>
                <select value={(man as Pitcher).role} onChange={(e) => editPlayer(man.id, { role: e.target.value as PitcherRole })}>
                  <option value="SP">SP</option>
                  <option value="RP">RP</option>
                </select>
              </label>
            )}
            <label>
              <small>BATS</small>
              <select value={man.bats} onChange={(e) => editPlayer(man.id, { bats: e.target.value as Bats })}>
                <option value="L">L</option>
                <option value="R">R</option>
                <option value="S">S</option>
              </select>
            </label>
            <label>
              <small>THROWS</small>
              <select value={man.throws} onChange={(e) => editPlayer(man.id, { throws: e.target.value as Hand })}>
                <option value="L">L</option>
                <option value="R">R</option>
              </select>
            </label>
          </div>
          <Slider
            label={`POTENTIAL · ${potentialGrade(man.potential)}`}
            value={man.potential}
            onCommit={(v) => editPlayer(man.id, { potential: v })}
          />
          <div className="god-actions">
            <button type="button" className="tap" onClick={() => editPlayer(man.id, { potential: S_PLUS_POTENTIAL })}>MAKE HIM S+</button>
            <button
              type="button"
              className="tap"
              onClick={() => editPlayer(man.id, { ratings: Object.fromEntries(ratingsOf(man).map((k) => [k, 99])) })}
            >EVERYTHING 99</button>
          </div>
          <div className="god-ratings">
            {ratingsOf(man).map((k) => (
              <Slider
                key={k}
                label={RATING_LABEL[k]}
                value={(man as unknown as Record<string, number>)[k] ?? 1}
                onCommit={(v) => editPlayer(man.id, { ratings: { [k]: v } })}
              />
            ))}
          </div>

          <SectionHeading kicker="THE MAN" title="Health" />
          <div className="god-actions">
            <span>
              <small>TODAY</small>
              <strong>{hurtNow ? `Out ${daysLeft(man, day)} more days` : 'Fit'}</strong>
            </span>
            <button type="button" className="tap" disabled={!hurtNow} onClick={() => { heal(man.id); setNote(`${man.name} is healed.`); }}>HEAL</button>
          </div>
          <Toggle
            label="IRON MAN"
            on={isIronMan(man)}
            onChange={(on) => ironMan(man.id, on)}
            note="He never gets hurt."
          />

          <SectionHeading kicker="THE MAN" title="The facts" />
          <Slider label="AGE" value={man.age} min={17} max={40} onCommit={(v) => setAge(man.id, v)} />
          <Slider label="MOOD" value={moodValue(man)} min={0} max={100} onCommit={(v) => setMood(man.id, v)} />
          <Toggle label="REDSHIRT" on={isRedshirt(man)} onChange={(on) => setRedshirt(man.id, on)} note="A year kept; the class does not move." />
          {man.type !== 'pitcher' && (
            <Toggle
              label="TWO-WAY"
              on={isTwoWay(man)}
              onChange={(on) => { if (twoWay(man.id, on)) setNote(on ? `${man.name} has an arm now.` : `${man.name} is a bat again.`); }}
              note="A bat given an arm and a seat in the pen."
            />
          )}

          <SectionHeading kicker="THE MAN" title="Badges" />
          <div className="god-badges">
            {BADGE_IDS.map((id: BadgeId) => {
              const held = man.badges?.find((b) => b.id === id);
              const spec = PLAYER_BADGES[id];
              return (
                <label key={id} className={held ? 'active' : ''}>
                  <small>{spec.label}</small>
                  <select
                    value={held?.tier ?? 0}
                    aria-label={spec.label}
                    onChange={(e) => {
                      const tier = Number(e.target.value);
                      if (tier === 0) revokeBadge(man.id, id);
                      else grantBadge(man.id, id, tier as BadgeTier);
                    }}
                  >
                    <option value={0}>—</option>
                    {([1, 2, 3] as const).map((t) => <option key={t} value={t}>{TIER_NAME[t]}</option>)}
                  </select>
                </label>
              );
            })}
          </div>

          <SectionHeading kicker="THE MAN" title="Where he plays" />
          <div className="god-field">
            <small>MOVE TO</small>
            <select value={moveTo} onChange={(e) => setMoveTo(Number(e.target.value))}>
              <option value={-1}>Choose a program</option>
              {season.teams.filter((t) => t.index !== record.index).map((t) => (
                <option key={t.index} value={t.index}>{t.def.school} · {leagueLabel(t.conference)}</option>
              ))}
            </select>
            <div className="god-actions">
              <button
                type="button"
                className="tap"
                disabled={!moveTarget}
                onClick={() => {
                  if (!moveTarget) return;
                  if (movePlayer(man.id, moveTarget.index)) {
                    setNote(`${man.name} is at ${moveTarget.def.school} now.`);
                    setPlayerId(null);
                    setMoveTo(-1);
                  }
                }}
              >MOVE</button>
              <SureButton
                label="CUT"
                onSure={() => { const name = man.name; if (cutPlayer(man.id)) { setNote(`${name} is gone.`); setPlayerId(null); } }}
              />
            </div>
            <p className="god-note">Moved, he lands on the bench or in the pen there; a starter's spot is filled from the bench behind him.</p>
          </div>
        </section>
      )}

      {mine && portal && portal.available.length > 0 && (
        <>
          <SectionHeading kicker="THE PORTAL" title="Sign for nothing" />
          <section className="god-card">
            <div className="god-roster">
              {portal.available.map((m) => (
                <button
                  key={m.player.id}
                  type="button"
                  className="tap"
                  onClick={() => { if (signPortal(m.player.id)) setNote(`${m.player.name} signed from the portal.`); }}
                >
                  <strong>{m.player.name}</strong>
                  <small>{slotOf(m.player)} · {m.player.classYear} · {overallOf(m.player)} OVR · from {m.fromName}</small>
                </button>
              ))}
            </div>
            <p className="god-note">Tap a man and he is yours, at no cost to the offseason budget.</p>
          </section>
        </>
      )}

      {mine && (
        <>
          <SectionHeading kicker="THE CLASS" title="Recruits" />
          <section className="god-card">
            <div className="god-actions">
              <button type="button" className="tap" onClick={() => { const id = addRecruit('hitter'); if (id) setRecruitId(id); }}>ADD A BAT</button>
              <button type="button" className="tap" onClick={() => { const id = addRecruit('pitcher'); if (id) setRecruitId(id); }}>ADD AN ARM</button>
            </div>
            <label className="god-field">
              <small>RECRUIT</small>
              <select value={recruitId ?? ''} onChange={(e) => setRecruitId((e.target.value || null) as PlayerId | null)}>
                <option value="">Choose a recruit · {unsigned.length} unsigned</option>
                {unsigned.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.rank} {p.player.name} · {recruitSlot(p)} · {'★'.repeat(p.stars)} · {p.state}
                  </option>
                ))}
              </select>
            </label>
            {recruit && wants && (
              <div className="god-editor">
                <header>
                  <small>RECRUIT</small>
                  <strong>{recruit.player.name}</strong>
                  <button type="button" className="tap" onClick={() => setRecruitId(null)}>DONE</button>
                </header>
                <Slider label="STARS" value={recruit.stars} min={1} max={5} onCommit={(v) => setRecruitStars(recruit.id, v)} />
                <p className="god-note">His wants, as shares of a hundred. Move one and the rest give way; what he wants is what the board sells against.</p>
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
                <div className="god-actions">
                  <button
                    type="button"
                    className="tap"
                    onClick={() => { commitRecruit(recruit.id); setNote(`${recruit.player.name} committed to ${me.def.school}.`); setRecruitId(null); }}
                  >COMMIT TO {me.def.school.toUpperCase()}</button>
                  <button type="button" className="tap" onClick={() => { setPlayerId(null); setRecruitId(null); }}>LEAVE HIM</button>
                </div>
              </div>
            )}
            <p className="god-note">The star gate is open in a sandbox: the board lets you chase anyone. Edit the man himself once he arrives in the fall.</p>
          </section>
        </>
      )}

      <SectionHeading kicker="THE CALENDAR" title="Schedule and time" />
      <section className="god-card">
        <div className="god-actions">
          <button
            type="button"
            className="tap"
            disabled={season.results.length > 0}
            onClick={() => { if (reshuffle()) setNote('The schedule was redrawn.'); }}
          >RESHUFFLE THE SCHEDULE</button>
          <button
            type="button"
            className="tap"
            disabled={over || busy || !!live}
            onClick={() => { setNote('Simming the season…'); void playSeason(); }}
          >SIM THE SEASON</button>
        </div>
        <p className="god-note">
          {season.results.length > 0
            ? 'Games have been played on this schedule; the next season draws a fresh one.'
            : 'A different draw of the same fixtures, before the first pitch.'}
          {' '}Sim the season plays every date left to June; the offseason follows as it always does, one step at a time.
        </p>
      </section>

      <SectionHeading kicker="THE WORLD" title="Presets" />
      <section className="god-card">
        <div className="god-actions">
          <SureButton label="PARITY" onSure={() => { preset('parity'); setNote('Every program is a fifty.'); }} />
          <SureButton label="CHAOS" onSure={() => { preset('chaos'); setNote('Every program drew a new prestige.'); }} />
          <SureButton label="SUPERTEAM" onSure={() => { preset('superteam'); setNote(`${me.def.school}: everybody is a 99.`); }} />
        </div>
        <p className="god-note">Parity puts every program at fifty; chaos redraws every program's prestige; superteam makes every man on your roster a 99 with a 99 ceiling. Each asks twice.</p>
      </section>

      {note && <p className="god-note god-toast">{note}</p>}
    </main>
  );
}
