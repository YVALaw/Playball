// inbox.ts
// What happened to your world, kept until you want to read it.
//
// The problem this solves is that everything worth telling a coach was already
// being told badly. A job offer sat on the program page waiting to be noticed. A
// board verdict lived on one offseason screen and was gone the moment the step
// advanced. Your men being drafted was a screen you pressed through. Achievements
// did not exist. And the ninety five other careers B7 just started — a coach
// sacked, a rival poached by a bigger school — had nowhere to go at all, which
// would have made the whole carousel invisible: ninety five men living lives the
// player never hears about is the same as ninety five men not existing.
//
// So the two failure modes to design against are opposite and both real. One is
// the modal that interrupts you to say something you did not need at that
// moment. The other is the thing that never surfaces. An inbox is the answer to
// both: it accumulates, it is visible as a count from wherever you are, and
// nothing in the game waits on it being opened.
//
// **It is not the wire, and it sits beside it rather than inside it.** They
// answer the same question — what happened while I was not looking — and they
// answer it about different things with different lifetimes. `wire()` is derived
// fresh from the live season every render and thrown away: it is the country's
// news, it is *about* nobody in particular, and a row of it stops being true the
// moment another day is simulated. This is written down once, is about you, and
// survives fifteen years and a reload. Merging them would put a row that
// evaporates when you press "next day" in the same scroll as a row from your
// first season, under one heading, with two different rules for disappearing.
// Two screens on the same tab is the honest shape: same question, next to each
// other, still distinguishable.

/** Where an item came from. The screen colours and groups by this. */
export type InboxKind =
  | 'board'
  | 'offer'
  | 'achievement'
  | 'draft'
  | 'carousel'
  | 'hall';

export interface InboxItem {
  /** Unique, and stable across a reload so React keys do not shuffle. */
  id: string;
  /** The season it belongs to, which is how the list is grouped. */
  year: number;
  kind: InboxKind;
  /** One line, in the sentence case the rest of the app uses for headlines. */
  title: string;
  /** A sentence or two under it. Never essential — the title carries it. */
  body: string;
  read: boolean;
}

export const INBOX_LABEL: Record<InboxKind, string> = {
  board: 'THE BOARD',
  offer: 'AN OFFER',
  achievement: 'ACHIEVEMENT',
  draft: 'THE DRAFT',
  carousel: 'THE CAROUSEL',
  // Its own kind rather than folded in with achievements, which are the coach's.
  // This is the one thing the inbox says about somebody else: a man who played
  // for you, honoured for what he did while he was here.
  hall: 'THE HALL',
};

/**
 * How many items are kept.
 *
 * A twenty year career at the rate this posts is somewhere near two hundred
 * items, which is a scroll nobody reaches the bottom of and a chunk of a save
 * file spent on things that were read once. Eighty is roughly six seasons of
 * history — long enough that last year is always there and the year before it
 * usually is, short enough that the list stays a list.
 *
 * The permanent record of a career is elsewhere and always was: the history
 * screen has every season, the record book has every mark, and the coach page
 * has the cabinet. Nothing is *only* here.
 */
export const INBOX_LIMIT = 80;

/**
 * Where the ids have got to. Module state, and deliberately not in the save.
 *
 * The obvious id is the clock, and the engine is not allowed to read it — a
 * seeded replay has to produce the same world twice and `Date.now` is the one
 * input that never will. A counter is deterministic instead, and the only thing
 * it has to survive is a reload, which `restoreInbox` handles by winding it past
 * whatever the save came back with. An id is a React key and nothing else reads
 * it, so that is the whole of the requirement.
 */
let counter = 0;

/** For tests, which need two runs of the same script to agree. */
export const resetInboxIds = (): void => { counter = 0; };

/** A new item, unread, with an id nothing else in the list will collide with. */
export function newItem(item: Omit<InboxItem, 'id' | 'read'>): InboxItem {
  counter += 1;
  return { ...item, id: `${item.year}-${counter}`, read: false };
}

/** Newest first, and trimmed. */
export function push(inbox: readonly InboxItem[], item: InboxItem): InboxItem[] {
  return [item, ...inbox].slice(0, INBOX_LIMIT);
}

export const unreadCount = (inbox: readonly InboxItem[]): number =>
  inbox.reduce((n, i) => n + (i.read ? 0 : 1), 0);

/** Everything read. What opening the screen does, and the only way to clear it. */
export const markAllRead = (inbox: readonly InboxItem[]): InboxItem[] =>
  (inbox.every((i) => i.read) ? [...inbox] : inbox.map((i) => ({ ...i, read: true })));

/**
 * A list off the disk, with anything malformed dropped.
 *
 * Same argument as `restoreAchievements`: this is structure-cloned straight back
 * in, and one item written by a build that named its fields differently would
 * reach the screen as a card with `undefined` in the headline.
 */
export function restoreInbox(saved: unknown): InboxItem[] {
  if (!Array.isArray(saved)) return [];
  const out: InboxItem[] = [];
  for (const raw of saved) {
    if (!raw || typeof raw !== 'object') continue;
    const i = raw as Partial<InboxItem>;
    if (typeof i.id !== 'string' || typeof i.title !== 'string') continue;
    if (typeof i.year !== 'number') continue;
    if (!(i.kind && i.kind in INBOX_LABEL)) continue;
    // Wind the counter past anything that came back, so the first item posted
    // after a reload cannot be handed an id a restored card is already using.
    // Two cards with the same React key is a list that reorders itself.
    const seen = Number(i.id.slice(i.id.indexOf('-') + 1));
    if (Number.isFinite(seen) && seen > counter) counter = seen;
    out.push({
      id: i.id, year: i.year, kind: i.kind,
      title: i.title, body: typeof i.body === 'string' ? i.body : '',
      read: i.read === true,
    });
  }
  return out.slice(0, INBOX_LIMIT);
}
