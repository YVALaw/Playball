// Colleges.tsx
// The directory. Ninety six programs, grouped the way the country is.
//
// Every other route to a rival's page runs through a table that happens to
// mention them — the standings, the rankings, a wire story. This screen is the
// front door: any program, any time, one tap to its full card. Grouped by
// conference rather than alphabetised because nobody thinks of a college
// baseball team by its initial.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import { teamColour } from '../Avatar.js';
import { prestigeStars } from '../../engine/program.js';
import { useOpenTeam } from './TeamCard.js';
import { CONFERENCES } from '../../data/schools.js';

export function Colleges() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  const openTeam = useOpenTeam();
  void version;

  if (!season || !team) return null;

  // The season's team order is the data; the conference list is the shelving.
  //
  // Matched on `id`, not `name`. A team record carries `conf.id` — 'GULF' —
  // and the first version of this screen filtered on 'Gulf Coast Conference',
  // which matched nothing and rendered a directory of no schools at all.
  const byConference = CONFERENCES.map((c) => ({
    id: c.id,
    name: c.name,
    teams: season.teams
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.conference === c.id)
      .sort((a, b) => b.t.prestige - a.t.prestige),
  })).filter((c) => c.teams.length > 0);

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">{season.teams.length} PROGRAMS · {byConference.length} CONFERENCES</div>
            <div style={{
              font: "800 21px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
            }}>Colleges</div>
          </div>
        </div>
      }
    >
      <div style={{ padding: '8px 14px 16px' }}>
        {byConference.map((c) => (
          <div key={c.id} style={{ marginBottom: 14 }}>
            {/* Sticky inside the scroller, so the shelf you are reading stays
                named however far down its twelve rows you are. */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 1,
              padding: '7px 0 5px', background: 'var(--field)',
              borderBottom: '2px solid var(--ink)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span className="label">{c.name}</span>
              <span style={{ font: "400 9px var(--mono)", color: 'var(--dim)' }}>
                {c.teams.length}
              </span>
            </div>
            <div style={{ border: '1px solid var(--faint)', background: 'var(--paper)' }}>
              {c.teams.map(({ t, i }) => {
                const mine = i === team.index;
                const stars = prestigeStars(t.prestige);
                return (
                  <button
                    key={t.def.abbr}
                    onClick={() => openTeam(i)}
                    className="tap"
                    style={{
                      width: '100%', textAlign: 'left',
                      display: 'grid', gridTemplateColumns: '38px 1fr auto auto',
                      gap: 8, alignItems: 'center',
                      padding: '8px 10px', minHeight: 40,
                      borderBottom: '1px solid var(--hairline)',
                      borderLeft: `3px solid ${teamColour(t.def.abbr)}`,
                      background: mine ? 'rgba(168,68,42,.08)' : 'transparent',
                    }}
                  >
                    <span style={{
                      font: "700 10px var(--mono)", letterSpacing: '.06em',
                      color: teamColour(t.def.abbr),
                    }}>{t.def.abbr}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{
                        display: 'block', font: `${mine ? 700 : 400} 12.5px var(--body)`,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{t.def.school}</span>
                      <span style={{
                        display: 'block', font: "400 9px var(--mono)", color: 'var(--dim)',
                      }}>{t.def.nickname}</span>
                    </span>
                    <span style={{
                      font: "600 9px var(--mono)", color: 'var(--clay)', whiteSpace: 'nowrap',
                    }}>{'★'.repeat(stars)}</span>
                    <span style={{
                      font: "400 11px var(--mono)", color: 'var(--dim)',
                      minWidth: 38, textAlign: 'right',
                    }}>{t.w}-{t.l}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </FixedHeader>
  );
}
