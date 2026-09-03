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

import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChartIcon, CheckIcon, Cross1Icon, EnvelopeClosedIcon, EyeOpenIcon, IdCardIcon,
  MixerHorizontalIcon, StarIcon,
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
import { prestigeStars } from '../../engine/program.js';
import { teamReads } from '../../engine/tendencies.js';
import {
  battingAverage, era, inningsPitched, regularRecord, rpiOrder,
} from '../../engine/season.js';
import { pct, seasonDate } from '../format.js';
import type { Hitter, Pitcher } from '../../engine/types.js';
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
        <div className="team-card-head">
          <section className="team-banner">
            {/* A crest rather than a face. The avatars elsewhere are portraits
                of a man, and one at the top of a program's page would read as
                somebody in particular. The abbreviation in the school's own
                colour is what the tables already teach you to recognise. */}
            <div className="team-mark"><Crest abbr={t.def.abbr} size={64} /></div>
            <div>
              <small>{t.conference} · {'★'.repeat(stars)}</small>
              <h2 style={{ color: teamColour(t.def.abbr) }}>{t.def.school}</h2>
              <p>{t.def.nickname}</p>
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
        </div>
        <TabStrip at={sheet} onGo={setSheet} />
      </>
    }>
      <div style={{ padding: '12px 14px 20px' }}>
        {sheet === 'overview' && <Overview t={t} me={me} season={season} />}
        {sheet === 'roster' && <Roster t={t} season={season} />}
        {sheet === 'results' && <Results t={t} me={me} season={season} />}
        {/* Scouting the school rather than its players — asked for by name:
            "the rival school scouting ... if not add it to the list of things
            we need to add." Everything on it was already in the save and had
            nowhere to be read. */}
        {/* The mockup's compare panel, toggled from Program Actions. */}
        {sheet === 'overview' && comparing && me && me.index !== t.index && (
          <section className="college-compare">
            <small>{me.def.school.toUpperCase()} VS {t.def.school.toUpperCase()}</small>
            <div>
              <span><b>{me.prestige}</b> Prestige</span>
              <strong>vs</strong>
              <span><b>{t.prestige}</b> Prestige</span>
            </div>
            <div>
              <span><b>{regularRecord(me).w}-{regularRecord(me).l}</b> Record</span>
              <strong>vs</strong>
              <span><b>{reg.w}-{reg.l}</b> Record</span>
            </div>
            <p>
              {t.prestige > me.prestige
                ? `${t.def.school} has the stronger profile today.`
                : t.prestige < me.prestige
                  ? `${me.def.school} has the stronger profile today.`
                  : 'Dead level on profile today.'}
              {' '}Prestige decides whose calls get answered.
            </p>
          </section>
        )}
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
  { abbr, school, index, comparing, onCompare }:
  {
    abbr: string; school: string; index: number;
    comparing: boolean; onCompare: () => void;
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
  /*
    Three states, not a boolean, because closing is a motion now. Reported:
    "the action button has a nice opening animation but it does not when
    closing" — `open` flipping to false hit `display: none` on the same
    frame. CLOSING keeps the popover mounted for one 180ms exit, then a
    timer lands it. The timer rather than animationend, so reduced motion
    (which strips the animation) cannot strand the menu mid-state.
  */
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
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
  const scouted = (economy.scouted[index] ?? -1) >= day;
  const prestige = season?.teams[userTeam]?.prestige ?? 40;
  const canAfford = remaining(economy, prestige) >= SCOUT_COST;

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
    <aside className={`college-actions-fab${open ? ' open' : ''}${phase === 'closing' ? ' closing' : ''}`}>
      <div className="college-actions-popover" aria-hidden={!open}>
        <div className="player-actions-popover-heading">
          <small>PROGRAM ACTIONS</small>
          <strong>{school}</strong>
          <span>Keep a useful read on the wider college game.</span>
        </div>
        <div className="action-list">
          <ActionCard
            icon={<StarIcon />}
            title={tracked ? 'Program tracked' : 'Track program'}
            detail={tracked
              ? 'They are on WATCHLIST, on your program tab. Tap again to drop them.'
              : 'Files them under WATCHLIST on your program tab, so their season stays one tap away.'}
            selected={tracked}
            onClick={() => toggleProgramWatch(abbr)}
          />
          <ActionCard
            icon={<BarChartIcon />}
            title={comparing ? 'Comparison open' : 'Compare with your club'}
            detail={comparing
              ? 'The side-by-side is on the OVERVIEW sheet behind this menu.'
              : 'Puts their profile beside yours, right here on the overview.'}
            selected={comparing}
            onClick={() => { onCompare(); requestClose(); }}
          />
          {/*
            The scouting desk — stage 11. One report covers the whole roster's
            tendencies for the next stretch of games. Casual careers get the
            book brought by staff, so the card says that instead of a price.
          */}
          <ActionCard
            icon={<EyeOpenIcon />}
            title={!scoutsHimself ? 'Your staff scouts them'
              : scouted ? 'Book bought' : `Scout them · ${dollars(SCOUT_COST)}`}
            detail={!scoutsHimself
              ? 'Your staff buys these books out of the wage bill; the reads are already on their player cards.'
              : scouted
                ? `Bought. The team's habits are on their DOSSIER sheet, and every man's tendency line reads on his card for the next ${SCOUT_DAYS} days.`
                : canAfford
                  ? `Buys their book for ${SCOUT_DAYS} days: the team's habits fill their DOSSIER sheet, and every man's tendencies show on his player card.`
                  : 'The ledger cannot carry it this year. The budget is on your program tab.'}
            selected={scouted || !scoutsHimself}
            onClick={() => { if (scoutsHimself && !scouted && canAfford) scoutTeam(index); }}
          />
          <ActionCard
            icon={<IdCardIcon />}
            title={jobPath ? 'Job path tracked' : 'Track job path'}
            detail={jobPath
              ? 'Starred at the job market, and the wire writes to your inbox when this chair moves. Tap again to stop.'
              : 'Quiet interest, no application: the job market stars this chair when it opens, and your assistant writes when it moves.'}
            selected={jobPath}
            onClick={() => toggleJobWatch(abbr)}
          />
          <ActionCard
            icon={<EnvelopeClosedIcon />}
            title={said !== null ? 'Letter sent'
              : approaches.interest.includes(index) ? 'They would take the call'
              : approaches.tried.includes(index) ? 'You wrote to them'
              : approaches.tried.length >= 3 ? 'Three letters sent'
              : 'Write to them'}
            detail={said !== null ? said
              : approaches.interest.includes(index) ? 'They would take the call — expect them when chairs move. Watch your inbox.'
              : approaches.tried.includes(index) ? 'Sent this season. Once a school a season is the rule.'
              : approaches.tried.length >= 3 ? 'Three a season, and you have sent yours. The market reopens with the year.'
              : 'Asks about the chair, quietly. Three a season, never the same school twice, and word can get back to your board.'}
            selected={said !== null
              || approaches.interest.includes(index)
              || approaches.tried.includes(index)}
            onClick={() => {
              if (approaches.tried.includes(index) || approaches.tried.length >= 3) return;
              const out = approach(index);
              setSaid(
                out === 'interested' ? 'They would take the call.'
                : out === 'caught' ? 'Somebody talked. Your own board has heard about it.'
                : out === 'ignored' ? 'Nothing came back.'
                : 'Not this season.',
              );
            }}
          />
        </div>
      </div>
      <button
        className="college-actions-trigger"
        type="button"
        aria-label={open ? 'Close program actions' : 'Program actions'}
        aria-expanded={open}
        onClick={() => (open ? requestClose() : setPhase('open'))}
      >{open ? <Cross1Icon /> : <MixerHorizontalIcon />}</button>
    </aside>
    </>,
    host,
  );
}

/** One thing you can do about this program, in the player FAB's clothes. */
function ActionCard(
  { icon, title, detail, onClick, selected = false }:
  { icon: ReactNode; title: string; detail: string; onClick: () => void; selected?: boolean },
) {
  return (
    <button
      className={`action-card${selected ? ' selected' : ''}`}
      type="button"
      onClick={onClick}
    >
      <span className="action-card-icon">{icon}</span>
      <span><strong>{title}</strong><small>{detail}</small></span>
      {selected ? <CheckIcon /> : <span />}
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

  return (
    <>
      {/*
        What the place believes, before anything about this year.

        A programme used to be a name, a colour and two numbers, and the two
        numbers were both about strength — so every school read as the same
        school at a different volume. This is the half that says what they
        actually want, which is what makes taking a job a decision rather than
        picking the highest number that will have you.
      */}
      {culture && (
        <>
          <PanelHead>WHAT THEY BELIEVE</PanelHead>
          <Panel>
            <div style={{ padding: '10px 12px 11px' }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
              }}>
                <span style={{
                  font: "800 calc(15px * var(--ts))/1.05 var(--display)",
                  textTransform: 'uppercase', color: 'var(--ink)',
                }}>{culture.name}</span>
                <span style={{
                  font: "600 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.14em',
                  color: 'var(--clay)',
                }}>{CULTURE_LABEL[culture.edge]}</span>
              </div>
              <div style={{
                marginTop: 5,
                font: "400 calc(11.5px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
              }}>{culture.creed}</div>
            </div>
            {/* Deliberately unnumbered. Patience and ambition are opinions,
                not quantities, and printing "62" invites somebody to compare
                it with "64" as though the difference meant something. The
                ends are named instead, which is how a person would describe
                the place out loud. */}
            <Meter
              k="PATIENCE" value={culture.patience}
              v={culture.patience >= 60 ? 'they will wait'
                : culture.patience <= 40 ? 'they count fast' : 'somewhere in between'}
            />
            <Meter
              k="AMBITION" value={culture.ambition}
              v={culture.ambition >= 60 ? 'Omaha or nothing'
                : culture.ambition <= 40 ? 'a winning season' : 'somewhere in between'}
            />
          </Panel>
        </>
      )}

      <PanelHead>HEAD TO HEAD</PanelHead>
      {mine ? (
        <PanelNote>This is your program. Everything here is your own season.</PanelNote>
      ) : h2h && (h2h.games.length > 0 ? (
        <>
          <Panel>
            <Stat
              k="SERIES THIS YEAR"
              v={`${h2h.w}-${h2h.l}`}
            />
            {h2h.games.map((g, i) => (
              <div key={g.day} style={{
                display: 'grid', gridTemplateColumns: '1fr 26px 52px',
                gap: 8, alignItems: 'baseline', padding: '8px 12px',
                borderBottom: i === h2h.games.length - 1
                  ? 'none' : '1px solid var(--hairline)',
              }}>
                <span style={{ font: "400 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
                  {seasonDate(year, g.day)} {g.home ? 'vs' : '@'}
                </span>
                <span style={{
                  font: "700 calc(11px * var(--ts)) var(--mono)", textAlign: 'right',
                  color: g.us > g.them ? 'var(--win)' : 'var(--loss)',
                }}>{g.us > g.them ? 'W' : 'L'}</span>
                <span style={{ font: "600 calc(12px * var(--ts)) var(--mono)", textAlign: 'right' }}>
                  {g.us}-{g.them}
                </span>
              </div>
            ))}
          </Panel>
          {h2h.toCome > 0 && (
            <PanelNote>
              {h2h.toCome} still to play, the next on{' '}
              {h2h.next === null ? 'the calendar' : seasonDate(year, h2h.next)}.
            </PanelNote>
          )}
        </>
      ) : (
        <PanelNote>
          You have not played {t.def.school} this season.{' '}
          {h2h.toCome > 0 && h2h.next !== null
            ? `You meet them ${h2h.toCome > 1 ? `${h2h.toCome} times, starting ` : ''}on ${seasonDate(year, h2h.next)}.`
            : 'They are not on your schedule this year.'}
        </PanelNote>
      ))}

      {/*
        The form guide, not the fact sheet.

        Two panels used to follow here — THE PROGRAM (school, nickname,
        conference, prestige) and THIS SEASON (record, rank, runs) — and every
        line of both was already printed in the banner and the metric strip a
        thumb's width above. Reported as "feels outdated and doesn't really
        follow the whole style of the app", and the redundancy was most of why:
        a page that says everything twice reads like two designs pasted
        together. What replaces them is the one thing the header does NOT say —
        how the season is actually going: the recent stretch, the splits, the
        streak, computed from the results the save already keeps for everybody.
      */}
      {(() => {
        const games = season.results
          .filter((r) => r.home === t.index || r.away === t.index)
          .sort((a, b) => a.day - b.day)
          .map((r) => {
            const home = r.home === t.index;
            const us = home ? r.homeRuns : r.awayRuns;
            const them = home ? r.awayRuns : r.homeRuns;
            return { home, won: us > them };
          });
        if (games.length === 0) {
          return (
            <div style={{ marginTop: 16 }}>
              <PanelHead>THE SHAPE OF THE SEASON</PanelHead>
              <PanelNote>No games yet. The header fills in as they play.</PanelNote>
            </div>
          );
        }
        const wl = (gs: { won: boolean }[]): string =>
          `${gs.filter((g) => g.won).length}-${gs.filter((g) => !g.won).length}`;
        const streak = t.streak === 0 ? '—' : `${t.streak > 0 ? 'W' : 'L'}${Math.abs(t.streak)}`;
        return (
          <>
            <div style={{ marginTop: 16 }}>
              <PanelHead>THE SHAPE OF THE SEASON</PanelHead>
            </div>
            <Tiles>
              <Tile k={`LAST ${Math.min(10, games.length)}`} v={wl(games.slice(-10))} />
              <Tile k="HOME" v={wl(games.filter((g) => g.home))} />
              <Tile k="ROAD" v={wl(games.filter((g) => !g.home))} />
              {/* The accent is earned, not decorative: five straight either
                  way is the line where a run becomes the story of a team. */}
              <Tile k="STREAK" v={streak} accent={Math.abs(t.streak) >= 5} />
            </Tiles>
          </>
        );
      })()}
    </>
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
        Tap a name for his card. You can see what a rival has done and what he
        can do now. How much further he might go is his coach's to know.
      </PanelNote>
    </>
  );
}

function ArmRow(
  { p, abbr, season, onClick }:
  { p: Pitcher; abbr: string; season: SeasonState; onClick: () => void },
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
          : 'Scores only. The game keeps full box scores for your program alone, so there are no batting or pitching lines to open here.'}
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
  /*
    The scout's book — stage 16's tendencies screen, exactly where the door
    put it: a team card on the rival's college profile, filled in once the
    desk has scouted them. The same purchase that lights the per-man lines
    (SCOUT THEM on the action button) opens this sheet; a casual career's
    staff buys the books out of the wage bill, so theirs is always open.
  */
  const economy = useDynasty((s) => s.economy);
  const season = useDynasty((s) => s.season);
  const scoutsHimself = useDynasty((s) => handles(s.depth, 'scouting'));
  const day = season?.dayIndex ?? 0;
  const booked = rival && ((economy.scouted[t.index] ?? -1) >= day || !scoutsHimself);
  const reads = booked ? teamReads(t.team) : null;

  /** What his points have gone into, loudest first. */
  const strengths = coach
    ? (Object.entries(coach.skills) as Array<[string, number]>)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    : [];

  const seat = coach
    ? coach.security >= 70 ? 'Safe. The board is not counting.'
      : coach.security >= 45 ? 'Settled, but a bad year would be noticed.'
        : coach.security >= 25 ? 'Under pressure. Another one like this and they will look.'
          : 'On the way out. His name is already on somebody\u2019s list.'
    : null;

  return (
    <>
      <SectionHeading kicker="THE PROGRAMME" title={culture?.name ?? 'A place with a history'} />
      {culture && (
        <FieldNote title={CULTURE_LABEL[culture.edge]} text={culture.creed} />
      )}

      {rival && (
        <>
          <SectionHeading
            kicker="THE SCOUT'S BOOK"
            title={reads ? 'How they beat you, and how you beat them' : 'A closed book'}
          />
          {reads
            ? reads.map((r) => <FieldNote key={r.slot + r.title} title={r.title} text={r.text} />)
            : (
              <FieldNote
                title="The desk has not been paid"
                text="SCOUT THEM on the action button buys their book: the team's habits fill this sheet and every man's tendency line reads on his card."
              />
            )}
        </>
      )}

      <section className="split-grid">
        <div>
          <small>PRESTIGE</small>
          <strong>{t.prestige}</strong>
          <span>{'\u2605'.repeat(stars)}</span>
        </div>
        <div>
          <small>PATIENCE</small>
          <strong>{culture?.patience ?? '—'}</strong>
          <span>BEFORE THEY COUNT</span>
        </div>
        <div>
          <small>AMBITION</small>
          <strong>{culture?.ambition ?? '—'}</strong>
          <span>WHAT CLEARS THE BAR</span>
        </div>
      </section>

      {coach ? (
        <>
          <SectionHeading kicker="IN THE CHAIR" title={coach.name} />
          <section className="tendency-list">
            <div>
              <span>TENURE</span>
              <strong>
                {coach.tenure === 0 ? 'First season' : `${coach.tenure} seasons here`}
                <em>{coach.age} years old · {coach.contractYears} left on the deal</em>
              </strong>
            </div>
            <div>
              <span>RECORD</span>
              <strong>
                {coach.careerWins}-{coach.careerLosses}
                <em>
                  {coach.titles > 0 ? `${coach.titles} national · ` : ''}
                  {coach.conferenceTitles} conference · {coach.tournaments} tournaments
                </em>
              </strong>
            </div>
            <div>
              <span>THE SEAT</span>
              <strong>
                {coach.security >= 45 ? 'Secure' : 'Warm'}
                <em>{seat}</em>
              </strong>
            </div>
          </section>

          <SectionHeading kicker="WHAT HE IS GOOD AT" title="Where his points went" />
          <section className="tool-table">
            {strengths.map(([k, v]) => (
              <div key={k}>
                <span>{k.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
                <b>{v}</b>
                <i><em style={{ width: `${Math.min(100, v)}%` }} /></i>
                <small>{v >= 70 ? 'PLUS' : v >= 50 ? 'SOLID' : 'FAIR'}</small>
              </div>
            ))}
          </section>
        </>
      ) : (
        <FieldNote
          title="Nobody has been named"
          text="The chair is empty, or this programme predates the coaching carousel in your save."
        />
      )}

      <FieldNote
        title="This is scouting, not a leak"
        text="Everything here is what the country already publishes about a programme — its
          reputation, its record, and the man in the chair. What his players can
          actually do stays on their own cards, gated the way it always was."
      />
    </>
  );
}
