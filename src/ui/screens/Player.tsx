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
import {
  BADGES, FAMILY_LABEL, TIER_NAME, badgeCap, badgesOf,
  type BadgeFamily,
} from '../../engine/badges.js';
import { PITCHES, repertoireOf, speedOf } from '../../engine/pitches.js';
import { potentialGrade } from '../../engine/scouting.js';
import {
  HITTER_TENDENCIES, PITCHER_TENDENCIES, TENDENCIES, isKnown, tendenciesOf,
  tendencyLabel, watchProgress, type TendencyId,
} from '../../engine/tendencies.js';
import { draftEligible } from '../../engine/draft.js';
import { overallOf, platoonSplit, naturalPos } from '../../engine/ratings.js';
import { Avatar, teamColour } from '../Avatar.js';
import { FixedHeader } from '../Sticky.js';
import {
  battingAverage, onBase, slugging, era, whip, inningsPitched,
  fieldingPct, playsAboveExpected, fieldingContext, careerName, liveCareerYear,
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
 * do not read. Under those names the bars need no captions, and a card without
 * captions fits a whole player above the fold.
 */
const HITTER_BARS: Array<[RatingKey<Hitter>, string]> = [
  ['contact', 'CONTACT'],
  ['power', 'POWER'],
  ['eye', 'DISCIPLINE'],
  ['speed', 'SPEED'],
  ['steal', 'BASE STEALING'],
  ['bunt', 'BUNTING'],
];

/**
 * The glove, on its own list.
 *
 * Eleven bars in one column is a scroll nobody reads to the bottom of, and the
 * split is not just for length: hitting and fielding are the two questions you
 * ask about a position player, and a coach deciding whether this man can play
 * shortstop should not have to skip past his power to find out.
 */
const HITTER_GLOVE_BARS: Array<[RatingKey<Hitter>, string]> = [
  ['range', 'REACTION'],
  ['hands', 'FIELDING'],
  ['arm', 'ARM STRENGTH'],
  ['armAccuracy', 'ACCURACY'],
];

/**
 * Blocking, and why only the catcher has it.
 *
 * Every position player carries the rating — the generator draws it for all of
 * them — but the simulation asks about it in exactly one place, behind the
 * plate, and `overallOf` pays for it in exactly one place too. Printing a bar
 * for a left fielder's blocking would be the card advertising a number that
 * changes nothing about him, which is the sort of thing a player only finds out
 * by testing it and then stops trusting the whole tab. So it appears where it is
 * real. A backup catcher's shows; a shortstop's does not exist as far as this
 * screen is concerned, and if he ever moves behind the plate it will.
 */
const CATCHER_BAR: [RatingKey<Hitter>, string] = ['blocking', 'BLOCKING'];

const PITCHER_BARS: Array<[RatingKey<Pitcher>, string]> = [
  ['stuff', 'K/9'],
  ['movement', 'H/9'],
  ['control', 'BB/9'],
  ['stamina', 'STAMINA'],
  ['groundBall', 'GB RATE'],
  ['holdRunners', 'PICKOFF'],
];

/**
 * A pitcher has a glove now, and it is read.
 *
 * He fields about one comebacker in eight ground balls and has to throw it
 * across, which is a play pitchers genuinely botch. The card showed none of it —
 * six bars and no defence at all — while the fielding line underneath was
 * quietly charging him errors for a rating nobody could see.
 */
const PITCHER_GLOVE_BARS: Array<[RatingKey<Pitcher>, string]> = [
  ['range', 'REACTION'],
  ['hands', 'FIELDING'],
  ['arm', 'ARM STRENGTH'],
  ['armAccuracy', 'ACCURACY'],
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
 * a ninety six school world is a matter of time and a game log that silently
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
  // A DH's card names the position he actually plays — the DH is where the
  // coach bats him, not what he is. See `naturalPos`.
  const slot = isPitcher ? (p as Pitcher).role : naturalPos(p as Hitter);
  const dhToday = !isPitcher && p.pos === 'DH';

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
            // The class year is already on the flank to the left of his face,
            // so the line under his name spends the room on the thing the flank
            // does not say. Age is not a restatement of class year: two juniors
            // can be twenty and twenty-two, and only one of them was draft
            // eligible last June.
            <>
              AGE {p.age} · BATS {p.bats} · THROWS {p.throws}
              {isPitcher && (p as Pitcher).sidearm ? ' · SIDEARM' : ''}
              {dhToday ? ' · BATS AS DH' : ''}
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
        {active === 'ratings' && <Ratings p={p} isOurs={isOurs} />}
        {active === 'stats' && <ThisSeason p={p} />}
        {active === 'games' && <Games id={p.id} owner={owner} isOurs={isOurs} />}
        {active === 'history' && (
          <Career id={p.id} owner={owner} isPitcher={isPitcher} isOurs={isOurs} />
        )}
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
  // that had just listed him by name. The book carries his name on every row it
  // has written since ids stopped being names; before that it did not have to,
  // because the id it is filed under was the name. Both are read here, newest
  // mechanism first, and only a man with no notice and no seasons is nameless.
  const name = gone?.name ?? (career.length > 0 ? careerName(id, career) : 'Former player');
  const abbr = gone?.teamAbbr ?? last?.team ?? '';
  const classYear = gone?.classYear ?? last?.classYear ?? '—';
  const drafted = gone?.reason === 'drafted';
  // A walk-on did not graduate and was not drafted — his one season was up.
  // Saying "Graduated" over a freshman who was on the roster for a year is the
  // kind of small lie that makes a player distrust every other line on a card.
  const walkedOn = gone?.reason === 'walk-on';

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
          right={{ k: 'EXIT', v: gone ? (drafted ? 'DRAFT' : walkedOn ? 'W-ON' : 'GRAD') : '—' }}
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
              <Stat k="STATUS" v={gone
                ? (drafted ? 'Drafted' : walkedOn ? 'Walk-on, year up' : 'Graduated')
                : 'Departed'} />
              <Stat k="LAST CLASS" v={classYear in CLASS_NAME
                ? CLASS_NAME[classYear as ClassYear] : classYear} />
              {/* The record book keeps no age, so this is only knowable while
                  the departure notice survives — one offseason. */}
              {gone?.age !== undefined && <Stat k="AGE WHEN HE LEFT" v={String(gone.age)} />}
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
        {active === 'history' && (
          <CareerTable years={career} isPitcher={wasPitcher} />
        )}
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
        font: "800 calc(21px * var(--ts))/0.95 var(--display)", textTransform: 'uppercase',
      }}>{name}</div>

      <div className="label" style={{ marginTop: 4, textAlign: 'center' }}>{sub}</div>

      {school && (
        <div style={{
          marginTop: 3, textAlign: 'center',
          font: "600 calc(10px * var(--ts)) var(--mono)", letterSpacing: '.1em',
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
        marginTop: 1, font: "800 calc(20px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
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
            font: "700 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.08em',
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
        {/*
          Age sits directly under class year because the two together are the
          fact and either alone is misleading. Three years completed or twenty
          one, whichever comes first — so a nineteen-year-old sophomore is safe
          for two more Junes and a twenty-year-old sophomore is not safe at all.
          Read against the June ahead, which is the draft this age decides.
        */}
        <Stat
          k="AGE"
          v={`${p.age}${
            p.classYear !== 'SR' && draftEligible({ classYear: p.classYear, age: p.age + 1 })
              ? ' · eligible in June' : ''}`}
        />
        <Stat k="BATS" v={p.bats === 'S' ? 'Switch' : p.bats === 'L' ? 'Left' : 'Right'} />
        <Stat k="THROWS" v={p.throws === 'L' ? 'Left' : 'Right'} />
        {isPitcher && <Stat k="FASTBALL" v={`${(p as Pitcher).velocity} mph`} />}
        <Stat k="SCHOOL" v={owner.def.school} />
        <Stat k="CONFERENCE" v={owner.conference} last />
      </Panel>
      {isOurs && <Badges p={p} />}
      {!isOurs && (
        <Note>
          He plays for someone else. You can see what he has done and what he can
          do now — how much further he might go, and what he is good at that no
          box score shows, is your rival's problem to know.
        </Note>
      )}
    </>
  );
}

/**
 * His badges, and the room he has left for more.
 *
 * **Your own program only**, which is the opposite of the rule for tendencies
 * and deliberately so. A tendency is a thing you can see from the other dugout —
 * their leadoff man runs, their number three pulls everything — and a badge is
 * something you only know about a man because you have had him in the building.
 *
 * The ceiling is shown beside the count because it is a recruiting fact as much
 * as a roster one: a D-grade recruit can arrive already holding both of the
 * badges he will ever have, which is the same thing his ceiling has been telling
 * you on the board all along.
 */
function Badges({ p }: { p: AnyPlayer }) {
  const held = badgesOf(p);
  const cap = badgeCap(p.potential);
  const byFamily = new Map<BadgeFamily, typeof held>();
  for (const b of held) {
    const fam = BADGES[b.id].family;
    byFamily.set(fam, [...(byFamily.get(fam) ?? []), b]);
  }
  const families: BadgeFamily[] = ['situational', 'physical', 'technical', 'makeup'];

  return (
    <>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginTop: 16, gap: 10,
      }}>
        <div className="label">BADGES</div>
        <div className="label">{held.length} OF {cap}</div>
      </div>
      <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
        {held.length === 0 && <Empty>Nothing yet. They come with what he does.</Empty>}
        {families.filter((f) => byFamily.has(f)).map((fam, i, shown) => (
          <div key={fam} style={{
            padding: '9px 12px',
            borderBottom: i === shown.length - 1 ? 'none' : '1px solid var(--hairline)',
          }}>
            <div className="label">{FAMILY_LABEL[fam]}</div>
            {(byFamily.get(fam) ?? []).map((b) => (
              <div key={b.id} style={{ marginTop: 5 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'baseline', gap: 10,
                }}>
                  <span style={{
                    font: "700 calc(12px * var(--ts)) var(--display)", letterSpacing: '.02em', color: 'var(--clay)',
                  }}>{BADGES[b.id].label}</span>
                  <span className="label" style={{ color: 'var(--dim)' }}>{TIER_NAME[b.tier]}</span>
                </div>
                <div style={{
                  font: "400 calc(10px * var(--ts))/1.4 var(--body)", color: 'var(--dim)', marginTop: 2,
                }}>{BADGES[b.id].note}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function Ratings({ p, isOurs }: { p: AnyPlayer; isOurs: boolean }) {
  const isPitcher = p.type === 'pitcher';
  const glove: Array<[string, string, number]> = isPitcher
    ? PITCHER_GLOVE_BARS.map(([k, l]) => [k, l, (p as Pitcher)[k]])
    : [
      ...HITTER_GLOVE_BARS.map(([k, l]) =>
        [k, l, (p as Hitter)[k]] as [string, string, number]),
      ...(p.pos === 'C'
        ? [[CATCHER_BAR[0], CATCHER_BAR[1], (p as Hitter).blocking] as
            [string, string, number]]
        : []),
    ];

  return (
    <>
      <Head>SCOUTING</Head>
      <BarGroup title={isPitcher ? 'PITCHING' : 'HITTING'}>
        {isPitcher
          ? PITCHER_BARS.map(([key, label]) => (
            <Bar key={key} label={label} value={Math.round((p as Pitcher)[key])} />
          ))
          : HITTER_BARS.map(([key, label]) => (
            <Bar key={key} label={label} value={Math.round((p as Hitter)[key])} />
          ))}
        {isPitcher && (
          <div style={{
            marginTop: 2, paddingTop: 9, borderTop: '1px solid var(--hairline)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <span className="label">FASTBALL</span>
            <span style={{ font: "600 calc(13px * var(--ts)) var(--mono)" }}>
              {(p as Pitcher).velocity} mph
            </span>
          </div>
        )}
      </BarGroup>

      {isPitcher && <Repertoire p={p as Pitcher} />}

      <BarGroup title={isPitcher ? 'FIELDING' : `FIELDING · ${naturalPos(p as Hitter)}`}>
        {glove.map(([key, label, value]) => (
          <Bar key={key} label={label} value={Math.round(value)} />
        ))}
      </BarGroup>

      <Tendencies p={p} isOurs={isOurs} />
    </>
  );
}

/**
 * What he throws, and how often.
 *
 * The usage share is the number worth reading and the reason it is printed
 * rather than described: a man who throws 62% four-seamers and a man who throws
 * 38% of them are different pitchers with the same three ratings, and until
 * there was a repertoire the card could not say so. It is also the data the
 * POWER ARM and JUNKBALLER tendencies are read off, so the bar and the label
 * below it are two views of one fact rather than two facts that might disagree.
 *
 * The speed beside each pitch is derived from his fastball, which the generator
 * already ties to his stuff — so the change of pace on the card agrees with the
 * number in the panel above it.
 */
function Repertoire({ p }: { p: Pitcher }) {
  const rep = repertoireOf(p);
  return (
    <>
      <div className="label" style={{ marginTop: 14, marginBottom: 4 }}>REPERTOIRE</div>
      <div style={{
        padding: '10px 12px 4px',
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {rep.map((o) => (
          <div key={o.id} style={{ marginBottom: 8 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'baseline', marginBottom: 3, gap: 8,
            }}>
              <span className="label">{PITCHES[o.id].name}</span>
              <span style={{ font: "600 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
                {speedOf(p, o.id)} · {Math.round(o.usage * 100)}%
              </span>
            </div>
            <div style={{ height: 5, background: 'rgba(28,36,48,.09)' }}>
              <div style={{
                width: `${Math.round(o.usage * 100)}%`, height: '100%',
                background: PITCHES[o.id].family === 'fastball' ? 'var(--clay)' : 'var(--ink)',
                opacity: PITCHES[o.id].family === 'fastball' ? 1 : 0.55,
              }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * The split, which the engine has always had and never once shown.
 *
 * It lives on the STATS sheet, not RATINGS: vs-RHP and vs-LHP are a production
 * table, and the reader looking for it is the one already reading his line.
 *
 * The arithmetic lives in `platoonSplit` rather than here, so that what the card
 * prints and what the simulation does are the same function — a display that
 * re-derived the split from `platoonSkill` on its own would eventually disagree
 * with `platoonMultiplier` and nobody would find out.
 *
 * A pitcher's is printed as what he *allows*, which is the useful direction from
 * a dugout: the same-handed batter is the one he suppresses.
 */
function Platoon({ p }: { p: AnyPlayer }) {
  const split = platoonSplit(p);
  const switchHitter = p.type === 'hitter' && p.bats === 'S';

  const rows: Array<[string, string, string]> = p.type === 'hitter'
    ? [
      ['CONTACT', String(split.contact?.vsRHP ?? ''), String(split.contact?.vsLHP ?? '')],
      ['POWER', String(split.power?.vsRHP ?? ''), String(split.power?.vsLHP ?? '')],
      ['PRODUCTION', pctSigned(split.vsRHP - 1), pctSigned(split.vsLHP - 1)],
    ]
    : [['ALLOWED', pctSigned(split.vsRHP - 1), pctSigned(split.vsLHP - 1)]];

  return (
    <>
      <div className="label" style={{ marginTop: 14, marginBottom: 4 }}>
        {p.type === 'hitter' ? 'THE SPLIT' : 'THE SPLIT · WHAT HE ALLOWS'}
      </div>
      <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10,
          padding: '7px 12px', borderBottom: '1px solid var(--hairline)',
        }}>
          <span className="label">{switchHitter ? 'SWITCH' : ''}</span>
          <span className="label" style={{ minWidth: 46, textAlign: 'right' }}>VS RHP</span>
          <span className="label" style={{ minWidth: 46, textAlign: 'right' }}>VS LHP</span>
        </div>
        {rows.map(([k, r, l], i) => (
          <div key={k} style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10,
            padding: '8px 12px', alignItems: 'baseline',
            borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--hairline)',
          }}>
            <span className="label">{k}</span>
            <span style={{ font: "600 calc(14px * var(--ts)) var(--mono)", minWidth: 46, textAlign: 'right' }}>{r}</span>
            <span style={{ font: "600 calc(14px * var(--ts)) var(--mono)", minWidth: 46, textAlign: 'right' }}>{l}</span>
          </div>
        ))}
      </div>
      {/*
        Only the panels that would otherwise mislead get a sentence. A pitcher
        with no split prints "+0.0%  +0.0%", which reads as a number the card
        failed to work out unless it says so itself; a switch hitter and a
        reverse split are the two cases where the table means something
        different from what a reader would assume. An ordinary split explains
        itself.
      */}
      {p.type !== 'hitter' && p.platoonSkill === 0 && (
        <Note>No split to speak of. Lefties and righties get the same man.</Note>
      )}
      {p.type === 'hitter' && switchHitter && (
        <Note>He turns around, so the matchup is his against everybody.</Note>
      )}
      {p.type === 'hitter' && !switchHitter && p.platoonSkill < 0 && (
        <Note>A reverse split. Better against his own hand, which is rare and real.</Note>
      )}
    </>
  );
}

const pctSigned = (v: number): string => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

/**
 * What he does, as against how well he does it — and how much of it you have
 * seen yet.
 *
 * **On your own men a tendency is not visible until you have watched enough of
 * him**, which is the mechanic rather than a display rule: the bar under an
 * unknown reading is the evidence accumulating, and it fills from ordinary
 * play, simulated games included. On somebody else's player they are all
 * visible immediately, because a scouting report saying their leadoff man runs
 * is exactly what a defensive setting is for.
 *
 * A slot he is ordinary in is printed as such rather than hidden. "Nothing
 * unusual" is a real answer about a player and leaving the row out would make
 * an ordinary man look like an unfinished one.
 */
function Tendencies({ p, isOurs }: { p: AnyPlayer; isOurs: boolean }) {
  const season = useDynasty((s) => s.season);
  const watch = isOurs ? season?.watch?.get(p.id) : undefined;
  const slots = p.type === 'hitter' ? HITTER_TENDENCIES : PITCHER_TENDENCIES;

  return (
    <>
      <div className="label" style={{ marginTop: 14, marginBottom: 4 }}>TENDENCIES</div>
      <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
        {slots.map((slot, i) => {
          const spec = TENDENCIES[slot];
          const known = isKnown(slot, watch, isOurs);
          const label = known ? tendencyLabel(p, slot) : null;
          const progress = watchProgress(slot, watch);
          const last = i === slots.length - 1;
          return (
            <div key={slot} style={{
              padding: '9px 12px',
              borderBottom: last ? 'none' : '1px solid var(--hairline)',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline', gap: 10,
              }}>
                <span style={{
                  font: "600 calc(12px * var(--ts)) var(--display)", letterSpacing: '.02em',
                  color: known && label ? 'var(--clay)' : 'var(--dim)',
                }}>
                  {known ? (label ?? 'NOTHING UNUSUAL') : 'STILL WATCHING'}
                </span>
                <span className="label">{SLOT_WORD[slot]}</span>
              </div>
              {known && label && (
                <div style={{
                  font: "400 calc(10px * var(--ts))/1.4 var(--body)", color: 'var(--dim)', marginTop: 3,
                }}>
                  {(tendenciesOf(p)[slot] ?? 0) > 0 ? spec.plusNote : spec.minusNote}
                </div>
              )}
              {!known && (
                <div style={{ height: 4, background: 'rgba(28,36,48,.09)', marginTop: 6 }}>
                  <div style={{
                    width: `${Math.round(progress * 100)}%`, height: '100%',
                    background: 'var(--ink)', opacity: 0.35,
                  }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** What each slot is a reading *about*, in two or three words. */
const SLOT_WORD: Record<TendencyId, string> = {
  approach: 'AT THE PLATE',
  firstPitch: 'FIRST PITCH',
  running: 'ON THE BASES',
  spray: 'SPRAY',
  clutch: 'WITH MEN ON',
  zone: 'IN THE ZONE',
  pace: 'PACE',
  mix: 'PITCH MIX',
  poise: 'WITH MEN ON',
};

/** One headed block of bars. Two of these are the whole Ratings tab. */
function BarGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="label" style={{ marginTop: 14, marginBottom: 4 }}>{title}</div>
      <div style={{
        padding: '12px 12px 6px',
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>{children}</div>
    </>
  );
}

function ThisSeason({ p }: { p: AnyPlayer }) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  const id = p.id;
  const isPitcher = p.type === 'pitcher';
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
      <InJune p={p} />
      <Platoon p={p} />
      <Fielding p={p} />
    </>
  );
}

/**
 * What he has done when it mattered.
 *
 * Season totals in this game include tournament play, so June cannot be got by
 * subtracting one book from another — it is counted a second time in its own,
 * and carried down a career on `CareerTotals.post`. This is the only place a
 * *player's* postseason shows up: the leaderboard on the stats screen answers
 * "who hit best in the tournament", and this answers "what did he do in his".
 *
 * Absent entirely for a man who has never played a postseason game, which is
 * most of a roster in February. A panel of dashes is not information.
 */
function InJune({ p }: { p: AnyPlayer }) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  const isPitcher = p.type === 'pitcher';

  // This June, and the whole career including it. The career row is written at
  // the board meeting, so during a postseason it is still last year's total —
  // the two are shown separately rather than added, which would double-count.
  const bat = season?.postBatting?.get(p.id);
  const pit = season?.postPitching?.get(p.id);
  const career = season?.careerTotals?.get(p.id)?.post;

  const playedNow = isPitcher ? (pit?.g ?? 0) > 0 : (bat?.g ?? 0) > 0;
  const playedEver = (career?.y ?? 0) > 0;
  if (!playedNow && !playedEver) return null;

  const tournaments = (career?.y ?? 0) + (playedNow ? 1 : 0);

  return (
    <>
      <Head>IN JUNE</Head>
      <Panel>
        {playedNow && (isPitcher
          ? pit && pit.outs > 0 && (
            <>
              <Stat k="THIS JUNE" v={`${pit.w}-${pit.l}`} />
              <Stat k="ERA" v={era(pit).toFixed(2)} />
              <Stat k="INNINGS" v={inningsPitched(pit).toFixed(1)} />
              <Stat k="STRIKEOUTS" v={String(pit.k)} last />
            </>
          )
          : bat && bat.ab > 0 && (
            <>
              <Stat k="THIS JUNE" v={pct(battingAverage(bat))} />
              <Stat k="HITS" v={`${bat.h}-for-${bat.ab}`} />
              <Stat k="HOME RUNS" v={String(bat.hr)} />
              <Stat k="RUNS BATTED IN" v={String(bat.rbi)} last />
            </>
          ))}
        {career && career.y > 0 && (isPitcher
          ? career.outs > 0 && (
            <>
              <Stat k="CAREER" v={`${career.w}-${career.l}`} />
              <Stat k="CAREER ERA" v={((career.er * 27) / career.outs).toFixed(2)} />
              <Stat k="CAREER K" v={String(career.k)} last />
            </>
          )
          : career.ab > 0 && (
            <>
              <Stat k="CAREER" v={pct(career.h / career.ab)} />
              <Stat k="CAREER HITS" v={`${career.h}-for-${career.ab}`} />
              <Stat k="CAREER HR" v={String(career.hr)} last />
            </>
          ))}
        <div style={{
          padding: '7px 10px', borderTop: '1px solid var(--hairline)',
          font: "400 calc(10.5px * var(--ts))/1.4 var(--body)", color: 'var(--dim)',
        }}>
          {tournaments === 1
            ? 'One postseason.'
            : `${tournaments} postseasons.`}
        </div>
      </Panel>
    </>
  );
}

/**
 * The glove's half of the season, and the one number on this card that cannot be
 * printed on its own.
 *
 * Plays above average is a redistribution against a fielder's own teammates, and
 * an error is a play not made — so the league itself sits *below* zero, at about
 * one play a game per team. A bare "−3" next to every man in the country would
 * tell nine players out of ten that they are bad defenders, which is not what the
 * number says. What it says is where he stands among the other gloves, so that is
 * what the card leads with: his rate per hundred chances, the league's own rate
 * beside it in the same units, and his rank among everyone who has fielded
 * enough to be ranked. Zero is not the comparison and the screen never implies
 * it is.
 */
function Fielding({ p }: { p: AnyPlayer }) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  if (!season) return null;

  const fld = season.fielding?.get(p.id);
  if (!fld || fld.chances === 0) return null;

  const ctx = fieldingContext(season, p.id);
  const pae = playsAboveExpected(fld);
  const signed = `${pae > 0 ? '+' : ''}${pae}`;
  const rate = (v: number): string => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
  const catcher = p.type === 'hitter' && p.pos === 'C';
  const attempts = fld.sba + fld.cs;

  return (
    <>
      <div className="label" style={{ marginTop: 16, marginBottom: 4 }}>IN THE FIELD</div>

      <div style={{
        display: 'flex', border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {/* The rate leads, not the count: it is the figure that survives being
            compared with a man at another position, and the one the league line
            underneath is quoted in. Accented when he beats that line rather than
            when he clears zero, because zero is not the bar. */}
        <Tile
          k="PER 100 CHANCES"
          v={ctx ? rate(ctx.rate) : '—'}
          accent={!!ctx && ctx.rate > ctx.leagueRate}
        />
        <Tile
          k="AMONG GLOVES"
          v={ctx && ctx.ranked ? `${ordinal(ctx.rank)}/${ctx.qualified}` : '—'}
          last
        />
      </div>

      <Panel>
        {ctx && <Stat k="LEAGUE AVERAGE" v={`${rate(ctx.leagueRate)} per 100`} />}
        <Stat k="PLAYS ABOVE AVERAGE" v={signed} />
        <Stat k="CHANCES" v={String(fld.chances)} />
        <Stat k="PLAYS MADE" v={String(fld.plays)} />
        <Stat
          k="ERRORS"
          v={fld.throwing > 0 ? `${fld.errors} (${fld.throwing} throwing)` : String(fld.errors)}
        />
        <Stat k="FIELDING PCT" v={pct(fieldingPct(fld))} last={!catcher} />
        {catcher && (
          <>
            {/* The engine has no pitch location, so a ball in the dirt and a
                ball he missed are one event to it — and one event to the runner,
                who moves up either way. Labelled as both rather than claiming a
                distinction the simulation cannot make. */}
            <Stat k="PASSED BALLS / WP" v={String(fld.pb)} />
            <Stat
              k="RUNNERS CAUGHT"
              v={attempts === 0 ? 'none ran' : `${fld.cs} of ${attempts}`}
            />
            <Stat
              k="CAUGHT STEALING PCT"
              v={attempts === 0 ? '—' : pct(fld.cs / attempts)}
              last
            />
          </>
        )}
      </Panel>

      <Note>
        Plays above average is outs an average glove would not have made, errors
        already off. Read the gap to the league line, not the sign.
      </Note>
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
              <span style={{ font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
                {seasonDate(year, r.day)} · {r.home ? 'vs' : '@'} {r.opponent}
              </span>
              <span style={{
                font: "600 calc(10px * var(--ts)) var(--mono)", textAlign: 'right',
                color: r.won ? 'var(--win)' : 'var(--loss)',
              }}>{r.won ? 'W' : 'L'} {r.us}-{r.them}</span>
              <span style={{
                gridColumn: '1 / -1', marginTop: 2, font: "400 calc(12px * var(--ts)) var(--body)",
              }}>
                <span style={{
                  font: "600 calc(9px * var(--ts)) var(--mono)", color: 'var(--dim)', marginRight: 7,
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
 * same reason the box scores are: keeping every line for all ninety six schools
 * would put tens of thousands of rows through every autosave.
 *
 * The country's *career totals* are kept, since B13, and this is not them. A
 * total is one row per man that is thrown away the year after he leaves; this is
 * the season by season table, which is the only thing that can show a man
 * developing and is therefore the expensive one. See §13.6.
 */
function Career(
  { id, owner, isPitcher, isOurs }:
  { id: PlayerId; owner: Owner; isPitcher: boolean; isOurs: boolean },
) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  const archived = season?.careers?.[id] ?? [];

  if (!isOurs && archived.length === 0) {
    return (
      <>
        <Head>COLLEGE CAREER</Head>
        <Panel><Empty>The record book is kept for your own program only.</Empty></Panel>
      </>
    );
  }

  /*
    The year he is playing, stacked under the years he has played.

    The archive is written in June, so between February and the draft step the
    season in front of the player is in `season.batting` and nowhere else — and
    this table read the archive alone. Reported as "after two seasons only one
    year shows, and the numbers do not update in real time", which is one
    defect seen from two angles: a sophomore in May had his freshman row and no
    second one, and nothing on the tab moved when he went four for four.

    The live row is the same row `archiveSeason` will write in June, computed by
    the same function, and it is marked as unfinished rather than presented as
    a result. Filtered rather than concatenated blindly, because between the
    draft step and the year roll the archive already holds this year and the two
    would print twice.
  */
  const live = isOurs && season ? liveCareerYear(season, owner.index, id) : null;
  const years = live
    ? [...archived.filter((y) => y.year !== live.year), live]
    : archived;

  return (
    <>
      <Head>COLLEGE CAREER</Head>
      <CareerTable years={years} isPitcher={isPitcher} live={live?.year} />
      {live && (
        <Note>
          The bottom row is the season in progress. It goes into the book in
          June, with whatever it says on the last day.
        </Note>
      )}
    </>
  );
}

/*
  One table, glove included.

  The fielding years used to sit in a second "IN THE FIELD" table below this
  one, and it was answering a question nobody had split: fielding is part of
  the season, not a separate career. Reported from testing in exactly those
  words. Errors are the column that survives the merge — chances and plays are
  bookkeeping, and a seventh column is all a 360 pixel phone will give.
*/
function CareerTable(
  { years, isPitcher, live }: { years: CareerYear[]; isPitcher: boolean; live?: number },
) {
  const cols = isPitcher
    ? '38px 26px 1fr 42px 38px 32px 24px'
    : '38px 26px 1fr 42px 30px 34px 24px';

  if (years.length === 0) {
    return <Panel><Empty>Nothing yet. He has not been in a game.</Empty></Panel>;
  }

  return (
    <div style={{
      marginTop: 8, border: '1px solid var(--faint)', background: 'var(--paper)',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: cols,
        gap: 5, padding: '6px 10px', borderBottom: '1px solid var(--hairline)',
      }}>
        {(isPitcher
          ? ['YEAR', 'CL', 'TEAM', 'W-L', 'ERA', 'K', 'E']
          : ['YEAR', 'CL', 'TEAM', 'AVG', 'HR', 'RBI', 'E']
        ).map((h) => <span key={h} className="label">{h}</span>)}
      </div>
      {years.map((y) => (
        <div key={y.year} style={{
          display: 'grid', gridTemplateColumns: cols,
          gap: 5, alignItems: 'baseline',
          padding: '7px 10px', borderBottom: '1px solid var(--hairline)',
        }}>
          <span style={{
            font: "700 calc(12px * var(--ts)) var(--display)",
            color: y.year === live ? 'var(--clay)' : 'var(--ink)',
          }}>{y.year}</span>
          <span style={{ font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>{y.classYear}</span>
          <span style={{ font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>{y.team}</span>
          {isPitcher ? (
            <>
              <span style={{ font: "500 calc(11px * var(--ts)) var(--mono)" }}>{y.w ?? 0}-{y.l ?? 0}</span>
              <span style={{ font: "500 calc(11px * var(--ts)) var(--mono)" }}>
                {y.outs ? ((y.er ?? 0) * 27 / y.outs).toFixed(2) : '—'}
              </span>
              <span style={{ font: "500 calc(11px * var(--ts)) var(--mono)" }}>{y.k ?? 0}</span>
            </>
          ) : (
            <>
              <span style={{ font: "500 calc(11px * var(--ts)) var(--mono)" }}>
                {y.ab ? pct((y.h ?? 0) / y.ab) : '—'}
              </span>
              <span style={{ font: "500 calc(11px * var(--ts)) var(--mono)" }}>{y.hr ?? 0}</span>
              <span style={{ font: "500 calc(11px * var(--ts)) var(--mono)" }}>{y.rbi ?? 0}</span>
            </>
          )}
          <span style={{ font: "500 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
            {(y.chances ?? 0) > 0 ? (y.errors ?? 0) : '—'}
          </span>
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
        marginTop: 8, font: "400 calc(12px * var(--ts))/1.6 var(--body)", color: 'var(--dim)',
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
    <div style={{ marginTop: 8, font: "400 calc(11px * var(--ts))/1.5 var(--body)", color: 'var(--dim)' }}>
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: '12px', font: "400 calc(12px * var(--ts))/1.5 var(--body)", color: 'var(--dim)' }}>
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
        font: "700 calc(24px * var(--ts))/1 var(--display)", marginTop: 2,
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
      <span style={{ font: "600 calc(14px * var(--ts)) var(--mono)", textAlign: 'right' }}>{v}</span>
    </div>
  );
}

/** "14th", for a rank that has to fit in a tile. */
const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? 'th');
};

/** A rating, drawn against the full scale so the shape of a player is readable. */
function Bar({ label, value }: { label: string; value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: 4,
      }}>
        <span className="label">{label}</span>
        <span style={{ font: "600 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>{value}</span>
      </div>
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
