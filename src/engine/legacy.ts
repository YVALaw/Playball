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
}

const LEVELS = ['ROOKIE BALL', 'SINGLE-A', 'DOUBLE-A', 'TRIPLE-A', 'THE SHOW'] as const;

/** The same stable string hash everything derived uses. */
function hash(s: string): number {
  let h = 7919;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
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
    const movePct = Math.min(72, 34 + talent);
    if (level < LEVELS.length - 1 && (h >> 8) % 100 < movePct) {
      level++;
      rows.push({
        year: y,
        level: LEVELS[level]!,
        line: level === LEVELS.length - 1
          ? 'Called up. Everything before this was the road here.'
          : `Moved up to ${LEVELS[level]!.toLowerCase().replace('-a', '-A')}.`,
      });
    } else {
      const star = level === LEVELS.length - 1 && (h >> 16) % 100 < 9;
      rows.push({
        year: y,
        level: LEVELS[level]!,
        line: star
          ? 'An All-Star summer. The kind of year a program frames.'
          : level === LEVELS.length - 1
            ? 'A full season in the big leagues.'
            : `Another summer at ${LEVELS[level]!.toLowerCase().replace('-a', '-A')}.`,
      });
    }
  }
  return rows;
}
