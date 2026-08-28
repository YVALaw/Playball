// rivals.ts
// The other ninety five men with the same job as you.
//
// Until this existed you were the only coach in the country who ever got better.
// Your training skill grew, your recruiting skill grew, your reputation opened
// doors — and the ninety five programs you were competing against were run by
// nobody at all, permanently, at a fixed standing that no result could move.
// That is a snowball with no brake on it. Worse, it is a snowball the game
// cannot even *describe*: a rival who beats you is a row in a table, and there
// is nothing there to be poached, sacked or beaten twice.
//
// So: they have names, they accumulate skill, their boards judge them, they are
// sacked, they move between programs, and they get old and stop. The point is
// not fairness for its own sake. It is that a dynasty which cannot be caught
// stops being a contest, and the correcting force in the real sport is almost
// entirely the coaching carousel — the man who overachieves at a small program
// leaves, and the small program starts again.
//
// **Everything here is reused rather than parallel.** `reviewSeason` grades a
// rival exactly as it grades you, `judge` reads the same checklist,
// `nextCoachPrestige` moves his standing on the same arithmetic including the
// bad-run penalty, `nextPrestige` moves his program, `canBeHired` decides who
// will have him, and `skillPoints` pays him for the season at the same rate. A
// second system that resembled the first would drift from it inside a month.
//
// **The divergences are two, and they are both `rivalBoard`.** A rival's board
// reads the same checklist against *this year's* league rather than against the
// distribution `expectationFor` was calibrated on, and it has one firing bar
// where the player's has two. Everything the argument rests on — including why
// the second one is not simply the player's board being made kinder — is at the
// seam in `program.ts`, deliberately over there rather than here, because a
// divergence documented only on the side that diverges is how two systems come
// apart. Nothing else in this file knows there is a difference.
//
// **Nothing here draws from the generator.** The same decision the AI's draft
// retention made and for a sharper reason: this runs once a year against
// ninety five programs, and spending draws here would move every recruiting
// class and every development roll in the game by an amount that depends on how
// many coaches happened to be sacked. Names are hashed off the chair and the
// year, and every decision is a fact about a program and a man.
//
// **They are not superhuman.** A rival earns the same points a season pays you
// and spends them worse — half into one skill he happens to favour and the rest
// scattered — because a coach who allocated optimally for twenty years would end
// up better than a player who did anything else with his attention. That is the
// same rule the draft was built to: the AI is allowed to be competent and is not
// allowed to be right.

import { FIRST, LAST } from '../data/names.js';
import {
  ROOKIE_PRESTIGE, canBeHired, contractFor, leagueShape, reviewSeason,
  rivalBoard, rosterStrength, skillPoints,
  type CoachSkills, type SeasonOutcome, type Verdict,
} from './program.js';
import type { PostseasonSummary } from './postseason.js';
import type { SeasonState, TeamRecord } from './season.js';

/**
 * What one of them carries, and nothing else.
 *
 * Fifteen numbers and a name, times ninety five, is about four kilobytes in a
 * megabyte save — so size was never the constraint and the list below is not an
 * economy drive. What decided it was whether anything reads the field:
 *
 *   - The **name**, the **career totals** and the **trophies** are read: they
 *     are what makes "Hollis Ward, two conference titles, leaves the Mountain
 *     for a five star job" a sentence instead of an index.
 *   - **prestige, security, tenure and the contract** are what `reviewSeason`
 *     and `canBeHired` need. They are the machinery, not the flavour.
 *   - **skills** reach the simulation — the bench edge in every game his team
 *     plays, how far his returning players develop, and how hard his pitch lands
 *     on a recruit. A skill tree whose branches change nothing is a menu.
 *   - **age** is here for one reason and it is the important one: it is the only
 *     thing that eventually empties a good chair whatever the coach does. See
 *     `retireAge`.
 *   - **badRun** is the B5 memory. A rival gets the same escalating penalty.
 *
 * Three things are deliberately absent. He has **no unspent points** — he spends
 * them the moment he earns them, and a rival's unspent point is state with no
 * reader. He has **no philosophy**: `strategyFor` already gives every program a
 * bench personality seeded off its index, and layering a coach's preference over
 * it would mean a program's style flickered every time it changed coaches for
 * reasons the player can never see. And he has **no achievements** — see
 * `engine/achievements.ts`.
 */
export interface RivalCoach {
  name: string;
  age: number;
  prestige: number;
  security: number;
  tenure: number;
  contractYears: number;
  contractLength: number;
  skills: CoachSkills;
  /** The skill he puts half of every season's points into. Fixed for life. */
  lean: keyof CoachSkills;
  badRun: number;
  /**
   * Chairs sat in, wrecks taken, and the best a programme ever grew under him.
   *
   * The same three the player's coach keeps, for the same reason: a title now
   * describes the *shape* of a career, and ninety-five careers with no shape
   * would leave the country full of men the game cannot introduce.
   */
  stints?: number;
  rebuilds?: number;
  bestBuild?: number;
  /** Where the programme he is in now stood on the day he walked in. */
  arrivedPrestige?: number;
  careerWins: number;
  careerLosses: number;
  titles: number;
  conferenceTitles: number;
  regionalTitles: number;
  tournaments: number;
}

// ---------------------------------------------------------------------------
// Who he is
// ---------------------------------------------------------------------------

/** A stable integer from a string. The same one `serviceScore` uses. */
function hash(s: string): number {
  let h = 7919;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const SKILL_ORDER: readonly (keyof CoachSkills)[] =
  ['offense', 'defense', 'training', 'recruiting'];

/**
 * A name for the man in chair `seat`, hired in `year`.
 *
 * Hashed rather than drawn, for the reason at the top of the file. It is also
 * why a name is not checked against the player pool: two draws of the same seed
 * give the same man, and a coach called Miguel Rowe in a league that also has a
 * shortstop called Miguel Rowe is a coincidence rather than a bug.
 */
export function rivalName(seat: number, year: number): string {
  const h = hash(`coach:${seat}:${year}`);
  const first = FIRST[h % FIRST.length] ?? 'Coach';
  const last = LAST[(h >> 7) % LAST.length] ?? '';
  return `${first} ${last}`.trim();
}

/**
 * When he stops, between 64 and 72.
 *
 * The one force in this file that does not care how good anybody is, and the
 * reason the top of the league cannot lock. Everything else here is a feedback
 * loop — a coach who wins keeps his job, a program that wins attracts a better
 * coach — and feedback loops compound. A retirement does not: the best chair in
 * the country comes open on a schedule nobody can influence, and whoever fills
 * it starts again from wherever he was.
 *
 * Spread across nine years off the name, so they do not all go in the same June.
 *
 * It was 62 to 70, which was two years early and only became visible once the
 * boards stopped sacking everybody first. Against a hiring age averaging forty
 * five it retired three and a half men a year out of ninety six, where the real
 * sport loses two or so to age and to leaving the profession — college baseball
 * is full of men still in the dugout at seventy, and the game's own coach
 * creation screen will let the player start a career at sixty eight.
 */
export function retireAge(name: string): number {
  return 64 + (hash(`retire:${name}`) % 9);
}

/**
 * A new man for a chair, at whatever standing he arrives with.
 *
 * The default is a nobody, which is what a program that could not attract
 * anybody actually gets. `prestige` is passed in when the world is first seated,
 * because a league where all ninety six coaches are unknowns on day one would
 * have every good job open to the first coach who won anything, including you.
 */
export function newRivalCoach(
  seat: number, year: number, prestige = ROOKIE_PRESTIGE, age?: number,
): RivalCoach {
  const name = rivalName(seat, year);
  const h = hash(name);
  const length = contractFor(prestige);
  // Skill starts where the player's does and is nudged by what the program has
  // been able to attract: a man good enough for a blue blood did not arrive at
  // twenty across the board. Bounded well under the ceiling, so his first
  // decade of points still has somewhere to go.
  const base = 20 + Math.round(Math.max(0, prestige - ROOKIE_PRESTIGE) * 0.35);
  return {
    name,
    age: age ?? 36 + (h % 20),
    prestige,
    security: 62,
    tenure: 0,
    contractYears: length,
    contractLength: length,
    skills: { offense: base, defense: base, training: base, recruiting: base },
    lean: SKILL_ORDER[h % SKILL_ORDER.length] as keyof CoachSkills,
    badRun: 0,
    careerWins: 0,
    careerLosses: 0,
    titles: 0,
    conferenceTitles: 0,
    regionalTitles: 0,
    tournaments: 0,
  };
}

/**
 * A season's points, spent badly on purpose.
 *
 * Half into the one skill he favours and the rest spread over the other three.
 * A rival who spent optimally would put every point of a twenty year career into
 * recruiting and end up with a permanent structural edge over a player who did
 * anything else with his — and the player is the one who is supposed to be
 * making the interesting choice here. Spreading is the *ordinary* mistake, which
 * is the right mistake for a background actor to make.
 */
export function spendPoints(coach: RivalCoach, points: number): void {
  if (points <= 0) return;
  const into = Math.ceil(points / 2);
  const rest = SKILL_ORDER.filter((k) => k !== coach.lean);
  const put = (k: keyof CoachSkills, n: number): void => {
    coach.skills[k] = Math.min(99, coach.skills[k] + n);
  };
  put(coach.lean, into);
  for (let i = 0; i < points - into; i++) {
    put(rest[i % rest.length] as keyof CoachSkills, 1);
  }
}

// ---------------------------------------------------------------------------
// Seating the world
// ---------------------------------------------------------------------------

/**
 * Put a coach in every chair but yours.
 *
 * The one door: a new career, a load, and a job accepted all come through here,
 * so there is a single answer to "who is running the other programs" rather than
 * three that can disagree. It is idempotent — a chair that already has a man
 * keeps him — which is what lets it be called on every load without wiping a
 * carousel that has been running for fifteen years.
 *
 * **Your chair is emptied.** The alternative was to leave a rival sitting in it
 * and ignore him, and that goes wrong the moment the user is sacked: the chair
 * he just left would already be occupied by somebody the game never hired.
 * Returns the man displaced, if there was one, because a board sacking its coach
 * to make room for you is news.
 */
export function seatCoaches(
  season: SeasonState, userTeam: number, year: number,
): RivalCoach | null {
  let displaced: RivalCoach | null = null;
  for (const record of season.teams) {
    if (record.index === userTeam) {
      displaced = record.coach ?? null;
      delete record.coach;
      continue;
    }
    // Seeded at the program's own standing, so the ladder starts out looking
    // like the ladder. Every coach beginning at 25 would mean the entire top of
    // the hiring board was open to whoever won a game first.
    record.coach ??= newRivalCoach(record.index, year, record.prestige);
  }
  return displaced;
}

/**
 * Put every bench's edge onto the team record the game reads.
 *
 * One pass over all ninety six, because the alternative — the user's chair
 * written here and everybody else's somewhere else — is how a program keeps the
 * coach it had two jobs ago. `userSkills` of null means the user's chair is
 * currently empty, which is a real state: he has been sacked and has not taken
 * anything yet.
 */
export function syncCoachMods(
  season: SeasonState, userTeam: number, userSkills: CoachSkills | null,
): void {
  for (const record of season.teams) {
    if (record.index === userTeam) {
      if (userSkills) {
        record.coachMods = { offense: userSkills.offense, defense: userSkills.defense };
      } else delete record.coachMods;
      continue;
    }
    const c = record.coach;
    if (c) record.coachMods = { offense: c.skills.offense, defense: c.skills.defense };
    else delete record.coachMods;
  }
}

// ---------------------------------------------------------------------------
// A rival's season
// ---------------------------------------------------------------------------

/**
 * What one program's year came to, in the shape the board grades.
 *
 * The regular season record, not the running one, for the same reason the user's
 * review reads `rw`/`rl`: judged on the total including bracket wins, a deep
 * June raises the win target it is being measured against.
 */
export function rivalOutcome(
  season: SeasonState, post: PostseasonSummary | null, record: TeamRecord,
): SeasonOutcome {
  const w = record.rw ?? record.w;
  const l = record.rl ?? record.l;
  const size = season.teams.filter((t) => t.conference === record.conference).length;
  // Placement, off conference record alone. The user's rank comes from
  // `standings`, which applies the full tiebreaker chain — worth the work for
  // one program and not for ninety five, and the only thing a board reads off it
  // is which band the finish falls in.
  const better = season.teams.filter(
    (t) => t.conference === record.conference
      && t.index !== record.index
      && (t.cw > record.cw || (t.cw === record.cw && t.rs - t.ra > record.rs - record.ra)),
  ).length;
  const finish = post?.finish[record.index];
  return {
    wins: w,
    losses: l,
    conferenceRank: better + 1,
    conferenceSize: size,
    wonConference: post?.conferenceChampions.includes(record.index) ?? false,
    // The twenty-team field is the tournament; a regional exit is not a bid.
    madeTournament: post?.nationalField?.includes(record.index)
      ?? (finish !== undefined && finish !== 'regional'),
    wonRegional: post?.regionChampions.includes(record.index) ?? false,
    reachedOmaha: finish === 'omaha' || finish === 'runner-up' || finish === 'champion',
    wonTitle: post?.champion === record.index,
  };
}

// ---------------------------------------------------------------------------
// The carousel
// ---------------------------------------------------------------------------

/** One thing that happened to somebody else's career. The inbox reads these. */
export interface CarouselMove {
  kind: 'sacked' | 'retired' | 'hired' | 'poached';
  coach: string;
  /** The chair it happened to. */
  team: number;
  school: string;
  /** On a poach, the chair he left. */
  from?: number;
  fromSchool?: string;
  /** His career, for the line under the name. */
  detail: string;
}

/**
 * How much better a chair has to be before a sitting coach will move for it.
 *
 * Without a gap, a vacancy one prestige point up drags somebody out of a job he
 * is doing well, and the vacancy that leaves drags somebody else — so a single
 * retirement cascades through eight programs and the league reads as a lottery.
 *
 * The value is measured rather than argued, and it has been measured twice. The
 * first time — six against ten, over twenty two seasons — was taken while the
 * boards were sacking a third of the country every year, so almost every chair
 * on the market was one a board had just emptied and the gap was being asked to
 * hold back a flood. With `rivalBoard` in place the flood is gone and the same
 * sweep gives different answers. Thirty five seasons of the full world, two
 * seeds, chairs changing hands per year out of ninety six:
 *
 *     gap 10   19.0     gap 16   14.8     gap 22   12.1     gap 26   11.8
 *
 * Twenty six is two star tiers, and what it buys is that a poach is a promotion
 * rather than a sideways step: a man leaves a two star program for a four star
 * job, not for the three star next door. Below twenty two the cascade takes over
 * again — one retirement at a blue blood empties three chairs — and the country
 * runs hotter than the real sport at the very thing that is supposed to be its
 * rarest event. Above it there is nothing left to win: the curve is flat by
 * twenty two, because what remains is sackings and old age.
 */
export const POACH_GAP = 26;

/**
 * After this long in one chair he stops listening.
 *
 * The one thing here that is not arithmetic about prestige, and it earns its
 * place twice: it is true — a man eleven years into building something does not
 * leave for a marginally bigger name — and it is what allows a rival to become a
 * fixture. Without it every good coach is eventually pulled up the ladder, and
 * the league has no equivalent of the man who *is* the program.
 */
export const SETTLED_TENURE = 10;

/** How many times a vacancy is allowed to create another one. */
const CASCADE_PASSES = 3;

/**
 * Who is on the market, and what they are worth to a hiring board.
 *
 * A coach out of work is worth slightly less than the same coach in a job, which
 * is the honest read of a man who was just let go — but only slightly, because
 * the whole premise of coach prestige is that it is a national reputation rather
 * than a reference from the last board.
 */
const OUT_OF_WORK = 3;

/**
 * A man the market has, and the chair that let him go.
 *
 * `from` exists for one rule and it is not a nicety: without it a board that
 * sacks its coach in May can hire him back in June. It could always happen and
 * it never showed, because the boards were emptying fifteen chairs a year and
 * the market was never thin enough for a program's own reject to be the best
 * thing on it. At five sackings it is thin every year — a school that dismisses
 * the only man on the market gets him back — which is how a measurement bug and
 * a fiction bug turn out to be the same bug.
 */
export interface FreeAgent {
  coach: RivalCoach;
  /** The chair that sacked him, which is the one chair he cannot have. */
  from: number;
}

interface Candidate {
  coach: RivalCoach;
  /** The chair he is sitting in, or -1 if he is out of work. */
  seat: number;
}

/**
 * Fill every empty chair, poaching where a better job is open.
 *
 * Best chair first, so the top of the league picks before the bottom does —
 * which is both what happens and what makes a poach feel like a promotion rather
 * than a swap. A poach empties the chair he came from, and that vacancy is
 * offered in the next pass; three passes is enough for the cascade a single
 * retirement at a blue blood actually produces and short enough that a bad year
 * across the league cannot turn into a hundred moves.
 */
export function runCarousel(
  season: SeasonState, userTeam: number, year: number,
  pool: FreeAgent[],
): CarouselMove[] {
  const moves: CarouselMove[] = [];
  const line = (c: RivalCoach): string =>
    `${c.careerWins}-${c.careerLosses}`
    + (c.titles > 0 ? `, ${c.titles} national` : '')
    + (c.conferenceTitles > 0 ? `, ${c.conferenceTitles} conference` : '');

  for (let pass = 0; pass < CASCADE_PASSES; pass++) {
    const open = season.teams
      .filter((t) => t.index !== userTeam && !t.coach)
      .sort((a, b) => b.prestige - a.prestige || a.index - b.index);
    if (open.length === 0) break;

    let moved = false;
    for (const chair of open) {
      if (chair.coach) continue;
      const roster = rosterStrength(chair.team);

      const options: Candidate[] = pool
        .filter((free) => free.from !== chair.index)
        .map((free) => ({ coach: free.coach, seat: -1 }));
      // Only the last pass stops poaching. A cascade that is still running is
      // the interesting part — the blue blood takes the man from the four star,
      // and the four star takes the man from the two.
      if (pass < CASCADE_PASSES - 1) {
        for (const t of season.teams) {
          if (t.index === userTeam || !t.coach) continue;
          if (t.coach.tenure >= SETTLED_TENURE) continue;
          if (chair.prestige - t.prestige < POACH_GAP) continue;
          options.push({ coach: t.coach, seat: t.index });
        }
      }
      if (options.length === 0) continue;

      const worth = (c: Candidate): number =>
        c.coach.prestige - (c.seat < 0 ? OUT_OF_WORK : 0);
      const qualified = options.filter((c) => canBeHired(worth(c), chair.prestige, roster));
      // A board that cannot get anybody it wanted still hires somebody. Falling
      // back to the best available rather than leaving the chair empty is the
      // truthful outcome and it is also the only one the rest of the engine can
      // handle — a program with no coach recruits at nobody's skill for ever.
      const shortlist = qualified.length > 0 ? qualified : options;
      const pick = shortlist.reduce((best, c) =>
        (worth(c) > worth(best)
          || (worth(c) === worth(best) && c.coach.name < best.coach.name)
          ? c : best));

      if (pick.seat >= 0) {
        const old = season.teams[pick.seat];
        if (old) {
          delete old.coach;
          moves.push({
            kind: 'poached', coach: pick.coach.name, team: chair.index,
            school: chair.def.school, from: old.index, fromSchool: old.def.school,
            detail: line(pick.coach),
          });
        }
        moved = true;
      } else {
        pool.splice(pool.findIndex((free) => free.coach === pick.coach), 1);
        moves.push({
          kind: 'hired', coach: pick.coach.name, team: chair.index,
          school: chair.def.school, detail: line(pick.coach),
        });
      }

      const length = contractFor(chair.prestige);
      /*
        A new chair, counted.

        Banked before the move rather than after, because `arrivedPrestige` is
        not kept for rivals -- what a man built is measured against where the
        programme he is leaving stands now, and after the assignment that
        programme is somebody else's.
      */
      pick.coach.stints = (pick.coach.stints ?? 1) + 1;
      // A new chair is a new baseline; what he built at the last one is already
      // banked already.
      pick.coach.arrivedPrestige = chair.prestige;
      if (chair.prestige < 40) pick.coach.rebuilds = (pick.coach.rebuilds ?? 0) + 1;
      pick.coach.tenure = 0;
      pick.coach.security = 62;
      pick.coach.contractYears = length;
      pick.coach.contractLength = length;
      // The run does not follow him into the new building. A board hiring a man
      // is by definition unconvinced by the last one's read of him, and leaving
      // it on would have him sacked in two years for seasons somebody else's
      // programme produced. His prestige already carries the damage.
      pick.coach.badRun = 0;
      chair.coach = pick.coach;
    }

    if (!moved) break;
  }

  // Whatever the market did not want. A chair left open at this point had no
  // candidate at all, which only happens in the first pass of a tiny test world.
  for (const chair of season.teams) {
    if (chair.index === userTeam || chair.coach) continue;
    chair.coach = newRivalCoach(chair.index, year, ROOKIE_PRESTIGE);
    moves.push({
      kind: 'hired', coach: chair.coach.name, team: chair.index,
      school: chair.def.school, detail: 'no head coaching record',
    });
  }
  return moves;
}

// ---------------------------------------------------------------------------
// The whole year, for everybody else
// ---------------------------------------------------------------------------

export interface RivalYear {
  moves: CarouselMove[];
  /** Verdicts across the league, so a test can see the boards actually working. */
  verdicts: Record<Verdict, number>;
}

/**
 * Grade ninety five careers, move ninety five programs, and run the carousel.
 *
 * Called once, at the same moment your own board sits down, because that is
 * when everything it needs is in hand: the postseason is settled, the regular
 * season records are frozen, and nothing has yet touched the rosters. Running it
 * at the year roll instead would judge coaches against rosters that had already
 * graduated.
 *
 * `userOpen` says the user has been sacked, so his chair joins the market. He is
 * still nominally at the program until he takes another job, which is why the
 * chair is only offered when the flag says so rather than whenever it is empty.
 */
export function runRivalYear(
  season: SeasonState,
  post: PostseasonSummary | null,
  opts: { year: number; userTeam: number; games: number; userOpen?: boolean },
): RivalYear {
  const { year, userTeam, games } = opts;
  const verdicts: Record<Verdict, number> = {
    exceeded: 0, met: 0, missed: 0, failed: 0,
  };
  const pool: FreeAgent[] = [];
  const moves: CarouselMove[] = [];

  // Measured once, off every chair including the user's — he is part of the
  // country whether or not his own board looks at it — and before a single
  // program's prestige has moved, so all ninety five meetings are held against
  // the same league rather than against a number that shifts as the loop runs.
  const league = leagueShape(season.teams);

  for (const record of season.teams) {
    const coach = record.coach;
    if (record.index === userTeam || !coach) continue;

    const outcome = rivalOutcome(season, post, record);
    const roster = rosterStrength(record.team);
    const review = reviewSeason(
      coach, record.prestige, roster, outcome, games,
      rivalBoard(record.prestige, roster, league, games),
    );
    verdicts[review.verdict] += 1;

    // The program moves. This is the line that was missing entirely before B7 —
    // `nextPrestige` existed and only the user's program was ever passed to it,
    // so ninety five schools were frozen at the standing the world was generated
    // with and no amount of winning or losing could touch them.
    record.prestige = review.prestigeAfter;

    /*
      What he has built here, kept up to date rather than measured on the way
      out.

      A rival who is sacked is put in a pool and separated from his chair in the
      same breath, so there is no later moment at which the question "what did
      he do with that programme" can still be asked. Recording it every season
      costs one comparison and means Builder is a rung anybody can wear --
      without it, it was reachable only by the player and ninety-five careers
      had one fewer shape available to them.
    */
    if (coach.arrivedPrestige === undefined) coach.arrivedPrestige = record.prestige;
    const grew = record.prestige - coach.arrivedPrestige;
    if (grew > (coach.bestBuild ?? 0)) coach.bestBuild = grew;

    coach.prestige = review.coachPrestigeAfter;
    coach.security = review.securityAfter;
    coach.contractYears = review.contractYears;
    coach.badRun = review.badRun;
    coach.careerWins += outcome.wins;
    coach.careerLosses += outcome.losses;
    if (outcome.wonTitle) coach.titles += 1;
    if (outcome.wonConference) coach.conferenceTitles += 1;
    if (outcome.wonRegional) coach.regionalTitles += 1;
    if (outcome.madeTournament) coach.tournaments += 1;
    spendPoints(coach, skillPoints(outcome));
    coach.age += 1;
    coach.tenure = review.fired ? 0 : coach.tenure + 1;

    const line = `${coach.careerWins}-${coach.careerLosses}`;

    // Retirement is checked before the sacking, and it beats it. A man let go at
    // sixty eight has retired whatever the minutes of the board meeting say, and
    // reporting it the other way round would have the market carrying candidates
    // who are never going to work again.
    if (coach.age >= retireAge(coach.name)) {
      delete record.coach;
      moves.push({
        kind: 'retired', coach: coach.name, team: record.index,
        school: record.def.school, detail: `${line} over ${coach.age - 30} years`,
      });
      continue;
    }
    if (review.fired) {
      delete record.coach;
      pool.push({ coach, from: record.index });
      moves.push({
        kind: 'sacked', coach: coach.name, team: record.index,
        school: record.def.school, detail: line,
      });
    }
  }

  // A chair the user has been sacked out of is a chair the market can have.
  // Minus one is "no chair is off limits", which is the whole of the difference.
  moves.push(...runCarousel(season, opts.userOpen ? -1 : userTeam, year, pool));
  return { moves, verdicts };
}
