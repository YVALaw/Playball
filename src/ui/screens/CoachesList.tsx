// CoachesList.tsx
// The coaches' wall: every career this world has seen finish, best first.
//
// The player hall is a ballot. This is not — a career is over when it is over
// and the only question is where it stands — so the men are ranked rather than
// inducted, and the ones over the bar wear a medal. Yours are marked, and there
// will be more of theirs than of yours: the country retires three coaches a
// year.
//
// Shared by the hall of fame room and the legacy screen's all-time sheet, so
// the two can never rank the same book two ways.

import { useState } from 'react';
import { inTheHall, type Legend } from '../../engine/retirement.js';
import { Button, Card, List, ListRow, Medal, SectionHeader, Tag } from '../components/ui/index.js';
import { plural, recordText } from '../words.js';

/** Best first: the score, then the trophies, then the wins, then the name. */
export function rankLegends(legends: readonly Legend[]): Legend[] {
  return [...legends].sort((a, b) => b.score - a.score
    || b.titles - a.titles
    || b.careerWins - a.careerWins
    || a.name.localeCompare(b.name));
}

export function CoachesList(
  { legends, title = 'Coaches', open = false }:
  {
    legends: readonly Legend[];
    title?: string;
    /** Start with every career showing, rather than the top eight. */
    open?: boolean;
  },
) {
  const [all, setAll] = useState(open);
  if (legends.length === 0) return null;
  const ranked = rankLegends(legends);
  const shown = all ? ranked : ranked.slice(0, 8);

  return (
    <section className="pb-stack">
      <SectionHeader
        title={title}
        count={plural(legends.length, 'career')}
        description="Finished, and ranked by what they won"
      />
      <Card flush>
        <List label="All-time coaches" className="pb-list--inset">
          {shown.map((l, i) => (
            <ListRow
              key={`${l.name}-${l.from}-${i}`}
              lead={<span className="pb-rank">{i + 1}</span>}
              title={l.name}
              subtitle={`${l.from === l.to ? l.from : `${l.from}–${l.to}`} · ${l.stints[l.stints.length - 1]?.school ?? 'Unknown'}`}
              status={(
                <>
                  {l.you && <Tag tone="positive">You</Tag>}
                  {inTheHall(l) && <Medal metal="gold" size={20} label="In the hall" />}
                  {l.titles > 0 && <Tag>{plural(l.titles, 'title')}</Tag>}
                </>
              )}
              value={recordText(l.careerWins, l.careerLosses)}
            />
          ))}
        </List>
      </Card>
      {ranked.length > shown.length && (
        <Button size="sm" variant="quiet" iconAfter="chevron-down" onClick={() => setAll(true)}>
          {`Show all ${ranked.length}`}
        </Button>
      )}
    </section>
  );
}
