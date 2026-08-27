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
import { useDynasty, useUserTeam } from '../../state/store.js';
import { Avatar, teamColour } from '../Avatar.js';
import { FixedHeader } from '../Sticky.js';
import { overallOf } from '../../engine/ratings.js';
import { prestigeStars } from '../../engine/program.js';
import {
  battingAverage, era, inningsPitched, regularRecord, rpiOrder,
} from '../../engine/season.js';
import { pct, seasonDate } from '../format.js';
import type { Hitter, Pitcher } from '../../engine/types.js';
import type { SeasonState } from '../../engine/season.js';

type Record_ = SeasonState['teams'][number];

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

type Sheet = 'overview' | 'roster' | 'results';

const SHEET_LABEL: Record<Sheet, string> = {
  overview: 'OVERVIEW',
  roster: 'ROSTER',
  results: 'RESULTS',
};

const SHEETS: Sheet[] = ['overview', 'roster', 'results'];

export function TeamCard({ index }: { index: number }) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const me = useUserTeam();
  const [sheet, setSheet] = useState<Sheet>('overview');
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
        <div style={{ padding: '10px 12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* A crest rather than a face. The avatars elsewhere are portraits
                of a man, and one at the top of a program's page would read as
                somebody in particular — a coach the game does not have. The
                abbreviation in the school's own colour is what the tables
                already teach you to recognise. */}
            <div style={{
              flex: 'none', width: 46, height: 46,
              display: 'grid', placeItems: 'center',
              background: teamColour(t.def.abbr),
            }}>
              <span style={{
                font: "800 calc(15px * var(--ts)) var(--display)", letterSpacing: '.04em',
                color: 'var(--cream)',
              }}>{t.def.abbr}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="label">{t.conference} · {stars} STAR PROGRAM</div>
              <div style={{
                font: "800 calc(21px * var(--ts))/0.95 var(--display)", marginTop: 3,
                textTransform: 'uppercase', color: teamColour(t.def.abbr),
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{t.def.school}</div>
              <div style={{
                marginTop: 2, font: "400 calc(11px * var(--ts))/1.35 var(--body)", color: 'var(--dim)',
              }}>{t.def.nickname}</div>
            </div>
          </div>

          <div style={{
            display: 'flex', margin: '10px 0',
            border: '1px solid var(--faint)', background: 'var(--paper)',
          }}>
            <Tile k="OVERALL" v={`${reg.w}-${reg.l}`} />
            <Tile k={t.conference} v={`${t.cw}-${t.cl}`} />
            <Tile k="RPI" v={rank > 0 ? `#${rank}` : '—'} last />
          </div>
        </div>
        <TabStrip at={sheet} onGo={setSheet} />
      </>
    }>
      <div style={{ padding: '12px 14px 20px' }}>
        {sheet === 'overview' && <Overview t={t} me={me} season={season} rank={rank} stars={stars} />}
        {sheet === 'roster' && <Roster t={t} season={season} />}
        {sheet === 'results' && <Results t={t} me={me} season={season} />}
      </div>
    </FixedHeader>
  );
}

function TabStrip({ at, onGo }: { at: Sheet; onGo: (s: Sheet) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '0 12px 10px' }}>
      {SHEETS.map((s) => (
        <button
          key={s}
          onClick={() => onGo(s)}
          style={{
            flex: 1, padding: '8px 0',
            background: s === at ? 'var(--ink)' : 'var(--field)',
            border: s === at ? '1px solid var(--ink)' : '1px solid var(--faint)',
            color: s === at ? 'var(--cream)' : 'var(--dim)',
            font: "700 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.08em',
          }}
        >{SHEET_LABEL[s]}</button>
      ))}
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
  { t, me, season, rank, stars }:
  { t: Record_; me: Record_ | null; season: SeasonState; rank: number; stars: number },
) {
  const year = useDynasty((s) => s.year);
  const diff = t.rs - t.ra;
  const reg = regularRecord(t);
  const mine = me && me.index === t.index;
  const h2h = me && !mine ? headToHead(season, me.index, t.index) : null;

  return (
    <>
      <Head>HEAD TO HEAD</Head>
      {mine ? (
        <Note>This is your program. Everything here is your own season.</Note>
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
            <Note>
              {h2h.toCome} still to play, the next on{' '}
              {h2h.next === null ? 'the calendar' : seasonDate(year, h2h.next)}.
            </Note>
          )}
        </>
      ) : (
        <Note>
          You have not played {t.def.school} this season.{' '}
          {h2h.toCome > 0 && h2h.next !== null
            ? `You meet them ${h2h.toCome > 1 ? `${h2h.toCome} times, starting ` : ''}on ${seasonDate(year, h2h.next)}.`
            : 'They are not on your schedule this year.'}
        </Note>
      ))}

      <div style={{ marginTop: 16 }}>
        <Head>THE PROGRAM</Head>
      </div>
      <Panel>
        <Stat k="SCHOOL" v={t.def.school} />
        <Stat k="NICKNAME" v={t.def.nickname} />
        <Stat k="CONFERENCE" v={t.conference} />
        <Stat k="PRESTIGE" v={`${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`} last />
      </Panel>

      <div style={{ marginTop: 16 }}>
        <Head>THIS SEASON</Head>
      </div>
      <Panel>
        <Stat k="OVERALL" v={`${reg.w}-${reg.l}`} />
        <Stat k="CONFERENCE" v={`${t.cw}-${t.cl}`} />
        <Stat k="NATIONAL RANK" v={rank > 0 ? `#${rank} RPI` : 'Unranked'} />
        <Stat k="RUNS" v={`${t.rs} scored · ${t.ra} allowed`} />
        <Stat k="RUN DIFFERENTIAL" v={`${diff > 0 ? '+' : ''}${diff}`} />
        <Stat
          k="STREAK"
          v={t.streak === 0
            ? 'None'
            : `${t.streak > 0 ? 'Won' : 'Lost'} ${Math.abs(t.streak)} straight`}
          last
        />
      </Panel>
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
      <Head>BATTING ORDER</Head>
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

      <div style={{ marginTop: 16 }}><Head>ROTATION</Head></div>
      <Panel>
        <HeadRow cols={['', 'PLAYER', 'ROL', 'OVR', 'ERA', 'IP']} />
        {t.team.rotation.map((p) => (
          <ArmRow key={p.id} p={p} abbr={t.def.abbr} season={season} onClick={() => openPlayer(p.id)} />
        ))}
      </Panel>

      <div style={{ marginTop: 16 }}><Head>BULLPEN</Head></div>
      <Panel>
        <HeadRow cols={['', 'PLAYER', 'ROL', 'OVR', 'ERA', 'IP']} />
        {t.team.bullpen.map((p) => (
          <ArmRow key={p.id} p={p} abbr={t.def.abbr} season={season} onClick={() => openPlayer(p.id)} />
        ))}
      </Panel>

      {t.team.bench.length > 0 && (
        <>
          <div style={{ marginTop: 16 }}><Head>BENCH</Head></div>
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

      <Note>
        Tap a name for his card. You can see what a rival has done and what he
        can do now. How much further he might go is his coach's to know.
      </Note>
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
        <Head>RESULTS</Head>
        <Note>They have not played a game yet this season.</Note>
      </>
    );
  }

  return (
    <>
      <Head>RESULTS · {rows.length} PLAYED</Head>
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
      <Note>
        {mine
          ? 'Your own games carry a full box score. Open one from the SCHEDULE screen.'
          : 'Scores only. The game keeps full box scores for your program alone, so there are no batting or pitching lines to open here.'}
      </Note>
    </>
  );
}

// ---------------------------------------------------------------------------
// The same small parts the player card is built from.
// ---------------------------------------------------------------------------

function Head({ children }: { children: ReactNode }) {
  return (
    <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
      <div className="label">{children}</div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      marginTop: 8, border: '1px solid var(--faint)', background: 'var(--paper)',
    }}>{children}</div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginTop: 8, font: "400 calc(11px * var(--ts))/1.5 var(--body)", color: 'var(--dim)' }}>
      {children}
    </div>
  );
}

function Tile({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, padding: '9px 8px',
      borderRight: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <div className="label" style={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{k}</div>
      <div style={{ font: "700 calc(22px * var(--ts))/1 var(--display)", marginTop: 2 }}>{v}</div>
    </div>
  );
}

function Stat({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '8px 12px', gap: 10,
      borderBottom: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <span className="label">{k}</span>
      <span style={{
        font: "600 calc(13px * var(--ts)) var(--mono)", textAlign: 'right',
      }}>{v}</span>
    </div>
  );
}
