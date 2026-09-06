// GodMode.tsx — the sandbox's desk (05 §61).
//
// One screen, on the Program tab, that only exists in a career which turned
// god mode on at creation. Everything on it writes straight into the world
// through the store's god actions and saves as it goes: a program's name,
// prestige and league; the coach and his staff; money and recruiting
// points; any man in the country, or a new one. It does not explain itself
// much, because a sandbox is for people who know what they are doing.

import { useState } from 'react';
import { useDynasty, boardBudget } from '../../state/store.js';
import { ModuleIntro, SectionHeading } from '../components/Kit.js';
import { CONFERENCES } from '../../data/schools.js';
import {
  RATING_LABEL, S_PLUS_POTENTIAL, conferenceWindow, ratingsOf,
} from '../../engine/godMode.js';
import { overallOf } from '../../engine/ratings.js';
import { potentialGrade } from '../../engine/scouting.js';
import { SEATS, SEAT_LABEL, dollars, remaining } from '../../engine/economy.js';
import { SKILLS, SKILL_LABEL, prestigeStars } from '../../engine/program.js';
import type {
  Bats, ClassYear, Hand, Hitter, Pitcher, PitcherRole, Player, PlayerId, Position,
} from '../../engine/types.js';

const POSITIONS: readonly Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
const CLASSES: readonly ClassYear[] = ['FR', 'SO', 'JR', 'SR'];

const slotOf = (p: Player): string =>
  p.type === 'pitcher' ? (p as Pitcher).role : (p as Hitter).pos;

/** A number on a rail. Commits when the thumb lets go, not on every pixel. */
function Slider(
  { label, value, min = 1, max = 99, onCommit }:
  { label: string; value: number; min?: number; max?: number; onCommit: (v: number) => void },
) {
  const [live, setLive] = useState<number | null>(null);
  const shown = live ?? value;
  const commit = (): void => {
    if (live !== null && live !== value) onCommit(live);
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
  { label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void },
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
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        aria-label={label}
      />
    </label>
  );
}

export function GodMode() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const userTeam = useDynasty((s) => s.userTeam);
  const godMode = useDynasty((s) => s.godMode);
  const coach = useDynasty((s) => s.coach);
  const economy = useDynasty((s) => s.economy);
  const editPlayer = useDynasty((s) => s.godEditPlayer);
  const addPlayer = useDynasty((s) => s.godAddPlayer);
  const setPrestige = useDynasty((s) => s.godSetPrestige);
  const rename = useDynasty((s) => s.godRenameProgram);
  const swap = useDynasty((s) => s.godSwapConferences);
  const setCoach = useDynasty((s) => s.godSetCoach);
  const setStaff = useDynasty((s) => s.godSetStaff);
  const grant = useDynasty((s) => s.godGrant);
  const reshuffle = useDynasty((s) => s.godReshuffleSchedule);
  const [teamIndex, setTeamIndex] = useState(userTeam);
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);
  const [swapWith, setSwapWith] = useState(-1);
  const [note, setNote] = useState<string | null>(null);
  void version;

  if (!season) return null;
  if (!godMode) {
    return (
      <main className="module-workspace">
        <ModuleIntro
          kicker="GOD MODE"
          title="Not on for this career"
          text="God mode is chosen when a career is created, on the How you want to play step, and stays on for that career."
        />
      </main>
    );
  }

  const record = season.teams[teamIndex] ?? season.teams[userTeam]!;
  const mine = record.index === userTeam;
  const roster: Player[] = [
    ...record.team.lineup, ...record.team.bench, ...record.team.rotation, ...record.team.bullpen,
  ];
  const man = playerId ? roster.find((p) => p.id === playerId) ?? null : null;
  const window = conferenceWindow(season);
  const confName = (id: string): string => CONFERENCES.find((c) => c.id === id)?.name ?? id;
  const others = season.teams.filter((t) => t.conference !== record.conference);
  const swapTarget = swapWith >= 0 ? season.teams[swapWith] ?? null : null;
  const pick = (index: number): void => { setTeamIndex(index); setPlayerId(null); setSwapWith(-1); };

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
              <optgroup key={c.id} label={c.name}>
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
          {'★'.repeat(prestigeStars(record.prestige))} · {confName(record.conference)} · the crest keeps the abbreviation, {record.def.abbr}.
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
              <option key={t.index} value={t.index}>{t.def.school} · {confName(t.conference)}</option>
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
              onClick={() => setPlayerId(p.id)}
            >
              <strong>{p.name}</strong>
              <small>{slotOf(p)} · {p.classYear} · {overallOf(p)} OVR · {potentialGrade(p.potential)}</small>
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
        </section>
      )}

      <SectionHeading kicker="THE CALENDAR" title="Schedule" />
      <section className="god-card">
        <div className="god-actions">
          <button
            type="button"
            className="tap"
            disabled={season.results.length > 0}
            onClick={() => { if (reshuffle()) setNote('The schedule was redrawn.'); }}
          >RESHUFFLE THE SCHEDULE</button>
        </div>
        <p className="god-note">
          {season.results.length > 0
            ? 'Games have been played on this schedule; the next season draws a fresh one.'
            : 'A different draw of the same fixtures, before the first pitch.'}
        </p>
      </section>

      {note && <p className="god-note god-toast">{note}</p>}
    </main>
  );
}
