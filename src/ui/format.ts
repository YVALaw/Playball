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

export const pct = (v: number): string => v.toFixed(3).replace(/^0/, '');
