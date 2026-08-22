// History.tsx
// The record books. Without this a dynasty is just a series of unrelated
// seasons — you roll the year, the rosters are rewritten, and the one before is
// gone. This is the screen that makes five years mean something.

import { useDynasty, useUserTeam } from '../../state/store.js';
import { FINISH_LABEL, type Finish } from '../../engine/postseason.js';

/** Deep runs earn colour. Everything else stays quiet. */
const FINISH_COLOR: Record<Finish, string> = {
  missed: 'var(--dim)',
  regional: 'var(--ink)',
  omaha: 'var(--clay)',
  'runner-up': 'var(--clay)',
  champion: 'var(--clay)',
};

export function History() {
  const history = useDynasty((s) => s.history);
  const version = useDynasty((s) => s.version);
  const team = useUserTeam();
  void version;

  if (!team) return null;

  if (history.length === 0) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center' }}>
        <div className="label">NO SEASONS ON RECORD</div>
        <div style={{
          marginTop: 8, font: "400 12px/1.6 var(--body)", color: 'var(--dim)',
          maxWidth: 260, margin: '8px auto 0',
        }}>
          Finish a season and roll the year over. Everything you do from here is
          written down.
        </div>
      </div>
    );
  }

  const wins = history.reduce((a, s) => a + s.w, 0);
  const losses = history.reduce((a, s) => a + s.l, 0);
  const titles = history.filter((s) => s.finish === 'champion').length;
  const omaha = history.filter(
    (s) => s.finish === 'omaha' || s.finish === 'runner-up' || s.finish === 'champion',
  ).length;
  const rings = history.filter((s) => s.wonConference).length;

  return (
    <div style={{ padding: '12px 14px 16px' }}>
      <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
        <div className="label">
          PROGRAM RECORD · {history.length} SEASON{history.length === 1 ? '' : 'S'}
        </div>
        <div style={{
          font: "800 26px/0.95 var(--display)", marginTop: 4, textTransform: 'uppercase',
        }}>{wins}-{losses}</div>
      </div>

      <div style={{
        display: 'flex', marginTop: 12,
        border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <Tile k="TITLES" v={titles} />
        <Tile k="OMAHA" v={omaha} />
        <Tile k="CONF TITLES" v={rings} last />
      </div>

      <div style={{
        marginTop: 14, border: '1px solid var(--faint)', background: 'var(--paper)',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '40px 52px 30px 1fr',
          gap: 6, padding: '7px 10px', borderBottom: '1px solid var(--hairline)',
        }}>
          {['YEAR', 'RECORD', 'CONF', 'FINISH'].map((c, i) => (
            <span key={c} className="label" style={{ textAlign: i === 3 ? 'left' : 'left' }}>{c}</span>
          ))}
        </div>

        {[...history].reverse().map((s) => (
          <div key={s.year} style={{
            display: 'grid', gridTemplateColumns: '40px 52px 30px 1fr',
            gap: 6, alignItems: 'center',
            padding: '9px 10px', borderBottom: '1px solid var(--hairline)',
            background: s.finish === 'champion' ? 'rgba(168,68,42,.08)' : 'transparent',
          }}>
            <span style={{ font: "700 13px var(--display)" }}>{s.year}</span>
            <span style={{ font: "400 11px var(--mono)" }}>{s.w}-{s.l}</span>
            <span style={{
              font: "400 11px var(--mono)", color: 'var(--dim)',
            }}>{ordinal(s.confPlace)}</span>
            <span style={{
              font: `${s.finish === 'champion' ? 600 : 400} 11px var(--body)`,
              color: FINISH_COLOR[s.finish],
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {s.wonConference ? '★ ' : ''}{FINISH_LABEL[s.finish]}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, font: "400 11px/1.5 var(--body)", color: 'var(--dim)' }}>
        ★ marks a conference tournament title, which carries an automatic bid to the
        national field however the regular season went.
      </div>
    </div>
  );
}

function Tile({ k, v, last }: { k: string; v: number; last?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '9px 8px',
      borderRight: last ? 'none' : '1px solid var(--hairline)',
    }}>
      <div className="label">{k}</div>
      <div style={{
        font: "700 24px/1 var(--display)", marginTop: 2,
        color: v > 0 ? 'var(--clay)' : 'var(--ink)',
      }}>{v}</div>
    </div>
  );
}

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? 'th');
};
