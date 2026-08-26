// Inbox.tsx
// What happened to you, kept until you want it.
//
// It sits next to the wire rather than inside it, and the reason is in
// `engine/inbox.ts`: the wire is derived fresh from the live season and thrown
// away, this is written down once and survives a career. Same question, next to
// each other, still distinguishable.
//
// Opening the screen marks everything read. That is the whole interaction, and
// it is deliberate — a card with a tick on it is a chore, and reading is not
// supposed to be one. Nothing in the game waits on this screen: every item here
// either happened already or is available somewhere it can be acted on.
//
// A card is now the way *to* the thing it is about. Reported, and correctly:
// "a notification you cannot act on is pointless" — the card named a man, a
// verdict, a program, and none of them opened. Every kind that has a
// destination carries one (see `InboxLink`), and the kinds that genuinely have
// none — how many of your men were drafted is not a place — are drawn as flat
// cards with no arrow, so which is which is visible before it is tapped rather
// than after.

import { useEffect, useMemo } from 'react';
import { useDynasty } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { useOpenTeam } from './TeamCard.js';
import {
  INBOX_LABEL, type InboxItem, type InboxKind, type InboxLink,
} from '../../engine/inbox.js';
import type { PlayerId } from '../../engine/types.js';

/**
 * The stripe down the left of a card.
 *
 * Clay for the things that are about your job, ink for the things that are
 * about the sport. The board and an offer are the two that can change what you
 * do next, so they are the two that are allowed to be loud.
 */
const KIND_TONE: Record<InboxKind, string> = {
  board: 'var(--clay)',
  offer: 'var(--clay)',
  achievement: 'var(--win)',
  draft: 'var(--ink)',
  carousel: 'var(--dim)',
  // Clay, with the achievements and the board. An induction is not something you
  // have to act on, but it is the loudest good news a program ever gets.
  hall: 'var(--clay)',
  // The two in-season kinds. A mark in the book is permanent and reads with the
  // hall; the season's own news is the quietest thing here.
  record: 'var(--win)',
  season: 'var(--dim)',
};

/**
 * Where a card goes, resolved against the three frames the app can be in.
 *
 * Every destination is an overlay or a card, because the inbox is reachable
 * from the offseason and the postseason now — and in both of those the tab bar
 * does not exist, so anything that navigated by tab would be dead exactly where
 * the inbox has the most to say.
 */
function useOpen(): (link: InboxLink) => void {
  const openPlayer = useDynasty((s) => s.openPlayer);
  const openOverlay = useDynasty((s) => s.openOverlay);
  const setProgramSheet = useDynasty((s) => s.setProgramSheet);
  const openTeam = useOpenTeam();
  return (link) => {
    switch (link.to) {
      case 'player': openPlayer(link.id as PlayerId); return;
      case 'team': openTeam(link.index); return;
      case 'program': setProgramSheet(link.sheet); openOverlay('program'); return;
      case 'book': openOverlay('book'); return;
      case 'schedule': openOverlay('schedule');
    }
  };
}

export function Inbox() {
  const inbox = useDynasty((s) => s.inbox);
  const readInbox = useDynasty((s) => s.readInbox);
  const open = useOpen();

  /*
    Read on arrival, not on the way out.

    Marking on unmount reads better in the abstract and is wrong here: the app
    unmounts a screen on a tab change, a phase change and an overlay, so the
    badge would clear for a player who tapped INBOX and immediately tapped away
    without seeing a word of it. Arriving is the act of reading.
  */
  useEffect(() => { readInbox(); }, [readInbox]);

  // Grouped by season, newest first. A flat list of forty cards reads as one
  // undifferentiated wall; a year heading is the only structure it needs,
  // because the year is what the player is orienting by.
  const years = useMemo(() => {
    const out: { year: number; items: InboxItem[] }[] = [];
    for (const item of inbox) {
      const last = out[out.length - 1];
      if (last && last.year === item.year) last.items.push(item);
      else out.push({ year: item.year, items: [item] });
    }
    return out;
  }, [inbox]);

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">WHAT HAPPENED TO YOU</div>
            <div style={{
              font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
            }}>The inbox</div>
          </div>
        </div>
      }
    >
      <div style={{ padding: '2px 14px 20px' }}>
        {inbox.length === 0 && (
          <div style={{
            marginTop: 16, padding: '18px 12px', border: '1px solid var(--faint)',
            background: 'var(--paper)', textAlign: 'center',
            font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
          }}>
            Nothing yet. A run of wins, a record one of your men has taken, the
            board at the halfway mark, and then everything June brings — the
            verdict, the draft, the hall, and every coaching change in your
            conference.
          </div>
        )}

        {years.map(({ year, items }) => (
          <div key={year} style={{ marginTop: 12 }}>
            <div className="label" style={{
              marginBottom: 6, paddingBottom: 4,
              borderBottom: '1px solid var(--hairline)',
            }}>{year}</div>
            {items.map((item) => (
              <Card key={item.id} item={item} onOpen={open} />
            ))}
          </div>
        ))}
      </div>
    </FixedHeader>
  );
}

/**
 * One card, tappable or not.
 *
 * A button when it goes somewhere and a plain div when it does not — rather
 * than a button that shrugs — so the difference is in the thing itself and not
 * in what happens after you press it. The arrow says the same thing again for
 * anybody who is skimming.
 */
function Card({ item, onOpen }: { item: InboxItem; onOpen: (l: InboxLink) => void }) {
  const tone = KIND_TONE[item.kind];
  const body = (
    <>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 3, gap: 8,
      }}>
        <span style={{
          font: "700 8px var(--mono)", letterSpacing: '.14em', color: tone,
        }}>{INBOX_LABEL[item.kind]}</span>
        {/* The dot survives the visit that clears it, because the state was
            read before this rendered. It is the only thing distinguishing what
            is new from what has been sitting here since March. */}
        {!item.read && (
          <span style={{
            font: "700 8px var(--mono)", letterSpacing: '.12em', color: 'var(--clay)',
          }}>NEW</span>
        )}
      </div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8,
      }}>
        <div style={{
          flex: 1, font: "700 14px/1.25 var(--display)", textTransform: 'uppercase',
        }}>{item.title}</div>
        {item.link && (
          <span style={{
            flex: 'none', font: "700 13px var(--mono)", color: tone,
          }}>›</span>
        )}
      </div>
      {item.body !== '' && (
        <div style={{
          marginTop: 4, font: "400 12px/1.5 var(--body)", color: 'var(--dim)',
        }}>{item.body}</div>
      )}
    </>
  );

  const skin = {
    width: '100%', textAlign: 'left' as const, display: 'block',
    padding: '10px 12px', marginBottom: 6,
    background: 'var(--paper)',
    border: '1px solid var(--faint)',
    borderLeft: `3px solid ${tone}`,
  };

  if (!item.link) return <div style={skin}>{body}</div>;
  const link = item.link;
  return (
    <button className="tap" style={skin} onClick={() => onOpen(link)}>{body}</button>
  );
}
