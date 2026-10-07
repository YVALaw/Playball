// lineup-hold.test.ts
// Holding a man on the Lineup screen (2026-10-07): the whole profile opens,
// with his season's numbers at the top of it, and back returns to the lineup.
// The line that shows the hold charging is drawn on the pitching side as well
// as the hitting side. Checked in Chromium by hand; pinned here at the source,
// since a server render reads the store's empty initial state.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const player = readFileSync('src/ui/screens/Player.tsx', 'utf8');
const lineup = readFileSync('src/ui/screens/Lineup.tsx', 'utf8');

describe('the lineup hold opens the whole profile', () => {
  it('the card always opens at its top, so one back closes it', () => {
    expect(player).toContain('const [section, setSection] = useState<Section | null>(null);');
    expect(player).toContain('const fromTop = deeper !== null;');
  });

  it('a hold puts his season on the profile, above the rest of it', () => {
    expect(player).toContain("const [withStats] = useState(playerCardSection === 'stats');");
    const hub = player.slice(player.indexOf('{deeper === null ? ('));
    const stats = hub.indexOf('{withStats && (');
    const season = hub.indexOf('<ThisSeason p={p} half={half} />');
    const glance = hub.indexOf('<Glance ');
    const more = hub.indexOf('<MoreAboutHim ');
    expect(stats).toBeGreaterThan(-1);
    expect(season).toBeGreaterThan(stats);
    expect(glance).toBeGreaterThan(season);
    expect(more).toBeGreaterThan(glance);
  });

  it('every hold on the lineup asks for that card', () => {
    expect(lineup).toContain("() => openPlayer(id, 'stats'),");
  });
});

describe('the hold line', () => {
  it('is drawn on every list a man can be held in: the nine, the bench, the rotation, the bullpen', () => {
    const rows = lineup.match(/buttonProps=\{[^\n]*holdStats\(p\.id\)/g) ?? [];
    const lines = lineup.match(/\$\{held\(p\.id\)\}/g) ?? [];
    expect(rows.length).toBe(4);
    expect(lines.length).toBe(rows.length);
  });
});
