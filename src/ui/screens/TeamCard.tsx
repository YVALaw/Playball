// TeamCard.tsx
// Somebody else's program, in tabs.
//
// A standings table is ninety six abbreviations, and until now that is all they
// were: BAY beat you 7-2 in March and there was nowhere to go and find out who
// BAY are. A conference you cannot look into is a list of strings you are
// ranked against, which is the same complaint the national rankings screen was
// built to answer one level up.
//
// The card is deliberately the player card's twin — a header that does not move,
// three tabs under it, and the same navy ← BACK bar overhead — because the two
// are the same gesture to the player: tap a name, read the page, come back to
// exactly where you were.
//
// The one thing it is honest about is what the save does not contain. Box scores
// are kept for the user's program alone (see `captureBoxFor`), so a rival's
// season is a list of results and cannot be anything more. The RESULTS tab says
// so rather than showing an empty table and letting it read as "never played".

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChartIcon, CheckIcon, Cross1Icon, EnvelopeClosedIcon, EyeOpenIcon, IdCardIcon,
  DotsHorizontalIcon, StarIcon,
} from '@radix-ui/react-icons';
import { dollars, remaining, SCOUT_COST, SCOUT_DAYS } from '../../engine/economy.js';
import { handles } from '../../state/depth.js';
import {
  FieldNote, Metric, MetricStrip, SectionHeading, Segmented,
  Panel, PanelHead, PanelNote, Stat, Tile, Tiles, Meter,
} from '../components/Kit.js';
import { cultureFor, cultureOf, CULTURE_LABEL } from '../../data/cultures.js';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { Avatar, teamColour } from '../Avatar.js';
import { Crest } from '../Crest.js';
import { FixedHeader } from '../Sticky.js';
import { overallOf } from '../../engine/ratings.js';
import { prestigeStars, rosterStrength } from '../../engine/program.js';
import { teamReads } from '../../engine/tendencies.js';
import {
  battingAverage, era, inningsPitched, regularRecord, rpiOrder,
} from '../../engine/season.js';
import { pct, seasonDate } from '../format.js';
import type {Arm, Hitter, Pitcher } from '../../engine/types.js';
import type { SeasonState } from '../../engine/season.js';

type Record_ = SeasonState['teams'][number];

/** One programme, as the season carries it. Same thing as Record_, named for
    the dossier, which reads better as an owner than as an underscore. */
type Owner = Record_;

/**
 * How a table row asks for a program's page.
 *
 * A context rather than a prop threaded through every table, because the two
 * tables that open this thing are each rendered in two places — once as a tab
 * and once inside the offseason's table overlay — and four call sites all
 * needing the same callback is what a context is for. The default is a no-op so
 * a table rendered outside the app frame (a test, a story) still works and
 * simply does not open anything.
 */
export const OpenTeam = createContext<(index: number) => void>(() => {});

/** Tap a team row to open its page. */
export const useOpenTeam = (): ((index: number) => void) => useContext(OpenTeam);

type Sheet = 'overview' | 'roster' | 'results' | 'dossier';

const SHEET_LABEL: Record<Sheet, string> = {
  overview: 'OVERVIEW',
  roster: 'ROSTER',
  results: 'RESULTS',
  dossier: 'DOSSIER',
};

const SHEETS: Sheet[] = ['overview', 'roster', 'results', 'dossier'];

export function TeamCard({ index }: { index: number }) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const me = useUserTeam();
  const rivalry = useDynasty((s) => s.rivalry);
  const [sheet, setSheet] = useState<Sheet>('overview');
  /** The mockup's compare panel, open or not. Local — it is a reading aid. */
  const [comparing, setComparing] = useState(false);
  void version;

  const t = season?.teams[index];
  if (!season || !t) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center' }}>
        <div className="label">NO PROGRAM SELECTED</div>
        <div style={{
          marginTop: 8, font: "400 calc(12px * var(--ts))/1.6 var(--body)", color: 'var(--dim)',
        }}>Tap a team in the conference table or the national rankings.</div>
      </div>
    );
  }

  const reg = regularRecord(t);
  const stars = prestigeStars(t.prestige);
  // Recomputed rather than cached: ninety six teams is cheap, and a stale rank
  // on a page whose whole job is "who are these people" is worse than the work.
  const rank = t.gp === 0
    ? 0
    : rpiOrder(season).findIndex((r) => r.team.index === t.index) + 1;

  return (
    <FixedHeader header={
      <>
        <div
          className="team-card-head team-profile-head"
          style={{ '--program-accent': teamColour(t.def.abbr) } as CSSProperties}
        >
          <section className="team-profile-hero">
            <div className="team-profile-crest"><Crest abbr={t.def.abbr} size={66} /></div>
            <div className="team-profile-copy">
              <small>{t.conference} · {'★'.repeat(stars)}</small>
              <h2>{t.def.school}</h2>
              <p>{t.def.nickname}</p>
            </div>
            <div className="team-profile-rank">
              <small>RPI</small>
              <strong>{rank > 0 ? `#${rank}` : '—'}</strong>
            </div>
          </section>

          <MetricStrip>
            <Metric label="OVERALL" value={`${reg.w}-${reg.l}`} note={`RPI ${rank > 0 ? `#${rank}` : '—'}`} />
            <Metric label={t.conference} value={`${t.cw}-${t.cl}`} note="IN CONFERENCE" />
            <Metric
              label="RUN DIFF"
              value={`${t.rs - t.ra > 0 ? '+' : ''}${t.rs - t.ra}`}
              note={`${t.rs} FOR`}
            />
          </MetricStrip>
          {me && me.index !== t.index && t.def.abbr === me.def.rival && (
            <section className="rivalry-strip">
              <span><small>RIVALRY</small><strong>{me.def.school} vs {t.def.school}</strong></span>
              <span>
                <small>YOUR RECORD</small>
                <strong>{rivalry.w + rivalry.l > 0 ? `${rivalry.w}-${rivalry.l}` : 'NEW'}</strong>
              </span>
            </section>
          )}
        </div>
        <TabStrip at={sheet} onGo={setSheet} />
      </>
    }>
      <div className="team-profile-content">
        {sheet === 'overview' && <Overview t={t} me={me} season={season} />}
        {sheet === 'roster' && <Roster t={t} season={season} />}
        {sheet === 'results' && <Results t={t} me={me} season={season} />}
        {/* Scouting the school rather than its players — asked for by name:
            "the rival school scouting ... if not add it to the list of things
            we need to add." Everything on it was already in the save and had
            nowhere to be read. */}
        {/* The mockup's compare panel, toggled from Program Actions. */}
        {sheet === 'overview' && comparing && me && me.index !== t.index && (() => {
          const ours = regularRecord(me);
          const rows = [
            { label: 'PRESTIGE', left: String(me.prestige), right: String(t.prestige), leftN: me.prestige, rightN: t.prestige },
            { label: 'ROSTER', left: String(rosterStrength(me.team)), right: String(rosterStrength(t.team)), leftN: rosterStrength(me.team), rightN: rosterStrength(t.team) },
            { label: 'RUN DIFF', left: `${me.rs - me.ra >= 0 ? '+' : ''}${me.rs - me.ra}`, right: `${t.rs - t.ra >= 0 ? '+' : ''}${t.rs - t.ra}`, leftN: me.rs - me.ra, rightN: t.rs - t.ra },
          ];
          return (
            <section className="college-compare comparison-board">
              <header>
                <small>PROGRAM COMPARISON</small>
                <strong>{me.def.school} <i>vs</i> {t.def.school}</strong>
                <p>Program pull, current talent, and what this season is actually producing.</p>
              </header>
              <div className="comparison-record-row">
                <span><small>YOUR RECORD</small><b>{ours.w}-{ours.l}</b></span>
                <span><small>THEIR RECORD</small><b>{reg.w}-{reg.l}</b></span>
              </div>
              <div className="comparison-bars">
                {rows.map((row) => {
                  const edge = row.leftN === row.rightN ? 'even' : row.leftN > row.rightN ? 'left' : 'right';
                  return (
                    <div className="comparison-bar-row" key={row.label}>
                      <b className={edge === 'left' ? 'has-edge' : ''}>{row.left}</b>
                      <span><small>{row.label}</small><i>{edge === 'even' ? 'EVEN' : edge === 'left' ? 'YOUR EDGE' : 'THEIR EDGE'}</i></span>
                      <b className={edge === 'right' ? 'has-edge' : ''}>{row.right}</b>
                    </div>
                  );
                })}
              </div>
              <p className="comparison-note">Roster is current on-field talent. Prestige is long-term program pull. Neither is a win probability.</p>
            </section>
          );
        })()}
        {sheet === 'dossier' && (
          <Dossier t={t} stars={stars} rival={me !== null && me.index !== t.index} />
        )}
      </div>
      {me && me.index !== t.index && (
        <CollegeActions
          abbr={t.def.abbr}
          school={t.def.school}
          index={t.index}
          comparing={comparing}
          onCompare={() => { setComparing((v) => !v); setSheet('overview'); }}
          onOpenDossier={() => setSheet('dossier')}
        />
      )}
    </FixedHeader>
  );
}

/**
 * The mockup's Program Actions button, wired.
 *
 * Reported missing by name: "the university profiles and action button, you
 * didn't add that from the mock up." Three actions, all real: TRACK PROGRAM
 * files the school under the program tab's watchlist, COMPARE opens the
 * side-by-side on the overview, TRACK JOB PATH marks the chair so the job
 * market stars it when it calls. Same portal as the player FAB, same reason.
 */
function CollegeActions(
  { abbr, school, index, comparing, onCompare, onOpenDossier }:
  {
    abbr: string; school: string; index: number;
    comparing: boolean; onCompare: () => void; onOpenDossier: () => void;
  },
) {
  const watch = useDynasty((s) => s.watch);
  const toggleProgramWatch = useDynasty((s) => s.toggleProgramWatch);
  const toggleJobWatch = useDynasty((s) => s.toggleJobWatch);
  const scoutTeam = useDynasty((s) => s.scoutTeam);
  const economy = useDynasty((s) => s.economy);
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const scoutsHimself = useDynasty((s) => handles(s.depth, 'scouting'));
  const go = useDynasty((s) => s.go);
  const setPlaybookFocus = useDynasty((s) => s.setPlaybookFocus);
  const autoSetPlaybook = useDynasty((s) => s.autoSetPlaybook);
  const closeOverlay = useDynasty((s) => s.closeOverlay);
  /*
    Three states, not a boolean, because closing is a motion now. Reported:
    "the action button has a nice opening animation but it does not when
    closing" — `open` flipping to false hit `display: none` on the same
    frame. CLOSING keeps the popover mounted for one 180ms exit, then a
    timer lands it. The timer rather than animationend, so reduced motion
    (which strips the animation) cannot strand the menu mid-state.
  */
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const [mode, setMode] = useState<'actions' | 'scout'>('actions');
  const open = phase === 'open';
  const requestClose = (): void => {
    setPhase('closing');
    window.setTimeout(() => {
      setPhase((p) => (p === 'closing' ? 'closed' : p));
    }, 200);
  };

  /*
    The letter, moved in off the page — "let's move the write to them button
    in the colleges overview to the action button." Same rules as the button
    it replaces: three a season, never the same school twice, word can get
    back. The outcome of a letter sent this visit lives here.
  */
  const approaches = useDynasty((s) => s.approaches);
  const approach = useDynasty((s) => s.approach);
  const [said, setSaid] = useState<string | null>(null);

  const tracked = watch.programs.includes(abbr);
  const jobPath = watch.jobs.includes(abbr);
  const day = season?.dayIndex ?? 0;
  const scoutedUntil = economy.scouted[index] ?? -1;
  const scouted = scoutedUntil >= day;
  const hasPlaybook = !!season?.playbooks?.[abbr];
  const reportDays = scouted ? Math.max(0, scoutedUntil - day) : 0;
  const reportTime = scouted ? (reportDays === 0 ? 'Expires today' : `${reportDays} day${reportDays === 1 ? '' : 's'} left`) : '';
  const prestige = season?.teams[userTeam]?.prestige ?? 40;
  const canAfford = remaining(economy, prestige) >= SCOUT_COST;
  const opponent = season?.teams[index];
  const reg = opponent ? regularRecord(opponent) : { w: 0, l: 0 };
  const rank = opponent && season && opponent.gp > 0
    ? rpiOrder(season).findIndex((row) => row.team.index === opponent.index) + 1
    : 0;
  const runDiff = opponent ? opponent.rs - opponent.ra : 0;
  const reads = opponent && (scouted || !scoutsHimself) ? teamReads(opponent.team).slice(0, 4) : [];

  const host = document.querySelector('.full-overlay') ?? document.querySelector('.app-frame');
  if (!host) return null;

  return createPortal(
    <>
      {/* Tapping anywhere else closes it — asked for beside the exit motion.
          The scrim sits under the FAB (z 20 against 45), so the menu and its
          X stay live while everything behind them stands the menu down. */}
      {open && (
        <button
          className="popover-scrim"
          type="button"
          aria-label="Close program actions"
          onClick={requestClose}
        />
      )}
    <aside className={`profile-actions-shell program-profile-actions${open ? ' open' : ''}${phase === 'closing' ? ' closing' : ''}`}>
      <div className="profile-command-sheet program-command-sheet" aria-hidden={!open}>
        <div className="command-sheet-handle" />
        {mode === 'actions' ? (
          <>
            <header className="profile-command-header">
              <small>PROGRAM DECISIONS</small>
              <strong>{school}</strong>
              <p>{opponent ? `${reg.w}-${reg.l} · ${rank > 0 ? `RPI #${rank}` : 'Unranked'} · ${runDiff >= 0 ? '+' : ''}${runDiff} run differential` : 'Program profile'}</p>
            </header>

            <section className="command-section first">
              <header><small>MATCHUP</small><h2>Know them before you play them</h2></header>
              <div className="command-action-grid program-primary-actions">
                <ActionCard
                  icon={<EyeOpenIcon />}
                  eyebrow="SCOUTING"
                  title={!scoutsHimself ? 'Report available' : scouted ? 'Report active' : hasPlaybook ? `Refresh report · ${dollars(SCOUT_COST)}` : `Scout · ${dollars(SCOUT_COST)}`}
                  detail={!scoutsHimself ? 'Your staff has the opponent report ready.' : scouted ? 'Review what your scouts found and the playbook it unlocked.' : hasPlaybook ? 'Your opponent plan still exists, but its detailed reads have gone stale. Refresh the report before the next series.' : 'Open a briefing before you spend. See what is public, what the report unlocks, and what remains in the budget.'}
                  meta={!scoutsHimself ? 'Staff-managed report' : scouted ? `${reportTime} · playbook unlocked` : hasPlaybook ? 'Playbook retained · reads expired' : `${dollars(Math.max(0, remaining(economy, prestige)))} available`}
                  selected={scouted || !scoutsHimself}
                  onClick={() => setMode('scout')}
                />
                <ActionCard
                  icon={<BarChartIcon />}
                  eyebrow="COMPARISON"
                  title={comparing ? 'Comparison open' : 'Compare programs'}
                  detail={comparing ? 'Your side-by-side is already open on Overview.' : 'Put prestige, record, and program context beside your club before you judge the gap.'}
                  meta="Your club vs this program"
                  selected={comparing}
                  onClick={() => { onCompare(); requestClose(); }}
                />
              </div>
            </section>

            <section className="command-section">
              <header><small>CAREER</small><h2>What this program means to you</h2></header>
              <div className="command-action-grid">
                <ActionCard icon={<StarIcon />} eyebrow="WATCHLIST" title={tracked ? 'Following program' : 'Follow program'} detail={tracked ? 'Their biggest stories receive extra weight on The Wire.' : 'Keep this school close across realignment, results, and coaching changes.'} meta="Career-long signal" selected={tracked} onClick={() => toggleProgramWatch(abbr)} />
                <ActionCard icon={<IdCardIcon />} eyebrow="JOB PATH" title={jobPath ? 'Chair tracked' : 'Track the chair'} detail={jobPath ? 'Your assistant will flag a coaching change here.' : 'Watch this specific job without declaring interest.'} meta="Private watch" selected={jobPath} onClick={() => toggleJobWatch(abbr)} />
                <ActionCard
                  icon={<EnvelopeClosedIcon />}
                  eyebrow="BACK CHANNEL"
                  title={said !== null ? 'Letter sent' : approaches.interest.includes(index) ? 'They would take the call' : approaches.tried.includes(index) ? 'Already contacted' : approaches.tried.length >= 3 ? 'No letters left' : 'Write quietly'}
                  detail={said !== null ? said : approaches.interest.includes(index) ? 'There is interest when the chair moves.' : approaches.tried.includes(index) ? 'You only get one approach to a school each season.' : approaches.tried.length >= 3 ? 'You have used all three approaches this season.' : 'Ask about the chair without applying. Word can still get back to your board.'}
                  meta={`${Math.max(0, 3 - approaches.tried.length)} of 3 approaches left`}
                  selected={said !== null || approaches.interest.includes(index) || approaches.tried.includes(index)}
                  disabled={approaches.tried.includes(index) || approaches.tried.length >= 3}
                  onClick={() => {
                    const out = approach(index);
                    setSaid(out === 'interested' ? 'They would take the call.' : out === 'caught' ? 'Somebody talked. Your own board has heard about it.' : out === 'ignored' ? 'Nothing came back.' : 'Not this season.');
                  }}
                />
              </div>
            </section>
          </>
        ) : (
          <section className="scouting-brief-sheet">
            <button className="sheet-back tap" type="button" onClick={() => setMode('actions')}>← Actions</button>
            <header className="profile-command-header">
              <small>SCOUTING BRIEF</small>
              <strong>{school}</strong>
              <p>{scouted || !scoutsHimself ? 'Your report is active.' : hasPlaybook ? 'Your plan is still on file. Refresh the report to update the reads behind it.' : 'Public information first. Spend only if the extra detail is worth it.'}</p>
            </header>
            <div className="scout-public-grid">
              <span><small>RECORD</small><strong>{reg.w}-{reg.l}</strong></span>
              <span><small>RPI</small><strong>{rank > 0 ? `#${rank}` : '—'}</strong></span>
              <span><small>RUN DIFF</small><strong>{runDiff >= 0 ? '+' : ''}{runDiff}</strong></span>
              <span><small>COACH</small><strong>{opponent?.coach?.name ?? '—'}</strong></span>
            </div>

            {scouted || !scoutsHimself ? (
              <>
                <div className="scout-report-reads">
                  <small>WHAT THE REPORT FOUND</small>
                  {reads.map((read) => <article key={`${read.slot}-${read.title}`}><strong>{read.title}</strong><p>{read.text}</p></article>)}
                </div>
                <div className="scout-brief-actions">
                  <button className="scout-secondary-command tap" type="button" onClick={() => { onOpenDossier(); requestClose(); }}>Open dossier</button>
                  <button
                    className="scout-primary-command tap"
                    type="button"
                    onClick={() => {
                      if (!scoutsHimself && !season?.playbooks?.[abbr]) autoSetPlaybook(abbr);
                      setPlaybookFocus(abbr);
                      closeOverlay();
                      go('program', 'strategy');
                    }}
                  >Open playbook</button>
                </div>
              </>
            ) : (
              <>
                <div className="scout-unlock-grid">
                  <span><b>01</b><strong>Team habits</strong><small>3–5 tendencies worth planning around.</small></span>
                  <span><b>02</b><strong>Player reads</strong><small>Individual tendencies appear on their cards.</small></span>
                  <span><b>03</b><strong>Opponent playbook</strong><small>{hasPlaybook ? 'Your existing plan stays on file; refreshed reads help you tune it.' : 'A dedicated plan stays for the season and applies automatically against them.'}</small></span>
                </div>
                <div className="scout-purchase-row">
                  <span><small>COST</small><strong>{dollars(SCOUT_COST)}</strong><em>{canAfford ? `${dollars(remaining(economy, prestige) - SCOUT_COST)} remains after purchase` : `Need ${dollars(SCOUT_COST - remaining(economy, prestige))} more`}</em></span>
                  <button className="tap" type="button" disabled={!canAfford} onClick={() => { scoutTeam(index); requestClose(); }}>{canAfford ? (hasPlaybook ? 'Refresh report' : 'Buy report') : 'Cannot afford'}</button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
      <button
        className="profile-actions-launcher"
        type="button"
        aria-label={open ? 'Close program decisions' : 'Program decisions'}
        aria-expanded={open}
        onClick={() => {
          if (open) requestClose();
          else { setMode('actions'); setPhase('open'); }
        }}
      >{open ? <Cross1Icon /> : <DotsHorizontalIcon />}<span>{open ? 'Close' : 'Decisions'}</span></button>
    </aside>
    </>,
    host,
  );
}

/** One thing you can do about this program, in the player FAB's clothes. */
function ActionCard(
  { icon, eyebrow, title, detail, meta, onClick, selected = false, disabled = false }:
  { icon: ReactNode; eyebrow: string; title: string; detail: string; meta?: string; onClick: () => void; selected?: boolean; disabled?: boolean },
) {
  return (
    <button
      className={`command-action-card${selected ? ' selected' : ''}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="command-action-icon">{icon}</span>
      <span className="command-action-copy"><small>{eyebrow}</small><strong>{title}</strong><p>{detail}</p>{meta && <em>{meta}</em>}</span>
      {selected ? <CheckIcon /> : <span className="command-action-state" />}
    </button>
  );
}

function TabStrip({ at, onGo }: { at: Sheet; onGo: (s: Sheet) => void }) {
  return (
    <div className="card-tabs">
      <Segmented
        label="Program card section"
        value={at}
        onChange={onGo}
        options={SHEETS.map((s) => ({
          value: s,
          label: SHEET_LABEL[s].charAt(0) + SHEET_LABEL[s].slice(1).toLowerCase(),
        }))}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

/**
 * What you have done to each other this year.
 *
 * The most useful thing on the page and the reason it opens on this tab: every
 * other number here is available in the table you tapped from, and this one is
 * not available anywhere. Derived from `season.results`, which carries every
 * game the world has played — so it is right whether the two of you met in
 * February or have not met yet.
 */
function headToHead(season: SeasonState, mine: number, theirs: number): {
  w: number; l: number; games: { day: number; home: boolean; us: number; them: number }[];
  toCome: number; next: number | null;
} {
  const isPair = (a: number, b: number): boolean =>
    (a === mine && b === theirs) || (a === theirs && b === mine);

  const games = season.results
    .filter((r) => isPair(r.home, r.away))
    .map((r) => {
      const home = r.home === mine;
      return {
        day: r.day,
        home,
        us: home ? r.homeRuns : r.awayRuns,
        them: home ? r.awayRuns : r.homeRuns,
      };
    })
    .sort((a, b) => a.day - b.day);

  let w = 0;
  let l = 0;
  for (const g of games) { if (g.us > g.them) w += 1; else l += 1; }

  // What is still on the calendar, so a card opened in February does not read
  // as though the two programs never meet.
  const ahead = season.schedule
    .slice(season.dayIndex)
    .filter((d) => d.games.some((g) => isPair(g.home, g.away)));

  return { w, l, games, toCome: ahead.length, next: ahead[0]?.day ?? null };
}

function Overview(
  { t, me, season }:
  { t: Record_; me: Record_ | null; season: SeasonState },
) {
  const year = useDynasty((s) => s.year);
  const mine = me && me.index === t.index;
  const h2h = me && !mine ? headToHead(season, me.index, t.index) : null;
  const culture = cultureFor(t);
  const games = season.results
    .filter((r) => r.home === t.index || r.away === t.index)
    .sort((a, b) => a.day - b.day)
    .map((r) => {
      const home = r.home === t.index;
      const us = home ? r.homeRuns : r.awayRuns;
      const them = home ? r.awayRuns : r.homeRuns;
      return { home, won: us > them };
    });
  const wl = (gs: { won: boolean }[]): string =>
    `${gs.filter((g) => g.won).length}-${gs.filter((g) => !g.won).length}`;
  const streak = t.streak === 0 ? '—' : `${t.streak > 0 ? 'W' : 'L'}${Math.abs(t.streak)}`;

  return (
    <div className="college-overview-stack">
      {culture && (
        <section className="college-identity-card">
          <header>
            <span><small>PROGRAM IDENTITY</small><strong>{culture.name}</strong></span>
            <b>{CULTURE_LABEL[culture.edge]}</b>
          </header>
          <p>{culture.creed}</p>
          <div className="college-value-grid">
            <article>
              <small>PATIENCE</small>
              <strong>{culture.patience >= 60 ? 'Long runway' : culture.patience <= 40 ? 'Results now' : 'Measured'}</strong>
              <span>{culture.patience >= 60 ? 'The board gives a coach time to build.' : culture.patience <= 40 ? 'Bad seasons get counted quickly.' : 'Progress matters, but so does direction.'}</span>
            </article>
            <article>
              <small>AMBITION</small>
              <strong>{culture.ambition >= 60 ? 'National stage' : culture.ambition <= 40 ? 'Win consistently' : 'Postseason standard'}</strong>
              <span>{culture.ambition >= 60 ? 'Omaha is the benchmark.' : culture.ambition <= 40 ? 'A winning program clears the bar.' : 'Tournament baseball is expected.'}</span>
            </article>
          </div>
        </section>
      )}

      <section className="college-matchup-card">
        <header>
          <span><small>YOUR HISTORY</small><strong>Head to head</strong></span>
          {!mine && h2h && h2h.games.length > 0 && <b>{h2h.w}-{h2h.l}</b>}
        </header>
        {mine ? (
          <p className="college-empty-copy">This is your program.</p>
        ) : h2h && h2h.games.length > 0 ? (
          <>
            <div className="college-h2h-grid">
              {h2h.games.map((g) => (
                <article key={g.day}>
                  <span><small>{seasonDate(year, g.day)}</small><strong>{g.home ? 'HOME' : 'ROAD'}</strong></span>
                  <b className={g.us > g.them ? 'win' : 'loss'}>{g.us > g.them ? 'W' : 'L'} {g.us}-{g.them}</b>
                </article>
              ))}
            </div>
            <p className="college-card-note">
              {h2h.toCome > 0
                ? `${h2h.toCome} still to play${h2h.next === null ? '' : ` · next ${seasonDate(year, h2h.next)}`}.`
                : 'Season series complete.'}
            </p>
          </>
        ) : (
          <p className="college-empty-copy">
            {h2h && h2h.toCome > 0 && h2h.next !== null
              ? `First meeting ${seasonDate(year, h2h.next)}${h2h.toCome > 1 ? ` · ${h2h.toCome} games scheduled` : ''}.`
              : `You have not played ${t.def.school} this season.`}
          </p>
        )}
      </section>

      <section className="college-form-card">
        <header><small>SEASON SHAPE</small><strong>How they are playing</strong></header>
        {games.length === 0 ? (
          <p className="college-empty-copy">No games yet.</p>
        ) : (
          <div className="college-form-grid">
            <article><small>LAST {Math.min(10, games.length)}</small><strong>{wl(games.slice(-10))}</strong></article>
            <article><small>HOME</small><strong>{wl(games.filter((g) => g.home))}</strong></article>
            <article><small>ROAD</small><strong>{wl(games.filter((g) => !g.home))}</strong></article>
            <article className={Math.abs(t.streak) >= 5 ? 'hot' : ''}><small>STREAK</small><strong>{streak}</strong></article>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

/**
 * Their nine, their weekend and their pen.
 *
 * Every name opens the player card the rest of the app opens, which already
 * knows to withhold potential from somebody else's man — what a rival coach can
 * see is what he has done and what he can do now, not how much further he might
 * go. Nothing here changes that.
 */
function Roster({ t, season }: { t: Record_; season: SeasonState }) {
  const openPlayer = useDynasty((s) => s.openPlayer);

  return (
    <>
      <PanelHead>BATTING ORDER</PanelHead>
      <Panel>
        <HeadRow cols={['', 'PLAYER', 'POS', 'OVR', 'AVG', 'HR']} />
        {t.team.lineup.map((p) => {
          const line = season.batting.get(p.id);
          return (
            <PlayerRow
              key={p.id}
              id={p.id}
              abbr={t.def.abbr}
              name={p.name}
              slot={p.pos}
              ovr={overallOf(p)}
              a={line && line.ab > 0 ? pct(battingAverage(line)) : '—'}
              b={String(line?.hr ?? 0)}
              onClick={() => openPlayer(p.id)}
            />
          );
        })}
      </Panel>

      <div style={{ marginTop: 16 }}><PanelHead>ROTATION</PanelHead></div>
      <Panel>
        <HeadRow cols={['', 'PLAYER', 'ROL', 'OVR', 'ERA', 'IP']} />
        {t.team.rotation.map((p) => (
          <ArmRow key={p.id} p={p} abbr={t.def.abbr} season={season} onClick={() => openPlayer(p.id)} />
        ))}
      </Panel>

      <div style={{ marginTop: 16 }}><PanelHead>BULLPEN</PanelHead></div>
      <Panel>
        <HeadRow cols={['', 'PLAYER', 'ROL', 'OVR', 'ERA', 'IP']} />
        {t.team.bullpen.map((p) => (
          <ArmRow key={p.id} p={p} abbr={t.def.abbr} season={season} onClick={() => openPlayer(p.id)} />
        ))}
      </Panel>

      {t.team.bench.length > 0 && (
        <>
          <div style={{ marginTop: 16 }}><PanelHead>BENCH</PanelHead></div>
          <Panel>
            <HeadRow cols={['', 'PLAYER', 'POS', 'OVR', 'AVG', 'HR']} />
            {t.team.bench.map((p: Hitter) => {
              const line = season.batting.get(p.id);
              return (
                <PlayerRow
                  key={p.id}
                  id={p.id}
                  abbr={t.def.abbr}
                  name={p.name}
                  slot={p.pos}
                  ovr={overallOf(p)}
                  a={line && line.ab > 0 ? pct(battingAverage(line)) : '—'}
                  b={String(line?.hr ?? 0)}
                  onClick={() => openPlayer(p.id)}
                />
              );
            })}
          </Panel>
        </>
      )}

      <PanelNote>
        What a rival has done is public; what he might become is his
        coach&apos;s to know.
      </PanelNote>
    </>
  );
}

function ArmRow(
  { p, abbr, season, onClick }:
  { p: Arm; abbr: string; season: SeasonState; onClick: () => void },
) {
  const line = season.pitching.get(p.id);
  return (
    <PlayerRow
      id={p.id}
      abbr={abbr}
      name={p.name}
      slot={p.role}
      ovr={overallOf(p)}
      a={line && line.outs > 0 ? era(line).toFixed(2) : '—'}
      b={line ? inningsPitched(line).toFixed(1) : '0.0'}
      onClick={onClick}
    />
  );
}

const ROSTER_GRID = '26px 1fr 30px 30px 44px 34px';

function HeadRow({ cols }: { cols: string[] }) {
  return (
    <div style={{
      // Pinned to the top of the scroller, so the column it is naming is never
      // off screen at the same time as the name of the column.
      position: 'sticky', top: 0, zIndex: 1,
      display: 'grid', gridTemplateColumns: ROSTER_GRID, gap: 4,
      padding: '7px 10px', background: 'var(--paper)',
      borderBottom: '1px solid var(--hairline)',
    }}>
      {cols.map((c, i) => (
        <span key={i} className="label" style={{ textAlign: i > 1 ? 'right' : 'left' }}>{c}</span>
      ))}
    </div>
  );
}

function PlayerRow(
  { id, abbr, name, slot, ovr, a, b, onClick }:
  {
    id: string; abbr: string; name: string; slot: string; ovr: number;
    a: string; b: string; onClick: () => void;
  },
) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        display: 'grid', gridTemplateColumns: ROSTER_GRID, gap: 4,
        alignItems: 'center', padding: '7px 10px',
        borderBottom: '1px solid var(--hairline)', background: 'transparent',
      }}
    >
      <Avatar id={id} team={abbr} size={22} />
      <span style={{
        font: "400 calc(12px * var(--ts)) var(--body)",
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{name}</span>
      <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)", textAlign: 'right' }}>{slot}</span>
      <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)", textAlign: 'right' }}>{ovr}</span>
      <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)", textAlign: 'right' }}>{a}</span>
      <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)", textAlign: 'right' }}>{b}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/**
 * Their year, game by game.
 *
 * Scores and nothing under them, and that is a limit of the save rather than a
 * gap in this screen: the engine keeps box scores for one program — see
 * `captureBoxFor` — because a full season is a thousand games across the league
 * and storing every line to serve a page nobody opens would put tens of
 * thousands of rows in a save. The note says so.
 */
function Results({ t, me, season }: { t: Record_; me: Record_ | null; season: SeasonState }) {
  const year = useDynasty((s) => s.year);
  const mine = me !== null && me.index === t.index;

  const rows = season.results
    .filter((r) => r.home === t.index || r.away === t.index)
    .map((r) => {
      const home = r.home === t.index;
      const them = season.teams[home ? r.away : r.home];
      const us = home ? r.homeRuns : r.awayRuns;
      const theirs = home ? r.awayRuns : r.homeRuns;
      return { day: r.day, home, opponent: them, us, theirs, conference: r.conference };
    })
    .sort((a, b) => a.day - b.day);

  if (rows.length === 0) {
    return (
      <>
        <PanelHead>RESULTS</PanelHead>
        <PanelNote>They have not played a game yet this season.</PanelNote>
      </>
    );
  }

  return (
    <>
      <PanelHead>RESULTS · {rows.length} PLAYED</PanelHead>
      <Panel>
        <div style={{
          position: 'sticky', top: 0, zIndex: 1,
          display: 'grid', gridTemplateColumns: '68px 14px 1fr 20px 46px',
          gap: 6, padding: '7px 10px', background: 'var(--paper)',
          borderBottom: '1px solid var(--hairline)',
        }}>
          {['DATE', '', 'OPPONENT', '', 'SCORE'].map((c, i) => (
            <span key={i} className="label" style={{ textAlign: i === 4 ? 'right' : 'left' }}>{c}</span>
          ))}
        </div>
        {rows.map((r, i) => {
          const won = r.us > r.theirs;
          return (
            <div key={`${r.day}-${i}`} style={{
              display: 'grid', gridTemplateColumns: '68px 14px 1fr 20px 46px',
              gap: 6, alignItems: 'center',
              padding: '8px 10px', borderBottom: '1px solid var(--hairline)',
            }}>
              <span style={{ font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
                {seasonDate(year, r.day)}
              </span>
              <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
                {r.home ? 'vs' : '@'}
              </span>
              <span style={{
                font: "400 calc(12px * var(--ts)) var(--body)",
                color: r.opponent ? teamColour(r.opponent.def.abbr) : 'var(--ink)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{r.opponent?.def.school ?? '—'}</span>
              <span style={{
                font: "600 calc(11px * var(--ts)) var(--mono)", textAlign: 'right',
                color: won ? 'var(--win)' : 'var(--loss)',
              }}>{won ? 'W' : 'L'}</span>
              <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)", textAlign: 'right' }}>
                {r.us}-{r.theirs}
              </span>
            </div>
          );
        })}
      </Panel>
      <PanelNote>
        {mine
          ? 'Your own games carry a full box score. Open one from the SCHEDULE screen.'
          : 'Scores only — full box scores are kept for your program alone.'}
      </PanelNote>
    </>
  );
}

// ---------------------------------------------------------------------------
// The small parts come from the Kit now.
//
// This file used to carry its own Head, Panel, Note, Tile, Stat and Meter —
// the pre-port originals, drawn with inline styles, with the same names as
// the ported ones a screen away. That duplication IS the reported bug: the
// college profile was the last screen still wearing the old design, and it
// looked untouched because it literally was.
// ---------------------------------------------------------------------------

/**
 * The scouting dossier: the school rather than its players.
 *
 * Asked for by name after the first play session — *"the rival school scouting
 * btw I'm not sure if we have added this but if not add it to the list of things
 * we need to add."* We had not, and every fact on this page was already in the
 * save with nowhere to be read: the programme's culture and what it believes,
 * the man in the chair and how long he has been in it, what he is good at, and
 * how safe his seat is.
 *
 * It is scouting rather than a leak. What a rival coach can see from across the
 * conference is a programme's reputation and its record; his opponent's ratings
 * are on the player cards, gated the way they have always been. This page adds
 * no information the world did not already publish — it stops making you infer
 * it from a table.
 */
function Dossier({ t, stars, rival }: { t: Owner; stars: number; rival: boolean }) {
  const culture = cultureOf(t.def.abbr);
  const coach = t.coach;
  const economy = useDynasty((s) => s.economy);
  const season = useDynasty((s) => s.season);
  const scoutsHimself = useDynasty((s) => handles(s.depth, 'scouting'));
  const day = season?.dayIndex ?? 0;
  const booked = rival && ((economy.scouted[t.index] ?? -1) >= day || !scoutsHimself);
  const reads = booked ? teamReads(t.team) : null;
  const strengths = coach
    ? (Object.entries(coach.skills) as Array<[string, number]>)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
    : [];
  const seat = coach
    ? coach.security >= 70 ? 'Safe. The board is not counting.'
      : coach.security >= 45 ? 'Settled, but a bad year would be noticed.'
        : coach.security >= 25 ? 'Under pressure. Another one like this and they will look.'
          : 'On the way out. His name is already on somebody’s list.'
    : null;

  return (
    <div className="dossier-grid-stack">
      <section className="dossier-program-card">
        <header>
          <span><small>PROGRAM DNA</small><strong>{culture?.name ?? 'Program identity'}</strong></span>
          {culture && <b>{CULTURE_LABEL[culture.edge]}</b>}
        </header>
        {culture && <p>{culture.creed}</p>}
        <div className="dossier-stat-grid">
          <article><small>PRESTIGE</small><strong>{t.prestige}</strong><span>{'★'.repeat(stars)}</span></article>
          <article><small>PATIENCE</small><strong>{culture?.patience ?? '—'}</strong><span>{culture && culture.patience >= 60 ? 'LONG RUNWAY' : 'SHORTER LEASH'}</span></article>
          <article><small>AMBITION</small><strong>{culture?.ambition ?? '—'}</strong><span>{culture && culture.ambition >= 60 ? 'NATIONAL' : 'PROGRAM'}</span></article>
        </div>
      </section>

      {rival && (
        <section className={`dossier-intel-card${reads ? ' has-report' : ''}`}>
          <header>
            <span><small>SCOUTING REPORT</small><strong>{reads ? 'What the report found' : 'No report yet'}</strong></span>
            <b>{reads ? 'LIVE' : 'LOCKED'}</b>
          </header>
          {reads ? (
            <div className="dossier-read-grid">
              {reads.slice(0, 6).map((read, i) => (
                <article key={`${read.slot}-${read.title}`}>
                  <small>{String(i + 1).padStart(2, '0')}</small>
                  <strong>{read.title}</strong>
                  <p>{read.text}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="dossier-empty-report">
              <strong>Public information only</strong>
              <p>Scout this program to reveal tendencies and unlock an opponent plan.</p>
            </div>
          )}
        </section>
      )}

      <section className="dossier-coach-card">
        <header>
          <span><small>IN THE CHAIR</small><strong>{coach?.name ?? 'Vacant'}</strong></span>
          {coach && <b>{coach.security >= 45 ? 'SECURE' : 'PRESSURE'}</b>}
        </header>
        {coach ? (
          <>
            <div className="dossier-coach-facts">
              <article><small>TENURE</small><strong>{coach.tenure === 0 ? 'First season' : `${coach.tenure} seasons`}</strong><span>{coach.age} years old</span></article>
              <article><small>CAREER</small><strong>{coach.careerWins}-{coach.careerLosses}</strong><span>{coach.titles} national · {coach.conferenceTitles} conference</span></article>
              <article><small>CONTRACT</small><strong>{coach.contractYears} years</strong><span>{seat}</span></article>
            </div>
            <div className="dossier-strength-grid">
              {strengths.map(([k, v]) => (
                <article key={k}>
                  <span><small>{k.replace(/([A-Z])/g, ' $1').toUpperCase()}</small><b>{v}</b></span>
                  <i><em style={{ width: `${Math.min(100, v)}%` }} /></i>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="college-empty-copy">Nobody has been named to the chair.</p>
        )}
      </section>

      <p className="dossier-public-note">Player performance is public. Private potential stays on the individual player card.</p>
    </div>
  );
}
