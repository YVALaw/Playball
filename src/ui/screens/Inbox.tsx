// Inbox.tsx
// Mail, not notification cards.
//
// The inbox now behaves like a real mailbox: sender, subject, preview, date,
// unread state, then a letter with From / To / Subject when opened. Nothing in
// the list is allowed to shrink to one word per line; the row owns a min-width
// zero text column and normal word wrapping explicitly.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronRightIcon, EnvelopeClosedIcon } from '@radix-ui/react-icons';
import { useDynasty } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { useOpenTeam } from './TeamCard.js';
import { INBOX_LABEL, type InboxItem, type InboxKind, type InboxLink } from '../../engine/inbox.js';
import type { PlayerId } from '../../engine/types.js';
import { assistantFor } from '../../engine/program.js';
import { InFrame } from '../Overlay.js';

const KIND_TONE: Record<InboxKind, string> = {
  board: 'var(--clay)', offer: 'var(--clay)', wire: 'var(--clay)',
  achievement: 'var(--win)', draft: 'var(--ink)', carousel: 'var(--dim)',
  hall: 'var(--clay)', record: 'var(--win)', season: 'var(--dim)',
};

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
      case 'schedule': openOverlay('schedule'); return;
    }
  };
}

function ctaLabel(link: InboxLink): string {
  switch (link.to) {
    case 'player': return 'OPEN PLAYER';
    case 'team': return 'OPEN PROGRAM';
    case 'book': return 'OPEN THE BOOK';
    case 'schedule': return 'OPEN SCHEDULE';
    case 'program': return link.sheet === 'board' ? 'OPEN BOARD'
      : link.sheet === 'hall' ? 'OPEN HALL OF FAME' : 'OPEN PROGRAM';
  }
}

function senderFor(item: InboxItem, assistant: string): string {
  switch (item.kind) {
    case 'board': return 'Athletic Board';
    case 'offer': return 'Athletic Department';
    case 'wire': return 'The Wire Desk';
    case 'draft': return 'Draft Desk';
    case 'carousel': return 'Coaching Carousel';
    case 'record': return 'Record Book';
    case 'hall': return 'Program Hall';
    case 'achievement': return 'Program Office';
    case 'season': return assistant;
  }
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function Inbox() {
  const inbox = useDynasty((s) => s.inbox);
  const readInbox = useDynasty((s) => s.readInbox);
  const coach = useDynasty((s) => s.coach.name);
  const assistant = assistantFor(coach);
  const open = useOpen();
  const [reading, setReading] = useState<InboxItem | null>(null);
  const [fresh] = useState(() => new Set(
    useDynasty.getState().inbox.filter((i) => !i.read).map((i) => i.id),
  ));

  useEffect(() => { readInbox(); }, [readInbox]);

  const rows = useMemo(() => [...inbox], [inbox]);

  return (
    <FixedHeader
      header={
        <header className="mailbox-head">
          <span className="mailbox-head-icon"><EnvelopeClosedIcon /></span>
          <span>
            <small>{assistant.toUpperCase()} · YOUR RIGHT HAND</small>
            <strong>Inbox</strong>
            <em>{rows.length} message{rows.length === 1 ? '' : 's'}</em>
          </span>
        </header>
      }
    >
      <main className="mailbox-workspace">
        {rows.length === 0 ? (
          <section className="mailbox-empty">
            <EnvelopeClosedIcon />
            <strong>Inbox zero</strong>
            <p>{assistant} will put something here when it deserves your attention.</p>
          </section>
        ) : (
          <section className="mailbox-list" aria-label="Messages">
            {rows.map((item) => {
              const sender = senderFor(item, assistant);
              const isFresh = fresh.has(item.id);
              return (
                <button
                  key={item.id}
                  className={`mailbox-row tap${isFresh ? ' unread' : ''}`}
                  type="button"
                  onClick={() => setReading(item)}
                >
                  <span className="mailbox-avatar" style={{ '--mail-tone': KIND_TONE[item.kind] } as CSSProperties}>
                    {initials(sender)}
                  </span>
                  <span className="mailbox-copy">
                    <span className="mailbox-meta">
                      <strong>{sender}</strong>
                      <time>{item.year}</time>
                    </span>
                    <b>{item.title}</b>
                    <p>{item.body || INBOX_LABEL[item.kind]}</p>
                  </span>
                  <span className="mailbox-edge">
                    {isFresh && <i aria-label="Unread" />}
                    <ChevronRightIcon />
                  </span>
                </button>
              );
            })}
          </section>
        )}

        {reading && (
          <OpenLetter
            item={reading}
            sender={senderFor(reading, assistant)}
            recipient={coach}
            signed={assistant}
            onGo={open}
            onClose={() => setReading(null)}
          />
        )}
      </main>
    </FixedHeader>
  );
}

function OpenLetter(
  { item, sender, recipient, signed, onGo, onClose }:
  {
    item: InboxItem; sender: string; recipient: string; signed: string;
    onGo: (l: InboxLink) => void; onClose: () => void;
  },
) {
  return (
    <InFrame>
      <div className="mail-scrim fade-in" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.title}>
        <article className="mail-open mail-open-modern rise-in" onClick={(e) => e.stopPropagation()}>
          <header className="mail-open-toolbar">
            <button type="button" className="tap" onClick={onClose}>‹ Inbox</button>
            <small>{INBOX_LABEL[item.kind]} · {item.year}</small>
          </header>
          <section className="mail-open-envelope">
            <h2>{item.title}</h2>
            <dl>
              <div><dt>From</dt><dd>{sender}</dd></div>
              <div><dt>To</dt><dd>Coach {recipient}</dd></div>
              <div><dt>Subject</dt><dd>{item.title}</dd></div>
            </dl>
          </section>
          <section className="mail-open-body">
            <p>{item.body || 'No more than the subject line, Coach.'}</p>
            <p className="mail-sign">— {signed}</p>
          </section>
          <footer>
            {item.link && (
              <button className="primary-command tap" type="button" onClick={() => {
                const link = item.link; onClose(); if (link) onGo(link);
              }}>{ctaLabel(item.link)}</button>
            )}
            <button className="mail-close tap" type="button" onClick={onClose}>BACK TO INBOX</button>
          </footer>
        </article>
      </div>
    </InFrame>
  );
}
