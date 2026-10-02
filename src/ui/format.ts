// format.ts
// Presentation-only helpers. The engine deliberately has no Date anywhere — a
// day is an integer offset from opening day, which is what lets a season replay
// exactly from its seed. Turning that into a calendar is this layer's job.

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

/**
 * Opening day, and it has to be a Monday.
 *
 * The schedule builder treats a week as seven days from an implicit Monday: the
 * non-conference game lands on day 1 and the weekend series on days 4, 5 and 6.
 * Anchoring the calendar to an arbitrary date breaks that — pinning it to
 * February 12 made a midweek game read "SAT". So find the first Monday of
 * February and count from there, which is also roughly when the real season
 * opens.
 */
function openingDay(year: number): Date {
  // A non-finite year makes an invalid Date, whose getDay() is NaN — and NaN
  // is never Monday, so the loop below never ended and the tab locked solid
  // (05 §62.6). Bounded, and a bad year falls back to a real one.
  const d = new Date(Number.isFinite(year) ? year : 2025, 1, 1);
  for (let i = 0; i < 7 && d.getDay() !== 1; i++) d.setDate(d.getDate() + 1);
  return d;
}

export function seasonDate(year: number, dayOffset: number): string {
  const d = openingDay(year);
  d.setDate(d.getDate() + dayOffset);
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const DAY_NAME: Record<string, string> = {
  SUN: 'Sunday', MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday',
};
const MONTH_NAME: Record<string, string> = {
  JAN: 'January', FEB: 'February', MAR: 'March', APR: 'April', MAY: 'May', JUN: 'June',
  JUL: 'July', AUG: 'August', SEP: 'September', OCT: 'October', NOV: 'November', DEC: 'December',
};

/** "Tuesday, March 2" from the season calendar. */
export function longDate(year: number, day: number): string {
  const [d, m, n] = seasonDate(year, day).split(' ');
  return `${DAY_NAME[d!] ?? d}, ${MONTH_NAME[m!] ?? m} ${n}`;
}

/** "Mar 2" and "Tue" from the season calendar. */
export function shortDate(year: number, day: number): { weekday: string; date: string } {
  const [d, m, n] = seasonDate(year, day).split(' ');
  const cap = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase();
  return { weekday: cap(d ?? ''), date: `${cap(m ?? '')} ${n}` };
}

export const pct = (v: number): string => v.toFixed(3).replace(/^0/, '');

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/**
 * "Emiliano Gravestock" becomes "E. Gravestock"; a one-word name stays whole.
 * For rows that share their width with numbers: the lineup's three stat
 * columns and the recruiting board's stars cut every full name to
 * "Emiliano Grave…" on a phone. The card a row opens has the full name.
 */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]!.charAt(0)}. ${parts.slice(1).join(' ')}` : name;
}

/**
 * Innings pitched the way a box score writes them: 12.2 is twelve and two
 * thirds, never 12.7. The cards, the roster and the team card printed the
 * decimal fraction against the box score's notation (15 sD).
 */
export function ipText(innings: number): string {
  const outs = Math.round(innings * 3);
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

/**
 * A line of the engine's log, as a sentence and a count.
 *
 * The engine writes "[0-1 2p] Eduardo Beasley singles. (R vs RHP)": the count
 * and pitches in brackets, the handedness in parentheses, and tags such as
 * [bunt] for called plays. The screen prints the sentence, and the count as
 * the line's meta, in words.
 */
/**
 * A runner's part of the play just before it: a force, a run home, a base
 * taken, the winning run. The engine writes these on their own indented lines
 * after the batter's line, so a screen that shows only the last line showed
 * "Smith is forced at second" and never the double play that caused it.
 */
const RUNNER_NOTE = / is forced (?:at|home)| scores from | tags and scores| moves to (?:second|third)| to (?:second|third|home)\.$| is thrown out trying| win it\.$/;

/**
 * One play: the batter's line, his count, and what the runners did on it.
 * `atBat` is false for what happens between pitches: a steal, a wild pitch,
 * a pitching change, a pinch hitter.
 */
export interface Play { text: string; count?: string; notes: string[]; atBat: boolean }

/**
 * The game log as plays rather than lines. Runner notes join the play they
 * belong to; a steal, a pitching change, a pinch hitter or a wild pitch is a
 * play of its own. Inning headers are dropped.
 */
export function groupPlays(lines: readonly string[]): Play[] {
  const out: Play[] = [];
  for (const raw of lines) {
    if (raw.startsWith('\n') || /^---/.test(raw.trim())) continue;
    const { text, count } = cleanPlay(raw);
    if (!text) continue;
    const last = out[out.length - 1];
    if (/^\s/.test(raw) && last && RUNNER_NOTE.test(text)) { last.notes.push(text); continue; }
    out.push({ text, count, notes: [], atBat: !/^\s/.test(raw) });
  }
  return out;
}

/**
 * Everything the last call set off: a steal or a wild pitch during the at-bat,
 * the at-bat itself, and a pitching change after it. Showing only the at-bat
 * left a run that scored on a wild pitch with nothing on screen to explain it.
 */
export function lastStep(plays: readonly Play[]): Play[] {
  let seen = 0;
  for (let i = plays.length - 1; i >= 0; i--) {
    if (!plays[i]?.atBat) continue;
    seen += 1;
    if (seen === 2) return plays.slice(i + 1);
  }
  return plays.slice();
}

export function cleanPlay(raw: string): { text: string; count?: string } {
  let text = raw.trim();
  let count: string | undefined;
  const c = /^\[(\d)-(\d)\s+(\d+)p\]\s*/.exec(text);
  if (c) {
    count = `Count ${c[1]}–${c[2]} · ${c[3]} ${c[3] === '1' ? 'pitch' : 'pitches'}`;
    text = text.slice(c[0].length);
  }
  text = text.replace(/^\[[a-z]+\]\s*/i, '').replace(/\s*\((?:[LRS]) vs [LR]HP\)\s*$/, '').trim();
  // "singles, 2 in." says the runs that scored on the play.
  text = text.replace(/, (\d+) in\./, (_, n: string) => (n === '1' ? ', and a run scores.' : `, and ${n} runs score.`));
  return { text, count };
}
