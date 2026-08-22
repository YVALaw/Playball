// Awards.tsx
// End of season honours, plus the All-Conference first team.
//
// These only mean anything once a season is in the books, so the screen says so
// rather than showing a leaderboard of nobody.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { FloatingAction } from '../Sticky.js';
import { seasonComplete } from '../../engine/season.js';
import { seasonAwards, allConference } from '../../engine/postseason.js';

export function Awards() {
  // Rendered both as a normal screen and as a step of the offseason. The
  // continue only belongs in the second case.
  const phase = useDynasty((s) => s.phase);
  const nextPhase = useDynasty((s) => s.nextPhase);
  const openPlayer = useDynasty((s) => s.openPlayer);
  const season = useDynasty((s) => s.season);
  const year = useDynasty((s) => s.year);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  void version;

  if (!season || !team) return null;

  if (!seasonComplete(season)) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center' }}>
        <div className="label">SEASON IN PROGRESS</div>
        <div style={{
          marginTop: 8, font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
          maxWidth: 250, margin: '8px auto 0',
        }}>
          Awards are handed out when the regular season is over.
        </div>
      </div>
    );
  }

  const awards = seasonAwards(season);
  const first = allConference(season);

  return (
    <div style={{ padding: '12px 14px 16px' }}>
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
        <div className="label">{year} HONOURS</div>
        <div style={{
          font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
        }}>Awards</div>
      </div>

      {awards.map((a) => {
        const ours = a.team === team.def.abbr;
        return (
          <div key={a.title} style={{
            marginTop: 12, border: '1px solid var(--faint)', background: 'var(--paper)',
          }}>
            <div style={{ padding: '6px 10px', background: 'var(--clay)' }}>
              <span style={{
                font: "600 9px var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
              }}>{a.title.toUpperCase()}</span>
            </div>
            <button
              onClick={() => a.id && openPlayer(a.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px 12px',
                background: 'transparent',
              }}
            >
              <div style={{
                font: "800 20px/1 var(--display)", textTransform: 'uppercase',
                color: ours ? 'var(--clay)' : 'var(--ink)',
              }}>{a.name}</div>
              <div style={{
                marginTop: 5, font: "400 11px var(--mono)", color: 'var(--dim)',
              }}>{a.team} · {a.line}</div>
            </button>
          </div>
        );
      })}

      <div style={{
        marginTop: 22, borderBottom: '2px solid var(--ink)', paddingBottom: 6,
      }}>
        <div className="label">ALL-CONFERENCE FIRST TEAM</div>
      </div>

      <div style={{
        marginTop: 8, border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        {first.map((p, i) => {
          const ours = p.team === team.def.abbr;
          return (
            <button
              key={`${p.position}-${p.id}-${i}`}
              onClick={() => openPlayer(p.id)}
              style={{
                width: '100%', textAlign: 'left',
                display: 'grid', gridTemplateColumns: '30px 1fr 30px',
                gap: 8, alignItems: 'center',
                padding: '8px 10px', borderBottom: '1px solid var(--hairline)',
                background: ours ? 'rgba(168,68,42,.06)' : 'transparent',
              }}>
              <span style={{
                font: "600 10px var(--mono)", letterSpacing: '.1em', color: 'var(--clay)',
              }}>{p.position}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  font: `${ours ? 600 : 400} 13px var(--body)`,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.name}</div>
                <div style={{
                  font: "400 10px var(--mono)", color: 'var(--dim)',
                }}>{p.line}</div>
              </div>
              <span style={{
                font: "400 10px var(--mono)", color: 'var(--dim)', textAlign: 'right',
              }}>{p.team}</span>
            </button>
          );
        })}
      </div>
      {phase !== null && (
        <FloatingAction label="SEASON REVIEW" onClick={() => void nextPhase()} />
      )}
    </div>
  );
}
