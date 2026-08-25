// Player.tsx
// One player's card, in tabs.
//
// Everything the game knows about a man used to be one column: the face, the
// ratings, this year's line, and every year before it, stacked. That reads
// fine on the freshman who has played four games and badly on the senior who
// has four seasons and thirty box scores behind him — the ratings you opened
// the card for end up two screens above the thing you scrolled to.
//
// So the card is now a header that never moves and five tabs under it. Who he
// is stays on screen; what you happen to be asking about changes. The header
// keeps the two numbers that are true on every tab — overall and potential —
// because those are the ones you are comparing against whatever the tab says.
//
// Ratings are shown as bars against a fixed 0 to 99 scale rather than as bare
// numbers, because what matters is the shape of a player — where he is strong,
// where the hole is — and a row of two digit numbers hides that. The gap between
// where he is and where he could be is drawn as a lighter extension of the same
// bar, so a freshman with room to grow reads differently from a finished senior
// at a glance.

import { useState, type ReactNode } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { potentialGrade } from '../../engine/scouting.js';
import { overallOf } from '../../engine/ratings.js';
import { Avatar, teamColour } from '../Avatar.js';
import { FixedHeader } from '../Sticky.js';
import {
  battingAverage, onBase, slugging, era, whip, inningsPitched,
} from '../../engine/season.js';
import type { BoxScore, CareerYear, SeasonState } from '../../engine/season.js';
import type { Departure } from '../../engine/progression.js';
import { pct, seasonDate } from '../format.js';
import type {
  ClassYear, Hitter, Pitcher, PlayerId, Player as AnyPlayer,
} from '../../engine/types.js';

/** The record for one program, as the season carries it. */
type Owner = SeasonState['teams'][number];

/**
 * The keys of a player that hold a rating.
 *
 * The bar tables index the player by name, and the point of typing them this
 * way is that a key which drifts — a rating renamed in the engine, a typo — is
 * a compile error here rather than a bar that quietly draws zero.
 */
type RatingKey<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T] & string;

/**
 * The ratings, under the names baseball actually uses.
 *
 * The internal fields keep their engine names — `range`, `hands`, `stuff` — but
 * nobody outside this file should have to learn them. "Stuff 72" and "Hands 61"
 * are house vocabulary; K/9 and Fielding are what a player already knows from
 * every other baseball game, and a rating you have to be taught is a rating you
 * do not read.
 *
 * The descriptions stay, because a familiar name still does not say what the
 * simulation does with it.
 */
const HITTER_BARS: Array<[RatingKey<Hitter>, string, string]> = [
  ['contact', 'CONTACT', 'Hits for average, and strikes out less'],
  ['power', 'POWER', 'Home runs and extra base hits'],
  ['eye', 'DISCIPLINE', 'Draws walks, chases less'],
  ['speed', 'SPEED', 'Triples, infield hits, steals, extra bases'],
  ['range', 'REACTION', 'First step and ground covered — turns would-be hits into outs'],
  ['hands', 'FIELDING', 'Handles what he reaches. Low fielding is how a routine play becomes an error'],
  ['arm', 'ARM STRENGTH', 'Keeps runners from taking the extra base. Behind the plate, throws them out'],
];

const PITCHER_BARS: Array<[RatingKey<Pitcher>, string, string]> = [
  ['stuff', 'K/9', 'Misses bats. This is the strikeout rating'],
  ['movement', 'H/9', 'Suppresses hits and home runs'],
  ['control', 'BB/9', 'Throws strikes. Fewer walks and hit batters'],
  ['stamina', 'STAMINA', 'How deep into a start he can go'],
  ['groundBall', 'GB RATE', 'Keeps it on the ground, sets up double plays'],
  ['holdRunners', 'PICKOFF', 'Keeps baserunners honest'],
];

const CLASS_NAME: Record<ClassYear, string> = {
  FR: 'Freshman', SO: 'Sophomore', JR: 'Junior', SR: 'Senior',
};

type Sheet = 'overview' | 'ratings' | 'stats' | 'games' | 'history';

const SHEET_LABEL: Record<Sheet, string> = {
  overview: 'OVERVIEW',
  ratings: 'RATINGS',
  // "STATISTICS" is the honest word and it is two characters too many: five
  // labels have to hold on a 360 pixel phone without shrinking below the size
  // the rest of the app uses for a tab.
  stats: 'STATS',
  games: 'GAMES',
  history: 'HISTORY',
};

const LIVE_SHEETS: Sheet[] = ['overview', 'ratings', 'stats', 'games', 'history'];

/**
 * A man who has left, with no ratings to show.
 *
 * There is nothing left to scout — he is not on a roster, so there is no rating
 * to read and no current season to have a line in. What survives him is the
 * record book.
 */
const ALUMNI_SHEETS: Sheet[] = ['overview', 'history'];

// ---------------------------------------------------------------------------

/** One appearance, pulled out of a box score. */
export interface GameLogRow {
  day: number;
  /** The other program's abbreviation. */
  opponent: string;
  home: boolean;
  won: boolean;
  us: number;
  them: number;
  /** Lineup spot or pitching role, as the box score recorded it. */
  slot: string;
  /** "2-4, HR, 3 RBI". Display text the game layer already wrote. */
  line: string;
}

/**
 * Every game this man appeared in, oldest first.
 *
 * Matched on the player id rather than the name, because two Tyler Johnsons in
 * a sixty four school world is a matter of time and a game log that silently
 * merges them is worse than no game log.
 *
 * Only ever finds anything for the user's program and the current year: box
 * scores are captured for his team alone and wiped at the roll. The screen says
 * so rather than showing an empty table and letting it read as "never played".
 */
export function gameLogFor(
  season: {
    boxScores?: Record<number, BoxScore>;
    teams: ReadonlyArray<{ def: { abbr: string } }>;
  },
  id: PlayerId,
  teamIndex: number,
): GameLogRow[] {
  const rows: GameLogRow[] = [];
  for (const box of Object.values(season.boxScores ?? {})) {
    const home = box.home === teamIndex;
    if (!home && box.away !== teamIndex) continue;

    const batting = home ? box.homeBatting : box.awayBatting;
    const pitching = home ? box.homePitching : box.awayPitching;
    const line = [...batting, ...pitching].find((l) => l.id === id);
    if (!line) continue;

    const us = home ? box.homeRuns : box.awayRuns;
    const them = home ? box.awayRuns : box.homeRuns;
    rows.push({
      day: box.day,
      opponent: season.teams[home ? box.away : box.home]?.def.abbr ?? '—',
      home,
      won: us > them,
      us,
      them,
      slot: line.slot,
      line: line.line,
    });
  }
  // Keyed by day in the save, and object key order is not a promise worth
  // relying on for something the reader expects in calendar order.
  return rows.sort((a, b) => a.day - b.day);
}

// ---------------------------------------------------------------------------

export function Player() {
  const season = useDynasty((s) => s.season);
  const selected = useDynasty((s) => s.selectedPlayer);
  const report = useDynasty((s) => s.lastOffseason);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const [sheet, setSheet] = useState<Sheet>('overview');
  void version;

  if (!season || !team || !selected) return <Nobody />;

  // Look across the whole world, not just this roster. A leaderboard is full of
  // players you do not employ and would still like to read about.
  const rosterOf = (t: Owner): AnyPlayer[] =>
    [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen];

  let p: AnyPlayer | undefined = rosterOf(team).find((x) => x.id === selected);
  let owner = team;
  if (!p) {
    for (const t of season.teams) {
      const found = rosterOf(t).find((x) => x.id === selected);
      if (found) { p = found; owner = t; break; }
    }
  }

  /*
    Nobody's roster, and that is a real player, not a bad id.

    The draft screen opens the men it has just removed and the history screen
    opens award winners who graduated years ago. Both were handing this file an
    id no roster contains, and it answered with nothing at all — a full screen
    overlay with a back button and a blank page under it. What is left of a man
    who has gone is the departure notice and the record book, so show those.
  */
  if (!p) {
    const gone = [...(report?.graduated ?? []), ...(report?.drafted ?? [])]
      .find((d) => d.id === selected);
    const career = season.careers?.[selected] ?? [];
    if (!gone && career.length === 0) return <Nobody />;
    return <Alumnus id={selected} gone={gone} career={career} sheet={sheet} onSheet={setSheet} />;
  }

  /**
   * You only scout your own program in full. For everyone else the card shows
   * what a box score would tell you — ratings and production — and withholds
   * potential, which is the one number a rival coach genuinely cannot know.
   */
  const isOurs = owner.index === team.index;
  const isPitcher = p.type === 'pitcher';
  const ovr = overallOf(p);
  const slot = isPitcher ? (p as Pitcher).role : p.pos;

  // A tab that is not on offer must never be the one on screen. Cheap insurance
  // against a card that reopens on a tab the next man does not have.
  const active = LIVE_SHEETS.includes(sheet) ? sheet : 'overview';

  return (
    <FixedHeader header={
      <>
        <CardHead
          id={p.id}
          name={p.name}
          abbr={owner.def.abbr}
          left={{ k: 'CLASS', v: p.classYear }}
          right={{ k: isPitcher ? 'ROLE' : 'POS', v: slot }}
          sub={
            <>
              {p.classYear} · BATS {p.bats} · THROWS {p.throws}
              {isPitcher && (p as Pitcher).sidearm ? ' · SIDEARM' : ''}
            </>
          }
          school={isOurs ? null : { name: owner.def.school, conference: owner.conference }}
          ovr={ovr}
          potential={isOurs ? potentialGrade(p.potential) : '—'}
          rising={isOurs && p.potential > ovr}
        />
        <TabStrip sheets={LIVE_SHEETS} at={active} onGo={setSheet} />
      </>
    }>
      <div style={{ padding: '12px 14px 20px' }}>
        {active === 'overview' && <Overview p={p} owner={owner} isOurs={isOurs} />}
        {active === 'ratings' && <Ratings p={p} />}
        {active === 'stats' && <ThisSeason id={p.id} isPitcher={isPitcher} />}
        {active === 'games' && <Games id={p.id} owner={owner} isOurs={isOurs} />}
        {active === 'history' && <Career id={p.id} isPitcher={isPitcher} isOurs={isOurs} />}
      </div>
    </FixedHeader>
  );
}

/**
 * A player who is no longer anywhere.
 *
 * Half a card by necessity — the ratings and this season's line went with the
 * roster spot — but a name, how he left, and the years he actually played are
 * more than enough to be worth opening.
 */
function Alumnus(
  { id, gone, career, sheet, onSheet }:
  {
    id: PlayerId;
    gone: Departure | undefined;
    career: CareerYear[];
    sheet: Sheet;
    onSheet: (s: Sheet) => void;
  },
) {
  const last = career[career.length - 1];
  // A departure notice survives one offseason, so a man who left four years ago
  // has none — and the record book would name him "Former player" on a screen
  // that had just listed him by name. His id *is* his name (see `playerId` in
  // players.ts), which is the only reason anybody that far back can be named at
  // all; fall back to it whenever the record book still holds a season for him.
  const name = gone?.name ?? (career.length > 0 ? String(id) : 'Former player');
  const abbr = gone?.teamAbbr ?? last?.team ?? '';
  const classYear = gone?.classYear ?? last?.classYear ?? '—';
  const drafted = gone?.reason === 'drafted';

  // The record book knows what he was without knowing what position he played:
  // a career line carries at bats or innings, so the shape of his years is the
  // only thing left to decide the table by.
  const wasPitcher = career.some((y) => (y.outs ?? 0) > 0) || !career.some((y) => (y.ab ?? 0) > 0);
  const active = ALUMNI_SHEETS.includes(sheet) ? sheet : 'overview';

  return (
    <FixedHeader header={
      <>
        <CardHead
          id={id}
          name={name}
          abbr={abbr}
          left={{ k: 'CLASS', v: classYear }}
          right={{ k: 'EXIT', v: gone ? (drafted ? 'DRAFT' : 'GRAD') : '—' }}
          sub={<>FORMER PLAYER{abbr ? ` · ${abbr}` : ''}</>}
          school={null}
          ovr={gone ? gone.overall : '—'}
          potential="—"
          rising={false}
        />
        <TabStrip sheets={ALUMNI_SHEETS} at={active} onGo={onSheet} />
      </>
    }>
      <div style={{ padding: '12px 14px 20px' }}>
        {active === 'overview' && (
          <>
            <Panel>
              <Stat k="STATUS" v={gone ? (drafted ? 'Drafted' : 'Graduated') : 'Departed'} />
              <Stat k="LAST CLASS" v={classYear in CLASS_NAME
                ? CLASS_NAME[classYear as ClassYear] : classYear} />
              {abbr && <Stat k="PROGRAM" v={abbr} />}
              {drafted && gone?.round !== undefined && (
                <Stat k="DRAFT ROUND" v={`Round ${gone.round}`} />
              )}
              <Stat k="SEASONS ON RECORD" v={String(career.length)} last />
            </Panel>
            <Note>
              He has left the program. There is nothing left to scout and no
              current line to read — what the game keeps of him now is the
              record book.
            </Note>
          </>
        )}
        {active === 'history' && <CareerTable years={career} isPitcher={wasPitcher} />}
      </div>
    </FixedHeader>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

/**
 * Who he is, pinned above the tabs.
 *
 * The face sits between the two facts you sort a roster by — what year he is in
 * and where he plays — because those three together are the whole identification,
 * and putting them on one line means the name below it can be as large as a name
 * should be. Overall and potential stay outside the tabs: they are the numbers
 * every other panel is read against, and hiding them behind RATINGS would make
 * comparing a stat line to the man producing it a two tap job.
 */
function CardHead(
  { id, name, abbr, left, right, sub, school, ovr, potential, rising }:
  {
    id: PlayerId;
    name: string;
    abbr: string;
    left: { k: string; v: string };
    right: { k: string; v: string };
    sub: ReactNode;
    school: { name: string; conference: string } | null;
    ovr: number | string;
    potential: string;
    rising: boolean;
  },
) {
  // No back control here. The overlay that mounts this card carries the navy
  // ← BACK bar every full-screen overlay in the game carries, and that bar sits
  // above this header and outside the scroller — so the card can start at the
  // face, and the safe area is the bar's problem rather than this one's.
  return (
    <div style={{ padding: '8px 12px 0' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
      }}>
        <Flank k={left.k} v={left.v} align="right" />
        <Avatar id={id} team={abbr} size={72} />
        <Flank k={right.k} v={right.v} align="left" />
      </div>

      <div style={{
        marginTop: 6, textAlign: 'center',
        font: "800 26px/0.95 var(--display)", textTransform: 'uppercase',
      }}>{name}</div>

      <div className="label" style={{ marginTop: 4, textAlign: 'center' }}>{sub}</div>

      {school && (
        <div style={{
          marginTop: 3, textAlign: 'center',
          font: "600 10px var(--mono)", letterSpacing: '.1em',
          color: teamColour(abbr),
        }}>{school.name.toUpperCase()} · {school.conference}</div>
      )}

      <div style={{
        display: 'flex', margin: '10px 0 10px',
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="OVERALL" v={String(ovr)} />
        <Tile k="POTENTIAL" v={potential} accent={rising} last />
      </div>
    </div>
  );
}

/** One of the two facts either side of the face. */
function Flank({ k, v, align }: { k: string; v: string; align: 'left' | 'right' }) {
  return (
    <div style={{ minWidth: 52, textAlign: align }}>
      <div className="label">{k}</div>
      <div style={{
        marginTop: 1, font: "800 20px/1 var(--display)", textTransform: 'uppercase',
      }}>{v}</div>
    </div>
  );
}

/** The tabs, in the same clothes the recruiting sheet's tabs wear. */
function TabStrip(
  { sheets, at, onGo }: { sheets: Sheet[]; at: Sheet; onGo: (s: Sheet) => void },
) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '0 12px 10px' }}>
      {sheets.map((s) => (
        <button
          key={s}
          onClick={() => onGo(s)}
          style={{
            flex: 1, padding: '8px 0',
            background: s === at ? 'var(--ink)' : 'var(--field)',
            border: s === at ? '1px solid var(--ink)' : '1px solid var(--faint)',
            color: s === at ? 'var(--cream)' : 'var(--dim)',
            font: "700 8.5px var(--mono)", letterSpacing: '.08em',
          }}
        >{SHEET_LABEL[s]}</button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

/**
 * The facts, with nothing invented to fill the card out.
 *
 * There is no hometown, no height and no jersey number in this game — the
 * generator makes a name, a class and a set of ratings — so the panel lists what
 * exists and stops. A row of plausible blanks would be the card lying about how
 * much the world knows.
 */
function Overview({ p, owner, isOurs }: { p: AnyPlayer; owner: Owner; isOurs: boolean }) {
  const isPitcher = p.type === 'pitcher';
  return (
    <>
      <Head>INFORMATION</Head>
      <Panel>
        {isPitcher ? (
          <Stat
            k="ROLE"
            v={`${(p as Pitcher).role === 'SP' ? 'Starter' : 'Reliever'}${
              (p as Pitcher).sidearm ? ' · sidearm' : ''}`}
          />
        ) : (
          <Stat k="POSITION" v={p.pos} />
        )}
        <Stat k="CLASS" v={CLASS_NAME[p.classYear]} />
        <Stat k="BATS" v={p.bats === 'S' ? 'Switch' : p.bats === 'L' ? 'Left' : 'Right'} />
        <Stat k="THROWS" v={p.throws === 'L' ? 'Left' : 'Right'} />
        {isPitcher && <Stat k="FASTBALL" v={`${(p as Pitcher).velocity} mph`} />}
        <Stat k="SCHOOL" v={owner.def.school} />
        <Stat k="CONFERENCE" v={owner.conference} last />
      </Panel>
      {!isOurs && (
        <Note>
          He plays for someone else. You can see what he has done and what he can
          do now — how much further he might go is your rival's problem to know.
        </Note>
      )}
    </>
  );
}

function Ratings({ p }: { p: AnyPlayer }) {
  const isPitcher = p.type === 'pitcher';
  return (
    <>
      <Head>SCOUTING</Head>
      <div style={{
        marginTop: 8, padding: '12px 12px 6px',
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {isPitcher
          ? PITCHER_BARS.map(([key, label, note]) => (
            <Bar key={key} label={label} note={note} value={Math.round((p as Pitcher)[key])} />
          ))
          : HITTER_BARS.map(([key, label, note]) => (
            <Bar key={key} label={label} note={note} value={Math.round((p as Hitter)[key])} />
          ))}
        {isPitcher && (
          <div style={{
            marginTop: 2, paddingTop: 9, borderTop: '1px solid var(--hairline)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span className="label">FASTBALL</span>
            <span style={{ font: "600 13px var(--mono)" }}>
              {(p as Pitcher).velocity} mph
            </span>
          </div>
        )}
      </div>
    </>
  );
}

function ThisSeason({ id, isPitcher }: { id: PlayerId; isPitcher: boolean }) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  const bat = season?.batting.get(id);
  const pit = season?.pitching.get(id);

  /*
    A walk is an appearance.

    Gating the hitter's line on at bats alone told a pinch hitter who has drawn
    two walks that he "has not appeared yet this season" — while the box score
    for Tuesday's game had his name in it and his on base percentage was 1.000.
    An at bat is not the same thing as having played.
  */
  const batted = bat && (bat.ab > 0 || bat.bb > 0 || bat.hbp > 0);

  return (
    <>
      <Head>THIS SEASON</Head>
      <Panel>
        {isPitcher ? (
          pit && pit.outs > 0 ? (
            <>
              <Stat k="RECORD" v={`${pit.w}-${pit.l}`} />
              <Stat k="ERA" v={era(pit).toFixed(2)} />
              <Stat k="INNINGS" v={inningsPitched(pit).toFixed(1)} />
              <Stat k="STRIKEOUTS" v={String(pit.k)} />
              <Stat k="WALKS" v={String(pit.bb)} />
              <Stat k="WHIP" v={whip(pit).toFixed(2)} />
              <Stat k="SAVES" v={String(pit.sv)} last />
            </>
          ) : <Empty>Has not appeared yet this season.</Empty>
        ) : (
          batted && bat ? (
            <>
              <Stat k="AVERAGE" v={bat.ab > 0 ? pct(battingAverage(bat)) : '—'} />
              <Stat k="ON BASE" v={pct(onBase(bat))} />
              <Stat k="SLUGGING" v={bat.ab > 0 ? pct(slugging(bat)) : '—'} />
              <Stat k="HITS" v={`${bat.h}-for-${bat.ab}`} />
              <Stat k="WALKS" v={String(bat.bb)} />
              <Stat k="HOME RUNS" v={String(bat.hr)} />
              <Stat k="RUNS BATTED IN" v={String(bat.rbi)} />
              {/* "5-7" reads as a win-loss record on a card that has one two
                  rows up. Spelled out, it can only mean one thing. */}
              <Stat k="STOLEN BASES" v={`${bat.sb} of ${bat.sb + bat.cs}`} last />
            </>
          ) : <Empty>Has not appeared yet this season.</Empty>
        )}
      </Panel>
    </>
  );
}

/**
 * Game by game, for as long as the save keeps them.
 *
 * Two honest limits, both stated on the screen rather than papered over: the
 * game only stores box scores for the program you coach, and it throws them
 * away at the roll into next season. So a rival's card has no log at all, and
 * yours only ever covers the year in progress.
 */
function Games({ id, owner, isOurs }: { id: PlayerId; owner: Owner; isOurs: boolean }) {
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  void version;

  if (!season) return null;
  if (!isOurs) {
    return (
      <>
        <Head>GAME LOG</Head>
        <Panel><Empty>Game logs are kept only for your own program.</Empty></Panel>
      </>
    );
  }

  const rows = gameLogFor(season, id, owner.index);

  return (
    <>
      <Head>GAME LOG · {year}</Head>
      <Panel>
        {rows.length === 0
          ? <Empty>No appearances yet this season.</Empty>
          : rows.map((r) => (
            <div
              key={r.day}
              style={{
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 6,
                padding: '8px 10px', borderBottom: '1px solid var(--hairline)',
              }}
            >
              <span style={{ font: "400 10px var(--mono)", color: 'var(--dim)' }}>
                {seasonDate(year, r.day)} · {r.home ? 'vs' : '@'} {r.opponent}
              </span>
              <span style={{
                font: "600 10px var(--mono)", textAlign: 'right',
                color: r.won ? 'var(--win)' : 'var(--loss)',
              }}>{r.won ? 'W' : 'L'} {r.us}-{r.them}</span>
              <span style={{
                gridColumn: '1 / -1', marginTop: 2, font: "400 12px var(--body)",
              }}>
                <span style={{
                  font: "600 9px var(--mono)", color: 'var(--dim)', marginRight: 7,
                }}>{r.slot}</span>
                {r.line}
              </span>
            </div>
          ))}
      </Panel>
      {rows.length > 0 && (
        <Note>Box scores cover the season in progress. They are cleared at the roll.</Note>
      )}
    </>
  );
}

/**
 * Every year he has played here.
 *
 * The season maps are wiped each June, so without the record book a junior's
 * first two years simply did not exist — which is a strange thing for a game
 * whose whole subject is players getting better. Your program only, for the
 * same reason the box scores are: keeping every line for all sixty four schools
 * would put tens of thousands of rows through every autosave.
 */
function Career({ id, isPitcher, isOurs }: { id: PlayerId; isPitcher: boolean; isOurs: boolean }) {
  const season = useDynasty((s) => s.season);
  const years = season?.careers?.[id] ?? [];

  if (!isOurs && years.length === 0) {
    return (
      <>
        <Head>COLLEGE CAREER</Head>
        <Panel><Empty>The record book is kept for your own program only.</Empty></Panel>
      </>
    );
  }

  return (
    <>
      <Head>COLLEGE CAREER</Head>
      <CareerTable years={years} isPitcher={isPitcher} />
    </>
  );
}

function CareerTable({ years, isPitcher }: { years: CareerYear[]; isPitcher: boolean }) {
  const cols = isPitcher ? '42px 32px 1fr 46px 42px 38px' : '42px 32px 1fr 46px 34px 38px';

  if (years.length === 0) {
    return <Panel><Empty>No completed seasons yet.</Empty></Panel>;
  }

  return (
    <div style={{
      marginTop: 8, border: '1px solid var(--faint)', background: 'var(--paper)',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: cols,
        gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--hairline)',
      }}>
        {(isPitcher
          ? ['YEAR', 'CL', 'TEAM', 'W-L', 'ERA', 'K']
          : ['YEAR', 'CL', 'TEAM', 'AVG', 'HR', 'RBI']
        ).map((h) => <span key={h} className="label">{h}</span>)}
      </div>
      {years.map((y) => (
        <div key={y.year} style={{
          display: 'grid', gridTemplateColumns: cols,
          gap: 6, alignItems: 'baseline',
          padding: '7px 10px', borderBottom: '1px solid var(--hairline)',
        }}>
          <span style={{ font: "700 12px var(--display)" }}>{y.year}</span>
          <span style={{ font: "400 10px var(--mono)", color: 'var(--dim)' }}>{y.classYear}</span>
          <span style={{ font: "400 10px var(--mono)", color: 'var(--dim)' }}>{y.team}</span>
          {isPitcher ? (
            <>
              <span style={{ font: "500 11px var(--mono)" }}>{y.w ?? 0}-{y.l ?? 0}</span>
              <span style={{ font: "500 11px var(--mono)" }}>
                {y.outs ? ((y.er ?? 0) * 27 / y.outs).toFixed(2) : '—'}
              </span>
              <span style={{ font: "500 11px var(--mono)" }}>{y.k ?? 0}</span>
            </>
          ) : (
            <>
              <span style={{ font: "500 11px var(--mono)" }}>
                {y.ab ? pct((y.h ?? 0) / y.ab) : '—'}
              </span>
              <span style={{ font: "500 11px var(--mono)" }}>{y.hr ?? 0}</span>
              <span style={{ font: "500 11px var(--mono)" }}>{y.rbi ?? 0}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Nobody() {
  return (
    <div style={{ padding: '28px 16px', textAlign: 'center' }}>
      <div className="label">NO PLAYER SELECTED</div>
      <div style={{
        marginTop: 8, font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
      }}>Tap a name on the roster.</div>
    </div>
  );
}

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
    <div style={{ marginTop: 8, font: "400 11px/1.5 var(--body)", color: 'var(--dim)' }}>
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: '12px', font: "400 12px/1.5 var(--body)", color: 'var(--dim)' }}>
      {children}
    </div>
  );
}

function Tile({ k, v, accent, last }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '9px 8px',
      borderRight: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <div className="label">{k}</div>
      <div style={{
        font: "700 24px/1 var(--display)", marginTop: 2,
        color: accent ? 'var(--clay)' : 'var(--ink)',
      }}>{v}</div>
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
      <span style={{ font: "600 14px var(--mono)", textAlign: 'right' }}>{v}</span>
    </div>
  );
}

/** A rating, drawn against the full scale so the shape of a player is readable. */
function Bar({ label, note, value }: { label: string; note: string; value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: 2,
      }}>
        <span className="label">{label}</span>
        <span style={{ font: "600 11px var(--mono)", color: 'var(--dim)' }}>{value}</span>
      </div>
      <div style={{
        font: "400 10px/1.3 var(--body)", color: 'var(--dim)', marginBottom: 4,
      }}>{note}</div>
      <div style={{ height: 6, background: 'rgba(28,36,48,.09)' }}>
        <div style={{
          width: `${width}%`, height: '100%',
          background: value >= 60 ? 'var(--clay)' : 'var(--ink)',
          opacity: value >= 60 ? 1 : 0.55,
        }} />
      </div>
    </div>
  );
}
