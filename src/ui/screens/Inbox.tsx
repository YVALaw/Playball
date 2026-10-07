// Inbox.tsx
// Mail from the people around the program, opened from the bell in the header.
//
// A list of letters: who it is from, when, the subject in bold while unread, a
// line of preview and an unread dot. A letter opens as a sheet with one close
// control and, when it points somewhere, one button that names the place.

import { useMemo, useState } from 'react';
import { useDynasty } from '../../state/store.js';
import { useOpenTeam } from './TeamCard.js';
import { type InboxItem, type InboxKind, type InboxLink } from '../../engine/inbox.js';
import type { PlayerId } from '../../engine/types.js';
import { assistantFor } from '../../engine/program.js';
import {
  Button, EmptyState, FeedItem, List, Monogram, ScreenHeader, Sheet,
} from '../components/ui/index.js';
import { plural } from '../words.js';

const KIND_NAME: Record<InboxKind, string> = {
  board: 'The board', offer: 'An offer', wire: 'News', achievement: 'Achievement', draft: 'The draft',
  carousel: 'Coaching moves', hall: 'Hall of Fame', record: 'Record book', season: 'The season',
  recruiting: 'Recruiting',
};

function useOpen(): (link: InboxLink) => void {
  const openPlayer = useDynasty((s) => s.openPlayer);
  const openOverlay = useDynasty((s) => s.openOverlay);
  const closeOverlay = useDynasty((s) => s.closeOverlay);
  const openRoom = useDynasty((s) => s.openRoom);
  const go = useDynasty((s) => s.go);
  const openTeam = useOpenTeam();
  return (link) => {
    switch (link.to) {
      case 'player': openPlayer(link.id as PlayerId); return;
      case 'team': openTeam(link.index); return;
      // A room over the inbox: the back press returns to the letters.
      // Between jobs the board room is the old school's, so an offer letter
      // opens the offers instead (M101).
      case 'program':
        if (link.sheet === 'board' && useDynasty.getState().jobSearch) { openOverlay('jobs'); return; }
        openRoom(link.sheet); return;
      case 'book': openOverlay('book'); return;
      case 'standings': openOverlay('standings'); return;
      case 'rankings': openOverlay('rankings'); return;
      case 'schedule': openOverlay('schedule'); return;
      // The one destination that is a screen rather than an overlay: the
      // inbox closes behind it, the way a nav tap would.
      case 'recruiting': closeOverlay(); go('office', 'recruiting'); return;
    }
  };
}

/** The button a letter offers, named for where it goes. */
function ctaLabel(link: InboxLink): string {
  switch (link.to) {
    case 'player': return 'Open the player';
    case 'team': return 'Open the program';
    case 'book': return 'Open the record book';
    case 'standings': return 'Open the standings';
    case 'rankings': return 'Open the national rankings';
    case 'schedule': return 'Open the schedule';
    case 'recruiting': return 'Open recruiting';
    case 'program': return link.sheet === 'board' ? 'Open the board'
      : link.sheet === 'hall' ? 'Open the Hall of Fame'
        : link.sheet === 'coach' ? 'Open your profile' : 'Open the program';
  }
}

function senderFor(item: InboxItem, assistant: string): string {
  switch (item.kind) {
    case 'board': return 'The athletic board';
    case 'offer': return 'An athletic department';
    case 'wire': return 'The news desk';
    case 'draft': return 'The draft desk';
    case 'carousel': return 'Coaching moves';
    case 'record': return 'The record book';
    case 'hall': return 'The Hall of Fame';
    case 'achievement': return 'The program office';
    case 'season': return assistant;
    case 'recruiting': return 'The recruiting desk';
  }
}

export function Inbox() {
  // The engine mutates in place; with Screen memoised this is what redraws it (M50).
  useDynasty((s) => s.version);
  const inbox = useDynasty((s) => s.inbox);
  const markInboxRead = useDynasty((s) => s.markInboxRead);
  const readInbox = useDynasty((s) => s.readInbox);
  const coach = useDynasty((s) => s.coach.name);
  const assistant = assistantFor(coach);
  const open = useOpen();
  const [reading, setReading] = useState<InboxItem | null>(null);
  const rows = useMemo(() => [...inbox], [inbox]);
  const unread = rows.filter((i) => !i.read).length;

  return (
    <div className="pb-scroll">
      <main className="pb-page">
        <ScreenHeader
          eyebrow={rows.length === 0 ? undefined : `${unread} unread · ${plural(rows.length, 'message')}`}
          title="Inbox"
          trailing={unread > 0 ? <Button variant="quiet" size="sm" icon="check" onClick={readInbox}>Mark all read</Button> : undefined}
        />
        {rows.length === 0 ? (
          <EmptyState icon="envelope" title="Nothing here" text={`${assistant} will write when something deserves your attention.`} />
        ) : (
          <List label="Messages">
            {rows.map((item) => {
              const sender = senderFor(item, assistant);
              return (
                <FeedItem
                  key={item.id}
                  lead={<Monogram name={sender.replace(/^(The|An) /, '')} tone={item.read ? 'neutral' : undefined} />}
                  meta={`${sender} · ${KIND_NAME[item.kind]} · ${item.year}`}
                  title={item.title}
                  text={item.body || undefined}
                  unread={!item.read}
                  onClick={() => { markInboxRead(item.id); setReading(item); }}
                />
              );
            })}
          </List>
        )}
      </main>
      {reading && (
        <Sheet
          eyebrow={`${KIND_NAME[reading.kind]} · ${reading.year}`}
          title={reading.title}
          subtitle={`From ${senderFor(reading, assistant)} to Coach ${coach}`}
          lead={<Monogram name={senderFor(reading, assistant).replace(/^(The|An) /, '')} size={44} />}
          onClose={() => setReading(null)}
          footer={reading.link ? (
            <Button
              variant="primary"
              block
              iconAfter="chevron-right"
              onClick={() => { const link = reading.link; setReading(null); if (link) open(link); }}
            >{ctaLabel(reading.link)}</Button>
          ) : undefined}
        >
          <p className="pb-text">{reading.body || 'No more than the subject line, Coach.'}</p>
          <p className="pb-text-muted">{'—'} {assistant}</p>
        </Sheet>
      )}
    </div>
  );
}
