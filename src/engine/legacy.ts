// legacy.ts
// The dynasty remembers — stage 13.
//
// Two systems, one idea: a fifteen-year save should read as a history rather
// than a number. **Signature moments** catch the games a man will be
// introduced by for the rest of his life — the five-hit day, the no-hitter,
// the walk-off — at the one funnel every user game already passes through.
// **The professional game** answers the question every long save asks about a
// drafted man: what happened next.
//
// Both are cheap by construction. Moments are written only when they happen —
// a handful of rows a season, capped per man — and the pro careers are
// **derived, never stored**: one durable note per alumnus (who he was the day
// he left) and everything after it is a hash of the man and the year, so ten
// years of Double-A summers cost the save nothing at all.

// String-keyed throughout: the game engine keys its line maps by the id as a
// plain string, and a branded index signature would force casts at the one
// funnel this is called from.

// ---------------------------------------------------------------------------
// Signature moments
// ---------------------------------------------------------------------------

export type MomentKind =
  | 'five'      // five hits in a game
  | 'four'      // four hits
  | 'hrs3'      // three home runs
  | 'bigday'    // two homers and a pile of RBI
  | 'walkoff'   // he ended it
  | 'nohitter'  // the whole game, nobody hit
  | 'shutout'   // a complete-game shutout with strikeouts to show
  | 'ks';       // a strikeout show

export interface Moment {
  year: number;
  day: number;
  kind: MomentKind;
  /** The line the card prints. Written at the moment, in the moment's terms. */
  line: string;
  /** Who it was against. */
  vs: string;
  /** June games carry their own weight. */
  postseason?: boolean;
}

/** The most a card keeps for one man. A life, not a ledger. */
const MOMENT_CAP = 12;

/** What each kind outranks, for the day the cap bites. */
const RANK: Record<MomentKind, number> = {
  nohitter: 7, walkoff: 6, five: 5, hrs3: 5, shutout: 4, bigday: 3, four: 2, ks: 2,
};

/**
 * One side's raw lines, as recordResult holds them. Arrays rather than the
 * engine's own maps, because those are keyed by NAME with the player on the
 * value — the first cut keyed the whole book by name and every card came up
 * empty. Each line carries its own id.
 */
interface SideLines {
  batting: readonly { id: string; ab: number; h: number; hr: number; rbi: number }[];
  pitching: readonly { id: string; outs: number; k: number; er: number }[];
  hits: number;
  runs: number;
  walkOffBy?: string | null;
}

/**
 * Read one finished game for the user's side and write down whatever deserves
 * remembering. Called from `recordResult`, which is the single funnel every
 * game the user's program plays — simulated or managed — already passes
 * through.
 */
export function noteMoments(
  moments: Record<string, Moment[]>,
  us: SideLines, them: SideLines,
  meta: { year: number; day: number; vs: string; postseason?: boolean },
): void {
  const add = (id: string, kind: MomentKind, line: string): void => {
    const list = moments[id] ?? [];
    list.push({
      year: meta.year, day: meta.day, kind, line, vs: meta.vs,
      ...(meta.postseason ? { postseason: true } : {}),
    });
    // The cap drops the least of him, never the best of him.
    if (list.length > MOMENT_CAP) {
      list.sort((a, b) => RANK[b.kind] - RANK[a.kind] || a.year - b.year);
      list.length = MOMENT_CAP;
      list.sort((a, b) => a.year - b.year || a.day - b.day);
    }
    moments[id] = list;
  };

  for (const l of us.batting) {
    if (l.h >= 5) add(l.id, 'five', `Went ${l.h} for ${l.ab} against ${meta.vs}.`);
    else if (l.h === 4) add(l.id, 'four', `A four-hit day against ${meta.vs}.`);
    if (l.hr >= 3) add(l.id, 'hrs3', `Three home runs in one game against ${meta.vs}.`);
    else if (l.hr === 2 && l.rbi >= 6) {
      add(l.id, 'bigday', `Two homers and ${l.rbi} driven in against ${meta.vs}.`);
    }
  }
  if (us.walkOffBy) {
    add(us.walkOffBy, 'walkoff', `Walked it off against ${meta.vs}.`);
  }

  // The arms. A complete game is one man in the pitching book.
  if (us.pitching.length === 1) {
    const p = us.pitching[0]!;
    if (p.outs >= 27 && them.hits === 0) {
      add(p.id, 'nohitter', `A no-hitter against ${meta.vs}. Nine innings, nobody hit.`);
    } else if (p.outs >= 27 && them.runs === 0 && p.k >= 8) {
      add(p.id, 'shutout', `A complete-game shutout of ${meta.vs}, ${p.k} strikeouts.`);
    }
  }
  for (const p of us.pitching) {
    if (p.k >= 12) add(p.id, 'ks', `${p.k} strikeouts in one night against ${meta.vs}.`);
  }
}

// ---------------------------------------------------------------------------
// The professional game
// ---------------------------------------------------------------------------

/** What the save durably keeps of a man who left — one row, written in June. */
export interface AlumnusNote {
  name: string;
  teamAbbr: string;
  /** The year he left. */
  year: number;
  reason: 'drafted' | 'graduated' | 'walk-on';
  round?: number;
  overall: number;
  classYear: string;
}

export interface ProYear {
  year: number;
  /** Where he spent it. */
  level: string;
  /** One line of what the summer was. */
  line: string;
  /** True on the year the career ends. */
  final?: boolean;
  /** True on the year he reached the top level — the one promotion a coach's inbox marks. */
  debut?: boolean;
}

const LEVELS = ['ROOKIE BALL', 'SINGLE-A', 'DOUBLE-A', 'TRIPLE-A', 'THE SHOW'] as const;

/**
 * The same stable string hash everything derived uses — mixed, which the old
 * one was not.
 *
 * It was `h = h * 31 + c`, and the loop below reads four different byte ranges
 * out of one hash to get four independent per-year answers. A polynomial hash
 * with a small multiplier does not give you that: appending ":pro:2031" versus
 * ":pro:2032" changes the LOW bits and barely disturbs the high ones, so every
 * shifted read came back the same number year after year.
 *
 * Measured 2026-09-11 over three hundred men and twenty seasons each — distinct
 * values a man saw in his career, out of twenty:
 *
 *   washPct   h % 100        20.0     nobody frozen
 *   movePct   (h >> 8) % 100  1.2     226 of 300 frozen for life
 *   allStar   (h >> 16) % 100 1.0     300 of 300 frozen for life
 *   retire    (h >> 24) % 100 1.0     300 of 300 frozen for life
 *
 * Three of the four rolls were not rolls. A man was stamped once and lived the
 * same summer over and over: an All-Star every single season or never one
 * (39 men of 400 were All-Stars in all twenty years and the other 361 in none),
 * promoted every year he was eligible or never, and retiring on a threshold
 * rather than a chance. It is also why 39% of drafted men reached the top level
 * against a real-world sixteen or so.
 *
 * FNV-1a with an avalanche finalizer, the same shape `progression.ts` uses for
 * its arcs. Every bit of the output now depends on every bit of the input.
 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  // Avalanche. Without this the top bytes of an FNV hash still carry less of
  // the late input than the bottom ones, which is exactly the fault above.
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  // Masked to thirty-one bits, and that is not cosmetic. The callers read this
  // with a SIGNED shift (`h >> 8`), so a value above 2^31 shifts negative, and
  // `negative % 100 < pct` is true for every pct — the roll would always pass.
  // The old hash returned `Math.abs`, which is what kept that safe.
  return ((h ^ (h >>> 16)) >>> 0) & 0x7fffffff;
}

/**
 * What a summer in the big leagues was.
 *
 * It used to be one coin: nine percent an All-Star, otherwise "A full season in
 * the big leagues." Two things wrong with that, and the first is the one a
 * player reported — *"many of them end up becoming all stars in the majors"*.
 *
 * The coin did not read `talent`, though every other roll in the career does,
 * so a fifteenth-rounder scraping onto a roster had exactly the same claim on
 * an All-Star summer as a first-round bat. And the hash it read was frozen for
 * life (see `hash`), so a man was an All-Star every season or never one.
 * Between them: 4.9 All-Star summers apiece out of 6.9 seasons up there, for
 * one man in eight.
 *
 * The rates below are set against the real thing, per player-season, and are
 * deliberately gated on talent so they concentrate where they do in life:
 *
 *   MVP or Cy Young   4 of about 1200 men       — here, the elite only, rarely
 *   All-Star         64 of about 1200 men       — here, 0% to 26% by talent
 *   Gold Glove etc   36 of about 1200 men       — here, the good, occasionally
 *   hurt most of it  roughly one man in eleven  — here, flat: it happens to all
 *
 * Everybody else gets a season described for what it was, because "a full
 * season in the big leagues" said the same thing about a first-division
 * regular and a man carried as a twenty-sixth arm.
 */
function bigLeagueSummer(flavour: number, talent: number, proYears: number): string {
  // Hurt. Independent of quality, which is the point of it.
  if (flavour % 100 < 9) {
    return proYears <= 2
      ? 'Lost most of the summer to an injury. A hard way to start.'
      : 'Most of the season went to the training room.';
  }
  // The two awards a college coach would frame. The gate is severe on purpose:
  // this is four men in the sport in a year.
  if (talent >= 26 && (flavour >> 7) % 100 < 6) {
    return 'Finished top three in the MVP voting. They still show the tape at home.';
  }
  const starPct = Math.max(0, Math.min(26, Math.round(talent - 9)));
  if ((flavour >> 13) % 100 < starPct) {
    return 'An All-Star summer. The kind of year a program frames.';
  }
  if (talent >= 14 && (flavour >> 19) % 100 < 8) {
    return 'Took home a Gold Glove. The defence was never the question.';
  }
  if (talent >= 12) {
    return (flavour >> 25) % 2 === 0
      ? 'An everyday player all summer, in the middle of the order.'
      : 'A full season in the big leagues, and a regular in the lineup.';
  }
  if (talent >= 4) {
    return (flavour >> 25) % 2 === 0
      ? 'In and out of the lineup, and on the roster all year.'
      : 'A useful season in a part-time role.';
  }
  return (flavour >> 25) % 2 === 0
    ? 'Up and down all year, and hung on to the roster spot.'
    : 'A bench summer. Being there at all is the achievement.';
}

/** And a summer that was not in the big leagues. */
function minorSummer(level: string, yearsThere: number): string {
  const where = level.toLowerCase().replace('-a', '-A');
  if (yearsThere >= 3) return `A third year at ${where}. The clock is loud now.`;
  if (yearsThere === 2) return `Repeated ${where}. Not everybody moves every year.`;
  return `Another summer at ${where}.`;
}

/**
 * A drafted man's professional career, derived year by year.
 *
 * Nothing is stored and nothing is drawn: the same man always lives the same
 * life, computed fresh whenever a card asks. The shape follows the real
 * pyramid — most careers stall in the middle of it, a first-rounder starts
 * higher and survives longer, and washing out is what usually happens, which
 * is what makes the man who reaches the show worth the card that remembers
 * where he came from.
 */
export function proCareer(id: string, note: AlumnusNote, throughYear: number): ProYear[] {
  if (note.reason !== 'drafted') {
    // The undrafted senior's one line. A few sign somewhere small anyway.
    if (throughYear <= note.year) return [];
    const indie = hash(`${id}:indie`) % 100 < 18;
    return [{
      year: note.year + 1,
      level: indie ? 'INDEPENDENT BALL' : 'HOME',
      line: indie
        ? 'Signed on with an independent club for a summer, then hung them up.'
        : 'The baseball ended in June. The degree did not.',
      final: true,
    }];
  }

  const round = note.round ?? 10;
  let level = round <= 2 ? 2 : round <= 5 ? 1 : 0;
  const talent = note.overall - 55 + (3 - Math.min(3, round)) * 4;
  /** Summers at the level he is standing on, so a repeat reads as one. */
  let atLevel = 1;
  const rows: ProYear[] = [];

  for (let y = note.year + 1; y <= throughYear; y++) {
    const age = y - note.year;
    const h = hash(`${id}:pro:${y}`);
    // Washing out gets likelier every year a man is not advancing, and the
    // middle of the pyramid is where it happens.
    const washPct = Math.max(4, 16 + age * 5 - talent - level * 4);
    if (h % 100 < washPct) {
      rows.push({
        year: y,
        level: LEVELS[level]!,
        line: age <= 2
          ? 'Released in the spring. It ends that quickly for most.'
          : `Released after ${age} seasons. Further than most ever get.`,
        final: true,
      });
      return rows;
    }
    /*
      And then it ends.

      Reported from a long dynasty: "I don't think you set a retirement year — I had a
      guy who had been an All-Star for twenty two years." Washing out was the
      only exit, and at the top of the pyramid it floors at four percent a
      year, so a good enough man simply never left. A career has a length as
      well as a ceiling: after eight professional seasons the odds of a last
      one climb steeply, and nobody plays a twentieth.
    */
    const proYears = age;
    const retirePct = proYears < 8 ? 0 : Math.min(90, (proYears - 7) * 11);
    if (proYears >= 20 || (h >> 24) % 100 < retirePct) {
      rows.push({
        year: y,
        level: LEVELS[level]!,
        line: level === LEVELS.length - 1
          ? "Retired after " + proYears + " years in the big leagues. A career."
          : "Hung them up after " + proYears + " years in the minors.",
        final: true,
      });
      return rows;
    }
    /*
      Re-tuned 2026-09-11, when `hash` started mixing.

      This was `min(72, 34 + talent)`, and it looked generous because it was
      never actually rolled: `(h >> 8) % 100` was frozen for life for 226 men
      in 300, so a man with a favourable number climbed a level EVERY year and
      the rest never climbed at all. Four levels in four years, for anybody
      whose stamp happened to be low. That is why 39% of drafted men reached
      the top level against a real world sixteen.

      With the roll working, 34 + talent sent 7.7% of them up — a genuine
      four-promotion gauntlet with wash-out firing every year in between. 56
      puts it at 16.3%, which is the real number, and the gradient by round
      reads the way it should: 75% of the first two rounds, 30% of rounds six
      to ten, 10% of the rest.
    */
  const movePct = Math.min(80, 56 + talent);
    if (level < LEVELS.length - 1 && (h >> 8) % 100 < movePct) {
      level++;
      atLevel = 1;
      const called = level === LEVELS.length - 1;
      rows.push({
        year: y,
        level: LEVELS[level]!,
        line: called
          ? 'Called up. Everything before this was the road here.'
          : `Moved up to ${LEVELS[level]!.toLowerCase().replace('-a', '-A')}.`,
        ...(called ? { debut: true } : {}),
      });
    } else {
      atLevel++;
      // Its own hash rather than another slice of `h`: four byte ranges are
      // already spoken for above, and a fifth read of the same number is how
      // the frozen-roll fault got in.
      const flavour = hash(`${id}:pro:${y}:summer`);
      rows.push({
        year: y,
        level: LEVELS[level]!,
        line: level === LEVELS.length - 1
          ? bigLeagueSummer(flavour, talent, age)
          : minorSummer(LEVELS[level]!, atLevel),
      });
    }
  }
  return rows;
}
