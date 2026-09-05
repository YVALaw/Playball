// Player.tsx
// One player's card, in tabs.
//
// Everything the game knows about a man used to be one column: the face, the
// ratings, this year's line, and every year before it, stacked. That reads
// fine on the freshman who has played four games and badly on the senior who
// has four seasons and thirty box scores behind him — the ratings you opened
// the card for end up two screens above the thing you scrolled to.
//
// So the card is now a header that never moves and four tabs under it. Who he
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

import { useEffect, useState, type ReactNode } from 'react';
import { RosterMoves } from './RosterMoves.js';
import { seasonAwards } from '../../engine/postseason.js';
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
import { draftChance } from '../../engine/progression.js';
import { expectationOf, flightRisk, mood, promiseOf, squadRanks } from '../../engine/morale.js';
import { available } from '../../engine/depthChart.js';
import { isHurt } from '../../engine/injury.js';
import { overallOf, platoonSplit, naturalPos } from '../../engine/ratings.js';
import { secondaryPositions } from '../../engine/positions.js';
import { Avatar, teamColour } from '../Avatar.js';
import { SewingPinIcon } from '@radix-ui/react-icons';
import { captainOf } from '../../engine/captains.js';
import { handles } from '../../state/depth.js';
import { proCareer, type AlumnusNote, type Moment } from '../../engine/legacy.js';
import {
  CaptainC, DataTable, FieldNote, Metric, ModuleIntro, SectionHeading, Segmented,
} from '../components/Kit.js';
import {
  battingAverage, onBase, slugging, era, whip, inningsPitched,
  fieldingPct, playsAboveExpected, fieldingContext, careerName, liveCareerYear,
  seasonComplete, injuryClock,
} from '../../engine/season.js';
import type { BoxScore, CareerYear, SeasonState } from '../../engine/season.js';
import type { Departure } from '../../engine/progression.js';
import { pct, seasonDate } from '../format.js';
import { isTwoWay } from '../../engine/types.js';
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

type Sheet = 'overview' | 'ratings' | 'stats' | 'legacy';

const SHEET_LABEL: Record<Sheet, string> = {
  overview: 'OVERVIEW',
  ratings: 'RATINGS',
  // "STATISTICS" is the honest word and it is two characters too many: five
  // labels have to hold on a 360 pixel phone without shrinking below the size
  // the rest of the app uses for a tab.
  stats: 'STATS',
  legacy: 'LEGACY',
};

const LIVE_SHEETS: Sheet[] = ['overview', 'ratings', 'stats', 'legacy'];

/**
 * A man who has left, with no ratings to show.
 *
 * There is nothing left to scout — he is not on a roster, so there is no rating
 * to read and no current season to have a line in. What survives him is the
 * record book.
 */
const ALUMNI_SHEETS: Sheet[] = ['overview', 'legacy'];

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
  /** A two-way man's card asks for one half; everybody else takes both. */
  half?: 'bat' | 'arm',
): GameLogRow[] {
  const rows: GameLogRow[] = [];
  for (const box of Object.values(season.boxScores ?? {})) {
    const home = box.home === teamIndex;
    if (!home && box.away !== teamIndex) continue;

    const batting = home ? box.homeBatting : box.awayBatting;
    const pitching = home ? box.homePitching : box.awayPitching;
    const pool = half === 'arm' ? pitching : half === 'bat' ? batting
      : [...batting, ...pitching];
    const line = pool.find((l) => l.id === id);
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
  const playerCardSection = useDynasty((s) => s.playerCardSection);
  const report = useDynasty((s) => s.lastOffseason);
  const alumni = useDynasty((s) => s.alumni);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const [sheet, setSheet] = useState<Sheet>(playerCardSection);
  const [half, setHalf] = useState<'bat' | 'arm'>('bat');
  void version;

  useEffect(() => {
    setSheet(playerCardSection);
  }, [selected, playerCardSection]);

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
    const note = alumni[selected];
    if (!gone && career.length === 0 && !note) return <Nobody />;
    return <Alumnus id={selected} gone={gone} note={note} career={career} sheet={sheet} onSheet={setSheet} />;
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
  const slot = isTwoWay(p)
    ? `TWO-WAY · ${(p as unknown as Pitcher).role} · ${naturalPos(p as Hitter)}`
    : isPitcher ? (p as Pitcher).role : naturalPos(p as Hitter);
  const dhToday = !isPitcher && p.pos === 'DH';

  // A tab that is not on offer must never be the one on screen. Cheap insurance
  // against a card that reopens on a tab the next man does not have.
  const active = LIVE_SHEETS.includes(sheet) ? sheet : 'overview';

  return (
    <main className="profile-workspace">
      <PlayerHero
        p={p}
        owner={owner}
        isOurs={isOurs}
        ovr={ovr}
        slot={slot}
        dhToday={dhToday}
      />
      <Segmented<Sheet>
        label="Player card section"
        value={active}
        onChange={setSheet}
        options={LIVE_SHEETS.map((k) => ({ value: k, label: SHEET_LABEL[k] }))}
      />
      {active === 'overview' && <Overview p={p} owner={owner} isOurs={isOurs} />}
      {active === 'ratings' && <Ratings p={p} isOurs={isOurs} ownerIndex={owner.index} />}
      {/* Rearranged by request: "remove the box where it says the current
          year stats and instead put them in overview; in stats we will only
          keep the season by season, and one season by season as well but to
          record the june stats." */}
      {isTwoWay(p) && active === 'stats' && (
        <Segmented<'bat' | 'arm'>
          label="Which half of his game"
          value={half}
          onChange={setHalf}
          options={[
            { value: 'bat' as const, label: 'Batting' },
            { value: 'arm' as const, label: 'Pitching' },
          ]}
        />
      )}
      {active === 'stats' && (
        <>
          <SeasonsUnder p={p} owner={owner} isOurs={isOurs} half={half} />
          <JuneByYear p={p} owner={owner} isOurs={isOurs} half={half} />
          <Games
            id={p.id}
            owner={owner}
            isOurs={isOurs}
            half={isTwoWay(p) ? half : undefined}
          />
        </>
      )}
      {active === 'legacy' && (
        <Career id={p.id} owner={owner} isPitcher={isPitcher} isOurs={isOurs} />
      )}

      {/* The classroom, where else he plays, the rest and the redshirt — behind
          one button in the corner, floating over whichever tab you are on
          rather than buried under the ratings on one of them. Only ever for
          your own men; it renders nothing for anybody else. */}
      <RosterMoves p={p} isOurs={isOurs} />
    </main>
  );
}

/**
 * The face, full bleed, with his name across the bottom of it.
 *
 * The proposal runs a photograph edge to edge at 264 pixels and lays the
 * identity over a wash. There is no photograph here and there never will be —
 * `Avatar` draws him from his own id, so the same man is recognisable on the
 * recruiting board, on this card, and in the draft results four years later.
 * The portrait sits on the dark green the wash was there to create, at the size
 * the hero was designed around.
 *
 * The overall sits in its own box top right, exactly where the proposal puts
 * it. Potential rides under it for your own men only: it is the one number a
 * rival coach genuinely cannot know, and a card that printed it for everybody
 * would be scouting the whole country for free.
 */
function PlayerHero(
  { p, owner, isOurs, ovr, slot, dhToday }:
  {
    p: AnyPlayer; owner: Owner; isOurs: boolean;
    ovr: number; slot: string; dhToday: boolean;
  },
) {
  const isPitcher = p.type === 'pitcher';
  return (
    <section className="player-hero">
      <div className="player-hero-face">
        <Avatar id={p.id} team={owner.def.abbr} size={168} />
      </div>
      <div className="hero-wash" />
      <div className="player-identity">
        <small>{owner.def.school.toUpperCase()} · {owner.conference}</small>
        <h2>{p.name.split(' ').map((part, i) => <span key={`${part}-${i}`}>{part}</span>)}</h2>
        <p>
          {captainOf(owner.team)?.id === p.id && <CaptainC />}
          {slot} · {CLASS_NAME[p.classYear]} · AGE {p.age} · {p.bats}/{p.throws}
          {isPitcher && (p as Pitcher).sidearm ? ' · SIDEARM' : ''}
          {dhToday ? ' · BATS AS DH' : ''}
        </p>
      </div>
      <div className="player-ovr">
        <small>OVR</small>
        <strong>{ovr}</strong>
      </div>
      {/* Potential, for your own program only. The gap between this and the
          overall is the whole of a development game, and it is the one thing a
          rival's card withholds. */}
      {isOurs && (
        <div className="player-ovr player-pot">
          <small>POT</small>
          <strong>{potentialGrade(p.potential)}</strong>
        </div>
      )}
    </section>
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
  { id, gone, note, career, sheet, onSheet }:
  {
    id: PlayerId;
    gone: Departure | undefined;
    note: AlumnusNote | undefined;
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
  const name = gone?.name ?? note?.name ?? (career.length > 0 ? careerName(id, career) : 'Former player');
  const abbr = gone?.teamAbbr ?? note?.teamAbbr ?? last?.team ?? '';
  const classYear = gone?.classYear ?? note?.classYear ?? last?.classYear ?? '—';
  const drafted = (gone?.reason ?? note?.reason) === 'drafted';
  // A walk-on did not graduate and was not drafted — his one season was up.
  // Saying "Graduated" over a freshman who was on the roster for a year is the
  // kind of small lie that makes a player distrust every other line on a card.
  const walkedOn = (gone?.reason ?? note?.reason) === 'walk-on';

  // The record book knows what he was without knowing what position he played:
  // a career line carries at bats or innings, so the shape of his years is the
  // only thing left to decide the table by.
  const wasPitcher = career.some((y) => (y.outs ?? 0) > 0) || !career.some((y) => (y.ab ?? 0) > 0);
  const active = ALUMNI_SHEETS.includes(sheet) ? sheet : 'overview';

  return (
    <main className="profile-workspace">
      {/* No hero. There is no rating left to draw a face against and no team
          colour to draw it in — the departure notice is what is left of him,
          so the card opens with that rather than with an empty portrait. */}
      <ModuleIntro
        kicker={`FORMER PLAYER${abbr ? ` · ${abbr}` : ''}`}
        title={name}
        text="What the game keeps of him now is the record book."
      />
      <Segmented
        label="Player card section"
        value={active}
        onChange={onSheet}
        options={ALUMNI_SHEETS.map((k) => ({ value: k, label: SHEET_LABEL[k] }))}
      />
      {active === 'overview' && (
        <Panel>
          <Stat k="STATUS" v={(gone || note)
            ? (drafted ? 'Drafted' : walkedOn ? 'Walk-on, year up' : 'Graduated')
            : 'Departed'} />
          <Stat k="LAST CLASS" v={classYear in CLASS_NAME
            ? CLASS_NAME[classYear as ClassYear] : classYear} />
          {/* The record book keeps no age, so this is only knowable while
              the departure notice survives — one offseason. */}
          {gone?.age !== undefined && <Stat k="AGE WHEN HE LEFT" v={String(gone.age)} />}
          {abbr && <Stat k="PROGRAM" v={abbr} />}
          {drafted && (gone?.round ?? note?.round) !== undefined && (
            <Stat k="DRAFT ROUND" v={`Round ${gone?.round ?? note?.round}`} />
          )}
          {(gone?.overall ?? note?.overall) !== undefined && (
            <Stat k="OVERALL WHEN HE LEFT" v={String(gone?.overall ?? note?.overall)} />
          )}
          <Stat k="SEASONS ON RECORD" v={String(career.length)} last />
        </Panel>
      )}
      {active === 'overview' && <ProYears id={id} />}
      {active === 'overview' && <SignatureMoments id={id} />}
      {/* The alumnus keeps the same timeline his card had, because the years
          are the only thing left of him. `Career` is passed his archive
          directly: he is on nobody's roster, so there is no live row and no
          owner to look one up against. */}
      {active === 'legacy' && (
        <AlumnusYears years={career} isPitcher={wasPitcher} />
      )}
    </main>
  );
}

/**
 * What happened next — stage 13. The professional game, derived year by year
 * from the one note the save keeps of a departed man. Nothing here for a man
 * who left before the book existed: the note is written the June he leaves.
 */
function ProYears({ id }: { id: string }) {
  const alumni = useDynasty((s) => s.alumni);
  const year = useDynasty((s) => s.year);
  const note = alumni[id];
  if (!note) return null;
  const rows = proCareer(id, note, year);
  if (rows.length === 0) return null;
  const over = rows.some((r) => r.final);
  return (
    <>
      <SectionHeading
        kicker="THE PROFESSIONAL GAME"
        title={note.reason === 'drafted'
          ? `Round ${note.round ?? '?'}, ${note.year}`
          : 'After the last game'}
      />
      <section className="timeline moment-timeline">
        {rows.map((r) => (
          <div key={r.year}>
            <b>{r.year}</b>
            <span>
              <em className="pro-level">{r.level}</em>
              {' '}{r.line}
            </span>
          </div>
        ))}
      </section>
      {!over && note.reason === 'drafted' && (
        <FieldNote
          title="Still playing"
          text="The pros have him now. The book adds a line every June."
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

// CardHead went with the header it drew: a face between two facts, a centred
// name, and two tiles. The proposal puts all of that in the hero, where the
// face is the background rather than a 72 pixel circle between two labels.


// TabStrip went with the shell it belonged to: the card's five tabs and the
// ratings' three are both `Segmented` now, which is the proposal's one control
// for this and the same one every other screen uses.

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

/**
 * Who he is, before any of the numbers.
 *
 * The proposal's overview, in three pieces: a sentence about him with three
 * headline figures under it, his badges as chips, and the three facts a coach
 * checks before he checks anything else. Everything the old information panel
 * carried is still here — it has stopped being a list of nine label/value rows
 * and become the shape a card actually reads in.
 */
function Overview({ p, owner, isOurs }: { p: AnyPlayer; owner: Owner; isOurs: boolean }) {
  const season = useDynasty((s) => s.season);
  const isPitcher = p.type === 'pitcher';
  const inJune = { classYear: p.classYear, age: p.age + 1 };
  const eligible = p.classYear !== 'SR' && draftEligible(inJune);
  const odds = eligible ? draftChance(overallOf(p)) : null;
  const draftWord = p.classYear === 'SR' ? 'Graduating'
    : odds === null ? 'Not eligible'
      : odds >= 0.7 ? 'Likely gone'
        : odds >= 0.35 ? 'At risk'
          : odds >= 0.12 ? 'Outside shot' : 'Safe';

  const day = season ? injuryClock(season) : 0;
  const redshirt = Boolean((p as AnyPlayer & { redshirt?: boolean }).redshirt);
  const why = (p as AnyPlayer & { why?: string }).why;
  const health = redshirt ? 'Redshirted'
    : available(p, day) ? 'Available'
      : isHurt(p, day) ? 'Injured'
        : why === 'academic' ? 'Academic hold' : 'Resting';

  const ranks = squadRanks(owner.team);
  const rank = ranks.get(p.id) ?? 20;
  const feeling = mood(p);
  const expectation = promiseOf(p, rank)
    .replace('expects to ', '')
    .replace('is here to ', '');
  const starts = (p as AnyPlayer & { starts?: number }).starts ?? 0;
  const expectedShare = expectationOf(p, rank);
  const actualShare = owner.gp > 0 ? starts / owner.gp : 0;
  const buried = Math.max(0, expectedShare - actualShare);
  const moodRisk = flightRisk(p);
  const portalWord = p.classYear === 'SR' ? 'Not eligible'
    : moodRisk >= 0.4 || buried >= 0.4 ? 'High'
      : moodRisk > 0 || buried >= 0.25 ? 'Watch' : 'Low';

  const secondaries = !isPitcher ? secondaryPositions(p as Hitter).slice(0, 3) : [];

  return (
    <>
      {isOurs ? (
        <section className="player-status-grid" aria-label="Current player status">
          <div>
            <small>AVAILABILITY</small>
            <strong>{health}</strong>
            <span>{redshirt ? 'Season preserved' : available(p, day) ? 'Ready to play' : 'Needs attention'}</span>
          </div>
          <div>
            <small>MOOD</small>
            <strong>{feeling.charAt(0).toUpperCase() + feeling.slice(1)}</strong>
            <span>{expectation}</span>
          </div>
          <div>
            <small>DRAFT WATCH</small>
            <strong>{draftWord}</strong>
            <span>{eligible ? 'June eligibility' : p.classYear === 'SR' ? 'Final college season' : 'No exposure this June'}</span>
          </div>
          <div className={portalWord === 'High' ? 'is-alert' : ''}>
            <small>PORTAL RISK</small>
            <strong>{portalWord}</strong>
            <span>{p.classYear === 'SR' ? 'Graduates instead' : buried >= 0.25 ? 'Playing time matters' : 'No warning signs'}</span>
          </div>
        </section>
      ) : (
        <section className="player-status-grid compact" aria-label="Public player status">
          <div>
            <small>DRAFT WATCH</small>
            <strong>{draftWord}</strong>
            <span>{eligible ? 'Eligible this June' : 'Not exposed this June'}</span>
          </div>
          <div>
            <small>{isPitcher ? 'FASTBALL' : 'BATS'}</small>
            <strong>{isPitcher ? `${(p as Pitcher).velocity} mph` : p.bats === 'S' ? 'Switch' : p.bats === 'L' ? 'Left' : 'Right'}</strong>
            <span>Public scouting info</span>
          </div>
        </section>
      )}

      {secondaries.length > 0 && (
        <p className="player-secondary-line"><b>ALSO PLAYS</b> {secondaries.join(' · ')}</p>
      )}

      {isOurs ? <BadgeChips p={p} /> : (
        <Note>
          Production is public. Potential, mood and role promises stay inside his program.
        </Note>
      )}

      <ThisSeason p={p} />
    </>
  );
}

/**
 * His badges, as chips.
 *
 * **Your own program only**, which is the opposite of the rule for tendencies
 * and deliberately so. A tendency is a thing you can see from the other dugout —
 * their leadoff man runs, their number three pulls everything — and a badge is
 * something you only know about a man because you have had him in the building.
 *
 * The proposal draws three flat chips. These carry the tier in the chip, because
 * a bronze and a gold of the same badge are genuinely different players, and the
 * family headings the old list grouped by are gone: four sub-headings above nine
 * chips is a filing system for something you read in one glance.
 *
 * The ceiling is printed beside the count because it is a recruiting fact as
 * much as a roster one: a D-grade recruit can arrive already holding both of the
 * badges he will ever have, which is what his ceiling has been telling you on
 * the board all along.
 */
function BadgeChips({ p }: { p: AnyPlayer }) {
  const held = badgesOf(p);
  const cap = badgeCap(p.potential);
  if (held.length === 0) {
    return (
      <Note>
        No badges yet. They come with what he does, and he has room for {cap}.
      </Note>
    );
  }
  return (
    <>
      <div className="flow-section-title">
        <span className="label">BADGES</span>
        <b>{held.length} OF {cap}</b>
      </div>
      <section className="player-badges">
        {held.map((b) => (
          <span key={b.id} title={BADGES[b.id].note}>
            {BADGES[b.id].label} · {TIER_NAME[b.tier]}
          </span>
        ))}
      </section>
    </>
  );
}


/** A production delta, signed, so a reverse split reads as one. */
const pctSigned = (v: number): string => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

type RatingsView = 'tools' | 'splits' | 'tendencies';

/**
 * What he can do, behind the proposal's three sub-tabs.
 *
 * Tools, splits, tendencies — one screenful each, rather than four panels
 * stacked into a scroll nobody reaches the bottom of. A pitcher's first tab is
 * his arsenal, because what he throws is the first question about him and his
 * ratings are the second.
 *
 * The split moved here from the stats sheet. It reads as production and it was
 * filed with production, but it is a property of the man rather than of the
 * season — a freshman who has never batted still has one — and the reader
 * looking for it is the one already asking what he is.
 */
function Ratings(
  { p, isOurs, ownerIndex }: { p: AnyPlayer; isOurs: boolean; ownerIndex: number },
) {
  const isPitcher = p.type === 'pitcher';
  const [view, setView] = useState<RatingsView>('tools');

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
      <Segmented<RatingsView>
        label="Ratings detail"
        value={view}
        onChange={setView}
        options={[
          { value: 'tools', label: isPitcher ? 'Arsenal' : 'Tools' },
          { value: 'splits', label: 'Splits' },
          { value: 'tendencies', label: 'Tendencies' },
        ]}
      />

      {view === 'tools' && (
        <>
          {isPitcher && <Repertoire p={p as Pitcher} />}

          <SectionHeading
            kicker={isPitcher ? 'ON THE MOUND' : 'AT THE PLATE'}
            title={isPitcher ? 'What he is made of' : 'The tools'}
          />
          <section className="tool-table">
            {isPitcher
              ? PITCHER_BARS.map(([key, label]) => (
                <Bar key={key} label={label} value={Math.round((p as Pitcher)[key])} />
              ))
              : HITTER_BARS.map(([key, label]) => (
                <Bar key={key} label={label} value={Math.round((p as Hitter)[key])} />
              ))}
          </section>

          {/* The other half of the rare man: his arm, under his bat, with
              the same bars a pitcher's card uses — one body, two jobs. */}
          {isTwoWay(p) && (
            <>
              <Repertoire p={p as never} />
              <SectionHeading kicker="AND ON THE MOUND" title="The arm he also brings" />
              <section className="tool-table">
                {PITCHER_BARS.map(([key, label]) => (
                  <Bar key={key} label={label} value={Math.round(p[key])} />
                ))}
              </section>
            </>
          )}

          <SectionHeading
            kicker="WITH THE GLOVE"
            title={isPitcher ? 'Off the mound' : naturalPos(p as Hitter)}
          />
          <section className="tool-table">
            {glove.map(([key, label, value]) => (
              <Bar key={key} label={label} value={Math.round(value)} />
            ))}
          </section>
        </>
      )}

      {view === 'splits' && <Platoon p={p} />}
      {view === 'tendencies' && <Tendencies p={p} isOurs={isOurs} ownerIndex={ownerIndex} />}
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
      <SectionHeading kicker="REPERTOIRE" title={`${(p as Pitcher).velocity} mph fastball`} />
      <section className="repertoire-list">
        {rep.map((o) => (
          <div key={o.id}>
            <span>{PITCHES[o.id].name.toUpperCase()}</span>
            <b>{speedOf(p, o.id)} MPH</b>
            <i>
              <em style={{
                width: `${Math.round(o.usage * 100)}%`,
                background: PITCHES[o.id].family === 'fastball' ? 'var(--clay)' : 'var(--ink)',
              }} />
            </i>
          </div>
        ))}
      </section>
    </>
  );
}

/**
 * The split, which the engine has always had and never once showed.
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

  return (
    <>
      <SectionHeading
        kicker="THE SPLIT"
        title={p.type === 'hitter' ? 'Against each hand' : 'What he allows'}
      />
      <section className="split-grid">
        <div>
          <small>VS RHP</small>
          <strong>{pctSigned(split.vsRHP - 1)}</strong>
          <span>{p.type === 'hitter' ? 'PRODUCTION' : 'ALLOWED'}</span>
        </div>
        <div>
          <small>VS LHP</small>
          <strong>{pctSigned(split.vsLHP - 1)}</strong>
          <span>{p.type === 'hitter' ? 'PRODUCTION' : 'ALLOWED'}</span>
        </div>
        <div>
          <small>{switchHitter ? 'SWITCH' : 'HE IS'}</small>
          <strong>{switchHitter ? 'BOTH' : `${p.bats}/${p.throws}`}</strong>
          <span>BATS / THROWS</span>
        </div>
      </section>

      {p.type === 'hitter' && split.contact && split.power && (
        <section className="tool-table">
          <div>
            <span>CONTACT vs RHP</span><b>{split.contact.vsRHP}</b>
            <i><em style={{ width: `${Math.min(100, split.contact.vsRHP)}%` }} /></i>
            <small>RIGHT</small>
          </div>
          <div>
            <span>CONTACT vs LHP</span><b>{split.contact.vsLHP}</b>
            <i><em style={{ width: `${Math.min(100, split.contact.vsLHP)}%` }} /></i>
            <small>LEFT</small>
          </div>
          <div>
            <span>POWER vs RHP</span><b>{split.power.vsRHP}</b>
            <i><em style={{ width: `${Math.min(100, split.power.vsRHP)}%` }} /></i>
            <small>RIGHT</small>
          </div>
          <div>
            <span>POWER vs LHP</span><b>{split.power.vsLHP}</b>
            <i><em style={{ width: `${Math.min(100, split.power.vsLHP)}%` }} /></i>
            <small>LEFT</small>
          </div>
        </section>
      )}

      {/*
        Only the cases that would otherwise mislead get a sentence. A pitcher
        with no split prints "+0.0%  +0.0%", which reads as a number the card
        failed to work out unless it says so itself; a switch hitter and a
        reverse split are the two cases where the table means something
        different from what a reader would assume. An ordinary split explains
        itself.
      */}
      {p.type === 'hitter' && switchHitter && (
        <FieldNote
          title="He turns around"
          text="He takes the platoon advantage against everybody."
        />
      )}
      {p.type === 'hitter' && !switchHitter && p.platoonSkill < 0 && (
        <FieldNote
          title="A reverse split"
          text="Better against his own hand, which is rare and real. Do not bench him for the matchup."
        />
      )}
    </>
  );
}

/**
 * What he does without being told, and what you have not seen enough of yet.
 *
 * A tendency is a thing you can see from the other dugout — their leadoff man
 * runs, their number three pulls everything — so unlike badges it is readable on
 * a rival. What it costs on a rival is time: the watch counter fills as you play
 * against him, and until it does the row says so rather than inventing a
 * reading.
 */
function Tendencies(
  { p, isOurs, ownerIndex }: { p: AnyPlayer; isOurs: boolean; ownerIndex: number },
) {
  const season = useDynasty((s) => s.season);
  const economy = useDynasty((s) => s.economy);
  const scoutsHimself = useDynasty((s) => handles(s.depth, 'scouting'));
  const watch = isOurs ? season?.watch?.get(p.id) : undefined;
  const slots = p.type === 'hitter' ? HITTER_TENDENCIES : PITCHER_TENDENCIES;
  /*
    The book on a rival is bought now — stage 11. A casual career's staff
    brings every report as part of the wage bill; a full career pays the desk
    per opponent, and the rows say NO BOOK until it does.
  */
  const scouted = !scoutsHimself
    || (economy.scouted[ownerIndex] ?? -1) >= (season?.dayIndex ?? 0);
  const seen = slots.filter((slot) => isKnown(slot, watch, isOurs, scouted)).length;

  return (
    <>
      <SectionHeading
        kicker="TENDENCIES"
        title={seen === slots.length ? 'You know him' : `${seen} of ${slots.length} read`}
      />
      <section className="tendency-list">
        {slots.map((slot) => {
          const spec = TENDENCIES[slot];
          const known = isKnown(slot, watch, isOurs, scouted);
          const label = known ? tendencyLabel(p, slot) : null;
          const progress = watchProgress(slot, watch);
          return (
            <div key={slot}>
              <span>{SLOT_WORD[slot]}</span>
              <strong className={known && label ? 'read' : 'unread'}>
                {known ? (label ?? 'Nothing unusual') : isOurs ? 'Still watching' : 'No report'}
                <em>
                  {known && label
                    ? ((tendenciesOf(p)[slot] ?? 0) > 0 ? spec.plusNote : spec.minusNote)
                    : known
                      ? 'He does the ordinary thing.'
                      : isOurs
                        ? `${Math.round(progress * 100)}% of the way to a reading.`
                        : 'No scouting report yet.'}
                </em>
              </strong>
            </div>
          );
        })}
      </section>
      {!isOurs && (
        <FieldNote
          title={scouted ? 'Scouting report active' : 'No scouting report'}
          text={scouted
            ? 'Their tendencies are available for the next stretch of games.'
            : 'Scout this program from its profile to reveal player tendencies and build an opponent playbook.'}
        />
      )}
    </>
  );
}

/**
 * The games a man is introduced by — stage 13. Drawn on the proposal's own
 * timeline, newest last, with June nights marked. Renders nothing for a man
 * with none, because an empty shrine is worse than no shrine.
 */
function SignatureMoments({ id }: { id: string }) {
  const season = useDynasty((s) => s.season);
  const moments = season?.moments?.[id] ?? [];
  if (moments.length === 0) return null;

  /*
    One night per kind of night — the best of it.

    Reported with an example: a pitcher listed four strikeout games, 13, 14,
    15 and the 16. "We should just keep there the greater, so there is space
    for other things without filling this with same achievements." The store
    keeps them all (the cap there is about memory, not taste); the shrine
    shows the one worth the shelf.

    Which one is "the greater": the biggest number in the line, then a June
    night over a regular one, then the later night — walk-offs and no-hitters
    have no magnitude, so for those the tiebreaks are the whole rule.
  */
  const magnitude = (m: Moment): number => Number(m.line.match(/\d+/)?.[0] ?? 0);
  const best = new Map<Moment['kind'], Moment>();
  for (const m of moments) {
    const cur = best.get(m.kind);
    if (!cur) { best.set(m.kind, m); continue; }
    const keep =
      magnitude(m) !== magnitude(cur) ? magnitude(m) > magnitude(cur)
      : (m.postseason ?? false) !== (cur.postseason ?? false) ? (m.postseason ?? false)
      : m.year !== cur.year ? m.year > cur.year
      : m.day > cur.day;
    if (keep) best.set(m.kind, m);
  }
  const shown = [...best.values()].sort((a, b) => a.year - b.year || a.day - b.day);

  return (
    <>
      <SectionHeading
        kicker="SIGNATURE MOMENTS"
        title={shown.length === 1 ? 'One night' : `${shown.length} nights`}
      />
      <section className="timeline moment-timeline">
        {shown.map((m, i) => (
          <div key={`${m.year}-${m.day}-${i}`}>
            <b>{m.year}</b>
            <span>
              {m.line}
              {m.postseason && <em className="june-mark"> JUNE</em>}
            </span>
          </div>
        ))}
      </section>
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

/**
 * This year's line, headlined.
 *
 * The proposal's stats sheet opens with three numbers set large and everything
 * else under them, which is right: a card is read for the headline and kept
 * open for the detail. The three are the ones a coach quotes — average, on base
 * and slugging for a bat; ERA, innings and strikeouts for an arm.
 *
 * The split moved to RATINGS, where it belongs: it is a property of the man
 * rather than of the season, and a freshman who has never batted still has one.
 */
function ThisSeason({ p }: { p: AnyPlayer }) {
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
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
  const pitched = pit && pit.outs > 0;

  if (isTwoWay(p) ? !batted && !pitched : isPitcher ? !pitched : !batted) {
    return (
      <section className="empty-state">
        <h2>No line yet</h2>
        <p>The book opens on his first pitch.</p>
      </section>
    );
  }

  return (
    <>
      <SectionHeading kicker="THIS SEASON" title={String(year)} />
      <section className="season-line">
        {isPitcher && pit ? (
          <>
            <Metric label="ERA" value={era(pit).toFixed(2)} note={`${pit.w}-${pit.l} RECORD`} />
            <Metric label="INNINGS" value={inningsPitched(pit).toFixed(1)} note={`${pit.sv} SAVES`} />
            <Metric label="STRIKEOUTS" value={String(pit.k)} note={`${pit.bb} WALKS`} />
          </>
        ) : bat ? (
          <>
            <Metric
              label="AVERAGE"
              value={bat.ab > 0 ? pct(battingAverage(bat)) : '—'}
              note={`${bat.h}-FOR-${bat.ab}`}
            />
            <Metric label="ON BASE" value={pct(onBase(bat))} note={`${bat.bb} WALKS`} />
            <Metric
              label="SLUGGING"
              value={bat.ab > 0 ? pct(slugging(bat)) : '—'}
              note={`${bat.hr} HOME RUNS`}
            />
          </>
        ) : null}
      </section>

      {isTwoWay(p) && pitched && pit && (
        <>
          <SectionHeading kicker="AND ON THE MOUND" title="The same season, pitched" />
          <section className="season-line">
            <Metric label="ERA" value={era(pit).toFixed(2)} note={`${pit.w}-${pit.l} RECORD`} />
            <Metric label="INNINGS" value={inningsPitched(pit).toFixed(1)} note={`${pit.sv} SAVES`} />
            <Metric label="STRIKEOUTS" value={String(pit.k)} note={`${pit.bb} WALKS`} />
          </section>
        </>
      )}
      <section className="fielding-strip">
        {isPitcher && pit ? (
          <>
            <span><small>WHIP</small><strong>{whip(pit).toFixed(2)}</strong></span>
            <span><small>WALKS</small><strong>{pit.bb}</strong></span>
            <span><small>SAVES</small><strong>{pit.sv}</strong></span>
          </>
        ) : bat ? (
          <>
            <span><small>RUNS BATTED IN</small><strong>{bat.rbi}</strong></span>
            <span><small>HOME RUNS</small><strong>{bat.hr}</strong></span>
            {/* "5-7" reads as a win-loss record on a card that has one two rows
                up. Spelled out, it can only mean one thing. */}
            <span><small>STOLEN</small><strong>{bat.sb} of {bat.sb + bat.cs}</strong></span>
          </>
        ) : null}
      </section>

      {/* The glove section left this tab by request — "remove the in the
          field with the glove section" — its numbers fold into each season's
          expanded row instead, where the season by season list shows the
          whole line on a tap. The IN JUNE panel that closed this section is
          gone the same way: June lives on STATS now, year by year. */}
    </>
  );
}

/**
 * His Junes, year by year — the same timeline the seasons use.
 *
 * Season totals in this game include tournament play, so June cannot be got by
 * subtracting one book from another — it is counted a second time in its own
 * books, and from now on each year's split is written onto his career row at
 * the archive (`CareerYear.june`). Asked for in exactly this shape: "one
 * season by season as well but to record the june stats, year by year just
 * like the season by season."
 *
 * The one honest limit: rows written before the split existed have no June of
 * their own — those tournaments live only in the aggregate `CareerTotals.post`
 * line, which is printed underneath whenever it knows more than the rows do.
 *
 * Absent entirely for a man who has never played a postseason game, which is
 * most of a roster in February. A timeline of dashes is not information.
 */
function JuneByYear(
  { p, owner, isOurs, half }:
  { p: AnyPlayer; owner: Owner; isOurs: boolean; half?: 'bat' | 'arm' },
) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  const isPitcher = isTwoWay(p) ? half === 'arm' : p.type === 'pitcher';

  const { years, live } = careerYears(season ?? null, owner.index, p.id, isOurs);
  const toRow = (y: CareerYear): CareerYear => ({
    year: y.year, classYear: y.classYear, team: y.team, name: y.name, ...y.june,
  });
  const rows = years.filter((y) => y.june).map(toRow);
  const liveRow = live?.june ? toRow(live) : null;

  // The aggregate, for the Junes the rows cannot reach. Its `y` counts every
  // tournament ever folded in; the rows only know the ones written since the
  // split existed. The live June is not folded into the aggregate until the
  // year rolls, so it is excluded from the comparison by year.
  const post = season?.careerTotals?.get(p.id)?.post;
  const unrowed = (post?.y ?? 0) - rows.filter((r) => r.year !== liveRow?.year).length;

  if (rows.length === 0 && (post?.y ?? 0) === 0) return null;

  return (
    <>
      <SectionHeading
        kicker="IN JUNE"
        title={rows.length === 1 ? 'One tournament' : `${Math.max(rows.length, post?.y ?? 0)} tournaments`}
      />
      {rows.length > 0 && (
        <SeasonRows years={rows} live={liveRow} isPitcher={isPitcher} glove={false} />
      )}
      {post && unrowed > 0 && (
        <Note>
          {unrowed === 1 ? 'One earlier June' : `${unrowed} earlier Junes`} in
          one line:{' '}
          {isPitcher
            ? `${post.w}-${post.l}${post.outs > 0 ? `, ${((post.er * 27) / post.outs).toFixed(2)} ERA` : ''} and ${post.k} strikeouts`
            : `${post.ab > 0 ? pct(post.h / post.ab) : '—'} with ${post.hr} home runs`}
          {' '}when it mattered.
        </Note>
      )}
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
/**
 * Every game he has appeared in this year, as rows.
 *
 * The proposal's game log is a `ListRows`: opponent, what he did, and the
 * result. Same three facts the grid carried, in the shape the rest of the app
 * already reads lists in.
 */
function Games(
  { id, owner, isOurs, half }:
  { id: PlayerId; owner: Owner; isOurs: boolean; half?: 'bat' | 'arm' },
) {
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  void version;

  if (!season) return null;
  if (!isOurs) {
    return (
      <section className="empty-state">
        <h2>Not your program</h2>
        <p>Game logs are kept for your own men only.</p>
      </section>
    );
  }

  const rows = gameLogFor(season, id, owner.index, half);

  if (rows.length === 0) {
    return (
      <section className="empty-state">
        <h2>No appearances yet</h2>
        <p>His first game this season writes the first line here.</p>
      </section>
    );
  }

  return (
    <>
      <SectionHeading
        kicker={`GAME LOG · ${year}`}
        title={rows.length === 1 ? 'One appearance' : `${rows.length} appearances`}
      />
      <DataTable
        rows={rows.map((r) => ({
          key: String(r.day),
          title: `${r.home ? 'vs ' : 'at '}${r.opponent}`,
          detail: `${seasonDate(year, r.day)} · ${r.slot} · ${r.line}`,
          value: `${r.won ? 'W' : 'L'} ${r.us}-${r.them}`,
          face: <span className={r.won ? 'log-mark won' : 'log-mark lost'}>{r.won ? 'W' : 'L'}</span>,
        }))}
      />
      <FieldNote
        title="This season only"
        text="Box scores last the season. What survives the roll of the year is
          the record book, on LEGACY."
      />
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
/**
 * The years he has played, newest last, with this one marked unfinished.
 *
 * Lifted out of `Career` so the STATS tab can print the same rows. Reported:
 * "in the stat tab add the seasonal stats, the stats they get each season" —
 * the season-by-season book existed but lived one tab away, behind a label
 * that reads like biography rather than numbers.
 */
function careerYears(
  season: SeasonState | null, ownerIndex: number, id: PlayerId, isOurs: boolean,
): { years: CareerYear[]; live: CareerYear | null } {
  const archived = season?.careers?.[id] ?? [];
  const live = isOurs && season ? liveCareerYear(season, ownerIndex, id) : null;
  return {
    years: live ? [...archived.filter((y) => y.year !== live.year), live] : archived,
    live,
  };
}

/** The timeline itself, so the two tabs cannot draw a year differently. */
function SeasonRows(
  { years, live, isPitcher, glove = true }:
  { years: CareerYear[]; live: CareerYear | null; isPitcher: boolean;
    /** June rows carry no fielding — the split never kept a glove. */
    glove?: boolean },
) {
  /*
    Tap a season and it opens. Asked for: "you can tab on them and they will
    expand and show all the stats in there, and when I mean all its all —
    OPS, etc., the main important ones."

    "All" means all the record book kept. `CareerYear` stores counting
    numbers, so every rate here is computed from them, and the ones the book
    cannot honestly reconstruct are not shown: no pitcher WHIP (the book
    keeps no hits or walks against), and OBP is hits-plus-walks over
    at-bats-plus-walks because nobody wrote down the sacrifices. The glove's
    three counters fold in here too, which is where the old IN THE FIELD
    section went.
  */
  const [openYear, setOpenYear] = useState<number | null>(null);
  const ip = (outs: number): string => `${Math.floor(outs / 3)}.${outs % 3}`;
  return (
    <section className="timeline">
      {[...years].reverse().map((y) => {
        const on = openYear === y.year;
        const ab = y.ab ?? 0; const h = y.h ?? 0; const bb = y.bb ?? 0;
        const d = y.d ?? 0; const t = y.t ?? 0; const hr = y.hr ?? 0;
        const tb = (h - d - t - hr) + 2 * d + 3 * t + 4 * hr;
        const obp = ab + bb > 0 ? (h + bb) / (ab + bb) : 0;
        const slg = ab > 0 ? tb / ab : 0;
        const outs = y.outs ?? 0; const er = y.er ?? 0; const k = y.k ?? 0;
        const line: Array<[string, string]> = isPitcher
          ? [
            ['W-L', `${y.w ?? 0}-${y.l ?? 0}`],
            ['ERA', outs > 0 ? ((er * 27) / outs).toFixed(2) : '—'],
            ['IP', outs > 0 ? ip(outs) : '—'],
            ['K', String(k)],
            ['K/9', outs > 0 ? ((k * 27) / outs).toFixed(1) : '—'],
            ...(glove ? [['E', String(y.errors ?? 0)] as [string, string]] : []),
          ]
          : [
            ['AVG', ab > 0 ? pct(h / ab) : '—'],
            ['OBP', ab + bb > 0 ? pct(obp) : '—'],
            ['SLG', ab > 0 ? pct(slg) : '—'],
            ['OPS', ab > 0 ? pct(obp + slg) : '—'],
            ['HR', String(hr)],
            ['RBI', String(y.rbi ?? 0)],
            ['2B+3B', String(d + t)],
            ['BB', String(bb)],
            ['SB', String(y.sb ?? 0)],
            ...(glove
              ? [
                ['CHANCES', String(y.chances ?? 0)] as [string, string],
                ['PLAYS', String(y.plays ?? 0)] as [string, string],
                ['E', String(y.errors ?? 0)] as [string, string],
              ]
              : []),
          ];
        return (
          <div key={y.year}>
            <b>{y.year}</b>
            <span>
              <button
                className="timeline-line tap"
                type="button"
                aria-expanded={on}
                onClick={() => setOpenYear(on ? null : y.year)}
              >
                {y.classYear} · {y.team}
                {y.year === live?.year ? ' · in progress' : ''}
                <em>
                  {isPitcher
                    ? `${y.w ?? 0}-${y.l ?? 0}${y.outs ? ` · ${((y.er ?? 0) * 27 / y.outs).toFixed(2)} ERA` : ''} · ${y.k ?? 0} K`
                    : `${y.ab ? pct((y.h ?? 0) / y.ab) : '—'} · ${y.hr ?? 0} HR · ${y.rbi ?? 0} RBI`}
                </em>
              </button>
              {on && (
                <span className="timeline-detail card-in">
                  {line.map(([kk, vv]) => (
                    <i key={kk}><small>{kk}</small><strong>{vv}</strong></i>
                  ))}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </section>
  );
}

/**
 * Everything he has won, from the books that were kept.
 *
 * Asked for with the seasons: "in history you can also add any award they
 * got." The season record archives the honours your own programme took, year
 * by year, so a career's cabinet is a scan of the dynasty rather than
 * anything new to store — and the season in progress is read live, because
 * an award won in May should not wait until the roll to appear.
 */
function AwardCase({ id }: { id: PlayerId }) {
  const history = useDynasty((s) => s.history);
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  void version;

  const won: { year: number; title: string }[] = [];
  for (const rec of history) {
    for (const a of rec.awards ?? []) {
      if (a.id === id) won.push({ year: rec.year, title: a.title });
    }
  }
  if (season && seasonComplete(season)) {
    for (const a of seasonAwards(season)) {
      if (a.id === id && !won.some((w) => w.year === year && w.title === a.title)) {
        won.push({ year, title: a.title });
      }
    }
  }
  if (won.length === 0) return null;

  return (
    <>
      <SectionHeading
        kicker="THE CABINET"
        title={won.length === 1 ? 'One honor' : `${won.length} honors`}
      />
      <section className="award-list">
        {won.sort((a, b) => b.year - a.year).map((w) => (
          <div key={`${w.year}-${w.title}`}>
            <span className="award-mark">{w.year}</span>
            <span>
              <strong>{w.title}</strong>
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

function Career(
  { id, owner, isPitcher, isOurs }:
  { id: PlayerId; owner: Owner; isPitcher: boolean; isOurs: boolean },
) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  /*
    The year he is playing, stacked under the years he has played.

    The archive is written in June, so between February and the draft step the
    season in front of the player is in `season.batting` and nowhere else — and
    this table read the archive alone. Reported as "after two seasons only one
    year shows, and the numbers do not update in real time", which is one defect
    seen from two angles: a sophomore in May had his freshman row and no second
    one, and nothing on the tab moved when he went four for four.

    The live row is the same row `archiveSeason` will write in June, computed by
    the same function, and it is marked as unfinished rather than presented as a
    result. Filtered rather than concatenated blindly, because between the draft
    step and the year roll the archive already holds this year and the two would
    print twice.
  */
  const { years, live } = careerYears(season, owner.index, id, isOurs);

  if (years.length === 0) {
    return (
      <section className="empty-state">
        <h2>{isOurs ? 'Nothing yet' : 'Not your program'}</h2>
        <p>
          {isOurs
            ? 'He has not been in a game. The book starts with his first one.'
            : 'The season-by-season book is kept for your own program only.'}
        </p>
      </section>
    );
  }

  /*
    The two marks a career is remembered by.

    Best year first, because that is what a career is asked for, and the total
    beside it because that is what it adds up to. Both computed over the same
    rows the table below prints, so the headline and the detail can never
    disagree.
  */
  const best = years.reduce((a, y) => {
    const score = isPitcher
      ? (y.outs ? -((y.er ?? 0) * 27) / y.outs : -99)
      : (y.ab ? (y.h ?? 0) / y.ab : 0);
    return score > a.score ? { y, score } : a;
  }, { y: years[0]!, score: -999 }).y;

  const totals = years.reduce((a, y) => ({
    h: a.h + (y.h ?? 0), ab: a.ab + (y.ab ?? 0), hr: a.hr + (y.hr ?? 0),
    k: a.k + (y.k ?? 0), er: a.er + (y.er ?? 0), outs: a.outs + (y.outs ?? 0),
    w: a.w + (y.w ?? 0), l: a.l + (y.l ?? 0),
  }), { h: 0, ab: 0, hr: 0, k: 0, er: 0, outs: 0, w: 0, l: 0 });

  return (
    <>
      <SignatureMoments id={id} />
      <section className="player-records">
        <div>
          <small>BEST YEAR</small>
          <strong>
            {isPitcher
              ? (best.outs ? ((best.er ?? 0) * 27 / best.outs).toFixed(2) : '—')
              : (best.ab ? pct((best.h ?? 0) / best.ab) : '—')}
          </strong>
        </div>
        <div>
          <small>{isPitcher ? 'CAREER ERA' : 'CAREER AVG'}</small>
          <strong>
            {isPitcher
              ? (totals.outs ? (totals.er * 27 / totals.outs).toFixed(2) : '—')
              : (totals.ab ? pct(totals.h / totals.ab) : '—')}
          </strong>
        </div>
        <div>
          <small>{isPitcher ? 'CAREER K' : 'CAREER HR'}</small>
          <strong>{isPitcher ? totals.k : totals.hr}</strong>
        </div>
      </section>

      {/* The season-by-season table left this tab by request — "you can
          remove the college career since we are already going to have this in
          stats" — where it now opens per year on a tap. What stays here is
          what STATS does not carry: the nights, the three career marks above,
          and the cabinet. */}
      <AwardCase id={id} />
    </>
  );
}

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

/*
  The leaves.

  Six shapes that every tab of this card is built out of, and converting them
  was how five tabs of dense, real content moved onto the proposal's anatomy
  without rewriting nine hundred lines of the logic that produces it. Each one
  maps to a class that already exists in prototype.css:

    Head   -> .flow-section-title    a rule with a green label on it
    Panel  -> .tendency-list         label on the left, value on the right
    Stat   -> one of its rows
    Tile   -> .metric                a number with a caption
    Bar    -> .tool-table            a rating drawn against its full scale
    Note   -> .field-note            the pinned aside
    Empty  -> .empty-state

  Nothing here carries a style object, which is the point: the stylesheet is the
  only opinion about how any of it looks.
*/

function Head({ children }: { children: ReactNode }) {
  return (
    <div className="flow-section-title">
      <span className="label">{children}</span>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="tendency-list">{children}</section>;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <section className="field-note">
      <SewingPinIcon />
      <div><p>{children}</p></div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <section className="empty-state">
      <p>{children}</p>
    </section>
  );
}

function Tile({ k, v, accent }: { k: string; v: string; accent?: boolean; last?: boolean }) {
  return (
    <div className="metric">
      <small>{k}</small>
      <strong style={accent ? undefined : { color: 'var(--ink)' }}>{v}</strong>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string; last?: boolean }) {
  return (
    <div>
      <span>{k}</span>
      <strong>{v}</strong>
    </div>
  );
}

/** "14th", for a rank that has to fit in a tile. */
const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? 'th');
};

/**
 * A rating, drawn against the full scale so the shape of a player is readable.
 *
 * The proposal's tool table: a name, the number, the bar, and room on the right
 * for the word that says what the number means. Sixty is the line where a
 * rating stops being a weakness — above it the bar takes the accent.
 */
function Bar({ label, value }: { label: string; value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
      <i><em style={{ width: `${width}%`, opacity: value >= 60 ? 1 : 0.5 }} /></i>
      <small>{value >= 75 ? 'PLUS' : value >= 60 ? 'SOLID' : value >= 45 ? 'FAIR' : 'LIGHT'}</small>
    </div>
  );
}

/**
 * A departed man's seasons, on the same timeline his card used.
 *
 * `Career` needs a roster to compute the live row against and he is on nobody's,
 * so this is the finished half of it: the archive, newest first, and nothing
 * that pretends to be in progress.
 */
function AlumnusYears({ years, isPitcher }: { years: CareerYear[]; isPitcher: boolean }) {
  if (years.length === 0) {
    return (
      <section className="empty-state">
        <h2>No seasons on record</h2>
        <p>He left before the book was keeping years, or he never played one.</p>
      </section>
    );
  }
  return (
    <>
      <SectionHeading
        kicker="COLLEGE CAREER"
        title={years.length === 1 ? 'One season' : `${years.length} seasons`}
      />
      <section className="timeline">
        {[...years].reverse().map((y) => (
          <div key={y.year}>
            <b>{y.year}</b>
            <span>
              {y.classYear} · {y.team}
              <em>
                {isPitcher
                  ? `${y.w ?? 0}-${y.l ?? 0}${y.outs ? ` · ${((y.er ?? 0) * 27 / y.outs).toFixed(2)} ERA` : ''} · ${y.k ?? 0} K`
                  : `${y.ab ? pct((y.h ?? 0) / y.ab) : '—'} · ${y.hr ?? 0} HR · ${y.rbi ?? 0} RBI`}
              </em>
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

/**
 * The season-by-season book, under this season's line on the STATS tab.
 *
 * Reported: "in the stat tab add the seasonal stats, the stats they get each
 * season." The rows are the same rows the career tab prints — one component,
 * so the two tabs can never disagree about a year.
 */
function SeasonsUnder(
  { p, owner, isOurs, half }:
  { p: AnyPlayer; owner: Owner; isOurs: boolean; half?: 'bat' | 'arm' },
) {
  const asPitcher = isTwoWay(p) ? half === 'arm' : p.type === 'pitcher';
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  void version;
  const { years, live } = careerYears(season ?? null, owner.index, p.id, isOurs);
  if (years.length === 0) {
    // The tab's only tenant until he appears — the current-year box moved to
    // the overview, so without this a freshman's STATS tab would be blank.
    return (
      <section className="empty-state">
        <h2>No seasons yet</h2>
        <p>Until his first appearance, the year in progress lives on the
          overview.</p>
      </section>
    );
  }
  // The two-way man's book has two halves; the BATTING/PITCHING toggle
  // above decides which one this table reads (it used to stack both).
  return (
    <>
      <SectionHeading
        kicker="SEASON BY SEASON"
        title={years.length === 1 ? 'One season' : `${years.length} seasons`}
      />
      <SeasonRows years={years} live={live} isPitcher={asPitcher} />
    </>
  );
}
